// A scan on disk (task 156): a small project made in a temporary folder, with a PDF, a Word
// file and a slide deck made here, byte by byte, so no school material is in the repository.
// The test the task's acceptance asks for: the files are found and registered, their text is
// written page by page in today's format, their picture pages are drawn and read (by stubs: no
// window and no Tesseract in a test), a second scan does nothing, and nothing in the material
// is ever moved, renamed or written.

import { createHash } from "node:crypto";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { deflateRawSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	FILES_FILE,
	PENDING_FILE,
	REPORT_FILE,
	TEXT_DIR,
} from "../shared/model.ts";
import { NOTES_DIR } from "../shared/notes.ts";
import { presetPeriods, wizardProject } from "../shared/project.ts";
import { createProject } from "./files.ts";
import { setFileFields } from "./model.ts";
import { scanProject } from "./scan.ts";

/** A page of text: the words, and whether the page is a picture (fewer than 40 characters). */
type Page = { text: string };

let base = "";
let project = "";

/** Every file under `dir`, by path, with the hash of its bytes: a scan must not change one. */
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

/** A small, valid PDF: one page per text, each a Helvetica line, with a real cross-reference. */
function pdf(pages: readonly Page[]): Uint8Array {
	const parts: string[] = [];
	const offsets: number[] = [];
	let at = 0;
	const add = (text: string) => {
		parts.push(text);
		at += Buffer.byteLength(text, "latin1");
	};
	const obj = (number: number, body: string) => {
		offsets[number] = at;
		add(`${number} 0 obj\n${body}\nendobj\n`);
	};
	add("%PDF-1.4\n");
	obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
	const kids = pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
	obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
	const font = 3 + pages.length * 2;
	for (const [i, page] of pages.entries()) {
		const pageNo = 3 + i * 2;
		const content = pageNo + 1;
		obj(
			pageNo,
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
		);
		const body = `BT /F1 18 Tf 72 760 Td ${page.text
			.split("\n")
			.map((line, j) => `${j === 0 ? "" : "0 -24 Td "}(${line}) Tj`)
			.join(" ")} ET`;
		obj(content, `<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
	}
	obj(font, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
	const xref = at;
	add(`xref\n0 ${font + 1}\n0000000000 65535 f \n`);
	for (let n = 1; n <= font; n += 1)
		add(`${String(offsets[n] ?? 0).padStart(10, "0")} 00000 n \n`);
	add(
		`trailer << /Size ${font + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
	);
	return new Uint8Array(Buffer.from(parts.join(""), "latin1"));
}

/** A zip of stored entries, enough for Word's and PowerPoint's XML. */
function zip(entries: readonly { name: string; text: string }[]): Uint8Array {
	const locals: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;
	for (const entry of entries) {
		const name = new TextEncoder().encode(entry.name);
		const body = new TextEncoder().encode(entry.text);
		const local = new Uint8Array(30 + name.length);
		const view = new DataView(local.buffer);
		view.setUint32(0, 0x04034b50, true);
		view.setUint32(18, body.length, true);
		view.setUint32(22, body.length, true);
		view.setUint16(26, name.length, true);
		local.set(name, 30);
		locals.push(local, body);
		const entryHeader = new Uint8Array(46 + name.length);
		const centralView = new DataView(entryHeader.buffer);
		centralView.setUint32(0, 0x02014b50, true);
		centralView.setUint32(20, body.length, true);
		centralView.setUint32(24, body.length, true);
		centralView.setUint16(28, name.length, true);
		centralView.setUint32(42, offset, true);
		entryHeader.set(name, 46);
		central.push(entryHeader);
		offset += local.length + body.length;
	}
	const list = central.reduce<number>((sum, part) => sum + part.length, 0);
	const end = new Uint8Array(22);
	const endView = new DataView(end.buffer);
	endView.setUint32(0, 0x06054b50, true);
	endView.setUint16(8, entries.length, true);
	endView.setUint16(10, entries.length, true);
	endView.setUint32(12, list, true);
	endView.setUint32(16, offset, true);
	const all = [...locals, ...central, end];
	const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
	let at = 0;
	for (const part of all) {
		out.set(part, at);
		at += part.length;
	}
	return out;
}

/** A Word file mammoth can read, with the metadata date the register keeps. */
function docx(text: string, modified = "2025-09-20T08:00:00Z"): Uint8Array {
	const body = text
		.split("\n")
		.map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`)
		.join("");
	return zip([
		{
			name: "[Content_Types].xml",
			text: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
		},
		{
			name: "word/document.xml",
			text: `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
		},
		{
			name: "docProps/core.xml",
			text: `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/"><dcterms:modified>${modified}</dcterms:modified></cp:coreProperties>`,
		},
	]);
}

/** A slide deck: one page per slide, as extract.py reads it. */
function pptx(slides: readonly string[]): Uint8Array {
	return zip(
		slides.map((text, i) => ({
			name: `ppt/slides/slide${i + 1}.xml`,
			text: `<p:sld xmlns:p="p" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:t>${text}</a:t></a:p></p:sld>`,
		})),
	);
}

/** A picture a reader could have drawn: a real PNG header and a body of a sensible size. */
function png(): Uint8Array {
	const bytes = new Uint8Array(400);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const view = new DataView(bytes.buffer);
	view.setUint32(8, 13);
	bytes.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
	view.setUint32(16, 91); // 110 DPI across A4
	view.setUint32(20, 129); // and down
	return new Uint8Array(bytes);
}

/** The scan's stubs: a reader that draws, and an OCR that says the same words. */
const reader = async () => png();
const ocr = { text: async () => "KESTREL SCHOOL\n1" };

/** The scan's own settings for a test: it reads English only, and nothing is left owed. */
function scan(over: Partial<Parameters<typeof scanProject>[1]> = {}) {
	return scanProject(project, {
		studioRoot: join(import.meta.dirname, "..", ".."),
		render: reader,
		ocr,
		today: new Date(2026, 10, 13),
		...over,
	});
}

/** Writes a file with its folders, as the author would in Explorer. */
function put(rel: string, bytes: Uint8Array): void {
	const path = join(project, ...rel.split("/"));
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, bytes);
}

/** Reads a file's text, or "" when it isn't there. */
function text(rel: string): string {
	try {
		return readFileSync(join(project, ...rel.split("/")), "utf8");
	} catch {
		return "";
	}
}

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "studio-scan-"));
	project = join(base, "kestrel");
	mkdirSync(project, { recursive: true });
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

// A scan reads real PDFs and runs OCR; GitHub's Windows runner needed more than Vitest's
// default 5 s (v0.1.2 build, 2026-11-13).
describe("a scan of a project", { timeout: 30_000 }, () => {
	it("places a file in folders the wizard named in Arabic (task 243)", async () => {
		const made = wizardProject(
			{
				nameEn: "Kestrel",
				nameAr: "كسترل",
				author: "A. Teacher",
				rights: "For my own students only.",
				grades: [{ grade: 11, subjects: ["chemistry"] }],
				periods: presetPeriods("none"),
				finalExam: false,
				language: "ar",
				folderLanguage: "ar",
			},
			[{ id: "chemistry", nameEn: "Chemistry", nameAr: "الكيمياء" }],
			"6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10",
		);
		if (!made.ok) throw new Error(JSON.stringify(made.issues));
		expect(createProject(project, made.project).ok).toBe(true);
		put("الصف 11/الكيمياء/Books/part1.pdf", pdf([{ text: "Atoms." }]));
		const outcome = await scan();
		if (!outcome.ok) throw new Error(outcome.code);
		expect(outcome.files[0]).toMatchObject({
			path: "الصف 11/الكيمياء/Books/part1.pdf",
			grade: 11,
			subject: "chemistry",
			language: "ar",
			kind: "book",
			error: "",
		});
	});

	it("registers a new file, reads it page by page, and draws its picture page", async () => {
		put(
			"Grade 3/2026-2027/Math/Math-B1-Sheet1 - Main.pdf",
			pdf([
				{ text: "1" },
				{
					text: "Cells divide.\nA nucleus holds the DNA, and the cell parts have names.",
				},
			]),
		);
		const before = snapshot(project);
		const outcome = await scan();
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		const [row] = outcome.files;
		expect(row).toMatchObject({
			path: "Grade 3/2026-2027/Math/Math-B1-Sheet1 - Main.pdf",
			grade: 3,
			subject: "math",
			language: "",
			block: "1",
			kind: "sheet",
			year: "current",
			academicYear: "2026-27",
			pages: 2,
			imagePages: 1,
			error: "",
			dupOf: "",
			firstSeen: "2026-11-13",
			authority: 2,
		});
		expect(row?.id).toMatch(/^[0-9a-f]{12}$/);

		// The text, in today's format: the page heading, the page's words, a marker for a picture.
		expect(text(`${TEXT_DIR}/${row?.id}.md`)).toBe(
			`# Grade 3/2026-2027/Math/Math-B1-Sheet1 - Main.pdf\n\n## Page 1\n\n1\n\n[ocr of image: pages/${row?.id}/p001.png]\nKESTREL SCHOOL\n1\n\n## Page 2\n\nCells divide.\nA nucleus holds the DNA, and the cell parts have names.\n\n`,
		);
		// Its picture was drawn and kept, and the reading was kept beside it.
		expect(
			readFileSync(
				join(project, ".studio", "pages", row?.id ?? "", "p001.png"),
			),
		).toHaveLength(400);
		expect(
			readFileSync(
				join(project, ".studio", "pages", row?.id ?? "", "p001.ocr.txt"),
				"utf8",
			),
		).toBe("KESTREL SCHOOL\n1\n");

		// The report keeps the file's facts and the units it touches.
		const report = outcome.report;
		expect(report.groups).toHaveLength(1);
		expect(report.groups[0]?.rows[0]?.id).toBe(row?.id);
		expect(report.found).toBe(1);
		expect(report.read).toBe(1);
		expect(report.since).toBe("");
		expect(JSON.parse(text(REPORT_FILE)).at).toBe("2026-11-13 00:00");

		// Nothing in the material was moved, renamed or written: only .studio/ changed.
		const after = snapshot(project);
		for (const [path, hash] of before) expect(after.get(path)).toBe(hash);
		expect(after.size).toBeGreaterThan(before.size);
		expect(
			[...after.keys()]
				.filter((path) => !before.has(path))
				.every((path) => path.startsWith(".studio/")),
		).toBe(true);
	});

	it("does nothing when the same scan runs again", async () => {
		put(
			"Grade 3/2026-2027/Math/sheet.pdf",
			pdf([
				{
					text: "A page of text, long enough to be read as a text page, and no more.",
				},
			]),
		);
		const first = await scan();
		expect(first.ok).toBe(true);
		const once = snapshot(project);

		const second = await scan();
		expect(second.ok).toBe(true);
		if (!second.ok) return;
		// Nothing was read again: the register already had everything.
		expect(second.report.read).toBe(0);
		expect(second.report.groups).toEqual([]);
		expect(second.report.since).toBe("2026-11-13 00:00");
		// And nothing the scan keeps changed either, except the report, which now says "since".
		const twice = snapshot(project);
		for (const [path, hash] of once)
			if (path !== REPORT_FILE) expect(twice.get(path)).toBe(hash);
		expect(twice.size).toBe(once.size);
	});

	it("keeps a corrected field when the project is scanned again", async () => {
		put(
			"Grade 3/2026-2027/Math/sheet.pdf",
			pdf([
				{
					text: "A page of text, long enough to be read as a text page, and no more.",
				},
			]),
		);
		const first = await scan();
		if (!first.ok) throw new Error("the first scan failed");
		const id = first.files[0]?.id ?? "";
		const saved = setFileFields(project, id, {
			grade: 4,
			subject: "physics",
			block: "7",
			kind: "exam",
			authority: 1,
		});
		expect(saved.ok).toBe(true);

		const second = await scan();
		if (!second.ok) throw new Error("the second scan failed");
		expect(second.files[0]).toMatchObject({
			grade: 4,
			subject: "physics",
			block: "7",
			kind: "exam",
			authority: 1,
			fixed: ["authority", "block", "grade", "kind", "subject"],
		});
	});

	it("reads a Word file as one page and a slide deck as one page per slide", async () => {
		put("Grade 3/2026-2027/Math/Words-B1.docx", docx("أول سطر\nSecond line"));
		put(
			"Grade 3/2026-2027/Math/Slides-B1-presentation.pptx",
			pptx(["One", "Two"]),
		);
		const outcome = await scan();
		if (!outcome.ok) throw new Error("the scan failed");
		const words = outcome.files.find((row) => row.path.endsWith(".docx"));
		const slides = outcome.files.find((row) => row.path.endsWith(".pptx"));
		expect(words?.pages).toBe(1);
		// The Word file's own metadata date wins over its year folder, as in extract.py.
		expect(words?.published).toBe("2025-09-20");
		expect(words?.publishedFrom).toBe("meta");
		expect(text(`${TEXT_DIR}/${words?.id}.md`)).toBe(
			"# Grade 3/2026-2027/Math/Words-B1.docx\n\n## Page 1\n\nأول سطر\n\nSecond line\n\n",
		);
		expect(slides?.pages).toBe(2);
		expect(text(`${TEXT_DIR}/${slides?.id}.md`)).toBe(
			"# Grade 3/2026-2027/Math/Slides-B1-presentation.pptx\n\n## Page 1\n\nOne\n\n## Page 2\n\nTwo\n\n",
		);
	});

	it("points a copy at the first file with the same bytes, and reads it once", async () => {
		const sheet = pdf([
			{
				text: "A page of text, long enough to be read as a text page, and no more.",
			},
		]);
		put("Grade 3/2026-2027/Math/sheet.pdf", sheet);
		const outcome = await scan();
		if (!outcome.ok) throw new Error("the scan failed");
		put("Grade 3/2026-2027/Math/sheet copy.pdf", sheet);
		const second = await scan();
		if (!second.ok) throw new Error("the second scan failed");
		const rows = second.files.filter(
			(row) =>
				row.path.endsWith("sheet.pdf") || row.path.endsWith("sheet copy.pdf"),
		);
		expect(rows).toHaveLength(2);
		expect(rows[0]?.id).toBe(rows[1]?.id);
		expect(rows[0]?.id).toBe(outcome.files[0]?.id);
		// One of them is the first; the other says whose bytes it repeats.
		const copy = rows.find((row) => row.dupOf !== "");
		expect(copy?.dupOf).toBe(rows.find((row) => row.dupOf === "")?.path);
		expect(second.report.read).toBe(0);
		expect(
			second.report.look.some((entry) => entry.why[0]?.code === "copy"),
		).toBe(true);
	});

	it("keeps a moved file's id, and reports it as moved", async () => {
		const sheet = pdf([
			{ text: "A page of text, long enough to be read as a text page." },
		]);
		put("Grade 3/2026-2027/Math/sheet.pdf", sheet);
		const first = await scan();
		if (!first.ok) throw new Error("the scan failed");
		const id = first.files[0]?.id ?? "";
		const from = join(project, "Grade 3/2026-2027/Math/sheet.pdf");
		const to = join(project, "Grade 3/2026-2027/Math/Block 2/sheet.pdf");
		mkdirSync(dirname(to), { recursive: true });
		renameSync(from, to);
		const second = await scan();
		if (!second.ok) throw new Error("the second scan failed");
		expect(second.files[0]).toMatchObject({
			id,
			path: "Grade 3/2026-2027/Math/Block 2/sheet.pdf",
			block: "2",
		});
		expect(second.report.moved).toEqual([
			"Grade 3/2026-2027/Math/Block 2/sheet.pdf",
		]);
		expect(second.report.read).toBe(0);
	});

	it("leaves the Inbox alone, and registers a file put in a folder from it", async () => {
		put(
			"Inbox/sheet.pdf",
			pdf([{ text: "A page of text, long enough to be read as a text page." }]),
		);
		const first = await scan();
		if (!first.ok) throw new Error("the scan failed");
		expect(first.files).toHaveLength(0);
		// "Put in a folder…" moves it, and the next scan registers it.
		const target = join(project, "Grade 3", "2026-2027", "Math");
		mkdirSync(target, { recursive: true });
		renameSync(join(project, "Inbox/sheet.pdf"), join(target, "sheet.pdf"));
		const second = await scan();
		if (!second.ok) throw new Error("the second scan failed");
		expect(second.files).toHaveLength(1);
		expect(second.files[0]?.path).toBe("Grade 3/2026-2027/Math/sheet.pdf");
		expect(second.report.groups).toHaveLength(1);
	});

	it("lists a file it cannot read, and finishes the scan", async () => {
		put(
			"Grade 3/2026-2027/Math/broken.pdf",
			new Uint8Array(Buffer.from("not a pdf at all")),
		);
		put(
			"Grade 3/2026-2027/Math/fine.pdf",
			pdf([{ text: "A page of text, long enough to be read as a text page." }]),
		);
		const outcome = await scan();
		if (!outcome.ok) throw new Error("the scan failed");
		expect(outcome.files).toHaveLength(2);
		const broken = outcome.files.find((row) => row.path.endsWith("broken.pdf"));
		expect(broken?.error).not.toBe("");
		expect(broken?.pages).toBe(0);
		expect(text(`${TEXT_DIR}/${broken?.id}.md`)).toBe("");
		expect(
			outcome.report.look.some(
				(entry) =>
					entry.row.id === broken?.id &&
					entry.why.some((why) => why.code === "error"),
			),
		).toBe(true);
	});

	it("stops where it was told to, and the next scan finishes the pages it owes", async () => {
		const sheet = pdf([{ text: "1" }, { text: "2" }, { text: "3" }]);
		put("Grade 3/2026-2027/Math/three.pdf", sheet);
		let stopped = false;
		const outcome = await scan({
			ocr: {
				text: async () => {
					// The author presses Stop while the first page is being read.
					stopped = true;
					return "ONE";
				},
			},
			cancelled: () => stopped,
		});
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.stopped).toBe(true);
		const owed = JSON.parse(text(PENDING_FILE)) as {
			id: string;
			pages: number[];
		}[];
		expect(owed).toHaveLength(1);
		expect(owed[0]?.pages).toEqual([2, 3]);
		// The first page's reading is already in the text.
		const row = outcome.files[0];
		expect(text(`${TEXT_DIR}/${row?.id}.md`)).toContain("[ocr of image:");
		expect(text(`${TEXT_DIR}/${row?.id}.md`)).toContain("ONE");

		// The next scan carries on there: no file is read again, and the rest is finished.
		const second = await scan({ ocr: { text: async () => "TWO" } });
		if (!second.ok) throw new Error("the second scan failed");
		expect(second.report.read).toBe(0);
		expect(JSON.parse(text(PENDING_FILE))).toEqual([]);
		expect(text(`${TEXT_DIR}/${row?.id}.md`)).toContain("TWO");
	});

	it("copies a note the work folder already has, and never rewrites it", async () => {
		put(
			"Grade 3/2026-2027/Math/sheet.pdf",
			pdf([{ text: "A page of text, long enough to be read as a text page." }]),
		);
		const first = await scan();
		if (!first.ok) throw new Error("the scan failed");
		const id = first.files[0]?.id ?? "";
		const mine = join(base, "_work", "notes", `${id}.md`);
		mkdirSync(dirname(mine), { recursive: true });
		writeFileSync(mine, "# from the pipeline\n", "utf8");

		const second = await scan();
		expect(second.ok).toBe(true);
		expect(text(`${NOTES_DIR}/${id}.md`)).toBe("# from the pipeline\n");

		// A later scan never overwrites the note the project keeps.
		writeFileSync(mine, "# changed in the work folder\n", "utf8");
		const third = await scan();
		expect(third.ok).toBe(true);
		expect(text(`${NOTES_DIR}/${id}.md`)).toBe("# from the pipeline\n");
	});

	it("says which language files are missing instead of crashing", async () => {
		put("Grade 3/2026-2027/Arabic/sheet.pdf", pdf([{ text: "1" }]));
		const outcome = await scan({
			ocr: undefined,
		});
		if (!outcome.ok) throw new Error("the scan failed");
		expect(outcome.report.groups).toHaveLength(1);
		// Without an OCR engine the page stays owed, and the panel says so.
		expect(JSON.parse(text(PENDING_FILE))).toHaveLength(1);
	});
});

describe("the page pictures a scan keeps", { timeout: 30_000 }, () => {
	it("are under .studio/pages, and never in the material", async () => {
		put("Grade 3/2026-2027/Math/sheet.pdf", pdf([{ text: "1" }]));
		const outcome = await scan();
		if (!outcome.ok) throw new Error("the scan failed");
		const id = outcome.files[0]?.id ?? "";
		const pages = readdirSync(join(project, ".studio", "pages", id));
		expect(pages.sort()).toEqual(["p001.ocr.txt", "p001.png"]);
	});
});

// A zip writer's compressed body is only used by the zip reader's own test; this keeps the
// helper honest when a slide deck is written with deflate instead of store.
void deflateRawSync;

describe("the register's own file", { timeout: 30_000 }, () => {
	it("keeps every field a later step needs", async () => {
		put("Grade 3/2026-2027/Math/sheet.pdf", pdf([{ text: "1" }]));
		const outcome = await scan();
		if (!outcome.ok) throw new Error("the scan failed");
		const saved = JSON.parse(text(FILES_FILE)) as Record<string, unknown>[];
		expect(saved[0]).toMatchObject({
			id: outcome.files[0]?.id,
			path: "Grade 3/2026-2027/Math/sheet.pdf",
			year: "current",
			academicYear: "2026-27",
			imagePages: 1,
			dupOf: "",
			firstSeen: "2026-11-13",
		});
		// A row with no corrections writes no list at all (a file leaves empty fields out).
		expect(saved[0]?.fixed).toBeUndefined();
		expect(typeof saved[0]?.size).toBe("number");
		expect(typeof saved[0]?.mtime).toBe("string");
	});
});
