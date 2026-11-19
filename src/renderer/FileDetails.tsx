// A file's details (task 156): the grade, subject, language, block, kind and authority the
// register guessed from the file's name and folders, which the author can correct. The language
// shows only when the subject is taught in more than one language in that grade (task 228). A
// corrected field is kept when the project is scanned again, so the guess never overwrites a
// person's answer.

import studioSubjects from "virtual:subjects";
import { useState } from "react";

import type { FileFields } from "../shared/api";
import type { Lang } from "../shared/i18n";
import { languageName } from "../shared/languages";
import type { FileRow } from "../shared/model";
import type { Project } from "../shared/project";
import { AUTHORITIES, KINDS } from "../shared/register";
import { rowPeriodIds, termPaths, yearIsSplit } from "../shared/terms";
import { useLang, useSay } from "./i18n";

export function FileDetails({
	file,
	project,
	onSave,
}: {
	file: FileRow;
	/** The project's courses, for the languages the file's grade has this subject in. */
	project: Project;
	onSave: (fields: FileFields) => Promise<void>;
}) {
	const say = useSay();
	const lang: Lang = useLang();
	const [grade, setGrade] = useState(
		file.grade === null ? "" : String(file.grade),
	);
	const [subject, setSubject] = useState(file.subject);
	const [language, setLanguage] = useState(file.language);
	// In a year split into terms the block is the file's term, chosen from the year's unit
	// periods (task 249); a block read from "Block 3" shows as that period when the year has it.
	const split = yearIsSplit(project.periods);
	const terms = split
		? termPaths(project.periods, (period) =>
				lang === "ar" ? period.nameAr : period.nameEn,
			)
		: [];
	const [block, setBlock] = useState(() => {
		if (!split) return file.block;
		const ids = rowPeriodIds(file.block, project.periods);
		const id = ids.length === 1 ? ids[0] : undefined;
		return id !== undefined && terms.some((term) => term.id === id)
			? id
			: file.block;
	});
	const [kind, setKind] = useState(file.kind === "" ? "other" : file.kind);
	const [authority, setAuthority] = useState(
		file.authority === null ? "" : String(file.authority),
	);
	const [saving, setSaving] = useState(false);

	// The languages the chosen grade has this subject in, from the project itself (task 228).
	const courseLanguages =
		grade.trim() === ""
			? []
			: [
					...(project.grades
						.find((entry) => entry.grade === Number(grade))
						?.subjects.filter((entry) => entry.subject === subject.trim())
						.map((entry) => entry.language) ?? []),
				].filter((code, index, all) => all.indexOf(code) === index);
	const shownLanguage = courseLanguages.includes(language)
		? language
		: (courseLanguages[0] ?? "");
	const pickLanguage = courseLanguages.length > 1;

	const save = async () => {
		setSaving(true);
		try {
			await onSave({
				grade: grade.trim() === "" ? null : Number(grade),
				subject,
				// Hidden when the subject is taught in one language here: the rules keep it.
				language: pickLanguage ? shownLanguage : undefined,
				block,
				kind,
				authority: authority === "" ? null : Number(authority),
			});
		} finally {
			setSaving(false);
		}
	};

	return (
		<section className="file-details" aria-label={say("detail.title")}>
			<h3>{say("detail.title")}</h3>
			<p className="muted">{say("detail.hint")}</p>
			<div className="detail-fields">
				<label className="picker-field">
					<span>{say("project.grade")}</span>
					<input
						type="number"
						min={0}
						max={12}
						value={grade}
						onChange={(event) => setGrade(event.target.value)}
					/>
				</label>
				<label className="picker-field">
					<span>{say("project.subject")}</span>
					<input
						type="text"
						dir="auto"
						list="studio-subjects"
						value={subject}
						onChange={(event) => setSubject(event.target.value)}
					/>
				</label>
				{pickLanguage && (
					<label className="picker-field">
						<span>{say("language.teaching")}</span>
						<select
							value={shownLanguage}
							onChange={(event) => setLanguage(event.target.value)}
						>
							{courseLanguages.map((code) => (
								<option key={code} value={code}>
									{languageName(code, lang)}
								</option>
							))}
						</select>
					</label>
				)}
				<datalist id="studio-subjects">
					{studioSubjects.map((entry) => (
						<option key={entry.id} value={entry.id}>
							{lang === "ar" ? entry.nameAr : entry.nameEn}
						</option>
					))}
				</datalist>
				{split ? (
					<label className="picker-field">
						<span>{say("detail.term")}</span>
						<select
							value={block}
							onChange={(event) => setBlock(event.target.value)}
						>
							<option value="">{say("detail.termNone")}</option>
							{block !== "" && !terms.some((term) => term.id === block) && (
								<option value={block}>{block}</option>
							)}
							{terms.map((term) => (
								<option key={term.id} value={term.id}>
									{term.path.join(" · ")}
								</option>
							))}
						</select>
					</label>
				) : (
					<label className="picker-field">
						<span>{say("detail.block")}</span>
						<input
							type="text"
							dir="auto"
							value={block}
							onChange={(event) => setBlock(event.target.value)}
						/>
					</label>
				)}
				<label className="picker-field">
					<span>{say("detail.kind")}</span>
					<select
						value={kind}
						onChange={(event) => setKind(event.target.value)}
					>
						{KINDS.map((entry) => (
							<option key={entry} value={entry}>
								{say(`kind.${entry}`)}
							</option>
						))}
					</select>
				</label>
				<label className="picker-field">
					<span>{say("detail.authority")}</span>
					<select
						value={authority}
						onChange={(event) => setAuthority(event.target.value)}
					>
						<option value="">{say("detail.authorityNone")}</option>
						{AUTHORITIES.map((level) => (
							<option key={level} value={String(level)}>
								{say(`authority.${level}`)}
							</option>
						))}
					</select>
				</label>
				<button
					type="button"
					className="btn"
					disabled={saving}
					onClick={() => void save()}
				>
					{say("detail.save")}
				</button>
			</div>
			<p className="muted" dir="auto">
				{file.path}
			</p>
		</section>
	);
}
