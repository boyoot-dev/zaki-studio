// The one-off conversion of a project made before format version 1 (task 224), and the ids
// the Studio gives new objects. The positional ids must be exactly the ones Mr. Zaki's data
// migration derives (task 226), or children's progress would not find its rows again.

import { describe, expect, it } from "vitest";
import { keepSkillIds } from "./changes.ts";
import {
	addPositionalIds,
	convertCourse,
	convertProjectGrades,
	legacySubject,
	legacySupport,
} from "./convert.ts";
import { fillExamIds } from "./exam-changes.ts";
import { newId } from "./ids.ts";
import { parseModelCourse, toBundle, withProjectLanguages } from "./model.ts";
import { parseProject } from "./project.ts";

/** An old model course: no language, no ids, a string skill, an exam with one part id. */
function oldCourse(subject: string, grade: number): Record<string, unknown> {
	return {
		grade,
		subject,
		exams: [
			{
				name: "Final",
				papers: [
					{
						name: "Paper 1",
						skill: "written",
						parts: [
							{
								id: "ar9-l1",
								name: "Part 1",
								material: { kind: "none" },
								questions: { count: 1, types: { other: 1 } },
							},
							{
								name: "Part 2",
								material: { kind: "none" },
								questions: { count: 1, types: { other: 1 } },
							},
						],
					},
				],
			},
		],
		units: [
			{
				number: 3,
				period: "t1",
				title: "Forces",
				source: "sheet",
				keywords: [],
				evidence: [],
				lessons: [
					{
						number: 2,
						title: "Friction",
						skills: [
							{ code: null, text: "Explain friction." },
							{ code: "F2", text: "Measure friction." },
						],
						facts: [],
						activity: null,
					},
				],
			},
		],
	};
}

describe("the old subject ids", () => {
	it("fold each language copy into its subject", () => {
		expect(legacySubject("math-ar")).toEqual({
			subject: "math",
			language: "ar",
		});
		expect(legacySubject("programming-ai-ar")).toEqual({
			subject: "programming-ai",
			language: "ar",
		});
		expect(legacySubject("math")).toEqual({ subject: "math", language: "en" });
		expect(legacySubject("social-studies")).toEqual({
			subject: "social-studies",
			language: "ar",
		});
		expect(legacySubject("french")).toEqual({
			subject: "french",
			language: "fr",
		});
	});

	it("give English and French below grade 4 the child's own language as help", () => {
		expect(legacySupport("english", 3)).toEqual(["native"]);
		expect(legacySupport("french", -1)).toEqual(["native"]);
		expect(legacySupport("english", 4)).toEqual([]);
		expect(legacySupport("math", 2)).toEqual([]);
	});
});

describe("converting an old course", () => {
	it("sets the subject and language, and ids from the old positions", () => {
		const course = oldCourse("math-ar", 7);
		expect(convertCourse(course)).toBe(true);
		expect(course.subject).toBe("math");
		expect(course.language).toBe("ar");
		expect(course.support).toEqual([]);
		const unit = (course.units as Record<string, unknown>[])[0] as Record<
			string,
			unknown
		>;
		expect(unit.id).toBe("u3");
		const lesson = (unit.lessons as Record<string, unknown>[])[0] as Record<
			string,
			unknown
		>;
		expect(lesson.id).toBe("u3-l2");
		expect(lesson.skills).toEqual([
			{ id: "u3-l2-s1", code: null, text: "Explain friction." },
			{ id: "u3-l2-s2", code: "F2", text: "Measure friction." },
		]);
		const exam = (course.exams as Record<string, unknown>[])[0] as Record<
			string,
			unknown
		>;
		expect(exam.id).toBe("e1");
		const paper = (exam.papers as Record<string, unknown>[])[0] as Record<
			string,
			unknown
		>;
		expect(paper.id).toBe("e1-p1");
		const parts = paper.parts as Record<string, unknown>[];
		// A part keeps the id it had; one without gets its place.
		expect(parts.map((part) => part.id)).toEqual(["ar9-l1", "e1-p1-t2"]);
	});

	it("gives a grade 3 English course help in the child's own language", () => {
		const course = oldCourse("english", 3);
		convertCourse(course);
		expect(course.language).toBe("en");
		expect(course.support).toEqual(["native"]);
	});

	it("leaves a converted course as it is", () => {
		const course = oldCourse("math-ar", 7);
		convertCourse(course);
		const again = structuredClone(course);
		expect(convertCourse(again)).toBe(false);
		expect(again).toEqual(course);
		expect(addPositionalIds(again)).toBe(false);
	});

	it("reads back as a model course, and exports the same ids every time", () => {
		const parsed = parseModelCourse(oldCourse("physics-ar", 9));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.converted).toBe(true);
		expect(parsed.course.language).toBe("ar");
		const project = {
			id: "6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10",
		} as Parameters<typeof toBundle>[1];
		const model = {
			curriculum: {
				nameEn: "N",
				nameAr: "N",
				author: "A",
				rights: "R",
				periods: [],
			},
			courses: [parsed.course],
		};
		const first = JSON.stringify(toBundle(model, project, 1).courses);
		const second = JSON.stringify(toBundle(model, project, 2).courses);
		expect(first).toBe(second);
		expect(first).toContain('"id":"u3-l2-s2"');
	});
});

describe("converting an old project file", () => {
	const old = {
		format: "mr-zaki-studio-project",
		formatVersion: 1,
		id: "6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10",
		nameEn: "Old",
		nameAr: "قديم",
		author: "",
		rights: "",
		periods: [],
		grades: [
			{
				grade: 3,
				folder: "Grade 3",
				subjects: [
					{ subject: "english", folder: "English" },
					{ subject: "math-ar", folder: "Mathematics (in Arabic)" },
				],
			},
		],
	};

	it("reads as version 2, says it was converted, and keeps the folders", () => {
		const result = parseProject(JSON.stringify(old));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.converted).toBe(true);
		expect(result.project.formatVersion).toBe(2);
		expect(result.project.grades[0]?.subjects).toEqual([
			{
				subject: "english",
				folder: "English",
				language: "en",
				support: ["native"],
			},
			{
				subject: "math",
				folder: "Mathematics (in Arabic)",
				language: "ar",
				support: [],
			},
		]);
	});

	it("leaves a version 2 project alone", () => {
		const first = parseProject(JSON.stringify(old));
		if (!first.ok) throw new Error("refused");
		const again = parseProject(JSON.stringify(first.project));
		expect(again.ok && again.converted).toBe(false);
		const grades = structuredClone(first.project.grades);
		expect(convertProjectGrades(grades)).toBe(false);
	});

	it("gives the model the project's languages", () => {
		const parsed = parseModelCourse(oldCourse("math", 3));
		if (!parsed.ok) throw new Error("refused");
		const project = parseProject(JSON.stringify(old));
		if (!project.ok) throw new Error("refused");
		const grades = structuredClone(project.project.grades);
		const entry = grades[0]?.subjects.find((s) => s.subject === "math");
		if (entry !== undefined) entry.support = ["en"];
		const model = withProjectLanguages(
			{
				curriculum: {
					nameEn: "N",
					nameAr: "N",
					author: "",
					rights: "",
					periods: [],
				},
				courses: [parsed.course],
			},
			{ grades },
		);
		expect(model.courses[0]?.language).toBe("ar");
		expect(model.courses[0]?.support).toEqual(["en"]);
	});
});

describe("new ids", () => {
	it("are 8 characters of a-z0-9, and 10,000 of them never repeat", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 10_000; i += 1) {
			const id = newId();
			expect(id).toMatch(/^[a-z0-9]{8}$/);
			seen.add(id);
		}
		expect(seen.size).toBe(10_000);
	});
});

describe("a skill's id through a change set", () => {
	const old = [
		{ id: "a", code: null, text: "One." },
		{ id: "b", code: null, text: "Two." },
	];

	it("stays with the same text, wherever it moves", () => {
		const out = keepSkillIds(old, [
			{ code: null, text: "Two." },
			{ code: null, text: "One." },
		]);
		expect(out.map((skill) => skill.id)).toEqual(["b", "a"]);
	});

	it("stays with its place when the skill is reworded, and a new skill gets a new id", () => {
		const out = keepSkillIds(old, [
			{ code: null, text: "One, said better." },
			{ code: null, text: "Two." },
			{ code: null, text: "Three." },
		]);
		expect(out[0]?.id).toBe("a");
		expect(out[1]?.id).toBe("b");
		expect(out[2]?.id).toMatch(/^[a-z0-9]{8}$/);
	});
});

describe("an exam's ids through a change set", () => {
	it("keeps today's exam and paper ids by name, and gives new ones to new ones", () => {
		const raw = [
			{
				name: "Final",
				papers: [{ name: "Paper 1" }, { name: "Paper 2" }],
			},
			{ name: "Mock", papers: [{ name: "Paper 1" }] },
		];
		fillExamIds(raw, [
			{
				id: "e1",
				period: null,
				name: "Final",
				papers: [
					{
						id: "e1-p1",
						name: "Paper 1",
						skill: "written",
						language: null,
						minutes: null,
						marks: null,
						parts: [],
					},
				],
			},
		]);
		const [final, mock] = raw as unknown as {
			id: string;
			papers: { id: string }[];
		}[];
		expect(final?.id).toBe("e1");
		expect(final?.papers[0]?.id).toBe("e1-p1");
		expect(final?.papers[1]?.id).toMatch(/^[a-z0-9]{8}$/);
		expect(mock?.id).toMatch(/^[a-z0-9]{8}$/);
	});
});
