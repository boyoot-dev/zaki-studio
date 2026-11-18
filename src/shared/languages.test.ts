// The languages the window offers and warns about (task 225).

import { describe, expect, it } from "vitest";
import {
	APP_LANGUAGES,
	cleanCourseLanguage,
	languageChoices,
	languageName,
	languageWarnings,
} from "./languages.ts";
import { presetPeriods, wizardProject } from "./project.ts";

describe("language names", () => {
	it("are the platform's, in the window's language", () => {
		expect(languageName("ar", "en")).toBe("Arabic");
		expect(languageName("fr", "en")).toBe("French");
		expect(languageName("en", "ar")).toBe("الإنجليزية");
		expect(languageName("native", "en")).toBe("The child's own language");
	});

	it("puts the languages Mr. Zaki teaches first", () => {
		const choices = languageChoices("en");
		expect(choices.slice(0, 3).map((c) => c.code)).toEqual([...APP_LANGUAGES]);
		expect(choices).toHaveLength(183);
	});
});

describe("language warnings", () => {
	it("name a course taught or helped in a language Mr. Zaki can't use yet", () => {
		expect(
			languageWarnings([
				{ grade: 7, subject: "physics", language: "de", support: [] },
				{
					grade: 3,
					subject: "english",
					language: "en",
					support: ["native", "tr"],
				},
				{ grade: 8, subject: "french", language: "fr", support: ["ar"] },
			]),
		).toEqual([
			{ grade: 7, subject: "physics", language: "de", kind: "teach" },
			{ grade: 3, subject: "english", language: "tr", kind: "help" },
		]);
	});
});

describe("a course's languages as the window sends them", () => {
	it("drop repeats, the teaching language, unknown codes, and anything past three", () => {
		expect(
			cleanCourseLanguage({
				grade: 3,
				subject: "english",
				language: "en",
				support: ["native", "en", "ar", "native", "xx", "fr", "de"],
			}),
		).toEqual({
			grade: 3,
			subject: "english",
			language: "en",
			support: ["native", "ar", "fr"],
		});
	});

	it("refuse a teaching language that is not a code", () => {
		expect(
			cleanCourseLanguage({
				grade: 3,
				subject: "math",
				language: "Arabic",
				support: [],
			}),
		).toBeNull();
	});
});

describe("the wizard's languages", () => {
	it("teach a language subject in its own language, and the rest in the main one", () => {
		const made = wizardProject(
			{
				nameEn: "N",
				nameAr: "ن",
				author: "A",
				rights: "R",
				grades: [{ grade: 5, subjects: ["math", "english", "french"] }],
				periods: presetPeriods("terms"),
				finalExam: false,
				language: "ar",
			},
			[
				{ id: "math", nameEn: "Mathematics", nameAr: "الرياضيات" },
				{
					id: "english",
					nameEn: "English",
					nameAr: "الإنجليزية",
					studies: "en",
				},
				{ id: "french", nameEn: "French", nameAr: "الفرنسية", studies: "fr" },
			],
			"6f1d2c9e-3b7a-4c1e-9a55-0d2f4b8e7a10",
		);
		if (!made.ok) throw new Error(JSON.stringify(made.issues));
		expect(
			made.project.grades[0]?.subjects.map((s) => [s.subject, s.language]),
		).toEqual([
			["math", "ar"],
			["english", "en"],
			["french", "fr"],
		]);
	});
});
