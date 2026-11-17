// The .zaki curriculum file (task 212): a standard zip holding manifest.json and the bundle's
// text, bundle.json. The owner chose it on 2026-11-17: a .json file looks like something to
// edit in Notepad, a file of our own looks authentic, is smaller, and can carry more files
// later (a cover, pictures, audio, a signature). The bundle inside is unchanged, and
// parseBundle reads it as before.
//
// Like the other format files, this one is copied byte for byte into the apps that read
// bundles and runs in a browser, so it imports nothing: compression is passed in (Node's
// zlib in the Studio, DecompressionStream in a browser). A .zaki file comes from a
// stranger, so the reader checks every size, offset and name before it trusts it, inflates
// only the two entries it needs, and checks each one's CRC-32. Entries it doesn't know are
// ignored, so a later container version can add files that this reader skips. The writer
// gives every entry the same fixed date, so the same bundle always makes the same bytes.

/** The extension of a curriculum file. */
export const ZAKI_EXTENSION = ".zaki";

/** What manifest.json says this file is. */
export const ZAKI_FORMAT = "mr-zaki-curriculum";

/** The container version this reader understands and this writer writes. */
export const ZAKI_CONTAINER = 1;

/** The limits of a .zaki file, checked before anything is inflated. */
export const CONTAINER_LIMITS = {
	/** The whole file. A full KG–12 bundle compresses to far less. */
	fileBytes: 25 * 1024 * 1024,
	/** Entries in the zip. This version writes two. */
	entries: 50,
	/** One inflated entry: BUNDLE_LIMITS.chars (20 million) at 4 UTF-8 bytes each. */
	entryBytes: 80_000_000,
} as const;

/** Why a file can't be read, in short English sentences. Apps translate them by code. */
export const CONTAINER_ISSUES = {
	notZip: "This is not a Mr. Zaki curriculum file.",
	tooBig: "The file is too big.",
	tooManyEntries: "The file holds too many parts.",
	unsupported: "The file is packed in a way Mr. Zaki can't read.",
	badName: "The file holds a part with an unsafe name.",
	noManifest: "This is not a Mr. Zaki curriculum file: it has no manifest.",
	badManifest: "The file's manifest is damaged.",
	newer: "This file was made by a newer Mr. Zaki Studio. Please update.",
	noBundle: "The file has no curriculum inside.",
	damaged: "The file is damaged.",
	notText: "The curriculum inside the file is not readable text.",
} as const;

export type ContainerIssue = keyof typeof CONTAINER_ISSUES;

/** Inflates raw deflate data; it may stop, throw or return more once maxBytes is passed. */
export type InflateRaw = (
	bytes: Uint8Array,
	maxBytes: number,
) => Promise<Uint8Array>;

/** Deflates bytes to raw deflate data (no zlib or gzip header). */
export type DeflateRaw = (bytes: Uint8Array) => Promise<Uint8Array>;

const MANIFEST = "manifest.json";
const BUNDLE = "bundle.json";

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
/** General-purpose flag bit 11: the name is UTF-8. */
const UTF8_NAME = 0x0800;
/** 1980-01-01 00:00 in DOS form: a fixed date, so the output is repeatable. */
const DOS_DATE = 0x0021;

let table: Uint32Array | null = null;

/** The CRC-32 a zip stores for an entry (the standard polynomial, reflected). */
export function crc32(bytes: Uint8Array): number {
	if (table === null) {
		table = new Uint32Array(256);
		for (let n = 0; n < 256; n += 1) {
			let c = n;
			for (let k = 0; k < 8; k += 1)
				c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			table[n] = c >>> 0;
		}
	}
	let crc = 0xffffffff;
	for (let i = 0; i < bytes.length; i += 1)
		crc = (table[(crc ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

/** Writes a .zaki file from a bundle's text: manifest.json first, then bundle.json. */
export async function writeZaki(
	bundleText: string,
	deflateRaw: DeflateRaw,
): Promise<Uint8Array> {
	const encoder = new TextEncoder();
	const manifest = `${JSON.stringify({ format: ZAKI_FORMAT, container: ZAKI_CONTAINER, bundle: BUNDLE }, null, "\t")}\n`;
	const files = [
		{ name: MANIFEST, data: encoder.encode(manifest) },
		{ name: BUNDLE, data: encoder.encode(bundleText) },
	];
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;
	for (const file of files) {
		const name = encoder.encode(file.name);
		const packed = await deflateRaw(file.data);
		const crc = crc32(file.data);

		const local = new Uint8Array(30 + name.length);
		const lv = new DataView(local.buffer);
		lv.setUint32(0, LOCAL, true);
		lv.setUint16(4, 20, true); // version needed: 2.0, deflate
		lv.setUint16(6, UTF8_NAME, true);
		lv.setUint16(8, 8, true); // deflate
		lv.setUint16(10, 0, true);
		lv.setUint16(12, DOS_DATE, true);
		lv.setUint32(14, crc, true);
		lv.setUint32(18, packed.length, true);
		lv.setUint32(22, file.data.length, true);
		lv.setUint16(26, name.length, true);
		lv.setUint16(28, 0, true);
		local.set(name, 30);

		const central = new Uint8Array(46 + name.length);
		const cv = new DataView(central.buffer);
		cv.setUint32(0, CENTRAL, true);
		cv.setUint16(4, 20, true); // made by: 2.0
		cv.setUint16(6, 20, true);
		cv.setUint16(8, UTF8_NAME, true);
		cv.setUint16(10, 8, true);
		cv.setUint16(12, 0, true);
		cv.setUint16(14, DOS_DATE, true);
		cv.setUint32(16, crc, true);
		cv.setUint32(20, packed.length, true);
		cv.setUint32(24, file.data.length, true);
		cv.setUint16(28, name.length, true);
		cv.setUint32(42, offset, true);
		central.set(name, 46);

		locals.push(local, packed);
		centrals.push(central);
		offset += local.length + packed.length;
	}
	const centralSize = centrals.reduce((sum, c) => sum + c.length, 0);
	const end = new Uint8Array(22);
	const ev = new DataView(end.buffer);
	ev.setUint32(0, END, true);
	ev.setUint16(8, files.length, true);
	ev.setUint16(10, files.length, true);
	ev.setUint32(12, centralSize, true);
	ev.setUint32(16, offset, true);

	const parts = [...locals, ...centrals, end];
	const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.length;
	}
	return out;
}

type Entry = {
	method: number;
	crc: number;
	compressed: number;
	size: number;
	header: number;
};

type Read<T> = { ok: true; value: T } | { ok: false; code: ContainerIssue };

const fail = (code: ContainerIssue): { ok: false; code: ContainerIssue } => ({
	ok: false,
	code,
});

/** A name that stays inside the file: relative, no "..", no backslash, no control character. */
function safeName(name: string): boolean {
	if (name === "" || name.length > 255) return false;
	if (name.startsWith("/") || /^[a-z]:/i.test(name)) return false;
	if (name.includes("\\") || /\p{Cc}/u.test(name)) return false;
	return !name.split("/").some((part) => part === "..");
}

/** The entries of the zip, by name, from its central directory. */
function entriesOf(bytes: Uint8Array): Read<Map<string, Entry>> {
	if (bytes.length < 22) return fail("notZip");
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let end = -1;
	const stop = Math.max(0, bytes.length - 22 - 0xffff);
	for (let at = bytes.length - 22; at >= stop; at -= 1) {
		if (view.getUint32(at, true) === END) {
			end = at;
			break;
		}
	}
	if (end < 0) return fail("notZip");
	const count = view.getUint16(end + 10, true);
	const size = view.getUint32(end + 12, true);
	const start = view.getUint32(end + 16, true);
	if (count === 0xffff || size === 0xffffffff || start === 0xffffffff)
		return fail("unsupported"); // ZIP64
	if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0)
		return fail("unsupported"); // split over several disks
	if (count > CONTAINER_LIMITS.entries) return fail("tooManyEntries");
	if (start + size > end) return fail("damaged");

	const decoder = new TextDecoder("utf-8", { fatal: true });
	const entries = new Map<string, Entry>();
	let at = start;
	for (let n = 0; n < count; n += 1) {
		if (at + 46 > end || view.getUint32(at, true) !== CENTRAL)
			return fail("damaged");
		const flags = view.getUint16(at + 8, true);
		const method = view.getUint16(at + 10, true);
		const crc = view.getUint32(at + 16, true);
		const compressed = view.getUint32(at + 20, true);
		const usize = view.getUint32(at + 24, true);
		const nameLength = view.getUint16(at + 28, true);
		const extraLength = view.getUint16(at + 30, true);
		const commentLength = view.getUint16(at + 32, true);
		const header = view.getUint32(at + 42, true);
		if (at + 46 + nameLength > end) return fail("damaged");
		let name: string;
		try {
			name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
		} catch {
			return fail("badName");
		}
		if (!safeName(name)) return fail("badName");
		if (entries.has(name)) return fail("badName");
		if (flags & 0x0001) return fail("unsupported"); // encrypted
		if (compressed === 0xffffffff || usize === 0xffffffff)
			return fail("unsupported"); // ZIP64
		entries.set(name, { method, crc, compressed, size: usize, header });
		at += 46 + nameLength + extraLength + commentLength;
	}
	return { ok: true, value: entries };
}

/** One entry's bytes, inflated and checked against its size and CRC-32. */
async function contentOf(
	bytes: Uint8Array,
	entry: Entry,
	inflateRaw: InflateRaw,
): Promise<Read<Uint8Array>> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (entry.method !== 0 && entry.method !== 8) return fail("unsupported");
	if (entry.size > CONTAINER_LIMITS.entryBytes) return fail("tooBig");
	const h = entry.header;
	if (h + 30 > bytes.length || view.getUint32(h, true) !== LOCAL)
		return fail("damaged");
	const from = h + 30 + view.getUint16(h + 26, true) + view.getUint16(h + 28, true);
	const to = from + entry.compressed;
	if (to > bytes.length) return fail("damaged");
	const raw = bytes.subarray(from, to);
	let data: Uint8Array;
	if (entry.method === 0) {
		data = raw;
	} else {
		try {
			data = await inflateRaw(raw, entry.size);
		} catch {
			return fail("damaged");
		}
	}
	if (data.length !== entry.size || crc32(data) !== entry.crc)
		return fail("damaged");
	return { ok: true, value: data };
}

/** Reads a .zaki file's bundle text, or says in plain words why it can't. */
export async function readZaki(
	bytes: Uint8Array,
	inflateRaw: InflateRaw,
): Promise<
	| { ok: true; text: string }
	| { ok: false; code: ContainerIssue; issue: string }
> {
	const refuse = (code: ContainerIssue) => ({
		ok: false as const,
		code,
		issue: CONTAINER_ISSUES[code],
	});
	if (!(bytes instanceof Uint8Array)) return refuse("notZip");
	if (bytes.length > CONTAINER_LIMITS.fileBytes) return refuse("tooBig");
	const entries = entriesOf(bytes);
	if (!entries.ok) return refuse(entries.code);

	const manifestEntry = entries.value.get(MANIFEST);
	if (manifestEntry === undefined) return refuse("noManifest");
	if (manifestEntry.size > 64 * 1024) return refuse("badManifest");
	const manifestBytes = await contentOf(bytes, manifestEntry, inflateRaw);
	if (!manifestBytes.ok) return refuse(manifestBytes.code);
	let manifest: unknown;
	try {
		manifest = JSON.parse(
			new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes.value),
		);
	} catch {
		return refuse("badManifest");
	}
	if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest))
		return refuse("badManifest");
	const m = manifest as Record<string, unknown>;
	if (m.format !== ZAKI_FORMAT) return refuse("notZip");
	if (typeof m.container !== "number" || !Number.isInteger(m.container) || m.container < 1)
		return refuse("badManifest");
	if (m.container > ZAKI_CONTAINER) return refuse("newer");
	if (typeof m.bundle !== "string" || !safeName(m.bundle))
		return refuse("badManifest");

	const bundleEntry = entries.value.get(m.bundle);
	if (bundleEntry === undefined) return refuse("noBundle");
	const bundleBytes = await contentOf(bytes, bundleEntry, inflateRaw);
	if (!bundleBytes.ok) return refuse(bundleBytes.code);
	try {
		return {
			ok: true,
			text: new TextDecoder("utf-8", { fatal: true }).decode(bundleBytes.value),
		};
	} catch {
		return refuse("notText");
	}
}
