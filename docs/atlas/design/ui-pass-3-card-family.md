---
subject: "UI pass 3: the card family (U2R)"
domain: design
modules: []
specs: [docs/UI_PASS_3.md]
tests: [P195, P235, P236, P237, P238, P239, P240]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### UI pass 3: the card family (U2R)
`docs/UI_PASS_3.md` §24 (owner, 17 Oct 2026, after U2's stop: *"different types of card layouts but organised, so maybe a financial
card layout looks and feels different than an industrial one. Same for anything that we are putting under one label, like the action
rows"*; the canvas *Home card types*, answered *"Write the spec"*, taken as approved with its four calls as proposed). Built 20 Oct
2026; design §6.33–§6.36. P235 (the skeleton), P236 (the action rows), P237 (heights, packing, the fit), P238 (money and figures),
P239 (the masthead); the specs that read U2's cards rewritten to the same fact where it now lives (§21), never weakened. **The build
stops here for the owner to look**, with §1a's calls 13–21.
- **One skeleton** for every card on a board (`wdgCardHtml`), in one order: head (Open, the whole head; the Choose at its right where
  offered, under it on the phone), figure, verdict, detail, the type's parts (More at a list's end), Act, Source. A card is no longer a
  hero: `<section class="inv-widget" data-w data-size data-type data-tone data-state>`.
- **Seven types** (`type`, required by `wdgDefine`, with a `short` title wherever a Small is allowed), each a surface and the parts
  only it draws, through the builders in widgets.js (no widget writes a row's markup of its own): Ledger (money; warm `--ty-ledger`;
  `wdgLedgerHtml`: whole rupees on dotted leaders, the total ruled only where the lines add up, a cut list's rest line with their sum),
  Docket (documents in motion; `wdgDocketRowHtml`, the state as steps, `wdgDocketStagesHtml`), Plant (lines and machines; cool
  `--ty-plant`; `wdgPlantRowHtml`, nameplates, readings, gauges), Crew (people; `wdgSeatsHtml`, `wdgCrewRowHtml`), Briefing (the
  questions; the answer as a sentence, `wdgMovesHtml`, `wdgWhenRowHtml`), Outside (the world outside; `wdgWireHtml`; never edged, no
  Act), Tools (starting things; `wdgTrayHtml`).
- **Five action rows**: Open (the head); Choose (`choose: {def, opts, at}`: a segmented control `inv-seg-choose`, the pick kept with the
  layout, `opts.<id>.choose`); More (the list's last row, *5 more challans*, from the list's `data-wdg-list data-noun`); Act (`actRow`:
  one tinted `inv-btn-tint`, one text button at most); Source (`source`: the last line, its only links Refresh and a feed's credit). A
  move's tap opens its dialog (`advMoveOpen`), where *Add to my list* is.
- **The four calls, as built**: salience follows severity (quiet; amber a 3 px inset top edge, `--tone-edge`; red the edge and
  `--card-danger`; no wash); figures in Geist with tabular figures app-wide (`--ff-num`), Geist Mono and `slashed-zero` only for
  identifiers (`inv-id`, a nameplate, a dateline), DR-4 amended; money on a board short (`inrCard`, `inrFigHtml`; a sentence's amounts
  `wdgShortMoney` / `wdgShortMoneyIn`, the exact text its `title`; a Ledger's lines whole rupees; a rate keeps its paise; every other
  screen keeps the paise); a card exactly its size's height (`--wdg-row` 172 px, 168 on the phone; `--wdg-gap`), the board packed
  dense, and while arranging packing off with each hole a slot (`wdgPlace`, `inv-wgrid-slot`, **Add here**).
- **What the fit has to know** (`wdgFit`; each a bug met on the way): what a card can do without goes first, all together (a tile's
  words under its figure but never its change, a chart's key); columns side by side are fitted each on its own, and a column left with
  only its caption goes; what went first comes back, all together, where a list's going freed the room it needs (Owed's age key on a
  phone's Medium), so no card keeps a gap where its rows were; the room a card does not fill is one space, above its foot (the
  canvas): what it says and what it shows run down from the head, a Small's picture stands at the body's foot (`data-wdg-push`) and a
  bare chart takes the room left; a row's own action never wraps; a list with nothing to chart says so (`noViz`) and draws its
  picture instead. A sentence shortened in drawn HTML is replaced in its text node, never wrapped in a span (inside a flex `inv-dot`
  a span split the sentence into columns).
- **A widget's own action is named `invWdg…`**: events.js hands the framework no other, and Quick actions' *Continue* on a register
  page kept on the device, named otherwise, did nothing. **`arrive: true`** draws a widget again whenever its board is shown again
  (`wdgArriveRedraw`), for one that reads what is not the book: *Started here and not saved* reads Create's form and the pages kept on
  the device, which no save marks, and an invoice thrown away on Create had stayed listed. P240.
- **Home is drawn for whoever is in** (`homeDrawnKey`, tabs.js; older than U2R, found by P240): Home is kept between visits, and a
  board drawn for one person was shown to the next to sign in: the clerk's masthead and board to the owner, and, where the owner left
  open a screen a supervisor may not open (the refusal lands on Home), the owner's board, money and all, to the supervisor.
- **A bare chart** (`opts.bare`) is drawn into the room the card leaves, after the fit, at the room's own pixels (`viz(d, size, {w,
  h})`), so every label renders at 11 px or more; a Small's picture is `chartMiniBars`, a meter, the seats or the tray.
- **Corners** 14 / 10 / 8 / 7 px (`--r-card`, `--r-tile` for every well, `--r-ctl`, `--r-seg`), the phone's bar `--r-bar` 22. The day
  card is the flat **masthead** (`homeMastHtml`, design §6.36): never folded, 148 px on the desktop, the shift said before, during and
  after it. Four **presets** (Owner, Office, Supervisor, Floor), each packing with no hole on both layouts, packing on or off; the
  phone's Owner held all fourteen in the canvas's order, Home 4.67 phone screens on the long book, over I10's four: P195's budget
  for Home was 5, put to the owner (§1a-14; the first draft left Do first, Turnaround and Days to pay off the phone, 3.92). **The
  owner answered on 21 Oct 2026: about seven cards on the phone** (*Home leads* below): Home is 2.38 screens, its budget 2.5.
- **Matched to the agreed canvas** (owner, 20 Oct 2026, on the canvas *Home card types*: *"This was the agreed upon artifact"*;
  UI pass 3 §24o): Home built to it card by card on both layouts and shot beside it. The frame (the room above a card's foot, an icon
  to every card, the figure in its tone, a gauge with its key, the pips, the hour bars, the board's foot), the fourteen Owner cards as its desktop
  and phone draw them, and every other widget on its type's board. Where the build departs from it, §24o says why: a feed's credit
  a link (§1a-17), a rate with its paise (§1a-18), *Started here and not saved* holding what the app keeps (Create's invoice, the
  register pages kept on the device; §1a-19), a Ledger total ruled only where its lines add up, a challan's wait in calendar days,
  the cash question's *due in four weeks* (the forecast's window), a solid *gate 90%* mark, and **the weather's storms counted by the
  day** (§1a-21): the book keeps each day's forecast (`S.market.weather`), not its hours, so the card says *3 of the last 10 cuts fell
  on a thunder day* (`feedWeatherCutDays`: the cut days with rain in 30 days, the last ten cuts and those on a thunder day), never
  that a storm caused one; no wind or humidity, which the Worker does not read.
- **Geist under test**: the fonts and their OFL licence in `tests/fixtures/fonts/`, served by the test server in place of Google's
  stylesheet (`tests/e2e/server.mjs` names `fonts.css` in every page it serves, so a second window draws in Geist too, and no request
  is intercepted), so heights and titles are measured in the real face; `geistReady(page)` (p235-family.fixture.ts) waits for both
  faces before a measure.
- **The book does not change**; a widget's Choose is kept with the layout (`opts`), `prefs` on the hub at S1.
