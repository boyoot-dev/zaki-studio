// The subject list, read from the Studio's own copy of the app's subjects.json
// (src/shared/format/subjects.json, kept in step by scripts/sync-format.ts) when the Studio is
// built, and handed to the page as the virtual module "virtual:subjects". It is read rather
// than imported so the build has one subject list without a second copy by hand.
// The copy starts with two // lines naming where it comes from; they are not JSON.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

/** The Studio's own copy of the app's subject list, beside this file's folder. */
export const SUBJECTS_FILE = fileURLToPath(
	new URL("../src/shared/format/subjects.json", import.meta.url),
);

/** The module id the page imports, and the private id it resolves to. */
export const SUBJECTS_MODULE = "virtual:subjects";
const RESOLVED = `\0${SUBJECTS_MODULE}`;

/** The copy without its provenance lines, which are not JSON. */
export function subjectsJson(raw: string): string {
	const lines = raw.split("\n");
	let at = 0;
	while (at < lines.length && (lines[at] ?? "").startsWith("//")) at += 1;
	return lines.slice(at).join("\n");
}

/** A small Vite plugin that serves the subjects as a module, checked as it is read. */
export function subjectsPlugin(): Plugin {
	return {
		name: "studio-subjects",
		resolveId(id) {
			return id === SUBJECTS_MODULE ? RESOLVED : null;
		},
		load(id) {
			if (id !== RESOLVED) return null;
			const subjects: unknown = JSON.parse(
				subjectsJson(readFileSync(SUBJECTS_FILE, "utf8")),
			);
			// Checked here so a broken file fails the build with one clear message rather than
			// at the first subject a parent picks.
			if (!Array.isArray(subjects))
				throw new Error(`${SUBJECTS_FILE} is not a list of subjects`);
			return `export default ${JSON.stringify(subjects)};\n`;
		},
	};
}
