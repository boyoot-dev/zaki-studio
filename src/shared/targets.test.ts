// One course and one period, and the words a change set is asked in (task 158). The priority
// order is sources.py's: authority, then the newer year and date, then the main sheet over a
// worksheet. All the material here is made up.

import { describe, expect, it } from "vitest";

import type { FileRow, ModelCourse } from "./model.ts";
import {
	acceptKey,
	blockOf,
	changeEstimate,
	changeInput,
	changeName,
	courseNow,
	inBlock,
	lessonCount,
	notedRows,
	notesOrder,
	parseAcceptKey,
	periodUnits,
	targetOf,
	targetRows,
} from "./targets.ts";

/** A register row of made-up material. */
function row(id: string, over: Partial<FileRow> = {}): FileRow {
	return {
		id,
		path: `Grade 7/Science/${id}.pdf`,
		grade: 7,
		subject: "science",
		language: "en",
		block: "2",
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
		firstSeen: "2026-11-01",
		size: 100,
		mtime: "1",
		metaDate: "",
		fixed: [],
		...over,
	};
}

/** A course with two units, one in each block. */
function course(): ModelCourse {
	return {
		grade: 7,
		subject: "science",
		language: "en",
		support: [],
		examStyle: null,
		exams: [],
		units: [
			{
				id: "u3",
				number: 5,
				period: "block-3",
				title: "Breathing",
				source: "provisional",
				keywords: [],
				evidence: [],
				lessons: [
					{
						id: "l5",
						number: 1,
						title: "The lungs",
						skills: [{ id: "s1", code: null, text: "name the parts" }],
						facts: [],
						activity: null,
					},
					{
						id: "l6",
						number: 2,
						title: "The blood",
						skills: [{ id: "s2", code: null, text: "describe the heart" }],
						facts: [],
						activity: null,
					},
				],
			},
			{
				id: "u4",
				number: 4,
				period: "block-2",
				title: "Cells",
				source: "sheet",
				keywords: ["cell"],
				evidence: [],
				lessons: [],
			},
		],
	};
}

describe("the block a period names", () => {
	it("reads block-3, and leaves any other period unnamed", () => {
		expect(blockOf("block-3")).toBe("3");
		expect(blockOf("block-12")).toBe("12");
		expect(blockOf("term-1")).toBeNull();
	});

	it("takes the files whose register block names it, including a shared block", () => {
		expect(inBlock({ block: "3" }, "block-3", [])).toBe(true);
		expect(inBlock({ block: "2" }, "block-3", [])).toBe(false);
		expect(inBlock({ block: "2&3" }, "block-3", [])).toBe(true);
		expect(inBlock({ block: "2 & 3" }, "block-3", [])).toBe(true);
		// A period that is not a block takes the whole course.
		expect(inBlock({ block: "2" }, "term-1", [])).toBe(true);
	});
});

describe("the notes a period's change set is written from", () => {
	it("orders them by authority, then the newer year and date, then the kind", () => {
		const thirdParty = row("aaaaaaaaaaaa", { authority: 4 });
		const school = row("bbbbbbbbbbbb", { authority: 2 });
		const official = row("cccccccccccc", { authority: 1, kind: "book" });
		expect(notesOrder([thirdParty, school, official])).toEqual([
			official,
			school,
			thirdParty,
		]);
		const older = row("dddddddddddd", {
			authority: 2,
			academicYear: "2024-25",
		});
		const newer = row("eeeeeeeeeeee", {
			authority: 2,
			academicYear: "2025-26",
		});
		expect(notesOrder([older, newer])).toEqual([newer, older]);
		const oldSheet = row("ffffffffffff", {
			authority: 2,
			published: "2024-01-01",
		});
		const newSheet = row("111111111111", {
			authority: 2,
			published: "2026-10-11",
		});
		expect(notesOrder([oldSheet, newSheet])).toEqual([newSheet, oldSheet]);
		const worksheet = row("222222222222", { authority: 2, kind: "worksheet" });
		const sheet = row("333333333333", { authority: 2, kind: "sheet" });
		expect(notesOrder([worksheet, sheet])).toEqual([sheet, worksheet]);
	});

	it("keeps only readable files of that course, period and grade", () => {
		const rows = [
			row("aaaaaaaaaaaa"),
			row("bbbbbbbbbbbb", { block: "1" }),
			row("cccccccccccc", { subject: "math" }),
			row("dddddddddddd", { grade: 8 }),
			row("eeeeeeeeeeee", { dupOf: "aaaaaaaaaaaa" }),
			row("ffffffffffff", { error: "unreadable" }),
			row("111111111111", { pages: 0 }),
		];
		const got = targetRows(
			rows,
			{
				grade: 7,
				subject: "science",
				language: "en",
				period: "block-2",
			},
			[],
		);
		expect(got.map((entry) => entry.id)).toEqual(["aaaaaaaaaaaa"]);
		expect(
			notedRows(got, new Set(["aaaaaaaaaaaa"])).map((entry) => entry.id),
		).toEqual(["aaaaaaaaaaaa"]);
		expect(notedRows(got, new Set(["bbbbbbbbbbbb"]))).toEqual([]);
	});
});

describe("a target's name and the course as it is now", () => {
	it("names a change set by grade, subject and period, and refuses anything else", () => {
		expect(
			changeName({
				grade: 7,
				subject: "science",
				language: "en",
				period: "block-3",
			}),
		).toBe("7-science-en-block-3");
		for (const target of [
			{ grade: 7, subject: "../etc", language: "en", period: "block-3" },
			{ grade: 7, subject: "science", language: "en", period: "block-3/../x" },
			{ grade: 99, subject: "science", language: "en", period: "block-3" },
		])
			expect(changeName(target)).toBeNull();
		expect(targetOf(7, "science", "en", "block-3")).toEqual({
			grade: 7,
			subject: "science",
			language: "en",
			period: "block-3",
		});
		expect(targetOf("7", "science", "en", "block-3")).toBeNull();
	});

	it("takes one period's units, in number order, with the rest of the course left out", () => {
		const model = course();
		expect(periodUnits(model, "block-3").map((unit) => unit.number)).toEqual([
			5,
		]);
		expect(courseNow(model, "block-3").units).toHaveLength(1);
		expect(lessonCount(model, "block-3")).toBe(2);
	});
});

describe("the input a change set is asked for", () => {
	const input = changeInput({
		curriculum: "kestrel",
		course: course(),
		period: "block-3",
		notes: [
			{
				id: "9a010f4b4816",
				text: "# 9a010f4b4816 — sheet\n\n## Page 6\n\nWords.",
			},
		],
	});

	it("names the course and period in the first user line", () => {
		expect(input.first).toBe(
			"This is the kestrel curriculum, Grade 7, science, period block-3. Write its change set.",
		);
	});

	it("carries the JSON shape, the course now and the notes in its own text", () => {
		expect(input.text).toContain('"units"');
		expect(input.text).toContain('"sources"');
		expect(input.text).toContain("Breathing");
		expect(input.text).not.toContain("Cells");
		expect(input.text).toContain("## 9a010f4b4816");
		expect(input.text).toContain("Words.");
	});

	it("says so when a period has no note", () => {
		const empty = changeInput({
			curriculum: "kestrel",
			course: course(),
			period: "block-3",
			notes: [],
		});
		expect(empty.text).toContain("No note is available for this period.");
	});

	it("estimates more output for more units and lessons", () => {
		const small = changeEstimate("rules", input, 1, 1);
		const large = changeEstimate("rules", input, 3, 12);
		expect(small.in).toBeGreaterThan(0);
		expect(large.out).toBeGreaterThan(small.out);
	});
});

describe("accepting a part of a change set", () => {
	it("records a choice as a key and reads it back", () => {
		expect(acceptKey({ kind: "all" })).toBe("all");
		expect(acceptKey({ kind: "unit", unit: 5 })).toBe("5");
		expect(acceptKey({ kind: "lesson", unit: 5, lesson: 2 })).toBe("5.2");
		expect(parseAcceptKey("5")).toEqual({ kind: "unit", unit: 5 });
		expect(parseAcceptKey("5.2")).toEqual({
			kind: "lesson",
			unit: 5,
			lesson: 2,
		});
		expect(parseAcceptKey("all")).toEqual({ kind: "all" });
		expect(parseAcceptKey("../5")).toBeNull();
	});
});
