// The first steps a new project shows when no file is open (task 243): has the book been put
// in, has the Studio read it, are there units, has the curriculum been exported. Each answer
// is read from disk cheaply, so the checklist can be refreshed whenever the folder changes.

import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { FirstSteps } from "../shared/api.ts";
import { INBOX_DIR, STUDIO_DIR } from "../shared/project.ts";
import { exportNames, readFiles, readModel } from "./model.ts";

/** True when a folder of the project (not the Inbox or the Studio's own) holds a file. Stops
 * at the first one, and looks at most a few thousand entries. */
export function hasMaterial(root: string): boolean {
	let looked = 0;
	const walk = (folder: string, top: boolean): boolean => {
		let entries: import("node:fs").Dirent[];
		try {
			entries = readdirSync(folder, { withFileTypes: true });
		} catch {
			return false;
		}
		for (const entry of entries) {
			looked += 1;
			if (looked > 5000) return false;
			if (entry.isFile() && !top) return true;
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (top && (entry.name === INBOX_DIR || entry.name === STUDIO_DIR))
				continue;
			if (entry.name.startsWith(".")) continue;
			if (walk(join(folder, entry.name), false)) return true;
		}
		return false;
	};
	return walk(root, true);
}

/** Which of the four first steps are done. */
export function firstSteps(root: string): FirstSteps {
	const files = readFiles(root);
	const model = readModel(root);
	return {
		material: hasMaterial(root),
		read: files.ok && files.files.length > 0,
		units:
			model.ok && model.model.courses.some((course) => course.units.length > 0),
		exported: exportNames(root).length > 0,
	};
}
