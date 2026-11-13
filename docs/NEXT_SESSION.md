# Next session — SEP Invoicing (Session B of four)

**Set by the owner, 24 Sep 2026.** This repo is worked in its **own session**. A separate
**compile session** (Session D) attaches all three SEP repos and reconciles their data. The model
is described once, canonically, in `soma-internal/docs/CROSS_REPO_SESSIONS.md`. This file
carries **this repo's side** of it: the work queued here, and what this app produces and consumes.

---

**Older session closes are in `docs/sessions/` by month** (`2026-09.md`, `2026-10.md`, `2026-11.md`), moved word for word on 11 Nov 2026.
At a close, the new entry replaces the one below, which moves to the top of its month's file. Subjects are looked up through `docs/atlas/INDEX.md`.

## Session close, 13 Nov 2026: a month's register into the app, and the rolls beside each cell (read this first)

- **What shipped, merged on the owner's word**:
  - **#190** (`5fdf706`): an import fills a register page started by hand and left blank (`aregMonthBlank`). A month had been
    started with *Start this month* and nothing written, and its transcribed file came back *already on record, kept*. P161.
  - **#191** (`618bbe7`; owner: *"I don't see the relevant dated line of the whatsapp message to make an informed decision, that
    the app can record and store for future references and reads"*): a register cell shows each roll saved for its day and the
    lines naming that hand, as written and as read, then what the rolls alone read; the list of differences says the roll's mark.
    **A settled cell keeps what it was settled on** (`settled[]`; a row in `docs/DATA_FLOWS.md`). A roll line carries its day (`iso`).
  - **#192** (`8f25cce`; owner, live: *"It doesn't show the time at all"*): each line under the slot heading and section above it,
    an in-time roll's own "OUT TIME …" read as a slot. Merged before CI on the owner's word; the PR's run and `main`'s passed.
- **Off the build**: a month's register page was transcribed by Claude from the owner's photos into a private `sep-att-register`
  file (its unsure cells settled by the owner), handed over and imported (*"1 blank page filled"*). Not committed (HR-10).
- **Open, the owner's**: settling that month's differences in the app with the roll lines beside each cell; the 4-digit PIN
  (Castor H-2), deferred; ₹0 prices on the free-acid supplier's entries, his call in Stock.
- **From 11 Nov, still open**: re-file a topic that bundles two subjects when next working in it (`docs/atlas/README.md`, *Iterate*);
  the codex's `CLAUDE.md` citations of this repo's old `CLAUDE.md` lines (the compile session's).

**Opening prompt for the next session** (copy as it is):

```
SEP Invoicing, session B. 13 Nov 2026: a register cell now shows the day's WhatsApp roll lines under their time
headings, and a settled cell keeps them (docs/atlas/people/attendance-rolls.md). The route: CLAUDE.md →
docs/atlas/INDEX.md → a domain README → a topic → code, spec, tests.
Goal: ask the owner how settling the month's register went and fix what it showed; then the owner's next ask, or
the planned updates (the server S0–S5, KB2-2 onward, the plant picture's PP2/PP4/PP5), one PR a step.
Read first:
- /home/user/sep-invoicing/docs/NEXT_SESSION.md (this entry)
- /home/user/sep-invoicing/docs/atlas/README.md (the protocol), then the topic for the subject in hand
At start: HR-10, the repo is public, every example made up; run `pnpm install` if node_modules is missing and set
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium before Playwright; never raise a P195 budget; merge only on the owner's
word; a change updates its atlas topic in the same PR.
Held for the owner: the 4-digit PIN (Castor H-2).
```

## Where the rest is

- **Data flows with the other two repos** (what this app produces and consumes, every backup-shape change): `docs/DATA_FLOWS.md`.
- **What is built and what is next**, programme by programme: `docs/atlas/core/roadmap.md`.
- **Any subject**: `docs/atlas/INDEX.md`.
- **Older closes**: `docs/sessions/`. The queue as first set on 24 Sep 2026: `docs/sessions/2026-09-queue.md`.
