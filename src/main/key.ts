// The author's OpenRouter key (task 157), kept by Electron's safeStorage in the app's own
// folder and never in a project, a log or a message to the page. The page may save a key,
// ask whether one is set, clear it, and ask the main process to try it once; nothing here
// returns the key itself. The file is encrypted by the operating system's own store, so a
// copied file is useless on another account or computer.
//
// Cost: only "try it" sends a request, and it is a few tokens (well under $0.001).

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** What the app needs from Electron's safeStorage, so a test can give its own. */
export type Secrets = {
	/** True when the computer has a store the key can be encrypted with. */
	available(): boolean;
	encrypt(text: string): Buffer;
	decrypt(bytes: Buffer): string;
};

/** What the page may learn: whether a key is set, and whether this computer can keep one. */
export type KeyState = { set: boolean; available: boolean };

/** Why a key was not kept. The page turns each into a sentence. */
export type KeySaved =
	| { ok: true }
	| { ok: false; code: "noStorage" | "invalid" | "unreadable" };

/** The largest key OpenRouter issues is far smaller than this. */
const MAX_KEY = 512;
const MIN_KEY = 16;

/** Where the encrypted key lives: the app's own folder, never the project. */
export function keyFile(userData: string): string {
	return join(userData, "openrouter.bin");
}

/**
 * True when this computer can keep a key at all. On Linux without a keyring, safeStorage
 * says no, and the author should use the job folder way instead.
 */
export function readKeyState(userData: string, secrets: Secrets): KeyState {
	return { set: existsSync(keyFile(userData)), available: secrets.available() };
}

/** A key as the author typed it, trimmed, or "" when it cannot be an OpenRouter key. */
export function cleanKey(value: unknown): string {
	if (typeof value !== "string") return "";
	const key = value.trim();
	if (key.length < MIN_KEY || key.length > MAX_KEY) return "";
	// No spaces, no line breaks, no control characters: a pasted key is one token.
	return /^[A-Za-z0-9_.~+/=-]+$/.test(key) ? key : "";
}

/** Encrypts and keeps the key. Nothing about it is written anywhere else. */
export function saveKey(
	userData: string,
	secrets: Secrets,
	value: unknown,
): KeySaved {
	const key = cleanKey(value);
	if (key === "") return { ok: false, code: "invalid" };
	if (!secrets.available()) return { ok: false, code: "noStorage" };
	try {
		const encrypted = secrets.encrypt(key);
		writeFileSync(keyFile(userData), encrypted, { mode: 0o600 });
		return { ok: true };
	} catch {
		return { ok: false, code: "unreadable" };
	}
}

/** The key, for the main process's own requests. Never send this to the page. */
export function loadKey(userData: string, secrets: Secrets): string | null {
	if (!secrets.available()) return null;
	try {
		const key = secrets.decrypt(readFileSync(keyFile(userData))).trim();
		return key === "" ? null : key;
	} catch {
		return null;
	}
}

/** Forgets the key on this computer. A key that isn't there is already gone. */
export function clearKey(userData: string): void {
	try {
		rmSync(keyFile(userData), { force: true });
	} catch {
		// Nothing to do: the next state says whether it went.
	}
}
