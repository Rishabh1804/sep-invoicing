# Next session — SEP Invoicing (Session B of four)

**Set by the owner, 24 Sep 2026.** This repo is worked in its **own session**. A separate
**compile session** (Session D) attaches all three SEP repos and reconciles their data. The model
is described once, canonically, in `soma-internal/docs/CROSS_REPO_SESSIONS.md`. This file
carries **this repo's side** of it: the work queued here, and what this app produces and consumes.

---

**Older session closes are in `docs/sessions/` by month** (`2026-09.md`, `2026-10.md`, `2026-11.md`), moved word for word on 11 Nov 2026.
At a close, the new entry replaces the one below, which moves to the top of its month's file. Subjects are looked up through `docs/atlas/INDEX.md`.

## Session close, 17 Nov 2026 (the second): text entered by hand and learnt; the pickling line; holidays in two kinds; floor photos (read this first)

- **What shipped, merged on the owner's word**:
  - **#198** (`6ea6147`): a paste nothing could be read from opens **Enter it from the text** (a row a line with a figure, filled
    from a loose reading); what is saved teaches each line's shape (`learn.lines`), and the next message written that way is read.
    `docs/atlas/floor/production-readers.md`, P264.
  - **#199** (`6b9a524`): the pickling hand says where a load is going (`dest`: on Mine, in his message, by hand), kept apart from
    the line read off its plating and measured against it (Lines → Pickling, eight weeks; Entries' *Line not as said*). Which
    manual step it may replace is the owner's, decided later. `docs/atlas/floor/production.md`, P265.
  - **#200** (`4b24375`): paid holidays in two fields, every year (`MM-DD`) and dated (a full date, for a festival that moves);
    one list on the book as before. `docs/atlas/people/labour-and-pay.md`, P266.
  - **#201** (`cdb893c`): **Production → Photos**, a floor photo log: photos the owner adds (the picture stays on his device, the
    log in the book, `S.floorPhotos`), tagged by area with the area's own questions, at upload, from a queue or with Claude's
    suggestion confirmed; an area that watches a line shows the record within an hour. A read never writes (P141). CI's first run
    failed on P195 (the new tab had no load budget); a budget beside its siblings was added, none raised. New topic
    `docs/atlas/floor/floor-photos.md`, P267.
- **Owner's, in the app**: move a festival entered as `MM-DD` into *Dated* (Settings → Rest days & attendance); type the photo
  areas and their questions (Production → Photos → Areas), and the line each process area watches.
- **Not done here**: a message left unread inside a paste where other messages were read still shows *Not production* on the
  review, with no way to enter it from there (#198's note).
- **The next session**: not named by the owner. Likely: the first photos tagged and the pickling line in use; their measures read.

**Opening prompt for the next session** (copy as it is):

```
SEP Invoicing, session B. Last close (17 Nov 2026, the second): #198 a refused paste opens Enter it from the text and learns
its lines; #199 the pickling hand's line for a load, measured against the plating; #200 paid holidays every year and dated;
#201 Production → Photos, the floor photo log. The route: CLAUDE.md → docs/atlas/INDEX.md → a domain README → a topic →
code, spec, tests.
Goal: ask the owner what he wants from this session. If he has tagged floor photos or the pickling hand has started giving
lines, read what the app shows (Production → Photos; Lines → Pickling) and fix what he meets. One PR a step: the test that
fails on the build before the fix, the fix, the atlas topic.
Read first:
- /home/user/sep-invoicing/docs/NEXT_SESSION.md (this entry)
- /home/user/sep-invoicing/docs/atlas/README.md (the protocol), then the topic for the subject in hand
At start: HR-10, the repo is public, every example made up; run `pnpm install` if node_modules is missing and set
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium before Playwright; never raise a P195 budget (a new screen gets its own); merge
only on the owner's word; a change updates its atlas topic in the same PR. After orientation, arm the unattended close.
Held for the owner: the 4-digit PIN (Castor H-2).
```

## Where the rest is

- **Data flows with the other two repos** (what this app produces and consumes, every backup-shape change): `docs/DATA_FLOWS.md`.
- **What is built and what is next**, programme by programme: `docs/atlas/core/roadmap.md`.
- **Any subject**: `docs/atlas/INDEX.md`.
- **Older closes**: `docs/sessions/`. The queue as first set on 24 Sep 2026: `docs/sessions/2026-09-queue.md`.
