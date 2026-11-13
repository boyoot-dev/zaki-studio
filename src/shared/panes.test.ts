// The panes' widths (task 154): the limits, the drag, the Arabic mirror, the collapse and
// what is remembered. Held still here, so a change to a limit fails before anyone drags a
// divider in the app.

import { describe, expect, it } from "vitest";

import {
	arrowDelta,
	clampWidths,
	DIVIDER,
	defaultWidths,
	dragPanes,
	hasSource,
	MIN_MIDDLE,
	MIN_SIDE,
	type PaneWidths,
	paneColumns,
	parseSaved,
	SAVED_MAX,
	STEP,
	savedFor,
	savedKey,
	toggleSource,
	widthBucket,
	withSaved,
} from "./panes.ts";

/** The widths a row adds up to, dividers included. */
const totalOf = (columns: number[]) =>
	columns.reduce((sum, column) => sum + column, 0);

describe("the widths of a row", () => {
	it("starts with the tree wide and the two Curriculum sides in proportion", () => {
		expect(defaultWidths("files")).toEqual({
			start: 336,
			end: 0,
			collapsed: false,
		});
		expect(defaultWidths("curriculum")).toEqual({
			start: 240,
			end: 384,
			collapsed: false,
		});
	});

	it("puts the content pane between the two sides it takes what is left from", () => {
		expect(
			paneColumns(defaultWidths("curriculum"), "curriculum", 1280),
		).toEqual([240, DIVIDER, 644, DIVIDER, 384]);
		expect(paneColumns(defaultWidths("files"), "files", 1280)).toEqual([
			336,
			DIVIDER,
			938,
		]);
	});

	it("fills the window exactly, at any width", () => {
		for (const total of [960, 1280, 1500, 1920]) {
			expect(
				totalOf(paneColumns(defaultWidths("curriculum"), "curriculum", total)),
			).toBe(total);
			expect(totalOf(paneColumns(defaultWidths("files"), "files", total))).toBe(
				total,
			);
		}
	});
});

describe("the limits", () => {
	it("never lets a side pane go under 180 px", () => {
		const pulled = dragPanes(
			defaultWidths("curriculum"),
			"curriculum",
			0,
			-5000,
			1280,
		);
		expect(pulled.start).toBe(MIN_SIDE);
		const pushed = dragPanes(
			defaultWidths("curriculum"),
			"curriculum",
			1,
			5000,
			1280,
		);
		expect(pushed.end).toBe(MIN_SIDE);
	});

	it("never lets the content pane go under 320 px", () => {
		const wide = dragPanes(
			defaultWidths("curriculum"),
			"curriculum",
			0,
			5000,
			1280,
		);
		expect(paneColumns(wide, "curriculum", 1280)[2]).toBe(MIN_MIDDLE);
		const wider = dragPanes(
			defaultWidths("curriculum"),
			"curriculum",
			1,
			-5000,
			1280,
		);
		expect(paneColumns(wider, "curriculum", 1280)[2]).toBe(MIN_MIDDLE);
		const tree = dragPanes(defaultWidths("files"), "files", 0, 5000, 1280);
		expect(paneColumns(tree, "files", 1280)[2]).toBe(MIN_MIDDLE);
	});

	it("keeps the source viewer's width when the window is too small for it", () => {
		const small = clampWidths(
			{ start: 240, end: 900, collapsed: false },
			"curriculum",
			1000,
		);
		expect(small.start).toBeGreaterThanOrEqual(MIN_SIDE);
		expect(small.end).toBeGreaterThanOrEqual(MIN_SIDE);
		expect(paneColumns(small, "curriculum", 1000)[2]).toBeGreaterThanOrEqual(
			MIN_MIDDLE,
		);
	});

	it("falls back to shares when even the limits don't fit", () => {
		const narrow = paneColumns(defaultWidths("curriculum"), "curriculum", 500);
		expect(narrow).toHaveLength(5);
		expect(totalOf(narrow)).toBe(500);
		expect(narrow[0]).toBe(narrow[4]);
		expect(narrow[0]).toBeLessThan(MIN_SIDE);
	});
});

describe("dragging", () => {
	it("grows the pane before the divider and shrinks the one after it", () => {
		const moved = dragPanes(
			defaultWidths("curriculum"),
			"curriculum",
			0,
			40,
			1280,
		);
		expect(moved.start).toBe(280);
		expect(moved.end).toBe(384);
		const other = dragPanes(
			defaultWidths("curriculum"),
			"curriculum",
			1,
			40,
			1280,
		);
		expect(other.start).toBe(240);
		expect(other.end).toBe(344);
	});

	it("stops at the limits the two neighbours have", () => {
		const start = dragPanes(
			defaultWidths("curriculum"),
			"curriculum",
			0,
			5000,
			1280,
		);
		expect(start.start).toBe(1280 - 2 * DIVIDER - MIN_MIDDLE - start.end);
		const end = dragPanes(
			defaultWidths("curriculum"),
			"curriculum",
			1,
			-5000,
			1280,
		);
		expect(end.end).toBe(1280 - 2 * DIVIDER - MIN_MIDDLE - end.start);
	});

	it("moves nothing in the files view's second divider, which isn't there", () => {
		const widths = defaultWidths("files");
		expect(dragPanes(widths, "files", 1, 100, 1280)).toEqual(widths);
	});

	it("keeps whole pixels, so the grid has no seams", () => {
		const dragged = dragPanes(
			defaultWidths("curriculum"),
			"curriculum",
			0,
			7,
			1000,
		);
		for (const column of paneColumns(dragged, "curriculum", 1000))
			expect(Number.isInteger(column)).toBe(true);
	});
});

describe("the arrow keys", () => {
	it("move towards the end on ArrowRight in English", () => {
		expect(arrowDelta("ArrowRight", false)).toBe(STEP);
		expect(arrowDelta("ArrowLeft", false)).toBe(-STEP);
	});

	it("move the other way in Arabic, where the row is mirrored", () => {
		expect(arrowDelta("ArrowRight", true)).toBe(-STEP);
		expect(arrowDelta("ArrowLeft", true)).toBe(STEP);
	});

	it("move a divider by exactly one step", () => {
		const before = defaultWidths("curriculum");
		const after = dragPanes(
			before,
			"curriculum",
			0,
			arrowDelta("ArrowRight", false),
			1280,
		);
		expect(after.start).toBe(before.start + STEP);
	});
});

describe("the source viewer", () => {
	it("is a pane of the Curriculum view only", () => {
		expect(hasSource("curriculum")).toBe(true);
		expect(hasSource("files")).toBe(false);
	});

	it("goes away and comes back at the width it had", () => {
		const open = defaultWidths("curriculum");
		const away = toggleSource(open);
		expect(away.collapsed).toBe(true);
		expect(away.end).toBe(open.end);
		expect(toggleSource(away)).toEqual(open);
	});

	it("leaves the row two panes while it is away", () => {
		const columns = paneColumns(
			toggleSource(defaultWidths("curriculum")),
			"curriculum",
			1280,
		);
		expect(columns).toEqual([240, DIVIDER, 1280 - DIVIDER - 240]);
	});
});

describe("what the window remembers", () => {
	it("keeps a layout per row width, 80 px apart", () => {
		expect(widthBucket(1280)).toBe(1280);
		expect(widthBucket(1265)).toBe(1280);
		expect(widthBucket(1200)).toBe(1200);
		expect(savedKey("files", 1265)).toBe("files:1280");
	});

	it("finds the layout of one width, or the nearest one when this width is new", () => {
		const saved = withSaved(
			{},
			"curriculum",
			1280,
			defaultWidths("curriculum"),
		);
		expect(savedFor(saved, "curriculum", 1281)).toEqual(
			defaultWidths("curriculum"),
		);
		// A window that opens smaller than the one the author last dragged in comes back
		// with those widths, fitted to the room there is.
		expect(savedFor(saved, "curriculum", 960)).toEqual(
			defaultWidths("curriculum"),
		);
		expect(savedFor(saved, "files", 1280)).toBeNull();
		expect(savedFor({}, "curriculum", 1280)).toBeNull();
	});

	it("does not let one view's widths stand in for another's", () => {
		const saved = withSaved({}, "files", 1280, defaultWidths("files"));
		expect(savedFor(saved, "curriculum", 1280)).toBeNull();
	});

	it("reads back only what is a layout", () => {
		const good = defaultWidths("files");
		const raw = JSON.stringify({
			"files:1280": good,
			"curriculum:960": { start: 240, end: 384 },
			"not a key": good,
		});
		const saved = parseSaved(raw);
		expect(saved[`files:1280`]).toEqual(good);
		expect(Object.keys(saved)).toHaveLength(1);
	});

	it("treats a missing or damaged settings string as no widths at all", () => {
		expect(parseSaved(null)).toEqual({});
		expect(parseSaved("")).toEqual({});
		expect(parseSaved("{oh no")).toEqual({});
		expect(parseSaved("[]")).toEqual({});
		expect(parseSaved("null")).toEqual({});
	});

	it("keeps only the sizes nearest the one in use", () => {
		// 640, 720, … 2000: eighteen sizes, of which twelve can stay.
		let saved: Record<string, PaneWidths> = {};
		for (let n = 0; n < SAVED_MAX + 6; n += 1)
			saved = withSaved(saved, "files", 640 + n * 80, defaultWidths("files"));
		expect(Object.keys(saved)).toHaveLength(SAVED_MAX);
		expect(saved["files:2000"]).toEqual(defaultWidths("files"));
		expect(saved["files:640"]).toBeUndefined();
	});
});
