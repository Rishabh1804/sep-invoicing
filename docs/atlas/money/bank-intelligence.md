---
subject: "The bank as cost, statements of account, finance intelligence"
domain: money
modules: [split/finintel.js, split/finlinks.js, split/statement.js]
specs: [docs/FINANCE_INTELLIGENCE_SPEC.md]
tests: [P25, P75, P173]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### What the bank paid, as cost
Stats → Tables → Cost → **Live cost** (Stats → Cost until U3) reads the statement as a second instrument beside the app's own record
(`docs/FINANCE_INTELLIGENCE_SPEC.md`, Phase 4; `bankCostByMonth`, `bankCostForRange` in `bank.js`). Two routes to one
figure is the strongest evidence this repo has; this gives the live cost a second route.

- **Every payment is set against the month it PAYS FOR.** A transfer to a named hand pays the month before when dated by the 20th (one after the 20th pays its own month: Pay's rule,
  `payMonthPaidFor`, which `wageVsSlip` reads too), since
  salaries go out around the 14th for the month before. Cash pays the pay week it was drawn in, spread over that week's
  seven days, so a week that straddles two months is split. **Cash is wages only up to that week's payout** (`payWeek`:
  the weekly tiers and the EXTRA); past it, it is the owner's drawings, never a cost (owner, 6 Oct 2026). **Cash paid that week to a monthly hand, typed on
  Pay** and on no bank leg (`bankMonthlyCashIn`; owner, 7 Nov 2026: the night guard's wage paid in cash beside the payout), is
  wages too, for the month it pays (`payMonthPaidFor`), counted fixed; only the cash past both is drawings. A week whose
  payout is not fully recorded (no attendance, or hourly hands with no hours: the imported history) cannot be split,
  and its month's labour is not known from the bank (`labour.open`). Every SELF draw had been wages, and June–August read
  labour paid at ₹7.87L against ₹4.99L recorded. Electricity pays its bill month (`bankBillMonth`).
  Other costs and supplies pay the month they were paid in.
- **Not every payment is a cost.** GST, income tax and a returned cheque never are. A payment the owner ticks
  **Not an operating cost** on the statement (drawings, a loan, a transfer) is kept off too: `notCost` on the
  row or the payee rule.
- 🔴 **A payee the app only guessed as "other" is UNSORTED and counts as nothing.**
  - On the real statement that residue was ₹3.4–5.6L a month, and it was the zinc and chemical traders.
    Counted as other, it read the quarter at ₹12.66/kg, the opposite of the old error of reading a gap as zero.
  - So other costs and supplies speak for a month **only once nothing in it is unsorted**.
  - Money → Payments lists those payees under **Not yet sorted**. Each has a **Sort** button that opens its row
    on the statement, so each payee is set once.
- **The order, per component:**
  1. the app's own record, where it covers 90% or more;
  2. then the bank, where the statement covers the period (for labour: covers more of it than attendance does);
  3. then the model, for the rest.

  Electricity and other costs work month by month: a bill, else the bank's payment, else the model. The tag reads
  **paid, bank**. "Measured" counts bank-paid, since it is a record too.
- **A month is "known" only when the statement could have paid for it.**
  - Labour: the statement covers the whole month and the salary run up to the 20th of the next.
  - Electricity: a payment is attributed to the month.
  - Other costs and supplies: the statement covers the whole month and nothing in it is unsorted.

  Unknown is never zero.
- **Recorded against paid** sits under the live cost (`liveCostPaidCheck`). It compares only the months where both
  instruments exist, and flags a gap over 10%.
  - Chemicals and zinc compare use with purchases, which differ by design, so that row is never flagged.
  - On the real book, labour was recorded at ₹2.67L and paid ₹4.80L over June–July. That is the finding the check exists for.
- **Derive from the bank**: Settings → Costing → Live cost fallbacks (electricity, other costs) and Settings → Labour → Modelled
  labour.
  - It takes the six closed months the statement can speak for, and divides total paid by total tonnage.
  - Each month's arithmetic is shown.
  - Offered, never applied, the same as the zinc uplift.
  - On the real statement: electricity ₹0.80/kg against the ₹0.81 model; labour ₹3.46 against ₹3.55.

### Statement of account and payment reminders
Money → Receivables → a client → **Statement and reminder** (`statement.js`; owner, 7 Oct 2026: *"Start with 1 and 2"*, the first
being a statement of account and payment reminders). P173.
- **One arithmetic**: every figure is Receivables' own (`bankReceivables`): its start, opening, invoices, credit notes, the receipts
  placed on the client and what each paid, and the paise an exact match settled (*Settled to the rupee*). **The closing balance is what
  Receivables says is owed, to the paisa** (`soaCompute`), from any first day: what came before it is *Balance brought forward*.
- **The printed statement** (`soaDocHtml`) is on the quotation's paper (`.inv-qt-doc`, its frame and letterhead) with its own table
  (`inv-soa-*`): dated lines with a running balance (Dr / Cr), the open invoices aged 0–30 / 31–60 / 61–90 / over 90 days, where to
  pay (`S.bankDetails`), and the day the bank statement ends: a payment after it is not on it.
- **The reminder** is a message from the same figures (the total and the oldest eight open invoices), editable, sent on WhatsApp to the
  client's mobile (`soaWaNumber`: the first Indian mobile on the client, else WhatsApp opens to pick the chat) or copied. **A reminder sent
  is recorded** (`S.bank.reminders`: client, when, amount, how; in the change log, not in the `sep-bank` export), said in the client's
  fold on Receivables, beside *Statement and reminder* (its line since the tab map, TM3c), and on the over-90-days chase, which gains a move, *Send a reminder* (`advRemindMove`, jump `soa`).
- **Said before anything goes out**: a bank statement ending more than three days ago, receipts with no client, an opening not set or
  set against another day. Statements show money: a role that does not see money is refused.

### The statement as intelligence
Finance intelligence (`finintel.js`; spec Phase 5). The bank statement feeds the To-do and a forecast.

- **Fourteen To-do rules**, each switchable in Settings → Checks & alerts → To-do:
  - `bankStale`: the statement is 14 days old;
  - `bankLoose`: receipts still have no client a week on;
  - `owed90`: invoices past the client's payment terms, per client (45 days, the client's own where set; it read a
    fixed 90 days until the flow thread, T2). Never red while any receipt is unplaced, because that money may
    already be in; the task says so. With no statement it asks nothing, since every invoice would read open;
  - `payingSlower`: a client's last three receipts are 25% slower than its usual;
  - `gstNotInBank`: a month's GST has no payment and no note, and the statement reaches its due date;
  - `powerPaidNoBill`: one task naming the months;
  - `supplierNoBill`: no stock bill that month or the one before;
  - `supplierOwed`: a supplier's balance whose oldest unpaid part is over 30 days old (info; *Suppliers*, above);
  - `wageVsSlip`: a named salary leg against the payroll as paid of the month it pays for (`payMonthPaidFor`);
  - `cashSwing`: last week's cash drawn is a quarter or more short of its payout (past it is drawings, 6 Oct 2026);
  - `costGap`: recorded against paid over three closed months;
  - `runway`: the forecast goes below zero within 45 days;
  - `bankBounce`: a returned cheque is not linked to its deposit, or marked not a bounce;
  - `chequeHeld`: a cheque received is not yet in the bank, 3 days amber, 7 red (*Cheques received*, below).
- **Days to pay** (`bankDaysToPay`) is weighted by amount. Each receipt counts the days from each invoice it paid, and
  opening balances are left out. Receivables and the Overview's debtor rows show it as *pays in N d*.
- **Cash forecast, 60 days** (`finForecast`, Money → Overview): the latest balance, plus what is expected in, less
  what is expected out, with a P25–P75 band.
  - **In:** open invoices at the client's own days to pay, new billing at the last eight weeks' pace, and each cheque in
    hand on the next working day (a post-dated one on its date).
  - **Out:** salaries, cash by Saturday, electricity, GST by the 20th, and every other payment spread by day.
  - **Cash, not cost:** drawings and tax count.
  - An invoice long past its usual day is **not expected at all**: on the real book that is ₹11.8L of mostly
    already-paid invoices. Expecting it read the account at ₹15.9L in 30 days.
  - Everything it rests on is listed under the chart.

### Finance on every screen
Finance linked into every screen (`finlinks.js`; spec Phase 6). Each screen carries the finance fact that belongs to it,
as a link into Finance, never a second copy of the arithmetic. With no statement, each screen says nothing rather
than a zero.

- **Home → Money** (a widget): balance, owed, pays-in and runway tiles, each opening Finance, plus *Import statement*.
- **Stats:** *In one line* gets a Cash row. Contribution by client shows *owes · pays in* under each name.
- **Clients:** a *Money* panel on the detail, the edit sheet and Performance.
- **Register:** the detail says *Paid, exact* / *Paid, oldest first* with its receipt, *Cheque in hand*, or *Open, N days*.
- **People → Pay:** the bank's wage legs beside the payroll as paid, one function shared with Payments.
- **Stock:** what the bank paid each supplier. The reorder list sets its cost against the forecast's lowest point.
- **Money → Payments:** each section links to its home screen.
