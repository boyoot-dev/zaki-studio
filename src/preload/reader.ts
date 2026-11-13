// The preload of the hidden reader window (task 156): two calls, one in each direction, and
// nothing else. The window that draws a page gets no file system, no ipcRenderer and no channel
// name of its own: the page hears which page to draw (bytes and a page number) and hands back
// the picture it drew. src/shared/reader.ts holds the pair, and a test holds it to two.

import { contextBridge, ipcRenderer } from "electron";

import { READER_CHANNELS, type ReaderJob, readerApi } from "../shared/reader";

const api = readerApi(
	(listen) => {
		ipcRenderer.on(READER_CHANNELS.page, (_event, job: ReaderJob) =>
			listen(job),
		);
	},
	(png) => {
		ipcRenderer.send(READER_CHANNELS.png, png);
	},
);

contextBridge.exposeInMainWorld("reader", api);
