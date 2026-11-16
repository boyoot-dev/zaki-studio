# Examples

Six bundles, all around the same invented subject ("Starlight Astronomy", grade 8
and grade 9 science). The content is written from common-knowledge astronomy
texts, names no school, curriculum or country's exam, and is copied from no
school's material.

- `minimal.json`: a valid version 1 bundle with the least a file can hold — one
  period, one course, one unit, one lesson, two facts.
- `full.json`: a valid version 1 bundle that uses every field version 1 has: a
  nested year structure, two papers (reading in English and listening in Arabic)
  with every question type, key words and evidence, a coded skill, and
  multi-line texts.
- `writing-v2.json`: a valid version 2 bundle. Its writing paper has two parts,
  each with `questions.answerWords: [300, 400]`, the format's one new field.
- `invalid-web-address.json`: **refused**. A fact contains the web address
  `https://example.org/moon-phases`. The format never allows a web address in
  any text. This is a "beyond the schema" rule (see `SPEC.md`), so the file
  passes the JSON Schema and is still refused by the rules: the text rule
  reports "remove the web address" at `courses[0].units[0].lessons[0].facts[1]`.
- `invalid-unknown-field.json`: **refused**. The unit carries a field called
  `summary`, which the format does not define. Unknown fields change meaning
  silently, so the format refuses them: the reader reports `unknown field
  "summary"` at `courses[0].units[0].summary`. This one fails the JSON Schema
  too (`additionalProperties: false`).
- `invalid-answer-words-v1.json`: **refused**. The file says
  `formatVersion: 1` but a writing part carries `answerWords`, the field version
  2 added. A version 1 reader cannot know it, so it is an unknown field: the
  reader reports `unknown field "answerWords"` at
  `courses[0].exams[0].papers[0].parts[0].questions.answerWords`. This one fails
  the version 1 JSON Schema too.

`EXPECTED.md` lists every file here with its verdict — valid or refused — and,
for a refused one, the path and message the reference reader reports. A test
beside the reader (`src/shared/standard-expected.test.ts`) runs the reader over
every file and checks each row, so the list cannot drift.

The refused examples are refused so an implementation can check its own
refusals against them. The reference reader is `src/shared/format/bundle.ts` in
this repository. Where it and `SPEC.md` disagree, the text is meant to win, and
the disagreement is a bug to report.
