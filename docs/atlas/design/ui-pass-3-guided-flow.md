---
subject: "UI pass 3: every Enter by hand a guided flow (U4)"
domain: design
modules: []
specs: [docs/UI_PASS_3.md]
tests: [P67, P230]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### UI pass 3: every Enter by hand a guided flow (U4)
`docs/UI_PASS_3.md` §11, §26b (owner, 15 Oct 2026: *"The Enter by hand screen is primitive in design, and doesn't engage or leads the
user, increases the learning curve … when I click on Spend and prices, Line items is still the most space taking"*). Design §6.37.
P230 (phone and desktop); the specs that opened Spend and prices' fold open its screen (§21), never weakened.
- **The flow** (`uiFlowHtml`, state.js): numbered steps that lead without hiding, each a lifted card: its number in a node (a tick
  once done), its title a question, what it holds once done (`[data-flow-says]`), *Next* on the first required step not done, a book
  to its guide's section (`invFlowGuide` → `uiFlowGuideGo`: the Reader at the section whose title holds the words), a line of help,
  its fields. **Every step stays open in any order**; a step only filled if needed is `optional` (*If needed*, never Next). Over them
  the progress (*2 of 4 done*, a meter of a segment a step; *Ready to save*, or for a form saved as it goes, `live: true`, *All filled ·
  saved as you go*); beside them where the flow is 52rem wide (sticky), under them otherwise, **the preview** (*What Save records*: the
  record in words and figures from the screen's own functions, then the checks the app already makes as rows in their tone; no live
  region: a screen reader hears one line, `uiFlowSay`, once typing pauses and only when it changed, `uiFlowAnnounce`); after a
  save where the form stays, **the receipt** (`uiFlowReceiptHtml`). A kind is a row of tiles (`uiKindTilesHtml`, keeping its
  `data-action` and data attribute).
- **A flow is a model** (`uiFlowDefine(name, fn)` → `{steps, preview, live}`), drawn once and kept in step by `uiFlowSync`, which
  events.js's last listeners call after every input, change and click: the steps' state and heads, the progress and the preview,
  **never a field**, so the cursor stays. Enter in a field that finishes its step goes to the step Next (`uiFlowEnter`, from the Enter
  chain); a form with its own chain (the challan form, Create, Mine's VAT page) says `data-flow-ownkeys`. A preview that needs the
  book as it would be after the save puts the record in for one reading and takes it straight out (`stockPreviewChecks`, the bill's and
  the cheque's and a payment's before → after, from Receivables', Pay's and the supplier's own ledgers): nothing is saved, and a memo the
  reading could poison is read past (`finCtx`) or cleared (`_suppMemo`). **No id, `data-action`, `data-change` or `data-k` moved.**
- **The forms** (each its model beside its builder): Stock by hand (`stockManualModel`: What · When and the bill · Which lines · Who;
  each line's level before → after and `_stockEntryChecks` on the entry before it is saved); Production by hand (`prodHandModel`; the
  run as it counts by `prodWeigh`; its rounds, *If needed*, saved as a register's batch, `prodHandRounds`); the register photo's check (`prodPhotoModel`); a power cut completed
  (`pcsModel`; its cost as the record stands when opened); Plant shut… (`plantShutModel`); the challan form (`challanFlowModel`) and
  Create (`createFlowModel`; its optional details stay folded until filled, P67's rule, the step *If needed*; the number it takes is
  `createNumberShown`); a hand's day (`attEditModel`, `live`); a payment to a hand (`payFormModel`), a bill (`costBillFormModel`), a
  cheque received (`bankChequeModel`), cash paid out (`cashReviewModel`), a line's shift (`_shiftRowModel`), a supplier's payment,
  balance and quote (`suppPayModel`, `suppBalanceModel`, `suppQuoteModel`); Mine's load, material in, barrel batch, the two rolls and
  the VAT page (faces.js; the group's message in the preview as it will be sent). Mine's own screen was already the step cards and
  panels §11a names, and is unchanged.
- **Spend and prices takes the room** (§11b): an address of its own, `v=spend`. On the desktop the list narrows to a line's name and
  its status (`data-wide-pane`, `--pane-list-narrow`) and the pane takes the rest; on the phone a screen with its way back, its door a
  row at the list's foot where the fold was (`[data-stock-spend-door]`). Its sections are cards on a small board (`inv-spend-board`,
  `#stockSpend`); zinc against the market stays the price trend's card on zinc. `_stockSpendOpen` is retired; Home's zinc door
  (`dashZincShow`) opens `v=spend`.
- **Two stock lines that are one** (§11c): a line's page offers **Merge into another line** (`stockMergeOpen`, behind
  `grdGate('settings')`, asked with the counts): its entries move to the line kept (each keeps `mergedFrom`), its name and spellings
  become the kept line's spellings (`into.mergedFrom` lists it), and it is retired (`mergedInto`, `retiredAt`, inactive), never
  deleted; lines of two units are refused. `stockFindByKey` finds a merged line as the line kept. To-do **`stockTwins`** (the owner's,
  info): two lines whose names fold to one key or are one letter apart in a word of four letters or more (`stockTwinWhy`); it opens
  the merge on the line with fewer entries (of two alike, the newer).
- **A line merged is found as the line kept** (`stockLive`) wherever an id comes from outside the book's own entries: a choice stored on
  a message, a file's line and its quotes, the supervisor's numbered position. A structural pass in `migrateState` (`stockMergedRepoint`,
  after every load, pull, merge and import) moves an entry or a price quoted naming a retired line to the line kept (another device
  that had not merged). `stockTwins` never pairs a first letter changed (Nitric, Citric) or a chemical's ending (nitrate, nitrite), and
  **They are different** on the merge keeps a pair apart for good (`stock.notTwins`).
- **The QA chain** (Iuno, Castor, Vulcanus; P230's *QA chain* tests): a preview is the screen's own reading with the record in, never a
  subtraction (a monthly salary dated by the 20th pays the month before, `payDueAfter`; a cheque already in the bank as its deposit
  moves nothing, `bankChequeOwed`; a supplier payment that clears a statement row or falls before the balance's day, `suppLedgerWith`);
  a power cut's cost only to a role that opens Power and sees money (`pcsSeesCost`); Production's preview names no weighing route Save
  may not take (*weighed at save, from its challans if any are open*); a 6 AM block whose crew are all absent is refused, not dropped
  with its EXTRA; the preview's checks mirror every refusal Save makes (a negative arrears, a blank challan line, an invoice number
  taken, a night with no times, two schedules from one day).
- **A data flow changed**: `sep-stock` carries `mergedInto`, `mergedFrom` and `retiredAt` on its items, `mergedFrom` on its entries
  and the pairs said to differ (`notTwins`, in the book's stock) (soma-internal reads the stock record; said in the PR and NEXT_SESSION).
- The guide *Using the app: stock* is version 6 (Enter by hand, Spend and prices, the merge).
