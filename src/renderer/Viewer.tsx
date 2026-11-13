// The right side: the file the author chose, shown as the file itself. Each kind has its own
// viewer, and anything without one says what the file is and offers to open it in the app
// Windows has for it — with the author's yes first, because that other app runs the file.

import { useEffect, useState } from "react";

import type { Failure, TreeNode } from "../shared/api";
import { failureText } from "./App";
import { fileSize } from "./Chrome";
import { useLang, useSay } from "./i18n";
import { PdfView } from "./viewers/Pdf";

/** What a viewer needs: the file's bytes, its text, or nothing but its name. */
type Loaded =
	| { kind: "loading" }
	| { kind: "bytes"; name: string; bytes: Uint8Array }
	| { kind: "text"; name: string; text: string; note?: "word" }
	| { kind: "other" }
	| { kind: "failure"; failure: Failure };

/** The extensions each viewer takes. */
const IMAGES = [
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"bmp",
	"svg",
	"tif",
	"tiff",
];
const AUDIO = ["mp3", "wav", "m4a", "ogg", "oga", "aac", "flac"];
const TEXTS = ["txt", "md", "csv", "json", "tex", "rtf"];

export function Viewer({
	root,
	node,
	onNotify,
	startPage,
	subtitle,
	pageText,
}: {
	root: string;
	node: TreeNode;
	onNotify: (text: string) => void;
	/** The page a PDF opens on: a fact opens the page it came from. */
	startPage?: number;
	/** A line under the file's name, when the curriculum says where the file came from. */
	subtitle?: string;
	/** The page's text, under a file that has no page of its own to show. */
	pageText?: string;
}) {
	const say = useSay();
	const lang = useLang();
	const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });

	useEffect(() => {
		let alive = true;
		setLoaded({ kind: "loading" });
		const load = async () => {
			const ext = node.ext;
			if (ext === "pdf" || IMAGES.includes(ext) || AUDIO.includes(ext)) {
				const result = await window.studio.readFile(root, node.rel);
				if (!alive) return;
				setLoaded(
					result.ok
						? { kind: "bytes", name: result.name, bytes: result.bytes }
						: { kind: "failure", failure: result },
				);
			} else if (ext === "docx") {
				const result = await window.studio.readWord(root, node.rel);
				if (!alive) return;
				setLoaded(
					result.ok
						? {
								kind: "text",
								name: result.name,
								text: result.text,
								note: "word",
							}
						: { kind: "failure", failure: result },
				);
			} else if (TEXTS.includes(ext)) {
				const result = await window.studio.readText(root, node.rel);
				if (!alive) return;
				setLoaded(
					result.ok
						? { kind: "text", name: result.name, text: result.text }
						: { kind: "failure", failure: result },
				);
			} else {
				setLoaded({ kind: "other" });
			}
		};
		void load();
		return () => {
			alive = false;
		};
	}, [root, node.rel, node.ext]);

	const openInApp = async () => {
		const result = await window.studio.openInApp(root, node.rel);
		if (!result.ok) onNotify(failureText(lang, result));
	};

	return (
		<div className="viewer">
			<header className="viewer-head">
				<div>
					<h2 dir="auto">{node.name}</h2>
					<p className="muted">
						{subtitle ?? `${node.rel} · ${fileSize(node.size)}`}
					</p>
				</div>
				<button
					type="button"
					className="btn btn-quiet"
					onClick={() => void openInApp()}
				>
					{say("viewer.openInApp")}
				</button>
			</header>

			<div className="viewer-body">
				{loaded.kind === "loading" && (
					<p className="muted">{say("viewer.loading")}</p>
				)}
				{loaded.kind === "failure" && (
					<p className="issues">{failureText(lang, loaded.failure)}</p>
				)}
				{loaded.kind === "bytes" && node.ext === "pdf" && (
					<PdfView bytes={loaded.bytes} startPage={startPage} />
				)}
				{loaded.kind === "bytes" && IMAGES.includes(node.ext) && (
					<ImageView bytes={loaded.bytes} name={loaded.name} />
				)}
				{loaded.kind === "bytes" && AUDIO.includes(node.ext) && (
					<AudioView bytes={loaded.bytes} name={loaded.name} />
				)}
				{loaded.kind === "text" && (
					<div className="text-view">
						{loaded.note === "word" && (
							<p className="muted">{say("viewer.wordNote")}</p>
						)}
						<pre dir="auto">
							{loaded.text === "" ? say("viewer.noText") : loaded.text}
						</pre>
					</div>
				)}
				{loaded.kind === "other" && (
					<div className="other-view">
						<p className="muted">{say("viewer.openHint")}</p>
						<p>
							{node.name} · {fileSize(node.size)}
						</p>
					</div>
				)}
				{pageText !== undefined && node.ext !== "pdf" && (
					<div className="page-text">
						<h3>{say("curriculum.pageText")}</h3>
						<pre dir="auto">
							{pageText === "" ? say("curriculum.noPageText") : pageText}
						</pre>
					</div>
				)}
			</div>
		</div>
	);
}

/** A picture, straight from its bytes: a blob of our own, never a path. */
function ImageView({ bytes, name }: { bytes: Uint8Array; name: string }) {
	const [url, setUrl] = useState<string | null>(null);

	useEffect(() => {
		const blob = new Blob([new Uint8Array(bytes)], { type: mimeOf(name) });
		const next = URL.createObjectURL(blob);
		setUrl(next);
		return () => URL.revokeObjectURL(next);
	}, [bytes, name]);

	if (url === null) return null;
	return (
		<figure className="image-view">
			<img src={url} alt={name} />
		</figure>
	);
}

/** A recording, with the player the window has, and no transcript yet (local reading comes later). */
function AudioView({ bytes, name }: { bytes: Uint8Array; name: string }) {
	const say = useSay();
	const [url, setUrl] = useState<string | null>(null);

	useEffect(() => {
		const blob = new Blob([new Uint8Array(bytes)], { type: mimeOf(name) });
		const next = URL.createObjectURL(blob);
		setUrl(next);
		return () => URL.revokeObjectURL(next);
	}, [bytes, name]);

	if (url === null) return null;
	return (
		<div className="audio-view">
			<p className="muted">{say("viewer.audio")}</p>
			{/* biome-ignore lint/a11y/useMediaCaption: a recording carries no caption track yet;
			    local transcription and its text come with task 151's later siblings (STUDIO.md). */}
			<audio controls preload="metadata" src={url} />
		</div>
	);
}

/** The type a picture reports to the browser, from its extension. */
function mimeOf(name: string): string {
	const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
	if (ext === "png") return "image/png";
	if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
	if (ext === "gif") return "image/gif";
	if (ext === "webp") return "image/webp";
	if (ext === "bmp") return "image/bmp";
	if (ext === "svg") return "image/svg+xml";
	if (ext === "tif" || ext === "tiff") return "image/tiff";
	if (ext === "mp3") return "audio/mpeg";
	if (ext === "wav") return "audio/wav";
	if (ext === "m4a") return "audio/mp4";
	if (ext === "ogg" || ext === "oga") return "audio/ogg";
	if (ext === "aac") return "audio/aac";
	if (ext === "flac") return "audio/flac";
	return "application/octet-stream";
}
