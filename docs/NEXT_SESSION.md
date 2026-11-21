# Next session — SEP Invoicing (Session B of four)

**Set by the owner, 24 Sep 2026.** This repo is worked in its **own session**. A separate
**compile session** (Session D) attaches all three SEP repos and reconciles their data. The model
is described once, canonically, in `soma-internal/docs/CROSS_REPO_SESSIONS.md`. This file
carries **this repo's side** of it: the work queued here, and what this app produces and consumes.

---

**Older session closes are in `docs/sessions/` by month** (`2026-09.md`, `2026-10.md`, `2026-11.md`), moved word for word on 11 Nov 2026.
At a close, the new entry replaces the one below, which moves to the top of its month's file. Subjects are looked up through `docs/atlas/INDEX.md`.

## Session close, 21 Nov 2026: the owner's passkey and the approval from his own devices (#210, #211); the grill-me skill (read this first)

- **What shipped, merged on the owner's word**:
  - **#207** (`310ac89`), **#208** (`674d43b`), **#209** (`3637331`): the 20 Nov close; Power → Cuts leaves a cut's wages out for a
    role without wages (P282); the move's first-use fixes (P281).
  - **#210** (`245c070`): the owner's **passkey** beside the PIN (P283; `docs/atlas/platform/guard.md`), and the **relay** on the
    app's Worker, `/api/relay/<id>` (a Durable Object; one sealed answer, read once, gone in 120 s; `docs/atlas/core/new-address.md`).
    The Worker's headers moved to `server/app/src/headers.js`. The `grill-me` skill (`.claude/skills/grill-me/SKILL.md`).
  - **#211** (`535e938`): **a sign-in approved from a device of the owner's** (a QR, his passkey, the answer sealed through the relay),
    which can carry the sync token to a device with no book (then *borrowed*: *Sign out and clear this device*, or cleared after 12
    hours unused, after a push; never on a lock) (P284). `sw.js` leaves `/api/` alone; `qr.js` to version 20.
- **Live**: the relay answers on `app.somaelectro.co.in`. The PIN still works everywhere.
- **The owner's, outside the code**: add a passkey on his phone and laptop (Settings → Access → Users & access); use the passkey and
  the approval for a week; then step 3 (his PIN out of the book). The print station's move. The copies on the old address after 27 Nov.
- **Ruled, to build** (the detail is in the codex): a non-owner's export, the lock clearing other pages on a change of user, error
  reports carrying only the error's type and frames, older passages that name clients scrubbed with the history rewritten (its plan
  put to him first). Then Floor: the sync copy's own repository, a WhatsApp helper, a live board, Compare.

**Opening prompt for the next session** (copy as it is):

```
SEP Invoicing, session B. Last close (21 Nov 2026): #210 the owner's passkey and the relay on the Worker; #211 a sign-in
approved from a device of his, and the borrowed device. The route: CLAUDE.md → docs/atlas/INDEX.md → a domain README → a topic
→ code, spec, tests. Next, as he says: step 3 (his PIN out of the book) after a week of use; the export the owner's alone; the
lock clearing other pages; error reports carrying type and frames only; the older client passages scrubbed (plan to him first).
```

## Where the rest is

- **Data flows with the other two repos** (what this app produces and consumes, every backup-shape change): `docs/DATA_FLOWS.md`.
- **What is built and what is next**, programme by programme: `docs/atlas/core/roadmap.md`.
- **Any subject**: `docs/atlas/INDEX.md`.
- **Older closes**: `docs/sessions/`. The queue as first set on 24 Sep 2026: `docs/sessions/2026-09-queue.md`.
