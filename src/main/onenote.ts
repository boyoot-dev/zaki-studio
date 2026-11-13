// One note, written with the author's key (task 157): each part's text and its unread
// pictures in a request, the reply cleaned and checked, and the parts joined under one header.
// Kept apart from src/main/notes.ts, and importing nothing that needs the app's own modules,
// so the notes trial can run the very same code under plain Node (2026-11-13).
//
// Cost: one page is about 300 input and 700 output tokens; the request holds the run's
// budget before it is sent, so two requests in flight cannot both spend the last cents.

import type { FileRow } from "../shared/model.ts";
import {
	clean,
	cost,
	estimateTokens,
	header,
	IMAGE_TOKENS,
	intro,
	NOTE_MAX_IMAGES,
	NOTE_PART,
	type NoteUsage,
	noteFile,
	PAGE_TOKENS_OUT,
	splitParts,
	unreadImages,
	usable,
} from "../shared/notes.ts";
import {
	type AskNotes,
	NoteError,
	type NoteReply,
	systemText,
} from "./openrouter.ts";

/** One row of .studio/usage.csv, as notes-usage.csv writes it, with the real cost. */
export type UsageRow = {
	time: string;
	id: string;
	model: string;
	part: number;
	input: number;
	output: number;
	estimated: boolean;
	images: number;
	seconds: number;
	cost: number;
};

/** "2026-11-13T08:30:00": the local time, to the second, as notes.py logs it. */
export function stamp(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** A picture page as the data URL a chat-completions request carries. */
function dataUrl(bytes: Uint8Array): string {
	return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

/** One file's note, written from its text and its unread pictures. */
export type OneInput = {
	row: FileRow;
	curriculum: string;
	text: string;
	/** A page's picture, or null when it was not drawn. */
	page: (page: number) => Uint8Array | null;
	ask: AskNotes;
	model: string;
	rules: string;
	today: Date;
	priceIn: number | null;
	priceOut: number | null;
	/**
	 * Holds this much of the run's budget for one request, or null when it would pass the
	 * limit. The returned function gives the hold back, so two requests in flight cannot
	 * both spend the same last cents.
	 */
	reserve: (usd: number) => (() => void) | null;
	/** Called after every request with what it cost and its usage row. */
	spent: (usd: number, row: UsageRow) => void;
	/** False for a model that cannot read pictures: no picture is attached, and the
	 * page markers stay as they are, so the note says the page was not seen. */
	images?: boolean;
	now?: () => Date;
};

/** What writing one note gave. */
export type OneResult =
	| { ok: true; note: string; spentUsd: number }
	| {
			ok: false;
			/** "fatal" stops the whole run: the key is wrong or there is no credit. */
			code: "limit" | "unusable" | "failed" | "fatal";
			reason: string;
	  };

/** The page count of one part, for its output estimate. */
function pagesIn(partText: string): number {
	return Math.max(1, partText.split(/^## Page /m).length - 1);
}

/** What one request is expected to cost before it is sent; unknown prices count as zero. */
function requestEstimate(
	input: OneInput,
	partText: string,
	images: number,
): number {
	const tokensIn =
		estimateTokens(
			`${input.rules}${input.model}${intro(input.row, input.curriculum)}${partText}`,
		) +
		images * IMAGE_TOKENS;
	const tokensOut = pagesIn(partText) * PAGE_TOKENS_OUT;
	return cost(tokensIn, tokensOut, input.priceIn, input.priceOut) ?? 0;
}

/**
 * One note: each part's text and its unread pictures in a request, the reply cleaned and
 * checked, and the parts joined under one header. A reply `usable` refuses is not saved.
 */
export async function oneNote(input: OneInput): Promise<OneResult> {
	const parts = splitParts(input.text, NOTE_PART);
	const bodies: string[] = [];
	const unseen: number[] = [];
	const usage: NoteUsage = { in: 0, out: 0, estimated: false, images: 0 };
	let spentUsd = 0;

	for (const [index, partText] of parts.entries()) {
		const part = index + 1;
		const first =
			intro(input.row, input.curriculum) +
			(parts.length > 1
				? ` This is part ${part} of ${parts.length} of the file.`
				: "");
		const images: { page: number; dataUrl: string }[] = [];
		for (const unread of input.images === false ? [] : unreadImages(partText)) {
			if (images.length >= NOTE_MAX_IMAGES) {
				unseen.push(unread.page);
				continue;
			}
			const bytes = input.page(unread.page);
			// A page whose picture was never drawn stays a marker in the text, and the rules
			// make the note say it was not seen; only the twenty-picture cap is listed.
			if (bytes === null) continue;
			images.push({ page: unread.page, dataUrl: dataUrl(bytes) });
		}
		const estimate = requestEstimate(input, partText, images.length);
		const release = input.reserve(estimate);
		if (release === null)
			return { ok: false, code: "limit", reason: "the spending limit" };
		try {
			const started = (input.now ?? (() => new Date()))();
			let reply: NoteReply | null = null;
			let problem = "";
			for (let attempt = 0; attempt < 2 && reply === null; attempt += 1) {
				try {
					reply = await input.ask({
						model: input.model,
						system: systemText(input.rules),
						first,
						text: partText,
						images,
					});
				} catch (error) {
					if (
						error instanceof NoteError &&
						(error.kind === "key" || error.kind === "credit")
					)
						return { ok: false, code: "fatal", reason: error.message };
					problem = error instanceof Error ? error.message : String(error);
				}
			}
			if (reply === null)
				return { ok: false, code: "failed", reason: problem.slice(0, 200) };

			const usd =
				reply.costUsd ??
				cost(reply.in, reply.out, input.priceIn, input.priceOut) ??
				0;
			spentUsd += usd;
			input.spent(usd, {
				time: stamp(started),
				id: input.row.id,
				model: input.model,
				part,
				input: reply.in,
				output: reply.out,
				estimated: false,
				images: images.length,
				seconds: Math.round((Date.now() - started.getTime()) / 1000),
				cost: usd,
			});
			usage.in = (usage.in ?? 0) + reply.in;
			usage.out = (usage.out ?? 0) + reply.out;
			usage.images += images.length;

			let body = clean(reply.body);
			if (reply.cut)
				body += "\n\n[note cut off: the reply reached its length limit]";
			if (!usable(body))
				return {
					ok: false,
					code: "unusable",
					reason: `${body.length} characters`,
				};
			bodies.push(body);
		} finally {
			release();
		}
	}

	const head = header(
		input.row,
		input.curriculum,
		input.model,
		usage,
		input.today,
	);
	return {
		ok: true,
		note: noteFile(head, bodies, unseen),
		spentUsd,
	};
}
