---
subject: "Attendance: rolls from WhatsApp, the register, paper, needed per shift"
domain: people
modules: [split/attreg.js, split/attsheet.js, split/relay.js, split/staff.js]
specs: []
tests: [P43, P96, P98, P161, P207, P221, P251]
updated: 2026-11-12 (an import fills a blank page started by hand)
---

### Attendance rolls from WhatsApp
People → Attendance → **Paste message** (or Add → Paste). The supervisor's **in-time** and **out-time** rolls
read into the day People keeps, with every line shown beside what it was read as **before**
anything is saved — the stock paste's contract. `parseRelayRoll` is pure (the roster is passed in).

**Calibrated, not guessed.** The rules are the ones the hand decode has used since August, and the
parser was scored against it: the in/out rolls in `soma-internal/data/raw/relays/` replayed into the
decoded days of `soma-internal/analysis/sep-attendance-seed-2026-09-{07,12}.json` — **22 days, 434
marks: state 98.8%, area 92.4%, hours 94.9%, OT 99.1%, EXTRA rows 69 of 79 exact**, identically with and
without remembered spellings. The harness and the real rolls stay out of this repo (it is public); the
spec uses made-up names in the shop's shapes. What does not match is judgement the review surfaces:
barrel versus barrel pickling inside the one unit, and blocks whose crew or times the decoder took
from context. The older seed (to 7 Sep) wrote a monthly hand's OT as 0; the newer one, and this
parser, as hours over 8 — the wage model's rule, confirmed by the owner 25 Sep 2026 (paid at day
rate ÷ 8 × 1.1, capped at ₹68.20/h), so the older seed understates it.

- **Hours are the clock span floored** (8:30 → 5:00 is 8, 6:00 → 5:00 is 11); **a monthly or daily
  hand's OT is hours over 8**; an hourly hand carries none. **The gate stands 7 AM – 7 PM** (BM) and
  its twelve hours are not OT. A hand the out-time roll does not name leaves at 5 PM; until an out-time
  roll arrives the review says the day is provisional, and the next roll **updates** those marks.
- **An EXTRA tag on the 8:30 shift is coverage** booked to that line; on any other slot it is a
  **block** with the crew named under it and the slot's times. The tag closes its group. On an
  out-time roll where the group's own times differ, the block is the hands who stayed latest.
- A slot ahead of the 8:30 shift headed "6:00 pm" is read as the morning, flagged (BM ruled it a
  mislabel). "pickling VA 1 & berral" is the VAT side's pickling; "berral & pickling" is the barrel
  unit; "VAT A1 & pickling" stays a VAT row (the fold is the reconciler's). The office and the gate
  share a header, and each hand stands at his own post. No line written: Flex.
- **Names**: found three ways, surest first. **Exact** — the roster name, either side of a dash
  (`Bhanu - B.P. Sharma`), with or without a bracket (`Lal (Karmu Mahato)` answers to KARMU too), a
  spelling kept on the worker (`relayNames`), or a **first name nobody else has** (the roll writes
  SARAT for the roster's `Sarat Mahato`; a surname spelt the shop's way after it, MAHTO, stays part
  of the name). **Folded** — doubled letters, SH/S, BH/B, W/V, EE/I taken out, then on a numbered line
  the consonants alone (SHAMBHU, BUDHESWR, ROKY). **One letter off** (two on a long name). The last two
  are flagged *read as* with a picker already on the guess. A key two workers share matches neither;
  anything else is **asked, never guessed** — a numbered line not on the roster is red until placed
  or left out.
- **A number with no bracket after it is a numbered line when a roster name follows** (`14 NAME`, as the out-time roll of 7 Oct
  2026 wrote one): it had been read as a note, and the hand's out stayed at 5 PM. Only a name matched as written counts, so a
  quantity (`10 BAGS`) or a note is never a person. P207.
- **A spelling is learnt once** (owner, 25 Sep 2026: *"everytime I paste a message I have to go through
  and manually match them"*). A placement is kept on the worker **the moment it is picked**, and a
  *read as* the owner saved without correcting is kept on Save. Replayed over the real rolls against the
  device's own full-name roster: **82 read-as lines on the first pass, 3 after one save** (new
  spellings), and the scores above unchanged. ⚠ **Placements had never been kept at all**: the picker
  hands back the id as text and real rosters number their workers, so the save's strict lookup found
  nobody and dropped every one silently. The spec used text ids (`'W1'`) and could not see it; P43 uses
  numbers. People → Roster → Import keeps the file's `aliases` as spellings too, a merge keeps the
  retired row's name, and the worker's Edit screen lists them and takes corrections. The chemical stock
  written under a roll (`camical use camical stock`, no date) ends the roll rather than reading as a
  dozen unknown names, and is read in Stock: the review's **Read in Stock** hands over that part and any
  stock message pasted with the rolls, each with its WhatsApp line (`relayStockParts`; it had pointed at
  the retired More sheet and was never read).
- **A mark entered by hand is kept** and shown as kept; the relay only rewrites marks it wrote
  (`src: 'relay'`, with `inMin`/`outMin`). EXTRA rows already on the day are not added twice. **The
  same roll twice is refused** by fingerprint (`S.relayPastes` keeps each roll whole). A roll with a
  second message pasted on its end stops there and says so. **A roll keeps the minute WhatsApp sent it**
  (`relayPastes[].sentAt`, from the header line, which the stored text leaves out), and Today reads its
  arrival from that, not from when it was pasted. A roll's dated head ("01/10/26/ in time6:00 am") is a
  roll to both readers (`relayKind`, `prodKind`), and an "Out time" heading with its time run on is
  still a heading.


### The monthly register
People → Attendance → **Month** (`attreg.js`; owner, 6 Oct 2026: *"that's what I receive at the end of every month to make the attendance slips … I
need this to be in the app … from next month I can start entering these into the app and cross check against the daily attendance"*). The
supervisor's book, a page a month, a column a monthly hand, a row a day. P161.
- **Kept as written, read in code** (`S.attRegister.months[YYYY-MM]`: columns as headed, each cell's raw text, the totals under the
  columns, notes; `aregCell`): P, A, H, *P-8pm* (from the shift's start), *6Am-5pm*, *6Am* (to the shift's end), *6Am-12Am*, *P-6Am*
  (overnight). On a Sunday or holiday line the letters spelt across are the line: an A there is SUNDAY's, never an absence.
- **The hours are the roll's rule** (`relayHoursOf`: the span to the whole hour, OT past 8; a plain P is 8:30 AM to 5:00 PM). On the
  owner's book it reproduces March's and June's written OT totals to the hour; August's totals add the Sunday hours in, which the OT
  card counts apart and says.
- **Set against the day** (`aregCompare`): each cell agrees, differs on the mark, differs on the OT (an hour or more), is only on the
  register, or the day has a present mark the register left blank. Settled one cell at a time, either way: *Day takes the register's*
  (the mark with its times, `src: 'register'`) or *Register takes the day's*. **Fill** puts every cell only on the register onto its day,
  asked first; an unsure or unread cell is left out, and a mark already on a day is never touched.
- **A corrected cell keeps what it said** (`edits`), on a page read from paper; a page started by hand is just being written. Mark
  checked stamps `verifiedAt`; any later change clears it.
- **A column's worker**: picked once, learnt for that heading (`S.attRegister.names`), else the roster's name as a roll reads it.
- **Two doors**: Import (`sep-att-register` v1, also through Add → File; a month on record is kept, never replaced, unless it is a page
  started by hand with nothing on it, which the import fills: `aregMonthBlank`, owner 12 Nov 2026) and **Start this
  month** (a column per active monthly hand, Sundays drawn), filled a cell at a time with *Next day*. **Read page photo** (Gemini) came
  out on 13 Oct 2026 with the rest of the photo reading; a month it read stays.
- **Names never in the build**: the seven pages of March–September 2026 were transcribed from the owner's photos into a private
  `sep-att-register` file, handed over to import and check. On that book, May–September agree on present / absent in all but 7 of about
  1,000 cells; most differences are OT the daily records hold as 0.

### The attendance on paper
People → Attendance → Day → **Print sheets** (`attsheet.js`; owner, 29 Sep 2026: *"one for Shyam and one for Deepak aka Champai … a
verification route for the attendance and physical copy that I can file for every day for record keeping"*). For the day
on screen, three documents through the one print view, each page one A4 sheet (P96 measures them under print media):
- **Shyam's sheet** is his WhatsApp roll on paper. **In time** (front): the 6:00 AM blocks (area, three lines, EXTRA, work
  done), then the 8:30 AM shift by area in his order (VAT A1, VAT A2, Barrel & pickling, Pickling A1 & A2, Office & gate)
  with numbered lines running on as he numbers them, an EXTRA box per floor area, and Monthly / Weekly absent. **Out time**
  (back): who left at 5:00 PM, then four later blocks (out at, area, names, EXTRA, work done), and *Filled by Shyam · Sent
  on WhatsApp at · Handed to Deepak at*. **Blank lines only** (owner): he writes names as he does on WhatsApp.
- **Deepak's sheet** is the Day entry on paper: the active roster in the Day view's order (`staffActive`), tier, P / H / A,
  area, in, out, hours, OT, three rows for anyone not on it, the EXTRA table (area, from, to, crew, hours), and *Filled by
  Shyam · Checked by Deepak · Entered in the app by / on* Every column has a fixed width (`data-as-entry`): In and Out 16 mm each, room for
  a time by hand (owner, 1 Oct 2026: *"In time Out time hardly has any space"*; the four shift areas had squeezed them to 7 and 10 mm).
- **The filled copy** is Deepak's form carrying what the app holds for the day (a worker marked that day who has since left
  the roster included), to staple behind the two. It cannot be picked for a day with nothing entered.
Shyam writes, Deepak transcribes into the app's shape, the owner enters it and files all three: the paper checks the entry.
**An earlier day the app holds prints Shyam's sheet filled, as a worked example** (owner, 29 Sep 2026: *"that way giving them
a tutorial becomes easy"*; `attSheetFillFor`, never for today): the names under their area, the absent by tier (monthly or
weekly), the 6 AM blocks and the evening blocks with area, crew and EXTRA, whoever is on no evening block in the 5 PM list
with their own time when it is not 5 (*Chand 7:00 PM*, his *BIRSA 2 PM*), all in a filled form's ink (`inv-as-fill`).
Names come from the roster on the device; none is written into the build, and the spec uses made-up ones. English only (owner).

### Needed per shift, and the out-time roll read right (29 Sep 2026)
**The heads a shift needs** (owner: *"sometimes the barrel needs only 3 worker, or VAT A1 or A2 needs only 2 … The app still
shows a deficit in these cases, so for every shift we assume and also input (as an option) the number of workers needed"*).
People → Attendance → Day → **Needed today**: per floor area, who stood on the general shift against the shift's number, a box that starts
at the area's usual complement (placeholder) and takes the day's own (0 = nobody needed; blank = the usual), and a dot
(*Short n* / *Met* / *n over*). Stored in **`S.shiftNeeds[iso][area]`**, apart from `S.attendance`, because a stored day
there is what "recorded" means and a number typed for tomorrow must not claim a recording. `areaNeedOn(iso, area)` is read
wherever the complement was: the Areas card's unit-day shortfall and expected extra, and Home's floor-heads tile. Each OT
or night block has its own **Needed** (`need` on its row), which `blockNorm` reads before the complement and the fold.

**The out-time roll**, from one the owner sent (P98 uses made-up names in its shape):
- *"night hold-8 pm to 6 am"* ran from 5 PM: every out-time block started at 5, and "to" was not a timing word, so the
  heading's own times were skipped. A heading that writes both ends now gives its block both, and a bare *night* heading is
  the night hold, **8 PM to 6 AM** (`RELAY_NIGHT`). A heading with a single time is still only when the crew went home.
- *"----berral & V A 2----"* read as the barrel alone: the barrel check returned before looking for a VAT line. Barrel with
  a VAT line (no pickling) is both, and the collapse to barrel pickling now applies only to barrel + barrel pickling.
- *"pickling 2 SIDE"* is one pickling crew serving both sides (owner): `pickling-vat` + `pickling-barrel`, never a third area.
- **"Night hold is night shift"** (owner, 30 Sep 2026) on an in-time roll as on an out-time one: a night heading with one time
  keeps the other end, starts its block at its own time, and is never taken for a mislabelled morning (*"night hold 8 pm"* ahead
  of the 8:30 shift read as 8 AM).

**Where an overtime block stood** (owner, 15 Oct 2026: *"it misreads area assignment in overtime or if 2 areas have + sign between
them"*; P221):
- **A block headed by a time alone** ("----8:00 PM---- / one name / EXTRA 9 HOURS") ran where its crew stood that day (`relayPlan`, the day's
  marks), said; it had been booked to no line and read Not checkable.
- **The gate keeper's standing 7 PM is never the block's**: the gate and office hands are left out of a block's crew while anybody else is
  under the tag (three hands out at 6 PM and the gate keeper at 7 PM over "EXTRA 3 HOURS", 13 Oct 2026, had made the gate keeper the whole crew, to 7 PM).
- **Two lines joined by + or &** ("VAT 1+2", "V A 1&2", "VAT A1 + VAT A2") are both, and "VAT 2" is VAT A2 (it read VAT A1).
- **A heading that only names its lines learns from the same correction on two days** (`relayHeadIsPlain`, `relayLessonApplies`, the
  lesson's `days`): outside the 8:30 shift, one day's correction under "VAT A1" is that day's crew moving. One correction of 9 Oct (an
  evening "VAT A1" to A1 + A2 + pickling) had been read into every evening "VAT A1"; the Paste message view lists such a lesson as *used
  once corrected the same way on another day*.
- **A roll's date with spaces** ("Sunday Duty 11/ 10/ 26/ IN TIME") is the date; it was read as the day sent.

**The reader learns from corrections** (owner: *"The parser should learn from feedback … by reading if the data was changed
after the paste or save"*). A row the roll makes remembers the heading it came from and what was read (`srcHead`,
`srcAreas`, `srcSlot`, `srcFrom`, `srcTo`); changing its areas, or a block's in and out, on the Day view records the
correction against that heading (`relayLearnFromRow`, `S.relayLearn`), and the next roll with that heading reads it that
way with an info line *… learnt from your correction on 28 Sep*. Put back as read, the lesson goes; People → Attendance → Paste message
lists every one with **Forget**. Times are learnt only for a heading with words (*night hold*): a bare *8:00 PM* is when a
crew went home, and one day's exception must not move every day's block. The paste review has no area or time controls,
so corrections are taken where they are made, on the saved day.

### The week the rolls were set against the payout (31 Oct 2026)
The owner set the book, corrected by hand, against Shyam's Saturday cash for 25–31 Oct (*"We were way off"*; P251). Read from the rolls,
five things had gone wrong; each is fixed, and the week's payout read from the owner's book now lands ₹79 from the cash paid.
- **A night-hold heading is a heading** (relay.js): *"NIGHT HOLD-8 PM TO 6 AM"* had been read as the roster's *Night Guard*, whose first
  name nobody else has, so the hands under it stayed on the slot above, out at 5 or 8 PM (14 h where they worked 24). A line that reads
  as a night or a span is a person only where the whole name is written.
- **A hand under a night hold that writes its start is in at it**, scheduled or not (`nightIn`), and **"NAME NIGHT" on an in-time roll**
  (under the absent list or a post) is on the night, not the 8:30 shift: present with no times until the out-time roll's night gives them
  (`nightNote`), 6 PM to 6 AM, 12 h (it read 8:30 AM to 6 AM, 21 h, or absent).
- **A roll whose year slipped on the phone** (*"26/10/28/IN TIME"*, sent in 2026) is read in the year it was sent (else pasted), within 60
  days, and said: it had read as a day in 2028 and was never saved (T-IS).
- **"BIRSA 12 PM OUT" on the 8:30 shift is noon**: the shop's *12 pm* for midnight is a night block's. Read as midnight, 3 h paid as 15.
- **The payout's cut-off is Saturday at 5 PM** (owner: *"it seems payout cutoff time is Sat 17-00 and everything later than that goes to
  the next week's payout"*; `payLate`, `payWeekLab`, payroll.js): the Saturday's work after 5 PM (an hourly hand's hours past it, a daily
  hand's overtime past it), the EXTRA of a block starting after it and that evening's snacks are the next week's, read off the Saturday's
  own marks and never moved off its day. The payout, a weekly hand's due, the slip and the carry read it; the month's labour does not.
  The 24th's night (three hands, EXTRA 39 h) had been in neither payout.
- **Found, not the parser's**: the 29th's out-time roll was never pasted (the day typed by hand missed four hands' 8 PM and one hand's
  night), and the night schedule in the book runs 5:30 PM to 8:30 AM where the rolls and the owner's corrections end the night at 6 AM.
