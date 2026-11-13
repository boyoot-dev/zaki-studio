// Notes on disk, and the run that writes them with the author's key (task 157). A note is
// `.studio/notes/<id>.md`: the three-line header, then the body, exactly as the pipeline's
// work folder keeps it. A note is never rewritten unless the author asks.
//
// The run sends one request per part of a file (whole pages only), two files at a time, with
// at most twenty pictures a request, as notes.py does. A failed request is tried once more,
// and then the file is reported as failed with the reason. Empty or short replies are never
// saved. The spending limit stops the run before a request that would pass it.
//
// Cost: a page is about 300 input and 700 output tokens. At the default model's prices
// ($0.10 / $0.50 per million) that is about $0.0004 a page, so a 10-page sheet costs about
// half a cent and the default $2 limit covers roughly 5,000 pages.
//
// Every path is built from the project root here; nothing is read from the page but a file
// id. The key is used only by src/main/openrouter.ts and never written here.

import {
	appendFileSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { FileRow } from "../shared/model";
import {
	cost,
	DEFAULT_LIMIT_USD,
	DEFAULT_MODEL,
	estimateRun,
	NOTES_DIR,
	notingOrder,
	unreadImages,
} from "../shared/notes";
import { currentAcademicYear } from "../shared/register";
import { safePath } from "./files";
import { readTextFile } from "./model";
import { oneNote, type UsageRow } from "./onenote";
import {
	type AskNotes,
	askOpenRouter,
	type ModelInfo,
	modelInfo,
} from "./openrouter";

/** How many note requests run at once; more would only queue at OpenRouter. */
export const NOTE_WORKERS = 2;

/** The model and the limit, kept in the app's own folder (never in a project). */
export type NoteSettings = { model: string; limit: number };

/** Where the notes settings live: the app's user-data folder. */
export function settingsFile(userData: string): string {
	return join(userData, "notes.json");
}

/** Any settings file in the app's own folder, e.g. "units.json" for the units settings. */
export function settingsPath(userData: string, name: string): string {
	return join(userData, name);
}

/** A settings file's text, or `fallback` when it is missing or damaged. */
export function readSettings(
	file: string,
	fallback: NoteSettings,
): NoteSettings {
	try {
		const value: unknown = JSON.parse(readFileSync(file, "utf8"));
		if (typeof value !== "object" || value === null) return fallback;
		const raw = value as Record<string, unknown>;
		return {
			model: modelName(raw.model) ?? fallback.model,
			limit: money(raw.limit) ?? fallback.limit,
		};
	} catch {
		return fallback;
	}
}

/** Keeps a model and a limit, checked. Null when either is not acceptable. */
export function writeSettings(
	file: string,
	value: unknown,
): NoteSettings | null {
	if (typeof value !== "object" || value === null) return null;
	const raw = value as Record<string, unknown>;
	const model = modelName(raw.model);
	const limit = money(raw.limit);
	if (model === null || limit === null) return null;
	const settings: NoteSettings = { model, limit };
	try {
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, `${JSON.stringify(settings, null, "\t")}\n`, {
			encoding: "utf8",
			mode: 0o600,
		});
		return settings;
	} catch {
		return null;
	}
}

/** Reads the notes settings; a damaged file falls back to the defaults. */
export function readNoteSettings(userData: string): NoteSettings {
	return readSettings(settingsFile(userData), defaults());
}

function defaults(): NoteSettings {
	return { model: DEFAULT_MODEL, limit: DEFAULT_LIMIT_USD };
}

/** A model id as OpenRouter writes one, or null when it cannot be one. */
function modelName(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const model = value.trim();
	return /^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(model) ? model : null;
}

/** A spending limit in US dollars, from a cent to $100, or null when it cannot be one. */
function money(value: unknown): number | null {
	const amount = typeof value === "string" ? Number(value) : value;
	if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
	return amount >= 0.01 && amount <= 100
		? Math.round(amount * 100) / 100
		: null;
}

/** Keeps the author's model and limit, checked. Null when either is not acceptable. */
export function writeNoteSettings(
	userData: string,
	value: unknown,
): NoteSettings | null {
	return writeSettings(settingsFile(userData), value);
}

/** The note ids the project already keeps. */
export function noteIds(root: string): Set<string> {
	const found = new Set<string>();
	let names: string[] = [];
	try {
		names = readdirSync(join(root, NOTES_DIR));
	} catch {
		return found;
	}
	for (const name of names) {
		const match = /^([0-9a-f]{12})\.md$/.exec(name);
		if (match?.[1] !== undefined) found.add(match[1]);
	}
	return found;
}

/** True when the project already keeps this file's note. */
export function hasNote(root: string, id: string): boolean {
	return (
		/^[0-9a-f]{12}$/.test(id) && existsSync(join(root, NOTES_DIR, `${id}.md`))
	);
}

/** One file's note as it is kept, or "" when there is none. The page shows it as text. */
export function readNote(root: string, id: string): string {
	if (!/^[0-9a-f]{12}$/.test(id)) return "";
	try {
		return readFileSync(join(root, NOTES_DIR, `${id}.md`), "utf8");
	} catch {
		return "";
	}
}

/** Writes one note, replacing what was there; the caller decided it may be written. */
export function saveNote(root: string, id: string, text: string): boolean {
	if (!/^[0-9a-f]{12}$/.test(id)) return false;
	try {
		mkdirSync(join(root, NOTES_DIR), { recursive: true });
		writeFileSync(join(root, NOTES_DIR, `${id}.md`), text, "utf8");
		return true;
	} catch {
		return false;
	}
}

/**
 * Copies the notes a work folder already has into .studio/notes, once per id. Adoption and
 * every scan call this, so nothing written before is written again. A note that is already
 * there is left exactly as it is.
 */
export function copyNotes(
	root: string,
	notesFolder: string,
	ids: Iterable<string>,
): { copied: number } {
	let copied = 0;
	try {
		mkdirSync(join(root, NOTES_DIR), { recursive: true });
		for (const id of new Set(ids)) {
			if (!/^[0-9a-f]{12}$/.test(id)) continue;
			const from = join(notesFolder, `${id}.md`);
			const to = join(root, NOTES_DIR, `${id}.md`);
			if (existsSync(to)) continue;
			const info = statSync(from);
			if (!info.isFile() || info.size > 2 * 1024 * 1024) continue;
			copyFileSync(from, to);
			copied += 1;
		}
	} catch {
		// A work folder that isn't there is not a problem: the note is written later.
	}
	return { copied };
}

/** What the author sees before a run: what it will do, and what it is likely to cost. */
export type NotesPlan = {
	model: string;
	/** True when the live model list knows this id. */
	found: boolean;
	readsImages: boolean;
	priceIn: number | null;
	priceOut: number | null;
	files: number;
	pages: number;
	imagePages: number;
	/** US dollars, or null when the model's price is not known. */
	estimateUsd: number | null;
};

/** The files a run would note, in the order it would note them. */
export function chosenRows(
	rows: readonly FileRow[],
	noted: ReadonlySet<string>,
	today: Date,
	ids: readonly string[],
	redo: ReadonlySet<string> = new Set(),
): FileRow[] {
	const wanted = new Set(ids);
	return notingOrder(rows, noted, currentAcademicYear(today), redo).filter(
		(row) => wanted.size === 0 || wanted.has(row.id),
	);
}

/** The unread picture pages a file's text still names. */
function unreadPagesOf(root: string, row: FileRow): number {
	return unreadImages(readTextFile(root, row.id)).length;
}

/** The tokens per page the Studio's own usage log measured, for files the register knows. */
function usageTrial(
	root: string,
	rows: readonly FileRow[],
): { pages: number; in: number; out: number }[] {
	const byId = new Map(rows.map((row) => [row.id, row]));
	const tokens = new Map<string, { in: number; out: number }>();
	let text = "";
	try {
		text = readFileSync(join(root, ".studio", "usage.csv"), "utf8");
	} catch {
		return [];
	}
	for (const line of text.split(/\r?\n/).slice(1)) {
		if (line.trim() === "") continue;
		const fields = line.split(",");
		const id = fields[1] ?? "";
		const row = byId.get(id);
		if (row === undefined || row.error !== "") continue;
		const entry = tokens.get(id) ?? { in: 0, out: 0 };
		entry.in += Number(fields[4] ?? 0) || 0;
		entry.out += Number(fields[5] ?? 0) || 0;
		tokens.set(id, entry);
	}
	return [...tokens.entries()].flatMap(([id, entry]) => {
		const row = byId.get(id);
		if (row === undefined || (row.pages ?? 0) <= 0) return [];
		return [{ pages: row.pages ?? 0, in: entry.in, out: entry.out }];
	});
}

/** The live model's price and picture support, from OpenRouter's public list. */
async function prices(
	model: string,
	fetchImpl?: typeof fetch,
): Promise<ModelInfo | null> {
	try {
		return await modelInfo(model, fetchImpl);
	} catch {
		return null;
	}
}

/**
 * What a run over `ids` would do: the files, their pages, their unread pictures, and the cost
 * at the model's live price. `ids` empty means every file without a note.
 */
export async function planNotes(
	root: string,
	rows: readonly FileRow[],
	ids: readonly string[],
	model: string,
	today: Date,
	fetchImpl?: typeof fetch,
	redo: ReadonlySet<string> = new Set(),
): Promise<NotesPlan> {
	const chosen = chosenRows(rows, noteIds(root), today, ids, redo);
	const imagePages = chosen.reduce(
		(sum, row) => sum + unreadPagesOf(root, row),
		0,
	);
	const estimate = estimateRun(chosen, imagePages, usageTrial(root, rows));
	const info = await prices(model, fetchImpl);
	const priceIn = info?.priceIn ?? null;
	const priceOut = info?.priceOut ?? null;
	return {
		model,
		found: info !== null,
		readsImages: info?.readsImages ?? true,
		priceIn,
		priceOut,
		files: estimate.files,
		pages: estimate.pages,
		imagePages: estimate.imagePages,
		estimateUsd: costTokens(estimate.in, estimate.out, priceIn, priceOut),
	};
}

/** US dollars for tokens, or null when a price is unknown. */
function costTokens(
	tokensIn: number,
	tokensOut: number,
	priceIn: number | null,
	priceOut: number | null,
): number | null {
	const amount = cost(tokensIn, tokensOut, priceIn, priceOut);
	return amount === null ? null : Math.round(amount * 10000) / 10000;
}

/** A CSV field, quoted only when it must be. */
function csvField(value: string | number): string {
	const text = String(value);
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Appends one request's real tokens and cost to .studio/usage.csv. */
export function logUsage(root: string, row: UsageRow): void {
	try {
		const file = join(root, ".studio", "usage.csv");
		mkdirSync(join(root, ".studio"), { recursive: true });
		const newFile = !existsSync(file);
		const line = [
			row.time,
			row.id,
			row.model,
			row.part,
			row.input,
			row.output,
			row.estimated ? "yes" : "no",
			row.images,
			Math.round(row.seconds),
			row.cost.toFixed(6),
		]
			.map(csvField)
			.join(",");
		appendFileSync(
			file,
			`${newFile ? "time,id,model,part,input_tokens,output_tokens,estimated,images,seconds,cost_usd\n" : ""}${line}\n`,
			"utf8",
		);
	} catch {
		// A log that cannot be written never stops a note.
	}
}

/** What a run over some files gave. */
export type WriteOutcome = {
	written: string[];
	failed: { id: string; path: string; reason: string }[];
	/** True when the spending limit stopped the run. */
	stopped: boolean;
	spentUsd: number;
};

/** What a run needs, beyond the files and the settings. */
export type WriteInput = {
	root: string;
	rows: readonly FileRow[];
	ids: readonly string[];
	curriculum: string;
	model: string;
	key: string;
	rules: string;
	priceIn: number | null;
	priceOut: number | null;
	limitUsd: number;
	today: Date;
	/** False for a model that cannot read pictures; the OCR text is all it gets. */
	images?: boolean;
	redo?: ReadonlySet<string>;
	onProgress?: (done: number, total: number, id: string) => void;
	/** A test passes its own; the app gets the real OpenRouter request. */
	ask?: AskNotes;
	now?: () => Date;
};

/**
 * Writes the notes of the chosen files, two at a time. It stops before a request that would
 * pass the spending limit, never saves a note `usable` refuses, and leaves an existing note
 * alone unless the author asked to write it again.
 */
export async function writeNotes(input: WriteInput): Promise<WriteOutcome> {
	const chosen = chosenRows(
		input.rows,
		noteIds(input.root),
		input.today,
		input.ids,
		input.redo,
	);
	const total = chosen.length;
	const outcome: WriteOutcome = {
		written: [],
		failed: [],
		stopped: false,
		spentUsd: 0,
	};
	if (total === 0) return outcome;
	const ask = input.ask ?? openRouterAsker(input.key);
	let next = 0;
	let done = 0;
	let stop = false;
	let reserved = 0;

	/** Holds one request's share of the budget; two workers cannot pass the limit together. */
	const reserve = (usd: number): (() => void) | null => {
		if (stop || outcome.spentUsd + reserved + usd > input.limitUsd) return null;
		reserved += usd;
		let released = false;
		return () => {
			if (released) return;
			released = true;
			reserved -= usd;
		};
	};

	const worker = async () => {
		while (!stop && next < chosen.length) {
			const row = chosen[next];
			next += 1;
			if (row === undefined) return;
			const text = readTextFile(input.root, row.id);
			const result =
				text === ""
					? ({ ok: false, code: "failed", reason: "no text" } as const)
					: await oneNote({
							row,
							curriculum: input.curriculum,
							text,
							page: (page) => {
								const path = safePath(
									input.root,
									`.studio/pages/${row.id}/p${String(page).padStart(3, "0")}.png`,
								);
								if (path === null) return null;
								try {
									return new Uint8Array(readFileSync(path));
								} catch {
									return null;
								}
							},
							ask,
							model: input.model,
							rules: input.rules,
							today: input.today,
							priceIn: input.priceIn,
							priceOut: input.priceOut,
							reserve,
							spent: (usd, usage) => {
								outcome.spentUsd += usd;
								logUsage(input.root, usage);
							},
							images: input.images,
							now: input.now,
						});
			if (result.ok) {
				if (saveNote(input.root, row.id, result.note))
					outcome.written.push(row.id);
				else
					outcome.failed.push({
						id: row.id,
						path: row.path,
						reason: "the note could not be written",
					});
			} else if (result.code === "limit") {
				// The author's limit: the run stops here, and nothing is half-written.
				stop = true;
				outcome.stopped = true;
			} else if (result.code === "fatal") {
				// A wrong key or an empty account: every other file would fail the same way.
				stop = true;
				outcome.failed.push({
					id: row.id,
					path: row.path,
					reason: result.reason,
				});
			} else {
				outcome.failed.push({
					id: row.id,
					path: row.path,
					reason: result.reason,
				});
			}
			done += 1;
			input.onProgress?.(done, total, row.id);
		}
	};

	await Promise.all(
		Array.from({ length: Math.min(NOTE_WORKERS, total) }, () => worker()),
	);
	return outcome;
}

/** The real asker: one request per note part, with the author's key from safeStorage. */
function openRouterAsker(key: string): AskNotes {
	return (request) => askOpenRouter(key, request);
}
