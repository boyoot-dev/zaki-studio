// The open questions a change set leaves for the author (task 242). In the walkthrough of
// 2026-11-19 a units job gave 18 of them, in English for an Arabic course, naming files by id,
// and only one needed the teacher. Now each one says whether the author must decide, and points
// at its pages through `sources` instead of naming ids in the text. A plain string (a set from
// before, or a tool that writes one) still reads, as a question for information only.

import { BUNDLE_LIMITS, checkText } from "./format/bundle.ts";
import type { FileRow } from "./model.ts";
import { parseSource } from "./model.ts";

/** One open question: its text, whether the author must decide, and the pages it is about. */
export type OpenQuestion = { text: string; decide: boolean; sources: string[] };

/** At most this many questions need a decision, and this many in all. */
export const OPEN_LIMITS = { decide: 5, all: 8 } as const;

/** The shape the format texts give for "open". */
export const OPEN_FORMAT = `"open": [{ "text": "<text>", "decide": true | false, "sources": ["<id>#p<N>"] }]`;

/** What a source is checked against: the job's files, and how many pages each has. */
export type OpenGiven = {
	files: readonly FileRow[];
	/** How many pages a file's text has; 0 when unknown. */
	pages?: (id: string) => number;
};

/** Why a source can't be kept, or null when it names a known file and a page in range. */
export function sourceIssue(source: string, given: OpenGiven): string | null {
	const parsed = parseSource(source);
	const row =
		parsed === null
			? undefined
			: given.files.find((file) => file.id === parsed.id);
	if (parsed === null || row === undefined)
		return `"${source}" is not a file of this project`;
	if (parsed.from === null) return `"${source}" needs a page, e.g. #p6`;
	const last = parsed.to ?? parsed.from;
	if (last < parsed.from) return `"${source}" has the pages the wrong way`;
	const count = Math.max(row.pages ?? 0, given.pages?.(row.id) ?? 0);
	if (last > count) return `"${source}" is beyond the file's ${count} pages`;
	return null;
}

/**
 * The open questions of a set as the model wrote them. A bad question is refused and listed;
 * a bad source is dropped (and listed) but its question kept. Past the limits, the rest are
 * refused.
 */
export function parseOpen(
	value: unknown,
	given: OpenGiven,
	add: (path: string, message: string) => void,
): OpenQuestion[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) {
		add("open", "expected a list of questions");
		return [];
	}
	const out: OpenQuestion[] = [];
	let deciding = 0;
	for (const [i, item] of value.entries()) {
		const at = `open[${i}]`;
		const question = oneQuestion(item, at, given, add);
		if (question === null) continue;
		if (out.length >= OPEN_LIMITS.all) {
			add(at, `at most ${OPEN_LIMITS.all} open questions`);
			continue;
		}
		if (question.decide) {
			if (deciding >= OPEN_LIMITS.decide) {
				add(at, `at most ${OPEN_LIMITS.decide} questions that need a decision`);
				continue;
			}
			deciding += 1;
		}
		out.push(question);
	}
	return out;
}

/** One question, or null with the reason listed. */
function oneQuestion(
	item: unknown,
	at: string,
	given: OpenGiven,
	add: (path: string, message: string) => void,
): OpenQuestion | null {
	if (typeof item === "string") {
		const checked = checkText(item, BUNDLE_LIMITS.listChars);
		if (checked.ok) return { text: checked.text, decide: false, sources: [] };
		add(at, checked.message);
		return null;
	}
	if (typeof item !== "object" || item === null || Array.isArray(item)) {
		add(at, "expected a question");
		return null;
	}
	const raw = item as Record<string, unknown>;
	const checked = checkText(raw.text, BUNDLE_LIMITS.listChars);
	if (!checked.ok) {
		add(`${at}.text`, checked.message);
		return null;
	}
	const sources: string[] = [];
	if (Array.isArray(raw.sources))
		for (const [j, source] of raw.sources.entries()) {
			const issue =
				typeof source === "string"
					? sourceIssue(source, given)
					: "expected a source";
			if (issue === null && typeof source === "string") {
				if (!sources.includes(source)) sources.push(source);
			} else add(`${at}.sources[${j}]`, issue ?? "expected a source");
		}
	else if (raw.sources !== undefined)
		add(`${at}.sources`, "expected a list of sources");
	return { text: checked.text, decide: raw.decide === true, sources };
}
