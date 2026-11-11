---
subject: "Invoice numbers, voids and reissues"
domain: billing
modules: [split/invoice-ops.js, split/number-audit.js]
specs: []
tests: []
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Invoice numbers outlive invoices
A deleted invoice used to vanish outright, leaving a number gap indistinguishable from one
never issued — the exact ambiguity that made inv 00666's correct deletion unreadable, and that
leaves five cancelled-and-filed-at-zero numbers present in GSTR-1 and absent here.

Deletion now writes a tombstone to **`S.voidedNumbers`** carrying the number, a **required**
reason, and what the invoice was. The register's **Number audit** walks the whole serial range
and classifies every number: live / cancelled / voided-with-reason / reissued / **unaccounted**.
A historical gap is explained in place — no invoice is invented to hang the explanation on.

**`reserved` decides the numbering.** An invoice still in `created` or `printed` state never left the
building, so its number returns to the series (the ordinary typo-and-redo flow; a printed sheet not yet sent is paper
in the office, not a document the customer holds). Once
`dispatched`, `delivered` or `filed`, the customer holds a document bearing that number:
it is spent, `invNextNum` may never walk back over it, and the hole in rule 46's consecutive
series is what the ledger exists to explain. Reserved voids export at ₹0 in both CSVs — the
same treatment cancelled invoices already get, and what makes the app agree with the filing.

**A number may be REISSUED before its return is filed** (owner, 25 Sep 2026: *"If GST has not been filed this
should be allowed"*). The practice had been to delete the invoice, set Settings' next number back to it, create
the corrected one and set Next forward again: ten live numbers were made that way, 00862 and 00923 twice. Done by
hand it carried three defects, all closed now:
- **Delete → "Delete and reissue NNNNN"** does it in one step: the old version is voided with its reason (the
  record of what the customer was first sent), and the create form opens with the same lines, challan links and
  number. Offered only while the invoice is not `filed` and not cancelled.
- **Next is never left on a held number.** Reissuing from Settings used to leave Next one past the reissued
  number (851 with 993 issued), so the invoice after it would have duplicated 851. After any new invoice, Next is
  at least the highest issued + 1 (`invHighestIssued`), and a save onto a live invoice's number is refused.
- **Settings' Next may go back only onto a free number that was never in a filed return** (`invReissueCheck`), and
  asks first. A live invoice's number or a filed one is refused.
- **A reissued number exports once, as its live invoice.** Every deleted copy used to export at ₹0 beside it: the
  August GSTR-1 CSV carried 00862 three times. `getVoidedForExport()` now drops voids a live invoice holds and lists
  a number deleted more than once a single time. The number audit still shows the history as *reissued*.
