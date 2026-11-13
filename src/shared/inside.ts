// The one guard every file operation goes through. The renderer is a web page: it can ask
// for any path, including "../../Windows/System32". insideProject answers whether a path is
// inside the project folder, after both the project and the path are resolved to their real
// location, so `..`, absolute paths, and symlinks or Windows junctions that lead out are all
// refused. It is pure with respect to Electron (node:fs only), so it is tested directly.

import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

/** True when the path or folder really exists on disk. */
function exists(path: string): boolean {
	try {
		lstatSync(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * The real location of a path that may not exist yet: the deepest part that does exist is
 * resolved (following every link), and the rest is added back as written.
 */
function realPath(path: string): string | null {
	let head = path;
	const rest: string[] = [];
	while (!exists(head)) {
		const cut = Math.max(head.lastIndexOf("/"), head.lastIndexOf("\\"));
		if (cut <= 0) return null;
		rest.unshift(head.slice(cut + 1));
		head = head.slice(0, cut);
		// A drive that isn't there ("Z:") has nowhere left to go.
		if (/^[A-Za-z]:$/.test(head)) return null;
	}
	try {
		const real = realpathSync.native(head);
		return rest.length === 0 ? real : resolve(real, ...rest);
	} catch {
		return null;
	}
}

/** True when `rel` is "" or a path that goes down from its start, never up. */
function staysInside(rel: string): boolean {
	if (rel === "" || rel === ".") return true;
	if (isAbsolute(rel)) return false;
	const first = rel.split(/[\\/]/)[0];
	return first !== "..";
}

/**
 * True when `path` (absolute, or relative to `root`) stays inside the project folder
 * `root`. Both are resolved through every link, so a junction to another folder is outside.
 */
export function insideProject(root: string, path: string): boolean {
	if (typeof root !== "string" || typeof path !== "string") return false;
	if (root.trim() === "" || path.trim() === "") return false;
	const realRoot = realPath(resolve(root));
	if (realRoot === null) return false;
	const wanted = isAbsolute(path) ? resolve(path) : resolve(realRoot, path);
	const real = realPath(wanted);
	// A path that doesn't exist yet is checked by its deepest existing folder, so the answer
	// for "Grade 7/Science/New unit" is the one for "Grade 7/Science".
	if (real === null) return false;
	const rel = relative(realRoot, real);
	return staysInside(rel);
}

/** True when `path` is the project folder itself rather than something inside it. */
export function isProjectRoot(root: string, path: string): boolean {
	const realRoot = realPath(resolve(root));
	if (realRoot === null) return false;
	const wanted = isAbsolute(path) ? resolve(path) : resolve(realRoot, path);
	const real = realPath(wanted);
	if (real === null) return false;
	return relative(realRoot, real) === "";
}
