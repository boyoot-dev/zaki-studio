// The Studio's page: one screen at a time (start, wizard, project), the chosen language, and
// a line at the bottom for what just happened. Every action goes through window.studio,
// which the preload put there; this file never touches a file itself.

import studioSubjects from "virtual:subjects";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
	BundleChoice,
	BundleInfo,
	FolderPurpose,
	GuessFolder,
	ProjectOpen,
	TreeNode,
} from "../shared/api";
import { failureText } from "../shared/failure-text";
import { isRightToLeft, type Lang, type TextKey, t } from "../shared/i18n";
import type { Project } from "../shared/project";
import { Toast } from "./Chrome";
import { LanguageProvider } from "./i18n";
import { OpenBundle } from "./OpenBundle";
import { ProjectView } from "./ProjectView";
import { StartScreen } from "./StartScreen";

export { failureText };

import { Wizard } from "./Wizard";

/** Where the app remembers the chosen language, in the app's own window. */
const LANG_KEY = "studio.language";

type Screen =
	| { kind: "start" }
	| { kind: "wizard"; root: string; guess: GuessFolder[] }
	| { kind: "project"; root: string; project: Project; tree: TreeNode[] };

/** The language last chosen, or the one Windows is in. */
function firstLanguage(): Lang {
	const stored = window.localStorage.getItem(LANG_KEY);
	if (stored === "en" || stored === "ar") return stored;
	return navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

export function App() {
	const [lang, setLangState] = useState<Lang>(firstLanguage);
	const [screen, setScreen] = useState<Screen>({ kind: "start" });
	const [toast, setToast] = useState<string | null>(null);
	const toastTimer = useRef<number | null>(null);
	/** A curriculum file being opened as a project (task 214), or one that failed its check. */
	const [bundle, setBundle] = useState<{
		info: BundleInfo | null;
		issues: string[];
	} | null>(null);

	useEffect(() => {
		document.documentElement.lang = lang;
		document.documentElement.dir = isRightToLeft(lang) ? "rtl" : "ltr";
	}, [lang]);

	/** Switches the language and remembers it for the next time. */
	const setLang = (next: Lang) => {
		window.localStorage.setItem(LANG_KEY, next);
		setLangState(next);
	};

	/**
	 * Says what happened, in a line that goes away by itself. Kept the same function across
	 * renders: pages list it among the things that restart their loading, and a new one on
	 * every render made "Reading the curriculum…" flicker in a loop (owner, 2026-11-13).
	 */
	const say = useCallback((text: string) => {
		if (text === "") return;
		setToast(text);
		if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
		toastTimer.current = window.setTimeout(() => setToast(null), 2800);
	}, []);

	/** The same, for a text the window knows by its key. */
	const sayMessage = (key: TextKey) => say(t(lang, key));

	/** Shows a folder the main process opened: the project, or the wizard that must make it one. */
	const showOpened = (root: string, opened: ProjectOpen) => {
		if (opened.ok) {
			setScreen({
				kind: "project",
				root: opened.root,
				project: opened.project,
				tree: opened.tree,
			});
			return;
		}
		if (opened.needsWizard === true) {
			setScreen({ kind: "wizard", root, guess: opened.guess ?? [] });
			return;
		}
		say(failureText(lang, opened));
	};

	/** Opens a folder the author chose in the dialog: a project, or one the wizard makes one. */
	const openRoot = async (root: string) =>
		showOpened(root, await window.studio.openProject(root));

	/** Opens one of the recents; the main process decides which folders those may be. */
	const openRecent = async (root: string) =>
		showOpened(root, await window.studio.openRecent(root));

	/** Asks for a folder with the system dialog; null when the author changed their mind. */
	const chooseFolder = async (purpose: FolderPurpose): Promise<string | null> =>
		await window.studio.chooseFolder(purpose);

	/** Shows a curriculum file the main process read: its summary, or why it can't open. */
	const showBundle = useCallback(
		(choice: BundleChoice) => {
			if (choice.ok) setBundle({ info: choice.info, issues: [] });
			else if (choice.code === "invalidBundle")
				setBundle({ info: null, issues: choice.issues ?? [] });
			else say(failureText(lang, choice));
		},
		[lang, say],
	);

	// A .zaki file double-clicked to start the Studio, or while it is open.
	useEffect(() => {
		const ask = () => void window.studio.launchedBundle().then(showBundle);
		ask();
		return window.studio.onBundleLaunched(ask);
	}, [showBundle]);

	const onOpened = (opened: ProjectOpen) => {
		if (!opened.ok) {
			say(failureText(lang, opened));
			return;
		}
		setScreen({
			kind: "project",
			root: opened.root,
			project: opened.project,
			tree: opened.tree,
		});
	};

	return (
		<LanguageProvider lang={lang}>
			{screen.kind === "start" && (
				<StartScreen
					lang={lang}
					onLanguage={setLang}
					onNew={async () => {
						const root = await chooseFolder("new");
						if (root !== null) setScreen({ kind: "wizard", root, guess: [] });
					}}
					onOpen={async () => {
						const root = await chooseFolder("open");
						if (root !== null) await openRoot(root);
					}}
					onAdopt={async () => {
						const opened = await window.studio.adoptProject();
						// A folder adopted before opens as it is; say so, so the author knows
						// nothing was written a second time.
						if (opened.ok && opened.already === true)
							sayMessage("toast.alreadyProject");
						showOpened(opened.ok ? opened.root : "", opened);
					}}
					onBundle={async () => showBundle(await window.studio.chooseBundle())}
					onRecent={openRecent}
				/>
			)}
			{screen.kind === "wizard" && (
				<Wizard
					root={screen.root}
					guess={screen.guess}
					lang={lang}
					onLanguage={setLang}
					onCancel={() => setScreen({ kind: "start" })}
					onCreated={onOpened}
					subjects={studioSubjects}
				/>
			)}
			{screen.kind === "project" && (
				<ProjectView
					key={screen.root}
					root={screen.root}
					project={screen.project}
					tree={screen.tree}
					lang={lang}
					onLanguage={setLang}
					onNotify={say}
					onStart={() => setScreen({ kind: "start" })}
					onProjectReload={() => {
						void openRoot(screen.root);
					}}
				/>
			)}
			{bundle !== null && (
				<OpenBundle
					lang={lang}
					info={bundle.info}
					issues={bundle.issues}
					onClose={() => setBundle(null)}
					onOpened={(opened) => {
						setBundle(null);
						onOpened(opened);
					}}
				/>
			)}
			<Toast text={toast} />
		</LanguageProvider>
	);
}
