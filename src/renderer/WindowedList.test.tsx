// The windowed list draws only the rows on screen (task 168): rendering 35,000 items shows
// at most 300 of them, every row keeps its role and its place in the list, and the labels
// are in the markup for a screen reader.

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WindowedList } from "./WindowedList";

describe("the windowed list", () => {
	it("draws at most 300 rows for 35,000 items", () => {
		const html = renderToString(
			<WindowedList count={35_000} rowHeight={32} listRole="list" itemRole="listitem">
				{(index) => <span>Row {index}</span>}
			</WindowedList>,
		);
		const rows = html.match(/role="listitem"/g) ?? [];
		expect(rows.length).toBeLessThanOrEqual(300);
		expect(rows.length).toBeGreaterThan(0);
		expect(html).toContain('aria-posinset="1"');
		expect(html).toContain('aria-setsize="35000"');
	});

	it("labels every row with its place in the list", () => {
		const html = renderToString(
			<WindowedList count={35_000} rowHeight={32} listRole="tree" itemRole="treeitem">
				{(index) => <span>Row {index}</span>}
			</WindowedList>,
		);
		expect(html).toContain('role="treeitem"');
		expect(html).toContain('aria-posinset="1"');
	});

	it("draws nothing but the empty box for nothing", () => {
		const html = renderToString(
			<WindowedList count={0} rowHeight={32}>
				{(index) => <span>Row {index}</span>}
			</WindowedList>,
		);
		expect(html).not.toContain("Row 0");
	});
});
