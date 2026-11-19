// Which period of the year a file is for (task 249). A register row's `block` holds either the
// old block digits ("3", "2&3", read from "Block 3" in a path: the period `block-3`) or, since
// task 249, a period id of the year ("t1", "t1-b2", "year") read from a term folder or chosen
// in the file's details. One place turns that into period ids, so the scan, the units step and
// "Needs a look" all agree.

import type { BundlePeriod } from "./format/bundle.ts";

/** The periods a unit can sit in: leaves of the year that are not a whole-year exam. */
export function unitLeaves(periods: readonly BundlePeriod[]): BundlePeriod[] {
	const out: BundlePeriod[] = [];
	const walk = (list: readonly BundlePeriod[]) => {
		for (const period of list) {
			if (period.periods.length > 0) walk(period.periods);
			else if (!period.wholeYear) out.push(period);
		}
	};
	walk(periods);
	return out;
}

/** True when a year has more than one unit period, so every file needs its term. */
export function yearIsSplit(periods: readonly BundlePeriod[]): boolean {
	return unitLeaves(periods).length > 1;
}

/** Every period id of the year, at any level. */
export function allIds(periods: readonly BundlePeriod[]): Set<string> {
	const ids = new Set<string>();
	const walk = (list: readonly BundlePeriod[]) => {
		for (const period of list) {
			ids.add(period.id);
			walk(period.periods);
		}
	};
	walk(periods);
	return ids;
}

/**
 * The period ids a row's block names: a period id of the year stands for itself, digits for
 * the old `block-N` ("2&3" gives block-2 and block-3), anything else for nothing.
 */
export function blockIds(
	block: string,
	periods: readonly BundlePeriod[],
): string[] {
	const ids = allIds(periods);
	const out: string[] = [];
	for (const raw of block.split("&")) {
		const part = raw.trim();
		if (part === "") continue;
		const id = ids.has(part)
			? part
			: /^\w{1,4}$/.test(part)
				? `block-${part}`
				: null;
		if (id !== null && !out.includes(id)) out.push(id);
	}
	return out;
}

/**
 * The periods a row is for: the ones its block names, else the year's one unit period when
 * the year is not split. A year with several unit periods and no block gives none: which term
 * such a file is for is open, and it is listed under "Needs a look".
 */
export function rowPeriodIds(
	block: string,
	periods: readonly BundlePeriod[],
): string[] {
	const named = blockIds(block, periods);
	if (named.length > 0) return named;
	const leaves = unitLeaves(periods);
	return leaves.length === 1 && leaves[0] !== undefined ? [leaves[0].id] : [];
}

/** True when `id` is `target` or a period somewhere under it. */
export function periodWithin(
	id: string,
	target: string,
	periods: readonly BundlePeriod[],
): boolean {
	if (id === target) return true;
	const find = (list: readonly BundlePeriod[]): BundlePeriod | null => {
		for (const period of list) {
			if (period.id === target) return period;
			const deeper = find(period.periods);
			if (deeper !== null) return deeper;
		}
		return null;
	};
	const top = find(periods);
	return top === null ? false : allIds(top.periods).has(id);
}

/** A name as a folder comparison sees it: lowercase, single spaces, trimmed. */
function plain(name: string): string {
	return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** True when a folder name is this period's id, English or Arabic name. */
function names(period: BundlePeriod, folder: string): boolean {
	return [period.id, period.nameEn, period.nameAr].some(
		(name) => name.trim() !== "" && plain(name) === folder,
	);
}

/**
 * The unit period a path's folders name, or null. Folders are read from the outside in, a
 * level of the year at a time, so "Term 2/Block 1" is t2-b1 although every term has a
 * "Block 1"; a leaf whose name is unique may also stand alone ("t2-b1", "Semester 2"). Only a
 * split year's periods count: a year with one unit period needs no term folders.
 */
export function termOfFolders(
	folders: readonly string[],
	periods: readonly BundlePeriod[],
): string | null {
	const leaves = unitLeaves(periods);
	if (leaves.length < 2) return null;
	const plainFolders = folders.map(plain);
	let level: readonly BundlePeriod[] = periods;
	let from = 0;
	let found: BundlePeriod | null = null;
	for (;;) {
		let hit: { period: BundlePeriod; at: number } | null = null;
		for (let at = from; at < plainFolders.length && hit === null; at += 1) {
			const folder = plainFolders[at] ?? "";
			const period = level.find((entry) => names(entry, folder));
			if (period !== undefined) hit = { period, at };
		}
		if (hit === null) break;
		found = hit.period;
		from = hit.at + 1;
		if (found.periods.length === 0) break;
		level = found.periods;
	}
	if (found !== null && leaves.includes(found)) return found.id;
	for (const folder of plainFolders) {
		const named = leaves.filter((leaf) => names(leaf, folder));
		if (named.length === 1 && named[0] !== undefined) return named[0].id;
	}
	return null;
}

/** The folder path of every unit period, outside in ("Term 1/Block 1"), in the year's order. */
export function termPaths(
	periods: readonly BundlePeriod[],
	name: (period: BundlePeriod) => string,
): { id: string; path: string[] }[] {
	const out: { id: string; path: string[] }[] = [];
	const walk = (list: readonly BundlePeriod[], above: string[]) => {
		for (const period of list) {
			const path = [...above, name(period)];
			if (period.periods.length > 0) walk(period.periods, path);
			else if (!period.wholeYear) out.push({ id: period.id, path });
		}
	};
	walk(periods, []);
	return out;
}

/**
 * How a row's term reads to the author: the period's names from the top down ("Term 1 ·
 * Block 2"), or null when the block names no period of the year (old digits, or nothing).
 */
export function termLabel(
	block: string,
	periods: readonly BundlePeriod[],
	lang: "en" | "ar",
): string | null {
	const ids = blockIds(block, periods);
	if (ids.length !== 1) return null;
	const path = termPaths(periods, (period) =>
		lang === "ar" ? period.nameAr : period.nameEn,
	).find((entry) => entry.id === ids[0]);
	return path === undefined ? null : path.path.join(" · ");
}
