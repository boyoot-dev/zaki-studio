// The IPC door between the page and the main process. Every handler takes arguments from a
// web page and therefore clamps them before use: a string is a string of a known shape and
// length, and a folder must be one the author opened in this window before anything is read
// or written (grants.ts), with the path inside it checked by the guard in files.ts. There is
// no channel that hands the page a file system, a process or a network call.

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
	ChangesCollected,
	ChangesState,
	ChangesWritten,
	ChangeTargetView,
	Done,
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
	ModelOpen,
	NoteSettings,
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
import type { JobTool } from "../shared/job.ts";
import type { CurriculumModel, FileRow } from "../shared/model.ts";
import { notingOrder } from "../shared/notes.ts";
import { rememberRecent } from "../shared/recent.ts";
import { currentAcademicYear } from "../shared/register.ts";
import {
	type AcceptChoice,
	changeName,
	notedRows,
	notesOrder,
	periodUnits,
	type Target,
	targetRows,
} from "../shared/targets.ts";
import { adoptMaterial } from "./adopt.ts";
import {
	acceptChange,
	collectUnitsJob,
	deleteChange,
	knownTarget,
	prepareUnitsJob,
	readChangeSets,
	readUnitsSettings,
	rejectChange,
	writeUnitsSettings,
} from "./changes.ts";
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
	readProject,
	readText,
	readTree,
	renameEntry,
	safePath,
	savePastedImage,
} from "./files.ts";
import { canonicalRoot, grantedRoot, sameFolder } from "./grants.ts";
import { collectJob, deleteJob, listJobs, prepareJob } from "./job.ts";
import {
	clearKey,
	loadKey,
	readKeyState,
	type Secrets,
	saveKey,
} from "./key.ts";
import {
	readFiles,
	readModel,
	readPageText,
	readReport,
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

/** The note rules, read from the Studio's own resources; "" when they are not there. */
function rulesText(): string {
	try {
		return readFileSync(
			join(studioRoot(), "resources", "rules", "note-rules.md"),
			"utf8",
		);
	} catch {
		return "";
	}
}

/** The change set's rules, read from the Studio's own resources; "" when they are not there. */
function unitsRulesText(): string {
	try {
		return readFileSync(
			join(studioRoot(), "resources", "rules", "unit-rules.md"),
			"utf8",
		);
	} catch {
		return "";
	}
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
	return {
		ok: true,
		root,
		project: read.project,
		tree: readTree(root),
	};
}

/** The watcher each window has, so a second ask (React's strict mode) replaces the first. */
const watchers = new Map<number, () => void>();

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

/** The model, the register and the target one change-set call is about. */
function changeContext(
	where: string,
	grade: unknown,
	subject: unknown,
	period: unknown,
): { model: CurriculumModel; rows: FileRow[]; target: Target } | Failure {
	const model = readModel(where);
	if (!model.ok) return model;
	const target = knownTarget(model.model, grade, subject, period);
	if (target === null)
		return { ok: false, code: "missing", detail: "no such course and period" };
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
			return {
				ok: true,
				root: materials,
				project: existing.project,
				tree: readTree(materials),
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
		return {
			ok: true,
			root: materials,
			project: outcome.project,
			tree: readTree(materials),
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

	ipcMain.handle("studio:model", (event, root: unknown): ModelOpen => {
		const where = text(root, 400);
		if (!allowed(event, where)) return notOpen();
		const model = readModel(where);
		if (!model.ok) return model;
		const files = readFiles(where);
		if (!files.ok) return files;
		return { ok: true, model: model.model, files: files.files };
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

	ipcMain.handle("studio:listTree", (event, root: unknown) => {
		const where = text(root, 400);
		if (!allowed(event, where)) return notOpen();
		return { ok: true as const, tree: readTree(where) };
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
				return await scanProject(where, {
					subjects: subjects.map((subject) => ({
						id: subject.id,
						contentLanguage: subject.contentLanguage,
					})),
					studioRoot: studioRoot(),
					render: (bytes, page) => renderer.render(bytes, page),
					ocr,
					cancelled: () => stopped.get(sender.id) === true,
					onProgress: (progress) => {
						if (!sender.isDestroyed())
							sender.send("studio:scanProgress", progress);
					},
				});
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
		return { ok: true, files: files.files, report: readReport(where) };
	});

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
	ipcMain.handle("studio:notesState", (event, root: unknown): NotesState => {
		const where = text(root, 400);
		if (!allowed(event, where)) return notOpen();
		const files = readFiles(where);
		if (!files.ok) return files;
		const settings = readNoteSettings(userData());
		return {
			ok: true,
			files: files.files,
			missing: notingOrder(
				files.files,
				noteIds(where),
				currentAcademicYear(new Date()),
			),
			settings,
			keySet: readKeyState(userData(), secrets).set,
			jobs: listJobs(where),
		};
	});

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
			const targets: ChangeTargetView[] = [];
			for (const course of model.model.courses) {
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
					const rows = targetRows(files.files, target);
					const key = changeName(target);
					targets.push({
						...target,
						units: units.length,
						lessons: units.reduce(
							(total, unit) => total + unit.lessons.length,
							0,
						),
						files: rows.length,
						notes: notedRows(notesOrder(rows), noted).length,
						pending:
							key !== null &&
							sets.sets.some(
								(set) => set.key === key && set.state === "pending",
							),
					});
				}
			}
			targets.sort(
				(a, b) =>
					a.grade - b.grade ||
					a.subject.localeCompare(b.subject) ||
					a.period.localeCompare(b.period),
			);
			return {
				ok: true,
				targets,
				sets: sets.sets.filter((set) => set.state === "pending"),
				rejected: sets.sets.filter((set) => set.state === "rejected"),
				settings: readUnitsSettings(userData()),
				keySet: readKeyState(userData(), secrets).set,
				jobs: listJobs(where, "units"),
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
			period: unknown,
		): Promise<UnitsPlanView> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = changeContext(where, grade, subject, period);
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
			if (plan === null) return failure("missing");
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
			period: unknown,
			limit: unknown,
		): Promise<ChangesWritten> => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = changeContext(where, grade, subject, period);
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
				const target = knownTarget(
					model.model,
					raw.grade,
					raw.subject,
					raw.period,
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
			period: unknown,
			unit: unknown,
			lesson: unknown,
		): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = changeContext(where, grade, subject, period);
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
			period: unknown,
		): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = changeContext(where, grade, subject, period);
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
			period: unknown,
		): Done => {
			const where = text(root, 400);
			if (!allowed(event, where)) return notOpen();
			const context = changeContext(where, grade, subject, period);
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
