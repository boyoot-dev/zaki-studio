// Hand edits on disk (task 247): an edit is written through writeModel and can be undone; a
// change set accepted later keeps the teacher's fact; and a curriculum with edits (a fact with
// no source among them) still passes the bundle check. Every file and page here is made up.

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type CurriculumModel,
	checkBundle,
	type FileRow,
	toBundle,
} from "../shared/model.ts";
import type { Project } from "../shared/project.ts";
import { acceptChange, saveChangeSet, targetCourse } from "./changes.ts";
import { editCourse, forgetUndo, undoEdit } from "./edit.ts";
import { readModel, writeFiles, writeModel, writeTextFile } from "./model.ts";

const ID = "9a010f4b4816";
const REF = { grade: 7, subject: "science", language: "en" };
const TARGET = { ...REF, period: "year" };
const YEAR = [
	{
		id: "year",
		nameEn: "The year",
		nameAr: "السنة الدراسية",
		wholeYear: false,
		periods: [],
	},
];

function row(): FileRow {
	return {
		id: ID,
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
			author: "A. Teacher",
			rights: "For this test only.",
			periods: YEAR,
		},
		courses: [
			{
				grade: 7,
				subject: "science",
				language: "en",
				support: [],
				examStyle: null,
				exams: [],
				units: [
					{
						id: "u1",
						number: 1,
						period: "year",
						title: "Breathing",
						source: "sheet",
						keywords: [],
						evidence: [],
						lessons: [
							{
								id: "l1",
								number: 1,
								title: "The lungs",
								skills: [{ id: "s1", code: null, text: "name the parts" }],
								facts: [
									{
										text: "The lungs take oxygen.",
										sources: [`${ID}#p6`],
										status: "draft",
										own: false,
									},
								],
								activity: null,
							},
						],
					},
				],
			},
		],
	} as CurriculumModel;
}

function project(): Project {
	return {
		format: "mr-zaki-studio-project",
		formatVersion: 2,
		id: "6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10",
		nameEn: "Made-up",
		nameAr: "مُختلق",
		author: "A. Teacher",
		rights: "For this test only.",
		periods: YEAR,
		grades: [
			{
				grade: 7,
				folder: "Grade 7",
				subjects: [
					{
						subject: "science",
						folder: "Science",
						language: "en",
						support: [],
					},
				],
			},
		],
	};
}

let base = "";
let root = "";

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-edit-"));
	root = join(base, "kestrel");
	mkdirSync(root, { recursive: true });
	if (!writeModel(root, model()).ok) throw new Error("no model");
	writeFiles(root, [row()]);
	writeTextFile(
		root,
		ID,
		"# Grade 7/Science/Books/book.pdf\n\n## Page 6\n\nThe lungs take oxygen from the air and give out carbon dioxide.\n",
	);
	forgetUndo(root);
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

/** The course's first lesson's facts as they are on disk. */
function factsNow() {
	const read = readModel(root);
	if (!read.ok) throw new Error("no model");
	return targetCourse(read.model, TARGET)?.units[0]?.lessons[0]?.facts ?? [];
}

describe("hand edits on disk", () => {
	it("writes an edit and undoes it", () => {
		const got = editCourse(root, REF, {
			kind: "fact.add",
			unit: 1,
			lesson: 1,
			after: 0,
			text: "The teacher's own fact.",
		});
		expect(got).toMatchObject({ ok: true, undo: 1 });
		expect(factsNow().map((fact) => fact.text)).toEqual([
			"The lungs take oxygen.",
			"The teacher's own fact.",
		]);
		expect(undoEdit(root)).toMatchObject({ ok: true, undo: 0 });
		expect(factsNow().map((fact) => fact.text)).toEqual([
			"The lungs take oxygen.",
		]);
		expect(undoEdit(root)).toEqual({
			ok: false,
			issue: "There is nothing to undo.",
		});
	});

	it("keeps the teacher's fact when a later change set is accepted", () => {
		editCourse(root, REF, {
			kind: "fact.text",
			unit: 1,
			lesson: 1,
			fact: 0,
			text: "The lungs take oxygen from the air.",
		});
		const read = readModel(root);
		if (!read.ok) throw new Error("no model");
		const saved = saveChangeSet(
			root,
			read.model,
			[row()],
			TARGET,
			{
				...TARGET,
				units: [
					{
						number: 1,
						title: "Breathing",
						source: "sheet",
						keywords: [],
						evidence: [],
						lessons: [
							{
								number: 1,
								title: "The lungs",
								activity: null,
								skills: [{ code: null, text: "name the parts" }],
								facts: [
									{
										text: "The lungs give out carbon dioxide.",
										sources: [`${ID}#p6`],
									},
								],
							},
						],
					},
				],
				open: [],
			},
			"job",
			"test",
			new Date(2026, 10, 19),
		);
		if (!saved.ok) throw new Error(saved.code);
		const accepted = acceptChange({
			root,
			model: read.model,
			files: [row()],
			target: TARGET,
			choice: { kind: "all" },
		});
		if (!accepted.ok) throw new Error(accepted.code);
		const facts = factsNow();
		expect(facts.map((fact) => fact.text)).toContain(
			"The lungs take oxygen from the air.",
		);
		expect(facts.find((fact) => fact.own)?.status).toBe("reviewed");
	});

	it("exports a curriculum with edits that passes the bundle check", () => {
		editCourse(root, REF, {
			kind: "fact.add",
			unit: 1,
			lesson: 1,
			after: 0,
			text: "A fact with no page.",
		});
		editCourse(root, REF, {
			kind: "lesson.add",
			unit: 1,
			after: 1,
			title: "Breathing out",
		});
		editCourse(root, REF, {
			kind: "unit.add",
			period: "year",
			title: "Digestion",
		});
		const read = readModel(root);
		if (!read.ok) throw new Error("no model");
		expect(
			checkBundle(toBundle(read.model, project(), 1), ["science"]),
		).toEqual({
			ok: true,
		});
	});
});
