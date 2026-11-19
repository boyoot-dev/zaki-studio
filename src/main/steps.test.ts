// The first steps of a new project (task 243): material outside the Inbox, read, units, export.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { firstSteps, hasMaterial } from "./steps.ts";

let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "studio-steps-"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("first steps", () => {
	it("counts a file in a subject folder, not in the Inbox, .studio or the root", () => {
		writeFileSync(join(root, "curriculum.json"), "{}");
		mkdirSync(join(root, "Inbox"), { recursive: true });
		writeFileSync(join(root, "Inbox", "book.pdf"), "x");
		mkdirSync(join(root, ".studio"), { recursive: true });
		writeFileSync(join(root, ".studio", "files.json"), "[]");
		mkdirSync(join(root, "Grade 7", "Science", "Books"), { recursive: true });
		expect(hasMaterial(root)).toBe(false);
		writeFileSync(join(root, "Grade 7", "Science", "Books", "book.pdf"), "x");
		expect(hasMaterial(root)).toBe(true);
	});

	it("says nothing is done in an empty folder", () => {
		expect(firstSteps(root)).toEqual({
			material: false,
			read: false,
			units: false,
			exported: false,
		});
	});
});
