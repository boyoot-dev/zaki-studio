// The windowed list draws only the rows on screen (task 168): rendering 35,000 items shows
// at most 300 of them, every row the caller draws keeps its role and its place in the list,
// and the scroll box carries the list's role.

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WindowedList } from "./WindowedList";

/** A row like the page's lists draw: a real list item with its window position on it. */
function row(count: number, index: number) {
	return (
		<li aria-setsize={count} aria-posinset={index + 1}>
			Row {index}
		</li>
	);
}

describe("the windowed list", () => {
	it("draws at most 300 rows for 35,000 items", () => {
		const html = renderToString(
			<WindowedList count={35_000} rowHeight={32} listRole="list">
				{(index) => row(35_000, index)}
			</WindowedList>,
		);
		const rows = html.match(/<li /g) ?? [];
		expect(rows.length).toBeLessThanOrEqual(300);
		expect(rows.length).toBeGreaterThan(0);
		expect(html).toContain('aria-setsize="35000"');
		expect(html).toContain('aria-posinset="1"');
	});

	it("draws the scroll box with the list's role and the label", () => {
		const html = renderToString(
			<WindowedList count={10} rowHeight={32} listRole="tree" ariaLabel="Files">
				{(index) => row(10, index)}
			</WindowedList>,
		);
		expect(html).toContain('role="tree"');
		expect(html).toContain('aria-label="Files"');
	});

	it("draws nothing but the empty box for nothing", () => {
		const html = renderToString(
			<WindowedList count={0} rowHeight={32}>
				{(index) => row(0, index)}
			</WindowedList>,
		);
		expect(html).not.toContain("Row 0");
	});
});
