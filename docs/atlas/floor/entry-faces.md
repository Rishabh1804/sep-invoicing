---
subject: "Entry faces"
domain: floor
modules: [split/faces.js, split/facesheet.js, split/flow.js]
specs: [docs/ENTRY_FACES.md]
tests: [P195, P199, P200, P201, P202, P203, P204]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Entry faces
`docs/ENTRY_FACES.md` (owner, 10 Oct 2026: *"develop app faces for each employee to enter data … We have guard in place, they will
all be using the phone app"*; *"Each their own phone, no one shares any screens"*). F1, the shell (`faces.js`, P199); F2, the pickling hand's
forms and the checks (P200); F3, the supervisor's (P201); F4, the register clerk's (P202); F5, the sheets on paper (P203); F6, the guides (P199); T1–T3, the flow thread (P204). No name is in the
build: the people are the book's.
- **A face is a person's, never a role's** (`users[].faces`, the duties they enter: in-time roll, pickling loads, material in, stock,
  attendance sheet, barrel batches, VAT register, out-time roll), set by the owner on the user's form (Settings → Access → Users &
  access → *Enters*); the users list says what each enters.
- **Mine** is their screen (`pageFace`, an overview): the day (‹ › and Today, the address's `d`), the duties as steps read as
  Today's inputs read them (in, late, not yet, not expected; the attendance sheet in once this person typed a mark on the day (`by`),
  Material in once anything is counted in, never on a challan typed in the office; an ID whose role makes no Floor entries is told so on
  each step, `faceFloorOk`), each opening where the duty is entered on that day (its own form on
  the face, F2–F4; Stock's by hand; People's day as the sheet for the attendance sheet); *What you entered* that day from the change log (`faceEntered`); their paper (*Print my sheets*, *Print the day as entered*, F5), and whether their entries have
  reached GitHub (`faceSyncState`).
- **Its door is drawn only for an ID with a face** (`faceMineDoor`), first on the bar and after Add on the rail; `grdSees('pageFace')`
  is the face's (`faceSees`), guard on or off. A reload within the sign-in window draws it too (`grdBoot` draws the shell again: the
  phone's bar had been drawn before the book said who was in, and Mine's door was left off until the next sign-in; F4). **Signing in lands on it** from the start's Today or when another person signs in; a
  launch onto another screen is kept (`grdAfterUser`).
- **The owner sees a person's screen as theirs** (*See their screen* on the users list: `_faceUid`, ended by the next sign-in, the
  owner's own included: `grdSignIn`).
- **Today hears a face**: an input a person with that duty entered says so (*Entered by …*, `faceInputBy`, read off the change log; a roll
  by whoever wrote it on a face, `faceRollBy`, never by a mark typed on the day after it).
- **Search finds Mine** only where it opens (`srchSees`).
- **The pickling hand enters on Mine itself** (F2, P200): *A load into the tank* (the client, those with material open first; its parts
  as the challans name them, those open first with what is open on them, or a name typed as written; pieces or kilograms; the time it
  went in, now by default; re-pickling or rework) and *Material in* (a challan in the book counted line by line against its own figure,
  or what came with no challan in the book yet). A save is the record a paste makes (`pickled`, `basis: 'pickling'`; `arrived`,
  `basis: 'floor-in'` with `imId`, `imItemId`, `challanNo`), with `src: 'face'` and `by` the person; the form stays for the next and
  lists what was saved from it. **Correct** opens the form on the entry; saved, it takes the entry's place (`replaces`).
- **The group still gets its message**: each saved entry has *Send to the group* (WhatsApp with the message in the shop's shape: the
  day, the client, each part and its figure, the time) and *Copy*. The entries carry the message's key (`msgHash`), so that message
  pasted later is refused as entered on a face (`prodPasteSeen`), and a load or count retyped (the same day, client, part and figure,
  within twenty minutes) is left out of a paste (`prodFaceTwin`).
- **Trusted, checked, never held** (`faceChecks`): a load with no plating found by noon the next working day, where every line it can
  have gone to was recorded (its usual line, else its client's lines in sixty days, else all three: the barrel keeps no register); a
  load past what its challans hold (In plant's own setting of loads against challan lines, `over`); a count the challan
  does not bear out (short is red); a count with no challan a working day on; a VAT run no load became on a day the face was in use.
  The entry carries the question (on Mine; Production → Entries → *To check*), To-do `faceCheck` asks the owner (one task a check and a
  day), and *Looks right* keeps it as entered (`checkOk: {codes, at, by}`, the `voids` permission). A load with no challan at all is
  Production's own rule (`prodPickledNoChallan`), never asked twice.
- **A load meets the register's run of its kind or code** (`prodMatchAll`, a second pass): a load its own part or family linked to
  nothing takes, in the same window, a run of its client sharing a 4-digit code, else a run of its kind (pads and liners one kind) at a
  gauge that fits, a run's gauges read off its round included (the family's key cannot hold them); a named load only a run naming its
  kind alone, never another part's; never a run linked already. On the owner's book, the 68 loads since 1 Sep: the first pass linked
  12, the second 11 more, and the line read from plating went from 7 loads to 18 (of the 45 left, 17 are a client with no plating on
  record within five days).
- **The supervisor writes the rolls on Mine** (F3, P201). *In-time roll*: a hand of the day's roster a row, placed with one pick (the
  places the roll writes: VAT A1, VAT A2, Barrel, Barrel & pickling, Pickling A1 & A2, Office & gate, Civil; or Absent; under a heading
  naming two, each hand stands at their own area, as the roll's reader places them), *Usual places* fills the unmarked from each
  hand's own area and *Mark the rest absent* the rest (a hand on a 6 AM block is on site); the 6 AM blocks; the EXTRA on the 8:30 shift
  by line (the barrel's on the unit). *Out-time roll*: who went home is worked out (everyone present on no late block), at 5 PM unless
  their own time is set (the roll writes it after the name, *ALFA 7:00 PM*); each late block from 5 PM, or 8 PM for the night hold
  (*NIGHT HOLD 8 PM TO 5 AM*), to any half hour up to 6 AM. **A block runs on one line or several** (chips: VAT A1, VAT A2, Barrel,
  Pickling A1 & A2, Barrel pickling), written under the heading the reader takes back as those lines (`faceBlockHead`: *BARREL & VAT
  A2*; a VAT line's pickling is the line's own, folded in by the Areas check, and the block says *Booked to VAT A1 (pickling with a
  line is counted in the line’s block)*), with its crew, EXTRA and work done; a block with its crew and no line, a night hold over by
  8 PM, or a block with nobody on it is refused at Save. Either roll opens filled from the day as it stands (a line's EXTRA the rolls
  booked twice added into one figure; one typed by hand left as the day's own). **A mark entered on the day itself** (People →
  Attendance, a card scan, a check-in) is left by any roll, so the face shows it in its place, says *the roll leaves it* and does not
  offer to change it (`faceMarkByHand`); *Usual places* and *Mark the rest absent* pass it by.
- **A roll saved on a face is the roll** (`faceRollText`, `relayApplyPlan`): the form writes the message in the shop's shape (the
  day's head, the slots, a numbered line a hand, each area's EXTRA, the absent by tier) and saves it through the roll's own reader and
  save, each name written placed on the hand it was written for (`faceRollChoices`), so the day holds what the same roll pasted
  gives: the marks the roll's (`src: 'relay'`: the next roll updates them, *Read the rolls again* reads it), the EXTRA rows, the
  blocks' crews. **It is read exactly as written** (`parseRelayRoll`'s `exact`, for every roll with `face`): a heading's lesson learnt
  from the owner's correction of a pasted roll would move a pick (on the owner's book an evening *VAT A1* had been taught to read as
  three areas). A block on the barrel unit reads as its pickling side, as a paste does (one unit of five to the reconciler). The roll
  is kept naming who wrote it (`relayPastes[].face`); the same roll pasted later is refused as saved before, a save with nothing
  changed says so, and *Send to the group* and *Copy* send it as written. **Saved again, it restates the day**, where a roll pasted on
  top only adds (a hand taken off a block, an EXTRA cleared, stayed): the day is read again from its rolls with the new roll in the old
  one's place (*Read the rolls again*'s reading, the new roll `fresh` so it is recorded), what was typed by hand kept and the day as it
  was logged with why; the old roll is kept, `replacedBy`, so it is refused if pasted and never read again. A hand marked absent
  leaves every block. **The in-time roll restated after the face's out-time roll works that one out again with it**: who went home
  was worked out from the places, never written, so a hand now absent is not sent home at five (the blocks and own times stand; a
  pasted out-time roll is the supervisor's text and is read as written). **Stock** stays Stock's own form by hand: the duty's step
  opens it.
- **Measured on the owner's book** (the 37 recorded days since 1 Sep, a scratch harness never committed): each day's rolls written
  on the face from the day as it stands and saved unchanged. The out-time roll changes nothing on any day (314 marks the same, 244
  typed by hand kept, every EXTRA row the same); the first build, with one line a block, block ends to midnight and no own times,
  changed 11 days and 40 marks. The in-time roll changes 3 days, each one the stored day contradicting itself: three hands on a 6 AM
  block whose marks said 8:30 on no line (the face reads the block), a hand marked absent on a block (left off it), and a line's
  EXTRA booked twice, 8 h and 8 h (one 16 h row: the same hours).
- **A barrel batch** (F3): the barrel (the plant register's barrels, else its number typed), the client and part as a load has them,
  the figure, in and out, rework. A `plated` entry on the barrel line, `basis: 'register'` (the register the barrel never had), with
  `unitId` or `barrel`, `to` and `msgHash`: counted over the supervisor's relayed list for that day, which reads *also reported*. Its
  message is the day, *BARREL 2: 9:30 AM - 10:30 AM*, the client, the part and figure. A batch over a quarter heavier than its barrel
  takes (the kg a round typed on the unit, else the median of five or more of that barrel's own batches) is asked (`heavy`, amber).
- **The register clerk's VAT page on Mine** (F4, P202): a page per line and day as the register keeps it (`faceVatHtml`): VAT A1 a
  round a row (its time, the figure as written), VAT A2 a batch a row (when it began and ended, the figure at its end: the register's
  START and END; a start left blank began where the batch before ended), *Rounds · Batches* for a page kept the other way (a round's
  time is a batch's end). The client and the part as the floor names it (the floor's names and the client's challan parts offered)
  appear only where a run begins, the rounds under it carrying them as the paper's ditto; *Another client or part* on the last round
  begins a run, and a run's part changed moves the rounds under it that were the same. Two clients in one round are a row each at
  the same time. **Read by the register's own reader** (`faceVatRead` → `prodFromRegisterRead`, `prodRackCheck`; the client picked goes with its id,
  `clientId` on the row, so a run is that client whatever its name reads as, its gauge and part rules included: *M & M AUTO* and *3M
  ENGINEERING* had read as no client and saved with none): the figure
  added up as the register means it (*3+4×156* is seven racks of 156, *96×7+5*), the START rule, the gauge, part and series rules,
  the shift's edges, a round its line has not run, the day total written against the rounds; each row says what was read under it,
  a run what it was read as. The rows redraw around the field being typed (`faceVatRedraw`, People → Day's way), so a tap on the next
  field lands. The face opens on the line with nothing recorded that day, else the one being typed (`?tab=pageFace&v=vat/vat-a2`).
- **Kept on the phone until the page is saved** (`sep_inv_face_page`: a page per person, day and line; dropped a fortnight unsaved;
  *Start again* / *Put back as saved*), since a page is a day's rounds and a save at every round would void a run at every next one;
  Mine's step says a page is typed and not saved. **Saved**, its runs are a register page's (`plated`, `basis: 'register'`,
  `lineSrc: 'written'`, the rounds) with `src: 'face'`, `pageId` and `msgHash` (the page's message, *Send to the group*), and the
  page is kept (`production.pages`: date, line, style, the rows as typed, the total written, who, the reader's fingerprint). **Saved
  again, it puts right what changed**: a run whose rows read as before stays (its id, whatever the owner set on it), a changed one is
  voided (*The page was entered again on Mine*) and its reading added, and the page before is kept, `replacedBy`. A page with a run
  the owner corrected or voided in Production is the owner's: saving it again is refused, saying so. A figure the reader cannot add
  up is refused at Save, never saved as nothing.
- **A page a photo also holds is warned**: on the face before it is entered and at its save (*Count the day twice?*), where a
  photo read before 13 Oct 2026 holds that line and day (the photo's own check went with the photo reading). Register runs of
  one line and day from two sources both count, so the warning is the guard.
- **The power log is the day's**: a cut saved at once from the page (cut at, power back if it is), one log a day whichever line's page
  (`logId`: two close cuts in it are two, a cut the pickling message also sent is one), the day's cuts from every record listed with
  *Power back* or *Why* (the cut's completion, `pcsOpen`). On Mine's *What you entered* a cut is said as a cut (`faceCutRowHtml`: its
  times, *Power back* or *Why*), never a load's message or Correct: Correct had opened the load's form on it, and a load saved there
  took the cut's place.
- **Its checks** (`faceChecks`): `rack`, a round of a size its part never ran at on its line before the page's day (three rounds or
  more on record; half the usual rack on VAT A2 is the line's own way), and `total`, a page whose day total written the rounds do not
  meet (a run put right counted as put right).
- **Measured on the owner's book** (the 23 register pages since 23 Sep, a scratch harness never committed): each page retyped on the
  face from its own saved rounds reads exactly as saved on 19 (every client and part's pieces, the rounds, the hours). Three hold a
  run with no client written, which the face asks for; one splits a figure for two codes by what is open on their challans, which has
  changed since.
- **The clerk's attendance sheet against the supervisor's roll** (F4, P202): the sheet is People → Attendance → Day as the sheet (the
  duty opens it), and every mark typed on the day now carries who typed it (`by`, with the guard on, `_attHandEdit`, *All present*'s included). Each hand the
  clerk marked is set against the day's saved rolls read alone (`relayRollsReading`: relayPlan `bare`, nothing on the day beside
  them): present on one and absent on the other, a half day on one, another line (where both name one; the barrel and its own
  pickling one place, which the roll writes either way), or present with the rolls naming them nowhere (`faceAttDiffs`). The
  sheet's mark stands (a roll never writes over a mark typed by hand). Said on the hand's row and over the day, on the clerk's Mine
  (*N differ from the roll*) and to the owner (To-do `faceAttRoll`, one task a day); the owner rules a hand at a time, in its day:
  **Use the roll's** (the roll's mark on the day, the roll's again) or **Looks right** (`rollOk`, against both readings it was
  given, the roll's and the sheet's: a roll saved later that reads otherwise, or the clerk changing the mark, asks again). Which is the day's truth stays the owner's (ENTRY_FACES §8).
- **Measured on the owner's book**: the 55 marks typed by hand on the 25 days since 1 Sep with rolls, as the clerk's sheet: 8
  questions on 5 days, 7 another line and 1 not on the roll, none present against absent (15 before the barrel and its pickling were
  one place and a sheet naming no line was let pass).
- **The sheets on paper** (F5, `facesheet.js`, P203; owner: *"Every one will have an option to print out their sheets as well, if they
  want to fill in manually and file it in my table"*). Mine's *My sheets* prints the blank sheet of each duty the person enters, in the
  day's order (**Print my sheets**), and **Print the day as entered**, to file (offered only when the day holds something for one of
  them): the roll front and back and the attendance sheet (attsheet.js), the stock message and the stock as entered (stocksheet.js;
  as entered with its bills and prices only for a role that sees money, else the stock message filled: a face never prints a money
  figure its role does not see), and three new ones on the same page styles (`FSH_SHEETS`), each one A4 sheet (measured at the sheet's width under print media, and a
  PDF of as many pages as sheets):
  - **the pickling sheet**: a load a row (into the tank at, client, part and gauge, quantity, NOS / KG, re-pickled), and Material in
    under it where the face counts what comes in (the challan, the part, what was counted);
  - **the barrel batch sheet**: barrel, client, part, quantity, in, out, rework;
  - **the VAT register pages**: VAT A1 a round a row (the figure as written), VAT A2 a batch a row (began, ended); the day total
    written and what the app counts; the day's power log with why each cut came.

  Filled, a sheet is the app's record of the day, whoever entered it, each row saying through which door (Mine and who, WhatsApp
  and who sent it, a register photo, by hand); a voided or corrected record never reaches paper. A VAT page entered on Mine prints as
  typed (the paper's ditto under a run's client and part), unless the owner voided or corrected one of its runs in Production
  (`faceVatTouched`): then from the runs the book holds, with the day total written; a day read from a photo or a message prints its rounds as the page wrote
  them (the register's *1:05* is the afternoon, never turned into 1:05 AM). Production → More → **Print sheets** prints the floor's
  three for any day, blank or as entered (a sheet with nothing entered is left out, and the toast says which). The roll filled on
  Mine says *As entered in the app*, not a worked example (`attSheetShyamHtml`'s `note`). Printing writes nothing to the book.
- **The guides** (F6, `kbguides.js`, P199): *Using the app: my screen (Mine)* (`app-mine`: the day, the steps, what was entered,
  Correct and To check, the group, the paper, GitHub), one a face (`app-face-pickling`, `app-face-supervisor`, `app-face-clerk`:
  every form as it is on the screen, and what the owner is asked), and the owner's *Setting up each person's screen*
  (`app-faces-owner`, `roles: ['owner']`: Enters, Devices, See their screen, what reaches the owner). All link to Mine, so its book
  lists them. Each role's path (`KB_APP_PATHS`) leads with Mine and the face a hand of that role is most often given (floor: the
  pickling hand's; supervisor: the supervisor's and the clerk's; office: the clerk's). *Using the app: production* is version 4
  (Print sheets); *Using the app: the register clerk's screen* version 2 (how a round and a batch are written, and a page a photo
  holds, moved there off the page); *Setting up each person's screen* version 2 (a face's entries need the role's Floor entries). Training shows a path's first five lessons, the rest one tap away (P195's budget for Training held).
- **The flow thread** (T1–T3, `flow.js`, P204; owner, 10 Oct 2026: *"Target default one day, can be edited as per material or overall as
  well. Say, they ask for a particular material to be done on a priority basis - we can plan that out"*; *"Mehta 7 days - as we give 2%
  discount, every other client 45 days"*).
  - **The targets and terms** (T1). A turnaround target from a challan's day to its despatch, in working days (Sundays out; despatch is
    the invoice's despatch date, else its date): the plant's (Settings → Checks & alerts → Turnaround and terms, `S.flowCfg.turnDays`,
    1; 0 is the same day), the client's (`client.turnaroundDays`) and a part's on the client (`client.turnaroundParts`, by `rateKey`), the
    part's winning. Payment terms from the invoice's date: the plant's 45 (`S.flowCfg.termsDays`) or the client's (`client.payTermsDays`).
    Both on the client's form (*Turnaround and terms*). The client whose name reads Mehta is set to 7 once, where it has none
    (`_clientTerms1`). **A challan wanted by a day** (`priority` on the challan, or on a line, which wins): *Wanted by* on the challan
    form and among a challan's actions (a dialog, the whole challan or each open line, a line's own day drawn while it has one, a lone
    open line's too); a day before the challan came in is refused, on the form and for a line; the challan is badged while anything on
    it is open, at the earliest day an open line is held to (its own, else the challan's: *Wanted 12 Oct*, blue ahead, amber on the
    day, red after).
  - **The tasks** (T2). `flowLate`, per client: challan lines of the last 30 days past their target, red two working days past, in
    quantities, never rupees, saying where they stand by In plant's reading. *Waiting to pickle* is said only where the floor's record
    covers the month, as In plant withholds it; under that, *with no floor record*. `flowPriority`, per challan: wanted by today or
    before with no plating recorded, amber on the day, red after, saying how many working days late once one has passed (wanted by a
    Saturday and read on the Sunday, the day alone). `owed90` reads each client's terms where it read 90 days; its id is
    kept, so a switch or a snooze set on it stands, and its fold and its move say *past its terms*. Three or more fold (`TODO_FOLD`).
  - **The flow on screen** (T3). Floor's Overview's fifth hero, *Turnaround*, for a role that opens Production, shut to its line: the
    plant's median working days from the challan to despatch, weighted by value, against the target, and the share of the value back
    within it. Open, it shows the challan to its first pickling and plating (In plant's attribution) and to despatch; the invoice to
    its payment against the terms (a role that sees money); the lines past the target now (red, the card with them, where one is more than two working days past, as the task); the jobs wanted by today. Its door is In
    plant. A client's page (the pane, the phone's sheet, Performance) shows the same steps, then:
    - each open challan's expected day back: the client's usual turnaround (the plant's under five despatched), or later where the
      work ahead of it on its usual line, at the line's pace, says so; *Late* past its target, red two working days past;
    - each open invoice: past its terms (red; amber while a receipt is unplaced, as owed90), slower than its client's pace (the book's under three receipts), or expected.

    **A hero alone on the last row takes the row** (styles.css), so a grid of heroes never ends in a blank cell.
  - **Measured on the owner's book** (10 Oct, counts only):
    - 1,587 challan lines in 90 days, 1,562 despatched, back in a median one working day, 71% of the value within the one-day
      target;
    - to pickling 1 day (12 lines with a load set against them) and to plating 1 (86); the plant's days to pay 34 (30 receipts);
    - seven lines past the target now, in 2 tasks. The floor's record covers 4% of line-days in the month (the barrel 1 of 27),
      so none is said to be waiting to pickle;
    - the owed task went from 4 clients over 90 days to 10 past their terms, 2 of them red, the rebate client's 7 days among
      them.
