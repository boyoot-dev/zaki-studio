// The Studio is built from its own folder alone (task 163): no file may import anything that
// resolves outside studio/. The format files are copies kept by scripts/sync-format.ts, so
// nothing reaches into the app repository. This test reads every source file of studio/ and
// fails on any path that escapes the folder, so a shortcut (a colour constant, a helper, an
// i18n table) is caught here rather than at the next build.

import { readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The studio folder: this file's folder is studio/src. */
const STUDIO = fileURLToPath(new URL("..", import.meta.url));

/** The path a specifier resolves to, or the specifier itself when it is absolute. */
function targetOf(fromFile: string, specifier: string): string | null {
	if (specifier.startsWith(".")) return resolve(fromFile, "..", specifier);
	if (isAbsolute(specifier)) return specifier;
	return null; // a bare package, resolved inside studio/node_modules
}

/** Every specifier a source file imports, through `from`, `import()` or a side effect. */
function specifiersOf(source: string): string[] {
	const found: string[] = [];
	for (const pattern of [
		/\bfrom\s*["']([^"']+)["']/g,
		/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
		/^\s*import\s+["']([^"']+)["']/gm,
	]) {
		for (const match of source.matchAll(pattern)) {
			if (match[1] !== undefined) found.push(match[1]);
		}
	}
	return found;
}

/** The imports of one source file that leave the studio folder, as "file → import" lines. */
function outsideStudio(fromFile: string, source: string): string[] {
	const problems: string[] = [];
	for (const specifier of specifiersOf(source)) {
		if (specifier.startsWith("@app/")) {
			problems.push(`${specifier} (the @app alias no longer exists)`);
			continue;
		}
		const target = targetOf(fromFile, specifier);
		if (target === null) continue;
		const rel = relative(STUDIO, target).split("\\").join("/");
		if (rel === ".." || rel.startsWith("../") || isAbsolute(rel))
			problems.push(specifier);
	}
	return problems;
}

/** Every .ts or .tsx file under a folder. */
function sources(folder: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(folder, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === "out") continue;
		const full = join(folder, entry.name);
		if (entry.isDirectory()) out.push(...sources(full));
		else if (/\.tsx?$/.test(entry.name)) out.push(full);
	}
	return out;
}

describe("studio imports", () => {
	it("takes no path outside studio/", () => {
		const problems: string[] = [];
		for (const file of [
			...sources(join(STUDIO, "src")),
			...sources(join(STUDIO, "scripts")),
		]) {
			// This file names the forbidden imports on purpose, so its own text is skipped.
			if (file.endsWith("import-guard.test.ts")) continue;
			const source = readFileSync(file, "utf8");
			for (const problem of outsideStudio(file, source))
				problems.push(`${relative(STUDIO, file)} → ${problem}`);
		}
		expect(problems).toEqual([]);
	});

	it("would catch any path that leaves the folder", () => {
		const here = join(STUDIO, "src", "main", "index.ts");
		expect(
			outsideStudio(here, 'import { t } from "../../../app/src/lib/i18n";'),
		).toEqual(["../../../app/src/lib/i18n"]);
		expect(outsideStudio(here, 'import { t } from "@app/lib/i18n";')).toEqual([
			"@app/lib/i18n (the @app alias no longer exists)",
		]);
		expect(outsideStudio(here, 'import { parseBundle } from "./ipc";')).toEqual(
			[],
		);
		expect(
			outsideStudio(
				here,
				'import { hasWebAddress } from "../shared/format/web-address";',
			),
		).toEqual([]);
	});
});
