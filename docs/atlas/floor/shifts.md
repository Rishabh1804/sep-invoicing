---
subject: "Shifts by line: the night shift"
domain: floor
modules: [split/shifts.js]
specs: []
tests: [P249]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Shifts by line: the night shift
Owner, 29 Oct 2026: a night shift on VAT A1 from that day, *"Build it as a schedule per line with a start date, read by attendance,
pay, EXTRA, production, efficiency, power, capacity and the planner"*; then, of how it runs: 5 PM to 8:30 AM paid as continuous work
to the Saturday, 6 PM to 6 AM from the Monday, a crew of VAT A1 4 and pickling 2 with 1 spare, the 45-minute break at no fixed
time, the ₹60 snack every night, the day crew rotating in (`shifts.js`, P249). **Nothing about the shop is in the build**: the
schedules are the book's (`S.lineShifts`), typed in Settings → Labour → **Shifts by line**; the crew's names are the roster's.
- **A schedule** is one line's from a day (`from`, `to` blank for open): the night's `start` and `end` (past midnight), when plating
  `stop`s, the `breakMin` taken in it, the `crew` by area (the line's and `pickling-vat`), a `spare` who books no shortfall, a note.
  The one in force on a day is the latest whose first day is on or before it (`lineShiftOn`, `lineNightOn`: minutes on the day's
  clock, `plateMin` the plating time less the break). **A night is the day it starts on**, and there is none on a Sunday unless
  the schedule says *Runs on Sundays too* (the owner: the night shift does not run Sunday night), nor on a day the plant is shut. The barrel's schedule is its running hours
  instead (`runFrom`, `runTo`: the mornings before 8:30 and the evenings after 5 PM running with no crew, `barrelRunOn`) and the
  EXTRA its loading or unloading books a window (`extraOne` for one barrel, `extraFew` for two to four, `extraMany` for five or six).
- **The roll**: a night heading with no time is the schedule's night, one with a time keeps the schedule's other end (8 PM to 6 AM
  where no line has a night, as before); a hand under it on no other roll is in at its start (`nightIn`), never at 8:30 (21 hours).
  **The night roll is sent the next morning** (owner, 30 Oct 2026): a roll with no date, sent before noon, whose first heading is a night, is the night before's, said amber; a dated roll keeps its date.
  **Read the rolls again from …** (the section's button, `shiftRereadFrom`, `relayRereadDay`) reads every day since the first
  schedule with nothing asked, keeping what was typed by hand; a day whose rolls ask a red question is left to be read on the day.
- **Pay reads the hands' own times and needed nothing new**: 6 PM to 6 AM is 12 hours by the roll's rule, a monthly hand's 4 of them
  overtime (capped as ever), an hourly hand's all 12 at the rate, the night snack for an out past midnight (`paySnacks`). 5 PM to
  8:30 AM is 15 hours, 7 of them a monthly hand's overtime.
- **Heads**: a mark in from 4 PM, on a day a line has a night whose areas hold it (`attMarkOnNight(m, iso)`, `SHIFT_NIGHT_IN`; before any
  night is scheduled an evening hand stays a general-shift head), is the night's, never the general shift's: the Areas card's
  shortfall, Day's board and *Needed today*, the attendance panel's floor heads and Production's staffed lines leave it out. Day's
  board draws the night as its own card (`data-att-night-card`), its heads against the schedule's crew (`shiftNightCrew`: the night's
  marks, a day hand's mark whose out runs past midnight on the night's areas (an untagged night books no block row), and the crews of
  its blocks, each once). A block is the night only where it reaches past midnight or covers most of it: 5 to 8 PM is the evening's
  overtime. A heading naming only the barrel's side never takes a VAT line's night. An in-time roll pasted after the night's roll,
  listing a night hand absent, leaves the night mark (absent from the 8:30 shift, not the night).
- **EXTRA**: a night block's norm is the schedule's crew (`blockNorm(row, rows, iso)`: the whole crew for the night's one row, whatever
  areas its heading names; each sibling row its areas' share; the spare left out), so a booked night short of two hands expects
  24 hours on 6 PM to 6 AM. A night with no EXTRA row booked is not reconciled on the card; `nightShort` says it. A barrel block in a running window expects the hours set for the
  barrels the barrel's batches loaded or unloaded in it (`shiftBarrelWindowExpect`), not a missing hand's length.
- **To-do**: `nightShort` (a recorded night short of its crew, a week back) and `nightTwice` (a hand on the general shift after the
  night before, or on the general shift and the night of one day: owner, *"Flag a hand on two shifts back to back"*), floor tasks.
- **Production**: a night the line ran (a run from an hour before its start, or heads on it) is judged against its plating time less
  the break (`prodLineEfficiency`'s `o.night`), whatever the runs' own times, a cut inside it taking the break's place first; the
  barrel against its whole running day (`o.run`). A night with heads and no record reads *No record* (`o.nightMissing`), its time
  kept out of what the line could plate. The measured pace keeps the night a shift of its own (`date|night`), its times on the shop's
  day and its break off its span. A time before the night's end (8:30 AM on this week's night) is the night's tail.
  **A night page's times run on past midnight** (`prodFromRegisterRead`, `ctx.night`): once the page has passed 5 PM each is read on
  the night's clock, never before the row above it, so *2:00* after *11:40 PM* is 2 AM and *12:20 AM* is past midnight, not noon;
  before then the page is the day's (the noon fix, a row out of turn), except a bare time nearer the night (*7:00* opening a night
  page is 7 PM). The register's own power log is not yet read on the night's clock. Floor's line card says the night
  and its crew (`data-flr-night`).
- **Power**: a night that ran is a working window of its own (`powerWindows`, kind `night`), never overtime; a 2 AM cut is in it,
  dated the night's day or the next. **Capacity** (`statsCapacityKg`) stays two shifts of ~2 t: the model's two shifts already hold
  a second, so the night adds nothing until the owner says whether it is that second shift or a third (Vulcanus H-3: adding it
  counted ~22 t a month of spare that is not there). **The planner**'s line on a night runs the general shift and the night
  (`plnBase` `lines[l].night`, the schedule in force whatever today is); the night crew's wages are the book's once paid, never
  charged into *as it runs*.
- **The barrel's loading EXTRA** counts barrels, not batches: only batches naming their barrel, each once, the morning's unloading
  of the evening before's included; a batch naming none leaves the window not checkable.
- **A data flow changed**: `S.lineShifts` travels with the book (backups, GitHub, the merge; in the change log as *shift schedule*).
