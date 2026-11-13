// The decisions adoption makes (task 153): what a register row means, which of the author's
// folders a course lives in, what each fact keeps, and the project that results. The files
// themselves are read and written in src/main/adopt.ts; these tests use values only.

import { describe, expect, it } from "vitest";
import {
	courseFromFile,
	headerFromFile,
	parseCsv,
	planAdopt,
	readIndex,
	readSubjectFolders,
	registerRows,
} from "./adopt";
import type { FileRow } from "./model";

const ID = "6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10";
const PERIODS = [
	{
		id: "b1",
		nameEn: "Block 1",
		nameAr: "المرحلة 1",
		wholeYear: false,
		periods: [],
	},
];

/** A curriculum.json as the app writes it. */
function def(): unknown {
	return { nameEn: "KESTREL", nameAr: "مدارس النيل", periods: PERIODS };
}

/** One grade file, with a reviewed fact, a draft fact and a plain string fact. */
function gradeFile(over: Record<string, unknown> = {}): unknown {
	return {
		curriculum: "kestrel",
		subject: "science",
		grade: 7,
		examStyle: "One paper, short answers.",
		units: [
			{
				number: 1,
				period: "b1",
				title: "Classification",
				source: "sheet",
				keywords: ["species"],
				evidence: [],
				lessons: [
					{
						number: 1,
						title: "Living things",
						skills: [
							{ code: "7-1-1", text: "Sort living things." },
							"Name the five kingdoms.",
						],
						facts: [
							{
								text: "Living things are sorted by features.",
								sources: ["9a010f4b4816#p6"],
								status: "reviewed",
							},
							{
								text: "Species is the smallest group.",
								sources: ["9a010f4b4816#p7"],
								status: "draft",
							},
							"A fact with no page.",
						],
						activity: "writing",
					},
				],
			},
		],
		...over,
	};
}

/** A register row with the fields adoption always has, and whatever a test changes. */
function rowOf(row: Partial<FileRow> & { id: string; path: string }): FileRow {
	return {
		grade: null,
		subject: "",
		block: "",
		kind: "",
		pages: null,
		authority: null,
		year: "old",
		academicYear: "",
		published: "",
		publishedFrom: "",
		dupOf: "",
		imagePages: 0,
		error: "",
		firstSeen: "",
		size: 0,
		mtime: "",
		metaDate: "",
		fixed: [],
		...row,
	};
}

function rows(): FileRow[] {
	return [
		rowOf({
			id: "9a010f4b4816",
			path: "Grade 7/Science/Units/Science sheet 1.pdf",
			grade: 7,
			subject: "science",
			block: "1",
			kind: "sheet",
			pages: 8,
			authority: 1,
		}),
	];
}

describe("reading the register", () => {
	it("splits CSV with commas, quotes and line breaks", () => {
		const text = 'a,b\n1,"two, words"\n3,"line\nbreak"\n';
		expect(parseCsv(text)).toEqual([
			["a", "b"],
			["1", "two, words"],
			["3", "line\nbreak"],
		]);
	});

	it("reads the index's rows by their header, keeping empty fields", () => {
		const text = [
			"id,path,grade,year,subject,block,kind,pages,curriculum,dup_of,authority",
			"9a010f4b4816,kestrel/Grade 7/Science/sheet.pdf,7,current,science,1,sheet,8,kestrel,,1",
			"another,kestrel/Grade 7/Math/x.pdf,,,,,,kestrel,,3",
		].join("\n");
		const parsed = readIndex(text);
		expect(parsed).toHaveLength(2);
		expect(parsed[0]?.path).toBe("kestrel/Grade 7/Science/sheet.pdf");
		expect(parsed[1]?.subject).toBe("");
	});

	it("keeps the register rows of one curriculum, with paths inside its folder", () => {
		const parsed = readIndex(
			[
				"id,path,grade,subject,block,kind,pages,curriculum,dup_of,authority",
				"9a010f4b4816,kestrel/Grade 7/Science/sheet.pdf,7,science,1,sheet,8,kestrel,,1",
				"bbbbbbbbbbbb,other/Grade 9/Bio/x.pdf,9,biology,2,exam,4,other,,2",
			].join("\n"),
		);
		expect(registerRows(parsed, "kestrel")).toEqual([
			rowOf({
				id: "9a010f4b4816",
				path: "Grade 7/Science/sheet.pdf",
				grade: 7,
				subject: "science",
				block: "1",
				kind: "sheet",
				pages: 8,
				authority: 1,
			}),
		]);
	});

	it("reads the folder names _subjects.csv maps to subject ids", () => {
		expect(
			readSubjectFolders("folder,subject\nScience,science\nالعلوم,science\n"),
		).toEqual([
			{ folder: "Science", subject: "science" },
			{ folder: "العلوم", subject: "science" },
		]);
	});
});

describe("a built-in course file", () => {
	it("keeps each fact's pages and status, and a reviewed fact is the author's", () => {
		const read = courseFromFile(gradeFile(), "kestrel", "grade-7-science.json");
		expect(read.ok).toBe(true);
		if (!read.ok) return;
		const facts = read.course.units[0]?.lessons[0]?.facts;
		expect(facts).toEqual([
			{
				text: "Living things are sorted by features.",
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
			{
				text: "A fact with no page.",
				sources: [],
				status: "draft",
				own: false,
			},
		]);
		// A skill may be a plain string, and both shapes become the bundle's.
		expect(read.course.units[0]?.lessons[0]?.skills).toEqual([
			{ code: "7-1-1", text: "Sort living things." },
			{ code: null, text: "Name the five kingdoms." },
		]);
	});

	it("refuses a file that belongs to another curriculum", () => {
		const read = courseFromFile(
			gradeFile({ curriculum: "sunrise" }),
			"kestrel",
			"grade-7-science.json",
		);
		expect(read.ok).toBe(false);
		if (!read.ok)
			expect(read.issues[0]?.path).toBe("grade-7-science.json.curriculum");
	});

	it("reads the curriculum's names and periods, with no author yet", () => {
		const read = headerFromFile(def(), "curriculum.json");
		expect(read.ok).toBe(true);
		if (read.ok) {
			expect(read.header.nameEn).toBe("KESTREL");
			expect(read.header.author).toBe("");
			expect(read.header.rights).toBe("");
			expect(read.header.periods).toEqual(PERIODS);
		}
	});
});

describe("the project adoption makes", () => {
	it("keeps the author's own grade and subject folders, and every fact's pages", () => {
		const course = courseFromFile(gradeFile(), "kestrel", "file");
		const header = headerFromFile(def(), "curriculum.json");
		if (!course.ok || !header.ok) throw new Error("the fixture is broken");
		const plan = planAdopt({
			id: ID,
			curriculumId: "kestrel",
			header: header.header,
			courses: [course.course],
			register: rows(),
			subjectFolders: [{ folder: "Science", subject: "science" }],
		});
		expect(plan.ok).toBe(true);
		if (!plan.ok) return;
		expect(plan.plan.project.grades).toEqual([
			{
				grade: 7,
				folder: "Grade 7",
				subjects: [{ subject: "science", folder: "Science" }],
			},
		]);
		expect(plan.plan.model.curriculum.author).toBe("");
		expect(plan.plan.model.courses[0]?.units[0]?.lessons[0]?.facts[0]).toEqual({
			text: "Living things are sorted by features.",
			sources: ["9a010f4b4816#p6"],
			status: "reviewed",
			own: true,
		});
	});

	it("finds a subject under a year and a section folder, as the second curriculum has it", () => {
		const course = courseFromFile(
			gradeFile({ subject: "biology", grade: 11 }),
			"kestrel",
			"file",
		);
		const header = headerFromFile(def(), "curriculum.json");
		if (!course.ok || !header.ok) throw new Error("the fixture is broken");
		const plan = planAdopt({
			id: ID,
			curriculumId: "kestrel",
			header: header.header,
			courses: [course.course],
			register: [
				rowOf({
					id: "9a010f4b4816",
					path: "Grade 11/2026-2027/Ministry/Biology/book.pdf",
					grade: 11,
					subject: "biology",
					block: "",
					kind: "book",
					pages: 200,
					authority: 1,
				}),
			],
			subjectFolders: [{ folder: "Biology", subject: "biology" }],
		});
		expect(plan.ok).toBe(true);
		if (plan.ok)
			expect(plan.plan.project.grades[0]).toEqual({
				grade: 11,
				folder: "Grade 11",
				subjects: [{ subject: "biology", folder: "Biology" }],
			});
	});

	it("refuses a curriculum with no courses", () => {
		const header = headerFromFile(def(), "curriculum.json");
		if (!header.ok) throw new Error("the fixture is broken");
		const plan = planAdopt({
			id: ID,
			curriculumId: "kestrel",
			header: header.header,
			courses: [],
			register: [],
			subjectFolders: [],
		});
		expect(plan.ok).toBe(false);
	});

	it("keeps a usable folder when the author's own name can't be written", () => {
		const course = courseFromFile(gradeFile(), "kestrel", "file");
		const header = headerFromFile(def(), "curriculum.json");
		if (!course.ok || !header.ok) throw new Error("the fixture is broken");
		const plan = planAdopt({
			id: ID,
			curriculumId: "kestrel",
			header: header.header,
			courses: [course.course],
			register: [
				rowOf({
					id: "9a010f4b4816",
					path: "Grade 7/Science: A/B.pdf",
					grade: 7,
					subject: "science",
					block: "",
					kind: "sheet",
					pages: 1,
					authority: 1,
				}),
			],
			subjectFolders: [],
		});
		// The project falls back to the subject's own name rather than refusing the whole adoption.
		expect(plan.ok).toBe(true);
		if (plan.ok)
			expect(plan.plan.project.grades[0]?.subjects[0]?.folder).toBe("science");
	});
});
