// The check the architect runs on the owner's material (task 156): does the Studio's register,
// reading and OCR say what today's pipeline says? It writes nothing, and no private file is
// committed: the Studio's own rules are run over the material folder in memory, and the answers
// are compared with the work folder's index.csv, its text and its OCR.
//
//   npm run material-check -- <materials folder> <work folder>
//
// Three summaries:
//   1. The register: every file of the material folder, row by row against index.csv.
//   2. The text: 30 files with text pages and every kind (PDF, Word, PowerPoint), the share of
//      the work folder's words the Studio's reading has, page by page.
//   3. OCR: 10 picture pages, the Studio's Tesseract reading against the pipeline's .ocr.txt.
//
// It exits 1 when a register rule disagrees (a duplicated copy is reported apart: which of two
// identical files the pipeline walked first is not a rule), so a real difference stops a deploy
// rather than passing quietly.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectRows } from "../src/main/collect.ts";
import { ocrEngine, ocrPoolSize, tessdataDir } from "../src/main/ocr.ts";
import { readTextFile } from "../src/main/read.ts";
import { legacySubject } from "../src/shared/convert.ts";
import type { FileRow } from "../src/shared/model.ts";
import {
	type IndexRow,
	readIndex,
	registerRows,
	tessLangsFor,
} from "../src/shared/register.ts";
import { pageText } from "../src/shared/text.ts";
import { SUBJECTS_FILE, subjectsJson } from "./subjects.ts";

/** How many files the text check reads, and how many pages the OCR check reads. */
const TEXT_FILES = 30;
const OCR_PAGES = 10;

/** The Studio's own folder: node_modules, resources/tessdata. */
const STUDIO = fileURLToPath(new URL("..", import.meta.url));

/** Which register fields are compared, in the order index.csv writes them. */
const FIELDS = [
	"id",
	"path",
	"grade",
	"year",
	"academicYear",
	"subject",
	"block",
	"kind",
	"dupOf",
	"pages",
	"imagePages",
	"error",
	"curriculum",
	"published",
	"publishedFrom",
	"authority",
	"firstSeen",
	"size",
	"mtime",
	"metaDate",
] as const;
type Field = (typeof FIELDS)[number];

/** Which fields a copy's own place explains, and which a rule must explain. */
const COPY_FIELD: Field = "dupOf";

/** A row as index.csv writes it, as text, in the same fields. */
function indexOf(row: IndexRow): Record<Field, string> {
	return {
		id: row.id,
		path: row.path,
		grade: row.grade,
		year: row.year,
		academicYear: row.academicYear,
		subject: row.subject,
		block: row.block,
		kind: row.kind,
		dupOf: row.dup,
		pages: row.pages,
		imagePages: row.imagePages,
		error: row.error,
		curriculum: row.curriculum,
		published: row.published,
		publishedFrom: row.publishedFrom,
		authority: row.authority,
		firstSeen: row.firstSeen,
		size: row.size,
		mtime: row.mtime,
		metaDate: row.metaDate,
	};
}

/** A Studio row as text, in the same fields. */
function studioOf(row: FileRow, curriculum: string): Record<Field, string> {
	return {
		id: row.id,
		path: `${curriculum}/${row.path}`,
		grade: row.grade === null ? "" : String(row.grade),
		year: row.year,
		academicYear: row.academicYear,
		subject: row.subject,
		block: row.block,
		kind: row.kind,
		dupOf: row.dupOf === "" ? "" : `${curriculum}/${row.dupOf}`,
		pages: row.pages === null ? "" : String(row.pages),
		imagePages: String(row.imagePages),
		error: row.error,
		curriculum,
		published: row.published,
		publishedFrom: row.publishedFrom,
		authority: row.authority === null ? "" : String(row.authority),
		firstSeen: row.firstSeen,
		size: String(row.size),
		mtime: row.mtime,
		metaDate: row.metaDate,
	};
}

/** Words of a page, with the pipeline's own marker lines left out. */
function words(text: string): Map<string, number> {
	const out = new Map<string, number>();
	for (const raw of text.split(/\s+/)) {
		const word = raw.trim();
		if (word === "") continue;
		out.set(word, (out.get(word) ?? 0) + 1);
	}
	return out;
}

/** A file's extension, lowercased and without its dot. */
function extOf(path: string): string {
	return path.slice(path.lastIndexOf(".") + 1).toLowerCase();
}

/** True for a line the pipeline writes as a marker rather than as text. */
function marker(line: string): boolean {
	return (
		/^\[(image page|ocr of image|vision of image|read from image|arabic|figure|handwritten)\b/.test(
			line.trim(),
		) || line.trim() === "(no text found)"
	);
}

/** True when the pipeline read this page from its picture, so only the OCR check can judge it. */
function pictureRead(text: string): boolean {
	// Anywhere on the page: a scanned page often has a little text of its own ("CamScanner")
	// above the marker, and its words are the OCR's, not a text layer's.
	return /^\[(ocr of image|vision of image|read from image)/m.test(text);
}

/** A page's text without its marker lines. */
function withoutMarkers(text: string): string {
	return text
		.split(/\r?\n/)
		.filter((line) => !marker(line))
		.join("\n");
}

/** The share of `theirs`' words that `mine` has, counting each word as often as it appears. */
function share(mine: Map<string, number>, theirs: Map<string, number>): number {
	let all = 0;
	let same = 0;
	for (const [word, count] of theirs) {
		all += count;
		same += Math.min(count, mine.get(word) ?? 0);
	}
	return all === 0 ? 1 : same / all;
}

/** One file's page-by-page share, and the pages that could be compared at all. */
function textShare(
	workText: string,
	ours: readonly string[],
): { pages: number; share: number; words: number; pictures: number } {
	let compared = 0;
	let matched = 0;
	let all = 0;
	let pictures = 0;
	for (const [i, page] of ours.entries()) {
		const whole = pageText(workText, i + 1);
		// A page the pipeline read from a picture has OCR text, not a text layer: the OCR check
		// below is where that page is judged.
		if (pictureRead(whole)) {
			pictures += 1;
			continue;
		}
		const theirs = withoutMarkers(whole);
		if (theirs.trim() === "") continue;
		const mineWords = words(page);
		const theirWords = words(theirs);
		compared += 1;
		all += [...theirWords.values()].reduce((sum, n) => sum + n, 0);
		matched +=
			share(mineWords, theirWords) *
			[...theirWords.values()].reduce((sum, n) => sum + n, 0);
	}
	return {
		pages: compared,
		share: all === 0 ? 1 : matched / all,
		words: all,
		pictures,
	};
}

/** The register: every file's row against the one index.csv holds. */
async function checkRegister(
	materials: string,
	work: string,
	oldRows: FileRow[],
): Promise<{ failures: number; rows: FileRow[] }> {
	const collected = await collectRows({
		root: materials,
		old: oldRows,
		work: [],
		progress: (state) => {
			if (state.found % 1000 === 0)
				process.stdout.write(`  ${state.found} files…\r`);
		},
	});
	if (!collected.ok) throw new Error("the check was stopped");
	const rows = collected.collected.rows;
	const index = readIndex(readFileSync(join(work, "index.csv"), "utf8"));
	const curriculum = basename(materials);
	// The index covers every curriculum in the work folder; this check is about one of them.
	const andTheirs = index.filter((row) => row.curriculum === curriculum);
	const byPath = new Map(andTheirs.map((row) => [row.path, row]));
	const counts = new Map<Field, number>(FIELDS.map((field) => [field, 0]));
	const examples = new Map<Field, string[]>();
	let unmatched = 0;

	for (const row of rows) {
		const theirs = byPath.get(`${curriculum}/${row.path}`);
		if (theirs === undefined) {
			unmatched += 1;
			continue;
		}
		byPath.delete(`${curriculum}/${row.path}`);
		const mine = studioOf(row, curriculum);
		const wanted = indexOf(theirs);
		for (const field of FIELDS) {
			if (mine[field] === wanted[field]) continue;
			counts.set(field, (counts.get(field) ?? 0) + 1);
			const list = examples.get(field) ?? [];
			if (list.length < 3)
				list.push(
					`${row.path}: the Studio says "${mine[field]}", index.csv says "${wanted[field]}"`,
				);
			examples.set(field, list);
		}
	}
	const differences = [...counts.entries()].filter(
		([field, count]) => count > 0 && field !== COPY_FIELD,
	);
	const copies = counts.get(COPY_FIELD) ?? 0;

	console.log(
		`  ${rows.length} files on disk, ${andTheirs.length} rows in index.csv for ${curriculum}, ${collected.collected.hashed} hashed, ${collected.collected.read} read`,
	);
	for (const [field, count] of counts) {
		if (count === 0) continue;
		console.log(`    ${field}: ${count}`);
		for (const example of examples.get(field) ?? [])
			console.log(`      ${example}`);
	}
	if (unmatched > 0)
		console.log(`    ${unmatched} files on disk are not in index.csv`);
	if (byPath.size > 0)
		console.log(`    ${byPath.size} rows in index.csv are not on disk`);
	if (copies > 0)
		console.log(
			`    ${copies} rows name a different copy as dup_of: which of two identical files the pipeline walked first, not a rule`,
		);
	const failures =
		differences.reduce((sum, [, count]) => sum + count, 0) +
		unmatched +
		byPath.size;
	console.log(
		failures === 0
			? "  no differences"
			: `  ${failures} differences in the rules`,
	);
	return { failures, rows };
}

/** The text: what the Studio reads of 30 files, against the pipeline's own text. */
async function checkText(
	materials: string,
	work: string,
	rows: readonly FileRow[],
): Promise<void> {
	const withText = rows.filter(
		(row) =>
			row.dupOf === "" &&
			row.error === "" &&
			(row.pages ?? 0) > 0 &&
			existsSync(join(work, "text", `${row.id}.md`)),
	);
	// Every kind of file at least once (PDF, Word, PowerPoint), then a spread of the rest, so
	// the 30 are not one grade's folder read from beginning to end.
	const chosen: FileRow[] = [];
	for (const ext of ["pdf", "docx", "pptx"]) {
		const row = withText.find((entry) => extOf(entry.path) === ext);
		if (row !== undefined) chosen.push(row);
	}
	const step = Math.max(1, Math.floor(withText.length / TEXT_FILES));
	for (
		let i = 0;
		i < withText.length && chosen.length < TEXT_FILES;
		i += step
	) {
		const row = withText[i];
		if (row !== undefined && !chosen.includes(row)) chosen.push(row);
	}
	for (const row of withText) {
		if (chosen.length >= TEXT_FILES) break;
		if (!chosen.includes(row)) chosen.push(row);
	}
	let wordsAll = 0;
	let wordsSame = 0;
	let pages = 0;
	let pictures = 0;
	const worst: { id: string; share: number }[] = [];
	for (const row of chosen) {
		const path = join(materials, ...row.path.split("/"));
		let ours: string[] = [];
		try {
			const read = await readTextFile(path, new Uint8Array(readFileSync(path)));
			ours = read.pages;
			if (read.error !== "") {
				console.log(
					`  ${row.id} ${row.path}: could not be read (${read.error})`,
				);
				continue;
			}
		} catch (error) {
			console.log(
				`  ${row.id} ${row.path}: could not be read (${String(error)})`,
			);
			continue;
		}
		const theirs = readFileSync(join(work, "text", `${row.id}.md`), "utf8");
		const got = textShare(theirs, ours);
		wordsAll += got.words;
		wordsSame += got.share * got.words;
		pages += got.pages;
		pictures += got.pictures;
		worst.push({ id: row.path, share: got.share });
	}
	worst.sort((a, b) => a.share - b.share);
	console.log(
		`  ${chosen.length} files, ${pages} pages compared, ${pictures} pages read from pictures (the OCR check's), ${((wordsSame / Math.max(1, wordsAll)) * 100).toFixed(1)}% of the work folder's words found`,
	);
	for (const entry of worst.slice(0, 5))
		console.log(`    ${(entry.share * 100).toFixed(1)}%  ${entry.id}`);
}

/** OCR: the Studio's Tesseract against the pipeline's readings of the same pictures. */
async function checkOcr(
	work: string,
	rows: readonly FileRow[],
	_subjects: readonly { id: string }[],
): Promise<void> {
	const byId = new Map(rows.map((row) => [row.id, row]));
	const pages: { id: string; png: string; text: string }[] = [];
	const folder = join(work, "pages");
	let names: string[] = [];
	try {
		names = readdirSync(folder);
	} catch {
		console.log("  no pages folder: nothing to compare");
		return;
	}
	for (const id of names.sort()) {
		if (pages.length >= OCR_PAGES) break;
		const inside = join(folder, id);
		let files: string[] = [];
		try {
			files = readdirSync(inside);
		} catch {
			continue;
		}
		for (const name of files.sort()) {
			if (!name.endsWith(".png")) continue;
			const read = join(inside, name.replace(/\.png$/, ".ocr.txt"));
			if (!existsSync(read)) continue;
			pages.push({
				id,
				png: join(inside, name),
				text: readFileSync(read, "utf8"),
			});
			break;
		}
	}
	if (pages.length === 0) {
		console.log("  no page has an .ocr.txt: nothing to compare");
		return;
	}
	const missing = ["ara", "eng", "fra"].filter(
		(lang) => !existsSync(join(tessdataDir(STUDIO), `${lang}.traineddata`)),
	);
	if (missing.length > 0) {
		console.log(
			`  the language files ${missing.join(", ")} are not in ${tessdataDir(STUDIO)}: run npm run tessdata`,
		);
		return;
	}
	const engine = ocrEngine(STUDIO);
	let all = 0;
	let same = 0;
	try {
		for (const page of pages) {
			const row = byId.get(page.id);
			const langs = tessLangsFor(legacySubject(row?.subject ?? "").language);
			const text = await engine.text(
				new Uint8Array(readFileSync(page.png)),
				langs,
			);
			const got = share(words(text), words(withoutMarkers(page.text)));
			const count = [...words(withoutMarkers(page.text)).values()].reduce(
				(sum, n) => sum + n,
				0,
			);
			all += count;
			same += got * count;
			console.log(
				`    ${(got * 100).toFixed(1)}%  ${page.id}/${basename(page.png)} (${row?.subject ?? "unknown"}, ${langs})`,
			);
		}
	} finally {
		await engine.close();
	}
	console.log(
		`  ${pages.length} pages with ${ocrPoolSize()} workers, ${((same / Math.max(1, all)) * 100).toFixed(1)}% of the pipeline's words found`,
	);
}

async function main(): Promise<void> {
	const [materials, work] = process.argv.slice(2);
	if (materials === undefined || work === undefined) {
		console.error(
			"usage: npm run material-check -- <materials folder> <work folder>",
		);
		process.exitCode = 2;
		return;
	}
	const curriculum = basename(materials);
	const index = readIndex(readFileSync(join(work, "index.csv"), "utf8"));
	const oldRows = registerRows(index, curriculum);
	const subjects = JSON.parse(
		subjectsJson(readFileSync(SUBJECTS_FILE, "utf8")),
	) as {
		id: string;
	}[];

	console.log(`The register (${materials} against ${join(work, "index.csv")})`);
	const register = await checkRegister(materials, work, oldRows);

	console.log("\nThe text");
	await checkText(materials, work, register.rows);

	console.log("\nOCR");
	await checkOcr(work, register.rows, subjects);

	console.log(
		"\nNo private file was written, and nothing in the material folder was changed.",
	);
	if (register.failures > 0) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("material-check.ts") === true) await main();
