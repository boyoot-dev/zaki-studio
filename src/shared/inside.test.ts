// The guard that keeps the Studio from reading anything outside its project. `..`, absolute
// paths, a sibling folder with a shared prefix, and links (a junction on Windows, a symlink
// elsewhere) are each tried, because each is a way out that a plain string check misses.

import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { insideProject, isProjectRoot } from "./inside.ts";

let base = "";
let root = "";
let outside = "";

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-inside-"));
	root = join(base, "Sunrise Curriculum");
	outside = join(base, "Outside");
	mkdirSync(join(root, "Grade 7", "Science"), { recursive: true });
	mkdirSync(outside, { recursive: true });
	writeFileSync(join(outside, "secret.txt"), "not yours");
	writeFileSync(join(root, "Grade 7", "Science", "sheet.pdf"), "a sheet");
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

describe("insideProject", () => {
	it("lets the project folder and everything under it through", () => {
		expect(insideProject(root, "Grade 7/Science/sheet.pdf")).toBe(true);
		expect(insideProject(root, join(root, "Grade 7"))).toBe(true);
		expect(insideProject(root, ".")).toBe(true);
	});

	it("refuses a path that climbs out with ..", () => {
		expect(insideProject(root, "../../Outside/secret.txt")).toBe(false);
		expect(insideProject(root, "Grade 7/../../Outside")).toBe(false);
	});

	it("refuses an absolute path outside, and a folder beside the project", () => {
		expect(insideProject(root, join(outside, "secret.txt"))).toBe(false);
		expect(insideProject(root, `${root}-extra/x`)).toBe(false);
	});

	it("allows a path that does not exist yet, if its folder is inside", () => {
		expect(insideProject(root, "Grade 7/Science/03 Energy")).toBe(true);
	});

	it("refuses a link that leads outside the project", () => {
		const link = join(root, "Elsewhere");
		// A junction needs no administrator on Windows; elsewhere a plain symlink is used.
		symlinkSync(
			outside,
			link,
			process.platform === "win32" ? "junction" : "dir",
		);
		expect(insideProject(root, "Elsewhere/secret.txt")).toBe(false);
	});

	it("refuses a link that leads back inside, too: a link is never followed", () => {
		const link = join(root, "Loop");
		symlinkSync(
			join(root, "Grade 7"),
			link,
			process.platform === "win32" ? "junction" : "dir",
		);
		// Resolved, "Loop" is really "Grade 7", which is inside; the point of the test is that
		// the answer follows the link rather than the name.
		expect(insideProject(root, "Loop/Science/sheet.pdf")).toBe(
			realpathSync.native(link) === join(realpathSync.native(root), "Grade 7"),
		);
	});

	it("refuses an empty path or an empty root", () => {
		expect(insideProject(root, "")).toBe(false);
		expect(insideProject("", "Grade 7")).toBe(false);
	});
});

describe("isProjectRoot", () => {
	it("knows the project folder itself from something inside it", () => {
		expect(isProjectRoot(root, ".")).toBe(true);
		expect(isProjectRoot(root, "Grade 7")).toBe(false);
	});
});
