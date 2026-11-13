// A file's text, page by page, in exactly the form the local pipeline writes it (task 156,
// tools/materials/extract.py and ocr.py): a "# <path>" line, then "## Page N" for each page,
// its text, and a marker for a page that is a picture. OCR later puts its reading in place of
// that marker, marked for review when it is Arabic. Pure and tested, so the Studio's text can
// be compared with the pipeline's page for page.

/** Where one page's picture is kept, relative to the project: "pages/<id>/p007.png". */
export function pagePng(id: string, page: number): string {
	return `pages/${id}/p${String(page).padStart(3, "0")}.png`;
}

/** The line extract.py writes for a page it has not read from its picture. */
export function imageMarker(id: string, page: number): string {
	return `[image page: ${pagePng(id, page)}]`;
}

/** The line ocr.py puts in place of it once Tesseract has read the page. */
export function ocrMarker(id: string, page: number): string {
	return `[ocr of image: ${pagePng(id, page)}]`;
}

/** True when the text holds an Arabic letter, which makes an OCR reading worth a check. */
export function hasArabic(text: string): boolean {
	return /[\u0600-\u06FF]/.test(text);
}

/**
 * One file's text as extract.py writes it: the page heading, then the page's own text when it
 * has any, then the picture marker when the page is a picture. Nothing else, so the file can be
 * compared with the pipeline's byte for byte.
 */
export function textFile(
	rel: string,
	pages: readonly string[],
	images: readonly number[],
	id: string,
): string {
	const pictured = new Set(images);
	let out = `# ${rel}\n\n`;
	for (const [i, text] of pages.entries()) {
		const page = i + 1;
		out += `## Page ${page}\n\n`;
		const body = text.trim();
		if (body !== "") out += `${body}\n\n`;
		if (pictured.has(page)) out += `${imageMarker(id, page)}\n\n`;
	}
	return out;
}

/**
 * The file's text with one image page's OCR reading in place of its marker, as ocr.py writes
 * it. An Arabic reading starts with the line the pipeline adds for readings that may be
 * misread. Text the file doesn't hold a marker for is left alone, so a second run changes
 * nothing.
 */
export function withOcr(
	text: string,
	id: string,
	page: number,
	reading: string,
): string {
	const marker = imageMarker(id, page);
	if (!text.includes(marker)) return text;
	const body = reading.trim();
	const checked =
		body !== "" && hasArabic(body)
			? `[arabic: check against the page]\n${body}`
			: body;
	return text.replace(
		marker,
		`${ocrMarker(id, page)}\n${checked === "" ? "(no text found)" : checked}`,
	);
}

/** True when the text still has the marker for this page's picture. */
export function hasImageMarker(
	text: string,
	id: string,
	page: number,
): boolean {
	return text.includes(imageMarker(id, page));
}

/**
 * One page of a file's text (`resources/_work/text/<id>.md`, or .studio/text): the lines under
 * "## Page 7", up to the next page. "" when the file has no such page.
 */
export function pageText(markdown: string, page: number): string {
	if (!Number.isInteger(page) || page < 1) return "";
	const heading = /^#{1,3}\s*Page\s+(\d{1,4})\s*$/i;
	const lines: string[] = [];
	let found = false;
	for (const line of markdown.split(/\r?\n/)) {
		const match = heading.exec(line);
		if (match !== null) {
			if (found) break;
			found = Number(match[1]) === page;
			continue;
		}
		if (found) lines.push(line);
	}
	return lines.join("\n").trim();
}
