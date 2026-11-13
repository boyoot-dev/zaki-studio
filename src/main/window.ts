// The window's settings, kept apart from Electron so a test can read them (task 151): the
// page gets no Node, no raw file system and no way to leave the app, and the only scripts it
// may run are the ones we built. The policy is strict in the packaged app; development adds
// exactly what Vite's hot reload needs, and nothing else.

import type { BrowserWindowConstructorOptions } from "electron";

/** The web preferences every Studio window gets, and nothing else may relax. */
export const WEB_PREFERENCES = {
	contextIsolation: true,
	sandbox: true,
	nodeIntegration: false,
	webSecurity: true,
	spellcheck: false,
} as const;

/** The window as the app creates it: calm, sized for a tree on the left and a page on the right. */
export function windowOptions(
	preload: string,
	icon: string,
): BrowserWindowConstructorOptions {
	return {
		width: 1280,
		height: 840,
		minWidth: 960,
		minHeight: 640,
		show: false,
		backgroundColor: "#f6f8fc",
		title: "Mr. Zaki Studio",
		// Mr. Zaki's face in the title bar and the taskbar, not Electron's (task 154).
		icon,
		autoHideMenuBar: true,
		webPreferences: { ...WEB_PREFERENCES, preload },
	};
}

/**
 * The Content-Security-Policy for the page. In the packaged app no inline script, no remote
 * script and no plugin may run; in development Vite's hot reload injects one inline script
 * and keeps a WebSocket open, so those two are allowed there and nowhere else.
 */
export function contentSecurityPolicy(dev: boolean, devServer = ""): string {
	const parts = [
		"default-src 'self'",
		dev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
		// Inline styles come from pdf.js's text layer, which sets positions as it renders.
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		"media-src 'self' blob:",
		"font-src 'self' data:",
		"worker-src 'self' blob:",
		connectSources(dev, devServer),
		"object-src 'none'",
		"frame-src 'none'",
		"base-uri 'none'",
		"form-action 'none'",
	];
	return parts.join("; ");
}

/** The dev server and its WebSocket in development, and our own origin only otherwise. */
function connectSources(dev: boolean, devServer: string): string {
	if (!dev || devServer === "") return "connect-src 'self'";
	try {
		const url = new URL(devServer);
		const ws = `ws://${url.host}`;
		return `connect-src 'self' ${url.origin} ${ws}`;
	} catch {
		return "connect-src 'self'";
	}
}
