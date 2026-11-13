// The "New material" panel (task 156): what the last scan found, the units each new file
// touches, and what needs a person's look. It replaces the Markdown report the local pipeline
// wrote, so the list stays on the page until the next scan. Every file's name is a button: it
// opens the file where the author already reads it.

import type { ScanProgress } from "../shared/api";
import { gradeLabel, type Lang, type TextKey } from "../shared/i18n";
import type { FileRow } from "../shared/model";
import { type AffectedLine, KINDS, type NewMaterial } from "../shared/register";
import { useLang, useSay } from "./i18n";

/** A word of the window, as the panel's helpers take it. */
type Say = (key: TextKey, vars?: Record<string, string | number>) => string;

export function NewMaterialPanel({
	report,
	scanning,
	progress,
	onScan,
	onStop,
	onPick,
}: {
	report: NewMaterial | null;
	scanning: boolean;
	progress: ScanProgress | null;
	onScan: () => void;
	onStop: () => void;
	onPick: (rel: string) => void;
}) {
	const say = useSay();
	const lang = useLang();
	const found =
		report === null
			? 0
			: report.groups.reduce((sum, group) => sum + group.rows.length, 0);
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

			{report === null ? (
				<p className="muted">{say("new.nothingYet")}</p>
			) : (
				<>
					<p className="muted">
						{report.since === ""
							? say("new.firstScan")
							: say("new.since", { since: report.since })}{" "}
						{say("new.counts", {
							found: report.found,
							read: report.read,
							new: found,
						})}
					</p>
					{report.tessdataMissing.length > 0 && (
						<p className="issues">{say("new.tessdata")}</p>
					)}

					{report.groups.length === 0 ? (
						<p className="muted">
							{report.since === ""
								? say("new.emptyFirst")
								: say("new.none", { since: report.since })}
						</p>
					) : (
						report.groups.map((group) => (
							<section key={`${group.grade}|${group.subject}|${group.block}`}>
								<h3>
									{groupTitle(
										group.grade,
										group.subject,
										group.block,
										lang,
										say,
									)}
								</h3>
								<ul className="new-list">
									{group.rows.map((row) => (
										<li key={row.id}>
											<button
												type="button"
												className="link-button"
												onClick={() => onPick(row.path)}
											>
												{fileName(row.path)}
											</button>
											<span className="muted"> {fileLine(row, say)}</span>
										</li>
									))}
								</ul>
							</section>
						))
					)}

					{report.affected.length > 0 && (
						<>
							<h3>{say("new.affected")}</h3>
							{report.affected.map((block) => (
								<div key={`${block.grade}|${block.subject}|${block.block}`}>
									<p>
										{groupTitle(
											block.grade,
											block.subject,
											block.block,
											lang,
											say,
										)}
									</p>
									<ul className="new-list">
										{block.lines.map((line) => (
											<li key={lineKey(line)} className="muted">
												{affectedText(line, say)}
											</li>
										))}
									</ul>
								</div>
							))}
						</>
					)}

					<h3>{say("new.look")}</h3>
					{report.look.length === 0 ? (
						<p className="muted">{say("new.look.none")}</p>
					) : (
						<ul className="new-list">
							{report.look.map(({ row, why }) => (
								<li key={row.id}>
									<button
										type="button"
										className="link-button"
										onClick={() => onPick(row.path)}
									>
										{fileName(row.path)}
									</button>
									<span className="issues">
										{" "}
										{why
											.map((reason) =>
												reason.code === "error"
													? say("new.why.error", { detail: reason.detail })
													: reason.code === "copy"
														? say("new.why.copy", { id: reason.id })
														: say(`new.why.${reason.code}`),
											)
											.join(", ")}
									</span>
								</li>
							))}
						</ul>
					)}

					<p className="muted">
						{say("new.copies", { n: report.copies.length })} ·{" "}
						{say("new.moved", { n: report.moved.length })} ·{" "}
						{say("new.removed", { n: report.removed.length })}
					</p>
					{[...report.moved, ...report.removed].length > 0 && (
						<ul className="new-list">
							{[...report.moved, ...report.removed].map((path) => (
								<li key={path} className="muted" dir="auto">
									{path}
								</li>
							))}
						</ul>
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

/** "Grade 3 · arabic · Block 1", or the parts the project doesn't know. */
function groupTitle(
	grade: number | null,
	subject: string,
	block: string,
	lang: Lang,
	say: Say,
): string {
	const words = [
		grade === null ? say("new.noGrade") : gradeLabel(lang, grade),
		subject === "unknown" || subject === "" ? say("new.noSubject") : subject,
		block === "" ? say("new.noBlock") : say("new.block", { block }),
	];
	return words.join(" · ");
}

/** The kind a row names, or "other" for a row from before the register knew kinds. */
function kindKey(kind: string): TextKey {
	return (KINDS as readonly string[]).includes(kind)
		? (`kind.${kind}` as TextKey)
		: "kind.other";
}

/** One file's known facts in a line: kind, year, date, authority, pages. */
function fileLine(row: FileRow, say: Say): string {
	const parts = [
		say(kindKey(row.kind)),
		row.academicYear === "" ? say("new.year.none") : row.academicYear,
		row.published === ""
			? say("new.noDate")
			: `${row.published} (${row.publishedFrom})`,
		say("new.authority", { n: row.authority ?? "-" }),
		say("new.pages", { n: row.pages ?? 0, images: row.imagePages }),
	];
	return parts.join(" · ");
}

/** A key for one line of the affected units: its own data, so the list never needs a number. */
function lineKey(line: AffectedLine): string {
	if (line.code === "noUnit") return `noUnit-${line.block}`;
	if (line.code === "unit") return `unit-${line.number}`;
	return line.code;
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
