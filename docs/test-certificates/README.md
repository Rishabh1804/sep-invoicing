# Test certificates — prototype, superseded

**The app generates these now.** Register → open an invoice → **Quality Cert**, or tick several
invoices and use **Quality certs** on the selection bar. See `split/quality-cert.js` and the
Quality certificates section of `CLAUDE.md`.

This folder is kept as the **provenance of the format**, not as a working tool:

| File | What it is |
|---|---|
| `cert-shop-data.json` | The shop-level data the app's `QC_SHOP_DATA` was transcribed from — processes, chemicals, specs, notes, sampling plan. Verbatim from the TML-approved 04/02/26 reference. |
| `cert-issues.json` | One per-batch entry, hand-maintained. The app reads the register instead. |
| `generate.py` | The prototype generator. Marked superseded in its own docstring. |
| `2026-04-15_*.html` / `.pdf` | Four certificates rendered 15 Apr 2026 for SSSMehta against invoice 137 / challan 94. |

## Do not resume issuing certificates from this script

It has no access to the invoice register, so nothing it prints is tied to a document the customer
holds — the certificate number, the invoice number and the quantities are all typed in by hand and
nothing checks them against the invoice. That is the gap the app closes.

## Two errors this prototype carried

**GSTIN.** The company block read `20AAFFS4718J2ZD`. The tax invoice files under
`20AAPFS4718J2Z0`; the owner confirmed on 14 Aug 2026 that the certificate copy was the typo. The
JSON is corrected. **The four rendered HTML/PDF files still show the wrong number** — they are left
as-is because they are the record of what was rendered, and possibly of what was sent. If any copy
reached SSS Mehta, it bears an incorrect GSTIN.

This is not one of the deliberately preserved original-document typos (`Cynide`, `Peef off`,
`Ruse`, …). Those are approved format text and altering them would require QA-TML re-approval. A
GSTIN is a fact about the taxpayer, and a wrong one is simply wrong.

**Frozen company identity.** Freezing name, address, contacts and GSTIN into a certificate template
is what let it drift away from the invoice in the first place. The app reads `S.company` instead,
so the two documents cannot disagree about who issued them. Do not re-introduce a second copy.
