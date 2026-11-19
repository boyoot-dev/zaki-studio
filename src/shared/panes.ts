// The widths and the limits of the resizable panes (task 154): the row the project's files
// are shown in (tree | file) and the Curriculum row (grades | lesson | where it came from).
// Every number, the Arabic mirror, and what a window too small for the widths it remembers
// falls back to live here, away from React, so a test can hold them still.

/** How wide a divider is: thin, and still easy to hit with a mouse. */
export const DIVIDER = 6;

/** How far one arrow key moves a divider. */
export const STEP = 16;

/** The narrowest a side pane (the tree, the grades, the source viewer) may be. */
export const MIN_SIDE = 180;

/** The narrowest the content pane (the lesson, or the file) may be. */
export const MIN_MIDDLE = 320;

/** The row widths a layout is kept for: 80 px apart, so a resize and back finds it again. */
export const WIDTH_STEP = 80;

/** How many row widths one view remembers before the farthest are dropped. */
export const SAVED_MAX = 12;

/** The two views whose panes resize. */
export type PanesView = "curriculum" | "files";

/** A view's widths: the side panes in pixels; the content pane takes what is left. */
export type PaneWidths = {
	/** The pane at the start of the row: the grades and subjects, or the tree. */
	start: number;
	/** The source viewer's width, kept while it is put away. 0 in the files view. */
	end: number;
	/** True when the author put the source viewer away with its button. */
	collapsed: boolean;
};

/** The widths the app starts with, before the author drags anything. */
export function defaultWidths(view: PanesView): PaneWidths {
	// The tree is as wide as it was before panes could move (21rem), and the grades (15rem)
	// and the source viewer (24rem) keep the proportions the Curriculum view opened with.
	if (view === "files") return { start: 336, end: 0, collapsed: false };
	return { start: 240, end: 384, collapsed: false };
}

/** True when a view has a source viewer at the end of its row. */
export function hasSource(view: PanesView): boolean {
	return view === "curriculum";
}

/**
 * The row width to lay the panes out for. A hidden row (a tab that is put away) measures
 * 0, which is not a width: the last real measurement stays. The next real one is used as it
 * is.
 */
export function nextTotal(previous: number, measured: number): number {
	return measured > 0 ? measured : previous;
}

/** How many side panes the row holds at its ends: the start one, and the source viewer. */
function sideCount(view: PanesView, collapsed: boolean): number {
	return hasSource(view) && !collapsed ? 2 : 1;
}

/** A width kept between a low and a high, in that order. */
function between(value: number, low: number, high: number): number {
	return Math.min(high, Math.max(low, value));
}

/**
 * The widths the row can hold at `total` pixels: a side pane keeps 180 px and the content
 * pane 320 px. A window too narrow for those limits keeps each pane's share of the room it
 * has instead of going smaller than it can.
 */
export function clampWidths(
	widths: PaneWidths,
	view: PanesView,
	total: number,
): PaneWidths {
	const isFiles = view === "files";
	const collapsed = isFiles ? false : widths.collapsed;
	const sides = sideCount(view, collapsed);
	const room = Math.max(0, total - sides * DIVIDER);
	const least = sides * MIN_SIDE + MIN_MIDDLE;
	const source = isFiles ? 0 : Math.max(MIN_SIDE, Math.round(widths.end));

	if (room < least) {
		const share = room / least;
		const side = Math.floor(MIN_SIDE * share);
		return { start: side, end: sides === 2 ? side : source, collapsed };
	}

	const allowed = room - MIN_MIDDLE;
	let start = Math.max(MIN_SIDE, Math.round(widths.start));
	let end = source;
	if (sides === 2) {
		// A smaller window takes room from both sides, each in proportion to what it holds
		// above its minimum, so neither loses the feel of the drag that set it.
		const over = start + end - allowed;
		const startSlack = start - MIN_SIDE;
		const endSlack = end - MIN_SIDE;
		const slack = startSlack + endSlack;
		if (over > 0 && slack > 0) {
			const take = Math.min(over, slack);
			start -= Math.round((take * startSlack) / slack);
			end -= Math.round((take * endSlack) / slack);
		}
		// Rounding can leave a pixel over; it comes off the wider pane.
		const rest = start + end - allowed;
		if (rest > 0) {
			if (start >= end && start - rest >= MIN_SIDE) start -= rest;
			else end = Math.max(MIN_SIDE, end - rest);
		}
	} else {
		start = between(start, MIN_SIDE, allowed);
	}
	return { start, end: isFiles ? 0 : end, collapsed };
}

/**
 * The grid's columns in pixels, the dividers included: `[tree, divider, file]`, or
 * `[grades, divider, lesson, divider, source]`.
 */
export function paneColumns(
	widths: PaneWidths,
	view: PanesView,
	total: number,
): number[] {
	const fitted = clampWidths(widths, view, total);
	const sides = sideCount(view, fitted.collapsed);
	const room = Math.max(0, total - sides * DIVIDER);
	const middle = Math.max(
		0,
		room - fitted.start - (sides === 2 ? fitted.end : 0),
	);
	return sides === 2
		? [fitted.start, DIVIDER, middle, DIVIDER, fitted.end]
		: [fitted.start, DIVIDER, middle];
}

/**
 * The widths after dragging the divider at `index` (0 is the first) by `delta` pixels
 * towards the end of the row: the pane before it grows, the one after it gives way, and
 * neither goes under its limit.
 */
export function dragPanes(
	widths: PaneWidths,
	view: PanesView,
	index: number,
	delta: number,
	total: number,
): PaneWidths {
	const fitted = clampWidths(widths, view, total);
	const sides = sideCount(view, fitted.collapsed);
	const room = Math.max(0, total - sides * DIVIDER);
	// What the side panes may share: the content pane keeps its 320 px.
	const allowed = room - MIN_MIDDLE;
	if (index === 0) {
		const most = sides === 2 ? allowed - fitted.end : allowed;
		const start = between(
			fitted.start + delta,
			MIN_SIDE,
			Math.max(MIN_SIDE, most),
		);
		return { ...fitted, start: Math.round(start) };
	}
	if (sides === 1) return fitted;
	const most = allowed - fitted.start;
	const end = between(fitted.end - delta, MIN_SIDE, Math.max(MIN_SIDE, most));
	return { ...fitted, end: Math.round(end) };
}

/**
 * The pixels an arrow key moves a divider: ArrowRight goes towards the end of the row in
 * English, and the other way in Arabic, where the row is mirrored.
 */
export function arrowDelta(
	key: "ArrowLeft" | "ArrowRight",
	rtl: boolean,
): number {
	const towardsEnd = key === "ArrowRight" ? STEP : -STEP;
	return rtl ? -towardsEnd : towardsEnd;
}

/** The source viewer put away, or brought back at the width it had. */
export function toggleSource(widths: PaneWidths): PaneWidths {
	return { ...widths, collapsed: !widths.collapsed };
}

/** The row width a layout is kept under, rounded to the nearest step. */
export function widthBucket(total: number): number {
	return Math.max(0, Math.round(total / WIDTH_STEP) * WIDTH_STEP);
}

/** The key one view's layout is kept under at one row width. */
export function savedKey(view: PanesView, total: number): string {
	return `${view}:${widthBucket(total)}`;
}

/** True when a value read back from the settings is a layout this build can use. */
function isWidths(value: unknown): value is PaneWidths {
	if (typeof value !== "object" || value === null) return false;
	const entry = value as Partial<PaneWidths>;
	const width = (n: unknown): boolean =>
		typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100_000;
	return (
		width(entry.start) &&
		width(entry.end) &&
		typeof entry.collapsed === "boolean"
	);
}

/** The layouts a settings string holds; a damaged entry is left out and its view starts fresh. */
export function parseSaved(raw: string | null): Record<string, PaneWidths> {
	if (raw === null || raw === "") return {};
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return {};
	}
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return {};
	const saved: Record<string, PaneWidths> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (!key.includes(":") || !isWidths(entry)) continue;
		saved[key] = {
			start: entry.start,
			end: entry.end,
			collapsed: entry.collapsed,
		};
	}
	return saved;
}

/**
 * The layout kept for this view at this width, or the nearest one it has when this width is
 * new to it (a window that opens smaller than the one the author last dragged in), or null
 * when the view has never been dragged at all.
 */
export function savedFor(
	saved: Readonly<Record<string, PaneWidths>>,
	view: PanesView,
	total: number,
): PaneWidths | null {
	const exact = saved[savedKey(view, total)];
	if (exact !== undefined) return exact;
	const prefix = `${view}:`;
	let nearest: { distance: number; widths: PaneWidths } | null = null;
	for (const [key, widths] of Object.entries(saved)) {
		if (!key.startsWith(prefix)) continue;
		const bucket = Number(key.slice(prefix.length));
		if (!Number.isFinite(bucket)) continue;
		const distance = Math.abs(bucket - widthBucket(total));
		if (nearest === null || distance < nearest.distance)
			nearest = { distance, widths };
	}
	return nearest?.widths ?? null;
}

/** `saved` with this layout written for its width, keeping the sizes nearest this one. */
export function withSaved(
	saved: Readonly<Record<string, PaneWidths>>,
	view: PanesView,
	total: number,
	widths: PaneWidths,
): Record<string, PaneWidths> {
	const next: Record<string, PaneWidths> = { ...saved };
	next[savedKey(view, total)] = widths;
	const keys = Object.keys(next);
	if (keys.length <= SAVED_MAX) return next;
	const here = widthBucket(total);
	const bucketOf = (key: string) => {
		const cut = key.lastIndexOf(":");
		return Number(key.slice(cut + 1));
	};
	const kept: Record<string, PaneWidths> = {};
	for (const key of keys
		.sort(
			(a, b) =>
				Math.abs(bucketOf(a) - here) - Math.abs(bucketOf(b) - here) ||
				a.localeCompare(b),
		)
		.slice(0, SAVED_MAX)) {
		const entry = next[key];
		if (entry !== undefined) kept[key] = entry;
	}
	return kept;
}
