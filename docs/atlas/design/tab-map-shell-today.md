---
subject: "The tab map: the shell and Today (TM1, TM2)"
domain: design
modules: [split/tabs.js]
specs: [docs/TAB_MAP.md]
tests: [P76, P79, P184, P185, P195, P197]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### The tab map: the shell (TM1)
`docs/TAB_MAP.md` (owner, 8–9 Oct 2026; *"Merge and go with all 14"*). TM1 built what every later step stands on. P184, P195, P197.
- **The rows** (`WORKSPACES`): Today is Needs you, Pulse, then its *Insights* Stats, Reports and the Planner (since UI pass 3 the workspace is Home: Home, Needs you, then the Insights); Office is Pipeline,
  Challans, Invoices, Clients and Sales; Floor is Overview, People, Production, Stock and Power; Money is its page's own row. Stats
  keeps its five tabs and the Planner its eight until TM2.
- **Clients and Sales are one page** (`pageClients`): a view may cover several of a page's own (`vs`). Clients covers clients,
  items and performance; Sales covers prospects and quotes. Each draws only its group's row (`CLIENTS_GROUPS`, items.js), an address
  lights its own (`?tab=pageClients&v=quotes` lights Sales), and each returns to the sub-view it was left on (`wsVsPut`). The parts
  master is called **Parts** wherever the user reads it; its sub-view's id stays `items`.
- **History and Knowledge are tools in the top bar** on every screen (History a clock, `invGoHistory`; Knowledge the book), in no
  workspace: no door lit, no row, their own title, no swipe. History's tool is hidden from a role that does not open it.
- **The names the user reads** (`PAGE_TITLES`, so the guard's refusals and roles grid too): Today, Invoices, People, Money, Floor
  overview.
- **A place that moves is followed through one table** (`navRedirect`, `NAV_REDIRECTS`, nav.js), applied to an address and to every
  place applied (a step of the trail an older build saved). It is empty until a step removes a place; that step adds its row.
- **One look's pieces** (state.js; design §6.6, §6.7, §6.10, §6.28), applied to no screen until TM2:
  - the verdict card (`uiVerdictHtml`): a sentence of 60 characters at most in its tone, three facts, four factors as tiles, two
    links; shut on the phone and open on the desktop; its count for a role without money;
  - the row end (`uiRowEndHtml`: a figure and a status, or one action; `uiRowMoreHtml`: the rest in the row's fold on the phone);
  - the toolbar's Filter (the phone's dialog, its tokens under the row: `uiFilterHtml`, `uiTokensHtml`) and More (both layouts,
    its badges summed in the worst tone: `uiToolbarMoreHtml`).

  Every page declares its kind (`data-screen` from `SCREEN_KINDS`, tabs.js: overview, work, document or form; a sub-view that is a
  form says so while it shows).
- **The instruments.** The long book (`longBook()`, `tests/e2e/load-fixture.ts`) is the sweep's book scaled toward the owner's
  shape, every name made up. **P195** holds every screen of the map on the phone within its budget: length in screens, blocks of
  text over 120 characters, meta lines chaining three facts, toolbar rows. Each budget is the worst of eleven days of the calendar,
  with the face and the clock pinned. **P197** holds every screen's kind and box looks (`LOOKS`, the census's 38) on both layouts,
  and each assembled screen (`ONE_LOOK`, empty after TM1) to its kind's anatomy. A budget is never raised to get green; each step
  lowers its own screens'.
- **The top bar's title gives way**: on a form whose back arrow, name and four tools are wider than a phone (Create), the name
  ends in an ellipsis with its full text in a `title`, never a page wider than the screen (P76).
- Fixtures: `phoneFilter`, `closeFilter`, `toolbarMore` (`phoneMore`), `openVerdict`, `openSales`; `switchTab` opens History by
  its tool.

### The tab map: Today (TM2)
`docs/TAB_MAP.md` TM2 (9 Oct 2026): the first screens assembled to one look (§3e), and the build's stop (§1a-14): the owner looks at
them before TM3. *Pulse folded into Home's board in UI pass 3 (U2, below): each of its parts is a widget now.* P185; P195's budgets lowered for Today's screens and P197's `ONE_LOOK` filled with them.
- **The To-do is Needs you's** (TM2a). The tasks stack opens with the To-do's toolbar (`#todoNew`, **Add** the view's one primary,
  **Details**), then Now, This week and Later as before, then **Snoozed** (Wake) and **Done** (the tick reopens), each a fold shut,
  and *Learnt from your answers* (`#todoLearn`) at the foot for a role that may change settings. `#pageTodo` is gone: an address, a
  saved step of the trail, the widget's launch and the manifest's shortcut land on Needs you (`navRedirect`), `todo=add` with
  `#todoNew` focused, `todo=open:…` on the task's dialog. The engine is unchanged (`todoRanked`, `todoGo`, the dialogs, the widget).
- **Pulse takes Stats → Overview** (TM2b). Under its head (the period, `MTD · QTD · YTD · All`, one `_statsPeriod` with Stats, and
  More: *Make a report*, *Open Stats*, *Edit Home*), the questions and *Do first* as before, then **Why it moved** (`#statsWhy`),
  **In one line** (`#statsOverview`, with its Cash and plated rows) and **This month at its pace** (`#statsPace`), each a hero led by
  its verdict, shut on the phone and open on the desktop. A period changed on Stats redraws Pulse when it is next shown
  (`_homeDrawnPeriod`). **Edit Home** is in More (the bar under the widgets is gone); a role without money sees that button alone.
  **The widgets are shut on the phone too** until opened (each a hero whose line answers at a glance): open, they alone ran past
  three phone screens on the owner's book.
- **Stats is three tabs, each led by its verdict card** (`statsVerdictHtml`: `#statsVerdict`, Trends' `#statsHeadline`):
  - **By client**: how many large accounts sit below their variable or full cost, the worst named with its ₹/kg (its figure toned only when it is a large account under the cost, the card the worst of what it holds); then contribution,
    the next challans (a fold), revenue, and realisation and concentration (folds), the folds shut on the phone.
  - **Cost**: *Live cost ₹/kg · N% measured*, toned by the share measured; then labour and the live cost. *Recorded against paid*
    names on its row the months it compares and the ones it leaves out; the bills fold to one row (*12 bills entered, the latest
    Sep 2026*, a voided bill listed inside and never the head) without their notes, which stay on Money's bills.
  - **Trends**: the period's headline as the verdict (revenue, tonnage, realisation and margin its factors, each old callout a badge
    on its factor and one line); then six months, the trend and top items (a fold shut on the phone).

  A tab remembered from before (Overview, Billing) opens By client. Billing's cards went: output tax and invoice states are Money →
  GST's and Pipeline's facts, and the **dispatch cycle** is Pipeline's (`#pipeDispatch`, the last 90 days). The insight list went: an
  insight is a task on Needs you.
- **Every preset of Pulse's widgets hides To-do, Recent and Money** (TM2c; Needs you holds them). A device on a preset follows the
  build's preset; a layout of the owner's own is kept.
- **The Planner is Play · Ledger · A day · Moves** (TM2d). Moves is a switch over Plant · Tech tree · Staff · Clients · Finance
  (`invPlnMoves`; the address `v=moves/<kind>`, an old kind's name opening Moves on it); a kind switched keeps the page where it is,
  a control inside the view and not a navigation (P79). One verdict card on every view
  (`#plnVerdict`: the plan's margin a month against the goal, cash's low, CQI-11, the trials' stars) replaces the goal callout and the
  heads-up tiles. The toolbar is one row: Roll, the month ‹ ›, the plan's picker where there are two plans, and More (New card, Make
  the report, Copy, Rename, Suggest a start, Start over, the goal). On the phone a register's or a move's row carries two facts and
  one thing at its end, the rest folded under it (`plnRowHtml`); the desktop keeps its tables.
- **Reports, fitted** (TM2f): the report on the page is laid out at the sheet's width and zoomed to the screen (`paperFit`, print.js,
  which the print view calls too).
- **What is measured is what is drawn** (P195): a view or widget the page hides is not on a screen's face. The notes that explained a
  figure went to the screen's guide (Stats', Today's; kbguides.js). **Needs you's toolbar budget went from 0 to 1**: the To-do's Add
  row TM2a puts there, the one budget a step has raised, said to the owner at the stop (I10).
