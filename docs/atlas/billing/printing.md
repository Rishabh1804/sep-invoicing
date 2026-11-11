---
subject: "Printing: the preview, the long tax invoice, its type"
domain: billing
modules: [split/print.js]
specs: []
tests: [P94]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### The print preview is the page
The preview drew the tax invoice in the phone's column (`--max-w`, 520px) against a layout that needs the page's 186mm:
on a phone the totals, the challan date and the copy label were cut off, and on the desktop the grid ran past the
sheet's border, while the printout itself was right (owner, 29 Sep 2026, Android and the Edge app). The invoice is now
laid out on screen as it is on paper, **210mm across with its gutters as padding** (`--pi-sheet-w`, `--pi-sheet-h`), and
**every document in the preview is zoomed to fit the screen as a whole** (`printFit()`, print.js, on open and on resize;
`zoom` on `.inv-print-body > *`, never above life size), the credit note, certificate and sales register included (they
were A4 already and ran off a phone's edge). In print the zoom is 1 and the sheet's screen width, height and margin are
reset, so the printed page is unchanged. P94.

### A tax invoice that runs past one page
The printed invoice is three copies, each `page-break-after: always`. An invoice with enough line
items runs the middle of that flow past a sheet, and four things were wrong when it did.

🔴 **Margins on the page were tried and WITHDRAWN — `@page` margin stays 0, and the reason is
load-bearing.** The gutters are `padding` on `.inv-print-invoice`, which is applied once to the whole
flow: page one gets a top margin, the last page a bottom one, and **every continuation page begins
hard against the paper edge.** That is a real defect and a named `@page invoice { margin: … }` does
fix it — measured, 12 pages at 10mm against 15 at 45mm on a 120-line invoice, correctly scoped away
from the certificate and the credit note.

**It cost far more than it bought, and the cost only shows in production.** A margin box is the one
place a browser can draw *its own* header and footer, and Chrome omits them when there is no room —
`@page { margin: 0 }` app-wide is what has always bought that silence. Handing it 10mm handed it the
room: invoice **00866** came back from the floor with every sheet stamped `9/1/26, 2:47 PM` and the
document title, **and a trailing blank seventh page** on three two-page copies. Chrome 151, Skia/PDF,
the ordinary Save-as-PDF path.

⭐⭐ **The lesson is about the instrument, again.** `page.pdf()` over CDP never draws browser
headers and never reproduced the blank page across 16–34 line items on Chromium 141 — so the whole
change was measured, tested and merged by a harness that is structurally blind to the defect it
introduced. **The evidence that settled it was not a reproduction at all: the operator had neither
symptom before the change and both after, on an unchanged browser and dialog.** A print bug lives in
the print dialog, and nothing that bypasses the dialog can see it.

**The continuation-page gutter is CLOSED (27 Sep 2026), in flow, with no page margin.** Each copy is one
**frame table** (`.inv-pi-frame`, `_invoiceFrameHtml` in print.js): the whole copy is its one body cell, its
`<thead>` row carries the invoice number and the copy label, and its `<tfoot>` row is empty. Both repeat on
every printed page, and in print the header's top padding and the footer's height ARE the top and bottom
gutters (`--pi-gutter-top` 10mm, `--pi-gutter-bottom` 8mm; the sides stay padding, `--pi-gutter-side` 12mm).
The trap named here before is avoided by construction: the frame spans every page the copy does, so a tail
that lands alone on a page gets the band and the label too. Measured on A4 through `page.pdf()`, the old
build against the new at 2, 22, 23, 30, 40 and 120 lines: **the same page count at every length**
(3 · 3 · 3 · 6 · 6 · 9), a continuation page's first ink at **10mm from the top where it was 0–1mm**, and
its last at 10–11mm from the bottom where it was 3–6mm. The line items' column headings still repeat inside
the frame (the nested `<thead>`). ⚠ **The same instrument caveat as above holds**: `page.pdf()` cannot show
the print dialog, so the owner's first long print from the dialog is the check that counts. What changed is
safe on the axis that burned us: no `@page` margin was added, so the browser still has no room to stamp its
header, and a spec still asserts every `@page` margin is 0.

**A running header must reserve its own room.** The quality declaration was `position: fixed` at the
bottom of every sheet. Fixed takes an element out of flow *without* reserving the band it occupies,
so on a long invoice the line items printed straight through it. It flows at the end now — one
declaration per copy, where the rest of the tail is.

**The letterhead and the tail are each one box.** The head blocks chain `border-top: none` onto each
other to draw a single frame, so a break inside it opens the frame and page two reads as a second,
headless invoice. The tail was four siblings of which two avoided breaking *individually* — which
left the page free to break between the totals and the signature attesting them. Both are wrapped
and kept whole; the inner `avoid`s stay as the fallback for a tail that ever outgrows a page,
because a browser drops an `avoid` it cannot honour.

**A continuation page has to say which invoice it is — once.** The letterhead is on page one only. The
label went first into a caption row in the line items' `<thead>`, the one box every browser repeats — and so
printed twice on page one, under the top-right label (owner, 27 Sep 2026: *"Original for recipient is
mentioned twice in the page"*). The frame's header row replaces both: `Invoice <number>` on the left, the copy
on the right, at the top of every page, page one included. Rows also stop being sliced through the middle.

**The three copies are CGST rule 48's** (`INVOICE_COPIES`): *Original for recipient*, *Duplicate for
transporter*, *Triplicate for supplier*. The third read *Duplicate for transporter* until 27 Sep 2026; the shop
keeps it, so it is the supplier's (owner).

### The invoice's type is its own
The invoice was the last printed document borrowing the app's UI `--fs-*` rem tokens — **24
declarations**, on the instrument that counts a rule's whole body rather than only its first line. The certificate and the credit note have always declared their own point scales, and the
coupling ran both ways and was wrong both ways: the invoice's type could not be set without moving
the whole interface, and the interface could not be scaled without silently resizing a GST document.
`--pi-fs-*` on `.inv-print-invoice` closes it. The mapping was exact — 6.75pt *is* 0.5625rem at a
16px root — so introducing the scale changed nothing, which is what made it safe to do in the same
change as the sizes below. **The test that matters is the independence one:** tripling the root font
size must not move the invoice by a pixel, and it asserts the app itself did move, so it cannot pass
against a stylesheet that has stopped working.

⚠ **Both the count and that test were wrong first time round, in the same way, and the way is the
lesson.** The repointing pass rewrote only declarations sitting on the *same line as their selector*,
so `.inv-pi-copy-label` and `.inv-pi-declaration` — multi-line rules, both printed on the sheet —
kept the app's tokens. The verifying grep had the identical blind spot, so it reported zero
remaining and the count came out at 21. And the independence test **sampled four hand-picked
selectors**, neither of them among them, so it passed against the defect. ⭐⭐ **A claim about a
document needs a sweep over the document**: the test now walks every element under
`.inv-print-invoice` and asserts none of their computed sizes move, and it fails against the
pre-fix stylesheet where the four-selector version passed. *An instrument that cannot see the
failure is not a check, and using the same flawed instrument to verify a fix it made is how one
error becomes two.*

**The reference numbers were 6.75pt monospaced.** Operator feedback named them — invoice number,
challan number, dates — and the pairing is the worst available for digits: small *and* mono, on
exactly the fields a recipient hunts for. They are 9pt semi-bold in the normal face now, as is the
Bill To / Ship To customer name (was 7.5pt). Mono buys column alignment, which a labelled grid does
not need. **The labels were raised too, but only to 7.5pt from 6.75** — at 9pt across the eight-cell
row there is no horizontal slack left and the invoice number broke mid-token (`SEP/2026-` /
`27/00812`), so the labels hold the smaller size. *(An earlier version of this section said "only the
values were raised, not their labels" — the labels did move, by 0.75pt.)*

🔴 **`nowrap` on EVERY value then overflowed the sheet, and the mechanism is worth keeping.** A
table's minimum width is the sum of its cells' minimum widths, and `nowrap` makes a cell's minimum
its whole content. At 9pt the eight-cell row's minimum exceeded the page — and **a table that cannot
shrink does not wrap, it overflows**. Invoice **00866** cited four challan numbers (`612, 613, 617,
614`) and the grid ran clean off the paper: measured **752px of content into 703px of page**, a right
margin of **−0.2mm**, every cell simultaneously at its 4.5pt padding minimum. Eight challans is 805px.

**The split is by what the text IS, not by how long it happens to be.** The challan number and the
P.O. number are lists or free text and carry `.inv-pi-val-wrap`; a break between `834,` and `835,`
reads correctly. **The labels wrap too** — they are English phrases, and "Your Challan. No." over two
lines is ordinary on a form. Only the invoice number and the dates stay atomic, because a date broken
across two lines does not read as a date.

⚠ **Letting the values wrap was NOT enough, and CI is what said so.** It left **6px of headroom under
Inter** — and the runner, which has no webfonts and a different fallback face, measured 729px against
the same 703px page. Same stylesheet, two different rulers. Forced into a deliberately wide face the
pre-fix row wants **786px**: an overflow of 83px that no amount of value-wrapping absorbs, because the
labels were holding the row open. **And the fallback is a real print path, not a test artifact** —
`sw.js` deliberately lets the cross-origin font CSS fail rather than block the install, so an offline
device prints in whatever face it has. With the labels free to wrap the row fits under both faces at
any challan count.

⭐⭐ **A layout assertion measured in whatever font the machine happens to have is not a measurement,
it is a coincidence.** The spec now pins the face itself — it asserts the fit once as shipped and
again under a forced wide stack — so it means the same thing on a laptop, on CI, and on the shop's
Windows box. Each half of the fix is load-bearing and the test catches each alone: 774px with the
labels held, 713px with the values held.

⚠ **The test had to move to a sheet-width viewport to see it at all.** The suite's phone project is
393px wide, where the grid never comes near its limit, so an overflow that only exists at 186mm was
invisible to every check in the file. It sets a 794px viewport and measures the **sum of a row's cell
content widths** against the sheet's printable width — `width: 100%` hides the overflow in the
element box, so the box's own width can never report it. **Cost: one line item per
page** — 23 fitted before, 22 after, measured rather than estimated.

### The sidebar offset reached the paper
`body.inv-desktop { margin-left: 64px }` shifts the interface clear of the desktop sidenav, and the
print block reset it — at identical specificity, 1,300 lines earlier in the sheet. Source order won,
so **every document printed from the desktop layout came out displaced 64px right**: 29mm of left
margin against 12mm of right, and 240px with the sidebar expanded. It reached the certificate and
the credit note too, not just the invoice. One more element selector settles it; `!important` was
not needed.

**And the same rule carries a 300ms `margin-left` transition, so a print taken mid-animation lands
part-shifted** — measured at 64px immediately after switching to print media and 0px after 600ms.
Motion is stopped outright in print rather than raced. Note where that assertion has to live: the
transition is declared on `body.inv-desktop`, so on a phone viewport there is nothing to animate and
the check cannot fail. It sits in the desktop project. A test that cannot fail is not a test.
