# SEP Invoicing — Design System
**Version 2.0 · "Dense console" · adopted 26 Sep 2026** (supersedes v1.0 of 13 Apr 2026)

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
- **Quiet chrome, loud status.** No coloured header bar, no drop shadows on content, no decorative boxes.
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

And the v2.0 rules, which carry the same weight:

| DR | Rule |
|----|------|
| DR-1 | **Colour means status.** Only the status tones (§3.3) may colour text, dots or fills that convey state. Never colour alone: a tone always travels with a word or a symbol. |
| DR-2 | **One accent, for interaction.** `--accent` marks the primary action, the current selection, the active tab/nav item, focus, links, and the current period in a chart. Nothing else. |
| DR-3 | **One primary button per view.** Everything else is secondary, ghost or link. |
| DR-4 | **Figures are `--ff-mono`, tabular, right-aligned** in any column or tile. Identifiers (invoice, challan, P.O., vehicle, GSTIN) are mono too. Prose numbers inside a sentence are not. |
| DR-5 | **Sentence case everywhere** — titles, labels, buttons, column heads, tabs. No uppercase letter-spaced labels. |
| DR-6 | **No shadows on content.** Surfaces are separated by a 1px `--border` hairline or by the surface tier. Shadows exist only on floating layers (menus, dialogs, toasts). |
| DR-7 | **Components, not one-offs.** A screen is assembled from §6. A module may add a modifier (`inv-table-week`), never a parallel family (`inv-stk-row` beside `inv-row`). |
| DR-8 | **Status is a dot + a word** in rows and tables (`● Dispatched`); a soft badge only where the state needs more weight than the row around it. |

---

## 3. Tokens

Two layers. **Primitives** hold raw values and are never read by a component. **Semantic aliases** give them
meaning and are the only thing components read. A theme or palette swaps aliases; components never change.

### 3.1 Palette — Teal (primitives)

| Primitive | Light | Dark |
|---|---|---|
| `--c-bg` | `#f4f6f7` | `#0d1213` |
| `--c-surface` | `#ffffff` | `#131a1b` |
| `--c-surface-2` | `#eaeff1` | `#1a2224` |
| `--c-surface-3` | `#dfe6e9` | `#222c2e` |
| `--c-border` | `#d8e0e3` | `#293537` |
| `--c-text-1` | `#11191c` | `#ecf2f2` |
| `--c-text-2` | `#4a585e` | `#a6b6b8` |
| `--c-text-3` | `#5f6f75` | `#7d8f91` |
| `--c-accent` | `#0d6b63` | `#4fc1b3` |
| `--c-on-accent` | `#ffffff` | `#04211d` |
| `--c-accent-soft` | `#dcefec` | `#15302d` |
| `--c-accent-soft-text` | `#0a4d47` | `#8fdcd2` |

Two alternates were mocked and are kept as documented primitive sets, so a future change of palette is a
swap of this table only: **Zinc & brass** (accent `#8a5d0c` / dark `#dcaa4c`, cool zinc neutrals) and
**Terracotta** (accent `#ad4f2c` / dark `#e98c64`, warm neutrals — the v1.0 identity). Values are in the
mock-up source.

### 3.2 Theme: light, dark, and following the system

- Each semantic colour is declared **once** with `light-dark(light, dark)`; there is no duplicated `.dark {}`
  block. `light-dark()` resolves by `color-scheme`, so the theme is set there:
  ```css
  :root                     { color-scheme: light dark; }   /* follow the device */
  :root[data-theme="light"] { color-scheme: light; }
  :root[data-theme="dark"]  { color-scheme: dark; }
  ```
- **Settings → Data & device → Appearance: System / Light / Dark**, stored per device in localStorage
  (`sep_inv_theme`), applied to `<html data-theme>` before first paint by a two-line script in `head.html`.
  Never on `S`: a theme is a fact about the device, not the books.
- ⚠ **v1.0 shipped dark styles that nothing could switch on**: `.dark` was defined in the stylesheet and no
  code ever set it. v2.0 is the first version in which dark mode is reachable. Both themes are tested (§9).
- `light-dark()` is colour-only (it takes no images). Chrome/Edge 123+, which covers every device the shop uses.
- `meta[name=theme-color]` gets two tags with `media="(prefers-color-scheme: …)"`, `--c-surface` of each theme.

### 3.3 Semantic colour aliases

| Alias | Use |
|---|---|
| `--bg` | the page behind everything |
| `--surface` | panels, tables, bars, inputs |
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
| `--ok` / `--ok-bg` | matches, healthy, present, delivered, measured | `#1b7a3d` / `#e4f3e8` | `#72c98f` / `#14301e` |
| `--info` / `--info-bg` | in transit, informational, market rate, "on shelf" | `#1d5ea6` / `#e6effa` | `#8dbaf0` / `#15263a` |

`--neutral` is `--text-3` on `--surface-2` (created, filed, model, no data). **The v1.0 domain colours
(`--attend`, `--cost`, `--prod`, `--neutral`, `--todo`, `--cw`, `--perm`) are retired** into these five.

**Chart series** (`--chart-1…8`, `--chart-other`) stay for categorical charts (pies, stacked bars), redrawn
from this palette in both themes. A single-series chart uses `--surface-3` bars with the current/selected bar
in `--accent` (§6.17).

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
| `--t-micro` | 0.6875rem (11) | 1.3 | 500 | base | nav labels, counts in the sidebar, key hints |
| `--t-num` | as body | | 400/600 | mono | any figure in a row or table |
| `--t-stat` | 1.1875rem (19) phone / 1.375rem (22) desktop | 1.15 | 600 | mono | stat tiles (§6.9); letter-spacing `--ls-tight` |
| `--t-hero` | 1.5rem (24) | 1.1 | 600 | mono | the single headline figure of a view, at most one |

Size tokens: `--fs-11 .6875rem · --fs-12 .75rem · --fs-13 .8125rem · --fs-14 .875rem · --fs-17 1.0625rem ·
--fs-19 1.1875rem · --fs-22 1.375rem · --fs-24 1.5rem`. Letter-spacing: `--ls-tight: -0.02em`, `--ls-0: 0`
(the five raw `em` values in v1.0 are gone). Weights: 400, 500, 600 only.

### 3.5 Spacing and density

4px base; the existing `--sp-*` scale stays (`--sp-2 … --sp-32`, rem). Components never read `--sp-*` for
their **own** paddings and heights — they read density aliases, so one attribute changes the whole app:

| Alias | Comfortable | Compact |
|---|---|---|
| `--row-h` (table/list row) | 2.75rem (44) | 2rem (32) |
| `--row-h-2` (two-line row) | 3.5rem (56) | 2.75rem (44) |
| `--ctl-h` (button, input, select) | 2.75rem (44) | 1.875rem (30) |
| `--ctl-h-sm` | 2.25rem (36) | 1.625rem (26) |
| `--pad-x` (cell, panel side) | `--sp-12` | `--sp-12` |
| `--pad-y` (panel head) | `--sp-10` | `--sp-8` |
| `--gap` (between panels) | `--sp-12` | `--sp-12` |

- `:root { data-density }` — **`compact` on the desktop layout, `comfortable` on phone and tablet** by
  default; the owner can override per device in Settings → Data & device → Appearance (`sep_inv_density`).
- **44px touch targets are kept wherever the pointer is coarse.** Compact is applied only under
  `body.inv-desktop` *and* `@media (pointer: fine)`; a touch laptop stays comfortable. Callouts, dialogs,
  toasts and form hints are never compacted.

### 3.6 Radius, elevation, motion, layers

- Radius: `--r-sm 0.25rem (4)` chips, cells, checkboxes · `--r-md 0.375rem (6)` buttons, inputs, tokens ·
  `--r-lg 0.5rem (8)` panels, tiles · `--r-xl 0.625rem (10)` phone panels, dialogs · `--r-full`.
- Elevation (DR-6): `--shadow-pop: 0 0.25rem 1rem rgb(0 0 0 / 0.14)` for menus and toasts,
  `--shadow-dialog: 0 1rem 3rem rgb(0 0 0 / 0.28)` for dialogs. Nothing else casts a shadow.
- Scrim: `--scrim: rgb(0 0 0 / 0.45)` (one token; v1.0 had four raw values).
- Motion: `--dur-1: 120ms` (hover, press, toggle) · `--dur-2: 200ms` (panels, dialogs, tab switch) ·
  `--ease: cubic-bezier(.2,.7,.2,1)`. All motion sits inside `@media (prefers-reduced-motion: no-preference)`.
  Tab changes may use the View Transitions API as a progressive enhancement; nothing depends on it.
- z-index tokens: `--z-bar 20 · --z-dropdown 50 · --z-scrim 100 · --z-dialog 200 · --z-toast 500 · --z-print 510`.
- Focus: `--focus-ring: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent)` on `:focus-visible`, **every**
  interactive element (v1.0's `inv-btn` had none).

### 3.7 Layout tokens

`--bar-h: 3.25rem (52)` phone top bar · `--bar-h-desk: 3rem (48)` · `--nav-h: 3.625rem (58)` phone bottom
bar · `--side-w: 13.5rem (216)` desktop sidebar · `--content-max: 80rem` desktop content cap ·
`--max-w: 32.5rem (520)` phone column (unchanged).

### 3.8 Breakpoints

JS already decides the layout (`init.js updateLayoutMode`): **phone < 768 · tablet 768–1023 (phone chrome,
wider column) · desktop ≥ 1024** via `body.inv-desktop` / `body.inv-tablet`. CSS keys off those classes, not
its own media queries, so the two can never disagree.

### 3.9 HR-6 exceptions (closed list)

1. `44px` minimum touch target (as `--touch: 2.75rem`, read via `max()`); 2. 20px/16px icon boxes (§5.6);
3. print CSS and the three document token blocks (`.inv-print-invoice`, `.inv-qc-page`, `.inv-cn-doc`) and
the sales register's `--sr-*` block; 4. SVG presentation attributes inside `charts.js` output (viewBox units),
which read `var()` for every colour. Anything else raw is a defect.

### 3.10 Contrast (measured, WCAG 2.x)

Light: text-1/surface 17.8 · text-2 7.4 · text-3 5.2 (≥ 4.5 on `--surface-2` too) · accent/surface 6.4 ·
danger/danger-bg 5.8 · warning 5.4 · ok 4.7 · info 5.7. Dark: text-1 15.6 · text-2 8.4 · text-3 ≥ 4.8 on
every surface · accent 8.1 · on-accent/accent 7.8 · tones 6.6–7.8. **A palette change must re-measure this
table before it merges.**

---

## 4. Information architecture

### 4.1 Phone and tablet

- **Top bar** (`--bar-h`, `--surface`, bottom hairline): page title (`--t-title`), then at most **two**
  actions on the right — the view's primary action and one secondary (or an icon button). Settings is an
  icon button on Home only; elsewhere it lives in More.
- **Sub-tabs** sit directly under the top bar, inside the same surface (§6.4, underline tabs), and scroll
  horizontally when they do not fit — never cut off, never wrap.
- **Bottom bar** (`--nav-h`): Home · Create · IM · Register · Clients · More, icon + `--t-micro` label; the
  active item is `--accent` with a 2px accent rule on its top edge. More carries the red count of every red
  row (stock and overdue tasks), as now.
- **No floating action button.** The primary action is in the top bar. (v1.0 had both on Clients and Items.)
- **Sticky action bar** (§6.15) at the bottom of forms, above the bottom bar, carrying the total and Save.

### 4.2 Desktop

- **Sidebar** (`--side-w`, `--bg`, right hairline), labelled, grouped, always expanded:
  - brand mark + "Soma Electro"
  - **Daily** — Home · Create invoice · Challans *(count: pending)* · Register *(count: this period)*
  - **Book** — Clients · Items
  - **Floor** — Stock *(amber/red count)* · Staff · Pay
  - **Review** — To-do *(red count)* · Stats · History
  - Settings, pinned to the bottom.
  Items and Pay open their parent tab on that sub-view. Counts are `--t-micro` mono; a count is toned only
  when it is a problem count.
- **Top bar** (`--bar-h-desk`): title (`--t-title-desk`) · `/` · context (period, date, week) · underline tabs
  inline when the view has them · spacer · search · secondary actions · one primary.
- **Content** fills the rest; tables run edge to edge of the content area; a detail pane (§6.14) may take
  the right 22rem. The old 64px icon rail is retired.

---

## 5. Foundations for components

### 5.1 Surfaces
Page `--bg`; every block of content is a **panel** on `--surface` with a 1px `--border` and `--r-lg`
(`--r-xl` on the phone). A panel never sits inside another panel; group with a hairline instead.

### 5.2 Hairlines
Row dividers are `1px solid var(--border)`. The last row in a panel has none. Header bands use `--surface-2`
(phone) or `--bg` (desktop tables) with a bottom hairline.

### 5.3 Text in rows
Primary line `--t-body-strong`; meta line `--t-caption` in `--text-3`, mono when it is identifiers and
quantities (`ch 834, 835 · 348.09 kg`). Truncate with an ellipsis on one line; a truncated cell carries a
`title` with the full text.

### 5.4 Figures
`formatCurrency()` output, mono, right-aligned. Negative money is `−₹` (U+2212) and `--danger`; positive
deltas that matter are `--ok`. Units after a figure are `--text-3` (`54 L`, `12 kg`). Deltas read
"+12% on Aug", not arrows alone.

### 5.5 States
Hover `--surface-2` (pointer only) · pressed `--surface-3` · selected `--accent-soft` · disabled 45% opacity
and `cursor: not-allowed` · focus `--focus-ring`.

### 5.6 Icons
Inline SVG, 24 viewBox, `stroke: currentColor`, `stroke-width: 1.8` (2 at 16px), round caps and joins,
no fill. 20px on the phone, 16px (compact) or 18px on the desktop. Icon-only buttons carry `aria-label`.
The icon set is the one in `body.html`/`tabs.js` plus the additions in the mock-ups (items, pay, search,
chevrons, settings sliders).

---

## 6. Components

Each entry gives the class, the anatomy, and what it replaces. Modifiers are `inv-<component>-<mod>`.

### 6.1 App shell — `inv-shell`, `inv-topbar`, `inv-side`, `inv-navbar`
As §4. `inv-topbar-title`, `inv-topbar-ctx`, `inv-topbar-actions`; `inv-side-group`, `inv-side-item`
(`-on`), `inv-side-count` (`-warning`/`-danger`); `inv-navbar-item` (`-on`), `inv-navbar-count`.
Replaces `inv-header`, `inv-tabs`/`inv-tab` (the old bottom bar — which is why view tabs are `inv-viewtab`), `inv-sidebar*`, `inv-fab`.

### 6.2 Page head (phone, in-content) — `inv-pagehead`
Used only where a view has a summary line worth more than the top bar: `inv-pagehead-meta`
(`--t-caption`, e.g. "Last count 24 Sep · 17 lines"). Replaces `inv-stk-top/h1/meta` and the various count
strips ("1269 challans", "118 active invoices", "24 clients").

### 6.3 Buttons — `inv-btn`
`inv-btn-primary` (accent fill) · `inv-btn-secondary` (surface + border — the default) · `inv-btn-ghost`
(no border) · `inv-btn-danger` (danger text; filled only inside a confirm dialog) · `inv-btn-link` (accent
text, no box) · `inv-btn-icon` (square, `aria-label`) · size `inv-btn-sm`, width `inv-btn-block`.
Height `--ctl-h`, radius `--r-md`, `--t-body` 500 (primary 600). Replaces `inv-stk-btn*`, `inv-stk-tool`,
`inv-stk-back`, `inv-link-btn`, `inv-quick-action`, `inv-header-btn`, `inv-overlay-close`,
`inv-att-nav-btn`, `inv-im-sel-btn`, `inv-sel-clear-btn`, `inv-td-fold`.

### 6.4 View tabs — `inv-viewtabs` (role=tablist)
Underline tabs: `inv-viewtab` (`role=tab`, `aria-selected`), `--t-label` desktop / `--t-body` phone, active
`--text-1` 600 with a 2px `--accent` inset rule at the bottom. Horizontal scroll on overflow. **The one
control for switching views** — Clients/Items/Performance, Staff Day/Week/Pay/Areas/Roster, Stats
Overview/Clients/Cost/Billing/Trends, Stock views. Replaces `inv-subview-toggle`, `inv-stats-tabs`, the chip
rows used as tabs (`inv-stats-chips` + `inv-chip` in staff.js), `inv-set-nav-btn` (Settings keeps its two-pane
layout, drawn with `inv-side-item`).

### 6.5 Segmented control — `inv-seg`
Joined buttons in one bordered box, the "on" segment `--surface-2` + 600 (desktop) or `--accent-soft`
(phone). For a **setting of the current view**, not navigation: period (MTD/QTD/YTD/All), span
(1/4/12 weeks), metric (₹ / Tonnes / ₹/kg), density. `inv-seg-btn` (`aria-pressed`). Replaces `inv-stk-seg`,
`inv-stats-chips` as period pickers, `inv-pred-chip`.

### 6.6 Filter tokens and chips — `inv-token`, `inv-chip`
- `inv-token`: an **applied** filter, "`Month` Sep 2026 ×", `--surface-2`, `--r-md`, key in `--text-3`;
  "+ Filter" is `inv-token-add` (dashed border). The active one on the phone is `--accent-soft`.
- `inv-chip`: a **choice among options** inside a form (zero-rate reason, P/H/A on the desktop grid,
  stock basis). `inv-chip-on`. One definition (v1.0 defined `.inv-chip` twice). Replaces `inv-zero-opt`,
  `inv-stk-choice`, `inv-td-pill`, `inv-att-chip`, `inv-rm-chip` as a picker.

### 6.7 Toolbar and search — `inv-toolbar`, `inv-search`
`inv-toolbar`: search + tokens + view settings, one line on the desktop, wrapping to two on the phone.
`inv-search`: bordered field with the search icon inside and, on the desktop, a `/` key hint.
Every searchable list uses it. Replaces `inv-reg-toolbar`, `inv-im-toolbar`, `inv-items-toolbar`,
`inv-cp-toolbar`, `inv-history-filters`, `inv-search-wrap`, `inv-reg-search`.

### 6.8 Panel — `inv-panel`
`inv-panel-head` (`--t-heading` title · optional count in mono `--text-3` · spacer · actions as
`inv-btn-link`/`-sm`), then body. `inv-panel-flush` for a panel whose body is rows or a table (no padding).
Replaces `inv-card`, `inv-card-list`, `inv-stats-card`, `inv-im-challan`, `inv-stk-hero`, `inv-stk-metabox`,
`inv-set-sec`'s box, `inv-dupe-group`, `inv-td-facts`, `inv-rl-rows`.

### 6.9 Stat strip — `inv-tiles`, `inv-tile`
A grid of tiles separated by 1px gaps on a `--border` background inside one bordered box.
`inv-tile-label` (`--t-label` `--text-3`), `inv-tile-value` (`--t-stat`), `inv-tile-sub` (`--t-caption`;
toned only when it states a status). A tile that filters its list is a `<button>`. Tone modifiers
`inv-tile-danger|warning|ok|info` colour the **value only**. 2 columns on the phone, up to 5 on the desktop.
Replaces `inv-kpi*`, `inv-ov-tile`, `inv-stk-tile`, `inv-stat-label/value`, `inv-lab-half`, `inv-lab-perkg`,
`inv-area-stat`, `inv-stats-metric-value`, `inv-att-count-value`, `inv-flip-kpi`.

### 6.10 Rows — `inv-row`
One or two lines, `--row-h` / `--row-h-2`, divider below. Slots: `inv-row-lead` (checkbox, dot or icon),
`inv-row-main` (`inv-row-title` + `inv-row-meta`), `inv-row-end` (figure, status, chevron). A group header
inside a list is `inv-row-group` (`--t-caption` on `--bg`, e.g. "25 Sep · 5 · ₹11,801.88").
**The phone form of every table.** Replaces `inv-client-item`, `inv-item-card`, `inv-reg-row`,
`inv-im-header`, `inv-att-row`, `inv-area-row`, `inv-history-item`, `inv-stats-row`, `inv-lab-row`,
`inv-pay-row`, `inv-rate-row`, `inv-cost-dline`, `inv-td-hrow`, `inv-more-item`, `inv-stk-row`,
`inv-stk-hrow`, `inv-stk-mrow`, `inv-td-row`.

### 6.11 Table — `inv-table`
A real `<table>`. `thead` sticky, `--t-label` `--text-3` on `--bg` with a bottom hairline; rows `--row-h`
with hairlines; numeric columns `inv-num` (mono, right); identifier columns `inv-id` (mono); status column
dot + word; checkbox column `inv-table-check`. Selected row `--accent-soft`. `tfoot` for totals. Column widths
are classes reading tokens (`inv-col-date`, `inv-col-money`, `inv-col-state`…), never raw px.
Modifier `inv-table-grid` for the week grid: cells are `inv-cell` chips (`-ok|warning|danger|empty|future`)
showing hours. Replaces `inv-desktop-table`/`inv-th`/`inv-tr`/`inv-td*` (**ending the `inv-td-` collision
with To-do**), `inv-stats-table*`, `inv-ov-table`, `inv-detail-items-table`, `inv-att-grid`.

### 6.12 Selection bar — `inv-selbar`
Appears at the bottom of a list or table while rows are ticked: "3 selected · ₹30,419.97 taxable", bulk
actions as `inv-btn-sm`, and the list's own total on the right. Replaces the register and IM selection
strips. The rule stands: **a selection never outlives the filter that hid it.**

### 6.13 Status — `inv-dot`, `inv-badge`
- `inv-dot` + text: 7px dot in the tone, word in `--text-2`. Default in rows and tables (DR-8).
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
Desktop only: the right 22rem of a list view, `--surface`, left hairline. Head (identifier in `--t-hero`
mono, status badge, party), a key/value grid (`inv-kv`), a nested table, totals, actions (one primary).
On the phone the same content opens as a sheet (§6.16).

### 6.15 Forms — `inv-field`, `inv-input`, `inv-select`, `inv-actionbar`
- `inv-field`: label **above** the control, `--t-label` `--text-2`, **sentence case** (DR-5); hint below
  in `--t-caption`; error below in `--danger` with the field's border `--danger`.
- `inv-input` / `inv-select` / `inv-textarea`: `--ctl-h`, `--surface`, 1px `--border`, `--r-md`; focus
  border `--accent` + `--focus-ring`. `inv-input-num`: mono, right-aligned. Read-only: `--surface-2`.
- `inv-fields` lays fields in a grid: 1 column phone, 2–4 desktop.
- Line-item editor rows use `inv-input-num` in a three-up grid (pieces · kg · rate) with the rate/weight
  verdict below as `inv-dot` + text.
- `inv-actionbar`: sticky at the bottom of a form — total (label + `--t-stat`), secondary, primary.
- `inv-form-*` and `_sfg()` keep working during migration as aliases (§7) and are then removed.
Replaces `inv-form-group/label/input/select/row`, `inv-stk-label`, `inv-stk-field(s)`, `inv-stk-in`,
`inv-td-in`, `inv-reg-range-field/label`, `inv-area-target-label`, `inv-att-block-label`.

### 6.16 Overlays — `inv-dialog`, `inv-sheet`, `inv-menu`, `inv-toast`
- `inv-dialog` (desktop, centred, `--r-xl`, `--shadow-dialog`, max 40rem) and `inv-sheet` (phone, from the
  bottom, full width, `--r-xl` top corners). Both: head (`--t-heading` title + close icon button), scrolling
  body, sticky foot with actions right-aligned (primary last). Built on `<dialog>` where it fits. Scrim
  `--scrim`. Focus stack and `document.body.style.overflow` rules unchanged.
- Confirm dialogs for destructive actions: danger-filled primary, the consequence stated in the body.
- `inv-menu`: dropdowns and autocompletes, `--surface`, `--border`, `--shadow-pop`, keyboard as now.
- `inv-toast`: bottom-centre, `--text-1` background with `--surface` text (it inverts with the theme),
  `--shadow-pop`, tone shown by a leading dot.
Replaces `inv-overlay-scrim/card/header/title/close`, `inv-more-scrim` (the duplicate scrim),
`inv-confirm-*`, the To-do overlay's Fraunces title.

### 6.17 Charts — `charts.js`
Same module, restyled: axis text `--t-micro` mono `--text-3`, gridlines `--border`, baseline `--text-3`.
**Single series:** bars `--surface-3`, the current or selected bar `--accent`, value labels mono above bars.
**Second measure** (e.g. ₹/kg over revenue): a 1.5px `--text-2` line. **Categorical:** `--chart-*`.
Legend is inline in the panel head. Every datum keeps its `<title>`. SVG `font-size` attributes become the
`--fs-*` tokens via `var()` on the text elements' class.

### 6.18 Callout and empty state — `inv-callout`, `inv-empty`
- `inv-callout-info|warning|danger|neutral`: tone bg + tone text, `--r-lg`, leading icon, `--t-body`.
  For "how this figure is made" notes, caveats and warnings about the data on screen.
  Replaces `inv-stats-caveat`, `inv-stats-alert`, `inv-stk-banner*`, `inv-confirm-warn`, `inv-reissue-note`,
  `inv-merge-warn`, `inv-reg-scope-note`, `inv-zero-reason`, `inv-area-flag`, `inv-set-derive`.
- Plain explanatory text under a panel is `inv-note` (`--t-caption` `--text-3`). Replaces `inv-stats-note`,
  `inv-dupe-note`, `inv-numaudit-note`, `inv-form-hint`, `inv-stk-hint`, `inv-cp-group-note`.
- `inv-empty`: centred in its panel, `--text-3`, one line saying what would appear and the action that
  makes it appear. Replaces `inv-empty-state(-sm)`, `inv-stk-empty`, `inv-td-empty`, `inv-chart-empty`.

### 6.19 Settings
Keeps its six groups, folded sections and per-section Save (see CLAUDE.md § Settings), redrawn with
`inv-side-item` (desktop group nav), `inv-panel` sections, `inv-field`. Adds **Appearance** (theme §3.2,
density §3.5) under Data & device.

---

## 7. How each screen is assembled

| Screen | Phone | Desktop |
|---|---|---|
| Home | stat strip (revenue, invoices, plated, ₹/kg) · quick actions (2×3 `inv-btn-secondary`, first primary) · To-do panel of rows · Floor today panel (area table) | stat strip ×5 · six-month chart · contribution-by-client table · To-do · floor-by-area tiles |
| Create | fields · unbilled-challan rows with checkboxes · line editor · collapsible optional details · action bar | same, two-column fields, lines as a table |
| IM | toolbar · rows grouped by date (challan no., client, amount; meta: date · vehicle · items; status dot) · selection bar | table + detail pane |
| Register | toolbar with tokens · rows grouped by day with subtotal · selection bar | table (invoice, client, date, challans, kg, taxable, GST, total, state) · selection bar · detail pane |
| Clients / Items / Performance | tabs · toolbar · rows | tabs · table · detail pane |
| To-do | tabs (Open / Done) · add field · rows with a dot and meta | same, wider |
| Stock | stat strip (Out / ≤ 7 days / OK / No price, each filters) · one table grouped by status · reorder list as a table | same + detail pane for a line's pattern |
| Staff | tabs Day / Week / Pay / Areas / Roster · Day: date stepper, stat strip, rows with P/H/A segmented + area + OT · Week: grid (`inv-table-grid`) | same; Week grid shows hours per cell |
| Stats | tabs · period segmented · panels of stat strips, tables and charts | same, two-column panel grid |
| History | toolbar · rows grouped by day | table |
| Settings | groups stacked, folded sections | two-pane (side list + group) |

**Paste message** (stock and attendance rolls) keeps its review contract — every line beside what it was
read as — drawn as an `inv-table` with `inv-badge` verdicts ("Needs you", "Check", "read as …").

---

## 8. What this does not touch

- **Printed documents** — the tax invoice, the test certificate, the credit note and the sales register —
  keep their own token blocks, faces and point sizes. The UI tokens must never leak into them; the existing
  print specs (sheet fit, font independence, 0-margin `@page`) are the guard.
- Business rules, data, persistence, `data-action` names and element ids. The redesign is a restyle and a
  re-assembly, not a rewrite; the test suite's selectors are the contract.

---

## 9. Migration plan (route 1: native CSS, no build step)

Each phase is one PR, full suite green, before/after screenshots of every touched screen in light and dark,
phone and desktop.

1. **Foundation.** New token block (§3) with `light-dark()`, theme + density plumbing, Geist faces,
   `:focus-visible` ring, the new app shell (§4, §6.1). Old tokens kept as **aliases of the new** so every
   existing rule renders in the new palette immediately. The old domain tokens map onto the status tones.
2. **Components.** Add §6.3–§6.18 to `styles.css`, each with its dark coverage, and turn the old families into
   thin aliases where the markup cannot change yet.
3. **Screens, in order:** Home · Register · IM · Create · Clients/Items/Performance · To-do · Stock · Staff ·
   Stats · History · Settings. Each moves its render functions onto the components and deletes its private
   family in the same PR (DR-7). The survey's bugs are fixed where their screen moves: History's filter bar,
   Register's desktop list, the doubled Add buttons, Staff's cut-off sub-tabs, the base-colour dark-mode text,
   the duplicated `inv-chip`, IM's filter `<select>`s answering `click`.
4. **Clean-up.** Remove every alias, confirm the HR-6 exception list (§3.9) is the only raw-value set,
   update CLAUDE.md's Design System section and the class count.

**Route 3 (a framework build) is a separate app** in its own folder of this repo, built to this same
document. See `docs/NEXT_SESSION.md` for the rule that keeps the books safe while both run.

### 9.1 Checklist for any UI PR
- [ ] Uses only §6 components (or amends this document).
- [ ] No raw values outside §3.9; no new tone word in a class name.
- [ ] Light and dark both checked; contrast ≥ 4.5:1 for text.
- [ ] Phone (393px) and desktop (1280px) both checked; compact and comfortable both usable.
- [ ] Every interactive element: real `<button>`/`<a>`/`<input>`, `:focus-visible` ring, `aria-label` if icon-only.
- [ ] Figures mono, right-aligned; sentence case; status = dot/badge + word.
- [ ] Printed documents unchanged (print specs green).

---

## 10. Open decisions

| # | Question | Default until answered |
|---|---|---|
| 1 | Palette: teal, or zinc & brass / terracotta on the C layout? | **Teal** (as mocked) |
| 2 | App icon and `theme-color` still terracotta — redraw in the new accent? | Keep the icon; `theme-color` follows the surface |
| 3 | Default theme: follow the device, or light unless chosen? | **Follow the device** |
| 4 | Ctrl K command palette on the desktop (shown in the mock-up; research did not support it as an expectation) | Not built in route 1 |
