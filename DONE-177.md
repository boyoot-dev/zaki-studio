# Task 177: The Studio turns exam notes into exam papers to review

## What changed

- **`src/shared/exam-changes.ts`** (new): the exam change set is parsed with the bundle's own
  `parseCourseExams` at format 2, so `answerWords` is allowed and a backwards pair is refused
  with its path. A `sources` map names, for every part id, the register file ids it was read
  from; a missing source, a file of another course, or a worksheet is refused. The review pairs
  today's exams, papers and parts with the proposal, matching exams by period and name, papers
  by name, parts by id and then by position, and names every changed field (`minutes 70 → 75`,
  `answerWords — → 300–400`). `mergeExams` replaces only an accepted paper and leaves all other
  papers, exams and the rest of the course untouched.
- **`resources/rules/exam-rules.md`** (new): the model's rules, pinned by an exact test. They
  cover the format of papers, the newest year winning, `answerWords` from printed Arabic or
  English lengths, keeping existing part ids, and never copying a passage or question.
- **`src/main/exams.ts`** (new): one request per course. The notes come from register files of
  kind `exam` or `mark-scheme`, newest academic year first and then by authority and kind, and
  only the newest three years are included; older years are named in the request as left out.
  The cost is shown first and the same limit code as units stops a request that would pass it.
  It also prepares and collects exam job folders.
- **`src/main/examfolder.ts`** (new): `README.md`, `rules.md`, `courses/<grade>-<subject>/`
  (`course.json` with the current exams, `notes/` in priority order) and an empty `out/`.
- **`src/main/changes.ts`**: exam sets wait in `.studio/changes/<grade>-<subject>-exams.json`
  with a `kind` field (`units` for old and new unit sets, `exams` for exams). Saving, reading,
  accepting one paper, rejecting and deleting all go through the same safe-path and review code.
- **`src/shared/job.ts`**: `JobKind` gains `exams`; `examsPrompt` and `examsReadme` are pinned
  by tests, with the same data-rule sentence as the other jobs. `JobRecord` now carries the
  exam courses, and `job.json` still says which kind a folder is.
- **`src/main/ipc.ts`, `src/shared/api.ts`, `src/preload/index.ts`**: the plan, write, prepare,
  collect, delete, accept, reject and delete-set channels for exams, all taking only a grade
  and a subject (plus indices for one paper). `changesState` returns exam targets and exam jobs.
- **`src/renderer/Changes.tsx`, `src/shared/i18n.ts`**: an "Exams" section beside the period
  targets, with the key way, the job-folder way, and exam sets in "Changes to review" shown
  paper by paper and part by part with changed fields highlighted and the open questions
  listed. The choices are all, one paper, or reject.
- **`README.md`**: the exams step, its inputs, three-year cap, rules, both ways, review and the
  new files are documented.

Tests added: `src/shared/exam-changes.test.ts` and `src/main/exams.test.ts`, plus the exams
prompt/README pins in `src/shared/job.test.ts`. They cover every acceptance criterion, including
the 2023–2026 ordering with 2026 first and 2023 left out.

## Deviations and why

- An exam set is one file per course, not per course and period, because `exams` belong to the
  course. It is named `<grade>-<subject>-exams.json` and the review's key is `<grade>-<subject>`.
  The stored shape gained a `kind` field; a file without one is read as units, so old sets keep
  working.
- The bundle reader refuses an explicit `null` where an optional field is absent, so the exam
  format tells the model to leave those fields out and `EXAM_FORMAT_NOTE` says so. This keeps
  the model's answer parseable instead of failing on `"language": null`.
- Papers are matched by name and parts by id, then by position, and the merge is paper by
  paper. This follows the task's wording ("an accepted paper replaces the paper of the same
  name; papers the author didn't touch stay") and means an exam set never deletes a paper.
- The exam plan reuses the units model and limit settings, as the task asks ("Default model as
  for units"), rather than adding a second settings file.
- `reviewExams` accepts either the course's exams array or the course itself, so callers that
  already hold a `ModelCourse` need no unpacking. The renderer and tests use the array.
- No GUI was opened, no screenshot or screen capture was taken, and neither the packaged app
  nor a browser was driven.

## The four checks (last lines)

`npm test`:

```text
 Test Files  39 passed (39)
      Tests  402 passed (402)
   Start at  00:25:02
   Duration  1.52s (tests 70%, import 18%, transform 11%, worker 3%)
```

`npm run check`:

```text
> mr-zaki-studio@0.1.8 check
> biome check

Checked 129 files in 127ms. No fixes applied.
```

`npm run typecheck`:

```text
> mr-zaki-studio@0.1.8 typecheck
> tsc --noEmit
```

(no output after the command line, so no TypeScript errors)

`npm run build`:

```text
out/renderer/assets/index-DixZOv1B.css              22.68 kB
out/renderer/assets/reader-CH_IRC8Y.js               1.39 kB
out/renderer/assets/pdf.worker.min-CHN2wdfS.js     764.97 kB
out/renderer/assets/index-9kPnC0B3.js              826.67 kB

✓ built in 147ms
```

## GUI checks for the architect or owner

Not run here, as the task requires. Suggested checks: open a project with Grade 9 Arabic exam
papers and mark schemes, write their notes, open **Changes to review**, price and write an
exams set with a key, and check the writing paper shows `answerWords 300–400`; then accept one
paper and confirm the other papers are unchanged in the Curriculum tab and the export. Also
prepare an exams job, run it with the author's tool, and collect it.
