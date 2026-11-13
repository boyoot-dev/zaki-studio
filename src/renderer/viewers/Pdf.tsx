// A PDF, page by page. pdf.js draws each page onto a canvas, so nothing inside the file is
// ever run as markup or script: the page is a picture we paint. Zoom and the page number are
// the two things a parent needs while checking a sheet against the curriculum.

import {
	AnnotationMode,
	GlobalWorkerOptions,
	getDocument,
	type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState } from "react";

import { useSay } from "../i18n";

// The worker is our own build, served beside the page; pdf.js would otherwise look for one in
// a place that doesn't exist and fall back to the main thread.
GlobalWorkerOptions.workerSrc = workerUrl;

/** The zoom steps the two buttons move between. */
const STEPS = [0.75, 1, 1.25, 1.5, 2, 2.5];
const BASE = 1.4;

export function PdfView({
	bytes,
	startPage = 1,
}: {
	bytes: Uint8Array;
	/** The page to open on: a fact opens the page it came from. */
	startPage?: number;
}) {
	const say = useSay();
	const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
	const [page, setPage] = useState(1);
	const [step, setStep] = useState(1);
	const [failed, setFailed] = useState(false);
	const canvas = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		let alive = true;
		// A copy of the bytes, because pdf.js takes the buffer for its worker and the same
		// file may be shown again. What is left at a safe setting, and why:
		//   - enableXfa: false. An XFA form is markup with script from the document, and the
		//     page never runs anything a file holds.
		//   - isEvalSupported: pdf.js 4.2.67 fixed CVE-2024-4367, where a font program inside a
		//     PDF ran script inside pdf.js. Since v5 the eval path is gone entirely, so this
		//     version (6.4.299) has no isEvalSupported option left to turn off; pdf.test.ts
		//     holds the version above the fix, so a downgrade cannot pass quietly.
		// The worker is our own build, so nothing of the document runs on the page.
		const task = getDocument({ data: bytes.slice(), enableXfa: false });
		task.promise.then(
			(loaded) => {
				if (!alive) {
					void task.destroy();
					return;
				}
				setDoc(loaded);
				setPage(Math.min(Math.max(1, startPage), loaded.numPages));
			},
			() => {
				if (alive) setFailed(true);
			},
		);
		return () => {
			alive = false;
			void task.destroy();
		};
	}, [bytes, startPage]);

	useEffect(() => {
		if (doc === null || canvas.current === null) return;
		let cancelled = false;
		void (async () => {
			const current = await doc.getPage(page);
			if (cancelled) return;
			const target = canvas.current;
			if (target === null) return;
			const viewport = current.getViewport({
				scale: BASE * (STEPS[step] ?? 1),
			});
			const ratio = window.devicePixelRatio === 0 ? 1 : window.devicePixelRatio;
			target.width = Math.floor(viewport.width * ratio);
			target.height = Math.floor(viewport.height * ratio);
			target.style.width = `${Math.floor(viewport.width)}px`;
			target.style.height = `${Math.floor(viewport.height)}px`;
			await current.render({
				canvas: target,
				viewport,
				// A page is painted, never made interactive: no annotation layer is built, so a
				// link or a form field in a PDF is never drawn and never clickable, and nothing
				// the document holds can put a control in front of the author.
				annotationMode: AnnotationMode.DISABLE,
				transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
			}).promise;
		})();
		return () => {
			cancelled = true;
		};
	}, [doc, page, step]);

	if (failed) return <p className="issues">{say("viewer.pdfFailed")}</p>;

	return (
		<div className="pdf-view">
			<div className="pdf-bar">
				<button
					type="button"
					className="btn btn-quiet"
					aria-label={say("viewer.previous")}
					disabled={page <= 1}
					onClick={() => setPage(page - 1)}
				>
					‹
				</button>
				<span className="muted">
					{say("viewer.page", {
						n: page,
						total: doc === null ? 1 : doc.numPages,
					})}
				</span>
				<button
					type="button"
					className="btn btn-quiet"
					aria-label={say("viewer.next")}
					disabled={doc === null || page >= doc.numPages}
					onClick={() => setPage(page + 1)}
				>
					›
				</button>
				<span className="spacer" />
				<button
					type="button"
					className="btn btn-quiet"
					aria-label={say("viewer.zoomOut")}
					disabled={step === 0}
					onClick={() => setStep(Math.max(0, step - 1))}
				>
					−
				</button>
				<button
					type="button"
					className="btn btn-quiet"
					aria-label={say("viewer.zoomIn")}
					disabled={step === STEPS.length - 1}
					onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
				>
					+
				</button>
			</div>
			<div className="pdf-page">
				<canvas ref={canvas} />
			</div>
		</div>
	);
}
