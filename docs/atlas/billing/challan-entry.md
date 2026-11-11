---
subject: "Challan entry: keyboard, filled from the record, invoiced in parts, billed at zero"
domain: billing
modules: [split/im-form.js, split/im.js, split/create.js]
specs: []
tests: [P77, P78, P141, P181]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Keyboard entry
Challan entry is fully keyboard-operable. The suggestion lists (part autocomplete, client
search) take arrow keys and Enter, and a lone match commits without arrowing first. The form
re-renders by replacing `innerHTML`, so **every control carries a `data-k` key and focus is
captured and restored across the re-render** — that focus drop, not the dropdowns, was what
really ended the keyboard path mid-entry. `Alt+N` adds a line, `Ctrl+Enter` saves, and buttons
marked `data-kbd-ring` join the Enter-to-next-field chain (a line's remove `×` deliberately
does not).

**A part field left closes its own list, a moment later** (200 ms, so a tap on one of its options lands first), and never
another's: it used to close every list on the page, and a client search opened inside that moment, on another screen, was
hidden under the cursor (CI caught it on P141 on a busy runner). P181.

### A challan line filled from the record
Owner, 26 Sep 2026: *"When I select C-Clamp 66x42(30x6) as we know all its value and std weight and rate, fill that
out automatically so that me or anyone can click through it to verify and change if needed; if the change for the
final amount is more than the conditions we have for matches which raises a red flag then ask for a reason."*

- **Choosing a part fills the line from the client's record** (`lineFillFromRecord`, state.js): the rate on record
  (`defaultLineRate` — a piece client's card for a NOS line, else the ₹/kg ladder) and the **kg per piece** (the
  client's own `pieceWeights` card, else the Items Master `stdWeightKg`, and the note says which).
- **Counting fills the rest** (`lineFillFromCount`): on a piece line, pieces × rate → the amount (the amount stays
  editable — the customer's challan figure is the passthrough); on a weight line, pieces × kg/pc → the kilograms.
  **Never over a typed figure:** a filled field is marked in `item._auto` until somebody types in it, and a typed one
  is the operator's for good. A note under the line says what came from the record, so tabbing through it is a check.
  Switching a piece client's line to NOS re-prices it from the card rather than zeroing it.
- **A red flag needs a reason.** A line on the matcher's own **Check** or **×10** verdict — rate (`rateMatch`) or
  weight (`weightMatch`), the Settings thresholds — cannot be saved until a reason is picked under it, one tap:
  *Customer's challan says so · Rate changed · Weight differs this batch · Other*, with a note (recommended). The ₹0
  line's contract, for the same reason: an audit must tell a figure somebody examined from one nobody was shown.
  **Differs** asks nothing. Saved as `flagReason`, `flagNote` and `flagAt {kind, status, ref, value}` — the verdict it
  was given against — and dropped when a later edit puts the line right (`lineFlagFields`).

### A challan invoiced in parts
Owner, 26 Sep 2026: *"Samarth Engg sends 600 nos of an item, I should be able to invoice that challan multiple times
till 600 is reached, so maybe we dispatch 200 in one day, then 300 and then 100."* A challan line was all-or-nothing.

- **What a line has billed is DERIVED, never typed** (`im.js`): the sum of `qty` over invoice lines naming it
  (`imItemId`) on invoices not cancelled — a deleted invoice frees its share by being gone. `imBilledIndex()` builds
  that index; `imSyncBilled()` caches it on the line as `billedQty`, `billedNos`, `invoiceIds`, `invoiceId` (the
  latest) and `invoiced` (nothing left, within `IM_QTY_EPS`), after every invoice save, edit, cancel, delete and
  reissue and in `migrateState()` (it replaced the orphan repair). So `!it.invoiced` still means *open*, everywhere.
- **Every unbilled amount is the open share** (`imLineOpen`: amount × left ÷ qty; pieces from `billedNos`, else in
  proportion): Home, Stats, the To-do's unbilled rule, the month's pace, the IM selection. A challan with a line
  part-billed reads **Part invoiced**; any share billed locks its edit and delete (`imLineBilled`).
- **The Create picker and IM's Create invoice bring a line at what is LEFT** (`imLineFormItem`) and say so:
  *600 on challan 301 · 200 invoiced (SEP/…/00012) · 400 left*. Typing 200 is dispatching 200 (a piece client's
  amount follows as that share of the challan's amount; a KG line's untyped pieces follow the kilograms).
- **More than is left asks for a reason** (owner, 27 Sep 2026: *"For both the limits, ask for a reason"*): the line
  says *30 over what is left on challan 301*, and under it a one-tap picker — *Customer dispatched more than the
  challan · Challan quantity was wrong · Other*, a note recommended — the red flag's and the ₹0 line's contract. The
  invoice cannot be saved until one is picked (the error names the line), and the line keeps
  `overBillAck: {at, left, reason, note}`; it goes when an edit brings the line back within what is left. The
  confirm-era stamp `{at, left}` still loads and reads *accepted, no reason recorded* on the invoice, and is asked
  for a reason only if the invoice is edited while still over.
- **A unit changed on a linked line asks for a reason too, and closes the challan line.** A line billed in KG
  against a NOS challan line (or the reverse) cannot be compared: it says *Cannot be compared with challan 301: it
  holds 600 NOS … this line closes the challan line*, and asks *Customer bills this part by weight / by pieces now ·
  Challan unit was wrong · Other*; `unitChangeAck: {at, from, to, reason, note}`, required to save, dropped when the
  unit is put back. **Such a line bills its challan line WHOLE** (`imRefWhole` in `imRefsBilled`): 52.5 kg cannot be
  netted against 400 pieces, and leaving the line open would show phantom unbilled material on Home, Stats and the
  To-do for ever. The unit travels back to the challan only as a correction the operator named (*Challan unit was
  wrong*, on a whole line); any other reason leaves the challan's unit and quantity as the customer's paper says.
  P78.
- **Editing counts the invoice's own share as left.** Back-correction never writes quantity, pieces or amount to a
  challan line that is PART of one — billed by another invoice too, or not at the challan's quantity when the edit
  began (`CHALLAN_SHARE_FIELDS`); part, description, unit and rate still travel. A whole, single-invoice line
  corrects exactly as before.
- **History is not reopened.** A line flagged invoiced by an existing invoice that names no challan line stays
  billed whole (`billedLegacy`), until that invoice is linked, deleted or cancelled; a looser legacy link on a
  different quantity is saved `imWhole` and counts as the whole line. P77.

### Billed at ₹0
The history held **25 lines billed at ₹0 — 1,192.54 kg, ₹16,355.67 at the client's own rate —
across 14 invoices**, mostly General Engineering, with nothing on any of them saying why. **The
owner ruled (24 Sep 2026) they are replating**: returned work is not billed twice.

A ₹0 line with a quantity now **cannot be saved without a reason** — *Replating / Sample / trial /
Other*, a tap each. The note is **recommended, never required**: a one-tap picker gets filled in, a
mandatory essay gets "ok". The history is stamped `replating` **and** `zeroReasonBackfilled`, so the
register can tell a reason the ruling supplied from one an operator chose. The migration is bounded
to invoices dated on or before the ruling — a ₹0 line written later by a device on an older build
reads *No reason recorded* rather than the migration inventing one forever.
