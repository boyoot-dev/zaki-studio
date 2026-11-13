// The project window: the tree on the left, the chosen file or the Inbox on the right, and
// the three things that change the folders (new unit, rename, delete). Files come in by being
// dropped from Explorer, dragged between folders, or pasted; the tree refreshes itself when
// Explorer changes the folder, because the main process watches it. "Look for new material"
// scans the project for files copied in there, and the New material tab says what it found.

import { useCallback, useEffect, useState } from "react";

import type { FileFields, ScanProgress, TreeNode } from "../shared/api";
import { gradeLabel, type Lang, type TextKey } from "../shared/i18n";
import type { FileRow } from "../shared/model";
import {
	type Project,
	type ProjectGrade,
	type ProjectSubject,
	SECTION_FOLDERS,
} from "../shared/project";
import type { NewMaterial } from "../shared/register";
import { failureText } from "./App";
import { Changes } from "./Changes";
import { LanguageSwitch } from "./Chrome";
import { Curriculum } from "./Curriculum";
import { ExportDialog, type ExportSpec } from "./Export";
import { FileDetails } from "./FileDetails";
import { Inbox } from "./Inbox";
import { useSay } from "./i18n";
import { NewMaterialPanel } from "./NewMaterial";
import { Notes } from "./Notes";
import { Divider, usePanes } from "./Panes";
import { Prompt, type PromptSpec } from "./Prompt";
import { type Selection, Tree } from "./Tree";
import { Viewer } from "./Viewer";

/** The folder that holds the numbered units, whose count a new unit changes. */
const UNITS = SECTION_FOLDERS[0];

/** Finds a node of the tree by its path, or null when it is gone. */
function findNode(nodes: TreeNode[], rel: string): TreeNode | null {
	for (const node of nodes) {
		if (node.rel === rel) return node;
		const found = findNode(node.children, rel);
		if (found !== null) return found;
	}
	return null;
}

/** The folder a drop or a paste goes into when `selection` is chosen. */
function targetFolder(selection: Selection): string {
	if (selection === null) return "Inbox";
	if (selection.kind === "folder") return selection.rel;
	const cut = selection.rel.lastIndexOf("/");
	return cut === -1 ? "" : selection.rel.slice(0, cut);
}

export function ProjectView({
	root,
	project,
	tree: firstTree,
	lang,
	onLanguage,
	onNotify,
	onStart,
}: {
	root: string;
	project: Project;
	tree: TreeNode[];
	lang: Lang;
	onLanguage: (lang: Lang) => void;
	onNotify: (text: string) => void;
	onStart: () => void;
}) {
	const say = useSay();
	const [tree, setTree] = useState<TreeNode[]>(firstTree);
	const [selected, setSelected] = useState<Selection>(null);
	const [prompt, setPrompt] = useState<PromptSpec | null>(null);
	const [tab, setTab] = useState<
		"files" | "curriculum" | "new" | "notes" | "changes"
	>("files");
	const [exportSpec, setExportSpec] = useState<ExportSpec | null>(null);
	// The register and the last scan's report, which the New material tab shows.
	const [files, setFiles] = useState<FileRow[]>([]);
	const [report, setReport] = useState<NewMaterial | null>(null);
	const [scanning, setScanning] = useState(false);
	const [progress, setProgress] = useState<ScanProgress | null>(null);
	// The tree and the file beside it move apart and together (task 154).
	const panes = usePanes("files");

	const reload = useCallback(async () => {
		const result = await window.studio.listTree(root);
		if (result.ok) setTree(result.tree);
	}, [root]);

	/** Reads the register and the last scan's report; nothing is scanned. */
	const loadRegister = useCallback(async () => {
		const state = await window.studio.scanState(root);
		if (state.ok) {
			setFiles(state.files);
			setReport(state.report);
		}
	}, [root]);

	useEffect(() => {
		void loadRegister();
	}, [loadRegister]);

	// The watch stays for as long as the project is open; every change on disk re-reads the
	// tree, and the selected row stays selected when it is still there.
	useEffect(() => {
		void window.studio.watchProject(root);
		const stop = window.studio.onProjectChanged(() => void reload());
		return stop;
	}, [root, reload]);

	/** Looks for new material, and keeps what the scan says while it runs. */
	const scan = useCallback(async () => {
		setScanning(true);
		setProgress(null);
		const stop = window.studio.onScanProgress(setProgress);
		try {
			const result = await window.studio.scanMaterial(root);
			if (!result.ok) {
				// A stopped scan says so; anything else says why.
				onNotify(
					result.code === "cancelled"
						? say("toast.stopped")
						: failureText(lang, result),
				);
				await reload();
				return;
			}
			setReport(result.report);
			setFiles(result.files);
			onNotify(result.stopped ? say("toast.stopped") : say("toast.scanned"));
			await reload();
		} finally {
			stop();
			setScanning(false);
			setProgress(null);
		}
	}, [lang, onNotify, reload, root, say]);

	/** Stops the scan this window is running, after the page it is on. */
	const stopScan = useCallback(() => {
		void window.studio.cancelScan();
	}, []);

	/** Keeps the author's corrections on one row, and shows them as they now are. */
	const saveFields = useCallback(
		async (id: string, fields: FileFields) => {
			const result = await window.studio.setFileFields(root, id, fields);
			if (!result.ok) {
				onNotify(failureText(lang, result));
				return;
			}
			onNotify(say("toast.saved"));
			await loadRegister();
		},
		[lang, loadRegister, onNotify, root, say],
	);

	/** Reads what an export would carry, then opens the dialog that saves it. */
	const exportCurriculum = () => {
		void (async () => {
			const result = await window.studio.exportSummary(root);
			if (!result.ok) {
				onNotify(failureText(lang, result));
				return;
			}
			setExportSpec({
				version: result.version,
				summary: result.summary,
				needsAuthor: result.needsAuthor,
				author: result.author,
				rights: result.rights,
			});
		})();
	};

	/** Copies files or folders dropped from Explorer into a folder of the project. */
	const dropFiles = useCallback(
		async (targetRel: string, files: File[]) => {
			const paths = files
				.map((file) => window.studio.pathForFile(file))
				.filter((path) => path !== "");
			if (paths.length === 0) return;
			const result = await window.studio.importPaths(root, targetRel, paths);
			if (!result.ok) {
				onNotify(failureText(lang, result));
				return;
			}
			onNotify(
				result.skipped > 0
					? say("toast.addedSkipped", {
							n: result.added,
							skipped: result.skipped,
						})
					: say("toast.added", { n: result.added }),
			);
			await reload();
		},
		[lang, onNotify, reload, root, say],
	);

	/** Moves a row inside the project, after checking it isn't dropped into itself. */
	const move = useCallback(
		async (fromRel: string, toRel: string) => {
			const result = await window.studio.moveEntry(root, fromRel, toRel);
			if (!result.ok) {
				onNotify(failureText(lang, result));
				return;
			}
			onNotify(say("toast.moved"));
			if (selected !== null && selected.rel === fromRel)
				setSelected({
					rel: `${toRel}/${fromRel.split("/").pop() ?? ""}`,
					kind: selected.kind,
				});
			await reload();
		},
		[lang, onNotify, reload, root, say, selected],
	);

	// Ctrl+V: a picture becomes a PNG with the date in its name; copied files are copied in.
	useEffect(() => {
		const paste = async (event: ClipboardEvent) => {
			// A paste into a text box is the author typing, not a file to file away.
			const where = event.target;
			if (
				where instanceof HTMLElement &&
				(where.isContentEditable ||
					["INPUT", "TEXTAREA"].includes(where.tagName))
			)
				return;
			const data = event.clipboardData;
			if (data === null) return;
			const target = targetFolder(selected);
			if (target === "") return;
			const files = Array.from(data.files);
			if (files.length > 0) {
				event.preventDefault();
				await dropFiles(target, files);
				return;
			}
			const image = Array.from(data.items).find(
				(item) => item.kind === "file" && item.type.startsWith("image/"),
			);
			if (image === undefined) return;
			const file = image.getAsFile();
			if (file === null) return;
			event.preventDefault();
			const bytes = new Uint8Array(await file.arrayBuffer());
			const ext = file.type === "image/jpeg" ? "jpg" : "png";
			const result = await window.studio.savePastedImage(
				root,
				target,
				bytes,
				ext,
			);
			if (!result.ok) {
				onNotify(failureText(lang, result));
				return;
			}
			onNotify(say("toast.pasted"));
			await reload();
		};
		const handler = (event: Event) => {
			if (event instanceof ClipboardEvent) void paste(event);
		};
		document.addEventListener("paste", handler);
		return () => document.removeEventListener("paste", handler);
	}, [dropFiles, lang, onNotify, reload, root, say, selected]);

	const node = selected === null ? null : findNode(tree, selected.rel);
	const row =
		node === null || node.kind !== "file"
			? undefined
			: files.find((entry) => entry.path === node.rel);

	/** Opens a file the New material panel names, in the pane the author reads files in. */
	const pickFile = (rel: string) => {
		setTab("files");
		setSelected({ rel, kind: "file" });
	};

	const rename = () => {
		if (node === null) return;
		setPrompt({
			title: say("prompt.renameTitle"),
			initial: node.name,
			onConfirm: (value) => {
				void (async () => {
					const result = await window.studio.renameEntry(root, node.rel, value);
					if (!result.ok) {
						onNotify(failureText(lang, result));
						return;
					}
					onNotify(say("toast.renamed"));
					setSelected({ rel: result.rel, kind: node.kind });
					await reload();
				})();
			},
		});
	};

	const remove = () => {
		if (node === null) return;
		void (async () => {
			const result = await window.studio.trashEntry(root, node.rel);
			if (!result.ok) {
				onNotify(failureText(lang, result));
				return;
			}
			onNotify(say("toast.deleted"));
			setSelected(null);
			await reload();
		})();
	};

	const newUnit = () => {
		if (node === null || node.kind !== "folder") return;
		setPrompt({
			title: say("prompt.unitTitle"),
			hint: say("prompt.unitHint"),
			initial: "",
			onConfirm: (value) => {
				void (async () => {
					const result = await window.studio.makeUnit(root, node.rel, value);
					if (!result.ok) {
						onNotify(failureText(lang, result));
						return;
					}
					onNotify(say("toast.unitMade"));
					setSelected({ rel: result.rel, kind: "folder" });
					await reload();
				})();
			},
		});
	};

	const canMakeUnit =
		node !== null && node.kind === "folder" && node.name === UNITS;
	// The Inbox is the app's own folder: it stays, whatever is in it.
	const fixedRow = node !== null && node.rel === "Inbox";

	return (
		<div className="project">
			<header className="project-head">
				<div>
					<p className="project-name">
						{lang === "ar" ? project.nameAr : project.nameEn}
					</p>
					<p className="muted" dir="ltr">
						{root}
					</p>
				</div>
				<div className="head-tools">
					<div className="tabs" role="tablist">
						<button
							type="button"
							role="tab"
							aria-selected={tab === "files"}
							className={tab === "files" ? "tab tab-on" : "tab"}
							onClick={() => setTab("files")}
						>
							{say("project.tab.files")}
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={tab === "curriculum"}
							className={tab === "curriculum" ? "tab tab-on" : "tab"}
							onClick={() => setTab("curriculum")}
						>
							{say("project.tab.curriculum")}
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={tab === "new"}
							className={tab === "new" ? "tab tab-on" : "tab"}
							onClick={() => setTab("new")}
						>
							{say("project.tab.new")}
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={tab === "notes"}
							className={tab === "notes" ? "tab tab-on" : "tab"}
							onClick={() => setTab("notes")}
						>
							{say("project.tab.notes")}
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={tab === "changes"}
							className={tab === "changes" ? "tab tab-on" : "tab"}
							onClick={() => setTab("changes")}
						>
							{say("project.tab.changes")}
						</button>
					</div>
					<button
						type="button"
						className="btn btn-quiet"
						onClick={exportCurriculum}
					>
						{say("project.export")}
					</button>
					<LanguageSwitch lang={lang} onChange={onLanguage} />
					<button type="button" className="btn btn-quiet" onClick={onStart}>
						{say("app.startScreen")}
					</button>
				</div>
			</header>

			{tab === "curriculum" ? (
				<Curriculum root={root} project={project} onNotify={onNotify} />
			) : tab === "notes" ? (
				<Notes
					root={root}
					onPick={pickFile}
					onNotify={onNotify}
					onChanged={() => void loadRegister()}
				/>
			) : tab === "changes" ? (
				<Changes
					root={root}
					project={project}
					onNotify={onNotify}
					onChanged={() => void loadRegister()}
				/>
			) : tab === "new" ? (
				<NewMaterialPanel
					report={report}
					scanning={scanning}
					progress={progress}
					onScan={() => void scan()}
					onStop={stopScan}
					onPick={pickFile}
				/>
			) : (
				<div className="project-body" ref={panes.row} style={panes.style}>
					<aside
						className="side"
						onDragOver={(event) => event.preventDefault()}
						onDrop={(event) => {
							event.preventDefault();
							const dropped = Array.from(event.dataTransfer.files);
							if (dropped.length > 0) void dropFiles("Inbox", dropped);
						}}
					>
						<div className="side-tools">
							<button
								type="button"
								className="btn btn-quiet"
								disabled={scanning}
								onClick={() => void scan()}
							>
								{say("project.look")}
							</button>
							<button
								type="button"
								className="btn btn-quiet"
								disabled={!canMakeUnit}
								onClick={newUnit}
							>
								{say("project.newUnit")}
							</button>
							<button
								type="button"
								className="btn btn-quiet"
								disabled={node === null || fixedRow}
								onClick={rename}
							>
								{say("project.rename")}
							</button>
							<button
								type="button"
								className="btn btn-quiet btn-danger"
								disabled={node === null || fixedRow}
								onClick={remove}
							>
								{say("project.delete")}
							</button>
						</div>
						<Tree
							nodes={tree}
							selected={selected}
							onSelect={setSelected}
							onDropFiles={dropFiles}
							onMove={move}
						/>
					</aside>

					<Divider spec={panes.divider(0)} />

					<main className="pane">
						{node !== null && node.kind === "file" && row !== undefined && (
							<FileDetails
								key={`${row.id}-${row.grade}-${row.block}`}
								file={row}
								onSave={async (fields) => {
									await saveFields(row.id, fields);
								}}
							/>
						)}
						{node !== null && node.kind === "file" && (
							<Viewer
								key={node.rel}
								root={root}
								node={node}
								onNotify={onNotify}
							/>
						)}
						{row !== undefined && (
							<FileNote
								key={`note-${row.id}`}
								root={root}
								row={row}
								lang={lang}
								onNotify={onNotify}
							/>
						)}
						{node !== null &&
							node.kind === "folder" &&
							node.rel === "Inbox" && (
								<Inbox
									project={project}
									tree={tree}
									files={node.children.filter((child) => child.kind === "file")}
									onMove={async (fromRel, toRel) => {
										await move(fromRel, toRel);
									}}
								/>
							)}
						{node !== null &&
							node.kind === "folder" &&
							node.rel !== "Inbox" && (
								<FolderPanel node={node} project={project} lang={lang} />
							)}
						{node === null && (
							<div className="empty-pane">
								<p className="empty-sign" aria-hidden="true">
									🗂️
								</p>
								<p className="muted">{say("project.pickFile")}</p>
								<p className="muted">{say("project.pickFolder")}</p>
								<p className="muted">{say("project.dropHint")}</p>
							</div>
						)}
					</main>
				</div>
			)}

			{prompt !== null && (
				<Prompt spec={prompt} onClose={() => setPrompt(null)} />
			)}
			{exportSpec !== null && (
				<ExportDialog
					root={root}
					spec={exportSpec}
					onClose={() => setExportSpec(null)}
					onNotify={onNotify}
				/>
			)}
		</div>
	);
}

/** The note the project keeps for the chosen file, as plain text, and a way to write it again. */
function FileNote({
	root,
	row,
	lang,
	onNotify,
}: {
	root: string;
	row: FileRow;
	lang: Lang;
	onNotify: (text: string) => void;
}) {
	const say = useSay();
	const [text, setText] = useState<string | null>(null);

	const load = useCallback(async () => {
		const got = await window.studio.noteText(root, row.id);
		setText(got.ok ? got.text : "");
	}, [root, row.id]);

	useEffect(() => {
		void load();
	}, [load]);

	/** Asks first, with the cost, then writes this one file's note again. */
	const rewrite = async () => {
		const plan = await window.studio.notesPlan(root, [row.id], true);
		if (!plan.ok) {
			onNotify(failureText(lang, plan));
			return;
		}
		const cost =
			plan.plan.estimateUsd === null
				? say("notes.costUnknown")
				: `$${plan.plan.estimateUsd.toFixed(4)}`;
		if (!window.confirm(say("notes.rewriteConfirm", { cost }))) return;
		const wrote = await window.studio.writeNotes(
			root,
			[row.id],
			plan.limit,
			true,
		);
		if (!wrote.ok) {
			onNotify(failureText(lang, wrote));
			return;
		}
		if (wrote.written === 0) {
			onNotify(wrote.failed[0]?.reason ?? say("failure.unknown"));
			return;
		}
		onNotify(say("notes.rewriteDone"));
		await load();
	};

	if (text === null) return null;
	return (
		<section className="file-note">
			<h3>{say("notes.fileTitle")}</h3>
			{text === "" ? (
				<p className="muted">{say("notes.noNote")}</p>
			) : (
				<>
					{/* Plain text: a note is Markdown, and the Studio never renders it as HTML. */}
					<pre className="note-text" dir="auto">
						{text}
					</pre>
					<button
						type="button"
						className="btn btn-quiet"
						onClick={() => void rewrite()}
					>
						{say("notes.writeAgain")}
					</button>
				</>
			)}
		</section>
	);
}

/** A folder that isn't the Inbox: what is in it, and the big drop target to add more. */
function FolderPanel({
	node,
	project,
	lang,
}: {
	node: TreeNode;
	project: Project;
	lang: Lang;
}) {
	const say = useSay();
	const where = describeFolder(node.rel, project, lang, (key) => say(key));
	const files = node.children.filter((child) => child.kind === "file");
	return (
		<div className="folder-panel">
			<h2 dir="auto">{node.name}</h2>
			{where !== null && <p className="muted">{where}</p>}
			<p className="drop-big">{say("project.dropHere")}</p>
			<ul className="folder-children">
				{node.children.length === 0 && (
					<li className="muted">{say("project.empty")}</li>
				)}
				{node.children.map((child) => (
					<li key={child.rel} dir="auto">
						{child.kind === "folder" ? "📁" : "📄"} {child.name}
					</li>
				))}
			</ul>
			{files.length > 0 && (
				<p className="muted">{say("project.files", { n: files.length })}</p>
			)}
		</div>
	);
}

/** Where a folder sits in the project, in words: "Grade 7 · Science · Units". */
function describeFolder(
	rel: string,
	project: Project,
	lang: Lang,
	say: (key: TextKey) => string,
): string | null {
	const parts = rel.split("/");
	const grade: ProjectGrade | undefined = project.grades.find(
		(entry) => entry.folder === parts[0],
	);
	if (grade === undefined) return null;
	const words = [gradeLabel(lang, grade.grade)];
	if (parts[1] !== undefined) {
		const subject: ProjectSubject | undefined = grade.subjects.find(
			(entry) => entry.folder === parts[1],
		);
		words.push(subject?.folder ?? parts[1]);
	}
	for (const part of parts.slice(2))
		words.push(
			(SECTION_FOLDERS as readonly string[]).includes(part)
				? say(`project.section.${part}` as TextKey)
				: part,
		);
	return words.join(" · ");
}
