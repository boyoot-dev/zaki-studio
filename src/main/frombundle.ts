// Opening a .zaki curriculum file as a new project (task 214). The file is read and checked
// here, in the main process. The page only ever sees a summary of it (names, author,
// rights, counts) and never chooses which file or folder is written. The project goes into
// an empty folder the author picks: curriculum.json and the folders, the model, and the
// bundle itself as .studio/exports/v<N>.json. That copy makes the next export version
// N + 1, an update for the families that already have the file.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import type { BundleInfo, Failure } from "../shared/api.ts";
import type { BundleIssue } from "../shared/format/bundle.ts";
import { parseBundle } from "../shared/format/bundle.ts";
import {
	CONTAINER_ISSUES,
	CONTAINER_LIMITS,
	readZaki,
} from "../shared/format/container.ts";
import { projectFromBundle } from "../shared/frombundle.ts";
import { modelSummary } from "../shared/model.ts";
import type { SubjectLabel } from "../shared/project.ts";
import { createProject } from "./files.ts";
import { writeExportCopy, writeModel } from "./model.ts";

/** A checked curriculum file, held by the main process until the author makes it a project. */
export type OpenedBundle = {
	path: string;
	text: string;
	bundle: ReturnType<typeof projectFromBundle> & { version: number };
};

/** Reads and checks a .zaki file: the container, then the bundle with the app's own reader. */
export async function readBundleFile(
	path: string,
	subjects: readonly SubjectLabel[],
): Promise<
	| { ok: true; opened: OpenedBundle; info: BundleInfo }
	| { ok: false; issues: BundleIssue[] }
> {
	const refuse = (message: string) => ({
		ok: false as const,
		issues: [{ path: "", message }],
	});
	let bytes: Uint8Array;
	try {
		if (statSync(path).size > CONTAINER_LIMITS.fileBytes)
			return refuse(CONTAINER_ISSUES.tooBig);
		bytes = new Uint8Array(readFileSync(path));
	} catch {
		return refuse(CONTAINER_ISSUES.notZip);
	}
	const read = await readZaki(bytes, async (packed, maxBytes) =>
		inflateRawSync(packed, { maxOutputLength: Math.max(1, maxBytes) }),
	);
	if (!read.ok) return refuse(read.issue);
	const parsed = parseBundle(
		read.text,
		subjects.map((subject) => subject.id),
	);
	if (!parsed.ok) return { ok: false, issues: parsed.issues };
	const made = projectFromBundle(parsed.bundle, subjects);
	const name = path.split(/[\\/]/).pop() ?? path;
	return {
		ok: true,
		opened: {
			path,
			text: read.text,
			bundle: { ...made, version: parsed.bundle.version },
		},
		info: {
			file: name,
			nameEn: parsed.bundle.nameEn,
			nameAr: parsed.bundle.nameAr,
			author: parsed.bundle.author,
			rights: parsed.bundle.rights,
			version: parsed.bundle.version,
			summary: modelSummary(made.model),
		},
	};
}

/** Makes the project in an empty folder: the folders and curriculum.json, the model, the copy. */
export function makeFromBundle(
	root: string,
	opened: OpenedBundle,
): Failure | { ok: true } {
	try {
		if (readdirSync(root).length > 0) return { ok: false, code: "notEmpty" };
	} catch {
		return { ok: false, code: "unreadable" };
	}
	const created = createProject(root, opened.bundle.project);
	if (!created.ok) return created;
	const model = writeModel(root, opened.bundle.model);
	if (!model.ok) return model;
	return writeExportCopy(root, opened.bundle.version, opened.text);
}

let launched: string | null = null;

/** The .zaki path in a command line (Windows passes a double-clicked file this way). */
export function zakiInArgs(argv: readonly string[]): string | null {
	for (const arg of argv.slice(1)) {
		if (/\.zaki$/i.test(arg) && !arg.startsWith("-")) return arg;
	}
	return null;
}

/** Keeps a double-clicked file until the page asks for it. */
export function queueLaunch(path: string): void {
	launched = path;
}

/** The double-clicked file, once: asking again gives null. */
export function takeLaunch(): string | null {
	const path = launched;
	launched = null;
	return path;
}
