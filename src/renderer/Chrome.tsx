// Small pieces every screen shares: the language switch, the line at the bottom that says
// what just happened, and the little sign that says what kind of file a row is.

import type { TreeNode } from "../shared/api";
import { LANGUAGE_NAMES, type Lang } from "../shared/i18n";

/** English and Arabic, each in its own script, with the chosen one filled in. */
export function LanguageSwitch({
	lang,
	onChange,
}: {
	lang: Lang;
	onChange: (lang: Lang) => void;
}) {
	return (
		<fieldset className="chips">
			<legend className="sr-only">{LANGUAGE_NAMES[lang]}</legend>
			{(["en", "ar"] as const).map((code) => (
				<button
					key={code}
					type="button"
					className={code === lang ? "chip chip-on" : "chip"}
					aria-pressed={code === lang}
					onClick={() => onChange(code)}
				>
					{LANGUAGE_NAMES[code]}
				</button>
			))}
		</fieldset>
	);
}

/** One line at the bottom of the window: added, moved, renamed, deleted. */
export function Toast({ text }: { text: string | null }) {
	if (text === null) return null;
	return <output className="toast">{text}</output>;
}

/** The sign a file gets in the tree: a page, a picture, a recording, a book. */
export function fileSign(node: TreeNode): string {
	if (node.kind === "folder") return "📁";
	if (node.ext === "pdf") return "📄";
	if (
		["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff", "svg"].includes(
			node.ext,
		)
	)
		return "🖼️";
	if (["mp3", "wav", "m4a", "ogg", "oga", "aac", "flac"].includes(node.ext))
		return "🎧";
	if (node.ext === "docx" || node.ext === "doc") return "📝";
	if (node.ext === "pptx" || node.ext === "ppt") return "📊";
	if (node.ext === "md" || node.ext === "txt") return "🗒️";
	return "📎";
}

/** A file size a person can read: "820 B", "41 KB", "12 MB". */
export function fileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
