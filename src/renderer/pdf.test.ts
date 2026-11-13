// The PDF viewer's settings, read from its source and from the version of pdf.js we ship. A
// PDF comes from anywhere, so two things must stay true: the document's own markup never
// runs, and the viewer paints pages without building a clickable layer on them.
//
// pdf.js has one known hole in this area, CVE-2024-4367: before 4.2.67 a font program inside
// a PDF ran script inside pdf.js, and the guard against it was the `isEvalSupported: false`
// option. Since pdf.js 5 that eval path is gone and the option with it, so this version needs
// no flag for it; what it needs is to stay above the fix. The version test below is that
// guard, and the source test holds the settings we do have.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
	fileURLToPath(new URL("./viewers/Pdf.tsx", import.meta.url)),
	"utf8",
);

const pkg = JSON.parse(
	readFileSync(
		fileURLToPath(
			new URL("../../node_modules/pdfjs-dist/package.json", import.meta.url),
		),
		"utf8",
	),
) as { version: string };

/** A version like "6.4.299" as numbers, so two of them can be compared. */
function parts(version: string): number[] {
	return version.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

/** True when `version` is at least `floor`, comparing part by part. */
function atLeast(version: string, floor: string): boolean {
	const a = parts(version);
	const b = parts(floor);
	for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
		const left = a[i] ?? 0;
		const right = b[i] ?? 0;
		if (left !== right) return left > right;
	}
	return true;
}

describe("the PDF viewer", () => {
	it("runs pdf.js newer than the CVE-2024-4367 fix", () => {
		expect(atLeast(pkg.version, "4.2.67")).toBe(true);
	});

	it("runs no XFA form from a document", () => {
		expect(source).toContain("enableXfa: false");
	});

	it("paints annotations not at all, so no link in a PDF can be clicked", () => {
		expect(source).toContain("annotationMode: AnnotationMode.DISABLE");
		expect(source).not.toContain("AnnotationLayer");
		expect(source).not.toContain("dangerouslySetInnerHTML");
	});
});
