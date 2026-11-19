// One teacher's request to the AI (task 248), each way: the job for one unit with the request
// in it, collected with a fake tool; the key with a fake asker; the browser round with a pasted
// answer. A change set reaching outside the unit is refused, and the teacher's own fact stays.
// Every file and page here is made up.

import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CurriculumModel, FileRow } from "../shared/model.ts";
import type { UnitRequest } from "../shared/request.ts";
import {
	acceptChange,
	collectUnitsJob,
	readStored,
	targetCourse,
} from "./changes.ts";
import { readModel, writeFiles, writeModel, writeTextFile } from "./model.ts";
import { saveNote } from "./notes.ts";
import {
	answerRequest,
	prepareRequestJob,
	requestContext,
	requestUpload,
} from "./request.ts";
import { writeChangeSet } from "./units.ts";

const ID = "9a010f4b4816";
const OTHER = "abcdef012345";
const TARGET = { grade: 7, subject: "science", language: "en", period: "year" };
const REQUEST: UnitRequest = {
	...TARGET,
	unit: 1,
	lesson: 1,
	text: "Add the point about carbon dioxide.",
};
const TODAY = new Date(2026, 10, 19, 11, 0);

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

function unit(number: number, title: string, source: string) {
	return {
		id: `u${number}`,
		number,
		period: "year",
		title,
		source: "sheet" as const,
		keywords: [],
		evidence: [],
		lessons: [
			{
				id: `l${number}`,
				number: 1,
				title: `${title} lesson`,
				skills: [{ id: `s${number}`, code: null, text: "a skill" }],
				facts: [
					{
						text: "The teacher's own fact.",
						sources: [],
						status: "reviewed" as const,
						own: true,
					},
					{
						text: "The lungs take oxygen.",
						sources: [`${source}#p6`],
						status: "draft" as const,
						own: false,
					},
				],
				activity: null,
			},
		],
	};
}

function model(): CurriculumModel {
	return {
		curriculum: {
			nameEn: "Made-up",
			nameAr: "مُختلق",
			author: "",
			rights: "",
			periods: [
				{
					id: "year",
					nameEn: "The year",
					nameAr: "السنة",
					wholeYear: false,
					periods: [],
				},
			],
		},
		courses: [
			{
				grade: 7,
				subject: "science",
				language: "en",
				support: [],
				examStyle: null,
				exams: [],
				units: [unit(1, "Breathing", ID), unit(2, "Digestion", OTHER)],
			},
		],
	} as CurriculumModel;
}

/** An answer for unit 1 that adds one fact, or one that reaches into unit 2 as well. */
function answer(withUnit2 = false): Record<string, unknown> {
	const one = (number: number) => ({
		number,
		title: number === 1 ? "Breathing" : "Digestion",
		source: "sheet",
		keywords: [],
		evidence: [],
		lessons: [
			{
				number: 1,
				title: number === 1 ? "Breathing lesson" : "Digestion lesson",
				activity: null,
				skills: [{ code: null, text: "a skill" }],
				facts: [
					{ text: "The lungs take oxygen.", sources: [`${ID}#p6`] },
					{ text: "The lungs give out carbon dioxide.", sources: [`${ID}#p6`] },
				],
			},
		],
	});
	return {
		...TARGET,
		units: withUnit2 ? [one(1), one(2)] : [one(1)],
		open: [],
	};
}

let base = "";
let root = "";

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-request-"));
	root = join(base, "kestrel");
	mkdirSync(root, { recursive: true });
	if (!writeModel(root, model()).ok) throw new Error("no model");
	writeFiles(root, [row(ID), row(OTHER)]);
	for (const id of [ID, OTHER]) {
		writeTextFile(
			root,
			id,
			`# Grade 7/Science/Books/${id}.pdf\n\n## Page 6\n\nThe lungs take oxygen and give out carbon dioxide.\n`,
		);
		saveNote(root, id, `# ${id}\n\n## What it covers\n\nBreathing.\n`);
	}
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

function context() {
	const got = requestContext(
		model(),
		[row(ID), row(OTHER)],
		REQUEST,
		"The rules.",
	);
	if (!("target" in got)) throw new Error(got.code);
	return got;
}

describe("a request with my AI tool", () => {
	it("writes a job for the one unit with the request in it, and collects the answer", () => {
		const made = prepareRequestJob({
			root,
			context: context(),
			request: REQUEST,
			curriculum: "kestrel",
			tool: "claude-code",
			now: TODAY,
		});
		if (!made.ok) throw new Error(made.code);
		const course = JSON.parse(
			readFileSync(
				join(made.path, "courses", "7-science-en-year", "course.json"),
				"utf8",
			),
		) as { units: { number: number }[] };
		expect(course.units.map((entry) => entry.number)).toEqual([1]);
		expect(readFileSync(join(made.path, "rules.md"), "utf8")).toContain(
			REQUEST.text,
		);
		// Only the file the unit's facts name is carried.
		const notes = join(made.path, "courses", "7-science-en-year", "notes");
		expect(existsSync(join(notes, `01-${ID}.md`))).toBe(true);
		expect(existsSync(join(notes, `02-${OTHER}.md`))).toBe(false);

		writeFileSync(
			join(made.path, "out", "7-science-en-year.json"),
			JSON.stringify(answer()),
		);
		const got = collectUnitsJob({
			root,
			model: model(),
			files: [row(ID), row(OTHER)],
			name: made.name,
			today: TODAY,
		});
		if ("ok" in got) throw new Error(got.code);
		expect(got.collected).toEqual(["7-science-en-year"]);
		expect(readStored(root, TARGET)?.request).toBe(REQUEST.text);
	});

	it("refuses an answer that reaches outside the unit", () => {
		const made = prepareRequestJob({
			root,
			context: context(),
			request: REQUEST,
			curriculum: "kestrel",
			tool: "claude-code",
			now: TODAY,
		});
		if (!made.ok) throw new Error(made.code);
		writeFileSync(
			join(made.path, "out", "7-science-en-year.json"),
			JSON.stringify(answer(true)),
		);
		const got = collectUnitsJob({
			root,
			model: model(),
			files: [row(ID), row(OTHER)],
			name: made.name,
			today: TODAY,
		});
		if ("ok" in got) throw new Error(got.code);
		expect(got.collected).toEqual([]);
		expect(readStored(root, TARGET)).toBeNull();
	});
});

describe("a request with a key", () => {
	it("sends the one unit and the request, and keeps the teacher's fact on accept", async () => {
		const ctx = context();
		const asked: string[] = [];
		const written = await writeChangeSet({
			root,
			model: ctx.model,
			rows: ctx.rows,
			target: ctx.target,
			rules: ctx.rules,
			key: "sk-or-v1-made-up",
			modelName: "made/up",
			priceIn: null,
			priceOut: null,
			limitUsd: 1,
			today: TODAY,
			request: { unit: REQUEST.unit, text: REQUEST.text },
			ask: async (request) => {
				asked.push(request.system, request.text);
				return {
					body: JSON.stringify(answer()),
					in: 10,
					out: 10,
					costUsd: 0.01,
					cut: false,
				};
			},
		});
		if (!written.ok) throw new Error(written.code);
		expect(asked.join("\n")).toContain(REQUEST.text);
		expect(asked.join("\n")).not.toContain("Digestion");
		const accepted = acceptChange({
			root,
			model: model(),
			files: [row(ID), row(OTHER)],
			target: TARGET,
			choice: { kind: "all" },
		});
		if (!accepted.ok) throw new Error(accepted.code);
		const read = readModel(root);
		if (!read.ok) throw new Error("no model");
		const facts =
			targetCourse(read.model, TARGET)?.units[0]?.lessons[0]?.facts.map(
				(fact) => fact.text,
			) ?? [];
		expect(facts).toContain("The teacher's own fact.");
		expect(facts).toContain("The lungs give out carbon dioxide.");
		// Unit 2 was not touched.
		expect(targetCourse(read.model, TARGET)?.units[1]?.title).toBe("Digestion");
	});
});

describe("a request in the browser", () => {
	it("writes one upload, and keeps a pasted answer that stays in the unit", () => {
		const upload = requestUpload({
			root,
			context: context(),
			request: REQUEST,
			now: TODAY,
		});
		if (!upload.ok) throw new Error(upload.code);
		expect(readFileSync(upload.path, "utf8")).toContain(REQUEST.text);
		expect(
			answerRequest({
				root,
				model: model(),
				rows: [row(ID), row(OTHER)],
				request: REQUEST,
				text: JSON.stringify(answer(true)),
				today: TODAY,
			}),
		).toEqual({ ok: false, issue: "The answer changes more than unit 1." });
		expect(
			answerRequest({
				root,
				model: model(),
				rows: [row(ID), row(OTHER)],
				request: REQUEST,
				text: `\`\`\`json\n${JSON.stringify(answer())}\n\`\`\``,
				today: TODAY,
			}),
		).toEqual({ ok: true });
		expect(readStored(root, TARGET)?.request).toBe(REQUEST.text);
	});
});
