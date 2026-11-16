# The Curriculum Bundle Format

**Version 2, stable. Version 1 files remain valid.**

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

- **[SPEC.md](SPEC.md)** — the format, versions 1 and 2. A stranger can write a
  valid bundle, or a reader for it, from this document alone. This is the
  normative text.
- **[schema/bundle-v2.schema.json](schema/bundle-v2.schema.json)** — a JSON
  Schema (draft 2020-12) for version 2, the current version: the shapes, types,
  required fields and limits. **[schema/bundle-v1.schema.json](schema/bundle-v1.schema.json)**
  stays for version 1 files.
- **[examples/](examples/)** — three valid bundles (two version 1 and one
  version 2) and four refused examples, each with the reason it is refused.
  **[examples/EXPECTED.md](examples/EXPECTED.md)** lists every example, its
  verdict, and the path and message the reference reader reports for it.
- **[CHANGELOG.md](CHANGELOG.md)** — what changed between versions of the
  standard.
- **[LICENSE-TEXT](LICENSE-TEXT)** — the licence for `SPEC.md` and this
  `README.md`: Creative Commons Attribution 4.0 International (CC BY 4.0).
- **[LICENSE-SCHEMA](LICENSE-SCHEMA)** — the licence for `schema/` and
  `examples/`: MIT.

## Licences

Both licences cover the files in this folder only, Copyright 2026 Amr Bedair.
`SPEC.md` and this `README.md` are CC BY 4.0 (share and adapt the text, with
credit and a link to the licence). `schema/` and the files in `examples/` are
MIT.

## Conformance

`SPEC.md` defines what a valid bundle is, and what a conforming reader and a
conforming writer must do. The JSON Schema cannot express every rule of the
format (for example, "no web address in a text", or the cross-references
between objects); those rules are listed in `SPEC.md` under "Rules beyond the
schema" and are part of the format.

The reference reader is `src/shared/format/bundle.ts` in this repository: a
working reader that follows `SPEC.md`. Where it and the text disagree, the text
is meant to win, and the disagreement is a bug to report.
`examples/EXPECTED.md` records what it says about every example.
