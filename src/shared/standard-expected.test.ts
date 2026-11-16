// The standard's examples, pinned to what the reader says (task 189):
// standard/examples/EXPECTED.md holds one row per example, and this test walks the
// table and runs the reader over every file, so the list cannot drift.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { subjectsJson } from "../../scripts/subjects.ts";
import { parseBundle } from "./format/bundle.ts";

/** The standard folder beside src/. */
const STANDARD = fileURLToPath(new URL("../../standard", import.meta.url));
/** The examples, and the list of what each one is expected to be. */
const EXAMPLES = `${STANDARD}/examples`;
const EXPECTED = `${EXAMPLES}/EXPECTED.md`;
/** The subject list, the copy the Studio ships (src/shared/format). */
const SUBJECTS_PATH = fileURLToPath(
	new URL("./format/subjects.json", import.meta.url),
);

const subjectIds: string[] = (
	JSON.parse(subjectsJson(readFileSync(SUBJECTS_PATH, "utf8"))) as {
		id: string;
	}[]
).map((s) => s.id);

/** One row of EXPECTED.md: a file, its verdict, and the reader's first problem. */
type Row = { file: string; verdict: string; path: string; message: string };

/** The dash a valid row carries where a problem would be. */
const NONE = "\u2014";

/** The rows of EXPECTED.md's table, in file order. */
function rows(): Row[] {
	const rows: Row[] = [];
	for (const line of readFileSync(EXPECTED, "utf8").split("\n")) {
		if (!line.startsWith("|")) continue;
		const cells = line
			.split("|")
			.slice(1, -1)
			.map((cell) => cell.trim().replaceAll("`", ""));
		// Skip the header and the line of dashes under it.
		if (cells.length !== 4 || cells[0] === "File" || cells[0] === "---")
			continue;
		rows.push({
			file: cells[0] ?? "",
			verdict: cells[1] ?? "",
			path: cells[2] === NONE ? "" : (cells[2] ?? ""),
			message: cells[3] === NONE ? "" : (cells[3] ?? ""),
		});
	}
	return rows;
}

describe("the examples' expected verdicts", () => {
	it("EXPECTED.md lists every example file once", () => {
		const listed = rows().map((row) => row.file);
		const files = readdirSync(EXAMPLES)
			.filter((name) => name.endsWith(".json"))
			.sort();
		expect([...listed].sort()).toEqual(files);
	});

	for (const row of rows()) {
		it(`${row.file} is ${row.verdict}, as the reference reader says`, () => {
			const result = parseBundle(
				readFileSync(`${EXAMPLES}/${row.file}`, "utf8"),
				subjectIds,
			);
			expect(result.ok, row.file).toBe(row.verdict === "valid");
			if (row.verdict === "valid" || result.ok) return;
			// A refused file reports its first problem here; the row must match it.
			expect(result.issues[0]?.path, row.file).toBe(row.path);
			expect(result.issues[0]?.message, row.file).toBe(row.message);
		});
	}
});
