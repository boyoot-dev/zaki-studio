// Every file the Studio touches: reading the tree, copying dropped files in, pasting,
// moving, renaming, deleting. Each function takes the project root and a path relative to
// it, and refuses anything that lands outside through the one guard, insideProject
// (src/shared/inside.ts). Files are copied in, read and shown; they are never run.

import { randomUUID } from "node:crypto";
import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	statSync,
	writeFileSync,
} from "node:fs";
import {
	basename,
	dirname,
	extname,
	join,
	relative,
	resolve,
	sep,
} from "node:path";

import type {
	Done,
	Failure,
	FileBytes,
	FileText,
	GuessFolder,
	Imported,
	Made,
	TreeNode,
} from "../shared/api.ts";
import { insideProject, isProjectRoot } from "../shared/inside.ts";
import {
	INBOX_DIR,
	nextUnitFolder,
	PROJECT_FILE,
	type Project,
	parseProject,
	projectFolders,
	STUDIO_DIR,
	unitNumber,
	validFolderName,
} from "../shared/project.ts";

/** The largest file a viewer is asked to show. A whole textbook is far smaller. */
export const MAX_READ_BYTES = 200 * 1024 * 1024;

/** The extensions Windows may open for the author from the "open in its app" button. */
const OPENABLE = new Set([
	"pdf",
	"doc",
	"docx",
	"ppt",
	"pptx",
	"xls",
	"xlsx",
	"txt",
	"md",
	"rtf",
	"odt",
	"csv",
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"bmp",
	"tif",
	"tiff",
	"mp3",
	"m4a",
	"wav",
	"ogg",
	"mp4",
	"mov",
]);

const failure = (code: Failure["code"], detail?: string): Failure => ({
	ok: false,
	code,
	...(detail === undefined ? {} : { detail }),
});

/**
 * The absolute path of `rel` inside the project, or null when it would land outside. Every
 * operation below starts here, so there is one place to read to know a path is safe.
 */
export function safePath(
	root: string,
	rel: string,
	allowRoot = false,
): string | null {
	if (typeof root !== "string" || typeof rel !== "string") return null;
	const absolute = resolve(root, rel);
	if (!insideProject(root, absolute)) return null;
	if (!allowRoot && isProjectRoot(root, absolute)) return null;
	return absolute;
}

/** "a/b" for a path relative to the project root, always with "/" between parts. */
export function toRel(root: string, absolute: string): string {
	return relative(root, absolute).split(sep).join("/");
}

/** Files sort after folders; numbers in names compare as numbers ("2 Cells" before "10 Energy"). */
function compareEntries(
	a: { name: string; kind: string },
	b: { name: string; kind: string },
): number {
	if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
	return a.name.localeCompare(b.name, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

/**
 * The project's tree, read from disk. The Studio's own .studio folder is left out: it is
 * memory, not material, and the author never sorts it.
 */
export function readTree(root: string): TreeNode[] {
	const walk = (absolute: string, rel: string, depth: number): TreeNode[] => {
		if (depth > 12) return [];
		let entries: string[];
		try {
			entries = readdirSync(absolute);
		} catch {
			return [];
		}
		const nodes: TreeNode[] = [];
		for (const name of entries) {
			if (rel === "" && name === STUDIO_DIR) continue;
			if (name.startsWith(".") && rel === "") continue;
			const childAbsolute = join(absolute, name);
			const childRel = rel === "" ? name : `${rel}/${name}`;
			let info: ReturnType<typeof lstatSync>;
			try {
				info = lstatSync(childAbsolute);
			} catch {
				continue;
			}
			// A link is shown but not followed: its target may be anywhere, and the guard
			// would refuse it anyway.
			if (info.isSymbolicLink())
				nodes.push({
					name,
					rel: childRel,
					kind: "file",
					size: 0,
					ext: extname(name).slice(1).toLowerCase(),
					children: [],
					files: 0,
				});
			else if (info.isDirectory()) {
				const children = walk(childAbsolute, childRel, depth + 1);
				nodes.push({
					name,
					rel: childRel,
					kind: "folder",
					size: 0,
					ext: "",
					children,
					files: children.filter((child) => child.kind === "file").length,
				});
			} else
				nodes.push({
					name,
					rel: childRel,
					kind: "file",
					size: info.size,
					ext: extname(name).slice(1).toLowerCase(),
					children: [],
					files: 0,
				});
		}
		// The Inbox is always the first row: it is where the author starts.
		return nodes.sort((a, b) =>
			a.name === INBOX_DIR && rel === ""
				? -1
				: b.name === INBOX_DIR && rel === ""
					? 1
					: compareEntries(a, b),
		);
	};
	return walk(root, "", 0);
}

/**
 * One level of the project's tree (task 168): the children of the folder at `rel` ("" is the
 * top), links shown but never followed, and each folder carrying the count of files directly
 * inside it — so a row can say "N files" without loading deeper levels. The folder itself is
 * not included; the reply for one folder is one readdir plus one per folder inside it.
 */
export function readLevel(root: string, rel: string): TreeNode[] | Failure {
	const folder = safePath(root, rel, true);
	if (folder === null) return failure("outside");
	const nodes: TreeNode[] = [];
	let entries: string[] = [];
	try {
		entries = readdirSync(folder);
	} catch {
		return nodes;
	}
	for (const name of entries) {
		if (rel === "" && (name === STUDIO_DIR || name.startsWith("."))) continue;
		const childRel = rel === "" ? name : `${rel}/${name}`;
		const absolute = join(folder, name);
		let info: ReturnType<typeof lstatSync>;
		try {
			info = lstatSync(absolute);
		} catch {
			continue;
		}
		if (info.isSymbolicLink()) {
			nodes.push({
				name,
				rel: childRel,
				kind: "file",
				size: 0,
				ext: extname(name).slice(1).toLowerCase(),
				children: [],
				files: 0,
			});
			continue;
		}
		if (info.isDirectory()) {
			let count = 0;
			try {
				for (const inside of readdirSync(absolute)) {
					try {
						if (lstatSync(join(absolute, inside)).isFile()) count += 1;
					} catch {
						// A file that vanished while we counted is simply not one.
					}
				}
			} catch {
				// A folder that cannot be read shows no count, like before.
			}
			nodes.push({
				name,
				rel: childRel,
				kind: "folder",
				size: 0,
				ext: "",
				children: [],
				files: count,
			});
			continue;
		}
		nodes.push({
			name,
			rel: childRel,
			kind: "file",
			size: info.size,
			ext: extname(name).slice(1).toLowerCase(),
			children: [],
			files: 0,
		});
	}
	// The Inbox is always the first row: it is where the author starts.
	return nodes.sort((a, b) =>
		a.name === INBOX_DIR && rel === ""
			? -1
			: b.name === INBOX_DIR && rel === ""
				? 1
				: compareEntries(a, b),
	);
}

/** The curriculum.json of a project folder, parsed, or why it can't be opened. */
export function readProject(
	root: string,
): { ok: true; project: Project } | Failure {
	const file = join(root, PROJECT_FILE);
	if (!existsSync(file)) return failure("missing");
	let text: string;
	try {
		text = readFileSync(file, "utf8");
	} catch {
		return failure("unreadable");
	}
	const result = parseProject(text);
	if (!result.ok)
		return failure(
			"invalidProject",
			result.issues[0] === undefined
				? undefined
				: `${result.issues[0].path}: ${result.issues[0].message}`,
		);
	// A project from before format version 1 is converted once (task 224): the old file is
	// kept in the backup folder, and the converted one is written in its place.
	if (result.converted === true) {
		try {
			const backup = join(root, BACKUP_DIR);
			mkdirSync(backup, { recursive: true });
			const kept = join(backup, PROJECT_FILE);
			if (!existsSync(kept)) writeFileSync(kept, text, "utf8");
		} catch {
			return failure("unreadable");
		}
		const written = writeProject(root, result.project);
		if (!written.ok) return written;
	}
	return { ok: true, project: result.project };
}

/** Where the conversion of an old project keeps the files it replaced (task 224). */
export const BACKUP_DIR = ".studio/backup-project-v1";

/** The top-level folders of a folder that isn't a project yet, and their child folders. */
export function guessFolders(root: string): GuessFolder[] {
	try {
		return readdirSync(root)
			.filter((name) => !name.startsWith("."))
			.map((name) => {
				const absolute = join(root, name);
				const children = statSync(absolute).isDirectory()
					? readdirSync(absolute).filter((child) => {
							try {
								return statSync(join(absolute, child)).isDirectory();
							} catch {
								return false;
							}
						})
					: [];
				return { name, children };
			})
			.filter((folder) => folder.children.length > 0);
	} catch {
		return [];
	}
}

/** Makes the project's folders and writes curriculum.json, as the wizard showed them. */
export function createProject(root: string, project: unknown): Done {
	if (typeof root !== "string" || root.trim() === "") return failure("missing");
	// The page sends the project; it is checked again here, so a broken one never reaches disk.
	const checked = checkProject(project);
	if (!checked.ok) return checked;
	try {
		mkdirSync(root, { recursive: true });
		for (const folder of projectFolders(checked.project))
			mkdirSync(join(root, ...folder.split("/")), { recursive: true });
	} catch {
		return failure("unreadable");
	}
	return writeProject(root, checked.project);
}

/** Writes curriculum.json alone, checked again, for a project whose folders already exist. */
export function writeProject(root: string, project: unknown): Done {
	const checked = checkProject(project);
	if (!checked.ok) return checked;
	try {
		mkdirSync(root, { recursive: true });
		writeFileSync(
			join(root, PROJECT_FILE),
			`${JSON.stringify(projectFile(checked.project), null, "\t")}\n`,
			"utf8",
		);
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}

/** A project the page sent, read back by the project's own rules. */
function checkProject(
	project: unknown,
): { ok: true; project: Project } | Failure {
	let checked: ReturnType<typeof parseProject>;
	try {
		checked = parseProject(JSON.stringify(project));
	} catch {
		return failure("invalidProject");
	}
	return checked.ok
		? { ok: true, project: checked.project }
		: failure("invalidProject");
}

/** The project as it is written to disk: the same fields, in the same order, every time. */
function projectFile(project: Project): Project {
	return {
		format: project.format,
		formatVersion: project.formatVersion,
		id: project.id,
		nameEn: project.nameEn,
		nameAr: project.nameAr,
		author: project.author,
		rights: project.rights,
		periods: project.periods,
		grades: project.grades,
	};
}

/** A free name in `folder` for `name`, adding " (2)", " (3)" … when it is taken. */
export function freeName(folder: string, name: string): string {
	if (!existsSync(join(folder, name))) return name;
	const ext = extname(name);
	const stem = ext === "" ? name : name.slice(0, -ext.length);
	for (let n = 2; n < 1000; n += 1) {
		const candidate = `${stem} (${n})${ext}`;
		if (!existsSync(join(folder, candidate))) return candidate;
	}
	return `${stem} (${randomUUID().slice(0, 8)})${ext}`;
}

/** Copies files and folders in from Explorer, keeping their names where it can. */
export function importPaths(
	root: string,
	targetRel: string,
	paths: readonly string[],
): Imported {
	const target = safePath(root, targetRel, true);
	if (target === null) return failure("outside");
	if (!existsSync(target) || !statSync(target).isDirectory())
		return failure("missing");
	let added = 0;
	let skipped = 0;
	for (const source of paths) {
		if (typeof source !== "string" || source.trim() === "") {
			skipped += 1;
			continue;
		}
		try {
			const info = lstatSync(source);
			// A link may point anywhere on the disk, so it is refused rather than copied, and a
			// path already inside the project would be copied onto itself.
			if (info.isSymbolicLink() || insideProject(root, source)) {
				skipped += 1;
				continue;
			}
			const name = freeName(target, basename(source));
			cpSync(source, join(target, name), {
				recursive: true,
				errorOnExist: true,
			});
			added += 1;
		} catch {
			skipped += 1;
		}
	}
	return { ok: true, added, skipped };
}

/** A pasted image, written as a PNG with the date in its name. */
export function savePastedImage(
	root: string,
	targetRel: string,
	bytes: Uint8Array,
	ext: string,
	now = new Date(),
): Done {
	const target = safePath(root, targetRel, true);
	if (target === null) return failure("outside");
	if (!existsSync(target) || !statSync(target).isDirectory())
		return failure("missing");
	if (bytes.byteLength === 0) return failure("unreadable");
	if (bytes.byteLength > MAX_READ_BYTES) return failure("tooLarge");
	const suffix = ext === "jpg" || ext === "jpeg" ? "jpg" : "png";
	const name = freeName(target, `Pasted ${stamp(now)}.${suffix}`);
	try {
		writeFileSync(join(target, name), bytes);
		return { ok: true };
	} catch {
		return failure("unreadable");
	}
}

/** "2026-11-12 14.32": a name Windows accepts, and one a person can read. */
export function stamp(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
		`${pad(date.getHours())}.${pad(date.getMinutes())}`
	);
}

/** Moves a file or folder to another folder of the project. */
export function moveEntry(root: string, fromRel: string, toRel: string): Done {
	const from = safePath(root, fromRel);
	const targetFolder = safePath(root, toRel, true);
	if (from === null || targetFolder === null) return failure("outside");
	if (!existsSync(from)) return failure("missing");
	if (!existsSync(targetFolder) || !statSync(targetFolder).isDirectory())
		return failure("missing");
	if (samePath(from, targetFolder) || insideProject(from, targetFolder))
		return failure("invalidName", "A folder can't be moved into itself.");
	if (dirname(from) === targetFolder) return { ok: true };
	try {
		const name = freeName(targetFolder, basename(from));
		renameSync(from, join(targetFolder, name));
		return { ok: true };
	} catch {
		return failure("unknown");
	}
}

function samePath(a: string, b: string): boolean {
	const norm = (p: string) =>
		process.platform === "win32" ? p.toLowerCase() : p;
	return norm(a) === norm(b);
}

/** Renames a file or folder, keeping the extension of a file the author typed over. */
export function renameEntry(root: string, rel: string, name: string): Made {
	const absolute = safePath(root, rel);
	if (absolute === null) return failure("outside");
	if (!existsSync(absolute)) return failure("missing");
	const trimmed = name.trim();
	if (!validFolderName(trimmed)) return failure("invalidName");
	const isFile = lstatSync(absolute).isFile();
	const wanted =
		isFile && extname(trimmed) === ""
			? `${trimmed}${extname(absolute)}`
			: trimmed;
	const folder = dirname(absolute);
	if (
		existsSync(join(folder, wanted)) &&
		!samePath(join(folder, wanted), absolute)
	)
		return failure("nameTaken");
	try {
		renameSync(absolute, join(folder, wanted));
		const parent = toRel(root, folder);
		return { ok: true, rel: parent === "" ? wanted : `${parent}/${wanted}` };
	} catch {
		return failure("unknown");
	}
}

/** The next numbered unit folder, created, so "03 Energy" follows "01" and "02". */
export function makeUnit(root: string, unitsRel: string, title: string): Made {
	const units = safePath(root, unitsRel, true);
	if (units === null) return failure("outside");
	if (!existsSync(units) || !statSync(units).isDirectory())
		return failure("missing");
	const existing = readdirSync(units).filter(
		(name) => unitNumber(name) !== null,
	);
	const name = freeName(units, nextUnitFolder(existing, title));
	try {
		mkdirSync(join(units, name));
		return { ok: true, rel: `${unitsRel}/${name}` };
	} catch {
		return failure("unknown");
	}
}

/** A file's bytes for a viewer, or why it can't be shown. */
export function readBytes(root: string, rel: string): FileBytes {
	const absolute = safePath(root, rel);
	if (absolute === null) return failure("outside");
	let info: ReturnType<typeof statSync>;
	try {
		info = statSync(absolute);
	} catch {
		return failure("missing");
	}
	if (!info.isFile()) return failure("unreadable");
	if (info.size > MAX_READ_BYTES) return failure("tooLarge");
	try {
		const bytes = new Uint8Array(readFileSync(absolute));
		return { ok: true, name: basename(absolute), bytes };
	} catch {
		return failure("unreadable");
	}
}

/** A text or Markdown file as plain text. Markdown is not rendered: material stays material. */
export function readText(root: string, rel: string): FileText {
	const bytes = readBytes(root, rel);
	if (!bytes.ok) return bytes;
	try {
		return {
			ok: true,
			name: bytes.name,
			text: new TextDecoder("utf-8", { fatal: false }).decode(bytes.bytes),
		};
	} catch {
		return failure("unreadable");
	}
}

/** True when Windows is allowed to open this file from the viewer. */
export function openable(rel: string): boolean {
	return OPENABLE.has(extname(rel).slice(1).toLowerCase());
}

/** The absolute path for "open in its app", or null when the guard refuses it. */
export function openablePath(root: string, rel: string): string | null {
	if (!openable(rel)) return null;
	return safePath(root, rel);
}
