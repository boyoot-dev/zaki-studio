// The start screen: make a new curriculum, open a folder, or open one of the projects the
// author had open before. Recent projects are kept in the app's own folder (never in a
// project), and one that has been moved shows as gone rather than opening a stale path.

import { useEffect, useState } from "react";

import type { RecentProject } from "../shared/api";
import type { Lang } from "../shared/i18n";
import { LanguageSwitch } from "./Chrome";
import { useSay } from "./i18n";

export function StartScreen({
	lang,
	onLanguage,
	onNew,
	onOpen,
	onAdopt,
	onRecent,
}: {
	lang: Lang;
	onLanguage: (lang: Lang) => void;
	onNew: () => void;
	onOpen: () => void;
	onAdopt: () => Promise<void>;
	onRecent: (root: string) => Promise<void>;
}) {
	const say = useSay();
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
				<LanguageSwitch lang={lang} onChange={onLanguage} />
			</header>

			<div className="cards">
				<button type="button" className="card card-new" onClick={onNew}>
					<span className="card-sign" aria-hidden="true">
						＋
					</span>
					<span className="card-title">{say("start.new")}</span>
					<span className="card-hint">{say("start.newHint")}</span>
				</button>
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
			</div>

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
