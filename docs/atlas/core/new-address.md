---
subject: "The new address: app.somaelectro.co.in, dist/, the Worker and the handover (S0)"
domain: core
modules: [split/move.js, split/dist.sh, server/app/src/index.js]
specs: [docs/SERVER.md, docs/S0_GUIDE.md]
tests: [P280]
updated: 2026-11-17 (built: the groundwork of S0; nothing deployed, nothing changed on a device)
---

## The new address (S0)

The owner, 15 Oct 2026: *"I would like to move it to app.somaelectro.co.in"*, first, before any device registers with the server
(`docs/SERVER.md` §1, §9 step 0). Ruled to build on 17 Nov 2026: *"Then we'll get the groundwork on the keys, that is S0."*

**Why.** The old address, `rishabh1804.github.io`, is an origin every GitHub Pages project of the account shares, and its storage
with it (`persistence.md` says what that pool already cost). This device's GitHub token (it writes to the owner's private codex),
the Claude key and the metals.dev key sat there, readable by any page any of those projects publishes. The app's own address is
an origin nothing else is served from. And the site published the whole repository: `CLAUDE.md` and `docs/` answered from github.io.

### What is published: dist/ only

`split/dist.sh` (run at the end of `split/build.sh`) writes a **list** of files to `dist/`: `index.html`, `sw.js`, `manifest.json`,
`version.json`, the favicons and icons, the widget's template and screenshot. A file is published only by being named there.
Never `CLAUDE.md`, `docs/`, the sources, the tests, `sep-invoicing.html` or `checkin.html`. **`dist/` is not committed**
(`.gitignore`): Cloudflare's build runs `build.sh`, which writes it; CI's *Build output in sync* still compares only the three
committed artefacts. P280 runs `dist.sh` into a scratch folder and checks the list against what the page, `sw.js` and the
manifest load, and that nothing else is there.

### The Worker (server/app)

A Cloudflare Worker serving `dist/` as static assets, run first on every request (`run_worker_first`):
- **One origin.** Any host but `APP_HOST` (the `*.workers.dev` address, a preview's address) and plain http answer `308` to
  `https://app.somaelectro.co.in`, path and query kept: no second origin can collect a book. `/sep-invoicing/…` goes to `/…`.
  GET and HEAD only.
- **Headers on every answer**: a CSP (`default-src 'self'`; scripts and styles self and inline, since the page is one built
  document; `connect-src` the hosts the app calls, read from the code; `frame-ancestors`, `frame-src`, `object-src`, `form-action`
  and `base-uri` none), `nosniff`, `strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, HSTS (no subdomains: the apex is the
  website's), a permissions policy (camera and location for the app itself). **No Cross-Origin-Opener-Policy**: `same-origin` would
  cut the handover window's opener.
- **The CSP refuses a feeds address typed in Settings other than the default**; the app then asks GDELT and MET itself. P280 fails
  when the code names a host the policy would refuse, and runs the whole move with the policy on (the test server adds the Worker's
  own string on request).
- Its vitest suite runs in the Workers runtime over the real `dist/` (CI: *App Worker tests*). Nothing deploys from GitHub Actions:
  Cloudflare's own build deploys on merge (`docs/S0_GUIDE.md`), so no secret is needed in S0.

### The handover (split/move.js)

**Credentials pass through it**, so each step is checked:
1. On the old address, **Settings → Data & device → The new address → Move to the new address** (drawn on the old address only).
   The owner's door (`grdGate('users')`, as registering a device is). A checkbox, on by default: *Delete the keys from this address
   once the new one has them*.
2. **The book is pushed first**: GitHub sync must be set up and the device may sync (`devSyncBlocked`), and a push must land
   (`ghPushLocked`, which merges first if GitHub moved). Refused, nothing is moved and no window opens.
3. *Open the new address* is its own tap, so the window opens on a gesture (a pop-up after the push's wait would be blocked):
   `window.open(MOVE_NEW_ORIGIN + '/?move=1')`.
4. The new address, with no book and an opener, posts `sep-move-ready` **to `MOVE_OLD_ORIGIN` only**. The old one acts on it only
   when `e.origin === MOVE_NEW_ORIGIN` and `e.source` is the window it opened; anything else is counted and dropped.
5. The old one reads everything from disk and posts the offer **to `MOVE_NEW_ORIGIN` only** (never `*`): the book's IndexedDB store
   whole (`current`, `rev`, the merge's base `synced`), the photos with a SHA-256 each, the listed entries, the three keys (the
   token decrypted from memory), a nonce and the book's SHA-256.
6. The new one takes an offer only from `MOVE_OLD_ORIGIN` and only from `window.opener`; checks its shape (only the store's known
   keys, only listed entries, photos as blobs); refuses if it already holds a book; writes the photos, the entries, the keys through
   their setters (the token **locked again** under its own non-extractable device key) and the store in one transaction; **reads
   every piece back** and compares; then marks itself (`sep_inv_move_in`) and answers with counts and the book's digest. Any
   failure undoes what it wrote and answers why; it stays empty and waiting.
7. The old one compares the answer with what it sent (digest and every count). Only then it marks itself moved
   (`sep_inv_moved`), deletes its keys if the box was ticked, stops being the print station if it was one (the mark crossed; two
   stations would print each job twice; *Undo* gives it back), and covers its window: this device's old address forwards from now
   on. A move whose dialog was shut is shown again where it stands, never started twice.

**The new address waits.** With no book (no mark, the database never held one, none in it), `moveGate()` draws *Waiting for the
book* and the app does not start: no default book is saved, nothing is seeded, no key is read. *Another way* (folded): start empty,
then pull from GitHub or import a backup; that closes the handover on the device.

The waiting screen, the forward and the moved window are drawn before the app starts or in place of it, over the inert shell
(`.inv-move-screen` takes input while `body:not(.inv-booted)` does not): no screen of the app, so no `navLoc` line. The move's
dialogs open through `dialogOpen`; the old side's questions are `uiConfirm` and `uiAlert`.

**The old address forwards** only once marked, to the same screen (`?tab=…` kept). `?stay=1` opens the copy left behind, which says
so in a notice; its Settings section offers *Open the new address*, *Undo the move* (the mark removed; keys deleted at the move are
typed again) and *Delete the copy left here* (its databases and every `sep_inv*` entry but the mark; never `sep_ck_card`).

**`checkin.html` stays on the old address** (each worker's phone keeps its card there, `sep_ck_card`); the office QR made on the new
address points at it (`moveCheckinBase`, `ckUrl`).

**Run from a browser tab**, in the browser the app is installed in (Chrome on a phone, Edge on the PCs): the handover reads the old
origin's storage in that browser. The installed app's own window may not keep the opener when it opens another origin; the section
says so when it is drawn in one.

### What crosses, and what does not

Every storage key the code names is in one of move.js's three lists; P280 fails on a key in none of them, or one named nowhere.

| Store | Key | Crosses? | Why |
|---|---|---|---|
| IndexedDB `sep-invoicing` | `state`: `current`, `rev`, `synced`, `unreadable-*` | yes, whole | The book, its revision, the merge's base (so the first sync there merges), any copy set aside |
| IndexedDB `sep-invoicing-media` | `images` | yes | The knowledge base's photos, each checked by SHA-256 |
| IndexedDB `sep-invoicing-keys` | the device key | **no** | Non-extractable by design; the token is locked again under the new address's own key |
| IndexedDB `sep-invoicing-widget` | payload, queue | no | The Windows widget is the installed app's; it is added again from the new one, which writes its own payload |
| localStorage | `sep_inv_github_token` / `_enc`, `sep_inv_claude_key`, `sep_inv_metals_key` | yes, as keys | Through `setGhToken`, `phKeySet`, `setMetalsKey`; read back |
| localStorage | `sep_inv_github_sync`, `sep_inv_device_id`, `_name`, `_cut` | yes | The device's sync position and registration: nothing is registered twice |
| localStorage | `sep_inv_face_page`, `sep_inv_prod_photo_read` | yes | Work typed and not yet saved |
| localStorage | `sep_inv_print_station`, `_print_sent`, `_print_log`, `_prt_light`, `_prt_ack` | yes | The print station's mark and its history |
| localStorage | `sep_inv_guard_last`, `_guard_fail`, `_guard_seen` | yes | The guard's entries on the device (a lockout crosses with it); never a PIN, which is the book's |
| localStorage | appearance, `sep_inv_layout`, `sep_inv_home`, `sep_inv_folds`, view and tab choices, recents, pointers, `sep_inv_todo_seen`, `sep_inv_last_export`, `sep_inv_tata_read`, `sep_inv_claude_spent`, `_nofallback`, `sep_inv_err_off` | yes | What a person set on the device (`MOVE_CARRY_LS`) |
| localStorage | `sep_invoicing_state`, `sep_invoicing_rev` | as the book | The book kept the old way crosses as the book |
| localStorage | `sep_inv_idb_used` | no | The new address writes its own when the book lands |
| localStorage | `sep_inv_err_queue`, `sep_inv_feeds`, `sep_inv_probe` | no | Reports queued at the old address; a copy of the news and weather; a scratch entry |
| localStorage | `sep_inv_gemini_*`, `sep_inv_prod_photo_draft` | no | Retired, removed at every start |
| sessionStorage | `sep_inv_session`, `sep_inv_nav_trail`, `sep_inv_ws_last` | no | This tab's: **a sign-in never crosses**; sign in again there |
| localStorage (checkin.html) | `sep_ck_card` | no | It stays on the old address with checkin.html |

### Under test

The test server (`tests/e2e/server.mjs`) rewrites the three lines naming the addresses, only for a request carrying P280's header,
to two origins of itself: `127.0.0.1` the old, `localhost` the new. The checks are the built ones. P280 covers the move whole (both
layouts, swept as P76 sweeps), a new address that does not keep a write (the old one says *Nothing was moved* and nothing changes on
either side), a push refused and no sync, offers and answers forged from another origin and window both ways, the waiting screen,
the forward, the copy deleted, `dist/`, the key lists and the CSP. A mutation that drops the new side's origin check fails it.
