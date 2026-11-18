// The one-off conversion of a project made before format version 1 (task 224, 2026-11-18).
// Before, a course's teaching language came from its subject id (`math-ar` was maths in
// Arabic) and units, lessons and skills were matched by number and position. Now a course
// carries its language and help languages, and every object a permanent id. An old project
// is converted when it is read: subjects through the fixed table below, ids derived from the
// old positions. The ids are derived, not random, so that Mr. Zaki's data migration (task
// 226) gives the same rows the same ids and children keep their progress. Pure and tested;
// main/model.ts and main/project files write the converted files back once, with a backup.

/** The old subject ids, as subject + teaching language. The table never grows. */
export const LEGACY_SUBJECTS: Readonly<
	Record<string, { subject: string; language: string }>
> = {
	math: { subject: "math", language: "en" },
	science: { subject: "science", language: "en" },
	biology: { subject: "biology", language: "en" },
	chemistry: { subject: "chemistry", language: "en" },
	physics: { subject: "physics", language: "en" },
	ict: { subject: "ict", language: "en" },
	"programming-ai": { subject: "programming-ai", language: "en" },
	english: { subject: "english", language: "en" },
	"math-ar": { subject: "math", language: "ar" },
	"science-ar": { subject: "science", language: "ar" },
	"biology-ar": { subject: "biology", language: "ar" },
	"chemistry-ar": { subject: "chemistry", language: "ar" },
	"physics-ar": { subject: "physics", language: "ar" },
	"programming-ai-ar": { subject: "programming-ai", language: "ar" },
	arabic: { subject: "arabic", language: "ar" },
	"social-studies": { subject: "social-studies", language: "ar" },
	"national-history": { subject: "national-history", language: "ar" },
	french: { subject: "french", language: "fr" },
};

/** An old subject id as subject + language; an id the table doesn't know stays, in English. */
export function legacySubject(id: string): {
	subject: string;
	language: string;
} {
	return LEGACY_SUBJECTS[id] ?? { subject: id, language: "en" };
}

/**
 * The language a new course of this subject starts with when nobody chose one: what the old
 * list taught it in. The wizard asks (task 225); this is only the fallback.
 */
export function defaultLanguage(subject: string): string {
	return legacySubject(subject).language;
}

/**
 * The help languages a converted course gets: Mr. Zaki's old fixed rule gave a young learner
 * of English or French a word of Arabic when stuck, below grade 4 (ARABIC_HELP_BELOW_GRADE).
 * That rule is now the course's own data, written as the child's own language.
 */
export function legacySupport(subject: string, grade: number): string[] {
	return (subject === "english" || subject === "french") && grade < 4
		? ["native"]
		: [];
}

type Raw = Record<string, unknown>;

function isRaw(value: unknown): value is Raw {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function list(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

/** A number as an id piece: "3", and "m1" for -1 (ids have no minus sign of their own). */
function piece(value: unknown, fallback: number): string {
	const n =
		typeof value === "number" && Number.isInteger(value) ? value : fallback;
	return n < 0 ? `m${-n}` : String(n);
}

/** True when a value is already an id the format accepts. */
function hasId(raw: Raw): boolean {
	return typeof raw.id === "string" && /^[a-z0-9-]{1,40}$/.test(raw.id);
}

/**
 * The ids an old course gets, written into its raw JSON where missing: unit `u<number>`,
 * lesson `u<unit>-l<number>`, skill `u<unit>-l<lesson>-s<position from 1>`, exam
 * `e<index from 1>`, paper `e<i>-p<j>`, part `e<i>-p<j>-t<k>` unless it already had one.
 * Task 226's migration uses the same rule on the app's rows. Returns true when it added any.
 */
export function addPositionalIds(course: Raw): boolean {
	let changed = false;
	for (const unit of list(course.units)) {
		if (!isRaw(unit)) continue;
		const u = `u${piece(unit.number, 0)}`;
		if (!hasId(unit)) {
			unit.id = u;
			changed = true;
		}
		for (const lesson of list(unit.lessons)) {
			if (!isRaw(lesson)) continue;
			const l = `${u}-l${piece(lesson.number, 0)}`;
			if (!hasId(lesson)) {
				lesson.id = l;
				changed = true;
			}
			const skills = list(lesson.skills);
			for (const [i, skill] of skills.entries()) {
				const id = `${l}-s${i + 1}`;
				if (typeof skill === "string") {
					skills[i] = { id, code: null, text: skill };
					changed = true;
				} else if (isRaw(skill) && !hasId(skill)) {
					skill.id = id;
					changed = true;
				}
			}
		}
	}
	for (const [i, exam] of list(course.exams).entries()) {
		if (!isRaw(exam)) continue;
		const e = `e${i + 1}`;
		if (!hasId(exam)) {
			exam.id = e;
			changed = true;
		}
		for (const [j, paper] of list(exam.papers).entries()) {
			if (!isRaw(paper)) continue;
			const p = `${e}-p${j + 1}`;
			if (!hasId(paper)) {
				paper.id = p;
				changed = true;
			}
			for (const [k, part] of list(paper.parts).entries()) {
				if (!isRaw(part) || hasId(part)) continue;
				part.id = `${p}-t${k + 1}`;
				changed = true;
			}
		}
	}
	return changed;
}

/**
 * An old model course in place: its subject through the table, its language and help
 * languages set, and every object given its id. Returns true when anything changed, so the
 * caller knows to write the file back.
 */
export function convertCourse(course: Raw): boolean {
	let changed = false;
	if (typeof course.language !== "string") {
		const old = legacySubject(
			typeof course.subject === "string" ? course.subject : "",
		);
		course.subject = old.subject;
		course.language = old.language;
		const grade = typeof course.grade === "number" ? course.grade : 0;
		course.support = legacySupport(old.subject, grade);
		changed = true;
	}
	if (course.support === undefined) course.support = [];
	if (addPositionalIds(course)) changed = true;
	return changed;
}

/**
 * An old project file's grades in place: each subject entry through the table, with its
 * language and help languages. Returns true when anything changed.
 */
export function convertProjectGrades(grades: unknown): boolean {
	let changed = false;
	for (const grade of list(grades)) {
		if (!isRaw(grade)) continue;
		const number = typeof grade.grade === "number" ? grade.grade : 0;
		for (const entry of list(grade.subjects)) {
			if (!isRaw(entry) || typeof entry.language === "string") continue;
			const old = legacySubject(
				typeof entry.subject === "string" ? entry.subject : "",
			);
			entry.subject = old.subject;
			entry.language = old.language;
			entry.support = legacySupport(old.subject, number);
			changed = true;
		}
	}
	return changed;
}
