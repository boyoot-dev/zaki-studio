// Finding a project's material and building its register (task 156): the walk, the content id,
// the files that are copies, and the rows. This is extract.py's loop without its writes: it
// reads only what it must (a file whose path, size and modified time are unchanged is not even
// hashed, and one whose text the register already has is not opened), and it hands everything
// it read back to the caller, which writes the text into .studio/.
//
// Pure Node, no Electron, so scripts/material-check.ts can run the very same pass over the
// owner's material and compare its rows with the work folder's index.csv.

import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { insideProject } from "../shared/inside.ts";
import type { FileRow } from "../shared/model";
import {
	currentAcademicYear,
	fileRow,
	loadRules,
	loadSubjects,
	type ReadCounts,
	type ReadGive,
	type RowInput,
} from "../shared/register.ts";
import { fileKind, readTextFile } from "./read.ts";

/** The folders a scan never looks inside: the Studio's own memory, and the Inbox's unsorted files. */
const SKIPPED_ANYWHERE = new Set([".studio"]);
const SKIPPED_AT_TOP = new Set(["Inbox"]);

/** The largest file a scan opens: a school book is far smaller, and a bigger one is a mistake. */
export const MAX_FILE_BYTES = 300 * 1024 * 1024;

/** One material file on disk, as the walk found it. */
export type FoundFile = {
	/** The path inside the project, with "/" between parts. */
	rel: string;
	size: number;
	/** Nanoseconds since the epoch as text, as the work folder's index.csv writes it. */
	mtime: string;
};

/** How far a collect has got, for the progress line. */
export type CollectProgress = { found: number; read: number; hashed: number };

/** One file this pass read, whose text the scan writes into .studio/text. */
export type ReadFile = {
	id: string;
	rel: string;
	pages: string[];
	images: number[];
};

/** What a collect found and read. */
export type Collected = {
	rows: FileRow[];
	/** The files whose text was read now, in the walk's order. */
	texts: ReadFile[];
	found: number;
	hashed: number;
	read: number;
};

/** Everything a collect needs. */
export type CollectInput = {
	/** The project folder: every path in the register is relative to it. */
	root: string;
	/** The rows the project already keeps. */
	old: readonly FileRow[];
	/** The rows of a work folder's index.csv beside it, when there is one: adoption copied these. */
	work?: readonly FileRow[];
	today?: Date;
	/** Reads one file's text; the scan passes readTextFile, and a test passes its own. */
	read?: (path: string, bytes: Uint8Array) => Promise<ReadGive>;
	progress?: (state: CollectProgress) => void;
	cancelled?: () => boolean;
};

/** Why a collect stopped: the author cancelled it. */
export type CollectStopped = { ok: false; code: "cancelled" };

/**
 * Every PDF, Word and PowerPoint file of the project, in the order extract.py walks them:
 * a folder's files first, then its folders, each sorted by name.
 */
export function findFiles(root: string): FoundFile[] {
	const out: FoundFile[] = [];
	const walk = (folder: string, rel: string, depth: number) => {
		if (depth > 14) return;
		let names: string[];
		try {
			names = readdirSync(folder);
		} catch {
			return;
		}
		const folders: string[] = [];
		for (const name of names.sort()) {
			// Our own folder, wherever it is, and the Inbox at the top: the pipeline walked
			// everything else, a folder the author named ".pptx_sheet" included.
			if (SKIPPED_ANYWHERE.has(name)) continue;
			if (rel === "" && SKIPPED_AT_TOP.has(name)) continue;
			const full = join(folder, name);
			let info: ReturnType<typeof lstatSync>;
			try {
				info = lstatSync(full, { bigint: true });
			} catch {
				continue;
			}
			// A link may lead anywhere: it is never followed, and never registered. Every path is
			// checked against the project root as well, through the one guard.
			if (info.isSymbolicLink()) continue;
			if (!insideProject(root, full)) continue;
			if (info.isDirectory()) {
				folders.push(name);
				continue;
			}
			if (fileKind(name) === "") continue;
			out.push({
				rel: rel === "" ? name : `${rel}/${name}`,
				size: Number(info.size),
				mtime: info.mtimeNs.toString(),
			});
		}
		for (const name of folders) {
			walk(join(folder, name), rel === "" ? name : `${rel}/${name}`, depth + 1);
		}
	};
	walk(root, "", 0);
	return out;
}

/** A file's content id: the first twelve hex digits of its SHA-1, as extract.py makes it. */
export function fileId(bytes: Uint8Array): string {
	return createHash("sha1").update(bytes).digest("hex").slice(0, 12);
}

/** The id a file that can't even be opened is known by, so it isn't new on every scan. */
function pathId(rel: string): string {
	return createHash("sha1").update(rel).digest("hex").slice(0, 12);
}

/** A text file beside the material, or "" when it isn't there. */
function optionalTextFile(path: string): string {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return "";
	}
}

/** What the project already knows about one file's read, or null when it has to be read now. */
function knownCounts(
	known: FileRow | undefined,
	work: FileRow | undefined,
): ReadCounts | null {
	for (const row of [known, work]) {
		if (row === undefined) continue;
		// A row from before the register kept pages (task 153) has no answer yet.
		if (row.pages === null && row.error === "") continue;
		return {
			pages: row.pages ?? 0,
			images: row.imagePages,
			metaDate: row.metaDate,
			error: row.error,
		};
	}
	return null;
}

/** The corrections the author made on a row, as the values fileRow puts back. */
function fixedOf(
	row: FileRow | undefined,
): Partial<Record<string, number | string | null>> {
	const fixed: Partial<Record<string, number | string | null>> = {};
	if (row === undefined) return fixed;
	for (const field of row.fixed) fixed[field] = row[field];
	return fixed;
}

/**
 * The project's register rows, made from what is on disk now: new files are hashed and read,
 * known ones are left alone, a moved file keeps its id, and a copy points at the first file
 * with the same bytes. Nothing is written here.
 */
export async function collectRows(
	input: CollectInput,
): Promise<{ ok: true; collected: Collected } | CollectStopped> {
	const read = input.read ?? readTextFile;
	const today = input.today ?? new Date();
	const root = input.root;
	let folders: Record<string, string> = {};
	let rules: ReturnType<typeof loadRules> = [];
	// A rules file the Studio can't read gives every file the default authority: the scan still
	// finishes, and the register shows what it could.
	try {
		folders = loadSubjects(optionalTextFile(join(root, "_subjects.csv")));
	} catch {
		folders = {};
	}
	try {
		rules = loadRules(optionalTextFile(join(root, "_sources.csv")));
	} catch {
		rules = [];
	}
	const currentYear = currentAcademicYear(today);
	const curriculum = basename(root);

	const found = findFiles(root);
	const byPath = new Map(input.old.map((row) => [row.path, row]));
	const byId = new Map<string, FileRow>();
	for (const row of input.old) if (!byId.has(row.id)) byId.set(row.id, row);
	const workById = new Map<string, FileRow>();
	for (const row of input.work ?? [])
		if (!workById.has(row.id)) workById.set(row.id, row);

	// The first place each content was found, as extract.py's `first` map: a copy points there.
	// A file the register already had keeps the content, even when a new copy of it comes first
	// in the walk: the author's own file stays the original, and the newcomer is the duplicate.
	const first = new Map<string, string>();
	for (const file of found) {
		const prev = byPath.get(file.rel);
		if (prev !== undefined && !first.has(prev.id)) first.set(prev.id, file.rel);
	}
	const rows: FileRow[] = [];
	const texts: ReadFile[] = [];
	let hashed = 0;
	let reads = 0;

	for (const [index, file] of found.entries()) {
		// Give the event loop a turn before every file. Without it, a project of known files
		// never awaited anything, so the window froze and Stop could not arrive until the
		// whole walk was done (1,699 files, found 2026-11-13).
		await nextTurn();
		if (input.cancelled?.() === true) return { ok: false, code: "cancelled" };
		const absolute = join(root, ...file.rel.split("/"));
		const prev = byPath.get(file.rel);
		let bytes: Uint8Array | null = null;
		let error = "";
		if (
			prev === undefined ||
			prev.size !== file.size ||
			prev.mtime !== file.mtime
		) {
			try {
				if (file.size > MAX_FILE_BYTES) throw new Error("larger than 300 MB");
				bytes = new Uint8Array(await readFile(absolute));
				hashed += 1;
			} catch (failure) {
				error = failure instanceof Error ? failure.message : String(failure);
			}
		}
		const id = bytes === null ? (prev?.id ?? pathId(file.rel)) : fileId(bytes);
		const original = first.get(id);
		const dupOf =
			original === undefined || original === file.rel ? "" : original;
		if (original === undefined) first.set(id, file.rel);

		const known = prev ?? byId.get(id);
		let counts = error === "" ? knownCounts(known, workById.get(id)) : null;
		if (error !== "") {
			error = error.slice(0, 120);
		} else if (counts === null) {
			// A row from before the register kept pages has nothing to reuse: read it once.
			if (bytes === null) {
				try {
					bytes = new Uint8Array(await readFile(absolute));
				} catch (failure) {
					error = String(
						failure instanceof Error ? failure.message : failure,
					).slice(0, 120);
				}
			}
			if (bytes !== null) {
				const give = await read(file.rel, bytes);
				reads += 1;
				counts = {
					pages: give.pages.length,
					images: give.images.length,
					metaDate: give.metaDate,
					error: give.error,
				};
				if (give.error === "" && dupOf === "")
					texts.push({
						id,
						rel: file.rel,
						pages: give.pages,
						images: give.images,
					});
			}
		}
		const rowInput: RowInput = {
			rel: file.rel,
			curriculum,
			id,
			dupOf,
			size: file.size,
			mtime: file.mtime,
			read: counts ?? {
				pages: 0,
				images: 0,
				metaDate: "",
				error,
			},
			firstSeen: known?.firstSeen ?? workById.get(id)?.firstSeen ?? "",
			folders,
			rules,
			today,
			currentYear,
			fixed: fixedOf(known),
		};
		rows.push(fileRow(rowInput));
		input.progress?.({ found: index + 1, read: reads, hashed });
	}

	return {
		ok: true,
		collected: { rows, texts, found: found.length, hashed, read: reads },
	};
}

/** Lets pending events (a Stop click, a progress message) run before the next file. */
function nextTurn(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}
