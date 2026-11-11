---
subject: "Suppliers"
domain: money
modules: [split/suppliers.js]
specs: []
tests: [P208, P209]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Suppliers
Money → Payments → **Suppliers** (`suppliers.js`; owner, 10 Oct 2026, of one supplier: *"Balance payment remaining from us to <it>, no
way to record this in the app"*; of the lead times: none for three, *"3-4 working days … if ordered through <another>, they offer a
cheaper price but the material comes from Kolkata"*). P208. Nothing about a supplier is in the build.
- **A supplier is every spelling that names it** (`suppIndex`): the company on a stock bill, and a payee set to Supplier on the
  statement, compared folded (`suppKey`: "&" is AND, BROS is BROTHERS, PVT and LTD in full), so a bill's "<A> & Brothers" is the
  statement's "<A> AND BROTHERS"; the bank's own guess reads the same keys (`bankSupplierKeys`), folding the payee as well
  (`bankMatchSupplier` tries `suppKey(party)`). What the owner sets on one is its
  record (`S.suppliers`: name, other spellings, lead time, GST, the balance on a day, a note); a rename keeps the old name as a
  spelling; a spelling the book only names (a bill's company or a payee sorted as Supplier, nothing set on it) can be given to a
  supplier in *Also written* or by a rename, which is how a sorted payee joins it; one a record holds is refused. Two records of one
  supplier (two devices that met in the merge) fold into the first at load (`suppFoldTwins`). **A payee whose initials are a supplier's short name** is offered on Payments → Not yet sorted (*May be <short name>: its
  initials*, **Same supplier**), never taken unseen.
- **A bill** is the stock entries of one invoice (company, number, date): its lines before GST with the supplier's GST (18% until
  set), rounded to the rupee as the paper is, unless its total is set as printed (`rec.totals`). A delivery and its own bill typed
  again count once. **One number on two days is flagged**: one of them may be typed wrong.
- **A payment** is a debit on the statement read as theirs, or one recorded here (`S.supplierPays`: cash, a cheque handed over, a
  transfer; voided with a reason, never deleted). A cheque recorded here is the statement's row of its number once it clears (else of
  the same amount within 45 days; a transfer within a week): one payment, dated the day it was handed over, the day the supplier's own
  book credits it.
- **The balance counts from what was owed at the end of a day**, typed off their statement (`rec.opening`): the bills after it, less
  the payments after it (`suppLedger`). A statement payment in the 30 days after that day which their figure already counts is marked
  **In their balance** (`rec.inOpening`); set again on the same day the marks stay, a new day drops them. With none set nothing is said to be owed (unknown is not nothing), and the bills and
  payments are still listed. What is unpaid is read oldest first (`L.open`).
- **On screen**: Payments' verdict has an *Owed to suppliers* tile; the Suppliers fold a row a supplier (what is owed and since when,
  its lead time), which opens its dialog: the figures, the bills and payments the latest first with the balance after each (those
  before the balance's day folded), Set the balance, Record a payment, Change. Stock → Spend and prices names the supplier tapped,
  its lead time and what is owed. Money edits behind the payments permission (`bankGate`); a role without money sees no figure owed.
- **The reorder list weighs a lead time against the days left** (`suppReorderPick`): a line is ordered from the supplier it last came
  from, unless another sold it cheaper within six months and can deliver before the line runs out (*₹13.90 a unit less than …, 3–4
  working days*, with the day to order by); when the one it came from cannot make it, the fastest that can, and what the hurry costs
  a unit. A supplier with no lead time set is named, never chosen; zinc follows the market, so its last supplier stands. The quantity
  covers that supplier's lead time (the list's own where none is set). The line's To-do task says who to order from and by when.
  The owner's pick (below) wins over it.
- **Compare suppliers** (owner, 10 Oct 2026: *"When ordering stocks let's have an option to select and compare between suppliers,
  pros and cons. Right now, we don't have that option while ordering or planning for stock"*; P209). From the reorder list (under
  each line) and a line's page (*Order from*), every supplier of the line as a card (`suppCompare`, a deck in a dialog): its price a
  unit and what it rests on (its last bill on the line, or a price quoted since), its lead time against the days the line has left
  (the day to order by, or *the line runs out in 2 days*), what this order comes to, what is owed to it (to a role that sees money),
  and what speaks for and against it in words, each a dot: cheapest by so much, so much more on this order, comes in time or
  cannot, the same day, bought from most, one bill, up or down on their bill before, a price over six months old (a quote over
  three) said and never weighed, no lead time set, owed past a month. A card is coded by the worst of what is against it.
  - **Order from them** keeps the choice on the line (`item.orderFrom`: the supplier's id and name, so a record made later still
    finds it): the list, the line and its task follow it, the app's own pick said beside it where it differs (*Your pick; the app
    would order from <it>: ₹19.00 a unit less*); **Let the app pick** clears it. A choice whose supplier no longer sells the line
    is said, and the app picks until another is made.
  - **Add a price quoted** (`rec.quotes`, on the supplier's record; a supplier typed new is made one): weighed beside the bills for
    90 days, so a supplier that never sold the line is compared; removed with a word.
  - A card with no lead time opens its supplier on *Set its lead time*, over the comparison, which follows the change; the
    supplier's dialog closes on itself alone. The choice and the quotes are Floor entries (`grdGate('floor')`).
- **To-do `supplierOwed`** (info): a balance whose oldest unpaid part is over 30 days old. `supplierNoBill` reads through the
  suppliers, so a payment spelt the bank's way finds the bills spelt the shop's.
- **Measured on the owner's book** (10 Oct 2026, a scratch harness never committed): five suppliers; the "&"/AND fold makes two
  payments (₹71,435) one supplier's; the initials offer names ₹2,50,437 of payments to another; with the balance off one supplier's
  September page (₹33,877 after its bill of 9 Sep) the app owes ₹58,716, the 10 Oct delivery's bill added; a line out within a day
  is ordered from the same-day supplier at ₹55.20 a unit more, two others from the cheaper one with the day to order by; three bill
  numbers are each on two days.
