// The export dialog (task 153): what the file will hold, the two things the bundle needs
// before it can be written (the author's name and the rights sentence), and the save button.
// The main process checks the bundle with the shared parser; anything it finds is shown here
// and no file is written.

import { useState } from "react";

import type { ModelSummary } from "../shared/model";
import { failureText } from "./App";
import { useLang, useSay } from "./i18n";

export type ExportSpec = {
	version: number;
	summary: ModelSummary;
	needsAuthor: boolean;
	author: string;
	rights: string;
};

export function ExportDialog({
	root,
	spec,
	onClose,
	onNotify,
}: {
	root: string;
	spec: ExportSpec;
	onClose: () => void;
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
