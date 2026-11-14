# Task 174 (Part A): format 2, the length of the child's own answer

## What changed

- **`src/shared/format/bundle.ts`**
  - `SUPPORTED_VERSIONS = [1, 2]` replaces the single format-version check, and
    `LATEST_FORMAT_VERSION = 2` is exported. `BundleResult` now tells which
    version the file was (`formatVersion`).
  - `BundleQuestions` gained `answerWords: [number, number] | null`.
  - The question parser takes the file's version. Version 1 keeps the old key
    list, so `answerWords` is refused as an unknown field; version 2 allows it.
  - `answerWords` is parsed like `material.words`: two integers from 0 to 5,000,
    plus the rule that the first is no larger than the second ("the first number
    must not be larger than the second").
  - `parseCourseExams(raw, where, formatVersion = LATEST_FORMAT_VERSION)` passes
    the version through, so callers with no bundle (built-in course files, the
    Studio's model) accept the new field by default.
- **`src/shared/export.ts`** writes the lowest version that holds the file: 2
  when any exam part has `answerWords`, otherwise 1. `src/shared/model.ts`'s
  `BundleFile` type widened to 1 or 2 to hold it.
- **`standard/`**
  - `SPEC.md` is now version 2: title and status, §4 and §6.1 (`formatVersion`
    1 or 2), the new row in §6.4.4, the answer-words rule beyond the schema,
    §7's schema and invalid-example text, §8's reader rule, §9 rewritten with
    §9.1 "Differences from version 1", and the §10 limits row.
  - New `schema/bundle-v2.schema.json`: a copy of version 1 with
    `formatVersion` `enum: [2]` and `answerWords` (two integers, 0–5,000, with
    the min ≤ max rule in its description). `bundle-v1.schema.json` is
    unchanged.
  - New `examples/writing-v2.json` (one writing paper, two parts, each
    `answerWords: [300, 400]`, neutral invented astronomy content) and
    `examples/invalid-answer-words-v1.json` (`answerWords` in a version 1 file).
    `examples/README.md`, `CHANGELOG.md` and `README.md` updated.
- **`README.md`** says the reference reader accepts versions 1 and 2, and that
  export writes version 2 only when a part gives the child's answer length.
- **Tests**
  - `src/shared/standard.test.ts`: each example is checked against the schema
    for its own version; added acceptance/refusal tests for version 1 and 2,
    `[400, 300]`, `[-1, 5]`, `[0, 5001]`, `[300]`, `"300-400"`, version 3, and
    `parseCourseExams` without a version. Also checks that the version 2 schema
    is version 1's plus `answerWords` and nothing else.
  - `src/shared/export.test.ts`: a project with no `answerWords` writes
    `formatVersion: 1`; one with `answerWords` writes 2 and keeps
    `[300, 400]`.
  - `src/shared/model.test.ts`: the `BundleQuestions` literal gained
    `answerWords: null` (type only, no behaviour change).

## Deviations and why

- Part B was ignored, as instructed.
- `BundleFile.formatVersion` had to become `1 | 2`; without it the export
  could not hold version 2 in the type. `BUNDLE_FORMAT_VERSION` stays 1 as the
  default `toBundle` writes, and the export overrides it using the model.
- `SUPPORTED_VERSIONS` is not exported. The task asked only for
  `LATEST_FORMAT_VERSION` to be exported; the list is used for the check and
  its message.
- The standard test gained one test beyond the acceptance list ("version 2's
  schema is version 1's plus `answerWords`") because the existing keys test
  deliberately compares the fuller version 1 example with the version 1 schema.
- No npm dependencies were added.

## The four checks

`npm test`

```
 Test Files  37 passed (37)
      Tests  375 passed (375)
   Start at  23:46:18
   Duration  1.60s (tests 64%, import 18%, transform 15%, worker 3%)
```

`npm run check`

```
Checked 123 files in 111ms. No fixes applied.
```

`npm run typecheck`

```
> mr-zaki-studio@0.1.7 typecheck
> tsc --noEmit
```

`npm run build`

```
out/renderer/assets/index-ByFU-mZg.js                 800.29 kB
✓ built in 110ms
```
