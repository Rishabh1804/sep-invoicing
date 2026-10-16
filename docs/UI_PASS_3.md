# UI pass 3: a look that leads, Home and its widgets (spec, 16 Oct 2026)

The owner, 15 Oct 2026, after a screenshot of Stock: *"On the stock screen, when I click on Spend and prices, Line items is still
the most space taking, which makes the dashboard squished to the right … The Enter by hand screen is primitive in design, and doesn't
engage or leads the user, increases the learning curve. The report generated for power cut is extremely text heavy for anyone to be
interested in solving it. Text heavy should be an optional copy and our copy, so that we know the entire context. Roster section of
the People tab is also primitive, despite having plenty of data to show info in a better way. Every sub-tab of our people tab has the
same issue it does not lead the user by design. We could really use another UI design pass. The stats page doesn't look like a stats
page at all, we have stored and displayed our data on tables essentially."*

Then, with references from Pinterest: *"Order is fine, every Enter by hand, write the spec after we have confirmed design. We want a
comprehensive spec, code and implementation to be precise and make sure that it adheres to our transition to SQL and cloud. When you
say it should look like a dashboard, I want it to be modern looking dashboard. We'll need an upgraded icon set. We need a Home page
and dashboard for it as well, a clean, live and informative dashboard. It should show the time, some predictions, some news."* And:
*"live clock, weather, TATA Motors news - as everything boils down to their production and demand."*

The design was drawn on a canvas (the owner's artifact *SEP Invoicing UI pass 3*: Home on the desktop and the phone, the card
treatment and colour codes, Stats, *Add a widget*, the icon set, sign-in on the phone, in dark and on the desktop) and reviewed twice.
The owner's review, 16 Oct 2026: *"1. realisation against cost on a dial - needs work / Icons missing, Tata Motors, Jamshedpur: monthly
CV sales and the latest headlines + export sales as well … Prima division of Trucks, along with newer and earlier models / 3. Between B
and C, leaning towards B, also remember we have colour codes for data to be represented / 4. What a Kilo costs has lots of wasted
space? Also, make it so that we have even more data visualisations available and we can select it as widgets, data like turnaround
time, payment time, correlation between two data points, we should analyse and present it. / 5. Give it another go."* Then the
design was confirmed: *"B with wells, 4-digit PIN, widgets should be flexible so different layouts are possible without breaking the
UI."* And on what else the pass should cover: *"Yes to Home, all of 1–11, news Worker now, no Hindi."*

**This file is the spec builders follow.** One PR, steps U1–U9, one commit (or more) per step, in order, **with a stop after U2 for
the owner to look** (§1a-1); then the QA chain on the owner's word. Read §1–§6 and §16–§18 before any step, then the step's own
section. It sits on `docs/TAB_MAP.md` (one look: four kinds of screen, the verdict card, one toolbar row) and changes none of its
rules except where §3f says so. It is written to `docs/SERVER.md`: everything it adds to the book is a record the hub can hold, every
widget reads through views shaped like the hub's typed tables (§6), and the one place the server plan had to change is said (§16).

## 0. Status

| Step | What | State |
|---|---|---|
| U1 | Foundations: the look's tokens (lift, wells, radii, dark elevation), the default palette, icons v3, the chart builders and the table behind every chart, the blank states, the data layer (§3–§6) | Not built |
| U2 | Home and its widgets: the door renamed, the day card with its clock and weather, Pulse folded in, the widget grid, sizes, arranging, the gallery, presets by role; the feeds Worker and its client; Tata's figures and the plant's calendar (§7–§9) | Not built |
| ⏸ | **Stop: the owner looks** at Home and the gallery on the phone and the desktop, in both themes (§1a-1) | |
| U3 | Stats as a dashboard: its own board of widgets and the tables behind them (§10) | Not built |
| U4 | Stock's Spend and prices takes the room; every Enter by hand a guided flow; Mine in the new look; two stock lines merged into one (§11) | Not built |
| U5 | People leads: each view opens on what to do next and a picture of it; the Roster as cards (§12) | Not built |
| U6 | The power case and the reports lead with a one-page picture; the full text an optional copy (§13) | Not built |
| U7 | Across the app: lists, dialogs, sheets, toasts and search in the new look; one set of blank states; dark checked everywhere; first-visit pointers (§14) | Not built |
| U8 | Sign-in and the 4-digit PIN; the app's icon, splash and favicon from the new mark (§15) | Not built |
| U9 | Docs, the full suite, every screen measured, the draft PR made ready; then the QA chain on the owner's word | Not built |

## 1. The rulings

All the owner's, 15–16 Oct 2026.

1. **The look is B with wells**: cards that lift off the page (B, *soft lift*), and what is pressed or filled sits in a shallow well
   (C's pressed-in look, kept to fields, switches, a meter's track and the tiles inside a card). Text keeps full contrast everywhere:
   C's grey text on grey and its vanishing edges are not taken.
2. **The colour codes stay and are kept apart**: a status tone says what a figure means (Good, Watch, Act, Know, Plain), always with
   its word and its icon; six series colours say *which thing* a line or bar is, in one fixed order; the accent is for touch (buttons,
   links, what is selected) and never marks good or bad.
3. **A 4-digit PIN**: a keypad on the phone, typed on the desktop.
4. **Widgets are flexible**: a person arranges their own Home in different layouts (sizes, order, which widgets) and no layout breaks
   the screen.
5. **Home**: Today's door becomes Home; its first view is the dashboard; Pulse goes into it (its questions become widgets); Needs you
   stays.
6. **"All of 1–11"**, from the list the owner was shown (10, Hindi, was answered no):
   1. the reports lead with a one-page picture, the full text an optional appendix, as the power case;
   2. Mine in the new look, its forms guided as every Enter by hand;
   3. the lists (Invoices, Challans, Clients, Parts, the bank statement) in the new look, as dense as now;
   4. dialogs, sheets, toasts and search restyled;
   5. one set of empty, loading, offline and *not enough yet* states;
   6. the dark theme done properly: lift from a lighter surface and a fine edge, never a shadow alone;
   7. a table behind every chart;
   8. the app's icon, splash and favicon from the new mark;
   9. first-visit pointers, each linked to its guide;
   11. the two stock lines that are one (*Nitric Acd* and *Nitric Acid*) made one.
7. **The news Worker now**, ahead of the server: a small Cloudflare Worker on the owner's account that fetches the news and the
   weather for the app (§9).
8. **No Hindi** in this pass.
9. **The asks of 15 Oct** (the opening quotation): Stock's Spend and prices takes the room; every Enter by hand leads; the power case
   is a picture first and the full text an optional copy, *"our copy"*; People's views lead by design, the Roster as cards; Stats a
   modern dashboard; an upgraded icon set; a Home page with a live clock, the weather, predictions and Tata Motors' news (domestic and
   export CV sales, the Prima trucks and the models before and after them, the plant's calendar); a sign-in page.

**Out of this pass**: paper. The invoice, the test certificate (its format is Tata Motors QA's, approved, *"No alterations are
permissible"*), the credit note, the statement of account, the pay slip, the attendance and stock sheets and the ID cards print
exactly as they do. The server's own steps (S0–S5) keep their track; only the feeds Worker is built here.

### 1a. Calls this spec makes (for the owner to accept or change at the stop)

1. **The stop is after U2**, as for the tab map: the owner looks at Home and the gallery before Stats and the rest are built on them.
2. **The default palette becomes Zinc & brass**, the one every board was drawn in. A device that picked Teal or Terracotta keeps it;
   both are drawn to the same structure and checked the same way (§3a).
3. **The workspace keeps its id `today`** (its address, the tests' maps and `sep_inv_ws_last` read it); only what a person reads
   changes: the door says *Home* with the house icon, `PAGE_TITLES.pageHome` is *Home*.
4. **Home's first view is the dashboard** (`v=home`, the default) and signing in lands there (Mine still for a person with a face).
   Needs you keeps its address (`v=needs`), which the manifest's shortcut and the Windows widget's launch use.
5. **The day card is Home's verdict card** (§8b): the greeting, the clock, the date, the weather now and one sentence of at most 60
   characters, so Home is an overview by TAB_MAP's §3e like every other.
6. **The clock is written as the app writes times**: *9:42* and *AM*, not *09:42*.
7. **News comes from the GDELT Project, not Google News** (§9a): Google's news feeds are for personal, non-commercial use, the reason
   Open-Meteo was turned down for the weather; GDELT's data is free for commercial use with a citation and a link.
8. **Tata's monthly figures are typed by the owner from Tata's release** (two minutes once a month), offered from a headline that
   carries them, never read off a page by the Worker: a press release's layout changes without notice and a wrong figure read
   silently is worse than one typed (§9c).
9. **A layout is kept on the device, one per person signed in on it** (the office PC is shared), and becomes a record of the person
   on the server at S1 (§7h).
10. **Stats becomes a board of widgets like Home**, with its tables in a second view (§10). Its three tabs' cards each become a widget
    or a table; nothing is dropped.
11. **Enter by hand leads without hiding**: every field stays on the form; the form is cut into numbered steps that tick as they are
    filled, the next one marked, and a live preview says what Save will record (§11a). Nothing typed is ever behind a step not yet
    reached.
12. **The 4-digit PIN changes one line of the server plan**: the key that seals the sensitive records is never wrapped by a PIN
    alone, since ten thousand PINs can be tried against a copy in seconds; it travels wrapped by the recovery code (§15c, §16).

## 2. What changes, screen by screen

| Screen | Step | What happens |
|---|---|---|
| The shell (bars, rail, top bar, tab rows) | U1, U2 | the look; icons v3; the door named Home |
| Home (was Today: Needs you, Pulse) | U2 | the dashboard view (`home`), the day card, the widget grid; Pulse folded in; Needs you in the look |
| Stats (By client, Cost, Trends) | U3 | a board of widgets (`board`) and the tables (`tables`) |
| Reports | U6 | the picture page first, the report its appendix |
| Planner | U7 | the look only |
| Pipeline, Challans, Invoices, Clients, Parts, Performance, Sales | U7 | the look; the lists as dense as now |
| Create, the challan form | U4 | guided flow (§11a) |
| Floor's Overview | U7 | the look; its heroes as cards |
| People: Attendance (Day, Week, Month), Pay, Areas, Roster | U5 | each leads with its next step and a picture; the Roster as cards |
| Production: Lines, In plant, Entries, Equipment | U4, U7 | Enter by hand guided (U4); the look (U7) |
| Stock | U4 | Spend and prices takes the room; Enter by hand guided; the line merge |
| Power: Cuts, Causes, Load & bills, Case | U4, U6 | a cut by hand guided (U4); the Case a picture first (U6) |
| Money: Overview, Receivables, Payments, Bank, GST | U7 | the look; the bank statement as dense as now |
| Mine | U4 | the look; its forms guided |
| History, Knowledge | U7 | the look |
| Settings | U2, U7 | Connections → News and weather (U2); the look (U7) |
| Sign-in (the lock) | U8 | the new screen, the keypad, the 4-digit PIN |
| Every dialog, sheet, toast, the search | U7 | the look |

## 3. The look (U1)

The canvas's board *Card treatment and colour codes* is the reference: *"Cards float above the page (B). Things you press or fill
sit in shallow wells (C). Text keeps full contrast everywhere."* Every value below is a token in `split/styles.css`'s token block
(HR-6); no rule writes a colour, a radius or a shadow of its own.

### 3a. Surfaces, lift and wells

**Four surfaces, from the back.** The page; a card on it; a well in the card; a layer over everything (a dialog, a sheet, the
search). Each palette (`:root[data-palette=…]`, styles.css:13–36) defines the four as `--c-*` primitives; components read only the
semantic names.

| Token (new or changed) | Zinc & brass, light | Zinc & brass, dark | What wears it |
|---|---|---|---|
| `--c-bg` (changed) | `#e1e6eb` (OKLab L 0.923) | `#0e1114` | the page |
| `--c-surface` | `#eff3f6` (L 0.962) | `#15191d` | a card: panel, hero, widget, the sign-in card |
| `--c-surface-2` | `#dfe3e9` | `#1c2126` | a raised card in dark (§3c); a neutral icon chip |
| `--c-surface-3` | `#d5dbe1` | `#242a30` | a layer in dark: a dialog, a sheet, the search, a keypad key |
| `--well` (new, built as a veil) | `#e3e8ec` over the card (L 0.929) | `#101317` over the card | a well: a field, a search box, a segmented control's track, a tick box, a switch's track, a meter's track, a tile inside a card, a PIN box |
| `--c-edge` (new) | `rgb(20 25 30 / 0.06)` | `rgb(237 240 243 / 0.08)` | a card's fine edge (§3c) |

- **As built (U1), the well is a veil over what it sits in**, `light-dark(rgb(20 25 30 / 0.05), rgb(0 0 0 / 0.22))`, not a colour
  per palette: over each palette's card it lands where the table says (Zinc `#e3e8ec` / `#101317`), over a coded card it is that
  card's own fill sunk, and on the page it sinks the page, so a field in a toolbar reads as a well too. A colour per palette would
  have been lighter than the page under a field on the page.
- **The other two palettes are drawn to the same structure**, each neutral tinted toward its accent's hue. Their pages went a step
  darker than written here so a card stands off them by the same 0.03 Zinc's does: Teal's page `#dee7e9` (written `#e1ebed`),
  Terracotta's `#eae4db` (written `#eee8df`), and Terracotta's light accent `#a54926` (from `#a94b28`, 4.46:1 on the darker page, now
  4.64). **`--text-3` is a step darker in light on all three** (Zinc `#545e68`, Teal `#516065`, Terracotta `#625c52`): a well on the
  page darkens the page under it, and the old `--text-3` read 4.3:1 there. P180's palette check (extended, §3g) proves each: the well
  a step under the card (at least 0.025 in light, 0.02 in dark) and over the page in light, a well on the page under the page, the
  dark steps, every text tier at 4.5:1 in a well on its card and on the page, and every fill at or under L 0.97 (HR-9).
- **The default palette is Zinc & brass** (§1a-2): `head.html`'s first paint and `appearance.js` (`applyAppearance`) take `zinc`
  where the device has no `sep_inv_palette`; `:root` alone carries Zinc's primitives, `[data-palette="teal"]` Teal's. A device that
  chose a palette keeps it. **A device on Teal because Teal was the default moves to Zinc**: choosing the default never stored a
  key (appearance.js removes it), so a device that picked Teal while it was the default holds no choice to keep. One that picked
  Zinc or Terracotta keeps it.

**Lift** (a card off the page) and **press** (a well into its card), as tokens:

```css
--lift-1: 0 0.0625rem 0.125rem light-dark(rgb(20 25 30 / 0.06), rgb(0 0 0 / 0.40)),
          0 0.375rem 1.125rem light-dark(rgb(20 25 30 / 0.07), rgb(0 0 0 / 0.32));   /* every card */
--lift-2: 0 0.125rem 0.25rem light-dark(rgb(20 25 30 / 0.08), rgb(0 0 0 / 0.45)),
          0 0.875rem 1.875rem light-dark(rgb(20 25 30 / 0.12), rgb(0 0 0 / 0.40));   /* a widget being dragged; the sign-in card; the primary button */
--press-1: inset 0 0.0625rem 0.1875rem light-dark(rgb(20 25 30 / 0.14), rgb(0 0 0 / 0.45));  /* a field, a track, a PIN box */
--press-2: inset 0 0.0625rem 0.125rem light-dark(rgb(20 25 30 / 0.10), rgb(0 0 0 / 0.35));   /* a tile inside a card */
```

`--shadow-tile` (8 Oct 2026, *"Let's give our tiles elevation as well"*) is retired: a tile stands inside a card, and inside a card it
is a well (§3b). `--shadow-pop` and `--shadow-dialog` stay for layers.

**Radii**, larger than v2.0's, the same on both layouts:

| Token | Value | What |
|---|---|---|
| `--r-card` | `1.125rem` (18 px) | a card: panel, hero, widget, deck card, the sign-in card |
| `--r-tile` | `0.875rem` (14 px) | a tile inside a card; a PIN box; a field on the sign-in screen |
| `--r-ctl` | `0.75rem` (12 px) | a field, a select, a button, a segmented control, the search |
| `--r-key` | `1rem` (16 px) | a keypad key (the sign-in button is a card's, `--r-card`) |
| `--r-full` | as now | a chip, a badge, a dot, a switch |

`--r-sm`…`--r-xl` stay for what they draw now (a dot's ring, a chart's bar end, the table's corners) and are not used for a card.

**Type**: Geist and Geist Mono as now (`head.html:18`; `sw.js`'s `FONT_CSS` repeats the URL). Three sizes are added for the
dashboard's figures, on the scale: `--fs-28: 1.75rem` (a widget's figure, M and L), `--fs-36: 2.25rem` (the day card's clock on the
phone) and `--fs-48: 3rem` (the clock on the desktop). A figure is Geist Mono, tabular, as now (DR-4).

### 3b. Where the look goes

| Component (class, builder) | Now | After U1 |
|---|---|---|
| Panel `.inv-panel` (styles.css:1379) | surface, hairline, `--r-xl` | surface, `--c-edge` hairline, `--r-card`, `--lift-1` |
| Hero `.inv-hero` (:2011), `uiHeroHtml` | tone gradient, `--r-xl`, flat | tone gradient (§3d), `--r-card`, `--lift-1` |
| Hero sheet `.inv-hero-sheet` (:2052) | a box in the hero | no box of its own (built: its rows and story drawn on the card, a hairline under the head, its last row in the card's corners); its tiles are the wells |
| Tile `.inv-tile` (:1418), `uiFactorTileHtml` | `--r-md`, `--shadow-tile` | inside a card: `--c-well` (or its tone's fill), `--r-tile`, `--press-2`; a pressed filter tile an accent edge, `aria-pressed` |
| Deck card `.inv-deck > *` (:2111) | `--r-lg`, `--shadow-tile`, a left rule | `--r-card`, `--lift-1`, its tone's left rule kept |
| Field `.inv-input`, `.inv-select`, `.inv-textarea` (:1732) | surface, hairline | `--well`, the fine edge `--edge` in place of the hairline (it carries the accent on focus), `--press-1`, `--r-ctl`; focus: the ring as now |
| Search `.inv-search` (:1325) | a field | a well; the palette's input a large well (`--ctl-h` × 1.25) |
| Segmented `.inv-seg` (:206) | a bordered strip | a well (track); the pressed segment `--c-surface`, `--lift-1`, its text `--text-1` |
| Tick box `.inv-check` (:1500) | drawn by the app | a well; ticked: `--accent` fill, the tick `--on-accent` |
| Switch (new `.inv-switch`) | a tick box | a well track `--r-full`, a lifted knob; on: `--accent` track. For the widget gallery and Settings' on/off rows |
| Meter `chartMeter` track | `--surface-2` | a well track |
| Chip `.inv-chip` (:1302) | bordered | `--c-surface`, `--lift-1`; pressed: `--accent-soft` fill, `--accent-soft-text` |
| Button `.inv-btn-primary` | accent fill | accent gradient (the accent to one step darker, 180°), `--lift-2`, `--r-ctl`; the text `--on-accent` |
| Button `.inv-btn-secondary`, `-ghost` | as now | `--r-ctl`; secondary `--c-surface` + `--lift-1`; ghost unchanged |
| Dialog, sheet, palette (§14) | as now | `--c-surface-3` in dark, `--r-card` (the sheet's top corners), `--shadow-dialog` |
| Toast `.inv-toast` (:1918) | as now | a pill (`--r-full`), built in U1; its fill and its kind's icon arrive together in §14 (U7), so the toast keeps its inverted, high-contrast fill until its icon can carry the kind |
| The phone bar, the rail | as now | the bar a floating card (`--r-card`, `--lift-2`); the door on screen keeps its `--accent-soft` pill (as built: the accent is for touch, and what is selected is the accent's job, DR-2) |

- **A well's text keeps its contrast**: every tier, `--text-3` included, reads at 4.5:1 or more in a well on its card and on the
  page, in every palette and both themes (P180 measures it), and a well never loses its edge in dark (§3c). C's faint grey-on-grey is
  not taken. (Written first as *never lighter than `--text-2`*; measured, `--text-3` passes once darkened, §3a, so tile labels keep it.)
- **Paper is untouched**: no token above reaches `.inv-print-invoice`, `.inv-qc-page`, `.inv-cn-doc`, `.inv-sr-doc`, `.inv-qt-doc`,
  `.inv-rpt-doc`, `.inv-ps-*`, `.inv-as-*`, `.inv-idc*`, which declare their own (HR-6's exceptions).

### 3c. Dark, done properly

A shadow is barely seen on a dark page, so in dark **a card is lifted by a lighter surface and a fine edge**, the shadow only adding to
them:
- the page `#0e1114`, a card `#15191d` with a 1 px `--c-edge` (`rgb(237 240 243 / 0.08)`) all round, a card inside a card (a deck
  card) a step lighter in its tone, a layer (a dialog, the search, a menu) `#1c2126` (built: `#242a30` put `--text-3` under 4.5:1 on
  Teal and Terracotta, 4.23 and 4.34, so a layer is `--c-surface-2` and what is drawn on it reads the layer as its surface, §3b);
- a well is darker than the card it sits in (`#101317`), with `--press-1` and the same fine edge, so it reads as a hollow and not a
  hole;
- each step at least 0.03 OKLab L above the one under it, which P180 asserts per palette (§3g);
- text `#edf0f3` / `#a9b3bd` / `#86919c`, the accent `#dcaa4c` on Zinc (as now); the status tones' dark values as now
  (styles.css:77–80).

### 3d. The colour codes

**A status tone says what a figure means**, and only that. The five, with the word a card wears and the icon beside it:

| Tone | Word | Icon (§4) | Means | Text / fill (light) | Mark |
|---|---|---|---|---|---|
| ok | Good | `done` (circle-check) | on target, paid, clears cost | `--ok` `#176e37` / `--ok-bg` `#e4f3e8` | `--ok-mark` `#2f8a50` |
| warning | Watch | `alert` (triangle-alert) | near a limit, getting late | `--warning` `#8a5700` / `#fcf1d9` | `--warning-mark` `#c08a2a` |
| danger | Act | `cancel` (octagon-x) | late, short, below cost, down | `--danger` `#b42318` / `#fdecea` | `--danger-mark` `#c4382b` |
| info | Know | `info` | worth knowing, no judgement | `--info` `#1d5ea6` / `#e6effa` | `--info-mark` `#3f6e9a` |
| neutral | Plain | none | a count or a sum, nothing to judge | `--text-1` / `--c-surface` | `--text-3` |

- **A coded card is filled in its tone** (a 160° gradient from `--tone-bg` to the tone 7% into it, as on the approved board; Today's
  cards since 8 Oct 2026 ran 135° from the tone 18%, and are taken down to the board's), `--tone` / `--tone-bg` on the element, its word
  and icon in `--tone`, its figure in `--tone`. Inside it a card in its deck lies lighter in both themes and a tile sinks darker
  (design §3.3 *Fills*). **A card takes the tone of the worst
  thing it holds**, as now (HR-9's coded boxes). A plain card is `--c-surface`.
- **A coloured figure always has its reason in words beside it and its icon** (DR-8, amended in §3f): the colour is never the only
  signal. Where a row has no room, a dot and the word stay (`uiRowEndHtml`), as now.
- `--*-mark` (new) colours an icon, a dot or a chart's status mark: a step lighter than the text tone, so a small mark is seen. Dark
  marks are the dark text tones.

**Six series colours say which thing a line or bar is** (`--series-1`…`--series-6`, new; `--chart-1`…`--chart-8` retired, with
`--chart-other` renamed `--series-other`). **Always in this order, never by rank**:

| Slot | Light | Dark |
|---|---|---|
| 1 | `#2e75b6` blue | `#5a98dc` |
| 2 | `#c0622b` orange | `#d9733d` |
| 3 | `#1f8a6a` green | `#2fa37f` |
| 4 | `#a87c00` ochre | `#b8890f` |
| 5 | `#c2508a` magenta | `#d06a9c` |
| 6 | `#6b55c9` violet | `#8576e8` |
| other | `#9aa4ae` | `#5d6772` |

- **Checked with the dataviz validator** (`scripts/validate_palette.js`, 16 Oct 2026): light against the card `#eff3f6` and against a
  well `#e3e8ec`, dark against `#15191d`: every check passes (lightness band 0.43–0.77 light, 0.48–0.67 dark; chroma ≥ 0.1; the
  worst adjacent colour-blind pair ΔE 8.4 light, 9.6 dark, tritan 8.2 and 5.9; the normal-vision floor 16.3 and 16.6; contrast ≥ 3:1).
  The palette in use until now fails the same check: its ochre, brown and green read alike. Dark tritan at 5.9 is under the 6 floor,
  so **two or more series always carry a legend and, up to four, direct labels** (the validator's secondary encoding); U1 runs the
  validator on `--series-other` against both surfaces and records the result in the design doc.
- **A colour follows the thing, never its rank** (`seriesSlot(kind, id)`, charts.js, new): the six clients with the most kilos plated
  over the whole book hold slots 1–6 app-wide (worked out once a book, `_bookWrites`), every other client is *Other*; the three lines
  are slots 1 (VAT A1), 2 (VAT A2), 3 (barrel); a live cost's parts slots 1 labour, 2 zinc, 3 chemicals, 4 power, 5 water, ETP and
  upkeep; the areas in the shop's order (VAT A1, VAT A2, barrel, pickling, office and gate, civil); stock lines and suppliers by
  spend over the book, like clients. A filter that hides one never repaints the rest.
- **One against the rest** (*"brass for this month, grey for the one it is set against"*): the period on show, or the thing picked,
  in `--accent`; what it is set against in `--series-other`. This is the accent marking *what is selected*, which is its job.
- **How much** (a heat map, a scale): one blue, light to dark, `--seq-1`…`--seq-7` = `#cde2fb #9ec5f4 #6da7ec #3987e5 #256abf
  #184f95 #0d366b`; dark from dim to bright, `#163a63 #1d4f8a #256abf #3987e5 #6da7ec #9ec5f4 #cde2fb`. U1 validates both ramps for
  monotone lightness against their surface and re-steps any that fails, recording the values.
- **The accent is for touch**: buttons, links, what is selected, the door on screen, a widget's head (its door to its screen). It
  never marks good or bad, never a series.

### 3e. Motion

A card lifts (`--lift-1` → `--lift-2`, `--dur-1`) when grabbed to move; a well presses on tap; nothing slides in. Under
`prefers-reduced-motion: reduce` every transition is off and the wrong-PIN shake (§15) is a colour change only. Print stops motion as
now.

### 3f. The design rules, amended (`docs/SEP_INVOICING_DESIGN_PRINCIPLES.md`, in U1)

- **DR-6** (*no shadows on content*, amended 8 Oct 2026 for tiles) becomes: **a card lifts, a well sinks, a layer floats; nothing
  else casts a shadow.** The tile's own lift goes; inside a card a tile is a well.
- **DR-8** (*status is a dot or a badge plus a word*) adds: **a coded card and a status badge carry the tone's icon as well**; a dot
  and a word where the row has no room.
- **DR-2** (*one accent for interaction*) is restated with the colour codes above: the accent never marks a status or a series; *one
  against the rest* is the accent marking what is selected.
- **§3.1 Palettes**: Zinc & brass the default; the well and the edge added to each palette.
- **§6** names the new components (§3b's switch, §5's charts, §7's widget and grid, §11's flow, §14's blank state, §15's keypad) with
  what each replaces, and **§6.28's table of box looks** is regenerated (§3g).

### 3g. What holds it (the tests, in U1)

- **P197's census tells a well from a lift**: `census()` (load-fixture.ts:262) writes `well` for a box whose only shadow is inset and
  `lift` for an outer one, in place of `lift` for any shadow. Changed first, in its own commit, with `LOOKS` re-recorded on the build
  before the look, so the look's own commit shows exactly which looks it changes. **`LOOKS` is then regenerated from the census after
  U1** and the design doc's table (§6.28) rewritten from it; each look named with what wears it; nothing on it unnamed.
- **P180** (p180-no-white.spec.ts) gains, per palette and theme: the well between the page and the card (§3a) and the dark steps
  (§3c); its existing checks (no white, surface over the page, the coded boxes' fills) stay.
- **P182** (p182-shell-tiles.spec.ts:76–103) is rewritten to the new facts, never weakened: a card has two outer shadow layers and
  `--r-card`; a tile inside a card has one inset shadow and `--r-tile`; tiles stand at least `--sp-8` apart; a pressed tile has an
  accent edge; a sheet holding a strip of tiles draws no box of its own.
- **P76** sweeps as now (every screen, view and dialog, both layouts and themes): the HR-9 fill sweep, the touch targets, the
  classes. **The class count** (HR-3) is recounted in U1 and after each step, and CLAUDE.md's figure set to it (the survey of
  16 Oct 2026 counted 781 against the 776 written).
- **New: P228, the look** (§20): wells on every field, search, track, tick box and tile inside a card; a card's lift and radius;
  the dark edge; the primary's gradient; the series tokens' values; no `--chart-*` or `--shadow-tile` left in the stylesheet.

## 4. Icons v3 (U1)

The canvas's board *Icon set v3, second go*: *"24 grid, 1.75 stroke, round ends, 2 px clear of the edge. The ink line carries the
shape; one brass tint fills its main part. Common shapes follow Lucide, an open-source set free for business use. The plant's own
things are drawn to match."*

- **One set, `ICONS` in state.js** (state.js:1019–1087, 62 icons today), drawn by `iconSvg(name, cls)` as now, the conventions as now
  (`ICON_ATTRS`: viewBox 0 0 24 24, stroke `currentColor` 1.75, round caps and joins, `aria-hidden`; the glyph inside 2–22). **Every
  existing name stays** (no call site changes); a name the board redrew takes the board's shape; the board's new names are added.
- **Two inks**: an icon's paths are its line (`currentColor`); a path marked as its fill (in `ICONS`, a path prefixed `d:`) is drawn
  `class="inv-ico-tint"`, filled `var(--ico-tint, var(--accent))` at `fill-opacity: 0.22`, no stroke. The tint is the app's mark on its
  own drawings, the board's *one brass tint*; **in a toned place (a coded card, a status badge) the tint and the line are the tone**
  (`--ico-tint: var(--tone)`), and a tint never says a status by itself.
- **The board's 64**, by group (shape: a Lucide name, or *drawn* for the plant's own):
  - *Doors and tools*: `home` house · `today` sun · `office` briefcase · `floor` factory · `money` banknote · `add` circle-plus ·
    `search` search · `settings` settings · `history` history · `book` book-open · `clock` clock · `widgets` layout-dashboard ·
    `sync` refresh-cw · `idscan` scan-qr-code · `print` printer · `alert` triangle-alert.
  - *Office and money*: `invoice` receipt-indian-rupee · `challan` clipboard-list · `client` building-2 · `quote` badge-indian-rupee
    · `creditNote` file-minus · `pipeline` workflow · `dispatch` truck · `prospect` target · `bank` landmark · `cheque` drawn · `cash`
    coins · `gst` badge-percent · `wages` wallet · `owed` indian-rupee · `forecast` trending-up · `report` file-chart-column.
  - *The plant, drawn for SEP*: `vat` (a tank: its rim, two hangers, the bath and a wave) · `barrel` (a hexagonal drum) · `pickling`
    (a beaker with bubbles) · `rack` · `zinc` (two ingots) · `chemical` (a drum) · `part` (a U-bolt and its two nuts) · `weight`
    weight · `worker` hard-hat · `idcard` id-card · `attendance` calendar-check · `overtime` (a clock with a plus) · `power` zap ·
    `cut` zap-off · `efficiency` gauge · `upkeep` wrench.
  - *Market and analysis*: `truck` (a heavy truck, drawn) · `export` ship · `calendar` calendar-days · `turnaround` timer · `dtp`
    calendar-clock · `correlation` chart-scatter · `heat` grid-3x3 · `stats` chart-column · `storm` cloud-lightning · `fair` cloud-sun ·
    `rain` cloud-rain · `news` newspaper · `planner` map · `market` chart-candlestick · `info` info · `done` circle-check.
- **The kept names redrawn to Lucide shapes where Lucide has them**: `back` chevron-left · `next` chevron-right · `close` x · `check`
  check · `plus` plus · `more` ellipsis · `filter` sliders-horizontal · `external` external-link · `send` send · `eye` eye · `pencil`
  pencil · `trash` trash-2 · `copy` copy · `link` link · `caution` circle-alert · `warning` triangle-alert · `cancel` octagon-x ·
  `activity` activity · `rss` rss · `mine` circle-user · `file` file · `filePlus` file-plus · `fileUp` file-up · `box` package ·
  `boxPlus` package-plus · `flask` flask-conical · `users` users · `userCheck` user-check · `message` message-circle · `task`
  square-check · `clipboard` clipboard · `clipboardCheck` clipboard-check · `tag` tag · `receipt` receipt-indian-rupee · `note`
  sticky-note · `chart` chart-column · `shield` shield-check · `phone` phone · `compass` compass · `route` route · `scale` scale ·
  `wrench` wrench · `flag` flag · `fork` git-fork. `flip`, `rack`, `cheque`, `zap`, `nut` keep their own drawings, redrawn to the grid.
  Aliases point at one shape: `power` = `zap`, `upkeep` = `wrench`, `stats` = `chart`, `know` = `info`.
- **The status icons** (§3d): ok `done`, warning `alert`, danger `cancel`, info `info`.
- **The mark** (the nut, the app's brand): one builder, `markSvg(size, tone)` (state.js, new), used by the rail's mark, the sign-in
  screen and the app's icon (§15d); `guard.js`'s and `workspace.js`'s own copies go (the survey found one each).
- **`body.html`'s 18 hard-coded copies** of `ICONS` paths become `<span data-icon="name"></span>`, filled by `iconFill(root)` at boot
  (before `inv-booted`), so the set has one source. The drawings that are not icons stay where they are (people.js's bars and stars,
  plant.js, planview.js's charts, qr.js's QR, today.js's check at stroke 3 becomes `iconSvg('check', 'inv-ico-bold')`).
- **The licence goes with the build**: Lucide is ISC (*"Copyright (c) 2026 Lucide Icons and Contributors"*), and the shapes Lucide took
  from Feather are MIT (*"Copyright (c) 2013-present Cole Bemis"*); both notices, in full, sit in a comment above `ICONS` (the built
  page keeps comments) and in Settings → Data & device → Backup, storage & build → **Licences** (a dialog). P228 reads the built page
  for both.
- **What holds it**: P228 asserts every `iconSvg` name used in `split/` exists in `ICONS`, every icon's paths stay inside 2–22 on the
  24 grid, no `<svg` with a `d=` path outside state.js and the drawings named above, and every `data-icon` is filled after boot.

## 5. Charts (U1)

`split/charts.js` keeps every builder it has (chartLine :113, chartBars :166, chartPie :205, chartRankedBars :274, chartLines :364,
chartStack :441, chartPieTap :479, chartRangeHtml :518, chartSpark :550, chartMeter :584, chartDayStrip :604) and adds eight. **Every
builder obeys the same marks** (the dataviz method): one axis, never two; bars at most 24 px thick with 4 px rounded data ends anchored
to the baseline; lines 2 px; dots at least 8 px with a 2 px ring in the surface colour; gridlines solid hairlines; the axes recessive;
text in text tokens, never in a series colour; selective direct labels, never a number on every mark.

| Builder (new) | Data | Options | Draws | First used by |
|---|---|---|---|---|
| `chartDiverging(rows, opts)` | `[{key, label, value}]`, value signed | `unit, pos ('ok'), neg ('danger'), id, toDate, ariaLabel` | bars up and down from a zero rule, coloured by status: above is `pos`, below `neg` (a judgement, so status tones) | price against cost, month by month |
| `chartHistogram(values, opts)` | numbers | `binWidth \| bins, unit, mark: {value, label}, id` | counts by bin, a reference mark (terms, a target) | cut lengths, days to pay |
| `chartDots(rows, opts)` | `[{key, label, value, sub}]` | `unit, marks: [{value, label}], id` | one dot per row on one scale, labelled at the row's end, marks as rules | what each client pays a kilo (against the variable and full cost) |
| `chartScatter(series, opts)` | `[{key, label, points: [{x, y, label}]}]`, three series at most | `xUnit, yUnit, fit, id` | dots, the least-squares line where `fit` | does one move the other |
| `chartHeat(cells, opts)` | `[{date, value, state, title}]`, state `ok` / `none` (no record) / `off` (not a working day) | `weeks, unit, id` | a calendar: a column a pay week, a row a day Monday to Saturday (Sunday drawn only when worked), the value on `--seq-*`, a hatch for *no record* | plated each day |
| `chartDumbbell(rows, opts)` | `[{key, label, a, b, tone}]` | `unit, aLabel, bLabel, id` | per row a rule from `a` (a mark ┃) to `b` (a dot ●), the dot in the row's tone | days to pay against terms |
| `chartStack100(labels, series, opts)` | as `chartStack` | `unit, id, toDate` | shares summing to 100%, 2 px surface gaps between segments | share of tonnage against share of revenue; a kilo's cost |
| `chartRing(value, opts)` | a share 0–1 | `tone \| slot, centre, sub` | one share of a whole, its figure in the centre | a client's share of the plant |

- **A dial is not drawn** (the review: *"realisation against cost on a dial - needs work"*): a figure against a mark is a meter
  (`chartMeter`) or a diverging bar.
- **The statistics behind a scatter are one function**, `chartFit(points)` → `{n, r, slope, intercept}` (least squares; Pearson's r;
  null with fewer than 3 points), used by the chart and by the words a widget says (§7d, *corr*).
- **Every chart has a table behind it** (§1, ruling 6, item 7). `_chartBox` (:344), which wraps chartLines, chartStack and chartPieTap with their
  readout, wraps every builder above and chartLine, chartBars, chartPie and chartRankedBars too, and its readout line gains a
  **Table** button (`data-action="invChartTable"`, ghost, small) that swaps the drawing for an `inv-table` of the same data
  (`chartTableHtml(cols, rows)`) and back, kept in place (a change inside a view, `keepScroll`). The table's columns are the builder's
  own (label, then one column per series, in its unit), every figure as `chartFull(v, unit)` writes it. A sparkline or a meter inside
  a tile is the tile's figure drawn, not a chart: its numbers are in the tile's title, and it has no table.
- **Every mark can be read** (`invChartRead`, events.js:452 → `chartShowRead` :536): each datum carries `data-action` and `data-read`;
  the new builders follow, with hit targets larger than the mark. A tap writes the exact figure to the readout line.
- **The period not yet ended** (`opts.toDate`, TM6b) is drawn by every new builder that has a time axis, as the old ones do.
- **Series**: `opts` take `slot` (1–6, `seriesSlot`, §3d) or `tone` (a status) per series, never an index into a list; a ninth thing
  folds into *Other*.
- **What holds it**: P227 (§20) draws each builder on made-up data on both layouts and themes: the marks' sizes, a `<title>` and a
  `data-read` on every datum, the table's rows equal to the drawing's data, the legend for two series or more, the series colours by
  slot, the ring and the rules in surface colours, nothing past the box.

## 6. The data layer, shaped for SQL (U1)

**Why**: `docs/SERVER.md` §4 puts the book on the hub as `records` (store, id, rev, body) and adds **typed tables when a report needs
them** (invoices by month and client, production by line and day), filled by the Worker. Today every screen reads `S` directly
(the survey found no selector layer: `statsInvoices` stats.js:375, `weighLines` :168, `bankReceivables` bank.js:765,
`prodPlatedSummary` production.js:1624, cached on `_bookWrites` state.js:481 and `_prodVer`). Widgets are new code, so they are
written to read **views**: named row sets whose columns are the typed tables' columns. On a device the rows are worked out from the
book by the functions the screens already use (never a second arithmetic); once the hub has the typed table, a view can be filled
from it instead, and no widget changes.

- **`split/dataview.js`** (new, after `dash.js` in the concat order): `DV_VIEWS` (the definitions), `dvRows(name, where)` (a view's
  rows, filtered), `dvSum(name, by, measures, where)` (a small GROUP BY: `by` a column or a list of them, `measures` `{col: 'sum' |
  'avg' | 'min' | 'max' | 'count'}`, nulls left out of every measure and counted in `nulls`), `dvCols(name)`.
- **A view**: `{name, cols: [{name, type: 'text' | 'int' | 'num' | 'date' | 'bool', unit}], stores: [the book's paths it reads],
  rows: function () → [ {col: value} ] }`. Rows are plain JSON (strings, numbers, booleans, null): a date is ISO `YYYY-MM-DD`, a month
  `YYYY-MM`, money in rupees rounded by `gstRound` at the boundary, a weight in kilograms. **Unknown is `null`, never 0**: a day
  with no record, a part with no weight, a month the statement does not reach.
- **Cached once a book** (`_bookWrites` and, for production, `_prodVer`), each view on its own, built on first read.
- **The first views** (each `rows` calls only the function named; the column names are the hub's):

| View | Columns | Worked out by |
|---|---|---|
| `invoice_lines` | date, month, invoice_id, line, number, client_id, part, gauge, unit, qty, kg, kg_src, taxable, taxable_net, tax | `statsInvoices` (net of credit notes), `weighLines`, `lineWeightKg` |
| `invoices` | id, number, date, client_id, state, state_since, taxable, taxable_net, tax, total, terms_days, due_on, paid_on, paid_how, open_amount | the register, `invStateTone`'s stamps, `flowTerms`, `bankReceivables` |
| `receipts` | id, source (bank / cheque), date, client_id, amount, placed, how (exact / oldest / on account), invoice_ids | `bankReceivables` |
| `challan_lines` | id, challan_id, date, client_id, challan_no, part, unit, qty, open_qty, open_amount, billed_qty, wanted_by | `imLineOpen`, `imBilledIndex`, `flowPriorityOf` |
| `production_days` | date, line, kg, kg_est (bool), pieces, pieces_unweighed, rounds, efficiency, earned, cut_minutes | `prodLineDaySum`, `prodLineEfficiency`, `prodDayWorth`, `prodDowntimeDay` |
| `attendance_days` | date, roster, on_site, floor_heads, floor_need, ot_hours, extra_hours, recorded (bool) | `attDayRoster`, `attHoursSplit`, `areaNeedOn` |
| `power_cuts` | id, date, from, to, minutes, working_minutes, reason, where, damage | `powerCuts`, `powerAnalysis` |
| `stock_lines` | id, name, unit, level, days_left, use_day, last_price, supplier_id | `stockStatus`, `stockReplay` |
| `bank_rows` | id, date, amount_in, amount_out, balance, category, party, client_id | the bank's rows as Money reads them |
| `cost_months` | month, kg, labour, zinc, chemicals, power, other, measured_share | `liveCost`, `bankCostByMonth` |
| `daily` | date, week, and one column per series of §7d's *corr* catalogue, named by its key (`cutMin`, `heads`, `otHours`, `zinc`, `invSize`, `tonnes`, `real`, `dtp`, `eff`) | joins of the views above |
| `market_tata` | month, cv_total, cv_domestic, cv_export, hcv, released_on | `S.market.tata` (§9c) |
| `weather_days` | date, t_max, t_min, rain_mm, thunder (bool) | `S.market.weather` (§9d) |

- **Each view has its key** (built, U1): the hub's `PRIMARY KEY` is the record the row comes from, so a typed table can be filled
  and refilled by it. `invoice_lines` (invoice_id, line), `invoices` (id), `receipts` (id: the statement row's, or `chq:` and the
  cheque's for one in hand, with `source` saying which), `challan_lines` (id, the line's; `challan_id` its challan's),
  `production_days` (date, line), `attendance_days` (date), `power_cuts` (id: the report typed first, one cut being every
  report joined), `stock_lines` (id), `bank_rows` (id), `cost_months` (month), `daily` (date), `market_tata` (month), `weather_days` (date).
- **A line is weighed as billed** (found building U1): Stats nets a line by its credit notes, and a piece client's line with no
  weight on record is weighed by its amount over the client's ₹/kg, so the netted amount had been weighed and a 2% rebate took 2%
  of those kilos off the plant's tonnage. `statsInvoices` keeps the amount billed beside the net (`_gross`), and `lineWeightKg`
  weighs that: a note takes rupees off, never kilos (P226).
- **The rule for widgets** (§7a): a widget's `data` reads views and the functions its screen already draws with, and nothing else of
  `S`. A screen moves to views when a step touches it; no step rewrites a screen to views for its own sake.
- **The hub's shape, for S1** (written here so the two stay one): a typed table is the view's columns with `PRIMARY KEY` on its key
  columns, filled by the Worker from `records`; for example
  `CREATE TABLE invoice_lines (date TEXT, month TEXT, invoice_id TEXT, …, taxable_net REAL, PRIMARY KEY (invoice_id, line))`. A device
  then asks `GET /views/invoice_lines?since=<rev>`; nothing of this is built before S1.
- **What holds it**: P226 (§20): each view's columns match `cols` exactly, its types hold, a null stays null, and a sum over a view
  equals the figure its screen shows (`dvSum('invoice_lines', 'month', {taxable_net: 'sum'})` against `statsMonthRows`; production days
  against Lines' week; the bank's balance against Money's Cash hero).

## 7. Widgets (U2)

*"Widgets should be flexible so different layouts are possible without breaking the UI"* (owner, 16 Oct 2026). A **widget** answers
one question in a card. Home (§8) and, from U3, Stats (§10) are **boards** of widgets that each person arranges.

### 7a. A widget

`split/widgets.js` (new, after `today.js`) holds the framework; `split/widgetcards.js` (new, after it) holds `WIDGET_DEFS`, one entry
per widget, so the framework has no widget's arithmetic in it. An entry:

```js
{ id: 'cash',                          // stable for good: a layout names it; a retired id is never reused
  title: 'Cash and its low point',     // the card's eyebrow and the gallery's name
  q: 'Will the account dip below zero, and when?',   // the question, in the gallery
  section: 'money',                    // the gallery's chip: money | office | floor | people | market | analysis | questions
  sizes: ['m', 's', 'l'],              // what it may be; the first is where it starts
  needs: { page: 'pageFinance', money: true },        // who sees it (§7g): page by grdSees, money by grdSeesMoney, wages by grdSeesWages
  go: { tab: 'pageFinance', v: 'overview' },          // its door: the head opens it (a role that cannot follow it gets text, I4)
  live: 0,                             // seconds between redraws while on screen (the clock 60, a feed 1800); 0: when the book changes
  data: function (ctx) { … },          // reads views (§6) and its screen's own functions; returns {state, …} (§7c)
  draw: function (d, size) { … },      // the body's HTML for size 's' | 'm' | 'l'
  table: function (d) { … } }          // where it draws a chart: the chart's table is the builder's (§5); else omitted
```

- **The framework draws the card** (`wdgCardHtml(def, size)`): the head (the section's icon in its chip, the title, and the door's
  chevron; the head is the widget's link to its screen), the body (`draw`), and in arrange mode its handle, its size and its remove
  (§7e). The card is `<section class="inv-widget" data-w="cash" data-size="m" data-tone="…">`, coded in the tone `data` gives
  (`--tone`, §3d), its fold remembered as `w-<id>` where a widget folds (only *needs* and the questions' moves do).
- **A widget never throws its board down**: `data` and `draw` run inside `try`; a widget that throws draws the *error* state (§7c)
  and reports through `errors.js` once a session, the rest of the board drawn.
- **Reading**: `data` may call the views (`dvRows`, `dvSum`) and the functions its screen draws with (named in §7d), and no other part
  of `S`. A widget that needs a figure no function makes asks for the function in its screen's module first.
- **Its words** follow the house: a verdict-like line of at most 60 characters, figures in Geist Mono, units as the app writes them,
  no paragraph (P195's blocks: none over 120 characters), certainty as a sign (≈, ≥) or a badge.

### 7b. Sizes, the grid and arrangement by width

- **Three sizes**: **Small** (`s`: a figure and its line, a tile), **Medium** (`m`: the figure and a chart or a short list), **Large**
  (`l`: the figure, the chart and what it rests on, or the longer list). The size decides what is drawn.
- **The board** (`.inv-wgrid`, new) is a grid whose columns come from its own width (a container query on the board):
  12 columns at 60rem and over, 6 at 36–60rem, 2 under 36rem (the phone). A widget spans:

  | Size | 12 columns | 6 columns | 2 columns (phone) |
  |---|---|---|---|
  | Small | 3 | 3 | 1 |
  | Medium | 6 | 6 | 2 |
  | Large | 12 | 6 | 2 |

- **Height follows content**, packed with no gap by the existing packer (`uiMasonry`, state.js:1171; rows of `--masonry-row`), which
  places widgets in their layout's order and never before one earlier in it, so the order on screen is the order arranged.
- **Arrangement by width** inside a widget is CSS only: each widget is a container (`container-type: inline-size`), and under 18rem
  its parts stack (figure over chart over list), 18–36rem they sit side by side, over 36rem in columns. No widget is redrawn for a
  resize; a chart's drawing scales (charts.js draws at its natural aspect, sized by CSS).
- **A cap per size**, so no layout lets one widget run a screen long: Small at most 10rem tall, Medium 26rem, Large 40rem (the phone:
  Medium and Large 30rem). A widget's list shows the rows its size allows (Small 1, Medium 3 to 5, Large 8 to 10) and *Show all* goes
  to the list's screen. The sweep (§7i) fails on any widget over its cap.

### 7c. States, one set

Every `data` returns `state` and the framework draws the blank states with one component, `uiBlankHtml({kind, title, body, action})`
(state.js, new; `inv-blank*`, §14b), the same component the lists use:

| state | When | Draws |
|---|---|---|
| `ok` | there is something to show | `draw(d, size)` |
| `empty` | nothing is recorded yet (no statement, no production) | *Nothing recorded yet*, what records it, its door (*Import a statement*) |
| `early` | too little to say it surely (a figure needing days or receipts) | *Not enough yet: 4 of 10 working days*, and when it will be |
| `notset` | needs a setting (the plant's place, the feeds) | what to set and the door to it (Settings, a guide) |
| `offline` | a feed widget with no signal | the last copy and its age (*from 2 h ago*), else *Offline: the news comes back with a signal* |
| `error` | `data` or `draw` threw | *This widget could not be drawn*, a link to report it; the board goes on |

A state other than `ok` is drawn at the widget's size (Small: one line), never a blank card and never a zero standing for *unknown*.

### 7d. The widgets

Built in U2 unless the last column says U3. *Who* is the page the role must open (`needs.page`) and **M** where the widget shows
money (`needs.money`) or **W** wages; a role without it does not see the widget in the gallery or on a board. *Reads* names the
functions behind it; every figure is its screen's.

**Money**

| id | Title · question | Sizes | Who | Reads | Small · Medium · Large |
|---|---|---|---|---|---|
| `cash` | Cash and its low point · *Will the account dip below zero, and when?* | m s l | pageFinance M | `finForecast`, the bank balance (Money's Cash hero) | the balance and its day, the low point and its date · + the 60-day forecast (band, zero rule) · + *What it rests on* |
| `owed` | Owed to us, by age · *How much is owed, and how old is it?* | m s l | pageFinance M | `finAgeing`, `finOwedTone`, `bankDaysToPay` | the total and what is over 90 days · + the age bar and the two oldest · + the five largest with *pays in N d* |
| `dtp` | Days to pay, against terms · *Who pays on time, who is slipping?* | m s l | pageFinance M | `bankDaysToPay`, `flowTerms` | the median by value and *N of M past terms* · + a dumbbell, six clients (terms ┃, the real days ●) · + every client with 3 receipts or more |
| `gst` | GST due against paid · *Is every month's return paid?* | m s l | pageFinance M | `finGstByMonth`, `finGstStatus` | last month's status word and amount · + six months grouped (due, paid) · + twelve months and the notes |
| `money` | Money at a glance · *Where does the money stand?* | m | pageFinance M | `renderFinHomeCard` (finlinks.js:132, Pulse's) | balance, owed, pays in, runway tiles |

**Office**

| id | Title · question | Sizes | Who | Reads | Small · Medium · Large |
|---|---|---|---|---|---|
| `mtd` | Month to date · *How is the month going?* | s m l | pageRegister M | `renderHomeTiles`' figures (tabs.js:244), `homeMonthsBack` | billed and its change on the same days · + the four tiles · + each tile's sparkline of the months before |
| `pace` | This month at its pace · *Where does the month land?* | m l | pageRegister M | `predMonthPace`, `paceCardHtml`'s data | the band and the line against last month · + unbilled in hand and the working days |
| `turn` | Turnaround · *How fast does work go back out?* | s m l | pageProduction | `flowStats` (flow.js) | the median working days and the share back within target · + the two slowest clients · + the steps, challan → pickling → plating → despatch |
| `pipe` | Pipeline, stage by stage · *What is waiting, from challan to payment?* | m s l | pagePipeline (M for *Owed*) | `pipeStages`, `pipeLateSay` | the worst late stage · + the stages as coded tiles · + the oldest in each |
| `quote` | Quotations and prospects · *Who could fill the spare tonnes?* | s m | pageClients | `prsPipeline`, `prsSpare`, the quotations | out, won, lost · + the spare and the weighted pipeline |
| `unbilled` | Unbilled challans · *What is waiting to be invoiced?* | s m | pageIM | `renderHomeUnbilledCard`'s figures (tabs.js:365), `imWaitTone` | the open amount and the oldest's days · + the clients |
| `recent` | Recent invoices · *What went out last?* | m l | pageRegister | `homeRecentRowHtml` | five rows, each with Print · ten |
| `quick` | Quick actions · *What do I start?* | s m | each action by its page | `homeQuick` | three actions · six |

**Floor**

| id | Title · question | Sizes | Who | Reads | Small · Medium · Large |
|---|---|---|---|---|---|
| `floornow` | The floor now · *Who is on site and what is running?* | m s l | pageFloor | floor.js (`flrStaffing`, `flrLineJudge`), `attOnSiteTone` | on site of the roster and the worst line · + three lines: heads against need, plated so far · + units down, the EXTRA |
| `prodday` | Production, the last day · *What did we plate?* | s m l | pageProduction | `prodDayPicture`, `prodUsualDay`, `prodKgFig` | the tonnes and the usual day · + by line · + the day card (`prodDayHeroHtml`, compact) |
| `heat` | Plated each day · *Which days ran light, and why?* | l m | pageProduction | `production_days`, `power_cuts` | — · 8 weeks · 12 weeks, the light days that were cut days named |
| `eff` | Line efficiency, now · *Is each line plating what it can?* | m s l | pageProduction | `prodLineEfficiency` | the worst line's figure · + the three lines in their tones · + each line's factor that lost most |
| `risk` | Power cut risk by hour · *When is a cut likely today?* | s m | pagePower | `powerAnalysis` (when cuts start), the weather's hours (§9) | the riskiest window today · + 6 AM–10 PM: the share of cuts that start in each hour, the forecast's thunder hours marked |
| `powercuts` | Power cuts · *How much power did we lose?* | s m | pagePower | Pulse's power card (`renderHomeExtraCards`) | this month's cuts and hours · + the last cut and the month before |
| `stockdays` | Stock days left · *What runs out first?* | s m l | pageStock | `stockStatus`, `suppReorderPick` | the first to run out and the day to order by · + the five soonest as bars, marks at 3 and 7 days · + the reorder's cash with GST |
| `zincpaid` | Zinc against the market · *Did we buy well, and from whom?* | m l | pageStock M | `zincTrend`, `dashZincHtml` | the market now against the last bill · + suppliers over the market |
| `zinc` | Zinc rate · *What is zinc costing today?* | s m | any | `renderZincCard` | the MCX estimate and its age · + the last refreshes as a line |

**People**

| id | Title · question | Sizes | Who | Reads | Small · Medium · Large |
|---|---|---|---|---|---|
| `atttoday` | Attendance today · *Is the crew in?* | s m | pageStaff | `renderAttHomeCard` (payroll.js:1167), `attDayPanelHtml` | on site of the roster · + where they stand, the absent |
| `attweek` | Attendance by week · *Is the crew turning up?* | m l | pageStaff | `dashAttendanceByWeek` | 8 weeks · 26 weeks |
| `ot` | Overtime by area · *Where are the extra hours going?* | m l | pageStaff (W for rupees) | `attHoursSplit` | four weeks by area · + the EXTRA beside the OT |

**Market and the world outside** (§9)

| id | Title · question | Sizes | Who | Reads | Small · Medium · Large |
|---|---|---|---|---|---|
| `tata` | Tata Motors, Jamshedpur · *How is the demand our clients build for?* | l m | anyone signed in | `market_tata`, the news feed, `S.market.calendar` | — · the month's three figures with their change and the plant's week · + 13 months (this year against last), the models' chips, four headlines |
| `weather` | Weather at the plant · *Will a storm bring a power cut?* | s m | anyone | the weather feed, `weather_days`, `power_cuts` | now and today's rain or thunder window · + the next 12 hours; once 30 days are kept, the cut days that had rain |

**Analysis**

| id | Title · question | Sizes | Who | Reads | Small · Medium · Large |
|---|---|---|---|---|---|
| `corr` | Does one move the other? · *Pick two figures; see if they travel together.* | l m | by its series' needs | `daily` (§6), `chartFit` | — · the pair chosen, its dots, line and words · + the two pickers and *How it's worked out* |
| `clientprice` | What each client pays a kilo · *Who clears the cost, who does not?* | l m | pageStats M | `statsClientMargins` | — · six, worst first, against the variable and the full cost · + every client with its share of tonnage |
| `kilo` | Where a kilo's cost goes · *Which part of the cost is moving?* | m s l | pageStats M | `liveCost` | the live cost and the share measured · + the parts as one 100% bar · + the table: ₹ a kilo, share, source |
| `share` | Who fills the plant, who pays for it · *Is our biggest account our best?* | m | pageStats M | `statsClientMargins` | shares of tonnage against shares of revenue (U3) |
| `labour` | Labour a kilo · *Is labour moving with the work?* | s m | pageStats W | `labourForRange` | (U3) |
| `months` | Six months · *Each month at its own cost* | l | pageStats M | `statsMonthsHtml` | (U3) |
| `trend` | Revenue, tonnage and incoming · *Did we bill more, plate more, and what is coming?* | l | pageStats M | the trend's series (stats.js) | (U3) |
| `topitems` | Top parts · *Which parts fill the plant, which pay for it?* | m l | pageStats M | the top items | (U3) |
| `costcheck` | Recorded against paid · *Does the book agree with the bank?* | m | pageStats M | `liveCostPaidCheck` | (U3) |

**The questions** (Pulse's, §8c: `advQuestions`, advice.js:578; `statsStoryCards`, intel.js:266; the period is the board's)

| id | Title | Sizes | Who | Small · Medium · Large |
|---|---|---|---|---|
| `q-smooth` | Is the plant running smoothly? | m s l | anyone | the answer's vital (figure, word, sparkline or meter) · + its story · + *What you can do*, three moves |
| `q-money` | Are we making money? | s m l | M | as above |
| `q-clients` | Who is driving it? | m s l | M | as above |
| `q-plant` | Is the plant full? | m s l | anyone | as above |
| `q-cash` | Is cash coming in? | m s l | M, a statement | as above |
| `q-changed` | What changed? | m s l | anyone | as above |
| `dofirst` | Do first · *The three moves worth most* | m l | by each move's needs | `tdyFirstHtml`'s ranking (`advRank`): three · five |
| `why` | Why it moved · *What moved the figures against the period before?* | m l | M | `whyHtml` (why.js:153) |
| `figures` | The period in figures · *Price, cost, contribution, capacity* | m l | M | `statsOverviewHtml` (intel.js:82); was Pulse's *In one line* |
| `coming` | What's coming · *What happens next, and when?* | m l | each by its own needs | the predictions below: four · seven |
| `needs` | Needs you · *What needs me now?* | m l | anyone | `tdyTasks`, `todoRanked`: the Now group's first three · Now's first five and This week's count |
| `sync` | GitHub backup · *Is the book backed up?* | s | the settings permission | `ghRenderCard` |

**What's coming** (`coming`) lists dated predictions, soonest first, each with its reason, read off what already predicts it: the cash
forecast's low point under zero (`finForecast`), a stock line out before its supplier can deliver (`stockStatus`, `suppReorderPick`), a
client's next challan by its rhythm (`predCadence`), the month's landing (`predMonthPace`), a turnaround target about to pass
(`flowLines`), and **a cut likely today** where the forecast has thunder in the hours the plant's own cuts most often start
(`powerAnalysis` with §9's hours; said as the two facts side by side, never as a probability the book has not measured).

**Does one move the other** (`corr`) reads `daily` (§6). The figures it offers, each with its grain:

| Key | Figure | Unit | Grain | From |
|---|---|---|---|---|
| `cutMin` | Power cut minutes (*across*) | min | day | working minutes dark (`powerAnalysis`, recorded days only) |
| `heads` | Heads on site (*across*) | count | day | present marks (a half day 0.5) of the day's roster (`attDayRoster`) |
| `otHours` | Overtime hours (*across*) | h | day | the day's OT and EXTRA (`attHoursSplit`) |
| `zinc` | Zinc price (*across*) | ₹/kg | day | the market's estimate that day (`zincTrend`), else null |
| `invSize` | Invoice size (*across*) | ₹ | day | the mean taxable of invoices dated that day (`statsInvoices`) |
| `tonnes` | Tonnes plated (*up*) | t | day | the day's weight where nine tenths of its pieces are weighed (`prodWeigh`), else null |
| `real` | Realisation (*up*) | ₹/kg | week | weighed revenue over weighed kilos of the pay week's invoices |
| `dtp` | Days to pay (*up*) | days | week | value-weighted days from invoice to receipt, receipts of the pay week (`bankDaysToPay`'s arithmetic) |
| `eff` | Line efficiency (*up*) | % | day | the plant's efficiency that day (`prodDayEfficiency`) |

- A pair is read at the coarser grain of the two (a week when either is weekly: minutes and hours summed, heads, zinc and invoice
  size averaged), over working days Monday to Saturday (a Sunday worked counts), only where both figures are known.
- **Under 10 points it is `early`.** The words: |r| 0.7 and over *strong*, 0.4 *moderate*, 0.2 *weak*, under 0.2 *no pattern*; the
  slope in the figure's own step (*each hour dark*, *each head*, *each 10 OT hours*, *each ₹10 a kilo of zinc*, *each ₹10,000 of
  invoice*); always *a pattern, not proof it is the cause*, as the canvas wrote it.
- The pair picked is kept with the layout (§7h), so each person's *corr* shows their own question.
- A series names its needs (`invSize` and `real` money, `dtp` money and a statement); a role sees only pairs it may.

### 7e. Arranging

- **Customise** (in the board's toolbar, the `widgets` icon) puts the board in arrange mode, a layer over the screen (Back, Escape
  and Done leave it; a swipe does nothing while it is on). Each widget shows, over its head: its **handle** (`aria-label="Move Cash
  and its low point"`), its place in the order (*3 of 11*), its **size** (a segmented control of the sizes it allows) and **Remove**
  (×). The toolbar shows **Add a widget**, **Reset** and **Done** (the one primary).
- **Drag**: the handle takes a pointer (a mouse at once; a finger after 250 ms held within 8 px, so a scroll is never taken for a
  drag). The widget lifts (`--lift-2`), a placeholder of its size keeps its room, and the placeholder moves before or after the widget
  under the pointer's centre; near the screen's top or bottom the page scrolls. Escape or a cancelled pointer puts it back; a drop
  writes the order (§7h). Nothing else on the board redraws while dragging.
- **By keys** (and for anyone who does not drag): a focused handle moves its widget with ← ↑ (earlier), → ↓ (later), Home (first)
  and End (last), and an `aria-live` line says where it is (*Cash and its low point, 3 of 11*).
- **Size**: a pick redraws that widget alone at the new size, in `keepScroll`.
- **Remove**: at once, with *Undo* in the toast; the widget goes back to the gallery.
- **Reset**: asks first (`uiConfirm`: *Put Home back as the Owner layout? Your arrangement goes.*), then the person's role preset
  (§7g) for this board and this layout.
- Arranging the desktop changes the desktop's layout only, the phone's the phone's (§7h): their sizes differ.

### 7f. The gallery

**Add a widget** (from arrange mode, and from the board's foot: *Add a widget · N to choose from*) opens a dialog (wide on the desktop,
a sheet on the phone; `dialogOpen`):
- its head: *Add a widget*, the board it adds to (*Home · 11* / *Stats · 7*, a segmented control, Stats from U3 and only for a role
  that opens it), and Done (its one primary);
- the categories as chips (All, Money, Office, Floor, People, Market, Analysis, Questions), a chip with nothing the role may see left
  out;
- each widget a card: its live preview at its first size (drawn as it comes into view, `IntersectionObserver`, on the book as it is,
  its blank state where it has nothing yet), its title and question, its sizes, and **Add to Home** (a secondary button) or **On Home ✓**
  with **Remove**. Added, it goes to the end of the layout on screen, and to the end of the other layout at its first size.
- A widget the role may not see is never in it (I4); a widget already on the board says so.

### 7g. Presets by role

A board starts from its role's preset; any change makes it the person's own (`preset: 'custom'`), and **Reset** returns to the preset.

| Preset (role) | Home, in order (size on the desktop) | The phone |
|---|---|---|
| Owner (owner; the guard off) | `mtd` s · `q-money` s · `prodday` s · `cash` s · `pace` m · `coming` m · `tata` l · `floornow` m · `risk` s · `turn` s · `dtp` s · `q-smooth` m · `dofirst` m | the same order; Small stays Small, the rest Medium |
| Office (office) | `needs` m · `mtd` s · `unbilled` s · `owed` s · `dtp` s · `pipe` m · `recent` m · `turn` s · `quote` s · `tata` m | as the desktop's order |
| Floor (supervisor, floor) | `floornow` l · `prodday` s · `atttoday` s · `risk` s · `weather` s · `eff` m · `stockdays` m · `attweek` m · `ot` m · `tata` m | as the desktop's order |

A preset lists only what its role may see; a widget a role cannot see is left out when the preset is drawn, never shown empty. The
Stats board's preset is U3's (§10).

### 7h. Where a layout is kept

- **On the device now, one per person** (§1a-9): localStorage `sep_inv_layout`, never in the book (a backup, a pull or a merge never
  rearranges another device):

  ```json
  { "v": 1, "people": { "U-…": { "home": { "preset": "custom",
        "desk":  [["mtd","s"], ["cash","m"], ["corr","l"]],
        "phone": [["mtd","s"], ["cash","m"]],
        "opts":  { "corr": { "x": "cutMin", "y": "tonnes" } } } } } }
  ```

  The person is the signed-in ID (`grdUser()`), `-` with the guard off. A layout naming a widget the build no longer has drops it at
  load; one naming a widget the role cannot see keeps it in the list and skips it at draw (it comes back if the role does).
- **At S1, a record of the person on the hub** (`docs/SERVER.md` §4): store `prefs`, id the person's ID, body this object; the merge's
  rule for it is *the later wins, nothing held* (a layout is not worth the owner's time); the hub sends each person their own
  `prefs` only. Until S1 nothing of it leaves the device. §16 lists it.
- **Moved once from Pulse's layout** (`sep_inv_home`, tabs.js:442: `{preset, order, hidden, wide}`): a device on a named preset starts
  on its role's preset; a custom one starts on its role's preset too and adds, at its end and in Pulse's order, every widget Pulse
  showed that the preset lacks (wide as Large, the rest Medium), so nothing it showed is lost, by the new ids (`todo` → `needs`,
  `attendance` → `atttoday`, `production` → `prodday`, `power` → `powercuts`, `stock` → `stockdays`; the others the same).
  `sep_inv_home` is left as it is: an older build in another window still reads it.
- **What holds it**: P223 (§20): a layout made on the desktop survives a reload and is not the phone's; two people on one device keep
  two; a migrated custom Pulse keeps every widget it showed, in its order; a widget dropped from the build drops from the layout; nothing of the layout is in a
  backup, a push or the change log.

### 7i. The sweep that keeps every layout whole

**P224** (§20) draws **every widget at every size it allows, on the phone and the desktop, in light and dark**, on three books: the
long book (`longBook()`), the empty book and the crore book (a ₹12,34,56,789 invoice, an 80-character client name). For each it
fails on:
- anything past the widget's box (`scrollWidth > clientWidth + 1` on the widget or any descendant that is not a scroller), and the
  page wider than the screen;
- a figure broken inside a group (`brokenFigures`), an ellipsis without its `title` (`untitled`), a block over 120 characters;
- a widget taller than its size's cap (§7b);
- a fill over L 0.97 (HR-9), a touch target under 44 px on the phone, a class no stylesheet styles, a box look not on `LOOKS`;
- a widget drawn for a role that may not see it (each preset's role signed in, the guard on);
- any `pageerror`.

It then lays out each preset and a random arrangement of every widget (seeded, three seeds) on both layouts and asserts the same, so
*no layout breaks the screen* is a test, not a hope.

## 8. Home (U2)

*"We need a Home page and dashboard for it as well, a clean, live and informative dashboard. It should show the time, some
predictions, some news."* The canvas's boards *Home, desktop (live)* and *Home, phone* are the reference.

### 8a. The door, the row and the names

- **`WORKSPACES[0]`** (workspace.js:39): `{ id: 'today', label: 'Home', icon: 'home', … }`, its views
  `[{tab: 'pageHome', v: 'home', label: 'Home'}, {tab: 'pageHome', v: 'needs', label: 'Needs you'}, {tab: 'pageStats', label: 'Stats',
  group: 'Insights'}, {tab: 'pageReports', …}, {tab: 'pagePlanner', …}]`. The id stays `today` (§1a-3).
- **`TDY_VIEWS`** (today.js:17) becomes `['home', 'needs']`; `tdyView()` is `home` unless the address or the session says `needs`;
  `tdySetView` takes either. `PAGE_TITLES.pageHome` is *Home* (tabs.js:5). `SCREEN_KINDS.pageHome` stays `overview` for both views.
- **The rail's mark and the brand open Home** (`invGoPulse` becomes `invGoHome`, opening `v=home`; `invGoPulse` kept as an alias for a
  saved trail or a test). Every other door to Pulse (the survey's list: intel.js:384, todo.js:644/650/878–885/909/1186, search.js:64
  `G T`/116–120/225/878, events.js:300, report.js:629, guard.js:47/57–59/142/627/747/750/767, settings.js:865, create.js:995,
  init.js:808/891–895, kbguides.js:11/23/47/372/482) opens Home, or Needs you where it opened Needs you. §17 I3's grep checklist
  covers them.
- **Signing in lands on Home** (`grdAfterUser`, guard.js:627): Mine for a person with a face, as now.

### 8b. The day card: Home's verdict

Home is an overview (TAB_MAP §3e): it leads with one hero carrying its verdict, and that hero is **the day card**
(`homeDayCardHtml`, today.js), drawn with `uiVerdictHtml` (its `screen` the greeting and the date, its `fig` the clock):

| Part | What | From |
|---|---|---|
| eyebrow | *Good morning, <name> · Friday, 16 October* | the hour (*morning* to 11:59, *afternoon* to 4:59 PM, *evening* after), the signed-in ID's name (none with the guard off), the date |
| fig | the clock, *9:42 AM* (`[data-home-clock]`), and under it *General shift ends 5:00 PM · 7 h 18 min* (`[data-home-shift]`) | the device's clock; the shift's end from the labour settings (8:30 AM–5:00 PM unless changed); after it, *the general shift has ended* |
| viz | the weather now: its icon, *31°*, *thunder 4–6 PM* | §9's feed (nothing at all when the feed is not set or not reachable: no placeholder) |
| verdict | one sentence, at most 60 characters, the first of: *Cash dips below zero on 21 Oct* (the forecast under zero within 14 days, danger) · *3 things need you now* (red tasks, danger) · *Barrel: 3 of 6 down* (a line half down, danger) · *On pace for ₹6.6L, ahead of September* (the pace against last month: ok ahead, warning behind) · *Nothing needs you now* (ok) | `finForecast`, `tdyTasks`, the plant register (`pltCapacity`, `pltDownWords`), `predMonthPace` |
| facts | the next two of those that hold, as short facts (*unless SSS MEHTA pays ₹2.1L first*: the largest receipt the forecast expects before the low) | the same |
| links | **Open Needs you · 9** (the count of open tasks) · **Make today's report** (only for a role that opens Reports) | `tdyTasks`, `rptFromStats` |

- **The tone is the worst of its facts**, as every verdict card's; a role without money reads the plain verdicts (§17 I4).
- **The clock ticks on the minute** (`homeClockStart` / `homeClockStop`): when Home's dashboard is drawn and visible it sets the two
  texts, waits to the next minute and then every 60 s; it stops when the page is hidden or Home is left, and sets the texts at once on
  coming back. It touches only the two `textContent`s: no node is added, so `navSync` and the overflow pass are not woken.
- **Shut on the phone, open on the desktop**, as every verdict card; shut, its head still shows the greeting, the clock, the weather
  and the sentence (the six-second test).

### 8c. The board, and Pulse folded in

- Under the day card: **one toolbar row** (TAB_MAP §3e): the period (`MTD · QTD · YTD · All`, Pulse's `statsSeg`, the one
  `_statsPeriod` Stats reads), **Customise** (§7e) and **More** (*Make a report*, *Open Stats*, *Reset Home*). Then the board
  (`#homeBoard`, `.inv-wgrid`), then the foot's *Add a widget · N to choose from*.
- **Pulse's parts each become a widget** (§7d): the six questions (`q-*`), *Do first* (`dofirst`), *Why it moved* (`why`), *In one
  line* (`figures`, renamed *The period in figures*, since *In one line* is now the day card's sentence) and *This month at its pace*
  (`pace`); Pulse's twelve widgets (`HOME_WIDGETS`, tabs.js:446) are §7d's `mtd`, `quick`, `money`, `needs`, `atttoday`, `unbilled`,
  `prodday`, `powercuts`, `stockdays`, `sync`, `zinc`, `recent`. `#homePulse`, `#homeQuestions`, `#homeEditArea` and `#homeWidgets`
  go; Edit Home (`homeEditHtml`, today.js) goes, replaced by arranging (§7e).
- **The hooks specs read are kept inside their widgets**: `#homeFin [data-home-fin]`, `#homeAtt`, `#homeAttOnSite`, `#homeTiles`, the
  `#mtd*` ids, `#recentInvoices`, `[data-card="sync"]`, `[data-zinc-age]`, `[data-tdy-questions]` (on the question widgets),
  `#statsWhy`, `#statsOverview`, `#statsPace`. The fixtures' `openPulse` opens Home's dashboard and puts the widget a spec reads on
  the board if the preset lacks it (`withWidgets(page, ids)`, replacing `withHomeWidgets`).
- **Needs you is unchanged** in what it holds (the day's inputs, the tasks, the recent invoices, Add, Snoozed, Done, Learnt), drawn in
  the new look (U7), and its address is the same.
- **The desktop's three columns** (`inv-panels-3` above 100rem, UX overhaul 2 step 7) do not apply to the board, which has its own
  grid (§7b).

### 8d. What moves, and where an old address lands

| Old | Opens |
|---|---|
| `?tab=pageHome&v=pulse` | `pageHome` · `home` |
| a saved trail step or `sep_inv_ws_last` naming `pageHome/pulse` | the same |
| `invGoPulse` | `invGoHome` |
| the manifest's shortcut `?tab=pageHome&v=needs`, the Windows widget's `todo=` launch | unchanged (Needs you) |

One row is added to `NAV_REDIRECTS` (nav.js:97): `{tab: 'pageHome', v: 'pulse', to: () => ({tab: 'pageHome', v: 'home'})}`.

### 8e. The guides

*Using the app: Today* (`app-today`) becomes *Using the app: Home*, version 5: the day card, the board, Customise (drag, size, remove,
reset), the gallery, Needs you. New: *Setting up: the news and weather* (`app-feeds`, §9e), linked from Settings → Connections → News
and weather (`guide` on the section, as the printer's). Both in Simplified Technical English (the knowledge base's standard).

## 9. The world outside: news, weather and Tata (U2)

*"live clock, weather, TATA Motors news - as everything boils down to their production and demand"*; *"Tata Motors, Jamshedpur:
monthly CV sales and the latest headlines + export sales as well … Prima division of Trucks, along with newer and earlier models"*.

### 9a. The feeds Worker (`server/feeds/`, new)

A Cloudflare Worker on the owner's account (*"news Worker now"*), its own, ahead of the hub. **No database, no binding, no secret**:
it keeps what it fetched in Cloudflare's cache and refreshes it in the background.

- **Files**: `server/feeds/wrangler.toml` (name `sep-feeds`, `main = "src/index.js"`, `compatibility_date`, vars `ALLOWED_ORIGINS` and
  `CONTACT`, no routes: the custom domain is set in the dashboard), `src/index.js`, `src/news.js`, `src/weather.js`, `package.json`
  (wrangler, vitest, `@cloudflare/vitest-pool-workers`), `package-lock.json`, `test/*.test.js`, `README.md` (the owner's steps).
  The hub of S1 goes in `server/hub/` beside it (§16).
- **Its address**: `https://feeds.somaelectro.co.in` (a custom domain on the owner's zone, made in the dashboard), so nothing of the
  `*.workers.dev` address is in the app.
- **Endpoints**, GET only (and OPTIONS for CORS):
  - `GET /health` → `{ok: true, at}`.
  - `GET /news?topics=tata-cv,tata-plant,tata-models,tata-exports&models=Prima,Signa,Ultra,Azura` →
    `{at, topics: {<id>: {at, items: [{title, url, source, at, lang}]}}, credit: {name: 'The GDELT Project', url:
    'https://www.gdeltproject.org/'}}`. `topics` is any of the four (unknown ones refused); `models` up to 8 words of letters, digits,
    spaces and dots, 16 characters each (else 400).
  - `GET /weather?lat=22.79&lon=86.15` (2 decimals, within −90…90, −180…180; else 400) →
    `{at, updated, lat, lon, hours: [{t, temp, symbol, rain}], days: [{date, tMax, tMin, rain, thunder, symbol}], credit: {name: 'MET
    Norway', url: 'https://api.met.no/', licence: 'CC BY 4.0'}}`, `hours` the next 48, `days` the next 7 by India's day (UTC+5:30).
- **News: the GDELT Project's DOC 2.0 API** (§1a-7; its terms: free *"for any academic, commercial, or governmental use of any kind
  without fee"*, with *"a citation to the GDELT Project and a link"*): `https://api.gdeltproject.org/api/v2/doc/doc?query=…&mode=ArtList
  &format=json&maxrecords=25&timespan=14d&sort=DateDesc`, one query a topic (`src/news.js`, `TOPICS`):

  | Topic | Query |
  |---|---|
  | `tata-cv` | `"tata motors" (sales OR trucks OR "commercial vehicles") sourcecountry:IN` |
  | `tata-plant` | `"tata motors" jamshedpur` |
  | `tata-models` | `("tata prima" OR "tata signa" …)`, one phrase per model word the app sent |
  | `tata-exports` | `"tata motors" (exports OR "international business")` |

  Each article becomes `{title (entities decoded, tags dropped, 200 characters at most), url (https or http only), source (its
  domain), at (its seen date, ISO), lang}`; the same title twice in a topic is kept once. GDELT asks for spaced requests: a refresh
  fetches its topics one after another, 6 s apart.
- **Weather: MET Norway's Locationforecast 2.0** (`compact`; CC BY 4.0; free for commercial use with credit): `https://api.met.no/
  weatherapi/locationforecast/2.0/compact?lat=…&lon=…`, with the **User-Agent its terms require** (`sep-feeds/1 ` + the `CONTACT` var,
  the shop's website or a mail address set in the dashboard, never written in the repo), `If-Modified-Since` from the last answer, and
  its `Expires` kept. `thunder` is read from the symbol codes (`…thunder…`); a probability is passed on only where MET's answer
  carries one. Temperatures in °C, rain in mm.
- **Cached, refreshed behind the answer**: each answer is kept in `caches.default` under its normalised URL with the time fetched. A
  request is answered from the cache at once; when the copy is older than 30 minutes (news) or past MET's `Expires` (weather), the
  Worker refreshes it with `ctx.waitUntil` (within the 30 s it allows) and the next request gets the new copy. With no copy at all it
  fetches before answering. **An upstream that fails leaves the last copy served with `stale: true`**; with none, 503 and `{error}`.
- **CORS**: `Access-Control-Allow-Origin` echoes the request's `Origin` only when it is in `ALLOWED_ORIGINS`
  (`https://rishabh1804.github.io,https://app.somaelectro.co.in`), with `Vary: Origin`; any other origin gets no CORS header. Answers
  carry `Cache-Control: max-age=300`.
- **On the free plan** (100,000 requests a day, 10 ms of CPU a request): four devices drawing Home every half hour for sixteen hours is
  about 256 requests a day; parsing a GDELT or MET answer is well under the CPU limit (U2 measures it in the Worker's tests and says
  so).
- **Its tests** (`server/feeds/test/`, vitest in Cloudflare's workers pool, upstream faked): CORS allowed and refused; topics and
  models validated; GDELT's JSON normalised (entities, http(s) only, duplicates, the cap); MET's JSON to hours and India's days,
  thunder from the codes; the User-Agent and `If-Modified-Since` sent; a second request served from the cache with no upstream call;
  an expired copy served and refreshed; a failed upstream served stale, or 503. **CI gains a job** (`feeds`, in ci.yml):
  `npm ci && npx vitest run` in `server/feeds`.

### 9b. The app's feed client (`split/feeds.js`, new, after `widgetcards.js`)

- **Settings → Connections → News and weather** (`S.feedsCfg`, in the book: `{on, url, lat, lon, place}`; a config record, in the
  change log and the merge): on or off (on by default), the address (`https://feeds.somaelectro.co.in` by default), the plant's place
  (latitude, longitude and a short name, *Adityapur*; filled from Office QR's place, `S.checkinCfg.lat/lng`, where that is set), and
  **Check**, which asks `/health` and says what came back. The credits are shown under it.
- **When it fetches**: when Home (or the sign-in screen, §15) is drawn and the copy on the device is older than 30 minutes; never in
  the background, never while offline (`navigator.onLine`), never more than once a minute. Widgets show the copy on the device with its
  age; a **Refresh** in the news and weather widgets' foot asks again.
- **The copy on the device**: localStorage `sep_inv_feeds` (`{news: {key, at, data}, weather: {key, at, data}}`), never in the book
  (headlines are not records). A failed fetch keeps it.
- **What leaves the device**: the topics, the model words and the plant's place to two decimals. Nothing of the book.
- `sw.js` needs no change: it passes a cross-origin GET to the network uncached (sw.js:152–160). `errors.js` does not report a failed
  fetch.

### 9c. Tata's figures and the plant's calendar (`S.market`, new)

- **The month's figures are typed from Tata's release** (§1a-8) in the Tata dialog (the `tata` widget's head, or *Every month and
  story*): the month, the day it was released, its link, and for each figure *this year* and *the same month last year*, as the release
  prints both:

  ```
  S.market.tata['2026-09'] = { released: '2026-10-01', url, at, by, note,
    cvTotal: {now, ly},      // all commercial vehicles, domestic and exports
    cvDomestic: {now, ly},   // in India
    cvExport: {now, ly},     // exports
    hcv: {now, ly} }         // heavy trucks, India
  // each figure in units, as the release prints it; ly: the same month a year before
  ```

  A figure may be left blank (a release that does not print it); a month typed again replaces the figures, the change log keeping the
  old. The widget shows the latest month's heavy trucks, exports and all CVs with their change on last year, and (Large) a line of the
  months typed, this year against last (each month's `ly`).
- **A headline that carries a figure is offered, never applied**: a title naming a month and *N units* beside *CV* or *commercial
  vehicle* (or *exports*) gives *A headline says … CVs in September: Use* (the figure it read) in the dialog, which fills the
  field for the owner to check against the release.
- **The plant's calendar**: `S.market.calendar['2026-10-20'] = {state: 'works' | 'shut', why, src: 'circular' | 'news' | 'owner', url,
  at, by}`. *The plant's week* shows today and the next six days: an entry's state; else a weekday *works* and a Sunday *usually shut*,
  both plain. A headline naming the plant shut or working on a date (*block closure*, *shut*, *works on Sunday*, with days and a month
  that parse) is offered as *Add to the calendar: Tue 20 and Wed 21 Oct shut (The Photon News, 14 Oct)*, again never applied unseen.
- **The models** (`S.market.models`, default *Prima, Signa, Ultra, Azura*; the owner's to change in the dialog) are the chips that
  filter the headlines and the words sent as `models`. Nothing in the build says which plant makes which model.
- **To-do rule `mktTata`** (the owner's, info, switchable): from the 2nd of a month, *Type September's Tata figures*, until the month
  before is typed; it opens the dialog on that month.
- **The book's paths**: `market.tata` and `market.calendar` are maps by month and by day, `market.models` a list: each in `CHG_TRACK`
  (changelog.js:49) under a new parent `market` (`CHG_PARENTS`), so the merge (`mrgUnits`) and the hub (§16) take them as records.

### 9d. Weather days

- On each fetch that lands, today's forecast as it then stands is written to **`S.market.weather['2026-10-16'] = {tMax, tMin, rain,
  thunder, symbol, at}`**, kept 400 days. It is a fetched copy, so it is **quiet**: its `CHG_TRACK` entry carries `quiet: true`, which
  the change log reads as *never compared* (as it leaves out `todo.resp`) and the merge as *this device's copy, the other filling what
  it lacks, never held* (as `MRG_QUIET`'s fields are).
- **What it is for**: once 30 days are kept, the `weather` widget says how many of the plant's cut days had rain or thunder (*Of 18
  cut days since 16 Oct, 11 had rain*, the two counts side by side, never a cause), and the *corr* widget can set rain against cut
  minutes (a series added to §7d's catalogue then: `rain`, mm, day, *across*). A forecast is not a record of what fell; the widget says
  *as forecast that day*.

### 9e. What the owner does

1. In Cloudflare: **Workers & Pages → Create → Import a repository**, this repository, the root directory `server/feeds`, the
   production branch `main` (Cloudflare's Workers Builds deploys on each merge from then on).
2. In the Worker's **Settings → Variables**: `ALLOWED_ORIGINS` as above, and `CONTACT` (the shop's website address or a mail address
   MET Norway may write to about the requests).
3. In the Worker's **Settings → Domains & Routes → Add → Custom domain**: `feeds.somaelectro.co.in` (Cloudflare makes the DNS record).
4. In the app: Settings → Connections → News and weather → **Check**. The guide `app-feeds` gives the same steps as the screens are
   named that day. Until then the news and weather widgets say *not set up yet* and link the guide (§7c `notset`).

## 10. Stats as a dashboard (U3)

*"The stats page doesn't look like a stats page at all, we have stored and displayed our data on tables essentially."* The canvas's
board *Stats, desktop* is the reference.

- **Two views** (Stats' own tab row): **Dashboard** (`board`, the default) and **Tables** (`tables`). The three tabs By client, Cost
  and Trends go; every card they held becomes a widget or a table (below).
- **Dashboard**: Stats' verdict card (the period's headline: *₹0.13 a kilo under the live cost*, its tone the price against the live
  cost, TM6's one judge; four factors: Revenue net of credit notes and its change, Plated and billed with the share weighed and of two
  shifts, Realisation against the cost, Left after the full cost), one toolbar row (the period, Customise, More: *Make a report*,
  *Export the tables*), then a board (§7) with its own layout per person (`stats` in `sep_inv_layout`), and its foot *The tables behind
  these*.
- **Stats' preset**: `pricecost` l · `kilo` m · `turn` s · `dtp` m · `corr` l · `clientprice` l · `share` m · `heat` l · `owed` m.
  `pricecost` (*Price against cost, month by month · Are we under the cost, and by how much?*, Large and Medium, pageStats M) is added
  to §7d with U3: realised and live cost as two lines over six months and the gap as `chartDiverging` under them.
- **Tables**: a switch **By client · By part · By month · Cost**, each an `inv-table` sortable by its columns (a head tapped sorts, as
  the register's), **Export** in More (CSV and `.xlsx`, `xlsx.js`), every figure its table's builder already makes:

  | Card on Stats now | Goes to |
  |---|---|
  | By client's verdict (large accounts under the cost) | `clientprice`'s line; a fact of Stats' verdict |
  | Contribution by client (`statsClientMargins`, `statsMarginHtml`) | `clientprice` (the chart) and **By client** (the table, its columns as now) |
  | The next challans (a fold) | `coming` and a column of **By client** (*next challan expected*) |
  | Revenue by client; realisation by client; concentration | `share` and **By client** |
  | Cost's verdict (the live cost and the share measured) | `kilo` |
  | Labour | `labour` and **Cost** |
  | The live cost's components (rows that fold open, with sources) | `kilo` (Large) and **Cost** (as now) |
  | Recorded against paid | `costcheck` and **Cost** |
  | The bills' fold | **Cost** |
  | Trends' headline | Stats' verdict card |
  | Six months | `months` and **By month** |
  | The trend chart | `trend` |
  | Top items | `topitems` and **By part** |

- **Redirects** (§18): `pageStats` · `clients` → `tables/client`; `cost` → `tables/cost`; `trends` → `board`; `sep_inv_stats_tab`'s
  old values the same.

## 11. Stock, and every Enter by hand (U4)

### 11a. A guided flow (`uiFlowHtml`, state.js, new; design §6, *Flow*)

*"The Enter by hand screen is primitive in design, and doesn't engage or leads the user, increases the learning curve."* Every form a
person fills by hand is cut into **numbered steps that lead without hiding** (§1a-11):
- **A step** is a section with its number in a node, its title as a question (*What came in?*), its fields, one line of help, and a
  book icon to its guide's section. It is **done** when its required fields hold a valid value: the node ticks and the step's head
  says what it holds (*Q558 · 25 kg*). The first step not done is **next**: marked *Next*, its first field focused when the form opens
  and when the step before is done by Enter. **Every step stays open and fillable in any order**: nothing is hidden, disabled or
  folded behind a step not reached.
- **A progress line** over the steps (*2 of 4*, a meter in a well).
- **The preview, *What Save records***: a card that says in words and figures what Save will write and what it changes (*Received 25
  kg of Q558 from <supplier>, bill 1043 of 14 Oct, ₹55.20 a kg before GST · The shelf goes from 15 kg to 40 kg*), and the checks the
  app already makes as rows in their tone (a count far off the level, a challan number already recorded, a rate on *Check*). On the
  desktop it stands to the right of the steps and stays in view; on the phone it sits under the last step, over the action bar.
- **A kind is a row of tiles**, each its icon, its word and a line (*Count · what is on the shelf now*; *Received · a delivery came
  in*; *Used · taken from the shelf*; *Charged · put into a bath*), in place of a segmented control.
- **Save** stays in the action bar; after it, **a receipt card** (*Saved: …*, what was recorded, and Correct where the form has it) and
  the form keeps what repeats, as now (*Entering several at a sitting stays on the form*).
- **Nothing the tests and the keyboard read changes**: field ids, `data-k`, `data-action`, `data-change`, the Enter chain
  (`data-kbd-ring`), Ctrl+Enter to save.

| Form | Builder (now) | Steps | The preview says |
|---|---|---|---|
| Stock by hand | `renderStockManual` stock.js:1168 | What (kind) · When (and the bill for Received) · Which lines, how much (₹ a unit; Into) · Who | each line's level before → after (`stockReplay`), the checks (`stockEntryChecks`) |
| Production by hand | `prodHandHtml` prodview.js:1218 | What (Plated, Pickled, Arrived, Power cut) · Where and when (day, line, shift, times) · Whose work (client, part, figure, rounds) · Rework | the run as it will count (`prodWeigh`'s kg and route), the rack and gauge checks |
| A power cut, completed | `pcsDialogHtml` powercause.js:290 | When (cut, power back) · Why · Where it hit · What brought it back | its length and what it cost (`powerCutCost`) |
| A hand's day | `attEditHtml` staff.js:731 (each change saves at once, as now) | Mark · Where · In and out · OT shifts | the hours and OT worked out (`relayHoursOf`) |
| A challan | `renderAddChallanForm` im-form.js:48 | Who and which challan (the number checked as typed) · The lines · Check | the lines, kilos and amount; the warnings |
| An invoice | create.js | Client and challans · Lines · Details (P.O., vehicle, dates) · Check | taxable, GST, total, the number it takes |
| A payment to a hand | `_payFormHtml` payroll.js:614 | Who · What and how much · When | their due before → after |
| A bill | `costBillFormHtml` cost.js:850 | Which bill · Amount and units · Arrears and penalty · Note | its cost (`costBillCost`) and the month's live cost after |
| A cheque received | `bankChequeFormOpen` bank.js:614 | Whose and how much · The cheque · When it came | what the client owes before → after |
| Mine's forms | faces.js: `faceLoadHtml` :498, `faceInHtml` :521, `faceBarrelHtml` :1283, `faceRollInHtml` :1131, `faceRollOutHtml` :1161, `faceVatHtml` :1501 | each form's own parts as steps (a load: Client · Part · How many · When it went in) | the record, and the group's message as it will be sent |

**Mine in the new look**: its day stepper, its duties as step cards (`faceStep` :55) and *What you entered* as rows in a card; its
forms the flows above.

### 11b. Spend and prices takes the room

The screenshot of 15 Oct: on the desktop, opening Spend and prices put it in the 22rem pane while the list of lines kept the rest.
- **On the desktop**, `invStockSpend` (stock.js:1910) sets `data-wide-pane` on `#stockMasterDetail`: the list narrows to a compact list
  (`--pane-list-narrow`, 18rem: a line's name and its days left) and the pane takes the rest of the room (`flex: 1`). Opening a line
  puts the host back. P80's fill holds.
- **Spend and prices is a small board** in that room: spend by supplier (the pie, tap a slice for its bills), use by week, a line's
  price trend, zinc against the market (`zincpaid`'s renderer), each a card.
- **On the phone** it is a sub-view with its back head (`v=spend`), no longer a fold at the list's foot.

### 11c. Two stock lines that are one

- A stock line's page gains **Merge into another line** (in More): pick the line to keep; asks first, naming the counts (*Move N
  entries from Nitric Acd to Nitric Acid and keep Nitric Acd as a spelling?*); a settings change (`grdGate('settings')`). The merged
  line's entries point at the kept line (each keeps `mergedFrom`), its name and spellings become the kept line's spellings, and it is
  retired (`retiredAt`, `mergedInto`), never deleted.
- **To-do rule `stockTwins`** (the owner's, info): two lines whose names fold to one key (`stockKey`, which reads *ACD* as *ACID* since
  16 Oct) or differ by one letter in a word of four letters or more; it opens the merge on the line with fewer entries. On the owner's
  book it finds the Nitric pair, which the owner merges with one tap.
- `sep-stock`'s export carries `mergedInto` and `mergedFrom` (a data flow soma-internal reads: said in the PR, NEXT_SESSION's table).

## 12. People leads (U5)

*"Every sub-tab of our people tab has the same issue it does not lead the user by design"*; *"Roster section … primitive, despite
having plenty of data to show info in a better way."*

**Each view opens on what to do next and a picture of it**: its verdict card as now (TM4b), its body the picture; and where the work
has an order, a **next-step row** under the toolbar (the day's steps, drawn with Today's `inv-step*` pieces), each step a door.

| View | Next-step row | The picture (the verdict card's body) |
|---|---|---|
| Attendance · Day | In-time roll (*in 9:12* / *due* / *late*) → Marks (*21 of 23*) → Out-time roll (*usually 6:40 PM*) → EXTRA booked | the areas as cards, each its heads against the day's number as a meter (the board as now), the absent strip |
| Attendance · Week | — | the week as a grid, a hand a row and a day a column, each cell its mark's tone (P ok, H warning, A danger, unmarked hatched), over the table |
| Attendance · Month | Import or Start → Fill → Settle the differences → Mark checked | agreement with the days as one 100% bar: agree, differ, only on the register, only on the day |
| Pay | Check the hours (*N to check*) → The payout (*₹N with the snacks*) → Record the payments → Print the slips | the payout against the twelve weeks before, as bars |
| Areas | — | each area's heads against need over the period as small multiples; the extra checked as the verdict |
| Roster | — | the roster as cards (below) |

**The Roster as cards** (`_attRosterView` staff.js:1073): a deck, one card a hand: an avatar of initials, the name, designation,
area and tier; tenure; three bars (reliability, consistency, workload: `pplStats`); the top three skills as chips; a badge only for a
state (*To watch*, *Check-in due*, *Motivation 42* for the owner, *Inactive*); the rate for a role that sees wages. Filter chips: area,
tier, *To watch*, *Check-ins due*. A card opens the hand's record (the pane on the desktop, `_attWorkerPaneHtml` :1195; the sheet on
the phone). Hands who left under *Left*, folded.

**Measured, never longer** (§17 I10): each view's P195 budget holds; a picture that adds height takes it back from what it replaces
(the Week grid replaces the table's first screen; the table folds under it).

## 13. The power case and the reports: a picture first (U6)

*"The report generated for power cut is extremely text heavy for anyone to be interested in solving it. Text heavy should be an
optional copy and our copy, so that we know the entire context."*

- **The picture page** (`powerCasePictureHtml`, power.js, new): one A4 page on paper (its own pt tokens, `inv-pcp-*`; white, as paper
  is): the title and the day it was drawn; four tiles (cuts in the last 12 months, hours dark in working hours, what a year of them
  costs as a range, the best option's payback); cuts by month (bars, the runs possibly unreported hatched); when they start (by hour);
  what a cut costs as one 100% bar (restart, catch-up overtime, lost contribution, idle wages); the three options as cards (one-time,
  coverage, gain a year, payback), the recommendation marked; the open items as three lines. **Every figure is `powerCaseHtml`'s own**
  (`powerAnalysis`, `powerMargin`, the options' arithmetic), no second arithmetic.
- **Power → Case** shows the picture (fitted, `paperFit`), then **Read the full case** (a toggle drawing `powerCaseHtml`, the text as
  now, *our copy*). The action bar: **Print the picture** (one page) and **Print the full case** (the picture, then the text).
- **Reports** the same: `rptPictureHtml(kind, from, to)` (report.js, new): one page of headline tiles (revenue, tonnes, realisation
  against cost, cash), two or three charts by kind (daily by line; weekly by day; monthly by pay week; quarterly and yearly by month)
  and the three things to look at (the period's red and amber tasks while it runs, else its worst figures); then the report as now, its
  appendix. Print: **Print the picture** and **Print the picture and the report**.
- **Charts on paper** are the same builders (§5) inside the paper root, drawn in the series' printed colours, every series labelled
  (paper has no tap).

## 14. Across the app (U7)

### 14a. Lists, dialogs, sheets, toasts and search

- **Lists** (Invoices, Challans, Clients, Parts, the bank statement, and every list-and-pane screen): the list stands in a card on the
  page; **rows keep their heights** (`--row-h`, the density as now); the table's head stays at the card's top; the selected row
  `--accent-soft`, a hovered row `--surface-2`; a day's group head in small capitals `--text-3`; a status alone as a badge with its
  icon (§3d). P80 holds: the page never scrolls on the desktop.
- **Dialogs** (`dialogOpen`, state.js:1268): `--r-card`, the title `--fs-17` semibold, close a ghost icon button, the foot as now
  (sticky, last). **Sheets** (a dialog on the phone, the More and Filter dialogs): top corners `--r-card`, a grabber bar (decorative).
- **Toasts** (`showToast` state.js:1953): a pill with its kind's icon (success `done`, error `cancel`, warning `alert`, info `info`),
  above the phone bar, as now in place and time.
- **Search** (search.js): the input a large well with its icon; results grouped by kind (Screens, Invoices, Clients, Challans, …),
  each row its kind's icon; the keys' hint at its foot.

### 14b. One set of blank states

`uiBlankHtml({kind, icon, title, body, action})` (state.js, new; `inv-blank`, `inv-blank-icon`, `inv-blank-title`, `inv-blank-body`;
`inv-state-*` and `inv-empty-state` are retired names and are not used): **empty** (*No challans waiting* · *Add challan*), **early**
(*Not enough yet: 4 of 10 working days*), **offline** (*Offline: this comes back with a signal*), **notset** (*Set the plant's place*),
**error** (*This could not be drawn*). Every screen's own empty text (a list's *No …*, a chart's `emptyText`) is replaced by it; U7
lists every place it replaced in its report (a census by grep of `emptyText`, *Nothing*, *No * in the renderers).

### 14c. Dark, everywhere

P76's sweep in dark covers every screen, view and dialog (as now), with P180's dark steps (§3g). Each step's screenshots (scratch,
never committed) include dark.

### 14d. First-visit pointers

`uiPointer(id, anchor, text, guideId)` (state.js, new; `inv-pointer*`): a small card pointing at one control, *New: …*, **Read the
guide** (its guide, at the section) and **Got it**. Shown **once a person a device** (localStorage `sep_inv_pointers`), at most one a
screen visit, only once the screen has drawn and the control is in view, never over a form with typed work, a dialog or arrange mode;
off under `navigator.webdriver` unless a fixture turns it on (`pointersOn`). The pointers: Home's **Customise** (*Using the app:
Home*), the gallery's categories, Stats' **Tables** (*Reading Stats*), Stock's **Spend and prices** (*Using the app: stock*), a guided
flow's preview (*Using the app: the Add button*), the Roster's cards (*Using the app: People*), the Case's **Read the full case**
(*Using the app: power cuts*).

## 15. Sign-in and the 4-digit PIN (U8)

### 15a. The screen

The canvas's boards *Sign in, phone*, *Sign in, phone, dark* and *Sign in, desktop* are the reference; `grdLockHtml` (guard.js:445)
and `grdRenderLock` (:475) draw it, in `#guardRoot` as now (siblings inert, `body.inv-locked`).
- **The phone**: the theme toggle (top right); the mark (`markSvg`) in a lifted tile; the company's name (`S.company`) as the eyebrow;
  *Welcome back*; the person's row (initials, name, *role · last in yesterday, 7:12 PM*, **Not you?** opening the IDs as a sheet,
  `grdActiveUsers`); **four PIN wells** (a dot filled per digit); the **keypad** (1–9, *Forgot your PIN?*, 0, ⌫; each key `--r-key`,
  `--lift-1`, 3.5rem tall); **Sign in** (the primary, lifted, enabled at four digits); the foot *This phone is registered · synced
  9:40 AM* (`devRegistered`, the last sync's time). Dark as its board: lifted by surface and edge.
- **The desktop**: a panel on the left (the company and its line, the date, the clock, the weather now, Tata's week, *Book · synced
  9:40 AM*) and the card on the right (*Welcome back*, *Pick your ID, then type your PIN*, the IDs as rows, *PIN for <name>* in four
  wells taking typed digits, Sign in, *Forgot your PIN?* with its hint: the owner *use your recovery code*, anyone else *the owner can
  reset it*), its foot *This computer is registered · it locks after a while away*.
- **Behaviour**: digits by tap or the keyboard (0–9, Backspace, Enter at four); Sign in is not automatic at the fourth digit (a slip
  would spend a try); a wrong PIN marks the wells `--danger`, shakes them (a colour only under reduced motion), and says *Wrong PIN ·
  3 tries left* (the counts as now), then the lockout's countdown; the person picked is remembered (`sep_inv_guard_last`).
- **No figure of the book is drawn before sign-in** (`grdHeld`): no money, no wages, no count; the weather, Tata's week and the time of
  the last sync are not the book's figures.

### 15b. The PIN is four digits

- `grdPinProblem(a, b)` (guard.js:258): exactly four digits (`GRD_PIN_LEN = 4` in place of `GRD_MIN_LEN`); refused as *too easy to
  guess*: one digit four times (0000…9999), a straight run up or down (0123…6789, 9876…3210), 1212, 1004, 2000, 2580 and 6969; the two
  entries alike.
- `grdMakeSecret` (:241) stores `len: 4` beside `digits: true`; Settings' PIN forms (`grdFormOpen`, :887: a new ID, *Change my PIN*,
  the owner's reset) take four wells, the keypad on the phone. The hint at :1208 (*give the owner six or more, or a password*) becomes
  *A PIN stops someone at the screen; the recovery code keeps what is sealed.*
- **A PIN set before** (a secret with no `len: 4`): that person's sign-in shows the typed field as now (*Your PIN is from before:
  type it*); once it is right, **Set a 4-digit PIN** asks (the keypad, twice); *Later* keeps the old one until the next sign-in.
- **At the screen**, wrong PINs are counted per ID as now (five free, then 30 s doubling to 15 minutes): about 96 tries a day at the
  cap, months for the 10,000. A copy of the book is §15c's.

### 15c. What four digits mean for the server

PBKDF2 at 210,000 iterations over 10,000 PINs is seconds on one graphics card. `docs/SERVER.md` §4 wraps the key that seals the
sensitive records *by the owner's PIN* (and by the recovery code as well); with four digits, a copy of the hub or of the office's
SQLite file holding the PIN-wrapped key would open what is sealed. **So the sealing key never travels wrapped by a PIN**: on the hub
and in the office copy it is wrapped by the **recovery code** alone (12 characters of a 31-letter alphabet, about 59 bits, through
PBKDF2), and on each owner device it is kept under a device key that cannot leave the device (a non-extractable AES-GCM key in
IndexedDB, as the GitHub token is kept today), used once the PIN has passed. A new owner device types the recovery code once. U8
amends SERVER.md §4 in those words; nothing of the server is built here.

### 15d. The app's icon, splash and favicon

From `markSvg`: `icon-192.png`, `icon-512.png`, a maskable 512 (the mark inside the middle 80%), `favicon.svg` and a 32 px PNG, the
manifest's `icons` (`purpose: any` and `maskable`), its `background_color` the page's (`#e1e6eb`). Android's splash is the manifest's
icon on its background colour (no splash images). The PNGs are made by a script in the repo (`tools/make-icons.mjs`: the mark drawn
in Playwright's Chromium and screenshotted at each size; no new dependency) and committed; P234 checks the manifest names files that
exist at the sizes it says.

## 16. In step with the server (`docs/SERVER.md`)

*"Make sure that it adheres to our transition to SQL and cloud."* Everything this pass adds to the book is a record the hub can hold,
listed here, and U2 adds each to `CHG_TRACK` (so the merge, and the hub after it, takes it: SERVER.md §4, *a store the merge does not
list is not synced until it is listed*).

| What | Where | Change log | Merge (today, G4) | On the hub (S1) |
|---|---|---|---|---|
| Tata's months | `S.market.tata`, a map by month | yes | record by record, field by field; the owner's change stands | store `market.tata`, id the month |
| The plant's calendar | `S.market.calendar`, a map by day | yes | as above | store `market.calendar`, id the day |
| The models followed | `S.market.models`, a list | yes | one record | store `market.models`, id `-` |
| Weather days | `S.market.weather`, a map by day | **no** (a fetched copy) | **quiet**: this device's, the other filling what it lacks, never held | store `market.weather`, quiet |
| The feeds' settings | `S.feedsCfg` | yes | one record | id `-` |
| A merged stock line | `mergedInto`, `retiredAt` on the line; `mergedFrom` on its entries | yes | as their stores | as their stores |
| The PIN's length | `len` on a user's secret | as the users' store (the secret never compared) | as users | as users; no PIN is sent (SERVER.md §6) |
| A board's layout | the device (`sep_inv_layout`) | — | — | store `prefs`, id the person; the later wins; served to that person only (§7h) |
| The feeds' copy, the pointers seen | the device (`sep_inv_feeds`, `sep_inv_pointers`) | — | — | never |

- **The views (§6) are the typed tables' columns**, so S1 fills them on the hub and a widget reads either.
- **The feeds Worker** (`server/feeds`) is its own Worker; S1's hub goes in `server/hub` and may fold the feeds' routes into itself
  later (one deploy). SERVER.md §9 S1 is amended to say `server/hub`.
- **The sealing key** (§15c): SERVER.md §4 amended in U8.
- **Start-up writes no clock** (SERVER.md §4): the palette default, the layout's move and the pointers are device keys; nothing this
  pass runs at start-up writes a time into the book.
- A spec (P226) asserts every path above is in `CHG_TRACK` (with `quiet` on the weather), and a sweep of every request body P225 makes
  finds nothing of the book in what goes to the feeds Worker.

## 17. Invariants (every step, every builder)

TAB_MAP's I1–I11 hold, with these words for this pass:
- **I1. The book changes only as §16 lists.** No record is rewritten by a migration. The device keys may change as each step says.
- **I2. Every old address still opens** where its screen went, through `navRedirect` (§18): a bookmark, the manifest's shortcut, the
  Windows widget's launch, a trail step an older build saved, a new window, a guide's link, a search's Recent, a task's saved `go`.
- **I3. No dangling door.** A step that moves a place re-points every door to it in the same step (`todoGo`, `advGoTo`, `WS_GO_PAGE`,
  the search index, quick actions, Add's routes, finlinks.js, report links, the guides' text **and** their next `version`). Each step's
  grep checklist (§19) comes back empty: for U2 `invGoPulse` outside its alias, `v: 'pulse'`, `'pulse'` as a view, `#homePulse`,
  `#homeWidgets`, `HOME_WIDGETS`, `homeEditHtml`, *Edit Home*, *Pulse* in a string a person reads, `Today` as a page's name; for U1
  `--chart-`, `--shadow-tile`, an `<svg` with a path outside the drawings §4 names.
- **I4. Roles.** A widget, a door, a link or a count shows a role only what its screens show (§7g); a widget's head is text for a role
  that cannot follow it; nothing of the book before sign-in (§15a).
- **I5. The house rules**: HR-1…HR-9, DR-1…DR-8 as §3f amends them, one primary a view, no browser pop-up (`uiConfirm`, `uiAlert`,
  `uiPrompt`), a `<select>` speaks through `change`, a change inside a view redraws in `keepScroll`, `escHtml` on every string a person
  or a feed wrote (**a headline is untrusted text**: escaped, its link `rel="noopener noreferrer"`, `target="_blank"`, `https:` or
  `http:` only), every new top-level name grepped across `split/*.js` first.
- **I6. Tests.** None deleted, skipped or weakened. A test of something that moved is rewritten to assert the same fact where it lives
  (§21). Each step's new spec fails on the build before the step. The full suite is green at the end of each step.
- **I7. Both layouts and both themes** for every change.
- **I8. One fact, one screen.** A widget draws its screen's figure with its screen's function and links to it; it is never a second
  arithmetic.
- **I9. Build and commit** as CLAUDE.md says; no model name anywhere.
- **I10. Measured, never longer.** P195 measures every screen; a step lowers its screens' budgets to its measure and never raises one.
  **Home's dashboard** is new: its budget is set at U2's measure with the Owner preset on the long book, and may not exceed Pulse's 4
  phone screens.
- **I11. One look.** Home's dashboard joins `ONE_LOOK` as an overview; Stats' two views (U3) as work screens; P197 holds them.
- **I12. Paper does not move.** P228 records the computed style of every element under each paper root (the invoice, the test
  certificate, the credit note, the sales register, the quotation, the statement, the pay slip, the attendance and stock sheets, the
  ID cards) on the build before U1 and fails on any difference after any step.
- **I13. A feed never breaks a screen.** Every feed widget, and the day card's weather, draws whole with the feed missing, slow (a
  timeout of 8 s), failing, offline or answering nonsense (P225).

## 18. The redirect table

`navRedirect` (nav.js:119), one row per removed place, added in the step that removes it:

| Step | Old address | Opens |
|---|---|---|
| U2 | `pageHome` · `pulse` | `pageHome` · `home` |
| U3 | `pageStats` · `clients` | `pageStats` · `tables/client` |
| U3 | `pageStats` · `cost` | `pageStats` · `tables/cost` |
| U3 | `pageStats` · `trends` | `pageStats` · `board` |
| U4 | Stock's Spend and prices fold (the phone) | `pageStock` · `spend` |

The remembered keys follow the same rows: `sep_inv_stats_tab` (`clients`, `cost`, `trends`), `sep_inv_ws_last` (`pageHome/pulse`), and
`todoGo` / `advGoTo` map a saved task's old values (`{kind: 'stats', tab: 'clients'}` and the rest) the same way.

## 19. The steps

Each step: measure its screens first (P195 on the long book, P197's census; the owner's book in the scratchpad's harness where it is
there, never committed); build; run its spec and every spec §21 lists for it; the full suite; measure again and lower the budgets;
commit with what moved and why; report (files, specs added and rewritten with counts, the suite's result, the measures before → after,
the grep checklist's output, anything decided differently and why).

### U1 — Foundations

1. **The census first** (its own commit): P197's `census()` writes `well` for an inset-only shadow (§3g); `LOOKS` re-recorded on the
   build as it is; P228's paper record taken (I12).
2. **Tokens** (styles.css's block): `--c-well`, `--c-edge` per palette; Zinc & brass the default (`:root`, head.html's first paint,
   appearance.js); `--lift-1`, `--lift-2`, `--press-1`, `--press-2`; `--r-card`, `--r-tile`, `--r-ctl`, `--r-key`; `--fs-28`,
   `--fs-36`, `--fs-48`; `--ok-mark` and the three others; `--series-1…6`, `--series-other`, `--seq-1…7`; `--shadow-tile` and
   `--chart-*` removed, every rule reading them moved (§3b).
3. **The components to the look** (§3b), dark per §3c; the switch `.inv-switch`.
4. **Icons v3** (§4): `ICONS` redrawn and extended, the two inks, `markSvg`, `iconFill` and body.html's slots, the licences.
5. **Charts** (§5): the eight builders, `chartFit`, `seriesSlot`, the table behind every chart, the readout on every builder.
6. **The blank states** (`uiBlankHtml`, §14b), used by charts' empty case first.
7. **The data layer** (§6): `dataview.js`, the views of the table.
8. **The design doc** amended (§3f), `LOOKS` regenerated and §6.28's table rewritten; CLAUDE.md's class count, module list, concat
   order and the new rules.
9. **Specs**: P226, P227, P228 new; P180, P182, P197 and the default palette's specs rewritten (§21).
- **Grep checklist**: `--chart-` and `--shadow-tile` (none); `<svg` with `d=` in a module §4 does not name (none); `iconSvg('` names
  not in `ICONS` (none).

### U2 — Home and its widgets

1. **The workspace and the names** (§8a); the redirect (§18); `invGoHome`.
2. **`widgets.js`**: the card, the board (`.inv-wgrid`, the columns, the spans, the caps), the states, arranging (drag, keys, size,
   remove, reset), the gallery, the presets, the layout store and its move from `sep_inv_home` (§7a–§7h).
3. **`widgetcards.js`**: every widget §7d marks U2, each reading what it names.
4. **The day card** (§8b), the clock; the board's toolbar; Pulse's parts as widgets (§8c); Needs you unchanged but for the look.
5. **The feeds**: `server/feeds` (the Worker and its tests, the CI job), `feeds.js` (the client, Settings → Connections → News and
   weather), `S.market` (Tata's months, the calendar, the models, the weather days) with `CHG_TRACK`, the merge's quiet store, the
   Tata dialog, `mktTata`.
6. **Guides**: *Using the app: Home* (v5), *Setting up: the news and weather* (new).
7. **Specs**: P223, P224, P225 new; the fixtures (`openPulse`, `openWidget`, `withWidgets`) and every spec §21 lists for U2
   rewritten; P195's and P197's names (*Today* → *Home*) and Home's budget.
- **Grep checklist**: §17 I3's U2 list.
- **Then stop.** The owner looks at Home and the gallery on the phone and the desktop, light and dark: screenshots on the long book in
  an artifact (as the photo reading's comparison was), and the build's own page once merged or from the branch.

### U3 — Stats (§10)

The two views, Stats' verdict, its board and preset (`pricecost` added), the Tables and their export, the redirects; the U3 widgets
(`share`, `labour`, `months`, `trend`, `topitems`, `costcheck`, `pricecost`) into the gallery. P229 new; the Stats specs rewritten.

### U4 — Stock and every Enter by hand (§11)

`uiFlowHtml` and the forms of §11a's table, Mine in the look, Spend and prices' room (§11b), the line merge and `stockTwins` (§11c).
P230 new; the forms' specs kept green unchanged (their ids hold), the Stock specs that read the Spend fold rewritten.

### U5 — People (§12)

The next-step rows, the pictures, the Roster's cards. P231 new; the People specs that read the Roster's rows rewritten to its cards.

### U6 — The power case and the reports (§13)

`powerCasePictureHtml`, `rptPictureHtml`, the toggles and the two prints. P232 new.

### U7 — Across the app (§14)

Lists, dialogs, sheets, toasts and search in the look; `uiBlankHtml` everywhere (its census in the report); dark checked; the
pointers; the Planner, History and Knowledge in the look. P233 new.

### U8 — Sign-in (§15)

The screen on both layouts, the keypad, the 4-digit PIN and its rules, the old PINs' path, the hint; SERVER.md §4's amendment; the
icon, splash and favicon (`tools/make-icons.mjs`). P234 new; the guard specs (p140-guard*, p146-guard-paths, p152-guard-qa,
p142-devices*) rewritten to four digits where they set a PIN (their facts held).

### U9 — Docs, measures, the PR made ready

CLAUDE.md (the modules, the order, the rules, the test count), the design doc, NEXT_SESSION (the data flows: `sep-stock`'s merge
fields; nothing else crosses to soma-internal), the guides' versions; every screen measured (P195 on the long book; the owner's book
in the scratchpad's harness) with before → after; the full suite; then the QA chain on the owner's word.

## 20. Specs to add

| Spec | Step | What it holds |
|---|---|---|
| P223 `p223-home-board` (phone and desktop) | U2 | the door named Home and its row; `v=home` the default and `pulse` redirected; the day card (greeting, clock ticking on the minute under `page.clock`, the shift, the sentence and its tone, the two links by role); the board's columns and spans at 393, 1024 and 1280 px; arranging: drag (mouse and touch), keys, size, remove and Undo, Reset asking; the gallery: categories, live previews, add and remove, nothing a role may not see; presets by role; the layout per person and per layout, its move from `sep_inv_home`, nothing of it in a backup, a push or the change log; Home's draw within 1.5 s on the long book |
| P224 `p224-widget-sweep` | U2 | §7i: every widget × size × layout × theme × three books, then every preset and three seeded random arrangements |
| P225 `p225-feeds` | U2 | the Worker faked (`page.route`): news, weather, stale, slow, failing, offline, nonsense; the copy on the device and its age; Settings' Check; the Tata dialog (a month typed, a headline's figure offered, the calendar's offer), `mktTata`; the weather days written quietly; nothing of the book in a request |
| P226 `p226-data-layer` | U1 | §6's columns and types, nulls, the sums against the screens; §16's paths in `CHG_TRACK` |
| P227 `p227-charts-v3` | U1 | §5's builders, the table behind each, the readout, the series by slot |
| P228 `p228-the-look` | U1 | §3g's look, §4's icons and licences, I12's paper record |
| P229 `p229-stats-board` | U3 | §10 |
| P230 `p230-guided-entry` | U4 | §11a's flows (steps, next, the preview's words and checks, the receipt), §11b's room, §11c's merge |
| P231 `p231-people-leads` | U5 | §12 |
| P232 `p232-pictures` | U6 | §13: the picture pages' figures equal the full documents', one A4 page each under print media, the toggles |
| P233 `p233-across` | U7 | §14 |
| P234 `p234-sign-in` | U8 | §15: the keypad and typed digits, the rules, the old PIN's path, the counts and lockout, nothing of the book before sign-in, the manifest's icons |
| `server/feeds/test` (vitest) | U2 | §9a |

## 21. Existing specs the steps rewrite (not weaken)

From the survey of 16 Oct 2026 (the fixtures and the 76 files that open Pulse or read Today):
- **U1**: p182-shell-tiles (a tile in a card is a well, a card lifts: §3g); p180-no-white (the palette checks extended; the boxes in
  Needs you's cards as now); p197's `LOOKS`; p53-appearance and .desktop, and any spec asserting Teal as the default; any spec reading a
  `--chart-*` colour.
- **U2**: fixtures.ts (`openPulse` :233 → Home's dashboard; `openWidget` :242; `withHomeWidgets` :250 → `withWidgets`; `WS_OF`
  :189–195 unchanged, the id is `today`); sweep-fixture.ts (`PAGES` :363 and `walkPages` :379–384: *pageHome › Pulse* → *pageHome ›
  Home*); load-fixture.ts (`ONE_LOOK` :368–390 and every name *Today › …* → *Home › …*); p195 (`LOAD_BUDGET` :23–92 and `VERDICT`
  :95–112 renamed; Home's budget added); p121-home-widgets (Edit Home → arranging, presets → role presets); p135-today; p178-today-
  cards (and .desktop); p180-no-white :132 (Pulse's widgets → widgets on the board, still coded); p184-tab-map (and .desktop: the
  row's views); p185-today-map (and .desktop); p211-qa-shell-today; p134-workspaces (and .desktop: the door's word); p183-insights-in-
  sight (and .desktop); p147-desktop-layouts.desktop (Home's widgets three across → the board's columns); p3-home-empty-state;
  p64-finance-links; p88-prod-links; p120-stats-stories; p128-qa-intel; p129-qa-platform; p133-what-to-do (and .desktop); p152-guard-qa;
  p153-qa-step7 (and .desktop); p159-why; p194-load-across (and .desktop); p210-rulings. Each asserts the same fact where it now lives.
- **U3**: the Stats specs (p47-stats-intel, p73-stats and .desktop, p105-stats-fold, p120-stats-stories, p185-today-map's Stats half,
  p194-load-across's) to the board and the tables.
- **U4**: the specs reading Stock's Spend and prices fold (p65-overviews, p99-zinc-trend, p188-floor-map and .desktop); the forms'
  specs stay as they are.
- **U5**: the specs that read the Roster's rows (the survey's grep: p107-workforce-fold, p124-qa-floor, p147-desktop-layouts and
  .desktop, p169-idcards, p170-checkin, p171-workers-qa, p172-cards-skills, p188-floor-map, p211-qa-shell-today; each read again when
  U5 starts) to its cards.
- **U8**: the guard and device specs where they set a PIN.

## 22. Risks

1. **The look touches every screen at once (U1).** P76 (every screen, view and dialog, both layouts and themes), P197's census before
   and after, P180, P182 and the paper record (I12) are the net; the step's report carries screenshots of every screen (scratch).
2. **A drag fights the scroll and the swipe on a phone.** The handle alone drags, after a 250 ms hold; swiping is off while arranging;
   the keys move a widget too.
3. **The sweep is large** (about 45 widgets × their sizes × 2 layouts × 2 themes × 3 books). It draws all the widgets of one size on
   one board in one page load and measures them in one `evaluate` (about 36 loads in all); if it still runs long, it splits by
   section, never by dropping a case.
4. **A feed changes or refuses Cloudflare.** The widgets and the day card draw whole without it (I13); the Worker's tests pin the
   shapes; Settings' Check names what failed.
5. **Tata's figures lag** when nobody types them: `mktTata` reminds; a headline's figure is offered.
6. **Four digits** are weak against a copy: §15c moves the one thing that relied on a PIN as a key; at the screen the counts hold.
7. **A screen grows** with the larger radii: the spacing tokens (`--pad-x`, `--pad-y`, `--gap`) do not change; a screen that grows
   is put right in the same step (I10).
8. **Home is slow** with thirteen widgets each reading the book: the views cache once a book; P223 bounds the draw on the long book;
   the step reports the owner's book's time.
9. **The icons' licence**: both notices in the build (P228).

## 23. Builder protocol

1. Work on the branch given, one step at a time, in order; read §1–§6, §16–§18 and the step's section, and the files named before
   editing them.
2. Grep every new top-level name across `split/*.js` before adding it (the prefixes this pass takes: `wdg`, `dv`, `feed`, `mkt`,
   `uiFlow`, `uiBlank`, `uiPointer`, `markSvg`, `iconFill`, `chartFit`, `seriesSlot`, `homeDay`, `homeClock`; the classes:
   `inv-widget*`, `inv-wgrid*`, `inv-gallery*`, `inv-switch*`, `inv-blank*`, `inv-flow*`, `inv-pointer*`, `inv-keypad*`, `inv-pinbox*`,
   `inv-pcp-*`, `inv-mkt-*`, `inv-wx-*`, `inv-ico-*`, none of them a retired prefix in P76's `V1_PREFIX`).
3. Measure before; build; the step's specs, the rewritten ones, the full suite (about 27 minutes on CI, longer locally: not a hang);
   measure after; lower the budgets.
4. Commit each step with what moved and why and the trailers CLAUDE.md gives; no model name.
5. Never: delete or skip a test; raise a budget; write the owner's data, a worker's or a supplier's name into the repo; call a browser
   pop-up; add an inline style; change paper; change the book beyond §16.
