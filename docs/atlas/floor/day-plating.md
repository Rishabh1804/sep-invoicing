---
subject: "A day's plating whole, and what a line earned"
domain: floor
modules: []
specs: [docs/PLANT_PICTURE.md]
tests: [P190, P191, P198, P206, P214]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### A day's plating, whole
Owner, 9 Oct 2026, on Production's tile: *"Plated, last recorded day: 7,630 NOS + 150 kg … 0.68 t known, 14% of the pieces weighed … is
not uniform enough to draw a full picture of what happened. We have data to analyse and represent it in a better way."* Then: *"where
it says 1386 pieces not weighed, we should have a list of those pieces whose weights are missing so we can do a follow up"*, and
*"where it says VAT A1 did a particular amount of production, calculate its efficiency as well … That is how the colour code of the
gradient for cards in this tab will be decided. Barrel is also a special case as 50% of it is down."* P190.
- **A run is weighed by the surest route the book holds, and says which** (`prodWeigh`, production.js; `prodKg` stays the record's
  own): **written** (kilos on the run); **record** (the part's kg a piece: the client's card, part weights, the Items Master, for the
  part the floor's name was learnt as too, or a piece client's piece rate over its ₹ a kg, the derived weights' own arithmetic; or
  **by its size**: a name writing one size, *clamp 165x83(40x6)*, is the client's part of that size and gauge however it is spelt,
  *CLAMP 165X83 (NT)*, where the client's parts of that size weigh within 5% of each other, `prodWeighBySize`; owner, 9 Oct 2026:
  *"Mehta's clamp have real weight values calculated in our data, maybe it is not linking to the production data due to part being
  unassigned"*; a name writing several sizes names no one part);
  **challans** (the challan lines In plant set the plating against, oldest open first, each at its own kg a piece: its kilos over its
  count, its weight on record, or a piece client's amount over its ₹ a kg; `prodInPlant` returns its `lines` for this); **kind**
  (the client's own challans of that kind of part in the year before, CLAMP, LINER, BRACKET (*BKT* spelt out), at the run's gauge or
  the gauges its round allows: the median kg a piece by pieces, the middle 80% kept as the range); **default** (the client's own kg a
  piece, `client.defaultKgPc`, Client → Edit → *On the floor*; owner, 9 Oct 2026: *"Default Mehta to 0.560 kg per unit,
  adjustable"*, set once on the client whose name reads Mehta where it had none, `_clientKgPcDefault1`), before a kind whose parts
  weigh wide apart (the middle 80% more than half its median across: Mehta's clamps of every gauge, 0.18 to 0.85 kg) and after one
  whose parts agree (their pads, 0.28 to 0.31); else **not weighed**, never a guess. The day's weighing names each client's default
  with **Change**, the client's form, and the page is drawn again on its save. Worked out once a book (`prodWeighIndex`, keyed on `_bookWrites`, `_prodVer` and the store). On the owner's book of 9 Oct:
  of 50,784 pieces plated, 12% had been weighed; 89% are now (record 12%, challans 33%, kind 44%), 11% not.
- **One unit everywhere** (`prodKgFig`): tonnes from a tonne, kilograms under it, **≈** where any run is estimated, **≥** where
  pieces nothing weighs are left out (the figure is then the least it can be). Every figure that turned pieces into kilos reads
  it: Floor → Overview's tile and line cards, Lines' tiles (the weight leads, the pieces under it), its runs (*≈ 540 kg from challans*),
  the week table, the four-week chart and labour per kg by line (a line-day counts with nine tenths of its pieces weighed, estimates
  included), Stats' *Plated (floor)* row, the reports and Today's floor tiles.
- **The day is one card** (`prodDayHeroHtml`, prodview.js; `prodDayPicture`, production.js), on Floor → Overview's Production card in
  place of the tile, and in Home's *Production, the last day* widget at Large (`compact`; Pulse's until UI pass 3): the tonnes; what was recorded, what is estimated and what is not weighed; a meter of the
  weighing routes against two shifts (~4 t), the plant's usual day marked (`prodUsualDay`: the median of five or more days in 60,
  each nine tenths weighed); each line on the clock, 6 AM to 6 AM (`chartDayStrip`, runs ok, cuts danger, the general shift's ends
  marked), its runs, rounds, units working, heads against the day's number, clients and its efficiency; how it was weighed by route
  with the kind estimates' range for the day; the pieces not weighed; the clients; what the work is worth at its clients' rates on
  record (`prodDayWorth`, rework left out; a role that sees money) and the day's labour (a role that sees wages); the cuts; the
  pickling loads; the week against capacity. Coloured by the plant's efficiency (`prodDayEfficiency`), made worse by a general shift
  with heads and no record or a tenth of the pieces unweighed.
- **A line's efficiency** (`prodLineEfficiency`): what it plated against what its **working units** could plate in the **time it
  ran**: the kg a round of the units running that day (the plant register), a round every so many minutes (the register's own pace
  once firm, below; else the planner's: set, else the register's rounds, else assumed, said which), the general shift (8:30 AM to
  5 PM) where it ran or had heads and each overtime run from start to end (a morning run with no end ends at 8:30; any other is not
  counted, and said), less the power cuts inside. **Floor → Overview's line cards are heroes coloured by it** (75% ok, 50% warning, under it
  danger; over 110% is info, *check the kg a round or the pace*), and **half or more of a line's units down is danger whatever its
  efficiency** and leads the card (*3 of 6 barrels down*); a general shift with heads and no record is at least warning. The inputs
  are on the card, so a figure that looks wrong leads to the input that made it.
- **How the efficiency splits** (owner, 9 Oct 2026: *"We'll do both, so solutions for efficiency can be worked out"*), where the
  register counted rounds, four factors whose product is the figure (`prodLineEfficiency`; Floor → Overview's line card, `flrEffRowHtml`):
  - **time**: the rounds run against the rounds the hours allowed (hours over the pace, to a tenth: *ran 25 rounds where the hours
    allowed 24.5 (102%)*). Every round the register counted, and kilos written without rounds as rounds' worth at a weighed round's
    kilos; past a quarter of the line's kilos that is a guess at another mix, so the time is **not told apart** and the card says how
    many kilos came without rounds;
  - **racks**: how full each round was, against its part's fullest: the run's own fullest round, or a named part's usual round on the
    line where that is more (`prodUsualRack`: the size the register counts most for it, from 5 rounds with half of them that size; a
    kind of part has none, since Mehta's clamps take 150 or 120 by gauge). **The parts run at part-full racks are named** (`partFull`:
    the part, its client, how full, over how many rounds of what);
  - **parts**: what a full round of the day's parts weighs against the line's round (*a full round of the day's parts is 44 kg, 76% of
    the line's usual 59 kg*): the work, not a fault, and the sign of a typed round that does not fit the line's parts;
  - **not weighed**: a round with no weight adds no kilos, so the figure reads low by what such rounds would have held.

  The card draws them as an analysis (§6.27): a caption naming what moved it most (`data-flr-effverdict`: under its usual, the factor
  that lost most, *The time lost most*, *Part-full racks lost most*, *Lighter parts than the line's round*, *Rounds with no weight read it
  low*; at or over it, what raised it, *Heavier parts than the line's round*, *Faster than its usual pace*; *How it splits* where the time
  hides it), a strip of tiles (`data-flr-effsplit`: Time, Racks, Parts, and Weighed where rounds have no weight), each in the tone of
  what it lost (the time ok from 90%, warning from 75%; the racks ok from 95%, warning from 85%; the weighed share ok from 95%, warning
  from 75%; the parts only said, `info`, since they are the work), and *How it's worked out* folded under them (`data-flr-effworking`),
  a fact a row: the hours run, a round every so many minutes and a full round, each with a *measured* / *set* / *typed* badge (not firm,
  the first thing the register's measure lacks), the rounds the hours allowed and the rounds run, the racks, each part run part-full,
  a full round of the day's parts, rounds with no weight, runs with no end time. The head's sub is the units working, the hours run
  and the pieces not weighed. A line's card also says what went into its bath that day (a fact row, or a row folding open to several). **A round two runs share** (a register row
  *MEHTA+GENERAL / LINER+188CD / 39+50*, or a group of codes shared out) is in each run at the same time: one round, a share of it in
  each (`prodDayLine`'s `at`), full as it was, never part-full by its own share; the pace and the tank's round count it once and the
  tank's round joins its shares' kilos (only when every share is weighed). On the owner's book of 9 Oct: VAT A1's ordinary days lose
  most to the time (73–84%: the first round comes at 9 or 10 on an 8:30 shift), its racks 94–100% full, its parts 75–96% of its
  round, heavy-clamp days over (29 Sep 140%: 148% parts); VAT A2's parts are 22–77% of the 90 kg typed on its tanks, and up to 43% of
  its rounds' work has no weight. P191.
- **The register's own pace** (`prodLinePace`; owner, 9 Oct 2026: *"Yes"*, to the measured pace replacing the set one once firm, as the
  tank's round does): per shift (the general shift, and an overtime block on its own, so the hour between them is no round), from its
  first round to its last less the cuts inside, over the rounds between (a batch's rounds whole, its START the first); shifts of 8
  rounds or more, the median over the 60 days to today. **Firm at 5 shifts** it is the line's pace in place of the one set
  (`everySrc: 'measured'`, *(measured)* in the card's sub and what it replaced); not firm, the set pace stands and the card says what
  the register measures. On the owner's book: VAT A1 a round every 18.6 minutes over 11 shifts (set 19), VAT A2 every 31 over 9 (set
  20).
- **What a tank takes a round, measured** (`prodTankLoad`; owner, 9 Oct 2026: *"Each register line on A1 includes 3 tanks out of the
  4 available, 150 kg/3 = 50 kg an hour per tank inside VAT A1 area. If confidence on rack capacity becomes high it should override
  defaults. Each register line on A2 includes 2 tanks"*): a round of the register is every tank working on the line that day, so a
  round's kilos over those tanks is what a tank took; over the 60 days to today, the median kg a round and a tank, the rounds and
  days, and how many rounds rest on a part's own weight (written, on record, or the challans it was set against; never a client's
  default or the kind's usual). **The latest measure judges every day**, so the days are on one basis (judged as of each day, A1 had
  jumped from about 50% to 80% between 26 and 28 Sep only because the measure turned firm between them). **Firm at 30 rounds on 5 days with 80% so weighed**: then the efficiency's round is that times the
  tanks working, in place of the kg typed on the units (`kgSrc: 'measured'`, the card says *(measured)* and what it replaced), and
  over 110% reads *Over its usual* (heavier rounds or a quicker pace), counted in the day's figure; not firm, the typed figure stands
  and the card says what the register measures and why it is not firm. The plant strip's *plating N kg a round* reads it too
  (`pltUsed`; the planner's reading only for a line with no rounds). On the owner's book of 9 Oct, with Mehta's default and the
  owner's answers on the round of 108 and the liners: **VAT A1 is firm**, 19.6 kg a tank (58.9 kg a round over 3 tanks), 80% of 250
  rounds from parts' own weights (a shared round once), and reads 70–84% on most days; heavy-clamp days read over (29 Sep 140%,
  7 Oct 129%), since a round of 108 clamps of 35X6 and up weighs about 95 kg, which is the mix and not the line, said as *Over its
  usual*. VAT A2 is 22 kg a tank, 62%, not firm: its typed 90 kg stands. P191.
- **The pieces nothing weighs are a follow-up list**: on the day card and Floor → Overview (*Not weighed*, under the cards; the plated tile
  brings it into sight), each floor name with its client, lines and pieces and two moves: **Which part?** (learns the name as one of
  the client's parts, `prodLearnAlias`) and **Set its weight** (a kg a piece on the client's card, from the first day the name was
  plated, `source: 'production'`, behind the rates permission). Production → Entries → **Not weighed** lists every such run
  (`prodIsUnweighed`); To-do rule **`prodUnweighed`** asks per client over 30 days, amber, until each is weighed.

### What a line earned, against its cost and its usual day
Owner, 10 Oct 2026: *"As we are calculating production, why don't we calculate the earnings? I can see that 9th Oct production data is
there and we have rate data, we can actually show the info there"*, and on Floor's day, *"corrections and comparisons are missing"*
(the corrections are P198). `docs/PLANT_PICTURE.md` PP2, in part. P206.
- **What a line earned** (`prodDayWorth(date, line)`; the day's whole when no line): its runs at their clients' rates on record before
  GST, as the day card always read them (a piece client's part at its piece rate, a run in kilos at the client's ₹ a kg, a run in
  pieces at that rate over its weight, ≈ where the weight is estimated; rework left out). It names the work no rate prices (`names`;
  a run with no client among them, which had been passed over unsaid), and keeps the kilos of the priced runs that have a weight
  with what they earned (`kg`, `amountKg`), so a rupee a kilo is read over the same runs as its kilos. A piece rate's earnings are
  exact, but where a run's kilos are estimated the rupee a kilo, the cost and what was left carry ≈ (`kgEst`; QA chain, P214).
- **Against what a kilo costs** (`prodCostRef`): the live cost over the 90 days to the day on the invoices' weighed kilos, Stats' own,
  else the full cost in Settings, said which.
- **Against the line's usual day** (`prodLineUsual`): the median of its recorded days in the 60 before, five at least, its kilos over
  the days with nine tenths of their pieces weighed (the plant's usual day's rule) and its earnings over those with nine tenths of the
  work priced. A day still running says *so far*.
- **The week to the day against the weeks before** (`prodLineWeek`; two to four count, and Lines' fact names how many: *on the 2 before*): the same days of each pay week, **a recorded day's average on each
  side** (a day with no record is a gap, never a zero: the record began partway through a week, and a week's total read the one after
  it 43% up on the owner's book), the day still running left out of both, two weeks before at least.
- Read once a book (`prodLineDaySum`, kept until the book changes). **On screen**: Floor's line card a fact row, *Earned*, coloured by
  its rupee a kilo against the cost, the usual day under it, or, where a tenth or more of the work has no rate, how much has none (a
  role that does not see money reads the kilos against the usual day, `data-flr-usual`); Production → Lines' verdict an *Earned* tile
  in the Rounds' place for that role (the rounds are in the efficiency's split), Plated and Earned with their change lines against
  the usual day (`uiFactorTileHtml`'s `delta`), the week against the weeks before a fact; *The week, plated* an *Earned* row; the day
  card (Floor's Production hero) *At the live cost*, *Left after it*, *This week, a day plated* and *a day earned*, and *Not priced*
  listing what no rate prices with the door to the client's rates. On the owner's book of 9 Oct: one day's VAT A1 earned less a kilo than a
  kilo cost (a piece client's clamps), red; VAT A2 ≈ ₹8,530 with 1,386 pieces not priced (the same pieces nothing
  weighs).
