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
