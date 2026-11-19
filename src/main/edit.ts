// The hand edits of task 247, on disk: one edit applied to one course and written through
// writeModel, with the course as it was kept in memory so the last 20 edits of a session can
// be undone. Nothing is written for the undo itself: the course before the edit goes back
// through writeModel too.

import type { Failure } from "../shared/api.ts";
import { applyEdit, type Edit } from "../shared/edit.ts";
import { newId } from "../shared/ids.ts";
import { emptyCourse, type ModelCourse, sameCourse } from "../shared/model.ts";
import { unitLeaves } from "../shared/terms.ts";
import { readModel, writeModel } from "./model.ts";

/** How many edits a session can undo. */
export const UNDO_LIMIT = 20;

/** A course: grade, subject and teaching language. */
export type CourseRef = { grade: number; subject: string; language: string };

/** The courses before each edit, newest last, per project. */
const undo = new Map<
	string,
	{ ref: CourseRef; before: ModelCourse | null }[]
>();

/** What an edit or an undo gave: the course now, and how many edits can be undone. */
export type EditDone =
	| { ok: true; course: ModelCourse; undo: number }
	| { ok: false; issue: string }
	| Failure;

/** Writes the model with one course replaced (or added, or removed when `course` is null). */
function withCourse(
	root: string,
	ref: CourseRef,
	course: ModelCourse | null,
): Failure | { ok: true } {
	const model = readModel(root);
	if (!model.ok) return model;
	const others = model.model.courses.filter((entry) => !sameCourse(entry, ref));
	return writeModel(root, {
		...model.model,
		courses: course === null ? others : [...others, course],
	});
}

/** Makes one edit to one course, and keeps the course as it was for undo. */
export function editCourse(root: string, ref: CourseRef, edit: Edit): EditDone {
	const model = readModel(root);
	if (!model.ok) return model;
	const found = model.model.courses.find((entry) => sameCourse(entry, ref));
	// A course of the project with no unit yet starts empty: a teacher may add its first unit.
	const course = found ?? emptyCourse(ref.grade, ref.subject, ref.language);
	const periods = unitLeaves(model.model.curriculum.periods).map(
		(period) => period.id,
	);
	const edited = applyEdit(course, edit, periods, newId);
	if (!edited.ok) return edited;
	const written = withCourse(root, ref, edited.course);
	if (!written.ok) return written;
	const stack = undo.get(root) ?? [];
	stack.push({ ref, before: found ?? null });
	while (stack.length > UNDO_LIMIT) stack.shift();
	undo.set(root, stack);
	return { ok: true, course: edited.course, undo: stack.length };
}

/** Puts back the course as it was before the last edit of this session. */
export function undoEdit(root: string): EditDone {
	const stack = undo.get(root) ?? [];
	const last = stack.pop();
	if (last === undefined)
		return { ok: false, issue: "There is nothing to undo." };
	const written = withCourse(root, last.ref, last.before);
	if (!written.ok) {
		stack.push(last);
		return written;
	}
	undo.set(root, stack);
	return {
		ok: true,
		course:
			last.before ??
			emptyCourse(last.ref.grade, last.ref.subject, last.ref.language),
		undo: stack.length,
	};
}

/** How many edits of this project can be undone now. */
export function undoCount(root: string): number {
	return undo.get(root)?.length ?? 0;
}

/** Forgets a project's undo, as a test or a closed project does. */
export function forgetUndo(root: string): void {
	undo.delete(root);
}
