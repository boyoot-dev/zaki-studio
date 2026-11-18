// A course's teaching language and help languages, in the Curriculum tab (task 225). The
// author picks the language the course is taught in, and the languages Mr. Zaki may also use
// to help: the child's own, or a named one. "Apply to other grades" copies the help languages
// to the same subject in the grades the author ticks, writing them on each course; nothing
// grade-wide is stored. "Add in another language" adds the same subject in a second language
// to this grade (task 228); it joins the nav once a change set for it is accepted. Every
// change is written to curriculum.json at once, through the main process, which checks it again.

import { useState } from "react";
import type { CourseHead } from "../shared/api.ts";
import { gradeLabel } from "../shared/i18n";
import {
	APP_LANGUAGES,
	HELP_CHOICES,
	languageChoices,
	languageName,
} from "../shared/languages.ts";
import { failureText } from "./App";
import { useLang, useSay } from "./i18n";

export function CourseLanguages({
	root,
	course,
	courses,
	projectLanguages,
	subjectName,
	onChanged,
	onNotify,
}: {
	root: string;
	course: CourseHead;
	/** Every course of the project, for "apply to other grades". */
	courses: readonly CourseHead[];
	/** The languages this subject already has in this grade, from the project itself. */
	projectLanguages: readonly string[];
	/** The subject's own name, for the toast after adding a course. */
	subjectName: string;
	onChanged: () => void;
	onNotify: (text: string) => void;
}) {
	const say = useSay();
	const lang = useLang();
	const [others, setOthers] = useState<number[] | null>(null);
	const [adding, setAdding] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const save = async (
		changes: {
			grade: number;
			subject: string;
			language: string;
			support: string[];
		}[],
	) => {
		setBusy(true);
		const done = await window.studio.setCourseLanguages(root, changes);
		setBusy(false);
		if (!done.ok) {
			onNotify(failureText(lang, done));
			return;
		}
		onNotify(say("language.saved"));
		onChanged();
	};

	const setTeaching = (language: string) => {
		if (language === course.language) return;
		// A course in another language is a different course to Mr. Zaki: say so first.
		if (!window.confirm(say("language.changeWarn"))) return;
		void save([
			{
				grade: course.grade,
				subject: course.subject,
				language,
				support: course.support.filter((code) => code !== language),
			},
		]);
	};

	const toggleHelp = (code: string) => {
		const support = course.support.includes(code)
			? course.support.filter((entry) => entry !== code)
			: [...course.support, code];
		void save([
			{
				grade: course.grade,
				subject: course.subject,
				language: course.language,
				support,
			},
		]);
	};

	const sameSubject = courses.filter(
		(entry) => entry.subject === course.subject && entry.grade !== course.grade,
	);

	const applyOthers = () => {
		if (others === null) return;
		const chosen = sameSubject.filter((entry) => others.includes(entry.grade));
		if (chosen.length === 0) {
			setOthers(null);
			return;
		}
		void save(
			chosen.map((entry) => ({
				grade: entry.grade,
				subject: entry.subject,
				language: entry.language,
				support: course.support.filter((code) => code !== entry.language),
			})),
		).then(() => setOthers(null));
	};

	const available = languageChoices(lang).filter(
		(choice) => !projectLanguages.includes(choice.code),
	);

	/** Adds the same subject in another language, as a second course of this grade. */
	const addLanguage = async () => {
		if (adding === null) return;
		setBusy(true);
		const done = await window.studio.addCourseLanguage(
			root,
			course.grade,
			course.subject,
			adding,
		);
		setBusy(false);
		if (!done.ok) {
			onNotify(failureText(lang, done));
			return;
		}
		const added = adding;
		setAdding(null);
		onNotify(
			say("language.added", {
				subject: subjectName,
				language: languageName(added, lang),
			}),
		);
		onChanged();
	};

	const offered = [
		...HELP_CHOICES,
		...course.support.filter((code) => !HELP_CHOICES.includes(code)),
	].filter((code) => code !== course.language);

	return (
		<section className="course-languages" aria-label={say("language.title")}>
			<h3>{say("language.title")}</h3>
			<label className="course-language">
				<span>{say("language.teaching")}</span>
				<select
					value={course.language}
					disabled={busy}
					onChange={(event) => setTeaching(event.target.value)}
				>
					{languageChoices(lang).map((choice) => (
						<option key={choice.code} value={choice.code}>
							{choice.name}
						</option>
					))}
				</select>
			</label>
			{!APP_LANGUAGES.includes(course.language) && (
				<p className="exam-warn">
					{say("language.notYet", {
						language: languageName(course.language, lang),
					})}
				</p>
			)}
			<fieldset className="course-help" disabled={busy}>
				<legend>{say("language.help")}</legend>
				{offered.map((code) => (
					<label key={code} className="subject">
						<input
							type="checkbox"
							checked={course.support.includes(code)}
							onChange={() => toggleHelp(code)}
						/>
						<span>{languageName(code, lang)}</span>
					</label>
				))}
				<p className="muted">{say("language.helpHint")}</p>
			</fieldset>
			{course.support
				.filter((code) => code !== "native" && !APP_LANGUAGES.includes(code))
				.map((code) => (
					<p key={code} className="exam-warn">
						{say("language.helpNotYet", { language: languageName(code, lang) })}
					</p>
				))}
			{others === null ? (
				<button
					type="button"
					className="btn btn-quiet"
					disabled={busy}
					onClick={() =>
						setOthers(
							sameSubject
								.filter((entry) => entry.grade < course.grade)
								.map((entry) => entry.grade),
						)
					}
				>
					{say("language.applyOthers")}
				</button>
			) : (
				<div className="course-apply">
					{sameSubject.length === 0 ? (
						<p className="muted">{say("language.noOthers")}</p>
					) : (
						<>
							<p className="muted">{say("language.applyHint")}</p>
							{sameSubject.map((entry) => (
								<label key={entry.grade} className="subject">
									<input
										type="checkbox"
										checked={others.includes(entry.grade)}
										onChange={() =>
											setOthers((current) =>
												current === null
													? current
													: current.includes(entry.grade)
														? current.filter((grade) => grade !== entry.grade)
														: [...current, entry.grade],
											)
										}
									/>
									<span>{gradeLabel(lang, entry.grade)}</span>
								</label>
							))}
						</>
					)}
					<div className="course-apply-buttons">
						<button
							type="button"
							className="btn"
							disabled={busy || sameSubject.length === 0}
							onClick={applyOthers}
						>
							{say("language.apply")}
						</button>
						<button
							type="button"
							className="btn btn-quiet"
							onClick={() => setOthers(null)}
						>
							{say("wizard.cancel")}
						</button>
					</div>
				</div>
			)}
			{available.length === 0 ? (
				<p className="muted">{say("language.addNone")}</p>
			) : adding === null ? (
				<button
					type="button"
					className="btn btn-quiet"
					disabled={busy}
					onClick={() => setAdding(available[0]?.code ?? null)}
				>
					{say("language.addOther")}
				</button>
			) : (
				<div className="course-apply">
					<p className="muted">{say("language.addHint")}</p>
					<label className="course-language">
						<span>{say("language.teaching")}</span>
						<select
							value={adding}
							disabled={busy}
							onChange={(event) => setAdding(event.target.value)}
						>
							{available.map((choice) => (
								<option key={choice.code} value={choice.code}>
									{choice.name}
								</option>
							))}
						</select>
					</label>
					<div className="course-apply-buttons">
						<button
							type="button"
							className="btn"
							disabled={busy}
							onClick={() => void addLanguage()}
						>
							{say("language.add")}
						</button>
						<button
							type="button"
							className="btn btn-quiet"
							onClick={() => setAdding(null)}
						>
							{say("wizard.cancel")}
						</button>
					</div>
				</div>
			)}
		</section>
	);
}
