---
subject: "Cash paid out and cash with the supervisor"
domain: people
modules: [split/cashout.js]
specs: []
tests: [P252, P261]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Cash paid out (31 Oct 2026)
The supervisor's cash spent for the plant, as he sends it on WhatsApp (`cashout.js`, P252; owner, 31 Oct 2026: *"For Shyam's 1840 - he
has given that as a message in whatsapp"*, then, of where it counts, *"Payout total"*). A line each (a day before some, the amount at the
end), a rule and *ONLY 1840* under them.
- **Read where every message is pasted** (`cashLooksLike`, before Production in `relayRead`; Add describes it, *Read in Pay*): two lines or
  more ending in an amount and a total line (*ONLY*, *TOTAL*); his weekly payment message (PAYMENT, NASTA, …) is a summary and is not.
  `parseCashMessage` is pure: each line's day, what for, amount and kind (`cashCat`: carriage, consumables, repairs, food and tea, paid to
  a person, other), a line with no words asked, a total the lines do not reach red.
- **Reviewed before it is saved** (the review dialog: what for, kind, day and amount a line, editable), behind `grdGate('payments')`, into
  `S.cashOut` (a line each: day, what, amount, kind, the pay week, the message, who) and the message whole in `S.cashPastes`; the same
  message twice is refused by its hash; a line is voided with a reason, never deleted.
- **Counted in the payout** of the pay week it was sent in (`payWeek().cashOut`, in its `total`), said on Pay's verdict and its own card;
  out of the forecast's pace. **On the bank's side** the week's cash is wages up to the payout less it, these costs (other) up to what they
  came to, drawings past both (`bankCostByMonth`, `c.misc`).
- **A data flow changed**: `S.cashOut` and `S.cashPastes` travel with the book (backups, GitHub, the merge; the change log names a line).

### Cash with the supervisor (9 Nov 2026)
Owner, 7 Nov 2026, on the week to 7 Nov (the payout ₹44,152.50, ₹44,500 handed for it): *"347.5 goes to Shyam, and he had 290 due
already = 637 total due - 400 ACI HCl trip = 237 due now"*; then (9 Nov) *"Build the ledger"*. The cash the supervisor holds for the
shop, a running balance (cashout.js, `scLedger`; P261):
- **Handed for it** on Pay's payout card (`S.payHanded[weekStart]`, `payHandedSet`, behind the payments permission): what was given
  him on Saturday for the payout; less the payout as the app works it out (`payWeek().total`) it goes to him, or, where less was
  handed, comes out of what he holds. A monthly hand's wage handed at the same time is a payment on Pay, not part of it.
- **Lines** (`S.supCash`: `set`, `spent`, `returned`, `given`, a day, an amount, a note; voided with a reason, never deleted): a
  balance set is what he holds at the end of its day, and only the lines after the last one count; a spend needs what it was for.
- **Pay → Cash with the supervisor** (`scCardHtml`, `[data-card="supcash"]`): *Holds ₹237.50* (or *Owed ₹X by the shop*), the latest
  twelve lines with the balance after each, and the four doors.
- **The bank's cash split**: a week's cash past its payout, its cash paid out and a monthly hand's wage, up to what was handed over
  the payout, is his float (`c.float`), never the owner's drawings; what he spends from it is other cost in its month, within the
  statement's cover (`other.supCash`).
- **A data flow changed**: `S.payHanded` and `S.supCash` travel with the book (backups, GitHub, the merge; in the change log).
