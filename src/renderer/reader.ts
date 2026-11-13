// The hidden window's page (task 156): it draws one PDF page into a picture and hands it back.
// It is a web page with no Node and no network, and its only door is window.reader's two calls.
// Nothing of the document runs: the page is painted onto a canvas, and no annotation layer or
// form is built (the same settings as the app's own PDF viewer).

import { AnnotationMode, GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { READER_SCALE, type ReaderJob } from "../shared/reader";

// Our own build of pdf.js's worker, served beside the page.
GlobalWorkerOptions.workerSrc = workerUrl;

/** Draws one page and returns its PNG bytes; empty bytes mean it could not be drawn. */
async function draw(job: ReaderJob): Promise<Uint8Array> {
	const task = getDocument({
		data: job.bytes.slice(),
		enableXfa: false,
		verbosity: 0,
	});
	try {
		const doc = await task.promise;
		const number = Math.min(Math.max(1, Math.round(job.page)), doc.numPages);
		const page = await doc.getPage(number);
		const viewport = page.getViewport({ scale: READER_SCALE });
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.floor(viewport.width));
		canvas.height = Math.max(1, Math.floor(viewport.height));
		await page.render({
			canvas,
			viewport,
			annotationMode: AnnotationMode.DISABLE,
		}).promise;
		const blob = await new Promise<Blob | null>((done) =>
			canvas.toBlob(done, "image/png"),
		);
		if (blob === null) return new Uint8Array();
		return new Uint8Array(await blob.arrayBuffer());
	} finally {
		void task.destroy();
	}
}

window.reader.onPage((job) => {
	void draw(job).then(
		(png) => window.reader.show(png),
		() => window.reader.show(new Uint8Array()),
	);
});
