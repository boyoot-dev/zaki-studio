// The numbers an exam part states about the same thing (task 192): how many questions, of which
// kinds, what each is worth, and what the part, the paper and the papers add up to. The format
// checks every number on its own but not that they agree (standard §6.4.4, tasks 189–190), and
// the exam step sometimes writes numbers that don't. These are warnings, never refusals: the
// review shows each mismatch while the author can still fix it, and offers a fix only where one
// number plainly follows from the others. Pure and tested; the window's words are in
// src/shared/i18n.ts and the change set on disk is src/main/changes.ts.

import type {
	BundleExam,
	BundlePaper,
	BundlePart,
	BundleQuestions,
	ExamQuestionType,
} from "./format/bundle.ts";

/** Marks come in halves, so two sums count as equal within this. */
const TOLERANCE = 0.001;

/** Which check found a mismatch; the window has its own Arabic and English words for each. */
export type ExamNumberCode =
	| "count-types"
	| "total-each"
	| "total-by-type"
	| "part-total"
	| "paper-parts"
	| "choice-options"
	| "max-answer-words"
	| "both-mark-forms";

/** What one safe fix changes: a number set at `path`, or a field removed when `value` is null. */
export type ExamNumberFix = { path: string; value: number | null };

/** One number that doesn't add up, where it is, and the fix when one plainly follows. */
export type ExamNumberWarning = {
	/** Where it is in the exam, e.g. "papers[0].parts[1].questions". */
	path: string;
	code: ExamNumberCode;
	/** The plain English sentence, for the log and the tests; the window shows its own words. */
	message: string;
	/** The numbers the sentence names, for the window's own words. */
	vars: Record<string, number | string>;
	/** Changes only the number this warning names, when one plainly follows from the others. */
	fix?: ExamNumberFix;
};

/** True when a value is a number: an optional field that is absent is not. */
function isNumber(value: number | null | undefined): value is number {
	return typeof value === "number";
}

/** True when two numbers are the same up to the half-mark tolerance. */
function same(a: number, b: number): boolean {
	return Math.abs(a - b) < TOLERANCE;
}

/** The sum of a type map's counts, or null when it holds none. */
function typeSum(
	map: Partial<Record<ExamQuestionType, number>>,
): number | null {
	let sum = 0;
	let any = false;
	for (const value of Object.values(map)) {
		if (!isNumber(value)) continue;
		sum += value;
		any = true;
	}
	return any ? sum : null;
}

/**
 * What a part's questions are worth from their counts and per-type marks, or null when a type
 * has no count or no mark: the comparison needs every number present.
 */
function byTypeTotal(questions: BundleQuestions): number | null {
	if (questions.marksByType === null) return null;
	let sum = 0;
	let any = false;
	for (const [type, count] of Object.entries(questions.types)) {
		if (!isNumber(count)) continue;
		const marks = questions.marksByType[type as ExamQuestionType];
		if (!isNumber(marks)) return null;
		sum += count * marks;
		any = true;
	}
	return any ? sum : null;
}

/** The first type whose per-type mark differs from `marksEach`, or null when they agree. */
function firstDisagreement(questions: BundleQuestions): {
	type: ExamQuestionType;
	marks: number;
	each: number;
} | null {
	if (questions.marksByType === null || !isNumber(questions.marksEach))
		return null;
	for (const [type, count] of Object.entries(questions.types)) {
		if (!isNumber(count) || count === 0) continue;
		const marks = questions.marksByType[type as ExamQuestionType];
		if (!isNumber(marks) || same(marks, questions.marksEach)) continue;
		return { type: type as ExamQuestionType, marks, each: questions.marksEach };
	}
	return null;
}

/** One part's checks, under the part they belong to. */
function partWarnings(
	part: BundlePart,
	at: string,
	out: ExamNumberWarning[],
): void {
	const questions = part.questions;
	const questionsAt = `${at}.questions`;
	const sum = typeSum(questions.types);
	if (sum !== null && !same(questions.count, sum))
		out.push({
			path: questionsAt,
			code: "count-types",
			message: `count ${questions.count} is not the sum of types (${sum})`,
			vars: { count: questions.count, sum },
			fix: { path: `${questionsAt}.count`, value: sum },
		});
	if (
		isNumber(questions.marksEach) &&
		isNumber(questions.totalMarks) &&
		!same(questions.marksEach * questions.count, questions.totalMarks)
	)
		out.push({
			path: questionsAt,
			code: "total-each",
			message: `marksEach ${questions.marksEach} × ${questions.count} is not totalMarks ${questions.totalMarks}`,
			vars: {
				each: questions.marksEach,
				count: questions.count,
				total: questions.totalMarks,
			},
		});
	const byType = byTypeTotal(questions);
	if (
		byType !== null &&
		isNumber(questions.totalMarks) &&
		!same(byType, questions.totalMarks)
	)
		out.push({
			path: questionsAt,
			code: "total-by-type",
			message: `the types are worth ${byType}, not totalMarks ${questions.totalMarks}`,
			vars: { sum: byType, total: questions.totalMarks },
		});
	if (
		isNumber(part.marks) &&
		isNumber(questions.totalMarks) &&
		!same(part.marks, questions.totalMarks)
	)
		out.push({
			path: at,
			code: "part-total",
			message: `the part's marks ${part.marks} are not totalMarks ${questions.totalMarks}`,
			vars: { marks: part.marks, total: questions.totalMarks },
		});
	if (
		isNumber(questions.choiceOptions) &&
		questions.types.choice === undefined &&
		questions.types.multi === undefined
	)
		out.push({
			path: questionsAt,
			code: "choice-options",
			message: "choiceOptions is set but no question is choice or multi",
			vars: { options: questions.choiceOptions },
			fix: { path: `${questionsAt}.choiceOptions`, value: null },
		});
	if (
		isNumber(questions.maxWords) &&
		questions.answerWords !== null &&
		questions.maxWords < questions.answerWords[0]
	)
		out.push({
			path: questionsAt,
			code: "max-answer-words",
			message: `maxWords ${questions.maxWords} is under the shortest answer (${questions.answerWords[0]})`,
			vars: { max: questions.maxWords, shortest: questions.answerWords[0] },
		});
	const disagree = firstDisagreement(questions);
	if (disagree !== null)
		out.push({
			path: questionsAt,
			code: "both-mark-forms",
			message: `marksEach ${disagree.each} and marksByType ${disagree.type} ${disagree.marks} disagree`,
			vars: {
				each: disagree.each,
				type: disagree.type,
				marks: disagree.marks,
			},
		});
}

/** One paper's check: its marks against the sum of its parts, when every part has marks. */
function paperWarnings(
	paper: BundlePaper,
	at: string,
	out: ExamNumberWarning[],
): void {
	if (!isNumber(paper.marks)) return;
	let sum = 0;
	for (const part of paper.parts) {
		if (!isNumber(part.marks)) return;
		sum += part.marks;
	}
	if (same(paper.marks, sum)) return;
	out.push({
		path: at,
		code: "paper-parts",
		message: `the paper's marks ${paper.marks} are not the sum of its parts (${sum})`,
		vars: { marks: paper.marks, sum },
		fix: { path: `${at}.marks`, value: sum },
	});
}

/** Every number of one exam that doesn't add up, paper by paper and part by part. */
export function examNumberWarnings(exam: BundleExam): ExamNumberWarning[] {
	const out: ExamNumberWarning[] = [];
	for (const [i, paper] of exam.papers.entries()) {
		const at = `papers[${i}]`;
		paperWarnings(paper, at, out);
		for (const [j, part] of paper.parts.entries())
			partWarnings(part, `${at}.parts[${j}]`, out);
	}
	return out;
}

/** One course with accepted exams whose numbers don't add up, for the export's line. */
export type CourseNumberWarnings = {
	grade: number;
	subject: string;
	warnings: number;
};

/** Each course whose accepted exams have warnings, with how many, in the model's order. */
export function courseNumberWarnings(
	courses: readonly {
		grade: number;
		subject: string;
		exams: readonly BundleExam[];
	}[],
): CourseNumberWarnings[] {
	const out: CourseNumberWarnings[] = [];
	for (const course of courses) {
		let warnings = 0;
		for (const exam of course.exams)
			warnings += examNumberWarnings(exam).length;
		if (warnings > 0)
			out.push({
				grade: course.grade,
				subject: course.subject,
				warnings,
			});
	}
	return out;
}

/** A fix path as its steps: "papers[0].parts[1].questions" → key and list index pairs. */
const STEP = /^([A-Za-z][A-Za-z0-9]*)(?:\[(\d{1,3})\])?$/;

/** The steps of a fix path, or null when it is not one this module writes. */
function stepsOf(path: string): { key: string; index: number | null }[] | null {
	const out: { key: string; index: number | null }[] = [];
	for (const piece of path.split(".")) {
		const match = STEP.exec(piece);
		if (match === null) return null;
		out.push({
			key: match[1] ?? "",
			index: match[2] === undefined ? null : Number(match[2]),
		});
	}
	return out.length === 0 ? null : out;
}

/**
 * The exam change set with one fix applied: the number set at `path`, or the field under it
 * removed when `value` is null. Returns null when the path does not lead to a field or a list
 * item. The set is copied first, so a refused fix changes nothing.
 */
export function applyExamFix(
	set: unknown,
	path: string,
	value: number | null,
): unknown {
	if (typeof set !== "object" || set === null) return null;
	const route = stepsOf(path);
	if (route === null) return null;
	if (value !== null && !Number.isFinite(value)) return null;
	const copy: unknown = JSON.parse(JSON.stringify(set));
	let here: unknown = copy;
	for (const [i, step] of route.entries()) {
		if (typeof here !== "object" || here === null) return null;
		const object = here as Record<string, unknown>;
		const entry = object[step.key];
		const last = i === route.length - 1;
		if (step.index === null) {
			if (last) {
				// Only a number already there is set, so a path that names a text can't write one.
				if (value === null) delete object[step.key];
				else if (typeof entry === "number") object[step.key] = value;
				else return null;
				return copy;
			}
			here = entry;
			continue;
		}
		if (!Array.isArray(entry)) return null;
		const item = entry[step.index];
		if (item === undefined) return null;
		// A fix never replaces a whole exam, paper or part: it sets or removes a field.
		if (last) return null;
		here = item;
	}
	return null;
}
