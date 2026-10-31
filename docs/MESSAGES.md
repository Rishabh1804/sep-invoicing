# Messages: every WhatsApp message kept, read, corrected, imported

Owner, 31 Oct 2026: *"We need the pasted whatsapp message to be stored in the app, so that we can read the message in the app and
make changes and the app can learn what it got wrong"*; then a WhatsApp zip read in the app, every new message sorted and a final
confirmation screen; *"One group chat"*; *"analyse every bit of chat data from the zip … and profile how they send messages, so
that the parser keeps evolving with future uploads of zip files"*; production *"Always"* waits for a tick, *"but repetitive work
must be designed better"*.

The contract every part builds to is the head of `split/msgstore.js`.

## M1. The record and the sorter (msgstore.js)

## M2. How each sender sends messages (msgprofile.js)

## M3. The WhatsApp export (wazip.js)

## M4. The Messages screen (msgview.js)

Owner, 31 Oct 2026: *"read the message in the app and make changes and the app can learn what it got wrong"*; *"Both"* to editing a
message's text and correcting its reading. P255 (both layouts).

- **Every paste is kept.** The one paste box (`relayRead`: Add → Paste, People → Paste message, Home) runs `mvKeepPaste(text)` first:
  `msgIngest(relaySplit(text), 'paste')` and a save when anything is new, whatever the reader then does. A reader's save marks the
  messages it saved (`mvSavedFrom(store, records)`, one line before each save: `relaySave` → `relayPastes`, `prodSaveReview` →
  `production`, `stockSavePaste` → `stock`, `cashReviewSave` → `cashPastes`); a message is found by its key, else by its words (and its
  day and sender where both say one). Nothing a reader reads or saves is changed.
- **The key's minute** (`msgMinuteOf`, msgstore.js; a contract change, said in the PR): a paste's `sentAt` is minutes into its day
  (`relaySplit`), an export's may be ms. Read as ms, every paste fell in the first minute of 1970, so one sender's same words on two
  days were one message and the second was never kept. Both forms now give the same minute.
- **The screen** (`pageMessages`, a top-bar tool beside History and Knowledge, in no workspace; the owner's, as the guard stands, since it
  holds cash paid out among the rest). Its verdict (messages, Not read, a red question, saved; *How sure, by kind* folded under it:
  the profile's figure where msgprofile.js gives one, `mpKindConf`, else the share of a kind's messages saved with no correction against
  those corrected), one toolbar row (the search; Filter by kind, sender, status and day; More: *Read every message again*), the list
  by day (sender and time, the first line, the kind and the status as a dot and a word), the first thirty and the rest one tap away.
  On the desktop the list sits beside the open message (`mvHost`, History's pattern, `paneScrollKeep`); on the phone a message is a
  sub-view with its way back. The address names it: `?tab=pageMessages&id=MSG-…`.
- **One message** (`mvOpen(id)`): when and who (with `mpSenderHtml` where it exists), its kind with the sorter's confidence and why,
  its status; its reader's questions; each line beside what its reader read it as (`mvRead`: `parseRelayRoll`'s lines and issues,
  `parseProdPaste`'s items and notes, `parseStockMessage` through `resolveStockParse`, `parseCashMessage`), a line no reading covers said
  as *Not read*; the records it made, with the way to them; its edits.
- **Edit the text, then Read again**: the reading before and after set side by side (`mvDiff`: lines matched by their words in order, a
  line whose reading moved is changed; records by what they are about), shown before anything is saved. Save keeps the old text in
  `textWas` and sorts the message again. **A message its reader saved is read again only in that reader's own check** (*Read again in
  People*, `mvHandoff`: `relayOpen` + `relayRead`, `prodOpenPaste`, `relayOpenStock`, `cashReviewOpen`, with WhatsApp's line in front so
  the reader reads who sent it and when); the paste box keeps the handed text as the message it is, not a new one. The book is never
  written from here.
- **Correct the kind** (`fix: {kind, at, by, was}`, which wins over the sorter, M2 reads it) or mark it *Not a report* (`skipped`).
- **What the app has learnt from your corrections** (a fold under the list): each kind set by hand, and the roll reader's heading and
  slot lessons (`S.relayLearn`), each with Forget.
- **Read every message again** sorts every message again and lists what moved; the messages' kinds move with it, and no reader's record
  is written.

## M5. The confirmation screen (msgconfirm.js)
