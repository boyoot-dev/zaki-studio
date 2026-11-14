// The units job folder itself (task 158): README.md, rules.md, one folder per course and period
// under courses/ (course.json, period.txt, notes/ in priority order) and an empty out/. Kept
// apart from src/main/changes.ts and importing nothing from the app, so the units trial can
// write the very same folder under plain Node, as the notes trial does (2026-11-13).
//
// Nothing here decides where the folder is: the app builds it under .studio/jobs through
// safePath, and the trial script names its own outside the repository.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import {
	type JobRecord,
	type JobTool,
	jobToday,
	type UnitsJobCourse,
	unitsPrompt,
	unitsReadme,
} from "../shared/job.ts";
import type { ModelCourse } from "../shared/model.ts";
import {
	CHANGE_FORMAT,
	courseJson,
	type TargetNote,
} from "../shared/targets.ts";

/** One course folder of a units job: the course, its period, and that period's notes. */
export type UnitsFolderCourse = {
	/** The folder under courses/, "7-science-block-3": made with the target's own name. */
	folder: string;
	course: ModelCourse;
	period: string;
	/** The notes in priority order, as the rules give them. */
	notes: readonly TargetNote[];
};

/** Everything a units job folder is written from. */
export type UnitsFolderInput = {
	/** The folder to write; it may already exist. */
	folder: string;
	curriculum: string;
	/** The Studio's copy of unit-rules.md, unchanged. */
	rules: string;
	tool: JobTool;
	now: Date;
	courses: readonly UnitsFolderCourse[];
};

/** What was written, or why nothing was. */
export type UnitsFolderResult =
	| {
			ok: true;
			name: string;
			path: string;
			prompt: string;
			files: number;
			/** The courses as the README lists them. */
			courses: UnitsJobCourse[];
	  }
	| { ok: false; code: "missing" | "unreadable" };

/** A folder name this writer may make: one target's name, and nothing that could leave. */
function safeFolder(name: string): boolean {
	return /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(name);
}

/** One note's file name in a course folder: "01-9a010f4b4816.md". */
function noteName(index: number, id: string): string {
	return `${String(index + 1).padStart(2, "0")}-${id}.md`;
}

/**
 * Writes a units job folder: one course folder with its course.json, period.txt and notes, an
 * empty out/, rules.md, README.md and the job's own record. A job with no course refuses.
 */
export function writeUnitsFolder(input: UnitsFolderInput): UnitsFolderResult {
	if (input.courses.length === 0) return { ok: false, code: "missing" };
	if (input.courses.some((course) => !safeFolder(course.folder)))
		return { ok: false, code: "unreadable" };
	const name = basename(input.folder);
	try {
		mkdirSync(join(input.folder, "out"), { recursive: true });
		writeFileSync(join(input.folder, "rules.md"), input.rules, "utf8");
		const lines: UnitsJobCourse[] = [];
		for (const entry of input.courses) {
			const folder = join(input.folder, "courses", entry.folder);
			mkdirSync(join(folder, "notes"), { recursive: true });
			writeFileSync(
				join(folder, "course.json"),
				courseJson(entry.course, entry.period),
				"utf8",
			);
			writeFileSync(join(folder, "period.txt"), `${entry.period}\n`, "utf8");
			for (const [index, note] of entry.notes.entries()) {
				if (!/^[0-9a-f]{12}$/.test(note.id)) continue;
				writeFileSync(
					join(folder, "notes", noteName(index, note.id)),
					`${note.text.trimEnd()}\n`,
					"utf8",
				);
			}
			lines.push({
				folder: entry.folder,
				grade: entry.course.grade,
				subject: entry.course.subject,
				period: entry.period,
				units: entry.course.units.filter((unit) => unit.period === entry.period)
					.length,
				notes: entry.notes.length,
			});
		}
		const record: JobRecord = {
			name,
			created: jobToday(input.now),
			tool: input.tool,
			kind: "units",
			ids: lines.map((line) => line.folder),
			courses: lines,
			exams: [],
		};
		writeFileSync(
			join(input.folder, "job.json"),
			`${JSON.stringify(record, null, "\t")}\n`,
			"utf8",
		);
		writeFileSync(
			join(input.folder, "README.md"),
			unitsReadme(input.tool, input.curriculum, lines, CHANGE_FORMAT),
			"utf8",
		);
		if (!existsSync(join(input.folder, "out")))
			mkdirSync(join(input.folder, "out"));
		return {
			ok: true,
			name,
			path: input.folder,
			prompt: unitsPrompt(input.folder, input.tool),
			files: lines.length,
			courses: lines,
		};
	} catch {
		return { ok: false, code: "unreadable" };
	}
}
