// Reading a page's picture with Tesseract, on this computer (task 156, tools/materials/ocr.py).
// The language data, the WASM core and the worker all come from local paths inside the Studio's
// own folder: there is no download, no cache and no network call while a scan runs. The
// language files are fetched once by `npm run tessdata`, which checks each one's SHA-256.
//
// A scan uses at most four workers (one core stays for the window), the same page segmentation
// ocr.py passes (--psm 4), and the subject's teaching language plus English. Results are kept
// as `<page>.ocr.txt` beside the picture, so a scan that is stopped continues where it stopped.

import { existsSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";

/** The language files the Studio reads with, and the SHA-256 each must have. */
export const TESSDATA: Record<string, string> = {
	ara: "ab9d157d8e38ca00e7e39c7d5363a5239e053f5b0dbdb3167dde9d8124335896",
	eng: "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2",
	fra: "907743d98915c91a3906dfbf6e48b97598346698fe53aaa797e1a064ffcac913",
};

/** The language files the Studio reads with, in the order npm run tessdata fetches them. */
export const TESSDATA_LANGS = ["ara", "eng", "fra"] as const;

/** Where the language files live, relative to the Studio folder: ignored by git, not shipped. */
export const TESSDATA_DIR = join("resources", "tessdata");

/** The folder the language files are read from. */
export function tessdataDir(studioRoot: string): string {
	return join(studioRoot, TESSDATA_DIR);
}

/** The languages of a Tesseract language list ("ara+eng") that are not on disk yet. */
export function missingLangs(studioRoot: string, langs: string): string[] {
	return langs
		.split("+")
		.filter((lang) => lang !== "")
		.filter(
			(lang) =>
				!existsSync(join(tessdataDir(studioRoot), `${lang}.traineddata`)),
		);
}

/** The workers a scan uses: at most four, and one core left for the window. */
export function ocrPoolSize(cores: number = cpus().length): number {
	return Math.max(1, Math.min(4, cores - 1));
}

/** What Tesseract is started with. Every path is local: the test below holds that. */
export type OcrOptions = {
	workerPath: string;
	langPath: string;
	corePath: string;
	cachePath: string;
	/** "none": a run never reads or writes a cache, so nothing is kept between scans. */
	cacheMethod: "none";
	/** Our files are the raw .traineddata, not the gzipped ones the CDN serves. */
	gzip: false;
	logger: () => void;
};

/**
 * The options a worker is made with, all pointing inside the Studio's folder: its own copy of
 * Tesseract's worker and WASM core, and the language files `npm run tessdata` put in
 * resources/tessdata. Nothing here names a server, so a scan cannot reach one by accident.
 *
 * The worker is the Studio's own small file (resources/ocr-worker.cjs), which starts Tesseract's
 * worker with its relaxed-SIMD core turned off: the float models the owner uses abort on it
 * (2026-11-13, naptha/tesseract.js#1080).
 */
export function ocrOptions(studioRoot: string): OcrOptions {
	return {
		workerPath: join(studioRoot, "resources", "ocr-worker.cjs"),
		langPath: tessdataDir(studioRoot),
		corePath: join(studioRoot, "node_modules", "tesseract.js-core"),
		cachePath: tessdataDir(studioRoot),
		cacheMethod: "none",
		gzip: false,
		logger: () => {},
	};
}

/** Reading pages: one call per page, and a way to put the workers away. */
export type Ocr = {
	/** The page's text, or "" when Tesseract found none. */
	text(png: Uint8Array, langs: string): Promise<string>;
	/** Puts every worker away; a scan calls it when it ends or is stopped. */
	close(): Promise<void>;
};

type Worker = Awaited<ReturnType<typeof makeWorker>>;

/** One worker, with the subject's languages and the page segmentation ocr.py asks for. */
async function makeWorker(studioRoot: string, langs: string) {
	const { createWorker, OEM, PSM } = await import("tesseract.js");
	const worker = await createWorker(
		langs,
		OEM.LSTM_ONLY,
		ocrOptions(studioRoot),
	);
	await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
	return worker;
}

/** The page's bytes as Tesseract's Node build takes them, without copying them. */
function image(png: Uint8Array): Buffer {
	return Buffer.from(png.buffer, png.byteOffset, png.byteLength);
}

/**
 * A small pool of Tesseract workers. It keeps at most `size` of them alive: an idle worker of
 * the right language is reused, another language is loaded into an idle one, and a page waits
 * for one to come free. `close` ends every worker, which is what a stopped scan does.
 */
export function ocrEngine(studioRoot: string, size = ocrPoolSize()): Ocr {
	const idle = new Map<string, Worker[]>();
	const waiting: (() => void)[] = [];
	let made = 0;
	let closed = false;

	/** Wakes one waiter, if there is one: a worker has just come free. */
	const wake = () => waiting.shift()?.();

	async function take(langs: string): Promise<Worker> {
		const ready = idle.get(langs);
		if (ready !== undefined && ready.length > 0) return ready.pop() as Worker;
		if (made < size) {
			made += 1;
			try {
				return await makeWorker(studioRoot, langs);
			} catch (error) {
				made -= 1;
				throw error;
			}
		}
		// Every worker is busy: wait for one, then take the first free worker of any language.
		await new Promise<void>((resolve) => waiting.push(resolve));
		for (const [key, list] of idle) {
			if (list.length === 0) continue;
			const worker = list.pop() as Worker;
			if (key !== langs) await worker.reinitialize(langs);
			return worker;
		}
		// Nothing was free when the waiter woke (a close, say): make one anyway.
		made += 1;
		return makeWorker(studioRoot, langs);
	}

	return {
		async text(png, langs) {
			if (closed) return "";
			const clean = langs === "" ? "eng" : langs;
			const worker = await take(clean);
			try {
				const result = await worker.recognize(image(png));
				return result.data.text.trim();
			} finally {
				const list = idle.get(clean) ?? [];
				list.push(worker);
				idle.set(clean, list);
				wake();
			}
		},
		async close() {
			closed = true;
			for (const list of idle.values()) {
				for (const worker of list) await worker.terminate().catch(() => {});
				list.length = 0;
			}
			wake();
		},
	};
}

/** The file one page's OCR reading is kept in, beside its picture. */
export function ocrTextFile(pngPath: string): string {
	return pngPath.replace(/\.png$/i, ".ocr.txt");
}
