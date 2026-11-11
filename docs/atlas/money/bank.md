---
subject: "Bank and cheques received"
domain: money
modules: [split/bank.js, split/xls.js, split/xlsx.js]
specs: []
tests: [P57, P66, P82, P179, P187]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Bank
Money → **Receivables**, **Payments** and **Bank** (`bank.js`, moved from Stock 26 Sep 2026; owner, 26 Sep 2026: *"We have the bank statement as well right? There is no way
to read it in the app yet"* — all three of receipts, payments and the ledger, reading the bank's `.xls` as it is).

- **The file is read as the bank exports it.** Bank of Baroda's `OpTransactionHistoryUX5.xls` is real Excel 97–2003
  (BIFF8 in an OLE compound file), not HTML under another name, so `xls.js` reads it with no library. Checked
  cell for cell against `xlrd` on the real statement: **7,018 cells, 0 different.** Columns are found by their
  labels; the bank writes newest first and `dayIdx` keeps its order inside a day (soma-internal's 20-Aug ingest
  sorted by date alone and published a closing balance ₹1,20,000 wrong).
- **Or saved from Excel as .xlsx, and past the page's foot** (owner, 8 Oct 2026: *"When uploading the bank statement in xlsx
  format we get an error Row 50: page 2 cannot be read or not an excel file"*). A statement of two pages ends in the bank's foot:
  the time it was made under TRAN DATE (a date and time, as a number, which reads as a date) and *Page 2 of* under BALANCE,
  read as a transaction whose balance could not be read. A row with no amount and no balance is passed over; one with an
  amount whose balance cannot be read is still refused by its row. An .xlsx is read by `xlsx.js` (`xlsxRead`: the zip's
  directory, the browser's own `DecompressionStream('deflate-raw')`, `DOMParser`; shared strings, rich text, a formula's kept
  result), chosen by the file's bytes (`bankReadSheet`), from Finance's Import and Add → File (a zip holding
  `xl/workbook.xml`). On the owner's statement of 5 Sep – 6 Oct both files read as the same 34 rows, every balance following
  (checked, never committed); the specs read fake twins made by `tests/fixtures/make-bank-sep.py`. P179.
- **Rows merge by id** — a hash of the row's own fields, balance included — so an overlapping statement adds only
  what is new. **Every balance is checked against the row before it**; a break (rows missing between two
  statements) is reported with its date and the figure expected.
- **A category is worked out from the narration every time it is read**, then overridden: for a payee
  (`S.bank.parties`, keyed on the name) or for one row (`row.set`). **Every SELF / TO SELF / TO CASH draw is wages**
  (owner, 26 Sep 2026: *"All kind of Self should also count towards wages, unless stated otherwise"*), **and the owner's
  drawings** (owner, 6 Oct 2026: *"Personal drawings as well, through self"*): as cost, a pay week's cash is wages up to
  that week's payout and drawings past it (below, *What the bank paid, as cost*); a draw has
  no payee, so a draw set otherwise is set on its row. A salary transfer is matched to the roster by the relay's
  own name matcher (either side of a dash, a unique first name, the spelling folds); a folded match reads `?`, and
  a payee that reads like a firm (`TRADERS`, `LTD`, `NIGAM` …) is never a person. On the real statement: 42 of
  the salary legs matched, 6 before the relay matcher was used.
- **Receipts against invoices, from the later of the statement's first day and the book's first invoice**
  (`bankRecvFrom`). Per client: invoices − credit notes − receipts, plus what was owed on that day if set (a client
  reading *paid ahead* is almost always April money for March invoices, and the card says so). The statement used
  to set the start alone, and it reached back to January while the invoices start in April (owner, 28 Sep 2026:
  *"we are checking against clients from January while we only have invoice data from April, that is creating a
  mismatch"*): three months of receipts for invoices the app never held paid April's invoices early. A receipt
  before the start is not read, and an unplaced one does not count toward *not placed: reads high* (the list says
  how many it left out). **An opening is stored with its day** (`opening[id].date`); one set against another day
  (an older build's, against the statement's first) is not counted and the client asks for the new one (P82).
  **A receipt never pays an invoice raised after it** (owner, 28 Sep 2026: *"most of April payment is actually of
  March job work"*): oldest-first used to reach past the receipt's own day, so SSS Mehta's ₹2.99L of 13 Apr, three
  days into the book, paid invoices raised to the end of April and days to pay read short. What a receipt cannot
  place is **on account** (`onAccount`); it is carried forward to settle what is still open, oldest first
  (`credits`), so the open list and its ageing still add up to what is owed, and the invoice detail says
  *Settled from money on account* rather than naming a receipt dated before the invoice.
  **What each client owed at the start is offered** (`bankOpeningSuggest`, never applied until **Use**): the
  receipts that reached the bank before the client's first invoice in the book was 20 days old, since the fastest
  payer settles 15–20 days after the invoice and the rest monthly. A receipt before the client's first invoice
  counts whenever it came; one after it only for a client already billing when the book began (first invoice within
  45 days of the start), since a new client's first payment pays its first invoice. Measured on the real book, 20
  days is the one window that takes every such receipt (SSS Mehta ₹2,98,770 on 13 Apr, another client 18 Apr, HighCo 29 Apr,
  RG before its first invoice) and none that paid April (SSS Mehta's 5 May, day 20): 30 days took that one too, and
  the leftover-money floor only half of that client's. It is a floor: money owed then and never paid is in no receipt,
  so the row says to check it against the ledger. A used figure is stored `suggested: true`. A receipt equal **to the rupee** to one open invoice or a run of them is
  *Exact*; any other is set oldest first and says so. soma-internal's tolerant sweep hit every credit and proved
  nothing, so nothing looser is ever called a match.
- **A cheque deposit names nobody** (21 of the real statement's credits). Where its amount equals a run of one
  client's open invoices — and only one client's — that client is **offered**; placing it is a tap. Placed on
  the row, never remembered as a payee, because `BY INST` is not a name.
- **Payments.** An electricity payment defaults to the month before it and becomes that month's bill on a tap
  (`bankId` on the bill); Payments offers it under the missing month too. Transfers to a hand are set against
  the **payroll as paid** for the month before, per worker — the check that would have shown the crossed Behra
  legs of 14 Sep. Cash draws are set against the weekly payout by pay week. Suppliers are totalled beside the
  stock bills recorded from them.
- **Export Excel is a clean workbook** (owner, 26 Sep 2026: *"BANK Statement export should be a clean sorted excel
  file"*): `xlsx.js` writes a real `.xlsx` with no library — the parts zipped *stored*, so there is no deflate to
  carry. **Statement** is oldest first in the bank's own order inside a day, so the balance column reads down as
  the running balance; dates are Excel dates and amounts numbers, so it sorts, filters and sums; the header is
  frozen and filtered. **Summary** has the period, opening and closing balance, the balance check, and each
  category's rows, money in and money out, footing to the closing balance. Read back by `openpyxl` cleanly; P57
  unzips the download by hand, checks every part's CRC, and asserts the order, the date serials and the overdraft.
- **Bug search, 26 Sep 2026 (P66).** The review over the merged finance code found these, now pinned:
  - **A cheque deposit is never a payee.** Every one reads *Cheque deposited*, and one save had written a rule
    placing all of them on one client.
  - **The edit form's client picker waits for Save.** It had placed the receipt the moment it changed.
  - **A receipt rule covers money in only.** A refund to the same party stays a payment.
  - ***Nobody on the roster* clears a guessed hand.**
  - **Exact matching only uses invoices raised by the day the receipt came in.**
  - **An invoice dated ahead of today is not over 90 days.**
  - **A month the statement never reached reads *No statement*,** not *Not in bank*.
- **A returned cheque is linked to the deposit it undoes** (`bankLinkBounces`, owner: *"work on the open item"*):
  - **By cheque number, automatically.** A debit naming a deposit's cheque number, within 60 days after it.
  - **By amount, offered only.** A same-amount deposit in the 15 days before is offered with **Link**, never applied.
  - **Posting-and-reversal pairs cancel.** A debit and credit of one amount and narration on one day cancel and
    link to nothing: the real statement's only `REJECT` rows are such pairs, for the shop's own cheque 001290.
  - **The owner's choice wins** (`S.bank.bounces`: a deposit id, or `null` for *not a bounce*), and is exported in
    `sep-bank`.
  - **A linked deposit stops being a receipt.** Every reading of receipts sees the client unpaid again, and its
    cheque still counts in the client's series.
  - Money → Receivables → **Returned cheques** lists each one. To-do rule `bankBounce` asks until each is linked or
    marked.
- **Owned by soma-internal**, like stock: *Export JSON* writes `sep-bank` JSON (rows with their resolved category,
  payee rules, openings). The statement is never committed here; the specs read two fake statements in the
  bank's layout, `tests/fixtures/bank-*.xls`.

### Cheques received
Money → Receivables → **Cheque received**, and Add → By hand → **Cheque** (`bank.js`; the tab map, TM3b; owner, 9 Oct 2026: a cheque
in hand counted as paid). A cheque handed over is money the client has paid, and until it reached the bank the statement could not
say so: what the client owed read high for days. P187.
- **The record** (`S.bank.cheques`: client, amount, number, the cheque's date, the bank it is drawn on, the day it came, a note; who
  and when). One form (`bankChequeFormOpen`): the client, amount, number (digits) and the day it came are required, never a day after
  today; the same client and number twice is refused, and a record of it made on another device, or a file's copy under another id,
  reads *Recorded twice* and counts nothing (`status: 'twin'`). A Finance edit (`bankGate`). In the change log (*cheque received*) and the merge.
- **Counted as paid from the day it came**: `bankReceivables` takes each cheque in hand as a receipt on its day (`pending`), placed by a
  receipt's own rules (exact to the rupee, else oldest first, never an invoice raised after it). Owed, the ageing, days to pay, the
  statement of account (*Cheque 525428 received, not yet in the bank*), Pipeline, a client's Money panel, the invoice detail (*Cheque in
  hand*), Home's widgets and the finance rules follow with nothing else changed. It is never offered as an opening. A cheque received before
  receivables start (`bankRecvFrom`) is not read, as no receipt from before it is.
- **Its deposit is found by its number** (`bankChequeLinks`, worked out on every read): a credit whose instrument number is the
  cheque's, from three days before it came to 60 after the day it can go in (its own date where it is post-dated,
  `bankChequeDue`), else the latest credit naming it in the 30 days before it was typed in (`BANK_CHQ_LATE`), **whatever its amount** (a different amount is said: *In the bank: ₹23,500.00*).
  From then the deposit counts and the cheque does not, so nothing counts twice, and the deposit is placed on the cheque's client
  unless it was placed by hand. A credit of the same amount with no number, not placed on another client, within 15 days, is
  **offered** (Link), never applied. The owner's choice wins: `deposit` a row; *Not this deposit* keeps that row apart (`notDeposits`) and the
  number goes on to the next credit naming it; *Match by number again* takes it back (an older build's `null` stops the number until
  then). A deposit returned is the bounce logic's, and the cheque reads Returned. A statement of one row places its cheque's deposit
  too (a bounce needs two rows, a deposit one).
- **Void** with a reason, never deleted: what the client owes goes back up (a second record of the cheque: owed is unchanged, and it
  says so).
- **On screen**: Receivables' *Cheques received* (`#bankCheques`), its head *2 cheques in hand · ₹X · the oldest 5 days* in the held
  task's tone; a cheque opens a dialog with its facts and *Not this deposit*, *Unlink*, *Match by number again* and *Void*; a post-dated cheque reads *Dated <day>*
  until then. Money's Cash hero adds *+ ₹X in
  cheques in hand*, and Receivables' verdict counts them. A cheque deposit on the statement and in search is named by its number
  (*Deposit of cheque 525428*, `bankRowTitle`), so its line need not carry the number, and its row's edit says whose cheque it was.
- **To-do `chequeHeld`**: a cheque in hand 3 days past the day it can go in (a post-dated cheque's own date) is amber, 7 red, saying whether the statement reaches past the day it came (*not in
  the bank by …*) or not (*import the statement to check*); three or more fold into one (*Deposit 3 cheques, ₹X*). It opens the cheque.
- **The `sep-bank` export carries `cheques`, and a `sep-bank` file through Add → File (or Bank's Import, which hands it over) merges
  them by id, never writing over, and keeps out one whose client and number a live cheque here holds; its statement rows are never
  read from it.** A data flow soma-internal reads.
