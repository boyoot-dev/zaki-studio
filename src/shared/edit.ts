// Editing a course by hand (task 247): a teacher fixes a fact, adds a missing one, renames or
// moves a lesson, all in the Curriculum tab. Every edit is one value the page sends, applied
// here to a copy of the course and checked against the bundle's own limits; the main process
// writes the result through writeModel. A fact the teacher edits or adds becomes theirs
// (`own: true`, status `reviewed`), and the unit rules and acceptChange never change an own
// fact, so the AI never undoes it. Numbers are renumbered after every add, delete and move.

import { BUNDLE_LIMITS, checkText } from "./format/bundle.ts";
import type {
	ModelCourse,
	ModelFact,
	ModelLesson,
	ModelUnit,
} from "./model.ts";

/** One edit, by unit and lesson number and a fact's or skill's place (from 0). */
export type Edit =
	| {
			kind: "fact.text";
			unit: number;
			lesson: number;
			fact: number;
			text: string;
	  }
	| {
			kind: "fact.add";
			unit: number;
			lesson: number;
			after: number;
			text: string;
	  }
	| { kind: "fact.delete"; unit: number; lesson: number; fact: number }
	| {
			kind: "fact.move";
			unit: number;
			lesson: number;
			fact: number;
			by: -1 | 1;
	  }
	| {
			kind: "skill.text";
			unit: number;
			lesson: number;
			skill: number;
			text: string;
	  }
	| { kind: "skill.add"; unit: number; lesson: number; text: string }
	| { kind: "skill.delete"; unit: number; lesson: number; skill: number }
	| { kind: "lesson.title"; unit: number; lesson: number; title: string }
	| { kind: "lesson.add"; unit: number; after: number; title: string }
	| { kind: "lesson.delete"; unit: number; lesson: number }
	| { kind: "lesson.move"; unit: number; lesson: number; by: -1 | 1 }
	| { kind: "lesson.toUnit"; unit: number; lesson: number; to: number }
	| { kind: "unit.title"; unit: number; title: string }
	| { kind: "unit.add"; period: string; title: string }
	| { kind: "unit.delete"; unit: number }
	| { kind: "unit.move"; unit: number; by: -1 | 1 }
	| { kind: "unit.period"; unit: number; period: string }
	| { kind: "unit.keywords"; unit: number; text: string }
	| { kind: "unit.evidence"; unit: number; text: string }
	| {
			kind: "lesson.activity";
			unit: number;
			lesson: number;
			activity: "reading" | "writing" | null;
	  };

/** What an edit gave: the new course, or why it can't be made. */
export type Edited =
	| { ok: true; course: ModelCourse }
	| { ok: false; issue: string };

const KINDS = new Set<Edit["kind"]>([
	"fact.text",
	"fact.add",
	"fact.delete",
	"fact.move",
	"skill.text",
	"skill.add",
	"skill.delete",
	"lesson.title",
	"lesson.add",
	"lesson.delete",
	"lesson.move",
	"lesson.toUnit",
	"unit.title",
	"unit.add",
	"unit.delete",
	"unit.move",
	"unit.period",
	"unit.keywords",
	"unit.evidence",
	"lesson.activity",
]);

/** A whole number in a range, or null. */
function int(value: unknown, min: number, max: number): number | null {
	return typeof value === "number" &&
		Number.isInteger(value) &&
		value >= min &&
		value <= max
		? value
		: null;
}

/** A text of at most `max` characters, or "" (which no edit accepts). */
function line(value: unknown, max: number): string {
	return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * The edit a page sent, clamped: every number in range, every text cut to its limit, and
 * anything that is not an edit refused. The IPC handler calls this before anything else.
 */
export function cleanEdit(value: unknown): Edit | null {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return null;
	const raw = value as Record<string, unknown>;
	if (typeof raw.kind !== "string" || !KINDS.has(raw.kind as Edit["kind"]))
		return null;
	const unit = int(raw.unit, 0, 999) ?? 0;
	const lesson = int(raw.lesson, 0, 999) ?? 0;
	const fact = int(raw.fact, 0, 999) ?? 0;
	const skill = int(raw.skill, 0, 999) ?? 0;
	const after = int(raw.after, -1, 999) ?? -1;
	const to = int(raw.to, 0, 999) ?? 0;
	const by: -1 | 1 = raw.by === -1 ? -1 : 1;
	// An add takes several lines (task 251), so its text may be as long as a full lesson.
	const text = line(
		raw.text,
		(BUNDLE_LIMITS.factChars + 1) *
			Math.max(BUNDLE_LIMITS.facts, BUNDLE_LIMITS.listItems),
	);
	const activity =
		raw.activity === "reading" || raw.activity === "writing"
			? raw.activity
			: null;
	const title = line(raw.title, BUNDLE_LIMITS.title + 1);
	const period = line(raw.period, 40);
	return {
		kind: raw.kind,
		unit,
		lesson,
		fact,
		skill,
		after,
		to,
		by,
		text,
		title,
		period,
		activity,
	} as Edit;
}

/** The non-empty lines of a text, trimmed: one fact, skill or list item each. */
function linesOf(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((entry) => entry.trim())
		.filter((entry) => entry !== "");
}

/** A deep copy, so an edit never changes the course it was given. */
function copy(course: ModelCourse): ModelCourse {
	return structuredClone(course);
}

/** Lessons numbered 1, 2, 3 … in their order. */
function renumberLessons(unit: ModelUnit): void {
	for (const [index, lesson] of unit.lessons.entries())
		lesson.number = index + 1;
}

/** Units in their order, numbered 1, 2, 3 …. */
function renumberUnits(course: ModelCourse): void {
	for (const [index, unit] of course.units.entries()) unit.number = index + 1;
}

/** A text the bundle accepts, or the bundle's own reason. */
function checked(
	value: string,
	max: number,
): { ok: true; text: string } | { ok: false; issue: string } {
	const result = checkText(value, max);
	return result.ok
		? { ok: true, text: result.text }
		: { ok: false, issue: result.message };
}

/** The fact a teacher wrote: theirs, and reviewed. Sources are kept when it had some. */
function ownFact(text: string, before?: ModelFact): ModelFact {
	return {
		text,
		sources: before === undefined ? [] : [...before.sources],
		status: "reviewed",
		own: true,
	};
}

/** Moves one item of a list up or down; false when it can't move that way. */
function shift<T>(list: T[], index: number, by: -1 | 1): boolean {
	const to = index + by;
	if (index < 0 || index >= list.length || to < 0 || to >= list.length)
		return false;
	const [item] = list.splice(index, 1);
	if (item === undefined) return false;
	list.splice(to, 0, item);
	return true;
}

/**
 * The course with one edit made, or why not. `periods` are the unit periods a unit may sit in;
 * `newId` makes a permanent id for a new unit or lesson.
 */
export function applyEdit(
	given: ModelCourse,
	edit: Edit,
	periods: readonly string[],
	newId: () => string,
): Edited {
	const course = copy(given);
	const unitAt = (number: number) =>
		course.units.findIndex((unit) => unit.number === number);
	const findUnit = (number: number): ModelUnit | null =>
		course.units[unitAt(number)] ?? null;
	const findLesson = (
		unit: ModelUnit | null,
		number: number,
	): ModelLesson | null =>
		unit?.lessons.find((lesson) => lesson.number === number) ?? null;
	const fail = (issue: string): Edited => ({ ok: false, issue });
	const done = (): Edited => ({ ok: true, course });

	if (edit.kind.startsWith("fact.") || edit.kind.startsWith("skill.")) {
		const e = edit as Extract<Edit, { lesson: number; unit: number }>;
		const lesson = findLesson(findUnit(e.unit), e.lesson);
		if (lesson === null) return fail("That lesson is not there any more.");
		switch (edit.kind) {
			case "fact.text": {
				const before = lesson.facts[edit.fact];
				if (before === undefined)
					return fail("That fact is not there any more.");
				const text = checked(edit.text, BUNDLE_LIMITS.factChars);
				if (!text.ok) return fail(text.issue);
				lesson.facts[edit.fact] = ownFact(text.text, before);
				return done();
			}
			case "fact.add": {
				// Each non-empty line is one fact, in order (task 251).
				const lines = linesOf(edit.text);
				if (lines.length === 0) return fail("Write the fact first.");
				if (lesson.facts.length + lines.length > BUNDLE_LIMITS.facts)
					return fail(`A lesson has at most ${BUNDLE_LIMITS.facts} facts.`);
				const facts: ModelFact[] = [];
				for (const entry of lines) {
					const text = checked(entry, BUNDLE_LIMITS.factChars);
					if (!text.ok) return fail(text.issue);
					facts.push(ownFact(text.text));
				}
				const at = Math.min(Math.max(edit.after + 1, 0), lesson.facts.length);
				lesson.facts.splice(at, 0, ...facts);
				return done();
			}
			case "fact.delete":
				if (lesson.facts[edit.fact] === undefined)
					return fail("That fact is not there any more.");
				lesson.facts.splice(edit.fact, 1);
				return done();
			case "fact.move":
				return shift(lesson.facts, edit.fact, edit.by)
					? done()
					: fail("That fact can't move that way.");
			case "skill.text": {
				const before = lesson.skills[edit.skill];
				if (before === undefined)
					return fail("That skill is not there any more.");
				const text = checked(edit.text, BUNDLE_LIMITS.skillChars);
				if (!text.ok) return fail(text.issue);
				lesson.skills[edit.skill] = { ...before, text: text.text };
				return done();
			}
			case "skill.add": {
				const lines = linesOf(edit.text);
				if (lines.length === 0) return fail("Write the skill first.");
				if (lesson.skills.length + lines.length > BUNDLE_LIMITS.skills)
					return fail(`A lesson has at most ${BUNDLE_LIMITS.skills} skills.`);
				for (const entry of lines) {
					const text = checked(entry, BUNDLE_LIMITS.skillChars);
					if (!text.ok) return fail(text.issue);
					lesson.skills.push({ id: newId(), code: null, text: text.text });
				}
				return done();
			}
			case "skill.delete":
				if (lesson.skills[edit.skill] === undefined)
					return fail("That skill is not there any more.");
				lesson.skills.splice(edit.skill, 1);
				return done();
		}
	}

	switch (edit.kind) {
		case "lesson.title": {
			const lesson = findLesson(findUnit(edit.unit), edit.lesson);
			if (lesson === null) return fail("That lesson is not there any more.");
			const title = checked(edit.title, BUNDLE_LIMITS.title);
			if (!title.ok) return fail(title.issue);
			lesson.title = title.text;
			return done();
		}
		case "lesson.add": {
			const unit = findUnit(edit.unit);
			if (unit === null) return fail("That unit is not there any more.");
			if (unit.lessons.length >= BUNDLE_LIMITS.lessons)
				return fail(`A unit has at most ${BUNDLE_LIMITS.lessons} lessons.`);
			const title = checked(edit.title, BUNDLE_LIMITS.title);
			if (!title.ok) return fail(title.issue);
			const at = Math.min(Math.max(edit.after, 0), unit.lessons.length);
			unit.lessons.splice(at, 0, {
				id: newId(),
				number: 0,
				title: title.text,
				skills: [],
				facts: [],
				activity: null,
			});
			renumberLessons(unit);
			return done();
		}
		case "lesson.delete": {
			const unit = findUnit(edit.unit);
			const index =
				unit?.lessons.findIndex((lesson) => lesson.number === edit.lesson) ??
				-1;
			if (unit === null || index < 0)
				return fail("That lesson is not there any more.");
			unit.lessons.splice(index, 1);
			renumberLessons(unit);
			return done();
		}
		case "lesson.move": {
			const unit = findUnit(edit.unit);
			const index =
				unit?.lessons.findIndex((lesson) => lesson.number === edit.lesson) ??
				-1;
			if (unit === null || !shift(unit.lessons, index, edit.by))
				return fail("That lesson can't move that way.");
			renumberLessons(unit);
			return done();
		}
		case "lesson.toUnit": {
			const from = findUnit(edit.unit);
			const to = findUnit(edit.to);
			const index =
				from?.lessons.findIndex((lesson) => lesson.number === edit.lesson) ??
				-1;
			if (from === null || to === null || index < 0 || from === to)
				return fail("That lesson can't move there.");
			if (to.lessons.length >= BUNDLE_LIMITS.lessons)
				return fail(`A unit has at most ${BUNDLE_LIMITS.lessons} lessons.`);
			const [lesson] = from.lessons.splice(index, 1);
			if (lesson === undefined) return fail("That lesson can't move there.");
			to.lessons.push(lesson);
			renumberLessons(from);
			renumberLessons(to);
			return done();
		}
		case "unit.title": {
			const unit = findUnit(edit.unit);
			if (unit === null) return fail("That unit is not there any more.");
			const title = checked(edit.title, BUNDLE_LIMITS.title);
			if (!title.ok) return fail(title.issue);
			unit.title = title.text;
			return done();
		}
		case "unit.add": {
			if (course.units.length >= BUNDLE_LIMITS.units)
				return fail(`A course has at most ${BUNDLE_LIMITS.units} units.`);
			if (!periods.includes(edit.period))
				return fail("Choose a period for the unit.");
			const title = checked(edit.title, BUNDLE_LIMITS.title);
			if (!title.ok) return fail(title.issue);
			// After the last unit of its period, so the units stay in the year's order.
			let at = course.units.length;
			for (const [index, unit] of course.units.entries())
				if (unit.period === edit.period) at = index + 1;
			course.units.splice(at, 0, {
				id: newId(),
				number: 0,
				period: edit.period,
				title: title.text,
				source: "provisional",
				keywords: [],
				evidence: [],
				lessons: [],
			});
			renumberUnits(course);
			return done();
		}
		case "unit.delete": {
			const index = unitAt(edit.unit);
			if (index < 0) return fail("That unit is not there any more.");
			course.units.splice(index, 1);
			renumberUnits(course);
			return done();
		}
		case "unit.move":
			if (!shift(course.units, unitAt(edit.unit), edit.by))
				return fail("That unit can't move that way.");
			renumberUnits(course);
			return done();
		case "unit.keywords":
		case "unit.evidence": {
			const unit = findUnit(edit.unit);
			if (unit === null) return fail("That unit is not there any more.");
			const lines = linesOf(edit.text);
			if (lines.length > BUNDLE_LIMITS.listItems)
				return fail(`At most ${BUNDLE_LIMITS.listItems} lines.`);
			const list: string[] = [];
			for (const entry of lines) {
				const text = checked(entry, BUNDLE_LIMITS.listChars);
				if (!text.ok) return fail(text.issue);
				list.push(text.text);
			}
			if (edit.kind === "unit.keywords") unit.keywords = list;
			else unit.evidence = list;
			return done();
		}
		case "lesson.activity": {
			const lesson = findLesson(findUnit(edit.unit), edit.lesson);
			if (lesson === null) return fail("That lesson is not there any more.");
			lesson.activity = edit.activity;
			return done();
		}
		case "unit.period": {
			const unit = findUnit(edit.unit);
			if (unit === null) return fail("That unit is not there any more.");
			if (!periods.includes(edit.period))
				return fail("Choose a period for the unit.");
			unit.period = edit.period;
			return done();
		}
	}
	return fail("That edit is not one the Studio knows.");
}
