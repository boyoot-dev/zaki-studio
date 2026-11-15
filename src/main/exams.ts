// One exam change set written with the author's key (task 177): the exam rules, the course's
// exams as they are now, and the notes of its exam papers and mark schemes in priority order,
// in one request per course. The rules are the system text; the notes and the course are user
// content only, so nothing a file says can become an instruction. A course the project has not
// got yet is sent empty (task 178), so its papers come from the notes alone. The reply must be
// the exam change set's JSON, or it is a failure with the reason shown.
//
// One request reads the newest three academic years' notes and writes a course's whole exams
// list. The plan is shown before anything is sent, and the author's limit stops a request that
// would pass it, through the same price and limit code as the units step.

import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import type { Failure } from "../shared/api.ts";
import type { ChangeRefusalCode } from "../shared/changes.ts";
import {
	EXAM_FORMAT,
	EXAM_FORMAT_NOTE,
	type ExamGiven,
	type ExamTarget,
	examCourseNow,
	examName,
	examPeriodList,
	examTargetOf,
	parseExamChangeSet,
	periodIds,
} from "../shared/exam-changes.ts";
import type { BundleExam, BundlePeriod } from "../shared/format/bundle.ts";
import { type JobTool, jobModel, validJobName } from "../shared/job.ts";
import type { CurriculumModel, FileRow, ModelCourse } from "../shared/model.ts";
import { emptyCourse } from "../shared/model.ts";
import { cost, estimateTokens, gradeText } from "../shared/notes.ts";
import { MAX_CHANGE_BYTES } from "../shared/targets.ts";
import { readExamStored, saveExamChangeSet, targetCourse } from "./changes.ts";
import { changeSystem } from "./changesystem.ts";
import { writeExamsFolder } from "./examfolder.ts";
import { safePath } from "./files.ts";
import { freeJobName, JOBS_DIR, jobRecord, realFolder } from "./job.ts";
import { logUsage, noteIds, readNote } from "./notes.ts";
import { stamp, type UsageRow } from "./onenote.ts";
import {
	type AskNotes,
	askOpenRouter,
	modelInfo,
	NoteError,
} from "./openrouter.ts";
import { jsonOf, usd } from "./units.ts";

/** The newest academic years an exams request reads. Older years are named and left out. */
export const EXAM_YEARS = 3;

/** The kinds of register file an exam change set is read from, in the order a year lists them. */
const KINDS = ["exam", "mark-scheme"];

/** One note as the request names it: its file, its academic year and its kind. */
export type ExamNote = {
	id: string;
	year: string;
	kind: string;
	text: string;
};

/** What one course's exam notes came to: the newest years, and the years left out. */
export type ExamNotes = {
	notes: ExamNote[];
	/** Academic years older than the newest EXAM_YEARS, newest first. */
	leftOut: string[];
};

/** The day a year names as one number, newest first; unknown years last. */
function yearRank(year: string): number {
	const digits = year.replace(/\D/g, "");
	return digits === "" ? 0 : Number(digits);
}

/** The academic year a file belongs to, or the register's own "current"/"old". */
function yearOf(row: FileRow): string {
	return row.academicYear === "" ? row.year : row.academicYear;
}

/** The newest EXAM_YEARS years a course's exam notes cover, and the older ones left out. */
export function examYears(
	rows: readonly FileRow[],
	target: ExamTarget,
	noted: ReadonlySet<string>,
): { kept: string[]; leftOut: string[] } {
	const years = [
		...new Set(
			examRows(rows, target)
				.filter((row) => noted.has(row.id))
				.map(yearOf),
		),
	].sort((a, b) => yearRank(b) - yearRank(a) || b.localeCompare(a));
	return {
		kept: years.slice(0, EXAM_YEARS),
		leftOut: years.slice(EXAM_YEARS),
	};
}

/** The course's exam papers and mark schemes: readable, not a copy, at least one page. */
export function examRows(
	rows: readonly FileRow[],
	target: ExamTarget,
): FileRow[] {
	return rows.filter(
		(row) =>
			row.grade === target.grade &&
			row.subject === target.subject &&
			row.dupOf === "" &&
			row.error === "" &&
			(row.pages ?? 0) > 0 &&
			KINDS.includes(row.kind),
	);
}

/**
 * The notes of one course's exam papers and mark schemes: the newest EXAM_YEARS academic years,
 * newest first and then by authority, with the question paper before its mark scheme. Older
 * years are returned by name so the request can say they were left out.
 */
export function examNotes(
	root: string,
	rows: readonly FileRow[],
	target: ExamTarget,
	noted: ReadonlySet<string> = noteIds(root),
): ExamNotes {
	const withNotes = examRows(rows, target).filter((row) => noted.has(row.id));
	const years = [...new Set(withNotes.map(yearOf))].sort(
		(a, b) => yearRank(b) - yearRank(a) || b.localeCompare(a),
	);
	const kept = new Set(years.slice(0, EXAM_YEARS));
	const leftOut = years.slice(EXAM_YEARS);
	const ordered = [...withNotes].sort(
		(a, b) =>
			yearRank(yearOf(b)) - yearRank(yearOf(a)) ||
			(a.authority ?? 9) - (b.authority ?? 9) ||
			KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) ||
			a.path.localeCompare(b.path),
	);
	const notes = ordered.flatMap((row) => {
		if (!kept.has(yearOf(row))) return [];
		const text = readNote(root, row.id);
		return text === ""
			? []
			: [
					{
						id: row.id,
						year: yearOf(row),
						kind: row.kind,
						text,
					},
				];
	});
	return { notes, leftOut };
}

/** The course as JSON, with its exams, for the request and the job folder. */
function courseJson(course: {
	grade: number;
	subject: string;
	exams: readonly BundleExam[];
}): string {
	return `${JSON.stringify(examCourseNow(course), null, "\t")}\n`;
}

/**
 * The first user line and the rest of the user content for one course: the JSON shape, the
 * exams as they are now, and the exam notes newest year first. The rules are the system text;
 * nothing from a note is ever a system text.
 */
export function examInput(input: {
	curriculum: string;
	course: {
		grade: number;
		subject: string;
		exams: readonly BundleExam[];
	};
	/** The year's periods, so the model names one of them instead of guessing (task 182). */
	periods: readonly BundlePeriod[];
	notes: readonly ExamNote[];
	leftOut: readonly string[];
}): { first: string; text: string } {
	const { course } = input;
	const first = `This is the ${input.curriculum} curriculum, ${gradeText(course.grade)}, ${course.subject}. Write its exam change set.`;
	const notes =
		input.notes.length === 0
			? "No exam note is available for this course."
			: input.notes
					.map(
						(note) =>
							`## ${note.id} (${note.year}, ${note.kind})\n\n${note.text.trimEnd()}`,
					)
					.join("\n\n");
	const leftOut =
		input.leftOut.length === 0
			? ""
			: `\n\nNotes from these older academic years are left out: ${input.leftOut.join(", ")}.`;
	return {
		first,
		text: `Write one JSON object in exactly this shape:\n\n${EXAM_FORMAT}\n\n${EXAM_FORMAT_NOTE}\n\nThe course's exams now:\n\n${courseJson(course)}\n\nThe curriculum's periods, by id (English name): ${examPeriodList(input.periods)}. An exam that covers the whole year leaves out "period".\n\nIts exam notes, newest academic year first:\n\n${notes}${leftOut}`,
	};
}

/** What an exam change set would take before it is sent, and what it is likely to cost. */
export type ExamPlan = {
	model: string;
	/** True when OpenRouter's live list knows this model id. */
	found: boolean;
	priceIn: number | null;
	priceOut: number | null;
	/** The exams and parts the course has now, for the reply's size. */
	exams: number;
	parts: number;
	/** The files whose notes the request carries. */
	notes: number;
	/** The academic years older than the newest three that were left out. */
	yearsLeftOut: string[];
	in: number;
	out: number;
	/** US dollars, or null when the model's price is not known. */
	estimateUsd: number | null;
};

/** The exams and parts of one course, counted for the cost estimate. */
function sizeOf(course: { exams: readonly BundleExam[] }): {
	exams: number;
	parts: number;
} {
	return {
		exams: course.exams.length,
		parts: course.exams.reduce(
			(total, exam) =>
				total +
				exam.papers.reduce((papers, paper) => papers + paper.parts.length, 0),
			0,
		),
	};
}

/** What an exam change set of one course is expected to take, before it is sent. */
export function examEstimate(
	system: string,
	input: { first: string; text: string },
	exams: number,
	parts: number,
): { in: number; out: number } {
	return {
		in: estimateTokens(`${system}${input.first}${input.text}`),
		// A change set carries papers, parts and their timings; these are the units trial's
		// order of magnitude for one unit and one lesson (2026-10-29), rounded up.
		out: exams * 400 + parts * 500,
	};
}

/** Everything one course's request carries. */
type ExamRequest = {
	course: ModelCourse;
	input: { first: string; text: string };
	notes: ExamNotes;
};

/** What a request for one course carries. A course the project has not got yet is empty, so
 * its papers come from the notes alone (task 178). */
function requestInput(
	root: string,
	model: CurriculumModel,
	rows: readonly FileRow[],
	target: ExamTarget,
): ExamRequest {
	const course =
		targetCourse(model, target) ?? emptyCourse(target.grade, target.subject);
	const notes = examNotes(root, rows, target);
	return {
		course,
		input: examInput({
			curriculum: basename(root),
			course,
			periods: model.curriculum.periods,
			notes: notes.notes,
			leftOut: notes.leftOut,
		}),
		notes,
	};
}

/** What an exam change set of one course would take, priced at the model's live price. */
export async function planExamSet(
	root: string,
	model: CurriculumModel,
	rows: readonly FileRow[],
	target: ExamTarget,
	rules: string,
	modelName: string,
	fetchImpl?: typeof fetch,
): Promise<ExamPlan> {
	const request = requestInput(root, model, rows, target);
	const size = sizeOf(request.course);
	const estimate = examEstimate(
		changeSystem(rules),
		request.input,
		size.exams,
		size.parts,
	);
	const info = await modelInfo(modelName, fetchImpl).catch(() => null);
	const priceIn = info?.priceIn ?? null;
	const priceOut = info?.priceOut ?? null;
	return {
		model: modelName,
		found: info !== null,
		priceIn,
		priceOut,
		exams: size.exams,
		parts: size.parts,
		notes: request.notes.notes.length,
		yearsLeftOut: request.notes.leftOut,
		in: estimate.in,
		out: estimate.out,
		estimateUsd: usd(estimate.in, estimate.out, priceIn, priceOut),
	};
}

/** Everything one exam change set's request needs, beyond the model and the register. */
export type WriteExamInput = {
	root: string;
	model: CurriculumModel;
	rows: readonly FileRow[];
	target: ExamTarget;
	rules: string;
	key: string;
	modelName: string;
	priceIn: number | null;
	priceOut: number | null;
	limitUsd: number;
	today: Date;
	/** A test passes its own; the app gets the real OpenRouter request. */
	ask?: AskNotes;
	now?: () => Date;
};

/** What writing one exam change set gave: what was kept, and what it spent. */
export type ExamWritten = { ok: true; spentUsd: number };

/**
 * Writes one exam change set with the author's key: one request, tried once more when it fails,
 * and the reply kept only when it is an exam change set the project can review. It is saved for
 * review, never merged by itself.
 */
export async function writeExamSet(
	input: WriteExamInput,
): Promise<Failure | ExamWritten> {
	const request = requestInput(
		input.root,
		input.model,
		input.rows,
		input.target,
	);
	const size = sizeOf(request.course);
	const plan = examEstimate(
		changeSystem(input.rules),
		request.input,
		size.exams,
		size.parts,
	);
	const estimate = usd(plan.in, plan.out, input.priceIn, input.priceOut);
	if (estimate !== null && estimate > input.limitUsd)
		return {
			ok: false,
			code: "limit",
			detail: `about $${estimate.toFixed(4)}`,
		};
	const ask = input.ask ?? ((note) => askOpenRouter(input.key, note));
	const system = changeSystem(input.rules);
	let problem = "";
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const started = (input.now ?? (() => new Date()))();
		try {
			const answer = await ask({
				model: input.modelName,
				system,
				first: request.input.first,
				text: request.input.text,
				images: [],
			});
			const spent =
				answer.costUsd ??
				cost(answer.in, answer.out, input.priceIn, input.priceOut) ??
				0;
			const row: UsageRow = {
				time: stamp(started),
				id: `${input.target.grade}-${input.target.subject}-exams`,
				model: input.modelName,
				part: 1,
				input: answer.in,
				output: answer.out,
				estimated: false,
				images: 0,
				seconds: Math.round((Date.now() - started.getTime()) / 1000),
				cost: spent,
			};
			logUsage(input.root, row);
			const value = jsonOf(answer.body);
			if (value === null)
				return {
					ok: false,
					code: "refused",
					detail: "the reply is not an exam change set's JSON",
				};
			const saved = saveExamChangeSet(
				input.root,
				input.model,
				input.rows,
				input.target,
				value,
				"key",
				input.modelName,
				input.today,
			);
			if (!saved.ok) return saved;
			return { ok: true, spentUsd: spent };
		} catch (error) {
			if (
				error instanceof NoteError &&
				(error.kind === "key" || error.kind === "credit")
			)
				return {
					ok: false,
					code: error.kind === "key" ? "noKey" : "noCredit",
				};
			problem = error instanceof Error ? error.message : String(error);
		}
	}
	return { ok: false, code: "refused", detail: problem.slice(0, 200) };
}

/** An exams job the Studio prepared, with the exact prompt to paste. */
export type ExamsJobMade = {
	ok: true;
	name: string;
	path: string;
	prompt: string;
	files: number;
};

/** What preparing an exams job needs. */
export type PrepareExamsInput = {
	root: string;
	model: CurriculumModel;
	rows: readonly FileRow[];
	targets: readonly ExamTarget[];
	curriculum: string;
	rules: string;
	tool: JobTool;
	now: Date;
	/** The files that have a note; the project's .studio/notes by default. */
	noted?: ReadonlySet<string>;
};

/**
 * Writes an exams job under .studio/jobs for the chosen courses: README.md, rules.md, one course
 * folder per course, and an empty out/. Only a course with at least one exam note is written.
 */
export function prepareExamsJob(
	input: PrepareExamsInput,
): ExamsJobMade | Failure {
	const noted = input.noted ?? noteIds(input.root);
	const courses = input.targets.flatMap((target) => {
		const course =
			targetCourse(input.model, target) ??
			emptyCourse(target.grade, target.subject);
		const folder = examName(target.grade, target.subject);
		if (folder === null) return [];
		const notes = examNotes(input.root, input.rows, target, noted).notes;
		return notes.length === 0 ? [] : [{ folder, course, notes }];
	});
	if (courses.length === 0)
		return { ok: false, code: "missing", detail: "no note for these courses" };
	const name = freeJobName(input.root, input.now);
	if (name === null) return { ok: false, code: "unreadable" };
	const folder = safePath(input.root, `${JOBS_DIR}/${name}`);
	if (folder === null) return { ok: false, code: "outside" };
	const written = writeExamsFolder({
		folder,
		curriculum: input.curriculum,
		rules: input.rules,
		tool: input.tool,
		now: input.now,
		periods: input.model.curriculum.periods,
		courses,
	});
	if (!written.ok) return { ok: false, code: written.code };
	return {
		ok: true,
		name: written.name,
		path: written.path,
		prompt: written.prompt,
		files: written.files,
	};
}

/** What collecting an exams job kept, skipped and refused. */
export type ExamsCollected = {
	collected: string[];
	skipped: string[];
	refused: { name: string; code: ChangeRefusalCode }[];
};

/** What collecting an exams job needs. */
export type CollectExamsInput = {
	root: string;
	model: CurriculumModel;
	files: readonly FileRow[];
	name: string;
	today: Date;
};

/**
 * Reads an exams job's out/ folder and keeps every exam change set that passes the checks. A
 * course that already has a pending set is skipped, so collecting twice writes nothing twice.
 */
export function collectExamsJob(
	input: CollectExamsInput,
): ExamsCollected | Failure {
	const name = validJobName(input.name);
	if (name === null) return { ok: false, code: "invalidName" };
	const folder = safePath(input.root, `${JOBS_DIR}/${name}`);
	if (folder === null) return { ok: false, code: "outside" };
	if (!existsSync(join(folder, "out"))) return { ok: false, code: "missing" };
	// The AI tool can write inside the job, so out/ (and the job itself) could be swapped for a
	// link or a junction that leads elsewhere; only real folders the Studio made are read.
	if (!realFolder(folder) || !realFolder(join(folder, "out")))
		return { ok: false, code: "unreadable" };
	const record = jobRecord(folder);
	if (record?.kind !== "exams") return { ok: false, code: "invalidName" };
	const folders = new Map(
		record.exams.flatMap((course) => {
			const target = examTargetOf(course.grade, course.subject);
			if (
				target === null ||
				examName(target.grade, target.subject) !== course.folder
			)
				return [];
			return [[course.folder, target] as const];
		}),
	);
	const outcome: ExamsCollected = { collected: [], skipped: [], refused: [] };
	let entries: string[] = [];
	try {
		entries = readdirSync(join(folder, "out")).sort();
	} catch {
		return { ok: false, code: "unreadable" };
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
		const folderName = /^(.+)\.json$/.exec(entry)?.[1];
		const target =
			folderName === undefined ? undefined : folders.get(folderName);
		if (folderName === undefined || target === undefined) {
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
		const course =
			targetCourse(input.model, target) ??
			emptyCourse(target.grade, target.subject);
		const given: ExamGiven = {
			target,
			periods: [...periodIds(input.model.curriculum.periods)],
			exams: course.exams,
			files: input.files,
		};
		const parsed = parseExamChangeSet(value, given);
		if (!parsed.ok) {
			outcome.refused.push({ name: entry, code: "invalid" });
			continue;
		}
		const existing = readExamStored(input.root, target.grade, target.subject);
		if (existing !== null && existing.state === "pending") {
			outcome.skipped.push(folderName);
			continue;
		}
		const saved = saveExamChangeSet(
			input.root,
			input.model,
			input.files,
			target,
			value,
			"job",
			jobModel(record.tool),
			input.today,
		);
		if (saved.ok) outcome.collected.push(folderName);
		else outcome.refused.push({ name: entry, code: "invalid" });
	}
	return outcome;
}
