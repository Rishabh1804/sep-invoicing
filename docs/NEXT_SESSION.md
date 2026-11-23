# Next session — SEP Invoicing (Session B of four)

**Set by the owner, 24 Sep 2026.** This repo is worked in its **own session**. A separate
**compile session** (Session D) attaches all three SEP repos and reconciles their data. The model
is described once, canonically, in `soma-internal/docs/CROSS_REPO_SESSIONS.md`. This file
carries **this repo's side** of it: the work queued here, and what this app produces and consumes.

---

**Older session closes are in `docs/sessions/` by month** (`2026-09.md`, `2026-10.md`, `2026-11.md`), moved word for word on 11 Nov 2026.
At a close, the new entry replaces the one below, which moves to the top of its month's file. Subjects are looked up through `docs/atlas/INDEX.md`.

## Session close, 23 Nov 2026: three rulings built (#213), no reference document kept and the Sunday tests (#214) (read this first)

- **What shipped, merged on the owner's word**:
  - **#213** (`ad232db`):
    - **The export is the owner's alone** (P285; `docs/atlas/platform/guard.md`): `exportData` refuses any other role, its button is
      drawn only for the owner, and a save that did not land sends another role to the GitHub sync or to the owner
      (`storageBannerWayOut`). The partial export is gone.
    - **Another person signing in empties the pages not on show** (P286): `grdAfterUser` calls `tabClearOthers` (tabs.js) once the
      page on show is settled; the last person's selections and a half-typed invoice go with them.
    - **Error reports carry the kind of error and its place in the code, not its message** (P143; `docs/atlas/core/error-reports.md`).
      A report with no place in the code asks the owner, with the masked message shown; the last five messages that did not go are
      kept on the device (`sep_inv_err_kept`, never on the book, not carried to a new address) and Settings → Backup, storage &
      build lists them for the owner to send.
  - **#214** (`cd805ec`): no reference document is kept in this repository (HR-10); what the app's credit note does differently
    from the paper form is a table in `docs/atlas/billing/credit-notes.md`. **Fourteen tests that assumed a working day now run on one**: they failed on
    Sunday 22 Nov, when the app rightly says the plant is shut. `onWorkday(page)` (tests/e2e/fixtures.ts) puts a test's clock on
    the last working day; a spec that sets its own clock dates it `workdayIso()` (`docs/atlas/core/tests.md`).
- **Live**: `app.somaelectro.co.in` serves build `49089008`, the same as `main` (read 23 Nov).
- **Found on the way**: P142's stand-in for `grdIsOwner` said nobody is the owner with the guard off; it now matches the guard.
  A new spec file must not be named `*-export-*`: `.gitignore` drops it.
- **Ruled, not yet built** (the detail is in the codex): older passages in this repository that HR-10 covers are to be read and
  scrubbed, and the history rewritten after that, its plan put to the owner first. The codex holds the reading list and the
  instrument; nothing from it is quoted here until the rewrite has run.
- **The owner's, outside the code**: a passkey on his phone and laptop and a week of use, then step 3 (his PIN out of the book);
  the print station's move; the copies on the old address after 27 Nov.
- **Next, as the owner says**: he works away from the plant from 24 Nov to 6 Dec; the floor's data is to keep coming in by forms
  filled by hand and sent as photos. The design is being grilled; its decisions go into the atlas as they are made.

**Opening prompt for the next session** (copy as it is):

```
SEP Invoicing, session B. Last close (23 Nov 2026): #213 the export the owner's alone, hidden pages emptied on a change of
person, error reports without the message; #214 no reference document kept, and fourteen tests that failed on a Sunday run on a
working day (onWorkday). The route: CLAUDE.md → docs/atlas/INDEX.md → a domain README → a topic → code, spec, tests. Next, as he
says: the floor's data kept up to date while the owner is away (forms by hand, sent as photos): build what the grill decided;
then step 3 (his PIN out of the book) after a week of use; the scrub of older passages (the plan to him first).
```

## Where the rest is

- **Data flows with the other two repos** (what this app produces and consumes, every backup-shape change): `docs/DATA_FLOWS.md`.
- **What is built and what is next**, programme by programme: `docs/atlas/core/roadmap.md`.
- **Any subject**: `docs/atlas/INDEX.md`.
- **Older closes**: `docs/sessions/`. The queue as first set on 24 Sep 2026: `docs/sessions/2026-09-queue.md`.
