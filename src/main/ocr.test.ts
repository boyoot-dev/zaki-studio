// Tesseract's settings (task 156): a scan reads pages on this computer, and nothing about it
// may name a server. These tests hold the options to local paths inside the Studio's own
// folder, hold the worker to the small file that turns relaxed SIMD off (the float models the
// owner uses abort on it), and hold the pool to at most four workers.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
	missingLangs,
	ocrEngine,
	ocrOptions,
	ocrPoolSize,
	ocrTextFile,
	TESSDATA,
	TESSDATA_LANGS,
	tessdataDir,
} from "./ocr";

/** The Studio's own folder, as the app passes it. */
const STUDIO = fileURLToPath(new URL("../../", import.meta.url));

describe("the OCR options", () => {
	const options = ocrOptions(STUDIO);

	it("names only local paths, and never a server", () => {
		for (const path of [
			options.workerPath,
			options.langPath,
			options.corePath,
			options.cachePath,
		]) {
			expect(path).not.toContain("http");
			expect(path).not.toContain("//");
			expect(path.startsWith(STUDIO)).toBe(true);
		}
	});

	it("keeps nothing between scans: no cache, and the raw language files", () => {
		expect(options.cacheMethod).toBe("none");
		expect(options.gzip).toBe(false);
	});

	it("starts Tesseract's worker through the Studio's own file, which exists", () => {
		expect(options.workerPath).toBe(
			`${STUDIO}resources\\ocr-worker.cjs`.split("\\").join("\\"),
		);
		expect(existsSync(options.workerPath)).toBe(true);
	});

	it("reads the language files from resources/tessdata, which git ignores", () => {
		expect(options.langPath).toBe(tessdataDir(STUDIO));
		expect(options.langPath.endsWith("resources\\tessdata")).toBe(true);
		expect(Object.keys(TESSDATA).sort()).toEqual(["ara", "eng", "fra"]);
		expect([...TESSDATA_LANGS]).toEqual(["ara", "eng", "fra"]);
		// The hashes are the owner's own files (checked 2026-11-13); they are the download's guard.
		expect(TESSDATA.ara).toHaveLength(64);
		expect(TESSDATA.eng).toHaveLength(64);
		expect(TESSDATA.fra).toHaveLength(64);
	});

	it("says which language files are not on disk yet", () => {
		const missing = missingLangs(STUDIO, "ara+eng");
		expect(Array.isArray(missing)).toBe(true);
		expect(missingLangs(STUDIO, "eng")).toEqual(
			existsSync(`${tessdataDir(STUDIO)}\\eng.traineddata`) ? [] : ["eng"],
		);
	});
});

describe("the OCR pool", () => {
	it("uses at most four workers, and leaves one core for the window", () => {
		expect(ocrPoolSize(16)).toBe(4);
		expect(ocrPoolSize(4)).toBe(3);
		expect(ocrPoolSize(2)).toBe(1);
		expect(ocrPoolSize(1)).toBe(1);
	});

	it("puts its workers away when it is closed", async () => {
		const engine = ocrEngine(STUDIO, 1);
		// Nothing is started until a page is read: closing an idle pool is quiet.
		await engine.close();
		expect(await engine.text(new Uint8Array([1]), "eng")).toBe("");
	});

	it("keeps a page's reading beside its picture", () => {
		expect(ocrTextFile("C:/p/.studio/pages/abc/p007.png")).toBe(
			"C:/p/.studio/pages/abc/p007.ocr.txt",
		);
	});
});
