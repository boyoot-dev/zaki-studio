// The languages a course can be taught in and helped in, as the window shows them (task 225).
// The format takes any ISO 639-1 code; Mr. Zaki can teach in three of them today, so a course
// in another language is allowed and only warned about: families see it as "not available
// yet" until Mr. Zaki learns the language. Names come from the platform (Intl.DisplayNames),
// so there is no list of names to keep by hand. Pure and tested.

import { LANGUAGE_CODES, NATIVE } from "./format/bundle.ts";

/**
 * The languages Mr. Zaki can teach in today. It follows the app (its prompts, voices and
 * safety checks) and is used here only to warn; it never stops an export.
 */
export const APP_LANGUAGES: readonly string[] = ["en", "ar", "fr"];

/** A language's name in the window's language: "Arabic" / "العربية", or the code itself. */
export function languageName(code: string, uiLang: "en" | "ar"): string {
	if (code === NATIVE)
		return uiLang === "ar" ? "لغة الطفل الأم" : "The child's own language";
	try {
		const name = new Intl.DisplayNames([uiLang], { type: "language" }).of(code);
		return name === undefined || name === code ? code : name;
	} catch {
		return code;
	}
}

/** Every language a menu offers: the ones Mr. Zaki teaches first, then all others by name. */
export function languageChoices(
	uiLang: "en" | "ar",
): { code: string; name: string }[] {
	const first = APP_LANGUAGES.map((code) => ({
		code,
		name: languageName(code, uiLang),
	}));
	const rest = LANGUAGE_CODES.filter((code) => !APP_LANGUAGES.includes(code))
		.map((code) => ({ code, name: languageName(code, uiLang) }))
		.sort((a, b) => a.name.localeCompare(b.name, uiLang));
	return [...first, ...rest];
}

/** One course whose language Mr. Zaki can't use yet. */
export type LanguageWarning = {
	grade: number;
	subject: string;
	language: string;
	/** "teach": the course is taught in it; "help": it is one of the help languages. */
	kind: "teach" | "help";
};

/** The courses that name a language Mr. Zaki can't teach or help in yet. */
export function languageWarnings(
	courses: readonly {
		grade: number;
		subject: string;
		language: string;
		support: readonly string[];
	}[],
): LanguageWarning[] {
	const out: LanguageWarning[] = [];
	for (const course of courses) {
		if (!APP_LANGUAGES.includes(course.language))
			out.push({ ...pick(course), language: course.language, kind: "teach" });
		for (const code of course.support)
			if (code !== NATIVE && !APP_LANGUAGES.includes(code))
				out.push({ ...pick(course), language: code, kind: "help" });
	}
	return out;
}

function pick(course: { grade: number; subject: string }) {
	return { grade: course.grade, subject: course.subject };
}

/** The help languages a menu offers beside the teaching language: the child's own first. */
export const HELP_CHOICES: readonly string[] = [NATIVE, "ar", "en", "fr"];

/**
 * One course's new teaching and help languages, as the window sends them. `from` is the
 * course's teaching language now, which with grade and subject names the course; it is the
 * same as `language` unless the teaching language changes.
 */
export type CourseLanguage = {
	grade: number;
	subject: string;
	from: string;
	language: string;
	support: string[];
};

/**
 * A course's languages made safe to write: the teaching language a known code, the help
 * languages known codes or "native", no repeats, at most three, and never the teaching
 * language itself. Null when the teaching language is not a code.
 */
export function cleanCourseLanguage(
	value: CourseLanguage,
): CourseLanguage | null {
	if (!LANGUAGE_CODES.includes(value.language)) return null;
	const support: string[] = [];
	for (const code of value.support) {
		if (support.length >= 3) break;
		if (code === value.language || support.includes(code)) continue;
		if (code === NATIVE || LANGUAGE_CODES.includes(code)) support.push(code);
	}
	return {
		grade: value.grade,
		subject: value.subject,
		from: LANGUAGE_CODES.includes(value.from) ? value.from : value.language,
		language: value.language,
		support,
	};
}
