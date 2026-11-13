// The Notes tab (task 157): the files that have no note yet, the author's key and model, the
// cost of a run before it starts, and the job folders for an AI tool the author runs himself.
// Nothing here ever sees the key: the page saves it once and is told only whether one is set.

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
	JobCollected,
	JobMade,
	NotesPlan,
	NotesProgress,
} from "../shared/api";
import { gradeLabel, type Lang, type TextKey } from "../shared/i18n";
import type { JobSummary, JobTool } from "../shared/job";
import type { FileRow } from "../shared/model";
import { failureText } from "./App";
import { useLang, useSay } from "./i18n";

/** A word of the window, as the panel's helpers take it. */
type Say = (key: TextKey, vars?: Record<string, string | number>) => string;

/** One grade, subject and block of files, as the list groups them. */
type Group = {
	key: string;
	grade: number | null;
	subject: string;
	block: string;
	rows: FileRow[];
};

/** The files of one note-less list, grouped and sorted the way the panel shows them. */
export function noteGroups(rows: readonly FileRow[]): Group[] {
	const groups = new Map<string, Group>();
	for (const row of rows) {
		const key = `${row.grade ?? "?"}|${row.subject}|${row.block}`;
		const group = groups.get(key) ?? {
			key,
			grade: row.grade,
			subject: row.subject,
			block: row.block,
			rows: [],
		};
		group.rows.push(row);
		groups.set(key, group);
	}
	return [...groups.values()].sort(
		(a, b) =>
			(a.grade ?? -1) - (b.grade ?? -1) ||
			a.subject.localeCompare(b.subject) ||
			a.block.localeCompare(b.block),
	);
}

/** A file's own name, as the list shows it. */
function fileName(path: string): string {
	return path.split("/").pop() ?? path;
}

export function Notes({
	root,
	onPick,
	onNotify,
	onChanged,
}: {
	root: string;
	onPick: (rel: string) => void;
	onNotify: (text: string) => void;
	onChanged: () => void;
}) {
	const say = useSay();
	const lang = useLang();
	const [rows, setRows] = useState<FileRow[]>([]);
	const [missing, setMissing] = useState<FileRow[]>([]);
	const [keySet, setKeySet] = useState(false);
	const [jobs, setJobs] = useState<JobSummary[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [plan, setPlan] = useState<NotesPlan | null>(null);
	const [limit, setLimit] = useState(2);
	const [keyInput, setKeyInput] = useState("");
	const [modelInput, setModelInput] = useState("");
	const [writing, setWriting] = useState(false);
	const [progress, setProgress] = useState<NotesProgress | null>(null);
	const [tool, setTool] = useState<JobTool>("claude-code");
	const [prepared, setPrepared] = useState<JobMade | null>(null);
	const [collected, setCollected] = useState<JobCollected | null>(null);
	const [failed, setFailed] = useState<
		{ id: string; path: string; reason: string }[]
	>([]);

	/** Reads the register, the settings and the jobs; nothing is sent. */
	const load = useCallback(async () => {
		const state = await window.studio.notesState(root);
		if (!state.ok) {
			onNotify(failureText(lang, state));
			return;
		}
		setRows(state.files);
		setMissing(state.missing);
		setLimit(state.settings.limit);
		setModelInput(state.settings.model);
		setKeySet(state.keySet);
		setJobs(state.jobs);
	}, [lang, onNotify, root]);

	useEffect(() => {
		void load();
	}, [load]);

	// The cost is worked out after a short pause, so ticking several boxes sends one ask.
	useEffect(() => {
		if (selected.size === 0) {
			setPlan(null);
			return;
		}
		const timer = window.setTimeout(() => {
			void (async () => {
				const answer = await window.studio.notesPlan(root, [...selected]);
				setPlan(answer.ok ? answer.plan : null);
			})();
		}, 350);
		return () => window.clearTimeout(timer);
	}, [root, selected]);

	/** Ticks or unticks one file. */
	const toggle = (id: string) => {
		setSelected((now) => {
			const next = new Set(now);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	/** A whole block: every file in it, or none of them. */
	const toggleGroup = (group: Group) => {
		const all = group.rows.every((row) => selected.has(row.id));
		setSelected((now) => {
			const next = new Set(now);
			for (const row of group.rows) {
				if (all) next.delete(row.id);
				else next.add(row.id);
			}
			return next;
		});
	};

	/** Saves the model and the limit, so the next plan uses them. */
	const saveSettings = async () => {
		const answer = await window.studio.saveNoteSettings(modelInput, limit);
		if (!answer.ok) {
			onNotify(failureText(lang, answer));
			return;
		}
		setLimit(answer.settings.limit);
		onNotify(say("notes.saved"));
		// The price may have changed with the model: work the run out again.
		if (selected.size > 0) {
			const plan = await window.studio.notesPlan(root, [...selected]);
			setPlan(plan.ok ? plan.plan : null);
		}
	};

	const saveKey = async () => {
		const answer = await window.studio.saveKey(keyInput);
		if (!answer.ok) {
			onNotify(failureText(lang, answer));
			return;
		}
		// The key is not kept on the page at all: only the boolean stays.
		setKeyInput("");
		setKeySet(true);
		onNotify(say("notes.keySaved"));
	};

	const clearKey = async () => {
		await window.studio.clearKey();
		setKeySet(false);
		onNotify(say("notes.keyCleared"));
	};

	const testKey = async () => {
		onNotify(say("notes.testing"));
		const answer = await window.studio.testKey();
		onNotify(answer.ok ? say("notes.testOk") : failureText(lang, answer));
	};

	/** Writes the notes of the ticked files with the author's key. */
	const write = async () => {
		if (selected.size === 0) return;
		setWriting(true);
		setProgress(null);
		setFailed([]);
		const stop = window.studio.onNotesProgress(setProgress);
		try {
			const answer = await window.studio.writeNotes(root, [...selected], limit);
			if (!answer.ok) {
				onNotify(failureText(lang, answer));
				return;
			}
			setSelected(new Set());
			setPlan(null);
			setFailed(answer.failed);
			onNotify(
				answer.stopped
					? say("notes.stopped", { n: answer.written })
					: say("notes.wrote", { n: answer.written }),
			);
			for (const failed of answer.failed.slice(0, 3))
				onNotify(
					say("notes.failedLine", {
						name: fileName(failed.path),
						reason: failed.reason,
					}),
				);
			await load();
			onChanged();
		} finally {
			stop();
			setWriting(false);
			setProgress(null);
		}
	};

	/** Prepares a job folder for the author's own AI tool. */
	const prepare = async () => {
		if (selected.size === 0) return;
		const answer = await window.studio.prepareJob(root, [...selected], tool);
		if (!answer.ok) {
			onNotify(failureText(lang, answer));
			return;
		}
		setPrepared(answer);
		onNotify(say("notes.jobReady", { n: answer.files }));
		await load();
	};

	const copyPrompt = async () => {
		if (!prepared?.ok) return;
		const answer = await window.studio.copyText(prepared.prompt);
		onNotify(answer.ok ? say("notes.copied") : failureText(lang, answer));
	};

	/** Collects a job's notes, and says what was kept and what was refused. */
	const collect = async (name: string) => {
		const answer = await window.studio.collectJob(root, name);
		if (!answer.ok) {
			onNotify(failureText(lang, answer));
			return;
		}
		setCollected(answer);
		setSelected(new Set());
		setPlan(null);
		onNotify(
			say("notes.collected", {
				n: answer.collected,
				skipped: answer.skipped,
			}),
		);
		await load();
		onChanged();
	};

	const removeJob = async (name: string) => {
		await window.studio.deleteJob(root, name);
		await load();
	};

	const groups = useMemo(() => noteGroups(missing), [missing]);
	const chosenRows = rows.filter((row) => selected.has(row.id));

	return (
		<div className="notes">
			<header className="new-head">
				<div>
					<h2>{say("notes.title")}</h2>
					<p className="muted">{say("notes.intro")}</p>
				</div>
			</header>

			<section className="notes-settings">
				<h3>{say("notes.settings")}</h3>
				<div className="notes-row">
					<label className="field">
						<span className="field-label">{say("notes.model")}</span>
						<input
							type="text"
							value={modelInput}
							onChange={(event) => setModelInput(event.target.value)}
							dir="ltr"
						/>
					</label>
					<label className="field">
						<span className="field-label">{say("notes.limit")}</span>
						<input
							type="number"
							min="0.01"
							max="100"
							step="0.5"
							value={limit}
							onChange={(event) => setLimit(Number(event.target.value) || 0)}
						/>
					</label>
					<button
						type="button"
						className="btn btn-quiet"
						onClick={() => void saveSettings()}
					>
						{say("notes.saveSettings")}
					</button>
				</div>

				<p className="muted">
					{keySet ? say("notes.keySet") : say("notes.keyMissing")}
				</p>
				<div className="notes-row">
					<label className="field">
						<span className="field-label">{say("notes.key")}</span>
						<input
							type="password"
							value={keyInput}
							placeholder={say("notes.keyPlaceholder")}
							onChange={(event) => setKeyInput(event.target.value)}
							dir="ltr"
							autoComplete="off"
						/>
					</label>
					<button
						type="button"
						className="btn"
						disabled={keyInput.trim() === ""}
						onClick={() => void saveKey()}
					>
						{say("notes.saveKey")}
					</button>
					{keySet && (
						<>
							<button
								type="button"
								className="btn btn-quiet"
								onClick={() => void testKey()}
							>
								{say("notes.testKey")}
							</button>
							<button
								type="button"
								className="btn btn-quiet btn-danger"
								onClick={() => void clearKey()}
							>
								{say("notes.clearKey")}
							</button>
						</>
					)}
				</div>
				<p className="muted">{say("notes.keyHint")}</p>
				{plan !== null && !plan.readsImages && (
					<p className="issues">{say("notes.noVision")}</p>
				)}
				{plan !== null && !plan.found && (
					<p className="issues">{say("notes.unknownModel")}</p>
				)}
			</section>

			<section>
				<h3>{say("notes.without")}</h3>
				{missing.length === 0 ? (
					<p className="muted">{say("notes.none")}</p>
				) : (
					<>
						<p className="muted">{say("notes.chosen", { n: selected.size })}</p>
						{groups.map((group) => {
							const all = group.rows.every((row) => selected.has(row.id));
							return (
								<div key={group.key} className="notes-group">
									<label className="check">
										<input
											type="checkbox"
											checked={all}
											onChange={() => toggleGroup(group)}
										/>
										<span>{groupTitle(group, lang, say)}</span>
									</label>
									<ul className="new-list">
										{group.rows.map((row) => (
											<li key={row.id}>
												<label className="check">
													<input
														type="checkbox"
														checked={selected.has(row.id)}
														onChange={() => toggle(row.id)}
													/>
													<button
														type="button"
														className="link-button"
														onClick={() => onPick(row.path)}
													>
														{fileName(row.path)}
													</button>
												</label>
												<span className="muted">
													{" "}
													{say("notes.pages", {
														n: row.pages ?? 0,
													})}
												</span>
											</li>
										))}
									</ul>
								</div>
							);
						})}
					</>
				)}

				{chosenRows.length > 0 && (
					<div className="notes-actions">
						<p className="muted">
							{plan === null
								? say("notes.estimating")
								: say("notes.estimate", {
										files: plan.files,
										pages: plan.pages,
										images: plan.imagePages,
										cost:
											plan.estimateUsd === null
												? say("notes.costUnknown")
												: `$${plan.estimateUsd.toFixed(4)}`,
										model: plan.model,
									})}
						</p>
						<div className="notes-row">
							<button
								type="button"
								className="btn"
								disabled={writing || !keySet || selected.size === 0}
								onClick={() => void write()}
							>
								{say("notes.write")}
							</button>
							{!keySet && (
								<span className="muted">{say("notes.noKeyHint")}</span>
							)}
						</div>
						{writing && (
							<p className="muted">
								{progress === null
									? say("notes.starting")
									: say("notes.progress", {
											done: progress.done,
											total: progress.total,
										})}
							</p>
						)}
						{failed.length > 0 && (
							<>
								<h3>{say("notes.failedTitle")}</h3>
								<ul className="new-list issues">
									{failed.map((entry) => (
										<li key={entry.id} dir="auto">
											{fileName(entry.path)}: {entry.reason}
										</li>
									))}
								</ul>
							</>
						)}
					</div>
				)}
			</section>

			<section className="notes-job">
				<h3>{say("notes.jobTitle")}</h3>
				<p className="muted">{say("notes.jobIntro")}</p>
				<div className="notes-row">
					<label className="field">
						<span className="field-label">{say("notes.jobTool")}</span>
						<select
							value={tool}
							onChange={(event) => setTool(event.target.value as JobTool)}
						>
							<option value="claude-code">
								{say("notes.tool.claude-code")}
							</option>
							<option value="other">{say("notes.tool.other")}</option>
						</select>
					</label>
					<button
						type="button"
						className="btn btn-quiet"
						disabled={selected.size === 0}
						onClick={() => void prepare()}
					>
						{say("notes.prepare")}
					</button>
				</div>
				{prepared?.ok && (
					<div className="job-prompt">
						<p className="muted">
							{say("notes.promptHint", { path: prepared.path })}
						</p>
						<textarea readOnly value={prepared.prompt} dir="ltr" rows={10} />
						<button
							type="button"
							className="btn"
							onClick={() => void copyPrompt()}
						>
							{say("notes.copy")}
						</button>
					</div>
				)}

				<h3>{say("notes.jobs")}</h3>
				{jobs.length === 0 ? (
					<p className="muted">{say("notes.jobsNone")}</p>
				) : (
					<ul className="new-list">
						{jobs.map((job) => (
							<li key={job.name}>
								<span dir="ltr">{job.name}</span>
								<span className="muted">
									{" "}
									{say("notes.jobLine", {
										created: job.created,
										tool: say(`notes.tool.${job.tool}` as TextKey),
										files: job.files,
									})}
								</span>
								<button
									type="button"
									className="btn btn-quiet"
									onClick={() => void collect(job.name)}
								>
									{say("notes.collect")}
								</button>
								<button
									type="button"
									className="btn btn-quiet btn-danger"
									onClick={() => void removeJob(job.name)}
								>
									{say("notes.deleteJob")}
								</button>
							</li>
						))}
					</ul>
				)}
				{collected?.ok && (
					<div>
						<p className="muted">
							{say("notes.collected", {
								n: collected.collected,
								skipped: collected.skipped,
							})}
						</p>
						{collected.refused.length > 0 && (
							<ul className="new-list issues">
								{collected.refused.map((entry) => (
									<li key={entry.name} dir="auto">
										{entry.name}: {refusalText(entry.code, say)}
									</li>
								))}
							</ul>
						)}
					</div>
				)}
			</section>
		</div>
	);
}

/** "Grade 3 · math · Block 1", or the parts the register doesn't know. */
function groupTitle(group: Group, lang: Lang, say: Say): string {
	return [
		group.grade === null ? say("new.noGrade") : gradeLabel(lang, group.grade),
		group.subject === "unknown" || group.subject === ""
			? say("new.noSubject")
			: group.subject,
		group.block === ""
			? say("new.noBlock")
			: say("new.block", { block: group.block }),
	].join(" · ");
}

/** Why one note in a job's out/ folder was refused, in the window's words. */
function refusalText(code: string, say: Say): string {
	const known = [
		"name",
		"link",
		"notFile",
		"unknown",
		"noFirstPart",
		"tooLarge",
		"notUtf8",
		"unusable",
	];
	return say(
		known.includes(code)
			? (`notes.refusal.${code}` as TextKey)
			: "notes.refusal.other",
	);
}
