// The subjects the Studio offers in the wizard: Mr. Zaki's fixed list
// (app/content/curriculum/subjects.json), which is read at build time through the virtual
// module in scripts/subjects.ts, so a subject added to the app shows up here without a copy
// to keep in step. Only what the Studio shows is typed here.

import type { SubjectLabel } from "./project.ts";

export type StudioSubject = SubjectLabel & {
	/** The subject's one-character sign, as the app shows it. */
	icon: string;
	/** The subject's colour in the app, used to tint its row. */
	color: string;
	/** The language the subject's material is written in: "en", "ar" or "fr". */
	contentLanguage: string;
};
