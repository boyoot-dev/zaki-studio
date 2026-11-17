// The .zaki container (task 212): a round trip, a zip made by another tool, and every
// refusal the reader makes for a file from a stranger.

import { deflateRawSync, inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { BUNDLE_LIMITS } from "./bundle.ts";
import {
	CONTAINER_ISSUES,
	CONTAINER_LIMITS,
	crc32,
	readZaki,
	writeZaki,
} from "./container.ts";

const deflate = async (b: Uint8Array) => new Uint8Array(deflateRawSync(b));
const inflate = async (b: Uint8Array, max: number) =>
	new Uint8Array(inflateRawSync(b, { maxOutputLength: max }));

/** A zip made by PowerShell's Compress-Archive: manifest.json and {"hello":"مرحبا"}. */
const POWERSHELL_ZIP =
	"UEsDBBQAAAAIAHKMcV2kfxBFQAAAAEQAAAANAAAAbWFuaWZlc3QuanNvbqtWSssvyk0sUbJSyi3SrUrMztRNLi0qykwuzSnNVdJRSs7PK0nMzEstUrIy1FFKKs1LyUkFqoUw9LKK8/OUagFQSwMEFAAAAAgAcoxxXazWEFgZAAAAFgAAAAsAAABidW5kbGUuanNvbqtWykjNyclXslK62Xpj4421N1bcWK5UCwBQSwECFAAUAAAACAByjHFdpH8QRUAAAABEAAAADQAAAAAAAAAAAAAAAAAAAAAAbWFuaWZlc3QuanNvblBLAQIUABQAAAAIAHKMcV2s1hBYGQAAABYAAAALAAAAAAAAAAAAAAAAAGsAAABidW5kbGUuanNvblBLBQYAAAAAAgACAHQAAACtAAAAAAA=";

const enc = new TextEncoder();

/** A stored (method 0) zip of the given entries, for building broken files by hand. */
function storedZip(
	files: { name: string; data: Uint8Array; crc?: number; flags?: number; method?: number }[],
): Uint8Array {
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;
	for (const f of files) {
		const name = enc.encode(f.name);
		const crc = f.crc ?? crc32(f.data);
		const local = new Uint8Array(30 + name.length);
		const lv = new DataView(local.buffer);
		lv.setUint32(0, 0x04034b50, true);
		lv.setUint16(6, f.flags ?? 0, true);
		lv.setUint16(8, f.method ?? 0, true);
		lv.setUint32(14, crc, true);
		lv.setUint32(18, f.data.length, true);
		lv.setUint32(22, f.data.length, true);
		lv.setUint16(26, name.length, true);
		local.set(name, 30);
		const central = new Uint8Array(46 + name.length);
		const cv = new DataView(central.buffer);
		cv.setUint32(0, 0x02014b50, true);
		cv.setUint16(8, f.flags ?? 0, true);
		cv.setUint16(10, f.method ?? 0, true);
		cv.setUint32(16, crc, true);
		cv.setUint32(20, f.data.length, true);
		cv.setUint32(24, f.data.length, true);
		cv.setUint16(28, name.length, true);
		cv.setUint32(42, offset, true);
		central.set(name, 46);
		locals.push(local, f.data);
		centrals.push(central);
		offset += local.length + f.data.length;
	}
	const size = centrals.reduce((s, c) => s + c.length, 0);
	const end = new Uint8Array(22);
	const ev = new DataView(end.buffer);
	ev.setUint32(0, 0x06054b50, true);
	ev.setUint16(8, files.length, true);
	ev.setUint16(10, files.length, true);
	ev.setUint32(12, size, true);
	ev.setUint32(16, offset, true);
	const parts = [...locals, ...centrals, end];
	const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.length;
	}
	return out;
}

const manifest = (over: Record<string, unknown> = {}) =>
	enc.encode(
		JSON.stringify({ format: "mr-zaki-curriculum", container: 1, bundle: "bundle.json", ...over }),
	);

async function refusal(bytes: Uint8Array) {
	const result = await readZaki(bytes, inflate);
	return result.ok ? "ok" : result.code;
}

describe("the .zaki container", () => {
	it("reads back what it writes, Arabic included", async () => {
		const text = '{"nameAr":"منهج الشروق","nameEn":"Sunrise"}\n';
		const file = await writeZaki(text, deflate);
		expect(await readZaki(file, inflate)).toEqual({ ok: true, text });
	});

	it("writes the same bytes for the same bundle", async () => {
		const a = await writeZaki("{}", deflate);
		const b = await writeZaki("{}", deflate);
		expect(a).toEqual(b);
	});

	it("is smaller than the text it holds", async () => {
		const text = JSON.stringify({ facts: Array(2000).fill("Plants make food by photosynthesis.") });
		const file = await writeZaki(text, deflate);
		expect(file.length).toBeLessThan(text.length / 10);
	});

	it("reads a zip made by another tool", async () => {
		const bytes = new Uint8Array(Buffer.from(POWERSHELL_ZIP, "base64"));
		expect(await readZaki(bytes, inflate)).toEqual({ ok: true, text: '{"hello":"مرحبا"}' });
	});

	it("ignores entries it doesn't know", async () => {
		const bytes = storedZip([
			{ name: "manifest.json", data: manifest() },
			{ name: "cover.png", data: new Uint8Array([1, 2, 3]) },
			{ name: "bundle.json", data: enc.encode("{}") },
		]);
		expect(await readZaki(bytes, inflate)).toEqual({ ok: true, text: "{}" });
	});

	it("keeps entryBytes at four bytes per bundle character", () => {
		expect(CONTAINER_LIMITS.entryBytes).toBe(BUNDLE_LIMITS.chars * 4);
	});

	it("has an English sentence for every refusal", () => {
		for (const text of Object.values(CONTAINER_ISSUES)) expect(text).toMatch(/\.$/);
	});

	it("refuses what isn't a zip", async () => {
		expect(await refusal(enc.encode('{"format":2}'))).toBe("notZip");
		expect(await refusal(new Uint8Array(0))).toBe("notZip");
	});

	it("refuses a file over the size limit before reading it", async () => {
		expect(await refusal(new Uint8Array(CONTAINER_LIMITS.fileBytes + 1))).toBe("tooBig");
	});

	it("refuses too many entries", async () => {
		const files = [{ name: "manifest.json", data: manifest() }];
		for (let i = 0; i < CONTAINER_LIMITS.entries; i += 1)
			files.push({ name: `x${i}.txt`, data: new Uint8Array(0) });
		expect(await refusal(storedZip(files))).toBe("tooManyEntries");
	});

	it("refuses unsafe and repeated names", async () => {
		for (const name of ["../bundle.json", "/etc/x", "a\\b", "C:x", "a/../../b"]) {
			const bytes = storedZip([
				{ name: "manifest.json", data: manifest() },
				{ name, data: new Uint8Array(0) },
			]);
			expect(await refusal(bytes), name).toBe("badName");
		}
		const twice = storedZip([
			{ name: "manifest.json", data: manifest() },
			{ name: "manifest.json", data: manifest() },
		]);
		expect(await refusal(twice)).toBe("badName");
	});

	it("refuses encrypted entries and unknown methods", async () => {
		const encrypted = storedZip([{ name: "manifest.json", data: manifest(), flags: 1 }]);
		expect(await refusal(encrypted)).toBe("unsupported");
		const bzip = storedZip([
			{ name: "manifest.json", data: manifest(), method: 12 },
			{ name: "bundle.json", data: enc.encode("{}") },
		]);
		expect(await refusal(bzip)).toBe("unsupported");
	});

	it("refuses ZIP64", async () => {
		const bytes = storedZip([{ name: "manifest.json", data: manifest() }]);
		const view = new DataView(bytes.buffer);
		view.setUint32(bytes.length - 22 + 16, 0xffffffff, true);
		expect(await refusal(bytes)).toBe("unsupported");
	});

	it("refuses a missing, damaged or foreign manifest", async () => {
		const bundle = { name: "bundle.json", data: enc.encode("{}") };
		expect(await refusal(storedZip([bundle]))).toBe("noManifest");
		expect(
			await refusal(storedZip([{ name: "manifest.json", data: enc.encode("{nope") }, bundle])),
		).toBe("badManifest");
		expect(
			await refusal(storedZip([{ name: "manifest.json", data: manifest({ bundle: "../x" }) }, bundle])),
		).toBe("badManifest");
		expect(
			await refusal(storedZip([{ name: "manifest.json", data: manifest({ format: "epub" }) }, bundle])),
		).toBe("notZip");
	});

	it("asks for an update for a newer container", async () => {
		const bytes = storedZip([
			{ name: "manifest.json", data: manifest({ container: 2 }) },
			{ name: "bundle.json", data: enc.encode("{}") },
		]);
		expect(await refusal(bytes)).toBe("newer");
	});

	it("refuses a file whose bundle is missing", async () => {
		expect(await refusal(storedZip([{ name: "manifest.json", data: manifest() }]))).toBe("noBundle");
	});

	it("refuses a wrong CRC-32 or a cut file", async () => {
		const badCrc = storedZip([
			{ name: "manifest.json", data: manifest() },
			{ name: "bundle.json", data: enc.encode("{}"), crc: 1234 },
		]);
		expect(await refusal(badCrc)).toBe("damaged");
		const good = await writeZaki('{"a":1}', deflate);
		const flipped = good.slice();
		flipped[100] = (flipped[100] ?? 0) ^ 0xff;
		expect(await refusal(flipped)).not.toBe("ok");
	});

	it("refuses an entry that says it is bigger than the limit, before inflating it", async () => {
		const bytes = storedZip([
			{ name: "manifest.json", data: manifest() },
			{ name: "bundle.json", data: enc.encode("{}") },
		]);
		// The bundle's central size field: second central header, offset 24.
		const view = new DataView(bytes.buffer);
		const end = bytes.length - 22;
		const start = view.getUint32(end + 16, true);
		const second = start + 46 + "manifest.json".length;
		view.setUint32(second + 24, CONTAINER_LIMITS.entryBytes + 1, true);
		expect(await refusal(bytes)).toBe("tooBig");
	});

	it("passes the entry's own size as the inflate limit", async () => {
		const file = await writeZaki('{"a":1}', deflate);
		const limits: number[] = [];
		await readZaki(file, async (b, max) => {
			limits.push(max);
			return inflate(b, max);
		});
		expect(limits[1]).toBe(enc.encode('{"a":1}').length);
	});

	it("refuses a bundle that is not UTF-8", async () => {
		const bytes = storedZip([
			{ name: "manifest.json", data: manifest() },
			{ name: "bundle.json", data: new Uint8Array([0xff, 0xfe, 0x00]) },
		]);
		expect(await refusal(bytes)).toBe("notText");
	});
});
