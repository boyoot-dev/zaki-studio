// Building one course period with Claude or Gemini in the browser (task 245). The rounds live
// on disk, so the teacher can close the Studio and go on later: `.studio/rounds/<target>.json`
// holds the outline, the rounds and the answers so far, and each round's upload is a file in a
// job folder under `.studio/jobs/`. Every answer is checked before it is kept: the outline by
// its own parser, a unit by the change-set parser for that one unit. When the last unit is in,
// the answers are merged into one change set and saved for review like any other.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { parseChangeSet } from "../shared/changes.ts";
import { type Coverage, outlineGaps, textPages } from "../shared/coverage.ts";
import type { CurriculumModel, FileRow } from "../shared/model.ts";
import { emptyCourse } from "../shared/model.ts";
import {
	answerJson,
	mergeAnswers,
	type Outline,
	outlineMessage,
	pagesOf,
	parseOutline,
	roundsGuess,
	type UnitRound,
	unitMessage,
	unitRounds,
} from "../shared/rounds.ts";
import {
	CHANGE_FORMAT,
	changeName,
	courseJson,
	notesOrder,
	type Target,
	targetRows,
} from "../shared/targets.ts";
import { givenFor, saveChangeSet, targetCourse } from "./changes.ts";
import { safePath } from "./files.ts";
import { freeJobName, JOBS_DIR } from "./job.ts";
import { readTextFile } from "./model.ts";

/** Where the rounds of each course period are kept. */
export const ROUNDS_DIR = ".studio/rounds";

/** The rounds of one course period, as kept on disk. */
export type RoundsState = {
	target: Target;
	/** The job folder the uploads are written in. */
	job: string;
	outline: Outline | null;
	rounds: UnitRound[];
	/** The answers kept so far, one per unit round, in order. */
	answers: { unit: number; value: unknown }[];
	/** True once the merged change set was saved for review. */
	done: boolean;
	/** The text pages the outline put in no unit (task 250). */
	gaps?: Coverage;
};

/** What the page shows of the rounds: where the teacher is, and what to do now. */
export type RoundsView = {
	/** 1 for the outline, then one per unit round. */
	round: number;
	/** The rounds in all: a guess until the outline is in. */
	total: number;
	outlineDone: boolean;
	unit: { number: number; title: string; part: number; parts: number } | null;
	file: string;
	message: string;
	done: boolean;
	/** The text pages the outline put in no unit, once the outline is in (task 250). */
	gaps: Coverage | null;
};

/** The file a course period's rounds are kept in. */
function stateFile(root: string, target: Target): string | null {
	const name = changeName(target);
	return name === null ? null : safePath(root, `${ROUNDS_DIR}/${name}.json`);
}

/** The rounds kept for a course period, or null when none were started. */
export function readRounds(root: string, target: Target): RoundsState | null {
	const file = stateFile(root, target);
	if (file === null) return null;
	try {
		const value = JSON.parse(readFileSync(file, "utf8")) as RoundsState;
		return typeof value === "object" &&
			value !== null &&
			value.job !== undefined
			? value
			: null;
	} catch {
		return null;
	}
}

/** Keeps the rounds of a course period. */
function writeRounds(root: string, state: RoundsState): boolean {
	const file = stateFile(root, state.target);
	if (file === null) return false;
	try {
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, `${JSON.stringify(state, null, "\t")}\n`, "utf8");
		return true;
	} catch {
		return false;
	}
}

/** A file's text with its first line naming the file by id, as the messages say. */
function textWithId(root: string, row: FileRow): string {
	const text = readTextFile(root, row.id);
	return text.replace(/^# .*/, `# ${row.id} ${row.path}`);
}

/** The course period's files, in the rules' order. */
function periodRows(
	model: CurriculumModel,
	rows: readonly FileRow[],
	target: Target,
): FileRow[] {
	return notesOrder(targetRows(rows, target, model.curriculum.periods));
}

/** The upload file of one round, in the job folder. */
function roundFile(root: string, job: string, round: number): string | null {
	const name =
		round === 1
			? "round-01-outline.md"
			: `round-${String(round).padStart(2, "0")}-unit.md`;
	return safePath(root, `${JOBS_DIR}/${job}/${name}`);
}

/** The head every upload starts with: which course, period and language this is. */
function courseLine(target: Target): string {
	return `Course: grade ${target.grade}, subject "${target.subject}", language "${target.language}", period "${target.period}".`;
}

/** Writes one unit round's upload: the rules, the format, the course now and the pages. */
function writeUnitUpload(input: {
	root: string;
	model: CurriculumModel;
	rows: readonly FileRow[];
	state: RoundsState;
	index: number;
	unitRules: string;
}): boolean {
	const round = input.state.rounds[input.index];
	const file = roundFile(input.root, input.state.job, input.index + 2);
	if (round === undefined || file === null) return false;
	const target = input.state.target;
	const course =
		targetCourse(input.model, target) ??
		emptyCourse(target.grade, target.subject, target.language);
	const byId = new Map(input.rows.map((row) => [row.id, row]));
	const pages = round.pages
		.map((range) => {
			const row = byId.get(range.file);
			if (row === undefined) return "";
			const text = readTextFile(input.root, row.id);
			return `# ${row.id} ${row.path}\n\n${pagesOf(text, range.from, range.to)}`;
		})
		.filter((part) => part !== "")
		.join("\n\n");
	const body = `${courseLine(target)}

# rules.md

${input.unitRules.trim()}

# The change set's format

${CHANGE_FORMAT}

# The course as it is now (this period)

${courseJson(course, target.period)}

# The pages of Unit ${round.unit}

${pages}
`;
	try {
		writeFileSync(file, body, "utf8");
		return true;
	} catch {
		return false;
	}
}

/**
 * Starts the rounds of a course period: a job folder with round 1's upload (all the period's
 * files' text, with the rules), kept on disk. Starting again begins from the outline.
 */
export function startRounds(input: {
	root: string;
	model: CurriculumModel;
	rows: readonly FileRow[];
	target: Target;
	unitRules: string;
	now: Date;
}): RoundsState | null {
	const rows = periodRows(input.model, input.rows, input.target);
	if (rows.length === 0) return null;
	const job = freeJobName(input.root, input.now);
	if (job === null) return null;
	const file = roundFile(input.root, job, 1);
	if (file === null) return null;
	const texts = rows.map((row) => textWithId(input.root, row)).join("\n\n");
	try {
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(
			join(dirname(file), "job.json"),
			`${JSON.stringify({ name: job, kind: "rounds", tool: "other", ids: rows.map((row) => row.id) }, null, "\t")}\n`,
			"utf8",
		);
		writeFileSync(
			file,
			`${courseLine(input.target)}\n\n# rules.md\n\n${input.unitRules.trim()}\n\n# The course's files\n\n${texts}\n`,
			"utf8",
		);
	} catch {
		return null;
	}
	const state: RoundsState = {
		target: input.target,
		job,
		outline: null,
		rounds: [],
		answers: [],
		done: false,
	};
	return writeRounds(input.root, state) ? state : null;
}

/** What the page shows of a course period's rounds now. */
export function roundsView(
	root: string,
	state: RoundsState,
	pageCount: number,
): RoundsView {
	const outlineDone = state.outline !== null;
	const index = state.answers.length;
	const round = outlineDone ? index + 2 : 1;
	const unit = outlineDone ? state.rounds[index] : undefined;
	const total = outlineDone ? state.rounds.length + 1 : roundsGuess(pageCount);
	return {
		round: Math.min(round, total),
		total,
		outlineDone,
		unit:
			unit === undefined
				? null
				: {
						number: unit.unit,
						title: unit.title,
						part: unit.part,
						parts: unit.parts,
					},
		file: roundFile(root, state.job, round) ?? "",
		message: outlineDone
			? unit === undefined
				? ""
				: unitMessage(unit, state.target.language)
			: outlineMessage(state.target.language),
		done: state.done,
		gaps: state.gaps ?? null,
	};
}

/**
 * Checks a pasted answer for the round the course period is at, and keeps it when it passes.
 * The last unit's answer merges every answer into one change set and saves it for review.
 */
export function answerRound(input: {
	root: string;
	model: CurriculumModel;
	rows: readonly FileRow[];
	target: Target;
	text: string;
	unitRules: string;
	today: Date;
}): { ok: true; state: RoundsState } | { ok: false; issue: string } {
	const state = readRounds(input.root, input.target);
	if (state === null || state.done)
		return { ok: false, issue: "These rounds are not started." };
	const value = answerJson(input.text);
	if (value === null)
		return {
			ok: false,
			issue:
				"The answer has no JSON. Copy the whole answer from the chat, or ask the chat to answer with JSON only.",
		};
	const rows = periodRows(input.model, input.rows, input.target);

	if (state.outline === null) {
		const pages = new Map(rows.map((row) => [row.id, row.pages ?? 0]));
		const parsed = parseOutline(value, pages);
		if (!parsed.ok) return parsed;
		const texts = new Map(
			rows.map((row) => [row.id, readTextFile(input.root, row.id)]),
		);
		state.outline = parsed.outline;
		state.gaps = outlineGaps(
			rows.map((row) => ({
				id: row.id,
				path: row.path,
				pages: textPages(texts.get(row.id) ?? ""),
			})),
			parsed.outline.units,
		);
		state.rounds = unitRounds(
			parsed.outline,
			(range) =>
				pagesOf(texts.get(range.file) ?? "", range.from, range.to).length,
		);
		for (let index = 0; index < state.rounds.length; index += 1)
			if (
				!writeUnitUpload({
					root: input.root,
					model: input.model,
					rows,
					state,
					index,
					unitRules: input.unitRules,
				})
			)
				return {
					ok: false,
					issue: "The Studio could not write the next file.",
				};
		writeRounds(input.root, state);
		return { ok: true, state };
	}

	const round = state.rounds[state.answers.length];
	if (round === undefined) return { ok: false, issue: "Every round is done." };
	const given = givenFor(
		input.root,
		input.model,
		input.rows,
		input.target,
		true,
	);
	const parsed = parseChangeSet(value, given);
	if (!parsed.ok)
		return { ok: false, issue: `The answer was refused: ${parsed.issue}.` };
	if (!parsed.set.units.some((unit) => unit.number === round.unit))
		return {
			ok: false,
			issue: `The answer has no unit ${round.unit}. Ask the chat for unit ${round.unit} only.`,
		};
	state.answers.push({ unit: round.unit, value });
	if (state.answers.length === state.rounds.length) {
		const merged = mergeAnswers(input.target, state.answers);
		const saved = saveChangeSet(
			input.root,
			input.model,
			input.rows,
			input.target,
			merged,
			"job",
			"Claude or Gemini in the browser",
			input.today,
		);
		if (!saved.ok)
			return {
				ok: false,
				issue:
					"The units together did not pass the check. Start the rounds again.",
			};
		state.done = true;
	}
	writeRounds(input.root, state);
	return { ok: true, state };
}
