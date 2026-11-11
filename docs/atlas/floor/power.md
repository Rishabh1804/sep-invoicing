---
subject: "Power"
domain: floor
modules: [split/power.js, split/powercause.js]
specs: []
tests: [P177, P196, P243]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Power
Floor → **Power** (`power.js`; owner, 30 Sep 2026: *"Make a power cut tab, we have built a business
case for power cut and how to resolve it, find it, read it and update it"*). Four views since the tab map (TM4e): **Cuts ·
Causes · Load & bills · Case**, each led by its verdict card (the Overview went: its month, cost and year are Cuts' card and Floor's
Power hero). The case was written once, on 30 May over 56 days (soma-internal `archives/2026-W21-W22-session/13-…`); this page
keeps it current, and `soma-internal/reports/power-cut-case-2026-09-30.md` is the dated refresh.

- **The cuts are Production's** downtime entries (the register's power log, the relayed messages, a cut entered by hand)
  and the history imported from soma-internal's power-cut log. The same cut reported twice is one (`prodDowntimeDay`); a
  power-back earlier on the clock than the cut ran overnight. Enter a cut opens Production's hand form on a power cut,
  dated today: only Lines' own Enter by hand starts on Lines' day and line (Add's by hand too opens on today).
- **A cut is completed where it is shown** (`powercause.js`, P177; owner, 8 Oct 2026: *"If we enter a power cut and save it
  without giving an out time, there is no option readily available to fill in in time and the reason + solution. For reasons and
  solutions, start remembering them and present them as a list … store them in uniform format, no matter how the input text is.
  Use the intelligence system to tie this to the plant and present it in a visual form"*). One dialog (`pcsOpen`) from Power →
  Cuts, Production's entry, Today and Needs you's tasks: the power-in time, why it went, where it hit (the whole plant, a
  station, or a unit of the plant register) and what brought it back, written on every report of the cut with who and when
  (`downtime.reason`, `fix`, `where`, `unitId`, `note`, `setAt`, `setBy`; a time typed here `closedHow: 'hand'`). A time the
  register or a message wrote is the record's and is never typed over; one the record only bounded, inferred or was typed here
  can be set. Completing an open cut in place follows the paste that closes one (`closedBy`): an open cut waits for its end.
- **Reasons and fixes are a list the book keeps** (`S.power.causes`, in the change log and the merge), started from nothing.
  Each has one name written one way (`pcsCanon`: sentence case; spaces, punctuation and "sub station" evened; the shop's codes
  and a 2–3 letter code typed in capitals kept in capitals, kVA and VAT A2 as written; common misspellings fixed) and keeps every
  spelling typed for it. What is typed is matched first (`pcsKey`: the words in any order and case, endings and a typing slip
  folded; near where most words are shared or every word of the shorter is in the longer): *Read as …* with **Keep as new**,
  never taken unseen. The list shows as chips, the most used first, a fix the reason was brought back by before leading; a
  reason's usual place moves *Where it hit* until it is picked. A reason says where it starts: **the grid**, **the plant** or not
  known. The owner renames, places and merges (a merged entry points at the one it joined, so every cut keeps its reason).
- **Power → Causes** reads it for the plant: what causes the cuts ranked by what they cost (each cut's damage), coded by where
  they start (red: in the plant three times in 30 days; amber: in the plant; blue: the grid; grey: not placed); where they hit,
  a tile per station; what brings the power back, fastest first; the lists. The plant register says the cuts tied to a unit
  and a line (`pcsUnitHtml`, `pcsStationNote`). To-do **`powerComplete`** (a cut with no time back in 30 days, amber, or no reason
  in 14; imported history never asked) and **`powerCause`** (a cause not from the grid 3+ times in 30 days, red at 5; one from the grid at 5, amber),
  whose moves get the unit checked or take the supply's case up.
- **The production export carries the list** (`powerCauses` in `sep-production`): its cuts name reasons by id. An import merges
  it by id, never writing over; one written the same way as an entry here joins it (`pcsMergeImport`).
- **What a cut costs is its damage, not its price** (Iuno's audit of the 30 Sep refresh, H-1; owner, 30 Sep 2026: *"also
  take into assumption OT that we had to do following the power cut due to the backlog of material it creates"*). The work a
  cut stops is either made up in overtime or never made. Made up, the cut cost that overtime; never made, it cost the
  output's contribution and the wages that bought nothing. A restart (a flat figure a cut in a working window, the one set in the options' figures,
  the book's own: the owner, 26 Oct 2026; blank, the 30 May case's ₹600) is paid either way (**not measured**, and said beside
  the total). So damage = restart + catch-up overtime + (1 − share made up) × (contribution + platers' idle wages).
  - **Catch-up overtime** (`powerRecovery`): a cut in working hours puts its own day and the next working day at risk. Each
    such day's overtime (`powerDayOt`: monthly and daily hands' OT at their overtime rate, an hourly hand's hours past eight,
    and the EXTRA on OT blocks; the general shift's EXTRA covers a missing hand, not carried-over work, and is left out) is
    set against the median of the clean recorded days **in the same month**, at least four. What is above it is shared
    among the cuts by their dark working minutes, after taking off the idle wages already counted for a cut past the shift.
    **The Governors' re-audit bounded it** (N-1, N-2):
    - **Each cut's share is capped at the hand-hours it stood idle**: a 13-minute cut had been billed 30.
    - **A night hold is a shift and never counts** (`powerIsNightBlock`: from 8 PM, or on past midnight into the morning;
      owner, *"night hold is night shift"*).
    - **Nor does the EXTRA of the block a cut fell in.**
    - **The baseline is the cut's own month.** The record held different overtime from month to month: block EXTRA was 21 h
      in May and 573 in August, and the monthly crew's OT was recorded only from September. A ±30-day baseline measured
      that change.

    It is still **an upper reading**: a day running late for an urgent order reads the same. The share made up is those
    hand-hours over the platers the cut stood idle (everyone present where no plater is recorded).
  - **Contribution**, not revenue: realisation less the variable cost (everything but the monthly crew) over the last 90
    days, read at the live cost and at the typed full cost less the same crew; **the lower share is used** (`powerMargin`).
    On the real book the live cost read ₹4.65/kg with chemicals recorded at ₹0.16/kg, which would have made a lost hour
    worth 56% of its price; the typed cost gives 6%. Revenue at stake (minutes in a working window × revenue per scheduled
    hour) is shown as the upper bound and never added; so is the fixed charge, paid whether the power is on or not.
  - **Idle wages are a range** (Iuno H-5): platers (VAT A1, VAT A2, barrel) up to everyone present, since pickling runs
    through a cut. A hand is placed **where they stood at the time**: an OT or night block's named crew on the block's line
    (a pickling hand in a VAT evening block idles as a plater), the general shift on the mark's area. Before this an
    evening block's crew read ₹0.
  - **A cut with no time back is costed at the median length of those with one**, never to the end of the day; a power-back
    the log gives only as a bound (`downtime.atLeast`, "after 7:16 PM") ends at the later of the bound and the median, and
    stays out of the median. A close the record inferred (`downtime.inferred`) and a single-phase fault (`downtime.phase:
    'single'`, counted as dark) are said on the row and in the case.
  - **The options' gain is the year's damage × the share each covers + TSUISL's tariff saving − running and upkeep**, the
    running hours being the dark working hours; the inverter's coverage is measured on the dark working minutes it would have
    carried (Iuno M-3; on every dark minute the overnight cut pulled it to 84%).
- **A day with no record is a gap, not a day without cuts.** A recorded day is a working day with attendance or a plated
  entry; a cut alone does not record its day (April's handwritten log has no floor record around it and read 1.38 cuts a
  day). A run of recorded days with no cut, long enough that at the record's rate three or more were expected, is read as
  **possibly unreported** (`powerQuietRuns`): named in the case, left out of the year ahead, of each month's rate (a month
  with under five days left reads a dash) and of the best and worst months. The rate counts only the cuts on recorded days
  (Iuno H-3: April's cuts on days with no record had been divided by recorded days, which made 11–15 May look quiet), and a
  cut on a Sunday worked ends a run. "Possibly unreported" is a fact about the app's record, not about what was sent: a
  stretch no export has been read for yet reads the same.
- **The load is recorded** (owner: *"Yes, record it"*): `S.power.load` {sanctioned, approved, approvedOn, ref, note}, set
  once to 25 / 50 kVA approved 18 May 2026 where empty (`_powerLoad1`). A bill's own details are set on Load & bills
  (`POWER_BILL_FIELDS`: billed at, peak, kWh, kVAh, fixed, energy, excess-CD penalty, fuel adjustment, duty, net), and a
  bill's "billed at" wins over the typed load. To-do rule **`powerLoad`** asks while the approved load is not on the bill,
  with the penalty on the bills since approval.
- **Power's figures are the owner's settings** (owner, 28 Oct 2026: *"Power - yes, ask for PIN"*; P243): the options' figures, the
  load and a bill's details save behind `grdGate('settings')`, the PIN asked over the dialog once the re-ask window has passed; a
  role without Settings is told so and nothing is saved.
- **The case is a document drawn from the data every time it is shown or printed** (owner: *"The case report should
  always be printable, and it should be dynamic - updates data as soon as the data feeding it is updated"*;
  `powerCaseHtml`). Case shows it on the page; Print the case sends the same document to the print view, and a save in
  this or another window redraws both. Ten sections: in short, the record by month with its recorded days, when cuts come
  (noon – 2 PM), what a cut costs with the ten costliest, a year at this rate, the connection, the options (TSUISL,
  inverter, generator: one-time, coverage, running, gain, payback; the inverter's coverage measured off the cuts at its
  hours), the recommendation, open items (set in Options' figures) and what is not counted. The options' figures are the
  30 May case's estimates until a quote replaces them.
- **Import history** takes one file: its cuts as `sep-production` (merged by id into Production) and under `power` the
  bills' details by month and the load. A file with no cut and no bill in it is another screen's and is handed on (P196); one
  with cuts merges whole, and the toast counts the cuts apart from its other entries (it had called every entry a cut). A detail fills only an empty field; a bill the file records is added where the app
  has none for that month, **at what was paid** (`paid`, else `amount`), with the bill's net payable kept as a detail and the
  basis in its note (Iuno H-6: which of the bill's figures is "the" bill is still BM's question); a month described without
  an amount is counted, never invented.
