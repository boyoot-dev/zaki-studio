// The file operations behind the window, run against a folder on disk: making a project,
// reading its tree, copying dropped files in, pasting, moving, renaming, numbering a unit,
// and refusing every path that leads out. Electron is not needed: these functions are plain
// Node, and the window calls them through IPC.

import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { TreeNode } from "../shared/api.ts";
import {
	type Project,
	presetPeriods,
	type SubjectLabel,
	wizardProject,
} from "../shared/project.ts";
import {
	createProject,
	freeName,
	importPaths,
	makeUnit,
	moveEntry,
	openable,
	readBytes,
	readProject,
	readText,
	readTree,
	renameEntry,
	safePath,
	savePastedImage,
	stamp,
} from "./files.ts";

const ID = "6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10";
const SUBJECTS: SubjectLabel[] = [
	{ id: "science", nameEn: "Science", nameAr: "العلوم" },
];

let base = "";
let root = "";
let outside = "";

function project(): Project {
	const made = wizardProject(
		{
			nameEn: "Sunrise Curriculum",
			nameAr: "منهج الشروق",
			author: "A. Teacher",
			rights: "For my own students only.",
			grades: [{ grade: 7, subjects: ["science"] }],
			periods: presetPeriods("terms"),
			finalExam: true,
		},
		SUBJECTS,
		ID,
	);
	if (!made.ok) throw new Error(JSON.stringify(made.issues));
	return made.project;
}

/** Every path in a tree, so a test can look for one row. */
function rels(nodes: TreeNode[]): string[] {
	return nodes.flatMap((node) => [node.rel, ...rels(node.children)]);
}

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-files-"));
	root = join(base, "Sunrise Curriculum");
	outside = join(base, "Outside");
	mkdirSync(outside, { recursive: true });
	writeFileSync(join(outside, "cells.pdf"), "a sheet about cells");
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

describe("making a project", () => {
	it("writes curriculum.json and every folder the wizard showed", () => {
		expect(createProject(root, project()).ok).toBe(true);
		for (const folder of [
			"Inbox",
			".studio",
			"Grade 7/Science/Units",
			"Grade 7/Science/Exam/reading-samples",
		]) {
			expect(existsSync(join(root, ...folder.split("/")))).toBe(true);
		}
		const read = readProject(root);
		expect(read.ok).toBe(true);
		if (read.ok) {
			expect(read.project.nameEn).toBe("Sunrise Curriculum");
			expect(read.project.periods.map((period) => period.id)).toEqual([
				"t1",
				"t2",
				"t3",
				"final",
			]);
		}
	});

	it("writes nothing when the project is broken", () => {
		const broken = {
			...project(),
			grades: [{ grade: 7, folder: "../Out", subjects: [] }],
		};
		expect(createProject(root, broken).ok).toBe(false);
		expect(existsSync(join(root, "curriculum.json"))).toBe(false);
	});

	it("says a folder isn't a project yet, and guesses what it holds", () => {
		mkdirSync(join(root, "Grade 7", "Science"), { recursive: true });
		const read = readProject(root);
		expect(read.ok).toBe(false);
		if (!read.ok) expect(read.code).toBe("missing");
	});
});

describe("the tree", () => {
	it("keeps the Inbox first and leaves the Studio's own folder out", () => {
		createProject(root, project());
		const tree = readTree(root);
		expect(tree[0]?.name).toBe("Inbox");
		expect(rels(tree)).not.toContain(".studio");
		expect(rels(tree)).toContain("Grade 7/Science/Exam/past-papers");
	});

	it("sorts folders before files, and numbers in names as numbers", () => {
		createProject(root, project());
		const units = join(root, "Grade 7", "Science", "Units");
		mkdirSync(join(units, "10 Energy"));
		mkdirSync(join(units, "02 Cells"));
		writeFileSync(join(units, "notes.txt"), "x");
		const tree = readTree(join(units));
		expect(tree.map((node) => node.name)).toEqual([
			"02 Cells",
			"10 Energy",
			"notes.txt",
		]);
	});
});

describe("bringing files in", () => {
	it("copies a dropped file in, and keeps both when a name is taken", () => {
		createProject(root, project());
		const units = "Grade 7/Science/Units";
		expect(importPaths(root, units, [join(outside, "cells.pdf")])).toEqual({
			ok: true,
			added: 1,
			skipped: 0,
		});
		expect(importPaths(root, units, [join(outside, "cells.pdf")])).toEqual({
			ok: true,
			added: 1,
			skipped: 0,
		});
		expect(readdirSync(join(root, units)).sort()).toEqual([
			"cells (2).pdf",
			"cells.pdf",
		]);
		expect(readText(root, `${units}/cells.pdf`).ok).toBe(true);
	});

	it("refuses a file already inside the project, and a link", () => {
		createProject(root, project());
		const units = join(root, "Grade 7", "Science", "Units");
		writeFileSync(join(units, "in.pdf"), "already here");
		// A junction needs no administrator on Windows, and stands in for the link a dropped
		// folder can really be.
		const linked = join(outside, "linked-folder");
		symlinkSync(outside, linked, "junction");
		const result = importPaths(root, "Inbox", [join(units, "in.pdf"), linked]);
		expect(result).toEqual({ ok: true, added: 0, skipped: 2 });
	});

	it("names a pasted picture with its date", () => {
		createProject(root, project());
		const when = new Date(2026, 10, 12, 14, 32);
		expect(stamp(when)).toBe("2026-11-12 14.32");
		const bytes = new Uint8Array([137, 80, 78, 71]);
		expect(savePastedImage(root, "Inbox", bytes, "png", when).ok).toBe(true);
		expect(savePastedImage(root, "Inbox", bytes, "png", when).ok).toBe(true);
		expect(readdirSync(join(root, "Inbox")).sort()).toEqual([
			"Pasted 2026-11-12 14.32 (2).png",
			"Pasted 2026-11-12 14.32.png",
		]);
	});

	it("makes units with the next number", () => {
		createProject(root, project());
		const units = "Grade 7/Science/Units";
		const first = makeUnit(root, units, "Classification");
		const second = makeUnit(root, units, "Cells");
		expect(first).toEqual({ ok: true, rel: `${units}/01 Classification` });
		expect(second).toEqual({ ok: true, rel: `${units}/02 Cells` });
	});

	it("adds a suffix rather than overwrite", () => {
		createProject(root, project());
		const inbox = join(root, "Inbox");
		writeFileSync(join(inbox, "sheet.pdf"), "one");
		expect(freeName(inbox, "sheet.pdf")).toBe("sheet (2).pdf");
		expect(freeName(inbox, "new.pdf")).toBe("new.pdf");
	});
});

describe("changing files", () => {
	it("moves a file, and refuses to put a folder inside itself", () => {
		createProject(root, project());
		const units = "Grade 7/Science/Units";
		makeUnit(root, units, "Cells");
		writeFileSync(join(root, units, "01 Cells", "sheet.pdf"), "x");
		expect(
			moveEntry(root, `${units}/01 Cells/sheet.pdf`, `${units}/01 Cells`),
		).toEqual({ ok: true });
		expect(existsSync(join(root, units, "01 Cells", "sheet.pdf"))).toBe(true);
		expect(moveEntry(root, units, `${units}/01 Cells`).ok).toBe(false);
	});

	it("renames a file and keeps its extension when the author leaves it out", () => {
		createProject(root, project());
		writeFileSync(join(root, "Inbox", "scan.pdf"), "x");
		expect(renameEntry(root, "Inbox/scan.pdf", "cells")).toEqual({
			ok: true,
			rel: "Inbox/cells.pdf",
		});
		expect(renameEntry(root, "Inbox/cells.pdf", "bad/name").ok).toBe(false);
	});

	it("reads a file's bytes and text, and opens only what Windows may", () => {
		createProject(root, project());
		writeFileSync(join(root, "Inbox", "note.txt"), "cells divide");
		const bytes = readBytes(root, "Inbox/note.txt");
		expect(bytes.ok).toBe(true);
		const text = readText(root, "Inbox/note.txt");
		expect(text.ok && text.text).toBe("cells divide");
		expect(openable("sheet.pdf")).toBe(true);
		expect(openable("run.exe")).toBe(false);
	});
});

describe("paths outside the project", () => {
	it("refuses .. and absolute paths, before anything is read or written", () => {
		createProject(root, project());
		expect(safePath(root, "../../Outside/cells.pdf")).toBeNull();
		expect(safePath(root, join(outside, "cells.pdf"))).toBeNull();
		expect(
			importPaths(root, "../../Outside", [join(outside, "cells.pdf")]),
		).toEqual({
			ok: false,
			code: "outside",
		});
		expect(savePastedImage(root, "../..", new Uint8Array([1]), "png").ok).toBe(
			false,
		);
		expect(readBytes(root, "../../Outside/cells.pdf").ok).toBe(false);
		expect(readText(root, "../../Outside/cells.pdf").ok).toBe(false);
		expect(renameEntry(root, "../../Outside/cells.pdf", "x").ok).toBe(false);
		expect(moveEntry(root, "../../Outside/cells.pdf", "Inbox").ok).toBe(false);
	});

	it("refuses a junction that leads out of the project", () => {
		createProject(root, project());
		symlinkSync(outside, join(root, "Inbox", "Elsewhere"), "junction");
		expect(safePath(root, "Inbox/Elsewhere/cells.pdf")).toBeNull();
	});

	it("leaves the project file itself alone", () => {
		createProject(root, project());
		expect(safePath(root, ".")).toBeNull();
		expect(safePath(root, "curriculum.json")).not.toBeNull();
	});
});

describe("reading a project back", () => {
	it("keeps the text a person wrote, in both languages", () => {
		createProject(root, project());
		const written = JSON.parse(
			readFileSync(join(root, "curriculum.json"), "utf8"),
		);
		expect(written.nameAr).toBe("منهج الشروق");
		expect(written.formatVersion).toBe(1);
	});
});
