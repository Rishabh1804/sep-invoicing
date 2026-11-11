---
subject: "Stock"
domain: floor
modules: [split/cost.js, split/stock.js]
specs: []
tests: []
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Stock
Floor → **Stock**. Chemical stock, **owned by `soma-internal`** (owner, 24 Sep 2026): this tab is a view
and an input, never the ledger. Everything it captures is copied there at each compile and stays here.

**The record is events, not levels** — `S.stock.entries`: `count` / `received` / `used` / `charged`,
each with the day it is about, when it was typed (`at`), who sent it (`sentBy`), who typed it (`by`), and
for a pasted line the text it came from (`raw`, plus the whole message in `S.stock.pastes`). The level is
**replayed** (`stockReplay`): a count sets it, a delivery adds, a use or charge takes away. A table of
levels could not have caught what the first real message carried — *nitric acid, `add 60+10=70 … use 30
… available 70`*: the supervisor's own working says 40.

**The owner pastes the supervisor's WhatsApp message** (`parseStockMessage`, pure, no `S`). Numbered
lines, wrapped lines, the shop's spellings (`SOLLT`, `ZINK`, `CYNEDE`, `BRIGHTNER` — `stockKey`), and
three arithmetic shapes: `opening − used = left`, `add received + opening = total − used = left`, and
`rate × days = used`. Tested on the 22 and 24 Sep messages: all 30 lines read, before any screen existed.
**Before anything is saved, every line is shown with the text it came from and what was read:**

- 🔴 **Needs you** — the message contradicts itself. Pick *the working*, *the figure written*, or save
  it **unsettled** (the default: the app never picks for you). Warn, never block.
- 🟠 **Check** — an assumption or a disagreement with the app: an opening that differs from the app's
  level, a count **up** with no delivery recorded (65 R, 24 Sep: 6 → 15 L), a line with **no name** read
  by its **position** in the last message (24 Sep line 14, `70-10=60`), a delivery with no date on a
  window over two days, a number it could not place.
- A new name becomes a new line; a known name, or one the operator mapped once, is remembered.
- A nameless line's picker offers the saved lines **and the lines the same message is adding** — on a
  device's first message nothing is saved yet, and the picker was empty (owner, 24 Sep 2026, line 14).
  **And it takes a typed name**: 24 Sep's line 14 is the only nitric line and carries no name, so
  nitric is named nowhere in that message and no menu could offer it. The name is kept as typed and
  redrawn only on Enter — redrawing on blur replaced the Save button under the tap that caused the blur.
- The same message twice is refused — every figure would count double.

**Days left = level ÷ daily use**, the use over the last three weeks of record divided by the days it
covers — Sundays out, the shop's own divisor (16–22 Sep is `6 day`). Under three days of record the
figure carries a `?`. Red at 3 days or fewer, amber at 7 (Settings → Checks & alerts → Stock alerts). **A line charged into a
bath (zinc) is never red at an empty shelf**: the delivery going into the bath is the normal state.

**By hand**: Count / Received / Used / Charged against one list; Received takes a price per unit,
supplier and bill. A wrong entry is **voided, never deleted** — the export is the record's source, and a
vanished entry would leave `soma-internal` holding a figure the app no longer explains.

**Export is always whole** (`sep-stock` JSON: lines, entries, messages, build) and import **merges by
id, never overwrites** — `soma-internal` de-duplicates on the ids at each compile.

**Prices, bills and the live cost** (owner, 25 Sep 2026: *"There is no place to enter a stock's price? When
entering received stock - also ask for the company, invoice number and date of invoice ... The calculation
of live cost should be broken down so that every cost is visible and measurable and pattern is recorded of
the stock (price, usage, cadence, etc.)"*). `cost.js`.

- **A delivery is recorded with its bill.** Received by hand needs the company and the invoice number (its
  date defaults to the day received), with a labelled ₹-per-unit column (before GST). A delivery that
  arrived by paste has no bill; **Add its bill** on the entry completes it. A past purchase is a **`bill`
  entry**, which records what was paid **without moving the level**: the goods are already in a count or a
  delivery, and adding them again would count them twice. A line with no price says so.
- **Each line shows its pattern**, read from those records: the last price and its change, the range, each
  supplier's bills, quantity and spend, how often it is bought (median gap, with a delivery and its own bill
  counted once), when the next one is due, use per day and over 30 days, and cost per day and per month at
  the last price. Two bills on one day: the larger sets the price, so a local top-up at a higher rate does
  not stand in for the drum.
- **Stats → Tables → Cost → Live cost** (Stats → Cost until U3) replaces the chemicals card. It lists every component with its ₹ and ₹/kg and tags
  its **source**:
  - *measured*: from this app's records;
  - *part-recorded*: unpriced lines used, or a stock record that starts partway through the period (it
    says how many days it covers);
  - *market rate*: zinc charged with no bill yet;
  - *model*: a Settings fallback, used only where nothing is recorded.
  Opening a line shows its parts: labour by tier; chemicals line by line as quantity × price, with unpriced
  lines named; each power or other bill with its share of the month. **What was bought in the period is
  shown for reference and never used as the figure**, because a purchase is stock on the shelf, not use. **Zinc is the
  exception** (intelligence step I2, 6 Oct 2026): it goes into the bath as it arrives (the 24 Sep delivery of 495 kg
  was charged within four days), so a charge record starting partway through a month is a lump, and the days before it
  filled at the model counted September twice (₹3.94/kg). Over a period of 28 days or more whose charge record does
  not cover it, zinc is **its bills over the 90 days to the period's end, per kg plated over the same days**
  (`costZincByBills`), the window starting no earlier than the first zinc bill on record; on the owner's book
  ₹2.21–2.37/kg, beside the model's ₹2.21.
  Modelled zinc is priced at the last price paid by the end of the period, then today's market rate, then
  the cost model's ₹2.21/kg.
- 🔴 **An unrecorded stretch is FILLED at the model, never read as zero.** Each row is measured where the
  record exists and filled pro rata where it does not: labour's unrecorded working days, the days before
  the stock record starts, a month with no power or other bill. The fill is its own line in the breakdown
  ("Not recorded: …"), and only the measured part counts toward *measured*. The first cut read the gaps as
  nothing, and on real data the quarter's live cost came out at **₹2.92/kg, "93% measured"**: one July
  power bill stood in for three months of power, and three days of stock use stood in for the quarter. That
  flattered every client's margin by ₹4+/kg, SSS Mehta included (+₹2.42 against −₹1.97 once filled).
  **A figure that reads cheapest where least is known is the error this card exists to prevent.**
- **Power and other bills** (`S.costBills`: kind, the month the bill covers, amount, units, note) are entered
  on the card and voided with a reason, never deleted. A bill counts in proportion to the share of its
  month's days that fall in the period. Fallbacks (power ₹0.81/kg, other ₹0.42/kg, zinc 425 kg/month) are
  in Settings → Costing → Live cost fallbacks (`S.costModel`).
- **Past purchases come from `soma-internal`** through Stock → Import: a `sep-stock` file of `bill` entries
  (and `costBills`), merged by id. The file is built from the private records and never committed here. Its supplier finds one held
  here by its name too, its payments re-pointed to it, and its prices quoted merge by id onto the line as this book holds it.

**The phone bar is Direction B's** (below): Home · Office · Add · Floor · Money (Today until UI pass 3), with no More. Each workspace carries a red
count of the red rows that jump into it (stock out, your own tasks overdue on Today). The test fixture's `switchTab` opens
the target's workspace first when no door to it is on screen.
