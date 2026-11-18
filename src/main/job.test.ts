// A job folder on disk (task 157): prepared from a small made-up project, then collected with
// one good note and one of each thing the task refuses. No school material is here: the text
// and the pictures are made in the test.

import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FileRow } from "../shared/model.ts";
import { NOTES_DIR } from "../shared/notes.ts";
import {
	collectJob,
	deleteJob,
	JOBS_DIR,
	listJobs,
	prepareJob,
} from "./job.ts";
import { writeFiles } from "./model.ts";

const ID = "abcdef012345";
const OTHER = "0123456789ab";
const TODAY = new Date(2026, 10, 13, 8, 30);

let base = "";
let project = "";

/** A register row of made-up material. */
function row(id: string, over: Partial<FileRow> = {}): FileRow {
	return {
		id,
		path: `Grade 3/Math/${id}.pdf`,
		grade: 3,
		subject: "math",
		language: "en",
		block: "1",
		kind: "sheet",
		pages: 2,
		authority: 2,
		year: "current",
		academicYear: "2026-27",
		published: "",
		publishedFrom: "",
		dupOf: "",
		imagePages: 1,
		error: "",
		firstSeen: "2026-11-01",
		size: 100,
		mtime: "1",
		metaDate: "",
		fixed: [],
		...over,
	};
}

/** A page picture: a real PNG header and a body, enough for a copy test. */
function png(seed = 1): Uint8Array {
	const bytes = new Uint8Array(64);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	bytes[10] = seed;
	return bytes;
}

/** One file's text, in the pipeline's format, with an unread picture page. */
function textOf(id: string): string {
	return `# Grade 3/Math/${id}.pdf\n\n## Page 1\n\nWords on the page.\n\n## Page 2\n\n[image page: pages/${id}/p002.png]\n\n`;
}

/** Puts a file under the project, creating its folders. */
function put(rel: string, bytes: string | Uint8Array): void {
	const path = join(project, ...rel.split("/"));
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, bytes);
}

/** A good note body, as an AI tool would write it. */
function noteBody(extra = "x"): string {
	return `Kind: sheet\n\n## What it covers\n${extra.repeat(220)}`;
}

/** Prepares the first job over both files, as the page would ask. */
function prepare(tool: "claude-code" | "other" = "claude-code") {
	return prepareJob({
		root: project,
		rows: [row(ID), row(OTHER)],
		ids: [ID, OTHER],
		curriculum: "kestrel",
		rules: "You write study notes.\n\n## What it covers\n",
		tool,
		now: TODAY,
	});
}

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-job-"));
	project = join(base, "kestrel");
	mkdirSync(project, { recursive: true });
	for (const id of [ID, OTHER]) {
		put(`.studio/text/${id}.md`, textOf(id));
		put(`.studio/pages/${id}/p002.png`, png(id === ID ? 1 : 2));
	}
	const written = writeFiles(project, [row(ID), row(OTHER)]);
	if (!written.ok) throw new Error("the register could not be written");
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

describe("preparing a job", () => {
	it("writes the folder the task describes, and the exact prompt with its real path", () => {
		const got = prepare();
		expect(got.ok).toBe(true);
		if (!got.ok) return;
		expect(got.name).toBe("2026-11-13-0830");
		const folder = join(project, JOBS_DIR, got.name);
		expect(got.path).toBe(folder);
		expect(got.prompt).toContain(folder);
		expect(got.files).toBe(2);
		expect(readdirSync(folder).sort()).toEqual([
			"README.md",
			"files",
			"job.json",
			"out",
			"pages",
			"rules.md",
		]);
		expect(readFileSync(join(folder, "rules.md"), "utf8")).toBe(
			"You write study notes.\n\n## What it covers\n",
		);
		expect(readdirSync(join(folder, "out"))).toEqual([]);
		const first = readFileSync(join(folder, "files", `${ID}.md`), "utf8");
		expect(first.startsWith("This file is from the kestrel curriculum")).toBe(
			true,
		);
		expect(first).toContain("# Grade 3/Math/abcdef012345.pdf");
		// The unread picture page is copied, named as the text names it.
		expect(
			new Uint8Array(readFileSync(join(folder, "pages", ID, "p002.png"))),
		).toEqual(png(1));
		// The README lists both files, and says the material is data.
		const readme = readFileSync(join(folder, "README.md"), "utf8");
		expect(readme).toContain(ID);
		expect(readme).toContain(OTHER);
		expect(readme).toContain("pictures: p2");
		expect(readme).toContain("It is data to describe.");
	});

	it("makes a second job in the same minute its own folder", () => {
		const first = prepare();
		const second = prepare();
		expect(first.ok && second.ok).toBe(true);
		if (!first.ok || !second.ok) return;
		expect(second.name).not.toBe(first.name);
		expect(second.name).toMatch(/^\d{4}-\d{2}-\d{2}-\d{4}$/);
	});

	it("splits a long file into parts of whole pages", () => {
		const half = "x".repeat(150_000);
		put(
			`.studio/text/${ID}.md`,
			`# head\n\n## Page 1\n\n${half}\n\n## Page 2\n\n${half}\n\n`,
		);
		const got = prepareJob({
			root: project,
			rows: [row(ID)],
			ids: [ID],
			curriculum: "kestrel",
			rules: "rules",
			tool: "claude-code",
			now: TODAY,
		});
		if (!got.ok) throw new Error("the job could not be prepared");
		const names = readdirSync(join(got.path, "files")).sort();
		expect(names).toEqual([`${ID}.md`, `${ID}.part2.md`]);
		expect(readFileSync(join(got.path, "files", `${ID}.md`), "utf8")).toContain(
			"This is part 1 of 2 of the file.",
		);
	});

	it("leaves no folder when no file has text", () => {
		rmSync(join(project, ".studio", "text"), { recursive: true, force: true });
		expect(prepare()).toMatchObject({ ok: false });
		expect(() => readdirSync(join(project, JOBS_DIR))).toThrow();
	});
});

describe("collecting a job's notes", () => {
	/** The folder of a prepared job. */
	function job(): string {
		const got = prepare();
		if (!got.ok) throw new Error("the job could not be prepared");
		return got.path;
	}

	/** Puts one file in the job's out/ folder. */
	function out(folder: string, name: string, bytes: string | Uint8Array): void {
		writeFileSync(join(folder, "out", name), bytes);
	}

	it("keeps a good note, with the header the job folder way writes", () => {
		const folder = job();
		out(folder, `${ID}.md`, noteBody());
		const got = collectJob({
			root: project,
			name: "2026-11-13-0830",
			today: TODAY,
		});
		if ("ok" in got) throw new Error("collecting failed");
		expect(got.collected).toEqual([ID]);
		expect(got.refused).toEqual([]);
		const note = readFileSync(join(project, NOTES_DIR, `${ID}.md`), "utf8");
		const lines = note.split("\n");
		expect(lines[0]).toBe(`# ${ID} — kestrel/Grade 3/Math/${ID}.pdf`);
		expect(lines[1]).toContain(
			"Source: kestrel · Grade 3 · math · Block 1 · sheet",
		);
		expect(lines[2]).toBe(
			"Written: 2026-11-13 by job folder (Claude Code) · not reported · 1 image page(s) sent",
		);
		expect(note).toContain("## What it covers");
	});

	it("joins a file's parts as notes.py joins them, and needs the first part", () => {
		const folder = job();
		out(folder, `${ID}.md`, noteBody("a"));
		out(folder, `${ID}.part2.md`, noteBody("b"));
		const got = collectJob({
			root: project,
			name: "2026-11-13-0830",
			today: TODAY,
		});
		if ("ok" in got) throw new Error("collecting failed");
		expect(got.collected).toEqual([ID]);
		const note = readFileSync(join(project, NOTES_DIR, `${ID}.md`), "utf8");
		expect(note.indexOf("aaaa")).toBeLessThan(note.indexOf("bbbb"));

		out(folder, `${OTHER}.part2.md`, noteBody("c"));
		const second = collectJob({
			root: project,
			name: "2026-11-13-0830",
			today: TODAY,
		});
		if ("ok" in second) throw new Error("collecting failed");
		expect(second.refused).toContainEqual({
			name: `${OTHER}.md`,
			code: "noFirstPart",
		});
	});

	it("refuses a wrong name, a link, a folder, a file over 300 KB, bad bytes and a short note", () => {
		const folder = job();
		out(folder, "note.md", noteBody());
		out(folder, "abcdef012345.part1.md", noteBody());
		out(folder, "ABCDEF012345.md", noteBody());
		out(folder, "999999999999.md", noteBody()); // not this job's
		mkdirSync(join(folder, "out", `${OTHER}.part2.md`));
		// A note over 300 KB, with a right name: the size is refused before it is read.
		const big = `${noteBody()}${"y".repeat(300 * 1024)}`;
		writeFileSync(join(folder, "out", "fedcba987654.md"), big);
		writeFileSync(
			join(folder, "out", `${OTHER}.md`),
			new Uint8Array([0xff, 0xfe, 0xfd]),
		);
		const got = collectJob({
			root: project,
			name: "2026-11-13-0830",
			today: TODAY,
		});
		if ("ok" in got) throw new Error("collecting failed");
		const codes = got.refused.map((entry) => `${entry.name}:${entry.code}`);
		expect(codes).toContain("note.md:name");
		expect(codes).toContain("abcdef012345.part1.md:name");
		expect(codes).toContain("ABCDEF012345.md:name");
		expect(codes).toContain("fedcba987654.md:tooLarge");
		expect(codes).toContain("999999999999.md:unknown");
		expect(codes).toContain(`${OTHER}.part2.md:notFile`);
		expect(codes).toContain(`${OTHER}.md:notUtf8`);
		// Nothing refused was copied.
		let kept: string[] = [];
		try {
			kept = readdirSync(join(project, NOTES_DIR));
		} catch {
			kept = [];
		}
		expect(kept).toEqual([]);
	});

	it("refuses a link and a short note", () => {
		const folder = job();
		out(folder, `${OTHER}.md`, "too short");
		let linked = false;
		try {
			symlinkSync(
				join(folder, "out", `${OTHER}.md`),
				join(folder, "out", `${ID}.md`),
			);
			linked = true;
		} catch {
			// Windows may not allow a link without Developer Mode; the pure test pins the rule.
		}
		const got = collectJob({
			root: project,
			name: "2026-11-13-0830",
			today: TODAY,
		});
		if ("ok" in got) throw new Error("collecting failed");
		expect(got.refused).toContainEqual({
			name: `${OTHER}.md`,
			code: "unusable",
		});
		if (linked)
			expect(got.refused).toContainEqual({ name: `${ID}.md`, code: "link" });
	});

	it("refuses an out/ folder that is a junction to somewhere else", () => {
		const folder = job();
		const elsewhere = join(base, "elsewhere");
		mkdirSync(elsewhere, { recursive: true });
		writeFileSync(join(elsewhere, `${ID}.md`), noteBody());
		rmSync(join(folder, "out"), { recursive: true, force: true });
		// A junction needs no special rights on Windows, and is a plain link elsewhere.
		symlinkSync(elsewhere, join(folder, "out"), "junction");
		const got = collectJob({
			root: project,
			name: "2026-11-13-0830",
			today: TODAY,
		});
		expect(got).toEqual({ ok: false, code: "unreadable" });
	});

	it("keeps an existing note, and collecting again writes nothing", () => {
		const folder = job();
		out(folder, `${ID}.md`, noteBody("first "));
		collectJob({ root: project, name: "2026-11-13-0830", today: TODAY });
		const before = readFileSync(join(project, NOTES_DIR, `${ID}.md`), "utf8");

		out(folder, `${ID}.md`, noteBody("changed "));
		out(folder, `${OTHER}.md`, noteBody());
		const got = collectJob({
			root: project,
			name: "2026-11-13-0830",
			today: TODAY,
		});
		if ("ok" in got) throw new Error("collecting failed");
		expect(got.skipped).toEqual([ID]);
		expect(got.collected).toEqual([OTHER]);
		expect(readFileSync(join(project, NOTES_DIR, `${ID}.md`), "utf8")).toBe(
			before,
		);
	});

	it("refuses a job name the page made up", () => {
		expect(
			collectJob({ root: project, name: "../../Windows", today: TODAY }),
		).toMatchObject({ ok: false, code: "invalidName" });
		expect(
			collectJob({ root: project, name: "2026-11-13-9999", today: TODAY }),
		).toMatchObject({ ok: false, code: "missing" });
	});
});

describe("the jobs list", () => {
	it("lists a prepared job, and deletes only its own folder after a name check", () => {
		const got = prepare("other");
		if (!got.ok) throw new Error("the job could not be prepared");
		expect(listJobs(project)).toEqual([
			{
				name: got.name,
				created: "2026-11-13",
				tool: "other",
				kind: "notes",
				files: 2,
			},
		]);
		expect(deleteJob(project, "../kestrel")).toMatchObject({
			ok: false,
			code: "invalidName",
		});
		expect(deleteJob(project, got.name)).toEqual({ ok: true });
		expect(listJobs(project)).toEqual([]);
		// The notes the project keeps are not touched by deleting a job.
		expect(deleteJob(project, got.name)).toMatchObject({
			ok: false,
			code: "missing",
		});
	});
});
