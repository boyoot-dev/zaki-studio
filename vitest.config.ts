// The Studio's tests: pure logic only (paths, the project file, the wizard's plan, the
// window's settings). Electron itself is not started, so the same four checks run anywhere.

import { defineConfig } from "vitest/config";
import { subjectsPlugin } from "./scripts/subjects.ts";

export default defineConfig({
	plugins: [subjectsPlugin()],
	test: {
		include: ["src/**/*.test.ts"],
		environment: "node",
	},
});
