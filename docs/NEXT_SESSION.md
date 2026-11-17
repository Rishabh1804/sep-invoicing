# Next session — SEP Invoicing (Session B of four)

**Set by the owner, 24 Sep 2026.** This repo is worked in its **own session**. A separate
**compile session** (Session D) attaches all three SEP repos and reconciles their data. The model
is described once, canonically, in `soma-internal/docs/CROSS_REPO_SESSIONS.md`. This file
carries **this repo's side** of it: the work queued here, and what this app produces and consumes.

---

**Older session closes are in `docs/sessions/` by month** (`2026-09.md`, `2026-10.md`, `2026-11.md`), moved word for word on 11 Nov 2026.
At a close, the new entry replaces the one below, which moves to the top of its month's file. Subjects are looked up through `docs/atlas/INDEX.md`.

## Session close, 17 Nov 2026: the cache warmer's pointer; the paper record reads an auto margin as auto (read this first)

- **What shipped, merged on the owner's word**: **#194** (`1cfd394`).
  - **The cache warmer's pointer** (owner: *"add the pointer line to sep-invoicing too"*): one bullet in `CLAUDE.md` beside
    *Sessions*, and the same in `docs/atlas/README.md`. A session arms a ping to itself every 50 minutes; any message the owner
    types resets the count; the tenth in a row ends the chain. The rule is the codex's
    (`soma-internal/docs/atlas/continuity/cache-warmer.md`). **Nothing is pushed to this repo unattended**; a session with this
    repo alone says in the chat what is committed and what is not, and stops. The owner confirmed both, 17 Nov.
  - **P228, the paper record**: it failed on that pull request's first commit, which changed two docs. The pay slip's
    signature block sits at the foot of its slip by an auto margin, and the spec recorded the length layout gave it: 78px and
    95px in the record, 104px and 95px on a Monday. A margin whose computed value is `auto` is now recorded as `auto`; three
    record entries moved. No app code changed. `docs/atlas/core/tests.md`.
- **Known, about the sandbox**: P228's first test does not pass here before or after that change (about 60 differences on
  tables, this Chromium against CI's). CI is the instrument for the paper record.
- **The warmer is retired, the close kept** (the owner, 17 Nov, after this close was first written): on its first night the
  session limit was hit and a ping arrived ten hours late. One check eight hours after his last message now runs the
  close; nothing keeps the cache warm (the codex's `decisions/2026-11-17.md`).
- **Open, the owner's, unchanged from 13 Nov**: settling the month's register differences in the app with the roll lines
  beside each cell; the 4-digit PIN (Castor H-2), deferred; ₹0 prices on the free-acid supplier's entries, his call in Stock.
- **From 11 Nov, still open**: re-file a topic that bundles two subjects when next working in it (`docs/atlas/README.md`, *Iterate*);
  the codex's `CLAUDE.md` citations of this repo's old `CLAUDE.md` lines (the compile session's).

**Opening prompt for the next session** (copy as it is):

```
SEP Invoicing, session B. 17 Nov 2026: the cache warmer's pointer is in CLAUDE.md, and the paper record (P228) reads an
auto margin as auto (docs/atlas/core/tests.md). The route: CLAUDE.md → docs/atlas/INDEX.md → a domain README → a topic →
code, spec, tests.
Goal: ask the owner how settling the month's register went and fix what it showed; then the owner's next ask, or
the planned updates (the server S0–S5, KB2-2 onward, the plant picture's PP2/PP4/PP5), one PR a step.
Read first:
- /home/user/sep-invoicing/docs/NEXT_SESSION.md (this entry)
- /home/user/sep-invoicing/docs/atlas/README.md (the protocol), then the topic for the subject in hand
At start: HR-10, the repo is public, every example made up; run `pnpm install` if node_modules is missing and set
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium before Playwright; never raise a P195 budget; merge only on the owner's
word; a change updates its atlas topic in the same PR. After orientation, arm the unattended close (CLAUDE.md).
Held for the owner: the 4-digit PIN (Castor H-2).
```

## Where the rest is

- **Data flows with the other two repos** (what this app produces and consumes, every backup-shape change): `docs/DATA_FLOWS.md`.
- **What is built and what is next**, programme by programme: `docs/atlas/core/roadmap.md`.
- **Any subject**: `docs/atlas/INDEX.md`.
- **Older closes**: `docs/sessions/`. The queue as first set on 24 Sep 2026: `docs/sessions/2026-09-queue.md`.
