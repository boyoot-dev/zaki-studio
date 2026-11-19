// The pages the AI never used (task 250), as one line on a proposal, or a warning at its top
// when too many were left out. Each range can open its file at its first page.

import type { Coverage } from "../shared/coverage";
import { useLang, useSay } from "./i18n";

/** The file's own name, without its folders or extension. */
function shortName(path: string): string {
	const name = path.split("/").pop() ?? path;
	const cut = name.lastIndexOf(".");
	return cut <= 0 ? name : name.slice(0, cut);
}

export function CoverageLine({
	coverage,
	heading,
	onOpenFile,
}: {
	coverage: Coverage;
	/** Shown above the list instead of the "used" line (the outline's gaps). */
	heading?: string;
	onOpenFile?: (path: string, page: number) => void;
}) {
	const say = useSay();
	const lang = useLang();
	if (coverage.total === 0) return null;
	if (coverage.unused.length === 0)
		return heading === undefined ? (
			<p className="muted small">
				{say("cover.all", { total: coverage.total })}
			</p>
		) : null;
	return (
		<div className={coverage.warn ? "coverage coverage-warn" : "coverage"}>
			{coverage.warn && <p className="issues">{say("cover.warn")}</p>}
			<p className="muted">
				{heading ??
					say("cover.used", {
						used: coverage.used,
						total: coverage.total,
					})}{" "}
				{heading === undefined && say("cover.notUsed")}
			</p>
			<ul className="coverage-list">
				{coverage.unused.map((file) => (
					<li key={file.id}>
						<span dir="auto">{shortName(file.path)}</span>:{" "}
						{file.ranges.map(([from, to], index) => {
							const label =
								from === to
									? say("cover.page", { n: from })
									: say("cover.range", { from, to });
							return (
								<span key={`${from}-${to}`}>
									{index > 0 && (lang === "ar" ? "، " : ", ")}
									{onOpenFile === undefined ? (
										label
									) : (
										<button
											type="button"
											className="link-button"
											onClick={() => onOpenFile(file.path, from)}
										>
											{label}
										</button>
									)}
								</span>
							);
						})}
					</li>
				))}
			</ul>
		</div>
	);
}
