---
subject: "Billing spine, duplicate receipts, key business data"
domain: billing
modules: [split/im-dupe.js]
specs: []
tests: []
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

## Business Domain

### Billing Spine vs Logistics Spine
**Critical concept:** IM (Incoming Material) is the billing spine. GC (Gate Challan) is the logistics spine. They are **parallel, not sequential**. One IM can spawn multiple partial GC records.

### Duplicate receipts
Seven duplicate IM events went into FY27 unchallenged — 973.75 kg + 826 NOS of phantom
receipts, four of which reached customer invoices (₹8,040.02 taxable, ₹1,170.18 output tax).
The guard in `im-dupe.js` fingerprints on **`(client, challanDate, line-quantity multiset)`** —
content, not identifiers, because the two hardest cases defeat an identifier key: one copy of
a client's challan carried a blank `challanNo`, and another carried the same kilograms under an
aliased part number. A blank `challanNo` warns in its own right.

**Warn, never block.** Split challans against one consignment (702/703) are legitimate. The
operator's override is stamped on the entry as `dupeAck`, so an audit can distinguish an
accepted duplicate from one nobody was shown. Duplicate records are never auto-deleted — they
are the evidence of the pattern.

**The challan NUMBER is checked as it is typed** (owner, 27 Sep 2026: *"instead of checking for duplicate challan
at the end of entering the entire challan details, check for duplicate challan number when the challan number is
typed for a particular client"*). The moment the number is entered in the challan form (on change, and when the
client is chosen after it), the client's challans are searched for it — case, spaces and leading zeros ignored
(`imChallanNoKey`: `0301` is 301), the challan being edited left out — and a match is said under the field:
*Challan 301 is already recorded for … on 21 Sep 2026 (3 lines, not invoiced)*, with **Open it** reading that
challan in a dialog while the form stays as typed. Warn, never block. **The fingerprint at save stays as the second
net** (the blank number, the aliased part), but a challan the field already showed is not asked about again — seen
means on screen for at least 1.2 s (`CHALLAN_WARN_READ_MS`), since a number typed and Save tapped at once draws the
warning under the tap. The save dialog still asks for a content match on a *different* challan and says which one
was already shown. Saving past the field's warning is an acceptance too: `dupeAck: {at, matchedIds, shownAsTyped: true}`.

### Key Business Data
Rebuilt from owner-supplied cost inputs against Apr–Jul 2026 actuals (~79,850 kg/month).
Supersedes the earlier ₹5.46/kg cost and ~31% operating margin, both of which were stale.

| | ₹/kg | Share of cost |
|---|---|---|
| Labour (contract + permanent) | 3.55 | 42% |
| Zinc (~425 kg/mo at MCX + ₹15) | 2.21 | 26% |
| Chemicals | 1.57 | 18% |
| Power | 0.81 | 10% |
| Consumables, water/ETP, maintenance | 0.42 | 4% |
| **Full cost** | **8.55** | |

- **Blended realisation:** ₹8.45/kg → roughly −₹0.09/kg, about break-even.
- **The piece client:** 41% of revenue but **58% of tonnage** at ₹6.10/kg (made-up figures), well below full cost.
  Whether to exit or reprice turned on contract labour: fixed → it still contributes
  ₹0.53/kg; volume-scaling → it loses ₹1.64/kg. **Ruled 13 Oct 2026: fixed** (owner). Stats settles it that way.
- **Capacity:** ~2 t per 8-hour shift; running ~77% of a two-shift month, ~24 t/month spare.
  Filling that at ₹13/kg is worth more than the SSS Mehta question either way.

**The app now corroborates this model from the invoice data, independently.** Once weights are
derived (below), Stats measures blended realisation at **₹8.42/kg against the modelled ₹8.45**,
contribution at **−₹0.13/kg against a modelled −₹0.09**, and the piece client at **59% of tonnage
against the modelled 58%**, on 41% of revenue (its shares made up here). Nothing in
that calculation knew the cost model; it is arithmetic over 769 invoices. Two routes to the
same shape is the strongest evidence the model is right that this repo has.

The piece client's own ₹/kg is the one figure that is not independent confirmation — its weights
invert its contract rate, so that number is its rate restated. Its **tonnage** is real, and that
is what the corroboration above rests on.
