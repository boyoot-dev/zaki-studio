// The Curriculum tab (task 153): grades → subjects → units (with their period) → lessons,
// with each lesson's skills and then its facts in order. Every fact shows the files and pages
// it came from; a click opens that file at that page beside the facts, a PDF on its own page
// and anything else with the page's text under it. Read only in this task: the author edits
// in the app, never here (docs/STUDIO.md).

import studioSubjects from "virtual:subjects";
import { useEffect, useState } from "react";
import type { BundlePeriod } from "../shared/format/bundle";
import { gradeLabel, type Lang } from "../shared/i18n";
import type { CurriculumModel, FileRow, ModelCourse } from "../shared/model";
import { fileLabel, parseSource } from "../shared/model";
import { failureText } from "./App";
import { useLang, useSay } from "./i18n";
import { Divider, usePanes } from "./Panes";
import { Viewer } from "./Viewer";

/** The model and the register, or why they couldn't be read. */
type Loaded =
	| { kind: "loading" }
	| { kind: "ready"; model: CurriculumModel; files: FileRow[] }
	| { kind: "failed"; text: string };

/** One fact's page, open beside the facts. */
type Source = {
	row: FileRow;
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

/** The chip a source shows: the register's file name and the page, or the source itself. */
function sourceLabel(source: string, files: readonly FileRow[]): string {
	const parsed = parseSource(source);
	const row =
		parsed === null ? undefined : files.find((entry) => entry.id === parsed.id);
	if (row === undefined || parsed === null) return source;
	return [fileLabel(row.path), pageLabel(parsed.from, parsed.to)]
		.filter((part) => part !== "")
		.join(" · ");
}

/** The extension of a file, lowercase and without the dot. */
function extensionOf(path: string): string {
	const name = path.split("/").pop() ?? path;
	const cut = name.lastIndexOf(".");
	return cut < 0 ? "" : name.slice(cut + 1).toLowerCase();
}

export function Curriculum({
	root,
	project,
	onNotify,
}: {
	root: string;
	project: { periods: BundlePeriod[] };
	onNotify: (text: string) => void;
}) {
	const say = useSay();
	const lang = useLang();
	const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
	const [chosen, setChosen] = useState<string | null>(null);
	const [source, setSource] = useState<Source | null>(null);
	const panes = usePanes("curriculum");

	useEffect(() => {
		let alive = true;
		setLoaded({ kind: "loading" });
		void window.studio.readModel(root).then((result) => {
			if (!alive) return;
			setLoaded(
				result.ok
					? { kind: "ready", model: result.model, files: result.files }
					: { kind: "failed", text: failureText(lang, result) },
			);
		});
		return () => {
			alive = false;
		};
	}, [root, lang]);

	if (loaded.kind === "loading")
		return <p className="muted curriculum-note">{say("curriculum.loading")}</p>;
	if (loaded.kind === "failed") return <p className="issues">{loaded.text}</p>;
	const { model, files } = loaded;
	if (model.courses.length === 0)
		return <p className="muted curriculum-note">{say("curriculum.empty")}</p>;

	const course =
		model.courses.find((entry) => intent(entry) === chosen) ?? model.courses[0];
	if (course === undefined) return null;

	/** Opens the file a source names, at its page. */
	const openSource = async (target: string) => {
		const parsed = parseSource(target);
		if (parsed === null) {
			onNotify(say("curriculum.fileMissing"));
			return;
		}
		const row = files.find((entry) => entry.id === parsed.id);
		if (row === undefined) {
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
			row,
			page,
			last: parsed.to,
			text: read.ok ? read.text : "",
			label: [fileLabel(row.path), pageLabel(page, parsed.to)]
				.filter((part) => part !== "")
				.join(" · "),
		});
	};

	const grades = new Map<number, ModelCourse[]>();
	for (const entry of model.courses) {
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
					.map(([grade, courses]) => (
						<section key={grade}>
							<h2>{gradeLabel(lang, grade)}</h2>
							<ul>
								{courses.map((entry) => (
									<li key={intent(entry)}>
										<button
											type="button"
											className={
												intent(entry) === intent(course)
													? "chip chip-on curriculum-subject"
													: "chip curriculum-subject"
											}
											onClick={() => {
												setChosen(intent(entry));
												setSource(null);
											}}
										>
											{subjectName(entry.subject, lang)}
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
					<h2>{subjectName(course.subject, lang)}</h2>
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
					{gradeLabel(lang, course.grade)} ·{" "}
					{say("curriculum.lessonCount", {
						n: course.units.reduce(
							(total, unit) => total + unit.lessons.length,
							0,
						),
					})}
				</p>

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
							{course.exams.map((exam) => (
								<li key={`${exam.period ?? "year"}-${exam.name}`} dir="auto">
									{exam.name}
									<span className="muted">
										{" — "}
										{exam.papers.map((paper) => paper.name).join("، ")}
									</span>
								</li>
							))}
						</ul>
					</section>
				)}

				<h3 className="units-head">{say("curriculum.units")}</h3>
				<ol className="units">
					{course.units.map((unit) => (
						<li key={unit.number} className="unit">
							<h3 dir="auto">
								{unit.number}. {unit.title}
							</h3>
							<p className="muted">
								{say("curriculum.period")}:{" "}
								{periodName(project.periods, unit.period, lang) || unit.period}
							</p>
							<ol className="lessons">
								{unit.lessons.map((lesson) => (
									<li key={lesson.number} className="lesson">
										<h4 dir="auto">
											{lesson.number}. {lesson.title}
										</h4>
										<div className="lesson-part">
											<h5>{say("curriculum.skills")}</h5>
											<ul className="skills">
												{lesson.skills.map((skill) => (
													<li
														key={`${skill.code ?? "skill"}-${skill.text}`}
														dir="auto"
													>
														{skill.code !== null && (
															<span className="code">{skill.code}</span>
														)}
														{skill.text}
													</li>
												))}
											</ul>
										</div>
										<div className="lesson-part">
											<h5>{say("curriculum.facts")}</h5>
											{lesson.facts.length === 0 ? (
												<p className="muted">{say("curriculum.noFacts")}</p>
											) : (
												<ol className="facts">
													{lesson.facts.map((fact) => (
														<li key={fact.text}>
															<p className="fact" dir="auto">
																{fact.text}
															</p>
															{fact.sources.length > 0 && (
																<div className="chips">
																	{fact.sources.map((sourceId) => (
																		<button
																			key={sourceId}
																			type="button"
																			className="chip source-chip"
																			title={say("curriculum.source")}
																			onClick={() => void openSource(sourceId)}
																		>
																			{sourceLabel(sourceId, files)}
																		</button>
																	))}
																</div>
															)}
														</li>
													))}
												</ol>
											)}
										</div>
									</li>
								))}
							</ol>
						</li>
					))}
				</ol>
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
								key={`${source.row.id}-${source.page ?? 0}`}
								root={root}
								node={{
									name: fileLabel(source.row.path),
									rel: source.row.path,
									kind: "file",
									size: 0,
									ext: extensionOf(source.row.path),
									children: [],
								}}
								onNotify={onNotify}
								startPage={source.page ?? 1}
								subtitle={source.label}
								pageText={
									extensionOf(source.row.path) === "pdf" || source.page === null
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

/** The key a course is chosen by: its grade and subject. */
function intent(course: ModelCourse): string {
	return `${course.grade}|${course.subject}`;
}
