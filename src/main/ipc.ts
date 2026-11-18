// The IPC door between the page and the main process. Every handler takes arguments from a
// web page and therefore clamps them before use: a string is a string of a known shape and
// length, and a folder must be one the author opened in this window before anything is read
// or written (grants.ts), with the path inside it checked by the guard in files.ts. There is
// no channel that hands the page a file system, a process or a network call.

import { randomUUID } from "node:crypto";
import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import subjects from "virtual:subjects";
import {
	app,
	BrowserWindow,
	clipboard,
	dialog,
	ipcMain,
	safeStorage,
	shell,
} from "electron";

import type {
	BundleChoice,
	ChangesCollected,
	ChangesState,
	ChangesWritten,
	ChangeTargetView,
	CourseHead,
	Done,
	ExamsPlanView,
	ExamTargetView,
	ExportCheck,
	Exported,
	Failure,
	FileBytes,
	FileFields,
	FileText,
	Imported,
	JobCollected,
	JobMade,
	Made,
	ModelOverview,
	NoteSettings,
	NotesIds,
	NotesPlanView,
	NotesState,
	NotesWritten,
	NoteText,
	ProjectOpen,
	RecentProject,
	Scanned,
	ScanState,
	UnitsPlanView,
} from "../shared/api.ts";
import type { ExamTarget } from "../shared/exam-changes.ts";
import type { JobTool } from "../shared/job.ts";
import { reportMeta } from "../shared/lists.ts";
import {
	type CurriculumModel,
	type FileRow,
	sameCourse,
} from "../shared/model.ts";
import { notingOrder } from "../shared/notes.ts";
import { ALL_NOTES, notesFilterOf } from "../shared/notes-filter.ts";
import { rememberRecent } from "../shared/recent.ts";
import { currentAcademicYear } from "../shared/register.ts";
import {
	type AcceptChoice,
	changeName,
	periodUnits,
	type Target,
	targetRows,
} from "../shared/targets.ts";
import { adoptMaterial } from "./adopt.ts";
import {
	acceptChange,
	acceptExamChange,
	allowedExamTarget,
	allowedTarget,
	blockPeriods,
	collectUnitsJob,
	deleteChange,
	deleteExamChange,
	examKey,
	fixExamChange,
	prepareUnitsJob,
	readChangeSets,
	readUnitsSettings,
	rejectChange,
	rejectExamChange,
	targetCourse,
	writeUnitsSettings,
} from "./changes.ts";
import {
	collectExamsJob,
	examRows,
	examYears,
	planExamSet,
	prepareExamsJob,
	writeExamSet,
} from "./exams.ts";
import { exportProject, summaryFor } from "./export.ts";
import {
	createProject,
	guessFolders,
	importPaths,
	makeUnit,
	moveEntry,
	openable,
	openablePath,
	readBytes,
	readLevel,
	readProject,
	readText,
	renameEntry,
	safePath,
	savePastedImage,
	setCourseLanguages,
} from "./files.ts";
import {
	makeFromBundle,
	type OpenedBundle,
	readBundleFile,
	takeLaunch,
} from "./frombundle.ts";
import { canonicalRoot, grantedRoot, sameFolder } from "./grants.ts";
import {
	invalidateItems,
	notesFacetsOf,
	notesIds,
	notesItems,
	notesPage,
	reportPage,
} from "./items.ts";
import { collectJob, deleteJob, listJobs, prepareJob } from "./job.ts";
import {
	clearKey,
	loadKey,
	readKeyState,
	type Secrets,
	saveKey,
} from "./key.ts";
import {
	invalidateProject,
	readFiles,
	readModel,
	readPageText,
	readReport,
	relabelCourses,
	setFileFields,
} from "./model.ts";
import {
	noteIds,
	planNotes,
	readNote,
	readNoteSettings,
	writeNoteSettings,
	writeNotes,
} from "./notes.ts";
import { ocrEngine } from "./ocr.ts";
import { modelInfo, testKey } from "./openrouter.ts";
import { openRenderer } from "./render.ts";
import { studioRootPath } from "./root.ts";
import { scanProject } from "./scan.ts";
import { planChangeSet, writeChangeSet } from "./units.ts";
import { watchProject } from "./watch.ts";

/** A string argument, cut to a sane length; anything else is "". */
function text(value: unknown, max = 4000): string {
	return typeof value === "string" ? value.slice(0, max) : "";
}

/** A list of strings, at most `max` of them. */
function texts(value: unknown, max = 400): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item) => typeof item === "string")
		.slice(0, max) as string[];
}

/** Bytes from the page, which arrive as a Uint8Array through structured clone. */
function bytes(value: unknown): Uint8Array | null {
	return value instanceof Uint8Array ? value : null;
}

const failure = (code: Failure["code"] = "unknown") =>
	({ ok: false, code }) as const;

/** The folders each window may use as a project, by their real path. A window starts with
 * none, and its list goes when the window does. */
const grants = new WeakMap<Electron.WebContents, string[]>();

/** The answer every channel gives for a folder the author never picked in this window. */
const notOpen = (): Failure => ({ ok: false, code: "notOpen" });

/** The scans running in each window, so one at a time runs there and the author can stop it. */
const scanning = new Set<number>();
const stopped = new Map<number, boolean>();

/** The notes run each window has going, so one run at a time takes the author's money. */
const noting = new Set<number>();

/** Electron's safeStorage, as the key module needs it: the page never sees any of this. */
const secrets: Secrets = {
	available: () => safeStorage.isEncryptionAvailable(),
	encrypt: (value) => safeStorage.encryptString(value),
	decrypt: (bytes) => safeStorage.decryptString(bytes),
};

/** The app's own folder for the key and the notes settings; never a project's. */
function userData(): string {
	return app.getPath("userData");
}

/** The rules texts, read once and kept: each use stats its file first, and a changed
 * rules file is picked up on the next call (the installer replaces it, and so would a
 * hand edit). Notes and units plans are made per selection, so the rules are read often. */
const rulesMemo = new Map<string, { key: string; text: string }>();

/** The rules file `name`, read from the Studio's own resources; "" when it is not there. */
function rulesTextFrom(name: string): string {
	const file = join(studioRoot(), "resources", "rules", name);
	try {
		const info = statSync(file, { bigint: true });
		const key = `${info.mtimeNs}|${Number(info.size)}`;
		const hit = rulesMemo.get(file);
		if (hit?.key === key) return hit.text;
		const text = readFileSync(file, "utf8");
		rulesMemo.set(file, { key, text });
		return text;
	} catch {
		return "";
	}
}

/** The note rules, from the Studio's own resources; "" when they are not there. */
function rulesText(): string {
	return rulesTextFrom("note-rules.md");
}

/** The change set's rules, from the Studio's own resources; "" when they are not there. */
function unitsRulesText(): string {
	return rulesTextFrom("unit-rules.md");
}

/** The exam change set's rules, from the Studio's own resources; "" when they are not there. */
function examRulesText(): string {
	return rulesTextFrom("exam-rules.md");
}

/** The files a notes action covers: the ones the page chose, or every file without a note. */
function wantedIds(
	where: string,
	rows: Parameters<typeof notingOrder>[0],
	ids: unknown,
): string[] {
	const chosen = texts(ids, 1000);
	if (chosen.length > 0) return chosen;
	return notingOrder(rows, noteIds(where), currentAcademicYear(new Date())).map(
		(row) => row.id,
	);
}

/**
 * The Studio's own folder: beside its build when it runs from a checkout, and the unpacked
 * asar in an installed copy, which is where the installer puts the OCR worker, the rules and
 * the language data (asarUnpack). Tesseract's files live under it.
 */
function studioRoot(): string {
	return studioRootPath(app.isPackaged, app.getAppPath(), __dirname);
}

/** Remembers a folder the author picked here, so the calls after it may use it. */
function grant(sender: Electron.WebContents, root: string): void {
	const canonical = canonicalRoot(root);
	if (canonical === null) return;
	const list = grants.get(sender) ?? [];
	if (!list.includes(canonical)) list.push(canonical);
	grants.set(sender, list);
}

/**
 * True when this window may treat `root` as a project. The page never decides that itself:
 * a folder counts only after the author picked it in the dialog, or picked it from the
 * recents list, which the main process wrote for folders granted before.
 */
function allowed(event: Electron.IpcMainInvokeEvent, root: string): boolean {
	return grantedRoot(grants.get(event.sender) ?? [], root) !== null;
}

/** The recents list on disk, in the app's own folder. */
function recentsFile(): string {
	return join(app.getPath("userData"), "recent-projects.json");
}

/** Reads the recents list; a damaged file is simply an empty list. */
export function readRecents(): RecentProject[] {
	try {
		const value: unknown = JSON.parse(readFileSync(recentsFile(), "utf8"));
		if (!Array.isArray(value)) return [];
		return value
			.filter(
				(item): item is RecentProject =>
					typeof item === "object" &&
					item !== null &&
					typeof (item as RecentProject).root === "string" &&
					typeof (item as RecentProject).nameEn === "string" &&
					typeof (item as RecentProject).nameAr === "string" &&
					typeof (item as RecentProject).opened === "number",
			)
			.slice(0, 8);
	} catch {
		return [];
	}
}

/** Writes the recents list back, ignoring a disk that is full: it is a convenience only. */
function writeRecents(list: RecentProject[]): void {
	try {
		writeFileSync(
			recentsFile(),
			`${JSON.stringify(list, null, "\t")}\n`,
			"utf8",
		);
	} catch {
		// Nothing breaks: the next open just isn't remembered.
	}
}

/** Remembers a project the author opened, newest first. */
function remember(open: {
	root: string;
	nameEn: string;
	nameAr: string;
}): void {
	writeRecents(
		rememberRecent(readRecents(), {
			root: open.root,
			nameEn: open.nameEn,
			nameAr: open.nameAr,
			opened: Date.now(),
		}),
	);
}

/** Opens a project folder, or explains that the wizard has to make it one first. */
function openProject(root: string): ProjectOpen {
	const fail = (code: "missing" | "invalidProject", detail?: string) => ({
		ok: false as const,
		code,
		...(detail ? { detail } : {}),
	});
	if (root === "") return fail("missing");
	const read = readProject(root);
	if (!read.ok) {
		return {
			...fail(
				read.code === "missing" ? "missing" : "invalidProject",
				read.detail,
			),
			needsWizard: read.code === "missing",
			guess: read.code === "missing" ? guessFolders(root) : [],
		};
	}
	remember({ root, nameEn: read.project.nameEn, nameAr: read.project.nameAr });
	// The folder could not be listed at all: open with an empty tree rather than fail the open.
	const tree = readLevel(root, "");
	return {
		ok: true,
		root,
		project: read.project,
		tree: Array.isArray(tree) ? tree : [],
	};
}

/** The watcher each window has, so a second ask (React's strict mode) replaces the first. */
const watchers = new Map<number, () => void>();

/** The curriculum file each window read and checked, until it becomes a project (task 214). */
const openedBundles = new Map<number, OpenedBundle>();

/** Reads and checks a .zaki file for a window, keeping it there; the page gets a summary. */
async function chooseBundleFor(
	sender: Electron.WebContents,
	path: string | null,
): Promise<BundleChoice> {
	if (path === null) return { ok: false, code: "cancelled" };
	const read = await readBundleFile(path, subjects);
	if (!read.ok)
		return {
			ok: false,
			code: "invalidBundle",
			issues: read.issues.map((issue) =>
				issue.path === "" ? issue.message : `${issue.path}: ${issue.message}`,
			),
		};
	openedBundles.set(sender.id, read.opened);
	sender.once("destroyed", () => openedBundles.delete(sender.id));
	return { ok: true, info: read.info };
}

/** Asks for one folder with the system dialog; null when the author changes their mind. */
async function pickFolder(options: {
	title: string;
	detail?: string;
	defaultPath?: string;
	create?: boolean;
}): Promise<string | null> {
	const window = BrowserWindow.getFocusedWindow();
	const settings: Electron.OpenDialogOptions = {
		title: options.title,
		...(options.detail === undefined ? {} : { message: options.detail }),
		...(options.defaultPath !== undefined && existsSync(options.defaultPath)
			? { defaultPath: options.defaultPath }
			: {}),
		properties:
			options.create === false
				? ["openDirectory"]
				: ["openDirectory", "createDirectory"],
	};
	const result =
		window === null
			? await dialog.showOpenDialog(settings)
			: await dialog.showOpenDialog(window, settings);
	if (result.canceled || result.filePaths.length === 0) return null;
	return result.filePaths[0] ?? null;
}

/** The subjects Mr. Zaki knows, as the export and every target check take them. */
const SUBJECT_IDS = subjects.map((subject) => subject.id);

/** The model, the register and the target one change-set call is about. */
function changeContext(
	where: string,
	grade: unknown,
	subject: unknown,
	language: unknown,
	period: unknown,
): { model: CurriculumModel; rows: FileRow[]; target: Target } | Failure {
	const model = readModel(where);
	if (!model.ok) return model;
	const target = allowedTarget(
		model.model,
		grade,
		subject,
		language,
		period,
		SUBJECT_IDS,
	);
	if (target === null)
		return { ok: false, code: "missing", detail: "no such course and period" };
	const files = readFiles(where);
	if (!files.ok) return files;
	return { model: model.model, rows: files.files, target };
}

/** A course an exams call names, the register rows, or the failure the page reads. */
function examContext(
	where: string,
	grade: unknown,
	subject: unknown,
	language: unknown,
): { model: CurriculumModel; rows: FileRow[]; target: ExamTarget } | Failure {
	const model = readModel(where);
	if (!model.ok) return model;
	const target = allowedExamTarget(
		model.model,
		grade,
		subject,
		language,
		SUBJECT_IDS,
	);
	if (target === null)
		return { ok: false, code: "missing", detail: "no such course" };
	const files = readFiles(where);
	if (!files.ok) return files;
	return { model: model.model, rows: files.files, target };
}

/** Registers every channel. */
export function registerIpc(): void {
	ipcMain.handle(
		"studio:chooseFolder",
		async (event): Promise<string | null> => {
			const picked = await pickFolder({ title: "Open a folder" });
			// The one place a folder becomes usable: the author chose it themselves.
			if (picked !== null) grant(event.sender, picked);
			return picked;
		},
	);

	ipcMain.handle(
		"studio:chooseBundle",
		async (event): Promise<BundleChoice> => {
			const window = BrowserWindow.getFocusedWindow();
			const settings: Electron.OpenDialogOptions = {
				title: "Open a curriculum file",
				properties: ["openFile"],
				filters: [{ name: "Mr. Zaki curriculum", extensions: ["zaki"] }],
			};
			const result =
				window === null
					? await dialog.showOpenDialog(settings)
					: await dialog.showOpenDialog(window, settings);
			const path = result.canceled ? null : (result.filePaths[0] ?? null);
			return chooseBundleFor(event.sender, path);
		},
	);

	ipcMain.handle(
		"studio:launchedBundle",
		async (event): Promise<BundleChoice> =>
			chooseBundleFor(event.sender, takeLaunch()),
	);

	ipcMain.handle(
		"studio:projectFromBundle",
		async (event): Promise<ProjectOpen> => {
			const opened = openedBundles.get(event.sender.id);
			if (opened === undefined) return { ok: false, code: "missing" };
			const root = await pickFolder({
				title: "Choose an empty folder for the project",
			});
			if (root === null) return { ok: false, code: "cancelled" };
			grant(event.sender, root);
			const made = makeFromBundle(root, opened);
			if (!made.ok) return made;
			openedBundles.delete(event.sender.id);
			return openProject(root);
		},
	);

	ipcMain.handle("studio:adoptProject", async (event): Promise<ProjectOpen> => {
		const materials = await pickFolder({
			title: "Open my existing material",
			detail:
				"Choose the folder that holds one curriculum's material, for example resources/kestrel.",
			create: false,
		});
		if (materials === null) return { ok: false, code: "cancelled" };
		grant(event.sender, materials);
		const existing = readProject(materials);
		if (existing.ok) {
			remember({
				root: materials,
				nameEn: existing.project.nameEn,
				nameAr: existing.project.nameAr,
			});
			const tree = readLevel(materials, "");
			return {
				ok: true,
				root: materials,
				project: existing.project,
				tree: Array.isArray(tree) ? tree : [],
			};
		}
		if (existing.code !== "missing") return existing;
		// The curriculum folder is read only, so it is never granted: the page has no
		// reason to name it, and the main process reads it once here.
		const curriculum = await pickFolder({
			title: "Choose the curriculum built from this material",
			detail:
				"The folder with curriculum.json and the grade files, for example app/content/curriculum/kestrel.",
			defaultPath: join(
				dirname(dirname(materials)),
				"app",
				"content",
				"curriculum",
				basename(materials),
			),
			create: false,
		});
		if (curriculum === null) return { ok: false, code: "cancelled" };
		const work = join(dirname(materials), "_work");
		const outcome = adoptMaterial(materials, work, curriculum, randomUUID());
		if (!outcome.ok) return outcome;
		remember({
			root: materials,
			nameEn: outcome.project.nameEn,
			nameAr: outcome.project.nameAr,
		});
		const tree = readLevel(materials, "");
		return {
			ok: true,
			root: materials,
			project: outcome.project,
			tree: Array.isArray(tree) ? tree : [],
		};
	});

	ipcMain.handle("studio:openProject", (event, root: unknown): ProjectOpen => {
		const where = text(root, 400);
		if (!allowed(event, where)) return notOpen();
		return openProject(where);
	});

	ipcMain.handle("studio:openRecent", (event, root: unknown): ProjectOpen => {
		const wanted = text(root, 400);
		// Only a folder the author opened before comes back this way, and the path opened is
		// the one in the main process's own list, not the string the page sent.
		const known = readRecents().find((entry) => sameFolder(entry.root, wanted));
		if (known === undefined) return notOpen();
		grant(event.sender, known.root);
		return openProject(known.root);
	});

	ipcMain.handle(
		"studio:createProject",
		(event, root: unknown, project: unknown): ProjectOpen => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			if (where === "" || typeof project !== "object" || project === null)
				return { ok: false, code: "invalidProject" };
			// The project is checked again inside createProject, so a broken one never reaches disk.
			const written = createProject(where, project);
			if (!written.ok) return written;
			return openProject(where);
		},
	);

	ipcMain.handle("studio:recentProjects", (): RecentProject[] => readRecents());

	ipcMain.handle(
		"studio:setCourseLanguages",
		(event, root: unknown, changes: unknown): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const set = setCourseLanguages(where, changes);
			if (!set.ok) return set;
			// A course taught in another language is relabelled with its units and its files.
			return set.renamed.length === 0
				? { ok: true }
				: relabelCourses(where, set.renamed);
		},
	);

	ipcMain.handle("studio:model", (event, root: unknown): ModelOverview => {
		const where = text(root, 400);
		if (!allowed(event, where)) return notOpen();
		const model = readModel(where);
		if (!model.ok)
			return {
				ok: false,
				code: model.code,
				...(model.detail === undefined ? {} : { detail: model.detail }),
			};
		const courses: CourseHead[] = model.model.courses.map((course) => ({
			grade: course.grade,
			subject: course.subject,
			language: course.language,
			support: [...course.support],
		}));
		courses.sort(
			(a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject),
		);
		return { ok: true, curriculum: model.model.curriculum, courses };
	});

	ipcMain.handle(
		"studio:course",
		(
			event,
			root: unknown,
			grade: unknown,
			subject: unknown,
			language: unknown,
		) => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const model = readModel(where);
			if (!model.ok) return model;
			const wantedGrade =
				typeof grade === "number" && Number.isInteger(grade)
					? grade
					: Number.NaN;
			const wanted = {
				grade: wantedGrade,
				subject: text(subject, 60),
				language: text(language, 3),
			};
			const course = model.model.courses.find((entry) =>
				sameCourse(entry, wanted),
			);
			if (course === undefined)
				return { ok: false as const, code: "missing" as const };
			return { ok: true as const, course };
		},
	);

	ipcMain.handle("studio:fileRow", (event, root: unknown, path: unknown) => {
		const where = text(root, 400);
		if (!allowed(event, where)) return notOpen();
		const wanted = text(path, 400);
		const files = readFiles(where);
		if (!files.ok) return files;
		const row = files.files.find((entry) => entry.path === wanted) ?? null;
		return { ok: true as const, row };
	});

	ipcMain.handle("studio:filePaths", (event, root: unknown, ids: unknown) => {
		const where = text(root, 400);
		if (!allowed(event, where)) return notOpen();
		const wanted = texts(ids, 1500).filter((id) => /^[0-9a-f]{12}$/.test(id));
		const files = readFiles(where);
		if (!files.ok) return files;
		const byId = new Map(files.files.map((row) => [row.id, row]));
		const paths: Record<string, { path: string; size: number }> = {};
		for (const id of new Set(wanted)) {
			const row = byId.get(id);
			if (row !== undefined) paths[id] = { path: row.path, size: row.size };
		}
		return { ok: true as const, paths };
	});

	ipcMain.handle("studio:folders", (event, root: unknown) => {
		const where = text(root, 400);
		if (!allowed(event, where)) return notOpen();
		// Every folder's relative path, depth-first in tree order, without reading one file.
		const folders: string[] = [];
		const walk = (absolute: string, rel: string, depth: number): void => {
			if (depth > 14) return;
			let entries: string[];
			try {
				entries = readdirSync(absolute);
			} catch {
				return;
			}
			for (const name of entries) {
				if (rel === "" && (name === ".studio" || name.startsWith(".")))
					continue;
				const childRel = rel === "" ? name : `${rel}/${name}`;
				const childAbsolute = join(absolute, name);
				let info: ReturnType<typeof lstatSync>;
				try {
					info = lstatSync(childAbsolute);
				} catch {
					continue;
				}
				if (info.isSymbolicLink()) continue;
				if (!info.isDirectory()) continue;
				folders.push(childRel);
				walk(childAbsolute, childRel, depth + 1);
			}
		};
		walk(where, "", 0);
		return { ok: true as const, folders };
	});

	ipcMain.handle(
		"studio:pageText",
		(
			event,
			root: unknown,
			id: unknown,
			page: unknown,
		): { ok: true; text: string } | Failure => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const wanted =
				typeof page === "number" && Number.isInteger(page)
					? Math.min(9999, Math.max(1, page))
					: 1;
			return { ok: true, text: readPageText(where, text(id, 16), wanted) };
		},
	);

	ipcMain.handle(
		"studio:exportSummary",
		(event, root: unknown): ExportCheck => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			return summaryFor(where);
		},
	);

	ipcMain.handle(
		"studio:exportBundle",
		async (
			event,
			root: unknown,
			author: unknown,
			rights: unknown,
		): Promise<Exported> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			return exportProject(
				where,
				text(author, 200),
				text(rights, 400),
				subjects.map((subject) => subject.id),
			);
		},
	);

	ipcMain.handle("studio:listTree", (event, root: unknown, rel: unknown) => {
		const where = text(root, 400);
		if (!allowed(event, where)) return notOpen();
		// One level at a time: "" is the top, otherwise a folder inside the project.
		const wanted = text(rel, 400);
		if (wanted.includes("\0")) return failure("outside");
		const nodes = readLevel(where, wanted);
		if (Array.isArray(nodes)) return { ok: true as const, nodes };
		return nodes;
	});

	ipcMain.handle(
		"studio:importPaths",
		(event, root: unknown, targetRel: unknown, paths: unknown): Imported => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const result = importPaths(
				where,
				text(targetRel, 400),
				texts(paths, 200),
			);
			return result;
		},
	);

	ipcMain.handle(
		"studio:savePastedImage",
		(
			event,
			root: unknown,
			targetRel: unknown,
			data: unknown,
			ext: unknown,
		): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const copy = bytes(data);
			if (copy === null) return failure("unreadable");
			return savePastedImage(where, text(targetRel, 400), copy, text(ext, 8));
		},
	);

	ipcMain.handle(
		"studio:moveEntry",
		(event, root: unknown, fromRel: unknown, toRel: unknown): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			return moveEntry(where, text(fromRel, 400), text(toRel, 400));
		},
	);

	ipcMain.handle(
		"studio:renameEntry",
		(event, root: unknown, rel: unknown, name: unknown): Made => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			return renameEntry(where, text(rel, 400), text(name, 200));
		},
	);

	ipcMain.handle(
		"studio:trashEntry",
		async (event, root: unknown, rel: unknown): Promise<Done> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const target = safePath(where, text(rel, 400));
			if (target === null) return { ok: false, code: "outside" };
			const confirmed = await confirmDelete(target);
			if (!confirmed) return { ok: false, code: "cancelled" };
			try {
				await shell.trashItem(target);
				return { ok: true };
			} catch {
				return failure();
			}
		},
	);

	ipcMain.handle(
		"studio:makeUnit",
		(event, root: unknown, unitsRel: unknown, title: unknown): Made => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			return makeUnit(where, text(unitsRel, 400), text(title, 80));
		},
	);

	ipcMain.handle(
		"studio:readFile",
		(event, root: unknown, rel: unknown): FileBytes => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			return readBytes(where, text(rel, 400));
		},
	);

	ipcMain.handle(
		"studio:readText",
		(event, root: unknown, rel: unknown): FileText => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			return readText(where, text(rel, 400));
		},
	);

	ipcMain.handle(
		"studio:readWord",
		async (event, root: unknown, rel: unknown): Promise<FileText> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const path = text(rel, 400);
			const file = readBytes(where, path);
			if (!file.ok) return file;
			try {
				// mammoth's text only: its HTML would need a renderer that runs a document's
				// markup, and the Studio never does that with a file's content.
				const mammoth = await import("mammoth");
				const result = await mammoth.extractRawText({
					buffer: Buffer.from(file.bytes),
				});
				return { ok: true, name: file.name, text: result.value };
			} catch {
				return failure("unreadable");
			}
		},
	);

	ipcMain.handle(
		"studio:openInApp",
		async (event, root: unknown, rel: unknown): Promise<Done> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const path = text(rel, 400);
			const target = openablePath(where, path);
			if (target === null)
				return { ok: false, code: openable(path) ? "missing" : "invalidName" };
			const window = BrowserWindow.getFocusedWindow();
			const question = {
				type: "question" as const,
				buttons: ["Open", "Cancel"],
				defaultId: 1,
				cancelId: 1,
				title: "Open in its app",
				message: `Open "${target.split(/[\\/]/).pop() ?? ""}" in the app Windows has for it?`,
				detail: "The file is shown by another program, not by Mr. Zaki Studio.",
			};
			const confirmed =
				window === null
					? await dialog.showMessageBox(question)
					: await dialog.showMessageBox(window, question);
			if (confirmed.response !== 0) return { ok: false, code: "cancelled" };
			const problem = await shell.openPath(target);
			return problem === ""
				? { ok: true }
				: { ok: false, code: "unknown", detail: problem };
		},
	);

	ipcMain.handle(
		"studio:scan",
		async (event, root: unknown): Promise<Scanned> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const sender = event.sender;
			if (scanning.has(sender.id)) return { ok: false, code: "unknown" };
			scanning.add(sender.id);
			stopped.set(sender.id, false);
			// The hidden reader and the OCR workers belong to this scan, and go with it.
			const renderer = openRenderer();
			const ocr = ocrEngine(studioRoot());
			try {
				const outcome = await scanProject(where, {
					studioRoot: studioRoot(),
					render: (bytes, page) => renderer.render(bytes, page),
					ocr,
					cancelled: () => stopped.get(sender.id) === true,
					onProgress: (progress) => {
						if (!sender.isDestroyed())
							sender.send("studio:scanProgress", progress);
					},
				});
				if (!outcome.ok) return outcome;
				// The reply carries the report's header, never its rows (task 168): the page
				// asks for the rows in pages through studio:reportRows.
				return {
					ok: true,
					stopped: outcome.stopped,
					total: outcome.files.length,
					meta: reportMeta(outcome.report),
				};
			} finally {
				renderer.close();
				await ocr.close();
				scanning.delete(sender.id);
				stopped.delete(sender.id);
			}
		},
	);

	ipcMain.handle("studio:scanCancel", (event): Done => {
		// The scan checks this after each file and each page, then keeps what it has.
		stopped.set(event.sender.id, true);
		return { ok: true };
	});

	ipcMain.handle("studio:scanState", (event, root: unknown): ScanState => {
		const where = text(root, 400);
		if (!allowed(event, where)) return notOpen();
		const files = readFiles(where);
		if (!files.ok) return files;
		const report = readReport(where);
		return {
			ok: true,
			total: files.files.length,
			meta: report === null ? null : reportMeta(report),
		};
	});

	ipcMain.handle(
		"studio:reportRows",
		(event, root: unknown, offset: unknown, limit: unknown) => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const at =
				typeof offset === "number" && Number.isFinite(offset) ? offset : 0;
			const take =
				typeof limit === "number" && Number.isFinite(limit)
					? Math.min(400, Math.max(1, Math.floor(limit)))
					: 200;
			return { ok: true as const, ...reportPage(where, at, take) };
		},
	);

	ipcMain.handle(
		"studio:notesRows",
		(
			event,
			root: unknown,
			offset: unknown,
			limit: unknown,
			filter: unknown,
		) => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const at =
				typeof offset === "number" && Number.isFinite(offset) ? offset : 0;
			const take =
				typeof limit === "number" && Number.isFinite(limit)
					? Math.min(400, Math.max(1, Math.floor(limit)))
					: 200;
			return {
				ok: true as const,
				...notesPage(where, at, take, notesFilterOf(filter)),
			};
		},
	);

	ipcMain.handle(
		"studio:notesIds",
		(event, root: unknown, filter: unknown): NotesIds => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			// Every file the filter shows, whether its page has been drawn or not: the panel's
			// "tick all shown" ticks these (task 181).
			return { ok: true, ids: notesIds(where, notesFilterOf(filter)) };
		},
	);

	ipcMain.handle(
		"studio:setFileFields",
		(event, root: unknown, id: unknown, fields: unknown): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			if (typeof fields !== "object" || fields === null)
				return { ok: false, code: "invalidName" };
			const raw = fields as Record<string, unknown>;
			const clean: FileFields = {
				grade:
					typeof raw.grade === "number" && Number.isInteger(raw.grade)
						? raw.grade
						: null,
				subject: text(raw.subject, 60).trim(),
				block: text(raw.block, 20).trim(),
				kind: text(raw.kind, 20),
				authority: typeof raw.authority === "number" ? raw.authority : null,
			};
			return setFileFields(where, text(id, 20), clean);
		},
	);

	ipcMain.handle("studio:watch", (event, root: unknown): Done => {
		const where = text(root, 400);
		if (!allowed(event, where)) return notOpen();
		const sender = event.sender;
		watchers.get(sender.id)?.();
		const stop = watchProject(where, () => {
			// The folder changed on disk: throw away what the cache parsed, so the
			// pages after a change never see a stale register, report or model.
			invalidateProject(where);
			invalidateItems(where);
			if (!sender.isDestroyed()) sender.send("studio:changed");
		});
		watchers.set(sender.id, stop);
		sender.once("destroyed", () => {
			stop();
			watchers.delete(sender.id);
		});
		return { ok: true };
	});

	// The notes tab (task 157). Every call here takes only a project path the author opened,
	// file ids and a job name; none of them carries or returns the key.
	ipcMain.handle(
		"studio:notesState",
		(event, root: unknown, filter: unknown): NotesState => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const files = readFiles(where);
			if (!files.ok) return files;
			const settings = readNoteSettings(userData());
			// The count is the whole list without a note: the panel's filter only hides rows.
			const missing = notesItems(where, ALL_NOTES).reduce(
				(total, item) => total + (item.kind === "row" ? 1 : 0),
				0,
			);
			return {
				ok: true,
				total: files.files.length,
				missing,
				settings,
				keySet: readKeyState(userData(), secrets).set,
				jobs: listJobs(where),
				// The type boxes are read under the grade and subject the page chose (task 182).
				facets: notesFacetsOf(where, notesFilterOf(filter)),
			};
		},
	);

	ipcMain.handle(
		"studio:noteText",
		(event, root: unknown, id: unknown): NoteText => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			return { ok: true, text: readNote(where, text(id, 16)) };
		},
	);

	ipcMain.handle(
		"studio:notesPlan",
		async (
			event,
			root: unknown,
			ids: unknown,
			redo: unknown,
		): Promise<NotesPlanView> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const files = readFiles(where);
			if (!files.ok) return files;
			const settings = readNoteSettings(userData());
			const chosen = wantedIds(where, files.files, ids);
			const plan = await planNotes(
				where,
				files.files,
				chosen,
				settings.model,
				new Date(),
				undefined,
				redo === true ? new Set(chosen) : new Set(),
			);
			return {
				ok: true,
				plan,
				limit: settings.limit,
				keySet: readKeyState(userData(), secrets).set,
			};
		},
	);

	ipcMain.handle(
		"studio:writeNotes",
		async (
			event,
			root: unknown,
			ids: unknown,
			limit: unknown,
			redo: unknown,
		): Promise<NotesWritten> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const sender = event.sender;
			if (noting.has(sender.id)) return failure();
			const files = readFiles(where);
			if (!files.ok) return files;
			const key = loadKey(userData(), secrets);
			if (key === null) return { ok: false, code: "noKey" };
			const rules = rulesText();
			if (rules === "") return failure("missing");
			const settings = readNoteSettings(userData());
			const prices = await modelInfo(settings.model).catch(() => null);
			const amount =
				typeof limit === "number" && Number.isFinite(limit)
					? Math.min(100, Math.max(0.01, limit))
					: settings.limit;
			const chosen = wantedIds(where, files.files, ids);
			noting.add(sender.id);
			try {
				const outcome = await writeNotes({
					root: where,
					rows: files.files,
					ids: chosen,
					redo: redo === true ? new Set(chosen) : undefined,
					curriculum: basename(where),
					model: settings.model,
					key,
					rules,
					priceIn: prices?.priceIn ?? null,
					priceOut: prices?.priceOut ?? null,
					limitUsd: amount,
					today: new Date(),
					images: prices?.readsImages ?? true,
					onProgress: (done, total, id) => {
						if (!sender.isDestroyed())
							sender.send("studio:notesProgress", { done, total, id });
					},
				});
				return {
					ok: true,
					written: outcome.written.length,
					failed: outcome.failed,
					stopped: outcome.stopped,
				};
			} finally {
				noting.delete(sender.id);
			}
		},
	);

	ipcMain.handle("studio:saveKey", (_event, value: unknown): Done => {
		const saved = saveKey(userData(), secrets, value);
		if (saved.ok) return { ok: true };
		if (saved.code === "invalid") return { ok: false, code: "invalidName" };
		if (saved.code === "noStorage") return { ok: false, code: "noStorage" };
		return { ok: false, code: "unreadable" };
	});

	ipcMain.handle("studio:clearKey", (): Done => {
		clearKey(userData());
		return { ok: true };
	});

	ipcMain.handle("studio:testKey", async (): Promise<Done> => {
		const key = loadKey(userData(), secrets);
		// No key, or a key this computer can't read: the page learns only which of the two.
		if (key === null) return { ok: false, code: "noKey" };
		const checked = await testKey(key, readNoteSettings(userData()).model);
		if (checked.ok) return { ok: true };
		if (checked.code === "key") return { ok: false, code: "noKey" };
		if (checked.code === "credit") return { ok: false, code: "noCredit" };
		return { ok: false, code: "refused" };
	});

	ipcMain.handle(
		"studio:saveNoteSettings",
		(
			_event,
			model: unknown,
			limit: unknown,
		): { ok: true; settings: NoteSettings } | Failure => {
			const settings = writeNoteSettings(userData(), { model, limit });
			return settings === null
				? { ok: false, code: "invalidName" }
				: { ok: true, settings };
		},
	);

	ipcMain.handle(
		"studio:prepareJob",
		(event, root: unknown, ids: unknown, tool: unknown): JobMade => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const files = readFiles(where);
			if (!files.ok) return files;
			const rules = rulesText();
			if (rules === "") return failure("missing");
			const chosen: JobTool = tool === "claude-code" ? "claude-code" : "other";
			return prepareJob({
				root: where,
				rows: files.files,
				ids: wantedIds(where, files.files, ids),
				curriculum: basename(where),
				rules,
				tool: chosen,
				now: new Date(),
			});
		},
	);

	ipcMain.handle(
		"studio:collectJob",
		(event, root: unknown, name: unknown): JobCollected => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const outcome = collectJob({
				root: where,
				name: text(name, 20),
				today: new Date(),
			});
			if ("ok" in outcome) return outcome;
			return {
				ok: true,
				collected: outcome.collected.length,
				skipped: outcome.skipped.length,
				refused: outcome.refused,
			};
		},
	);

	ipcMain.handle(
		"studio:deleteJob",
		async (event, root: unknown, name: unknown): Promise<Done> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const job = text(name, 20);
			// Only a job's own name reaches the dialog, and only a job of this project.
			if (!/^\d{4}-\d{2}-\d{2}-\d{4}$/.test(job)) return failure("invalidName");
			const window = BrowserWindow.getFocusedWindow();
			const question = {
				type: "question" as const,
				buttons: ["Delete", "Cancel"],
				defaultId: 1,
				cancelId: 1,
				title: "Delete a job",
				message: `Delete the job "${job}"?`,
				detail:
					"Its folder goes, and any note still waiting in out/. Notes already collected stay in the project.",
			};
			const answer =
				window === null
					? await dialog.showMessageBox(question)
					: await dialog.showMessageBox(window, question);
			if (answer.response !== 0) return { ok: false, code: "cancelled" };
			return deleteJob(where, job);
		},
	);

	ipcMain.handle("studio:copyText", (_event, value: unknown): Done => {
		const copy = text(value, 20_000);
		if (copy === "") return failure("invalidName");
		clipboard.writeText(copy);
		return { ok: true };
	});

	// The changes tab (task 158). Every call takes a project the author opened and a target the
	// model knows; none of them takes or returns the key, and none takes a path.
	ipcMain.handle(
		"studio:changesState",
		(event, root: unknown): ChangesState => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const model = readModel(where);
			if (!model.ok) return model;
			const files = readFiles(where);
			if (!files.ok) return files;
			const sets = readChangeSets(where, model.model, files.files);
			if (!sets.ok) return sets;
			const noted = noteIds(where);
			// The register indexed once by course, so a full school pays one pass instead of one
			// per course and period (task 168).
			const byCourse = new Map<string, FileRow[]>();
			for (const row of files.files) {
				const key = `${row.grade ?? "?"}|${row.subject}|${row.language}`;
				const bucket = byCourse.get(key);
				if (bucket === undefined) byCourse.set(key, [row]);
				else bucket.push(row);
			}
			const targets: ChangeTargetView[] = [];
			const examTargets: ExamTargetView[] = [];
			// The targets come from the register as well as the model (task 178): a grade or
			// subject with notes but no course yet, or a block the course has no unit in, must
			// still be offered, so its units can be built. A course's own periods stay listed
			// even with no note, as before.
			const unitTargets = new Map<string, Target>();
			for (const course of model.model.courses) {
				for (const period of new Set(course.units.map((unit) => unit.period))) {
					const target: Target = {
						grade: course.grade,
						subject: course.subject,
						language: course.language,
						period,
					};
					const key = changeName(target);
					if (key !== null) unitTargets.set(key, target);
				}
			}
			for (const row of files.files) {
				if (row.grade === null || !noted.has(row.id)) continue;
				for (const period of blockPeriods(row.block)) {
					// A row whose language is not settled yet can't name its course.
					if (row.language === "") continue;
					const known = allowedTarget(
						model.model,
						row.grade,
						row.subject,
						row.language,
						period,
						SUBJECT_IDS,
					);
					const key = known === null ? null : changeName(known);
					if (known !== null && key !== null && !unitTargets.has(key))
						unitTargets.set(key, known);
				}
			}
			for (const target of unitTargets.values()) {
				const course = targetCourse(model.model, target);
				const courseRows =
					byCourse.get(
						`${target.grade}|${target.subject}|${target.language}`,
					) ?? [];
				const units = course === null ? [] : periodUnits(course, target.period);
				const rows = targetRows(courseRows, target);
				const key = changeName(target);
				targets.push({
					...target,
					units: units.length,
					lessons: units.reduce(
						(total, unit) => total + unit.lessons.length,
						0,
					),
					files: rows.length,
					// The count of files the period has a note for: order does not matter here.
					notes: rows.reduce(
						(total, row) => total + (noted.has(row.id) ? 1 : 0),
						0,
					),
					pending:
						key !== null &&
						sets.sets.some((set) => set.key === key && set.state === "pending"),
					newCourse: course === null,
					newBlock: course !== null && units.length === 0,
				});
			}

			const examTargetsNow = new Map<string, ExamTarget>();
			for (const course of model.model.courses) {
				examTargetsNow.set(
					`${course.grade}|${course.subject}|${course.language}`,
					{
						grade: course.grade,
						subject: course.subject,
						language: course.language,
					},
				);
			}
			for (const row of files.files) {
				if (row.grade === null || !noted.has(row.id)) continue;
				if (row.kind !== "exam" && row.kind !== "mark-scheme") continue;
				if (row.language === "") continue;
				const known = allowedExamTarget(
					model.model,
					row.grade,
					row.subject,
					row.language,
					SUBJECT_IDS,
				);
				if (known !== null)
					examTargetsNow.set(
						`${known.grade}|${known.subject}|${known.language}`,
						known,
					);
			}
			for (const examTarget of examTargetsNow.values()) {
				const courseRows =
					byCourse.get(
						`${examTarget.grade}|${examTarget.subject}|${examTarget.language}`,
					) ?? [];
				const examRowsNow = examRows(courseRows, examTarget);
				if (examRowsNow.length === 0) continue;
				const years = examYears(courseRows, examTarget, noted);
				const course = targetCourse(model.model, examTarget);
				examTargets.push({
					...examTarget,
					exams: course?.exams.length ?? 0,
					files: examRowsNow.length,
					notes: examRowsNow.reduce(
						(total, row) => total + (noted.has(row.id) ? 1 : 0),
						0,
					),
					yearsLeftOut: years.leftOut,
					pending: sets.sets.some(
						(set) => set.key === examKey(examTarget) && set.state === "pending",
					),
					newCourse: course === null,
				});
			}
			targets.sort(
				(a, b) =>
					a.grade - b.grade ||
					a.subject.localeCompare(b.subject) ||
					a.language.localeCompare(b.language) ||
					a.period.localeCompare(b.period),
			);
			examTargets.sort(
				(a, b) =>
					a.grade - b.grade ||
					a.subject.localeCompare(b.subject) ||
					a.language.localeCompare(b.language),
			);
			return {
				ok: true,
				targets,
				examTargets,
				sets: sets.sets.filter((set) => set.state === "pending"),
				rejected: sets.sets.filter((set) => set.state === "rejected"),
				settings: readUnitsSettings(userData()),
				keySet: readKeyState(userData(), secrets).set,
				jobs: listJobs(where, "units"),
				examJobs: listJobs(where, "exams"),
			};
		},
	);

	ipcMain.handle(
		"studio:unitsPlan",
		async (
			event,
			root: unknown,
			grade: unknown,
			subject: unknown,
			language: unknown,
			period: unknown,
		): Promise<UnitsPlanView> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = changeContext(where, grade, subject, language, period);
			if ("ok" in context) return context;
			const rules = unitsRulesText();
			if (rules === "") return failure("missing");
			const settings = readUnitsSettings(userData());
			const plan = await planChangeSet(
				where,
				context.model,
				context.rows,
				context.target,
				rules,
				settings.model,
			);
			return {
				ok: true,
				plan,
				limit: settings.limit,
				keySet: readKeyState(userData(), secrets).set,
			};
		},
	);

	ipcMain.handle(
		"studio:writeChanges",
		async (
			event,
			root: unknown,
			grade: unknown,
			subject: unknown,
			language: unknown,
			period: unknown,
			limit: unknown,
		): Promise<ChangesWritten> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = changeContext(where, grade, subject, language, period);
			if ("ok" in context) return context;
			const key = loadKey(userData(), secrets);
			if (key === null) return { ok: false, code: "noKey" };
			const rules = unitsRulesText();
			if (rules === "") return failure("missing");
			const settings = readUnitsSettings(userData());
			const prices = await modelInfo(settings.model).catch(() => null);
			const amount =
				typeof limit === "number" && Number.isFinite(limit)
					? Math.min(100, Math.max(0.01, limit))
					: settings.limit;
			const written = await writeChangeSet({
				root: where,
				model: context.model,
				rows: context.rows,
				target: context.target,
				rules,
				key,
				modelName: settings.model,
				priceIn: prices?.priceIn ?? null,
				priceOut: prices?.priceOut ?? null,
				limitUsd: amount,
				today: new Date(),
			});
			if (!written.ok) return written;
			return { ok: true, spent: written.spentUsd };
		},
	);

	ipcMain.handle(
		"studio:prepareUnitsJob",
		(event, root: unknown, targets: unknown, tool: unknown): JobMade => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const model = readModel(where);
			if (!model.ok) return model;
			const files = readFiles(where);
			if (!files.ok) return files;
			const rules = unitsRulesText();
			if (rules === "") return failure("missing");
			const wanted = Array.isArray(targets) ? targets.slice(0, 40) : [];
			const chosen = new Map<string, Target>();
			for (const item of wanted) {
				if (typeof item !== "object" || item === null) continue;
				const raw = item as Record<string, unknown>;
				const target = allowedTarget(
					model.model,
					raw.grade,
					raw.subject,
					raw.language,
					raw.period,
					SUBJECT_IDS,
				);
				const key = target === null ? null : changeName(target);
				if (target !== null && key !== null && !chosen.has(key))
					chosen.set(key, target);
			}
			if (chosen.size === 0) return failure("missing");
			const chosenTool: JobTool =
				tool === "claude-code" ? "claude-code" : "other";
			return prepareUnitsJob({
				root: where,
				model: model.model,
				rows: files.files,
				targets: [...chosen.values()],
				curriculum: basename(where),
				rules,
				tool: chosenTool,
				now: new Date(),
			});
		},
	);

	ipcMain.handle(
		"studio:collectUnitsJob",
		(event, root: unknown, name: unknown): ChangesCollected => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const model = readModel(where);
			if (!model.ok) return model;
			const files = readFiles(where);
			if (!files.ok) return files;
			const outcome = collectUnitsJob({
				root: where,
				model: model.model,
				files: files.files,
				name: text(name, 20),
				today: new Date(),
			});
			if ("ok" in outcome) return outcome;
			return {
				ok: true,
				collected: outcome.collected.length,
				skipped: outcome.skipped.length,
				refused: outcome.refused,
			};
		},
	);

	ipcMain.handle(
		"studio:deleteUnitsJob",
		async (event, root: unknown, name: unknown): Promise<Done> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const job = text(name, 20);
			if (!/^\d{4}-\d{2}-\d{2}-\d{4}$/.test(job)) return failure("invalidName");
			const window = BrowserWindow.getFocusedWindow();
			const question = {
				type: "question" as const,
				buttons: ["Delete", "Cancel"],
				defaultId: 1,
				cancelId: 1,
				title: "Delete a job",
				message: `Delete the job "${job}"?`,
				detail:
					"Its folder goes, and any change set still waiting in out/. Sets already collected stay for review.",
			};
			const answer =
				window === null
					? await dialog.showMessageBox(question)
					: await dialog.showMessageBox(window, question);
			if (answer.response !== 0) return { ok: false, code: "cancelled" };
			return deleteJob(where, job, "units");
		},
	);

	ipcMain.handle(
		"studio:acceptChanges",
		(
			event,
			root: unknown,
			grade: unknown,
			subject: unknown,
			language: unknown,
			period: unknown,
			unit: unknown,
			lesson: unknown,
		): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = changeContext(where, grade, subject, language, period);
			if ("ok" in context) return context;
			const wantedUnit =
				typeof unit === "number" && Number.isInteger(unit) ? unit : undefined;
			const wantedLesson =
				typeof lesson === "number" && Number.isInteger(lesson)
					? lesson
					: undefined;
			if (unit !== undefined && wantedUnit === undefined)
				return failure("invalidName");
			if (lesson !== undefined && wantedLesson === undefined)
				return failure("invalidName");
			const choice: AcceptChoice =
				wantedUnit === undefined
					? { kind: "all" }
					: wantedLesson === undefined
						? { kind: "unit", unit: wantedUnit }
						: { kind: "lesson", unit: wantedUnit, lesson: wantedLesson };
			const accepted = acceptChange({
				root: where,
				model: context.model,
				files: context.rows,
				target: context.target,
				choice,
			});
			if (!accepted.ok) return accepted;
			return { ok: true };
		},
	);

	ipcMain.handle(
		"studio:rejectChanges",
		(
			event,
			root: unknown,
			grade: unknown,
			subject: unknown,
			language: unknown,
			period: unknown,
		): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = changeContext(where, grade, subject, language, period);
			if ("ok" in context) return context;
			return rejectChange(where, context.target);
		},
	);

	ipcMain.handle(
		"studio:deleteChanges",
		(
			event,
			root: unknown,
			grade: unknown,
			subject: unknown,
			language: unknown,
			period: unknown,
		): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = changeContext(where, grade, subject, language, period);
			if ("ok" in context) return context;
			return deleteChange(where, context.target);
		},
	);

	ipcMain.handle(
		"studio:saveUnitsSettings",
		(
			_event,
			model: unknown,
			limit: unknown,
		): { ok: true; settings: NoteSettings } | Failure => {
			const settings = writeUnitsSettings(userData(), { model, limit });
			return settings === null
				? { ok: false, code: "invalidName" }
				: { ok: true, settings };
		},
	);

	// The exams step (task 177): one request per course, the same key, limit and rules cache as
	// the units step. The page sends only a grade and a subject; every path is built here.
	ipcMain.handle(
		"studio:examsPlan",
		async (
			event,
			root: unknown,
			grade: unknown,
			subject: unknown,
			language: unknown,
		): Promise<ExamsPlanView> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = examContext(where, grade, subject, language);
			if ("ok" in context) return context;
			const rules = examRulesText();
			if (rules === "") return failure("missing");
			const settings = readUnitsSettings(userData());
			const plan = await planExamSet(
				where,
				context.model,
				context.rows,
				context.target,
				rules,
				settings.model,
			);
			return {
				ok: true,
				plan,
				limit: settings.limit,
				keySet: readKeyState(userData(), secrets).set,
			};
		},
	);

	ipcMain.handle(
		"studio:writeExams",
		async (
			event,
			root: unknown,
			grade: unknown,
			subject: unknown,
			language: unknown,
			limit: unknown,
		): Promise<ChangesWritten> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = examContext(where, grade, subject, language);
			if ("ok" in context) return context;
			const key = loadKey(userData(), secrets);
			if (key === null) return { ok: false, code: "noKey" };
			const rules = examRulesText();
			if (rules === "") return failure("missing");
			const settings = readUnitsSettings(userData());
			const prices = await modelInfo(settings.model).catch(() => null);
			const amount =
				typeof limit === "number" && Number.isFinite(limit)
					? Math.min(100, Math.max(0.01, limit))
					: settings.limit;
			const written = await writeExamSet({
				root: where,
				model: context.model,
				rows: context.rows,
				target: context.target,
				rules,
				key,
				modelName: settings.model,
				priceIn: prices?.priceIn ?? null,
				priceOut: prices?.priceOut ?? null,
				limitUsd: amount,
				today: new Date(),
			});
			if (!written.ok) return written;
			return { ok: true, spent: written.spentUsd };
		},
	);

	ipcMain.handle(
		"studio:prepareExamsJob",
		(event, root: unknown, targets: unknown, tool: unknown): JobMade => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const model = readModel(where);
			if (!model.ok) return model;
			const files = readFiles(where);
			if (!files.ok) return files;
			const rules = examRulesText();
			if (rules === "") return failure("missing");
			const wanted = Array.isArray(targets) ? targets.slice(0, 40) : [];
			const chosen = new Map<string, ExamTarget>();
			for (const item of wanted) {
				if (typeof item !== "object" || item === null) continue;
				const raw = item as Record<string, unknown>;
				const target = allowedExamTarget(
					model.model,
					raw.grade,
					raw.subject,
					raw.language,
					SUBJECT_IDS,
				);
				const key = target === null ? null : examKey(target);
				if (target !== null && key !== null && !chosen.has(key))
					chosen.set(key, target);
			}
			if (chosen.size === 0) return failure("missing");
			const chosenTool: JobTool =
				tool === "claude-code" ? "claude-code" : "other";
			return prepareExamsJob({
				root: where,
				model: model.model,
				rows: files.files,
				targets: [...chosen.values()],
				curriculum: basename(where),
				rules,
				tool: chosenTool,
				now: new Date(),
			});
		},
	);

	ipcMain.handle(
		"studio:collectExamsJob",
		(event, root: unknown, name: unknown): ChangesCollected => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const model = readModel(where);
			if (!model.ok) return model;
			const files = readFiles(where);
			if (!files.ok) return files;
			const outcome = collectExamsJob({
				root: where,
				model: model.model,
				files: files.files,
				name: text(name, 20),
				today: new Date(),
			});
			if ("ok" in outcome) return outcome;
			return {
				ok: true,
				collected: outcome.collected.length,
				skipped: outcome.skipped.length,
				refused: outcome.refused,
			};
		},
	);

	ipcMain.handle(
		"studio:deleteExamsJob",
		async (event, root: unknown, name: unknown): Promise<Done> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const job = text(name, 20);
			if (!/^\d{4}-\d{2}-\d{2}-\d{4}$/.test(job)) return failure("invalidName");
			const window = BrowserWindow.getFocusedWindow();
			const question = {
				type: "question" as const,
				buttons: ["Delete", "Cancel"],
				defaultId: 1,
				cancelId: 1,
				title: "Delete an exams job",
				message: `Delete the job "${job}"?`,
				detail:
					"Its folder goes, and any exam change set still waiting in out/. Sets already collected stay for review.",
			};
			const answer =
				window === null
					? await dialog.showMessageBox(question)
					: await dialog.showMessageBox(window, question);
			if (answer.response !== 0) return { ok: false, code: "cancelled" };
			return deleteJob(where, job, "exams");
		},
	);

	ipcMain.handle(
		"studio:acceptExams",
		(
			event,
			root: unknown,
			grade: unknown,
			subject: unknown,
			language: unknown,
			exam: unknown,
			paper: unknown,
		): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = examContext(where, grade, subject, language);
			if ("ok" in context) return context;
			const wantedExam =
				typeof exam === "number" && Number.isInteger(exam) ? exam : undefined;
			const wantedPaper =
				typeof paper === "number" && Number.isInteger(paper)
					? paper
					: undefined;
			if (exam !== undefined && wantedExam === undefined)
				return failure("invalidName");
			if (paper !== undefined && wantedPaper === undefined)
				return failure("invalidName");
			const accepted = acceptExamChange({
				root: where,
				model: context.model,
				files: context.rows,
				target: context.target,
				choice:
					wantedExam === undefined || wantedPaper === undefined
						? { kind: "all" }
						: { kind: "paper", exam: wantedExam, paper: wantedPaper },
			});
			if (!accepted.ok) return accepted;
			return { ok: true };
		},
	);

	ipcMain.handle(
		"studio:fixExams",
		(
			event,
			root: unknown,
			grade: unknown,
			subject: unknown,
			language: unknown,
			path: unknown,
			value: unknown,
		): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = examContext(where, grade, subject, language);
			if ("ok" in context) return context;
			const wantedPath = text(path, 200);
			if (!/^exams\[\d{1,3}\]\./.test(wantedPath))
				return failure("invalidName");
			const wantedValue =
				value === null
					? null
					: typeof value === "number" && Number.isFinite(value)
						? value
						: undefined;
			if (wantedValue === undefined) return failure("invalidName");
			return fixExamChange({
				root: where,
				model: context.model,
				files: context.rows,
				target: context.target,
				path: wantedPath,
				value: wantedValue,
			});
		},
	);

	ipcMain.handle(
		"studio:rejectExams",
		(
			event,
			root: unknown,
			grade: unknown,
			subject: unknown,
			language: unknown,
		): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = examContext(where, grade, subject, language);
			if ("ok" in context) return context;
			return rejectExamChange(where, context.target);
		},
	);

	ipcMain.handle(
		"studio:deleteExams",
		(
			event,
			root: unknown,
			grade: unknown,
			subject: unknown,
			language: unknown,
		): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = examContext(where, grade, subject, language);
			if ("ok" in context) return context;
			return deleteExamChange(where, context.target);
		},
	);
}

/** Asks before a file leaves the project: deleting goes to the Recycle Bin, never to nothing. */
async function confirmDelete(target: string): Promise<boolean> {
	const name = target.split(/[\\/]/).pop() ?? target;
	const window = BrowserWindow.getFocusedWindow();
	const question = {
		type: "question" as const,
		buttons: ["Move to Recycle Bin", "Cancel"],
		defaultId: 1,
		cancelId: 1,
		title: "Delete",
		message: `Move "${name}" to the Recycle Bin?`,
		detail: "It can be restored from the Recycle Bin if this was a mistake.",
	};
	const answer =
		window === null
			? await dialog.showMessageBox(question)
			: await dialog.showMessageBox(window, question);
	return answer.response === 0;
}
