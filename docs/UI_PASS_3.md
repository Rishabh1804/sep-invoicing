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
the owner to look** (§1a-1), **and a second after U2R**, the card family the owner asked for at the first (§24, 17 Oct 2026); then the
QA chain on the owner's word. Read §1–§6 and §16–§18 before any step, then the step's own
section. It sits on `docs/TAB_MAP.md` (one look: four kinds of screen, the verdict card, one toolbar row) and changes none of its
rules except where §3f says so. It is written to `docs/SERVER.md`: everything it adds to the book is a record the hub can hold, every
widget reads through views shaped like the hub's typed tables (§6), and the one place the server plan had to change is said (§16).

## 0. Status

| Step | What | State |
|---|---|---|
| U1 | Foundations: the look's tokens (lift, wells, radii, dark elevation), the default palette, icons v3, the chart builders and the table behind every chart, the blank states, the data layer (§3–§6) | Built, 16 Oct 2026 (P226, P227, P228) |
| U2 | Home and its widgets: the door renamed, the day card with its clock and weather, Pulse folded in, the widget grid, sizes, arranging, the gallery, presets by role; the feeds Worker and its client; Tata's figures and the plant's calendar (§7–§9) | Built, 16 Oct 2026 (P223, P224, P225): every widget §7d marks U2; the Worker is the owner's to deploy (§9e) |
| ⏸ | **Stop: the owner looks** at Home and the gallery on the phone and the desktop, in both themes (§1a-1) | Looked, 17 Oct 2026: *"looking for a more finished product"*; the card family drawn on a canvas and approved (*"Write the spec"*) |
| U2R | The card family on Home: one skeleton, seven card types, five action rows; quiet cards (salience follows severity); figures in Geist; money short on a board; fixed heights, the board packed; the masthead; the presets that pack (§24) | Specified, 17 Oct 2026; built, 20 Oct 2026 (P235–P239; design §6.33–§6.36): every widget in its type, the grep checklist empty |
| ⏸ | **Stop: the owner looks** at the card family on Home, both layouts and themes, and answers §1a's calls 13–20 | |
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
10. **A card family, organised** (17 Oct 2026, after U2's stop): *"looking for a more finished product"*, and *"different types of
    card layouts but organised, so maybe a financial card layout looks and feels different than an industrial one. Same for anything
    that we are putting under one label, like the action rows."* One skeleton, seven card types, five action rows, drawn on a canvas
    (*"Go"*) and answered *"Write the spec"*, which this spec takes as the canvas approved with its four calls as proposed (§24a).

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

**Calls the card family makes (§24), for the owner at U2R's stop.** Each is where the spec departs from the canvas or goes past it:
13. **The presets are redrawn so each packs with no hole for its role** (§24i): U2's Office preset held four widgets the office role
    cannot see by default (Month to date, Owed and Days to pay need money; Turnaround needs Production), so it drew with holes; it now
    holds what the role sees. The supervisor gets a preset of its own (it shared the Floor's, whose pages it outnumbers), and the
    Owner's gains *Attendance* at Small, as the canvas drew it.
14. **The phone's Owner preset leaves out Do first** if Home measures over four phone screens (I10's cap for Home). By the canvas's own
    heights the Owner's phone Home is about 4.4 screens with it and 3.9 without; each question's card carries the same moves.
    *As built (20 Oct 2026):* with Do first alone left out Home measured **4.17** phone screens on the long book, still over the cap,
    so the phone's Owner preset leaves out **Turnaround** and **Days to pay** as well (both slow to move, each a tap away on Floor's
    Overview and Money → Receivables): **3.92**. The owner may prefer another pair left out, or Home's cap raised for the phone.
15. **A chart in a card is bare**: no readout line and no *Table* button (the canvas drew none). The table is on the screen behind,
    which the card's head opens, and the card's verdict says what the chart shows.
16. **The recent invoices keep their Print at each row's end**, which the canvas did not draw: four taps to print a recent invoice was
    the owner's complaint of 6 Oct 2026.
17. **A feed's credit stays a link in its Source** (*The GDELT Project*, *MET Norway*), where the canvas wrote the name plain: GDELT's
    data is free for commercial use with a citation and a link (§1a-7). It is the one link a Source holds besides Refresh.
18. **Every rate keeps its paise**, zinc's included (₹392.40 a kilo), where the canvas wrote zinc's whole: a rate is not an amount.
19. **Quick actions' *Started here and not saved* shows the forms the app holds this session**: Create's invoice form, which the app
    keeps as typed when it is left. No form is kept across a reload today, and a challan's typed work is dropped when it is left (after
    asking), so the canvas's *a challan typed yesterday* is not built. Keeping drafts is a separate change, the owner's to ask for.
20. **Every other hero and verdict card keeps its wash until U7** (§14a), which gives them the board's rule (§24c), so the app ends with
    one rule for a card's tone.

## 2. What changes, screen by screen

| Screen | Step | What happens |
|---|---|---|
| The shell (bars, rail, top bar, tab rows) | U1, U2, U2R | the look; icons v3; the door named Home; the card's corners (U2R) |
| Home (was Today: Needs you, Pulse) | U2, U2R | the dashboard view (`home`), the day card, the widget grid; Pulse folded in; Needs you in the look; the card family, the masthead (U2R) |
| Every screen's figures | U2R | Geist with tabular figures in place of Geist Mono; identifiers stay mono (§24l) |
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

**U2R takes the corners down** (the card family, §24b; owner, 17 Oct 2026: *"It should look crisp"*): `--r-card` 0.875rem (14 px),
`--r-tile` 0.625rem (10 px) for every well (a tile, a field, the search, a segmented control's track, a PIN box), `--r-ctl` 0.5rem
(8 px) for a button and a menu, `--r-seg` 0.4375rem (7 px), and the phone's bar its own `--r-bar` 1.375rem (22 px).

**Type**: Geist and Geist Mono as now (`head.html:18`; `sw.js`'s `FONT_CSS` repeats the URL). Three sizes are added for the
dashboard's figures, on the scale: `--fs-28: 1.75rem` (a widget's figure, M and L), `--fs-36: 2.25rem` (the day card's clock on the
phone) and `--fs-48: 3rem` (the clock on the desktop). A figure is Geist Mono, tabular, as now (DR-4). **From U2R a figure is Geist
with tabular figures and only an identifier Geist Mono** (DR-4 amended, §24l); a Small's figure takes `--fs-26`, and the masthead's
clock `--fs-44` on the desktop and `--fs-30` on the phone, which retire `--fs-36` and `--fs-48` (§24j).

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
| Toast `.inv-toast` (:1918) | as now | a pill on one line (`--r-toast`, half a line's height), built in U1: as wide as its words up to the room, and a toast that wraps keeps every word inside its fill (U1 first drew it `--r-full`, and a wrapped toast put its first and last words on the page, light on light; P228); its fill and its kind's icon arrive together in §14 (U7), so the toast keeps its inverted, high-contrast fill until its icon can carry the kind |
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
- **On a board, from U2R, salience follows severity instead** (call 1, §24c): a card is quiet while all is well, amber adds a 3 px top
  edge, red adds the edge and a tint; nothing is washed. Every other hero and verdict card takes the same rule in U7 (§14a).
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
- **In U2R** (§24): **DR-4** becomes *a figure is Geist with tabular figures, right-aligned in a column or a tile; an identifier is
  Geist Mono*; **DR-6** adds a key on a tray, lifted by `--lift-key`; **DR-8**'s card clause becomes *a card says its tone with its
  lamp and words and, from amber, its top edge; the tone's icon stays on a status badge and a notice*; §3.3's *Fills* and §3.6's radii
  follow, §6.33 is rewritten to the family, and §6.34 (card types), §6.35 (action rows) and §6.36 (the masthead) are new.

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
- **Amended by U2R** (§24g): an entry names its `type` and its Small title (`short`), and may have a `choose`, an `actRow` and a
  `source`; `foot` is retired; the card is no longer an `inv-hero`; its figures are Geist with tabular figures (§24l) and its money
  short (§24k).

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
  to the list's screen. The sweep (§7i) fails on any widget over its cap. *As built (U2):* past its cap a widget first lets go of the
  parts it can do without, all together (a tile's line of the months before; a part marked `data-wdg-opt`), then its last rows, and
  says *N more: Show all* (`wdgFit`); a crore month or a long story never cuts a card.
- **Amended by U2R** (call 4, §24h): a card is exactly its size's height (a Small one row of `--wdg-row`, a Medium and a Large two, the
  phone's Large three), the board packs dense (`grid-auto-flow: row dense`) with the DOM in the layout's order, the caps and the
  masonry leave the board, and the fit works against the card's height.

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
functions behind it; every figure is its screen's. **Each widget's type, Small title, Choose, Act and Source are §24f's** (U2R). As
built, every question widget needs money (`needs.money`), where this table writes *anyone*.

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
| `q-smooth` | Is the plant running smoothly? | m s l | anyone | the answer's vital (figure, word, sparkline or meter) · + its story · + *What you can do*, three moves (as built: every move a card, the fit keeping what the card holds; where the moves need the room, the vital's line and the story give way, as on the phone's Large, which has Medium's room; the head opens the whole story and every move) |
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
- **From U2R, arranging turns the board's packing off** (§24h): each card stands where its order puts it, and a hole is a slot (*Room
  for a Small*, **Add here**) that the gallery fills at that place in the order.

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
- *As built (U2):* every preview is one height, drawn or not (`--wdg-cap-s`). Drawn to its content, a preview grew from 48 to
  160 px as it came into view, the cards under it jumped while scrolling, and a tap on Add could land on the card that moved
  there. A chip, a board, an Add or a Remove swaps the gallery's parts inside the dialog (`wdgGalleryRedraw`). Replaced whole
  (`dialogOpen`'s `replace`), the sheet slid up again at every tap and every preview in sight flashed blank. The focus goes to
  the card's other button. Five other dialogs still redraw by replacing (the credit note, the guard's form, the planner's card,
  the quotation): U7's (§14a).

### 7g. Presets by role

A board starts from its role's preset; any change makes it the person's own (`preset: 'custom'`), and **Reset** returns to the preset.

| Preset (role) | Home, in order (size on the desktop) | The phone |
|---|---|---|
| Owner (owner; the guard off) | `mtd` s · `q-money` s · `prodday` s · `cash` s · `pace` m · `coming` m · `tata` l · `floornow` m · `risk` s · `turn` s · `dtp` s · `q-smooth` m · `dofirst` m | the same order; Small stays Small, the rest Medium |
| Office (office) | `needs` m · `mtd` s · `unbilled` s · `owed` s · `dtp` s · `pipe` m · `recent` m · `turn` s · `quote` s · `tata` m | as the desktop's order |
| Floor (supervisor, floor) | `floornow` l · `prodday` s · `atttoday` s · `risk` s · `weather` s · `eff` m · `stockdays` m · `attweek` m · `ot` m · `tata` m | as the desktop's order |

A preset lists only what its role may see; a widget a role cannot see is left out when the preset is drawn, never shown empty. The
Stats board's preset is U3's (§10). **U2R redraws the presets** (§24i): four (a Supervisor's of its own), each packing with no hole
for its role's default pages, the Owner's with *Attendance* at Small.

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
(`homeDayCardHtml`, today.js), drawn with `uiVerdictHtml` (its `screen` the greeting and the date, its `fig` the clock). **From U2R the
day card is the masthead** (§24j): the same parts and the same rules, drawn flat on the page, never folded, its links the Act.

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

### 9f. As built (`split/feeds.js`, P225), where it says more than the above

- **Who asks**: the functions are the widgets'; `feedEnsure()` is called by whoever draws Home (the board, the day card), not by
  `feeds.js`. A copy landing is a `sep-feeds` event on `document`, for a board to redraw its feed widgets.
- **The minute between asks is kept on the device** (`tried` in `sep_inv_feeds`), so a reload does not ask again. An ask not answered
  in 8 s is dropped as slow. A copy asked for another place is not this plant's weather and is never shown.
- **Under test the feeds stay quiet** (`navigator.webdriver`, as `errors.js`) unless a spec sets `window.__sepFeedsOn`.
- **The place** is the feeds' own where typed, else the Office QR's, read when asked and never copied into the book: Settings' Save
  stores none while its fields still hold the QR's place, so a place moved on the QR is followed.
- **§7c's states gain `loading`** (the first copy on its way). A feed never reached from this device whose ask failed is `notset`,
  *not set up yet*, with the guide's door; once a copy has landed, a failure keeps it, shown with `failed` (why). Every blank carries
  its door as `action` (Settings for an ID that may change them, else the guide). The guide is every role's, since any widget links it.
- **A weather day is the widest of the day's forecasts** (the highest high, the lowest low, the most rain, thunder if any said so): a
  fetch at 6 PM covers only the hours left. Its save is quiet twice over: written to the device without the change log's pass and
  without arming the GitHub push, so a forecast refetched every half hour is not a push each time; the next save of a change carries it.
- **The models followed are one record in the change log too** (§16's merge and hub): compared as their list joined
  (*Tata Motors → the models followed: models Prima, Signa … → …*). A Tata month's and a calendar day's `at` and `by` are their
  stamp: never compared (`omit`), and never a conflict in the merge (`mrgQuiet` on the spec), so two devices typing one month hold
  only a figure that differs.
- **The Tata dialog's writes are the settings permission's** (`grdGate('settings')`); any ID reads it. It opens from Settings' section,
  the rule's task and (the widget's builder) the `tata` widget's head; Settings' on and off is a tick box, under Settings' own Save.

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

- **Every hero and verdict card takes the board's rule for its tone** (call 1, §24c; built on the boards in U2R): quiet while all is
  well, a 3 px top edge from amber, the edge and the red tint for red; the 160° wash of §3d goes. A tile in it that names a tone stays
  a well of that tone, a card in a deck keeps its tone's left rule, and the card's corners, figures and money are already U2R's.
- **Lists** (Invoices, Challans, Clients, Parts, the bank statement, and every list-and-pane screen): the list stands in a card on the
  page; **rows keep their heights** (`--row-h`, the density as now); the table's head stays at the card's top; the selected row
  `--accent-soft`, a hovered row `--surface-2`; a day's group head in small capitals `--text-3`; a status alone as a badge with its
  icon (§3d). P80 holds: the page never scrolls on the desktop.
- **Dialogs** (`dialogOpen`, state.js:1268): `--r-card`, the title `--fs-17` semibold, close a ghost icon button, the foot as now
  (sticky, last). **Sheets** (a dialog on the phone, the More and Filter dialogs): top corners `--r-card`, a grabber bar (decorative).
  **A dialog drawn again in place does not slide in again** (found building U2's gallery): `dialogOpen`'s `replace` writes a new
  `.inv-dialog`, whose entrance replays at every redraw. Five dialogs redraw that way: the credit note (two), the guard's form, the
  planner's card and the quotation. Each swaps its parts inside the dialog that is open, as the gallery does (`wdgGalleryRedraw`),
  or `replace` marks the new dialog so it does not animate.
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
| A widget's Choose (U2R) | the layout's `opts.<id>.choose`, on the device | — | — | with the layout, in the person's `prefs` (§24n) |
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
  phone screens. U2R's fixed heights may lengthen it: the phone's Owner preset then leaves out Do first (§24i, §1a-14), and Home's
  budget is set at U2R's measure, never over 4. *As built:* Do first, Turnaround and Days to pay left out, 3.92 (§1a-14).
- **I11. One look.** Home's dashboard joins `ONE_LOOK` as an overview; Stats' two views (U3) as work screens; P197 holds them.
- **I12. Paper does not move.** P228 records the computed style of every element under each paper root (the invoice, the test
  certificate, the credit note, the sales register, the quotation, the statement, the pay slip, the attendance and stock sheets, the
  ID cards) on the build before U1 and fails on any difference after any step.
- **I13. A feed never breaks a screen.** Every feed widget, and the day card's weather, draws whole with the feed missing, slow (a
  timeout of 8 s), failing, offline or answering nonsense (P225).
- **I14. One skeleton, five rows** (U2R). Every card on a board is drawn by the framework in one order (head, figure, verdict, body,
  More, Act, Source); everything a person can press in it is one of the five action rows or an item's own (§24e); a widget draws its
  type's parts through the framework's builders, never markup of its own (P235, P236).
- **I15. Money on a board is short and exact underneath** (U2R): every amount a widget draws is `inrCard`'s with the exact figure as
  its `title`; a Ledger's lines are whole rupees and add up to the total ruled under them; a rate keeps its paise (P238).

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

### U2R — The card family (§24)

1. **Geist under test first** (its own commit, §24m): the fonts and their licence in `tests/fixtures/fonts/`, routed in the fixtures;
   the suite run on it before anything else moves. A spec that moves with the real face is read and rewritten to the same fact in
   Geist, never loosened; the commit says which and why. *As built:* the routes were later replaced by the test server serving the
   app's pages with the stylesheet named as `tests/fixtures/fonts/fonts.css` (`tests/e2e/server.mjs`), so no request is intercepted
   and a second window draws in Geist too. A rare stall had been put down to the routes (about one test in a thousand timed out,
   ending in *Object with guid response@… was not bound*); it came back without them, so it was not theirs (CLAUDE.md, *Tests*).
2. **Tokens** (styles.css's block): the corners (`--r-card`, `--r-tile`, `--r-ctl`, `--r-seg`) and `--r-bar`, the wells moved from
   `--r-ctl` to `--r-tile` (the segmented track, the search, a field, the weather's hours, the market's days); the type surfaces per
   palette (`--c-ty-ledger`, `--c-ty-plant`, aliases `--ty-ledger`, `--ty-plant`); `--card-danger`; `--tone-edge`; `--wdg-row`,
   `--wdg-gap`, `--wdg-pad-sm`, `--wdg-head-h`; `--ff-num`; `--fs-26`, `--fs-30`, `--fs-44`; `--lift-key`; `--mast-h`. Retired:
   `--wdg-cap-s`, `-m`, `-l`, `-phone`, `--fs-36`, `--fs-48`. And a fix found writing §24: `head.html`'s first paint falls back to Teal
   when storage throws (`catch(e){…palette="teal"}`); the default is Zinc & brass.
3. **Figures in Geist** (§24l), app-wide: every figure rule reads `--ff-num`; the identifiers keep `--ff-mono` and take `slashed-zero`.
4. **`inrCard`** and `inrFigHtml` (§24k), with their cases.
5. **The framework** (§24g, §24h): the card off `inv-hero`; the skeleton, its head and the Choose; the five rows (`wdgActHtml`,
   `wdgSourceHtml`, `wdgChooseHtml`, `wdgFit`'s More); the type builders; the move dialog (`advMoveOpen`, advice.js); `wdgPlace`, the
   board's rows and dense packing, Customise's slots and *Add here*; `wdgFromHero`'s Source; a chart's `opts.bare` (charts.js).
6. **The widgets** (§24f), each in its type with its short title, Choose, Act and Source; the old feet and second doors gone.
7. **The masthead** (§24j): `homeMastHtml`, the tick, the shift before, during and after.
8. **The presets** (§24i): four, each packing with no hole; the phone's Owner without Do first if Home measures over four screens.
9. **Specs** (§20): P235–P239 new; the rewrites (§21); P195 and P197 measured, Home's budget set (I10), `LOOKS` regenerated; the guide
   *Using the app: Home*, version 6 (the five rows, the Choose, Customise's slots, the masthead).
10. **Docs**: the design doc (§3f's U2R list: DR-4, DR-6's key, DR-8, §3.3, §3.4, §3.6, §5.4, §6.3, §6.17, §6.28, §6.33 rewritten,
    §6.34–§6.36 new, §10's decisions); CLAUDE.md (the class count, the modules' lines, the card family's section); this file's status.
- **Grep checklist**: `inv-hero` on a widget's card; `inv-widget-chip`, `inv-widget-credit`, `inv-homeday-`, `homeDayCardHtml`,
  `wdgHeroFoot`, `wcFeedFoot`, `foot:` in `WIDGET_DEFS`; `--wdg-cap-`, `--fs-36`, `--fs-48`; `inv-btn-secondary`, `inv-btn-ghost` and
  `inv-chip` in a card's markup in widgetcards.js; `formatCurrency(` in widgetcards.js outside a `title`; `--ff-mono` on a figure's rule.
  Each comes back empty.
- **Then stop.** The owner looks at Home on the long book, both layouts and both themes, beside the canvas (screenshots in an
  artifact), and answers §1a's calls 13–20. U3 waits on their word.

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
| P235 `p235-card-family` (phone and desktop) | U2R | §24b–§24d: the skeleton on every widget at every size (the head 44 px, `--r-card` 14 px, the sides, the parts in their order); each widget's type and surface; the salience (quiet, the amber edge, the red edge and tint replacing the type's surface; an Outside card never edged); every short title whole at Small and every title whole at its sizes, in Geist (`document.fonts.check` first); every chart label in a card at 11 px or more; nothing focused when Home is drawn |
| P236 `p236-action-rows` (phone and desktop) | U2R | §24e: a census of everything a person can press in every widget at every size, on the long book and the empty book: each in one of the five rows or an item's own; at most one tinted and one text button in an Act; the Source the last line, its links only Refresh and a feed's credit; a Choose only at Large, in the head (under it on the phone), kept per person across a reload; no secondary, ghost or chip in a card; every target 44 px on the phone; a move's dialog with *Add to my list* |
| P237 `p237-board-heights` (phone, and desktop at 1280 and 1024 px) | U2R | §24h–§24i: each size's height; every preset with no hole for its role's default pages, packing on and off; a hole in a person's layout filled by a later card with the DOM in the layout's order; Customise's slots and *Add here* inserting at the slot; `wdgPlace` against the browser's own placement; the fit (the optional parts, then the rows, More's count, a Ledger's rest line adding up) |
| P238 `p238-figures-money` (phone and desktop) | U2R | §24k–§24l: `inrCard`'s cases (§24k's table and its edges); every amount on a board short, its exact figure its `title`; a Ledger's lines whole and adding up to their total; a rate with its paise; on every screen a figure in Geist (`--ff-num`, tabular) and an identifier in Geist Mono with its slashed zero; paper unchanged (P228's record) |
| P239 `p239-masthead` (phone and desktop) | U2R | §24j: flat (no fill, edge or lift; the hairline), 148 px on the desktop, never folded; its parts in order on both layouts; the clock and the shift before, during and after the shift (`page.clock`); the Act by role; the six-second test (the sentence and the clock in the first 200 px on the phone) |

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
- **U2R**: p223-home-board (the day card's parts → the masthead's; the board's spans → its heights and packing; arranging's slots;
  the presets), p224-widget-sweep (each widget's cap → its height; the type; a chart bare; the titles), p197 (`LOOKS` regenerated at
  14, 10 and 8 px, with the type surfaces, the edge, the red tint, the masthead and the tray; `ONE_LOOK`'s Home led by its masthead),
  p195 (Home's budget, I10), p180 (the type surfaces and the red tint in every palette and theme: HR-9, the steps over the page, every
  text tier at 4.5:1 on each and in a well on it), p182 (the corners' new values), p76 (the classes; every target on the phone), p42
  (the quick actions' keys on a tray: three across, six from 40rem of card), p225 (the feeds' Source: its credit and its Refresh),
  p227 (a chart's `opts.bare`, beside the boxed default), p228 (the paper record unchanged with Geist loaded), and every spec that
  reads `inv-widget-credit`, `inv-widget-chip`, `inv-homeday-*`, a widget's old foot (*View challans*, *Open the lines*, *Open
  Quotations*, *See all*, *Change the pair*, Tata's model chips) or a figure's face. Each asserts the same fact where it now lives.
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
10. **A fixed height cuts what a card says** (U2R): the fit lets go of the optional parts, then whole rows with their count, and the
    sweep (P224, P237) draws every widget at every size on three books; a widget that cannot say its answer at a size loses that size
    (it is no longer offered), never its words halfway.
11. **Dense packing changes the order seen**: the DOM keeps the layout's order (the tab order, a screen reader), no preset leaves a
    hole, and arranging shows the true order with its holes as slots.
12. **The figures' face changes every screen at once** (call 2): Geist's digits are narrower than Geist Mono's, so a figure only
    gains room; a column stays aligned (tabular figures); P76 sweeps every screen, view and dialog, and P197's census reads them.
13. **Fonts in a public repository**: Geist and Geist Mono are under the SIL Open Font License 1.1, which permits it with its text
    beside them; under 200 KB, under `tests/` only (the app keeps loading them from Google Fonts).
14. **Home grows on the phone** with fixed heights: measured by P195; the phone's Owner preset leaves out Do first if it would pass
    four screens (§24i). *As built:* it did pass them with Do first alone out (4.17); Turnaround and Days to pay went too (3.92).

## 23. Builder protocol

1. Work on the branch given, one step at a time, in order; read §1–§6, §16–§18 and the step's section, and the files named before
   editing them.
2. Grep every new top-level name across `split/*.js` before adding it (the prefixes this pass takes: `wdg`, `dv`, `feed`, `mkt`,
   `uiFlow`, `uiBlank`, `uiPointer`, `markSvg`, `iconFill`, `chartFit`, `seriesSlot`, `homeDay`, `homeClock`; the classes:
   `inv-widget*`, `inv-wgrid*`, `inv-gallery*`, `inv-switch*`, `inv-blank*`, `inv-flow*`, `inv-pointer*`, `inv-keypad*`, `inv-pinbox*`,
   `inv-pcp-*`, `inv-mkt-*`, `inv-wx-*`, `inv-ico-*`, none of them a retired prefix in P76's `V1_PREFIX`). U2R adds the names `inrCard`,
   `inrFigHtml`, `homeMastHtml`, `wdgPlace`, `wdgActHtml`, `wdgSourceHtml`, `wdgChooseHtml`, `wdgLedgerHtml`, `wdgDocketRowHtml`,
   `wdgPlantRowHtml`, `wdgSeatsHtml`, `wdgMoveRowHtml`, `wdgMoveCardHtml`, `wdgWireHtml`, `wdgTrayHtml`, `advMoveOpen` (each grepped
   free on 17 Oct 2026), and the classes `inv-btn-tint`, `inv-seg-choose`, `inv-cur`, `inv-meter-key`, `inv-widget-act`,
   `inv-widget-src`, `inv-wgrid-slot`, `inv-mast*`, `inv-ledger-*`, `inv-docket-*`, `inv-plant-row`, `inv-plate`, `inv-reading`,
   `inv-seat*`, `inv-crew-*`, `inv-brief-*`, `inv-wire-*`, `inv-tray*`. `inv-card*`, `inv-more-*` and `inv-total*` are retired
   prefixes: no part of a card takes those names.
3. Measure before; build; the step's specs, the rewritten ones, the full suite (about 27 minutes on CI, longer locally: not a hang);
   measure after; lower the budgets.
4. Commit each step with what moved and why and the trailers CLAUDE.md gives; no model name.
5. Never: delete or skip a test; raise a budget; write the owner's data, a worker's or a supplier's name into the repo; call a browser
   pop-up; add an inline style; change paper; change the book beyond §16.

## 24. The card family (U2R)

The owner looked at Home after U2's stop, 17 Oct 2026: *"The chips under the cards are still unfinished and looks out of touch with
the overall design. It should look crisp, I guess we are missing that as well. We need to manage white spaces better. We are in the
right direction but i am looking for a more finished product. What's your take?"* Then: *"If we are going to have one card layout,
then we can have different types of card layouts but organised, so maybe a financial card layout looks and feels different than an
industrial one. Same for anything that we are putting under one label, like the action rows."* On *"Go"* the family was drawn on a
canvas (the owner's artifact *Home card types*: Home on the desktop and the phone in both themes; one skeleton and seven types at each
size; the five action rows; the four calls, each beside today's build), and the owner answered *"Write the spec"* (17 Oct 2026). This
section is that spec. It takes the canvas as approved and the four calls as the canvas proposed them (§24a); where it departs from
or adds to the canvas, it says so, and §1a lists each for the owner's next look.

**What the canvas fixed, as measured on U2's build** (its *Today, as built* crops, the long book):
- a card's foot mixed outlined buttons, chips and links, each card its own way: the day card's outlined pill and link, Tata's model
  chips under its headlines, a source line holding two links, Do first's moves as cards inside a card, each with a bordered button
  and a link;
- ten of the Owner preset's fourteen cards were washed in their tone, so the red ones did not stand out;
- every amount was written to the paisa: ₹1,19,656.80 where the owner reads *about one lakh twenty*;
- the figures, in Geist Mono, read like code;
- a card was as tall as what it held, so the board left holes beside the short cards, and a card with little in it still stretched.

**It is one step, U2R, on Home's board, before U3** (Stats' board is built in the family from its start), **and it ends in a stop for
the owner to look**, as U2 did. Read §24 with §7 and §8: it amends §3a's radii, §3d's coded card, §7a's entry, §7b's sizes and
packing, §7g's presets and §8b's day card, and each of those says so where it stands.

### 24a. The owner's four calls, as taken

| Call | Taken (A, as the canvas proposed it) | The other (B) | A reversal is |
|---|---|---|---|
| 1. A card's surface | **Salience follows severity**: a card is quiet while all is well; amber adds a 3 px top edge; red adds the edge and tints the card. The figure and the lamp always carry the tone (§24c). | Every coded card washed in its tone, as U2 drew it | the tone rules of §24c |
| 2. The figures' face | **Geist with tabular figures**, every digit one width, so a column still lines up; Geist Mono only for document numbers, codes and nameplates (*SEP/26-27/00841*, *CH 0801*, *VAT A1*). Amends DR-4 (§24l). | Geist Mono for every figure, as U1 set it | `--ff-num` set back to `--ff-mono` |
| 3. Money on Home | **Whole rupees under a lakh, lakhs to two places from a lakh, crores from a crore** (₹66,476 · ₹3.50 L · ₹1.24 Cr); a Ledger's statement lines in whole rupees; the paise in each figure's `title` and on the screens behind (§24k) | To the paisa everywhere, as U2 wrote it | `inrCard` returning `formatCurrency`'s text |
| 4. Heights | **Fixed by size, the board packed**: on the desktop a Small one row and a Medium or a Large two; on the phone a Small one, a Medium two, a Large three; no hole (§24h) | As tall as its content, packed in order, as U2 built it | the board's rows back to `--masonry-row` |

The canvas drew each call's B beside its A on Home, through switches on its own root (`data-surface`, `data-figs`, `data-money`); the
app builds A alone and has no such switch.

### 24b. One skeleton

Every card on a board is one frame, drawn by the framework (`wdgCardHtml`, §24g), whatever its type.

| Size | Desktop: 12 columns (6) | Phone: 2 columns | At 1280 px (the canvas) |
|---|---|---|---|
| Small | 3 columns (3 of 6) × 1 row | 1 column × 1 row | 270 × 172 · on the phone half the board × 168 |
| Medium | 6 columns (6 of 6) × 2 rows | 2 columns × 2 rows | 556 × 360 · the row × 348 |
| Large | 12 columns (6 of 6) × 2 rows | 2 columns × 3 rows | the row × 360 · the row × 528 |

- **Rows**: on a 12- or 6-column board a row is `--wdg-row` 10.75rem (172 px) and the gap `--wdg-gap` 1rem (16 px); on the 2-column
  board 10.5rem (168 px) and 0.75rem (12 px). A Medium is two rows and the gap between (360 = 2 × 172 + 16), the phone's Large three
  rows and two gaps (528 = 3 × 168 + 2 × 12). Rem, so a larger text setting gives larger rows.
- **Corners**: `--r-card` 0.875rem (14 px; 18 before) on every card in the app; a well (a field, the search, a segmented control's
  track, a tile in a card) `--r-tile` 0.625rem (10 px); a button and a menu `--r-ctl` 0.5rem (8 px); a segmented control's pill
  `--r-seg` 0.4375rem (7 px: the track's corner less its inset, so the two curves are one). The phone's floating bar keeps a rounder
  corner of its own, `--r-bar` 1.375rem (22 px), as the canvas drew it. They are tokens, so every card in the app takes them at once.
- **The frame**: the card's surface (its type's, §24d), a hairline edge (`--edge`), `--lift-1`; nothing else. U2's card was an
  `inv-hero` and took the hero's wash; a widget is no longer one (§24c).
- **Spacing**: 16 px at a card's sides (`--wdg-pad-sm` 0.875rem, 14 px, on a phone's Small); the head 44 px tall (`--wdg-head-h`);
  the parts of the body 6 px apart (5 on a Small); the body's last part 14 px from the card's foot where no foot follows.
- **Type**: the title 13 px semibold in `--text-1` (U2 drew it in the accent's soft text; the accent is for what can be pressed, and
  the title is not a button of its own); the figure 28 px semibold (26 on a Small, 24 on a phone's Small: `--fs-28`, `--fs-26` new,
  `--fs-24`), `--ls-tight`; a unit after it 13 px in `--text-2` (`inv-unit`); the rupee sign at 0.62 em, raised and in `--text-2`
  (`inv-cur`); a sign before the figure (≥, ≈, −) at 0.8 em; the verdict 13 px medium; a detail line 12 px in `--text-2`; the
  Source 11 px in `--text-3`.
- **Colour**: status only, on the lamp (the app's dot, `inv-dot-<tone>`), the figure where the card judges it, and from amber the top
  edge (§24c); the accent only on what can be pressed. Nothing else on a card is coloured.
- **The order, always** (every type, every size): **head** (Open; Choose at its right), **figure**, **verdict**, **body** (the type's
  own parts, with **More** at its list's end), **Act**, **Source**. A part a card has no use for is left out; the others never change
  places.
- **A Small** holds the head (its short title, §24f), the figure and the verdict (a Briefing: its answer and one detail line), and at
  most one thing more: a small picture (bars, a gauge, the seats), one line, the tray (Tools), or one tinted button (the backup's).
  Never a list, a More, a Choose, a text button or a Source.
- **Nothing is focused when a board is drawn** (the canvas review found a focus ring on a card at load): the draw moves no focus.

### 24c. Salience follows severity (call 1)

| Tone | Surface | Top edge | Figure | Lamp |
|---|---|---|---|---|
| neutral | the type's (§24d) | none | `--text-1` | `inv-dot-neutral` |
| ok | the type's | none | `--ok` where the card judges it | ok |
| info | the type's | none | `--info` where judged | info |
| warning | the type's | 3 px of `--warning-mark` | `--warning` where judged | warning |
| danger | **the red tint**, `--card-danger`, in place of the type's | 3 px of `--danger-mark` | `--danger` | danger |

- `--card-danger` is `--danger-bg` mixed into `--surface` in OKLab, 70% in light (`#f9eeee` on Zinc, OKLab L 0.958) and 78% in dark
  (`#321a18`, L 0.250): `light-dark()` of the two `color-mix()`es.
- The edge is an inset shadow along the top (`inset 0 var(--tone-edge) 0 0 <mark>`, `--tone-edge` 0.1875rem), so it follows the card's
  corners and takes no room; the lift stays as it is.
- **A card's tone is the worst of what it holds that is the plant's to act on**, as now. An Outside card (§24d) is never edged or
  tinted: the world outside is to know (its tone is info at most), and its figures keep their own tones. A card in a blank state is
  neutral, as now.
- **Never colour alone** (DR-8): the lamp stands beside the verdict's words. On a card the tone is said by the lamp and the words and,
  from amber, the edge; the tone icons (`done`, `alert`, `cancel`, `info`) stay on a status badge and a notice (DR-8 as U1 amended it,
  amended again in U2R).
- **Measured** (the scratchpad's harness, Zinc, both themes): every text tier reads at 4.5:1 or more on each surface and in a well on
  it. The worst: `--text-3` in a well on the Plant card in light, 5.18:1; the accent there, 4.51:1; on the red tint, 5.28:1 in a well
  in light and 5.05:1 on the card in dark. Every light surface is under OKLab L 0.97 (HR-9): Ledger 0.956, Plant 0.950, the red tint
  0.958. P180 holds each, in every palette.
- **On the boards in U2R** (Home now, Stats from U3). **Every other hero and verdict card takes the same rule in U7** (§14a), so the app
  ends with one rule; until then a hero elsewhere keeps its wash (§1a-20).

### 24d. Seven types

A type is a card's surface and the parts only it draws; it never changes the skeleton. A widget names its type (`type`, §24g) and
the card carries it as `data-type`. The framework draws a type's parts with its builders (§24g); a widget never draws them itself.

| Type | For | Feels like | Surface | Rows it may use |
|---|---|---|---|---|
| **Ledger** · money | `money`, `cash`, `owed`, `dtp`, `gst`, `mtd`, `pace`, `clientprice`, `kilo`, `zincpaid`, `figures`; U3's `share`, `labour`, `months`, `trend`, `topitems`, `costcheck`, `pricecost` | a bank statement, a ledger page | warm, `--ty-ledger` | Open, Choose, More, Act, Source |
| **Docket** · documents in motion | `unbilled`, `recent`, `pipe`, `turn`, `quote` | the despatch register on the office desk | the card's | Open, More, Act, Source |
| **Plant** · lines and machines | `floornow`, `prodday`, `eff`, `heat`, `risk`, `powercuts`, `stockdays` | the panel by the rectifiers | cool, `--ty-plant` | Open, Choose, More, Act, Source |
| **Crew** · people | `atttoday`, `attweek`, `ot` | the roster board at the gate | the card's | Open, More, Act, Source |
| **Briefing** · the questions | `q-smooth`, `q-money`, `q-clients`, `q-plant`, `q-cash`, `q-changed`, `dofirst`, `why`, `coming`, `needs`, `corr` | a briefing note on the desk at nine | the card's; the answer in large type | Open, Choose, More, Act, Source |
| **Outside** · the world outside | `tata`, `weather`, `zinc` | a news wire on the desk | the card's | Open, Choose, More, Source (no Act) |
| **Tools** · starting things | `quick`, `sync` | the switch panel on the wall | the card's; the keys on a sunk tray | Open, Act, Source |

`corr` was not drawn on the canvas: a Briefing, since its answer is a sentence (*a pattern, not proof*). Briefing's Choose is
`corr`'s alone (§24f).

**The two surfaces, per palette** (light, dark), each the palette's card moved by Zinc's own step in OKLab, the Ledger warmer and a
shade under the card, the Plant cooler and a shade more, so the three palettes keep one structure:

| Palette | `--c-ty-ledger` | `--c-ty-plant` |
|---|---|---|
| Zinc & brass | `#f3f0e9` · `#1b1a16` | `#eaeff4` · `#121920` |
| Teal | `#f0f1e8` · `#191b14` | `#e7f0f3` · `#101a1e` |
| Terracotta | `#fbefdd` · `#221c10` | `#f2eee8` · `#191b1b` |

Measured: over the page by 0.027 to 0.035 OKLab L in light and 0.033 to 0.042 in dark; every text tier at 4.5:1 or more on each and in
a well on each; the accent at 4.51:1 or more. The aliases are `--ty-ledger` and `--ty-plant`; nothing else reads the primitives.

**What only each type draws:**
- **Ledger**: the rupee raised and small (`inv-cur`); amounts on dotted leaders, right-aligned (`inv-ledger-line`: the label, its
  meta in 12 px `--text-2`, a dotted leader `inv-ledger-lead` in `--border`, the amount at the right); a total ruled once above and
  twice below (`inv-ledger-total`: a `--rule` of `--text-2` over it, a 3 px double rule under its amount), **drawn only where the lines
  above it add up to it** (to half a rupee a line: each is rounded from its exact amount); a list that is cut ends in one line for the
  rest and their sum (*7 more clients · ₹2,86,040*), so the lines still add up; the age bar (`chartMeter`, as Money's) with its key
  under it (`inv-meter-key`: four columns, each its swatch, its band and its sum).
- **Docket**: document numbers in Geist Mono (`inv-id`); a document's state as steps (`inv-docket-steps`: a pip a state, those passed
  in `--text-3`, the one it stands at longer and in the tone of its age, `invStateTone` or `imWaitTone`, those to come in `--border`;
  an invoice's five, Created to Filed, a challan's four, received, pickled, plated, invoiced); rows that read across like a register
  (`inv-docket-row`: the number, then the party and its meta, then the amount and the steps, and a row's own action where it has one);
  the pipeline's stages as one strip in a well (`inv-docket-stage`: a stage a cell with its count and sum, the stage the card leads
  with lifted; each opens Pipeline at that stage).
- **Plant**: a lamp on each line or unit, ringed in its tone (an `outline`, never a shadow: DR-6); nameplates (`inv-plate`: the name
  as the app writes it, *VAT A1*, *Barrel*, in Geist Mono in a small well with a hairline, never upper-cased by style: DR-5); readings
  with their units (`inv-reading`: 14 px semibold, the unit 11 px `--text-2`); gauges with their mark (`chartMeter` and its mark: the
  usual day, 75% efficiency); the day strip, 6 AM to 6 AM (`chartDayStrip`, as built); a line a row (`inv-plant-row`: the lamp, the
  nameplate, what it runs and its meta, the gauge with its figure).
- **Crew**: a seat a hand the day needs (`inv-seats`, `inv-seat`: filled in `--text-2` when on site, ringed in `--warning-mark` when
  short, a seat ringed in `--info-mark` for each hand over), for the floor's areas against their need (`areaNeedOn`); an area a row
  with its seats and its word (`inv-crew-row`); the names of who is away (`inv-crew-away`: *Away:* and the names, from the roster on
  the device); weeks as bars against the 90% gate, the week to date hatched (the bar builder with its reference line, `opts.toDate`).
- **Briefing**: the answer as a sentence, its key figure in its tone (`inv-brief-ans`: 19 px semibold, 17 on a Small, 22 at Large;
  the figure `inv-fig-<tone>`); facts on one line (`inv-brief-facts`: 12 px `--text-2`, each value semibold in `--text-1`); moves as
  rows, each ending in its one action (`inv-brief-move`: its lamp, its sentence, its worth and what the worth rests on, the move's
  button tinted and small), at Large as cards with their worth (`inv-brief-movecard`: a well, three across from 40rem of card, the
  worth 17 px semibold in the tone of its sign, the sentence, the reason, the action at its foot); dated rows led by their day
  (`inv-brief-when`: the day in a small well, *Today* in the accent's soft colour, the period on show, DR-2); causes that add up to the
  change, ruled under them as a Ledger's total.
- **Outside**: headlines with their dateline (`inv-wire-item`, an `a` opening the article, `rel="noopener noreferrer"`,
  `target="_blank"`: the headline in two lines at most, `inv-wire-head`; the site and the time in 10.5 px Geist Mono `--text-3`,
  `inv-wire-dateline`; the external-link icon); the figures typed from the release, each with its change (`inv-mkt-*`, U2); the plant's
  week (`inv-mkt-week`); the hours ahead (`inv-wx-hours`); the Source always shown, with its Refresh.
- **Tools**: keys on a sunk tray (`inv-tray`, a well, `--r-tile`, three across, six once the card is 40rem wide, as U2's quick actions
  rule; `inv-tray-key`: the card's surface, its edge, `--lift-key`, `--r-ctl`, the icon in the accent over its word, 58 px tall, 92 on
  a phone's Small, which holds two); no figure.

**A chart in a card is bare** (`opts.bare`, charts.js): no box, no readout line and no *Table* button; each datum keeps its `<title>`
with its exact figure. A card is a glance: its chart's table is on the screen behind, which the card's Open reaches, and its verdict
says in words what the chart shows (§1a-15). **Every label a card's chart draws renders at 11 px or more**: a bare chart is drawn at
the card's own width (its `viewBox` in the card's pixels), or its labels are HTML beside the drawing, as the canvas drew them.

### 24e. Five action rows

Everything a card lets a person do is one of five rows, each with one look and one place:

| Row | Does | Where | Looks |
|---|---|---|---|
| **Open** | goes to the screen the card comes from | the head: the whole head is the target (`inv-widget-door`), the chevron after the title says so | no button repeats it; a role that cannot follow it reads the head as text, with no chevron (I4) |
| **Choose** | changes what the card shows: a model, a line, a view, a pair | at Large, a small segmented control at the head's right (`inv-seg inv-seg-choose`); on the phone under the head at the card's width; never at the foot (`corr`'s pair at Medium too, as one button naming it, §24f) | a well with 24 px pills on the desktop and 44 px on the phone; what is picked is kept per person with the layout (`opts`, §7h). The board's own period stays in the board's toolbar |
| **More** | the rows the card had no room for | the list's last row, in the list's rhythm: *5 more*, *4 more moves*, *6 more headlines* (`inv-widget-more`, `wdgFit`'s) | 12 px semibold `--text-2`, a chevron at its end; it opens the rest on the screen behind, or in a dialog where the screen is not the list's (§24f) |
| **Act** | does something now | after the body, before the Source (`inv-widget-act`) | one tinted button (`inv-btn-tint`) and at most one text button (`inv-btn-link`) beside it. A row in a list may end in its own one action, a small tinted button, as rows do now |
| **Source** | where it comes from, and how fresh | the card's last line, always (`inv-widget-src`) | 11 px `--text-3`, facts parted by a middle dot; a Refresh is a link inside it, never a button; besides Refresh, the only link it holds is a feed's credit where the feed's terms ask for one (§1a-17) |

- **The tinted button** (`inv-btn-tint`, new; design §6.3): `--accent-soft` fill, `--accent-soft-text`, an inset ring of the accent at
  24%, `--r-ctl`; 32 px tall on the desktop (28 for a row's own), 44 px on the phone, both. It is not the view's primary (DR-3 counts
  `inv-btn-primary`); a board has none.
- **What goes**: the outlined pill; a chip as a control inside a card (a chip stays a toolbar's filter); a link or button in a card's
  body that is not one of its items' own; a Source holding more than its Refresh and a credit; a card inside a card (Do first's
  moves); a button in a card's foot beside the Act; a second door to the screen the head already opens (*View challans*, *Open*,
  *Open the lines*, *Open Quotations*, *See all*).
- **What a body may hold that can be pressed**: its items, each opening what it names (a row, a tile, a stage, a key on a tray, a
  headline, a chart's row that opens a client); a row's own one action; a task of your own's tick box, as Needs you draws it. Nothing
  else.
- **A blank state's action is the card's Act** (tinted) at Medium and Large; a Small's blank has none, as on U2's phone. An error's
  *Report it* is the Act's text button.
- **Add to my list leaves the move's row**: a row or a card of moves ends in the move's one action, and a tap on the move (anywhere but
  its action) opens **the move's dialog** (`advMoveOpen`, new): its sentence, its worth and what the worth rests on, its action (the
  one primary) and **Add to my list** (*On your list* once it is). A question's Medium card keeps *Add to my list* as its Act's text
  button, for the first move, which is that Act's tinted button.
- **On the phone** every Act button, row action and More row is 44 px tall, a Choose's segments 44 px, and a Source holding a Refresh a
  44 px line.

### 24f. Every widget in the family

The bodies are §7d's, as built (the inventory of 17 Oct 2026), unless the last column says otherwise. A Small title is the card's
title at Small (`short`); every one is whole on a phone's Small in Geist (P235). `<d>` is a day and `<t>` a time the widget's own
reading gives; *—* means none.

**Ledger**

| Widget | Small title | Choose (Large) | Act | Source | What changes |
|---|---|---|---|---|---|
| `money` | — | — | *Import a statement* (tint), only while the statement is over 7 days old | Bank statement to `<d>` | its tiles in short money; its foot had shown *Import statement* even with a statement in |
| `cash` | Cash | — | — | Bank statement to `<d>` · each client at its own pace (Large: · the band is the likely range) | Medium: the balance, the money in and the money out the forecast places over its 60 days, and the balance at their end, as statement lines that add up (summed from `finForecast`'s own `days`, which already carry each day's in and out); Large: the lines and the forecast's chart, bare |
| `owed` | Owed to us | By client · By age | *Place the N receipts* (tint), while receipts have no client; *Send a reminder* (text): the statement and reminder of the client longest past its terms (`advGoTo` `soa`) | Bank statement to `<d>` · receipts set oldest first · age from the invoice date | By client (Medium's, and Large's first): the clients largest first as statement lines with their oldest days, the rest one line, the total ruled; By age: the age bar and its four bands as lines ruled to the total; Large: the receipts with no client as rows |
| `dtp` | Days to pay | — | — | Receipts set against invoices · a client judged from 3 receipts | Small: a gauge of the median against the terms, its mark at the terms; the dumbbell bare |
| `gst` | GST | — | *Add a note* (tint), for a month the bank shows unpaid with no note | Invoices and notes · paid read off the bank statement to `<d>` | Small: last month's due, its status as the verdict, the month before as one statement line; the chart bare |
| `mtd` | Month to date | — | — | Invoices, `<Oct 1–17>` · net of credit notes | Small: the months before it as small bars, this month to date hatched (`opts.toDate`); the eyebrow's period, which `wdgFromHero` dropped, is the Source |
| `pace` | — | — | — | Invoices to `<d>` · net of credit notes | so far, unbilled in hand and the likely range as statement lines, **no total ruled**: the landing is a pace, not their sum (the canvas ruled it twice) |
| `clientprice` | — | — | — | Invoices, the period · the live cost N% measured · labour fixed | the ranked bars bare, each client's row opening its page |
| `kilo` | A kilo's cost | — | — | Live cost, the period · N% measured | — |
| `zincpaid` | — | — | — | Zinc bills · the market at today's uplift and premium | the suppliers as rows, their rates with paise |
| `figures` | — | — | — | Invoices of the period, net of notes · the live cost N% measured | *Plated (floor)* a row opening Production (its *Production* link goes) |

**Docket**

| Widget | Small title | Choose | Act | Source | What changes |
|---|---|---|---|---|---|
| `unbilled` | Unbilled | — | — | Challans to `<t>` · amber at 3 days, red at 6 | Small: the count to bill as the figure and the oldest's wait as the verdict; Medium: the open amount and the oldest challans as register rows, each ending in *Create invoice* (`advGoTo` `createFor`); *View challans* goes |
| `recent` | — | — | *Mark the N dispatched* (tint), while printed invoices wait (Invoices with them ticked, `regState`); *New invoice* (text) | Invoices to `<t>` | rows: the number, the client and its meta, the amount and the state as steps, **each ending in its Print** (owner, 6 Oct 2026: four taps to print a recent invoice; the canvas drew none, §1a-16); the state badge goes, the steps say it |
| `pipe` | Pipeline | — | — | Challans and invoices to `<t>` · ages in working days | Medium: the stages as one strip (on a card under 32rem wide, a stage a row with its count and sum); Large: the strip and the oldest of the stage it leads with as rows, each ending in that stage's own action |
| `turn` | Turnaround | — | — | Challans of the last 90 days · working days, Sundays out | the slowest clients and the steps as register rows |
| `quote` | Quotations | — | *Follow up N* (tint), while follow-ups are due (Prospects, the due first) | Sales · weighted at a chance per stage | *Open Quotations* goes (the head opens Sales) |

**Plant**

| Widget | Small title | Choose | Act | Source | What changes |
|---|---|---|---|---|---|
| `floornow` | Floor now | — | — | In-time roll `<t>` · register to `<t>` · the day's cuts | Medium: lines running with heads on site beside it as a reading; the day strip; a line a row; Large: + units down, the EXTRA booked |
| `prodday` | Production | All lines · VAT A1 · VAT A2 · Barrel | — | Register pages of `<d>` · pickling messages · each run weighed by the surest route | Small: a gauge against the usual day; Large: the day, or the line picked, and its pieces not weighed as rows, each ending in *Which part?* or *Set its weight*; *Open the lines* goes (the head opens Lines on that day) |
| `eff` | Efficiency | — | — | Register to `<t>` · a round every N minutes, measured or set | the lines as rows with their gauges, the mark at 75% |
| `heat` | — | — | — | Plated, weighed by the surest route · a usual day ≈ X t | the heat bare; Large: the light days that had a cut as rows |
| `risk` | Cut risk | — | — | N cuts on record · thunder from MET Norway, `<age>` · Refresh | Small: the hours as bars, the window in `--warning-mark`, the thunder hours hatched in `--info-mark` |
| `powercuts` | Power cuts | — | *Complete the cut* (tint), while a cut has no time back (`pcsOpen` on it) | Cuts from the register, the messages and by hand · this month | — |
| `stockdays` | Stock days | — | *Order <line>* (tint), while the first is amber or red: the reorder list at it (`advGoTo` `reorder`); nothing is ordered from the app | Stock messages to `<d>` · use over 3 weeks, Sundays out | Small: *4 days* with the line's name as the unit, the order-by day as the verdict |

**Crew**

| Widget | Small title | Choose | Act | Source | What changes |
|---|---|---|---|---|---|
| `atttoday` | Attendance | — | — | In-time roll `<t>` · the out-time roll `<in, or not in yet>` | Small: the floor's heads against the day's need as the figure (*14 of 16 on the floor*), the shortfalls as the verdict, the seats; Medium: the areas as rows with their seats and who is away; its *Open* goes |
| `attweek` | — | — | — | Marks to `<d>` · the week Sunday to Saturday · weekdays only, as the gate counts them | weeks as bars against the 90% gate, the week to date hatched (U2 drew a line) |
| `ot` | — | — | — | Attendance, four weeks to `<d>` · overtime where it was worked | the ranked bars bare |

**Briefing**

| Widget | Small title | Choose | Act | Source | What changes |
|---|---|---|---|---|---|
| `q-smooth` | Running well? | — | Medium: the first move (tint) and *Add to my list* (text) | what the answer reads, and its period (each question as `statsStoryCards` names it) | Small: the answer as a sentence (the vital's figure set in its words, at most 40 characters: *Losing ₹17.67 on every kilo*, *4 things could stop the plant*) and the vital's picture; Medium: the story's sentence and rows; Large: the moves as cards |
| `q-money` | Making money? | — | as above | Invoices net of credit notes · the live cost N% measured · labour counted as fixed | as above |
| `q-clients` | Who drives it? | — | as above | as above | as above |
| `q-plant` | Plant full? | — | as above | Invoices, the period · ~2 t a shift, two shifts | as above |
| `q-cash` | Cash coming in? | — | as above | Bank statement to `<d>` | as above |
| `q-changed` | What changed? | — | as above | The month to `<d>` against its pace | as above; its insights as rows |
| `dofirst` | — | — | — (each move's at its row's end) | Every question's moves, by what each is worth a month | the moves as rows (Large: cards); a move opens its dialog (§24e); *4 more moves* opens Do first's dialog |
| `why` | — | — | — | Against `<the period before>` · weighed lines only | the causes as rows, the change ruled under them |
| `coming` | — | — | — | — | the predictions as dated rows; *5 more* lists the rest in place |
| `needs` | — | — | *Add a task* (text) | — | *See all* goes (the head opens Needs you) |
| `corr` | — | the pair: at Large its two pickers (*Across*, *Up*); at Medium one button in the head naming the pair, opening its picker | — | Day by day, working days · N points from `<d>` | *Change the pair* becomes the Choose |

**Outside**

| Widget | Small title | Choose | Act | Source | What changes |
|---|---|---|---|---|---|
| `tata` | — | the models followed (*All models · Prima · Signa*, `S.market.models`) | — | *The GDELT Project* (its credit, a link) · `<age>` · Refresh · figures typed from the `<month>` release | the model chips leave the foot for the Choose, which filters the headlines; *6 more headlines* opens the Tata dialog on the model picked; Large: three columns from 60rem of card (the figures and the week; the chart, bare; the headlines), two from 36rem, one under |
| `weather` | Weather | — | — | *MET Norway* (its credit, a link) · `<age>` · Refresh · at the plant's place | — |
| `zinc` | Zinc rate | — | — | metals.dev · `<age>` · Refresh · MCX estimated from LME | its *Refresh* button becomes the Source's link; the rate keeps its paise (§1a-18) |

**Tools**

| Widget | Small title | Choose | Act | Source | What changes |
|---|---|---|---|---|---|
| `quick` | Quick actions | — | — | — | the keys on a tray (Small three, the phone's Small two: *New invoice* and *Paste*; Medium six); Medium: *Started here and not saved*, the forms the app holds this session with **Continue** (§1a-19) |
| `sync` | Backup | — | *Back up now* or *Register* (tint, small) | — | its verdict *Backed up 12 minutes ago* with its lamp; the repository as its detail |

U3's widgets (`share`, `labour`, `months`, `trend`, `topitems`, `costcheck`, `pricecost`) are Ledgers, built in the family by U3 (§10).

### 24g. The framework (`widgets.js`)

A widget's entry (§7a) gains, and loses:

```js
wdgDefine({ id: 'owed', title: 'Owed to us, by age', short: 'Owed to us', q: '…', section: 'money',
  type: 'ledger',                                   // ledger | docket | plant | crew | brief | outside | tools; required
  sizes: ['m', 's', 'l'], needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'receipts' },
  choose: { def: 'client', opts: function (ctx) { return [{ v: 'client', label: 'By client' }, { v: 'age', label: 'By age' }]; } },
  data: function (ctx) { … },                       // ctx.choose: the value picked, else def
  draw: function (d, size, ctx) { … },              // the body, through the type's builders
  actRow: function (d, size, ctx) { return { tint: { label: 'Place the 21 receipts', action: 'invFinGo', data: { tab: 'receipts' } },
                                              text: { label: 'Send a reminder', action: 'invAdvGo', data: { … } } }; },
  source: function (d, size, ctx) { return { facts: ['Bank statement to 16 Oct', 'receipts set oldest first'] }; },
  act: …, change: … });                             // the handlers, as now
```

- **`type`** is required; a widget without one is refused when it is defined (an error in a test build, nothing drawn). **`short`** is
  required where `sizes` holds `s`.
- **`choose`** is drawn at Large (§24e); a pick writes `opts[id].choose` through `wdgOptsPut` and draws that card again alone, in
  `keepScroll`. `corr` keeps its `opts.corr` pair (`{x, y}`) as its Choose.
- **`actRow`** returns the Act's one tinted and one text button, either or neither; **`source`** returns its facts, and for a feed
  `refresh` (the feed's kind: the framework draws the link and its handler, as `wcFeedFoot` did) and `credit` (`{label, href}`).
  Neither is drawn at Small (§24b).
- **Retired**: `foot` and `wdgHeroFoot`; `wcFeedFoot` becomes the Source's builder. **`wdgFromHero` keeps the hero's eyebrow as the
  Source's first fact** (it dropped it: Money's *statement to …*, Zinc's age, Month to date's *Oct 1–17*).
- **The card** is `<section class="inv-widget" data-w data-size data-type data-tone data-state>`: no longer `inv-hero` and
  `inv-hero-<tone>`, so the hero's wash, gradient and sheet box do not reach it. Its head (`inv-widget-head`): the section's icon alone
  in `--text-2` with its tint (the chip, `inv-widget-chip`, retired), the title (`short` at Small), the chevron where Open can be
  followed, and the Choose at Large. Its body (`inv-widget-body`): the figure (`inv-widget-fig`), the verdict (`inv-widget-line`, its
  dot and its words, two lines at most), the type's parts, More. Its foot (`inv-widget-foot`): the Act (`inv-widget-act`) and the
  Source (`inv-widget-src`, which replaces `inv-widget-credit`). The hooks specs read stay where they are (`data-card`, the ids, §8c).
- **The type's builders**, presentation only, in widgets.js: `wdgLedgerHtml(lines, total)`, `wdgDocketRowHtml(o)`,
  `wdgPlantRowHtml(o)`, `wdgSeatsHtml(o)`, `wdgMoveRowHtml(mv)`, `wdgMoveCardHtml(mv)`, `wdgWireHtml(items)`, `wdgTrayHtml(keys)`,
  `wdgActHtml(row)`, `wdgSourceHtml(src)`, `wdgChooseHtml(def, ctx)`. A widget reads its screen's functions for its figures (I8) and
  hands them to these; no widget writes a row's markup of its own.
- **The money in a card** is `inrCard` (§24k); a Ledger's lines are `finRs`, as now.

### 24h. Heights, packing and the fit (call 4)

- **The grid** (`.inv-wgrid`): `grid-auto-rows: var(--wdg-row)`, `gap: var(--wdg-gap)`, `grid-auto-flow: row dense`; a Small spans
  one row, a Medium and a Large two, the phone's Large three; the columns as U2 built them (12 from 60rem of board, 6 from 36rem, 2
  under). A card fills its area (`height: 100%`) and nothing runs past it. **`--wdg-cap-*` are retired**, and the board leaves
  `uiMasonry` and `--masonry-row` (which stay for the grids that use them); the gallery's preview is one row tall (`--wdg-row`).
- **Packing** (`dense`): a later card moves up into a hole an earlier one left. The DOM keeps the layout's order, so the tab order and a
  screen reader read the order the person arranged; no preset leaves a hole (§24i), so a board as preset reads as it looks.
- **Arranging** (§7e) turns packing off (`grid-auto-flow: row`): what is arranged is where it stands, and **each hole is a slot**
  (`inv-wgrid-slot`: a dashed well, *Room for a Small* or *Room for a Medium*, and **Add here**, which opens the gallery; a widget added
  there goes into the order at the slot). The places come from `wdgPlace(items, cols)` (pure, new: each card's row and column as the
  browser places them sparse, and the holes), set on each element as `--wdg-r` and `--wdg-c` (as the drag sets `--drag-x`). Done turns
  packing back on. `wdgPack` keeps its name and draws the slots while arranging.
- **The fit** (`wdgFit`, as built, measured against the card's height): first the parts a card can do without, all together
  (`data-wdg-opt`, a tile's sparkline, a chart's key); then its list's last rows one at a time (`.inv-row`, `.inv-ledger-line` but never
  the total, `.inv-docket-row`, `.inv-plant-row`, `.inv-brief-move`, `.inv-brief-movecard`, `.inv-wire-item`, a chart's rows), the More
  row saying how many and a Ledger's rest line their sum; last, a verdict past its two lines is cut at a word, its whole text its
  `title`. Nothing is cut halfway and nothing runs past the card (P224, P237).
- **The room a card does not fill** is one space, between what it says and what it shows: a Small's picture is pushed to the body's
  foot (`data-wdg-push`), and the foot (Act, Source) stands at the card's foot. Never a strip of empty card under the last line.

### 24i. The presets

Each preset is drawn from what its role sees by default (`grdRoleDefaults`, guard.js) and **packs with no hole on both layouts, with
packing on or off**. U2's Office preset held four widgets its role cannot see (money's and Production's), so it drew with holes; and
the supervisor shared the Floor preset, whose pages it outnumbers. On the phone a preset keeps the desktop's order, a Small stays
Small and everything else is Medium (as U2).

| Preset (role) | Home, in order (desktop size) |
|---|---|
| Owner (the owner; the guard off) | `mtd` s · `q-money` s · `prodday` s · `cash` s · `pace` m · `coming` m · `tata` l · `floornow` m · `risk` s · `turn` s · `dtp` s · **`atttoday` s** · `q-smooth` m · `dofirst` m |
| Office (office) | `needs` m · `quick` s · `unbilled` s · `quote` s · `weather` s · `pipe` m · `recent` m · `tata` m · `coming` m |
| Supervisor (supervisor, new) | `floornow` l · `eff` m · `prodday` s · `atttoday` s · `risk` s · `weather` s · `stockdays` m · `attweek` m · `ot` m · `tata` m |
| Floor (floor) | `floornow` l · `eff` m · `prodday` s · `stockdays` s · `weather` s · `quick` s · `heat` m · `needs` m · `tata` m · `coming` m |

- The Owner's `atttoday` fills the hole beside `floornow` (the canvas added it). A role whose pages the owner has changed may meet a
  hole; packing fills what it can and Customise shows the rest.
- **The phone's Owner preset leaves out `dofirst`** if Home measures over four phone screens on the long book (I10's cap for Home;
  each question's Act and Large cards carry the same moves). By the canvas's own heights the Owner's phone Home is about 4.4 screens
  with it and 3.9 without; P195 decides, and the step reports both (§1a-14). *As built:* 4.17 with `dofirst` alone out, so `turn` and
  `dtp` are out on the phone too (`phoneOut: ['dofirst', 'turn', 'dtp']`): 3.92.
- A device on a preset follows the new one; a layout of the person's own is kept (§7g).

### 24j. The masthead (§8b, amended)

The day card becomes a **masthead**: Home's verdict drawn flat on the page, under the top bar, never a card.

| Part | Desktop | Phone | From |
|---|---|---|---|
| date | *Good afternoon, <name> · Saturday, 17 October*, 12 px semibold `--text-2` | the same | §8b |
| sentence | its lamp (10 px, ringed in its tone) and the verdict, 22 px semibold, at most 60 characters; after it *· 23 open*, 14 px `--text-2`, where the sentence counts tasks | 19 px; nothing after it | §8b's first that holds |
| facts | up to two more of §8b's, then the weather now (its icon, *31° · thunder from 4 to 6 PM*), 13 px, each led by its lamp or icon | under the sentence and the clock, the masthead's width | §8b; §9's feed (nothing when it is not set) |
| Act | **Open Needs you** (tint) and *Make today's report* (text, for a role that opens Reports) | **Open Needs you · 23** | `tdyTasks`, `rptFromStats` |
| clock | *2:30* and *PM*, 44 px semibold (`--fs-44`; the unit 17 px `--text-2`), at the right | 30 px (`--fs-30`), at the sentence's right | the device's clock, on the minute |
| shift | *General shift ends 5:00 PM · 2 h 30 min left* over a track of the shift gone | *Shift ends 5:00 PM*, no track | the labour settings |

- **Flat**: no fill, no edge, no lift; a hairline under it. **Never folded** (the day card was shut on the phone: the masthead's first
  two lines answer the six-second test on both layouts). 9.25rem (148 px) tall on the desktop (`--mast-h`); on the phone as tall as it
  needs (about 184 px on the long book).
- **The shift**: before 8:30 AM *General shift starts 8:30 AM · in 1 h 10 min* over an empty track; after 5 PM *The general shift has
  ended* and no track (U2 said nothing before the shift).
- **The tick** (`homeClockStart`, `homeClockStop`) sets the clock's text, the shift's text and the track's `--shift-done`, nothing else.
- **Hooks kept**: the masthead carries the day card's (`data-home-daycard`, `[data-home-clock]`, `[data-home-shift]`).
  `homeDayCardHtml` becomes `homeMastHtml`; `inv-homeday-*` (3) go for `inv-mast`, `-date`, `-say`, `-facts`, `-clock`, `-shift`.
- **P197**: Home's anatomy leads with its masthead (an overview's verdict, drawn flat), then one toolbar row, then the board.

### 24k. Money on a board (call 3)

`inrCard(v)` (state.js, new, beside `formatInrShort`) returns `{text, num, unit, neg, exact}`: `text` the whole (*₹3.50 L*), `num`
and `unit` for a figure's parts (*3.50*, *L*), `neg` for the sign, `exact` the amount to the paisa (`formatCurrency`), every step
through `gstRound` (HR-8):

1. `r = gstRound(|v|, 0)`. Under 1,00,000: *₹* and `r` grouped the Indian way.
2. Else `L = gstRound(|v| / 1e5, 2)`. Under 100: *₹`L.toFixed(2)` L*.
3. Else `C = gstRound(|v| / 1e7, 2)`: *₹`C` Cr*, its whole part grouped the Indian way (*₹1,234.57 Cr*).
4. Negative: *−₹* (U+2212, design §5.4). Zero: *₹0*.

| Amount | `inrCard` |
|---|---|
| 0 | ₹0 |
| 66,476.00 | ₹66,476 |
| 99,999.40 | ₹99,999 |
| 99,999.60 | ₹1.00 L |
| 3,49,800.00 | ₹3.50 L (the canvas wrote ₹3.49 L: it rounds, HR-8) |
| 1,19,656.80 | ₹1.20 L |
| 99,99,999.00 | ₹1.00 Cr |
| 1,23,84,210.00 | ₹1.24 Cr |
| 12,34,56,789.00 (the crore book) | ₹12.35 Cr |
| −66,476.40 | −₹66,476 |

- **Where**: every money figure a widget draws (its figure, verdict, facts, tiles, a move's worth with its sign, *+₹7.98 L a month*) and
  the masthead's; the exact amount is the element's `title`. Drawn as a figure, *₹* is `inv-cur` and *L* or *Cr* `inv-unit`
  (`inrFigHtml(v)`).
- **A Ledger's statement lines and their total are whole rupees** (`finRs`), at any size, so they add up (§24d).
- **A rate keeps its paise** (₹17.67 a kilo, ₹392.40 a kilo, ₹47.50 an hour): it is not an amount (§1a-18).
- **A chart keeps `formatInrShort`** on its axis and keys (design §6.17's chart money); its `<title>`s stay exact.
- **Every other screen keeps the paise**: the call is the boards'. A widget draws the same on Home and on Stats' board (U3).

### 24l. Figures in Geist (call 2)

- **`--ff-num`** (new) is `var(--ff-base)`. Every rule that sets a figure reads it: `.inv-num`, `.inv-input-num`, `.inv-tile-value`,
  `.inv-hero-fig`, `.inv-deck-fig`, `.inv-widget-fig`, the masthead's clock, `.inv-actionbar-value`, `.inv-selbar-sum`, `.inv-wstat-v`,
  `.inv-cell`, `.inv-table-grid-date`, `.inv-step-node`, `.inv-panel-count`, `.inv-widget-place`, `.inv-verdict-text`, the
  knowledge base's step numbers, and the charts' axis, scale, centre and ranked labels. App-wide, in U2R: a figure reads the same on
  every screen.
- **Identifiers keep `--ff-mono`**: `.inv-id` (an invoice, challan, credit note, quotation or P.O. number, a vehicle, a GSTIN, a
  cheque), the text as sent (`inv-quote`), `.inv-textarea-mono`, the recovery code (`.inv-guard-code`), a key's name (`.inv-kbd`), and
  the family's `inv-plate` and `inv-wire-dateline`.
- **`slashed-zero` leaves `html`** (`tabular-nums lining-nums` stay there) for the identifiers above: a zero in a document number must
  not read as an O; a figure in Geist reads as a figure.
- **Paper does not move** (I12): the printed documents declare their own faces, and P228's record of them must not change.

### 24m. Geist under test

The test browser cannot reach Google Fonts (in this sandbox it refuses the certificate; on CI the invoice's own spec found the runner
drawing in a fallback face), so every measure so far was taken in whatever face the machine had. A fixed height, a Small's title and a
line's room are measured in Geist or not at all:
- `tests/fixtures/fonts/`: Geist and Geist Mono, latin, variable `woff2`, with the SIL Open Font License 1.1 text that permits it
  (`OFL.txt`), under 200 KB in all.
- The fixtures route `fonts.googleapis.com` to a local stylesheet naming those two files (`page.route`), so every spec draws in Geist.
  The paper faces (Fraunces, Inter, IBM Plex Mono) are not served, as now: P228's paper record was taken without them.
- **A spec that moves with the real face is read, not loosened**: where it measured the fallback's widths, it is rewritten to the same
  fact in Geist (I6). The fonts land in their own commit, the suite run on it, before the family is built.

### 24n. The book and the server

- **The book does not change.** Nothing of the family is a record: the type, the rows, the money and the faces are drawing.
- **The layout** gains each widget's Choose in its `opts` (`opts.<id>.choose`), on the device in `sep_inv_layout` (§7h) and at S1 in
  the person's `prefs` on the hub, *the later wins*. §16 gains the row.
- **A Source's facts** are read off the functions each widget already reads (the statement's last day is `finForecast`'s `asOf`, the
  roll's time the day's, the register's last row Production's); at S1 the same days come from the hub's tables (each view's
  newest row, `docs/SERVER.md` §4). No store is added for them.
