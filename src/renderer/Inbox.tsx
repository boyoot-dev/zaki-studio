// The Inbox: files dropped or pasted without a place yet, and two pickers that say where each
// belongs — grade, subject, section and unit for a wizard project, or any of the project's own
// folders when it is an adopted one (task 156), which is how the owner's material is laid out.
// Suggestions come with AI later; the pickers are the whole of it for now. The file list
// comes from the project's level of the tree, one folder at a time (task 168), and draws
// only what is on screen.

import { useCallback, useEffect, useState } from "react";

import type { TreeNode } from "../shared/api.ts";
import { gradeLabel, type Lang } from "../shared/i18n";
import { type Project, SECTION_FOLDERS } from "../shared/project.ts";
import { fileSign, fileSize } from "./Chrome";
import { useLang, useSay } from "./i18n";
import { WindowedList } from "./WindowedList";

/** The height of one file row, in pixels. */
const ROW = 40;

export function Inbox({
	root,
	project,
	onMove,
	reloadKey,
}: {
	root: string;
	project: Project;
	onMove: (fromRel: string, toRel: string) => Promise<void>;
	/** Bumped when the folder changed on disk; the Inbox is re-read. */
	reloadKey: number;
}) {
	const say = useSay();
	const lang: Lang = useLang();
	const [files, setFiles] = useState<TreeNode[]>([]);
	const [folders, setFolders] = useState<string[]>([]);
	const [units, setUnits] = useState<TreeNode[]>([]);
	const [chosen, setChosen] = useState<string | null>(null);
	const [grade, setGrade] = useState("");
	const [subject, setSubject] = useState("");
	const [section, setSection] = useState("");
	const [unit, setUnit] = useState("");
	// The project's own folders, for an adopted project that keeps its author's layout.
	const [place, setPlace] = useState("");

	const gradeEntry = project.grades.find((entry) => entry.folder === grade);
	const subjectEntry = gradeEntry?.subjects.find(
		(entry) => entry.folder === subject,
	);
	const destination = [
		grade,
		subject,
		section,
		section === SECTION_FOLDERS[0] ? unit : "",
	]
		.filter((part) => part !== "")
		.join("/");

	/** Reads the Inbox's level of the tree. */
	const loadFiles = useCallback(async () => {
		const result = await window.studio.listTree(root, "Inbox");
		if (result.ok)
			setFiles(result.nodes.filter((node) => node.kind === "file"));
	}, [root]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is the trigger — re-read when the folder changed on disk.
	useEffect(() => {
		void loadFiles();
	}, [loadFiles, reloadKey]);

	/** Reads every folder's relative path, depth-first, for the place picker. */
	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is the trigger — re-read when the folder changed on disk.
	useEffect(() => {
		let alive = true;
		void (async () => {
			const result = await window.studio.folders(root);
			if (alive && result.ok) setFolders(result.folders);
		})();
		return () => {
			alive = false;
		};
	}, [root, reloadKey]);

	/** Reads the units of the course the author is moving into. */
	useEffect(() => {
		if (section !== SECTION_FOLDERS[0] || grade === "" || subject === "") {
			setUnits([]);
			return;
		}
		let alive = true;
		void (async () => {
			const result = await window.studio.listTree(
				root,
				`${grade}/${subject}/Units`,
			);
			if (alive && result.ok)
				setUnits(result.nodes.filter((node) => node.kind === "folder"));
		})();
		return () => {
			alive = false;
		};
	}, [root, grade, subject, section]);

	const moveSelected = async () => {
		if (chosen === null || destination === "") return;
		await onMove(chosen, destination);
		setChosen(null);
	};

	/** Puts the chosen file in any folder of the project, its author's own included. */
	const placeSelected = async () => {
		if (chosen === null || place === "") return;
		await onMove(chosen, place);
		setChosen(null);
		setPlace("");
	};
	const folderChoices = folderOptions(folders);

	return (
		<div className="inbox">
			<h2>{say("project.inbox")}</h2>
			<p className="muted">{say("project.dropHint")}</p>

			{files.length === 0 ? (
				<p className="muted">{say("project.inboxEmpty")}</p>
			) : (
				<WindowedList
					count={files.length}
					rowHeight={ROW}
					className="inbox-list"
					itemClassName="inbox-item"
					ariaLabel={say("project.inbox")}
				>
					{(index) => {
						const file = files[index];
						if (file === undefined) return null;
						return (
							<button
								type="button"
								className={
									file.rel === chosen ? "inbox-row inbox-row-on" : "inbox-row"
								}
								aria-pressed={file.rel === chosen}
								onClick={() => setChosen(file.rel)}
							>
								<span aria-hidden="true">{fileSign(file)}</span>
								<span className="row-name" dir="auto">
									{file.name}
								</span>
								<span className="muted">{fileSize(file.size)}</span>
							</button>
						);
					}}
				</WindowedList>
			)}

			<section className="move-picker" aria-label={say("project.moveTo")}>
				<h3>{say("project.moveTo")}</h3>
				<div className="picker-row">
					<label className="picker-field">
						<span>{say("project.grade")}</span>
						<select
							value={grade}
							onChange={(event) => {
								setGrade(event.target.value);
								setSubject("");
								setSection("");
								setUnit("");
							}}
						>
							<option value="">{say("project.choose")}</option>
							{project.grades.map((entry) => (
								<option key={entry.grade} value={entry.folder}>
									{gradeLabel(lang, entry.grade)}
								</option>
							))}
						</select>
					</label>
					<label className="picker-field">
						<span>{say("project.subject")}</span>
						<select
							value={subject}
							disabled={gradeEntry === undefined}
							onChange={(event) => {
								setSubject(event.target.value);
								setSection("");
								setUnit("");
							}}
						>
							<option value="">{say("project.choose")}</option>
							{gradeEntry?.subjects.map((entry) => (
								<option key={entry.folder} value={entry.folder}>
									{entry.folder}
								</option>
							))}
						</select>
					</label>
					<label className="picker-field">
						<span>{say("project.section")}</span>
						<select
							value={section}
							disabled={subjectEntry === undefined}
							onChange={(event) => {
								setSection(event.target.value);
								setUnit("");
							}}
						>
							<option value="">{say("project.choose")}</option>
							{SECTION_FOLDERS.map((folder) => (
								<option key={folder} value={folder}>
									{say(`project.section.${folder}`)}
								</option>
							))}
						</select>
					</label>
					{section === SECTION_FOLDERS[0] && (
						<label className="picker-field">
							<span>{say("project.unit")}</span>
							<select
								value={unit}
								onChange={(event) => setUnit(event.target.value)}
							>
								<option value="">{say("project.choose")}</option>
								{units.map((node) => (
									<option key={node.rel} value={node.name}>
										{node.name}
									</option>
								))}
							</select>
						</label>
					)}
				</div>
				<button
					type="button"
					className="btn"
					disabled={chosen === null || destination === ""}
					onClick={() => void moveSelected()}
				>
					{say("project.move")}
				</button>
			</section>

			<section className="move-picker" aria-label={say("project.putInFolder")}>
				<h3>{say("project.putInFolder")}</h3>
				<p className="muted">{say("project.putHint")}</p>
				<div className="picker-row">
					<label className="picker-field">
						<span>{say("project.folder")}</span>
						<select
							value={place}
							onChange={(event) => setPlace(event.target.value)}
						>
							<option value="">{say("project.choose")}</option>
							{folderChoices.map((folder) => (
								<option key={folder.rel} value={folder.rel}>
									{folder.label}
								</option>
							))}
						</select>
					</label>
				</div>
				<button
					type="button"
					className="btn"
					disabled={chosen === null || place === ""}
					onClick={() => void placeSelected()}
				>
					{say("project.put")}
				</button>
			</section>
		</div>
	);
}

/** Every folder of the project, in tree order, each with a name that shows how deep it is. */
export function folderOptions(
	folders: readonly string[],
): { rel: string; label: string }[] {
	const out: { rel: string; label: string }[] = [];
	for (const rel of folders) {
		const depth = rel.split("/").length - 1;
		const name = rel.split("/").pop() ?? rel;
		// The Inbox is where files come from, never where they are put back.
		if (rel === "Inbox") continue;
		out.push({ rel, label: `${"— ".repeat(depth)}${name}` });
	}
	return out;
}
