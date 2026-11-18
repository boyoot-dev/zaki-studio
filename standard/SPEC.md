# The Curriculum Bundle Format, Version 1

Status: Version 1, stable (2026-11). Earlier drafts are withdrawn; their files are not
valid bundles. This text is licensed under CC BY 4.0; see `LICENSE-TEXT`.
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
  larger. The limit counts **decoded** characters. A reader **MAY** refuse
  early on the file's bytes — 20,000,000 characters are at most 80,000,000
  bytes of UTF-8 — and then count characters after decoding.
- The top level is one JSON object. A file that is not valid JSON — including
  one that is not UTF-8, or starts with a byte-order mark — is not a bundle.
  A reader **MUST** refuse it.
- Objects may not carry fields the format does not define (see "Unknown
  fields" in §7). A reader **MUST** refuse a bundle that has one.
- An object **MUST NOT** write the same key twice. JSON does not forbid it,
  and parsers disagree about which copy they keep (`JSON.parse` keeps the last
  one without a word), so a reader **MUST** refuse a file with a repeated key.
  This is checked on the text, since a parsed value no longer shows the
  repetition.
- `NaN`, `Infinity`, `-Infinity`, comments (`//`, `/* */`) and trailing commas
  are not JSON. A file that uses one is not valid JSON, and is refused for that
  reason.

## 3. Texts: the rules every text follows

Every text in a bundle is a plain string. There are two kinds:

- **Single-line texts** (names, titles, key words, facts, instructions, ids):
  they may not contain a line break.
- **Multi-line texts** (`examStyle`, `description`, `notes`, `marking`): they
  may contain line breaks, written as `\n` in JSON. A `\r\n` or `\r` sequence
  is treated the same as `\n`.

Every text in a bundle obeys all of these rules:

1. The text is normalised to **Unicode NFC** and **trimmed** (leading and
   trailing white space removed) **before it is checked**. A reader **MUST**
   normalise first, then check: `" The Moon "` is valid and is read as
   `"The Moon"`. Two texts that differ only in normalisation form or in
   leading or trailing white space are the same text. A writer **MUST** write
   text that is already normalised and trimmed.
2. The text is **non-empty** after trimming.
3. The text is at most its limit **in characters** (the limits are listed per
   field in §6; a character here is a UTF-16 code unit, see §3.3).
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

### 3.3 How length is counted

Every limit on a text counts **UTF-16 code units** of the normalised, trimmed
text: the number JavaScript's `.length` gives for the string. A character of
the Basic Multilingual Plane counts as one. A character outside it — most
emoji, for example — counts as **two**, because JSON writes it as a surrogate
pair, and the two halves are two code units. A limit of 400 therefore admits
399 ordinary characters and one emoji, and a 400-character fact that holds an
emoji is refused (`examples/invalid-emoji-length.json`).

The file-size limit (§2) is counted the same way, on the decoded text.

A reader that counts characters another way — code points, for example — may
disagree with this document, and with the reference reader, exactly at the
limit.

### 3.4 What trim removes

**Trim** removes what JavaScript's `trim()` removes at either end of a text:
the Unicode space separators (general category `Zs`), tab `U+0009`, vertical tab
`U+000B`, form feed `U+000C`, the byte-order mark `U+FEFF` (also called the
zero-width no-break space), and the line terminators `U+000A`, `U+000D`,
`U+2028` and `U+2029`.

It does **not** remove `U+0085` (next line), which Unicode counts as white
space but JavaScript does not trim: that character stays in the text and is
then refused as a control character (§3.1). A text that holds only trim-able
characters is empty after trimming, and is refused as empty.

### 3.5 The order of the checks

A reader applies its checks in this order. It is the order the reference reader
uses, and each step leans on the one before it; a reader that reorders them can
report a different problem for the same file.

1. **Check the size.** The decoded text is at most 20,000,000 UTF-16 code units
   (§2). A reader that starts from bytes **MAY** refuse early on the byte count,
   since 20,000,000 code units are at most 80,000,000 bytes of UTF-8.
2. **Decode UTF-8.** Bytes that are not valid UTF-8 make the file invalid, and
   so does a byte-order mark at the start of the file. The reference reader is
   handed text, so this step runs before it.
3. **Parse the JSON.** A file that is not JSON is refused here, with the rules
   of §2.
4. **Normalise each text to NFC.** A multi-line text first has every `\r\n` and
   every `\r` replaced by `\n`; the reference reader does that before
   normalising. A single-line text is left as it is, so a line break inside one
   is still there at step 8 and is refused.
5. **Trim** each text (§3.4).
6. **Check that it is non-empty.**
7. **Check its length** against the field's limit (§3.3).
8. **Check its characters** (§3.1).
9. **Check for a web address** (§3.2).

Steps 4 to 9 run once for each text in the document. The checks that compare
fields rather than read one text — unknown fields, the cross-references, the
counts — run as the objects that hold them are read, and the whole file is
refused if any of them fails.

## 4. Identity and updates

Three fields make a bundle who it is:

- `format` — always the string `mr-zaki-curriculum`.
- `formatVersion` — the integer `1`.
- `id` — a **lowercase UUID** (`8-4-4-4-12` hex groups), written once by the
  author and never changed.

`version` is the bundle's own version: an integer from 1 to 1,000,000. The
author **MUST** bump it on every export.

A file with the same `id` and a higher `version` is an **update of the same
curriculum**, not a new one. A reader that meets an update **SHOULD** replace
the stored curriculum in place and keep whatever progress hangs on it. A
reader **MUST NOT** treat a newer version as a reason to discard a child's
progress.

Updates work because everything carries a permanent id:

1. **Every object has an id.** A unit, a lesson, a skill, an exam, a paper and
   a part each carry an `id`, written once when the object is made and never
   changed. A reader matches the rows of a newer version to the old ones **by
   id**, never by number or position.
2. **What an id keeps.** An object whose id stays keeps the progress on it when
   it is renumbered, reordered, renamed, reworded, or moved to another place in
   its course (a lesson to another unit, say). Numbers are for display and
   order only.
3. **What an id ends.** An object whose id the newer version no longer has is
   deleted, and the progress on it is deleted with it. An object with a new id
   is new, even if its text matches an old one.
4. **A course is its grade, subject and teaching language** (§6.3). A course
   whose teaching language changes is a different course; progress does not
   follow it.
5. The bundle's `id` is stable. A file with a new `id` is a new curriculum,
   whatever its `version` says.

What a newer version means for a reader: more units, fewer units, corrected
facts, exams reworked. The file is the whole truth; nothing carries over except
what the reader keeps for itself (progress, and any practice it generated).

## 5. Untrusted input

A bundle is written by a stranger, and a reader is often an app used by
children. The following rules are **requirements**, not advice.

A valid bundle is not necessarily a correct one. The facts in it may be false,
an answer key may give the wrong answer, and an exam may be unlike the exam it
names. Conformance (§8) checks the structure and the rules of this document; it
says nothing about the truth of the content or the quality of the teaching.
Nothing here is relaxed because a file passed those checks: a reader **MUST**
keep treating every text as untrusted data, including the texts it passes to a
model it calls (item 4 below).

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

All limits on texts are in characters of the normalised, trimmed text (§3.3).
All integers are JSON integers; a non-integer where an integer is required is
a failure. **Marks** are numbers from 0 to 200 in half steps (0.5, 1, 1.5 …);
0.25 is refused. **Counts** are integers from 0 to 200.

### 6.1 The header (the root object)

Unknown fields are refused everywhere, including here.

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `format` | string | yes | exactly `mr-zaki-curriculum` | The format this file claims to be. |
| `formatVersion` | integer | yes | `1` | The version of the format. |
| `id` | string | yes | lowercase UUID, `8-4-4-4-12` hex | The stable identity of this bundle (§4). |
| `version` | integer | yes | 1–1,000,000 | The author's version of this file (§4). Bumped on every export. |
| `nameEn` | string | yes | 1–100 characters | The bundle's name, in English (or the author's first language). |
| `nameAr` | string | no | 1–100 characters | The same name in Arabic. Defaults to `nameEn`. |
| `author` | string | yes | 1–80 characters | Who wrote the bundle. Shown to the app's users as-is. |
| `rights` | string | yes | 1–300 characters | The author's rights sentence: who may use this, and on what terms. |
| `periods` | array of period | yes | at least 1 | The year structure (§6.2). |
| `courses` | array of course | yes | at least 1, at most 400 | One course per grade, subject and teaching language (§6.3). |

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

`wholeYear` is a statement about a period, not a shape of the tree. The
reference reader accepts it on a period at **any depth**, and a period that
carries it may still have child periods; nothing checks where it is used. It
relaxes no other rule: a unit may sit in that period only when the period is a
**leaf**, like any other period, and an exam may name it at any depth. A file
without any `wholeYear` is valid too; the flag is the author's statement, and
the format gives it no further consequence itself.

### 6.3 Courses

A course is one subject taught in one grade in one language. The same grade,
subject and teaching language may not appear twice in a file; the same subject
may appear twice in a grade when the two courses are taught in different
languages (maths in English and maths in Arabic).

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `grade` | integer | yes | −1 to 12 | The grade. −1 is the first kindergarten year, 0 is the second; 1 to 12 are school grades. |
| `subject` | string | yes | no limit beyond the file's | A subject id from the reader's own subject list (for example `science`). The format does not fix the list; the reader knows its own subjects and **MUST** refuse an unknown one. A subject id says what is taught, never in which language. |
| `language` | string | yes | an ISO 639-1 code (two lowercase letters) | The **teaching language**: what the lessons are written in, and the language the course is taught in. |
| `support` | array of string | no | 1–3 entries; each an ISO 639-1 code or `native`; no repeats; never the course's own `language` | Languages that may help the student beside the teaching language: to explain what the student hasn't understood, and to be understood when the student writes in them. `native` means the student's own home language, whatever it is. Absent means none. |
| `examStyle` | string | no | 1–8,000 characters, may be multi-line | How exams in this course are set, in the author's words, for what the structured `exams` cannot say. |
| `exams` | array of exam | no | 1–12; absent means no exams | How the exams are set (§6.4). Absent is the same as no key. An empty list is refused. |
| `units` | array of unit | yes | at least 1, at most 60 | The units of this course (§6.5). |

A writer **MUST** check the target reader's subject list, because a bundle valid
for one reader can be refused by another. `src/shared/format/subjects.json` in
this repository is the list the Mr. Zaki reader uses.

**Languages a reader can't teach in.** The format accepts every ISO 639-1 code
for `language`, `support` and a paper's `language`. Which languages an app can
actually teach in is the app's business, not the format's: a reader **MUST
NOT** refuse a bundle because of a language it cannot teach in yet. It **SHOULD**
keep such a course and show it as not available yet, so it works once the app
learns the language. A support language a reader cannot use is skipped.

### 6.4 Exams

An exam is one sitting: a period's test, or the whole year's, when `period`
is absent.

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `id` | string | yes | an object id (§4, §10) | The exam's permanent id, unique among the course's exams. |
| `period` | string | no | 1–40 characters | A period id of this bundle, at any depth. Absent means the exam covers the whole year. An id that is not a period of this bundle is a failure. |
| `name` | string | yes | 1–300 characters | The exam's name, in the language of the papers. |
| `papers` | array of paper | yes | at least 1, at most 6 | The papers of the exam (§6.4.1), in the order they are sat. |

#### 6.4.1 Papers

A paper is one sitting of one skill.

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `id` | string | yes | an object id (§4, §10) | The paper's permanent id, unique among the course's papers. |
| `name` | string | yes | 1–300 characters | The paper's name, in the paper's language. |
| `skill` | string | yes | one of `listening`, `reading`, `writing`, `speaking`, `written` | The skill the paper tests. |
| `language` | string | no | an ISO 639-1 code | The paper's language, when it is not the course's teaching language. |
| `minutes` | integer | no | 0–200 | How long the paper is. |
| `marks` | marks | no | 0–200 in halves | What the paper is worth. |
| `parts` | array of part | yes | at least 1, at most 8 | The parts of the paper (§6.4.2), in order. |

A paper without `language` is in the course's teaching language (§6.3).

#### 6.4.2 Parts

A part is what is read or heard, and what is asked about it.

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `id` | string | yes | an object id (§4, §10) | The part's permanent id, unique among the course's parts. Practice made for a part is stored against it, so an update that keeps the id keeps the practice. |
| `name` | string | yes | 1–300 characters | The part's name, in the paper's language. |
| `nameEn` | string | no | 1–300 characters | The same name in English, for the line under a title in the teaching language, when that language is not English. |
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

`kind` says what a part reads or hears; it does not limit the other material
fields. The reference reader accepts `description`, `words`, `speakers`,
`topic`, `layout` and `timing` beside any `kind`, `none` included, and checks
only that `kind` is one of the list and that `other` carries a `description`.

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
| `answerWords` | array of two integers | no | both 0–5,000; the first no larger than the second | How long the answer must be, in words: the shortest and the longest (a writing task). |
| `marksEach` | marks | no | 0–200 in halves | What every question is worth, when they are all worth the same. |
| `marksByType` | object | no | keys are known question types; values are marks 0–200 in halves | What a question of each type is worth, for papers that mix them. Unknown keys are refused. |
| `totalMarks` | marks | no | 0–200 in halves | What the questions are worth in all. |
| `example` | boolean | no | — | The paper prints a worked example, already answered. |
| `copiedExactly` | boolean | no | — | Answers are copied word for word from the text or the recording. |

Question types: `choice`, `truefalse`, `gap`, `short`, `form`, `yesno`,
`match`, `picture`, `multi`, `truefalse-justify`, `extract`, `essay`,
`calculation`, `labelling`, `ordering`, `other`.

The numbers here are the paper's own statement, and the format does not refuse
a file whose numbers disagree: one mistyped mark should not block a whole
curriculum, so a writer **SHOULD** warn about a mismatch instead. Because they
may disagree, every reader reads them by the same rule:

- **How many questions** a part has is the larger of `count` and the sum of
  the counts in `types`. The types are the kinds a paper must have, so fewer
  typed questions than `count` leaves the rest of any kind; more typed
  questions than `count` means the types decide.
- **What a part is worth** is, in this order, the first that is present: the
  part's own `marks`; `totalMarks`; the sum over `types` of each type's count
  times its `marksByType`; `marksEach` times the number of questions above.
  `marksEach` and `marksByType` may appear together; `marksByType` wins, as
  the order says.
- A reader **MUST NOT** assume that the parts' marks add up to the paper's
  `marks`, that `choiceOptions` comes with a choice question, or that
  `maxWords` and `answerWords` agree.

### 6.5 Units

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `id` | string | yes | an object id (§4, §10) | The unit's permanent id, unique among the course's units. |
| `number` | integer | yes | 0–99; unique in the course | The unit's number, for display and order. It may change; the id doesn't (§4). |
| `period` | string | yes | 1–40 characters | The id of a **leaf** period of this bundle. A unit may not sit in a period that has children. |
| `title` | string | yes | 1–150 characters | The unit's title. |
| `source` | string | no | one of `sheet`, `provisional`; default `sheet` | Where the unit came from: the author's own sheet, or a provisional outline. |
| `keywords` | array of string | no | at most 40; each 1–400 characters | The key words of the unit. Absent means none. |
| `evidence` | array of string | no | at most 40; each 1–400 characters | Where the unit's content can be checked against (in the author's words). Absent means none. |
| `lessons` | array of lesson | yes | at least 1, at most 40 | The lessons of the unit (§6.6), in order. |

### 6.6 Lessons

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `id` | string | yes | an object id (§4, §10) | The lesson's permanent id, unique among the course's lessons. |
| `number` | integer | yes | 0–99; unique in the unit | The lesson's number, for display and order. It may change; the id doesn't (§4). |
| `title` | string | yes | 1–150 characters | The lesson's title. |
| `skills` | array of skill | yes | at least 1, at most 20 | What the student can do after the lesson (§6.7), in priority order. |
| `facts` | array of string | no | at most 25; each 1–400 characters | The plain facts the lesson teaches, as any textbook would state them. Absent means none. |
| `activity` | string | no | one of `writing`, `reading` | The lesson's main activity, when the author wants to say so. |

### 6.7 Skills

A skill is an object:

| Field | Type | Required | Limits | Meaning |
|---|---|---|---|---|
| `id` | string | yes | an object id (§4, §10) | The skill's permanent id, unique among the course's skills. |
| `code` | string | no | 1–20 characters | A code for the skill, for example a syllabus code. |
| `text` | string | yes | 1–300 characters | The skill statement: what the student can do. |

### 6.8 Lists of texts

`keywords`, `evidence` and `facts` are lists of short texts. Each obeys §3.
Absent means an empty list; an empty list is fine.

## 7. What a valid bundle is

A **valid bundle** is a file that passes every check in this document and in
the JSON Schema. `src/shared/format/bundle.ts` in this repository is the
reference reader: a working reader that follows this text. Where it and this
text disagree, this text is meant to win, and the disagreement is a bug to
report. `examples/EXPECTED.md` lists what the reference reader says about each
example.

1. §2: the file is UTF-8 JSON, at most 20,000,000 characters, top level one
   object.
2. §3: every text, once normalised to NFC and trimmed, is non-empty, within
   its limit, and free of forbidden characters and web addresses.
3. Unknown fields are refused, everywhere. In objects whose keys are fixed
   (the header, a period, a course, …) every key must be a defined field; in
   `types` and `marksByType` every key must be a known question type.
4. The JSON Schema (`schema/bundle-v1.schema.json`, draft 2020-12) accepts the
   file: the shapes, the required fields, the types, the enumerations, the
   integer and marks ranges, and the per-field limits it can express.
5. "Rules beyond the schema", below, all hold.

The schema in this folder carries **no `$id`**, so it has no canonical URI of
its own: this document names it by its path here,
`schema/bundle-v1.schema.json`, and its `$ref`s are local to the file. Canonical schema addresses are not
published yet; a reader loads the schema file it was given rather than looking
one up by URI.

### Rules beyond the schema

These rules cannot be written in the JSON Schema. They are part of the format,
and a conforming reader **MUST** enforce them:

- The **file size** limit (§2): 20,000,000 characters, checked before parsing.
- **Duplicate keys** (§2): no object writes a key twice, checked on the text.
- The **total number of periods**: at most 60 in the whole tree (the schema
  bounds each list, not the sum).
- The **character rules** (§3.1): the refused categories and the allowed
  exceptions. The schema can bound a string's length, not its characters.
- The **web-address rule** (§3.2): no text may contain one.
- **Normalisation**: every text is normalised to NFC and trimmed **before**
  the length and content checks, so a padded text is valid and is read trimmed
  (§3).
- **Cross-references**:
  - A unit's `period` is a **leaf** period of this bundle.
  - An exam's `period`, when present, is **some period of this bundle, at any
    depth**.
  - Object ids (units, lessons, skills, exams, papers, parts) are unique among
    their own kind within a course; two courses may use the same id.
  - Period ids are unique in the whole tree.
  - Unit numbers are unique in a course; lesson numbers are unique in a unit.
  - A grade, subject and teaching language appear together at most once per
    file.
  - A course's `support` never repeats an entry and never names the course's
    own `language`.
- The material kind `other` **requires** a `description`.
- `answerWords` and a material's `words`, when present, each hold exactly two
  integers, and the first is no larger than the second (§6.4.3, §6.4.4).
- A multi-line text may contain `\n`; a single-line text may not (§3).
- **Exam numbers**: `count`, `types`, `marksEach`, `totalMarks`, the parts'
  marks, `choiceOptions`, `maxWords` and `answerWords` are separate statements.
  The format does not refuse a file whose numbers disagree; every reader reads
  them by the rule in §6.4.4.
- An absent `nameAr` on the header or a period defaults to the matching
  `nameEn`; an absent `source` defaults to `sheet`; an absent `wholeYear`
  defaults to `false`; absent `exams`, `facts`, `keywords`, `evidence` default
  to an empty list; an exam without `period` covers the whole year; an absent
  `activity` means the author did not say.

### Invalid examples

The `examples/` folder carries eight refused files and says why
(`examples/README.md`). All are refused by the rules above; some pass the JSON
Schema and break only a rule beyond it (a web address, a support language that
repeats the teaching language, a duplicate key, a text over its limit in UTF-16
code units), and the others fail the schema too.
`examples/EXPECTED.md` lists every example, its verdict, and the path and
message the reference reader reports for it.

## 8. Conformance

### A conforming reader

A reader is any program that reads bundles. A conforming reader:

- **MUST** check the file size before parsing (§2).
- **MUST** refuse a file that is not valid JSON, or whose top level is not one
  object.
- **MUST** normalise every text to NFC and trim it **before** the other
  checks, then check non-empty, the limit, the characters, and the web
  addresses (§3).
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
- **MUST** give every unit, lesson, skill, exam, paper and part an id when it
  is made, and **MUST** keep that id in every later version (§4).
- **MUST NOT** put a web address, or a forbidden character, in any text.
- **MUST** write every text already normalised to NFC and trimmed (§3).
- **SHOULD** check its own output with a validating reader before export.

A reader and a writer that both conform interoperate on any valid file.

## 9. Versioning of the standard

This section is about the standard, not about a bundle's own `version`.

Version 1 is stable. The following changes **keep the current version**:

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
this standard accepts `formatVersion` 1. The drafts before it (published in
2026 as versions 1 and 2, with the teaching language taken from the subject id
and no object ids) are withdrawn: their files are refused, and an author
exports them again from the tool that made them.

## 10. The limits, at a glance

The table below gathers the limits the sections above give. These limits are
what make a file from a stranger cheap to check: the schema fixes the shape and
the nesting depth, unknown fields are refused (§2), and every list has a cap
here, so the number of objects and texts a reader can be made to visit is fixed
before it reads a single value. The file-size limit (§2) bounds the file as a
whole, and these per-field limits bound the work on each text in it.

Every limit on a text in the table counts UTF-16 code units of the normalised,
trimmed text (§3.3), and the whole-file limit counts them too.

| What | Limit |
|---|---|
| Whole file | 20,000,000 characters |
| Bundle `version` | 1–1,000,000 |
| Courses per file | 1–400 |
| Periods per tree | at most 60, at most 3 levels deep |
| Period ids and object ids (units, lessons, skills, exams, papers, parts) | 1–40 characters, `^[a-z0-9-]+$` |
| Teaching and paper languages | an ISO 639-1 code |
| Support languages per course | 1–3; ISO 639-1 codes or `native` |
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
