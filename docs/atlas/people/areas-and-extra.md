---
subject: "The floor by area: staffing, the extra, OT blocks"
domain: people
modules: [split/areas.js]
specs: []
tests: [P260]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### The floor, by area
Floor → People → **Areas**. The same attendance store read by place instead of by person, because two
questions live there and nowhere else: is an area staffed right, and does the extra hold up.

**Staffing is measured against a complement the owner sets**, editable in place, with the area's
own observed median beside it — a target that was never true is then visible as such. An area with
no complement says *no complement* rather than reading as overstaffed against an implied zero.
Heads are counted from the day's marks, so a worker lent to another area counts where they
actually stood; and marks on `flex` are reported as a named shortfall rather than distributed,
because a floating hand is a fact about the day and not a gap to fill by guesswork.

**The areas are the shop's own, and the split is not cosmetic.** The staffing norms are defined
on these exact units — **VAT A1 4 · VAT A2 4 · Barrel 3 · Barrel pickling 2 · Pickling A1+A2 3**,
sixteen on the floor at full house, ruled 11 Jun 2026 and re-confirmed by the owner 27 Aug — and pickling is two sub-areas that the daily relay already
divides. A single flat `pickling` can carry neither norm, so it can carry neither shortfall, so
the extra cannot be checked against it. **Colour is not an area**: it is the *dedicated
passivation hand* inside VAT A1's complement of four. The step itself is not A1's — A2's operators
passivate their own work and the barrel route passivates too — what is A1-specific is that a hand
is set aside for it. Giving it an area of its own was this module's invention; the shop's own
register codes those hands `A1`.

**The extra is a prediction, not a mystery.** A hand missing from an area running at full tilt is
covered by the crew who are there, and **8 hours are booked to that area for it**. So expected
extra is `Σ max(0, norm − heads) × 8` per unit per day, set against what was actually booked.

**Be exact about which part of that is ruled.** The 11 Jun ruling fixes two things: the label sits
under the *short sub-area*, and its worked example — A1 3/4, A2 3/4, pickling 2/3 → 24 h. Every gap
in that example is **one**, so it cannot distinguish 8-per-missing-hand from 8-per-short-area. The
per-hand scaling is the **owner's, confirmed 27 Aug 2026**; before that it was a working hypothesis
whose author labelled it as one. Two recorded days contradict it — **W27 Mon 29 Jun** and **W28 Fri
10 Jul**, both VAT A1 at 2 of 4, both tagged 8 where per-hand predicts 16. Instrument:
`grep -rnoE "EXTRA[^|)]{0,30}(short [0-9])" attendance/*.md` over soma-internal returns **four**
annotated pairings — W26:18 (short 2 → 16 h), W26:58 (short 1 → 8), W27:17 (short 2 → 8), W27:19
(short 1 → 8) — so **two of the four**, on that instrument, are the counter-cases, and both are a
two-hand VAT line tagged a single shift. W27 offers its own reading of one of them: `2026-W27.md`
decodes that 8 h as *"2 named hands + 8 hr casual"* — a per-area decode rather than a
mis-scaled per-hand one, which ties it to the open T-CY question of who the pooled line pays. The
app follows the owner's rule and surfaces those days as *booked but not the predicted amount*
rather than smoothing them away. `extraHoursPerHead` is in Settings because the question is not closed.

- **Barrel and Barrel pickling are one unit for the arithmetic.** The relay writes them as one row
  about as often as two, and every recorded decode reconciles them against a combined norm of five.
  Split, a day with both hands on the barrel side predicts 8 hours against the 24 the shop booked
  and reports a surplus on a day that balances exactly. Where both are staffed the two readings
  agree, so the pairing only ever bites where it must.
- **A norm binds a unit that ran, and a unit nobody stood on but hours were booked to *ran*.** A
  line with no heads and no booking is idle, not short of its whole complement — otherwise a day
  running one area of five predicts more coverage than the plant could absorb. But a zero-head
  pickling row carrying `EXTRA 24 HOURS` against a norm of three is 8 × 3 exactly: the shop treated
  it as fully short and fully covered. Judging that idle would drop it from the expected side while
  keeping it on the booked side, and the card would cry surplus on a day that reconciles to the
  hour. **Numerator and denominator, same population** — the rule this repo already lives by.
  Genuinely idle unit-days are excluded and the exclusion is **reported**.
- **The gap is read in both directions, and they mean different things.** More booked than the
  shortfall explains is the case the rule forbids. Less is not an error at all: the rule binds
  an area at full tilt, and nothing here measures per-area output, so the expected figure is an
  **upper bound** rather than a target.
- **Three disagreements are kept apart** — booked at or above complement, booked where nobody
  was marked, and booked but not the predicted amount — with the area and the date on each.
  They are flags on the *paperwork*: hours booked to the wrong area, an assignment nobody typed,
  and hours never worked all look identical from here. When every booking answers a real
  shortfall the card says the check **passed**, because a test that only speaks up on failure
  teaches the reader to stop trusting its silence.

**`EXTRA n HOURS` is ONE instrument, and the owner settled it 28 Aug 2026.** An OT block books the
extra exactly as a general shift does — against the shortfall in the area that ran. What differs is
only the **multiplier**: a general shift credits a missing hand a full 8, a block credits it the
block's own length. So a 5-to-midnight slot short two hands books 14.

This **supersedes** the earlier reading, which took a block tag as the slot's per-hand credit
("5 hands × 3 hr = 15 OT hr") and therefore reconciled it against nothing.

**Be exact about what the per-hand reading fails at.** It cannot reproduce the *population*; it is
not true that it fails every row. It reproduces `W31:154` group 1 (3 hands × 7 h = 21, and that
file's own line calls it `3×7=21 ✓`) and `W33:63` A1 (3 × 3 = 9). That matters rather than being a
quibble: **the surviving named exception below is a row where the superseded reading is the one that
works** — `W33:63` A1, 3 hands tagged 9, which is exactly 3 × 3 per hand. An earlier version of this section claimed it "fails every recorded block tag" — an
unmeasured superlative sitting in the same sentence whose other half names its instrument.

**The census, with its instrument, because the earlier version of this table claimed more than it
had.** Castor swept every relay row under a `Morning OT` / `6:00 AM` / `Evening OT` / midnight-or-8PM
heading carrying an `EXTRA` tag, across `attendance/2026-W24.md`, `W31`, `W32`, `W33`, plus their
untagged sibling rows: **13 blocks, 18 tagged rows.** Cipher re-counted the same four files and
found **17 blocks, 23 rows** — the two instruments disagree, and the gap is not resolved here: if
Castor's heading key excluded W33's `Out`-headed rows it also excluded `:63`, which is one of the
surviving named exception and therefore cannot have been outside the population. **See § The block
census, adjudicated below — that gap is now measured rather than open.** Vulcanus swept the raw relay export
(`data/raw/relays/2026-08-14-...txt`, 27 Jul – 8 Aug) for rows carrying times, per-area headers,
named crews and a tag together: **9 blocks, 14 rows.** W18–W23 and W25–W30 were not swept by either;
"not found there" is not "does not exist".

| Row | Block | Areas · heads | Norm | Short | Predicted | Tag |
|---|---|---|---|---|---|---|
| W24 Wed | 6:00–8:30, span 2.5, **credited 3** | **A2** · 5 | 4+2 = 6 | 1 | 3 | `EXTRA — 3 hours` |
| W31 Tue g1 | 5PM–12AM = 7 h | `A1 & pickling` · 3 | 4 + fold 2 = 6 | 3 | 21 | `Extra 21 hours` |
| W31 Tue g2 | 7 h | `barrel & pickling` · 2 | 3+2 = 5 | 3 | 21 | `Extra 21 hours` |
| **Tue 4 Aug** | 7 h | A1 · 4 | 4+2 = 6 | 2 | 14 | `EXTRA 14 HOURS` |
| W32 Wed-5 eve | 7 h | A1 · 4, A2 · 3 | 4+4+3 = 11 | 4 | 28 | `EXTRA 28 HOURS` |
| W32 Thu-6 eve | 7 h | A1·3 / A2·3 / pickling·0 | 4 / 4 / 3 | 1/1/3 | 7 / 7 / 21 | `7` / `7` / `21` |

Three corrections the Governors made to this table, each of which had been hiding something:
**W24 Wed heads VAT A2, not A1** (`2026-W24.md:50`; the norm is unaffected, the label was wrong on
the row the whole ruling is anchored on). **"W32 Fri" is Tue 4 August** — Fri 7 Aug carries no tag at
all. And **6:00–8:30 is 2.5 hours, not 3**: writing the credit into the span column is what concealed
the multiplier blocker below.

**The morning block is credited 3 hours on a 2.5-hour span** (owner, 28 Aug 2026). The convention is
stated at `2026-W24.md:61` in those words, and seven recorded morning tags reconcile at 3 while none
reconciles at 2.5. Deriving the multiplier from the clock alone flagged **every faithfully-entered
morning block** — the shop's most frequent — as *booked more than the shortfall explains*. So the
credited length rounds the span up to the whole hour; the only convention the corpus states is
2.5 → 3, and rounding up is this app's inference from that one instance, a no-op on every other
recorded block. **Two instruments, two lengths:** a named hand's own pay uses the clock (BM, 8 Aug —
a named hand's 6:00–8:30 + 5 PM–12 AM = 9.5 hr), the unattributed EXTRA credit uses the convention. The
entry row shows both whenever they differ.

**A named exception is a RECORD, not a footnote.** A disagreement this card raises is a question;
once a human has examined it and can say why, it becomes an entry in `S.extraExceptions` carrying a
**required** reason — the same treatment `S.voidedNumbers` gives a number gap and `dupeAck` gives an
accepted duplicate receipt, and for the same purpose: an audit must be able to tell an exception
somebody examined from one nobody was shown. Explained exceptions are counted and listed apart from
open disagreements, so the card distinguishes *"nobody has looked at this"* from *"this was looked at
and here is what the record shows"*. Explaining or reopening one is a floor entry (`areaExplainOk`): a role that may
not make one is told so. Each list shows its first eight and the rest one tap away. **It is offered as Accept (with explanation)**
(owner, 7 Nov 2026, on a Sunday the supervisor booked 3 hands short of pickling where the rule reads 2: *"accept with explanation
option should be there"*): the booking stays as booked, and so paid, with why on the record; listed under *Accepted*; and offered
on People → Attendance → Day's Extra hours card too, where the booking was made (`areaDayFlagsHtml`). P260.

**An acknowledgement is granted against specific figures, never as a blanket silence.** The record
stores the expected and booked hours it was written about. If the data later moves — a crew
corrected, a tag retyped — the note no longer describes what is there: it is reported as **stale**
and the disagreement surfaces again, rather than an old explanation quietly covering a new problem.
That is the guard the sync SHA gives a blind overwrite, applied to reasoning instead of data.

**ONE recorded block the rule does not reproduce** — named rather than smoothed away, the same
courtesy the general-shift side already gets. **W33 Tue 11 Aug, 5–8 PM**: A1 3 hands tagged 9, A2 2
hands tagged 12, which reconcile only at a per-row fold of 2 each — four pickling hands across the
block, contradicting the ceiling.

🔴 **The SECOND named exception is STRUCK from the ceiling test — but the ground has moved TWICE,
and both moves are on the record.** This section first said **W31 Mon 27 Jul, 5–8 PM** carried two
rows *"each tagged `Extra 3 hours`"*, then withdrew that as a fabricated quotation
(`grep -ci "extra 3 hour" attendance/2026-W31.md` → 0; the weekly says **3 + 3 man-hr**) and called
the block **untagged**. 🔴 **The withdrawal was itself the mixed-instrument error (Vulcanus V-3):
the RAW RELAY carries the literal tags** — `Extra----3 hours` (VAT A2) and `Extra---3 hours`
(VAT A1), in both the `2026-07-28` and `2026-08-14` exports at :9989/:9994 — **and the weekly
transcribed them into man-hr notation.** An absence was measured on a transcription of the record
and published as a fact about the record.

**The block is tagged, and it still is not a counter-case.** Booked 3 + 3 = 6 against a per-hand
prediction of ~18 is an **under-booking**, which the rule treats as *not an error* — an upper bound,
never a target. And the payout corroborates the strike from the other side (Castor): the slip's
pooled EXTRA leg for Mon 27 is **41 = 9 + 32**, excluding the evening 6 entirely
(`operations/payouts/2026-W31-payout-2026-08-01.md:70`).

⭐⭐ **The compound lesson: name the instrument AND its provenance.** The first error quoted a tag
nobody swept for; the second swept the wrong surface and called the null a fact about the world.
*A quotation with no instrument reads as evidence somebody checked; a null on a transcription reads
as a null on the record. Both were published here.*

**The ceiling still rests on ONE recorded case** — `W33:63` — for the corrected reason above.

**It resolves a row the codex had written off.** `soma-internal/attendance/2026-W31.md:150` calls the
Tue-28 evening tag *"internally inconsistent (group 1: 3×7=21 ✓; group 2: 2×7=14≠21)"* and treats
that asymmetry as evidence the tags are not a pay instrument. Group 2 is barrel+pickling, a unit of
five, two hands present: short three, 3 × 7 = 21, exactly as tagged. The inconsistency was in the
reading, not in the tags.

🔧🔧 **It also meets a booked payout — and this paragraph had the holding BACKWARDS until
23 September 2026.** `attendance/2026-W24.md:61` prices that 6 AM slot at 15 OT hr / ₹751.50 on the
**per-hand reading that the same line marks SUPERSEDED**. Under the shortfall rule the tag is 3 hours
of unattributed extra, and the five named hands' own overtime is a separate figure carried on their
in/out times.

~~Flagged, not acted on.~~ **Both legs are payable.** Under the owner's 28 Aug 2026 ruling the slot
has **two legs** — the named hands' own overtime **and** the pooled EXTRA credit — and `2026-W24.md`
reads, in its own words, *"So the slot has TWO legs, and both are payable"*: ₹751.50 named +
₹142.50 pooled = **₹894.00**, which the single-leg reading **understated**. Nothing is netted.

⭐⭐ **How this survived is the lesson, and it is about THIS FILE.** *"Flagged, not acted on"* was
written here, quoted **out of** here by a soma-internal session as though it were `2026-W24.md`'s own
holding, and then used to justify not paying a leg. The sentence never existed in the file it was
attributed to. **And the correction that caught it named this line — `sep-invoicing/CLAUDE.md:703` —
in an immutable commit body, and still did not reach it: located, named, and folded nowhere.**
*A sister repo is greppable and editable, so neither distance nor immutability is a defence; the only
thing that stops a corrected claim living on here is someone opening this file.*

**The pickling fold, and its ceiling.** A VAT line running in a block pulls VAT-side pickling hands
with it, and the shop writes that as a **co-tag on the VAT row** — `----VAT A1 & pickling`. That is
not pickling staffed separately; it is the VAT row saying which hands it covers, so the row **folds**
rather than carrying pickling's own complement of three. Read the other way the flagship recorded row
predicts 28 against a tag of 21 and the shop's own shorthand becomes unenterable — and barrel is
already read this way, so VAT must match it. Pickling carries its own norm only on a row naming it
with **no VAT line**; when such a row exists, nothing folds anywhere in that block.

The ceiling is the ruling's: **one VAT line needs 2 of the 3, both need all 3 — never 4** (owner,
28 Aug 2026). The fold is computed for the **block**, capped at the three hands that exist, and
shared across the VAT-covering rows in proportion to the lines each covers. Shares divide by the sum
of every row's lines rather than the block's distinct count, so overlapping rows cannot fold past the
ceiling either. With no pickling complement set, nothing folds — there are no hands to lend, and
inventing them would inflate every shortfall.

**The gap is judged per block, not per row.** When the relay splits one block over two rows the hours
it writes on each need not match that row's share of an apportioned fold: 14/14 against a 1.5/2.5
shortfall reconciles to 28 exactly. Judging rows flagged two disagreements on a block that balances to
the hour — numerator and denominator, same population, again.

Per-row folding would make the answer depend on how the relay happened to write the sheet: one row
over A1+A2 folds 3, two rows of one line each would fold 2+2, and the same day would reconcile to 11
or to 12 on nothing but the tagging. **The block total is invariant**, which is the property that
matters; a fractional norm is the visible signature of a block the relay split where pickling did
not. Barrel needs no fold — barrel and barrel pickling are already one unit of five.

**The fold is an upper bound, like every other figure on this card.** It assumes the lines it covers
ran at full tilt; a block running at less than that needs fewer pickling hands and books less.
Nothing here measures per-area output, so that reduction cannot be derived — which is exactly why
booking under the prediction is never reported as an error.

**A block needs three things the marks cannot supply, and without any of them it is reported rather
than reconciled at a guess.** Its **length** comes from its own in/out times (21 is three hands short
of a 7-hour block and also seven short of a 3-hour one, so deriving the length from the tag would
make the check vacuous by construction); its **complement** from the areas it covers; and its **head
count** from its **named crew** — the marks record where a worker stood on the *general* shift, and
the blocks routinely move people (W31 Wed: a hand on barrel pickling all day is in the VAT A1
evening block), so reading the marks would put the head in the wrong area and invent a shortfall.
Unreconcilable hours are still counted in the bill: unverifiable is not unpaid.

Block absorption is **exact rather than inferred**, because the row names the crew who stood the
slot.

**The extra is PAID pro-rata to the short area's present crew — ruled by the owner, 28 Aug 2026,
and it closes T-CY.** The 11 Jun ruling said the short area's present crew absorb the coverage
between them; the 28 Aug ruling settles that this attribution **is the payment**: the pool's payee
is the crew itself, pro-rata. The money **stays under the EXTRA line** — one pooled figure on the
slip, **disbursed by the supervisor on the floor** — and the card's per-worker shares are the split he
disburses it by. Nothing enters the per-worker wage arithmetic and the labour card still counts the
extra exactly once; an earlier version of this section called the spread *"an availability measure,
not a wage"* and warned against conflating measurement with payment — right until the ruling, wrong
after it.

**What the ruling does not repeal is arithmetic, and two residues stay flagged.** 24 coverage hours
against two present hands is twelve each on top of a full shift — under the ruling that is money
those two *received*, so an over-ceiling row is a pay figure to check against the record, not a
different payee. And a row with **nobody to pay** — a zero-head area carrying a booking, or a pooled
weekly leg with no daily breakdown — has no pro-rata recipient at all: the W28–W33 decomposition
attributes **₹30,827.50 of the ₹38,237 to 18 named hands** and leaves **160 h (₹7,600) in four such
rows**, named in soma-internal → T-FA.
