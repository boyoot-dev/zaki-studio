// "Build from my book" (task 246): one job folder with both parts, collected notes first and
// change sets second; the time estimate; and the key path, notes then change set under one
// limit. Every file and page here is made up.

import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bookMinutes } from "../shared/book.ts";
import type { CurriculumModel, FileRow } from "../shared/model.ts";
import type { Target } from "../shared/targets.ts";
import { buildWithKey, collectBookJob, prepareBookJob } from "./book.ts";
import { readStored } from "./changes.ts";
import { listJobs } from "./job.ts";
import { writeFiles, writeModel, writeTextFile } from "./model.ts";
import { noteIds, saveNote } from "./notes.ts";
import type { NoteRequest } from "./openrouter.ts";

const READ = "9a010f4b4816";
const NEW = "abcdef012345";
const TODAY = new Date(2026, 10, 19, 9, 0);
const COURSE = { grade: 7, subject: "science", language: "en" };
const TARGET: Target = { ...COURSE, period: "year" };

/** A register row of made-up material, in the course and the year's one period. */
function row(id: string): FileRow {
	return {
		id,
		path: `Grade 7/Science/Books/${id}.pdf`,
		grade: 7,
		subject: "science",
		language: "en",
		block: "",
		kind: "book",
		pages: 8,
		authority: 1,
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
	};
}

/** A year that is not split, and the course with no unit yet. */
function model(): CurriculumModel {
	return {
		curriculum: {
			nameEn: "Made-up Curriculum",
			nameAr: "منهج مُختلق",
			author: "",
			rights: "",
			periods: [
				{
					id: "year",
					nameEn: "The year",
					nameAr: "السنة الدراسية",
					wholeYear: false,
					periods: [],
				},
			],
		},
		courses: [],
	};
}

/** A note body the collector accepts. */
function noteBody(what: string): string {
	return `## What it covers\n\n${what}\n\n${"A made-up line about the page. ".repeat(10)}\n`;
}

/** A change set citing one file's page 6. */
function changeSet(source: string): Record<string, unknown> {
	return {
		grade: 7,
		subject: "science",
		language: "en",
		period: "year",
		units: [
			{
				number: 1,
				title: "Breathing",
				source: "sheet",
				keywords: ["lungs"],
				evidence: [],
				lessons: [
					{
						number: 1,
						title: "The lungs",
						activity: null,
						skills: [{ code: null, text: "name the parts" }],
						facts: [
							{
								text: "The lungs take oxygen from the air.",
								sources: [`${source}#p6`],
							},
						],
					},
				],
			},
		],
		open: [],
	};
}

const allowed = (period: string): Target | null =>
	period === "year" ? { ...COURSE, period } : null;

let base = "";
let project = "";

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-book-"));
	project = join(base, "kestrel");
	mkdirSync(project, { recursive: true });
	if (!writeModel(project, model()).ok) throw new Error("no model");
	writeFiles(project, [row(READ), row(NEW)]);
	for (const id of [READ, NEW])
		writeTextFile(
			project,
			id,
			`# Grade 7/Science/Books/${id}.pdf\n\n## Page 6\n\nThe lungs take oxygen from the air and give out carbon dioxide.\n`,
		);
	saveNote(
		project,
		READ,
		`# ${READ} — book\nSource: kestrel · Grade 7 · science · book\n\n${noteBody("The lungs.")}`,
	);
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

/** Prepares the course's job and returns its folder. */
function prepare(): string {
	const got = prepareBookJob({
		root: project,
		model: model(),
		rows: [row(READ), row(NEW)],
		course: COURSE,
		allowed,
		curriculum: "kestrel",
		noteRules: "The note's rules.\n",
		unitRules: "The change set's rules.\n",
		tool: "claude-code",
		now: TODAY,
	});
	if (!got.ok) throw new Error(`not prepared: ${got.code}`);
	expect(got).toMatchObject({ files: 2, notes: 1, periods: 1 });
	return got.path;
}

describe("a book job", () => {
	it("holds the notes still to write and the course period, in one folder", () => {
		const folder = prepare();
		expect(existsSync(join(folder, "README.md"))).toBe(true);
		// read/ carries only the file without a note.
		expect(readdirSync(join(folder, "read", "files"))).toEqual([`${NEW}.md`]);
		const notes = join(
			folder,
			"build",
			"courses",
			"7-science-en-year",
			"notes",
		);
		const names = readdirSync(notes).sort();
		expect(names).toHaveLength(2);
		const later = names.find((name) => name.includes(NEW)) ?? "";
		expect(readFileSync(join(notes, later), "utf8")).toContain(
			`read/out/${NEW}.md`,
		);
		// It is neither a notes job nor a units job in their lists.
		expect(listJobs(project, "notes")).toEqual([]);
		expect(listJobs(project, "units")).toEqual([]);
		expect(listJobs(project, "book")).toHaveLength(1);
	});

	it("collects the notes, then the change set", () => {
		const folder = prepare();
		writeFileSync(
			join(folder, "read", "out", `${NEW}.md`),
			noteBody("Breathing."),
		);
		writeFileSync(
			join(folder, "build", "out", "7-science-en-year.json"),
			JSON.stringify(changeSet(NEW)),
		);
		const got = collectBookJob({
			root: project,
			model: model(),
			files: [row(READ), row(NEW)],
			name: folder.split(/[\\/]/).pop() ?? "",
			today: TODAY,
		});
		if (!got.ok) throw new Error(got.code);
		expect(got.notes.collected).toEqual([NEW]);
		expect(noteIds(project).has(NEW)).toBe(true);
		expect(got.units.collected).toEqual(["7-science-en-year"]);
		expect(readStored(project, TARGET)?.state).toBe("pending");
	});

	it("refuses a change set whose sources are files the job never carried", () => {
		const folder = prepare();
		const other = row("0123456789ab");
		writeTextFile(
			project,
			other.id,
			`# x\n\n## Page 6\n\nThe lungs take oxygen from the air.\n`,
		);
		writeFileSync(
			join(folder, "build", "out", "7-science-en-year.json"),
			JSON.stringify(changeSet(other.id)),
		);
		const got = collectBookJob({
			root: project,
			model: model(),
			// The register knows the file, but the job did not carry it.
			files: [row(READ), row(NEW), other],
			name: folder.split(/[\\/]/).pop() ?? "",
			today: TODAY,
		});
		if (!got.ok) throw new Error(got.code);
		expect(got.units.collected).toEqual([]);
		expect(got.units.refused).toEqual([
			{ name: "7-science-en-year.json", code: "invalid" },
		]);
		expect(readStored(project, TARGET)).toBeNull();
	});
});

describe("the time a build takes", () => {
	it("counts the pages still to read and the periods, rounded up to 5 minutes", () => {
		expect(bookMinutes(371, 1)).toBe(25);
		expect(bookMinutes(0, 1)).toBe(10);
		expect(bookMinutes(0, 0)).toBe(5);
		expect(bookMinutes(100, 3)).toBe(25);
	});
});

describe("a build with a key", () => {
	it("writes the missing notes, then the change set, and the limit spans both", async () => {
		const asked: string[] = [];
		const ask = async (request: NoteRequest) => {
			const isUnits = request.system.includes("change set");
			asked.push(isUnits ? "units" : "notes");
			return {
				body: isUnits ? JSON.stringify(changeSet(NEW)) : noteBody("Breathing."),
				in: 1000,
				out: 500,
				costUsd: isUnits ? 0.2 : 0.3,
				cut: false,
			};
		};
		const built = await buildWithKey({
			root: project,
			model: model(),
			rows: [row(READ), row(NEW)],
			course: COURSE,
			allowed,
			curriculum: "kestrel",
			noteRules: "The note's rules.\n",
			unitRules: "The change set's rules.\n",
			key: "sk-or-v1-made-up",
			notes: {
				model: "made/up",
				limit: 2,
				priceIn: null,
				priceOut: null,
				images: false,
			},
			units: { model: "made/up", limit: 2, priceIn: null, priceOut: null },
			today: TODAY,
			ask,
		});
		expect(asked).toEqual(["notes", "units"]);
		expect(built).toMatchObject({
			notesWritten: 1,
			sets: 1,
			stopped: false,
		});
		expect(built.spentUsd).toBeCloseTo(0.5);
		expect(readStored(project, TARGET)?.state).toBe("pending");
	});

	it("stops before the units when the notes used up the limit", async () => {
		const ask = async () => ({
			body: noteBody("Breathing."),
			in: 1000,
			out: 500,
			costUsd: 1,
			cut: false,
		});
		const built = await buildWithKey({
			root: project,
			model: model(),
			rows: [row(READ), row(NEW)],
			course: COURSE,
			allowed,
			curriculum: "kestrel",
			noteRules: "The note's rules.\n",
			unitRules: "The change set's rules.\n",
			key: "sk-or-v1-made-up",
			notes: {
				model: "made/up",
				limit: 1,
				priceIn: null,
				priceOut: null,
				images: false,
			},
			units: { model: "made/up", limit: 1, priceIn: null, priceOut: null },
			today: TODAY,
			ask,
		});
		expect(built.notesWritten).toBe(1);
		expect(built.sets).toBe(0);
		expect(built.stopped).toBe(true);
	});
});
