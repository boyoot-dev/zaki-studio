// Watching the project folder, so a file the author adds, moves or renames in Windows
// Explorer shows up in the tree without pressing anything. fs.watch with recursive: true is
// supported on Windows and macOS; events arrive in bursts (a copy is many events), so the
// page is told once after a short pause. The watch ends when the app window closes.

import { type FSWatcher, watch } from "node:fs";

/** How long to wait after the last event before telling the page. */
const PAUSE_MS = 350;

/**
 * Tells `onChanged` when anything under `root` changes, at most once per pause. Returns the
 * function that stops watching.
 */
export function watchProject(root: string, onChanged: () => void): () => void {
	let timer: ReturnType<typeof setTimeout> | null = null;
	const poke = () => {
		if (timer !== null) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			onChanged();
		}, PAUSE_MS);
	};
	let watcher: FSWatcher | null = null;
	try {
		watcher = watch(root, { recursive: true }, poke);
		watcher.on("error", () => {
			// A folder that disappears (the author moved the project) simply stops the watch;
			// the page still works, it just won't refresh by itself.
		});
	} catch {
		watcher = null;
	}
	return () => {
		if (timer !== null) clearTimeout(timer);
		try {
			watcher?.close();
		} catch {
			// Already closed.
		}
	};
}
