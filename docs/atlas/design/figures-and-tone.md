---
subject: "A figure says whether it is good"
domain: design
modules: [split/state.js]
specs: []
tests: [P102, P178, P180]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

**A figure says whether it is good** (owner, 29 Sep 2026: *"most numbers in our app don't convey any kind of meaning, as
in is it a good number or is it something of an issue, all are in default black"*; the owner chose both of the options put to
them). A figure the app can judge is coloured in its status tone, always beside the words that give the reason (DR-8), and
a headline figure carries a change line against its benchmark, coloured by whether it moved the good way; a count stays
uncoloured. The judgements are in one place, state.js (`figToneAgainst`, `figToneAge`, `figTonePaysIn`,
`figToneCapacity`, `figTonePct`, `figDeltaHtml`; `inv-fig-*`), and read by:
- **Home**: every month-to-date tile against the same days last month (`homePriorSameDays`), and realisation against the
  month's live cost (*below cost ₹8.56*); the Money strip's *Owed to us* by age (*₹5,900 over 90 days*) and *Pays in*;
  the attendance card's *On site* at the rest-day gate's 90 / 80%.
- **Stats**: the headline's change lines and realisation against the live cost (warning within 5% under it), gross margin
  and what a kilo left judged the same way, *In one line*'s realisation and capacity (80 / 60% of two shifts, with the tonnes spare), realisation by
  client (*Just under cost* / *Below cost*), and days to pay under each client.
- **Clients → Performance**: the change lines and the latest month's realisation against the cost.
- **Money → Receivables and Overview**: what a client owes by the age of its oldest open invoice (*owed, over 90 d*),
  and *pays in N d*.
- **Today's cards** (8 Oct 2026; owner: *"Hero cards should have gradient colour filling as per the theme, make sure the colours
  are coded"*, then *"the boxes inside the cards are still just white instead of colour coded gradients"*): a coded block names its
  tone in `--tone` and `--tone-bg` (design §3.3 *Fills*), and its fill and every box in it are mixed from them on the element: a
  hero strongest (a task group by its worst task, a question by its answer, the day's inputs by whether one is late, a widget by the
  worst of what it holds), a box in it lighter and in its own tone (a task or move card by its tone, edged in it; a tile by
  `inv-tile-<tone>` or `data-tone`; a tile stating nothing drawn plain), a control in it lighter again. The coding was there; the
  fills read it. P178, P180.
P102.
