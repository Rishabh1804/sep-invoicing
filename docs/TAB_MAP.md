# The tab map (spec, 9 Oct 2026)

The owner, 8 Oct 2026: *"let's also work on organising the tabs under our 4 main sections. Currently, Office holds multiple
tabs, those hold multiple tabs too, same for Money and other sub tabs too. Let's discuss this along with the survey that's
done."* The map was drawn as a page (the before-and-after, with four calls), and on 9 Oct 2026: *"Go with all four
recommendations. Generate a spec file that can be followed by agents to ensure bug free and as-intended development … We'll run
the QA chain when it is coded and ready for deployment."* Then: *"Pending deposit should also be an option on payments, as
sometimes it can take days before a received cheque is submitted but thats payment done from the clients end and that must be
reflected"* (TM3b).

This file is the spec builders follow. **One PR, steps TM1–TM5, one commit (or more) per step, in order; then the QA chain on the
owner's word.** Read §1–§5 before any step, then the step's own section. Nothing here changes what the book records except TM3b.

## 0. Status

| Step | What | State |
|---|---|---|
| TM1 | The shell: the rows, the tools in the top bar, Sales, Parts, the redirect table, the names | Not built |
| TM2 | Today: To-do into Needs you, Pulse takes Stats → Overview, Stats' three tabs, Pulse's widgets, the Planner's Moves | Not built |
| TM3 | Money and Invoices: Bills & notes split (TM3a); cheques awaiting deposit (TM3b) | Not built |
| TM4 | Floor: one Overview, People's Attendance, the page Overviews out | Not built |
| TM5 | Docs, the full suite, lengths re-measured, the real-book harness, the draft PR | Not built |

## 1. The rulings

1. **Insights go in Today**, beside Pulse: Stats, Reports, Planner. History and Knowledge leave every row (§2, tools).
2. **One overview per section.** Floor's Overview (Floor → Day, renamed) carries a card each for people, production, stock and
   power; the Overviews of People, Production, Stock and Power go, and their charts move to the tab they explain.
3. **Bills & notes split.** Bills (electricity and other) go to Money → Payments; credit notes to Office → Invoices.
4. **Pulse's widgets: only what Needs you doesn't show.** To-do, Recent invoices and Money are hidden in every preset.

Names settled with them (one word, one meaning): Items → **Parts**; Stats → Clients → **By client**; People's Day, Week and
Register → one **Attendance** tab with a Day · Week · Month switch; Floor → Day → **Overview**; the Planner's Plant, Tech tree,
Staff, Clients and Finance → one **Moves** tab with a switch; Clients' Quotations and Prospects → **Sales** in Office's row.

Owner's addition (9 Oct 2026): **a cheque received from a client and not yet deposited counts as paid by the client** (TM3b). It
lives in Money → Receivables, where client payments are matched; Payments is money going out (said to the owner).

## 2. The map, exactly

Level 1 is the bar (phone) and the rail (desktop): **Today · Office · Add · Floor · Money**, unchanged. Level 2 is the section's
row (`#wsTabs`, `WORKSPACES`). Level 3 is a screen's own row. A switch (`inv-seg`, `aria-pressed`) is a control, not a tab.

### Today, the whole business (`today`)
| Row entry | Page · v | The screen's own row |
|---|---|---|
| Needs you | `pageHome` · `needs` | none (the To-do joins it: TM2) |
| Pulse | `pageHome` · `pulse` | none |
| Stats *(group label "Insights")* | `pageStats` | By client (`clients`) · Cost (`cost`) · Trends (`trends`) |
| Reports | `pageReports` | none (Daily … Yearly is a switch) |
| Planner | `pagePlanner` | Play · Ledger · A day · Moves (`moves/<kind>`; a switch: Plant · Tech tree · Staff · Clients · Finance) |

`members: []` (the To-do page is retired).

### Office, the paperwork (`office`)
| Row entry | Page · v | The screen's own row |
|---|---|---|
| Pipeline | `pagePipeline` | none (gains the dispatch cycle card, TM2) |
| Challans | `pageIM` | Awaiting invoice · Invoiced |
| Invoices | `pageRegister` | none (Credit notes and Number audit are its dialogs; credit notes gain Record and New, TM3a) |
| Clients | `pageClients` · `clients`, covers `clients`, `items`, `performance` | Clients · Parts (`items`) · Performance |
| Sales | `pageClients` · `prospects`, covers `prospects`, `quotes` | Prospects · Quotations (`quotes`) |

`members: ['pageCreate']`.

### Floor, the plant (`floor`)
| Row entry | Page | The screen's own row |
|---|---|---|
| Overview | `pageFloor` | none (the day stepper stays) |
| People | `pageStaff` | Attendance (`day`, `week`, `register`; a Day · Week · Month switch) · Pay · Areas · Roster |
| Production | `pageProduction` | Lines · In plant (`plant`) · Entries · Equipment |
| Stock | `pageStock` | none: one screen |
| Power | `pagePower` | Cuts · Causes · Load & bills (`load`) · Case |

### Money, the cash (`money`)
One view, `pageFinance`, so its own row is the section's row: **Overview · Receivables (`receipts`) · Payments · Bank · GST**.

### Tools: in the top bar on every screen, both layouts
**Search · Knowledge (the book) · History (a clock) · Settings.** `pageKnow` and `pageHistory` belong to no workspace
(`wsOf()` is null): no door lit, no section row, the title is the page's own, no swipe, a task jumping there counts on Today.

### Counts (P184 asserts them)
68 tabs become 51; no row wider than five; two screens are called Overview (Floor's and Money's), Pulse and Pipeline lead the
other two sections.

## 3. The rules (amend `docs/SEP_INVOICING_DESIGN_PRINCIPLES.md` §4 with these, TM5)

1. **Four sections, by subject.** Today is the whole business, Office the paperwork, Floor the plant, Money the cash. Add is a door.
2. **One overview per section, first in its row:** Pulse, Pipeline, Floor's Overview, Money's Overview.
3. **Three levels at most:** the bar, the section's row, the screen's row. A form, a record or a review opens behind a back arrow
   (a sub-view) or in a dialog, never in another row.
4. **No row wider than five**, so every row fits a phone.
5. **One word, one meaning.** No tab name stands for two different places.
6. **A switch is not a tab.** Day / week / month, revenue / tonnage, the period: a segmented control on the screen.
7. **Tools sit on every screen**, in the top bar, never in a row.

## 4. Invariants (every step, every builder)

- **I1. The book does not change** (except TM3b's `S.bank.cheques`, which is new). No migration, no key renamed, no export
  changed except TM3b's. This is navigation and drawing. Device-side keys (localStorage) may change as each step says.
- **I2. Every old address still opens** where its screen went, through the one redirect table (§5): a bookmark, a manifest
  shortcut, the Windows widget's launch URL, a step of the back trail saved in sessionStorage by an older build, a new window,
  a KB link, a search Recent entry, a To-do task saved with a `go` naming an old view. A remembered view in localStorage whose
  value no longer exists falls back to the screen's new default.
- **I3. No dangling door.** A step that moves or removes a view re-points, in the same step, every door to it: `todoGo` kinds,
  `advGoTo` kinds, `WS_GO_PAGE`, the search index (`srchScreens`, `SRCH_SPACES`, `srchEntryLoc`, `srchLocOf`), Pulse's widgets'
  links, quick actions, Add's routes, `finlinks.js`, report links, the KB guides (`kbguides.js`: text **and** the next `version`),
  help and note text that names the old path, `CHG_*` section labels that name a path. The step's grep checklist comes back empty.
- **I4. Roles.** A card, a door, a link or a count shows a role only what its screens show: the page by `grdSees(page)`, wages by
  `grdSeesWages()` / `attSeesWages()`, money by `grdSeesMoney()` / `finSeen()`, tasks by `todoSees`. A new card checks what its
  page checks. A link a role could not follow is drawn as text, not a button.
- **I5. The house rules.** HR-1…HR-9 and DR-1…DR-8 (CLAUDE.md). One primary per view (`.inv-btn-primary` outside
  `[data-shell-primary]`, P76). No `confirm()` / `alert()` / `prompt()`: `uiConfirm` / `uiAlert` / `uiPrompt`. A `<select>`
  speaks through `change`, never `data-action`. A change inside a view redraws in `keepScroll`; only a navigation calls `viewTop()`.
  A new door that leaves a form is in `NAV_LEAVE_ACTIONS` or is `role="tab"`. `escHtml` on every user string. **Every new
  top-level name is grepped across `split/*.js` first** (one global scope; a later module silently replaces an earlier one).
- **I6. Tests.** No test is deleted, skipped or weakened to get green. A test asserting a view that moved is rewritten to assert
  the same fact where it now lives (§8 lists them). Each step adds its spec (P184–P188), which must fail on the build before the
  step. The full suite is green at the end of each step (`pnpm exec playwright test`, about 13 minutes; not a hang).
- **I7. Both layouts.** Every change is checked on the phone (393 px) and the desktop (1280 px). The list-and-pane screens keep
  filling the room on the desktop (P80): nothing added above a `.inv-pane-host` may make the page scroll.
- **I8. One fact, one screen.** A card that moves is moved, not copied. Its old home keeps at most a link.
- **I9. Build and commit.** `bash split/build.sh` after every edit to `split/` (the pre-commit hook rebuilds too); never edit
  `sep-invoicing.html`, `index.html` or `version.json` by hand. Commit trailers as CLAUDE.md says; no model name anywhere.

## 5. The redirect table

One pure helper in `nav.js`, **`navRedirect(loc) → loc`**, applied (a) in `navLocFromUrl` before its `isPageId` test, so a
removed page id still redirects, and (b) at the head of `navApply`, so a saved `history.state` or trail step redirects too. It
returns a new `{tab, v, id, d}`; an address it does not know is returned unchanged. **Each step adds its own rows when it
removes the place** (never earlier: a row added before its step would hide a screen that still exists).

| Step | Old address | Opens |
|---|---|---|
| TM2 | `?tab=pageTodo` (any v) | `pageHome` · `needs` (a `todo=` launch parameter still works: init.js reads it once `navLocFromUrl` returns the redirected place) |
| TM2 | `pageStats` · `overview` | `pageHome` · `pulse` |
| TM2 | `pageStats` · `billing` | `pagePipeline` |
| TM2 | `pagePlanner` · `plant` / `tech` / `staff` / `clients` / `finance` | `pagePlanner` · `moves/<that kind>` |
| TM3a | `pageFinance` · `bills` | `pageFinance` · `payments` |
| TM4 | `pageStaff` · `overview` | `pageFloor` |
| TM4 | `pageProduction` · `overview` | `pageFloor` |
| TM4 | `pagePower` · `overview` | `pageFloor` |
| TM4 | `pageStock` · `overview` | `pageStock` · `list` |

The same mapping governs the remembered keys: `sep_inv_stats_tab` (`overview`/`billing` → `clients`), `sep_inv_planner_view`
(an old kind → `moves` with that kind), `sep_inv_fin_tab` (`bills` → `payments`), `sep_inv_prod_tab` (`overview` → `lines`),
`sep_inv_power_tab` (`overview` → `cuts`); and `regFilter.activeTab` restored from `sep_inv_view_prefs` (`pageTodo` →
`pageHome`). `todoGo` and `advGoTo` map the old values a saved task may carry: `{kind:'stats', tab:'overview'}` → Pulse,
`{tab:'billing'}` → Pipeline, `{kind:'bills'}` → Payments (TM3a), `{kind:'planner', v:'tech'}` → Moves · Tech tree,
`{kind:'production'}` with no tab or `overview` → Lines, `{kind:'power'}` with no tab or `overview` → Cuts.

## 6. The steps

### TM1 — The shell

**Goal:** the rows of §2 (with the screens as they are today: Stats still has five tabs until TM2, and so on), Sales and Parts,
the tools in the top bar, the redirect helper, the names. Files: `workspace.js`, `nav.js`, `tabs.js`, `body.html`, `items.js`,
`search.js`, `guard.js`, `kbguides.js`, `styles.css` (only if a class is needed), `tests/e2e/fixtures.ts`.

1. **`WORKSPACES`** exactly as §2 (Today: Needs you, Pulse, Stats with `group: 'Insights'`, Reports, Planner, `members: []` is
   set in TM2 when the To-do goes; keep `members: ['pageTodo']` until then. Office: Pipeline, Challans, Invoices, Clients
   `{tab:'pageClients', v:'clients', vs:['clients','items','performance']}`, Sales `{tab:'pageClients', v:'prospects',
   vs:['prospects','quotes']}`. Floor: the first view labelled **Overview**. Money unchanged.) `pageHistory` and `pageKnow` are
   in no workspace.
2. **A view with `vs`** (new, `workspace.js`): `wsViewOn` picks the view whose `v` equals the address's first segment **or whose
   `vs` contains it**; `wsPageName` matches the same way; `wsShellDraw` remembers, for such a view, the page's current v (so
   Office's door returns to Quotations if that was open), not the entry's default. `wsSwipeTarget` needs no change (it walks
   `views`). Ctrl/middle-click on a row tab opens `{tab, v}` (search.js `srchLocOf`, unchanged).
3. **Clients' own row** (`items.js` `_buildSubViewToggle`) draws only the group the active sub-view is in: `clients`,
   `items`, `performance` → **Clients · Parts · Performance**; `prospects`, `quotes` → **Prospects · Quotations**. Label `Items` →
   `Parts` everywhere a tab, a heading or a path names the parts master to the user (search entry `items` label "Parts", words
   keep "items"; `quote.js` "(Items → Part weights)" and `create.js` "Items → Part weights" → "Clients → Parts → Part weights").
   The internal sub-view id stays `items`.
4. **`navLabel`** (nav.js): Clients `items` → "Parts", `prospects` → "Prospects" (missing today), Stock `check` → "To check"
   (missing today).
5. **Tools in the top bar** (`body.html`): a **History** button with a clock icon, phone (`inv-topbar-btn`) and desktop (ghost
   icon button, as the book's pair), `data-action="invGoHistory"` → `navOpen({tab:'pageHistory', v:'', id:''})`. Hidden for a
   role that does not see `pageHistory` (`grdApplyDoors`: add `.inv-topbar [data-action="invGoHistory"]`). Order on the phone:
   Search · History · Knowledge · Settings (the guard user button where it is). `invGoHistory` and `invGoPulse` (the rail's
   mark, a known gap) join `NAV_LEAVE_ACTIONS`.
6. **`PAGE_TITLES`** say the map's names (they reach users in refusal toasts, the guard's roles grid and render notices):
   `pageHome` "Today", `pageRegister` "Invoices", `pageStaff` "People", `pageFinance` "Money", `pageFloor` "Floor overview";
   `GRD_PAGE_FALLBACK.pageFloor` "Floor overview"; the roles grid's rows "Wages (People → Pay)" and "Money (Money, Stats,
   Reports, Planner)".
7. **`navRedirect`** (§5) in `nav.js`, wired into `navLocFromUrl` and `navApply`, with an empty table (TM2–TM4 add rows). P184
   tests it with a row injected by the test (`page.evaluate`), so the mechanism is proven before any row exists.
8. **Search** (`search.js`): every entry's where-label follows the map (Stats, Reports, Planner: "Today", "Today › Stats", "Today
   › Planner"; History, Knowledge: "Top bar"; Clients' Quotations and Prospects: "Office › Sales"; a new entry `sales` "Sales" →
   `at('pageClients','prospects')`; Day → "Overview", "Floor"); `SRCH_SPACES` (Go to and the G keys): Today `['needs','pulse',
   'stats','reports','planner']`, Office `['pipeline','im','register','clients','sales']`, Floor `['floor','people','production',
   'stock','power']`, Money `['money']`; the keys dialog's labels.
9. **KB guides** (`kbguides.js`): "Office → **Planner**" → "Today → **Planner**"; any text naming Day on the Floor row; bump each
   changed guide's `version`.
10. **Fixtures** (`tests/e2e/fixtures.ts`): `WS_OF` restates the new map (pageStats, pageReports, pagePlanner → today; pageHistory,
    pageKnow → none: the helper opens them through the top bar's button or `navOpen`); `switchTab` still works for every page.

**Acceptance:** §2's rows on both layouts (TM1 version: Stats' row still five), Clients/Sales rows as above, the History button
on every screen for the owner and hidden for the Office role, History and Knowledge light no door and draw no section row,
`?tab=pageClients&v=quotes` lights Office → Sales, swiping Office goes Pipeline → Challans → Invoices → Clients → Sales, the
rail's mark asks before leaving a typed form. **Spec P184** (`p184-tab-map.spec.ts`, `.desktop.spec.ts`).
**Grep after:** `label: 'Day'` in workspace.js (none); `'Items'` as a user-facing label (none outside comments).

### TM2 — Today

Files: `todo.js`, `today.js`, `tabs.js`, `body.html`, `nav.js`, `init.js`, `learn.js`, `intel.js`, `stats.js`, `why.js`,
`insights.js`, `advice.js`, `report.js`, `pipeline.js`, `planview.js`, `search.js`, `guard.js`, `workspace.js`, `kbguides.js`,
`sw.js`, `manifest.json`.

**TM2a. The To-do joins Needs you.** Needs you already shows every open task (app tasks, folds and yours, ranked as the To-do
ranks them), ticks yours, opens every task's dialog and carries each task's move. It gains what only the To-do page had:
- **Add a task**, at the head of the tasks stack (inside `[data-card="tasks"]`, above the Now hero): the To-do's toolbar —
  `<input id="todoNew" data-todo-new placeholder="Add a task…">`, **Add** (`invTodoAdd`, the view's one primary: Needs you had
  none) and **Details** (`invTodoNew`, secondary). Enter in the field adds (events.js already routes `[data-todo-new]`).
  `todoQuickAdd` redraws through `todoRefreshViews` and puts focus back on `#todoNew`.
- **Snoozed** (`data-card="snoozed"`, fold `tdy-snoozed`, shut), only when a task is snoozed: its rows with Wake.
- **Done** (`data-card="done"`, fold `tdy-done`, shut): `uiMoreHtml('todoDone', …todoMineRowHtml)`, newest `doneAt` first, the
  tick reopens.
- **Learnt from your answers**: `learnPanelHtml()` (keeps `#todoLearn`), only when it has anything and the role may change
  settings, at the foot.
- On the desktop these sit in the tasks stack (`inv-panels-wide`), so `uiMasonry` packs as now.
Then the page goes: `#pageTodo` from `body.html`, `pageTodo` from `PAGE_TITLES`, `tabRender`, `nav.js` (navLoc, navLabel,
navApply), `GRD_PAGE_IDS` and the default roles (a saved role listing it is harmless), `members`; `renderTodo` and code only
it used are deleted (the engine stays: `todoRanked`, `todoApp`, `todoGo`, the dialogs, `todoMineRowHtml`, the widget). Re-point:
- `homeQuick('task')`, Add → By hand → Task, search "Add task", `GRD_QUICK_PAGE.task` / `GRD_ADD_PAGE.task` → Needs you with
  `#todoNew` focused (`pageHome`).
- `todoGo('todoLearn')` and `WS_GO_PAGE.todoLearn` → Needs you, revealing `#todoLearn`.
- `todoHandleLaunch` → Needs you: `add` focuses `#todoNew`; `open:a:<key>` / `open:m:<id>` open that task's dialog there.
- `sw.js` `widgetOpen` → `'./?tab=pageHome&v=needs&todo=' + …`; `manifest.json`'s To-do shortcut → `./?tab=pageHome&v=needs`
  named "Needs you". Old URLs redirect (§5).
- Pulse's To-do widget's foot → Needs you. Search: `todo` "Your tasks" → Needs you; `todo-done` "Done tasks" → Needs you with the
  Done fold opened.
- `kbguides.js` 'today' guide: screens `['pageHome']`, text names Add task and Done on Needs you; next version.

**TM2b. Pulse takes Stats → Overview.**
- Pulse after: head (the period word, a **period switch** MTD · QTD · YTD · All sharing `_statsPeriod` with Stats, **Make a
  report** `invRptFromStats`, and the Stats link) → the questions (as now) → Do first (as now) → **Why it moved** (`whyHtml` for
  the period, `#statsWhy` keeps its id) → **In one line** (`statsOverviewHtml`, with its Cash row and plated row; `#statsOverview`
  keeps its id) → **This month at its pace** (`paceCardHtml`, `#statsPace`) → the widgets. Changing the period redraws Pulse in
  `keepScroll` (today Pulse ignored a change made on Stats until the next save). Without money Pulse draws none of these, as now.
- Stats → `STATS_TABS = [['clients','By client'],['cost','Cost'],['trends','Trends']]`; `statsTab()` and `navApply` fall back
  to `clients`. Stats' toolbar keeps the period chips; "Make a report" leaves Stats (Pulse has it; Reports is in the same row).
- The Overview's cards: the questions are Pulse's (`statsStoriesHtml`, `statsStory` and the dead `advPulseHtml` are deleted;
  `statsStoryCards` stays, Pulse uses it); Why it moved, In one line and pace to Pulse; **the headline** ("<period> performance":
  revenue, tonnage, realisation, margin, with its coverage, below-cost and credit-note callouts) and **six months**
  (`statsMonthsHtml`) to the head of **Trends**; the insights list (`insightsCardHtml`) goes (they are tasks on Needs you; the
  'changed' question's "all insights" link → Needs you).
- Stats → Billing's cards: Output tax, Invoice states and Unbilled material go (their facts live on Money → GST and Pipeline's
  stages); **Dispatch cycle** moves to Pipeline: extract it from `renderStats` into a function (`statsDispatchCycleHtml(invs)` or
  similar; grep the name) and draw it in `.inv-pipe-rail` after the stages panel, over **the last 90 days**, said in the card.
- Re-point: `todoGo('stats')` (tab `overview` → Pulse, `billing` → Pipeline), `insGo('overview')` (insRealLow) → Trends,
  `invStatsInsightsAll` and the story heads' `invStatsGo` (deleted with the stories), Pulse's empty text "Office → Stats has the
  figures" → "Stats has the figures", search entries (`stats` "Stats" → By client; `stats-clients` "By client"; `stats-billing`
  → "Dispatch cycle" at Pipeline), `rptFromStats` reads `_statsPeriod` as before.

**TM2c. Pulse's widgets.** `HOME_PRESETS`: every preset hides `todo`, `recent` and `money` (owner: order puts them last; floor and
money presets likewise). `homeLayout()`: a saved layout whose `preset` is not `custom` is rebuilt from `HOME_PRESETS[preset]` on
read (a device on a preset follows the ruling; a custom layout is the owner's and is kept).

**TM2d. The Planner's Moves.** `PLN_VIEWS = [['play','Play'],['ledger','Ledger'],['day','A day'],['moves','Moves']]`;
`PLN_MOVES = [['plant','Plant'],['tech','Tech tree'],['staff','Staff'],['clients','Clients'],['finance','Finance']]`. On Moves a
switch (`inv-seg`, `invPlnMoves`, `data-k`, `aria-pressed`) under the row picks the kind; the body is the kind's existing
function. The address is `v=moves/<kind>`; `plnSetView` takes `moves/<kind>` and the old kind names (§5); the key
`sep_inv_planner_view` stores `moves/<kind>`. Re-point plnCheck (`v:'tech'`) and plnMachine (`v:'plant'`), search's planner
entries, the KB planner guide ("**Moves → Finance** → Lenders"), planview.js's own text naming views.

**TM2e. Redirect rows** for TM2 (§5), and `WORKSPACES.today.members = []`.

**Acceptance:** Needs you adds, ticks, reopens from Done, wakes from Snoozed, shows Learnt; `?tab=pageTodo&todo=add` lands on
Needs you with `#todoNew` focused; `todo=open:a:<key>` opens that task; Pulse shows the period switch, Why it moved, In one line
and pace, and changing the period redraws it; Stats' row is By client · Cost · Trends; Trends leads with the headline and six
months; Pipeline shows the dispatch cycle; the Planner's row is four with the Moves switch; a device on the Owner preset loses
the three widgets, a custom one keeps them. **Spec P185.** **Grep after:** `pageTodo` (only §5's row and comments),
`renderTodo(`, `'overview'` / `'billing'` in intel.js, `advPulseHtml`, `statsStoriesHtml`, `invStatsInsightsAll`.

### TM3 — Money and Invoices

**TM3a. Bills & notes split.**
- `FIN_TABS = [['overview','Overview'],['receipts','Receivables'],['payments','Payments'],['bank','Bank'],['gst','GST']]`.
- **Payments leads with the bills** (`#billsPower`, "Bills: electricity and other"; the missing months with Add and "Add ₹X
  paid <date>", the bills in month order with Void, the bill form when open: `_costBillOpen.where === 'finance'`), **drawn with
  or without a statement** (today `renderBank` returns early with no statement: draw the bills, then the empty statement panel).
  `#bankPower` "Electricity paid" follows; its head link "Open Bills & notes" (`invGoBills`) goes.
- **Credit notes** move into Office → Invoices → **Credit notes** (the dialog `renderCreditNoteList`): its head carries
  **Record issued** and **New note** (secondary; also in the empty state, which has no toolbar today); the forms
  (`_billsCnFormHtml`, `billsCnFormInput`, `billsCnFormSave`, all kept in bills.js with every global other files use:
  `billsMonthLabel`, `cnIsRebate`, `billsCnFy`, `billsMissingPower`, `billsPrevMonths`, `stockEditHtml`, `stockEditSave`,
  `STOCK_UNIT_CHOICES`) draw inside the dialog and redraw it (`renderCreditNoteList` with `{replace:true}`) where they called
  `renderFinance()` (bills.js: the open, the input, the save, the cancel). After **New note** saves, the preview opens as now.
  `cancelCreditNote`'s redraw follows. **A save or a cancel refreshes the Register's toolbar badge and the rows' CN marks** (today
  the badge goes stale: reset `_regToolbarRendered` and redraw the register view).
- Re-point: `todoGo('bills')` (kept as an alias for saved tasks) → `finSetTab('payments')`, the form open on `go.month` when
  given, reveal `#billsPower`; the advice move's label "Bills & notes" → "Add the bill" (and a saved task's `goLabel` "Bills &
  notes" is shown as "Add the bill"); search `bills` → "Bills" at "Money › Payments"; `srchEntryLoc.bills` → payments; Live cost's
  bill form (`where: 'stats'`) → a link "Add a bill" (`todoGo({kind:'bills'})`) and the list read-only, its note "Bills are
  entered in Money → Payments"; `power.js` "Bills are added in Money → Payments"; the KB credit guide "Office → Invoices → Credit
  notes → **New note** / **Record issued**" (next version); `WS_GO_PAGE.bills` stays `pageFinance`.
- Redirect row (§5).

**TM3b. Cheques awaiting deposit** (owner, 9 Oct 2026).
- **The record:** `S.bank.cheques: [{id, clientId, amount, number, chequeDate, drawnOn, receivedOn, note, at, by, deposit?,
  voidedAt?, voidReason?, voidBy?}]`. `bankData()` repairs it; `getDefaultState().bank` gains `cheques: []`; `CHG_TRACK` gains
  `{path:'bank.cheques', kind:'arr', noun:'cheque received', cid: r => r.clientId, label: …}` (the change log and the merge
  read it); the `sep-bank` export carries `cheques` and its import merges them by id, never overwriting (**a data flow
  soma-internal reads: say so in the PR and in NEXT_SESSION's data-flow table**).
- **Recording:** Money → Receivables → **Cheque received** (secondary; the tab's primary stays what it is) and Add → By hand →
  **Cheque received**, one form (a dialog): client (required), amount (required, > 0), cheque number (required, digits), cheque
  date, drawn on (optional), received on (default today, never in the future), note. `bankGate('record a cheque received')`.
  The same client and number twice (not voided) is refused. Works with or without a statement.
- **It counts as paid from the day it was received:** `bankReceivables` takes each live cheque (not voided, not deposited) as a
  receipt event dated `receivedOn` (`pending: true`), placed by the same rules as a receipt (exact to the rupee, else oldest
  first, never against an invoice raised after it). So owed, the open list and its ageing, days to pay, the statement of account
  (a line "Cheque 525428 received, not yet in the bank"), Pipeline's Owed to us, a client's Money panel, Pulse's cash question
  and the owed90 / payingSlower rules all reflect it with no other change.
- **The deposit:** a statement credit whose instrument number (`bankInstrument`) equals the cheque's number, dated from three days
  before `receivedOn` to 60 days after, **is the cheque's deposit** (worked out on every read, like a bounce's link by number;
  the owner's own choice on the cheque, `deposit: <row id>` or `deposit: null` "not this", wins). From then the cheque stops
  counting and the deposit row does: no double count. **A deposit row the cheque names is placed on the cheque's client** unless
  the row was placed by hand (`row.set`). A credit of the same amount with no number, within 15 days, is **offered** (Link),
  never applied. A deposit later returned is handled by the bounce logic as now; the cheque then reads Returned.
- **On screen:** Receivables leads, when any cheque is live or deposited in the last 30 days, with **Cheques received**: client,
  ₹, number, received date, and a dot and word (In hand · N days; Deposited <date>; Returned), with Link (an offer) and Void
  (a reason, required; never deleted). A client's receipts list shows a live cheque as "Cheque 525428 · in hand since 2 Oct".
  Money → Overview's balance tile says "+ ₹X in cheques in hand" when any.
- **The forecast** expects a live cheque in the bank on the next working day after today (or its received day, if later).
- **To-do rule `chequeHeld`** (switchable, Settings → Checks & alerts → To-do): a live cheque in hand 3 days or more is amber, 7
  red; its text says whether the statement reaches past the day it was received ("not in the bank by <statement end>") or not
  ("import the statement to check"). Its move opens Receivables on the cheque.

**Acceptance:** Money's row is five; Payments shows the bills with and without a statement; the To-do's bills task opens the form
on its month; Record and New work from the Credit notes dialog (empty and not), and the Register's badge and CN marks follow; a
cheque recorded lowers owed at once, its deposit (same number) takes over without counting twice and lands on the client, a
held cheque raises the task, a void puts owed back, the export carries cheques. **Specs P186 (bills and notes) and P187
(cheques).** **Grep after:** `'Bills & notes'` in UI strings (none), `finSetTab('bills')`, `renderBillsNotes`, `invGoBills`,
`data-where="stats"`.

### TM4 — Floor

**TM4a. Floor's Overview** (`floor.js`, `pageFloor`; the page keeps its address `?tab=pageFloor&d=…` and its day stepper):
- Below the stepper, **four hero cards** in Today's card language (`uiHeroHtml`, coded by status, a one-line verdict, a meter or
  figure, the foot a link to the page): **People** (on site against the roster and against the day's number, short areas; link
  People → Attendance, Day), **Production** (plated on the day, this week against capacity; link Production → Lines), **Stock**
  (lines out and low, the first three names, the reorder's cash when the role sees money; link Stock), **Power** (the day's cuts
  and minutes, the month so far, a year at this rate; the load to chase when approved and not yet billed; link Power → Cuts).
  People and Production read the day on screen; Stock reads now and says so; Power reads the day and the month to date.
- Each card shows for a role that sees its page (`grdSees`); People's figures are heads (no rupees). **A link the role cannot
  follow is text.** The line cards' staffing word, EXTRA badge and the old tiles' doors follow the same rule (today a floor hand's
  tap on them is refused with a toast).
- The three tiles (on site, plated, power) go: the heroes say them (I8). The line cards stay, under the heroes.
- On the desktop the heroes are a row (`.inv-heroes`), the lines below.

**TM4b. People** (`staff.js`, `dash.js`, `payroll.js`, `relay.js`):
- The row is **Attendance · Pay · Areas · Roster**. `_attView` keeps its values; the tab **Attendance** is selected for `day`,
  `week` and `register`, and clicking it returns to the last of the three (default `day`). Under the row on those views a switch
  **Day · Week · Month** (`invAttPeriod`, `data-view`, `aria-pressed`) moves between them. Addresses unchanged (`v=day`, `week`,
  `register/YYYY-MM`). Default view `day` (was `overview`); `_attPrevView` default `day`; `navApply` falls back to `day`.
- The Overview goes. Its cards: today's attendance → Floor's People hero; **attendance by week** (`dashAttendanceByWeek`, keep
  `attPresenceForRange`: report.js uses it) → the head of Week; **labour ₹/kg by month** and **payroll against the bank** → the
  head of Pay, wages-gated, and **their bank series gated by money (`finSeen`)** (today only by `finHasBank`: a role with wages
  and no money saw bank figures); OT and EXTRA by area → nothing (Areas already has `areaHoursCard`); Raised → nothing (Needs you).
- Re-point every `'overview'` default (staff.js, relay.js:1028, search `people` → `day`), the KB guides' "Floor → People → Day" →
  "Floor → People → Attendance".

**TM4c. Production** (`prodview.js`, `plant.js`):
- `PROD_TABS = [['lines','Lines'],['plant','In plant'],['entries','Entries'],['equipment','Equipment']]`, default `lines`.
- The Overview goes. Its pieces: the tiles → Floor's Production hero (In plant keeps its own book and plated-not-invoiced tiles);
  **plated by line, 4 weeks** (`#prodChart`) → the head of Lines; **record coverage** (`#prodCoverage`) and **line unknown**
  (`#prodUnknown`) → the head of Entries; the glance (`#pltGlance`) stays only on the no-entries empty state; Raised → nothing.
- Re-point `todoGo('production')` default → `lines`; search `production` → `lines`, a new `equipment` entry.

**TM4d. Stock** (`stock.js`, `dash.js`, `today.js`):
- **One screen**, no tab row (`stockViewTabsHtml` goes). `_stockView` and `_stockHome` default `list`; `navApply` maps
  `overview` → `list`; `today.js`'s stock input opens the list.
- The list keeps its toolbar (now always with Reorder list, Export, Import), its status tiles (they filter) and groups. When
  there is anything to order, a callout at the top: "Reorder ₹X with GST" and, for a role that sees money with a statement, the
  forecast's low after it, toned; link "Open the reorder list".
- **Spend and prices** (spend by supplier, used by week, the price trend with zinc's market panel): on the phone a fold at the
  foot of the list (`uiFoldHtml('stock-spend', …)`, shut); on the desktop a toolbar button **Spend and prices** opens them in the
  pane (with no line open), so the list and pane still fill the room (P80). Days left as ranked bars goes (the list's groups say
  it). The sweep's `walkZinc` opens Spend and prices instead of the Overview.

**TM4e. Power** (`power.js`, `powercause.js`):
- `POWER_TABS = [['cuts','Cuts'],['causes','Causes'],['load','Load & bills'],['case','Case']]`, default `cuts`.
- The Overview goes. Its pieces: the month, cost and year tiles → the head of Cuts (and Floor's Power hero); the load tile → the
  head of Load & bills; **cuts by month** and **when they come** → Cuts, after the tiles; **why they come** → nothing (Causes has
  the full list); Raised → nothing. "To complete" stays on Cuts only (Causes links to it).
- Re-point `todoGo('power')` default → `cuts`; search `power` → `cuts`.

**TM4f. Redirect rows** for TM4 (§5).

**Acceptance:** Floor's row is Overview · People · Production · Stock · Power; the Overview shows the four heroes per role (owner
all four, supervisor all four, the floor role People without a link, Production and Stock, no Power), the line cards and the
stepper; People's row is four with the Day · Week · Month switch and unchanged addresses; Week leads with attendance by week, Pay
with labour ₹/kg and payroll against the bank (no bank series without money); Production's row is four, Lines leads with plated
by line, Entries with coverage and line unknown; Stock has no row, the reorder callout and Spend and prices (fold on the phone,
pane on the desktop); Power's row is four, Cuts leads with its tiles and the two charts; every old Overview address lands as §5
says. **Spec P188.** **Grep after:** `staffOverviewHtml`, `stockOverviewHtml`, `prodOverviewHtml`, `powerOverviewHtml`,
`stockViewTabsHtml`, `'overview'` as a view value in staff.js, relay.js, dash.js, stock.js, prodview.js, power.js, todo.js,
today.js, search.js (none).

### TM5 — Docs, verification, the PR

1. **Docs:** CLAUDE.md (a section "The tab map" under the Next-session block pointing here; every section that names a moved
   screen; the module list's descriptions; the test count), `docs/SEP_INVOICING_DESIGN_PRINCIPLES.md` §4 (the rules of §3 and
   the map), `docs/NEXT_SESSION.md` (a top section; the data-flow table gains `sep-bank` `cheques`), `docs/COGNITIVE_LOAD_SURVEY.md`
   (step 0 built; what it took from steps 1 and 2), this file's §0.
2. **The full suite** green on both projects; P76, P79 and P80 sweep the new map (their PAGES and DIALOGS lists updated in the
   steps that changed them).
3. **Measured on the owner's book** (scratchpad only, never committed): every screen's length on both layouts against the
   survey's table; a harness pressing every action on every page and view, both layouts, no uncaught error.
4. **Push, a draft PR**, subscribed; the owner is told; **the QA chain waits for the owner's word**.

## 7. The specs to add

| Spec | Step | Asserts (each fails on the build before its step) |
|---|---|---|
| P184 `p184-tab-map(.desktop).spec.ts` | TM1 | every section's row exactly as §2 (TM1 version), Clients/Sales rows by sub-view, swipe order, the tools in the top bar per role, History and Knowledge with no door and no row, `navRedirect` with an injected row (from a URL and from a saved history state), the names in refusal toasts |
| P185 `p185-today-map(.desktop).spec.ts` | TM2 | Needs you's add / Done / Snoozed / Learnt; the launch URLs; Pulse's period switch and the moved cards; Stats' three tabs; Trends' head; Pipeline's dispatch cycle; the Planner's Moves; the presets; TM2's redirect rows |
| P186 `p186-bills-notes-map.spec.ts` | TM3a | Money's row; Payments' bills with and without a statement; the bills task; Record and New from the Credit notes dialog; the badge and CN marks; Live cost's link; the redirect row |
| P187 `p187-cheques-in-hand.spec.ts` | TM3b | record, owed falls, deposit by number takes over once and places the client, an amount offer, the held task at 3 and 7 days, void, export and import merge, the statement of account's line |
| P188 `p188-floor-map(.desktop).spec.ts` | TM4 | Floor's Overview per role, People's switch and moved charts (bank series gated by money), Production, Stock (fold and pane), Power, TM4's redirect rows |

Fake names in the shop's shapes; dates from `todayIso()` / `recentTs()`; `noSeedIM()` where challans matter; `answerAsk` for
in-app questions.

## 8. Existing specs the steps must rewrite (not weaken)

The list is in §8a (filled from the test survey). A builder rewrites each assertion to the new place of the same fact. A spec
that asserted a screen which no longer exists asserts its successor (§5) instead.

## 9. Builder protocol

1. Work on the branch given, one step at a time, in order. Read §1–§5 and the step. Read the files named before editing them.
2. Grep every new top-level name across `split/*.js` before adding it.
3. Build (`bash split/build.sh`), run the step's spec and every spec §8 lists for the step, then the full suite.
4. Commit the step with a message saying what moved and why, the trailers CLAUDE.md gives, no model name.
5. Report: files changed, specs added and rewritten (with counts), the suite's result, the step's grep checklist output, and
   anything left or decided differently, with the reason. Never mark a step done with a failing test, a dangling door or an
   unchecked layout.
6. Never: delete or skip a test to get green; write the owner's data into the repo; call a browser pop-up; add an inline style;
   change the book's shape beyond TM3b.
