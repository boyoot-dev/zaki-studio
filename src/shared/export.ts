// The two pieces of an export that need no file system or window (task 153): the bundle's
// text, checked by the app's own parser before it can be written, and the name the save
// dialog suggests. Pure and tested; src/main/export.ts reads the project, asks where to save
// and writes the file.

import { BUNDLE_LIMITS, type BundleIssue, checkText } from "./format/bundle";
import {
	type CurriculumModel,
	checkBundle,
	modelFileText,
	toBundle,
} from "./model";
import type { Project } from "./project";

/**
 * The bundle text, or the parser's problems. The subject list is the app's own
 * (subjects.json, through the build-time virtual module), so a course with a subject Mr. Zaki
 * doesn't know is refused here, exactly as the server refuses it at import.
 */
export function bundleText(
	project: Project,
	model: CurriculumModel,
	version: number,
	subjectIds: readonly string[],
): { ok: true; text: string } | { ok: false; issues: BundleIssue[] } {
	const bundle = toBundle(model, project, version);
	const checked = checkBundle(bundle, subjectIds);
	if (!checked.ok) return { ok: false, issues: checked.issues };
	return { ok: true, text: modelFileText(bundle) };
}

/** "Sunrise Curriculum v3.json", with the characters Windows refuses taken out. */
export function exportFileName(nameEn: string, version: number): string {
	const clean = nameEn
		.replace(/[\p{Cc}<>:"/\\|?*]/gu, "-")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/\.+$/, "");
	return `${clean === "" ? "curriculum" : clean.slice(0, 60)} v${version}.json`;
}

/**
 * The model with the author's name and rights sentence, from the export dialog. An empty
 * answer keeps what the project already has; a project that has neither is the one case the
 * bundle cannot be written from, and the issues say which field is missing.
 */
export function filledModel(
	model: CurriculumModel,
	author: string,
	rights: string,
): { ok: true; model: CurriculumModel } | { ok: false; issues: string[] } {
	const chosenAuthor = author.trim() === "" ? model.curriculum.author : author;
	const chosenRights = rights.trim() === "" ? model.curriculum.rights : rights;
	const checkedAuthor = checkText(chosenAuthor, BUNDLE_LIMITS.author);
	const checkedRights = checkText(chosenRights, BUNDLE_LIMITS.rights);
	const issues: string[] = [];
	if (!checkedAuthor.ok) issues.push(`author: ${checkedAuthor.message}`);
	if (!checkedRights.ok) issues.push(`rights: ${checkedRights.message}`);
	if (!checkedAuthor.ok || !checkedRights.ok) return { ok: false, issues };
	return {
		ok: true,
		model: {
			...model,
			curriculum: {
				...model.curriculum,
				author: checkedAuthor.text,
				rights: checkedRights.text,
			},
		},
	};
}

/** The problems as lines the dialog shows: "courses[0].author: expected a text". */
export function issueLines(issues: readonly BundleIssue[]): string[] {
	return issues.map((issue) => `${issue.path}: ${issue.message}`);
}
