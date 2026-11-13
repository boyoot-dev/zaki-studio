// The Studio's main process: one window, no menu bar full of tools, and the rules that keep
// a page built from files on disk from reaching the disk itself. The page is our own build,
// so it may run its own scripts and nothing else: no remote content, no new windows, no
// navigation, and links only in the author's browser after they say yes.

import { join } from "node:path";
import { app, BrowserWindow, dialog, session, shell } from "electron";
// The icon is copied into the build from studio/resources (task 154); the app never reads
// app/ at run time.
import iconIco from "../../resources/icon.ico?asset";
import iconPng from "../../resources/icon.png?asset";
import { registerIpc } from "./ipc";
import { contentSecurityPolicy, windowOptions } from "./window";

/** The Vite dev server in development; empty in the packaged app. */
const devServer = process.env.ELECTRON_RENDERER_URL ?? "";
const isDev = !app.isPackaged && devServer !== "";

/** The Windows application id: the taskbar groups the window under our own icon with it, and
 * the installer gives the exe the same id (electron-builder's appId). */
const APP_USER_MODEL_ID = "dev.boyoot.studio";

/** Windows uses the .ico at every size; other platforms take the png they are given. */
const icon = process.platform === "win32" ? iconIco : iconPng;

/** One Studio at a time: two windows writing one project would fight over the tree. */
if (!app.requestSingleInstanceLock()) app.quit();

/** The window, kept so the second-instance message can find it. */
let window: BrowserWindow | null = null;

/** Opens a link in the author's browser, and only https links, only after they agree. */
async function openLink(url: string): Promise<void> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return;
	}
	if (parsed.protocol !== "https:") return;
	const answer = await dialog.showMessageBox({
		type: "question",
		buttons: ["Open in browser", "Cancel"],
		defaultId: 1,
		cancelId: 1,
		title: "Open a link",
		message: "Open this link in your browser?",
		detail: parsed.href,
	});
	if (answer.response === 0) await shell.openExternal(parsed.href);
}

/** Refuses everything a page in the Studio must never do. */
function harden(contents: Electron.WebContents): void {
	// A new window is never opened in the app; an https link may go to the browser.
	contents.setWindowOpenHandler(({ url }) => {
		void openLink(url);
		return { action: "deny" };
	});
	// The page never navigates away from what we loaded, not even to our own dev server.
	contents.on("will-navigate", (event, url) => {
		const current = contents.getURL();
		const samePage =
			url === current || url.startsWith(`${current.split("#")[0]}#`);
		if (!samePage) event.preventDefault();
	});
	contents.on("will-attach-webview", (event) => event.preventDefault());
	// A page that fails to load or dies says so in the terminal, instead of leaving a blank
	// window with no explanation. In development its console comes there too, which is how we
	// find a policy that blocks our own script.
	contents.on("did-fail-load", (_event, code, description, url) => {
		console.error(
			`Studio page failed to load (${code} ${description}): ${url}`,
		);
	});
	contents.on("render-process-gone", (_event, details) => {
		console.error(`Studio page stopped: ${details.reason}`);
	});
	if (isDev)
		contents.on("console-message", (event) => {
			const line = `[page] ${event.level}: ${event.message}`;
			if (event.level === "error" || event.level === "warning")
				console.warn(line);
			else console.log(line);
		});
}

/** The page may not ask for a camera, a microphone or a location: it needs none of them. */
function denyPermissions(): void {
	session.defaultSession.setPermissionRequestHandler(
		(_contents, _permission, done) => {
			done(false);
		},
	);
}

/** Adds the policy to every response the page loads, so nothing inline or remote can run. */
function addPolicy(): void {
	const policy = contentSecurityPolicy(isDev, devServer);
	session.defaultSession.webRequest.onHeadersReceived((details, done) => {
		done({
			responseHeaders: {
				...details.responseHeaders,
				"Content-Security-Policy": [policy],
			},
		});
	});
}

function createWindow(): void {
	const preload = join(__dirname, "../preload/index.cjs");
	window = new BrowserWindow(windowOptions(preload, icon));
	window.once("ready-to-show", () => window?.show());
	window.on("closed", () => {
		window = null;
	});
	if (isDev) void window.loadURL(devServer);
	else void window.loadFile(join(__dirname, "../renderer/index.html"));
}

app.on("second-instance", () => {
	if (window === null) return;
	if (window.isMinimized()) window.restore();
	window.focus();
});

app.on("window-all-closed", () => {
	app.quit();
});

app.whenReady().then(() => {
	// Windows groups the window under this id, so the taskbar carries Mr. Zaki's icon
	// rather than Electron's, and two Studio windows are one app (task 154).
	if (process.platform === "win32") app.setAppUserModelId(APP_USER_MODEL_ID);
	denyPermissions();
	addPolicy();
	registerIpc();
	app.on("web-contents-created", (_event, contents) => harden(contents));
	createWindow();
});
