// The published standard (task 162): the examples must behave the way
// examples/README.md says they do. The parser is the app's own, so the standard's
// examples can never drift from what a real app accepts. ajv is used here and only
// here, to check the examples against the JSON Schema the standard ships.
//
// Task 174 added format version 2 and its one field, `questions.answerWords`; the
// tests below also pin the version rule: a version 1 file refuses the new field and
// a version 2 file accepts it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { subjectsJson } from "../../scripts/subjects.ts";
import {
	LATEST_FORMAT_VERSION,
	parseBundle,
	parseCourseExams,
} from "./format/bundle.ts";

/** The standard folder beside src/. */
const STANDARD = fileURLToPath(new URL("../../standard", import.meta.url));
/** The subject list, the copy the Studio ships (src/shared/format). */
const SUBJECTS_PATH = fileURLToPath(
	new URL("./format/subjects.json", import.meta.url),
);

const subjectIds: string[] = (
	JSON.parse(subjectsJson(readFileSync(SUBJECTS_PATH, "utf8"))) as {
		id: string;
	}[]
).map((s) => s.id);

const example = (name: string): string =>
	readFileSync(`${STANDARD}/examples/${name}`, "utf8");
const exampleJson = (name: string): unknown => JSON.parse(example(name));

/** Both schemas, compiled once for all the checks. */
const schemaV1 = JSON.parse(
	readFileSync(`${STANDARD}/schema/bundle-v1.schema.json`, "utf8"),
) as object;
const schemaV2 = JSON.parse(
	readFileSync(`${STANDARD}/schema/bundle-v2.schema.json`, "utf8"),
) as object;
const ajv = new Ajv({ allErrors: true });
const validateV1 = ajv.compile(schemaV1);
const validateV2 = ajv.compile(schemaV2);

const issuesOf = (name: string): string => {
	const result = parseBundle(example(name), subjectIds);
	if (result.ok) throw new Error(`${name} was expected to be refused`);
	return result.issues
		.map((issue) => `${issue.path}: ${issue.message}`)
		.join("\n");
};

const issuesOfText = (text: string): string => {
	const result = parseBundle(text, subjectIds);
	if (result.ok) throw new Error("the bundle was expected to be refused");
	return result.issues
		.map((issue) => `${issue.path}: ${issue.message}`)
		.join("\n");
};

describe("the standard's examples", () => {
	it("the minimal example passes the parser and version 1's schema", () => {
		const result = parseBundle(example("minimal.json"), subjectIds);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.formatVersion).toBe(1);
		expect(validateV1(exampleJson("minimal.json"))).toBe(true);
	});

	it("the fuller example passes the parser and version 1's schema", () => {
		const result = parseBundle(example("full.json"), subjectIds);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.formatVersion).toBe(1);
		expect(validateV1(exampleJson("full.json"))).toBe(true);
	});

	it("the writing example passes the parser and version 2's schema", () => {
		const result = parseBundle(example("writing-v2.json"), subjectIds);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.formatVersion).toBe(2);
		expect(validateV2(exampleJson("writing-v2.json"))).toBe(true);
		// A version 1 schema refuses the file, which is why version 2 is a version.
		expect(validateV1(exampleJson("writing-v2.json"))).toBe(false);
	});

	it("the web-address example is refused by the parser, for the reason given", () => {
		// This one breaks a rule beyond the schema (no web address in a text), so it
		// passes the JSON Schema and is still refused: "remove the web address".
		expect(validateV1(exampleJson("invalid-web-address.json"))).toBe(true);
		expect(issuesOf("invalid-web-address.json")).toContain(
			"courses[0].units[0].lessons[0].facts[1]: remove the web address",
		);
	});

	it("the unknown-field example is refused by the parser and the schema", () => {
		expect(validateV1(exampleJson("invalid-unknown-field.json"))).toBe(false);
		expect(issuesOf("invalid-unknown-field.json")).toContain(
			'courses[0].units[0].summary: unknown field "summary"',
		);
	});

	it("the answer-words example is refused by the parser and version 1's schema", () => {
		expect(validateV1(exampleJson("invalid-answer-words-v1.json"))).toBe(false);
		expect(issuesOf("invalid-answer-words-v1.json")).toContain(
			'courses[0].exams[0].papers[0].parts[0].questions.answerWords: unknown field "answerWords"',
		);
	});
});

/**
 * The minimal example with one writing part, so a test can vary the file's version
 * and the answer's length. Everything else stays the same valid bundle.
 */
function writingBundle(formatVersion: unknown, answerWords?: unknown): string {
	const bundle = exampleJson("minimal.json") as Record<string, unknown>;
	bundle.formatVersion = formatVersion;
	const questions: Record<string, unknown> = {
		count: 1,
		types: { essay: 1 },
	};
	if (answerWords !== undefined) questions.answerWords = answerWords;
	const courses = bundle.courses as Record<string, unknown>[];
	const course = courses[0] as Record<string, unknown>;
	course.exams = [
		{
			name: "Writing paper",
			papers: [
				{
					name: "Paper 1: Writing",
					skill: "writing",
					parts: [{ name: "Part 1", material: { kind: "none" }, questions }],
				},
			],
		},
	];
	return JSON.stringify(bundle);
}

describe("how long the child's answer must be (version 2)", () => {
	it("a version 2 file reads [300, 400] as the answer's shortest and longest", () => {
		const result = parseBundle(writingBundle(2, [300, 400]), subjectIds);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.formatVersion).toBe(2);
			expect(
				result.bundle.courses[0]?.exams[0]?.papers[0]?.parts[0]?.questions
					.answerWords,
			).toEqual([300, 400]);
		}
	});

	it("a version 1 file refuses answerWords as an unknown field", () => {
		expect(issuesOfText(writingBundle(1, [300, 400]))).toContain(
			'questions.answerWords: unknown field "answerWords"',
		);
	});

	it("refuses a shortest longer than the longest", () => {
		expect(issuesOfText(writingBundle(2, [400, 300]))).toContain(
			"questions.answerWords: the first number must not be larger than the second",
		);
	});

	it.each([
		[[-1, 5], "questions.answerWords[0]: expected an integer from 0 to 5000"],
		[[0, 5001], "questions.answerWords[1]: expected an integer from 0 to 5000"],
		[
			[300],
			"questions.answerWords: expected two numbers: the shortest and the longest",
		],
		["300-400", "questions.answerWords: expected an array"],
	])("refuses %j", (answerWords, message) => {
		expect(issuesOfText(writingBundle(2, answerWords))).toContain(message);
	});

	it("refuses a format version it doesn't know", () => {
		expect(issuesOfText(writingBundle(3))).toContain(
			"formatVersion: expected 1 or 2",
		);
	});

	it("reads a course's exams without a bundle at the latest version", () => {
		const result = parseCourseExams([
			{
				name: "Writing paper",
				papers: [
					{
						name: "Paper 1: Writing",
						skill: "writing",
						parts: [
							{
								name: "Part 1",
								material: { kind: "none" },
								questions: {
									count: 1,
									types: { essay: 1 },
									answerWords: [300, 400],
								},
							},
						],
					},
				],
			},
		]);
		expect(LATEST_FORMAT_VERSION).toBe(2);
		expect(result.issues).toEqual([]);
		expect(result.exams[0]?.papers[0]?.parts[0]?.questions.answerWords).toEqual(
			[300, 400],
		);
	});
});

/**
 * Every key parseBundle reads must appear in the schema, and every key in the
 * schema must be one parseBundle reads. Walking the fuller example works for
 * both directions: the example uses every field version 1 has (that is what
 * makes it the fuller example), so the set of keys in it is the set the parser
 * reads. The schema side is collected from every "properties" object in the
 * schema — which includes the question-type keys under `types` and
 * `marksByType` — so a field added to the schema but not to the parser, or the
 * reverse, fails here.
 */
describe("the schema and the parser agree on the keys", () => {
	/** Every object key in a JSON value, as a set. */
	function jsonKeys(value: unknown, into = new Set<string>()): Set<string> {
		if (Array.isArray(value)) {
			for (const item of value) jsonKeys(item, into);
			return into;
		}
		if (typeof value !== "object" || value === null) return into;
		for (const [key, child] of Object.entries(value)) {
			into.add(key);
			jsonKeys(child, into);
		}
		return into;
	}

	/** Every property name declared anywhere under "properties" in the schema. */
	function schemaKeys(value: unknown, into = new Set<string>()): Set<string> {
		if (Array.isArray(value)) {
			for (const item of value) schemaKeys(item, into);
			return into;
		}
		if (typeof value !== "object" || value === null) return into;
		const object = value as Record<string, unknown>;
		const properties = object.properties;
		if (properties !== null && typeof properties === "object") {
			for (const key of Object.keys(properties as Record<string, unknown>))
				into.add(key);
		}
		for (const child of Object.values(object)) schemaKeys(child, into);
		return into;
	}

	it("reads the same keys", () => {
		const exampleKeys = jsonKeys(exampleJson("full.json"));
		const keysInSchema = schemaKeys(schemaV1);
		expect([...keysInSchema].filter((k) => !exampleKeys.has(k))).toEqual([]);
		expect([...exampleKeys].filter((k) => !keysInSchema.has(k))).toEqual([]);
	});

	it("version 2's schema is version 1's plus answerWords, and nothing else", () => {
		const keysV1 = schemaKeys(schemaV1);
		const keysV2 = schemaKeys(schemaV2);
		expect([...keysV2].filter((k) => !keysV1.has(k))).toEqual(["answerWords"]);
		expect([...keysV1].filter((k) => !keysV2.has(k))).toEqual([]);
	});
});
