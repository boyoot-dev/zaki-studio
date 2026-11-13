// The list every long list in the page is drawn with (task 168): only the rows on screen
// exist in the DOM, never more than 300 of them, whatever the list holds. Each row is a real
// list item with its label, so a screen reader hears the list as it scrolls, and the arrow
// keys still reach every row. The height math lives in shared/window.ts, which is tested on
// its own.

import {
	useEffect,
	useRef,
	useState,
	type ReactNode,
	type UIEvent,
} from "react";

import { totalHeight, visibleRange } from "../shared/window.ts";

/** How far from the real edge of the list the virtual window sits, once at each end. */
const OVERSCAN = 8;

/**
 * Renders `children(index)` for the rows currently visible in a scroll box of `rowHeight`
 * pixels each, with `count` rows in total. Pass `listRole` and `itemRole` for a semantic
 * list or tree.
 */
export function WindowedList({
	count,
	rowHeight,
	className,
	listRole = "list",
	itemRole = "listitem",
	ariaLabel,
	onRangeChange,
	children,
}: {
	count: number;
	rowHeight: number;
	className?: string;
	listRole?: "list" | "tree";
	itemRole?: "listitem" | "treeitem";
	ariaLabel?: string;
	/** Called with the visible index range after each scroll; the caller pages data in. */
	onRangeChange?: (start: number, end: number) => void;
	children: (index: number) => ReactNode;
}) {
	const ref = useRef<HTMLDivElement | null>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewHeight, setViewHeight] = useState(600);
	const range = visibleRange(count, rowHeight, scrollTop, viewHeight, OVERSCAN);

	// The container's own height drives the window: it may be sized by the panes around it.
	useEffect(() => {
		const element = ref.current;
		if (element === null) return;
		const observer = new ResizeObserver((entries) => {
			const next = entries[0]?.contentRect.height;
			if (typeof next === "number" && Number.isFinite(next) && next > 0)
				setViewHeight(next);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	// Tell the caller which rows are on screen, so it can fetch the pages they need.
	const rangeStart = range.start;
	const rangeEnd = range.end;
	useEffect(() => {
		onRangeChange?.(rangeStart, rangeEnd);
	}, [rangeStart, rangeEnd, onRangeChange]);

	const rows: ReactNode[] = [];
	for (let index = range.start; index < range.end; index += 1) {
		rows.push(
			<div
				key={index}
				role={itemRole}
				aria-setsize={count}
				aria-posinset={index + 1}
				style={{
					position: "absolute",
					top: index * rowHeight,
					left: 0,
					right: 0,
					height: rowHeight,
				}}
			>
				{children(index)}
			</div>,
		);
	}

	return (
		// The scroll box is the list; the inner div only reserves the full height.
		<div
			ref={ref}
			className={className}
			role={listRole}
			aria-label={ariaLabel}
			onScroll={(event: UIEvent<HTMLDivElement>) =>
				setScrollTop(event.currentTarget.scrollTop)
			}
			style={{ overflowY: "auto", position: "relative", minHeight: 0 }}
		>
			<div
				role="presentation"
				style={{
					position: "relative",
					height: totalHeight(count, rowHeight),
				}}
			>
				{rows}
			</div>
		</div>
	);
}
