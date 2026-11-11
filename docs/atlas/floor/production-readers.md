---
subject: "Production readers: slots as text, the barrel list, the night block"
domain: floor
modules: [split/prodparse.js]
specs: []
tests: [P189, P220, P222]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
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
