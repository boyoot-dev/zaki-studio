// The Changes tab (task 158): what AI proposes for one course and period — units, lessons,
// skills, key words, evidence and facts with their pages — beside what the course has now, for
// the author to accept all of it, one unit or one lesson, or to reject. Also the two ways to
// get a change set: the author's own key, or a job folder for their own AI tool. Every text is
// shown as text, never as HTML, and nothing is written into the model until the author accepts.

import studioSubjects from "virtual:subjects";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
	ChangesCollected,
	ChangesState,
	ChangeTargetView,
	JobMade,
	UnitsPlanView,
} from "../shared/api";
import type {
	ChangeRefusal,
	ChangeReview,
	CleanFact,
	CleanLesson,
	ReviewLesson,
	ReviewUnit,
} from "../shared/changes";
import type { BundlePeriod } from "../shared/format/bundle";
import { gradeLabel, type Lang, type TextKey } from "../shared/i18n";
import type { JobTool } from "../shared/job";
import type { ModelFact, ModelLesson, ModelUnit } from "../shared/model";
import { fileLabel, parseSource } from "../shared/model";
import { failureText } from "./App";
import { useLang, useSay } from "./i18n";
import { WindowedList } from "./WindowedList";

/** A word of the window, as the panel's helpers take it. */
type Say = (key: TextKey, vars?: Record<string, string | number>) => string;

/** The key a target is chosen by: its grade, subject and period. */
function targetKey(target: {
	grade: number;
	subject: string;
	period: string;
}): string {
	return `${target.grade}|${target.subject}|${target.period}`;
}

/** The subject's own name, in the window's language. */
function subjectName(id: string, lang: Lang): string {
	const subject = studioSubjects.find((entry) => entry.id === id);
	if (subject === undefined) return id;
	return lang === "ar" ? subject.nameAr : subject.nameEn;
}

/** The name of a period, at any depth of the year. */
function periodName(
	periods: readonly BundlePeriod[],
	id: string,
	lang: Lang,
): string {
	for (const period of periods) {
		if (period.id === id) return lang === "ar" ? period.nameAr : period.nameEn;
		const found = periodName(period.periods, id, lang);
		if (found !== "") return found;
	}
	return id;
}

/** "p.7" or "p.12–13": the page a source names. */
function pageLabel(from: number | null, to: number | null): string {
	if (from === null) return "";
	if (to !== null && to !== from) return `p.${from}–${to}`;
	return `p.${from}`;
}

/** The chip a source shows: the register's file name and the page, or the source itself. */
function sourceLabel(
	source: string,
	paths: Record<string, { path: string; size: number }>,
): string {
	const parsed = parseSource(source);
	const known = parsed === null ? undefined : paths[parsed.id];
	if (known === undefined || parsed === null) return source;
	return [fileLabel(known.path), pageLabel(parsed.from, parsed.to)]
		.filter((part) => part !== "")
		.join(" · ");
}

/** A fact's text with the run it copied marked, in plain text nodes only. */
function marked(text: string, run: string | null) {
	if (run === null) return text;
	const at = text.indexOf(run);
	if (at < 0) return text;
	return (
		<>
			{text.slice(0, at)}
			<mark>{run}</mark>
			{text.slice(at + run.length)}
		</>
	);
}

/** The two checks a proposed fact carries, in the review's own words. */
function FactChecks({ fact, say }: { fact: CleanFact; say: Say }) {
	return (
		<>
			{!fact.pageOk && (
				<span className="fact-flag">{say("changes.pageFailed")}</span>
			)}
			{fact.copy !== null && (
				<span className="fact-flag">
					{say("changes.copiedRun", { run: fact.copy })}
				</span>
			)}
		</>
	);
}

/** One proposed fact: its text, its checks, and the pages it came from. */
function ProposedFact({
	fact,
	paths,
	say,
}: {
	fact: CleanFact;
	paths: Record<string, { path: string; size: number }>;
	say: Say;
}) {
	return (
		<li>
			<p className="fact" dir="auto">
				{marked(fact.text, fact.copy)}
			</p>
			<div className="chips">
				{fact.sources.map((source) => (
					<span key={source} className="chip">
						{sourceLabel(source, paths)}
					</span>
				))}
				<FactChecks fact={fact} say={say} />
			</div>
		</li>
	);
}

/** The now side of one lesson: what the model keeps, without the checks. */
function NowFacts({ facts }: { facts: readonly ModelFact[] }) {
	if (facts.length === 0) return null;
	return (
		<ul className="facts">
			{facts.map((fact) => (
				<li key={fact.text}>
					<p className="fact" dir="auto">
						{fact.text}
					</p>
				</li>
			))}
		</ul>
	);
}

/** The skills of one side, as plain lines. */
function Skills({
	skills,
}: {
	skills: readonly { code: string | null; text: string }[];
}) {
	if (skills.length === 0) return null;
	return (
		<ul className="skills">
			{skills.map((skill) => (
				<li key={`${skill.code ?? ""}-${skill.text}`} dir="auto">
					{skill.code !== null && <span className="code">{skill.code}</span>}
					{skill.text}
				</li>
			))}
		</ul>
	);
}

/** The now side of one lesson. */
function NowLesson({ lesson, say }: { lesson: ModelLesson; say: Say }) {
	return (
		<div>
			<h6 dir="auto">
				{say("changes.lesson", { number: lesson.number })}: {lesson.title}
			</h6>
			<Skills skills={lesson.skills} />
			<NowFacts facts={lesson.facts} />
		</div>
	);
}

/** The proposed side of one lesson: its checks, new and removed facts, and the choice. */
function ProposedLesson({
	review,
	paths,
	say,
	accepted,
	onAccept,
}: {
	review: ReviewLesson;
	paths: Record<string, { path: string; size: number }>;
	say: Say;
	accepted: boolean;
	onAccept: () => void;
}) {
	const proposed: CleanLesson = review.proposed;
	const before = new Set((review.now?.facts ?? []).map((fact) => fact.text));
	const removed = (review.now?.facts ?? []).filter(
		(fact) =>
			!fact.own && !proposed.facts.some((entry) => entry.text === fact.text),
	);
	const added = proposed.facts.filter((fact) => !before.has(fact.text));
	return (
		<div>
			<h6 dir="auto">
				{say("changes.lesson", { number: proposed.number })}: {proposed.title}
			</h6>
			<Skills skills={proposed.skills} />
			<p className="muted">
				{say("changes.newFacts", { n: added.length })} ·{" "}
				{say("changes.removedFacts", { n: removed.length })}
			</p>
			{removed.length > 0 && (
				<ul className="facts">
					{removed.map((fact) => (
						<li key={fact.text}>
							<p className="fact muted" dir="auto">
								{fact.text}
							</p>
						</li>
					))}
				</ul>
			)}
			<ul className="facts">
				{proposed.facts.map((fact) => (
					<ProposedFact key={fact.text} fact={fact} paths={paths} say={say} />
				))}
			</ul>
			<button
				type="button"
				className="btn btn-quiet"
				disabled={accepted}
				onClick={onAccept}
			>
				{accepted ? say("changes.accepted") : say("changes.acceptLesson")}
			</button>
		</div>
	);
}

/** One unit, now beside proposed. */
function UnitPair({
	review,
	reviewSet,
	paths,
	say,
	onAccept,
}: {
	review: ReviewUnit;
	reviewSet: ChangeReview;
	paths: Record<string, { path: string; size: number }>;
	say: Say;
	onAccept: (unit: number, lesson?: number) => void;
}) {
	const unitAccepted = reviewSet.accepted.includes(String(review.number));
	const now: ModelUnit | null = review.now;
	const proposed = review.proposed;
	return (
		<section className="unit">
			<h4 dir="auto">{say("changes.unit", { number: review.number })}</h4>
			<div className="changes-pair">
				<div className="changes-side">
					<h5>{say("changes.now")}</h5>
					{now === null ? (
						<p className="muted">—</p>
					) : (
						<>
							<p dir="auto">{now.title}</p>
							<UnitLists unit={now} say={say} />
							{now.lessons.map((lesson) => (
								<NowLesson key={lesson.number} lesson={lesson} say={say} />
							))}
						</>
					)}
				</div>
				<div className="changes-side">
					<h5>{say("changes.proposed")}</h5>
					<p dir="auto">{proposed.title}</p>
					<p className="muted">{proposed.source}</p>
					<UnitLists unit={proposed} say={say} />
					{review.lessons.map((lesson) => (
						<ProposedLesson
							key={lesson.number}
							review={lesson}
							paths={paths}
							say={say}
							accepted={reviewSet.accepted.includes(
								`${review.number}.${lesson.number}`,
							)}
							onAccept={() => onAccept(review.number, lesson.number)}
						/>
					))}
					<button
						type="button"
						className="btn btn-quiet"
						disabled={unitAccepted}
						onClick={() => onAccept(review.number)}
					>
						{unitAccepted ? say("changes.accepted") : say("changes.acceptUnit")}
					</button>
				</div>
			</div>
		</section>
	);
}

/** A unit's key words and evidence, on either side of the review. */
function UnitLists({
	unit,
	say,
}: {
	unit: { keywords: readonly string[]; evidence: readonly string[] };
	say: Say;
}) {
	return (
		<>
			{unit.keywords.length > 0 && (
				<div className="lesson-part">
					<h5>{say("changes.keywords")}</h5>
					<ul>
						{unit.keywords.map((word) => (
							<li key={word} dir="auto">
								{word}
							</li>
						))}
					</ul>
				</div>
			)}
			{unit.evidence.length > 0 && (
				<div className="lesson-part">
					<h5>{say("changes.evidence")}</h5>
					<ul>
						{unit.evidence.map((line) => (
							<li key={line} dir="auto">
								{line}
							</li>
						))}
					</ul>
				</div>
			)}
		</>
	);
}

/** Why one file in a job's out/ folder was refused, in the window's words. */
function refusalText(code: string, say: Say): string {
	const known = [
		"name",
		"link",
		"notFile",
		"unknown",
		"tooLarge",
		"notUtf8",
		"invalid",
	];
	return say(
		known.includes(code)
			? (`changes.refusal.${code}` as TextKey)
			: "changes.refusal.other",
	);
}

/** A change set's refused items and open questions. */
function SetNotes({ set, say }: { set: ChangeReview; say: Say }) {
	const refused: ChangeRefusal[] = set.refused;
	return (
		<>
			{set.open.length > 0 && (
				<section className="notes-actions">
					<h3>{say("changes.open")}</h3>
					<ul className="new-list">
						{set.open.map((question) => (
							<li key={question} dir="auto">
								{question}
							</li>
						))}
					</ul>
				</section>
			)}
			{refused.length > 0 && (
				<section className="notes-actions">
					<h3>{say("changes.refused")}</h3>
					<ul className="new-list issues">
						{refused.map((item) => (
							<li key={`${item.path}-${item.message}`} dir="auto">
								{item.path}: {item.message}
							</li>
						))}
					</ul>
				</section>
			)}
		</>
	);
}

export function Changes({
	root,
	project,
	onNotify,
	onChanged,
	reloadKey,
}: {
	root: string;
	project: { periods: BundlePeriod[] };
	onNotify: (text: string) => void;
	onChanged: () => void;
	/** Bumped when the project changed elsewhere: the tab stays open now, so it re-reads. */
	reloadKey: number;
}) {
	const say = useSay();
	const lang = useLang();
	const [state, setState] = useState<ChangesState | null>(null);
	const [error, setError] = useState("");
	// The paths of the files the pending sets' facts name, for the chips.
	const [paths, setPaths] = useState<
		Record<string, { path: string; size: number }>
	>({});
	const [modelInput, setModelInput] = useState("");
	const [limit, setLimit] = useState(2);
	const [picked, setPicked] = useState<Set<string>>(new Set());
	const [tool, setTool] = useState<JobTool>("claude-code");
	const [plan, setPlan] = useState<{
		target: ChangeTargetView;
		view: UnitsPlanView;
	} | null>(null);
	const [writing, setWriting] = useState(false);
	const [prepared, setPrepared] = useState<JobMade | null>(null);
	const [collected, setCollected] = useState<ChangesCollected | null>(null);

	/** Reads the periods, the sets and the jobs; nothing is sent. */
	const load = useCallback(async () => {
		const next = await window.studio.changesState(root);
		if (!next.ok) {
			setError(failureText(lang, next));
			onNotify(failureText(lang, next));
			return;
		}
		setError("");
		setState(next);
		setLimit(next.settings.limit);
		setModelInput(next.settings.model);
	}, [lang, onNotify, root]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is the trigger — the project changed while this tab stayed open.
	useEffect(() => {
		void load();
	}, [load, reloadKey]);

	// The paths of the files the pending sets' facts name, so the chips can show them.
	useEffect(() => {
		if (state?.ok !== true || state.sets.length === 0) return;
		const ids = new Set<string>();
		for (const set of state.sets) {
			for (const unit of set.units) {
				for (const lesson of unit.lessons) {
					for (const fact of lesson.proposed.facts) {
						for (const source of fact.sources) {
							const parsed = parseSource(source);
							if (parsed !== null) ids.add(parsed.id);
						}
					}
				}
			}
		}
		const wanted = [...ids].slice(0, 1500);
		if (wanted.length === 0) return;
		void (async () => {
			const found = await window.studio.filePaths(root, wanted);
			if (found.ok) setPaths((current) => ({ ...current, ...found.paths }));
		})();
	}, [state, root]);

	const targets = state?.ok === true ? state.targets : [];
	const sets = state?.ok === true ? state.sets : [];
	const rejected = state?.ok === true ? state.rejected : [];
	const jobs = state?.ok === true ? state.jobs : [];
	const keySet = state?.ok === true && state.keySet;

	/** Ticks or unticks one period for the job folder way. */
	const toggle = (target: ChangeTargetView) => {
		const key = targetKey(target);
		setPicked((now) => {
			const next = new Set(now);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	const saveSettings = async () => {
		const answer = await window.studio.saveUnitsSettings(modelInput, limit);
		if (!answer.ok) {
			onNotify(failureText(lang, answer));
			return;
		}
		setLimit(answer.settings.limit);
		onNotify(say("notes.saved"));
		await load();
	};

	/** Prices one period, so the author sees the cost before the request is sent. */
	const priceIt = async (target: ChangeTargetView) => {
		const answer = await window.studio.unitsPlan(
			root,
			target.grade,
			target.subject,
			target.period,
		);
		if (!answer.ok) {
			onNotify(failureText(lang, answer));
			return;
		}
		setPlan({ target, view: answer });
	};

	/** Writes the priced change set with the author's key. */
	const writeIt = async () => {
		if (plan === null) return;
		const target = plan.target;
		setWriting(true);
		try {
			const answer = await window.studio.writeChanges(
				root,
				target.grade,
				target.subject,
				target.period,
				limit,
			);
			if (!answer.ok) {
				onNotify(failureText(lang, answer));
				if (answer.detail !== undefined) onNotify(answer.detail);
				return;
			}
			setPlan(null);
			onNotify(say("changes.wrote"));
			await load();
			onChanged();
		} finally {
			setWriting(false);
		}
	};

	/** Prepares one job folder for the ticked periods. */
	const prepare = async () => {
		const chosen = targets.filter((target) => picked.has(targetKey(target)));
		if (chosen.length === 0) return;
		const answer = await window.studio.prepareUnitsJob(
			root,
			chosen.map((target) => ({
				grade: target.grade,
				subject: target.subject,
				period: target.period,
			})),
			tool,
		);
		if (!answer.ok) {
			onNotify(failureText(lang, answer));
			return;
		}
		setPrepared(answer);
		setPicked(new Set());
		onNotify(say("changes.jobReady", { n: answer.files }));
		await load();
	};

	const copyPrompt = async () => {
		if (prepared?.ok !== true) return;
		const answer = await window.studio.copyText(prepared.prompt);
		onNotify(answer.ok ? say("notes.copied") : failureText(lang, answer));
	};

	const collect = async (name: string) => {
		const answer = await window.studio.collectUnitsJob(root, name);
		if (!answer.ok) {
			onNotify(failureText(lang, answer));
			return;
		}
		setCollected(answer);
		onNotify(
			say("changes.collected", {
				n: answer.collected,
				skipped: answer.skipped,
			}),
		);
		await load();
	};

	const removeJob = async (name: string) => {
		await window.studio.deleteUnitsJob(root, name);
		await load();
	};

	/** Accepts a whole set, one unit or one lesson, through the main process. */
	const accept = async (set: ChangeReview, unit?: number, lesson?: number) => {
		const answer = await window.studio.acceptChanges(
			root,
			set.grade,
			set.subject,
			set.period,
			unit,
			lesson,
		);
		if (!answer.ok) {
			onNotify(failureText(lang, answer));
			return;
		}
		onNotify(say("toast.saved"));
		await load();
		onChanged();
	};

	const reject = async (set: ChangeReview) => {
		const answer = await window.studio.rejectChanges(
			root,
			set.grade,
			set.subject,
			set.period,
		);
		onNotify(answer.ok ? say("toast.saved") : failureText(lang, answer));
		await load();
	};

	const deleteSet = async (set: ChangeReview) => {
		const answer = await window.studio.deleteChanges(
			root,
			set.grade,
			set.subject,
			set.period,
		);
		onNotify(answer.ok ? say("toast.deleted") : failureText(lang, answer));
		await load();
	};

	const pickedCount = useMemo(
		() => targets.filter((target) => picked.has(targetKey(target))).length,
		[picked, targets],
	);

	if (state === null)
		return (
			<p className={error === "" ? "muted" : "issues"}>
				{error === "" ? say("curriculum.loading") : error}
			</p>
		);
	if (!state.ok) return <p className="issues">{failureText(lang, state)}</p>;
	if (targets.length === 0)
		return <p className="muted">{say("curriculum.empty")}</p>;

	return (
		<div className="notes">
			<header className="new-head">
				<div>
					<h2>{say("changes.title")}</h2>
					<p className="muted">{say("changes.intro")}</p>
				</div>
			</header>

			<section className="notes-settings">
				<h3>{say("changes.settings")}</h3>
				<div className="notes-row">
					<label className="field">
						<span className="field-label">{say("changes.model")}</span>
						<input
							type="text"
							value={modelInput}
							onChange={(event) => setModelInput(event.target.value)}
							dir="ltr"
						/>
					</label>
					<label className="field">
						<span className="field-label">{say("changes.limit")}</span>
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
						{say("changes.saveSettings")}
					</button>
				</div>
				<p className="muted">
					{keySet ? say("notes.keySet") : say("notes.keyMissing")}
				</p>
			</section>

			<section>
				<h3>{say("changes.targets")}</h3>
				<WindowedList
					count={targets.length}
					rowHeight={44}
					className="targets-list"
					itemClassName="targets-item"
					listRole="list"
					ariaLabel={say("changes.targets")}
				>
					{(index) => {
						const target = targets[index];
						if (target === undefined) return null;
						const key = targetKey(target);
						return (
							<li className="changes-target">
								<label className="check">
									<input
										type="checkbox"
										checked={picked.has(key)}
										onChange={() => toggle(target)}
									/>
									<span dir="auto">
										{gradeLabel(lang, target.grade)} ·{" "}
										{subjectName(target.subject, lang)} ·{" "}
										{periodName(project.periods, target.period, lang)}
									</span>
								</label>
								<span className="muted">
									{say("changes.targetLine", {
										units: target.units,
										lessons: target.lessons,
										files: target.files,
										notes: target.notes,
									})}
								</span>
								{target.pending && (
									<span className="chip">{say("changes.pending")}</span>
								)}
								<button
									type="button"
									className="btn btn-quiet"
									disabled={target.notes === 0}
									onClick={() => void priceIt(target)}
								>
									{say("changes.write")}
								</button>
							</li>
						);
					}}
				</WindowedList>
				{plan?.view.ok === true && (
					<div className="notes-actions">
						<p className="muted">
							{gradeLabel(lang, plan.target.grade)} ·{" "}
							{subjectName(plan.target.subject, lang)} ·{" "}
							{periodName(project.periods, plan.target.period, lang)}
						</p>
						<p className="muted">
							{plan.view.plan.estimateUsd === null
								? say("changes.noPrice")
								: say("changes.plan", {
										units: plan.view.plan.units,
										notes: plan.view.plan.notes,
										cost: `$${plan.view.plan.estimateUsd.toFixed(4)}`,
										model: plan.view.plan.model,
									})}
						</p>
						<div className="notes-row">
							<button
								type="button"
								className="btn"
								disabled={!keySet || writing}
								onClick={() => void writeIt()}
							>
								{writing ? say("changes.writing") : say("changes.confirmWrite")}
							</button>
							{!keySet && (
								<span className="muted">{say("changes.noKeyHint")}</span>
							)}
							<button
								type="button"
								className="btn btn-quiet"
								onClick={() => setPlan(null)}
							>
								{say("common.cancel")}
							</button>
						</div>
					</div>
				)}
				<p className="muted">{say("changes.pickHint")}</p>
			</section>

			<section className="notes-job">
				<h3>{say("changes.jobTitle")}</h3>
				<p className="muted">{say("changes.jobIntro")}</p>
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
						disabled={pickedCount === 0}
						onClick={() => void prepare()}
					>
						{say("changes.prepare")}
					</button>
				</div>
				{prepared?.ok === true && (
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

				<h3>{say("changes.jobs")}</h3>
				{jobs.length === 0 ? (
					<p className="muted">{say("changes.jobsNone")}</p>
				) : (
					<WindowedList
						count={jobs.length}
						rowHeight={36}
						className="jobs-list"
						itemClassName="jobs-item"
						listRole="list"
						ariaLabel={say("changes.jobs")}
					>
						{(index) => {
							const job = jobs[index];
							if (job === undefined) return null;
							return (
								<li className="job-row">
									<span dir="ltr">{job.name}</span>
									<span className="muted">
										{" "}
										{say("changes.jobLine", {
											created: job.created,
											tool: say(`notes.tool.${job.tool}` as TextKey),
											n: job.files,
										})}
									</span>
									<button
										type="button"
										className="btn btn-quiet"
										onClick={() => void collect(job.name)}
									>
										{say("changes.collect")}
									</button>
									<button
										type="button"
										className="btn btn-quiet btn-danger"
										onClick={() => void removeJob(job.name)}
									>
										{say("notes.deleteJob")}
									</button>
								</li>
							);
						}}
					</WindowedList>
				)}
				{collected?.ok === true && (
					<div>
						<p className="muted">
							{say("changes.collected", {
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

			<section>
				<h3>{say("changes.review")}</h3>
				{sets.length === 0 ? (
					<p className="muted">{say("changes.none")}</p>
				) : (
					sets.map((set) => (
						<section key={set.key} className="notes-actions">
							<header className="new-head">
								<div>
									<h3 dir="auto">
										{gradeLabel(lang, set.grade)} ·{" "}
										{subjectName(set.subject, lang)} ·{" "}
										{periodName(project.periods, set.period, lang)}
									</h3>
									<p className="muted">
										{say(
											set.source === "job"
												? "changes.from.job"
												: "changes.from.key",
										)}{" "}
										· {set.at} · {set.model}
									</p>
								</div>
								<div className="notes-row">
									<button
										type="button"
										className="btn"
										onClick={() => void accept(set)}
									>
										{say("changes.acceptAll")}
									</button>
									<button
										type="button"
										className="btn btn-quiet btn-danger"
										onClick={() => void reject(set)}
									>
										{say("changes.reject")}
									</button>
								</div>
							</header>
							{set.units.map((review) => (
								<UnitPair
									key={review.number}
									review={review}
									reviewSet={set}
									paths={paths}
									say={say}
									onAccept={(unit, lesson) => void accept(set, unit, lesson)}
								/>
							))}
							<SetNotes set={set} say={say} />
						</section>
					))
				)}
			</section>

			{rejected.length > 0 && (
				<section>
					<h3>{say("changes.rejected")}</h3>
					<WindowedList
						count={rejected.length}
						rowHeight={36}
						className="jobs-list"
						itemClassName="jobs-item"
						listRole="list"
						ariaLabel={say("changes.rejected")}
					>
						{(index) => {
							const set = rejected[index];
							if (set === undefined) return null;
							return (
								<li className="job-row">
									<span dir="auto">
										{gradeLabel(lang, set.grade)} ·{" "}
										{subjectName(set.subject, lang)} ·{" "}
										{periodName(project.periods, set.period, lang)}
									</span>
									<span className="muted">
										{say("changes.rejectedLine", {
											at: set.at,
											model: set.model,
										})}
									</span>
									<button
										type="button"
										className="btn btn-quiet btn-danger"
										onClick={() => void deleteSet(set)}
									>
										{say("changes.deleteSet")}
									</button>
								</li>
							);
						}}
					</WindowedList>
				</section>
			)}
		</div>
	);
}
