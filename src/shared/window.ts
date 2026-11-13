// The arithmetic a windowed list draws with (task 168): which items are on screen for a
// scroll position, and how many rows that is at most. Pure, so it is tested directly, and
// every list in the page draws only the rows it needs (never more than 300).

/** The rows a windowed list draws for one scroll position: [start, end) item indexes. */
export type VisibleRange = { start: number; end: number };

/** The default margin the lists draw above and below the viewport, so fast scrolls don't show blanks. */
export const OVERSCAN = 8;

/**
 * The items a list has to draw at `scrollTop` in a viewport of `viewHeight` pixels, with
 * `overscan` rows of margin above and below. Never draws more than `max` rows, whatever
 * the list holds.
 */
export function visibleRange(
	count: number,
	rowHeight: number,
	scrollTop: number,
	viewHeight: number,
	overscan: number = OVERSCAN,
	max: number = 300,
): VisibleRange {
	if (!Number.isFinite(count) || count <= 0 || rowHeight <= 0)
		return { start: 0, end: 0 };
	const wanted = Math.max(1, Math.ceil(viewHeight / rowHeight) + 2 * overscan);
	const window = Math.min(wanted, Math.max(1, max));
	const start = Math.max(
		0,
		Math.min(Math.floor(scrollTop / rowHeight) - overscan, count - window),
	);
	return { start, end: Math.min(count, start + window) };
}

/** The total height of a list of `count` rows of `rowHeight` pixels. */
export function totalHeight(count: number, rowHeight: number): number {
	if (!Number.isFinite(count) || count <= 0 || rowHeight <= 0) return 0;
	return count * rowHeight;
}
