// The browser rounds on disk (task 245): start, the outline, a unit, a bad answer refused with
// its reason, and going on after a restart. Every file and page here is made up.

import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CurriculumModel, FileRow } from "../shared/model.ts";
import type { Target } from "../shared/targets.ts";
import { readStored } from "./changes.ts";
import { writeFiles, writeModel, writeTextFile } from "./model.ts";
import { answerRound, readRounds, roundsView, startRounds } from "./rounds.ts";

const FILE = "9a010f4b4816";
const TARGET: Target = {
	grade: 7,
	subject: "science",
	language: "en",
	period: "year",
};
const TODAY = new Date(2026, 10, 19, 10, 0);

function row(): FileRow {
	return {
		id: FILE,
		path: "Grade 7/Science/Books/book.pdf",
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
					nameAr: "السنة الدراسية",
					wholeYear: false,
					periods: [],
				},
			],
		},
		courses: [],
	};
}

let base = "";
let project = "";

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-rounds-"));
	project = join(base, "kestrel");
	mkdirSync(project, { recursive: true });
	if (!writeModel(project, model()).ok) throw new Error("no model");
	writeFiles(project, [row()]);
	const pages = Array.from(
		{ length: 8 },
		(_, i) =>
			`## Page ${i + 1}\n\n${i === 5 ? "The lungs take oxygen from the air." : `Page ${i + 1} text.`}`,
	).join("\n\n");
	writeTextFile(
		project,
		FILE,
		`# Grade 7/Science/Books/book.pdf\n\n${pages}\n`,
	);
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

const common = () => ({
	root: project,
	model: model(),
	rows: [row()],
	target: TARGET,
	unitRules: "The change set's rules.",
});

describe("the browser rounds", () => {
	it("goes from the outline to each unit, and saves one change set for review", () => {
		const started = startRounds({ ...common(), now: TODAY });
		if (started === null) throw new Error("not started");
		const first = roundsView(project, started, 8);
		expect(first.round).toBe(1);
		expect(existsSync(first.file)).toBe(true);
		expect(readFileSync(first.file, "utf8")).toContain(`# ${FILE} Grade 7`);

		// A bad answer is refused with its reason, and the round can be done again.
		const bad = answerRound({
			...common(),
			text: "Sure! Here you go.",
			today: TODAY,
		});
		expect(bad.ok).toBe(false);

		const outline = answerRound({
			...common(),
			text: JSON.stringify({
				units: [
					{
						number: 1,
						title: "Breathing",
						lessons: [{ number: 1, title: "The lungs" }],
						pages: [{ file: FILE, from: 5, to: 7 }],
					},
				],
			}),
			today: TODAY,
		});
		if (!outline.ok) throw new Error(outline.issue);

		// After a restart the rounds go on from disk.
		const kept = readRounds(project, TARGET);
		if (kept === null) throw new Error("not kept");
		const second = roundsView(project, kept, 8);
		expect(second).toMatchObject({ round: 2, total: 2, outlineDone: true });
		expect(second.unit?.title).toBe("Breathing");
		const upload = readFileSync(second.file, "utf8");
		expect(upload).toContain("## Page 6");
		expect(upload).not.toContain("## Page 2");

		const unit = answerRound({
			...common(),
			text: `\`\`\`json\n${JSON.stringify({
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
										sources: [`${FILE}#p6`],
									},
								],
							},
						],
					},
				],
				open: [],
			})}\n\`\`\``,
			today: TODAY,
		});
		if (!unit.ok) throw new Error(unit.issue);
		expect(unit.state.done).toBe(true);
		expect(readStored(project, TARGET)?.state).toBe("pending");
	});

	it("refuses a unit answer for another unit, saying which one it wants", () => {
		const started = startRounds({ ...common(), now: TODAY });
		if (started === null) throw new Error("not started");
		answerRound({
			...common(),
			text: JSON.stringify({
				units: [
					{
						number: 3,
						title: "Breathing",
						lessons: [{ number: 1, title: "The lungs" }],
						pages: [{ file: FILE, from: 5, to: 7 }],
					},
				],
			}),
			today: TODAY,
		});
		const wrong = answerRound({
			...common(),
			text: JSON.stringify({
				grade: 7,
				subject: "science",
				language: "en",
				period: "year",
				units: [
					{
						number: 4,
						title: "Other",
						source: "sheet",
						keywords: [],
						evidence: [],
						lessons: [
							{
								number: 1,
								title: "x",
								activity: null,
								skills: [],
								facts: [
									{
										text: "The lungs take oxygen from the air.",
										sources: [`${FILE}#p6`],
									},
								],
							},
						],
					},
				],
				open: [],
			}),
			today: TODAY,
		});
		expect(wrong).toEqual({
			ok: false,
			issue: "The answer has no unit 3. Ask the chat for unit 3 only.",
		});
	});
});
