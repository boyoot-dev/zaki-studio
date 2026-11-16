# Changelog

## Wording only: no format change (second round)

A second outside review (2026-11-16) asked for another round of clarifications.
As in the first round, the wording now says what the reference reader
(`src/shared/format/bundle.ts`) already does: no file that was valid is refused,
and no file that was refused is accepted. The points:

- A text's limit counts **UTF-16 code units** of the normalised, trimmed text
  (JavaScript's `.length`), so a character outside the Basic Multilingual Plane,
  such as most emoji, counts as two; the file-size limit is counted the same
  way. A reader that counts code points can disagree at the limit, and
  `examples/invalid-emoji-length.json` is a refused file that proves it.
- The order of the checks is now one numbered list (§3.5): check the size,
  decode UTF-8, parse the JSON, normalise to NFC (a multi-line text has its
  `\r\n` and `\r` turned into `\n` first), trim, check non-empty, check the
  length, check the characters, check for web addresses.
- Trim is what JavaScript's `trim()` removes. `U+0085` is white space to
  Unicode but not to `trim()`, so it stays in the text and is refused as a
  control character.
- Duplicate keys: `JSON.parse` keeps the last value, so the reference reader
  reads the last one and does not refuse the file; a writer **MUST NOT** write a
  key twice. Refusing duplicate keys is a possible change for a later version,
  not a rule today. `NaN`, `Infinity`, comments and trailing commas are not
  JSON, and are refused for that reason.
- §10 now says why the work a reader does on a file is bounded: the schema
  fixes the shape and the nesting, unknown fields are refused, and every list
  has a cap in the table, beside the file-size limit.
- Conformance is not correctness: a valid bundle can still state wrong facts,
  give a wrong answer key, or describe an exam that is not the exam it names.
  A reader keeps treating every text as untrusted data, including in any model
  it calls.
- `material.kind` limits nothing else: a part with `kind` `none` may carry
  `description`, `words`, `speakers`, `topic`, `layout` and `timing` like any
  other part. `wholeYear` is accepted on a period at any depth, may sit on a
  period that has children, and does not change the leaf rule for units.
- The schemas carry no `$id`, and canonical schema addresses are not published
  yet; the text names the schema files by their path in the repository.

## Wording only: no format change

An outside review of the standard (2026-11-16) found places where the text was
silent or ambiguous, so two readers built from it could disagree. The wording
now says what the reference reader (`src/shared/format/bundle.ts`) already
does. No format change: every file that was valid is still valid, and every
file that was refused is still refused. The points:

- `src/shared/format/bundle.ts` is named as the reference reader, and
  `examples/EXPECTED.md` lists what it says about every example, with a test
  that checks each row.
- A course's teaching language comes from the reader's subject list; a paper
  without `language` is in that language; a part's `nameEn` is the English line
  under a title in it.
- A reader must not assume that the exam numbers add up.
- A reader normalises to NFC and trims before it checks; a writer writes text
  already normalised and trimmed.
- A skill is matched by its position, so new skills go at the end of a lesson.
- An update deletes a unit, a lesson or a skill it no longer has, and the
  progress on it; progress on rows that stay is kept.
- `exams`, when present, has 1 to 12 entries; an empty list is refused.
- A writer checks the target reader's subject list, and
  `src/shared/format/subjects.json` is the list the Mr. Zaki reader uses.
- The file size is counted in decoded characters, checked early on the bytes.
- `subject` has no limit beyond the file's.
- Both schemas write `formatVersion` as a `const`.

## 2.0

Version 2 is stable. Version 1 files remain valid, and a version 2 reader must
accept them.

One new optional field: `questions.answerWords`, a pair of integers from 0 to
5,000 that says how long the child's own answer must be (the shortest and the
longest), for a writing task. Nothing else changes.

A writer writes the lowest version that holds the file: 2 only when some part
has `answerWords`, otherwise 1. So a file that doesn't use the new field stays
readable by version 1 readers.

The standard also carries `schema/bundle-v2.schema.json` and one valid version 2
example and one refused version 1 file that uses the new field.

## 1.0

First publication. The bundle format, version 1: the file, the fields, the
limits, the identity and update rules, the untrusted-input rules, the
conformance rules, the JSON Schema and two valid examples and two refused
examples.
