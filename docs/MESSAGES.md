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
- **A contract change in msgstore.js**: `msgKey` keys the day and the minute on it (`sentOn@sentAt`; an epoch ms, should one come,
  read as its minute), since `sentAt` is relaySplit's minute of the day: divided by 60,000 it was always 0, so the same words from
  one sender on two days were one message, and a message at midnight had no minute. `msgIngest` keeps `sentAt` 0.
- **Measured on the owner's export** (private, counts only): 324 messages from 3 senders over six weeks, month-first, 101 media
  messages, 4 deleted and 2 WhatsApp lines dropped; against the owner's book, 51 new and 273 older or already held; the same zip
  again, none.

## M4. The Messages screen (msgview.js)

## M5. The confirmation screen (msgconfirm.js)
