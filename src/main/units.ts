// One change set written with the author's key (task 158): the rules, the course as it is now
// and that period's notes in priority order, in one request per course and period. The rules
// are the system text; the notes and the course are user content only, so nothing a file says
// can become an instruction. A course the project has not got yet, or a block it has no unit
// in, is sent as an empty course (task 178), so the units come from the notes alone. The reply
// must be the change set's JSON, or it is a failure with the reason shown.
//
// Cost: one request reads a period's notes (a few thousand to a few tens of thousands of
// tokens) and writes a change set of facts. At the default model's prices ($3 / $15 per
// million on OpenRouter, 2026-11-13) a three-unit period is roughly 10 to 30 cents. The plan is
// shown before anything is sent, and the author's limit stops a request that would pass it.

import { basename } from "node:path";

import type { Failure } from "../shared/api.ts";
import type { CurriculumModel, FileRow } from "../shared/model.ts";
import { emptyCourse } from "../shared/model.ts";
import { cost } from "../shared/notes.ts";
import {
	changeEstimate,
	changeInput,
	notedRows,
	notesOrder,
	type Target,
	targetRows,
} from "../shared/targets.ts";
import { saveChangeSet, targetCourse } from "./changes.ts";
import { changeSystem } from "./changesystem.ts";
import { logUsage, noteIds, readNote } from "./notes.ts";
import { stamp, type UsageRow } from "./onenote.ts";
import {
	type AskNotes,
	askOpenRouter,
	modelInfo,
	NoteError,
} from "./openrouter.ts";

/** The rules plus that sentence: the whole system text, and nothing else. */
export function unitsSystem(rules: string): string {
	return changeSystem(rules);
}

/** What a change set would take before it is sent, and what it is likely to cost. */
export type ChangePlan = {
	model: string;
	/** True when OpenRouter's live list knows this model id. */
	found: boolean;
	priceIn: number | null;
	priceOut: number | null;
	units: number;
	lessons: number;
	/** The files of that period that have a note. */
	notes: number;
	in: number;
	out: number;
	/** US dollars, or null when the model's price is not known. */
	estimateUsd: number | null;
};

/** US dollars for tokens, rounded to four decimals, or null. */
export function usd(
	tokensIn: number,
	tokensOut: number,
	priceIn: number | null,
	priceOut: number | null,
): number | null {
	const amount = cost(tokensIn, tokensOut, priceIn, priceOut);
	return amount === null ? null : Math.round(amount * 10000) / 10000;
}

/** The notes of one course and period, in the rules' order and only where a note is kept. */
function periodNotes(
	root: string,
	rows: readonly FileRow[],
	target: Target,
): { id: string; text: string }[] {
	const noted = noteIds(root);
	const order = notesOrder(notedRows(targetRows(rows, target), noted));
	return order.flatMap((row) => {
		const text = readNote(root, row.id);
		return text === "" ? [] : [{ id: row.id, text }];
	});
}

/** The input one request carries: the first user line and the rest of the user content. */
function requestInput(
	root: string,
	model: CurriculumModel,
	target: Target,
	rows: readonly FileRow[],
): { first: string; text: string; notes: number } {
	// A course the project has not got yet, or a block it has no unit in, is an empty course:
	// the model writes that period's units from the notes alone (task 178).
	const course =
		targetCourse(model, target) ??
		emptyCourse(target.grade, target.subject, target.language);
	const notes = periodNotes(root, rows, target);
	return {
		...changeInput({
			curriculum: basename(root),
			course,
			period: target.period,
			notes,
		}),
		notes: notes.length,
	};
}

/** The units and lessons one proposal covers, for the cost estimate. */
function sizeOf(
	model: CurriculumModel,
	target: Target,
): {
	units: number;
	lessons: number;
} {
	const units =
		targetCourse(model, target)?.units.filter(
			(unit) => unit.period === target.period,
		) ?? [];
	return {
		units: units.length,
		lessons: units.reduce((total, unit) => total + unit.lessons.length, 0),
	};
}

/** What a change set of one period would take, priced at the model's live price. */
export async function planChangeSet(
	root: string,
	model: CurriculumModel,
	rows: readonly FileRow[],
	target: Target,
	rules: string,
	modelName: string,
	fetchImpl?: typeof fetch,
): Promise<ChangePlan> {
	const input = requestInput(root, model, target, rows);
	const size = sizeOf(model, target);
	const estimate = changeEstimate(
		unitsSystem(rules),
		input,
		size.units,
		size.lessons,
	);
	const info = await modelInfo(modelName, fetchImpl).catch(() => null);
	const priceIn = info?.priceIn ?? null;
	const priceOut = info?.priceOut ?? null;
	return {
		model: modelName,
		found: info !== null,
		priceIn,
		priceOut,
		units: size.units,
		lessons: size.lessons,
		notes: input.notes,
		in: estimate.in,
		out: estimate.out,
		estimateUsd: usd(estimate.in, estimate.out, priceIn, priceOut),
	};
}

/** Everything one change set's request needs, beyond the model and the register. */
export type WriteChangeInput = {
	root: string;
	model: CurriculumModel;
	rows: readonly FileRow[];
	target: Target;
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

/** What writing one change set gave: what was kept, and what it spent. */
export type ChangeWritten = { ok: true; spentUsd: number };

/** The change set's JSON from a reply: a code fence is allowed, prose is not. */
export function jsonOf(body: string): unknown | null {
	const text = body
		.trim()
		.replace(/^```(?:json)?\n/, "")
		.replace(/\n```$/, "")
		.trim();
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return null;
	}
}

/**
 * Writes one change set with the author's key: one request, tried once more when it fails, and
 * the reply kept only when it is a change set the project can review. It is saved for review,
 * never merged by itself.
 */
export async function writeChangeSet(
	input: WriteChangeInput,
): Promise<Failure | ChangeWritten> {
	const request = requestInput(
		input.root,
		input.model,
		input.target,
		input.rows,
	);
	const size = sizeOf(input.model, input.target);
	const plan = changeEstimate(
		unitsSystem(input.rules),
		request,
		size.units,
		size.lessons,
	);
	const estimate = usd(plan.in, plan.out, input.priceIn, input.priceOut);
	if (estimate !== null && estimate > input.limitUsd)
		return {
			ok: false,
			code: "limit",
			detail: `about $${estimate.toFixed(4)}`,
		};
	const ask = input.ask ?? ((note) => askOpenRouter(input.key, note));
	const system = unitsSystem(input.rules);
	let problem = "";
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const started = (input.now ?? (() => new Date()))();
		try {
			const answer = await ask({
				model: input.modelName,
				system,
				first: request.first,
				text: request.text,
				images: [],
			});
			const spent =
				answer.costUsd ??
				cost(answer.in, answer.out, input.priceIn, input.priceOut) ??
				0;
			const row: UsageRow = {
				time: stamp(started),
				id: `${input.target.grade}-${input.target.subject}-${input.target.period}`,
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
					detail: "the reply is not a change set's JSON",
				};
			const saved = saveChangeSet(
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
