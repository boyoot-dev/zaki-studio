// Builds one installer (task 163): the window for the platform the argument names. The builds
// are unsigned for now, so code-signing discovery is off and no notarising happens; anything
// that finds an identity anyway is a warning, not a signed installer. Pass --win or --mac.
// It stops when Tesseract's language files are missing: electron-builder packs whatever
// resources/tessdata holds, so an installer built without them reads no picture page (found
// 2026-11-18, when a local build shipped without them and every picture page stayed unread).

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { missingLangs, TESSDATA_LANGS } from "../src/main/ocr.ts";

const arg = process.argv[2];
if (arg !== "--win" && arg !== "--mac") {
	console.error("usage: node scripts/dist.ts --win|--mac");
	process.exit(2);
}

const missing = missingLangs(
	fileURLToPath(new URL("..", import.meta.url)),
	TESSDATA_LANGS.join("+"),
);
if (missing.length > 0) {
	console.error(
		`resources/tessdata lacks ${missing.join(", ")}: run npm run tessdata first.`,
	);
	process.exit(1);
}

process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";

const cli = fileURLToPath(import.meta.resolve("electron-builder/cli.js"));
const result = spawnSync(process.execPath, [cli, arg, "--publish", "never"], {
	stdio: "inherit",
	env: process.env,
});
if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
