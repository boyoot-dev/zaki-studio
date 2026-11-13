# The Curriculum Bundle Format

**Version 1, stable.**

A curriculum bundle is one JSON file that one author writes: whichever grades
and subjects they cover, from one subject for one grade to every subject in a
school year. It holds the year's periods, the courses (one grade and one
subject each), the units, lessons, skills and facts a student studies, and
how the exams are set. Any app or tool that teaches from a curriculum can
read one — a tutor, a study planner, a practice-paper writer, a checker. A
bundle is written by a stranger, so the format is strict: the file is checked
against explicit limits before it is used, and nothing in it is ever treated
as an instruction (see `SPEC.md`, "Untrusted input"). The format was first
implemented by Mr. Zaki, an AI tutor for children; this standard is published
so that anyone can implement it without the original code.

## The files

- **[SPEC.md](SPEC.md)** — the format, version 1. A stranger can write a valid
  bundle, or a reader for it, from this document alone. This is the normative
  text.
- **[schema/bundle-v1.schema.json](schema/bundle-v1.schema.json)** — a JSON
  Schema (draft 2020-12) for the shapes, types, required fields and limits.
- **[examples/](examples/)** — one minimal valid bundle, one fuller valid
  bundle, and two refused examples, each with the reason it is refused.
- **[CHANGELOG.md](CHANGELOG.md)** — what changed between versions of the
  standard.
- **[LICENSE-TEXT](LICENSE-TEXT)** — the licence for `SPEC.md` and this
  `README.md`: Creative Commons Attribution 4.0 International (CC BY 4.0).
- **[LICENSE-SCHEMA](LICENSE-SCHEMA)** — the licence for `schema/` and
  `examples/`: MIT.

## Licences

Both licences cover the files in this folder only, Copyright 2026 Amr Bedair.
`SPEC.md` and this `README.md` are CC BY 4.0 (share and adapt the text, with
credit and a link to the licence). `schema/bundle-v1.schema.json` and the
files in `examples/` are MIT.

## Conformance

`SPEC.md` defines what a valid bundle is, and what a conforming reader and a
conforming writer must do. The JSON Schema cannot express every rule of the
format (for example, "no web address in a text", or the cross-references
between objects); those rules are listed in `SPEC.md` under "Rules beyond the
schema" and are part of the format.
