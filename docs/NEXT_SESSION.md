# Next session — SEP Invoicing (Session B of four)

**Set by the owner, 24 Sep 2026.** This repo is worked in its **own session**. A separate
**compile session** (Session D) attaches all three SEP repos and reconciles their data. The model
is described once, canonically, in `soma-internal/docs/CROSS_REPO_SESSIONS.md`. This file
carries **this repo's side** of it: the work queued here, and what this app produces and consumes.

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
| **Backup shape changed, 25 Sep 2026 (pay)** | New top-level `staffPayments: [{id, staffId, date, amount, kind: payment/advance, note, at, voidedAt?, voidReason?}]`: wages paid out, voided and never deleted. **The attendance week is now the pay week, Sunday to Saturday**, numbered by its Saturday's ISO week (the payout files' own numbering). Any compile step that groups attendance by week should use the same boundary. |
| **Produces** attendance from the supervisor's rolls → `soma-internal` | **Built 25 Sep 2026.** Staff → Paste message reads the in/out-time rolls into `S.attendance` in the seed's own shape (marks by worker id, `coverage` / `block` EXTRA rows), so the compile reads pasted days exactly as it reads seeded ones. Each roll is kept whole in `relayPastes`. The parser was calibrated against `analysis/sep-attendance-seed-2026-09-{07,12}.json`; if the decode conventions change there, say so here. |
| **Produces** captured stock entries → `soma-internal` (the owner) | **Built 24 Sep 2026.** Stock → Export writes `sep-stock-YYYY-MM-DD.json`: `{format: 'sep-stock', version: 1, exportedAt, build, items, entries, pastes}`. Always the whole record; ids are stable, so the compile de-duplicates on them. Each entry: `{id, itemId, kind: count/received/used/charged, qty, date, from?, days?, rate?, price?, supplier?, billNo?, note?, unsettled?, voided?, at, by, sentBy, source: paste/manual/import, pasteId?, n?, raw?}`. `pastes` hold each message whole. The same data is also in the full backup under `stock`, with `stockCheck: {redDays, amberDays, chemModel}`. The ledger stays `soma-internal/operations/chemical-stock-log.md`. |
