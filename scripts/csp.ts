// The packaged app loads its page from disk, and a file:// response carries no headers, so
// the policy main/index.ts adds with onHeadersReceived never reaches it. This plugin writes
// the same policy into the built page's <head> instead, and only in a build: development needs
// the dev-server policy (and its one inline script), which the header supplies.

import type { Plugin } from "vite";

/** The meta tag a built page is given, as Vite's tag description. */
export function cspTag(policy: string) {
	return {
		tag: "meta",
		attrs: { "http-equiv": "Content-Security-Policy", content: policy },
		injectTo: "head-prepend" as const,
	};
}

/** Adds the policy to the built index.html; never in development. */
export function cspPlugin(policy: string): Plugin {
	return {
		name: "studio-csp",
		apply: "build",
		transformIndexHtml() {
			return [cspTag(policy)];
		},
	};
}
