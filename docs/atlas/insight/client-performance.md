---
subject: "Client performance"
domain: insight
modules: [split/client-perf.js]
specs: []
tests: [P118]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Client performance
Clients tab → **Performance**. One account at a time: month on month as revenue, tonnage or ₹/kg,
and every part it handles sorted into **stopped / new / steady / one-off**.

Stopped is the reason the view exists. A part that disappears raises no error, empties no queue and
never appears as a loss — it appears as a slightly smaller month, twice, and then it is normal.

**Cadence is measured against each part's own rhythm, not a fixed cut-off.** A part is overdue when
the gap since its last appearance exceeds `max(typicalGap × 1.75, typicalGap + 21 days)`, where
`typicalGap` is the median of its own intervals. A fixed "absent two months" rule would call every
quarterly part dead; the 21-day floor stops a part shipping twice a week being flagged after nine.

**Both spines feed it.** Invoices are the complete record, but material arrives before it is billed,
so a part received last week and not yet invoiced would read as overdue on the billing record alone.
The union answers "when did we last handle this part" — and a part that only ever arrived shows
*challan only* rather than ₹0.00, which would read as worthless work rather than unbilled work.

**A rename is flagged, not reported as lost business.** Part numbers vary in spelling between
documents (`Clamp 165x83` against `CLAMP 165X83(40X6)`), which would surface one stopped part and
one new one. Stopped/new pairs sharing a six-character stem are marked as possibly the same part —
reporting a rename as lost work would discredit every other row on the card.

**A part is its size or number, and its gauge** (`cpPartIdentity`; owner, 30 Sep 2026: *"some items like 149x83 are still coming but
the flag is being raised"*). The same clamp was written `CLAMP 149X83(40X6)` to July and `149X83` (the gauge in the description) from
August, and keyed on the whole text the older spelling read as stopped. A part naming a size (`149X83`, `150X80X3`) is that size, a part
with no digits of its own (`CLAMP`) takes the size from its description, anything else is its number; the gauge (two digits × one) is
never a size. Stats' top items read the same identity. A row naming no gauge that stopped while the same size still comes in a stated
gauge reads steady (*no gauge written*); a stated gauge that stopped beside a live one stays stopped and says which still comes
(`cpSiblings`). On the real book to 11 Sep, SSS Mehta's stopped parts went from 73 to 66 and 149X83 reads steady.

**Materials worked** (owner: *"every material worked, how much and when … how many clamps were sent by SSS Mehta in any given period, how
many by [another client]. If two parties share the same material code, the distinction must be mentioned"*). Performance → *Materials worked*: a
period (this month, 3 or 6 months, the FY, all, or dates), a search over part, size and description (*clamp*), and **This client / All
clients**. Each part is one client's: pieces and kilograms sent (a kilo challan's counted pieces included), challans, invoices, what was
billed, first and last; it opens to every challan and invoice by date, each a link. A code another client also sends says so (*Code
shared · BETA AUTO also sends it: counted apart*), here and on Stats' top items (`cpCodeOwners`). P118.

**By the hour** (owner: *"Samarth part is done in pieces, 3302 - 9/pc takes about 30 mins … 24 pcs at a time in VAT A2. 3303 - 3/pc …
80 pcs at a time … there can be a different realisation and cost that is calculated on per hour basis"*, then *"have an option to update
the time taken to pickle and plate + a constant 15 mins (logistics + other steps) for every material … fill these out with the production
data … make sure the app learns from the data that is being entered, so we can evaluate if the time taken is increasing or decreasing, and
what steps we can take to optimise setups"*). Performance → *By the hour*:
- **A round is pickling + plating + the constant** for logistics and the other steps (`S.perfCfg.overheadMin`, 15, set on the panel). Each
  figure is the owner's where set on the client (`client.partTimes`: pieces, `pickleMin`, `plateMin`, the line; Samarth's two set once,
  plating 30, `_partTimes1`), else **what the production record measures** (`cpMeasure`, `cpMeasured`): the register's round-to-round
  gaps on the line (5–180 min; across noon on a 12-hour clock), a START–END batch's span over its rounds, the pieces a round from the
  rounds' own figures, and pickling as the gap from a load to the pickling hand's next load that day (5–120 min) a piece × the round's
  pieces. Every figure says *set*, *measured* or *not known*.
- **What an hour earns** is a round's pieces × the rate (a kilo rate through the part's kg a piece) over the round's whole time, against
  what an hour **costs** the plant and **earns** it on average (the last 90 days at the live cost, over working days × 3 lines × 16 h,
  `cpLineHourRef`, the assumption said on the card). The period's pieces billed become the hours of rounds they took.
- **It learns as entries come in**: the measure is read afresh from the record every time; parts the record has timed and nobody has
  set are listed too (*from the record*). A part opens to its record, a chart of the median round by pay week, and **what to look at**
  (`cpRoundHints`): a round 10%+ slower (or faster) in the last 30 days than the 60 before, racks run short of their fullest, the fixed
  steps a quarter or more of a round, pickling slower than plating, and a set plating time the record no longer bears out (15%+ off on
  5+ rounds), with **Use** to take the measure. A changed time keeps what it was (`history`).
On the real book to 11 Sep (before Production existed, so no round is timed yet): an hour costs the plant about ₹489 and earns ₹466.
