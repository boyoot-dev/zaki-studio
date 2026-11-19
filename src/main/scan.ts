// One scan of a project's material (task 156): find the files the register doesn't know, record
// them, read their text page by page, draw the pages that are pictures and read those with
// Tesseract, and say what is new. It is the whole of extract.py and ocr.py, in the Studio.
//
// Nothing in the material is ever moved, renamed or written: every write goes into .studio/
// (files.json, new.json, text/, pages/, pending.json). A scan can be stopped, and the next one
// continues where it stopped. Every path is built from the project root, so nothing outside it
// can be touched.

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import type { Failure, ScanProgress } from "../shared/api.ts";
import { settleLanguage } from "../shared/convert.ts";
import { type FileRow, PAGES_DIR } from "../shared/model.ts";
import { pngProblem } from "../shared/png.ts";
import { STUDIO_DIR } from "../shared/project.ts";
import {
	compareRows,
	langCourses,
	type NewMaterial,
	newMaterial,
	type ReportCourse,
	readIndex,
	registerRows,
	tessLangs,
} from "../shared/register.ts";
import { pagePng, textFile, withOcr } from "../shared/text.ts";
import { collectRows } from "./collect.ts";
import { readProject, safePath } from "./files.ts";
import {
	readFiles,
	readModel,
	readPending,
	readReport,
	readTextFile,
	writeFiles,
	writePending,
	writeReport,
	writeTextFile,
} from "./model.ts";
import { copyNotes } from "./notes.ts";
import { missingLangs } from "./ocr.ts";

/**
 * What a scan needs: where Tesseract's files are, and how to stop. The pages' languages come
 * from the project's own courses (task 224).
 */
export type ScanOptions = {
	/** The Studio folder, where node_modules and resources/tessdata are. */
	studioRoot: string;
	onProgress?: (progress: ScanProgress) => void;
	cancelled?: () => boolean;
	today?: Date;
	/** Draws a page into a PNG: the hidden reader in the app, a stub in a test. */
	render?: (bytes: Uint8Array, page: number) => Promise<Uint8Array>;
	/** Reads a page's picture: Tesseract's pool in the app, a stub in a test. */
	ocr?: { text(png: Uint8Array, langs: string): Promise<string> };
};

/** What a scan gives back: everything new, the register as it now stands, and whether it ended. */
export type ScanOutcome =
	| { ok: true; report: NewMaterial; files: FileRow[]; stopped: boolean }
	| Failure;

/** "2026-11-13 07:20": the minute a scan ran, as the pipeline's report names it. */
function stamp(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The project folder's own name, which is its curriculum's id. */
function curriculumOf(root: string): string {
	return (
		root
			.split(/[\\/]/)
			.filter((part) => part !== "")
			.pop() ?? ""
	);
}

/** The work folder's register rows beside the project, when the project came from one. */
function workRows(root: string): FileRow[] {
	const file = join(dirname(root), "_work", "index.csv");
	if (!existsSync(file)) return [];
	try {
		return registerRows(
			readIndex(readFileSync(file, "utf8")),
			curriculumOf(root),
		);
	} catch {
		return [];
	}
}

/** The courses the report reads its units from, or none for a project with no model yet. */
function reportCourses(root: string): ReportCourse[] {
	const model = readModel(root);
	if (!model.ok) return [];
	return model.model.courses.map((course) => ({
		grade: course.grade,
		subject: course.subject,
		language: course.language,
		units: course.units.map((unit) => ({
			number: unit.number,
			period: unit.period,
			title: unit.title,
			source: unit.source,
		})),
	}));
}

/** The pictures a file already has, and the pages Tesseract has already read. */
function drawnPages(folder: string): { pngs: Set<number>; read: Set<number> } {
	const pngs = new Set<number>();
	const read = new Set<number>();
	let names: string[] = [];
	try {
		names = readdirSync(folder);
	} catch {
		return { pngs, read };
	}
	for (const name of names) {
		const png = /^p(\d{3,4})\.png$/.exec(name);
		if (png !== null) pngs.add(Number(png[1]));
		const ocr = /^p(\d{3,4})\.ocr\.txt$/.exec(name);
		if (ocr !== null) read.add(Number(ocr[1]));
	}
	return { pngs, read };
}

/** Where one page's picture is kept, in a folder that exists once this returns. */
function picturePath(root: string, id: string, page: number): string {
	// pagePng's path starts at .studio ("pages/<id>/p007.png"), the way the text names it.
	const path = join(root, STUDIO_DIR, pagePng(id, page));
	mkdirSync(dirname(path), { recursive: true });
	return path;
}

/** Where one page's reading is kept, beside its picture. */
function readingPath(root: string, id: string, page: number): string {
	return join(root, STUDIO_DIR, pagePng(id, page)).replace(
		/\.png$/i,
		".ocr.txt",
	);
}

/** One page's reading as it was kept beside its picture, or "". */
function readReading(root: string, id: string, page: number): string {
	try {
		return readFileSync(readingPath(root, id, page), "utf8").trim();
	} catch {
		return "";
	}
}

/**
 * A file's text in memory while its pages are read, so several readings go into it before it is
 * written once. A text the Studio doesn't have is left alone.
 */
class Texts {
	private readonly root: string;
	private readonly cache = new Map<string, string>();

	constructor(root: string) {
		this.root = root;
	}

	/** Puts one page's reading in place of its marker, and writes the text when it changed. */
	merge(id: string, page: number): void {
		let text = this.cache.get(id);
		if (text === undefined) {
			text = readTextFile(this.root, id);
			this.cache.set(id, text);
		}
		if (text === "") return;
		const next = withOcr(text, id, page, readReading(this.root, id, page));
		if (next === text) return;
		this.cache.set(id, next);
		writeTextFile(this.root, id, next);
	}
}

/**
 * Scans a project: finds new material, reads it, draws and reads its picture pages, and writes
 * the report. A stopped scan keeps what it did (each text, each picture, each reading) and
 * remembers the pages it still owes, so the next scan carries on there.
 */
export async function scanProject(
	root: string,
	options: ScanOptions,
): Promise<ScanOutcome> {
	const today = options.today ?? new Date();
	const known = readFiles(root);
	if (!known.ok) return known;
	const before = readReport(root);
	const project = readProject(root);
	const courses = project.ok ? langCourses(project.project) : [];

	const collected = await collectRows({
		root,
		old: known.files,
		work: workRows(root),
		today,
		cancelled: options.cancelled,
		progress: (state) =>
			options.onProgress?.({
				stage: "reading",
				found: state.found,
				read: state.read,
				pages: 0,
				done: 0,
			}),
	});
	// A stopped scan keeps what it read: the texts are written below only when it finishes, so
	// here it simply returns and the next scan begins again from the same register.
	if (!collected.ok) return { ok: false, code: "cancelled" };
	// A row whose folder names no language takes its course's, when the grade has one course
	// of that subject; with two (task 224) it stays "" until the author says which.
	const rows = collected.collected.rows.map((row) =>
		settleLanguage(row, courses),
	);
	const written = writeFiles(root, rows);
	if (!written.ok) return written;
	// A note the pipeline wrote before this project was adopted is kept as it is (task 157).
	copyNotes(
		root,
		join(dirname(root), "_work", "notes"),
		rows.map((row) => row.id),
	);

	// The pages that need a picture and a reading: what this scan just read, plus what a stopped
	// scan still owes.
	const owed = new Map<string, number[]>();
	for (const file of collected.collected.texts) {
		const text = textFile(file.rel, file.pages, file.images, file.id);
		const put = writeTextFile(root, file.id, text);
		if (!put.ok) return put;
		if (file.images.length > 0) owed.set(file.id, [...file.images]);
	}
	for (const file of readPending(root))
		if (!owed.has(file.id)) owed.set(file.id, [...file.pages]);
	const byId = new Map(rows.map((row) => [row.id, row]));
	const todo = [...owed.entries()].filter(([id]) => byId.has(id));
	const total = todo.reduce((sum, [, pages]) => sum + pages.length, 0);
	const texts = new Texts(root);
	const missing = new Set<string>();
	const left: { id: string; pages: number[] }[] = [];
	let done = 0;
	let stopped = false;

	/** Tells the page how far the scan is, in the words the panel shows. */
	const report = (stage: ScanProgress["stage"]) =>
		options.onProgress?.({
			stage,
			found: collected.collected.found,
			read: collected.collected.read,
			pages: total,
			done,
		});

	for (const [fileId, pages] of todo) {
		const row = byId.get(fileId);
		if (row === undefined) continue;
		const drawn = drawnPages(join(root, PAGES_DIR, fileId));
		const owedPages: number[] = [];
		for (const [index, page] of pages.entries()) {
			if (options.cancelled?.() === true) {
				stopped = true;
				owedPages.push(...pages.slice(index));
				break;
			}
			const kept = readReading(root, fileId, page);
			if (kept !== "") {
				// Read before a scan was stopped: put it into the text and move on.
				texts.merge(fileId, page);
				done += 1;
				continue;
			}
			const langs = tessLangs(row.grade, row.subject, courses);
			const absent = missingLangs(options.studioRoot, langs);
			if (absent.length > 0) {
				for (const lang of absent) missing.add(lang);
				owedPages.push(page);
				continue;
			}
			const path = picturePath(root, fileId, page);
			if (!drawn.pngs.has(page)) {
				if (options.render === undefined) {
					owedPages.push(page);
					continue;
				}
				report("pictures");
				const laid = await drawPage(root, row, page, path, options.render);
				if (!laid) {
					owedPages.push(page);
					continue;
				}
			}
			if (options.ocr === undefined) {
				owedPages.push(page);
				continue;
			}
			report("ocr");
			try {
				const png = new Uint8Array(readFileSync(path));
				const reading = await options.ocr.text(png, langs);
				writeFileSync(
					readingPath(root, fileId, page),
					`${reading.trim()}\n`,
					"utf8",
				);
				texts.merge(fileId, page);
			} catch {
				owedPages.push(page);
				continue;
			}
			done += 1;
		}
		if (owedPages.length > 0) left.push({ id: fileId, pages: owedPages });
		if (stopped) break;
	}
	writePending(root, left);

	const changes = compareRows(known.files, rows);
	const material = newMaterial({
		at: stamp(today),
		since: before?.at ?? "",
		found: collected.collected.found,
		read: collected.collected.read,
		ocrPages: done,
		changes,
		courses: reportCourses(root),
		today,
	});
	material.tessdataMissing = [...missing].sort();
	// A stopped scan keeps the last finished report: only a scan that ended replaces it.
	if (!stopped) {
		const kept = writeReport(root, material);
		if (!kept.ok) return kept;
	}
	report("done");
	return { ok: true, report: material, files: rows, stopped };
}

/**
 * Draws one page into `path`, and says whether it worked. A page that cannot be drawn is owed
 * again, and the file's text pages are still read: one bad page never stops a scan.
 */
async function drawPage(
	root: string,
	row: FileRow,
	page: number,
	path: string,
	render: (bytes: Uint8Array, page: number) => Promise<Uint8Array>,
): Promise<boolean> {
	try {
		// The path a row keeps came from the walk, and is checked again here: a page is drawn
		// only from a file inside the project.
		const source = safePath(root, row.path);
		if (source === null) return false;
		const bytes = readFileSync(source);
		const png = await render(new Uint8Array(bytes), page);
		const problem = pngProblem(png);
		if (problem !== "") return false;
		writeFileSync(path, png);
		return true;
	} catch {
		return false;
	}
}
