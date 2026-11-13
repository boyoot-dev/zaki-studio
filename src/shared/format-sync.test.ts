// The copies in format/ are the app's shared files, byte for byte apart from their provenance
// lines and their imports (task 163). When this is the Mr. Zaki monorepo, the app is beside
// studio/ and this test fails if the app changed and the copies were not synced; run "npm run
// sync-format". In the public repository there is no ../app, so the check is skipped.

import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { expectedCopies } from "../../scripts/sync-format.ts";

/** The studio folder: this file's folder is studio/src/shared. */
const STUDIO = fileURLToPath(new URL("../..", import.meta.url));
/** The app folder beside it. */
const APP = join(STUDIO, "..", "app");

describe.skipIf(!existsSync(join(APP, "src", "lib", "bundle.ts")))(
	"the format copies are in step with the app",
	() => {
		it("each file is what sync-format would write", () => {
			for (const { to, content } of expectedCopies(APP)) {
				expect(readFileSync(to, "utf8"), relative(STUDIO, to)).toBe(content);
			}
		});
	},
);
