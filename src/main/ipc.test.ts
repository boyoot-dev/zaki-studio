// The IPC door's key surface (task 157): the author's key goes in once, and no channel ever
// hands it back. Electron is replaced here by two small fakes — the handlers it would register,
// and the dialog — so every call the page can make is run for real and its answer searched for
// the key. No network is reached: the one channel that would ask OpenRouter gets a fake fetch.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChangesState } from "../shared/api.ts";
import type { FileRow } from "../shared/model.ts";
import { NOTES_DIR } from "../shared/notes.ts";
import { writeFiles, writeModel } from "./model.ts";

/** Everything the Electron fake keeps, made before the mock is hoisted. */
const fake = vi.hoisted(() => ({
	handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
	chosen: "",
	userData: "",
	studio: "",
	answer: 1,
}));

vi.mock("electron", () => ({
	app: {
		getPath: () => fake.userData,
		getAppPath: () => fake.studio,
		isPackaged: false,
		requestSingleInstanceLock: () => true,
	},
	BrowserWindow: { getFocusedWindow: () => null },
	clipboard: { writeText: () => {} },
	dialog: {
		showMessageBox: async () => ({ response: fake.answer }),
		showOpenDialog: async () => ({
			canceled: fake.chosen === "",
			filePaths: fake.chosen === "" ? [] : [fake.chosen],
		}),
	},
	ipcMain: {
		handle: (
			channel: string,
			handler: (event: unknown, ...args: unknown[]) => unknown,
		) => fake.handlers.set(channel, handler),
	},
	safeStorage: {
		isEncryptionAvailable: () => true,
		encryptString: (text: string) => Buffer.from(text, "utf8"),
		decryptString: (bytes: Buffer) => bytes.toString("utf8"),
	},
	shell: { trashItem: async () => {}, openPath: async () => "" },
}));

const KEY = "sk-or-v1-ipc-test-key-not-real-000000";

/** A register row of a made-up file with no pages, so no note is ever asked for. */
function row(): FileRow {
	return {
		id: "abcdef012345",
		path: "Grade 3/Math/sheet.pdf",
		grade: 3,
		subject: "math",
		language: "en",
		block: "1",
		kind: "sheet",
		pages: 0,
		authority: 2,
		year: "current",
		academicYear: "2026-27",
		published: "",
		publishedFrom: "",
		dupOf: "",
		imagePages: 0,
		error: "",
		firstSeen: "2026-11-01",
		size: 10,
		mtime: "1",
		metaDate: "",
		fixed: [],
	};
}

let base = "";
let project = "";

/** A fake page, as the calls see their sender. */
const page = {
	sender: { id: 1, isDestroyed: () => false, send: () => {}, once: () => {} },
};

/** Asks one channel and returns what the page would get. */
async function ask(channel: string, ...args: unknown[]): Promise<unknown> {
	const handler = fake.handlers.get(channel);
	if (handler === undefined) throw new Error(`${channel} is not registered`);
	return handler(page, ...args);
}

beforeEach(async () => {
	base = mkdtempSync(join(tmpdir(), "studio-ipc-"));
	project = join(base, "kestrel");
	fake.userData = join(base, "user-data");
	fake.studio = join(import.meta.dirname, "..", "..");
	fake.chosen = project;
	fake.answer = 1;
	mkdirSync(join(project, ".studio"), { recursive: true });
	mkdirSync(fake.userData, { recursive: true });
	writeFileSync(
		join(project, ".studio", "files.json"),
		`${JSON.stringify([row()], null, "\t")}\n`,
	);
	// A model with one course and period, so the changes channels reach their own checks.
	writeModel(project, {
		curriculum: {
			nameEn: "Made-up Curriculum",
			nameAr: "منهج مُختلق",
			author: "",
			rights: "",
			periods: [
				{
					id: "block-1",
					nameEn: "Block 1",
					nameAr: "المرحلة 1",
					wholeYear: false,
					periods: [],
				},
			],
		},
		courses: [
			{
				grade: 3,
				subject: "math",
				language: "en",
				support: [],
				examStyle: null,
				exams: [],
				units: [
					{
						id: "u2",
						number: 1,
						period: "block-1",
						title: "Numbers",
						source: "sheet",
						keywords: [],
						evidence: [],
						lessons: [
							{
								id: "l3",
								number: 1,
								title: "Counting",
								skills: [{ id: "s1", code: null, text: "count to ten" }],
								facts: [],
								activity: null,
							},
						],
					},
				],
			},
		],
	});
	// OpenRouter is never reached: the model list and the key test get this answer.
	vi.stubGlobal("fetch", async (input: string | URL | Request) => {
		const url = String(input);
		if (url.endsWith("/models"))
			return new Response(
				JSON.stringify({
					data: [
						{
							id: "anthropic/claude-haiku-5.5",
							name: "Claude Haiku 5.5",
							architecture: { input_modalities: ["text", "image"] },
							pricing: { prompt: "0.0000001", completion: "0.0000005" },
						},
					],
				}),
			);
		return new Response(
			JSON.stringify({
				choices: [{ message: { content: "OK" }, finish_reason: "stop" }],
				usage: { prompt_tokens: 8, completion_tokens: 1 },
			}),
		);
	});
	const { registerIpc } = await import("./ipc");
	registerIpc();
	// The page may only use folders the author picked in this window.
	await ask("studio:chooseFolder");
});

afterEach(() => {
	vi.unstubAllGlobals();
	fake.handlers.clear();
	rmSync(base, { recursive: true, force: true });
});

describe("the key on the IPC surface", () => {
	it("is saved once, and the page only learns whether one is set", async () => {
		expect(await ask("studio:saveKey", KEY)).toEqual({ ok: true });
		const state = await ask("studio:notesState", project);
		expect(state).toMatchObject({ ok: true, keySet: true });
		expect(JSON.stringify(state)).not.toContain(KEY);

		const plan = await ask("studio:notesPlan", project, []);
		expect(plan).toMatchObject({ ok: true, keySet: true });
		expect(JSON.stringify(plan)).not.toContain(KEY);

		expect(await ask("studio:testKey")).toEqual({ ok: true });
	});

	it("never appears in any answer a channel gives", async () => {
		await ask("studio:saveKey", KEY);
		// Every read-only or refused call the page can make with this project.
		const answers: unknown[] = [];
		for (const channel of [
			"studio:notesState",
			"studio:noteText",
			"studio:notesPlan",
			"studio:notesRows",
			"studio:notesIds",
			"studio:scanState",
			"studio:reportRows",
			"studio:model",
			"studio:course",
			"studio:fileRow",
			"studio:filePaths",
			"studio:folders",
			"studio:listTree",
			"studio:exportSummary",
			"studio:recentProjects",
			"studio:collectJob",
			"studio:deleteJob",
			"studio:prepareJob",
			"studio:copyText",
			"studio:saveNoteSettings",
			"studio:testKey",
			"studio:writeNotes",
			"studio:saveKey",
			"studio:changesState",
			"studio:unitsPlan",
			"studio:writeChanges",
			"studio:prepareUnitsJob",
			"studio:collectUnitsJob",
			"studio:deleteUnitsJob",
			"studio:acceptChanges",
			"studio:rejectChanges",
			"studio:deleteChanges",
			"studio:saveUnitsSettings",
		]) {
			const args =
				channel === "studio:notesPlan"
					? [project, ["abcdef012345"]]
					: channel === "studio:noteText"
						? [project, "abcdef012345"]
						: channel === "studio:notesRows" || channel === "studio:reportRows"
							? [project, 0, 200]
							: channel === "studio:course"
								? [project, 3, "math"]
								: channel === "studio:fileRow"
									? [project, "Grade 3/Math/sheet.pdf"]
									: channel === "studio:filePaths"
										? [project, ["abcdef012345"]]
										: channel === "studio:folders"
											? [project]
											: channel === "studio:collectJob"
												? [project, "../../Windows"]
												: channel === "studio:deleteJob"
													? [project, "2026-11-13-0830"]
													: channel === "studio:prepareJob"
														? [project, ["abcdef012345"], "claude-code"]
														: channel === "studio:copyText"
															? ["a prompt"]
															: channel === "studio:saveNoteSettings"
																? ["anthropic/claude-haiku-5.5", 3]
																: channel === "studio:writeNotes"
																	? [project, [], 2]
																	: channel === "studio:saveKey"
																		? [KEY]
																		: channel === "studio:unitsPlan"
																			? [project, 3, "math", "block-1"]
																			: channel === "studio:writeChanges"
																				? [project, 3, "math", "block-1", 2]
																				: channel === "studio:prepareUnitsJob"
																					? [
																							project,
																							[
																								{
																									grade: 3,
																									subject: "math",
																									language: "en",
																									period: "block-1",
																								},
																							],
																							"claude-code",
																						]
																					: channel === "studio:collectUnitsJob"
																						? [project, "../../Windows"]
																						: channel ===
																								"studio:deleteUnitsJob"
																							? [project, "2026-11-13-0830"]
																							: channel ===
																									"studio:acceptChanges"
																								? [
																										project,
																										3,
																										"math",
																										"block-1",
																									]
																								: channel ===
																										"studio:rejectChanges"
																									? [
																											project,
																											3,
																											"math",
																											"block-1",
																										]
																									: channel ===
																											"studio:deleteChanges"
																										? [
																												project,
																												3,
																												"math",
																												"block-1",
																											]
																										: channel ===
																												"studio:saveUnitsSettings"
																											? [
																													"anthropic/claude-sonnet-5.5",
																													3,
																												]
																											: [project];
			answers.push(await ask(channel, ...args));
		}
		const text = JSON.stringify(answers);
		expect(text).not.toContain(KEY);
		expect(text).not.toContain("sk-or-");
	});

	it("has no channel that hands the key back, and clears it when asked", async () => {
		const named = [...fake.handlers.keys()].filter((name) => /key/i.test(name));
		expect(named.sort()).toEqual([
			"studio:clearKey",
			"studio:saveKey",
			"studio:testKey",
		]);
		await ask("studio:saveKey", KEY);
		expect(await ask("studio:clearKey")).toEqual({ ok: true });
		expect(await ask("studio:notesState", project)).toMatchObject({
			ok: true,
			keySet: false,
		});
	});

	it("refuses a key-shaped value that cannot be one, without saying why", async () => {
		expect(await ask("studio:saveKey", "short")).toEqual({
			ok: false,
			code: "invalidName",
		});
		expect(await ask("studio:testKey")).toEqual({ ok: false, code: "noKey" });
	});
});

describe("the list channels (task 168)", () => {
	it("pages the notes list, and no reply carries the whole register", async () => {
		const listed = await ask("studio:notesRows", project, 0, 500);
		expect(listed).toMatchObject({ ok: true, total: expect.any(Number) });
		expect(
			Array.isArray((listed as { items: unknown[] }).items)
				? (listed as { items: unknown[] }).items.length
				: 10_000,
		).toBeLessThanOrEqual(400);

		const state = await ask("studio:notesState", project);
		expect(state).toMatchObject({
			ok: true,
			total: expect.any(Number),
			missing: expect.any(Number),
		});
		expect(state).not.toHaveProperty("files");

		const scan = await ask("studio:scanState", project);
		expect(scan).toMatchObject({ ok: true, total: expect.any(Number) });
		expect(scan).not.toHaveProperty("files");
		expect(scan).not.toHaveProperty("report");

		const rows = await ask("studio:reportRows", project, 0, 500);
		expect(
			Array.isArray((rows as { items: unknown[] }).items)
				? (rows as { items: unknown[] }).items.length
				: 10_000,
		).toBeLessThanOrEqual(400);
	});

	it("names every file a filter shows, loaded page or not (task 181)", async () => {
		// A file with pages, which is what the notes list holds: a file with none is skipped.
		const paper = {
			...row(),
			id: "abcdef012346",
			path: "Grade 3/Math/paper.pdf",
			block: "2",
			academicYear: "2024-25",
			pages: 2,
		};
		writeFileSync(
			join(project, ".studio", "files.json"),
			`${JSON.stringify([row(), paper], null, "\t")}\n`,
		);

		expect(await ask("studio:notesIds", project)).toEqual({
			ok: true,
			ids: ["abcdef012346"],
		});
		expect(await ask("studio:notesIds", project, { blocks: ["2"] })).toEqual({
			ok: true,
			ids: ["abcdef012346"],
		});
		expect(await ask("studio:notesIds", project, { blocks: ["1"] })).toEqual({
			ok: true,
			ids: [],
		});
		expect(
			await ask("studio:notesIds", project, { years: ["2024-25"] }),
		).toEqual({ ok: true, ids: ["abcdef012346"] });
		expect(
			await ask("studio:notesIds", project, { years: ["2026-27"] }),
		).toEqual({ ok: true, ids: [] });
	});

	it("lists one level of the tree, with every row's folder count", async () => {
		mkdirSync(join(project, "Inbox"), { recursive: true });
		const listed = await ask("studio:listTree", project, "");
		expect(listed).toMatchObject({ ok: true });
		const nodes = (
			listed as {
				nodes: { kind: string; children: unknown[]; files: number }[];
			}
		).nodes;
		expect(Array.isArray(nodes)).toBe(true);
		for (const node of nodes) {
			expect(node.children).toHaveLength(0);
			expect(typeof node.files).toBe("number");
		}

		const one = await ask("studio:listTree", project, "Inbox");
		expect(one).toMatchObject({ ok: true });
	});

	it("answers the file's row, or null when the register has no such file", async () => {
		const found = await ask(
			"studio:fileRow",
			project,
			"Grade 3/Math/sheet.pdf",
		);
		expect(found).toMatchObject({ ok: true });
		expect((found as { row: { id: string } }).row.id).toBe("abcdef012345");

		const missing = await ask(
			"studio:fileRow",
			project,
			"Grade 9/Nowhere/none.pdf",
		);
		expect(missing).toEqual({ ok: true, row: null });
	});

	it("refuses a path outside the project for the tree level", async () => {
		expect(await ask("studio:listTree", project, "../../Windows")).toEqual({
			ok: false,
			code: "outside",
		});
	});
});

describe("a course in another language (task 228)", () => {
	it("is offered as a change target once a file is assigned to it", async () => {
		// A second file with pages, so the target counts one readable file.
		const extra = {
			...row(),
			id: "0123456789ab",
			path: "Grade 3/Math/sheet-ar.pdf",
			pages: 3,
		};
		expect(writeFiles(project, [row(), extra]).ok).toBe(true);
		// The details form assigns the file to the course in Arabic (the language menu).
		expect(
			await ask("studio:setFileFields", project, "0123456789ab", {
				grade: 3,
				subject: "math",
				language: "ar",
				block: "1",
				kind: "sheet",
				authority: 2,
			}),
		).toEqual({ ok: true });
		// A note makes the register row show in the changes list.
		mkdirSync(join(project, NOTES_DIR), { recursive: true });
		writeFileSync(join(project, NOTES_DIR, "0123456789ab.md"), "# A note\n");
		const state = (await ask("studio:changesState", project)) as ChangesState;
		if (!state.ok) throw new Error("changesState failed");
		expect(
			state.targets.find(
				(target) =>
					target.grade === 3 &&
					target.subject === "math" &&
					target.language === "ar" &&
					target.period === "block-1",
			),
		).toMatchObject({ newCourse: true, units: 0, files: 1, notes: 1 });
	});
});
