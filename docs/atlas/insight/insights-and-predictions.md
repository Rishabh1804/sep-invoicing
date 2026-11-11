---
subject: "Insights and predictions"
domain: insight
modules: [split/insights.js]
specs: []
tests: [P81]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Insights and predictions
Parts three and four of the intelligence engine (owner, 25 Sep 2026). `insights.js`.

- **An insight is a To-do rule.** It has the same shape as an app task (tone, figures, what to do, what
  clears it, a snooze against its figures), so it reaches the To-do list, the Home card and the Windows
  widget with nothing new (Stats → Overview → Insights listed them all until the tab map; they are Needs you's tasks). Each can be switched off in
  Settings → Checks & alerts → To-do. There are eight:
  - **a client gone quiet** — judged against its own rhythm: overdue once its gap passes both 1.75× its
    median gap and median + 21 days, with 5+ challans and ₹20k+ in three months. Red at 10%+ of the book;
  - **the month realising below every one of the six before** (after 5 working days), naming whose share
    moved;
  - **a client's billing down three full months running** (₹30k+ at the start, 25%+ fall);
  - **a client realising 5%+ under its own median ₹/kg** (₹0 lines, a changed rate, or the mix);
  - **a large account (10%+ of tonnage) below its variable cost** last month, at the live cost;
  - **measured labour 20%+ from the model**, only where 90% of days are recorded;
  - **last pay week with no attendance**;
  - **stock lines used in 30 days with no price**.
- **Predictions**, each saying what it rests on:
  - **This month at its pace** (a Home widget): revenue and tonnage per working day so far × the month's
    working days, a band from how much those days varied, and unbilled challans in hand.
  - **Next challan expected** (Clients): each client's median gap after its last challan; late past it,
    quiet past the rule above.
  - **Invoice PO and vehicle.** On choosing a client for a new invoice, an empty PO field takes the next
    number **only where the client's POs run in sequence**. Where they rise but skip (a customer numbering
    across all its suppliers, its P.O.s rising a few numbers at a time), only the prefix is filled and the hint
    says so. An empty vehicle field is filled **only where one vehicle carries 60%+** of the client's last
    30; otherwise the usual ones are offered as chips and nothing is typed.
  - **A client's own vehicle and PO win over the prediction** (owner, 27 Sep 2026: *"[A client] generally is
    despatched through only one way of transport … the field is already filled out along with PO number, which is
    usually the same as their challan number with [their prefix]"*). Measured on the book: one vehicle on
    nearly every invoice of that client, and the PO equal to its prefix + the challan number in five digits on nearly every one
    carrying a PO — a PO *made from the challan*, which is why the sequence prediction only ever found the prefix.
    So it is a **client setting**, never a hard-code: `defaultTransport` and `poFromChallan`, a pattern where
    `{challan}` is the challan number and `{challan:5}` the same padded to five digits (`clientPoFromChallan`,
    state.js: the first cited challan, its first run of digits, so `0877/26-27` gives `QX1/00877` under the pattern `QX1/{challan:5}`). Edited on the
    client (*On every new invoice*, with a live example; a pattern without `{challan}` is refused). Every path to a
    new invoice applies them (`createApplyClientDefaults`: choosing the client, ticking a challan, IM → Create
    invoice, a reissue, a client preselected from Stats), **only into a field that is empty or was itself filled
    that way** (`invoiceForm._auto`): a typed value is the operator's for good. An auto PO follows the challans
    ticked (the first one's number, and the hint says *the first of N challans*), and a challan number typed by hand
    moves it in place. The hint says where it came from (*from <the client>'s settings*). Where a client has one,
    insights.js does not predict that field. A once-only migration (`_clientDocDefaults1`) set both on that client where both were empty;
    it came out on 22 Oct 2026 with the build's other client data (HR-10), and a book it ran on keeps the settings.
  - **The P.O. date follows the challan date** (owner, 27 Sep 2026: *"we have to enter the PO date, which is
    redundant as almost always it's the same as challan date - that field should be prefilled as it's not
    printed on the invoice"*). Picked by hand, filled from the challans ticked, or IM → Create invoice, the
    challan date carries the P.O. date with it (`createSyncPoDate`, create.js) until a different one is typed
    (`invoiceForm._pdTyped`); clearing it, or typing the challan date, hands it back. An invoice opened for
    editing keeps a P.O. date that differs from its challan date. The field says which (*Follows the challan
    date · not printed on the invoice*). P81.
