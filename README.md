# Mr. Zaki Studio

The desktop app for parents and tutors that turns their own material (books, sheets, exams,
recordings) into a curriculum file that Mr. Zaki imports. It makes a project folder or opens
one, shows it as a tree, drops, pastes, moves, renames and views files, sorts the Inbox,
opens the material and curriculum already built, finds and reads new material with local OCR,
writes one study note per file with the author's own OpenRouter key or with the author's own
AI tool through a job folder, shows the curriculum with every fact's page beside it, and
exports a bundle. It runs on your computer: it calls no server of ours, and the only network
call it can make is your own note or change-set request to OpenRouter, with your own key.

## Download and install

Installers for Windows and Mac are on the
[releases page](https://github.com/boyoot-dev/zaki-studio/releases). The installers are **unsigned**
for now, so both systems ask for your say-so the first time you open the app:

- **Windows** — SmartScreen shows "Windows protected your PC". Click **More info**, then
  **Run anyway**. The app is per user, so no administrator rights are needed.
- **Mac** — Gatekeeper shows "cannot be opened because the developer cannot be verified".
  Right-click (or Control-click) the app in Applications and choose **Open**, then **Open** in
  the dialog; or go to **System Settings → Privacy & Security** and click **Open Anyway**.

If you can't run the installer, see "Building from source" below.

## Privacy in plain words

Your files stay on your computer. The Studio reads them where they are and writes only into
the project's hidden `.studio/` folder. The only network call it ever makes is the one you
ask for: when you write notes or a change set with an OpenRouter key, the request goes from
your computer to OpenRouter with your key, and the material travels as the message content.
Your key is kept encrypted on this computer (Electron's safeStorage) and the page never sees
it. Nothing is uploaded anywhere else, and there is no telemetry.

## What it does

- Makes a project folder (or adopts one you already have), from a wizard that asks for the
  name, author, rights, the year's periods, grades and subjects.
- Shows the folder as a tree; drops, pastes, moves, renames and deletes (to the Recycle Bin)
  files and folders; sorts the Inbox; opens the material it has built or found.
- Views PDF, Word, PowerPoint, text and pictures side by side with the notes and facts.
- Finds new PDF, Word and PowerPoint files, registers them the way Mr. Zaki's pipeline does
  (the id is the first twelve hex digits of the file's SHA-1, so a moved file keeps its id),
  reads their text, and reads picture pages with local OCR.
- Writes one study note per file, with your OpenRouter key or with your own AI tool through
  a job folder; shows the cost before a run and stops at a limit.
- Proposes changes to the curriculum (the new or confirmed units with their lessons, skills
  and facts) for you to review; accepts, rejects or edits per unit or lesson.
- Proposes a course's exam papers from its exam papers' and mark schemes' notes (papers,
  parts, timing, marks, question types and a writing task's answer length); accepts, rejects
  or edits per paper.
- Exports the bundle that Mr. Zaki imports, checked by the same validator the app uses.

## Building from source

Node 22 or newer. Windows is the first target; the app is Electron, so macOS needs a build of
its own.

```sh
npm install        # the first time; .npmrc explains its one setting
npm run dev        # opens the app on Windows
```

| Command | What it does |
|---|---|
| `npm run dev` | Electron with hot reload for the page |
| `npm run build` | builds `out/main`, `out/preload` and `out/renderer` |
| `npm test` | unit tests (paths, the granted folders, the project file, the wizard's plan, the files, the window, the PDF settings, the model and its bundle, adoption, the register, the text, the zip limits, the reader window's two calls, the OCR settings, a whole scan on disk, the panes, the notes' rules and headers, the job folder, the key's keeping, the IPC surface, a notes run with a fake asker, a change set's checks and merge, a units job on disk, a units run with a fake asker, an exam change set's checks and merge, an exams job on disk and an exams run with a fake asker) |
| `npm run check` | Biome lint and format (`npx biome check --write` to fix) |
| `npm run typecheck` | TypeScript, no output |
| `npm start` | runs a build, for checking what an installer will ship |
| `npm run tessdata` | downloads Tesseract's `ara`, `eng` and `fra` files into `resources/tessdata/`, checking each SHA-256 (once per computer; also run before packaging) |
| `npm run dist:win` | builds `dist/`: an unsigned NSIS installer, x64, per user, with Start-menu and desktop shortcuts |
| `npm run dist:mac` | builds `dist/`: an unsigned `.dmg`, universal |
| `npm run material-check -- <materials> <work>` | compares the Studio's register, text and OCR with a work folder's `index.csv`, `text/` and `pages/`; writes nothing |
| `npm run notes-trial -- <materials> <work> <ids…> --out <folder> [--key] [--model <id>]` | writes a job folder and the pipeline's existing notes for a few files into a folder outside the repository, and with `--key` the Studio's notes too; calls no model without `--key` |
| `npm run units-trial -- <project> <grade> <subject> <period> --out <folder> --work <folder>` | writes a units job for a period whose units the owner already has, with the existing facts set aside, and prints today's units beside the change set once the tool has written it; calls no model |
| `npm run bench-project -- <folder> [files=35000]` | makes a synthetic project in an empty folder of that size (KG-12 at 35,000 files): tiny PDFs, the register, most files' texts, ~5% notes, and a model; invents everything |
| `npm run bench -- <project>` | times the calls behind each IPC handler directly (open, model, the tree, notesState, scanState, the report, the changes list, the curriculum view's data) and reports the longest stall during a scan of known files; prints a table |

Releases are built by GitHub Actions from a `v*` tag, on `windows-latest` and `macos-latest`;
the installers are attached to the release. The workflow needs only `contents: write`.

## The project is a folder

A project is one curriculum in one folder. The wizard makes it; the author can also drop files
into it from Explorer and the tree follows.

```
Sunrise Curriculum/            the project
  curriculum.json              name, author, rights, the year's periods, grades and subjects
  Inbox/                       dropped or pasted files wait here to be sorted
  Grade 7/
    Science/
      Units/                   01 Classification/, 02 Cells/ …
      Books/
      Extra/
      Exam/
        past-papers/
        listening-samples/
        reading-samples/
  .studio/                     the Studio's memory (hidden on Windows): the model, the
                               register, each file's text, the pages' pictures and OCR
                               readings, the last scan's report, the notes (and their usage
                               log), the job folders, the exports
```

`curriculum.json` keeps each folder's name, so a folder renamed by hand in Explorer (or named
in Arabic) stays mapped to its grade and subject. Its periods are the bundle's own period
shape, so export is a copy rather than a translation. The Studio's recent-projects list lives
in the app's user-data folder, never in a project: sharing a project folder shares nothing
about who opened it. The widths of the panes are kept there too, by the width the window had,
so a project folder carries no trace of how anyone arranged it.

## How the code is laid out

```
src/main/       the main process: the window, the dialogs, the granted folders, the files,
                the folder watch, the scan (register, reading, OCR, the hidden reader), the
                notes (the key, OpenRouter, the run), the job folders, the change sets
                (their files, the units request, the merge), and the exam change sets
                (their files, the exams request, the merge)
src/preload/    the small typed APIs: the page's (window.studio) and the reader's two calls
src/renderer/   React: start screen, wizard, tree, viewers, Inbox, the New material panel,
                the panes' borders, the Notes tab, the Changes tab, both languages; and the
                hidden reader page
src/shared/     the project file, the model and its bundle, adoption's decisions, the
                register's rules, the text format, the notes' rules and the job's words, a
                period and its change set, a course's exam change set, the path guard, the
                panes' widths, the words, the APIs' types, the format copies (format/)
scripts/        two build-time plugins (the subject list, the page's policy), the icon,
                the language data's download, the material check, the notes trial, the units
                trial, the dist wrapper
resources/      the icon the window and the installer show, the rules the model gets
                (`rules/note-rules.md`, `rules/unit-rules.md` and `rules/exam-rules.md`), the
                Tesseract worker (`ocr-worker.cjs`), and the language data `npm run tessdata`
                fetches (ignored by git); `npm run icon` makes the icon
```

`src/shared/format/` is the reference reader of the bundle format (`bundle.ts`, `grades.ts`,
`web-address.ts` and the subject list). It reads version 1 and version 2 of the format. This
repository is its home. Apps that read bundles, such as Mr. Zaki, copy these files byte for
byte from a tagged commit here, so the Studio and the apps can never disagree about what a
valid file is. Change them here, never in a copy.

## Opening an existing curriculum built elsewhere

"Open my existing material" adopts an already-built curriculum as one project. The curriculum
files give the units, lessons, skills, facts, key words, evidence, exam style and exams. Each
fact keeps the pages it came from and its status; a `reviewed` fact is the author's own.
Only `curriculum.json` and `.studio/` are written, both in the materials folder; the work
and curriculum folders are read only, and nothing is moved, renamed or re-read. A second
adopt of the same folder opens the project it already is.

## New material

"Look for new material" scans the whole project (never `.studio/` or the Inbox) for PDF, Word
and PowerPoint files, and registers each one the way Mr. Zaki's pipeline does
(`src/shared/register.ts`): the id is the first twelve hex digits of the file's SHA-1, so a
copy is a row with `dupOf` and a moved file keeps its id; a file whose path, size and modified
time are unchanged is not even hashed. Grade, subject, block, kind, year and authority come
from the folders, `_subjects.csv`, `_sources.csv` and the file's name, and the author can
correct any of those five in the file's details: a corrected field is kept when the project is
scanned again.

Each new file's text is written to `.studio/text/<id>.md` in exactly the pipeline's format —
`# <path>`, then `## Page N` per page — by `src/main/read.ts`: PDF pages come from pdf.js's
text layer, Word from mammoth, PowerPoint one page per slide from the zip's own XML
(`src/main/zip.ts`, which refuses an entry that inflates past 50 MB or an archive of more than
2,000 entries). A page with fewer than 40 characters is a picture page, and so is a page with a
picture and fewer than 400 characters.

Picture pages are drawn at 110 DPI by a hidden reader window (`src/main/render.ts`,
`src/renderer/reader.ts`): sandboxed, isolated, no Node, the same strict policy, no network,
and a preload with exactly two calls (`src/shared/reader.ts`) — one receives a file's bytes and
a page number, the other returns the PNG. The window never sees a path, and the main process
checks the picture is a sensible PNG (`src/shared/png.ts`) before writing it to
`.studio/pages/<id>/pNNN.png`.

Tesseract reads each picture page in the main process (`src/main/ocr.ts`): `tesseract.js`
7.0.0 with `--psm 4`, the subject's teaching language plus English (`ara+eng`, `fra+eng`, or
`eng` alone), at most four workers. The language files, the WASM core and the worker all come
from local paths, the cache is off, and nothing names a server. The language files are fetched
once by `npm run tessdata` from the official tesseract-ocr repositories at tag 4.1.0 and are
checked by SHA-256 before they are kept; they are also shipped inside the installer, so an
installed app works offline and never downloads anything. A missing file makes the panel say
"run npm run tessdata" rather than stopping the scan.

The reading goes into the text in the marker's place, as the pipeline writes it
(`[ocr of image: …]`, with `[arabic: check against the page]` above an Arabic reading), and is
kept beside the picture as `pNNN.ocr.txt`, so a stopped scan continues where it stopped. The
last scan's report stays in `.studio/new.json` and is shown in the New material tab: the new
files by grade, subject and block with their kind, year, date, authority and pages; the units
each block touches; and what needs a look (no subject, no grade, a read error, a copy). A scan
shows its progress and can be stopped. Nothing in the material is moved, renamed or written:
only `.studio/` is, and every path goes through `insideProject`/`safePath`.

The tesseract.js worker is started through `resources/ocr-worker.cjs`, the Studio's own small
file: on Node 22 the engine claims relaxed SIMD, and that WASM core aborts on the float models
(tessdata_best) — `missing function: tesseract::DotProductSSE`, found 2026-11-13, reported as
naptha/tesseract.js#1080. The file hides relaxed SIMD from the feature test, so the plain
SIMD core reads them.

## Notes

Each file gets one study note, written from its whole text and its unread picture pages, the
way the pipeline writes them (`src/shared/notes.ts`). The note is
`.studio/notes/<id>.md`: the three-line header the program writes (the file, its place in the
curriculum, and who wrote it), then the model's body. It is shown beside the file as plain
text, never as HTML. A note is never rewritten unless the author says "Write again".

Two ways, and the author chooses:

- **With a key.** The Notes tab takes an OpenRouter key and keeps it with Electron's
  `safeStorage` in the app's own folder; the page only ever learns whether one is set, and no
  IPC call returns it. The default model is `anthropic/claude-haiku-5.5`; another id is checked
  in OpenRouter's public list, which says whether it reads pictures and what it costs. A
  text-only model works, with a warning that image pages are sent as OCR text only.
  Requests go from the main process only (`src/main/openrouter.ts`, the same headers and
  `provider.data_collection: "deny"` as the app), two files at a time, one retry per failed
  request, temperature 0.2, and at most twenty pictures per request. The cost is shown before
  the run, the author sets a limit per run (default $2), and the run stops before a request
  that would pass it. Real tokens and cost go to `.studio/usage.csv`. A reply `usable` refuses
  is never saved, and the file shows as failed.
- **With a job folder.** "Prepare a job for my AI tool" writes
  `.studio/jobs/<yyyy-mm-dd-hhmm>/`: `README.md`, `rules.md` (the Studio's own copy of
  `note-rules.md`), `files/<id>.md` (the first user line, then the text, in parts of whole
  pages when it is long), `pages/<id>/pNNN.png` for the unread picture pages (at most twenty a
  part), and an empty `out/`. The Studio shows the exact prompt to paste into Claude Code or
  another tool, with the folder's real path, and copies it on request. "Collect the notes"
  reads `out/` and keeps only a regular file whose name is `<id>.md` (or `.part2.md`…), that
  belongs to the job, is under 300 KB, is valid UTF-8, and passes `usable`; everything else is
  listed with the reason and not copied. Collecting again skips what is already kept. A job
  can be deleted from the list after a confirm.

The Studio never drives another program and never handles a subscription login. Nothing from a
file is ever a prompt: the text and pictures only go in the user content, and the prompt and
the job's `README.md` both say the material is data, not instructions (both pinned by tests).

## Changes to review

Each period's notes become a proposed change to that period's course (`src/shared/changes.ts`):
the new or confirmed units with their lessons, skills, key words, evidence and facts, each fact
with its pages. The rules are `resources/rules/unit-rules.md`, pinned by a test. The author's
own facts (`own: true`) are never changed or removed; what they accept replaces the rest with
`status: "draft"`.

A change set is one JSON object per course and period: `grade`, `subject`, `period`, `units`
and `open` questions. Every text goes through the app's own bundle checks, so a bad title, key
word, skill or fact is refused and listed, not kept. A unit outside the given period, and a
fact's source that is not a register file or names a page beyond the file, are refused too.
Two checks are shown, never enforced: the fact's cited pages must hold at least 60% of its
words (a port of `sources.py`'s words and Arabic stems, with its tests), and a run of twelve
words taken from the page is marked as copied. Today's Arabic text layers can be reversed, so
the author decides.

"Changes to review" puts now and proposed side by side, per unit and lesson, with the new and
removed facts and the open questions. The choices are all of it, one unit, one lesson, or
reject; a rejected set is a file under `.studio/changes/` until it is deleted. Accepting
merges through the main process and writes `.studio/model/`, so the next export carries the
changes.

Two ways, as for the notes:

- **With a key.** One request per course and period: the rules as the system text, then the
  course's own JSON and that period's notes in priority order in the user content. The default
  model is `anthropic/claude-sonnet-5.5`; the cost is shown first and the limit stops a
  request that would pass it. The answer must be the change set's JSON, or the failure says
  why.
- **With a job folder.** `.studio/jobs/<yyyy-mm-dd-hhmm>/` holds `README.md`, `rules.md`,
  `courses/<grade>-<subject>-<period>/` (its `course.json`, `period.txt` and `notes/` numbered
  in priority order) and an empty `out/`. The prompt is fixed in `src/shared/job.ts` and
  pinned by a test. Collecting refuses a wrong name, a link, a non-file, 2 MB or more, bytes
  that are not UTF-8, and JSON that is not a change set; collecting again skips what already
  waits for review.

Unit jobs share `.studio/jobs/` with notes jobs; each folder's own `job.json` says which kind
it is, so each panel lists only its own.

## Exams from notes

Each course's exam papers and mark schemes have notes too, and those notes become the course's
proposed exam papers (`src/shared/exam-changes.ts`). The input is the notes of the register
files whose kind is `exam` or `mark-scheme`, newest academic year first and then by authority,
and only the newest three academic years: the older years are left out and the request says
which they were. A year's question paper and its mark scheme go together, and the course's
current `exams` travel with the request so a part keeps its `id`.

The model answers with the course's whole `exams` list in the bundle's own shape (format 2, so
`answerWords` is allowed), a `sources` map from each part id to the register file ids it was
read from, and `open` questions where the papers disagree. Every exam goes through
`parseCourseExams`, so a writing task whose answer length runs backwards is refused with its
path; every part needs at least one source, and a source must be an exam paper or mark scheme
of that course, not a worksheet. The rules are `resources/rules/exam-rules.md`, pinned by a
test: describe the format, never copy a passage or question, the newest year decides, and a
writing task's printed length (`"من ٣٠٠ إلى ٤٠٠ كلمة"`) becomes `questions.answerWords` `[300,
400]`.

"Changes to review" shows an exam set beside the course's papers, paper by paper and part by
part, with the fields that changed (`minutes 70 → 75`, `answerWords — → 300–400`) highlighted
and the open questions listed. The choices are all of it, one paper, or reject. Accepting an
exam set merges through the main process and writes `.studio/model/`, so the next export
carries the new papers; a paper the author did not accept stays exactly as it was. A rejected
set is kept as a file under `.studio/changes/` until it is deleted, as for units.

Two ways, as for the notes and units:

- **With a key.** One request per course: the rules as the system text, then the course's own
  exams JSON and its exam notes newest year first in the user content. The default model is
  the units step's; the cost is shown first and the limit stops a request that would pass it.
- **With a job folder.** `.studio/jobs/<yyyy-mm-dd-hhmm>/` holds `README.md`, `rules.md`,
  `courses/<grade>-<subject>/` (its `course.json` with the exams, and `notes/` numbered in
  priority order) and an empty `out/`. Answers go to `out/<grade>-<subject>.json`. The prompt
  and README are fixed in `src/shared/job.ts` and pinned by tests. Collecting refuses a wrong
  name, a link, a non-file, 2 MB or more, bytes that are not UTF-8, and JSON that is not an
  exam change set; collecting again skips what already waits for review.

Exam jobs share `.studio/jobs/` with notes and units jobs; each folder's own `job.json` says
which kind it is, so each panel lists only its own.

## The Curriculum tab and export

The Curriculum tab shows grades → subjects → units (with their period) → lessons, with
skills and then facts in order. Every fact shows chips for its files and pages, named from
the register; a click opens the original in the pane beside the facts, a PDF at that page and
another file with the page's text from `.studio/text/` under it.

The borders between the grades, the facts and the page can be moved: drag one, use the arrow
keys (16 px at a time, the other way in Arabic), or double-click it to go back to the default.
The source pane has a button that puts it away and brings it back. The widths come back with
the next start.

"Export curriculum…" shows what the file will hold (courses, units, lessons, facts, exams)
and the version (the last copy's plus one). The author's name and rights sentence are asked
for when the project still lacks them. The bundle is checked by the app's own `parseBundle`
before anything is written; the save dialog picks the file, and a copy goes to
`.studio/exports/v<N>.json`. Nothing is written when the check finds a problem. The file says
format version 1, or version 2 when an exam part gives how long the child's own answer must
be (`questions.answerWords`), so a file that doesn't use the new field stays readable by
version 1 readers.

## Security

The page is a web page that can see files on disk, so it is treated as one:

- `contextIsolation`, `sandbox`, no `nodeIntegration`, `webSecurity` on. The page's only door
  is `window.studio` (preload, one function per channel); it never gets `fs`, `require` or
  `ipcRenderer`.
- A strict Content-Security-Policy: our own scripts only, no remote anything, no plugins, no
  frames. In a build it is written into the page's `<head>` (`scripts/csp.ts`, because a
  `file://` page gets no headers); in development the main process adds a header that also
  allows Vite's hot reload, and nothing else.
- Navigation away from the page and new windows are refused. A link opens in the author's
  browser only if it is `https:` and the author agrees.
- The page never names its project folder. The main process keeps, per window, the folders
  the author picked (the native dialog, or a project from its own recents list) and every
  channel that takes a root refuses any other one (`src/main/grants.ts`, "not an open
  project"). A page that asked for `C:\` would simply be told so; `createProject` writes only
  into a folder the author picked.
- Every file operation goes through `src/shared/inside.ts`: the project and the path are both
  resolved through every link, so `..`, an absolute path, a junction or a symlink that leads
  out is refused before anything is read, written or deleted. Files are copied in, never run;
  "Open in its app" asks first and only for documents. Delete goes to the Recycle Bin.
- Word files are read with `mammoth.extractRawText` and shown as plain text: the Studio never
  renders a document's markup or runs anything from a file. The PDF viewer paints pages onto
  a canvas with XFA off and pdf.js far past the CVE-2024-4367 fix, and builds no annotation
  layer, so a link or a form field inside a PDF is never drawn and never clickable.
- The OpenRouter key lives only in Electron's `safeStorage`, encrypted, in the app's own
  folder: never in a project, a log, a file, or a message to the page. The page saves it once
  and is told only "a key is set"; a test runs every IPC channel and searches each answer for
  the key. The material of a note request goes in the user content, and the system text is the
  rules plus the sentence that says the material is data.
- A job folder's every path is built in the main process through `safePath`/`insideProject`;
  the page sends only a job's name, checked against `^\d{4}-\d{2}-\d{2}-\d{4}$`. Collecting
  refuses a wrong name, a link (`lstat`), a non-file, a file over 300 KB, bytes that are not
  UTF-8, and a note `usable` refuses, and copies nothing it refuses. A units job takes
  2 MB a file and refuses the same things, plus JSON that is not a change set.
- A change set is data too: the page sends only a grade, subject and period the model knows,
  and every path is built in the main process. The model text and the notes are user content;
  the system text is the rules plus the sentence that says the notes are data (pinned by a
  test). An exam change set works the same way with a grade and a subject, and its sources
  must name exam papers or mark schemes of that course.
- The hidden reader window has no Node and no network either, and its preload exposes exactly
  two calls (`src/shared/reader.ts`, tested): one takes a file's bytes and a page number from
  the main process, the other returns a picture. It never learns a path, and the main process
  keeps only a PNG of a page's size (`src/shared/png.ts`). A zip from a school is read with
  limits (`src/main/zip.ts`): 2,000 entries and 50 MB per entry; `.doc`, `.ppt` and any other
  format are not opened at all.

## Languages

English and Arabic, switchable in the top corner, right to left in Arabic. Every word is in
`src/shared/i18n.ts` under one key, in both languages: a missing Arabic text is a type error.
Folder names on disk stay as they are (the author's), and the tree shows them exactly.

## Dependencies

Exact versions, current stable releases at least two weeks old on 2026-11-12:

| Package | Version | Why |
|---|---|---|
| `electron` | 45.1.0 | the desktop app |
| `electron-vite` | 6.0.0 | builds main, preload and page with one config, and keeps the preload CommonJS, which sandboxing needs |
| `electron-builder` | 26.18.0 | builds the unsigned installers (`npm run dist:win`, `npm run dist:mac`); dev only |
| `vite` | 8.3.5 | electron-vite's peer and its build engine |
| `react`, `react-dom` | 19.3.1 | the page |
| `@vitejs/plugin-react` | 6.1.2 | React with hot reload |
| `typescript` | 7.0.2 | types |
| `vitest` | 5.0.5 | tests |
| `@biomejs/biome` | 2.4.5 | lint and format, the same version as `app/` |
| `pdfjs-dist` | 6.4.299 | the PDF viewer |
| `mammoth` | 1.13.0 | Word files, `extractRawText` only |
| `tesseract.js` | 7.0.0 | reading picture pages on this computer; its worker is started through `resources/ocr-worker.cjs` (see "New material") |
| `@types/react`, `@types/react-dom` | 19.3.0 | the type packages for the two React packages above |

Folder watching uses Node's own `fs.watch({ recursive: true })`. Nothing else is installed:
no icon set, no CSS framework, no clipboard library.

## Not in this build

Units, lessons, skills and facts, and a course's exam papers, from notes are built in the
Changes tab; guides, audio transcription, other providers than OpenRouter (the job folder
covers any AI tool), `.doc` and `.ppt` (the old formats), watching a project folder while the
Studio is open, the coverage map, editing in the Curriculum view, rebuilding, and the import
button are not in this build.

## Developer notes

- The trials (`notes-trial`, `units-trial`) and `material-check` are the architect's tools
  for measuring the Studio against already-built curricula. Their folders are required
  arguments; nothing is copied into the repository, and nothing they read is written back.

The design notes and task briefs are kept privately by the maintainer.

## Licence

The Studio is **source available**, not open source. You may install and use the released
Studio free, for any purpose, and the curricula you make are yours. You may read this code
and build it to check a release. Copying, changing, redistributing or reusing the code
needs written permission. See [LICENSE](LICENSE). The bundle standard in
[`standard/`](standard/) has its own, open licences: the text under CC BY 4.0, and the
schema and examples under MIT. Other people's software in the Studio is listed in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
