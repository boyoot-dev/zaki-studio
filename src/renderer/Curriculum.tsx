// The Curriculum tab (task 153): grades → subjects → units (with their period) → lessons,
// with each lesson's skills and then its facts in order. Every fact shows the files and pages
// it came from; a click opens that file at that page beside the facts, a PDF on its own page
// and anything else with the page's text under it. Since task 247 the author edits here too:
// every unit, lesson, skill and fact has a pencil and a small menu, "+ Add …" lines add one,
// and Undo takes back the last 20 edits of the session; a fact the author writes is theirs and
// the AI never changes it. The nav loads the courses' heads, and one course in full when the
// author picks it (task 168) — never the whole school in one go.

import studioSubjects from "virtual:subjects";
import { useEffect, useState } from "react";
import type { CourseHead, CourseOpen, ModelOverview } from "../shared/api.ts";
import type { Edit } from "../shared/edit.ts";
import { examNumberWarnings } from "../shared/exam-numbers.ts";
import type { BundlePeriod } from "../shared/format/bundle.ts";
import { gradeLabel, type Lang, type TextKey } from "../shared/i18n";
import { languageName } from "../shared/languages.ts";
import type { ModelCourse, ModelCurriculum } from "../shared/model.ts";
import {
	exportableLesson,
	exportableUnit,
	fileLabel,
	parseSource,
} from "../shared/model.ts";
import type { Project } from "../shared/project.ts";
import { termLabel, unitLeaves } from "../shared/terms.ts";
import { failureText } from "./App";
import type { BookTarget } from "./Book";
import { CourseLanguages } from "./CourseLanguages";
import { AddLine, EditableText, ItemMenu } from "./Edit";
import { useLang, useSay } from "./i18n";
import { Divider, usePanes } from "./Panes";
import { Viewer } from "./Viewer";

/** The model's header and its courses' heads, or why they couldn't be read. */
type Loaded =
	| { kind: "loading" }
	| {
			kind: "ready";
			curriculum: ModelCurriculum;
			courses: CourseHead[];
	  }
	| { kind: "failed"; text: string };

/** One fact's page, open beside the facts. */
type Source = {
	/** The file's path and size, from the register (the page knows no other name for it). */
	path: string;
	page: number | null;
	last: number | null;
	/** The page's text, kept for files that are not a PDF. */
	text: string;
	label: string;
};

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
	return "";
}

/** "p.7" or "p.12–13": the page a source names, or "" when it names the file only. */
function pageLabel(page: number | null, last: number | null): string {
	if (page === null) return "";
	if (last !== null && last !== page) return `p.${page}–${last}`;
	return `p.${page}`;
}

/** The chip a source shows: the file's name and the page, or the source itself. */
function sourceLabel(
	source: string,
	paths: Record<string, { path: string; size: number }>,
): string {
	const parsed = parseSource(source);
	const known = parsed === null ? undefined : paths[parsed.id];
	if (parsed === null || known === undefined) return source;
	return [fileLabel(known.path), pageLabel(parsed.from, parsed.to)]
		.filter((part) => part !== "")
		.join(" · ");
}

/** The extension of a file, lowercase and without the dot. */
function extensionOf(path: string): string {
	const name = path.split("/").pop() ?? path;
	const cut = name.lastIndexOf(".");
	return cut < 0 ? "" : name.slice(cut + 1).toLowerCase();
}

/** The ids of the files this course's facts name, for the chips' paths. */
function sourceIds(course: ModelCourse): string[] {
	const ids = new Set<string>();
	for (const unit of course.units) {
		for (const lesson of unit.lessons) {
			for (const fact of lesson.facts) {
				for (const source of fact.sources) {
					const parsed = parseSource(source);
					if (parsed !== null) ids.add(parsed.id);
				}
			}
		}
	}
	return [...ids].slice(0, 1500);
}

/** The key a course is chosen by: its grade, subject and teaching language (task 224). */
function courseKey(course: {
	grade: number;
	subject: string;
	language?: string;
}): string {
	return `${course.grade}|${course.subject}|${course.language ?? ""}`;
}

export function Curriculum({
	root,
	project,
	onNotify,
	reloadKey,
	openCourse,
	onChanged,
	onBuild,
}: {
	root: string;
	project: Project;
	/** Opens "Build from my book" for a course (task 246). */
	onBuild: (course: BookTarget) => void;
	onNotify: (text: string) => void;
	/** Called after the author changed a course's languages, so the project is read again. */
	onChanged: () => void;
	/** Bumped when the project changed (accepted changes, a scan): the tab stays open now. */
	reloadKey: number;
	/** A course the export's exam warning line asked for; `key` bumps on every click. */
	openCourse?: {
		grade: number;
		subject: string;
		language: string;
		key: number;
	} | null;
}) {
	const say = useSay();
	const lang = useLang();
	const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
	const [chosen, setChosen] = useState<string | null>(null);
	const [course, setCourse] = useState<ModelCourse | null>(null);
	const [courseFailed, setCourseFailed] = useState("");
	const [source, setSource] = useState<Source | null>(null);
	const [paths, setPaths] = useState<
		Record<string, { path: string; size: number }>
	>({});
	const panes = usePanes("curriculum");
	// How many edits of this session can be undone, and the period a new unit goes in.
	const [undoable, setUndoable] = useState(0);
	const [newUnitPeriod, setNewUnitPeriod] = useState("");
	const unitPeriods = unitLeaves(project.periods).map((period) => ({
		id: period.id,
		name: termLabel(period.id, project.periods, lang) ?? period.id,
	}));

	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is the trigger — the project changed while this tab stayed open.
	useEffect(() => {
		let alive = true;
		// A reload keeps the current view until the new one arrives, so nothing flashes.
		setLoaded((current) =>
			current.kind === "ready" ? current : { kind: "loading" },
		);
		void window.studio.readModel(root).then((result: ModelOverview) => {
			if (!alive) return;
			setLoaded(
				result.ok
					? {
							kind: "ready",
							curriculum: result.curriculum,
							courses: result.courses,
						}
					: { kind: "failed", text: failureText(lang, result) },
			);
		});
		return () => {
			alive = false;
		};
	}, [root, lang, reloadKey]);

	const courses = loaded.kind === "ready" ? loaded.courses : [];
	const chosenCourse =
		courses.find((entry) => courseKey(entry) === chosen) ?? courses[0] ?? null;

	// The languages this subject already has in this grade, as the project has them: the nav
	// lists the model, which has not got a course added only to the project yet (task 228).
	const projectLanguages =
		chosenCourse === null
			? []
			: (project.grades
					.find((entry) => entry.grade === chosenCourse.grade)
					?.subjects.filter((entry) => entry.subject === chosenCourse.subject)
					.map((entry) => entry.language) ?? []);

	// The export's link to a course: choose it when the link is used, even if it was chosen before.
	useEffect(() => {
		if (openCourse === null || openCourse === undefined) return;
		setChosen(courseKey(openCourse));
	}, [openCourse]);

	// The chosen course in full, read when it changes; kept per course for this session.
	useEffect(() => {
		if (loaded.kind !== "ready") return;
		const head =
			loaded.courses.find((entry) => courseKey(entry) === chosen) ??
			loaded.courses[0];
		if (head === undefined) return;
		let alive = true;
		setCourse(null);
		setCourseFailed("");
		void (async () => {
			const result: CourseOpen = await window.studio.course(
				root,
				head.grade,
				head.subject,
				head.language,
			);
			if (!alive) return;
			if (!result.ok) {
				setCourseFailed(failureText(lang, result));
				return;
			}
			setCourse(result.course);
			// The paths of the files its facts name, for the chips.
			const ids = sourceIds(result.course);
			if (ids.length > 0) {
				const found = await window.studio.filePaths(root, ids);
				if (alive && found.ok)
					setPaths((current) => ({ ...current, ...found.paths }));
			}
		})();
		return () => {
			alive = false;
		};
	}, [root, lang, loaded, chosen]);

	if (loaded.kind === "loading")
		return <p className="muted curriculum-note">{say("curriculum.loading")}</p>;
	if (loaded.kind === "failed") return <p className="issues">{loaded.text}</p>;
	if (courses.length === 0 || chosenCourse === null)
		return <p className="muted curriculum-note">{say("curriculum.empty")}</p>;

	/** Sends one hand edit for the chosen course; true when it was made (task 247). */
	const run = async (change: Edit): Promise<boolean> => {
		const reply = await window.studio.editCourse(
			root,
			chosenCourse.grade,
			chosenCourse.subject,
			chosenCourse.language,
			change,
		);
		if (!reply.ok) {
			onNotify(failureText(lang, reply));
			return false;
		}
		setUndoable(reply.undo);
		if (!reply.done || reply.course === null) {
			onNotify(reply.issue);
			return false;
		}
		setCourse(reply.course);
		return true;
	};

	/** Takes back the last hand edit of this session. */
	const undo = async () => {
		const reply = await window.studio.undoEdit(root);
		if (!reply.ok) {
			onNotify(failureText(lang, reply));
			return;
		}
		setUndoable(reply.undo);
		if (!reply.done) {
			onNotify(reply.issue);
			return;
		}
		// The undone edit may belong to another course: read the chosen one again.
		const again = await window.studio.course(
			root,
			chosenCourse.grade,
			chosenCourse.subject,
			chosenCourse.language,
		);
		if (again.ok) setCourse(again.course);
		onNotify(say("edit.undone"));
	};

	/** Opens the file a source names, at its page. */
	const openSource = async (target: string) => {
		const parsed = parseSource(target);
		if (parsed === null) {
			onNotify(say("curriculum.fileMissing"));
			return;
		}
		const known = paths[parsed.id];
		if (known === undefined) {
			onNotify(say("curriculum.fileMissing"));
			return;
		}
		const page = parsed.from;
		const read =
			page === null
				? { ok: true as const, text: "" }
				: await window.studio.readPageText(root, parsed.id, page);
		// A page opened while the source viewer is away brings it back.
		if (panes.collapsed) panes.toggleSource();
		setSource({
			path: known.path,
			page,
			last: parsed.to,
			text: read.ok ? read.text : "",
			label: [fileLabel(known.path), pageLabel(page, parsed.to)]
				.filter((part) => part !== "")
				.join(" · "),
		});
	};

	const grades = new Map<number, CourseHead[]>();
	for (const entry of courses) {
		const list = grades.get(entry.grade) ?? [];
		list.push(entry);
		grades.set(entry.grade, list);
	}

	return (
		<div className="curriculum" ref={panes.row} style={panes.style}>
			<nav
				className="curriculum-nav"
				aria-label={say("project.tab.curriculum")}
			>
				{[...grades.entries()]
					.sort(([a], [b]) => a - b)
					.map(([grade, coursesHere]) => (
						<section key={grade}>
							<h2>{gradeLabel(lang, grade)}</h2>
							<ul>
								{coursesHere.map((entry) => (
									<li key={courseKey(entry)}>
										<button
											type="button"
											className={
												courseKey(entry) === courseKey(chosenCourse)
													? "chip chip-on curriculum-subject"
													: "chip curriculum-subject"
											}
											onClick={() => {
												setChosen(courseKey(entry));
												setSource(null);
											}}
										>
											{subjectName(entry.subject, lang)}
											{coursesHere.filter(
												(other) => other.subject === entry.subject,
											).length > 1 &&
												` · ${languageName(entry.language, lang)}`}
										</button>
									</li>
								))}
							</ul>
						</section>
					))}
			</nav>

			<Divider spec={panes.divider(0)} />

			<article className="course">
				<div className="course-head">
					<h2>
						{subjectName(chosenCourse.subject, lang)} ·{" "}
						{languageName(chosenCourse.language, lang)}
					</h2>
					<button
						type="button"
						className="btn"
						onClick={() =>
							onBuild({
								grade: chosenCourse.grade,
								subject: chosenCourse.subject,
								language: chosenCourse.language,
								label: `${subjectName(chosenCourse.subject, lang)} · ${languageName(chosenCourse.language, lang)}`,
								hasUnits: (course?.units.length ?? 0) > 0,
							})
						}
					>
						{(course?.units.length ?? 0) > 0
							? say("book.update")
							: say("book.build")}
					</button>
					{undoable > 0 && (
						<button
							type="button"
							className="btn btn-quiet"
							onClick={() => void undo()}
						>
							{say("edit.undo")}
						</button>
					)}
					<button
						type="button"
						className="btn btn-quiet"
						aria-expanded={!panes.collapsed}
						onClick={panes.toggleSource}
					>
						{panes.collapsed
							? say("curriculum.showSource")
							: say("curriculum.hideSource")}
					</button>
				</div>
				<p className="muted">
					{gradeLabel(lang, chosenCourse.grade)} ·{" "}
					{say("curriculum.lessonCount", {
						n: course
							? course.units.reduce(
									(total, unit) => total + unit.lessons.length,
									0,
								)
							: 0,
					})}
				</p>

				<CourseLanguages
					root={root}
					course={chosenCourse}
					courses={courses}
					projectLanguages={projectLanguages}
					subjectName={subjectName(chosenCourse.subject, lang)}
					onChanged={onChanged}
					onNotify={onNotify}
				/>

				{course === null && courseFailed === "" && (
					<p className="muted curriculum-note">{say("curriculum.loading")}</p>
				)}
				{courseFailed !== "" && <p className="issues">{courseFailed}</p>}

				{course !== null && (
					<>
						{course.examStyle !== null && (
							<section className="course-exams">
								<h3>{say("curriculum.examStyle")}</h3>
								<p className="prose" dir="auto">
									{course.examStyle}
								</p>
							</section>
						)}
						{course.exams.length > 0 && (
							<section className="course-exams">
								<h3>{say("curriculum.exams")}</h3>
								<ul>
									{course.exams.map((exam) => {
										const warnings = examNumberWarnings(exam);
										return (
											<li
												key={`${exam.period ?? "year"}-${exam.name}`}
												dir="auto"
											>
												{exam.name}
												<span className="muted">
													{" — "}
													{exam.papers.map((paper) => paper.name).join("، ")}
												</span>
												{warnings.length > 0 && (
													<ul className="exam-warn">
														{warnings.map((warning) => (
															<li key={`${warning.path}-${warning.code}`}>
																<span dir="auto">
																	{say(
																		`examNumbers.${warning.code}` as TextKey,
																		warning.vars,
																	)}
																</span>
															</li>
														))}
													</ul>
												)}
											</li>
										);
									})}
								</ul>
							</section>
						)}

						<h3 className="units-head">{say("curriculum.units")}</h3>
						<ol className="units">
							{course.units.map((unit, unitIndex) => (
								<li key={unit.id} className="unit">
									<div className="item-row">
										<EditableText
											value={unit.title}
											onSave={(title) =>
												run({ kind: "unit.title", unit: unit.number, title })
											}
										>
											<h3 dir="auto">
												{unit.number}. {unit.title}
											</h3>
										</EditableText>
										<ItemMenu
											actions={[
												...(unitIndex > 0
													? [
															{
																label: say("edit.up"),
																run: () =>
																	void run({
																		kind: "unit.move",
																		unit: unit.number,
																		by: -1,
																	}),
															},
														]
													: []),
												...(unitIndex < course.units.length - 1
													? [
															{
																label: say("edit.down"),
																run: () =>
																	void run({
																		kind: "unit.move",
																		unit: unit.number,
																		by: 1,
																	}),
															},
														]
													: []),
												...unitPeriods
													.filter((period) => period.id !== unit.period)
													.map((period) => ({
														label: say("edit.toPeriod", {
															period: period.name,
														}),
														run: () =>
															void run({
																kind: "unit.period",
																unit: unit.number,
																period: period.id,
															}),
													})),
												{
													label: say("edit.delete"),
													danger: true,
													confirm: say("edit.confirmUnit"),
													run: () =>
														void run({
															kind: "unit.delete",
															unit: unit.number,
														}),
												},
											]}
										/>
									</div>
									<p className="muted">
										{say("curriculum.period")}:{" "}
										{periodName(project.periods, unit.period, lang) ||
											unit.period}
									</p>
									{!exportableUnit(unit) && (
										<p className="muted small">{say("edit.unitNotExported")}</p>
									)}
									<ol className="lessons">
										{unit.lessons.map((lesson, lessonIndex) => (
											<li key={lesson.id} className="lesson">
												<div className="item-row">
													<EditableText
														value={lesson.title}
														onSave={(title) =>
															run({
																kind: "lesson.title",
																unit: unit.number,
																lesson: lesson.number,
																title,
															})
														}
													>
														<h4 dir="auto">
															{lesson.number}. {lesson.title}
														</h4>
													</EditableText>
													<ItemMenu
														actions={[
															...(lessonIndex > 0
																? [
																		{
																			label: say("edit.up"),
																			run: () =>
																				void run({
																					kind: "lesson.move",
																					unit: unit.number,
																					lesson: lesson.number,
																					by: -1,
																				}),
																		},
																	]
																: []),
															...(lessonIndex < unit.lessons.length - 1
																? [
																		{
																			label: say("edit.down"),
																			run: () =>
																				void run({
																					kind: "lesson.move",
																					unit: unit.number,
																					lesson: lesson.number,
																					by: 1,
																				}),
																		},
																	]
																: []),
															...course.units
																.filter((other) => other.number !== unit.number)
																.map((other) => ({
																	label: say("edit.toUnit", {
																		n: other.number,
																	}),
																	run: () =>
																		void run({
																			kind: "lesson.toUnit",
																			unit: unit.number,
																			lesson: lesson.number,
																			to: other.number,
																		}),
																})),
															{
																label: say("edit.delete"),
																danger: true,
																confirm: say("edit.confirmLesson"),
																run: () =>
																	void run({
																		kind: "lesson.delete",
																		unit: unit.number,
																		lesson: lesson.number,
																	}),
															},
														]}
													/>
												</div>
												{!exportableLesson(lesson) && (
													<p className="muted small">
														{say("edit.lessonNotExported")}
													</p>
												)}
												<div className="lesson-part">
													<h5>{say("curriculum.skills")}</h5>
													<ul className="skills">
														{lesson.skills.map((skill, skillIndex) => (
															<li
																key={skill.id}
																className="item-row"
																dir="auto"
															>
																<EditableText
																	value={skill.text}
																	onSave={(text) =>
																		run({
																			kind: "skill.text",
																			unit: unit.number,
																			lesson: lesson.number,
																			skill: skillIndex,
																			text,
																		})
																	}
																>
																	{skill.code !== null && (
																		<span className="code">{skill.code}</span>
																	)}
																	{skill.text}
																</EditableText>
																<ItemMenu
																	actions={[
																		{
																			label: say("edit.delete"),
																			danger: true,
																			confirm: say("edit.confirmSkill"),
																			run: () =>
																				void run({
																					kind: "skill.delete",
																					unit: unit.number,
																					lesson: lesson.number,
																					skill: skillIndex,
																				}),
																		},
																	]}
																/>
															</li>
														))}
													</ul>
													<AddLine
														label={say("edit.addSkill")}
														onAdd={(text) =>
															run({
																kind: "skill.add",
																unit: unit.number,
																lesson: lesson.number,
																text,
															})
														}
													/>
												</div>
												<div className="lesson-part">
													<h5>{say("curriculum.facts")}</h5>
													{lesson.facts.length === 0 && (
														<p className="muted">{say("curriculum.noFacts")}</p>
													)}
													<ol className="facts">
														{lesson.facts.map((fact, factIndex) => (
															<li
																// biome-ignore lint/suspicious/noArrayIndexKey: facts have no id; their place is their identity here.
																key={factIndex}
																className="item-row"
															>
																<EditableText
																	value={fact.text}
																	multiline
																	onSave={(text) =>
																		run({
																			kind: "fact.text",
																			unit: unit.number,
																			lesson: lesson.number,
																			fact: factIndex,
																			text,
																		})
																	}
																>
																	<p className="fact" dir="auto">
																		{fact.text}
																		{fact.own && (
																			<span className="tag tag-quiet">
																				{say("edit.yours")}
																			</span>
																		)}
																	</p>
																	{fact.sources.length === 0 && !fact.own && (
																		<p className="muted small">
																			{say("curriculum.noPage")}
																		</p>
																	)}
																	{fact.sources.length > 0 && (
																		<div className="chips">
																			{fact.sources.map((sourceId) => (
																				<button
																					key={sourceId}
																					type="button"
																					className="chip source-chip"
																					title={say("curriculum.source")}
																					onClick={() =>
																						void openSource(sourceId)
																					}
																				>
																					{sourceLabel(sourceId, paths)}
																				</button>
																			))}
																		</div>
																	)}
																</EditableText>
																<ItemMenu
																	actions={[
																		...(factIndex > 0
																			? [
																					{
																						label: say("edit.up"),
																						run: () =>
																							void run({
																								kind: "fact.move",
																								unit: unit.number,
																								lesson: lesson.number,
																								fact: factIndex,
																								by: -1,
																							}),
																					},
																				]
																			: []),
																		...(factIndex < lesson.facts.length - 1
																			? [
																					{
																						label: say("edit.down"),
																						run: () =>
																							void run({
																								kind: "fact.move",
																								unit: unit.number,
																								lesson: lesson.number,
																								fact: factIndex,
																								by: 1,
																							}),
																					},
																				]
																			: []),
																		{
																			label: say("edit.delete"),
																			danger: true,
																			confirm: say("edit.confirmFact"),
																			run: () =>
																				void run({
																					kind: "fact.delete",
																					unit: unit.number,
																					lesson: lesson.number,
																					fact: factIndex,
																				}),
																		},
																	]}
																/>
															</li>
														))}
													</ol>
													<AddLine
														label={say("edit.addFact")}
														multiline
														onAdd={(text) =>
															run({
																kind: "fact.add",
																unit: unit.number,
																lesson: lesson.number,
																after: lesson.facts.length - 1,
																text,
															})
														}
													/>
												</div>
											</li>
										))}
									</ol>
									<AddLine
										label={say("edit.addLesson")}
										onAdd={(title) =>
											run({
												kind: "lesson.add",
												unit: unit.number,
												after: unit.lessons.length,
												title,
											})
										}
									/>
								</li>
							))}
						</ol>
						<AddLine
							label={say("edit.addUnit")}
							extra={
								unitPeriods.length > 1 ? (
									<label className="field">
										<span className="field-label">
											{say("edit.newUnitPeriod")}
										</span>
										<select
											value={newUnitPeriod || unitPeriods[0]?.id}
											onChange={(event) => setNewUnitPeriod(event.target.value)}
										>
											{unitPeriods.map((period) => (
												<option key={period.id} value={period.id}>
													{period.name}
												</option>
											))}
										</select>
									</label>
								) : undefined
							}
							onAdd={(title) =>
								run({
									kind: "unit.add",
									period: newUnitPeriod || (unitPeriods[0]?.id ?? ""),
									title,
								})
							}
						/>
					</>
				)}
			</article>

			{!panes.collapsed && (
				<>
					<Divider spec={panes.divider(1)} />
					<aside className="source-panel">
						<header className="source-head">
							<div>
								<h3>{say("curriculum.source")}</h3>
								{source !== null && (
									<p className="muted" dir="auto">
										{source.label}
									</p>
								)}
							</div>
							{source !== null && (
								<button
									type="button"
									className="btn btn-quiet"
									onClick={() => setSource(null)}
								>
									{say("common.close")}
								</button>
							)}
						</header>
						{source === null ? (
							<p className="muted">{say("curriculum.pickFact")}</p>
						) : (
							<Viewer
								key={`${source.path}-${source.page ?? 0}`}
								root={root}
								node={{
									name: fileLabel(source.path),
									rel: source.path,
									kind: "file",
									size: 0,
									ext: extensionOf(source.path),
									children: [],
									files: 0,
								}}
								onNotify={onNotify}
								startPage={source.page ?? 1}
								subtitle={source.label}
								pageText={
									extensionOf(source.path) === "pdf" || source.page === null
										? undefined
										: source.text
								}
							/>
						)}
					</aside>
				</>
			)}
		</div>
	);
}
