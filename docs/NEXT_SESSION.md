# Next session — SEP Invoicing (Session B of four)

**Set by the owner, 24 Sep 2026.** This repo is worked in its **own session**. A separate
**compile session** (Session D) attaches all three SEP repos and reconciles their data. The model
is described once, canonically, in `soma-internal/docs/CROSS_REPO_SESSIONS.md`. This file
carries **this repo's side** of it: the work queued here, and what this app produces and consumes.

---

**Older session closes are in `docs/sessions/` by month** (`2026-09.md`, `2026-10.md`, `2026-11.md`), moved word for word on 11 Nov 2026.
At a close, the new entry replaces the one below, which moves to the top of its month's file. Subjects are looked up through `docs/atlas/INDEX.md`.

## Session close, 23 Nov 2026, the second: the sheets to photograph (#215); a sheet photographed again (draft, not merged) (read this first)

- **What shipped, merged on the owner's word**:
  - **#215** (`a41ddba`): **the sheets to photograph as they fill** (P287; `docs/atlas/floor/entry-faces.md`). Production → More →
    Print sheets takes a run of days and a tick, *To photograph as it fills*: each blank sheet carries its code (the kind, the day,
    the page), a strip of half hours to tick when the photo is sent, numbered rows that run on to a spare page 2, and the rule for
    a wrong row. Two sheets join the four: the stop sheet for the whole plant, and the attendance sheet. Coded, the attendance
    sheet lists the hands on the floor only, less the ones named in the dialog as away for the run, and names nobody of the shop.
- **Built, pushed as a draft, not merged** (the next session's first act is its CI and the owner's word): **a coded sheet
  photographed again replaces its earlier reading** (P288; `docs/atlas/platform/messages-and-photos.md`). The register reader
  gives back the code (`reg-c3`); a VAT sheet's day and line are the code's; a later photo of the same sheet voids the earlier
  reading's entries with the reason and saves the page as it stands, so it counts once; the check says the rows new since and a
  row that reads differently. A coded sheet of another kind is named and nothing is saved.
- **Not tested against the real reader**: the prompt's new lines for a printed sheet (the code, a row with a start and an end
  time, the power log table) are tested with a stand-in answer only. The first real photo is their first test.
- **Not built** (in the order the owner picked): one drop that sorts every photo by its code and reads the strip's ticks; the
  readers for the barrel, pickling and stop sheets; a client's challan from a photo, one tap to save, and what the reader
  learns; the attendance sheet as a check.
- **Found on the way**: a spec named outside `pNNN-…` or run with `--project=desktop-chromium` finds no tests (that project runs
  `*.desktop.spec.ts` only). The plain attendance sheets still carry the names they had.
- **Carried**: the scrub of older passages and the history rewrite (the plan to the owner first); step 3 (his PIN out of the
  book) after a week of use.
- **The owner is away from the plant, 24 Nov to 6 Dec**, working from his phone. The first production sheets are due on 24 Nov.

**Opening prompt for the next session** (copy as it is):

```
SEP Invoicing, session B. Last close (23 Nov 2026, the second): #215 merged, the sheets to photograph as they fill (P287). A
draft PR holds P288: a coded sheet photographed again replaces its earlier reading. First: its CI, then the owner's word to
merge. The owner is away 24 Nov to 6 Dec and reads the floor from photos of the sheets; the first real photo is the first test
of the reader's prompt for a printed sheet (reg-c3): correct it from what the check shows. Then, in his order: the one drop
sorted by code and the strip's ticks; the barrel, pickling and stop readers; challans from photos; the attendance check. The
route: CLAUDE.md → docs/atlas/INDEX.md → a domain README → a topic → code, spec, tests.
```

## Where the rest is

- **Data flows with the other two repos** (what this app produces and consumes, every backup-shape change): `docs/DATA_FLOWS.md`.
- **What is built and what is next**, programme by programme: `docs/atlas/core/roadmap.md`.
- **Any subject**: `docs/atlas/INDEX.md`.
- **Older closes**: `docs/sessions/`. The queue as first set on 24 Sep 2026: `docs/sessions/2026-09-queue.md`.
