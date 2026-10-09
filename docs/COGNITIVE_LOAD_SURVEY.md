# Cognitive-load survey of every screen (8 Oct 2026)

The owner, after Today was rebuilt as cards: *"survey all the screens to make sure the app is up to the mark for our cognitive load
benchmark … if any other updates are needed because of that … get back to me"*. This is the survey: what the benchmark is, how it
was measured, what each screen scored, what this PR already changed, and what it proposed for the rest. **The proposals are now
steps of one spec, `docs/TAB_MAP.md`** (owner, 9 Oct 2026: *"Spec cognitive load into our previous spec that's still to be
implemented. Combine them into one spec."*): its §3d gives every screen below its step and its target, and nothing below the line
*What this PR changed* is built.

## The benchmark

The repo has no single named benchmark. It is these written rules, read together:

1. **The 6-second test** (`docs/WORKERS_AND_PLANT.md`): one glance at the first screen says the state — what is fine, what is wrong,
   what needs the owner — before any reading. A verdict leads, in its tone.
2. **What needs the owner leads** (`docs/UX_OVERHAUL_2.md`, rule 1): finished records in their own view tab or a fold.
3. **A long list shows its recent part** (rule 2), with Show more or a pager; totals cover the whole.
4. **A card taller than a screen folds to its summary line** (rule 3).
5. **One fact, one screen** (rule 4).
6. **About three phone screens or fewer**, unless the screen is the day's work list.
7. **Today's card language** (owner, 8 Oct 2026: *"less cognitive load"*, *"presented better, maybe as a card or at least an
   expandable hero card"*): a hero with a one-line verdict in its tone, opening to boxes coded by their own status; to be taken to
   the other tabs one by one.
8. **The design rules** DR-1…DR-8: colour means status with a word, one accent, **one primary per view**, figures mono, sentence
   case, status a dot or badge and a word, a judged figure in its tone beside its reason.
9. **No large blank areas, nothing cut, nothing past the screen's edge.**
10. **HR-9, no white.**

## How it was measured

On the owner's 8 Oct book, loaded locally (never committed; counts only, no name or figure here): every page and every view tab,
the phone (393 × 850) and the desktop (1440 × 900), light theme. For each: the length in screens, and what the first screen asks of
the reader (figures, words, controls, cards, and whether a verdict is on it), with a shot of the first screen and of the whole
page. Then four reviews, one per workspace, read every shot against the rules above. 61 views on each layout; no error.

## The scoreboard

Phone screens (desktop in brackets). **Bold** is over the length rule. Verdict: P passes, C close, N needs work. The rows keep the
names they were surveyed under: Insights' five views became a group in Office's row later the same day (below).

| Screen | Length | Verdict | The main finding |
|---|---:|:-:|---|
| Today → Needs you | 2.6 (1.5) | C | on the phone the inputs card, open, pushed the red tasks under the fold *(fixed here)* |
| Today → Pulse | **5.5** (3.0) | N | owed read green on a question and red on a widget *(fixed here)*; the widgets repeat Needs you and the questions |
| Office → Pipeline | 1.6 (1.0) | C | no verdict; stages are rows with small dots |
| Office → Challans | 1.3 (1.0) | N | nothing says how old the waiting challans are; their tone ignores age |
| Office → Challans, Invoiced | 2.8 (1.0) | P | |
| Office → Invoices | 3.0 (1.0) | N | six rows of controls on the phone before the first invoice; no verdict |
| Office → Clients | 2.0 (1.0) | N | no verdict, though each client's flags are already worked out |
| Clients → Items | 2.8 (1.0) | C | toolbar too long; the job waiting (parts with no weight) is a plain chip |
| Clients → Performance | **3.8 (4.9)** | N | the flags fold away with no tone; long cards open |
| Clients → Quotations, Prospects | 1.0 | C | Today's reprice moves are not shown here; the spare disagrees with Pulse's |
| Create | 1.0 | C | red errors before anything is typed |
| Floor → Day | 1.5 (1.0) | C | the line needing the owner is the last card |
| People → Overview | 2.7 (1.6) | N | the raised task is the last card, on screen three |
| People → Day | **6.7** (2.5) | N | every EXTRA row an open form with every hand as a chip: about three screens |
| People → Week | **3.8** (2.5) | N | an instruction paragraph, then a grid; no line saying the state |
| People → Register | **4.0** (2.5) | C | the one cell to act on is drawn the faintest |
| People → Pay | **3.8** (2.5) | C | the payout shows, not whether it is usual |
| People → Areas | **4.2** (2.2) | N | five method paragraphs; the row to explain on screen two |
| People → Roster | **4.3** (1.0) | C | nothing says who to watch |
| Production → Overview | 2.6 (1.2) | N | the raised tasks, one red, come last |
| Production → Equipment | 1.0 | C | the primary is Paste message, not Add a unit |
| Production → In plant | **3.6** (2.3) | N | three caveats lead; the exceptions come last, untoned |
| Production → Lines | 1.7 (1.0) | C | nothing toned |
| Production → Entries | **16.9** (1.0) | N | every entry at once; no Show more |
| Stock → Overview | **3.5** (1.9) | N | lines out draw as grey slivers; the reorder's cash, red, comes last |
| Stock → Lines | 2.1 (1.0) | C | six toolbar buttons on three rows |
| Power → Overview | 2.2 (1.2) | N | imported cuts fill the first screen; the load to chase is a phrase |
| Power → Cuts, Load & bills | 1.6, 1.7 | C | To complete repeated; the red callout comes third |
| Power → Causes | 2.2 (1.0) | N | tiles read firm on one reasoned cut; To complete a third time |
| Power → Case (paper) | 3.7 | C | on the phone the sheet is not fitted to the screen |
| Money → Overview | **5.8 (4.5)** | N | owed, much of it over 90 days, uncoloured and four screens down |
| Money → Receivables, Bank, Bills & notes | 1.8–3.1 | C | method paragraphs open; old records above the statement |
| Money → Payments | 2.6 (1.8) | N | *Not yet sorted* near the foot; the first row's amount squeezed on the phone |
| Money → GST | 1.0 | C | on the phone the status column is cut |
| Insights → Stats | **10.9 (5.5)** | N | the six questions again as flat panels, and every move again |
| Stats → Clients, Cost | **4.8, 4.4** | N | the verdict (below cost) in the second card; the bills list repeats Bills & notes |
| Stats → Billing, Trends | 1.4, 1.7 | C | the month so far plotted as a collapse |
| Insights → Reports | **6.2** (4.5) | C | on the phone the tables run past the paper's edge |
| Insights → Planner (8 views) | 1.7–4.9 | N | a header repeated on every view; phone rows squeezed to a word a line |
| Insights → History | 3.0 (1.0) | C | filters fill half the phone's first screen |
| Insights → Knowledge | 1.0–2.9 | C | Training: no summary, every row the same status |
| To-do | 2.3 (1.4) | N | the tasks Needs you draws as cards, here in a second style |

**HR-9 holds on every screen**: no fill reads as white anywhere but on paper.

## What this PR changed

- **HR-9** everywhere (tinted surfaces under OKLab L 0.97, the app's own tick boxes), and Today's boxes coded by status.
- **Pulse**: every widget a card.
- **The cash question** judged as the Money card is (owed past 60 and 90 days, overdrawn, how fast clients pay), and both draw the
  one age bar.
- **Needs you on the phone**: the inputs card opens folded while a red task waits, so the red tasks lead.
- **Needs you's task groups**: the figure reads *at stake*.
- **The recent invoices' head** says what was made today and its total, instead of naming the newest row twice.
- **The phone bar** is a dock in the card language.
- **P76's sweep reaches Pulse**, which it never had.

**Then, on the owner's word the same day** (*"The bottom bar still doesn't look right. Let's give our tiles elevation as well. Move
insights into office tab … in the desktop view we have many tabs that are actually tabs that exist under a different tab but it
is there on the sidebar"*): the bar is five doors of one geometry with Add the filled centre one, the dock above retired; the
desktop's sidebar is a rail of the workspaces alone, their views the tab row under the top bar as on the phone; Insights is
a group in Office's row, named there; and every tile is raised (DR-6 amended). That answers the rule *one fact, one screen* for navigation too: each
view had been drawn twice on the desktop, in the sidebar and in the top bar's tabs.

## What the survey says to change, in the order proposed

**Folded into `docs/TAB_MAP.md` on 9 Oct 2026**, each fix in the step where its screen lands: Pulse and Stats in TM2, Money in
TM3, Floor's screens in TM4, Office's in TM5, the rest across the app in TM6. A screen that the map removes (Stats → Overview, the
To-do, the page Overviews) is not fixed first. The list below is kept as it was proposed.

1. **Repetition and length, cheapest first**:
   - Production → Entries shows its latest thirty (16.9 screens to about three).
   - People → Day's EXTRA rows fold to one line each (6.7 to about four).
   - Stats → Overview reuses Pulse's question cards and drops the repeated moves (10.9 to about three).
   - To-do draws Needs you's decks.
   - Every method paragraph becomes one folded *How this is read*.
   - The owner's call: Pulse's defaults could drop To-do and Recent invoices (Needs you has both) and fold Money into the cash
     question (5.5 to about three).
2. **A verdict leads each Overview**, as a hero with what needs the owner first:
   - Money (cash, owed by age, GST due);
   - Stock (lines out and the reorder's cash);
   - Production and People (the raised tasks at the top);
   - Power (the load to chase, the year's cost).
3. **Office**:
   - a verdict on Pipeline, Challans and Invoices, with rows coloured by age as invoice states are;
   - a dot and a word per client on Clients;
   - a client hero on Performance.
4. **The phone's squeezed screens**:
   - GST's and Payments' cut columns;
   - the Planner's rows;
   - the power case and the report fitted to the screen as the print view fits them;
   - long toolbars behind a menu.
5. **One tone per fact**:
   - the same figure in the same tone on every screen (on site, at complement);
   - the month so far drawn dashed and marked *to date* in every chart.

## Analysed data (9 Oct 2026)

The owner, on Floor's line card: *"The times lost most reads like a block of text and is not presented according to our
benchmark, where we are looking to reduce cognitive load."* Then: *"Lots of new chaotic text data is entering due to the analysis,
that means we are [not] spending enough time and resources on designing a way to present our analysed data in a coherent manner."*

**One way to present a worked-out figure is now a design rule** (`docs/SEP_INVOICING_DESIGN_PRINCIPLES.md` §6.27). The verdict
leads in its tone. The factors are tiles under a caption naming what moved it most. The working is folded under them, shut until
opened: one fact a row, a few words and the figure at the end, where a figure comes from a badge. Certainty is a sign (≈, ≤) or a
badge (*so far*), never a clause. How the analysis works is the screen's guide (*Reading the plant's figures*, the book in the top
bar), not a note on the face.

**Built in PR #144 on the screens the analysis had added:**
- **Floor → Day's line cards.** The paragraph under the tiles is a caption and a folded *How it's worked out*: hours, the pace and the
  round each with a *measured* / *set* / *typed* badge, the rounds allowed and run, the racks, each part run part-full, the parts'
  round. The card's sub keeps the units, the hours and the pieces not weighed. What went into the bath that day is a fact row.
- **Production's day card.** The sub is three short facts. *How it was weighed* folds to a route a row, the client's default keeping
  its *Change*. The pieces not weighed stay open, since they need the owner, without the reason repeated on each. The clients fold.
  The day is five fact rows. On the owner's book of 9 Oct the Overview went from 4,728 to 4,046 px on the phone.
- **Stock by line** (Stock → a line, Production → Lines): a row a line or stock line, its figure at the end, its additions folded.
- **The plant strip's round**: "plating 59 kg a round" with a *measured* badge, in place of a sentence of how it was measured.

**Measured on the owner's 9 Oct book, the phone, every page and view** (a scratch harness, never committed; counts only). It counts
text blocks over 120 characters and meta lines chaining three or more facts with "·". Floor → Day now has one block and no chain.
Production's Overview has one block. The screens still reasoning in sentences, most first:

| Screen | Blocks over 120 | Chains of 3+ |
|---|---:|---:|
| Production → Entries | 0 | 150 |
| Clients → Performance | 10 | 21 |
| Production → In plant | 5 | 30 |
| Staff → Areas | 8 | 15 |
| Stats → Overview | 13 | 5 |
| Clients → Items | 0 | 30 |
| Finance → Receivables | 4 | 11 |
| Staff → Register | 7 | 1 |
| Stats → Clients | 7 | 0 |
| Stats → Cost | 7 | 0 |
| Staff → Pay | 4 | 5 |
| Planner → Plant | 1 | 11 |
| Power → Load & bills | 4 | 2 |
| Power → Cuts | 0 | 9 |

**Proposed on 9 Oct, and folded into `docs/TAB_MAP.md` the same day** (its §3d):
1. Production → Entries and In plant: an entry's facts as fact rows or badges (its source, its weight, its match). *TM4c.*
2. Clients → Performance and Items. *TM5e, TM5f.*
3. Staff → Areas, Pay and Register: the extra's check and the wage arithmetic as folded working. *TM4b.*
4. Stats → Overview, Clients and Cost: the story cards' sentences as verdict and factors; the live cost's notes as badges. *TM2b
   (the Overview goes there).*
5. Finance → Receivables, the Planner and Power. *TM3c, TM2d, TM4e.*

Each step measures its screens before and after: this harness on the owner's book where the session has it, and P195 (the spec's
instrument, built in TM1) on a made-up long book in the repo. No step may leave a screen longer or wordier (the spec's I10).
