// The project file and the wizard's plan: the folders it promises, the numbering of units,
// the periods a year may be split into, and the names it refuses before anything is written.
// The texts are checked by the bundle's own rules, so the same limit is tested once there.

import { describe, expect, it } from "vitest";

import {
	finalExamPeriod,
	gradeFolder,
	guessGrades,
	matchGrade,
	matchSubject,
	nextUnitFolder,
	PROJECT_FORMAT,
	PROJECT_FORMAT_VERSION,
	parseProject,
	presetPeriods,
	projectFolders,
	type SubjectLabel,
	subjectFolder,
	unitNumber,
	validFolderName,
	type WizardAnswers,
	wizardProject,
} from "./project";

/** A lowercase UUID, as a project id is written. */
const ID = "6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10";

const SUBJECTS: SubjectLabel[] = [
	{ id: "science", nameEn: "Science", nameAr: "العلوم" },
	{ id: "math", nameEn: "Mathematics", nameAr: "الرياضيات" },
	{ id: "arabic", nameEn: "Arabic", nameAr: "اللغة العربية" },
];

function answers(over: Partial<WizardAnswers> = {}): WizardAnswers {
	return {
		nameEn: "Sunrise Curriculum",
		nameAr: "منهج الشروق",
		author: "A. Teacher",
		rights: "For my own students only.",
		grades: [{ grade: 7, subjects: ["science", "math"] }],
		periods: presetPeriods("terms-blocks"),
		finalExam: true,
		...over,
	};
}

/** The project the standard answers make, or a failure that names the reason. */
function project(over: Partial<WizardAnswers> = {}) {
	const made = wizardProject(answers(over), SUBJECTS, ID);
	if (!made.ok) throw new Error(JSON.stringify(made.issues));
	return made.project;
}

describe("the wizard's folders", () => {
	it("names a grade and a subject the way the app does", () => {
		expect(gradeFolder(-1)).toBe("KG1");
		expect(gradeFolder(0)).toBe("KG2");
		expect(gradeFolder(7)).toBe("Grade 7");
		expect(subjectFolder("Science")).toBe("Science");
		expect(subjectFolder("Programming and AI (in Arabic)")).toBe(
			"Programming and AI (in Arabic)",
		);
	});

	it("puts the four sections and the three exam folders under each subject", () => {
		expect(projectFolders(project())).toEqual([
			"Inbox",
			".studio",
			"Grade 7",
			"Grade 7/Science",
			"Grade 7/Science/Units",
			"Grade 7/Science/Books",
			"Grade 7/Science/Extra",
			"Grade 7/Science/Exam",
			"Grade 7/Science/Exam/past-papers",
			"Grade 7/Science/Exam/listening-samples",
			"Grade 7/Science/Exam/reading-samples",
			"Grade 7/Mathematics",
			"Grade 7/Mathematics/Units",
			"Grade 7/Mathematics/Books",
			"Grade 7/Mathematics/Extra",
			"Grade 7/Mathematics/Exam",
			"Grade 7/Mathematics/Exam/past-papers",
			"Grade 7/Mathematics/Exam/listening-samples",
			"Grade 7/Mathematics/Exam/reading-samples",
		]);
	});

	it("numbers a new unit after the ones already there", () => {
		expect(nextUnitFolder(["01 Classification", "02 Cells"], "Energy")).toBe(
			"03 Energy",
		);
		expect(nextUnitFolder([], "Cells")).toBe("01 Cells");
		expect(nextUnitFolder(["09 Revision"], "")).toBe("10");
		expect(unitNumber("07 Atoms")).toBe(7);
		expect(unitNumber("Cells")).toBeNull();
	});

	it("refuses names Windows can't take", () => {
		expect(validFolderName("Grade 7")).toBe(true);
		expect(validFolderName("الرياضيات")).toBe(true);
		expect(validFolderName("CON")).toBe(false);
		expect(validFolderName("nul.txt")).toBe(false);
		expect(validFolderName("a/b")).toBe(false);
		expect(validFolderName("ends with a dot.")).toBe(false);
		expect(validFolderName(" padded")).toBe(false);
		expect(validFolderName("")).toBe(false);
	});
});

describe("the year's periods", () => {
	it("splits three terms into two blocks each, with ids the bundle accepts", () => {
		const periods = presetPeriods("terms-blocks");
		expect(periods.map((period) => period.id)).toEqual(["t1", "t2", "t3"]);
		expect(periods[0]?.periods.map((block) => block.id)).toEqual([
			"t1-b1",
			"t1-b2",
		]);
		expect(periods[0]?.periods[1]?.nameAr).toBe("المرحلة 2");
	});

	it("offers the other presets, and no split at all", () => {
		expect(presetPeriods("semesters")).toHaveLength(2);
		expect(presetPeriods("terms")).toHaveLength(3);
		expect(presetPeriods("quarters")).toHaveLength(4);
		expect(presetPeriods("none")).toEqual([]);
	});

	it("keeps the final exam apart, covering the whole year", () => {
		const exam = finalExamPeriod();
		expect(exam.wholeYear).toBe(true);
		expect(exam.periods).toEqual([]);
	});

	it("adds the final exam to the project when the wizard asks for it", () => {
		const withExam = project();
		expect(withExam.periods.map((period) => period.id)).toContain("final");
		const without = project({ finalExam: false });
		expect(without.periods.map((period) => period.id)).not.toContain("final");
	});
});

describe("the project file", () => {
	it("round-trips through JSON unchanged", () => {
		const written = project();
		const read = parseProject(JSON.stringify(written));
		expect(read.ok).toBe(true);
		if (read.ok) expect(read.project).toEqual(written);
	});

	it("keeps the file's own marker and version", () => {
		const written = project();
		expect(written.format).toBe(PROJECT_FORMAT);
		expect(written.formatVersion).toBe(PROJECT_FORMAT_VERSION);
	});

	it("refuses a file that isn't JSON, or isn't a project", () => {
		expect(parseProject("not json").ok).toBe(false);
		expect(parseProject("[]").ok).toBe(false);
		const text = JSON.stringify({ ...project(), format: "something-else" });
		expect(parseProject(text).ok).toBe(false);
	});

	it("refuses a field it doesn't know, so meaning can't change silently", () => {
		const text = JSON.stringify({ ...project(), extra: true });
		const read = parseProject(text);
		expect(read.ok).toBe(false);
		if (!read.ok)
			expect(read.issues.some((issue) => issue.path === "extra")).toBe(true);
	});

	it("refuses a folder name that would climb out of the project", () => {
		const written = project();
		const text = JSON.stringify({
			...written,
			grades: [{ ...written.grades[0], folder: "../Elsewhere" }],
		});
		expect(parseProject(text).ok).toBe(false);
	});

	it("refuses a grade the bundle doesn't have", () => {
		const written = project();
		const text = JSON.stringify({
			...written,
			grades: [{ ...written.grades[0], grade: 13 }],
		});
		expect(parseProject(text).ok).toBe(false);
	});
});

describe("the wizard's checks", () => {
	it("asks for both names, the author and the rights sentence", () => {
		const made = wizardProject(
			answers({ nameAr: "", author: "" }),
			SUBJECTS,
			ID,
		);
		expect(made.ok).toBe(false);
		if (!made.ok) {
			const paths = made.issues.map((issue) => issue.path);
			expect(paths).toContain("nameAr");
			expect(paths).toContain("author");
		}
	});

	it("refuses a subject Mr. Zaki doesn't teach", () => {
		const made = wizardProject(
			answers({ grades: [{ grade: 7, subjects: ["astrology"] }] }),
			SUBJECTS,
			ID,
		);
		expect(made.ok).toBe(false);
	});

	it("refuses the same grade twice, and a grade with no subject", () => {
		const twice = wizardProject(
			answers({
				grades: [
					{ grade: 7, subjects: ["science"] },
					{ grade: 7, subjects: ["math"] },
				],
			}),
			SUBJECTS,
			ID,
		);
		expect(twice.ok).toBe(false);
		const empty = wizardProject(
			answers({ grades: [{ grade: 7, subjects: [] }] }),
			SUBJECTS,
			ID,
		);
		expect(empty.ok).toBe(false);
	});

	it("refuses a period whose id can't be used in a bundle", () => {
		const made = wizardProject(
			answers({
				periods: [
					{
						id: "Term 1",
						nameEn: "Term 1",
						nameAr: "الفصل 1",
						wholeYear: false,
						periods: [],
					},
				],
			}),
			SUBJECTS,
			ID,
		);
		expect(made.ok).toBe(false);
	});

	it("refuses a name with a hidden character, as the bundle would", () => {
		const made = wizardProject(
			answers({ nameEn: "Sunrise\u200bCurriculum" }),
			SUBJECTS,
			ID,
		);
		expect(made.ok).toBe(false);
	});
});

describe("opening a folder the author already has", () => {
	it("reads the grades and subjects from folder names", () => {
		const guessed = guessGrades(
			[
				{ name: "Grade 7", children: ["Science", "Mathematics", "Exam"] },
				{ name: "KG1", children: ["Arabic"] },
				{ name: "Notes", children: [] },
			],
			SUBJECTS,
		);
		expect(guessed).toEqual([
			{ grade: -1, subjects: ["arabic"] },
			{ grade: 7, subjects: ["science", "math"] },
		]);
	});

	it("knows a grade by its English or Arabic folder name", () => {
		expect(matchGrade("Grade 7")).toBe(7);
		expect(matchGrade("kg1")).toBe(-1);
		expect(matchGrade("KG2")).toBe(0);
		expect(matchGrade("الصف 7")).toBe(7);
		expect(matchGrade("الروضة الأولى")).toBe(-1);
		expect(matchGrade("Grade 13")).toBeNull();
	});

	it("knows a subject by either of its names", () => {
		expect(matchSubject("Science", SUBJECTS)).toBe("science");
		expect(matchSubject("الرياضيات", SUBJECTS)).toBe("math");
		expect(matchSubject("Astrology", SUBJECTS)).toBeNull();
	});
});
