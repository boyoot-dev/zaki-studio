# Examples

Eleven bundles, all around the same invented subject ("Starlight Astronomy", grade
8 and grade 9 science). The content is written from common-knowledge astronomy
texts, names no school, curriculum or country's exam, and is copied from no
school's material.

- `minimal.json`: a valid bundle with the least a file can hold: one period,
  one course taught in English, one unit, one lesson, one skill, two facts.
- `full.json`: a valid bundle that uses every field: a nested year structure,
  two papers (reading in English and listening in Arabic) with every question
  type, key words and evidence, a coded skill, and multi-line texts.
- `writing.json`: a valid bundle whose writing paper has two parts, each with
  `questions.answerWords: [300, 400]`.
- `invalid-web-address.json`: **refused**. A fact contains the web address
  `https://example.org/moon-phases`. The format never allows a web address in
  any text. This is a "beyond the schema" rule (see `SPEC.md`), so the file
  passes the JSON Schema and is still refused by the rules.
- `invalid-unknown-field.json`: **refused**. The unit carries a field called
  `summary`, which the format does not define. Unknown fields change meaning
  silently, so the format refuses them. This one fails the JSON Schema too
  (`additionalProperties: false`).
- `invalid-emoji-length.json`: **refused**. A fact is 400 characters long and
  ends with an emoji, and a text's limit is counted in UTF-16 code units, so the
  fact is 401 units and one over the 400 limit. A reader that counted code
  points would read the same fact as 400 and accept it. This one passes the
  JSON Schema, which counts characters and not code units.
- `invalid-language-code.json`: **refused**. The course's `language` is `fre`,
  which is not a two-letter ISO 639-1 code. The schema refuses it too.
- `invalid-support-repeats-language.json`: **refused**. The course is taught in
  English and lists English again as a support language. Support languages
  help beside the teaching language; they never repeat it. The JSON Schema
  cannot compare the two fields, so the file passes it.
- `invalid-missing-id.json`: **refused**. A lesson has no `id`. Every unit,
  lesson, skill, exam, paper and part carries a permanent id, because a reader
  matches a student's progress by it. The schema refuses it too.
- `invalid-duplicate-key.json`: **refused**. A unit writes `title` twice. A
  JSON parser keeps the last copy without a word, so the format refuses the
  file; the schema sees only the parsed value and passes it.
- `invalid-old-version.json`: **refused**. The file says `formatVersion: 2`,
  from a withdrawn draft. A reader accepts only the version it knows.

`EXPECTED.md` lists every file here with its verdict, valid or refused, and,
for a refused one, the path and message the reference reader reports. A test
beside the reader (`src/shared/standard-expected.test.ts`) runs the reader over
every file and checks each row, so the list cannot drift.

The refused examples are refused so an implementation can check its own
refusals against them. The reference reader is `src/shared/format/bundle.ts` in
this repository. Where it and `SPEC.md` disagree, the text is meant to win, and
the disagreement is a bug to report.
