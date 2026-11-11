---
subject: "Persistence"
domain: core
modules: [split/github-sync.js, split/init.js]
specs: []
tests: [P93]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

## Persistence

**IndexedDB is the system of record** — database `sep-invoicing`, store `state`, one entry
`current` holding the whole state as a JSON string. No backend and no server-side account;
manual backup/restore via JSON export/import in Settings. localStorage keeps only the small
per-device entries (credentials, sync position, view prefs).

🔴 **Why it moved: localStorage quota is per ORIGIN, and every GitHub Pages project under this
account is served from `rishabh1804.github.io`.** A phone running Chrome 152 refused 128K more
characters beside a 1.67M state, on an engine measured to take 5.1M in a single value — because
the sister PWAs' data held the rest of the pool. Nothing this app could do to its own key would
fix that. IndexedDB has its own quota, sized from the disk, not shared through a 5M-character
keyhole. **Two consequences of the move are load-bearing:**

- **The load is asynchronous, so the bootstrap is.** `let S = null` until `loadState()` resolves;
  `bootState()` assigns it, then `bootApp()` in init.js runs everything that always ran at load
  (state.js's series reset, the bootstrap seeds, `migrateState()`, layout, tab restore)
  in the same order, and adds **`inv-booted` to `<body>`**. Until then the shell is visible and
  inert (`pointer-events: none`). **Nothing between state.js and the end of init.js may read `S`
  at load time** — the seeds are functions now for exactly that reason. Tests wait on
  `body.inv-booted`, never on `nav.inv-tabs`, which is static HTML and proves nothing.
- **IndexedDB can be evicted under storage pressure; localStorage could not.** The app asks for
  persistent storage after its first verified write (`navigator.storage.persist()`); Chrome grants
  it silently to an installed app or an engaged site. The diagnostics report says whether it was.

**A save is still ONE JSON string, written whole and READ BACK.** Writes are coalesced and
serialised: a call while a write is queued shares it, a call while one is in flight queues
exactly one more, and the state is serialised when the write *starts* — so the last write always
carries the latest `S`. That is what makes `adoptState()`'s rollback sound on an async store:
after `S = prev` the queued write is `prev`, whatever a half-migrated write in flight carried.
`saveState()` returns a `Promise<boolean>` that resolves once the copy is verified on disk; the
import waits on it before saying *imported*.

🔴 **Two windows on one book: the version guard** (UX overhaul 2, step 2; owner, 28–29 Sep 2026). Each window holds the
whole book and saves it whole, so a second window used to overwrite the first one's save **without a word** — measured on
the build before this: window A adds a client, window B (open on the older copy) adds another, and the stored book holds
only B's. The installed app and a browser tab open side by side already did this. Now:
- **The saved copy carries a revision** (`rev`, a second key beside `current` in the same IndexedDB store;
  `sep_invoicing_rev` on the localStorage path). A window keeps the revision it last read or wrote (`_diskRev`), and
  `writeGuarded()` checks it and writes **in one readwrite transaction**, which the browser runs one at a time across
  every window of the origin. A save from a window holding an older copy is **refused** (`StaleCopy`): the window loads
  the current copy and says so in the notice banner (*the last change made here was not saved … make that change again*).
- **After every save the other windows are told** (`BroadcastChannel('sep-invoicing-book')`) and load the book at once
  (`bookReload`), redrawing the page in place (`tabRedrawActive`, switchTab's drawing as `tabRender`) with an *Updated from
  another window* toast. A window coming back into view checks the revision too (`bookCheck`), since a frozen tab hears
  nothing. A load replaces `S` and runs **no migration**: a migration saves, and the windows would answer each other for ever.
- **What is being typed is kept**: with a dialog open, a field typed on the page (not a toolbar filter), or a challan form in
  progress, the screen is not redrawn (`bookBusy`), the toast says the typing is kept, and the save lands on top of the
  newer book, since forms save by id into the `S` that is there.
- **GitHub pushes hold one lock across windows** (`ghPushLocked`, Web Locks), reading the config fresh inside it, and a
  window that pushed tells the others which revision went up, so a push still pending elsewhere for that same book is
  dropped (`ghCancelPending`). Without it the second window's push met the first's SHA and auto-push paused itself on a
  copy its own device wrote.
- A copy written straight to the store without a revision (the p16 spec does) is simply the copy on disk; the next load
  reads its revision, whatever it is. P93.

**The legacy localStorage copy is migrated on the first boot that finds the store empty, and
REMOVED once a verified write has landed** — that removal is what hands the shared pool back to
the other two apps. A populated store wins over the legacy key thereafter, so a stale copy left
in localStorage by an old build cannot roll the books back. A browser with no IndexedDB (or one
that refuses to open it) falls back to the localStorage path, verified the same way.

**A copy that exists but would not read is never written over.** The store is read-only for that
session — `persistState()` returns false, the boot banner says so and stays — because seeding a
default book on top of an unreadable copy turns *unreadable* into *lost*. The read-error banner
and the save-failure banner are different kinds; a save that lands clears only the latter.

✅ **Confirmed on the affected phone, 8 Sep 2026 (owner):** on build `05407536`, the import that had
failed since 12 Aug landed, and the data survived a reload. Same device, same Chrome 152, same file —
the only change was the store.

**GitHub sync** is an optional second copy, not a backend. It pushes the whole state as one
JSON file to a repo through the Contents API and pulls it back on another device. It is
deliberately last-writer-wins — the state is a single document with no per-record clocks, so
any merge would be a reconciliation the app cannot verify — but no overwrite is ever blind.
Each device remembers the blob SHA it last exchanged, and if the server's SHA has moved since,
the operator is told whose copy and when before anything is replaced. Auto-push is opt-in,
debounced ~45 s, and pauses itself the moment it sees a copy it did not write.

🔴 **Over 1 MB the Contents API sends a file WITHOUT its content** (`content: ""`, `encoding:
"none"`) while still accepting a PUT of up to 100 MB. The book passed 1 MB long ago, so push worked
and every pull refused a real 4.3 MB backup as *"not a SEP Invoicing backup"* (owner, 25 Sep 2026).
`ghGetRemote()` now asks the same endpoint again for the raw file (`application/vnd.github.raw+json`)
when the content is missing. The push's own conflict check reads only the SHA and downloads the
other copy only when it has to say whose it is. The ceiling is now GitHub's 100 MB.

**Every GitHub request is `cache: 'no-store'`**, and a refused pull says what arrived. The phone kept
refusing after that fix while the desktop pulled (owner, 25 Sep 2026). GitHub marks these responses
cacheable for 60 s and gives a file's JSON and raw forms the **same ETag**, so a browser that
revalidates one against the other can serve the metadata as the file — *a hypothesis: desktop
Chromium did not reproduce it.* Sync needs the live SHA regardless, so the cache is bypassed; and the
error now names the path and what came back (*no content*, *GitHub's description of the file*, *a
Settings → Export backup, not a sync file*, the JSON's keys), so the next report settles the cause
instead of restating the symptom.

**A state that arrives is as old as one read off disk.** Three paths replace `S` wholesale —
the loader, a GitHub pull, and Settings → Import — and only the loader ran the migrations. So a
copy pulled from a device that had never run the area realignment kept its retired `pickling` and
`colour` ids, which `areaStats` drops on the floor (`if (!a) return;`): heads under-counted, every
shortfall inflated to match, and nothing on the card said so until some later reload happened to
fix it. All three paths now run the same two passes — `ensureStateShape()` then `migrateState()`.

**What re-runs and what does not is the load-bearing half.** A structural migration re-points or
repairs records the state already holds, so running it against someone else's backup is as correct
as running it against your own, and running it twice is a no-op. A **seed** writes new business
records and a **cleanup** deletes them, and the flags on an incoming backup describe the device
that *wrote* it, not the records in it — re-firing `_scanSeed1` on a pull would push seven challans
a second time, into the one app here with a module devoted to duplicate receipts. Seeds and the
Belrise rate cleanup stay bootstrap-only, deliberately and in writing.

`ensureStateShape()` is also the one copy of the repair list, read from `getDefaultState()` rather
than restated. There were three copies: the loader's and ghPull's had already drifted by four keys,
and **Settings → Import had none at all** — a backup written before `staff` existed left it
undefined and the Staff tab threw on open. Containers are filled *empty* (the app never invents
business data to repair a shape); config objects are filled from the defaults, key by key, because
`labourCfg()` reads `extraRate || 0` and a missing constant would silently price the extra at
nothing rather than leave a visible gap.

**A save that did not land is said so.** A phone held a 12 Aug copy of the books for four weeks
while every import since reported *Data imported*. Three silences stacked: the save caught every
browser error as "Storage full!", the import's own success toast replaced that toast in the same
tick, and nothing read the value back to see whether the browser had kept it. Now the error carries
the browser's own name for it (`QuotaExceededError`, `SecurityError`, or *write not persisted* for a
store that drops a write without throwing), a failed state save raises a banner that stays until a
save succeeds, and the import refuses to say *imported* when the copy only reached memory.

**Settings → Run storage diagnostics** answers the questions a lost import raises from the device
itself: which store is in use and what it loaded from, the origin's quota usage and whether
persistent storage was granted, what is on disk and when its newest record was written, whether it
matches memory, whether the last save landed, whether the legacy localStorage copy is still
occupying the shared pool, every localStorage key on the origin by size (names only, never values),
and how much more localStorage the origin will take (probed with scratch writes that are read back
and removed — that pool is the sister apps' now, and the figure says whether they are next). The
report is plain text and is copied to the clipboard, so "it reset to 12 Aug" becomes a figure
somebody can paste. **It found this cause where two rounds of reasoning had not.**

⚠ **Two wrong diagnoses preceded the right one, and both were reasoned rather than measured.** First
*storage full* on this app's own 2.1M — under Chromium's ~5M ceiling, so withdrawn. Then *a
smaller-quota browser* — the report named Chrome. The origin's total was the figure neither guess
looked at, because nothing in this app's own key could have shown it. The instrument found it; the
reasoning did not. The move to IndexedDB above is the consequence. The sister apps still share the
localStorage pool with each other; a separate origin per project (a custom domain, or an
organisation account per project) is the no-code answer for them.

Credentials live in their own localStorage entries (`sep_inv_metals_key`,
`sep_inv_github_token`), never on the state object, so an exported backup can never carry one.
Appearance is device-only the same way (`sep_inv_theme`, `sep_inv_palette`, `sep_inv_density`): a backup
must not repaint the phone that imports it.
The sync config (`sep_inv_github_sync`) is kept off `S` for the same class of reason: a file
SHA and a device id describe this device's relationship to the remote, and restoring someone
else's backup must not hand this device their sync position.
