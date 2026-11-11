---
subject: "The tab map: Office and across the app (TM5, TM6)"
domain: design
modules: []
specs: [docs/TAB_MAP.md]
tests: [P80, P193, P194, P195, P197]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### The tab map: Office (TM5)
`docs/TAB_MAP.md` TM5 (10 Oct 2026): every Office screen leads with its verdict card, then one toolbar row; the long rows are two
facts and the long cards fold. P193; P195's budgets lowered for every Office screen, P197's `ONE_LOOK` takes them.
- **Pipeline** (`pipeline.js`): the verdict names the stage the page opens on (`pipeDefaultStage`) in its own words and tone, no
  figure (its tile has the amount), the worst other late stage its one fact (`pipeLateSay`); the stages are coded tiles two across (`pipeStageTileHtml`), a stage with nothing to
  judge plain. `pipeStateStage` reads one invoice state over a list, for Pipeline and the Register's verdict alike.
- **One judge for a challan's wait** (`imWaitTone`, `imWaitDays`, im.js): IM's dot, Pipeline's first stage and the To-do's challan
  task, amber from the To-do's challan days (3, the owner's ruling of 13 Oct 2026) and red from twice them; the task was info at any
  age. A challan dated after today says its date (`imDatedAhead`: its row and its dot's title, Pipeline's client and stage), never
  *received today*. Challans' verdict (`imVerdictHtml`): how many wait, what they bill, the oldest's days its figure. One row:
  Filter, **Add challan**, More (*Duplicate check*); Scan came out on 13 Oct 2026.
- **Invoices** (`renderRegisterToolbar`, `regVerdictHtml`): one row on both layouts: the search, Filter (client, month, state, the
  range, the sort one picker), Select on the phone, More (Credit notes, Number audit, the register's CSV and PDF, GSTR-1 CSV, Bulk
  mark filed); on the desktop the filters inline, the range a dialog (`regRangeOpen`), select-all the table head's box, a row that
  never wraps. The verdict: the invoices late on a step over what the filter shows. A neutral badge stays on its More row.
- **Clients** (`clientFlagsRead`, `clientFlagDotHtml`, `clientsVerdictHtml`, clients.js): a client's row ends in its worst flag, the
  To-do's own tasks, as a dot and a short word (`CLIENT_FLAG_WORD`); the verdict names the rule flagged worst, each client counted once a rule, the rest its facts; the flags are
  read again and the card redrawn when a client is saved or added (`clientsFlagsRedraw`).
- **Parts** (`itemsVerdictHtml`): *N with no weight* (parts billed by the piece, `itemNoWeight`: one billed by the kilo is weighed
  by its kilos; the chip, the filter and the row's dot read the same) in its tone with **Enter weights** in its foot; Filter (*No
  weight*, *Unused*, the sort), **Add part**, More (Part weights with its count, Enter weights, Derive weights
  (`deriveWeightsFromRates`, the rate card; *Calc weights*' kilos over pieces, `calculateStdWeights`, is retired), Merge, Select
  unused); a part's row
  its description and gauge, its end the rate over its kg a piece.
- **Performance** (`cpVerdictHtml`, client-perf.js): the client's realisation against the live cost (the cost only for a role that
  sees money: it is a margin; the tile alike) and its change, its flags coded tiles that open their tasks (each its amount for a role
  that sees money, else its count, else a dash; shut on the phone, open on the desktop); the cadence groups (an empty one plain),
  Materials worked and By the hour folds, shut on both layouts; By the hour's parts as fact rows, what an hour costs the plant and
  earns it only for a role that sees money. A client's flagged tasks and linked articles are brief rows
  (`todoAppRowHtml(t, true)`, `kbRowHtml(a, true)`), its Money panel two facts a line, the folded Turnaround card's head its title
  and verdict.
- **Sales**: Prospects' four tiles are its verdict's factors (`prsVerdictHtml`), the spare one figure (`prsSpare`, said under Home's
  *Is the plant full?* too); **To reprice**, the questions' reprice moves (`qtRepriceMoves`), is Quotations' card's body on the phone (one
  card, the rest a tap away) and the desktop's pane while no quotation is open (`qtRepricePaneHtml`), where open above the list it
  had made the page scroll (P80). Quotations' card takes the worst tone of the reprice moves it holds.
- **Create** (`validateInvoiceKeyed`, `createErrorsShown`, `createErrorsRefresh`): an error shows once its field is left or a save
  is tried, never on a form nobody has touched; Save is held only while one shows.
- **The method went to a guide**: *Using the app: clients and sales* (`kbguides.js`, on the office path).
- Measured, phone screens (P195's long book, worst of eleven days; then the owner's book, in a scratch harness never in the repo):
  Pipeline 4.57 → 4.57 (owner's 3.04 → 3.02, chains 7 → 0); Awaiting invoice 3.71 → 3.71 (1.99 → 1.93); Invoices 3.65 → 3.33
  (3.50 → 3.15, toolbar rows 8 → 2); Clients 1.47 → 1.50 (2.39 → 2.43: its card, said); Parts 1.00 → 1.00 (3.09 → 3.05, chains
  30 → 0); Performance 2.69 → 2.56 (5.72 → 3.23, blocks 14 → 0, chains 57 → 0; the desktop's 7.79 → 3.69); Prospects and
  Quotations 1.00 (one toolbar row each). Needs you 3.09 → 3.30 within its budget (the challan task red at ten days); Knowledge →
  Library's budget raised 3.5 → 4 (3.48 → 3.56: the new guide).
- Fixtures: `filterControl(page, sel)` and `setFilter(page, sel, value)` reach a screen's filter on either layout (in the phone's
  Filter dialog, inline on the desktop) and set it.

### The tab map: across the app (TM6)
`docs/TAB_MAP.md` TM6 (10 Oct 2026): one judge per fact wherever it is drawn, the period not yet ended marked in every chart, History
and Knowledge in one look, and the last long notes made a line or moved to their guide. P194 (both layouts); P195's budgets at their
floor (no note over 120 characters and no chain of three facts on any screen, no phone toolbar over two rows); P197's `LOOKS` closed.
- **One tone per fact**: `areaNeedTone(heads, need)` / `areaNeedWord` (state.js: short a warning, met ok, over info) on Floor's line
  cards, the attendance panel, Day's board and *Needed today*, and Areas (which read short in danger and over in warning until
  now); `figToneOwed(days, loose)` / `finOwedTone(days)` (finlinks.js: owed by its oldest invoice's age, never red while a receipt is
  unplaced) on Receivables, Money's Overview, Home's Money widget and cash question, Pipeline's *Owed to us*, a client's Money panel
  and the statement; `attOnSiteTone` on Needs you's floor card and the day's report too; the reprice move takes the client's tone
  on Stats (`figToneAgainst(net, full cost, 5)`).
- **The period to date** (charts.js, design §6.17): `opts.toDate` on `chartLine`, `chartLines`, `chartBars`, `chartStack` and
  `chartSpark` draws the period not yet ended dashed or lighter (`inv-chart-todate`), labelled *to date*; `chartToDateAt(keys,
  current)` finds it, `finMonthToDate` gives Money's. Every chart with a current period passes it.
- **History** (stats.js, changelog.js): its verdict (`historyVerdictHtml`), one toolbar row (the search; Filter: client, who, the
  kind, the range; More: Export CSV). A floor day's row is its count, where everybody stood its whole (the row's title, the pane,
  the search, the CSV), and it opens the day on People → Attendance (`historyDayJump`, `invHistoryJumpDay`). A change's row is at
  most 110 characters (`CHG_ROW_MAX`): a void says why in the words typed, a record's name too long loses its last parts to "…".
  The search reads a row's whole too. Its verdict's removals (`historyRemovals`): the audit events of a removal, less a day read again
  from its rolls (`how: 'reread'`) and a number accounted for (`source: 'reconciled'`), and the change log's rows removed, voided or
  cancelled (a credit note cancelled, an entry voided, a client removed); a row saved with such an event (within `CHG_MATCH_MS`) is the
  same act, counted once. The list draws such an act once too: an invoice deleted is its tombstone's row (`foldRemoval`: the invoice
  removed in the same save, named by its number, since the tombstone keeps no id), and a quotation's events name their record (`cc`,
  `cr`), so the change log's entries of the same saves are listed under Changes alone.
- **Knowledge** (knowledge.js): each list view a verdict card and one row (the search; Filter, the kind and the status, on the phone
  a dialog with tokens; **Write**; More: Export, Import). Start draws a card only for what waits (decisions due for review on the owner's alone, on
  Records' verdict too; what waits on anyone else is their own, `kbWaitsOnMe`: a change proposed is its proposer's, in *Drafts and
  waiting* as well; `kbStartHeroHtml`; *Nothing waits
  on you* otherwise), its count in its line; on the phone the first card opens, the rest wait shut. Training leads with how its
  lessons stand and each row says its own standing (due again warning, never taught info, up to date ok); ok only when no lesson
  is part-taught, and paths no hand on the roster is for say so.
- **Invoiced** (`imInvoicedVerdictHtml`, `imMonthPagerHtml`): its card, then one row with the month inside it (`inv-tb-step`) and More
  holding Add challan and Duplicate check (Scan a challan came out on 13 Oct 2026). **Reports**' Print is its action bar's, under the sheet.
- **The long words** went to a line or two facts, the method to its guide (*Using the app: People* v3, *pay* v5, *knowledge* v2): the
  day board's row, the labour card, Pay's cash draws, Money's forecast (*What it rests on*, a fold of fact rows), the cash
  question, the insights' lines, the zinc card, Power's rows (a unit and its line one fact: *Rectifier 1 (VAT A1)*), the change
  log, a folded To-do group. The page-head line (`inv-pagehead-meta`) is gone.
- **The closed list of box looks** (design §6.28, `LOOKS` in `tests/e2e/load-fixture.ts`): 41, each named with what wears it, checked
  on the owner's own book on both layouts too (a scratch harness, never in the repo), which found the Planner board's lane rule
  (listed) and two boxes wearing two components at once (a register day's row, the EXTRA fold's lines: now each its own).
- Measured (phone screens; the long book's worst of eleven days, then the owner's book): History 3.94 → 3.61 (owner's 4.29 → 4.04,
  chains 21 → 0); Knowledge → Library 3.56 → 3.40 (5.50 → 5.34), Records 1.03 → 1.00 (3.99 → 3.91, blocks 15 → 0), Start 1.61 →
  1.64 (1.62 → 1.39); Reports 2.89 → 2.86 (toolbar rows 4 → 2). **Grew by their new card, said**: Invoiced 2.27 → 2.39 (3.14 →
  3.26), Training 2.55 → 2.69 (3.20 → 3.33), Troubleshoot (owner's 1.53 → 1.62). No budget rose.
