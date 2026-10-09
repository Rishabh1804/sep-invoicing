# The plant picture

**Status, 9 Oct 2026.** PP1 is built, on PR #144. The owner has answered the four questions in §5, and PP3 (stock by line) is next. PP2, PP4 and PP5 are proposals; their order is the owner's to set.

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
- Where the register counted rounds, the efficiency splits into pace and load.
- Floor's line cards are coloured by it.
- Half or more of a line's units down colours the card red whatever the efficiency, and leads the card.

On 8 Oct:

| Line | Efficiency | What it shows |
|---|---|---|
| VAT A1 | 61% | Ran 27 of 35 rounds and loaded 78% of its 90 kg a round |
| VAT A2 | 28% | Ran 16 of 33 rounds, and 1,386 pieces had no weight |
| Barrel | 15% | Three of six barrels down, and no record of the general shift |

**The pieces with no weight are a follow-up list.**
- Each floor name has two moves: *Which part?* and *Set its weight*.
- The same list shows on Floor, on Production → Entries → *Not weighed*, and as a To-do task for each client.

## 4. What is not tied yet

Each of these is one PR.

- **PP2 · The line over time** (Production → Lines, Floor).
  - Each line's efficiency by day as a coloured week grid, with pace and load over the weeks.
  - For each line and week, where the units' time went: what the units could plate, less what stood down, less the cuts, less the
    time nothing was run, ending in what was plated.
  - The same picture for the plant as a whole.
- **PP3 · Stock by line** (stock.js, Floor).
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
2. **Round times.** Are the planner's round times right: 19 minutes on A1, 20 on A2 and 75 on the barrel?

   *"It is approximately right, till we have more concrete data."* Kept as set. The register is measuring A1's pace too, at 19
   minutes over 7 days.
3. **The bath named in a stock message.** Should the app read it? (PP3)

   *"Exactly."* PP3 is next. A zinc line such as "use VAT A 2 / 25/09/26/ 150 kg VAT 1 / 28/09/26/ 175 kg berral use 75 kg" is saved
   as one use for each bath, each on its own date. It was one 400 kg entry, the baths only noted. Zinc and chemicals can then be
   counted per line against what each line plated.
4. **Repairs.** Where are repairs paid and recorded today: a bill, or a bank payee? (PP4)

   *"Nothing recorded as of yet."* PP4 gives a repair a place on its unit: what was done, on which day, and what it cost (typed,
   or from a bill or a bank payment). It is recorded with the status change that brings the unit back to running.
