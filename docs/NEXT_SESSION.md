# Next session — SEP Invoicing (Session B of four)

**Set by the owner, 24 Sep 2026.** This repo is worked in its **own session**. A separate
**compile session** (Session D) attaches all three SEP repos and reconciles their data. The model
is described once, canonically, in `soma-internal/docs/CROSS_REPO_SESSIONS.md`. This file
carries **this repo's side** of it: the work queued here, and what this app produces and consumes.

---

**Older session closes are in `docs/sessions/` by month** (`2026-09.md`, `2026-10.md`, `2026-11.md`), moved word for word on 11 Nov 2026.
At a close, the new entry replaces the one below, which moves to the top of its month's file. Subjects are looked up through `docs/atlas/INDEX.md`.

## Session close, 20 Nov 2026: the bug sweep (#203), the load-bearing list (#204), the app's own address (#205, #206) (read this first)

- **What shipped, merged on the owner's word**:
  - **#203** (`b55c8cd`): the bug sweep, 28 fixes each with its spec: keyboard entry on Create (P268); the field typed in kept clear
    of the bars on a long form (P275); navigation while entering data and the navigation layer (P269, P270, P272); Backspace (P276);
    text that did not fit its box (P274); a UTC date (P277); dead code; client identifiers left in specs replaced. Every bug with
    its cause and resolution: `docs/atlas/core/qa-sweep-2026-11-17.md`.
  - **#204** (`dbaf04c`): Power → Case only to a role that sees money and wages (P278); no client's data and nothing about the shop
    in the build (P279): the once-only migrations that named a client removed, the default company empty.
  - **#205** (`6904749`): S0, the app's own address: `dist/`, the Worker `server/app`, the move between addresses (P280),
    `docs/S0_GUIDE.md`, `docs/atlas/core/new-address.md`.
  - **#206** (`c83ecea`): a pnpm lockfile in `server/app` (Cloudflare's build installs with pnpm); the guide corrected.
- **Live**: the owner made the Worker `sep-app` and the domain; `https://app.somaelectro.co.in` serves the app (*Waiting for the
  book*), `/CLAUDE.md` and `/docs/` 404, http redirects. Cloudflare's GitHub connection was reconnected on 20 Nov (build command,
  deploy command, the preview command `npx wrangler versions upload`, root `server/app`).
- **Owner's, outside the code**: Sentry's allowed domains (add the new host); the move of each device from a browser tab, his phone
  first (`docs/S0_GUIDE.md` §2); afterwards, the copy left on the old address and the tokens.
- **Held for the owner's ruling** (recorded in the codex, not here): what a non-owner can see on Power → Cuts and take in an export,
  the PIN's storage, the lock, error reports, the release reader, older passages that name clients. Small things seen in the sweep:
  the catalogue's section 9.

**Opening prompt for the next session** (copy as it is):

```
SEP Invoicing, session B. Last close (20 Nov 2026): #203 the bug sweep (the catalogue docs/atlas/core/qa-sweep-2026-11-17.md),
#204 Power → Case by money and wages and no shop or client data in the build, #205 and #206 the app's own address
(app.somaelectro.co.in, live; docs/S0_GUIDE.md). The route: CLAUDE.md → docs/atlas/INDEX.md → a domain README → a topic →
code, spec, tests.
Goal: ask the owner what he wants from this session. If devices have moved to the new address, read what he meets there and fix
it. One PR a step: the test that fails on the build before the fix, the fix, the atlas topic.
Read first:
- /home/user/sep-invoicing/docs/NEXT_SESSION.md (this entry)
- /home/user/sep-invoicing/docs/atlas/README.md (the protocol), then the topic for the subject in hand
At start: HR-10, the repo is public, every example made up; run `pnpm install` if node_modules is missing and set
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium before Playwright; give each Playwright run its own PW_PORT; never raise a P195 budget;
merge only on the owner's word; a change updates its atlas topic in the same PR. After orientation, arm the unattended close.
```

## Where the rest is

- **Data flows with the other two repos** (what this app produces and consumes, every backup-shape change): `docs/DATA_FLOWS.md`.
- **What is built and what is next**, programme by programme: `docs/atlas/core/roadmap.md`.
- **Any subject**: `docs/atlas/INDEX.md`.
- **Older closes**: `docs/sessions/`. The queue as first set on 24 Sep 2026: `docs/sessions/2026-09-queue.md`.
