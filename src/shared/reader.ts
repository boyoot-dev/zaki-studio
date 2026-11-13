// The reader window's door to the main process, and nothing else (task 156). The window that
// draws a page is a web page like any other, so it gets no file system and no network: the main
// process hands it one page's bytes and page number, and the page hands back the picture it
// drew. Two calls, one in each direction, and no others. This file is pure so a test can hold
// that promise still, and the preload (src/preload/reader.ts) only wires the two to Electron.

/** One page to draw: the file's bytes, its page number from 1, and how big to draw it. */
export type ReaderJob = {
	bytes: Uint8Array;
	page: number;
	/** 1 means 72 DPI, which is what pdf.js calls a scale of 1. */
	scale: number;
};

/** The two channels the reader window's preload uses, and only these. */
export const READER_CHANNELS = {
	/** Main → page: the page to draw. */
	page: "studio:readerPage",
	/** Page → main: the picture, as PNG bytes. */
	png: "studio:readerPng",
} as const;

/** The resolution a page is drawn at (task 156): enough for small print, as ocr.py reads at. */
export const READER_DPI = 110;

/** pdf.js's scale for that resolution: a scale of 1 is 72 DPI. */
export const READER_SCALE = READER_DPI / 72;

/** What the reader page may call on `window.reader`: exactly two functions. */
export type ReaderApi = {
	/** Hear which page to draw. Called once; the page then answers each job with show(). */
	onPage(callback: (job: ReaderJob) => void): void;
	/** Hand the picture back. Anything that is not bytes is dropped, not sent. */
	show(png: Uint8Array): void;
};

/** The pages this reader ever draws: a page number from 1, and a scale a page can have. */
const PAGES = 9999;
const SCALES = { min: 0.1, max: 10 };

/** A number clamped into a range, or the lowest value for anything that isn't a number. */
function clamp(value: unknown, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, value));
}

/** A job as the page may use it: bytes and two numbers, with nothing else carried along. */
function cleanJob(value: unknown): ReaderJob {
	const raw = (
		typeof value === "object" && value !== null ? value : {}
	) as Record<string, unknown>;
	return {
		bytes: raw.bytes instanceof Uint8Array ? raw.bytes : new Uint8Array(),
		page: Math.round(clamp(raw.page, 1, PAGES)),
		scale: clamp(raw.scale, SCALES.min, SCALES.max),
	};
}

/**
 * The reader page's two calls, over the two things the preload can do: listen on a channel, and
 * send on one. Nothing else reaches the page, and no call can name a channel of its own.
 */
export function readerApi(
	listen: (callback: (job: ReaderJob) => void) => void,
	send: (png: Uint8Array) => void,
): ReaderApi {
	return {
		onPage(callback) {
			if (typeof callback !== "function") return;
			listen((job) => callback(cleanJob(job)));
		},
		show(png) {
			if (!(png instanceof Uint8Array) || png.length === 0) return;
			send(png);
		},
	};
}

/** The page's side of the wire, as the site's own types need it. */
export type ReaderWindow = { reader: ReaderApi };
