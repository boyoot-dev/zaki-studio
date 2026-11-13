// Which folders the page may treat as a project. The page shows files the author brought in
// from anywhere, so it is assumed a script could one day run inside it: if the page could name
// its own project root, it could name "C:\" and list, overwrite, move or delete the whole disk.
// So the main process keeps the list. A folder joins it only when the author picked it in the
// native dialog, or when it is one the author opened before (the recents file, which the main
// process writes itself, and only for folders granted that way). The decision is pure and
// tested here; ipc.ts keeps one list per window and asks this before every channel.

import { realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

/** A path with no trailing separator, a drive root keeping its own, in Windows' case. */
function tidy(path: string): string {
	const cut = resolve(path).replace(/[\\/]+$/, "");
	const kept = /^[A-Za-z]:$/.test(cut) ? `${cut}${sep}` : cut;
	return process.platform === "win32" ? kept.toLowerCase() : kept;
}

/**
 * A folder as the main process compares it: its real path (through every link), with no
 * trailing separator, in the case Windows ignores. Null when it is not a folder on disk.
 */
export function canonicalRoot(path: string): string | null {
	if (typeof path !== "string" || path.trim() === "") return null;
	const absolute = resolve(path);
	try {
		if (!statSync(absolute).isDirectory()) return null;
		return tidy(realpathSync.native(absolute));
	} catch {
		return null;
	}
}

/**
 * True when two paths name the same folder: by their real path when both are on disk (so a
 * junction to the folder counts), and by the plain path otherwise (a folder opened before and
 * deleted since is still the one the author picked, even though nothing can be granted).
 */
export function sameFolder(a: string, b: string): boolean {
	if (typeof a !== "string" || typeof b !== "string") return false;
	if (a.trim() === "" || b.trim() === "") return false;
	const realA = canonicalRoot(a);
	const realB = canonicalRoot(b);
	if (realA !== null && realB !== null) return realA === realB;
	return tidy(a) === tidy(b);
}

/**
 * The granted folder that `root` really is, or null when the main process never granted it.
 * A trailing slash, a path with "..", another case and a junction to a granted folder all
 * find the same folder; a subfolder, another folder or the whole disk never does.
 */
export function grantedRoot(
	granted: readonly string[],
	root: string,
): string | null {
	for (const entry of granted) {
		if (sameFolder(entry, root)) return entry;
	}
	return null;
}
