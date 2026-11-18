// A project made from a curriculum file (task 214). The main test: exporting the new project
// straight away gives back the same bundle, only one version later.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { subjectsJson } from "../../scripts/subjects.ts";
import { bundleText } from "./export.ts";
import { parseBundle } from "./format/bundle.ts";
import { projectFromBundle } from "./frombundle.ts";
import { parseProject, type SubjectLabel } from "./project.ts";

const STANDARD = fileURLToPath(new URL("../../standard", import.meta.url));
const subjects = JSON.parse(
	subjectsJson(
		readFileSync(
			fileURLToPath(new URL("./format/subjects.json", import.meta.url)),
			"utf8",
		),
	),
) as SubjectLabel[];
const subjectIds = subjects.map((s) => s.id);

/** An example bundle of the published standard, parsed by the app's own reader. */
function example(name: string) {
	const parsed = parseBundle(
		readFileSync(`${STANDARD}/examples/${name}`, "utf8"),
		subjectIds,
	);
	if (!parsed.ok) throw new Error(`${name} is not valid`);
	return parsed.bundle;
}

describe("a project from a curriculum file", () => {
	for (const name of ["full.json", "writing.json", "minimal.json"]) {
		it(`exports ${name} again as the same bundle, one version later`, () => {
			const bundle = example(name);
			const { project, model } = projectFromBundle(bundle, subjects);
			const text = bundleText(project, model, bundle.version + 1, subjectIds);
			if (!text.ok) throw new Error(JSON.stringify(text.issues));
			const again = parseBundle(text.text, subjectIds);
			if (!again.ok) throw new Error("the export did not parse");
			expect(again.bundle).toEqual({ ...bundle, version: bundle.version + 1 });
		});
	}

	it("keeps the bundle's id, so the next export is an update", () => {
		const bundle = example("full.json");
		expect(projectFromBundle(bundle, subjects).project.id).toBe(bundle.id);
	});

	it("makes a valid project with a folder per grade and subject", () => {
		const bundle = example("full.json");
		const { project } = projectFromBundle(bundle, subjects);
		const parsed = parseProject(JSON.stringify(project));
		expect(parsed.ok).toBe(true);
		const courses = new Set(
			bundle.courses.map((c) => `${c.grade}/${c.subject}`),
		);
		const made = new Set(
			project.grades.flatMap((g) =>
				g.subjects.map((s) => `${g.grade}/${s.subject}`),
			),
		);
		expect(made).toEqual(courses);
		for (const grade of project.grades)
			expect(grade.folder).toMatch(/^(Grade \d+|KG\d)$/);
	});

	it("brings facts in as the author's own, with no pages", () => {
		const { model } = projectFromBundle(example("full.json"), subjects);
		const facts = model.courses.flatMap((c) =>
			c.units.flatMap((u) => u.lessons.flatMap((l) => l.facts)),
		);
		expect(facts.length).toBeGreaterThan(0);
		for (const fact of facts) {
			expect(fact).toMatchObject({
				sources: [],
				status: "reviewed",
				own: true,
			});
		}
	});
});
