---
subject: "Finance, and bills and notes"
domain: money
modules: [split/bills.js, split/finance.js]
specs: []
tests: []
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Finance
**Money**, a door on the bar and the rail (`finance.js`; owner, 26 Sep 2026: *"The entire finance
sector of our app needs a dashboard"* — a page of its own, leading with cash, what is owed, where money went and GST).
Bank and Bills & notes lived under Stock, where they never belonged; they are tabs here: **Overview · Receivables ·
Payments · Bank · GST** (the tab map, TM3a, 10 Oct 2026: the bills went to Payments and the credit notes to Office → Invoices; an
address or a saved step naming `bills` opens Payments). The open tab is remembered on the device (`sep_inv_fin_tab`).

- **Overview**, whole rupees at a glance (every tab behind it keeps the paise, and a figure's title carries them), an
  overview in one look (the tab map, TM3c): four heroes, one a subject, each folding to its line on the phone, then the charts
  below, each a fold shut on the phone:
  - **Cash** carries the verdict: the **bank balance** with the day it is from (amber once the statement is over a week
    old, red when overdrawn), the forecast's lowest point within 60 days as its title, the cheques in hand added
    (*+ ₹X in cheques in hand*);
  - **Owed to us**: the sum over 90 or 60 days as its title, the age bar (0–30 · 31–60 · 61–90 · over 90 days, from
    the invoice date) and the five largest debtors, each opening Receivables with its client expanded; never red while
    a receipt is unplaced (the age bar's over-90 band, `finAgeTone`, and an invoice's own *Open, N days* included), ok with
    nothing past 60 days (here, on Home's Money widget and the cash question's, and on Pipeline's stage), and receipts with no client are
    said, not counted;
  - **GST** for last month, toned by its status;
  - **Paid out** last month, where most of it went (SELF draws as *Wages (cash)*), and what came in.
- **The Overview is interactive** (spec Phase 3; owner: *"more like financial dashboard with interactive pie
  charts, line charts, trends chart"*). One range chip row (`3M · 6M · FY · All`, kept per device as
  `sep_inv_fin_range`) drives every panel. **Cash**: balance, in and out on one axis, with the balance line
  crossing a zero rule when overdrawn; a tap on a month moves *where money went* to it. **Where money went**: the
  range stacked by category, and the chosen month as a pie — a slice lists that category's payments with exact
  figures and opens the statement filtered to it; a category keeps one colour in both. **Where money came from**:
  receipts by client, with unplaced receipts a named slice that opens them. **Invoiced against received**: two lines
  (a month the statement does not cover shows no received figure, not zero). **GST**: due against paid, grouped,
  above the table; the month's status is itself the button that opens its note. Every chart takes a tap and writes
  the exact figure into its readout line.
- **GST due** is the output tax on the month's invoices (active, by invoice date) less the tax on its credit notes
  (not cancelled, by note date). **Paid** is the GST the statement sent the month after, since a return is paid by the
  20th of the next month. Cash paid is output tax *less input credit*, so paying less than is due is the normal
  shape; the tab says so and never calls the gap a shortfall. The GST tab reads twelve months.
- With no statement the Overview says what reads from it and still shows GST due, which reads from the invoices.
- The To-do's missing electricity bill opens Money → Payments with the bill form on the month (`todoGo` kind `bills`).
- **Cheques are placed, and tagged by their series** (owner, 26 Sep 2026: *"make sure we have a field to enter the
  client so that what the client owes starts coming down to the actual figure. Also tag cheque numbers to clients —
  their series will help in automation"*). The Overview's *"N receipts not placed"* is a link to them, and the
  Receivables tab carries the count. A deposit's instrument is in the narration (`BY INST 525428`, `bankInstrument`).
  **Placing a deposit is its tag** — no second store: `bankChequeSeries()` reads each client's numbers off its
  placements and lists them on the client (*Cheques: …*). A new deposit is **offered** to a client when exactly one
  client holds a number from the same book (same length, all but the last three digits alike) within 50 of it; when
  the series and the exact-sum match agree they are one offer (*Series and amount agree*), when they disagree both
  are shown and nothing is placed (`bankPlacementOffers`). Each offer is a line of its own with its button at the
  row's end — inside the one-line meta it was clipped by the ellipsis on a phone and could not be tapped. A placed
  receipt is moved or unplaced with *Change* on the client's list; *No client* is a decision, stored as
  `clientId: null`, not a fallback to the guess.
- **A month's GST paid outside the bank** (owner: *"For July, make sure that reason is mentioned or has a place where
  we can mention it"*). Money → GST → *Add note* on any month the bank shows no payment for: what happened
  (required), and optionally the amount paid another way, the date and the route (`S.bank.gstNotes[YYYY-MM]`,
  exported in `sep-bank`). An amount counts as paid and reads **Outside bank** (info, never ok — the app cannot see
  it); a note alone reads **Noted**. The tile follows. Nothing is seeded: July's note is the owner's to write.

### Bills & notes
The bills are Money → **Payments**' (`#billsPower`, with or without a statement), the credit notes Office → Invoices →
**Credit notes** (a dialog; the tab map, TM3a, 10 Oct 2026). `bills.js` keeps both forms. They had been a Finance tab of their
own, *Bills & notes* (moved from Stock 26 Sep 2026; owner, 26 Sep 2026: *"We don't have a place to enter electricity
bills anywhere in the app. And even credit notes"*). The bill form existed, labelled *Power*, at the foot of
Stats → Cost → Live cost; nobody found it. Credit notes could only be raised from a Register selection as a
batch rebate.

- **Electricity** (the `power` kind is labelled *Electricity* everywhere now). Every closed month with invoices
  and no electricity bill is listed with an **Add** that opens the form on that month (`billsMissingPower()`), and the
  bank's payment for that month under it with *Add as bill*. Live cost's *Add a bill* opens the same form on Payments
  (`costBillFormHtml`, `_costBillOpen = {where: 'finance', month}`, `invCostBillGo`), drawn only for a role that opens Money, on Power's
  Load & bills too. A bill typed on Payments is a Finance edit (`bankGate`), as one made from a bank payment is.
  To-do rule **`power`**: from the 10th, last month without a bill; amber from the 20th, `sig` the month.
- **A second electricity bill in a month is arrears and a penalty** (owner, 30 Sep 2026: it *"only happens when a bit or all of
  a couple months ago was not paid in time, so it might include a penalty"*). A bill records the **arrears** in it (and the month
  they are for) and the **penalty or extra charge** in it, both parts of its amount. The arrears were that month's cost on its
  own bill, so a bill's cost is its amount less its arrears (`costBillCost`); the penalty stays in and is named on the bill and
  in Live cost. A second bill with no arrears entered asks first, never refuses. The owner mentioned paying about ₹5,000 a month
  since the load went to 50 while the bill still reads 25, **read off a bill** (owner, 13 Oct 2026, who will enter the
  figures where available): that charge is entered as the penalty or extra charge.
- **Credit notes, two doors**, in the head of Invoices → Credit notes, the form drawn in the dialog's body (a save or a cancel
  redraws it with the Register's badge and CN marks, `cnRegisterRefresh`). *Record an issued note* takes a note that already exists on paper, with its **own
  number** (refused if the series holds it) and **the GST as printed**: recomputing is not the same thing, and
  CN/004's 3,749.29 at 9% + 9% rounds each half to 337.44 = ₹4,424.17 where the customer holds ₹4,424.16. The
  fields start at the computed figure. `recorded: true`; `cnNextNum` moves past it **only within its own financial
  year's series** (`cnSeriesHighest()`, read off each note's display number): a note recorded from 25-26 holds no
  number in 26-27's, and a typed invoice takes the client master's address. *New note* issues the next
  number against **one invoice** for a reason from a **fixed list** (`CN_REASONS`: rate correction, goods returned,
  short quantity, discount, other); **Other needs a description**. The batch rebate is not offered there: it is
  raised off a Register selection, as before.
- **`kind`: `rebate` | `adjustment`** (absent = rebate, every note before this). An adjustment or a recorded note
  prints no batch annex (a Register batch note keeps it, a one-invoice batch included, so a reprint matches the
  customer's copy), reads as its reason in the Register's list, and offers no *Reference* re-pick — *Clear* would
  erase the number printed on a recorded note. An adjustment is not a rebate to the To-do's batch rule (`cnIsRebate`). Stats nets both by `periodTo` (the invoice
  date for an adjustment). A note with no quantity prints blank qty and rate cells; the CDNR CSV leaves a blank
  `discountPct` / `batchTaxable` blank.
- **This is the door for the control gap above**: CN/004 and CN/005 can now be entered as issued, not re-raised.
- **A stock line's name and unit are edited on its page.** A rename keeps the old spelling as an alias, so a
  message in the old name still finds the line; a unit change on a line with entries asks first and converts
  nothing.
