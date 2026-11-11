---
subject: "Stats: what the charts show and what Stats measures"
domain: insight
modules: [split/charts.js]
specs: []
tests: []
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### What the charts show
The trend was one line drawn with `preserveAspectRatio="none"` — a 400×160 drawing smeared across
whatever width it got, markers rendered as ellipses, and only the two endpoints labelled. `charts.js`
draws at natural aspect and is sized by CSS, so one code path serves a 393px phone and a 1280px
desktop, and every datum carries a `<title>` with its exact figure.

**Three series, because they answer different questions.** Revenue answers "did we bill more";
tonnage answers "did we plate more"; **incoming material leads both** — it is dated by challan, not
by invoice, so a dip there surfaces in revenue only weeks later. Line or bar for any of them.

**Composition gets a share shape** as well as a ranked one. Past the eighth client the tail folds
into one named wedge rather than slivers nobody can aim at — the fold is labelled so the tail is
visibly a tail.

**Top Items ranks by value, tonnage or ₹/kg, and those are three different top-tens.** Ranking by
money alone is the ranking this repo's own thesis calls insufficient: the parts filling the plant
are not the parts paying for it. The weight rankings admit only parts whose weight is known and
**say how many they dropped** — those are the piece-billed end, so a ranking that hides them reads
better than the truth.

On the ₹/kg view the bar is measured against full cost with a mark at the cost line, because from a
zero baseline a ₹6–₹15 range is a row of near-identical bars. Green clears cost, red does not:
the app's accent is itself a terracotta, so accent-against-danger was a distinction nobody could see.

### What Stats measures
Revenue alone cannot tell a good month from a loss-making one here: the same ₹1L of billing
is healthy at 8 tonnes and ruinous at 20. So every headline figure is carried next to the
tonnage that produced it, and **realisation (₹/kg) is the primary number**, not a derived one.

Tonnage comes from KG lines directly, and from NOS lines by three routes in order:
`partWeights`, the Items Master `stdWeightKg`, and — for a **piece-billed** client — the line's
own `amount ÷ ratePerKg`. That last route matters more than it sounds: 127 of SSSMehta's lines
name parts with no Items Master row at all, 17% of that client's revenue, and routing weight
through the registry left every one uncounted. Their part numbers also vary in spelling between
invoices (`Clamp 165x83` against `CLAMP 165X83(40X6)`), so registry matching would stay fragile
even if the rows existed. Reading the line direct sidesteps both.

**Realisation divides revenue by tonnage over the same lines.** Dividing *total* revenue by
*weighed-only* tonnage inflates the answer by exactly `1 / coverage` — it read ₹21.23/kg on
live data where the matched figure was ₹13.00. Numerator and denominator must always be the
same subset, blended and per client alike.

**Coverage is stated in revenue terms, not line count.** One unweighed line worth ₹10L matters
more than fifty worth ₹500. And the exclusion is never neutral: unweighed lines are the
piece-billed work, which is the low-realisation end, so a partial figure always reads *better*
than the real blend. The card says so in place rather than letting it pass as complete.

**A client under 90% coverage is listed but not ranked** — shown as `n/a` with its coverage,
under a banner naming the revenue that cannot be priced. A ₹/kg drawn from 2% of a book is not
the same kind of number as one drawn from all of it, and sorting them together asserts that
it is. Concentration withholds tonnage share for such a client for the sharper version of the
same trap: an account with no weights barely enters the measured denominator and reads as a
*small* user of the plant when it is plausibly the largest. "Unknown, not small."

**Realisation by client is ranked worst-priced first.** That ordering is the point: the
largest account and the worst-priced one can be the same row, which is exactly the piece client's
shape (most of the tonnage on well under half the revenue, at a rate well below the ₹8.55 cost). Periods are measured on
the **invoice date**, not on when the record was typed — that is the date on the document and
the date GSTR-1 reports it under.
