// Makes a synthetic project in an empty folder, for measuring the Studio on a full school
// (task 168): `npm run bench-project -- <folder> [files=35000]`. Everything in it is made
// up — invented unit titles, invented words, made-up dates — and no real material is read or
// written anywhere. The layout is the wizard's own: curriculum.json, an Inbox, and one
// "Grade N/Subject/Units|Books|Extra|Exam" folder tree per grade and subject.
//
// What it writes:
//   - curriculum.json, and the folders the wizard would have made
//   - tiny valid one-page PDFs (the register accepts the extension, nothing opens them)
//   - .studio/files.json, the register, the size of files.json growing with `files`
//   - .studio/text/<id>.md for most files, in the pipeline's own page format
//   - notes for about 5% of files, .studio/notes/<id>.md
//   - .studio/model/curriculum.json and one file per course, with units and lessons
//
// It refuses a folder that isn't empty. The smallest useful size is 1,000 files; the two
// sizes the bench is run at are 7,000 (the owner's three grades) and 35,000 (KG-12).

import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { type FileRow, modelFileText } from "../src/shared/model.ts";
import {
	compareRows,
	newMaterial,
	type ReportCourse,
} from "../src/shared/register.ts";
import {
	finalExamPeriod,
	gradeFolder,
	PROJECT_FILE,
	PROJECT_FORMAT,
	PROJECT_FORMAT_VERSION,
	presetPeriods,
	STUDIO_DIR,
	subjectFolder,
} from "../src/shared/project.ts";
import { SUBJECTS_FILE, subjectsJson } from "./subjects.ts";

/** The files the project holds unless asked otherwise. */
const DEFAULT_FILES = 35000;
/** The smallest project the bench says anything about. */
const MIN_FILES = 1000;
/** The subjects the synthetic school teaches, of one language mix. */
const SUBJECT_IDS = [
	"math",
	"science",
	"biology",
	"chemistry",
	"physics",
	"english",
	"arabic",
	"social-studies",
] as const;
/** KG1, KG2 and Grades 1-12: the 14 grades of a full school. */
const ALL_GRADES = [-1, 0, ...Array.from({ length: 12 }, (_, i) => i + 1)];

/** How many grades a project of `files` files holds, the last ones of KG-12. */
function gradesFor(files: number): number[] {
	if (files >= 35000) return [...ALL_GRADES];
	const count = Math.max(1, Math.round(files / 2500));
	return ALL_GRADES.slice(ALL_GRADES.length - count);
}

/** A deterministic pseudo-random generator, so every build of the same size is the same. */
function prng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

/** The factories the rows come from: invented words and dates, never real material. */
const WORDS =
	"alkali amber anchor argon basalt bauxite cobalt copper crystal dawn delta ember fjord fluorite galena garnet geode granite gypsum halite horizon indigo iron jade jasper kelvin krypton lapis lava lattice magnetite magma marble meteor midnight mosaic nebula nickel obsidian olive onyx opal orbit pearl quartz ravine ruby sapphire scoria silver stratosphere talc topaz tundra turquoise ultraviolet uranium valley vertex vulcanite xenon zeolite zircon".split(
		" ",
	);
/** The unit titles the made-up school teaches. */
const TITLES =
	"Classification Energy Forces Matter Cells Ecosystems Algebra Geometry Poetry Revolutions Networks Memory Equations Angles Trade Orbits Corrosion Habitats Resistance".split(
		" ",
	);

/** One invented sentence fragment, in the bundle's size for a fact. */
function phrase(rand: () => number, words: number): string {
	const parts: string[] = [];
	for (let i = 0; i < words; i += 1)
		parts.push(WORDS[Math.floor(rand() * WORDS.length)] ?? "quartz");
	return parts.join(" ");
}

/** A date between two years, as "YYYY-MM-DD", from a seeded generator. */
function date(rand: () => number, fromYear: number, toYear: number): string {
	const year = fromYear + Math.floor(rand() * (toYear - fromYear + 1));
	const month = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
	const day = String(1 + Math.floor(rand() * 28)).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** The kinds the register knows, weighted the way a school pile is. */
function kindOf(rand: () => number): string {
	const roll = rand();
	if (roll < 0.45) return "book";
	if (roll < 0.7) return "sheet";
	if (roll < 0.8) return "worksheet";
	if (roll < 0.85) return "revision";
	if (roll < 0.93) return "exam";
	return "other";
}

/** One valid one-page PDF, with one line of made-up text. Offsets are computed for real. */
function tinyPdf(line: string): Buffer {
	const safe = line.replace(/[\\()]/g, " ").slice(0, 90);
	const text = `BT /F1 10 Tf 50 750 Td (${safe}) Tj ET`;
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream"`,
	];
	const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "utf8")];
	const offsets: number[] = [];
	let at = chunks[0]?.length ?? 0;
	for (const [index, body] of objects.entries()) {
		offsets.push(at);
		const chunk = Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`, "utf8");
		chunks.push(chunk);
		at += chunk.length;
	}
	const startXref = at;
	const table = [
		"xref",
		`0 ${objects.length + 1}`,
		"0000000000 65535 f ",
		...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
		"trailer",
		`<< /Size ${objects.length + 1} /Root 1 0 R >>`,
		"startxref",
		String(startXref),
		"%%EOF",
		"",
	].join("\n");
	chunks.push(Buffer.from(table, "utf8"));
	return Buffer.concat(chunks);
}

/** One file's text, in exactly the format read.ts and the work folder write. */
function textPages(path: string, pages: number, rand: () => number): string {
	const out = [`# ${path}`, ""];
	for (let page = 1; page <= pages; page += 1) {
		out.push(`## Page ${page}`, "", phrase(rand, 80), "");
	}
	return out.join("\n");
}

/** The whole project, built under `root`, which must be an empty folder. */
function build(root: string, files: number): void {
	const rand = prng(168);
	const grades = gradesFor(files);
	const courses = grades.flatMap((grade) =>
		SUBJECT_IDS.map((subject) => ({ grade, subject })),
	);
	const perCourse = Math.floor(files / courses.length);
	let remainder = files - perCourse * courses.length;

	const subjectNames = new Map<string, string>();
	const raw: unknown = JSON.parse(
		subjectsJson(readFileSync(SUBJECTS_FILE, "utf8")),
	);
	if (Array.isArray(raw)) {
		for (const entry of raw) {
			if (typeof entry !== "object" || entry === null) continue;
			const item = entry as Record<string, unknown>;
			if (typeof item.id === "string" && typeof item.nameEn === "string")
				subjectNames.set(item.id, item.nameEn);
		}
	}

	// The folders the wizard makes, per grade and subject, plus the Inbox.
	mkdirSync(join(root, "Inbox"), { recursive: true });
	for (const { grade, subject } of courses) {
		const base = [
			gradeFolder(grade),
			subjectFolder(subjectNames.get(subject) ?? "Subject"),
		];
		mkdirSync(join(root, ...base, "Exam", "past-papers"), {
			recursive: true,
		});
		mkdirSync(join(root, ...base, "Exam", "listening-samples"), {
			recursive: true,
		});
		mkdirSync(join(root, ...base, "Exam", "reading-samples"), {
			recursive: true,
		});
		mkdirSync(join(root, ...base, "Books"), { recursive: true });
		mkdirSync(join(root, ...base, "Extra"), { recursive: true });
		for (let unit = 1; unit <= 8; unit += 1) {
			const title = TITLES[(unit * 3 + grade + 24) % TITLES.length] ?? "Cells";
			mkdirSync(
				join(
					root,
					...base,
					"Units",
					`${String(unit).padStart(2, "0")} ${title}`,
				),
				{ recursive: true },
			);
		}
	}

	// The register, written as each file is born, so ids and stats match the disk.
	const rows: FileRow[] = [];
	const idsWithText: { id: string; rel: string }[] = [];
	let made = 0;
	const putFile = (
		rel: string,
		subject: string,
		kind: string,
		authority: number,
		year: "current" | "old",
		pages: number,
	): void => {
		const absolute = join(root, ...rel.split("/"));
		const currentYear = year === "current";
		// About 3% of files are byte-identical copies of one made earlier, as in a real pile.
		const copy =
			made > 40 && rand() < 0.03
				? rows[Math.floor(rand() * rows.length)]
				: undefined;
		const line = `${rel} ${made}`;
		const bytes =
			copy === undefined ? tinyPdf(line) : copyBytes(root, copy.path);
		writeFileSync(absolute, bytes);
		const id = createHash("sha1").update(bytes).digest("hex").slice(0, 12);
		const info = statSync(absolute, { bigint: true });
		const published = date(rand, currentYear ? 2024 : 2015, 2026);
		const row: FileRow = {
			id,
			path: rel,
			grade: null,
			subject,
			block: String((made % 6) + 1),
			kind,
			pages,
			authority,
			year,
			academicYear: currentYear ? "2026-27" : "2024-25",
			published,
			publishedFrom: "name",
			dupOf: copy === undefined ? "" : copy.path,
			imagePages: rand() < 0.15 ? 1 : 0,
			error: "",
			firstSeen: "2026-10-01",
			size: Number(info.size),
			mtime: info.mtimeNs.toString(),
			metaDate: published,
			fixed: [],
		};
		rows.push(row);
		if (copy === undefined && rand() < 0.9) idsWithText.push({ id, rel });
		made += 1;
	};

	for (const course of courses) {
		const base = [
			gradeFolder(course.grade),
			subjectFolder(subjectNames.get(course.subject) ?? "Subject"),
		];
		const target = perCourse + (remainder > 0 ? 1 : 0);
		if (remainder > 0) remainder -= 1;
		let count = 0;
		// Unit sheets: two per unit, each with a sheet's own kind and authority.
		for (let unit = 1; unit <= 8 && count < target; unit += 1) {
			for (let sheet = 1; sheet <= 2 && count < target; sheet += 1) {
				const title =
					TITLES[(unit * 3 + course.grade + 24) % TITLES.length] ?? "Cells";
				const rel = [
					...base,
					"Units",
					`${String(unit).padStart(2, "0")} ${title}`,
					`sheet-${unit}-${sheet}.pdf`,
				].join("/");
				putFile(
					rel,
					course.subject,
					"sheet",
					1 + Math.floor(rand() * 2),
					"current",
					2,
				);
				count += 1;
			}
		}
		// Past papers.
		const papers = Math.max(4, Math.round(target * 0.08));
		for (let paper = 1; paper <= papers && count < target; paper += 1) {
			const rel = [
				...base,
				"Exam",
				"past-papers",
				`paper-${String(paper).padStart(2, "0")}.pdf`,
			].join("/");
			putFile(rel, course.subject, "exam", 1, "old", 3);
			count += 1;
		}
		// Books and extra sheets make up the rest.
		const rest = target - count;
		const books = Math.round(rest * 0.57);
		for (let chapter = 1; chapter <= books && count < target; chapter += 1) {
			const rel = [
				...base,
				"Books",
				`chapter-${String(chapter).padStart(3, "0")}.pdf`,
			].join("/");
			putFile(
				rel,
				course.subject,
				"book",
				1,
				rand() < 0.75 ? "current" : "old",
				20 + Math.floor(rand() * 20),
			);
			count += 1;
		}
		for (let sheet = 1; count < target; sheet += 1) {
			const rel = [
				...base,
				"Extra",
				`worksheet-${String(sheet).padStart(3, "0")}.pdf`,
			].join("/");
			putFile(
				rel,
				course.subject,
				kindOf(rand),
				2 + Math.floor(rand() * 3),
				"old",
				4,
			);
			count += 1;
		}
	}

	// The grade in each row: computed from the folder name above by subjectOf; fix KG names.
	for (const row of rows) {
		const first = row.path.split("/")[0] ?? "";
		if (first === "KG1") row.grade = -1;
		else if (first === "KG2") row.grade = 0;
		else row.grade = Number(first.replace("Grade ", "")) || null;
	}

	// The Studio's own folder: the register, the texts, the notes and the model.
	mkdirSync(join(root, STUDIO_DIR), { recursive: true });
	writeFileSync(
		join(root, STUDIO_DIR, "files.json"),
		modelFileText(rows),
		"utf8",
	);

	const textDir = join(root, STUDIO_DIR, "text");
	mkdirSync(textDir, { recursive: true });
	for (const { id, rel } of idsWithText) {
		const pages = 2 + Math.floor(rand() * 5);
		writeFileSync(
			join(textDir, `${id}.md`),
			textPages(rel, pages, rand),
			"utf8",
		);
	}

	const notesDir = join(root, STUDIO_DIR, "notes");
	mkdirSync(notesDir, { recursive: true });
	const noted = new Set<string>();
	const noteTarget = Math.floor(rows.length * 0.05);
	for (const { id } of idsWithText) {
		if (noted.size >= noteTarget) break;
		if (rand() < 0.055) noted.add(id);
	}
	for (const id of noted) {
		const body = [
			`# ${rows.find((row) => row.id === id)?.path ?? id}`,
			"",
			`${phrase(rand, 30)}.`,
			"",
			`${phrase(rand, 30)}.`,
			"",
			`Key words: ${phrase(rand, 6)}`,
			"",
		].join("\n");
		writeFileSync(join(notesDir, `${id}.md`), body, "utf8");
	}

	const modelDir = join(root, STUDIO_DIR, "model");
	mkdirSync(modelDir, { recursive: true });
	const periods = [...presetPeriods("terms-blocks"), finalExamPeriod()];
	const reportCourses: ReportCourse[] = [];
	const curriculum = {
		nameEn: "Made-up School Curriculum",
		nameAr: "منهج المدرسة المُختلقة",
		author: "",
		rights: "",
		periods,
	};
	writeFileSync(
		join(modelDir, "curriculum.json"),
		modelFileText(curriculum),
		"utf8",
	);
	let factsTotal = 0;
	for (const course of courses) {
		const courseRows = rows.filter(
			(row) => row.grade === course.grade && row.subject === course.subject,
		);
		const units = TITLES.slice(0, 8).map((_, unitIndex) => {
			const unit = unitIndex + 1;
			const block = ((unit - 1) % 6) + 1;
			const period = ["t1-b1", "t1-b2", "t2-b1", "t2-b2", "t3-b1", "t3-b2"][
				block - 1
			];
			const title =
				TITLES[(unit * 5 + course.grade + 11) % TITLES.length] ?? "Cells";
			const lessons = [1, 2, 3, 4, 5, 6].map((lesson) => {
				const sources = courseRows
					.slice(
						(unitIndex * 6 + lesson * 3) % Math.max(1, courseRows.length),
						((unitIndex * 6 + lesson * 3) % Math.max(1, courseRows.length)) + 2,
					)
					.map((row) => `${row.id}#p2`);
				const facts = [1, 2, 3].map(() => ({
					text: phrase(rand, 12 + Math.floor(rand() * 8)),
					sources,
					status: "draft" as const,
					own: false,
				}));
				factsTotal += facts.length;
				return {
					number: lesson,
					title: phrase(rand, 3 + Math.floor(rand() * 3)),
					skills: [1, 2, 3].map((code) => ({
						code: `${course.grade}.${unit}.${code}`,
						text: `${phrase(rand, 5)}`,
					})),
					facts,
					activity: lesson % 3 === 0 ? ("reading" as const) : null,
				};
			});
			const courseUnits = [
				{
					number: unit,
					period,
					title,
					source: "sheet" as const,
					keywords: [phrase(rand, 1), phrase(rand, 1), phrase(rand, 1)],
					evidence: [phrase(rand, 6), phrase(rand, 6)],
					lessons,
				},
			];
			return courseUnits[0];
		});
		reportCourses.push({
			grade: course.grade,
			subject: course.subject,
			units: units.map((unit) => ({
				number: unit.number,
				period: unit.period,
				title: unit.title,
				source: unit.source,
			})),
		});
		writeFileSync(
			join(modelDir, `grade-${course.grade}-${course.subject}.json`),
			modelFileText({
				grade: course.grade,
				subject: course.subject,
				examStyle: null,
				exams: [],
				units,
			}),
			"utf8",
		);
	}

	// The last scan's report, as the first scan of this project would have left it: found
	// everything, read everything it had to, and nothing changed since (there was no before).
	const at = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
	const report = newMaterial({
		at: stamp,
		since: "",
		found: rows.length,
		read: idsWithText.length,
		changes: compareRows([], rows),
		courses: reportCourses,
		today: at,
	});
	writeFileSync(
		join(root, STUDIO_DIR, "new.json"),
		modelFileText(report),
		"utf8",
	);

	// The project file, checked by the Studio's own rules before it is kept.
	const project = {
		format: PROJECT_FORMAT,
		formatVersion: PROJECT_FORMAT_VERSION,
		id: randomUUID(),
		nameEn: "Made-up School",
		nameAr: "المدرسة المُختلقة",
		author: "",
		rights: "",
		periods,
		grades: grades.map((grade) => ({
			grade,
			folder: gradeFolder(grade),
			subjects: SUBJECT_IDS.map((subject) => ({
				subject,
				folder: subjectFolder(subjectNames.get(subject) ?? "Subject"),
			})),
		})),
	};
	writeFileSync(
		join(root, PROJECT_FILE),
		`${JSON.stringify(project, null, "\t")}\n`,
		"utf8",
	);

	const filesJson = statSync(join(root, STUDIO_DIR, "files.json")).size;
	const textCount = idsWithText.length;
	console.log(`Synthetic project in ${root}`);
	console.log(`  ${rows.length} files, ${noted.size} notes`);
	console.log(`  files.json: ${(filesJson / 1024).toFixed(0)} KB`);
	console.log(`  ${textCount} text files`);
	console.log(`  ${factsTotal} facts in the model`);
}

/** A file's bytes as they are on disk, for a byte-identical copy. */
function copyBytes(root: string, rel: string): Buffer {
	return readFileSync(join(root, ...rel.split("/")));
}

/** The folder must be empty but for hidden files it already holds nothing. */
function refuseUnlessEmpty(folder: string): void {
	if (!existsSync(folder)) return;
	for (const name of readdirSync(folder)) {
		throw new Error(`the folder is not empty (it holds "${name}")`);
	}
}

function main(): void {
	const [folder, rawFiles] = process.argv.slice(2);
	if (folder === undefined) {
		console.error("usage: npm run bench-project -- <folder> [files=35000]");
		process.exitCode = 2;
		return;
	}
	const files = rawFiles === undefined ? DEFAULT_FILES : Number(rawFiles);
	if (!Number.isInteger(files) || files < MIN_FILES) {
		console.error(`files must be a whole number, at least ${MIN_FILES}`);
		process.exitCode = 2;
		return;
	}
	refuseUnlessEmpty(folder);
	mkdirSync(folder, { recursive: true });
	build(folder, files);
}

const running = process.argv[1] ?? "";
if (running.endsWith("bench-project.ts") || running.endsWith("bench-project"))
	main();
