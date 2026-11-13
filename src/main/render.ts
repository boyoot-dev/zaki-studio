// The window that draws a page into a picture (task 156). Only a browser can paint a PDF page
// without a canvas library, so the main process opens a hidden window for it: sandboxed,
// isolated, with no Node, the same strict policy as the app's own page, no network, and a
// preload with exactly two calls (src/shared/reader.ts). The window never sees a path: it is
// handed a file's bytes and a page number, and it hands back a PNG. The main process checks
// that picture (src/shared/png.ts) before anything is written to disk.
//
// Pages are drawn one at a time: one window, one picture, so a big book cannot fill the memory.

import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";

import { pngProblem } from "../shared/png";
import {
	READER_CHANNELS,
	READER_SCALE,
	type ReaderJob,
} from "../shared/reader";
import { WEB_PREFERENCES } from "./window";

/** How long one page may take before the scan gives up on it. */
export const RENDER_TIMEOUT_MS = 60_000;

/** Drawing pages: one call per page, and a way to close the window when a scan ends. */
export type PageRenderer = {
	/** The page's picture as PNG bytes; fails when the reader could not draw it. */
	render(bytes: Uint8Array, page: number): Promise<Uint8Array>;
	/** Closes the window. */
	close(): void;
};

/** The hidden window, once it is drawn for the first time. */
let window: BrowserWindow | null = null;
/** The page waiting for its picture, by the window that should answer. */
const waiting = new Map<number, (png: Uint8Array) => void>();
/** One page at a time: each draw waits for the one before it. */
let queue: Promise<unknown> = Promise.resolve();

/** True when the app runs from its dev server, as main/index.ts decides it. */
function isDev(): boolean {
	return !app.isPackaged && (process.env.ELECTRON_RENDERER_URL ?? "") !== "";
}

/** The page in the reader window, where the build put it. */
function readerPage(): { url: string } | { file: string } {
	const server = process.env.ELECTRON_RENDERER_URL ?? "";
	if (isDev() && server !== "") return { url: `${server}/reader.html` };
	return { file: join(__dirname, "../renderer/reader.html") };
}

/** Opens the hidden reader window, with the page's policy and the two-call preload. */
async function openReader(): Promise<BrowserWindow> {
	if (window !== null && !window.isDestroyed()) return window;
	const made = new BrowserWindow({
		show: false,
		width: 900,
		height: 1200,
		webPreferences: {
			...WEB_PREFERENCES,
			preload: join(__dirname, "../preload/reader.cjs"),
			// A hidden window is never focused, and Chromium slows a page nobody looks at;
			// a page that is drawing must not be slowed.
			backgroundThrottling: false,
		},
	});
	window = made;
	made.on("closed", () => {
		if (window === made) window = null;
	});
	const page = readerPage();
	if ("url" in page) await made.loadURL(page.url);
	else await made.loadFile(page.file);
	return made;
}

/** Puts a picture in the hands of the page that is waiting for it. */
function answer(event: Electron.IpcMainEvent, png: unknown): void {
	const resolve = waiting.get(event.sender.id);
	if (resolve === undefined) return;
	if (!(png instanceof Uint8Array) || png.length === 0) return;
	waiting.delete(event.sender.id);
	resolve(png);
}

let listening = false;

/** Registers the one channel the reader page answers on. */
function listen(): void {
	if (listening) return;
	listening = true;
	ipcMain.on(READER_CHANNELS.png, answer);
}

/**
 * A renderer for one scan: it opens the hidden window when the first page is drawn, draws each
 * page one after another, and refuses a picture that is not a page-sized PNG.
 */
export function openRenderer(): PageRenderer {
	listen();
	let closed = false;
	return {
		async render(bytes, page) {
			if (closed) throw new Error("the reader is closed");
			const draw = async (): Promise<Uint8Array> => {
				const reader = await openReader();
				const contents = reader.webContents;
				if (contents.isDestroyed())
					throw new Error("the reader window is gone");
				const job: ReaderJob = { bytes, page, scale: READER_SCALE };
				const png = await new Promise<Uint8Array>((resolve, reject) => {
					const timer = setTimeout(() => {
						waiting.delete(contents.id);
						reject(new Error("the page took too long to draw"));
					}, RENDER_TIMEOUT_MS);
					waiting.set(contents.id, (picture) => {
						clearTimeout(timer);
						resolve(picture);
					});
					contents.send(READER_CHANNELS.page, job);
				});
				const problem = pngProblem(png);
				if (problem !== "")
					throw new Error(`the page was not drawn (${problem})`);
				return png;
			};
			const next = queue.then(draw, draw);
			queue = next.catch(() => {});
			return next;
		},
		close() {
			closed = true;
			waiting.clear();
			if (window !== null && !window.isDestroyed()) window.destroy();
			window = null;
		},
	};
}
