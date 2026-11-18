// The job folder way of writing notes (task 157): the Studio writes a folder for the author's
// own AI tool, and collects what the tool puts in its out/ folder. The Studio never drives
// another program and never sees a subscription login: the author pastes one fixed prompt.
//
// Everything here is built from the project root: the page sends only a job's name, checked
// against `JOB_NAME`, and every path goes through safePath. Collecting refuses a wrong name, a
// link, a file that is not regular, one over 300 KB, bytes that are not UTF-8, and a note
// `usable` refuses; nothing it refuses is copied. Collecting again skips a note that is
// already kept, so the same folder can be collected twice without writing anything twice.

import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { join } from "node:path";

import type { Failure } from "../shared/api.ts";
import {
	type ExamsJobCourse,
	JOB_NAME,
	type JobKind,
	type JobRecord,
	type JobSummary,
	type JobTool,
	jobCreated,
	jobDayOf,
	jobKind,
	jobModel,
	jobNameOf,
	joinParts,
	judgeNote,
	MAX_NOTE_BYTES,
	type NoteRefusal,
	type UnitsJobCourse,
	validJobName,
} from "../shared/job.ts";
import type { FileRow } from "../shared/model.ts";
import {
	clean,
	header,
	type NoteUsage,
	noteFile,
	usable,
} from "../shared/notes.ts";
import { safePath } from "./files.ts";
import { writeJobFolder } from "./jobfolder.ts";
import { readFiles, readTextFile } from "./model.ts";
import { noteIds, saveNote } from "./notes.ts";

/** Where the Studio keeps its jobs, under the project's own memory. */
export const JOBS_DIR = ".studio/jobs";

const failure = (code: Failure["code"], detail?: string): Failure => ({
	ok: false,
	code,
	...(detail === undefined ? {} : { detail }),
});

/** A prepared job: its folder's real path, and the exact prompt to paste. */
export type PreparedJob = {
	ok: true;
	name: string;
	path: string;
	prompt: string;
	files: number;
};

/** What preparing a job needs. The text and pages come from the project, or a test's own. */
export type PrepareInput = {
	root: string;
	rows: readonly FileRow[];
	ids: readonly string[];
	curriculum: string;
	rules: string;
	tool: JobTool;
	now: Date;
	/** A file's text; the project's .studio/text by default. */
	text?: (id: string) => string;
	/** A page's picture bytes, or null; the project's .studio/pages by default. */
	page?: (id: string, page: number) => Uint8Array | null;
};

/** The page picture a file's text names, read from .studio/pages, or null. */
function projectPage(
	root: string,
	id: string,
	page: number,
): Uint8Array | null {
	const path = safePath(
		root,
		`.studio/pages/${id}/p${String(page).padStart(3, "0")}.png`,
	);
	if (path === null) return null;
	try {
		return new Uint8Array(readFileSync(path));
	} catch {
		return null;
	}
}

/** A job name that is free, moving on a minute when one was already made in this one. */
export function freeJobName(root: string, now: Date): string | null {
	for (let minute = 0; minute < 120; minute += 1) {
		const name = jobNameOf(new Date(now.getTime() + minute * 60_000));
		const path = safePath(root, `${JOBS_DIR}/${name}`);
		if (path === null) return null;
		if (!existsSync(path)) return name;
	}
	return null;
}

/**
 * Writes a job folder for the selected files: README.md, rules.md, files/ in parts, the unread
 * pictures under pages/, and an empty out/. The app's folder is always inside the project.
 */
export function prepareJob(input: PrepareInput): PreparedJob | Failure {
	const wanted = new Set(input.ids);
	const rows = input.rows.filter(
		(row) =>
			row.dupOf === "" &&
			row.error === "" &&
			(wanted.size === 0 || wanted.has(row.id)),
	);
	if (rows.length === 0) return failure("missing", "no file to note");
	const name = freeJobName(input.root, input.now);
	if (name === null) return failure("unreadable");
	const folder = safePath(input.root, `${JOBS_DIR}/${name}`);
	if (folder === null) return failure("outside");
	const text = input.text ?? ((id: string) => readTextFile(input.root, id));
	const page =
		input.page ?? ((id: string, n: number) => projectPage(input.root, id, n));
	const written = writeJobFolder({
		folder,
		rows,
		curriculum: input.curriculum,
		rules: input.rules,
		tool: input.tool,
		now: input.now,
		text,
		page,
	});
	if (!written.ok) return failure(written.code);
	return written;
}

/** What was in a job's out/ when collecting: what was kept, skipped, and why. */
export type CollectOutcome = {
	collected: string[];
	skipped: string[];
	refused: { name: string; code: NoteRefusal }[];
};

/** What collecting needs: the project, the job's name, and the day for the header. */
export type CollectInput = {
	root: string;
	name: string;
	today: Date;
};

/** The job's own record, or null when the folder has none. */
export function jobRecord(folder: string): JobRecord | null {
	try {
		const value: unknown = JSON.parse(
			readFileSync(join(folder, "job.json"), "utf8"),
		);
		if (typeof value !== "object" || value === null) return null;
		const raw = value as Record<string, unknown>;
		const tool = raw.tool === "claude-code" ? "claude-code" : "other";
		const ids = Array.isArray(raw.ids)
			? raw.ids.filter((id): id is string => typeof id === "string")
			: [];
		return {
			name: typeof raw.name === "string" ? raw.name : "",
			created: jobCreated({ created: raw.created }),
			tool,
			kind: jobKind(raw.kind),
			ids,
			courses: coursesOf(raw.courses),
			exams: examsOf(raw.exams),
		};
	} catch {
		return null;
	}
}

/** The course folders a units job's record names, with every field the folders were made from. */
function coursesOf(value: unknown): UnitsJobCourse[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		if (typeof item !== "object" || item === null) return [];
		const raw = item as Record<string, unknown>;
		if (
			typeof raw.folder !== "string" ||
			typeof raw.grade !== "number" ||
			typeof raw.subject !== "string" ||
			typeof raw.period !== "string"
		)
			return [];
		return [
			{
				folder: raw.folder,
				grade: raw.grade,
				subject: raw.subject,
				language: typeof raw.language === "string" ? raw.language : "",
				period: raw.period,
				units: typeof raw.units === "number" ? raw.units : 0,
				notes: typeof raw.notes === "number" ? raw.notes : 0,
			},
		];
	});
}

/** The course folders an exams job's record names, with every field the folders were made from. */
function examsOf(value: unknown): ExamsJobCourse[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		if (typeof item !== "object" || item === null) return [];
		const raw = item as Record<string, unknown>;
		if (
			typeof raw.folder !== "string" ||
			typeof raw.grade !== "number" ||
			typeof raw.subject !== "string"
		)
			return [];
		return [
			{
				folder: raw.folder,
				grade: raw.grade,
				subject: raw.subject,
				language: typeof raw.language === "string" ? raw.language : "",
				exams: typeof raw.exams === "number" ? raw.exams : 0,
				notes: typeof raw.notes === "number" ? raw.notes : 0,
			},
		];
	});
}

/** True for a real folder, never a link or junction to one. */
export function realFolder(path: string): boolean {
	try {
		const info = lstatSync(path);
		return info.isDirectory() && !info.isSymbolicLink();
	} catch {
		return false;
	}
}

/** The ids a job's files/ folder holds, for a job whose record is missing or damaged. */
function idsFromFiles(folder: string): string[] {
	try {
		return readdirSync(join(folder, "files"))
			.map(
				(name) => /^([0-9a-f]{12})(?:\.part[2-9])?\.md$/.exec(name)?.[1] ?? "",
			)
			.filter((id) => id !== "");
	} catch {
		return [];
	}
}

/**
 * Reads a job's out/ folder and keeps every note that passes the checks. A note already kept
 * is skipped, so collecting twice is safe.
 */
export function collectJob(input: CollectInput): CollectOutcome | Failure {
	const name = validJobName(input.name);
	if (name === null) return failure("invalidName");
	const folder = safePath(input.root, `${JOBS_DIR}/${name}`);
	if (folder === null) return failure("outside");
	if (!existsSync(join(folder, "out"))) return failure("missing");
	// The AI tool can write inside the job, so out/ (and the job itself) could be swapped for a
	// link or a junction that leads elsewhere; only real folders the Studio made are read.
	if (!realFolder(folder) || !realFolder(join(folder, "out")))
		return failure("unreadable");

	const record = jobRecord(folder);
	const known = new Set(record?.ids ?? idsFromFiles(folder));
	const tool = record?.tool ?? "other";
	const files = readFiles(input.root);
	if (!files.ok) return files;
	const rows = new Map(files.files.map((row) => [row.id, row]));
	const kept = noteIds(input.root);
	const outcome: CollectOutcome = { collected: [], skipped: [], refused: [] };
	const skipped = new Set<string>();
	const parts = new Map<string, { part: number; body: string }[]>();

	let entries: string[] = [];
	try {
		entries = readdirSync(join(folder, "out")).sort();
	} catch {
		return failure("unreadable");
	}
	for (const entry of entries) {
		const path = join(folder, "out", entry);
		let info: ReturnType<typeof lstatSync>;
		try {
			info = lstatSync(path, { bigint: true });
		} catch {
			outcome.refused.push({ name: entry, code: "notFile" });
			continue;
		}
		let bytes: Uint8Array | null = null;
		if (
			info.isFile() &&
			!info.isSymbolicLink() &&
			Number(info.size) <= MAX_NOTE_BYTES
		) {
			try {
				bytes = new Uint8Array(readFileSync(path));
			} catch {
				bytes = null;
			}
		}
		const judged = judgeNote(
			entry,
			{
				isFile: info.isFile(),
				isLink: info.isSymbolicLink(),
				size: Number(info.size),
			},
			bytes,
			usable,
			clean,
		);
		if (!judged.ok) {
			outcome.refused.push({ name: entry, code: judged.code });
			continue;
		}
		const id = judged.note.id;
		if (!known.has(id)) {
			outcome.refused.push({ name: entry, code: "unknown" });
			continue;
		}
		// A note already kept is never written again.
		if (kept.has(id)) {
			skipped.add(id);
			continue;
		}
		const list = parts.get(id) ?? [];
		list.push({ part: judged.note.part, body: judged.note.body });
		parts.set(id, list);
	}

	for (const [id, list] of parts) {
		const row = rows.get(id);
		if (row === undefined) {
			outcome.refused.push({ name: `${id}.md`, code: "unknown" });
			continue;
		}
		const joined = joinParts(list);
		if (!joined.ok) {
			outcome.refused.push({ name: `${id}.md`, code: joined.code });
			continue;
		}
		const usage: NoteUsage = {
			in: null,
			out: null,
			estimated: false,
			images: picturesIn(folder, id),
		};
		const note = noteFile(
			header(row, curriculumOf(input.root), jobModel(tool), usage, input.today),
			[joined.body],
		);
		if (saveNote(input.root, id, note)) outcome.collected.push(id);
		else outcome.refused.push({ name: `${id}.md`, code: "notFile" });
	}
	outcome.skipped = [...skipped].sort();
	return outcome;
}

/** How many picture pages a job copied for one file. */
function picturesIn(folder: string, id: string): number {
	try {
		return readdirSync(join(folder, "pages", id)).filter((name) =>
			/^p\d{3,4}\.png$/.test(name),
		).length;
	} catch {
		return 0;
	}
}

/** The project folder's own name, which is its curriculum's id, as adoption names it. */
function curriculumOf(root: string): string {
	return (
		root
			.split(/[\\/]/)
			.filter((part) => part !== "")
			.pop() ?? ""
	);
}

/** Every job folder of one kind in the project, newest first, with what its record says. */
export function listJobs(root: string, kind: JobKind = "notes"): JobSummary[] {
	let names: string[] = [];
	try {
		names = readdirSync(join(root, JOBS_DIR)).filter((name) =>
			JOB_NAME.test(name),
		);
	} catch {
		return [];
	}
	const out: JobSummary[] = [];
	for (const name of names.sort().reverse()) {
		const folder = safePath(root, `${JOBS_DIR}/${name}`);
		if (folder === null) continue;
		const record = jobRecord(folder);
		const job: JobKind = record?.kind ?? "notes";
		if (job !== kind) continue;
		out.push({
			name,
			created: record?.created || jobDayOf(name),
			tool: record?.tool ?? "other",
			kind: job,
			files: record?.ids.length ?? idsFromFiles(folder).length,
		});
	}
	return out;
}

/** A job's folder, deleted after the author confirmed it. Only a job's own name gets here. */
export function deleteJob(
	root: string,
	name: string,
	kind: JobKind = "notes",
): Failure | { ok: true } {
	const valid = validJobName(name);
	if (valid === null) return failure("invalidName");
	const folder = safePath(root, `${JOBS_DIR}/${valid}`);
	if (folder === null) return failure("outside");
	if (!existsSync(folder)) return failure("missing");
	try {
		// A job is a real folder the Studio made: never a link that leads elsewhere. The
		// record says which kind it is, so the notes panel can't delete a units job.
		const info = lstatSync(folder);
		if (!info.isDirectory() || info.isSymbolicLink())
			return failure("unreadable");
		if ((jobRecord(folder)?.kind ?? "notes") !== kind)
			return failure("invalidName");
		rmSync(folder, { recursive: true, force: true });
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}
