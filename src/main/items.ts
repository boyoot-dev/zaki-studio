// The flattened lists behind the Notes and New material tabs (task 168): built once per
// change to the project — the register or a note changed — and served from memory after
// that, so a page of one list costs a slice, never a re-read of the register. The register
// itself is already cached (src/main/model.ts); the missing list's order changes only when
// a note lands or a file is corrected, so the memo's key is the stat of the things it
// reads: the register's file, and the notes folder.

import { statSync } from "node:fs";
import { join } from "node:path";

import {
	type ItemsPage,
	type NotesListItem,
	type ReportListItem,
	notesListItems,
	pageSlice,
	reportListItems,
} from "../shared/lists.ts";
import { FILES_FILE } from "../shared/model.ts";
import { NOTES_DIR, notingOrder } from "../shared/notes.ts";
import { currentAcademicYear } from "../shared/register.ts";
import type { FileRow } from "../shared/model.ts";
import { readFiles, readReport } from "./model.ts";
import { noteIds } from "./notes.ts";

/** A file's stat as text, or "missing" when it is not there. */
function statOf(path: string): string {
	try {
		const info = statSync(path, { bigint: true });
		return `${info.mtimeNs}|${Number(info.size)}`;
	} catch {
		return "missing";
	}
}

/** How many projects the memos keep; the app holds a few at most. */
const KEEP = 4;

/** One project's flattened lists, kept until its inputs change. */
type Memo = {
	notes: { key: string; items: NotesListItem[] } | null;
	report: { key: string; items: ReportListItem[] } | null;
};

const memos = new Map<string, Memo>();

/** The project's memo slot, letting go of the oldest when too many are kept. */
function slot(root: string): Memo {
	let memo = memos.get(root);
	if (memo !== undefined) {
		memos.delete(root);
		memos.set(root, memo);
		return memo;
	}
	if (memos.size >= KEEP) {
		const oldest = memos.keys().next().value;
		if (oldest !== undefined) memos.delete(oldest);
	}
	memo = { notes: null, report: null };
	memos.set(root, memo);
	return memo;
}

/** The files the Notes tab lists without a note, in their panel order. */
export function notesItems(root: string): NotesListItem[] {
	const today = currentAcademicYear(new Date());
	const holder = slot(root);
	const key = `${statOf(join(root, FILES_FILE))}|${statOf(join(root, NOTES_DIR))}|${today}`;
	if (holder.notes?.key === key) return holder.notes.items;
	const files = readFiles(root);
	const rows: FileRow[] = files.ok ? files.files : [];
	const missing = notingOrder(rows, noteIds(root), today);
	const items = notesListItems(missing);
	holder.notes = { key, items };
	return items;
}

/** One page of the Notes tab's flattened list. */
export function notesPage(
	root: string,
	offset: number,
	limit: number,
): ItemsPage<NotesListItem> {
	return pageSlice(notesItems(root), offset, limit);
}

/** The last scan's report as a flattened list, or an empty list when there is none. */
export function reportItems(root: string): ReportListItem[] {
	const holder = slot(root);
	const report = readReport(root);
	const key = `${statOf(join(root, ".studio", "new.json"))}`;
	if (holder.report?.key === key) return holder.report.items;
	const items = report === null ? [] : reportListItems(report);
	holder.report = { key, items };
	return items;
}

/** One page of the New material tab's flattened list. */
export function reportPage(
	root: string,
	offset: number,
	limit: number,
): ItemsPage<ReportListItem> {
	return pageSlice(reportItems(root), offset, limit);
}

/** Throws away one project's memos; the watcher calls this when the folder changed. */
export function invalidateItems(root: string): void {
	memos.delete(root);
}
