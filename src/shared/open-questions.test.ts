// The open questions of a change set: the new shape, an old plain string, bad sources, the
// limits (task 242).

import { describe, expect, it } from "vitest";
import type { FileRow } from "./model.ts";
import { OPEN_LIMITS, type OpenGiven, parseOpen } from "./open-questions.ts";

const ID = "aaaaaaaaaaaa";

const given: OpenGiven = {
	files: [{ id: ID, pages: 10 } as FileRow],
	pages: () => 0,
};

/** Parses a list and returns it with the paths it refused. */
function parsed(value: unknown) {
	const refused: string[] = [];
	const open = parseOpen(value, given, (path) => refused.push(path));
	return { open, refused };
}

describe("open questions", () => {
	it("reads the new shape", () => {
		const { open, refused } = parsed([
			{ text: "هل نجمع الوحدتين؟", decide: true, sources: [`${ID}#p4`] },
			{
				text: "Pages 7-8 were unreadable.",
				decide: false,
				sources: [`${ID}#p7-8`],
			},
		]);
		expect(refused).toEqual([]);
		expect(open).toEqual([
			{ text: "هل نجمع الوحدتين؟", decide: true, sources: [`${ID}#p4`] },
			{
				text: "Pages 7-8 were unreadable.",
				decide: false,
				sources: [`${ID}#p7-8`],
			},
		]);
	});

	it("reads an old plain string as a question for information", () => {
		expect(parsed(["Which page gives the labels?"]).open).toEqual([
			{ text: "Which page gives the labels?", decide: false, sources: [] },
		]);
	});

	it("drops a bad source and keeps its question", () => {
		const { open, refused } = parsed([
			{
				text: "Confirm the grouping.",
				decide: true,
				sources: [`${ID}#p4`, "bbbbbbbbbbbb#p1", `${ID}#p40`, `${ID}`, 7],
			},
		]);
		expect(open).toEqual([
			{ text: "Confirm the grouping.", decide: true, sources: [`${ID}#p4`] },
		]);
		expect(refused).toEqual([
			"open[0].sources[1]",
			"open[0].sources[2]",
			"open[0].sources[3]",
			"open[0].sources[4]",
		]);
	});

	it("refuses a question without text, and anything but true is not a decision", () => {
		const { open, refused } = parsed([
			{ decide: true },
			{ text: "A note.", decide: "yes" },
		]);
		expect(open).toEqual([{ text: "A note.", decide: false, sources: [] }]);
		expect(refused).toEqual(["open[0].text"]);
	});

	it("keeps at most 5 decisions and 8 in all", () => {
		const many = Array.from({ length: 7 }, (_, i) => ({
			text: `Decide ${i}`,
			decide: true,
		}));
		const more = Array.from({ length: 5 }, (_, i) => `Note ${i}`);
		const { open, refused } = parsed([...many, ...more]);
		expect(open.filter((question) => question.decide)).toHaveLength(
			OPEN_LIMITS.decide,
		);
		expect(open).toHaveLength(OPEN_LIMITS.all);
		expect(refused).toEqual(["open[5]", "open[6]", "open[10]", "open[11]"]);
	});
});
