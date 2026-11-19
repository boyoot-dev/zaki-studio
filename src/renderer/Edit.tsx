// The small pieces the Curriculum tab edits with (task 247): a text with a pencil that turns
// into a field with Save and Cancel, a "⋯" menu of moves and Delete (Delete asks once), and an
// "+ Add …" line that opens a field. They know nothing about the course: each calls back with
// the text, and the tab sends the edit.

import { type ReactNode, useRef, useState } from "react";

import { useSay } from "./i18n";

/** A text the author can edit in place. `onSave` says whether the edit was made. */
export function EditableText({
	value,
	multiline = false,
	onSave,
	children,
}: {
	value: string;
	multiline?: boolean;
	onSave: (text: string) => Promise<boolean>;
	children: ReactNode;
}) {
	const say = useSay();
	const [editing, setEditing] = useState(false);
	const [text, setText] = useState(value);
	const [saving, setSaving] = useState(false);

	if (!editing)
		return (
			<div className="editable">
				<div className="editable-text">{children}</div>
				<button
					type="button"
					className="edit-pencil"
					title={say("edit.edit")}
					aria-label={say("edit.edit")}
					onClick={() => {
						setText(value);
						setEditing(true);
					}}
				>
					✎
				</button>
			</div>
		);

	const save = async () => {
		setSaving(true);
		try {
			if (await onSave(text.trim())) setEditing(false);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="edit-field">
			{multiline ? (
				<textarea
					value={text}
					dir="auto"
					rows={3}
					onChange={(event) => setText(event.target.value)}
				/>
			) : (
				<input
					type="text"
					value={text}
					dir="auto"
					onChange={(event) => setText(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") void save();
						if (event.key === "Escape") setEditing(false);
					}}
				/>
			)}
			<div className="notes-row">
				<button
					type="button"
					className="btn"
					disabled={saving || text.trim() === ""}
					onClick={() => void save()}
				>
					{say("edit.save")}
				</button>
				<button
					type="button"
					className="btn btn-quiet"
					onClick={() => setEditing(false)}
				>
					{say("edit.cancel")}
				</button>
			</div>
		</div>
	);
}

/** One action of an item's menu. A `confirm` text asks once before it runs. */
export type MenuAction = {
	label: string;
	run: () => void;
	danger?: boolean;
	confirm?: string;
};

/** A small "⋯" menu of moves and Delete for one item. */
export function ItemMenu({ actions }: { actions: MenuAction[] }) {
	const say = useSay();
	const ref = useRef<HTMLDetailsElement>(null);
	if (actions.length === 0) return null;
	return (
		<details className="item-menu" ref={ref}>
			<summary aria-label={say("edit.more")} title={say("edit.more")}>
				⋯
			</summary>
			<div className="item-menu-list">
				{actions.map((action) => (
					<button
						key={action.label}
						type="button"
						className={
							action.danger === true ? "btn-quiet btn-danger" : "btn-quiet"
						}
						onClick={() => {
							if (ref.current !== null) ref.current.open = false;
							if (
								action.confirm !== undefined &&
								!window.confirm(action.confirm)
							)
								return;
							action.run();
						}}
					>
						{action.label}
					</button>
				))}
			</div>
		</details>
	);
}

/** "+ Add …": a quiet button that opens a field; `extra` sits beside the field (a select). */
export function AddLine({
	label,
	multiline = false,
	extra,
	hint,
	onAdd,
}: {
	label: string;
	multiline?: boolean;
	extra?: ReactNode;
	/** A short line under the field, e.g. "One per line: each line is one fact." */
	hint?: string;
	onAdd: (text: string) => Promise<boolean>;
}) {
	const say = useSay();
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");
	const [saving, setSaving] = useState(false);

	if (!open)
		return (
			<button
				type="button"
				className="link-button add-line"
				onClick={() => {
					setText("");
					setOpen(true);
				}}
			>
				{label}
			</button>
		);

	const add = async () => {
		setSaving(true);
		try {
			if (await onAdd(text.trim())) setOpen(false);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="edit-field">
			{multiline ? (
				<textarea
					value={text}
					dir="auto"
					rows={3}
					onChange={(event) => setText(event.target.value)}
				/>
			) : (
				<input
					type="text"
					value={text}
					dir="auto"
					onChange={(event) => setText(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") void add();
						if (event.key === "Escape") setOpen(false);
					}}
				/>
			)}
			{hint !== undefined && <p className="muted small">{hint}</p>}
			{extra}
			<div className="notes-row">
				<button
					type="button"
					className="btn"
					disabled={saving || text.trim() === ""}
					onClick={() => void add()}
				>
					{say("edit.save")}
				</button>
				<button
					type="button"
					className="btn btn-quiet"
					onClick={() => setOpen(false)}
				>
					{say("edit.cancel")}
				</button>
			</div>
		</div>
	);
}
