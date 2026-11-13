// A small reader for the zip files Word and PowerPoint save (task 156). A .docx or a .pptx is a
// zip of XML, and the Studio only needs the text of a few entries, so it reads the archive
// itself with Node's zlib instead of shipping a zip library. A file from a school is not to be
// trusted: an entry that inflates past 50 MB, an archive with more than 2,000 entries, and the
// ZIP64 sizes this reader cannot follow are all refused with a message rather than a crash.

import { inflateRawSync } from "node:zlib";

/** The most entries an archive may hold: a textbook's slides and images stay far below. */
export const ZIP_MAX_ENTRIES = 2000;
/** The most one entry may inflate to: a page of XML is kilobytes. */
export const ZIP_MAX_BYTES = 50 * 1024 * 1024;

/** One entry: its name, how it is stored, and where its bytes are. */
export type Entry = {
	name: string;
	method: number;
	compressed: number;
	size: number;
	at: number;
};

/** An error a person can read, for a file the Studio refuses. */
export class ZipError extends Error {}

/** The end-of-central-directory record, searched for from the end as every zip reader does. */
function endRecord(bytes: Uint8Array): number {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const stop = Math.max(0, bytes.length - 66_000);
	for (let at = bytes.length - 22; at >= stop; at -= 1) {
		if (view.getUint32(at, true) === 0x06054b50) return at;
	}
	throw new ZipError("not a zip file");
}

/** Every entry of an archive, refusing one with too many of them or an unfollowable size. */
export function zipEntries(bytes: Uint8Array): Entry[] {
	if (!(bytes instanceof Uint8Array) || bytes.length < 22)
		throw new ZipError("not a zip file");
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const end = endRecord(bytes);
	const count = view.getUint16(end + 10, true);
	const at = view.getUint32(end + 16, true);
	if (count === 0xffff || at === 0xffffffff)
		throw new ZipError("too large to read (ZIP64)");
	if (count > ZIP_MAX_ENTRIES)
		throw new ZipError(`more than ${ZIP_MAX_ENTRIES} entries`);
	const entries: Entry[] = [];
	let cursor = at;
	for (let i = 0; i < count; i += 1) {
		if (
			cursor + 46 > bytes.length ||
			view.getUint32(cursor, true) !== 0x02014b50
		)
			throw new ZipError("damaged archive");
		const method = view.getUint16(cursor + 10, true);
		const compressed = view.getUint32(cursor + 20, true);
		const size = view.getUint32(cursor + 24, true);
		const nameLength = view.getUint16(cursor + 28, true);
		const extra = view.getUint16(cursor + 30, true);
		const comment = view.getUint16(cursor + 32, true);
		const local = view.getUint32(cursor + 42, true);
		if (
			compressed === 0xffffffff ||
			size === 0xffffffff ||
			local === 0xffffffff
		)
			throw new ZipError("too large to read (ZIP64)");
		const name = new TextDecoder("utf-8").decode(
			bytes.subarray(cursor + 46, cursor + 46 + nameLength),
		);
		entries.push({ name, method, compressed, size, at: local });
		cursor += 46 + nameLength + extra + comment;
	}
	return entries;
}

/** One entry's bytes, inflated with the entry's own method and refused when it is too big. */
export function zipRead(bytes: Uint8Array, entry: Entry): Uint8Array {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (
		entry.at + 30 > bytes.length ||
		view.getUint32(entry.at, true) !== 0x04034b50
	)
		throw new ZipError(`damaged entry ${entry.name}`);
	const nameLength = view.getUint16(entry.at + 26, true);
	const extra = view.getUint16(entry.at + 28, true);
	const start = entry.at + 30 + nameLength + extra;
	const body = bytes.subarray(start, start + entry.compressed);
	if (entry.size > ZIP_MAX_BYTES)
		throw new ZipError(`${entry.name} inflates past 50 MB`);
	if (entry.method === 0) {
		if (body.length > ZIP_MAX_BYTES)
			throw new ZipError(`${entry.name} is larger than 50 MB`);
		return body;
	}
	if (entry.method !== 8)
		throw new ZipError(
			`${entry.name} uses a compression the Studio can't read`,
		);
	try {
		return new Uint8Array(
			inflateRawSync(body, { maxOutputLength: ZIP_MAX_BYTES }),
		);
	} catch {
		throw new ZipError(`${entry.name} inflates past 50 MB or is damaged`);
	}
}

/** One text entry of an archive as text, or "" when the archive has no such entry. */
export function zipText(
	bytes: Uint8Array,
	entries: readonly Entry[],
	name: string,
): string {
	const entry = entries.find((candidate) => candidate.name === name);
	if (entry === undefined) return "";
	return new TextDecoder("utf-8", { fatal: false }).decode(
		zipRead(bytes, entry),
	);
}
