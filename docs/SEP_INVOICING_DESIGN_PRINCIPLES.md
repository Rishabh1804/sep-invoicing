# SEP Invoicing — Design System
**Version 2.0 · "Dense console" · adopted 26 Sep 2026** (supersedes v1.0 of 13 Apr 2026)
**UI pass 3, 16 Oct 2026** (`docs/UI_PASS_3.md`, U1): the look is the owner's *"B with wells"*: cards lift off the page, what you
press or fill sits in a shallow well, text keeps full contrast, and colour means something. Zinc & brass is the default palette.
Amended in place: DR-2, DR-6 and DR-8, §3.1, §3.3 and §3.6, the components of §6 (the switch and the blank state added, §6.31 and
§6.32), and §6.28's closed list of looks, regenerated from the census.

This is the one document the interface is built on. Read it before touching `split/styles.css` or any
render function. **If a change needs something this document does not define, amend this document in the
same PR first** — a component that exists only in code is how the app ended up with six tab controls and
twenty badge families.

The approved mock-ups (Direction C, owner, 25–26 Sep 2026) are the visual reference:
<https://claude.ai/artifact/SwSpC9dvYYTT26ivweP2H7> (private to the owner; the rows headed "C").
Where a mock-up and this document disagree, **this document wins**.

---

## 1. Why this direction

- **The owner works his own figures every day.** Density is a feature for that reader, not a problem to
  design away. Screens keep their data; "modern" comes from the chrome, the type and the discipline of
  colour. *(Research, 25 Sep 2026: expert daily users tolerate and prefer density — agency consensus,
  consistent with NN/g.)*
- **Quiet chrome, loud status.** No coloured header bar, no decorative boxes; a card lifts and a well sinks, and nothing else casts a shadow (DR-6).
  Hierarchy comes from type weight, spacing and hairlines. Colour is spent on **meaning** — red, amber,
  green, blue — and on the one accent that marks what is interactive or selected.
- **Tables are first-class.** A register, a stock list and a week grid are tables. They are drawn as
  tables on the desktop and as two-line rows on the phone — never as a stack of shadowed cards.
- **Numbers are the product.** Every figure is monospaced, tabular and right-aligned in its column, so a
  column of rupees can be read down.

The survey that led here (25 Sep 2026) found the app speaking three visual languages at once
(`inv-card`, the Stock tab's `inv-stk-*`, and the Stats card), ~1,025 classes, six sub-tab controls, seven
KPI tiles, seven table implementations and ~20 badge families encoding the same four tones. v2.0 replaces
all of them with the components in §6.

---

## 2. Hard rules (unchanged, still binding)

| HR | Rule |
|----|------|
| HR-1 | No inline styles. Classes + tokens. |
| HR-2 | No inline `onclick`. `data-action` delegation only. |
| HR-3 | `inv-` prefix on every class. |
| HR-4 | No emoji. Inline SVG icons (§5.6). |
| HR-5 | `escHtml()` on all user data entering `innerHTML`. |
| HR-6 | Tokens only: no raw `px`/`rem`/hex/timing in rules. Exceptions are listed in §3.9 and may not grow. |
| HR-7 | Every element works in light **and** dark (§3.2). |
| HR-8 | `gstRound()` for all currency; `formatCurrency()` for display. |
| HR-9 | **No white.** No fill on screen is lighter than OKLab L 0.97 (§3.1): pure white never, and no off-white that reads as it. Paper is the one exception (§3.1). Measured by P76's sweep and P180. |

And the v2.0 rules, which carry the same weight:

| DR | Rule |
|----|------|
| DR-1 | **Colour means status.** Only the status tones (§3.3) may colour text, dots or fills that convey state. Never colour alone: a tone always travels with a word or a symbol. |
| DR-2 | **One accent, for interaction.** `--accent` marks the primary action, the current selection, the active tab/nav item, focus, links, and the current period in a chart. Nothing else: it never marks a status (good or bad) or a series (UI pass 3, §3d). *One against the rest* (the period on show, or the thing picked, in the accent beside what it is set against in `--series-other`) is the accent marking what is selected. |
| DR-3 | **One primary button per view.** Everything else is secondary, ghost or link. |
| DR-4 | **Figures are `--ff-mono`, tabular, right-aligned** in any column or tile. Identifiers (invoice, challan, P.O., vehicle, GSTIN) are mono too. Prose numbers inside a sentence are not. |
| DR-5 | **Sentence case everywhere** — titles, labels, buttons, column heads, tabs. No uppercase letter-spaced labels. |
| DR-6 | **A card lifts, a well sinks, a layer floats; nothing else casts a shadow** (UI pass 3, 16 Oct 2026, amending 8 Oct's tile lift). A card (a panel, a hero, a card in a deck, the phone's bar, a chip, a button) is lifted off what it sits on by `--lift-1` (`--lift-2` for the one primary and a card being moved); a well (a field, a search, a segmented control's track, a tick box, a switch's track, a meter's track, a tile inside a card) is sunk into it by `--press-1` or `--press-2`; a layer (a menu, a dialog, a toast) floats on `--shadow-pop` or `--shadow-dialog`. A row, a hero's sheet, a head and a table's cell cast nothing. In dark a card is lifted by a lighter surface and its fine edge (`--edge`) more than by its shadow (§3.3). |
| DR-7 | **Components, not one-offs.** A screen is assembled from §6. A module may add a modifier (`inv-table-week`), never a parallel family (`inv-stk-row` beside `inv-row`). |
| DR-8 | **Status is a dot + a word** in rows and tables (`● Dispatched`); a soft badge only where the state needs more weight than the row around it. **A figure the app judges is coloured in its status tone** (`inv-fig-ok/warning/danger`, `inv-fig-info` for a figure over its mark, or the tile's `inv-tile-<tone>`), always beside the words that give the reason (*below cost ₹8.56*, *owed, over 90 d*, *+12.3% on Aug*); a plain fact — a count, a date — stays in the text colour (owner, 29 Sep 2026). **A coded card and a status badge carry the tone's icon as well** (UI pass 3, §3d: `done` for ok, `alert` for warning, `cancel` for danger, `info`); a dot and the word stay where the row has no room. |
| DR-9 | **Every screen is one of four kinds, assembled one way for its kind** (the tab map, `docs/TAB_MAP.md` §3e; owner, 9 Oct 2026: *"UI still feels inconsistent to me"*). An **overview** leads with its heroes; a **work screen** with its verdict card (§6.28), then one toolbar row, what needs the owner, the list, the rest folded, and a row ends in its figure and status or one action; a **document** is paper fitted to the screen; a **form** is its fields and its action bar. A screen declares its kind (`data-screen`, `SCREEN_KINDS` in tabs.js) and P197 holds it to the kind's anatomy; its boxes wear only the closed list of looks (§6.28). |

---

## 3. Tokens

Two layers. **Primitives** hold raw values and are never read by a component. **Semantic aliases** give them
meaning and are the only thing components read. A theme or palette swaps aliases; components never change.

### 3.1 Palettes (primitives)

**Three palettes, chosen per device in Settings → Data & device → Appearance** (owner, 26 Sep 2026:
*"give different palette style options in settings, we'll start with Teal"*). **Zinc & brass is the default since UI pass 3**
(16 Oct 2026; the approved board's palette, `docs/UI_PASS_3.md` §1a-2): `head.html`'s first paint and `appearance.js` take it where
the device has chosen none, so a device that never chose follows the new default and one that chose Teal or Terracotta keeps it. A
palette is only a set of primitives: `<html data-palette="zinc|teal|terracotta">` selects which set the aliases read, so no component
knows which palette is on. Adding a palette = one more block of primitives plus its row in §3.10; nothing else changes. UI pass 3
took each page a step down (OKLab L 0.92), so a card stands off it, gave each palette a step-deeper accent for the primary button's
face and a card's fine edge, and took `--c-text-3` a step darker in light, so it reads at 4.5:1 in a well on the page.

**Zinc & brass** (default) — zinc-grey neutrals, brass accent (the trade's own materials).

| Primitive | Light | Dark |
|---|---|---|
| `--c-bg` / `--c-surface` | `#e1e6eb` / `#eff3f6` | `#0e1114` / `#15191d` |
| `--c-surface-2` / `--c-surface-3` | `#dfe3e9` / `#d5dbe1` | `#1c2126` / `#242a30` |
| `--c-border` | `#cdd3da` | `#2b323a` |
| `--c-text-1` / `-2` / `-3` | `#14191e` / `#4d5761` / `#545e68` | `#edf0f3` / `#a9b3bd` / `#86919c` |
| `--c-accent` / `--c-on-accent` | `#8a5d0c` / `#fbf7ef` | `#dcaa4c` / `#1b1204` |
| `--c-accent-deep` | `#704b08` | `#b98f3f` |
| `--c-accent-soft` / `-text` | `#f5ead3` / `#6a4606` | `#33291a` / `#ecc983` |
| `--c-edge` | `rgb(20 25 30 / 0.06)` | `rgb(237 240 243 / 0.08)` |

**Teal**

| Primitive | Light | Dark |
|---|---|---|
| `--c-bg` / `--c-surface` | `#dee7e9` / `#ecf4f5` | `#0d1213` / `#131a1b` |
| `--c-surface-2` / `--c-surface-3` | `#dae6e7` / `#cfdddf` | `#1a2224` / `#222c2e` |
| `--c-border` | `#c7d6d7` | `#293537` |
| `--c-text-1` / `-2` / `-3` | `#11191c` / `#4a585e` / `#516065` | `#ecf2f2` / `#a6b6b8` / `#7d8f91` |
| `--c-accent` / `--c-on-accent` | `#0d6b63` / `#f6faf9` | `#4fc1b3` / `#04211d` |
| `--c-accent-deep` | `#085650` | `#41a296` |
| `--c-accent-soft` / `-text` | `#dcefec` / `#0a4d47` | `#15302d` / `#8fdcd2` |
| `--c-edge` | `rgb(16 40 48 / 0.06)` | `rgb(236 242 242 / 0.08)` |

**Terracotta** — warm neutrals, the v1.0 accent.

| Primitive | Light | Dark |
|---|---|---|
| `--c-bg` / `--c-surface` | `#eae4db` / `#f7f2ea` | `#141311` / `#1c1b18` |
| `--c-surface-2` / `--c-surface-3` | `#e9e2d6` / `#e2d9ca` | `#24221e` / `#2d2a25` |
| `--c-border` | `#dbd1c1` | `#36322c` |
| `--c-text-1` / `-2` / `-3` | `#1b1916` / `#58534b` / `#625c52` | `#f3f0ea` / `#bcb6aa` / `#948d80` |
| `--c-accent` / `--c-on-accent` | `#a54926` / `#fbf6f2` | `#e98c64` / `#1f0e06` |
| `--c-accent-deep` | `#863a1d` | `#c57553` |
| `--c-accent-soft` / `-text` | `#f6e6dc` / `#7e3418` | `#3b2419` / `#f2b89c` |
| `--c-edge` | `rgb(40 30 20 / 0.06)` | `rgb(243 240 234 / 0.08)` |

Terracotta's light accent went from `#a94b28` to `#a54926` with its darker page, which had brought it under 4.5:1 there (4.46).

The status tones (§3.3) are **shared by every palette**: red must mean the same thing whichever accent is on.

**No white anywhere in the interface: HR-9** (owner, 26 Sep 2026: *"make sure that nothing is in absolute white colour as
that puts a lot of stress at our eyes"*; 8 Oct 2026: *"we will be avoiding pure white everywhere in the app, this should be
an HR"*). The 26 Sep surface was an off-white a step below `#fff` (`#f8fafa`, OKLab L 0.984), and beside the coloured cards
it still read as white: the owner called the boxes in Today's cards *"just white"*. So the rule is a measured ceiling, not
the hex `#fff`: **no fill on screen is lighter than OKLab L 0.97.** Every light ramp was taken down a step and given its
palette's hue, the surface at L 0.96 and the page at 0.93 (0.92 since UI pass 3), each tier keeping its distance from the next; text-3 was darkened
a shade where it fell under 4.5:1 on `--surface-2`, and Terracotta's accent where it fell under it on the page (§3.10). Text
on the accent is off-white (ink, not a fill), and the app icons use the same. **The one exception is paper**: the printed
documents, their on-screen previews (a report, the power case) and a QR code, which a camera reads black on white, stay
`#fff`, because that is the sheet they print on and the PDF they save as. **The instrument**: P76's sweep reads every screen,
view and dialog, both themes and both layouts, and fails on any element outside paper whose computed fill, a gradient's
stops included, is lighter than the ceiling, and on any tick box the browser draws (it paints white whatever its computed fill
says); P180 proves the sweep fails on the 26 Sep surface, and reads the stylesheet for white outside the paper blocks.

### 3.2 Theme: light, dark, and following the system

- Each semantic colour is declared **once** with `light-dark(light, dark)`; there is no duplicated `.dark {}`
  block. `light-dark()` resolves by `color-scheme`, so the theme is set there:
  ```css
  :root                     { color-scheme: light dark; }   /* follow the device */
  :root[data-theme="light"] { color-scheme: light; }
  :root[data-theme="dark"]  { color-scheme: dark; }
  ```
- **Default: follow the phone's setting** (owner, 26 Sep 2026). **Settings → Data & device → Appearance**
  offers Theme (System / Light / Dark) and Palette (Teal / Zinc & brass / Terracotta), stored per device in
  localStorage (`sep_inv_theme`, `sep_inv_palette`) and applied to `<html data-theme data-palette>` before
  first paint by a short script in `head.html`, so there is no flash of the wrong colours. Never on `S`:
  appearance is a fact about the device, not the books — an imported backup must not repaint the phone.
- **No `.dark` class exists** (removed 26 Sep 2026, with the 147 v1.0 `.dark .inv-…` rules: they restated tokens that
  now switch by themselves, and some repainted a selected state in the background colour, hiding it). Dark coverage is
  the token, nothing else.
- ⚠ **v1.0 shipped dark styles that nothing could switch on**: `.dark` was defined in the stylesheet and no
  code ever set it. v2.0 is the first version in which dark mode is reachable. Both themes are tested (§9).
- `light-dark()` is colour-only (it takes no images). Chrome/Edge 123+, which covers every device the shop uses.
- `meta[name=theme-color]` is set at runtime to the active palette's `--c-surface` for the resolved theme
  (the system bar matches the top bar), and updated when the device theme or the palette changes.

### 3.3 Semantic colour aliases

| Alias | Use |
|---|---|
| `--bg` | the page behind everything |
| `--surface` | cards (panels, heroes, chips, buttons), tables, bars, a segmented control's pressed pill |
| `--well` | a well (UI pass 3): a field, a search, a segmented control's track, a tick box, a switch's track, a meter's track, a tile inside a card. A veil, `light-dark(rgb(20 25 30 / 0.05), rgb(0 0 0 / 0.22))`, over whatever it sits in, so it is a step under its card, a dialog or the page alike: over Zinc's card it reads `#e3e8ec` (L 0.929, the card 0.962) and `#101317` in dark (0.185, the card 0.211); over a coded card it is that card's own fill sunk. Never lighter than what it sits in, so never white |
| `--edge` | a card's and a well's fine edge (`--c-edge`): in dark it, with the card's lighter surface, is what lifts a card |
| `--accent-deep` | the step-deeper accent the primary button's face runs to (`--c-accent-deep`) |
| `--surface-2` | table header band, selected nav item, segmented "on", hover, tokens |
| `--surface-3` | pressed, inactive bars in charts, disabled fill |
| `--border` | every hairline: panel edges, row dividers, inputs |
| `--text-1` / `--text-2` / `--text-3` | primary / secondary / tertiary text (all ≥ 4.5:1 on every surface, §3.10) |
| `--accent`, `--on-accent` | primary button, active tab underline, focus ring, links, current chart bar, selected checkbox |
| `--accent-soft`, `--accent-soft-text` | selected row, active filter token, selected segment on the phone |

**Status tones** (DR-1). Each has a strong colour (dots, text, bars) and a background (soft badge, tinted cell):

| Tone | Means | Light fg / bg | Dark fg / bg |
|---|---|---|---|
| `--danger` / `--danger-bg` | broken, below cost, absent, out, overdue | `#b42318` / `#fdecea` | `#f38b81` / `#3a1916` |
| `--warning` / `--warning-bg` | check, running low, half, short, due | `#8a5700` / `#fcf1d9` | `#e8b95c` / `#352911` |
| `--ok` / `--ok-bg` | matches, healthy, present, delivered, measured | `#176e37` / `#e4f3e8` | `#72c98f` / `#14301e` |
| `--info` / `--info-bg` | in transit, informational, market rate, "on shelf" | `#1d5ea6` / `#e6effa` | `#8dbaf0` / `#15263a` |

`--neutral` is `--text-3` on `--surface-2` (created, filed, model, no data). **The v1.0 domain colours
(`--attend`, `--cost`, `--prod`, `--neutral`, `--todo`, `--cw`, `--perm`) are retired** into these five.

**Fills** (8 Oct 2026; owner: *"Hero cards should have gradient colour filling as per the theme, make sure the colours are
coded - also check if colour coding already exists"*, then *"the boxes inside the cards are still just white instead of colour
coded gradients"*). The coding existed: these status tones, and the figure judgements that pick one (`figTone*`, CLAUDE.md *A
figure says whether it is good*). A coded block names its tone in two variables, **`--tone`** (the strong colour) and
**`--tone-bg`** (its soft background), and every fill in it is mixed from those two in oklab, on the element itself, so it follows
the theme and the palette and DR-1 holds (a fill's colour is its status, and its words say which):

| Tier | What | Fill |
|---|---|---|
| Card | a hero (§6.21), lifted | 160°: its tone's background to the tone 7% into it (UI pass 3, the approved board; it was 135° from the tone 18%); a plain card (`neutral`) is the surface to `--text-3` 7% into it |
| Card in a card | a card in a deck (§6.22), lifted | 160°, lighter than the card it lies on in both themes: in light its background 40% → 75% into the surface; in dark the tone 12% → 8% into its background |
| Well in a card | a tile that names a tone (§6.9), sunk | 160°, darker than the card in both themes: in light the tone 13% → 9% into its background; in dark its background 60% → 45% into the page. A tile that names none is the card's own fill under the well's veil |
| Control | a secondary or icon button in a coded block | in light the tone's background 55% into the surface, in dark the tone 12% into its background (lighter than the card in both), its edge the tone 28% into `--border` |

A hero is `inv-hero-danger|warning|ok|info|neutral`, the accent with none. A box names its own tone by its tone class
(`inv-tile-<tone>`, which also colours its figure) or by `data-tone` (the fill alone: a task's `red|amber|info`, a move's
`danger|warning|ok|info`, a tile whose figure is a plain fact but whose change has a direction); a card in a deck with none takes
the card's. **A tile that names none is a plain fact** and is drawn plain (the card's own fill under the well's veil), never in its
card's tone, which would say the fact is the card's verdict. **What a hero opens to (its sheet) draws no box** of its own, only a
hairline under the head. `inv-coded` codes a block that is not a card (Pulse's quick actions). No other surface takes a gradient.

**Series** (UI pass 3, §3d): six colours say which thing a line or bar is, `--series-1…6` (blue `#2e75b6`, orange `#c0622b`, green
`#1f8a6a`, ochre `#a87c00`, magenta `#c2508a`, violet `#6b55c9`; dark `#5a98dc`, `#d9733d`, `#2fa37f`, `#b8890f`, `#d06a9c`,
`#8576e8`) and `--series-other` (`#9aa4ae` / `#5d6772`), always in that order and never by rank: a thing keeps its slot app-wide
(`seriesSlot`, charts.js). Checked with the dataviz validator on 16 Oct 2026 against the card and a well in light and the card in
dark: every check passes (the worst adjacent colour-blind pair ΔE 8.4 light, 9.6 dark; dark's tritan 5.9 is under the 6 floor, so two
series or more always carry a legend and, up to four, direct labels). The `--chart-*` tokens they replace failed the same check
(their ochre, brown and green read alike). **How much** (a heat map, a scale) is one blue, `--seq-1…7`, light to dark (dark: dim to
bright). A single-series chart uses `--surface-3` bars with the current/selected bar in `--accent` (§6.17).

### 3.4 Typography

**Faces:** `--ff-base: 'Geist', system-ui, sans-serif` · `--ff-mono: 'Geist Mono', ui-monospace, 'Cascadia Mono', monospace`.
Loaded from Google Fonts with `display=swap`; `sw.js` already lets the font CSS fail offline, and the
fallback stacks are chosen to hold layout. Fraunces, Inter and IBM Plex Mono are dropped from the UI.
**Printed documents keep their own faces and scales** (§8).

`html { font-variant-numeric: tabular-nums slashed-zero lining-nums }` stays global.

**Roles, not sizes.** A rule reads a role token; a role fixes size, line height and weight together.

| Role | Size | Line | Weight | Face | Use |
|---|---|---|---|---|---|
| `--t-title` | 1.0625rem (17) | 1.3 | 600 | base | page title in the phone top bar |
| `--t-title-desk` | 0.875rem (14) | 1.3 | 600 | base | page title in the desktop top bar |
| `--t-heading` | 0.8125rem (13) | 1.4 | 600 | base | panel title, section head |
| `--t-body` | 0.875rem (14) phone / 0.8125rem (13) desktop | 1.45 | 400 | base | row text, table cells, prose |
| `--t-body-strong` | as body | | 500–600 | base | a row's primary line |
| `--t-label` | 0.75rem (12) | 1.35 | 500 | base | field labels, column heads, tabs on desktop, tile labels |
| `--t-caption` | 0.75rem (12) | 1.4 | 400 | base | meta lines, hints, footnotes (`--text-3`) |
| `--t-micro` | 0.6875rem (11) | 1.3 | 500 | base | nav labels, counts on the bar and the rail, key hints |
| `--t-num` | as body | | 400/600 | mono | any figure in a row or table |
| `--t-stat` | 1.1875rem (19) phone / 1.375rem (22) desktop | 1.15 | 600 | mono | stat tiles (§6.9); letter-spacing `--ls-tight` |
| `--t-hero` | 1.5rem (24) | 1.1 | 600 | mono | the single headline figure of a view, at most one |

Size tokens: `--fs-11 .6875rem · --fs-12 .75rem · --fs-13 .8125rem · --fs-14 .875rem · --fs-16 1rem (a dialog title, a
small tile on the desktop) · --fs-17 1.0625rem · --fs-18 1.125rem (the action bar's total) · --fs-19 1.1875rem · --fs-22 1.375rem ·
--fs-24 1.5rem`. The v1.0 names (`--fs-xs … --fs-3xl`) are gone (step 4). Letter-spacing: `--ls-tight: -0.02em`, `--ls-0: 0`
(the five raw `em` values in v1.0 are gone). Weights: 400, 500, 600 only.

### 3.5 Spacing and density

4px base; the existing `--sp-*` scale stays (`--sp-2 … --sp-32`, rem). Components never read `--sp-*` for
their **own** paddings and heights — they read density aliases, so one attribute changes the whole app:

| Alias | Comfortable | Compact |
|---|---|---|
| `--row-h` (table/list row) | 2.75rem (44) | 2rem (32) |
| `--row-h-2` (two-line row) | 3.5rem (56) | 2.75rem (44) |
| `--ctl-h` (button, input, select) | 2.75rem (44) | 1.875rem (30) |
| `--ctl-h-sm` | 2.75rem (44) — a touch target (polish pass, 27 Sep 2026; was 36) | 1.625rem (26) |
| `--pad-x` (cell, panel side) | `--sp-12` | `--sp-12` |
| `--pad-y` (panel head) | `--sp-10` | `--sp-8` |
| `--gap` (between panels) | `--sp-12` | `--sp-12` |

- `:root { data-density }` — **`compact` on the desktop layout, `comfortable` on phone and tablet** by
  default; the owner can override per device in Settings → Data & device → Appearance (`sep_inv_density`).
- **44px touch targets are kept wherever the pointer is coarse.** Compact is applied only under
  `body.inv-desktop` *and* `@media (pointer: fine)`; a touch laptop stays comfortable. Callouts, dialogs,
  toasts and form hints are never compacted.

### 3.6 Radius, elevation, motion, layers

- Radius (UI pass 3, the same on both layouts): `--r-card 1.125rem (18)` a card (a panel, a hero, a deck card, the phone's bar, a
  dialog's corners) · `--r-tile 0.875rem (14)` a tile, a PIN box · `--r-ctl 0.75rem (12)` a field, a select, a button, a segmented
  control's track, the search, a menu · `--r-seg 0.5625rem (9)` a segmented control's pressed pill · `--r-key 1rem (16)` a keypad's
  key · `--r-full` a chip, a badge, a dot, a switch, the toast. `--r-sm 0.25rem (4)`, `--r-md`, `--r-lg` and `--r-xl` stay for what
  they draw now (a tick box, a cell, a callout, a token, the sign-in card until U8) and are not used for a card.
- Elevation (DR-6): **a card lifts** by `--lift-1` (two shadows, a tight one under the edge and a wide one under the card: 6–7%
  tinted in light, 32–40% black in dark) and `--lift-2` (the same, further: the one primary, a card being moved, the phone's bar);
  **a well sinks** by `--press-1` (a field, a track, a PIN box: one inset shadow, 14% light, 45% dark) and `--press-2` (a tile in a
  card, lighter); **a layer floats** on `--shadow-pop: 0 0.25rem 1rem rgb(0 0 0 / 0.14)` (menus, toasts) and
  `--shadow-dialog: 0 1rem 3rem rgb(0 0 0 / 0.28)` (dialogs). Nothing else casts a shadow. `--shadow-tile` (8 Oct 2026) is
  retired: inside a card a tile is a well.
- A layer in dark (a dialog, the search, a menu) is a step over a card, and what is drawn on it reads the layer as its surface:
  inside `.inv-dialog` and `.inv-menu` the `--surface` tier is `--c-surface-2` in dark (and `--surface-2` is `--c-surface-3`), so a
  button, a panel or a pill on a layer never sits darker than the layer. Light is unchanged.
- Scrim: `--scrim: rgb(0 0 0 / 0.45)` (one token; v1.0 had four raw values).
- Hairlines (§5.2): `--hair: 1px` every divider, control edge and tile gap · `--rule: 2px` an accent rule, a chevron's stroke.
- Motion: `--dur-1: 120ms` (hover, press, toggle) · `--dur-2: 200ms` (panels, dialogs, tab switch, a two-faced dialog
  turning) · `--perspective: 75rem` (the turn's depth) ·
  `--ease: cubic-bezier(.2,.7,.2,1)`. All motion sits inside `@media (prefers-reduced-motion: no-preference)`.
  Tab changes may use the View Transitions API as a progressive enhancement; nothing depends on it.
- z-index tokens: `--z-bar 20 · --z-dropdown 50 · --z-scrim 100 · --z-dialog 200 ·
  --z-banner 300 (update and storage banners) · --z-toast 500 · --z-print 510` (a toast stays under the print preview, as
  it always has).
- Focus: `--focus-ring: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent)` on `:focus-visible`, **every**
  interactive element (v1.0's `inv-btn` had none).

### 3.7 Layout tokens

`--bar-h: 3.25rem (52)` phone top bar · `--bar-h-desk: 3rem (48)` · `--fill-h: calc(100dvh - --bar-h-desk)` the room under the desktop bar (less `--ctl-h`, one tab, where the workspace's row shows) · `--pane-host-min: 20rem` the least a list-and-pane host is squeezed to · `--nav-h: 4rem (64)` phone bottom
bar · `--nav-gap` the bar's float · `--door-w: 3.5rem (56)` / `--door-h: 2rem (32)` a door's mark (§6.1) · `--side-w: 5.5rem (88)` the desktop's rail · `--content-max: 80rem` desktop content cap ·
`--max-w: 32.5rem (520)` phone column (unchanged) · `--pane-w: 22rem` desktop detail pane · `--filter-w: 9rem`
a toolbar filter's basis · `--fade-w: var(--sp-24)` the edge fade of a sideways-scrolling table · `--col-sm-w: 8rem` a short ellipsized table column (`inv-col-grow-sm`) · `--scroll-max: 55vh`
a list scrolling inside a dialog · `--line-fig-w: 7rem` / `--line-unit-w: 5.5rem` the line editor's columns · `--menu-max: 17.5rem`
a suggestion menu's height. Settings' dialog: `--set-card-w: 55rem`, `--set-nav-w: 12.5rem`. Dialogs: `--dialog-w: 40rem`,
`--dialog-max-h: 90vh` (phone) / `--dialog-max-h-desk: 85vh`; `--toast-max: 30rem`. Grid minimums:
`--tile-min: 10rem` (a desktop tile), `--field-min: 12rem` (a desktop field), `--search-min: 16rem`; `--textarea-h: 5rem`;
`--dot: 0.4375rem` (a status dot). The challan scan's busy
card and its tokens (`--dur-spin`, `--z-busy`, `--busy-w`, `--spinner`) went with the photo reading, 13 Oct 2026. Charts (§6.17): `--chart-h` 15rem / `--chart-h-wide` 20rem,
`--pie` / `--pie-wide`, `--legend-min`, `--legend-row-h`, `--legend-pct-w`, `--swatch`, `--track-h`, and the drawing's own
text sizes in viewBox units `--chart-fs-axis` (9) and `--chart-fs-centre` (15), which scale with the drawing.

### 3.8 Breakpoints

JS already decides the layout (`init.js updateLayoutMode`): **phone < 768 · tablet 768–1023 (phone chrome,
wider column) · desktop ≥ 1024** via `body.inv-desktop` / `body.inv-tablet`. CSS keys off those classes, not
its own media queries, so the two can never disagree.

### 3.9 HR-6 exceptions (closed list)

1. `44px` minimum touch target (as `--touch: 2.75rem`, read via `max()`); 2. 20px/16px icon boxes (§5.6);
3. print CSS and the three document token blocks (`.inv-print-invoice`, `.inv-qc-page`, `.inv-cn-doc`) and
the sales register's `--sr-*` block; 4. SVG presentation attributes inside `charts.js` output (viewBox units),
which read `var()` for every colour. Anything else raw is a defect. Two things are written out because CSS allows nothing
else: a container query's width (`@container list (max-width: 70rem)` — a query's condition cannot read a custom property),
and the viewport itself (`100vh`), which is not a design value. *Confirmed in step 4 (26 Sep 2026) by sweeping
`styles.css` for raw px, rem, em, ms, hex and rgb outside the printed documents: these are the only ones.*
Two custom properties are set from code on an element, never a style in a template (HR-1): the print view's zoom
(`--pp-zoom`, `paperFit`: the print view's and a document drawn on a page, the report's) and a packed grid's row span (`--rows`, §6.25), each a count the layout measures.

### 3.10 Contrast (measured, WCAG 2.x)

Teal:

Light (re-measured 8 Oct 2026 for HR-9's ramps): text-1 ≥ 13.9 · text-2 ≥ 5.8 · text-3 ≥ 4.6 on the page, the surface and
`--surface-2` · accent/surface 5.7, accent/page 5.2 · on-accent/accent 6.0 · accent-soft text 8.1 · danger/danger-bg 5.8 · warning 5.4 ·
ok 5.5 · info 5.7; every tone ≥ 4.8 as text on any surface. Dark (unchanged): text-1 15.6 · text-2 8.4 · text-3 ≥ 4.8 on every
surface · accent 8.1 · on-accent/accent 7.8 · tones 6.6–7.8.
Zinc & brass: text-3 ≥ 4.6 light / 5.0 dark on every surface · accent 5.2 on the surface, 4.8 on the page / 8.3 · on-accent 5.4 · accent-soft text 7.1 / 9.0.
Terracotta: text-3 ≥ 4.6 light / 4.8 dark · accent 5.1 on the surface, 4.6 on the page / 6.9 · on-accent 5.3 · accent-soft text 7.2 / 8.3.
(Both alternates' `--c-text-3` were darkened from the mock-ups, which failed 4.5:1 on `--surface-2`; HR-9 darkened all three a
shade again, and Terracotta's accent from `#ad4f2c` to `#a94b28`. P180 measures every row in the browser.) A hero's eyebrow
sits on its fill's strongest corner, where `--text-3` falls to about 3.9:1, so a count in it reads `--text-2`.
**A new or changed palette must re-measure its row before it merges.**

### 3.11 App icon

Redrawn in the palette (owner, 26 Sep 2026: *"Redesign it in Teal, changes with the palette theme"*):
a full-bleed square in the palette's light `--c-accent` with a **nut**: a hexagon outline, a solid hexagon
inside it and a round hole — the plated part, and the same hexagon as the IM icon — in the palette's off-white `--c-on-accent`. No lettering,
so it reads the same at 16px and needs no font. The artwork sits inside the central 80% so the
one file is also a valid **maskable** icon. Masters are SVG, one per palette
(`icons/icon-teal.svg`, `icon-zinc.svg`, `icon-terracotta.svg`), with PNG exports at 192 and 512;
`icon-192.png` / `icon-512.png` at the root are the Teal exports the manifest names.

- **In the app** — the browser tab icon, the Apple touch icon and the rail's brand mark (`markSvg`, §5.6) — the icon follows
  the device's palette at runtime.
- ⚠ **The installed home-screen / Start-menu icon cannot follow it.** It is read from `manifest.json`, one
  file served to every device, and the browser fixes it at install and refreshes it only from that file. So
  the manifest carries **Teal**, the default. This is a platform limit, not a choice; if the shop settles on
  another palette for good, the manifest icon is switched to that palette's PNG in one line.

---

## 4. Information architecture

**The tab map (owner, 8–9 Oct 2026; `docs/TAB_MAP.md`) is the map.** Four sections by subject, and a door: **Today** (Needs you ·
Pulse, then its Insights, named in the row: Stats · Reports · Planner), **Office** (Pipeline · Challans · Invoices · Clients ·
Sales; Create is a page it holds without a tab), **Add** (one sheet, not a page), **Floor** (Overview · People · Production ·
Stock · Power) and **Money** (its own tabs: Overview · Receivables · Payments · Bank · GST). **History and Knowledge are tools in
the top bar** (a clock and a book), in no section, as Search and Settings are. An ID with a face (the entry faces) also has
**Mine**, its own screen, its door drawn first. Its rules (the tab map §3a):
1. **Four sections, by subject.** Today is the whole business, Office the paperwork, Floor the plant, Money the cash. Add is a door.
2. **One overview per section, first in its row:** Pulse, Pipeline, Floor's Overview, Money's Overview.
3. **Three levels at most:** the bar, the section's row, the screen's row. A form, a record or a review opens behind a back
   arrow (a sub-view) or in a dialog, never in another row.
4. **No row wider than five**, so every row fits a phone.
5. **One word, one meaning.** No tab name stands for two different places.
6. **A switch is not a tab.** Day / week / month, revenue / tonnage, the period: a segmented control on the screen.
7. **Tools sit on every screen**, in the top bar, never in a row.

Direction B (owner, 1 Oct 2026; `docs/DIRECTION_B.md`) built the workspaces as a layer over the pages, and replaced the bottom bar
and the sidebar below. Insights was a workspace of its own until 8 Oct 2026, then a group in Office's row, and the tab map put it in
Today; History and Knowledge left every row for the top bar (TM1). An old address is redirected to its new place (`navRedirect`).

**Three levels, the same on both layouts** (owner, 8 Oct 2026: *"in the desktop view we have many tabs that are actually tabs
that exist under a different tab but it is there on the sidebar which I feel is the wrong design choice as user will not
understand the hierarchy"*): a **workspace** is a door on the phone's bar or the desktop's rail, and nothing under it is
listed there; its **views** are a tab row under the top bar (`#wsTabs`, the §6.4 underline tabs, a group after a divider); a
**page's own views** are the row under that, a step smaller. What follows in 4.1 and 4.2 still holds for the back trail, the
top bar, sub-tabs, the action bar and the content, and is amended where marked.

### 4.1 Phone and tablet

- **Back** (nav.js, UX overhaul 2 step 1): an arrow at the top bar's start (`inv-topbar-back`) once there is a step
  to go back to. Every screen, view tab, sub-view and pane record is a step in the browser's history, so the arrow,
  the phone's back gesture, the browser's back, `Alt+←` and Backspace (never from a field) walk one trail. A dialog,
  the More sheet and a print preview are one step over the screen, so back closes them; a form with unsaved work (a
  field typed on a screen showing its action bar) asks *Leave without saving?* with **Stay** first, on Back and on any
  tap or swipe that leaves it (the bars, a view tab, a sub-view's back button). Create's form stays as typed and asks nothing.
- **Top bar** (`--bar-h`, `--surface`, bottom hairline): page title (`--t-title`), then at most **two**
  actions on the right — the view's primary action and one secondary (or an icon button) — then the
  tools, on every screen: **Search**, **History** (a clock), **Knowledge** (a book: the guides for the screen on show) and
  **Settings** (built 26 Sep 2026; History and Knowledge joined it in the tab map's TM1, when they left every row; History is
  hidden from a role that does not open it, and Knowledge is every role's). On the desktop Settings is the rail's last door instead.
- **Sub-tabs** sit directly under the top bar, inside the same surface (§6.4, underline tabs), and scroll
  horizontally when they do not fit — never cut off, never wrap.
- **Bottom bar** (`--nav-h`, §6.1): **Today · Office · Add · Floor · Money** (Direction B; Insights was its sixth from 6 to 8 Oct
  2026, and Add stood off its centre; there is no More), five doors, Add the centre one; each a mark over a `--t-micro`
  word; the workspace on screen fills its mark's pill in `--accent-soft`, Add in the accent; Add is the shell's primary. Each
  workspace carries the red count of the red rows that jump into it, on its mark's corner.
- **Mine** (the entry faces, F1, 10 Oct 2026; `docs/ENTRY_FACES.md`): an ID the owner gave duties (`users[].faces`) has one door
  more, **Mine**, drawn first on its bar and after Add on the rail (its mark a person), opening its own screen. It is drawn for
  nobody else, so the five doors stand as above for the owner and every ID without a face.
- **No floating action button.** The primary action is in the top bar. (v1.0 had both on Clients and Items.)
- **Sticky action bar** (§6.15) at the bottom of forms, above the bottom bar, carrying the total and Save.

### 4.2 Desktop

- **Rail** (`--side-w`, `--surface`, right hairline): the phone's bar stood on its side (owner, 8 Oct 2026, above), the same
  doors drawn the same way:
  - the brand mark (it opens Today → Pulse; *Soma Electro* is its label and title)
  - **Add** (the shell's one primary, key `A`)
  - **Today** · **Office** · **Floor** · **Money**, each with its red count
  - Settings, pinned to the bottom.
  No view of a workspace is listed: the views are the tab row under the top bar, as on the phone. Search is the top bar's field
  (`Ctrl K`). A role's doors it may not open are hidden (the guard, `docs/GUARD.md`), a workspace whose views it opens none of
  included. Until 8 Oct 2026 this was a labelled sidebar (13.5rem) listing every workspace's views under it, which put each view
  beside the workspaces as though it were one of them.
- **Workspace row**: under the top bar, in its surface and staying with it, one tab (`--ctl-h`) tall; `--fill-h` takes it off
  the room a list-and-pane screen fills.
- **Top bar** (`--bar-h-desk`): the back arrow · the trail (`inv-topbar-trail`: up to three earlier steps, each a
  link back to it, `Home › Challans · Awaiting invoice ›`) · title (`--t-title-desk`) · `/` · context (the view and the
  record open: *Awaiting invoice · Ch. 102*) · spacer · search · secondary actions · one primary. The workspace's tabs stood in
  the bar until 8 Oct 2026; with Office's nine they have the row under it.
- **Content** fills the rest; tables run edge to edge of the content area; a detail pane (§6.14) may take
  the right 22rem. The old 64px icon rail is retired.

---

### 4.3 The cognitive-load benchmark (the tab map §3b)

A screen passes when (`docs/COGNITIVE_LOAD_SURVEY.md`'s rules, read together, each with what measures it):
1. **The 6-second test**: one glance at the first screen says the state. A verdict leads, in its tone, with `data-verdict`;
   P195 checks it sits in the first phone screen wherever the tab map's §3d asks for one.
2. **What needs the owner leads**: a raised task, a red figure or a question comes before anything fine; finished records go in
   their own view tab or a fold.
3. **A long list shows its recent part** (`uiMoreHtml`: thirty rows, ten where each row is a question); the head's count and every
   total still cover the whole.
4. **A card taller than a screen folds** to its summary line (`uiFoldHtml`, `uiFoldCard`, `uiFoldRowHtml`), remembered per device.
5. **One fact, one screen**: its other screens keep at most a link.
6. **About three phone screens or fewer** (P195's `screens`), the day's work list (Needs you) aside.
7. **Today's card language**: a hero with a one-line verdict in its tone, opening to boxes coded by their own status (§6.21–6.26).
8. **The design rules** DR-1 to DR-9.
9. **No large blank areas, nothing cut, nothing past the screen's edge** (P76).
10. **HR-9, no white** (P76, P180).
11. **Words are short**: no text on a face over 120 characters (P195's `blocks`), no meta line chaining three facts or more with
    "·" (P195's `chains`). A row says two things; a third is a badge, the row's end figure, or a fact row in its fold. How a figure
    is worked out is the screen's guide (`kbguides.js`), not a note on its face.
12. **Controls are short**: on the phone a screen's toolbar is at most two rows, its controls and its tokens (P195's `toolbarRows`).
13. **One look**: the screen is assembled one way for its kind (DR-9; P197).

**The instruments**: P195 measures every screen of the map on the phone over the long book (made up, in the repository) on eleven
days of the calendar, the worst day kept, against a budget per screen that a step may only lower (the tab map's I10: no step leaves
a screen longer or wordier, and a screen that grows says so); P197 censuses every screen's kind, anatomy and box looks on both
layouts. **The owner's book is measured the same way in a scratch harness that never enters the repository**, at each step, before
and after. **The exceptions**: Needs you's length (the day's work list); a note shown as it was typed (a reason, a remark, a
register page's own note); a guide's own text; paper (a report, the power case, the print view).

## 5. Foundations for components

### 5.1 Surfaces
Page `--bg`; every block of content is a **panel** on `--surface` with a 1px `--border` and `--r-lg`
(`--r-xl` on the phone). A panel never sits inside another panel; group with a hairline instead. Both are tinted under HR-9's
ceiling (§3.1). On a screen built of cards (Today) a block is a hero instead, and what it holds is a coded box (§6.26).

### 5.2 Hairlines
Row dividers are `1px solid var(--border)`. The last row in a panel has none. Header bands use `--surface-2`
(phone) or `--bg` (desktop tables) with a bottom hairline.

### 5.3 Text in rows
Primary line `--t-body-strong`; meta line `--t-caption` in `--text-3`, mono when it is identifiers and
quantities (`ch 834, 835 · 348.09 kg`). Truncate with an ellipsis on one line; a truncated cell carries a
`title` with the full text. **On the phone and tablet a meta line takes up to two lines before it is cut** (line-clamp 2; the
title keeps one), and where a date or an amount follows a long name, the date leads (`25 Sep 2026 · GAMMA PRESS WORKS`). The
titles are not written per template: `uiOverflowCues()` (`state.js`) runs after every render, reads from the stylesheet which
selectors ellipsise, and gives each element that is actually cut a `title` with its text (`data-auto-title`, dropped again when
it fits; a title a template wrote is never touched).

### 5.4 Figures
`formatCurrency()` output, mono, right-aligned. Negative money is `−₹` (U+2212) and `--danger` (a figure judged against the live cost follows its judge: within 5% under it is `--warning`); positive
deltas that matter are `--ok`. Units after a figure are `--text-3` (`54 L`, `12 kg`). Deltas read
"+12% on Aug", not arrows alone. **A figure breaks only after a comma group, never inside it or its paise**: a tile's value
goes through `figWrapHtml()` (`state.js`), which puts a `<wbr>` after each comma and keeps the last group and its decimals
`inv-nowrap`, so ₹10,46,48,655.51 wraps as "₹10,46,48," / "655.51".

### 5.5 States
Hover `--surface-2` (pointer only) · pressed `--surface-3` · selected `--accent-soft` · disabled 45% opacity
and `cursor: not-allowed` · focus `--focus-ring`.

### 5.6 Icons
**Icons v3** (UI pass 3, U1; `docs/UI_PASS_3.md` §4; the canvas's *Icon set v3*: *"24 grid, 1.75 stroke, round ends, 2 px clear
of the edge. The ink line carries the shape; one brass tint fills its main part"*).
- **One set**, `ICONS` in state.js, drawn by `iconSvg(name, cls)` and never by hand in a module: a 24 viewBox, `stroke: currentColor`
  at 1.75, round caps and joins, `aria-hidden`, every glyph inside 2–22. Common shapes are Lucide's (lucide-static 0.460.0); the
  plant's own things are drawn to match (`vat`, `barrel`, `pickling`, `rack`, `zinc`, `chemical`, `part`, `overtime`, `truck`,
  `cheque`). A name kept from before keeps its call sites; aliases are one shape (`power` = `zap`, `upkeep` = `wrench`, `stats` =
  `chart`, `know` = `info`, `warning` = `alert`, `receipt` = `invoice`).
- **Two inks**: the line is the text's colour; a thing's main part carries one tint (a path stored `d:` in `ICONS`, drawn
  `inv-ico-tint` under the lines, fill only): the accent at a fifth. In a toned place (a coded card and its boxes, a deck card, a
  notice) the tint is the tone; in a status badge and on the accent (a primary button, the print bar) it is the ink's own colour,
  so a tint never says a status by itself. A door at rest draws its line alone; the workspace on screen its tint too.
- **The status icons** (§3.3, DR-8): ok `done`, warning `alert`, danger `cancel`, info `info`.
- **The mark** (the nut): one builder, `markSvg(size, tone)`: `'tile'` (the accent's tile with the nut's line, the rail and the
  lock) and `'brass'` (the nut cast in brass for the sign-in screen and the icon, U8); its gradient takes a new id each call.
- **`body.html` holds slots** (`<span data-icon="name">`), filled from the set by `iconFill` at boot, before `inv-booted`.
- Sizes: 20px on the phone, 16px (compact) or 18px on the desktop; a step's tick is `inv-ico-bold`. Icon-only buttons carry
  `aria-label`. Drawings that are not icons (a person's bars and stars, the plant strip, the Planner's charts, a QR) are not in the set.
- **The licences go with the build**: Lucide's ISC and Feather's MIT notices, in full, above `ICONS` and in Settings → Data & device →
  Backup, storage & build → **Licences**. P228 (`p228-icons.spec.ts`) holds all of it.

---

## 6. Components

Each entry gives the class, the anatomy, and what it replaces. Modifiers are `inv-<component>-<mod>`.

### 6.1 App shell — `inv-shell`, `inv-topbar`, `inv-side`, `inv-navbar`
As §4. `inv-topbar-title` (shrinks to an ellipsis before the tools are pushed off a phone; its full text in a `title`), `inv-topbar-ctx`, `inv-topbar-actions`; the rail `inv-side` of `inv-side-item` (`-on`) doors, its mark
`inv-side-brand`; the bar `inv-navbar` of `inv-navbar-item` (`-on`) doors. Replaces `inv-header`, `inv-tabs`/`inv-tab` (the old
bottom bar — which is why view tabs are `inv-viewtab`), `inv-sidebar*`, `inv-fab`, the sidebar's `inv-side-item-sub` and
`inv-side-count`, the dock's `inv-navbar-add-mark`.
**A door** (`wsDoorHtml`, workspace.js) is one geometry on the bar and the rail (owner, 8 Oct 2026: *"The bottom bar still doesn't
look right … that way we have 5 icons again, which can be arranged in a better way"*): its mark (`inv-navbar-mark`, the icon in a
`--door-w` × `--door-h` pill) over its `--t-micro` word, so the five words share one line; the workspace on screen fills its pill
in `--accent-soft` (its word `--accent-soft-text`, 600); **Add** (`inv-navbar-add`, the centre door) fills its pill in the
accent: the same shape, the strongest fill, never raised out of the bar; a red count (`inv-navbar-count`) is a pill on the
mark's top corner, ringed in the surface. **The phone's bar** floats `--nav-gap` above the screen's foot (above the safe area),
the surface's colour, a card's corners (`--r-card`) and fine edge (`--edge`), lifted by `--lift-2` as a card being moved is (DR-6,
UI pass 3); on a tablet it
keeps the phone's width, centred. **Under it the page fades into its own colour** (`body::after`, a gradient from clear to
`--bg` over `--nav-gap`, under the bar and never printed), so nothing scrolled beneath shows as a line cut in the gap.
`--nav-space` (the bar and its gap) is what the page keeps clear at its foot and where a sticky selection or action bar stands.
The 8 Oct morning's dock (an accent-tinted card, Add a disc raised out of it ringed in `--bg`) is retired: with six doors Add
stood off the bar's centre and its word off the others' line.

### 6.2 Page head (phone, in-content) — `inv-pagehead`
A sub-view (a form, a check, one record on the phone) leads with `inv-pagehead-back` — a ghost small button naming where it
returns — and its title in `inv-pagehead-title` (`--t-heading`, one line). **The summary line it once carried
(`inv-pagehead-meta`, "Last count 24 Sep · 17 lines") is deleted** (the tab map, TM6f, 10 Oct 2026): every screen's summary is
its verdict card (§6.28), and P197 fails a screen that draws a page-head line.

### 6.3 Buttons — `inv-btn`
`inv-btn-primary` (the accent deepening to `--accent-deep` down its face, lifted by `--lift-2`) · `inv-btn-secondary` (surface +
border, lifted by `--lift-1` — the default) · `inv-btn-ghost`
(transparent with a hairline border: a lighter secondary, never bare text, which reads as a label) · `inv-btn-danger` (danger text on the surface; `inv-btn-danger inv-btn-solid` is the filled one, used only
for the final button of a confirm dialog) · `inv-btn-link` (accent
text, no box) · `inv-btn-icon` (square, `aria-label`) · size `inv-btn-sm`, width `inv-btn-block`.
`inv-btn-grid` lays launch buttons out — three across on the phone (icon over label), one row on the desktop;
Home's quick actions are the one use.
Height `--ctl-h`, radius `--r-ctl`, `--t-body` 500 (primary 600). A button is a small card (UI pass 3): it lifts, a ghost and a link
cast nothing, pressed it sinks back to its card, and focus keeps the shared ring over its lift. Replaces `inv-stk-btn*`, `inv-stk-tool`,
`inv-stk-back`, `inv-link-btn`, `inv-quick-action`, `inv-header-btn`, `inv-overlay-close`,
`inv-att-nav-btn`, `inv-im-sel-btn`, `inv-sel-clear-btn`, `inv-td-fold`.

### 6.4 View tabs — `inv-viewtabs` (role=tablist)
Underline tabs: `inv-viewtab` (`role=tab`, `aria-selected`), `--t-label` desktop / `--t-body` phone, active
`--text-1` 600 with a 2px `--accent` inset rule at the bottom. Horizontal scroll on overflow. **The one
control for switching views** — Clients/Items/Performance, Staff Day/Week/Pay/Areas/Roster, Stats
Overview/Clients/Cost/Billing/Trends, Stock views. Replaces `inv-subview-toggle`, `inv-stats-tabs`, the chip
rows used as tabs (`inv-stats-chips` + `inv-chip` in staff.js), `inv-set-nav-btn` (Settings keeps its two-pane
layout, drawn with `inv-side-item`). **A group of a workspace's views** (Today's Insights; Office's before the tab map) follows its name,
`inv-viewtab-group` (`role=presentation`, `--fs-12` 600 in `--text-3`, a › after it), which is sticky at the row's right edge, on
the row's colour with a short fade at its left, until the group comes into view; a tap on it scrolls the group in and picks no
view (owner, 8 Oct 2026: *"Insights seems to be missing on mobile?"*). That row's tabs are `--sp-10` a side on the phone and
`--sp-6` under 24rem, so the name stands after the last tab of the first group, never over its word; on the desktop a hairline
sets the name off. **A row that fits shows no word** (the tab map, TM1: Today's Insights): on the phone, where the whole row fits,
the name is a `--hair` × `--sp-16` rule between the groups (`data-group="rule"`), since a word with nothing past it to name is a
cue to scroll a row that does not; only a row that would run past the screen keeps the word (`data-group="word"`, `wsRowFit`).
**A page's own tab row that runs past the screen fades** on the side with more, the table's cue (§6.11)
without its note (`data-more` start | end | both); the workspace's row never fades, its cue being the group's name.

### 6.5 Segmented control — `inv-seg`
A well (UI pass 3): the track sinks into its card (`--well`, `--press-1`, `--r-ctl`, its fine edge) and the pressed segment is a
pill of `--surface` lifted in it (`--lift-1` on its `::after`, `--r-seg`), its words `--text-1` 600, on both layouts (as on the
approved board: a 36px pill in a 44px track). The pill sits `--seg-inset` in from the track (`--sp-4`, `--sp-2` compact) while the
segment stays a 44px target on the phone: its transparent border is the track's margin and its fill is clipped inside it
(`background-clip: padding-box`); its focus is the accent ring drawn on the pill, inside the track's clip. For a **setting of the
current view**, not navigation: period (MTD/QTD/YTD/All), span
(1/4/12 weeks), metric (₹ / Tonnes / ₹/kg), density. `inv-seg-btn` (`aria-pressed`). A segment that records a status
(Staff → Day's P / H / A) carries its tone, `inv-seg-btn-ok|warning|danger`, and its pill is the tone's bg in its colour, in
both themes and on both layouts. `inv-seg-fit` keeps a segmented control the width of its
buttons (`--ctl-h-sm`), for a card's head or toolbar (Stats' Ranked / Share, the trend's series, step and chart). Replaces `inv-stk-seg`,
`inv-stats-chips` as period pickers, `inv-pred-chip`.

### 6.6 Filter tokens and chips — `inv-token`, `inv-chip`
- `inv-token`: an **applied** filter, "`Month` Sep 2026 ×", `--surface-2`, `--r-md`, key in `--text-3`.
- **`inv-tokens`** (one look, TM1; `uiTokensHtml`, state.js): on the phone the filters applied behind a toolbar's **Filter**
  (§6.7) stand under it as a row of tokens, each a `button.inv-token` clearing its own (`aria-label` *Clear Client: SSS Mehta*);
  a sort other than the default is a token too. The desktop shows the filters themselves inline and draws no tokens.
- `inv-chip`: a **choice among options** inside a form (zero-rate reason, P/H/A on the desktop grid,
  stock basis). A pill (`--r-full`) of `--surface` lifted by `--lift-1` (UI pass 3); picked (`inv-chip-on`, `aria-pressed`) it
  sinks into `--accent-soft` (`--press-2`), edged in the accent. One definition (v1.0 defined `.inv-chip` twice). Replaces `inv-zero-opt`,
  `inv-stk-choice`, `inv-td-pill`, `inv-att-chip`, `inv-rm-chip` as a picker.

### 6.7 Toolbar and search — `inv-toolbar`, `inv-search`
`inv-toolbar`: search + tokens + view settings, one line on the desktop, wrapping to two on the phone.
`inv-search`: a well (UI pass 3: `--well`, `--press-1`, `--r-ctl`, its fine edge) with the search icon (`--text-2`) inside and,
on the desktop, a `/` key hint; focused, the accent edge and the ring.
Every searchable list uses it. Its field fills the box to the border, so the whole `--ctl-h` box is the tap that types
(it was a 16px line of text in a 44px box). `inv-stepper` is a period stepper: an `inv-btn-icon` back, the period in
`inv-stepper-label` (a date field, or `inv-stepper-title` over `inv-stepper-sub`), forward, and a ghost *Today* / *This week*. Filters beside it are `inv-toolbar-item` (a select, a month, a labelled date field),
sharing the line and wrapping two to a row on the phone; on the desktop a select, a month and a labelled date field are as
wide as their control, not a share of the row (Register's and History's From / To). Replaces `inv-reg-toolbar`, `inv-im-toolbar`, `inv-items-toolbar`,
`inv-cp-toolbar`, `inv-history-filters`, `inv-search-wrap`, `inv-reg-search`. A period that is one of a toolbar row's items (the Planner's month, Attendance's day and week, Pay's and Areas' week) is an
`inv-tb-step`: back, the period (a date field or `inv-stepper-title`), forward, as one item of the row (the tab map, TM4b; it
was the Planner's `inv-pl-step`). The way back to today is a ghost button beside it on the desktop and More's on the phone.

**One row** (one look, `docs/TAB_MAP.md` §1a-2, §1a-10; built in TM1, applied screen by screen from TM2): a screen's toolbar
is one row on both layouts: the search, the filters, the view's one primary, at most one secondary, and **More**.
- **Filter** (`uiFilterHtml({key, controls, count})`): on the phone one secondary button, the count of filters applied as a
  badge, opening a dialog that holds the screen's own controls (their own ids and `change` handlers, drawn only while it is
  open, from a `<template>`) and **Done**. A control applies as it changes; however the dialog shuts (Done, ×, a tap outside,
  Back) the row is drawn again with the filters as they stand (`UI_FILTER_DONE[key]`, else the page in place), and the
  applied ones show as tokens under it (§6.6). On the desktop the controls are the row's, inline.
- **More** (`uiToolbarMoreHtml(items)`): on both layouts, everything the row has no room for (files always: Export, Import,
  Print sheets, the register's CSVs; Add → File stays the one door that takes any file). A secondary small button with an
  ellipsis, `aria-haspopup="dialog"`, opening a dialog titled *More* whose rows carry the same `data-action` and data the
  item had on the row, so `events.js` routes them unchanged. A pick shuts the dialog first, then acts (a layer it opens is
  drawn after; Back passes over More's step). **A badge an item carries is carried by More**, summed, in the worst tone, so
  nothing waiting hides behind it; **a count that waits on nothing** (a neutral badge: how many credit notes there are) stays on
  its row and is not carried (TM5c). Where a phone's row holds a stepper or a period beside its primary (the Planner's, Pulse's
  head), or four controls besides (Invoices, Challans, Parts: TM5), More is its mark alone (`{icon: true}`), named *More* for a
  screen reader.
- **The phone's search shares its row**: beside other controls it takes what the row leaves, never under three quarters of a
  column (`--col-sm-w`), so the row stays one (TM5c). A choice picked inside Filter that is one choice (Parts' *No weight*) shuts
  the dialog on the pick.
- **Invoices' desktop row never wraps** (TM5c): at 1024px its six controls wanted 926px of 872. The row does not wrap, its search
  gives up room first (`--col-sm-w` its basis) and its client picker is at most a column and a half; the range is a dialog of its
  own (*Range*, the button saying the range in use), and select-all is the table head's box.
- **A segmented control as the row's item** (`inv-seg inv-toolbar-item`: Pulse's period) takes what the row leaves on the phone
  and is as wide as its segments on the desktop.

### 6.8 Panel — `inv-panel`
A card (UI pass 3): `--surface`, its fine edge `--edge`, `--r-card` on both layouts, lifted by `--lift-1`.
`inv-panel-head` (`--t-heading` title · optional count in mono `--text-3` · spacer · actions as
`inv-btn-link`/`-sm`: one phrase that never wraps, as tall as a small button, and with no side padding so it lines up with the figures below it), then body. A panel's sides and an `inv-panel-body`'s are `--pad-x`, the same as a flush panel's head and rows, so text in padded and flush panels starts on one line. `inv-panel-flush` for a panel whose body is rows or a table (no padding); inside one, `inv-panel-body` is a padded block (a form or a note) ruled off from the rows below it. A card's total sits in its head as `inv-num`. A picker or figure in a row's end is `inv-select-sm` / `inv-input-sm` (`--col-sm-w`, `--ctl-h-sm`). A set of four tiles that must read as one row on the desktop, even in a half-width panel, is `inv-tiles-4`; a cell that is one token to the reader (a month, a date) is `inv-nowrap`. `inv-panels` lays panels out: one column
on the phone, two on the desktop, `inv-panels-wide` spanning both; an empty host is not drawn. `inv-panels-dense` lets a half panel
fill the gap beside another (a dashboard of half and wide cards: Stats). A panel's qualifier ("worst first", "by invoice date") is an
`inv-note` inside its `inv-panel-title`.
Replaces `inv-card`, `inv-card-list`, `inv-stats-card`, `inv-im-challan`, `inv-stk-hero`, `inv-stk-metabox`,
`inv-set-sec`'s box, `inv-dupe-group`, `inv-td-facts`, `inv-rl-rows`.

### 6.9 Stat strip — `inv-tiles`, `inv-tile`
A grid of tiles, each a box of its own (owner, 8 Oct 2026: *"Let's give our tiles elevation as well"*), **a well since UI pass 3**:
sunk a step into the card it stands in (`--well`, the fine edge, `--r-tile`, `--press-2`; in a coded card a well of its own tone,
§3.3 *Fills*), so the card is what lifts and its figures sit in it (DR-6); the strip lays them out with a `--sp-8` gap and draws
nothing itself. Until 8 Oct 2026 the tiles were one bordered box divided by 1px gaps on `--border`; from then until UI pass 3 each
was lifted by `--shadow-tile`.
`inv-tile-label` (`--t-label` `--text-3`), `inv-tile-value` (`--t-stat`), `inv-tile-sub` (`--t-caption`; a value too long for its tile — a crore on a phone — wraps rather than being cut by the tile;
toned only when it states a status). A tile that filters its list is a `<button>`. Tone modifiers
`inv-tile-danger|warning|ok|info` colour the **value only**. 2 columns on the phone, up to 5 on the desktop.
A tile that filters is pressed with `aria-pressed` (`--accent-soft`, edged in the accent, sunk deeper: `--press-1`) and pressed
again to let every row back. `inv-tiles-3` keeps three counts on one row on the phone too. In the desktop pane
a strip is two across. `inv-tile-of` is the quiet denominator or unit after a value (`15/21`, `/kg`). `inv-tiles-flush` is a strip inside
a flush panel: the panel draws the box; the strip keeps `--pad-x` round its tiles and a divider under it. In a grid of panels
(`panel-w`) the strip goes two across under 32.5rem and four only from 43rem (three tiles and their gaps, then four, with a
panel's padding), so the last row never leaves a blank cell.
Replaces `inv-kpi*`, `inv-ov-tile`, `inv-stk-tile`, `inv-stat-label/value`, `inv-lab-half`, `inv-lab-perkg`,
`inv-area-stat`, `inv-stats-metric-value`, `inv-att-count-value`, `inv-flip-kpi`.

### 6.10 Rows — `inv-row`
One or two lines, `--row-h` / `--row-h-2`, divider below. Slots: `inv-row-lead` (checkbox, dot or icon),
`inv-row-main` (`inv-row-title` + `inv-row-meta`), `inv-row-end` (figure, status, chevron). A group header
inside a list is `inv-row-group` (`--t-caption` on `--bg`, e.g. "25 Sep · 5 · ₹11,801.88").
`inv-row-main` may be a `<button>` when the row has a second action (a print icon, a tick box) — otherwise the
whole row is the `<button>`, so its figures open it too; a main `<button>` reaches the row's top and bottom edges over its
padding and is never under `--touch` on the phone (it stopped short by the padding: 43px on a two-line row); a tick box's lead is a `<label class="inv-row-lead inv-row-tick">`
holding the full `--touch` target (it reaches the row's top and bottom edges, and a row that sizes to its content is never shorter than `--row-h` while it holds one); `inv-row-stack`
stacks a figure over its badge in `inv-row-end`; `inv-row-wrap` lets a meta line wrap (a list of names);
`inv-row-muted` is a cancelled or inactive row (a voided stock entry); `inv-row-top` keeps the end at the top of a
row holding blocks (a quoted line, a callout, a field); `inv-row-flow` lets a row's end — fields, a long figure — drop
under its main on a narrow screen, right-aligned; in a flow row, `inv-row-actions` is an end of buttons that takes a line of its
own under the row on the phone (a credit note's Reference / Cancel), so buttons never squeeze the title and meta; a segmented control at the end (Staff → Day's P/H/A) keeps each button a whole 44px target; `inv-row-end-stack` stacks the end's figure over its status on the phone (Power → Cuts); a navigation row for the page on screen is `aria-current="page"`
(accent title and icon); `inv-row-done` a task ticked done (struck through, never deleted). `inv-row-fold` is a `<details>` whose `<summary>` is the row
(chevron drawn in CSS) and whose parts are `inv-row-children` (a live cost component folding open to labour by tier, chemicals by line). A row that opens its own lines beneath it (a challan's items) has an
`inv-row-expander` main button (`aria-expanded`, a chevron drawn in CSS) and its lines in `inv-row-children`,
indented on the page colour. **The phone form of every table.** Replaces `inv-client-item`, `inv-item-card`, `inv-rnd-row`,
`inv-im-header`, `inv-att-row`, `inv-area-row`, `inv-history-item`, `inv-stats-row`, `inv-lab-row`,
`inv-pay-row`, `inv-rate-row`, `inv-cost-dline`, `inv-td-hrow`, `inv-more-item`, `inv-stk-row`,
`inv-stk-hrow`, `inv-stk-mrow`, `inv-td-row`.

**A row's end holds its figure and its status, or one action** (one look, `docs/TAB_MAP.md` §1a-11; `uiRowEndHtml(fig,
status, action)`, state.js): the figure (mono), then a dot and a word, stacked where both stand (`inv-row-end-stack`), or one
button. A row with more to do draws the rest with `uiRowMoreHtml(actions)`: in the row's fold on the phone (`inv-row-actions`,
`data-row-more`), and nowhere on the desktop, where the pane beside the list draws them with the record.

**A long list shows its first rows** (`uiMoreHtml`, state.js; UX overhaul 2, step 6): thirty by default, ten where each
row is a question (a client's Materials, the Stats client tables, unplaced receipts), then one row with a link button,
*Show 71 more parts · 101 in all*, that shows the rest in place. The rest are drawn and `hidden` (never wrapped: a wrapper
would make every row its container's last child and drop the dividers), so it works alike on a page, in a pane and in a
dialog; a group head is held back with the row under it; a list shown stays shown until a reload. The head's count and
every total always cover the whole list. **A card taller than a screen folds** (`uiFoldHtml`: an `inv-panel-fold` whose
summary is the head saying what is in it, `data-fold` naming it; open or shut is remembered on the device), open by
default when it holds a problem (a wage leg off its slip).

### 6.11 Table — `inv-table`
A real `<table>`. `thead` sticky, `--t-label` `--text-3` on `--bg` with a bottom hairline; rows `--row-h`
with hairlines; numeric columns `inv-num` (mono, right); identifier columns `inv-id` (mono); status column
dot + word; checkbox column `inv-table-check`. Selected row `--accent-soft`. `tfoot` for totals. Column widths
are classes reading tokens (`inv-col-date`, `inv-col-money`, `inv-col-state`…), never raw px. `inv-col-grow`
takes the spare width and ellipsizes (a client's name never wraps). **Columns drop in priority as the list
narrows** — `inv-col-opt1` first, then `-opt2`, then `-opt3`, by container query on the list, so the same table is
right at 1024px and 1920px, pane open or shut. Sortable heads are `inv-table-sort` buttons with `aria-sort`; the row
open in the pane is `aria-current`; the row's identifier is a real button, so it opens from the keyboard.
Tick boxes are `inv-check`.
A group heading inside a table (a status, a supplier) is a `tr.inv-table-group` — the table form of `inv-row-group`.
A unit after a figure is `inv-unit` (`--text-3`, §5.4). A signed figure is `inv-num-pos` / `inv-num-neg` (`--ok` / `--danger`): its
`+` / `−` is the symbol the tone travels with (DR-1).
Modifier `inv-table-grid` for the week grid: cells are `inv-cell` chips (`-ok|warning|danger|empty|future`)
showing hours; a tappable cell is `button.inv-cell`. The grid scrolls sideways in its panel (`inv-scroll-x`) with the name
column sticky. **Every table that scrolls sideways says so** (`inv-scroll-x`, any table — Six months, contribution by client, the
week grid): `uiOverflowCues()` sets `data-more` (`start`, `end`, `both`) on render and on scroll, which fades that edge by a
mask `--fade-w` wide (it works over opaque cells and in either theme; a grid with a sticky name column fades at its end only),
and while it overflows an `inv-note inv-scroll-hint` under it reads "Scroll for more →" (kept while it overflows, so removing it
never moves the page); Sunday's column is `data-sun`, today's head `aria-current="date"`, a day's date under its name
`inv-table-grid-date`. Replaces `inv-desktop-table`/`inv-th`/`inv-tr`/`inv-td*` (**ending the `inv-td-` collision
with To-do**), `inv-stats-table*`, `inv-ov-table`, `inv-detail-items-table`, `inv-att-grid`.

### 6.12 Selection bar — `inv-selbar`
Appears at the bottom of a list or table while rows are ticked: "3 selected · ₹30,419.97 taxable", bulk
actions as `inv-btn-sm`, and the list's own total on the right. Replaces the register and IM selection
strips. The rule stands: **a selection never outlives the filter that hid it.**

### 6.13 Status — `inv-dot`, `inv-badge`
- `inv-dot` + text: 7px dot in the tone, word in `--text-2`. Default in rows and tables (DR-8).
- **A judged figure** (`figHtml`, state.js): the figure's text in `--ok`, `--warning` or `--danger` (`inv-fig-*`); a tile
  takes the tone on its value (`inv-tile-ok/warning/danger`). The rules live in one place, state.js: a figure against the
  line it must clear (`figToneAgainst`: ok past it, warning within 5%, danger beyond — realisation against cost), a
  debt's age (`figToneAge`: 60 / 90 days), days to pay (`figTonePaysIn`: 30 / 60), capacity used (`figToneCapacity`:
  80% / 60%), a gated share (`figTonePct`: attendance at 90% / 80%). **A headline figure carries a change line**
  (`figDeltaHtml`): *+12.3% on same days last month*, level within 2%, coloured ok when it moved the good way, warning
  the wrong way up to 10% and danger past it; a count's change is said and never coloured.
- **A dot's words wrap where its box is narrow** (TM5): in a row's wrapping meta, a tile's sub and a panel's head
  (`.inv-row-wrap .inv-dot`, `.inv-tile-sub .inv-dot`, `.inv-panel-head > .inv-dot`), never running past its box or under a
  fold's chevron (the folded Turnaround card on Performance did, on the phone).
- `inv-dot-mark`: a 20px filled dot carrying its own symbol (`!` to act on, `i` to know), `-danger|-warning|-ok|-info`; the lead of a row that has no room for the word (an app task).
- `inv-badge`: soft pill, `--t-label` 500–600, tone bg + tone fg, `--r-sm`. For states that need weight:
  "Needs you", "Check", "No rate on record", a rate-check verdict on a line.
- Tones: `-danger | -warning | -ok | -info | -neutral`. **These five are the only tone words in class
  names**; the domain word ("Dispatched", "4 days?", "Partial") is the text.
Replaces `inv-client-badge`/`inv-badge-*`, `inv-state-badge`, `inv-cancelled-badge`, `inv-im-status`,
`inv-zero-badge`, `inv-override-badge`, `inv-rm-chip`, `inv-stk-chip`, `inv-stk-flag`, `inv-att-pill`,
`inv-att-badge`, `inv-area-badge`, `inv-kpi-delta`, `inv-cost-src`, `inv-td-lbl`, `inv-numaudit-count`,
`inv-im-dupe-count`, the weight/gauge/usage badges, and the left-rule tone families (`inv-stk-tone-*`,
`inv-td-tone-*`, `inv-area-over/under/ok`, `inv-stk-issue-*`).

### 6.14 Detail pane — `inv-pane`
Desktop only: the right `--pane-w` of a list view, `--surface`, left hairline. **It takes room only while something
is open** (a close button in its head), and where the screen cannot hold both it takes the list's place until closed. Two panes
hold the screen's own working while no record is open, rather than push the list below the screen's foot: Stock's **Spend and
prices** (a toolbar button, TM4d) and Quotations' **To reprice** (Pulse's reprice moves, TM5g; the phone's are its card's body). Head (identifier in `--t-hero`
mono, status badge, party), a key/value grid (`inv-kv`), a nested table, totals, actions (one primary).
On the phone the same content opens as a sheet (§6.16).
The list and its pane sit in an `inv-pane-host` (the list is `inv-pane-list`), which carries `inv-pane-open` while something
is open; the pane's head is `paneHeadHtml(title, closeAction)` in `state.js` — Register, IM, Clients / Items / Quotations,
Stock, Pipeline, and since UX overhaul 2's step 7 Finance → Receivables, Production → Entries, Staff → Roster and History.
The open record is the list's `aria-current` row (a table row or an `inv-row`: `--surface-2` and the accent's inset rule), and
its id is the address's `id` (a reload and Back follow it). A list whose rows carry their own actions keeps them; its main is
the button that opens the pane. The phone is unchanged by a pane: the record opens where it always did.
**The host fills the viewport; the page does not scroll.** A page holding a visible `inv-pane-host` is a flex column
`--fill-h` tall (`100dvh` less `--bar-h-desk`); its head, view tabs and toolbar keep their height, and the host and each
wrapper between it and the page take the rest (`flex: 1 1 0`). The list and the pane scroll inside themselves. Nothing is
subtracted by hand. Content above the host taller than the screen squeezes it only to `--pane-host-min` (20rem), and past
that the page scrolls like any long page. A host hidden under a form leaves the page an ordinary document.

**Three columns on a wide screen.** `inv-panels` is two columns on the desktop; `inv-panels inv-panels-3` (Pulse's
questions and widgets, Stats, Finance's Overview, Needs you) is three from a 100rem (about 1,600px) window, and only those: a
grid of two lists or a few cards (To-do, Create, Floor, Production, Stock, Power) left a column empty at three. Needs you and
Pulse's widgets are packed (§6.25), so cards of different heights leave no hole under the shorter.
`inv-panels-wide` still spans the row. Every panel in a grid is a `panel-w` container, so a strip of tiles in a third of the row
goes two across with an odd last tile taking the row, never a blank cell.

**A redraw keeps the scroll.** A screen drawn whole with its host in it draws through `paneScrollKeep(fn)`: the list's and the
pane's `scrollTop` are put back after the swap, the pane's only while the host's `data-open` names the same record.

### 6.15 Forms — `inv-field`, `inv-input`, `inv-select`, `inv-actionbar`
- `inv-field`: label **above** the control, `--t-label` `--text-2`, **sentence case** (DR-5); hint below
  in `--t-caption`; error below in `--danger` with the field's border `--danger`.
- `inv-input` / `inv-select` / `inv-textarea`: `--ctl-h`, a well (UI pass 3: `--well`, `--press-1`, its fine edge `--edge`,
  `--r-ctl`); focus border `--accent` + `--focus-ring` over the press. A select's open list is drawn on `--surface`.
  `inv-input-num`: mono, right-aligned. Read-only: `--surface-2`, flat (nothing to fill).
- `inv-fields` lays fields in a grid: 1 column phone, 2–4 desktop.
- **Line editor** — `inv-lines` holding `inv-line`s, shared by the invoice and challan forms. On the phone a line is
  a three-up grid under "Line n" (`inv-line-num`, the remove icon button `inv-line-rm` beside it): `inv-line-part`
  across, then qty · unit · pcs, then rate · `inv-line-amt`; figures are `inv-input-num`. On the desktop the same
  fields sit on one row under `inv-lines-head` (column widths `--line-fig-w`, `--line-unit-w`), so the lines read as a
  table; it is a grid rather than a `<table>` because one DOM serves both layouts and every control keeps its `data-k`.
  Below the fields, `inv-line-notes`: the rate/weight **verdict** as `inv-verdict` (`inv-dot` + word, then the
  working in mono), with `data-verdict` on the note and on the Rate field (a Check fills the field `--danger-bg`; a rate
  on record in another unit, *Another unit*, borders it `--warning` and stops nothing);
  a question that holds the save (a ₹0 line's reason, a red flag's) is a callout holding `inv-chip`s and a note input.
- `inv-field-check`: a tick box (`inv-check`) and its words on one line, the whole line its `--touch` target (Settings'
  To-do rules, auto backup). Replaces `inv-checkbox-label`, `inv-check-row`.
- `inv-textarea-mono`: a message pasted as sent (the stock and attendance rolls), mono, one line per line.
- `inv-panel-fold`: a `<details>` panel whose `inv-panel-head` is the summary (optional details). The fields stay in
  the page while folded; the Enter-to-next-field chain steps over them.
- `inv-keys`: a line of key hints (`inv-kbd`) above a keyboard-first form, desktop only.
- `inv-actionbar`: sticky at the bottom of a form — total (label + `--t-stat`), secondary, primary. The total's figure is never cut: when it and the buttons do not fit one line the buttons wrap under it, still at the right.
- `_sfg()` is Settings' field helper; it draws `inv-field`s.
Replaces `inv-form-group/label/input/select/row`, `inv-stk-label`, `inv-stk-field(s)`, `inv-stk-in`,
`inv-td-in`, `inv-reg-range-field/label`, `inv-area-target-label`, `inv-att-block-label`, and on Create `inv-line-item`/`-header`,
`inv-rm-*`, `inv-zero-*`, `inv-pred-*`, `inv-kbd-hint`, `inv-im-form*`, `inv-selected-client`, `inv-error`.

### 6.16 Overlays — `inv-dialog`, `inv-sheet`, `inv-menu`, `inv-toast`
- `inv-dialog`: a sheet from the bottom on the phone (full width, `--r-card` top corners) and centred on the desktop
  (`--r-card`, `--dialog-w`), `--shadow-dialog`, edged by `--edge`, in dark a step over a card (§3.6), in an `inv-scrim inv-scrim-dialog` (the dialog's scrim, above the More
  sheet's). Head `inv-dialog-head`: the `inv-dialog-title` and the close button `inv-btn inv-btn-icon inv-dialog-close`
  (optionally actions before it); a body (`inv-dialog-body`, where a dialog wraps its content: a word with no space breaks rather than widening the sheet); `inv-dialog-foot` the actions, right-aligned, primary last, **sticky
  at the dialog's foot, so it is always its last child**. Every dialog is opened through `dialogOpen(html, {dismiss,
  replace})` and headed by `dialogHeadHtml(title, closeAction, closeLabel, actionsHtml)` (`state.js`): it pushes focus,
  locks the page and moves focus in; `dismiss` lets a tap on the scrim close a view (never an act); `replace` redraws the
  top dialog in place. `closeOverlay()` / `closeTopOverlay()` shut them and give the focus back. **A dialog holding typed work is never shut
  unasked**: any field changed marks its scrim `data-typed`, and a tap on the scrim or the head's × then asks *Discard what
  you typed?* with Keep editing first (`dialogLeaveOk`); Cancel and a save close as before (P92). A two-faced dialog
  (Stats' client drill-down) shows `inv-flip-front` or `inv-flip-back`, turning over (`inv-flip-out` / `-in`, `--dur-2`).
- Confirm dialogs for destructive actions: danger-filled primary, the consequence stated in the body.
- **Asking, telling and prompting are dialogs too, never the browser's** (27 Sep 2026): `uiConfirm`, `uiAlert` and
  `uiPrompt` (`state.js`) draw an `inv-dialog` in the shell — title, the words in `inv-ask-body` (line breaks kept), a
  prompt's `inv-field`, and a foot of Cancel then the act (`inv-btn-danger inv-btn-solid` when it destroys, focus then
  on Cancel). Esc, the scrim and × answer cancel. If the shell cannot draw, the text goes to the **notice banner**
  (`inv-notice-bar`, a list of `inv-notice-text` under the top bar, beside the update and storage banners, until
  Dismiss) and a question is answered cancel; an uncaught error reaches the same banner.
- `inv-menu`: dropdowns and autocompletes, `--surface` (a layer, §3.6), its fine edge, `--r-ctl`, `--shadow-pop`, keyboard as now. It hangs off its
  field in an `inv-combo` (max `--menu-max`); options are `inv-menu-item` (`inv-menu-title`, `inv-menu-meta`), the
  arrow-key cursor is the option's `aria-selected`, and the create-a-part row is `inv-menu-add`.
  Replaces `inv-autocomplete-*`, `inv-ac-*`, `inv-search-results`/`-item`.
- The phone sheet is `inv-sheet` in an `inv-scrim` (grab bar `inv-sheet-grab`), its entries `inv-row`s edge to edge,
  clear of the bottom bar: the More sheet.
- `inv-dialog-wide`: a dialog holding a list of groups and one group's content (Settings). `inv-dialog-panes` lays it
  out; `inv-dialog-nav` is the list (`inv-side-item`s, the open one `inv-side-item-on` + `aria-current`), shown on the
  desktop only; `inv-dialog-main` scrolls under a head that stays put, holding a `section[data-group]` per group (the
  open one `data-on`; the phone stacks them all under an `inv-pagehead-title`).
- `inv-scroll`: a list inside a dialog scrolls within `--scroll-max` rather than pushing the dialog's buttons off screen.
- `inv-toast`: under the top bar, centred (clear of the action bar and the bottom bar), a pill (`--r-full`, UI pass 3), `--text-1`
  background with `--surface` text (it inverts with the theme), `--shadow-pop`, tone shown by a leading dot (its kind's icon arrives
  with §14 of UI pass 3, U7) (`inv-toast-success|info|warning|error`; info says what another window did, *Updated from another window*).
Replaces `inv-overlay-scrim/card/header/title/close`, `inv-more-scrim` (the duplicate scrim),
`inv-confirm-*`, the To-do overlay's Fraunces title.

### 6.17 Charts — `charts.js`
Same module, restyled: axis text mono `--text-3`, gridlines `--border`, baseline `--text-3`. The line chart's parts are
`inv-chart-grid` / `-grid-label`, `inv-chart-area`, `inv-chart-line`, `inv-chart-dot`, `inv-chart-axis` (v1.0 called them
`inv-svg-*`); an empty chart is an `inv-empty`.
**Single series:** bars `--surface-3`, the current or selected bar `--accent`, value labels mono above bars.
**Second measure** (e.g. ₹/kg over revenue): a 1.5px `--text-2` line. **Categorical:** `--chart-*`.
Legend is inline in the panel head. Every datum keeps its `<title>`.
**Axis, keys, legend and a pie's centre abbreviate money the Indian way** through one helper, `formatInrShort()` (`state.js`,
read by `chartShort`): ₹950, ₹12.5K, ₹8.4L, ₹12.0Cr — thousands to 99.9K, lakh to 99.9L, then crore; negative `−₹`. A readout,
a `<title>`, a table and a tile keep `formatCurrency()`'s exact figure. **An x-axis label stays inside the drawing**
(`_chartXLabel`): centred under its datum unless that would cut it at the edge, where it is anchored inward (`end` at the right,
`start` at the left) — every line and bar chart. **A legend row that takes a tap is a touch target**: at least `--ctl-h-sm`
(44px comfortable, 26px on the compact desktop, so the desktop legend stays dense). SVG `font-size` attributes become the
`--fs-*` tokens via `var()` on the text elements' class.

**Charts that answer questions** (26 Sep 2026, finance spec Phase 2). Each is drawn into an `inv-chart-box`: the
drawing, its keys (`inv-chart-keys`, each series with its last value), and an `inv-chart-readout` line (the base face: it reads as a sentence, "Tap a point to read it", until a tap writes a figure into it) — a phone has
no hover, so a tap on any datum writes its exact figure there (`data-read`, action `invChartRead`, `chartShowRead`),
and the tapped datum is ringed.
- `chartLines(labels, series, opts)` — several series on one axis (`--chart-*` strokes `inv-chart-s0…7`), a range
  that crosses zero draws a zero rule (`inv-chart-zero`), `opts.band` draws a forecast range (`inv-chart-band`).
  `opts.fit` frames a price around its data (`chartFitRange`: four steps of 1, 2, 2.5 or 5 × a power of ten) rather
  than from zero, where a few percent is invisible; `opts.xs` places each label at its distance in time (a day count),
  so bills weeks apart and market days side by side share one honest axis, labels thinned by room.
- `chartStack(labels, series, {mode: 'stack'|'group'})` — a whole of parts, or two figures side by side; a segment
  carries `data-key` and an optional action, and the selected key is ringed.
- `chartPieTap(slices, {action, selected})` — a pie that filters: wedge and legend row (a button) carry the action
  and key; the selected wedge is pulled out. The centre shows the total and never takes a tap.
- `chartRangeHtml(active, action)` — `3M · 6M · FY · All` chips; `chartRangeMonths(range, months)` says which months.

**The period not yet ended is marked** (the tab map, TM6b, 10 Oct 2026: the survey found the month so far plotted as a collapse,
read as a fall). `opts.toDate` names the index of the point, bar or segment of a period still running (`chartToDateAt(keys,
current)` finds it among the keys; null where the current period is not drawn). A line's segment into it is dashed and its dot
drawn hollow, a bar or a stacked segment lighter (`inv-chart-todate`, the one class); its axis label reads *to date*
(`chartToDateLabel`) where the axis has room for it, and its `<title>` says so. `chartLine`, `chartBars`, `chartLines`,
`chartStack` and `chartSpark` all take it, and every chart with a current period passes it: Trends and the six months, Pulse's
sparklines, Money's cash by month, outflow by category, GST and invoiced against received (a statement month only while the
statement stops short of the month's end, `finMonthToDate`), Production's plated by line, Pay's weekly payouts, People's
attendance by week, Stock's use by week, Power's cuts by month and Performance's months. P194 walks them.

### 6.18 Callout and empty state — `inv-callout`, `inv-empty`
- `inv-callout-info|warning|danger|neutral`: tone bg + tone text, `--r-lg`, leading icon, `--t-body`.
  For "how this figure is made" notes, caveats and warnings about the data on screen.
  Replaces `inv-stats-caveat`, `inv-stats-alert`, `inv-stk-banner*`, `inv-confirm-warn`, `inv-reissue-note`,
  `inv-merge-warn`, `inv-reg-scope-note`, `inv-zero-reason`, `inv-area-flag`, `inv-set-derive`.
- A callout filled on demand (a derivation: *Derive from zinc bills*, *Derive from the bank*) is not drawn while empty;
  its working is rows (the month or bill, then the arithmetic in a mono meta line that wraps) on the callout's own
  padding, and what it offers a toolbar with its *Use* button.
- Plain explanatory text under a panel is `inv-note` (`--t-caption` `--text-3`); a list of notes is a `ul.inv-note`, its bullets inside the panel. A qualifier that is words ("last 6 months", a day's date) is an `inv-note`, never the mono `inv-panel-count`, which is for a count or a figure. Replaces `inv-stats-note`,
  `inv-dupe-note`, `inv-numaudit-note`, `inv-form-hint`, `inv-stk-hint`, `inv-cp-group-note`.
- `inv-quote`: text quoted from its source as sent (a WhatsApp line under what it was read as), mono `--t-caption`
  on `--surface-2`, wrapping as written. A fold of it opens from a link-like `summary.inv-summary`.
- `inv-empty`: centred in its panel, `--text-3`, one line saying what would appear and the action that
  makes it appear; `inv-empty-icon` above it where the empty panel is the first thing a new device sees. Replaces `inv-empty-state(-sm)`, `inv-stk-empty`, `inv-td-empty`, `inv-chart-empty`.

### 6.19 Settings
Keeps its six groups, folded sections and per-section Save (see CLAUDE.md § Settings), redrawn with
`inv-side-item` (desktop group nav, in an `inv-dialog-wide`), `inv-panel-fold` sections, `inv-field`. A section's head is
the row that says what it is set to (`inv-row-title` over `inv-row-meta[data-sum]`); its body the fields, *How this is
used* as a fold of `inv-note`, and its own Save. An unsaved section is `data-dirty` and reads `● Unsaved`
(`inv-dot-warning`) on its head and on its group in the list, drawn only while it holds. A secret (an API key, a token)
is an `inv-input` with an `inv-btn-icon` that shows it, in a flush toolbar; the storage figures are an `inv-kv`; the
diagnostics report is an `inv-quote`. Adds **Appearance** (theme and palette §3.2,
density §3.5) under Data & device, each a segmented control that applies at once — appearance needs no Save.

### 6.20 Utilities (closed list)
`inv-hidden` (removed from view, for a control the code shows and hides), `inv-visually-hidden` (read by a screen reader
only), and five margins on the spacing scale: `inv-mt-4`, `inv-mt-8`, `inv-mt-16`, `inv-mb-8`, `inv-mb-16`. Nothing else;
a spacing a component needs belongs to the component. Status is a dot and a word through `uiDot(tone, word)` (`tabs.js`),
its tone through `uiTone()`, which also maps the red / amber / info words the rules and parsers speak.

### 6.21 Hero card — `inv-hero` (`uiHeroHtml`, state.js)
A card that leads with what it is about and says it in a line, for a screen read at a glance (Today; owner, 8 Oct 2026:
*"If it is in list form, it should be presented better, maybe as a card or at least an expandable hero card. Right now we
have empty spaces, and inefficient layout"*). Anatomy, in `inv-hero-head`: the eyebrow (`inv-hero-eyebrow`: what it is, a
count `inv-panel-count`), the title (`inv-hero-title`, one sentence), the figure (`inv-hero-fig`, mono, in the card's tone),
a sub line (`inv-hero-sub`, two lines at most) and a small drawing (`inv-hero-viz`: a sparkline or a meter, §6.24). A card (UI
pass 3): lifted by `--lift-1`, `--r-card`, filled with its tone's gradient (§3.3 *Fills*: `inv-hero-danger|warning|ok|info|neutral`,
the accent with none; a plain card is the surface), its border the tone mixed into `--edge`. With a body it is a `<details>` whose
`summary` is the head (a chevron at its right) and whose `inv-hero-body` holds a deck (§6.22), steps (§6.23) or an
`inv-hero-sheet`: rows, tiles or a question's story drawn on the card itself, with no box of its own (UI pass 3), only a hairline
under the head; it reaches the card's edges so its rows keep a flush panel's width, its last row inside the card's corners. A fold the owner opens
or shuts is remembered per device (`fold`, as `uiFoldHtml`). `inv-hero-vital` puts the figure first, for a question's answer.
`inv-hero-foot` holds the card's own links and buttons (`foot`: *Import statement*, *Refresh*, *Back up now*), under its head
or, where it folds, under its body. The sheet's rows' hairlines are the card's tone; on the desktop it is its strip's container
(`panel-w`), so a strip of tiles lays out by the sheet's width.
`inv-heroes` sets heroes side by side (two on the phone, three on the desktop; one opened takes its row); `inv-hero-stack`
stacks them with the grid's gap only. `inv-heroes-4` is an overview's four subjects (Money's: cash, owed, GST, paid out): two
across on the phone and on a desktop under 80rem, four from 80rem, so four never read as three and one left over (the tab map, TM3).
**A hero alone on the last row takes the row** (on the phone in any `inv-heroes`, on the desktop in `inv-heroes-4`), so a grid of
heroes never ends in a blank cell: Floor's Overview holds five (the flow thread's *Turnaround*, 10 Oct 2026), the fifth on a row of its
own.

### 6.22 Card deck — `inv-deck`, `inv-deck-item`
Things to act on as cards, as many across as fit (`auto-fit` at `--deck-min`, so two or three cards share the row and never
leave a blank column). A card: `inv-deck-head` (a glyph or tick, a word for where it lands or how sure, its figure mono at the
end), then either `inv-deck-main`, a button whose `::after` covers the card so the whole face opens what it names (its focus
ring drawn on the card), or `inv-deck-body` for a card that is not itself a door; `inv-deck-title` and `inv-deck-sub` two
lines each; `inv-deck-foot` its one move, above the stretched button. Each card is a box (§6.26) in its own tone, its left edge
the tone (`--rule`), so the code reads at a glance: a card in a card, lifted (`--lift-1`, `--r-card`) and lighter than the card it
lies on in both themes (§3.3 *Fills*). *Show N more* sits under the deck, outside its grid
(`uiMoreDeckHtml`, `inv-deck-more`), so the rest open in place without a gap in the row. Today's tasks (`tdyAppCardHtml`,
`tdyMineCardHtml`) and every move (`advMoveCardHtml`) are cards. So is every unit of the plant register on Production → Equipment (the tab map, TM4c, §1a-13): a
thing with a status of its own, edged in its status's tone (`data-tone`), its kg a round and how long it has stood; the unit strips
(`inv-unit-strip`, `inv-plt-unit`, `inv-unit-name`, `inv-unit-sub`) are deleted. A deck of small cards (a word, a name, a figure: the
units) carries `data-deck-sm` and takes `--deck-min-sm` (9rem), so they go two across on the phone (TM4f: a line's units one to a row
ran four phone screens on the owner's book).

### 6.23 Steps — `inv-steps`, `inv-step`
What arrives in a day, in the order it comes, on one rail: each `inv-step` a node (`inv-step-node`, its number or a tick),
`inv-step-main` (a button: `inv-step-title` over `inv-step-meta`) and its door at the end. The node says where it stands by
`data-state`: `in` filled ok, `part` ok over its background, `late` warning, `off` dashed, waiting in the card's own tint; a
late step's meta is in the warning tone. The rail is the card's tone mixed into `--border`. Today's five inputs.

### 6.24 Sparkline and meter — `chartSpark`, `chartMeter` (charts.js)
Drawings small enough for a card's head or a tile. `chartSpark(values, {ref, tone, dot})`: a line over the values
(`inv-spark-line`, in a tone with `inv-spark-<tone>`), a dashed reference (`inv-spark-ref`: the cost under realisation, last
month's pace), the last value a dot; a gap is a gap. `chartMeter(parts, {max, mark})`: one bar of parts in their tones
(`inv-meter-<tone>` on `inv-meter-track`, a well's track since UI pass 3: `--well`, the bar pressed in by `--press-1`; `neutral-2`
a second grey, so two neutral parts side by side read as two), a mark
where a target sits (`inv-meter-mark`). Both carry a `<title>` with the
figures and stretch to their box (`--spark-h`, `--meter-h`). A tile takes one in `inv-tile-viz` (the month's tiles on Pulse).
`chartDayStrip(spans, {title})`: a day on one bar, 6 AM to 6 AM the next (`inv-daystrip`, the meter's bar, with `inv-daystrip-axis`
under it at its quarters: 6 AM, noon, 6 PM, midnight, 6 AM): when something ran in its tone (`inv-meter-ok`), when it stood (a cut,
`inv-meter-danger`), the general shift's two ends marked; drawn in spans, so it sits inside a row's button. A line's runs on the day
card (§7, Production).

### 6.26 Coded box — what a card holds (styles.css, §3.3 *Fills*)
What a hero holds (UI pass 3): **a card in its deck** (`inv-deck-item`) lifts, lighter than the card around it in both themes, coded
by its own status where it has one and by its card's where it has none; **a tile in its strip sinks**, a well, darker than the card,
in its own tone where it names one and the card's own fill under the well's veil where it states nothing; **its sheet**
(`inv-hero-sheet`) draws no box, only a hairline under the head, and a panel or a strip inside it draws no fill or box of its own; its
hairlines take the card's tone; a secondary button in it is the control tier (§3.3 *Fills*). The owner (8 Oct 2026): *"the boxes
inside the cards are still just white instead of colour coded gradients"*: none is (HR-9), and the colour still says the status.

### 6.25 Packed grid — `uiMasonry(el)` (state.js)
A grid of cards of different heights packed with no hole (Needs you and Pulse's widgets on the desktop). Where the grid has
two columns or more it is `inv-masonry-on` (`grid-auto-rows: --masonry-row`), and each child spans as many of those rows as
its own height takes (`--rows`, set from code, §3.9); a `ResizeObserver` packs it again when a card opens, shuts or draws a
chart. One column, or the phone, is left an ordinary grid. `inv-panels-wide` still spans the row.

### 6.27 An analysis on screen — verdict, factors, the working (`uiFactRowHtml`, `uiFoldRowHtml`, `uiWorkingHtml`, state.js)
The owner, 9 Oct 2026: *"The times lost most reads like a block of text and is not presented according to our benchmark"*, and
*"lots of new chaotic text data is entering due to the analysis … designing a way to present our analysed data in a coherent
manner"*. Every figure the app works out is drawn in three layers, and nothing of the reasoning is a sentence on the face:
1. **The verdict leads**: one figure in its tone and one line (a hero's head, a row's end). A hero's sub holds at most three short
   facts (how good, how sure); the inputs are never in it.
2. **The factors are tiles** (§6.9): a label of a word or two, the figure in its tone, a sub of a few words ("20 of 27 rounds").
   What moved the verdict most is a caption over them (an `inv-row-group`: *The time lost most*), never a paragraph. A tile set
   against its benchmark carries the change line under its sub (`delta`, `figDeltaHtml`'s: *+27.1% on a usual day*, coloured by
   the way it moved), as Home's month tiles do (10 Oct 2026, Production → Lines' Plated and Earned).
3. **The working is folded under them** (`uiWorkingHtml`: *How it's worked out* and its count, shut until opened and remembered
   on the device): **one fact a row** (`uiFactRowHtml`), a label of a few words, its figure at the end (mono), at most a few words
   under the label; where a figure comes from is a badge (*measured*, *set*, *typed*, *assumed*, *so far*, *shared*), never a
   clause; a figure that can be judged is in its tone (`tone`: a line's earnings against what a kilo costs, the week against the
   four before), the words that give the reason under the label (DR-8); a list (the parts run part-full) is rows, one each. A record that rests on parts of its own (a line's additions, a
   day's weighing routes) is a row that folds open to them (`uiFoldRowHtml`); a fact's own move (a default's *Change*) sits at
   its end (`actions`).
- **Certainty is a sign or a badge**: ≈ an estimate, ≤ the most it can be, *so far* for what is still running, a dash with two
  or three words beside it for a figure withheld (*too few days recorded*). A meta line holds at most two or three short facts.
- **How the analysis works is the screen's guide** (`kbguides.js`, *Reading the plant's figures*), one tap away on the top bar's
  book; a panel's note is a line at most.
- Inside a card the caption and the working are drawn on the card's box (no page-coloured band; the card's hairlines).
Built on Floor → Day's line cards, Production's day card, Production → Lines (*Into the bath*), a stock line's *By line* and the
plant strip's round. The other screens that reason in sentences are measured in `docs/COGNITIVE_LOAD_SURVEY.md` (*Analysed
data*) and fixed in the steps of `docs/TAB_MAP.md` (its §3d), whose §3b states the benchmark's rules with what measures each.

### 6.28 The verdict card — `uiVerdictHtml` (state.js), `data-verdict`
The owner, 9 Oct 2026: *"UI still feels inconsistent to me"*. A census of every screen found the components alike and the screens
led five ways, or not at all (`docs/TAB_MAP.md` §3e). **A work screen leads with one verdict card**: a hero (§6.21) saying how the
screen stands, and nothing else leads it (no page-head line, no strip of tiles, no callout). `uiVerdictHtml(o)`:
- `screen`, the eyebrow: the screen and its period or count;
- `verdict`, a sentence of **60 characters at most**, in `tone`, the worst of what the card holds; with `money: true` a role
  that does not see money reads `plain` (its count) instead, and a fact or factor carrying `money: true` is left out for it;
- `fig`, its key figure; `facts`, up to **three** short facts under it (`inv-hero-fact`, set apart by a middle dot the
  stylesheet draws); `viz`, a meter or sparkline (§6.24);
- `factors`, up to **four** coded tiles in its body (§6.9, §6.26, `uiFactorTileHtml`); a factor that filters its list is a
  `button.inv-tile` keeping `aria-pressed`; a factor's `badge` (`[tone, word]`) says beside its label what its figure is not
  (*99% weighed*, *net of notes*, *below cost*): certainty as a badge (§6.27), never a sentence under the card;
- `links`, up to **two**, in its foot; `body`, more of the card.
- `foldFacts`: a card of facts alone (no factors, no body) is a plain card, its facts always shown; with `foldFacts` the facts
  go under its line, so on the phone it shuts to the line like any other (owner, 13 Oct 2026, of the cards Challans → Invoiced,
  Knowledge → Training and Troubleshoot gained: *"B"*, fold them shut on the phone).
- a verdict naming something typed (a cause, a client) is cut at a word to fit with its tail, an ellipsis where it was cut
  (`uiVerdictFit(name, tail)`): Power → Causes' *Panel MCB trip costs most*. A fact may be `{text, tone, money}`, and a note in
  the body is a row on a sheet (`inv-hero-sheet` > `inv-row`), never bare text against the card's edge.

It carries `data-verdict` and `data-card="verdict"`. **Shut on the phone**, where its line still answers the six-second test,
**open on the desktop**, either until the owner moves it, remembered per device (`v-<page>-<view>`, or the `key` given). Past
its limits it is drawn with `data-verdict-long` and says so in a test browser's console; P197 fails on it. Every screen declares
its kind on its root (`data-screen`: overview, work, document, form; `SCREEN_KINDS`, tabs.js), and P197 holds each to its kind's
anatomy once its step has assembled it (`docs/TAB_MAP.md` §3e).

**The box looks, a closed list** (the tab map, TM6f; P197's `LOOKS`). A box look is what the census reads off a box at least 40 by
24px on a walked screen: a fill of its own (`fill`: not the ground under it), a gradient (`grad`: a coded box, §6.26) or neither
(`nofill`); its rules (`edge:` `all1` on every side, `B1` the bottom, `T1` the top, `L1` the left, `none`); its corners (`r`, px); a
lift (`lift`: a shadow outside it), a well (`well`: every shadow inset) or neither (`flat`); and its padding, top and left (`p`,
px), at the density the walk runs in. These are the app's looks and there are no others: a walked screen wearing one not listed
fails P197, and a new one is listed here and on `LOOKS` in the same change, with what wears it. **Regenerated by UI pass 3** (U1, 16
Oct 2026) from the census on both layouts over the long book (`LOOKS_DUMP` writes every look the walk sees with what wears it), the
Planner board's two lane rules kept from the owner's book: the old corners (r6, r8, r10) collapsed into the card's, the tile's and
the control's, and the tile's lift into a well, 41 looks to 35:

| Look | What wears it |
|---|---|
| `fill edge:all1 r18 lift p16/12`, `fill edge:all1 r18 lift p0/0` | a panel (§6.8), padded and flush: a card |
| `grad edge:all1 r18 lift p0/0` | a hero card (§6.21) and the verdict card, coded in its tone |
| `grad edge:all1 r18 lift p12/12` | a card in a deck (§6.22) |
| `fill edge:all1 r14 well p10/12` | a tile (§6.9): a well |
| `grad edge:all1 r14 well p10/12` | a tile in a coded card that names a tone: a well of its tone |
| `fill edge:all1 r12 well p0/12` | a search (§6.7): a well |
| `fill edge:all1 r12 well p0/2` | a segmented control's track (§6.5): a well |
| `nofill edge:none r0 well p0/0` | a tab row (§6.4): its rule, an inset line |
| `nofill edge:T1 r0 flat p0/0` | a hero's sheet (§6.21): only its head rule |
| `nofill edge:B1 r0 flat p10/12`, `nofill edge:B1 r0 flat p8/12` | a flush panel's head; a row at its density (`inv-row-auto`) |
| `nofill edge:B1 r0 flat p16/12` | a panel's body |
| `nofill edge:B1 r0 flat p12/12` | a strip of tiles in a flush panel (`inv-tiles-flush`) |
| `nofill edge:B1 r0 flat p6/12`, `nofill edge:B1 r0 flat p6/28`, `nofill edge:B1 r0 flat p8/28` | a row (§6.10), the left padding wider under its parent; a table's cell at the row's padding |
| `fill edge:B1 r0 flat p0/12` | a group's head (`inv-row-group`, a table's group row), a table's head cell |
| `nofill edge:B1 r0 flat p0/12` | a table's cell: a figure, a word |
| `fill edge:B1 r0 flat p0/0`, `nofill edge:B1 r0 flat p0/0` | the lines under an opened row (`inv-row-children`), on the page colour or a card's |
| `fill edge:B1 r0 flat p4/12`, `fill edge:B1 r0 flat p4/8`, `nofill edge:B1 r0 flat p4/8` | the Planner ledger's head cells and figures (§6.11) |
| `fill edge:B1 r0 flat p6/12` | a table's cell filled, on the desktop (History) |
| `fill edge:B1 r0 flat p2/2`, `nofill edge:B1 r0 flat p2/2` | a grid's cell (the week, the register's month): a Sunday or holiday filled |
| `nofill edge:T1 r0 flat p2/2`, `nofill edge:T1 r0 flat p2/12` | a grid's rule between groups (the Planner board's lanes), on a cell and on the lane's name |
| `fill edge:T1 r0 flat p8/2`, `nofill edge:T1 r0 flat p8/2` | a table's foot, its totals |
| `fill edge:L1 r0 flat p16/16` | the desktop's detail pane (§6.14) |
| `fill edge:T1 r0 flat p8/12` | a form's action bar (§6.15), and Reports' under its sheet |
| `fill edge:none r8 flat p10/12` | a callout (§6.18) |
| `fill edge:none r4 flat p6/8` | the text as sent (`inv-quote`) |

### 6.29 Register rows — `inv-rnd-row` (faces.js, F4)
The register clerk's page on Mine, where thirty rounds must read in a few phone screens. A round is one grid row: its time, its
figure and its remove (`inv-rnd-row`: three columns, the time widest so a native time field shows whole); on a batch page
(`inv-rnd-batch`, two equal columns) when it began and ended, then the figure under them (`inv-rnd-lead`). The client and the part
appear only where a run begins (`inv-rnd-run`, on `--surface-2`: the client, then the part, `inv-rnd-tail`, as written, with the
floor's names as suggestions), the rounds under it carrying them, as the paper's ditto does. What the reader made of a row, a sum
added up or a question, is a line or a callout under it across the row (`inv-rnd-wide`); a column head (`inv-rnd-head`) names the
columns once. One grid on both layouts: the page is a person's own phone screen.

---

### 6.30 An article — `inv-kb-*` (kbread.js, the knowledge base's second edition, KB2-1)

The one place in the app set as a document to read rather than a list to scan (docs/KNOWLEDGE_BASE_2.md §2–§6).
- **Reader** (`inv-kb-read`): a measure of `--kb-measure` (42rem, about 65 characters), the text at `--fs-16` on 1.7, no box round it; a
  heading (`inv-kb-sec-h`) `--fs-19`; a step a numbered item (`inv-kb-steps`), its numeral the list marker in the accent and mono, **never a
  tick box**.
- **A notice** (`inv-kb-notice`, `-danger` / `-warning` / `-info` for WARNING / CAUTION / NOTE): its icon and word first, filled in its tone:
  the one place colour fills an article (DR-1).
- **A screen's path** in the text (`inv-kb-path`) is an inline link, never a button box.
- **At a glance** (`inv-kb-glance`): up to four label and value rows on `--surface-2`.
- **Guided** (`inv-kb-guide`): a bar of segments (`inv-kb-prog`), one step at `--fs-22`, Back and Next `--kb-big-h` in the action bar.
- **A kind's icon** (`inv-kb-ico`): a stroke icon on `--surface-3`, never coloured by kind.
- **The Library's card** (`inv-kb-card`): an icon, a title and a line, in a shelf that scrolls sideways (`inv-kb-shelf-row`), one column in the
  desk's narrow left column.
- **The desk** (`inv-kb-desk`, desktop): the list `--kb-lib-w`, the article, the context `--kb-ctx-w`; each column scrolls inside `--fill-h`;
  under 80rem the context is a rail (`--kb-rail-w`) opening over the article. On the phone the context is a sheet opened from a bar over the
  phone bar (`inv-kb-ctxbar`).

### 6.31 Switch — `inv-switch` (UI pass 3, §3b)
An on/off setting that takes effect at once (a widget shown on Home, a rule switched on): `<input type="checkbox" role="switch"
class="inv-switch">` inside an `inv-field-check` label, which is the whole touch target. A well's track (`--well`, `--press-1`, its
fine edge, `--r-full`, `--switch-w` × `--switch-h`) with a knob of `--surface` lifted by `--lift-1` (`--switch-knob`); on, the track
is the accent and the knob slides across (`--dur-1`, none under reduced motion). The widget gallery (U2) and Settings' on/off rows
take it; a choice that is saved with a form stays a tick box.

### 6.32 Blank state — `uiBlankHtml` (state.js), `inv-blank` (UI pass 3, §7c, §14b)
What a widget, a list or a chart says when it has nothing to show, one component: `kind` (`empty` nothing recorded yet, `early` too
little to say it surely, `offline` no signal, `notset` a setting needed, `error` it could not be drawn, `loading` it is being
fetched, `aria-busy`), its icon in a well's disc (`inv-blank-icon`; an error's in `--danger-mark`, offline and not set in
`--warning-mark`), its title (`inv-blank-title`), a line under it (`inv-blank-body`, left out when `small`, for a Small widget or a
chart's empty box) and one action (`inv-blank-act`). Never a zero standing for unknown. U7 replaces every screen's own empty text
with it.

## 7. How each screen is assembled

| Screen | Phone | Desktop |
|---|---|---|
| Home | stat strip (invoices, revenue, plated, ₹/kg) · quick actions (3×2 `inv-btn-grid`, first primary) · Money (`button.inv-tile` ×4 into Finance: balance, owed, pays in, runway; *Import statement* in its head) · To-do, Attendance, Unbilled, Sync and Zinc panels · recent invoices as rows | same strip ×4 · quick actions in one row · panels two across · recent invoices spanning both. *Built.* The six-month chart and contribution table move here with Stats (they are Stats' renderers). |
| Today → Needs you | the day's inputs as a hero (*N of 5 in*, a meter, the next due) opening to steps (§6.23), each with its Paste or Photo, then WhatsApp · the tasks as three heroes, **Now** (red or amber, open, its worth), **This week** and **Later** (folded to a line naming what is in them), each a deck of cards with the move at the foot · the recent invoices as a hero (the latest and its figure) opening to rows with their print buttons · the tasks' stack opens with the To-do's toolbar (the add field, **Add** the view's one primary, Details) and ends in Snoozed and Done, each a fold shut, then *Learnt from your answers* (the tab map, TM2a: the To-do page joined it) | the tasks across the top, the inputs, *Floor now* (a tile per line and Power) and the recent invoices packed under them (§6.25), three across from 100rem |
| Today → Pulse | the head: the period an `inv-seg` filling the row (MTD · QTD · YTD · All, one with Stats), More as its mark (*Make a report* and *Open Stats* where the role opens them, *Edit Home*) · the questions as `inv-heroes`, two across: each its question, its answer as a figure and a word in the tone, a sparkline or meter, folded; opened it takes the row with the story and *What you can do* as a deck · **Do first**: the three moves worth most across the questions, as cards · **Why it moved**, **In one line** and **This month at its pace** as heroes led by their verdicts (the causes as fact rows; the factors as tiles, what is not measured a badge; the band folded), shut (Stats → Overview's until the tab map, TM2b) · the widgets the owner arranged, **each a hero** (8 Oct 2026: *"Pulse still holds generic cards as well, so it looks like a half designed space"*): its eyebrow, a one-line verdict, its figure where the line is not one, a meter or sparkline, coded by the worst of what it holds, opening (shut on the phone and open on the desktop until moved, remembered per device; the tab map, TM2c) to its tiles and rows as coded boxes with its links in its foot — Month to date (billing against the same days last month, realisation against the cost, the four tiles with their lines), Money (owed past 60 and 90 days, the ageing as a meter, the four tiles into Finance), To-do (grouped as Needs you groups it, the top three), Attendance (on site against the roster, the day as a meter), Unbilled (coded as Pipeline's first stage), Production, Power cuts, Stock running low, GitHub backup, Zinc (the landed rate, the market's last refreshes as a line), Recent invoices; the quick actions an `inv-coded` grid | the questions three across, the widgets packed. The sidebar's name and mark open Pulse (`invGoPulse`) |
| Power | view tabs Cuts · Causes · Load & bills · Case (the tab map, TM4e; its Overview went: the month, its cost and a year at this rate are Cuts' card and Floor's Power hero) · each view its own toolbar (§1a-12): Cuts **Enter a cut**, Import history under More; Causes none; Load & bills **Edit load**; Case **Print the case** with Options' figures · **Cuts**: the verdict (the month's cuts and what they cost; a year at this rate, the dark hours and the days recorded its facts; the month, its cost, the year and the load its factors; danger while an approved load is not billed) · *To look at*: the load approved and not yet billed first, in red, then the cuts to complete (no time back, or a recent one with no reason) with **Complete** at a row's end · the cuts by month, the newest open: a cut one line, its day and why as the title, two facts (its clock; how long, or the length it is costed at while it has no time back), its damage and where it fell at its end, opening to why it went and what the damage is made of, a fact a row · *Cuts by month* and *When they come* folded after them · **Causes**: the verdict (the costliest cause, kept to the card's 60 characters by `uiVerdictFit`; with a reason, from the grid, in the plant and the costliest its factors, **coloured only once three cuts stand behind a tile**, with fewer plain, with its count); the cuts to complete a link to Cuts · what causes them, `chartRankedBars` by what each cost, two facts a bar, coded by where it starts (danger: in the plant three times in 30 days; warning: in the plant; info: the grid; neutral: not placed) · where they hit, a tile per station in the plant's order, its line two facts (the last 30 days and what they cost; the hours dark and the units in its title) · what brings it back, fastest first · the lists of reasons and fixes, **Edit** for the owner · **Load & bills**: the verdict (the load billed against the load approved, the penalty since approval; danger while the approved load is not on the bill; billed at, approved, the peak and the penalty its factors, the owner's note in its body) · each bill one line (its month, its units and peak; its amount at its end) that opens to its details, a fact a row, and **Details** · the penalty by bill folded · **Case**: the document (`.inv-sr-doc`) in an `inv-rpt-sheet`, laid out at the sheet's width and fitted to the screen (`paperFit`) · the cut a dialog (§6.16): *Power in at* (a time field, or the record's time read-only), *Why it went* and *What brought it back* each a field over `inv-chip`s of the list (the most used first, filtered as typed) with what it will be saved as said under it (*Saved as …*, *Read as … · Keep as new*, *New: …* with where it starts as an `inv-seg`), *Where it hit* a `<select>` of the whole plant, the stations and their units | the same, panels two across; the case at life size where the sheet fits |
| Office → Pipeline | an overview (§6.28; the tab map, TM5a): the verdict card naming the stage the page opens on in its own words and tone (*12 challans waiting · oldest 9 days*), with no figure (the stage's tile has its amount), the worst other stage running late its one fact · one toolbar row (**Create invoice**) · the stages as coded tiles (§6.26), two across, each its count, its amount and how long its oldest has waited in its age tone, plain with nothing to judge; one holding anything opens its list (`aria-pressed`) · the open stage's list: awaiting invoice a row a client (two facts, its oldest a line in its tone, **Create invoice** at its end) opening to its challans, an invoice state a row an invoice · how long dispatch takes, under the stages | the stages a column the pane's width (`.inv-pipe-rail`) beside the open stage's list (`#pipeList`), each scrolling inside itself |
| Create | fields · unbilled-challan rows with checkboxes (ticking one brings its open lines in) · line editor · collapsible optional details (`inv-panel-fold`) · action bar (grand total, Clear, Create invoice) · an error shows only once its field is left or a save is tried, never on a form nobody has touched, and Save is held only while one shows (the tab map, TM5h) | same, two-column fields, lines as a table. *Built.* The add/edit challan form is assembled the same way, on the same line editor. |
| IM | view tabs *Awaiting invoice* (the default) · *Invoiced*, each with its count · on Awaiting the verdict card (the tab map, TM5b: *N challans waiting · ₹X to bill*, the oldest's days its figure in its age tone, how many are over the To-do's days and part invoiced its facts) · one toolbar row: Filter (client, and the status on Awaiting; inline on the desktop, a dialog with tokens under the row on the phone), **Add challan** (the page's one primary, replacing the floating buttons), More (*Duplicate check* with its count) · a waiting challan's dot toned by its days (`imWaitTone`: amber from the To-do's challan days, red from twice them, as Pipeline's first stage and the To-do's task), its meta two facts (*6 days waiting · 3 items*) · on Invoiced its own verdict card (TM6f: *31 challans invoiced in Oct 2026 · ₹2.9L*, in the tone of the oldest of the month's challans still waiting, *N of the month still awaiting invoice* its fact; shut on the phone, its fact under the line, `foldFacts`), its toolbar one row: the month's ‹ › inside it (`inv-tb-step`: the latest month first, back a month at a time; the verdict's line says *by challan date*), Filter, and More, which holds Add challan and Duplicate check on this view (the challan Scan came out on 13 Oct 2026: owner, *"it simply never works"*) · the tab's challans grouped by date with the day's value; a challan expands to its lines · selection bar · a challan wanted by a day carries a badge beside its name while anything on it is open (*Wanted 12 Oct*: `info` ahead, `warning` on the day, `danger` after; the flow thread, 10 Oct 2026), set with **Wanted by** among its actions (a dialog: the whole challan, or each open line, a line's day winning) or on the challan form | table (challan, client, date, vehicle, items, amount, status, the badge beside the status) + detail pane, as the Register. *Built.* The add/edit challan form moves with Create, whose line editor it shares. |
| Register | the verdict card (the tab map, TM5c: the invoices late on a step by state and age, worst first, as Pipeline reads them, *3 created over 2 days · 2 delivered, GSTR-1 due 11 Oct*; the active invoices' taxable its figure; its screen line naming the month or range and *filtered*) · one toolbar row: the search, Filter (client, month, state, the range, the sort as one picker), Select, More (Credit notes with their count, Number audit with its badge, Sales register CSV and PDF, GSTR-1 CSV, Bulk mark filed), the filters in use as tokens under it · rows grouped by day with subtotal · selection bar | one toolbar row that never wraps: the search, the client, month and state pickers inline, *Range* (a dialog of its own; the button names the range in use), More · table (invoice, client, date, challans, kg, taxable, GST, total, state), select-all the head's tick box · selection bar · detail pane. *Built.* |
| Office → Invoices → Credit notes | a dialog (§6.16; the tab map, TM3a): its head **Record issued** and **New note** (secondary; gone while a form is open), the form in its body when open (its own Cancel and **Record note** / **Issue note**), then the notes as rows: number · client (a *Cancelled* dot), *date · against X* the meta and the reason on a line of its own, the total over the taxable at the end, Reference, Invoice and Cancel a line of their own on the phone · a save or a cancel redraws the dialog, the Register's badge and the rows' CN marks | centred |
| Clients / Items / Performance | tabs · each view led by its verdict card (the tab map, TM5d–f) · one toolbar row (search, the view's one primary: **Add client** / **Add part** — the floating + is gone) · Clients: the verdict counts the clients and names the rule flagged worst (*22 clients · 2 past terms*), how many are flagged and the next rules its facts; a client's row ends in its worst flag as a dot and a word (*past terms*, *gone quiet*, *below cost*; every flag in its title), an inactive one *Inactive* · rows (a client opens its edit sheet, which leads with its Money panel: owed, by age, pays in, last receipt, cheques; its rate, piece-rate and piece-weight cards are flush panels of rows with the add form in an `inv-panel-body`, and a fill from history reports what it left out as rows under the reason; then **Turnaround** (the flow thread, 10 Oct 2026): a flush panel, its head the target and the terms (*1-day target · 45-day terms*), a verdict row (*Back in 3 working days*, the share of the value on target, `Slipping` / `Past target` as a dot and a word), a row a step (to pickling, to plating, to despatch, to payment for a role that sees money) with its median and its tone, then the open challans as rows, each *Back ~13 Oct* or *Late · back ~10 Oct* in its tone, and the open invoices, each *Past terms*, *Slow · expected ~5 Oct* or *Expected ~24 Oct*; the form's own *Turnaround and terms* panel: the terms, the target, a part's own on a row each) · Parts (Items): the verdict (*168 parts · 3 with no weight*, parts billed by the piece, in its tone, **Enter weights** in its foot) · Filter (*No weight* and *Unused* as `aria-pressed` chips, one choice that shuts the phone's dialog on the pick; the sort `<select>` on `change`), More (Part weights with its count, Enter weights, Derive weights, Merge, Select unused) · a part's row two facts (its description and gauge), its end the rate over its kg a piece, else *No weight* (billed by the piece) or *Unused* · tick boxes and a selection bar · Performance: the client's verdict card (its realisation against the live cost in its tone, for a role that sees money, the change on the month before, its flags as coded tiles that open their tasks; shut on the phone) · client select · month on month (`inv-seg` ₹ / Tonnes / ₹/kg, chart, four tiles with "+12% on Aug" deltas) · the parts Stopped (warning while it holds a part) / New / Steady / One-off each a fold, an empty one plain, shut on both layouts, its head a dot and its count · Materials worked and By the hour folds, shut (By the hour open while its form is), By the hour's parts fact rows and each hint a row in its tone · a client's flagged tasks and linked articles brief (the title; the line in the row's title and the task's dialog) | tabs · table · detail pane on demand with the Money panel (as the Register's; the resizable split and its drag handle are gone). *Built.* |
| To-do | *Joined Today → Needs you in the tab map (TM2a)*: its toolbar, Snoozed, Done and Learnt are Needs you's (above); the task dialogs are as they were, on `inv-field`s, the figures as rows, what clears it a callout | the same, packed with Needs you's cards |
| Stock | one screen (the tab map, TM4d; its Overview and Lines tabs went): the verdict card (§6.28: the lines out, else at 7 days or less, and the reorder's cash with GST; the forecast's low after the order for a role that sees money; Out / ≤ 7 days / OK / No rate its factors, each a `button.inv-tile` that filters, `aria-pressed`; *Open the reorder list* its link) · one toolbar row: **Paste message** the one primary, Enter by hand, More (Reorder list, Print sheets, Export, Import) · what to check, a row with **Check them** · the lines grouped by status under `inv-row-group`s, level mono with its unit and status a dot and a word · **Spend and prices** folded at the foot: spend by supplier `chartPieTap` listing a slice's bills as rows, used ₹ by week `chartLines`, price trend with its line `<select>` (on Zinc the market against bills: range chips, four tiles, the market dashed beside each supplier's bills on a time axis, suppliers as rows that open their bills) · a line: back · tiles (on hand, days left, use a day, last paid) · Price and pattern (rows; *Add a bill* in the head, the bill form an `inv-panel-body`; *Order from* a row naming who the line is ordered from, with **Compare suppliers** at its end) · *By line, 60 days* (§6.27: a row a plating line, its kg/t at the end, its ₹/kg and additions under it, *so far* a badge, folding open to its additions a fact row each; *No bath named* a row) · the line (how it is used `inv-seg`, name and unit) · entries (rows, a count's gap a callout, the message text a fold of `inv-quote`, Void then *Tap again to void*) · Paste, Enter by hand and Reorder list are sub-views with a back button and the sticky `inv-actionbar` (Save / Copy as message); on the reorder list each line carries a row under it (`inv-row-children`) naming who it is ordered from and by when, with **Compare suppliers** · **Compare suppliers** is a dialog whose suppliers are a deck (§6.22) in `inv-coded`: a card a supplier, its role (*Your pick*, *The app's pick*, *Last bought from*, *Quoted*) the head's word and its price a unit the head's figure, its name the title, what its price rests on and its lead time the sub, what speaks for and against it each a dot and its words (`inv-row-meta inv-row-wrap`), the card coded by the worst against it (`data-tone`), **Order from them** its foot; the dialog's foot Close, *Let the app pick*, *Add a price quoted* (a form in its place, the price the one primary) · the More sheet is `inv-sheet` rows | the lines one table grouped by status (`tr.inv-table-group`), a line opening in the pane beside it, and **Spend and prices** a toolbar button opening the pane in its place (a second press shuts it); the reorder list is a table grouped by supplier. *Built.* |
| Production | view tabs Lines · In plant · Entries · Equipment (the tab map, TM4c; its Overview went: the day is Floor's Production hero, the four weeks Lines') · each led by its verdict card (§6.28) · **Paste message** (*Paste* on the phone) the primary on Lines and Entries only, Enter by hand, Print sheets (a dialog: the day, the pickling sheet, the barrel batches and the two VAT register pages as tick boxes, **Blank** the primary and *As entered* beside it; the sheets in the one print view, F5), Export and Import under More (the empty page's More: Import); In plant has none; Equipment's is **Add a unit** · **Lines**: the line's day: `inv-seg` of the three lines and Pickling, the day ‹ › in the row, never past today; the verdict its efficiency (the week to the day against the weeks before, how many said, one of its facts; Plated, Pieces, **Earned** (Rounds for a role without money) and Power cuts its factors, Plated and Earned each with its change line against the line's usual day; *How it's worked out* folded); runs grouped General shift / Overtime / *Also reported* (muted); the week (`inv-table`); plated by line over four weeks (folded); *Into the bath*; labour ₹/kg by line · **In plant**: the verdict (the book open in rupees, plated and not invoiced; the stages its factors); what needs a look first (plated past its days, on the floor with no challan open); then a fold per client of its open challan lines, each a dot and a word for its stage · **Entries**: the verdict (*N entries in 60 days, M to look at*), its flags its factors, each a filter tile (`aria-pressed`: not weighed, cuts with no time back, the line unknown, no client, no challan, gauge unknown) · the latest thirty, the rest one tap away (`uiMoreHtml`); a row two facts (where and when; how much, with its kilos), badges for what qualifies its figure (an estimate, not weighed, no client, no challan, gauge unknown), one action at its end (Correct; a cut's Complete), the rest and where it came from in its fold; a client a jump filtered by is a token (phone) and a pressed chip (both), each clearing it · **Equipment**: the verdict (the station most down, a supporting one included; the lines its factors) · a deck card per unit (§6.22) in its status's tone, with its kg a round and how long it has stood · paste check and hand entry are sub-views with the back head and the action bar (the register photo's check went with the photo reading, 13 Oct 2026) | Entries a list beside the open entry (each row's source a badge, every action in the pane); the panels two across |
| Floor → Overview | an overview (the tab map, TM4a; it was Floor → Day): an `inv-stepper` day · four heroes and the turnaround (`inv-heroes-4`, two to a row, the fifth on a row of its own, each shut to its line): **People** (who is on site against the day's roster, coded as the rest-day gate and the floor's number judge it, `attOnSiteTone`; the lines short of their number by name; the day's attendance panel inside; it carries the screen's verdict, `data-verdict`), **Production** (the day's card, `prodDayHeroHtml`, led by the worst line), **Stock** (now: the lines out and low, the first three by name, the reorder's cash with GST, which Stock shows every role that opens it) and **Power** (the day's cuts, the month to date, a year at this rate, the load to chase), each shown to a role that opens its screen, People to every role that opens Floor (with no link where People is not its); the three tiles that led the page are theirs now; then **Turnaround** (the flow thread, to a role that opens Production: the plant's median working days from challan to despatch as its figure, *Back in 1 working day, 71% of the value on target* its title, the lines past the target now its sub; open, a row a step and the lines past the target by where they stand, its door *Open In plant*) · a card per line as a hero (§6.21) **coloured by its efficiency**, **the worst first** (what it plated of what its working units could in the time it ran: 75% ok, 50% warning, under danger; half or more of its units down danger, and leading the card): the line as eyebrow with its efficiency, the figure its %, the title what it plated of what it could (or what needs following up), the plated-against-possible meter with three quarters marked; the sub the units, the hours run and the pieces not weighed; a sheet of the latest run, then **what it earned** (a fact row: the earnings at the clients' rates on record, coloured by its rupee a kilo against what a kilo costs, the usual day under it; for a role without money, the kilos against the usual day), the efficiency as an analysis (§6.27): a caption naming what moved it most, a strip of tiles, one a factor whose product is the figure (Time, Racks, Parts, and Weighed where rounds have no weight, each in the tone of what it lost and the parts only said, `info`), and *How it's worked out* folded under them, a fact a row (hours, the pace and the round with a *measured* / *set* / *typed* badge, the rounds allowed and run, the racks, each part run part-full, the parts' round, rounds with no weight); what went into its bath that day (a fact row, or a row folding open to several), its units and its crew; its staffing and EXTRA as buttons in the foot · Pickling's card coloured by its heads · *Not weighed*, a flush panel across both columns, each floor name with *Which part?* and *Set its weight* | the heroes four across from 80rem, the fifth on a row of its own; the cards two across |
| Office → Sales → Prospects | the verdict card (the tab map, TM5g: *4 open · 6 t a month of 99 t spare*, in the tone of the follow-ups due; its factors open, the pipeline weighted (the chance per stage in its title), the spare a month over the last 90 days (`prsSpare`, the figure Pulse's *Is the plant full?* says too) and the share it fills) · one toolbar row (search, the stage `<select>` on `change`, behind Filter on the phone with a token, **Add prospect** the one primary) · rows, due first: the firm, two facts (its stage and size; the follow-up, else why it was lost, else the work), a dot and a word · the prospect a dialog: fields, its quotations and its stages as rows, *Draft quotation* and *Won: make client* secondary, Save the primary | the same |
| Office → Sales → Quotations | the verdict card (the tab map, TM5g: *2 live · 1 expiring this week · 1 draft*; expired and unanswered, accepted with a rate to post and how many clients are to reprice its facts), its body **To reprice** as a Pulse question holds its moves (`inv-hero-moves`): the reprice moves Pulse's questions draw, as a deck (`advMovesDeckHtml`, one card, the rest a tap away), each opening its draft; none for a role that does not see money · one toolbar row (search, status `<select>` on `change`, behind Filter on the phone with a token, **New quotation** the one primary) · rows grouped Drafts / Live / Accepted, Superseded · Declined · Void folded (`uiFoldHtml`); each the number (or *Draft*) and recipient, two facts (*expires in N d*, else its date; its rate; its date and items in its title), and a dot and a word (an issued one past validity amber *Expired*) · the detail a dialog: the facts as rows, Close and the status's primary in the foot, the rest in a toolbar · the form a sub-view with the back head and the action bar (Save draft, **Issue**): recipient (a client or typed), lines (basis `inv-seg` kg / piece, ₹/kg beside a piece rate with a weight, the rate on record as context), transport `inv-seg`, the terms as editable rows with *Reset to the standard terms* · the printed quotation `.inv-qt-doc`, its own pt tokens, one A4 page, a frame table (`.inv-qt-frame`) whose repeating head and foot rows are the top and bottom gutters on paper | the same list with the detail in the pane (secondary buttons only); while no quotation is open the pane holds **To reprice** (the moves a card each; the card's body holds none, since open above the list it pushed the list below the screen's foot) |
| Reports | two toolbar rows: the kind `inv-seg` (Daily · Weekly · Monthly · Quarterly · Yearly), and an `inv-stepper` with the period's picker (date, month, or a quarter / year `<select>` on `change`) and Now · the report itself, `.inv-rpt-doc`: one document drawn from the data on every render, laid out at the sheet's width and zoomed to the screen (`paperFit`; the tab map, TM2f) · **Print**, the one primary, in the `inv-actionbar` under the sheet, its line *A4, drawn from the records each time it is shown or printed* (TM6e: the row of Print and its note had made four toolbar rows on the phone) | the same document as an A4 sheet; in print the frame table's head and foot rows are the top and bottom gutters (the invoice's frame) |
| Mine | an overview (the entry faces, F1): an `inv-stepper` day · the person's duties as a hero (`data-verdict`: *N of M in*, a meter, the next due; open, never folded away) whose steps (§6.23) each open where the duty is entered on that day, with **Enter** while it is not in, then WhatsApp · *What you entered* (a row a record from the change log: what, and when it was saved; a load or count made on the face is drawn as itself, its question a dot and a word, *Send to the group*, *Copy* and *Correct* a line of their own under it) · *Paper and backup* (*My sheets*: the person's sheets named in its meta, **Print my sheets** a secondary and **Print the day as entered** a ghost, disabled while the day holds nothing for them, a line of their own under the row, F5; *Sent to GitHub* with its dot). The owner looking at another's names it in the eyebrow (*…’s screen, as they see it*). **Its forms** (F2): a back head to Mine, one panel of fields (the client and part as `<select>`s with optgroups, open first; the figure, its unit, the time), a challan's lines as rows each ending in its count, *Saved from this form*, and Save in the action bar. **The rolls** (F3): a hand a row ending in its place (a `<select>`), the counts over them in one line, *Usual places* in the head; who went home a row a hand ending in their time (a small `<select>`, 5:00 PM unless set); each block a panel (on the out-time roll its From and Out at; its lines and its crew as `inv-chip`s pressed, what it is booked to as a note under the lines, EXTRA, work done, *Take this block off*); the EXTRA by line a panel of fields; the roll saved as a row (*Send to the group*, *Copy*) over its message as written (`inv-quote`). **A barrel batch** (F3): the load's form with the barrel and in and out. **The VAT register page** (F4): the line and *Rounds · Batches* as two `inv-seg`s, a note saying whether the page is new, typed on this phone or saved; the rounds as register rows (§6.29); the paper's day total a field, its disagreement a callout under it; the day's power cuts a panel of rows (each ending in *Power back* or *Why*) over a cut's two times and *Save the cut*; *In the book* the page's runs as rows with *Send to the group* and *Copy*; *Save the page* in the action bar over what is counted | the same |
| Today → Planner | view tabs Play · Ledger · A day · Moves (the tab map, TM2d) · the verdict card (§6.28): the plan's margin a month against the goal, cash's low and CQI-11 its facts, the margin, cash, CQI-11 and the trials' stars its factors, the goal's words in its body · one toolbar row: **Roll** the primary, the month ‹ › (`inv-tb-step`, a period inside a toolbar row, as Attendance's, Pay's and Areas' are), the plan's `<select>` where there are two, More as its mark (New card, Make the report, Copy, Rename, Suggest a start, Start over, the goal) · on Moves an `inv-seg` (`inv-pl-moves`): Plant · Tech tree · Staff · Clients · Finance · a register's or a move's row: two facts and one thing at its end, the rest folded under it | the same; More a word, the registers and moves as tables |
| Money → Overview | an overview (the tab map, TM3c): the range chips `3M · 6M · FY · All` in its head, driving every panel · four heroes, one a subject (`inv-heroes-4`, §6.21), each folding to its line on the phone: **Cash** carries `data-verdict` (the balance and its day as its figure and sub, overdrawn danger; the forecast's lowest point within 60 days as its title, below zero danger, *outflows only* warning; the cheques in hand added in its sub; the closing balance by month a sparkline; its sheet the balance, the cheques in hand, the lowest point and the balance in 30 and 60 days as fact rows), **Owed to us** (the sum over 90 or 60 days as its title, the age bar its meter in `FIN_AGE_TONE`, never red while a receipt is unplaced; the five largest debtors as rows in their age tone), **GST** (last month's due, toned by its status; six months a sparkline), **Paid out** (last month's outflow and where most of it went; its categories as fact rows) · then the charts, each a fold (`uiFoldCard`, shut on the phone): cash by month (`chartLines`: balance, in, out; tap a month) and its table, the cash forecast (`chartLines` with a band, *what it rests on*), where money went (`chartStack` over the range, `chartPieTap` for the month, a slice lists its payments), where it came from (`chartPieTap` by client, unplaced a named slice), invoiced against received (`chartLines`), GST due and paid (`chartStack` grouped) · whole rupees on the Overview only | the heroes two across, four from 80rem; the folds open, panels two across |
| Money → Receivables | a work screen (§6.28): the verdict card (owed, over 60 days and receipts not placed; the age bands and *Not placed* its factors; days to pay, the cheques in hand and the receipts with no client its facts) · one toolbar, **Cheque received** secondary · what needs the owner: the returned cheques, then **Cheques received** (`#bankCheques`, its head a dot and *2 cheques in hand · ₹X · the oldest 5 days* in the held task's tone; a row a cheque, its received day the meta and *In hand · N days* / *In the bank* / *Returned* at its end, a same-amount credit offered under it with **Link**), then the receipts with no client (each offer a line of its own, its button at the row's end) · then *Owed by client*: one line saying where receipts start and how they are set (the method is the bank guide's), a row a client with owed at its end in its age tone and two facts of meta (*pays in 32 d · oldest 47 d*), opening to fact rows (invoiced, credited, received with the cheques among it, on account, the opening, rounding) and its invoices with the receipt or cheque that paid each · a cheque opens a dialog (§6.16): its facts, and *Not this deposit*, *Unlink* and *Void* in the foot | the list beside the open client (`recvHost`) |
| Money → Payments | the verdict card (payees not sorted, months with no electricity bill; Not yet sorted, Bills missing, Paid out and Owed to suppliers its factors) · one toolbar, **Add a bill** the one primary (gone while the form is open, whose Save is) · *Not yet sorted* first, a payee a row with **Sort**, and under one whose initials are a supplier's short name a line of its own, *May be …: its initials*, with **Same supplier** · then the bills (`#billsPower`): the form when open; a missing month a row with **Add**, the bank's payment for it under it with *Add as bill*; the bills entered a fold (*12 bills entered, the latest Sep 2026*) of rows with their note and Void, a voided bill muted · then the sections, each a fold: electricity paid, the wages (Staff → Pay's legs), **Suppliers** (its head the total owed as a dot and a word; a supplier a row whose main opens it: what is owed and since when, its lead time; the figure, or *No balance set* as a dot), other · drawn with or without a statement. **A supplier** is a dialog: its facts (owed with how it is made up, unpaid from, lead time and GST: a figure in the figures' face, words in the text's), its bills and payments the latest first with the balance after each (a bill's row opens its total as printed; a payment recorded here carries Void; one soon after the balance's day *In their balance*), those before the day folded; the foot Close · Change · Set the balance · **Record a payment**, each form in the dialog's place | the same |
| Money → Bank | the verdict card (the statement's last day and its age, the breaks in the balance; the closing balance its figure; Last row, Breaks, Rows and Imports its factors) · one toolbar: the search, Filter (the category, a token once set) and More (Import a statement, Export Excel, Export JSON for soma-internal) · the statement, a row a transaction with a category dot, the row's edit as an `inv-panel-body` · the balance check a fold, open when a balance breaks · the imports a fold, a line each (*file · day*, *range · N rows, M new*) · with no statement: the verdict, **Import** the one primary and the empty panel | the same |
| Receivables → Statement and reminder · Pay → Pay slips (7 Oct 2026) | a dialog each on the §6.16 shell: the statement's first day, what to check first as warning callouts, the reminder as an editable textarea with *Send on WhatsApp* and *Copy* (secondary), **Print statement** the one primary; the slips a tick list by period, **Preview** the one primary · the statement on the quotation's paper (`.inv-qt-doc`) with its own table `inv-soa-*`; the slips two to an A4 sheet, `inv-ps-*` with their own pt and mm tokens, paper colours in dark mode too | the same dialogs, centred |
| Money → GST | the verdict card (the last closed month, due, paid or due by; the months the bank shows no payment for; Due, Paid, Not in the bank and Noted its factors) · *GST due and paid*: on the phone a row a month (the month, its status a dot and a word, its note under it; due and *paid ₹X* stacked at its end, `inv-row-end-stack`), the latest six and the rest behind *Show 6 more months*; a month's status opens its note | the table: month, due, paid, status (the status the button to its note) |
| People | view tabs Attendance · Pay · Areas · Roster (the tab map, TM4b; its Overview went: who is on site is Floor's People hero, its charts went to the view they explain) · **Attendance** is a switch Day · Week · Month (`inv-seg`, `data-att-period`) under its toolbar; the tab returns to the last of the three · every view leads with its verdict card (§6.28), then one toolbar row: the period ‹ › inside the row (`inv-tb-step`), the view's primary, More as its mark on the phone (*Go to today*, *this week*, *this month*; Print sheets; the files) · **Day**: the verdict (on site against the roster, the areas short; on site, half day, absent and unmarked its factors; the hours its facts) · **Paste message** the one primary, a sub-view with its way back · the board (an `inv-board` of area cards, each head its hands against the day's number in `areaNeedTone`'s tone, a line per hand with P/H/A `inv-seg` in its tone at the row's end, its meta two facts: the tier, then the day as worked, a half day or an absence in its word, the times, the hours or OT and the OT shifts' areas in one clause, present being the pressed P; Board / Sheet, the sheet Deepak's) · *Needed today* and the day's cost folded · Extra hours a row each (where, when, the hours, how many on it) that opens to its form, and stays open while it lacks what it needs · **Week**: the verdict (the week's attendance; today not yet in is not a gap) · attendance by week (folded) · the grid (`inv-table-grid`) · **Month**: the register's verdict, its page or a way to start it · **Pay**: the payout against its usual week (so far, predicted, usual and against it its factors; the tiers, the EXTRA pool and the snacks in its body, then *Hours to check* folded, said on the card's face as *N hands with hours to check*: a hand named on a block their own times do not reach, each with *Open the day*) · labour ₹/kg by month and the payroll against the bank, folded (the bank's series only for a role that sees money) · due by worker as row buttons under `inv-row-group`s · the payment form folded on the phone · **Areas**: the verdict (the extra checks out, or how many bookings to explain) · the extra checked, the disagreements first, each with Explain, the first eight and the rest one tap away · staffing by area · the hours by area and the pro-rata split folded · **Roster**: the verdict (active, and to watch: motivation low on firm figures; Active, To watch, Check-ins due and Left its factors; To watch and Check-ins due filter the rows, an `inv-token` saying so on the phone) · **Add worker**, Import under More · rows under `inv-row-group`s by tier (*To watch* first, *Left* last): the area and the pay (the base rate with an overtime hour's) the meta line, the glance bars, a badge only for a state (to watch, inactive) | the same; the period's way back a button, Pay's form open, the Day row's controls beside the name, Roster a table beside the open worker. *Built.* |
| Stats | view tabs By client / Cost / Trends (the open one scrolled into view; the tab map, TM2b) · each led by its verdict card (§6.28): By client how many large accounts sit below their cost, the worst named; Cost the live cost and the share of it measured; Trends the period's headline, its four figures the factors and each old callout a badge on its factor and one line · period `inv-seg` (MTD / QTD / YTD / All) · every card a flush panel named by `data-card`, its qualifier an `inv-note` in the title · By client: contribution by client as an `inv-table` scrolling sideways, signed figures `inv-num-pos/-neg`, the worst account settled under an `inv-row-group`; the next challans, revenue by client `chartRankedBars` or `chartPie` (Ranked / Share an `inv-seg-fit` in the head), then realisation by client (drill-through rows, below cost a dot and a word) and concentration, folds shut on the phone · Cost: the labour card, the live cost's components `inv-row-fold`s with the source an `inv-badge`, the bills a fold of one row (TM2) and *Add a bill* a link to Money → Payments' form (TM3) · Trends: six months as an `inv-table`, the trend chart, top items a fold shut on the phone · the client drill-down: tiles and state dots on the front, rows and the one primary on the back | same, two-column panel grid (`inv-panels-dense`), three columns from 100rem; the verdicts open. *Built.* |
| History | its verdict card (TM6f: *14 events today · 1 deletion this week*, danger when anything was deleted or cancelled) · one toolbar row (TM6c): the search, **Filter** (client, who, the kind of event as one `<select>`: Every kind · Invoices · Challans · Status · Floor · Audit · Changes, From / To as labelled `inv-field`s; a dialog on the phone, its filters said as tokens under the row) and More (*Export CSV*); the filters and the kind's seven chips had filled half the phone's first screen · a change in the log reads its record, then what moved (*Asha changed invoice SEP/…/00941, ALPHA FORGINGS: rate 13 → 13.2; qty 3 → 4*: two facts, TM6e), at most 110 characters (a void says why in the words typed; a record's name too long loses its last parts to "…", whole in the row's title, the pane and the CSV) · a floor day's row is its count (*Attendance recorded: 17 present, 6 absent, 9.0 h OT*), where everybody stood its whole, and it opens the day on People → Attendance · a flush panel (*Activity log* and its count, the total shown an `inv-note`) of rows grouped by day (`inv-row-group` with the day's count), each led by its event icon, the sentence wrapping, the time mono with `floor day` or `recorded` after it, and a dot and a word in its end (a deletion or cancellation danger, an accepted duplicate, an explained exception or a corrected challan warning, a status ok) · a row that opens is a `button.inv-row` (an invoice, a challan, a floor day); a void, whose invoice is gone, a plain row · empty: an `inv-empty` saying whether the filters or the book are why | the same row, its filters inline and the range a dialog of its own (*Range*, the button saying the range in use) · the log as an `inv-table` (modifier `inv-table-history`: time, event, kind, amount) grouped by day (`tr.inv-table-group`); an event that opens is an `inv-btn-link`, so it opens from the keyboard; the pane holds the event whole, and a floor day's *Open the day*. *Built.* |
| Office → Knowledge | view tabs Start · Library · Troubleshoot · Records · Training (the open one kept per device) · **Start** an overview (TM6f): its toolbar (**Write**), then a hero for each thing that waits and only those (waiting for your approval, carrying the screen's verdict; drafts to review; for anyone else what they wrote; decisions to review; training due again; one card, *Nothing waits on you*, when none does), each saying its count in its line, no figure over it, and a fact only where it is news; on the phone the first opens on its rows and the rest wait shut, on the desktop all open; then Start here paths and Latest · **Library, Troubleshoot, Records and Training** each lead with a verdict card (*25 articles · 1 waiting for approval*; *3 faults written · 1 incident in 30 days*; *40 records · 1 decision due for review*; *1 due again · 9 never taught · 3 up to date*; Troubleshoot's and Training's, cards of facts alone, shut on the phone, `foldFacts`), then one toolbar row: the search, **Filter** (the kind and, for a writer, the status as `<select>`s; the kind chips had run to four rows on the phone), the one primary (**Write**; Troubleshoot's **Log an incident**, Write a fault under More; Training's **Record training**) and More (the Library's Export and Import, the owner's); the filters and what the list is linked to as tokens under the row · rows grouped by kind or month (`inv-row-group`), a summary cut at a word near 90 characters (its whole in the row's title), a status `inv-badge` at the end where not published; Training's lessons and hands end in a dot and a word by their standing (due again warning, never taught info, up to date ok), each path's head saying whom it is for · an article: kind and status badges, the summary (`inv-kb-summary`), the kind's facts as `inv-kv`, a fault's causes and an incident's day as flush panels of rows, a decision's figures then and now as an `inv-table`, the text (`inv-kb-body`: paragraphs, lists and numbered lists, `inv-kb-h` heads, all escaped), photos (`inv-kb-fig`), links as `inv-chip`s, earlier versions folded, its actions an `inv-toolbar` (`inv-kb-actions`) · the form a sub-view with the back head and the action bar (Save draft, **Publish** or **Send for approval**) | Library, Troubleshoot and Records are a list beside the open article (`kbHost`, `inv-pane`), the verdict and the one row (its filters inline) above it, the open row `aria-current`; with an article open its own primary is the view's one, the toolbar's steps aside (QA chain, 5 Oct 2026); Start and Training stay documents. The book is in the top bar on both layouts (an `inv-btn-icon` on the desktop) |
| Settings | an `inv-dialog-wide` whose head stays put · groups stacked, each under its title · sections as `inv-panel-fold`s whose head says what each is set to, `● Unsaved` while edited · fields `inv-field` / `inv-input` (`-num` for figures, `inv-id` for identifiers), tick boxes `inv-field-check`, a key with its show button, derivations in a callout, How this is used a fold, Save per section | two-pane: the groups as `inv-side-item`s (`aria-current`, `● Unsaved`) beside one group. *Built.* |

**Paste message** (stock and attendance rolls) keeps its review contract — every line beside what it was
read as — with `inv-badge` verdicts ("Needs you", "Check", "read as …"). The stock check is built: a flush panel of
`inv-row-top` rows, each the line number and name, the text as sent (`inv-quote`), what was read (mono), its questions as
callouts, a figure's choice as `inv-chip`s (`aria-pressed`) and its picker as an `inv-field`; Needs you · Check · Clear
above as `inv-tiles-3`; Save in the action bar with the entries it will write. The attendance roll is built the same way: its
questions a panel of callouts with their pickers, each day a flush panel of rows (what changes a badge: New, Updated, Kept, Same),
the message line by line as `inv-quote`s, Save in the action bar. The production check is the same again: a flush panel per
message (who sent it and when in the head), each load or run a row with its text as sent and what was read, its questions as
callouts, a client `<select>` whose answer covers every row of that written name, a roll block's line as `inv-chip`s marked
*(header above)*, and Save disabled while a row needs you.

---

## 8. What this does not touch

- **Printed documents** — the tax invoice, the test certificate, the credit note, the sales register, the statement of account and the pay slip —
  keep their own token blocks, faces and point sizes. The UI tokens must never leak into them; the existing
  print specs (sheet fit, font independence, 0-margin `@page`) are the guard.
- Business rules, data, persistence, `data-action` names and element ids. The redesign is a restyle and a
  re-assembly, not a rewrite; the test suite's selectors are the contract.

---

## 9. Migration plan (route 1: native CSS, no build step)

Each phase is one PR, full suite green, before/after screenshots of every touched screen in light and dark,
phone and desktop.

1. **Foundation** — *built 26 Sep 2026.* New token block (§3) with `light-dark()`, the three palettes, theme + palette + density
   plumbing and Settings → Appearance, the new icons (§3.11), Geist faces,
   `:focus-visible` ring, the new app shell (§4, §6.1). Old tokens were kept as **aliases of the new** (removed in step 4) so every
   existing rule renders in the new palette immediately. The old domain tokens map onto the status tones.
2. **Components** — *built 26 Sep 2026.* §6.3–§6.18 sit in one block at the end of `styles.css`
   ("COMPONENTS v2.0"), and each rule also names the v1.0 families that do the same job, so every screen
   already renders the one look (cards → panel, the KPI and stock tiles → tile, every badge family → badge,
   the Clients segment and Stats tabs → view tabs, banners → callout, overlays → dialog). Labels are
   sentence case everywhere (DR-5); the duplicated `inv-chip` is one rule; decorative tone fills are neutral.
   Step 3 moved the markup onto the v2.0 class names and deleted the v1.0 names from those selector lists.
3. **Screens, in order:** Home *(built 26 Sep 2026)* · Register *(built 26 Sep 2026)* · IM *(built 26 Sep 2026)* · Create *(built 26 Sep 2026)* · Clients/Items/Performance *(built 26 Sep 2026)* · To-do *(built 26 Sep 2026)* · Stock *(built 26 Sep 2026)* · Staff *(built 26 Sep 2026)* ·
   Stats *(built 26 Sep 2026)* · History *(built 26 Sep 2026)* · Settings *(built 26 Sep 2026)*. Each moves its render functions onto the components and deletes its private
   family in the same PR (DR-7). The survey's bugs are fixed where their screen moves: History's filter bar,
   Register's desktop list, the doubled Add buttons, Staff's cut-off sub-tabs, the base-colour dark-mode text,
   the duplicated `inv-chip`, IM's filter `<select>`s answering `click`, Settings' head scrolling away on the phone.
4. **Clean-up** — *done 26 Sep 2026.* Every v1.0 class and every alias token is gone (`styles.css` 1,870 → 1,553 lines);
   the last users — the credit note, number audit, invoice cancel and delete dialogs, the bank row's tick boxes, the
   list/pane container, the chart parts — moved onto §6; every dialog is one shell (§6.16); the §3.9 exceptions were
   confirmed as the only raw values; CLAUDE.md's class count is measured (427, every one `inv-`). P76 sweeps every
   screen, view tab and dialog on the phone and the desktop, light and dark, and fails on any retired or unstyled class.

5. **Coded fills, screen by screen** — *done 13 Oct 2026: Today on 8 Oct, every other screen in the tab map's TM2–TM6* (owner: *"first let's work on needs you and pulse tabs, then we
   can see what the baseline is and how to implement it in other tabs too"*). HR-9 already holds on every screen through the
   tokens (§3.1); what moves screen by screen is the card language: a block that is read for its verdict becomes a hero coded by
   its status, what it holds coded boxes, its controls tinted; a list's rows stay rows on a tinted panel, with only its head and
   summary as cards. **The order is `docs/TAB_MAP.md`'s** (the tab map and the cognitive load, one spec, 9 Oct 2026): every
   screen the survey measured (`docs/COGNITIVE_LOAD_SURVEY.md`, 8 Oct 2026) has its step and its target there. A screen that is a
   document (a report, the power case) stays paper, fitted to the screen.

**Route 3 (a framework build) is a separate app** in its own folder of this repo, built to this same
document. See `docs/NEXT_SESSION.md` for the rule that keeps the books safe while both run.

### 9.1 Checklist for any UI PR
- [ ] Uses only §6 components (or amends this document); P76's sweep is green (no retired or unstyled class, no second
      primary, no `<select>` with a `data-action`, no duplicate id, nothing wider than the phone).
- [ ] No raw values outside §3.9; no new tone word in a class name.
- [ ] Light and dark both checked; contrast ≥ 4.5:1 for text.
- [ ] Phone (393px) and desktop (1280px) both checked; compact and comfortable both usable.
- [ ] Every interactive element: real `<button>`/`<a>`/`<input>`, `:focus-visible` ring, `aria-label` if icon-only.
- [ ] Figures mono, right-aligned; sentence case; status = dot/badge + word.
- [ ] Printed documents unchanged (print specs green).
- [ ] The benchmark (§4.3): P195 within every budget (none raised without saying so in the PR), P197 green on both layouts; the
      owner's book measured before and after in the scratch harness.

---

## 10. Decisions

| # | Question | Decided |
|---|---|---|
| 1 | Palette | **Three, per device; Teal the default** (owner, 26 Sep 2026) — §3.1 |
| 2 | App icon | **Redrawn in the palette**; the installed icon is Teal (platform limit) — §3.11 |
| 3 | Default theme | **Follow the phone's setting** — §3.2 |
| 4 | Ctrl K command palette on the desktop | Open. Shown in the mock-up; the research did not support it as an expectation. Not built in route 1. |
