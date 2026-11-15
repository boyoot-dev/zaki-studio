// The flattened lists behind the Notes and New material tabs (task 168): built once per
// change to the project — the register or a note changed — and served from memory after
// that, so a page of one list costs a slice, never a re-read of the register. The register
// itself is already cached (src/main/model.ts); the missing list's order changes only when
// a note lands or a file is corrected, so the memo's key is the stat of the things it
// reads: the register's file, and the notes folder.
//
// The Notes list can be narrowed by grade, subject, blocks, years and file types (task 178,
// 181, 182): the rows are read once, each saying whether it already has a note, and the filter
// hides rows before the list is grouped and paged, so a hidden row can never reach the page. The
// same filtered rows give the ids the panel's "all shown" buttons need, loaded page or not.

import { statSync } from "node:fs";
import { join } from "node:path";

import {
	type ItemsPage,
	type NotesListItem,
	notesListItems,
	pageSlice,
	type ReportListItem,
	reportListItems,
} from "../shared/lists.ts";
import type { FileRow } from "../shared/model.ts";
import { FILES_FILE } from "../shared/model.ts";
import { NOTES_DIR, notingOrder } from "../shared/notes.ts";
import {
	ALL_NOTES,
	filterRows,
	type NotesFacets,
	type NotesFilter,
	notesFacets,
} from "../shared/notes-filter.ts";
import { currentAcademicYear } from "../shared/register.ts";
import { readFiles, readReport } from "./model.ts";
import { noteIds } from "./notes.ts";

/** A register row the Notes list draws, and whether it already has a note (task 178). */
type ListedRow = FileRow & { noted: boolean };

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
	/** The rows every filter reads. */
	base: { key: string; rows: ListedRow[] } | null;
	/** The pages of one filter, kept until the filter changes. */
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
	memo = { base: null, notes: null, report: null };
	memos.set(root, memo);
	return memo;
}

/**
 * Every readable file the Notes list may draw, in the panel's order, each saying whether it
 * has a note. The list is built once per change to the register or the notes, so a filter only
 * hides what is already here.
 */
function listedRows(root: string): {
	key: string;
	rows: ListedRow[];
} {
	const today = currentAcademicYear(new Date());
	const holder = slot(root);
	const key = `${statOf(join(root, FILES_FILE))}|${statOf(join(root, NOTES_DIR))}|${today}`;
	if (holder.base?.key === key) return holder.base;
	const files = readFiles(root);
	const rows: FileRow[] = files.ok ? files.files : [];
	const noted = noteIds(root);
	// Every readable file, in the order a run would take them; a note only marks a row.
	const all = notingOrder(
		rows,
		noted,
		today,
		new Set(rows.map((row) => row.id)),
	);
	const listed = all.map((row) => ({ ...row, noted: noted.has(row.id) }));
	holder.base = { key, rows: listed };
	return holder.base;
}

/** The values the Notes tab's boxes are filled from; the types follow the chosen grade and
 * subject (task 182). */
export function notesFacetsOf(
	root: string,
	filter: NotesFilter = ALL_NOTES,
): NotesFacets {
	return notesFacets(listedRows(root).rows, filter);
}

/** The rows the Notes tab lists with this filter, in their panel order. */
export function notesItems(
	root: string,
	filter: NotesFilter = ALL_NOTES,
): NotesListItem[] {
	const base = listedRows(root);
	const holder = slot(root);
	const filterKey = JSON.stringify(filter);
	const key = `${base.key}|${filterKey}`;
	if (holder.notes?.key === key) return holder.notes.items;
	const items = notesListItems(filterRows(base.rows, filter));
	holder.notes = { key, items };
	return items;
}

/** One page of the Notes tab's flattened list, narrowed by the filter. */
export function notesPage(
	root: string,
	offset: number,
	limit: number,
	filter: NotesFilter = ALL_NOTES,
): ItemsPage<NotesListItem> {
	return pageSlice(notesItems(root, filter), offset, limit);
}

/**
 * The ids of the files the Notes tab shows with this filter, in their panel order: every one of
 * them, whether its page has been drawn or not (task 181). The rows come from the same memo the
 * pages are built from.
 */
export function notesIds(
	root: string,
	filter: NotesFilter = ALL_NOTES,
): string[] {
	return filterRows(listedRows(root).rows, filter).map((row) => row.id);
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
