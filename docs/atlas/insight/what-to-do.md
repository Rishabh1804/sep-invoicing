---
subject: "What to do: every answer ends in its moves"
domain: insight
modules: [split/advice.js]
specs: [docs/DIRECTION_B.md]
tests: [P133]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### What to do: every answer ends in its moves
Direction B, step 1 (`advice.js`, P133; owner, 1 Oct 2026: *"In the pulse, we have a question that asks who's driving it and
there is an answer with a reason, with no possible solutions and steps to be taken to ensure smooth running of our plant. Lots
of things in the app that can answer itself but that linkage is missing."*). The plan is `docs/DIRECTION_B.md`.
- **A move** is a sentence (*Ask SSS MEHTA for ₹8.55/kg*), a signed worth with what it rests on (a month at the last three
  months' tonnage, said), and one button to the place where it is made, filled in as far as the book allows. **Every figure
  comes from the function its own screen uses** (helpers were extracted, never copied: `statsPulseArgs`, `statsStoryCards`,
  `prodGeneralLines` / `prodStaffedLines`, `cpHourParts`, `qtToFromClient`); a worth that cannot be worked out is left out of
  the sentence, never guessed. **Nothing is applied**: a move opens a place or a draft, and nothing is written until the owner
  saves there.
- **The six questions**, each a widget on Home since UI pass 3 (Today → Pulse's until then, Stats → Overview's too until the tab map, TM2b), each ending in
  *What you can do* — three moves shown, ranked by worth then tone, the rest behind *Show N more moves*; where none can be
  worked out, one line says what would make one appear:
  1. **Is the plant running smoothly?** (new) A stock line out or red, with the reorder list's cost; this month's cuts, with
     the power case's option and its payback; an area short on 3 of the last 6 working days, with its EXTRA; a staffed line
     with no record after 11 AM; the payout due within two days of Saturday; no backup for a week.
  2. **Are we making money?** Reprice the large accounts under the cost; bill what is waiting; the cost line furthest above
     its model; the spare capacity.
  3. **Who is driving it?** For the account filling the plant under the cost: reprice per kg and per piece (a quotation
     draft, below); what its rebate costs against how fast it pays; the parts earning under an hour of the plant's cost (By
     the hour); the labour question settled both ways (gone since the owner ruled labour fixed, 13 Oct 2026). For the biggest
     mover down: its stopped parts, and a call.
  4. **Is the plant full?** Who could fill the spare tonnes; quotations out and unanswered; a new quotation at a rate that
     clears the cost; the lines with the most idle days.
  5. **Is cash coming in?** The largest debts over 90 days (a call, their receivables), receipts with no client, a client
     paying slower, the forecast's lowest point.
  6. **What changed?** The insights, each with its own moves.
- **Every app task carries its moves** too: the task's dialog lists *What you can do* above *What clears it* (`advTaskMoves`,
  keyed by rule; each rule now puts its data on the task: client, item, month, amount). The task's own button stays primary.
- **A call** is a real `tel:` link to the client's first diallable mobile or phone (`mailto:` when there is none), drawn as a
  button (`a.inv-btn`). **Reprice** opens a new, unsaved quotation draft (`qtOpenDraft`): the client's three largest parts by
  tonnage over 90 days, a piece line at target ₹/kg × the client's own kg per piece where it is known, else per kg; the draft
  keeps `draftNote` (never printed, dropped on a revision).
- **Add to my list** makes a task of the owner's own, due today, carrying the move's button (`go`, `goLabel`, `advKey`); the
  move reads *On your list* wherever it is drawn until the task is ticked. A decision taken on Home is tracked on the
  To-do.
- **The jumps a move needs** (`advGoTo`, behind `todoGo`'s default): `quoteDraft`, `quotes`, `perf` (a client's Performance on
  a panel), `reorder`, `powerCase`, `areas`, `payWeek`, `liveCost` (a component open), `prodLines`, `createFor` (Create with the
  client's challans ticked), `register` (a client and a month), `report` (an insight's month, at its section); `regState`
  ticks the ids it is given, `stats` opens on the move's period and scrolls to its anchor.
- **One key per decision** (`stock:<id>`, `reprice:<id>`; a task listed under an older key still reads *On your list*), each
  reprice says which cost it is at, the rebate move counts rebates only (`cnIsRebate`), and a period's worth ranks per month. A
  tap acts on the row it was drawn on (`advRowRef`). The questions read only the tasks the role signed in sees, and the
  payout move needs the wages (the QA chain of 2 Oct 2026).
- **Left open**: the rebate move opens the whole credit-note list (no client filter there yet); a quotation draft's prefill is
  not restored by browser Back/Forward.
