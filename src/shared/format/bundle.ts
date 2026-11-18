// The curriculum bundle format, version 1 (standard/SPEC.md): one JSON file that an
// author writes and a family imports. A bundle is written by a stranger, so parseBundle
// checks the whole file and builds its result from checked values only, and it never throws.
// It is also the one validator the Studio and the checker page use, so they run it in a
// browser: it imports only from src/lib files that have no imports themselves, and every
// check runs in time proportional to the text.

import { GRADE_MAX, GRADE_MIN } from "./grades.ts";
import { hasWebAddress } from "./web-address.ts";

/** The limits of the bundle format, for messages and forms. */
export const BUNDLE_LIMITS = {
	/** Characters in the whole file. Fourteen levels at the densest rate come to about 11 million. */
	chars: 20_000_000,
	/** The bundle's own version number, bumped by the author on every export. */
	version: 1_000_000,
	/** Courses in the file (a course is one grade + subject). */
	courses: 400,
	/** Units in a course. */
	units: 60,
	/** Lessons in a unit. */
	lessons: 40,
	/** Skills in a lesson, and a skill's text. */
	skills: 20,
	skillChars: 300,
	skillCodeChars: 20,
	/** Facts in a lesson, and a fact's text. */
	facts: 25,
	factChars: 400,
	/** Key words and evidence in a unit: how many, and how long each. */
	listItems: 40,
	listChars: 400,
	/** Periods in the whole tree, and how deep they nest (terms → blocks → weeks). */
	periods: 60,
	periodDepth: 3,
	/** -1 is KG1, 0 is KG2, then grades 1 to 12 (src/lib/grades.ts). */
	gradeMin: GRADE_MIN,
	gradeMax: GRADE_MAX,
	nameEn: 100,
	nameAr: 100,
	author: 80,
	rights: 300,
	periodId: 40,
	periodName: 80,
	title: 150,
	examStyle: 8_000,
	/** Exams in a course, papers in an exam, parts in a paper (task 149). */
	exams: 12,
	papers: 6,
	parts: 8,
	/** A part's notes and marking, and what it reads or hears, in characters. */
	examText: 2_000,
	/** A name or an instruction in an exam, in characters. */
	examName: 300,
	/** An object's id (unit, lesson, skill, exam, paper, part): lowercase letters, digits and -. */
	objectId: 40,
	/** Support languages on one course. */
	support: 3,
	/** How many questions or speakers, and what a question is worth. */
	examCount: 200,
	/** How long a text or a recording is, or how long an answer must be, in words. */
	examWords: 5_000,
	/** A reading time, a pause or a checking time, in seconds. */
	examSeconds: 600,
	/** Unit and lesson numbers. */
	numberMax: 99,
	/** Problems reported for one file, so one broken value can't fill the page. */
	issues: 50,
} as const;

export type BundlePeriod = {
	id: string;
	nameEn: string;
	nameAr: string;
	wholeYear: boolean;
	periods: BundlePeriod[];
};
/** A skill: its permanent id, an optional syllabus code, and its statement. */
export type BundleSkill = { id: string; code: string | null; text: string };
export type BundleLesson = {
	/** Permanent: progress is matched by it, never by number or position. */
	id: string;
	number: number;
	title: string;
	skills: BundleSkill[];
	facts: string[];
	activity: "writing" | "reading" | null;
};
export type BundleUnit = {
	id: string;
	number: number;
	period: string;
	title: string;
	source: "sheet" | "provisional";
	keywords: string[];
	evidence: string[];
	lessons: BundleLesson[];
};

/** The skills a paper of an exam can be about (task 149). */
export const EXAM_SKILLS = [
	"listening",
	"reading",
	"writing",
	"speaking",
	"written",
] as const;
export type ExamSkill = (typeof EXAM_SKILLS)[number];

/**
 * The language codes a file may use: ISO 639-1, two lowercase letters. Which of them an app
 * can teach in is the app's own business, so the format accepts every one (owner, 2026-11-18).
 */
export const LANGUAGE_CODES: readonly string[] = (
	"aa ab ae af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv " +
	"cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho " +
	"hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku " +
	"kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn " +
	"no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm " +
	"sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi " +
	"vo wa wo xh yi yo za zh zu"
).split(" ");

/** A support entry that means the child's own home language, whatever it is. */
export const NATIVE = "native";

/**
 * What a part reads or hears. `conversation` is the general practice shape (a short
 * dialogue or talk); `exercises` is several short recorded exercises in one part;
 * `talk-and-interview` is one recording with a talk and then an interview; `mixed` is
 * anything else made of several kinds. `none` is a part with no text (a writing task).
 * `other` has to say what it is in `description` (task 150).
 */
export const EXAM_MATERIAL_KINDS = [
	"talk",
	"dialogue",
	"conversation",
	"interview",
	"talk-and-interview",
	"report",
	"phone-message",
	"messages",
	"announcement",
	"advert",
	"extracts",
	"exercises",
	"situations",
	"article",
	"story",
	"poem",
	"letter",
	"notices",
	"form",
	"notes",
	"documents",
	"mixed",
	"none",
	"other",
] as const;
export type ExamMaterialKind = (typeof EXAM_MATERIAL_KINDS)[number];

/**
 * The kinds of question a paper asks: the app's own question types
 * (`ListeningQuestion["type"]`, src/server/listening/listening.ts) plus the ones only a
 * written paper has. A test keeps the two lists in step.
 */
export const EXAM_QUESTION_TYPES = [
	"choice",
	"truefalse",
	"gap",
	"short",
	"form",
	"yesno",
	"match",
	"picture",
	"multi",
	"truefalse-justify",
	"extract",
	"essay",
	"calculation",
	"labelling",
	"ordering",
	"other",
] as const;
export type ExamQuestionType = (typeof EXAM_QUESTION_TYPES)[number];

/** How the text of a part is printed, and how a question points into it (task 149). */
export const EXAM_LAYOUTS = [
	"line-numbers",
	"paragraph-numbers",
	"gapped-text",
	"inline-gaps",
	"cloze",
	"word-formation",
] as const;
export type ExamLayout = (typeof EXAM_LAYOUTS)[number];

/** Where a part's text comes from: the course's own units, or outside them. */
export const EXAM_TOPICS = ["units", "outside-units"] as const;
export type ExamTopic = (typeof EXAM_TOPICS)[number];

/**
 * How the exam runs a part (today's `ExamTiming`): the seconds before the recording may
 * start, how many times it plays, how it repeats, the silence between the plays, and the
 * seconds to check the answers afterwards. A number left out is the app's own choice.
 */
export type BundleTiming = {
	readingSeconds: number | null;
	/** How many times the recording is played in all, e.g. 2. */
	plays: number | null;
	/** "segment": each part or extract plays twice in a row; "whole": all of it, then again. */
	repeat: "segment" | "whole" | null;
	pauseSeconds: number | null;
	checkSeconds: number | null;
};

/** What a part reads or hears: what it is, how long, and how the exam plays it. */
export type BundleMaterial = {
	kind: ExamMaterialKind;
	/** What the text or recording is, in words: "a factual article about a city". */
	description: string | null;
	/** How long the text or the recording is, in words. */
	words: [number, number] | null;
	/** How many people speak (listening). */
	speakers: number | null;
	topic: ExamTopic | null;
	layout: ExamLayout[];
	timing: BundleTiming | null;
};

/** What a part asks: how many questions, of which kinds, and what they are worth. */
export type BundleQuestions = {
	count: number;
	/** Question type → how many of that type. */
	types: Partial<Record<ExamQuestionType, number>>;
	/** How many options a choice question has: 3 or 4, as the paper prints. */
	choiceOptions: number | null;
	/** The longest answer, in words. */
	maxWords: number | null;
	/** How long the answer must be, in words: the shortest and the longest (a writing task). */
	answerWords: [number, number] | null;
	/** What every question is worth, when they are all worth the same. */
	marksEach: number | null;
	/** What a question of each type is worth, for the papers that mix them. */
	marksByType: Partial<Record<ExamQuestionType, number>> | null;
	totalMarks: number | null;
	/** The paper prints a worked example (0), already answered. */
	example: boolean | null;
	/** Answers are copied word for word from the text. */
	copiedExactly: boolean | null;
};

/**
 * One part of a paper: what is read or heard, and what is asked (task 149). `notes` is the
 * author's own description of the part, the old `brief`: the writer reads it as DATA,
 * never as instructions, so it travels in the material block (task 150).
 */
export type BundlePart = {
	/** A permanent key, e.g. "ar9-l1"; practice made for it stays when the part keeps it. */
	id: string;
	/** The part's name in the paper's language. */
	name: string;
	/** The same name in English, for the line under an Arabic or French title. */
	nameEn: string | null;
	/** The paper's instruction, paraphrased, in the paper's language. */
	instruction: string | null;
	instructionEn: string | null;
	marks: number | null;
	minutes: number | null;
	material: BundleMaterial;
	questions: BundleQuestions;
	notes: string | null;
	/** How marks are given, in the author's words. */
	marking: string | null;
};

/** One paper of an exam: one sitting and one skill, with its parts in order. */
export type BundlePaper = {
	id: string;
	name: string;
	skill: ExamSkill;
	/** The paper's language, when it is not the course's teaching language. */
	language: string | null;
	minutes: number | null;
	marks: number | null;
	parts: BundlePart[];
};

/** One exam of a course: a period's test, or the whole year's (task 149). */
export type BundleExam = {
	id: string;
	/** A period id of the bundle; null for an exam that covers the whole year. */
	period: string | null;
	name: string;
	papers: BundlePaper[];
};

/** One course: a subject taught in one grade in one language. */
export type BundleCourse = {
	grade: number;
	subject: string;
	/** The language the course is taught in: lessons, replies, everything. */
	language: string;
	/** Languages that may help the child (explaining, and being understood); "native" is the child's own. */
	support: string[];
	examStyle: string | null;
	exams: BundleExam[];
	units: BundleUnit[];
};
export type Bundle = {
	id: string;
	version: number;
	nameEn: string;
	nameAr: string;
	author: string;
	rights: string;
	periods: BundlePeriod[];
	courses: BundleCourse[];
};

/** One problem in a bundle file: where it is (e.g. "courses[0].units[2].title") and what is wrong. */
export type BundleIssue = { path: string; message: string };

export type BundleResult =
	| { ok: true; bundle: Bundle }
	| { ok: false; issues: BundleIssue[] };

const FORMAT = "mr-zaki-curriculum";
/** The one format version (2026-11-18: earlier drafts were withdrawn, not kept readable). */
export const FORMAT_VERSION = 1;
const NOT_JSON = "The file is not valid JSON.";
const OLD_VERSION =
	"This file was made by an older Studio. Open its project in the new Studio and export it again.";

const BUNDLE_KEYS = [
	"format",
	"formatVersion",
	"id",
	"version",
	"nameEn",
	"nameAr",
	"author",
	"rights",
	"periods",
	"courses",
];
const PERIOD_KEYS = ["id", "nameEn", "nameAr", "wholeYear", "periods"];
const COURSE_KEYS = [
	"grade",
	"subject",
	"language",
	"support",
	"examStyle",
	"exams",
	"units",
];
const EXAM_KEYS = ["id", "period", "name", "papers"];
const PAPER_KEYS = [
	"id",
	"name",
	"skill",
	"language",
	"minutes",
	"marks",
	"parts",
];
const PART_KEYS = [
	"id",
	"name",
	"nameEn",
	"instruction",
	"instructionEn",
	"marks",
	"minutes",
	"material",
	"questions",
	"notes",
	"marking",
];
const MATERIAL_KEYS = [
	"kind",
	"description",
	"words",
	"speakers",
	"topic",
	"layout",
	"timing",
];
const QUESTIONS_KEYS = [
	"count",
	"types",
	"choiceOptions",
	"maxWords",
	"marksEach",
	"marksByType",
	"totalMarks",
	"example",
	"copiedExactly",
	"answerWords",
];
const TIMING_KEYS = [
	"readingSeconds",
	"plays",
	"repeat",
	"pauseSeconds",
	"checkSeconds",
];
const UNIT_KEYS = [
	"id",
	"number",
	"period",
	"title",
	"source",
	"keywords",
	"evidence",
	"lessons",
];
const LESSON_KEYS = ["id", "number", "title", "skills", "facts", "activity"];
const SKILL_KEYS = ["id", "code", "text"];

/** A lowercase UUID, as the bundle id is written (exported so an admin's block checks it). */
export const BUNDLE_ID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** A period id or an object id: lowercase letters, digits and -. */
const PERIOD_ID = /^[a-z0-9-]+$/;

/**
 * The Unicode categories no text may contain: control, private-use, surrogate and format
 * characters. Cf is how the zero-width characters, the direction overrides, the soft hyphen,
 * the byte-order mark and the tag block are found without listing them.
 */
const SUSPECT = /[\p{Cc}\p{Co}\p{Cs}\p{Cf}]/gu;
/**
 * Invisible characters outside those categories: the space-like fillers and the variation
 * selectors, except U+FE0E and U+FE0F, which emoji use and which therefore pass.
 */
const HIDDEN =
	/\u034F|\u17B4|\u17B5|[\u115F\u1160\u2800\u3164\uFFA0]|[\uFE00-\uFE0D\u180B-\u180D\u180F]|[\u{E0100}-\u{E01EF}]/gu;
const CONTROL = /\p{Cc}/u;
const PRIVATE = /[\p{Co}\p{Cs}]/u;
/** Format characters that print a visible sign: used by Arabic and other scripts. */
const VISIBLE_FORMAT = [
	[0x0600, 0x0605],
	[0x06dd, 0x06dd],
	[0x070f, 0x070f],
	[0x0890, 0x0891],
	[0x08e2, 0x08e2],
] as const;
type Json = Record<string, unknown>;
type Walk = { issues: BundleIssue[] };

/** Writes U+XXXX for a character the author can't see. */
function codePoint(cp: number): string {
	return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

function add(walk: Walk, path: string, message: string) {
	if (walk.issues.length < BUNDLE_LIMITS.issues)
		walk.issues.push({ path, message });
}

/** True once the file has as many problems as we report. */
function full(walk: Walk): boolean {
	return walk.issues.length >= BUNDLE_LIMITS.issues;
}

function field(path: string, key: string): string {
	return path === "" ? key : `${path}.${key}`;
}

function entry(path: string, index: number): string {
	return `${path}[${index}]`;
}

/** Reads only a key the file really has: a bundle's prototype must never supply a value. */
function read(value: Json, key: string): unknown {
	return Object.hasOwn(value, key) ? value[key] : undefined;
}

function asObject(value: unknown, path: string, walk: Walk): Json | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		add(walk, path, "expected an object");
		return null;
	}
	return value as Json;
}

function asArray(value: unknown, path: string, walk: Walk): unknown[] | null {
	if (!Array.isArray(value)) {
		add(walk, path, "expected an array");
		return null;
	}
	return value;
}

/** Every key the format doesn't list is a problem: unknown fields change meaning silently. */
function checkKeys(
	value: Json,
	allowed: readonly string[],
	path: string,
	walk: Walk,
) {
	for (const key of Object.keys(value)) {
		if (!allowed.includes(key))
			add(walk, field(path, key), `unknown field "${key}"`);
	}
}

function asInt(
	value: unknown,
	path: string,
	min: number,
	max: number,
	walk: Walk,
): number | null {
	if (
		typeof value !== "number" ||
		!Number.isInteger(value) ||
		value < min ||
		value > max
	) {
		add(walk, path, `expected an integer from ${min} to ${max}`);
		return null;
	}
	return value;
}

/**
 * Marks come in whole and half numbers, from 0 to `max` (task 152): real papers give half
 * a mark a question, and 0.25 has no place on one.
 */
function asMarks(
	value: unknown,
	path: string,
	min: number,
	max: number,
	walk: Walk,
): number | null {
	if (
		typeof value !== "number" ||
		!Number.isFinite(value) ||
		value < min ||
		value > max ||
		!Number.isInteger(value * 2)
	) {
		add(walk, path, `expected marks in halves from ${min} to ${max}, e.g. 7.5`);
		return null;
	}
	return value;
}

function asBoolean(value: unknown, path: string, walk: Walk): boolean | null {
	if (typeof value !== "boolean") {
		add(walk, path, "expected true or false");
		return null;
	}
	return value;
}

function asOneOf<T extends string>(
	value: unknown,
	path: string,
	options: readonly T[],
	walk: Walk,
): T | null {
	if (typeof value !== "string" || !options.includes(value as T)) {
		add(walk, path, `expected one of ${options.join(", ")}`);
		return null;
	}
	return value as T;
}

function isVisibleFormat(cp: number): boolean {
	for (const [low, high] of VISIBLE_FORMAT) {
		if (cp >= low && cp <= high) return true;
	}
	return false;
}

/** The first character a text may not contain, as a message, or null. */
function badCharacter(text: string, multiline: boolean): string | null {
	let found: { index: number; ch: string } | null = null;
	for (const pattern of [SUSPECT, HIDDEN]) {
		for (const match of text.matchAll(pattern)) {
			const ch = match[0];
			const cp = ch.codePointAt(0) ?? 0;
			if (ch === "\n" && multiline) continue;
			if (isVisibleFormat(cp)) continue;
			const index = match.index ?? 0;
			if (found === null || index < found.index) found = { index, ch };
			break;
		}
	}
	if (found === null) return null;
	const cp = found.ch.codePointAt(0) ?? 0;
	if (CONTROL.test(found.ch))
		return `contains a control character ${codePoint(cp)}`;
	if (PRIVATE.test(found.ch))
		return `contains a private-use or surrogate character ${codePoint(cp)}`;
	return `contains an invisible character ${codePoint(cp)}`;
}

/**
 * One text: normalised to NFC and trimmed, non-empty, within `max` characters, and free of
 * hidden characters and web addresses. Multi-line texts (an exam style) keep their line
 * breaks, written as "\n".
 */
function asText(
	value: unknown,
	path: string,
	max: number,
	walk: Walk,
	multiline = false,
): string | null {
	if (typeof value !== "string") {
		add(walk, path, "expected a non-empty string");
		return null;
	}
	let text = multiline
		? value.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
		: value;
	text = text.normalize("NFC").trim();
	if (text === "") {
		add(walk, path, "expected a non-empty string");
		return null;
	}
	if (text.length > max) {
		add(walk, path, `at most ${max} characters`);
		return null;
	}
	const bad = badCharacter(text, multiline);
	if (bad !== null) {
		add(walk, path, bad);
		return null;
	}
	if (hasWebAddress(text)) {
		add(walk, path, "remove the web address");
		return null;
	}
	return text;
}

/** One text checked against the bundle's rules: the cleaned text, or the first problem. */
export type TextCheck =
	| { ok: true; text: string }
	| { ok: false; message: string };

/**
 * Checks one text the way parseBundle does, for a form or another file that has to hold
 * what the bundle will hold (the Studio's project file, task 151). Same limits, same
 * plain-text rules, so the two can't disagree about which names are allowed.
 */
export function checkText(
	value: unknown,
	max: number,
	multiline = false,
): TextCheck {
	const walk: Walk = { issues: [] };
	const text = asText(value, "", max, walk, multiline);
	if (text === null)
		return { ok: false, message: walk.issues[0]?.message ?? "invalid text" };
	return { ok: true, text };
}

/** A list of short texts (key words, evidence, facts); missing means none. */
function asTextList(
	value: unknown,
	path: string,
	name: string,
	maxItems: number,
	maxChars: number,
	walk: Walk,
): string[] | null {
	if (value === undefined) return [];
	const list = asArray(value, path, walk);
	if (list === null) return null;
	if (list.length > maxItems) {
		add(walk, path, `at most ${maxItems} ${name}`);
		return null;
	}
	const out: string[] = [];
	let bad = false;
	for (let i = 0; i < list.length && !full(walk); i += 1) {
		const text = asText(list[i], entry(path, i), maxChars, walk);
		if (text === null) bad = true;
		else out.push(text);
	}
	return bad ? null : out;
}

function asId(value: unknown, walk: Walk): string | null {
	if (typeof value === "string" && BUNDLE_ID.test(value)) return value;
	add(
		walk,
		"id",
		"expected a lowercase UUID, e.g. 6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10",
	);
	return null;
}

function asSubject(
	value: unknown,
	path: string,
	walk: Walk,
	subjectIds: readonly string[],
): string | null {
	if (typeof value !== "string") {
		add(walk, path, "expected a subject id");
		return null;
	}
	if (!subjectIds.includes(value)) {
		add(walk, path, `unknown subject "${value}"`);
		return null;
	}
	return value;
}

/** One language code from LANGUAGE_CODES. */
function asLanguage(value: unknown, path: string, walk: Walk): string | null {
	if (typeof value !== "string" || !LANGUAGE_CODES.includes(value)) {
		add(walk, path, "expected a two-letter language code, e.g. en, ar, fr");
		return null;
	}
	return value;
}

/** The ids already used in one course, per kind: an id is unique among its own kind there. */
type CourseIds = {
	units: Set<string>;
	lessons: Set<string>;
	skills: Set<string>;
	exams: Set<string>;
	papers: Set<string>;
	parts: Set<string>;
};

function courseIds(): CourseIds {
	return {
		units: new Set(),
		lessons: new Set(),
		skills: new Set(),
		exams: new Set(),
		papers: new Set(),
		parts: new Set(),
	};
}

/**
 * An object's permanent id: required, lowercase letters, digits and -, and not used twice
 * by its kind in the course. Readers match progress by it, never by number or position.
 */
function asObjectId(
	raw: Json,
	path: string,
	walk: Walk,
	seen: Set<string>,
	kind: string,
): string | null {
	const id = asText(
		read(raw, "id"),
		field(path, "id"),
		BUNDLE_LIMITS.objectId,
		walk,
	);
	if (id === null) return null;
	if (!PERIOD_ID.test(id)) {
		add(walk, field(path, "id"), "use lowercase letters, digits and -");
		return null;
	}
	if (seen.has(id)) {
		add(walk, field(path, "id"), `${kind} id "${id}" is used twice in this course`);
		return null;
	}
	seen.add(id);
	return id;
}

/** Every period id of the year, at any depth: a term exam names a term, a unit a block. */
function collectPeriodIds(periods: BundlePeriod[], into: Set<string>) {
	for (const period of periods) {
		into.add(period.id);
		collectPeriodIds(period.periods, into);
	}
}

/** Units sit in a leaf period, so the year structure has to name one. */
function checkUnitPeriods(
	courses: BundleCourse[],
	periods: BundlePeriod[],
	walk: Walk,
) {
	const leaves = new Set<string>();
	const walkPeriods = (list: BundlePeriod[]) => {
		for (const period of list) {
			if (period.periods.length > 0) walkPeriods(period.periods);
			else leaves.add(period.id);
		}
	};
	walkPeriods(periods);
	for (const [i, course] of courses.entries()) {
		for (const [j, unit] of course.units.entries()) {
			if (!leaves.has(unit.period))
				add(
					walk,
					`courses[${i}].units[${j}].period`,
					`"${unit.period}" is not a leaf period of this bundle`,
				);
		}
	}
}

function parseSkill(
	value: unknown,
	path: string,
	walk: Walk,
	ids: CourseIds,
): BundleSkill | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		add(walk, path, "expected {id, text} or {id, code, text}");
		return null;
	}
	const raw = value as Json;
	checkKeys(raw, SKILL_KEYS, path, walk);
	const id = asObjectId(raw, path, walk, ids.skills, "skill");
	const codeRaw = read(raw, "code");
	const code =
		codeRaw === undefined
			? null
			: asText(codeRaw, field(path, "code"), BUNDLE_LIMITS.skillCodeChars, walk);
	const text = asText(
		read(raw, "text"),
		field(path, "text"),
		BUNDLE_LIMITS.skillChars,
		walk,
	);
	if (id === null || text === null || (code === null && codeRaw !== undefined))
		return null;
	return { id, code, text };
}

function parseSkills(
	value: unknown,
	path: string,
	walk: Walk,
	ids: CourseIds,
): BundleSkill[] | null {
	const list = asArray(value, path, walk);
	if (list === null) return null;
	if (list.length === 0) {
		add(walk, path, "a lesson needs at least one skill");
		return null;
	}
	if (list.length > BUNDLE_LIMITS.skills) {
		add(walk, path, `a lesson has at most ${BUNDLE_LIMITS.skills} skills`);
		return null;
	}
	const out: BundleSkill[] = [];
	let bad = false;
	for (let i = 0; i < list.length && !full(walk); i += 1) {
		const skill = parseSkill(list[i], entry(path, i), walk, ids);
		if (skill === null) bad = true;
		else out.push(skill);
	}
	return bad ? null : out;
}

function parseLesson(
	value: unknown,
	path: string,
	walk: Walk,
	numbers: Set<number>,
	ids: CourseIds,
): BundleLesson | null {
	const raw = asObject(value, path, walk);
	if (raw === null) return null;
	checkKeys(raw, LESSON_KEYS, path, walk);
	const id = asObjectId(raw, path, walk, ids.lessons, "lesson");
	const number = asInt(
		read(raw, "number"),
		field(path, "number"),
		0,
		BUNDLE_LIMITS.numberMax,
		walk,
	);
	if (number !== null) {
		if (numbers.has(number))
			add(walk, path, `lesson number ${number} is used twice`);
		else numbers.add(number);
	}
	const title = asText(
		read(raw, "title"),
		field(path, "title"),
		BUNDLE_LIMITS.title,
		walk,
	);
	const skills = parseSkills(
		read(raw, "skills"),
		field(path, "skills"),
		walk,
		ids,
	);
	const facts = asTextList(
		read(raw, "facts"),
		field(path, "facts"),
		"facts",
		BUNDLE_LIMITS.facts,
		BUNDLE_LIMITS.factChars,
		walk,
	);
	const activityRaw = read(raw, "activity");
	let activity: BundleLesson["activity"] = null;
	if (activityRaw !== undefined) {
		const parsed = asOneOf(
			activityRaw,
			field(path, "activity"),
			["writing", "reading"] as const,
			walk,
		);
		if (parsed === null) return null;
		activity = parsed;
	}
	if (
		id === null ||
		number === null ||
		title === null ||
		skills === null ||
		facts === null
	)
		return null;
	return { id, number, title, skills, facts, activity };
}

function parseLessons(
	value: unknown,
	path: string,
	walk: Walk,
	ids: CourseIds,
): BundleLesson[] | null {
	const list = asArray(value, path, walk);
	if (list === null) return null;
	if (list.length === 0) {
		add(walk, path, "a unit needs at least one lesson");
		return null;
	}
	if (list.length > BUNDLE_LIMITS.lessons) {
		add(walk, path, `a unit has at most ${BUNDLE_LIMITS.lessons} lessons`);
		return null;
	}
	const numbers = new Set<number>();
	const out: BundleLesson[] = [];
	let bad = false;
	for (let i = 0; i < list.length && !full(walk); i += 1) {
		const lesson = parseLesson(list[i], entry(path, i), walk, numbers, ids);
		if (lesson === null) bad = true;
		else out.push(lesson);
	}
	return bad ? null : out;
}

function parseUnit(
	value: unknown,
	path: string,
	walk: Walk,
	numbers: Set<number>,
	ids: CourseIds,
): BundleUnit | null {
	const raw = asObject(value, path, walk);
	if (raw === null) return null;
	checkKeys(raw, UNIT_KEYS, path, walk);
	const id = asObjectId(raw, path, walk, ids.units, "unit");
	const number = asInt(
		read(raw, "number"),
		field(path, "number"),
		0,
		BUNDLE_LIMITS.numberMax,
		walk,
	);
	if (number !== null) {
		if (numbers.has(number))
			add(walk, path, `unit number ${number} is used twice`);
		else numbers.add(number);
	}
	const period = asText(
		read(raw, "period"),
		field(path, "period"),
		BUNDLE_LIMITS.periodId,
		walk,
	);
	const title = asText(
		read(raw, "title"),
		field(path, "title"),
		BUNDLE_LIMITS.title,
		walk,
	);
	const sourceRaw = read(raw, "source");
	let source: BundleUnit["source"] = "sheet";
	if (sourceRaw !== undefined) {
		const parsed = asOneOf(
			sourceRaw,
			field(path, "source"),
			["sheet", "provisional"] as const,
			walk,
		);
		if (parsed === null) return null;
		source = parsed;
	}
	const keywords = asTextList(
		read(raw, "keywords"),
		field(path, "keywords"),
		"key words",
		BUNDLE_LIMITS.listItems,
		BUNDLE_LIMITS.listChars,
		walk,
	);
	const evidence = asTextList(
		read(raw, "evidence"),
		field(path, "evidence"),
		"evidence",
		BUNDLE_LIMITS.listItems,
		BUNDLE_LIMITS.listChars,
		walk,
	);
	const lessons = parseLessons(
		read(raw, "lessons"),
		field(path, "lessons"),
		walk,
		ids,
	);
	if (
		id === null ||
		number === null ||
		period === null ||
		title === null ||
		keywords === null ||
		evidence === null ||
		lessons === null
	)
		return null;
	return { id, number, period, title, source, keywords, evidence, lessons };
}

function parseUnits(
	value: unknown,
	path: string,
	walk: Walk,
	ids: CourseIds,
): BundleUnit[] | null {
	const list = asArray(value, path, walk);
	if (list === null) return null;
	if (list.length === 0) {
		add(walk, path, "a course needs at least one unit");
		return null;
	}
	if (list.length > BUNDLE_LIMITS.units) {
		add(walk, path, `a course has at most ${BUNDLE_LIMITS.units} units`);
		return null;
	}
	const numbers = new Set<number>();
	const out: BundleUnit[] = [];
	let bad = false;
	for (let i = 0; i < list.length && !full(walk); i += 1) {
		const unit = parseUnit(list[i], entry(path, i), walk, numbers, ids);
		if (unit === null) bad = true;
		else out.push(unit);
	}
	return bad ? null : out;
}

/**
 * One type → how many (or what it is worth). Every key must be a question type, so a typo
 * can't sit in the file unremarked. Counts are whole numbers; marks come in halves, as a
 * paper prints them (task 152).
 */
function parseTypeMap(
	value: unknown,
	path: string,
	walk: Walk,
	marks = false,
): Partial<Record<ExamQuestionType, number>> | null {
	const raw = asObject(value, path, walk);
	if (raw === null) return null;
	checkKeys(raw, EXAM_QUESTION_TYPES, path, walk);
	const out: Partial<Record<ExamQuestionType, number>> = {};
	let bad = false;
	for (const key of Object.keys(raw)) {
		if (!isQuestionType(key)) continue;
		const entered = read(raw, key);
		const count = marks
			? asMarks(entered, field(path, key), 0, BUNDLE_LIMITS.examCount, walk)
			: asInt(entered, field(path, key), 0, BUNDLE_LIMITS.examCount, walk);
		if (count === null) bad = true;
		else out[key] = count;
	}
	return bad ? null : out;
}

function isQuestionType(key: string): key is ExamQuestionType {
	return (EXAM_QUESTION_TYPES as readonly string[]).includes(key);
}

function parseTiming(
	value: unknown,
	path: string,
	walk: Walk,
): BundleTiming | null {
	const raw = asObject(value, path, walk);
	if (raw === null) return null;
	checkKeys(raw, TIMING_KEYS, path, walk);
	let bad = false;
	const number = (key: string, max: number): number | null => {
		const entered = read(raw, key);
		if (entered === undefined) return null;
		const parsed = asInt(entered, field(path, key), 0, max, walk);
		if (parsed === null) bad = true;
		return parsed;
	};
	const repeatRaw = read(raw, "repeat");
	let repeat: BundleTiming["repeat"] = null;
	if (repeatRaw !== undefined) {
		repeat = asOneOf(
			repeatRaw,
			field(path, "repeat"),
			["segment", "whole"] as const,
			walk,
		);
		if (repeat === null) bad = true;
	}
	const readingSeconds = number("readingSeconds", BUNDLE_LIMITS.examSeconds);
	// How many times the recording plays is a count, not a length of time.
	const plays = number("plays", BUNDLE_LIMITS.examCount);
	const pauseSeconds = number("pauseSeconds", BUNDLE_LIMITS.examSeconds);
	const checkSeconds = number("checkSeconds", BUNDLE_LIMITS.examSeconds);
	if (bad) return null;
	return { readingSeconds, plays, repeat, pauseSeconds, checkSeconds };
}

function parseMaterial(
	value: unknown,
	path: string,
	walk: Walk,
): BundleMaterial | null {
	const raw = asObject(value, path, walk);
	if (raw === null) return null;
	checkKeys(raw, MATERIAL_KEYS, path, walk);
	let bad = false;
	const kind = asOneOf(
		read(raw, "kind"),
		field(path, "kind"),
		EXAM_MATERIAL_KINDS,
		walk,
	);
	const text = (key: string): string | null => {
		const entered = read(raw, key);
		if (entered === undefined) return null;
		const parsed = asText(
			entered,
			field(path, key),
			BUNDLE_LIMITS.examText,
			walk,
			// What a part reads or hears may run over several lines (task 152).
			true,
		);
		if (parsed === null) bad = true;
		return parsed;
	};
	const description = text("description");
	// A part that reads or hears something unusual has to say what it is.
	if (
		kind === "other" &&
		description === null &&
		read(raw, "description") === undefined
	)
		add(
			walk,
			field(path, "description"),
			'expected a description when the kind is "other"',
		);
	let words: [number, number] | null = null;
	const wordsRaw = read(raw, "words");
	if (wordsRaw !== undefined) {
		const list = asArray(wordsRaw, field(path, "words"), walk);
		if (list !== null) {
			if (list.length !== 2)
				add(
					walk,
					field(path, "words"),
					"expected two numbers: the shortest and the longest",
				);
			else {
				const low = asInt(
					list[0],
					entry(field(path, "words"), 0),
					0,
					BUNDLE_LIMITS.examWords,
					walk,
				);
				const high = asInt(
					list[1],
					entry(field(path, "words"), 1),
					0,
					BUNDLE_LIMITS.examWords,
					walk,
				);
				if (low !== null && high !== null) {
					if (low > high)
						add(
							walk,
							field(path, "words"),
							"the first number must not be larger than the second",
						);
					else words = [low, high];
				}
			}
		}
	}
	const number = (key: string): number | null => {
		const entered = read(raw, key);
		if (entered === undefined) return null;
		const parsed = asInt(
			entered,
			field(path, key),
			0,
			BUNDLE_LIMITS.examCount,
			walk,
		);
		if (parsed === null) bad = true;
		return parsed;
	};
	const speakers = number("speakers");
	const topicRaw = read(raw, "topic");
	let topic: ExamTopic | null = null;
	if (topicRaw !== undefined) {
		topic = asOneOf(topicRaw, field(path, "topic"), EXAM_TOPICS, walk);
		if (topic === null) bad = true;
	}
	const layoutRaw = read(raw, "layout");
	const layout: ExamLayout[] = [];
	if (layoutRaw !== undefined) {
		const list = asArray(layoutRaw, field(path, "layout"), walk);
		if (list !== null) {
			for (let i = 0; i < list.length; i += 1) {
				const flag = asOneOf(
					list[i],
					entry(field(path, "layout"), i),
					EXAM_LAYOUTS,
					walk,
				);
				if (flag === null) bad = true;
				else layout.push(flag);
			}
		}
	}
	const timingRaw = read(raw, "timing");
	let timing: BundleTiming | null = null;
	if (timingRaw !== undefined) {
		timing = parseTiming(timingRaw, field(path, "timing"), walk);
		if (timing === null) bad = true;
	}
	if (kind === null || bad) return null;
	return { kind, description, words, speakers, topic, layout, timing };
}

function parseQuestions(
	value: unknown,
	path: string,
	walk: Walk,
): BundleQuestions | null {
	const raw = asObject(value, path, walk);
	if (raw === null) return null;
	checkKeys(raw, QUESTIONS_KEYS, path, walk);
	const count = asInt(
		read(raw, "count"),
		field(path, "count"),
		0,
		BUNDLE_LIMITS.examCount,
		walk,
	);
	const types = parseTypeMap(read(raw, "types"), field(path, "types"), walk);
	let bad = count === null || types === null;
	const number = (key: string, min: number, max: number): number | null => {
		const entered = read(raw, key);
		if (entered === undefined) return null;
		const parsed = asInt(entered, field(path, key), min, max, walk);
		if (parsed === null) bad = true;
		return parsed;
	};
	const choiceOptions = number("choiceOptions", 3, 4);
	const maxWords = number("maxWords", 0, BUNDLE_LIMITS.examCount);
	// How long the child's own answer must be (task 174): the shortest number may not be
	// larger than the longest.
	let answerWords: [number, number] | null = null;
	const answerWordsRaw = read(raw, "answerWords");
	if (answerWordsRaw !== undefined) {
		const list = asArray(answerWordsRaw, field(path, "answerWords"), walk);
		if (list !== null) {
			if (list.length !== 2)
				add(
					walk,
					field(path, "answerWords"),
					"expected two numbers: the shortest and the longest",
				);
			else {
				const low = asInt(
					list[0],
					entry(field(path, "answerWords"), 0),
					0,
					BUNDLE_LIMITS.examWords,
					walk,
				);
				const high = asInt(
					list[1],
					entry(field(path, "answerWords"), 1),
					0,
					BUNDLE_LIMITS.examWords,
					walk,
				);
				if (low !== null && high !== null) {
					if (low > high)
						add(
							walk,
							field(path, "answerWords"),
							"the first number must not be larger than the second",
						);
					else answerWords = [low, high];
				}
			}
		}
	}
	// What a question is worth is the one number here that may be a half (task 152).
	const marks = (key: string): number | null => {
		const entered = read(raw, key);
		if (entered === undefined) return null;
		const parsed = asMarks(
			entered,
			field(path, key),
			0,
			BUNDLE_LIMITS.examCount,
			walk,
		);
		if (parsed === null) bad = true;
		return parsed;
	};
	const marksEach = marks("marksEach");
	const totalMarks = marks("totalMarks");
	const marksByTypeRaw = read(raw, "marksByType");
	let marksByType: Partial<Record<ExamQuestionType, number>> | null = null;
	if (marksByTypeRaw !== undefined) {
		marksByType = parseTypeMap(
			marksByTypeRaw,
			field(path, "marksByType"),
			walk,
			true,
		);
		if (marksByType === null) bad = true;
	}
	const boolean = (key: string): boolean | null => {
		const entered = read(raw, key);
		if (entered === undefined) return null;
		const parsed = asBoolean(entered, field(path, key), walk);
		if (parsed === null) bad = true;
		return parsed;
	};
	const example = boolean("example");
	const copiedExactly = boolean("copiedExactly");
	if (bad || count === null || types === null) return null;
	return {
		count,
		types,
		choiceOptions,
		maxWords,
		answerWords,
		marksEach,
		marksByType,
		totalMarks,
		example,
		copiedExactly,
	};
}

function parsePart(
	value: unknown,
	path: string,
	walk: Walk,
	ids: CourseIds,
): BundlePart | null {
	const raw = asObject(value, path, walk);
	if (raw === null) return null;
	checkKeys(raw, PART_KEYS, path, walk);
	let bad = false;
	const text = (key: string, max: number, multiline = false): string | null => {
		const entered = read(raw, key);
		if (entered === undefined) return null;
		const parsed = asText(entered, field(path, key), max, walk, multiline);
		if (parsed === null) bad = true;
		return parsed;
	};
	const number = (key: string): number | null => {
		const entered = read(raw, key);
		if (entered === undefined) return null;
		const parsed = asInt(
			entered,
			field(path, key),
			0,
			BUNDLE_LIMITS.examCount,
			walk,
		);
		if (parsed === null) bad = true;
		return parsed;
	};
	const marks = (key: string): number | null => {
		const entered = read(raw, key);
		if (entered === undefined) return null;
		const parsed = asMarks(
			entered,
			field(path, key),
			0,
			BUNDLE_LIMITS.examCount,
			walk,
		);
		if (parsed === null) bad = true;
		return parsed;
	};
	const id = asObjectId(raw, path, walk, ids.parts, "part");
	const name = text("name", BUNDLE_LIMITS.examName);
	const nameEn = text("nameEn", BUNDLE_LIMITS.examName);
	const instruction = text("instruction", BUNDLE_LIMITS.examName);
	const instructionEn = text("instructionEn", BUNDLE_LIMITS.examName);
	const partMarks = marks("marks");
	const minutes = number("minutes");
	const material = parseMaterial(
		read(raw, "material"),
		field(path, "material"),
		walk,
	);
	const questions = parseQuestions(
		read(raw, "questions"),
		field(path, "questions"),
		walk,
	);
	// The author's words about the part may run over several lines (task 152).
	const notes = text("notes", BUNDLE_LIMITS.examText, true);
	const marking = text("marking", BUNDLE_LIMITS.examText, true);
	if (
		bad ||
		id === null ||
		name === null ||
		material === null ||
		questions === null
	)
		return null;
	return {
		id,
		name,
		nameEn,
		instruction,
		instructionEn,
		marks: partMarks,
		minutes,
		material,
		questions,
		notes,
		marking,
	};
}

function parseParts(
	value: unknown,
	path: string,
	walk: Walk,
	ids: CourseIds,
): BundlePart[] | null {
	const list = asArray(value, path, walk);
	if (list === null) return null;
	if (list.length === 0) {
		add(walk, path, "a paper needs at least one part");
		return null;
	}
	if (list.length > BUNDLE_LIMITS.parts) {
		add(walk, path, `a paper has at most ${BUNDLE_LIMITS.parts} parts`);
		return null;
	}
	const out: BundlePart[] = [];
	let bad = false;
	for (let i = 0; i < list.length && !full(walk); i += 1) {
		const part = parsePart(list[i], entry(path, i), walk, ids);
		if (part === null) bad = true;
		else out.push(part);
	}
	return bad ? null : out;
}

function parsePaper(
	value: unknown,
	path: string,
	walk: Walk,
	ids: CourseIds,
): BundlePaper | null {
	const raw = asObject(value, path, walk);
	if (raw === null) return null;
	checkKeys(raw, PAPER_KEYS, path, walk);
	const id = asObjectId(raw, path, walk, ids.papers, "paper");
	const name = asText(
		read(raw, "name"),
		field(path, "name"),
		BUNDLE_LIMITS.examName,
		walk,
	);
	const skill = asOneOf(
		read(raw, "skill"),
		field(path, "skill"),
		EXAM_SKILLS,
		walk,
	);
	let bad = false;
	const number = (key: string): number | null => {
		const entered = read(raw, key);
		if (entered === undefined) return null;
		const parsed = asInt(
			entered,
			field(path, key),
			0,
			BUNDLE_LIMITS.examCount,
			walk,
		);
		if (parsed === null) bad = true;
		return parsed;
	};
	const languageRaw = read(raw, "language");
	let language: string | null = null;
	if (languageRaw !== undefined)
		language = asLanguage(languageRaw, field(path, "language"), walk);
	const minutes = number("minutes");
	const marksRaw = read(raw, "marks");
	let marks: number | null = null;
	if (marksRaw !== undefined) {
		marks = asMarks(
			marksRaw,
			field(path, "marks"),
			0,
			BUNDLE_LIMITS.examCount,
			walk,
		);
		if (marks === null) bad = true;
	}
	const parts = parseParts(
		read(raw, "parts"),
		field(path, "parts"),
		walk,
		ids,
	);
	if (
		id === null ||
		name === null ||
		skill === null ||
		parts === null ||
		bad ||
		(language === null && languageRaw !== undefined)
	)
		return null;
	return { id, name, skill, language, minutes, marks, parts };
}

function parsePapers(
	value: unknown,
	path: string,
	walk: Walk,
	ids: CourseIds,
): BundlePaper[] | null {
	const list = asArray(value, path, walk);
	if (list === null) return null;
	if (list.length === 0) {
		add(walk, path, "an exam needs at least one paper");
		return null;
	}
	if (list.length > BUNDLE_LIMITS.papers) {
		add(walk, path, `an exam has at most ${BUNDLE_LIMITS.papers} papers`);
		return null;
	}
	const out: BundlePaper[] = [];
	let bad = false;
	for (let i = 0; i < list.length && !full(walk); i += 1) {
		const paper = parsePaper(list[i], entry(path, i), walk, ids);
		if (paper === null) bad = true;
		else out.push(paper);
	}
	return bad ? null : out;
}

function parseExam(
	value: unknown,
	path: string,
	walk: Walk,
	ids: CourseIds,
): BundleExam | null {
	const raw = asObject(value, path, walk);
	if (raw === null) return null;
	checkKeys(raw, EXAM_KEYS, path, walk);
	const id = asObjectId(raw, path, walk, ids.exams, "exam");
	const periodRaw = read(raw, "period");
	let period: string | null = null;
	if (periodRaw !== undefined) {
		period = asText(
			periodRaw,
			field(path, "period"),
			BUNDLE_LIMITS.periodId,
			walk,
		);
		if (period === null) return null;
	}
	const name = asText(
		read(raw, "name"),
		field(path, "name"),
		BUNDLE_LIMITS.examName,
		walk,
	);
	const papers = parsePapers(
		read(raw, "papers"),
		field(path, "papers"),
		walk,
		ids,
	);
	if (id === null || name === null || papers === null) return null;
	return { id, period, name, papers };
}

/** A course's exams: none when the key is absent, so an old file still parses. */
function parseExams(
	value: unknown,
	path: string,
	walk: Walk,
	ids: CourseIds,
): BundleExam[] | null {
	if (value === undefined) return [];
	const list = asArray(value, path, walk);
	if (list === null) return null;
	if (list.length === 0) {
		add(walk, path, "a course with exams needs at least one");
		return null;
	}
	if (list.length > BUNDLE_LIMITS.exams) {
		add(walk, path, `a course has at most ${BUNDLE_LIMITS.exams} exams`);
		return null;
	}
	const out: BundleExam[] = [];
	let bad = false;
	for (let i = 0; i < list.length && !full(walk); i += 1) {
		const exam = parseExam(list[i], entry(path, i), walk, ids);
		if (exam === null) bad = true;
		else out.push(exam);
	}
	return bad ? null : out;
}

/**
 * A course's `exams`, checked on their own: the bundle parser and a built-in course file
 * read the same list here, so the two can never disagree about a valid exam (task 149).
 */
export function parseCourseExams(
	value: unknown,
	path = "exams",
): { exams: BundleExam[]; issues: BundleIssue[] } {
	const walk: Walk = { issues: [] };
	const exams = parseExams(value, path, walk, courseIds());
	return { exams: exams ?? [], issues: walk.issues };
}

/**
 * The exams whose `period` is not a period of this year: an exam belongs to a period (a
 * block test, a term exam) or to the whole year, which is written by leaving `period` out.
 * One implementation for a bundle and for a built-in course file.
 */
export function examPeriodIssues(
	exams: readonly BundleExam[],
	periodIds: ReadonlySet<string>,
	base: string,
): BundleIssue[] {
	const issues: BundleIssue[] = [];
	for (const [i, exam] of exams.entries()) {
		if (exam.period !== null && !periodIds.has(exam.period))
			issues.push({
				path: `${base}[${i}].period`,
				message: `"${exam.period}" is not a period of this curriculum`,
			});
	}
	return issues;
}

/** A course's support languages: none when absent; codes or "native", no repeats, never its own. */
function parseSupport(
	value: unknown,
	path: string,
	walk: Walk,
	language: string | null,
): string[] | null {
	if (value === undefined) return [];
	const list = asArray(value, path, walk);
	if (list === null) return null;
	if (list.length === 0 || list.length > BUNDLE_LIMITS.support) {
		add(walk, path, `expected 1 to ${BUNDLE_LIMITS.support} languages`);
		return null;
	}
	const out: string[] = [];
	let bad = false;
	for (let i = 0; i < list.length; i += 1) {
		const at = entry(path, i);
		const code = list[i] === NATIVE ? NATIVE : asLanguage(list[i], at, walk);
		if (code === null) bad = true;
		else if (out.includes(code)) {
			add(walk, at, `"${code}" is listed twice`);
			bad = true;
		} else if (code === language) {
			add(walk, at, "the course's own language is not a support language");
			bad = true;
		} else out.push(code);
	}
	return bad ? null : out;
}

function parseCourse(
	value: unknown,
	path: string,
	walk: Walk,
	subjectIds: readonly string[],
	keys: Set<string>,
): BundleCourse | null {
	const raw = asObject(value, path, walk);
	if (raw === null) return null;
	checkKeys(raw, COURSE_KEYS, path, walk);
	const grade = asInt(
		read(raw, "grade"),
		field(path, "grade"),
		BUNDLE_LIMITS.gradeMin,
		BUNDLE_LIMITS.gradeMax,
		walk,
	);
	const subject = asSubject(
		read(raw, "subject"),
		field(path, "subject"),
		walk,
		subjectIds,
	);
	const language = asLanguage(
		read(raw, "language"),
		field(path, "language"),
		walk,
	);
	const support = parseSupport(
		read(raw, "support"),
		field(path, "support"),
		walk,
		language,
	);
	if (grade !== null && subject !== null && language !== null) {
		const key = `${grade} ${subject} ${language}`;
		if (keys.has(key))
			add(walk, path, `grade ${grade} ${subject} in "${language}" appears twice`);
		else keys.add(key);
	}
	const styleRaw = read(raw, "examStyle");
	let examStyle: string | null = null;
	if (styleRaw !== undefined) {
		examStyle = asText(
			styleRaw,
			field(path, "examStyle"),
			BUNDLE_LIMITS.examStyle,
			walk,
			true,
		);
		if (examStyle === null) return null;
	}
	// Ids are unique within the course, so progress stays with the object it was made on.
	const ids = courseIds();
	const units = parseUnits(read(raw, "units"), field(path, "units"), walk, ids);
	const exams = parseExams(read(raw, "exams"), field(path, "exams"), walk, ids);
	if (
		grade === null ||
		subject === null ||
		language === null ||
		support === null ||
		units === null ||
		exams === null
	)
		return null;
	return { grade, subject, language, support, examStyle, exams, units };
}

function parseCourses(
	value: unknown,
	walk: Walk,
	subjectIds: readonly string[],
): BundleCourse[] | null {
	const list = asArray(value, "courses", walk);
	if (list === null) return null;
	if (list.length === 0) {
		add(walk, "courses", "at least one course");
		return [];
	}
	if (list.length > BUNDLE_LIMITS.courses) {
		add(walk, "courses", `at most ${BUNDLE_LIMITS.courses} courses`);
		return [];
	}
	const keys = new Set<string>();
	const out: BundleCourse[] = [];
	for (let i = 0; i < list.length && !full(walk); i += 1) {
		const course = parseCourse(
			list[i],
			entry("courses", i),
			walk,
			subjectIds,
			keys,
		);
		if (course !== null) out.push(course);
	}
	return out;
}

function parsePeriod(
	value: unknown,
	path: string,
	depth: number,
	walk: Walk,
	ids: Set<string>,
	tally: { periods: number },
): BundlePeriod | null {
	const raw = asObject(value, path, walk);
	if (raw === null) return null;
	checkKeys(raw, PERIOD_KEYS, path, walk);
	tally.periods += 1;
	const id = asText(
		read(raw, "id"),
		field(path, "id"),
		BUNDLE_LIMITS.periodId,
		walk,
	);
	if (id !== null) {
		if (!PERIOD_ID.test(id))
			add(walk, field(path, "id"), "use lowercase letters, digits and -");
		else if (ids.has(id))
			add(walk, field(path, "id"), `period "${id}" is used twice`);
		else ids.add(id);
	}
	const nameEn = asText(
		read(raw, "nameEn"),
		field(path, "nameEn"),
		BUNDLE_LIMITS.periodName,
		walk,
	);
	const nameArRaw = read(raw, "nameAr");
	const nameAr =
		nameArRaw === undefined
			? nameEn
			: asText(
					nameArRaw,
					field(path, "nameAr"),
					BUNDLE_LIMITS.periodName,
					walk,
				);
	const wholeYearRaw = read(raw, "wholeYear");
	let wholeYear = false;
	if (wholeYearRaw !== undefined) {
		const parsed = asBoolean(wholeYearRaw, field(path, "wholeYear"), walk);
		if (parsed === null) return null;
		wholeYear = parsed;
	}
	let children: BundlePeriod[] = [];
	const childrenRaw = read(raw, "periods");
	if (childrenRaw !== undefined) {
		const list = asArray(childrenRaw, field(path, "periods"), walk);
		if (list === null) return null;
		if (list.length > 0) {
			if (depth >= BUNDLE_LIMITS.periodDepth) {
				add(
					walk,
					field(path, "periods"),
					`at most ${BUNDLE_LIMITS.periodDepth} levels of periods`,
				);
				return null;
			}
			const parsed = parsePeriodList(
				list,
				field(path, "periods"),
				depth + 1,
				walk,
				ids,
				tally,
			);
			if (parsed === null) return null;
			children = parsed;
		}
	}
	if (id === null || nameEn === null || nameAr === null) return null;
	return { id, nameEn, nameAr, wholeYear, periods: children };
}

function parsePeriodList(
	list: unknown[],
	path: string,
	depth: number,
	walk: Walk,
	ids: Set<string>,
	tally: { periods: number },
): BundlePeriod[] | null {
	const out: BundlePeriod[] = [];
	let bad = false;
	for (let i = 0; i < list.length && !full(walk); i += 1) {
		const period = parsePeriod(
			list[i],
			entry(path, i),
			depth,
			walk,
			ids,
			tally,
		);
		if (period === null) bad = true;
		else out.push(period);
	}
	return bad ? null : out;
}

function parsePeriods(
	value: unknown,
	path: string,
	walk: Walk,
	ids: Set<string>,
	tally: { periods: number },
): BundlePeriod[] | null {
	const list = asArray(value, path, walk);
	if (list === null) return null;
	if (list.length === 0) {
		add(walk, path, "expected at least one period");
		return null;
	}
	return parsePeriodList(list, path, 1, walk, ids, tally);
}

/** Checks a bundle file's text; `subjectIds` are the subjects Mr. Zaki knows. Never throws. */
export function parseBundle(
	text: string,
	subjectIds: readonly string[],
): BundleResult {
	if (typeof text !== "string")
		return { ok: false, issues: [{ path: "", message: NOT_JSON }] };
	if (text.length > BUNDLE_LIMITS.chars) {
		return {
			ok: false,
			issues: [
				{
					path: "",
					message: `The file is larger than ${BUNDLE_LIMITS.chars} characters`,
				},
			],
		};
	}
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return { ok: false, issues: [{ path: "", message: NOT_JSON }] };
	}
	const twice = duplicateKey(text);
	if (twice !== null)
		return {
			ok: false,
			issues: [{ path: twice.path, message: `key "${twice.key}" appears twice` }],
		};
	const walk: Walk = { issues: [] };
	const root = asObject(value, "", walk);
	if (root === null) return { ok: false, issues: walk.issues };
	// An older file is told so once, rather than buried under every field it lacks.
	if (
		read(root, "format") === FORMAT &&
		read(root, "formatVersion") !== FORMAT_VERSION
	)
		return {
			ok: false,
			issues: [{ path: "formatVersion", message: OLD_VERSION }],
		};

	checkKeys(root, BUNDLE_KEYS, "", walk);
	if (read(root, "format") !== FORMAT)
		add(walk, "format", `expected "${FORMAT}"`);
	const formatVersion =
		read(root, "formatVersion") === FORMAT_VERSION ? FORMAT_VERSION : null;
	if (formatVersion === null)
		add(walk, "formatVersion", `expected ${FORMAT_VERSION}`);
	const id = asId(read(root, "id"), walk);
	const version = asInt(
		read(root, "version"),
		"version",
		1,
		BUNDLE_LIMITS.version,
		walk,
	);
	const nameEn = asText(
		read(root, "nameEn"),
		"nameEn",
		BUNDLE_LIMITS.nameEn,
		walk,
	);
	const nameArRaw = read(root, "nameAr");
	const nameAr =
		nameArRaw === undefined
			? nameEn
			: asText(nameArRaw, "nameAr", BUNDLE_LIMITS.nameAr, walk);
	const author = asText(
		read(root, "author"),
		"author",
		BUNDLE_LIMITS.author,
		walk,
	);
	const rights = asText(
		read(root, "rights"),
		"rights",
		BUNDLE_LIMITS.rights,
		walk,
	);

	const ids = new Set<string>();
	const tally = { periods: 0 };
	const periods = parsePeriods(
		read(root, "periods"),
		"periods",
		walk,
		ids,
		tally,
	);
	if (tally.periods > BUNDLE_LIMITS.periods)
		add(walk, "periods", `at most ${BUNDLE_LIMITS.periods} periods`);

	const courses = parseCourses(read(root, "courses"), walk, subjectIds);
	if (courses !== null && periods !== null) {
		checkUnitPeriods(courses, periods, walk);
		const every = new Set<string>();
		collectPeriodIds(periods, every);
		for (const [i, course] of courses.entries())
			for (const issue of examPeriodIssues(
				course.exams,
				every,
				`courses[${i}].exams`,
			))
				add(walk, issue.path, issue.message);
	}

	if (
		walk.issues.length > 0 ||
		formatVersion === null ||
		id === null ||
		version === null ||
		nameEn === null ||
		nameAr === null ||
		author === null ||
		rights === null ||
		periods === null ||
		courses === null
	)
		return { ok: false, issues: walk.issues };

	return {
		ok: true,
		bundle: { id, version, nameEn, nameAr, author, rights, periods, courses },
	};
}

/**
 * The first key written twice in one object, with where it is, or null. JSON.parse keeps the
 * last copy silently, so the text is scanned on its own: strings and their escapes are read
 * properly, and the work is one pass over the text. Only called on text JSON.parse accepted.
 */
export function duplicateKey(
	text: string,
): { path: string; key: string } | null {
	type Frame = {
		keys: Set<string> | null;
		path: string;
		index: number;
		key: string | null;
		expectKey: boolean;
	};
	const stack: Frame[] = [];
	let at = 0;
	const escapes: Record<string, string> = {
		n: "\n",
		t: "\t",
		r: "\r",
		b: "\b",
		f: "\f",
	};
	const readString = (): string => {
		// `at` is on the opening quote.
		let out = "";
		at += 1;
		while (at < text.length) {
			const ch = text.charAt(at);
			if (ch === '"') {
				at += 1;
				return out;
			}
			if (ch === "\\") {
				const next = text.charAt(at + 1);
				if (next === "u") {
					out += String.fromCharCode(
						Number.parseInt(text.slice(at + 2, at + 6), 16),
					);
					at += 6;
					continue;
				}
				out += escapes[next] ?? next;
				at += 2;
				continue;
			}
			out += ch;
			at += 1;
		}
		return out;
	};
	while (at < text.length) {
		const ch = text.charAt(at);
		const top = stack.at(-1);
		if (ch === "{" || ch === "[") {
			let path = "";
			if (top !== undefined)
				path =
					top.keys === null
						? entry(top.path, top.index)
						: field(top.path, top.key ?? "");
			stack.push({
				keys: ch === "{" ? new Set() : null,
				path,
				index: 0,
				key: null,
				expectKey: ch === "{",
			});
			at += 1;
		} else if (ch === "}" || ch === "]") {
			stack.pop();
			at += 1;
		} else if (ch === ",") {
			if (top !== undefined) {
				if (top.keys === null) top.index += 1;
				else top.expectKey = true;
			}
			at += 1;
		} else if (ch === '"') {
			const value = readString();
			if (top?.keys && top.expectKey) {
				if (top.keys.has(value))
					return { path: field(top.path, value), key: value };
				top.keys.add(value);
				top.key = value;
				top.expectKey = false;
			}
		} else at += 1;
	}
	return null;
}
