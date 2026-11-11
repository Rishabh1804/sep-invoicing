---
subject: "The rate on record and the matcher"
domain: billing
modules: [split/create.js, split/state.js]
specs: []
tests: [P38]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### The rate on record
**Replayed 24 Sep 2026** over `soma-internal/analysis/sep-invoicing-backup-2026-09-11.json` (931
invoices, 2,835 lines) before any matcher threshold was set. The finding was that the reference
was wrong far more often than the billing: **zero** decimal errors in the whole history, and most
of what a matcher would have flagged was reference data.

- **The Items Master is not a rate card.** One `rate` per part, no client, no date. It disagreed
  with many of the piece client's lines, mostly because the customer's rate moved and the master did not
  (a part billed at one rate on every line since April, the master a few paise under it), and in three rows because
  the client's ₹/kg figure had been typed into the per-piece field.
- **So a piece rate is the CLIENT's: `client.pieceRates`, dated, keyed on part AND gauge.**
  `getPieceRate()` in `state.js`. Part keys ignore case and punctuation (`rateKey`); the gauge is
  read from the line's description by `lineGauge()` — two digits × one digit, standing alone, so
  `L.C.Pad 150x80x3` (a part size) never reads as one. A part priced by gauge on a line that does
  not say which gauge returns `{ambiguous: true}`: reported, never guessed.
- ⚠ **Deliberately NOT `itemRates`.** An override is a negotiated per-piece figure with no weight
  basis, and Stats and weight derivation refuse to invert one. Putting SSS Mehta's card there would
  wipe 61% of the plant's tonnage off the dashboard.
- **`getRateOnRecord(client, date, item)` is the one place the matcher reads**: override →
  `pieceRates` for a NOS line → the ₹/kg ladder. It returns the **unit** with the figure, and a NOS
  line with no piece rate gets **no** reference rather than the ladder — comparing ₹1.10/pc against
  ₹10/kg is the unit error the master rows made. *(NEXT_SESSION had the order as ladder → itemRates →
  items master; the code has always been itemRates → ladder, and never read the master.)*
- **An override prices a line only in its own unit** (`itemRateFor`, state.js; the QA chain of 2 Oct 2026): per kg on a KG
  line, and on a `nos_to_weight` NOS line as pieces × the part's kg a piece × the rate where the weight is known; per piece
  on a NOS line. Anything else is not the override's line: it is priced at the client's own rate and the matcher says
  *Another unit*. Every path that prices a line reads it there (the invoice and challan forms, a part typed or picked, a
  client picked, a unit switched, the scanner). Before this a ₹16/kg override priced 600 pieces at ₹9,600 (₹1,920 at
  0.2 kg a piece) and the matcher, comparing the line with the same figure, said Matches. A row with no unit is per piece,
  as it was always priced (the client card had shown it as /kg).
- **The card is filled from what was billed** — Client → Edit → Piece Rates → *Fill from billing
  history* — building one dated entry per rate change. Two things are left out and **listed**: a
  rate seen on **one** invoice where another is established on two or more (the shape of 00922 /
  00923, where Samarth material was misattributed and two brackets swapped rates for a day — the
  owner confirmed, 24 Sep 2026), and a rate that **returns** after changing, which is two products
  under one name (gauge-less `CLAMP 165X83 (NT)` lines swing 4.27 / 4.89 / 4.27). On the real
  backup, after filling both cards, **2,729 lines match exactly and 18 priced lines differ**.
- **Prefill uses it too** (`defaultLineRate`). A NOS line used to be handed the ₹/kg figure — several
  rupees against a pad priced at a rupee or two — and a Samarth part with no weight priced itself at 0 kg × ₹14.50 = ₹0.
- **T-HC is fixed.** The scanner priced every KG line off rates frozen into `_scanClientMap`, so a
  rate change or an override never reached a scanned challan. It now reads the client's records;
  the frozen figure is only a fallback for a client the app does not hold. A piece client's
  challan keeps its own amount — that is the passthrough.

**The matcher: option E, chosen by the owner 24 Sep 2026** (`rateMatch()` in `state.js`, one
renderer `rateMatchNote()` in `create.js`). Five candidate rules were replayed over the 18 differing
lines and rendered side by side before any was built:

| Verdict | Rule |
|---|---|
| **Matches** | equal to the paisa |
| **×10 slip** | a power of ten away, within 2% — checked before any threshold |
| **Check** | **≥ 10% off, or ≥ ₹100 at stake on the line** (difference × quantity in the reference's unit — a `nos_to_weight` line stakes kilograms) |
| **Differs** | anything less, with its difference shown |
| *No rate on record* / *Gauge not stated* | grey, never red — nothing to compare against |
| *Another unit* | amber, never Matches: the part's override is in another unit than the line (per kg on a line in pieces), so the line is at the client's own rate (QA chain, 2 Oct 2026) |

The percentage catches a wrong rate whatever the quantity; the rupee floor catches the small slip on
a big line (00684: 8.3% low, ₹119.60 short across 920 pieces), which the percentage alone let
through. The owner's first-written flat ₹0.50 left 10 of the 18 lines with **no mark at all** — the
yellow/red gap NEXT_SESSION warned of. On the real backup the rule gives **10 Check, 8 Differs**.
**Warn, never block**, like the duplicate-challan guard: a rate can differ and be right. It shows on
the invoice form and the challan form as the rate is typed (and when the invoice date moves — the
rate on record is dated), and on the invoice detail only where a line needs a second look; a ₹0
line is judged by its own required reason instead. The two thresholds live in **Settings → Checks & alerts
→ Rate & weight check** (`S.rateCheck`, read by `rateCheckCfg()`), so a config object `ensureStateShape()` fills
key by key on an old backup. A blank or zero value falls back to the ruling's 10% / ₹100 rather than
to 0, which would turn every difference red.

**The kilograms are checked too, for a client billed by the kilo whose challans count pieces**
(owner, 24 Sep 2026: *"for [a kilo client] and other clients whose rate per kg is done but weight/pc is
known, do the same mismatch update"*). Such a client's challan carries a Qty (pieces) column and a Wt.
column, so a weight per piece on record checks the kilograms the way the rate card checks the rate:
`weightMatch()` compares a KG line's `qty` against `nosQty × kg/pc`.

- **The weight is the CLIENT's (`client.pieceWeights`), never the Items Master's.** The master has
  one row per part name and no client: Khetan's `BASE PLATE` weighs ~0.70 kg a piece on every line
  and the master says 0.053, because General Engineering sends a part of the same name; Pawan's
  `SPACER MOUNTING` runs at 0.16× its master row. Same lookup as the piece rates (`cardLookup`:
  part key, gauge, date).
- **Filled from billing history by the MEDIAN** of kg ÷ pieces, only where the part was weighed on
  two or more invoices. A part where over a quarter of its lines (and at least two) sit 10%+ from the
  middle is **two products under one name** — HighCo's `FLANGE NUT` at exactly 0.032 or 0.064 kg,
  Khurana's `WASHER` at 0.021 or 0.042 — and is listed, never averaged. A ×10 line is a slip, not a
  second size, and does not count against the part.
- **Same verdicts and the same Check thresholds as the rate, with a scale's tolerance.** Measured
  over the 1,068 KG lines carrying a piece count: the median line is 0.4% off its own client's
  median, three quarters within 2.3%. So a weight within **±3% matches** (Settings → Checks & alerts
  → Rate & weight check), a power of ten is allowed ±5%, and the stake is the kilograms off × the line's rate. On
  the backup, after filling every client's card: **793 match, 2 ×10, 28 Check, 88 Differs**, 157
  with no weight on record.
- **The two ×10 slips were PIECE COUNTS, not weights — ruled by the owner, 24 Sep 2026.** **00830**
  (a clamp of one kilo client): its pieces were keyed at a tenth of what came; the kilograms billed were right.
  **00086** (a bracket of the same client): its pieces keyed at ten times; the kilograms were right. No money moved.
  Both were put right on the invoice and **stayed wrong on the challan** — which is the next
  section.

**An invoice correction reaches its challan.** IM is the billing spine, and a correction made on
the invoice used to stop there: an invoiced challan line cannot be edited, the invoice form had no
piece count at all, and an invoice line did not record which challan line it came from. The owner:
*"back corrections don't happen in the IM — it should, these could have been avoided."*

- **An invoice line carries `imItemId`.** A line saved before that is linked when the invoice is
  opened for editing (`withChallanLinks`): same invoice, same part, same quantities, each challan
  line claimed once. A line that matches two challan lines is **left unlinked, never guessed**.
- **Saving an edited invoice writes back the fields CHANGED IN THAT EDIT** (`backCorrectChallans`)
  — of part, description, unit, quantity, pieces, rate, amount — never every field where invoice and
  challan already disagree: an older invoice routinely differs from its challan for reasons nobody
  decided that day (the gauge folded into the description, a rate recomputed from the amount), and
  an untouched save must not rewrite the challan. It **keeps what they were** on the challan line as
  `corrections: [{at, invoiceId, invoice, from, to}]`. The challan is the record of the customer's
  paper; overwriting it without trace would lose what an audit asks. History lists each one:
  *"Challan 4115 corrected from SEP/…/00830: CLAMP 9105 0000 4705 — pieces 40 → 400"* (P38's made-up example).
- **A correction on a NEW invoice reaches the challan too** (owner, 30 Sep 2026: *"correction on the invoice should be reflected
  in the challan with a note"*). A challan line brought into the form remembers what it said (`imLineOrig`, `_fromNew`), and on
  save a field typed over it travels back like an edit's. The quantity is the exception: typing less than the challan is
  dispatching part of it, so it travels only when the operator said *Challan quantity was wrong*. The challan line shows each
  correction as a note (*Corrected · from SEP/…/00012: rate 13 → 13.2*, `challanCorrectionText`, History's wording), and the save
  says which challan was corrected.
- **KG lines on the invoice form have a Pcs field** — it prices nothing, but it is what the weight
  is checked against, and it was the field both slips were in.
- ⚠ **Every save confirmation had been invisible.** `switchTab()` clears toasts, and `saveInvoice()`
  raised *"Invoice updated"* / *"Invoice … saved"* just before switching — so neither ever reached the
  screen. They are raised after the switch now; found because the challan note vanished the same way.

**A line names its PART on screen** (`lineLabel`). The invoice detail and the challan list printed
`desc` alone, and for a piece client `desc` is often only the gauge (`40X6`) or a word (`CLAMP`) —
the owner searched a challan and could not see which part was on it. The part number leads; the
description follows when it adds something. The printed invoice is unchanged. **Register search
reaches challan numbers**, matching a whole number (leading zeros ignored), never a fragment:
`83` must not find challan 834.
