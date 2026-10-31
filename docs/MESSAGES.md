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

## M4. The Messages screen (msgview.js)

## M5. The confirmation screen (msgconfirm.js)
