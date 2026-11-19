// The counted nouns of the Studio's words (task 238): a count string puts its number before
// a noun only through {n:noun}, and Arabic agreement comes from Intl.PluralRules("ar"), so
// 0, 1, 2, 3–10, 11–99, 100 and 103 each read as Arabic does.

import { describe, expect, it } from "vitest";

import { isCountedNoun, studioText, t } from "./i18n.ts";

describe("Arabic counts", () => {
	const cases: [number, string][] = [
		[0, "لا ملفات"],
		[1, "ملف واحد"],
		[2, "ملفان"],
		[3, "3 ملفات"],
		[10, "10 ملفات"],
		[11, "11 ملفًا"],
		[99, "99 ملفًا"],
		[100, "100 ملف"],
		[101, "101 ملف"],
		[102, "102 ملف"],
		[103, "103 ملفات"],
	];

	for (const [n, text] of cases)
		it(`says ${n} files as Arabic does`, () => {
			expect(t("ar", "project.files", { n })).toBe(text);
		});
});

describe("English counts", () => {
	it("says one and other", () => {
		expect(t("en", "project.files", { n: 0 })).toBe("0 files");
		expect(t("en", "project.files", { n: 1 })).toBe("1 file");
		expect(t("en", "project.files", { n: 2 })).toBe("2 files");
	});
});

describe("count strings", () => {
	it("fills every count with its own noun", () => {
		expect(
			t("en", "changes.targetLine", {
				units: 0,
				lessons: 1,
				files: 2,
				notes: 3,
			}),
		).toBe("0 units · 1 lesson · 2 files · 3 with a note");
	});

	it("names only nouns the table knows", () => {
		for (const text of [
			...Object.values(studioText.en),
			...Object.values(studioText.ar),
		]) {
			for (const match of text.matchAll(/\{\w+:(\w+)\}/g))
				expect(isCountedNoun(match[1] ?? "")).toBe(true);
		}
	});

	it("leaves a plain placeholder alone when its value is missing", () => {
		expect(t("en", "notes.failedLine", { name: "sheet.pdf" })).toBe(
			"sheet.pdf failed: {reason}",
		);
	});
});
