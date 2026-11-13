// The quality test the architect runs (task 158): a units job for one course and period whose
// units the owner already has, so the model's change set can be compared with today's units.
//
//   npm run units-trial -- <project folder> <grade> <subject> <period> --out <folder> --work <folder>
//
// It writes, under <out>/<yyyy-mm-dd-hhmm>/:
//   job/      the same units job folder the Studio prepares, for the author's AI tool;
//   today.json the period's units as they are now, with their facts.
// The job's course.json has the existing facts set aside (removed), so the tool writes facts
// from the notes for the comparison; today.json keeps them, and is not inside the job folder.
//
// A note is read from the project's .studio/notes, and from the work folder's notes/ when the
// project has none. The work folder is a required argument; it is not guessed.
//
// Nothing is copied into the repository: the output folder is the architect's, and the project
// and work folders are only read. No model is called.

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { writeUnitsFolder } from "../src/main/unitfolder.ts";
import { jobNameOf } from "../src/shared/job.ts";
import type { FileRow, ModelCourse, ModelFact } from "../src/shared/model.ts";
import {
	changeName,
	courseJson,
	notedRows,
	notesOrder,
	periodUnits,
	type Target,
	targetRows,
} from "../src/shared/targets.ts";

/** The Studio's own folder: resources. */
const STUDIO = fileURLToPath(new URL("..", import.meta.url));

/** What the trial was asked to do. */
type Trial = { project: string; target: Target; out: string; work: string };

/** The command line, or null with a line the architect can read. */
function parse(args: readonly string[]): Trial | string {
	const rest: string[] = [];
	let out = "";
	let work = "";
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i] ?? "";
		if (arg === "--out") {
			out = args[i + 1] ?? "";
			i += 1;
		} else if (arg === "--work") {
			work = args[i + 1] ?? "";
			i += 1;
		} else if (arg.startsWith("--")) {
			return `unknown option ${arg}`;
		} else {
			rest.push(arg);
		}
	}
	const [project, grade, subject, period] = rest;
	if (
		project === undefined ||
		grade === undefined ||
		subject === undefined ||
		period === undefined ||
		out === "" ||
		work === ""
	)
		return "usage: npm run units-trial -- <project folder> <grade> <subject> <period> --out <folder> --work <folder>";
	const target = { grade: Number(grade), subject, period };
	if (changeName(target) === null)
		return "the grade, subject or period is not one the Studio can name";
	return {
		project,
		target,
		out,
		work,
	};
}

/** A JSON file under the project, or null. */
function json<T>(path: string): T | null {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as T;
	} catch {
		return null;
	}
}

/** The course file the model keeps, as the app wrote it. */
function courseOf(project: string, target: Target): ModelCourse | null {
	return json<ModelCourse>(
		join(
			project,
			".studio",
			"model",
			`grade-${target.grade}-${target.subject}.json`,
		),
	);
}

/** The register the project keeps, with the fields a row from before task 156 leaves out. */
function rowsOf(project: string): FileRow[] {
	const value =
		json<Record<string, unknown>[]>(join(project, ".studio", "files.json")) ??
		[];
	return value.flatMap((row) => {
		if (typeof row.id !== "string" || typeof row.path !== "string") return [];
		return [
			{
				id: row.id,
				path: row.path,
				grade: typeof row.grade === "number" ? row.grade : null,
				subject: typeof row.subject === "string" ? row.subject : "",
				block: typeof row.block === "string" ? row.block : "",
				kind: typeof row.kind === "string" ? row.kind : "",
				pages: typeof row.pages === "number" ? row.pages : null,
				authority: typeof row.authority === "number" ? row.authority : null,
				year: row.year === "current" ? "current" : "old",
				academicYear:
					typeof row.academicYear === "string" ? row.academicYear : "",
				published: typeof row.published === "string" ? row.published : "",
				publishedFrom:
					typeof row.publishedFrom === "string" ? row.publishedFrom : "",
				dupOf: typeof row.dupOf === "string" ? row.dupOf : "",
				imagePages: typeof row.imagePages === "number" ? row.imagePages : 0,
				error: typeof row.error === "string" ? row.error : "",
				firstSeen: typeof row.firstSeen === "string" ? row.firstSeen : "",
				size: typeof row.size === "number" ? row.size : 0,
				mtime: typeof row.mtime === "string" ? row.mtime : "",
				metaDate: typeof row.metaDate === "string" ? row.metaDate : "",
				fixed: Array.isArray(row.fixed) ? (row.fixed as FileRow["fixed"]) : [],
			},
		];
	});
}

/** The notes of the period's files, in the rules' order. */
function notesOf(
	project: string,
	work: string,
	rows: FileRow[],
	target: Target,
): { id: string; text: string }[] {
	const order = notesOrder(
		notedRows(targetRows(rows, target), notedIn(project, work)),
	);
	return order.flatMap((row) => {
		const text = noteText(project, work, row.id);
		return text === null ? [] : [{ id: row.id, text }];
	});
}

/** The notes the project or the work folder keeps, by file id. */
function notedIn(project: string, work: string): Set<string> {
	const found = new Set<string>();
	for (const folder of [
		join(project, ".studio", "notes"),
		join(work, "notes"),
	]) {
		let names: string[] = [];
		try {
			names = readdirSync(folder);
		} catch {
			continue;
		}
		for (const name of names) {
			const match = /^([0-9a-f]{12})\.md$/.exec(name);
			if (match?.[1] !== undefined) found.add(match[1]);
		}
	}
	return found;
}

/** One note's text: the project's own copy first, then the work folder's. */
function noteText(project: string, work: string, id: string): string | null {
	for (const path of [
		join(project, ".studio", "notes", `${id}.md`),
		join(work, "notes", `${id}.md`),
	]) {
		try {
			return readFileSync(path, "utf8");
		} catch {
			// The next place may have it.
		}
	}
	return null;
}

/** The period's units with every lesson's facts set aside. */
function withoutFacts(course: ModelCourse, period: string): ModelCourse {
	return {
		...course,
		units: course.units.map((unit) =>
			unit.period !== period
				? unit
				: {
						...unit,
						lessons: unit.lessons.map((lesson) => ({
							...lesson,
							facts: [],
						})),
					},
		),
	};
}

/** A fact as the trial prints it: its text and the pages it came from. A fact the model file
 * holds as a plain string has no source, and says so. */
function factLine(fact: ModelFact | string): string {
	if (typeof fact === "string") return `      - [no source] ${fact}`;
	const sources = fact.sources ?? [];
	return `      - [${sources.join("; ") || "no source"}] ${fact.text}${fact.own ? " (the author's)" : ""}`;
}

/** A skill's line, with its code when the sheet gives one. */
function skillLine(skill: { code?: string | null; text: string }): string {
	const code =
		skill.code === null || skill.code === undefined ? "" : `${skill.code} `;
	return `    Skill: ${code}${skill.text}`;
}

/** Today's units, printed as the architect compares them. */
function printUnits(course: ModelCourse, period: string): void {
	const units = periodUnits(course, period);
	for (const unit of units) {
		console.log(`Unit ${unit.number}: ${unit.title} (${unit.source})`);
		const keywords = unit.keywords ?? [];
		const evidence = unit.evidence ?? [];
		if (keywords.length > 0) console.log(`  Key words: ${keywords.join(", ")}`);
		if (evidence.length > 0) console.log(`  Evidence: ${evidence.join(" | ")}`);
		for (const lesson of unit.lessons) {
			console.log(`  Lesson ${lesson.number}: ${lesson.title}`);
			for (const skill of lesson.skills ?? []) console.log(skillLine(skill));
			for (const fact of lesson.facts ?? []) console.log(factLine(fact));
		}
	}
}

/** One unit of a change set as the set's JSON has it. */
type ProposedUnit = {
	number: number;
	title: string;
	source: string;
	keywords: string[];
	evidence: string[];
	lessons: {
		number: number;
		title: string;
		skills: { code: string | null; text: string }[];
		facts: { text: string; sources: string[] }[];
	}[];
};

/** The change set the tool wrote for this course, if it is there and readable. */
function proposedOf(
	folder: string,
	target: Target,
): { units: ProposedUnit[]; open: string[] } | null {
	const value = json<{
		units?: ProposedUnit[];
		open?: string[];
	}>(join(folder, "out", `${changeName(target) ?? "course"}.json`));
	if (value === null || !Array.isArray(value.units)) return null;
	return { units: value.units, open: value.open ?? [] };
}

/** The proposed units, printed beside today's. */
function printProposed(proposed: {
	units: ProposedUnit[];
	open: string[];
}): void {
	for (const unit of proposed.units) {
		console.log(`Unit ${unit.number}: ${unit.title} (${unit.source})`);
		const keywords = unit.keywords ?? [];
		const evidence = unit.evidence ?? [];
		if (keywords.length > 0) console.log(`  Key words: ${keywords.join(", ")}`);
		if (evidence.length > 0) console.log(`  Evidence: ${evidence.join(" | ")}`);
		for (const lesson of unit.lessons) {
			console.log(`  Lesson ${lesson.number}: ${lesson.title}`);
			for (const skill of lesson.skills ?? []) console.log(skillLine(skill));
			for (const fact of lesson.facts ?? [])
				console.log(
					`      - [${(fact.sources ?? []).join("; ") || "no source"}] ${fact.text}`,
				);
		}
	}
	for (const question of proposed.open)
		console.log(`  Open question: ${question}`);
}

/** The newest job under <out> whose out/ already holds this course's change set, or null. */
function finishedJob(out: string, target: Target): string | null {
	const file = `${changeName(target) ?? "course"}.json`;
	let names: string[] = [];
	try {
		names = readdirSync(out).sort().reverse();
	} catch {
		return null;
	}
	for (const name of names) {
		const job = join(out, name, "job");
		if (existsSync(join(job, "out", file))) return job;
	}
	return null;
}

function main(): void {
	const parsed = parse(process.argv.slice(2));
	if (typeof parsed === "string") {
		console.error(parsed);
		process.exitCode = 2;
		return;
	}
	const { project, target } = parsed;
	const course = courseOf(project, target);
	if (course === null) {
		console.error(
			`no course file for Grade ${target.grade} ${target.subject} in ${project}`,
		);
		process.exitCode = 2;
		return;
	}
	const units = periodUnits(course, target.period);
	if (units.length === 0) {
		console.error(`${target.period} has no unit in this course`);
		process.exitCode = 2;
		return;
	}
	const rows = rowsOf(project);
	const notes = notesOf(project, parsed.work, rows, target);
	console.log(
		`${basename(project)} · Grade ${target.grade} ${target.subject} · ${target.period}: ${units.length} units, ${notes.length} notes`,
	);

	// A job whose tool has already written this course's change set is shown, not prepared
	// again: that is what "run this again" means (architect, review 1).
	const done = finishedJob(parsed.out, target);
	if (done !== null) {
		console.log(`job folder: ${done}`);
		console.log("\nToday:");
		printUnits(course, target.period);
		const proposed = proposedOf(done, target);
		if (proposed !== null) {
			console.log("\nProposed:");
			printProposed(proposed);
		}
		return;
	}

	const now = new Date();
	let name = jobNameOf(now);
	for (
		let minute = 0;
		minute < 120 && existsSync(join(parsed.out, name));
		minute += 1
	)
		name = jobNameOf(new Date(now.getTime() + minute * 60_000));
	const jobFolder = join(parsed.out, name, "job");
	const rules = readFileSync(
		join(STUDIO, "resources", "rules", "unit-rules.md"),
		"utf8",
	);
	const written = writeUnitsFolder({
		folder: jobFolder,
		curriculum: basename(project),
		rules,
		tool: "claude-code",
		now,
		courses: [
			{
				folder: changeName(target) ?? "course",
				course: withoutFacts(course, target.period),
				period: target.period,
				notes,
			},
		],
	});
	if (!written.ok) {
		console.error(`the job folder was not written: ${written.code}`);
		process.exitCode = 1;
		return;
	}
	// Today's units, with their facts, kept outside the job folder so the tool never sees them.
	mkdirSync(join(parsed.out, name), { recursive: true });
	writeFileSync(
		join(parsed.out, name, "today.json"),
		courseJson(course, target.period),
		"utf8",
	);
	console.log(`job folder: ${jobFolder}`);
	console.log(`today's units: ${join(parsed.out, name, "today.json")}`);
	console.log("\nPaste this into your AI tool:\n");
	console.log(written.prompt);
	console.log("");

	console.log("Today:");
	printUnits(course, target.period);

	const proposed = proposedOf(jobFolder, target);
	if (proposed === null) {
		console.log(
			`\nNo change set yet. When the tool has written ${join(jobFolder, "out", `${changeName(target) ?? "course"}.json`)}, run this again to see it beside today's units.`,
		);
		return;
	}
	console.log("\nProposed:");
	printProposed(proposed);
}

main();
