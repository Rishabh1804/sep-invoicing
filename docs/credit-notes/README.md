# Credit notes — reference

`2026-08-04_CN-005_SSSMehta_july-2pct.pdf` is the document the app's credit note was built
from: CN/005/26-27, raised 04.08.2026 against SSS Mehta's July billing. Kept as the
**provenance of the format**, the same way `docs/test-certificates/` is for the quality
certificate.

Unlike that certificate, **no external approval binds this layout**. It is the shop's own
document, so where the reference is wrong the app corrects it rather than reproducing it.

## The arrangement

SSS Mehta hold a **standing 2% discount on any payment batch spanning 7 days or more** —
a price paid for smoother cash flow. Temporary, but in force. Each such batch ships as two
documents: the sales register for the range, and a credit note for 2% of it.

So **the batch is the unit, not the invoice.** The reference credits ₹5,902.12 against roughly
₹2.95L of taxable — about a month of invoices, not the single one it names.

## The discount is computed on value

1092.98 KG × ₹5.40 = ₹5,902.09, but the document prints ₹5,902.12. Three paise of disagreement
only happen if the rupees came first and the kilograms were derived from them. The app
computes the same way, so the quantity is a readable restatement of the credit, not a
separately measured figure.

(The app rounds that derived quantity to 1092.99; the reference truncated to 1092.98. HR-8 —
round, never floor.)

## What the app does differently, and why

| Reference | App | Why |
|---|---|---|
| "Amount Chargeable (in words)" states ₹5,902.12 | states the Total, ₹6,964.50 | The reference's words disagreed with the figure printed beside them — that box holds the sub-total, not what is chargeable. |
| Tax in words states ₹531.19 | states total tax, ₹1,062.38 | ₹531.19 is one of the two components, not the tax on the document. |
| Tax summary columns "Central Tax" / "SalesTax" | CGST / SGST | Legacy wording for an intra-state supply. |
| Header "SOMA ELECTRO PRODUCT", "8-B, 1ST PHASE"; footer "SOMA ELECTRO PRODUCTS", "B-8, (1st Phase)" | both read `S.company` | The same identity drift the certificate prototype had. One source means header and footer cannot disagree. |
| Names one invoice | names the batch, and annexes every invoice number in it | A consolidated credit note is legal (s.34 as amended), but a document crediting forty invoices while naming one is not auditable. |
| PO Number / PO Date / Challan Number rows, blank | replaced with Period and Reason | A single PO or challan reference does not apply to a batch. **Open with the owner** — if the customer expects those rows present, say so and they come back. |

## Numbering

Own series, `CN/<3-digit>/<FY short>`, formatted off `S.invPrefix` so the two documents always
agree on the year. A credit note number is **issued** — the customer holds a document bearing
it — so by the rule that governs invoice numbers it may never be reused.

It needs no separate void ledger, though. A credit note is **cancelled, never deleted**, which
is the correct GST treatment anyway: the number stays in the series carrying its own
explanation, and exports declare it at zero. That is the whole apparatus `S.voidedNumbers`
provides for invoices, obtained for free.

## Export

Its own CSV rather than rows inside the GSTR-1 sheet: credit notes go to table 9B (CDNR),
whose columns are not the B2B ones, and mixing the two shapes into one flat sheet would
corrupt both.
