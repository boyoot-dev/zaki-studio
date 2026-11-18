// Adopting an existing curriculum (task 153): the author picks the materials folder
// (`resources/<curriculum>/`), the Studio finds the work folder beside it (`../_work`) and
// asks for the built-in curriculum folder (`app/content/curriculum/<id>/`), then writes only
// `curriculum.json` and `.studio/` into the materials folder. Nothing is moved, renamed or
// re-read, and the work and curriculum folders are read only: they are never written here.
//
// A second adoption of the same folder finds a project and opens it instead.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
	type AdoptInput,
	courseFromFile,
	headerFromFile,
	planAdopt,
	readIndex,
	readSubjectFolders,
	registerRows,
} from "../shared/adopt.ts";
import type { Failure } from "../shared/api.ts";
import type { CurriculumModel, ModelCourse } from "../shared/model.ts";
import type { Project } from "../shared/project.ts";
import { readProject, writeProject } from "./files.ts";
import { copyTexts, writeFiles, writeModel } from "./model.ts";
import { copyNotes } from "./notes.ts";

const failure = (code: Failure["code"], detail?: string): Failure => ({
	ok: false,
	code,
	...(detail === undefined ? {} : { detail }),
});

/** What adopting did: the project now in the materials folder, and whether it was already one. */
export type AdoptOutcome =
	| { ok: true; project: Project; already: boolean }
	| Failure;

/** Reads the built-in curriculum folder: its curriculum.json and every course file. */
function readCurriculum(
	folder: string,
	curriculumId: string,
):
	| { ok: true; header: CurriculumModel["curriculum"]; courses: ModelCourse[] }
	| Failure {
	const defFile = join(folder, "curriculum.json");
	if (!existsSync(defFile))
		return failure("missing", `${defFile} is not there`);
	const def = headerFromFile(readJson(defFile), "curriculum.json");
	if (!def.ok)
		return failure(
			"invalidProject",
			`${def.issues[0]?.path ?? "curriculum.json"}: ${def.issues[0]?.message ?? "invalid"}`,
		);
	const courses: ModelCourse[] = [];
	for (const name of readdirSync(folder).sort()) {
		if (!name.endsWith(".json") || name === "curriculum.json") continue;
		const parsed = courseFromFile(
			readJson(join(folder, name)),
			curriculumId,
			name,
		);
		if (!parsed.ok)
			return failure(
				"invalidProject",
				`${parsed.issues[0]?.path ?? name}: ${parsed.issues[0]?.message ?? "invalid"}`,
			);
		courses.push(parsed.course);
	}
	if (courses.length === 0)
		return failure("invalidProject", `${folder} has no course files`);
	return { ok: true, header: def.header, courses };
}

/** A JSON file's value, or undefined when it can't be read; the caller reports the failure. */
function readJson(path: string): unknown {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as unknown;
	} catch {
		return undefined;
	}
}

/**
 * Turns the three folders into one project: the built-in files give the curriculum, the
 * register names every file and its pages, and the work folder's text is copied into the
 * project. Only `curriculum.json` and `.studio/` are written, both in the materials folder.
 */
export function adoptMaterial(
	materials: string,
	work: string,
	curriculum: string,
	id: string,
): AdoptOutcome {
	const existing = readProject(materials);
	if (existing.ok)
		return { ok: true, project: existing.project, already: true };
	if (existing.code !== "missing") return existing;

	const curriculumId = basename(materials);
	const indexFile = join(work, "index.csv");
	if (!existsSync(indexFile))
		return failure("noWork", `${indexFile} is not there`);
	let indexText: string;
	try {
		indexText = readFileSync(indexFile, "utf8");
	} catch {
		return failure("unreadable", indexFile);
	}
	const register = registerRows(readIndex(indexText), curriculumId);
	if (register.length === 0)
		return failure("noWork", `no row of ${indexFile} is for ${curriculumId}`);

	const subjectFile = join(materials, "_subjects.csv");
	let subjectFolders: { folder: string; subject: string; language: string }[] =
		[];
	if (existsSync(subjectFile)) {
		try {
			subjectFolders = readSubjectFolders(readFileSync(subjectFile, "utf8"));
		} catch {
			return failure("unreadable", subjectFile);
		}
	}

	const read = readCurriculum(curriculum, curriculumId);
	if (!read.ok) return read;

	const input: AdoptInput = {
		id,
		curriculumId,
		header: read.header,
		courses: read.courses,
		register,
		subjectFolders,
	};
	const plan = planAdopt(input);
	if (!plan.ok)
		return failure(
			"invalidProject",
			`${plan.issues[0]?.path ?? ""}: ${plan.issues[0]?.message ?? "the curriculum can't be adopted"}`,
		);

	// From here on the only writes: the project file and .studio/ in the materials folder.
	const project = writeProject(materials, plan.plan.project);
	if (!project.ok) return project;
	const model = writeModel(materials, plan.plan.model);
	if (!model.ok) return model;
	const files = writeFiles(materials, register);
	if (!files.ok) return files;
	const texts = copyTexts(
		materials,
		work,
		register.map((row) => row.id),
	);
	if (!texts.ok) return texts;
	// Notes the pipeline already wrote are copied, so nothing is written a second time.
	copyNotes(
		materials,
		join(work, "notes"),
		register.map((row) => row.id),
	);
	return { ok: true, project: plan.plan.project, already: false };
}
