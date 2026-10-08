# Next session — SEP Invoicing (Session B of four)

**Set by the owner, 24 Sep 2026.** This repo is worked in its **own session**. A separate
**compile session** (Session D) attaches all three SEP repos and reconciles their data. The model
is described once, canonically, in `soma-internal/docs/CROSS_REPO_SESSIONS.md`. This file
carries **this repo's side** of it: the work queued here, and what this app produces and consumes.

---

## Built 8 Oct 2026: power causes, Today as cards, the .xlsx statement (read this first)

Three asks of the owner's, one PR. **Power causes** (`powercause.js`, P177): a cut saved with no time back is completed where it
is shown (Power, Production's entry, Today, the To-do), with why it went, where it hit and what brought the power back; the reasons
and fixes are a list the book keeps, written one way however they are typed, read for the plant on Power → Causes and the plant
register, and two To-do rules. **Today as cards** (design §6.21–6.25, P178): Needs you and Pulse are hero cards filled in their
status tone's gradient, the tasks decks of cards, the inputs steps, packed on the desktop; the sidebar's name and mark open Pulse.
**The bank statement** (P179): a two-page statement's page foot no longer stops the import, and the same statement saved from Excel
as .xlsx is read. CLAUDE.md has each. **Left for the owner:** import the 8 Oct statement (either file); complete the cuts the To-do
lists, so the causes start; the owner's own merge of near-duplicate reasons as the list grows. **Still queued:** Home hover previews;
links on an area card and a production run; paths edited in the app.

## Built 7 Oct 2026: statements of account and pay slips (read this first)

The owner picked two of the updates put to them (*"Start with 1 and 2"*): Finance → Receivables → a client → **Statement and
reminder** (`statement.js`, P173) and Staff → Pay → **Pay slips** (`payslip.js`, P174). CLAUDE.md has both sections. **Left for the
owner:** fill Settings → Business → Bank details (printed under *Payment to*) and each client's mobile (the reminder's WhatsApp number);
import the latest bank statement before sending a statement. **Built next** (*"start with 3 and 4"*): G4, the merge (`merge.js`, P175)
and the prospects list (below). **Still queued:** Home hover previews; links on an area card and a production run; paths edited in the app.

## Built 5 Oct 2026: the knowledge base (read this first)

Insights → **Knowledge**, and the book in the top bar on every screen (`docs/KNOWLEDGE_BASE.md`; CLAUDE.md, *The knowledge base*; P154).
**What the owner should do:**
- **Import the first content** (Knowledge → Library → Import): the private `sep-kb-2026-10-05-r2.json` handed over in session (it replaces
  the first file, audited the same day: 51 corrections, `corrections-r2.md` beside it), 142 drafts written
  from soma-internal (60 rulings, 24 client requirements, 14 parts, 31 process, 13 faults) and three training paths. Every article is a
  draft with its source (`srcRef`): read each and **Publish** it, edit it, or delete it. Start → *Drafts to review* lists them.
- **Questions the drafting left open** (each said in its article): whether caustic is a stock line; Q558's line (barrel or VAT); the 47
  brightener on the barrel; the barrel opening recipe (one message of 9 Sep); safety points marked *general practice, not yet confirmed at
  SEP*; blisters, burning and colour causes (general practice: no case on record); Dilip's override; Tina's weight (1.0041 against
  1.026 kg); Khetan's rate change date; Sambhu's monthly tier date; whether the gate bands apply to Sambhu.
- **Make a recovery code** if the guard is on (unchanged from 2 Oct).
**What is left in the queue:** the chatbot (the owner's next ask: which AI, its key and cost, and what may be sent out); links on an area
card and a production run; paths edited in the app; G4, the merge; Home hover previews.

## Built 2 Oct 2026: the QA chain over 1–2 Oct (read this first)

Six audits of everything built on 1–2 Oct, then the fixes, each with its spec (P149–P153; CLAUDE.md, *The QA chain of 2 Oct 2026*).
**What the owner should know before using it:**
- **Only the owner replaces the book**: a backup imported and a pull from GitHub need the owner's ID, and where the incoming book's
  IDs differ the owner is asked whether to take them. The Imports switch now covers the floor's files (stock, production, power,
  a roster).
- **The owner's own PIN is changed with the PIN itself** (*Change my PIN*), or reset from the lock with the recovery code. With
  the guard on and no recovery code on record, **make one now** (Settings → Access → Users & access → New recovery code): a
  forgotten PIN has no other way back.
- Wrong PINs lock the ID they were typed for, not the device.
- An invoice's state (Mark printed, dispatched, delivered, filed; Not printed) asks as an edit does; Print still marks Printed in one tap.
- An area's complement on Staff → Areas is the owner's (a Settings change).
- An item rate override prices only lines in its own unit; a line in the other unit is at the client's own rate and says *Another unit*.

## Built 2 Oct 2026: UX overhaul 2, step 7

The desktop's list and pane on Finance → Receivables, Production → Entries, Staff → Roster and History, and three columns on
Pulse, Stats and Finance above about 1,600px (P147; CLAUDE.md and `docs/UX_OVERHAUL_2.md` step 7). **Every planned step of UX
overhaul 2 is now built** (3, 4 and 5 came with Direction B's search, keys and new windows). **What is left in the queue:**
- **G4, the merge** (`docs/GUARD.md`): waits, by the owner's plan, until more than one person enters data on their own device.
- **Home hover previews** (parked below): the owner called them a planned UI update; not started.
- **The Android To-do widget** (needs a native wrapper) and moving `S.todo` to `sep-dashboard` when that app is ready.
- **The owner's own checks** listed in each section below (a real day of production end to end, a register photo through
  Gemini, the power quotes, the quotation series already issued by hand).
- **The owner said they have more asks queued** (30 Sep 2026): ask what is next.

## Built 1 Oct 2026: quotations and reports (read this first)

Clients → **Quotations** (P131) and **Reports** (P132); CLAUDE.md has both sections. **Left for the owner:** the series already
issued by hand (001–005) is not in the app — before the first quotation issued here, record those numbers or the app starts at 001
again (see the Quotations row under *This repo's side*); set the signatory and foot note in Settings → Business → Quotations; print
one quotation and one report from the print dialog (`page.pdf()` cannot see the dialog's headers).

## The owner's list of 30 Sep 2026, built (PR #118, read this first)

All seven items and the per-hour follow-up, one commit each (CLAUDE.md has each section; P117–P121):
1. Forms entered several at a sitting stay open (Production and Power by hand, Stock by hand, challan *Save, add another*, bills,
   recorded credit notes, Pay, Sort). 2. Part-invoiced challans show what is left to bill. 4. Stock by hand lists the day and corrects an
   entry. 5. Client performance: one part however spelt (`cpPartIdentity`), Materials worked, shared codes, **By the hour** (pickle + plate +
   15 min, measured from the register and the pickling loads, trend and what to look at). 3. Staff → Day as an area board, Civil, the
   allocation by area. 6. Stats' Overview as question-led story cards. 7. Home widgets with presets and Edit Home, per device.

**Left for the owner:** check the timing of Samarth's parts once a register photo with their rounds is read (the book to 11 Sep has no
production record, so nothing is measured yet); the 15-minute constant is theirs to change on the panel.

## Where session B stopped — 30 Sep 2026 (read this first)

**Merged, both on the owner's go-ahead, 30 Sep 2026:**
- **sep-invoicing #116 → `8036c9b`** (build `b27a9119`):
  - the QA sweep (P104–P113);
  - the owner's six rulings (P114);
  - **Power** (P115, `split/power.js`);
  - **deleting an attendance day with a logged reason** (P116). A start-up pass moves the book's day saved under
    `"null"` (23 marks, 5 EXTRA rows) to `S.attendanceDeletes`.
- **soma-internal #118 → `4f1993e`:**
  - `reports/power-cut-case-2026-09-30.md`;
  - `analysis/sep-power-history-2026-09-30.json`;
  - `decisions/2026-09-30.md`;
  - tasks T-BD and T-CZ notes, and new T-IE and T-IF;
  - the routing row `analysis/sep-*.json` → the content Governors.
- **The history JSON was handed to the owner** to import (Power → Cuts → Import history).
- **Branch:** `claude/gracious-dijkstra-pzfv6u` was reset onto `origin/main` in both repos after the merge. New work starts
  from there as a new PR.

**The power case on the real book** (`soma-internal/sep-invoicing-data.json@18c6b2e` with the history imported):
- **Damage on record: ₹77,528.**
  - ₹48,000 is restarts at the 30 May estimate of ₹600 a cut, **not measured**.
  - The measured part is ₹29,528: platers' idle wages ₹14,705, contribution never made ₹7,565 (6%, the lower of the live
    and typed cost readings) and catch-up overtime ₹7,258.
- **A year: ₹1.8–2.6 L.**
- **Payback:** TSUISL 9–29 months, inverter 18–27, generator 41–58.
- **Audits:** two Governor audits, both AMEND, all folded (Iuno 0·6·7·4; Iuno + Vulcanus + Castor 0·2·4·6).
  **A third look was not run before merge**; the owner merged on their own call.
- ⚠ **soma-internal main has moved to a newer backup** (`6eccb22`, 1,025 invoices). The report's figures are the 18c6b2e
  reading, and a re-read on the new copy will differ slightly.

**Left for the owner:**
- open the app once after it updates (the null-day migration);
- import the power history;
- get the TSUISL and inverter quotes;
- **what a restart actually costs** (62% of the damage is the estimate);
- get the approved 50 kVA onto the bill (T-CZ);
- say whether "about ₹5,000 a month" was read off a bill or repeats the codex's estimate (`decisions/2026-09-30.md` §2).

**Open in the code or the record, not yet done:**
- **Re-audit residues left as stated, not fixed:**
  - `power-cut-log.md:451`'s T-BD date (the file was only appended to, M-7);
  - the year's 36 cuts include one on a worked Sunday (N-8, said in the report).
- **soma-internal T-IE:** power for 23–29 Sep is not yet ingested.
- **soma-internal T-IF:** August's app bill is ₹73,156 against the bank's ₹76,156.
- **The compile session** should read `attendanceDeletes` before calling a missing day unrecorded (data-flow row below).
- **Home's Revenue tile will link to its credit notes** once the hover previews are built (parked, `UX_OVERHAUL_2.md`).
- ~~**UX overhaul 2, steps not built:** 3, 4, 5, 7.~~ All built: 3–5 with Direction B (1 Oct), 7 on 2 Oct 2026.
- **The owner said "We have updates remaining" (30 Sep 2026)**: they have more asks queued for this session. Ask what's next.

**Local scratch checks** (git-excluded `tests/e2e/zz-*`, gone when the container is reclaimed):
- `zz-power.spec.ts` loads `REAL_BOOK` (the soma-internal backup), imports `POWER_HIST` and writes the analysis to `OUT`.
  Run it with `--project=mobile-chromium`.
- The real book is read only locally. Counts and generic figures may be quoted, never names or wages.

---

## The work, in the owner's order

### 1. Visual rate matcher

> **Status, 24 Sep 2026 (session B): BUILT.** Reference fixed (per-client dated piece rates, T-HC),
> ₹0 lines need a reason, and the matcher ships with **option E**, chosen by the owner from five
> rendered candidates: green exact · yellow ×10 · red ≥ 10% or ≥ ₹100 on the line · neutral
> "Differs" below that · grey for no rate / gauge not stated. See `CLAUDE.md` § *The rate on record*.
> The two thresholds are in Settings → Rate Check.

Colour each line's rate against the rate on record:

| Colour | Meaning |
|---|---|
| **Green** | matches the database rate |
| **Yellow** | a **decimal error**: off by a power of ten (₹1.25 typed as ₹12.50, or the reverse) |
| **Red** | a change of **₹0.50 or more** |

**The thresholds are to be settled at the start of the session, on financial impact.** Do the
measurement before fixing a number:

- **A flat ₹0.50 means very different things across this book.** On a ₹1.06/pc bracket it is 47%;
  on a ₹22.00/kg line it is 2.3%. Replay the rule over the invoice history and count how many
  lines each candidate threshold would flag, and what rupee value those lines carry. The owner
  asked for the rule to be set on that evidence.
- **Only a flat rupee threshold leaves a gap between yellow and red.** A line that is off by
  under ₹0.50 without being a decimal error fits neither colour. Decide what it shows.
- **"The database rate" means what `getLineItemRate()` returns**: the client ladder, then
  `itemRates`, then the items master. That function is the one place the matcher should read.
  No colour-coded matcher turned up in a sweep of `split/*.js` for `rate-match`, `mismatch`,
  `expectedRate` and `rateDiff`. **Not found is not "does not exist"**, so check at session start
  whether an older version of this feature lives somewhere the sweep did not reach.
- ⚠ **Gauge-priced clamps will read red when they are correct** unless the match keys on part
  **and gauge**. Five clamp families carry different rates at different gauges (`CLAMP 105X83`,
  `133X83`, `165X83`, `124X77`, `154X81`). This repo's Items Master section counts four; the
  fifth, `154X81`, was added in `soma-internal`'s `CLAUDE.md` on 7 Sep. Its two master rows are
  spelled differently, so match case-insensitively on a normalised stem.
- ⚠ **This matcher will surface T-HC.** `soma-internal` has recorded that the challan scanner
  bypasses `itemRates`. Lines raised through it could read red against a correct per-client rate.
  That is a real finding, not a matcher bug. Fix T-HC in this session, or label those lines.

### 2. Stock inventory tab

✅ **BUILT 24 Sep 2026** — More → Stock (`split/stock.js`, `CLAUDE.md` § Stock). Designed with the owner
from a rendered mockup: paste the supervisor's WhatsApp message, or enter by hand; Stats costs chemicals
from it. Staff, Stats and History moved behind **More** on the phone bar with it.

- **The current record is `soma-internal/operations/chemical-stock-log.md`.** Its latest take
  (Shyam, 22 Sep) lists **15 lines**: zinc, Q558, 16 Salt, 106 Salt, cyanide, Monicol,
  brightener, 65 M, 65 R, A Salt, boric acid, B Salt, spray, nitric acid, HCl. Several carry a
  daily draw rate, so the tab can project days of cover. That projection is what flagged 65 M as
  likely out on 23 Sep.
- **Data comes in through an import door, never committed.** This repo is public. It follows the
  same rule as the roster, which ships empty.
- ⚖ **Stock is owned by `soma-internal`** (owner's ruling, 24 Sep 2026: *"soma-internal will take ownership, that's the private repo where all sensitive data must be transferred when a compile happens"*). **So this tab is a view and an input, not the ledger.** It shows stock and captures entries on the device. Everything it captures is **copied** into `soma-internal` at the next compile session, and **stays on the device and readable in the app**: a compile never deletes anything here. Design the capture so it can be **exported whole**, with dates and who entered it, because that export is the record's source. For this app to take stock over, a later merge PR would have to state so, with a reason.

### 3. To-do widget: desktop and Android (Google Pixel 11 Pro)

> **Status, 25 Sep 2026 (session B): BUILT for Windows, inside this app.** Platform checked: Windows
> 11 takes a PWA widget through Edge's `widgets` manifest member (Adaptive Card; Developer Mode +
> WinAppSDK to install outside the Store); Chrome on Android has no PWA widget, so the phone needs a
> native wrapper. The owner chose: just me, own tasks and data-raised tasks labelled, Windows 11, in
> this app for now, no phone yet. Shipped with Home quick actions and the attendance-roll paste in the
> same release. See `CLAUDE.md` § *To-do* and § *Attendance rolls from WhatsApp*. **Open:** the Android
> widget, and moving `S.todo` to `sep-dashboard` when that app is ready.

A to-do list for Soma, the workplace, shown as a widget on the desktop and on the phone.

- ⚠ **Verify the platform constraint before designing.** As understood when this was written, a
  PWA **cannot** put a widget on an Android home screen. That needs a small native app or a
  wrapper. Desktop is different: Windows 11 supports PWA widgets through Edge's `widgets`
  manifest member. Confirm both, because the answer decides whether this is one build or two.
- **Consider where it lives.** A workplace to-do list is not billing. It may sit better in its own
  tiny app, or in `sep-dashboard`'s new personal PWA. The owner listed it here; raise the
  question, don't assume the answer.

### 4. Other patches

> **Status, 25 Sep 2026 (session B): intelligence engine parts one and two BUILT.** Default cost per kg is now
> derived live (Stats → Cost → Live cost, `cost.js`), and real cost per client is Stats → Clients →
> Contribution by client (`intel.js`). Stats is in five tabs. **Parts three and four BUILT too** (`insights.js`):
> insights as To-do rules, month pace, next challan, PO/vehicle prefill; plus the stock reorder list. The
> PO/vehicle item of this section is therefore done.

- **PO number and despatch vehicle number, predicted.** Start from what the app already has:
  `split/create.js` already saves the vehicle number to the client for autocomplete. A
  per-client frequency model (last used, most used) may carry most of the value before anything
  heavier. If an AI model is used, the Gemini key already lives in its own `localStorage` entry
  (`scanner.js`), never on the state object. Keep it that way.
- **Dashboard updates.**
- **Stats: an overview, plus more depth.**
- **Default cost per kg, calculated dynamically.** `defaultCostPerKg` is on the state and read
  across `stats.js`. Today it is a typed constant: the ₹8.55/kg model in `CLAUDE.md` § Key
  Business Data. Derive it from live inputs.
- **Real cost per client, calculated separately for each.** This is the SSS Mehta question in
  `CLAUDE.md`: fixed versus volume-scaling labour decides whether that account contributes or
  loses. ⚠ **The roster ships empty because this repo is public**, so per-client labour cost must
  be computed from runtime data on the device, never from anything committed.

### 5. Redesign: "Dense console" (owner, 25–26 Sep 2026)

The interface is being rebuilt to `docs/SEP_INVOICING_DESIGN_PRINCIPLES.md` v2.0 — read it first; it is the
whole spec. **Route 1** (native CSS, no build step) runs in four phases (its §9): foundation (tokens, theme,
density, shell) → components → screens one PR at a time (Home, Register, IM, Create, Clients, To-do, Stock,
Staff, Stats, History, Settings) → clean-up. Open decisions (palette, icon, default theme) are its §10.

**Route 3 — a framework build — is a separate app in this repo** (owner: *"a separate build from this, so
that we can keep running our data without missing any days and once that is finished we can port"*). It lives
in its own folder (e.g. `next/`, served at `/sep-invoicing/next/`) and is built to the same design document.
⚠ **Both apps are the same origin, so they see the same IndexedDB (`sep-invoicing`).** Until cut-over the new
build must **never write that store**: it either reads it and keeps its own database, or is fed through
GitHub sync / a backup import. The live app stays the system of record until the owner switches.

### 6. Production (owner, 28 Sep 2026)

✅ **BUILT 28 Sep 2026** — More → Production (`prodparse.js`, `production.js`, `prodview.js`, `vision.js`;
`CLAUDE.md` § Production). The pickling hand's WhatsApp loads, the supervisor's barrel list and a roll's production
block through the one paste box; the VAT register's photos read by Gemini; material in the plant by the book and by the
floor; two To-do rules; a Stats row and labour ₹/kg by line. **Owned by `soma-internal`, like stock** (owner): a view
and an input, exported whole, merged by id.

**Open, for the owner:**
- **The first real day, end to end**: paste one day of the pickling hand's and the supervisor's messages, read one of
  the register clerk's photos, then import the history file (below). That is the check that counts.
- **A register photo read through the app** with a Gemini key: 20 real pages (16–26 Sep) are transcribed and every one
  reads right after the transcription, but Gemini's own transcription has not been scored (no key in the build sandbox).
- **Ask the pickling hand to restart the incoming-material messages** (stopped after 29 Jul): they are the floor's own
  count of receipts, shown beside the challans.
- **The history W18–W35 arrives as a private import** (`sep-production` v1, below), built by the compile from
  `soma-internal/operations/pickling-input-log.md`, the barrel files and the raw relays. Give it deterministic ids (a
  hash of the source file and row), so a second import adds nothing. Imported entries never raise To-do tasks.
- **Unknown, recorded as such**: whether the barrel list covers the in-roll barrel OT blocks (on a day with the list,
  the blocks are shown *also reported*, never added); the line of a pickling load (learnt from plating, never guessed).

### Parked: Home hover previews (owner, 28 Sep 2026: *"We will keep this as a planned UI update"*)

On the desktop, hovering a Home quick action (New invoice, New challan, Stock entry …) shows a translucent snapshot of
what is inside; after 2.5 s without leaving the button the box **locks** (a small loading circle at its top shows the
lock coming) and becomes clickable — New challan's box, for one, a **ranked** client list that starts the challan with
that client entered. New invoice should also stop reading as always highlighted. Not built; design it against §6 of the
design document (an `inv-menu`-like surface, `prefers-reduced-motion` respected, nothing on touch).

### Carried from the codex

- **T-HC** (`soma-internal`): the scanner bypasses `itemRates`. **Fixed here 24 Sep 2026** — the compile session should close it in `soma-internal/tasks.md`.

---

## This repo's side of each interface

Session D checks these against the other repos' descriptions. **If something here changes, say so
in the PR**, so the compile session knows to re-check.

| Flow | This repo's side |
|---|---|
| **Produces** the JSON backup → `soma-internal` (**all sensitive data goes there at every compile**) | Settings → Export. The whole state as one JSON file. `soma-internal` stores it as `analysis/sep-invoicing-backup-YYYY-MM-DD.json`. Newest there: **2026-09-11**. |
| **Consumes** the roster and attendance seed ← `soma-internal` | Staff → Roster → Import. Merges by name, and marks name a worker, never an id (see `CLAUDE.md`). The seed carries the alias map. |
| **Consumes** findings ← `soma-internal` | Tasks recorded in `soma-internal/tasks.md` whose fix belongs here, currently **T-HC**. |
| **Backup shape changed, 24 Sep 2026** | A top-level `rateCheck: {pct, stake, weightTol}` config. Clients gain `pieceWeights: [{partNumber, gauge, kgPerPiece, effectiveFrom, source, addedAt}]` (second PR). Invoice lines gain `imItemId`; challan (IM) lines gain `corrections: [{at, invoiceId, invoice, from, to}]` when an invoice edit writes back to them. Clients gain `pieceRates: [{partNumber, gauge, rate, effectiveFrom, source, addedAt}]`. Invoice lines billed at ₹0 gain `zeroReason` (`replating` / `sample` / `other`), optional `zeroNote`, and `zeroReasonBackfilled` on the 25 historical lines. Anything in `soma-internal` that parses the backup should expect them. |
| **Backup shape changed, 25 Sep 2026** | New top-level `todo: {tasks: [{id, text, due, note, link: {kind, id, label}, createdAt, updatedAt?, doneAt, doneBy?}], snoozes: {key: {sig, until, at}}}`, `todoCheck` (rule switches and day thresholds) and `relayPastes: [{id, at, hash, sentBy, sentOn, kind: in/out, date, text}]`. Attendance marks written from a pasted roll carry `inMin`, `outMin` (minutes from midnight; the next morning is past 1440), `outKnown` and `src: 'relay'`; EXTRA rows from a roll carry `src: 'relay'`. Workers gain `relayNames` (spellings the owner placed once, the roster file's `aliases`, and read-as guesses saved without correction — upper-case letters only, e.g. `SHARAT`). |
| **Ruling, 25 Sep 2026 (monthly OT)** | Monthly hands get OT at day rate ÷ 8 × 1.1, **capped at ₹68.20/h** (`labour.otCap`). ⚠ **For the compile:** the attendance history in `soma-internal` up to 7 Sep carries almost no monthly-tier OT (July 0 h, August 11 h), while September's rolls carry 381 h. By the ruling the earlier months understate monthly pay; the salary slips (`operations/payouts/*-permanent-salary.md`) are the instrument to check them against. |
| **Backup shape changed, 25 Sep 2026 (zinc)** | `zinc` gains `lmeHistory: {YYYY-MM-DD: INR/kg}` — every LME rate Refresh fetched, and any metals.dev looked up for a bill date, kept by day (last 400). Settings → Costing → Zinc rate → *Derive from zinc bills* sets the ZINC line's `bill` / `received` prices, less `premiumPerKg`, against it to measure the LME → MCX uplift. **For the compile:** the more zinc bills carry their price and invoice date, the better that figure; nothing else in this repo's data flows moved (Settings reorganised, Part weights moved to Items, same `S.partWeights`). |
| **Backup shape changed, 25 Sep 2026 (monthly pay)** | New top-level `payrollPaid: [{id, month, status, source, note, at, rows: [{name, staffId?, rate, worked, restDays, dayPay, otHours, ot, paid?, note}], voidedAt?, voidReason?}]`: a closed month of the monthly tier as it was paid, which replaces the attendance model for the hands it names. `labour` gains `otCapFrom` (`2026-09-01`: July and August were paid uncapped) and `holidays` (`['01-26', '08-15', '10-02']`). Workers gain `monthWage` (a contracted monthly wage: rate = wage ÷ days in the month, Sundays ungated). The monthly tier is now BM's 10 Sep model per calendar month. **For the compile:** the payroll file is built from `operations/payouts/*-permanent-salary.md` (April, May, July, August; June's paid slip is not on disk) — keep it there and add each month as it closes. |
| **Config added, 25 Sep 2026 (insights)** | `todoCheck` gains eight insight switches (`insQuiet`, `insRealLow`, `insClientDown`, `insLeak`, `insBelowVar`, `insLabour`, `insAttGap`, `insChemPrice`); `stockCheck` gains `leadDays` and `coverDays`; `costModel` gains `zincPerKg`. No record shape changed. |
| **Backup shape changed, 25 Sep 2026 (cost)** | Stock entries gain kind `bill` ({qty, price, amount, date = billDate, supplier, billNo, note}: a purchase that does not move the level). `received` entries gain `billDate`, `amount` and `billAddedAt` (when the bill was added after a paste). New top-level `costBills: [{id, kind: power/other, month: YYYY-MM, amount, units, note, label, at, voided?, voidReason?}]` and `costModel: {power, other, zincKgMonth}`. **The compile should treat `bill` entries as the purchase register**: they are the prices soma-internal holds, carried over by a `sep-stock` import file and entered from here on. |
| **Backup shape changed, 30 Sep 2026 (the second QA chain)** | The `sep-bank` export's `imports[]` entries can carry `removedAt`, `removeReason`, `rowsRemoved` and `removedIds`: **an import removed in the app took those rows out of the record, so the compile must drop them too** (version stays 1). `attendanceDeletes` records gain `how: 'reread'` (a day re-read from its rolls; the record holds the day as it was) and `pastes` (the rolls a deleted day took with it). Production downtime entries may carry `closedBy` / `closedAt` (a power-back pasted later closed the cut). A stock bill entered by hand now stores `amount`. Credit notes' typed year is stored `yy-yy`. |
| **Backup shape changed, 30 Sep 2026 (the owner's rulings)** | `costBills` rows gain optional `arrears`, `arrearsOf` (YYYY-MM) and `penalty`, all parts of `amount`: **a bill's cost is `amount − arrears`**, since the arrears were already the earlier month's cost; the compile must not count them twice. New top-level `payCarryClears: [{id, staffId, through, amount, reason, at, voidedAt?}]` (a pay balance cleared with a reason). The `sep-bank` export's `parties` carry `dir` (`in`/`out`), and a money-in rule is keyed `KEY\|in`. |
| **Backup shape changed, 6 Oct 2026 (stock checks)** | Stock entries can carry `checkOk: {at, by}` (an entry that did not fit, kept as right by the owner) and `reread` (the time a message was read again: the entry is that message's new reading, `source: 'paste'`, at the message's own `at`). An entry voided by a re-read has `voided.reason` beginning *Read again*. A paste record can carry `reread: [{at, by, voided, added}]`. **The `sep-stock` export carries all of it**: the compile takes the newest copy of an entry by id, as before, and should drop entries voided by a re-read like any other void. |
| **Backup shape changed, 7 Oct 2026 (prospects)** | New top-level `prospects: [{id, name, contact, phone, email, process, kgMonth, rate, stage: new/contacted/sample/quoted/won/lost, nextAt, lostReason, notes, clientId?, wonAt?, log: [{at, stage, note}], createdAt, updatedAt}]`. A quotation may carry `prospectId`. Nothing reads it but this app; soma-internal may copy it whole. |
| **Backup shape changed, 7 Oct 2026 (the merge, G4)** | New top-level `mergeHeld: [{id, at, coll, rid, field, label, why: both/removed/number, kept: {side, v}, other: {side, v}, status: open/used/kept, from, settledAt?, settledBy?}]`: what a sync merge held for the owner. **A push or a pull now merges** rather than overwriting, so the GitHub copy the compile reads may carry two devices' work and a `changeLog` unioned from both; keep both whole. The copy each device last exchanged is kept on the device only (IndexedDB key `synced`), never in a backup. |
| **Backup shape changed, 7 Oct 2026 (statements and pay slips)** | `bank.reminders: [{id, clientId, at, amount, how: whatsapp/copy, oldest}]`: a payment reminder sent from Finance → Receivables. It travels with the book (backups, GitHub, the compile), not in the `sep-bank` export, which is unchanged. A statement of account and a pay slip are drawn from the book each time and store nothing. |
| **Backup shape changed, 6 Oct 2026 (one ranked list)** | `todo.snoozes` can hold a key `fold:<rule>` (three or more tasks of one rule shown as one), its `sig` every member's `key=sig` joined by `;`, and a snooze's `rule` is the member rule. Nothing else is stored: the fold, a task's `worth` and the client card are worked out each time. Whoever moves `S.todo` to `sep-dashboard` keeps the fold keys or drops them; a dropped one only brings the fold back. |
| **Backup shape changed, 6 Oct 2026 (learning from answers)** | `S.todo.resp: [{at, key, rule, act: go/list/snooze/week, age}]` (the last 400) and `S.todo.learn: {dismissed: {key: sig}, applied: [{at, key, kind: raise/off/lead, rule, field, from, to, undoneAt?}], lead: {rule: true}}`. A suggestion applied changes `S.todoCheck` as Settings does. What a device showed stays on the device (`sep_inv_todo_seen`). Whoever moves `S.todo` to `sep-dashboard` takes both; neither is needed to read the tasks. |
| **Production: gauge rules and learnt part names, 30 Sep 2026** | `S.production.gaugeRules: [{id, clientId, family, racks, gauges, lines, note, at}]` and `learn.parts` now written (`{partNumber, gauge, how: 'code' | 'set', at}` by client, floor name and gauge); a plated entry may carry `gaugeOptions` and `gaugeSrc: 'rack'`. All travel in `sep-production`'s `learn` and entries; **soma-internal** should keep them whole. Who plated a run is derived from attendance, never stored. **Also 30 Sep:** `S.production.partRules: [{id, clientId, racks, line, partNumber, name, note, at}]` (Samarth's parts by the round; in the book, not in the `sep-production` export); a plated entry may carry `partNumber` with `partSrc: 'rack'` and `partRack`; `learn.parts` may hold `{ambiguous: true, parts: [...]}` for a floor name learnt as two parts, and `how: 'code+name'`. |
| **Part times and the per-hour constant, 30 Sep 2026** | `client.partTimes: [{id, base, gauge, name, line, pieces?, pickleMin?, plateMin?, at, history?}]` (a figure left out is measured from the production record) and `S.perfCfg.overheadMin` (15). **soma-internal** may read them for a costing by the hour; nothing it sends writes them. The area list gains `civil` (a post, off the floor). |
| **Stock corrections, 30 Sep 2026** | A stock entry corrected is voided with `voided.reason` ('Corrected to …') and `voided.correctedBy`, and its copy carries `corrects: {id, qty}`. The export is whole as before; **soma-internal** should take the copy and drop the voided one, as for any void. |
| **Attendance deletes, 30 Sep 2026** | New top-level `attendanceDeletes: [{id, key, iso, reason, how: 'by hand' | 'migration', at, marks, extra, day}]`: a day removed from `attendance` with its reason, kept whole. **soma-internal** should read a day missing from `attendance` against this log before calling it unrecorded; the book's `"null"` day (23 marks) is the first entry. |
| **Power, 30 Sep 2026** | New top-level `power: {load: {sanctioned, approved, approvedOn, ref, note}, cfg, items}`. Electricity `costBills` rows gain optional `kvaBilled`, `md`, `kwh`, `kvah`, `fixed`, `energy`, `fca`, `duty`, `net` (and `penalty` as the excess-CD penalty). **soma-internal → app**: `analysis/sep-power-history-YYYY-MM-DD.json`, a `sep-production` file of the power-cut log's cuts (ids `PCLOG-NNN`; `downtime.atLeast` for a power-back known only as a bound, `downtime.inferred` for a close the log inferred, `downtime.phase: 'single'` for a single-phase fault; `basis` register where the source cites a register page, relay where only a message) plus `power.bills` (`paid` is what the bank shows and becomes the bill's amount, `net` the net payable, `basis` says which) and `power.load`, imported on Power → Cuts. **App → soma-internal**: the cuts leave in Production's `sep-production` export, and the case is printed from Power → Case. |
| **What to do and error reports, 1 Oct 2026** | Tasks of the owner's own (`todo.tasks`) may carry `go` (a jump: `{kind, …}`), `goLabel` and `advKey` (a move added from the Pulse or a task's moves). Quotations may carry `draftNote` (a draft opened from a move; never printed). App tasks are not stored. Error reports go to Sentry from the live site and carry no book data; nothing about them is in the book (`sep_inv_err_off`, `sep_inv_err_queue` are per device). |
| **Direction B and the guard, 1 Oct 2026** | New top-level `users: [{id, name, role, active, secret: {alg, iter, salt, hash, digits}, createdAt, createdBy}]` (a PIN only as a salted PBKDF2 hash), `guardCfg: {lockMinutes, askMinutes, roles: {office, supervisor, floor: {pages, may, wages, finance}}, recovery}`, `devices: [{id, name, user, registeredAt, registeredBy, build, lastPushAt?, removedAt?, removedBy?, removeReason?}]` and `changeLog: [{id, at, by, dev, op: add/change/remove, coll, rid, label, fields: [{f, from, to}]}]` (every save compared record by record). A GitHub copy pushed with the guard on carries `_device` beside the book. **For the compile:** keep `changeLog` whole (it is what the merge, G4, will sync); never expect a PIN, a token or a key in a backup. With no owner in `users` the guard is off and nothing else moves. Today's view (`?tab=pageHome&v=needs\|pulse`) and the workspaces store nothing in the book. |
| **Quotations and reports, 1 Oct 2026** | New top-level `quotations: [{id, num, fy, displayNumber, rev, revOf, revReason, date, clientId, to: {name, address, gstin, state, attn}, intro, lines: [{item, partNumber, desc, basis: kg/piece, rate, refWeightKg, note, postedAt?, postedTo?}], gstPct, sac, transport, minConsignmentKg, lotPcs, validDays, paymentDays, terms, status: draft/issued/accepted/declined/superseded/void, issuedAt, supersededBy, voidReason, acceptedAt, createdAt, at}]` and `qtnCfg: {signatory, signTitle, footNote}`. **The app now issues the `SEP/QTN/<FY>/NNN` series** that `soma-internal/operations/quotations/README.md` registers by hand: the compile should read the app's issued quotations into that register (a draft has no number and is not a row), and the next number here starts above the highest **in the app** — the five issued in 2026-27 so far (001–005, 001-A) are not in the book, so **the owner should record them (or set them aside) before issuing from the app**, or the app's first will be 001 again. Clients' `itemRates` rows may now carry `unit: 'kg'`, posted from an accepted quotation. Reports store nothing. |
| **The QA chain, 2 Oct 2026** | `S.attendance[iso].slotHand: {staffId: {morning\|evening\|night: areaId \| ''}}` — a hand's own OT slot pick, kept apart from the EXTRA rows. A `block` row with `slotMade: true` was made by the app for a pick: **it books nothing and is no EXTRA row; the compile must not read it as one** (hours 0, its crew the hands who picked it; the slot's usual times). `relayPastes[]` gain `sentAt` (the minute of `sentOn` WhatsApp sent the roll). Clients' `itemRates`: the first row whose pattern a part contains prices it, a row posted from a quotation goes before the broader ones, a row with no `unit` is per piece, and an override prices a line only in its own unit. `guardCfg.roles.*.may`'s `imports` now means the floor's files only; replacing the book is the owner's. The change log names the person for the guard turned off, a PIN reset from the lock and a book brought in. The lockout's count (`sep_inv_guard_fail`, now per ID) is on the device, never in the book. |
| **Backup shape changed, 25 Sep 2026 (pay)** | New top-level `staffPayments: [{id, staffId, date, amount, kind: payment/advance, note, at, voidedAt?, voidReason?}]`: wages paid out, voided and never deleted. **The attendance week is now the pay week, Sunday to Saturday**, numbered by its Saturday's ISO week (the payout files' own numbering). Any compile step that groups attendance by week should use the same boundary. |
| **Backup shape changed, 26 Sep 2026 (a challan invoiced in parts)** | ⚠ **A data-flow change to how the sister repos read challans.** A challan (IM) line may now be billed by several invoices. Its billed quantity is derived from the invoice lines naming it (`imItemId`, invoices not cancelled) and cached on the line as `billedQty`, `billedNos` (KG lines with pieces), `invoiceIds` (every invoice, oldest first; `invoiceId` is the latest) and `invoiced` (true only once nothing is left). A line with `billedQty > 0` and `invoiced: false` is **part-invoiced**; its unbilled share is `qty − billedQty` and its unbilled amount `amount × left ÷ qty`. `billedLegacy: true` marks a line billed whole by an invoice from before `imItemId`. Invoice lines gain `imWhole` (an old loose link that billed the whole challan line) and `overBillAck: {at, left}` (billing more than was left, accepted on save). **For the compile:** anything reading `invoiced` / `invoiceId` as "this line went on that one invoice" should read `invoiceIds` and `billedQty` instead, and unbilled material should be the open share, not the whole line. |
| **Backup shape changed, 28 Sep 2026 (receivables start)** | `bank.opening[clientId]` gains `date`: the day the amount was owed on, which is now the later of the statement's first day and the book's first invoice (`bankRecvFrom`). One with no `date` meant the statement's first day and is counted only while that is still the start. An opening taken from the app's suggestion carries `suggested: true`. **For the compile:** receivables, days to pay and the owed figures no longer read receipts from before the book's first invoice, and a receipt is set only against invoices raised by its own day (the rest is on account). |
| **Backup shape changed, 28 Sep 2026 (production)** | New top-level `production: {entries, pastes, photos, imports, learn: {clients, parts}}`. An entry: `{id, kind: arrived/pickled/plated/downtime, date, time?, to?, slot?: general/ot/day, line?: vat-a1/vat-a2/barrel, lineSrc?: written/set, clientId?, client (as written), part, partNumber?, gauge?, qty?, unit?: NOS/KG/BAG, qty2?, unit2?, qtySrc?, rounds?: [{time, qty, start?, struck?, over?}], rackSize?, racks?, rework?, downtime?: {cause, open}, basis: register/relay/hand/pickling/floor-in, src: paste/photo/hand/import, raw?, n?, pasteId?, photoId?, importId?, msgHash?, sentBy?, by, at, replaces?, voidedAt?, voidReason?, voidBy?}` — stored sparse (a missing field is null). A correction is a new entry naming the one it replaces; a wrong one is voided, never deleted. `photos` hold facts only (`sha`, size, model, prompt version — `reg-v2` from 28 Sep, the date and line read, `page`: production / power, the row count, a fingerprint), **never the image**. Power cuts read off the register's power log are `downtime` entries with `basis: 'register'`, `src: 'photo'`; the pickling hand's are `basis: 'pickling'` — **the compile should join a cut reported by both** (same day, overlapping or within ten minutes, different sources), as `prodDowntimeDay` does, or it counts twice. Register rounds carry `batch: true` for an END row's whole figure, `written` (the figure as written, e.g. `98×8+1`) and `rack`/`n` where a product was written. `learn.clients` maps a written spelling (upper-case letters) to a client id. The usual line, rack sizes and pickled → plated matches are derived on read and never stored. `todoCheck` gains `prodPlatedUnbilled`, `prodPickledNoChallan`, `prodPlatedDays`. |
| **Knowledge base, 5 Oct 2026** | New top-level `kb: {articles, trained, paths, deleted}` in the backup (`deleted`: drafts deleted here, so an older file does not bring them back; `roles: []` is everyone, `['owner']` the owner alone; QA chain of 5 Oct 2026). **soma-internal owns the rulings** (as with stock); the app owns what is written in it (how-tos, faults, incidents, decisions). Knowledge → Library → Export writes `sep-kb-YYYY-MM-DD.json` `{format: 'sep-kb', version: 1, exportedAt, build, articles, trained, paths}`; Import merges by id: a newer `version` replaces an older one (kept in `versions`), nothing is deleted. An article: `{id, kind, title, summary, body, tags, links: [{type, id, label}], roles, status: draft/pending/published/superseded/retired, version, versions, by, byId, at, approvedBy, approvedAt, src: app/import/build, srcRef}` plus its kind's fields (ruling `ruledBy`, `ruledOn`, `supersedes`, `supersededBy`; fault `symptom`, `causes`; incident `on`, `faultId`, `cause`, `fix`; decision `question`, `options`, `chosen`, `reason`, `decidedOn`, `reviewOn`, `figures: [{key, args, then}]`, `reviewed`; guide `quiz`). `trained: [{id, staffId, name, articleId, v, on, at, by, score, note}]`. **Photos never travel** (`images` holds ids only; the pictures stay on the device). **The compile should keep `kb` whole** and treat a published ruling as the record of the owner's decision; the first content came from soma-internal's `decisions/`, `operations/` and `frameworks/`, each article naming its `srcRef`. |
| **Planner, 6 Oct 2026** | New top-level `planner: {cfg: {lines: {vat-a1/vat-a2/barrel: {kgRound, every}}, pickKgH, otLineHour, powerFixed, cash, costs}, machines: [{id, item, station, line, state, age, needs, risk: {p, cost, days, say}, at, by, retiredAt?, retireReason?}], checklist: [{id, ref, what, status, cost, owner, due, evidence}], lenders: [{id, who, amount, rate, months, mor, ties, status}], heard: [{id, what, value, from, on}], heldBack: [{id, clientId, why, kg, rate, line, chance, note}], scenarios: [{id, name, goal, plan, asks, chances, loan, cards}], active}`; any register record may carry `retiredAt, retireReason, retiredBy`, and heldBack's `why` is cert, turnaround, approval or other. **For the compile:** the registers are the shop's records (machines' states, the CQI-11 checklist, lenders' terms, rates heard, work held back): keep them whole; scenarios are sandbox and need not be read. Nothing flows out of the planner into the book. |
| **Monthly register, 6 Oct 2026** | New top-level `attRegister: {months: {'YYYY-MM': {month, src: import/photo/hand, title, columns: [{name, staffId?, total?}], days: [{date, written, kind: work/sunday/holiday, cells: [{raw, unsure?, edits?: [{at, by, from, to}]}], note?, dateUnsure?}], notes, verifiedAt?, verifiedBy?, filledAt?, photo?: {size, model, at}}}, names: {KEY: staffId}}`: the supervisor's monthly book as written, a cell's raw text read in code. Marks the owner puts on a day from it carry `src: 'register'`. Staff → Register → Import takes `sep-att-register` v1 `{kind, version, months: [{month, title, columns: [name], days: [{date, written, kind, cells: [{raw, unsure}], note}], totals: [{col, raw}], notes}]}`; a month on record is kept. **For the compile:** the book is the source the monthly slips are made from; the pages of March–September 2026 were transcribed privately (handed over 6 Oct 2026, never committed). Keep `attRegister` whole beside `payrollPaid`. |
| **Backup shape changed, 8 Oct 2026 (power causes)** | New `power.causes: [{id: 'PCS-…', kind: reason/fix, name, aliases, scope?: grid/plant/'', at, by, mergedInto?, mergedAt?, mergedBy?, editedAt?, editedBy?}]` — one name written one way, every spelling typed kept; a merged entry points at the one it joined. Production `downtime` entries gain `downtime.reason` and `downtime.fix` (ids into that list), `where` (`all` or a station), `unitId` (a plant register unit), `note`, `setAt`, `setBy`; a time typed in the app sets the entry's `to` with `downtime.closedAt`, `closedBy` (a name, where a paste's top-level `closedBy` is a paste id) and `closedHow: 'hand'`, dropping `atLeast` / `inferred`. **The `sep-production` export carries `powerCauses`** (the list its cuts name; version stays 1), and an import merges it by id, joining one written the same way. **For the compile:** read a cut's reason through the list, following `mergedInto`; keep the list whole. `todoCheck` gains `powerComplete`, `powerCause`. |
| **Bank statement import, 8 Oct 2026** | The statement may come as the .xlsx Excel saves it, and a two-page statement's page foot (its time under TRAN DATE, *Page 2 of* under BALANCE) is passed over. No record shape changed; the `sep-bank` export is as before. |
| **Today as cards, 8 Oct 2026** | Nothing in the book: a card's fold is per device (`sep_inv_folds`, keys `tdy-*`), like every fold. |
| **Produces** captured production → `soma-internal` (the owner) | **Built 28 Sep 2026.** Production → Entries → Export writes `sep-production-YYYY-MM-DD.json`: `{format: 'sep-production', version: 1, exportedAt, build, entries, pastes, photos, imports, learn, powerCauses}` (`powerCauses` from 8 Oct 2026). Always whole; ids are stable, so the compile de-duplicates on them and keeps the newest copy of an entry (a void is a later copy). The inferred line is never exported. |
| **Consumes** the production history ← `soma-internal` | Production → Entries → Import takes the same `sep-production` v1 shape. Merges by id and never overwrites; a client is kept by id only where the book holds that id under the same name, else found by name, and a name the book does not hold is counted and kept as written, never invented. Entries without `src` are stamped `import` and raise no To-do task. |
| **Produces** attendance from the supervisor's rolls → `soma-internal` | **Built 25 Sep 2026.** Staff → Paste message reads the in/out-time rolls into `S.attendance` in the seed's own shape (marks by worker id, `coverage` / `block` EXTRA rows), so the compile reads pasted days exactly as it reads seeded ones. Each roll is kept whole in `relayPastes`. The parser was calibrated against `analysis/sep-attendance-seed-2026-09-{07,12}.json`; if the decode conventions change there, say so here. |
| **Produces** captured stock entries → `soma-internal` (the owner) | **Built 24 Sep 2026.** Stock → Export writes `sep-stock-YYYY-MM-DD.json`: `{format: 'sep-stock', version: 1, exportedAt, build, items, entries, pastes}`. Always the whole record; ids are stable, so the compile de-duplicates on them. Each entry: `{id, itemId, kind: count/received/used/charged, qty, date, from?, days?, rate?, price?, supplier?, billNo?, note?, unsettled?, voided?, at, by, sentBy, source: paste/manual/import, pasteId?, n?, raw?}`. `pastes` hold each message whole. The same data is also in the full backup under `stock`, with `stockCheck: {redDays, amberDays, chemModel}`. The ledger stays `soma-internal/operations/chemical-stock-log.md`. |
