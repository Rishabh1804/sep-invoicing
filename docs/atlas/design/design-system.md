---
subject: "Design system: the migration to v2.0 and the polish passes"
domain: design
modules: [split/appearance.js, split/state.js]
specs: [docs/SEP_INVOICING_DESIGN_PRINCIPLES.md]
tests: [P54, P55, P67, P68, P69, P70, P71, P72, P73, P74, P75, P76, P80, P94, P104]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

## Design System

**`docs/SEP_INVOICING_DESIGN_PRINCIPLES.md` (v2.0, "Dense console", adopted 26 Sep 2026) is the one
document the interface is built on** — tokens, theme, density, navigation, every component, how each screen
is assembled, and the migration plan. Read it before touching `styles.css` or a render function; a UI
change that needs something it does not define amends it in the same PR. Its design rules DR-1…DR-8 carry
the weight of the hard rules above (colour means status; one accent for interaction; one primary button per
view; figures tabular and right-aligned (Geist since U2R; identifiers mono); sentence case; a card lifts, a well sinks, a layer floats (UI pass 3; no shadows on content until then); components, not one-offs; status
is a dot or badge plus a word).

**Step 1 of the migration is built (26 Sep 2026):** the v2.0 tokens with three palettes (Teal default,
Zinc & brass, Terracotta), theme following the phone, density, **no pure white anywhere in the interface**
(owner: *"it puts a lot of stress at our eyes"* — paper is the one exception; a hard rule since 8 Oct 2026, HR-9, with every
light surface a tinted step under OKLab L 0.97), the top bar naming each
screen, the grouped labelled sidebar, the nut icon in the palette, and Settings → Data & device →
Appearance. **There is no `.dark` class any more** (removed 26 Sep 2026): its 147 v1.0 rules restated tokens
that now switch by themselves, and some of them repainted selected states in the background colour — Staff →
Day's chosen P/H/A went invisible in dark (owner). Dark coverage (HR-7) is the `light-dark()` token, nothing else.

**Step 2 built the §6 components** as one block at the end of `styles.css`; step 3 moved every screen onto them.

**Step 3 is complete (26 Sep 2026), one screen per PR** in §9's order. **Home is built:** its markup is v2.0 only, and its private
family (`inv-qa*`, `inv-unbilled-*`, `inv-recent-*`, `inv-sync-card`, `inv-zinc-*`, `inv-td-hrow`) is deleted. Its tiles now
carry the month's tonnage and ₹/kg next to the revenue, on the same `weighLines()` Stats uses.
**Register is built:** one `invoiceDetailHtml()` draws the desktop pane and the phone sheet (the sheet used to draw
the status timeline twice); the phone list is grouped by day with each day's taxable; the desktop table drops columns
in priority by container query and the pane opens on demand, which fixes the survey's squeezed list (40% of the screen,
Total cut off, client names over three lines — P54 measures it at 1024 and 1280). States read through
`invStateTone()` in `state.js` (below).

**An invoice's state is Created → Printed → Dispatched → Delivered → Filed, and its dot is coloured by how long it has
sat there** (owner, 29 Sep 2026: *"an intermediate state between Created and Dispatched that will be printed, which
changes severity colour for how long it has been on the same state, do the same for every state till they reach the
final state of Filed"*). **Printed** is set by Print on the invoice's preview (`printMarkPrinted`; only from Created — the
print dialog cannot say whether paper came out), or by hand; `printedAt` stamps it, like every state
(`invSetState`, `INV_STATE_AT`). Created may still be dispatched straight away (printed outside the app), from the detail
or the bulk bar, which now also offers *Printed (n)*. **The tone** (`invStateTone`): Created, Printed and Dispatched turn
amber, then red, at the days in Settings → Checks & alerts → Invoice states (1/2, 1/2, 3/7), counted from the state's own
stamp, else the one before it, else the invoice date. **Delivered waits on the return, not a clock**: GSTR-1 for the
invoice's month is due on the 11th of the next, so it is amber 3 days before and red once past; a delivered invoice from
the 2nd of the month is not late at day 20. Filed is ok, cancelled danger. The row's dot carries the age in its title,
the detail's timeline says it (*Printed · 3 days*, *Delivered · GSTR-1 due 11 Oct 2026*), and History logs *printed*.
**A state shows the moment it changes** (owner, 29 Sep 2026: *"the invoice state change to printed should be immediately once the invoice is
printed and when I mark it dispatched the state should change immediately"*): `invStateShown` redraws the page in place and an open
sheet on its new step, after Print and after a Mark, wherever the invoice was opened (Home, a client, the To-do). A Mark button
drawn before a print names a step reached and never skips past it. **Not printed** on a Printed invoice puts back a print that
never came out (`invNotPrinted`), stamp and all. P104.
Stats' state tiles keep one tone per state (`INV_STATE_TONE`), since they count many invoices. A number is spent from
Dispatched on, not from Printed. P94.
**The register sorts by invoice number too** (owner, 26 Sep 2026): the desktop's Invoice column head, and the phone's sort in
Filter (*Highest number first*, *Lowest number first*; two buttons until the tab map, TM5c), where a number sort is grouped by
series rather than by day. The order is the series prefix, so
25-26 comes before 26-27, then the number read as a number, so `100` follows `00099` however it was padded (P70).
**IM is built:** the worklist leads with *Awaiting invoice*, then *Invoiced*, each grouped by challan date; a challan
expands to its lines (`inv-row-expander`). The desktop table and pane are the Register's, with the focus helpers shared
(`_mdFocusKey` / `_mdRestoreFocus`). **Add challan is the page's one primary, in the toolbar** — the floating + and camera
buttons are gone. The survey's last IM bug is closed: the filter `<select>`s carried `data-action="invFilterIM"`, so the
click that opened one ran the filter; they speak through `change` only now (P55 asserts no select carries an action).
The challan add/edit form moved with Create.
**Create is built:** the invoice and challan forms share one line editor (`inv-lines` / `inv-line`, a grid of fields on the
phone and a row under a column head on the desktop), verdicts are a dot and a word (`inv-verdict`, `data-verdict` on the
Rate field), suggestion lists are `inv-menu` in an `inv-combo` (the cursor is `aria-selected`), optional details fold,
and Create invoice sits in the sticky action bar. A chosen client's **unbilled challans are tick boxes** that bring their
lines in; only the challan lines the invoice still carries are marked invoiced on save (P67).
**Clients / Items / Performance is built:** view tabs, one Add per view in its toolbar (the floating + that doubled it on
the phone is gone — the survey's doubled Add buttons), rows on the phone, and on the desktop the Register's table and
on-demand pane (the resizable split, its drag handle and `_dragState` are deleted). The items sort `<select>` lost its
`data-action` and speaks through `change`; a client's cards are flush panels of rows; Performance's measure is `inv-seg` (P68).
**Staff is built:** six view tabs that scroll the open one into view (the survey's cut-off sub-tabs), Paste message the one
primary on Overview and Day and a sub-view with its way back; Day's P / H / A an `inv-seg` pressed in its tone, in dark as in
light; Week an `inv-table-grid`; the labour, extra, payout and due cards flush panels of tiles and rows (`data-card`); the
attendance paste on the stock check's pieces. The `inv-att-`, `inv-lab-`, `inv-area-`, `inv-rl-` and last `inv-stk-` families are
deleted (P72); the two tone classes Stats' tiles borrowed went with Stats.
**Stats is built:** five view tabs and the period an `inv-seg`; every card a flush panel named by `data-card` (tiles, rows,
callouts, `inv-table`s), the live cost's components rows that fold open (`inv-row-fold`), the drill-down tiles and rows; the
`inv-stats-*`, `inv-kpi*`, `inv-ov-*`, `inv-cost-*` families are deleted, and "below cost" is still judged at the live cost (P73).
**History is built:** a toolbar (search, client, labelled dates) and the kind of event as pressed chips, which closes the survey's
filter bar (chips stretched to the filters' height and clipped off the phone); rows grouped by day ending in a dot and a word, a table
on the desktop; a void is a plain row, and the exception ledger's row now says `recorded`. The `inv-history-*` family is deleted (P74).
**To-do is built:** Open / Done are view tabs (the Done fold's `invTodoFoldDone` action carries `data-v`), the add field
sits in a toolbar with Add as the one primary, *From your data* and *Mine* are flush panels of rows (two across on the
desktop), a task of your own is ticked through a real tick box, and status is a dot and a word (an app task is led by
`inv-dot-mark`). Its `inv-td-*` family is deleted; the Home card draws the same rows (P69).
**Stock is built:** Paste message is the page's one primary; the Lines tiles filter (`aria-pressed`); lines are rows
grouped by status on the phone and one table beside a detail pane on the desktop; a line's page is tiles, *Price and
pattern* rows with the bill form in place, its settings and its entries; the paste check is rows with the text as sent
(`inv-quote`) and Save in the action bar; the reorder list is a table by supplier; More is an `inv-sheet` of rows (P71).

**Settings is built:** each section an `inv-panel-fold` of `inv-field`s, the desktop group list `inv-side-item`s in an
`inv-dialog-wide`, an unsaved edit `data-dirty` and a dot and a word; the `inv-set-*` family is deleted, and the phone's
head stays put while the groups scroll (it used to scroll away with the close button). P75.

**Step 4, the clean-up, is done (26 Sep 2026): the stylesheet carries no v1.0 class and no alias token.** `styles.css` went
from 1,870 lines to 1,553. What it took, so nobody reintroduces it:
- **Every dialog is one shell** (§6.16): `dialogOpen(html, {dismiss, replace})` and `dialogHeadHtml(title, …)` in `state.js`
  draw an `inv-dialog` in an `inv-scrim-dialog` (a sheet on the phone, centred on the desktop) with a sticky
  `inv-dialog-foot`; twenty hand-built copies of the scrim, head and focus plumbing are gone, and with them three bugs —
  *Explain this exception* never pushed focus or locked the page, the To-do dialogs left the page scrolling behind them,
  and closing the last dialog by its scrim never ran a layout switch deferred while it was open. The More sheet is an
  `inv-scrim` but not a dialog, so closing dialogs never takes it along.
- **The desktop list and pane** are `inv-pane-host` / `inv-pane-list` / `inv-pane` with one `paneHeadHtml()` (four screens had
  their own copy). The page holding a host is a flex column of `--fill-h` and the host takes what is left
  (`flex: 1 1 0`, never below `--pane-host-min`), so the page never scrolls; a host hidden under a form (IM's challan
  form) leaves the page a plain document (P80).
- **The credit note, number audit and invoice delete/cancel dialogs** moved onto fields, rows, callouts and dots; cancel is a
  danger button now, and every dialog title is sentence case.
- **No v1.0 token is left**: the `--fs-xs…3xl`, `--shadow-sm/md/lg`, `--anim-*`, domain colours, `--header-h`, `--tab-h` and
  `--card-padding` aliases are gone and every rule reads the v2.0 name. Raw values outside the §3.9 exceptions are tokens,
  hairlines included (`--hair`, `--rule`); a container query's width is the one thing written out, because a query's
  condition cannot read a custom property.
- **A `<select>` never carries `data-action`**, the line editor's unit included (it now answers to `data-change`), and a
  toolbar's filter or sort `<select>` is as wide as its choices on the desktop, not the row.
- **P76 sweeps the whole app** — every page, every view tab and every dialog, phone and desktop, light and dark — for a
  retired class, an unstyled class, a select with an action, a duplicate id, a blank page, a second primary, a dialog foot
  that is not last, and a page wider than the screen; and reads every template for a select with an action.

**A polish pass followed (27 Sep 2026)**: every page, view tab and dialog shot at 393px and 1280px in both themes, on the
sweep book and on one with a ₹12,34,56,789.00 invoice and an 80-character client name, and looked at. What it fixed, all on
the §6 components: `--ctl-h-sm` is 44px while the density is comfortable (§3.5 promised it; small buttons, segmented
controls and small selects were 36px on the phone), a row's tick box reaches the row's edges, a folded panel's head and a
head's link are touch targets; padded panels and `inv-panel-body` use `--pad-x`, so their text starts where a flush panel's
does; a small link lost the side padding that set it 12px in from the figures (Money → GST's status column, every
*Open …* link); a crore in a tile wraps instead of being cut, and the action bar's total takes the row rather than spilling;
the invoice detail's line amount is money (it printed `13000.00`); prose qualifiers and the chart readout are no longer mono;
the forecast is a flush panel; a head's count sits in its title; the number audit's and unplaced receipts' rows let their
end drop under the number on a phone. P76 now also fails on anything past the screen's right edge outside a scroller, a
touch target under 44px in the bars, tabs, toolbars, segmented controls, heads and dialog feet on the phone, and a tile or
action-bar figure cut by its box, and walks the crore book. Left for the owner: clipped client names and dates in row meta
lines (they need a `title` or a reordered meta, per screen), chart legend rows (24px tall), the forecast's x labels cut at
the drawing's edge, and the crore-scale axis labels (`₹1200.0L`).

**The open items were done next (27 Sep 2026)**, each on the components and the sweep:
- **A row's meta line takes two lines on the phone** (line-clamp 2; the title keeps one), and a date leads a long name where
  the name hid it (Home's recent invoices, the credit-note list). **What an ellipsis still cuts carries its full text in a
  `title`**: `uiOverflowCues()` (`state.js`, started in `bootApp`) runs after every render, reads from the stylesheet which
  selectors ellipsise, and titles only what is actually cut. A credit note's buttons are `inv-row-actions`, a line of their
  own under the row on the phone; Receivables' figures meta wraps whole.
- **Tapped legend rows are 44px on the phone** (`--ctl-h-sm`; 26px on the compact desktop).
- **An x-axis label is anchored inward at the drawing's edge** (`_chartXLabel`, every line and bar chart: "26 No" was cut).
- **Chart money is `formatInrShort()`**: ₹950, ₹12.5K, ₹8.4L, ₹12.0Cr (was `₹1200.0L`, and `₹15K` is now `₹15.0K`); readouts,
  titles, tables and tiles stay exact.
- **A tile's figure breaks only after a comma group** (`figWrapHtml()`): ₹10,46,48, / 655.51, never "655." / "51".
- **Register and History's From / To are as wide as their control on the desktop.**
- **A table that scrolls sideways fades on the side with more and says "Scroll for more →"** (`inv-scroll-x`, `data-more`).
- The vehicle chip's "last" is prose; the Register pane and sheet name the invoice once, in the head.

**The last phone controls under 44px were then raised (27 Sep 2026)**: a row's main button reaches the row's edges over
its padding and is never under `--touch` on the phone (Home's tasks, IM's challans, Items, Receivables, the bank ledger were
43px, a one-line row 31px), and a search field's input fills its box to the border (every search was a 16px line in a 44px
box). The screenshot audit's list went from 18 to 0 in both themes with no visible change; P76's phone target check now reads
`button.inv-row-main` and `.inv-search input` too.

P76's sweep now also fails on a figure broken inside a group (`brokenFigures`), a phone meta line cut past its two lines on
the sweep book (`cutMeta`), anything an ellipsis cuts without a `title` (`untitled`), and a tapped legend row under 44px; and
the crore book asserts Home's revenue breaks after a comma and its recent invoices lead with the date.
