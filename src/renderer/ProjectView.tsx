// The project window: the tree on the left, the chosen file or the Inbox on the right, and
// the three things that change the folders (new unit, rename, delete). Files come in by being
// dropped from Explorer, dragged between folders, or pasted; the tree refreshes itself when
// Explorer changes the folder, because the main process watches it. "Look for new material"
// scans the project for files copied in there, and the New material tab says what it found.
// The tree, the Inbox and every other long list draw only what is on screen (task 168).

import { useCallback, useEffect, useState } from "react";

import type { FileFields, ScanProgress, TreeNode } from "../shared/api.ts";
import { gradeLabel, type Lang, type TextKey } from "../shared/i18n";
import type { ReportMeta } from "../shared/lists.ts";
import type { FileRow } from "../shared/model.ts";
import {
	type Project,
	type ProjectGrade,
	type ProjectSubject,
	SECTION_FOLDERS,
} from "../shared/project.ts";
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
import { Tree } from "./Tree";
import { Viewer } from "./Viewer";
import { WindowedList } from "./WindowedList";

/** The folder that holds the numbered units, whose count a new unit changes. */
const UNITS = SECTION_FOLDERS[0];

/** The folder a drop or a paste goes into when `selection` is chosen. */
function targetFolder(
	selection: {
		rel: string;
		kind: "folder" | "file";
	} | null,
): string {
	if (selection === null) return "Inbox";
	if (selection.kind === "folder") return selection.rel;
	const cut = selection.rel.lastIndexOf("/");
	return cut === -1 ? "" : selection.rel.slice(0, cut);
}

/** The path's own file name. */
function fileName(path: string): string {
	const name = path.split("/").pop() ?? path;
	const cut = name.lastIndexOf(".");
	return cut <= 0 ? name : name.slice(0, cut);
}

/** The extension of a file's path, lowercase and without the dot. */
function extensionOf(path: string): string {
	const name = path.split("/").pop() ?? path;
	const cut = name.lastIndexOf(".");
	return cut < 0 ? "" : name.slice(cut + 1).toLowerCase();
}

type Tab = "files" | "curriculum" | "new" | "notes" | "changes";

export function ProjectView({
	root,
	project,
	tree: firstTop,
	lang,
	onLanguage,
	onNotify,
	onStart,
	onProjectReload,
}: {
	root: string;
	project: Project;
	/** The top level of the tree from opening the project; deeper levels load on expand. */
	tree: TreeNode[];
	lang: Lang;
	onLanguage: (lang: Lang) => void;
	onNotify: (text: string) => void;
	onStart: () => void;
	/** Reads the project file again: a course added there is not in the model yet (task 228). */
	onProjectReload: () => void;
}) {
	const say = useSay();
	const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
	// The page a review link asked for; it applies only while that same file is shown.
	const [openAt, setOpenAt] = useState<{ rel: string; page: number } | null>(
		null,
	);
	const [prompt, setPrompt] = useState<PromptSpec | null>(null);
	const [tab, setTabState] = useState<Tab>("files");
	// The tabs opened so far: they stay mounted (hidden) so switching back is instant.
	const [seen, setSeen] = useState<ReadonlySet<Tab>>(() => new Set(["files"]));
	const setTab = useCallback((next: Tab) => {
		setTabState(next);
		setSeen((current) =>
			current.has(next) ? current : new Set([...current, next]),
		);
	}, []);
	// The course the export's exam warning line opens, bumped so a second click goes there too.
	const [coursePick, setCoursePick] = useState<{
		grade: number;
		subject: string;
		language: string;
		key: number;
	} | null>(null);
	const [exportSpec, setExportSpec] = useState<ExportSpec | null>(null);
	// The register's row for the chosen file, and the last scan's report header.
	const [row, setRow] = useState<FileRow | null>(null);
	const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null);
	const [scanning, setScanning] = useState(false);
	const [progress, setProgress] = useState<ScanProgress | null>(null);
	// Bumped when the folder changed on disk; the tree, the panels and the row re-read.
	const [reloadKey, setReloadKey] = useState(0);
	// The tree and the file beside it move apart and together (task 154).
	const panes = usePanes("files");

	const reload = useCallback(() => setReloadKey((key) => key + 1), []);
	/** Refreshes the panes and reads curriculum.json again, for a change made in it. */
	const reloadProject = useCallback(() => {
		reload();
		onProjectReload();
	}, [reload, onProjectReload]);

	// The file's register row, fetched once per selection (and after a change on disk).
	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is the trigger — refetch when the folder changed on disk.
	useEffect(() => {
		let alive = true;
		if (selectedNode === null || selectedNode.kind !== "file") {
			setRow(null);
			return;
		}
		void (async () => {
			const result = await window.studio.fileRow(root, selectedNode.rel);
			if (alive && result.ok) setRow(result.row);
		})();
		return () => {
			alive = false;
		};
	}, [root, selectedNode, reloadKey]);

	// The last scan's report header, for the New material tab.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is the trigger — refetch when the folder changed on disk.
	useEffect(() => {
		let alive = true;
		void (async () => {
			const state = await window.studio.scanState(root);
			if (alive && state.ok) setReportMeta(state.meta);
		})();
		return () => {
			alive = false;
		};
	}, [root, reloadKey]);

	// The watch stays for as long as the project is open; every change on disk refreshes.
	useEffect(() => {
		void window.studio.watchProject(root);
		const stop = window.studio.onProjectChanged(() => reload());
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
				reload();
				return;
			}
			setReportMeta(result.meta);
			onNotify(result.stopped ? say("toast.stopped") : say("toast.scanned"));
			reload();
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
			reload();
		},
		[lang, onNotify, reload, root, say],
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
				examWarnings: result.examWarnings,
				languageWarnings: result.languageWarnings,
			});
		})();
	};

	/** Opens the Curriculum tab at one course, from the export's exam warning line. */
	const openCourse = (course: {
		grade: number;
		subject: string;
		language: string;
	}) => {
		setCoursePick({ ...course, key: Date.now() });
		setTab("curriculum");
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
			reload();
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
			if (selectedNode !== null && selectedNode.rel === fromRel)
				setSelectedNode({
					...selectedNode,
					rel: `${toRel}/${fromRel.split("/").pop() ?? ""}`,
				});
			reload();
		},
		[lang, onNotify, reload, root, say, selectedNode],
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
			const target = targetFolder(selectedNode);
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
			reload();
		};
		const handler = (event: Event) => {
			if (event instanceof ClipboardEvent) void paste(event);
		};
		document.addEventListener("paste", handler);
		return () => document.removeEventListener("paste", handler);
	}, [dropFiles, lang, onNotify, reload, root, say, selectedNode]);

	const node = selectedNode;

	/** Opens a file the New material panel or a review names, in the pane the author reads
	 * files in, at a page when one is given. */
	const pickFile = (rel: string, page?: number) => {
		setTab("files");
		setOpenAt(page === undefined ? null : { rel, page });
		setSelectedNode({
			name: fileName(rel),
			rel,
			kind: "file",
			size: 0,
			ext: extensionOf(rel),
			children: [],
			files: 0,
		});
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
					setSelectedNode({ ...node, name: value, rel: result.rel });
					reload();
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
			setSelectedNode(null);
			reload();
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
					setSelectedNode({
						...node,
						rel: result.rel,
						name: result.rel.split("/").pop() ?? value,
					});
					reload();
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

			{/* A tab, once opened, stays alive and is only hidden: coming back to it shows what it
			    had at once, instead of loading it again (owner, 2026-11-13). */}
			{seen.has("curriculum") && (
				<div className="tab-panel" hidden={tab !== "curriculum"}>
					<Curriculum
						root={root}
						project={project}
						onNotify={onNotify}
						reloadKey={reloadKey}
						openCourse={coursePick}
						onChanged={reloadProject}
					/>
				</div>
			)}
			{seen.has("notes") && (
				<div className="tab-panel" hidden={tab !== "notes"}>
					<Notes
						root={root}
						onPick={pickFile}
						onNotify={onNotify}
						onChanged={reload}
						reloadKey={reloadKey}
					/>
				</div>
			)}
			{seen.has("changes") && (
				<div className="tab-panel" hidden={tab !== "changes"}>
					<Changes
						root={root}
						project={project}
						onNotify={onNotify}
						onChanged={reload}
						onOpenFile={pickFile}
						reloadKey={reloadKey}
					/>
				</div>
			)}
			{seen.has("new") && (
				<div className="tab-panel" hidden={tab !== "new"}>
					<NewMaterialPanel
						root={root}
						meta={reportMeta}
						scanning={scanning}
						progress={progress}
						onScan={() => void scan()}
						onStop={stopScan}
						onPick={pickFile}
						onShowFiles={() => setTab("files")}
						onNotify={onNotify}
						reloadKey={reloadKey}
					/>
				</div>
			)}
			{seen.has("files") && (
				<div className="tab-panel" hidden={tab !== "files"}>
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
								root={root}
								firstTop={firstTop}
								selectedRel={node?.rel ?? null}
								onSelect={setSelectedNode}
								onDropFiles={dropFiles}
								onMove={move}
								onNotify={onNotify}
								reloadKey={reloadKey}
							/>
						</aside>

						<Divider spec={panes.divider(0)} />

						<main className="pane">
							{node !== null && node.kind === "file" && row !== null && (
								<FileDetails
									key={`${row.id}-${row.grade}-${row.block}`}
									file={row}
									project={project}
									onSave={async (fields) => {
										await saveFields(row.id, fields);
									}}
								/>
							)}
							{node !== null && node.kind === "file" && (
								<Viewer
									key={`${node.rel}#${openAt?.rel === node.rel ? openAt.page : ""}`}
									root={root}
									node={node}
									startPage={openAt?.rel === node.rel ? openAt.page : undefined}
									onNotify={onNotify}
								/>
							)}
							{row !== null && node !== null && node.kind === "file" && (
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
										root={root}
										project={project}
										onMove={async (fromRel, toRel) => {
											await move(fromRel, toRel);
										}}
										reloadKey={reloadKey}
									/>
								)}
							{node !== null &&
								node.kind === "folder" &&
								node.rel !== "Inbox" && (
									<FolderPanel
										node={node}
										root={root}
										project={project}
										lang={lang}
										reloadKey={reloadKey}
									/>
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
					onOpenCourse={openCourse}
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
	root,
	project,
	lang,
	reloadKey,
}: {
	node: TreeNode;
	root: string;
	project: Project;
	lang: Lang;
	reloadKey: number;
}) {
	const say = useSay();
	const [items, setItems] = useState<TreeNode[]>([]);
	const where = describeFolder(node.rel, project, lang, (key) => say(key));

	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is the trigger — refetch when the folder changed on disk.
	useEffect(() => {
		let alive = true;
		void (async () => {
			const result = await window.studio.listTree(root, node.rel);
			if (alive && result.ok) setItems(result.nodes);
		})();
		return () => {
			alive = false;
		};
	}, [root, node.rel, reloadKey]);

	const files = items.filter((child) => child.kind === "file").length;
	return (
		<div className="folder-panel">
			<h2 dir="auto">{node.name}</h2>
			{where !== null && <p className="muted">{where}</p>}
			<p className="drop-big">{say("project.dropHere")}</p>
			<WindowedList
				count={items.length}
				rowHeight={28}
				className="folder-list"
				itemClassName="folder-item"
				ariaLabel={node.name}
			>
				{(index) => {
					const child = items[index];
					if (child === undefined) return null;
					return (
						<div className="folder-child" dir="auto">
							{child.kind === "folder" ? "📁" : "📄"} {child.name}
						</div>
					);
				}}
			</WindowedList>
			{items.length === 0 && <p className="muted">{say("project.empty")}</p>}
			{files > 0 && (
				<p className="muted">{say("project.files", { n: files })}</p>
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
