# The plant picture

**Status, 10 Oct 2026.** PP1 and PP3 are built, on PR #144: what a tank takes a round and the register's pace measured, the
efficiency split four ways, Mehta's default weight a piece (§5, questions 1 and 2), and stock by line (§5, question 3). The
analysed figures are drawn in one way since the owner's notes of the same day (§6). **PP2 is built in part** (owner, 10 Oct 2026:
*"why don't we calculate the earnings?"*, and *"comparisons are missing"*; P206): what each line earned at the rates on record,
against what a kilo costs and its usual day, the week against the four before, the day's earnings against the live cost; the
efficiency's week grid and where the units' time went are still to come. PP4 and PP5 are proposals; their order is the owner's.

## 1. What the owner asked

The owner wrote three messages on 9 Oct 2026, about the production tile and then the whole app:

> We also get "Plated, last recorded day 7,630 NOS + 150 kg, 8 Oct · VAT A1, VAT A2, Barrel · 0.68 t known, 14% of the pieces
> weighed" … which is not uniform enough to draw a full picture of what happened. We have data to analyse and represent it in a
> better way.

> We have Equipment details as well, but it doesn't tie to anything - we have the infrastructure in place. We don't get the
> information out of it that we can get, as we have attendance, production, stock, and details like power cuts, finance as well.
> There is no holistic vision that is being created using these details.

> Where it says 1386 pieces not weighed, we should have a list of those pieces whose weights are missing so we can do a follow up,
> if needed. Also, where it says VAT A1 did a particular amount of production, calculate its efficiency as well, we can do a follow
> up if needed. That is how the colour code of the gradient for cards in this tab will be decided. Barrel is also a special case as
> 50% of it is down.

## 2. What the book holds

Measured on the owner's backup of 9 Oct 2026. The backup stays in the scratchpad and is never committed. The figures below are
counts only.

- **The plant register.** 17 units:
  - VAT A1: four tanks of 30 kg a round, one of them down for a year.
  - VAT A2: two tanks of 45 kg.
  - Barrel: six barrels of 50 kg, three of them down.
  - Pickling: five tanks.
  
  The register was set up on 9 Oct. The planner's line pace is the owner's own setting: a round every 19 minutes on A1, every 20 on
  A2 and every 75 on the barrel.
- **Production.**
  - 110 plated runs on 11 days, 23 Sep to 8 Oct, and 50,784 pieces in all.
  - 105 power cuts and 42 pickling loads.
- **Attendance.** 145 days are recorded.
- **Stock.**
  - 281 entries. Use and charge fall on only 9 days.
  - The supervisor's zinc lines name the bath in their own words ("use VAT A 2 … 150 kg VAT 1 … 175 kg berral … 75 kg"). The app does
    not yet read the bath into a field.
- **Finance.** 358 bank rows up to 6 Oct, and 9 cost bills.

## 3. What is tied now (PP1, built)

The day reads as one picture, and every input it rests on is shown so that it can be checked. The whole of it is described in
CLAUDE.md under *A day's plating, whole*.

**Every run is weighed by the surest route the book holds.**
- The routes, surest first: its own kilos, a weight on record, the challans it was set against, then the client's usual weight for
  that kind of part.
- On this book, 12% of the pieces had a weight before this change, and 89% have one now.

**The day is one unit.**
- It is given in tonnes. **≈** marks a figure that is partly estimated. **≥** marks a figure that leaves out pieces with no weight.
- Each line is drawn on a clock running from 6 AM to 6 AM the next morning.
- The card also shows:
  - each line's working units and heads;
  - the clients;
  - what the work is worth at its rates on record;
  - the day's labour against that worth;
  - the cuts and the pickling loads.

**Equipment, attendance and power are tied to production through each line's efficiency.**
- Efficiency is what the line plated against what its working units could plate in the time it ran.
- The time it ran comes from the general shift where it had heads, plus its overtime runs, less the power cuts.
- Where the register counted rounds, the efficiency splits into four factors whose product is the figure: the time (the rounds run
  against those the hours allowed), the racks (how full each round was, with the parts run part-full named), the parts (what a full
  round of the day's parts weighs against the line's round) and the rounds with no weight.
- Floor's line cards are coloured by it.
- Half or more of a line's units down colours the card red whatever the efficiency, and leads the card.

On 8 Oct, with the round and the pace measured (§5):

| Line | Efficiency | What it shows |
|---|---|---|
| VAT A1 | 111% | Over its usual. 896 kg were written without rounds beside the 27 the register counted, so the time is not told apart; its racks were full and its parts 93% of its 59 kg round |
| VAT A2 | 44% | Its parts are 75% of the 90 kg typed on its tanks, and 9 of its 16 rounds have no weight (about 41% of the work) |
| Barrel | 15% | Three of six barrels down, and no rounds counted |

**The pieces with no weight are a follow-up list.**
- Each floor name has two moves: *Which part?* and *Set its weight*.
- The same list shows on Floor, on Production → Entries → *Not weighed*, and as a To-do task for each client.

## 4. What is not tied yet

Each of these is one PR.

- **PP2 · The line over time** (Production → Lines, Floor). *Built in part, 10 Oct 2026:* what each line earned (Floor's line card,
  Lines' card and week), against what a kilo costs and its usual day; the week to the day against the four before, a recorded day's
  average on each side; the day's earnings against the live cost, and the work no rate prices. Still to come:
  - Each line's efficiency by day as a coloured week grid, with the time, the racks and the parts over the weeks.
  - For each line and week, where the units' time went: what the units could plate, less what stood down, less the cuts, less the
    time nothing was run, ending in what was plated.
  - The same picture for the plant as a whole.
- **PP3 · Stock by line** (stock.js, cost.js, Floor). *Built* (§5, question 3).
  - Read the bath that a zinc or chemical line names ("use VAT A 2 … 150 kg") into the entry.
  - Zinc and chemicals by line, as kilos per tonne plated and rupees per kilogram.
  - A bath's top-ups set against what it plated.
- **PP4 · Equipment and money** (plant.js, bills, bank).
  - What a unit down costs: its kilos a round, times the line's rounds, times what a kilogram leaves.
  - A repair recorded against a unit, from a bill or a bank payment tagged to it.
  - Each unit's own record of what it has cost and how long it has stood down.
  - The planner's upgrades priced from the measured loss.
- **PP5 · The period, whole** (Pulse, Reports, Floor's Overview).
  - "Is the plant running smoothly?" and the weekly and monthly reports read the same picture: efficiency by week, then the work's
    worth against labour, chemicals and power.
  - Floor's Overview (tab map TM4a) is the day's version of it.

## 5. Questions for the owner, and their answers (9 Oct 2026)

1. **Kilos a round.** An A1 tank is set at 30 kg a round. Is that one rack in one tank? On the register's rounds, A1 plates about
   50 kg a round, though most of that weight is estimated. Efficiency rests on this figure.

   *The owner asked: "50 kg a round or 50 kg an hour?"* It is 50 kg **a round**. A round is one line of the register. On A1 one is
   logged about every 20 minutes, which comes to about 150 kg an hour (the median over 11 days, from 41 to 70 kg a round). On A2 it is
   about 47 kg a round, one about every 36 minutes. **Still open:** is one round of the register a rack from one tank, or all the
   working tanks at once? The app takes it as all of them (3 × 30 kg = 90 kg a round on A1), and so reads the racks as 58% to 78%
   full.

   *The owner: "Each register line on A1 includes 3 tanks out of the 4 available, 150 kg/3 = 50 kg an hour per tank inside VAT A1
   area. If confidence on rack capacity becomes high it should override defaults. Each register line on A2 includes 2 tanks."* So a
   round is every tank working, as the app read it. Built (P191): what a tank takes a round is measured on the register
   (`prodTankLoad`): a round's kilos over the tanks working that day, the median over 60 days, with how many rounds rest on a part's
   own weight. Firm at 30 rounds on 5 days with 80% so weighed, it replaces the typed 30 and 45 kg in the efficiency; until then the
   typed figure stands and the card says what the register measures.

   *Then: "Default Mehta to 0.560 kg per unit, adjustable", and "Mehta's clamp have real weight values calculated in our data, maybe
   it is not linking to the production data due to part being unassigned."* Both built:
   - The runs written with a gauge already linked to their challans at the parts' real weights: 0.33 to 0.88 kg a piece by size.
     An earlier reading here said one kg a piece was applied to every round; that was this session's measuring script, not the app.
   - A name that writes a size (*clamp 165x83(40x6)*) now links to the client's part of that size and gauge.
   - Mehta has a default of 0.560 kg a piece, set on the client and changed there. It weighs a run nothing links to a part, before
     the client's usual weight for that kind wherever those weights spread wide.

   On the 9 Oct book this gave VAT A1 20 kg a tank (60 kg a round over 3 tanks) and VAT A2 22 kg a tank. Neither was firm: 54% and
   62% of the rounds rested on a part's own weight. The rest were Mehta's liners and the clamp rounds no gauge rule named (108, plus
   single rounds of 24 to 156).

   *The owner then answered the two questions that would link them: a round of 108 clamps on VAT A1 is "above 32x6", and "126 -
   150xxxxxx series, 90/87 - everything else" for the liners.* Built:
   - A round of 108 joins the rule of 35X6, 35X8 and 40X6, and the runs already saved at 108 are read by it.
   - The floor writes Mehta's L.C. Pads and liners as LINER. A round of 126 is one of the parts numbered 150… (0.28–0.31 kg); a round
     of 90 or 87 is one of the others (`seriesRules`). Those runs are set against those parts' challans.

   VAT A1 is now firm: 19.5 kg a tank, 58.5 kg a round over 3 tanks, with 80% of 256 rounds resting on a part's own weight. Judged on
   one basis, it reads 72–87% on most days. Heavy-clamp days read over: 108 clamps of 35X6 and up weigh about 95 kg a round, and the
   app says that is over its usual. VAT A2 stays at 62%. Its typed 90 kg stands, and its set pace of 20 minutes a round is about half
   what the register measures (36).
2. **Round times.** Are the planner's round times right: 19 minutes on A1, 20 on A2 and 75 on the barrel?

   *"It is approximately right, till we have more concrete data."* Kept as set. The register is measuring A1's pace too, at 19
   minutes over 7 days.

   *Then, asked whether the register's pace should replace the set one once firm, as the tank's round does, and whether to keep the
   load against the line's round or show how full the racks are for each part: "1. Yes 2. We'll do both, so solutions for efficiency
   can be worked out."* Built (P191):
   - The register's pace is measured per shift: its first round to its last, less the cuts, over the rounds between, the median of
     the shifts with 8 rounds or more over 60 days. Firm at 5 shifts, it replaces the set pace. On the 9 Oct book VAT A1 is a round
     every 18.6 minutes (set 19) and VAT A2 every 31 (set 20), both firm.
   - The efficiency splits four ways, and the four multiply to the figure: the time, the racks (with the parts run part-full named),
     the parts, and the rounds with no weight. Its title names what moved it most. A round two clients share counts once and is full
     as it was.
   - On that book VAT A1's ordinary days lose most to the time (73–84%: the first round comes at 9 or 10 on an 8:30 shift); its racks
     are 94–100% full. VAT A2's parts are 22–77% of the 90 kg typed on its tanks, so the typed figure is high for what it runs, and
     up to 43% of its rounds' work has no weight.
3. **The bath named in a stock message.** Should the app read it? (PP3)

   *"Exactly."* Built (P192):
   - **The reader** (stock.js `parseStockLine`). A use is read bath by bath: a bath named stands for the figures after it until
     another is named, a date for the figure after it, and a bath or a date just before "use" is that use's. "use VAT A 2 /
     25/09/26/ 150 kg VAT 1 / 28/09/26/ 175 kg berral use 75 kg" is three uses: 150 kg into VAT A2 on 25 Sep, 175 into VAT A1 on
     28 Sep, 75 into the barrel over the message's days. It was one 400 kg entry, the baths only noted. "berral & vat a1. 51 kg"
     is one use the two share. "use A 2" is VAT A2, never A Salt. Baths whose figures do not add up to the use stay one use and
     say so. Each entry carries its baths as `lines` and its own words as its note. A use typed by hand takes its bath from
     **Into**.
   - **Read again** (Stock → To check). A saved message the reader now splits by bath, or now puts in a bath, is listed with both
     readings. One whose note already named its one bath is not.
   - **By line** (cost.js `stockByLine`). Each addition into a bath is set against what its line plated until the next of the same
     stock line went in. The last is still in the bath: *so far*, and out of the line's figure unless it is the only one. Days with
     no production record are filled at the pace of the days recorded; under half recorded, nothing is set. A use naming two baths
     is shared by what each plated, or evenly where one is not recorded. A use naming none is the plant's. Rupees at the price paid.
   - **Shown** on a stock line's page (*By line, 60 days*), Production → Lines (*Into the bath*) and Floor's line card (the day's
     additions).
   - **On the owner's book**, once the two messages the reader now reads differently are taken (Stock → To check → *Use the new
     reading*): VAT A1's zinc is ≈ 5.3 kg a tonne (₹2.40 a kg plated), on its one top-up drawn on to the next. The cost model's
     425 kg a month over ~80 t is 5.3 too. Its 106 Salt is ≈ 1.8 kg a tonne. VAT A2 is on its first top-up of each (so far
     only). The barrel is recorded on 1 of 12 days and is not set against anything. Most chemical uses name no bath yet.
4. **Repairs.** Where are repairs paid and recorded today: a bill, or a bank payee? (PP4)

   *"Nothing recorded as of yet."* PP4 gives a repair a place on its unit: what was done, on which day, and what it cost (typed,
   or from a bill or a bank payment). It is recorded with the status change that brings the unit back to running.

## 6. Analysed data on screen (9 Oct 2026)

The owner, on Floor's line card: *"The times lost most reads like a block of text and is not presented according to our benchmark"*;
then *"Lots of new chaotic text data is entering due to the analysis … designing a way to present our analysed data in a coherent
manner."* Every figure this work adds is drawn in one way (`docs/SEP_INVOICING_DESIGN_PRINCIPLES.md` §6.27). The verdict leads.
The factors are tiles under a caption. The working is folded, one fact a row with its source a badge, and the reasoning is the
guide *Reading the plant's figures*. Built on Floor's line cards, Production's day card, stock by line and the plant strip. The
other screens are measured in `docs/COGNITIVE_LOAD_SURVEY.md` (*Analysed data*) and fixed in the tab map's steps
(`docs/TAB_MAP.md` §3d), which holds every new figure to this shape.
