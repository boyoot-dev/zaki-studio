// Change sets on disk and the units job folder (task 158): a set is kept for review, collected
// from a job's out/ folder with every refusal the task names, merged only when accepted, and a
// rejected set stays until it is deleted. Every file and page here is made up.

import {
	existsSync,
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
import { parseChangeSet } from "../shared/changes";
import type { CurriculumModel, FileRow, ModelCourse } from "../shared/model";
import { checkBundle, toBundle } from "../shared/model";
import type { Project } from "../shared/project";
import { MAX_CHANGE_BYTES } from "../shared/targets";
import {
	acceptChange,
	collectUnitsJob,
	deleteChange,
	prepareUnitsJob,
	readChangeSets,
	readStored,
	rejectChange,
	targetCourse,
} from "./changes";
import { listJobs } from "./job";
import { readModel, writeFiles, writeModel, writeTextFile } from "./model";
import { saveNote } from "./notes";

const ID = "9a010f4b4816";
const OTHER = "abcdef012345";
const TODAY = new Date(2026, 10, 13, 8, 30);
const TARGET = { grade: 7, subject: "science", period: "block-3" };
const FOLDER = "7-science-block-3";

/** A register row of made-up material. */
function row(id: string, over: Partial<FileRow> = {}): FileRow {
	return {
		id,
		path: `Grade 7/Science/${id}.pdf`,
		grade: 7,
		subject: "science",
		block: "3",
		kind: "sheet",
		pages: 8,
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

/** The project's course: unit 5 in block-3 with the author's own fact, and unit 4 elsewhere. */
function course(): ModelCourse {
	return {
		grade: 7,
		subject: "science",
		examStyle: null,
		exams: [],
		units: [
			{
				number: 5,
				period: "block-3",
				title: "Breathing (provisional)",
				source: "provisional",
				keywords: [],
				evidence: [],
				lessons: [
					{
						number: 1,
						title: "Last year's title",
						skills: [{ code: null, text: "an old skill" }],
						facts: [
							{
								text: "The author's own fact stays.",
								sources: [`${ID}#p6`],
								status: "reviewed",
								own: true,
							},
							{
								text: "An old draft fact.",
								sources: [`${ID}#p6`],
								status: "draft",
								own: false,
							},
						],
						activity: null,
					},
				],
			},
			{
				number: 6,
				period: "block-3",
				title: "Digestion (provisional)",
				source: "provisional",
				keywords: [],
				evidence: [],
				lessons: [
					{
						number: 1,
						title: "The stomach",
						skills: [{ code: null, text: "an old skill" }],
						facts: [],
						activity: null,
					},
				],
			},
			{
				number: 4,
				period: "block-2",
				title: "Cells",
				source: "sheet",
				keywords: [],
				evidence: [],
				lessons: [
					{
						number: 1,
						title: "The cell",
						skills: [{ code: null, text: "name the parts of a cell" }],
						facts: [],
						activity: null,
					},
				],
			},
		],
	};
}

/** The whole project model, header and course. */
function model(): CurriculumModel {
	return {
		curriculum: {
			nameEn: "Made-up Curriculum",
			nameAr: "منهج مُختلق",
			author: "",
			rights: "",
			periods: [
				{
					id: "block-3",
					nameEn: "Block 3",
					nameAr: "المرحلة 3",
					wholeYear: false,
					periods: [],
				},
				{
					id: "block-2",
					nameEn: "Block 2",
					nameAr: "المرحلة 2",
					wholeYear: false,
					periods: [],
				},
			],
		},
		courses: [course()],
	};
}

/** A change set as a model would write it, for unit 5 only. */
function changeSet(): Record<string, unknown> {
	return {
		grade: 7,
		subject: "science",
		period: "block-3",
		units: [
			{
				number: 5,
				title: "Breathing",
				source: "sheet",
				keywords: ["lungs"],
				evidence: ["label a diagram, 4 marks"],
				lessons: [
					{
						number: 1,
						title: "The lungs",
						activity: null,
						skills: [{ code: null, text: "name the parts" }],
						facts: [
							{
								text: "The lungs take oxygen from the air.",
								sources: [`${ID}#p6`],
							},
						],
					},
				],
			},
			{
				number: 6,
				title: "Digestion",
				source: "sheet",
				keywords: ["stomach"],
				evidence: [],
				lessons: [
					{
						number: 1,
						title: "The stomach",
						activity: null,
						skills: [{ code: null, text: "describe digestion" }],
						facts: [
							{
								text: "The stomach breaks food down.",
								sources: [`${ID}#p6`],
							},
						],
					},
				],
			},
		],
		open: ["Which page gives the labels?"],
	};
}

/** The project file an export needs: its own id, and the grades it holds. */
function projectFile(): Project {
	return {
		format: "mr-zaki-studio-project",
		formatVersion: 1,
		id: "6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10",
		nameEn: "Made-up Curriculum",
		nameAr: "منهج مُختلق",
		author: "A made-up author",
		rights: "For this test only.",
		periods: model().curriculum.periods,
		grades: [
			{
				grade: 7,
				folder: "Grade 7",
				subjects: [{ subject: "science", folder: "Science" }],
			},
		],
	};
}

let base = "";
let project = "";

/** Puts a file under the project, creating its folders. */
function put(rel: string, bytes: string | Uint8Array): void {
	const path = join(project, ...rel.split("/"));
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, bytes);
}

/** Prepares one units job and returns its folder, or throws. */
function prepare(): string {
	const got = prepareUnitsJob({
		root: project,
		model: model(),
		rows: [row(ID), row(OTHER, { block: "2" })],
		targets: [TARGET],
		curriculum: "kestrel",
		rules: "The change set's rules.\n",
		tool: "claude-code",
		now: TODAY,
	});
	if (!got.ok) throw new Error(`the job was not prepared: ${got.code}`);
	return got.path;
}

/** Puts a change set in a job's out/ folder. */
function out(folder: string, name: string, value: unknown): void {
	writeFileSync(join(folder, "out", name), JSON.stringify(value, null, "\t"));
}

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-units-"));
	project = join(base, "kestrel");
	mkdirSync(project, { recursive: true });
	const written = writeModel(project, model());
	if (!written.ok) throw new Error("the model was not written");
	writeFiles(project, [row(ID), row(OTHER, { block: "2" })]);
	writeTextFile(
		project,
		ID,
		`# Grade 7/Science/${ID}.pdf\n\n## Page 6\n\nThe lungs take oxygen from the air and give out carbon dioxide.\n`,
	);
	saveNote(
		project,
		ID,
		`# ${ID} — sheet\nSource: kestrel · Grade 7 · science · Block 3 · sheet · 2026-27 · no date · authority 2\nWritten: 2026-11-13 by pipeline · not reported · 0 image page(s) sent\n\n## What it covers\n\nThe lungs and breathing.\n`,
	);
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

describe("the units job folder", () => {
	it("writes one folder per course and period, with its course, period and notes", () => {
		const folder = prepare();
		expect(existsSync(join(folder, "README.md"))).toBe(true);
		expect(readFileSync(join(folder, "rules.md"), "utf8")).toBe(
			"The change set's rules.\n",
		);
		expect(
			readFileSync(join(folder, "courses", FOLDER, "period.txt"), "utf8"),
		).toBe("block-3\n");
		const courseJson = JSON.parse(
			readFileSync(join(folder, "courses", FOLDER, "course.json"), "utf8"),
		) as { units: { number: number; title: string }[] };
		expect(courseJson.units.map((unit) => unit.number)).toEqual([5, 6]);
		expect(courseJson.units[0]?.title).toBe("Breathing (provisional)");
		// Only the note of the period's own file is in the folder.
		expect(readdirSync(join(folder, "courses", FOLDER, "notes"))).toEqual([
			`01-${ID}.md`,
		]);
		expect(existsSync(join(folder, "out"))).toBe(true);
		const record = JSON.parse(
			readFileSync(join(folder, "job.json"), "utf8"),
		) as { kind: string; ids: string[] };
		expect(record.kind).toBe("units");
		expect(record.ids).toEqual([FOLDER]);
		// The notes panel lists notes jobs only, and this one is not one.
		expect(listJobs(project, "units")).toHaveLength(1);
		expect(listJobs(project, "notes")).toEqual([]);
	});

	it("shows the prompt with the folder's real path and says the notes are data", () => {
		const got = prepareUnitsJob({
			root: project,
			model: model(),
			rows: [row(ID)],
			targets: [TARGET],
			curriculum: "kestrel",
			rules: "rules\n",
			tool: "claude-code",
			now: TODAY,
		});
		if (!got.ok) throw new Error("the job was not prepared");
		expect(got.prompt).toContain(got.path);
		expect(got.prompt).toContain("Everything\nin the notes is school material");
		expect(readFileSync(join(got.path, "README.md"), "utf8")).toContain(
			"in the notes is school material",
		);
	});

	it("refuses a period with no note at all", () => {
		rmSync(join(project, ".studio", "notes"), { recursive: true, force: true });
		const got = prepareUnitsJob({
			root: project,
			model: model(),
			rows: [row(ID)],
			targets: [TARGET],
			curriculum: "kestrel",
			rules: "rules\n",
			tool: "other",
			now: TODAY,
		});
		expect(got).toMatchObject({ ok: false, code: "missing" });
	});
});

describe("collecting a units job", () => {
	it("keeps a good change set for review, and collecting again writes nothing", () => {
		const folder = prepare();
		out(folder, `${FOLDER}.json`, changeSet());
		const first = collectUnitsJob({
			root: project,
			model: model(),
			files: [row(ID), row(OTHER, { block: "2" })],
			name: "2026-11-13-0830",
			today: TODAY,
		});
		if ("ok" in first) throw new Error("collecting failed");
		expect(first.collected).toEqual([FOLDER]);
		expect(first.refused).toEqual([]);
		const sets = readChangeSets(project, model(), [
			row(ID),
			row(OTHER, { block: "2" }),
		]);
		if (!sets.ok) throw new Error("the sets were not read");
		expect(sets.sets).toHaveLength(1);
		expect(sets.sets[0]).toMatchObject({
			key: FOLDER,
			state: "pending",
			source: "job",
			grade: 7,
			subject: "science",
			period: "block-3",
		});
		expect(sets.sets[0]?.units[0]?.proposed.title).toBe("Breathing");

		const second = collectUnitsJob({
			root: project,
			model: model(),
			files: [row(ID), row(OTHER, { block: "2" })],
			name: "2026-11-13-0830",
			today: TODAY,
		});
		if ("ok" in second) throw new Error("collecting failed");
		expect(second.collected).toEqual([]);
		expect(second.skipped).toEqual([FOLDER]);
	});

	it("refuses a wrong name, a folder, 2 MB, bad bytes and bad JSON", () => {
		const folder = prepare();
		/** Collects what is in out/ now. */
		const collect = () =>
			collectUnitsJob({
				root: project,
				model: model(),
				files: [row(ID)],
				name: "2026-11-13-0830",
				today: TODAY,
			});
		const codes = (): string[] => {
			const got = collect();
			if ("ok" in got) throw new Error("collecting failed");
			return got.refused.map((entry) => `${entry.name}:${entry.code}`);
		};

		out(folder, "note.json", changeSet());
		out(folder, "8-math-block-3.json", changeSet());
		out(folder, `${FOLDER}.txt`, changeSet());
		mkdirSync(join(folder, "out", "folder.json"));
		writeFileSync(
			join(folder, "out", "huge.json"),
			"x".repeat(MAX_CHANGE_BYTES),
		);
		const named = codes();
		expect(named).toContain("note.json:name");
		expect(named).toContain("8-math-block-3.json:name");
		expect(named).toContain(`${FOLDER}.txt:name`);
		expect(named).toContain("huge.json:tooLarge");
		expect(named).toContain("folder.json:notFile");
		rmSync(join(folder, "out", "note.json"));
		rmSync(join(folder, "out", "8-math-block-3.json"));
		rmSync(join(folder, "out", `${FOLDER}.txt`));
		rmSync(join(folder, "out", "folder.json"), { recursive: true });
		rmSync(join(folder, "out", "huge.json"));

		// A right name, but bytes that are not UTF-8.
		writeFileSync(
			join(folder, "out", `${FOLDER}.json`),
			new Uint8Array([0xff, 0xfe, 0xfd]),
		);
		expect(codes()).toContain(`${FOLDER}.json:notUtf8`);

		// A right name, valid UTF-8, but not JSON.
		writeFileSync(join(folder, "out", `${FOLDER}.json`), "{not json");
		expect(codes()).toContain(`${FOLDER}.json:invalid`);

		// A right name, valid JSON, but not a change set for this period.
		out(folder, `${FOLDER}.json`, { grade: 8 });
		expect(codes()).toContain(`${FOLDER}.json:invalid`);

		// A right name, but a link to a file the tool left there.
		let linked = false;
		writeFileSync(
			join(folder, "out", "real.json"),
			JSON.stringify(changeSet()),
		);
		try {
			symlinkSync(
				join(folder, "out", "real.json"),
				join(folder, "out", `${FOLDER}.json`),
			);
			linked = true;
		} catch {
			// Windows may not allow a link without Developer Mode; the rule is pinned above.
		}
		if (linked) {
			expect(codes()).toContain(`${FOLDER}.json:link`);
			rmSync(join(folder, "out", `${FOLDER}.json`));
		}
		// Nothing refused was kept.
		expect(readStored(project, TARGET)).toBeNull();
	});

	it("refuses an out/ folder that is a junction to somewhere else", () => {
		const folder = prepare();
		const elsewhere = join(base, "elsewhere");
		mkdirSync(elsewhere, { recursive: true });
		writeFileSync(
			join(elsewhere, `${FOLDER}.json`),
			JSON.stringify(changeSet(), null, "\t"),
		);
		rmSync(join(folder, "out"), { recursive: true, force: true });
		symlinkSync(elsewhere, join(folder, "out"), "junction");
		const got = collectUnitsJob({
			root: project,
			model: model(),
			files: [row(ID)],
			name: "2026-11-13-0830",
			today: TODAY,
		});
		expect(got).toEqual({ ok: false, code: "unreadable" });
	});
});

describe("review and acceptance", () => {
	/** Collects one good set, and gives the project's model as it is now. */
	function collected(): CurriculumModel {
		const folder = prepare();
		out(folder, `${FOLDER}.json`, changeSet());
		collectUnitsJob({
			root: project,
			model: model(),
			files: [row(ID)],
			name: "2026-11-13-0830",
			today: TODAY,
		});
		const read = readModel(project);
		if (!read.ok)
			throw new Error(
				`the model was not read: ${read.code} ${read.detail ?? ""}`,
			);
		return read.model;
	}

	it("merges an accepted unit into the model and keeps the author's own fact", () => {
		const current = collected();
		const accepted = acceptChange({
			root: project,
			model: current,
			files: [row(ID)],
			target: TARGET,
			choice: { kind: "unit", unit: 5 },
		});
		if (!accepted.ok) throw new Error(`accepting failed: ${accepted.code}`);
		const read = readModel(project);
		if (!read.ok) throw new Error("the model was not read");
		const unit = targetCourse(read.model, TARGET)?.units.find(
			(entry) => entry.number === 5,
		);
		expect(unit).toMatchObject({ title: "Breathing", source: "sheet" });
		const facts = unit?.lessons[0]?.facts ?? [];
		expect(facts.map((fact) => fact.text)).toEqual([
			"The author's own fact stays.",
			"The lungs take oxygen from the air.",
		]);
		expect(facts[0]?.own).toBe(true);
		expect(facts[1]?.own).toBe(false);
		// The set stays until every unit is accepted, and remembers this one.
		expect(readStored(project, TARGET)?.accepted).toEqual(["5"]);
	});

	it("accepts all, and leaves no set behind", () => {
		const current = collected();
		const accepted = acceptChange({
			root: project,
			model: current,
			files: [row(ID)],
			target: TARGET,
			choice: { kind: "all" },
		});
		expect(accepted).toEqual({ ok: true, left: 0 });
		expect(readStored(project, TARGET)).toBeNull();
	});

	it("accepts one lesson, and leaves the unit's own title for its own choice", () => {
		const current = collected();
		const accepted = acceptChange({
			root: project,
			model: current,
			files: [row(ID)],
			target: TARGET,
			choice: { kind: "lesson", unit: 5, lesson: 1 },
		});
		expect(accepted).toEqual({ ok: true, left: 2 });
		const read = readModel(project);
		if (!read.ok) throw new Error("the model was not read");
		const unit = targetCourse(read.model, TARGET)?.units.find(
			(entry) => entry.number === 5,
		);
		expect(unit?.title).toBe("Breathing (provisional)");
		expect(unit?.keywords).toEqual([]);
		expect(unit?.lessons[0]?.title).toBe("The lungs");
		expect(readStored(project, TARGET)?.accepted).toEqual(["5.1"]);
	});

	it("exports the accepted changes as a bundle the app's own parser accepts", () => {
		const current = collected();
		acceptChange({
			root: project,
			model: current,
			files: [row(ID)],
			target: TARGET,
			choice: { kind: "all" },
		});
		const read = readModel(project);
		if (!read.ok) throw new Error("the model was not read");
		const bundle = toBundle(
			{
				...read.model,
				curriculum: {
					...read.model.curriculum,
					author: "A made-up author",
					rights: "For this test only.",
				},
			},
			projectFile(),
			2,
		);
		expect(checkBundle(bundle, ["science"])).toEqual({ ok: true });
		const unit = bundle.courses[0]?.units.find((entry) => entry.number === 5);
		expect(unit?.title).toBe("Breathing");
		expect(unit?.lessons[0]?.facts).toContain(
			"The lungs take oxygen from the air.",
		);
		// The author's own fact travels too, and the facts' pages do not (a bundle has none).
		expect(unit?.lessons[0]?.facts).toContain("The author's own fact stays.");
	});

	it("keeps a rejected set until it is deleted", () => {
		collected();
		expect(rejectChange(project, TARGET)).toEqual({ ok: true });
		const sets = readChangeSets(project, model(), [row(ID)]);
		if (!sets.ok) throw new Error("the sets were not read");
		expect(sets.sets[0]?.state).toBe("rejected");
		expect(deleteChange(project, TARGET)).toEqual({ ok: true });
		const after = readChangeSets(project, model(), [row(ID)]);
		if (!after.ok) throw new Error("the sets were not read");
		expect(after.sets).toEqual([]);
	});

	it("lists a damaged set with its reason, so it can still be deleted", () => {
		put(
			`.studio/changes/${FOLDER}.json`,
			JSON.stringify({
				state: "pending",
				at: "2026-11-13",
				source: "job",
				model: "x",
				accepted: [],
				set: { grade: 7, subject: "science", period: "block-3" },
			}),
		);
		const sets = readChangeSets(project, model(), [row(ID)]);
		if (!sets.ok) throw new Error("the sets were not read");
		expect(sets.sets[0]?.units).toEqual([]);
		expect(sets.sets[0]?.refused[0]?.message).toContain("no units");
	});
});

describe("a set parsed from the review's own reading", () => {
	it("passes the same checks the review shows", () => {
		const parsed = parseChangeSet(changeSet(), {
			target: TARGET,
			units: course().units.filter((unit) => unit.period === "block-3"),
			files: [row(ID)],
			page: () =>
				"The lungs take oxygen from the air and give out carbon dioxide.",
			pages: () => 8,
		});
		if (!parsed.ok) throw new Error(parsed.issue);
		const fact = parsed.set.units[0]?.lessons[0]?.facts[0];
		expect(fact?.pageOk).toBe(true);
		expect(fact?.copy).toBeNull();
	});
});
