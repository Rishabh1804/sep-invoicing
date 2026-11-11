---
subject: "Stats in tabs, the questions, one ranked list, why it moved, learning"
domain: insight
modules: [split/intel.js, split/learn.js, split/why.js]
specs: []
tests: [P120, P158, P159, P160, P185]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Stats in tabs, and the questions on Home
Stats was three tabs over one period chip row from the tab map (TM2b, 9 Oct 2026; five from 25 Sep 2026, owner: *"break up the stats
page into multiple grouped tabs"*) to UI pass 3's U3 (4 Nov 2026), when it became a Dashboard and its Tables (*UI pass 3: Stats as a
dashboard*, above).

- **The owner's questions, each a story, are Home's question widgets** (Today → Pulse's until UI pass 3; owner, 30 Sep 2026: *"Stats view needs an overhaul, it puts insights front
  and center and doesn't present itself in a really engaging way"*; they chose question-led story cards, `statsStoryCards`, intel.js;
  Stats → Overview's until the tab map):
  *Are we making money?* (realisation and what a kilo leaves, six months against the cost), *Who is driving it?* (the four largest
  clients by tonnage, the worst-priced large account, the biggest mover against the period before), *Is the plant full?* (capacity and
  tonnes by month), *What changed?* (the month's pace and the three most urgent insights) and, with a statement, *Is cash coming in?*.
  Each says what it means in one sentence with its tone (`data-story-say`). They read the figures the widgets beside them read: on Home,
  *Why it moved*, *The period in figures* and the pace are widgets of their own; the headline is Stats' verdict, the six months the Tables' By month (Trends' both until U3); the insights are tasks on Needs you.
  P120, P185.
- **Every "below cost" on Stats is judged against the period's live cost**, not the typed ₹8.55, so
  Stats' verdict (Trends' headline until U3) and Home's *The period in figures* cannot disagree. The typed figure is used only where there is no tonnage to
  divide by (and still by Items Master's break-even).
- **The period in figures** (a Home widget; Pulse's *In one line* until UI pass 3): realisation, live cost, contribution per kg and on the period (its whole revenue less its whole cost, U3's QA chain), and capacity against
  ~2 t per shift × two shifts × working days. Whatever is not measured is a badge on its tile.
- **Six months** (the Tables' By month and the `months` widget; Trends' until U3): each month at its own live cost, with labour ₹/kg shown only where 90% of the days are
  recorded and the share of cost measured.
- **Credit notes are netted across all of Stats** (owner, 30 Sep 2026): each note's credit is spread over the invoices it names in
  proportion to their taxable (`statsInvoices`, `cnCreditByInvoice`), and the headline, realisation, clients, six months, the trend,
  the insights and Clients → Performance read those net invoices; tonnage is untouched. A note naming no invoice in the book is
  counted apart and said on Stats' verdict. **Home's month to date is net of them too** (owner, 30 Sep 2026: *"yes, it should and
  it should be mentioned"*): the Revenue tile reads *taxable, net of ₹200.00 in credit notes*, and its comparison with the same
  days last month is net on both sides. The tile will link to the notes once the hover previews are built.
- **The trend keeps its own reach** (the last 12 months, 26 weeks or 90 days) whatever the period chip, and shades the chosen
  period on it (`opts.span`), saying so in its Source (owner, 30 Sep 2026; the `trend` widget since U3).
- **Contribution by client** (the Tables' By client since U3; Stats' By client tab before), worst first: net realisation (credit notes whose batch ends in
  the period are taken off), against the variable cost and the full cost, and the ₹ on the period. **Labour is
  fixed** (owner, 13 Oct 2026), so the variable cost is everything but labour (it was everything but the monthly
  crew), and the worst account with 10%+ of the tonnage is settled one way: what it contributes or loses against
  the variable cost, what it lacks of the full cost, the price at which it pays its share, and its share of the plant
  (it was settled both ways: if labour is fixed, if it scales). **Cost is spread per kg**, which
  the table says: a thin clamp and a heavy bracket cost the same per kg there. On the real book for the
  quarter to 25 Sep: live cost ₹7.31/kg (40% measured) against ₹7.96 realised; the piece client (its figures not
  given here) is below its cost even with labour fixed.

### One ranked list
Intelligence step I3 (`todo.js`, 6 Oct 2026; P158). The owner's To-do held 23 tasks, three clients owing over 90 days, six
stock lines and three clients' challans each a row of its own, in the rules' order inside a tone.
- **Inside a tone, a firm finding first, then the larger sum** (`todoAppCmp`). Tone already carries how soon and how sure
  (a finding that is not firm is never red, I2). `todoWorth(t)` is the rupees the task names, read off its own figures: owed
  over 90 days, receipts unplaced, the power penalty, a client's leak, its fall, a quiet client's month, the loss below the
  six months' lowest variable cost, the forecast's low, a challan's open amount. A rule with no sum of its own is 0, never given one.
- **Three or more tasks from one rule are one task** (`todoFoldList`, `fold:<rule>`): worst tone, the members' sum, the three
  largest named, *How sure* when every member says it. Opening it lists each member, which opens as before; it snoozes as one
  (its `sig` is every member's), and its button goes to the list they are worked from (`TODO_FOLD`). Only the shown list folds
  (`todoApp()`, `todoRanked`): a screen's own tasks (`only`), the moves and the questions read every task as raised. The sum is
  said only to a role that sees money. On the owner's book: 23 rows → 14.
- **A client's page lists everything flagged about it** (`todoClientCardHtml`: the detail pane, the edit sheet and Performance),
  unfolded, each opening its task. The per-client rules carry `clientId` (credit note due, gauge unknown, pickled with no challan
  now too).

### Why it moved
Intelligence step I4 (`why.js`, 6 Oct 2026; P159). Home's **Why it moved** widget (Today → Pulse's until UI pass 3, Stats → Overview's until the tab map), for the period shown
against the one before (Stats' own: same days last month, quarter, year), and *What changed?* names realisation's largest cause.
Every cause carries its ₹ and **the causes add up to the change exactly**; the top few are listed and the rest is one line.
- **Realisation** (`whyRealisation`) over the weighed lines, the figure Stats shows: each client's own rate (its share now × its
  change) and the mix (its change of share × its rate against the average before); a client new to the period or gone from it is
  said as such. A cause that rounds to nothing is not listed.
- **Contribution at the live cost** (`whyMargin`): the price (realisation's change × this period's kilos), each live-cost line's
  change per kg × the same kilos (*partly the model* where either side is the model), and the kilos (their change × what a kilo
  left before). *Partly measured* when either period's cost is under 90% measured.
- **Cash** (`whyCash`): the two latest months the statement covers end to end, net in the month, money in by client (receipts
  with no client said) and out by kind.
- **Early**: month to date under ten working days in says so (`whyEarly`, I2's rule), and the sentence on *What changed?* is to know.

### Learning from answers
Intelligence step I5 (`learn.js`, 6 Oct 2026; P160). How the owner answers the tasks the app raises tunes what it raises and in
what order: **suggested, never silent**. To-do → *Learnt from your answers*, and one To-do task (`learn`, the owner's) while
anything is suggested.
- **What is read**: a response, in the book (`S.todo.resp`, the last 400): a task's button followed, a move under it followed or
  added to the list, a snooze, with the days the task had been showing. When each task was first and last shown and whether it
  was opened, on this device only (`sep_inv_todo_seen`: what one screen showed is not a fact about the shop). A fold answered is
  one decision for its members.
- **What is suggested**, per rule over 90 days: **raise** its threshold to twice (challan, dispatch, paste, backup, plated not
  invoiced; capped) or **switch it off** where it has none, when three or more of its tasks were snoozed or stayed on screen a
  fortnight unopened and none was acted on; **lead** with it (first in its tone, after what is firm; `todoLeads`) when three or
  more were acted on, typically within a day.
- **Applied with a tap** behind Settings' permission and PIN (`grdGate('settings')`), recorded (`S.todo.learn.applied`: from,
  to) and **put back** with one. The evidence a change was applied on is spent: only answers after it count. *Not now* keeps a
  suggestion away until its figures change (`learn.dismissed`).
- **Reading never writes** (`learnRead`): drawing the To-do changes nothing in the book. The change log skips `todo.resp` (a record
  of use, like a push's stamp) and logs `todo.learn`, the owner's decisions.
