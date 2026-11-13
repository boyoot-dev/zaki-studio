// The list of projects opened before: newest first, no duplicates, at most eight. It lives in
// the app's own folder, so what someone opened on their computer never travels with a project
// folder they share.

import { describe, expect, it } from "vitest";

import type { RecentProject } from "./api.ts";
import { RECENT_MAX, rememberRecent, sameRoot } from "./recent.ts";

const entry = (root: string, opened: number): RecentProject => ({
	root,
	nameEn: root,
	nameAr: root,
	opened,
});

describe("the recent projects", () => {
	it("puts the newest first", () => {
		const list = rememberRecent([entry("one", 1)], entry("two", 2));
		expect(list.map((item) => item.root)).toEqual(["two", "one"]);
	});

	it("moves a project that is opened again instead of listing it twice", () => {
		const list = rememberRecent(
			[entry("two", 2), entry("one", 1)],
			entry("one", 3),
		);
		expect(list.map((item) => item.root)).toEqual(["one", "two"]);
		expect(list).toHaveLength(2);
	});

	it("keeps at most eight", () => {
		let list: RecentProject[] = [];
		for (let n = 0; n < 12; n += 1)
			list = rememberRecent(list, entry(`p${n}`, n));
		expect(list).toHaveLength(RECENT_MAX);
		expect(list[0]?.root).toBe("p11");
		expect(list.at(-1)?.root).toBe("p4");
	});

	it("compares folder names the way the platform does", () => {
		expect(sameRoot("C:/Projects/Sunrise", "C:/Projects/Sunrise")).toBe(true);
		expect(sameRoot("C:/Projects/Sunrise", "C:/Projects/Other")).toBe(false);
	});
});
