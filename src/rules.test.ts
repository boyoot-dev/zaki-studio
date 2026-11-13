// The note rules are one text, not two (task 157): the Studio keeps its own copy at
// resources/rules/note-rules.md, because the pipeline leaves the repository in step 8. While
// both exist a test compares them byte for byte, so a rule changed in one place fails here.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The Studio folder: this file's folder is studio/src. */
const STUDIO = join(import.meta.dirname, "..");
/** The pipeline's rules, beside the repository's tools folder. */
const PIPELINE = join(STUDIO, "..", "tools", "materials", "note-rules.md");

/** A file's text, or null when it is not there (the pipeline is removed in step 8). */
function text(path: string): string | null {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return null;
	}
}

describe("the Studio's copy of note-rules.md", () => {
	it("is the pipeline's own text, unchanged", () => {
		const mine = text(join(STUDIO, "resources", "rules", "note-rules.md"));
		const theirs = text(PIPELINE);
		expect(mine).not.toBeNull();
		// Once the pipeline leaves the repository there is nothing to compare with.
		if (theirs !== null) expect(mine).toBe(theirs);
	});

	it("keeps the page rule and the template a note must follow", () => {
		const rules =
			text(join(STUDIO, "resources", "rules", "note-rules.md")) ?? "";
		expect(rules).toContain("(p7)");
		expect(rules).toContain("## What it covers");
	});
});
