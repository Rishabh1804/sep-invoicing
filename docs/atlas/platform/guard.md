---
subject: "The guard"
domain: platform
modules: [split/changelog.js, split/devices.js, split/guard.js, split/merge.js]
specs: [docs/GUARD.md]
tests: [P140, P141, P142, P146, P175, P244]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### The guard
`docs/GUARD.md` (owner, 1 Oct 2026), steps G1 to G3. P140–P142.
- **No owner, no guard**: until the owner's ID is created (Settings → Access → Users & access) the app works as it always
  has, on every device and in every spec.
- **The gate** (`guard.js`, P140): IDs and PINs (a salted PBKDF2-SHA256 hash, never the PIN), roles (Owner, Office,
  Supervisor, Floor; each role's pages, what it may change, and whether it sees wages and money are settings), the lock at
  a fresh open and after a while in the background, **Lock now**, a recovery code for the owner. **A P1 change asks the PIN
  again** once the re-ask window has passed (`grdOk` / `guardAsk` / `grdGate`): invoices and credit notes (an invoice's state
  too; Print marks Printed on the permission alone, since the print dialog cannot wait), rates and the client master, voids,
  payments and wages (Finance's edits included, `bankGate`), the floor's imports, Settings (an area's complement included),
  users and devices. A role that may not make a change is told so and never asked. A page a role may not open is refused with
  a word and its doors are hidden (`grdApplyDoors`), on the phone bar, the sidebar, the tab rows, Add and the quick actions widget's
  actions; Settings' door too.
- **Replacing the book is the owner's alone** (`grdBookAsk`, the `users` permission; the QA chain of 2 Oct 2026): a backup
  imported (Settings or Add → File) and a pull from GitHub take the users and the guard's settings with them, and `adoptState`
  refuses anyone else. Where the incoming book's IDs, PINs or roles differ, the owner is asked whether to take them
  (`grdBookUsersAsk`); Cancel keeps this book's. The Imports switch covers the floor's records (stock, production, power, a
  roster), which merge.
- **Wrong PINs are counted per ID** (`sep_inv_guard_fail`, `{ids, all}`): one ID's right PIN clears its own count only, and the
  recovery code counts under the owner. **One's own PIN is changed with the PIN it has** (*Change my PIN*), never reset, and a
  new recovery code asks the owner's PIN whatever the window: an owner who forgets the PIN with no recovery code cannot reset it.
- **Nothing a role decides is drawn while nobody is signed in** (`grdHeld`): the unlock draws the screen for whoever unlocks and
  shuts what somebody else left open (`grdAfterUser`); a launch waits for it (`grdWhenIn`). **Each role sees what its screens
  show**: its tasks (`todoSees`; the finance rules need money, the pay ones wages), Needs you's inputs, the bar's counts, Home's
  widgets and their moves, Pipeline's *Owed to us*, a client's Money panel, Stock's forecast, Production's labour per kg and Staff's rupees
  (`attSeesWages`); a To-do jump to a page the role does not open opens nothing (`todoGo`).
- **The change log** (`changelog.js`, P141): every save compared with the book before it, record by record, each changed
  field from → to, tagged with who was signed in and the device; kept in the book (`S.changeLog`), shown in History →
  Changes. The merge (below) reads it to say whose change stands.
- **Who entered it and who changed it** (`changelog.js`, P244; owner, 26 Oct 2026: *"For areas that have multiple people that
  can enter it before my approval, lets simply tag their IDs and show who updated what"*). A stock entry, a production entry, an
  attendance mark and an EXTRA row carry the ID that entered them (`tagIn: {by, at}`) and the ID that last changed them (`tagCh`),
  stamped at each save against the copy the save before left (`tagOnSave`), whatever made the change: a form, a paste, a roll saved
  on Mine, a void. A book that arrives whole (the boot, a pull, an import, another window's save, a merge) is the starting point and
  stamps nothing, so nothing from before is put on whoever saves next; nothing is stamped while nobody is signed in. Said where the
  entry is (`tagWho`: *Entered by Shyam · changed by Rishabh, 28 Oct, 10:42*, the year only when not this one, `tagWhen`): a stock
  entry's row (a meta line of its own under the day and the door, `data-entry-who`), a production entry's fold and pane (*Entered* and
  *Changed*, each the moment then the name), the hand's day dialog (`data-att-who`), an EXTRA row's fold. The change log never compares the stamps (`CHG_OMIT`), and the
  merge never holds on them (`MRG_QUIET`). A mark's own `by` (the ID that typed it, `_attHandEdit`) is kept: Mine's sheet check reads it.
- **Two phones on one day keep both versions** (owner, 28 Oct 2026: *"Tagging - keep both versions"*). A day's marks merge hand by
  hand (`deep: ['marks']` on the attendance row of `CHG_TRACK`, `mrgDeep`): a hand marked on one phone is taken; a hand both marked
  alike (their stamps aside) is one; a hand both marked differently keeps the owner's, else the later, and **the other version is
  held whole** (`marks.<id>`), each with its stamp. The hand's day says so as an analysis on a coded card (design §6.27, §3.3; the
  design pass of 28 Oct 2026 found a sentence of 190 characters, and the owner then found the redraw carried no colour code: *"the
  new options don't carry the colour codes and it escaped the design pass as well?"*): a hero in the warning tone, `data-att-held`
  (eyebrow *Two versions*, the title, the sub *One stands until you pick* or *The owner picks*), a fact row each (*Standing*,
  *Held from the other phone*: the mark its figure in its state's tone, present ok, half warning, absent danger, `mrgMarkRowHtml`;
  who made it under the label), and the owner's two moves its foot (*Use held*, *Keep standing*: `invMrgUseHere`, `invMrgKeepHere`).
  *Held for you* draws a hand's mark the same way: the row names the hand and the day with its moves, and *Stands* and *Held* are
  the same fact rows under it (`mrgHeldRowHtml`; a fact row's `wrap` lets the stamp wrap whole). Only Shyam marks attendance for now (owner, 28 Oct 2026), so
  Deepak's duty is not set.
- **Devices** (`devices.js`, P142): with the guard on, a device pushes and pulls only once registered (Settings → Access →
  Devices, the owner's ID and PIN checked), and a copy goes to GitHub with `_device` beside the book. An unregistered device
  can only import. The token is kept encrypted under a key that cannot leave the device. **A device whose guard was turned on apart from the one that pushed** (its own owner ID, not on GitHub's copy; owner, 14 Oct
  2026: the phone said *add the ID on the owner's device*) registers in GitHub's copy with the PIN of that copy's owner
  (`devRemoteUser`, `grdPinAsk` on the copy's owner), never by a name alone; it takes the copy, its IDs and PINs, and is registered to
  the same person there (same name and role), else to that owner. A device the owner removes stops
  syncing and forgets its token at its next load. With the guard off, sync is unchanged.
- **The merge** (`merge.js`, P175; G4, owner 7 Oct 2026: *"start with 3 and 4"*). Sync had been one book written whole: a push over a
  copy not seen replaced the other device's work, a pull replaced this one's. Now each is a three-way merge against **the copy both
  last saw** (IndexedDB key `synced` beside `current`, with its SHA; `mrgBasePut` after every push and pull that lands), store by store
  as the change log tracks them (`CHG_TRACK`), record by record and field by field. A change on one side is taken; **both changed one
  thing: the owner's stands** (whose is read off each side's change log since the base), else the later, else this device's when the
  owner is signed in here and GitHub's otherwise (`mrgPrefer`), and **the other is held** (`S.mergeHeld`: Settings → GitHub sync →
  *Held for you*, To-do `mergeHeld`, red where two records carry one number); the owner keeps it or uses the one held (`grdGate('users')`).
  A record removed on one side and changed on the other is kept and the removal held; a series' next number takes the higher
  (`MRG_MAX`); a push stamp, LME history and what a challan has billed take this device's, filled from the other (`MRG_QUIET`). The
  change logs are unioned and one line says what was taken and held. The merged book is migrated as a pull's is. **Only where the base
  is the copy at this device's SHA** (`ghMergeRemote`): else the old questions are asked, so the first sync after the build replaces or
  asks as before. A merge is anyone's (nothing is lost); **Replace from GitHub** stays the owner's (`grdBookAsk`). Auto-push merges
  where it used to pause. Not a replay of the change log: the log is trimmed at 90 days and 5,000 entries; the book is complete.
- **Every door to a P1 change asks, wherever it is** (the review of 1 Oct 2026, P146): Add → File asks what its screen's own
  Import asks (an import, the payroll as a payment, a backup the owner's) and refuses a file for a screen the role does not
  open; search lists only what the role's screens show (`srchSees`: an invoice, a credit note, a client, a challan, a bank row,
  a screen, and every other jump by the page it opens);
  Settings → GitHub sync writes the token only when the field was changed, so a token not read yet is never overwritten.
- **Data flows**: `S.users`, `S.guardCfg`, `S.devices` and `S.changeLog` travel with the book (backups, GitHub, the
  compile). A PIN, a token or a key never does.
