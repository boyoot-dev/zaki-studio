// The quality test the architect runs (task 157): notes for a few files of the owner's own
// material, three ways, into a folder outside the repository.
//
//   npm run notes-trial -- <materials folder> <work folder> <ids…> --out <folder>
//                          [--key] [--model <id>]
//
// It writes, under <out>/<yyyy-mm-dd-hhmm>/:
//   job/       the same job folder the Studio prepares, to run the job-folder way;
//   existing/  the note the pipeline already wrote (<work>/notes/<id>.md), beside it;
//   key/       with --key, the note the Studio wrote, for the same file.
//
// No school material is copied into the repository: the output folder is the architect's,
// and the material is only read. Without --key it calls no model at all.

import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { writeJobFolder } from "../src/main/jobfolder.ts";
import { oneNote } from "../src/main/onenote.ts";
import { askOpenRouter, modelInfo } from "../src/main/openrouter.ts";
import { jobNameOf } from "../src/shared/job.ts";
import type { FileRow } from "../src/shared/model.ts";
import {
	cost,
	DEFAULT_MODEL,
	estimateRun,
	isoDay,
} from "../src/shared/notes.ts";
import { readIndex, registerRows } from "../src/shared/register.ts";

/** The Studio's own folder: node_modules and resources. */
const STUDIO = fileURLToPath(new URL("..", import.meta.url));

/** What the trial was asked to do. */
type Trial = {
	materials: string;
	work: string;
	ids: string[];
	out: string;
	key: boolean;
	model: string;
};

/** The command line, or null with a line the architect can read. */
function parse(args: readonly string[]): Trial | string {
	const rest: string[] = [];
	let out = "";
	let key = false;
	let model = DEFAULT_MODEL;
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i] ?? "";
		if (arg === "--key") {
			key = true;
		} else if (arg === "--out") {
			out = args[i + 1] ?? "";
			i += 1;
		} else if (arg === "--model") {
			model = args[i + 1] ?? DEFAULT_MODEL;
			i += 1;
		} else if (arg.startsWith("--")) {
			return `unknown option ${arg}`;
		} else {
			rest.push(arg);
		}
	}
	const [materials, work] = rest;
	const ids = rest.slice(2);
	if (
		materials === undefined ||
		work === undefined ||
		ids.length === 0 ||
		out === ""
	)
		return "usage: npm run notes-trial -- <materials folder> <work folder> <ids…> --out <folder> [--key] [--model <id>]";
	return {
		materials,
		work,
		ids,
		out,
		key,
		model,
	};
}

/** One file's text from the work folder, or "". */
function workText(work: string, id: string): string {
	try {
		return readFileSync(join(work, "text", `${id}.md`), "utf8");
	} catch {
		return "";
	}
}

/** One picture page from the work folder, or null. */
function workPage(work: string, id: string, page: number): Uint8Array | null {
	const path = join(work, "pages", id, `p${String(page).padStart(3, "0")}.png`);
	try {
		return new Uint8Array(readFileSync(path));
	} catch {
		return null;
	}
}

/** Counts the unread picture pages in one file's text. */
function unreadIn(work: string, id: string): number {
	return (workText(work, id).match(/\[image page: /g) ?? []).length;
}

async function main(): Promise<void> {
	const parsed = parse(process.argv.slice(2));
	if (typeof parsed === "string") {
		console.error(parsed);
		process.exitCode = 2;
		return;
	}
	const curriculum = basename(parsed.materials);
	let rows: FileRow[] = [];
	try {
		rows = registerRows(
			readIndex(readFileSync(join(parsed.work, "index.csv"), "utf8")),
			curriculum,
		);
	} catch {
		console.error(`no index.csv in ${parsed.work}`);
		process.exitCode = 2;
		return;
	}
	const byId = new Map(rows.map((row) => [row.id, row]));
	const chosen = parsed.ids.flatMap((id) => {
		const row = byId.get(id);
		return row === undefined ? [] : [row];
	});
	const unknown = parsed.ids.filter((id) => !byId.has(id));
	for (const id of unknown)
		console.log(`  ${id}: not in the register, skipped`);
	if (chosen.length === 0) {
		console.error("none of the ids is in the register");
		process.exitCode = 2;
		return;
	}

	const now = new Date();
	const out = join(parsed.out, jobNameOf(now));
	const jobFolder = join(out, "job");
	const rules = readFileSync(
		join(STUDIO, "resources", "rules", "note-rules.md"),
		"utf8",
	);
	const prepared = writeJobFolder({
		folder: jobFolder,
		rows: chosen,
		curriculum,
		rules,
		tool: "claude-code",
		now,
		text: (id) => workText(parsed.work, id),
		page: (id, page) => workPage(parsed.work, id, page),
	});
	if (!prepared.ok) {
		console.error(`the job folder was not written: ${prepared.code}`);
		process.exitCode = 1;
		return;
	}
	mkdirSync(join(out, "existing"), { recursive: true });
	for (const row of chosen) {
		const from = join(parsed.work, "notes", `${row.id}.md`);
		if (!existsSync(from)) continue;
		copyFileSync(from, join(out, "existing", `${row.id}.md`));
	}
	console.log(`job folder: ${jobFolder}`);
	console.log(`existing notes: ${join(out, "existing")}`);
	console.log("\nPaste this into your AI tool:\n");
	console.log(prepared.prompt);
	console.log("");

	const info = await modelInfo(parsed.model).catch(() => null);
	const priceIn = info?.priceIn ?? null;
	const priceOut = info?.priceOut ?? null;

	if (!parsed.key) {
		console.log(
			"no --key: only the job folder and the existing notes were written; no model was called.",
		);
	} else {
		const key = process.env.OPENROUTER_API_KEY ?? "";
		if (key === "") {
			console.error(
				"OPENROUTER_API_KEY is not set: set it in your environment, never in a file in the repo",
			);
			process.exitCode = 2;
			return;
		}
		mkdirSync(join(out, "key"), { recursive: true });
		let spent = 0;
		for (const row of chosen) {
			const result = await oneNote({
				row,
				curriculum,
				text: workText(parsed.work, row.id),
				page: (page) => workPage(parsed.work, row.id, page),
				ask: (request) => askOpenRouter(key, request),
				model: parsed.model,
				rules,
				today: now,
				priceIn,
				priceOut,
				reserve: () => () => {},
				spent: (usd) => {
					spent += usd;
				},
			});
			if (result.ok) {
				const path = join(out, "key", `${row.id}.md`);
				mkdirSync(join(out, "key"), { recursive: true });
				writeFileSync(path, result.note, "utf8");
				console.log(`  ${row.id}: note written (${path})`);
			} else {
				console.log(`  ${row.id}: ${result.code} (${result.reason})`);
			}
		}
		console.log(
			`with a key: ${chosen.length} files, $${spent.toFixed(4)} at ${parsed.model}'s live price.`,
		);
	}

	// What the rest of the register would cost, from the same tokens a page.
	const tried = new Set(chosen.map((row) => row.id));
	const rest = rows.filter(
		(row) =>
			!tried.has(row.id) &&
			row.dupOf === "" &&
			row.error === "" &&
			(row.pages ?? 0) > 0 &&
			!existsSync(join(parsed.work, "notes", `${row.id}.md`)),
	);
	const estimate = estimateRun(
		rest,
		rest.reduce((sum, row) => sum + unreadIn(parsed.work, row.id), 0),
	);
	const restCost = cost(estimate.in, estimate.out, priceIn, priceOut);
	console.log(
		`rest: ${estimate.files} files without a note, ${estimate.pages} pages, about ${
			restCost === null ? "an unknown cost" : `$${restCost.toFixed(4)}`
		} at ${parsed.model}'s live price, ${isoDay(now)}.`,
	);
}

if (process.argv[1]?.endsWith("notes-trial.ts") === true) await main();
