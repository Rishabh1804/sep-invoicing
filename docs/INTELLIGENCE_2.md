# Intelligence, refined

Owner, 6 Oct 2026: *"Let's refine the intelligence system."* Measured first, on the owner's book of 6 Oct (kept out of the
repo): 23 tasks raised, 6 red. Volume was not the problem. **Trust was**: the loudest findings rested on figures nobody had
been asked about, and nothing on screen said so.

- *"SSS Mehta is below its variable cost, loses ₹2,35,099.84"* read September's variable cost at ₹8.98/kg (June–August
  ₹5.5–5.9). Zinc was 451 kg charged after a delivery on 24 Sep, as the supervisor's messages say, **plus** the 22 days
  before the stock record began filled at the model: a lump charge and a pro-rata fill counted for the same month.
- The 28 Sep stock message had been saved by the reader before 30 Sep's fixes: "VAT A 2" read as 2 kg of zinc, "65 M 54 LTR
  use 3+3+9=15" as a count of 3 and a use of 54. The uses were then typed by hand beside it.
- The four stock reds were read off counts eight days old, in the present tense.
- *"Oct is realising ₹7.14/kg, the lowest in 7 months"* was five days of October.
- Labour "recorded vs paid 58% apart" counted every self draw as wages. **Owner, 6 Oct 2026: self draws are personal
  drawings as well** as cash wages.
- "In-time roll usually by 1:33 PM" is when the owner pastes: no saved roll carries WhatsApp's send time.

## The order (agreed 6 Oct 2026: *"Order works"*)

| Step | What | State |
|---|---|---|
| I1 | **An entry is checked before it is believed.** Stock entries that do not fit; stock messages read differently now. | Built (P156) |
| I2 | **Confidence on every finding.** How old and how complete its record is; a stale record is never red, an early month says so. Self draws: cash wages up to the week's payout, the rest drawings. Zinc charged in lumps measured against its bills. | Built (P157) |
| I3 | **One ranked list**: ₹ at stake × urgency × confidence; per-client tasks folded; one card per client. | |
| I4 | **The change explained**: realisation, margin and cash moves broken into their causes, each with its ₹. | |
| I5 | **Learning from responses**: snoozes, actions and ignores tune rank and thresholds, suggested, never silent. | |

## I1: an entry is checked before it is believed

`stockEntryChecks(itemId)` (stock.js) says, entry by entry, what does not fit. Warn, never block: a figure can look odd and
be right, and **It is right** keeps it (`checkOk {at, by}`), never asked again. Voided entries are never asked about; a
correction is a new entry and is asked afresh.

| Check | When |
|---|---|
| `twice` | The same quantity from the other door (pasted / by hand) within 4 days |
| `overlap` | A use typed by hand for a day a pasted message already covers on that line |
| `typed` | A message pasted after uses were typed by hand for the days it covers |
| `below` | A use or charge that takes the replayed level below zero |
| `large` | Over 4× the line's median daily use in the 60 days before (5+ uses); a bath line is not judged, it is charged in lumps |
| `count` | A count over 30% (and 1 unit) from the level the app had |

**Reading the messages again** (`stockRereadDiff`, `stockRereadApply`): every saved message is read with the reader as it is
now and compared with what it holds (a correction standing for the entry it corrected; a use and a charge alike, since a
line's basis can change). A message read differently is listed with both readings; **Use the new reading** voids what the
old reading saved (`Read again on …`) and adds the new entries at the message's own time, so the day's order holds. A figure
voided by hand stays voided; a line the new reading cannot place keeps its entries; entries typed by hand are never touched,
so one the new reading made redundant shows as `overlap`. **A line the owner corrected by hand is the owner's ruling and is
left whole.** **The review's choices are kept on the message** (`paste.choices`, from 6 Oct 2026) and replayed; on a message
saved before, a line placed by position or a balance the owner picked is left as it was. An opening is compared by the figure
the message states, since whether one is saved at all depends on the level before it.

Checks cover the last 60 days, are worked out again only when the record changes, and **It is right** on one side of a pair
(entered twice, or by hand beside a message) settles the other.

Stock → **To check** (`?tab=pageStock&v=check`) lists both; a callout on Overview and Lines leads there, each entry says its
question on its line, a save by hand or by paste says it at once, and the To-do raises one task, `stockCheck`.

On the owner's book of 6 Oct: two messages read differently (the 28 Sep message, and a 24 Sep line whose basis changed and
is not listed), seven entries to check. After the 28 Sep message is read again, the four zinc uses typed by hand are the
only entries left to check.

## I2: how sure a finding is

**A finding that is not firm is never red, and says why** (`todoConfApply`, todo.js). A rule puts `conf: {level, say}` on its
task; a red becomes amber (`toneRead` keeps what it would have been), `say` joins its line, and its figures gain *How sure*.

| Level | Word | Raised by |
|---|---|---|
| `stale` | An old record | A stock line whose last figure is `pasteDays` working days old: *Out on 30 Sep's record* |
| `early` | Early | The month realising low under 10 working days in (`INS_EARLY_DAYS`): to know, not amber |
| `partial` | Partly measured | Below this month's variable cost but not below the six months' lowest |
| `check` | An entry to check | A stock line with an entry to check (I1) |

**Below its variable cost** is firm only where it holds at the **lowest variable cost of the six months to it**; the loss is
said as a range, *at least* at that lowest, *up to* at this month's. On the owner's book: SSS Mehta, September, ₹5.29/kg,
loses at least ₹9,207.83 (at ₹5.43) and up to ₹1,25,223.98.

**Self draws are wages and drawings** (owner, 6 Oct 2026). As cost (`bankCostByMonth`), a pay week's cash is wages up to the
payout recorded for it (`payWeek`) and drawings past it, once 90% of its working days are typed and no hourly hand lacks hours
(`bankCashWeekKnown`). A week short of that is not split: under a quarter of its month's labour, its cash counts as wages (an
upper bound, said on the row); past that, the month's labour is not known from the bank. A delivery of zinc with no price and
no bill beside it keeps zinc off its bills for that window. `cashSwing` asks only when a week is
drawn well short of its payout. On the owner's book June–August cannot be read from the bank now, so *recorded against paid*
raises nothing, where it had said 58% apart.

**Zinc from its bills** (`costZincByBills`): over a period of 28 days or more whose charge record does not cover it, the zinc
bills of the 90 days to its end, per kg plated over the same days, from the first zinc bill on record. July–September read
₹2.34, ₹2.37 and ₹2.21/kg; September had read ₹3.94.

**Today learns an input's usual time from WhatsApp's send time only**: a roll pasted without its header carries the minute it
was pasted, and *usually by 1:33 PM* was the owner's pasting hour. Until three rolls carry their header, the shop's own time.
