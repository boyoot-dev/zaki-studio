// The source register's rules, ported from tools/materials/register.py and extract.py (task
// 156): what the Studio records about each file, how it guesses a file's grade, subject, block
// and kind, when a file counts as new, and what the "New material" panel says. Pure: the
// walking, hashing and reading are in src/main/collect.ts, and this file only decides.
//
// The rules answer the same questions the Python does, in the same order, so the two give the
// same register on the owner's material (scripts/material-check.ts compares them). Nothing here
// imports the app or Electron, so the check script can run it with plain Node.

import { rowCourse, tokenCourse } from "./convert.ts";
import { LANGUAGE_CODES } from "./format/bundle.ts";
import type { FileField, FileRow } from "./model.ts";

/** One row of a work folder's index.csv, as the file writes it (every value a text). */
export type IndexRow = {
	id: string;
	path: string;
	grade: string;
	year: string;
	academicYear: string;
	subject: string;
	block: string;
	kind: string;
	dup: string;
	pages: string;
	imagePages: string;
	error: string;
	curriculum: string;
	published: string;
	publishedFrom: string;
	authority: string;
	firstSeen: string;
	size: string;
	mtime: string;
	metaDate: string;
};

/** A rule of a curriculum's _sources.csv: which paths it matches, and their authority. */
export type AuthorityRule = { pattern: RegExp; authority: number };

/** The files the register knows by kind, in the order the names are tried. */
export const KINDS = [
	"mark-scheme",
	"exam",
	"revision",
	"homework",
	"worksheet",
	"sheet",
	"book",
	"other",
] as const;
export type Kind = (typeof KINDS)[number];

/** The authority levels docs/materials/README.md names. */
export const AUTHORITIES = [1, 2, 3, 4] as const;

/** Every date before this is an unset clock in a file's metadata, not a real date. */
const OLDEST = "2000-01-01";

/**
 * A word's edge, the way Python's `\b` sees one: Arabic and every other letter count as part of
 * a word, where JavaScript's own `\b` would treat them as a break (found 2026-11-13: "مرجعه
 * b3الثقافه" was read as block 3). The patterns below are built with these, so the Studio's
 * guesses match register.py's on Arabic names too.
 */
const WORD_START = String.raw`(?<![\p{L}\p{N}_])`;
const WORD_END = String.raw`(?![\p{L}\p{N}_])`;

/** Subject folders as the school names them, mapped to the app's subject ids. */
const SUBJECTS: [string, RegExp][] = [
	["social-studies", /social|socail|studies/],
	["arabic", /arabic|عربي/],
	["religion", /religion|islamic|دين|إسلامية/],
	["english", /english/],
	["french", /french|frensh|français/],
	["ict", new RegExp(`${WORD_START}ict${WORD_END}|computer`, "iu")],
	["math", /math/],
	["biology", new RegExp(`biology|${WORD_START}bio${WORD_END}`, "iu")],
	["chemistry", new RegExp(`chemistry|${WORD_START}chem${WORD_END}`, "iu")],
	["physics", /physics/],
	["science", /science/],
];

/** The names a kind of file goes by, in the order extract.py tries them. */
const KIND_NAMES: [Kind, RegExp][] = [
	[
		"mark-scheme",
		new RegExp(
			`${WORD_START}ms${WORD_END}|mark ?scheme|answer|key|model answer|اجابة|إجابة`,
			"iu",
		),
	],
	[
		"exam",
		/exam|paper|test|quiz|mock|specimen|final|midterm|assessment|امتحان|اختبار/,
	],
	["revision", /revision|review|مراجعة/],
	["homework", new RegExp(`homework|${WORD_START}hw${WORD_END}|واجب`, "iu")],
	["worksheet", /worksheet|work sheet|classwork|practice|extra|activity/],
	["sheet", /sheet|main|study|lesson|unit|مذكرة/],
	// Ministry textbooks come in parts; after "sheet", so a KESTREL sheet named "Part 1" stays a sheet.
	[
		"book",
		new RegExp(
			String.raw`${WORD_START}part\s*-?\d|${WORD_START}part\d|textbook|${WORD_START}book${WORD_END}`,
			"iu",
		),
	],
];

/** The block a path names ("Block 1", "B2", "-B3-"), as "1", "1&2" or "". */
const BLOCK = new RegExp(
	String.raw`block\s*_?(\d(?:\s*&\s*\d)?)|${WORD_START}B(\d)${WORD_END}|-B(\d)-`,
	"iu",
);

/** Splits CSV text into rows of fields; quotes may hold commas, line breaks and doubled quotes. */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i] ?? "";
		if (quoted) {
			if (ch !== '"') {
				field += ch;
			} else if (text[i + 1] === '"') {
				field += '"';
				i += 1;
			} else {
				quoted = false;
			}
			continue;
		}
		if (ch === '"') quoted = true;
		else if (ch === ",") {
			row.push(field);
			field = "";
		} else if (ch === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else if (ch !== "\r") field += ch;
	}
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((entry) => !(entry.length === 1 && entry[0] === ""));
}

/** CSV text as rows of named fields, by the header's first line. */
export function csvFields(text: string): Record<string, string>[] {
	const rows = parseCsv(text);
	const header = rows[0] ?? [];
	return rows.slice(1).map((row) => {
		const value: Record<string, string> = {};
		for (const [i, key] of header.entries()) {
			value[key.trim()] = (row[i] ?? "").trim();
		}
		return value;
	});
}

/** The work folder's index.csv, one row per file, or an empty list for a damaged header. */
export function readIndex(text: string): IndexRow[] {
	return csvFields(text)
		.filter((field) => (field.id ?? "") !== "")
		.map((field) => ({
			id: field.id ?? "",
			path: field.path ?? "",
			grade: field.grade ?? "",
			year: field.year ?? "",
			academicYear: field.academic_year ?? "",
			subject: field.subject ?? "",
			block: field.block ?? "",
			kind: field.kind ?? "",
			dup: field.dup_of ?? "",
			pages: field.pages ?? "",
			imagePages: field.image_pages ?? "",
			error: field.error ?? "",
			curriculum: field.curriculum ?? "",
			published: field.published ?? "",
			publishedFrom: field.published_from ?? "",
			authority: field.authority ?? "",
			firstSeen: field.first_seen ?? "",
			size: field.size ?? "",
			mtime: field.mtime ?? "",
			metaDate: field.meta_date ?? "",
		}));
}

/** The material folder's _subjects.csv: a folder's name, and the subject it stands for. */
export function readSubjectFolders(
	text: string,
): { folder: string; subject: string }[] {
	return csvFields(text)
		.filter(
			(field) => (field.folder ?? "") !== "" && (field.subject ?? "") !== "",
		)
		.map((field) => ({
			folder: field.folder ?? "",
			subject: field.subject ?? "",
		}));
}

/** A number from a CSV field, or null when the field is empty or not a number. */
export function numberOrNull(value: string): number | null {
	if (value.trim() === "") return null;
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

/** A whole number at least 0, or 0 for anything else: a count the register read. */
function countOf(value: string | number | null | undefined): number {
	const number =
		typeof value === "number" ? value : value === undefined ? 0 : Number(value);
	return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

/**
 * The register rows of one curriculum from a work folder's index.csv, with their paths inside
 * the project folder and every field adoption now keeps (task 156). A row written before the
 * register had these fields gives them up empty, and the next scan fills them.
 */
export function registerRows(
	rows: readonly IndexRow[],
	curriculumId: string,
): FileRow[] {
	return rows
		.filter((row) => row.curriculum === curriculumId && row.id !== "")
		.map((row) => ({
			id: row.id,
			path: row.path.startsWith(`${curriculumId}/`)
				? row.path.slice(curriculumId.length + 1)
				: row.path,
			grade: numberOrNull(row.grade),
			// The work folder's ids are the old ones (`chemistry-ar`): read as subject + language.
			...rowCourse(row.subject, undefined),
			block: row.block,
			kind: row.kind,
			pages: numberOrNull(row.pages),
			authority: numberOrNull(row.authority),
			year: row.year === "current" ? "current" : "old",
			academicYear: row.academicYear,
			published: row.published,
			publishedFrom: row.publishedFrom,
			dupOf: row.dup,
			imagePages: countOf(row.imagePages),
			error: row.error,
			firstSeen: row.firstSeen,
			size: countOf(row.size),
			mtime: row.mtime,
			metaDate: row.metaDate,
			fixed: [],
		}));
}

/** A top-level folder is a curriculum when its name is an id like kestrel or amber-harbor. */
export function curriculumOk(name: string): boolean {
	return /^[a-z0-9][a-z0-9-]*$/.test(name);
}

/** "Grade 3" as 3, "KG" as 0 (the app's KG2), anything else as null. */
export function gradeOf(folder: string): number | null {
	const low = folder.trim().toLowerCase();
	const grade = /^grade\s*_?(\d{1,2})$/.exec(low);
	if (grade !== null) {
		const number = Number(grade[1]);
		return number >= 1 && number <= 12 ? number : null;
	}
	if (/^kg\s*\d?$/.test(low)) return 0;
	return null;
}

/** The first folder named like 2026-2027, 2026-27 or 2026_2027, as "2026-27". */
export function academicYearOf(parts: readonly string[]): string {
	for (const part of parts) {
		const match = /^(20\d\d)\s*[-_]\s*(20\d\d|\d\d)$/.exec(part.trim());
		if (match === null) continue;
		const start = Number(match[1]);
		const end = Number(match[2]) % 100;
		if (end === (start + 1) % 100)
			return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
	}
	return "";
}

/** School years start on 1 September, as "2026-27". */
export function currentAcademicYear(today: Date): string {
	const start =
		today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
	return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** A real calendar date as "YYYY-MM-DD", or null for a day that doesn't exist (31 February). */
function isoDate(year: number, month: number, day: number): string | null {
	if (month < 1 || month > 12 || day < 1) return null;
	const date = new Date(Date.UTC(year, month - 1, day));
	if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
		return null;
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

/** A date written in a file name: 2025-09-14, or day first as schools write it (14-9-2025). */
export function dateFromName(name: string): string | null {
	const first = /(?<!\d)(20\d\d)-(\d{1,2})-(\d{1,2})(?!\d)/.exec(name);
	if (first !== null)
		return isoDate(Number(first[1]), Number(first[2]), Number(first[3]));
	const dayFirst = /(?<!\d)(\d{1,2})[-_.](\d{1,2})[-_.](20\d\d)(?!\d)/.exec(
		name,
	);
	if (dayFirst !== null)
		return isoDate(
			Number(dayFirst[3]),
			Number(dayFirst[2]),
			Number(dayFirst[1]),
		);
	return null;
}

/** PDF metadata dates look like D:20250914103000+02'00'. */
export function parsePdfDate(text: string): string | null {
	const match = /^(?:D:)?(\d{4})(\d{2})(\d{2})/.exec(text ?? "");
	if (match === null) return null;
	return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** Office metadata dates look like 2025-09-14T10:30:00Z. */
export function parseIsoDate(text: string): string | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((text ?? "").trim());
	if (match === null) return null;
	return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** A date as "YYYY-MM-DD" in the computer's own day, for years no earlier than 2000. */
function todayIso(today: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

/**
 * When a file was published, and where the date came from: the file name first, then its
 * metadata, then its year folder (1 September). A date before 2000 or after today is an unset
 * clock, not a date.
 */
export function publishedDate(
	name: string,
	metaDate: string,
	academicYear: string,
	today: Date,
): { date: string; from: string } {
	const day = todayIso(today);
	const ok = (date: string | null): boolean =>
		date !== null && date >= OLDEST && date <= day;
	const named = dateFromName(name);
	if (ok(named)) return { date: named as string, from: "name" };
	const meta = parseIsoDate(metaDate);
	if (ok(meta)) return { date: meta as string, from: "meta" };
	if (academicYear !== "") {
		const start = Number(academicYear.slice(0, 4));
		const folder = isoDate(start, 9, 1);
		if (ok(folder)) return { date: folder as string, from: "folder" };
	}
	return { date: "", from: "" };
}

/**
 * A curriculum's _sources.csv as rules: pattern,authority rows, the first match winning. A
 * pattern the computer can't read stops with a message naming what is wrong, as the Python does.
 */
export function loadRules(text: string): AuthorityRule[] {
	const rules: AuthorityRule[] = [];
	for (const [i, field] of csvFields(text).entries()) {
		const authority = Number((field.authority ?? "").trim());
		if (!Number.isInteger(authority) || authority < 1 || authority > 4)
			throw new Error(`_sources.csv row ${i + 2}: authority must be 1-4`);
		const pattern = (field.pattern ?? "").trim();
		if (pattern === "") continue;
		rules.push({ pattern: new RegExp(pattern, "i"), authority });
	}
	return rules;
}

/** A curriculum's _subjects.csv as folder name (lowercased) → subject id. */
export function loadSubjects(text: string): Record<string, string> {
	const folders: Record<string, string> = {};
	for (const field of csvFields(text)) {
		const folder = (field.folder ?? "").trim().toLowerCase();
		const subject = (field.subject ?? "").trim();
		if (folder !== "" && subject !== "") folders[folder] = subject;
	}
	return folders;
}

/**
 * The file or deepest folder named in _subjects.csv, or "" when none is. A name may also be a
 * file's own name: the ministry folders hold the Arabic, English and French editions side by
 * side.
 */
export function subjectFromFolders(
	parts: readonly string[],
	folders: Record<string, string>,
): string {
	for (const part of [...parts].reverse()) {
		const subject = folders[part.trim().toLowerCase()];
		if (subject !== undefined && subject !== "") return subject;
	}
	return "";
}

/** The deepest folder that names a subject ("Extra Sheets/Biology/x.pdf" is biology). */
export function subjectOf(parts: readonly string[]): string {
	for (const part of [...parts].reverse()) {
		const low = part.toLowerCase();
		for (const [subject, pattern] of SUBJECTS) {
			if (pattern.test(low)) return subject;
		}
	}
	return "unknown";
}

/** The kind a file's name suggests, or "other". */
export function kindOf(name: string): string {
	const low = name.toLowerCase();
	for (const [kind, pattern] of KIND_NAMES) {
		if (pattern.test(low)) return kind;
	}
	return "other";
}

/** The block a path names ("Block 1", "B2", "-B3-"), as "1", "1&2" or "". */
export function blockOf(path: string): string {
	const match = BLOCK.exec(path);
	if (match === null) return "";
	const found = match[1] ?? match[2] ?? match[3] ?? "";
	return found.replace(/\s/g, "");
}

/** 1 official, 2 school sheets and mark schemes, 3 summaries and revision, 4 third-party. */
export function authorityOf(
	kind: string,
	relPath: string,
	rules: readonly AuthorityRule[],
): number {
	for (const rule of rules) {
		if (rule.pattern.test(relPath)) return rule.authority;
	}
	return kind === "revision" ? 3 : 2;
}

/** What reading one file gave, or what the register already knew about it. */
export type ReadGive = {
	/** The pages' text, in order. */
	pages: string[];
	/** The pages that are pictures, by their number from 1. */
	images: number[];
	/** The date the file's own metadata gives, as "YYYY-MM-DD", or "". */
	metaDate: string;
	/** Why the file couldn't be read, or "". */
	error: string;
};

/** What the register keeps about a read: how many pages, how many of them pictures, and why. */
export type ReadCounts = {
	pages: number;
	images: number;
	metaDate: string;
	error: string;
};

/** Everything a row is made from, gathered by the scan. */
export type RowInput = {
	/** The path inside the project, with "/" between parts. */
	rel: string;
	/** The project folder's own name, which is the curriculum's id. */
	curriculum: string;
	/** The file's bytes, which are its id's first twelve hex digits. */
	id: string;
	/** The first path with the same content, when this file is a byte-identical copy. */
	dupOf: string;
	size: number;
	/** Nanoseconds since the epoch as text, as the work folder's index.csv writes it. */
	mtime: string;
	/** What reading the file gave, or what the work folder's index says about it. */
	read: ReadCounts;
	/** The day this content was first seen, or "" for today. */
	firstSeen: string;
	folders: Record<string, string>;
	rules: readonly AuthorityRule[];
	today: Date;
	currentYear: string;
	/** The fields the author corrected, and their values; a scan keeps them. */
	fixed: Partial<Record<FileField, number | string | null>>;
};

/**
 * One register row, by the same rules extract.py uses: the grade from the first folder, the
 * academic year from the folders, the subject from _subjects.csv and then the folder names, the
 * kind from the name, the block from the path, and the publish date from the name, the metadata
 * or the year folder. A field the author corrected keeps their value.
 */
export function fileRow(input: RowInput): FileRow {
	const parts = input.rel.split("/").filter((part) => part !== "");
	const inside = parts.join("/");
	const name = parts[parts.length - 1] ?? input.rel;
	const gradeFolder = parts[0] ?? "";
	const academicYear = academicYearOf(parts.slice(0, -1));
	const kind = kindOf(inside);
	const read = input.read;
	const row: FileRow = {
		id: input.id,
		path: input.rel,
		grade:
			parts.length > 1 && gradeFolder !== undefined
				? gradeOf(gradeFolder)
				: null,
		...tokenCourse(
			subjectFromFolders(parts.slice(1), input.folders) ||
				subjectOf(parts.slice(1)),
		),
		block: blockOf(inside),
		kind,
		pages: read.pages,
		authority: authorityOf(kind, inside, input.rules),
		year: academicYear === input.currentYear ? "current" : "old",
		academicYear,
		published: "",
		publishedFrom: "",
		dupOf: input.dupOf,
		imagePages: read.images,
		error: read.error,
		firstSeen: input.firstSeen === "" ? todayIso(input.today) : input.firstSeen,
		size: input.size,
		mtime: input.mtime,
		metaDate: read.metaDate,
		fixed: Object.keys(input.fixed).sort() as FileField[],
	};
	applyFixed(row, input.fixed);
	// extract.py names a folder it can't place on the row, and a broken file keeps both reasons.
	if (row.grade === null && !row.error.includes("unknown grade folder"))
		row.error = ["unknown grade folder", row.error]
			.filter((e) => e !== "")
			.join("; ");
	const date = publishedDate(name, row.metaDate, academicYear, input.today);
	row.published = date.date;
	row.publishedFrom = date.from;
	return row;
}

/** Puts the author's corrections on a row, and leaves everything else as the rules found it. */
function applyFixed(
	row: FileRow,
	fixed: Partial<Record<FileField, number | string | null>>,
): void {
	if (fixed.grade !== undefined)
		row.grade = typeof fixed.grade === "number" ? fixed.grade : null;
	if (typeof fixed.subject === "string") {
		// A corrected subject may name its language too (`chemistry-ar`).
		const course = tokenCourse(fixed.subject);
		row.subject = course.subject;
		if (course.language !== "") row.language = course.language;
	}
	// An explicit language follows the subject, so it beats one read from a token (task 228).
	if (
		typeof fixed.language === "string" &&
		LANGUAGE_CODES.includes(fixed.language)
	)
		row.language = fixed.language;
	if (typeof fixed.block === "string") row.block = fixed.block;
	if (typeof fixed.kind === "string") row.kind = fixed.kind;
	if (typeof fixed.authority === "number") row.authority = fixed.authority;
}

/** What changed between two scans: new content, copies, moves and removed files. */
export type Changes = {
	new: FileRow[];
	copies: FileRow[];
	moved: FileRow[];
	removed: FileRow[];
};

/**
 * A file counts as new when neither its place nor its content was known, as new when the same
 * path holds new content, as moved when its content left another place, and as a copy when the
 * content is already at home. Each place a content left can be matched by one move.
 */
export function compareRows(
	oldRows: readonly FileRow[],
	nextRows: readonly FileRow[],
): Changes {
	const oldIds = new Set(oldRows.map((row) => row.id));
	const oldAt = new Map(oldRows.map((row) => [row.path, row.id]));
	const nextAt = new Map(nextRows.map((row) => [row.path, row.id]));
	const left = new Map<string, number>();
	for (const [path, id] of oldAt) {
		if (nextAt.get(path) === id) continue;
		left.set(id, (left.get(id) ?? 0) + 1);
	}
	const out: Changes = { new: [], copies: [], moved: [], removed: [] };
	for (const row of nextRows) {
		if (oldAt.get(row.path) === row.id) continue;
		if (!oldIds.has(row.id) && row.dupOf === "") {
			out.new.push(row);
			continue;
		}
		const places = left.get(row.id) ?? 0;
		if (places > 0) {
			out.moved.push(row);
			left.set(row.id, places - 1);
		} else {
			out.copies.push(row);
		}
	}
	const nextIds = new Set(nextRows.map((row) => row.id));
	out.removed = oldRows.filter(
		(row) => !nextAt.has(row.path) && !nextIds.has(row.id),
	);
	return out;
}

/** Why a new file needs a person to look at it. */
export type LookReason =
	| { code: "noSubject" }
	| { code: "noGrade" }
	| { code: "error"; detail: string }
	| { code: "copy"; id: string };

/** The reasons this file needs a look, or none. A missing block is not one: blocks are KESTREL's. */
export function lookReasons(row: FileRow): LookReason[] {
	const why: LookReason[] = [];
	if (row.subject === "unknown") why.push({ code: "noSubject" });
	if (row.grade === null) why.push({ code: "noGrade" });
	if (row.error !== "") why.push({ code: "error", detail: row.error });
	if (row.dupOf !== "") why.push({ code: "copy", id: row.dupOf });
	return why;
}

/** One course as the report reads it: its grade, subject and units. */
export type ReportCourse = {
	grade: number;
	subject: string;
	language: string;
	units: {
		number: number;
		period: string;
		title: string;
		source: "sheet" | "provisional";
	}[];
};

/** The block number a period names ("block-3" is 3), or null. */
function periodBlock(period: string): number | null {
	const match = /^block-(\d+)$/.exec(period);
	return match === null ? null : Number(match[1]);
}

/** The block numbers a register block names ("1", "1&2"), as the pipeline reads them. */
function blockNumbers(block: string): number[] {
	return [...block].filter((ch) => /\d/.test(ch)).map(Number);
}

/**
 * What one block of new material says about the curriculum: nothing for its course yet, no unit
 * for its block, or the units that block holds. The panel turns these into words in its own
 * language, so the curriculum's titles stay as the author wrote them.
 */
export type AffectedLine =
	| { code: "noCourse" }
	| { code: "noUnit"; block: number }
	| {
			code: "unit";
			number: number;
			title: string;
			source: "sheet" | "provisional";
			/** True when this year's sheet arrived for a unit that was only predicted. */
			confirm: boolean;
	  };

/** One block's part of the report: which grade, subject and block, and what it touches. */
export type AffectedBlock = {
	grade: number | null;
	subject: string;
	block: string;
	lines: AffectedLine[];
};

/**
 * The units each new file touches: a block's number is its period's number ("block-3"), and a
 * provisional unit of this year's block can be confirmed when this year's sheet arrives.
 */
export function affectedUnits(
	rows: readonly FileRow[],
	courses: readonly ReportCourse[],
	currentYear: string,
): AffectedBlock[] {
	const groups = new Map<
		string,
		{ rows: FileRow[]; grade: number | null; subject: string; block: string }
	>();
	for (const row of rows) {
		if (row.grade === null || row.subject === "unknown" || row.block === "")
			continue;
		const key = `${row.grade}|${row.subject}|${row.block}`;
		const group = groups.get(key) ?? {
			rows: [],
			grade: row.grade,
			subject: row.subject,
			block: row.block,
		};
		group.rows.push(row);
		groups.set(key, group);
	}
	const out: AffectedBlock[] = [];
	const list = [...groups.values()].sort(
		(a, b) =>
			(a.grade ?? -1) - (b.grade ?? -1) ||
			a.subject.localeCompare(b.subject) ||
			a.block.localeCompare(b.block),
	);
	for (const group of list) {
		const course = courses.find(
			(entry) => entry.grade === group.grade && entry.subject === group.subject,
		);
		if (course === undefined) {
			out.push({ ...group, lines: [{ code: "noCourse" }] });
			continue;
		}
		const freshSheet = group.rows.some(
			(row) => row.kind === "sheet" && row.academicYear === currentYear,
		);
		const lines: AffectedLine[] = [];
		for (const number of blockNumbers(group.block)) {
			const mine = course.units.filter(
				(unit) => periodBlock(unit.period) === number,
			);
			if (mine.length === 0) lines.push({ code: "noUnit", block: number });
			for (const unit of mine)
				lines.push({
					code: "unit",
					number: unit.number,
					title: unit.title,
					source: unit.source,
					confirm: unit.source === "provisional" && freshSheet,
				});
		}
		out.push({ ...group, lines });
	}
	return out;
}

/** A file's own name, as the report shows it. */
export function fileName(path: string): string {
	return path.split("/").pop() ?? path;
}

/** One group of the report: the files of one grade, subject and block. */
export type NewGroup = {
	grade: number | null;
	subject: string;
	block: string;
	rows: FileRow[];
};

/** The last scan's report, which the "New material" panel shows until the next scan. */
export type NewMaterial = {
	/** When the scan ran, e.g. "2026-11-13 07:20". */
	at: string;
	/** When the scan before it ran, or "" when there was none. */
	since: string;
	/** How many files the scan looked at, and how many it read. */
	found: number;
	read: number;
	groups: NewGroup[];
	affected: AffectedBlock[];
	look: { row: FileRow; why: LookReason[] }[];
	copies: string[];
	moved: string[];
	removed: string[];
	/** The Tesseract language files that were missing, so some pages are still pictures. */
	tessdataMissing: string[];
};

/** Everything the report is made from. */
export type ReportInput = {
	/** "2026-11-13 07:20", the minute the scan ran. */
	at: string;
	/** The scan before it, or "". */
	since: string;
	found: number;
	read: number;
	changes: Changes;
	courses: readonly ReportCourse[];
	today: Date;
};

/** The report register.py writes, as the data the panel shows instead of a Markdown file. */
export function newMaterial(input: ReportInput): NewMaterial {
	const groups = new Map<string, NewGroup>();
	for (const row of input.changes.new) {
		const key = `${row.grade ?? "?"}|${row.subject}|${row.block}`;
		const group = groups.get(key) ?? {
			grade: row.grade,
			subject: row.subject,
			block: row.block,
			rows: [],
		};
		group.rows.push(row);
		groups.set(key, group);
	}
	const list = [...groups.values()].sort(
		(a, b) =>
			(a.grade ?? -1) - (b.grade ?? -1) ||
			a.subject.localeCompare(b.subject) ||
			a.block.localeCompare(b.block),
	);
	for (const group of list)
		group.rows = [...group.rows].sort((a, b) => a.path.localeCompare(b.path));
	const currentYear = currentAcademicYear(input.today);
	const look = [...input.changes.new, ...input.changes.copies]
		.map((row) => ({ row, why: lookReasons(row) }))
		.filter((entry) => entry.why.length > 0);
	return {
		at: input.at,
		since: input.since,
		found: input.found,
		read: input.read,
		groups: list,
		affected: affectedUnits(input.changes.new, input.courses, currentYear),
		look,
		copies: input.changes.copies.map((row) => row.path),
		moved: input.changes.moved.map((row) => row.path),
		removed: input.changes.removed.map((row) => row.path),
		tessdataMissing: [],
	};
}

/** A course as the OCR needs it: its grade and subject, and the language it is taught in. */
export type LangCourse = { grade: number; subject: string; language: string };

/**
 * The Tesseract languages a file's pages are read with: its course's teaching language plus
 * English, because every subject's pages carry some English (school name, codes). Since task
 * 224 the language is the course's, not the subject's. A file of no known course, or of a
 * language the Studio has no Tesseract data for, is read as English alone.
 */
export function tessLangs(
	grade: number | null,
	subject: string,
	courses: readonly LangCourse[],
): string {
	const found = courses.find(
		(entry) => entry.grade === grade && entry.subject === subject,
	);
	return tessLangsFor(found?.language ?? "en");
}

/** The Tesseract languages for pages in one language, plus English. */
export function tessLangsFor(language: string): string {
	if (language === "ar") return "ara+eng";
	if (language === "fr") return "fra+eng";
	return "eng";
}

/** The courses of a project as the OCR needs them. */
export function langCourses(project: {
	grades: readonly {
		grade: number;
		subjects: readonly { subject: string; language: string }[];
	}[];
}): LangCourse[] {
	return project.grades.flatMap((grade) =>
		grade.subjects.map((entry) => ({
			grade: grade.grade,
			subject: entry.subject,
			language: entry.language,
		})),
	);
}
