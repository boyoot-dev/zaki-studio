// How the Studio is built: three parts of one app, each with its own entry. electron-vite
// wraps Vite (chosen over vite-plugin-electron: it builds main, preload and page with one
// config, restarts the app on a main-process change, and keeps the preload's output format
// under our control, which sandboxing needs).
//
// The shared format code is a copy kept in src/shared/format (npm run sync-format keeps it
// in step with the app); the import-guard test (src/import-guard.test.ts) fails on any path
// that leaves studio/.

import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

import { cspPlugin } from "./scripts/csp.ts";
import { subjectsPlugin } from "./scripts/subjects.ts";
import { contentSecurityPolicy } from "./src/main/window";

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin(), subjectsPlugin()],
		build: {
			rollupOptions: {
				// CommonJS, as Electron's own documentation uses: 'electron' is a CommonJS
				// module whose named exports an ES module can't take (found 2026-11-12: the
				// window failed to start with "does not provide an export named 'BrowserWindow'").
				output: { format: "cjs", entryFileNames: "[name].cjs" },
			},
		},
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
		build: {
			rollupOptions: {
				// Two preloads: the app's page and the hidden reader window (task 156), which gets
				// only its two calls.
				input: {
					index: fileURLToPath(
						new URL("./src/preload/index.ts", import.meta.url),
					),
					reader: fileURLToPath(
						new URL("./src/preload/reader.ts", import.meta.url),
					),
				},
				// A sandboxed preload is CommonJS (Electron loads it before any module system
				// exists), so it is written as .cjs even though the app is an ES module package.
				output: { format: "cjs", entryFileNames: "[name].cjs" },
			},
		},
	},
	renderer: {
		plugins: [
			react(),
			subjectsPlugin(),
			cspPlugin(contentSecurityPolicy(false)),
		],
		// One React only: a second copy (from a stale pre-bundle or a parent folder's
		// node_modules) breaks every hook with "Invalid hook call" (found 2026-11-12).
		resolve: { dedupe: ["react", "react-dom"] },
		build: {
			rollupOptions: {
				// Two pages: the app, and the hidden reader that draws a page into a picture
				// (task 156). Both get the same policy from scripts/csp.ts.
				input: {
					index: fileURLToPath(
						new URL("./src/renderer/index.html", import.meta.url),
					),
					reader: fileURLToPath(
						new URL("./src/renderer/reader.html", import.meta.url),
					),
				},
			},
		},
	},
});
