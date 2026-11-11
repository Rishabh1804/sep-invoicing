---
subject: "Stock: on paper, entries checked, messages, by line, reorder"
domain: floor
modules: [split/stocksheet.js]
specs: [docs/PLANT_PICTURE.md]
tests: [P97, P156, P192, P220]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Stock on paper
Stock → **Print sheets** (`stocksheet.js`; owner, 29 Sep 2026: *"the same for Stock as that has enter by hand option as
well. Plus, we need physical copy for record keeping"*), for a day picked in the dialog (today first), on the attendance
sheets' page styles, each page one A4 sheet (P97):
- **The supervisor's sheet** is his WhatsApp stock message on paper: *From / To*, then one row per line **numbered as his
  last message numbered it** (`lastPos`; a line never in a message follows on, then three spare numbers), with Opening,
  Added (date · qty), Used (days × a day = total), Available and a note. **The names are printed** (they are the shop's
  chemicals, not people), and a fixed number beside each settles the line his message sometimes sends with no name.
- **Deepak's sheet** is Enter by hand on paper, the four kinds as columns: the **app's level at the start of the day**
  (`stockReplay(id, day)`, so a count is checked on the spot), Count, Received and its ₹ per unit, Used, Charged (into),
  the delivery bill (company, invoice no., date, lines), and *Filled by the supervisor · Checked by Deepak · Entered in the
  app by / on*.
- **The filled copy** carries every entry the app holds for the day, pasted or by hand (a voided one never reaches paper),
  two on one line joined with +, the bills grouped by invoice, and the **level after** the day.
- **An earlier day with stock recorded prints the supervisor's sheet filled, as a worked example** (`stockSheetFillFor`):
  the window his message covered, and per line the opening, what was added, the use as *days × a day = total*, and what
  was available after.

### Stock entries checked before believed
Stock → **To check** (`stockEntryChecks`, `stockRereadDiff` in stock.js; intelligence step I1, 6 Oct 2026; P156). An entry
that does not fit the record is said on its line, on the check and as one To-do task (`stockCheck`): the same quantity from
the other door within 4 days (`twice`), a use typed by hand for days a pasted message covers (`overlap`, `typed`), a use past
zero (`below`), over 4× the usual a day (`large`; a bath line is charged in lumps and not judged), a count 30% off the level
(`count`). Warn, never block: **It is right** keeps it (`checkOk`). **A saved message is read again with the reader as it is
now**, and one read differently is listed with both readings; *Use the new reading* voids what the old reading saved and adds
the new entries at the message's own time (`reread` on the entries and the paste). A figure voided by hand stays voided, a line
the new reading cannot place keeps its entries, and entries typed by hand are never touched. A use and a charge compare alike.

### Stock messages of October 2026
Owner, 15 Oct 2026 (*"Same for stock messages like these"*; P220):
- **A line opening on two figures is named by the first**: "106 70 KG USE V A 1 30 KG +V A 2 20 KG= 50 KG 70-50=20 KG" is 106 at 70,
  30 into VAT A1 and 20 into VAT A2, 20 left. **A name that is the start of one line's name is that line** (`stockFindByLead`: "106" is
  106 Salt), said amber and learnt as a spelling on save.
- **A "+" before a bath or a time of day joins a use's parts**, and **"= n" after the parts is their total**, never the balance.
- **A time of day before USE is the use's**, not the name's: "BRIGHTNER NIGHT USE 2 LTR +MORNING USE 2 LTR +DAY USE 3+2=TOTAL 9 LTR USE
  83-9=74" is 9 used, once ("= TOTAL" is "="; an opening less a use already stated does not add it again).
- **"17-3-14" is "17 − 3 = 14"** where the first minus leaves the last figure and nothing follows, said amber (`typo`).
- **A delivery** ("14/10/26/ <supplier> TO SOMA HCL 600 LTR / NITRIC ACID 30 LTR", `stockParseDelivery`, `STOCK_DELIVERY_RE`): a stock message
  to the paste box (`relayKind`), every figure received on its day from the words before "TO SOMA" (`supplier` on the entry); a figure with
  no name takes the first of two words before TO SOMA ("HCL <supplier> TO SOMA / 660 LTR"), else is asked. Its lines set no line's number.
- **A use told by time of day with no "+"** ("USE NIGHT 2 KG DAY 2 KG =4", "USE MORNING 2 LTR DAY 3LTR =5"; owner, 16 Oct 2026): a time of
  day between two figures inside a use starts the next part, so the parts add to the total written; the last part alone had been the use
  and the total a red footing error. **"ADD 5 … =4) 5-4=1"**: the figure the use is taken from is the shelf with the delivery in, so the
  opening was before it (here 0), said amber (`withadd`); it read as an opening of 5 beside a delivery of 5. **ACD is ACID** (`STOCK_SPELLINGS`).
- **One delivery told twice is counted once**: a received figure the same as one on record for the line within four days (the delivery The stock message's opening was before that delivery: on its day or after it, the opening is the shelf with it in (22 + 30 = 52), so the evening's count and the delivery do not read against each other.
  message, then the stock message's "ADD 30+22") is said (`received-twice`) and not added again; a message read again ignores its own.

### Stock by line
PP3 of `docs/PLANT_PICTURE.md` (owner, 9 Oct 2026: *"Exactly"*, to the app reading the bath a stock message names; P192).
- **The reader** (`parseStockLine`): a use is read bath by bath. A bath named stands for the figures after it until another is
  named, a date for the figure after it, and a bath or date just before "use" is that use's. *"use VAT A 2 / 25/09/26/ 150 kg VAT 1
  / 28/09/26/ 175 kg berral use 75 kg"* is three uses, each on its day (the barrel's over the message's days), where it was one
  400 kg entry with the baths in its note. *"berral & vat a1. 51 kg"* is one use the two share. *"use A 2"* is VAT A2, never A Salt.
  Baths whose figures miss the use stay one use, amber (`baths`). Each entry carries its baths as **`lines`** and its own words as
  its note (one part keeps the line's note). A use by hand takes its bath from **Into** (`stockBathsIn`). `stockEntryLines(e)` reads
  `lines`, else the baths the note names, so an older entry still has its bath.
- **Read again**: the re-read key holds the entry's baths (`stockRereadKey`), so a message the reader now splits, or now puts in a
  bath, is listed on Stock → To check with both readings; one whose note already named its one bath is not.
- **By line** (`stockByLine`, cost.js): each addition into a bath is set against what its line plated (Production's weighing) until
  the next of the same stock line went into the same bath. The last is still in the bath: *so far*, kept out of the line's figure
  unless it is the only one. Days with no production record are filled at the recorded days' pace (≈); under half recorded, nothing
  is set. A use naming two baths is shared by what each plated over its days, or evenly where one is not recorded on half of them. A
  use naming none is the plant's, counted apart. Rupees at the price paid by the day (`stockPriceAt`). Worked out each time.
- **Shown** (drawn as an analysis, §6.27): a stock line's page (*By line, 60 days*: a row a line, its kg/t at the end, its ₹/kg and
  additions under it, folding open to each addition), Production → Lines (*Into the bath*: a row a stock line, *All of it* in ₹/kg for
  a role that sees money, *No bath named*), and Floor's line card (the day's additions).
- **On the owner's book of 9 Oct**, once the two messages that read differently are taken (*Use the new reading*): VAT A1's zinc
  ≈ 5.3 kg a tonne, ₹2.40 a kg plated (the cost model's 425 kg a month over ~80 t is 5.3 too); its 106 Salt ≈ 1.8 kg a tonne; VAT A2
  on its first top-up of each, so far only; the barrel recorded on 1 of 12 days, not set. Most chemical uses name no bath yet.
- **Data flow**: an entry's `lines` travels in the `sep-stock` export to soma-internal, which reads the stock record.

### Stock reorder list
Floor → Stock → More → **Reorder list** (owner, 25 Sep 2026). For each line with a daily use:
**use × (lead time + days to cover) − on hand**, rounded up to the **pack it is bought in** (the smallest
purchase, when every purchase is a whole number of it), priced at the **last price paid** and grouped by
the **supplier it is ordered from**: the one it last came from, or a cheaper one that can deliver in time, by its own lead time,
or the one the owner picked on **Compare suppliers**, under each line (*Suppliers*, above). Cover (30) and the lead time where a supplier's is not set (10) are set on the list and kept on the
device's book (`S.stockCheck.leadDays/coverDays`). A rate from under three days of record is flagged
*check*. Typed quantities win and 0 leaves a line out. Lines with no use yet are listed apart. **Copy as
message** gives a WhatsApp-ready order by supplier. Nothing is ordered from the app. The cash it needs, with GST, is each line at its
supplier's own GST (`withGst`), on the list, Stock's verdict and Floor's Stock card.
