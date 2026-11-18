// Adoption on disk (task 153): a small copy of the material, the work folder and the built-in
// curriculum, in a temporary folder. The test the task's acceptance asks for: every file in
// the three folders is hashed before and after, so the test fails if adoption writes anything
// but `curriculum.json` and `.studio/` in the materials folder, or touches a single byte of
// the work or curriculum folders.

import { createHash } from "node:crypto";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bundleText, filledModel } from "../shared/export.ts";
import { parseBundle } from "../shared/format/bundle.ts";
import { NOTES_DIR } from "../shared/notes.ts";
import { adoptMaterial } from "./adopt.ts";
import { readProject } from "./files.ts";
import { readFiles, readModel, readPageText } from "./model.ts";

const ID = "6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10";
const FILE_ID = "9a010f4b4816";

let base = "";
let materials = "";
let work = "";
let curriculum = "";

/** Every file under `dir`, by its path relative to it, with its bytes' hash. */
function snapshot(dir: string): Map<string, string> {
	const out = new Map<string, string>();
	const walk = (folder: string) => {
		for (const entry of readdirSync(folder, { withFileTypes: true })) {
			const full = join(folder, entry.name);
			if (entry.isDirectory()) walk(full);
			else
				out.set(
					relative(dir, full).split(sep).join("/"),
					createHash("sha256").update(readFileSync(full)).digest("hex"),
				);
		}
	};
	walk(dir);
	return out;
}

function write(path: string, text: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, text, "utf8");
}

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-adopt-"));
	materials = join(base, "kestrel");
	work = join(base, "_work");
	curriculum = join(base, "content", "kestrel");

	write(join(materials, "_subjects.csv"), "folder,subject\nScience,science\n");
	write(
		join(materials, "Grade 7", "Science", "Units", "Science sheet 1.pdf"),
		"%PDF-1.4 pretend sheet",
	);
	write(
		join(work, "index.csv"),
		[
			"id,path,grade,year,subject,block,kind,pages,curriculum,dup_of,authority",
			`${FILE_ID},kestrel/Grade 7/Science/Units/Science sheet 1.pdf,7,current,science,1,sheet,8,kestrel,,1`,
		].join("\n"),
	);
	write(
		join(work, "text", `${FILE_ID}.md`),
		"## Page 1\nCells.\n\n## Page 7\nThe nucleus holds the DNA.\n",
	);
	// A note the pipeline wrote before this folder was adopted (task 157).
	write(join(work, "notes", `${FILE_ID}.md`), "# note from the pipeline\n");
	write(
		join(curriculum, "curriculum.json"),
		JSON.stringify({
			nameEn: "KESTREL",
			nameAr: "مدارس النيل",
			periods: [
				{
					id: "black",
					nameEn: "Block 1",
					nameAr: "المرحلة 1",
					wholeYear: false,
					periods: [],
				},
			],
		}),
	);
	write(
		join(curriculum, "grade-7-science-en.json"),
		JSON.stringify({
			curriculum: "kestrel",
			subject: "science",
			language: "en",
			grade: 7,
			examStyle: "One paper, short answers.",
			exams: [
				{
					id: "e5",
					period: "black",
					name: "Block 1 test",
					papers: [
						{
							id: "p4",
							name: "Paper 1",
							skill: "written",
							parts: [
								{
									name: "Part 1",
									material: { kind: "none" },
									questions: {
										count: 4,
										types: { short: 4 },
										marksEach: 0.5,
										totalMarks: 2,
									},
								},
							],
						},
					],
				},
			],
			units: [
				{
					id: "u2",
					number: 1,
					period: "black",
					title: "Classification",
					source: "sheet",
					keywords: ["species"],
					evidence: [],
					lessons: [
						{
							id: "l3",
							number: 1,
							title: "Living things",
							skills: [
								{ id: "s1", code: "7-1-1", text: "Sort living things." },
							],
							facts: [
								{
									text: "Living things are sorted by features.",
									sources: [`${FILE_ID}#p7`],
									status: "reviewed",
								},
								"A fact with no page.",
							],
							activity: "writing",
						},
					],
				},
			],
		}),
	);
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

describe("adopting a material folder", () => {
	it("writes only curriculum.json and .studio/ into the materials folder", () => {
		const beforeMaterials = snapshot(materials);
		const beforeWork = snapshot(work);
		const beforeCurriculum = snapshot(curriculum);

		const outcome = adoptMaterial(materials, work, curriculum, ID);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.already).toBe(false);
		expect(outcome.project.nameEn).toBe("KESTREL");

		const afterMaterials = snapshot(materials);
		// Every original file is still there, byte for byte.
		for (const [path, hash] of beforeMaterials)
			expect(afterMaterials.get(path)).toBe(hash);
		// Everything added is the project file or the Studio's own memory.
		for (const path of afterMaterials.keys()) {
			if (beforeMaterials.has(path)) continue;
			expect(path === "curriculum.json" || path.startsWith(".studio/")).toBe(
				true,
			);
		}
		expect(snapshot(work)).toEqual(beforeWork);
		expect(snapshot(curriculum)).toEqual(beforeCurriculum);
	});

	it("keeps the curriculum, each fact's pages, and the file's text", () => {
		const outcome = adoptMaterial(materials, work, curriculum, ID);
		expect(outcome.ok).toBe(true);

		const project = readProject(materials);
		expect(project.ok).toBe(true);
		if (project.ok) {
			expect(project.project.author).toBe("");
			expect(project.project.rights).toBe("");
			expect(project.project.grades).toEqual([
				{
					grade: 7,
					folder: "Grade 7",
					subjects: [
						{
							subject: "science",
							folder: "Science",
							language: "en",
							support: [],
						},
					],
				},
			]);
		}

		const model = readModel(materials);
		expect(model.ok).toBe(true);
		if (model.ok) {
			const facts = model.model.courses[0]?.units[0]?.lessons[0]?.facts;
			expect(facts?.[0]).toEqual({
				text: "Living things are sorted by features.",
				sources: [`${FILE_ID}#p7`],
				status: "reviewed",
				own: true,
			});
		}

		const files = readFiles(materials);
		expect(files.ok && files.files[0]?.path).toBe(
			"Grade 7/Science/Units/Science sheet 1.pdf",
		);
		expect(readPageText(materials, FILE_ID, 7)).toBe(
			"The nucleus holds the DNA.",
		);
		// The pipeline's note is copied into the project, unchanged.
		expect(
			readFileSync(join(materials, NOTES_DIR, `${FILE_ID}.md`), "utf8"),
		).toBe("# note from the pipeline\n");
	});

	it("exports a bundle the app's own parser accepts, with the answers filled in", () => {
		const outcome = adoptMaterial(materials, work, curriculum, ID);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		const model = readModel(materials);
		expect(model.ok).toBe(true);
		if (!model.ok) return;
		// An exam's optional fields are null in memory; the file must not carry them.
		expect(model.model.courses[0]?.exams[0]?.papers[0]?.parts[0]?.marks).toBe(
			null,
		);
		const filled = filledModel(
			model.model,
			"A. Teacher",
			"For my own students only.",
		);
		expect(filled.ok).toBe(true);
		if (!filled.ok) return;
		const text = bundleText(outcome.project, filled.model, 1, ["science"]);
		expect(text.ok).toBe(true);
		if (!text.ok) return;
		const parsed = parseBundle(text.text, ["science"]);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.bundle.courses[0]?.exams[0]?.name).toBe("Block 1 test");
			expect(text.text).not.toContain("null");
		}
	});

	it("opens the project a second time instead of adopting it again", () => {
		expect(adoptMaterial(materials, work, curriculum, ID).ok).toBe(true);
		const after = snapshot(materials);
		const again = adoptMaterial(materials, work, curriculum, ID);
		expect(again.ok).toBe(true);
		if (again.ok) expect(again.already).toBe(true);
		expect(snapshot(materials)).toEqual(after);
	});

	it("says why when the work folder is not there", () => {
		rmSync(join(work, "index.csv"));
		const outcome = adoptMaterial(materials, work, curriculum, ID);
		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.code).toBe("noWork");
	});

	it("writes nothing when the curriculum folder is broken", () => {
		const before = snapshot(materials);
		write(join(curriculum, "grade-7-science-en.json"), "{ not json");
		const outcome = adoptMaterial(materials, work, curriculum, ID);
		expect(outcome.ok).toBe(false);
		expect(snapshot(materials)).toEqual(before);
	});
});
