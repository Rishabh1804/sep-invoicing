---
subject: "UI pass 3: the look (U1)"
domain: design
modules: [split/dataview.js]
specs: [docs/UI_PASS_3.md]
tests: [P53, P180, P182, P197, P226, P227, P228]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### UI pass 3: the look (U1)
`docs/UI_PASS_3.md` §3–§6 (owner, 16 Oct 2026: *"B with wells"*). P226, P228 (the look, the icons, paper); P180, P182, P53 and P197
rewritten to the new facts, never weakened.
- **A card lifts, a well sinks, a layer floats** (DR-6 amended). A panel, a hero, a deck card and the phone's bar lift (`--lift-1/2`:
  two outer shadows; `--r-card`, 18px; a fine `--edge`). What is pressed or filled sits in a well: a field, a search, a segmented
  track, a tick box, a switch, a meter's track, a tile in a card (`--well`, `--press-1/2`, inset only; `--r-tile`, `--r-ctl`). A
  dialog and a menu float (`--shadow-dialog`).
- **The well is a veil** (`--well`: `rgb(20 25 30 / 0.05)` light, `rgb(0 0 0 / 0.22)` dark), laid over whatever it sits in, so a well
  on a coded card is a well of its tone. Every text tier reads at 4.5:1 in a well, on the card and on the page; light text-3 was
  darkened a step for it.
- **Zinc & brass is the default palette.** A device on Teal because Teal was the default moves to Zinc; a palette chosen stays. The
  page is a step under the card (0.92 against 0.96, OKLab L), so a card lifts off it.
- **In dark, a layer steps up**: a dialog and a menu remap `--surface` to `--c-surface-2`, so a layer reads above the page.
- **The segmented control's pill** is the card's surface clipped inside its segment (`background-clip: padding-box`, the inset a
  transparent border), its lift on `::after`, so every segment stays a 44px target.
- **The one primary** runs from the accent to `--accent-deep` and lifts further. A ghost and a link cast nothing.
- **New components**: the switch (`inv-switch`, design §6.31) and the blank state (`uiBlankHtml`, `inv-blank`, §6.32).
- **The toast is a pill on one line** (`--r-toast`, half a line's height) and as wide as its words up to the room: drawn `--r-full`
  at first, a toast that wrapped (it wrapped at half the phone, being placed at `left: 50%`) put its first and last words outside
  its dark fill, light on the light page. P228 checks every line of a wrapped toast sits inside its fill.
- **The closed list of box looks** (P197's `LOOKS`) was regenerated for the pass: 35 looks. `LOOKS_DUMP=1` writes each layout's
  census with what wears each look.
- **Paper reads no palette.** P228 records every printed document's computed styles as it was before the pass and fails on any
  difference. It also draws each document on every palette: the sales register's frame had read `--border`, and is `--sr-frame` now.
- **Charts v3** (design §6.17): eight new builders on one set of marks, a colour by the thing's slot (`seriesSlot`), never its
  rank, and a table behind every boxed chart; the `--chart-*` tokens are retired (the frame is `--plot-*`). P227.
- **Icons v3** (design §5.6) and **the data layer** (`split/dataview.js`, §6: a view per typed table of the hub, its key the record
  it comes from) are U1's too. Building the data layer found a Stats bug: a credit note had taken kilos off a piece line weighed by
  its amount. Stats now weighs the amount as billed (`_gross`): a note takes rupees off, never kilos.
