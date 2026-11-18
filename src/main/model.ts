// The Studio's memory on disk (task 153): `.studio/model/` (the curriculum the project
// holds, one JSON file per course), `.studio/files.json` (the register rows adoption copied)
// and `.studio/text/<id>.md` (each file's text, page by page, copied from the work folder).
// Every path is built from the project root here, never from the page, and nothing in the
// work or curriculum folders is ever written. The register, the model, the report and the
// stopped-scan's pending pages are read once and kept in memory (task 168): every read
// stats the file first, so a file changed on disk is picked up on the next call, and every
// write goes through this module, which updates the cache in the same breath.

import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import type { Failure, FileFields } from "../shared/api.ts";
import { legacySubject } from "../shared/convert.ts";
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
	withProjectLanguages,
} from "../shared/model.ts";
import { PROJECT_FILE } from "../shared/project.ts";
import { AUTHORITIES, KINDS, type NewMaterial } from "../shared/register.ts";
import { BACKUP_DIR, readProject } from "./files.ts";

/** The model with the project's course languages, when the project can be read (task 225). */
function languagesFromProject(
	root: string,
	model: CurriculumModel,
): CurriculumModel {
	const project = readProject(root);
	return project.ok ? withProjectLanguages(model, project.project) : model;
}

/**
 * What the project keeps, read once and kept in memory until a write or a watcher poke says
 * otherwise (task 168). Every read stats the file first — one or two cheap calls, never a
 * parse — so a file changed on disk behind the Studio's back is picked up on the next read,
 * and a file written through the module below updates the cache in the same breath. The
 * watcher (watch.ts) calls invalidateProject when Explorer touches the folder. A cache entry
 * is keyed by the real path of the project, so no project ever sees another's copy.
 */
type Stat = { mtimeNs: string; size: number } | null;

type Cached<T> = { stat: Stat; value: T };

type ModelEntry = {
	/** One entry per model file, by its own name, or null while the model is absent. */
	snapshot: string | null;
	value: { ok: true; model: CurriculumModel } | Failure;
};

type ProjectCache = {
	files?: Cached<{ ok: true; files: FileRow[] } | Failure>;
	report?: Cached<NewMaterial | null>;
	pending?: Cached<PendingFile[]>;
	model?: ModelEntry;
};

/** The projects the cache keeps; old ones are let go, so a long session never grows it. */
const cache = new Map<string, ProjectCache>();
const CACHE_KEEP = 4;

/** Realpath of the root, following links, for the cache's key; null when it is not there. */
function cacheKey(root: string): string {
	try {
		return realpathSync.native(resolve(root));
	} catch {
		return resolve(root);
	}
}

/** The one project the cache holds, or an empty slot for a project never seen. */
function slot(root: string): ProjectCache {
	const key = cacheKey(root);
	let entry = cache.get(key);
	if (entry !== undefined) {
		// Re-insert, so the projects still in use stay in the cache.
		cache.delete(key);
		cache.set(key, entry);
		return entry;
	}
	if (cache.size >= CACHE_KEEP) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
	entry = {};
	cache.set(key, entry);
	return entry;
}

const failure = (code: Failure["code"], detail?: string): Failure => ({
	ok: false,
	code,
	...(detail === undefined ? {} : { detail }),
});

/** The file's stat, or null when it is not there. */
function statOf(file: string): Stat {
	try {
		const info = statSync(file, { bigint: true });
		return { mtimeNs: info.mtimeNs.toString(), size: Number(info.size) };
	} catch {
		return null;
	}
}

/** The model's own files as one comparable string, or null when the model is absent. */
function modelSnapshot(root: string): string | null {
	const dir = join(root, MODEL_DIR);
	const parts: string[] = [];
	try {
		for (const name of readdirSync(dir)) {
			if (!name.endsWith(".json")) continue;
			const stat = statOf(join(dir, name));
			if (stat === null) continue;
			parts.push(`${name}|${stat.mtimeNs}|${stat.size}`);
		}
	} catch {
		return null;
	}
	// The project file holds the courses' languages, so a change there re-reads the model.
	const project = statOf(join(root, PROJECT_FILE));
	if (project !== null)
		parts.push(`${PROJECT_FILE}|${project.mtimeNs}|${project.size}`);
	return parts.sort().join(";");
}

/** Throws away one project's cache; the watcher calls this when the folder changed. */
export function invalidateProject(root: string): void {
	cache.delete(cacheKey(root));
}

/** True when `stat` still names the file as it was when the entry was made. */
function sameStat(a: Stat, b: Stat): boolean {
	if (a === null || b === null) return a === b;
	return a.mtimeNs === b.mtimeNs && a.size === b.size;
}

/** Writes the model: the header, then one file per course, replacing any earlier model. */
export function writeModel(
	root: string,
	given: CurriculumModel,
): Failure | { ok: true } {
	const model = languagesFromProject(root, given);
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
				join(dir, courseFile(course.grade, course.subject, course.language)),
				modelFileText(course),
				"utf8",
			);
		}
		slot(root).model = {
			snapshot: modelSnapshot(root),
			value: { ok: true, model },
		};
		return { ok: true };
	} catch {
		// A half-written model must not be served from memory: re-read it next time.
		slot(root).model = undefined;
		return failure("unreadable");
	}
}

/** Reads the model back; a project the wizard made has none. The files are statted first,
 * so an untouched model is served from memory; anything that changed re-reads in full. */
export function readModel(
	root: string,
): { ok: true; model: CurriculumModel } | Failure {
	const holder = slot(root);
	const snapshot = modelSnapshot(root);
	if (holder.model !== undefined && holder.model.snapshot === snapshot)
		return holder.model.value;
	const dir = join(root, MODEL_DIR);
	const headerFile = join(dir, MODEL_FILE);
	if (snapshot === null || !existsSync(headerFile)) {
		const missing = failure(
			"missing",
			"this project has no curriculum model yet",
		);
		holder.model = { snapshot, value: missing };
		return missing;
	}
	let headerText: string;
	const courses: { name: string; text: string }[] = [];
	try {
		headerText = readFileSync(headerFile, "utf8");
		for (const name of readdirSync(dir).sort()) {
			if (!name.endsWith(".json") || name === MODEL_FILE) continue;
			courses.push({ name, text: readFileSync(join(dir, name), "utf8") });
		}
	} catch {
		const unreadable = failure("unreadable");
		holder.model = { snapshot, value: unreadable };
		return unreadable;
	}
	const parsed = parseModelText(headerText, courses);
	if (!parsed.ok) {
		const invalid = failure(
			"invalidProject",
			`${parsed.issues[0]?.path ?? "model"}: ${parsed.issues[0]?.message ?? "invalid"}`,
		);
		holder.model = { snapshot, value: invalid };
		return invalid;
	}
	// A model from before format version 1 is converted once (task 224): the old files go to
	// the backup folder first, then the converted model is written in their place.
	if (parsed.converted) {
		try {
			const backup = join(root, BACKUP_DIR, "model");
			if (!existsSync(backup)) {
				mkdirSync(backup, { recursive: true });
				for (const name of readdirSync(dir))
					if (name.endsWith(".json"))
						copyFileSync(join(dir, name), join(backup, name));
			}
		} catch {
			return failure("unreadable");
		}
		return writeModel(root, parsed.model).ok
			? readModel(root)
			: failure("unreadable");
	}
	holder.model = {
		snapshot,
		value: { ok: true, model: languagesFromProject(root, parsed.model) },
	};
	return holder.model.value;
}

/**
 * Moves courses to their new teaching language (task 225): the model's course and the
 * register rows of that course take the new language, so the units and the files stay with
 * it. The project file has already been written; this follows it.
 */
export function relabelCourses(
	root: string,
	renamed: readonly {
		grade: number;
		subject: string;
		from: string;
		language: string;
	}[],
): Failure | { ok: true } {
	const model = readModel(root);
	if (model.ok) {
		const courses = model.model.courses.map((course) => {
			const change = renamed.find(
				(entry) =>
					entry.grade === course.grade &&
					entry.subject === course.subject &&
					entry.from === course.language,
			);
			return change === undefined
				? course
				: { ...course, language: change.language };
		});
		const written = writeModel(root, { ...model.model, courses });
		if (!written.ok) return written;
	}
	const files = readFiles(root);
	if (!files.ok) return files.code === "missing" ? { ok: true } : files;
	const rows = files.files.map((row) => {
		const change = renamed.find(
			(entry) =>
				entry.grade === row.grade &&
				entry.subject === row.subject &&
				entry.from === row.language,
		);
		return change === undefined ? row : { ...row, language: change.language };
	});
	return writeFiles(root, rows);
}

/** Writes the register rows adoption keeps, so a fact can name the file it came from. */
export function writeFiles(
	root: string,
	files: readonly FileRow[],
): Failure | { ok: true } {
	try {
		mkdirSync(join(root, ".studio"), { recursive: true });
		writeFileSync(join(root, FILES_FILE), modelFileText(files), "utf8");
		slot(root).files = {
			stat: statOf(join(root, FILES_FILE)),
			value: { ok: true, files: [...files] },
		};
		return { ok: true };
	} catch {
		slot(root).files = undefined;
		return failure("unreadable");
	}
}

/** The register rows, or an empty list when the project has none. The file is statted first,
 * so an untouched register is served from memory; a changed one re-reads in full. */
export function readFiles(
	root: string,
): { ok: true; files: FileRow[] } | Failure {
	const holder = slot(root);
	const file = join(root, FILES_FILE);
	const stat = statOf(file);
	if (holder.files !== undefined && sameStat(holder.files.stat, stat))
		return holder.files.value;
	if (stat === null) {
		holder.files = { stat, value: { ok: true, files: [] } };
		return holder.files.value;
	}
	let value: unknown;
	try {
		value = JSON.parse(readFileSync(file, "utf8"));
	} catch {
		const unreadable = failure("unreadable");
		holder.files = { stat, value: unreadable };
		return unreadable;
	}
	if (!Array.isArray(value)) {
		const unreadable = failure("unreadable");
		holder.files = { stat, value: unreadable };
		return unreadable;
	}
	const files: FileRow[] = [];
	for (const item of value) {
		if (typeof item !== "object" || item === null) {
			const unreadable = failure("unreadable");
			holder.files = { stat, value: unreadable };
			return unreadable;
		}
		const row = item as Record<string, unknown>;
		if (typeof row.id !== "string" || typeof row.path !== "string") {
			const unreadable = failure("unreadable");
			holder.files = { stat, value: unreadable };
			return unreadable;
		}
		files.push({
			id: row.id,
			path: row.path,
			grade: typeof row.grade === "number" ? row.grade : null,
			// A row from before task 224 has no language and may name a language copy
			// (`math-ar`): it reads as subject + language. A newer row keeps its own, even "".
			...(typeof row.language === "string"
				? {
						subject: typeof row.subject === "string" ? row.subject : "",
						language: row.language,
					}
				: typeof row.subject === "string" && row.subject !== "unknown"
					? legacySubject(row.subject)
					: {
							subject: typeof row.subject === "string" ? row.subject : "",
							language: "",
						}),
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
	holder.files = { stat, value: { ok: true, files } };
	return holder.files.value;
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

/** The last scan's report, or null when the project has never been scanned. Statted first,
 * so an untouched report is served from memory; a changed one re-reads in full. */
export function readReport(root: string): NewMaterial | null {
	const holder = slot(root);
	const file = join(root, REPORT_FILE);
	const stat = statOf(file);
	if (holder.report !== undefined && sameStat(holder.report.stat, stat))
		return holder.report.value;
	let report: NewMaterial | null = null;
	if (stat !== null) {
		try {
			const value: unknown = JSON.parse(readFileSync(file, "utf8"));
			if (typeof value === "object" && value !== null) {
				const candidate = value as Record<string, unknown>;
				// The writer leaves an empty list out, so an absent list reads back as an
				// empty one; only the scan's own time is worth refusing a file over.
				if (typeof candidate.at === "string") {
					report = {
						at: candidate.at,
						since: typeof candidate.since === "string" ? candidate.since : "",
						found: typeof candidate.found === "number" ? candidate.found : 0,
						read: typeof candidate.read === "number" ? candidate.read : 0,
						groups: Array.isArray(candidate.groups)
							? (candidate.groups as NewMaterial["groups"])
							: [],
						affected: Array.isArray(candidate.affected)
							? (candidate.affected as NewMaterial["affected"])
							: [],
						look: Array.isArray(candidate.look)
							? (candidate.look as NewMaterial["look"])
							: [],
						copies: Array.isArray(candidate.copies)
							? (candidate.copies as NewMaterial["copies"])
							: [],
						moved: Array.isArray(candidate.moved)
							? (candidate.moved as NewMaterial["moved"])
							: [],
						removed: Array.isArray(candidate.removed)
							? (candidate.removed as NewMaterial["removed"])
							: [],
						tessdataMissing: Array.isArray(candidate.tessdataMissing)
							? (candidate.tessdataMissing as NewMaterial["tessdataMissing"])
							: [],
					};
				}
			}
		} catch {
			report = null;
		}
	}
	holder.report = { stat, value: report };
	return report;
}

/** Keeps the last scan's report, which the "New material" panel shows until the next scan. */
export function writeReport(
	root: string,
	report: NewMaterial,
): Failure | { ok: true } {
	try {
		mkdirSync(join(root, ".studio"), { recursive: true });
		writeFileSync(join(root, REPORT_FILE), modelFileText(report), "utf8");
		slot(root).report = {
			stat: statOf(join(root, REPORT_FILE)),
			value: report,
		};
		return { ok: true };
	} catch {
		slot(root).report = undefined;
		return failure("unreadable");
	}
}

/** One file whose picture pages a stopped scan still has to draw and read. */
export type PendingFile = { id: string; pages: number[] };

/** The pages a stopped scan still owes, or an empty list when the last scan finished. */
export function readPending(root: string): PendingFile[] {
	const holder = slot(root);
	const file = join(root, PENDING_FILE);
	const stat = statOf(file);
	if (holder.pending !== undefined && sameStat(holder.pending.stat, stat))
		return holder.pending.value;
	let pending: PendingFile[] = [];
	if (stat !== null) {
		try {
			const value: unknown = JSON.parse(readFileSync(file, "utf8"));
			if (Array.isArray(value)) {
				pending = value.flatMap((item) => {
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
			}
		} catch {
			pending = [];
		}
	}
	holder.pending = { stat, value: pending };
	return pending;
}

/** Remembers the pages a stopped scan still owes, so the next scan continues there. */
export function writePending(
	root: string,
	pending: readonly PendingFile[],
): Failure | { ok: true } {
	try {
		mkdirSync(join(root, ".studio"), { recursive: true });
		writeFileSync(join(root, PENDING_FILE), modelFileText(pending), "utf8");
		slot(root).pending = {
			stat: statOf(join(root, PENDING_FILE)),
			value: [...pending],
		};
		return { ok: true };
	} catch {
		slot(root).pending = undefined;
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
	const index = files.files.findIndex((entry) => entry.id === id);
	const found = index === -1 ? undefined : files.files[index];
	if (found === undefined) return failure("missing");
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
	// A copy of the row, so the cached register is only replaced by writeFiles, never
	// mutated in place behind it.
	const row: FileRow = {
		...found,
		grade: fields.grade,
		subject: fields.subject.trim(),
		block: fields.block.trim(),
		kind: fields.kind,
		authority: fields.authority,
		fixed: [...new Set([...found.fixed, ...FILE_FIELDS])],
	};
	const next = [...files.files];
	next[index] = row;
	return writeFiles(root, next);
}
