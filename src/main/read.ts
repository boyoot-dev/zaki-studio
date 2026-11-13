// Reading a file's text (task 156), the way tools/materials/extract.py does: PDF pages from
// pdf.js's text layer, Word with mammoth, PowerPoint one page per slide from the zip's own XML.
// A page with fewer than 40 characters is a picture page, and so is a page with a picture and
// fewer than 400 characters, so the scan knows which pages Tesseract must read.
//
// Everything is local: pdf.js and mammoth are the packages the Studio already ships, and the
// zip reader is src/main/zip.ts. Nothing here writes a file or makes a network call.

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
	parseIsoDate,
	parsePdfDate,
	type ReadGive,
} from "../shared/register.ts";
import { zipEntries, zipRead, zipText } from "./zip.ts";

/** Fewer characters than this on a page means it is a picture, as extract.py has it. */
export const TEXT_MIN = 40;
/** A page with a picture and less text than this is read from its picture too. */
export const PARTIAL_MAX = 400;

/** The page size the pipeline renders at: enough for small print, small enough to read quickly. */
export const DPI = 110;

/** The kind of file a path is, by its extension, or "" for a kind the Studio doesn't read. */
export function fileKind(path: string): "pdf" | "docx" | "pptx" | "" {
	const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
	if (ext === "pdf" || ext === "docx" || ext === "pptx") return ext;
	return "";
}

/**
 * pdf.js's own fonts, beside it in node_modules: local files, never a network font. pdf.js
 * wants them as a URL with a slash at the end, so this is a file:// URL of that folder.
 */
function fontsFolder(): string | undefined {
	try {
		const folder = fileURLToPath(
			new URL("../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url),
		);
		return existsSync(folder) ? `${pathToFileURL(folder).href}/` : undefined;
	} catch {
		return undefined;
	}
}

/** pdf.js's Node build, loaded once: it is a large module and a scan may read many files. */
let pdfjs: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null =
	null;

function loadPdfjs(): Promise<
	typeof import("pdfjs-dist/legacy/build/pdf.mjs")
> {
	pdfjs ??= import("pdfjs-dist/legacy/build/pdf.mjs");
	return pdfjs;
}

/** One page's text from pdf.js's items: words as they come, a line at each end-of-line. */
function linesOf(
	items: readonly { str?: unknown; hasEOL?: unknown }[],
): string {
	let text = "";
	for (const item of items) {
		if (typeof item.str !== "string") continue;
		text += item.str;
		text += item.hasEOL === true ? "\n" : " ";
	}
	return text
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/, ""))
		.join("\n")
		.trim();
}

/** True when the page's operator list paints a picture (a photograph, a scan or a drawing). */
function paintsPicture(
	operations: readonly number[],
	pictures: ReadonlySet<number>,
): boolean {
	return operations.some((operation) => pictures.has(operation));
}

/** A file's pages as extract.py writes them: the page's text, and which pages are pictures. */
async function readPdf(bytes: Uint8Array): Promise<ReadGive> {
	const { getDocument, OPS } = await loadPdfjs();
	const pictures = new Set<number>([
		OPS.paintImageXObject,
		OPS.paintInlineImageXObject,
		OPS.paintImageMaskXObject,
	]);
	const fonts = fontsFolder();
	const task = getDocument({
		// A copy, because pdf.js takes the bytes for its worker and the same file is drawn by the
		// reader window afterwards.
		data: bytes.slice(),
		// A form's own script is never run, and the console stays quiet: a warning about one
		// font is not something the author can act on.
		enableXfa: false,
		verbosity: 0,
		...(fonts === undefined ? {} : { standardFontDataUrl: fonts }),
	});
	const doc = await task.promise;
	try {
		const info = await doc.getMetadata().then(
			(meta) => (meta.info ?? {}) as Record<string, unknown>,
			() => ({}) as Record<string, unknown>,
		);
		const text = (key: string): string =>
			typeof info[key] === "string" ? (info[key] as string) : "";
		const metaDate =
			parsePdfDate(text("ModDate")) ??
			parsePdfDate(text("modDate")) ??
			parsePdfDate(text("CreationDate")) ??
			parsePdfDate(text("creationDate")) ??
			"";
		const pages: string[] = [];
		const images: number[] = [];
		for (let number = 1; number <= doc.numPages; number += 1) {
			const page = await doc.getPage(number);
			const content = await page.getTextContent();
			const pageText = linesOf(
				content.items as { str?: unknown; hasEOL?: unknown }[],
			);
			const list = await page.getOperatorList();
			const pictured = paintsPicture(list.fnArray, pictures);
			pages.push(pageText);
			if (
				pageText.length < TEXT_MIN ||
				(pageText.length < PARTIAL_MAX && pictured)
			)
				images.push(number);
			page.cleanup();
		}
		return { pages, images, metaDate, error: "" };
	} finally {
		await task.destroy();
	}
}

/** A Word file's text, as mammoth reads it: the text only, never the document's markup. */
async function readWord(bytes: Uint8Array): Promise<ReadGive> {
	const mammoth = await import("mammoth");
	const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
	return { pages: [result.value.trim()], images: [], metaDate: "", error: "" };
}

/** Office metadata dates from docProps/core.xml: when the file was last saved, else created. */
function officeDate(
	bytes: Uint8Array,
	entries: ReturnType<typeof zipEntries>,
): string {
	const xml = zipText(bytes, entries, "docProps/core.xml");
	for (const tag of ["dcterms:modified", "dcterms:created"]) {
		const match = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`).exec(xml);
		const date = match === null ? null : parseIsoDate(match[1] ?? "");
		if (date !== null) return date;
	}
	return "";
}

/** The text of one slide's XML, by extract.py's own rule: paragraph ends become lines. */
function slideText(xml: string): string {
	return xml
		.replace(/<\/w:p>|<\/a:p>/g, "\n")
		.replace(/<[^>]+>/g, "")
		.trim();
}

/** A PowerPoint file's text: one page per slide, in the slides' own order. */
function readSlides(bytes: Uint8Array): ReadGive {
	const entries = zipEntries(bytes);
	const slides = entries
		.map((entry) => ({
			entry,
			number: /^ppt\/slides\/slide(\d+)\.xml$/.exec(entry.name)?.[1],
		}))
		.filter((slide) => slide.number !== undefined)
		.sort((a, b) => Number(a.number) - Number(b.number));
	const pages = slides.map(({ entry }) =>
		slideText(
			new TextDecoder("utf-8", { fatal: false }).decode(zipRead(bytes, entry)),
		),
	);
	return { pages, images: [], metaDate: officeDate(bytes, entries), error: "" };
}

/**
 * One file's text, page by page, and why it couldn't be read when it couldn't. A broken file
 * gives an error a person can read (at most 120 characters, as extract.py keeps it) and no
 * pages; it never stops the scan.
 */
export async function readTextFile(
	path: string,
	bytes: Uint8Array,
): Promise<ReadGive> {
	const ext = fileKind(path);
	if (ext === "")
		return {
			pages: [],
			images: [],
			metaDate: "",
			error: "not a file the Studio reads",
		};
	try {
		if (ext === "pdf") return await readPdf(bytes);
		if (ext === "docx") {
			const read = await readWord(bytes);
			let metaDate = "";
			// A Word file whose metadata the Studio can't read is still a readable document.
			try {
				metaDate = officeDate(bytes, zipEntries(bytes));
			} catch {
				metaDate = "";
			}
			return { ...read, metaDate };
		}
		return readSlides(bytes);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			pages: [],
			images: [],
			metaDate: "",
			error: message.slice(0, 120),
		};
	}
}
