// The notes writer's rules (task 157), ported from tools/materials/notelib.py and notes.py.
// Every row and text here is made up: no school material is in the repository. The header
// test spells out today's three lines, so a later change to the format fails here first.

import { describe, expect, it } from "vitest";

import type { FileRow } from "./model";
import {
	clean,
	cost,
	estimateRun,
	estimateTokens,
	header,
	intro,
	noteFile,
	notingOrder,
	projection,
	splitParts,
	unreadImages,
	usable,
} from "./notes";

const TODAY = new Date(2026, 9, 29);

/** A register row of made-up material, with the fields a note names. */
function row(id: string, over: Partial<FileRow> = {}): FileRow {
	return {
		id,
		path: `Grade 3/${id}.pdf`,
		grade: 3,
		subject: "math",
		block: "1",
		kind: "sheet",
		pages: 4,
		authority: 2,
		year: "old",
		academicYear: "2025-26",
		published: "",
		publishedFrom: "",
		dupOf: "",
		imagePages: 0,
		error: "",
		firstSeen: "2026-10-01",
		size: 1000,
		mtime: "1",
		metaDate: "",
		fixed: [],
		...over,
	};
}

describe("a note's body", () => {
	it("loses quote lines and a fence around the whole reply, as notes.py cleans it", () => {
		expect(clean("> thinking\nKind: sheet\n\n## What it covers\nx")).toBe(
			"Kind: sheet\n\n## What it covers\nx",
		);
		expect(clean("```markdown\nKind: sheet\n```")).toBe("Kind: sheet");
		expect(clean("```\nKind: sheet\n```")).toBe("Kind: sheet");
		// A fence in the middle is the note's own Markdown, and stays.
		expect(clean("a\n```\nb\n```\nc")).toBe("a\n```\nb\n```\nc");
	});

	it("is usable only when it is long enough and starts the template", () => {
		const body = `Kind: sheet\n\n## What it covers\n${"x".repeat(200)}`;
		expect(usable(body)).toBe(true);
		expect(usable("## What it covers\nshort")).toBe(false);
		expect(usable(`Kind: sheet\n${"x".repeat(300)}`)).toBe(false);
	});
});

describe("splitting a long file", () => {
	it("keeps whole pages, and repeats the path line in every part", () => {
		const text = `# head\n\n${Array.from(
			{ length: 6 },
			(_, i) => `## Page ${i + 1}\n\n${"x".repeat(50)}\n\n`,
		).join("")}`;
		expect(splitParts(text, 10_000)).toEqual([text]);
		const parts = splitParts(text, 150);
		expect(parts.length).toBeGreaterThan(1);
		for (const part of parts) expect(part.startsWith("# head")).toBe(true);
		expect(parts.join("").match(/## Page/g)).toHaveLength(6);
	});

	it("finds only the pages nobody has read yet", () => {
		const text =
			"## Page 1\n\nhello\n\n## Page 2\n\n[image page: pages/abcdef012345/p002.png]\n\n## Page 3\n\n[read from image: a diagram]\n";
		expect(unreadImages(text)).toEqual([
			{ page: 2, path: "pages/abcdef012345/p002.png" },
		]);
	});
});

describe("the words a model gets", () => {
	it("names the curriculum, grade and subject in the first user line", () => {
		expect(intro(row("a", { grade: 0 }), "kestrel")).toBe(
			"This file is from the kestrel curriculum, KG, math. Its id is a. Write its note.",
		);
		expect(intro(row("a", { grade: null }), "kestrel")).toContain(
			"kestrel curriculum, Grade ?, math",
		);
	});

	it("writes today's three-line header, not the model", () => {
		const got = header(
			row("abcdef012345", {
				path: "Grade 3/abcdef012345.pdf",
				published: "2025-09-14",
				publishedFrom: "name",
			}),
			"kestrel",
			"anthropic/claude-haiku-5.5",
			{ in: 900, out: 300, estimated: false, images: 2 },
			TODAY,
		);
		expect(got.split("\n")).toEqual([
			"# abcdef012345 — kestrel/Grade 3/abcdef012345.pdf",
			"Source: kestrel · Grade 3 · math · Block 1 · sheet · 2025-26 · published 2025-09-14 (name) · authority 2",
			"Written: 2026-10-29 by anthropic/claude-haiku-5.5 · 900 in / 300 out · 2 image page(s) sent",
		]);
	});

	it("marks estimated tokens, leaves an unknown block out, and says 'no date'", () => {
		const got = header(
			row("a", { block: "", published: "", academicYear: "" }),
			"kestrel",
			"opencode/x",
			{ in: 9, out: 3, estimated: true, images: 0 },
			TODAY,
		);
		expect(got).toContain("math · sheet · no year · no date");
		expect(got).toContain("≈9 in / ≈3 out");
		expect(got).not.toContain("Block");
	});

	it("says a job folder reported no tokens", () => {
		const got = header(
			row("abcdef012345"),
			"kestrel",
			"job folder (Claude Code)",
			{ in: null, out: null, estimated: false, images: 1 },
			TODAY,
		);
		expect(got.split("\n")[2]).toBe(
			"Written: 2026-10-29 by job folder (Claude Code) · not reported · 1 image page(s) sent",
		);
	});
});

describe("a note as it is written", () => {
	it("puts the header first, joins the parts as notes.py joins them, and names pages left out", () => {
		expect(noteFile("HEAD", ["one", "two"], [4, 9])).toBe(
			"HEAD\none\n\ntwo\n\nNot seen (over the picture limit): pages 4, 9.\n",
		);
	});
});

describe("what a run will cost", () => {
	it("counts tokens as notes.py does, and prices them per million", () => {
		expect(estimateTokens("x".repeat(400))).toBe(100);
		expect(estimateTokens("")).toBe(1);
		expect(cost(1000, 100, null, 5)).toBeNull();
		expect(cost(1_000_000, 200_000, 1, 5)).toBeCloseTo(2);
	});

	it("projects the rest from a trial's tokens per page", () => {
		const trial = [
			{ pages: 10, in: 10_000, out: 2_000 },
			{ pages: 10, in: 10_000, out: 2_000 },
		];
		expect(projection(trial, [{ pages: 100 }, { pages: 50 }])).toEqual({
			files: 2,
			pages: 150,
			in: 150_000,
			out: 30_000,
		});
	});

	it("falls back to the pipeline's measured pages, and counts pictures", () => {
		const got = estimateRun([{ pages: 4 }, { pages: 6 }], 2);
		expect(got).toMatchObject({ files: 2, pages: 10, imagePages: 2 });
		expect(got.in).toBe(3000 + 1600);
		expect(got.out).toBe(7000);
	});
});

describe("which files are noted", () => {
	it("skips copies, broken files, files with no pages and files that have a note", () => {
		const rows = [
			row("a"),
			row("b", { dupOf: "x.pdf" }),
			row("c", { error: "broken" }),
			row("d", { pages: 0 }),
			row("e"),
		];
		expect(
			notingOrder(rows, new Set(["e"]), "2026-27").map((r) => r.id),
		).toEqual(["a"]);
	});

	it("orders this year first, then official material, then examinations", () => {
		const rows = [
			row("a"),
			row("b", { academicYear: "2026-27", year: "current" }),
			row("c", { kind: "exam" }),
			row("d", { authority: 1 }),
		];
		expect(notingOrder(rows, new Set(), "2026-27").map((r) => r.id)).toEqual([
			"b",
			"d",
			"c",
			"a",
		]);
	});

	it("writes a file again only when the author asked", () => {
		const rows = [row("a")];
		expect(notingOrder(rows, new Set(["a"]), "2026-27")).toEqual([]);
		expect(
			notingOrder(rows, new Set(["a"]), "2026-27", new Set(["a"])).map(
				(r) => r.id,
			),
		).toEqual(["a"]);
	});
});
