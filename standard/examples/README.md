# Examples

Four bundles, all around the same invented subject ("Starlight Astronomy", grade 8
and grade 9 science). The content is written from common-knowledge astronomy
texts, names no school, curriculum or country's exam, and is copied from no
school's material.

- `minimal.json`: a valid bundle with the least a file can hold — one period,
  one course, one unit, one lesson, two facts.
- `full.json`: a valid bundle that uses every field the format has: a nested
  year structure, two papers (reading in English and listening in Arabic) with
  every question type, key words and evidence, a coded skill, and multi-line
  texts.
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

Both invalid examples are refused so an implementation can check its own
refusals against them.
