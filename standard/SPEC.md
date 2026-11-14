# The Curriculum Bundle Format, Version 2

Status: Version 2, stable. Version 1 files remain valid. This text is licensed under CC BY 4.0; see `LICENSE-TEXT`.
The JSON Schema and the examples are licensed under MIT; see `LICENSE-SCHEMA`.

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** in this
document are to be interpreted as described in RFC 2119 when, and only when, they
appear in capital letters.

This document defines one file format. It does not depend on any app, database,
or company. A stranger can write a valid bundle, or a reader for bundles, from
this document and the JSON Schema alone.

---

## 1. What a bundle is

A **curriculum bundle** is one JSON file written by one author. It holds one
curriculum: whichever grades and subjects the author covers, from one subject
for one grade to every subject in a school year. One author's name and rights
statement apply to the whole file.

A bundle is written by a stranger. Every rule in this document exists so that a
reader can check a bundle before trusting it, and so that a writer can produce
a bundle any reader will accept.

The bundle carries structure, not presentation. It says what is taught, in what
order, and how the exams are set. It does not carry images, audio, video, or
links to outside material.

## 2. The file

- A bundle file is **JSON**, encoded as **UTF-8**.
- The file is at most **20,000,000 characters** of decoded text. A reader
  **MUST** check the size before parsing and **MUST** refuse a file that is
  larger.
- The top level is one JSON object. A file that is not valid JSON — including
  one that is not UTF-8, or starts with a byte-order mark — is not a bundle.
  A reader **MUST** refuse it.
- Objects may not carry fields the format does not define (see "Unknown
  fields" in §7). A reader **MUST** refuse a bundle that has one.

## 3. Texts: the rules every text follows

Every text in a bundle is a plain string. There are two kinds:

- **Single-line texts** (names, titles, key words, facts, instructions, ids):
  they may not contain a line break.
- **Multi-line texts** (`examStyle`, `description`, `notes`, `marking`): they
  may contain line breaks, written as `\n` in JSON. A `\r\n` or `\r` sequence
  is treated the same as `\n`.

Every text in a bundle obeys all of these rules:

1. The text is normalised to **Unicode NFC** and **trimmed** (leading and
   trailing white space removed). Two texts that differ only in normalisation
   form are the same text. A reader **SHOULD** normalise before comparing.
2. The text is **non-empty** after trimming.
3. The text is at most its limit **in characters** (the limits are listed per
   field in §6).
4. The text contains **no forbidden character** (see "Characters" below).
5. The text contains **no web address** (see "Web addresses" below).

### 3.1 Characters

The following characters are refused in every text:

- **Control characters** (Unicode general category `Cc`), except that a
  multi-line text may contain `\n`.
- **Private-use characters** (general category `Co`).
- **Surrogate characters** (general category `Cs`).
- **Format characters** (general category `Cf`), except:
  - the visible format characters used by Arabic and other scripts:
    `U+0600`–`U+0605`, `U+06DD`, `U+070F`, `U+0890`–`U+0891`, `U+08E2`;
  - `U+FE0E` and `U+FE0F`, which emoji use.
- Invisible characters outside those categories: `U+034F`, `U+17B4`, `U+17B5`,
  `U+115F`, `U+1160`, `U+2800`, `U+3164`, `U+FFA0`,
  `U+FE00`–`U+FE0D`, `U+180B`–`U+180D`, `U+180F`, `U+E0100`–`U+E01EF`.

A reader **MUST** refuse a text that contains one of these. A writer **MUST
NOT** emit one.

### 3.2 Web addresses

A text may not contain a web address. For this rule, a web address is either:

- a **scheme** made of ASCII letters, digits, `+`, `-` or `.` that contains at
  least one ASCII letter, followed by `://` and then a letter or digit
  (Unicode letter or number); or
- `www.` followed by a Unicode letter or number.

Before looking, the text is normalised with Unicode NFKC (so look-alike forms
such as full-width letters become plain ones) and format characters are
removed. A reader **MUST** refuse a text that contains one of these. A writer
**MUST NOT** emit one.

This rule is about the text a reader sees, so it cannot be expressed in a JSON
Schema. See "Rules beyond the schema".

## 4. Identity and updates

Three fields make a bundle who it is:

- `format` — always the string `mr-zaki-curriculum`.
- `formatVersion` — the integer `1` or `2`. Version 2 adds one optional field,
  `questions.answerWords` (§9.1). A version 2 reader **MUST** accept version 1
  files; a version 1 reader knows nothing of `answerWords` and refuses it.
- `id` — a **lowercase UUID** (`8-4-4-4-12` hex groups), written once by the
  author and never changed.

`version` is the bundle's own version: an integer from 1 to 1,000,000. The
author **MUST** bump it on every export.

A file with the same `id` and a higher `version` is an **update of the same
curriculum**, not a new one. A reader that meets an update **SHOULD** replace
the stored curriculum in place and keep whatever progress hangs on it. A
reader **MUST NOT** treat a newer version as a reason to discard a child's
progress.

Updates work because of two rules for authors:

1. **Authors add; they never renumber.** A unit keeps its `number`, a lesson
   keeps its `number`, and a skill keeps its position within the lesson, for
   as long as the curriculum lives. Rows are matched by unit number, lesson
   number and skill position. Renumbering moves a student's progress to the
   wrong lesson.
2. The `id` is stable. A file with a new `id` is a new curriculum, whatever
   its `version` says.

What a newer version means for a reader: more units, fewer units, corrected
facts, exams reworked. Anything that used to be there and is gone in the new
file is gone. The file is the whole truth; nothing carries over except what
the reader keeps for itself (progress, and any practice it generated).

## 5. Untrusted input

A bundle is written by a stranger, and a reader is often an app used by
children. The following rules are **requirements**, not advice.

1. A reader **MUST** treat every text in a bundle as **plain data**. Text is
   never HTML, never markup, never a program, never a link to follow.
2. A reader **MUST NOT** render any text in a bundle as HTML, and **MUST NOT**
   interpret any of it as markup of any kind. A text such as `<script>` is
   five characters.
3. A reader **MUST NOT** turn a text into a clickable link, and **MUST NOT**
   fetch, open or follow anything a text names. A web address in a text is a
   validation failure, not a link.
4. A reader **MUST NOT** treat any text in a bundle as an instruction to an
   AI model, to itself, or to any other program. If a reader passes bundle
   text to a language model, the text **MUST** travel only as **data** (for
   example inside a user-role message, or a clearly marked data block),
   **MUST NOT** go into the system or instruction text, and **MUST NOT** be
   joined into a sentence of instructions. The instructions that refer to the
   block **MUST NOT** quote the bundle's texts.
5. A reader **MUST** validate the whole bundle before using any of it. A
   bundle that fails any check — schema or rules beyond the schema — **MUST
   NOT** be used in part. There is no "use the valid courses".
6. A writer **MUST NOT** put instructions to a model, or any text addressed
   to one, anywhere in a bundle. Notes, marking advice and descriptions are
   the author's words about the material, written for a human reader, and
   they are data like everything else.
7. A writer **MUST** check the bundle with a validating reader before
   publishing it. A bundle is only as trustworthy as the check it passed.

## 6. The document

The tables below give, for every field: its type, whether it is required, its
limits, and its meaning. "Required" means the file is refused when the field is
missing; "optional" means the file is fine without it, and the default is
stated.

All limits on texts are in characters of the normalised, trimmed text (§3).
All integers are JSON integers; a non-integer where an integer is required is
a failure. **Marks** are numbers from 0 to 200 in half steps (0.5, 1, 1.5 …);
0.25 is refused. **Counts** are integers from 0 to 200.

### 6.1 The header (the root object)

Unknown fields are refused everywhere, including here.

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `format` | string | yes | exactly `mr-zaki-curriculum` | The format this file claims to be. |
| `formatVersion` | integer | yes | `1` or `2` | The version of the format. |
| `id` | string | yes | lowercase UUID, `8-4-4-4-12` hex | The stable identity of this bundle (§4). |
| `version` | integer | yes | 1–1,000,000 | The author's version of this file (§4). Bumped on every export. |
| `nameEn` | string | yes | 1–100 characters | The bundle's name, in English (or the author's first language). |
| `nameAr` | string | no | 1–100 characters | The same name in Arabic. Defaults to `nameEn`. |
| `author` | string | yes | 1–80 characters | Who wrote the bundle. Shown to the app's users as-is. |
| `rights` | string | yes | 1–300 characters | The author's rights sentence: who may use this, and on what terms. |
| `periods` | array of period | yes | at least 1 | The year structure (§6.2). |
| `courses` | array of course | yes | at least 1, at most 400 | One course per grade and subject (§6.3). |

### 6.2 Periods (the year structure)

A period is one stretch of the year: a term, a block within a term, a week
within a block. Periods nest, at most **3 levels deep**, at most **60 periods
in the whole tree**.

Units must sit in a **leaf** period (a period with no children). An exam may
name a period at any depth — a block for a block test, a term for a term exam —
or no period at all (the whole year).

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `id` | string | yes | 1–40 characters, `^[a-z0-9-]+$` | The period's stable id. Unique in the whole tree. |
| `nameEn` | string | yes | 1–80 characters | The period's name, in English (or the author's first language). |
| `nameAr` | string | no | 1–80 characters | The same name in Arabic. Defaults to `nameEn`. |
| `wholeYear` | boolean | no | default `false` | True when this period spans the whole year (typically the final exam). |
| `periods` | array of period | no | at most 3 levels; at most 60 periods in the tree | The periods inside this one. Empty or absent means a leaf. A period at the third level may hold an empty `periods` list but no children. |

### 6.3 Courses

A course is one grade and one subject. The same grade and subject may not
appear twice in a file.

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `grade` | integer | yes | −1 to 12 | The grade. −1 is the first kindergarten year, 0 is the second; 1 to 12 are school grades. |
| `subject` | string | yes | non-empty | A subject id from the reader's own subject list (for example `science`). The format does not fix the list; the reader knows its own subjects and **MUST** refuse an unknown one. |
| `examStyle` | string | no | 1–8,000 characters, may be multi-line | How exams in this course are set, in the author's words, for what the structured `exams` cannot say. |
| `exams` | array of exam | no | at most 12; absent means no exams | How the exams are set (§6.4). Absent is the same as no key. |
| `units` | array of unit | yes | at least 1, at most 60 | The units of this course (§6.5). |

### 6.4 Exams

An exam is one sitting: a period's test, or the whole year's, when `period`
is absent.

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `period` | string | no | 1–40 characters | A period id of this bundle, at any depth. Absent means the exam covers the whole year. An id that is not a period of this bundle is a failure. |
| `name` | string | yes | 1–300 characters | The exam's name, in the language of the papers. |
| `papers` | array of paper | yes | at least 1, at most 6 | The papers of the exam (§6.4.1), in the order they are sat. |

#### 6.4.1 Papers

A paper is one sitting of one skill.

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `name` | string | yes | 1–300 characters | The paper's name, in the paper's language. |
| `skill` | string | yes | one of `listening`, `reading`, `writing`, `speaking`, `written` | The skill the paper tests. |
| `language` | string | no | one of `en`, `ar`, `fr` | The paper's language, when it is not the course's teaching language. |
| `minutes` | integer | no | 0–200 | How long the paper is. |
| `marks` | marks | no | 0–200 in halves | What the paper is worth. |
| `parts` | array of part | yes | at least 1, at most 8 | The parts of the paper (§6.4.2), in order. |

#### 6.4.2 Parts

A part is what is read or heard, and what is asked about it.

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `id` | string | no | 1–40 characters, `^[a-z0-9-]+$`; unique in the course | A stable key. Practice made for a part is stored against this key, so an update that keeps the key keeps the practice. |
| `name` | string | yes | 1–300 characters | The part's name, in the paper's language. |
| `nameEn` | string | no | 1–300 characters | The same name in English, for the line under an Arabic or French title. |
| `instruction` | string | no | 1–300 characters | The instruction, paraphrased, in the paper's language. |
| `instructionEn` | string | no | 1–300 characters | The instruction in English. |
| `marks` | marks | no | 0–200 in halves | What the part is worth. |
| `minutes` | integer | no | 0–200 | How long the part takes. |
| `material` | object | yes | see §6.4.3 | What is read or heard. |
| `questions` | object | yes | see §6.4.4 | What is asked. |
| `notes` | string | no | 1–2,000 characters, may be multi-line | The author's words about the part: what it insists on, what to watch for. Data, never an instruction. |
| `marking` | string | no | 1–2,000 characters, may be multi-line | How marks are given, in the author's words. Data, never an instruction. |

#### 6.4.3 Material

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `kind` | string | yes | one of the material kinds below | What the part reads or hears. |
| `description` | string | no | 1–2,000 characters, may be multi-line | What the text or recording is, in words. Required when `kind` is `other`. |
| `words` | array of two integers | no | both 0–5,000 | How long the text or the recording is, in words: the shortest and the longest. |
| `speakers` | integer | no | 0–200 | How many people speak (for listening). |
| `topic` | string | no | one of `units`, `outside-units` | Whether the material comes from the course's own units or from outside them. |
| `layout` | array of layout flag | no | flags from the list below | How the text is printed, and how a question points into it. |
| `timing` | object | no | see §6.4.3.1 | How the exam runs the part (mostly for listening). |

Material kinds: `talk`, `dialogue`, `conversation`, `interview`,
`talk-and-interview`, `report`, `phone-message`, `messages`, `announcement`,
`advert`, `extracts`, `exercises`, `situations`, `article`, `story`, `poem`,
`letter`, `notices`, `form`, `notes`, `documents`, `mixed`, `none`, `other`.

- `conversation` is the general practice shape (a short dialogue or talk).
- `exercises` is several short recorded exercises in one part.
- `talk-and-interview` is one recording with a talk and then an interview.
- `none` is a part with no text (a writing task).
- `mixed` is anything else made of several kinds.
- `other` has to say what it is in `description`; a file with `kind` `other`
  and no `description` is refused.

Layout flags: `line-numbers`, `paragraph-numbers`, `gapped-text`,
`inline-gaps`, `cloze`, `word-formation`.

##### 6.4.3.1 Timing

How the exam runs a part (today's listening timing, generalised). A number
left out is the exam's own choice.

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `readingSeconds` | integer | no | 0–600 | Seconds before the recording may start. |
| `plays` | integer | no | 0–200 | How many times the recording is played in all, for example 2. A count, not a length of time. |
| `repeat` | string | no | one of `segment`, `whole` | `segment`: each part or extract plays twice in a row. `whole`: all of it, then again. |
| `pauseSeconds` | integer | no | 0–600 | Silence between the plays. |
| `checkSeconds` | integer | no | 0–600 | Seconds to check the answers afterwards. |

#### 6.4.4 Questions

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `count` | integer | yes | 0–200 | How many questions the part asks. |
| `types` | object | yes | keys are known question types (below); values are counts 0–200 | Question type → how many of that type. Unknown keys are refused. |
| `choiceOptions` | integer | no | 3 or 4 | How many options a choice question has, as the paper prints. |
| `maxWords` | integer | no | 0–200 | The longest answer, in words. |
| `answerWords` | array of two integers | no | both 0–5,000; the first no larger than the second | How long the answer must be, in words: the shortest and the longest (a writing task). Version 2. |
| `marksEach` | marks | no | 0–200 in halves | What every question is worth, when they are all worth the same. |
| `marksByType` | object | no | keys are known question types; values are marks 0–200 in halves | What a question of each type is worth, for papers that mix them. Unknown keys are refused. |
| `totalMarks` | marks | no | 0–200 in halves | What the questions are worth in all. |
| `example` | boolean | no | — | The paper prints a worked example, already answered. |
| `copiedExactly` | boolean | no | — | Answers are copied word for word from the text or the recording. |

Question types: `choice`, `truefalse`, `gap`, `short`, `form`, `yesno`,
`match`, `picture`, `multi`, `truefalse-justify`, `extract`, `essay`,
`calculation`, `labelling`, `ordering`, `other`.

### 6.5 Units

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `number` | integer | yes | 0–99; unique in the course | The unit's number. Never renumbered (§4). |
| `period` | string | yes | 1–40 characters | The id of a **leaf** period of this bundle. A unit may not sit in a period that has children. |
| `title` | string | yes | 1–150 characters | The unit's title. |
| `source` | string | no | one of `sheet`, `provisional`; default `sheet` | Where the unit came from: the author's own sheet, or a provisional outline. |
| `keywords` | array of string | no | at most 40; each 1–400 characters | The key words of the unit. Absent means none. |
| `evidence` | array of string | no | at most 40; each 1–400 characters | Where the unit's content can be checked against (in the author's words). Absent means none. |
| `lessons` | array of lesson | yes | at least 1, at most 40 | The lessons of the unit (§6.6), in order. |

### 6.6 Lessons

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `number` | integer | yes | 0–99; unique in the unit | The lesson's number. Never renumbered (§4). |
| `title` | string | yes | 1–150 characters | The lesson's title. |
| `skills` | array of skill | yes | at least 1, at most 20 | What the student can do after the lesson (§6.7), in priority order. A skill's position within this list is its stable key. |
| `facts` | array of string | no | at most 25; each 1–400 characters | The plain facts the lesson teaches, as any textbook would state them. Absent means none. |
| `activity` | string | no | one of `writing`, `reading` | The lesson's main activity, when the author wants to say so. |

### 6.7 Skills

A skill is either a plain string, or an object with a code and a text:

| Form | Type | Limits | Meaning |
|---|---|---|---|
| `"…"` | string | 1–300 characters | The skill statement, for a course that does not use codes. |
| `{ "code": …, "text": … }` | object | `code` 1–20 characters; `text` 1–300 characters | A coded skill (for example a syllabus code) and its statement. Both fields are required in this form. |

### 6.8 Lists of texts

`keywords`, `evidence` and `facts` are lists of short texts. Each obeys §3.
Absent means an empty list; an empty list is fine.

## 7. What a valid bundle is

A **valid bundle** is a file that passes every check in this document and in
the JSON Schema:

1. §2: the file is UTF-8 JSON, at most 20,000,000 characters, top level one
   object.
2. §3: every text is normalised, trimmed, non-empty, within its limit, and
   free of forbidden characters and web addresses.
3. Unknown fields are refused, everywhere. In objects whose keys are fixed
   (the header, a period, a course, …) every key must be a defined field; in
   `types` and `marksByType` every key must be a known question type.
4. The JSON Schema for the file's `formatVersion`
   (`schema/bundle-v1.schema.json` or `schema/bundle-v2.schema.json`, draft
   2020-12) accepts the file: the shapes, the required fields, the types, the
   enumerations, the integer and marks ranges, and the per-field limits it can
   express.
5. "Rules beyond the schema", below, all hold.

### Rules beyond the schema

These rules cannot be written in the JSON Schema. They are part of the format,
and a conforming reader **MUST** enforce them:

- The **file size** limit (§2): 20,000,000 characters, checked before parsing.
- The **total number of periods**: at most 60 in the whole tree (the schema
  bounds each list, not the sum).
- The **character rules** (§3.1): the refused categories and the allowed
  exceptions. The schema can bound a string's length, not its characters.
- The **web-address rule** (§3.2): no text may contain one.
- **Normalisation**: NFC and trimming, before length and content checks.
- **Cross-references**:
  - A unit's `period` is a **leaf** period of this bundle.
  - An exam's `period`, when present, is **some period of this bundle, at any
    depth**.
  - Part ids are unique within a course.
  - Period ids are unique in the whole tree.
  - Unit numbers are unique in a course; lesson numbers are unique in a unit.
  - A grade and subject pair appears at most once per file.
- The material kind `other` **requires** a `description`.
- `answerWords`, when present, holds exactly two integers, and the first is no
  larger than the second (§6.4.4).
- A multi-line text may contain `\n`; a single-line text may not (§3).
- An absent `nameAr` on the header or a period defaults to the matching
  `nameEn`; an absent `source` defaults to `sheet`; an absent `wholeYear`
  defaults to `false`; absent `exams`, `facts`, `keywords`, `evidence` default
  to an empty list; an exam without `period` covers the whole year; an absent
  `activity` means the author did not say.

### Invalid examples

The `examples/` folder carries three refused files and says why. All are
refused by the rules above; `invalid-web-address.json` passes the JSON Schema
(it breaks a rule beyond the schema), `invalid-unknown-field.json` fails the
JSON Schema as well, and `invalid-answer-words-v1.json` carries a version 2
field in a version 1 file and fails the version 1 JSON Schema too.

## 8. Conformance

### A conforming reader

A reader is any program that reads bundles. A conforming reader:

- **MUST** check the file size before parsing (§2).
- **MUST** refuse a file that is not valid JSON, or whose top level is not one
  object.
- **MUST** apply §3 to every text: normalise, trim, check non-empty, check
  the limit, check the characters, check for web addresses.
- **MUST** validate the file against the JSON Schema and against every rule in
  §7.
- **MUST** refuse the whole bundle when any check fails. It **MUST NOT** use
  the valid parts of an invalid bundle.
- **MUST** treat every text as untrusted data (§5): never as HTML, never as a
  link, never as an instruction to any program, including itself and any
  model it calls.
- **MUST NOT** follow, fetch or open anything a text names.
- **SHOULD** report every problem it finds (where it is, and what is wrong),
  not only the first, up to some sane cap.
- **MAY** add its own checks (for example, that a subject is one it knows) and
  **MUST** refuse a bundle that fails them, in the same way.

### A conforming writer

A writer is any program that produces bundles. A conforming writer:

- **MUST** produce files that pass every check in §7, including the rules
  beyond the schema.
- **MUST** write a lowercase UUID in `id`, once, and reuse it for every later
  version of the same curriculum.
- **MUST** bump `version` on every export.
- **MUST NOT** renumber units, lessons or skills (§4).
- **MUST NOT** put a web address, or a forbidden character, in any text.
- **SHOULD** check its own output with a validating reader before export.

A file both accept is version 1 or version 2. A reader and a writer that both
conform interoperate on any valid file of a version the reader supports. A
version 2 reader **MUST** accept a valid version 1 file, because version 2 adds
a field and changes nothing else.

## 9. Versioning of the standard

This section is about the standard, not about a bundle's own `version`.

Version 2 is stable. The following changes **keep the current version**:

- Editorial fixes to this text, and to the schema's descriptions.
- New examples, or clearer error messages.
- Fixing a schema so it rejects exactly the files the rules already reject
  (for example a pattern the text already required).

The following changes **need a new version** (a new `formatVersion` and a new
schema, published together):

- A new required field, or a new field of any kind. Unknown fields are
  refused, so even an optional new field is an incompatible change for readers
  of the previous version.
- A new refusal: a character, a pattern, a limit tightened.
- A relaxed limit, or a newly allowed character.
- A change to the meaning of any field, or to the defaults.
- A change to what a valid bundle is, in either direction.

A reader **MUST NOT** accept a `formatVersion` it does not know. A reader of
this standard accepts `formatVersion` 1 and 2.

A writer **MUST** write the **lowest version that holds the file**: version 2
only when some part has `answerWords`, otherwise version 1. A file that does
not use the new field therefore stays readable by version 1 readers.

### 9.1 Differences from version 1

Version 2 is version 1 plus one optional field: `questions.answerWords`
(§6.4.4), a pair of integers from 0 to 5,000 that says how long the child's own
answer must be, for a writing task. The first is no larger than the second.
Nothing else changes: every limit, every rule and every refusal of version 1
still holds, and a version 1 file whose `formatVersion` is changed to `2` is a
valid version 2 file.

In a version 1 file `answerWords` is an unknown field and is refused, exactly
as any undefined field is. In a version 2 file it is allowed. That is why the
change needs a new version: unknown fields are refused, so even an optional
new field is incompatible with version 1 readers.

## 10. The limits, at a glance

| What | Limit |
|---|---|
| Whole file | 20,000,000 characters |
| Bundle `version` | 1–1,000,000 |
| Courses per file | 1–400 |
| Periods per tree | at most 60, at most 3 levels deep |
| Period and part ids | 1–40 characters, `^[a-z0-9-]+$` |
| Grades | −1 to 12 (−1 and 0 are the two kindergarten years) |
| Units per course | 1–60 |
| Lessons per unit | 1–40 |
| Skills per lesson | 1–20; skill text 300 characters; skill code 20 characters |
| Facts per lesson | 25; each 400 characters |
| Key words and evidence per unit | 40 each; each 400 characters |
| Unit and lesson numbers | 0–99 |
| Names (`nameEn`, `nameAr`) | 100 characters |
| Author | 80 characters |
| Rights statement | 300 characters |
| Period names | 80 characters |
| Titles | 150 characters |
| `examStyle` | 8,000 characters, may be multi-line |
| Exams per course | 1–12 |
| Papers per exam | 1–6 |
| Parts per paper | 1–8 |
| Exam names, paper and part names, instructions | 300 characters |
| Exam `notes`, `marking`, material `description` | 2,000 characters, may be multi-line |
| Counts and option numbers | 0–200 (whole); `choiceOptions` 3–4 |
| Marks | 0–200 in halves (0.5 steps) |
| `words` | both 0–5,000 |
| `answerWords` | both 0–5,000; the first no larger than the second |
| Reading, pause and check times | 0–600 seconds |
