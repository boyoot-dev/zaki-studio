// The job folder itself (task 157): README.md, rules.md, files/ in parts of whole pages, the
// unread pictures under pages/<id>/, and an empty out/. Kept apart from src/main/job.ts and
// importing nothing from the app, so the notes trial can write the very same folder under
// plain Node with the notes trial (2026-11-13).
//
// Nothing here decides where the folder is: the app builds it under .studio/jobs through
// safePath, and the trial script names its own outside the repository.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
	type JobFileLine,
	type JobRecord,
	type JobTool,
	jobPrompt,
	jobReadme,
	jobToday,
	picturesForPart,
} from "../shared/job.ts";
import type { FileRow } from "../shared/model.ts";
import { intro, splitParts, unreadImages } from "../shared/notes.ts";

/** Everything a job folder is written from. */
export type FolderInput = {
	/** The folder to write; it may already exist. */
	folder: string;
	rows: readonly FileRow[];
	curriculum: string;
	/** The Studio's copy of note-rules.md, unchanged. */
	rules: string;
	tool: JobTool;
	now: Date;
	/** A file's text; "" for a file without one. */
	text: (id: string) => string;
	/** A page's picture bytes, or null when it was not drawn. */
	page: (id: string, page: number) => Uint8Array | null;
};

/** What was written, or why nothing was. */
export type FolderResult =
	| { ok: true; name: string; path: string; prompt: string; files: number }
	| { ok: false; code: "missing" | "unreadable" };

/** Writes one file of the job's files/ folder: the first user line, then its part's text. */
function partFile(
	row: FileRow,
	curriculum: string,
	part: number,
	total: number,
	text: string,
): string {
	const first =
		intro(row, curriculum) +
		(total > 1 ? ` This is part ${part} of ${total} of the file.` : "");
	return `${first}\n\n${text}`;
}

/**
 * Writes a job folder for the selected files. A job with no text to read writes nothing: the
 * files are checked before the folder is made.
 */
export function writeJobFolder(input: FolderInput): FolderResult {
	const prepared = input.rows.flatMap((row) => {
		const body = input.text(row.id);
		return body === "" ? [] : [{ row, parts: splitParts(body) }];
	});
	if (prepared.length === 0) return { ok: false, code: "missing" };
	const name = basename(input.folder);
	try {
		mkdirSync(join(input.folder, "files"), { recursive: true });
		mkdirSync(join(input.folder, "out"), { recursive: true });
		writeFileSync(join(input.folder, "rules.md"), input.rules, "utf8");
		const lines: JobFileLine[] = [];
		for (const { row, parts } of prepared) {
			const pictures = new Set<number>();
			for (const [index, partText] of parts.entries()) {
				const part = index + 1;
				const fileName =
					part === 1 ? `${row.id}.md` : `${row.id}.part${part}.md`;
				writeFileSync(
					join(input.folder, "files", fileName),
					partFile(row, input.curriculum, part, parts.length, partText),
					"utf8",
				);
				const { taken } = picturesForPart(unreadImages(partText));
				for (const picture of taken) {
					const bytes = input.page(row.id, picture.page);
					if (bytes === null) continue;
					const target = join(input.folder, "pages", row.id);
					mkdirSync(target, { recursive: true });
					const png = join(
						target,
						`p${String(picture.page).padStart(3, "0")}.png`,
					);
					if (!existsSync(png)) writeFileSync(png, bytes);
					pictures.add(picture.page);
				}
			}
			lines.push({
				id: row.id,
				path: row.path,
				grade: row.grade,
				subject: row.subject,
				block: row.block,
				kind: row.kind,
				pages: row.pages ?? 0,
				pictures: [...pictures].sort((a, b) => a - b),
			});
		}
		const record: JobRecord = {
			name,
			created: jobToday(input.now),
			tool: input.tool,
			kind: "notes",
			ids: lines.map((line) => line.id),
			courses: [],
			exams: [],
		};
		writeFileSync(
			join(input.folder, "job.json"),
			`${JSON.stringify(record, null, "\t")}\n`,
			"utf8",
		);
		writeFileSync(
			join(input.folder, "README.md"),
			jobReadme(input.tool, input.curriculum, lines),
			"utf8",
		);
		return {
			ok: true,
			name,
			path: input.folder,
			prompt: jobPrompt(input.folder, input.tool),
			files: lines.length,
		};
	} catch {
		return { ok: false, code: "unreadable" };
	}
}
