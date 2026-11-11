---
subject: "Workers and the plant"
domain: floor
modules: [split/checkin.js, split/idcard.js, split/people.js, split/plant.js, split/qr.js]
specs: [docs/WORKERS_AND_PLANT.md]
tests: [P166, P168, P170, P171, P248]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Workers and the plant
`docs/WORKERS_AND_PLANT.md` (owner, 7 Oct 2026), steps W1–W5. P166–P170. **Nothing about the shop is in the build**: the units, the
workers and every personal detail are the book's; the owner's private files (`sep-people`, `sep-plant`) are imported, never committed.
- **The plant register** (`plant.js`, `S.plant = {units, log}`): every tank, barrel and supporting machine on its station (the planner's
  ids), run · standby · repair · down, with a dated log of every change and a reason. **A line's units work side by side, each in kg a
  round** (owner): available = the kg a round of the units running or on standby over all of them (by count, and said, where no kg is
  typed); used is what the register measures a line plating a round (`prodTankLoad`, the register's own rounds; the planner's
  `plnBase().lines` for a line with none), *not measured* without either. Production →
  **Equipment**, a deck card a unit, two across on the phone (the tab map, TM4c; a strip per line until then), the status changes folded
  under them, Floor → Overview's line cards (*1 of 4 down*). The planner's machines are
  units now (`plnLive('machines')` reads them; moved once, ids kept). To-do `plantDown` (3 days amber, 7 red). Edits are the owner's.
  **What counts toward a line is one rule** (`pltPlates`; T-IO, 29 Oct 2026): a tank or a barrel at a line's station is one of its
  units, and stops its own line's share when it fails. Every other unit supports a line: a rectifier, or anything at a station that
  is not a line. It is listed under *Supporting equipment* with the line it serves (`pltLineOf`: the line set on it, else the line it
  stands at, else none), never counted in a line's units (`pltCapacity`, the tanks a round of `prodTankLoad`, Floor's cards, the
  planner). **Where a unit is, is one place** (`pltPlaceOf`, named one way by `pltPlaceWords`: *Other, for VAT A2*): a power cut tied
  to it lands there (the cut's words, the place the cut dialog stores, Power → Causes' places, the line's panel note); its task and
  its move ask to get that line running and judge it with the line's supporting equipment (`pltSupportCap`), never by a station
  that is no line (the task had read *Other: No unit recorded*); the Equipment card judges it there too, and the planner's
  machines name it so. An upgrade that fixes a station ends the risk of the tanks and barrels there, never a rectifier's. **The
  unit's form follows its station** until a kind or a line is picked (the app's `_auto` rule): a barrel at the Barrel station, a tank
  at another line's, *Other* elsewhere; **Line it serves**, beside Kind, the station's where that is a line, else none, and a unit
  that plates is offered none (it had opened at VAT A1 with kind Tank and line VAT A1, and a station changed moved neither). A
  `sep-plant` import keeps a unit's line and *Not coming back*, and gives a unit with no kind its station's. A pickling tank's
  failure in the planner's trials takes its share of pickling's kilos an hour, as Bring back adds it. P248.
  **The plant as found** (owner's register of 9 Oct 2026): a unit written in on the day the register was set up (`pltSetUpDay`, the
  first day of a unit's first line) stood before it, whatever its *since*, which is the day it was recorded; only a unit written in
  later counts from its own day (`pltRecordedOn`). The running units' *since* had read as the day they came, and every day before
  showed only the units backdated as down (*0 of 1 tanks working* on VAT A1).
- **Worker records** (`people.js`): typed by the owner (`w.profile`: designation, guardian, phone, address, date of birth, joining date,
  blood group, emergency contact, the last four of an ID and a bank account, languages, notes; `w.skills` 0–5 per area; `w.ties` up to
  three), and **worked out each time** over 90 days (`pplStats`): tenure, reliability (present on the days expected, late past 8:40,
  leaving early), consistency (how the in-time and the hours vary), workload (OT and Sundays in four weeks), days per area, who they work
  beside. **Firm from 14 days marked.** **The motivation index** (owner: *"instead of happiness index it becomes motivation index"*) is
  signals, each with its reason (pay owed, advances, OT climbing, a newer hand of the tier paid more, absences rising, no rise in a year),
  and the owner's monthly **check-in** (1–5, `S.peopleCheckins`) weighs half; not firm without a check-in in 60 days, and never red
  unless firm. **Personal details and motivation are the owner's alone**; the change log never compares a profile, a check-in's score or
  note. The roster row carries the area and the pay as its meta (the tier is its group), three bars (reliability, consistency,
  workload) and the top skills (P168); a badge only for a state (*Motivation 42*, *Inactive*). Its verdict's *To watch* and *Check-ins due* show those hands alone
  (TM4f: a check-in due on every row had marked 21 of 23). To-do `pplCheckin`, `pplWatch`.
  `sep-people` v1 through People → Roster → Import or Add → File: matched by name like a roll, each match checked before a field is written.
  **Skills and relationships each have a Change on their own panel** (owner: *"once I set the skill there is no way to change the skill
  level"*: the only door was *Details, skills and ties* at the foot of the record); a dialog opened on one part writes only that part.
  **Reports to can name the owner** (`{kind: 'reportsTo', owner: true}`, said as the owner's ID name, else *you (the owner)*).
- **ID cards** (`qr.js`, `idcard.js`): a card number given once and never reused (`w.card`, `SEP-0007`; a replaced card goes to
  `cardsRetired` with a reason and is refused), its QR `SEP1:W:<card>:<check>` drawn by the app's own encoder (no library, no network;
  checked by decoding with OpenCV). Printed ten to an A4 sheet, the owner's. **A number is given when the sheet is printed, never
  at preview** (owner, 7 Oct 2026: *"Previewing assigns ID number which holds"*): the preview shows the next numbers in turn
  (`_idcPending`), the print view's Print or the browser's own (`beforeprint`) gives them (`idcPrintCommit`), closing it gives none.
  **Two sides** (owner: *"too simple … doesn't carry the address of the plant and the back side should be safety and hazard
  guidelines for a Zinc plating plant"*): the front a band with the company, the plant's address and phone, the name, designation and
  area, the card, blood group, joining date and emergency phone, the QR and a signatory line; the back the safety rules (`IDC_RULES`,
  rewritten by the owner on the print dialog, `S.idcCfg.rules`) and *If found, return to* the plant. A sheet of backs follows each sheet of
  fronts, each row's two swapped, so a page printed on both sides flipped on the long edge puts every back behind its own front. **People → Attendance → Day → Scan cards**: the camera
  (`BarcodeDetector`) or the number typed; the day's earliest time is the in, its latest the out, two minutes apart or it is the same
  scan, the mark the hand's own (a roll never rewrites it), Undo on screen (`idcApply`).
- **The office QR** (`checkin.js`, `checkin.html`; owner: *"a universal QR Code … we would need safeguards for proxy"*, WhatsApp with
  checks chosen): the sheet links to `checkin.html` with the office number, the plant's place and radius, a key and the name in its
  fragment (never sent to a server, never in the repo). The worker's phone writes a check-in (card, time, place, a code from the key)
  and opens WhatsApp to the office; the chat pasted into the paste box opens a review where each check-in shows its checks: a live card,
  the code, the worker's own phone, inside the radius, sent as made, the shop's hours, one phone one worker a day. Red is left unticked.
  It cannot stop a faked location or a photographed sheet, and the setup says so. `checkin.html` is hand-written and not built.
- **The QA chain of 7 Oct 2026** (owner: *"run QA chain before the final merge"*). Four audits (plant, worker records, ID cards, the
  office QR), the mechanical sweeps, a harness pressing every new action on both layouts (130 presses, no error), each fix with its
  test in P171, which fails on the build before. What it leaves as rules:
  - **A scan or a check-in lands on the day of its own time** (`isoOf`, never `localDateStr`, which ignores its argument); a time
    before noon for a hand whose day before has only an in from 4 PM is that day's out, past midnight (+1440). A scan widens the
    day (a roll's 6 AM in is kept), and hours follow the Day screen's rule (`attTimesApply`).
  - **The plant tile is `inv-plt-unit`**: `inv-unit` is the label after a figure, and the tile had boxed every one. A unit's status
    before its first log line is what that line changed from; a status is never dated before its last change.
  - **A details file matches only on the whole name** (or a spelling kept on the worker); a first name is a guess, shown, never
    picked; one worker on two rows is refused. A role that does not see details exports without them, and the export says so.
  - **The office check-in's code covers the place and the phone's own card**; an edited message is red; no place, or a sender
    nobody knows, is left unticked; one phone, one worker a day across every paste. The limits are said as they are: the sender
    check proves which phone sent it, not where it was.
  - Card numbers never return (`S.cardSeq`); ten cards fit one A4 page (measured under print media).
