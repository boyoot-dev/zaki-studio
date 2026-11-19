// One teacher's request to the AI (task 248), the three ways. Each is the units step for one
// course period, cut down to the one unit: the course carries only that unit, the notes (or
// pages) only of the files its facts name, and the rules end with the teacher's request. The
// answer is an ordinary change set, refused when it reaches outside the unit, and kept with the
// request so Review can show "You asked: …".

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Failure } from "../shared/api.ts";
import type { JobTool } from "../shared/job.ts";
import type { CurriculumModel, FileRow, ModelCourse } from "../shared/model.ts";
import { sameCourse } from "../shared/model.ts";
import {
	requestCourse,
	requestRule,
	requestScope,
	type UnitRequest,
	unitSourceIds,
} from "../shared/request.ts";
import { answerJson, pagesOf } from "../shared/rounds.ts";
import {
	CHANGE_FORMAT,
	changeName,
	courseJson,
	notesOrder,
	type Target,
	targetRows,
} from "../shared/targets.ts";
import { saveChangeSet, targetCourse } from "./changes.ts";
import { safePath } from "./files.ts";
import { freeJobName, JOBS_DIR } from "./job.ts";
import { readTextFile } from "./model.ts";
import { readNote } from "./notes.ts";
import { writeUnitsFolder } from "./unitfolder.ts";

const failure = (code: Failure["code"], detail?: string): Failure => ({
	ok: false,
	code,
	...(detail === undefined ? {} : { detail }),
});

/** Everything a request is answered from: the target, the cut-down model and its files. */
export type RequestContext = {
	target: Target;
	/** The model with the course cut down to the one unit. */
	model: CurriculumModel;
	course: ModelCourse;
	/** The files the unit's facts name, or the period's files when they name none. */
	rows: FileRow[];
	/** The unit rules with the teacher's request at the end. */
	rules: string;
};

/** The context of a request, or why it can't be answered (the unit is not there). */
export function requestContext(
	model: CurriculumModel,
	rows: readonly FileRow[],
	request: UnitRequest,
	unitRules: string,
): RequestContext | Failure {
	const target: Target = {
		grade: request.grade,
		subject: request.subject,
		language: request.language,
		period: request.period,
	};
	const full = targetCourse(model, target);
	const unit = full?.units.find(
		(entry) => entry.number === request.unit && entry.period === request.period,
	);
	if (full === null || unit === undefined)
		return failure("missing", "that unit is not there any more");
	const course = requestCourse(full, request.unit);
	const named = new Set(unitSourceIds(unit));
	const periodRows = targetRows(rows, target, model.curriculum.periods);
	const used =
		named.size === 0 ? periodRows : rows.filter((row) => named.has(row.id));
	return {
		target,
		model: {
			...model,
			courses: model.courses.map((entry) =>
				sameCourse(entry, target) ? course : entry,
			),
		},
		course,
		rows: notesOrder(used),
		rules: `${unitRules.trimEnd()}\n\n${requestRule(request)}\n`,
	};
}

/** A prepared request job: the folder and the message for the tool. */
export type RequestJobMade = {
	ok: true;
	name: string;
	path: string;
	prompt: string;
};

/** Writes a units job for one request: one course folder with the one unit, and request.json. */
export function prepareRequestJob(input: {
	root: string;
	context: RequestContext;
	request: UnitRequest;
	curriculum: string;
	tool: JobTool;
	now: Date;
}): RequestJobMade | Failure {
	const folderName = changeName(input.context.target);
	if (folderName === null) return failure("invalidName");
	const notes = input.context.rows.flatMap((row) => {
		const text = readNote(input.root, row.id);
		return text === "" ? [] : [{ id: row.id, text }];
	});
	if (notes.length === 0)
		return failure("missing", "the unit's files have no notes yet");
	const name = freeJobName(input.root, input.now);
	if (name === null) return failure("unreadable");
	const folder = safePath(input.root, `${JOBS_DIR}/${name}`);
	if (folder === null) return failure("outside");
	const written = writeUnitsFolder({
		folder,
		curriculum: input.curriculum,
		rules: input.context.rules,
		tool: input.tool,
		now: input.now,
		courses: [
			{
				folder: folderName,
				course: input.context.course,
				period: input.context.target.period,
				notes,
			},
		],
	});
	if (!written.ok) return failure(written.code);
	try {
		writeFileSync(
			join(folder, "request.json"),
			`${JSON.stringify({ unit: input.request.unit, lesson: input.request.lesson, text: input.request.text }, null, "\t")}\n`,
			"utf8",
		);
	} catch {
		return failure("unreadable");
	}
	return { ok: true, name, path: written.path, prompt: written.prompt };
}

/** The pages a unit's facts cite, per file, as page numbers in order. */
function citedPages(course: ModelCourse): Map<string, number[]> {
	const pages = new Map<string, Set<number>>();
	for (const unit of course.units)
		for (const lesson of unit.lessons)
			for (const fact of lesson.facts)
				for (const source of fact.sources) {
					const match = /^([0-9a-f]{12})#p(\d+)(?:-(\d+))?$/.exec(source);
					if (match === null) continue;
					const from = Number(match[2]);
					const to = Number(match[3] ?? match[2]);
					const set = pages.get(match[1] ?? "") ?? new Set<number>();
					for (let page = from; page <= to && page - from < 200; page += 1)
						set.add(page);
					pages.set(match[1] ?? "", set);
				}
	return new Map(
		[...pages].map(([id, set]) => [id, [...set].sort((a, b) => a - b)]),
	);
}

/** The browser way's one round: an upload file in a job folder, and the message to copy. */
export function requestUpload(input: {
	root: string;
	context: RequestContext;
	request: UnitRequest;
	now: Date;
}): { ok: true; path: string; message: string } | Failure {
	const name = freeJobName(input.root, input.now);
	if (name === null) return failure("unreadable");
	const folder = safePath(input.root, `${JOBS_DIR}/${name}`);
	if (folder === null) return failure("outside");
	const cited = citedPages(input.context.course);
	const pages = input.context.rows
		.map((row) => {
			const text = readTextFile(input.root, row.id);
			const wanted = cited.get(row.id);
			const body =
				wanted === undefined || wanted.length === 0
					? text.replace(/^# .*\n/, "")
					: wanted
							.map((page) => pagesOf(text, page, page))
							.filter((part) => part !== "")
							.join("\n\n");
			return `# ${row.id} ${row.path}\n\n${body}`;
		})
		.join("\n\n");
	const target = input.context.target;
	const body = `Course: grade ${target.grade}, subject "${target.subject}", language "${target.language}", period "${target.period}".

# rules.md

${input.context.rules.trim()}

# The change set's format

${CHANGE_FORMAT}

# The unit as it is now

${courseJson(input.context.course, target.period)}

# Its pages

${pages}
`;
	const path = join(folder, "request.md");
	try {
		mkdirSync(folder, { recursive: true });
		writeFileSync(
			join(folder, "job.json"),
			`${JSON.stringify({ name, kind: "rounds", tool: "other", ids: input.context.rows.map((row) => row.id) }, null, "\t")}\n`,
			"utf8",
		);
		writeFileSync(path, body, "utf8");
	} catch {
		return failure("unreadable");
	}
	return {
		ok: true,
		path,
		message: `The file I uploaded holds the rules, the format, one unit as it is now and its pages. The teacher's request is at the end of the rules: "${input.request.text}"

Answer with one change set as JSON only, for unit ${input.request.unit} alone, in the course's language (${target.language}).`,
	};
}

/** Checks a pasted answer to a request and keeps it for review, or says what is wrong. */
export function answerRequest(input: {
	root: string;
	model: CurriculumModel;
	rows: readonly FileRow[];
	request: UnitRequest;
	text: string;
	today: Date;
}): { ok: true } | { ok: false; issue: string } {
	const value = answerJson(input.text);
	if (value === null)
		return {
			ok: false,
			issue:
				"The answer has no JSON. Copy the whole answer from the chat, or ask the chat to answer with JSON only.",
		};
	const outside = requestScope(value, input.request.unit);
	if (outside !== null) return { ok: false, issue: outside };
	const saved = saveChangeSet(
		input.root,
		input.model,
		input.rows,
		{
			grade: input.request.grade,
			subject: input.request.subject,
			language: input.request.language,
			period: input.request.period,
		},
		value,
		"job",
		"Claude or Gemini in the browser",
		input.today,
		input.request.text,
	);
	if (!saved.ok)
		return {
			ok: false,
			issue: `The answer was refused: ${saved.detail ?? "it is not a change set this project can review"}.`,
		};
	return { ok: true };
}
