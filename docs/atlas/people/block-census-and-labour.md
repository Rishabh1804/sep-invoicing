---
subject: "The block census, comp classes and the labour model"
domain: people
modules: [split/labour.js, split/staff.js]
specs: []
tests: [P116, P119, P144, P145, P149]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### The block census, adjudicated

The extractor was a third instrument reading **8 blocks** where Castor swept 13 and Cipher 17 over
the same four files. It keyed on *heading style* — it required the literal words `6:00 AM block`, so
`| **6:00 AM — VAT A2** | … |`, the shop's commonest morning shape, matched nothing at all. Keying on
what a block **is** rather than how it is written — a slot outside the 8:30–5:00 general shift
carrying its own tag — finds four surface forms, all real: the table row, the prose line, the `###`
heading (W24's only block, which is why that file counted zero), and the `Out` row.

**Result over W24/W31/W32/W33, weekly files only, corrected instrument: 14 distinct blocks,
19 tagged rows** *(an earlier 15/19 counted a phantom — Wed 29's general-shift `EXTRA 8 HOURS`
mangled into a Tue-28 morning block by the unparsed combined heading; Castor caught it)*. **Adding
the tags the weeklies transcribed away** — W31's Mon-27 morning `Extra 9 hours`, Mon-27 evening
`Extra---3 hours` ×2 and Tue-28 morning `Extra---3hours`, all literal in the raw relay —
**gives 17 blocks / 23 rows: exactly Cipher's count. The census disagreement RESOLVES.**

- ✅ **Cipher was right twice.** The `Out` rows are tagged blocks (Castor's key excluded them — 4 of
  W33's rows, `:63` among them, and `:63` is the surviving named exception, so it cannot sit outside
  the population). And the man-hr lines Cipher counted as tags ARE tags — in the raw relay, which is
  the primary source the weekly was transcribing.
- ⚠ **The three sweeps disagreed because they counted different corpora, and none said which**:
  Castor the weeklies minus the `Out` shape (13/18), this extractor the weeklies keyed on heading
  style (8, then 14/19 corrected), Cipher the population as the raw records it (17/23). The
  instrument note that matters: **a census of the shop's tags must be run on the shop's own
  messages; the weekly is a fair copy, and fair copies normalise exactly the marks being counted.**
- **Genuinely untagged blocks remain real and outside the tagged census** — Wed 29's and Thu 30's
  morning OT, and **Thu 30's** midnight block, which the file flags at `2026-W31.md:88` as *"No
  EXTRA tag on this block"* *(an earlier version attributed that flag to Tue 28's midnight block —
  Tue 28's IS the tagged flagship; the flag two lines below it belongs to Thu 30)*. They import as
  worked slots with crew and times and book nothing, which is what the ruling predicts for a slot
  that ran at complement (Thu 30: 4 + fold 2 = 6 present → short 0 → predicted 0 — *the rule
  working, not an anomaly*).

**A block naming no area is now KEPT rather than dropped.** Two census rows state hours purely as
out-times without naming a line. Dropping them took real booked hours out of the bill; they import
with empty areas, report as *Not checkable*, and bucket their cost to `flex`. Unverifiable is not
unpaid.

**And a fourth EXTRA notation surfaced while fixing this: a COLUMN.** `W29`, `W30` and `W31` write
`| Area | Workers | EXTRA |` with a bare `**16**` rather than an inline tag. A two-column matcher
read none of it, so those three weeks reported **zero booked hours** — not because the shop booked
none, but because the sheet had grown a column. **W29 0→14, W30 0→8, W31 1→8 tags.**

**Four states, not three.** Unmarked is not absent. A row nobody has reached costs nothing; an
absence costs a day's wage and has to be said. The same distinction one level up is what the
coverage figure is for: a day with no attendance key is a day nobody typed, which is not a day
nobody worked.

**What "the extra" is.** The daily sheet books hours two ways. Named men carry their own
out-time — that is OT, per worker, at their hour rate × 1.1. But every day also carries lines
like `EXTRA 16 HOURS` written against an **area block**, with nobody attached. They are real
paid contract-tier hours and the payout sheet settles them. In the **bill** they stay exactly
that: hours booked to an area, under the EXTRA line, counted once — the fixed-versus-variable
split never depends on how they are shared out. Who *receives* them is ruled (28 Aug 2026):
the short area's present crew, pro-rata, disbursed by the supervisor on the floor — the card computes
that split; the cost accounting does not move.

**Fixed and variable are kept apart everywhere.** Fixed is the monthly tier — its days and its
gated rest days together. It moves with that crew's attendance but not with tonnage, which is
the distinction the split exists to draw. Variable is the hourly pool, the daily tier, OT and
extra. That split is not decoration: the SSS Mehta decision turned on it — at fixed labour
that account still contributes ₹0.53/kg, at volume-scaling labour it loses ₹1.64/kg — and one
blended labour number silently picks a side. **The owner ruled the contract labour fixed on 13 Oct
2026**, so Stats' contribution counts all of labour as fixed; this split still says what the pay is
made of (the standing crew, and the pool paid by the day and the hour).

Every constant — multiplier, both gate thresholds, the daily tier's weekly rest credit, the
extra-hour rate, and the modelled ₹/kg the measurement is reported against — lives in Settings.

**Variable labour is broken down by area** — contract days, rest credit, OT and the extra,
placed by the area each was worked in, ranked by cost rather than by days because an area that
pulls the overtime is the expensive one. That is the *allocation* half of the open question.
The monthly tier's day pay and rest days are deliberately absent: that crew is the standing one
and its cost does not follow the area it happened to stand in. Its **overtime is** in there —
an overtime hour was worked somewhere specific and was paid for being worked.

**An incomplete range reads low, never neutral** — every tier is paid for days and hours actually
recorded, and the monthly tier reads low *twice*, because a day nobody typed also depresses the
attendance its rest-day gate is judged on — so the card states coverage in place, every time, complete or
not, and withholds ₹/kg below 90% of working days. It withholds under a fortnight too, but for
a different reason: not enough of either side to divide. The lag between plating and billing
cannot be gated away at any length, only stated, so a range under two months carries that
caveat next to the figure. And a ₹/kg computed over partial tonnage coverage reads **high**
here — the opposite direction from realisation, because tonnage is the denominator — which the
card says rather than leaving the reader to work out.

**Day is a board, a card per area** (owner, 30 Sep 2026: *"Attendance sheet for Day scrolls way too far for information … Overview doesn't
show any staff allocation for Office, gate, flex, civil"*; they chose the area board). Every area with a hand or a number needed is a card
(`data-att-area-card`, `inv-board`: one column on the phone, as many `--board-col` columns as fit on the desktop), its head the heads on
it against the day's number (*Short 1 / Met / 1 over*). Each hand is one line, P / H / A one tap as before; **the name opens the hand's
day** in a dialog (`attEditOpen`: state, area, hours or OT, saved as they change). The absent are one strip under the board
(`attAbsentList`), *Needed today* and the day's cost fold (`uiFoldCard`, state.js, folds any panel whose head holds no button). Pay leads
with the payout and dues, its history and the slips as paid folded; Areas folds its hours and the absorption. **Civil** is an area
(a post, off the floor, like the office and the gate; a roll heading *civil* reads to it). **The attendance panel** (Floor → Overview's
People card, Home's *Attendance today* widget) says where everyone on site stood, by area, the floor against its number. P119.

**In and out are typed by hand too** (owner, 1 Oct 2026: *"Attendance has no option to enter time in and time out by hand, so we
have to rely on whatsapp message only, there is no way to simply enter the data that is presented to us by Deepak in his sheet"*).
The hand's dialog takes an **In** and an **Out**, and People → Attendance → Day → **Sheet** (beside **Board**, kept per device,
`sep_inv_att_day_as`) is Deepak's sheet: the day's roster in its order, one row a hand with P / H / A, the area, the in and the out,
and the hours and OT worked out as each is typed. One rule for a roll and a hand (`relayHoursOf`): the span to the whole hour, OT the
hours over 8, none for an hourly hand or the gate. A side left blank is the shift's (8:30 AM to 5:00 PM, the gate 7 to 7, a half day
four hours from its in); an out not after the in ran past midnight; absent clears the times. A typed time makes the mark the hand's
(no `src: 'relay'`), so a roll never rewrites it; an OT typed in the dialog wins until a time changes. EXTRA rows were already
entered by hand below the board. P144.

**A hand's OT shifts carry their own area** (owner, 1 Oct 2026: *"there is also no way to record which area the OT workers actually
worked on, we get to select one option for the entire day. Every worker can have states, like morning OT, General, Evening OT, Late
night OT … right now we just select the General shift areas and OT areas are neglected, both in the app and in Deepak's sheet"*). The
mark's area is the **General** shift's; **Morning OT**, **Evening OT** and **Night** each take an area, on the hand's dialog and as
columns on Day → Sheet and on Deepak's printed sheet (`ATT_SLOTS`). **The hand's pick is a fact of the day, kept apart from the marks
and the EXTRA rows** (`rec.slotHand[staffId][slot]`: the area, or '' when taken off by hand; the QA chain of 2 Oct 2026). The slot's
crew is still the one record Areas, Power and Production's crews read: `attSlotsApply` puts each pick on the roll's block of that slot
covering the area, else on a block made for it at the slot's usual times (`slotMade`), and a made block goes when its last hand leaves.
A made block books nothing and is nobody's EXTRA row (`attExtraRows`): not on the EXTRA card, the printed sheets, History or the Areas
check. A pick never makes a roll's row the owner's, survives *Read the rolls again*, and a crew chip toggled on a block drops the hand's
pick for that slot. A block's slot is read off its start (`attBlockSlot`: before 8:30 AM the morning, from 5 PM the evening, from 8 PM
or past midnight the night). **Overtime is booked where it was worked, by one split** (`attHoursSplit`, read by Labour, the Areas card
and Hours by area): a monthly or daily hand's OT in their slot's area, else the general shift's; an hourly hand's hours past eight on a
slot move there as hours, never as OT (the tier has none). P145, P149.

**People → Attendance → Day takes typing as typed** (the QA chain of 2 Oct 2026): a change in a field redraws everything around the field and its
holders, never the field (`attRedrawAround`, `attSwapAround`), and a tap on its way lands first, so a time typed with the keyboard and a
tap on Done after an OT are kept. **Every entry there is a floor entry** (`attFloorOk`): a role that may not make one is told so, never
asked a PIN. A role that may not see wages sees hours and heads, never a rupee, and the worker's sheet keeps the rates it does not show.
An out the shift supplies that is not after the in is no out (0 h until typed); P↔H with times works the hours again; a move of area
works them again only onto or off the gate.

**A day's attendance is deleted only with a reason, and the deletion is logged** (owner, 30 Sep 2026: *"there is no way to
delete a day's data after providing a reason that can be logged"*). People → Attendance → Day → **Delete this day** asks why (required),
moves the whole day to `S.attendanceDeletes` as it was (`attDeleteRecord`: key, reason, when, the marks and EXTRA counts,
the day itself), and History lists it. A day saved under no date could not be opened, so a start-up pass moves every
key that is not a date to the same log (the book held one keyed `"null"`, 23 marks; owner: *"delete the attendance day
saved under null, the day it was for was added correctly"*). The day's heads-needed figures are not attendance and stay.
P116.

**Deletion is refused while attendance names the worker.** Removing the row would not remove
the marks, it would orphan them: every past week's labour would quietly drop that wage and no
figure would say why. Clearing Active keeps the history and takes them out of today's
denominator, which is what "left" means here.

🔧 **That was true of the roster and false of the bill until 25 Sep 2026**: `labourForRange` priced only the
active roster, so setting a leaver inactive dropped every day they had worked from every past week, month and
payout median. It prices every worker whose marks fall in the range now; `rosterSize` is still the active count.
Paid holidays count as rest days in the coverage, not as working days nobody typed.
