// Exporting the project as a bundle (task 153, docs/STUDIO.md): the summary the author sees
// first, then the file itself. The bundle is built from the Studio's model and checked by the
// shared parseBundle before anything is written, so an invalid file never reaches disk. Each
// export keeps a copy in .studio/exports/v<N>.json, and the version is the last copy's plus
// one, so importing a later file is an update and never a new curriculum (docs/BUNDLES.md).
// Since task 212 the file is a .zaki (src/shared/format/container.ts); the copy kept in
// .studio/exports stays plain text, because it is the Studio's own memory.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { BrowserWindow, dialog } from "electron";
import type { ExportCheck, Exported, Failure } from "../shared/api.ts";
import { courseNumberWarnings } from "../shared/exam-numbers.ts";
import {
	bundleText,
	exportFileName,
	filledModel,
	issueLines,
} from "../shared/export.ts";
import { writeZaki } from "../shared/format/container.ts";
import { languageWarnings } from "../shared/languages.ts";
import { modelSummary, nextVersion } from "../shared/model.ts";
import { readProject, writeProject } from "./files.ts";
import {
	exportNames,
	readModel,
	writeExportCopy,
	writeModel,
} from "./model.ts";

const failure = (code: Failure["code"], detail?: string): Failure => ({
	ok: false,
	code,
	...(detail === undefined ? {} : { detail }),
});

/** What an export would carry, and the version it would take. Nothing is written. */
export function summaryFor(root: string): ExportCheck {
	const project = readProject(root);
	if (!project.ok) return project;
	const model = readModel(root);
	if (!model.ok)
		return model.code === "missing" ? failure("emptyModel") : model;
	const summary = modelSummary(model.model);
	if (summary.courses === 0) return failure("emptyModel");
	return {
		ok: true,
		version: nextVersion(exportNames(root)),
		summary,
		examWarnings: courseNumberWarnings(model.model.courses),
		languageWarnings: languageWarnings(model.model.courses),
		needsAuthor:
			model.model.curriculum.author.trim() === "" ||
			model.model.curriculum.rights.trim() === "",
		author: model.model.curriculum.author,
		rights: model.model.curriculum.rights,
	};
}

/**
 * One whole export: the author's name and rights when the project still lacks them, the
 * version, the checked bundle, then the save dialog. Nothing is written before the bundle
 * passes, and a cancelled dialog leaves the version to the next attempt.
 */
export async function exportProject(
	root: string,
	author: string,
	rights: string,
	subjectIds: readonly string[],
): Promise<Exported> {
	const project = readProject(root);
	if (!project.ok) return project;
	const model = readModel(root);
	if (!model.ok)
		return model.code === "missing" ? failure("emptyModel") : model;

	// The header the file will carry: the author's answers, when they were asked for.
	const answered = filledModel(model.model, author, rights);
	if (!answered.ok)
		return { ok: false, code: "invalidBundle", issues: answered.issues };
	const filled = answered.model;

	const version = nextVersion(exportNames(root));
	const summary = modelSummary(model.model);
	const text = bundleText(project.project, filled, version, subjectIds);
	if (!text.ok)
		return {
			ok: false,
			code: "invalidBundle",
			issues: issueLines(text.issues),
		};

	// Past the check: the answers stay in the project, so the next export doesn't ask again.
	if (
		filled.curriculum.author !== model.model.curriculum.author ||
		filled.curriculum.rights !== model.model.curriculum.rights
	) {
		const writtenModel = writeModel(root, filled);
		if (!writtenModel.ok) return writtenModel;
		const writtenProject = writeProject(root, {
			...project.project,
			author: filled.curriculum.author,
			rights: filled.curriculum.rights,
		});
		if (!writtenProject.ok) return writtenProject;
	}

	const window = BrowserWindow.getFocusedWindow();
	const options = {
		title: "Export curriculum",
		defaultPath: join(
			dirname(root),
			exportFileName(filled.curriculum.nameEn, version),
		),
		filters: [{ name: "Mr. Zaki curriculum", extensions: ["zaki"] }],
	};
	const chosen =
		window === null
			? await dialog.showSaveDialog(options)
			: await dialog.showSaveDialog(window, options);
	if (
		chosen.canceled ||
		chosen.filePath === undefined ||
		chosen.filePath === ""
	)
		return failure("cancelled");
	try {
		const file = await writeZaki(text.text, async (bytes) =>
			deflateRawSync(bytes),
		);
		writeFileSync(chosen.filePath, file);
	} catch {
		return failure("unreadable", chosen.filePath);
	}
	const copy = writeExportCopy(root, version, text.text);
	if (!copy.ok) return copy;
	return { ok: true, version, path: chosen.filePath, summary };
}
