// How the author uses AI, chosen once per computer in Settings (task 244): their own AI tool
// (the Studio prepares a job folder and a message) or an OpenRouter key (the Studio sends the
// request itself), and since task 245 Claude or Gemini in the browser (the Studio prepares a
// file per round; the author uploads it and pastes the answer). An unknown way reads as "not
// chosen yet", so a newer file never breaks an older Studio.

import { type Lang, t } from "./i18n.ts";
import type { JobTool } from "./job.ts";

/** The author's choice: a tool with its name, or the key. */
export type AiChoice =
	| { way: "tool"; tool: JobTool }
	| { way: "key" }
	| { way: "browser" };

/** The file in the app's user-data folder that keeps the choice. */
export const AI_FILE = "ai.json";

/** The choice a value holds, or null when it holds none (absent, broken, or a way unknown). */
export function cleanAi(value: unknown): AiChoice | null {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return null;
	const raw = value as Record<string, unknown>;
	if (raw.way === "key") return { way: "key" };
	if (raw.way === "browser") return { way: "browser" };
	if (raw.way === "tool")
		return {
			way: "tool",
			tool: raw.tool === "other" ? "other" : "claude-code",
		};
	return null;
}

/**
 * A cost as a teacher reads it: "about $0.14 (14 US cents)" / "نحو 0.14 دولار (14 سنتًا)".
 * From a dollar up the cents are left out.
 */
export function costWords(usd: number, lang: Lang): string {
	const figure = usd < 0.01 ? "0.01" : usd.toFixed(2);
	// English writes the sign before the figure; the Arabic text says "دولار" after it.
	const dollars = lang === "en" ? `$${figure}` : figure;
	if (usd >= 1) return t(lang, "cost.dollars", { usd: dollars });
	const cents = Math.max(1, Math.round(usd * 100));
	return t(lang, "cost.cents", { usd: dollars, n: cents });
}
