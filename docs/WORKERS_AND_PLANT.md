# Workers and the plant

Owner, 7 Oct 2026: *"Let's update the roster list. Every worker will be assigned details, skill level, personal details,
tenure, happiness index (derived from a combination of factors), reliability, consistency, relationships, etc. Update the
Production list as well … a complete breakdown of the production area, like in Barrel - we have 3 barrels operational, 3
barrels are not-operational. In VAT A1 - we have 4 tanks out of which 3 are operational and one is not … We'll start adding
details and it should be presented where it passes the 6 second rule, as with AAA strategy games."*

Their answers to the four questions put to them, the same day:
1. **The units of a line work side by side**, and each is measured in **kg a round**.
2. **Watch signals and a monthly check-in** instead of one happiness number: *yes*.
3. **Personal details are the owner's alone.** The index is the **motivation index**, not happiness.
4. **The owner enters everything.**

## The rules this plan keeps

- **Nothing about the shop is in the build.** This repo is public: the units, the workers and every personal detail live in the
  book on the device (and its backups and sync copies), never in the code or a test.
- **A figure says what it rests on** (DR-8, I2): a derived figure carries its days of record and is not firm under a fortnight.
- **A record is changed with its history kept**: a unit's status changes are a dated log; a worker's check-ins are kept; a
  retired unit or a left worker is never deleted.
- **Owner-only**: every edit on these screens asks for the owner (`grdIsOwner`), and personal details are drawn only for the owner.

## W1 · The plant register

`plant.js`, `S.plant = { units, log }`.

- **A unit** (`S.plant.units`): `id`, `name` (*Tank 3*, *Barrel 2*), `station` (`vat-a1` · `vat-a2` · `barrel` · `pickling`, and the
  supporting stations `lab` · `oven` · `power` · `etp` · `other`), `kind` (tank · barrel · rectifier · other), `kgRound` (its capacity,
  for a unit that plates or pickles), `status` (`run` · `standby` · `down` · `repair`), `since` (the day the status began), `reason`,
  `condition` (good · fair · needs work), `needs`, `age`, `risk` (`{p, cost, days, say}`, the planner's), `note`, `retiredAt` /
  `retireReason`.
- **The status log** (`S.plant.log`): every status change, `{unitId, date, from, to, reason, at, by}`. Days down are measured off it.
- **A line's capacity** (`pltStation`): the units side by side, so **available** = the kg a round of the units running or on
  standby over the kg a round of all of them (*3 of 4 tanks · 75% available*). With no kg a round typed it is by count, and says so.
  **Used** is what the line actually plates a round (the planner's reading of the register, `plnBase().lines`) over the available kg a
  round: *running at 61%*. A line with no register read says *not measured*, never a zero.
- **One register with the planner**: the planner's machines are units now (`_plantFromMachines1` moves them once, keeping their ids),
  and `plnLive('machines')` reads the units, so the trials draw a unit's risk exactly as before.
- **Where it shows**: Production → **Equipment** (a new view: each station a strip of unit tiles, its capacity line, the units, the
  status log), Production → Overview's first panel (the strips alone), Floor → Day's line cards (*1 of 4 down*), the planner's Plant view.
- **To-do** `plantDown`: a unit down or under repair for 3 days or more (red at 7), one task per unit.
- **The 6-second test**: one glance at a strip says whether the line can run today, how much of it, and what is down.

## W2 · Worker records

`people.js`, on the worker (`S.staff[]`), the check-ins in `S.peopleCheckins`.

- **Typed, the owner's alone** (`w.profile`): phone, address, date of birth, joining date, emergency contact (name, relation, phone),
  ID (the last four digits), bank (the last four), languages, notes. Drawn only for the owner; a role without it never sees the block.
- **Typed, the work**: skill per area (0–5 dots, `w.skills[area]`), relationships (`w.ties`: *brother of*, *referred by*, *reports to*,
  each naming a worker on the roster or a name).
- **Worked out, read each time** (`pplStats`), each with the days it rests on:
  - **Tenure**: from the joining date, else the first day marked (*since first marked*).
  - **Reliability**: present on the days expected (Mon–Sat, 90 days), late against the shift (an in-time after 8:40 on the general
    shift), absences with no reason, early leaving.
  - **Consistency**: how much the in-time and the hours vary day to day; how many areas they stood in.
  - **Workload**: OT hours in the last four weeks, Sundays worked, late blocks stood.
  - **Days worked per area**, set beside each skill rating, so a rating with no days behind it shows.
  - **Who they work beside**: the crews they share most (the general shift's area and the OT blocks).
- **The motivation index** (owner, 7 Oct 2026): the signals, each a reason and its figure, and a score out of 100 built from them,
  never shown without its reasons:
  - pay owed and carried forward (`payCarried`);
  - an advance in three of the last four weeks;
  - OT climbing four weeks running;
  - paid less a day than a hand of the same tier with less tenure;
  - absences rising (the last 30 days against the 60 before);
  - no rise in a year (the rate's history);
  - the owner's **monthly check-in**, 1 to 5 (`S.peopleCheckins`), which weighs most: it is the one figure that asks.
  Not firm under a fortnight of record or without a check-in in 60 days.

## W3 · The screens and the files

- **People → Roster as cards** (the 6-second test: who is here, who to watch): name, tier, tenure, skill dots for their top areas,
  three short bars (reliability, consistency, workload) each with its word, and the motivation line. A grid on the desktop beside
  the open worker, a list on the phone.
- **The worker's page**: the record, the figures with their days, the signals, the check-ins, the relationships.
- **To-do** `pplCheckin` (no check-in for a worker in 45 days, the owner's) and `pplWatch` (motivation under 50, firm).
- **Import templates**: `sep-plant` v1 (units, merged by id) and the roster's profiles through Staff → Roster → Import (merged by name,
  as the roster always is), so the owner can fill both in a spreadsheet.

## W4 · ID cards and the scanner

Owner, 7 Oct 2026: *"Every employee must also have an ID Card, which I can take a print out later, if needed. That becomes a tag
that every worker gets, we will have a QR code scanner in it that should be linked and scannable to the attendance logger in the app."*

- **A card per worker** (`idcard.js`): a card number (`w.card`, *SEP-0007*, given once and never reused) and a QR code of
  `SEP1:W:<card>:<check>`, drawn by the app's own encoder (no library, no network). Printed through the one print view: the
  company, the name, the designation, the card number, the blood group, the QR, credit-card size, ten to an A4 sheet.
- **The scanner** (Staff → Day → **Scan cards**): the phone's camera reads a card (the browser's `BarcodeDetector`; where a
  browser has none, the card number is typed). The first scan of a day is the in-time, the next the out-time; each is a mark
  the worker's own (`src: 'scan'`), so a roll never rewrites it, and a scan within two minutes of the last is the same scan.
  Every scan is listed on the screen as it lands, with Undo. A card retired or a worker inactive is refused and said.
- A floor entry for the guard (`attFloorOk`); printing the cards is the owner's.
- **Changed the same day (owner, 7 Oct 2026)**: a number is given when the sheet is printed, never at preview; the card has two sides,
  the front carrying the plant's address and phone, the back the safety rules of a zinc plating floor (rewritable on the print dialog)
  and where to return a found card, printed as a sheet of backs after each sheet of fronts for double-sided printing. P172.

## W5 · The office QR

Owner, 7 Oct 2026: *"a universal QR Code that I can print and keep in the office which workers can scan via their camera and
open a link and mark attendance, we would need safeguards for proxy"*. The app has no server to receive a check-in, so of the
ways put to them the owner chose **WhatsApp with checks**.

- **The sheet** (Staff → Roster → **Office QR**, the owner's; `checkin.js`): the office's WhatsApp number, the plant's latitude and
  longitude (typed, or *Use where this device is now*), a radius (150 m), and a key made on the first save (`S.checkinCfg`). Printed
  through the one print view as one A4 page: a large QR and three steps. *New key* makes every sheet printed before it fail the code.
- **The link** is `checkin.html` beside the app, with everything in its fragment (`#o=…&la=…&lo=…&r=…&k=…&n=…`), which no server
  sees: nothing of the shop is in the repo. `checkin.html` is hand-written, not built, and registers no service worker.
- **The worker's phone**: the card number (asked once, kept on that phone), **Check in**, the location allowed, then **Send on
  WhatsApp**, which opens a chat to the office number with the message written: the card, the time, the place with its accuracy, and
  a code worked from the key, the card and the minute (`ckCode`, the same arithmetic on both sides).
- **The office reads the chat** through the one paste box (or Add). A check-in has its own review: every one beside its checks, and
  Save puts the ticked ones into the day as a card scan does (`idcApply`, `via: 'checkin'`): the earliest time the in, the latest the
  out, whatever order they arrive in, and a repeat already in the day is said, never saved twice. Beside a roll, the roll's check offers
  **Read the check-ins**.
- **The checks against a proxy**, each said on its row (`ckReview`): a live card; the code, worked over the card, the time, the
  place and the phone's own card, so a message typed or changed by hand fails it (a message edited after sending is red too); the
  sender is the worker's own phone (the number on their record, or a contact named as them; another worker's phone, or a number on
  two other workers' records, is red); the place inside the radius (outside it by more than the fix's accuracy is red); sent when it
  says it was made (10 minutes); within the shop's hours; one phone, one worker a day, across every paste of the day; the card the
  phone was first set up with (another card typed on it is red). A red row, and one with no place shared or from a phone nobody
  knows, is left unticked; the owner may tick it, and a check-in saved past a check keeps what it failed and when (`notes`, `ackAt`).
  Warn, never block.
- **What it cannot stop**, said on the setup: a phone that fakes its location, and a check-in made at the plant on someone else's
  card and passed to them to send from their own phone (the sender check proves which phone sent it, not where it was). The code is
  no secret from anyone holding the sheet: the key is in its link. Ask for a live location in the chat when one looks wrong.
- **The day a time belongs to** (the QA chain, 7 Oct 2026): a scan or a check-in lands on its own day, never the day it is read; a
  time before noon for a hand whose day before has only an in from 4 PM is that day's out, past midnight (`idcApply`).

## Order

W1, then W2, then W3, then W4, then W5, in one PR, one commit each; the QA chain before the merge (owner, 7 Oct 2026).
