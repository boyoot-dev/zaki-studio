// The "New material" panel (task 156): what the last scan found, the units each new file
// touches, and what needs a person's look. It replaces the Markdown report the local pipeline
// wrote, so the list stays on the page until the next scan. The report comes in pages and the
// list draws only what is on screen (task 168), so a first scan of a huge project stays
// quick. Every file's name is a button: it opens the file where the author already reads it.

import studioSubjects from "virtual:subjects";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ScanProgress } from "../shared/api.ts";
import { gradeLabel, type Lang, type TextKey } from "../shared/i18n";
import type { ReportListItem, ReportMeta } from "../shared/lists.ts";
import type { FileRow } from "../shared/model.ts";
import { type AffectedLine, KINDS } from "../shared/register.ts";
import { useLang, useSay } from "./i18n";
import { WindowedList } from "./WindowedList";

/** A word of the window, as the panel's helpers take it. */
type Say = (key: TextKey, vars?: Record<string, string | number>) => string;

/** The page size of the flattened report over IPC. */
const PAGE = 200;
/** The height of every row of the flattened report, in pixels. */
const ROW = 34;

export function NewMaterialPanel({
	root,
	meta,
	scanning,
	progress,
	onScan,
	onStop,
	onPick,
	onNotify,
	reloadKey,
}: {
	root: string;
	/** The header of the last scan's report, or null when there is none. */
	meta: ReportMeta | null;
	scanning: boolean;
	progress: ScanProgress | null;
	onScan: () => void;
	onStop: () => void;
	onPick: (rel: string) => void;
	onNotify: (text: string) => void;
	/** Bumped when the folder changed on disk; the rows are re-read. */
	reloadKey: number;
}) {
	const say = useSay();
	const lang = useLang();
	// The flattened report, page by page as the window reaches it.
	const [items, setItems] = useState<Map<number, ReportListItem>>(
		() => new Map(),
	);
	const [total, setTotal] = useState(0);
	const [loaded, setLoaded] = useState(false);
	// The pages asked for already, so scrolling does not ask twice.
	const requested = useRef(new Set<number>());

	const loadPage = useCallback(
		async (offset: number) => {
			const result = await window.studio.reportRows(root, offset, PAGE);
			if (!result.ok) {
				onNotify(say("failure.unknown"));
				return;
			}
			setItems((current) => {
				const next = new Map(current);
				for (const [index, item] of result.items.entries())
					next.set(offset + index, item);
				return next;
			});
			setTotal(result.total);
			setLoaded(true);
		},
		[root, onNotify, say],
	);

	// A new scan, or a folder changed on disk: everything starts over.
	const reportKey = `${meta?.at ?? "none"}|${meta?.newCount ?? 0}|${reloadKey}`;
	// biome-ignore lint/correctness/useExhaustiveDependencies: reportKey is the trigger — a new scan (or a change on disk) rewrote the list.
	useEffect(() => {
		setItems(new Map());
		setTotal(0);
		setLoaded(false);
		requested.current = new Set();
		void loadPage(0);
	}, [reportKey, loadPage]);

	/** Fetches the pages the visible window needs. */
	const ensureRange = useCallback(
		(start: number, end: number) => {
			const first = Math.floor(Math.max(0, start) / PAGE);
			const last = Math.floor(Math.max(0, end - 1) / PAGE);
			for (let page = first; page <= last; page += 1) {
				if (requested.current.has(page)) continue;
				requested.current.add(page);
				void loadPage(page * PAGE);
			}
		},
		[loadPage],
	);

	const renderRow = (index: number) => {
		const item = items.get(index);
		if (item === undefined)
			return (
				<div className="row row-pending" aria-hidden="true">
					<span className="muted">…</span>
				</div>
			);
		switch (item.kind) {
			case "group":
				return (
					<div className="row row-head">
						<h3 dir="auto">
							{groupTitle(item.grade, item.subject, item.block, lang, say)}
						</h3>
					</div>
				);
			case "row":
				return (
					<div className="row">
						<button
							type="button"
							className="link-button"
							onClick={() => onPick(item.row.path)}
						>
							{fileName(item.row.path)}
						</button>
						<span className="muted"> {fileLine(item.row, say)}</span>
					</div>
				);
			case "affectedTitle":
				return (
					<div className="row row-head">
						<h3 dir="auto">{say("new.affected")}</h3>
					</div>
				);
			case "affectedBlock":
				return (
					<div className="row row-sub">
						{groupTitle(item.grade, item.subject, item.block, lang, say)}
					</div>
				);
			case "affectedLine":
				return (
					<div className="row row-sub muted">
						{affectedText(item.line, say)}
					</div>
				);
			case "lookTitle":
				return (
					<div className="row row-head">
						<h3 dir="auto">{say("new.look")}</h3>
						{item.count === 0 && (
							<span className="muted">{say("new.look.none")}</span>
						)}
					</div>
				);
			case "look":
				return (
					<div className="row">
						<button
							type="button"
							className="link-button"
							onClick={() => onPick(item.row.path)}
						>
							{fileName(item.row.path)}
						</button>
						<span className="issues">
							{" "}
							{item.why
								.map((reason) =>
									reason.code === "error"
										? say("new.why.error", { detail: reason.detail })
										: reason.code === "copy"
											? say("new.why.copy", { id: reason.id })
											: say(`new.why.${reason.code}`),
								)
								.join(", ")}
						</span>
					</div>
				);
			case "totals":
				return (
					<div className="row row-sub muted">
						{say("new.copies", { n: item.copies })} ·{" "}
						{say("new.moved", { n: item.moved })} ·{" "}
						{say("new.removed", { n: item.removed })}
					</div>
				);
			case "path":
				return (
					<div className="row row-sub muted" dir="auto">
						{item.path}
					</div>
				);
		}
	};

	const allNew = meta?.newCount ?? 0;
	return (
		<div className="new-material">
			<header className="new-head">
				<div>
					<h2>{say("new.title")}</h2>
					<p className="muted">{say("new.intro")}</p>
				</div>
				<div className="new-actions">
					{scanning ? (
						<button type="button" className="btn btn-quiet" onClick={onStop}>
							{say("new.stop")}
						</button>
					) : (
						<button type="button" className="btn" onClick={onScan}>
							{say("new.scan")}
						</button>
					)}
				</div>
			</header>

			{scanning && <p className="muted">{progressText(progress, say)}</p>}

			{meta === null ? (
				<p className="muted">{say("new.nothingYet")}</p>
			) : (
				<>
					<p className="muted">
						{meta.since === ""
							? say("new.firstScan")
							: say("new.since", { since: meta.since })}{" "}
						{say("new.counts", {
							found: meta.found,
							read: meta.read,
							new: allNew,
						})}
					</p>
					{meta.tessdataMissing.length > 0 && (
						<p className="issues">{say("new.tessdata")}</p>
					)}

					{!loaded && total === 0 ? (
						<p className="muted">{say("curriculum.loading")}</p>
					) : total === 0 ? (
						<p className="muted">
							{meta.since === ""
								? say("new.emptyFirst")
								: say("new.none", { since: meta.since })}
						</p>
					) : (
						<WindowedList
							count={total}
							rowHeight={ROW}
							className="report-list"
							itemClassName="report-item"
							onRangeChange={ensureRange}
						>
							{renderRow}
						</WindowedList>
					)}
				</>
			)}
		</div>
	);
}

/** What the scan is doing now, in the panel's words. */
function progressText(progress: ScanProgress | null, say: Say): string {
	if (progress === null) return say("new.starting");
	if (progress.stage === "reading")
		return say("new.reading", { found: progress.found, read: progress.read });
	if (progress.stage === "pictures")
		return say("new.pictures", { done: progress.done, pages: progress.pages });
	if (progress.stage === "ocr")
		return say("new.ocr", { done: progress.done, pages: progress.pages });
	return say("new.finished", { done: progress.done, pages: progress.pages });
}

/** "Grade 3 · Math · Block 1", or the parts the project doesn't know. */
function groupTitle(
	grade: number | null,
	subject: string,
	block: string,
	lang: Lang,
	say: Say,
): string {
	const words = [
		grade === null ? say("new.noGrade") : gradeLabel(lang, grade),
		subject === "unknown" || subject === ""
			? say("new.noSubject")
			: subjectName(subject, lang),
	];
	if (block !== "") words.push(say("new.block", { block }));
	return words.join(" · ");
}

/** The subject's own name, in the window's language, from the wizard's list. */
function subjectName(id: string, lang: Lang): string {
	const subject = studioSubjects.find((entry) => entry.id === id);
	if (subject === undefined) return id;
	return lang === "ar" ? subject.nameAr : subject.nameEn;
}

/** The kind a row names, or "other" for a row from before the register knew kinds. */
function kindKey(kind: string): TextKey {
	return (KINDS as readonly string[]).includes(kind)
		? (`kind.${kind}` as TextKey)
		: "kind.other";
}

/** One file's known facts in a line: kind, the year and date when known, and pages. */
function fileLine(row: FileRow, say: Say): string {
	const parts = [say(kindKey(row.kind))];
	if (row.academicYear !== "") parts.push(row.academicYear);
	if (row.published !== "") parts.push(row.published);
	parts.push(say("new.pages", { n: row.pages ?? 0, images: row.imagePages }));
	return parts.join(" · ");
}

/** What one line of the affected units says, in the panel's language. */
function affectedText(line: AffectedLine, say: Say): string {
	if (line.code === "noCourse") return say("new.affected.noCourse");
	if (line.code === "noUnit")
		return say("new.affected.noUnit", { block: line.block });
	const unit = say("new.affected.unit", {
		number: line.number,
		title: line.title,
		source: say(`new.source.${line.source}`),
	});
	return line.confirm ? `${unit} — ${say("new.affected.confirm")}` : unit;
}

/** A file's own name, as the panel shows it. */
function fileName(path: string): string {
	return path.split("/").pop() ?? path;
}
