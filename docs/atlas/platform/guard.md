---
subject: "The guard"
domain: platform
modules: [split/approve.js, split/changelog.js, split/devices.js, split/guard.js, split/merge.js]
specs: [docs/GUARD.md]
tests: [P140, P141, P142, P146, P175, P244, P278, P282, P283, P284, P285, P286]
updated: 2026-11-21 (another person signing in empties the hidden pages, P286; the export is the owner's alone, P285; a sign-in approved from a device of the owner's; the borrowed device, P284)
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
- **Another person signing in empties the pages not on show** (`tabClearOthers`, tabs.js, called by `grdAfterUser`; P286; the
  owner, 21 Nov 2026). The pages the last person opened stayed drawn, hidden, with their figures, for a role that could not
  open them. Now every page but the one on show is emptied once that one is settled (so a page the role was sent away from
  goes too), with the marks that say a page is drawn, the last person's selections and an invoice left half typed. Each is
  drawn again from the book when next opened. The same person coming back keeps theirs. The book itself is still on the
  device: this is about what is drawn, not what is stored.
- **Taking the book out whole is the owner's alone too** (`exportData`, settings.js, P285; the owner, 21 Nov 2026). Export JSON
  wrote the whole book for any role, with only workers' personal details left out, so a role shown no rupee on screen took every
  invoice, rate and wage away in the file. Now another role is refused with a word, the button is drawn only for the owner, and
  under the lock nothing is written. Another role's device is backed up by the GitHub sync: where a save did not land, its
  banner offers *Back up now* if the sync is set up, and names the owner if it is not (`storageBannerWayOut`, state.js). The
  owner is not asked his PIN again for it: an export changes nothing. A screen's own exports (Excel, the bank's JSON) are not
  this: each holds what its screen shows the role.
- **A passkey beside the PIN** (`guard.js`, P283; step 1: added, nothing removed). The owner can sign in, and answer the re-ask,
  with a passkey made on the device (WebAuthn: the fingerprint, face or screen lock the device already keeps). **The book keeps only
  its public key**: `users[].passkeys` `[{id, pub, alg, dev, name, at}]`, the credential's id (base64url), the public key (SPKI,
  base64), its algorithm (ES256 or RS256 only), the device it was made on (`devId`, `devName`) and when. Each sign-in is a fresh
  32-byte challenge the device signs; the page checks it with WebCrypto (`grdPkVerify`, WebAuthn L2 §7.2): the client data (a get,
  the challenge sent, this origin), the authenticator data (this host's hash, the user present and verified), the signature against
  the key held, the credential one of the user's; the signature count is not read (a synced passkey reports 0). **Offered only where
  `grdPkSupported` says yes**: WebAuthn and a user-verifying platform authenticator, a secure context, and a host of the app's own
  (`grdPkHostOk`): never the shared `*.github.io` address, where a passkey would bind to a host other projects share, nor an IP
  address. Added from Settings → Access → Users & access, on one's own row (*Add a passkey for this device*, through the gate for
  users; the owner's row only in this step, `grdPkFor`); each listed by its device and date with Remove (asked first, the same gate).
  **On the lock and the re-ask a passkey comes first** and *Use the PIN instead* shows the PIN; a right passkey takes the right
  PIN's path (that ID's count cleared, the session, the grace); a cancel says so and shows the PIN, uncounted; an answer that does not
  check is counted as a wrong PIN. A PIN from before is not asked to become four digits after a passkey: its next PIN sign-in asks.
  The book's guard signature carries the passkeys' ids (`grdBookGuardSig`), the merge keeps each side's added and removed by id
  (`grdPkMerge`, nothing held), and the change log says a count (*1 passkey*), never the key.
- **A sign-in approved from a device of the owner's** (`approve.js`, P284; step 2, owner 21 Nov 2026). He signs in with his
  passkey on his own devices; on any other, the way in is **a request approved from one of his**. Offered on the lock (the owner
  chosen) and in the re-ask where he holds a passkey and none was made on this device (`grdApOffer`), and on the new address's
  waiting screen when it holds no book (*Sign in from a device of mine*); only where `grdPkHostOk` says yes (never github.io).
  **The request (B)**: a random id (16 bytes), an ephemeral ECDH P-256 key pair (its private half non-extractable, in memory
  only), a 32-byte challenge, shown as a QR (`qrSvg`, versions to 20) and a link, `<origin>/#approve=<base64url of {v, id, k, c,
  n, b}>` (k B's raw public key, n its name, b it holds no book), with a **check code** of six digits off the SHA-256 of that
  text, which A shows too. B asks the relay (`/api/relay/<id>`, `core/new-address.md`) every 2 s for up to 2 minutes and stops
  when its view closes; 410 or the time out says so and offers a new one. **The approval (A)**: the app opened at that address
  (the hash taken off at once, `grdApTake`; a window already open reads it on `hashchange`) shows the owner signed in where his
  passkey is offered *Sign in as … on …?*, the code and, when b, *Let it load the book (gives it the sync token)*, on by default.
  Approve: his passkey signs SHA-256(`sep-approve-v1|id|k|c`) (`grdPkGet` with that challenge), A checks its own answer, and
  sends `{v, uid, a}` (and, ticked, the sync settings and the token) sealed to B's key: its own ephemeral ECDH key, HKDF-SHA-256
  (salt c, info `sep-approve-v1`) to AES-GCM 256, a 12-byte IV, `sep-approve-v1|id` as associated data; PUT as `{v, k, iv, ct}`.
  A 409 says the request was answered from somewhere else. A user or a device that cannot approve says why (not the owner, no
  passkey here, the guard off, github.io, a link cut short, no book here). **Back on B**: opened, the uid the one chosen (the
  owner), the assertion checked (`grdPkVerify`) with the same challenge; then the path a right PIN takes, or the re-ask's yes. A
  check that fails signs nobody in and is counted as a wrong PIN; an answer that does not open is not. **The token never reaches
  the screen, a log, the change log or S.**
- **A device with no book: borrowed** (owner 21 Nov 2026). With the token, B stores the settings and the token as GitHub sync
  keeps them (`setGhConfig`, `setGhToken`: locked to the device), reads GitHub's copy, and checks the assertion against **that
  copy's** owner before anything lands (a fetched copy checked first, rather than the book once on B: nothing unchecked is ever
  written); then the book is written as the handover writes one (the store's `current`, the merge's base at that SHA, the SHA
  recorded), the new address marked (`sep_inv_move_in`, `how: 'approve'`), `sep_inv_borrowed` `{at, lastUsed, uid}`, the session
  started, and the page loads onto it. Any failure removes the token and the settings again (`devForgetToken`). After that load it
  **registers itself** (`devRegister`, name *… (borrowed)*, the owner as its user): the gate is the owner's, inside the re-ask
  window the approval opened, so the approval is the check, and the first push carries the registration. **Sign out and clear
  this device** (Settings → Data & device, and the account menu, on a borrowed device only) pushes first (`ghPushLocked`); a push
  that fails clears nothing and says why. Once it lands: the book's databases (`sep-invoicing`, `-media`, `-keys`, `-widget`),
  every `sep_inv…` entry in local and session storage **but the theme, the palette and the density** (`GRD_BW_KEEP`: how it looks,
  nothing of the book), the session; other windows are told on the guard's channel; then the waiting screen. Its use is noted
  at most once a minute (`lastUsed`). **Opened after 12 h unused** (at the start, or shown again) it is **held**: locked, only the
  owner's approval opens it (no PIN, no other ID), it pushes when it can (at once, on `online`, when shown) and clears after a
  push that lands; it never clears unpushed work. **A lock never clears it.** Reports already downloaded stay: they are files.
- **Wrong PINs are counted per ID** (`sep_inv_guard_fail`, `{ids, all}`): one ID's right PIN clears its own count only, and the
  recovery code counts under the owner. **One's own PIN is changed with the PIN it has** (*Change my PIN*), never reset, and a
  new recovery code asks the owner's PIN whatever the window: an owner who forgets the PIN with no recovery code cannot reset it.
- **Nothing a role decides is drawn while nobody is signed in** (`grdHeld`): the unlock draws the screen for whoever unlocks and
  shuts what somebody else left open (`grdAfterUser`); a launch waits for it (`grdWhenIn`). **Each role sees what its screens
  show**: its tasks (`todoSees`; the finance rules need money, the pay ones wages), Needs you's inputs, the bar's counts, Home's
  widgets and their moves, Pipeline's *Owed to us*, a client's Money panel, Stock's forecast, Production's labour per kg, Staff's rupees
  (`attSeesWages`), Power's Case (money and wages both, `powerCaseSees`, P278) and a cut's wages on Cuts (`powerSeesWages`, P282); a To-do jump to a page the role does not open opens nothing (`todoGo`).
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
  compile). A PIN, a token or a key never does. The sync token crosses only from one device of the owner's to another, inside an
  approval he signed, sealed to the other device's key, through the relay (`approve.js`; `docs/DATA_FLOWS.md`).
