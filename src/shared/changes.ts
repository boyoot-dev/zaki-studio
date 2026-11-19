// A change set from the notes (task 158), ported from guide-rules.md and sources.py by way of
// the notes' own format: the units, lessons, skills, key words, evidence and facts a model
// proposes for one course and one period, checked the way the bundle checks its own texts, and
// merged into the project's model only where the author accepts. Pure and tested: the files
// and the requests are in src/main.
//
// Every value is parsed on its own, so one bad text refuses that item and leaves the rest of
// the set to review. Two checks are shown, never enforced, because the author decides:
//   - the page check: the pages a fact cites hold at least 60% of its words (sources.py);
//   - the copy check: a run of twelve or more words taken from the pages word for word.
// Today's Arabic text layers can be reversed, so a failed page check is a warning, not a
// refusal (found 2026-10-25, docs/CURRICULA.md).

import { rowCourse } from "./convert.ts";
import type { ReviewExam } from "./exam-changes.ts";
import { BUNDLE_LIMITS, type BundleSkill, checkText } from "./format/bundle.ts";
import { newId } from "./ids.ts";
import type {
	FileRow,
	ModelCourse,
	ModelFact,
	ModelLesson,
	ModelUnit,
} from "./model.ts";
import { parseSource } from "./model.ts";
import { type OpenQuestion, parseOpen, sourceIssue } from "./open-questions.ts";
import type { AcceptChoice, Target } from "./targets.ts";

/** Where a project keeps the change sets waiting for review, under .studio. */
export const CHANGES_DIR = ".studio/changes";

/** A page must hold this share of a fact's words to count as its source (sources.py). */
export const MIN_WORDS = 0.6;

/** A fact that shares this many consecutive words with its page is marked as copied. */
export const COPY_RUN = 12;

/** One text that did not pass: where it is in the set, and why. */
export type ChangeRefusal = { path: string; message: string };

/** Why a change set in a job's out/ folder was not collected. The page turns each into a
 * sentence. */
export type ChangeRefusalCode =
	| "name"
	| "link"
	| "notFile"
	| "unknown"
	| "tooLarge"
	| "notUtf8"
	| "invalid";

/** One fact a model proposes: its text and the pages it says it came from. */
export type CleanFact = {
	text: string;
	sources: string[];
	/** False when the cited pages hold less than MIN_WORDS of its words. */
	pageOk: boolean;
	/** The run of words the fact shares with its page, when it copies one. */
	copy: string | null;
};

/**
 * One skill: the sheet's code when it gives one, and what the child should be able to do. A
 * proposal has no ids; merging gives each skill one (keepSkillIds).
 */
export type CleanSkill = Omit<BundleSkill, "id">;

/**
 * The proposed skills with ids (task 224): a skill keeps the id of the old one with the same
 * text, else of the old one at the same position (a reworded skill keeps its progress, as it
 * always did), else gets a new id.
 */
export function keepSkillIds(
	old: readonly BundleSkill[],
	proposed: readonly CleanSkill[],
): BundleSkill[] {
	const used = new Set<string>();
	const byText = proposed.map(
		(skill) =>
			old.find((entry) => entry.text === skill.text && !used.has(entry.id)) ??
			null,
	);
	for (const found of byText) if (found !== null) used.add(found.id);
	return proposed.map((skill, i) => {
		const same = byText[i];
		if (same !== null && same !== undefined) return { ...skill, id: same.id };
		const at = old[i];
		if (at !== undefined && !used.has(at.id)) {
			used.add(at.id);
			return { ...skill, id: at.id };
		}
		return { ...skill, id: newId() };
	});
}

export type CleanLesson = {
	number: number;
	title: string;
	activity: ModelLesson["activity"];
	skills: CleanSkill[];
	facts: CleanFact[];
};

export type CleanUnit = {
	number: number;
	title: string;
	source: ModelUnit["source"];
	keywords: string[];
	evidence: string[];
	lessons: CleanLesson[];
};

/** A change set that passed every check, ready to review and to merge. */
export type CleanSet = {
	grade: number;
	subject: string;
	language: string;
	period: string;
	units: CleanUnit[];
	open: OpenQuestion[];
};

/** What parsing gave: the clean set and every item it refused, or why the whole set failed. */
export type ParseOutcome =
	| { ok: true; set: CleanSet; refused: ChangeRefusal[] }
	| { ok: false; issue: string };

/** Everything a change set is checked against: the period's units, the register and its text. */
export type Given = {
	target: Target;
	/** The period's units as the model has them now. */
	units: readonly ModelUnit[];
	/** True when this set may write new units for the period: it was made before the period
	 * had any, so accepting one unit must not refuse the rest of its own set (task 178). */
	allowNewUnits?: boolean;
	/** Every unit number the course has, in any period, so a new unit can't take one. */
	taken?: ReadonlySet<number>;
	/** The register rows, so a source names a known file and one of its pages. */
	files: readonly FileRow[];
	/** One page's text, from .studio/text; "" when the file has no such page. */
	page: (id: string, page: number) => string;
	/** How many pages a file's text has. */
	pages: (id: string) => number;
};

const STOP = new Set(
	"the and for are with that this from into its it's was were has have had not but can you your our their they them there then than when what which who how why all any each one two also more most some such only very used use uses using called".split(
		" ",
	),
);

// Arabic joins "and", "the", "with" and the like to the word: والتشفير, بالمفتاح, للبيانات.
const ARABIC_MARKS = /[\u064B-\u0652\u0640]/g;
const ARABIC_PREFIX =
	/^(?:[\u0648\u0641])?(?:بال|كال|لل|ال|ب|ل)?(?=[\u0621-\u064A]{3})/;
const ARABIC_SUFFIX = /(?:ات|ون|ين|ها|هم|ه)$/;
const WORDS = /[\p{L}\p{N}]+/gu;

/** An Arabic word without its joined prefixes and common endings; other words as they are. */
export function stem(word: string): string {
	if (!/^[\u0621-\u064A]/.test(word)) return word;
	const bare = word.replace(ARABIC_PREFIX, "");
	return bare.length > 4 ? bare.replace(ARABIC_SUFFIX, "") : bare;
}

/** The content words of a text, as sources.py has them: lowercased, Arabic unified, short
 * and common words dropped. */
export function words(text: string): Set<string> {
	const t = normal(text);
	const found = new Set<string>();
	for (const match of t.matchAll(WORDS)) {
		const word = stem(match[0]);
		if (word.length >= 3 && !STOP.has(word)) found.add(word);
	}
	return found;
}

/** A text with its Arabic marks removed and its letter forms unified, lowercased. */
function normal(text: string): string {
	return text
		.toLowerCase()
		.replace(ARABIC_MARKS, "")
		.replace(/[أإآ]/g, "ا")
		.replace(/ة/g, "ه")
		.replace(/ى/g, "ي");
}

/** True when `pageText` holds at least MIN_WORDS of a fact's words; a fact too short to
 * judge passes, as sources.py refuses to guess one. */
export function pageCheck(fact: string, pageText: string): boolean {
	const want = words(fact);
	if (want.size < 3) return true;
	const have = words(pageText);
	let found = 0;
	for (const word of want) if (have.has(word)) found += 1;
	return found / want.size >= MIN_WORDS;
}

/** One word of a text with where it sits, so a copied run can be marked in place. */
type Word = { word: string; start: number; end: number };

/** The words of a text in order, normalised, with their places in the original. */
function wordTokens(text: string): Word[] {
	const out: Word[] = [];
	for (const match of text.matchAll(WORDS)) {
		const start = match.index ?? 0;
		out.push({
			word: normal(match[0]),
			start,
			end: start + match[0].length,
		});
	}
	return out;
}

/** The run of `size` or more words a fact shares with its page, or null. */
export function copyRun(
	fact: string,
	pageText: string,
	size = COPY_RUN,
): string | null {
	const mine = wordTokens(fact);
	if (mine.length < size) return null;
	const theirs = wordTokens(pageText).map((word) => word.word);
	const runs = new Set<string>();
	for (let i = 0; i + size <= theirs.length; i += 1)
		runs.add(theirs.slice(i, i + size).join(" "));
	for (let i = 0; i + size <= mine.length; i += 1) {
		const window = mine
			.slice(i, i + size)
			.map((word) => word.word)
			.join(" ");
		if (!runs.has(window)) continue;
		const first = mine[i];
		const last = mine[i + size - 1];
		if (first === undefined || last === undefined) return null;
		return fact.slice(first.start, last.end);
	}
	return null;
}

/** Every page a source names, in order: "id#p6-8" gives 6, 7 and 8. */
function sourcePages(source: string): { id: string; pages: number[] } | null {
	const parsed = parseSource(source);
	if (parsed === null || parsed.from === null) return null;
	const last = parsed.to ?? parsed.from;
	const pages: number[] = [];
	for (let page = parsed.from; page <= last; page += 1) pages.push(page);
	return { id: parsed.id, pages };
}

/**
 * A change set as the model wrote it, or why it is not one. Every text goes through the
 * bundle's own checks, and every item is judged on its own: a bad unit, lesson, skill, fact or
 * open question is refused and listed, never the whole set.
 */
export function parseChangeSet(value: unknown, given: Given): ParseOutcome {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return { ok: false, issue: "expected one JSON object" };
	const raw = value as Record<string, unknown>;
	if (raw.grade !== given.target.grade)
		return {
			ok: false,
			issue: `the change set is not for Grade ${given.target.grade}`,
		};
	// A set written before task 224 names a language copy (`chemistry-ar`): read it as its course.
	const named =
		typeof raw.subject === "string"
			? rowCourse(raw.subject, raw.language ?? given.target.language)
			: null;
	if (
		named === null ||
		named.subject !== given.target.subject ||
		named.language !== given.target.language
	)
		return {
			ok: false,
			issue: `the change set is not for ${given.target.subject} (${given.target.language})`,
		};
	if (raw.period !== given.target.period)
		return {
			ok: false,
			issue: `the change set is not for period ${given.target.period}`,
		};
	if (!Array.isArray(raw.units))
		return { ok: false, issue: "the change set has no units" };

	const refused: ChangeRefusal[] = [];
	const add = (path: string, message: string) =>
		refused.push({ path, message });
	const units: CleanUnit[] = [];
	for (const [i, item] of raw.units.entries()) {
		const unit = parseUnit(item, `units[${i}]`, given, add);
		if (unit !== null) units.push(unit);
	}
	if (units.length === 0)
		return {
			ok: false,
			issue: refused[0]?.message ?? "no unit could be read",
		};
	const open = parseOpen(raw.open, given, add);
	return {
		ok: true,
		set: {
			grade: given.target.grade,
			subject: given.target.subject,
			language: given.target.language,
			period: given.target.period,
			units,
			open,
		},
		refused,
	};
}

/** A text the bundle accepts, or null with the reason listed. */
function text(
	value: unknown,
	max: number,
	at: string,
	add: (path: string, message: string) => void,
): string | null {
	const checked = checkText(value, max);
	if (checked.ok) return checked.text;
	add(at, checked.message);
	return null;
}

/** A list of short texts (key words, evidence, open questions); empty when absent. */
export function textList(
	value: unknown,
	at: string,
	max: number,
	add: (path: string, message: string) => void,
	maxItems = BUNDLE_LIMITS.listItems,
): string[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) {
		add(at, "expected a list of texts");
		return [];
	}
	const out: string[] = [];
	for (const [i, item] of value.entries()) {
		if (out.length >= maxItems) {
			add(`${at}[${i}]`, `at most ${maxItems} entries`);
			continue;
		}
		const entry = text(item, max, `${at}[${i}]`, add);
		if (entry !== null) out.push(entry);
	}
	return out;
}

/** One unit, or null when its number or title can't be kept. */
function parseUnit(
	value: unknown,
	at: string,
	given: Given,
	add: (path: string, message: string) => void,
): CleanUnit | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		add(at, "expected a unit");
		return null;
	}
	const raw = value as Record<string, unknown>;
	const number = raw.number;
	if (typeof number !== "number" || !Number.isInteger(number)) {
		add(`${at}.number`, "expected a whole number");
		return null;
	}
	const now = given.units.find((unit) => unit.number === number);
	// A period with no unit yet (a new course, or a block the course has none in) has nothing
	// to match: the set writes its units from the notes alone (task 178). A set made that way
	// may still add the rest after the author has accepted one of its units. Anywhere else a
	// unit must already sit in this period, so a set can never invent one (task 158).
	if (
		now === undefined &&
		given.units.length > 0 &&
		given.allowNewUnits !== true
	) {
		add(
			`${at}.number`,
			`unit ${number} is not a unit of ${given.target.period}`,
		);
		return null;
	}
	if (now === undefined && given.taken?.has(number) === true) {
		add(`${at}.number`, `unit ${number} is already a unit of another period`);
		return null;
	}
	if (number < 0 || number > BUNDLE_LIMITS.numberMax) {
		add(`${at}.number`, `expected 0 to ${BUNDLE_LIMITS.numberMax}`);
		return null;
	}
	const title = text(raw.title, BUNDLE_LIMITS.title, `${at}.title`, add);
	if (title === null) return null;
	const source = raw.source ?? "sheet";
	if (source !== "sheet" && source !== "provisional") {
		add(`${at}.source`, 'expected "sheet" or "provisional"');
		return null;
	}
	const keywords = textList(
		raw.keywords,
		`${at}.keywords`,
		BUNDLE_LIMITS.listChars,
		add,
	);
	const evidence = textList(
		raw.evidence,
		`${at}.evidence`,
		BUNDLE_LIMITS.listChars,
		add,
	);
	const lessons = parseLessons(raw.lessons, `${at}.lessons`, given, add);
	return { number, title, source, keywords, evidence, lessons };
}

/** The unit's lessons, by number: one the unit has is replaced on accept, a new one is added. */
function parseLessons(
	value: unknown,
	at: string,
	given: Given,
	add: (path: string, message: string) => void,
): CleanLesson[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) {
		add(at, "expected a list of lessons");
		return [];
	}
	const seen = new Set<number>();
	const out: CleanLesson[] = [];
	for (const [i, item] of value.entries()) {
		const where = `${at}[${i}]`;
		if (typeof item !== "object" || item === null || Array.isArray(item)) {
			add(where, "expected a lesson");
			continue;
		}
		const raw = item as Record<string, unknown>;
		const number = raw.number;
		if (typeof number !== "number" || !Number.isInteger(number)) {
			add(`${where}.number`, "expected a whole number");
			continue;
		}
		// A lesson the unit doesn't have yet is added: this year's sheets can have more lessons
		// than last year's, and the rules say the lessons follow the sheets (architect,
		// review 1). Its number must still be one a bundle can hold.
		if (number < 1 || number > BUNDLE_LIMITS.lessons) {
			add(
				`${where}.number`,
				`lesson ${number} is not between 1 and ${BUNDLE_LIMITS.lessons}`,
			);
			continue;
		}
		if (seen.has(number)) {
			add(`${where}.number`, `lesson ${number} is used twice`);
			continue;
		}
		const title = text(raw.title, BUNDLE_LIMITS.title, `${where}.title`, add);
		const activity = raw.activity ?? null;
		if (activity !== null && activity !== "reading" && activity !== "writing") {
			add(`${where}.activity`, 'expected "reading", "writing" or nothing');
			continue;
		}
		if (title === null) continue;
		const skills = parseSkills(raw.skills, `${where}.skills`, add);
		if (skills.length === 0) {
			// A bundle lesson needs at least one skill; keeping the old ones is the only safe
			// reading of a lesson whose skills all failed.
			add(`${where}.skills`, "a lesson needs at least one skill");
			continue;
		}
		seen.add(number);
		out.push({
			number,
			title,
			activity,
			skills,
			facts: parseFacts(raw.facts, `${where}.facts`, given, add),
		});
	}
	return out;
}

/** A lesson's skills, at most the bundle's own limit. */
function parseSkills(
	value: unknown,
	at: string,
	add: (path: string, message: string) => void,
): CleanSkill[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) {
		add(at, "expected a list of skills");
		return [];
	}
	const out: CleanSkill[] = [];
	for (const [i, item] of value.entries()) {
		if (out.length >= BUNDLE_LIMITS.skills) {
			add(`${at}[${i}]`, `at most ${BUNDLE_LIMITS.skills} skills`);
			continue;
		}
		const where = `${at}[${i}]`;
		if (typeof item !== "object" || item === null || Array.isArray(item)) {
			add(where, "expected a skill");
			continue;
		}
		const raw = item as Record<string, unknown>;
		const code =
			raw.code === null || raw.code === undefined
				? null
				: text(raw.code, BUNDLE_LIMITS.skillCodeChars, `${where}.code`, add);
		const wording = text(
			raw.text,
			BUNDLE_LIMITS.skillChars,
			`${where}.text`,
			add,
		);
		if (wording === null) continue;
		out.push({ code, text: wording });
	}
	return out;
}

/** A lesson's facts: each with at least one known source page, at most 25. */
function parseFacts(
	value: unknown,
	at: string,
	given: Given,
	add: (path: string, message: string) => void,
): CleanFact[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) {
		add(at, "expected a list of facts");
		return [];
	}
	const out: CleanFact[] = [];
	for (const [i, item] of value.entries()) {
		if (out.length >= BUNDLE_LIMITS.facts) {
			add(`${at}[${i}]`, `at most ${BUNDLE_LIMITS.facts} facts`);
			continue;
		}
		const where = `${at}[${i}]`;
		if (typeof item !== "object" || item === null || Array.isArray(item)) {
			add(where, "expected a fact");
			continue;
		}
		const raw = item as Record<string, unknown>;
		const wording = text(
			raw.text,
			BUNDLE_LIMITS.factChars,
			`${where}.text`,
			add,
		);
		if (wording === null) continue;
		const sources = checkSources(raw.sources, `${where}.sources`, given, add);
		if (sources === null) continue;
		const cited = sources.flatMap((source) => {
			const found = sourcePages(source);
			if (found === null) return [];
			return found.pages.map((page) => given.page(found.id, page));
		});
		const pagesText = cited.join("\n");
		out.push({
			text: wording,
			sources,
			pageOk: pageCheck(wording, pagesText),
			copy: copyRun(wording, pagesText),
		});
	}
	return out;
}

/** The fact's source pages, all of them known files with pages the file has, or null. */
function checkSources(
	value: unknown,
	at: string,
	given: Given,
	add: (path: string, message: string) => void,
): string[] | null {
	if (!Array.isArray(value) || value.length === 0) {
		add(at, "a fact needs the pages it came from");
		return null;
	}
	const out: string[] = [];
	for (const [i, item] of value.entries()) {
		if (typeof item !== "string") {
			add(`${at}[${i}]`, "expected a source");
			return null;
		}
		const issue = sourceIssue(item, given);
		if (issue !== null) {
			add(`${at}[${i}]`, issue);
			return null;
		}
		out.push(item);
	}
	return out;
}

/** One lesson as the review shows it: what the unit has now, and what the set proposes. */
export type ReviewLesson = {
	number: number;
	now: ModelLesson | null;
	proposed: CleanLesson;
};

/** One unit as the review shows it, side by side. */
export type ReviewUnit = {
	number: number;
	now: ModelUnit | null;
	proposed: CleanUnit;
	lessons: ReviewLesson[];
};

/** What "Changes to review" shows of one change set. */
export type ChangeReview = {
	/** "units" for units and lessons, "exams" for exam papers (task 177). */
	kind: "units" | "exams";
	/** "7-science-en-block-3", the set's name in .studio/changes. */
	key: string;
	grade: number;
	subject: string;
	/** The course's teaching language (task 224). */
	language: string;
	/** The period for a units set, or "" for exams, which cover the whole course. */
	period: string;
	state: "pending" | "rejected";
	/** The day it was written, "YYYY-MM-DD". */
	at: string;
	source: "key" | "job";
	model: string;
	/** The choices already accepted: "5" for a unit, "5.1" for a lesson. */
	accepted: string[];
	units: ReviewUnit[];
	/** The exams side by side, for an exams set; empty for a units set. */
	exams: ReviewExam[];
	open: OpenQuestion[];
	refused: ChangeRefusal[];
	/** What the teacher asked for, when the proposal answers one request (task 248); "" else. */
	request: string;
};

/** The set paired with the course as it is now, for the review's side by side. */
export function reviewUnits(
	set: CleanSet,
	course: ModelCourse | null,
): ReviewUnit[] {
	const current =
		course === null
			? []
			: course.units.filter((unit) => unit.period === set.period);
	return set.units.map((proposed) => {
		const now = current.find((unit) => unit.number === proposed.number) ?? null;
		return {
			number: proposed.number,
			now,
			proposed,
			lessons: proposed.lessons.map((lesson) => ({
				number: lesson.number,
				now:
					now?.lessons.find((entry) => entry.number === lesson.number) ?? null,
				proposed: lesson,
			})),
		};
	});
}

/** True when this choice has already been accepted for the set. */
export function accepted(
	choice: AcceptChoice,
	list: readonly string[],
): boolean {
	if (choice.kind === "all") return false;
	if (choice.kind === "unit") return list.includes(String(choice.unit));
	return list.includes(`${choice.unit}.${choice.lesson}`);
}

/**
 * The course with one choice of a change set merged in; nothing else is touched. An existing
 * unit is updated as before; a proposed unit the course does not have joins it (task 178), the
 * way a proposed lesson does, so a new course or an empty block gets its first units.
 */
export function mergeCourse(
	course: ModelCourse,
	set: CleanSet,
	choice: AcceptChoice,
): ModelCourse {
	const merged = course.units.map((unit) => {
		const proposed = set.units.find(
			(entry) => entry.number === unit.number && unit.period === set.period,
		);
		if (proposed === undefined) return unit;
		if (choice.kind === "unit" && choice.unit !== unit.number) return unit;
		if (choice.kind === "lesson") {
			if (choice.unit !== unit.number) return unit;
			return {
				...unit,
				lessons: mergeLessons(
					unit.lessons,
					proposed.lessons.filter((lesson) => lesson.number === choice.lesson),
				),
			};
		}
		return {
			...unit,
			title: proposed.title,
			source: proposed.source,
			keywords: [...proposed.keywords],
			evidence: [...proposed.evidence],
			lessons: mergeLessons(unit.lessons, proposed.lessons),
		};
	});
	const added = set.units
		.filter(
			(entry) => !course.units.some((unit) => unit.number === entry.number),
		)
		.filter((entry) => choice.kind === "all" || choice.unit === entry.number)
		.map(
			(entry): ModelUnit => ({
				id: newId(),
				number: entry.number,
				period: set.period,
				title: entry.title,
				source: entry.source,
				keywords: [...entry.keywords],
				evidence: [...entry.evidence],
				lessons: mergeLessons(
					[],
					choice.kind === "lesson"
						? entry.lessons.filter((lesson) => lesson.number === choice.lesson)
						: entry.lessons,
				),
			}),
		);
	return {
		...course,
		units: [...merged, ...added].sort((a, b) => a.number - b.number),
	};
}

/** Lessons matched by number: the proposal replaces the title, skills and activity. */
function mergeLessons(
	current: readonly ModelLesson[],
	proposed: readonly CleanLesson[],
): ModelLesson[] {
	const merged = current.map((lesson) => {
		const found = proposed.find((entry) => entry.number === lesson.number);
		if (found === undefined) return lesson;
		return {
			...lesson,
			title: found.title,
			skills: keepSkillIds(lesson.skills, found.skills),
			activity: found.activity,
			facts: mergeFacts(lesson.facts, found.facts),
		};
	});
	// A proposed lesson the unit doesn't have yet joins it, in number order. Nothing is removed.
	const added = proposed
		.filter(
			(entry) => !current.some((lesson) => lesson.number === entry.number),
		)
		.map(
			(entry): ModelLesson => ({
				id: newId(),
				number: entry.number,
				title: entry.title,
				skills: keepSkillIds([], entry.skills),
				activity: entry.activity,
				facts: mergeFacts([], entry.facts),
			}),
		);
	return [...merged, ...added].sort((a, b) => a.number - b.number);
}

/**
 * The facts of one lesson. A fact the author wrote ("own": true) stays exactly where it is;
 * every other fact is replaced by the proposal's, and a proposal with more facts appends the
 * rest. A proposal with fewer facts removes old ones, which is what "replaced" means here.
 */
function mergeFacts(
	current: readonly ModelFact[],
	proposed: readonly CleanFact[],
): ModelFact[] {
	const out: ModelFact[] = [];
	let at = 0;
	const next = (): ModelFact | null => {
		const fact = proposed[at];
		at += 1;
		return fact === undefined
			? null
			: {
					text: fact.text,
					sources: [...fact.sources],
					status: "draft",
					own: false,
				};
	};
	for (const fact of current) {
		if (fact.own) {
			out.push(fact);
			continue;
		}
		const replacement = next();
		if (replacement !== null) out.push(replacement);
	}
	for (let more = next(); more !== null; more = next()) out.push(more);
	return out;
}
