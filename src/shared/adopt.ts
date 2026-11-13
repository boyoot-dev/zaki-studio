// Opening today's material as one project (task 153, docs/STUDIO.md). The work already done
// is not re-read or re-drafted: the built-in curriculum files give the units, lessons, skills,
// facts, key words, evidence, exam style and exams, with each fact's pages and status; the
// work folder's register names those pages and gives each file its grade, subject and kind.
// This file holds the decisions (what a row means, which folder a course lives in, what the
// project says) and is pure; src/main/adopt.ts reads and writes the folders.

import { BUNDLE_LIMITS, checkText } from "./format/bundle.ts";
import {
	type CurriculumModel,
	type FactStatus,
	type FileRow,
	type ModelCourse,
	type ModelCurriculum,
	parseModelCourse,
} from "./model.ts";
import {
	gradeFolder,
	PROJECT_FORMAT,
	PROJECT_FORMAT_VERSION,
	type Project,
	type ProjectGrade,
	type ProjectIssue,
	type ProjectSubject,
	parseProject,
	readPeriods,
	subjectFolder,
	validFolderName,
} from "./project.ts";

// The work folder's index and subjects are the register's own rules (task 156): adoption and a
// scan must read them one way, so they live in src/shared/register.ts and are re-exported here.
export {
	type IndexRow,
	parseCsv,
	readIndex,
	readSubjectFolders,
	registerRows,
} from "./register.ts";

/** The register rows a project keeps, with paths relative to the project root. */
export type AdoptInput = {
	/** The new project's id: a lowercase UUID, made when the author adopts. */
	id: string;
	/** The folder name of the curriculum, e.g. "kestrel". */
	curriculumId: string;
	/** What the built-in curriculum's curriculum.json says. */
	header: ModelCurriculum;
	/** The built-in courses, each fact with its pages and status. */
	courses: ModelCourse[];
	/** The register rows of this curriculum, their paths relative to the project root. */
	register: FileRow[];
	/** The folder names of the material, and the subject each stands for. */
	subjectFolders: { folder: string; subject: string }[];
};

/** What adopting writes: the project file and the Studio's model of the curriculum. */
export type AdoptPlan = { project: Project; model: CurriculumModel };

/**
 * A built-in course file as the model's course. Its facts are a text or
 * {text, sources, status}; a reviewed fact is the author's own, so a rebuild never
 * overwrites it (docs/STUDIO.md). The values are then checked by the model's own reader,
 * so the Studio accepts exactly the courses it can export.
 */
export function courseFromFile(
	value: unknown,
	curriculumId: string,
	where: string,
): { ok: true; course: ModelCourse } | { ok: false; issues: ProjectIssue[] } {
	const withFacts = withModelFacts(value);
	if (typeof withFacts !== "object" || withFacts === null) {
		return {
			ok: false,
			issues: [{ path: where, message: "expected a course" }],
		};
	}
	const raw = withFacts as Record<string, unknown>;
	if (raw.curriculum !== curriculumId)
		return {
			ok: false,
			issues: [
				{
					path: `${where}.curriculum`,
					message: `"${String(raw.curriculum)}" must match its folder "${curriculumId}"`,
				},
			],
		};
	const parsed = parseModelCourse(withFacts, where);
	return parsed.ok
		? { ok: true, course: parsed.course }
		: { ok: false, issues: parsed.issues };
}

/** The course file rewritten as the model's shape, leaving anything else alone. */
function withModelFacts(value: unknown): unknown {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return value;
	const course = value as Record<string, unknown>;
	if (!Array.isArray(course.units)) return value;
	return {
		...course,
		units: course.units.map((unit) => {
			if (typeof unit !== "object" || unit === null) return unit;
			const raw = unit as Record<string, unknown>;
			if (!Array.isArray(raw.lessons)) return unit;
			return {
				...raw,
				lessons: raw.lessons.map((lesson) => {
					if (typeof lesson !== "object" || lesson === null) return lesson;
					const entry = lesson as Record<string, unknown>;
					const skills = Array.isArray(entry.skills)
						? entry.skills.map(skillOf)
						: entry.skills;
					if (!Array.isArray(entry.facts)) return { ...entry, skills };
					return { ...entry, skills, facts: entry.facts.map(factOf) };
				}),
			};
		}),
	};
}

/** One skill of a built-in file: a text, or {code, text}, as the model keeps it. */
function skillOf(value: unknown): unknown {
	return typeof value === "string" ? { code: null, text: value } : value;
}

/** One fact of a built-in file as the model's fact: its pages and status, and whose it is. */
function factOf(value: unknown): unknown {
	if (typeof value === "string")
		return { text: value, sources: [], status: "draft", own: false };
	if (typeof value !== "object" || value === null) return value;
	const raw = value as Record<string, unknown>;
	const status: FactStatus =
		raw.status === "reviewed"
			? "reviewed"
			: raw.status === "checked"
				? "checked"
				: "draft";
	return {
		text: raw.text,
		sources: Array.isArray(raw.sources) ? raw.sources : [],
		status,
		own: status === "reviewed",
	};
}

/** The built-in curriculum.json as the model's header, without an author or rights yet. */
export function headerFromFile(
	value: unknown,
	where: string,
):
	| { ok: true; header: ModelCurriculum }
	| { ok: false; issues: ProjectIssue[] } {
	const issues: ProjectIssue[] = [];
	const add = (path: string, message: string) => issues.push({ path, message });
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return {
			ok: false,
			issues: [{ path: where, message: "expected an object" }],
		};
	const raw = value as Record<string, unknown>;
	const nameEn = checkText(raw.nameEn, BUNDLE_LIMITS.nameEn);
	const nameAr = checkText(raw.nameAr, BUNDLE_LIMITS.nameAr);
	if (!nameEn.ok) add(`${where}.nameEn`, nameEn.message);
	if (!nameAr.ok) add(`${where}.nameAr`, nameAr.message);
	const periods = readPeriods(raw.periods);
	if (!periods.ok)
		for (const issue of periods.issues)
			add(`${where}.${issue.path}`, issue.message);
	if (issues.length > 0 || !nameEn.ok || !nameAr.ok || !periods.ok)
		return { ok: false, issues };
	return {
		ok: true,
		header: {
			nameEn: nameEn.text,
			nameAr: nameAr.text,
			// The author fills these in; export asks for them (task 153).
			author: "",
			rights: "",
			periods: periods.periods,
		},
	};
}

/**
 * The project and model adoption makes: the author's own folders as they are on disk (an
 * adopted project keeps no Units/Books/Extra/Exam layout), every course of the built-in
 * curriculum, and each fact with its pages and status. The project is checked by the same
 * reader the app opens it with, so a plan this refuses never reaches disk.
 */
export function planAdopt(
	input: AdoptInput,
): { ok: true; plan: AdoptPlan } | { ok: false; issues: ProjectIssue[] } {
	// The folders the author already has: the first row of a grade names its folder, and the
	// deepest folder of a row that _subjects.csv maps to the course's subject names that one.
	const sorted = [...input.register].sort((a, b) =>
		a.path.localeCompare(b.path),
	);
	const gradeFolders = new Map<number, string>();
	const courseFolders = new Map<string, string>();
	for (const row of sorted) {
		const grade = row.grade;
		if (grade === null) continue;
		const parts = row.path.split("/").filter((part) => part !== "");
		const folder = parts[0];
		if (folder === undefined) continue;
		if (!gradeFolders.has(grade)) gradeFolders.set(grade, folder);
		const key = `${grade}|${row.subject}`;
		if (row.subject === "" || courseFolders.has(key)) continue;
		const folders = parts.slice(1, -1);
		const found = folders.find((part) =>
			input.subjectFolders.some(
				(entry) => entry.folder === part && entry.subject === row.subject,
			),
		);
		if (found !== undefined) courseFolders.set(key, found);
	}
	const subjectFolderOf = (subject: string): string | undefined =>
		input.subjectFolders.find((entry) => entry.subject === subject)?.folder;

	const grades = new Map<number, ProjectGrade>();
	for (const course of input.courses) {
		const gradeEntry = grades.get(course.grade) ?? {
			grade: course.grade,
			folder: gradeFolders.get(course.grade) ?? gradeFolder(course.grade),
			subjects: [],
		};
		const key = `${course.grade}|${course.subject}`;
		const found =
			courseFolders.get(key) ??
			subjectFolderOf(course.subject) ??
			subjectFolder(course.subject);
		const subject: ProjectSubject = {
			subject: course.subject,
			folder: validFolderName(found) ? found : subjectFolder(course.subject),
		};
		if (!gradeEntry.subjects.some((entry) => entry.subject === subject.subject))
			gradeEntry.subjects.push(subject);
		grades.set(course.grade, gradeEntry);
	}
	if (grades.size === 0)
		return {
			ok: false,
			issues: [{ path: "", message: "the curriculum has no courses to adopt" }],
		};

	const project: Project = {
		format: PROJECT_FORMAT,
		formatVersion: PROJECT_FORMAT_VERSION,
		id: input.id,
		nameEn: input.header.nameEn,
		nameAr: input.header.nameAr,
		author: input.header.author,
		rights: input.header.rights,
		periods: input.header.periods,
		grades: [...grades.values()].sort((a, b) => a.grade - b.grade),
	};
	const checked = parseProject(JSON.stringify(project));
	if (!checked.ok) return checked;

	const courses = input.courses
		.map((course) => ({
			...course,
			units: course.units.map((unit) => ({
				...unit,
				lessons: unit.lessons.map((lesson) => ({
					...lesson,
					facts: lesson.facts.map((fact) => ({
						...fact,
						own: fact.own || fact.status === "reviewed",
					})),
				})),
			})),
		}))
		.sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject));
	return {
		ok: true,
		plan: {
			project: checked.project,
			model: {
				curriculum: {
					nameEn: checked.project.nameEn,
					nameAr: checked.project.nameAr,
					author: checked.project.author,
					rights: checked.project.rights,
					periods: checked.project.periods,
				},
				courses,
			},
		},
	};
}
