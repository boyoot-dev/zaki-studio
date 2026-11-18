# What every example is expected to be

One row per file in this folder. The verdict is what the reference reader
(`src/shared/format/bundle.ts`) says about the file, run with the subject list
this repository ships (`src/shared/format/subjects.json`). For a refused file,
the row gives the first problem the reader reports: the path where it was found
and the message it gives.

The test beside the reader, `src/shared/standard-expected.test.ts`, runs the
reader on every file here and checks each row, so this list cannot drift from
the reader.

| File | Verdict | Path | Message |
|---|---|---|---|
| `minimal.json` | valid | — | — |
| `full.json` | valid | — | — |
| `writing.json` | valid | — | — |
| `invalid-web-address.json` | refused | `courses[0].units[0].lessons[0].facts[1]` | remove the web address |
| `invalid-unknown-field.json` | refused | `courses[0].units[0].summary` | unknown field "summary" |
| `invalid-emoji-length.json` | refused | `courses[0].units[0].lessons[0].facts[0]` | at most 400 characters |
| `invalid-language-code.json` | refused | `courses[0].language` | expected a two-letter language code, e.g. en, ar, fr |
| `invalid-support-repeats-language.json` | refused | `courses[0].support[0]` | the course's own language is not a support language |
| `invalid-missing-id.json` | refused | `courses[0].units[0].lessons[0].id` | expected a non-empty string |
| `invalid-duplicate-key.json` | refused | `courses[0].units[0].title` | key "title" appears twice |
| `invalid-old-version.json` | refused | `formatVersion` | This file was made by an older Studio. Open its project in the new Studio and export it again. |
