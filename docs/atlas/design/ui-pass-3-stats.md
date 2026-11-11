---
subject: "UI pass 3: Stats as a dashboard (U3)"
domain: design
modules: [split/stats.js]
specs: [docs/UI_PASS_3.md]
tests: [P195, P229]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### UI pass 3: Stats as a dashboard (U3)
`docs/UI_PASS_3.md` §10, §26a (owner, 15 Oct 2026: *"The stats page doesn't look like a stats page at all, we have stored and displayed
our data on tables essentially"*; Home passed on 4 Nov 2026, *"Home screen test - pass"*, and U3 started). P229; the Stats specs
rewritten to the same facts where they now live (§21), never weakened.
- **Two views** (`STATS_TABS`, intel.js): **Dashboard** (`?tab=pageStats&v=board`, the default) and **Tables**
  (`v=tables/<client|part|month|cost>`). One verdict leads both (`statsVerdictHtml(pa)`, `#statsVerdict`): the period's price against
  its live cost (*₹0.62 a kilo over the live cost*), in the one judge's tone (`figToneAgainst` at 5%); its facts the invoices, the
  large accounts below the cost (By client's verdict until now) and the share measured; its four factors Revenue (net of notes, its
  change), Plated and billed (the share weighed, of two shifts), Realisation and Left after the full cost. Then one toolbar row
  (`[data-stats-toolbar]`): the period (`_statsPeriod`, Stats' own), Customise on the Dashboard, and More (*Make a report*, *Export this
  table (CSV)* (*Export the cost (CSV)* on Cost), *Export the tables (Excel)*, *Reset Stats*). On the Tables the switch stands under the row (`[data-stats-table]`, as
  Attendance's Day · Week · Month).
- **The Dashboard** is a board of the card family (`wdgBoardDraw(#statsBoard, 'stats')`; `WDG_BOARDS.stats`, `wdgBoardSeen`: a role
  that opens Stats), its own layout per person and layout (`stats` in `sep_inv_layout`), Customise as Home's (arranging ends when Stats is
  left, `statsLeave`), its foot *The tables behind these* and *Add a widget*. **Its widgets read Stats' period** (`wdgPeriod('stats')`
  returns `_statsPeriod`; Home's stays this month, and changing the period no longer redraws Home). **The owner's preset**
  (`WDG_PRESETS.owner.stats`): Price against cost (L), A kilo's cost, Who fills the plant, What each client pays a kilo (L), Turnaround,
  Days to pay, Owed and Labour a kilo as four Smalls, then Does one move the other and Plated each day (L) on the desktop; on the phone
  seven cards, Owed at Medium (an entry marked `phone` is the phone's alone). Each packs with no hole. The office's, for a role given
  Stats, in pairs; the supervisor and the floor have none.
- **The seven U3 widgets** (widgetcards.js, Ledgers and trends, each on Home's gallery too): `pricecost` (six months, realised against
  the live cost as two lines, the gap as `chartDiverging` at Large), `share` (each client's share of the tonnes against the revenue, a
  dumbbell), `labour` (labour a kilo against the model, withheld by the labour card's own rule; wages), `months` (each month at its own
  cost), `trend` (twelve months; its Choose ₹ · Tonnes · Incoming), `topitems` (its Choose ₹ · Tonnes · ₹/kg), `costcheck` (recorded
  against paid). `clientprice`, `kilo`, `figures` and `why` open the Tables or the Dashboard.
- **The Tables** (stats.js `statsTableModel`: a model a table, which draws it and fills its export): **By client** (every client of the
  period: revenue and its share, tonnes and their share, ₹/kg, against the variable and the full cost, ₹ on the period, the next
  challan by its rhythm; owed and days to pay under the name; the worst large account settled under the table, `#statsWorst`); **By
  part** (every part, one client's a row, `buildTopItems(…, Infinity)`); **By month** (six months, `statsMonthsData`, the widgets'
  rows too); **Cost** (the labour card and the live cost as Stats → Cost drew them). A head tapped sorts (`invStatsSort`, `aria-sort`,
  ▲ ▼), again the other way; its default is the table's own order (By client worst priced first). On the phone a table shows its first eight rows, the rest one tap away (`STATS_TBL_PHONE_ROWS`; a month's parts grow with its days, and By part read 1.61 screens on the 9th). The CSV is the table on show, the
  workbook every table (`xlsxBuild`), each in the order on screen.
- **Where an old place lands** (`NAV_REDIRECTS`, `STATS_TAB_OLD`): `clients` → Tables by client, `cost` → Tables' Cost, `trends` →
  the Dashboard, for an address, the device's remembered tab, a saved task's `{kind: 'stats', tab}` (`statsOpen`) and its label
  (*Open Trends* reads *Open Stats*). The live cost's move opens the Tables' Cost on its part. The trend's and Top parts' controls and the
  realisation, concentration, revenue-by-client and next-challan cards went: each is a widget or a table's column (§10's table).
- **Measured** (phone screens, the long book): By client 2.18, Cost 2.82, Trends 1.89 → the Dashboard 2.94, the Tables by client
  1.57, by part 1.35, by month 1.29, Cost 2.90; P195's budgets set at each measure, the next half screen up (3, 2, 1.5, 1.5, 3), none
  over the three tabs' (3.5, 3, 2). The walk (`walkMap`) steps through the Tables' switch as it does Attendance's. The guide *Reading
  Stats* is version 5.
- **The breakdown under By client** (the worst large account settled on the live cost) is a coded block (`inv-coded`,
  `[data-worst-tiles]`): its judged tiles wells of their tones, *Pays its share at* plain (owner, 4 Nov 2026, on the tiles drawn grey).
- **The desktop pass** (owner, 5 Nov 2026: *"there are issues in the desktop version … text is wrapping, color coded chips are
  missing"*): each ₹/kg on the Tables (By client, By part, By month) carries its chip under the figure, *Below cost*, *Just under cost*
  or *Covers cost*, in the one judge's tone (`statsPriceState`, `statsPriceChip`, `[data-price-chip]`; the figure itself `[data-fig]`;
  the exports unchanged); the verdict's capacity share is a line of its own in its capacity tone, and its four factors go two by two
  where the card is under 60rem (1024); a note in a hero's sheet stands in the card's padding (`.inv-hero-sheet > .inv-note`), where
  the verdict's loss line had sat on its edge; *Does one move the other?*'s pickers are as wide as their names on the desktop.
- **A data flow**: none. The book does not change; a board's layout is the device's (`sep_inv_layout`), at S1 the person's `prefs`.
