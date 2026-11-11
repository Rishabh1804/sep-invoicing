---
subject: "UI pass 3: People leads, a picture first, across the app (U5 to U7)"
domain: design
modules: []
specs: [docs/UI_PASS_3.md]
tests: [P76, P80, P115, P132, P133, P178, P180, P185, P188, P194, P195, P197, P231, P232, P233]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### UI pass 3: People leads (U5)
`docs/UI_PASS_3.md` §12, §26c, §26j (owner, 15 Oct 2026: *"Every sub-tab of our people tab has the same issue it does not lead the user
by design"*; *"Roster section … primitive, despite having plenty of data to show info in a better way"*). P231 (phone and desktop); the
specs that read the Roster's rows, the week's table and Pay's history chart rewritten to the same facts where they now live, never
weakened.
- **The next steps** (`uiNextStepsHtml(key, steps)`, state.js; design §6.23): where a view's work has an order, Today's step pieces
  laid across one row under its toolbar (`data-next-steps`), each a node in its state and a door; the first not done with a door
  ringed (`data-next`). **A step's door is its own action** (`invAttStepGo`, `invPayStepGo`, `data-go`), never a copy of a toolbar's or a
  tab's: a test clicking the toolbar's button would find two. Day: In-time roll → Marks (*21 of 23*) → *Held for you* while a sync
  holds a mark → Out-time roll → a line's night roll → EXTRA booked. Month: Start or import → Fill → Settle → Mark checked. Pay: Hours →
  Cash paid out → Payout (*to Sat 5 PM*) → Weekly payments → Slips.
- **The pictures**: Week a grid of marks over its table (`chartMarks`, charts.js: a hand a row, a day a column, P ok, H warning, A
  danger, a night info, not marked hatched, two shifts back to back a dot; `#attWeekMarks`), the table folded under it
  (`att-week-grid`); Month its agreement as one bar of 100% (`chartShareBar` takes a status `tone` now; `[data-areg-bar]`); Pay the
  payouts week by week with the cash paid out its own part (`[data-pay-weeks]`, moved from *Weekly payouts*); Areas each unit's heads a
  day as small multiples, amber where short, a line's night too (`[data-area-multiple]`). Each of the last three is its verdict card's
  body: shut on the phone, open on the desktop.
- **The Roster as cards** (`attRosterCardHtml`, `[data-roster-card]`): initials, the name, the area and the rate (`data-roster-meta`),
  the tier and tenure (`data-roster-tier`; the designation before the tier for the owner), the three bars (`pplGlanceHtml`, the bars
  alone now), the top three skills as chips (`data-ppl-glance-skill`); **a badge only for a state** (*Motivation 42* for a hand to watch,
  *Inactive*), a check-in due the verdict's tile and the Filter's (TM4f). The Filter: area, tier, To watch or Check-ins due
  (`#attRosterArea`, `#attRosterTier`, `#attRosterShow`; tokens on the phone). The hands who left fold under *Left* (`roster-left`). On
  the desktop the cards stand beside the record, the open one `aria-current`.
- **Measured** (phone screens, the long book): Day 2.07 → 2.23, Week 1.69 → 1.48, Month 1.00, Pay 2.12 → 2.28, Areas 1.83, Roster 2.43
  → 1.93; Day and Pay longer by their step row, within their budgets (said, I10).
- **The QA chain** (Castor, Iuno, Cipher; `docs/UI_PASS_3.md` §26j): a record missing or not yet due is never drawn as done, zero or
  late. Pay's Payout step is done only on a week closed at Saturday 5 PM (`PAY_CUTOFF`) with every working day recorded and no hours to
  check; *Weekly payments* counts the weekly hands; the chart's part is the weekly hands', a cash-only week has no wages part, and each
  bar reads its payout (`chartStack`'s `total`). A day not come is *to come*, a night roll due until its morning is past, a day the plant
  is not expected to work by the calendar (`attDayNotExpected`: a Sunday, a paid holiday, a day marked shut, worked or not) expects no
  marks, a day of typed outs (the night's hands aside) has its out-time roll in *by hand* (`tdyInput`, so Needs you and Mine read it
  too). The Week grid leaves those days and days off the roster empty, and a shut day is no day missing on Week's verdict or Pay's
  Payout step; a step with no door is never ringed; a hand to watch is red on card, verdict and tile; a search jump clears the roster's filters.
- **A data flow**: none. The book does not change.

### UI pass 3: a picture first (U6)
`docs/UI_PASS_3.md` §13, §26d, §26k (owner: *"The report generated for power cut is extremely text heavy for anyone to be interested in
solving it. Text heavy should be an optional copy and our copy, so that we know the entire context."*). P232 (phone and desktop); P115,
P132, P133, P185, P188 and P194 rewritten to the same facts where they now live (the picture leads, the full text under its toggle, the
prints in the action bar), never weakened; P180's paper list and the sweep's `PAPER` name the picture page.
- **The picture page** (`inv-pcp-*`, design §6.38): one A4 page on paper's own tokens, the palette and theme read nowhere (the chart
  builders' tokens redeclared once in the printed colours); it breaks after itself. **Charts on paper** are the builders with
  `opts.paper` (charts.js): no readout, no Table, each bar its figure, a bar known to read low hatched (`d.hatch`).
- **Power → Case** (`powerCasePictureHtml`): four tiles (cuts in 12 months, dark working hours, a year's range, the soonest payback), cuts
  by month (a month holding likely-unreported days hatched) and by the hour, the damage as one bar of 100% in its four parts, the three
  options as cards with the TSUISL switch *Recommended*, the first three open items; every figure `powerAnalysis`'s own.
- **Reports** (`rptPictureHtml`): Revenue, Tonnes billed, Realisation against the live cost, Cash; two charts by the period's parts
  (`rptSubs`: a day by line, a week by day, a month by pay week, a quarter or a year by month); *To look at now* (the red and amber tasks
  while the period runs), else its worst figures. A chart with nothing to draw says so in words.
- **The screens**: the picture leads, fitted; **Read the full case** / **Read the full report** opens the text (drawn hidden with the
  page); the action bar's prints, the picture the one primary (`invPowerPrintPicture`, `invRptPrintPicture`) and the picture with the
  text (`invPowerPrint`, `invRptPrint`). A report's picture keeps the queue's rule (the period running is the owner's to open).
- **Measured** (phone screens, the long book): Power → Case 2.16 → 1.08, Reports 2.64 → 1.07; P195's budgets lowered to 1.5.
- **A data flow**: none. The book does not change.

### UI pass 3: across the app (U7)
`docs/UI_PASS_3.md` §14, §26e, §26l (the look carried to every screen the steps before did not reach). P233 (phone and desktop); P178,
P180 and P197's `LOOKS` rewritten to the same facts (the wash gone, the host a card), and the specs that read `.inv-empty` read the
blank state, never weakened.
- **The tone rule** (§14a): every `.inv-hero` is the board's card (U2R, §24c): the surface, quiet while all is well (its tone in its
  figure and icon), amber a 3 px top edge (`--warning-mark`), red the edge (`--danger-mark`) and `--card-danger`. The 160° wash is
  gone; a card in a deck is the surface with its tone's left rule; a tile naming a tone stays a well of it; a hero's hairlines are
  `--border`, its controls plain (`.inv-coded` blocks keep their tinted controls).
- **Lists**: on the desktop the list-and-pane host is the card (surface, edge, `--r-card`, lift), the table's sticky head the card's
  colour, rows at `--row-h`, the open row `--accent-soft` with its rule, a group's head in small capitals (`--ls-caps`). P80 holds.
- **Badges, toasts, search, dialogs**: a status badge carries its tone's icon (a mask from `--ico-<tone>`, set on the root at boot by
  `uiStatusIconVars`; neutral none); a toast is led by its kind's icon (`toastIconHtml`) in the other theme's mark; search's field a
  large well and each result led by its kind's icon (`SRCH_KIND_ICON`); a dialog's title `--fs-17`, its close the ghost `close` icon
  (`dialogHeadHtml`, the pane's head too), a phone's sheet its grabber (`::before`); **a dialog drawn again in place does not slide in
  again** (`dialogOpen`'s `replace` marks the scrim `data-redrawn`): the credit note's, the guard's, the planner's card and the quotation.
- **One set of blank states** (§14b): the 107 places a screen drew its own empty line (`class="inv-empty"`, 33 modules) draw
  `uiEmptyHtml(words, kind)`: the screen's own words (escaped by the caller) through `uiBlankHtml`, the first sentence the title and the
  rest under it; `notset` where a setting is wanted (no bank statement, Mine with no duties). `.inv-empty` is retired (P76). The charts'
  `emptyText` already went through `uiBlankHtml` (`_chartEmpty`). A spec reading an empty screen reads `.inv-blank`.
- **First-visit pointers** (§14d, design §6.39): `UI_POINTERS` (state.js), nine: Home's Customise, the gallery's kinds, Stats' Tables,
  Stock's Spend and prices, a guided flow's preview, the Roster's cards, the Case's Read the full case, and More on Messages and
  Production (for *Read every message again* and *Read register photo*). Checked after every render and scroll (`uiPointerSchedule`,
  from the overflow observer), at most one a screen visit (the address), only with its control wholly in view above the phone's bar and
  a sticky action bar, never over typed work (`_pageTyped`, a typed dialog), a dialog the control is not in, a board being arranged, the
  lock or the print view; marked seen when drawn, per person and device (`sep_inv_pointers`); *Got it* and Escape shut it, *Read the
  guide* opens the guide at its section (`uiFlowGuideGo`). Off under a test browser unless `window.__sepPointersOn`. It floats (fixed,
  `--ptr-top`, `--ptr-left`, `--ptr-arrow`), so nothing moves and P195 measures nothing new.
- **The guides** each pointer opens: *Using the app: attendance* gained **Roster** (v8), *Using the app: production* *Read register
  photo* (v11), and **Using the app: messages** (`app-messages`) is new.
- **A data flow**: none. The book does not change.
