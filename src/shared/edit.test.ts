// Hand edits (task 247): every edit, its limits, renumbering, a fact becoming the teacher's,
// moving a lesson across units, and the clamp on what a page sends.

import { describe, expect, it } from "vitest";
import { applyEdit, cleanEdit, type Edit } from "./edit.ts";
import { BUNDLE_LIMITS } from "./format/bundle.ts";
import type { ModelCourse, ModelLesson } from "./model.ts";

let counter = 0;
const newId = () => `id-${++counter}`;
const PERIODS = ["t1", "t2"];

function lesson(number: number, facts: string[]): ModelLesson {
	return {
		id: `l${number}`,
		number,
		title: `Lesson ${number}`,
		skills: [{ id: `s${number}`, code: null, text: "a skill" }],
		facts: facts.map((text) => ({
			text,
			sources: ["aaaaaaaaaaaa#p1"],
			status: "draft",
			own: false,
		})),
		activity: null,
	};
}

function course(): ModelCourse {
	return {
		grade: 7,
		subject: "science",
		language: "en",
		support: [],
		units: [
			{
				id: "u1",
				number: 1,
				period: "t1",
				title: "Cells",
				source: "sheet",
				keywords: [],
				evidence: [],
				lessons: [lesson(1, ["A", "B", "C"]), lesson(2, ["D"])],
			},
			{
				id: "u2",
				number: 2,
				period: "t2",
				title: "Energy",
				source: "sheet",
				keywords: [],
				evidence: [],
				lessons: [lesson(1, ["E"])],
			},
		],
		examStyle: null,
		exams: [],
	};
}

/** The course after one edit, or a thrown reason. */
function edited(edit: Edit, given: ModelCourse = course()): ModelCourse {
	const got = applyEdit(given, edit, PERIODS, newId);
	if (!got.ok) throw new Error(got.issue);
	return got.course;
}

const facts = (c: ModelCourse, unit = 0, lessonAt = 0) =>
	c.units[unit]?.lessons[lessonAt]?.facts.map((fact) => fact.text);

describe("editing facts", () => {
	it("makes an edited or added fact the teacher's, reviewed, keeping its sources", () => {
		const after = edited({
			kind: "fact.text",
			unit: 1,
			lesson: 1,
			fact: 1,
			text: "B fixed",
		});
		expect(after.units[0]?.lessons[0]?.facts[1]).toEqual({
			text: "B fixed",
			sources: ["aaaaaaaaaaaa#p1"],
			status: "reviewed",
			own: true,
		});
		const added = edited({
			kind: "fact.add",
			unit: 1,
			lesson: 1,
			after: 0,
			text: "New",
		});
		expect(facts(added)).toEqual(["A", "New", "B", "C"]);
		expect(added.units[0]?.lessons[0]?.facts[1]).toMatchObject({
			sources: [],
			own: true,
			status: "reviewed",
		});
	});

	it("deletes and moves facts, and keeps the limits", () => {
		expect(
			facts(edited({ kind: "fact.delete", unit: 1, lesson: 1, fact: 0 })),
		).toEqual(["B", "C"]);
		expect(
			facts(edited({ kind: "fact.move", unit: 1, lesson: 1, fact: 2, by: -1 })),
		).toEqual(["A", "C", "B"]);
		expect(
			applyEdit(
				course(),
				{ kind: "fact.move", unit: 1, lesson: 1, fact: 0, by: -1 },
				PERIODS,
				newId,
			).ok,
		).toBe(false);
		const full = course();
		const first = full.units[0]?.lessons[0];
		if (first === undefined) throw new Error("no lesson");
		first.facts = Array.from({ length: BUNDLE_LIMITS.facts }, (_, i) => ({
			text: `F${i}`,
			sources: [],
			status: "draft" as const,
			own: false,
		}));
		expect(
			applyEdit(
				full,
				{ kind: "fact.add", unit: 1, lesson: 1, after: 0, text: "one more" },
				PERIODS,
				newId,
			).ok,
		).toBe(false);
		expect(
			applyEdit(
				course(),
				{
					kind: "fact.text",
					unit: 1,
					lesson: 1,
					fact: 0,
					text: "x".repeat(BUNDLE_LIMITS.factChars + 1),
				},
				PERIODS,
				newId,
			).ok,
		).toBe(false);
	});

	it("edits, adds and deletes skills", () => {
		expect(
			edited({
				kind: "skill.text",
				unit: 1,
				lesson: 1,
				skill: 0,
				text: "name the parts",
			}).units[0]?.lessons[0]?.skills[0]?.text,
		).toBe("name the parts");
		expect(
			edited({ kind: "skill.add", unit: 1, lesson: 1, text: "another" })
				.units[0]?.lessons[0]?.skills,
		).toHaveLength(2);
		expect(
			edited({ kind: "skill.delete", unit: 1, lesson: 1, skill: 0 }).units[0]
				?.lessons[0]?.skills,
		).toEqual([]);
	});
});

describe("editing lessons and units", () => {
	it("renames, adds, deletes and moves lessons, renumbering them", () => {
		expect(
			edited({ kind: "lesson.title", unit: 1, lesson: 2, title: "Tissues" })
				.units[0]?.lessons[1]?.title,
		).toBe("Tissues");
		const added = edited({
			kind: "lesson.add",
			unit: 1,
			after: 1,
			title: "Between",
		});
		expect(
			added.units[0]?.lessons.map((entry) => [entry.number, entry.title]),
		).toEqual([
			[1, "Lesson 1"],
			[2, "Between"],
			[3, "Lesson 2"],
		]);
		const deleted = edited({ kind: "lesson.delete", unit: 1, lesson: 1 });
		expect(
			deleted.units[0]?.lessons.map((entry) => [entry.number, entry.title]),
		).toEqual([[1, "Lesson 2"]]);
		const moved = edited({ kind: "lesson.move", unit: 1, lesson: 2, by: -1 });
		expect(moved.units[0]?.lessons.map((entry) => entry.id)).toEqual([
			"l2",
			"l1",
		]);
		expect(moved.units[0]?.lessons.map((entry) => entry.number)).toEqual([
			1, 2,
		]);
	});

	it("moves a lesson to another unit, renumbering both", () => {
		const moved = edited({ kind: "lesson.toUnit", unit: 1, lesson: 1, to: 2 });
		expect(
			moved.units[0]?.lessons.map((entry) => [entry.number, entry.id]),
		).toEqual([[1, "l2"]]);
		expect(
			moved.units[1]?.lessons.map((entry) => [entry.number, entry.id]),
		).toEqual([
			[1, "l1"],
			[2, "l1"],
		]);
	});

	it("renames, adds, deletes, moves units and changes a unit's period", () => {
		expect(
			edited({ kind: "unit.title", unit: 2, title: "Power" }).units[1]?.title,
		).toBe("Power");
		const added = edited({ kind: "unit.add", period: "t1", title: "Plants" });
		expect(
			added.units.map((unit) => [unit.number, unit.title, unit.period]),
		).toEqual([
			[1, "Cells", "t1"],
			[2, "Plants", "t1"],
			[3, "Energy", "t2"],
		]);
		expect(
			applyEdit(
				course(),
				{ kind: "unit.add", period: "nowhere", title: "x" },
				PERIODS,
				newId,
			).ok,
		).toBe(false);
		expect(
			edited({ kind: "unit.delete", unit: 1 }).units.map((unit) => [
				unit.number,
				unit.id,
			]),
		).toEqual([[1, "u2"]]);
		expect(
			edited({ kind: "unit.move", unit: 2, by: -1 }).units.map((unit) => [
				unit.number,
				unit.id,
			]),
		).toEqual([
			[1, "u2"],
			[2, "u1"],
		]);
		expect(
			edited({ kind: "unit.period", unit: 1, period: "t2" }).units[0]?.period,
		).toBe("t2");
	});

	it("never changes the course it was given", () => {
		const given = course();
		edited({ kind: "unit.delete", unit: 1 }, given);
		expect(given.units).toHaveLength(2);
	});
});

describe("what a page sends", () => {
	it("is clamped, and anything that is not an edit is refused", () => {
		expect(cleanEdit({ kind: "drop.tables" })).toBeNull();
		expect(cleanEdit("fact.text")).toBeNull();
		const got = cleanEdit({
			kind: "fact.move",
			unit: 1e9,
			lesson: -5,
			fact: 2,
			by: 7,
			text: 5,
		});
		expect(got).toMatchObject({
			kind: "fact.move",
			unit: 0,
			lesson: 0,
			fact: 2,
			by: 1,
		});
	});
});

describe("typing a curriculum by hand (task 251)", () => {
	it("adds several facts and skills in one edit, one per line, in order", () => {
		const added = edited({
			kind: "fact.add",
			unit: 1,
			lesson: 2,
			after: 0,
			text: "First\n\n  Second  \nThird\n",
		});
		expect(facts(added, 0, 1)).toEqual(["D", "First", "Second", "Third"]);
		expect(
			added.units[0]?.lessons[1]?.facts.every(
				(fact) => fact.text === "D" || fact.own,
			),
		).toBe(true);
		const skills = edited({
			kind: "skill.add",
			unit: 1,
			lesson: 1,
			text: "one\ntwo",
		});
		expect(
			skills.units[0]?.lessons[0]?.skills.map((skill) => skill.text),
		).toEqual(["a skill", "one", "two"]);
	});

	it("refuses the whole paste when it passes a limit or a line is too long", () => {
		const many = Array.from(
			{ length: BUNDLE_LIMITS.facts },
			(_, i) => `F${i}`,
		).join("\n");
		expect(
			applyEdit(
				course(),
				{ kind: "fact.add", unit: 1, lesson: 1, after: 2, text: many },
				PERIODS,
				newId,
			).ok,
		).toBe(false);
		expect(
			applyEdit(
				course(),
				{
					kind: "fact.add",
					unit: 1,
					lesson: 1,
					after: 2,
					text: `fine\n${"x".repeat(BUNDLE_LIMITS.factChars + 1)}`,
				},
				PERIODS,
				newId,
			).ok,
		).toBe(false);
		// A paste of many facts passes the clamp whole.
		const clamped = cleanEdit({
			kind: "fact.add",
			unit: 1,
			lesson: 1,
			after: 0,
			text: "a\n".repeat(20),
		});
		expect(clamped).toMatchObject({ text: "a\n".repeat(20) });
	});

	it("edits a unit's key words and evidence, one per line, and a lesson's activity", () => {
		const words = edited({
			kind: "unit.keywords",
			unit: 1,
			text: "cell\nnucleus\n",
		});
		expect(words.units[0]?.keywords).toEqual(["cell", "nucleus"]);
		const evidence = edited({
			kind: "unit.evidence",
			unit: 2,
			text: "label a diagram, 4 marks",
		});
		expect(evidence.units[1]?.evidence).toEqual(["label a diagram, 4 marks"]);
		const tooMany = Array.from(
			{ length: BUNDLE_LIMITS.listItems + 1 },
			(_, i) => `w${i}`,
		).join("\n");
		expect(
			applyEdit(
				course(),
				{ kind: "unit.keywords", unit: 1, text: tooMany },
				PERIODS,
				newId,
			).ok,
		).toBe(false);
		const reading = edited({
			kind: "lesson.activity",
			unit: 1,
			lesson: 1,
			activity: "reading",
		});
		expect(reading.units[0]?.lessons[0]?.activity).toBe("reading");
		expect(
			cleanEdit({
				kind: "lesson.activity",
				unit: 1,
				lesson: 1,
				activity: "dancing",
			}),
		).toMatchObject({
			activity: null,
		});
	});
});
