---
subject: "The tab map: Money and Floor (TM3, TM4)"
domain: design
modules: [split/floor.js]
specs: [docs/TAB_MAP.md]
tests: [P186, P187, P188, P195, P197]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### The tab map: Money (TM3)
`docs/TAB_MAP.md` TM3 (10 Oct 2026, after the owner's look: *"Go ahead"*): Money's five screens in one look, the bills on Payments,
the credit notes in Invoices, and a cheque in hand counted as paid (*Cheques received*, under Bank). P186, P187; P195's budgets
lowered for Money's screens, and P197's `ONE_LOOK` takes them.
- **Money is Overview · Receivables · Payments · Bank · GST** (`FIN_TABS`). The bills are Payments' (*Bills & notes*, above); an
  address or a saved step naming `bills` opens Payments (`NAV_REDIRECTS`), the To-do's bill task opens the form on its month, and a
  saved task's *Bills & notes* reads *Add the bill* (`todoGoLabel`). Live cost keeps its bills' fold and loses its form: *Add a bill*
  opens Payments' (`invCostBillGo`); Power's link goes there too. The credit notes are Invoices → **Credit notes**, a dialog whose head
  carries **Record issued** and **New note** and whose body holds the form (`renderCreditNoteList`, `[data-cn-dialog]`).
- **The Overview leads with four heroes** (`inv-heroes-4`: two across on the phone and on a desktop under 80rem, four from it): Cash
  (carrying the verdict), Owed to us, GST and Paid out, each folding to its line on the phone; the six charts follow, each a fold shut
  on the phone. The tiles that led went into the heroes. Its links to the tabs are `invFinGo`, never the tab row's `invFinTab`.
- **Receivables, Payments, Bank and GST are work screens**, each led by its verdict card (`#bankRecvVerdict`, `#bankPayVerdict`,
  `#bankVerdict`, `#finGstVerdict`) and one toolbar under it:
  - **Receivables**: *Cheque received* in the toolbar; the returned cheques, the cheques received and the receipts with no client
    lead; a client's row has owed at its end in its age tone and two facts of meta, and opens to fact rows, then its invoices. How
    receipts are set is the bank guide's now (`kbguides.js` `bank`, version 2), with one line on the face.
  - **Payments**: *Add a bill* the one primary; the payees not sorted first, then the bills (a missing month one row with one Add,
    the bank's payment for it under it), then electricity paid, the wages, suppliers and other, each a fold.
  - **Bank**: the search, Filter (the category, a token once set) and More (Import a statement, Export Excel, Export JSON) in one
    toolbar; the statement, then the balance check (open when a balance breaks) and the imports, each a fold.
  - **GST**: on the phone a row a month with its due and paid stacked at its end, the latest six and the rest one tap away; the
    desktop keeps the table. What due and paid mean is the bank guide's.
- **What needs the owner shows its first few, the rest one tap away**, the verdict and the panel's head counting all: five receipts
  with no client, three payees not yet sorted, the latest three months with no electricity bill. The verdict, the toolbar and the
  cheques took that room on Receivables and the bills on Payments; given back, neither is longer than at TM2 (I10).
- **A statement line is two facts** (the day, and what it is); a cheque deposit is named by its number in its title (*Deposit of
  cheque 525428*), a payment's cheque number is in its narration when opened, and a line naming a client wraps whole.
- **Three toolbar budgets went from 0 to 1** (Receivables, Payments, Bank: the one row a work screen has), said to the owner (I10).
- Measured, phone screens (P195's long book, worst of eleven days; then the owner's book, in a scratch harness never in the repo):
  Overview 6.53 → 1.41 (owner's 6.88 → 1.39); Receivables 3.09 → 2.92 (2.39 → 2.22, chains 17 → 0); Payments 1.72 → 1.72
  (3.05 → 1.55); Bank 3.38 → 3.20 (3.56 → 3.31, chains 8 → 0); GST 1.11 → 1.10; Bills & notes gone.
- Fixtures: `openFoldAt(page, key)` opens a fold by its key, `bankImportDoor(page)` the statement's import wherever it is drawn.

### The tab map: Floor (TM4)
`docs/TAB_MAP.md` TM4 (10 Oct 2026): Floor is **Overview · People · Production · Stock · Power**, and the Overviews of People,
Production, Stock and Power are gone; every Floor screen leads with its verdict card, then one toolbar row. P188; P195's budgets
lowered for every Floor screen, P197's `ONE_LOOK` takes them, and the walk visits Attendance's Week and Month.
- **Floor → Overview** (`floor.js`; it was Floor → Day): the day stepper, then four heroes (five with the flow thread's *Turnaround*, T3), People (carrying the verdict:
  who is on site against the roster, `attOnSiteTone`, the lines short by name), Production (the day's card, led by the worst
  line), Stock (now: out and low, the reorder's cash with GST) and Power (the day's cuts, the month, a year at
  this rate, the load to chase), each shown to a role that opens its screen (the floor role sees People without its link,
  Production and Stock, no Power); then the line cards, **the worst first**; then *Not weighed*.
- **People is Attendance · Pay · Areas · Roster**; Attendance is a switch Day · Week · Month (`data-att-period`), its tab
  returning to the last of the three; the addresses are unchanged (`v=day`, `week`, `register/<month>`). Day's EXTRA rows are one
  line each until opened (`details[data-extra-row]`); Week leads with attendance by week (folded); Pay with its payout against
  the usual week, labour ₹/kg and the payroll against the bank folded; Pay's payment form folds on the phone (`#payFormFold`);
  Areas leads with the extra checked, its hours by area a table (`[data-area-hours]`); Roster's *To watch* is the To-do's `pplWatch`, and its card's *To watch* and *Check-ins due*
  show those hands alone (`invAttRosterFilter`; a check-in due is no badge on the row); the tier is the group, the area and the
  pay (the base rate with an overtime hour's) the row's two facts (`workerRateShort`), the hands who left under *Left*. A period in a toolbar row is `inv-tb-step`.
- **Production is Lines · In plant · Entries · Equipment** (`PROD_TABS`, default Lines). Paste message is the primary on Lines and
  Entries only; Equipment's is Add a unit; In plant has none. Entries shows thirty with only qualifying badges on the phone, its
  flags as the card's filter tiles; In plant folds each client; Equipment's units are deck cards, two across on the phone
  (`data-deck-sm`), the status changes folded (`plt-log`).
- **Stock is one screen** (`_stockView` `list`; no view tabs): the verdict (out, low, the reorder's cash; the status tiles its
  filtering factors), one toolbar row, *To check* a row, the lines grouped by status, **Spend and prices** (`stockSpendHtml`)
  folded at the foot on the phone and in the pane on the desktop (`invStockSpend`).
- **Power is Cuts · Causes · Load & bills · Case** (default Cuts), each its own toolbar: Cuts' *To look at* leads with the load
  approved and not billed (red), then the cuts to complete; a cut is two facts; the charts fold after the cuts. Causes' tiles are
  coloured only from three cuts (`uiVerdictFit` keeps a long cause in the card). Load & bills says each figure once. The case is
  paper fitted to the screen (`paperFit`, `#powerCaseSheet`).
- **The redirect rows** (§5): `pageStaff·overview`, `pageProduction·overview`, `pagePower·overview` → Floor's Overview;
  `pageProduction·overview/<paste|hand>` → that form on Lines (a `photo` address opens Lines since 13 Oct 2026); `pageStock·overview` → `list`. A remembered `overview` in
  `sep_inv_prod_tab` or `sep_inv_power_tab` opens the first view; a saved task with `tab: 'overview'` too.
- **Who sees a rupee is unchanged**: the reorder's cash, a cut's cost and In plant's book are every role's that opens their screen,
  on Floor's heroes as on the screens; only the bank's forecast waits on the money setting (the guard's audit, QA4-4).
- **The guides took the method** (`kbguides.js`): the floor (new), attendance (v2), the areas and the extra (new), pay (v2),
  production (v2), stock (v2), power cuts (v2).
- Measured, phone screens (P195's long book, worst of eleven days; then the owner's book, in a scratch harness never in the repo):
  Floor's Overview 2.22 → 2.43 (owner's 2.51 → 2.72: the four heroes above the line cards); Attendance · Day 2.73 → 2.07
  (4.08 → 3.42); Week 3.17 → 1.68 (4.36 → 2.56); Month 1.00 → 1.00 (4.57 → 3.15, chains 9 → 0); Pay 3.49 → 2.12 (4.49 → 3.14);
  Areas 2.86 → 1.79 (4.68 → 3.18, chains 19 → 0); Roster 2.27 → 2.27 (4.72 → 4.56); Lines 2.51 → 1.59 (3.39 → 2.32); In plant
  7.50 → 2.29 (6.69 → 1.74, chains 31 → 0); Entries 17.20 → 3.85 (28.52 → 3.81, chains 184 → 0); Equipment 1.72 → 1.50
  (3.74 → 2.72); Stock 1.26 → 1.07 (2.61 → 2.42); Cuts 2.21 → 2.20 (chains 61 → 1); Causes 2.82 → 1.56; Load & bills 1.00 →
  1.00 (1.93 → 1.14); Case 3.79 → 2.13 (4.38 → 2.41); the four page Overviews gone. Every toolbar is one row.
- Fixtures: `prodEntryAct(page, id, action)` finds an entry's action in its row, its fold or the pane.
