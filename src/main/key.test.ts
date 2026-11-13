// The OpenRouter key's keeping (task 157): encrypted by safeStorage in the app's own folder,
// never in a project, a file's text or a message to the page. The fake store here is its own
// reversible encoding: a test can then check the file holds no plain key, and that everything
// the page may learn is a boolean.

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	cleanKey,
	clearKey,
	keyFile,
	loadKey,
	readKeyState,
	type Secrets,
	saveKey,
} from "./key.ts";

const KEY = "sk-or-v1-abcdefghijklmnopqrstuvwxyz0123456789";

let userData = "";

/** A store that is available, with a reversible stand-in for encryption. */
function store(available = true): Secrets {
	return {
		available: () => available,
		encrypt: (text) =>
			Buffer.from(text, "utf8").toString("base64") as unknown as Buffer,
		decrypt: (bytes) =>
			Buffer.from(bytes.toString("utf8"), "base64").toString("utf8"),
	};
}

beforeEach(() => {
	userData = mkdtempSync(join(tmpdir(), "studio-key-"));
});

afterEach(() => {
	rmSync(userData, { recursive: true, force: true });
});

describe("the author's key", () => {
	it("is kept encrypted, and the page only learns that one is set", () => {
		expect(readKeyState(userData, store())).toEqual({
			set: false,
			available: true,
		});
		expect(saveKey(userData, store(), ` ${KEY}\n`)).toEqual({ ok: true });
		const onDisk = readFileSync(keyFile(userData));
		expect(onDisk.toString("utf8")).not.toContain(KEY);
		const state = readKeyState(userData, store());
		expect(state).toEqual({ set: true, available: true });
		expect(JSON.stringify(state)).not.toContain(KEY);
		// Only the main process's own requests read it.
		expect(loadKey(userData, store())).toBe(KEY);
	});

	it("forgets the key when the author clears it", () => {
		saveKey(userData, store(), KEY);
		clearKey(userData);
		expect(existsSync(keyFile(userData))).toBe(false);
		expect(loadKey(userData, store())).toBeNull();
		expect(readKeyState(userData, store()).set).toBe(false);
	});

	it("refuses a computer with no store, and says so", () => {
		expect(saveKey(userData, store(false), KEY)).toEqual({
			ok: false,
			code: "noStorage",
		});
		expect(readKeyState(userData, store(false))).toEqual({
			set: false,
			available: false,
		});
		expect(loadKey(userData, store(false))).toBeNull();
	});

	it("refuses what cannot be an OpenRouter key", () => {
		for (const value of [
			"",
			"short",
			"has spaces in the middle of it 12345",
			"line\nbreak-key-with-enough-length",
			"x".repeat(600),
			null,
			42,
		])
			expect(saveKey(userData, store(), value)).toEqual({
				ok: false,
				code: "invalid",
			});
		expect(existsSync(keyFile(userData))).toBe(false);
	});

	it("cleans a pasted key, and accepts the characters a key has", () => {
		expect(cleanKey(`  ${KEY}  `)).toBe(KEY);
		expect(cleanKey("sk-or-v1-with_underscore.and-dash")).toBe(
			"sk-or-v1-with_underscore.and-dash",
		);
		expect(cleanKey("  ")).toBe("");
	});
});
