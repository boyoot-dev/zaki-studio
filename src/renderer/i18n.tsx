// The chosen language, available to every component without threading it through props: one
// provider in App, and two hooks. All the words themselves are in src/shared/i18n.ts.

import { createContext, type ReactNode, useCallback, useContext } from "react";
import { type Lang, type TextKey, t } from "../shared/i18n";

const LanguageContext = createContext<Lang>("en");

export function LanguageProvider({
	lang,
	children,
}: {
	lang: Lang;
	children: ReactNode;
}) {
	return (
		<LanguageContext.Provider value={lang}>{children}</LanguageContext.Provider>
	);
}

/** The language the window is in. */
export function useLang(): Lang {
	return useContext(LanguageContext);
}

/** The words of the window: `say("start.new")` in its own language. */
export function useSay(): (
	key: TextKey,
	vars?: Record<string, string | number>,
) => string {
	const lang = useLang();
	// The same function until the language changes, so effects that list it don't rerun on
	// every render (the "Reading the curriculum…" flicker, 2026-11-13).
	return useCallback(
		(key: TextKey, vars?: Record<string, string | number>) =>
			t(lang, key, vars),
		[lang],
	);
}
