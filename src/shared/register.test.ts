// The register's rules, one case for each case of tools/materials/test_register.py (task 156):
// the same questions, the same answers, so the Studio's rows say what the pipeline's index.csv
// says. Every name here is made up.

import { describe, expect, it } from "vitest";

import type { FileRow } from "./model";
import {
	academicYearOf,
	affectedUnits,
	authorityOf,
	blockOf,
	compareRows,
	currentAcademicYear,
	curriculumOk,
	dateFromName,
	fileRow,
	gradeOf,
	kindOf,
	loadRules,
	loadSubjects,
	lookReasons,
	newMaterial,
	parseCsv,
	parseIsoDate,
	parsePdfDate,
	publishedDate,
	readIndex,
	readSubjectFolders,
	registerRows,
	subjectFromFolders,
	subjectOf,
	tessLangs,
} from "./register";

/** The day the pipeline's own tests use, so a date this year is the same. */
const TODAY = new Date(2026, 9, 29);
const TODAY_ISO = "2026-10-29";

/** A register row with what every case needs, and whatever a case changes. */
function row(path: string, id: string, over: Partial<FileRow> = {}): FileRow {
	return {
		id,
		path,
		grade: 3,
		subject: "math",
		block: "1",
		kind: "sheet",
		pages: 4,
		authority: 2,
		year: "current",
		academicYear: "2026-27",
		published: "",
		publishedFrom: "",
		dupOf: "",
		imagePages: 0,
		error: "",
		firstSeen: TODAY_ISO,
		size: 100,
		mtime: "1",
		metaDate: "",
		fixed: [],
		...over,
	};
}

/** A new row, as the scan makes one, from a path and the read it gave. */
function made(
	path: string,
	over: {
		id?: string;
		dupOf?: string;
		pages?: number;
		images?: number;
		error?: string;
		metaDate?: string;
		firstSeen?: string;
		folders?: Record<string, string>;
		rules?: { pattern: RegExp; authority: number }[];
		fixed?: Record<string, number | string | null>;
	} = {},
): FileRow {
	return fileRow({
		rel: path,
		curriculum: "kestrel",
		id: over.id ?? "abcdef123456",
		dupOf: over.dupOf ?? "",
		size: 100,
		mtime: "1",
		read: {
			pages: over.pages ?? 4,
			images: over.images ?? 0,
			metaDate: over.metaDate ?? "",
			error: over.error ?? "",
		},
		firstSeen: over.firstSeen ?? "",
		folders: over.folders ?? {},
		rules: over.rules ?? [],
		today: TODAY,
		currentYear: currentAcademicYear(TODAY),
		fixed: over.fixed ?? {},
	});
}

describe("the register's names", () => {
	it("knows a curriculum folder from any other", () => {
		expect(curriculumOk("kestrel")).toBe(true);
		expect(curriculumOk("amber-harbor")).toBe(true);
		expect(curriculumOk("Grade 3")).toBe(false);
		expect(curriculumOk("_work")).toBe(false);
	});

	it("reads a grade from a folder's name", () => {
		expect(gradeOf("Grade 3")).toBe(3);
		expect(gradeOf("grade 10")).toBe(10);
		expect(gradeOf("KG")).toBe(0);
		expect(gradeOf("Year 9")).toBeNull();
		expect(gradeOf("Grade 13")).toBeNull();
	});

	it("reads the academic year, and knows which one we are in", () => {
		expect(academicYearOf(["Grade 3", "2026-2027"])).toBe("2026-27");
		expect(academicYearOf(["2025-26"])).toBe("2025-26");
		expect(academicYearOf(["2025_2026"])).toBe("2025-26");
		expect(academicYearOf(["2025-2027", "Old"])).toBe("");
		expect(currentAcademicYear(new Date(2026, 7, 31))).toBe("2025-26");
		expect(currentAcademicYear(new Date(2026, 8, 1))).toBe("2026-27");
	});

	it("reads a date written in a file's name", () => {
		expect(dateFromName("Quiz 2025-09-14.pdf")).toBe("2025-09-14");
		expect(dateFromName("Quiz 14-9-2025.pdf")).toBe("2025-09-14");
		expect(dateFromName("Quiz 14_09_2025.pdf")).toBe("2025-09-14");
		expect(dateFromName("Quiz 14.9.2025.pdf")).toBe("2025-09-14");
		expect(dateFromName("Sheet 2026-2027 B1.pdf")).toBeNull();
		expect(dateFromName("Quiz 31-02-2025.pdf")).toBeNull();
	});

	it("reads the dates files keep inside them", () => {
		expect(parsePdfDate("D:20250914103000+02'00'")).toBe("2025-09-14");
		expect(parseIsoDate("2025-09-14T10:30:00Z")).toBe("2025-09-14");
		expect(parsePdfDate("")).toBeNull();
	});

	it("takes the publish date from the name, then the metadata, then the year folder", () => {
		const p = publishedDate;
		expect(p("x 1-10-2025.pdf", "2025-09-01", "2025-26", TODAY)).toEqual({
			date: "2025-10-01",
			from: "name",
		});
		expect(p("x.pdf", "2025-09-02", "2025-26", TODAY)).toEqual({
			date: "2025-09-02",
			from: "meta",
		});
		expect(p("x.pdf", "1999-01-01", "2025-26", TODAY)).toEqual({
			date: "2025-09-01",
			from: "folder",
		});
		expect(p("x 1-1-2030.pdf", "2027-01-01", "", TODAY)).toEqual({
			date: "",
			from: "",
		});
	});

	it("reads a file's authority from the rules, and the kind otherwise", () => {
		const rules = [
			{ pattern: /ministry/i, authority: 1 },
			{ pattern: /ministry|extra/i, authority: 4 },
		];
		expect(authorityOf("sheet", "Grade 3/a.pdf", [])).toBe(2);
		expect(authorityOf("revision", "Grade 3/a.pdf", [])).toBe(3);
		expect(authorityOf("revision", "Grade 3/Ministry/a.pdf", rules)).toBe(1);
		expect(authorityOf("sheet", "Grade 3/Extra/a.pdf", rules)).toBe(4);
	});

	it("reads _sources.csv, and refuses an authority outside 1-4", () => {
		expect(loadRules("pattern,authority\nministry,1\n")[0]?.authority).toBe(1);
		expect(() => loadRules("pattern,authority\nministry,7\n")).toThrow();
		expect(loadRules("")).toEqual([]);
	});
});

describe("the subject of a file", () => {
	it("comes from the deepest folder or file name _subjects.csv names", () => {
		const folders = loadSubjects(
			"folder,subject\nProgramming and AI,programming-ai\nالبرمجة,programming-ai-ar\n",
		);
		expect(
			subjectFromFolders(
				["Grade 11", "2026-2027", "Ministry", "programming and ai"],
				folders,
			),
		).toBe("programming-ai");
		expect(subjectFromFolders(["Grade 11", "البرمجة"], folders)).toBe(
			"programming-ai-ar",
		);
		expect(subjectFromFolders(["Grade 11", "Physics"], folders)).toBe("");
		const byFile = loadSubjects(
			"folder,subject\nphysics-ar-eb-part1.pdf,physics-ar\n",
		);
		expect(
			subjectFromFolders(["Grade 11", "Physics-Ar-EB-part1.pdf"], byFile),
		).toBe("physics-ar");
		expect(loadSubjects("")).toEqual({});
	});

	it("falls back to the folder names the school uses", () => {
		expect(subjectOf(["Extra Sheets_", "Biology_", "x.pdf"])).toBe("biology");
		expect(subjectOf(["Grade 9", "لغه عربيه", "x.pdf"])).toBe("arabic");
		expect(subjectOf(["Grade 9", "Poems"])).toBe("unknown");
	});

	it("names a subject's teaching language and English for OCR", () => {
		const subjects = [
			{ id: "arabic", contentLanguage: "ar" },
			{ id: "french", contentLanguage: "fr" },
			{ id: "math", contentLanguage: "en" },
		];
		expect(tessLangs("arabic", subjects)).toBe("ara+eng");
		expect(tessLangs("french", subjects)).toBe("fra+eng");
		expect(tessLangs("math", subjects)).toBe("eng");
		expect(tessLangs("unknown", subjects)).toBe("eng");
	});
});

describe("the kind, the block and what needs a look", () => {
	it("reads the kind from the file's name, in the pipeline's order", () => {
		expect(kindOf("Math-B1-Sheet1 - Main.pdf")).toBe("sheet");
		expect(kindOf("Block 2 exam.pdf")).toBe("exam");
		expect(kindOf("Answer key.pdf")).toBe("mark-scheme");
		expect(kindOf("Revision sheet.pdf")).toBe("revision");
		expect(kindOf("Homework 3.pdf")).toBe("homework");
		expect(kindOf("Worksheet 2.pdf")).toBe("worksheet");
		expect(kindOf("Physics part 1.pdf")).toBe("book");
		expect(kindOf("Program notes.pdf")).toBe("other");
	});

	it("reads the block from the path", () => {
		expect(blockOf("Grade 3/2026-2027/Math/Block 1/sheet.pdf")).toBe("1");
		expect(blockOf("Grade 3/Block 5&6/x.pdf")).toBe("5&6");
		expect(blockOf("Grade 3/x-B2-sheet.pdf")).toBe("2");
		expect(blockOf("Grade 3/بلا/x.pdf")).toBe("");
		// A letter inside Arabic text is part of the word, as Python's \b has it: "b3الثقافه"
		// is not block 3 (found 2026-11-13 on the owner's own material).
		expect(blockOf("Grade 7/مرجعه b3الثقافه/x.pdf")).toBe("");
	});

	it("does not flag a missing block, but flags what it can't place", () => {
		expect(lookReasons(row("a.pdf", "1", { block: "" }))).toEqual([]);
		expect(lookReasons(row("a.pdf", "1", { subject: "unknown" }))).toEqual([
			{ code: "noSubject" },
		]);
		expect(lookReasons(row("a.pdf", "1", { grade: null }))).toEqual([
			{ code: "noGrade" },
		]);
		expect(lookReasons(row("a.pdf", "1", { error: "broken" }))).toEqual([
			{ code: "error", detail: "broken" },
		]);
		expect(lookReasons(row("b.pdf", "2", { dupOf: "a" }))).toEqual([
			{ code: "copy", id: "a" },
		]);
	});
});

describe("a register row", () => {
	it("is made from the path the way extract.py makes it", () => {
		const got = made("Grade 3/2026-2027/Math/Math-B1-Sheet1 - Main.pdf", {
			id: "0123456789ab",
			metaDate: "2025-09-20",
			folders: { math: "math" },
		});
		expect(got).toMatchObject({
			id: "0123456789ab",
			path: "Grade 3/2026-2027/Math/Math-B1-Sheet1 - Main.pdf",
			grade: 3,
			year: "current",
			academicYear: "2026-27",
			subject: "math",
			block: "1",
			kind: "sheet",
			pages: 4,
			authority: 2,
			published: "2025-09-20",
			publishedFrom: "meta",
			firstSeen: TODAY_ISO,
			error: "",
		});
	});

	it("names a folder it can't place, as the pipeline does", () => {
		const got = made("Poems/x.pdf");
		expect(got.grade).toBeNull();
		expect(got.error).toBe("unknown grade folder");
		// A broken file keeps both reasons.
		const broken = made("Poems/x.pdf", { error: "not a zip" });
		expect(broken.error).toBe("unknown grade folder; not a zip");
	});

	it("keeps a field the author corrected when the project is scanned again", () => {
		const corrected = made("Grade 3/2026-2027/Math/sheet.pdf", {
			fixed: {
				grade: 4,
				subject: "physics",
				block: "7",
				kind: "exam",
				authority: 1,
			},
		});
		expect(corrected).toMatchObject({
			grade: 4,
			subject: "physics",
			block: "7",
			kind: "exam",
			authority: 1,
			fixed: ["authority", "block", "grade", "kind", "subject"],
		});
	});
});

describe("what changed between two scans", () => {
	it("tells new content, copies, moves and removals apart", () => {
		const before = [
			row("a.pdf", "aaa"),
			row("b.pdf", "bbb"),
			row("c.pdf", "ccc"),
			row("d.pdf", "ddd"),
		];
		const after = [
			row("a.pdf", "aaa"), // unchanged
			row("x/b.pdf", "bbb"), // moved
			row("a copy.pdf", "aaa", { dupOf: "a.pdf" }), // copy of a known file
			row("e.pdf", "eee"), // new
			row("e2.pdf", "eee", { dupOf: "e.pdf" }), // copy of a new file
			row("d.pdf", "ddd2"), // edited in place: new content
		]; // c.pdf removed
		const got = compareRows(before, after);
		expect(got.new.map((entry) => entry.path)).toEqual(["e.pdf", "d.pdf"]);
		expect(got.moved.map((entry) => entry.path)).toEqual(["x/b.pdf"]);
		expect(got.copies.map((entry) => entry.path)).toEqual([
			"a copy.pdf",
			"e2.pdf",
		]);
		expect(got.removed.map((entry) => entry.path)).toEqual(["c.pdf"]);
	});

	it("moves a folder's copies with the folder", () => {
		const before = [
			row("G3/a.pdf", "aaa"),
			row("G3/x/a.pdf", "aaa", { dupOf: "G3/a.pdf" }),
		];
		const after = [
			row("kestrel/G3/a.pdf", "aaa"),
			row("kestrel/G3/x/a.pdf", "aaa", { dupOf: "kestrel/G3/a.pdf" }),
		];
		const got = compareRows(before, after);
		expect(got.moved).toHaveLength(2);
		expect(got.copies).toHaveLength(0);
	});
});

describe("the units new material touches", () => {
	const courses = [
		{
			grade: 3,
			subject: "math",
			units: [
				{
					number: 1,
					period: "block-1",
					title: "Numbers",
					source: "sheet" as const,
				},
				{
					number: 3,
					period: "block-3",
					title: "Shapes",
					source: "provisional" as const,
				},
			],
		},
	];

	it("reads the block's number as its period's number", () => {
		const rows = [
			row("m1.pdf", "1", { block: "1" }),
			row("m3.pdf", "2", { block: "3" }),
			row("m5.pdf", "3", { block: "5" }),
			row("s.pdf", "4", { subject: "science" }),
		];
		const got = affectedUnits(rows, courses, "2026-27");
		expect(got[0]?.lines).toEqual([
			{
				code: "unit",
				number: 1,
				title: "Numbers",
				source: "sheet",
				confirm: false,
			},
		]);
		expect(got[1]?.lines[0]).toEqual({
			code: "unit",
			number: 3,
			title: "Shapes",
			source: "provisional",
			confirm: true,
		});
		expect(got[2]?.lines).toEqual([{ code: "noUnit", block: 5 }]);
		expect(got[3]?.lines).toEqual([{ code: "noCourse" }]);
	});

	it("does not confirm a provisional unit with an older year's sheet", () => {
		const rows = [row("m3.pdf", "2", { block: "3", academicYear: "2025-26" })];
		const got = affectedUnits(rows, courses, "2026-27");
		expect(got[0]?.lines[0]).toMatchObject({ confirm: false });
	});
});

describe("the report", () => {
	it("groups the new files, and says what needs a look", () => {
		const report = newMaterial({
			at: "2026-10-29 10:00",
			since: "",
			found: 2,
			read: 2,
			changes: {
				new: [
					made("Grade 3/2026-2027/Math/m.pdf", { id: "aaaaaaaaaaaa" }),
					made("x/q.pdf", { id: "bbbbbbbbbbbb" }),
				],
				copies: [
					made("Grade 3/2026-2027/Math/m2.pdf", {
						id: "aaaaaaaaaaaa",
						dupOf: "Grade 3/2026-2027/Math/m.pdf",
					}),
				],
				moved: [made("Grade 3/moved.pdf", { id: "cccccccccccc" })],
				removed: [row("Grade 3/old.pdf", "9")],
			},
			courses: [],
			today: TODAY,
		});
		expect(report.at).toBe("2026-10-29 10:00");
		const maths = report.groups.find((group) => group.subject === "math");
		expect(maths?.rows).toHaveLength(1);
		expect(maths?.grade).toBe(3);
		expect(report.look.map((entry) => entry.why)).toEqual([
			[
				{ code: "noSubject" },
				{ code: "noGrade" },
				{ code: "error", detail: "unknown grade folder" },
			],
			[{ code: "copy", id: "Grade 3/2026-2027/Math/m.pdf" }],
		]);
		expect(report.moved).toEqual(["Grade 3/moved.pdf"]);
		expect(report.removed).toEqual(["Grade 3/old.pdf"]);
		expect(report.tessdataMissing).toEqual([]);
	});
});

describe("the work folder's own files", () => {
	it("splits CSV with commas, quotes and line breaks", () => {
		expect(parseCsv('a,b\n1,"two, words"\n3,"line\nbreak"\n')).toEqual([
			["a", "b"],
			["1", "two, words"],
			["3", "line\nbreak"],
		]);
	});

	it("reads index.csv by its header, keeping empty fields", () => {
		const parsed = readIndex(
			[
				"id,path,grade,year,subject,block,kind,pages,image_pages,curriculum,dup_of,authority,academic_year,published,published_from,first_seen,size,mtime,meta_date",
				"9a010f4b4816,kestrel/Grade 7/Science/sheet.pdf,7,current,science,1,sheet,8,2,kestrel,,1,2026-27,2025-09-20,meta,2026-10-29,120,99,2025-09-20",
				"another,kestrel/Grade 7/Math/x.pdf,,,,,,0,0,kestrel,,3,,,,,0,0,",
			].join("\n"),
		);
		expect(parsed).toHaveLength(2);
		expect(parsed[0]?.path).toBe("kestrel/Grade 7/Science/sheet.pdf");
		expect(parsed[0]?.imagePages).toBe("2");
		expect(parsed[1]?.subject).toBe("");
	});

	it("keeps the rows of one curriculum, with their paths inside its folder", () => {
		const parsed = readIndex(
			[
				"id,path,grade,subject,block,kind,pages,curriculum,dup_of,authority",
				"9a010f4b4816,kestrel/Grade 7/Science/sheet.pdf,7,science,1,sheet,8,kestrel,,1",
				"bbbbbbbbbbbb,other/Grade 9/Bio/x.pdf,9,biology,2,exam,4,other,,2",
			].join("\n"),
		);
		const rows = registerRows(parsed, "kestrel");
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			id: "9a010f4b4816",
			path: "Grade 7/Science/sheet.pdf",
			grade: 7,
			subject: "science",
			block: "1",
			kind: "sheet",
			pages: 8,
			authority: 1,
			fixed: [],
		});
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
