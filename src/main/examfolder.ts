// The exams job folder itself (task 177): README.md, rules.md, one folder per course under
// courses/ (course.json with its exams, notes/ in priority order) and an empty out/. Built like
// src/main/unitfolder.ts and importing nothing from the app, so a trial can write the very same
// folder under plain Node.
//
// Nothing here decides where the folder is: the app builds it under .studio/jobs through
// safePath, and a trial script would name its own outside the repository.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
	EXAM_FORMAT,
	EXAM_FORMAT_NOTE,
	examCourseJson,
	examPeriodList,
} from "../shared/exam-changes.ts";
import type { BundlePeriod } from "../shared/format/bundle.ts";
import {
	type ExamsJobCourse,
	examsPrompt,
	examsReadme,
	type JobRecord,
	type JobTool,
	jobToday,
} from "../shared/job.ts";
import type { ModelCourse } from "../shared/model.ts";
import type { ExamNote } from "./exams.ts";

/** One course folder of an exams job: the course, and the notes it was read from. */
export type ExamsFolderCourse = {
	/** The folder under courses/, "9-arabic": made with the course's own name. */
	folder: string;
	course: ModelCourse;
	/** The notes in priority order, newest academic year first. */
	notes: readonly ExamNote[];
};

/** Everything an exams job folder is written from. */
export type ExamsFolderInput = {
	/** The folder to write; it may already exist. */
	folder: string;
	curriculum: string;
	/** The Studio's copy of exam-rules.md, unchanged. */
	rules: string;
	tool: JobTool;
	now: Date;
	/** The year's periods, which the README lists by id (task 182). */
	periods: readonly BundlePeriod[];
	courses: readonly ExamsFolderCourse[];
};

/** What was written, or why nothing was. */
export type ExamsFolderResult =
	| {
			ok: true;
			name: string;
			path: string;
			prompt: string;
			files: number;
			/** The courses as the README lists them. */
			courses: ExamsJobCourse[];
	  }
	| { ok: false; code: "missing" | "unreadable" };

/** A folder name this writer may make: one course's name, and nothing that could leave. */
function safeFolder(name: string): boolean {
	return /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(name);
}

/** One note's file name in a course folder: "01-9a010f4b4816.md". */
function noteName(index: number, id: string): string {
	return `${String(index + 1).padStart(2, "0")}-${id}.md`;
}

/**
 * Writes an exams job folder: one course folder with its course.json and exam notes, an empty
 * out/, rules.md, README.md and the job's own record. A job with no course refuses.
 */
export function writeExamsFolder(input: ExamsFolderInput): ExamsFolderResult {
	if (input.courses.length === 0) return { ok: false, code: "missing" };
	if (input.courses.some((course) => !safeFolder(course.folder)))
		return { ok: false, code: "unreadable" };
	const name = basename(input.folder);
	try {
		mkdirSync(join(input.folder, "out"), { recursive: true });
		writeFileSync(join(input.folder, "rules.md"), input.rules, "utf8");
		const lines: ExamsJobCourse[] = [];
		for (const entry of input.courses) {
			const folder = join(input.folder, "courses", entry.folder);
			mkdirSync(join(folder, "notes"), { recursive: true });
			writeFileSync(
				join(folder, "course.json"),
				examCourseJson(entry.course),
				"utf8",
			);
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
				exams: entry.course.exams.length,
				notes: entry.notes.length,
			});
		}
		const record: JobRecord = {
			name,
			created: jobToday(input.now),
			tool: input.tool,
			kind: "exams",
			ids: lines.map((line) => line.folder),
			courses: [],
			exams: lines,
		};
		writeFileSync(
			join(input.folder, "job.json"),
			`${JSON.stringify(record, null, "\t")}\n`,
			"utf8",
		);
		writeFileSync(
			join(input.folder, "README.md"),
			examsReadme(
				input.tool,
				input.curriculum,
				lines,
				`${EXAM_FORMAT}\n\n${EXAM_FORMAT_NOTE}`,
				examPeriodList(input.periods),
			),
			"utf8",
		);
		if (!existsSync(join(input.folder, "out")))
			mkdirSync(join(input.folder, "out"));
		return {
			ok: true,
			name,
			path: input.folder,
			prompt: examsPrompt(input.folder, input.tool),
			files: lines.length,
			courses: lines,
		};
	} catch {
		return { ok: false, code: "unreadable" };
	}
}
