// A row's period (task 249): block digits, period ids, the one period of a year not split.

import { describe, expect, it } from "vitest";
import { presetPeriods } from "./project.ts";
import { inBlock, targetRows } from "./targets.ts";
import { blockIds, rowPeriodIds, termLabel, unitLeaves } from "./terms.ts";

const blocks = presetPeriods("terms-blocks");
const year = presetPeriods("none");

describe("a row's period", () => {
	it("reads digits as old blocks and period ids as themselves", () => {
		expect(blockIds("3", blocks)).toEqual(["block-3"]);
		expect(blockIds("2&3", blocks)).toEqual(["block-2", "block-3"]);
		expect(blockIds("t1-b2", blocks)).toEqual(["t1-b2"]);
		expect(blockIds("", blocks)).toEqual([]);
	});

	it("gives the one unit period of a year not split, and none in a split year", () => {
		expect(rowPeriodIds("", year)).toEqual(["year"]);
		expect(rowPeriodIds("", blocks)).toEqual([]);
		expect(unitLeaves(blocks)).toHaveLength(6);
	});

	it("matches a target period and the periods under it", () => {
		expect(inBlock({ block: "t1-b2" }, "t1-b2", blocks)).toBe(true);
		expect(inBlock({ block: "t1-b2" }, "t1", blocks)).toBe(true);
		expect(inBlock({ block: "t2-b1" }, "t1", blocks)).toBe(false);
		expect(inBlock({ block: "" }, "t1-b1", blocks)).toBe(false);
		expect(inBlock({ block: "" }, "year", year)).toBe(true);
	});

	it("picks a target's rows by their period", () => {
		const row = (id: string, block: string) => ({
			id,
			grade: 7,
			subject: "science",
			language: "en",
			block,
			dupOf: "",
			error: "",
			pages: 3,
		});
		const rows = [row("a", "t1-b1"), row("b", "t1-b2"), row("c", "t2-b1")];
		const target = {
			grade: 7,
			subject: "science",
			language: "en",
			period: "t1-b2",
		};
		expect(targetRows(rows, target, blocks).map((entry) => entry.id)).toEqual([
			"b",
		]);
	});

	it("names a row's term from the top down", () => {
		expect(termLabel("t2-b1", blocks, "en")).toBe("Term 2 · Block 1");
		expect(termLabel("t2-b1", blocks, "ar")).toBe(
			"الفصل الدراسي 2 · المرحلة 1",
		);
		expect(termLabel("3", blocks, "en")).toBeNull();
	});
});
