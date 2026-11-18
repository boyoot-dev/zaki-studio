# Changelog

## Version 1 (2026-11): the first public version

The format starts again at version 1. The drafts published earlier in 2026 (as
versions 1 and 2) are withdrawn: their files are refused, and an author exports
them again from the tool that made them. Few files existed, so a clean start
was chosen over keeping two readers.

What this version has that the drafts did not:

- **A course carries its teaching language.** `language` (an ISO 639-1 code)
  is required on every course. A subject id says what is taught, never in which
  language, so the same subject may appear twice in a grade in two languages.
  Before, the language came from the reader's subject list (`math-ar`).
- **Support languages.** A course may list up to three languages that help the
  student beside the teaching language, or `native` for the student's own.
- **Any language code.** The format accepts every ISO 639-1 code; which
  languages an app can teach in is the app's business. A reader shows a course
  it can't teach yet as not available, and never refuses the file for it.
- **Permanent ids.** Every unit, lesson, skill, exam, paper and part carries an
  `id`. Readers match progress by id, never by number or position, so an author
  may renumber, reorder and reword freely. A skill is always an object.
- **Exam numbers are read by one rule** (§6.4.4), stated for every reader. A
  file whose numbers disagree is still valid.
- **Ordered word ranges.** A material's `words`, like `answerWords`, has its
  first number no larger than the second.
- **Duplicate keys are refused.**
- `questions.answerWords` is part of the format, with no version of its own.

The wording of both earlier review rounds (how length is counted, what trim
removes, the order of the checks, the limits as a bound on a reader's work,
conformance not being correctness) carries over unchanged.
