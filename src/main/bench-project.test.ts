// The bench project's one hard rule, checked the cheap way: a folder that isn't empty is
// refused, so the benchmark can never land on top of someone's real project. Making a whole
// project is covered by actually running the script, not by the suite.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = join(__dirname, "..", "..", "scripts", "bench-project.ts");

let base = "";

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-bench-refusal-"));
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

describe("bench-project", () => {
	it("refuses a folder that isn't empty", () => {
		const project = join(base, "Not empty");
		mkdirSync(project, { recursive: true });
		writeFileSync(join(project, "keep.txt"), "someone's file\n", "utf8");
		let failed: (Error & { status?: number }) | null = null;
		try {
			execFileSync(process.execPath, [SCRIPT, project, "1000"], {
				stdio: "pipe",
			});
		} catch (error) {
			failed = error as Error & { status?: number };
		}
		expect(failed).not.toBeNull();
		expect(failed?.status).toBe(2);
	});

	it("refuses a size below the minimum", () => {
		const project = join(base, "Too small");
		let failed: (Error & { status?: number }) | null = null;
		try {
			execFileSync(process.execPath, [SCRIPT, project, "10"], {
				stdio: "pipe",
			});
		} catch (error) {
			failed = error as Error & { status?: number };
		}
		expect(failed).not.toBeNull();
		expect(failed?.status).toBe(2);
	});
});
