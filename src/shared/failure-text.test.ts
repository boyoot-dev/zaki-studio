// failureText: the text alone, or with the project path it was about (task 240).

import { describe, expect, it } from "vitest";
import { failureText, pathDetail } from "./failure-text";

describe("failureText", () => {
	it("says the text alone when the failure has no detail", () => {
		expect(failureText("en", { ok: false, code: "unknown" })).toBe(
			"Something went wrong. Try again; if it happens again, restart the Studio.",
		);
	});

	it("puts a project path after the first sentence, before the next step", () => {
		expect(
			failureText("en", {
				ok: false,
				code: "missing",
				detail: "Grade 11/Chemistry/Books/part1.pdf",
			}),
		).toBe(
			"That file or folder is not there any more: Grade 11/Chemistry/Books/part1.pdf. Look for new material to refresh the list.",
		);
		expect(
			failureText("ar", { ok: false, code: "nameTaken", detail: "part 1.pdf" }),
		).toBe("هذا الاسم مستخدم في هذا المجلد: part 1.pdf. اختر اسمًا آخر.");
	});

	it("leaves out internal details and the computer's own paths", () => {
		const plain = failureText("ar", { ok: false, code: "missing" });
		for (const detail of [
			"no change set to accept",
			"C:Usersmecurriculum.json is not there",
			"/home/me/x.pdf",
		])
			expect(failureText("ar", { ok: false, code: "missing", detail })).toBe(
				plain,
			);
		expect(
			pathDetail({ ok: false, code: "invalidName", detail: "a/b.pdf" }),
		).toBe("");
	});

	it("says nothing for a cancelled dialog", () => {
		expect(failureText("en", { ok: false, code: "cancelled" })).toBe("");
	});
});
