// The movable border between two panes (task 154): drag it with the mouse, arrow it from the
// keyboard, double-click it back to the width the app starts with. The widths, the limits and
// the Arabic mirror are in src/shared/panes.ts; this file measures the row and keeps the
// widths in the app's own window settings, never in a project.

import {
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import { isRightToLeft, type TextKey } from "../shared/i18n";
import {
	arrowDelta,
	clampWidths,
	defaultWidths,
	dragPanes,
	MIN_SIDE,
	type PanesView,
	type PaneWidths,
	paneColumns,
	parseSaved,
	savedFor,
	toggleSource,
	widthBucket,
	withSaved,
} from "../shared/panes";
import { useLang, useSay } from "./i18n";

/** Where the widths are kept: the Studio's own window, not one of the author's projects. */
const PANES_KEY = "studio.panes";

/** What the divider after one pane needs. */
export type DividerSpec = {
	/** What the divider is between, for a screen reader. */
	label: string;
	/** The line shown when the mouse rests on it. */
	hint: string;
	/** The width of the pane before it, in pixels. */
	value: number;
	min: number;
	max: number;
	/** Moves the divider by `delta` pixels towards the end of the row. */
	onMove: (delta: number) => void;
	/** Puts both panes back to their default widths. */
	onReset: () => void;
};

/** What a view's panes need from the hook. */
export type Panes = {
	/** Gives the element whose children are the panes and the dividers to the hook. */
	row: (node: HTMLDivElement | null) => void;
	/** The grid's columns, a divider column between each pair of panes. */
	style: CSSProperties;
	/** True when the source viewer is put away and must not be drawn. */
	collapsed: boolean;
	/** The divider after pane `index`, counting from 0. */
	divider: (index: number) => DividerSpec;
	/** Puts the source viewer away, or brings it back at the width it had. */
	toggleSource: () => void;
};

/** The widths this window kept last time, or none when there are none to use. */
function readSaved(): Record<string, PaneWidths> {
	try {
		return parseSaved(window.localStorage.getItem(PANES_KEY));
	} catch {
		return {};
	}
}

/** The widths and the dividers of one view. */
export function usePanes(view: PanesView): Panes {
	const say = useSay();
	const saved = useRef<Record<string, PaneWidths>>(readSaved());
	const bucket = useRef<number | null>(null);
	const [row, setRow] = useState<HTMLDivElement | null>(null);
	const [state, setState] = useState<PaneWidths>(() => defaultWidths(view));
	// The widths as they are now, for the pointer, which can arrive before the next render.
	const live = useRef<PaneWidths>(state);
	const [total, setTotal] = useState(() => window.innerWidth);

	/** Keeps a new set of widths, and remembers it for the width the window has now. */
	const apply = useCallback(
		(next: PaneWidths) => {
			live.current = next;
			setState(next);
			if (total <= 0) return;
			saved.current = withSaved(saved.current, view, total, next);
			try {
				window.localStorage.setItem(PANES_KEY, JSON.stringify(saved.current));
			} catch {
				// Remembering is a convenience: a window that can't write still resizes.
			}
		},
		[total, view],
	);

	// The row is measured as it is, and again whenever the window changes size. The widths of
	// that size come back when it does; a size the author never dragged in takes the nearest
	// widths the app has, and a first window takes the defaults.
	useEffect(() => {
		if (row === null) return;
		const measure = () => {
			const width = row.clientWidth;
			setTotal(width);
			if (widthBucket(width) === bucket.current) return;
			bucket.current = widthBucket(width);
			const next = savedFor(saved.current, view, width) ?? defaultWidths(view);
			live.current = next;
			setState(next);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(row);
		return () => observer.disconnect();
	}, [row, view]);

	const fitted = clampWidths(state, view, total);
	const collapsed = view === "curriculum" && fitted.collapsed;

	const label = (index: number): TextKey => {
		if (view === "files") return "panes.tree";
		return index === 0 ? "panes.grades" : "panes.source";
	};

	return {
		row: setRow,
		style: {
			gridTemplateColumns: paneColumns(state, view, total)
				.map((column) => `${column}px`)
				.join(" "),
		},
		collapsed,
		divider: (index) => ({
			label: say(label(index)),
			hint: say("panes.hint"),
			value: index === 0 ? fitted.start : fitted.end,
			min: MIN_SIDE,
			max: Math.max(MIN_SIDE, total),
			onMove: (delta) =>
				apply(dragPanes(live.current, view, index, delta, total)),
			onReset: () => apply(defaultWidths(view)),
		}),
		toggleSource: () => apply(toggleSource(live.current)),
	};
}

/** The line between two panes: the author drags it, arrows it, or double-clicks it back. */
export function Divider({ spec }: { spec: DividerSpec }) {
	const rtl = isRightToLeft(useLang());
	const at = useRef<number | null>(null);

	/** The line follows the mouse; in Arabic the row is mirrored, so it moves the other way. */
	const move = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (at.current === null) return;
		const delta = event.clientX - at.current;
		at.current = event.clientX;
		if (delta !== 0) spec.onMove(rtl ? -delta : delta);
	};

	const stop = (event: ReactPointerEvent<HTMLDivElement>) => {
		at.current = null;
		document.body.classList.remove("pane-dragging");
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId);
	};

	return (
		// A window splitter, not an <hr>: it is focusable, it is moved with the arrows, and it
		// reports the width of the pane before it.
		// biome-ignore lint/a11y/useSemanticElements: a separator between two resizable panes
		<div
			className="pane-divider"
			role="separator"
			aria-orientation="vertical"
			aria-label={spec.label}
			aria-valuenow={Math.round(spec.value)}
			aria-valuemin={spec.min}
			aria-valuemax={spec.max}
			title={spec.hint}
			tabIndex={0}
			onDoubleClick={spec.onReset}
			onKeyDown={(event) => {
				if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
				event.preventDefault();
				spec.onMove(arrowDelta(event.key, rtl));
			}}
			onPointerDown={(event) => {
				if (event.button !== 0) return;
				at.current = event.clientX;
				event.currentTarget.setPointerCapture(event.pointerId);
				document.body.classList.add("pane-dragging");
			}}
			onPointerMove={move}
			onPointerUp={stop}
			onPointerCancel={stop}
			onLostPointerCapture={stop}
		/>
	);
}
