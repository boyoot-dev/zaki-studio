// The list of projects the author opened before, kept in the app's own user-data folder and
// never in a project: a project folder can be shared on OneDrive, and what someone opened on
// their computer is not part of the curriculum. At most eight, newest first.

import type { RecentProject } from "./api.ts";

/** How many projects "recent" keeps. */
export const RECENT_MAX = 8;

/**
 * The list with `entry` first: a project opened twice moves up instead of appearing twice,
 * and the oldest falls off the end.
 */
export function rememberRecent(
	list: readonly RecentProject[],
	entry: RecentProject,
): RecentProject[] {
	const rest = list.filter((item) => item.root !== entry.root);
	return [entry, ...rest].slice(0, RECENT_MAX);
}

/** True when a recent project can be opened again on this computer. */
export function sameRoot(a: string, b: string): boolean {
	const norm = (p: string) =>
		process.platform === "win32" ? p.toLowerCase() : p;
	return norm(a) === norm(b);
}
