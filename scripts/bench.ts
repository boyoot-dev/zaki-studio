// The benchmark behind task 168: `npm run bench -- <project>`. It calls the main-process
// functions behind each IPC handler directly, without Electron, times each call five times
// and prints a table: the median call in milliseconds, and the size of the reply in KB.
// It also runs a scan of already-known files and reports the event loop's longest stall
// during it, measured with a histogram from perf_hooks. Nothing in the project is written
// but the last scan's report, which is kept byte for byte and put back afterwards.
//
// The calls measured are the ones a click in the page can make: open, model, the tree at
// the top and one deep folder, notesState, scanState, the new-material report, the changes
// list, and the curriculum view's data.

import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { readChangeSets } from "../src/main/changes.ts";
import { readProject, readTree } from "../src/main/files.ts";
import { listJobs } from "../src/main/job.ts";
import { readKeyState } from "../src/main/key.ts";
import { readFiles, readModel, readReport } from "../src/main/model.ts";
import { noteIds, readNoteSettings } from "../src/main/notes.ts";
import { scanProject } from "../src/main/scan.ts";
import { notingOrder } from "../src/shared/notes.ts";
import { currentAcademicYear } from "../src/shared/register.ts";
import {
	changeName,
	notedRows,
	notesOrder,
	periodUnits,
	type Target,
	targetRows,
} from "../src/shared/targets.ts";

/** The Studio's own folder, for the OCR workers the scan would start if it had to draw. */
const STUDIO = fileURLToPath(new URL("..", import.meta.url));

/** A stub of safeStorage, so the key state answers "not set" like a fresh computer. */
const secrets = {
	available: () => true,
	encrypt: (text: string) => Buffer.from(text, "utf8"),
	decrypt: (bytes: Buffer) => bytes.toString("utf8"),
};

/** The size of a value as the page would receive it. */
function sizeOf(value: unknown): number {
	try {
		return Buffer.byteLength(JSON.stringify(value) ?? "");
	} catch {
		return -1;
	}
}

/** The median of timings, in milliseconds. */
function median(times: number[]): number {
	const sorted = [...times].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** One measured call: its name, and the reply the page would get. */
type BenchCall = { name: string; reply: () => unknown };

/** The folder one level below the top, for the "one deep folder" call. */
function deepRel(root: string): string {
	const top = readTree(root).filter((node) => node.kind === "folder");
	const first = top[0];
	if (first === undefined) return "";
	const child = first.children.find((node) => node.kind === "folder");
	return child === undefined ? first.rel : child.rel;
}

/** Every call the page's clicks make, as plain functions over the project. */
function calls(root: string, deep: string, userData: string): BenchCall[] {
	const open = () => {
		const read = readProject(root);
		return {
			ok: true,
			project: read.ok ? read.project : null,
			tree: readTree(root),
		};
	};
	const model = () => {
		const read = readModel(root);
		const files = readFiles(root);
		return {
			ok: true,
			model: read.ok ? read.model : null,
			files: files.ok ? files.files : [],
		};
	};
	const listTreeTop = () => ({ ok: true, tree: readTree(root) });
	const listTreeDeep = () => ({
		ok: true,
		tree: readTree(join(root, ...deep.split("/"))),
	});
	const notesState = () => {
		const files = readFiles(root);
		const rows = files.ok ? files.files : [];
		const noted = noteIds(root);
		const settings = readNoteSettings(userData);
		return {
			ok: true,
			files: rows,
			missing: notingOrder(rows, noted, currentAcademicYear(new Date())),
			settings,
			keySet: readKeyState(userData, secrets).set,
			jobs: listJobs(root),
		};
	};
	const scanState = () => {
		const files = readFiles(root);
		return {
			ok: true,
			files: files.ok ? files.files : [],
			report: readReport(root),
		};
	};
	const report = () => ({ ok: true, report: readReport(root) });
	const changesList = () => {
		// Mirror of the studio:changesState handler: every target of every course, its
		// counts, and the sets waiting for review.
		const read = readModel(root);
		const files = readFiles(root);
		const model = read.ok ? read.model : null;
		const rows = files.ok ? files.files : [];
		const sets = model === null ? null : readChangeSets(root, model, rows);
		const setList = sets !== null && "sets" in sets ? sets.sets : [];
		const noted = noteIds(root);
		const targets: unknown[] = [];
		if (model !== null) {
			for (const course of model.courses) {
				const periods = [
					...new Set(course.units.map((unit) => unit.period)),
				].sort();
				for (const period of periods) {
					const target: Target = {
						grade: course.grade,
						subject: course.subject,
						period,
					};
					const units = periodUnits(course, period);
					const matching = targetRows(rows, target);
					const key = changeName(target);
					targets.push({
						...target,
						units: units.length,
						lessons: units.reduce(
							(total, unit) => total + unit.lessons.length,
							0,
						),
						files: matching.length,
						notes: notedRows(notesOrder(matching), noted).length,
						pending:
							key !== null &&
							setList.some((set) => set.key === key && set.state === "pending"),
					});
				}
			}
		}
		targets.sort(
			(a, b) => (a as { grade: number }).grade - (b as { grade: number }).grade,
		);
		return {
			ok: true,
			targets,
			sets: setList.filter((set) => set.state === "pending"),
			rejected: setList.filter((set) => set.state === "rejected"),
			jobs: listJobs(root, "units"),
		};
	};
	const curriculumData = () => {
		const read = readModel(root);
		const files = readFiles(root);
		return {
			ok: true,
			model: read.ok ? read.model : null,
			files: files.ok ? files.files : [],
		};
	};
	return [
		{ name: "open", reply: open },
		{ name: "model", reply: model },
		{ name: "listTree (top)", reply: listTreeTop },
		{ name: "listTree (deep)", reply: listTreeDeep },
		{ name: "notesState", reply: notesState },
		{ name: "scanState", reply: scanState },
		{ name: "new-material report", reply: report },
		{ name: "changes list", reply: changesList },
		{ name: "curriculum view's data", reply: curriculumData },
	];
}

/** A scan of already-known files, and the event loop's longest stall during it. */
async function scanStall(
	root: string,
): Promise<{ maxMs: number; totalMs: number }> {
	const reportPath = join(root, ".studio", "new.json");
	// The scan rewrites the report even when nothing is new; the report is put back as it was.
	const backup = existsSync(reportPath) ? readFileSync(reportPath) : null;
	const histogram = monitorEventLoopDelay({ resolution: 10 });
	const started = performance.now();
	histogram.enable();
	try {
		await scanProject(root, {
			subjects: [],
			studioRoot: STUDIO,
			cancelled: () => false,
			onProgress: () => {},
		});
	} finally {
		histogram.disable();
		if (backup !== null) writeFileSync(reportPath, backup);
	}
	return {
		maxMs: histogram.max / 1e6,
		totalMs: performance.now() - started,
	};
}

async function main(): Promise<void> {
	const [root] = process.argv.slice(2);
	if (root === undefined) {
		console.error("usage: npm run bench -- <project>");
		process.exitCode = 2;
		return;
	}
	const deep = deepRel(root);
	const userData = mkdtempSync(join(tmpdir(), "studio-bench-"));
	try {
		const benched = calls(root, deep, userData);
		console.log(`Bench of ${root}`);
		console.log(`  one deep folder: ${deep === "" ? "(none)" : deep}`);
		console.log("");
		const nameWidth = Math.max(...benched.map((c) => c.name.length));
		console.log(`${"Call".padEnd(nameWidth)}  Median   Reply`);
		for (const call of benched) {
			const times: number[] = [];
			let last: unknown = null;
			for (let i = 0; i < 5; i += 1) {
				const started = performance.now();
				last = call.reply();
				times.push(performance.now() - started);
			}
			const kb = sizeOf(last) / 1024;
			console.log(
				`${call.name.padEnd(nameWidth)}  ${median(times).toFixed(0).padStart(4)} ms  ${kb.toFixed(0).padStart(5)} KB`,
			);
		}
	} finally {
		rmSync(userData, { recursive: true, force: true });
	}
	const stall = await scanStall(root);
	console.log(
		`scan of known files: longest event-loop stall ${stall.maxMs.toFixed(0)} ms (whole pass ${stall.totalMs.toFixed(0)} ms)`,
	);
}

const running = process.argv[1] ?? "";
if (running.endsWith("bench.ts") || running.endsWith("bench")) void main();
