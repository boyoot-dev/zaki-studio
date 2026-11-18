// The published standard (task 162): the examples must behave the way
// examples/README.md says they do. The parser is the app's own, so the standard's
// examples can never drift from what a real app accepts. ajv is used here and only
// here, to check the examples against the JSON Schema the standard ships.
//
// Task 224 made the format version 1 again: one version, with each course's teaching
// and help languages, a permanent id on every object, and duplicate keys refused.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { subjectsJson } from "../../scripts/subjects.ts";
import {
	duplicateKey,
	LANGUAGE_CODES,
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

/** The schema, compiled once for all the checks. */
const schema = JSON.parse(
	readFileSync(`${STANDARD}/schema/bundle-v1.schema.json`, "utf8"),
) as object;
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

const issuesOfText = (text: string): string => {
	const result = parseBundle(text, subjectIds);
	if (result.ok) throw new Error("the bundle was expected to be refused");
	return result.issues
		.map((issue) => `${issue.path}: ${issue.message}`)
		.join("\n");
};
const issuesOf = (name: string): string => issuesOfText(example(name));

describe("the standard's examples", () => {
	it.each([
		"minimal.json",
		"full.json",
		"writing.json",
	])("%s passes the parser and the schema", (name) => {
		expect(parseBundle(example(name), subjectIds).ok).toBe(true);
		expect(validate(exampleJson(name))).toBe(true);
	});

	it("the web-address example is refused by the parser, for the reason given", () => {
		// This one breaks a rule beyond the schema (no web address in a text), so it
		// passes the JSON Schema and is still refused: "remove the web address".
		expect(validate(exampleJson("invalid-web-address.json"))).toBe(true);
		expect(issuesOf("invalid-web-address.json")).toContain(
			"courses[0].units[0].lessons[0].facts[1]: remove the web address",
		);
	});

	it("the unknown-field example is refused by the parser and the schema", () => {
		expect(validate(exampleJson("invalid-unknown-field.json"))).toBe(false);
		expect(issuesOf("invalid-unknown-field.json")).toContain(
			'courses[0].units[0].summary: unknown field "summary"',
		);
	});

	it("the language and id examples are refused by the parser and the schema", () => {
		expect(validate(exampleJson("invalid-language-code.json"))).toBe(false);
		expect(validate(exampleJson("invalid-missing-id.json"))).toBe(false);
	});

	it("the support and duplicate-key examples pass the schema and are refused by the rules", () => {
		expect(validate(exampleJson("invalid-support-repeats-language.json"))).toBe(
			true,
		);
		expect(validate(exampleJson("invalid-duplicate-key.json"))).toBe(true);
	});
});

/** The minimal example as an object, to vary one thing in it. */
function minimal(): Record<string, unknown> {
	return exampleJson("minimal.json") as Record<string, unknown>;
}
function courseOf(bundle: Record<string, unknown>): Record<string, unknown> {
	return (bundle.courses as Record<string, unknown>[])[0] as Record<
		string,
		unknown
	>;
}

/**
 * The minimal example with one writing part, so a test can vary the answer's length.
 * Everything else stays the same valid bundle.
 */
function writingBundle(answerWords?: unknown): string {
	const bundle = minimal();
	const questions: Record<string, unknown> = { count: 1, types: { essay: 1 } };
	if (answerWords !== undefined) questions.answerWords = answerWords;
	courseOf(bundle).exams = [
		{
			id: "e1",
			name: "Writing paper",
			papers: [
				{
					id: "e1-p1",
					name: "Paper 1: Writing",
					skill: "writing",
					parts: [
						{
							id: "e1-p1-t1",
							name: "Part 1",
							material: { kind: "none" },
							questions,
						},
					],
				},
			],
		},
	];
	return JSON.stringify(bundle);
}

describe("how long the child's answer must be", () => {
	it("reads [300, 400] as the answer's shortest and longest", () => {
		const result = parseBundle(writingBundle([300, 400]), subjectIds);
		expect(result.ok).toBe(true);
		if (result.ok)
			expect(
				result.bundle.courses[0]?.exams[0]?.papers[0]?.parts[0]?.questions
					.answerWords,
			).toEqual([300, 400]);
	});

	it("refuses a shortest longer than the longest", () => {
		expect(issuesOfText(writingBundle([400, 300]))).toContain(
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
		expect(issuesOfText(writingBundle(answerWords))).toContain(message);
	});

	it("reads a course's exams on their own", () => {
		const result = parseCourseExams(
			(
				JSON.parse(writingBundle([300, 400])) as {
					courses: { exams: unknown }[];
				}
			).courses[0]?.exams,
		);
		expect(result.issues).toEqual([]);
		expect(result.exams[0]?.papers[0]?.parts[0]?.id).toBe("e1-p1-t1");
	});
});

describe("format versions (task 224)", () => {
	it.each([2, 3, 0])("refuses formatVersion %j with one plain message", (v) => {
		const bundle = minimal();
		bundle.formatVersion = v;
		const result = parseBundle(JSON.stringify(bundle), subjectIds);
		expect(result.ok).toBe(false);
		if (!result.ok)
			expect(result.issues).toEqual([
				{
					path: "formatVersion",
					message:
						"This file was made by an older Studio. Open its project in the new Studio and export it again.",
				},
			]);
	});
});

describe("a course's languages (task 224)", () => {
	it("has the 183 ISO 639-1 codes, each two lowercase letters", () => {
		expect(LANGUAGE_CODES).toHaveLength(183);
		expect(LANGUAGE_CODES.every((code) => /^[a-z]{2}$/.test(code))).toBe(true);
		expect(new Set(LANGUAGE_CODES).size).toBe(183);
	});

	it("requires a teaching language", () => {
		const bundle = minimal();
		delete courseOf(bundle).language;
		expect(issuesOfText(JSON.stringify(bundle))).toContain(
			"courses[0].language: expected a two-letter language code",
		);
	});

	it.each(["fre", "EN", "xx", ""])("refuses the language %j", (code) => {
		const bundle = minimal();
		courseOf(bundle).language = code;
		expect(issuesOfText(JSON.stringify(bundle))).toContain(
			"courses[0].language: expected a two-letter language code",
		);
	});

	it("accepts a language Mr. Zaki can't teach yet: that is the app's business", () => {
		const bundle = minimal();
		courseOf(bundle).language = "de";
		expect(parseBundle(JSON.stringify(bundle), subjectIds).ok).toBe(true);
	});

	it("reads support languages, the child's own among them", () => {
		const bundle = minimal();
		courseOf(bundle).support = ["native", "ar"];
		const result = parseBundle(JSON.stringify(bundle), subjectIds);
		expect(result.ok).toBe(true);
		if (result.ok)
			expect(result.bundle.courses[0]?.support).toEqual(["native", "ar"]);
	});

	it.each([
		[["native", "native"], 'courses[0].support[1]: "native" is listed twice'],
		[
			["en"],
			"courses[0].support[0]: the course's own language is not a support language",
		],
		[[], "courses[0].support: expected 1 to 3 languages"],
		[["ar", "fr", "de", "tr"], "courses[0].support: expected 1 to 3 languages"],
		[["fre"], "courses[0].support[0]: expected a two-letter language code"],
	])("refuses support %j", (support, message) => {
		const bundle = minimal();
		courseOf(bundle).support = support;
		expect(issuesOfText(JSON.stringify(bundle))).toContain(message);
	});

	it("takes one subject twice in a grade only in two languages", () => {
		const bundle = minimal();
		const course = courseOf(bundle);
		const twin = structuredClone(course);
		bundle.courses = [course, twin];
		expect(issuesOfText(JSON.stringify(bundle))).toContain(
			'courses[1]: grade 8 science in "en" appears twice',
		);
		twin.language = "ar";
		expect(parseBundle(JSON.stringify(bundle), subjectIds).ok).toBe(true);
	});
});

describe("ids (task 224)", () => {
	it("refuses a skill written as a plain string", () => {
		const bundle = minimal();
		const unit = (courseOf(bundle).units as Record<string, unknown>[])[0];
		const lesson = (unit?.lessons as Record<string, unknown>[])[0];
		if (lesson !== undefined) lesson.skills = ["Describe the Moon"];
		expect(issuesOfText(JSON.stringify(bundle))).toContain(
			"courses[0].units[0].lessons[0].skills[0]: expected {id, text} or {id, code, text}",
		);
	});

	it("refuses an id used twice by its kind in one course, and a bad id", () => {
		const bundle = minimal();
		const units = courseOf(bundle).units as Record<string, unknown>[];
		const second = structuredClone(units[0]) as Record<string, unknown>;
		second.number = 2;
		units.push(second);
		expect(issuesOfText(JSON.stringify(bundle))).toContain(
			'courses[0].units[1].id: unit id "u1" is used twice in this course',
		);
		second.id = "Unit 2";
		expect(issuesOfText(JSON.stringify(bundle))).toContain(
			"courses[0].units[1].id: use lowercase letters, digits and -",
		);
	});

	it("allows the same id in two courses", () => {
		const bundle = minimal();
		const course = courseOf(bundle);
		const twin = structuredClone(course);
		twin.grade = 9;
		bundle.courses = [course, twin];
		expect(parseBundle(JSON.stringify(bundle), subjectIds).ok).toBe(true);
	});
});

describe("duplicate keys (task 224)", () => {
	it("finds a key written twice, with its path", () => {
		expect(duplicateKey('{"a": 1, "b": {"c": [1, {"d": 2, "d": 3}]}}')).toEqual(
			{ path: "b.c[1].d", key: "d" },
		);
		expect(duplicateKey('{"a": 1, "a": 2}')).toEqual({ path: "a", key: "a" });
	});

	it("is not fooled by keys inside strings, or by escapes", () => {
		expect(duplicateKey('{"a": "\\"a\\": 1", "b": "a"}')).toBeNull();
		expect(duplicateKey('{"a\\u0062": 1, "ab": 2}')).toEqual({
			path: "ab",
			key: "ab",
		});
		expect(duplicateKey('[{"a": 1}, {"a": 1}]')).toBeNull();
	});

	it("refuses the file", () => {
		expect(issuesOf("invalid-duplicate-key.json")).toContain(
			'courses[0].units[0].title: key "title" appears twice',
		);
	});
});

describe("ordered word ranges (task 224)", () => {
	it("refuses material whose shortest is longer than its longest", () => {
		const bundle = JSON.parse(writingBundle()) as Record<string, unknown>;
		const exams = courseOf(bundle).exams as {
			papers: { parts: { material: Record<string, unknown> }[] }[];
		}[];
		const part = exams[0]?.papers[0]?.parts[0];
		if (part !== undefined)
			part.material = { kind: "article", words: [500, 200] };
		expect(issuesOfText(JSON.stringify(bundle))).toContain(
			"material.words: the first number must not be larger than the second",
		);
	});
});

/**
 * Every key parseBundle reads must appear in the schema, and every key in the
 * schema must be one parseBundle reads. Walking the fuller example works for
 * both directions: the example uses every field the format has (that is what
 * makes it the fuller example), so the set of keys in it is the set the parser
 * reads. The schema side is collected from every "properties" object in the
 * schema, which includes the question-type keys under `types` and
 * `marksByType`, so a field added to the schema but not to the parser, or the
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
		const keysInSchema = schemaKeys(schema);
		expect([...keysInSchema].filter((k) => !exampleKeys.has(k))).toEqual([]);
		expect([...exampleKeys].filter((k) => !keysInSchema.has(k))).toEqual([]);
	});
});
