// Which pages the AI never used (task 250). An AI can skim a book or skip part of it and still
// write a valid proposal, so the Studio compares the pages with real text against the pages the
// proposal's facts cite, and says which were never used. It doesn't judge why: unused pages
// may be exercises or a contents list, or a chapter that was missed. The teacher looks and
// decides. Pure here; the main process reads the texts.

import { parseSource } from "./model.ts";

/** A page counts as text when it holds at least this many characters besides markers. */
export const TEXT_PAGE_CHARS = 200;
/** More than this share of unused text pages makes the line a warning. */
export const WARN_SHARE = 0.15;

/** One file's unused pages, as ranges. */
export type Unused = { id: string; path: string; ranges: [number, number][] };

/** What a proposal used of its files. */
export type Coverage = {
	/** Pages with real text, in all the files. */
	total: number;
	/** Of those, the pages at least one fact cites. */
	used: number;
	unused: Unused[];
	/** True when more than WARN_SHARE of the text pages are unused. */
	warn: boolean;
};

/** The pages of a file's text ("## Page N") that hold real text, picture markers left out. */
export function textPages(text: string): number[] {
	const out: number[] = [];
	for (const section of text.split(/(?=^## Page \d+)/m)) {
		const match = /^## Page (\d+)[^\n]*\n?([\s\S]*)$/.exec(section);
		if (match === null) continue;
		const body = (match[2] ?? "")
			.split("\n")
			.filter((line) => !/^\[ocr of image:/.test(line.trim()))
			.join("")
			.replace(/\s+/g, "");
		if (body.length >= TEXT_PAGE_CHARS) out.push(Number(match[1]));
	}
	return out;
}

/** Page numbers as ranges: 3, 4, 5, 9 → [3, 5], [9, 9]. */
export function ranges(pages: readonly number[]): [number, number][] {
	const sorted = [...new Set(pages)].sort((a, b) => a - b);
	const out: [number, number][] = [];
	for (const page of sorted) {
		const last = out[out.length - 1];
		if (last !== undefined && page === last[1] + 1) last[1] = page;
		else out.push([page, page]);
	}
	return out;
}

/** The pages each file's sources cite: "id#p6-8" counts 6, 7 and 8. */
export function citedPages(
	sources: readonly string[],
): Map<string, Set<number>> {
	const out = new Map<string, Set<number>>();
	for (const source of sources) {
		const parsed = parseSource(source);
		if (parsed === null || parsed.from === null) continue;
		const set = out.get(parsed.id) ?? new Set<number>();
		const to = parsed.to ?? parsed.from;
		for (
			let page = parsed.from;
			page <= to && page - parsed.from < 500;
			page += 1
		)
			set.add(page);
		out.set(parsed.id, set);
	}
	return out;
}

/** What the cited pages cover of the files' text pages. */
export function coverage(
	files: readonly { id: string; path: string; pages: readonly number[] }[],
	cited: ReadonlyMap<string, ReadonlySet<number>>,
): Coverage {
	let total = 0;
	let used = 0;
	const unused: Unused[] = [];
	for (const file of files) {
		const got = cited.get(file.id) ?? new Set<number>();
		const missing: number[] = [];
		for (const page of file.pages) {
			total += 1;
			if (got.has(page)) used += 1;
			else missing.push(page);
		}
		if (missing.length > 0)
			unused.push({ id: file.id, path: file.path, ranges: ranges(missing) });
	}
	return {
		total,
		used,
		unused,
		warn: total > 0 && (total - used) / total > WARN_SHARE,
	};
}

/**
 * The text pages an outline puts in no unit (browser rounds): the same shape, with an
 * outline's page ranges as what was "cited".
 */
export function outlineGaps(
	files: readonly { id: string; path: string; pages: readonly number[] }[],
	units: readonly {
		pages: readonly { file: string; from: number; to: number }[];
	}[],
): Coverage {
	const sources = units.flatMap((unit) =>
		unit.pages.map((range) => `${range.file}#p${range.from}-${range.to}`),
	);
	return coverage(files, citedPages(sources));
}
