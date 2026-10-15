# The server: one SQL book in the cloud, a full copy in the office

**Status:** spec, not built. Owner, 15 Oct 2026. Six steps, one PR each (§9). Nothing changes on any device until S1 is built and
switched on in Settings.

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

## §2 What is there (looked up 15 Oct 2026)

- `somaelectro.co.in`: nameservers `chelsea.ns.cloudflare.com`, `paul.ns.cloudflare.com` (the DNS is on Cloudflare); the website
  answers through Cloudflare's proxy (`server: cloudflare`; the headers look like a Next.js site on Vercel behind it); mail is Google's
  (`MX 1 smtp.google.com`). **None of these is touched**: the server adds subdomains only.
- The app today: a PWA on `rishabh1804.github.io`, the whole book in IndexedDB on each device, synced as one JSON file through the
  GitHub Contents API, merged record by record (`merge.js`, G4), with a change log per save (`changelog.js`). Prints go through the
  same repository (`remoteprint.js`).

## §3 The shape

```
 phones, desktops (the PWA, offline-first as now)
        │  HTTPS, only what changed
        ▼
 api.somaelectro.co.in  ── Cloudflare Worker + D1 (SQLite)      ← the hub, up through the shop's power cuts
        │  outbound only, every few minutes
        ▼
 office PC (Windows, UPS) ── the agent: a full SQLite copy, nightly backups, the print station
```

- **The hub is in the cloud** so it answers while the shop is dark or offline; the owner's phone at home and the supervisor's on
  mobile data reach it. **The office PC keeps a full copy** under the shop's roof and survives the cloud going away; it only ever
  calls out, so nothing on the office network is opened to the internet and no tunnel is needed.
- **Every device stays offline-first.** The book in IndexedDB is still what the screens read; the server is where devices meet. A
  device with no signal works as today and catches up when it has one (the 5–10% the office is down, a hotspot or not).
- **GitHub sync stays on** through S1–S2, then becomes the nightly backup (S3).

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
- **Private to the owner** (the knowledge base's private notes, a worker's personal details, check-ins): a table of their own,
  `owner_records`, served only to a request signed by the owner (§6). Until S6 they travel in the book as today.

## §5 Sync

- **Pull**: `GET /sync?since=<rev>` → the records changed since, and the latest rev. Applied to the book as a pull is today, then the
  screens redraw (`bookReload`'s way).
- **Push**: `POST /sync` with each record changed since the device's last rev, read off the change log, each carrying the rev it was
  based on. **The Worker merges as `merge.js` does now**, record by record and field by field: one side changed, it is taken; both
  changed one field, the owner's stands (else the later), the other is **held** (`held` table, shown on *Held for you*, as today).
  The rules move to the server unchanged; `merge.js` stays for GitHub and for a device offline long enough to need it.
- **When**: after every save (debounced 5 s, where GitHub's was 45), when the app comes into view, and every minute while it is open.
  A failed push waits and tries again; nothing is lost while it waits, since the book on the device has it.
- **First upload**: the owner's device sends the whole book once (S1), store by store; every other device then pulls.

## §6 Who may do what

- **A device** gets its own secret when the owner registers it (Settings → Access → Devices, as today, now confirmed by the server):
  every request carries it, the Worker keeps only its hash, and a device the owner removes is refused at once, everywhere.
- **A person** signs in on the device as today. A request for the owner's private records needs the owner's sign-in proved to the
  server: the PIN goes over HTTPS to the Worker, which checks it against the same salted PBKDF2 hash the book holds and answers with a
  short-lived token. No PIN is stored in clear anywhere.
- **The Worker answers only the app's own origin** (CORS), limits requests per device, and keeps its secrets (the Anthropic key, the
  device-secret salt) as Worker secrets, never in this repository, which is public.

## §7 The office PC

A small program (Node, run as a Windows service; `office/` in this repo), the **agent**:
- **The copy**: every five minutes (and when the internet comes back) it asks the hub for what changed since its rev and writes it to
  `C:\SEP\book.sqlite`. Over a week the copy is never more than five minutes behind while the internet is up.
- **Backups**: nightly, the SQLite file and the book as JSON, kept 30 days on the PC, and the JSON pushed to the GitHub repository
  (the backup GitHub sync was).
- **The print station**: print jobs move from GitHub files to the hub (`print_jobs` table). Until S4 the PWA station stays as it is;
  from S4 the agent takes the job and prints it (Edge with `--kiosk-printing`, as now), and the sender is told it printed.
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

1. **S1 · The hub.** `server/`: the Worker, D1 schema, device secrets, `GET/POST /sync` of whole stores, the first upload; Settings →
   Connections → **Server** (on per device; GitHub sync untouched). Deployed from GitHub Actions on merge (§10).
2. **S2 · Record by record.** Push and pull by record and rev, the merge on the Worker, *Held for you* from the server, sync every
   minute. GitHub becomes optional.
3. **S3 · The office copy.** `office/`: the agent, its install as a service, the five-minute copy, nightly backups to disk and GitHub.
4. **S4 · Printing through the hub.** Jobs in D1; the agent prints; the PWA station retired once the owner has tried it.
5. **S5 · Ask.** `/ask`, the Library's *Ask* answering in words with its sources; the key and the limit set by the owner.
6. **S6 · Private records and the app's own address.** Owner-only records served by the server alone; optionally the app moved to
   `app.somaelectro.co.in` (Cloudflare Pages, free), its own origin. A move of origin starts every device's browser storage empty there:
   each device pulls its book from the hub once, and the old address points to the new for a while.

Each step: the specs fake the Worker (as they fake GitHub today); a Worker test suite runs on CI (`vitest` with Cloudflare's local D1);
the owner's book uploaded to a test database, counts compared store by store, before any device switches.

## §10 What the owner does (S1)

1. In Cloudflare: **My Profile → API Tokens → Create Token**, from the *Edit Cloudflare Workers* template, plus D1 edit, limited to the
   account. Copy it once.
2. In GitHub: the repository's **Settings → Secrets and variables → Actions → New repository secret**, named `CLOUDFLARE_API_TOKEN`,
   and `CLOUDFLARE_ACCOUNT_ID` (Cloudflare's dashboard shows it). The workflow deploys the Worker on each merge; the token never
   appears in the code.
3. In Cloudflare **DNS**: nothing to add by hand; the Worker's route `api.somaelectro.co.in` is created by the deploy.
4. On the office PC (S3): install Node LTS, then run the one installer command the S3 guide gives.

## §11 Known assumptions

| # | Assumption | What would show it wrong | Fix path |
|---|---|---|---|
| 1 | Cloudflare's free Worker and D1 limits cover the shop (they did at the time of writing; to be checked at S1) | A limit e-mail or a refused write | The paid Workers plan (about $5 a month) |
| 2 | Five-minute office copies are close enough | A day lost with the cloud | Shorten the interval; the agent pulls on every rev |
| 3 | One rev counter for the book scales | Slow pulls past a million changes | A rev per store |
| 4 | The merge rules carry to the server unchanged | Held items that `merge.js` would not have held | One set of rules, tested on both sides |
| 5 | The owner's PIN over HTTPS to their own Worker is acceptable | — | A challenge over the PIN's hash instead |
