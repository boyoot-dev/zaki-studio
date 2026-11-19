// The AI choice (task 244): what a kept file holds, and a cost in plain words.

import { describe, expect, it } from "vitest";
import { cleanAi, costWords } from "./ai.ts";

describe("the AI choice", () => {
	it("reads each way, and nothing from a missing, broken or unknown one", () => {
		expect(cleanAi({ way: "tool", tool: "claude-code" })).toEqual({
			way: "tool",
			tool: "claude-code",
		});
		expect(cleanAi({ way: "tool", tool: "other" })).toEqual({
			way: "tool",
			tool: "other",
		});
		expect(cleanAi({ way: "tool" })).toEqual({
			way: "tool",
			tool: "claude-code",
		});
		expect(cleanAi({ way: "key", tool: "other" })).toEqual({ way: "key" });
		for (const bad of [undefined, null, "key", [], {}, { way: "magic" }])
			expect(cleanAi(bad)).toBeNull();
	});

	it("says a cost in cents as well as dollars", () => {
		expect(costWords(0.141, "en")).toBe("about $0.14 (14 US cents)");
		expect(costWords(0.01, "en")).toBe("about $0.01 (1 US cent)");
		expect(costWords(0.001, "en")).toBe("about $0.01 (1 US cent)");
		expect(costWords(2.5, "en")).toBe("about $2.50");
		expect(costWords(0.14, "ar")).toBe("نحو 0.14 دولار (14 سنتًا)");
	});
});
