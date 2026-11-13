// The Studio's own folder in dev and in a packaged install, one answer (task 163). Electron
// unpacks only the files electron-builder lists under asarUnpack (the OCR worker, the rules
// and the language data), so in an install they live at <resources>/app.asar.unpacked, while
// everything else (the build, the preload) stays inside app.asar. This function is the one
// place that knows, so every path the main process builds from it keeps working installed.

import { join } from "node:path";

/**
 * Where the Studio's own files are read from: the checkout's root in development, and the
 * unpacked asar in a packaged install. A packaged app whose path holds no asar keeps its own
 * path unchanged, so this is also right with asar off.
 */
export function studioRootPath(
	isPackaged: boolean,
	appPath: string,
	dirname: string,
): string {
	if (!isPackaged) return join(dirname, "..", "..");
	return appPath.replace(/app\.asar(?=$|[\\/])/, "app.asar.unpacked");
}
