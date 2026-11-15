// Narrowing the Notes list (task 178): one grade, one subject, the blocks and academic years it
// shows, and whether only the files without a note are shown. Pure, so the main process filters
// the rows before it flattens them into pages and the panel only renders what it gets. The
// filter never sees the author's selection: hiding a chosen file leaves it chosen, and the
// count stays the same.
//
// Several blocks and several years may be chosen at once (task 181). The boxes of one row are
// ORed and the rows are ANDed, so two blocks and two years give the files in either block that
// belong to either year.

import { GRADE_MAX, GRADE_MIN } from "./format/grades.ts";

/**
 * What the Notes list is narrowed to. A null grade or subject means every one. An empty
 * `blocks` or `years` means every block or year, while "" in either is the files the register
 * gives no block, or no academic year, at all.
 */
export type NotesFilter = {
	grade: number | null;
	subject: string | null;
	blocks: string[];
	years: string[];
	/** Show only the files that have no note yet; true is the panel's own default. */
	onlyMissing: boolean;
};

/** The filter a panel starts with: every block and file without a note, as before task 178. */
export const ALL_NOTES: NotesFilter = {
	grade: null,
	subject: null,
	blocks: [],
	years: [],
	onlyMissing: true,
};

/** One row the filter reads: the place the register gives it, and whether it has a note. */
export type NotesFilterRow = {
	grade: number | null;
	subject: string;
	block: string;
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
			(!filter.onlyMissing || !row.noted),
	);
}

/** The grades, subjects, blocks and years the filter's boxes are filled from. */
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
};

/** Every value a filter offers, read from the rows that are there. */
export function notesFacets(
	rows: readonly {
		grade: number | null;
		subject: string;
		block: string;
		academicYear: string;
	}[],
): NotesFacets {
	const grades = new Set<number>();
	const subjects = new Set<string>();
	const blocks = new Set<string>();
	const years = new Set<string>();
	let anyNoBlock = false;
	let anyNoYear = false;
	for (const row of rows) {
		if (row.grade !== null) grades.add(row.grade);
		if (row.subject !== "") subjects.add(row.subject);
		if (row.block === "") anyNoBlock = true;
		else blocks.add(row.block);
		if (row.academicYear === "") anyNoYear = true;
		else years.add(row.academicYear);
	}
	return {
		grades: [...grades].sort((a, b) => a - b),
		subjects: [...subjects].sort((a, b) => a.localeCompare(b)),
		blocks: [...blocks].sort((a, b) => a.localeCompare(b)),
		anyNoBlock,
		// School years are written "2026-27", so the plain order read backwards is newest first.
		years: [...years].sort((a, b) => b.localeCompare(a)),
		anyNoYear,
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
 * value the page could not mean is the default (every grade, subject, block or year); a
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
		onlyMissing: raw.onlyMissing !== false,
	};
}
