# The server: one SQL book in the cloud, a full copy in the office

**Status:** spec, not built. Owner, 15 Oct 2026; revised the same day with the owner's rulings (§1). Six steps, S0–S5, one PR each
(§9). Nothing changes on any device until S1 is built and switched on in Settings.

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
    drawing over other apps only if a need shows. No phone is locked to the app: each person's phone is their own.
  - **Record by record from the first step** (S1 and the old S2 are one).
  - **Private records stay on the device** (*"Local device only, for now"*): never sent to the server.
  - **The print station runs signed in**: *"the system is signed in to windows, app open and minimised and locked - it still executes
    print order"*.

## §2 What is there (looked up 15 Oct 2026)

- `somaelectro.co.in`: nameservers `chelsea.ns.cloudflare.com`, `paul.ns.cloudflare.com` (the DNS is on Cloudflare); the website
  answers through Cloudflare's proxy (`server: cloudflare`; the headers look like a Next.js site on Vercel behind it); mail is Google's
  (`MX 1 smtp.google.com`). **None of these is touched**: the server adds subdomains only.
- The app today: a PWA on `rishabh1804.github.io` (an origin it shares with the owner's other apps, whose storage pool it shares too), the whole book in IndexedDB on each device, synced as one JSON file through the
  GitHub Contents API, merged record by record (`merge.js`, G4), with a change log per save (`changelog.js`). Prints go through the
  same repository (`remoteprint.js`).

## §3 The shape

```
 phones (the Android app, §9 S5), desktops (the PWA)   ← both from app.somaelectro.co.in, offline-first as now
        │  HTTPS, only what changed
        ▼
 api.somaelectro.co.in  ── Cloudflare Worker + D1 (SQLite)      ← the hub, up through the shop's power cuts
        │  outbound only, every few minutes
        ▼
 office PC (Windows, UPS, signed in) ── the agent: a full SQLite copy, nightly backups, the print station
```

- **The hub is in the cloud** so it answers while the shop is dark or offline; the owner's phone at home and the supervisor's on
  mobile data reach it. **The office PC keeps a full copy** under the shop's roof and survives the cloud going away; it only ever
  calls out, so nothing on the office network is opened to the internet and no tunnel is needed.
- **Every device stays offline-first.** The book in IndexedDB is still what the screens read; the server is where devices meet. A
  device with no signal works as today and catches up when it has one (the 5–10% the office is down, a hotspot or not).
- **GitHub sync stays on** through S1, then becomes the nightly backup (S2).

## §4 The data

**D1** (Cloudflare's SQLite). Two tables do the work, so the 60-odd stores of the book need no table each before it is useful:

```sql
records  (store TEXT, id TEXT, rev INTEGER, at TEXT, by TEXT, device TEXT, deleted INTEGER, body TEXT,  -- body: the record's JSON
          PRIMARY KEY (store, id))
changes  (rev INTEGER PRIMARY KEY, store TEXT, id TEXT, at TEXT, by TEXT, device TEXT, kind TEXT, fields TEXT)
```

- **A record is what the change log already compares** (`CHG_TRACK`): an invoice, a challan, an entry, a worker, a cheque. A store
  that is a settings object is one record (`store`, id `-`).
- **`rev`** is one counter for the whole book: every write takes the next. A device asks *what changed since rev N* and gets exactly
  that. `changes` keeps who changed which fields, the change log's own shape, kept for good on the server (the book's log stays
  trimmed at 90 days).
- **Typed tables come when a report needs them** (invoices by month and client, production by line and day), filled from `records`
  by the Worker. SQL over JSON (`json_extract`) answers the rest.
- **Private to the owner, never on the server** (owner, 15 Oct 2026: *"Local device only, for now"*): the knowledge base's private
  notes, a worker's personal details (`w.profile`), check-ins (`S.peopleCheckins`), the motivation index's inputs. A push strips them
  (one list, `SRV_PRIVATE`, read by the push and by a spec that sweeps every request body for them); a pull never removes them from
  the device. They live on the owner's devices and travel only where the owner carries them: GitHub sync while it is on, and the
  owner's own Settings → Export. **Once GitHub sync is retired (S2) a private record lives only on the devices that hold it**, so the
  owner's export is its backup, and Settings says so. A served copy (`owner_records`, the owner's sign-in proved to the Worker) is the
  later step if the owner asks for it.
- **A row's size**: one record a row keeps every row far under D1's limit on a row (the whole book as one row would not be; the
  figure to be read off Cloudflare's limits page at S1, never assumed).

## §5 Sync

- **Pull**: `GET /sync?since=<rev>` → the records changed since, and the latest rev. Applied to the book as a pull is today, then the
  screens redraw (`bookReload`'s way).
- **Push**: `POST /sync` with each record that differs from the copy last synced (the base `merge.js` already keeps, IndexedDB key
  `synced`), each carrying the rev it was based on. **Compared, never read off the change log**: the log leaves out the words of a
  note, a profile and a check-in by design, so a push read off it would miss them. **The Worker merges as `merge.js` does now**, record by record and field by field: one side changed, it is taken; both
  changed one field, the owner's stands (else the later), the other is **held** (`held` table, shown on *Held for you*, as today).
  The rules move to the server unchanged; `merge.js` stays for GitHub and for a device offline long enough to need it.
- **When**: after every save (debounced 5 s, where GitHub's was 45), when the app comes into view, and every minute while it is open.
  A failed push waits and tries again; nothing is lost while it waits, since the book on the device has it.
- **First upload**: the owner's device sends the whole book once (S1), record by record in batches; every other device then pulls.

## §6 Who may do what

- **A device** gets its own secret when the owner registers it (Settings → Access → Devices, as today, now confirmed by the server):
  every request carries it, the Worker keeps only its hash, and a device the owner removes is refused at once, everywhere.
- **A person** signs in on the device as today. No PIN goes to the server: it holds no private record to guard (§4), and who changed
  what travels with each record as it does now.
- **The Worker answers only the app's own origin** (`https://app.somaelectro.co.in`, CORS; same site as `api.`), limits requests per device, and keeps its secrets (the Anthropic key, the
  device-secret salt) as Worker secrets, never in this repository, which is public.

## §7 The office PC

A small program (Node; `office/` in this repo), the **agent**. **It runs in the signed-in session, started by a task at logon, never as
a Windows service**: a service runs in session 0, which has no printer dialogs and no browser to print with. The PC is kept as the
owner keeps the station now (signed in, the screen locked: the owner's check, 15 Oct 2026, is that a locked PC with the app open and
minimised still prints), on its UPS, set never to sleep.
- **The copy**: every five minutes (and when the internet comes back) it asks the hub for what changed since its rev and writes it to
  `C:\SEP\book.sqlite`. Over a week the copy is never more than five minutes behind while the internet is up.
- **Backups**: nightly, the SQLite file and the book as JSON, kept 30 days on the PC, and the JSON pushed to the GitHub repository
  (the backup GitHub sync was).
- **The print station**: print jobs move from GitHub files to the hub (`print_jobs` table). Until S3 the PWA station stays as it is;
  from S3 the agent takes the job and prints it (Edge with `--kiosk-printing`, as now), and the sender is told it printed.
- **When the hub is unreachable** the PC goes on printing nothing new and keeps its copy; phones keep working on their own books.

## §8 Claude: *Ask the knowledge base*

- `POST /ask` on the Worker, with the question and the device's sign-in. The Worker gathers the articles that person's role may read
  (`kbCanRead`'s rule, on the server), sends them and the question to Claude (`claude-opus-5-5`, the articles as a cached prefix so
  repeated questions cost a tenth), and answers with the reply and the articles it rests on, each a link. An answer is never saved as
  an article.
- **The key**: created by the owner at console.anthropic.com → API keys, with a **monthly spend limit** set under Billing; given to the
  Worker as a secret (`wrangler secret put ANTHROPIC_API_KEY`), never typed into the app or a chat.
- **Cost, at today's list prices**: about $0.05 a question on Opus 5.5 with 10,000 tokens of articles (about 2,000 questions on $100),
  less with the cache. The model is the owner's to change.
- Questions and answers are kept on the server for a month (to see what is asked and what the knowledge base lacks), never sent to
  Sentry.

## §9 Steps, one PR each

0. **S0 · The app's own address.** `app.somaelectro.co.in` on Cloudflare Pages (free, deployed from this repo on merge; a preview link
   per PR). First because every device's storage, GitHub token and (from S1) server secret belong to an origin: moved later, every
   device would register twice. What moves and how:
   - **The book crosses by a handover, never by hand**: the old address offers **Move to the new address**, which checks everything is
     pushed, opens the new address and hands the whole book over between the two windows (`postMessage`, checked by origin both ways),
     the new one verifying it on disk before the old one says so. A device that cannot hand over pulls from GitHub, or imports a backup.
   - **Per device, again**: the GitHub token (it is locked to the origin), the device registration, appearance and folds, the install
     (and the Windows widget, reinstalled from the new address).
   - **Pointing at the new address**: `rishabh1804.github.io/sep-invoicing/` keeps a page that forwards there once a device has
     handed over (never before: the book would be left behind); the office QR's `checkin.html` moves and its sheet is reprinted;
     Sentry's allowed domains add it; `ERR_HOSTS` adds it.
1. **S1 · The hub, record by record.** `server/`: the Worker, the D1 schema (§4), device secrets, `GET/POST /sync` by record and rev
   (§5), the merge on the Worker, *Held for you* from the server, sync every minute, the first upload; private records stripped;
   Settings → Connections → **Server** (on per device; GitHub sync untouched). Deployed from GitHub Actions on merge (§10).
2. **S2 · The office copy.** `office/`: the agent, its install as a task at logon, the five-minute copy, nightly backups to disk and
   GitHub. GitHub sync becomes optional on devices.
3. **S3 · Printing through the hub.** Jobs in D1; the agent prints; the PWA station retired once the owner has tried it.
4. **S4 · Ask.** `/ask`, the Library's *Ask* answering in words with its sources; the key and the limit set by the owner.
5. **S5 · The Android app.** The same web app in a native shell (Capacitor), loading `app.somaelectro.co.in`, so a merged change
   reaches phones without a reinstall; only a change to the shell needs a new install file.
   - **Installed directly**: a signed APK, from a link on the new address; each phone allows *Install unknown apps* once, and Play
     Protect's warning is expected. **The signing key is kept by the owner, off this repository, with a copy off the PC**: lost, no
     phone can take an update and every phone uninstalls (losing what it has not pushed) and installs again.
   - **Notifications**: the Worker sends them through Firebase Cloud Messaging when something needs that person (a roll late, a task
     raised for their duties, a cut with no reason), each person only their own duties'. A phone shows one with the app closed.
   - **In the background**: the app pushes what was entered and pulls the book every 15 minutes or so, as Android allows; some makers'
     battery savers stop it unless the app is set to *No restrictions*, so a first-run check names the setting on that phone.
   - **Drawing over other apps**: not built until a need shows (a phone allows it with one switch for a directly installed app).
   - The Play Store (a developer account, its review) only if the owner later wants it.

Each step: the specs fake the Worker (as they fake GitHub today); a Worker test suite runs on CI (`vitest` with Cloudflare's local D1);
the owner's book uploaded to a test database, counts compared store by store, before any device switches.

## §10 What the owner does

**S0**: in Cloudflare, **Workers & Pages → Create → Pages → Connect to Git**, this repository, output directory the repository's root
(the built page is committed), then **Custom domains → app.somaelectro.co.in** (the DNS record is made for you). Then the handover on
each device, the owner's first.

**S1**:
1. In Cloudflare: **My Profile → API Tokens → Create Token**, from the *Edit Cloudflare Workers* template, plus D1 edit, limited to the
   account. Copy it once.
2. In GitHub: the repository's **Settings → Secrets and variables → Actions → New repository secret**, named `CLOUDFLARE_API_TOKEN`,
   and `CLOUDFLARE_ACCOUNT_ID` (Cloudflare's dashboard shows it). The workflow deploys the Worker on each merge; the token never
   appears in the code.
3. In Cloudflare **DNS**: nothing to add by hand; the Worker's route `api.somaelectro.co.in` is created by the deploy.
4. On the office PC (S2): install Node LTS, then run the one installer command the S2 guide gives; keep the PC signed in, as now.

**S5**: keep the signing key the build hands over (two copies, one away from the office); on each phone, open the install link and
allow it.

## §11 Known assumptions

| # | Assumption | What would show it wrong | Fix path |
|---|---|---|---|
| 1 | Cloudflare's free Worker and D1 limits cover the shop (they did at the time of writing; to be checked at S1) | A limit e-mail or a refused write | The paid Workers plan (about $5 a month) |
| 2 | Five-minute office copies are close enough | A day lost with the cloud | Shorten the interval; the agent pulls on every rev |
| 3 | One rev counter for the book scales | Slow pulls past a million changes | A rev per store |
| 4 | The merge rules carry to the server unchanged | Held items that `merge.js` would not have held | One set of rules, tested on both sides |
| 5 | A locked, signed-in PC keeps printing (the owner's check of the PWA station, 15 Oct 2026) | A job that waits while the PC is locked | Windows' auto sign-in on the station's own account |
| 6 | Android lets the app sync every 15 minutes or so in the background | A phone whose entries reach the hub only when opened | The battery setting named on that phone; a foreground service while a duty is due |
| 7 | Private records on the owner's devices alone are safe enough | A device lost with the only copy | The owner's export as their backup; `owner_records` on the server |
