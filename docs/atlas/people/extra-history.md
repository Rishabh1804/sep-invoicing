---
subject: "What the seeded history says about the extra"
domain: people
modules: []
specs: []
tests: []
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### What the seeded history actually says about the extra
**93 days, 2 May – 15 Aug 2026, 1,483 marks, 261 explicit absences, 90 general-shift bookings and
36 OT block rows (8 re-sourced from the raw relay; 26 of the 36 carry all three inputs — times,
resolvable heads, areas — and of the 32 that book hours the reconciler passes 23)**, read off
`soma-internal/attendance/2026-W*.md` plus `operations/payouts/` and, for W31's blocks,
`data/raw/relays/`. It is the first time the rule has been tested against more than a handful of
hand-picked rows, and **it does not settle the question the owner ruled on.**

On the **65 booked unit-days that carry a shortfall**, 36 are short by exactly one, where per-hand
and per-area both predict 8. That leaves **29 that can tell the two apart: per-hand 11, per-area 7,
and 11 that reconcile at neither.** Per-hand leads and does not sweep — the same shape the smaller
corpus showed, now on twice the evidence. It is not a refutation, because the owner's ruling is the
owner's to make and the plurality is his way.

**The range-level gap was a parser artifact, and the corrected corpus nearly reconciles.** An
earlier version reported *expected 1,912 h against 538 h booked* — a 3.5× gap read as
under-recorded heads. Most of that gap was tags the extractor could not see (the `| EXTRA |`
column, the prose day-grids, W31's blocks). ⚠ **This figure has now moved THREE times, and each generation called itself corrected, so all
three are stated with their defect:** **3.5×** (the parser could not see whole tag notations — the
expected side was honest, the booked side starved) → **1.2×** (the parser was now INVENTING
bookings — a weekly-total row seeded as a 106-hour Sunday, and thirteen Week-% matrix cells read
as 50–100 h bookings, all landing on the booked side) → **2.16×: expected 1,880 h against 872 h
booked**, on the phantom-free corpus (same instrument: `Σ max(0, norm − heads) × 8` per unit-day
that ran, barrel + barrel pickling one unit of five, idle unit-days excluded and counted: 70).
The shop books well under the upper bound at range level; under-booking stays *not an error*, and
a figure that flattered the model twice for two opposite parser reasons is why the instrument is
named every time.

**Hours are recorded, and an earlier version of this section said they were not.** The claim was
*"the sheets record where a hand stood, not how long"* — false on three counts, and the correction
matters because it was used to justify seeding `hours: 0` across the board. The corpus states hours
in two places and states **absences** in a third:

- **`2026-W33.md` carries a worker × day HOURS MATRIX** — ten hands, six days, **36 legs**, every
  cell tied to the payout slip leg-for-leg by that file's own audit.
- **The payout slips W28–W33 carry per-day HOUR STRINGS** (`18+14+18+14+11+5`). The terms are the
  days that worker was present, in order.
- **`2026-W18`–`W22` carry PRESENCE MATRICES** (`✓ / ✗ / ✓+OT`) holding the **explicit absences** the
  slot rows never did. Four states, not three — and the first seed emitted only `P`, collapsing
  *absent* into *unmarked*, which is the exact distinction the labour card exists to keep.

**The join is what makes an hour string safe rather than a guess.** A string is assigned only when it
has **exactly as many terms as the attendance sheets have present days** for that worker that week.
On W32 — one of the two weeks where both instruments exist (W33 is the other) — **9 of 9 strings
now match** *(the ninth was refused only because that worker's ⭐-decorated rows defeated the name
regex)*. Where the
counts disagree the string is **refused and counted**, never stretched to fit: a mis-aligned string
puts a fourteen-hour day on the wrong date and reads as a real record.

**The convention W33 recovered from its own ties:** paid hours are the **clock span floored to the
whole hour** (8:30 AM → 12 AM = 15½ pays 15; 6 AM → 12 AM pays 18), with **no lunch deduction on a
6 AM start**. Note this is *floored*, where the unattributed EXTRA credit **rounds a 2.5-hour morning
block up to 3** — two instruments, two roundings, and neither is the other's error.

**The extraction gap is now closed, and it was most of the shortfall.** An earlier version of this
section reported 4.8% hours coverage over 64 days and named the cause: `W19`, `W20`, `W31` and `W33`
write their day structure differently from the `## Mon 4 May 2026` shape the extractor matched. Four
shapes were missing, and each cost real days:

| Shape | Example | Cost |
|---|---|---|
| `###` day headings | `### Mon 10 August 2026 (W33 Day 1)` | W33 entirely — 6 days, 12 EXTRA tags, the whole hours matrix |
| abbreviated month, no year | `### Thu 30 Jul` | four of W31's six days |
| bullet slot rows | `- **VAT-A1**: <name> · <name> · <name>` | W28 entirely — 6 days, 44 rows |
| no day headings at all | W19 / W20 carry only a worker × day matrix | 12 days, 231 marks |
| **two days in ONE heading** | `## Wed 29 + Thu 30 Jul` | both days VANISHED — ~32 marks, 8 absences, two EXTRA 8s — while a mangled fragment seeded a **phantom block on the wrong day** (Castor blocker; the code comment claiming "the first wins" described code that did not exist) |
| **inline group labels** | `A1: <name>`, `*A2* <name>`, `— <name> ·` | the FIRST HAND of every prose block row dropped — one from the worked example, one from the 28-h flagship, and the wrong crew on `W33:63`, the surviving exception itself |
| **`·`-separated positional hour strings** | `14 · 18 · 18 · 18 · 14 · 11` under a day-named header | all of W31's per-day hours read as zero |
| **decorated names** | `⭐ **<name> (8:30 AM)**` | that hand absent from four weeks of office rows — six paid days with no presence mark |

**64 → 93 days · 774 → 1,483 marks · 37 → 285 worker-days of hours · 40 → 261 explicit absences ·
55 → 90 general-shift bookings · 8 → 36 block rows**, of which **26 carry all three inputs** (times,
resolvable heads, areas — the instrument counts every row, the four zero-hour fold-suppliers
included; **the reconciler itself judges the 32 booked rows and passes 23**, which is the figure the
on-screen card shows) against 4.

**Hours exist per week only where the shop recorded them, and there coverage is real:** **W28 63% ·
W29 51% · W30 26% · W31 45% · W32 36% · W33 34%**, against zero for W18–W27. *(An earlier version
said "zero for W18–W27 **and W31**" — W31's per-day hours sat on disk the whole time, in the payout
table's `·`-separated POSITIONAL strings (`14 · 18 · 18 · 18 · 14 · 11` under a header naming the
days, `—` for absent) and again at `2026-W31.md:203` — two surfaces, both unread for want of a
separator. A zero was published as a fact about the shop that was a fact about the parser, for the
second time in one file.)* The monthly tier never appears on an hourly slip because it is paid by
day rate; its span-credited hours are display-only and price nothing (Castor, claim 5).

**Four instruments now, each stated rather than joined where the sheet allows it.** W33's worker ×
day matrix and W31's positional payout strings are **date-stated** — no join needed. The
`+`-separated strings (three shapes: indexed, index-less, `N×M`) are **joined** only when the term
count equals that worker-week's present days, refused and counted otherwise. And the day's own
`In 8:30 / out 5:00` (10 days) credits a present hand under W33's floor rule only when no per-worker
figure exists. *(Also corrected: "the payout slips W28–W33 carry per-day hour strings" — **W28 and
W29 carry weekly totals only**; per-day strings exist on W30–W33.)*

**What genuinely is not recoverable: a weekly total with no per-day breakdown.** Those weeks are not
distributed across their days, because *there* splitting really would invent a distribution nobody
wrote down. They keep 0 and are counted. That is the claim the original sentence should have been
limited to.

**And SOME block crews before 27 July**, where the relay writes the block as prose with no names:
those import with an empty crew and the reconciler reports them as *Not checkable*, with the hours
still counted in the bill. Unverifiable is not unpaid. *(The blanket version of this claim was
overbroad — W24's morning block names its crew in a `| Worker | Area |` table under the heading,
and it now imports with all five.)*
