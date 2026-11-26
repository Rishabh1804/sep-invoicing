---
subject: "Production readers: slots as text, the barrel list, the night block"
domain: floor
modules: [split/prodparse.js]
specs: []
tests: [P189, P220, P222, P264, P277, P289]
updated: 2026-11-26 (the pickling hand's times over their loads; the supervisor's day on the lines, the barrel's out and in: P289); 2026-11-25 (the readers set against the owner's export: P289); 2026-11-17 (the day a line was taught is the device's day, written as a date: P277)
---

### Production typed as text, a slot a line
Owner, 9 Oct 2026: *"When I paste '08/10/26 - / 5 pm - 8 pm - Mehta clamp 165x83(40x6) - 400 nos + Clamp 140/146x91(32x6) - 606 nos =
1006 nos VAT A1 / 9 PM - 4 AM - General 188 CD - 300.4 KG VAT A1' as a production message, the parser refuses to read it … Same for
Barrel and VAT A2."* A message whose lines start with two times (`prodIsRunLog`) is its own kind, **Production by slot**
(`parseProductionRuns`, prodparse.js), checked before power since a slot log can carry a cut: the date line; the times, AM or PM taken
from the other side or from the shop's hours (said, amber, when guessed) and a run past midnight; the line written after the slot or on
a line above it (VAT A1, VAT A2, Barrel and the shop's spellings, `prodLineOfToken`), asked when none; parts joined by "+" (a sum of
one part's figures is one figure); the total after "=" checked and said when it disagrees; a power cut among the slots; a second date
line. Each run is a plated entry on its line and slot (before 8:30 or from 5 PM overtime), basis relay, like the supervisor's block.
P189.

### The barrel list by batch
Owner, 15 Oct 2026: *"our parser cannot read this message"*, of the supervisor's barrel list as written from October (P220). Every list
carrying UNLOAD had been taken for the April log (loads counted "×4" in barrels) and listed, not read. A list with an unload time beside a
figure, or dashed blocks, is now read batch by batch (`parseBarrelBatches`, prodparse.js): a block between dashed lines a batch, its unload
time its end (`to`), written before or after its figures, on its line or the line under ("UNLOAD TIMING" / "4:00 PM"), spelt UNOLD too, and
closing every batch above it in the block that has none; the date between dashes ("----07/10/26/----"); two clients on one line two
batches ("9312-45 KG GAMMA I BOLLT 35 KG", split after a figure followed by a name or a "+"); a client with an unload time and no figure
a batch with none (amber); "OMEGA 1 BERRAL+ GAMMA 1 BERRAL" a batch each, counted in barrels and asked; LOADING TIME and what follows
it listed, never counted (it is counted when the next list unloads it); "----and----" the end; a power cut and its return. A list sent the
next morning reads its times with no help from when it was sent. The April log, with no figure beside an unload and no dashed blocks, is
still only listed. On the owner's lists of 12, 13 and 15 Oct: 20 batches and one cut. **A count in barrels led by a part's code** (owner,
28 Oct 2026, on an entry the reader had taken as one item: a line `0777-3 BERRAL+ KESTREL 65 KG` had read as the first client's 65 kg
under the part "0777-3 BERRAL+ KESTREL", the three barrels counted for nothing): the count before BERRAL is a batch of the client
written before it, or of the group's client where a part's code alone leads it, with no figure, asked (`barrels` on the entry, shown on
its fold and kept by Correct). After the last count: a client's figure is that client's lot; a name the book does not hold, with a
figure, is asked (red), never the first client's, since a spelling the matcher cannot fold would land the lot on them under a part named
after the other firm; a part word with no figure ("NOVA 2 BERRAL NATBOLLT", the shop's older habit) is the counted barrels' part; a
bare figure ("NOVA 2 BERRAL 48 KG") their weight. An entry saved that way before is the owner's to split. P220.

### The night block's production
Owner, 16 Oct 2026: *"Parser is not reading night 8 pm to 6 am, the production below it is usually what was plated on the night shift"*
(P222). The out-time roll's reader keeps each slot it settles on its heading line (`ln.slotFrom`, `ln.slotTo`, relay.js), and Production's
reading of the work under the slot takes them (`prodFromRoll`): a heading that writes both ends ("NIGHT 8 PM TO 6 AM") is the night's whole
span, and the work under it ran 8 PM to 6 AM on the roll's day, on the line headed above it. It had read the heading as the hour the crew
went home: a run ending at 6 AM with no start, dated as a morning. A gauge written after the count ("2700 NOS 25×6") is the part's
(`prodReadItem`).

### A message no reader knows: entered from its text, and taught
Owner, 17 Nov 2026: a paste refused with *"No pickling or production lines found in that text"* *"should lead the app user to enter data
manually, referencing the whatsapp text or pasted text - the parser should learn from it and read messages better next time"* (P264). The
refused text now opens **Enter it from the text** (`prodTeachOpen`, prodview.js): the message as sent, then a row for each line with a figure,
filled from a loose reading (`prodLooseRead`, prodparse.js): a date at the head of a line is the day of the lines under it, a line header
(VAT A 1, VAT A2, berral) their line, a line with no figure the client of the lines under it, the client named at a line's front, the part
and the figure. Every field is the owner's to correct, and a row is saved only with its client, part and figure; Add an entry takes what the
text does not show line by line. The entries are the supervisor's message entered by hand (`src: 'hand'`, `basis: 'relay'`, `taught`), the
message is kept (`kind: 'taught'`) so the same text pasted again is refused, and **each line saved teaches its shape** (`learn.lines`,
`prodTeachKey`: the words as written, the figures masked, with the client line above it where it had one). The next message no reader knows is
read by those shapes (`prodTaughtRead`): a taught line takes the client, part, unit, kind, shift and line entered, said amber (*Read as this
line was entered by hand on 17 Nov 2026*, the day on this device's clock, never UTC's, which put a lesson taught before 5:30 AM in IST on
the day before; P277); a header above it that disagrees with the line entered is asked; the message's other lines are read loosely and
asked. **A message none of whose lines was taught is still not read**, so chatter with a figure in it is never taken for production. The
readers above run first: a lesson never changes how a roll, a list, a slot log or a pickling message is read.

### The readers set against the owner's export (25 Nov 2026)
Owner, 25 Nov 2026: *"Re-read the WhatsApp texts and make sure the parser is working as intended. Some numbering styles don't
work, some text formats are not read properly … I have corrected a lot of those on the earlier parse, manually, compare them and
see what was causing the issue and add those rules or edit them."* Every production paste the book held was read again and set
against what was saved from it, and every message of the group's export read (in the codex; nothing of either is here). The
shapes read wrong now read as corrected (P289; every example below is made up):
- **Sent before 6 AM with no date written**, a load whose pickling time is more than half an hour after the message is the day
  before (`dayOf` in `parsePickling`, said amber, `evebefore`); a time with no AM or PM written there is read as the evening's
  ("Pickling time 10:45", sent at 12:20 AM, is 10:45 PM the day before). It had been dated the day the message was sent.
- **Where a load is going, written straight under its pickling time** ("PICKLING TIME 9:40 / For Barrel"), is where the loads
  that time closed go, those of them with no line yet; when they all have theirs, it is the next block's, as a line written above
  a block always was. A load going to two lines ("VAT A1 &A2", "FOR VAT A1& A2") goes to the first written, and the line is never a
  part (`prodDestOfLine`); it had been saved as a part with no figure. A line written before a load ("VAT A 2 NOVA RING …", the
  load's `dest`) or after a figure with no unit ("…=90 VAT A 1") is where that load is going.
- **A second client named mid-message** with no figure, between a load with its figure and another under it, heads loads of its own,
  asked where the book has no such client; unless it is a part the client above has sent (`partOwners`). It had been read as the
  first client's part and the figure booked to that client.
- **A load with no client under a new block** is not carried from the block above when its part has only ever come from another
  client: `prodOwnerFill` reads it as that client, amber.
- **A time after the part** ("BIG RING--1:25PM") is the load's own pickling time. A time needs its colon or its AM/PM: "HOOK--12.50"
  is 12.5 kg, never 12:50.
- **Sizes joined by "="** ("52×64=20×5=120 NOS") read as "52×64(20×5)--120 NOS" (`prodReadItem`). A pickling time line with the line
  before it and a load after it ("VAT A 2 PICKLING TIME 2:40 PM NOVA RING 52×64=20×5=120") gives both.
- **A numbered barrel list** ("1) UNLOAD TIME 8:50 AM …", "2) 11:10 AM UNLOAD" over its batch): the number is no part
  (`prodUnnumber`). In a list that writes its times over its batches (a numbered list, or one whose last unload time alone on its
  line has a batch written under it), an unload time alone with nothing above it waiting is the time of the batches under it, up
  to the next unload; a list that writes each time under its batch reads as before. "BERRAL UPDATED" is the list's heading.
- **The supervisor's day on the lines** (26 Nov 2026; `parseVatOpening`): "OPENING TIME 7:10 AM PICKLING VAT A 1" heads a line's work
  from when it opened; a client alone heads the lines under it with its part's family; a line holds several loads, each a size
  and its count ("52×64(20×5)=120 NOS 48×57=(20×5)=75 NOS"); a client written with its own load and "TIMING 9:05 AM" is that load's
  alone; a word after the last count is that line's family; "1 ROUND 12 MINUTE" is said, never counted. It had been sorted as no
  report and nothing read. **The barrel's out and in** ("BERRAL OUT TIME 8:50 AM …" / "IN TIME 9:05 AM"): out is the unload, in the
  load, read as the batch list reads them; it had been sorted as the out-time roll (`relayKind` now leaves a barrel's or a line's
  head, or a head with a count, to production). In a list whose first unload writes its time before its figures, that time heads
  the lines under it; a client written after a line's last figure ("… 19 KG GENERAL") is that line's; a part written after the
  count ("DELTA 310 NOS ANCHOR BKT") is the part.
- **The pickling hand's times written over their loads** (26 Nov 2026; `parsePickling`, `prodPickSegments`). A pickling time with
  nothing listed above it heads the loads under it ("VAT 2 PICKLING TIME / 4:10 PM / 52×64(20×5)=150 NOS"): each takes it as its own
  time and the line written with it, up to the next time, an incoming block or a line heading. Under a time that closed loads above
  it, the loads under it wait for the next time, as they always did. The clock may sit on the line under the time. A line holding
  several loads ("48×57(20×5)=120 NOS 44×57(20×5)90 NOS PICKLING TIME …") is cut after each load's figure where another load or a time
  follows; a figure after a figure ("240 NOS 12 KG") stays with its load. Before the time, a client heads the loads under it ("NOVA
  PICKLING TIME 11:40 AM") and a load is one of its own, its figure the one after the clock ("DURGA 77 CD PICKLING TIME 4:40 PM 400
  NOS"); between the time and its clock, a client and a family ("PICKLING TIME NOVA RING 1:00 PM 40×57(20×5)60 NOS"); after the clock
  with no figure, a line and a client ("PICKLING TIME 3:40 PM VAT A 1 DURGA"). Loads written before a time on their own line, where
  the time has none of its own, are that time's ("… HOOK 60 NOS VAT A2 PICKLING TIME 9:05 AM"). "PICKLING TIMES" is the time. Set
  against every paste and every message of the export: eleven reads changed, each a load that had been dropped, timeless or run
  together, none that had been right.
