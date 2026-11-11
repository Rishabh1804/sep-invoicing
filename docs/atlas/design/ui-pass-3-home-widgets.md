---
subject: "UI pass 3: Home and its widgets (U2)"
domain: design
modules: [split/feeds.js, split/widgetcards.js, split/widgets.js, server/feeds]
specs: [docs/SERVER.md, docs/UI_PASS_3.md]
tests: [P76, P197, P223, P224, P225]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### UI pass 3: Home and its widgets (U2)
`docs/UI_PASS_3.md` §7–§9 (owner, 15–16 Oct 2026: *"We need a Home page and dashboard for it as well, a clean, live and informative
dashboard. It should show the time, some predictions, some news"*; *"widgets should be flexible so different layouts are possible
without breaking the UI"*; *"Yes to Home, all of 1–11, news Worker now, no Hindi"*). P223, P224, P225; the specs that opened Pulse
rewritten to where each fact now lives (§21), never weakened. **The build stops here for the owner to look** (§1a-1).
- **The door is Home** (the workspace's id stays `today`): its row *Home · Needs you*, then the Insights (Stats, Reports, the
  Planner). `?tab=pageHome&v=home` is the default; an old `v=pulse` (an address, a saved step, `sep_inv_ws_last`) lands on Home
  (`NAV_REDIRECTS`), and `invGoPulse` is kept as an alias of `invGoHome`, which the rail's mark and the brand open. Search finds Home
  (`G H`) and Needs you apart; signing in lands on Home (Mine for a person with a face, as before).
- **The masthead leads** (`homeMastHtml`, today.js, since U2R; U2 drew a day card, a verdict card shut on the phone): *Good morning,
  <name> · Friday, 16 October*, one lead in its tone, the first thing to do with its own button (since 21 Oct 2026, `homeMastLead`:
  *Home leads* below; it had been the first of cash below zero, red tasks, a line half down and the month's pace, with **Open Needs
  you** and *Make today's report* under it), a line half down and the weather now as facts, the clock and the general shift
  (`[data-home-clock]`, `[data-home-shift]`), or the day the plant does not work in the shift's place. **The clock ticks
  on the minute** (`homeClockStart` / `homeClockStop`), touching only its texts and the shift's track, and stops when Home is left or
  hidden; the masthead is drawn again when the day turns (`_homeDrawnDay`). Flat and never folded (*The card family* below).
- **The toolbar** (`[data-home-toolbar]`): **Customise** and More (*Make today's report*, *Make a report*, *Plant shut…*, *Open
  Stats*, *Reset Home*), its own row under the masthead on the desktop, flat at the end of the masthead's act row on the phone. The
  period chips (`MTD · QTD · YTD · All`, Stats' `_statsPeriod`) came off on 21 Oct 2026: Home reads this month (`wdgPeriod`). Then
  **the board** (`#homeBoard`), then its foot, *Add a widget · N to choose from*. Needs you is unchanged in what it holds (`#homeNeeds`).
- **The framework** (`widgets.js`, design §6.33) holds no widget's arithmetic: `wdgDefine({id, title, short, q, section, type, sizes,
  needs, go, live, feed, card, choose, data(ctx), draw(d, size, ctx), viz, more, actRow, source, after, act, change})` (U2R's: `foot`
  retired for `actRow` and `source`), the card (one skeleton of its type, *The card family* below), the states through `uiBlankHtml` (`empty`, `early`, `notset`, `offline`, `loading`, `error`), the board, arranging, the gallery, the
  presets and the layout store. **A button inside a card names its widget with `data-wid`**; `data-w` is the card's alone. An action
  the framework does not know goes to the widget's `act(action, btn, card)`, a change in the card (or in a dialog carrying
  `data-wdg-for`) to its `change(el, card, board)`, and `feed: true` draws it again when a news or weather copy lands. A widget's
  own options are kept with the layout (`wdgOpts`, `wdgOptsPut`: `corr`'s pair).
  **A widget never throws its board down**: one that throws draws its error state and reports once a session. `wdgFromHero(o)` takes
  a hero's options, so a figure Pulse drew is drawn from the same function (`finHomeOpts`, `whyHeroOpts`, `statsOverviewOpts`,
  `todoHomeOpts`; `homeMtdOpts`, `ghCardOpts` and `paceCardOpts` are read directly; U2R retired the rest with the cards they drew),
  and `wdgMemo(key, fn)` keeps a widget's figures until the book, the period or the person changes.
- **Three sizes, each a fixed height** (since U2R; U2 capped them at 10, 26 and 40rem and let a card be as tall as what it held): the
  size decides what is drawn, and what will not fit lets go (`wdgFit`): first the parts a widget can do without, all together
  (`WDG_FIT_OPT`: a tile's line of the months before and the words under its figure, a part marked `data-wdg-opt`, a chart's key), so a
  crore month never cuts Month to date; then a list's last rows, its More (*N more challans*) or a Ledger's rest line saying how many.
  The board's columns come from its own width (12 from 60rem, 6 from 36rem, 2 under it): a Small spans 3 (one of two on the phone), a
  Medium 6, a Large the row; rows of `--wdg-row`, packed dense (*The card family* below).
- **Who sees a widget** is its `needs` (`page` by `grdSees`, `money`, `wages`, `perm`, `owner`, `when`; `wdgSees`): a widget a role
  may not see is in no gallery and on no board, and a layout naming one keeps it and skips it at draw. A door a role cannot follow
  is drawn as text.
- **Arranging is a layer** (`navLayerOpen`; Back, Escape and Done leave it, and a swipe does nothing): each card shows its handle,
  its place (*3 of 11*), its sizes and Remove (with *Undo* in the toast); the toolbar *Add a widget*, *Reset* (asked through
  `uiConfirm`) and **Done**. A mouse drags at once, a finger after a 250 ms hold within 8 px (a scroll is never taken for a drag);
  Escape or a cancelled pointer puts it back. The handle's keys move it (← ↑ → ↓, Home, End), said in an `aria-live` line.
  Leaving Home ends it (`homeLeave`), and Home is drawn plain when next shown: a Home drawn clean before had come back with its
  handles and a Done that did nothing (P223).
- **The gallery** (`wdgGalleryOpen`, a dialog): the sections as chips (All, Money, Office, Floor, People, Market, Analysis,
  Questions; one with nothing the role may see left out), each widget a card with its live preview at its first size (drawn as it
  comes into view, `IntersectionObserver`), its title, question and sizes, and **Add to Home** or *On Home* with Remove. Added, it
  goes to the end of the layout on screen and of the other layout at its first size (or, from a slot's *Add here*, at the slot). **Every
  preview is one height, drawn or not** (one row, `--wdg-row`, since U2R): a preview drawn as it came into view grew from 48 to 160 px, and the cards under it jumped while scrolling. A
  chip, a board, an Add or a Remove swaps the gallery's parts inside the dialog (`wdgGalleryRedraw`), never the dialog: a dialog
  replaced replays its slide-in, so every tap slid the sheet up again. The previews drawn stay drawn, the list stays where it was,
  and the focus goes to the card's other button (P223).
- **Presets by role** (`WDG_PRESETS`): Owner (the owner, or the guard off), Office, Supervisor (since U2R) and Floor, each packing with
  no hole (§24i); a widget the role cannot see is left out when the preset is drawn. Any change makes the layout the person's own; **Reset** goes back.
- **Where a layout is kept** (`sep_inv_layout`, localStorage: `{v: 1, people: {<ID or '-'>: {home: {preset, desk, phone, opts}}}}`):
  one per person and per layout (the desktop's and the phone's sizes differ), never in the book, a backup, a push, a merge or the
  change log; at S1 it goes to the hub as the person's `prefs` (`docs/SERVER.md`). A device's Pulse layout is moved once
  (`wdgFromPulse`: its role's preset, then every widget Pulse showed that the preset lacks, by the new ids: `todo` → `needs`,
  `attendance` → `atttoday`, `production` → `prodday`, `power` → `powercuts`, `stock` → `stockdays`).
- **The widgets** (`widgetcards.js`, `WIDGET_DEFS`; every one §7d marks U2), each reading the function its screen draws with, never
  a second arithmetic:
  - **Money**: `money`; `cash` (the balance, the forecast's low point, the 60 days); `owed` (by age, the largest debtors); `dtp` (days
    to pay against each client's terms); `gst` (due against paid by month).
  - **Office**: `mtd`, `pace`, `unbilled`, `recent`, `quick`, `sync`; `turn` (the turnaround against its target); `pipe` (the stages,
    the worst late one); `quote` (quotations and prospects against the spare).
  - **Floor**: `powercuts`, `zinc`; `floornow` (on site, the lines); `prodday` (the last day's plating, the day card at Large); `heat`
    (plated each day, the light days that were cut days named); `eff` (each line's efficiency and what lost most); `risk` (the hours
    the plant's cuts start, the forecast's thunder hours beside them); `stockdays` (what runs out first, the day to order by);
    `zincpaid` (the market against what each bill paid).
  - **People**: `atttoday`; `attweek` (attendance by week); `ot` (overtime and the EXTRA by area).
  - **Market**: `tata` (the month's three figures with their change, the plant's week, 13 months against the year before, the models
    and four headlines); `weather` (now, the next 12 hours, then the cut days that had rain once 30 days are kept).
  - **Analysis**: `corr` (*Does one move the other?*: two of `daily`'s figures paired at the coarser grain over 182 days, early under
    10 points, the words by |r| and the slope in the figure's own step, always *a pattern, not proof*; the pair kept per person);
    `clientprice` (each client's ₹ a kilo against the full cost, worst first); `kilo` (the live cost's parts as one bar, the share
    measured).
  - **The questions** (`q-smooth`, `q-money`, `q-clients`, `q-plant`, `q-cash`, `q-changed`: Small the answer's vital, Medium with its
    story (its sentence and rows, without the tiles and charts, `wcStoryBrief`), Large with *What you can do*, every move a card and
    the fit letting go of the last, the story first where both do not fit (`data-wdg-opt`), a list of moves whose cards all went
    taking its head; the head opens the question's dialog: the whole story and every move), `dofirst`, `why`, `figures` (Pulse's *In one line*),
    `needs`, and `coming` (dated predictions soonest first: cash under zero, a stock line out before its supplier can deliver, a
    client's next challan, the month's landing, a turnaround about to pass, thunder in the hours cuts start).

  The hooks specs read are kept inside them (`#homeFin`, `#homeAtt`, `#homeAttOnSite`, `#homeTiles`, the `#mtd*` ids,
  `#recentInvoices`, `[data-card="sync"]`, `[data-zinc-age]`, `[data-tdy-questions]`, `#statsWhy`, `#statsOverview`, `#statsPace`).
- **The news and the weather** (`feeds.js`, P225; UI_PASS_3 §9, §9f as built). A Worker of the owner's own (`server/feeds/`, deployed
  by the owner, never by the build) answers `/news` (GDELT: Tata Motors' sales, Jamshedpur, its exports and the models followed) and
  `/weather` (MET Norway, at the plant's place to two decimals). The app asks when Home is drawn and on the minute while it shows,
  only for a copy over 30 minutes old, never offline, hidden, under test (unless a spec sets `window.__sepFeedsOn`) or twice within
  the minute (`tried`, kept on the device). The copy is the device's (`sep_inv_feeds`), never the book's; a landing is a `sep-feeds`
  event, which the masthead and every `feed: true` widget redraw on. **Tata's figures and the plant's calendar are the book's**
  (`S.market`: the months typed in the Tata dialog, the days the plant is shut, the models followed, a weather day a day; in the
  change log and the merge, the weather quiet in both); a headline's figure or day is offered, never applied. To-do `mktTata` asks
  for last month's figures from the 2nd. Settings → Connections → News and weather, and the guide *Setting up: the news and weather*
  (`app-feeds`). **Where the Worker cannot be reached, the app asks GDELT and MET Norway itself**, and the weather's place falls back
  to the company's address placed on the map (since 21 Oct 2026, *Home leads* below).
- **The sweep** (P224): every widget at every size it allows, on the long, empty and crore books, light and dark, phone and desktop
  (1280 and 1024 px), then each preset and three seeded random arrangements, failing on anything past a widget's box, a widget past
  its cap, a block over 120 characters, an error drawn and everything P76's sweep and P197's looks fail on; and each role, the guard
  on, shown only what it may see.
- Fixtures: `openHome`, `openNeeds`, `openPulse` (puts Pulse's widgets on the board at Large for the person signed in, then draws
  Home), `openWidget(page, id)`, `withWidgets(page, list)`; a spec reading a widget puts it on the board first.
