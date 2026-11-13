// The Notes tab (task 157): the files that have no note yet, the author's key and model, the
// cost of a run before it starts, and the job folders for an AI tool the author runs himself.
// Nothing here ever sees the key: the page saves it once and is told only whether one is set.
// The list of files without a note comes in pages and draws only what is on screen
// (task 168), so a first scan of a huge project stays quick.

import { useCallback, useEffect, useRef, useState } from "react";

import type {
	JobCollected,
	JobMade,
	NotesPlan,
	NotesProgress,
} from "../shared/api.ts";
import { gradeLabel, type Lang, type TextKey } from "../shared/i18n";
import type { JobSummary, JobTool } from "../shared/job.ts";
import type { NotesListItem } from "../shared/lists.ts";
import { failureText } from "./App";
import { useLang, useSay } from "./i18n";
import { WindowedList } from "./WindowedList";

/** A word of the window, as the panel's helpers take it. */
type Say = (key: TextKey, vars?: Record<string, string | number>) => string;

/** The page size of the flattened list over IPC. */
const PAGE = 200;
/** The height of one row of the flattened list, in pixels. */
const ROW = 34;

export function Notes({
	root,
	onPick,
	onNotify,
	onChanged,
	reloadKey,
}: {
	root: string;
	onPick: (rel: string) => void;
	onNotify: (text: string) => void;
	onChanged: () => void;
	/** Bumped when the folder changed on disk; the list is re-read. */
	reloadKey: number;
}) {
	const say = useSay();
	const lang = useLang();
	// The flattened list of files without a note, page by page as the window reaches it.
	const [items, setItems] = useState<Map<number, NotesListItem>>(
		() => new Map(),
	);
	const [total, setTotal] = useState(0);
	const [totalMissing, setTotalMissing] = useState(0);
	const requested = useRef(new Set<number>());

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

	/** One page of the flattened list, into the map the rows read from. */
	const loadPage = useCallback(
		async (offset: number) => {
			const result = await window.studio.notesRows(root, offset, PAGE);
			if (!result.ok) {
				onNotify(failureText(lang, result));
				return;
			}
			setItems((current) => {
				const next = new Map(current);
				for (const [index, item] of result.items.entries())
					next.set(offset + index, item);
				return next;
			});
			setTotal(result.total);
		},
		[lang, onNotify, root],
	);

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

	/** Reads the counts, the settings and the jobs; the list loads page by page. */
	const load = useCallback(async () => {
		const state = await window.studio.notesState(root);
		if (!state.ok) {
			onNotify(failureText(lang, state));
			return;
		}
		setTotalMissing(state.missing);
		setLimit(state.settings.limit);
		setModelInput(state.settings.model);
		setKeySet(state.keySet);
		setJobs(state.jobs);
		// The list's order changes only when a note lands or a file is corrected.
		setItems(new Map());
		setTotal(0);
		requested.current = new Set();
		void loadPage(0);
	}, [lang, loadPage, onNotify, root]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is the trigger — re-read when the folder changed on disk.
	useEffect(() => {
		void load();
	}, [load, reloadKey]);

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
	const toggleGroup = (ids: string[], all: boolean) => {
		setSelected((now) => {
			const next = new Set(now);
			for (const id of ids) {
				if (all) next.delete(id);
				else next.add(id);
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

	const renderRow = (index: number) => {
		const item = items.get(index);
		if (item === undefined)
			return (
				<div className="row row-pending" aria-hidden="true">
					<span className="muted">…</span>
				</div>
			);
		if (item.kind === "group") {
			const all = item.ids.every((id) => selected.has(id));
			return (
				<div className="row row-head">
					<label className="check">
						<input
							type="checkbox"
							checked={all}
							onChange={() => toggleGroup(item.ids, all)}
						/>
						<span dir="auto">{groupTitle(item, lang, say)}</span>
					</label>
				</div>
			);
		}
		const row = item.row;
		const checked = selected.has(row.id);
		return (
			<div className="row">
				<label className="check">
					<input
						type="checkbox"
						checked={checked}
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
			</div>
		);
	};

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
				{totalMissing === 0 ? (
					<p className="muted">{say("notes.none")}</p>
				) : (
					<>
						<p className="muted">{say("notes.chosen", { n: selected.size })}</p>
						<WindowedList
							count={total}
							rowHeight={ROW}
							className="notes-list"
							itemClassName="notes-item"
							onRangeChange={ensureRange}
						>
							{renderRow}
						</WindowedList>
					</>
				)}

				{selected.size > 0 && (
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

/** The group's title: "Grade 3 · math · Block 1", or the parts the register doesn't know. */
function groupTitle(
	group: {
		grade: number | null;
		subject: string;
		block: string;
	},
	lang: Lang,
	say: Say,
): string {
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

/** A file's own name, as the list shows it. */
function fileName(path: string): string {
	return path.split("/").pop() ?? path;
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
