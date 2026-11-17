// Opening a curriculum file as a new project (task 214): what the file is, who made it and
// on what terms, then an empty folder to make the project in. The file was read and checked
// by the main process; this dialog only shows its summary, so nothing in it comes from the
// page. The author's say-so on the rights comes first, because the file is someone's work.

import { useState } from "react";
import type { BundleInfo, ProjectOpen } from "../shared/api";
import type { Lang } from "../shared/i18n";
import { useSay } from "./i18n";

export function OpenBundle({
	lang,
	info,
	issues,
	onClose,
	onOpened,
}: {
	lang: Lang;
	/** The checked file, or null when it failed the check. */
	info: BundleInfo | null;
	/** Why the file failed the check. */
	issues: string[];
	onClose: () => void;
	onOpened: (opened: ProjectOpen) => void;
}) {
	const say = useSay();
	const [agreed, setAgreed] = useState(false);
	const [working, setWorking] = useState(false);

	const make = async () => {
		setWorking(true);
		try {
			const opened = await window.studio.projectFromBundle();
			if (!opened.ok && opened.code === "cancelled") return;
			onOpened(opened);
		} finally {
			setWorking(false);
		}
	};

	return (
		<div className="veil">
			<form
				className="dialog export-dialog"
				aria-modal="true"
				role="dialog"
				aria-label={say("bundle.title")}
				onSubmit={(event) => {
					event.preventDefault();
					if (info !== null && agreed) void make();
				}}
				onKeyDown={(event) => {
					if (event.key === "Escape") onClose();
				}}
			>
				<h2>{say("bundle.title")}</h2>
				{info === null ? (
					<div className="issues">
						<p>{say("bundle.invalid")}</p>
						<ul>
							{issues.map((issue) => (
								<li key={issue} dir="auto">
									{issue}
								</li>
							))}
						</ul>
					</div>
				) : (
					<>
						<p className="muted" dir="ltr">
							{info.file}
						</p>
						<p dir="auto">
							<strong>{lang === "ar" ? info.nameAr : info.nameEn}</strong>
						</p>
						<p dir="auto">{say("bundle.author", { name: info.author })}</p>
						<p className="muted">
							{say("export.version", { n: info.version })}
						</p>
						<ul className="export-counts">
							<li>{say("export.courses", { n: info.summary.courses })}</li>
							<li>{say("export.units", { n: info.summary.units })}</li>
							<li>{say("export.lessons", { n: info.summary.lessons })}</li>
							<li>{say("export.facts", { n: info.summary.facts })}</li>
							<li>{say("export.exams", { n: info.summary.exams })}</li>
						</ul>
						<p className="field-label">{say("bundle.rights")}</p>
						<p dir="auto">{info.rights}</p>
						<label className="check">
							<input
								type="checkbox"
								checked={agreed}
								onChange={(event) => setAgreed(event.target.checked)}
							/>
							<span>{say("bundle.agree")}</span>
						</label>
						<p className="muted">{say("bundle.hint")}</p>
					</>
				)}
				<div className="dialog-buttons">
					<button type="button" className="btn btn-quiet" onClick={onClose}>
						{say("common.cancel")}
					</button>
					{info !== null && (
						<button type="submit" className="btn" disabled={working || !agreed}>
							{say("bundle.make")}
						</button>
					)}
				</div>
			</form>
		</div>
	);
}
