---
subject: "QA sweeps and chains, Sep to Nov 2026"
domain: core
modules: []
specs: [docs/UI_PASS_3.md]
tests: [P104, P113, P114, P123, P129, P130, P149, P150, P151, P152, P153, P211, P212, P213, P214, P215, P216, P259]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

**The QA sweep of 29–30 Sep 2026** (owner: *"sweep the codebase for dead and redundant code … sweep the app for bugs and
behavioural issues. Do a QA chain and fix the issues"*). Governors audited seven areas (about 150 findings), a scratch harness
pressed every action on every page and view (phone 249, desktop 247: no uncaught error) and the real book drew every page on both
layouts; builders fixed each area with its spec (P104–P113). What it leaves as rules:
- **One set of helpers** in state.js: `isoOf`, `isoAddDays`, `isoDaysBetween`, `isoFromDmy` (null for 31/09), `numMedian`; one
  line-pricing function `linePrice(item, client, onDate)` for the invoice and the challan form (a typed rate is kept on both).
- **The start never bricks**: each boot step is guarded (`bootStep`), a screen is remembered for a reload only once it has drawn,
  records with no lines array are repaired on load, and a start that changes nothing writes nothing.
- **A device whose book is in IndexedDB** (`sep_inv_idb_used`) never works on another copy when the database will not open: it is
  read-only with the banner. A start-up save refused by another window's save is taken quietly.
- **Escape closes the top layer** the way Back does (`navCloseLayer`), after closing an open suggestion list; a swipe does nothing
  while a layer is open; opening a screen on a touch screen never focuses a field.
- **A jump shows what it names**: `regJump` / `imJump` / `imJumpClient` clear the filters and selection they do not set, and a
  challan opens on its tab and month with its row revealed (`uiRevealEl`).
- **Bank payee rules have a direction** (money in under `KEY|in`); an old wage, supplier, electricity, GST, tax or charges rule
  stays money-out. **The sep-bank export's `parties` carry `dir`** — a data flow soma-internal reads.
- **The roster names a worker by `staffNameKey`** (letters, digits, or the name itself when not in Latin letters); a renamed worker
  keeps the old name as a spelling, so payroll slips still find them.
- **What the sweep left to the owner, and their rulings (30 Sep 2026)**, all built (P114): `gstRound` rounds the decimal figure
  (*"change it"*, HR-8); a pay balance carries across periods until cleared with a reason (*"yes, unless stated otherwise and
  notification cleared"*, Pay); a second electricity bill in a month is arrears plus a penalty (Bills & notes, now Money → Payments); *"night hold is
  night shift"* on the in-time roll too; a correction on a new invoice reaches its challan with a note; Home nets credit notes and
  says so.

**The QA chain of 30 Sep 2026, the second** (owner: *"Go for a full QA chain on the app"*). Seven audits (about 90 findings, most confirmed
on the real book), a scratch harness pressing every action on every page (the real book on the phone: 334 actions, no error, nothing stuck),
every page and view measured and shot on the real book, then one builder per area with its spec (P123–P129) and the screen fixes (P130).
What it leaves as rules:
- **A book that would not load is a stand-in** (`bookStandIn()`, `_storageHealth.readKind`: closed, threw, unparsed, gone): nothing is written,
  auto-push never arms, a push by hand asks with both sides' counts, the banner exports the stored copy as it was read, and an export of the
  stand-in is named as one. A database that opens empty on a device whose book lived there (`sep_inv_idb_used`) is **gone**, not new. An import
  or pull the owner confirms sets the unreadable copy aside under `unreadable-<ts>` (never deleted) in the same transaction as the new book.
  **The sync SHA means GitHub holds what this disk holds**: a pull records it only after its save lands, a failed save or a stand-in never
  records one, and an import forgets it (`ghForgetSha`), so the next push asks.
- **Billing**: the invoice Part field holds the part number (the description under the line). A reissue takes over what was keyed on the
  old invoice's id — its legacy challan lines and every credit note naming it (`invReissueCarry`). Next moves back only by a delete, onto the
  last number handed out (`invNextAfterDelete`); a Next set in Settings is stamped (`invNextSetAt`). A document dated outside the year its
  series names asks first (`seriesFyAsk`). Settings' reissue refuses a reconciled gap or a cancelled-then-deleted number.
- **Money**: `gstRound(val, dp)` takes places (whole rupees for `finRs`, four for a stock price). Receivables apply notes and receipts in date
  order; an exact match settles to the paisa (`rounding`), so owed always equals the open list. The forecast says **overdrawn** and **outflows
  only** (`noInflow`: no receipt placed yet), the latter amber. **An imported statement can be removed** with a reason (Money → Bank →
  Imports): only the rows it added go, its record keeps `removedAt`, `removeReason`, `rowsRemoved`, `removedIds`.
- **Live cost**: the stock record starts at the first **use or charge**, never a count or a delivery, and a period with no chemical drawn is
  filled at the model — one back-dated delivery had read the quarter at ₹4.70/kg (about ₹7.9 measured this way).
- **Stock messages**: "VAT A 2", "V A 1", "VAT-2" are one area word (`stockFoldAreas`), a use clause sums every part and never reads a date,
  and a "+" sum after "use" is the use. A correction replays where the entry it corrects stood. A use before any count is **Not counted**, never Out.
- **Attendance rolls**: a default out time never runs past midnight (0 h, flagged); a present mark over 16 h is amber; a PM heading over the
  area sections with no 8:30 heading is the 8:30 shift, flagged; "EXTRA 5 PM TO 6 AM" is a span, asked, never hours. People → Attendance → Day → **Read the
  rolls again** re-reads a day's saved rolls, replacing what the rolls wrote and keeping what was typed; the old day goes to the log
  (`how: 'reread'`). Delete this day takes its rolls with it, so they can be pasted again. A monthly payment dated by the 20th pays the month before.
- **Production**: a pick on a carried load is that load's alone and teaches nothing; a correction keeps what the hand form does not show;
  a bare floor code is a part code; register runs split at 8:30 AM and 5 PM; the line picked on the photo check drives the part rules; a
  power-back pasted later closes the stored cut (`closedBy`). Power's rates count only cuts on recorded days.
- **Performance** reads one client (`cpCurrentClientId`) in the render and every handler; Stats nets tax and total by credit notes like the
  taxable; a chart bar with no figure is a gap.
- **Screens**: Power → Cuts is one line a cut that opens to what its damage is made of, the newest month open and older ones folded (21.6 →
  about 3 phone screens); Performance folds Materials worked and By the hour (9.7 → 4.5 on the real book); P/H/A on the Day board are whole
  44px buttons again (`.inv-row-end > .inv-seg`; the board had left `inv-row-fields`, now deleted); Production's tonnage tile shows the pieces
  when under 90% are weighed; Home's widgets are `home-w` containers, so a tile strip never leaves a blank cell.

**The QA chain of 2 Oct 2026** (owner: *"Run QA chain and Merge when ready"*). Six audits of what was built on 1–2 Oct and not yet
audited (about 80 findings: step 7's screens and the shell, search and Add, the guard, quotations, reports and What to do, attendance),
the mechanical sweeps and a harness pressing every action, then one builder per area with its spec (P149 attendance, P150 quotations,
reports and What to do, P151 search, Add, Pipeline and Floor → Day, P152 the guard) and the lead's (P153). Each spec fails on the build
before it. The detail is in each area's section; what it leaves as rules:
- **Replacing the book is the owner's**, and keeps this book's IDs unless the owner says; **wrong PINs count per ID**; one's own PIN
  is changed with the PIN it has; an invoice's state, Finance's edits and an area's complement are P1; nothing a role decides is drawn
  while nobody is signed in; every list, count and move shows a role only what its screens show (The guard).
- **An override prices a line only in its own unit**, and the matcher says *Another unit* (The rate on record). A posted quotation
  rate is written only where it can price the client's lines, before the broader patterns (Quotations).
- **One split places overtime** for Labour, the Areas card and Hours by area; **a hand's OT slot is its own pick** (`rec.slotHand`),
  kept apart from the EXTRA rows; a field typed in on People → Attendance → Day is drawn around, never replaced (Labour and attendance).
- **A list-and-pane screen keeps its scroll on a redraw**, and an event's key in History survives a rename (UX overhaul 2, step 7).
- A swipe is a step of the trail; Home opened from elsewhere is drawn (Pulse, until UI pass 3); a window crossing 1024px keeps the leave guard; Cancel,
  Delete and Edit from History's pane act where they can be seen; an address naming no record opens no pane.

**The QA chain of 14 Oct 2026** (owner: *"Be thorough, run QA chain before final merge, merge once CI is green"*). Seven audits of the
tab map (TM1–TM7) and the asks of 10 Oct, then one builder per area, each finding fixed with its test and each test failing on the
build before (P211 the shell, Today and Stats; P212 Money, the cheques and the suppliers; P213 People and Pay; P214 Production, Power
and the plant register; P215 Office and the flow thread; P216 the entry faces, Knowledge and History; 116 tests); the mechanical
sweeps (no duplicate name; the dead code each builder found went, `calculateStdWeights` with it) and the harness pressing every
action. The detail is in each area's section; what it leaves as rules:
- **One judge for the price against the live cost**: a loss within 5% of it is a warning wherever it is drawn (Home's widgets, Stats' cards,
  the report), as realisation always was; a figure over its mark is info (`inv-fig-info`).
- **Owed with nothing past 60 days is ok** wherever it is drawn, and owed is never red while a receipt has no client
  (`finAgeTone`, `figToneOwed`).
- **A door is drawn only for a role that opens where it goes** (Home's More, *Add a bill* on Power and Live cost, Add's grid laid
  out over the doors shown); **a margin is money**: By the hour's hour cost, Performance's cost and its flags' rupees only for a role
  that sees money.
- **A cheque**: *Not this deposit* keeps that row apart and the number goes on; a post-dated cheque is in hand from its own date;
  one recorded twice counts once. **A supplier** is every spelling, a sorted payee joins by it, two records fold at load.
- **An act is drawn once**: History lists a deleted invoice as its tombstone's row and counts each removal once; a quotation's
  events name their record. **What waits is its owner's**: a decision's review is the owner's, a proposed change its proposer's.

### The QA chain of 6 Nov 2026
`docs/UI_PASS_3.md` §26o (owner: *"Run the QA chain"*, over U3, U6, U7, U8 and U9's docs; U4 and U5 had their own). Castor, Iuno and
Vulcanus audited, each finding fixed with its test in P259 (failing on the build before), then Cipher. What it leaves as rules:
- **The four-digit screen is never left open**: hidden or left, it closes, and after two minutes (`GRD_UPGRADE_MS`) Save and Later
  redraw the lock (`grdUpgradeLive`). Enter on the lock does what Sign in does; fewer than four digits for an ID on four spend no try.
  A PIN from before that is four good digits signs in and is saved `len: 4`.
- **A PIN of four digits can be found from any copy of the book** (10,000 tries offline): Settings says so, and whether the owner's
  ID may keep a longer one is the owner's to rule.
- **Wages are wages wherever money is shown**: an ID that sees money and not wages sees no labour tier on the live cost, no labour or
  payout on a report, and a report drawn with wages needs them to open from the queue (`printNeed({wages})`).
- **What the period left is one figure** (`statsPeriodLeft`: the period's revenue less the full cost), toned by the one judge
  (`statsLeftTone`), on Stats' verdict, the money question (its sentence too) and the report. At the live cost it is exact; at the
  typed cost with lines unweighed it is a bound (`≤`, *N% weighed*, a figure at or over zero not judged). Top parts judges a price as By part does; a part
  billed nothing has no price; a month under 90% weighed has no chip (*N% weighed*).
- **A gap is a gap on paper too**: a stretch with no invoice, a line with nothing weighed, a month with neither a cut nor a day
  recorded. The power record lists every calendar month from the first cut; Cuts folds only months with cuts. The picture's foot
  names the credit notes it cannot take off.
- **Half a line down is danger on Equipment as on Floor** (`pltCapTone`), a line's own units only; supporting equipment is danger
  with nothing working. A first-visit pointer goes when typing starts, and its
  Escape shuts it alone.
