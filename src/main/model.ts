// The Studio's memory on disk (task 153): `.studio/model/` (the curriculum the project
// holds, one JSON file per course), `.studio/files.json` (the register rows adoption copied)
// and `.studio/text/<id>.md` (each file's text, page by page, copied from the work folder).
// Every path is built from the project root here, never from the page, and nothing in the
// work or curriculum folders is ever written.

import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

import type { Failure, FileFields } from "../shared/api";
import {
	type CurriculumModel,
	courseFile,
	EXPORTS_DIR,
	exportCopy,
	FILE_FIELDS,
	FILES_FILE,
	type FileField,
	type FileRow,
	MODEL_DIR,
	MODEL_FILE,
	modelFileText,
	PENDING_FILE,
	pageText,
	parseModelText,
	REPORT_FILE,
	TEXT_DIR,
} from "../shared/model";
import { AUTHORITIES, KINDS, type NewMaterial } from "../shared/register";

const failure = (code: Failure["code"], detail?: string): Failure => ({
	ok: false,
	code,
	...(detail === undefined ? {} : { detail }),
});

/** Writes the model: the header, then one file per course, replacing any earlier model. */
export function writeModel(
	root: string,
	model: CurriculumModel,
): Failure | { ok: true } {
	try {
		const dir = join(root, MODEL_DIR);
		mkdirSync(dir, { recursive: true });
		// A course the curriculum no longer has must not linger and be exported again.
		for (const name of readdirSync(dir)) {
			if (name.endsWith(".json") && name !== MODEL_FILE)
				rmSync(join(dir, name), { force: true });
		}
		writeFileSync(
			join(dir, MODEL_FILE),
			modelFileText(model.curriculum),
			"utf8",
		);
		for (const course of model.courses) {
			writeFileSync(
				join(dir, courseFile(course.grade, course.subject)),
				modelFileText(course),
				"utf8",
			);
		}
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}

/** Reads the model back; a project the wizard made has none. */
export function readModel(
	root: string,
): { ok: true; model: CurriculumModel } | Failure {
	const dir = join(root, MODEL_DIR);
	const headerFile = join(dir, MODEL_FILE);
	if (!existsSync(headerFile))
		return failure("missing", "this project has no curriculum model yet");
	let headerText: string;
	const courses: { name: string; text: string }[] = [];
	try {
		headerText = readFileSync(headerFile, "utf8");
		for (const name of readdirSync(dir).sort()) {
			if (!name.endsWith(".json") || name === MODEL_FILE) continue;
			courses.push({ name, text: readFileSync(join(dir, name), "utf8") });
		}
	} catch {
		return failure("unreadable");
	}
	const parsed = parseModelText(headerText, courses);
	if (!parsed.ok)
		return failure(
			"invalidProject",
			`${parsed.issues[0]?.path ?? "model"}: ${parsed.issues[0]?.message ?? "invalid"}`,
		);
	return { ok: true, model: parsed.model };
}

/** Writes the register rows adoption keeps, so a fact can name the file it came from. */
export function writeFiles(
	root: string,
	files: readonly FileRow[],
): Failure | { ok: true } {
	try {
		mkdirSync(join(root, ".studio"), { recursive: true });
		writeFileSync(join(root, FILES_FILE), modelFileText(files), "utf8");
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}

/** The register rows, or an empty list when the project has none. */
export function readFiles(
	root: string,
): { ok: true; files: FileRow[] } | Failure {
	const file = join(root, FILES_FILE);
	if (!existsSync(file)) return { ok: true, files: [] };
	let value: unknown;
	try {
		value = JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return failure("unreadable");
	}
	if (!Array.isArray(value)) return failure("unreadable");
	const files: FileRow[] = [];
	for (const item of value) {
		if (typeof item !== "object" || item === null) return failure("unreadable");
		const row = item as Record<string, unknown>;
		if (typeof row.id !== "string" || typeof row.path !== "string")
			return failure("unreadable");
		files.push({
			id: row.id,
			path: row.path,
			grade: typeof row.grade === "number" ? row.grade : null,
			subject: typeof row.subject === "string" ? row.subject : "",
			block: typeof row.block === "string" ? row.block : "",
			kind: typeof row.kind === "string" ? row.kind : "",
			pages: typeof row.pages === "number" ? row.pages : null,
			authority: typeof row.authority === "number" ? row.authority : null,
			year: row.year === "current" ? "current" : "old",
			academicYear:
				typeof row.academicYear === "string" ? row.academicYear : "",
			published: typeof row.published === "string" ? row.published : "",
			publishedFrom:
				typeof row.publishedFrom === "string" ? row.publishedFrom : "",
			dupOf: typeof row.dupOf === "string" ? row.dupOf : "",
			imagePages: typeof row.imagePages === "number" ? row.imagePages : 0,
			error: typeof row.error === "string" ? row.error : "",
			firstSeen: typeof row.firstSeen === "string" ? row.firstSeen : "",
			size: typeof row.size === "number" ? row.size : 0,
			mtime: typeof row.mtime === "string" ? row.mtime : "",
			metaDate: typeof row.metaDate === "string" ? row.metaDate : "",
			fixed: Array.isArray(row.fixed)
				? row.fixed.filter(
						(field): field is FileField =>
							typeof field === "string" &&
							(FILE_FIELDS as readonly string[]).includes(field),
					)
				: [],
		});
	}
	return { ok: true, files };
}

/** The page count of one file's text, or 0 when the project has none. */
export function readPageCount(root: string, id: string): number {
	if (!/^[0-9a-f]{12}$/.test(id)) return 0;
	try {
		const text = readFileSync(join(root, TEXT_DIR, `${id}.md`), "utf8");
		let last = 0;
		for (const match of text.matchAll(/^## Page (\d{1,4})\s*$/gm)) {
			const page = Number(match[1]);
			if (Number.isInteger(page) && page > last) last = page;
		}
		return last;
	} catch {
		return 0;
	}
}

/** The text of one file's page, kept from the work folder; "" when that page has none. */
export function readPageText(root: string, id: string, page: number): string {
	if (!/^[0-9a-f]{12}$/.test(id)) return "";
	const file = join(root, TEXT_DIR, `${id}.md`);
	try {
		return pageText(readFileSync(file, "utf8"), page);
	} catch {
		return "";
	}
}

/** Copies each file's text from the work folder into .studio/text, once per id. */
export function copyTexts(
	root: string,
	work: string,
	ids: readonly string[],
): Failure | { ok: true; copied: number } {
	try {
		const target = join(root, TEXT_DIR);
		mkdirSync(target, { recursive: true });
		let copied = 0;
		for (const id of new Set(ids)) {
			if (!/^[0-9a-f]{12}$/.test(id)) continue;
			const from = join(work, "text", `${id}.md`);
			if (!existsSync(from)) continue;
			copyFileSync(from, join(target, `${id}.md`));
			copied += 1;
		}
		return { ok: true, copied };
	} catch {
		return failure("unreadable");
	}
}

/** The exported versions already kept in .studio/exports, oldest first. */
export function exportNames(root: string): string[] {
	try {
		return readdirSync(join(root, EXPORTS_DIR)).sort();
	} catch {
		return [];
	}
}

/** Keeps a copy of an exported bundle, so versions can be compared later. */
export function writeExportCopy(
	root: string,
	version: number,
	text: string,
): Failure | { ok: true } {
	try {
		const dir = join(root, EXPORTS_DIR);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, exportCopy(version)), text, "utf8");
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}

/** A file's text as a scan wrote it into .studio/text, or "" when it has none. */
export function readTextFile(root: string, id: string): string {
	if (!/^[0-9a-f]{12}$/.test(id)) return "";
	try {
		return readFileSync(join(root, TEXT_DIR, `${id}.md`), "utf8");
	} catch {
		return "";
	}
}

/** Writes one file's text, page by page, into .studio/text, replacing what was there. */
export function writeTextFile(
	root: string,
	id: string,
	text: string,
): Failure | { ok: true } {
	if (!/^[0-9a-f]{12}$/.test(id)) return failure("unreadable");
	try {
		mkdirSync(join(root, TEXT_DIR), { recursive: true });
		writeFileSync(join(root, TEXT_DIR, `${id}.md`), text, "utf8");
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}

/** The last scan's report, or null when the project has never been scanned. */
export function readReport(root: string): NewMaterial | null {
	try {
		const value: unknown = JSON.parse(
			readFileSync(join(root, REPORT_FILE), "utf8"),
		);
		if (typeof value !== "object" || value === null) return null;
		const report = value as NewMaterial;
		if (typeof report.at !== "string" || !Array.isArray(report.groups))
			return null;
		return report;
	} catch {
		return null;
	}
}

/** Keeps the last scan's report, which the "New material" panel shows until the next scan. */
export function writeReport(
	root: string,
	report: NewMaterial,
): Failure | { ok: true } {
	try {
		mkdirSync(join(root, ".studio"), { recursive: true });
		writeFileSync(join(root, REPORT_FILE), modelFileText(report), "utf8");
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}

/** One file whose picture pages a stopped scan still has to draw and read. */
export type PendingFile = { id: string; pages: number[] };

/** The pages a stopped scan still owes, or an empty list when the last scan finished. */
export function readPending(root: string): PendingFile[] {
	try {
		const value: unknown = JSON.parse(
			readFileSync(join(root, PENDING_FILE), "utf8"),
		);
		if (!Array.isArray(value)) return [];
		return value.flatMap((item) => {
			if (typeof item !== "object" || item === null) return [];
			const entry = item as Record<string, unknown>;
			if (typeof entry.id !== "string" || !Array.isArray(entry.pages))
				return [];
			const pages = entry.pages.filter(
				(page): page is number =>
					typeof page === "number" && Number.isInteger(page),
			);
			return pages.length === 0 ? [] : [{ id: entry.id, pages }];
		});
	} catch {
		return [];
	}
}

/** Remembers the pages a stopped scan still owes, so the next scan continues there. */
export function writePending(
	root: string,
	pending: readonly PendingFile[],
): Failure | { ok: true } {
	try {
		mkdirSync(join(root, ".studio"), { recursive: true });
		writeFileSync(join(root, PENDING_FILE), modelFileText(pending), "utf8");
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}

/**
 * The author's corrections on one row (task 156): the five fields they may change, recorded so
 * a later scan keeps them. A value the form can't have sent is refused rather than written.
 */
export function setFileFields(
	root: string,
	id: string,
	fields: FileFields,
): Failure | { ok: true } {
	const files = readFiles(root);
	if (!files.ok) return files;
	const row = files.files.find((entry) => entry.id === id);
	if (row === undefined) return failure("missing");
	if (
		fields.grade !== null &&
		(!Number.isInteger(fields.grade) || fields.grade < 0 || fields.grade > 12)
	)
		return failure("invalidName");
	if (typeof fields.subject !== "string" || fields.subject.trim().length > 60)
		return failure("invalidName");
	if (typeof fields.block !== "string" || fields.block.trim().length > 20)
		return failure("invalidName");
	if (
		!(FILE_FIELDS as readonly string[]).includes("kind") ||
		typeof fields.kind !== "string"
	)
		return failure("invalidName");
	if (!KINDS.includes(fields.kind as (typeof KINDS)[number]))
		return failure("invalidName");
	if (
		fields.authority !== null &&
		!(AUTHORITIES as readonly number[]).includes(fields.authority)
	)
		return failure("invalidName");
	row.grade = fields.grade;
	row.subject = fields.subject.trim();
	row.block = fields.block.trim();
	row.kind = fields.kind;
	row.authority = fields.authority;
	row.fixed = [...new Set([...row.fixed, ...FILE_FIELDS])];
	return writeFiles(root, files.files);
}
