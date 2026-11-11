---
subject: "The planner"
domain: floor
modules: [split/planner.js, split/planview.js]
specs: [docs/PLANNER.md]
tests: [P162, P245]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### The planner
Home → **Planner** (in its Insights; Today's until UI pass 3, Office's until the tab map of 9 Oct 2026; `planner.js`, `planview.js`; `docs/PLANNER.md`; owner, 6 Oct 2026: simulate machinery, certification, staff,
clients and a loan as a game whose every figure adds up, *"it is fine on a macro level but doesn't work on a micro level"* on the
prototypes). P162.
- **Four views: Play · Ledger · A day · Moves** (the tab map, TM2d; eight until then), Moves a switch over Plant · Tech tree · Staff ·
  Clients · Finance. One verdict card leads every view (the plan's margin a month against the goal), and one toolbar row (Roll, the
  month, the plan where there are two, More). *The tab map: Today (TM2)* above.
- **A month is built from the book's parts up** (`plnBase`, `plnMonth`): the last three full months' invoices by client and part
  (`statsInvoices`, `lineWeightKg`, `cpPartIdentity`), each part on its own usual line from the production record, else its client's,
  else VAT A2 (*assumed*). A line plates **kg a round every so many minutes** (from the register's rounds a day against the book's
  kilos; a line with no register *assumed*, and *fitted to the book* where the assumption could not have plated what was billed), in
  the general shift, then the morning block, the evening, a night shift with a night crew, less the Power tab's cut minutes in working
  hours; pickling runs as long as the lines need it within the day (assumed at today's kilos with a tenth to spare until set). Costs are the live cost's own lines per kilo, labour as recorded, a fixed electricity part (assumed
  ₹15k), ₹260 a new overtime line-hour (assumed). **As it runs reproduces the book's average month** (a spec checks it).
- **A move changes an input, never a total**: an ask a part's rate (a ₹/kg where lower, a percentage on a piece client, or a rate
  typed on one part), held-back work new parts on a line, an upgrade a line's kg a round or minutes or pickling or the cut cover, a
  hire a wage (paid from when it can start, never while it cannot take effect), a loan its amortised schedule. A move takes effect
  after what it needs (`plnReady`); one that never can is hatched. Weighted by each chance, a move counts at its own chance times its
  prerequisites' (`plnWeights`).
- **Every option carries its details, and the plant register's units feed the plan** (owner, 28 Oct 2026: *"We have Acid recovery
  and fume hood. How much acid recovery can be done? What would the fume hood give us? … The details under most of the options are
  missing. Also, under machines and infrastructure we already have the machines that are down or need repairing, but we do nothing
  with that information on planner"*; the four questions answered the same day; P245, `docs/PLANNER.md` §3.5):
  - **An option folds open** to what it needs (`req`, and the moves it needs in the plan), each figure it rests on with its badge
    (**set** in `cfg.fx[id]`, **measured**, **estimate**, **not set**; `plnInputVals`), its cost (blank where no estimate is honest:
    *cost to set*) and what it adds to the month on show; **Set figures** and **Cost**, behind Settings' permission. A move's effect
    is read from its figures (`plnFx`).
  - **Acid recovery** is the share recovered × HCl used a month × what each litre less bought saves (carriage included), off the
    Ledger's chemicals (`chemSave`), + a second share (the spent acid less sent away) × the spent acid sent away × what each KL
    less sent away saves, off its effluent row (`effSave`: nothing while the bill is the same whatever is sent, a trip's bill over
    its KL where each trip is paid for), less its running cost; nothing until the share recovered is set, the second leg included; the flat ₹6,000 "less acid bought" had nothing behind it. HCl used a month is read
    as the stock line's page reads it (`plnHclMonth`: `stockRate` × 26), never from a window a bill opens; with no use recorded,
    what came in, an estimate. **Fume extraction
    and scrubber** is its own option with a running cost (an estimate until set), and ISO 9001 and CQI-11 need it. Pickling's
    options stand alone (`alone`).
  - **The approved load on the bill** (`load50`) saves the excess-load penalty the bills carry (`plnPenaltyMonth`: the median of
    the last six bills since approval that state one, *measured*; nothing once the approved load is billed; an estimate of ₹5,000
    only while no bill states a penalty; owner, 28 Oct 2026: *"Yes"*).
  - **Units**: every line's figure is the line as it runs today, on its units working (`pltCapacity` says how many); each unit down, under repair or in need of work is a move under **Repairs and sales** (`plnUnitMoves`): bring it back
    (its share of the round, its risk ended), overhaul it, or, marked *Not coming back* on the unit (`u.gone`), sell it (cash in
    at the price set). A running unit in need of work or ageing with no risk typed may fail at an estimated chance
    (`PLN_RISK_DEFAULT`) until its repair lands, stopping its share of the line; a unit on standby fails only at a risk typed on
    it. A unit's share counts tanks and barrels only, each on its own station's line (`pltPlates`, `pltLineOf`): the unit's *Line it
    serves* is read only for a rectifier or another supporting unit, whose row under *Repairs and sales* names the line it serves
    and moves no figure (in the trials its failure stops that line whole).
    *Another barrel* adds one barrel's share. A move with no cost set is said on the verdict. Plans saved before gain the fume
    extraction once (`_plnHood1`).
  - **A data flow changed**: `S.planner.cfg.fx` and a unit's `gone` travel with the book (backups, GitHub, the merge). Acid
    recovery's KL figure is `dispLessRs` since 29 Oct 2026, when its words changed from what sending a KL away costs to what a KL
    less saves; a figure typed under the old key (`dispRs`) is not read.
- **The ledger adds up** (`plnAttribution`): today's margin, then each move in the order it takes effect, each the plan up to it
  against the plan before it, ending in the plan. If every move lands, or weighted by each chance.
- **The trials** (600, seeded): each chance, CQI-11 up to three months late, the promotion's pass, each machine's risk until the
  upgrade that `fixes` its station, a month's cuts at 0.6–1.5 times, a piece client refusing and sending less from the month after.
- **The baseline is cached on the book's saves** (`_bookWrites` in `plnBaseKey`), so an edited rate or wage reaches it at once. A
  figure typed on the page is saved on change and the page redrawn after the tap that left it has landed (`plnEditTyped`); a
  sideways-scrolled ledger or board keeps its place across a redraw.
- **The registers are records** (`S.planner`: machines, checklist, lenders, heard, heldBack), behind Settings' permission, retired
  with a reason, in the change log; **a scenario never writes the book** (`S.planner.scenarios`). The goal's margin is today's
  raised (₹45k Normal, ₹95k Hard), never a rupee figure written in. Costs of upgrades are estimates, each the owner's to set.
- **Links**: To-do `plnCheck` (a checklist item due) and `plnMachine` (a machine needing work); Knowledge → *Using the app: the
  planner*; **Make the report** prints the plan in the report generator's frame. A money page for the guard.
