// A curriculum file made into a project on disk (task 214): the file is read and checked, the
// project goes into an empty folder only, and the next export takes the file's version + 1.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import studioSubjects from "virtual:subjects";
import { afterEach, describe, expect, it } from "vitest";
import { writeZaki } from "../shared/format/container.ts";
import { nextVersion } from "../shared/model.ts";
import { readProject } from "./files.ts";
import { makeFromBundle, readBundleFile, zakiInArgs } from "./frombundle.ts";
import { exportNames, readModel } from "./model.ts";

const FULL = fileURLToPath(
	new URL("../../standard/examples/full.json", import.meta.url),
);

const made: string[] = [];
const temp = () => {
	const dir = mkdtempSync(join(tmpdir(), "studio-214-"));
	made.push(dir);
	return dir;
};
afterEach(() => {
	for (const dir of made.splice(0))
		rmSync(dir, { recursive: true, force: true });
});

/** The standard's full example, written as a .zaki file in a fresh folder. */
async function zakiFile(text?: string): Promise<string> {
	const { readFileSync } = await import("node:fs");
	const path = join(temp(), "Sunrise v4.zaki");
	const bytes = await writeZaki(text ?? readFileSync(FULL, "utf8"), async (b) =>
		deflateRawSync(b),
	);
	writeFileSync(path, bytes);
	return path;
}

describe("a curriculum file made into a project", () => {
	it("reads the file and makes the project in an empty folder", async () => {
		const read = await readBundleFile(await zakiFile(), studioSubjects);
		if (!read.ok) throw new Error(JSON.stringify(read.issues));
		expect(read.info.file).toBe("Sunrise v4.zaki");
		expect(read.info.summary.courses).toBeGreaterThan(0);

		const root = temp();
		expect(makeFromBundle(root, read.opened)).toEqual({ ok: true });
		const project = readProject(root);
		expect(project.ok && project.project.id).toBe(
			read.opened.bundle.project.id,
		);
		const model = readModel(root);
		expect(model.ok && model.model.courses.length).toBe(
			read.info.summary.courses,
		);
		expect(nextVersion(exportNames(root))).toBe(read.info.version + 1);
	});

	it("refuses a folder that isn't empty, and writes nothing there", async () => {
		const read = await readBundleFile(await zakiFile(), studioSubjects);
		if (!read.ok) throw new Error("not read");
		const root = temp();
		writeFileSync(join(root, "notes.txt"), "mine");
		expect(makeFromBundle(root, read.opened)).toEqual({
			ok: false,
			code: "notEmpty",
		});
		expect(readProject(root).ok).toBe(false);
	});

	it("names what is wrong with a file that fails the check", async () => {
		const read = await readBundleFile(
			await zakiFile('{"format":"mr-zaki-curriculum"}'),
			studioSubjects,
		);
		expect(read.ok).toBe(false);
		if (!read.ok) expect(read.issues.length).toBeGreaterThan(0);
		const notZip = join(temp(), "x.zaki");
		writeFileSync(notZip, "hello");
		const refused = await readBundleFile(notZip, studioSubjects);
		expect(refused.ok).toBe(false);
	});

	it("finds a double-clicked file in a command line", () => {
		expect(
			zakiInArgs([
				"Studio.exe",
				"--allow-file-access",
				"C:\\x\\Sunrise v4.zaki",
			]),
		).toBe("C:\\x\\Sunrise v4.zaki");
		expect(zakiInArgs(["Studio.exe", "."])).toBeNull();
	});
});
