/// <reference types="vite/client" />

// The page's one door to the main process, put there by the preload script. Typed by
// src/shared/api.ts, so a function the preload doesn't expose is a type error here.
import type { StudioApi } from "../shared/api";
import type { ReaderApi } from "../shared/reader";

declare global {
	interface Window {
		studio: StudioApi;
		/** The hidden reader window's two calls; only that page has it (task 156). */
		reader: ReaderApi;
	}
}
