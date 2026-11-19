// Building a course with Claude or Gemini in the browser (task 245). A browser chat takes an
// uploaded file and answers in the chat, and one answer is short, so a whole book is built in
// rounds: round 1 asks for the outline (units, lessons, and each unit's pages per file), then
// one round per unit asks for that unit alone, from that unit's pages only. The answers are
// merged into one change set for the course's period, checked by the same parser as any set.
// Pure here: the outline's format and parser, the rounds from an outline, each upload's text,
// the answer's JSON from a paste, and the merge.

/** Keep each upload under this many characters; a larger unit is split in two rounds. */
export const UPLOAD_MAX = 400_000;

/** The outline's JSON shape, as the round-1 message gives it. */
export const OUTLINE_FORMAT = `{
  "units": [
    { "number": <number>, "title": "<text>",
      "lessons": [{ "number": <number>, "title": "<text>" }],
      "pages": [{ "file": "<file id>", "from": <first page>, "to": <last page> }] } ]
}`;

/** One unit of the outline, with the pages it covers in each file. */
export type OutlineUnit = {
	number: number;
	title: string;
	lessons: { number: number; title: string }[];
	pages: { file: string; from: number; to: number }[];
};

/** The outline of a course: its units in order. */
export type Outline = { units: OutlineUnit[] };

/** What the outline is checked against: each file's id and page count. */
export type OutlineFiles = ReadonlyMap<string, number>;

/** The JSON in a pasted answer: a code fence or text around it is allowed. */
export function answerJson(text: string): unknown | null {
	const trimmed = text.trim();
	const fenced = /```(?:json)?\s*\n([\s\S]*?)\n```/.exec(trimmed);
	const body = fenced?.[1] ?? trimmed;
	const start = body.indexOf("{");
	const end = body.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	try {
		return JSON.parse(body.slice(start, end + 1)) as unknown;
	} catch {
		return null;
	}
}

/** A short text of at most `max` characters, or null. */
function shortText(value: unknown, max: number): string | null {
	if (typeof value !== "string") return null;
	const text = value.trim().replace(/\s+/g, " ");
	return text === "" || text.length > max ? null : text;
}

/** A whole number from 1 to `max`, or null. */
function count(value: unknown, max: number): number | null {
	return typeof value === "number" &&
		Number.isInteger(value) &&
		value >= 1 &&
		value <= max
		? value
		: null;
}

/**
 * The outline an answer holds, or what is wrong with it in plain words. Every unit needs a
 * number, a title, at least one lesson, and pages that are pages of the course's files.
 */
export function parseOutline(
	value: unknown,
	files: OutlineFiles,
): { ok: true; outline: Outline } | { ok: false; issue: string } {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return { ok: false, issue: "The answer has no JSON object." };
	const raw = (value as Record<string, unknown>).units;
	if (!Array.isArray(raw) || raw.length === 0)
		return { ok: false, issue: 'The answer has no "units" list.' };
	if (raw.length > 40)
		return { ok: false, issue: "The answer has more than 40 units." };
	const units: OutlineUnit[] = [];
	const numbers = new Set<number>();
	for (const [i, item] of raw.entries()) {
		const where = `Unit ${i + 1}`;
		if (typeof item !== "object" || item === null)
			return { ok: false, issue: `${where} is not an object.` };
		const unit = item as Record<string, unknown>;
		const number = count(unit.number, 99);
		if (number === null || numbers.has(number))
			return { ok: false, issue: `${where} needs its own number.` };
		numbers.add(number);
		const title = shortText(unit.title, 120);
		if (title === null) return { ok: false, issue: `${where} needs a title.` };
		const lessons: OutlineUnit["lessons"] = [];
		for (const lesson of Array.isArray(unit.lessons) ? unit.lessons : []) {
			if (typeof lesson !== "object" || lesson === null) continue;
			const entry = lesson as Record<string, unknown>;
			const lessonNumber = count(entry.number, 40);
			const lessonTitle = shortText(entry.title, 120);
			if (lessonNumber !== null && lessonTitle !== null)
				lessons.push({ number: lessonNumber, title: lessonTitle });
		}
		if (lessons.length === 0)
			return { ok: false, issue: `${where} ("${title}") has no lessons.` };
		const pages: OutlineUnit["pages"] = [];
		for (const range of Array.isArray(unit.pages) ? unit.pages : []) {
			if (typeof range !== "object" || range === null) continue;
			const entry = range as Record<string, unknown>;
			const file = typeof entry.file === "string" ? entry.file : "";
			const total = files.get(file);
			if (total === undefined)
				return {
					ok: false,
					issue: `${where} names a file that is not one of the uploaded files: "${file}".`,
				};
			const from = count(entry.from, total);
			const to = count(entry.to, total);
			if (from === null || to === null || to < from)
				return {
					ok: false,
					issue: `${where} has pages that are not in its file (it has ${total}).`,
				};
			pages.push({ file, from, to });
		}
		if (pages.length === 0)
			return { ok: false, issue: `${where} ("${title}") gives no pages.` };
		units.push({ number, title, lessons, pages });
	}
	return { ok: true, outline: { units } };
}

/** One round after the outline: a unit, or one part of a unit too large for one upload. */
export type UnitRound = {
	unit: number;
	title: string;
	/** 1 and 2 when the unit is split in two; 1 of 1 otherwise. */
	part: number;
	parts: number;
	pages: { file: string; from: number; to: number }[];
};

/**
 * The rounds an outline asks for: one per unit, or two for a unit whose pages are longer than
 * one upload takes (split by page range, merged again afterwards).
 */
export function unitRounds(
	outline: Outline,
	size: (range: { file: string; from: number; to: number }) => number,
): UnitRound[] {
	const out: UnitRound[] = [];
	for (const unit of outline.units) {
		const total = unit.pages.reduce((sum, range) => sum + size(range), 0);
		if (total <= UPLOAD_MAX) {
			out.push({
				unit: unit.number,
				title: unit.title,
				part: 1,
				parts: 1,
				pages: unit.pages,
			});
			continue;
		}
		// Split every range at its middle page: the first halves, then the second halves.
		const first: UnitRound["pages"] = [];
		const second: UnitRound["pages"] = [];
		for (const range of unit.pages) {
			if (range.to === range.from) {
				first.push(range);
				continue;
			}
			const middle = Math.floor((range.from + range.to) / 2);
			first.push({ file: range.file, from: range.from, to: middle });
			second.push({ file: range.file, from: middle + 1, to: range.to });
		}
		out.push({
			unit: unit.number,
			title: unit.title,
			part: 1,
			parts: 2,
			pages: first,
		});
		out.push({
			unit: unit.number,
			title: unit.title,
			part: 2,
			parts: 2,
			pages: second,
		});
	}
	return out;
}

/** About how many rounds a course takes: the outline, then about one per 40 pages. */
export function roundsGuess(pages: number): number {
	return 1 + Math.max(1, Math.ceil(pages / 40));
}

/** The pages of a file's text ("## Page N" sections) from `from` to `to`. */
export function pagesOf(text: string, from: number, to: number): string {
	const out: string[] = [];
	for (const section of text.split(/(?=^## Page \d+)/m)) {
		const match = /^## Page (\d+)/.exec(section);
		if (match === null) continue;
		const page = Number(match[1]);
		if (page >= from && page <= to) out.push(section.trimEnd());
	}
	return out.join("\n\n");
}

/** The message for round 1: what to read and the one small answer to give. */
export function outlineMessage(language: string): string {
	return `The file I uploaded holds a school course's material: each file starts with "# <id>
<path>", then its pages as "## Page N". Read all of it.

Answer with JSON only, in this shape:

${OUTLINE_FORMAT}

List the course's units in the book's order with their lessons, and for each unit the
pages it covers in each file (the file id from its "# <id>" line). Write the titles in the
course's language (${language}). Give nothing else: no facts yet.`;
}

/** The message for one unit's round. */
export function unitMessage(round: UnitRound, language: string): string {
	const part =
		round.parts > 1
			? ` This is part ${round.part} of ${round.parts} of the unit's pages: write only what these pages hold.`
			: "";
	return `The file I uploaded holds the rules (rules.md) and the pages of one unit: Unit
${round.unit}, "${round.title}".${part}

Follow the rules and answer with one change set as JSON only, in the format the file gives,
with this one unit (number ${round.unit}) and nothing else. Write in the course's language
(${language}). Every fact names its pages as "<id>#p<N>".`;
}

/** A unit as an answer gives it, before the merge. */
type AnswerUnit = Record<string, unknown> & {
	number?: unknown;
	lessons?: unknown;
	keywords?: unknown;
	evidence?: unknown;
};

/**
 * One change set from the units' answers, in the outline's order. A unit answered in two parts
 * keeps the first part's title and joins the lessons, renumbered, with the key words and
 * evidence of both. Open questions are kept from every answer.
 */
export function mergeAnswers(
	head: { grade: number; subject: string; language: string; period: string },
	answers: readonly { unit: number; value: unknown }[],
): Record<string, unknown> {
	const units = new Map<number, AnswerUnit>();
	const open: unknown[] = [];
	for (const answer of answers) {
		if (typeof answer.value !== "object" || answer.value === null) continue;
		const raw = answer.value as Record<string, unknown>;
		if (Array.isArray(raw.open)) open.push(...raw.open);
		const list = Array.isArray(raw.units) ? raw.units : [];
		const unit = list.find(
			(entry): entry is AnswerUnit =>
				typeof entry === "object" &&
				entry !== null &&
				(entry as AnswerUnit).number === answer.unit,
		);
		if (unit === undefined) continue;
		const before = units.get(answer.unit);
		if (before === undefined) {
			units.set(answer.unit, { ...unit });
			continue;
		}
		const lessons = [
			...(Array.isArray(before.lessons) ? before.lessons : []),
			...(Array.isArray(unit.lessons) ? unit.lessons : []),
		].map((lesson, index) =>
			typeof lesson === "object" && lesson !== null
				? { ...(lesson as Record<string, unknown>), number: index + 1 }
				: lesson,
		);
		const join = (a: unknown, b: unknown) => [
			...new Set([
				...(Array.isArray(a) ? a : []),
				...(Array.isArray(b) ? b : []),
			]),
		];
		units.set(answer.unit, {
			...before,
			lessons,
			keywords: join(before.keywords, unit.keywords),
			evidence: join(before.evidence, unit.evidence),
		});
	}
	return {
		...head,
		units: [...units.values()],
		open,
	};
}
