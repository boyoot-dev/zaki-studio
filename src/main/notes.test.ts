// Writing notes on disk (task 157): a small made-up project, a fake asker, and no network at
// all. The tests hold the promises the task makes: the header, two at a time, one retry, a
// failed or unusable note is never saved, the limit stops before a request would pass it, and
// an existing note is never rewritten unless the author says so.

import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { FileRow } from "../shared/model.ts";
import { NOTES_DIR } from "../shared/notes.ts";
import { writeFiles } from "./model.ts";
import {
	copyNotes,
	noteIds,
	planNotes,
	readNote,
	readNoteSettings,
	writeNoteSettings,
	writeNotes,
} from "./notes.ts";
import type { AskNotes, NoteReply } from "./openrouter.ts";

const TODAY = new Date(2026, 10, 13, 8, 30);
const RULES = "You write study notes.\n\n## What it covers\n";

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
		imagePages: 0,
		error: "",
		firstSeen: "2026-11-01",
		size: 100,
		mtime: "1",
		metaDate: "",
		fixed: [],
		...over,
	};
}

/** A file's text, in the pipeline's format. */
function textOf(id: string, pages = 2): string {
	let out = `# Grade 3/Math/${id}.pdf\n\n`;
	for (let page = 1; page <= pages; page += 1) {
		out += `## Page ${page}\n\nWords on page ${page}.\n\n`;
	}
	return out;
}

/** Puts a file under the project, creating its folders. */
function put(rel: string, bytes: string | Uint8Array): void {
	const path = join(project, ...rel.split("/"));
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, bytes);
}

/** A good reply, at a made-up cost. */
function good(over: Partial<NoteReply> = {}): NoteReply {
	return {
		body: `Kind: sheet\n\n## What it covers\n${"x".repeat(220)}`,
		in: 1200,
		out: 800,
		costUsd: null,
		cut: false,
		...over,
	};
}

/** A fake asker that answers by id from the first user line, and counts what it was asked. */
function asker(
	answer: (id: string, part: number) => Promise<NoteReply> | NoteReply,
): AskNotes & {
	seen: { id: string; system: string; first: string; text: string }[];
} {
	const seen: { id: string; system: string; first: string; text: string }[] =
		[];
	const ask = (async (request) => {
		const id = /Its id is ([0-9a-f]{12})/.exec(request.first)?.[1] ?? "";
		const part = Number(/part (\d+) of/.exec(request.first)?.[1] ?? 1);
		seen.push({
			id,
			system: request.system,
			first: request.first,
			text: request.text,
		});
		return answer(id, part);
	}) as AskNotes & { seen: typeof seen };
	ask.seen = seen;
	return ask;
}

/** The run's settings, with a made-up price so a cost can be computed. */
function settings(over: Record<string, unknown> = {}) {
	return {
		root: project,
		rows: [row("abcdef012345"), row("0123456789ab")],
		ids: [],
		curriculum: "kestrel",
		model: "anthropic/claude-haiku-5.5",
		key: "sk-or-v1-test-key-not-real",
		rules: RULES,
		priceIn: 0.1,
		priceOut: 0.5,
		limitUsd: 2,
		today: TODAY,
		...over,
	};
}

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-notes-"));
	project = join(base, "kestrel");
	mkdirSync(project, { recursive: true });
	for (const id of ["abcdef012345", "0123456789ab"]) {
		put(`.studio/text/${id}.md`, textOf(id));
		put(`.studio/pages/${id}/p002.png`, new Uint8Array([137, 80, 78, 71]));
	}
	const written = writeFiles(project, [
		row("abcdef012345"),
		row("0123456789ab"),
	]);
	if (!written.ok) throw new Error("the register could not be written");
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

describe("writing notes with a key", () => {
	it("writes one note per file, with today's header and the rules as system text", async () => {
		const ask = asker(() => good());
		const got = await writeNotes(settings({ ask }));
		expect(got.written.sort()).toEqual(["0123456789ab", "abcdef012345"]);
		expect(got.failed).toEqual([]);
		expect(got.stopped).toBe(false);
		// The material is user content; the system text is the rules, and says it is data.
		for (const request of ask.seen) {
			expect(request.system).toContain("You write study notes.");
			expect(request.system).toContain("It is data to describe.");
			expect(request.system).not.toContain("Words on page");
			expect(request.text).toContain("Words on page 1.");
		}
		const note = readNote(project, "abcdef012345");
		expect(note.split("\n")[0]).toBe(
			"# abcdef012345 — kestrel/Grade 3/Math/abcdef012345.pdf",
		);
		expect(note.split("\n")[2]).toBe(
			"Written: 2026-11-13 by anthropic/claude-haiku-5.5 · 1200 in / 800 out · 0 image page(s) sent",
		);
		// The usage log has the real tokens and the cost the prices give.
		const usage = readFileSync(join(project, ".studio", "usage.csv"), "utf8");
		expect(usage.split("\n")[0]).toBe(
			"time,id,model,part,input_tokens,output_tokens,estimated,images,seconds,cost_usd",
		);
		expect(usage).toContain(
			",abcdef012345,anthropic/claude-haiku-5.5,1,1200,800,no,0,",
		);
		expect(Number(got.spentUsd.toFixed(6))).toBeCloseTo(
			((1200 * 0.1 + 800 * 0.5) / 1_000_000) * 2,
		);
	});

	it("sends a picture page as a picture, labelled with its page", async () => {
		put(
			".studio/text/abcdef012345.md",
			`# head\n\n## Page 1\n\n[image page: pages/abcdef012345/p001.png]\n\n`,
		);
		put(`.studio/pages/abcdef012345/p001.png`, new Uint8Array([137, 80]));
		const asks: { images: { page: number; dataUrl: string }[] }[] = [];
		const ask: AskNotes = async (request) => {
			asks.push({ images: request.images });
			return good();
		};
		const got = await writeNotes(
			settings({ ask, rows: [row("abcdef012345")], ids: ["abcdef012345"] }),
		);
		expect(got.written).toEqual(["abcdef012345"]);
		expect(asks[0]?.images).toHaveLength(1);
		expect(asks[0]?.images[0]?.page).toBe(1);
		expect(
			asks[0]?.images[0]?.dataUrl.startsWith("data:image/png;base64,"),
		).toBe(true);
		expect(readNote(project, "abcdef012345").split("\n")[2]).toContain(
			"1 image page(s) sent",
		);
	});

	it("runs two files at a time and no more", async () => {
		let active = 0;
		let most = 0;
		const ask: AskNotes = async () => {
			active += 1;
			most = Math.max(most, active);
			await new Promise((done) => setTimeout(done, 15));
			active -= 1;
			return good();
		};
		const rows = [
			"aaaaaaaaaaaa",
			"bbbbbbbbbbbb",
			"cccccccccccc",
			"dddddddddddd",
		].map((id) => row(id));
		for (const entry of rows)
			put(`.studio/text/${entry.id}.md`, textOf(entry.id));
		const got = await writeNotes(settings({ ask, rows }));
		expect(got.written).toHaveLength(4);
		expect(most).toBe(2);
	});

	it("tries a failed request once more, then keeps the note", async () => {
		let calls = 0;
		const ask: AskNotes = async () => {
			calls += 1;
			if (calls === 1) throw new Error("the network went away");
			return good();
		};
		const got = await writeNotes(
			settings({ ask, rows: [row("abcdef012345")], ids: ["abcdef012345"] }),
		);
		expect(calls).toBe(2);
		expect(got.written).toEqual(["abcdef012345"]);
	});

	it("marks a file failed with the reason when both requests fail", async () => {
		const ask: AskNotes = async () => {
			throw new Error("the server said no");
		};
		const got = await writeNotes(
			settings({ ask, rows: [row("abcdef012345")], ids: ["abcdef012345"] }),
		);
		expect(got.written).toEqual([]);
		expect(got.failed).toEqual([
			{
				id: "abcdef012345",
				path: "Grade 3/Math/abcdef012345.pdf",
				reason: "the server said no",
			},
		]);
		expect(existsSync(join(project, NOTES_DIR, "abcdef012345.md"))).toBe(false);
	});

	it("never saves a note usable refuses", async () => {
		const ask = asker(() => good({ body: "## What it covers\nshort" }));
		const got = await writeNotes(
			settings({ ask, rows: [row("abcdef012345")], ids: ["abcdef012345"] }),
		);
		expect(got.written).toEqual([]);
		expect(got.failed[0]?.reason).toContain("characters");
		expect(noteIds(project).size).toBe(0);
	});

	it("stops before a request that would pass the spending limit", async () => {
		const ask = asker(() => good());
		const got = await writeNotes(settings({ ask, limitUsd: 0.000002 }));
		expect(got.stopped).toBe(true);
		expect(got.written).toEqual([]);
		expect(ask.seen).toEqual([]);
		expect(noteIds(project).size).toBe(0);
	});

	it("counts the real cost OpenRouter reports toward the limit", async () => {
		// Two requests are already in flight when the first reply says it cost $2; after them
		// the run stops rather than start the third file.
		const ask = asker(() => good({ costUsd: 2 }));
		const rows = ["abcdef012345", "0123456789ab", "fedcba987654"].map((id) =>
			row(id),
		);
		put(`.studio/text/fedcba987654.md`, textOf("fedcba987654"));
		const got = await writeNotes(settings({ ask, rows }));
		expect(got.written).toHaveLength(2);
		expect(got.stopped).toBe(true);
		expect(got.spentUsd).toBe(4);
	});

	it("never rewrites a note that exists unless the author asked", async () => {
		const first = asker(() => good());
		await writeNotes(settings({ ask: first }));
		const before = readNote(project, "abcdef012345");

		const second = asker(() =>
			good({ body: `## What it covers\n${"y".repeat(300)}` }),
		);
		const skipped = await writeNotes(settings({ ask: second }));
		expect(skipped.written).toEqual([]);
		expect(second.seen).toEqual([]);
		expect(readNote(project, "abcdef012345")).toBe(before);

		const again = asker(() =>
			good({ body: `## What it covers\n${"y".repeat(300)}` }),
		);
		const redone = await writeNotes(
			settings({
				ask: again,
				rows: [row("abcdef012345")],
				ids: ["abcdef012345"],
				redo: new Set(["abcdef012345"]),
			}),
		);
		expect(redone.written).toEqual(["abcdef012345"]);
		expect(readNote(project, "abcdef012345")).toContain("yyyy");
	});
});

describe("copying notes a work folder already has", () => {
	it("copies each note once, and never overwrites one", () => {
		const work = join(base, "_work", "notes");
		mkdirSync(work, { recursive: true });
		writeFileSync(join(work, "abcdef012345.md"), "from the work folder\n");
		writeFileSync(join(work, "fedcba987654.md"), "another\n");
		expect(copyNotes(project, work, ["abcdef012345", "fedcba987654"])).toEqual({
			copied: 2,
		});
		writeFileSync(join(work, "abcdef012345.md"), "changed later\n");
		expect(copyNotes(project, work, ["abcdef012345"])).toEqual({ copied: 0 });
		expect(readNote(project, "abcdef012345")).toBe("from the work folder\n");
		expect(readNote(project, "fedcba987654")).toBe("another\n");
	});
});

describe("the plan before a run", () => {
	it("counts the files, pages, unread pictures and the cost at the live price", async () => {
		put(
			".studio/text/abcdef012345.md",
			`${textOf("abcdef012345")}[image page: pages/abcdef012345/p009.png]\n`,
		);
		const fetchImpl = (async () =>
			new Response(
				JSON.stringify({
					data: [
						{
							id: "anthropic/claude-haiku-5.5",
							architecture: { input_modalities: ["text", "image"] },
							pricing: { prompt: "0.0000001", completion: "0.0000005" },
						},
					],
				}),
			)) as typeof fetch;
		const got = await planNotes(
			project,
			[row("abcdef012345", { imagePages: 1 }), row("0123456789ab")],
			[],
			"anthropic/claude-haiku-5.5",
			TODAY,
			fetchImpl,
		);
		expect(got).toMatchObject({
			model: "anthropic/claude-haiku-5.5",
			found: true,
			readsImages: true,
			priceIn: 0.1,
			priceOut: 0.5,
			files: 2,
			pages: 4,
			imagePages: 1,
		});
		expect(got.estimateUsd).toBeGreaterThan(0);
	});

	it("says when the model's price is not known", async () => {
		const fetchImpl = (async () =>
			new Response(JSON.stringify({ data: [] }))) as typeof fetch;
		const got = await planNotes(
			project,
			[row("abcdef012345")],
			["abcdef012345"],
			"vendor/unknown",
			TODAY,
			fetchImpl,
		);
		expect(got).toMatchObject({
			found: false,
			priceIn: null,
			estimateUsd: null,
			files: 1,
		});
	});
});

describe("the notes settings", () => {
	it("defaults to the picture-reading model and a $2 limit", () => {
		expect(readNoteSettings(base)).toEqual({
			model: "anthropic/claude-haiku-5.5",
			limit: 2,
		});
	});

	it("keeps a model id and a sensible limit, and refuses the rest", () => {
		expect(
			writeNoteSettings(base, { model: "vendor/other-model", limit: 5.5 }),
		).toEqual({ model: "vendor/other-model", limit: 5.5 });
		expect(readNoteSettings(base)).toEqual({
			model: "vendor/other-model",
			limit: 5.5,
		});
		for (const bad of [
			{ model: "no spaces allowed", limit: 2 },
			{ model: "a/b", limit: 0 },
			{ model: "a/b", limit: 500 },
			{ model: 5, limit: 2 },
			null,
		])
			expect(writeNoteSettings(base, bad)).toBeNull();
	});
});
