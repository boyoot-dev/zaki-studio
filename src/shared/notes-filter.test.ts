// Narrowing the Notes list (task 178): a grade, a subject, the blocks, years and types shown, and
// whether only the files without a note are shown. Several blocks, years or types may be chosen
// at once (task 181, 182): the boxes of one row are ORed and the rows are ANDed. The rows here
// are made up; the filter only hides, so the author's selection is not something it ever sees.

import { describe, expect, it } from "vitest";

import {
	ALL_NOTES,
	filterRows,
	type NotesFilter,
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
		kind: "exam",
		academicYear: "2026-27",
		noted: false,
		...over,
	};
}

const ROWS = [
	row("a"),
	row("b", { block: "2", kind: "revision" }),
	row("c", { subject: "math" }),
	row("d", { grade: 8, kind: "worksheet" }),
	row("e", { block: "" }),
	row("f", { noted: true }),
	row("g", { academicYear: "2024-25", kind: "mark-scheme" }),
	row("h", { academicYear: "" }),
	row("i", { block: "", academicYear: "", kind: "book" }),
];

/** The ids a filter keeps, as the tests compare them. */
function kept(filter: NotesFilter): string[] {
	return filterRows(ROWS, filter).map((row) => row.id);
}

describe("the rows a filter keeps", () => {
	it("narrows by grade, by subject and by block", () => {
		expect(kept({ ...ALL_NOTES, grade: 8 })).toEqual(["d"]);
		expect(kept({ ...ALL_NOTES, subject: "math" })).toEqual(["c"]);
		expect(kept({ ...ALL_NOTES, blocks: ["2"] })).toEqual(["b"]);
		// The three narrow together.
		expect(
			kept({ ...ALL_NOTES, grade: 7, subject: "science", blocks: ["1"] }),
		).toEqual(["a", "g", "h"]);
	});

	it("keeps either of two blocks when both are ticked", () => {
		expect(kept({ ...ALL_NOTES, blocks: ["1", "2"] })).toEqual([
			"a",
			"b",
			"c",
			"d",
			"g",
			"h",
		]);
	});

	it("shows only the rows with no block when that box is ticked", () => {
		expect(kept({ ...ALL_NOTES, blocks: [""] })).toEqual(["e", "i"]);
		// "no block" is one choice among several, not an exclusive one.
		expect(kept({ ...ALL_NOTES, blocks: ["", "2"] })).toEqual(["b", "e", "i"]);
	});

	it("narrows by year, newest or several at once", () => {
		expect(kept({ ...ALL_NOTES, years: ["2024-25"] })).toEqual(["g"]);
		expect(kept({ ...ALL_NOTES, years: ["2026-27", "2024-25"] })).toEqual([
			"a",
			"b",
			"c",
			"d",
			"e",
			"g",
		]);
		expect(kept({ ...ALL_NOTES, years: [""] })).toEqual(["h", "i"]);
	});

	it("narrows by type, one type or two at once", () => {
		expect(kept({ ...ALL_NOTES, kinds: ["worksheet"] })).toEqual(["d"]);
		// The two boxes are ORed: an exam paper or a mark scheme, and nothing else.
		expect(kept({ ...ALL_NOTES, kinds: ["exam", "mark-scheme"] })).toEqual([
			"a",
			"c",
			"e",
			"g",
			"h",
		]);
		// No box ticked is every type.
		expect(kept({ ...ALL_NOTES, kinds: [] })).toEqual([
			"a",
			"b",
			"c",
			"d",
			"e",
			"g",
			"h",
			"i",
		]);
	});

	it("narrows by type and year together, one row each", () => {
		// An exam of 2026-27: the 2024-25 mark scheme and the file with no year stay out.
		expect(kept({ ...ALL_NOTES, kinds: ["exam"], years: ["2026-27"] })).toEqual(
			["a", "c", "e"],
		);
		// The same with a block and a subject: every row narrows together.
		expect(
			kept({
				...ALL_NOTES,
				grade: 7,
				subject: "science",
				kinds: ["exam", "mark-scheme"],
				years: ["2024-25"],
			}),
		).toEqual(["g"]);
	});

	it("narrows by blocks and years together, one row each", () => {
		// Blocks 1 and 2, of 2024-25 and 2025-26: the file must be in either block AND either
		// year, so the 2026-27 files of those blocks stay out.
		expect(
			kept({
				...ALL_NOTES,
				blocks: ["1", "2"],
				years: ["2024-25", "2025-26"],
			}),
		).toEqual(["g"]);
		// The same with "no block" and "no year": each is a value like any other.
		expect(kept({ ...ALL_NOTES, blocks: [""], years: [""] })).toEqual(["i"]);
	});

	it("shows only the files without a note when the box is on", () => {
		expect(kept(ALL_NOTES)).toEqual(["a", "b", "c", "d", "e", "g", "h", "i"]);
		expect(kept({ ...ALL_NOTES, onlyMissing: false })).toEqual([
			"a",
			"b",
			"c",
			"d",
			"e",
			"f",
			"g",
			"h",
			"i",
		]);
	});

	it("never touches the author's selection", () => {
		const chosen = new Set(["f"]);
		const left = filterRows(ROWS, { ...ALL_NOTES, grade: 8 });
		// "f" is hidden, and still chosen: the filter only ever hides rows.
		expect(left.map((row) => row.id)).toEqual(["d"]);
		expect([...chosen]).toEqual(["f"]);
	});
});

describe("the values the filter offers", () => {
	it("are read from the rows that are there", () => {
		expect(notesFacets(ROWS)).toEqual({
			grades: [7, 8],
			subjects: ["math", "science"],
			blocks: ["1", "2"],
			anyNoBlock: true,
			years: ["2026-27", "2024-25"],
			anyNoYear: true,
			kinds: ["book", "exam", "mark-scheme", "revision", "worksheet"],
		});
	});

	it("offer only the types the chosen grade and subject have", () => {
		expect(notesFacets(ROWS, { grade: 8, subject: "science" }).kinds).toEqual([
			"worksheet",
		]);
		expect(notesFacets(ROWS, { grade: 7, subject: "math" }).kinds).toEqual([
			"exam",
		]);
		// Every grade and subject still offers every type.
		expect(notesFacets(ROWS, { grade: null, subject: null }).kinds).toEqual([
			"book",
			"exam",
			"mark-scheme",
			"revision",
			"worksheet",
		]);
	});

	it("offer no block or no year only when a row has none", () => {
		const facets = notesFacets([row("a")]);
		expect(facets.anyNoBlock).toBe(false);
		expect(facets.anyNoYear).toBe(false);
		expect(facets.years).toEqual(["2026-27"]);
	});
});

describe("a filter as the page sent it", () => {
	it("clamps a value the register could not hold, and keeps a real one", () => {
		expect(
			notesFilterOf({
				grade: 8,
				subject: "math",
				blocks: ["1", "", "2"],
				years: ["2024-25"],
				kinds: ["exam", "mark-scheme"],
				onlyMissing: false,
			}),
		).toEqual({
			grade: 8,
			subject: "math",
			blocks: ["1", "", "2"],
			years: ["2024-25"],
			kinds: ["exam", "mark-scheme"],
			onlyMissing: false,
		});
		expect(
			notesFilterOf({
				grade: 15,
				subject: "",
				blocks: 7,
				years: {},
				kinds: 7,
				onlyMissing: "no",
			}),
		).toEqual(ALL_NOTES);
		expect(notesFilterOf(null)).toEqual(ALL_NOTES);
	});

	it("keeps only strings, once each, from a list a row may send", () => {
		expect(
			notesFilterOf({
				blocks: ["1", "1", 7, "", "a block name that is far too long"],
				years: ["2026-27", "2026-27"],
				kinds: ["exam", "exam", 7],
			}),
		).toMatchObject({
			blocks: ["1", ""],
			years: ["2026-27"],
			kinds: ["exam"],
		});
	});
});
