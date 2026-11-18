// Change sets on disk and their way through review (task 158). A set waits in
// `.studio/changes/<grade>-<subject>-<period>.json` until the author accepts or rejects it, and
// accepting merges it into the project's model through the main process. The job folder way
// writes the same files into `.studio/jobs/<yyyy-mm-dd-hhmm>/` as task 157 does for notes.
//
// The page sends only a target (grade, subject, period) and, for a job, its name; every path is
// built here from the project root through safePath, and a target counts only when the year
// can name its grade, subject and period — a course the project has not got yet, or a block it
// has no unit in, counts too (task 178), and its request carries an empty course. Collecting
// refuses a wrong name, a link (lstat, including a linked out/ folder), a file that is not
// regular, one of 2 MB or more, bytes that are not UTF-8, and JSON that is not a change set;
// nothing it refuses is kept.
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

import type { Failure } from "../shared/api.ts";
import {
	CHANGES_DIR,
	type ChangeRefusalCode,
	type ChangeReview,
	mergeCourse,
	parseChangeSet,
	reviewUnits,
} from "../shared/changes.ts";
import { rowCourse } from "../shared/convert.ts";
import {
	type ExamChoice,
	type ExamGiven,
	type ExamTarget,
	examName,
	examTargetOf,
	mergeExams,
	paperAcceptKey,
	paperKeys,
	parseExamChangeSet,
	periodIds,
	reviewExams,
} from "../shared/exam-changes.ts";
import { applyExamFix } from "../shared/exam-numbers.ts";
import { GRADE_MAX, GRADE_MIN } from "../shared/format/grades.ts";
import { type JobTool, jobModel, validJobName } from "../shared/job.ts";
import type { CurriculumModel, FileRow, ModelCourse } from "../shared/model.ts";
import { emptyCourse, sameCourse } from "../shared/model.ts";
import { DEFAULT_LIMIT_USD, isoDay } from "../shared/notes.ts";
import {
	type AcceptChoice,
	acceptKey,
	blockOf,
	changeName,
	MAX_CHANGE_BYTES,
	notedRows,
	notesOrder,
	periodUnits,
	type Target,
	targetOf,
	targetRows,
} from "../shared/targets.ts";
import { safePath } from "./files.ts";
import { freeJobName, JOBS_DIR, jobRecord, realFolder } from "./job.ts";
import { readPageCount, readPageText, writeModel } from "./model.ts";
import {
	type NoteSettings,
	noteIds,
	readNote,
	readSettings,
	settingsPath,
	writeSettings,
} from "./notes.ts";
import { writeUnitsFolder } from "./unitfolder.ts";

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
	target: { grade: number; subject: string; language: string },
): ModelCourse | null {
	return model.courses.find((course) => sameCourse(course, target)) ?? null;
}

/** A target the model may build, and whether it is a course the project has not got yet. */
export type AllowedTarget = Target & { isNew: boolean };

/** The periods the year holds, at any level. */
function periodIdsOf(model: CurriculumModel): Set<string> {
	return periodIds(model.curriculum.periods);
}

/** True when a period is one the year can name, or a block of 1 to 6 for a year with none. */
function periodAllowed(model: CurriculumModel, period: string): boolean {
	const ids = periodIdsOf(model);
	if (ids.size === 0) return /^block-[1-6]$/.test(period);
	return ids.has(period);
}

/**
 * A target the units step may build (task 178), or null when it names something the project
 * cannot be about. A new course and a block the course has no unit in are both allowed; the
 * change set's rules do not change, and the request's course is simply empty.
 */
export function allowedTarget(
	model: CurriculumModel,
	grade: unknown,
	subject: unknown,
	language: unknown,
	period: unknown,
	subjectIds: readonly string[],
): AllowedTarget | null {
	const target = targetOf(grade, subject, language, period);
	if (target === null) return null;
	if (target.grade < GRADE_MIN || target.grade > GRADE_MAX) return null;
	if (!subjectIds.includes(target.subject)) return null;
	if (!periodAllowed(model, target.period)) return null;
	return { ...target, isNew: targetCourse(model, target) === null };
}

/** A course the exams step may build, and whether the project has it yet. */
export type AllowedExamTarget = ExamTarget & { isNew: boolean };

/** A course the exams step may build, or null when its grade or subject is not one we know. */
export function allowedExamTarget(
	model: CurriculumModel,
	grade: unknown,
	subject: unknown,
	language: unknown,
	subjectIds: readonly string[],
): AllowedExamTarget | null {
	const target = examTargetOf(grade, subject, language);
	if (target === null) return null;
	if (target.grade < GRADE_MIN || target.grade > GRADE_MAX) return null;
	if (!subjectIds.includes(target.subject)) return null;
	return { ...target, isNew: targetCourse(model, target) === null };
}

/** The periods a register block names, for a target built from the material itself. */
export function blockPeriods(block: string): string[] {
	return block
		.split("&")
		.map((part) => part.trim())
		.filter((part) => part !== "")
		.flatMap((part) => {
			const period = `block-${part}`;
			return blockOf(period) === part ? [period] : [];
		});
}

/**
 * The request the change set's own file and the register are checked against. A course the
 * project has not got yet, or a block it has no unit in, is an empty course: the set writes
 * the units from the notes alone (task 178). `allowNewUnits` keeps a set made for such a
 * period acceptable after the author has accepted one of its units.
 */
function givenFor(
	root: string,
	model: CurriculumModel,
	files: readonly FileRow[],
	target: Target,
	allowNewUnits = false,
) {
	const course =
		targetCourse(model, target) ??
		emptyCourse(target.grade, target.subject, target.language);
	return {
		target,
		units: periodUnits(course, target.period),
		allowNewUnits,
		taken: new Set(course.units.map((unit) => unit.number)),
		files,
		page: (id: string, page: number) => readPageText(root, id, page),
		pages: (id: string) => readPageCount(root, id),
	};
}

/** The registry view one course's exams are checked against: the course and its register rows. */
function examGivenFor(
	model: CurriculumModel,
	files: readonly FileRow[],
	target: ExamTarget,
): ExamGiven {
	const course =
		targetCourse(model, target) ??
		emptyCourse(target.grade, target.subject, target.language);
	return {
		target,
		periods: [...periodIds(model.curriculum.periods)],
		exams: course.exams,
		files,
	};
}

/** The change set's own file, or null when the target could not name one. */
export function changeFile(root: string, target: Target): string | null {
	const name = changeName(target);
	if (name === null) return null;
	return safePath(root, `${CHANGES_DIR}/${name}.json`);
}

/** One change set as it waits on disk: its state, where it came from, and the model's JSON. */
export type StoredChange = {
	/** "units" for units and lessons, "exams" for exam papers; a set from before task 177 is
	 * a units set. */
	kind: "units" | "exams";
	state: "pending" | "rejected";
	at: string;
	source: "key" | "job";
	model: string;
	accepted: string[];
	/** True when the set was written for a period with no unit yet, so accepting one of its
	 * units leaves the rest acceptable (task 178). */
	newUnits?: boolean;
	/** The course's teaching language; a set from before task 224 has none and is converted. */
	language?: string;
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
			kind: raw.kind === "exams" ? "exams" : "units",
			state,
			at: typeof raw.at === "string" ? raw.at : "",
			source: raw.source === "job" ? "job" : "key",
			model: typeof raw.model === "string" ? raw.model : "",
			accepted: Array.isArray(raw.accepted)
				? raw.accepted.filter((key): key is string => typeof key === "string")
				: [],
			newUnits: raw.newUnits === true,
			...(typeof raw.language === "string" ? { language: raw.language } : {}),
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
		writeFileSync(
			path,
			`${JSON.stringify({ ...stored, language: target.language }, null, "\t")}\n`,
			"utf8",
		);
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}

/** The exam change set's own file, or null when the course could not name one. */
export function examFile(root: string, target: ExamTarget): string | null {
	const name = examName(target.grade, target.subject, target.language);
	if (name === null) return null;
	return safePath(root, `${CHANGES_DIR}/${name}-exams.json`);
}

/** The name an exam change set takes in .studio/changes and in the review's key: "9-arabic-ar". */
export function examKey(target: ExamTarget): string | null {
	return examName(target.grade, target.subject, target.language);
}

/** A stored exam change set for a course, or null. */
export function readExamStored(
	root: string,
	target: ExamTarget,
): StoredChange | null {
	return storedAt(examFile(root, target));
}

/** Writes an exam change set under .studio/changes, replacing what was there. */
function saveExamStored(
	root: string,
	target: ExamTarget,
	stored: StoredChange,
): Failure | { ok: true } {
	const path = examFile(root, target);
	if (path === null) return failure("invalidName");
	try {
		mkdirSync(join(root, CHANGES_DIR), { recursive: true });
		writeFileSync(
			path,
			`${JSON.stringify({ ...stored, language: target.language }, null, "\t")}\n`,
			"utf8",
		);
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}

/**
 * Moves a set from before task 224 to the name its course has now, with its language written
 * in. Nothing is lost when it fails: the set is read again under its old name next time.
 */
function moveStored(
	root: string,
	from: string,
	to: string,
	language: string,
): void {
	const source = safePath(root, `${CHANGES_DIR}/${from}`);
	const target = safePath(root, `${CHANGES_DIR}/${to}`);
	if (source === null || target === null || existsSync(target)) return;
	try {
		const value = JSON.parse(readFileSync(source, "utf8")) as Record<
			string,
			unknown
		>;
		writeFileSync(
			target,
			`${JSON.stringify({ ...value, language }, null, "\t")}\n`,
			"utf8",
		);
		rmSync(source, { force: true });
	} catch {
		// Left as it was.
	}
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
		const common = {
			kind: stored.kind,
			state: stored.state,
			at: stored.at,
			source: stored.source,
			model: stored.model,
			accepted: stored.accepted,
		};
		// A set from before task 224 names a language copy (`chemistry-ar`) and no language.
		const named =
			typeof raw.subject === "string"
				? rowCourse(raw.subject, stored.language)
				: null;
		if (named === null) continue;
		if (stored.kind === "exams") {
			const target = examTargetOf(raw.grade, named.subject, named.language);
			if (target === null) continue;
			const key = examName(target.grade, target.subject, target.language);
			if (key === null) continue;
			if (`${key}-exams.json` !== name) {
				// An old set under its old name moves to the new one, once.
				if (stored.language !== undefined) continue;
				moveStored(root, name, `${key}-exams.json`, target.language);
			}
			const course = targetCourse(model, target);
			const given = examGivenFor(model, files, target);
			const base = {
				...common,
				key,
				grade: target.grade,
				subject: target.subject,
				language: target.language,
				period: "",
			};
			const parsed = parseExamChangeSet(stored.set, given);
			if (!parsed.ok) {
				sets.push({
					...base,
					units: [],
					exams: [],
					open: [],
					refused:
						parsed.refused.length > 0
							? parsed.refused
							: [{ path: name, message: parsed.issue }],
				});
				continue;
			}
			sets.push({
				...base,
				units: [],
				exams: reviewExams(course?.exams ?? [], parsed.set),
				open: parsed.set.open,
				refused: parsed.refused,
			});
			continue;
		}
		const target = targetOf(
			raw.grade,
			named.subject,
			named.language,
			raw.period,
		);
		if (target === null) continue;
		const changeKey = changeName(target);
		if (changeKey === null) continue;
		if (`${changeKey}.json` !== name) {
			if (stored.language !== undefined) continue;
			moveStored(root, name, `${changeKey}.json`, target.language);
		}
		const given = givenFor(
			root,
			model,
			files,
			target,
			stored.newUnits === true,
		);
		const base = {
			...common,
			key: changeKey,
			grade: target.grade,
			subject: target.subject,
			language: target.language,
			period: target.period,
		};
		const parsed = parseChangeSet(stored.set, given);
		if (!parsed.ok) {
			sets.push({
				...base,
				units: [],
				exams: [],
				open: [],
				refused: [{ path: name, message: parsed.issue }],
			});
			continue;
		}
		sets.push({
			...base,
			units: reviewUnits(parsed.set, targetCourse(model, target)),
			exams: [],
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
	// A set written for a period with no unit yet may still add its units after the author has
	// accepted one of them; the set on disk remembers that it was made that way.
	const known = readStored(root, target);
	const allowNewUnits = known?.newUnits === true;
	const given = givenFor(root, model, files, target, allowNewUnits);
	const parsed = parseChangeSet(set, given);
	if (!parsed.ok) return failure("refused", parsed.issue);
	return saveStored(root, target, {
		kind: "units",
		state: "pending",
		at: isoDay(today),
		source,
		model: modelName,
		accepted: [],
		newUnits: allowNewUnits || given.units.length === 0,
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
	if (stored === null || stored.state !== "pending" || stored.kind !== "units")
		return failure("missing", "no change set to accept");
	const given = givenFor(
		input.root,
		input.model,
		input.files,
		input.target,
		stored.newUnits === true,
	);
	const parsed = parseChangeSet(stored.set, given);
	if (!parsed.ok) return failure("refused", parsed.issue);
	const course =
		targetCourse(input.model, input.target) ??
		emptyCourse(
			input.target.grade,
			input.target.subject,
			input.target.language,
		);
	const merged = mergeCourse(course, parsed.set, input.choice);
	const exists = targetCourse(input.model, input.target) !== null;
	const next: CurriculumModel = {
		...input.model,
		courses: exists
			? input.model.courses.map((entry) =>
					sameCourse(entry, course) ? merged : entry,
				)
			: [...input.model.courses, merged],
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

/**
 * Keeps an exam change set for review: it is checked first, so a set the page could not review
 * is never written. A set whose exams or sources fail the checks is refused with the reason.
 */
export function saveExamChangeSet(
	root: string,
	model: CurriculumModel,
	files: readonly FileRow[],
	target: ExamTarget,
	set: unknown,
	source: "key" | "job",
	modelName: string,
	today: Date,
): Failure | { ok: true } {
	const given = examGivenFor(model, files, target);
	const parsed = parseExamChangeSet(set, given);
	if (!parsed.ok) return failure("refused", parsed.issue);
	return saveExamStored(root, target, {
		kind: "exams",
		state: "pending",
		at: isoDay(today),
		source,
		model: modelName,
		accepted: [],
		set,
	});
}

/**
 * Accepts an exam change set, or one paper of it, and writes the model. Every paper the author
 * did not accept stays exactly as it was, and no paper is ever removed.
 */
export function acceptExamChange(input: {
	root: string;
	model: CurriculumModel;
	files: readonly FileRow[];
	target: ExamTarget;
	choice: ExamChoice;
}): Failure | { ok: true; left: number } {
	const stored = readExamStored(input.root, input.target);
	if (stored === null || stored.state !== "pending" || stored.kind !== "exams")
		return failure("missing", "no exam change set to accept");
	const given = examGivenFor(input.model, input.files, input.target);
	const parsed = parseExamChangeSet(stored.set, given);
	if (!parsed.ok) return failure("refused", parsed.issue);
	const course =
		targetCourse(input.model, input.target) ??
		emptyCourse(
			input.target.grade,
			input.target.subject,
			input.target.language,
		);
	const merged = mergeExams(course, parsed.set, input.choice);
	const exists = targetCourse(input.model, input.target) !== null;
	const next: CurriculumModel = {
		...input.model,
		courses: exists
			? input.model.courses.map((entry) =>
					sameCourse(entry, course) ? merged : entry,
				)
			: [...input.model.courses, merged],
	};
	const written = writeModel(input.root, next);
	if (!written.ok) return written;
	const path = examFile(input.root, input.target);
	if (path === null) return failure("invalidName");
	if (input.choice.kind === "all") {
		rmSync(path, { force: true });
		return { ok: true, left: 0 };
	}
	const accepted = [
		...new Set([
			...stored.accepted,
			paperAcceptKey(input.choice.exam, input.choice.paper),
		]),
	];
	const left = paperKeys(parsed.set).filter(
		(key) => !accepted.includes(key),
	).length;
	if (left === 0) {
		rmSync(path, { force: true });
		return { ok: true, left };
	}
	const kept = saveExamStored(input.root, input.target, {
		...stored,
		accepted,
	});
	return kept.ok ? { ok: true, left } : kept;
}

/**
 * Applies one safe fix the review offers to a pending exam change set: the number the warning
 * named is set, or the field it named is removed. The set is checked again after, so a fix can
 * never leave a set the review would refuse.
 */
export function fixExamChange(input: {
	root: string;
	model: CurriculumModel;
	files: readonly FileRow[];
	target: ExamTarget;
	/** The field within the stored set, e.g. "exams[0].papers[0].parts[0].questions.count". */
	path: string;
	/** The number to set, or null to remove the field. */
	value: number | null;
}): Failure | { ok: true } {
	const stored = readExamStored(input.root, input.target);
	if (stored === null || stored.state !== "pending" || stored.kind !== "exams")
		return failure("missing", "no exam change set to fix");
	const fixed = applyExamFix(stored.set, input.path, input.value);
	if (fixed === null)
		return failure(
			"refused",
			`no such field in this exam change set: ${input.path}`,
		);
	const parsed = parseExamChangeSet(
		fixed,
		examGivenFor(input.model, input.files, input.target),
	);
	if (!parsed.ok) return failure("refused", parsed.issue);
	return saveExamStored(input.root, input.target, {
		...stored,
		set: fixed,
	});
}

/** Keeps a rejected exam change set for reference until the author deletes it. */
export function rejectExamChange(
	root: string,
	target: ExamTarget,
): Failure | { ok: true } {
	const stored = readExamStored(root, target);
	if (stored === null) return failure("missing");
	return saveExamStored(root, target, {
		...stored,
		state: "rejected",
	});
}

/** Deletes an exam change set's file, rejected or not. */
export function deleteExamChange(
	root: string,
	target: ExamTarget,
): Failure | { ok: true } {
	const path = examFile(root, target);
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
		const course =
			targetCourse(input.model, target) ??
			emptyCourse(target.grade, target.subject, target.language);
		const folder = changeName(target);
		if (folder === null) return [];
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
			const target = targetOf(
				course.grade,
				course.subject,
				course.language,
				course.period,
			);
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
