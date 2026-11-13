// A file's details (task 156): the grade, subject, block, kind and authority the register
// guessed from the file's name and folders, which the author can correct. A corrected field is
// kept when the project is scanned again, so the guess never overwrites a person's answer.

import studioSubjects from "virtual:subjects";
import { useState } from "react";

import type { FileFields } from "../shared/api";
import type { Lang } from "../shared/i18n";
import type { FileRow } from "../shared/model";
import { AUTHORITIES, KINDS } from "../shared/register";
import { useLang, useSay } from "./i18n";

export function FileDetails({
	file,
	onSave,
}: {
	file: FileRow;
	onSave: (fields: FileFields) => Promise<void>;
}) {
	const say = useSay();
	const lang: Lang = useLang();
	const [grade, setGrade] = useState(
		file.grade === null ? "" : String(file.grade),
	);
	const [subject, setSubject] = useState(file.subject);
	const [block, setBlock] = useState(file.block);
	const [kind, setKind] = useState(file.kind === "" ? "other" : file.kind);
	const [authority, setAuthority] = useState(
		file.authority === null ? "" : String(file.authority),
	);
	const [saving, setSaving] = useState(false);

	const save = async () => {
		setSaving(true);
		try {
			await onSave({
				grade: grade.trim() === "" ? null : Number(grade),
				subject,
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
				<datalist id="studio-subjects">
					{studioSubjects.map((entry) => (
						<option key={entry.id} value={entry.id}>
							{lang === "ar" ? entry.nameAr : entry.nameEn}
						</option>
					))}
				</datalist>
				<label className="picker-field">
					<span>{say("detail.block")}</span>
					<input
						type="text"
						dir="auto"
						value={block}
						onChange={(event) => setBlock(event.target.value)}
					/>
				</label>
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
