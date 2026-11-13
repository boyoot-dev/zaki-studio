// The benchmark behind task 168: `npm run bench -- <project>`. It calls the main-process
// functions behind each IPC handler directly, without Electron, times each call five times
// and prints a table: the median call in milliseconds, and the size of the reply in KB.
// It also runs a scan of already-known files and reports the event loop's longest stall
// during it, measured as the longest gap between ticks of a ticker. Nothing in the project
// is written but the last scan's report, which is kept byte for byte and put back afterwards.
//
// The calls measured are the ones a click in the page can make: open, model (the nav's
// heads), the tree at the top and one deep folder, notesState, scanState, the new-material
// report (its header, as the panel asks), one page of the report's rows, the changes list,
// and the curriculum view's data (the heads and one course, as the tab loads them).

import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { readChangeSets } from "../src/main/changes.ts";
import { readLevel, readProject, readTree } from "../src/main/files.ts";
import { notesItems, reportPage } from "../src/main/items.ts";
import { listJobs } from "../src/main/job.ts";
import { readKeyState } from "../src/main/key.ts";
import { readFiles, readModel, readReport } from "../src/main/model.ts";
import { noteIds, readNoteSettings } from "../src/main/notes.ts";
import { scanProject } from "../src/main/scan.ts";
import { reportMeta } from "../src/shared/lists.ts";
import {
	changeName,
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

/** The folder one level below the top, for the "one deep folder" call: the first grade's first subject. */
function deepRel(root: string): string {
	const top = readTree(root).filter((node) => node.kind === "folder");
	const grade = top.find((node) => node.rel !== "Inbox");
	if (grade === undefined) return "";
	const child = grade.children.find((node) => node.kind === "folder");
	return child === undefined ? grade.rel : child.rel;
}

/** Every call the page's clicks make, as plain functions over the project. */
function calls(root: string, deep: string, userData: string): BenchCall[] {
	const open = () => {
		const read = readProject(root);
		if (!read.ok) return read;
		const tree = readLevel(root, "");
		return {
			ok: true,
			project: read.project,
			tree: Array.isArray(tree) ? tree : [],
		};
	};
	const model = () => {
		const read = readModel(root);
		if (!read.ok) return read;
		const courses = read.model.courses
			.map((course) => ({ grade: course.grade, subject: course.subject }))
			.sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject));
		return { ok: true, curriculum: read.model.curriculum, courses };
	};
	const listTreeTop = () => {
		const tree = readLevel(root, "");
		return {
			ok: true,
			nodes: Array.isArray(tree) ? tree : [],
		};
	};
	const listTreeDeep = () => {
		const tree = readLevel(root, deep);
		return {
			ok: true,
			nodes: Array.isArray(tree) ? tree : [],
		};
	};
	const notesState = () => {
		const files = readFiles(root);
		const settings = readNoteSettings(userData);
		const items = notesItems(root);
		let missing = 0;
		for (const item of items) if (item.kind === "row") missing += 1;
		return {
			ok: true,
			total: files.ok ? files.files.length : 0,
			missing,
			settings,
			keySet: readKeyState(userData, secrets).set,
			jobs: listJobs(root),
		};
	};
	const scanState = () => {
		const files = readFiles(root);
		const report = readReport(root);
		return {
			ok: true,
			total: files.ok ? files.files.length : 0,
			meta: report === null ? null : reportMeta(report),
		};
	};
	const report = () => {
		const value = readReport(root);
		return {
			ok: true,
			meta: value === null ? null : reportMeta(value),
		};
	};
	const reportRows = () => ({
		ok: true,
		...reportPage(root, 0, 200),
	});
	const changesList = () => {
		// Mirror of the studio:changesState handler: every target of every course, its
		// counts, and the sets waiting for review, with the register indexed once.
		const read = readModel(root);
		const files = readFiles(root);
		const model = read.ok ? read.model : null;
		const rows = files.ok ? files.files : [];
		const sets = model === null ? null : readChangeSets(root, model, rows);
		const setList = sets !== null && "sets" in sets ? sets.sets : [];
		const noted = noteIds(root);
		const byCourse = new Map<string, typeof rows>();
		for (const row of rows) {
			const key = `${row.grade ?? "?"}|${row.subject}`;
			const bucket = byCourse.get(key);
			if (bucket === undefined) byCourse.set(key, [row]);
			else bucket.push(row);
		}
		const targets: unknown[] = [];
		if (model !== null) {
			for (const course of model.courses) {
				const courseRows =
					byCourse.get(`${course.grade}|${course.subject}`) ?? [];
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
					const matching = targetRows(courseRows, target);
					const key = changeName(target);
					targets.push({
						...target,
						units: units.length,
						lessons: units.reduce(
							(total, unit) => total + unit.lessons.length,
							0,
						),
						files: matching.length,
						// The count of files the period has a note for: order does not matter here.
						notes: matching.reduce(
							(total, row) => total + (noted.has(row.id) ? 1 : 0),
							0,
						),
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
		if (!read.ok) return read;
		const courses = read.model.courses
			.map((course) => ({ grade: course.grade, subject: course.subject }))
			.sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject));
		// The tab loads one course in full once the heads are in.
		const first = read.model.courses[0];
		return {
			ok: true,
			curriculum: read.model.curriculum,
			courses,
			course: first ?? null,
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
		{ name: "report rows (one page)", reply: reportRows },
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
	// monitorEventLoopDelay records nothing for a fully synchronous stretch (no timer fires
	// inside it), so the stall is measured as the longest gap between ticks of a ticker:
	// a block as long as findFiles shows up as one long-late tick.
	let last = performance.now();
	let maxGap = 0;
	const ticker = setInterval(() => {
		const now = performance.now();
		const gap = now - last;
		if (gap > maxGap) maxGap = gap;
		last = now;
	}, 5);
	const started = performance.now();
	try {
		await scanProject(root, {
			subjects: [],
			studioRoot: STUDIO,
			cancelled: () => false,
			onProgress: () => {},
		});
	} finally {
		clearInterval(ticker);
		if (backup !== null) writeFileSync(reportPath, backup);
	}
	return {
		maxMs: maxGap,
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
		console.log(`${"Call".padEnd(nameWidth)}  First   Median   Reply`);
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
				`${call.name.padEnd(nameWidth)}  ${(times[0] ?? 0).toFixed(0).padStart(4)} ms  ${median(times).toFixed(0).padStart(4)} ms  ${kb.toFixed(0).padStart(5)} KB`,
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
