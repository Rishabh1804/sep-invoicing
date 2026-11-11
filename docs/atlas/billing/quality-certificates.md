---
subject: "Quality certificates"
domain: billing
modules: [split/quality-cert.js]
specs: []
tests: []
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Quality certificates
The Test Certificate (ZN Plating) is issued **per part per dispatch**, not per invoice — the
customer files it against the part they inspect — so an invoice covering three part numbers is
three certificates. Generated from the register: per invoice from its detail, or in bulk from a
selection.

The format is approved by Tata Motors QA and says so on its own face: *"No alterations are
permissible to the format without written approval of QA - TML."* So `QC_SHOP_DATA` reproduces the
04/02/26 reference **verbatim, typos included** — `Cynide`, `Brightner`, `Ruse`, `Peef off`,
`Importer Coverage`, `final gating`, `Ginca`, `Rodiprind`. Correcting the spelling would invalidate
the approval that makes the document worth issuing. It is a constant and not part of `S` for the
same reason an imported backup must not be able to rewrite it.

Company identity is the one exception: name, address, contacts and GSTIN are read from `S.company`,
so the certificate and the tax invoice can never disagree about who issued them. **Never freeze a
second copy into a document template** — the prototype in `docs/test-certificates/` did, and it had
already drifted: it carried GSTIN `20AAFFS4718J2ZD` where the invoice files under
`20AAPFS4718J2Z0`. The owner confirmed (14 Aug 2026) that `20AAPFS4718J2Z0` is correct and the
certificate copy was a transcription typo. The JSON is corrected; the four certificates rendered
from it on 15 Apr 2026 carried the wrong number (they left the repository with its client data on
26 Oct 2026, and its samples are made up now), and any copy that reached the customer bears it.
That error is distinct from the preserved original-document typos — those are approved format text,
a GSTIN is a fact about the taxpayer.

**The certificate reference is derived, not counted:** `QC/<displayNumber>/<line no>`. Regenerating
a certificate must yield the number it had the first time, and a derived reference cannot gap,
cannot be voided, and needs no ledger of its own — the whole apparatus that `S.voidedNumbers` exists
to provide for invoice numbers is unnecessary here because the number *is* a pointer to the invoice
line it certifies. Nothing is written to state when one is printed.

**A cancelled invoice certifies nothing** and is refused: those goods were never billed, and the
number appears in GSTR-1 at zero. A bulk run states what it skipped rather than quietly printing
fewer pages — a certificate missing from a stack of forty is not noticed until the customer asks.

**Net Wt. is per consignment** — the kilograms of that part in that dispatch, scoped to the line the
certificate covers, not the whole invoice. (Settled with the owner Aug 2026; the approved reference
left it at `0.000` and never said whether it meant per piece or per consignment.) It is filled only
from a weight the invoice was itself **priced on**: a KG line's quantity is already kilograms, and a
`nos_to_weight` line's kilograms are `qty × S.partWeights[part]` — the same arithmetic
`recalcLineItem()` ran to produce the amount.

**A piece-billed line keeps the blank.** The only weight available for it is the Items Master
`stdWeightKg`, defined as `pieceRate ÷ ratePerKg` — exact for tonnage and capacity share, but it is
the rate card read backwards, and the customer being handed the certificate is the one who set that
rate. Quantity and Net Wt. reading alike on a KG line is correct, not a duplicated cell: that is
what being billed by the kilo means, and the form carries both fields because piece-billed parts
make them differ.

The observations (`10-12` thickness, `TRIYELLOW`) are still the reference's constants, not per-batch
measurements.
