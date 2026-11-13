// Tesseract's language data, fetched once and checked (task 156). A scan reads picture pages
// with Tesseract in the Studio, offline, so the three language files it reads with live in
// studio/resources/tessdata (ignored by git, like every large download).
//
// Each file is taken from the official tesseract-ocr repository at a fixed tag, and its SHA-256
// is checked against the owner's own copies, so a changed file stops here rather than at a
// misread page:
//   ara, fra: tesseract-ocr/tessdata_best, tag 4.1.0
//   eng:      tesseract-ocr/tessdata_fast, tag 4.1.0
// The owner's eng file is the fast model and the other two are the best model (found 2026-11-13:
// no single repository holds all three hashes). Running it again is safe: a file that is
// already right is not downloaded again.
//
// Run it with: npm run tessdata

import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { TESSDATA, TESSDATA_DIR, tessdataDir } from "../src/main/ocr.ts";

/** The Studio folder, one up from scripts/. */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The official file each language comes from, and the tag it is pinned to. */
export const SOURCES: { lang: string; repo: string; tag: string }[] = [
	{ lang: "ara", repo: "tessdata_best", tag: "4.1.0" },
	{ lang: "eng", repo: "tessdata_fast", tag: "4.1.0" },
	{ lang: "fra", repo: "tessdata_best", tag: "4.1.0" },
];

/** Where one language file is downloaded from, at a fixed tag. */
export function sourceUrl(source: {
	lang: string;
	repo: string;
	tag: string;
}): string {
	return `https://raw.githubusercontent.com/tesseract-ocr/${source.repo}/${source.tag}/${source.lang}.traineddata`;
}

/** The SHA-256 of some bytes, in lowercase hex, as the language list records it. */
export function sha256(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

/** Fetches one file, checks it, and writes it; says what happened in one line. */
async function fetchLang(source: {
	lang: string;
	repo: string;
	tag: string;
}): Promise<boolean> {
	const folder = tessdataDir(ROOT);
	const path = join(folder, `${source.lang}.traineddata`);
	const wanted = TESSDATA[source.lang];
	if (wanted === undefined) return false;
	if (
		existsSync(path) &&
		sha256(new Uint8Array(readFileSync(path))) === wanted
	) {
		console.log(`${source.lang}: already there, and its SHA-256 matches`);
		return true;
	}
	mkdirSync(folder, { recursive: true });
	const url = sourceUrl(source);
	console.log(`${source.lang}: downloading ${url}`);
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(`${url}: ${response.status} ${response.statusText}`);
	const bytes = new Uint8Array(await response.arrayBuffer());
	const got = sha256(bytes);
	if (got !== wanted) {
		throw new Error(
			`${source.lang}: the file's SHA-256 is ${got}, not ${wanted}. Nothing was written.`,
		);
	}
	// Written under a temporary name first, so a download that stops halfway never leaves a
	// half-file where Tesseract would read it.
	const part = `${path}.part`;
	writeFileSync(part, bytes);
	renameSync(part, path);
	console.log(`${source.lang}: ${bytes.length} bytes, SHA-256 matches`);
	return true;
}

async function main(): Promise<void> {
	let failed = false;
	for (const source of SOURCES) {
		try {
			await fetchLang(source);
		} catch (error) {
			failed = true;
			console.error(error instanceof Error ? error.message : String(error));
		}
	}
	// A file left from a download that failed mid-way is not a language file: remove it.
	for (const name of [".part"]) {
		for (const lang of Object.keys(TESSDATA)) {
			const part = join(tessdataDir(ROOT), `${lang}.traineddata${name}`);
			if (existsSync(part)) rmSync(part, { force: true });
		}
	}
	console.log(`The language files are in ${join(ROOT, TESSDATA_DIR)}.`);
	if (failed) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("tessdata.ts") === true) await main();
