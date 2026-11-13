// Change sets on disk and their way through review (task 158). A set waits in
// `.studio/changes/<grade>-<subject>-<period>.json` until the author accepts or rejects it, and
// accepting merges it into the project's model through the main process. The job folder way
// writes the same files into `.studio/jobs/<yyyy-mm-dd-hhmm>/` as task 157 does for notes.
//
// The page sends only a target (grade, subject, period) and, for a job, its name; every path is
// built here from the project root through safePath, and a target counts only when the model
// has that course and period. Collecting refuses a wrong name, a link (lstat, including a
// linked out/ folder), a file that is not regular, one of 2 MB or more, bytes that are not
// UTF-8, and JSON that is not a change set; nothing it refuses is kept.
//
// Cost: writing a set with the author's key is one request per course and period; the plan
// prices it before it is sent, and the limit stops a request that would pass it.

import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

import type { Failure } from "../shared/api";
import {
	CHANGES_DIR,
	type ChangeRefusalCode,
	type ChangeReview,
	mergeCourse,
	parseChangeSet,
	reviewUnits,
} from "../shared/changes";
import { type JobTool, jobModel, validJobName } from "../shared/job";
import type { CurriculumModel, FileRow, ModelCourse } from "../shared/model";
import { DEFAULT_LIMIT_USD, isoDay } from "../shared/notes";
import {
	type AcceptChoice,
	acceptKey,
	changeName,
	MAX_CHANGE_BYTES,
	notedRows,
	notesOrder,
	periodUnits,
	type Target,
	targetOf,
	targetRows,
} from "../shared/targets";
import { safePath } from "./files";
import { freeJobName, JOBS_DIR, jobRecord, realFolder } from "./job";
import { readPageCount, readPageText, writeModel } from "./model";
import {
	type NoteSettings,
	noteIds,
	readNote,
	readSettings,
	settingsPath,
	writeSettings,
} from "./notes";
import { writeUnitsFolder } from "./unitfolder";

/** The model the units way starts with: it reads a whole period and writes long JSON. */
export const DEFAULT_UNITS_MODEL = "anthropic/claude-sonnet-5.5";

const failure = (code: Failure["code"], detail?: string): Failure => ({
	ok: false,
	code,
	...(detail === undefined ? {} : { detail }),
});

/** Where the units settings live: the app's own folder, never a project. */
export function unitsSettingsFile(userData: string): string {
	return settingsPath(userData, "units.json");
}

/** The units model and limit; a damaged or missing file falls back to the defaults. */
export function readUnitsSettings(userData: string): NoteSettings {
	return readSettings(unitsSettingsFile(userData), {
		model: DEFAULT_UNITS_MODEL,
		limit: DEFAULT_LIMIT_USD,
	});
}

/** Keeps the units model and limit. Null when either is not acceptable. */
export function writeUnitsSettings(
	userData: string,
	value: unknown,
): NoteSettings | null {
	return writeSettings(unitsSettingsFile(userData), value);
}

/** The course a target names, or null when the model has no such course. */
export function targetCourse(
	model: CurriculumModel,
	target: Target,
): ModelCourse | null {
	return (
		model.courses.find(
			(course) =>
				course.grade === target.grade && course.subject === target.subject,
		) ?? null
	);
}

/** A target the model knows, and whose course has a unit in that period, or null. */
export function knownTarget(
	model: CurriculumModel,
	grade: unknown,
	subject: unknown,
	period: unknown,
): Target | null {
	const target = targetOf(grade, subject, period);
	if (target === null) return null;
	const course = targetCourse(model, target);
	if (course === null) return null;
	return course.units.some((unit) => unit.period === target.period)
		? target
		: null;
}

/** The change set's own file, or null when the target could not name one. */
export function changeFile(root: string, target: Target): string | null {
	const name = changeName(target);
	if (name === null) return null;
	return safePath(root, `${CHANGES_DIR}/${name}.json`);
}

/** One change set as it waits on disk: its state, where it came from, and the model's JSON. */
export type StoredChange = {
	state: "pending" | "rejected";
	at: string;
	source: "key" | "job";
	model: string;
	accepted: string[];
	set: unknown;
};

/** A set read from its file, or null when it is not there or not a stored set. */
function storedAt(path: string | null): StoredChange | null {
	if (path === null) return null;
	try {
		const value: unknown = JSON.parse(readFileSync(path, "utf8"));
		if (typeof value !== "object" || value === null) return null;
		const raw = value as Record<string, unknown>;
		const state =
			raw.state === "rejected"
				? "rejected"
				: raw.state === "pending"
					? "pending"
					: null;
		if (state === null) return null;
		return {
			state,
			at: typeof raw.at === "string" ? raw.at : "",
			source: raw.source === "job" ? "job" : "key",
			model: typeof raw.model === "string" ? raw.model : "",
			accepted: Array.isArray(raw.accepted)
				? raw.accepted.filter((key): key is string => typeof key === "string")
				: [],
			set: raw.set,
		};
	} catch {
		return null;
	}
}

/** A stored set for a target, or null. */
export function readStored(root: string, target: Target): StoredChange | null {
	return storedAt(changeFile(root, target));
}

/** Writes a stored set under .studio/changes, replacing what was there. */
function saveStored(
	root: string,
	target: Target,
	stored: StoredChange,
): Failure | { ok: true } {
	const path = changeFile(root, target);
	if (path === null) return failure("invalidName");
	try {
		mkdirSync(join(root, CHANGES_DIR), { recursive: true });
		writeFileSync(path, `${JSON.stringify(stored, null, "\t")}\n`, "utf8");
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}

/** The reader's view of one target, or null when the model no longer has it. */
function givenFor(
	root: string,
	model: CurriculumModel,
	files: readonly FileRow[],
	target: Target,
) {
	const course = targetCourse(model, target);
	if (course === null) return null;
	return {
		target,
		units: periodUnits(course, target.period),
		files,
		page: (id: string, page: number) => readPageText(root, id, page),
		pages: (id: string) => readPageCount(root, id),
	};
}

/** The stored sets' file names in .studio/changes, without a path. */
function storedNames(root: string): string[] {
	try {
		return readdirSync(join(root, CHANGES_DIR)).filter(
			(name) => name.endsWith(".json") && !/[\\/]/.test(name),
		);
	} catch {
		return [];
	}
}

/**
 * Every change set the project keeps, pending or rejected, checked again against the model and
 * the register: the review the page shows. A set that is damaged or no longer fits the project
 * is listed with the reason, so the author can still delete it.
 */
export function readChangeSets(
	root: string,
	model: CurriculumModel,
	files: readonly FileRow[],
): { ok: true; sets: ChangeReview[] } | Failure {
	const sets: ChangeReview[] = [];
	for (const name of storedNames(root)) {
		const path = safePath(root, `${CHANGES_DIR}/${name}`);
		const stored = storedAt(path);
		if (stored === null) continue;
		const raw =
			typeof stored.set === "object" && stored.set !== null
				? (stored.set as Record<string, unknown>)
				: {};
		const target = targetOf(raw.grade, raw.subject, raw.period);
		if (target === null) continue;
		if (`${changeName(target)}.json` !== name) continue;
		const given = givenFor(root, model, files, target);
		if (given === null) continue;
		const base = {
			key: changeName(target) ?? name,
			grade: target.grade,
			subject: target.subject,
			period: target.period,
			state: stored.state,
			at: stored.at,
			source: stored.source,
			model: stored.model,
			accepted: stored.accepted,
		};
		const parsed = parseChangeSet(stored.set, given);
		if (!parsed.ok) {
			sets.push({
				...base,
				units: [],
				open: [],
				refused: [{ path: name, message: parsed.issue }],
			});
			continue;
		}
		sets.push({
			...base,
			units: reviewUnits(parsed.set, targetCourse(model, target)),
			open: parsed.set.open,
			refused: parsed.refused,
		});
	}
	return {
		ok: true,
		sets: sets.sort(
			(a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key),
		),
	};
}

/**
 * Keeps a change set for review: it is checked first, so a set the page could not review is
 * never written. A set with no unit the project can keep is refused with the reason.
 */
export function saveChangeSet(
	root: string,
	model: CurriculumModel,
	files: readonly FileRow[],
	target: Target,
	set: unknown,
	source: "key" | "job",
	modelName: string,
	today: Date,
): Failure | { ok: true } {
	const given = givenFor(root, model, files, target);
	if (given === null) return failure("missing", "no such course and period");
	const parsed = parseChangeSet(set, given);
	if (!parsed.ok) return failure("refused", parsed.issue);
	return saveStored(root, target, {
		state: "pending",
		at: isoDay(today),
		source,
		model: modelName,
		accepted: [],
		set,
	});
}

/**
 * Accepts a change set, or one unit or lesson of it, and writes the model. Nothing outside the
 * set is touched, and no unit or lesson is ever removed.
 */
export function acceptChange(input: {
	root: string;
	model: CurriculumModel;
	files: readonly FileRow[];
	target: Target;
	choice: AcceptChoice;
}): Failure | { ok: true; left: number } {
	const stored = readStored(input.root, input.target);
	if (stored === null || stored.state !== "pending")
		return failure("missing", "no change set to accept");
	const given = givenFor(input.root, input.model, input.files, input.target);
	if (given === null) return failure("missing", "no such course and period");
	const parsed = parseChangeSet(stored.set, given);
	if (!parsed.ok) return failure("refused", parsed.issue);
	const course = targetCourse(input.model, input.target);
	if (course === null) return failure("missing", "no such course");
	const merged = mergeCourse(course, parsed.set, input.choice);
	const next: CurriculumModel = {
		...input.model,
		courses: input.model.courses.map((entry) =>
			entry.grade === course.grade && entry.subject === course.subject
				? merged
				: entry,
		),
	};
	const written = writeModel(input.root, next);
	if (!written.ok) return written;
	const path = changeFile(input.root, input.target);
	if (path === null) return failure("invalidName");
	if (input.choice.kind === "all") {
		rmSync(path, { force: true });
		return { ok: true, left: 0 };
	}
	const accepted = [...new Set([...stored.accepted, acceptKey(input.choice)])];
	const left = parsed.set.units.filter(
		(unit) => !accepted.includes(String(unit.number)),
	).length;
	if (left === 0) {
		rmSync(path, { force: true });
		return { ok: true, left };
	}
	const kept = saveStored(input.root, input.target, {
		...stored,
		accepted,
	});
	return kept.ok ? { ok: true, left } : kept;
}

/** Keeps a rejected set for reference until the author deletes it. */
export function rejectChange(
	root: string,
	target: Target,
): Failure | { ok: true } {
	const stored = readStored(root, target);
	if (stored === null) return failure("missing");
	return saveStored(root, target, { ...stored, state: "rejected" });
}

/** Deletes a change set's file, rejected or not. */
export function deleteChange(
	root: string,
	target: Target,
): Failure | { ok: true } {
	const path = changeFile(root, target);
	if (path === null) return failure("invalidName");
	try {
		rmSync(path, { force: true });
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}

/** A units job the Studio prepared, with the exact prompt to paste. */
export type UnitsJobMade = {
	ok: true;
	name: string;
	path: string;
	prompt: string;
	files: number;
};

/** What preparing a units job needs. */
export type PrepareUnitsInput = {
	root: string;
	model: CurriculumModel;
	rows: readonly FileRow[];
	targets: readonly Target[];
	curriculum: string;
	rules: string;
	tool: JobTool;
	now: Date;
	/** The files that have a note; the project's .studio/notes by default. */
	noted?: ReadonlySet<string>;
};

/**
 * Writes a units job under .studio/jobs for the chosen course periods: README.md, rules.md, one
 * course folder per period, and an empty out/. Only a period with at least one note is written.
 */
export function prepareUnitsJob(
	input: PrepareUnitsInput,
): UnitsJobMade | Failure {
	const noted = input.noted ?? noteIds(input.root);
	const courses = input.targets.flatMap((target) => {
		const course = targetCourse(input.model, target);
		const folder = changeName(target);
		if (course === null || folder === null) return [];
		const notes = notesOrder(
			notedRows(targetRows(input.rows, target), noted),
		).flatMap((row) => {
			const text = readNote(input.root, row.id);
			return text === "" ? [] : [{ id: row.id, text }];
		});
		return notes.length === 0
			? []
			: [{ folder, course, period: target.period, notes }];
	});
	if (courses.length === 0)
		return failure("missing", "no note for these periods");
	const name = freeJobName(input.root, input.now);
	if (name === null) return failure("unreadable");
	const folder = safePath(input.root, `${JOBS_DIR}/${name}`);
	if (folder === null) return failure("outside");
	const written = writeUnitsFolder({
		folder,
		curriculum: input.curriculum,
		rules: input.rules,
		tool: input.tool,
		now: input.now,
		courses,
	});
	if (!written.ok) return failure(written.code);
	return {
		ok: true,
		name: written.name,
		path: written.path,
		prompt: written.prompt,
		files: written.files,
	};
}

/** What collecting a units job kept, skipped and refused. */
export type UnitsCollected = {
	collected: string[];
	skipped: string[];
	refused: { name: string; code: ChangeRefusalCode }[];
};

/** What collecting a units job needs. */
export type CollectUnitsInput = {
	root: string;
	model: CurriculumModel;
	files: readonly FileRow[];
	name: string;
	today: Date;
};

/**
 * Reads a units job's out/ folder and keeps every change set that passes the checks. A period
 * that already has a pending set is skipped, so collecting twice writes nothing twice.
 */
export function collectUnitsJob(
	input: CollectUnitsInput,
): UnitsCollected | Failure {
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
	if (record?.kind !== "units") return failure("invalidName");
	const folders = new Map(
		record.courses.flatMap((course) => {
			const target = targetOf(course.grade, course.subject, course.period);
			if (target === null || changeName(target) !== course.folder) return [];
			return [[course.folder, target] as const];
		}),
	);
	const outcome: UnitsCollected = { collected: [], skipped: [], refused: [] };
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
		if (info.isSymbolicLink()) {
			outcome.refused.push({ name: entry, code: "link" });
			continue;
		}
		if (!info.isFile()) {
			outcome.refused.push({ name: entry, code: "notFile" });
			continue;
		}
		if (Number(info.size) >= MAX_CHANGE_BYTES) {
			outcome.refused.push({ name: entry, code: "tooLarge" });
			continue;
		}
		const target = /^(.+)\.json$/.exec(entry)?.[1];
		const wanted = target === undefined ? undefined : folders.get(target);
		if (target === undefined || wanted === undefined) {
			outcome.refused.push({ name: entry, code: "name" });
			continue;
		}
		let text: string;
		try {
			text = new TextDecoder("utf-8", { fatal: true }).decode(
				new Uint8Array(readFileSync(path)),
			);
		} catch {
			outcome.refused.push({ name: entry, code: "notUtf8" });
			continue;
		}
		let value: unknown;
		try {
			value = JSON.parse(text);
		} catch {
			outcome.refused.push({ name: entry, code: "invalid" });
			continue;
		}
		const given = givenFor(input.root, input.model, input.files, wanted);
		if (given === null) {
			outcome.refused.push({ name: entry, code: "unknown" });
			continue;
		}
		const parsed = parseChangeSet(value, given);
		if (!parsed.ok) {
			outcome.refused.push({ name: entry, code: "invalid" });
			continue;
		}
		const existing = readStored(input.root, wanted);
		if (existing !== null && existing.state === "pending") {
			outcome.skipped.push(target ?? entry);
			continue;
		}
		const saved = saveChangeSet(
			input.root,
			input.model,
			input.files,
			wanted,
			value,
			"job",
			jobModel(record.tool),
			input.today,
		);
		if (saved.ok) outcome.collected.push(target ?? entry);
		else outcome.refused.push({ name: entry, code: "invalid" });
	}
	return outcome;
}
