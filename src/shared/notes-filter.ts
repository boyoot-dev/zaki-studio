// Narrowing the Notes list (task 178): one grade, one subject and one block, and whether only
// the files without a note are shown. Pure, so the main process filters the rows before it
// flattens them into pages and the panel only renders what it gets. The filter never sees the
// author's selection: hiding a chosen file leaves it chosen, and the count stays the same.

import { GRADE_MAX, GRADE_MIN } from "./format/grades.ts";

/**
 * What the Notes list is narrowed to. A null grade or subject means every one; a null block
 * means every block, while "" is the files the register gives no block at all.
 */
export type NotesFilter = {
	grade: number | null;
	subject: string | null;
	block: string | null;
	/** Show only the files that have no note yet; true is the panel's own default. */
	onlyMissing: boolean;
};

/** The filter a panel starts with: every block and file without a note, as before task 178. */
export const ALL_NOTES: NotesFilter = {
	grade: null,
	subject: null,
	block: null,
	onlyMissing: true,
};

/** One row the filter reads: the place the register gives it, and whether it has a note. */
export type NotesFilterRow = {
	grade: number | null;
	subject: string;
	block: string;
	noted: boolean;
};

/** The rows a filter keeps, in the order they came in. */
export function filterRows<T extends NotesFilterRow>(
	rows: readonly T[],
	filter: NotesFilter,
): T[] {
	return rows.filter(
		(row) =>
			(filter.grade === null || row.grade === filter.grade) &&
			(filter.subject === null || row.subject === filter.subject) &&
			(filter.block === null || row.block === filter.block) &&
			(!filter.onlyMissing || !row.noted),
	);
}

/** The grades, subjects and blocks the selects are filled from. */
export type NotesFacets = {
	/** The grades the rows have, smallest first. */
	grades: number[];
	/** The subjects the rows name, alphabetically. */
	subjects: string[];
	/** The blocks the rows name, alphabetically; the files without one are `anyNoBlock`. */
	blocks: string[];
	/** True when some row has no block, so "no block" is a choice. */
	anyNoBlock: boolean;
};

/** Every value a select may offer, read from the rows that are there. */
export function notesFacets(
	rows: readonly { grade: number | null; subject: string; block: string }[],
): NotesFacets {
	const grades = new Set<number>();
	const subjects = new Set<string>();
	const blocks = new Set<string>();
	let anyNoBlock = false;
	for (const row of rows) {
		if (row.grade !== null) grades.add(row.grade);
		if (row.subject !== "") subjects.add(row.subject);
		if (row.block === "") anyNoBlock = true;
		else blocks.add(row.block);
	}
	return {
		grades: [...grades].sort((a, b) => a - b),
		subjects: [...subjects].sort((a, b) => a.localeCompare(b)),
		blocks: [...blocks].sort((a, b) => a.localeCompare(b)),
		anyNoBlock,
	};
}

/**
 * A filter as the page sent it, with every value clamped to what the register can hold. A
 * value the page could not mean is the default (every grade, subject or block); a missing
 * "only without a note" is true, which is the panel's own default.
 */
export function notesFilterOf(value: unknown): NotesFilter {
	if (typeof value !== "object" || value === null) return ALL_NOTES;
	const raw = value as Record<string, unknown>;
	const grade =
		typeof raw.grade === "number" &&
		Number.isInteger(raw.grade) &&
		raw.grade >= GRADE_MIN &&
		raw.grade <= GRADE_MAX
			? raw.grade
			: null;
	const subject =
		typeof raw.subject === "string" &&
		raw.subject !== "" &&
		raw.subject.length <= 60
			? raw.subject
			: null;
	const block =
		typeof raw.block === "string" && raw.block.length <= 20 ? raw.block : null;
	return { grade, subject, block, onlyMissing: raw.onlyMissing !== false };
}
