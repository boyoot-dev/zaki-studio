// The small typed surface the page may use (studio/src/preload). Every call goes to the main
// process, which first checks that the folder is one the author opened there, then that the
// path stays inside it, so the page never gets a file system, a shell or a network door. The
// renderer and the preload share these types; nothing here runs.

import type { JobSummary, JobTool } from "./job.ts";
import type {
	ItemsPage,
	NotesListItem,
	ReportListItem,
	ReportMeta,
} from "./lists.ts";
import type {
	FileRow,
	ModelCourse,
	ModelCurriculum,
	ModelSummary,
} from "./model.ts";
import type { Project } from "./project.ts";

/** One row of the tree: a folder of the project, or a file in it. */
export type TreeNode = {
	/** The name shown: a folder's or file's own name. */
	name: string;
	/** The path from the project root, always with "/" between parts. */
	rel: string;
	kind: "folder" | "file";
	/** Bytes for a file, 0 for a folder. */
	size: number;
	/** The lowercase extension without the dot, or "" for a folder. */
	ext: string;
	children: TreeNode[];
	/** The files directly inside the folder, or 0 for a file (task 168). */
	files: number;
};

/** A folder at the top of a folder the author opened, for the wizard's guesses. */
export type GuessFolder = { name: string; children: string[] };

/** Why an operation stopped. The page turns each into a sentence in its own language. */
export type FailureCode =
	| "outside"
	| "notOpen"
	| "missing"
	| "tooLarge"
	| "unreadable"
	| "nameTaken"
	| "invalidName"
	| "invalidProject"
	| "noWork"
	| "emptyModel"
	| "invalidBundle"
	| "cancelled"
	| "noKey"
	| "noStorage"
	| "noCredit"
	| "refused"
	| "limit"
	| "unknown";

export type Failure = { ok: false; code: FailureCode; detail?: string };
export type Done = { ok: true } | Failure;

/** The result of opening a project folder, or of making one. */
export type ProjectOpen =
	| {
			ok: true;
			root: string;
			project: Project;
			tree: TreeNode[];
			/** The folder was already a project, so adopting opened it rather than writing. */
			already?: boolean;
	  }
	| (Failure & {
			/** True when the folder is not a project yet and the wizard can make it one. */
			needsWizard?: boolean;
			/** The grades and subjects the folder already holds, as names. */
			guess?: GuessFolder[];
	  });

/** A project the author opened before: kept in the app's user-data folder, not the project. */
export type RecentProject = {
	root: string;
	nameEn: string;
	nameAr: string;
	opened: number;
};

/** A file a viewer can show, capped in size so one big video can't fill the memory. */
export type FileBytes = { ok: true; name: string; bytes: Uint8Array } | Failure;
export type FileText = { ok: true; name: string; text: string } | Failure;
export type Imported = { ok: true; added: number; skipped: number } | Failure;
export type Made = { ok: true; rel: string } | Failure;

/** How far a scan has got, for the line the author watches (task 156). */
export type ScanProgress = {
	stage: "reading" | "pictures" | "ocr" | "done";
	/** How many material files the project holds. */
	found: number;
	/** How many files this scan had to read. */
	read: number;
	/** How many picture pages the scan has to draw and read, and how many it has done. */
	pages: number;
	done: number;
};

/** The five fields an author may correct on a register row, as the details form sends them. */
export type FileFields = {
	grade: number | null;
	subject: string;
	block: string;
	kind: string;
	authority: number | null;
};

/** The last scan's report, and how many files the register holds, for the "New material" panel. */
export type ScanState =
	| {
			ok: true;
			/** How many files the register holds. */
			total: number;
			/** The header of the last scan's report, or null when there is none. */
			meta: ReportMeta | null;
	  }
	| Failure;

/** What a scan found: the report's header, the register's size, and whether the author stopped it. */
export type Scanned =
	| {
			ok: true;
			stopped: boolean;
			/** How many files the register holds. */
			total: number;
			/** The header of the report the scan just wrote, or null when it found nothing new. */
			meta: ReportMeta | null;
	  }
	| Failure;

/** One course of the model, as the curriculum's nav lists it (no units; task 168). */
export type CourseHead = { grade: number; subject: string };

/** The curriculum's header and its courses' heads, for the Curriculum tab's nav. */
export type ModelOverview =
	| {
			ok: true;
			/** `.studio/model/curriculum.json`, the names and periods of the year. */
			curriculum: ModelCurriculum;
			courses: CourseHead[];
	  }
	| Failure;

/** One course in full, for the Curriculum tab's chosen course (task 168). */
export type CourseOpen = { ok: true; course: ModelCourse } | Failure;

/** What the page shows before saving an export, and whether the author must fill two fields. */
export type ExportCheck =
	| {
			ok: true;
			version: number;
			summary: ModelSummary;
			needsAuthor: boolean;
			author: string;
			rights: string;
	  }
	| Failure;

/** An export that reached disk, or the problems the shared parser found instead. */
export type Exported =
	| { ok: true; version: number; path: string; summary: ModelSummary }
	| (Failure & { issues?: string[] });

/** The model and the spending limit the notes run uses; never the key. */
export type NoteSettings = { model: string; limit: number };

/** What a notes run would do, as the page shows it before anything is sent. */
export type NotesPlan = {
	model: string;
	/** True when OpenRouter's live list knows this model id. */
	found: boolean;
	/** False: the model gets OCR text only, and the page warns that pictures are skipped. */
	readsImages: boolean;
	priceIn: number | null;
	priceOut: number | null;
	files: number;
	pages: number;
	imagePages: number;
	/** US dollars, or null when the model's price is not known. */
	estimateUsd: number | null;
};

/** What the Notes tab shows: how many files lack a note, the settings and the jobs. */
export type NotesState =
	| {
			ok: true;
			/** How many files the register holds. */
			total: number;
			/** The files a run would note now, in its order (id, path, pages). */
			missing: number;
			settings: NoteSettings;
			/** The page only ever learns whether a key is set, never the key. */
			keySet: boolean;
			jobs: JobSummary[];
	  }
	| Failure;

/** A plan with the settings it was made with; the key is still only a boolean. */
export type NotesPlanView =
	| { ok: true; plan: NotesPlan; limit: number; keySet: boolean }
	| Failure;

/** One note as plain text (Markdown is never rendered as HTML). */
export type NoteText = { ok: true; text: string } | Failure;

/** How far a notes run has got, for the line the author watches. */
export type NotesProgress = { done: number; total: number; id: string };

/** What a notes run wrote, and the files it could not write. */
export type NotesWritten =
	| {
			ok: true;
			written: number;
			failed: { id: string; path: string; reason: string }[];
			/** True when the spending limit stopped the run. */
			stopped: boolean;
	  }
	| Failure;

/** A job folder the Studio prepared, with the exact prompt to paste. */
export type JobMade =
	| { ok: true; name: string; path: string; prompt: string; files: number }
	| Failure;

/** One course and period of the model, as the Changes tab lists it (task 158). */
export type ChangeTargetView = {
	grade: number;
	subject: string;
	period: string;
	units: number;
	lessons: number;
	/** The period's readable files, and how many of them have a note. */
	files: number;
	notes: number;
	/** True when a change set for it waits for review. */
	pending: boolean;
};

/** The units model and the spending limit; never the key. */
export type ChangeSettings = { model: string; limit: number };

/** What "Changes to review" shows: the periods, the sets, and the units jobs. */
export type ChangesState =
	| {
			ok: true;
			targets: ChangeTargetView[];
			/** The sets waiting for review, newest first. */
			sets: import("./changes").ChangeReview[];
			/** The sets the author rejected, kept for reference until deleted. */
			rejected: import("./changes").ChangeReview[];
			settings: ChangeSettings;
			keySet: boolean;
			jobs: JobSummary[];
	  }
	| Failure;

/** What one change set would do, as the page shows it before anything is sent. */
export type ChangePlanView = {
	model: string;
	found: boolean;
	priceIn: number | null;
	priceOut: number | null;
	units: number;
	lessons: number;
	notes: number;
	in: number;
	out: number;
	/** US dollars, or null when the model's price is not known. */
	estimateUsd: number | null;
};

/** A plan with the settings it was made with; the key is still only a boolean. */
export type UnitsPlanView =
	| { ok: true; plan: ChangePlanView; limit: number; keySet: boolean }
	| Failure;

/** What writing a change set with the key gave: what it spent, and nothing about the key. */
export type ChangesWritten = { ok: true; spent: number } | Failure;

/** What collecting a units job kept, skipped and refused. */
export type ChangesCollected =
	| {
			ok: true;
			collected: number;
			skipped: number;
			refused: { name: string; code: string }[];
	  }
	| Failure;

/** What collecting a job's notes kept, skipped and refused. */
export type JobCollected =
	| {
			ok: true;
			collected: number;
			skipped: number;
			refused: { name: string; code: string }[];
	  }
	| Failure;

/** Everything the page can ask the main process to do. */
export type StudioApi = {
	/** Asks for a folder with the system dialog. */
	chooseFolder(): Promise<string | null>;
	/** Opens a project folder, or says it needs the wizard. */
	openProject(root: string): Promise<ProjectOpen>;
	/** Adopts today's material: three dialogs, then the project is written and opened. */
	adoptProject(): Promise<ProjectOpen>;
	/** Opens one of the recent projects; only the ones the main process remembers. */
	openRecent(root: string): Promise<ProjectOpen>;
	/** The curriculum's header and its courses' heads, for the Curriculum tab's nav (task 168). */
	readModel(root: string): Promise<ModelOverview>;
	/** One course in full, for the Curriculum tab's chosen course (task 168). */
	course(root: string, grade: number, subject: string): Promise<CourseOpen>;
	/** The register's row for one path, for the file's details pane (task 168). */
	fileRow(
		root: string,
		path: string,
	): Promise<{ ok: true; row: FileRow | null } | Failure>;
	/** The register rows these ids name, as path and size, for the fact chips (task 168). */
	filePaths(
		root: string,
		ids: string[],
	): Promise<
		| {
				ok: true;
				paths: Record<string, { path: string; size: number }>;
		  }
		| Failure
	>;
	/** Every folder of the project's tree, as relative paths, for the Inbox's picker (task 168). */
	folders(root: string): Promise<{ ok: true; folders: string[] } | Failure>;
	/** A page of a file's text kept in the project. */
	readPageText(
		root: string,
		id: string,
		page: number,
	): Promise<{ ok: true; text: string } | Failure>;
	/** What an export would carry, and the version it would take. Nothing is written. */
	exportSummary(root: string): Promise<ExportCheck>;
	/** Checks the bundle, asks where to save it, writes it, and keeps a copy per version. */
	exportBundle(root: string, author: string, rights: string): Promise<Exported>;
	/** Creates the project's folders and curriculum.json where the wizard showed them. */
	createProject(root: string, project: Project): Promise<ProjectOpen>;
	/** The projects opened before, newest first. */
	recentProjects(): Promise<RecentProject[]>;
	/** The one level of the tree at `rel` ("" is the top): folders carry the count of files
	 * directly in them (task 168). */
	listTree(
		root: string,
		rel?: string,
	): Promise<{ ok: true; nodes: TreeNode[] } | Failure>;
	/** Files and folders dropped from Explorer, copied in. */
	importPaths(
		root: string,
		targetRel: string,
		paths: string[],
	): Promise<Imported>;
	/** A pasted image, saved as a PNG with a dated name. */
	savePastedImage(
		root: string,
		targetRel: string,
		bytes: Uint8Array,
		ext: string,
	): Promise<Done>;
	/** Moves a file or folder inside the project. */
	moveEntry(root: string, fromRel: string, toRel: string): Promise<Done>;
	/** Renames a file or folder inside the project; the answer is the new path. */
	renameEntry(root: string, rel: string, name: string): Promise<Made>;
	/** Deletes a file or folder, to the Recycle Bin, after a confirmation. */
	trashEntry(root: string, rel: string): Promise<Done>;
	/** Makes the next numbered unit folder in a Units folder. */
	makeUnit(root: string, unitsRel: string, title: string): Promise<Made>;
	/** A file's bytes, for the image, audio and PDF viewers. */
	readFile(root: string, rel: string): Promise<FileBytes>;
	/** A text or Markdown file, as plain text. */
	readText(root: string, rel: string): Promise<FileText>;
	/** Looks for new material, reads it and reads its picture pages; progress through onScanProgress. */
	scanMaterial(root: string): Promise<Scanned>;
	/** Stops the scan this window is running, after the page it is on. */
	cancelScan(): Promise<Done>;
	/** How many files the register holds, and the last scan's report header. Nothing is scanned. */
	scanState(root: string): Promise<ScanState>;
	/** One page of the last scan's report, flattened for the New material list (task 168). */
	reportRows(
		root: string,
		offset: number,
		limit: number,
	): Promise<({ ok: true } & ItemsPage<ReportListItem>) | Failure>;
	/** Keeps the author's corrections on one row; a later scan keeps them too. */
	setFileFields(root: string, id: string, fields: FileFields): Promise<Done>;
	/** Tells the page how far the scan has got. */
	onScanProgress(callback: (progress: ScanProgress) => void): () => void;
	/** A Word file's text (extractRawText only, never its HTML). */
	readWord(root: string, rel: string): Promise<FileText>;
	/** Opens a document in the app Windows has for it, after a confirmation. */
	openInApp(root: string, rel: string): Promise<Done>;
	/** Starts watching the project folder; the page hears about changes through the callback. */
	watchProject(root: string): Promise<Done>;
	/** Tells the page the project folder changed on disk (debounced). */
	onProjectChanged(callback: () => void): () => void;
	/** The real path of a file from a drop or a paste. */
	pathForFile(file: File): string;
	/** Puts text on the clipboard, for the job prompt's Copy button. */
	copyText(text: string): Promise<Done>;
	/** How many files lack a note, the notes settings and the job folders (task 168). */
	notesState(root: string): Promise<NotesState>;
	/** One page of the files without a note, grouped and flattened (task 168). */
	notesRows(
		root: string,
		offset: number,
		limit: number,
	): Promise<({ ok: true } & ItemsPage<NotesListItem>) | Failure>;
	/** One file's note, as plain text. */
	noteText(root: string, id: string): Promise<NoteText>;
	/** What a run would do, its cost and its limit; nothing is sent. */
	notesPlan(
		root: string,
		ids: string[],
		redo?: boolean,
	): Promise<NotesPlanView>;
	/** Writes notes with the author's key; progress comes through onNotesProgress. */
	writeNotes(
		root: string,
		ids: string[],
		limit: number,
		redo?: boolean,
	): Promise<NotesWritten>;
	/** Tells the page how far a notes run has got. */
	onNotesProgress(callback: (progress: NotesProgress) => void): () => void;
	/** Keeps the OpenRouter key in safeStorage; the page only learns that it was kept. */
	saveKey(key: string): Promise<Done>;
	/** Forgets the key on this computer. */
	clearKey(): Promise<Done>;
	/** Sends one tiny request with the stored key, to check it works. */
	testKey(): Promise<Done>;
	/** Keeps the model id and the spending limit. */
	saveNoteSettings(
		model: string,
		limit: number,
	): Promise<{ ok: true; settings: NoteSettings } | Failure>;
	/** Writes a job folder for the author's own AI tool, and returns its prompt. */
	prepareJob(root: string, ids: string[], tool: JobTool): Promise<JobMade>;
	/** Reads a job's out/ folder and keeps every note that passes the checks. */
	collectJob(root: string, name: string): Promise<JobCollected>;
	/** Deletes a job's folder, after a confirmation. */
	deleteJob(root: string, name: string): Promise<Done>;
	/** The periods, the change sets waiting for review, the units settings and jobs (task 158). */
	changesState(root: string): Promise<ChangesState>;
	/** What writing one period's change set would take and cost; nothing is sent. */
	unitsPlan(
		root: string,
		grade: number,
		subject: string,
		period: string,
	): Promise<UnitsPlanView>;
	/** Writes one period's change set with the author's key, and keeps it for review. */
	writeChanges(
		root: string,
		grade: number,
		subject: string,
		period: string,
		limit: number,
	): Promise<ChangesWritten>;
	/** Writes a units job folder for the chosen periods, and returns its prompt. */
	prepareUnitsJob(
		root: string,
		targets: { grade: number; subject: string; period: string }[],
		tool: JobTool,
	): Promise<JobMade>;
	/** Reads a units job's out/ folder and keeps every change set that passes the checks. */
	collectUnitsJob(root: string, name: string): Promise<ChangesCollected>;
	/** Deletes a units job's folder, after a confirmation. */
	deleteUnitsJob(root: string, name: string): Promise<Done>;
	/** Merges a whole set, one unit, or one lesson into the model; the page sends no path. */
	acceptChanges(
		root: string,
		grade: number,
		subject: string,
		period: string,
		unit?: number,
		lesson?: number,
	): Promise<Done>;
	/** Keeps a rejected set as a file for reference, until it is deleted. */
	rejectChanges(
		root: string,
		grade: number,
		subject: string,
		period: string,
	): Promise<Done>;
	/** Deletes a change set's file. */
	deleteChanges(
		root: string,
		grade: number,
		subject: string,
		period: string,
	): Promise<Done>;
	/** Keeps the units model id and the spending limit. */
	saveUnitsSettings(
		model: string,
		limit: number,
	): Promise<{ ok: true; settings: ChangeSettings } | Failure>;
};
