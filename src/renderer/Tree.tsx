// The project window's left side: the tree, and the three actions that change it. Folders
// load one level at a time from the main process (task 168), and the rows draw only what is
// on screen, so a full school's tree stays quick. A folder row is a drop target (files from
// Explorer, or a row dragged from inside), so the author never has to find a menu to put
// something in its place.

import { memo, useCallback, useEffect, useMemo, useState } from "react";

import type { TreeNode } from "../shared/api.ts";
import { failureText } from "./App";
import { fileSign } from "./Chrome";
import { useLang, useSay } from "./i18n";
import { WindowedList } from "./WindowedList";

/** The Inbox stays open at the top: it is where the author starts. */
const OPEN_AT_FIRST = new Set(["Inbox"]);
/** The height of one row, in pixels, as the windowed list places them. */
export const TREE_ROW_HEIGHT = 32;

export type Selection = { rel: string; kind: "folder" | "file" } | null;

export function Tree({
	root,
	firstTop,
	selectedRel,
	onSelect,
	onDropFiles,
	onMove,
	onNotify,
	reloadKey,
}: {
	root: string;
	/** The top level from opening the project; deeper levels load on expand. */
	firstTop: TreeNode[];
	/** The selected row's path, or null when nothing is selected. */
	selectedRel: string | null;
	onSelect: (node: TreeNode) => void;
	onDropFiles: (targetRel: string, files: File[]) => Promise<void>;
	onMove: (fromRel: string, toRel: string) => Promise<void>;
	onNotify: (text: string) => void;
	/** Bumped when the folder changed on disk; the whole tree is re-read. */
	reloadKey: number;
}) {
	const say = useSay();
	const lang = useLang();
	// The loaded children of every folder that has been opened: "" is the top.
	const [levels, setLevels] = useState<Map<string, TreeNode[]>>(
		() => new Map([["", firstTop]]),
	);
	const [open, setOpen] = useState<Set<string>>(() => new Set(OPEN_AT_FIRST));

	// A change anywhere: everything is re-read from the top, like the old full reload.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is the trigger — re-read when the folder changed on disk.
	useEffect(() => {
		let alive = true;
		void (async () => {
			const result = await window.studio.listTree(root, "");
			if (!alive) return;
			if (!result.ok) {
				onNotify(failureText(lang, result));
				return;
			}
			setLevels(new Map([["", result.nodes]]));
		})();
		return () => {
			alive = false;
		};
	}, [root, reloadKey, lang, onNotify]);

	/** Reads one folder's level the first time it is opened, and keeps it afterwards. */
	const loadLevel = useCallback(
		(rel: string) => {
			void (async () => {
				const result = await window.studio.listTree(root, rel);
				if (!result.ok) {
					onNotify(failureText(lang, result));
					return;
				}
				setLevels((current) => new Map(current).set(rel, result.nodes));
			})();
		},
		[lang, onNotify, root],
	);

	const toggle = useCallback(
		(rel: string) => {
			setOpen((current) => {
				const next = new Set(current);
				if (next.has(rel)) next.delete(rel);
				else next.add(rel);
				return next;
			});
			// Opening a folder we have never opened loads its level first.
			if (!levels.has(rel)) loadLevel(rel);
		},
		[levels, loadLevel],
	);

	// The flattened, visible rows: top level, then whatever is open below it.
	const visible = useMemo(() => {
		const rows: { node: TreeNode; depth: number }[] = [];
		const walk = (nodes: readonly TreeNode[], depth: number) => {
			for (const node of nodes) {
				rows.push({ node, depth });
				if (node.kind !== "folder" || !open.has(node.rel)) continue;
				const children = levels.get(node.rel);
				if (children !== undefined) walk(children, depth + 1);
			}
		};
		walk(levels.get("") ?? [], 0);
		return rows;
	}, [levels, open]);

	return (
		<WindowedList
			count={visible.length}
			rowHeight={TREE_ROW_HEIGHT}
			className="tree"
			listRole="tree"
			ariaLabel={say("project.tab.files")}
			itemClassName="tree-item"
		>
			{(index) => {
				const row = visible[index];
				if (row === undefined) return null;
				return (
					<Row
						node={row.node}
						depth={row.depth}
						isOpen={open.has(row.node.rel)}
						isSelected={selectedRel === row.node.rel}
						setSize={visible.length}
						posInSet={index + 1}
						onToggle={toggle}
						onSelect={onSelect}
						onDropFiles={onDropFiles}
						onMove={onMove}
					/>
				);
			}}
		</WindowedList>
	);
}

/** One row of the tree: a folder to open, or a file to select. */
const Row = memo(function Row({
	node,
	depth,
	isOpen,
	isSelected,
	setSize,
	posInSet,
	onToggle,
	onSelect,
	onDropFiles,
	onMove,
}: {
	node: TreeNode;
	depth: number;
	isOpen: boolean;
	isSelected: boolean;
	setSize: number;
	posInSet: number;
	onToggle: (rel: string) => void;
	onSelect: (node: TreeNode) => void;
	onDropFiles: (targetRel: string, files: File[]) => Promise<void>;
	onMove: (fromRel: string, toRel: string) => Promise<void>;
}) {
	const say = useSay();
	const [over, setOver] = useState(false);
	const isFolder = node.kind === "folder";

	return (
		<div
			role="treeitem"
			tabIndex={0}
			aria-selected={isSelected}
			aria-expanded={isFolder ? isOpen : undefined}
			aria-setsize={setSize}
			aria-posinset={posInSet}
			className={[
				"row",
				"tree-row",
				isFolder ? "row-folder" : "row-file",
				isSelected ? "row-on" : "",
				over ? "row-over" : "",
			]
				.filter((part) => part !== "")
				.join(" ")}
			style={{ paddingInlineStart: `${depth * 14 + 8}px` }}
			draggable={depth > 0}
			onClick={() => onSelect(node)}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onSelect(node);
				}
			}}
			onDragStart={(event) => {
				event.dataTransfer.setData("application/x-studio-rel", node.rel);
				event.dataTransfer.effectAllowed = "move";
			}}
			onDragOver={(event) => {
				if (!isFolder) return;
				event.preventDefault();
				event.dataTransfer.dropEffect = "copy";
				setOver(true);
			}}
			onDragLeave={() => setOver(false)}
			onDrop={(event) => {
				if (!isFolder) return;
				event.preventDefault();
				event.stopPropagation();
				setOver(false);
				const from = event.dataTransfer.getData("application/x-studio-rel");
				const dropped = Array.from(event.dataTransfer.files);
				if (from !== "") void onMove(from, node.rel);
				else if (dropped.length > 0) void onDropFiles(node.rel, dropped);
			}}
		>
			{isFolder ? (
				<button
					type="button"
					className="twisty"
					aria-label={node.name}
					aria-expanded={isOpen}
					onClick={(event) => {
						event.stopPropagation();
						onToggle(node.rel);
					}}
				>
					{isOpen ? "▾" : "▸"}
				</button>
			) : (
				<span className="twisty" />
			)}
			<span className="row-sign" aria-hidden="true">
				{fileSign(node)}
			</span>
			<span className="row-name" dir="auto">
				{node.name}
			</span>
			{node.rel === "Inbox" && node.files > 0 && (
				<span
					className="badge"
					title={say("project.inboxCount", { n: node.files })}
				>
					{node.files}
				</span>
			)}
			{isFolder && !isOpen && node.files > 0 && (
				<span className="row-count">
					{say("project.files", {
						n: node.files,
					})}
				</span>
			)}
		</div>
	);
});
