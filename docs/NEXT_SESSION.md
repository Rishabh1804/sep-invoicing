# Next session — SEP Invoicing (Session B of four)

**Set by the owner, 24 Sep 2026.** This repo is worked in its **own session**. A separate
**compile session** (Session D) attaches all three SEP repos and reconciles their data. The model
is described once, canonically, in `soma-internal/docs/CROSS_REPO_SESSIONS.md`. This file
carries **this repo's side** of it: the work queued here, and what this app produces and consumes.

---

**Older session closes are in `docs/sessions/` by month** (`2026-09.md`, `2026-10.md`, `2026-11.md`), moved word for word on 11 Nov 2026.
At a close, the new entry replaces the one below, which moves to the top of its month's file. Subjects are looked up through `docs/atlas/INDEX.md`.

## Session close, 11 Nov 2026: CLAUDE.md cut to a core, and the atlas (read this first)

- **What changed**: `CLAUDE.md` was 620 KB, loaded whole into every session and every subagent (about 155,000 tokens). It is now
  an 8 KB core: the route, the protocol, the hard rules, build and tests. Its 110 sections moved **word for word** into
  `docs/atlas/` (8 domains, 71 topics), checked line by line: none lost, none duplicated.
- **The route**: `CLAUDE.md` → `docs/atlas/INDEX.md` → a domain's `README.md` → a topic → the code, spec and tests it names.
  `docs/atlas/MODULES.md` gives a module's topic; `docs/atlas/HEADINGS.md` resolves an old *CLAUDE.md § …* citation. Path rules
  in `.claude/rules/` name the topic when a module is opened.
- **The protocol** (`docs/atlas/README.md`): look up by the route; a miss is fixed in the same PR; a change updates its topic;
  over budget, split. `node tools/atlas-check.mjs` holds it in CI's build job.
- **This file was cut too** (117 KB → 5 KB): older closes are in `docs/sessions/`, the data flows in `docs/DATA_FLOWS.md`.
- **Carried from 10 Nov, the owner's**:
  - October 2026's Tata figures: the owner typed the total by hand, so the app does not read October itself; the release is
    read only from the Tata dialog's **Read the release**. Ask how it went.
  - The 4-digit PIN (Castor H-2), deferred by the owner; the next build's order (the server S0–S5, KB2-2 onward, PP2/PP4/PP5).
- **From the codex's read of 4–10 Nov** (`soma-internal/decisions/2026-11-11.md`):
  - The supervisor's starting balance **is on the book** (the 9 and 10 Nov closes listed it as open).
  - A delivery relayed from the sibling supplier of free acids carries no price in the app, so the live cost reads its lines as
    unpriced, not ₹0. Setting those entries to ₹0 is the owner's call in Stock.
- **Open on the atlas itself**: the first cut filed sections in the order they had grown. Re-file a topic that bundles two
  subjects when next working in it (`docs/atlas/README.md`, *Iterate*).

**Opening prompt for the next session** (copy as it is):

```
SEP Invoicing, session B. 11 Nov 2026: CLAUDE.md is now a small core and everything else is in docs/atlas/
(the route: CLAUDE.md → docs/atlas/INDEX.md → a domain README → a topic → code, spec, tests).
Goal: ask the owner how October 2026's Tata release read went (Tata dialog → Read the release) and fix what it
showed; then the owner's next ask, or the planned updates (the server S0–S5, KB2-2 onward, the plant
picture's PP2/PP4/PP5), one PR a step.
Read first:
- /home/user/sep-invoicing/docs/NEXT_SESSION.md (this entry)
- /home/user/sep-invoicing/docs/atlas/README.md (the protocol), then the topic for the subject in hand
At start: HR-10, the repo is public, every example made up; set PW_CHROMIUM_PATH before Playwright; never
raise a P195 budget; merge only on the owner's word; a change updates its atlas topic in the same PR.
Held for the owner: the 4-digit PIN (Castor H-2).
```

## Where the rest is

- **Data flows with the other two repos** (what this app produces and consumes, every backup-shape change): `docs/DATA_FLOWS.md`.
- **What is built and what is next**, programme by programme: `docs/atlas/core/roadmap.md`.
- **Any subject**: `docs/atlas/INDEX.md`.
- **Older closes**: `docs/sessions/`. The queue as first set on 24 Sep 2026: `docs/sessions/2026-09-queue.md`.
