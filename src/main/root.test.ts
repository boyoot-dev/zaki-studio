// The packaged-app root (see root.ts): in development it is the checkout's root, in an install
// it is the unpacked asar, which is where electron-builder puts the worker, the rules and the
// language data; a packaged path with no asar in it is left alone.

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { studioRootPath } from "./root.ts";

describe("studioRootPath", () => {
	it("is the checkout's root in development", () => {
		expect(
			studioRootPath(
				false,
				"C:\\Program Files\\Mr. Zaki Studio\\resources\\app.asar",
				join("C:", "studio", "out", "main"),
			),
		).toBe(join("C:", "studio", "out", "main", "..", ".."));
	});

	it("is the unpacked asar in a packaged install", () => {
		expect(
			studioRootPath(
				true,
				join(
					"C:",
					"Users",
					"ada",
					"AppData",
					"Local",
					"Programs",
					"mr-zaki-studio",
					"resources",
					"app.asar",
				),
				join("C:", "install", "out", "main"),
			),
		).toBe(
			join(
				"C:",
				"Users",
				"ada",
				"AppData",
				"Local",
				"Programs",
				"mr-zaki-studio",
				"resources",
				"app.asar.unpacked",
			),
		);
	});

	it("is the unpacked asar with a trailing separator too", () => {
		expect(
			studioRootPath(
				true,
				"/Applications/Mr. Zaki Studio.app/Contents/Resources/app.asar/",
				"/Applications/Mr. Zaki Studio.app/Contents/Resources/app.asar/out/main",
			),
		).toBe(
			"/Applications/Mr. Zaki Studio.app/Contents/Resources/app.asar.unpacked/",
		);
	});

	it("keeps a packaged path with no asar in it unchanged", () => {
		expect(
			studioRootPath(
				true,
				"/opt/Mr. Zaki Studio/resources",
				"/opt/Mr. Zaki Studio/resources/out/main",
			),
		).toBe("/opt/Mr. Zaki Studio/resources");
	});
});
