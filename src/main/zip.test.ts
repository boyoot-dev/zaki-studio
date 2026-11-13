// A zip reader with limits (task 156): a .docx or a .pptx from a school is not trusted, so an
// archive with too many entries, an entry that inflates past 50 MB, or the ZIP64 sizes this
// reader cannot follow is refused with a message rather than a fall out of memory. The archives
// here are made in the test, from bytes only.

import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
	ZIP_MAX_BYTES,
	ZIP_MAX_ENTRIES,
	zipEntries,
	zipRead,
	zipText,
} from "./zip";

/** One entry of a made-up archive: its name, its bytes, and whether to compress them. */
type Entry = { name: string; body: Uint8Array; deflate: boolean };

/** A zip file, written by hand: local headers, then the central directory and its end record. */
function archive(entries: readonly Entry[]): Uint8Array {
	const locals: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;
	for (const entry of entries) {
		const name = new TextEncoder().encode(entry.name);
		const body = entry.deflate
			? new Uint8Array(deflateRawSync(entry.body))
			: entry.body;
		const method = entry.deflate ? 8 : 0;
		const local = header(
			0x04034b50,
			name,
			entry.body.length,
			body.length,
			0,
			method,
		);
		locals.push(local, body);
		central.push(
			header(0x02014b50, name, entry.body.length, body.length, offset, method),
		);
		offset += local.length + body.length;
	}
	const start = offset;
	const list = central;
	const size = list.reduce((sum, part) => sum + part.length, 0);
	const end = new Uint8Array(22);
	const view = new DataView(end.buffer);
	view.setUint32(0, 0x06054b50, true);
	view.setUint16(8, entries.length, true);
	view.setUint16(10, entries.length, true);
	view.setUint32(12, size, true);
	view.setUint32(16, start, true);
	return concat([...locals, ...list, end]);
}

/** A local (0x04034b50) or central (0x02014b50) header, with the sizes the reader follows. */
function header(
	signature: number,
	name: Uint8Array,
	size: number,
	compressed: number,
	offset = 0,
	method = 8,
): Uint8Array {
	const central = signature === 0x02014b50;
	const out = new Uint8Array(central ? 46 : 30);
	const view = new DataView(out.buffer);
	view.setUint32(0, signature, true);
	if (central) view.setUint16(8, 20, true);
	view.setUint16(central ? 10 : 8, method, true);
	view.setUint32(central ? 20 : 18, compressed, true);
	view.setUint32(central ? 24 : 22, size, true);
	view.setUint16(central ? 28 : 26, name.length, true);
	if (central) view.setUint32(42, offset, true);
	return concat([out, name]) as Uint8Array;
}

/** Bytes joined into one array. */
function concat(parts: readonly Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.length;
	}
	return out;
}

/** A text entry, compressed or not. */
function text(name: string, body: string, deflate = true): Entry {
	return { name, body: new TextEncoder().encode(body), deflate };
}

describe("the zip reader", () => {
	it("reads a stored entry and a compressed one", () => {
		const bytes = archive([
			text("word/document.xml", "<w:document/>", true),
			text("stored.xml", "plain", false),
		]);
		const entries = zipEntries(bytes);
		expect(entries.map((entry) => entry.name)).toEqual([
			"word/document.xml",
			"stored.xml",
		]);
		expect(zipText(bytes, entries, "word/document.xml")).toBe("<w:document/>");
		expect(zipText(bytes, entries, "stored.xml")).toBe("plain");
		expect(zipText(bytes, entries, "not-there.xml")).toBe("");
	});

	it("refuses an archive with more entries than a textbook could need", () => {
		const many = Array.from({ length: ZIP_MAX_ENTRIES + 1 }, (_, i) =>
			text(`ppt/slides/slide${i}.xml`, "x", false),
		);
		expect(() => zipEntries(archive(many))).toThrow(/2000 entries/);
	});

	it("refuses an entry that says it inflates past 50 MB", () => {
		const big = new Uint8Array(ZIP_MAX_BYTES + 1);
		const bytes = archive([{ name: "huge.xml", body: big, deflate: false }]);
		const entries = zipEntries(bytes);
		expect(() => zipRead(bytes, entries[0] as never)).toThrow(/50 MB/);
	});

	it("stops an entry that inflates far past 50 MB while it is being read", () => {
		// A lie in the central directory: it says ten bytes, and the deflated stream is a
		// megabyte of zeros repeated. The reader follows the stream, not the claim.
		const zeros = new Uint8Array(60 * 1024 * 1024);
		const bytes = archive([{ name: "huge.xml", body: zeros, deflate: true }]);
		const entries = zipEntries(bytes);
		const lie = { ...(entries[0] as never as object), size: 10 } as never;
		expect(() => zipRead(bytes, lie)).toThrow(/50 MB|damaged/);
	});

	it("refuses what is not a zip, and the ZIP64 sizes it cannot follow", () => {
		expect(() => zipEntries(new Uint8Array(30))).toThrow(/not a zip/);
		const bytes = archive([text("a.xml", "a", false)]);
		// The end record's entry count is 0xffff in a ZIP64 archive: this reader says so.
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		view.setUint16(bytes.length - 22 + 10, 0xffff, true);
		expect(() => zipEntries(bytes)).toThrow(/ZIP64/);
	});
});
