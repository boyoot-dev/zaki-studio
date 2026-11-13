// One small dialog for the two things that need a name: renaming a row and starting a new
// unit. Electron has no window.prompt, and a form of our own can be in both languages and
// right to left.

import { useEffect, useRef, useState } from "react";

import { useSay } from "./i18n";

export type PromptSpec = {
	title: string;
	hint?: string;
	/** The text the box starts with. */
	initial: string;
	onConfirm: (value: string) => void;
};

export function Prompt({
	spec,
	onClose,
}: {
	spec: PromptSpec;
	onClose: () => void;
}) {
	const say = useSay();
	const [value, setValue] = useState(spec.initial);
	const box = useRef<HTMLInputElement>(null);

	useEffect(() => {
		box.current?.focus();
		box.current?.select();
	}, []);

	const confirm = () => {
		const trimmed = value.trim();
		if (trimmed === "") return;
		spec.onConfirm(trimmed);
		onClose();
	};

	return (
		<div className="veil">
			<form
				className="dialog"
				aria-modal="true"
				role="dialog"
				aria-label={spec.title}
				onSubmit={(event) => {
					event.preventDefault();
					confirm();
				}}
				onKeyDown={(event) => {
					if (event.key === "Escape") onClose();
				}}
			>
				<h2>{spec.title}</h2>
				{spec.hint !== undefined && <p className="muted">{spec.hint}</p>}
				<input
					ref={box}
					type="text"
					value={value}
					aria-label={spec.title}
					placeholder={say("prompt.placeholder")}
					onChange={(event) => setValue(event.target.value)}
				/>
				<div className="dialog-buttons">
					<button type="button" className="btn btn-quiet" onClick={onClose}>
						{say("common.cancel")}
					</button>
					<button type="submit" className="btn" disabled={value.trim() === ""}>
						{say("common.ok")}
					</button>
				</div>
			</form>
		</div>
	);
}
