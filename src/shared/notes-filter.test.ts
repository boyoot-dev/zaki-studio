// Narrowing the Notes list (task 178): a grade, a subject, a block or no block, and whether
// only the files without a note are shown. The rows here are made up; the filter only hides,
// so the author's selection is not something it ever sees.

import { describe, expect, it } from "vitest";

import {
	ALL_NOTES,
	filterRows,
	type NotesFilterRow,
	notesFacets,
	notesFilterOf,
} from "./notes-filter.ts";

/** One made-up row: where the register puts it, and whether it has a note. */
function row(
	id: string,
	over: Partial<NotesFilterRow> = {},
): NotesFilterRow & { id: string } {
	return {
		id,
		grade: 7,
		subject: "science",
		block: "1",
		noted: false,
		...over,
	};
}

const ROWS = [
	row("a"),
	row("b", { block: "2" }),
	row("c", { subject: "math" }),
	row("d", { grade: 8 }),
	row("e", { block: "" }),
	row("f", { noted: true }),
];

describe("the rows a filter keeps", () => {
	it("narrows by grade, by subject and by block", () => {
		expect(
			filterRows(ROWS, { ...ALL_NOTES, grade: 8 }).map((row) => row.id),
		).toEqual(["d"]);
		expect(
			filterRows(ROWS, { ...ALL_NOTES, subject: "math" }).map((row) => row.id),
		).toEqual(["c"]);
		expect(
			filterRows(ROWS, { ...ALL_NOTES, block: "2" }).map((row) => row.id),
		).toEqual(["b"]);
		// The three narrow together.
		expect(
			filterRows(ROWS, {
				...ALL_NOTES,
				grade: 7,
				subject: "science",
				block: "1",
			}).map((row) => row.id),
		).toEqual(["a"]);
	});

	it("shows only the rows with no block when that choice is made", () => {
		expect(
			filterRows(ROWS, { ...ALL_NOTES, block: "" }).map((row) => row.id),
		).toEqual(["e"]);
	});

	it("shows only the files without a note when the box is on", () => {
		expect(filterRows(ROWS, ALL_NOTES).map((row) => row.id)).toEqual([
			"a",
			"b",
			"c",
			"d",
			"e",
		]);
		expect(
			filterRows(ROWS, { ...ALL_NOTES, onlyMissing: false }).map(
				(row) => row.id,
			),
		).toEqual(["a", "b", "c", "d", "e", "f"]);
	});

	it("never touches the author's selection", () => {
		const chosen = new Set(["f"]);
		const kept = filterRows(ROWS, { ...ALL_NOTES, grade: 8 });
		// "f" is hidden, and still chosen: the filter only ever hides rows.
		expect(kept.map((row) => row.id)).toEqual(["d"]);
		expect([...chosen]).toEqual(["f"]);
	});
});

describe("the selects' values", () => {
	it("are read from the rows that are there", () => {
		expect(notesFacets(ROWS)).toEqual({
			grades: [7, 8],
			subjects: ["math", "science"],
			blocks: ["1", "2"],
			anyNoBlock: true,
		});
	});

	it("offer no block only when a row has none", () => {
		expect(notesFacets([row("a")]).anyNoBlock).toBe(false);
	});
});

describe("a filter as the page sent it", () => {
	it("clamps a value the register could not hold, and keeps a real one", () => {
		expect(
			notesFilterOf({
				grade: 8,
				subject: "math",
				block: "",
				onlyMissing: false,
			}),
		).toEqual({ grade: 8, subject: "math", block: "", onlyMissing: false });
		expect(
			notesFilterOf({ grade: 15, subject: "", block: 7, onlyMissing: "no" }),
		).toEqual({ grade: null, subject: null, block: null, onlyMissing: true });
		expect(notesFilterOf(null)).toEqual(ALL_NOTES);
	});
});
