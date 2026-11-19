// "Build from my book" (task 246): one course's files read and its units proposed in one go.
// With the author's own AI tool it is one job folder in two parts, read/ (a notes job for the
// files with no note yet, written by writeJobFolder) and build/ (a units job for the course's
// periods, written by writeUnitsFolder), collected in that order. With a key it is writeNotes,
// then writeChangeSet for each period, under one spending limit. Nothing here copies the notes
// or units code: it decides what goes in, and calls theirs.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Failure } from "../shared/api.ts";
import { bookPrompt, bookReadme, laterNote } from "../shared/book.ts";
import {
	type JobRecord,
	type JobTool,
	jobToday,
	validJobName,
} from "../shared/job.ts";
import {
	type CurriculumModel,
	emptyCourse,
	type FileRow,
} from "../shared/model.ts";
import {
	changeName,
	notesOrder,
	type Target,
	targetRows,
} from "../shared/targets.ts";
import { rowPeriodIds, yearIsSplit } from "../shared/terms.ts";
import {
	collectUnitsFrom,
	targetCourse,
	type UnitsCollected,
} from "./changes.ts";
import { safePath } from "./files.ts";
import {
	type CollectOutcome,
	collectNotesFrom,
	freeJobName,
	JOBS_DIR,
	jobRecord,
	realFolder,
} from "./job.ts";
import { writeJobFolder } from "./jobfolder.ts";
import { readTextFile } from "./model.ts";
import { noteIds, readNote, writeNotes } from "./notes.ts";
import type { AskNotes } from "./openrouter.ts";
import { writeUnitsFolder } from "./unitfolder.ts";
import { writeChangeSet } from "./units.ts";

const failure = (code: Failure["code"], detail?: string): Failure => ({
	ok: false,
	code,
	...(detail === undefined ? {} : { detail }),
});

/** A course: grade, subject and teaching language. */
export type BookCourse = { grade: number; subject: string; language: string };

/** What a build would use: the course's files, those still to read, and its periods. */
export type BookShape = {
	rows: FileRow[];
	toRead: FileRow[];
	targets: Target[];
	/** Files left out because the year is split and they have no term (task 249). */
	noTerm: number;
};

/**
 * The course's readable files (not copies, not broken, with pages), the ones without a note,
 * and the periods its files are for. `allowed` turns a period into a target the model accepts.
 */
export function bookShape(
	model: CurriculumModel,
	rows: readonly FileRow[],
	course: BookCourse,
	noted: ReadonlySet<string>,
	allowed: (period: string) => Target | null,
): BookShape {
	const periods = model.curriculum.periods;
	const split = yearIsSplit(periods);
	const used: FileRow[] = [];
	const targets = new Map<string, Target>();
	let noTerm = 0;
	for (const row of rows) {
		if (
			row.grade !== course.grade ||
			row.subject !== course.subject ||
			row.language !== course.language ||
			row.dupOf !== "" ||
			row.error !== "" ||
			(row.pages ?? 0) === 0
		)
			continue;
		const ids = rowPeriodIds(row.block, periods);
		if (ids.length === 0) {
			if (split) noTerm += 1;
			continue;
		}
		used.push(row);
		for (const id of ids) {
			const target = allowed(id);
			const key = target === null ? null : changeName(target);
			if (target !== null && key !== null && !targets.has(key))
				targets.set(key, target);
		}
	}
	return {
		rows: used,
		toRead: used.filter((row) => !noted.has(row.id)),
		targets: [...targets.values()],
		noTerm,
	};
}

/** A prepared book job: the folder, the message to give the tool, and what it holds. */
export type BookMade = {
	ok: true;
	name: string;
	path: string;
	prompt: string;
	files: number;
	notes: number;
	periods: number;
};

/** What preparing a book job needs. */
export type PrepareBookInput = {
	root: string;
	model: CurriculumModel;
	rows: readonly FileRow[];
	course: BookCourse;
	allowed: (period: string) => Target | null;
	curriculum: string;
	noteRules: string;
	unitRules: string;
	tool: JobTool;
	now: Date;
	noted?: ReadonlySet<string>;
	text?: (id: string) => string;
	page?: (id: string, page: number) => Uint8Array | null;
};

/** Writes one job folder for a course: read/ for the notes still to write, build/ for its units. */
export function prepareBookJob(input: PrepareBookInput): BookMade | Failure {
	const noted = input.noted ?? noteIds(input.root);
	const shape = bookShape(
		input.model,
		input.rows,
		input.course,
		noted,
		input.allowed,
	);
	if (shape.targets.length === 0)
		return failure("missing", "no file of this course names a period");
	const name = freeJobName(input.root, input.now);
	if (name === null) return failure("unreadable");
	const folder = safePath(input.root, `${JOBS_DIR}/${name}`);
	if (folder === null) return failure("outside");
	mkdirSync(folder, { recursive: true });

	if (shape.toRead.length > 0) {
		const read = writeJobFolder({
			folder: join(folder, "read"),
			rows: shape.toRead,
			curriculum: input.curriculum,
			rules: input.noteRules,
			tool: input.tool,
			now: input.now,
			text: input.text ?? ((id) => readTextFile(input.root, id)),
			page: input.page ?? (() => null),
		});
		if (!read.ok) return failure(read.code);
	}

	const periods = input.model.curriculum.periods;
	const courses = shape.targets.flatMap((target) => {
		const course =
			targetCourse(input.model, target) ??
			emptyCourse(target.grade, target.subject, target.language);
		const courseFolder = changeName(target);
		if (courseFolder === null) return [];
		const notes = notesOrder(targetRows(shape.rows, target, periods)).map(
			(row) => ({
				id: row.id,
				text: noted.has(row.id)
					? readNote(input.root, row.id)
					: laterNote(row.id),
			}),
		);
		return notes.length === 0
			? []
			: [{ folder: courseFolder, course, period: target.period, notes }];
	});
	const build = writeUnitsFolder({
		folder: join(folder, "build"),
		curriculum: input.curriculum,
		rules: input.unitRules,
		tool: input.tool,
		now: input.now,
		courses,
	});
	if (!build.ok) return failure(build.code);

	const record: JobRecord = {
		name,
		created: jobToday(input.now),
		tool: input.tool,
		kind: "book",
		ids: shape.rows.map((row) => row.id),
		courses: [],
		exams: [],
	};
	try {
		writeFileSync(
			join(folder, "job.json"),
			`${JSON.stringify(record, null, "\t")}\n`,
			"utf8",
		);
		writeFileSync(
			join(folder, "README.md"),
			bookReadme(
				input.tool,
				input.curriculum,
				shape.toRead.length,
				courses.length,
			),
			"utf8",
		);
	} catch {
		return failure("unreadable");
	}
	return {
		ok: true,
		name,
		path: folder,
		prompt: bookPrompt(folder),
		files: shape.rows.length,
		notes: shape.toRead.length,
		periods: courses.length,
	};
}

/** What collecting a book job kept: the notes first, then the change sets. */
export type BookCollected = {
	ok: true;
	notes: CollectOutcome;
	units: UnitsCollected;
};

/**
 * Collects a book job: the notes from read/out/ first (so the change sets can be checked
 * against them), then the change sets from build/out/, whose sources may only name the files
 * the job carried.
 */
export function collectBookJob(input: {
	root: string;
	model: CurriculumModel;
	files: readonly FileRow[];
	name: string;
	today: Date;
}): BookCollected | Failure {
	const name = validJobName(input.name);
	if (name === null) return failure("invalidName");
	const folder = safePath(input.root, `${JOBS_DIR}/${name}`);
	if (folder === null) return failure("outside");
	if (!realFolder(folder)) return failure("missing");
	const record = jobRecord(folder);
	if (record?.kind !== "book") return failure("invalidName");

	let notes: CollectOutcome = { collected: [], skipped: [], refused: [] };
	const read = join(folder, "read");
	if (existsSync(read)) {
		if (!realFolder(read) || !realFolder(join(read, "out")))
			return failure("unreadable");
		const got = collectNotesFrom(input.root, read, input.today);
		if ("ok" in got) return got;
		notes = got;
	}

	const build = join(folder, "build");
	if (!realFolder(build) || !realFolder(join(build, "out")))
		return failure("unreadable");
	const carried = new Set(record.ids);
	const units = collectUnitsFrom({
		root: input.root,
		model: input.model,
		files: input.files.filter((row) => carried.has(row.id)),
		name,
		today: input.today,
		folder: build,
		strictSources: true,
	});
	if ("ok" in units) return units;
	return { ok: true, notes, units };
}

/** One stage of a build with a key, for the progress line. */
export type BookStage =
	| { stage: "notes"; done: number; total: number }
	| { stage: "units"; done: number; total: number };

/** What a build with a key gave. */
export type BookBuilt = {
	ok: true;
	notesWritten: number;
	notesFailed: number;
	sets: number;
	failed: { period: string; code: Failure["code"] }[];
	spentUsd: number;
	/** True when the spending limit stopped the build before its end. */
	stopped: boolean;
};

/** What a build with a key needs. */
export type BuildWithKeyInput = {
	root: string;
	model: CurriculumModel;
	rows: readonly FileRow[];
	course: BookCourse;
	allowed: (period: string) => Target | null;
	curriculum: string;
	noteRules: string;
	unitRules: string;
	key: string;
	notes: {
		model: string;
		limit: number;
		priceIn: number | null;
		priceOut: number | null;
		images: boolean;
	};
	units: {
		model: string;
		limit: number;
		priceIn: number | null;
		priceOut: number | null;
	};
	today: Date;
	onStage?: (stage: BookStage) => void;
	/** A test passes its own; the app gets the real OpenRouter request. */
	ask?: AskNotes;
};

/**
 * Writes the missing notes, then a change set for each period, with the author's key. One
 * spending limit covers the whole build: the larger of the two steps' limits, with each step
 * also held to its own. What the notes spent is no longer there for the units.
 */
export async function buildWithKey(
	input: BuildWithKeyInput,
): Promise<BookBuilt> {
	const noted = noteIds(input.root);
	const shape = bookShape(
		input.model,
		input.rows,
		input.course,
		noted,
		input.allowed,
	);
	const budget = Math.max(input.notes.limit, input.units.limit);
	const built: BookBuilt = {
		ok: true,
		notesWritten: 0,
		notesFailed: 0,
		sets: 0,
		failed: [],
		spentUsd: 0,
		stopped: false,
	};
	if (shape.toRead.length > 0) {
		const total = shape.toRead.length;
		input.onStage?.({ stage: "notes", done: 0, total });
		const written = await writeNotes({
			root: input.root,
			rows: input.rows,
			ids: shape.toRead.map((row) => row.id),
			curriculum: input.curriculum,
			model: input.notes.model,
			key: input.key,
			rules: input.noteRules,
			priceIn: input.notes.priceIn,
			priceOut: input.notes.priceOut,
			limitUsd: Math.min(input.notes.limit, budget),
			today: input.today,
			images: input.notes.images,
			ask: input.ask,
			onProgress: (done) => input.onStage?.({ stage: "notes", done, total }),
		});
		built.notesWritten = written.written.length;
		built.notesFailed = written.failed.length;
		built.spentUsd += written.spentUsd;
		if (written.stopped) {
			built.stopped = true;
			return built;
		}
	}
	const total = shape.targets.length;
	for (const [index, target] of shape.targets.entries()) {
		input.onStage?.({ stage: "units", done: index, total });
		const left = Math.min(input.units.limit, budget - built.spentUsd);
		if (left <= 0) {
			built.stopped = true;
			break;
		}
		const written = await writeChangeSet({
			root: input.root,
			model: input.model,
			rows: input.rows,
			target,
			rules: input.unitRules,
			key: input.key,
			modelName: input.units.model,
			priceIn: input.units.priceIn,
			priceOut: input.units.priceOut,
			limitUsd: left,
			today: input.today,
			ask: input.ask,
		});
		if (written.ok) {
			built.sets += 1;
			built.spentUsd += written.spentUsd;
		} else {
			built.failed.push({ period: target.period, code: written.code });
			if (written.code === "limit") {
				built.stopped = true;
				break;
			}
		}
	}
	input.onStage?.({ stage: "units", done: total, total });
	return built;
}
