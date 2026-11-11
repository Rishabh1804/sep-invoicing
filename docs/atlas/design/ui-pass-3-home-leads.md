---
subject: "UI pass 3: Home leads"
domain: design
modules: [split/today.js, split/floor.js]
specs: [docs/UI_PASS_3.md]
tests: [P133, P134, P150, P182, P183, P195, P223, P224, P225, P235, P237, P239, P241]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### UI pass 3: Home leads (21 Oct 2026)
`docs/UI_PASS_3.md` §25 (owner, 21 Oct 2026, after U2R's stop: *"we have the location for our plant available in the database, yet it
asks to set the plant place. Tata Motors news is not updating … what does Needs you . 27 stand for? … Today is a holiday, yet the
masthead says shift ends at 5 … Let's remove the MTD, QTD, YTD, all filters … Home screen should not feel heavy, and should lead and
prioritise the user, control attention, makes information effortless, has a clear objective"*; then *"Ask the sources directly"* and
*"Lead with the first move, About 7 cards on the phone, Cards only as tall as needed, Red only for today"*; then *"move the layout option
and options dots into the masthead"*). P241; P134, P133, P150, P182, P195, P223, P224, P225, P235, P237, P239 rewritten to the same
facts. **The build stops again for the owner to look.**
- **The masthead leads with the first thing to do** (`homeMastLead`, today.js): money in danger (*Open Money*); else the red move worth
  most across the questions (`tdyFirstMoves`), its words a button opening the move's dialog (`inv-mast-lead`) and its own action the one
  tinted button (`data-home-lead="move"`); else the red count (*Open Needs you*); else the amber move worth most; else a fact of the day;
  else *Nothing needs you now*. A *to know* move never leads. Beside a lead that is not the count, *N things need you now* links to
  Needs you on the desktop. The facts are a line half down and the weather now; the pace is Month to date's. *Make today's report* is
  in More. **On the phone** the date and the clock share the first row, and Customise and More stand at the act row's end (ghost
  buttons, `uiToolbarMoreHtml({ghost})`), so the toolbar has no row of its own there (it has one on the desktop and while arranging).
- **Needs you's count is a badge** on its tab (`inv-viewtab-count`, `wsTabCountHtml`, `data-ws-count="today"`): the red rows, the
  Home door's own count. A spec reading the door's count scopes it (`.inv-navbar [data-ws-count]`), since the tab carries one too.
  It is the door's size, raised beside its word, and the tab gives back its right padding on the phone: drawn 20 px with a 6 px gap
  first, it took the 393 px row past the screen in CI's 0.5% wider text (P183), measured here with `letter-spacing: 0.005em`. A count
  that changes fits the row again (`wsUpdateCounts` → `wsRowFit`): a count the row cannot hold makes the group's word the cue.
- **Home reads this month** (`wdgPeriod('home')`, widgets.js): the period chips are gone; Stats keeps `_statsPeriod`, and changing it
  no longer redraws Home (`_homeDrawnPeriod` retired). More's *Make a report* opens this month's report (`data-period`).
- **A day the plant does not work** (`plantDayOff`, floor.js): a day marked shut (`flowCfg.holidays`, its reason in
  `flowCfg.shutWhy`), a paid holiday, or a Sunday, unless the floor recorded work on it. **Plant shut…** (Home's More, `plantShutOpen`,
  behind `grdGate('settings')`) marks a day or a run of days with why; Settings → Checks & alerts → Turnaround and terms lists them. On
  such a day the masthead says it in the shift's place (*Plant shut · Durga Puja*, no track), Needs you's inputs read *Not expected:
  plant shut*, The floor now is one quiet line with the last day plated, and a line half down is not news. `statsWorkingDayList`
  leaves the marked days out (the pace, the capacity, a day's use), as the turnaround did; a paid holiday still counts there. The floor
  now offers *Mark today shut* when nothing is recorded by 11 AM. Pay is untouched. (Tata's plant's calendar, `S.market.calendar`, is
  another thing: Tata Motors' Jamshedpur plant.)
- **The news and the weather straight from the sources** (feeds.js, `feedAskVia`): the feeds Worker first; where it cannot be reached (no
  answer, not its own, a 404 or 5xx) the app asks GDELT (`feedDirectNews`, the topics 6 s apart) and MET Norway (`feedDirectWeather`)
  itself, in the Worker's shape and read by the Worker's checks, and does not ask the Worker again for six hours (`sep_inv_feeds.direct`),
  unless Settings' **Check** reaches it (`feedCheck` ends the hold on that device).
  Each copy says how it came (`via`). **The weather's place**: the one typed, else the Office QR's, else the company's address placed on
  OpenStreetMap's Nominatim once an address (`feedGeoEnsure`: the parts with no figure, at most three asks 1.2 s apart, kept on the
  device in `sep_inv_feeds.geo`, never in the book; Settings shows it as the fields' placeholders). Under test only where a fixture says
  so (`window.__sepFeedsDirect`, `window.__sepGeoOn`). Tata's figures are still typed from the release (`mktTata`).
- **About seven cards on the phone** (`WDG_PRESETS`; an entry marked `desk` is the desktop's alone; `wdgPresetList(board, lay, key)`):
  Owner *Month to date, Are we making money?, Cash, Owed* (Smalls), *The floor now, What's coming, Is the plant running smoothly?*, and
  Tata on the desktop; the other three presets alike (UI_PASS_3 §25g). What left a board is said elsewhere: Do first is the masthead's
  lead, Needs you its count and the badge, the weather its fact; Month to date says where the month lands (*On pace for …*, its Small's
  last bar outlined, `chartMiniBars`'s `proj`, `inv-minibar-proj`); The floor now says the last day plated before today's first run,
  each line's hands against the day's number, and leads with a line half down (`wcFlrHalfDown`).
- **Cards as tall as needed on the phone**: under 36rem of board the rows are `auto`, each card capped at its size's height, two Smalls
  as tall as the taller, a bare chart in its size's room (`--wdg-viz-h-s`, `-m`, `-l`); while arranging, each size's whole box. P237
  measures each size's box while arranging and, on the board, each card within its cap with no gap under its last part.
- **Red only for today**: `trend` on `wdgDefine` (true, or a function of the figures) marks a card `data-trend`, never edged or tinted,
  its figure and lamp keeping their tone: the month against the last, a period's answer, a record of days (UI_PASS_3 §25i lists them).
  P235 holds a trend's card to its type's surface with no edge.
- **The words**: `lcLead` (state.js) lowers a joined sentence's first letter only for an ordinary word (*oM SHEET METALS*, *Made mon 19
  Oct* had been drawn); `clientShortName` names a client without its legal ending (*PAWAN AUTO P LTD* had lost only its LTD), in a
  card and a move (`advNameOf`); What's coming counts its rows in its sentence.
- **Measured**: Home on the phone, the long book, 4.71 → 2.38 screens; P195's budget for Home lowered from 5 to 2.5. On the owner's
  book (a scratch render, never in the repo) the phone went 4.69 → 2.29 screens and 14 → 7 cards, the desktop 2.85 → 1.8 and 14 → 8.
- **A data flow changed**: `flowCfg.shutWhy` in the book (backups, GitHub, the merge; the change log reads it as days and reasons,
  `chgFlowProj`); on the device only, the address placed and whether the Worker answered; new requests from the device to Nominatim,
  GDELT and MET Norway, each naming the site's origin, none carrying the book.
