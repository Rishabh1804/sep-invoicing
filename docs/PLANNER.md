# The planner

Owner, 6 Oct 2026: *"design something in which we can simulate strategies to see how we can improve the plant machinery …
how do we achieve the target of getting the certification of both ISO and CQI-11 … the states would just show on the other
screens, but mainly they can be changed and we'll see what the probability is of what we can do, in that simulation box itself;
the outside just shows the real figures"*. Then a finance screen (a loan, how it is paid back, what rates at the market's level
would bring), then *"this simulation screen should more feel like a gamified experience … these screens are professional, which
is what the reports should be when they are generated"*, then *"There should be an option to create a new card as well. Upgrade
trees should also be there, along with tech tree, staff screen, client screen, daily production screen"*. The last ruling on the
prototypes was *"It is fine on a macro level but doesn't work on a micro level"*: the numbers must add up, the day must be real,
and a move must reach down to a part, a machine, a hire and a loan's terms.

Three prototypes were drawn on the owner's book and handed over privately (they carry the book's clients and figures). This
document is the build. **Nothing about the shop is written into the code**: every baseline figure is read from the book on
the device when the planner opens, and every register is the owner's own record.

## 0. Status

| Step | What | State |
|---|---|---|
| PL1 | The store and the registers: machines, the CQI-11 checklist, lenders, rates heard, work held back; the Planner page | Built |
| PL2 | The engine: the book’s month rebuilt from its parts; lines, pickling, cuts; the ledger | Built |
| PL3 | The screens: Plant (upgrade trees), Tech tree and checklist, Staff, Clients, Finance | Not built |
| PL4 | Play: the board, goals, cards, new cards, the trials; the Ledger; A day | Not built |
| PL4b | The report: the scenario as printed pages | Not built |
| PL5 | Links out: To-do, History, the knowledge base's how-to | Not built |

One PR (owner, 6 Oct 2026: *"start implementation sequentially and run the QA chain once the entire implementation … is
done"*), one commit per step, the QA chain at the end.

## 1. The chain it models

**Invest → certify → raise rates and win work → repay.** A loan pays for equipment; equipment, staff and records make the plant
certifiable; certification and turnaround bring work customers hold back today, and rates nearer the market's; that work repays
the loan. One **scenario** runs through every screen, and a month is added up the same way on all of them.

## 2. The sandbox contract

- **A scenario never writes the book.** It is its own record (`S.planner.scenarios`), holding only moves and their settings.
  Every other screen shows what is real, and the Planner's banner says *Simulation · the book is not touched* on every view.
- **The registers are real records** (machines, the checklist, lenders, rates heard, work held back): entered by somebody,
  logged in the change log, never deleted (retired with a reason). A scenario reads them as its starting point.
- **The baseline is read live**, by the functions the book's own screens use, over the **last three full months**:
  `statsInvoices` and `lineWeightKg` (each part's kilos, pieces and rate), `liveCost` (each cost line per kilo or per month),
  `labourForRange` (the monthly crew, the hourly pool, overtime and EXTRA), the Power tab's cuts, the production register's
  rounds, the bank's latest balance. Whatever is assumed rather than measured says so where it is shown.
- **Every chance is the owner's read**, set on the move and said as *n in 10*.

## 3. How a month is built

The prototypes taught that a lump sum on a card (*+₹15k a month*) cannot be checked. So a month is built from the bottom up,
and the day is the month divided by its working days.

1. **Parts.** Each client's parts over the three months: kilos a month, pieces, the rate as billed (per kg or per piece), its
   ₹/kg, its gauge's thickness, and its line (the production record's usual line where there is one, else the client's most
   frequent line, else VAT A2, said as *assumed*). Past a client's eight largest parts the rest is one row. Lines with no weight
   are revenue without kilos, so the month's revenue is the book's to the rupee.
2. **Lines.** A line plates **kg a round** every **so many minutes**. VAT A1's are measured: the register's rounds per day against
   the book's kilos on A1. A line without a register says *assumed* and can be set. Hours needed = kilos a day ÷ kg an hour + the
   day's cut minutes in working hours. The general shift runs first (8 h), then the morning block (6:00–8:30), then the evening
   (5–8 PM), then a night shift where the scenario has a night crew. Kilos past what a line can run are **left unplated**, and
   the ledger says what they were worth.
3. **Pickling** feeds every line for the hours the busiest one runs, at a rate the owner sets (assumed until measured).
4. **The month**: each part's plated kilos × its rate; zinc, chemicals and upkeep per kilo plated (the live cost's own figures);
   electricity as a fixed part plus a rate per kilo; the monthly crew and the hourly pool as recorded; overtime and EXTRA as they
   run, plus a set cost for each new overtime line-hour; the hires; interest. **As it runs** must reproduce the book's average
   month: a spec checks it.
5. **A move changes an input, never a total.** An ask changes a part's rate (per part, or by a percentage on a piece-billed
   client). Work held back adds parts on a line. A rack, rectifier or second barrel changes a line's kg a round or minutes. A
   fourth pickling tank changes pickling's rate. Backup power changes the cut minutes. A night crew adds hours. A hire is a wage.
   A loan is its amount, rate, months and interest-only months, repaid by amortised instalment.
6. **The ledger** lists every month (kilos, revenue, labour, hires, zinc and chemicals, power and other, interest, margin, spend,
   the loan, cash). A month opens to **how the margin adds up**: today's margin, then each move in the order it takes effect, each
   row what it added on top of the rows above, ending in the plan, so the rows sum to the plan. It reads **if every move lands**
   or **weighted by each chance**.
7. **The trials** (600, seeded): each chance, the CQI-11 date's slip of up to three months, each machine's risk until its fix
   (days down and a bill), a month's cut minutes between 0.6 and 1.5 times the usual, a client refusing an ask and sending less.
   Each trial runs the same engine.

## 4. The Planner (Insights → Planner)

View tabs: **Play · Ledger · A day · Plant · Tech tree · Staff · Clients · Finance**. Each has its address
(`?tab=pagePlanner&v=…`). One primary on Play: **Roll the trials**. Every view carries the heads-up strip: the month (a slider
walks it), cash, margin a month against today's, kilos plated against what the lines can run, CQI-11 (a ring), and the goal's
score with up to three stars.

- **Play**: the goal's level (**Easy** · **Normal** · **Hard**, each a CQI-11 date, a margin a month and a cash floor), the
  board (24 months across, a lane each for Plant, Tech, Staff, Clients, Money and Your cards; ‹ › moves anything a month; a move
  that can never take effect is hatched), the margin chart (the plan, today, the goal; after a roll the 8-in-10 band), a
  histogram at the goal month, achievements, **Replay one run** as a story, the lines' hours this month, and the hand: the
  lenders as cards (one loan at a time, its terms editable) and the owner's own cards. **New card**: what it is, what it changes
  (new work at a rate on a line, more kilos a round on a line, or a saving a month), its cost once and a month, its chance, the
  months before it counts, what it needs first.
- **Ledger**: §3.6.
- **A day**: each line's rounds from 6:00 to 4:00, coloured by client in proportion to the line's work, the overtime blocks, a
  night shift, lunch, the cut, pickling; tiles that reconcile (the day × the working days = the month on the Ledger); and *why
  the day is as it is* (kilos to plate, kg an hour, hours needed, hours run). *As it runs* or *With the plan*.
- **Plant**: what each line can do (kg a round, minutes, kg an hour, kilos a day, hours a day, with sources), pickling, cuts;
  the machine register (item, line, state, age, what it needs); an **upgrade tree** per station, a level open once the one below
  is planned, each with its cost and the input it changes.
- **Tech tree**: records, the auditor course, bath analysis, the test lab, trivalent passivation, **CQI-11 self-assessed**, ISO
  9001, approval as a plating source, IATF 16949, a zinc-nickel line; inputs from Plant and Staff on the left; a node's month is
  the latest of what it needs plus its own months. Under it, the **CQI-11 checklist** register (Sections 1–4 and the process
  tables, status, cost, owner, evidence), where items in place count toward the ring.
- **Staff**: labour this month (as recorded and as planned), overtime line-hours, and each role with its wage, chance and what it
  opens: a plating specialist (CQI-11 asks for one on site), promoting and training the supervisor, a lab hand, a turnaround
  hand, a night crew (needs backup power), multi-skill training.
- **Clients**: each client with its kilos, revenue and ₹/kg; open one for its parts (kilos, pieces, rate, ₹/kg, thickness,
  line) and its moves: **ask a rate** (to a ₹/kg where lower, or a percentage on a piece client; a rate typed on one part asks
  that part apart), and the **work it holds back** from the register (certificates or turnaround: tonnes, rate, line, chance,
  needing CQI-11 or the turnaround hand). Each part shows its effect.
- **Finance**: the lenders register (who, amount, rate, months, interest-only months, what it ties, status) compared on one
  basis, the instalment schedule of the one in play, and **rates heard** (what, from whom, when: one report is one report).

## 5. The report

**Make the report** prints the scenario through the report generator's frame (the frame table, `@page` margin 0): the goal and
the score, the plan by month, the ledger, the month built up, the lines and the day, each register, and every assumption with
its source. The same pages drawn live, professional rather than playful.

## 6. Data (`S.planner`)

```
planner: {
  cfg: {lines: {a1|a2|barrel: {kgRound, every}}, pickKgH, otLineHour, powerFixed},     // set by the owner; blank = measured or assumed
  machines: [{id, item, line, state: good|fair|ageing|needs, age, needs, risk: {p, cost, days}, at, by, retiredAt?}],
  checklist: [{id, ref, what, status: in|partly|missing, cost, owner, evidence, at, by}],
  lenders: [{id, who, amount, rate, months, mor, ties, status: offered|asked|agreed|declined, at, by, retiredAt?}],
  heard: [{id, what, from, value, unit, on, by}],
  heldBack: [{id, clientId, why: cert|turnaround, kg, rate, line, chance, note, at, by, retiredAt?}],
  scenarios: [{id, name, goal, plan: {moveKey: month}, asks: {clientId: {to|pct, chance, parts}}, loan, cards, at, by}],
  active
}
```

Travels with the book (backups, GitHub, the compile); edits are in the change log. Nothing in it is written into the build.

## 7. Links

- A checklist item **missing** and due this month is a To-do task; a machine that **needs** work names itself on the To-do.
- History logs a register's records.
- Knowledge → the app's guides: **Use the planner** (how to play, read the ledger, set the assumptions).
- Nothing from a scenario appears outside the Planner. Stats, Finance and the rest keep showing the book.

## 8. Open

- VAT A2's and the barrel's kg a round and minutes, and pickling's rate, until their registers are read.
- The AIAG CQI-11 manual, to confirm the checklist's costs before they are trusted.
