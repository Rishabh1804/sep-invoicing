# Entry faces: each hand enters their own

**Status: planned, 10 Oct 2026.** Nothing below is built yet. The steps are F1–F6, then the flow thread T1–T3, one commit each,
on the tab map's branch (PR #146) ahead of TM5–TM7.

**Why.** Every figure the floor sends reaches the app second-hand today: the floor writes it on WhatsApp or paper, the owner
pastes or photographs it, and the app reads it back. The material-flow study of 10 Oct (pickling → plating → dispatch → payment,
on the owner's book, kept private) found the gaps that route leaves: 81 of 165 pickling loads with no count, no barrel register,
the floor's names not the challans' part numbers (26 of 165 loads linked by the app's own rule, 140 by client, code and kind),
register pages missing for whole days.
The owner's answer (10 Oct 2026):

> *"develop app faces for each employee to enter data - [the pickling hand] - Pickling, [the supervisor] - Attendance, Stock,
> Barrel, [the register clerk] - Attendance, VAT Production. We have guard in place, they will all be using the phone app."*

and, asked how:

> *"Each their own phone, no one shares any screens. Attendance screen for [the register clerk] and [the supervisor] will be
> different."* · *"Yep, we have the tools and infrastructure for it"* (a copy to the WhatsApp group while the floor changes over) ·
> *"Trusted but open for me to verify if cross verification with other linked data doesn't happen"* · *"Should be per batch"*
> (the barrel) · *"English only"* · *"Every one will have an option to print out their sheets as well, if they want to fill in
> manually and file it in my table."*

Names are never written into this repo: a face belongs to a role the owner gives an ID, and the people are the book's.

## 0. What exists to build on

- **The guard** (`guard.js`, `docs/GUARD.md`): IDs and PINs, roles (Owner, Office, Supervisor, Floor), each role's pages and what it
  may change (`floor` is *Floor entries*), the lock, devices registered with the owner present, the change log tagging every save
  with who and which device.
- **Sync and the merge** (`github-sync.js`, `merge.js`, G4): each registered phone pushes and pulls the whole book, and two phones'
  changes merge record by record against the copy both last saw. Four phones each adding their own records is the case it was
  built for.
- **The day's five inputs** (`today.js` `TDY_INPUTS`): the in-time roll, the pickling loads, the stock message, the production
  records, the out-time roll, each in, late or not yet against the minute it usually arrives. A face's entries are these inputs.
- **The forms by hand** that a face re-uses or follows: Production's hand form (`prodHandHtml`, a load, a run or a cut, staying on
  the form for the next), Stock's (`stockManualNew`, the four kinds, a delivery's bill), Staff → Day → Sheet (the per-hand sheet:
  P/H/A, area, in, out, OT slots), the register photo's check (`prodFromRegisterRead`: rounds, START/END, a struck row, the power
  log), the readers of every WhatsApp shape (`prodparse.js`, `relay.js`, `stock.js`).
- **The sheets on paper** (`attsheet.js`, `stocksheet.js`): the supervisor's roll, the clerk's Day entry, the stock message, each
  blank or filled.
- **The checks a record already gets**: stock entries before believed (`stockEntryChecks`), the roll's names read three ways,
  pickled → plated matching and the usual line (`prodIndex`), In plant's stages, the ID-card scans and the office QR.

## 1. The contract (the owner's answers)

1. **A face is a person's, on their own phone.** A face is set on a user (Settings → Access → Users & access: *Enters*, one or
   more of the duties below), not on a role, because two people of one role enter different things (*"Attendance screen for [the
   clerk] and [the supervisor] will be different"*). No screen is shared.
2. **Signing in opens the face.** A user with a face lands on it, not on Today; the face is the first of their doors on the bar
   (`WORKSPACES` gains a *Mine* door for them alone). Everything else their role opens stays one tap away.
3. **Trusted, checked, never held** (*"Trusted but open for me to verify"*): a face's save is a record at once, the same record a
   paste of the same message makes, marked as entered by its author (`src: 'face'`, `by` the user). Each is set against the data it
   links to (§4); where it does not agree, the owner is asked to look (a To-do task, red or amber by what is at stake) and the
   entry carries the question until the owner rules. Nothing waits for approval.
4. **The WhatsApp group keeps getting its message during the changeover.** A face's save ends with **Send to the group**: WhatsApp
   opens with the message written in the shop's own shape (`waLinksHtml`'s doors), so the group and anyone reading it see what
   they see today. A message the app already holds from a face is known when it is pasted again (its fingerprint), and is
   refused as already entered, never read twice.
5. **Paper stays a choice** (*"if they want to fill in manually and file it in my table"*): every face has **Print my sheet**, the
   blank sheet for its duty (the ones that exist, and the three new: the pickling sheet, the barrel batch sheet, the VAT register
   page), and **Print what I entered** for the day, to file.
6. **The barrel is entered per batch** (*"Should be per batch"*): a batch is its barrel, client, part, quantity (pieces or kg),
   when it went in and came out.
7. **English only.** Every face, form and sheet in English; the shop's own words for its parts and areas, as the book holds them.
8. **Offline on the floor.** A face works with no signal, as the app does: the record is on the phone at once and syncs when the
   phone is back online (auto-push, merged). The face says when its entries last reached GitHub.

## 2. The three faces

Every face is one screen: the day (‹ today ›), its duties as steps (the Today inputs' look: in, late or not yet, against the
minute it usually comes), each opening its form; under them what was entered today, each with Correct; Print my sheet; Send to the
group on each saved entry. A form stays open for the next entry and carries over what repeats (the shop's rule for entering many
at a sitting).

### F-pickling: the pickling hand
- **A load into the tank**: client (the book's, the ones with material open first), part (that client's parts with a challan
  open first, then all; a new name typed is kept as written and asked about, as a paste's is), quantity in pieces or kg, **the time
  it went into the tank** (the owner: *"When it goes into the tank"*; now, by default), the gauge where the part has more than one.
  Written as a `pickled` entry, `basis: 'pickling'`, exactly as a pasted load is.
- **Material in** (the incoming count, the owner: *"Yes, informed him and will be easier to do in the app"*): a challan's lines
  counted on arrival, against the challan when it is in the book (Challans' own record), else as an `arrived` entry to be matched
  when the challan is entered.
- **Re-pickling and rework** marked as such (they count as work, never as billing).

### F-supervisor: the supervisor
- **The in-time roll**: the day's roster by area as the supervisor writes it (an area card each, tap the hands standing there; the
  6:00 AM blocks with their crew and EXTRA). Written as the roll is (`S.attendance`, `src: 'face'` instead of `'relay'`, the
  EXTRA rows), so Areas, Pay and the labour card read it unchanged.
- **The out-time roll**: who left at 5:00 PM, then the evening and night blocks (out at, area, crew, EXTRA, work done).
- **Stock**: the counts and use as the stock message carries them (Stock's form by hand, the lines in the message's order).
- **The barrel register, per batch**: barrel, client, part, quantity, in and out (§1.6). Written as `plated` entries on the barrel
  line, `basis: 'register'` (a batch is the barrel's register, which it has never had).

### F-clerk: the register clerk
- **The attendance sheet**: Staff → Day → Sheet on the phone, a hand a row (P/H/A, area, in, out, the OT slots), the clerk's own
  view, different from the supervisor's roll (the owner's word). Where both are entered for a day, the two are set against each
  other (§4).
- **The VAT register**: a page per line and day, a row a round (time, client, part, the figure as written: `98×8+1` and
  `3+4×156` are kept and added up in code, never by hand), START and END, a struck row marked, the power log (cut at, power in).
  Written as the photo read's rows are (`prodFromRegisterRead`), so the gauge and part rules, the series, the crews and the
  efficiency read it unchanged. The photo stays a door for a page written on paper.

## 3. What every face shares

- **The face shell** (`faces.js`, new): `FACE_DUTIES` (pickling, incoming, roll-in, roll-out, stock, barrel, attsheet, vat),
  `faceOf(user)`, the face's screen and its address (`?tab=pageFace&d=<day>`), its door on the bar for a user with one.
- **Today hears a face**: an input entered on a face is in at the minute it was saved (`tdyUsual`, `tdyInput` read `src: 'face'`),
  and Needs you's inputs say *entered by* where a face entered them.
- **Who entered what**: every record a face writes carries `by` (the user) and the change log's tag; History lists them under the
  person.
- **The guard**: a face's forms are *Floor entries* (`grdOk('floor')`), asked the PIN once the re-ask window has passed; a face
  never opens a money or wages figure its role does not see.

## 4. Cross-checks: the owner looks only where the data disagrees

Each check runs on the record the face wrote and the records it links to, and only a disagreement reaches the owner (one To-do
task per check and day, its rows naming the entries, *Looks right* to accept or *Correct* to put right; the acceptance kept on the
entry, as `checkOk` is on stock):
- **A load with no plating** on its line by the next working day noon (the matcher's own window), and **plating with no load**.
- **A load against its challan**: no challan open for the client and part, or more pieces than the challan has open.
- **The two attendance views of one day**: present on one and absent on the other, or in another area; an ID-card scan or an
  office check-in that disagrees with either.
- **The roll's EXTRA against the shortfall** (the Areas check, as now).
- **A barrel batch against the zinc and chemicals charged into the barrel** that day (stock by line), and its kilos against the
  barrel's usual load.
- **A VAT round against the line's usual round** (its rack sizes and the gauge rules), and the register's day total against its
  rounds.
- **Stock** as now (`stockEntryChecks`: twice, overlap, below zero, large, a count off the level).

## 5. The flow thread (T1–T3)

The owner's answers on the material-flow study:
- **Turnaround** (*"Target default one day, can be edited as per material or overall as well. Say, they ask for a particular
  material to be done on a priority basis - we can plan that out"*): a target from a challan's receipt to its dispatch, one day by
  default (Settings → Checks & alerts), set per client and per part on the client, and **a priority** on a challan or a line (a
  date it is wanted by). Dispatch is the invoice's despatch date, not its date (the owner: invoice dates are the challan
  collection's).
- **Payment terms** (*"Mehta 7 days - as we give 2% discount, every other client 45 days"*): `client.payTermsDays`, 45 by default,
  7 set once on the client whose rebate scheme runs (by its name, where it has none; the owner's to change on the client).
- **T1. The targets and terms** in the book, on the client, in Settings; a challan's priority on Challans.
- **T2. The tasks**: material past its target (by its stage, read off In plant: waiting to pickle, pickled not plated, plated not
  invoiced), a priority job not plated by its day, an invoice past its client's terms (the receivables' ageing against the terms,
  not a fixed 90 days).
- **T3. The flow on screen and the predictions**: on a client's page and Floor's Overview, the median days from receipt to
  pickling, to plating, to despatch, and from invoice to payment, against the target and the terms; each open challan's expected
  despatch day (its client's and line's usual turnaround and the work ahead of it on its line), each open invoice's expected
  payment day (`bankDaysToPay`).

## 6. Steps and specs

| Step | What | Spec |
|---|---|---|
| F1 | The face shell: duties on a user, the face's screen and door, the guard, Today hearing a face, print and WhatsApp doors | P199 |
| F2 | The pickling face (a load, material in, rework) and its checks | P200 |
| F3 | The supervisor's face (the two rolls, stock, the barrel per batch) and its checks | P201 |
| F4 | The clerk's face (the attendance sheet, the VAT register) and the two views of a day set against each other | P202 |
| F5 | The sheets on paper (the pickling sheet, the barrel batch sheet, the VAT register page; every face's filled copy) | P203 |
| F6 | The guides (*Using the app: my face*, one per face, by role), docs, the full suite | — |
| T1–T3 | The flow thread, as §5 | P204 |

Each spec uses made-up names in the shop's shapes, and each fails on the build before its step.

## 7. Data flows (soma-internal)

- Records a face writes are the records a paste writes, with `src: 'face'` and `by`: the `sep-production` and `sep-stock` exports
  carry them unchanged in shape, and the compile reads them as it reads a paste's. A barrel batch is a `plated` entry on the barrel
  line with `basis: 'register'`, where the barrel had only the supervisor's relayed list (`basis: 'relay'`).
- New on the book: `users[].faces` (the duties a user enters), `S.faceChecks` (an accepted disagreement, with who and when),
  `client.payTermsDays`, `client.turnaroundDays` and per part, a challan's `priority`. They travel with the book; NEXT_SESSION's
  table gets their shape when each is built.

## 8. Open, to be settled with the owner as the faces are tried

- Whether the supervisor's roll on the face replaces the WhatsApp roll at once or after a week of both (the WhatsApp copy keeps the
  group whole either way).
- The barrel batch's quantity: pieces, kilos or both, as the barrel is loaded.
- What the clerk's sheet takes as the day's truth where it and the roll disagree, until the owner rules each.
