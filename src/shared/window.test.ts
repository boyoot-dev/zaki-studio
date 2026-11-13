// The windowed list's arithmetic: for any scroll position in a very long list, the range
// drawn stays within the viewport plus its margin, and never more than 300 rows.

import { describe, expect, it } from "vitest";

import { totalHeight, visibleRange } from "./window";

describe("the windowed list's range", () => {
	it("draws the rows of the viewport plus the margin", () => {
		expect(visibleRange(35_000, 32, 0, 640)).toEqual({ start: 0, end: 36 });
	});

	it("draws at most 300 rows for 35,000 items, at every position", () => {
		for (const scrollTop of [
			0,
			100,
			640,
			32 * 1000,
			32 * 17_500,
			32 * 35_000 - 640,
			32 * 35_000,
		]) {
			const { start, end } = visibleRange(35_000, 32, scrollTop, 640);
			expect(end - start).toBeLessThanOrEqual(300);
			expect(start).toBeGreaterThanOrEqual(0);
			expect(end).toBeLessThanOrEqual(35_000);
		}
	});

	it("holds the bottom edge when the list is shorter than the viewport", () => {
		expect(visibleRange(10, 32, 0, 640)).toEqual({ start: 0, end: 10 });
	});

	it("starts at the last window at the very bottom", () => {
		const { start, end } = visibleRange(35_000, 32, 32 * 35_000, 640);
		expect(end).toBe(35_000);
		expect(end - start).toBeLessThanOrEqual(300);
	});

	it("draws nothing for an empty list", () => {
		expect(visibleRange(0, 32, 0, 640)).toEqual({ start: 0, end: 0 });
	});

	it("never exceeds the viewport plus the margin, whatever the viewport height", () => {
		const { start, end } = visibleRange(35_000, 32, 0, 10_000, 8);
		expect(end - start).toBeLessThanOrEqual(300);
	});

	it("spans the whole list's height", () => {
		expect(totalHeight(35_000, 32)).toBe(1_120_000);
		expect(totalHeight(0, 32)).toBe(0);
	});
});
