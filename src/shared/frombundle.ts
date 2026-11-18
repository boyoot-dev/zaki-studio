// A project made from a curriculum file (task 214). The owner, 2026-11-17: open an existing
// .zaki file and add to it, such as a missing grade, a missing block, or more material
// for a course it already has. Task 178 already builds new courses and empty blocks from
// material, so the only missing piece is turning the file into a project.
//
// The project takes the bundle's id, so its next export is an update of the same curriculum
// for every family that has it, and never a second one. The bundle's facts carry no
// sources (a bundle has no place for them), so they come in as the author's own
// (`reviewed`, `own`): a later change set adds facts beside them and never replaces them
// without a word. Pure and tested; src/main/frombundle.ts reads the file and writes the
// project.

import type { Bundle } from "./format/bundle.ts";
import type { CurriculumModel, ModelCourse } from "./model.ts";
import {
	gradeFolder,
	PROJECT_FORMAT,
	PROJECT_FORMAT_VERSION,
	type Project,
	type SubjectLabel,
	subjectFolder,
} from "./project.ts";

/** The project and the model a checked bundle makes, with nothing of it dropped. */
export function projectFromBundle(
	bundle: Bundle,
	subjects: readonly SubjectLabel[],
): { project: Project; model: CurriculumModel } {
	// The Studio keeps one course per subject and grade (task 224); a file with a subject in
	// two languages in one grade keeps the first of them.
	const byGrade = new Map<
		number,
		{ id: string; language: string; support: string[] }[]
	>();
	const kept = bundle.courses.filter((course) => {
		const list = byGrade.get(course.grade) ?? [];
		byGrade.set(course.grade, list);
		if (list.some((entry) => entry.id === course.subject)) return false;
		list.push({
			id: course.subject,
			language: course.language,
			support: [...course.support],
		});
		return true;
	});
	const nameOf = (id: string) =>
		subjects.find((subject) => subject.id === id)?.nameEn ?? id;
	const project: Project = {
		format: PROJECT_FORMAT,
		formatVersion: PROJECT_FORMAT_VERSION,
		id: bundle.id,
		nameEn: bundle.nameEn,
		nameAr: bundle.nameAr,
		author: bundle.author,
		rights: bundle.rights,
		periods: structuredClone(bundle.periods),
		grades: [...byGrade.entries()]
			.sort(([a], [b]) => a - b)
			.map(([grade, entries]) => ({
				grade,
				folder: gradeFolder(grade),
				subjects: entries.map((entry) => ({
					subject: entry.id,
					folder: subjectFolder(nameOf(entry.id)),
					language: entry.language,
					support: entry.support,
				})),
			})),
	};
	const courses: ModelCourse[] = kept.map((course) => ({
		grade: course.grade,
		subject: course.subject,
		language: course.language,
		support: [...course.support],
		examStyle: course.examStyle,
		exams: structuredClone(course.exams),
		units: course.units.map((unit) => ({
			id: unit.id,
			number: unit.number,
			period: unit.period,
			title: unit.title,
			source: unit.source,
			keywords: [...unit.keywords],
			evidence: [...unit.evidence],
			lessons: unit.lessons.map((lesson) => ({
				id: lesson.id,
				number: lesson.number,
				title: lesson.title,
				skills: lesson.skills.map((skill) => ({ ...skill })),
				facts: lesson.facts.map((text) => ({
					text,
					sources: [],
					status: "reviewed" as const,
					own: true,
				})),
				activity: lesson.activity,
			})),
		})),
	}));
	return {
		project,
		model: {
			curriculum: {
				nameEn: bundle.nameEn,
				nameAr: bundle.nameAr,
				author: bundle.author,
				rights: bundle.rights,
				periods: structuredClone(bundle.periods),
			},
			courses,
		},
	};
}
