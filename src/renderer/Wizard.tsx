// The "New curriculum" wizard: three short steps and a look at the folders before anything
// is written. It also makes a project out of a folder that already holds material, prefilled
// with the grades and subjects its folder names show. Every answer is checked with the
// bundle's own text rules before the project is built (src/shared/project.ts).

import { useState } from "react";
import type { GuessFolder, ProjectOpen } from "../shared/api";
import {
	BUNDLE_LIMITS,
	type BundlePeriod,
	checkText,
} from "../shared/format/bundle";
import { GRADE_MAX, GRADE_MIN } from "../shared/format/grades";
import { gradeLabel, type Lang } from "../shared/i18n";
import { languageChoices } from "../shared/languages.ts";
import {
	guessGrades,
	PERIOD_PRESETS,
	type PeriodPreset,
	type ProjectIssue,
	presetPeriods,
	projectFolders,
	wizardProject,
} from "../shared/project";
import type { StudioSubject } from "../shared/subjects";
import { LanguageSwitch } from "./Chrome";
import { useSay } from "./i18n";

/** Every grade the Studio offers, youngest first. */
const GRADES = Array.from(
	{ length: GRADE_MAX - GRADE_MIN + 1 },
	(_, index) => GRADE_MIN + index,
);

/** The name a folder already has, as the first suggestion for the project's name. */
function nameFromRoot(root: string): string {
	const parts = root.split(/[\\/]+/).filter((part) => part !== "");
	return parts[parts.length - 1] ?? "";
}

/** Renames one period, at either level, and leaves the rest as they are. */
function renamePeriod(
	list: BundlePeriod[],
	id: string,
	key: "nameEn" | "nameAr",
	value: string,
): BundlePeriod[] {
	return list.map((period) =>
		period.id === id
			? { ...period, [key]: value }
			: { ...period, periods: renamePeriod(period.periods, id, key, value) },
	);
}

export function Wizard({
	root,
	guess,
	lang,
	onLanguage,
	onCancel,
	onCreated,
	subjects,
}: {
	root: string;
	guess: GuessFolder[];
	lang: Lang;
	onLanguage: (lang: Lang) => void;
	onCancel: () => void;
	onCreated: (opened: ProjectOpen) => void;
	subjects: StudioSubject[];
}) {
	const say = useSay();
	const [step, setStep] = useState(1);
	const [nameEn, setNameEn] = useState(nameFromRoot(root));
	const [nameAr, setNameAr] = useState("");
	const [author, setAuthor] = useState("");
	const [rights, setRights] = useState("");
	const [grades, setGrades] = useState(() => guessGrades(guess, subjects));
	const [preset, setPreset] = useState<PeriodPreset>("terms-blocks");
	const [periods, setPeriods] = useState<BundlePeriod[]>(() =>
		presetPeriods("terms-blocks"),
	);
	const [withFinalExam, setWithFinalExam] = useState(true);
	// The language most courses are taught in (task 225); language subjects keep their own.
	const [mainLanguage, setMainLanguage] = useState("en");
	const [busy, setBusy] = useState(false);
	const [id] = useState(() => crypto.randomUUID());

	const answers = {
		nameEn,
		nameAr,
		author,
		rights,
		grades,
		periods,
		finalExam: withFinalExam,
		language: mainLanguage,
	};
	const made = wizardProject(answers, subjects, id);
	const issues = made.ok ? [] : made.issues;

	/** The issues that belong to a step, so each step says only what it can fix. */
	const issuesOf = (stepNumber: number): ProjectIssue[] =>
		issues.filter((issue) => {
			if (stepNumber === 1)
				return ["nameEn", "nameAr", "author", "rights", "id"].some((key) =>
					issue.path.startsWith(key),
				);
			if (stepNumber === 2) return issue.path.startsWith("grades");
			return true;
		});

	const stepIssues = issuesOf(step);

	/** True when this field is one of the step's problems, so the field shows it. */
	const badField = (key: string): boolean =>
		stepIssues.some((issue) => issue.path === key);

	/** What the step asks for, in one sentence, when something has to be fixed. */
	const fixLine =
		step === 1
			? say("wizard.name.fix")
			: step === 2
				? say("wizard.grades.fix")
				: say("wizard.year.fix");

	const toggleGrade = (grade: number) => {
		setGrades((current) =>
			current.some((entry) => entry.grade === grade)
				? current.filter((entry) => entry.grade !== grade)
				: [...current, { grade, subjects: [] }].sort(
						(a, b) => a.grade - b.grade,
					),
		);
	};

	const toggleSubject = (grade: number, subject: string) => {
		setGrades((current) =>
			current.map((entry) =>
				entry.grade !== grade
					? entry
					: {
							...entry,
							subjects: entry.subjects.includes(subject)
								? entry.subjects.filter((id) => id !== subject)
								: [...entry.subjects, subject],
						},
			),
		);
	};

	const choosePreset = (next: PeriodPreset) => {
		setPreset(next);
		setPeriods(presetPeriods(next));
	};

	const create = async () => {
		if (!made.ok) return;
		setBusy(true);
		try {
			onCreated(await window.studio.createProject(root, made.project));
		} finally {
			setBusy(false);
		}
	};

	const title =
		step === 1
			? say("wizard.name.title")
			: step === 2
				? say("wizard.grades.title")
				: say("wizard.year.title");

	return (
		<div className="wizard">
			<header className="wizard-head">
				<div>
					<p className="step-line">{say("wizard.step", { n: step })}</p>
					<h1>{title}</h1>
				</div>
				<LanguageSwitch lang={lang} onChange={onLanguage} />
			</header>

			<div className="dots" aria-hidden="true">
				{[1, 2, 3].map((n) => (
					<span key={n} className={n <= step ? "dot dot-on" : "dot"} />
				))}
			</div>

			<main className="wizard-body">
				{step === 1 && (
					<div className="form">
						<Field
							label={say("wizard.name.nameEn")}
							value={nameEn}
							onChange={setNameEn}
							invalid={badField("nameEn")}
							max={BUNDLE_LIMITS.nameEn}
						/>
						<Field
							label={say("wizard.name.nameAr")}
							value={nameAr}
							onChange={setNameAr}
							dir="rtl"
							invalid={badField("nameAr")}
							max={BUNDLE_LIMITS.nameAr}
						/>
						<Field
							label={say("wizard.name.author")}
							value={author}
							onChange={setAuthor}
							invalid={badField("author")}
							max={BUNDLE_LIMITS.author}
						/>
						<Field
							label={say("wizard.name.rights")}
							value={rights}
							onChange={setRights}
							hint={say("wizard.name.rightsHint")}
							invalid={badField("rights")}
							max={BUNDLE_LIMITS.rights}
						/>
					</div>
				)}

				{step === 2 && (
					<div>
						<p className="muted">{say("wizard.grades.hint")}</p>
						<label className="course-language">
							<span>{say("wizard.language")}</span>
							<select
								value={mainLanguage}
								onChange={(event) => setMainLanguage(event.target.value)}
							>
								{languageChoices(lang).map((choice) => (
									<option key={choice.code} value={choice.code}>
										{choice.name}
									</option>
								))}
							</select>
						</label>
						<p className="muted">{say("wizard.languageHint")}</p>
						<div className="chips grade-picks">
							{GRADES.map((grade) => {
								const on = grades.some((entry) => entry.grade === grade);
								return (
									<button
										key={grade}
										type="button"
										className={on ? "chip chip-on" : "chip"}
										aria-pressed={on}
										onClick={() => toggleGrade(grade)}
									>
										{gradeLabel(lang, grade)}
									</button>
								);
							})}
						</div>
						{grades.map((entry) => (
							<section className="grade-block" key={entry.grade}>
								<h2>
									{gradeLabel(lang, entry.grade)}
									<span className="muted count">
										{" · "}
										{say("wizard.grades.subjects", {
											n: entry.subjects.length,
										})}
									</span>
								</h2>
								<div className="subject-list">
									{subjects.map((subject) => (
										<label className="subject" key={subject.id}>
											<input
												type="checkbox"
												checked={entry.subjects.includes(subject.id)}
												onChange={() => toggleSubject(entry.grade, subject.id)}
											/>
											<span aria-hidden="true">{subject.icon}</span>
											<span>
												{lang === "ar" ? subject.nameAr : subject.nameEn}
											</span>
										</label>
									))}
								</div>
							</section>
						))}
					</div>
				)}

				{step === 3 && (
					<div>
						<p className="muted">{say("wizard.year.hint")}</p>
						<div className="chips">
							{PERIOD_PRESETS.map((option) => (
								<button
									key={option}
									type="button"
									className={option === preset ? "chip chip-on" : "chip"}
									aria-pressed={option === preset}
									onClick={() => choosePreset(option)}
								>
									{say(`wizard.preset.${option}`)}
								</button>
							))}
						</div>
						<div className="periods">
							{periods.map((period) => (
								<div className="period" key={period.id}>
									<Field
										label={say("wizard.period.nameEn")}
										value={period.nameEn}
										max={BUNDLE_LIMITS.periodName}
										onChange={(value) =>
											setPeriods((current) =>
												renamePeriod(current, period.id, "nameEn", value),
											)
										}
									/>
									<Field
										label={say("wizard.period.nameAr")}
										value={period.nameAr}
										max={BUNDLE_LIMITS.periodName}
										onChange={(value) =>
											setPeriods((current) =>
												renamePeriod(current, period.id, "nameAr", value),
											)
										}
										dir="rtl"
									/>
									{period.periods.length > 0 && (
										<div className="period-blocks">
											{period.periods.map((block) => (
												<div className="period" key={block.id}>
													<Field
														label={say("wizard.period.nameEn")}
														value={block.nameEn}
														max={BUNDLE_LIMITS.periodName}
														onChange={(value) =>
															setPeriods((current) =>
																renamePeriod(
																	current,
																	block.id,
																	"nameEn",
																	value,
																),
															)
														}
													/>
													<Field
														label={say("wizard.period.nameAr")}
														value={block.nameAr}
														max={BUNDLE_LIMITS.periodName}
														onChange={(value) =>
															setPeriods((current) =>
																renamePeriod(
																	current,
																	block.id,
																	"nameAr",
																	value,
																),
															)
														}
														dir="rtl"
													/>
												</div>
											))}
										</div>
									)}
								</div>
							))}
						</div>
						<label className="check">
							<input
								type="checkbox"
								checked={withFinalExam}
								onChange={(event) => setWithFinalExam(event.target.checked)}
							/>
							<span>{say("wizard.year.finalExam")}</span>
						</label>
					</div>
				)}

				{stepIssues.length > 0 && (
					<p className="issues" role="alert">
						{fixLine}
					</p>
				)}

				{step === 3 && made.ok && (
					<section className="planned">
						<h2>{say("wizard.folders.title")}</h2>
						<p className="muted">{say("wizard.folders.hint", { root })}</p>
						<ul className="folder-list" dir="ltr">
							{projectFolders(made.project).map((folder) => (
								<li key={folder}>{`${folder}/`}</li>
							))}
						</ul>
					</section>
				)}
			</main>

			<footer className="wizard-foot">
				<button type="button" className="btn btn-quiet" onClick={onCancel}>
					{say("wizard.cancel")}
				</button>
				<div className="spacer" />
				{step > 1 && (
					<button
						type="button"
						className="btn btn-quiet"
						onClick={() => setStep(step - 1)}
					>
						{say("wizard.back")}
					</button>
				)}
				{step < 3 ? (
					<button
						type="button"
						className="btn"
						disabled={stepIssues.length > 0}
						onClick={() => setStep(step + 1)}
					>
						{say("wizard.next")}
					</button>
				) : (
					<button
						type="button"
						className="btn"
						disabled={!made.ok || busy}
						onClick={() => void create()}
					>
						{busy ? say("wizard.creating") : say("wizard.create")}
					</button>
				)}
			</footer>
		</div>
	);
}

/** A labelled text field with the bundle's plain-text rule as its only limit. */
function Field({
	label,
	value,
	onChange,
	hint,
	dir,
	invalid = false,
	max = 300,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	hint?: string;
	dir?: "rtl" | "ltr";
	invalid?: boolean;
	max?: number;
}) {
	const check = value === "" ? null : checkText(value, max);
	const problem = check === null || check.ok ? null : check.message;
	return (
		<label className="field">
			<span className="field-label">{label}</span>
			<input
				type="text"
				value={value}
				dir={dir}
				aria-invalid={problem !== null || invalid}
				onChange={(event) => onChange(event.target.value)}
			/>
			{hint !== undefined && <span className="field-hint">{hint}</span>}
			{problem !== null && <span className="field-problem">{problem}</span>}
		</label>
	);
}
