// The author's AI choice on this computer (task 244): `ai.json` in the app's user-data folder,
// never in a project, so a shared project folder says nothing about how anyone works.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { AI_FILE, type AiChoice, cleanAi } from "../shared/ai.ts";

/** The choice kept on this computer, or null when none is chosen yet. */
export function readAi(userData: string): AiChoice | null {
	try {
		return cleanAi(JSON.parse(readFileSync(join(userData, AI_FILE), "utf8")));
	} catch {
		return null;
	}
}

/** Keeps a choice; a value that is not one is refused and nothing is written. */
export function writeAi(userData: string, value: unknown): AiChoice | null {
	const choice = cleanAi(value);
	if (choice === null) return null;
	try {
		writeFileSync(
			join(userData, AI_FILE),
			`${JSON.stringify(choice, null, 2)}\n`,
			"utf8",
		);
	} catch {
		return null;
	}
	return choice;
}
