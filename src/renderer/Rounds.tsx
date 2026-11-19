// The browser rounds of one course period (task 245): "Round 2 of 6: Unit 1 · …", the file to
// upload (shown in Explorer), the message to copy, a box for the pasted answer, and "Check the
// answer". A bad answer says what is wrong and the round can be done again. The rounds are kept
// on disk by the main process, so the panel picks up where the teacher left off.

import { useCallback, useEffect, useState } from "react";

import type { RoundsReply } from "../shared/api";
import { failureText } from "./App";
import { useLang, useSay } from "./i18n";

type View = Extract<RoundsReply, { ok: true }>["view"];

export function Rounds({
	root,
	course,
	period,
	guess,
	onDone,
	onNotify,
}: {
	root: string;
	course: { grade: number; subject: string; language: string };
	period: string;
	/** About how many rounds, before the outline is in. */
	guess: number;
	onDone: () => void;
	onNotify: (text: string) => void;
}) {
	const say = useSay();
	const lang = useLang();
	const [view, setView] = useState<View>(null);
	const [loaded, setLoaded] = useState(false);
	const [answer, setAnswer] = useState("");
	const [issue, setIssue] = useState("");
	const [busy, setBusy] = useState(false);
	const args = [course.grade, course.subject, course.language, period] as const;

	// biome-ignore lint/correctness/useExhaustiveDependencies: the course period is the trigger.
	const load = useCallback(async () => {
		const got = await window.studio.roundsState(root, ...args);
		setView(got.ok ? got.view : null);
		setLoaded(true);
	}, [root, course.grade, course.subject, course.language, period]);

	useEffect(() => {
		void load();
	}, [load]);

	const start = async () => {
		setBusy(true);
		setIssue("");
		try {
			const got = await window.studio.startRounds(root, ...args);
			if (!got.ok) {
				onNotify(failureText(lang, got));
				return;
			}
			setView(got.view);
			setAnswer("");
		} finally {
			setBusy(false);
		}
	};

	const check = async () => {
		setBusy(true);
		setIssue("");
		try {
			const got = await window.studio.answerRound(root, ...args, answer);
			if (!got.ok) {
				onNotify(failureText(lang, got));
				return;
			}
			if (!got.accepted) {
				setIssue(got.issue);
				return;
			}
			setView(got.view);
			setAnswer("");
			if (got.view?.done === true) onDone();
			else onNotify(say("rounds.kept"));
		} finally {
			setBusy(false);
		}
	};

	const copy = async () => {
		if (view === null) return;
		const got = await window.studio.copyText(view.message);
		onNotify(got.ok ? say("notes.copied") : failureText(lang, got));
	};

	const show = async () => {
		const got = await window.studio.showRoundFile(root, ...args);
		if (!got.ok) onNotify(failureText(lang, got));
	};

	if (!loaded) return null;

	if (view === null)
		return (
			<div className="rounds">
				<p className="muted">{say("rounds.guess", { n: guess })}</p>
				<button
					type="button"
					className="btn"
					disabled={busy}
					onClick={() => void start()}
				>
					{busy ? say("book.starting") : say("book.start")}
				</button>
			</div>
		);

	if (view.done)
		return (
			<div className="rounds">
				<p>{say("rounds.done")}</p>
				<button
					type="button"
					className="btn btn-quiet"
					disabled={busy}
					onClick={() => void start()}
				>
					{say("rounds.again")}
				</button>
			</div>
		);

	const heading =
		view.unit === null
			? say("rounds.outline", { round: view.round, total: view.total })
			: say("rounds.unit", {
					round: view.round,
					total: view.total,
					unit: view.unit.number,
					title: view.unit.title,
				}) +
				(view.unit.parts > 1
					? say("rounds.part", {
							part: view.unit.part,
							parts: view.unit.parts,
						})
					: "");

	return (
		<div className="rounds">
			<h3 dir="auto">{heading}</h3>
			<p>{say("rounds.steps")}</p>
			<div className="notes-row">
				<button type="button" className="btn" onClick={() => void show()}>
					{say("rounds.showFile")}
				</button>
				<button
					type="button"
					className="btn btn-quiet"
					onClick={() => void copy()}
				>
					{say("book.copy")}
				</button>
			</div>
			<textarea readOnly value={view.message} dir="ltr" rows={6} />
			<label className="field">
				<span className="field-label">{say("rounds.paste")}</span>
				<textarea
					value={answer}
					dir="auto"
					rows={8}
					onChange={(event) => setAnswer(event.target.value)}
				/>
			</label>
			{issue !== "" && <p className="issues">{issue}</p>}
			<div className="notes-row">
				<button
					type="button"
					className="btn"
					disabled={busy || answer.trim() === ""}
					onClick={() => void check()}
				>
					{busy ? say("changes.saving") : say("rounds.check")}
				</button>
				<button
					type="button"
					className="btn btn-quiet"
					disabled={busy}
					onClick={() => void start()}
				>
					{say("rounds.again")}
				</button>
			</div>
		</div>
	);
}
