// The project's cache (task 168), on disk: a write through the module is seen by the next
// read, a change made on disk behind its back is picked up too, one project never sees
// another's copy, and invalidation drops a project entirely. The register, the model, the
// report and the stopped scan's pending pages are all checked the same way: stat first,
// parse only when the file changed.

import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { FileRow } from "../shared/model.ts";
import {
	MODEL_DIR,
	modelFileText,
	PENDING_FILE,
	REPORT_FILE,
} from "../shared/model.ts";
import {
	invalidateProject,
	readFiles,
	readModel,
	readPending,
	readReport,
	writeFiles,
	writeModel,
	writePending,
	writeReport,
} from "./model.ts";

/** A made-up register row, so the register's order and content are visible in the tests. */
function row(id: string, path: string): FileRow {
	return {
		id,
		path,
		grade: 7,
		subject: "science",
		language: "en",
		block: "1",
		kind: "book",
		pages: 10,
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

const ROW_A = row("aaaaaaaaaaaa", "Grade 7/Science/Books/a.pdf");
const ROW_B = row("bbbbbbbbbbbb", "Grade 7/Science/Books/b.pdf");
const ROW_A2 = row("cccccccccccc", "Grade 7/Science/Books/a.pdf");

/** A model with one course, for the model cache's tests. */
const MODEL_A = {
	curriculum: {
		nameEn: "Made-up Curriculum",
		nameAr: "منهج مُختلق",
		author: "",
		rights: "",
		periods: [
			{
				id: "block-1",
				nameEn: "Block 1",
				nameAr: "المرحلة 1",
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
			units: [
				{
					id: "u1",
					number: 1,
					period: "block-1",
					title: "Original title",
					source: "sheet" as const,
					keywords: [],
					evidence: [],
					lessons: [
						{
							id: "l2",
							number: 1,
							title: "Lesson one",
							skills: [],
							facts: [
								{
									text: "A fact.",
									sources: [],
									status: "draft" as const,
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
};

/** Two of the model, differing by a hair, for change-on-disk tests. */
const MODEL_B = {
	...MODEL_A,
	courses: [
		{
			...MODEL_A.courses[0],
			units: [
				{
					...MODEL_A.courses[0].units[0],
					title: "Changed title by a character",
				},
			],
		},
	],
};

let base = "";
let project = "";

/** A fresh project folder, outside any real project. */
beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-cache-"));
	project = join(base, "Made-up School");
	mkdirSync(join(project, ".studio"), { recursive: true });
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

describe("the project's cache", () => {
	it("serves the register from memory and picks up a write through the module", () => {
		expect(writeFiles(project, [ROW_A])).toEqual({ ok: true });
		const first = readFiles(project);
		expect(first.ok && first.files.map((entry) => entry.id)).toEqual([
			"aaaaaaaaaaaa",
		]);
		expect(writeFiles(project, [ROW_A, ROW_B])).toEqual({ ok: true });
		const second = readFiles(project);
		expect(second.ok && second.files.map((entry) => entry.id)).toEqual([
			"aaaaaaaaaaaa",
			"bbbbbbbbbbbb",
		]);
	});

	it("picks up a register changed on disk behind its back", () => {
		expect(writeFiles(project, [ROW_A])).toEqual({ ok: true });
		expect(readFiles(project).ok).toBe(true);
		// The same file, written outside the module, with different content.
		writeFileSync(
			join(project, ".studio", "files.json"),
			modelFileText([ROW_A, ROW_B]),
			"utf8",
		);
		const changed = readFiles(project);
		expect(changed.ok && changed.files.map((entry) => entry.id)).toEqual([
			"aaaaaaaaaaaa",
			"bbbbbbbbbbbb",
		]);
	});

	it("picks up a same-size change made on disk (mtime moves)", () => {
		expect(writeFiles(project, [ROW_A])).toEqual({ ok: true });
		expect(readFiles(project).ok).toBe(true);
		// ROW_A and ROW_A2 differ only by their id: the same byte length.
		writeFileSync(
			join(project, ".studio", "files.json"),
			modelFileText([ROW_A2]),
			"utf8",
		);
		const past = new Date("2001-02-03T04:05:06Z");
		utimesSync(join(project, ".studio", "files.json"), past, past);
		const changed = readFiles(project);
		expect(changed.ok && changed.files.map((entry) => entry.id)).toEqual([
			"cccccccccccc",
		]);
	});

	it("does not let one project see another's register, even with the same size on disk", () => {
		const other = join(base, "Other School");
		mkdirSync(join(other, ".studio"), { recursive: true });
		expect(writeFiles(project, [ROW_A])).toEqual({ ok: true });
		expect(writeFiles(other, [ROW_B])).toEqual({ ok: true });
		const mine = readFiles(project);
		expect(mine.ok && mine.files[0]?.id).toBe("aaaaaaaaaaaa");
		const theirs = readFiles(other);
		expect(theirs.ok && theirs.files[0]?.id).toBe("bbbbbbbbbbbb");
	});

	it("invalidateProject makes the next read parse again, whatever the stat says", () => {
		const files = join(project, ".studio", "files.json");
		expect(writeFiles(project, [ROW_A])).toEqual({ ok: true });
		expect(readFiles(project).ok).toBe(true);
		// A same-length change in the middle, and the same mtime and size the cache holds:
		// the stat cannot tell, which is what invalidateProject is for.
		const before = statSync(files, { bigint: true });
		writeFileSync(files, modelFileText([ROW_A2]), "utf8");
		// Same mtime as before: only invalidation can see this change.
		utimesSync(
			files,
			new Date(Number(before.mtimeNs / 1_000_000n)),
			new Date(Number(before.mtimeNs / 1_000_000n)),
		);
		invalidateProject(project);
		const changed = readFiles(project);
		expect(changed.ok && changed.files.map((entry) => entry.id)).toEqual([
			"cccccccccccc",
		]);
	});

	it("serves the model from memory, and picks up a course changed on disk", () => {
		expect(writeModel(project, MODEL_A)).toEqual({ ok: true });
		const first = readModel(project);
		expect(first.ok && first.model.courses[0]?.units[0].title).toBe(
			"Original title",
		);

		// One character longer: a plain change to a file the cache holds.
		const courseFile = join(project, MODEL_DIR, "grade-7-science-en.json");
		const course = JSON.parse(readFileSync(courseFile, "utf8")) as Record<
			string,
			unknown
		>;
		const unit = (course.units as { title: string }[])[0];
		if (unit === undefined) throw new Error("the course has no unit");
		unit.title = "Original title, longer now";
		writeFileSync(
			courseFile,
			`${JSON.stringify(course, null, "\t")}\n`,
			"utf8",
		);
		const changed = readModel(project);
		expect(changed.ok && changed.model.courses[0]?.units[0].title).toBe(
			"Original title, longer now",
		);
	});

	it("picks up a model file changed beside the cache", () => {
		expect(writeModel(project, MODEL_A)).toEqual({ ok: true });
		expect(readModel(project).ok).toBe(true);
		// A second write with different content, different length.
		expect(writeModel(project, MODEL_B)).toEqual({ ok: true });
		const changed = readModel(project);
		expect(changed.ok && changed.model.courses[0]?.units[0].title).toBe(
			"Changed title by a character",
		);
	});

	it("serves the report from memory, and picks up a new one on disk", () => {
		const reportA = {
			at: "2026-11-13 07:20",
			since: "",
			found: 10,
			read: 10,
			groups: [],
			affected: [],
			look: [],
			copies: [],
			moved: [],
			removed: [],
			tessdataMissing: [],
		};
		// A different size as well as different content: two writes in the same clock tick
		// with the same size look alike to the cache (GitHub's Windows runner, 2026-11-13).
		const reportB = { ...reportA, found: 2000, read: 2000 };
		expect(writeReport(project, reportA)).toEqual({ ok: true });
		expect(readReport(project)?.found).toBe(10);
		writeFileSync(join(project, REPORT_FILE), modelFileText(reportB), "utf8");
		expect(readReport(project)?.found).toBe(2000);
	});

	it("serves the pending pages from memory, and picks up new ones on disk", () => {
		expect(
			writePending(project, [{ id: "abcdef012345", pages: [1, 2] }]),
		).toEqual({
			ok: true,
		});
		expect(readPending(project)).toEqual([
			{ id: "abcdef012345", pages: [1, 2] },
		]);
		writeFileSync(
			join(project, PENDING_FILE),
			modelFileText([{ id: "abcdef012345", pages: [3] }]),
			"utf8",
		);
		expect(readPending(project)).toEqual([{ id: "abcdef012345", pages: [3] }]);
	});
});
