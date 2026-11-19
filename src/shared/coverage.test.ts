// The pages the AI never used (task 250): text pages, ranges, a proposal's coverage, the
// outline's gaps, and the warning past 15%.

import { describe, expect, it } from "vitest";
import {
	citedPages,
	coverage,
	outlineGaps,
	ranges,
	textPages,
} from "./coverage.ts";

const LONG =
	"The lungs take oxygen from the air and give out carbon dioxide. ".repeat(5);
const A = "aaaaaaaaaaaa";

/** A file's text with these pages: true for a page of real text, false for a short one. */
function text(pages: boolean[]): string {
	return `# x\n\n${pages
		.map(
			(full, i) =>
				`## Page ${i + 1}\n\n${full ? LONG : "12"}\n[ocr of image: pages/${A}/p00${i + 1}.png]`,
		)
		.join("\n\n")}\n`;
}

describe("coverage", () => {
	it("counts only pages with real text, picture markers left out", () => {
		expect(textPages(text([true, false, true]))).toEqual([1, 3]);
	});

	it("turns page numbers into ranges", () => {
		expect(ranges([9, 3, 4, 5, 5])).toEqual([
			[3, 5],
			[9, 9],
		]);
	});

	it("says which text pages no fact cites, and warns past 15%", () => {
		const file = {
			id: A,
			path: "Books/part1.pdf",
			pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
		};
		const most = coverage([file], citedPages([`${A}#p1-8`, `${A}#p10`]));
		expect(most).toEqual({
			total: 10,
			used: 9,
			unused: [{ id: A, path: "Books/part1.pdf", ranges: [[9, 9]] }],
			warn: false,
		});
		const half = coverage([file], citedPages([`${A}#p1-5`]));
		expect(half.warn).toBe(true);
		expect(half.unused[0]?.ranges).toEqual([[6, 10]]);
	});

	it("lists the pages an outline puts in no unit", () => {
		const gaps = outlineGaps(
			[{ id: A, path: "Books/part1.pdf", pages: [1, 2, 3, 4, 5, 6] }],
			[
				{ pages: [{ file: A, from: 1, to: 2 }] },
				{ pages: [{ file: A, from: 5, to: 6 }] },
			],
		);
		expect(gaps.unused[0]?.ranges).toEqual([[3, 4]]);
	});
});
