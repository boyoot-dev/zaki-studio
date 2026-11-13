# Task 168 — Done notes: the Studio on a full curriculum (KG–12)

Branch `task/168-fast-on-a-full-curriculum`, based on `e7f2f0c`.
All measurements were made on this Windows machine, on synthetic projects that
`scripts/bench-project.ts` generated in a temporary folder (invented names, invented words,
invented dates; no real material was read or written anywhere):

- **7,000 files** — about the owner's three grades (files.json 3.0 MB, 6,027 text files, 337 notes).
- **35,000 files** — a full school (KG1–12, 8 subjects per grade; files.json 15.4 MB, 30,571 text files, 1,706 notes, a model of 16,128 facts).

Both projects are outside the repository, in a temp folder. To make them again:

```sh
npm run bench-project -- <folder> [files=35000]
npm run bench -- <project>
```

## The four checks, last lines (run after the final change)

```
npm test          Test Files  37 passed (37)   Tests  361 passed (361)   Duration  1.67s (tests 73%, import 16%, transform 7%, worker 3%)
npm run check     Checked 123 files in 107ms. No fixes applied.
npm run typecheck (no output, exits 0)
npm run build     ✓ built in 117ms
```

## Before / after — at 7,000 files

Bench calls go through the main-process functions behind each IPC handler, without Electron.
**Before** = median of 5 with no cache anywhere: every call re-read and re-parsed from disk.
**After** = first call of a fresh process, then median of 5 (the cache is warm after the first).

| Call | Before (median) | After (first) | After (median) | After reply |
|---|---|---|---|---|
| open | 123 ms (924 KB) | 4 ms | 2 ms | 3 KB |
| model (the whole model + the register) | 21 ms (3,589 KB) | 12 ms | 1 ms (heads: 2 KB) | 2 KB |
| listTree (top) | 126 ms (922 KB) | 1 ms | 1 ms | 0 KB |
| listTree (deep, `Grade 10/Arabic`) | 6 ms (33 KB) | 4 ms | 4 ms | 0 KB |
| notesState | 14 ms (4,913 KB) | 23 ms | 0 ms | 0 KB |
| scanState | 35 ms (7,607 KB) | 23 ms | 0 ms | 0 KB |
| new-material report | 25 ms (5,045 KB) | 0 ms | 0 ms | 0 KB (header only) |
| changes list | 100 ms (16 KB) | 6 ms | 5 ms | 16 KB |
| curriculum view's data | 17 ms (3,589 KB) | 1 ms | 0 ms | 45 KB (one course) |
| scan of known files: longest stall | **7,395 ms** (pass 8,177 ms) | — | **7 ms** (pass 228 ms) | — |

## Before / after — at 35,000 files

| Call | Before (median) | After (first) | After (median) | After reply |
|---|---|---|---|---|
| open | 701 ms (4,553 KB) | 6 ms | 3 ms | 8 KB |
| model (the whole model + the register) | 413 ms (17,507 KB) | 43 ms | 2 ms (heads: 5 KB) | 5 KB |
| listTree (top) | **4,000 ms** (4,546 KB) | 3 ms | 2 ms | 1 KB |
| listTree (deep, `Grade 1/Arabic`) | 11 ms (35 KB) | 5 ms | 3 ms | 0 KB |
| notesState | 113 ms (24,451 KB) | 90 ms | 1 ms | 0 KB |
| scanState | 332 ms (37,821 KB) | 115 ms | 0 ms | 0 KB |
| new-material report | 423 ms (25,087 KB) | 0 ms | 0 ms | 0 KB (header only) |
| report rows (one page) | — | 8 ms | 0 ms | 74 KB |
| changes list | **3,279 ms** (73 KB) | 20 ms | 17 ms | 73 KB |
| curriculum view's data | 399 ms (17,507 KB) | 2 ms | 1 ms | 48 KB (one course) |
| scan of known files: longest stall | **32,479 ms** (pass 33,611 ms) | — | **34 ms** (pass 1,653 ms) | — |

Two rows existed only after the work, and are listed for completeness:
`report rows (one page)` — one IPC page (200 items) of the flattened report the panel asks for;
and `model`/`curriculum view's data`, whose meaning changed (below), so their after numbers are
not like-for-like with before: before returned the **whole model and register** in one reply,
after returns the **heads** (`{grade, subject}` per course) and, when the tab opens a course,
**that one course** through `studio:course`.

## Budgets at 35,000 files — every one met, or explained

| Budget | Result |
|---|---|
| Opening a project ≤ 1.5 s | **~0.1 s** (open IPC 6 ms; first tab reads a 5–8 KB reply) |
| Any IPC call a click makes ≤ 100 ms | All after medians **≤ 20 ms**; the only first-call school exception below |
| Any reply ≤ 200 KB | **All after replies ≤ 74 KB** (before: up to 37,821 KB) |
| Event-loop stall ≤ 100 ms | **34 ms** in a scan of known files (before: 32,479 ms — the window froze) |
| Rows in the page at once ≤ 300 | **Yes**, every register-scale list is windowed; ≤ 300 rows proven for 35,000 items by `WindowedList.test.tsx` |
| Typing in a filter / ticking a box, no IPC over 50 ms | Every tick is local state (`selected` Set); the only IPC is the cost estimate, debounced 350 ms, served from the cache (notesState warm ≈ 0–1 ms; estimate plan ≈ 5–20 ms) |

**The one explained exception — the first register-touching call of a session.**
`scanState` and `notesState` on a cold cache cost one 15 MB `JSON.parse`: 92–115 ms on this
machine (before: 113–332 ms, and 24,451 KB over the wire). Every call after the first is ≤ 1 ms.
Options considered: a worker to parse and hand the object back (structured clone of 35,000 rows
is about the same cost as the parse — no win), and lazy pre-warming at open (just moves the same
block). The miss is ~10–15 ms on one call per project session and is accepted here; everything
else is deep inside the budget.

## What changed, briefly

**Main process (`src/main/model.ts`, new `src/main/items.ts`)** — the register, the model, the
last scan's report and the stopped scan's pending pages are read once per project and kept in memory.
Every read stats the file first (one or two cheap calls, never a parse), so a file changed on
disk behind the Studio's back is picked up on the next read. Every write goes through the same
module and updates the cache in the same breath. The folder watcher calls
`invalidateProject`/`invalidateItems`, so Explorer's changes re-read everything. One project
never sees another's copy (the cache is keyed by the real path; tested).

**Scans (`src/main/collect.ts`)** — the walk asks once instead of per file (the per-file
`insideProject` re-resolved the root for 35,000 files: ~22 s of `realpathSync`), and yields the
event loop every 64 files. A scan of known files went from 33.6 s / 32,479 ms stall to ~1 s /
34 ms stall. Hashing and reading were already incremental.

**IPC (`src/main/ipc.ts`, `src/preload`, `src/shared/api.ts`)** — lists page:
`notesRows`/`reportRows` return flattened, paged items (≤ 400 per page, usually 200);
`listTree` returns one level with each folder's direct file count, so the tree loads as the
author expands it; `notesState`/`scanState` return counts and the report's **header** only;
`studio:model` returns the curriculum and the courses' heads; `studio:course` returns one course;
`studio:fileRow` returns one register row; `studio:filePaths` resolves fact-chip paths (≤ 1,500 ids);
`studio:folders` lists relative folder paths for the Inbox's picker. The changes list indexes the
register by course once (3,279 ms → 20 ms), and counting a period's notes no longer sorts
(396 ms of the remaining 400 ms). Replies: 0–74 KB everywhere.

**Renderer** — one `WindowedList` (`src/renderer/WindowedList.tsx`, ~90 lines, no dependency)
pages the DOM: the file tree (level by level), Notes, New material, the Inbox, a folder's
children, the Changes periods list, jobs and rejected sets. Rows are real list/tree items with
labels, `aria-setsize` and `aria-posinset`; the math is `src/shared/window.ts`, tested to stay
≤ 300 rows for 35,000 items. Lists over IPC load sparse pages as the window reaches them.
`notes.groups` are gone; the page keeps chosen ids only. The estimate is computed in the main
process from the register's cached page counts; rows whose register says no picture pages are
never opened. The Changes tab names fact-chip files from `filePaths` (a mismatch degrades to
showing the raw source id, exactly as before for unknown ids).

**Model round trip (`src/shared/model.ts`, `src/shared/project.ts`)** — fixed a latent class of
bugs found while testing the cache: `modelFileText` compacts away absent optional fields, so
absent must read back as empty. Courses, lessons, units, skills and periods now do; a
hand-written empty model reads back cleanly. A damaged report (empty `groups`) reads as an empty
report instead of nothing at all — a stopped or clean scan no longer erases the New material
panel's memory. (Regression-tested.)

## Acceptance criteria

- [x] **Both scripts exist.** Before/after tables above at 7,000 and 35,000 files; every budget
      met at 35,000 or the gap explained (the first-call cold parse, above).
- [x] **Tests** — the cache picks up a write and a change on disk
      (`src/main/cache.test.ts`, 9 tests, incl. a same-size change with a moved mtime and a
      foreign project); the windowed list draws at most 300 rows for 35,000 items
      (`src/renderer/WindowedList.test.tsx` + `src/shared/window.test.ts`); the IPC replies for
      lists stay paged (`src/main/ipc.test.ts`, incl. the cap of 400 per page, one level of the
      tree, one file row, and `../../Windows` refused).
- [x] **Nothing in the page's behaviour changes except speed**, with two small notes:
      (a) the changes list shows **one** priced plan at a time, placed just under the list with
      the course named in it (it used to expand under each row — same actions, same words);
      (b) the Curriculum tab and the changes review load one course at a time, which is what
      makes their data replies fit the budget; text shown and actions are identical.
      The tree's expand is now one level at a time, which is also what makes the tree quick;
      open folders keep their loaded levels until the folder changes on disk.

Known limits, deliberately unchanged:

- The changes review renders one whole change set at a time (now beside proposed), and the
  Curriculum renders one course at a time — neither is a register-scale list (a course is
  ~150 facts, a set is one course and period), so they are not windowed.
- Pending change sets are returned whole in `changesState` (bounded by one course per set, a
  few dozen KB each); the rejected list and the jobs list are windowed.
- No new dependency was added. `node:worker_threads` was not needed: with the walk spread over
  the event loop, hashing overlaps the UI naturally, and the parse happens once per session.
