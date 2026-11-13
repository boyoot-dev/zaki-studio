// The project window's left side: the tree, and the three actions that change it. A folder
// row is a drop target (files from Explorer, or a row dragged from inside), so the author
// never has to find a menu to put something in its place.

import { useState } from "react";

import type { TreeNode } from "../shared/api";
import { fileSign } from "./Chrome";
import { useSay } from "./i18n";

export type Selection = { rel: string; kind: "folder" | "file" } | null;

/** The Inbox stays open at the top: it is where the author starts. */
const OPEN_AT_FIRST = new Set(["Inbox"]);

export function Tree({
	nodes,
	selected,
	onSelect,
	onDropFiles,
	onMove,
}: {
	nodes: TreeNode[];
	selected: Selection;
	onSelect: (selection: Selection) => void;
	onDropFiles: (targetRel: string, files: File[]) => Promise<void>;
	onMove: (fromRel: string, toRel: string) => Promise<void>;
}) {
	const [open, setOpen] = useState<Set<string>>(() => new Set(OPEN_AT_FIRST));

	const toggle = (rel: string) => {
		setOpen((current) => {
			const next = new Set(current);
			if (next.has(rel)) next.delete(rel);
			else next.add(rel);
			return next;
		});
	};

	return (
		<div className="tree" role="tree">
			{nodes.map((node) => (
				<Row
					key={node.rel}
					node={node}
					depth={0}
					open={open}
					onToggle={toggle}
					selected={selected}
					onSelect={onSelect}
					onDropFiles={onDropFiles}
					onMove={onMove}
				/>
			))}
		</div>
	);
}

function Row({
	node,
	depth,
	open,
	onToggle,
	selected,
	onSelect,
	onDropFiles,
	onMove,
}: {
	node: TreeNode;
	depth: number;
	open: Set<string>;
	onToggle: (rel: string) => void;
	selected: Selection;
	onSelect: (selection: Selection) => void;
	onDropFiles: (targetRel: string, files: File[]) => Promise<void>;
	onMove: (fromRel: string, toRel: string) => Promise<void>;
}) {
	const say = useSay();
	const [over, setOver] = useState(false);
	const isOpen = open.has(node.rel);
	const isSelected = selected?.rel === node.rel;
	const isFolder = node.kind === "folder";
	const files = node.children.filter((child) => child.kind === "file").length;

	return (
		<div className="tree-group">
			<div
				role="treeitem"
				tabIndex={0}
				aria-selected={isSelected}
				aria-expanded={isFolder ? isOpen : undefined}
				className={[
					"row",
					isFolder ? "row-folder" : "row-file",
					isSelected ? "row-on" : "",
					over ? "row-over" : "",
				]
					.filter((part) => part !== "")
					.join(" ")}
				style={{ paddingInlineStart: `${depth * 14 + 8}px` }}
				draggable={depth > 0}
				onClick={() => onSelect({ rel: node.rel, kind: node.kind })}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onSelect({ rel: node.rel, kind: node.kind });
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
				{node.rel === "Inbox" && node.children.length > 0 && (
					<span
						className="badge"
						title={say("project.inboxCount", { n: node.children.length })}
					>
						{node.children.length}
					</span>
				)}
				{isFolder && !isOpen && files > 0 && (
					<span className="row-count">
						{say("project.files", { n: files })}
					</span>
				)}
			</div>
			{isFolder && isOpen && node.children.length > 0 && (
				<div className="tree-children">
					{node.children.map((child) => (
						<Row
							key={child.rel}
							node={child}
							depth={depth + 1}
							open={open}
							onToggle={onToggle}
							selected={selected}
							onSelect={onSelect}
							onDropFiles={onDropFiles}
							onMove={onMove}
						/>
					))}
				</div>
			)}
		</div>
	);
}
