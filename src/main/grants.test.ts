// The folders the page may use, decided by the main process. A page that asks for a folder
// the author never picked must be refused, and the same folder written another way (a
// trailing slash, "..", another case, a junction to it) must still be found. Run against a
// real folder on disk, since the answer depends on the real path.

import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { canonicalRoot, grantedRoot, sameFolder } from "./grants.ts";

let base = "";
let project = "";
let elsewhere = "";

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-grants-"));
	project = join(base, "Sunrise Curriculum");
	elsewhere = join(base, "Elsewhere");
	mkdirSync(join(project, "Grade 7", "Science"), { recursive: true });
	mkdirSync(elsewhere, { recursive: true });
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

describe("granted roots", () => {
	it("accepts the folder the author picked", () => {
		expect(grantedRoot([project], project)).toBe(project);
	});

	it("refuses a folder nothing granted", () => {
		expect(grantedRoot([], project)).toBeNull();
		expect(grantedRoot([project], elsewhere)).toBeNull();
		// A folder inside the project is not the project: every channel wants its root.
		expect(grantedRoot([project], join(project, "Grade 7"))).toBeNull();
	});

	it("refuses the whole disk, wherever a page points", () => {
		const disk = process.platform === "win32" ? "C:\\" : "/";
		expect(grantedRoot([project], disk)).toBeNull();
		expect(grantedRoot([project], join(disk, "Windows"))).toBeNull();
	});

	it("finds the same folder with a trailing slash or with .. in the path", () => {
		expect(grantedRoot([project], `${project}${sep}`)).toBe(project);
		expect(grantedRoot([project], join(project, "Grade 7", ".."))).toBe(
			project,
		);
		expect(
			grantedRoot([project], join(project, "..", "Sunrise Curriculum")),
		).toBe(project);
	});

	it("ignores the case Windows ignores", () => {
		if (process.platform !== "win32") return;
		expect(grantedRoot([project], project.toUpperCase())).toBe(project);
	});

	it("finds a granted folder through a junction to it, and through the other way round", () => {
		const link = join(base, "the-project");
		symlinkSync(
			project,
			link,
			process.platform === "win32" ? "junction" : "dir",
		);
		// The page sends the junction, the author granted the folder it leads to.
		expect(grantedRoot([project], link)).toBe(project);
		// The page sends the real folder, the author granted it by its junction.
		expect(grantedRoot([link], project)).toBe(link);
	});

	it("refuses a junction that leads somewhere nothing granted", () => {
		const link = join(base, "elsewhere-link");
		symlinkSync(
			elsewhere,
			link,
			process.platform === "win32" ? "junction" : "dir",
		);
		expect(grantedRoot([project], link)).toBeNull();
	});

	it("compares only folders that really are on disk", () => {
		expect(canonicalRoot(join(base, "not-there"))).toBeNull();
		const file = join(base, "curriculum.json");
		writeFileSync(file, "{}");
		expect(canonicalRoot(file)).toBeNull();
		expect(grantedRoot([project], file)).toBeNull();
		expect(canonicalRoot(project)).not.toBeNull();
	});
});

describe("the same folder written two ways", () => {
	it("is found whether or not it is still on disk", () => {
		expect(sameFolder(project, `${project}${sep}`)).toBe(true);
		expect(sameFolder(project, join(project, "Grade 7", ".."))).toBe(true);
		expect(sameFolder(project, elsewhere)).toBe(false);
		const gone = join(base, "Opened Before");
		expect(sameFolder(gone, `${gone}${sep}`)).toBe(true);
		expect(sameFolder(gone, join(base, "Another"))).toBe(false);
	});

	it("is not fooled by a subfolder or by an empty path", () => {
		expect(sameFolder(project, join(project, "Grade 7"))).toBe(false);
		expect(sameFolder(project, "")).toBe(false);
	});
});
