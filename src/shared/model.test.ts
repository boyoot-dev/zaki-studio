// The Studio's record of a curriculum and the bundle export makes (task 153): the header and
// courses as `.studio/model` keeps them, the counts the export summary shows, a fact's pages,
// and the round trip to a file the shared parser accepts. The parser is the app's own, so the
// export can never write something the server would refuse.

import { describe, expect, it } from "vitest";
import { parseBundle } from "./format/bundle.ts";

import {
	type CurriculumModel,
	checkBundle,
	courseFile,
	exportCopy,
	fileLabel,
	type ModelCourse,
	modelFileText,
	modelSummary,
	nextVersion,
	pageText,
	parseModelText,
	parseSource,
	toBundle,
} from "./model.ts";
import { type Project, presetPeriods, wizardProject } from "./project.ts";

const ID = "6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10";
const SUBJECTS = [{ id: "science", nameEn: "Science", nameAr: "العلوم" }];

/** A small project, as the wizard makes it. */
function project(): Project {
	const made = wizardProject(
		{
			nameEn: "Sunrise Curriculum",
			nameAr: "منهج الشروق",
			author: "A. Teacher",
			rights: "For my own students only.",
			grades: [{ grade: 7, subjects: ["science"] }],
			periods: presetPeriods("terms"),
			finalExam: true,
		},
		SUBJECTS,
		ID,
	);
	if (!made.ok) throw new Error(JSON.stringify(made.issues));
	return made.project;
}

/** One adopted course, with the facts' pages and status. */
function course(): ModelCourse {
	return {
		grade: 7,
		subject: "science",
		examStyle: "One paper, short answers.",
		exams: [],
		units: [
			{
				number: 1,
				period: "t1",
				title: "Classification",
				source: "sheet",
				keywords: ["species"],
				evidence: [],
				lessons: [
					{
						number: 1,
						title: "Living things",
						skills: [
							{ code: "7-1-1", text: "Sort living things into groups." },
						],
						facts: [
							{
								text: "Living things are sorted by shared features.",
								sources: ["9a010f4b4816#p6"],
								status: "reviewed",
								own: true,
							},
							{
								text: "Species is the smallest group.",
								sources: ["9a010f4b4816#p7"],
								status: "draft",
								own: false,
							},
						],
						activity: "writing",
					},
				],
			},
		],
	};
}

function model(): CurriculumModel {
	return {
		curriculum: {
			nameEn: "KESTREL",
			nameAr: "مدارس النيل",
			author: "A. Teacher",
			rights: "For my own students only.",
			periods: project().periods,
		},
		courses: [course()],
	};
}

describe("the model's bundle", () => {
	it("passes the shared parser, with the project's id and the export's version", () => {
		const bundle = toBundle(model(), project(), 3);
		expect(bundle.id).toBe(ID);
		expect(bundle.version).toBe(3);
		const checked = parseBundle(JSON.stringify(bundle), ["science"]);
		expect(checked.ok).toBe(true);
		expect(checkBundle(bundle, ["science"])).toEqual({ ok: true });
	});

	it("keeps a fact's pages, status and own flag in the project, not in the file", () => {
		const json = JSON.stringify(toBundle(model(), project(), 1));
		expect(json).not.toContain("9a010f4b4816");
		expect(json).not.toContain("reviewed");
		expect(json).toContain("Species is the smallest group.");
		expect(JSON.parse(json).courses[0].units[0].lessons[0].facts).toEqual([
			"Living things are sorted by shared features.",
			"Species is the smallest group.",
		]);
	});

	it("refuses a bundle that the app would refuse", () => {
		const broken = { ...toBundle(model(), project(), 1), author: "" };
		const checked = checkBundle(broken, ["science"]);
		expect(checked.ok).toBe(false);
		if (!checked.ok) expect(checked.issues[0]?.path).toBe("author");
	});

	it("counts what the export summary shows", () => {
		expect(modelSummary(model())).toEqual({
			courses: 1,
			units: 1,
			lessons: 1,
			facts: 2,
			exams: 0,
		});
	});
});

describe("the model's files", () => {
	it("reads back what it wrote, facts and all", () => {
		const current = model();
		const header = modelFileText(current.curriculum);
		const courses = current.courses.map((entry) => ({
			name: courseFile(entry.grade, entry.subject),
			text: modelFileText(entry),
		}));
		expect(courses[0]?.name).toBe("grade-7-science.json");
		const parsed = parseModelText(header, courses);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) expect(parsed.model).toEqual(current);
	});

	it("reads back a model the Studio wrote with empty lists", () => {
		// The writer leaves an empty list out of the file entirely, so a course with no
		// skills, a lesson with none of either, and a curriculum with no periods must all
		// read back as empty, the way the Studio wrote them.
		const current = model();
		for (const courseEntry of current.courses) {
			for (const unit of courseEntry.units) {
				unit.keywords = [];
				unit.lessons = [
					{
						number: 1,
						title: "An empty lesson",
						skills: [],
						facts: [],
						activity: null,
					},
				];
			}
		}
		current.curriculum.periods = [];
		const header = modelFileText(current.curriculum);
		const courses = current.courses.map((entry) => ({
			name: courseFile(entry.grade, entry.subject),
			text: modelFileText(entry),
		}));
		const parsed = parseModelText(header, courses);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.model.curriculum.periods).toEqual([]);
			expect(parsed.model.courses[0]?.units[0]?.lessons[0]?.skills).toEqual([]);
			expect(parsed.model.courses[0]?.units[0]?.lessons[0]?.facts).toEqual([]);
		}
	});

	it("keeps an exam whose optional fields are null, without writing a null", () => {
		const withExam = course();
		withExam.exams = [
			{
				period: "t1",
				name: "Term 1 test",
				papers: [
					{
						name: "Paper 1",
						skill: "written",
						language: null,
						minutes: null,
						marks: null,
						parts: [
							{
								id: null,
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
									count: 4,
									types: { short: 4 },
									choiceOptions: null,
									maxWords: null,
									marksEach: 0.5,
									marksByType: null,
									totalMarks: 2,
									example: null,
									copiedExactly: null,
								},
								notes: null,
								marking: null,
							},
						],
					},
				],
			},
		];
		const text = modelFileText(withExam);
		// A null would make the bundle parser refuse an exam's optional field.
		expect(text).not.toContain("null");
		const parsed = parseModelText(modelFileText(model().curriculum), [
			{ name: "grade-7-science.json", text },
		]);
		expect(parsed.ok).toBe(true);
		if (parsed.ok)
			expect(
				parsed.model.courses[0]?.exams[0]?.papers[0]?.parts[0]?.marks,
			).toBe(null);
	});

	it("names a damaged fact's place instead of throwing", () => {
		const broken = course();
		broken.units[0].lessons[0].facts[0] = {
			text: "x",
			sources: [],
			// @ts-expect-error: a damaged file, which the reader must refuse.
			status: "guessed",
			own: false,
		};
		const parsed = parseModelText(modelFileText(model().curriculum), [
			{ name: "grade-7-science.json", text: modelFileText(broken) },
		]);
		expect(parsed.ok).toBe(false);
		if (!parsed.ok)
			expect(parsed.issues[0]?.path).toBe(
				"grade-7-science.json.units[0].lessons[0].facts[0].status",
			);
	});
});

describe("a fact's pages", () => {
	it("reads the file id and the page of a source", () => {
		expect(parseSource("9a010f4b4816#p6")).toEqual({
			id: "9a010f4b4816",
			from: 6,
			to: 6,
		});
		expect(parseSource("9a010f4b4816#p12-13")).toEqual({
			id: "9a010f4b4816",
			from: 12,
			to: 13,
		});
		expect(parseSource("9a010f4b4816")).toEqual({
			id: "9a010f4b4816",
			from: null,
			to: null,
		});
		expect(parseSource("not a source")).toBeNull();
	});

	it("takes one page of the text the work folder wrote", () => {
		const text =
			"## Page 6\nCells divide.\n\n## Page 7\nA nucleus holds DNA.\nMore.\n";
		expect(pageText(text, 7)).toBe("A nucleus holds DNA.\nMore.");
		expect(pageText(text, 6)).toBe("Cells divide.");
		expect(pageText(text, 9)).toBe("");
	});

	it("names a file without its extension", () => {
		expect(fileLabel("Grade 7/Science/Units/Science sheet 3.pdf")).toBe(
			"Science sheet 3",
		);
		expect(fileLabel("no-extension")).toBe("no-extension");
	});
});

describe("export versions", () => {
	it("takes the last copy's number plus one", () => {
		expect(nextVersion([])).toBe(1);
		expect(nextVersion(["v1.json", "v2.json"])).toBe(3);
		expect(nextVersion(["notes.txt", "v7.json", "v3.json"])).toBe(8);
		expect(exportCopy(4)).toBe("v4.json");
	});
});
