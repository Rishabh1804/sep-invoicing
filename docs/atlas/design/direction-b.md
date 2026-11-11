---
subject: "Direction B: workspaces, Today, Add, Pipeline, Floor overview, search"
domain: design
modules: [split/add.js, split/pipeline.js, split/search.js, split/swipe.js, split/workspace.js]
specs: [docs/COGNITIVE_LOAD_SURVEY.md, docs/DIRECTION_B.md]
tests: [P134, P135, P136, P137, P138, P139, P164, P165, P178, P180, P182, P183, P188, P196]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Direction B: workspaces, Today, Add, Pipeline, Floor → Overview, search
The rest of `docs/DIRECTION_B.md` (owner, 1 Oct 2026), steps B2 to B6. P134–P139.
- **Workspaces** (`workspace.js`, P134). The phone bar is **Home · Office · Add · Floor · Money** (Today until UI pass 3), with no More; the desktop's
  rail is the same doors (the mark, Add, the four workspaces, Settings). A workspace is a layer over the pages that exist: every
  page keeps its id, its address and its own view tabs, and the workspace draws its views as a tab row under the top bar
  (`#wsTabs`; `WORKSPACES` is the one map). Since UI pass 3 (U2, below): Home (its id still `today`) holds Home and Needs you, then its
  Insights under their name (Stats, Reports, the Planner); Office holds Pipeline, Challans (pageIM), Invoices (pageRegister),
  Clients and Sales (one page, pageClients); Create is a page it holds without a tab. Floor holds its Overview (pageFloor),
  People (pageStaff), Production, Stock and Power. Money is Finance. History and Knowledge are the top bar's tools, in no
  workspace. Opening a workspace from the bar or the rail is a step of its own (its last view this session, else its first),
  so Back from Challans goes to the Office view it came from. Swiping stays inside the open workspace (Needs you to Stats crosses
  into the Insights).
- **Three levels, the same on both layouts** (owner, 8 Oct 2026: *"in the desktop view we have many tabs that are actually tabs
  that exist under a different tab but it is there on the sidebar which I feel is the wrong design choice as user will not
  understand the hierarchy. What do you think?"*, and *"Move insights into office tab, that way we have 5 icons again, which can
  be arranged in a better way"*; P182). A **workspace** is a door, on the phone's bar or the desktop's **rail** (`--side-w`
  5.5rem, the bar stood on its side), and nothing under it is listed there; its **views** are the tab row under the top bar,
  on the desktop too (it stood in the top bar, and the sidebar listed every view again beside the workspaces); a **page's own
  views** are the row under that. `--fill-h` takes the row off the room a list-and-pane screen fills. Insights was a workspace,
  the bar's sixth (6 Oct 2026, *"Insights has no direct link"*, P164), and put Add off the bar's centre: it was Office's
  Insights (8 Oct 2026), and is Home's since the tab map (9 Oct 2026; the workspace was named Today until UI pass 3). **One door, one geometry** (`wsDoorHtml`): a mark (`inv-navbar-mark`, the icon in a pill) over its word, every word on one
  line; the workspace on screen fills its pill in the accent's soft colour, Add (the centre door) in the accent, never raised;
  the red count sits on the mark's corner. The rail's mark opens Home (`invGoHome`; Pulse until UI pass 3), and opens it in a new window on a Ctrl+click.
- **A group is named in its row, and a row past the screen says so** (owner, 8 Oct 2026: *"Insights seems to be missing on
  mobile?"*; P183). Office's row is twice a phone's width, and the Insights after Clients were out of sight with nothing naming
  them. The group's name heads it (`inv-viewtab-group`, `group` on the view in `WORKSPACES`): sticky at the row's right edge on
  the row's colour until the group comes into view, so the phone opens Office on *Pipeline Challans Invoices Clients Insights ›*;
  a tap on it brings the group in (`wsGroupReveal`), choosing no view. That row's tabs are a step tighter on the phone and a step
  more under 24rem (a 360 px screen), so the name stands after Clients' word, never over it; on the desktop a hairline sets it
  off. A page's own tab row that runs past the screen fades on the side with more (`data-more`, set by the overflow pass,
  `_ovMoreSet`, as a table's is); the workspace's row is never faded, since its cue is the name. **Since the tab map (TM1) the
  group is Home's Insights, and Home's row fits a phone**: where the whole row fits, the name is a hairline between Needs you and
  Stats (`data-group="rule"`); only a row that would run past the screen keeps the word as its cue (`data-group="word"`), measured
  on every draw and resize (`wsRowFit`, workspace.js). On the desktop the name stands in its row as before.
- **Home** (`today.js`, P135; *Today* until UI pass 3) is pageHome, two views with addresses (`?tab=pageHome&v=home|needs`; an
  old `v=pulse` lands on Home, `navRedirect`). **Home** (the default, U2 below): the day card, then the board of widgets each person
  arranges. **Needs you**: the day's five inputs (the in-time roll, the pickling loads, the stock message, the production records,
  the out-time roll), each in, late or not yet against the minute it usually arrives (the median of the last four weeks, else
  the shop's own time), with its door; on the desktop, the floor now; **the last five invoices, each with its print button**
  (`tdyRecentHtml`, the *Recent invoices* widget's own rows, `homeRecentRowHtml`; owner, 6 Oct 2026: *"to print a recent invoice
  is 4 clicks"*, P164); then every open task grouped **Now** (red, and your own due today or late), **This week** and **Later**,
  each with its one-tap move (and since the tab map the To-do's Add, Snoozed, Done and Learnt, TM2a). Pulse (the period, the
  questions, Why it moved, In one line and the month's pace, then the owner's widgets) was the second view until UI pass 3; its
  parts are Home's widgets now, and a spec reaching one puts it on the board (`openPulse`, `openWidget` in the fixtures).
- **Today is cards** (owner, 8 Oct 2026: *"need the pulse screen and needs you screen to have less cognitive load, data
  presentation on these screens are still primitive"*; *"If it is in list form, it should be presented better, maybe as a card or
  atleast an expandable hero card"*; design §6.21–6.25, P178). Needs you: the day's inputs a hero (*N of 5 in*, a meter, the next
  due) opening to steps; the tasks three heroes, Now open with its worth, This week and Later folded to a line naming what is in
  them, each a deck of cards whose face opens the task and whose foot is its move; the recent invoices a hero opening to their
  rows. On the desktop the tasks go across the top and the other cards are packed under them (`uiMasonry`). Pulse: each question
  a hero that leads with its answer as a figure, a word and a sparkline or meter (`vital`, intel.js `statsStoryCards`), opening
  across its row to the story and *What you can do* as cards (`advMovesDeckHtml`); then **Do first**, the three moves worth most
  across the questions; the month's tiles each carry a sparkline of the months before (`homeMonthsBack`). **The rail's mark
  opens Home** (`invGoHome`; Pulse, `invGoPulse`, until UI pass 3, kept as an alias); the phone's bar has no name or mark.
- **Pulse's widgets are cards too** (*Home's widgets since UI pass 3, below, which draw them from the same options*; owner, 8 Oct 2026: *"Pulse still holds generic cards as well, so it looks like a half designed
  space"*; P180). Each is a hero with its eyebrow, a one-line verdict, its figure where the line is not one, a meter or sparkline,
  coded by the worst of what it holds, shut on the phone and open on the desktop until moved, remembered per device (`fold:
  'pulse-<widget>'`; open at first until the tab map, TM2c), its links in its foot
  (`inv-hero-foot`): Month to date (`homeMtdCard`: billing against the same days last month, realisation against the cost, the
  tiles coded by their change, `figDeltaTone`), Money (owed past 60 and 90 days, the ageing as a meter, `FIN_AGE_TONE`), To-do
  (grouped as Needs you groups it), Attendance (on site, the day as a meter; `attDayPanelHtml(d, null, …)` draws the panel with no
  head), Unbilled (coded as Pipeline's first stage), Production, Power cuts, Stock running low, GitHub backup, Zinc (the market's
  last refreshes as a line), Recent invoices (`homeRecentCard`, ten rows). The quick actions are an `inv-coded` grid. Every hook a
  spec reads is kept: `#homeFin [data-home-fin]`, `#homeAtt`, `#homeAttOnSite`, `#homeTiles`, the `#mtd*` ids, `#recentInvoices`,
  `[data-card="sync"]`, `[data-zinc-age]`. **A card's `data-card` names it across the whole app**: the Unbilled and Recent widgets are
  `unbilled-pulse` and `recent-pulse` (their names from Pulse), since Stats' Unbilled and Needs you's Recent hold the plain names (a spec reading Stats'
  card found two). On the desktop a card's sheet is its tile strip's container (`panel-w`), so the strip lays out by the sheet's
  width: measured from the widget, Money's four tiles left a blank cell at 1280.
- **What the survey changed on Today** (8 Oct 2026, `docs/COGNITIVE_LOAD_SURVEY.md`): on the phone the day's inputs open shut while
  a red task waits (`tdyInputsHtml(day, {shut})`), so the red tasks lead and the head still says how many are in; a task group's
  figure reads *at stake* (the rupees its tasks name, never a total owed); the recent invoices' head says what was made today and
  its total (`tdyRecentHead`, the *Recent invoices* widget too), not the newest row a second time; the cash question is judged as the
  Money widget is (overdrawn danger, owed past 90 days danger unless a receipt is unplaced, past 60 warning, how fast clients pay), and
  both draw the one age bar (`FIN_AGE_TONE`): it had read green beside a red Money card.
- **The phone bar floats** (owner, 8 Oct 2026: *"the bottom bar … doesn't look quite nice with how the app is designed now"*, then
  *"still doesn't look right"*): a card in the surface's colour floating a step above the screen's foot (`--nav-space` is the room
  it takes; the sticky selection and action bars sit on it), five doors of one geometry, Add the filled centre one; **under it the
  page fades into its own colour** (`body::after`, never printed), so a line scrolled beneath never shows cut in the gap. On a
  tablet it keeps the phone's width, centred. The morning's dock (an accent-tinted card, Add a disc raised out of it, six doors)
  is retired: Add stood off the centre and its word off the others' line.
- **Tiles are raised** (owner, 8 Oct 2026: *"Let's give our tiles elevation as well"*; DR-6 amended, P182): every `inv-tile` is a
  box of its own, a hairline edge, `--r-md`, lifted by `--shadow-tile` (one token, `light-dark()` so the dark theme's lift is
  seen), with an `--sp-8` gap between tiles; a deck card is lifted the same way. A strip in a flush panel keeps `--pad-x` round its
  tiles; a hero sheet holding a strip alone draws no box (the tiles are the boxes); a pressed filter tile is let down (no lift,
  edged in the accent). The `panel-w` thresholds for two, three and four across moved to 32.5rem and 43rem for the gap.
- **Add** (`add.js`, P136): one sheet for everything that comes in (paste, the clipboard on a tap, a file routed by what
  is in it, and every by-hand form; a photo is not read since 13 Oct 2026, and a photo picked under File says so). It saves nothing itself: each route ends in the review or form that exists.
- **A file brought to another screen's Import is taken where it belongs** (`addFileElsewhere`, add.js; owner, 9 Oct 2026: the day's
  production file, imported on Production → Equipment, read *Not a plant file* and stopped there). Every screen's Import (Equipment,
  Roster, Register, Pay, Stock, Production, Power, Settings, Knowledge, Bank) asks before it refuses: the file is named for what it
  is and the screen that imports it (*… is a production file (sep-production), not a plant register file (sep-plant). It is
  imported on Production → Entries.*), and **Import it there** takes it by Add → File's own route (`addFileGo`) and guard question
  (`addFileGuardOk`); Cancel imports nothing. Settings never asks to replace the book with a file that is not a backup. A file no
  screen imports is refused where it was brought, as before. Add → File takes a knowledge file too (`sep-kb`, the owner's, asked
  again as Knowledge's own Import asks). P196.
- **WhatsApp, opened from beside each paste box** (`waLinksHtml`, add.js; owner, 7 Oct 2026: *"directly open the web.whatsapp.com
  page or the installed app"*): Add, People → Attendance → Paste message and Today's inputs. WhatsApp Web answers `frame-ancestors
  https://*.whatsapp.com`, so no site can show it in a frame: the phone opens the installed app (Android by its package, Chrome
  going to the Play Store when it is missing; an iPhone by `whatsapp://`), a computer WhatsApp Web in one named window
  (`sepWhatsApp`, so a second tap returns to it) and the desktop app by `whatsapp://`. Offline the links hide and say why;
  the online and offline events switch them in place (`waSync`). P165.
- **Office → Pipeline** (`pipeline.js`, P137): awaiting invoice → created → printed → dispatched → delivered → owed to us,
  each a count, an amount and a tone by age, read off the function its own screen uses; a stage opens its list and its
  action goes through the screen that owns it. *Owed to us* is money: a role that does not see money has no such stage.
- **Floor → Overview** (`floor.js`, P138; Floor → Day until the tab map, TM4a, P188): heroes for the day (people, production,
  stock, power and the turnaround; each to a role that opens its screen, People carrying the verdict), then a card per line, the worst first, with
  the heads against the day's number, the EXTRA, what it is running, what it has plated and who plated it. A day is
  `?tab=pageFloor&d=…`. It and
  Home count the day's roster as People → Attendance → Day does (`attDayRoster`: the active hands and anyone marked that day who has left).
- **Search, keys and new windows** (`search.js`, P139): one index of records, screens and actions, built when first
  needed and kept until the book changes; numbers match whole, amounts to the paisa, dates by day. `Ctrl K` / the bar's
  search, `A` for Add, and Ctrl+click or a middle click on a door, a tab or a row opens it in a new window (Pipeline's
  stages and challans, Money's doors and Floor → Overview's cards included). The QA chain of 2 Oct 2026: an identifier typed
  ending in a digit matches whole (`00083` never finds `00834`); a challan or a P.O. is known by its own number
  (`srchDocNums`: `0901/26-27` is 901, never 26 or 27, and the 1 of `QX1` is no number); an invoice is found by its tail
  (`27/00834`); a series word counts only beside something else that matches (SEP alone finds nothing, *SEP 21* is invoice
  00021 as well as 21 Sep); a worker opens in Roster's pane on the desktop; *Add a bill* works out its month when opened.
