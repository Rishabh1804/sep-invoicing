# Entry faces: each hand enters their own

**Status: F1 built (10 Oct 2026, P199): duties on a user, Mine, landing on it, its steps, what was entered, its paper and backup,
Today hearing a face. F2 built (10 Oct 2026, P200): the pickling hand's two forms on Mine, the group's message and its key, Correct,
the checks of §4 that touch a load or a count, and the matcher's second pass (CLAUDE.md *Entry faces*). F3 built (10 Oct 2026,
P201): the supervisor's two rolls written on Mine and saved as the roll, the barrel's batches, and the check of a batch against its
barrel. F4 built (10 Oct 2026, P202): the register clerk's VAT page on Mine, read by the register photo's own reader, its power log
and its checks, and the clerk's attendance sheet set against the supervisor's roll. F5 built (10 Oct 2026, P203): each face's paper,
blank and the day as entered, and the three new sheets (the pickling sheet, the barrel batch sheet, the VAT register pages), which
Production prints for any day too.** F6, then the flow thread T1–T3, follow, one commit each, on the tab map's branch (PR #146) ahead
of TM5–TM7.

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
   *Built (F5):* Mine's *My sheets*, **Print my sheets** (the blank sheet of each duty, in the day's order) and **Print the day as
   entered**: each duty's record of the day as the app holds it, whoever entered it, each row saying through which door (a copy filed
   must be whole, and the record the face wrote is the day's record), a voided or corrected record never. Production → More → Print
   sheets prints the floor's three for any day, blank or as entered.
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
  *Built (F3), one step further than planned:* the form writes the roll's own message and saves it through the roll's reader and
  save (`relayPlan`, `relayApplyPlan`), so the day is what the same roll pasted gives, to the mark, read exactly as written (no
  lesson learnt from a pasted roll's heading moves a pick). The marks stay `src: 'relay'` (a face's roll IS a roll: the next one
  updates it, and *Read the rolls again* reads it); the roll kept in `relayPastes` names who wrote it (`face`). Saved again from the
  face, a roll restates the day rather than adding to it: the day is read again from its rolls with the new one in the old one's
  place, and the old is kept marked `replacedBy` (refused if pasted, never read again); the face's out-time roll, if saved, is worked
  out again with it, since who went home was worked out from the places. A hand a row with one pick for the place (not
  an area card each: one list reads in one look on a phone, and *Usual places* fills it from each hand's own area); the barrel alone
  is a place beside *Barrel & pickling*, as the roll sometimes heads it. A mark entered on the day itself (People → Attendance, a
  card scan) is left by any roll, so the face shows it and does not offer to change it.
- **The out-time roll**: who left at 5:00 PM, then the evening and night blocks (out at, area, crew, EXTRA, work done).
  *Built (F3):* who went home is worked out (everyone present on no late block), at five unless the hand's own time is set; a
  block runs from five, or from eight as the night hold, to any half hour up to 6 AM, on one line or several (the night hold on the
  barrel and VAT A2). Measured on the owner's 37 days since 1 Sep, each roll written from the day and saved unchanged leaves the
  out-time side as it was on every day, and the in-time side on all but three, each a day that contradicted itself.
- **Stock**: the counts and use as the stock message carries them (Stock's form by hand, the lines in the message's order).
  *Built as planned:* the duty's step opens Stock's own form; a face has no second door to it.
- **The barrel register, per batch**: barrel, client, part, quantity, in and out (§1.6). Written as `plated` entries on the barrel
  line, `basis: 'register'` (a batch is the barrel's register, which it has never had).
  *Built (F3):* the barrel is one of the plant register's barrels (`unitId`), else its number typed; the message for the group is
  the day, *BARREL n: in - out*, the client and each part with its figure.

### F-clerk: the register clerk
- **The attendance sheet**: Staff → Day → Sheet on the phone, a hand a row (P/H/A, area, in, out, the OT slots), the clerk's own
  view, different from the supervisor's roll (the owner's word). Where both are entered for a day, the two are set against each
  other (§4).
  *Built (F4):* the duty opens People → Attendance → Day as the sheet, as before; every mark typed on the day now carries who typed
  it (`by`), so the clerk's marks are known from anyone else's. The rulings are §4's.
- **The VAT register**: a page per line and day, a row a round (time, client, part, the figure as written: `98×8+1` and
  `3+4×156` are kept and added up in code, never by hand), START and END, a struck row marked, the power log (cut at, power in).
  Written as the photo read's rows are (`prodFromRegisterRead`), so the gauge and part rules, the series, the crews and the
  efficiency read it unchanged. The photo stays a door for a page written on paper.
  *Built (F4):* VAT A1's page a round a row (the time, the figure), VAT A2's a batch a row (began, ended, the figure at the end: the
  register's START and END; a start left blank began where the batch before ended), a switch for a page kept the other way; the
  client and part only where a run begins, carried down as the paper's ditto. Two clients in one round are a row each at the same
  time; a struck row is a round removed (the photo stays the door for a struck paper row). The page is kept on the phone until saved,
  since a save at every round would void a run at every next one; saved again, a run as it was stays and a changed one is voided and
  read anew. The power log is the day's, a cut saved at once from either line's page (`logId`). Measured on the owner's 23 register
  pages: retyped from their own saved rounds, 19 read exactly as saved; three hold a run with no client written (the face asks for
  it) and one splits a figure for two codes by challans that have changed since.

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
  *Built (F2):* asked only where every line the load can have gone to was recorded in its window (its usual line, else its
  client's lines, else all three; a line with no record is the register missing, and Today says so); a run with no load only on
  the VAT lines (the barrel has its own pickling) and on a day the face was in use. The matcher links a load to the register's run
  of its kind or code where its own part or family links nothing (the 26 of 165 above).
- **A load against its challan**: no challan open for the client and part, or more pieces than the challan has open. *Built (F2):*
  more than the challans hold is In plant's own setting of loads against challan lines; no challan at all stays Production's rule
  (`prodPickledNoChallan`). Material counted in is set against its challan line (short is red) or, with none, asked a working day on.
- **The two attendance views of one day**: present on one and absent on the other, or in another area; an ID-card scan or an
  office check-in that disagrees with either.
  *Built (F4), the sheet against the roll:* each hand the clerk marked against the day's saved rolls read alone (with nothing typed
  on the day beside them): present on one and absent on the other, a half day on one, another line (where both name one; the barrel
  and its own pickling one place, which the roll writes either way), or present with the rolls naming them nowhere. The sheet's mark
  stands; the owner rules each, in the hand's day: *Use the roll's* or *Looks right* (kept against the roll's reading it was given).
  On the owner's book, the 55 marks typed by hand on the 25 days since 1 Sep with rolls: 8 questions on 5 days, 7 another line and
  1 not on the roll, none present against absent. *Not built:* a card scan or a check-in against either.
- **The roll's EXTRA against the shortfall** (the Areas check, as now).
- **A barrel batch against the zinc and chemicals charged into the barrel** that day (stock by line), and its kilos against the
  barrel's usual load. *Built (F3), the second half:* a batch over a quarter heavier than its barrel takes (the kg a round typed on
  the unit, else the median of five or more of that barrel's own batches), `heavy`, amber. *Not built:* the charge. Stock by line
  (PP3) already sets a day's zinc and chemicals on the barrel against everything the barrel plated that day, its batches included;
  one batch against a day's charge is no comparison.
- **A VAT round against the line's usual round** (its rack sizes and the gauge rules), and the register's day total against its
  rounds. *Built (F4):* said on the page as it is typed (the photo check's own words), and once saved asked of the owner: `rack`, a
  round of a size its part never ran at on its line before the page's day (three rounds or more on record), and `total`, a page whose
  day total written the rounds do not meet.
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
| F4 | The clerk's face (the attendance sheet, the VAT register) and the two views of a day set against each other (built) | P202 |
| F5 | The sheets on paper (the pickling sheet, the barrel batch sheet, the VAT register page; every face's filled copy) (built) | P203 |
| F6 | The guides (*Using the app: my face*, one per face, by role), docs, the full suite | — |
| T1–T3 | The flow thread, as §5 | P204 |

Each spec uses made-up names in the shop's shapes, and each fails on the build before its step.

## 7. Data flows (soma-internal)

- Records a face writes are the records a paste writes, with `src: 'face'` and `by`: the `sep-production` and `sep-stock` exports
  carry them unchanged in shape, and the compile reads them as it reads a paste's. A barrel batch is a `plated` entry on the barrel
  line with `basis: 'register'`, where the barrel had only the supervisor's relayed list (`basis: 'relay'`), and carries `unitId`
  (or `barrel`, the number typed), `to` (when it came out) and `msgHash`.
- A roll written on a face is a roll (F3): the day's marks and EXTRA rows are the ones its paste would write, the marks
  `src: 'relay'`, and the roll is kept in `relayPastes` with `face` (the name of who wrote it). The attendance seed and the compile
  read it as a pasted roll. A roll written again on the face keeps the old one with `replacedBy` (the new roll's id) and
  `replacedAt`: a reader of the kept rolls skips it, as *Read the rolls again* does.
- A VAT page entered on a face is kept whole in `production.pages` (its rows as typed, its style, the total written, who), its runs
  production entries as a register photo's (`basis: 'register'`) with `src: 'face'` and `pageId`; a cut entered on it carries `logId`.
  A mark typed on the day carries `by`; one the owner kept against the roll, `rollOk` (F4).
- A sheet printed writes nothing (F5): each is drawn from the book, blank or as entered, and leaves no record.
- New on the book: `users[].faces` (the duties a user enters), an accepted disagreement kept on the entry it answers (`checkOk:
  {codes, at, by}`, as stock's is; built so in F2 rather than as a store of its own),
  `client.payTermsDays`, `client.turnaroundDays` and per part, a challan's `priority`. They travel with the book; NEXT_SESSION's
  table gets their shape when each is built.

## 8. Open, to be settled with the owner as the faces are tried

- Whether the supervisor's roll on the face replaces the WhatsApp roll at once or after a week of both (the WhatsApp copy keeps the
  group whole either way).
- The barrel batch's quantity: pieces, kilos or both, as the barrel is loaded.
- What the clerk's sheet takes as the day's truth where it and the roll disagree, until the owner rules each.
