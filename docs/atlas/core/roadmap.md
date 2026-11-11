---
subject: "Programmes and specs: what is built and what is next"
domain: core
modules: []
specs: [docs/COGNITIVE_LOAD_SURVEY.md, docs/ENTRY_FACES.md, docs/FINANCE_INTELLIGENCE_SPEC.md, docs/INTELLIGENCE_2.md, docs/KNOWLEDGE_BASE.md, docs/KNOWLEDGE_BASE_2.md, docs/NEXT_SESSION.md, docs/PLANNER.md, docs/PLANT_PICTURE.md, docs/SERVER.md, docs/TAB_MAP.md, docs/UI_PASS_3.md, docs/UX_OVERHAUL_2.md, docs/WORKERS_AND_PLANT.md]
tests: [P195, P197]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

## Next session — read `docs/NEXT_SESSION.md` first

**Set by the owner, 24 Sep 2026.** This repo is one of three SEP repos, each worked in its own session, plus a fourth **compile session** that attaches all three and reconciles their data (canonical description: `soma-internal/docs/CROSS_REPO_SESSIONS.md`). `docs/NEXT_SESSION.md` holds the queued work — rate matcher, stock tab, to-do widget, patches — and **this repo's side of every data flow** with the other two. If a session changes one of those flows, say so in the PR.

**This repository holds no client's data: HR-10** (owner, 22 Oct 2026). It is public, and so is the page built from it. The build
seeds no client, part, price or record, and tests and examples are made up; read *What the public repository holds* (under the hard
rules) before writing an example from the book.

**Finance & intelligence work in progress — read `docs/FINANCE_INTELLIGENCE_SPEC.md` next.** Set by the owner,
26 Sep 2026: cheque placement and series, a note for a month's GST paid outside the bank, an interactive finance
dashboard, a live cost that uses the bank statement, the intelligence rules and forecast, and the tabs linked into
one picture — in seven phases, one PR each. Its §0 says what is built.

**The intelligence is being refined — read `docs/INTELLIGENCE_2.md`** (owner, 6 Oct 2026: *"Let's refine the intelligence
system"*, then *"Order works"*). Measured on the owner's book, the loudest findings rested on figures nobody had been asked
about. Five steps, one PR each: I1 an entry checked before it is believed (built), I2 confidence on every finding (built), I3 one
ranked list (built), I4 the change explained (built), I5 learning from responses (built). **Self draws are wages and personal drawings** (owner,
6 Oct 2026), which I2 builds on.

**The entry faces are begun — read `docs/ENTRY_FACES.md`** and *Entry faces* below (owner, 10 Oct 2026: *"develop app faces for each
employee to enter data"*, each on their own phone). F1 (the shell: duties on a user, Mine), F2 (the pickling hand), F3 (the
supervisor), F4 (the register clerk), F5 (the sheets on paper) and F6 (the guides) are built, and so is the flow thread (T1–T3:
turnaround targets and payment terms, the tasks they raise, the flow on Floor's Overview and a client's page).

**The planner is built — read `docs/PLANNER.md`** and *The planner* below (owner, 6 Oct 2026: simulate machinery, certification, staff, clients and a
loan, played as a game whose every figure adds up; *"start implementation sequentially and run the QA chain once the entire
implementation … is done"*). One PR, steps PL1–PL5, then the QA chain. Nothing about the shop is written into the code: the
baseline is read from the book on the device.

**The owner's rulings of 13 Oct 2026 are built** — see *The owner's rulings of 13 Oct 2026* below: challans waiting 3 and 6 days,
the challan Scan and the Gemini photo reading taken out, three cards folded on the phone, contract labour fixed, past credit
notes recorded through Record issued. The next build's order is still to be discussed with the owner.

**The workers and the plant are built — read `docs/WORKERS_AND_PLANT.md`** and *Workers and the plant* below (owner, 7 Oct 2026: the
roster with skills, personal details, tenure, reliability, consistency and a motivation index; the production area unit by unit;
ID cards with a QR and a scanner; one office QR for checking in from a worker's own phone). Five steps, W1–W5, one PR.

**UI pass 3 is built — read `docs/UI_PASS_3.md`** (owner, 15–16 Oct 2026: *"We could really use another UI design pass"*, a
*"modern looking dashboard"*, a Home page with the time, predictions and Tata Motors' news; the design confirmed on a canvas: *"B with
wells, 4-digit PIN, widgets should be flexible so different layouts are possible without breaking the UI"*, then *"Yes to Home, all of
1–11, news Worker now, no Hindi"*). Cards that lift and wells for what is pressed or filled; icons v3; eight chart builders and a table
behind every chart; widgets on boards each person arranges (Home, then Stats); Pulse folded into Home; a feeds Worker for the news
(GDELT) and the weather (MET Norway); guided Enter by hand; People leads; the power case and the reports a picture first; a sign-in
with a 4-digit PIN. Nine steps, U1–U9, one PR, **a stop after U2 for the owner to look**. Written to `docs/SERVER.md`: widgets read
views shaped like the hub's typed tables, and the one change four digits force on the server plan is said (§15c). **U1 and U2 are
built** (16 Oct 2026): the look (*UI pass 3: the look* below), icons v3, charts v3 and the data layer; Home, its board of widgets, the
gallery and the feeds (*UI pass 3: Home and its widgets* below). **The owner looked** (17 Oct 2026: *"looking for a more finished
product"*, then *"different types of card layouts but organised … Same for … the action rows"*): the card family was drawn on a canvas
and specified, `docs/UI_PASS_3.md` §24, step **U2R**, and **U2R is built** (20 Oct 2026; *UI pass 3: the card family* below): one
skeleton, seven card types, five action rows, a card exactly its size's height on a board packed dense, money short on a board,
figures in Geist, Home's verdict a flat masthead. **The owner looked again** (21 Oct 2026: *"Home screen should not feel heavy, and
should lead and prioritise the user, control attention, makes information effortless, has a clear objective"*), and **Home was made to
lead the same day** (*UI pass 3: Home leads* below, `docs/UI_PASS_3.md` §25): the masthead's first move, about seven cards on the phone,
cards as tall as they need, edges only for today, the news and the weather straight from their sources, a day the plant is shut, Needs
you's count a badge. **The owner looked: *"Home screen test - pass"* (4 Nov 2026)**, and U3–U9 were refreshed against the code the
same day (`docs/UI_PASS_3.md` §26: Stats' presets and period, the forms built since §11a, People's night and cash paid out, the
screens U7 reaches, the PIN and icons as they are, one PR a step). **U3 is built** (4 Nov 2026; *UI pass 3: Stats as a dashboard*
below): Stats is a Dashboard of widgets and its Tables. **U4 is built** (4 Nov 2026; *UI pass 3: every Enter by hand a guided flow*
below): every form filled by hand is numbered steps with a preview of what Save records, Stock's Spend and prices takes the room, two
stock lines merge into one. **U5 is built** (5 Nov 2026; *UI pass 3: People leads* below): People's views open on their next steps
and a picture, the Roster as cards. **U6 is built** (5 Nov 2026; *UI pass 3: a picture first* below): the power case and the reports
lead with one A4 page, the text under its toggle. **U7 is built** (5 Nov 2026; *UI pass 3: across the app* below): every hero takes
the board's rule for its tone, lists stand in a card, dialogs, toasts, badges and search in the look, one set of blank states, and
first-visit pointers. **U8 is built** (6 Nov 2026; *UI pass 3: sign-in* below): the sign-in on both layouts, the
4-digit PIN and the keypad, a PIN from before asked to become four digits, the icons from the mark, SERVER.md §4 amended. **U9 is built**
(6 Nov 2026): the docs and every screen measured before and after the pass (`docs/UI_PASS_3.md` §26n). **UI pass 3 is built**, and
its QA chain ran the same day (*The QA chain of 6 Nov 2026* below, `docs/UI_PASS_3.md` §26o).

**The server is specified — read `docs/SERVER.md`** (owner, 15 Oct 2026: *"We definitely need SQL to store our data"*; the hub
both in the cloud and in the office). A Cloudflare Worker and D1 at `api.somaelectro.co.in` on the owner's own Cloudflare account,
the office PC (Windows, on a UPS, signed in) a copy of all of it, its backups and the print station; every device stays offline-first.
Six steps, S0–S5, one PR each: the app moves to `app.somaelectro.co.in` first, publishing the app's files only (S0, the book and each
device's registration handed over); sync is record by record from S1, merged on the server by the same `merge.js` with compare-and-set
writes; **everything goes to the server, the sensitive sealed** (encrypted on the owner's devices, the key wrapped by the owner's PIN;
the review's answers, 15 Oct 2026); *Ask* answers from the published articles through Claude on the server (S4); an APK (S5), its
shell chosen once the phone the web app will not open on is diagnosed. The free plan first, reported on after a week. Not built;
KB2-2 onward builds on it.

**The knowledge base's second edition is specified — read `docs/KNOWLEDGE_BASE_2.md`** (owner, 14–15 Oct 2026: *"lots of blocks of
texts … weak visual hierarchy"*; four directions drawn, then ruled). Three ways to read (Quick reference with *At a glance*, Reader set as
a manual with no tick boxes, Guided for training), the desk on the desktop (the Library left, the article in the middle, its context
right: the plant now, links, feeds, outputs, notes public and the owner's private), and **tracking** after SproutLab's CareTickets: a
fault, a process, a client requirement, checked from Mine and closed by what the book records. Four releases, one PR each: KB2-1 the
look, KB2-2 faults, KB2-3 processes, KB2-4 requirements. **KB2-1 is built** (*The knowledge base, second edition* below); KB2-2 builds on
the server (`docs/SERVER.md`).

**The knowledge base is built — `docs/KNOWLEDGE_BASE.md`** (owner, 2–5 Oct 2026: *"a training ground, a troubleshooting area, a
record keeper, a tool used to make decisions"*). The chatbot is next and answers from it. See *The knowledge base* below.

**The tab map and the cognitive load are one spec — read `docs/TAB_MAP.md`** (owner, 8–9 Oct 2026: four sections with one
overview each, Insights in Today, Bills & notes split, a cheque in hand counted as paid; then *"Spec cognitive load into our previous
spec that's still to be implemented. Combine them into one spec."*). Seven steps in one PR: TM1 the shell (with the phone's Filter
and More, and P195, the benchmark's instrument), TM2 Today, TM3 Money, TM4 Floor, TM5 Office, TM6 across the app, TM7 the docs and
the measures. Every surveyed screen has its step and its target (§3d), the calls the spec makes are listed for the owner (§1a), and
no step may leave a screen longer (I10). **Revised the same day with one look** (owner: *"UI still feels inconsistent to me … we
need to plan properly"*): a census of every screen found the components consistent and the screens' assembly not (of 60 phone
screens and views, 34 lead with no summary at all; the rest lead five different ways). §3e gives four kinds of screen (overview,
work, document, form) one anatomy each, one verdict card (`uiVerdictHtml`), one toolbar row on both layouts and one action at a
row's end, held by P197; TM6f takes the screens no step touched, and the build stops after TM2 for the owner to look. **Being built**
(owner, 9 Oct 2026: *"Merge and go with all 14. E2E. Be thorough, run QA chain before final merge, merge once CI is green"*): TM1 is
built, then TM2; the owner looked (10 Oct 2026: *"Go ahead"*), and TM3 to TM7 are built (*The tab map* below; TM7 put the map and
the benchmark into the design principles, §4 and §4.3, with DR-9, and measured every screen on the owner's book); then the QA chain.

**The cognitive-load survey is done — read `docs/COGNITIVE_LOAD_SURVEY.md`** (owner, 8 Oct 2026: *"survey all the screens to make
sure the app is up to the mark for our cognitive load benchmark"*). Every screen on both layouts scored against the rules it names
(the 6-second test, what needs the owner leads, length, one fact one screen, Today's card language, the design rules, HR-9). Its
proposals, with its *Analysed data* list, are now the tab map's steps (above).

**The plant picture is begun — read `docs/PLANT_PICTURE.md`** (owner, 9 Oct 2026: *"There is no holistic vision that is being created
using these details"*). PP1 is built: a day's plating in one unit, each line's efficiency colouring Floor's cards (half a line's units
down is red), the pieces not weighed followed up. PP3 is built: the bath a stock message names, zinc and chemicals by line (*Stock by
line* below). PP2, PP4 and PP5 (the line over time, equipment and money, the period whole) are proposed; **the order is the owner's.**

**An analysis on screen is a verdict, its factors and the working folded** (owner, 9 Oct 2026: *"The times lost most reads like a block
of text and is not presented according to our benchmark"*, and *"lots of new chaotic text data is entering due to the analysis …
designing a way to present our analysed data in a coherent manner"*; design §6.27). The verdict leads in its tone. The factors are tiles
under a caption naming what moved it most. *How it's worked out* is folded under them, shut until opened: one fact a row
(`uiFactRowHtml`, `uiFoldRowHtml`, `uiWorkingHtml`, state.js), a few words and the figure at the end, where a figure comes from a
badge (*measured*, *set*, *typed*, *so far*, *shared*). Certainty is a sign (≈, ≤) or a badge, never a clause. How the analysis works
is the screen's guide (*Reading the plant's figures*, kbguides.js), not a note on the face. A new analysis is drawn this way. The
screens that still reason in sentences are measured in `docs/COGNITIVE_LOAD_SURVEY.md` (*Analysed data*) and fixed in the tab map's
steps (`docs/TAB_MAP.md` §3d).

**UX overhaul 2 is planned — read `docs/UX_OVERHAUL_2.md`.** Agreed with the owner, 28 Sep 2026: navigation with a
back trail, a version guard so two windows can edit safely, every screen openable in a new window, search (a chatbot
later), keyboard shortcuts, a pass on the screens that scroll too far, and desktop layouts — one PR each, in its order.
Every step is built: the phone's selection bars (0), the dialog guard (0b), the version guard (2), navigation (1), the length pass
(6, brought forward by the owner on 29 Sep 2026), search, keys and new windows (3–5, with Direction B) and the desktop layouts (7,
2 Oct 2026, then the QA chain the same day). The owner reordered the steps on 29 Sep 2026: the version guard came before navigation.
