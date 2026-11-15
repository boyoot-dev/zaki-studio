// Narrowing the Notes list (task 178): one grade, one subject, the blocks, academic years and file
// types it shows, and whether only the files without a note are shown. Pure, so the main process
// filters the rows before it flattens them into pages and the panel only renders what it gets. The
// filter never sees the author's selection: hiding a chosen file leaves it chosen, and the count
// stays the same.
//
// Several blocks, years and types may be chosen at once (task 181, 182). The boxes of one row are
// ORed and the rows are ANDed, so two blocks and two years give the files in either block that
// belong to either year.

import { GRADE_MAX, GRADE_MIN } from "./format/grades.ts";

/**
 * What the Notes list is narrowed to. A null grade or subject means every one. An empty
 * `blocks`, `years` or `kinds` means every block, year or type, while "" in the first two is
 * the files the register gives no block, or no academic year, at all.
 */
export type NotesFilter = {
	grade: number | null;
	subject: string | null;
	blocks: string[];
	years: string[];
	/** The file types to show, e.g. "exam" and "mark-scheme" (task 182). */
	kinds: string[];
	/** Show only the files that have no note yet; true is the panel's own default. */
	onlyMissing: boolean;
};

/** The filter a panel starts with: every block, year and type, and files without a note. */
export const ALL_NOTES: NotesFilter = {
	grade: null,
	subject: null,
	blocks: [],
	years: [],
	kinds: [],
	onlyMissing: true,
};

/** One row the filter reads: the place the register gives it, and whether it has a note. */
export type NotesFilterRow = {
	grade: number | null;
	subject: string;
	block: string;
	/** The file's type as the register names it, e.g. "exam" or "mark-scheme". */
	kind: string;
	/** The year the folder names, e.g. "2026-27"; "" when it names none. */
	academicYear: string;
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
			(filter.blocks.length === 0 || filter.blocks.includes(row.block)) &&
			(filter.years.length === 0 || filter.years.includes(row.academicYear)) &&
			(filter.kinds.length === 0 || filter.kinds.includes(row.kind)) &&
			(!filter.onlyMissing || !row.noted),
	);
}

/** The grades, subjects, blocks, years and types the filter's boxes are filled from. */
export type NotesFacets = {
	/** The grades the rows have, smallest first. */
	grades: number[];
	/** The subjects the rows name, alphabetically. */
	subjects: string[];
	/** The blocks the rows name, alphabetically; the files without one are `anyNoBlock`. */
	blocks: string[];
	/** True when some row has no block, so "no block" is a choice. */
	anyNoBlock: boolean;
	/** The academic years the rows name, newest first; the files without one are `anyNoYear`. */
	years: string[];
	/** True when some row has no academic year, so "no year" is a choice. */
	anyNoYear: boolean;
	/** The file types the rows have, alphabetically, under the grade and subject chosen. */
	kinds: string[];
};

/**
 * Every value a filter offers, read from the rows that are there. The types follow one grade and
 * subject, so the row offers only the types those files have; every other box is read from all
 * the rows, so choosing a grade never hides the other grades (task 182).
 */
export function notesFacets(
	rows: readonly {
		grade: number | null;
		subject: string;
		block: string;
		kind: string;
		academicYear: string;
	}[],
	narrow?: { grade: number | null; subject: string | null },
): NotesFacets {
	const grades = new Set<number>();
	const subjects = new Set<string>();
	const blocks = new Set<string>();
	const years = new Set<string>();
	const kinds = new Set<string>();
	let anyNoBlock = false;
	let anyNoYear = false;
	for (const row of rows) {
		if (row.grade !== null) grades.add(row.grade);
		if (row.subject !== "") subjects.add(row.subject);
		if (row.block === "") anyNoBlock = true;
		else blocks.add(row.block);
		if (row.academicYear === "") anyNoYear = true;
		else years.add(row.academicYear);
		const shown =
			narrow === undefined ||
			((narrow.grade === null || row.grade === narrow.grade) &&
				(narrow.subject === null || row.subject === narrow.subject));
		if (shown && row.kind !== "") kinds.add(row.kind);
	}
	return {
		grades: [...grades].sort((a, b) => a - b),
		subjects: [...subjects].sort((a, b) => a.localeCompare(b)),
		blocks: [...blocks].sort((a, b) => a.localeCompare(b)),
		anyNoBlock,
		// School years are written "2026-27", so the plain order read backwards is newest first.
		years: [...years].sort((a, b) => b.localeCompare(a)),
		anyNoYear,
		kinds: [...kinds].sort((a, b) => a.localeCompare(b)),
	};
}

/** A list of values one row of the filter may send, clamped to strings of a known length. */
function listOf(value: unknown, max: number): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	for (const item of value.slice(0, 50)) {
		if (typeof item === "string" && item.length <= max && !out.includes(item))
			out.push(item);
	}
	return out;
}

/**
 * A filter as the page sent it, with every value clamped to what the register can hold. A
 * value the page could not mean is the default (every grade, subject, block, year or type); a
 * missing "only without a note" is true, which is the panel's own default.
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
	return {
		grade,
		subject,
		blocks: listOf(raw.blocks, 20),
		years: listOf(raw.years, 12),
		kinds: listOf(raw.kinds, 20),
		onlyMissing: raw.onlyMissing !== false,
	};
}
