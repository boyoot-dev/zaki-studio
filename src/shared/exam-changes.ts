// An exam change set from the notes (task 177): the course's whole proposed `exams`, checked
// with the bundle's own exam parser, with the register files each part was read from. Pure and
// tested: the requests and the files on disk are in src/main.
//
// The check has two halves. The exams themselves go through parseCourseExams, so a writing task
// whose answer length is backwards, or a part with no name, is refused with its own path. The
// sources are checked against the register here: every part needs at least one, and every file
// must be an exam paper or a mark scheme of this very course. The review pairs today's exams
// with the proposal and names every field that changed; the merge only replaces the papers the
// author accepted, and leaves every other paper as it was.

import type { ChangeRefusal } from "./changes.ts";
import { textList } from "./changes.ts";
import {
	BUNDLE_LIMITS,
	type BundleExam,
	type BundlePaper,
	type BundlePart,
	type BundlePeriod,
	EXAM_LAYOUTS,
	EXAM_MATERIAL_KINDS,
	EXAM_QUESTION_TYPES,
	EXAM_SKILLS,
	EXAM_TOPICS,
	examPeriodIssues,
	parseCourseExams,
} from "./format/bundle.ts";
import { newId } from "./ids.ts";
import type { FileRow, ModelCourse } from "./model.ts";

/**
 * A proposal's exams with ids written in (task 224): a model writes no exam or paper ids, so
 * an exam keeps the id of today's exam with the same period and name, a paper the id of that
 * exam's paper with the same name, and anything new gets a new id. Parts are left alone: the
 * model writes each part's id, because its sources are named by it, and a part without one
 * is refused. Works on the raw JSON, before it is parsed.
 */
export function fillExamIds(raw: unknown, now: readonly BundleExam[]): void {
	if (!Array.isArray(raw)) return;
	const isObject = (value: unknown): value is Record<string, unknown> =>
		typeof value === "object" && value !== null && !Array.isArray(value);
	for (const exam of raw) {
		if (!isObject(exam)) continue;
		const old = now.find(
			(entry) =>
				entry.name === exam.name && (entry.period ?? undefined) === exam.period,
		);
		if (typeof exam.id !== "string") exam.id = old?.id ?? newId();
		if (!Array.isArray(exam.papers)) continue;
		for (const paper of exam.papers) {
			if (!isObject(paper)) continue;
			const oldPaper = old?.papers.find((entry) => entry.name === paper.name);
			if (typeof paper.id !== "string") paper.id = oldPaper?.id ?? newId();
		}
	}
}

/** One course an exam change set is for. An exam covers the whole course, not one period. */
export type ExamTarget = { grade: number; subject: string };

/** Everything an exam change set is checked against: the register and the course as it is now. */
export type ExamGiven = {
	target: ExamTarget;
	/** Every period id of the year, so an exam's period must be one of them. */
	periods: readonly string[];
	/** The course's exams as the model has them now. */
	exams: readonly BundleExam[];
	/** The register rows, so a source names a known file of this course. */
	files: readonly FileRow[];
};

/** An exam change set that passed every check, ready to review and to merge. */
export type CleanExamSet = {
	grade: number;
	subject: string;
	exams: BundleExam[];
	/** Part id → the register file ids it was read from. Every part has at least one. */
	sources: Record<string, string[]>;
	open: string[];
};

/** What parsing gave: the clean set and the open questions it refused, or why the set failed. */
export type ExamParseOutcome =
	| { ok: true; set: CleanExamSet; refused: ChangeRefusal[] }
	| { ok: false; issue: string; refused: ChangeRefusal[] };

/** One allowed list as the JSON shape writes it: `"talk" | "dialogue"`. */
function oneOf(values: readonly string[]): string {
	return values.map((value) => `"${value}"`).join(" | ");
}

/** The same values as a plain list, for the lines that say what a field may hold. */
function anyOf(values: readonly string[]): string {
	return values.join(", ");
}

/**
 * The JSON shape every answer must have, in the user content and the job's README. Every allowed
 * value is read from the bundle's own constants, so the format can never name a value the parser
 * refuses, or forget one it takes (task 182).
 */
export const EXAM_FORMAT = `{
  "grade": <number>, "subject": "<id>",
  "exams": [
    { "period": "<id>", "name": "<text>",
      "papers": [
        { "name": "<text>",
          "skill": ${oneOf(EXAM_SKILLS)},
          "language": "<two-letter language code, only when not the course's own>",
          "minutes": <number>, "marks": <number>,
          "parts": [
            { "id": "<lowercase id>", "name": "<text>",
              "nameEn": "<text>", "instruction": "<text>",
              "instructionEn": "<text>",
              "marks": <number>, "minutes": <number>,
              "material": { "kind": "<kind>", "description": "<text>",
                "words": [<shortest>, <longest>], "speakers": <number>,
                "topic": ${oneOf(EXAM_TOPICS)},
                "layout": ["<layout>"],
                "timing": { "readingSeconds": <number>, "plays": <number>,
                  "repeat": "segment" | "whole", "pauseSeconds": <number>,
                  "checkSeconds": <number> } },
              "questions": { "count": <number>, "types": { "<type>": <count> },
                "choiceOptions": 3 | 4, "maxWords": <number>,
                "answerWords": [<shortest>, <longest>],
                "marksEach": <marks>, "marksByType": { "<type>": <marks> },
                "totalMarks": <marks>, "example": true | false,
                "copiedExactly": true | false },
              "notes": "<text>", "marking": "<text>" } ] } ] } ],
  "sources": { "<part id>": ["<file id>"] },
  "open": ["<text>"]
}

"kind" is one of: ${anyOf(EXAM_MATERIAL_KINDS)}. "none" is a part with no text to read or hear, such as a writing task or a set of maths questions; "other" needs a "description" that says what it is.

"layout" is any of: ${anyOf(EXAM_LAYOUTS)}, in a short list, and a part with no layout leaves it out.

A question type in "types" and "marksByType" is one of: ${anyOf(EXAM_QUESTION_TYPES)}. A question that doesn't fit goes under "other".`;

/** How to read the shape above: the fields the parser always needs, and the optional ones the
 * notes may not give. An absent field is left out, never written as null. */
export const EXAM_FORMAT_NOTE =
	'The required fields are always written: "grade", "subject" and "exams" (one or more, each with "name" and one or more "papers"); every paper\'s "name", "skill" and one or more "parts"; each part\'s "id", "name", "material" and "questions"; "material.kind" and "questions.count" with "questions.types". Leave out an optional field the notes do not give; never write null. When the notes give no number a required field needs, write "material": { "kind": "none" } for a part with no text to read or hear, and put the whole count on one type in "types" (or on "other") when the split is not given. Every part names its files in "sources". An exam that covers the whole year leaves out "period".';

/** Every period id of the year, at any depth, as a set. */
export function periodIds(periods: readonly BundlePeriod[]): Set<string> {
	const found = new Set<string>();
	const walk = (list: readonly BundlePeriod[]) => {
		for (const period of list) {
			found.add(period.id);
			walk(period.periods);
		}
	};
	walk(periods);
	return found;
}

/**
 * The year's periods as the prompt and the README list them: `id (English name)`, nested
 * periods included and in the curriculum's order (task 182).
 */
export function examPeriodList(periods: readonly BundlePeriod[]): string {
	const out: string[] = [];
	const walk = (list: readonly BundlePeriod[]) => {
		for (const period of list) {
			out.push(`${period.id} (${period.nameEn})`);
			walk(period.periods);
		}
	};
	walk(periods);
	return out.join(", ");
}

/** The course's exams as the model gets them: grade, subject and the exams as they are now. */
export function examCourseNow(course: {
	grade: number;
	subject: string;
	exams: readonly BundleExam[];
}): { grade: number; subject: string; exams: BundleExam[] } {
	return {
		grade: course.grade,
		subject: course.subject,
		exams: course.exams.map((exam) => ({
			...exam,
			papers: exam.papers.map((paper) => ({
				...paper,
				parts: paper.parts.map((part) => ({ ...part })),
			})),
		})),
	};
}

/** The course as JSON, tabs and a last newline, for a job folder's course.json. */
export function examCourseJson(course: {
	grade: number;
	subject: string;
	exams: readonly BundleExam[];
}): string {
	return `${JSON.stringify(examCourseNow(course), null, "\t")}\n`;
}

/** The name an exam change set's file and job folder take: "9-arabic". */
export function examName(grade: number, subject: string): string | null {
	if (!Number.isInteger(grade) || grade < -1 || grade > 12) return null;
	if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(subject)) return null;
	return `${grade}-${subject}`;
}

/** The target an exam change set is for, from the values a payload carries, or null. */
export function examTargetOf(
	grade: unknown,
	subject: unknown,
): ExamTarget | null {
	if (typeof grade !== "number" || !Number.isInteger(grade)) return null;
	if (typeof subject !== "string") return null;
	return examName(grade, subject) === null ? null : { grade, subject };
}

/**
 * An exam change set as the model wrote it, or why it is not one. The exams go through the
 * bundle's own parser, which allows `answerWords`. Every part must name at
 * least one register file of this course, and the files must be exam papers or mark schemes.
 */
export function parseExamChangeSet(
	value: unknown,
	given: ExamGiven,
): ExamParseOutcome {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return {
			ok: false,
			issue: "expected one JSON object",
			refused: [],
		};
	const raw = value as Record<string, unknown>;
	if (raw.grade !== given.target.grade)
		return {
			ok: false,
			issue: `the exam change set is not for Grade ${given.target.grade}`,
			refused: [],
		};
	if (raw.subject !== given.target.subject)
		return {
			ok: false,
			issue: `the exam change set is not for ${given.target.subject}`,
			refused: [],
		};
	if (!Array.isArray(raw.exams) || raw.exams.length === 0)
		return { ok: false, issue: "the change set has no exams", refused: [] };

	const exams = structuredClone(raw.exams);
	fillExamIds(exams, given.exams);
	const parsed = parseCourseExams(exams, "exams");
	if (parsed.issues.length > 0) {
		const refused = parsed.issues.map((issue) => ({
			path: issue.path,
			message: issue.message,
		}));
		return {
			ok: false,
			issue: `${refused[0]?.path}: ${refused[0]?.message}`,
			refused,
		};
	}
	const unknownPeriod = examPeriodIssues(
		parsed.exams,
		new Set(given.periods),
		"exams",
	);
	if (unknownPeriod.length > 0) {
		const refused = unknownPeriod.map((issue) => ({
			path: issue.path,
			message: issue.message,
		}));
		return {
			ok: false,
			issue: `${refused[0]?.path}: ${refused[0]?.message}`,
			refused,
		};
	}

	const refused: ChangeRefusal[] = [];
	const add = (path: string, message: string) =>
		refused.push({ path, message });
	const sources = parseSources(raw.sources, parsed.exams, given, add);
	if (refused.length > 0)
		return {
			ok: false,
			issue: `${refused[0]?.path}: ${refused[0]?.message}`,
			refused,
		};
	const open = textList(raw.open, "open", BUNDLE_LIMITS.listChars, add);
	return {
		ok: true,
		set: {
			grade: given.target.grade,
			subject: given.target.subject,
			exams: parsed.exams,
			sources,
			open,
		},
		refused,
	};
}

/** Every part's source files, or the refusals that keep the set from being saved. */
function parseSources(
	value: unknown,
	exams: readonly BundleExam[],
	given: ExamGiven,
	add: (path: string, message: string) => void,
): Record<string, string[]> {
	const raw =
		typeof value === "object" && value !== null && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	if (
		value !== undefined &&
		(typeof value !== "object" || value === null || Array.isArray(value))
	) {
		add("sources", "expected an object of part id → file ids");
		return {};
	}
	const out: Record<string, string[]> = {};
	const known = new Set<string>();
	for (const [i, exam] of exams.entries()) {
		for (const [j, paper] of exam.papers.entries()) {
			for (const [k, part] of paper.parts.entries()) {
				const where = `exams[${i}].papers[${j}].parts[${k}]`;
				if (known.has(part.id)) {
					add(`${where}.id`, `part id "${part.id}" is used twice`);
					continue;
				}
				known.add(part.id);
				const list = raw[part.id];
				if (!Array.isArray(list) || list.length === 0) {
					add(`sources.${part.id}`, "a part needs the files it came from");
					continue;
				}
				const files: string[] = [];
				for (const [n, entry] of list.entries()) {
					const at = `sources.${part.id}[${n}]`;
					if (typeof entry !== "string") {
						add(at, "expected a file id");
						continue;
					}
					const row = given.files.find(
						(file) =>
							file.id === entry &&
							file.grade === given.target.grade &&
							file.subject === given.target.subject,
					);
					if (row === undefined) {
						add(at, `"${entry}" is not a file of this course`);
						continue;
					}
					if (row.kind !== "exam" && row.kind !== "mark-scheme") {
						add(
							at,
							`"${entry}" is a ${row.kind}, not an exam paper or a mark scheme`,
						);
						continue;
					}
					if (!files.includes(entry)) files.push(entry);
				}
				if (files.length > 0) out[part.id] = files;
			}
		}
	}
	for (const key of Object.keys(raw)) {
		if (known.has(key)) continue;
		add(`sources.${key}`, "there is no such part in this set");
	}
	return out;
}

/** One field the review shows as changed, with both sides as text. */
export type ExamFieldChange = { field: string; from: string; to: string };

/** What the review says about one side of a part: added, removed, changed or the same. */
export type ExamState = "added" | "removed" | "changed" | "same";

/** One part as the review shows it: today's, the proposal's, and the fields that differ. */
export type ReviewPart = {
	key: string;
	state: ExamState;
	now: BundlePart | null;
	proposed: BundlePart | null;
	/** The register files the proposal says the part came from. */
	sources: string[];
	fields: ExamFieldChange[];
	/** The same changes as sentences: "minutes 70 → 75". */
	changes: string[];
};

/** One paper as the review shows it, with its parts in order. */
export type ReviewPaper = {
	name: string;
	state: ExamState;
	now: BundlePaper | null;
	proposed: BundlePaper | null;
	fields: ExamFieldChange[];
	changes: string[];
	parts: ReviewPart[];
};

/** One exam as the review shows it, with its papers in order. */
export type ReviewExam = {
	/** The period, or null for an exam covering the whole year. */
	period: string | null;
	name: string;
	state: ExamState;
	now: BundleExam | null;
	proposed: BundleExam | null;
	fields: ExamFieldChange[];
	changes: string[];
	papers: ReviewPaper[];
};

/** The set paired with the course as it is now, for the review's side by side. */
export function reviewExams(
	now: readonly BundleExam[] | { exams: readonly BundleExam[] },
	proposed: CleanExamSet,
): ReviewExam[] {
	const currentExams: readonly BundleExam[] = Array.isArray(now)
		? (now as readonly BundleExam[])
		: (now as { exams: readonly BundleExam[] }).exams;
	const seen = new Set<number>();
	const out: ReviewExam[] = [];
	for (const exam of proposed.exams) {
		const found = currentExams.findIndex(
			(entry) => entry.period === exam.period && entry.name === exam.name,
		);
		if (found !== -1) seen.add(found);
		const current = found === -1 ? null : (currentExams[found] ?? null);
		const fields = examFields(current, exam);
		out.push({
			period: exam.period,
			name: exam.name,
			state: stateOf(current, exam, fields),
			now: current,
			proposed: exam,
			fields,
			changes: sentences(fields),
			papers: reviewPapers(
				current?.papers ?? [],
				exam.papers,
				proposed.sources,
			),
		});
	}
	for (const [i, exam] of currentExams.entries()) {
		if (seen.has(i)) continue;
		const fields = examFields(exam, null);
		out.push({
			period: exam.period,
			name: exam.name,
			state: "removed",
			now: exam,
			proposed: null,
			fields,
			changes: sentences(fields),
			papers: reviewPapers(exam.papers, [], {}),
		});
	}
	return out;
}

/** Papers matched by name, then by position; parts by id, then by position. */
function reviewPapers(
	now: readonly BundlePaper[],
	proposed: readonly BundlePaper[],
	sources: Record<string, string[]>,
): ReviewPaper[] {
	const seen = new Set<number>();
	const out: ReviewPaper[] = [];
	for (const paper of proposed) {
		const found = now.findIndex((entry) => entry.name === paper.name);
		if (found !== -1) seen.add(found);
		const current = found === -1 ? null : (now[found] ?? null);
		const fields = paperFields(current, paper);
		out.push({
			name: paper.name,
			state: stateOf(current, paper, fields),
			now: current,
			proposed: paper,
			fields,
			changes: sentences(fields),
			parts: reviewParts(current?.parts ?? [], paper.parts, sources),
		});
	}
	for (const [i, paper] of now.entries()) {
		if (seen.has(i)) continue;
		const fields = paperFields(paper, null);
		out.push({
			name: paper.name,
			state: "removed",
			now: paper,
			proposed: null,
			fields,
			changes: sentences(fields),
			parts: reviewParts(paper.parts, [], {}),
		});
	}
	return out;
}

/** The parts of one paper: a part with an id is matched by it, and a part without one by its
 * place in the paper. */
function reviewParts(
	now: readonly BundlePart[],
	proposed: readonly BundlePart[],
	sources: Record<string, string[]>,
): ReviewPart[] {
	const seen = new Set<number>();
	const out: ReviewPart[] = [];
	for (const [i, part] of proposed.entries()) {
		let found = -1;
		if (part.id !== null)
			found = now.findIndex((entry) => entry.id === part.id);
		if (found === -1) {
			const placed = now[i];
			if (placed !== undefined && placed.id === null) found = i;
		}
		if (found !== -1) seen.add(found);
		const current = found === -1 ? null : (now[found] ?? null);
		const fields = partFields(current, part);
		out.push({
			key: part.id ?? `part-${i + 1}`,
			state: stateOf(current, part, fields),
			now: current,
			proposed: part,
			sources: sources[part.id] ?? [],
			fields,
			changes: sentences(fields),
		});
	}
	for (const [i, part] of now.entries()) {
		if (seen.has(i)) continue;
		const fields = partFields(part, null);
		out.push({
			key: part.id ?? `part-${i + 1}`,
			state: "removed",
			now: part,
			proposed: null,
			sources: [],
			fields,
			changes: sentences(fields),
		});
	}
	return out;
}

/** Whether a side is new, gone, changed, or the same. */
function stateOf(
	now: unknown | null,
	proposed: unknown | null,
	fields: readonly ExamFieldChange[],
): ExamState {
	if (now === null) return "added";
	if (proposed === null) return "removed";
	return fields.length === 0 ? "same" : "changed";
}

/** The exam's own fields that differ: its name and its period. */
function examFields(
	now: BundleExam | null,
	proposed: BundleExam | null,
): ExamFieldChange[] {
	return compare(now, proposed, [
		["period", (exam) => exam.period],
		["name", (exam) => exam.name],
	]);
}

/** The paper's own fields that differ. */
function paperFields(
	now: BundlePaper | null,
	proposed: BundlePaper | null,
): ExamFieldChange[] {
	return compare(now, proposed, [
		["name", (paper) => paper.name],
		["skill", (paper) => paper.skill],
		["language", (paper) => paper.language],
		["minutes", (paper) => paper.minutes],
		["marks", (paper) => paper.marks],
	]);
}

/** Every part field the review can name, in the order the format lists them. */
function partFields(
	now: BundlePart | null,
	proposed: BundlePart | null,
): ExamFieldChange[] {
	return compare(now, proposed, [
		["id", (part) => part.id],
		["name", (part) => part.name],
		["nameEn", (part) => part.nameEn],
		["instruction", (part) => part.instruction],
		["instructionEn", (part) => part.instructionEn],
		["marks", (part) => part.marks],
		["minutes", (part) => part.minutes],
		["kind", (part) => part.material.kind],
		["description", (part) => part.material.description],
		["words", (part) => part.material.words],
		["speakers", (part) => part.material.speakers],
		["topic", (part) => part.material.topic],
		["layout", (part) => part.material.layout],
		["timing", (part) => part.material.timing],
		["count", (part) => part.questions.count],
		["types", (part) => part.questions.types],
		["choiceOptions", (part) => part.questions.choiceOptions],
		["maxWords", (part) => part.questions.maxWords],
		["answerWords", (part) => part.questions.answerWords],
		["marksEach", (part) => part.questions.marksEach],
		["marksByType", (part) => part.questions.marksByType],
		["totalMarks", (part) => part.questions.totalMarks],
		["example", (part) => part.questions.example],
		["copiedExactly", (part) => part.questions.copiedExactly],
		["notes", (part) => part.notes],
		["marking", (part) => part.marking],
	]);
}

/** One set of field readers, compared on both sides; absent fields are left out. */
function compare<T>(
	now: T | null,
	proposed: T | null,
	readers: readonly [string, (value: T) => unknown][],
): ExamFieldChange[] {
	if (now === null || proposed === null) return [];
	const out: ExamFieldChange[] = [];
	for (const [field, read] of readers) {
		const before = read(now);
		const after = read(proposed);
		if (same(before, after)) continue;
		out.push({ field, from: show(before), to: show(after) });
	}
	return out;
}

/** True when two JSON values are the same, including the order of a short list. */
function same(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** A field's value as the review writes it: "—" when absent, "300–400" for a pair. */
function show(value: unknown): string {
	if (value === null || value === undefined || value === "") return "—";
	if (Array.isArray(value)) {
		if (value.every((entry) => typeof entry === "number"))
			return value.join("–");
		if (value.every((entry) => typeof entry === "string"))
			return value.join(", ");
	}
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

/** The changes as sentences the page can list, e.g. "minutes 70 → 75". */
function sentences(fields: readonly ExamFieldChange[]): string[] {
	return fields.map((field) => `${field.field} ${field.from} → ${field.to}`);
}

/** A choice the review makes on an exam change set. */
export type ExamChoice =
	| { kind: "all" }
	| { kind: "paper"; exam: number; paper: number };

/** The key a paper choice is recorded by: "0.1" for the first exam's second paper. */
export function paperAcceptKey(exam: number, paper: number): string {
	return `${exam}.${paper}`;
}

/** Every paper's key, in the proposal's order, for counting what is left to accept. */
export function paperKeys(set: CleanExamSet): string[] {
	return set.exams.flatMap((exam, i) =>
		exam.papers.map((_paper, j) => paperAcceptKey(i, j)),
	);
}

/**
 * The course with one choice of an exam change set merged in. An accepted paper replaces the
 * paper of the same name; every paper the author did not touch stays exactly as it was.
 */
export function mergeExams(
	course: ModelCourse,
	set: CleanExamSet,
	choice: ExamChoice,
): ModelCourse {
	const next = course.exams.map(copyExam);
	/** True when this paper is not the one the author chose. */
	const other = (exam: number, paper: number) =>
		choice.kind === "paper" && (choice.exam !== exam || choice.paper !== paper);
	for (const [i, proposed] of set.exams.entries()) {
		const at = next.findIndex(
			(exam) => exam.period === proposed.period && exam.name === proposed.name,
		);
		if (at === -1) {
			if (choice.kind === "paper" && choice.exam !== i) continue;
			const papers =
				choice.kind === "paper"
					? proposed.papers.filter((_paper, j) => !other(i, j))
					: proposed.papers;
			if (papers.length === 0) continue;
			next.push(copyExam({ ...proposed, papers }));
			continue;
		}
		const exam = next[at];
		if (exam === undefined) continue;
		const papers = [...exam.papers];
		for (const [j, paper] of proposed.papers.entries()) {
			if (choice.kind === "paper" && other(i, j)) continue;
			const found = papers.findIndex((entry) => entry.name === paper.name);
			if (found === -1) papers.push(copyPaper(paper));
			else papers[found] = copyPaper(paper);
		}
		next[at] = { ...exam, papers };
	}
	return { ...course, exams: next };
}

/** A deep-enough copy of one exam: replacing a paper never changes the course it came from. */
function copyExam(exam: BundleExam): BundleExam {
	return { ...exam, papers: exam.papers.map(copyPaper) };
}

/** A deep-enough copy of one paper. */
function copyPaper(paper: BundlePaper): BundlePaper {
	return { ...paper, parts: paper.parts.map((part) => ({ ...part })) };
}
