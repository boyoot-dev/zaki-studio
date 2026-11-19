// The start screen: start a new curriculum (the one big card), or open what the author already
// has: a project, older material, a .zaki file, or one of the projects open before. Recent projects are kept in the app's own folder (never in a
// project), and one that has been moved shows as gone rather than opening a stale path.

import { useEffect, useState } from "react";

import type { RecentProject } from "../shared/api";
import type { Lang } from "../shared/i18n";
import { LanguageSwitch } from "./Chrome";
import { useSay } from "./i18n";
import { useAi } from "./Settings";

export function StartScreen({
	lang,
	onLanguage,
	onNew,
	onOpen,
	onAdopt,
	onBundle,
	onRecent,
}: {
	lang: Lang;
	onLanguage: (lang: Lang) => void;
	onNew: () => void;
	onOpen: () => void;
	onAdopt: () => Promise<void>;
	onBundle: () => Promise<void>;
	onRecent: (root: string) => Promise<void>;
}) {
	const say = useSay();
	const { openSettings } = useAi();
	const [recent, setRecent] = useState<RecentProject[]>([]);

	useEffect(() => {
		let alive = true;
		void window.studio.recentProjects().then((list) => {
			if (alive) setRecent(list);
		});
		return () => {
			alive = false;
		};
	}, []);

	return (
		<div className="start">
			<header className="start-head">
				<div>
					<h1 className="brand">{say("app.name")}</h1>
					<p className="tagline">{say("app.tagline")}</p>
				</div>
				<div className="head-tools">
					<button
						type="button"
						className="btn btn-quiet"
						onClick={openSettings}
					>
						{say("settings.open")}
					</button>
					<LanguageSwitch lang={lang} onChange={onLanguage} />
				</div>
			</header>

			{/* One start for a teacher with a book; the other three are for what they already
			    have (task 243: in the walkthrough four equal cards made the choice hard). */}
			<button type="button" className="card card-new card-main" onClick={onNew}>
				<span className="card-sign" aria-hidden="true">
					＋
				</span>
				<span className="card-title">{say("start.new")}</span>
				<span className="card-hint">{say("start.newHint")}</span>
			</button>

			<section className="have" aria-label={say("start.have")}>
				<h2>{say("start.have")}</h2>
				<div className="cards cards-small">
					<button type="button" className="card" onClick={onOpen}>
						<span className="card-sign" aria-hidden="true">
							📂
						</span>
						<span className="card-title">{say("start.open")}</span>
						<span className="card-hint">{say("start.openHint")}</span>
					</button>
					<button type="button" className="card" onClick={() => void onAdopt()}>
						<span className="card-sign" aria-hidden="true">
							🗃️
						</span>
						<span className="card-title">{say("start.adopt")}</span>
						<span className="card-hint">{say("start.adoptHint")}</span>
					</button>
					<button
						type="button"
						className="card"
						onClick={() => void onBundle()}
					>
						<span className="card-sign" aria-hidden="true">
							📦
						</span>
						<span className="card-title">{say("start.bundle")}</span>
						<span className="card-hint">{say("start.bundleHint")}</span>
					</button>
				</div>
			</section>

			<section className="recent" aria-label={say("start.recent")}>
				<h2>{say("start.recent")}</h2>
				{recent.length === 0 ? (
					<p className="muted">{say("start.recentEmpty")}</p>
				) : (
					<ul className="recent-list">
						{recent.map((project) => (
							<li key={project.root}>
								<button
									type="button"
									className="recent-row"
									onClick={() => void onRecent(project.root)}
								>
									<span className="recent-name">
										{lang === "ar" ? project.nameAr : project.nameEn}
									</span>
									<span className="recent-path" dir="ltr">
										{project.root}
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
