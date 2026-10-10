# Next session — SEP Invoicing (Session B of four)

**Set by the owner, 24 Sep 2026.** This repo is worked in its **own session**. A separate
**compile session** (Session D) attaches all three SEP repos and reconciles their data. The model
is described once, canonically, in `soma-internal/docs/CROSS_REPO_SESSIONS.md`. This file
carries **this repo's side** of it: the work queued here, and what this app produces and consumes.

---

## Being built 9–10 Oct 2026: the tab map, step by step (PR #146, read this first)

The owner, 9 Oct 2026: *"Merge and go with all 14. E2E. Be thorough, run QA chain before final merge, merge once CI is green."*
`docs/TAB_MAP.md` is built in one PR, a step a commit; its §0 says where it stands.
- **TM1**, the shell: the rows, History and Knowledge as tools in the top bar, Sales, Parts, the redirect table, the toolbar's
  Filter and More, one look's pieces (the verdict card, the row end), and the instruments (P184, P195, P197).
- **TM2**, Today: the To-do into Needs you, Pulse takes Stats → Overview, Stats' three tabs led by verdicts, the Planner's Moves,
  Reports fitted (P185). **The owner looked at it** (10 Oct 2026: *"Go ahead"*).
- **TM3**, Money: five tabs (the bills to Payments, the credit notes to Office → Invoices → Credit notes), **cheques received
  counted as paid until their deposit**, and Money's screens in one look (P186, P187).
- **TM4**, Floor: one Overview (four heroes per role, the line cards worst first); People is Attendance (Day · Week · Month) ·
  Pay · Areas · Roster; Production is Lines · In plant · Entries · Equipment; Stock is one screen; Power is Cuts · Causes ·
  Load & bills · Case; every Floor screen led by its verdict card, the old Overview addresses redirected (P188).
- **Asked by the owner on 10 Oct 2026, next, before TM5** (the order put to the owner, theirs to change):
  1. **A past day corrected where it is seen** (*"corrections and comparisons are missing"*): **built (P198)**. Floor → Day's
     line card opens Production → Lines on its line and day; each run and pickling load there opens to what it holds, its Correct
     and its Void; a correction goes back to that day; Enter by hand from a day stepped to starts on it and its line; Entries opens
     on a day (Lines' More → *Every entry of this day*, or Entries' own Day filter).
  2. **Pay history** (asked the same day, before the salary run of about 14 Oct): *"no way to see and print the pay slip of each
     employee and/or what they have been paid"*; August's two salaries went to each other's accounts and the gate hand's ruled
     figure was paid short, to be adjusted in September's pay. **Built (P205)**: the bank's salary legs count as paid, a slip month
     is set against them rather than read as settled, monthly balances carry from a month the owner sets (each month named on Pay
     and the slip), each hand's history, and any month's slips. September's figures were also handed to the owner as a local file
     (never committed), with 17 Sep a paid holiday (owner, 10 Oct 2026: *"make sure the holiday of 17th Sept stands as payable for
     each employee, as it is a paid holiday"*; in the app, `2026-09-17` under Settings → Labour → Paid holidays). **Owner's, once
     merged**: import the slips file (`sep-payroll-paid`, April–August, August as the ruled revision), set *Count from a month* to
     August, the gate hand's monthly wage, and tie the bank name of one hand's account (another person's name) to them once.
  3. **The day's earnings and the line over time** (`docs/PLANT_PICTURE.md` PP2): *"As we are calculating production, why don't we
     calculate the earnings?"* **Built (P206)**: each line card says what it earned, coloured against what a kilo costs, with its
     usual day; Lines carries an Earned tile and the change lines, the week against the four before and the week's earnings; the
     day card the earnings against the live cost and what no rate prices. The efficiency's week grid is PP2's rest.
     **Also built the same day, from the week of 4 Oct's payout (P207)**: the weekly payout carries the snacks by the owner's rule
     (₹20 a person regular OT, ₹60 past midnight); Pay names a hand on an OT block their own times do not reach (*Hours to check*,
     To-do `payCrewGap`); the roll reader takes a numbered line with no bracket (`14 NAME`). The week's reconciliation, given to
     the owner: by the WhatsApp rolls ₹34,612.50 (711 h and ₹840 snacks) against ₹34,000 paid; the supervisor's sheet multiplied
     694 hours where its rows add to 701, left a Sunday's 8 hours out of a total, kept a corrected cell's old total, priced the nights'
     snacks at ₹40, and differs from his own rolls on two hands and three days' EXTRA. **Proposed, the order the owner's**: the week's
     sheet as paid (entered or photographed, cell by cell against the day and its own sums, the paid figure the week's payout as
     paid, as the payroll slips are for a month).
  4. **Suppliers**: what we owe each (the owner keeps it on paper: an opening, each bill with GST, the payments), and each
     supplier's lead time in the reorder list (the local ones the same day; one cheaper, three to four working days away).
     **Built (P208)**: Money → Payments → Suppliers, each supplier's balance from a figure off their statement (the bills after its
     day with GST, less the payments after it), the payments recorded here (a cheque handed over counted once, when the statement
     clears it by its number), the lead times, and the reorder list choosing the cheaper supplier when it can deliver before the line
     runs out, the fast one when it cannot (CLAUDE.md *Suppliers*). **The owner's, once merged**: set each supplier's balance from
     their statement (the September page sent: its balance after its bill of 9 Sep), the lead times (three the same day, one 3–4
     working days), tap *Same supplier* on the payee offered by its initials, and look at the three bill numbers each on two days.
     **Then asked (owner, 10 Oct 2026): *"When ordering stocks let's have an option to select and compare between suppliers, pros and
     cons"*. Built (P209)**: Compare suppliers, under each line on the reorder list and on a line's page: every supplier of the line as
     a card (price and what it rests on, lead time against the days left, this order's amount, what is owed, for and against in words);
     Order from them keeps the choice on the line, the app's own said beside it; a price quoted weighs a supplier that never sold it
     (CLAUDE.md *Suppliers*). **The owner's**: add the Kolkata supplier's quotes where it has not sold a line yet.
  5. **The entry faces** (`docs/ENTRY_FACES.md`, written after TM4): each hand enters their own on their own phone. **F1 built
     (P199)**: duties on a user (Settings → Access → Users & access → Enters), their screen Mine, landing on it at sign-in, its steps
     opening where each duty is entered, what they entered, their sheets and whether it reached GitHub; Today says who entered an
     input. **F2 built (P200)**: the pickling hand's forms on Mine (a load, material in), the group's message and its key, Correct,
     the checks against what each entry links to (To-do faceCheck, Production → Entries → To check, Looks right), and a second
     matching pass for a named load. **Next**: F3 the supervisor's, F4 the clerk's, F5 the sheets, F6 the guides; then T1–T3.
     **The owner's, once merged**: give each person an ID and their duties.
- Then: TM5 Office, TM6 across the app, TM7 the docs and measures; then the QA chain, CI green and the merge.

**Data flow (10 Oct 2026, P208, suppliers):** two new top-level stores, `suppliers` (what the owner set on each: name, other
spellings, lead time, GST, the balance on a day, totals as printed) and `supplierPays` (payments recorded here, voided with a reason),
travel with the book, in the change log and the merge, and **in the `sep-stock` export** (merged by id on import, never written over).
**Data flow (10 Oct 2026, P199, entry faces F1):** a user may carry `faces` (the duties they enter, a list of words); it travels with
the book's users (backups, GitHub, the compile), and nothing else changes: what a face enters is the records the forms already write.

**Data flow (10 Oct 2026, P200, entry faces F2):** a load or a count entered on a face is a production entry as a paste's is, with
`src: 'face'` (a new source word), `by` the person and `msgHash` (the key of the message it gave the group); a count against a challan
carries `imId`, `imItemId` and `challanNo`; an entry the owner kept as entered carries `checkOk: {codes, at, by}`. All of it in the
`sep-production` export, merged by id as before; the compile reads a face's entry as it reads a paste's. The matcher's second pass
changes which line a load is inferred to (shown, never stored, never exported).

**Data flow (10 Oct 2026, P209, compare suppliers):** a stock line may carry `orderFrom` (the supplier chosen for it) and a supplier's
record `quotes` (prices quoted, a line each); both in the `sep-stock` export as part of the items and the suppliers.
**The statement reads differently**: the bank's guess compares a payee with "&" as AND and with every spelling a supplier was given, so
a payment once read as Other (not yet sorted) can now read as a supplier's; the `sep-bank` export's resolved category for such a row
moves with it, and so does the live cost's month of supplies, which speaks only once nothing in it is unsorted.

**Data flow (10 Oct 2026, P207):** `labour.snackOt` and `labour.snackNight` (₹ a person, regular and night overtime) travel with the
book; the weekly payout (`payWeek`) now includes the snacks, so the bank's cash split counts that much more of a week's cash as wages
and the payout's forecast and median carry them. Nothing exported changes.

**Data flow changed (TM3):** `bank.cheques`; the `sep-bank` export carries it, and a `sep-bank` file is now taken in (Add → File),
its cheques merged by id. The table below has the detail. **The pay history adds one key**: `labour.payCarryFrom` ('YYYY-MM', where
monthly balances start), travelling with the book; nothing exported changes, and the bank's salary legs are read, never stored. **TM4 changes none**: no key, no export, nothing in the book moved; the
device keys `sep_inv_prod_tab` and `sep_inv_power_tab` read a remembered `overview` as the first view.

## Built 9 Oct 2026, the second: a register run's start, and a file at the wrong Import (read this first)

The owner sent the day's two register pages to be made into an import file; Samarth's batch on VAT A2 is written with its END
and no START, and the reader saved it as 11:45 to 11:45. Asked, the owner: *"Yes, fix the reader"*. **A run that opens on an END
starts where the batch before it ended** (the last END above it on the page), whether no START is written for it or its gauge
split it from its START's run; with none above it, its start is amber. Runs saved before the fix, from a photo or a file the
reader built, are put right at start-up from the END before them on their page (`startWas`): four on the owner's book. P85
pins both and fails on the build before. **Data flow changed:** a plated register entry may carry `startWas` (the row below).

**The spec was revised for one look** (owner: *"UI still feels inconsistent to me … we need to plan properly"*): `docs/TAB_MAP.md`
§3e (four kinds of screen, one anatomy each, the verdict card, P197), §3d (every screen's kind and what its verdict card says),
calls 9–14 in §1a for the owner, TM1's new pieces, TM6f, and a stop after TM2 for the owner to look.

The owner then imported that file on Production → Equipment, which takes the plant register, and was told *Not a plant file* with
no way on. **Every screen's Import now names another screen's file and offers Import it there**, through Add → File's route and
guard (`addFileElsewhere`); Add → File takes a knowledge file too, and Power's import counts cuts apart from other entries. P196,
failing on the build before. No data flow changed. Still the owner's: everything left under the section below.

## Built 9 Oct 2026: production read whole, stock by line, one spec for the map and the load

PR #144, from the owner's messages of 9 Oct 2026. CLAUDE.md has each part.
- **Production typed as text** (P189): a slot a line (*"5 pm - 8 pm - Mehta clamp … = 1006 nos VAT A1"*) is its own kind of
  message, read as runs.
- **A day's plating, whole** (P190): every run weighed by the surest route; the day one card in tonnes; Floor's line cards coloured
  by each line's efficiency; the pieces not weighed a follow-up list.
- **The tank's round and the register's pace** (P191), measured from the register and used once firm. The efficiency splits into
  time, racks and parts, drawn as tiles. Mehta's default weight is 0.560 kg a piece; their round of 108 and their liners' rounds
  are the owner's answers.
- **Stock by line, PP3** (P192): the bath a stock message names is read, a use per bath on its own day, and zinc and chemicals are
  set against what each line plated.
- **Analysed figures drawn one way** (design §6.27): the verdict, its factors as tiles, the working folded.
- **One spec, `docs/TAB_MAP.md`**: the tab map (TM1–TM4) and the cognitive-load survey's fixes, combined on the owner's word
  (*"Combine them into one spec"*), in seven steps. **Not built.**

**Left for the owner:**
- On Stock → To check, *Use the new reading* on the 25–28 Sep zinc message and the 4–6 Oct 16 Salt message, so their uses are split
  by bath.
- The order of PP2, PP4 and PP5 (`docs/PLANT_PICTURE.md`).
- The calls the spec makes (`docs/TAB_MAP.md` §1a, 1 to 14; 9 to 14 are one look's), and the word to build it.

**Data flows changed:** stock entries gain `lines` (`sep-stock`); production gains `seriesRules` and `gaugeRuled`
(`sep-production`); a client may carry `defaultKgPc`. The table below has the detail.

## Built 8 Oct 2026, the fourth: Office's Insights in sight on the phone (read this first)

The owner, after the third merged: *"Insights seems to be missing on mobile?"* It was there, out of sight: Office's row is twice a
phone's width, and after Clients only half of "Stats" showed, with nothing naming what lay beyond. **The group's name heads it**
(`inv-viewtab-group`): sticky at the row's right edge until the group comes into view, so Office opens on *Pipeline Challans
Invoices Clients Insights ›* at 393 and at 360 px; a tap on the name brings the group in. **A page's own tab row that runs past
the screen fades** on the side with more (People's seven views, the Planner's eight). P183 pins both and fails on the build
before. **No data flow changed.** Still the owner's: the order of the survey's steps, and Pulse's defaults.

## Built 8 Oct 2026, the third: five doors, the rail, Insights in Office, raised tiles

The owner, on the same PR: *"The bottom bar still doesn't look right. Let's give our tiles elevation as well. Move insights into
office tab, that way we have 5 icons again, which can be arranged in a better way. Also, in the desktop view we have many tabs that
are actually tabs that exist under a different tab but it is there on the sidebar which I feel is the wrong design choice as user
will not understand the hierarchy. What do you think?"* **Three levels, the same on both layouts** (design §4): a workspace is a
door on the phone's bar or the desktop's **rail** (the bar stood on its side, 5.5rem: the mark, Add, Today, Office, Floor, Money,
Settings), and nothing under it is listed there; its views are the tab row **under** the top bar on the desktop too; a page's own
views the row under that. **Insights is Office's group** after Clients (Stats, Reports, Planner, History, Knowledge); G then I
still opens Stats. **The phone bar**: five doors of one geometry (a mark over its word, the words on one line), Add the filled
centre one, never raised; the page fades into its own colour under it. **Tiles are raised** (`--shadow-tile`, DR-6 amended),
deck cards too. P182 pins it; P134, P58, P53, P100, P103, P132, P139, P140, P151, P154, P164, P39 and P42 follow the new doors.
**No data flow changed.** Still the owner's: the order of the survey's steps, and Pulse's defaults.

## Built 8 Oct 2026, the second: HR-9 no white, Today's coded boxes, Pulse as cards, the dock (read this first)

The owner, after #141 merged: *"In needs you and pulse, the boxes inside the cards are still just white instead of colour coded
gradients, we will be avoiding pure white everywhere in the app, this should be an HR. Then we will extend this UI to other tabs
sequentially … Pulse still holds generic cards as well, so it looks like a half designed space"*, then the phone's bottom bar
*"doesn't look quite nice with how the app is designed now"*, and a survey of every screen against the cognitive-load rules.
**HR-9** (CLAUDE.md, design §3.1): no fill lighter than OKLab L 0.97; every palette's light ramp a tinted step down, measured;
the app draws its own tick boxes; P76's sweep enforces it on every screen, view and dialog (it now sweeps Pulse, which it never
reached), P180 proves the instrument. **Coded fills** (design §3.3, §6.26): `--tone` / `--tone-bg` on a block, the card, its boxes
and its controls mixed from them. **Pulse**: every widget a hero. **The dock** (design §6.1). **The survey** (owner's ask):
`docs/COGNITIVE_LOAD_SURVEY.md`, every screen on both layouts scored against the rules (61 views), with what this PR already
changed on Today (the cash question judged as the Money card is, the phone's inputs card folded while a red task waits, a task
group's figure *at stake*, the recent invoices' head saying what was made today) and **the proposed order for the rest, one PR
each: the owner's to set**. One call in it is the owner's alone: Pulse's default widgets could drop To-do and Recent invoices,
which Needs you already shows. **No data flow changed.**

## Built 8 Oct 2026: power causes, Today as cards, the .xlsx statement (read this first)

Three asks of the owner's, one PR. **Power causes** (`powercause.js`, P177): a cut saved with no time back is completed where it
is shown (Power, Production's entry, Today, the To-do), with why it went, where it hit and what brought the power back; the reasons
and fixes are a list the book keeps, written one way however they are typed, read for the plant on Power → Causes and the plant
register, and two To-do rules. **Today as cards** (design §6.21–6.25, P178): Needs you and Pulse are hero cards filled in their
status tone's gradient, the tasks decks of cards, the inputs steps, packed on the desktop; the sidebar's name and mark open Pulse.
**The bank statement** (P179): a two-page statement's page foot no longer stops the import, and the same statement saved from Excel
as .xlsx is read. CLAUDE.md has each. **Left for the owner:** import the 8 Oct statement (either file); complete the cuts the To-do
lists, so the causes start; the owner's own merge of near-duplicate reasons as the list grows. **Still queued:** Home hover previews;
links on an area card and a production run; paths edited in the app.

## Built 7 Oct 2026: statements of account and pay slips (read this first)

The owner picked two of the updates put to them (*"Start with 1 and 2"*): Finance → Receivables → a client → **Statement and
reminder** (`statement.js`, P173) and Staff → Pay → **Pay slips** (`payslip.js`, P174). CLAUDE.md has both sections. **Left for the
owner:** fill Settings → Business → Bank details (printed under *Payment to*) and each client's mobile (the reminder's WhatsApp number);
import the latest bank statement before sending a statement. **Built next** (*"start with 3 and 4"*): G4, the merge (`merge.js`, P175)
and the prospects list (below). **Still queued:** Home hover previews; links on an area card and a production run; paths edited in the app.

## Built 5 Oct 2026: the knowledge base (read this first)

Insights → **Knowledge**, and the book in the top bar on every screen (`docs/KNOWLEDGE_BASE.md`; CLAUDE.md, *The knowledge base*; P154).
**What the owner should do:**
- **Import the first content** (Knowledge → Library → Import): the private `sep-kb-2026-10-05-r2.json` handed over in session (it replaces
  the first file, audited the same day: 51 corrections, `corrections-r2.md` beside it), 142 drafts written
  from soma-internal (60 rulings, 24 client requirements, 14 parts, 31 process, 13 faults) and three training paths. Every article is a
  draft with its source (`srcRef`): read each and **Publish** it, edit it, or delete it. Start → *Drafts to review* lists them.
- **Questions the drafting left open** (each said in its article): whether caustic is a stock line; Q558's line (barrel or VAT); the 47
  brightener on the barrel; the barrel opening recipe (one message of 9 Sep); safety points marked *general practice, not yet confirmed at
  SEP*; blisters, burning and colour causes (general practice: no case on record); Dilip's override; Tina's weight (1.0041 against
  1.026 kg); Khetan's rate change date; Sambhu's monthly tier date; whether the gate bands apply to Sambhu.
- **Make a recovery code** if the guard is on (unchanged from 2 Oct).
**What is left in the queue:** the chatbot (the owner's next ask: which AI, its key and cost, and what may be sent out); links on an area
card and a production run; paths edited in the app; G4, the merge; Home hover previews.

## Built 2 Oct 2026: the QA chain over 1–2 Oct (read this first)

Six audits of everything built on 1–2 Oct, then the fixes, each with its spec (P149–P153; CLAUDE.md, *The QA chain of 2 Oct 2026*).
**What the owner should know before using it:**
- **Only the owner replaces the book**: a backup imported and a pull from GitHub need the owner's ID, and where the incoming book's
  IDs differ the owner is asked whether to take them. The Imports switch now covers the floor's files (stock, production, power,
  a roster).
- **The owner's own PIN is changed with the PIN itself** (*Change my PIN*), or reset from the lock with the recovery code. With
  the guard on and no recovery code on record, **make one now** (Settings → Access → Users & access → New recovery code): a
  forgotten PIN has no other way back.
- Wrong PINs lock the ID they were typed for, not the device.
- An invoice's state (Mark printed, dispatched, delivered, filed; Not printed) asks as an edit does; Print still marks Printed in one tap.
- An area's complement on Staff → Areas is the owner's (a Settings change).
- An item rate override prices only lines in its own unit; a line in the other unit is at the client's own rate and says *Another unit*.

## Built 2 Oct 2026: UX overhaul 2, step 7

The desktop's list and pane on Finance → Receivables, Production → Entries, Staff → Roster and History, and three columns on
Pulse, Stats and Finance above about 1,600px (P147; CLAUDE.md and `docs/UX_OVERHAUL_2.md` step 7). **Every planned step of UX
overhaul 2 is now built** (3, 4 and 5 came with Direction B's search, keys and new windows). **What is left in the queue:**
- **G4, the merge** (`docs/GUARD.md`): waits, by the owner's plan, until more than one person enters data on their own device.
- **Home hover previews** (parked below): the owner called them a planned UI update; not started.
- **The Android To-do widget** (needs a native wrapper) and moving `S.todo` to `sep-dashboard` when that app is ready.
- **The owner's own checks** listed in each section below (a real day of production end to end, a register photo through
  Gemini, the power quotes, the quotation series already issued by hand).
- **The owner said they have more asks queued** (30 Sep 2026): ask what is next.

## Built 1 Oct 2026: quotations and reports (read this first)

Clients → **Quotations** (P131) and **Reports** (P132); CLAUDE.md has both sections. **Left for the owner:** the series already
issued by hand (001–005) is not in the app — before the first quotation issued here, record those numbers or the app starts at 001
again (see the Quotations row under *This repo's side*); set the signatory and foot note in Settings → Business → Quotations; print
one quotation and one report from the print dialog (`page.pdf()` cannot see the dialog's headers).

## The owner's list of 30 Sep 2026, built (PR #118, read this first)

All seven items and the per-hour follow-up, one commit each (CLAUDE.md has each section; P117–P121):
1. Forms entered several at a sitting stay open (Production and Power by hand, Stock by hand, challan *Save, add another*, bills,
   recorded credit notes, Pay, Sort). 2. Part-invoiced challans show what is left to bill. 4. Stock by hand lists the day and corrects an
   entry. 5. Client performance: one part however spelt (`cpPartIdentity`), Materials worked, shared codes, **By the hour** (pickle + plate +
   15 min, measured from the register and the pickling loads, trend and what to look at). 3. Staff → Day as an area board, Civil, the
   allocation by area. 6. Stats' Overview as question-led story cards. 7. Home widgets with presets and Edit Home, per device.

**Left for the owner:** check the timing of Samarth's parts once a register photo with their rounds is read (the book to 11 Sep has no
production record, so nothing is measured yet); the 15-minute constant is theirs to change on the panel.

## Where session B stopped — 30 Sep 2026 (read this first)

**Merged, both on the owner's go-ahead, 30 Sep 2026:**
- **sep-invoicing #116 → `8036c9b`** (build `b27a9119`):
  - the QA sweep (P104–P113);
  - the owner's six rulings (P114);
  - **Power** (P115, `split/power.js`);
  - **deleting an attendance day with a logged reason** (P116). A start-up pass moves the book's day saved under
    `"null"` (23 marks, 5 EXTRA rows) to `S.attendanceDeletes`.
- **soma-internal #118 → `4f1993e`:**
  - `reports/power-cut-case-2026-09-30.md`;
  - `analysis/sep-power-history-2026-09-30.json`;
  - `decisions/2026-09-30.md`;
  - tasks T-BD and T-CZ notes, and new T-IE and T-IF;
  - the routing row `analysis/sep-*.json` → the content Governors.
- **The history JSON was handed to the owner** to import (Power → Cuts → Import history).
- **Branch:** `claude/gracious-dijkstra-pzfv6u` was reset onto `origin/main` in both repos after the merge. New work starts
  from there as a new PR.

**The power case on the real book** (`soma-internal/sep-invoicing-data.json@18c6b2e` with the history imported):
- **Damage on record: ₹77,528.**
  - ₹48,000 is restarts at the 30 May estimate of ₹600 a cut, **not measured**.
  - The measured part is ₹29,528: platers' idle wages ₹14,705, contribution never made ₹7,565 (6%, the lower of the live
    and typed cost readings) and catch-up overtime ₹7,258.
- **A year: ₹1.8–2.6 L.**
- **Payback:** TSUISL 9–29 months, inverter 18–27, generator 41–58.
- **Audits:** two Governor audits, both AMEND, all folded (Iuno 0·6·7·4; Iuno + Vulcanus + Castor 0·2·4·6).
  **A third look was not run before merge**; the owner merged on their own call.
- ⚠ **soma-internal main has moved to a newer backup** (`6eccb22`, 1,025 invoices). The report's figures are the 18c6b2e
  reading, and a re-read on the new copy will differ slightly.

**Left for the owner:**
- open the app once after it updates (the null-day migration);
- import the power history;
- get the TSUISL and inverter quotes;
- **what a restart actually costs** (62% of the damage is the estimate);
- get the approved 50 kVA onto the bill (T-CZ);
- say whether "about ₹5,000 a month" was read off a bill or repeats the codex's estimate (`decisions/2026-09-30.md` §2).

**Open in the code or the record, not yet done:**
- **Re-audit residues left as stated, not fixed:**
  - `power-cut-log.md:451`'s T-BD date (the file was only appended to, M-7);
  - the year's 36 cuts include one on a worked Sunday (N-8, said in the report).
- **soma-internal T-IE:** power for 23–29 Sep is not yet ingested.
- **soma-internal T-IF:** August's app bill is ₹73,156 against the bank's ₹76,156.
- **The compile session** should read `attendanceDeletes` before calling a missing day unrecorded (data-flow row below).
- **Home's Revenue tile will link to its credit notes** once the hover previews are built (parked, `UX_OVERHAUL_2.md`).
- ~~**UX overhaul 2, steps not built:** 3, 4, 5, 7.~~ All built: 3–5 with Direction B (1 Oct), 7 on 2 Oct 2026.
- **The owner said "We have updates remaining" (30 Sep 2026)**: they have more asks queued for this session. Ask what's next.

**Local scratch checks** (git-excluded `tests/e2e/zz-*`, gone when the container is reclaimed):
- `zz-power.spec.ts` loads `REAL_BOOK` (the soma-internal backup), imports `POWER_HIST` and writes the analysis to `OUT`.
  Run it with `--project=mobile-chromium`.
- The real book is read only locally. Counts and generic figures may be quoted, never names or wages.

---

## The work, in the owner's order

### 1. Visual rate matcher

> **Status, 24 Sep 2026 (session B): BUILT.** Reference fixed (per-client dated piece rates, T-HC),
> ₹0 lines need a reason, and the matcher ships with **option E**, chosen by the owner from five
> rendered candidates: green exact · yellow ×10 · red ≥ 10% or ≥ ₹100 on the line · neutral
> "Differs" below that · grey for no rate / gauge not stated. See `CLAUDE.md` § *The rate on record*.
> The two thresholds are in Settings → Rate Check.

Colour each line's rate against the rate on record:

| Colour | Meaning |
|---|---|
| **Green** | matches the database rate |
| **Yellow** | a **decimal error**: off by a power of ten (₹1.25 typed as ₹12.50, or the reverse) |
| **Red** | a change of **₹0.50 or more** |

**The thresholds are to be settled at the start of the session, on financial impact.** Do the
measurement before fixing a number:

- **A flat ₹0.50 means very different things across this book.** On a ₹1.06/pc bracket it is 47%;
  on a ₹22.00/kg line it is 2.3%. Replay the rule over the invoice history and count how many
  lines each candidate threshold would flag, and what rupee value those lines carry. The owner
  asked for the rule to be set on that evidence.
- **Only a flat rupee threshold leaves a gap between yellow and red.** A line that is off by
  under ₹0.50 without being a decimal error fits neither colour. Decide what it shows.
- **"The database rate" means what `getLineItemRate()` returns**: the client ladder, then
  `itemRates`, then the items master. That function is the one place the matcher should read.
  No colour-coded matcher turned up in a sweep of `split/*.js` for `rate-match`, `mismatch`,
  `expectedRate` and `rateDiff`. **Not found is not "does not exist"**, so check at session start
  whether an older version of this feature lives somewhere the sweep did not reach.
- ⚠ **Gauge-priced clamps will read red when they are correct** unless the match keys on part
  **and gauge**. Five clamp families carry different rates at different gauges (`CLAMP 105X83`,
  `133X83`, `165X83`, `124X77`, `154X81`). This repo's Items Master section counts four; the
  fifth, `154X81`, was added in `soma-internal`'s `CLAUDE.md` on 7 Sep. Its two master rows are
  spelled differently, so match case-insensitively on a normalised stem.
- ⚠ **This matcher will surface T-HC.** `soma-internal` has recorded that the challan scanner
  bypasses `itemRates`. Lines raised through it could read red against a correct per-client rate.
  That is a real finding, not a matcher bug. Fix T-HC in this session, or label those lines.

### 2. Stock inventory tab

✅ **BUILT 24 Sep 2026** — More → Stock (`split/stock.js`, `CLAUDE.md` § Stock). Designed with the owner
from a rendered mockup: paste the supervisor's WhatsApp message, or enter by hand; Stats costs chemicals
from it. Staff, Stats and History moved behind **More** on the phone bar with it.

- **The current record is `soma-internal/operations/chemical-stock-log.md`.** Its latest take
  (Shyam, 22 Sep) lists **15 lines**: zinc, Q558, 16 Salt, 106 Salt, cyanide, Monicol,
  brightener, 65 M, 65 R, A Salt, boric acid, B Salt, spray, nitric acid, HCl. Several carry a
  daily draw rate, so the tab can project days of cover. That projection is what flagged 65 M as
  likely out on 23 Sep.
- **Data comes in through an import door, never committed.** This repo is public. It follows the
  same rule as the roster, which ships empty.
- ⚖ **Stock is owned by `soma-internal`** (owner's ruling, 24 Sep 2026: *"soma-internal will take ownership, that's the private repo where all sensitive data must be transferred when a compile happens"*). **So this tab is a view and an input, not the ledger.** It shows stock and captures entries on the device. Everything it captures is **copied** into `soma-internal` at the next compile session, and **stays on the device and readable in the app**: a compile never deletes anything here. Design the capture so it can be **exported whole**, with dates and who entered it, because that export is the record's source. For this app to take stock over, a later merge PR would have to state so, with a reason.

### 3. To-do widget: desktop and Android (Google Pixel 11 Pro)

> **Status, 25 Sep 2026 (session B): BUILT for Windows, inside this app.** Platform checked: Windows
> 11 takes a PWA widget through Edge's `widgets` manifest member (Adaptive Card; Developer Mode +
> WinAppSDK to install outside the Store); Chrome on Android has no PWA widget, so the phone needs a
> native wrapper. The owner chose: just me, own tasks and data-raised tasks labelled, Windows 11, in
> this app for now, no phone yet. Shipped with Home quick actions and the attendance-roll paste in the
> same release. See `CLAUDE.md` § *To-do* and § *Attendance rolls from WhatsApp*. **Open:** the Android
> widget, and moving `S.todo` to `sep-dashboard` when that app is ready.

A to-do list for Soma, the workplace, shown as a widget on the desktop and on the phone.

- ⚠ **Verify the platform constraint before designing.** As understood when this was written, a
  PWA **cannot** put a widget on an Android home screen. That needs a small native app or a
  wrapper. Desktop is different: Windows 11 supports PWA widgets through Edge's `widgets`
  manifest member. Confirm both, because the answer decides whether this is one build or two.
- **Consider where it lives.** A workplace to-do list is not billing. It may sit better in its own
  tiny app, or in `sep-dashboard`'s new personal PWA. The owner listed it here; raise the
  question, don't assume the answer.

### 4. Other patches

> **Status, 25 Sep 2026 (session B): intelligence engine parts one and two BUILT.** Default cost per kg is now
> derived live (Stats → Cost → Live cost, `cost.js`), and real cost per client is Stats → Clients →
> Contribution by client (`intel.js`). Stats is in five tabs. **Parts three and four BUILT too** (`insights.js`):
> insights as To-do rules, month pace, next challan, PO/vehicle prefill; plus the stock reorder list. The
> PO/vehicle item of this section is therefore done.

- **PO number and despatch vehicle number, predicted.** Start from what the app already has:
  `split/create.js` already saves the vehicle number to the client for autocomplete. A
  per-client frequency model (last used, most used) may carry most of the value before anything
  heavier. If an AI model is used, the Gemini key already lives in its own `localStorage` entry
  (`scanner.js`), never on the state object. Keep it that way.
- **Dashboard updates.**
- **Stats: an overview, plus more depth.**
- **Default cost per kg, calculated dynamically.** `defaultCostPerKg` is on the state and read
  across `stats.js`. Today it is a typed constant: the ₹8.55/kg model in `CLAUDE.md` § Key
  Business Data. Derive it from live inputs.
- **Real cost per client, calculated separately for each.** This is the SSS Mehta question in
  `CLAUDE.md`: fixed versus volume-scaling labour decides whether that account contributes or
  loses. ⚠ **The roster ships empty because this repo is public**, so per-client labour cost must
  be computed from runtime data on the device, never from anything committed.

### 5. Redesign: "Dense console" (owner, 25–26 Sep 2026)

The interface is being rebuilt to `docs/SEP_INVOICING_DESIGN_PRINCIPLES.md` v2.0 — read it first; it is the
whole spec. **Route 1** (native CSS, no build step) runs in four phases (its §9): foundation (tokens, theme,
density, shell) → components → screens one PR at a time (Home, Register, IM, Create, Clients, To-do, Stock,
Staff, Stats, History, Settings) → clean-up. Open decisions (palette, icon, default theme) are its §10.

**Route 3 — a framework build — is a separate app in this repo** (owner: *"a separate build from this, so
that we can keep running our data without missing any days and once that is finished we can port"*). It lives
in its own folder (e.g. `next/`, served at `/sep-invoicing/next/`) and is built to the same design document.
⚠ **Both apps are the same origin, so they see the same IndexedDB (`sep-invoicing`).** Until cut-over the new
build must **never write that store**: it either reads it and keeps its own database, or is fed through
GitHub sync / a backup import. The live app stays the system of record until the owner switches.

### 6. Production (owner, 28 Sep 2026)

✅ **BUILT 28 Sep 2026** — More → Production (`prodparse.js`, `production.js`, `prodview.js`, `vision.js`;
`CLAUDE.md` § Production). The pickling hand's WhatsApp loads, the supervisor's barrel list and a roll's production
block through the one paste box; the VAT register's photos read by Gemini; material in the plant by the book and by the
floor; two To-do rules; a Stats row and labour ₹/kg by line. **Owned by `soma-internal`, like stock** (owner): a view
and an input, exported whole, merged by id.

**Open, for the owner:**
- **The first real day, end to end**: paste one day of the pickling hand's and the supervisor's messages, read one of
  the register clerk's photos, then import the history file (below). That is the check that counts.
- **A register photo read through the app** with a Gemini key: 20 real pages (16–26 Sep) are transcribed and every one
  reads right after the transcription, but Gemini's own transcription has not been scored (no key in the build sandbox).
- **Ask the pickling hand to restart the incoming-material messages** (stopped after 29 Jul): they are the floor's own
  count of receipts, shown beside the challans.
- **The history W18–W35 arrives as a private import** (`sep-production` v1, below), built by the compile from
  `soma-internal/operations/pickling-input-log.md`, the barrel files and the raw relays. Give it deterministic ids (a
  hash of the source file and row), so a second import adds nothing. Imported entries never raise To-do tasks.
- **Unknown, recorded as such**: whether the barrel list covers the in-roll barrel OT blocks (on a day with the list,
  the blocks are shown *also reported*, never added); the line of a pickling load (learnt from plating, never guessed).

### Parked: Home hover previews (owner, 28 Sep 2026: *"We will keep this as a planned UI update"*)

On the desktop, hovering a Home quick action (New invoice, New challan, Stock entry …) shows a translucent snapshot of
what is inside; after 2.5 s without leaving the button the box **locks** (a small loading circle at its top shows the
lock coming) and becomes clickable — New challan's box, for one, a **ranked** client list that starts the challan with
that client entered. New invoice should also stop reading as always highlighted. Not built; design it against §6 of the
design document (an `inv-menu`-like surface, `prefers-reduced-motion` respected, nothing on touch).

### Carried from the codex

- **T-HC** (`soma-internal`): the scanner bypasses `itemRates`. **Fixed here 24 Sep 2026** — the compile session should close it in `soma-internal/tasks.md`.

---

## This repo's side of each interface

Session D checks these against the other repos' descriptions. **If something here changes, say so
in the PR**, so the compile session knows to re-check.

| Flow | This repo's side |
|---|---|
| **Produces** the JSON backup → `soma-internal` (**all sensitive data goes there at every compile**) | Settings → Export. The whole state as one JSON file. `soma-internal` stores it as `analysis/sep-invoicing-backup-YYYY-MM-DD.json`. Newest there: **2026-09-11**. |
| **Consumes** the roster and attendance seed ← `soma-internal` | Staff → Roster → Import. Merges by name, and marks name a worker, never an id (see `CLAUDE.md`). The seed carries the alias map. |
| **Consumes** findings ← `soma-internal` | Tasks recorded in `soma-internal/tasks.md` whose fix belongs here, currently **T-HC**. |
| **Backup shape changed, 24 Sep 2026** | A top-level `rateCheck: {pct, stake, weightTol}` config. Clients gain `pieceWeights: [{partNumber, gauge, kgPerPiece, effectiveFrom, source, addedAt}]` (second PR). Invoice lines gain `imItemId`; challan (IM) lines gain `corrections: [{at, invoiceId, invoice, from, to}]` when an invoice edit writes back to them. Clients gain `pieceRates: [{partNumber, gauge, rate, effectiveFrom, source, addedAt}]`. Invoice lines billed at ₹0 gain `zeroReason` (`replating` / `sample` / `other`), optional `zeroNote`, and `zeroReasonBackfilled` on the 25 historical lines. Anything in `soma-internal` that parses the backup should expect them. |
| **Backup shape changed, 25 Sep 2026** | New top-level `todo: {tasks: [{id, text, due, note, link: {kind, id, label}, createdAt, updatedAt?, doneAt, doneBy?}], snoozes: {key: {sig, until, at}}}`, `todoCheck` (rule switches and day thresholds) and `relayPastes: [{id, at, hash, sentBy, sentOn, kind: in/out, date, text}]`. Attendance marks written from a pasted roll carry `inMin`, `outMin` (minutes from midnight; the next morning is past 1440), `outKnown` and `src: 'relay'`; EXTRA rows from a roll carry `src: 'relay'`. Workers gain `relayNames` (spellings the owner placed once, the roster file's `aliases`, and read-as guesses saved without correction — upper-case letters only, e.g. `SHARAT`). |
| **Ruling, 25 Sep 2026 (monthly OT)** | Monthly hands get OT at day rate ÷ 8 × 1.1, **capped at ₹68.20/h** (`labour.otCap`). ⚠ **For the compile:** the attendance history in `soma-internal` up to 7 Sep carries almost no monthly-tier OT (July 0 h, August 11 h), while September's rolls carry 381 h. By the ruling the earlier months understate monthly pay; the salary slips (`operations/payouts/*-permanent-salary.md`) are the instrument to check them against. |
| **Backup shape changed, 25 Sep 2026 (zinc)** | `zinc` gains `lmeHistory: {YYYY-MM-DD: INR/kg}` — every LME rate Refresh fetched, and any metals.dev looked up for a bill date, kept by day (last 400). Settings → Costing → Zinc rate → *Derive from zinc bills* sets the ZINC line's `bill` / `received` prices, less `premiumPerKg`, against it to measure the LME → MCX uplift. **For the compile:** the more zinc bills carry their price and invoice date, the better that figure; nothing else in this repo's data flows moved (Settings reorganised, Part weights moved to Items, same `S.partWeights`). |
| **Backup shape changed, 25 Sep 2026 (monthly pay)** | New top-level `payrollPaid: [{id, month, status, source, note, at, rows: [{name, staffId?, rate, worked, restDays, dayPay, otHours, ot, paid?, note}], voidedAt?, voidReason?}]`: a closed month of the monthly tier as it was paid, which replaces the attendance model for the hands it names. `labour` gains `otCapFrom` (`2026-09-01`: July and August were paid uncapped) and `holidays` (`['01-26', '08-15', '10-02']`). Workers gain `monthWage` (a contracted monthly wage: rate = wage ÷ days in the month, Sundays ungated). The monthly tier is now BM's 10 Sep model per calendar month. **For the compile:** the payroll file is built from `operations/payouts/*-permanent-salary.md` (April, May, July, August; June's paid slip is not on disk) — keep it there and add each month as it closes. |
| **Config added, 25 Sep 2026 (insights)** | `todoCheck` gains eight insight switches (`insQuiet`, `insRealLow`, `insClientDown`, `insLeak`, `insBelowVar`, `insLabour`, `insAttGap`, `insChemPrice`); `stockCheck` gains `leadDays` and `coverDays`; `costModel` gains `zincPerKg`. No record shape changed. |
| **Backup shape changed, 25 Sep 2026 (cost)** | Stock entries gain kind `bill` ({qty, price, amount, date = billDate, supplier, billNo, note}: a purchase that does not move the level). `received` entries gain `billDate`, `amount` and `billAddedAt` (when the bill was added after a paste). New top-level `costBills: [{id, kind: power/other, month: YYYY-MM, amount, units, note, label, at, voided?, voidReason?}]` and `costModel: {power, other, zincKgMonth}`. **The compile should treat `bill` entries as the purchase register**: they are the prices soma-internal holds, carried over by a `sep-stock` import file and entered from here on. |
| **Backup shape changed, 30 Sep 2026 (the second QA chain)** | The `sep-bank` export's `imports[]` entries can carry `removedAt`, `removeReason`, `rowsRemoved` and `removedIds`: **an import removed in the app took those rows out of the record, so the compile must drop them too** (version stays 1). `attendanceDeletes` records gain `how: 'reread'` (a day re-read from its rolls; the record holds the day as it was) and `pastes` (the rolls a deleted day took with it). Production downtime entries may carry `closedBy` / `closedAt` (a power-back pasted later closed the cut). A stock bill entered by hand now stores `amount`. Credit notes' typed year is stored `yy-yy`. |
| **Backup shape changed, 30 Sep 2026 (the owner's rulings)** | `costBills` rows gain optional `arrears`, `arrearsOf` (YYYY-MM) and `penalty`, all parts of `amount`: **a bill's cost is `amount − arrears`**, since the arrears were already the earlier month's cost; the compile must not count them twice. New top-level `payCarryClears: [{id, staffId, through, amount, reason, at, voidedAt?}]` (a pay balance cleared with a reason). The `sep-bank` export's `parties` carry `dir` (`in`/`out`), and a money-in rule is keyed `KEY\|in`. |
| **Backup shape changed, 6 Oct 2026 (stock checks)** | Stock entries can carry `checkOk: {at, by}` (an entry that did not fit, kept as right by the owner) and `reread` (the time a message was read again: the entry is that message's new reading, `source: 'paste'`, at the message's own `at`). An entry voided by a re-read has `voided.reason` beginning *Read again*. A paste record can carry `reread: [{at, by, voided, added}]`. **The `sep-stock` export carries all of it**: the compile takes the newest copy of an entry by id, as before, and should drop entries voided by a re-read like any other void. |
| **Backup shape changed, 7 Oct 2026 (prospects)** | New top-level `prospects: [{id, name, contact, phone, email, process, kgMonth, rate, stage: new/contacted/sample/quoted/won/lost, nextAt, lostReason, notes, clientId?, wonAt?, log: [{at, stage, note}], createdAt, updatedAt}]`. A quotation may carry `prospectId`. Nothing reads it but this app; soma-internal may copy it whole. |
| **Backup shape changed, 7 Oct 2026 (the merge, G4)** | New top-level `mergeHeld: [{id, at, coll, rid, field, label, why: both/removed/number, kept: {side, v}, other: {side, v}, status: open/used/kept, from, settledAt?, settledBy?}]`: what a sync merge held for the owner. **A push or a pull now merges** rather than overwriting, so the GitHub copy the compile reads may carry two devices' work and a `changeLog` unioned from both; keep both whole. The copy each device last exchanged is kept on the device only (IndexedDB key `synced`), never in a backup. |
| **Backup shape changed, 7 Oct 2026 (statements and pay slips)** | `bank.reminders: [{id, clientId, at, amount, how: whatsapp/copy, oldest}]`: a payment reminder sent from Finance → Receivables. It travels with the book (backups, GitHub, the compile), not in the `sep-bank` export, which is unchanged. A statement of account and a pay slip are drawn from the book each time and store nothing. |
| **Backup shape changed, 6 Oct 2026 (one ranked list)** | `todo.snoozes` can hold a key `fold:<rule>` (three or more tasks of one rule shown as one), its `sig` every member's `key=sig` joined by `;`, and a snooze's `rule` is the member rule. Nothing else is stored: the fold, a task's `worth` and the client card are worked out each time. Whoever moves `S.todo` to `sep-dashboard` keeps the fold keys or drops them; a dropped one only brings the fold back. |
| **Backup shape changed, 6 Oct 2026 (learning from answers)** | `S.todo.resp: [{at, key, rule, act: go/list/snooze/week, age}]` (the last 400) and `S.todo.learn: {dismissed: {key: sig}, applied: [{at, key, kind: raise/off/lead, rule, field, from, to, undoneAt?}], lead: {rule: true}}`. A suggestion applied changes `S.todoCheck` as Settings does. What a device showed stays on the device (`sep_inv_todo_seen`). Whoever moves `S.todo` to `sep-dashboard` takes both; neither is needed to read the tasks. |
| **Production: gauge rules and learnt part names, 30 Sep 2026** | `S.production.gaugeRules: [{id, clientId, family, racks, gauges, lines, note, at}]` and `learn.parts` now written (`{partNumber, gauge, how: 'code' | 'set', at}` by client, floor name and gauge); a plated entry may carry `gaugeOptions` and `gaugeSrc: 'rack'`. All travel in `sep-production`'s `learn` and entries; **soma-internal** should keep them whole. Who plated a run is derived from attendance, never stored. **Also 30 Sep:** `S.production.partRules: [{id, clientId, racks, line, partNumber, name, note, at}]` (Samarth's parts by the round; in the book, not in the `sep-production` export); a plated entry may carry `partNumber` with `partSrc: 'rack'` and `partRack`; `learn.parts` may hold `{ambiguous: true, parts: [...]}` for a floor name learnt as two parts, and `how: 'code+name'`. |
| **Part times and the per-hour constant, 30 Sep 2026** | `client.partTimes: [{id, base, gauge, name, line, pieces?, pickleMin?, plateMin?, at, history?}]` (a figure left out is measured from the production record) and `S.perfCfg.overheadMin` (15). **soma-internal** may read them for a costing by the hour; nothing it sends writes them. The area list gains `civil` (a post, off the floor). |
| **Stock corrections, 30 Sep 2026** | A stock entry corrected is voided with `voided.reason` ('Corrected to …') and `voided.correctedBy`, and its copy carries `corrects: {id, qty}`. The export is whole as before; **soma-internal** should take the copy and drop the voided one, as for any void. |
| **Attendance deletes, 30 Sep 2026** | New top-level `attendanceDeletes: [{id, key, iso, reason, how: 'by hand' | 'migration', at, marks, extra, day}]`: a day removed from `attendance` with its reason, kept whole. **soma-internal** should read a day missing from `attendance` against this log before calling it unrecorded; the book's `"null"` day (23 marks) is the first entry. |
| **Power, 30 Sep 2026** | New top-level `power: {load: {sanctioned, approved, approvedOn, ref, note}, cfg, items}`. Electricity `costBills` rows gain optional `kvaBilled`, `md`, `kwh`, `kvah`, `fixed`, `energy`, `fca`, `duty`, `net` (and `penalty` as the excess-CD penalty). **soma-internal → app**: `analysis/sep-power-history-YYYY-MM-DD.json`, a `sep-production` file of the power-cut log's cuts (ids `PCLOG-NNN`; `downtime.atLeast` for a power-back known only as a bound, `downtime.inferred` for a close the log inferred, `downtime.phase: 'single'` for a single-phase fault; `basis` register where the source cites a register page, relay where only a message) plus `power.bills` (`paid` is what the bank shows and becomes the bill's amount, `net` the net payable, `basis` says which) and `power.load`, imported on Power → Cuts. **App → soma-internal**: the cuts leave in Production's `sep-production` export, and the case is printed from Power → Case. |
| **What to do and error reports, 1 Oct 2026** | Tasks of the owner's own (`todo.tasks`) may carry `go` (a jump: `{kind, …}`), `goLabel` and `advKey` (a move added from the Pulse or a task's moves). Quotations may carry `draftNote` (a draft opened from a move; never printed). App tasks are not stored. Error reports go to Sentry from the live site and carry no book data; nothing about them is in the book (`sep_inv_err_off`, `sep_inv_err_queue` are per device). |
| **Direction B and the guard, 1 Oct 2026** | New top-level `users: [{id, name, role, active, secret: {alg, iter, salt, hash, digits}, createdAt, createdBy}]` (a PIN only as a salted PBKDF2 hash), `guardCfg: {lockMinutes, askMinutes, roles: {office, supervisor, floor: {pages, may, wages, finance}}, recovery}`, `devices: [{id, name, user, registeredAt, registeredBy, build, lastPushAt?, removedAt?, removedBy?, removeReason?}]` and `changeLog: [{id, at, by, dev, op: add/change/remove, coll, rid, label, fields: [{f, from, to}]}]` (every save compared record by record). A GitHub copy pushed with the guard on carries `_device` beside the book. **For the compile:** keep `changeLog` whole (it is what the merge, G4, will sync); never expect a PIN, a token or a key in a backup. With no owner in `users` the guard is off and nothing else moves. Today's view (`?tab=pageHome&v=needs\|pulse`) and the workspaces store nothing in the book. |
| **Quotations and reports, 1 Oct 2026** | New top-level `quotations: [{id, num, fy, displayNumber, rev, revOf, revReason, date, clientId, to: {name, address, gstin, state, attn}, intro, lines: [{item, partNumber, desc, basis: kg/piece, rate, refWeightKg, note, postedAt?, postedTo?}], gstPct, sac, transport, minConsignmentKg, lotPcs, validDays, paymentDays, terms, status: draft/issued/accepted/declined/superseded/void, issuedAt, supersededBy, voidReason, acceptedAt, createdAt, at}]` and `qtnCfg: {signatory, signTitle, footNote}`. **The app now issues the `SEP/QTN/<FY>/NNN` series** that `soma-internal/operations/quotations/README.md` registers by hand: the compile should read the app's issued quotations into that register (a draft has no number and is not a row), and the next number here starts above the highest **in the app** — the five issued in 2026-27 so far (001–005, 001-A) are not in the book, so **the owner should record them (or set them aside) before issuing from the app**, or the app's first will be 001 again. Clients' `itemRates` rows may now carry `unit: 'kg'`, posted from an accepted quotation. Reports store nothing. |
| **The QA chain, 2 Oct 2026** | `S.attendance[iso].slotHand: {staffId: {morning\|evening\|night: areaId \| ''}}` — a hand's own OT slot pick, kept apart from the EXTRA rows. A `block` row with `slotMade: true` was made by the app for a pick: **it books nothing and is no EXTRA row; the compile must not read it as one** (hours 0, its crew the hands who picked it; the slot's usual times). `relayPastes[]` gain `sentAt` (the minute of `sentOn` WhatsApp sent the roll). Clients' `itemRates`: the first row whose pattern a part contains prices it, a row posted from a quotation goes before the broader ones, a row with no `unit` is per piece, and an override prices a line only in its own unit. `guardCfg.roles.*.may`'s `imports` now means the floor's files only; replacing the book is the owner's. The change log names the person for the guard turned off, a PIN reset from the lock and a book brought in. The lockout's count (`sep_inv_guard_fail`, now per ID) is on the device, never in the book. |
| **Backup shape changed, 25 Sep 2026 (pay)** | New top-level `staffPayments: [{id, staffId, date, amount, kind: payment/advance, note, at, voidedAt?, voidReason?}]`: wages paid out, voided and never deleted. **The attendance week is now the pay week, Sunday to Saturday**, numbered by its Saturday's ISO week (the payout files' own numbering). Any compile step that groups attendance by week should use the same boundary. |
| **Backup shape changed, 26 Sep 2026 (a challan invoiced in parts)** | ⚠ **A data-flow change to how the sister repos read challans.** A challan (IM) line may now be billed by several invoices. Its billed quantity is derived from the invoice lines naming it (`imItemId`, invoices not cancelled) and cached on the line as `billedQty`, `billedNos` (KG lines with pieces), `invoiceIds` (every invoice, oldest first; `invoiceId` is the latest) and `invoiced` (true only once nothing is left). A line with `billedQty > 0` and `invoiced: false` is **part-invoiced**; its unbilled share is `qty − billedQty` and its unbilled amount `amount × left ÷ qty`. `billedLegacy: true` marks a line billed whole by an invoice from before `imItemId`. Invoice lines gain `imWhole` (an old loose link that billed the whole challan line) and `overBillAck: {at, left}` (billing more than was left, accepted on save). **For the compile:** anything reading `invoiced` / `invoiceId` as "this line went on that one invoice" should read `invoiceIds` and `billedQty` instead, and unbilled material should be the open share, not the whole line. |
| **Backup shape changed, 28 Sep 2026 (receivables start)** | `bank.opening[clientId]` gains `date`: the day the amount was owed on, which is now the later of the statement's first day and the book's first invoice (`bankRecvFrom`). One with no `date` meant the statement's first day and is counted only while that is still the start. An opening taken from the app's suggestion carries `suggested: true`. **For the compile:** receivables, days to pay and the owed figures no longer read receipts from before the book's first invoice, and a receipt is set only against invoices raised by its own day (the rest is on account). |
| **Backup shape changed, 28 Sep 2026 (production)** | New top-level `production: {entries, pastes, photos, imports, learn: {clients, parts}}`. An entry: `{id, kind: arrived/pickled/plated/downtime, date, time?, to?, slot?: general/ot/day, line?: vat-a1/vat-a2/barrel, lineSrc?: written/set, clientId?, client (as written), part, partNumber?, gauge?, qty?, unit?: NOS/KG/BAG, qty2?, unit2?, qtySrc?, rounds?: [{time, qty, start?, struck?, over?}], rackSize?, racks?, rework?, downtime?: {cause, open}, basis: register/relay/hand/pickling/floor-in, src: paste/photo/hand/import, raw?, n?, pasteId?, photoId?, importId?, msgHash?, sentBy?, by, at, replaces?, voidedAt?, voidReason?, voidBy?}` — stored sparse (a missing field is null). A correction is a new entry naming the one it replaces; a wrong one is voided, never deleted. `photos` hold facts only (`sha`, size, model, prompt version — `reg-v2` from 28 Sep, the date and line read, `page`: production / power, the row count, a fingerprint), **never the image**. Power cuts read off the register's power log are `downtime` entries with `basis: 'register'`, `src: 'photo'`; the pickling hand's are `basis: 'pickling'` — **the compile should join a cut reported by both** (same day, overlapping or within ten minutes, different sources), as `prodDowntimeDay` does, or it counts twice. Register rounds carry `batch: true` for an END row's whole figure, `written` (the figure as written, e.g. `98×8+1`) and `rack`/`n` where a product was written. `learn.clients` maps a written spelling (upper-case letters) to a client id. The usual line, rack sizes and pickled → plated matches are derived on read and never stored. `todoCheck` gains `prodPlatedUnbilled`, `prodPickledNoChallan`, `prodPlatedDays`. |
| **Knowledge base, 5 Oct 2026** | New top-level `kb: {articles, trained, paths, deleted}` in the backup (`deleted`: drafts deleted here, so an older file does not bring them back; `roles: []` is everyone, `['owner']` the owner alone; QA chain of 5 Oct 2026). **soma-internal owns the rulings** (as with stock); the app owns what is written in it (how-tos, faults, incidents, decisions). Knowledge → Library → Export writes `sep-kb-YYYY-MM-DD.json` `{format: 'sep-kb', version: 1, exportedAt, build, articles, trained, paths}`; Import merges by id: a newer `version` replaces an older one (kept in `versions`), nothing is deleted. An article: `{id, kind, title, summary, body, tags, links: [{type, id, label}], roles, status: draft/pending/published/superseded/retired, version, versions, by, byId, at, approvedBy, approvedAt, src: app/import/build, srcRef}` plus its kind's fields (ruling `ruledBy`, `ruledOn`, `supersedes`, `supersededBy`; fault `symptom`, `causes`; incident `on`, `faultId`, `cause`, `fix`; decision `question`, `options`, `chosen`, `reason`, `decidedOn`, `reviewOn`, `figures: [{key, args, then}]`, `reviewed`; guide `quiz`). `trained: [{id, staffId, name, articleId, v, on, at, by, score, note}]`. **Photos never travel** (`images` holds ids only; the pictures stay on the device). **The compile should keep `kb` whole** and treat a published ruling as the record of the owner's decision; the first content came from soma-internal's `decisions/`, `operations/` and `frameworks/`, each article naming its `srcRef`. |
| **Planner, 6 Oct 2026** | New top-level `planner: {cfg: {lines: {vat-a1/vat-a2/barrel: {kgRound, every}}, pickKgH, otLineHour, powerFixed, cash, costs}, machines: [{id, item, station, line, state, age, needs, risk: {p, cost, days, say}, at, by, retiredAt?, retireReason?}], checklist: [{id, ref, what, status, cost, owner, due, evidence}], lenders: [{id, who, amount, rate, months, mor, ties, status}], heard: [{id, what, value, from, on}], heldBack: [{id, clientId, why, kg, rate, line, chance, note}], scenarios: [{id, name, goal, plan, asks, chances, loan, cards}], active}`; any register record may carry `retiredAt, retireReason, retiredBy`, and heldBack's `why` is cert, turnaround, approval or other. **For the compile:** the registers are the shop's records (machines' states, the CQI-11 checklist, lenders' terms, rates heard, work held back): keep them whole; scenarios are sandbox and need not be read. Nothing flows out of the planner into the book. |
| **Monthly register, 6 Oct 2026** | New top-level `attRegister: {months: {'YYYY-MM': {month, src: import/photo/hand, title, columns: [{name, staffId?, total?}], days: [{date, written, kind: work/sunday/holiday, cells: [{raw, unsure?, edits?: [{at, by, from, to}]}], note?, dateUnsure?}], notes, verifiedAt?, verifiedBy?, filledAt?, photo?: {size, model, at}}}, names: {KEY: staffId}}`: the supervisor's monthly book as written, a cell's raw text read in code. Marks the owner puts on a day from it carry `src: 'register'`. Staff → Register → Import takes `sep-att-register` v1 `{kind, version, months: [{month, title, columns: [name], days: [{date, written, kind, cells: [{raw, unsure}], note}], totals: [{col, raw}], notes}]}`; a month on record is kept. **For the compile:** the book is the source the monthly slips are made from; the pages of March–September 2026 were transcribed privately (handed over 6 Oct 2026, never committed). Keep `attRegister` whole beside `payrollPaid`. |
| **Backup shape changed, 8 Oct 2026 (power causes)** | New `power.causes: [{id: 'PCS-…', kind: reason/fix, name, aliases, scope?: grid/plant/'', at, by, mergedInto?, mergedAt?, mergedBy?, editedAt?, editedBy?}]` — one name written one way, every spelling typed kept; a merged entry points at the one it joined. Production `downtime` entries gain `downtime.reason` and `downtime.fix` (ids into that list), `where` (`all` or a station), `unitId` (a plant register unit), `note`, `setAt`, `setBy`; a time typed in the app sets the entry's `to` with `downtime.closedAt`, `closedBy` (a name, where a paste's top-level `closedBy` is a paste id) and `closedHow: 'hand'`, dropping `atLeast` / `inferred`. **The `sep-production` export carries `powerCauses`** (the list its cuts name; version stays 1), and an import merges it by id, joining one written the same way. **For the compile:** read a cut's reason through the list, following `mergedInto`; keep the list whole. `todoCheck` gains `powerComplete`, `powerCause`. |
| **Bank statement import, 8 Oct 2026** | The statement may come as the .xlsx Excel saves it, and a two-page statement's page foot (its time under TRAN DATE, *Page 2 of* under BALANCE) is passed over. No record shape changed; the `sep-bank` export is as before. |
| **Backup shape changed, 9 Oct 2026 (production and stock by line)** | Stock entries gain `lines: ['vat-a1' \| 'vat-a2' \| 'barrel', …]`, the baths a use or a charge went into, read from the message or picked by hand (*Into*). **A use whose message names baths is saved as one entry a bath**, each on its own day with its bath's words as its note, where it was one entry with every bath in its note; the quantity per item is unchanged, and a message read again with the new reader (Stock → To check) voids the old entry and adds the new ones. `S.production.seriesRules: [{id, clientId, family, kinds, racks, lines, prefix, except?, name, note, at}]` says which parts a round can be (Mehta's two set once, `_prodMehtaRounds2`); a run read again by a gauge rule keeps `gaugeRuled: {rack, at}`; a client may carry `defaultKgPc` (a kg a piece, `_clientKgPcDefault1`); a weight set from a run goes on the client's `pieceWeights` with `source: 'production'`. All travel with the book; the `sep-stock` and `sep-production` exports carry them, and soma-internal's compile reads both. |
| **Today as cards, 8 Oct 2026** | Nothing in the book: a card's fold is per device (`sep_inv_folds`, keys `tdy-*`), like every fold. |
| **Backup shape changed, 9 Oct 2026, the second (a register run's start)** | A plated register entry whose run opens on an END (no START written for it, or split from its START's run by its gauge) starts at the END before it on its page, where it had started at its own END. One saved before the fix, from a photo or a file the reader built, is corrected at start-up and carries `startWas` (the start it had, `HH:MM`; no clock, so two devices putting one run right write the same). **The `sep-production` export carries both**; the corrected copy is the newer one, so the compile should take it over the copy it holds, and any hours or pace worked out from the old start move with it. |
| **Backup shape changed, 10 Oct 2026 (suppliers, P208)** | New top-level `suppliers: [{id, name, names[], leadMin?, leadMax? (working days), gstPct?, opening?: {amount, date, note, at, by}, inOpening?: [statement row ids], totals?: {'<bill no>|<date>': amount}, note?, at, by, setAt?, setBy?}]` and `supplierPays: [{id, supplierId, date, amount, how: cash/cheque/transfer, chq, note, at, by, voidedAt?, voidReason?, voidBy?}]`; both in the `sep-stock` export. **For the compile**: a supplier's bills are its stock entries (`bill`, `received`) grouped by company, number and date; what is owed is the balance set, plus the bills after its day with GST rounded to the rupee, less the payments after it, a cheque recorded here and the statement's row of its number being one payment. |
| **Backup shape changed, 10 Oct 2026 (compare suppliers, P209)** | A stock line (`stock.items[]`) may carry `orderFrom: {supplierId, name, at, by}`: the supplier the owner chose to order it from (Stock → Compare suppliers), which the reorder list, the line and its task follow over the app's own pick; a supplier's record may carry `quotes: [{id, itemId, price (before GST, a unit), date, note, at, by}]`, a price quoted, weighed beside the bills for 90 days. Both travel in the `sep-stock` export (items whole, suppliers whole). **For the compile**: a quote is not a purchase and never a bill; `orderFrom` is a choice, not a record of what was bought. |
| **Backup shape changed, 10 Oct 2026 (entry faces F2, P200)** | A production entry (`production.entries[]`) may carry `src: 'face'` (entered on a person's own screen), `msgHash` (the key of the message it gave the WhatsApp group: that message pasted is refused), `imId` and `imItemId` (the challan and line a count was made against), `challanNo` (as written), and `checkOk: {codes: [...], at, by}` (the checks the owner kept it through: `noplate`, `over`, `count`, `inNoChallan`, `noload`). In the `sep-production` export; merged by id. |
| **Backup shape changed, 10 Oct 2026 (entry faces, P199)** | A user (`users[]`) may carry `faces: [duty, …]` (`roll-in`, `pickling`, `incoming`, `stock`, `attsheet`, `barrel`, `vat`, `roll-out`): what that person enters on their own screen, Mine. It travels with the users (backups, GitHub, the compile); nothing outside the app reads it, and the records a face enters are those the forms already write. |
| **Backup shape changed, 10 Oct 2026 (snacks, P207)** | New `labour.snackOt` (20) and `labour.snackNight` (60): snacks a person on regular and on night overtime, paid with the weekly payout (owner, 10 Oct 2026). **For the compile**: a week's payout (`payWeek`) is now the weekly tiers, the EXTRA pool and the snacks (`paySnacks`: a person once a day at the higher, from the blocks' crews and the outs; night is past midnight; none for the 6 AM block or the gate), so the cash a week paid as wages reads that much higher. Nothing exported changes. |
| **Backup shape changed, 10 Oct 2026 (the pay history, P205)** | New `labour.payCarryFrom` ('YYYY-MM' or ''): the month monthly balances count from. **For the compile**: what a monthly hand was paid is now the statement's salary legs read as wages to them (`bankClassify`, plus a payee or row set by hand) and the payments typed on Pay, a typed one the statement also holds counted once; a month on the payroll as paid is set against them (the slip is what was earned), and from `payCarryFrom` on each month's difference carries. A reading of `payrollPaid` alone reads every such month settled. Nothing exported changes. |
| **Backup shape changed, 10 Oct 2026 (cheques received, the tab map's TM3)** | New `bank.cheques: [{id, clientId, amount, number, chequeDate, drawnOn, receivedOn, note, at, by, deposit?, voidedAt?, voidReason?, voidBy?}]`: a cheque received and not yet in the bank, **counted as paid from `receivedOn`**, until a statement credit carrying its number (from three days before it came to 60 after, whatever its amount) is found; from then the deposit counts and the cheque does not, and the deposit is placed on the cheque's client unless it was placed by hand. `deposit` is the owner's own link (a row id) or `null` (*not this deposit*); absent, the link is worked out on every read. A voided cheque counts for nothing. **The `sep-bank` export carries `cheques`, and a `sep-bank` file is now taken in (Add → File, or Money → Bank's Import, which hands it there): its cheques merge by id, never written over; its rows are not read from it.** ⚠ For the compile: receivables computed from `bank.rows` alone read a client's owed higher than the app does while a cheque is in hand. The Finance tab `bills` is gone (Money → Payments and Office → Invoices → Credit notes; an address naming it opens Payments); nothing in the book moved. |
| **Produces** captured production → `soma-internal` (the owner) | **Built 28 Sep 2026.** Production → Entries → Export writes `sep-production-YYYY-MM-DD.json`: `{format: 'sep-production', version: 1, exportedAt, build, entries, pastes, photos, imports, learn, powerCauses}` (`powerCauses` from 8 Oct 2026). Always whole; ids are stable, so the compile de-duplicates on them and keeps the newest copy of an entry (a void is a later copy). The inferred line is never exported. |
| **Consumes** the production history ← `soma-internal` | Production → Entries → Import takes the same `sep-production` v1 shape. Merges by id and never overwrites; a client is kept by id only where the book holds that id under the same name, else found by name, and a name the book does not hold is counted and kept as written, never invented. Entries without `src` are stamped `import` and raise no To-do task. |
| **Produces** attendance from the supervisor's rolls → `soma-internal` | **Built 25 Sep 2026.** Staff → Paste message reads the in/out-time rolls into `S.attendance` in the seed's own shape (marks by worker id, `coverage` / `block` EXTRA rows), so the compile reads pasted days exactly as it reads seeded ones. Each roll is kept whole in `relayPastes`. The parser was calibrated against `analysis/sep-attendance-seed-2026-09-{07,12}.json`; if the decode conventions change there, say so here. |
| **Produces** captured stock entries → `soma-internal` (the owner) | **Built 24 Sep 2026.** Stock → Export writes `sep-stock-YYYY-MM-DD.json`: `{format: 'sep-stock', version: 1, exportedAt, build, items, entries, pastes}`. Always the whole record; ids are stable, so the compile de-duplicates on them. Each entry: `{id, itemId, kind: count/received/used/charged, qty, date, from?, days?, rate?, price?, supplier?, billNo?, note?, unsettled?, voided?, at, by, sentBy, source: paste/manual/import, pasteId?, n?, raw?}`. `pastes` hold each message whole. The same data is also in the full backup under `stock`, with `stockCheck: {redDays, amberDays, chemModel}`. The ledger stays `soma-internal/operations/chemical-stock-log.md`. |
