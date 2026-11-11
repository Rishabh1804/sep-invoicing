---
subject: "Credit notes"
domain: billing
modules: [split/credit-note.js, split/exports.js]
specs: []
tests: [P19, P95]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Credit notes
SSS Mehta hold a **standing 2% discount on any payment batch spanning 7 days or more** — bought
to smooth cash flow, temporary but in force. Each such batch ships as two documents: the sales
register for the range, and a credit note for 2% of it. So **the batch is the unit of COMPUTATION,
not the invoice**, which is why the 04/08/26 reference credits ₹5,902.12 against ~₹2.95L of taxable.

**But the batch is not what the note is ATTRIBUTED to, and that is the customer's own call.** SSS
Mehta asked for a single invoice number on the face rather than a range, and — this is the part that
settles how far it reaches — **they asked for it against CN/007, a note they already held a printed
copy of.** So the note names **one invoice** and the batch survives in full on the annex, which is
where the s.15(3)(b) linkage limb actually lives: a post-supply discount reduces taxable value only
where it is specifically linked to the relevant invoices, so the annex caption has to keep *claiming*
that linkage rather than merely describing the arithmetic. ✅ **The invoice DATE beside its number
is a CLIENT REQUIREMENT, confirmed by the owner 8 Sep 2026** — SSS Mehta need it, which settles the
question on its own and independently of the statute. It also happens to be what rule 53(1A)(g)
requires, but note the order of the reasoning: **the requirement is the customer's, and the citation
is this repo's unverified reading** (asserted here, never checked with the filing CA). A document
prints the date because the person receiving it needs it. Rule 53(1A)(g) wants the serial number
**and the date** of the corresponding invoice, so both are printed, and both are snapshotted onto the
note — a deleted invoice must not strip a statutory particular off a document somebody holds.

**The pick is a DEFAULT, never an authority, and two real notes prove why.** The app chooses the
largest invoice with enough headroom, net of notes already taken against it. Measured against
`sep-invoicing-backup-2026-09-07.json`: **CN/005's recorded reference `000716` IS that invoice** —
the rule reproduces a real issued document unaided. **CN/004's `000443` is not** — it qualifies
comfortably but ranks fourth of twenty, and BM confirmed (8 Sep 2026) it is the number on the
customer's copy. BM's own convention is looser than the rule: *"use any invoice that has at least
that much amount billed"*. So the reference is **operator-settable from a pick-list over the batch**,
bound by the same headroom test — a document in somebody's hands is a fact, and a rule is not.

⚠ **And the pick is NOT invariant, unlike the certificate reference it was once compared to.**
`QC/<number>/<line>` is structurally derived and cannot move; this reads a **mutable money field**,
and those move — CN/006's stored `batchTaxable` already disagrees with the sum of its own invoices by
₹81.00, and the margin between first and second place on live data is ₹640.58. What makes a reprint
stable is the **stamp** written at creation, not the rule. A cancelled note is never stamped and
never named against: it credits nothing, the same reading that keeps a cancelled *invoice* from being
named and a cancelled *note* from consuming headroom.

Raised from a register selection, which is what makes select-all and the date-range filter part
of the same workflow: tick the batch, export its register, raise the note off the same set.

**The register that goes with it is a DOCUMENT, not just a CSV.** A batch ships as two things and
only one of them was printable: the CSV is a working paper for the accountant, and a spreadsheet is
not what you send a customer alongside a GST document. Invoices → More → **Sales register PDF** prints the
same register through the same print view every other document here uses — no PDF library, because
adding one to render a single table would be a second rendering path for a job the browser already
does.

⚠ **Its scope is SELECTION-FIRST and is stated on its own face.** A credit note is raised from a
ticked batch, and the register filter alone cannot express *"these fourteen"* — so a selection, when
there is one, is what the document covers. **The CSV is filter-only and unchanged**, so the two can
legitimately disagree; the document names its scope in its meta block precisely so nobody has to
guess which one they are holding.

🔴 **A register spanning two customers WARNS before it goes out.** This document exists to be handed
to one customer, and `cnValidateSelection` already refuses a credit-note batch spanning two — but the
register is also an internal filing artifact, so the multi-customer case cannot simply be blocked.
Sending it would disclose one customer's invoices to another. Warn, never block: the banner names
the count and says what to do, and filing it stays available.

Cancelled and voided numbers print at zero on the same rule the CSV uses — the number was issued, so
the series shows it — and are excluded from the total. A selection-scoped register carries no voids,
because a selection cannot tick a number that is gone. One
customer only. A batch under 7 days **warns and does not block** — split batches are the
operator's call.

**The discount is computed on value; the quantity is derived from it.** On a made-up note, 791.38 kg × ₹6.10 = 4,827.42
against the 4,827.40 credited — paise of disagreement only happen if the rupees came first (P19).

Own series, `CN/<3-digit>/<FY short>`, formatted off `S.invPrefix`. A credit note number is
**issued**, so it may never be reused — but it needs no void ledger, because a credit note is
**cancelled, never deleted**, which is the correct GST treatment anyway. The number stays in the
series carrying its own explanation and exports at zero. Its own CSV, too: credit notes go to
GSTR-1 table 9B (CDNR), whose columns are not the B2B ones.

The reference had four defects the app does not reproduce — see `docs/credit-notes/README.md`.
The headline one is the same identity drift the certificate had: header "SOMA ELECTRO PRODUCT"
against footer "SOMA ELECTRO PRODUCTS". Identity is read from `S.company`, never frozen.

**This changes the piece client's numbers.** At a standing 2%, its realisation
is **2% under its rate** — Stats reads invoices only, so every figure of that client above is
overstated by 2% on the periods the discount covers, until credit notes are netted off.

🔧 **NETTED 29 Aug 2026, and the original figure survives the test.** Measured against
`analysis/sep-invoicing-backup-2026-08-29.json` in the sister repo. **The notes are SEQUENTIAL
PERIOD BATCHES, and each is exactly 2% of its own period** — BM: *"CN/007 is up until 804 challan
for SSS Mehta, not till today."*

| Period | Mehta taxable | × 2% | Note | |
|---|---:|---:|---|---|
| June 2026 | ₹1,87,464.52 | ₹3,749.29 | **CN/004** | ✅ exact |
| July 2026 | ₹2,95,105.83 | ₹5,902.12 | **CN/005** | ✅ exact |
| 3–18 Aug (to inv 00804) | ₹1,90,379.43 | ₹3,807.59 | **CN/007** | ✅ exact |
| | **₹6,72,949.78** | **₹13,459.00** | | ✅ **2.0000%** |

**The scheme is applied in full on every period it covers. Realisation on the scheme period is
2% under the client's rate.** The nine invoices after 00804 are the **next note, pending ≈₹2,182.99** — not a
shortfall. ⚠ **April–May carry NO REBATE NOTE ON THE REGISTER — a null, not a ruling** *(Cipher H-3)*: ~~April–May predate the scheme (CN/004 is its first note)~~. **CN/004 established the SERIAL FORMAT** (`CN/NNN/26-27`), not the scheme's start; BM ruled **CN/002 and CN/003** out as *"credit notes, not rebates"*; **CN/001 has never been ruled on.** **₹9,841.57 (2% of ₹4,92,078.45) turns on this premise** — a BM question, not a derivation.

⚠ **An intermediate pass on 29 Aug published that the 2% reading was wrong, at an *"effective 1.0563%"*
— WITHDRAWN. It divided credits from a scheme beginning in June by a book including pre-scheme
April and May: numerator and denominator, different populations.** The rule this repo already
lives by, broken while applying it elsewhere.

🔴 **What DOES survive, and it is a control gap: CN/004 and CN/005 were never entered into the
app.** Instrument: both numbers, their reference invoices `000443` / `000716`, and all four of
their rupee figures, swept as literal strings over the whole backup — **zero hits for all eight.**
**₹11,388.66 gross of issued credit notes sits outside `S.creditNotes`, and therefore outside this
app's own CDNR export.** A netting taken from the array alone sees only CN/007 and reads 0.299%.
**The register that caught it is `soma-internal/operations/credit-notes/README.md` — the app's
array is not the register.**

🔧 **THE FIGURE WAS ₹10,821.75 UNTIL 12 SEPTEMBER 2026 AND IT NEVER FOOTED.** The register that is
the instrument — `soma-internal/operations/credit-notes/README.md:82-83` — states **CN/004 gross
₹4,424.16** and **CN/005 gross ₹6,964.50**, which sum to **₹11,388.66** (taxable ₹9,651.41).
**₹10,821.75 is reachable from no combination of the four published figures**, and it had been carried
unchallenged across three backups and eight surfaces, **one of them this file** — which a fold run
entirely inside `soma-internal` cannot reach. ⭐⭐ *A sister repo is an out-of-tree surface, and unlike
a commit message it is editable, so immutability is no defence.*

**An invoice shows its credit notes** (owner, 29 Sep 2026: *"see quickly if a credit note has been raised against an
invoice and hovering could show the reason why … makes the app tabs more interlinked, which makes it easier to look for
patterns and data errors, so the issue can be flagged early"*). A note touches an invoice two ways, and both are said:
taken **against** it (the one number on the customer's copy) or the invoice is **in its batch** (a rebate's annex)
(`cnLinksForInvoice`, credit-note.js; a cancelled note is left out). A register row, phone and desktop, carries a **CN**
badge (`cnInvoiceMarkHtml`, `data-cn-mark`) whose title reads each note as *CN/007/26-27 · against this invoice · Batch
rebate 2% on 14 invoices, 3 Aug – 18 Aug 2026 · ₹4,493.96* (`cnWhy`: a rebate's batch, else the note's reason); the
invoice detail lists them as rows that open the note (`cnInvoiceDetailHtml`), and the credit note list has an
**Invoice** button to the invoice it is against. To-do rule **`cnMatch`** flags a note against an invoice since
cancelled or deleted (red), and notes against one invoice crediting more taxable than it billed (amber); a note recorded
against a number typed from outside the book names no invoice here and is not judged. P95.

**CN/006 is cancelled**, superseded by CN/007 twenty-six seconds later (`cancelledAt`
1787222938914 against `createdAt` 1787222964835), both naming the same 14 invoices. Cancelled
rather than deleted, exporting at zero — the treatment this app implements, working as designed.

⚠ **The contribution arithmetic in Key Business Data is still not restated** net of the 2%.
⚠ **And the ₹/kg is arithmetic, not evidence**: Mehta is piece-billed, its derived weights invert
its own contract rate, so realisation equals that rate by construction. **The tonnage is real; the
₹/kg is not independent.**
