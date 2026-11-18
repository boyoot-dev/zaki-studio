// The export dialog (task 153): what the file will hold, the two things the bundle needs
// before it can be written (the author's name and the rights sentence), and the save button.
// The main process checks the bundle with the shared parser; anything it finds is shown here
// and no file is written.

import studioSubjects from "virtual:subjects";
import { useState } from "react";

import type { CourseNumberWarnings } from "../shared/exam-numbers";
import { gradeLabel, type Lang } from "../shared/i18n";
import { type LanguageWarning, languageName } from "../shared/languages";
import type { ModelSummary } from "../shared/model";
import { failureText } from "./App";
import { useLang, useSay } from "./i18n";

export type ExportSpec = {
	version: number;
	summary: ModelSummary;
	needsAuthor: boolean;
	author: string;
	rights: string;
	/** The accepted exams whose numbers don't add up, per course; the export still works. */
	examWarnings: CourseNumberWarnings[];
	/** Courses in a language Mr. Zaki can't use yet (task 225); the export still works. */
	languageWarnings: LanguageWarning[];
};

/** The subject's own name, in the window's language. */
function subjectName(id: string, lang: Lang): string {
	const subject = studioSubjects.find((entry) => entry.id === id);
	if (subject === undefined) return id;
	return lang === "ar" ? subject.nameAr : subject.nameEn;
}

export function ExportDialog({
	root,
	spec,
	onClose,
	onOpenCourse,
	onNotify,
}: {
	root: string;
	spec: ExportSpec;
	onClose: () => void;
	/** Opens the Curriculum tab at a course whose exam numbers don't add up. */
	onOpenCourse: (course: {
		grade: number;
		subject: string;
		language: string;
	}) => void;
	onNotify: (text: string) => void;
}) {
	const say = useSay();
	const lang = useLang();
	const [author, setAuthor] = useState(spec.author);
	const [rights, setRights] = useState(spec.rights);
	const [problems, setProblems] = useState<string[]>([]);
	const [working, setWorking] = useState(false);

	const counts = [
		["export.courses", spec.summary.courses],
		["export.units", spec.summary.units],
		["export.lessons", spec.summary.lessons],
		["export.facts", spec.summary.facts],
		["export.exams", spec.summary.exams],
	] as const;

	const ready =
		!spec.needsAuthor || (author.trim() !== "" && rights.trim() !== "");

	const save = async () => {
		setWorking(true);
		setProblems([]);
		const result = await window.studio.exportBundle(root, author, rights);
		setWorking(false);
		if (result.ok) {
			onNotify(say("export.done", { n: result.version }));
			onClose();
			return;
		}
		if (result.code === "cancelled") return;
		setProblems(
			result.issues !== undefined && result.issues.length > 0
				? result.issues
				: [failureText(lang, result)],
		);
	};

	return (
		<div className="veil">
			<form
				className="dialog export-dialog"
				aria-modal="true"
				role="dialog"
				aria-label={say("export.title")}
				onSubmit={(event) => {
					event.preventDefault();
					void save();
				}}
				onKeyDown={(event) => {
					if (event.key === "Escape") onClose();
				}}
			>
				<h2>{say("export.title")}</h2>
				<p className="muted">{say("export.version", { n: spec.version })}</p>
				<p>{say("export.summary")}</p>
				<ul className="export-counts">
					{counts.map(([key, count]) => (
						<li key={key}>
							<span>{say(key, { n: count })}</span>
						</li>
					))}
				</ul>

				{spec.examWarnings.length > 0 && (
					<div>
						<p className="exam-warn-summary">
							{say("export.examWarnings", {
								n: spec.examWarnings.reduce(
									(total, entry) => total + entry.warnings,
									0,
								),
							})}
						</p>
						<ul className="exam-warn">
							{spec.examWarnings.map((entry) => (
								<li key={`${entry.grade}|${entry.subject}`}>
									<span>
										{say("export.examWarningCourse", {
											course: `${gradeLabel(lang, entry.grade)} · ${subjectName(entry.subject, lang)}`,
											n: entry.warnings,
										})}
									</span>
									<button
										type="button"
										className="btn btn-quiet"
										onClick={() => {
											onClose();
											onOpenCourse(entry);
										}}
									>
										{say("export.openExamCourse")}
									</button>
								</li>
							))}
						</ul>
					</div>
				)}

				{spec.languageWarnings.length > 0 && (
					<ul className="exam-warn">
						{spec.languageWarnings.map((entry) => (
							<li
								key={`${entry.grade}|${entry.subject}|${entry.kind}|${entry.language}`}
							>
								<span>
									{say("export.languageWarn", {
										course: `${gradeLabel(lang, entry.grade)} · ${subjectName(entry.subject, lang)}`,
										text: say(
											entry.kind === "teach"
												? "language.notYet"
												: "language.helpNotYet",
											{ language: languageName(entry.language, lang) },
										),
									})}
								</span>
							</li>
						))}
					</ul>
				)}

				{(spec.needsAuthor || author !== "" || rights !== "") && (
					<div className="form">
						<label className="field">
							<span className="field-label">{say("export.author")}</span>
							<input
								type="text"
								value={author}
								aria-invalid={spec.needsAuthor && author.trim() === ""}
								onChange={(event) => setAuthor(event.target.value)}
							/>
						</label>
						<label className="field">
							<span className="field-label">{say("export.rights")}</span>
							<input
								type="text"
								value={rights}
								aria-invalid={spec.needsAuthor && rights.trim() === ""}
								onChange={(event) => setRights(event.target.value)}
							/>
						</label>
					</div>
				)}

				{problems.length > 0 && (
					<div className="issues">
						<p>{say("export.problems")}</p>
						<ul>
							{problems.map((problem) => (
								<li key={problem}>{problem}</li>
							))}
						</ul>
					</div>
				)}

				<div className="dialog-buttons">
					<button type="button" className="btn btn-quiet" onClick={onClose}>
						{say("common.cancel")}
					</button>
					<button type="submit" className="btn" disabled={working || !ready}>
						{working ? say("export.working") : say("export.save")}
					</button>
				</div>
			</form>
		</div>
	);
}
