# Atlas: billing

Invoices, challans, credit notes, certificates, printing, rates, quotations and the masters.

Route: `CLAUDE.md` → `docs/atlas/INDEX.md` → this file → a topic → the code, spec and tests it names.

| Topic | Covers | Its modules | KB |
|---|---|---|---:|
| [Billing spine, duplicate receipts, key business data](domain-basics.md) | Business Domain; Billing Spine vs Logistics Spine; Duplicate receipts; Key Business Data | `im-dupe.js` | 4.1 |
| [Zinc pricing](zinc-pricing.md) | Zinc pricing | `zinc.js` | 3.4 |
| [Invoice numbers, voids and reissues](invoice-numbers.md) | Invoice numbers outlive invoices | `invoice-ops.js`, `number-audit.js` | 2.8 |
| [Quality certificates](quality-certificates.md) | Quality certificates | `quality-cert.js` | 3.6 |
| [Printing: the preview, the long tax invoice, its type](printing.md) | The print preview is the page; A tax invoice that runs past one page; The invoice's type is its own; The sidebar offset reached the paper | `print.js` | 12.2 |
| [Credit notes](credit-notes.md) | Credit notes | `credit-note.js`, `exports.js` | 11.0 |
| [Challan entry: keyboard, filled from the record, invoiced in parts, billed at zero](challan-entry.md) | Keyboard entry; A challan line filled from the record; A challan invoiced in parts; Billed at ₹0 | `im-form.js`, `im.js` | 7.4 |
| [Items Master and Client Master](items-and-clients.md) | Items Master; Client Master | `autocomplete.js`, `clients.js`, `items.js` | 3.4 |
| [The rate on record and the matcher](rate-on-record.md) | The rate on record | `create.js` | 11.2 |
| [Quotations and prospects](quotations-and-prospects.md) | Quotations; Prospects | `prospects.js`, `quote.js` | 6.3 |
