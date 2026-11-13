// The subject list the wizard offers, served at build time by scripts/subjects.ts from the
// app's own subjects.json. It is a virtual module because the Studio may not import app/
// files other than src/lib (src/import-guard.test.ts).

declare module "virtual:subjects" {
	import type { StudioSubject } from "../shared/subjects";

	const subjects: StudioSubject[];
	export default subjects;
}
