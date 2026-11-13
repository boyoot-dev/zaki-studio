// The reader window's two calls, and only those (task 156). The window that draws a page is a
// web page: it must not get a channel name of its own, a third call, or bytes that are not
// bytes. The preload is a page of wiring over this pair, so holding this still holds the door.

import { describe, expect, it } from "vitest";

import {
	READER_CHANNELS,
	READER_DPI,
	READER_SCALE,
	type ReaderJob,
	readerApi,
} from "./reader.ts";

describe("the reader window's door", () => {
	it("is two calls, one in each direction", () => {
		const api = readerApi(
			() => {},
			() => {},
		);
		expect(Object.keys(api).sort()).toEqual(["onPage", "show"]);
		expect(READER_CHANNELS.page).toBe("studio:readerPage");
		expect(READER_CHANNELS.png).toBe("studio:readerPng");
	});

	it("hands a page only its bytes, its page number and its scale", () => {
		let hear: ((job: ReaderJob) => void) | undefined;
		const seen: ReaderJob[] = [];
		const api = readerApi(
			(callback) => {
				hear = callback;
			},
			() => {},
		);
		api.onPage((job) => seen.push(job));
		const bytes = new Uint8Array([1, 2, 3]);
		hear?.({
			bytes,
			page: 7,
			scale: 2,
			// A path or a channel name a caller tried to sneak in is not carried along.
			path: "C:/secret",
		} as ReaderJob);
		expect(seen).toEqual([{ bytes, page: 7, scale: 2 }]);
	});

	it("clamps a page number and a scale a page can have", () => {
		let hear: ((job: ReaderJob) => void) | undefined;
		let got: ReaderJob | undefined;
		const api = readerApi(
			(callback) => {
				hear = callback;
			},
			() => {},
		);
		api.onPage((job) => {
			got = job;
		});
		hear?.({ bytes: new Uint8Array(), page: -5, scale: 1000 });
		expect(got).toEqual({ bytes: new Uint8Array(), page: 1, scale: 10 });
		hear?.({ bytes: "not bytes", page: 2, scale: Number.NaN } as never);
		expect(got?.bytes).toBeInstanceOf(Uint8Array);
		expect(got?.scale).toBe(0.1);
	});

	it("sends a picture back only when it is bytes", () => {
		const sent: Uint8Array[] = [];
		const api = readerApi(
			() => {},
			(png) => sent.push(png),
		);
		api.show(new Uint8Array([137, 80, 78, 71]));
		api.show(new Uint8Array());
		api.show("not bytes" as never);
		expect(sent).toHaveLength(1);
	});

	it("draws at 110 DPI, as the pipeline renders", () => {
		expect(READER_DPI).toBe(110);
		expect(READER_SCALE).toBeCloseTo(110 / 72);
	});
});
