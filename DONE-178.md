# Done — task 178: a new course or an empty block, and a narrower Notes list

## What changed

### A target may be a new course or an empty block

- `allowedTarget(model, grade, subject, period, subjectIds)` replaces `knownTarget` in
  `src/main/changes.ts`. It refuses a grade outside `grades.ts`, a subject outside the app's
  list, and a period the year does not name (or, for a year with no periods, anything but
  `block-1`…`block-6`). It returns the target plus `isNew`, true when the model has no such
  course.
- `allowedExamTarget` is the exam step's sibling check: same grade and subject rules, and
  `isNew` when there is no course. `examContext` now uses it instead of requiring a course.
- `emptyCourse(grade, subject)` in `src/shared/model.ts` is the empty course every new
  target starts from: `examStyle: null`, no exams, no units. It round-trips through the
  model files (tested).
- The units request (`src/main/units.ts`) and the exams request (`src/main/exams.ts`) fall
  back to `emptyCourse`, so `courseJson` carries no units (or no exams) and the model writes
  them from the notes alone. The rules are unchanged.
- `parseChangeSet` accepts a unit number the period does not have yet **only when the period
  has no unit at all**; an existing period still refuses a set that invents a unit.
- `mergeCourse` now appends a proposed unit the course does not have (the same way it already
  appended a proposed lesson), filtered by the author's choice (all / one unit / one lesson).
- `acceptChange`, `acceptExamChange`, `saveChangeSet`, `saveExamChangeSet`, the job prep and
  the job collection all work from an empty course; accepting adds the course to the model
  and `writeModel` writes its own `grade-<g>-<subject>.json`.
- `readChangeSets` shows units and exams sets whose course does not exist yet.
- `studio:changesState` builds its targets from the register as well as the model: every
  grade, subject and block with noted files is offered even without a course or a unit in that
  block. The model's own periods stay listed with or without notes, as before. New courses
  and new blocks carry `newCourse` / `newBlock`, shown as chips ("new course", "new block").

### The Notes list can be narrowed

- `src/shared/notes-filter.ts` holds `NotesFilter`, `filterRows`, `notesFacets` and
  `notesFilterOf` (the clamped filter the IPC boundary accepts). `filterRows` only hides
  rows; it never sees the author's selection.
- `src/main/items.ts` builds the readable register rows once per change (each row marked
  `noted`), offers their grades, subjects and blocks as the selects' values, and filters
  before grouping and paging. `notesRows` takes an optional filter; `notesState` returns the
  facets and the unchanged missing count.
- `src/renderer/Notes.tsx` has the three selects (grade, subject, block — including "no
  block") and the "Only files without a note" box, on by default. The filter is React state
  for the session and is never written to the project. Hidden chosen files stay chosen; the
  count is unchanged and a line says it includes hidden files. A group checkbox ticks only
  the visible rows, because filtering happens before the groups are built.
- New words in `src/shared/i18n.ts`, English and Arabic (and the Notes heading became
  "Files", since the list can now include noted ones).

### Tests and README

- `src/shared/notes-filter.test.ts`: each select narrows, "no block", the only-missing
  switch, the selection untouched, the facets, and the clamping.
- `src/shared/changes.test.ts`: a set for a period with no units, and `mergeCourse` adding
  two units (and one unit / one lesson) to an empty course.
- `src/shared/model.test.ts`: `emptyCourse` round-trips through the model's writer and reader.
- `src/main/changes.test.ts`: `allowedTarget`'s four cases; a stored set for Grade 8 Arabic
  block 1 is reviewed, accepted, gives the model that course with its two units, writes its
  course file, and exports a bundle the shared parser accepts.
- `src/main/exams.test.ts`: a plan for a course the model has not got, and an exam set for
  Grade 8 French that is reviewed and accepted into a new course with those papers.
- `src/main/units.test.ts`: the plan for a new course instead of the old "null" case.
- `README.md`: the Changes and Exams sections say a new course and an empty block can be
  built, and the Notes section describes the filter.

## Deviations and why

- **The filter runs in the main process, not in `Notes.tsx`.** The list is paged over IPC
  and windowed (task 168), so the renderer never holds all rows. `filterRows` is still one
  small pure function in `src/shared/notes-filter.ts`, tested on its own; the panel only
  sends the filter and renders the page it gets. Filtering before grouping is also what
  makes the group checkbox tick only visible rows.
- **"Only files without a note" off needs the noted rows.** Before task 178 the main process
  built the list only from files without a note. It now builds every readable row, marks
  whether it has a note, and the default filter hides the noted ones, so today's view is
  unchanged. The filter state lives in `Notes.tsx`, which the tab keeps mounted for the
  session.
- **`allowedExamTarget` was added** although the spec named only `allowedTarget`: the exam
  step needs the same subject and grade checks once `examContext` stops requiring an
  existing course, and keeping that check beside its units twin avoids a second copy of the
  subject list.
- **Existing course periods with no notes stay listed.** The spec asks for register-driven
  targets; the union keeps the old behaviour too, so no period disappears from the Changes
  tab.
- **`blockPeriods`** in `src/main/changes.ts` turns a register block into the periods it
  names ("2&3" → `block-2`, `block-3`) so the register can offer a block target.

## Questions

- `resources/rules/unit-rules.md` says "Work only on units of the given period. Keep the
  units' numbers." For a course with no units (a new course, or an empty block) there are no
  numbers to keep, so the model has to number the units from the sheets. The spec said not to
  change the rules, so I left the file untouched; a sentence such as "If the course has no
  unit in this period, number the units from the sheets" would make the new case explicit.

## GUI checks for the architect or the owner (not run here)

- Notes: pick Grade 8, then a subject and block; the list narrows; tick "Only files without a
  note" off and the noted files appear; hide a chosen file with a filter and the "N chosen"
  count still includes it.
- Changes: Grade 8 with notes appears as a new course; run the units step for Block 1; the
  review shows the new course, and accepting adds it to the Curriculum tab and the export.
- Changes, exams: a course with exam-paper notes but no course (e.g. Grade 8 French) appears
  as a new course; accepting gives it the proposed papers.

## The four checks (last lines)

`npm test`

```
 Test Files  40 passed (40)
      Tests  419 passed (419)
```

`npm run check`

```
Checked 131 files in 201ms. No fixes applied.
```

`npm run typecheck`

```
> tsc --noEmit
```

(no output, exit code 0)

`npm run build`

```
out/renderer/assets/index-BxfHSgX9.js              833.31 kB
✓ built in 123ms
```
