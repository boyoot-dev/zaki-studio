// A Studio project: the curriculum.json at the root of the folder, the folders the "New
// curriculum" wizard creates, and the pure helpers behind both. Every text is checked with
// the bundle's own rules (./format/bundle), so the Studio cannot write a project the server
// would refuse at import. Folder names live in the file, so a folder renamed by hand (in
// Arabic, say) stays mapped to its subject, and the periods are exactly the bundle's period
// shape (docs/BUNDLES.md), so exporting is a copy rather than a translation.

import {
	BUNDLE_ID,
	BUNDLE_LIMITS,
	type BundlePeriod,
	checkText,
} from "./format/bundle";
import { GRADE_MAX, GRADE_MIN, gradeName } from "./format/grades";

/** The marker in curriculum.json that says this folder is a Studio project. */
export const PROJECT_FORMAT = "mr-zaki-studio-project";
/** The project file's own shape. It is not the bundle's version, which export bumps later. */
export const PROJECT_FORMAT_VERSION = 1;
/** The file at the root of the project folder. */
export const PROJECT_FILE = "curriculum.json";
/** The Studio's memory folder: hidden on Windows, never edited by hand. */
export const STUDIO_DIR = ".studio";
/** Where dropped and pasted files land until the author sorts them. */
export const INBOX_DIR = "Inbox";
/** The four sections of a subject, in the order the tree shows them. */
export const SECTION_FOLDERS = ["Units", "Books", "Extra", "Exam"] as const;
/** The exam subfolders the wizard creates. Samples stay on the author's computer. */
export const EXAM_FOLDERS = [
	"past-papers",
	"listening-samples",
	"reading-samples",
] as const;

/** One subject of one grade: the app's subject id, and the folder it lives in. */
export type ProjectSubject = { subject: string; folder: string };
/** One grade: the bundle's grade number, and the folder it lives in. */
export type ProjectGrade = {
	grade: number;
	folder: string;
	subjects: ProjectSubject[];
};
/** curriculum.json: everything the Studio knows that the bundle doesn't. */
export type Project = {
	format: typeof PROJECT_FORMAT;
	formatVersion: typeof PROJECT_FORMAT_VERSION;
	id: string;
	nameEn: string;
	nameAr: string;
	author: string;
	rights: string;
	periods: BundlePeriod[];
	grades: ProjectGrade[];
};
/** One problem in a project file: where it is (e.g. "grades[0].subjects[1]") and what is wrong. */
export type ProjectIssue = { path: string; message: string };
export type ProjectResult =
	| { ok: true; project: Project }
	| { ok: false; issues: ProjectIssue[] };

/** A subject as the wizard shows it: the id the app uses, and its two names. */
export type SubjectLabel = { id: string; nameEn: string; nameAr: string };

/** The wizard's answers before they become a project. */
export type WizardAnswers = {
	nameEn: string;
	nameAr: string;
	author: string;
	rights: string;
	/** One entry per grade the author chose, with the subjects of that grade. */
	grades: { grade: number; subjects: string[] }[];
	/** The year's split, already named by the author (see presetPeriods). */
	periods: BundlePeriod[];
	/** A final exam that covers the whole year (docs/STUDIO.md, exams). */
	finalExam: boolean;
};

/** How a year may be split in the wizard. */
export type PeriodPreset =
	| "terms-blocks"
	| "semesters"
	| "terms"
	| "quarters"
	| "none";

/** The presets, in the order the wizard offers them. */
export const PERIOD_PRESETS: readonly PeriodPreset[] = [
	"terms-blocks",
	"semesters",
	"terms",
	"quarters",
	"none",
];

/** The id a subject id must look like: lowercase letters, digits and -. */
const SUBJECT_ID = /^[a-z0-9-]+$/;
/** The id a period id must look like: lowercase letters, digits and -. */
const PERIOD_ID = /^[a-z0-9-]+$/;
/** Names Windows refuses, with or without an extension. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
/** Characters Windows refuses in a file or folder name, control characters included. */
const BAD_NAME_CHARS = /[\p{Cc}<>:"/\\|?*]/u;
/** The most grades and subjects a project may hold at once (the bundle's course limit). */
const MAX_COURSES = BUNDLE_LIMITS.courses;

/** The names of the periods of a preset, in English and in simple Modern Standard Arabic. */
function presetNames(preset: PeriodPreset): {
	terms: number;
	blocks: number;
	termEn: (n: number) => string;
	termAr: (n: number) => string;
	blockEn: (n: number) => string;
	blockAr: (n: number) => string;
} {
	if (preset === "semesters")
		return {
			terms: 2,
			blocks: 1,
			termEn: (n) => `Semester ${n}`,
			termAr: (n) => `الفصل الدراسي ${n}`,
			blockEn: () => "",
			blockAr: () => "",
		};
	if (preset === "quarters")
		return {
			terms: 4,
			blocks: 1,
			termEn: (n) => `Quarter ${n}`,
			termAr: (n) => `الربع الدراسي ${n}`,
			blockEn: () => "",
			blockAr: () => "",
		};
	return {
		terms: 3,
		blocks: preset === "terms-blocks" ? 2 : 1,
		termEn: (n) => `Term ${n}`,
		termAr: (n) => `الفصل الدراسي ${n}`,
		blockEn: (n) => `Block ${n}`,
		blockAr: (n) => `المرحلة ${n}`,
	};
}

/**
 * The periods a preset starts with, named in English and Arabic. The wizard lets the author
 * rename them before anything is written; this is only the first suggestion.
 */
export function presetPeriods(preset: PeriodPreset): BundlePeriod[] {
	if (preset === "none") return [];
	const shape = presetNames(preset);
	const out: BundlePeriod[] = [];
	for (let t = 1; t <= shape.terms; t += 1) {
		const id = `t${t}`;
		if (shape.blocks === 1) {
			out.push({
				id,
				nameEn: shape.termEn(t),
				nameAr: shape.termAr(t),
				wholeYear: false,
				periods: [],
			});
			continue;
		}
		const blocks: BundlePeriod[] = [];
		for (let b = 1; b <= shape.blocks; b += 1) {
			blocks.push({
				id: `${id}-b${b}`,
				nameEn: shape.blockEn(b),
				nameAr: shape.blockAr(b),
				wholeYear: false,
				periods: [],
			});
		}
		out.push({
			id,
			nameEn: shape.termEn(t),
			nameAr: shape.termAr(t),
			wholeYear: false,
			periods: blocks,
		});
	}
	return out;
}

/** The final exam period: it covers the whole year and sits beside the terms. */
export function finalExamPeriod(): BundlePeriod {
	return {
		id: "final",
		nameEn: "Final exam",
		nameAr: "الاختبار النهائي",
		wholeYear: true,
		periods: [],
	};
}

/** True when `name` can be a folder or file name on Windows. */
export function validFolderName(name: string): boolean {
	if (typeof name !== "string") return false;
	const trimmed = name.trim();
	if (trimmed === "" || trimmed !== name) return false;
	if (trimmed.length > 60) return false;
	if (BAD_NAME_CHARS.test(trimmed)) return false;
	if (trimmed.endsWith(".")) return false;
	return !RESERVED.test(trimmed);
}

/** A subject's folder name: its English name, which is what the tree shows. */
export function subjectFolder(nameEn: string): string {
	const cleaned = nameEn
		.replace(BAD_NAME_CHARS, "-")
		.replace(/\s+/g, " ")
		.trim();
	const safe = cleaned === "" ? "Subject" : cleaned.replace(/\.+$/, "");
	return RESERVED.test(safe) ? `${safe} subject` : safe;
}

/** A grade's folder name: "KG1", "KG2", "Grade 7". */
export function gradeFolder(grade: number): string {
	return gradeName(grade);
}

/** The number at the start of a unit folder name ("03 Energy" is 3), or null. */
export function unitNumber(name: string): number | null {
	const match = /^(\d{1,2})\s/.exec(name);
	return match === null ? null : Number(match[1]);
}

/**
 * The folder name for a new unit inside a Units folder that already holds `existing`:
 * numbered for the author, so "03 Energy" follows "01 Classification" and "02 Cells".
 */
export function nextUnitFolder(
	existing: readonly string[],
	title: string,
): string {
	let last = 0;
	for (const name of existing) {
		const n = unitNumber(name);
		if (n !== null && n > last) last = n;
	}
	if (last >= BUNDLE_LIMITS.numberMax) last = 0;
	const number = String(last + 1).padStart(2, "0");
	const clean = title.replace(BAD_NAME_CHARS, " ").replace(/\s+/g, " ").trim();
	return clean === "" ? number : `${number} ${clean}`;
}

/** The grade a folder name stands for ("Grade 7", "kg1", "الصف 7"), or null. */
export function matchGrade(folder: string): number | null {
	const name = folder.trim().toLowerCase();
	for (let grade = GRADE_MIN; grade <= GRADE_MAX; grade += 1) {
		if (name === gradeName(grade).toLowerCase()) return grade;
	}
	const arabic = /^الصف\s*(\d{1,2})$/.exec(name);
	if (arabic !== null) {
		const grade = Number(arabic[1]);
		return grade >= 1 && grade <= GRADE_MAX ? grade : null;
	}
	if (name === "الروضة الأولى") return -1;
	if (name === "الروضة الثانية") return 0;
	return null;
}

/** The subject a folder name stands for ("Science", "العلوم"), or null. */
export function matchSubject(
	folder: string,
	subjects: readonly SubjectLabel[],
): string | null {
	const name = folder.trim().toLowerCase();
	for (const subject of subjects) {
		if (name === subject.nameEn.toLowerCase()) return subject.id;
		if (name === subject.nameAr.toLowerCase()) return subject.id;
	}
	return null;
}

/**
 * The grades and subjects a folder already has, so "Open a folder" can prefill the wizard
 * from a project written by hand. Folder names it doesn't recognise are left out.
 */
export function guessGrades(
	folders: readonly { name: string; children: readonly string[] }[],
	subjects: readonly SubjectLabel[],
): { grade: number; subjects: string[] }[] {
	const out: { grade: number; subjects: string[] }[] = [];
	for (const folder of folders) {
		const grade = matchGrade(folder.name);
		if (grade === null) continue;
		const found: string[] = [];
		for (const child of folder.children) {
			const subject = matchSubject(child, subjects);
			if (subject !== null && !found.includes(subject)) found.push(subject);
		}
		const already = out.find((entry) => entry.grade === grade);
		if (already === undefined) out.push({ grade, subjects: found });
		else
			for (const subject of found)
				if (!already.subjects.includes(subject)) already.subjects.push(subject);
	}
	return out.sort((a, b) => a.grade - b.grade);
}

/**
 * The project the wizard's answers make, or the problems that stop it. The folder names
 * come from gradeName and the subject's English name, so the tree matches the app's own
 * words; the periods are kept as the author named them.
 */
export function wizardProject(
	answers: WizardAnswers,
	subjects: readonly SubjectLabel[],
	id: string,
): ProjectResult {
	const issues: ProjectIssue[] = [];
	const add = (path: string, message: string) => {
		if (issues.length < BUNDLE_LIMITS.issues) issues.push({ path, message });
	};

	const texts = {
		nameEn: checkText(answers.nameEn, BUNDLE_LIMITS.nameEn),
		nameAr: checkText(answers.nameAr, BUNDLE_LIMITS.nameAr),
		author: checkText(answers.author, BUNDLE_LIMITS.author),
		rights: checkText(answers.rights, BUNDLE_LIMITS.rights),
	};
	for (const [key, check] of Object.entries(texts)) {
		if (!check.ok) add(key, check.message);
	}
	if (!BUNDLE_ID.test(id)) add("id", "expected a lowercase UUID");

	if (answers.grades.length === 0) add("grades", "choose at least one grade");
	const seenGrades = new Set<number>();
	let courses = 0;
	for (const [i, entry] of answers.grades.entries()) {
		const path = `grades[${i}]`;
		if (
			!Number.isInteger(entry.grade) ||
			entry.grade < GRADE_MIN ||
			entry.grade > GRADE_MAX
		) {
			add(path, `expected a grade from ${GRADE_MIN} to ${GRADE_MAX}`);
			continue;
		}
		if (seenGrades.has(entry.grade))
			add(path, `grade ${gradeName(entry.grade)} appears twice`);
		seenGrades.add(entry.grade);
		if (entry.subjects.length === 0) add(path, "choose at least one subject");
		const seenSubjects = new Set<string>();
		for (const [j, subject] of entry.subjects.entries()) {
			const subjectPath = `${path}.subjects[${j}]`;
			if (
				!SUBJECT_ID.test(subject) ||
				!subjects.some((s) => s.id === subject)
			) {
				add(subjectPath, `unknown subject "${subject}"`);
				continue;
			}
			if (seenSubjects.has(subject))
				add(subjectPath, `subject "${subject}" appears twice`);
			seenSubjects.add(subject);
			courses += 1;
		}
	}
	if (courses > MAX_COURSES) add("grades", `at most ${MAX_COURSES} courses`);

	// The final exam covers the whole year and sits beside the terms, as docs/CURRICULA.md and
	// task 149's period structure have it.
	const periods = answers.finalExam
		? [...answers.periods, finalExamPeriod()]
		: answers.periods;
	checkPeriods(periods, add);

	if (issues.length > 0) return { ok: false, issues };

	const project: Project = {
		format: PROJECT_FORMAT,
		formatVersion: PROJECT_FORMAT_VERSION,
		id,
		nameEn: texts.nameEn.ok ? texts.nameEn.text : "",
		nameAr: texts.nameAr.ok ? texts.nameAr.text : "",
		author: texts.author.ok ? texts.author.text : "",
		rights: texts.rights.ok ? texts.rights.text : "",
		periods: copyPeriods(periods),
		grades: answers.grades.map((entry) => ({
			grade: entry.grade,
			folder: gradeFolder(entry.grade),
			subjects: entry.subjects.map((subject) => ({
				subject,
				folder: subjectFolder(
					subjects.find((s) => s.id === subject)?.nameEn ?? subject,
				),
			})),
		})),
	};
	// Two subjects of one grade must not land in one folder: the second would overwrite the
	// first, and the file would say they are the same place.
	for (const grade of project.grades) {
		const folders = new Set<string>();
		for (const subject of grade.subjects) {
			if (folders.has(subject.folder))
				add(
					"grades",
					`${grade.folder}: two subjects would share the folder "${subject.folder}"`,
				);
			folders.add(subject.folder);
		}
	}
	if (issues.length > 0) return { ok: false, issues };
	return { ok: true, project };
}

/** A deep copy of the periods, so the wizard can't change the project behind its back. */
function copyPeriods(periods: readonly BundlePeriod[]): BundlePeriod[] {
	return periods.map((period) => ({
		id: period.id,
		nameEn: period.nameEn,
		nameAr: period.nameAr,
		wholeYear: period.wholeYear,
		periods: copyPeriods(period.periods),
	}));
}

/** Checks the periods the wizard will write: the bundle's limits, ids and depth. */
function checkPeriods(
	periods: readonly BundlePeriod[],
	add: (path: string, message: string) => void,
): void {
	const ids = new Set<string>();
	let count = 0;
	const walk = (list: readonly BundlePeriod[], path: string, depth: number) => {
		for (const [i, period] of list.entries()) {
			const at = `${path}[${i}]`;
			count += 1;
			if (!PERIOD_ID.test(period.id))
				add(`${at}.id`, "use lowercase letters, digits and -");
			else if (ids.has(period.id))
				add(`${at}.id`, `period "${period.id}" appears twice`);
			ids.add(period.id);
			const en = checkText(period.nameEn, BUNDLE_LIMITS.periodName);
			if (!en.ok) add(`${at}.nameEn`, en.message);
			const ar = checkText(
				period.nameAr === "" ? period.nameEn : period.nameAr,
				BUNDLE_LIMITS.periodName,
			);
			if (!ar.ok) add(`${at}.nameAr`, ar.message);
			if (period.periods.length > 0) {
				if (depth >= BUNDLE_LIMITS.periodDepth)
					add(
						`${at}.periods`,
						`at most ${BUNDLE_LIMITS.periodDepth} levels of periods`,
					);
				else walk(period.periods, `${at}.periods`, depth + 1);
			}
		}
	};
	walk(periods, "periods", 1);
	if (count > BUNDLE_LIMITS.periods)
		add("periods", `at most ${BUNDLE_LIMITS.periods} periods`);
}

/** Every folder of the project, relative to its root, in the order they are created. */
export function projectFolders(project: Project): string[] {
	const folders = [INBOX_DIR, STUDIO_DIR];
	for (const grade of project.grades) {
		const gradePath = grade.folder;
		folders.push(gradePath);
		for (const subject of grade.subjects) {
			const subjectPath = `${gradePath}/${subject.folder}`;
			folders.push(subjectPath);
			for (const section of SECTION_FOLDERS)
				folders.push(`${subjectPath}/${section}`);
			for (const exam of EXAM_FOLDERS)
				folders.push(`${subjectPath}/Exam/${exam}`);
		}
	}
	return [...new Set(folders)];
}

/** The sections of one subject, as paths relative to the project root. */
export function sectionPaths(
	grade: ProjectGrade,
	subject: ProjectSubject,
): { section: (typeof SECTION_FOLDERS)[number]; rel: string }[] {
	const base = `${grade.folder}/${subject.folder}`;
	return SECTION_FOLDERS.map((section) => ({
		section,
		rel: `${base}/${section}`,
	}));
}

/**
 * A text a project may leave empty (task 153): an adopted project is written with the
 * author's name and rights sentence still to fill, and the export asks for them before it
 * writes a bundle, which requires both. The wizard still insists on them.
 */
function checkOptionalText(
	value: unknown,
	max: number,
): { ok: true; text: string } | { ok: false; message: string } {
	if (typeof value === "string" && value.trim() === "")
		return { ok: true, text: "" };
	return checkText(value, max);
}

/** Reads a project file; never throws. `text` is what was in curriculum.json. */
export function parseProject(text: string): ProjectResult {
	const issues: ProjectIssue[] = [];
	const add = (path: string, message: string) => {
		if (issues.length < BUNDLE_LIMITS.issues) issues.push({ path, message });
	};
	if (typeof text !== "string")
		return {
			ok: false,
			issues: [{ path: "", message: "The file is not valid JSON." }],
		};
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return {
			ok: false,
			issues: [{ path: "", message: "The file is not valid JSON." }],
		};
	}
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return { ok: false, issues: [{ path: "", message: "expected an object" }] };
	const raw = value as Record<string, unknown>;
	const allowed = [
		"format",
		"formatVersion",
		"id",
		"nameEn",
		"nameAr",
		"author",
		"rights",
		"periods",
		"grades",
	];
	for (const key of Object.keys(raw)) {
		if (!allowed.includes(key)) add(key, `unknown field "${key}"`);
	}
	const read = (key: string): unknown =>
		Object.hasOwn(raw, key) ? raw[key] : undefined;

	if (read("format") !== PROJECT_FORMAT)
		add("format", `expected "${PROJECT_FORMAT}"`);
	if (read("formatVersion") !== PROJECT_FORMAT_VERSION)
		add("formatVersion", `expected ${PROJECT_FORMAT_VERSION}`);
	const idValue = read("id");
	if (typeof idValue !== "string" || !BUNDLE_ID.test(idValue))
		add(
			"id",
			"expected a lowercase UUID, e.g. 6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10",
		);
	const texts = {
		nameEn: checkText(read("nameEn"), BUNDLE_LIMITS.nameEn),
		nameAr: checkText(read("nameAr"), BUNDLE_LIMITS.nameAr),
		author: checkOptionalText(read("author"), BUNDLE_LIMITS.author),
		rights: checkOptionalText(read("rights"), BUNDLE_LIMITS.rights),
	};
	for (const [key, check] of Object.entries(texts)) {
		if (!check.ok) add(key, check.message);
	}
	const periodCheck = readPeriods(read("periods"));
	if (!periodCheck.ok)
		for (const issue of periodCheck.issues) add(issue.path, issue.message);
	const periods = periodCheck.ok ? periodCheck.periods : null;
	const grades = parseGrades(read("grades"), add);

	if (
		issues.length > 0 ||
		periods === null ||
		grades === null ||
		typeof idValue !== "string" ||
		!texts.nameEn.ok ||
		!texts.nameAr.ok ||
		!texts.author.ok ||
		!texts.rights.ok
	)
		return { ok: false, issues };

	return {
		ok: true,
		project: {
			format: PROJECT_FORMAT,
			formatVersion: PROJECT_FORMAT_VERSION,
			id: idValue,
			nameEn: texts.nameEn.text,
			nameAr: texts.nameAr.text,
			author: texts.author.text,
			rights: texts.rights.text,
			periods,
			grades,
		},
	};
}

/**
 * The periods of a file whose shape has them (a project file, or the Studio's own model),
 * checked against the bundle's limits: the year structure is the bundle's own, so a value
 * the server would refuse must never reach a file here.
 */
export function readPeriods(
	value: unknown,
):
	| { ok: true; periods: BundlePeriod[] }
	| { ok: false; issues: ProjectIssue[] } {
	const issues: ProjectIssue[] = [];
	const add = (path: string, message: string) => {
		if (issues.length < BUNDLE_LIMITS.issues) issues.push({ path, message });
	};
	const periods = parsePeriods(value, add);
	if (periods === null || issues.length > 0) return { ok: false, issues };
	return { ok: true, periods };
}

/** The periods of a project file, or null when one is wrong. */
function parsePeriods(
	value: unknown,
	add: (path: string, message: string) => void,
): BundlePeriod[] | null {
	if (!Array.isArray(value)) {
		add("periods", "expected an array");
		return null;
	}
	let bad = false;
	const ids = new Set<string>();
	let count = 0;
	const walk = (
		list: unknown[],
		path: string,
		depth: number,
	): BundlePeriod[] => {
		const out: BundlePeriod[] = [];
		for (const [i, entry] of list.entries()) {
			const at = `${path}[${i}]`;
			count += 1;
			if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
				add(at, "expected an object");
				bad = true;
				continue;
			}
			const raw = entry as Record<string, unknown>;
			for (const key of Object.keys(raw)) {
				if (!["id", "nameEn", "nameAr", "wholeYear", "periods"].includes(key))
					add(`${at}.${key}`, `unknown field "${key}"`);
			}
			const idValue = raw.id;
			const nameEn = checkText(raw.nameEn, BUNDLE_LIMITS.periodName);
			const nameAr = checkText(raw.nameAr, BUNDLE_LIMITS.periodName);
			const wholeYear =
				raw.wholeYear === undefined ? false : raw.wholeYear === true;
			if (typeof idValue !== "string" || !PERIOD_ID.test(idValue)) {
				add(`${at}.id`, "use lowercase letters, digits and -");
				bad = true;
				continue;
			}
			if (ids.has(idValue)) {
				add(`${at}.id`, `period "${idValue}" appears twice`);
				bad = true;
			}
			ids.add(idValue);
			if (!nameEn.ok) {
				add(`${at}.nameEn`, nameEn.message);
				bad = true;
			}
			if (!nameAr.ok) {
				add(`${at}.nameAr`, nameAr.message);
				bad = true;
			}
			if (raw.wholeYear !== undefined && typeof raw.wholeYear !== "boolean") {
				add(`${at}.wholeYear`, "expected true or false");
				bad = true;
			}
			let children: BundlePeriod[] = [];
			if (raw.periods !== undefined) {
				if (!Array.isArray(raw.periods)) {
					add(`${at}.periods`, "expected an array");
					bad = true;
				} else if (raw.periods.length > 0) {
					if (depth >= BUNDLE_LIMITS.periodDepth) {
						add(
							`${at}.periods`,
							`at most ${BUNDLE_LIMITS.periodDepth} levels of periods`,
						);
						bad = true;
					} else {
						children = walk(raw.periods, `${at}.periods`, depth + 1);
					}
				}
			}
			if (!nameEn.ok || !nameAr.ok || typeof idValue !== "string") continue;
			out.push({
				id: idValue,
				nameEn: nameEn.text,
				nameAr: nameAr.text,
				wholeYear,
				periods: children,
			});
		}
		return out;
	};
	const periods = walk(value, "periods", 1);
	if (count > BUNDLE_LIMITS.periods)
		add("periods", `at most ${BUNDLE_LIMITS.periods} periods`);
	return bad ? null : periods;
}

/** The grades of a project file, or null when one is wrong. */
function parseGrades(
	value: unknown,
	add: (path: string, message: string) => void,
): ProjectGrade[] | null {
	if (!Array.isArray(value)) {
		add("grades", "expected an array");
		return null;
	}
	if (value.length === 0) {
		add("grades", "expected at least one grade");
		return null;
	}
	let bad = false;
	const seen = new Set<number>();
	const out: ProjectGrade[] = [];
	for (const [i, entry] of value.entries()) {
		const at = `grades[${i}]`;
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
			add(at, "expected an object");
			bad = true;
			continue;
		}
		const raw = entry as Record<string, unknown>;
		for (const key of Object.keys(raw)) {
			if (!["grade", "folder", "subjects"].includes(key))
				add(`${at}.${key}`, `unknown field "${key}"`);
		}
		const grade = raw.grade;
		const folder = raw.folder;
		if (
			typeof grade !== "number" ||
			!Number.isInteger(grade) ||
			grade < GRADE_MIN ||
			grade > GRADE_MAX
		) {
			add(`${at}.grade`, `expected a grade from ${GRADE_MIN} to ${GRADE_MAX}`);
			bad = true;
			continue;
		}
		if (seen.has(grade)) {
			add(`${at}.grade`, `grade ${gradeName(grade)} appears twice`);
			bad = true;
		}
		seen.add(grade);
		if (typeof folder !== "string" || !validFolderName(folder)) {
			add(`${at}.folder`, "expected a plain folder name");
			bad = true;
			continue;
		}
		if (!Array.isArray(raw.subjects)) {
			add(`${at}.subjects`, "expected an array");
			bad = true;
			continue;
		}
		const subjects: ProjectSubject[] = [];
		const folders = new Set<string>();
		for (const [j, item] of raw.subjects.entries()) {
			const subjectAt = `${at}.subjects[${j}]`;
			if (typeof item !== "object" || item === null || Array.isArray(item)) {
				add(subjectAt, "expected an object");
				bad = true;
				continue;
			}
			const subjectRaw = item as Record<string, unknown>;
			for (const key of Object.keys(subjectRaw)) {
				if (!["subject", "folder"].includes(key))
					add(`${subjectAt}.${key}`, `unknown field "${key}"`);
			}
			const subject = subjectRaw.subject;
			const subjectFolderName = subjectRaw.folder;
			if (typeof subject !== "string" || !SUBJECT_ID.test(subject)) {
				add(`${subjectAt}.subject`, "expected a subject id");
				bad = true;
				continue;
			}
			if (
				typeof subjectFolderName !== "string" ||
				!validFolderName(subjectFolderName)
			) {
				add(`${subjectAt}.folder`, "expected a plain folder name");
				bad = true;
				continue;
			}
			if (folders.has(subjectFolderName)) {
				add(`${subjectAt}.folder`, `"${subjectFolderName}" is used twice`);
				bad = true;
			}
			folders.add(subjectFolderName);
			subjects.push({ subject, folder: subjectFolderName });
		}
		if (subjects.length === 0) {
			add(`${at}.subjects`, "expected at least one subject");
			bad = true;
			continue;
		}
		out.push({ grade, folder, subjects });
	}
	return bad ? null : out;
}
