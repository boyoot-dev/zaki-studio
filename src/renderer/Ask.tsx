// "Ask the AI…" (task 248): a teacher writes what to change in one unit or lesson, and gets a
// small proposal to review, made from the course's own material. The way comes from Settings:
// with their tool, one message and Collect; with a key, the cost first, then Send; in the
// browser, one file to upload and the answer pasted back. Every way ends at Review, where the
// proposal says "You asked: …".

import { useEffect, useState } from "react";

import { costWords } from "../shared/ai";
import type { TextKey } from "../shared/i18n";
import { REQUEST_MAX, type UnitRequest } from "../shared/request";
import { failureText } from "./App";
import { useLang, useSay } from "./i18n";
import { useAi, useAiGate } from "./Settings";

export function AskPanel({
	root,
	request,
	about,
	onClose,
	onOpenReview,
	onNotify,
}: {
	root: string;
	/** The course period, unit and lesson; the text is filled here. */
	request: Omit<UnitRequest, "text">;
	/** "Unit 2 · Cells" as the page shows it. */
	about: string;
	onClose: () => void;
	onOpenReview: () => void;
	onNotify: (text: string) => void;
}) {
	const say = useSay();
	const lang = useLang();
	const { ai } = useAi();
	const { gate, ready } = useAiGate();
	const way = ready ? (ai?.choice?.way ?? null) : null;
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const [cost, setCost] = useState<number | null>(null);
	const [job, setJob] = useState<{ name: string; prompt: string } | null>(null);
	const [upload, setUpload] = useState<{ message: string } | null>(null);
	const [answer, setAnswer] = useState("");
	const [issue, setIssue] = useState("");
	const [done, setDone] = useState(false);
	const full: UnitRequest = { ...request, text: text.trim() };

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !busy) onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [busy, onClose]);

	// With a key, the cost is shown before anything is sent.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the way is the trigger.
	useEffect(() => {
		if (way !== "key") return;
		void window.studio
			.requestCost(root, { ...request, text: "a request" })
			.then((got) => setCost(got.ok ? got.costUsd : null));
	}, [way, root]);

	const send = async () => {
		setBusy(true);
		setIssue("");
		try {
			if (way === "tool") {
				const made = await window.studio.prepareRequest(root, full);
				if (!made.ok) onNotify(failureText(lang, made));
				else setJob({ name: made.name, prompt: made.prompt });
			} else if (way === "key") {
				const sent = await window.studio.sendRequest(root, full);
				if (!sent.ok) onNotify(failureText(lang, sent));
				else setDone(true);
			} else if (way === "browser") {
				const made = await window.studio.requestUpload(root, full);
				if (!made.ok) onNotify(failureText(lang, made));
				else setUpload({ message: made.message });
			}
		} finally {
			setBusy(false);
		}
	};

	const collect = async () => {
		if (job === null) return;
		setBusy(true);
		try {
			const got = await window.studio.collectUnitsJob(root, job.name);
			if (!got.ok) {
				onNotify(failureText(lang, got));
				return;
			}
			if (got.collected === 0) {
				setIssue(
					got.refused.length > 0 ? say("ask.refused") : say("book.nothingYet"),
				);
				return;
			}
			setDone(true);
		} finally {
			setBusy(false);
		}
	};

	const check = async () => {
		setBusy(true);
		setIssue("");
		try {
			const got = await window.studio.answerRequest(root, full, answer);
			if (!got.ok) onNotify(failureText(lang, got));
			else if (!got.accepted) setIssue(got.issue);
			else setDone(true);
		} finally {
			setBusy(false);
		}
	};

	const copy = async (value: string) => {
		const got = await window.studio.copyText(value);
		onNotify(got.ok ? say("notes.copied") : failureText(lang, got));
	};

	const toolName =
		ai?.choice?.way === "tool"
			? say(`notes.tool.${ai.choice.tool}` as TextKey)
			: "";
	const started = job !== null || upload !== null || done;

	return (
		<div className="veil">
			<div
				className="dialog book-dialog"
				aria-modal="true"
				role="dialog"
				aria-label={say("ask.title")}
			>
				<header className="new-head">
					<div>
						<h2>{say("ask.title")}</h2>
						<p className="muted" dir="auto">
							{about}
						</p>
					</div>
					<button
						type="button"
						className="btn btn-quiet"
						disabled={busy}
						onClick={onClose}
					>
						{say("settings.close")}
					</button>
				</header>

				{gate}

				{ready && !started && (
					<>
						<label className="field">
							<span className="field-label">{say("ask.hint")}</span>
							<textarea
								value={text}
								dir="auto"
								rows={4}
								maxLength={REQUEST_MAX}
								onChange={(event) => setText(event.target.value)}
							/>
						</label>
						<p className="muted small">
							{say("ask.count", { n: text.length, max: REQUEST_MAX })}
							{way === "key" &&
								cost !== null &&
								` · ${say("book.cost", { cost: costWords(cost, lang) })}`}
						</p>
						<div className="notes-row">
							<button
								type="button"
								className="btn"
								disabled={
									busy ||
									text.trim() === "" ||
									(way === "key" && ai?.keySet !== true)
								}
								onClick={() => void send()}
							>
								{busy ? say("book.starting") : say("ask.send")}
							</button>
						</div>
					</>
				)}

				{job !== null && !done && (
					<div className="job-prompt">
						<p>{say("book.give", { tool: toolName })}</p>
						<textarea readOnly value={job.prompt} dir="ltr" rows={7} />
						<div className="notes-row">
							<button
								type="button"
								className="btn"
								onClick={() => void copy(job.prompt)}
							>
								{say("book.copy")}
							</button>
							<button
								type="button"
								className="btn"
								disabled={busy}
								onClick={() => void collect()}
							>
								{busy ? say("changes.collecting") : say("book.collect")}
							</button>
						</div>
					</div>
				)}

				{upload !== null && !done && (
					<div className="rounds">
						<p>{say("ask.upload")}</p>
						<textarea readOnly value={upload.message} dir="ltr" rows={5} />
						<button
							type="button"
							className="btn btn-quiet"
							onClick={() => void copy(upload.message)}
						>
							{say("book.copy")}
						</button>
						<label className="field">
							<span className="field-label">{say("rounds.paste")}</span>
							<textarea
								value={answer}
								dir="auto"
								rows={7}
								onChange={(event) => setAnswer(event.target.value)}
							/>
						</label>
						<button
							type="button"
							className="btn"
							disabled={busy || answer.trim() === ""}
							onClick={() => void check()}
						>
							{busy ? say("changes.saving") : say("rounds.check")}
						</button>
					</div>
				)}

				{issue !== "" && <p className="issues">{issue}</p>}

				{done && (
					<>
						<p>{say("ask.sent")}</p>
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
					</>
				)}
			</div>
		</div>
	);
}
