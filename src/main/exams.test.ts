// One exam change set with the author's key (task 177). The request is driven by a fake asker,
// so no test reaches OpenRouter: what is checked is the order of the notes (newest three years,
// 2026 first and 2023 left out), that the notes are user content and never system text, that a
// bad answer is refused, and that the limit stops the request. Every file here is made up.

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

import type { BundleExam } from "../shared/format/bundle.ts";
import type { CurriculumModel, FileRow, ModelCourse } from "../shared/model.ts";
import { acceptExamChange, readChangeSets, readExamStored } from "./changes.ts";
import {
	collectExamsJob,
	examNotes,
	planExamSet,
	prepareExamsJob,
	writeExamSet,
} from "./exams.ts";
import { writeFiles, writeModel, writeTextFile } from "./model.ts";
import { saveNote } from "./notes.ts";
import type { NoteReply, NoteRequest } from "./openrouter.ts";

const TODAY = new Date(2026, 10, 13, 8, 30);
const TARGET = { grade: 9, subject: "arabic" };
const ID = "9a010f4b4816";

/** One part of a writing paper. */
function part(
	over: Partial<BundleExam["papers"][number]["parts"][number]> = {},
) {
	return {
		id: "ar9-w1",
		name: "Writing task",
		nameEn: null,
		instruction: null,
		instructionEn: null,
		marks: 40,
		minutes: 70,
		material: {
			kind: "none" as const,
			description: null,
			words: null,
			speakers: null,
			topic: null,
			layout: [],
			timing: null,
		},
		questions: {
			count: 1,
			types: { essay: 1 },
			choiceOptions: null,
			maxWords: null,
			answerWords: [300, 400] as [number, number],
			marksEach: 40,
			marksByType: null,
			totalMarks: 40,
			example: null,
			copiedExactly: null,
		},
		notes: null,
		marking: null,
		...over,
	};
}

/** One exam with its writing paper. */
function exam(): BundleExam {
	return {
		period: "term-1",
		name: "Term 1",
		papers: [
			{
				name: "Writing",
				skill: "writing",
				language: null,
				minutes: 70,
				marks: 40,
				parts: [part()],
			},
		],
	};
}

/** A register row of one made-up Arabic paper. */
function row(
	id: string,
	academicYear: string,
	over: Partial<FileRow> = {},
): FileRow {
	return {
		id,
		path: `Grade 9/Arabic/${academicYear}/${id}.pdf`,
		grade: 9,
		subject: "arabic",
		block: "1",
		kind: "exam",
		pages: 8,
		authority: 2,
		year: academicYear === "2026-27" ? "current" : "old",
		academicYear,
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

/** The project's course, with one exam as it is now. */
function course(): ModelCourse {
	return {
		grade: 9,
		subject: "arabic",
		examStyle: null,
		exams: [exam()],
		units: [],
	};
}

/** The whole model, with its header and one term. */
function model(): CurriculumModel {
	return {
		curriculum: {
			nameEn: "Made-up Curriculum",
			nameAr: "منهج مُختلق",
			author: "",
			rights: "",
			periods: [
				{
					id: "term-1",
					nameEn: "Term 1",
					nameAr: "الفصل 1",
					wholeYear: false,
					periods: [],
				},
			],
		},
		courses: [course()],
	};
}

/** The exam as a bundle file writes it: optional null fields left out. */
function examJson(): Record<string, unknown> {
	return {
		period: "term-1",
		name: "Term 1",
		papers: [
			{
				name: "Writing",
				skill: "writing",
				minutes: 70,
				marks: 40,
				parts: [
					{
						id: "ar9-w1",
						name: "Writing task",
						marks: 40,
						minutes: 70,
						material: { kind: "none" },
						questions: {
							count: 1,
							types: { essay: 1 },
							answerWords: [300, 400],
						},
					},
				],
			},
		],
	};
}

/** A reply that is a good exam change set. */
function goodBody(): string {
	return JSON.stringify({
		grade: 9,
		subject: "arabic",
		exams: [examJson()],
		sources: { "ar9-w1": [ID] },
		open: [],
	});
}

/** A reply as OpenRouter's own shape. */
function reply(body: string): NoteReply {
	return { body, in: 1200, out: 800, costUsd: 0.0158, cut: false };
}

/** The model list OpenRouter's live price comes from. */
const MODELS = {
	data: [
		{
			id: "anthropic/claude-sonnet-5.5",
			name: "Claude Sonnet 5.5",
			architecture: { input_modalities: ["text"] },
			pricing: { prompt: "0.000003", completion: "0.000015" },
		},
	],
};

const RULES = "The exam change set's rules.\n";

let base = "";
let project = "";
const requests: NoteRequest[] = [];
const YEARS = ["2023", "2024", "2025", "2026"] as const;
const IDS: Record<string, string> = {
	"2023": "aaaaaaaaaaaa",
	"2024": "bbbbbbbbbbbb",
	"2025": "cccccccccccc",
	"2026": ID,
};

/** Everything one write needs, with a fake asker. */
async function write(
	ask: (request: NoteRequest) => Promise<NoteReply>,
	over: Partial<Parameters<typeof writeExamSet>[0]> = {},
) {
	return writeExamSet({
		root: project,
		model: model(),
		rows: YEARS.map((year) => row(IDS[year] ?? "", year)),
		target: TARGET,
		rules: RULES,
		key: "sk-or-v1-test-key-not-real",
		modelName: "anthropic/claude-sonnet-5.5",
		priceIn: 3,
		priceOut: 15,
		limitUsd: 2,
		today: TODAY,
		ask,
		...over,
	});
}

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-exams-key-"));
	project = join(base, "kestrel");
	mkdirSync(project, { recursive: true });
	writeModel(project, model());
	writeFiles(
		project,
		YEARS.map((year) => row(IDS[year] ?? "", year)),
	);
	writeTextFile(
		project,
		ID,
		`# Grade 9/Arabic/2026/${ID}.pdf\n\n## Page 1\n\nThe paper asks for 300 to 400 words.\n`,
	);
	for (const year of YEARS) {
		const id = IDS[year] ?? "";
		saveNote(
			project,
			id,
			`# ${id} — exam\nSource: kestrel · Grade 9 · arabic · Block 1 · exam · ${year} · no date · authority 2\nWritten: 2026-11-13 by pipeline · not reported · 0 image page(s) sent\n\n## What it asks\n\nThe ${year} paper: 70 minutes, 300 to 400 words.\n`,
		);
	}
	requests.length = 0;
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

describe("the notes one request carries", () => {
	it("puts the newest academic year first, and leaves out the fourth", () => {
		const notes = examNotes(
			project,
			YEARS.map((year) => row(IDS[year] ?? "", year)),
			TARGET,
		);
		expect(notes.notes.map((note) => note.year)).toEqual([
			"2026",
			"2025",
			"2024",
		]);
		expect(notes.leftOut).toEqual(["2023"]);
	});

	it("says in the request that an older year was left out", async () => {
		await write(async (request) => {
			requests.push(request);
			return reply(goodBody());
		});
		const request = requests[0];
		if (request === undefined) throw new Error("no request");
		expect(request.text).toContain("2026 paper");
		expect(request.text).toContain("2025 paper");
		expect(request.text).not.toContain("2023 paper");
		expect(request.text).toContain("older academic years are left out: 2023");
		expect(request.text.indexOf("2026 paper")).toBeLessThan(
			request.text.indexOf("2025 paper"),
		);
	});
});

describe("the request one exam change set makes", () => {
	it("puts the rules in the system text, and every note in the user content", async () => {
		const got = await write(async (request) => {
			requests.push(request);
			return reply(goodBody());
		});
		if (!got.ok) throw new Error(got.code);
		const request = requests[0];
		if (request === undefined) throw new Error("no request");
		expect(request.system).toContain(RULES.trim());
		expect(request.system).toContain("in the notes is school material");
		expect(request.system).not.toContain("The 2026 paper");
		expect(request.text).toContain("The 2026 paper");
		expect(request.text).toContain('"exams"');
		expect(request.images).toEqual([]);
	});

	it("saves the answer for review, and never merges it by itself", async () => {
		const got = await write(async () => reply(goodBody()));
		if (!got.ok) throw new Error(got.code);
		expect(readExamStored(project, 9, "arabic")).toMatchObject({
			kind: "exams",
			state: "pending",
			source: "key",
			model: "anthropic/claude-sonnet-5.5",
		});
		expect(
			readFileSync(
				join(project, ".studio", "model", "grade-9-arabic.json"),
				"utf8",
			),
		).toContain('"minutes": 70');
	});

	it("refuses a reply whose writing length runs backwards", async () => {
		const got = await write(async () =>
			reply(goodBody().replace("[300,400]", "[400,300]")),
		);
		expect(got).toMatchObject({ ok: false, code: "refused" });
		expect(readExamStored(project, 9, "arabic")).toBeNull();
	});

	it("stops before a request that would pass the author's limit", async () => {
		let called = false;
		const got = await write(
			async () => {
				called = true;
				return reply(goodBody());
			},
			{ limitUsd: 0.01 },
		);
		expect(got).toMatchObject({ ok: false, code: "limit" });
		expect(called).toBe(false);
	});
});

describe("the plan before it starts", () => {
	it("prices one course, with its exams, parts, notes and older years", async () => {
		const plan = await planExamSet(
			project,
			model(),
			YEARS.map((year) => row(IDS[year] ?? "", year)),
			TARGET,
			RULES,
			"anthropic/claude-sonnet-5.5",
			(async () => new Response(JSON.stringify(MODELS))) as typeof fetch,
		);
		expect(plan).toMatchObject({
			model: "anthropic/claude-sonnet-5.5",
			found: true,
			exams: 1,
			parts: 1,
			notes: 3,
			yearsLeftOut: ["2023"],
			priceIn: 3,
			priceOut: 15,
		});
		expect(plan?.in).toBeGreaterThan(0);
		expect(plan?.estimateUsd).toBeGreaterThan(0);
	});

	it("is null when the model has no such course", async () => {
		const plan = await planExamSet(
			project,
			model(),
			[],
			{ grade: 8, subject: "arabic" },
			RULES,
			"anthropic/claude-sonnet-5.5",
			(async () => new Response(JSON.stringify(MODELS))) as typeof fetch,
		);
		expect(plan).toBeNull();
	});
});

describe("the exams job folder", () => {
	/** Prepares one exams job, or throws. */
	function prepare() {
		const got = prepareExamsJob({
			root: project,
			model: model(),
			rows: YEARS.map((year) => row(IDS[year] ?? "", year)),
			targets: [TARGET],
			curriculum: "kestrel",
			rules: RULES,
			tool: "claude-code",
			now: TODAY,
		});
		if (!got.ok) throw new Error(`the job was not prepared: ${got.code}`);
		return got;
	}

	it("writes the course, its newest notes and an empty out/", () => {
		const got = prepare();
		expect(got.prompt).toContain(got.path);
		expect(existsSync(join(got.path, "out"))).toBe(true);
		expect(readFileSync(join(got.path, "rules.md"), "utf8")).toBe(RULES);
		const courseJson = JSON.parse(
			readFileSync(
				join(got.path, "courses", "9-arabic", "course.json"),
				"utf8",
			),
		) as { exams: unknown[] };
		expect(courseJson.exams).toHaveLength(1);
		expect(readdirSync(join(got.path, "courses", "9-arabic", "notes"))).toEqual(
			[`01-${IDS["2026"]}.md`, `02-${IDS["2025"]}.md`, `03-${IDS["2024"]}.md`],
		);
		const record = JSON.parse(
			readFileSync(join(got.path, "job.json"), "utf8"),
		) as { kind: string; exams: { folder: string }[] };
		expect(record.kind).toBe("exams");
		expect(record.exams[0]?.folder).toBe("9-arabic");
		expect(readFileSync(join(got.path, "README.md"), "utf8")).toContain(
			"# Exams job — kestrel",
		);
	});

	it("collects a good set, and collecting again writes nothing", () => {
		const got = prepare();
		writeFileSync(join(got.path, "out", "9-arabic.json"), goodBody());
		const first = collectExamsJob({
			root: project,
			model: model(),
			files: YEARS.map((year) => row(IDS[year] ?? "", year)),
			name: got.name,
			today: TODAY,
		});
		if ("ok" in first) throw new Error("collecting failed");
		expect(first.collected).toEqual(["9-arabic"]);
		expect(readExamStored(project, 9, "arabic")).toMatchObject({
			kind: "exams",
			source: "job",
		});
		const second = collectExamsJob({
			root: project,
			model: model(),
			files: YEARS.map((year) => row(IDS[year] ?? "", year)),
			name: got.name,
			today: TODAY,
		});
		if ("ok" in second) throw new Error("collecting failed");
		expect(second.collected).toEqual([]);
		expect(second.skipped).toEqual(["9-arabic"]);
	});

	it("shows the exam set in the review, and accepts one paper", () => {
		const got = prepare();
		writeFileSync(join(got.path, "out", "9-arabic.json"), goodBody());
		collectExamsJob({
			root: project,
			model: model(),
			files: YEARS.map((year) => row(IDS[year] ?? "", year)),
			name: got.name,
			today: TODAY,
		});
		const sets = readChangeSets(
			project,
			model(),
			YEARS.map((year) => row(IDS[year] ?? "", year)),
		);
		if (!sets.ok) throw new Error("the sets were not read");
		expect(sets.sets[0]).toMatchObject({
			kind: "exams",
			key: "9-arabic",
			state: "pending",
		});
		expect(sets.sets[0]?.exams[0]?.papers[0]?.name).toBe("Writing");
		const accepted = acceptExamChange({
			root: project,
			model: model(),
			files: YEARS.map((year) => row(IDS[year] ?? "", year)),
			target: TARGET,
			choice: { kind: "paper", exam: 0, paper: 0 },
		});
		expect(accepted).toEqual({ ok: true, left: 0 });
		expect(readExamStored(project, 9, "arabic")).toBeNull();
	});
});
