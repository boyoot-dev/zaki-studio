// The small typed surface the page may use (studio/src/preload). Every call goes to the main
// process, which first checks that the folder is one the author opened there, then that the
// path stays inside it, so the page never gets a file system, a shell or a network door. The
// renderer and the preload share these types; nothing here runs.

import type { AiChoice } from "./ai.ts";
import type { CourseNumberWarnings } from "./exam-numbers.ts";
import type { JobSummary, JobTool } from "./job.ts";
import type { LanguageWarning } from "./languages.ts";
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
import type { NotesFacets, NotesFilter } from "./notes-filter.ts";
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
	| "notEmpty"
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

/** The fields an author may correct on a register row, as the details form sends them. */
export type FileFields = {
	grade: number | null;
	subject: string;
	/** A language code, only when the subject is taught in more than one in the grade. */
	language?: string;
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
			/** The first steps a new project shows (task 243). */
			steps: FirstSteps;
	  }
	| Failure;

/** Which first steps are done: book in a folder, read by the Studio, units, exported. */
export type FirstSteps = {
	material: boolean;
	read: boolean;
	units: boolean;
	exported: boolean;
};

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
export type CourseHead = {
	grade: number;
	subject: string;
	/** The course's teaching language and help languages, from the project (task 225). */
	language: string;
	support: string[];
	/** How many units it has; 0 for a course of the project with none yet (task 246). */
	units: number;
};

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
			/** The accepted exams whose numbers don't add up, per course; the export still works. */
			examWarnings: CourseNumberWarnings[];
			/** Courses in a language Mr. Zaki can't use yet (task 225); the export still works. */
			languageWarnings: LanguageWarning[];
	  }
	| Failure;

/** An export that reached disk, or the problems the shared parser found instead. */
export type Exported =
	| { ok: true; version: number; path: string; summary: ModelSummary }
	| (Failure & { issues?: string[] });

/** What the page is shown about a curriculum file before it becomes a project (task 214). */
export type BundleInfo = {
	file: string;
	nameEn: string;
	nameAr: string;
	author: string;
	rights: string;
	version: number;
	summary: ModelSummary;
};

/** A curriculum file the main process read and checked, or why it couldn't. */
export type BundleChoice =
	| { ok: true; info: BundleInfo }
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
			/** The grades, subjects and blocks the Notes list's selects offer (task 178). */
			facets: NotesFacets;
	  }
	| Failure;

/** A plan with the settings it was made with; the key is still only a boolean. */
export type NotesPlanView =
	| { ok: true; plan: NotesPlan; limit: number; keySet: boolean }
	| Failure;

/** Every file a filter shows, by id, whether its page has been drawn or not (task 181). */
export type NotesIds = { ok: true; ids: string[] } | Failure;

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
	/** The course's teaching language (task 224). */
	language: string;
	period: string;
	units: number;
	lessons: number;
	/** The period's readable files, and how many of them have a note. */
	files: number;
	notes: number;
	/** True when a change set for it waits for review. */
	pending: boolean;
	/** True when the project has no course for this grade and subject yet (task 178). */
	newCourse: boolean;
	/** True when the course exists but has no unit in this period yet (task 178). */
	newBlock: boolean;
};

/** One course of the model, as the Changes tab lists its exams (task 177). */
export type ExamTargetView = {
	grade: number;
	subject: string;
	/** The course's teaching language (task 224). */
	language: string;
	/** The exams the course has now, and how many its exam files are. */
	exams: number;
	files: number;
	notes: number;
	/** The academic years older than the newest three that an exams request leaves out. */
	yearsLeftOut: string[];
	/** The files counted as exam papers (at most 30), by path and kind. */
	papers: { path: string; kind: string }[];
	/** True when an exam change set for it waits for review. */
	pending: boolean;
	/** True when the project has no course for this grade and subject yet (task 178). */
	newCourse: boolean;
};

/** The units model and the spending limit; never the key. */
export type ChangeSettings = { model: string; limit: number };

/** The Settings screen's state: the AI choice (null until chosen), each step's model and
 * limit, and whether a key is set; never the key itself. */
export type AiState = {
	ok: true;
	choice: AiChoice | null;
	notes: NoteSettings;
	units: ChangeSettings;
	keySet: boolean;
};

/** What keeping a choice gives. */
export type AiSaved = { ok: true; choice: AiChoice } | Failure;

/** What "Build from my book" shows before it starts (task 246). */
export type BookPlanView =
	| {
			ok: true;
			/** The course's files it will use (at most 200 listed), and how many in all. */
			files: { path: string; kind: string; pages: number; noted: boolean }[];
			fileCount: number;
			/** Files the Studio still has to read (no note yet). */
			toRead: number;
			/** The periods it will build. */
			periods: string[];
			/** About how long it takes, in minutes. */
			minutes: number;
			/** Files left out: the year is split and they have no term. */
			noTerm: number;
			/** With a key, about what it costs; null without a key or a price. */
			costUsd: number | null;
			/** The latest build jobs, newest first, to collect. */
			jobs: JobSummary[];
	  }
	| Failure;

/** A prepared build job: the message for the tool, and what it holds. */
export type BookJobMade =
	| {
			ok: true;
			name: string;
			path: string;
			prompt: string;
			files: number;
			notes: number;
			periods: number;
	  }
	| Failure;

/** What collecting a build job kept. */
export type BookJobCollected =
	| {
			ok: true;
			/** Files read (notes kept), and proposals kept for review. */
			read: number;
			sets: number;
			skipped: number;
			refused: { name: string; code: string }[];
	  }
	| Failure;

/** What a build with a key gave. */
export type BookBuiltView =
	| {
			ok: true;
			read: number;
			readFailed: number;
			sets: number;
			failed: number;
			spent: number;
			stopped: boolean;
	  }
	| Failure;

/** Where a course period's browser rounds are (task 245); null when none were started. */
export type RoundsReply =
	| {
			ok: true;
			view: {
				round: number;
				total: number;
				outlineDone: boolean;
				unit: {
					number: number;
					title: string;
					part: number;
					parts: number;
				} | null;
				file: string;
				message: string;
				done: boolean;
			} | null;
	  }
	| Failure;

/** What a pasted answer gave: kept (and the next round), or refused with its reason. */
export type RoundAnswered =
	| {
			ok: true;
			accepted: boolean;
			issue: string;
			view: Extract<RoundsReply, { ok: true }>["view"];
	  }
	| Failure;

/** What a hand edit or an undo gave (task 247): the course now, or why not in plain words. */
export type EditReply =
	| {
			ok: true;
			done: boolean;
			issue: string;
			course: import("./model").ModelCourse | null;
			/** How many edits of this session can be undone. */
			undo: number;
	  }
	| Failure;

/** What one request would cost with the key (task 248); null without a price. */
export type RequestCost = { ok: true; costUsd: number | null } | Failure;

/** The browser way's one round for a request: the file (shown in Explorer) and the message. */
export type RequestUpload =
	| { ok: true; path: string; message: string }
	| Failure;

/** How far a build with a key is. */
export type BookProgress =
	| { stage: "reading" }
	| { stage: "notes"; done: number; total: number }
	| { stage: "units"; done: number; total: number };

/** What "Changes to review" shows: the periods, the sets, and the units and exams jobs. */
export type ChangesState =
	| {
			ok: true;
			targets: ChangeTargetView[];
			/** The courses with exam papers, for the exams step. */
			examTargets: ExamTargetView[];
			/** The sets waiting for review, newest first. */
			sets: import("./changes").ChangeReview[];
			/** The sets the author rejected, kept for reference until deleted. */
			rejected: import("./changes").ChangeReview[];
			settings: ChangeSettings;
			keySet: boolean;
			jobs: JobSummary[];
			/** The exam jobs waiting for their tool's answer. */
			examJobs: JobSummary[];
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

/** What one exam change set would do, as the page shows it before anything is sent. */
export type ExamPlanView = {
	model: string;
	found: boolean;
	priceIn: number | null;
	priceOut: number | null;
	exams: number;
	parts: number;
	notes: number;
	yearsLeftOut: string[];
	in: number;
	out: number;
	estimateUsd: number | null;
};

/** An exam plan with the settings it was made with; the key is still only a boolean. */
export type ExamsPlanView =
	| { ok: true; plan: ExamPlanView; limit: number; keySet: boolean }
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

/** Why the system dialog asks for a folder: a new curriculum, or one to open (task 238). */
export type FolderPurpose = "new" | "open";

/** Everything the page can ask the main process to do. */
export type StudioApi = {
	/** Asks for a folder with the system dialog; the purpose names what it is for. */
	chooseFolder(purpose?: FolderPurpose): Promise<string | null>;
	/** Opens a project folder, or says it needs the wizard. */
	openProject(root: string): Promise<ProjectOpen>;
	/** Adopts today's material: three dialogs, then the project is written and opened. */
	adoptProject(): Promise<ProjectOpen>;
	/** Opens one of the recent projects; only the ones the main process remembers. */
	openRecent(root: string): Promise<ProjectOpen>;
	/** The curriculum's header and its courses' heads, for the Curriculum tab's nav (task 168). */
	readModel(root: string): Promise<ModelOverview>;
	/** One course in full, for the Curriculum tab's chosen course (task 168). */
	course(
		root: string,
		grade: number,
		subject: string,
		language: string,
	): Promise<CourseOpen>;
	/** Sets courses' teaching and help languages in the project file (task 225). */
	setCourseLanguages(
		root: string,
		changes: {
			grade: number;
			subject: string;
			language: string;
			support: string[];
		}[],
	): Promise<Done>;
	/** Adds this grade's subject in another language to the project file (task 228). */
	addCourseLanguage(
		root: string,
		grade: number,
		subject: string,
		language: string,
	): Promise<Done>;
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
	/** Asks for a .zaki file, then reads and checks it; the main process keeps it (task 214). */
	chooseBundle(): Promise<BundleChoice>;
	/** The .zaki file the Studio was opened with (double-click), read and checked, if any. */
	launchedBundle(): Promise<BundleChoice>;
	/** Called when a .zaki file is double-clicked while the Studio is already open. */
	onBundleLaunched(callback: () => void): () => void;
	/** Asks for an empty folder and makes the kept curriculum file a project in it. */
	projectFromBundle(): Promise<ProjectOpen>;
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
	notesState(root: string, filter?: NotesFilter): Promise<NotesState>;
	/** One page of the files without a note, grouped and flattened (task 168). */
	notesRows(
		root: string,
		offset: number,
		limit: number,
		filter?: NotesFilter,
	): Promise<({ ok: true } & ItemsPage<NotesListItem>) | Failure>;
	/** Every id a filter shows, loaded page or not, for "tick all shown" (task 181). */
	notesIds(root: string, filter?: NotesFilter): Promise<NotesIds>;
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
	/** What "Build from my book" would use for a course (task 246). */
	bookPlan(
		root: string,
		grade: number,
		subject: string,
		language: string,
	): Promise<BookPlanView>;
	/** Scans, then prepares one build job for the author's AI tool. */
	prepareBook(
		root: string,
		grade: number,
		subject: string,
		language: string,
	): Promise<BookJobMade>;
	/** Collects a build job: its notes, then its proposals. */
	collectBook(root: string, name: string): Promise<BookJobCollected>;
	/** Scans, writes the missing notes and the proposals with the key. */
	buildBook(
		root: string,
		grade: number,
		subject: string,
		language: string,
	): Promise<BookBuiltView>;
	/** Makes one hand edit to a course (task 247). */
	editCourse(
		root: string,
		grade: number,
		subject: string,
		language: string,
		edit: import("./edit").Edit,
	): Promise<EditReply>;
	/** What one request to the AI would cost with the key (task 248). */
	requestCost(
		root: string,
		request: import("./request").UnitRequest,
	): Promise<RequestCost>;
	/** Prepares a units job for one request, for the author's AI tool. */
	prepareRequest(
		root: string,
		request: import("./request").UnitRequest,
	): Promise<JobMade>;
	/** Sends one request with the key, and keeps the answer for review. */
	sendRequest(
		root: string,
		request: import("./request").UnitRequest,
	): Promise<ChangesWritten>;
	/** Writes the browser way's upload for one request and shows it in Explorer. */
	requestUpload(
		root: string,
		request: import("./request").UnitRequest,
	): Promise<RequestUpload>;
	/** Checks a pasted answer to one request and keeps it for review. */
	answerRequest(
		root: string,
		request: import("./request").UnitRequest,
		answer: string,
	): Promise<RoundAnswered>;
	/** Undoes the last hand edit of this session. */
	undoEdit(root: string): Promise<EditReply>;
	/** Where a course period's browser rounds are. */
	roundsState(
		root: string,
		grade: number,
		subject: string,
		language: string,
		period: string,
	): Promise<RoundsReply>;
	/** Scans, then starts a course period's rounds from the outline. */
	startRounds(
		root: string,
		grade: number,
		subject: string,
		language: string,
		period: string,
	): Promise<RoundsReply>;
	/** Checks a pasted answer for the round the period is at. */
	answerRound(
		root: string,
		grade: number,
		subject: string,
		language: string,
		period: string,
		answer: string,
	): Promise<RoundAnswered>;
	/** Shows the current round's file in Explorer. */
	showRoundFile(
		root: string,
		grade: number,
		subject: string,
		language: string,
		period: string,
	): Promise<Done>;
	/** Tells the page how far a build with a key has got. */
	onBookProgress(callback: (progress: BookProgress) => void): () => void;
	/** How the author uses AI on this computer, and the settings the Settings screen shows. */
	aiState(): Promise<AiState>;
	/** Keeps how the author uses AI (task 244). */
	saveAi(choice: AiChoice): Promise<AiSaved>;
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
		language: string,
		period: string,
	): Promise<UnitsPlanView>;
	/** Writes one period's change set with the author's key, and keeps it for review. */
	writeChanges(
		root: string,
		grade: number,
		subject: string,
		language: string,
		period: string,
		limit: number,
	): Promise<ChangesWritten>;
	/** Writes a units job folder for the chosen periods, and returns its prompt. */
	prepareUnitsJob(
		root: string,
		targets: {
			grade: number;
			subject: string;
			language: string;
			period: string;
		}[],
		tool: JobTool,
	): Promise<JobMade>;
	/** Reads a units job's out/ folder and keeps every change set that passes the checks. */
	collectUnitsJob(root: string, name: string): Promise<ChangesCollected>;
	/** Deletes a units job's folder, after a confirmation. */
	deleteUnitsJob(root: string, name: string): Promise<Done>;
	/** What one course's exams would take, before anything is sent (task 177). */
	examsPlan(
		root: string,
		grade: number,
		subject: string,
		language: string,
	): Promise<ExamsPlanView>;
	/** Writes one course's exam change set with the author's key. */
	writeExams(
		root: string,
		grade: number,
		subject: string,
		language: string,
		limit: number,
	): Promise<ChangesWritten>;
	/** Writes an exams job folder for the chosen courses, and returns its prompt. */
	prepareExamsJob(
		root: string,
		targets: { grade: number; subject: string; language: string }[],
		tool: JobTool,
	): Promise<JobMade>;
	/** Reads an exams job's out/ folder and keeps every set that passes the checks. */
	collectExamsJob(root: string, name: string): Promise<ChangesCollected>;
	/** Deletes an exams job's folder, after a confirmation. */
	deleteExamsJob(root: string, name: string): Promise<Done>;
	/** Accepts a whole exam change set, or one paper of it. */
	acceptExams(
		root: string,
		grade: number,
		subject: string,
		language: string,
		exam?: number,
		paper?: number,
	): Promise<Done>;
	/** Marks an exam change set as rejected, keeping it until it is deleted. */
	rejectExams(
		root: string,
		grade: number,
		subject: string,
		language: string,
	): Promise<Done>;
	/** Applies one safe number fix to a pending exam change set, then checks the set again. */
	fixExams(
		root: string,
		grade: number,
		subject: string,
		language: string,
		path: string,
		value: number | null,
	): Promise<Done>;
	/** Deletes a rejected exam change set's file. */
	deleteExams(
		root: string,
		grade: number,
		subject: string,
		language: string,
	): Promise<Done>;
	/** Merges a whole set, one unit, or one lesson into the model; the page sends no path. */
	acceptChanges(
		root: string,
		grade: number,
		subject: string,
		language: string,
		period: string,
		unit?: number,
		lesson?: number,
	): Promise<Done>;
	/** Keeps a rejected set as a file for reference, until it is deleted. */
	rejectChanges(
		root: string,
		grade: number,
		subject: string,
		language: string,
		period: string,
	): Promise<Done>;
	/** Deletes a change set's file. */
	deleteChanges(
		root: string,
		grade: number,
		subject: string,
		language: string,
		period: string,
	): Promise<Done>;
	/** Keeps the units model id and the spending limit. */
	saveUnitsSettings(
		model: string,
		limit: number,
	): Promise<{ ok: true; settings: ChangeSettings } | Failure>;
};
