# The server: one SQL book in the cloud, a full copy in the office

**Status:** spec, not built. Owner, 15 Oct 2026; revised the same day with the owner's rulings (§1), then again after its review
(§1, *the review's answers*). Six steps, S0–S5, one PR each (§9). Nothing changes on any device until S1 is built and switched on in
Settings.

## §1 The owner's words

- 15 Oct 2026: *"Can we connect the app to a free server or a local database? It could be the same machine that will be in the office
  as a kiosk printer, always switched on and when connected to the internet, it acts as the server? We definitely need SQL to store
  our data, we are generating a lot of it and dependent on an access we can't always control … We could use some of Claude's 100$ API
  credits, you just have to show me how."*
- *"Once we have our local server, we could send messages from the server to our chat app, to be developed, till then let's use a
  workaround."*
- The answers: **hub: both** (the cloud and the office); the office PC is **Windows, on a UPS**; the office internet is down **5–10% of
  the time**, a phone's hotspot standing in when the plant runs; the domain is **somaelectro.co.in**, already the shop's; the order is
  **KB2-1 now, this spec beside it**.
- The walkthrough's rulings, 15 Oct 2026:
  - *"I would like to move it to app.somaelectro.co.in"*: the app's own address, **first** (S0), before any device registers with the
    server.
  - **Android only, installed directly** (*"Everyone has an Android for now, so we'll just build for that … currently, we'll do a
    direct install"*); the Play Store later if it is needed. Wanted of it: **notifications** and **running in the background**;
    drawing over other apps only if a need shows. The owner asked what *a phone locked to the app* meant (kiosk mode); it is not
    wanted: each person's phone is their own.
  - **Record by record from the first step** (S1 and the old S2 are one).
  - **The print station runs signed in**: *"the system is signed in to windows, app open and minimised and locked - it still executes
    print order"*.
- **The review's answers**, 15 Oct 2026 (the review found what the first draft would lose or get wrong; §4–§9 carry its findings):
  1. *"Everything goes to the server, it'll be behind a PIN or encrypted if the material is too sensitive."* This replaces the earlier
     *"Local device only, for now"* for private records (§4).
  2. *"Only three devices registered as of now, my phone, my laptop (office desktop) and office server desktop, so it can carry info
     no issues."* The move to the new address carries each device's own registration and GitHub token with the book (§9, S0).
  3. *"APK. The app is not opening on [a supervisor's] android phone through the web app feature, it opens and closes instantly on
     tapping on it."* The shell is chosen after that phone is diagnosed (§9, S5).
  4. *"Start with free, let me know how it goes. $5 is not an issue either way."* Cloudflare's free plan, with a report after the
     first week (§10).
  5. *"My own cloudflare account, we have developed the website through a different repo."* Everything here is added to that account
     beside the website, which is not touched.

## §2 What is there (looked up 15 Oct 2026)

- `somaelectro.co.in`: nameservers `chelsea.ns.cloudflare.com`, `paul.ns.cloudflare.com` (the DNS is on the owner's Cloudflare
  account); the website answers through Cloudflare's proxy (`server: cloudflare`; the headers look like a Next.js site on Vercel behind
  it), built from another repository; mail is Google's (`MX 1 smtp.google.com`). **None of these is touched**: the server adds
  subdomains only.
- The app today: a PWA on `rishabh1804.github.io` (an origin it shares with the owner's other apps, whose storage pool it shares too),
  the whole book in IndexedDB on each device, synced as one JSON file through the GitHub Contents API, merged record by record
  (`merge.js`, G4), with a change log per save (`changelog.js`). Prints go through the same repository (`remoteprint.js`).
- **The site publishes the whole repository**: `CLAUDE.md` and every file under `docs/` answer from github.io (checked: HTTP 200).
  S0 publishes the app's own files only (§9).
- **The owner's book, 10 Oct 2026** (measured, counts only): 6.4 MB as JSON, 76 stores, about 5,200 records; the largest record about
  29 KB (a client with 198 piece rates); the change log about 180 entries a day; 7 items held by the merge, all of them clock stamps
  written at start-up.

## §3 The shape

```
 phones (the Android app, §9 S5), desktops (the PWA)   ← both from app.somaelectro.co.in, offline-first as now
        │  HTTPS, only what changed
        ▼
 api.somaelectro.co.in  ── Cloudflare Worker + D1 (SQLite)      ← the hub, up through the shop's power cuts
        │  outbound only, every few minutes
        ▼
 office PC (Windows, UPS, signed in) ── the agent: a SQLite copy of all the hub holds, nightly backups, the print queue
```

- **The hub is in the cloud** so it answers while the shop is dark or offline; the owner's phone at home and the supervisor's on
  mobile data reach it. **The office PC keeps a copy of everything the hub holds** (the sensitive records as the hub holds them,
  sealed, §4) under the shop's roof and survives the cloud going away; it only ever calls out, so nothing on the office network is
  opened to the internet and no tunnel is needed.
- **Every device stays offline-first.** The book in IndexedDB is still what the screens read; the server is where devices meet. A
  device with no signal works as today and catches up when it has one (the 5–10% the office is down, a hotspot or not).
- **GitHub sync stays on** through S1; from S2 it is optional on devices and the agent's nightly backup takes its place (§7).

## §4 The data

**D1** (Cloudflare's SQLite). Three tables do the work, so the 76 stores of the book need no table each before it is useful:

```sql
records  (store TEXT, id TEXT, rev INTEGER, at TEXT, by TEXT, device TEXT, deleted INTEGER, sealed INTEGER, body TEXT,
          PRIMARY KEY (store, id))
CREATE INDEX records_rev ON records (rev);          -- required: every pull reads by rev (§5)
changes  (rev INTEGER PRIMARY KEY, store TEXT, id TEXT, at TEXT, by TEXT, device TEXT, kind TEXT, fields TEXT)
held     (id TEXT PRIMARY KEY, store TEXT, rid TEXT, at TEXT, body TEXT)   -- what the merge held for the owner
```

- **A record is what the merge already treats as one** (`mrgUnits`, merge.js), never `CHG_TRACK` alone: an invoice, a challan, an
  entry, a worker, a cheque; a settings object is one record (id `-`); **the series' next numbers** (`MRG_MAX`, the higher wins),
  **the one-time flags** (every `_` key on the book: 15 on the owner's book, each one record, true wins), **the change log** (unioned,
  never merged field by field) and **the held items** (their own table) are records too. A store the merge does not list is not
  synced until it is listed, and a spec fails on a store the book has and the list lacks.
- **An attendance day is merged hand by hand**: a day is one record whose `marks` hold every hand (23 on the owner's book), so two
  devices marking two hands on one day would hold one of them for the owner. `marks.<staffId>` is merged as its own record inside the
  day, and so are the EXTRA rows by their slot (`relayExtraSlot`).
- **`rev`** is one counter for the whole book: every write takes the next. `changes` keeps who changed which fields, the change log's
  own shape, kept for good on the server (the book's log stays trimmed at 90 days).
- **Typed tables come when a report needs them** (invoices by month and client, production by line and day), filled from `records`
  by the Worker. SQL over JSON (`json_extract`) answers the rest.
- **Everything goes to the server; the sensitive is sealed** (owner, 15 Oct 2026, above). Two kinds:
  - **Owner-only, served only to the owner**: what a role may not see today (wages and rates, money) stays a record like any other,
    and the Worker leaves it out of what it sends a device signed in as another role. **This is only as strong as the device's own
    guard**: the PIN hashes travel with the book, so a person who can copy the book from a device can read them; the Worker cannot
    check a PIN it never sees (§6).
  - **Sealed, readable on the owner's devices alone**: a worker's personal details (`w.profile`), the check-ins
    (`S.peopleCheckins`), the knowledge base's private notes, the motivation index's inputs (one list, `SRV_SEALED`). The device
    encrypts each such record (AES-GCM) before it leaves; the key is made once on the owner's device and kept wrapped by the owner's
    PIN (PBKDF2, as the guard's own hash); the hub and the office copy hold only ciphertext (`sealed = 1`). A new owner device unwraps
    the key with the PIN. **A forgotten PIN with no recovery loses the sealed records**: the owner's recovery code (guard.js) wraps the
    key as well, and Settings says so before the first seal. A spec sweeps every request body for a sealed field in clear.
- **A row's size** (Cloudflare's limits, read 15 Oct 2026): a row up to 2 MB, a statement up to 100 KB, 100 bound parameters a query.
  The largest record is about 29 KB, so a push sends records as bound parameters a few to a statement and never builds a statement
  past 100 KB; a record over 90 KB is refused with its name (none exists).
- **Start-up fixes write no clock** (the merge's own lesson: the 7 held items on the owner's book are stamps two devices wrote at
  start-up). A fix that must say when it ran keeps the day, as `startWas` does, never `Date.now()`; a spec boots the book twice and
  compares.

## §5 Sync

- **Pull**: `GET /sync?since=<rev>` → the records changed since, and the latest rev **read off the rows returned** (never a second
  `MAX(rev)` read, which a write between the two would make wrong). Applied to the book as a pull is today, then the screens redraw
  (`bookReload`'s way).
- **Push**: `POST /sync` with **each record that differs from the copy last synced** (the base `merge.js` already keeps, IndexedDB key
  `synced`), sent **as both its base and its new version**, so the Worker can merge three ways. Compared, never read off the change
  log: the log leaves out the words of a note, a profile and a check-in by design.
- **The Worker merges with `merge.js` itself**: one file, loaded by the app and bundled into the Worker, so the rules cannot drift
  (one side changed, it is taken; both changed one field, the owner's stands, else the later, the other held). **Each write is a
  compare-and-set**: `UPDATE … WHERE store = ? AND id = ? AND rev = ?` inside one `batch()` (D1 runs a batch as one transaction and
  nothing else); a record whose rev moved meanwhile is merged again with the newer copy and retried. Two devices pushing at once can
  then never write over each other.
- **When**: after every save (debounced 5 s), when the app comes into view, and every minute while it is open. A failed push waits and
  tries again; nothing is lost while it waits, since the book on the device has it.
- **On the free plan** a request has 10 ms of CPU and 50 queries, so a push goes in batches of about 20 records; a day's writes (about
  180 changes, each a record row, a change row and its index) are far under the 100,000 rows a day. **The rev index is what keeps
  reads free**: without it every pull scans the book (about 5,200 rows × a pull a minute × 4 devices is some 30 million rows a day,
  six times the free 5 million); with it a pull reads only what changed.
- **First upload**: the owner's device sends the whole book once (S1), record by record in batches; every other device then pulls.

## §6 Who may do what

- **A device** gets its own secret when the owner registers it (Settings → Access → Devices, as today, now confirmed by the server):
  every request carries it, the Worker keeps only its hash, and a device the owner removes is refused at once, everywhere. Three are
  registered today (the owner's phone, the owner's laptop and the office PC).
- **A person** signs in on the device as today, and each request names who. **No PIN goes to the server**, so the Worker trusts the
  device's word for the person: what it serves a role (§4) is a convenience bounded by the device's guard, and what must not be read
  without the owner is sealed (§4), which the Worker cannot open either.
- **The Worker answers only the app's own origin** (`https://app.somaelectro.co.in`, CORS), limits requests per device, and keeps its
  secrets (the Anthropic key, the device-secret salt) as Worker secrets, never in this repository, which is public.

## §7 The office PC

A small program (Node; `office/` in this repo), the **agent**. **It runs in the signed-in session, started by a task at logon, never as
a Windows service**: a service runs in session 0, which has no printer dialogs and no browser to print with. The PC is kept as the
owner keeps the station now (signed in, the screen locked: a locked PC with the app open and minimised still prints, the owner's check
of 15 Oct 2026), on its UPS, set never to sleep. It is a registered device like the other two.
- **The copy**: every five minutes (and when the internet comes back) it asks the hub for what changed since its rev and writes it to
  `C:\SEP\book.sqlite`, sealed records as they are.
- **Backups**: nightly, the SQLite file and the book as JSON, kept 30 days on the PC, and the JSON pushed to the GitHub repository
  **under its own path** (`backups/book-<day>.json`), **never the sync file**: written there, a device still on GitHub sync would pull
  it as a book, and the sealed records in it would replace the open copies on the owner's devices.
- **When the hub is unreachable** the PC keeps its copy and prints what it already took; phones keep working on their own books.

## §8 Claude: *Ask the knowledge base*

- `POST /ask` on the Worker, with the question and the device's sign-in. The Worker **searches first** (the articles that person's role
  may read, `kbCanRead`'s rule on the server, ranked by the question's words as the Library's Ask ranks them), sends the best five and
  the question to Claude, and answers with the reply and the articles it rests on, each a link. An answer is never saved as an
  article.
- **What it reads**: published articles only. **On the owner's book 141 of 142 articles are drafts**, so Ask answers from nearly
  nothing until the owner publishes; that is the first job before S4 is useful. **The app's own guides are in the build, not the
  book** (`KB_APP_GUIDES`): the deploy hands the Worker the build's guides as a file.
- **Cost, measured on the owner's book and the list prices**: the whole knowledge base is about 34,000 tokens, so sending all of it is
  about 54,000 tokens a question, about **$0.26 on Opus 5.5** (about 380 questions on $100). Sending the five best articles instead is
  about 8,000 tokens, about **$0.06** (about 1,600 questions). Caching does not pay here: a cached prefix costs 1.25 times to write and
  expires in five minutes, and the shop asks a question an hour, not a minute. Sonnet 5.5 halves each figure; the model is the owner's
  to change.
- **The key**: created by the owner at console.anthropic.com → API keys, with a **monthly spend limit** set under Billing; given to the
  Worker as a secret (`wrangler secret put ANTHROPIC_API_KEY`), never typed into the app or a chat.
- Questions and answers are kept on the server for a month (to see what is asked and what the knowledge base lacks), never sent to
  Sentry.

## §9 Steps, one PR each

0. **S0 · The app's own address.** `app.somaelectro.co.in`, a Cloudflare Worker serving static files (free; deployed from this repo on
   merge, a preview per PR). First because every device's storage, GitHub token and (from S1) server secret belong to an origin:
   moved later, every device would register twice.
   - **Only the app is published**: the build writes the app's files to `dist/` (the page, `sw.js`, the manifest, the icons,
     `version.json`, the widget's template) and only `dist/` is served; `CLAUDE.md` and `docs/` are not. The Worker's own
     `*.workers.dev` address and any preview answer with a redirect to the custom domain, so no second origin collects a book. The one
     Worker can later serve `/api` too (S1), one deploy, one origin.
   - **The book crosses by a handover, never by hand**: the old address offers **Move to the new address**, which checks everything is
     pushed, opens the new address and hands everything over between the two windows (`postMessage`, checked by origin both ways), the
     new one verifying it on disk before the old one says so. **Everything** means: the book; the photos of the knowledge base (their
     own database, `sep-invoicing-media`); register pages typed on Mine and not yet saved (`sep_inv_face_page`); **the device's id and
     its GitHub token** (three devices, the owner's ruling: carried, so nothing is registered twice); the metals.dev key; the print
     station mark (`sep_inv_print_station`) and the Edge shortcut's address, which the guide for the station says to change; Pulse's
     layout, the appearance and the folds. A device that cannot hand over pulls from GitHub, or imports a backup.
   - **The new address starts empty and waits**: until the handover lands it draws a *Waiting for the book* screen and seeds nothing
     (`seed.js` fills 50 demo challans into an empty book; on the new address it never runs before the handover or a pull).
   - **Run from the browser the app is installed in** (Chrome on a phone, Edge on the PCs): the handover reads the old origin's
     storage in that browser.
   - **Pointing at the new address**: `rishabh1804.github.io/sep-invoicing/` keeps a page that forwards there once a device has
     handed over (never before: the book would be left behind); Sentry's allowed domains add it; `ERR_HOSTS` adds it. **`checkin.html`
     stays where it is**: each worker's phone keeps its card on that origin (`sep_ck_card`), and moved, every worker would enter it
     again; the office sheet is not reprinted.
1. **S1 · The hub, record by record.** `server/`: the Worker, the D1 schema with the rev index (§4), device secrets, `GET/POST /sync`
   by record and rev (§5), `merge.js` shared, compare-and-set writes, *Held for you* from the server, sync every minute, the first
   upload; sealed records (§4); Settings → Connections → **Server** (on per device; GitHub sync untouched). Deployed from GitHub
   Actions on merge (§10).
2. **S2 · The office copy.** `office/`: the agent, its install as a task at logon, the five-minute copy, nightly backups to disk and
   to their own path on GitHub. GitHub sync becomes optional on devices.
3. **S3 · The print queue through the hub.** Jobs move from GitHub files to the hub (`print_jobs`); **the PWA station stays the
   printer** (it prints, the owner has checked it locked) and only reads its queue from the hub instead. The agent printing on its
   own is not built unless the station fails.
4. **S4 · Ask.** `/ask` (§8), the Library's *Ask* answering in words with its sources; the key and the limit set by the owner;
   published articles only.
5. **S5 · The Android app.** **First, the phone that will not open the web app** (it opens and closes at once): its model, its Android
   version, Chrome's version and *Android System WebView*'s version (Settings → Apps), its free storage; whether the address opens in
   a Chrome tab; whether it opens after Chrome → Settings → Site settings → All sites → the app's address → **Clear and reset**, then
   installing again. What that shows picks the shell:
   - **If Chrome itself is sound on that phone** (the address opens in a tab), the APK is a **Trusted Web Activity**: a thin signed
     shell that opens the PWA in Chrome, sharing Chrome's storage (no second move of the book), updated with every merge, notifying by
     Web Push and syncing in the background by Chrome's own periodic sync.
   - **If Chrome is what fails there**, the APK is **Capacitor with the app bundled inside it** (Capacitor says its `server.url`, a
     shell loading the live address, is not for production). Its book is a new storage: **a new phone registers and pulls the whole
     book from the hub** (S1 makes that a pull, no handover). A web change then reaches phones with a new APK or Capacitor's live
     update. **Its background runner has no IndexedDB** (fetch and a small key-value store only, at most every 15 minutes), so
     background sync is a few lines of native code that wake the app's own sync, or none until the owner asks.
   - **Notifications are decided on the server**: a Worker cron (every 15 minutes; 5 crons on the free plan) reads the hub's records
     for what needs a person (a roll late, a task raised for their duties, a cut with no reason) and sends each person only their own
     duties' notice, by Web Push for the TWA or Firebase Cloud Messaging for Capacitor. A phone shows one with the app closed.
   - **Installed directly**: a signed APK, from a link on the new address; each phone allows *Install unknown apps* once, and Play
     Protect's warning is expected. **The signing key is kept by the owner, off this repository, with a copy off the PC**: lost, no
     phone can take an update.
   - **Drawing over other apps**: not built until a need shows. The Play Store (a developer account, its review) only if the owner
     later wants it.

Each step: the specs fake the Worker (as they fake GitHub today); a Worker test suite runs on CI (`vitest` with Cloudflare's local D1),
two fake devices pushing at once included; the owner's book uploaded to a test database, counts compared store by store, before any
device switches.

## §10 What the owner does

All of it in **the owner's own Cloudflare account**, beside the website, which is not touched.

**S0**: in Cloudflare, **Workers & Pages → Create**, from this repository (the deploy builds `dist/`; the S0 guide names each screen
as it is that day), then the Worker's **custom domain** `app.somaelectro.co.in` (the DNS record is made for you). Then the handover on each of the
three devices, the owner's phone first.

**S1**:
1. In Cloudflare: **My Profile → API Tokens → Create Token**, from the *Edit Cloudflare Workers* template, plus D1 edit, limited to the
   account. Copy it once.
2. In GitHub: the repository's **Settings → Secrets and variables → Actions → New repository secret**, named `CLOUDFLARE_API_TOKEN`,
   and `CLOUDFLARE_ACCOUNT_ID` (Cloudflare's dashboard shows it). The workflow deploys the Worker on each merge; the token never
   appears in the code.
3. In Cloudflare **DNS**: nothing to add by hand; the Worker's route `api.somaelectro.co.in` is created by the deploy.

**S2**: on the office PC, install Node LTS, then run the one installer command the S2 guide gives; keep the PC signed in, as now.

**S5**: send the failing phone's model and versions (§9, S5), then keep the signing key the build hands over (two copies, one away
from the office); on each phone, open the install link and allow it.

**The free plan, and the report** (owner: *"Start with free, let me know how it goes"*): a week after S1 is on, the build's session
reads the Worker's dashboard (requests, CPU time, D1 rows read and written, storage) and reports it against the free limits (Workers:
100,000 requests a day, 10 ms CPU a request; D1: 5 million rows read and 100,000 written a day, 500 MB a database, 7 days of Time
Travel). The paid plan (about $5 a month: 30 s CPU, 10 GB a database, 30 days of Time Travel) is taken only where a figure is near
its limit.

## §11 Known assumptions

| # | Assumption | What would show it wrong | Fix path |
|---|---|---|---|
| 1 | The free Worker and D1 limits cover the shop (§5's arithmetic) | The week's report (§10), a limit e-mail or a refused write | The paid plan (about $5 a month) |
| 2 | Five-minute office copies are close enough | A day lost with the cloud | Shorten the interval; the agent pulls on every rev |
| 3 | One rev counter for the book scales | Slow pulls past a million changes | A rev per store |
| 4 | One `merge.js` on both sides holds what it holds today | Held items the device's merge would not have held | The shared file, tested on both sides |
| 5 | A locked, signed-in PC keeps printing (the owner's check, 15 Oct 2026) | A job that waits while the PC is locked | Windows' auto sign-in on the station's own account |
| 6 | Android lets the app sync in the background (TWA: Chrome's periodic sync; Capacitor: native wake) | A phone whose entries reach the hub only when opened | The battery setting named on that phone; a foreground service while a duty is due |
| 7 | The owner keeps the PIN or the recovery code | Sealed records nobody can open | The recovery code wraps the key too; Settings says so before the first seal |
| 8 | A device's guard is enough for owner-only (not sealed) records | A copied book read off a device | Seal that kind as well |
