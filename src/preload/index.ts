// The only door between the page and the main process: a small API exposed with
// contextBridge, one function per channel, no argument passed on unchecked. The page never
// sees ipcRenderer itself, so it can't call a channel we didn't write. `pathForFile` is the
// one exception to "everything goes to the main process": Chromium knows a dropped file's
// path and only the preload may ask it (webUtils), since Electron 32 took `File.path` away.

import { contextBridge, ipcRenderer, webUtils } from "electron";

import type {
	BookProgress,
	NotesProgress,
	ScanProgress,
	StudioApi,
} from "../shared/api";

const api: StudioApi = {
	chooseFolder: (purpose) => ipcRenderer.invoke("studio:chooseFolder", purpose),
	openProject: (root) => ipcRenderer.invoke("studio:openProject", root),
	adoptProject: () => ipcRenderer.invoke("studio:adoptProject"),
	readModel: (root) => ipcRenderer.invoke("studio:model", root),
	setCourseLanguages: (root, changes) =>
		ipcRenderer.invoke("studio:setCourseLanguages", root, changes),
	addCourseLanguage: (root, grade, subject, language) =>
		ipcRenderer.invoke(
			"studio:addCourseLanguage",
			root,
			grade,
			subject,
			language,
		),
	readPageText: (root, id, page) =>
		ipcRenderer.invoke("studio:pageText", root, id, page),
	exportSummary: (root) => ipcRenderer.invoke("studio:exportSummary", root),
	exportBundle: (root, author, rights) =>
		ipcRenderer.invoke("studio:exportBundle", root, author, rights),
	openRecent: (root) => ipcRenderer.invoke("studio:openRecent", root),
	createProject: (root, project) =>
		ipcRenderer.invoke("studio:createProject", root, project),
	recentProjects: () => ipcRenderer.invoke("studio:recentProjects"),
	chooseBundle: () => ipcRenderer.invoke("studio:chooseBundle"),
	launchedBundle: () => ipcRenderer.invoke("studio:launchedBundle"),
	onBundleLaunched: (callback) => {
		const listener = () => callback();
		ipcRenderer.on("studio:bundleLaunched", listener);
		return () => {
			ipcRenderer.removeListener("studio:bundleLaunched", listener);
		};
	},
	projectFromBundle: () => ipcRenderer.invoke("studio:projectFromBundle"),
	listTree: (root, rel) =>
		ipcRenderer.invoke("studio:listTree", root, rel ?? ""),
	course: (root, grade, subject, language) =>
		ipcRenderer.invoke("studio:course", root, grade, subject, language),
	fileRow: (root, path) => ipcRenderer.invoke("studio:fileRow", root, path),
	filePaths: (root, ids) => ipcRenderer.invoke("studio:filePaths", root, ids),
	folders: (root) => ipcRenderer.invoke("studio:folders", root),
	importPaths: (root, targetRel, paths) =>
		ipcRenderer.invoke("studio:importPaths", root, targetRel, paths),
	savePastedImage: (root, targetRel, bytes, ext) =>
		ipcRenderer.invoke("studio:savePastedImage", root, targetRel, bytes, ext),
	moveEntry: (root, fromRel, toRel) =>
		ipcRenderer.invoke("studio:moveEntry", root, fromRel, toRel),
	renameEntry: (root, rel, name) =>
		ipcRenderer.invoke("studio:renameEntry", root, rel, name),
	trashEntry: (root, rel) => ipcRenderer.invoke("studio:trashEntry", root, rel),
	makeUnit: (root, unitsRel, title) =>
		ipcRenderer.invoke("studio:makeUnit", root, unitsRel, title),
	readFile: (root, rel) => ipcRenderer.invoke("studio:readFile", root, rel),
	readText: (root, rel) => ipcRenderer.invoke("studio:readText", root, rel),
	scanMaterial: (root) => ipcRenderer.invoke("studio:scan", root),
	cancelScan: () => ipcRenderer.invoke("studio:scanCancel"),
	scanState: (root) => ipcRenderer.invoke("studio:scanState", root),
	reportRows: (root, offset, limit) =>
		ipcRenderer.invoke("studio:reportRows", root, offset, limit),
	setFileFields: (root, id, fields) =>
		ipcRenderer.invoke("studio:setFileFields", root, id, fields),
	onScanProgress: (callback) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			progress: ScanProgress,
		) => callback(progress);
		ipcRenderer.on("studio:scanProgress", listener);
		return () => {
			ipcRenderer.removeListener("studio:scanProgress", listener);
		};
	},
	readWord: (root, rel) => ipcRenderer.invoke("studio:readWord", root, rel),
	openInApp: (root, rel) => ipcRenderer.invoke("studio:openInApp", root, rel),
	watchProject: (root) => ipcRenderer.invoke("studio:watch", root),
	onProjectChanged: (callback) => {
		const listener = () => callback();
		ipcRenderer.on("studio:changed", listener);
		return () => {
			ipcRenderer.removeListener("studio:changed", listener);
		};
	},
	pathForFile: (file) => {
		try {
			return webUtils.getPathForFile(file);
		} catch {
			return "";
		}
	},
	copyText: (value) => ipcRenderer.invoke("studio:copyText", value),
	notesState: (root, filter) =>
		ipcRenderer.invoke("studio:notesState", root, filter),
	notesRows: (root, offset, limit, filter) =>
		ipcRenderer.invoke("studio:notesRows", root, offset, limit, filter),
	notesIds: (root, filter) =>
		ipcRenderer.invoke("studio:notesIds", root, filter),
	noteText: (root, id) => ipcRenderer.invoke("studio:noteText", root, id),
	notesPlan: (root, ids, redo) =>
		ipcRenderer.invoke("studio:notesPlan", root, ids, redo),
	writeNotes: (root, ids, limit, redo) =>
		ipcRenderer.invoke("studio:writeNotes", root, ids, limit, redo),
	onNotesProgress: (callback) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			progress: NotesProgress,
		) => callback(progress);
		ipcRenderer.on("studio:notesProgress", listener);
		return () => {
			ipcRenderer.removeListener("studio:notesProgress", listener);
		};
	},
	bookPlan: (root, grade, subject, language) =>
		ipcRenderer.invoke("studio:bookPlan", root, grade, subject, language),
	prepareBook: (root, grade, subject, language) =>
		ipcRenderer.invoke("studio:prepareBook", root, grade, subject, language),
	collectBook: (root, name) =>
		ipcRenderer.invoke("studio:collectBook", root, name),
	buildBook: (root, grade, subject, language) =>
		ipcRenderer.invoke("studio:buildBook", root, grade, subject, language),
	onBookProgress: (callback) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			progress: BookProgress,
		) => callback(progress);
		ipcRenderer.on("studio:bookProgress", listener);
		return () => ipcRenderer.removeListener("studio:bookProgress", listener);
	},
	roundsState: (root, grade, subject, language, period) =>
		ipcRenderer.invoke(
			"studio:roundsState",
			root,
			grade,
			subject,
			language,
			period,
		),
	startRounds: (root, grade, subject, language, period) =>
		ipcRenderer.invoke(
			"studio:startRounds",
			root,
			grade,
			subject,
			language,
			period,
		),
	answerRound: (root, grade, subject, language, period, answer) =>
		ipcRenderer.invoke(
			"studio:answerRound",
			root,
			grade,
			subject,
			language,
			period,
			answer,
		),
	showRoundFile: (root, grade, subject, language, period) =>
		ipcRenderer.invoke(
			"studio:showRoundFile",
			root,
			grade,
			subject,
			language,
			period,
		),
	editCourse: (root, grade, subject, language, change) =>
		ipcRenderer.invoke(
			"studio:editCourse",
			root,
			grade,
			subject,
			language,
			change,
		),
	undoEdit: (root) => ipcRenderer.invoke("studio:undoEdit", root),
	aiState: () => ipcRenderer.invoke("studio:aiState"),
	saveAi: (choice) => ipcRenderer.invoke("studio:saveAi", choice),
	saveKey: (key) => ipcRenderer.invoke("studio:saveKey", key),
	clearKey: () => ipcRenderer.invoke("studio:clearKey"),
	testKey: () => ipcRenderer.invoke("studio:testKey"),
	saveNoteSettings: (model, limit) =>
		ipcRenderer.invoke("studio:saveNoteSettings", model, limit),
	prepareJob: (root, ids, tool) =>
		ipcRenderer.invoke("studio:prepareJob", root, ids, tool),
	collectJob: (root, name) =>
		ipcRenderer.invoke("studio:collectJob", root, name),
	deleteJob: (root, name) => ipcRenderer.invoke("studio:deleteJob", root, name),
	changesState: (root) => ipcRenderer.invoke("studio:changesState", root),
	unitsPlan: (root, grade, subject, language, period) =>
		ipcRenderer.invoke(
			"studio:unitsPlan",
			root,
			grade,
			subject,
			language,
			period,
		),
	writeChanges: (root, grade, subject, language, period, limit) =>
		ipcRenderer.invoke(
			"studio:writeChanges",
			root,
			grade,
			subject,
			language,
			period,
			limit,
		),
	prepareUnitsJob: (root, targets, tool) =>
		ipcRenderer.invoke("studio:prepareUnitsJob", root, targets, tool),
	collectUnitsJob: (root, name) =>
		ipcRenderer.invoke("studio:collectUnitsJob", root, name),
	deleteUnitsJob: (root, name) =>
		ipcRenderer.invoke("studio:deleteUnitsJob", root, name),
	examsPlan: (root, grade, subject, language) =>
		ipcRenderer.invoke("studio:examsPlan", root, grade, subject, language),
	writeExams: (root, grade, subject, language, limit) =>
		ipcRenderer.invoke(
			"studio:writeExams",
			root,
			grade,
			subject,
			language,
			limit,
		),
	prepareExamsJob: (root, targets, tool) =>
		ipcRenderer.invoke("studio:prepareExamsJob", root, targets, tool),
	collectExamsJob: (root, name) =>
		ipcRenderer.invoke("studio:collectExamsJob", root, name),
	deleteExamsJob: (root, name) =>
		ipcRenderer.invoke("studio:deleteExamsJob", root, name),
	acceptExams: (root, grade, subject, language, exam, paper) =>
		ipcRenderer.invoke(
			"studio:acceptExams",
			root,
			grade,
			subject,
			language,
			exam,
			paper,
		),
	rejectExams: (root, grade, subject, language) =>
		ipcRenderer.invoke("studio:rejectExams", root, grade, subject, language),
	fixExams: (root, grade, subject, language, path, value) =>
		ipcRenderer.invoke(
			"studio:fixExams",
			root,
			grade,
			subject,
			language,
			path,
			value,
		),
	deleteExams: (root, grade, subject, language) =>
		ipcRenderer.invoke("studio:deleteExams", root, grade, subject, language),
	acceptChanges: (root, grade, subject, language, period, unit, lesson) =>
		ipcRenderer.invoke(
			"studio:acceptChanges",
			root,
			grade,
			subject,
			language,
			period,
			unit,
			lesson,
		),
	rejectChanges: (root, grade, subject, language, period) =>
		ipcRenderer.invoke(
			"studio:rejectChanges",
			root,
			grade,
			subject,
			language,
			period,
		),
	deleteChanges: (root, grade, subject, language, period) =>
		ipcRenderer.invoke(
			"studio:deleteChanges",
			root,
			grade,
			subject,
			language,
			period,
		),
	saveUnitsSettings: (model, limit) =>
		ipcRenderer.invoke("studio:saveUnitsSettings", model, limit),
};

contextBridge.exposeInMainWorld("studio", api);
