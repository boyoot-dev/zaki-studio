// The Notes tab (task 157): the files that have no note yet, the author's key and model, the
// cost of a run before it starts, and the job folders for an AI tool the author runs himself.
// Nothing here ever sees the key: the page saves it once and is told only whether one is set.
// The list of files comes in pages and draws only what is on screen (task 168), so a first
// scan of a huge project stays quick; the filter narrows it (task 178, blocks and years from
// task 181, types from task 182), and a chosen file the filter hides stays chosen.
//
// The window keeps its place (task 181): ticking a box never reloads the list, and a real
// reload fetches the pages under the rows already on screen, so nothing is unmounted. Only a
// changed filter empties the list and starts again at the top.

import studioSubjects from "virtual:subjects";
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
import {
	ALL_NOTES,
	type NotesFacets,
	type NotesFilter,
} from "../shared/notes-filter.ts";
import { KINDS } from "../shared/register.ts";
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
	// The flattened list of files, page by page as the window reaches it, under the filter.
	const [items, setItems] = useState<Map<number, NotesListItem>>(
		() => new Map(),
	);
	const [total, setTotal] = useState(0);
	const [totalMissing, setTotalMissing] = useState(0);
	// The filter is kept for this project for the session, and never written to it.
	const [filter, setFilter] = useState<NotesFilter>(ALL_NOTES);
	const [facets, setFacets] = useState<NotesFacets>({
		grades: [],
		subjects: [],
		blocks: [],
		anyNoBlock: false,
		years: [],
		anyNoYear: false,
		kinds: [],
	});
	const [loaded, setLoaded] = useState(false);
	// The ids every file the filter shows, loaded page or not, for the two buttons below.
	const [shown, setShown] = useState<string[]>([]);
	const filterRef = useRef(filter);
	filterRef.current = filter;
	const requested = useRef(new Set<number>());
	// The range of rows the window last asked for, so a reload can fetch those pages again.
	const wanted = useRef({ start: 0, end: 0 });

	const [keySet, setKeySet] = useState(false);
	const [jobs, setJobs] = useState<JobSummary[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [plan, setPlan] = useState<NotesPlan | null>(null);
	const [limit, setLimit] = useState(2);
	const [keyInput, setKeyInput] = useState("");
	const [modelInput, setModelInput] = useState("");
	const [writing, setWriting] = useState(false);
	const [progress, setProgress] = useState<NotesProgress | null>(null);
	// True when the list is narrowed at all, so the chosen count can say a hidden file counts.
	const filtering =
		filter.grade !== null ||
		filter.subject !== null ||
		filter.blocks.length > 0 ||
		filter.years.length > 0 ||
		filter.kinds.length > 0 ||
		!filter.onlyMissing;
	const [tool, setTool] = useState<JobTool>("claude-code");
	const [prepared, setPrepared] = useState<JobMade | null>(null);
	const [collected, setCollected] = useState<JobCollected | null>(null);
	const [failed, setFailed] = useState<
		{ id: string; path: string; reason: string }[]
	>([]);

	/** One page of the flattened list, into the map the rows read from. */
	const loadPage = useCallback(
		async (offset: number, current: NotesFilter) => {
			const result = await window.studio.notesRows(root, offset, PAGE, current);
			// A page asked for under a filter that has since changed is dropped, or its rows
			// would land in the new list.
			if (current !== filterRef.current) return;
			setLoaded(true);
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

	/** Fetches the pages the visible window needs, under the filter as it is now. */
	const ensureRange = useCallback(
		(start: number, end: number) => {
			wanted.current = { start, end };
			const first = Math.floor(Math.max(0, start) / PAGE);
			const last = Math.floor(Math.max(0, end - 1) / PAGE);
			for (let page = first; page <= last; page += 1) {
				if (requested.current.has(page)) continue;
				requested.current.add(page);
				void loadPage(page * PAGE, filterRef.current);
			}
		},
		[loadPage],
	);

	/** The files the filter shows, so the two "all shown" buttons know every one of them. */
	const loadShown = useCallback(
		async (current: NotesFilter) => {
			const answer = await window.studio.notesIds(root, current);
			// A list asked for under an older filter would tick files the author no longer sees.
			if (current !== filterRef.current || !answer.ok) return;
			setShown(answer.ids);
		},
		[root],
	);

	/** Reads the counts, the values the selects offer, the settings and the jobs, and fetches
	 * the pages the window shows again; the list keeps what it has until they arrive. */
	const load = useCallback(async () => {
		const state = await window.studio.notesState(root, filterRef.current);
		if (!state.ok) {
			onNotify(failureText(lang, state));
			return;
		}
		setTotalMissing(state.missing);
		setFacets(state.facets);
		setLimit(state.settings.limit);
		setModelInput(state.settings.model);
		setKeySet(state.keySet);
		setJobs(state.jobs);
		// A note landing moves the rows, so every page is fetched again when the window reaches
		// it. The pages on screen are fetched now, over the rows already drawn: the window is
		// never unmounted for a reload, and so keeps its scroll (task 181).
		requested.current = new Set();
		ensureRange(wanted.current.start, wanted.current.end);
		void loadShown(filterRef.current);
	}, [ensureRange, lang, loadShown, onNotify, root]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is the trigger — re-read when the folder changed on disk.
	useEffect(() => {
		void load();
	}, [load, reloadKey]);

	// A narrower list is a different list: the pages fetched under the old filter go, and the
	// window starts again at the top (task 181). The first run is left to load above, which
	// reads the project as well.
	const firstFilter = useRef(true);
	useEffect(() => {
		if (firstFilter.current) {
			firstFilter.current = false;
			return;
		}
		setItems(new Map());
		setTotal(0);
		setLoaded(false);
		setShown([]);
		requested.current = new Set();
		wanted.current = { start: 0, end: 0 };
		void loadPage(0, filter);
		void loadShown(filter);
	}, [filter, loadPage, loadShown]);

	// The type boxes follow the grade and subject chosen, so they are read again when either
	// changes; everything else the state gave is left as it is (task 182).
	const facetsKey = `${filter.grade ?? ""}|${filter.subject ?? ""}`;
	const facetsFor = useRef(facetsKey);
	useEffect(() => {
		if (facetsFor.current === facetsKey) return;
		facetsFor.current = facetsKey;
		void (async () => {
			const state = await window.studio.notesState(root, filterRef.current);
			if (state.ok) setFacets(state.facets);
		})();
	}, [facetsKey, root]);

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

	/** One box of the filter turned on or off; no box in a row means every value of it. */
	const toggleValue = (field: "blocks" | "years" | "kinds", value: string) =>
		setFilter({ ...filter, [field]: switched(filter[field], value) });

	/** Ticks every file the filter shows, loaded page or not (task 181). */
	const tickShown = () => setSelected((now) => new Set([...now, ...shown]));

	/** Unticks every file the filter shows; a file the filter hides stays chosen. */
	const untickShown = () =>
		setSelected((now) => {
			const next = new Set(now);
			for (const id of shown) next.delete(id);
			return next;
		});

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
				<h3>{say("notes.files")}</h3>
				<div className="notes-row">
					<label className="field">
						<span className="field-label">{say("notes.filterGrade")}</span>
						<select
							value={filter.grade === null ? "all" : String(filter.grade)}
							onChange={(event) =>
								setFilter({
									...filter,
									// The types are the new grade's, so the old ones are let go.
									kinds: [],
									grade:
										event.target.value === "all"
											? null
											: Number(event.target.value),
								})
							}
						>
							<option value="all">{say("notes.allGrades")}</option>
							{facets.grades.map((grade) => (
								<option key={grade} value={grade}>
									{gradeLabel(lang, grade)}
								</option>
							))}
						</select>
					</label>
					<label className="field">
						<span className="field-label">{say("notes.filterSubject")}</span>
						<select
							value={filter.subject ?? "all"}
							onChange={(event) =>
								setFilter({
									...filter,
									// The types are the new subject's, so the old ones are let go.
									kinds: [],
									subject:
										event.target.value === "all" ? null : event.target.value,
								})
							}
						>
							<option value="all">{say("notes.allSubjects")}</option>
							{facets.subjects.map((subject) => (
								<option key={subject} value={subject}>
									{subjectName(subject, lang)}
								</option>
							))}
						</select>
					</label>
					<label className="check">
						<input
							type="checkbox"
							checked={filter.onlyMissing}
							onChange={(event) =>
								setFilter({ ...filter, onlyMissing: event.target.checked })
							}
						/>
						<span>{say("notes.onlyMissing")}</span>
					</label>
				</div>
				{/* A few boxes per row, one row of blocks, one of years and one of types: a box
				    ticked is a value to show, and no box ticked is every value (task 181, 182). */}
				<div className="notes-row">
					{(facets.blocks.length > 0 || facets.anyNoBlock) && (
						<div className="field">
							<span className="field-label">{say("notes.filterBlock")}</span>
							<div className="notes-checks">
								{facets.blocks.map((block) => (
									<label className="check" key={block}>
										<input
											type="checkbox"
											checked={filter.blocks.includes(block)}
											onChange={() => toggleValue("blocks", block)}
										/>
										<span>{say("new.block", { block })}</span>
									</label>
								))}
								{facets.anyNoBlock && (
									<label className="check">
										<input
											type="checkbox"
											checked={filter.blocks.includes("")}
											onChange={() => toggleValue("blocks", "")}
										/>
										<span>{say("new.noBlock")}</span>
									</label>
								)}
							</div>
						</div>
					)}
					{(facets.years.length > 0 || facets.anyNoYear) && (
						<div className="field">
							<span className="field-label">{say("notes.filterYear")}</span>
							<div className="notes-checks">
								{facets.years.map((year) => (
									<label className="check" key={year}>
										<input
											type="checkbox"
											checked={filter.years.includes(year)}
											onChange={() => toggleValue("years", year)}
										/>
										<span dir="ltr">{year}</span>
									</label>
								))}
								{facets.anyNoYear && (
									<label className="check">
										<input
											type="checkbox"
											checked={filter.years.includes("")}
											onChange={() => toggleValue("years", "")}
										/>
										<span>{say("new.year.none")}</span>
									</label>
								)}
							</div>
						</div>
					)}
				</div>
				{facets.kinds.length > 0 && (
					<div className="notes-row">
						<div className="field">
							<span className="field-label">{say("notes.filterKind")}</span>
							<div className="notes-checks">
								{facets.kinds.map((kind) => (
									<label className="check" key={kind}>
										<input
											type="checkbox"
											checked={filter.kinds.includes(kind)}
											onChange={() => toggleValue("kinds", kind)}
										/>
										<span>{kindName(kind, say)}</span>
									</label>
								))}
							</div>
						</div>
					</div>
				)}
				<div className="notes-row">
					<p className="muted">{say("notes.chosen", { n: selected.size })}</p>
					<button
						type="button"
						className="btn btn-quiet"
						disabled={shown.length === 0}
						onClick={tickShown}
					>
						{say("notes.tickShown", { n: shown.length })}
					</button>
					<button
						type="button"
						className="btn btn-quiet"
						disabled={shown.length === 0 || selected.size === 0}
						onClick={untickShown}
					>
						{say("notes.untickShown")}
					</button>
				</div>
				{selected.size > 0 && filtering && (
					<p className="muted">{say("notes.chosenHint")}</p>
				)}
				{!loaded ? (
					<p className="muted">{say("curriculum.loading")}</p>
				) : total === 0 ? (
					<p className="muted">
						{filter.onlyMissing && totalMissing === 0
							? say("notes.none")
							: say("notes.noneMatch")}
					</p>
				) : (
					<WindowedList
						count={total}
						rowHeight={ROW}
						className="notes-list"
						itemClassName="notes-item"
						onRangeChange={ensureRange}
					>
						{renderRow}
					</WindowedList>
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
									{failed.slice(0, 300).map((entry) => (
										<li key={entry.id} dir="auto">
											{fileName(entry.path)}: {entry.reason}
										</li>
									))}
								</ul>
								{failed.length > 300 && (
									<p className="muted">
										{say("notes.failedMore", { n: failed.length - 300 })}
									</p>
								)}
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

/** The same list with one value turned on or off, for a box of the filter's rows. */
function switched(values: readonly string[], value: string): string[] {
	return values.includes(value)
		? values.filter((entry) => entry !== value)
		: [...values, value];
}

/** A file type's own name, in the window's language; a kind the register does not know is shown
 * as it is written. */
function kindName(kind: string, say: Say): string {
	return KINDS.includes(kind as (typeof KINDS)[number])
		? say(`kind.${kind}` as TextKey)
		: kind;
}

/** The subject's own name, in the window's language, for the filter's options. */
function subjectName(id: string, lang: Lang): string {
	const subject = studioSubjects.find((entry) => entry.id === id);
	if (subject === undefined) return id;
	return lang === "ar" ? subject.nameAr : subject.nameEn;
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
