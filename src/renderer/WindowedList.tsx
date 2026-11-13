// The list every long list in the page is drawn with (task 168): only the rows on screen
// exist in the DOM, never more than 300 of them, whatever the list holds. The scroll box
// carries the list's role; each row inside is a real list or tree item with its label, the
// row count the caller gave it, and its place in the list, so a screen reader hears the list
// as it scrolls and the arrow keys still reach every row. The height math lives in
// shared/window.ts, which is tested on its own.

import {
	type ReactNode,
	type UIEvent,
	useEffect,
	useRef,
	useState,
} from "react";

import { totalHeight, visibleRange } from "../shared/window.ts";

/** How far from the real edge of the list the virtual window sits, once at each end. */
const OVERSCAN = 8;

/**
 * Renders `children(index)` for the rows currently visible in a scroll box of `rowHeight`
 * pixels each, with `count` rows in total. Each child is a real list or tree item; the
 * scroll box keeps the list's role.
 */
export function WindowedList({
	count,
	rowHeight,
	className,
	listRole = "list",
	ariaLabel,
	itemClassName,
	onRangeChange,
	children,
}: {
	count: number;
	rowHeight: number;
	className?: string;
	listRole?: "list" | "tree";
	ariaLabel?: string;
	/** A class for each row's absolutely placed container, for the list's own insets. */
	itemClassName?: string;
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
				className={itemClassName}
				role="presentation"
				style={{
					position: "absolute",
					top: index * rowHeight,
					left: 0,
					right: 0,
					height: rowHeight,
					boxSizing: "border-box",
				}}
			>
				{children(index)}
			</div>,
		);
	}

	return (
		// The scroll box is the list; the inner div only reserves the full height.
		// biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is the caller's; a list or a tree may both carry a label.
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
