// The window's settings are read here rather than in Electron: a test can then hold them
// still, so a later change that turns off contextIsolation, or lets an inline script run,
// fails before anyone opens the app.

import { describe, expect, it } from "vitest";

import {
	contentSecurityPolicy,
	WEB_PREFERENCES,
	windowOptions,
} from "./window.ts";

describe("the window", () => {
	it("isolates the page, sandboxes it, and gives it no Node", () => {
		expect(WEB_PREFERENCES.contextIsolation).toBe(true);
		expect(WEB_PREFERENCES.sandbox).toBe(true);
		expect(WEB_PREFERENCES.nodeIntegration).toBe(false);
		expect(WEB_PREFERENCES.webSecurity).toBe(true);
	});

	it("passes those settings, and only the preload, to the window", () => {
		const options = windowOptions(
			"C:/studio/out/preload/index.cjs",
			"C:/studio/resources/icon.ico",
		);
		expect(options.webPreferences).toMatchObject({
			...WEB_PREFERENCES,
			preload: "C:/studio/out/preload/index.cjs",
		});
	});

	it("shows Mr. Zaki's own icon, not Electron's", () => {
		const options = windowOptions(
			"preload.cjs",
			"C:/studio/resources/icon.ico",
		);
		expect(options.icon).toBe("C:/studio/resources/icon.ico");
	});
});

describe("the content policy", () => {
	const policy = contentSecurityPolicy(false);

	it("lets only our own scripts run in the packaged app", () => {
		expect(policy).toContain("script-src 'self'");
		expect(policy).not.toContain("'unsafe-inline'; script");
		expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
	});

	it("names no remote host, and closes the doors we don't use", () => {
		expect(policy).not.toContain("http://");
		expect(policy).not.toContain("https://");
		expect(policy).toContain("object-src 'none'");
		expect(policy).toContain("frame-src 'none'");
		expect(policy).toContain("base-uri 'none'");
		expect(policy).toContain("form-action 'none'");
		expect(policy).toContain("connect-src 'self'");
	});

	it("allows the pictures, recordings and workers the viewers make", () => {
		expect(policy).toContain("img-src 'self' data: blob:");
		expect(policy).toContain("media-src 'self' blob:");
		expect(policy).toContain("worker-src 'self' blob:");
	});

	it("adds the dev server and its socket in development, and nothing more", () => {
		const dev = contentSecurityPolicy(true, "http://localhost:5173");
		expect(dev).toContain("http://localhost:5173");
		expect(dev).toContain("ws://localhost:5173");
		expect(dev).toContain("script-src 'self' 'unsafe-inline'");
		expect(dev).not.toContain("object-src 'self'");
	});
});
