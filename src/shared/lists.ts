// The flat, paged lists the page draws (task 168): the Notes tab's files without a note,
// grouped the way the panel groups them; and the last scan's report, in the order the
// panel shows it, one item per row or header. Flattening is pure, so it is tested directly;
// paging the items over IPC keeps every reply small, and the windowed list draws only what
// is on screen. Nothing here runs or reads files; it arranges what the register and the
// report already hold.

import type { FileRow } from "./model.ts";
import type { AffectedLine, LookReason, NewMaterial } from "./register.ts";

/** One item of the Notes tab's flattened list: a group's header, or one file. */
export type NotesListItem =
	| {
			kind: "group";
			key: string;
			grade: number | null;
			subject: string;
			block: string;
			/** The group's files, so the header can tick and untick them all at once. */
			ids: string[];
			count: number;
	  }
	| { kind: "row"; row: FileRow };

/** The files without a note, grouped and sorted the way the Notes panel shows them. */
export function notesListItems(missing: readonly FileRow[]): NotesListItem[] {
	const groups = new Map<
		string,
		{
			key: string;
			grade: number | null;
			subject: string;
			block: string;
			rows: FileRow[];
		}
	>();
	for (const row of missing) {
		const key = `${row.grade ?? "?"}|${row.subject}|${row.block}`;
		const group = groups.get(key) ?? {
			key,
			grade: row.grade,
			subject: row.subject,
			block: row.block,
			rows: [],
		};
		group.rows.push(row);
		groups.set(key, group);
	}
	const sorted = [...groups.values()].sort(
		(a, b) =>
			(a.grade ?? -1) - (b.grade ?? -1) ||
			a.subject.localeCompare(b.subject) ||
			a.block.localeCompare(b.block),
	);
	const items: NotesListItem[] = [];
	for (const group of sorted) {
		items.push({
			kind: "group",
			key: group.key,
			grade: group.grade,
			subject: group.subject,
			block: group.block,
			ids: group.rows.map((row) => row.id),
			count: group.rows.length,
		});
		for (const row of group.rows) items.push({ kind: "row", row });
	}
	return items;
}

/** One item of the New material tab's flattened list. */
export type ReportListItem =
	| {
			kind: "group";
			key: string;
			grade: number | null;
			subject: string;
			block: string;
	  }
	| { kind: "row"; row: FileRow }
	| { kind: "affectedTitle"; count: number }
	| {
			kind: "affectedBlock";
			key: string;
			grade: number | null;
			subject: string;
			block: string;
	  }
	| { kind: "affectedLine"; key: string; line: AffectedLine }
	| { kind: "lookTitle"; count: number }
	| { kind: "look"; row: FileRow; why: LookReason[] }
	| { kind: "totals"; copies: number; moved: number; removed: number }
	| { kind: "path"; path: string };

/** The last scan's report, in the order the New material panel shows it. */
export function reportListItems(report: NewMaterial): ReportListItem[] {
	const items: ReportListItem[] = [];
	for (const group of report.groups) {
		items.push({
			kind: "group",
			key: `${group.grade ?? "?"}|${group.subject}|${group.block}`,
			grade: group.grade,
			subject: group.subject,
			block: group.block,
		});
		for (const row of group.rows) items.push({ kind: "row", row });
	}
	if (report.affected.length > 0) {
		items.push({ kind: "affectedTitle", count: report.affected.length });
		for (const block of report.affected) {
			const key = `${block.grade ?? "?"}|${block.subject}|${block.block}`;
			items.push({
				kind: "affectedBlock",
				key,
				grade: block.grade,
				subject: block.subject,
				block: block.block,
			});
			for (const [index, line] of block.lines.entries())
				items.push({ kind: "affectedLine", key: `${key}-${index}`, line });
		}
	}
	items.push({ kind: "lookTitle", count: report.look.length });
	for (const { row, why } of report.look)
		items.push({ kind: "look", row, why });
	items.push({
		kind: "totals",
		copies: report.copies.length,
		moved: report.moved.length,
		removed: report.removed.length,
	});
	for (const path of [...report.moved, ...report.removed])
		items.push({ kind: "path", path });
	return items;
}

/** The counts the New material header shows, so the page never asks for the rows. */
export type ReportMeta = {
	at: string;
	since: string;
	found: number;
	read: number;
	/** How many picture pages the scan read with OCR. */
	ocrPages: number;
	/** How many files the report says are new (the whole list, not one page of it). */
	newCount: number;
	tessdataMissing: string[];
};

/** The header of a report, for the counts line. */
export function reportMeta(report: NewMaterial): ReportMeta {
	let newCount = 0;
	for (const group of report.groups) newCount += group.rows.length;
	return {
		at: report.at,
		since: report.since,
		found: report.found,
		read: report.read,
		ocrPages: report.ocrPages,
		newCount,
		tessdataMissing: report.tessdataMissing,
	};
}

/** One page of a flattened list: the items, and how many there are in total. */
export type ItemsPage<T> = { items: T[]; total: number };

/**
 * The slice of `items` a page asked for, with the clamp every page goes through: an offset
 * past the end is the last item, and a limit is never more than 1,000 items.
 */
export function pageSlice<T>(
	items: readonly T[],
	offset: number,
	limit: number,
): ItemsPage<T> {
	const total = items.length;
	const start = Math.max(0, Math.min(Math.floor(offset) || 0, total));
	const take = Math.max(1, Math.min(Math.floor(limit) || 1, 1000));
	return { items: items.slice(start, start + take), total };
}
