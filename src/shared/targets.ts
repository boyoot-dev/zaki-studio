// One course and one period of a project, and what a change set is about (task 158): which
// register rows are that period's files, the order the rules give their notes, the course as
// it is now, the input the model gets, and the JSON shape of a change set. Pure and free of
// the app's bundle imports, so the units trial can build the very same job under plain Node
// (2026-11-13), as the notes trial does.
//
// A block period ("block-3") takes the files whose register block names it; any other period
// takes every readable file of the course, because the register has no other period.

import type { BundlePeriod } from "./format/bundle.ts";
import type { ModelCourse, ModelUnit } from "./model.ts";
import { estimateTokens, gradeText } from "./notes.ts";
import { OPEN_FORMAT } from "./open-questions.ts";
import { allIds, periodWithin, rowPeriodIds } from "./terms.ts";

/** The course and period a change set is for. */
export type Target = {
	grade: number;
	subject: string;
	/** The course's teaching language: with grade and subject, the course (task 224). */
	language: string;
	period: string;
};

/** A file's text and the day it was written, as the input names a note. */
export type TargetNote = { id: string; text: string };

/** The largest change set a job may hand back; a set of one course is far smaller. */
export const MAX_CHANGE_BYTES = 2 * 1024 * 1024;

/** The JSON shape every answer must have, in the user content and the job's README. */
export const CHANGE_FORMAT = `{
  "grade": <number>, "subject": "<id>", "period": "<id>",
  "units": [
    { "number": <number>, "title": "<text>", "source": "sheet" | "provisional",
      "keywords": ["<text>"], "evidence": ["<text>"],
      "lessons": [
        { "number": <number>, "title": "<text>",
          "activity": null | "reading" | "writing",
          "skills": [{ "code": <text> | null, "text": "<text>" }],
          "facts": [{ "text": "<text>", "sources": ["<id>#p<N>"] }] } ] } ],
  ${OPEN_FORMAT}
}`;

/** The kinds of page sources.py prefers, in its order: a main sheet before a worksheet. */
const KIND_ORDER: Record<string, number> = {
	book: 0,
	sheet: 0,
	revision: 1,
	worksheet: 2,
	homework: 2,
	other: 3,
	exam: 3,
	"mark-scheme": 4,
};

/** The block a period names, "block-3" → "3", or null for a period that is not a block. */
export function blockOf(period: string): string | null {
	const match = /^block-(\w{1,4})$/.exec(period);
	return match?.[1] ?? null;
}

/**
 * True when a register row is for this period: its block names the period or one under it
 * ("2&3" names block-2 and block-3; "t1-b2" is under "t1"). In a split year a row with no
 * period is for none (task 249). A period the year doesn't have, and that is not a block,
 * takes the whole course, as before.
 */
export function inBlock(
	row: { block: string },
	period: string,
	periods: readonly BundlePeriod[],
): boolean {
	if (!allIds(periods).has(period) && blockOf(period) === null) return true;
	return rowPeriodIds(row.block, periods).some((id) =>
		periodWithin(id, period, periods),
	);
}

/** The day a date names as one number, newest first; unknown dates last. */
function newer(date: string): number {
	const digits = date.replace(/\D/g, "");
	return digits === "" ? 0 : -Number(digits);
}

/**
 * The order the rules give notes: authority first (1 official … 4 third-party), then the
 * newer academic year and date, then the kind of file, then the path.
 */
export function notesOrder<
	T extends {
		authority: number | null;
		academicYear: string;
		published: string;
		kind: string;
		path: string;
	},
>(rows: readonly T[]): T[] {
	return [...rows].sort(
		(a, b) =>
			(a.authority ?? 9) - (b.authority ?? 9) ||
			newer(a.academicYear) - newer(b.academicYear) ||
			newer(a.published) - newer(b.published) ||
			(KIND_ORDER[a.kind] ?? 5) - (KIND_ORDER[b.kind] ?? 5) ||
			a.path.localeCompare(b.path),
	);
}

/** The readable files of one course and period: not a copy, no error, at least one page. */
export function targetRows<
	T extends {
		grade: number | null;
		subject: string;
		language: string;
		block: string;
		dupOf: string;
		error: string;
		pages: number | null;
	},
>(
	rows: readonly T[],
	target: Target,
	/** The year's periods, so a row's term folder or chosen term counts (task 249). */
	periods: readonly BundlePeriod[],
): T[] {
	return rows.filter(
		(row) =>
			row.grade === target.grade &&
			row.subject === target.subject &&
			row.language === target.language &&
			row.dupOf === "" &&
			row.error === "" &&
			(row.pages ?? 0) > 0 &&
			inBlock(row, target.period, periods),
	);
}

/** The rows of a target that have a note: the ones a change set is written from. */
export function notedRows<T extends { id: string }>(
	rows: readonly T[],
	noted: ReadonlySet<string>,
): T[] {
	return rows.filter((row) => noted.has(row.id));
}

/** A target as a name that is safe for a file and a folder: "7-science-en-block-3". */
export function changeName(target: Target): string | null {
	// -1 is KG1, 0 is KG2, then 1 to 12, as app/src/lib/grades.ts has them.
	if (!Number.isInteger(target.grade) || target.grade < -1 || target.grade > 12)
		return null;
	if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(target.subject)) return null;
	if (!/^[a-z]{2}$/.test(target.language)) return null;
	if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(target.period)) return null;
	return `${target.grade}-${target.subject}-${target.language}-${target.period}`;
}

/** The target a change set is for, from the values a payload carries, or null. */
export function targetOf(
	grade: unknown,
	subject: unknown,
	language: unknown,
	period: unknown,
): Target | null {
	if (typeof grade !== "number" || !Number.isInteger(grade)) return null;
	if (
		typeof subject !== "string" ||
		typeof language !== "string" ||
		typeof period !== "string"
	)
		return null;
	const target = { grade, subject, language, period };
	return changeName(target) === null ? null : target;
}

/** The units of one course that sit in `period`, in their numbered order. */
export function periodUnits(course: ModelCourse, period: string): ModelUnit[] {
	return course.units
		.filter((unit) => unit.period === period)
		.sort((a, b) => a.number - b.number);
}

/** The course as the model gets it: one period's units only, with each fact's `own` kept. */
export function courseNow(
	course: ModelCourse,
	period: string,
): {
	grade: number;
	subject: string;
	language: string;
	period: string;
	units: ModelUnit[];
} {
	return {
		grade: course.grade,
		subject: course.subject,
		language: course.language,
		period,
		units: periodUnits(course, period),
	};
}

/** The course as JSON, tabs and a last newline, as every file the Studio writes is. */
export function courseJson(course: ModelCourse, period: string): string {
	return `${JSON.stringify(courseNow(course, period), null, "\t")}\n`;
}

/** The lessons one period's units hold, for the cost estimate. */
export function lessonCount(course: ModelCourse, period: string): number {
	return periodUnits(course, period).reduce(
		(total, unit) => total + unit.lessons.length,
		0,
	);
}

/**
 * The first user line and the rest of the user content for one course and period: the JSON
 * shape, the course as it is now, and the notes in priority order. The rules are the system
 * text; nothing from a note is ever a system text.
 */
export function changeInput(input: {
	curriculum: string;
	course: ModelCourse;
	period: string;
	notes: readonly TargetNote[];
}): { first: string; text: string } {
	const { course, period } = input;
	const first = `This is the ${input.curriculum} curriculum, ${gradeText(course.grade)}, ${course.subject}, period ${period}. Write its change set.`;
	const notes =
		input.notes.length === 0
			? "No note is available for this period."
			: input.notes
					.map((note) => `## ${note.id}\n\n${note.text.trimEnd()}`)
					.join("\n\n");
	return {
		first,
		text: `Write one JSON object in exactly this shape:\n\n${CHANGE_FORMAT}\n\nThe course now (this period's units only; "own": true marks a fact the author wrote):\n\n${JSON.stringify(courseNow(course, period), null, "\t")}\n\nIts notes, highest priority first:\n\n${notes}`,
	};
}

/** What a change set of this size is expected to take, before it is sent. */
export function changeEstimate(
	system: string,
	input: { first: string; text: string },
	units: number,
	lessons: number,
): { in: number; out: number } {
	return {
		in: estimateTokens(`${system}${input.first}${input.text}`),
		// A change set carries facts, skills and titles; these are the notes.py trial's
		// order of magnitude for one unit and one lesson (2026-10-29), rounded up.
		out: units * 400 + lessons * 500,
	};
}

/** A choice the review makes on a change set. */
export type AcceptChoice =
	| { kind: "all" }
	| { kind: "unit"; unit: number }
	| { kind: "lesson"; unit: number; lesson: number };

/** The key a choice is recorded by: "5" for a unit, "5.1" for a lesson. */
export function acceptKey(choice: AcceptChoice): string {
	if (choice.kind === "unit") return String(choice.unit);
	if (choice.kind === "lesson") return `${choice.unit}.${choice.lesson}`;
	return "all";
}

/** A choice read back from its recorded key, or null when the key is not one. */
export function parseAcceptKey(key: string): AcceptChoice | null {
	if (key === "all") return { kind: "all" };
	const match = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(key);
	if (match?.[1] === undefined) return null;
	const unit = Number(match[1]);
	return match[2] === undefined
		? { kind: "unit", unit }
		: { kind: "lesson", unit, lesson: Number(match[2]) };
}
