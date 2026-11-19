// "Build from my book" (task 246): one course's files read and its units proposed in one go.
// The panel says first what it will use (the files, the periods, about how long, and with a key
// what it costs), then runs the way chosen in Settings: one message and one Collect for the
// author's AI tool, or a run with progress for a key. Either way it ends at Review.

import { useCallback, useEffect, useState } from "react";

import { costWords } from "../shared/ai";
import type { BookPlanView, BookProgress } from "../shared/api";
import type { BundlePeriod } from "../shared/format/bundle";
import { gradeLabel, type TextKey } from "../shared/i18n";
import { KINDS } from "../shared/register";
import { roundsGuess } from "../shared/rounds";
import { termLabel } from "../shared/terms";
import { failureText } from "./App";
import { useLang, useSay } from "./i18n";
import { Rounds } from "./Rounds";
import { useAi, useAiGate } from "./Settings";

/** A course: grade, subject and teaching language. */
export type BookTarget = {
	grade: number;
	subject: string;
	language: string;
	/** The course's name as the page shows it. */
	label: string;
	/** True once the course has units: the button reads "Update from my files". */
	hasUnits: boolean;
};

/** The file's own name, without its folders. */
function fileName(path: string): string {
	return path.split("/").pop() ?? path;
}

export function BookPanel({
	root,
	course,
	periods,
	onClose,
	onOpenReview,
	onNotify,
}: {
	root: string;
	course: BookTarget;
	periods: readonly BundlePeriod[];
	onClose: () => void;
	onOpenReview: () => void;
	onNotify: (text: string) => void;
}) {
	const say = useSay();
	const lang = useLang();
	const { ai } = useAi();
	const { gate, ready } = useAiGate();
	const [plan, setPlan] = useState<BookPlanView | null>(null);
	const [prompt, setPrompt] = useState<{ name: string; text: string } | null>(
		null,
	);
	const [busy, setBusy] = useState<"start" | "collect" | null>(null);
	const [progress, setProgress] = useState<BookProgress | null>(null);
	const [result, setResult] = useState("");
	const [done, setDone] = useState(false);
	// The period the browser rounds are for, when the course has more than one (task 245).
	const [roundsPeriod, setRoundsPeriod] = useState("");

	const load = useCallback(async () => {
		setPlan(
			await window.studio.bookPlan(
				root,
				course.grade,
				course.subject,
				course.language,
			),
		);
	}, [root, course.grade, course.subject, course.language]);

	// The plan is read again when the way changes: with a key it carries a cost.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the way is the trigger.
	useEffect(() => {
		void load();
	}, [load, ai?.choice?.way]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape" && busy === null) onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [busy, onClose]);

	const way = ai?.choice?.way ?? null;
	const toolName =
		ai?.choice?.way === "tool"
			? say(`notes.tool.${ai.choice.tool}` as TextKey)
			: "";

	const start = async () => {
		setBusy("start");
		setResult("");
		try {
			if (way === "tool") {
				const made = await window.studio.prepareBook(
					root,
					course.grade,
					course.subject,
					course.language,
				);
				if (!made.ok) {
					onNotify(failureText(lang, made));
					return;
				}
				setPrompt({ name: made.name, text: made.prompt });
				await load();
				return;
			}
			const stop = window.studio.onBookProgress(setProgress);
			try {
				const built = await window.studio.buildBook(
					root,
					course.grade,
					course.subject,
					course.language,
				);
				if (!built.ok) {
					onNotify(failureText(lang, built));
					return;
				}
				setResult(
					built.stopped
						? say("book.stopped")
						: say("book.built", { sets: built.sets }),
				);
				setDone(built.sets > 0);
				await load();
			} finally {
				stop();
				setProgress(null);
			}
		} finally {
			setBusy(null);
		}
	};

	const collect = async (name: string) => {
		setBusy("collect");
		try {
			const got = await window.studio.collectBook(root, name);
			if (!got.ok) {
				onNotify(failureText(lang, got));
				return;
			}
			if (got.read === 0 && got.sets === 0 && got.skipped === 0) {
				setResult(say("book.nothingYet"));
				return;
			}
			setResult(say("book.collected", { read: got.read, sets: got.sets }));
			setDone(got.sets > 0 || got.skipped > 0);
		} finally {
			setBusy(null);
		}
	};

	const copy = async () => {
		if (prompt === null) return;
		const answer = await window.studio.copyText(prompt.text);
		onNotify(answer.ok ? say("notes.copied") : failureText(lang, answer));
	};

	const progressLine =
		progress === null
			? ""
			: progress.stage === "reading"
				? say("book.starting")
				: progress.stage === "notes"
					? say("book.progressNotes", {
							done: progress.done,
							total: progress.total,
						})
					: say("book.progressUnits", {
							done: progress.done,
							total: progress.total,
						});

	const shown = plan?.ok === true ? plan : null;
	const lastJob = shown?.jobs[0];

	return (
		<div className="veil">
			<div
				className="dialog book-dialog"
				aria-modal="true"
				role="dialog"
				aria-label={course.hasUnits ? say("book.update") : say("book.build")}
			>
				<header className="new-head">
					<div>
						<h2>{course.hasUnits ? say("book.update") : say("book.build")}</h2>
						<p className="muted" dir="auto">
							{gradeLabel(lang, course.grade)} · {course.label}
						</p>
					</div>
					<button
						type="button"
						className="btn btn-quiet"
						disabled={busy !== null}
						onClick={onClose}
					>
						{say("settings.close")}
					</button>
				</header>

				{gate}

				{plan !== null && !plan.ok && (
					<p className="issues">{failureText(lang, plan)}</p>
				)}

				{shown !== null && shown.fileCount === 0 && (
					<p className="issues">{say("book.noFiles")}</p>
				)}

				{shown !== null && shown.fileCount > 0 && (
					<>
						<section>
							<h3>{say("book.files")}</h3>
							<ul className="new-list book-files">
								{shown.files.map((file) => (
									<li key={file.path}>
										<span dir="auto">{fileName(file.path)}</span>{" "}
										<span className="muted">
											{say("book.fileLine", {
												kind: say(
													(KINDS as readonly string[]).includes(file.kind)
														? (`kind.${file.kind}` as TextKey)
														: "kind.other",
												),
												n: file.pages,
											})}
										</span>
									</li>
								))}
							</ul>
							{shown.fileCount > shown.files.length && (
								<p className="muted">
									{say("book.more", {
										n: shown.fileCount - shown.files.length,
									})}
								</p>
							)}
						</section>
						{shown.noTerm > 0 && (
							<p className="issues">
								{say("book.noTerm", { n: shown.noTerm })}
							</p>
						)}
						<p className="muted">
							{shown.toRead > 0 &&
								`${say("book.toRead", { n: shown.toRead })} `}
							{say("book.periods", {
								periods: shown.periods
									.map((id) => termLabel(id, periods, lang) ?? id)
									.join("، "),
							})}
						</p>
						<p className="muted">
							{say("book.time", { n: shown.minutes })}
							{way === "key" &&
								shown.costUsd !== null &&
								` ${say("book.cost", { cost: costWords(shown.costUsd, lang) })}`}
						</p>
					</>
				)}

				{ready &&
					way === "browser" &&
					shown !== null &&
					shown.periods.length > 0 && (
						<>
							{shown.periods.length > 1 && (
								<label className="field">
									<span className="field-label">{say("rounds.period")}</span>
									<select
										value={roundsPeriod || shown.periods[0]}
										onChange={(event) => setRoundsPeriod(event.target.value)}
									>
										{shown.periods.map((id) => (
											<option key={id} value={id}>
												{termLabel(id, periods, lang) ?? id}
											</option>
										))}
									</select>
								</label>
							)}
							<Rounds
								key={roundsPeriod || shown.periods[0]}
								root={root}
								course={course}
								period={roundsPeriod || (shown.periods[0] ?? "")}
								guess={roundsGuess(
									shown.files.reduce((sum, file) => sum + file.pages, 0) /
										Math.max(1, shown.periods.length),
								)}
								onDone={() => setDone(true)}
								onNotify={onNotify}
							/>
						</>
					)}

				{ready &&
					way !== "browser" &&
					shown !== null &&
					shown.periods.length > 0 && (
						<div className="notes-row">
							<button
								type="button"
								className="btn"
								disabled={
									busy !== null || (way === "key" && ai?.keySet !== true)
								}
								onClick={() => void start()}
							>
								{busy === "start" ? say("book.starting") : say("book.start")}
							</button>
						</div>
					)}

				{progressLine !== "" && <p className="muted">{progressLine}</p>}

				{way === "tool" && prompt !== null && (
					<div className="job-prompt">
						<p>{say("book.give", { tool: toolName })}</p>
						<textarea readOnly value={prompt.text} dir="ltr" rows={8} />
						<div className="notes-row">
							<button type="button" className="btn" onClick={() => void copy()}>
								{say("book.copy")}
							</button>
							<button
								type="button"
								className="btn"
								disabled={busy !== null}
								onClick={() => void collect(prompt.name)}
							>
								{busy === "collect"
									? say("changes.collecting")
									: say("book.collect")}
							</button>
						</div>
					</div>
				)}

				{way === "tool" && prompt === null && lastJob !== undefined && (
					<p className="muted">
						{say("book.lastJob", { created: lastJob.created })}{" "}
						<button
							type="button"
							className="btn btn-quiet"
							disabled={busy !== null}
							onClick={() => void collect(lastJob.name)}
						>
							{busy === "collect"
								? say("changes.collecting")
								: say("book.collect")}
						</button>
					</p>
				)}

				{result !== "" && <p>{result}</p>}
				{done && (
					<button
						type="button"
						className="btn"
						onClick={() => {
							onClose();
							onOpenReview();
						}}
					>
						{say("book.openReview")}
					</button>
				)}
			</div>
		</div>
	);
}
