---
subject: "Production"
domain: floor
modules: [split/production.js, split/prodview.js]
specs: []
tests: [P85, P90, P122, P198, P214, P258]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Production
Floor → **Production** (owner, 28 Sep 2026: *"This will give us a clearer picture of what's
actually happening in the plant daily"*). What each line (VAT A1, VAT A2, barrel) plated each day, pickling as a stage
before it, and **material in the plant two ways** — by the book and by the floor. `prodparse.js` reads the messages
(pure), `production.js` holds the store and everything derived from it, `prodview.js` draws the page (`vision.js` read a
register photo until 13 Oct 2026, below). **Owned by `soma-internal`, like stock** (owner): a view and an input; Entries → Export writes
`sep-production` v1 whole (with the power causes its cuts name, `powerCauses`), Import merges by id and never overwrites.

- **Three voices, three doors.** The pickling hand's loads (*"SSS MEHTA / CLAMP133×83(35×6)-774 nos / PICKLING TIME
  9:00AM"*, incoming material under its own head) and the supervisor's barrel list and a roll's `----production----`
  block come through **Paste message** — Production's own, or the one box on Home and Staff, which sends them here and
  keeps a roll's attendance exactly as it was (P90 compares the saved day with and without a block). The register
  clerk's **VAT register page** is typed as written on Mine (the faces, below) or entered by hand; **its photo, read by
  Gemini, came out on 13 Oct 2026** (owner: *"it simply never works, so it's better we take that off, it's waste"*), and
  the runs photos read before then stay in the book. A day not come is refused (the date's max is today), and Lines' › stops at
  today; a past day with no attendance and no run reads *No record this day*, *Did not run* only where the marks put nobody on the
  line. Every message is shown beside
  what was read before anything is saved (Stock's contract); the same message is refused, unless every entry it made was
  voided.
- **The record is events** (`S.production.entries`: arrived / pickled / plated / downtime), stored sparse. A figure is
  corrected by a new entry that names the old one (`replaces`), never edited; a wrong one is voided with a reason.
- **A past day is corrected where it is checked** (owner, 10 Oct 2026: *"we can check, its just not in the production tab, it is in
  the day tab but corrections and comparisons are missing"*). Floor → Overview's line card opens Production → Lines on its line and day,
  and there each run and pickling load opens to what it holds, its Correct and its Void (`prodEntryFoldRowHtml`, Entries' phone
  fold, on both layouts); a correction goes back to that day. Enter by hand from Lines starts on the day stepped to (a fresh Lines
  shows the last recorded day, and a new entry there is today's) and on its line. Entries opens on a day (*A day* in its Filter;
  Lines' More, *Every entry of this day*): every entry of it, whatever its kind. P198.
- **One figure per line and shift.** Per (day, line, general | overtime) the register counts, else the supervisor's
  relay, else an entry by hand; the others are shown **also reported**, never added — they count the same work a
  different way. On a day with the supervisor's whole-day barrel list, the roll's barrel OT blocks are *also reported*
  beside it (the owner could not say which the list covers: recorded as unknown, and kept so on 13 Oct 2026: *"This issue
  should be resolved once we have separate apps for everyone on the floor"*).
  **A hand run of a client the day's register never names on its line is other work and counts beside it** (owner, 4 Nov 2026: a
  client typed by hand sat under *Also reported, not added* on a shift whose register page never named it, and could not be moved;
  `prodCountPlated`, P258). The clients named are the day's and the line's, over both slots and the barrel's day list (a register run is
  split at 5 PM), matched by id and by name (`prodCountNameKey`: a firm held twice, a run read under another record); a shift that
  no register or message covers is filled by its hand runs, as before, whatever clients the day names. A hand run of a
  client named stays also reported (the same work told twice); so does one naming no client, and one beside a register run read with
  no client of the book (*unsure*: it may be that work). A correction of a hand run is judged as the run it replaces. **A run of the
  supervisor's message of a client the register never names on the line that day waits for the owner's approval, then counts** (owner,
  5 Nov 2026: *"Wait for approval and then added towards plating"*; the review's L-9): matched against the register's clients alone
  (a message naming the register's client, or no client, is the same work, outranked as before), *to approve* on its row, a group of
  its own on Lines (*Waiting for your approval, not added*), Entries' *To approve* flag, To-do `prodApprove` (the owner's, 30 days, a
  day a task); **Count it** approves, **Leave it out** settles it out. A shift the register does not cover counts its message as
  before. **The owner's
  word on any run wins**: **Count it**, **Leave it out**, **Back to the rule** (`countSet: {how, at, by}`, `prodCountSet`, the voids
  permission, kept by a correction); it can count a barrel OT block beside the day's list too, the one exception to the ruling of 13 Oct
  2026. A run's fold and pane say why it counts or not (`prodCountWhyText`). **A register run saved from two sources is flagged, never
  dropped** (`prodRegisterTwins`, Vulcanus's audit the same day): one day, line, unit (barrels side by side are two runs) and client,
  the same figure and unit, times that overlap (touching is not overlapping; a night on the night's clock), from two different pages,
  photos, messages or imports (one import's rows one source; a correction its root's). Copies cluster (two photos and a page are
  three); *saved twice?* on each row, Entries' *Saved twice* flag, Lines' note that the figure and efficiency read high, To-do
  `prodTwice` (the owner's, 30 days, a day a task, the pieces counted twice). Until settled the copies after the first saved are left
  out of the 60-day measures (the pace, a tank's load: `twinSkip`), never out of the day's figure. Void the copy, or **Two runs, keep
  both** (`twinOk: {ids, at, by}`: kept apart from each copy it was paired with, written as roots so a correction keeps it; Cipher's
  Edict V). History names both words (*counted by hand*, *kept as two runs*). **A data flow changed**: `countSet` and `twinOk` travel
  on the entries in the `sep-production` export (NEXT_SESSION).
- **A pickling message never names the line.** A load's line is read from the plating it became (the same part, the
  same day from half an hour before, or the next working day before noon), shown and **never stored**; a load with no
  plating offers the part's **usual line** (5+ days at 80%+, learnt only from lines written or set, so the pattern
  cannot feed itself) as a chip the owner taps. A load naming only the kind and gauge (*"CLAMP(40×6)"*, over half the
  loads since August) is matched at the family level; **a named part only ever matches its own challans** (CLAMP 90X81
  was once set against CLAMP 165X83's).
- **The register** is a transcription, never a reading — times, rack arithmetic, the START rule (a START takes the next
  round's figure, the owner's rule of 26 Jun), the day's total, are this app's, in code (`prodFromRegisterRead`: a page
  typed on Mine, a file, and the photos Gemini read until 13 Oct 2026). **A struck row is asked each time** (owner): red
  until counted or cancelled. A rack size never seen for the part on that line is amber. A photo read before 13 Oct 2026
  kept only facts (hash, size, model and prompt version, the date and line read, the row count), never the image.
- **In plant.** **Book** = Σ the open share of every challan line (`imLineOpen`), the same figure as Home's unbilled.
  **Floor** splits each open line into *waiting to pickle*, *pickled, not plated* and *plated, not invoiced*, setting a
  part's plating and pickling against its challans oldest first — and **a line billed whole is closed on its last
  invoice's day**, so a plating recorded after it is of other material (without that, April's challans took this week's
  plating and this week's read as waiting). The waiting figure is **withheld below 90% of line-days recorded**, and says
  why. Rework counts as work (plated kg, capacity, labour ₹/kg), never as billing (owner).
- **A challan received by the kilo is counted in pieces** (owner, 28 Sep 2026: General Engineering and the other kg
  clients send kilograms, the floor counts pieces, and *"as we know the weight/pc it should be calculated"*). The pieces
  are worked out from the part's kg per piece (`prodKgPerPiece`: the client's own card, then part weights, then the
  Items Master for a part held by one gauge; a kilo line that also counts its pieces uses its own kg ÷ pieces first), and
  every floor entry is set against a line **in the unit the line is shown in**, a kilo figure for a counted part
  included. The row says *100 kg ≈ 400 NOS at 0.25 kg/pc (client card)*, each client's head says how many lines were
  worked out, and a line with no weight known stays in kg and is named with where to put the weight. Before this a
  kilo line with no count took none of the floor's piece counts, which all read *on the floor, no challan open*.
- **Linked in.** *The period in figures* (a Home widget; Pulse's *In one line* until UI pass 3, Stats → Overview's until the tab map) gets *Plated (floor)*, only on **complete days** (attendance recorded and every
  staffed line with a general-shift record), never a zero. Lines shows labour ₹/kg by line: variable labour of the
  line's areas over the same days as its kilograms, the VAT side's pickling hands shared by each day's kg, uncoloured: the modelled
  labour is every tier's, the monthly crew included, so it is no benchmark for the variable part (QA chain, P214). Two To-do
  rules, both blind to imported history and rework: **plated, not invoiced** (amber at 3 working days, red at 6,
  Settings → Checks & alerts → To-do) and **pickled with no open challan** (amber after a day, red at 3; a client not in the book is its
  own task).
- **Scored, 28 Sep 2026, and short of the plan's targets — said so.** Instrument: the parser over the two real chat
  exports in `soma-internal/data/raw/relays/` (12 Sep Android, 23 Sep export tool; 1,310 messages), in a scratch harness
  never committed. Every message classified (pickling 647, roll 203, production 78, power 35, stock 99, other 248), none
  dropped; 1,604 loads and runs with a quantity, 331 without; 184 rows red on the client, 143 of them with no client
  written at all (they ask, as they should). Against the hand-kept `operations/pickling-input-log.md` (310 rows,
  19 May – Jul), on the 235 whose figure is in the text export (75 were read from photos): **quantity found 215 (91%),
  time exact on 207 of those (96%), client agreeing on 203 (94%)** — against targets of 95–97%. What is left is mostly
  the log's own work (several lines summed into one figure, a time taken from a later message), but that is a reading of
  the misses, not a measurement. Two slips found and fixed on the way: a PM written for a morning load posted at 9:28,
  and an AM written for an afternoon one (*"2:00am"* posted at 3 PM), both now read from when the message was sent and
  flagged.
- **The register as it is really kept** (photos of 16–26 Sep 2026, owner). The first reader was built without a page
  in hand, and the pages broke it three ways:
  - **VAT A2 writes START and END, and the END carries the batch** ("96×7+5", "3×144", "46+48+34"). The first build
    counted START as a round of the next figure, the rule for A1's round-by-round pages, and **doubled every A2 run**
    (1,930 for a page that says 1,145). The rule now applies only to a page with no END row.
  - **Figures are written as sums and products** and are added up in code (`prodRegisterQty`).
    "3+4×156" is racks counted in two goes: read as 7 × 156 = 1,092 (**confirmed by the owner, 28 Sep 2026**), with the plain-arithmetic 627 said beside it as info, no longer a warning.
  - **The register keeps a power log** ("Power cut - 10:26 AM / Power in - 10:36 AM", a date on every row): read as
    power cuts. A cut the pickling hand also reported is counted once (`prodDowntimeDay`): cuts from different sources
    that overlap or begin within ten minutes are joined; two cuts in one log are two, however close.
  - Smaller shapes: "VAT-2" names VAT A2; "12:45 AM" between 11:30 and 1:05 is noon (said); a day name is checked against
    the date; a ditto-only last row is not a row.
  - **A run that opens on an END starts where the batch before it ended**, the last END above it on the page: a batch with
    no START written for it, or one its gauge split from its START's run (Mehta's 120s after their 98s under one START). With
    no END above it, when it began is not known, said in amber. **Fixed 9 Oct 2026** (owner: *"Yes, fix the reader"*): the
    review had said so since 28 Sep while the run kept its END as its start and lasted no time, and the 20 of 20 below had
    checked the figures, not the starts. A run saved that way, from a photo or a file the reader built, is put right at start-up
    from the END before it on its page and keeps the start it had (`startWas`, with no clock in it, so two devices write the
    same and the merge holds nothing): on the owner's book, four runs on
    VAT A2 (23 Sep twice, 24 Sep, 8 Oct). P85.
  - **A photo that was not a register page was refused** (until the photo reading came out): the weekly hours sheet
    ("other"), and a customer's challan, offered to the challan scanner with the same file.
  **Instrument, and its limit:** the 20 pages were transcribed by hand into the shape the prompt asked Gemini for (scratch,
  never committed) and every page's runs and cuts match what the page means, 20 of 20. That scored the code after the
  read; **Gemini's own transcription was never scored** (no key in the build sandbox), and the owner's reads found it
  never worked: it came out on 13 Oct 2026. The code after the read is the faces' and the files' now.
- **The chat export of 16–28 Sep** (owner) showed the roll side too: **the supervisor writes a slot's work straight under
  its line**, with no `----production----` head ("---hold night-6:00am--- / crew / Dilip press material / VAT A 2 /
  3301-600 nos"), so a quantity line under any slot is that slot's production, a client on a line of its own is the client
  of the lines below, and a figure on the line under its part joins it (rolls went from 4 lines read to 45 over the week).
  **A roll reposted days later is read once** within a paste. "Incoming spray" is a chemical delivery, not incoming
  material (named chemicals are excluded; the broad incoming match stays, since "Incoming mtearial" and "Mk incoming" are
  real). An export made with media writes "IMG-… (file attached)" lines, dropped like "<Media omitted>". **A load with no
  client written, whose part only one client has sent in a year** ("LINER", "188 CD"), is read as that client, amber:
  197 → 172 rows asking for a client on the old exports.
- **The model follows Google's retirements** (owner, 28 Sep 2026: a new free key was refused *"models/gemini-2.5-flash is
  no longer available to new users. Please update your code to use models/gemini-3.8-flash"*). The default is
  `gemini-3.8-flash`; a refusal that names a replacement is retried **once** on the model it names, and on success that
  model is kept on the device (`sep_inv_gemini_model`, `geminiModel()`), so the next retirement needs no release. A
  thinking setting the model refuses is dropped and sent once more. A photo's facts record the model that read it.
  Settings → Connections → Photo reading shows the model in use. **A key whose project is on prepaid billing with no
  credit** is named as that (make a key in a project with no billing, which is free, or add credit), never as a busy
  minute. Nothing here has been run against the live API from the build sandbox: the retries are pinned on mocked
  refusals in the shape Google sent (P85). **Retired with the photo reading on 13 Oct 2026**: each device forgets the key,
  the model and the last read kept as a draft at its next start (`forgetGeminiKey`).
- **The register's own shorthand, from the owner's pages of 23–29 Sep 2026** (P122):
  - **A clamp's gauge from its round** (owner: *"Mehta's clamp gauge is 25x6 or 30x6 if 150 pieces are done on VAT A1 and 100 pieces on
    VAT A2 and 35x6 or 35x8 or 40x6 if 120 pieces and 72 pieces are done in VAT A1"*). The register writes Mehta's clamps as CLAMP; a
    rule (`S.production.gaugeRules`: client, the part's first word, rack sizes, gauges; Mehta's two set once, `_prodGaugeRules1`) reads a
    round of 150 or 100 as 25X6 or 30X6 and of 120 or 72 as 35X6, 35X8 or 40X6 (`prodGaugeRuleFor`). The lines named are kept on the
    rule, not required: the pages show 150 and 120 on A2 as well. One gauge is written in; two or three are kept as the entry's
    `gaugeOptions`, set against the family's challans at any of them. A round of a size no rule names (108, 98, 82) is its own run,
    *gauge unknown*, so it never takes a neighbouring run's gauge.
  - **A floor name is matched to the client's part** (`prodLearnAliases`): a code in brackets (*TINA(0760)*, *TINA(3303)*) that ends
    exactly one of the client's part numbers is that part, and the name alone is learnt for the client (`learn.parts`, now written), on
    a register save and on an import. A code ending two parts (*KUDAL(0706)*) is asked: Entries → **Which part?** lists the parts
    ending in it, then those named like it, then all of the client's (`prodAliasOpen`).
  - **A Samarth round names its part** (owner: *"56 is 3302 on VAT A2, 156 is 3303 on VAT A2. These two are a pair of set they call cover
    plate. The other 3302 is Assy bracket connector that's 50 per round in VAT A1"*). Two of Samarth's parts end in 3302 and the register
    writes all three as TINA, so a rule (`S.production.partRules`: client, rack sizes, line, part number, floor name; set once,
    `_prodPartRules1`) reads the round on its line as the part (`prodPartRuleRead`). The line is required here, unlike a gauge rule. A code
    written that ends the rule's part, or one of the pair, is read by the rule and a disagreement is amber (*TINA(3303)* at 56 a round);
    a code ending a part no rule names stays as written. The same pass set Samarth's per-hour rounds to the register's (56, 156; the 24 and 80
    kept in each time's history) and added the connector's 50 on A1. A code ending two parts is settled by the name's words in the part's
    description where one alone carries them (*Assy Bracket 3302* → the connector), on a register, an import or a hand entry. A floor name
    learnt as two parts (TINA from 3303 and 3302) is kept as **ambiguous** and finds neither; an entry's own part number wins over a
    learnt name.
  - **A new part under the customer's ditto is the same customer's**: *LINER* under MEHTA's ditto had read as no customer written.
    **Unless that customer has never sent the kind** (owner: *"Samarth doesn't have clamp"*): a CLAMP carried under SAMARTH's ditto
    goes to the one client whose gauge rule covers a clamp at that round (Mehta at 150), amber, and is only flagged where no single
    client does (`prodCarryCheck`). **A round of a size its own client's rules do not name, which is another client's part on
    that line**, is asked (*a round of 50 on VAT A1 is Samarth's connector*), never moved (`prodPartRuleOther`; owner: *"71 was the last
    round for Mehta and then 50 is Samarth"*).
  - **Two clients in one round** (owner: *"sometimes two clients are done simultaneously"*): *MEHTA+GENERAL / LINER+188CD / 39+50* is a
    round of each at the same time, split on the + outside brackets (`prodSplitTop`; *(0706+3713)* stays one part), each share in its own
    client's run: a shared round, and the first round after them, continue the run of their own client and part, and a shared START takes
    its own client's next figure. A ditto under one side carries that side (*〃 + DELTA* under MEHTA+GENERAL), a ditto alone the whole
    row. A figure that does not split into as many shares is amber and the row kept whole.
  - **A round outside the gauge rules is a flag, resolvable** (owner: *"The ones that fall outside the range, raise a flag -
    resolvable"*): the run keeps `gaugeUnknown` (its round) until a gauge is picked on it (Entries → *Gauge unknown* → **Pick gauge**, from
    the client's rules and challans for that kind, or typed; `gaugeSrc: 'set'`), and To-do rule **`prodGaugeUnknown`** asks per client,
    imported runs included. **A rule given a round later reads the runs already saved at it** (`prodGaugeRulesApply`: the gauges the
    register read would have given, `gaugeSrc: 'rack'`, `gaugeRuled: {rack, at}`; a gauge picked by hand stays): the owner, 9 Oct 2026,
    on a round of 108 of Mehta's clamps on VAT A1, *"above 32x6"*, so 108 joined the rule of 35X6, 35X8 and 40X6 (`_prodMehtaRounds2`).
  - **A floor word whose round names a series** (`S.production.seriesRules`, `prodSeriesFor`; owner, 9 Oct 2026, on Mehta's liners:
    *"126 - 150xxxxxx series, 90/87 - everything else"*): the floor writes Mehta's L.C. Pads and liners as LINER, and the round says which
    of them it can be, not which one: a rule is a client, the floor's word, the challans' kinds it covers (LINER, PAD), the rack sizes and
    the start of the part numbers (`prefix`), or every other part (`except`). A run so named is set against that series' challan lines,
    oldest first (`prodInPlant`), and weighed by them, else by the series' usual weight (the 150 series at 0.28 to 0.31 kg, so it beats
    the client's default; the rest spread 0.13 to 0.65 kg, so the default wins). A round no series names (39, 80, 150 on A1; 156 on A2)
    stays the floor word's.
  - **A code two parts end in is matched with the recent challans** (owner: *"Checked and matched with recent IM … After a few matches
    it'll become clearer as both would have a different amount of them that can be plated in a round"*; `prodResolveCode`): the one with a
    challan in the 45 days before, else the one with a challan open, else the one on the latest challan, else the one plated before at this
    round on this line (`prodPartRacks`, which never reads a match it made itself). Set on the entry (`partSrc: 'challan' | 'round'`),
    never learnt for the name. On the 30 Sep page, *(0706)* was the part of that code on the client's latest challan. **A figure for a group of codes**
    (*(0706+3713)*, 34) is two entries, each code matched the same way and the figure shared by what is open on their challans, else by the
    pieces on each part's latest challan (`qtySrc: 'split'`, said as an estimate).
  - **Who plated it** (owner: *"place workers on the specified production … we'll know who plated what and when, this can be useful
    later when we get replating issues"*): `prodCrew(e)`, read off the day's attendance and never stored: a general-shift run is the
    hands marked on its line, a run from 5 PM or before 8:30 the named crew of the OT block covering it, a pickling load the pickling
    hands; a day with no attendance says so. Entries show it under each run, and Clients → Performance → Materials worked lists each
    plating of a part with its line, time and crew beside its challans and invoices.
