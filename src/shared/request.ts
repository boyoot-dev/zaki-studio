// Asking the AI for one change (task 248): a teacher writes "add the point about X" or "make
// the facts simpler" under a unit or lesson and gets back a small proposal for that unit only.
// Pure here: the request as the page sends it, the rule added to the unit rules, the course cut
// down to the one unit, the files the unit's facts name, and the check that an answer stays
// inside the unit.

import type { ModelCourse, ModelUnit } from "./model.ts";
import { parseSource } from "./model.ts";

/** A teacher's request is at most this long. */
export const REQUEST_MAX = 500;

/** One request: the course period, the unit (and lesson), and the teacher's words. */
export type UnitRequest = {
	grade: number;
	subject: string;
	language: string;
	period: string;
	unit: number;
	/** The lesson the request is about, or 0 for the whole unit. */
	lesson: number;
	text: string;
};

/** The request a page sent, clamped, or null when it is not one. */
export function cleanRequest(value: unknown): UnitRequest | null {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return null;
	const raw = value as Record<string, unknown>;
	const whole = (v: unknown, min: number, max: number) =>
		typeof v === "number" && Number.isInteger(v) && v >= min && v <= max
			? v
			: null;
	const grade = whole(raw.grade, -1, 12);
	const unit = whole(raw.unit, 0, 999);
	const lesson = whole(raw.lesson, 0, 999) ?? 0;
	const text =
		typeof raw.text === "string" ? raw.text.trim().slice(0, REQUEST_MAX) : "";
	const words = (v: unknown, max: number) =>
		typeof v === "string" ? v.slice(0, max) : "";
	if (grade === null || unit === null || text === "") return null;
	return {
		grade,
		subject: words(raw.subject, 60),
		language: words(raw.language, 3),
		period: words(raw.period, 40),
		unit,
		lesson,
		text,
	};
}

/** The rule added to the unit rules for one request. */
export function requestRule(request: UnitRequest): string {
	const where =
		request.lesson > 0
			? `lesson ${request.lesson} of unit ${request.unit}`
			: `unit ${request.unit}`;
	return `## The teacher's request

The teacher asks for one change to ${where}:

"${request.text}"

- Change only what the request asks. Keep everything else in the unit exactly as it is now.
- Write one change set with this one unit (number ${request.unit}) and nothing else.
- Never change or remove a fact marked "own": true.
- If the request can't be met from the material, change nothing and say so in an open
  question ("decide": true).`;
}

/** The course with only the requested unit, so a job or request carries nothing else. */
export function requestCourse(course: ModelCourse, unit: number): ModelCourse {
	return {
		...course,
		units: course.units.filter((entry) => entry.number === unit),
	};
}

/** The file ids a unit's facts name, in their first order. */
export function unitSourceIds(unit: ModelUnit): string[] {
	const ids: string[] = [];
	for (const lesson of unit.lessons)
		for (const fact of lesson.facts)
			for (const source of fact.sources) {
				const id = parseSource(source)?.id;
				if (id !== undefined && !ids.includes(id)) ids.push(id);
			}
	return ids;
}

/**
 * Why an answer to a request is refused, or null: it must hold the requested unit and no
 * other, so a proposal never reaches outside what the teacher asked about.
 */
export function requestScope(value: unknown, unit: number): string | null {
	if (typeof value !== "object" || value === null)
		return "The answer has no change set.";
	const units = (value as Record<string, unknown>).units;
	if (!Array.isArray(units) || units.length === 0)
		return "The answer has no unit.";
	const numbers = units.map((entry) =>
		typeof entry === "object" && entry !== null
			? (entry as Record<string, unknown>).number
			: null,
	);
	if (numbers.some((number) => number !== unit))
		return `The answer changes more than unit ${unit}.`;
	return null;
}
