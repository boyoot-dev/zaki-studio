// The published standard (task 162): the examples must behave the way
// examples/README.md says they do. The parser is the app's own, so the standard's
// examples can never drift from what a real app accepts. ajv is used here and only
// here, to check the examples against the JSON Schema the standard ships.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { subjectsJson } from "../../scripts/subjects.ts";
import { parseBundle } from "./format/bundle.ts";

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

const issuesOf = (name: string): string => {
	const result = parseBundle(example(name), subjectIds);
	if (result.ok) throw new Error(`${name} was expected to be refused`);
	return result.issues
		.map((issue) => `${issue.path}: ${issue.message}`)
		.join("\n");
};

describe("the standard's examples", () => {
	it("the minimal example passes the parser and the schema", () => {
		const result = parseBundle(example("minimal.json"), subjectIds);
		expect(result.ok).toBe(true);
		expect(validate(exampleJson("minimal.json"))).toBe(true);
	});

	it("the fuller example passes the parser and the schema", () => {
		const result = parseBundle(example("full.json"), subjectIds);
		expect(result.ok).toBe(true);
		expect(validate(exampleJson("full.json"))).toBe(true);
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
});

/**
 * Every key parseBundle reads must appear in the schema, and every key in the
 * schema must be one parseBundle reads. Walking the fuller example works for
 * both directions: the example uses every field the format has (that is what
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
		const keysInSchema = schemaKeys(schema);
		expect([...keysInSchema].filter((k) => !exampleKeys.has(k))).toEqual([]);
		expect([...exampleKeys].filter((k) => !keysInSchema.has(k))).toEqual([]);
	});
});
