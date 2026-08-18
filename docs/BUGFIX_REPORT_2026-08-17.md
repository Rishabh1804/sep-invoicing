# Bug sweep — 17 August 2026

Two reported defects, plus a review of the app around them. Eight findings, all fixed;
four regression specs added (`p23-bugfix.spec.ts`) alongside targeted specs in `p18`–`p22`.

**Read this first:** three of the eight are mine, introduced in the eight-item PR merged
earlier the same day (`ceb5129`). They are marked as such. One finding I initially judged
serious turned out to be already guarded — that correction is written up in full at
[§9](#9-a-correction-to-my-own-finding), because the reasoning matters more than the
non-result.

---

## Summary

| # | Finding | Severity | Origin |
|---|---|---|---|
| 1 | Register filter dropdowns closed the instant they were opened | **High** — feature unusable | Mine, `ceb5129` |
| 2 | Credit note series restarted at 001 over numbers already issued by hand | **High** — duplicate document numbers | Mine, `ceb5129` |
| 3 | Credit note form tore out the date picker mid-choice | Medium | Mine, `ceb5129` |
| 4 | Charts closed over empty periods, hiding the silence they exist to show | **High** — wrong conclusion from a correct chart | Pre-existing, amplified |
| 5 | Register search kept a selection it had hidden | Medium | Pre-existing |
| 6 | Incoming-material selection survived the filter that hid it | Medium | Pre-existing |
| 7 | Credit note CSV named for the register's filter, not its own contents | Low | Mine, `ceb5129` |
| 8 | Two cosmetic/hygiene defects | Low | Mixed |

---

## 1. Register filter dropdowns closed on click

**Reported by the owner.** The client dropdown in the Register would not stay open long
enough to pick anything.

The five filter controls carried `data-action="invFilterRegister"`. A `<select>` is not a
button: the click that *opens* it is not a choice, but it still reached the click delegate,
which called `captureRegFilters()` — and that rebuilds the toolbar. The `<select>` the
native popup was hanging off was replaced mid-interaction, so the list shut.

It worked before the eight-item PR because the old handler only re-rendered the *list*
(`_renderRegView()`), leaving the toolbar's DOM alone. Centralising the filter logic —
itself a good change — made the click path destructive.

**Fix.** The controls no longer carry a `data-action` at all. They speak through `change`,
which is the only event that represents a choice. The now-dead click case is removed. The
toolbar still has to rebuild on a real change (the clear-range button, the scope note and
the select-all count all depend on the filters), so focus is captured and restored across
it.

**Pinned by** `p18: clicking a filter control does not rebuild it out from under the
pointer`, which marks the live elements and asserts they survive a click — and
`p18: choosing a client still filters`, so the fix cannot be "remove the handler".

**Checked for siblings.** `_renderIMView()` and `_renderItemsList()` write to their list
containers, not their toolbars, so the IM and Items Master selects were never affected.
One genuine sibling was found in my own code — finding 3.

---

## 2. Credit note series restarted at 001

**Reported by the owner.** CN/001–005 of 2026-27 were issued by hand before the app
existed; the attached reference is CN/005. The app started its own series at 001, so the
first note it issued would have carried a number the customer already holds on a different
document.

This is the same class of error the invoice number ledger exists to prevent, and I built
the credit note feature without asking where the series already stood.

**Fix.** Three parts:

- `getDefaultState()` starts the series at **6**.
- A one-time migration (`_cnSeriesStart1`) lifts an existing install to 6 — but only while
  the app has issued none of its own, so it can never walk over a real number.
- **Settings → Credit Note Series** exposes the next number, mirroring the invoice series.
  It refuses a value at or below one already issued from the app, because a number the
  customer holds may not be handed out twice.

**Pinned by** three specs in `p19`: that the first note is CN/006, that the migration sets
the start on a fresh device, and that it leaves a device already at 009 alone.

---

## 3. Credit note form tore out the date picker

The same defect as finding 1, in code I wrote in the same PR. Every input in the credit
note form triggered a full form re-render so the totals could restate live. But only the
discount percentage moves the totals — the date and the vehicle number do not, and
re-rendering for them replaced the control being used. On `<input type="date">` that means
pulling the native picker out from under the pointer.

**Fix.** The handler captures every field as before, but re-renders only for `cnPct`.

**Pinned by** `p19: typing in the form does not tear out the control being used`, which
marks the elements and asserts they survive, and that the typed values still reach the
saved note.

---

## 4. Charts closed over empty periods

The most consequential finding, and the one least likely to be noticed, because the chart
looked correct.

`buildTrendSeries()` and `cpMonthly()` bucketed by period key and then emitted
`Object.keys(by).sort()` — **only the periods that had data**. A client who billed in
January, stopped for three months and returned in May rendered as two adjacent bars,
reading as continuous work.

For the Stats trend that is misleading. For the new **Client Performance** view it is
self-defeating: that view exists to surface an account going quiet, and its own chart was
deleting the quiet.

**Fix.** A shared `periodKeysBetween(minIso, maxIso, gran)` walks days from the first
record to the last and buckets each, yielding every period in the range including the
empty ones, which render as explicit zeros. Walking days is the one loop that works for
all three granularities — incrementing an ISO week key by hand does not. It carries a
4,000-iteration guard so a corrupt date cannot spin it.

**Pinned by** `p21: a period with no work is a zero, not a gap the chart closes over`
(asserting `[5000, 0, 0, 0, 4000]` across a January-to-May hole) and `p22: a quiet month is
kept — the silence is the finding`.

This changed a point count an older spec had hardcoded. That spec's intent — every marker
carries its value, not just the endpoints — still held, so it now asserts against the
series length rather than a literal.

---

## 5. Register search kept a hidden selection

The eight-item PR fixed "a selection survived a filter change" for the client, month,
state and date-range controls. It missed the search box, which binds its own `input`
listener and never went through `captureRegFilters()`.

So: select all in a search result, narrow the search, and the earlier rows stayed ticked
but off screen — and every bulk action (dispatch, file, quality certificates, credit
notes) still reached them.

**Fix.** The search handler clears the selection and refreshes the selection bar, like
every other filter.

**Pinned by** `p23: the register search drops its selection too`.

---

## 6. Incoming-material selection survived its filter

The same shape, in the IM tab, pre-existing. Changing the client or status filter left
`_imSelected` populated with rows that were no longer on screen.

**Fix.** `captureIMFilters()` — mirroring `captureRegFilters()` — reads both filters,
clears the selection and re-renders. Both event paths now call it, removing a block that
had been copied into each.

**Pinned by** `p23: changing the material filter drops the selection it hides`.

---

## 7. Credit note CSV named for the wrong thing

`exportCreditNotesCSV()` borrowed `exportScopeLabel()`, which reads the *register's*
filters. The export contains every credit note regardless, so a complete file came out
stamped with whatever month the register happened to be showing —
`SEP-Credit-Notes_2026-08.csv` for a file containing notes from three months.

**Fix.** Named from the notes' own date range, taken from the dates themselves rather than
from the ends of a list ordered by number: the two orderings usually agree, but a
back-dated note would misname the file with no way of noticing.

**Pinned by** `p19: the export is named for the notes it holds, not the register filter`.

---

## 8. Two smaller ones

**Pie legend rows offered a pointer they could not honour.** Every legend row had
`cursor: pointer`, but the folded "N others" wedge has no single client behind it and no
drill-through. Now only rows carrying a `data-action` look tappable.

**`saveItem()` saved twice on the ordinary add path**, firing the GitHub auto-push debounce
twice for one edit. The early save is now scoped to the inline-add branch that needs it.

A dead `data-action` on the client-performance select was also removed — there was no case
for it in the delegate, so it implied wiring that did not exist.

---

## 9. A correction to my own finding

I reported to the owner, mid-sweep, that `createInvoiceFromIM()` had a serious reachable
defect: it assigns `clientId = im.clientId` **inside** its collect loop, so the last
matching challan wins. A selection spanning two customers would therefore build one invoice
carrying both clients' material, billed to one of them and priced off that one's rate card.
I said it was reachable with no filter involved, since the IM list defaults to All Clients.

**That was wrong, and I checked only after saying it.** The selection bar already computes
`multiClient` and renders the Create Invoice button `disabled` with an explanatory title.
There is exactly one render path and one call site, so the cross-client invoice could not
be created through the UI. No such invoice can exist in the data.

What remains true is narrower: the invariant lived only in a `disabled` attribute, which is
an affordance rather than a rule. `createInvoiceFromIM()` now refuses a mixed selection
itself and names both customers. That is hardening, not a bug fixed, and the spec asserts
both layers — the button is disabled *and* the function refuses when called directly.

Recording this because the failure mode is worth more than the finding: I reported severity
before verifying reachability, and a report that overstates one item devalues the other
seven.

---

## Verified and left alone

Things that looked wrong and were not, checked rather than assumed:

- **`recomputeNextCnNumber()` mutates state from inside a render.** A render should be
  pure, and making it a pure read looked like an easy fix. It would have been a bug: the
  button would promise CN/006 while the save path issued CN/009 on a state whose counter had
  fallen behind. Recomputing in the render is what keeps the promise on the button equal to
  the number that gets issued. Left as is.
- **`Math.floor` outside `numberToWords()`** — every occurrence is on time, age or a median
  index, never on money. HR-8 holds.
- **Duplicate `clientsDesktopToggle` id** — emitted from two mutually exclusive branches,
  never both in the DOM.
- **`invoices[0]` / `clients[0]` / `points[0]` dereferences in the new modules** — each sits
  behind a length guard.
- **Hard rules** — no inline styles, no inline `onclick`, no emoji, no unescaped state in
  `innerHTML` across the new modules.

---

## Still open

Neither is a defect; both are decisions the owner holds.

1. **Credit notes are not netted off realisation.** Stats reads invoices only, so SSS Mehta
   shows ₹5.40/kg where the standing 2% discount makes the real figure ₹5.29. The
   contribution arithmetic in `CLAUDE.md` is deliberately left un-restated rather than
   half-corrected.
2. **The four 15 Apr quality certificates** carry the superseded GSTIN. Whether they need
   reissuing to SSS Mehta is a customer call, not a code one.

---

## Addendum — 18 August 2026

Item 1 above is closed. Credit notes now net off every money figure in Stats and Client
Performance, allocated back to the invoices each note credits rather than booked on the note's
own date, and never taken off tonnage. `CLAUDE.md`'s Key Business Data is restated on that
basis: SSS Mehta at ₹5.29/kg, blended realisation ₹8.38, contribution −₹0.17/kg. Pinned by
nine specs in `p24-credit-note-netting.spec.ts`; seven of them fail against the code as it
stood when this report was written, and the two that pass are the controls.

One thing the netting does not fix, because it is data rather than code: CN/001–005 were
raised by hand before the app existed, so the live figures stay gross until those five notes
are entered. The size of that gap is recorded in `CLAUDE.md` as a check on both numbers.

Item 2 remains the owner's call.
