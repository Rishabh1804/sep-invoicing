# Finance & intelligence — the spec

**Status:** written 26 Sep 2026, before any of it is built, so the work survives a compacted or fresh session.
**Owner's asks (26 Sep 2026), verbatim where it matters:**

1. *"For those 21 cheques — make sure we have a field to enter the client so that what the client owes starts
   coming down to the actual figure. Also tag cheque numbers to clients — their series will help in automation of
   assigning a client further down the line."*
2. *"For July, make sure that reason is mentioned or has a place where we can mention it."* July 2026's GST was
   paid by another route; soma-internal's 19 Sep handoff: *"the ACI route was August's only"*. The statement
   cannot show it.
3. *"The dashboard should be more like financial dashboard with interactive pie charts, line charts, trends chart —
   as we have the bank statement the prediction for live cost should become ever closer to the real picture.
   Include all of it to the intelligence layer and work on the finance, costs, stats, staff, stock, pay, etc, tabs
   to link the picture together."*
4. Earlier the same day: *"We'll do the same [dashboard] for Staff, Stock, etc as well."*

**Read with:** `CLAUDE.md` (the Bank, Finance, Stats, Live cost, Insights and Pay sections), and
`docs/SEP_INVOICING_DESIGN_PRINCIPLES.md` (every new screen is built from its §6 components and amends it when it
needs one it does not define).

---

## 0. Where things stand at the time of writing

| Piece | State | Where |
|---|---|---|
| Bank statement import (`.xls` as downloaded), merge by id, balance check | merged (#78) | `bank.js`, `xls.js` |
| Excel export (Statement + Summary) | merged (#79) | `xlsx.js`, `bankExportXlsx` |
| Sidebar: Staff from Pay, Clients from Items | merged (#80) | `init.js` `sideGo` |
| **Finance page** (Overview · Receivables · Payments · Bank · Bills & notes · GST), Bank and Bills & notes moved out of Stock | merged (#81) | `finance.js` |
| This spec | merged (#81) | `docs/FINANCE_INTELLIGENCE_SPEC.md` |
| **Phase 1** — cheque placement links, series tagging and suggestion, GST month notes | merged (#81); P59 | `bank.js`, `finance.js` |
| **Side track A** — challan line filled from the record, reason for a red flag | merged (#82); P63 | `state.js`, `im-form.js`, `events.js` |
| **Phase 2** — `chartLines`, `chartStack`, `chartPieTap`, range chips, tap-to-read | merged (#83); P60 | `charts.js` |
| **Phase 3** — the interactive Finance Overview (range, cash, where money went/came from, invoiced vs received, GST chart) | merged (#83); P59 | `finance.js` |
| **Phase 4** — bank-paid cost by month, `notCost`, unsorted payees, precedence, recorded vs paid, Derive from the bank | built; P61 | `bank.js`, `cost.js`, `settings.js` |

Data already available to build on — **use these, do not re-derive**:

- `bankRows()` (chronological), `bankClassify(rows)` → `{row, cat, party, key, clientId, staffId, cash, guess, supplier}`;
  categories `receipt · wages · power · supplier · gst · tax · charges · reversal · other`.
- `bankReceivables(cls)` → per client `{client, opening, invoiced, notes, received, owed, open[], allocs[], oldestDays}`;
  each alloc `{v, how: 'exact'|'oldest', parts[], unapplied}`.
- `finCashByMonth(rows)`, `finAgeing(recv)`, `finGstByMonth(months, cls)` in `finance.js`.
- `liveCost(from, to, kg)` → `{rows: [{key: labour|chem|zinc|power|other, amount, measured, source, detail}], total, perKg, measuredShare}` (`cost.js`).
  `source` is `measured · bank · partial · rate · model · none`; a labour row taken from the bank carries `bankShare`.
- `bankCostByMonth()` → `{months: {ym: {labour: {amount, named, cash, rows}, power, other, supplies, unsorted}}, cover}`,
  `bankMonthKnown(bm, ym, key)`, `bankCostForRange(from, to)` → per key `{amount, known, months[]}` plus `unsorted`
  (`bank.js`). `liveCostPaidCheck(from, to)` → `[{key, label, recorded, paid, delta, pct, flag, months, skipped, note}]`
  — Phase 5's `costGap` reads `flag` (`cost.js`). `costDeriveCompute(keys)` → per key `{rows, paid, kg, perKg}`.
- `labourForRange(from, to)`, `payWeek(weekStart)`, `payrollPaidFor(month)` (`labour.js`, `payroll.js`).
- `weighLines(rows)` (tonnage), `statsRangeIso(period)`, `statsWorkingDays(from, to)` (`stats.js`, `intel.js`).
- `insMonthsBack(n)`, `insMonthly(months)`, `predCadence()`, `predMonthPace()`, and the To-do rule registry
  `TODO_RULES` / `TODO_RULE_FNS` / `TODO_CHECK_DEFAULTS` (`insights.js`, `todo.js`). **An insight is a To-do rule** —
  new intelligence goes in as rules, never as a parallel system.
- Charts: `chartLine`, `chartBars`, `chartPie`, `chartRankedBars` (`charts.js`). Line and bars assume values ≥ 0.

---

## Phase 1 — Cheques and the July GST note (finishes the Finance PR)

### 1a. Placing a cheque deposit on a client
- **Already exists:** Finance → Receivables → *Receipts with no client* lists every unnamed credit with a Client
  picker; a pick is stored on the row (`row.set = {cat: 'receipt', clientId}`), and a unique exact-sum match is
  offered as *Place with …*. **Gap:** the Overview only says *"N receipts not placed"*. Make it a link that opens
  Receivables scrolled to that panel (`invFinLoose`), and put the same count on the Receivables tab label
  (`Receivables · 21`), so the field is one tap from where the problem is shown.
- A placed receipt can be **unplaced / moved** from the client's expanded receipts list (a small *Change* on each
  receipt row that reopens the picker). Today a wrong pick cannot be undone except through the Statement edit.

### 1b. Cheque numbers tagged to clients, and the series used to suggest
- **The instrument number is in the narration**, not the `CHQ.NO.` column, for deposits: `BY INST 525428 - MICR CLG (CTS)`.
  `bankInstrument(row)` → `'525428'` (digits after `BY INST`), else `row.chq` if present, else `''`.
- **Tag = the placement.** A deposit placed on a client (by hand, by *Place with*, or by rule) *is* the tag: no second
  store. `bankChequeSeries()` derives, per client, the sorted instrument numbers of every deposit placed on it.
  Shown on the client's expanded Receivables row: *"Cheques: 525421 · 525428 · 525433"* (last five, mono).
- **Suggestion by series** (`bankSuggestBySeries(inst)`): a client's numbers are a series when they share the
  number's length and all but the last three digits (one cheque book). A new deposit is suggested to the client
  whose series is nearest, **only** when: exactly one client's series contains a number within ±50 of it, and no
  other client's does. Shown like the exact-sum offer: *"Series: GENERAL ENGINEERING (525421–525433)"* with a
  *Place* button. **Offered, never placed** — the same rule as the exact-sum offer.
- **Both offers together:** if the series and the exact sum agree on one client, say so (*"series and amount
  agree"*) and make that the first button. If they disagree, show both and place nothing.
- **Never** auto-place without a tap in this phase. Phase 5 may add an auto-place rule, and only for series +
  amount agreeing, and only with a To-do telling the owner what it did.

### 1c. A month's GST paid another way
- `S.bank.gstNotes = { 'YYYY-MM': { note, paidOther, paidOn, via, at } }` — all optional but `note`; kept whole on
  export (`sep-bank` JSON gains `gstNotes`) and filled empty by `bankData()`.
- Finance → GST: every month row whose status is *Not in bank* gets **Add a note**; a noted month shows the note under
  the row. The form: *What happened* (required), *Paid another way* ₹ (optional), *on* date, *via* (text, e.g.
  "ACI account").
- A month with `paidOther > 0` counts that amount as paid and reads **Paid · outside bank** (info tone, not ok —
  the app cannot see it). A month with only a note reads **Noted** and the note's first line is its title.
- The Overview's GST tile follows the same rule. The *Not in bank* amber is only for a month with no payment and no note.
- **Seed nothing.** July 2026's note is the owner's to write; the spec only makes the place.

**Tests (extend P59, fake data):** instrument parsed from narration; series suggestion appears for a number inside a
placed client's series and not for one outside it or claimed by two; agreeing series + amount orders that button
first; a GST note with `paidOther` turns the month to *Paid · outside bank* and changes the tile; a note alone reads
*Noted*; export carries `gstNotes`.

---

## Phase 2 — Charts that answer questions (`charts.js`)

Everything stays SVG, CSS-sized, `<title>` on every datum (the existing contract), tokens only (HR-6/7), no library.

| New / extended | What | Why |
|---|---|---|
| `chartLine(data, opts)` gains **negative values** and **multiple series** (`opts.series: [{key, label, tone, values[]}]`) | zero line drawn when the range crosses it; a legend with each series' last value | balance can be overdrawn; in-vs-out and cost-vs-realisation are two lines on one axis |
| `chartLine` **band** (`opts.band: [{lo, hi}]`) | a shaded range around a forecast | the cash forecast (Phase 5) is a range, never a single line |
| `chartBars` **stacked** (`opts.stacks`) and **grouped** | outflow by category per month; in vs out per month | "where money went" over time, not one month |
| `chartPie` **interactive** (`opts.action`, `data-key` on each wedge, selected wedge pulled out) | tap a wedge → the panel below filters to it | the owner asked for interactive pies |
| **Range chips** `chartRangeHtml(active)` → `3M · 6M · FY · All` | one control per dashboard, `change`-free buttons with `data-action` | the dashboard is read over different horizons |
| **Tap-to-read** | on a phone there is no hover: a tap on a point/bar/wedge writes its label + exact figure into a caption line under the chart (`.inv-chart-readout`) | `<title>` only shows on hover |

Components added here go into the design doc §6 (chart family) in the same PR.
**Tests (new P60):** a negative series draws below a zero line; two series render two paths and a legend; a band
renders; a stacked bar's segments sum to the bar; tapping a wedge sets the readout and fires its action; the range
chip re-renders with the window it names.

---

## Phase 3 — The Finance dashboard, interactive

Finance → Overview becomes the dashboard; the six tabs stay. One range chip row at the top drives every panel.

1. **Tiles** (as now) + **cash runway** tile (Phase 5 forecast: *"stays above ₹0 for 60+ days"* / *"dips below ₹0
   around 14 Oct"*).
2. **Cash** — multi-series line: balance (month-end), with money in and out as grouped bars under it; tap a month →
   the "where money went" panel moves to it.
3. **Where money went** — pie of outflow by category for the selected month *or range* (tap a wedge → the list below
   shows that category's rows, newest first, each opening the statement row); stacked bars of the same over the
   range.
4. **Where money came from** — pie of receipts by client over the range (tap → Receivables with that client open);
   unplaced receipts are their own wedge, named, never hidden.
5. **Owed to us** — ageing as a stacked bar per band; top debtors; **days-to-pay** per client (Phase 5).
6. **GST** — due vs paid bars by month (paid includes *outside bank*), with the note markers from Phase 1c.
7. **Invoiced vs received** — two lines over the range: the gap is what the book is lending its clients.

**Tests (extend P59):** the range chip changes the months every panel reads; a wedge tap filters; a month tap on the
cash chart moves "where money went"; unplaced receipts show as a named wedge.

---

## Phase 4 — Live cost that closes in on the real picture (`cost.js`)

The live cost today is **operational**: attendance (labour), stock use × price (chemicals, zinc), bills entered
(power, other), and the Settings model where nothing is recorded. The bank adds a **second, independent instrument:
what was actually paid**. Two routes to the same figure is this repo's strongest kind of evidence (CLAUDE.md, *Key
Business Data*).

### 4a. Bank-paid cost per component, attributed to the month it pays for
| Component | Bank categories | Attribution (the month it *pays for*) |
|---|---|---|
| Labour | `wages` named legs + `wages (cash)` | named monthly legs → **the month before** (salaries paid ~14th for last month); cash draws → the **pay week** they fund, pro-rated into months by days |
| Electricity | `power` | `bankBillMonth(row)` (already: the month before, operator-settable) |
| Chemicals & zinc | `supplier` | the month paid (a purchase is stock on the shelf, not use — so this is shown **beside** the use-based figure, never substituted for it) |
| Other | `other` minus partner drawings and transfers the owner marks *not a cost* | the month paid |

`bankCostForRange(from, to)` → `{ labour, power, supplies, other, coverage: {from, to} }`, with the rows behind each.
A new category flag is needed: **`notCost`** on a payee rule or row (drawings, loan repayments, transfers, GST, tax)
— GST and income tax are never costs; transfers to the owner are not operating cost. Default `notCost` for
`gst`, `tax`, `reversal`; everything else counts until the owner says otherwise.

### 4b. Precedence and the "closing in" rule
For each component and period, the live cost picks, **in order**:
1. **recorded operation** where coverage ≥ 90% (attendance days, stock record days, a bill for every month);
2. **bank-paid**, attributed as above, where the statement covers the period;
3. the **model**.
The source tag gains **`bank`** (*paid, from the statement*) beside *measured / part-recorded / market rate / model*.
The unrecorded stretch is still filled, never read as zero — now from the bank where it can be, before the model.

### 4c. The two instruments side by side (the check that makes it trustworthy)
Stats → Cost → Live cost gets a **Recorded vs paid** row per component over the period: *labour recorded ₹X · paid
₹Y · Δ*. A gap over 10% raises a To-do (Phase 5 rule `costGap`), naming the component and month. Known reasons are
written down, not smoothed: EXTRA pool paid in cash, salaries paid the month after, a supplier bill paid in two parts.

### 4d. Calibrating the model from the bank
Settings → Costing → Live cost fallbacks gains **Derive from the bank** for power ₹/kg and other ₹/kg (and labour
₹/kg in Settings → Labour): the trailing six months of bank-paid ÷ tonnage, each month's arithmetic shown,
**offered, never applied** — the zinc uplift's contract exactly.

**As built (26 Sep 2026), and one departure the real statement forced.** A payment the app only *guessed* as
`other` — the payee matched nothing — is **unsorted**, and counts as neither cost nor supplier. On the real
statement that residue was ₹3.4–5.6L a month (₹4–6/kg against a ₹0.42 model), and it was the zinc and chemical
traders: the stock record carries no supplier names for `bankMatchSupplier` to find. Counting it as *other* by
default read the quarter at ₹12.66/kg. So **other and supplies are known for a month only once nothing in it is
unsorted**; the live cost's *other* row lists what is unsorted as a reference line, and Finance → Payments lists the
payees with a **Sort** button that opens the row on the statement. `other` set by the operator (a payee rule or a
row) and bank charges count. Everything else is as specified. On the real book the statement puts electricity at
₹0.80/kg against the ₹0.81 model and labour at ₹3.46/kg against ₹3.55, while attendance records ₹2.02/kg for July at
100% of days — recorded vs paid flags labour +80% over June–July, which is the finding the check exists for.

**Tests (new P61):** attribution puts a 14 Sep salary leg in August and a JBVNL payment in its bill month; `notCost`
rows are excluded; precedence picks recorded ≥ 90%, else bank, else model, and the source tag says which; recorded vs
paid shows the delta; *Derive* offers a figure and changes nothing until saved.

---

## Phase 5 — Intelligence: rules, predictions, the cash forecast

All as To-do rules (`TODO_RULE_FNS`), switchable in Settings → Checks & alerts → To-do, each with figures, what to do,
what clears it, and a `sig` so a snooze holds until the figures change. **Warn, never block.**

| Rule | Raised when | Clears when |
|---|---|---|
| `bankStale` | newest statement row is 14+ days old | a newer statement is imported |
| `bankLoose` | a receipt has no client for 7+ days (one task, counts them; red at 10+ or ₹1L+) | every receipt is placed |
| `owed90` | a client has invoices over 90 days open (per client; red at 10% of the book) | paid or the opening is corrected |
| `payingSlower` | a client's last three receipts took 25%+ longer than its own median days-to-pay | back within its median |
| `gstNotInBank` | a closed month has GST due, no payment on the statement, and no note | paid, or a note is added (Phase 1c) |
| `powerPaidNoBill` | an electricity payment's month has no bill | the bill is added (one tap from the task: *Add as bill*) |
| `supplierNoBill` | a supplier was paid in a month with no stock bill from it | a bill is entered |
| `wageVsSlip` | a named salary leg differs from payroll as paid by ₹1+ (the crossed Behra legs) | amounts agree or a note explains |
| `cashSwing` | a week's cash draws differ from its payout by 25%+ | next week is within |
| `costGap` | recorded vs bank-paid differ 10%+ on a component (Phase 4c) | within, or explained |
| `runway` | the cash forecast dips below ₹0 within 45 days | the forecast clears |

### Predictions
- **Days-to-pay per client** (`bankDaysToPay(clientId)`): from every allocation, amount-weighted days between invoice
  date and receipt date; median and last three. Exact allocations weigh fully; oldest-first ones count, and the card
  says what share was exact. Shown on Receivables and the Overview debtor rows.
- **Expected receipts**: each open invoice due at its date + the client's median days-to-pay (the book median where a
  client has under three receipts), grouped by week.
- **Expected outflows**: salaries on the median salary day for the median monthly total; weekly cash on each
  Saturday at the median of the last eight weeks; electricity at the median bill in its usual week; GST by the 20th at
  last month's due less the median input-credit ratio; suppliers at their median monthly spend.
- **Cash forecast** (`finForecast(days)`): today's balance + expected in − expected out, day by day for 60 days,
  with a band from the spread of each input (P25–P75). **Says what it rests on** under the chart, like
  *This month at its pace* does.

**Tests (new P62):** each rule raises on its trigger and clears on its fix (fake data, dates from `todayIso()` — no
literal dates except inside the fixed-date statement fixtures, and no assertion that depends on today against those);
days-to-pay weights by amount; the forecast crosses zero on a constructed case and raises `runway`.

---

## Phase 6 — Linking the tabs into one picture

Each screen gets the finance fact that belongs to it, as a link into Finance rather than a second copy:

| Screen | Gains |
|---|---|
| **Home** | the Finance tiles strip (balance, owed, runway) under Month to Date, and an *Import statement* quick action (the statement is a file, so it does not go through *Paste message*) |
| **Stats → Overview / Cost** | live cost with the `bank` source (Phase 4); *In one line* adds cash position and days-to-pay |
| **Stats → Clients** | contribution by client gains **owed** and **days-to-pay** columns (a client at −₹0.87/kg that also pays in 120 days is two problems) |
| **Clients (master & Performance)** | a client's page shows owed, ageing, days-to-pay, cheque series, last receipt |
| **Register** | an invoice's detail shows *Paid by* (the receipt(s) it was matched to, exact or oldest-first) or *Open, N days* |
| **Staff → Pay** | each month's salary legs from the bank beside payroll as paid (moved from Finance → Payments, linked both ways); weekly cash draws beside the weekly payout |
| **Stock** | each supplier's payments beside its bills; a line's *last price* can be confirmed by the payment; the reorder list shows the cash it will need against the forecast |
| **Finance → Payments** | stays the one place all payments are categorised; each section links to its home screen |

**Tests:** one spec per screen asserting the link exists and lands on the right place with the right figure.

---

## Phase 7 — Staff and Stock dashboards (the owner's "same for Staff, Stock")

Same pattern as Finance: the screen opens on an **Overview** tab built from Phase 2's charts and Phase 5's rules.
- **Staff**: heads today vs complement, attendance % by week (line), labour ₹/kg by month (line with the model line),
  OT and EXTRA hours by area (stacked bars), payroll vs bank paid (bars), rules raised.
- **Stock**: days left by line (ranked bars, red/amber), spend by supplier (pie, interactive), use per day trend
  (lines), price trend per line, reorder cash need vs the cash forecast.

Specify each in its own section of this file before building it.

---

## Side track A — a challan line filled from the record, and a reason for a red flag

**Owner, 26 Sep 2026:** *"when entering a challan say for example SSSMehta — When I select C-Clamp 66x42(30x6) as we
know all its value and std weight and rate, fill that out automatically so that me or anyone can enter click through
it to verify and change if needed, if the change for the final amount is more than the conditions we have for matches
which raises a red flag then ask for a reason."*

- **One helper, both forms:** `lineFillFromRecord(client, date, item)` sets, where empty, the **unit** (the client's
  card: a part on `pieceRates` is NOS, else the part's own unit), the **rate on record** (`defaultLineRate`), and
  **kg per piece** (`getPieceWeight` on the client's card, else the Items Master `stdWeightKg`, marked as the master's).
  Called from the challan form's part pick (`selectChallanPartForLine`) and the invoice form's.
- **Counting fills the rest, never over a typed value.** NOS line: pieces × rate → amount (a piece client's amount stays
  editable — the customer's challan amount is the passthrough). KG line with pieces: pieces × kg/pc → kilograms. Each
  filled field carries `item._auto[field] = true` until the operator types in it; a filled field is marked *from the
  record* so tabbing through it is a check, not a re-type.
- **A red flag needs a reason.** A line whose `rateMatch` or `weightMatch` is **Check** (the Settings thresholds:
  10% or ₹100 at stake) or **×10 slip** cannot be saved until a reason is picked, one tap, under the line — the ₹0
  line's contract: *Customer's challan says so · Rate changed · Weight differs this batch · Other* (a note,
  recommended). Stored as `item.flagReason`, `item.flagNote`, and the verdict it was given against
  (`item.flagAt = {status, ref, value}`), so the invoice detail can show it and a later change is visible as stale.
  **Differs** (under the thresholds) asks nothing.
- **Tests (P63, fake data):** picking a part fills unit, rate and kg/pc; typing pieces fills the amount (NOS) or the
  kilograms (KG) and does not overwrite a typed figure; a line pushed past the threshold refuses Save until a reason is
  picked, then saves with the reason and the verdict; a Differs line saves without one.

---

## Conventions that bind every phase

- **One PR per phase**, draft, watched; the owner merges. Each PR updates CLAUDE.md, the design doc where a
  component is added, and this file's §0 table.
- **Fake data in every spec and mockup.** Real statements and backups are read locally from
  `/home/user/soma-internal` only to sanity-check figures, never committed, never screenshotted to the owner.
- **Numerator and denominator, same population** — every ratio (₹/kg, days-to-pay, coverage) is taken over one set.
- **A figure says what it rests on.** Every tile and chart names its instrument and coverage; a partial figure reads as
  partial; *unknown* is never shown as *zero*.
- **Offered, never applied** for anything the app infers about money: client placements, calibrations, attributions
  the owner can override.
- **Warn, never block.** Nothing in this spec stops an entry.
- **Global scope:** every module shares one; grep `split/*.js` before adding a top-level name.
- **Selects speak through `change`**, dates through `change`; only re-render what the control changes.
- Full suite before every push (`pnpm exec playwright test`), screenshots phone-dark + desktop-light with fake data.
