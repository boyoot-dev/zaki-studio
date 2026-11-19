// Building in the browser in rounds (task 245): the outline's format and parser, the rounds an
// outline asks for, the pasted answer's JSON, and the merge into one change set.

import { describe, expect, it } from "vitest";
import {
	answerJson,
	mergeAnswers,
	pagesOf,
	parseOutline,
	UPLOAD_MAX,
	unitRounds,
} from "./rounds.ts";

const FILE = "aaaaaaaaaaaa";
const files = new Map([[FILE, 120]]);

/** An outline answer with two units. */
function outline(): Record<string, unknown> {
	return {
		units: [
			{
				number: 1,
				title: "حالات المادة",
				lessons: [{ number: 1, title: "الصلب" }],
				pages: [{ file: FILE, from: 5, to: 30 }],
			},
			{
				number: 2,
				title: "الذرة",
				lessons: [{ number: 1, title: "تركيب الذرة" }],
				pages: [{ file: FILE, from: 31, to: 60 }],
			},
		],
	};
}

describe("the outline", () => {
	it("reads units, lessons and each unit's pages", () => {
		const got = parseOutline(outline(), files);
		if (!got.ok) throw new Error(got.issue);
		expect(got.outline.units.map((unit) => unit.title)).toEqual([
			"حالات المادة",
			"الذرة",
		]);
		expect(got.outline.units[1]?.pages).toEqual([
			{ file: FILE, from: 31, to: 60 },
		]);
	});

	it("says in plain words what is wrong", () => {
		expect(parseOutline({}, files)).toEqual({
			ok: false,
			issue: 'The answer has no "units" list.',
		});
		const badFile = outline();
		(badFile.units as Record<string, unknown>[])[0] = {
			number: 1,
			title: "x",
			lessons: [{ number: 1, title: "y" }],
			pages: [{ file: "bbbbbbbbbbbb", from: 1, to: 2 }],
		};
		const got = parseOutline(badFile, files);
		expect(got.ok).toBe(false);
		if (!got.ok) expect(got.issue).toContain("not one of the uploaded files");
		const pastEnd = outline();
		(pastEnd.units as Record<string, unknown>[])[1] = {
			number: 2,
			title: "x",
			lessons: [{ number: 1, title: "y" }],
			pages: [{ file: FILE, from: 100, to: 200 }],
		};
		expect(parseOutline(pastEnd, files).ok).toBe(false);
	});

	it("finds the JSON in a pasted answer, fenced or not", () => {
		expect(answerJson('Here it is:\n```json\n{"a": 1}\n```\nDone.')).toEqual({
			a: 1,
		});
		expect(answerJson('{"a": 2}')).toEqual({ a: 2 });
		expect(answerJson("no json here")).toBeNull();
	});
});

describe("the rounds", () => {
	it("gives one round per unit, and splits a unit too large for one upload", () => {
		const got = parseOutline(outline(), files);
		if (!got.ok) throw new Error(got.issue);
		const small = unitRounds(got.outline, () => 1000);
		expect(small.map((round) => [round.unit, round.part, round.parts])).toEqual(
			[
				[1, 1, 1],
				[2, 1, 1],
			],
		);
		const large = unitRounds(got.outline, (range) =>
			range.from === 31 ? UPLOAD_MAX + 1 : 1000,
		);
		expect(large.map((round) => [round.unit, round.part, round.pages])).toEqual(
			[
				[1, 1, [{ file: FILE, from: 5, to: 30 }]],
				[2, 1, [{ file: FILE, from: 31, to: 45 }]],
				[2, 2, [{ file: FILE, from: 46, to: 60 }]],
			],
		);
	});

	it("takes a file's pages from its text", () => {
		const text =
			"# x\n\n## Page 1\n\none\n\n## Page 2\n\ntwo\n\n## Page 3\n\nthree\n";
		expect(pagesOf(text, 2, 3)).toBe("## Page 2\n\ntwo\n\n## Page 3\n\nthree");
	});
});

describe("the merge", () => {
	it("joins the units' answers into one change set, a split unit's lessons renumbered", () => {
		const head = {
			grade: 11,
			subject: "chemistry",
			language: "ar",
			period: "year",
		};
		const unit = (number: number, lesson: string) => ({
			units: [
				{
					number,
					title: `Unit ${number}`,
					keywords: [lesson],
					evidence: [],
					lessons: [{ number: 1, title: lesson, facts: [] }],
				},
			],
			open: [{ text: `about ${lesson}`, decide: false, sources: [] }],
		});
		const merged = mergeAnswers(head, [
			{ unit: 1, value: unit(1, "a") },
			{ unit: 2, value: unit(2, "b") },
			{ unit: 2, value: unit(2, "c") },
		]);
		expect(merged).toMatchObject(head);
		const units = merged.units as {
			number: number;
			keywords: string[];
			lessons: { number: number; title: string }[];
		}[];
		expect(units.map((entry) => entry.number)).toEqual([1, 2]);
		expect(units[1]?.lessons).toEqual([
			{ number: 1, title: "b", facts: [] },
			{ number: 2, title: "c", facts: [] },
		]);
		expect(units[1]?.keywords).toEqual(["b", "c"]);
		expect(merged.open).toHaveLength(3);
	});
});
