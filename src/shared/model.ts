// The Studio's own record of a curriculum (task 153): `.studio/model/curriculum.json` holds
// the header (names, author, rights, the year's periods) and one JSON file per course holds
// units, lessons, skills and facts, exactly the bundle's fields plus what only the project
// keeps about a fact: the pages it came from, how far it was checked, and whether the author
// wrote or changed it. Adoption fills it from the work already done, so nothing is drafted
// again; `toBundle` turns it into the file Mr. Zaki imports and drops what a bundle cannot
// carry. Pure and tested; the reading and writing of the files is src/main/model.ts.

import {
	BUNDLE_LIMITS,
	type Bundle,
	type BundleExam,
	type BundleIssue,
	type BundlePeriod,
	type BundleSkill,
	checkText,
	parseBundle,
	parseCourseExams,
} from "./format/bundle";
import { GRADE_MAX, GRADE_MIN } from "./format/grades";
import { type Project, readPeriods, STUDIO_DIR } from "./project";

// The text files' own format lives in ./text, so a check script can read a page without
// loading this file's bundle imports (task 156).
export { pageText } from "./text";

/** Where the Studio keeps an adopted project's record and the text read from its files. */
export const MODEL_DIR = `${STUDIO_DIR}/model`;
export const MODEL_FILE = "curriculum.json";
export const TEXT_DIR = `${STUDIO_DIR}/text`;
/** A picture of each page that is a picture rather than text (task 156). */
export const PAGES_DIR = `${STUDIO_DIR}/pages`;
/** The register rows, copied from the work folder's index.csv at adoption. */
export const FILES_FILE = `${STUDIO_DIR}/files.json`;
/** The last scan's "New material" report, which the panel shows until the next scan. */
export const REPORT_FILE = `${STUDIO_DIR}/new.json`;
/** The pages a stopped scan still has to draw and read from their pictures. */
export const PENDING_FILE = `${STUDIO_DIR}/pending.json`;
/** One copy of every exported bundle, so any two versions can be compared. */
export const EXPORTS_DIR = `${STUDIO_DIR}/exports`;

/** How far a fact has been checked (docs/CURRICULA.md); a reviewed fact is the author's. */
export const FACT_STATUSES = ["draft", "checked", "reviewed"] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

/** One fact as the project keeps it. `own` is true when the author wrote or changed it. */
export type ModelFact = {
	text: string;
	/** The pages it was taken from, e.g. "9a010f4b4816#p6". */
	sources: string[];
	status: FactStatus;
	own: boolean;
};

export type ModelLesson = {
	number: number;
	title: string;
	skills: BundleSkill[];
	facts: ModelFact[];
	activity: "writing" | "reading" | null;
};

export type ModelUnit = {
	number: number;
	period: string;
	title: string;
	source: "sheet" | "provisional";
	keywords: string[];
	evidence: string[];
	lessons: ModelLesson[];
};

export type ModelCourse = {
	grade: number;
	subject: string;
	examStyle: string | null;
	exams: BundleExam[];
	units: ModelUnit[];
};

/** `.studio/model/curriculum.json`: what a bundle's header says, before it is exported. */
export type ModelCurriculum = {
	nameEn: string;
	nameAr: string;
	author: string;
	rights: string;
	periods: BundlePeriod[];
};

export type CurriculumModel = {
	curriculum: ModelCurriculum;
	courses: ModelCourse[];
};

/** The five fields an author may correct on a row; a scan keeps a corrected field (task 156). */
export const FILE_FIELDS = [
	"grade",
	"subject",
	"block",
	"kind",
	"authority",
] as const;
export type FileField = (typeof FILE_FIELDS)[number];

/**
 * One row of the source register, as the project keeps it: paths are relative to it. The first
 * eight fields are the ones adoption wrote (task 153); the rest is what the register has always
 * known (a work folder's index.csv) and now keeps in the project too (task 156).
 */
export type FileRow = {
	id: string;
	path: string;
	grade: number | null;
	subject: string;
	block: string;
	kind: string;
	pages: number | null;
	authority: number | null;
	/** The school year the file belongs to: "current" or "old". */
	year: "current" | "old";
	/** The year as the folder names it, e.g. "2026-27", or "". */
	academicYear: string;
	/** When it was published, as "YYYY-MM-DD", or "". */
	published: string;
	/** Where that date came from: "name", "meta", "folder", or "". */
	publishedFrom: string;
	/** The first file with the same bytes, when this one is a byte-identical copy. */
	dupOf: string;
	/** How many of its pages are pictures rather than text. */
	imagePages: number;
	/** Why the file couldn't be read, or "". */
	error: string;
	/** The day this content was first seen, as "YYYY-MM-DD". */
	firstSeen: string;
	/** The file's size in bytes, and its modified time in nanoseconds as text. */
	size: number;
	mtime: string;
	/** The date the file's own metadata gives, as "YYYY-MM-DD", or "". */
	metaDate: string;
	/** The fields the author corrected; a later scan keeps their values. */
	fixed: FileField[];
};

/** The counts an export summary shows. */
export type ModelSummary = {
	courses: number;
	units: number;
	lessons: number;
	facts: number;
	exams: number;
};

/** The file name of one course in `.studio/model/`, e.g. "grade-7-science.json". */
export function courseFile(grade: number, subject: string): string {
	return `grade-${grade}-${subject}.json`;
}

/**
 * The two values every bundle file carries (task 134, docs/tasks/134-bundle-format.md). The
 * format is published, so a tool writing bundles writes them; the shared parseBundle checks
 * them, which is why the round trip in model.test.ts runs the real parser.
 */
export const BUNDLE_FORMAT = "mr-zaki-curriculum";
export const BUNDLE_FORMAT_VERSION = 1;

/** A bundle as it is written to a file: the shared type, plus the file's own two fields. */
export type BundleFile = Bundle & {
	format: typeof BUNDLE_FORMAT;
	formatVersion: typeof BUNDLE_FORMAT_VERSION;
};

/**
 * The bundle a project exports. The header comes from the model's curriculum.json (which
 * adoption wrote from the built-in curriculum), and the project supplies the bundle's id, so
 * every export of one project is an update of the same curriculum. Fact sources, status and
 * `own` are not exported: a bundle has no place for them (docs/BUNDLES.md).
 *
 * The file leaves out what the format calls absent rather than writing null: a bundle read
 * back from JSON has nulls in its optional fields, and parseBundle refuses a null where it
 * expects a value or nothing at all. A skill without a code is written as its text, which is
 * the format's other shape for one.
 */
export function toBundle(
	model: CurriculumModel,
	project: Project,
	version: number,
): BundleFile {
	const courses = [...model.courses].sort(
		(a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject),
	);
	return {
		format: BUNDLE_FORMAT,
		formatVersion: BUNDLE_FORMAT_VERSION,
		id: project.id,
		version,
		nameEn: model.curriculum.nameEn,
		nameAr: model.curriculum.nameAr,
		author: model.curriculum.author,
		rights: model.curriculum.rights,
		periods: compact(model.curriculum.periods) as BundlePeriod[],
		courses: courses.map((course) =>
			compact({
				grade: course.grade,
				subject: course.subject,
				examStyle: course.examStyle,
				exams: course.exams,
				units: course.units.map((unit) => ({
					number: unit.number,
					period: unit.period,
					title: unit.title,
					source: unit.source,
					keywords: unit.keywords,
					evidence: unit.evidence,
					lessons: unit.lessons.map((lesson) => ({
						number: lesson.number,
						title: lesson.title,
						skills: lesson.skills.map((skill) =>
							skill.code === null
								? skill.text
								: { code: skill.code, text: skill.text },
						),
						facts: lesson.facts.map((fact) => fact.text),
						activity: lesson.activity,
					})),
				})),
			}),
		) as Bundle["courses"],
	};
}

/**
 * A value as the file writes it: null fields and empty lists left out, because the format
 * treats an absent field as empty and refuses a null where a value belongs.
 */
function compact(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(compact);
	if (typeof value !== "object" || value === null) return value;
	const out: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (entry === null || entry === undefined) continue;
		if (Array.isArray(entry) && entry.length === 0) continue;
		out[key] = compact(entry);
	}
	return out;
}

/** What an export would carry, for the summary the author reads before saving. */
export function modelSummary(model: CurriculumModel): ModelSummary {
	const summary: ModelSummary = {
		courses: model.courses.length,
		units: 0,
		lessons: 0,
		facts: 0,
		exams: 0,
	};
	for (const course of model.courses) {
		summary.exams += course.exams.length;
		summary.units += course.units.length;
		for (const unit of course.units) {
			summary.lessons += unit.lessons.length;
			for (const lesson of unit.lessons) summary.facts += lesson.facts.length;
		}
	}
	return summary;
}

/**
 * The bundle checked by the shared parser, with the subject ids Mr. Zaki knows. The export
 * never writes a file this refuses; the issues it names are the ones the page shows.
 */
export function checkBundle(
	bundle: BundleFile,
	subjectIds: readonly string[],
): { ok: true } | { ok: false; issues: BundleIssue[] } {
	const result = parseBundle(modelFileText(bundle), subjectIds);
	return result.ok ? { ok: true } : { ok: false, issues: result.issues };
}

/** One fact's source, as the curriculum view reads it: the file id and the page. */
export type ParsedSource = {
	id: string;
	/** The first page, or null when the fact names the file without a page. */
	from: number | null;
	to: number | null;
};

const SOURCE = /^([0-9a-f]{12})(?:#p(\d{1,4})(?:-(\d{1,4}))?)?$/;

/** "9a010f4b4816#p12-13" as an id and pages, or null when it is not a source. */
export function parseSource(source: string): ParsedSource | null {
	const match = SOURCE.exec(source);
	if (match === null) return null;
	const first = match[2] === undefined ? null : Number(match[2]);
	const last = match[3] === undefined ? first : Number(match[3]);
	return { id: match[1] ?? "", from: first, to: last };
}

/** The name a file is shown by: its name on disk without the extension. */
export function fileLabel(path: string): string {
	const name = path.split("/").pop() ?? path;
	const cut = name.lastIndexOf(".");
	return cut <= 0 ? name : name.slice(0, cut);
}

/** The version number the next export takes: the last copy in .studio/exports, plus one. */
export function nextVersion(copied: readonly string[]): number {
	let last = 0;
	for (const name of copied) {
		const match = /^v(\d{1,9})\.json$/.exec(name);
		if (match === null) continue;
		const version = Number(match[1]);
		if (version > last) last = version;
	}
	return last + 1;
}

/** The name an export's copy takes in .studio/exports. */
export function exportCopy(version: number): string {
	return `v${version}.json`;
}

/**
 * A model file's text when it is written: the same fields, in the same order, every time,
 * with nulls and empty lists left out. The reader treats an absent field as empty, and the
 * bundle parser refuses a null where a value or nothing belongs (an exam's `language`, say).
 */
export function modelFileText(value: unknown): string {
	return `${JSON.stringify(compact(value), null, "\t")}\n`;
}

/** One problem in a model file, named by its file and place. */
export type ModelIssue = { path: string; message: string };

/** A course's grade and subject, in the bundle's own limits. */
function checkCourseHead(
	raw: Record<string, unknown>,
	at: string,
	add: (path: string, message: string) => void,
): boolean {
	const grade = raw.grade;
	if (
		typeof grade !== "number" ||
		!Number.isInteger(grade) ||
		grade < GRADE_MIN ||
		grade > GRADE_MAX
	) {
		add(`${at}.grade`, `expected a grade from ${GRADE_MIN} to ${GRADE_MAX}`);
		return false;
	}
	if (typeof raw.subject !== "string" || raw.subject === "") {
		add(`${at}.subject`, "expected a subject id");
		return false;
	}
	return true;
}

/** Reads an optional or required string, so a damaged model file names its field. */
function readString(
	raw: Record<string, unknown>,
	key: string,
	at: string,
	add: (path: string, message: string) => void,
	allowEmpty = false,
): string | null {
	const value = raw[key];
	if (typeof value !== "string") {
		add(`${at}.${key}`, "expected a string");
		return null;
	}
	if (!allowEmpty && value.trim() === "") {
		add(`${at}.${key}`, "expected a non-empty string");
		return null;
	}
	return value;
}

function readStringList(
	raw: Record<string, unknown>,
	key: string,
	at: string,
	add: (path: string, message: string) => void,
): string[] | null {
	const value = raw[key] === undefined ? [] : raw[key];
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		add(`${at}.${key}`, "expected a list of texts");
		return null;
	}
	return value as string[];
}

/** One fact of the model: its text, its pages, its status, and whether it is the author's. */
function readFact(
	value: unknown,
	at: string,
	add: (path: string, message: string) => void,
): ModelFact | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		add(at, "expected a fact");
		return null;
	}
	const raw = value as Record<string, unknown>;
	const text = readString(raw, "text", at, add);
	const sources = readStringList(raw, "sources", at, add);
	const status = raw.status;
	const own = raw.own === true;
	if (status !== "draft" && status !== "checked" && status !== "reviewed") {
		add(`${at}.status`, `expected one of ${FACT_STATUSES.join(", ")}`);
		return null;
	}
	if (text === null || sources === null) return null;
	return { text, sources, status, own };
}

function readSkills(
	value: unknown,
	at: string,
	add: (path: string, message: string) => void,
): BundleSkill[] | null {
	if (!Array.isArray(value)) {
		add(at, "expected a list of skills");
		return null;
	}
	const skills: BundleSkill[] = [];
	for (const [i, item] of value.entries()) {
		const where = `${at}[${i}]`;
		if (typeof item !== "object" || item === null) {
			add(where, "expected a skill");
			return null;
		}
		const raw = item as Record<string, unknown>;
		const text = readString(raw, "text", where, add);
		const code = raw.code ?? null;
		if (code !== null && typeof code !== "string") {
			add(`${where}.code`, "expected a text or nothing");
			return null;
		}
		if (text === null) return null;
		skills.push({ code, text });
	}
	return skills;
}

/** One course file of the model, or null when it is damaged. */
export function parseModelCourse(
	value: unknown,
	where = "course",
): { ok: true; course: ModelCourse } | { ok: false; issues: ModelIssue[] } {
	const issues: ModelIssue[] = [];
	const add = (path: string, message: string) => {
		if (issues.length < BUNDLE_LIMITS.issues) issues.push({ path, message });
	};
	const fail = () => ({ ok: false as const, issues });
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return fail();
	const raw = value as Record<string, unknown>;
	if (!checkCourseHead(raw, where, add)) return fail();
	const examStyle = raw.examStyle ?? null;
	if (examStyle !== null && typeof examStyle !== "string") {
		add(`${where}.examStyle`, "expected a text or nothing");
		return fail();
	}
	// A course without exams writes an empty list; the model keeps it that way, so only a
	// list with something in it is checked as the bundle's exams.
	const exams =
		raw.exams === undefined ||
		(Array.isArray(raw.exams) && raw.exams.length === 0)
			? { exams: [], issues: [] }
			: parseCourseExams(raw.exams, `${where}.exams`);
	for (const issue of exams.issues) add(issue.path, issue.message);
	if (!Array.isArray(raw.units)) {
		add(`${where}.units`, "expected a list of units");
		return fail();
	}
	const units: ModelUnit[] = [];
	for (const [i, item] of raw.units.entries()) {
		const at = `${where}.units[${i}]`;
		if (typeof item !== "object" || item === null) {
			add(at, "expected a unit");
			continue;
		}
		const unit = item as Record<string, unknown>;
		const title = readString(unit, "title", at, add);
		const period = readString(unit, "period", at, add);
		const keywords = readStringList(unit, "keywords", at, add);
		const evidence = readStringList(unit, "evidence", at, add);
		const source = unit.source === "provisional" ? "provisional" : "sheet";
		if (typeof unit.number !== "number" || !Number.isInteger(unit.number)) {
			add(`${at}.number`, "expected a whole number");
			continue;
		}
		if (!Array.isArray(unit.lessons)) {
			add(`${at}.lessons`, "expected a list of lessons");
			continue;
		}
		const lessons: ModelLesson[] = [];
		for (const [j, entry] of unit.lessons.entries()) {
			const lessonAt = `${at}.lessons[${j}]`;
			if (typeof entry !== "object" || entry === null) {
				add(lessonAt, "expected a lesson");
				continue;
			}
			const lesson = entry as Record<string, unknown>;
			const lessonTitle = readString(lesson, "title", lessonAt, add);
			const skills = readSkills(lesson.skills, `${lessonAt}.skills`, add);
			const activity = lesson.activity ?? null;
			if (
				activity !== null &&
				activity !== "reading" &&
				activity !== "writing"
			) {
				add(`${lessonAt}.activity`, 'expected "reading", "writing" or nothing');
				continue;
			}
			const facts: ModelFact[] = [];
			const list = lesson.facts === undefined ? [] : lesson.facts;
			if (!Array.isArray(list)) {
				add(`${lessonAt}.facts`, "expected a list of facts");
				continue;
			}
			for (const [k, fact] of list.entries()) {
				const parsed = readFact(fact, `${lessonAt}.facts[${k}]`, add);
				if (parsed !== null) facts.push(parsed);
			}
			if (
				typeof lesson.number !== "number" ||
				!Number.isInteger(lesson.number)
			) {
				add(`${lessonAt}.number`, "expected a whole number");
				continue;
			}
			if (lessonTitle === null || skills === null) continue;
			lessons.push({
				number: lesson.number,
				title: lessonTitle,
				skills,
				facts,
				activity,
			});
		}
		if (
			title === null ||
			period === null ||
			keywords === null ||
			evidence === null
		)
			continue;
		units.push({
			number: unit.number,
			period,
			title,
			source,
			keywords,
			evidence,
			lessons,
		});
	}
	if (issues.length > 0) return fail();
	return {
		ok: true,
		course: {
			grade: raw.grade as number,
			subject: raw.subject as string,
			examStyle,
			exams: exams.exams,
			units,
		},
	};
}

/** `.studio/model/curriculum.json`, or null when it is damaged. */
export function parseModelCurriculum(
	value: unknown,
):
	| { ok: true; curriculum: ModelCurriculum }
	| { ok: false; issues: ModelIssue[] } {
	const issues: ModelIssue[] = [];
	const add = (path: string, message: string) => {
		if (issues.length < BUNDLE_LIMITS.issues) issues.push({ path, message });
	};
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return { ok: false, issues: [{ path: "", message: "expected an object" }] };
	const raw = value as Record<string, unknown>;
	const nameEn = checkText(raw.nameEn, BUNDLE_LIMITS.nameEn);
	const nameAr = checkText(raw.nameAr, BUNDLE_LIMITS.nameAr);
	if (!nameEn.ok) add("nameEn", nameEn.message);
	if (!nameAr.ok) add("nameAr", nameAr.message);
	// An adopted project leaves these for the author; the export asks for them before writing.
	const author = optionalText(raw.author, BUNDLE_LIMITS.author, add, "author");
	const rights = optionalText(raw.rights, BUNDLE_LIMITS.rights, add, "rights");
	const periods = readPeriods(raw.periods);
	if (!periods.ok)
		for (const issue of periods.issues) add(issue.path, issue.message);
	if (
		issues.length > 0 ||
		!nameEn.ok ||
		!nameAr.ok ||
		author === null ||
		rights === null ||
		!periods.ok
	)
		return { ok: false, issues };
	return {
		ok: true,
		curriculum: {
			nameEn: nameEn.text,
			nameAr: nameAr.text,
			author,
			rights,
			periods: periods.periods,
		},
	};
}

/** A text that may be empty, with its place named when it is not text at all. */
function optionalText(
	value: unknown,
	max: number,
	add: (path: string, message: string) => void,
	path: string,
): string | null {
	if (typeof value === "string" && value.trim() === "") return "";
	const checked = checkText(value, max);
	if (!checked.ok) {
		add(path, checked.message);
		return null;
	}
	return checked.text;
}

/** The model read back from its files: the header's text and one text per course. */
export function parseModelText(
	headerText: string,
	courseTexts: readonly { name: string; text: string }[],
): { ok: true; model: CurriculumModel } | { ok: false; issues: ModelIssue[] } {
	const header = parseJson(headerText, MODEL_FILE);
	if (!header.ok) return header;
	const curriculum = parseModelCurriculum(header.value);
	if (!curriculum.ok) return curriculum;
	const issues: ModelIssue[] = [];
	const courses: ModelCourse[] = [];
	for (const file of courseTexts) {
		const parsed = parseJson(file.text, `${MODEL_DIR}/${file.name}`);
		if (!parsed.ok) return parsed;
		const course = parseModelCourse(parsed.value, file.name);
		if (!course.ok) {
			for (const issue of course.issues) issues.push(issue);
			continue;
		}
		courses.push(course.course);
	}
	if (issues.length > 0) return { ok: false, issues };
	return { ok: true, model: { curriculum: curriculum.curriculum, courses } };
}

/** JSON text as a value, or one issue that names the file. */
function parseJson(
	text: string,
	where: string,
): { ok: true; value: unknown } | { ok: false; issues: ModelIssue[] } {
	try {
		return { ok: true, value: JSON.parse(text) as unknown };
	} catch {
		return { ok: false, issues: [{ path: where, message: "not valid JSON" }] };
	}
}
