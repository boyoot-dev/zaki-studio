// The text file's own format, held to today's byte for byte (task 156): the "# <path>" heading,
// "## Page N" per page, the page's text, and a marker for a page that is a picture. The OCR
// reading then goes in the marker's place, marked for review when it is Arabic. These are the
// three shapes the pipeline writes, so the Studio's text can be compared with its own.

import { describe, expect, it } from "vitest";

import {
	hasArabic,
	hasImageMarker,
	imageMarker,
	ocrMarker,
	pagePng,
	pageText,
	textFile,
	withOcr,
} from "./text.ts";

const ID = "9a010f4b4816";

describe("a file's text", () => {
	it("writes today's format, page by page, with a marker for a picture page", () => {
		expect(
			textFile("Grade 7/Science/Units/sheet.pdf", ["Cells divide."], [], ID),
		).toBe(
			"# Grade 7/Science/Units/sheet.pdf\n\n## Page 1\n\nCells divide.\n\n",
		);
	});

	it("keeps a page that is only a picture as its marker, and an empty page as its heading", () => {
		expect(textFile("Grade 3/exam.pdf", ["", "", "Answers."], [2], ID)).toBe(
			[
				"# Grade 3/exam.pdf",
				"",
				"## Page 1",
				"",
				"## Page 2",
				"",
				`[image page: pages/${ID}/p002.png]`,
				"",
				"## Page 3",
				"",
				"Answers.",
				"",
				"",
			].join("\n"),
		);
	});

	it("writes a Word file as its one page, and a slide deck as one page per slide", () => {
		expect(
			textFile("Grade 7/Words.docx", ["First line\nSecond line"], [], ID),
		).toBe("# Grade 7/Words.docx\n\n## Page 1\n\nFirst line\nSecond line\n\n");
		expect(textFile("Grade 7/Slides.pptx", ["One", "Two"], [], ID)).toBe(
			"# Grade 7/Slides.pptx\n\n## Page 1\n\nOne\n\n## Page 2\n\nTwo\n\n",
		);
	});
});

describe("a picture page's reading", () => {
	const page = textFile("Grade 3/exam.pdf", ["", "Text."], [1], ID);

	it("goes in the marker's place, as ocr.py writes it", () => {
		expect(withOcr(page, ID, 1, "KESTREL SCHOOL\n1")).toBe(
			`# Grade 3/exam.pdf\n\n## Page 1\n\n${ocrMarker(ID, 1)}\nKESTREL SCHOOL\n1\n\n## Page 2\n\nText.\n\n`,
		);
	});

	it("says so when Tesseract found no words on the page", () => {
		expect(withOcr(page, ID, 1, "   ")).toContain("(no text found)");
	});

	it("marks an Arabic reading for review, as the pipeline does", () => {
		expect(withOcr(page, ID, 1, "مدارس النيل")).toBe(
			`# Grade 3/exam.pdf\n\n## Page 1\n\n${ocrMarker(ID, 1)}\n[arabic: check against the page]\nمدارس النيل\n\n## Page 2\n\nText.\n\n`,
		);
		expect(hasArabic("مدارس")).toBe(true);
		expect(hasArabic("KESTREL 2026")).toBe(false);
	});

	it("changes nothing when the page has no marker left", () => {
		const read = withOcr(page, ID, 1, "KESTREL");
		expect(withOcr(read, ID, 1, "KESTREL")).toBe(read);
		expect(withOcr(page, ID, 2, "KESTREL")).toBe(page);
		expect(hasImageMarker(read, ID, 1)).toBe(false);
		expect(hasImageMarker(page, ID, 1)).toBe(true);
	});
});

describe("the names the pipeline uses", () => {
	it("numbers a page's picture to three digits, as pages/<id>/p007.png", () => {
		expect(pagePng(ID, 7)).toBe(`pages/${ID}/p007.png`);
		expect(imageMarker(ID, 7)).toBe(`[image page: pages/${ID}/p007.png]`);
		expect(ocrMarker(ID, 7)).toBe(`[ocr of image: pages/${ID}/p007.png]`);
	});

	it("reads one page's text back out of a file", () => {
		const text = textFile(
			"x.pdf",
			["A nucleus holds DNA.\nMore.", "Cells divide."],
			[],
			ID,
		);
		expect(pageText(text, 1)).toBe("A nucleus holds DNA.\nMore.");
		expect(pageText(text, 2)).toBe("Cells divide.");
		expect(pageText(text, 9)).toBe("");
	});
});
