# Messages: every WhatsApp message kept, read, corrected, imported

Owner, 31 Oct 2026: *"We need the pasted whatsapp message to be stored in the app, so that we can read the message in the app and
make changes and the app can learn what it got wrong"*; then a WhatsApp zip read in the app, every new message sorted and a final
confirmation screen; *"One group chat"*; *"analyse every bit of chat data from the zip … and profile how they send messages, so
that the parser keeps evolving with future uploads of zip files"*; production *"Always"* waits for a tick, *"but repetitive work
must be designed better"*.

The contract every part builds to is the head of `split/msgstore.js`.

## M1. The record and the sorter (msgstore.js)

## M2. How each sender sends messages (msgprofile.js)

The owner: *"analyse every bit of chat data from the zip that we have and profile how they send messages, so that the parser keeps
evolving with future uploads of zip files."* P253.

**The analysis** (private: the export and the book never enter the repo, and the findings with names are the owner's alone). The
group's export, 16 Sep – 31 Oct 2026, split by the app's own `relaySplit` into 345 messages from four senders, each run through
`msgSort` and every reader (the roll reader with the book's roster, production, stock, cash, the check-in). In counts:
- **Sorted to a reader: 316 of 345 before the tuning, 317 after**; of the 328 with any content (not an album, a document, a deleted
  message or the chat's own notice), 316 and 317. Against labels made by hand, msgSort agreed on 340 of 345 before and 341 after;
  of the 319 that are reports, 315 and 316 reached their kind. The 'other' given a reason went from 0 to 26 of 28.
- **Two of the four senders report**, each in a family of its own: the pickling hand nearly only loads, between 9 and 4 on working
  days; the supervisor the two rolls, the stock message, the barrel list and the weekly payment, the rolls opening on a dated head
  (`date · in time`) and most carrying their slot's production under the line. The other two send photos, documents and a word.
- **Shapes found**: a roll's date written with spaces or after a word ("Sunday duty DD/ MM/ YY/ in time"); a roll heading inside a
  short sentence that corrects an earlier roll's date; a chemical use with no head (chemicals in kilos and litres); a production block
  sent apart from its roll; a load and a time with no "pickling time" written; a chemical delivery with no figures; a dated notice that
  the plant is off; photos with a caption (a part weighed); conversation; the barrel list's head changing from "production" to "update".
- **No edits** reach an iOS export (no edited marker in it), and its system lines carry no sender (M3 drops them).
- **Found on the way**: `msgKey` divided a paste's minute of the day by 60,000, so the same words from one sender on two days keyed
  alike and the second was dropped as seen (16 of the 345). Fixed: a minute of the day keys with its day.

**The tuning** (msgstore.js; shapes only, never a name): media, deleted messages and the chat's notices are Not read with what they are
and `conf` 0.95 (for 'other', `conf` is how sure the sorter is that nothing in it is for a reader); a dated roll however its date is
written is 0.95; a roll heading inside a sentence of three lines or fewer is kept as the paste box reads it, at 0.35, *reads like a note
about a roll*; what no reader takes says what it is and, where it looks like a kind, `like` (production, pickling, stock). **One rule at
the readers' level**, in relay.js, so the paste box and the sorter agree by construction: a message whose every line is a figure in
kilos or litres, a chemical named, no pieces and no clock time, is a stock message (`relayIsChemList`); Stock's own check then says
what it could not place.

**The profile** (`S.msgProfile`, learnt from `msgStore()` alone; derived, so rebuilt wherever it does not match the store):
- `mpLearn()`: per sender, the kinds, the hours and weekdays of each, how each opens (`mpShape`: "date · out time", "words", a photo or
  file), its lines, the spellings of the shop's words (in time, out time, chemical, pickling time, power cut, barrel, incoming,
  production), a report carried on in the next message within 20 minutes, a roll carrying another kind, the messages later corrected
  (`fix`, `textWas`), Not read and media. A memo: nothing is read again while the store and the book are as they were; a message added
  is folded in; a correction reads the store again. Safe on an empty book.
- `mpConf(m, out)`: from eight messages on, a sender's usual kind is raised (*usual for …*, *opens as … usually opens it*) and one they
  have never sent, an unusual hour, an unusual opening or length, or a kind of theirs often corrected is lowered, in words added to
  `why`. Not read from somebody who nearly always sends one kind takes that kind as `like`. A kind set by hand is never moved.
- `mpKindConf(kind, sender?)`: the share of the kind's messages of the last 60 days read with no correction, null with none; the
  confirmation screen sets it against 90%.
- `mpSender(name)`, `mpSenderHtml(name)` (a flush panel of fact rows, the blank state under eight messages) and the action
  `invMsgProfile` (`data-sender`), which opens the card in a dialog.

## M3. The WhatsApp export (wazip.js)

Owner, 31 Oct 2026: a WhatsApp zip read *"like we do here on this chat"*, for the app's one group chat; the first import *"from the
last message of each kind the book already holds"*. P254.

- **The zip** (`wzZipList`, `wzUnzip`): read with xlsx.js's own directory reader (`_xlsxZipDir`, which now also keeps an entry's
  size unpacked, `usize`) and its inflate (`_xlsxInflate`, the browser's `DecompressionStream('deflate-raw')`, factored out of
  `_xlsxPart` with its behaviour unchanged). Stored and deflated entries alike. **Which text is the chat** (`wzChatEntry`):
  `_chat.txt` (an iPhone's export), then `WhatsApp Chat….txt` (an Android's), then the largest `.txt`; a `.md` only where the zip
  has no `.txt` (the owner's tool writes the chat as both). Every other entry is media: counted, never read. **Refused, saying why**:
  a zip with no chat text, a file over 50 MB (*export again with Without media*), a chat with no message line.
- **The chat** (`wzParseChat`): a message's own line is iPhone's `[10/28/26, 11:32:38 AM] Name: text` or Android's
  `28/10/26, 11:32 am - Name: text`, 12- or 24-hour (a narrow space before the am included); without the bracket the dash is
  required, so a floor message's own `28/10/26 10:30 power cut` stays inside its message. Every other line belongs to the message
  above it: **a message is kept whole**, blank lines and all (the paste box splits one at a second roll's dated head; the export
  never needs to). **Day-first or month-first is decided once for the file** (`wzDateOrder`): a first figure over 12 is a day, a
  second over 12 is a day; where neither (or both) says, the order the dates run in; where nothing tells them apart, an iPhone's
  bracketed export is month-first and anything else day-first, as the shop writes dates. The import says which and why.
- **Dropped and counted**: WhatsApp's own lines (no sender, or a sender holding a quote: the chat made, added, left, the subject
  changed, end-to-end encryption; on an iPhone the group's own lines under its name, their text opening on an unseen mark),
  media (`<Media omitted>`, `<image omitted>`, `<album message>`, `<document omitted> file.pdf`, `IMG-….jpg (file attached)`,
  `<attached: …>`; a caption after the marker is kept as the message), deleted messages, and the export's own first line.
  `[Forwarded]` is taken off a forwarded message's words; `<This message was edited>` is taken off and the message marked edited.
- **The shape**: relaySplit's, `{ sentBy, sentOn, sentAt, text, edited, wa }`, `sentAt` the minute on `sentOn` as relaySplit gives it.
  On the owner's export the two agree on every message's sender, day and minute, in order.
- **The new ones** (`wzCut`): each message is sorted (`msgSort`) and is new when sent after **the latest of its kind** in the
  Messages record and in its kind's own store (`wzAnchors`): rolls, `S.relayPastes` (its `sentOn`/`sentAt`, else the roll's day);
  production, `S.production.pastes` and the entries they made (and those read from the relay or the pickling hand); stock,
  `S.stock.pastes` (the message's window); cash, `S.cashPastes`. **A record that keeps only its day counts from that day's start**,
  so the whole day is read again rather than a message lost to a guessed minute; and a message whose words a store already holds
  is skipped as already in the book (`inBook`). A kind the book holds none of is taken whole, and the import says when the book
  held no message at all. Older messages are skipped and counted, per kind (`kinds`).
- **Taken in** with `msgIngest(fresh, 'zip', id)`, the import recorded in `S.msgImports`
  (`{ id: 'WZ-…', at, by, file, chat, first, last, total, added, seen, skippedOld, inBook, media, system, deleted, order, orderWhy,
  none, kinds }`) and saved; then the confirmation screen, `mcOpen({ importId })` where M5 is loaded, else a toast with the count.
  Nothing new is said in a dialog. **The same zip twice adds nothing**: its messages are the book's by then.
- **The gate** is the floor's imports' (`ADD_FILE_GUARD.whatsapp`, `grp: 'imports'`), asked before anything is read.
- **The doors**: Add → File takes a zip holding a chat (told by the chat entry, never the extension: an `.xlsx` is a zip and still
  goes to the bank) and a bare WhatsApp `.txt` export (`addFileKind` → `wazip`, `addTextKind` → `watext`, `addFileWhat` →
  `whatsapp`); another screen's Import handed one says what it is and offers **Import it there** (`addFileElsewhere`). The
  Messages screen's own Import can be a button `data-action="invMsgZipPick"` (`wzPick`, routed through `msgAction` → `wzAction`).
- **msgKey** (M2's change, made the same in this branch so the two merge cleanly): a minute-of-day `sentAt`, which wazip gives
  as relaySplit does, is keyed with its day (`sentOn@sentAt`); an epoch ms as its minute. Before it, the minute alone made the
  same words from one sender on two days one message. `msgIngest` keeps a `sentAt` of 0 (midnight), which it had made null.
- **Measured on the owner's export** (private, counts only): 324 messages from 3 senders over six weeks, month-first, 101 media
  messages, 4 deleted and 2 WhatsApp lines dropped; against the owner's book, 51 new and 273 older or already held; the same zip
  again, none.

## M4. The Messages screen (msgview.js)

## M5. The confirmation screen (msgconfirm.js)

`mcOpen({ importId } | { ids })` opens the final check over a set of `S.messages` records (P256). The zip reader calls it with its
import; anything else may call it with the records' ids.

- **A full layer**: a sheet on the phone, wide on the desktop (`inv-mc`), its list scrolling under a foot that stays and counts
  (*38 of 52 ticked · 6 to look at*). Once anything is ticked or a hand's answer changed, leaving asks first (`dialogLeaveOk`).
- **Grouped by the day each message reports** (a roll's date, production's day, the stock message's last day, else the day it was
  sent), then by kind in the floor's order: in-time roll, out-time roll, pickling loads, barrel production, production by slot,
  power, stock, cash, check-ins, the weekly payment summary, Not read.
- **Each message read by its own reader, nothing saved** (`mcRead`): a roll by `parseRelayRoll` (present, half, absent, the EXTRA on
  the 8:30 shift, the blocks, a day at a time); production by `parseProdPaste` and `prodReviewResolve` (each load, run or cut); stock
  by `parseStockMessage` and `resolveStockParse` (each line and what it comes to); cash by `parseCashMessage` (each line, the total).
  Beside it: its red questions, how sure the sorter is against 90% (`mpKindConf` where msgprofile.js has it, else the record's
  `conf`), and whether the book holds it already by the readers' own refusals (the roll's hash in `relayPastes`, `prodPasteSeen`,
  the stock message's hash with a live entry, the cash message's hash): those are left out and said, and so is a message the same
  set holds twice. A message read with each reader's own WhatsApp line in front of it (`mcWaText`), so the sender and the minute
  are read as the paste box reads them.
- **The ticks**: a roll, a stock or a cash message at 90% or more with no red question comes ticked; the rest waits. **Production
  always waits**, and is quick to tick: a day's loads are one summary row (how many, whose, the pieces and kilos) that opens to them,
  with one button for the group (*Tick the 6 pickling load messages of 28 Oct*); each production message offers *Tick every
  production message like this one* (the same sender, the same kind, no red question, any day); on the desktop ↑ and ↓ move
  between the messages and space ticks. A message its reader cannot save from here (a red production question, a cash line that
  says what it was for nowhere, no date, check-ins with their own checks) offers **Open its review**; Not read offers **Open in
  Messages** (`mvOpen`, where msgview.js has it) and **Not a report** (status `skipped`). The weekly payment summary is shown, never
  saved.
- **Marks typed by hand** (relay.js, both here and in the ordinary paste review): a mark the roll would change is asked about hand by
  hand, **Use the message** or **Keep what was typed** (the default), and *Use the message for all N*. `relayPlan` works out what the
  roll would write over a typed mark (`roll`, read over the day as a mark the rolls wrote is) and whether it differs (`differs`);
  `relayApplyPlan(rv, plan, { useMsg })` writes the roll's mark (`src: 'relay'`) where it is used, and the marks as they were go to
  the log a day at a time (`S.attendanceDeletes`, `how: 'override'`), which History says. The night and Saturday 5 PM rules are
  untouched.
- **One save** (`mcSave`): the guard asked once for the batch (the floor's entries; the cash's PIN, `payments`), then the ticked
  messages through each reader's own save with no review on screen: the rolls in one reading, by day and the in-time roll first
  (`relayPlan`, `relayApplyPlan`; the spellings read as somebody remembered, as the paste's Save does); production in one reading in
  the order sent (`prodReviewResolve`, `prodSaveCore`, factored out of `prodSaveReview`; a message a question of the whole set makes
  red is left to its review and the rest read again); stock a message at a time (`stockCommitPaste`); cash as its review saves it
  with nothing changed (`cashSaveCore`, factored out of `cashReviewSave`). Each message saved is marked (`msgMarkSaved`: `relayPastes`,
  `production.pastes`, `stock.pastes`, `cashPastes`); one left unticked stays `new`. Then the summary: saved, left out (saved before),
  left to look at (each with Open in Messages), and what changed on each day (marks, the marks over what was typed, EXTRA rows,
  production and stock entries, cash lines).
- **The same as the paste boxes**: P256 saves a made-up chat of two days (rolls, pickling loads, stock, cash) here and through the
  four paste boxes, and the books are the same.
