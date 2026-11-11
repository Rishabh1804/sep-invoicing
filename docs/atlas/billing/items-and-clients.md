---
subject: "Items Master and Client Master"
domain: billing
modules: [split/autocomplete.js, split/clients.js, split/items.js]
specs: []
tests: []
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Items Master
Part number registry with weights, gauge, descriptions, and merge capability.

**A missing part is created from the line being typed.** The autocomplete's last row offers to add
what was typed, prefilled, and drops the new part straight back into the line — the round trip to
the Items tab lost the in-progress form, which is why parts went unregistered. It is offered even
when there are matches, because a new gauge of an existing clamp matches the part number and is
still a different part.

That row is present on almost every list, which is what made the keyboard contract the thing to
protect: one real suggestion plus the add row is two options, and `acPendingOption()` would have
stopped committing a lone match on Enter. It filters the add row out of that shortcut. An unaimed
Enter therefore still means "on to the quantity" — creating a part takes a click or an arrow.

**Weights derive themselves at bootstrap.** Where a client bills per piece off a rate per kg,
`weight = pieceRate ÷ ratePerKg` recovers it exactly, and `init.js` runs that once via
`applyDerivedWeights()`. It fills only empty weights, is idempotent, and never touches billing:
rates resolve through `getLineItemRate()` against the client ladder, `stdWeightKg` is read by
Stats and Items Master alone, and the `nos_to_weight` path reads `S.partWeights`, which this
does not write. The `_deriveWeights1` flag is only set once there *was* something to derive
from, so a device that loads empty and imports a backup later still gets its pass. The Items
Master button remains for items added after that pass and shares the same function.

Leaving this behind a button nobody had pressed is what made the dashboard quietly wrong: 90
of 168 rows had no weight, almost entirely the piece-billed parts, so tonnage covered 61% of
revenue and the one account the figures existed to examine was the one they could not see.
The pass fills 72 of the 90 and takes coverage to 94%; the 18 it leaves are KG-billed, whose
quantity is already kilograms.

Note what such a weight is: defined as `pieceRate ÷ ratePerKg` it prices back at exactly that
rate. The weight itself is exact — the rate card was built as weight × rate — and the tonnage
it yields is real. What it cannot do is *independently* re-establish the ₹/kg, because that
was the input. For a piece-billed client, realisation always equals the contract rate; that is
arithmetic, not a finding. The value of these weights is **tonnage and capacity share**.

**Gauge is part of a part's identity.** Four clamp families exist in two gauges at different
rates — `CLAMP 165X83 (NT)` at 35X6 and 40X6, plus `105X83 (NT)`, `133X83 (NT)` and
`124X77 (UT)` — so two rows can share a part number and be different weights. Two consequences:
the printed line description folds the gauge in via `partLineDesc()` on **both** the invoice and
challan paths (the challan path used to drop it, and since IM is the billing spine that omission
flowed into every invoice raised off the challan); and weight derivation **skips** any part
number held by more than one gauge rather than averaging them into a figure right for neither.
Skipping costs no tonnage — the line-level route above still weighs those lines correctly.

### Client Master
22 clients with rate lookup, billing mode assignment, and contact info. Billing modes in live
data: 20 `weight`, 1 `piece` (SSS Mehta), 1 `nos_to_weight`.
