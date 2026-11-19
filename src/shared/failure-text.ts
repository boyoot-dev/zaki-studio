// Why something didn't happen, in the author's words: the failure's text in the window's
// language, plus the file or folder it was about when that is a path inside the project.
// Kept out of App.tsx so it can be tested without a window (task 240). Details that are
// internal (English messages from checks, the computer's own absolute paths) never show,
// so the Arabic window stays Arabic.

import type { Failure, FailureCode } from "./api";
import { type Lang, type TextKey, t } from "./i18n";

/** The failures whose detail is the project path or name they were about. */
const PATH_CODES: ReadonlySet<FailureCode> = new Set([
	"missing",
	"unreadable",
	"tooLarge",
	"nameTaken",
]);

/**
 * The detail worth showing: a path relative to the project ("Grade 11/Chemistry/part1.pdf")
 * or a file name ("part 1.pdf"). An absolute path or a sentence gives "".
 */
export function pathDetail(failure: Failure): string {
	if (!PATH_CODES.has(failure.code)) return "";
	const value = (failure.detail ?? "").trim();
	if (value === "") return "";
	if (/^[A-Za-z]:[/]/.test(value) || /^[/]/.test(value)) return "";
	const looksLikePath = /[/]/.test(value) || /\.[A-Za-z0-9]{1,5}$/.test(value);
	return looksLikePath ? value : "";
}

/** Why something didn't happen, in the window's language; a cancelled dialog says nothing. */
export function failureText(lang: Lang, failure: Failure): string {
	if (failure.code === "cancelled") return "";
	const text = t(lang, `failure.${failure.code}` as TextKey);
	const path = pathDetail(failure);
	if (path === "") return text;
	// "That file could not be read. Close it…" becomes "…could not be read: <path>. Close it…"
	const stop = text.search(/\.(\s|$)/);
	if (stop < 0) return `${text}: ${path}`;
	return `${text.slice(0, stop)}: ${path}${text.slice(stop)}`;
}
