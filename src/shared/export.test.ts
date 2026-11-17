// The export's pure pieces (task 153): the file name the save dialog suggests on Windows, and
// the check that refuses a bundle whose course names a subject Mr. Zaki doesn't know.

import { describe, expect, it } from "vitest";

import {
	bundleText,
	exportFileName,
	filledModel,
	issueLines,
} from "./export.ts";
import type { BundleExam } from "./format/bundle.ts";
import type { CurriculumModel } from "./model.ts";
import { type Project, presetPeriods, wizardProject } from "./project.ts";

const ID = "6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10";

function project(): Project {
	const made = wizardProject(
		{
			nameEn: "Sunrise Curriculum",
			nameAr: "منهج الشروق",
			author: "A. Teacher",
			rights: "For my own students only.",
			grades: [{ grade: 7, subjects: ["science"] }],
			periods: presetPeriods("terms"),
			finalExam: false,
		},
		[{ id: "science", nameEn: "Science", nameAr: "العلوم" }],
		ID,
	);
	if (!made.ok) throw new Error(JSON.stringify(made.issues));
	return made.project;
}

function model(subject = "science"): CurriculumModel {
	return {
		curriculum: {
			nameEn: "KESTREL",
			nameAr: "مدارس النيل",
			author: "A. Teacher",
			rights: "For my own students only.",
			periods: project().periods,
		},
		courses: [
			{
				grade: 7,
				subject,
				examStyle: null,
				exams: [],
				units: [
					{
						number: 1,
						period: "t1",
						title: "Classification",
						source: "sheet",
						keywords: [],
						evidence: [],
						lessons: [
							{
								number: 1,
								title: "Living things",
								skills: [{ code: null, text: "Sort living things." }],
								facts: [
									{
										text: "Living things are sorted by features.",
										sources: ["9a010f4b4816#p6"],
										status: "reviewed",
										own: true,
									},
								],
								activity: null,
							},
						],
					},
				],
			},
		],
	};
}

describe("the bundle an export writes", () => {
	it("is the file the shared parser accepts, and nothing else", () => {
		const result = bundleText(project(), model(), 2, ["science"]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.text);
			expect(parsed.format).toBe("mr-zaki-curriculum");
			expect(parsed.version).toBe(2);
			expect(parsed.courses[0].units[0].lessons[0].facts).toEqual([
				"Living things are sorted by features.",
			]);
		}
	});

	it("says version 1 when no part gives the answer's length", () => {
		const result = bundleText(project(), model(), 1, ["science"]);
		expect(result.ok).toBe(true);
		if (result.ok) expect(JSON.parse(result.text).formatVersion).toBe(1);
	});

	it("says version 2 when a part gives the answer's length", () => {
		const withWriting = model();
		const course = withWriting.courses[0];
		if (course === undefined) throw new Error("the model has no course");
		course.exams.push(writingExam([300, 400]));
		const result = bundleText(project(), withWriting, 1, ["science"]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.text);
			expect(parsed.formatVersion).toBe(2);
			expect(
				parsed.courses[0].exams[0].papers[0].parts[0].questions.answerWords,
			).toEqual([300, 400]);
		}
	});

	it("refuses a subject the app doesn't know", () => {
		const result = bundleText(project(), model("astrology"), 1, ["science"]);
		expect(result.ok).toBe(false);
		if (!result.ok)
			expect(issueLines(result.issues)[0]).toContain(
				'unknown subject "astrology"',
			);
	});
});

/** A writing paper with one part, so a test can give the answer's length. */
function writingExam(answerWords: [number, number] | null): BundleExam {
	return {
		period: null,
		name: "Writing paper",
		papers: [
			{
				name: "Paper 1: Writing",
				skill: "writing",
				language: null,
				minutes: null,
				marks: null,
				parts: [
					{
						id: "write-1",
						name: "Part 1",
						nameEn: null,
						instruction: null,
						instructionEn: null,
						marks: null,
						minutes: null,
						material: {
							kind: "none",
							description: null,
							words: null,
							speakers: null,
							topic: null,
							layout: [],
							timing: null,
						},
						questions: {
							count: 1,
							types: { essay: 1 },
							choiceOptions: null,
							maxWords: null,
							answerWords,
							marksEach: null,
							marksByType: null,
							totalMarks: null,
							example: null,
							copiedExactly: null,
						},
						notes: null,
						marking: null,
					},
				],
			},
		],
	};
}

describe("the author's answers", () => {
	it("go into the file the first export writes", () => {
		const empty = model();
		empty.curriculum.author = "";
		empty.curriculum.rights = "";
		const filled = filledModel(
			empty,
			"A. Teacher",
			"For my own students only.",
		);
		expect(filled.ok).toBe(true);
		if (!filled.ok) return;
		const result = bundleText(project(), filled.model, 1, ["science"]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.text);
			expect(parsed.author).toBe("A. Teacher");
			expect(parsed.rights).toBe("For my own students only.");
		}
	});

	it("are refused when the project has neither and the dialog said nothing", () => {
		const empty = model();
		empty.curriculum.author = "";
		empty.curriculum.rights = "";
		const filled = filledModel(empty, "", "");
		expect(filled.ok).toBe(false);
		if (!filled.ok) {
			expect(filled.issues).toHaveLength(2);
			expect(filled.issues[0]).toContain("author:");
			expect(filled.issues[1]).toContain("rights:");
		}
	});
});

describe("the name the save dialog suggests", () => {
	it("keeps a readable name and the version", () => {
		expect(exportFileName("Sunrise Curriculum", 3)).toBe(
			"Sunrise Curriculum v3.zaki",
		);
	});

	it("takes out the characters Windows refuses", () => {
		expect(exportFileName('A/B: "C" <D>', 1)).toBe("A-B- -C- -D- v1.zaki");
		expect(exportFileName("", 1)).toBe("curriculum v1.zaki");
	});
});
