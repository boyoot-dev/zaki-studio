// OpenRouter, for the notes the author writes with their own key (task 157). The pattern is
// copied from app/src/server/tutor/openrouter.ts — the same headers, the same
// `provider.data_collection: "deny"`, so no provider keeps or trains on the material — and
// not imported, because the Studio may take only app/src/lib (task 156's import guard).
//
// The key is used here and nowhere else: it goes in the Authorization header of the requests
// below, and never into a message, a log, a file or an answer to the page. The material goes
// in the user content only; the system text is the rules and the sentence that says the
// material is data. A test drives every request with a fake fetch, so no test costs money.

import { DATA_RULE, NOTE_MAX_IMAGES } from "../shared/notes.ts";

/** How long one note request may take before it is given up on. */
const TIMEOUT_MS = 300_000;

/** Max output tokens for one note. OpenRouter's models all accept this for a long reply. */
const MAX_TOKENS = 16_000;

/** What went wrong, in the words the page and the runner decide with. */
export type NoteErrorKind = "key" | "credit" | "rate" | "unavailable" | "bad";

export class NoteError extends Error {
	/** Written out rather than a parameter property: the trial script runs under Node's
	 * type stripping, which refuses that syntax (found 2026-11-13). */
	readonly kind: NoteErrorKind;

	constructor(kind: NoteErrorKind, message: string) {
		super(message);
		this.kind = kind;
	}
}

/** One note request: the rules, the first user line, the file's text, and its pictures. */
export type NoteRequest = {
	model: string;
	system: string;
	first: string;
	text: string;
	images: { page: number; dataUrl: string }[];
	maxTokens?: number;
};

/** What one request gave: the reply, its real tokens, its cost when OpenRouter says it. */
export type NoteReply = {
	body: string;
	in: number;
	out: number;
	costUsd: number | null;
	/** True when the reply stopped at its length limit. */
	cut: boolean;
};

/** A way to ask for a note; the app passes the real one, a test passes its own. */
export type AskNotes = (request: NoteRequest) => Promise<NoteReply>;

/** The sentence the system text ends with, so the model never treats a file as a command. */
export function systemText(rules: string): string {
	return `${rules.trimEnd()}\n\n${DATA_RULE}`;
}

/** The request body, built without touching the network, so a test can read it. */
export function noteBody(request: NoteRequest): Record<string, unknown> {
	const content: unknown[] = [
		{ type: "text", text: `${request.first}\n\n${request.text}` },
	];
	for (const image of request.images.slice(0, NOTE_MAX_IMAGES)) {
		content.push({ type: "text", text: `Page ${image.page}` });
		content.push({ type: "image_url", image_url: { url: image.dataUrl } });
	}
	return {
		model: request.model,
		messages: [
			{ role: "system", content: request.system },
			{ role: "user", content },
		],
		temperature: 0.2,
		max_tokens: request.maxTokens ?? MAX_TOKENS,
		usage: { include: true },
		// Always "deny": the material is a family's own, and no provider may keep it.
		provider: { data_collection: "deny" },
	};
}

/** The headers every request carries. The key is in this object and nowhere else. */
export function noteHeaders(key: string): Record<string, string> {
	return {
		Authorization: `Bearer ${key}`,
		"Content-Type": "application/json",
		"HTTP-Referer": "https://zaki.boyoot.dev",
		"X-Title": "Mr. Zaki Studio",
	};
}

/** What OpenRouter's reply says, as much as the notes need. */
type ChatReply = {
	error?: { code?: number; message?: string };
	choices?: {
		message?: { content?: string | null };
		finish_reason?: string;
	}[];
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		cost?: number;
	};
};

/** The kind a failed reply names, from its code. */
function kindOf(code: number): NoteErrorKind {
	if (code === 401 || code === 403) return "key";
	if (code === 402) return "credit";
	if (code === 429) return "rate";
	return "unavailable";
}

/** A note's request to OpenRouter, with the author's key. One call per note part. */
export async function askOpenRouter(
	key: string,
	request: NoteRequest,
	fetchImpl: typeof fetch = fetch,
): Promise<NoteReply> {
	let response: Response;
	try {
		response = await fetchImpl(
			"https://openrouter.ai/api/v1/chat/completions",
			{
				method: "POST",
				headers: noteHeaders(key),
				body: JSON.stringify(noteBody(request)),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			},
		);
	} catch (error) {
		throw new NoteError("unavailable", `Request failed: ${String(error)}`);
	}
	const body = (await response.json().catch(() => null)) as ChatReply | null;
	const code = body?.error?.code ?? (response.ok ? 0 : response.status);
	if (code !== 0) {
		throw new NoteError(
			kindOf(code),
			body?.error?.message ?? `HTTP ${response.status}`,
		);
	}
	const choice = body?.choices?.[0];
	const text = choice?.message?.content;
	if (typeof text !== "string")
		throw new NoteError("bad", "No note in the reply");
	return {
		body: text,
		in: body?.usage?.prompt_tokens ?? 0,
		out: body?.usage?.completion_tokens ?? 0,
		costUsd: typeof body?.usage?.cost === "number" ? body.usage.cost : null,
		cut: choice?.finish_reason === "length",
	};
}

/** One model as OpenRouter's public list describes it, priced per million tokens. */
export type ModelInfo = {
	id: string;
	name: string;
	/** True when the model reads pictures; a text-only model gets OCR text only. */
	readsImages: boolean;
	priceIn: number | null;
	priceOut: number | null;
};

/** A price as OpenRouter writes it (US dollars per token, as text) in per-million tokens. */
function perMillion(value: unknown): number | null {
	const price = typeof value === "string" ? Number(value) : value;
	if (typeof price !== "number" || !Number.isFinite(price)) return null;
	// Four decimals of a dollar per million is finer than any real price.
	return Math.round(price * 1_000_000 * 10_000) / 10_000;
}

/** One model's line of OpenRouter's list. */
function modelFrom(value: unknown): ModelInfo | null {
	if (typeof value !== "object" || value === null) return null;
	const raw = value as {
		id?: unknown;
		name?: unknown;
		architecture?: { input_modalities?: unknown };
		pricing?: { prompt?: unknown; completion?: unknown };
	};
	if (typeof raw.id !== "string" || raw.id === "") return null;
	const modalities = Array.isArray(raw.architecture?.input_modalities)
		? raw.architecture.input_modalities
		: [];
	return {
		id: raw.id,
		name: typeof raw.name === "string" ? raw.name : raw.id,
		readsImages: modalities.includes("image"),
		priceIn: perMillion(raw.pricing?.prompt),
		priceOut: perMillion(raw.pricing?.completion),
	};
}

/** OpenRouter's public model list. No key is needed, and none is sent. */
export async function modelList(
	fetchImpl: typeof fetch = fetch,
): Promise<ModelInfo[]> {
	const response = await fetchImpl("https://openrouter.ai/api/v1/models", {
		method: "GET",
		signal: AbortSignal.timeout(30_000),
	});
	const body = (await response.json().catch(() => null)) as {
		data?: unknown[];
	} | null;
	if (!Array.isArray(body?.data)) return [];
	return body.data
		.map(modelFrom)
		.filter((model): model is ModelInfo => model !== null);
}

/** One model from the public list, or null when the list doesn't have it. */
export async function modelInfo(
	id: string,
	fetchImpl: typeof fetch = fetch,
): Promise<ModelInfo | null> {
	const models = await modelList(fetchImpl);
	return models.find((model) => model.id === id) ?? null;
}

/** The result of "Test": a tiny request, so the author learns the key works. */
export type KeyTest =
	| { ok: true; model: string }
	| { ok: false; code: NoteErrorKind; detail: string };

/**
 * Sends one tiny request with the author's key and model. It costs a handful of tokens,
 * well under a cent, and it is the only request the Studio makes that the author did not
 * ask a note for.
 */
export async function testKey(
	key: string,
	model: string,
	fetchImpl: typeof fetch = fetch,
): Promise<KeyTest> {
	try {
		await askOpenRouter(
			key,
			{
				model,
				system: "You are testing a connection. Answer with one word.",
				first: "Reply with the word OK.",
				text: "",
				images: [],
				maxTokens: 8,
			},
			fetchImpl,
		);
		return { ok: true, model };
	} catch (error) {
		if (error instanceof NoteError)
			return { ok: false, code: error.kind, detail: error.message };
		return { ok: false, code: "unavailable", detail: String(error) };
	}
}
