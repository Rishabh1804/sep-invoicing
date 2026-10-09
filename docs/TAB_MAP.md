# The tab map and the cognitive load (spec, 9 Oct 2026)

The owner, 8 Oct 2026: *"let's also work on organising the tabs under our 4 main sections. Currently, Office holds multiple
tabs, those hold multiple tabs too, same for Money and other sub tabs too. Let's discuss this along with the survey that's
done."* The map was drawn as a page (the before-and-after, with four calls), and on 9 Oct 2026: *"Go with all four
recommendations. Generate a spec file that can be followed by agents to ensure bug free and as-intended development … We'll run
the QA chain when it is coded and ready for deployment."* Then: *"Pending deposit should also be an option on payments, as
sometimes it can take days before a received cheque is submitted but thats payment done from the clients end and that must be
reflected"* (TM3b).

The survey the map was discussed with (`docs/COGNITIVE_LOAD_SURVEY.md`; owner, 8 Oct 2026: *"survey all the screens to make sure
the app is up to the mark for our cognitive load benchmark"*) proposed fixes of its own. On 9 Oct the analysis added to Floor and
Production showed the same fault in a new form (owner: *"The times lost most reads like a block of text and is not presented
according to our benchmark, where we are looking to reduce cognitive load"*, and *"Lots of new chaotic text data is entering due to
the analysis, that means we are [not] spending enough time and resources on designing a way to present our analysed data in a
coherent manner"*). Then: *"Spec cognitive load into our previous spec that's still to be implemented. Combine them into one
spec."* **This is that one spec**: the map's moves and the survey's fixes, screen by screen, in one order.

**Why one order.** A screen that moves is fixed where it lands, in the same step, and a screen that goes is not fixed first:
Stats → Overview (10.9 phone screens) is not shortened, because TM2 takes it apart, and the To-do's second card style goes with the
To-do. Each section's step leaves its screens meeting the benchmark (§3b), measured before and after (I10).

This file is the spec builders follow. **One PR, steps TM1–TM7, one commit (or more) per step, in order; then the QA chain on the
owner's word.** Read §1–§5 before any step, then the step's own section. Nothing here changes what the book records except TM3b.

## 0. Status

| Step | What | State |
|---|---|---|
| TM1 | The shell: the rows, the tools in the top bar, Sales, Parts, the redirect table, the names; the phone's toolbar (Filter, More); the benchmark's instrument (P195) | Not built |
| TM2 | Today: the To-do into Needs you, Pulse takes Stats → Overview and stays short, Stats' three tabs led by verdicts, Pulse's widgets, the Planner's Moves and header, Reports fitted | Not built |
| TM3 | Money and Invoices: Bills & notes split (TM3a); cheques awaiting deposit (TM3b); Money's screens led by what needs the owner (TM3c) | Not built |
| TM4 | Floor: one Overview, People's Attendance, the page Overviews out; every Floor screen led by its verdict, its long rows folded | Not built |
| TM5 | Office: Pipeline, Challans and Invoices led by verdicts and coloured by age, Clients' dot and word, Parts, Performance's hero, Sales, Create | Not built |
| TM6 | Across the app: one tone per fact, the period to date in every chart, History, Knowledge → Training, the last long notes and toolbars | Not built |
| TM7 | Docs, the full suite, every screen measured against §3d, the real-book harness, the draft PR | Not built |

## 1. The rulings

1. **Insights go in Today**, beside Pulse: Stats, Reports, Planner. History and Knowledge leave every row (§2, tools).
2. **One overview per section.** Floor's Overview (Floor → Day, renamed) carries a card each for people, production, stock and
   power; the Overviews of People, Production, Stock and Power go, and their charts move to the tab they explain.
3. **Bills & notes split.** Bills (electricity and other) go to Money → Payments; credit notes to Office → Invoices.
4. **Pulse's widgets: only what Needs you doesn't show.** To-do, Recent invoices and Money are hidden in every preset. This
   settles the survey's open call on Pulse's defaults.
5. **The cognitive load** (owner, 8 and 9 Oct 2026). Every screen passes the 6-second test and what needs the owner leads. Today's
   card language is taken to the other tabs. An analysis on screen is a verdict, its factors and its working folded (§3c, design
   §6.27). The survey's proposals and its *Analysed data* list are this spec's steps (§3d says which); the survey stays as the
   record of what was measured.

Names settled with them (one word, one meaning): Items → **Parts**; Stats → Clients → **By client**; People's Day, Week and
Register → one **Attendance** tab with a Day · Week · Month switch; Floor → Day → **Overview**; the Planner's Plant, Tech tree,
Staff, Clients and Finance → one **Moves** tab with a switch; Clients' Quotations and Prospects → **Sales** in Office's row.

Owner's addition (9 Oct 2026): **a cheque received from a client and not yet deposited counts as paid by the client** (TM3b). It
lives in Money → Receivables, where client payments are matched; Payments is money going out (said to the owner).

### 1a. Calls this spec makes (the owner's to change before the build)

1. **Floor's line cards lead with the worst**: danger, then warning, ok and info, with ties in line order (VAT A1, VAT A2, Barrel).
   The survey found the line needing the owner was the last card.
2. **On the phone a long toolbar is one row**: the search, the screen's primary where its toolbar holds one, **Filter** and **More**.
   Filter holds the filters and the sort, and the applied ones show as tokens under the row. More holds the rest. A mode used at
   every sitting stays on the row (Invoices' Select, which raises a credit note's batch). The desktop's toolbars are unchanged.
3. **Pulse's three cards from Stats** (Why it moved, In one line, the pace) fold to their verdict line on the phone and are open
   on the desktop.
4. **A challan waiting is judged by its age**: amber from the To-do's own days (Settings, 5), red from twice that. The To-do's
   challan task takes the same tone (today it is info at every age), so the row and the task agree.
5. **A method paragraph goes into its screen's guide** (the book in the top bar), and the face keeps one line at most.
6. **The period to date is drawn as to date in every chart**: a line's last stretch dashed, a bar lighter, its label marked.
7. **A tile in Power → Causes is toned only from three cuts.** With fewer it reads plain, with its count.
8. **Payments opens on what needs the owner**: the payees not yet sorted, then the months with no electricity bill, then the
   bills and the rest.

## 2. The map, exactly

Level 1 is the bar (phone) and the rail (desktop): **Today · Office · Add · Floor · Money**, unchanged. Level 2 is the section's
row (`#wsTabs`, `WORKSPACES`). Level 3 is a screen's own row. A switch (`inv-seg`, `aria-pressed`) is a control, not a tab.

### Today, the whole business (`today`)
| Row entry | Page · v | The screen's own row |
|---|---|---|
| Needs you | `pageHome` · `needs` | none (the To-do joins it: TM2) |
| Pulse | `pageHome` · `pulse` | none |
| Stats *(group label "Insights")* | `pageStats` | By client (`clients`) · Cost (`cost`) · Trends (`trends`) |
| Reports | `pageReports` | none (Daily … Yearly is a switch) |
| Planner | `pagePlanner` | Play · Ledger · A day · Moves (`moves/<kind>`; a switch: Plant · Tech tree · Staff · Clients · Finance) |

`members: []` (the To-do page is retired).

### Office, the paperwork (`office`)
| Row entry | Page · v | The screen's own row |
|---|---|---|
| Pipeline | `pagePipeline` | none (gains the dispatch cycle card, TM2) |
| Challans | `pageIM` | Awaiting invoice · Invoiced |
| Invoices | `pageRegister` | none (Credit notes and Number audit are its dialogs; credit notes gain Record and New, TM3a) |
| Clients | `pageClients` · `clients`, covers `clients`, `items`, `performance` | Clients · Parts (`items`) · Performance |
| Sales | `pageClients` · `prospects`, covers `prospects`, `quotes` | Prospects · Quotations (`quotes`) |

`members: ['pageCreate']`.

### Floor, the plant (`floor`)
| Row entry | Page | The screen's own row |
|---|---|---|
| Overview | `pageFloor` | none (the day stepper stays) |
| People | `pageStaff` | Attendance (`day`, `week`, `register`; a Day · Week · Month switch) · Pay · Areas · Roster |
| Production | `pageProduction` | Lines · In plant (`plant`) · Entries · Equipment |
| Stock | `pageStock` | none: one screen |
| Power | `pagePower` | Cuts · Causes · Load & bills (`load`) · Case |

### Money, the cash (`money`)
One view, `pageFinance`, so its own row is the section's row: **Overview · Receivables (`receipts`) · Payments · Bank · GST**.

### Tools: in the top bar on every screen, both layouts
**Search · Knowledge (the book) · History (a clock) · Settings.** `pageKnow` and `pageHistory` belong to no workspace
(`wsOf()` is null): no door lit, no section row, the title is the page's own, no swipe, a task jumping there counts on Today.

### Counts (P184 asserts them)
68 tabs become 51; no row wider than five; two screens are called Overview (Floor's and Money's), Pulse and Pipeline lead the
other two sections.

## 3. The rules

### 3a. The map (amend `docs/SEP_INVOICING_DESIGN_PRINCIPLES.md` §4 with these, TM7)

1. **Four sections, by subject.** Today is the whole business, Office the paperwork, Floor the plant, Money the cash. Add is a door.
2. **One overview per section, first in its row:** Pulse, Pipeline, Floor's Overview, Money's Overview.
3. **Three levels at most:** the bar, the section's row, the screen's row. A form, a record or a review opens behind a back arrow
   (a sub-view) or in a dialog, never in another row.
4. **No row wider than five**, so every row fits a phone.
5. **One word, one meaning.** No tab name stands for two different places.
6. **A switch is not a tab.** Day / week / month, revenue / tonnage, the period: a segmented control on the screen.
7. **Tools sit on every screen**, in the top bar, never in a row.

### 3b. The benchmark (a screen passes when; a design section of its own, TM7)

The survey's rules (`docs/COGNITIVE_LOAD_SURVEY.md`), read together, with what measures each:

1. **The 6-second test**: one glance at the first screen says the state. A verdict leads, in its tone, and carries `data-verdict`.
   P195 checks it sits inside the first phone screen on every screen §3d marks *verdict*.
2. **What needs the owner leads**: a raised task, a red figure or a question comes before anything fine. Finished records go in
   their own view tab or a fold.
3. **A long list shows its recent part**: `uiMoreHtml` (thirty rows, ten where each row is a question). The head's count and every
   total still cover the whole list.
4. **A card taller than a screen folds** to its summary line (`uiFoldHtml`, `uiFoldCard`, `uiFoldRowHtml`), remembered per device.
5. **One fact, one screen** (I8): its other screens keep at most a link.
6. **About three phone screens or fewer** (P195's `screens`), unless the screen is the day's work list (Needs you).
7. **Today's card language**: a hero with a one-line verdict in its tone, opening to boxes coded by their own status (design
   §6.21–6.26).
8. **The design rules** DR-1…DR-8:
   - colour means status, beside a word;
   - one accent, and one primary per view;
   - figures mono and right-aligned;
   - sentence case;
   - status is a dot or a badge, and a word;
   - a judged figure sits in its tone beside its reason.
9. **No large blank areas, nothing cut, nothing past the screen's edge** (P76).
10. **HR-9, no white** (P76, P180).
11. **Words are short** (the analysed data). No text block on a face runs over 120 characters (P195's `blocks`). No meta line
    chains three or more facts with "·" (P195's `chains`). A row's meta says two things; a third becomes a badge, the row's end
    figure, or a fact row in its fold.
12. **Controls are short**: on the phone a screen's toolbar is at most two rows, the controls and the tokens (P195's
    `toolbarRows`).

### 3c. An analysis on screen (design §6.27)

- **The verdict leads**, in its tone.
- **The factors are tiles**, under a caption naming what moved the verdict most.
- **The working is folded** under them, shut until opened: one fact a row (`uiFactRowHtml`), a few words with the figure at the
  end. Where a figure came from is a badge: *measured*, *set*, *typed*, *so far*.
- **Certainty is a sign** (≈, ≤, ≥) or a badge, never a clause.
- **How the analysis works goes in the screen's guide** (`kbguides.js`, the book in the top bar), not in a note on the face.
- A note is one line at most, and nothing inside a card draws a page-coloured band.

Every analysis a step adds, and every one this spec touches, takes this shape.

### 3d. The targets: every surveyed screen and its step

The survey's measures on the owner's book: phone screens, with the desktop in brackets, and the verdict (P passes, C close, N
needs work). Blocks over 120 characters and chains of three or more come from its *Analysed data* (9 Oct), where measured.
*Verdict* in the last column means §3b-1 applies (P195 checks it). The targets are for the owner's book; P195 holds the sweep's
long book to the same rules (I10).

| Screen (as surveyed) | Measured | Step | Target |
|---|---|---|---|
| Today → Needs you | 2.6 (1.5) C | TM2a | the day's work list; gains Add, Done and Snoozed (folded); red tasks still lead on the phone |
| Today → Pulse | 5.5 (3.0) N | TM2b, TM2c | ≤ 3.5 with three widgets hidden and the moved cards folded; verdict per question |
| Insights → Stats (Overview) | 10.9 (5.5) N; 13 blocks, 5 chains | TM2b | goes: its questions are Pulse's, the rest moves |
| Stats → Clients (By client) | 4.8 N; 7 blocks | TM2b | ≤ 3; verdict; 0 blocks |
| Stats → Cost | 4.4 N; 7 blocks | TM2b | ≤ 3; verdict; sources as badges; 0 blocks |
| Stats → Billing, Trends | 1.4, 1.7 C | TM2b, TM6b | Billing goes; Trends leads with the headline; the month to date marked |
| Insights → Reports | 6.2 (4.5) C | TM2f | fitted to the screen |
| Insights → Planner (8 views) | 1.7–4.9 N; Plant 1 block, 11 chains | TM2d | four views; the header once; rows on the phone; 0 chains |
| To-do | 2.3 (1.4) N | TM2a | goes: one card style (Needs you) |
| Money → Overview | 5.8 (4.5) N | TM3c | ≤ 3; verdict |
| Money → Receivables | 1.8–3.1 C; 4 blocks, 11 chains | TM3c | the method in the guide; 0 blocks, 0 chains |
| Money → Bank, Bills & notes | 1.8–3.1 C | TM3a, TM3c | Bills & notes goes; the statement first |
| Money → Payments | 2.6 (1.8) N | TM3c | what needs the owner first; the amount whole |
| Money → GST | 1.0 C | TM3c | nothing cut on the phone |
| Floor → Day (Overview) | 1.5 (1.0) C | TM4a | verdict; the worst line first |
| People → Overview | 2.7 (1.6) N | TM4b | goes |
| People → Day | 6.7 (2.5) N | TM4b | ≤ 4 |
| People → Week | 3.8 (2.5) N | TM4b | ≤ 3; verdict |
| People → Register (Month) | 4.0 (2.5) C; 7 blocks, 1 chain | TM4b | ≤ 3; verdict; cells toned; 0 blocks |
| People → Pay | 3.8 (2.5) C; 4 blocks, 5 chains | TM4b | ≤ 3; payout against its usual; 0 blocks, 0 chains |
| People → Areas | 4.2 (2.2) N; 8 blocks, 15 chains | TM4b | ≤ 3; verdict; 0 blocks, 0 chains |
| People → Roster | 4.3 (1.0) C | TM4b | who to watch leads |
| Production → Overview | 2.6 (1.2) N | TM4c | goes |
| Production → Equipment | 1.0 C | TM4c | Add a unit the primary |
| Production → In plant | 3.6 (2.3) N; 5 blocks, 30 chains | TM4c | ≤ 3; verdict; 0 blocks, 0 chains |
| Production → Lines | 1.7 (1.0) C | TM4c | toned |
| Production → Entries | 16.9 (1.0) N; 150 chains | TM4c | ≤ 3; 0 chains |
| Stock → Overview | 3.5 (1.9) N | TM4d | goes |
| Stock → Lines | 2.1 (1.0) C | TM4d | one toolbar row; verdict |
| Power → Overview | 2.2 (1.2) N | TM4e | goes |
| Power → Cuts, Load & bills | 1.6, 1.7 C; Cuts 9 chains, Load 4 blocks, 2 chains | TM4e | verdict; the red callout first; 0 blocks, 0 chains |
| Power → Causes | 2.2 (1.0) N | TM4e | tiles toned only when firm; To complete once |
| Power → Case (paper) | 3.7 C | TM4e | fitted to the screen |
| Office → Pipeline | 1.6 (1.0) C | TM5a | verdict; stages coded |
| Office → Challans | 1.3 (1.0) N | TM5b | verdict; rows toned by age |
| Office → Invoices | 3.0 (1.0) N | TM5c | ≤ 2 rows of controls; verdict |
| Office → Clients | 2.0 (1.0) N | TM5d | a dot and a word per client; verdict |
| Clients → Items (Parts) | 2.8 (1.0) C; 30 chains | TM5e | one toolbar row; the job waiting leads; 0 chains |
| Clients → Performance | 3.8 (4.9) N; 10 blocks, 21 chains | TM5f | ≤ 3; verdict; 0 blocks, 0 chains |
| Clients → Quotations, Prospects (Sales) | 1.0 C | TM5g | the reprice moves shown; one spare |
| Create | 1.0 C | TM5h | no error before a try |
| Insights → History | 3.0 (1.0) C | TM6c | ≤ 2 rows of controls |
| Insights → Knowledge | 1.0–2.9 C | TM6d | Training: verdict, rows by status |

## 4. Invariants (every step, every builder)

- **I1. The book does not change** (except TM3b's `S.bank.cheques`, which is new). No migration, no key renamed, no export
  changed except TM3b's. This is navigation and drawing. Device-side keys (localStorage) may change as each step says.
- **I2. Every old address still opens** where its screen went, through the one redirect table (§5): a bookmark, a manifest
  shortcut, the Windows widget's launch URL, a step of the back trail saved in sessionStorage by an older build, a new window,
  a KB link, a search Recent entry, a To-do task saved with a `go` naming an old view. A remembered view in localStorage whose
  value no longer exists falls back to the screen's new default.
- **I3. No dangling door.** A step that moves or removes a view re-points, in the same step, every door to it: `todoGo` kinds,
  `advGoTo` kinds, `WS_GO_PAGE`, the search index (`srchScreens`, `SRCH_SPACES`, `srchEntryLoc`, `srchLocOf`), Pulse's widgets'
  links, quick actions, Add's routes, `finlinks.js`, report links, the KB guides (`kbguides.js`: text **and** the next `version`),
  help and note text that names the old path, `CHG_*` section labels that name a path. The step's grep checklist comes back empty.
- **I4. Roles.** A card, a door, a link or a count shows a role only what its screens show: the page by `grdSees(page)`, wages by
  `grdSeesWages()` / `attSeesWages()`, money by `grdSeesMoney()` / `finSeen()`, tasks by `todoSees`. A new card checks what its
  page checks. A link a role could not follow is drawn as text, not a button. **A verdict says only what its role may see**: a
  verdict naming rupees falls back to its count for a role without money.
- **I5. The house rules.** HR-1…HR-9 and DR-1…DR-8 (CLAUDE.md). One primary per view (`.inv-btn-primary` outside
  `[data-shell-primary]`, P76). No `confirm()` / `alert()` / `prompt()`: `uiConfirm` / `uiAlert` / `uiPrompt`. A `<select>`
  speaks through `change`, never `data-action`. A change inside a view redraws in `keepScroll`; only a navigation calls `viewTop()`.
  A new door that leaves a form is in `NAV_LEAVE_ACTIONS` or is `role="tab"`. `escHtml` on every user string. **Every new
  top-level name is grepped across `split/*.js` first** (one global scope; a later module silently replaces an earlier one).
- **I6. Tests.** No test is deleted, skipped or weakened to get green. A test asserting a view that moved, or a control that went
  behind Filter or More on the phone, is rewritten to assert the same fact where it now lives (§8 lists them). Each step adds or
  extends its spec (P184–P188, P193–P195), which must fail on the build before the step. The full suite is green at the end of
  each step (`pnpm exec playwright test`, about 13 minutes; not a hang).
- **I7. Both layouts.** Every change is checked on the phone (393 px) and the desktop (1280 px). The list-and-pane screens keep
  filling the room on the desktop (P80): nothing added above a `.inv-pane-host` may make the page scroll.
- **I8. One fact, one screen.** A card that moves is moved, not copied. Its old home keeps at most a link.
- **I9. Build and commit.** `bash split/build.sh` after every edit to `split/` (the pre-commit hook rebuilds too); never edit
  `sep-invoicing.html`, `index.html` or `version.json` by hand. Commit trailers as CLAUDE.md says; no model name anywhere.
- **I10. Measured, never longer.** P195 (TM1) measures every screen of §2 on the phone over the long book: phone screens, blocks
  over 120 characters, chains of three or more, toolbar rows, and whether a verdict leads where §3d asks for one.
  - A step measures its screens before it starts and after it ends. In the same commit it lowers their budgets in P195 to the
    new measure, and its report gives before → after.
  - Where the session has the owner's book in the scratchpad (never committed), the step also runs the survey's harness on it and
    reports the same counts.
  - **A budget is never raised to get green.** A screen that gains a card gives the room back in the same step (a fold, a hidden
    widget, a moved card). If it cannot, the step stops and says so to the owner.
  - By TM7 every screen meets §3b, or the report names the screen, the rule and why.

## 5. The redirect table

One pure helper in `nav.js`, **`navRedirect(loc) → loc`**, applied (a) in `navLocFromUrl` before its `isPageId` test, so a
removed page id still redirects, and (b) at the head of `navApply`, so a saved `history.state` or trail step redirects too. It
returns a new `{tab, v, id, d}`; an address it does not know is returned unchanged. **Each step adds its own rows when it
removes the place** (never earlier: a row added before its step would hide a screen that still exists). TM5 and TM6 remove no
place, so they add no row.

| Step | Old address | Opens |
|---|---|---|
| TM2 | `?tab=pageTodo` (any v) | `pageHome` · `needs` (a `todo=` launch parameter still works: init.js reads it once `navLocFromUrl` returns the redirected place) |
| TM2 | `pageStats` · `overview` | `pageHome` · `pulse` |
| TM2 | `pageStats` · `billing` | `pagePipeline` |
| TM2 | `pagePlanner` · `plant` / `tech` / `staff` / `clients` / `finance` | `pagePlanner` · `moves/<that kind>` |
| TM3a | `pageFinance` · `bills` | `pageFinance` · `payments` |
| TM4 | `pageStaff` · `overview` | `pageFloor` |
| TM4 | `pageProduction` · `overview` | `pageFloor` |
| TM4 | `pageProduction` · `overview/paste` / `overview/hand` / `overview/photo` | `pageProduction` · `lines/<the same sub-view>` (a form open stays open) |
| TM4 | `pagePower` · `overview` | `pageFloor` |
| TM4 | `pageStock` · `overview` | `pageStock` · `list` |

The same mapping governs the remembered keys: `sep_inv_stats_tab` (`overview`/`billing` → `clients`), `sep_inv_planner_view`
(an old kind → `moves` with that kind), `sep_inv_fin_tab` (`bills` → `payments`), `sep_inv_prod_tab` (`overview` → `lines`),
`sep_inv_power_tab` (`overview` → `cuts`); and `regFilter.activeTab` restored from `sep_inv_view_prefs` (`pageTodo` →
`pageHome`). `todoGo` and `advGoTo` map the old values a saved task may carry: `{kind:'stats', tab:'overview'}` → Pulse,
`{tab:'billing'}` → Pipeline, `{kind:'bills'}` → Payments (TM3a), `{kind:'planner', v:'tech'}` → Moves · Tech tree,
`{kind:'production'}` with no tab or `overview` → Lines, `{kind:'power'}` with no tab or `overview` → Cuts.

## 6. The steps

### TM1 — The shell

**Goal:** the rows of §2 (with the screens as they are today: Stats still has five tabs until TM2, and so on), Sales and Parts,
the tools in the top bar, the redirect helper, the names; and the two pieces every later step uses, the phone's toolbar and the
benchmark's instrument. Files: `workspace.js`, `nav.js`, `tabs.js`, `body.html`, `items.js`, `search.js`, `guard.js`,
`kbguides.js`, `state.js`, `styles.css` (only if a class is needed), `tests/e2e/fixtures.ts`, `tests/e2e/load-fixture.ts` (new).

1. **`WORKSPACES`** exactly as §2 (Today: Needs you, Pulse, Stats with `group: 'Insights'`, Reports, Planner, `members: []` is
   set in TM2 when the To-do goes; keep `members: ['pageTodo']` until then. Office: Pipeline, Challans, Invoices, Clients
   `{tab:'pageClients', v:'clients', vs:['clients','items','performance']}`, Sales `{tab:'pageClients', v:'prospects',
   vs:['prospects','quotes']}`. Floor: the first view labelled **Overview**. Money unchanged.) `pageHistory` and `pageKnow` are
   in no workspace.
2. **A view with `vs`** (new, `workspace.js`): `wsViewOn` picks the view whose `v` equals the address's first segment **or whose
   `vs` contains it**; `wsPageName` matches the same way; `wsShellDraw` remembers, for such a view, the page's current v (so
   Office's door returns to Quotations if that was open), not the entry's default. `wsSwipeTarget` needs no change (it walks
   `views`). Ctrl/middle-click on a row tab opens `{tab, v}` (search.js `srchLocOf`, unchanged).
3. **Clients' own row** (`items.js` `_buildSubViewToggle`) draws only the group the active sub-view is in: `clients`,
   `items`, `performance` → **Clients · Parts · Performance**; `prospects`, `quotes` → **Prospects · Quotations**. Label `Items` →
   `Parts` everywhere a tab, a heading or a path names the parts master to the user (search entry `items` label "Parts", words
   keep "items"; `quote.js` "(Items → Part weights)" and `create.js` "Items → Part weights" → "Clients → Parts → Part weights").
   The internal sub-view id stays `items`.
4. **`navLabel`** (nav.js): Clients `items` → "Parts", `prospects` → "Prospects" (missing today), Stock `check` → "To check"
   (missing today).
5. **Tools in the top bar** (`body.html`): a **History** button with a clock icon, phone (`inv-topbar-btn`) and desktop (ghost
   icon button, as the book's pair), `data-action="invGoHistory"` → `navOpen({tab:'pageHistory', v:'', id:''})`. Hidden for a
   role that does not see `pageHistory` (`grdApplyDoors`: add `.inv-topbar [data-action="invGoHistory"]`). Order on the phone:
   Search · History · Knowledge · Settings (the guard user button where it is). `invGoHistory` and `invGoPulse` (the rail's
   mark, a known gap) join `NAV_LEAVE_ACTIONS`.
6. **`PAGE_TITLES`** say the map's names (they reach users in refusal toasts, the guard's roles grid and render notices):
   `pageHome` "Today", `pageRegister` "Invoices", `pageStaff` "People", `pageFinance` "Money", `pageFloor` "Floor overview";
   `GRD_PAGE_FALLBACK.pageFloor` "Floor overview"; the roles grid's rows "Wages (People → Pay)" and "Money (Money, Stats,
   Reports, Planner)".
7. **`navRedirect`** (§5) in `nav.js`, wired into `navLocFromUrl` and `navApply`, with an empty table (TM2–TM4 add rows). P184
   tests it with a row injected by the test (`page.evaluate`), so the mechanism is proven before any row exists.
8. **Search** (`search.js`): every entry's where-label follows the map (Stats, Reports, Planner: "Today", "Today › Stats", "Today
   › Planner"; History, Knowledge: "Top bar"; Clients' Quotations and Prospects: "Office › Sales"; a new entry `sales` "Sales" →
   `at('pageClients','prospects')`; Day → "Overview", "Floor"); `SRCH_SPACES` (Go to and the G keys): Today `['needs','pulse',
   'stats','reports','planner']`, Office `['pipeline','im','register','clients','sales']`, Floor `['floor','people','production',
   'stock','power']`, Money `['money']`; the keys dialog's labels.
9. **KB guides** (`kbguides.js`): "Office → **Planner**" → "Today → **Planner**"; any text naming Day on the Floor row; bump each
   changed guide's `version`.
10. **Fixtures** (`tests/e2e/fixtures.ts`): `WS_OF` restates the new map (pageStats, pageReports, pagePlanner → today; pageHistory,
    pageKnow → none: the helper opens them through the top bar's button or `navOpen`); `switchTab` still works for every page.
11. **The phone's toolbar** (`state.js`; design §6.6 and §6.7 amended in this step). Two helpers, drawn on the phone only (the
    desktop draws its toolbars as now). They are applied to no screen in TM1; each later step says where.
    - **`uiToolbarMoreHtml(items)`**: a **More** button (secondary, small, an ellipsis icon, `aria-haspopup="dialog"`). It opens
      a dialog (`dialogOpen`, a sheet on the phone) titled *More*. Each item is a row button carrying the same `data-action` and
      data attributes it had in the toolbar, so `events.js` routes it unchanged.
      - A pick shuts the dialog first, then acts. A dialog the act opens is drawn after it, and the More dialog's nav step is
        marked `skip`.
      - **A badge an item carries is carried by More too**, in the worst tone, so nothing waiting is hidden behind it.
    - **`uiFilterHtml(tokens)`**: a **Filter** button with the count of applied filters. It opens a dialog holding the screen's
      own filter and sort controls, with their own ids and `change` handlers, and **Done**.
      - Under the toolbar, the applied filters are §6.6's tokens (`inv-token`: "`Client` SSS Mehta ×", the × clearing that
        one). A sort other than the default is a token too.
      - A change redraws the list behind the dialog in `keepScroll`. Done or a scrim tap shuts it and redraws the tokens.
      - **Trap:** a capture function that reads the controls from the DOM (`captureRegFilters`, `captureIMFilters`, History's)
        must keep the stored value when its control is not drawn (the dialog shut). It must still clear the selection on a real
        change (the selection rule in CLAUDE.md).
    - P184 proves both on a toolbar the test injects (`page.evaluate`): the dialog, a pick, the badge on More, a token's ×, Back.
12. **The instrument, P195** (`p195-load-benchmark.spec.ts`, mobile project).
    - **`longBook()`** (`tests/e2e/load-fixture.ts`) is `sweepState()` plus the following, all made-up and dated from
      `todayIso()`:
      - 80 production entries over 20 working days on the three lines, weighed by every route;
      - 60 challans (30 awaiting, some 12 days old or more) and 60 invoices across every state and age;
      - 12 clients and 40 stock entries;
      - 22 days of attendance, each with two EXTRA rows;
      - 60 bank rows (receipts and payments, six payees unsorted);
      - 8 power cuts, two with no time back.

      It is the owner's book's shape at a small scale, so a list past thirty and a screen past three are reachable.
    - **What it measures**, for every row entry of §2 and every view of a screen's own row, after the screen draws. Pulse and
      Needs you are included; sub-views, dialogs and paper are not.
      - `screens`: the page's height over the viewport's.
      - `blocks` and `chains`: the survey's harness, counting `.inv-row-meta, .inv-note, .inv-callout, .inv-hero-sub,
        .inv-tile-sub, .inv-row-title`, drawn or inside a fold, outside `PAPER`.
      - `toolbarRows`: the distinct lines of the screen's `.inv-toolbar` children and its tokens.
      - For the screens §3d marks *verdict*: a `[data-verdict]` whose top is inside the first screen.
    - **`LOAD_BUDGET`** holds each screen's measure at the end of TM1 (screens rounded up to the next half; counts as measured).
      - A screen with no budget fails, so a screen added later must be given one.
      - Each later step lowers its screens' budgets (I10). A *verdict* entry joins when the step that builds the verdict lands.
13. **Fixtures**: `phoneFilter(page)` and `phoneMore(page, label)` open the dialog on the phone and do nothing on the desktop, where
    the control is inline. A spec reaching a control that later moves behind them on the phone then changes by one line.

**Acceptance:** §2's rows on both layouts (TM1 version: Stats' row still five), Clients/Sales rows as above, the History button
on every screen for the owner and hidden for the Office role, History and Knowledge light no door and draw no section row,
`?tab=pageClients&v=quotes` lights Office → Sales, swiping Office goes Pipeline → Challans → Invoices → Clients → Sales, the
rail's mark asks before leaving a typed form; the two toolbar helpers on an injected toolbar; P195 green with its budgets recorded.
**Specs P184** (`p184-tab-map.spec.ts`, `.desktop.spec.ts`) **and P195**.
**Grep after:** `label: 'Day'` in workspace.js (none); `'Items'` as a user-facing label (none outside comments).

### TM2 — Today

Files: `todo.js`, `today.js`, `tabs.js`, `body.html`, `nav.js`, `init.js`, `learn.js`, `intel.js`, `stats.js`, `why.js`,
`insights.js`, `advice.js`, `report.js`, `print.js`, `pipeline.js`, `planview.js`, `search.js`, `guard.js`, `workspace.js`,
`kbguides.js`, `sw.js`, `manifest.json`.

**TM2a. The To-do joins Needs you.** Needs you already shows every open task (app tasks, folds and yours, ranked as the To-do
ranks them), ticks yours, opens every task's dialog and carries each task's move. It gains what only the To-do page had:
- **Add a task**, at the head of the tasks stack (inside `[data-card="tasks"]`, above the Now hero): the To-do's toolbar —
  `<input id="todoNew" data-todo-new placeholder="Add a task…">`, **Add** (`invTodoAdd`, the view's one primary: Needs you had
  none) and **Details** (`invTodoNew`, secondary). Enter in the field adds (events.js already routes `[data-todo-new]`).
  `todoQuickAdd` redraws through `todoRefreshViews` and puts focus back on `#todoNew`.
- **Snoozed** (`data-card="snoozed"`, fold `tdy-snoozed`, shut), only when a task is snoozed: its rows with Wake.
- **Done** (`data-card="done"`, fold `tdy-done`, shut): `uiMoreHtml('todoDone', …todoMineRowHtml)`, newest `doneAt` first, the
  tick reopens.
- **Learnt from your answers**: `learnPanelHtml()` (keeps `#todoLearn`), only when it has anything and the role may change
  settings, at the foot.
- On the desktop these sit in the tasks stack (`inv-panels-wide`), so `uiMasonry` packs as now.
- **The load:** Needs you stays the day's work list (§3b-6). On the phone its first screen still leads with the red tasks, with
  the Add row a single line above them.
Then the page goes: `#pageTodo` from `body.html`, `pageTodo` from `PAGE_TITLES`, `tabRender`, `nav.js` (navLoc, navLabel,
navApply), `GRD_PAGE_IDS` and the default roles (a saved role listing it is harmless), `members`; `renderTodo` and code only
it used are deleted (the engine stays: `todoRanked`, `todoApp`, `todoGo`, the dialogs, `todoMineRowHtml`, the widget). Re-point:
- `homeQuick('task')`, Add → By hand → Task, search "Add task", `GRD_QUICK_PAGE.task` / `GRD_ADD_PAGE.task` → Needs you with
  `#todoNew` focused (`pageHome`).
- `todoGo('todoLearn')` and `WS_GO_PAGE.todoLearn` → Needs you, revealing `#todoLearn`.
- `todoHandleLaunch` → Needs you: `add` focuses `#todoNew`; `open:a:<key>` / `open:m:<id>` open that task's dialog there.
- `sw.js` `widgetOpen` → `'./?tab=pageHome&v=needs&todo=' + …`; `manifest.json`'s To-do shortcut → `./?tab=pageHome&v=needs`
  named "Needs you". Old URLs redirect (§5).
- Pulse's To-do widget's foot → Needs you. Search: `todo` "Your tasks" → Needs you; `todo-done` "Done tasks" → Needs you with the
  Done fold opened.
- `kbguides.js` 'today' guide: screens `['pageHome']`, text names Add task and Done on Needs you; next version.

**TM2b. Pulse takes Stats → Overview; Stats keeps three tabs.**
- Pulse after: head (the period word, a **period switch** MTD · QTD · YTD · All sharing `_statsPeriod` with Stats, **Make a
  report** `invRptFromStats`, and the Stats link) → the questions (as now) → Do first (as now) → **Why it moved** (`whyHtml` for
  the period, `#statsWhy` keeps its id) → **In one line** (`statsOverviewHtml`, with its Cash row and plated row; `#statsOverview`
  keeps its id) → **This month at its pace** (`paceCardHtml`, `#statsPace`) → the widgets. Changing the period redraws Pulse in
  `keepScroll` (today Pulse ignored a change made on Stats until the next save). Without money Pulse draws none of these, as now.
- Stats → `STATS_TABS = [['clients','By client'],['cost','Cost'],['trends','Trends']]`; `statsTab()` and `navApply` fall back
  to `clients`. Stats' toolbar keeps the period chips; "Make a report" leaves Stats (Pulse has it; Reports is in the same row).
- The Overview's cards: the questions are Pulse's (`statsStoriesHtml`, `statsStory` and the dead `advPulseHtml` are deleted;
  `statsStoryCards` stays, Pulse uses it); Why it moved, In one line and pace to Pulse; **the headline** ("<period> performance":
  revenue, tonnage, realisation, margin, with its coverage, below-cost and credit-note callouts) and **six months**
  (`statsMonthsHtml`) to the head of **Trends**; the insights list (`insightsCardHtml`) goes (they are tasks on Needs you; the
  'changed' question's "all insights" link → Needs you).
- Stats → Billing's cards: Output tax, Invoice states and Unbilled material go (their facts live on Money → GST and Pipeline's
  stages); **Dispatch cycle** moves to Pipeline: extract it from `renderStats` into a function (`statsDispatchCycleHtml(invs)` or
  similar; grep the name) and draw it in `.inv-pipe-rail` after the stages panel, over **the last 90 days**, said in the card.
- Re-point: `todoGo('stats')` (tab `overview` → Pulse, `billing` → Pipeline), `insGo('overview')` (insRealLow) → Trends,
  `invStatsInsightsAll` and the story heads' `invStatsGo` (deleted with the stories), Pulse's empty text "Office → Stats has the
  figures" → "Stats has the figures", search entries (`stats` "Stats" → By client; `stats-clients` "By client"; `stats-billing`
  → "Dispatch cycle" at Pipeline), `rptFromStats` reads `_statsPeriod` as before.
- **The load** (Pulse 5.5 phone screens, Stats' Overview 10.9, By client 4.8, Cost 4.4, on the owner's book):
  - **Pulse's three new cards are heroes** (design §6.21, `uiHeroHtml` with `fold`: shut on the phone, open on the desktop, §1a-3),
    each in §3c's shape:
    - **Why it moved**: the verdict names the change and its largest cause (*Realisation down ₹0.42/kg · mostly SSS Mehta's
      mix*), toned by direction. The causes, which add up exactly, are fact rows with their ₹ at the end; the rest is one row
      (`whyHtml`).
    - **In one line**: the verdict is contribution a kilo, toned against the live cost (`figToneAgainst`, as Stats judges it).
      The factors are tiles (realisation, live cost, capacity, cash). What is not measured is a badge on its tile, and the
      sentence under the card goes.
    - **This month at its pace**: the verdict *On pace for ₹X · Y t*, with its change against the month before
      (`figDeltaHtml`). The band, and what it rests on, are folded.
  - **Each question's story** keeps one sentence under its hero (`say`); a line in `statsStoryCards` over 120 characters becomes a
    fact row.
  - Pulse is measured before TM2 and after TM2c. It is no longer (I10), and on the owner's book it is at or under three and a half
    phone screens.
  - **Stats → By client** leads with a verdict (`data-verdict`): how many large accounts sit below their variable cost, the worst
    named with its ₹/kg against the live cost, in its tone.
    - The contribution table follows.
    - The worst account settled both ways (labour fixed, labour scaling, the break-even) is tiles, with the working folded.
    - Realisation by client and concentration fold (`uiFoldCard`), shut on the phone.
  - **Stats → Cost** leads with the live cost's verdict: its ₹/kg against realisation, and how much of it is measured (*₹7.31/kg ·
    40% measured*, the share in its tone).
    - Each component's source is a badge (*measured*, *part-recorded*, *market rate*, *model*, *paid, bank*). The notes saying
      what each one means go to the guide.
    - *Recorded against paid* is fact rows, with a gap over 10% toned.
    - Labour's coverage is a badge on its figure, with one line at most.
  - **Stats → Trends** leads with the headline and six months it gains. Their callouts (coverage, below cost, credit notes) become
    a badge and one line each.

**TM2c. Pulse's widgets.** `HOME_PRESETS`: every preset hides `todo`, `recent` and `money` (owner: order puts them last; floor and
money presets likewise). `homeLayout()`: a saved layout whose `preset` is not `custom` is rebuilt from `HOME_PRESETS[preset]` on
read (a device on a preset follows the ruling; a custom layout is the owner's and is kept). This is the room Pulse gives back for
the cards TM2b moves onto it (I10).

**TM2d. The Planner's Moves.** `PLN_VIEWS = [['play','Play'],['ledger','Ledger'],['day','A day'],['moves','Moves']]`;
`PLN_MOVES = [['plant','Plant'],['tech','Tech tree'],['staff','Staff'],['clients','Clients'],['finance','Finance']]`. On Moves a
switch (`inv-seg`, `invPlnMoves`, `data-k`, `aria-pressed`) under the row picks the kind; the body is the kind's existing
function. The address is `v=moves/<kind>`; `plnSetView` takes `moves/<kind>` and the old kind names (§5); the key
`sep_inv_planner_view` stores `moves/<kind>`. Re-point plnCheck (`v:'tech'`) and plnMachine (`v:'plant'`), search's planner
entries, the KB planner guide ("**Moves → Finance** → Lenders"), planview.js's own text naming views.
- **The load.** The survey: a header repeated on every view, phone rows squeezed to a word a line, and on Plant 11 chains.
  - The goal callout (`plnGoalHtml`) shows on Play only.
  - The heads-up tiles (`plnHudHtml`) show on Play and Ledger. On A day and Moves one strip replaces them: the month ‹ › and the
    margin a month, in its tone.
  - The phone's toolbar is Roll (the primary), the plan's chips, and More (New card, Make the report, Copy, Rename, Suggest a
    start, Start over), using TM1's helper.
  - On the phone, every register and Moves table becomes rows: the name, its figure at the end, two facts of meta, and the rest
    as fact rows in its fold. The desktop keeps its tables.

**TM2e. Redirect rows** for TM2 (§5), and `WORKSPACES.today.members = []`.

**TM2f. Reports, fitted** (6.2 phone screens; the tables ran past the paper's edge). The report drawn on the page is fitted to the
screen's width the way the print view fits a document. `printFit()` is generalised to **`paperFit(el)`**: it zooms `el` to its
container's width, never above life size, on draw and on resize, and print.js keeps calling it for the print view. The paper
itself is unchanged. TM4e uses the same helper for the power case.

**Acceptance:** Needs you adds, ticks, reopens from Done, wakes from Snoozed, shows Learnt; `?tab=pageTodo&todo=add` lands on
Needs you with `#todoNew` focused; `todo=open:a:<key>` opens that task; Pulse shows the period switch, Why it moved, In one line
and pace, and changing the period redraws it; the three fold to their verdicts on the phone; Stats' row is By client · Cost ·
Trends, By client and Cost lead with their verdicts; Trends leads with the headline and six months; Pipeline shows the dispatch
cycle; the Planner's row is four with the Moves switch, its goal on Play only and its tables rows on the phone; a device on the
Owner preset loses the three widgets, a custom one keeps them; the report on the page fits a 393 px screen. **Spec P185;**
P195's budgets lowered for Pulse, Stats and the Planner. **Grep after:** `pageTodo` (only §5's row and comments), `renderTodo(`,
`'overview'` / `'billing'` in intel.js, `advPulseHtml`, `statsStoriesHtml`, `invStatsInsightsAll`.

### TM3 — Money and Invoices

**TM3a. Bills & notes split.**
- `FIN_TABS = [['overview','Overview'],['receipts','Receivables'],['payments','Payments'],['bank','Bank'],['gst','GST']]`.
- **Payments carries the bills** (`#billsPower`, "Bills: electricity and other"; the missing months with Add and "Add ₹X
  paid <date>", the bills in month order with Void, the bill form when open: `_costBillOpen.where === 'finance'`), **drawn with
  or without a statement** (today `renderBank` returns early with no statement: draw the bills, then the empty statement panel).
  Their order on the screen is TM3c's. `#bankPower` "Electricity paid" follows; its head link "Open Bills & notes" (`invGoBills`)
  goes.
- **Credit notes** move into Office → Invoices → **Credit notes** (the dialog `renderCreditNoteList`): its head carries
  **Record issued** and **New note** (secondary; also in the empty state, which has no toolbar today); the forms
  (`_billsCnFormHtml`, `billsCnFormInput`, `billsCnFormSave`, all kept in bills.js with every global other files use:
  `billsMonthLabel`, `cnIsRebate`, `billsCnFy`, `billsMissingPower`, `billsPrevMonths`, `stockEditHtml`, `stockEditSave`,
  `STOCK_UNIT_CHOICES`) draw inside the dialog and redraw it (`renderCreditNoteList` with `{replace:true}`) where they called
  `renderFinance()` (bills.js: the open, the input, the save, the cancel). After **New note** saves, the preview opens as now.
  `cancelCreditNote`'s redraw follows. **A save or a cancel refreshes the Register's toolbar badge and the rows' CN marks** (today
  the badge goes stale: reset `_regToolbarRendered` and redraw the register view). In the dialog a note's row meta says two things
  (its date and the invoice it names) and its reason takes one line.
- Re-point: `todoGo('bills')` (kept as an alias for saved tasks) → `finSetTab('payments')`, the form open on `go.month` when
  given, reveal `#billsPower`; the advice move's label "Bills & notes" → "Add the bill" (and a saved task's `goLabel` "Bills &
  notes" is shown as "Add the bill"); search `bills` → "Bills" at "Money › Payments"; `srchEntryLoc.bills` → payments; Live cost's
  bill form (`where: 'stats'`) → a link "Add a bill" (`todoGo({kind:'bills'})`), and **its bills list goes** (the survey: it
  repeated Bills & notes; the electricity row's fold keeps each bill's share of the month, which is the cost's working), with the
  note "Bills are entered in Money → Payments"; `power.js` "Bills are added in Money → Payments"; the KB credit guide "Office →
  Invoices → Credit notes → **New note** / **Record issued**" (next version); `WS_GO_PAGE.bills` stays `pageFinance`.
- Redirect row (§5).

**TM3b. Cheques awaiting deposit** (owner, 9 Oct 2026).
- **The record:** `S.bank.cheques: [{id, clientId, amount, number, chequeDate, drawnOn, receivedOn, note, at, by, deposit?,
  voidedAt?, voidReason?, voidBy?}]`. `bankData()` repairs it; `getDefaultState().bank` gains `cheques: []`; `CHG_TRACK` gains
  `{path:'bank.cheques', kind:'arr', noun:'cheque received', cid: r => r.clientId, label: …}` (the change log and the merge
  read it); the `sep-bank` export carries `cheques` and its import merges them by id, never overwriting (**a data flow
  soma-internal reads: say so in the PR and in NEXT_SESSION's data-flow table**).
- **Recording:** Money → Receivables → **Cheque received** (secondary; the tab's primary stays what it is) and Add → By hand →
  **Cheque received**, one form (a dialog): client (required), amount (required, > 0), cheque number (required, digits), cheque
  date, drawn on (optional), received on (default today, never in the future), note. `bankGate('record a cheque received')`.
  The same client and number twice (not voided) is refused. Works with or without a statement.
- **It counts as paid from the day it was received:** `bankReceivables` takes each live cheque (not voided, not deposited) as a
  receipt event dated `receivedOn` (`pending: true`), placed by the same rules as a receipt (exact to the rupee, else oldest
  first, never against an invoice raised after it). So owed, the open list and its ageing, days to pay, the statement of account
  (a line "Cheque 525428 received, not yet in the bank"), Pipeline's Owed to us, a client's Money panel, Pulse's cash question
  and the owed90 / payingSlower rules all reflect it with no other change.
- **The deposit:** a statement credit whose instrument number (`bankInstrument`) equals the cheque's number, dated from three days
  before `receivedOn` to 60 days after, **is the cheque's deposit** (worked out on every read, like a bounce's link by number;
  the owner's own choice on the cheque, `deposit: <row id>` or `deposit: null` "not this", wins). From then the cheque stops
  counting and the deposit row does: no double count. **A deposit row the cheque names is placed on the cheque's client** unless
  the row was placed by hand (`row.set`). A credit of the same amount with no number, within 15 days, is **offered** (Link),
  never applied. A deposit later returned is handled by the bounce logic as now; the cheque then reads Returned.
- **On screen:** Receivables leads, when any cheque is live or deposited in the last 30 days, with **Cheques received**: client,
  ₹, number, received date, and a dot and word (In hand · N days; Deposited <date>; Returned), with Link (an offer) and Void
  (a reason, required; never deleted). Its head is a verdict (*2 cheques in hand · ₹X · the oldest 5 days*) in the held task's
  tone. A client's receipts list shows a live cheque as "Cheque 525428 · in hand since 2 Oct". Money → Overview's balance says
  "+ ₹X in cheques in hand" when any.
- **The forecast** expects a live cheque in the bank on the next working day after today (or its received day, if later).
- **To-do rule `chequeHeld`** (switchable, Settings → Checks & alerts → To-do): a live cheque in hand 3 days or more is amber, 7
  red; its text says whether the statement reaches past the day it was received ("not in the bank by <statement end>") or not
  ("import the statement to check"). Its move opens Receivables on the cheque.

**TM3c. Money's screens** (the survey: the Overview 5.8 phone screens with owed, much of it over 90 days, uncoloured and four
screens down; Receivables 4 blocks and 11 chains; Payments' *Not yet sorted* near the foot; GST's column cut on the phone).
- **Overview** (`finOverviewHtml`): a verdict hero leads (`data-verdict`).
  - Its verdict and factors:
    - the balance with its day: overdrawn is danger, and the forecast's lowest point within 60 days (`finForecast`) is toned;
    - owed by age, drawn as the one age bar (`FIN_AGE_TONE`, Pulse's Money card's drawing): past 60 days warning, past 90 danger
      unless a receipt is unplaced;
    - GST due this month.
  - The four tiles are its factors. The five largest debtors follow as rows, each owed amount in its age tone.
  - Then the charts, each a fold (`uiFoldCard`, shut on the phone): cash, where money went, where it came from, invoiced against
    received, GST. Target three phone screens.
- **Receivables:**
  - The method paragraphs (where receipts start, how they are set, what an opening is) go to the guide (`kbguides.js` 'bank',
    next version), with one line on the face.
  - A client's row has owed at the end, in its age tone, and two facts of meta (*pays in 32 d · oldest 47 d*). Its invoices,
    notes, receipts and opening are fact rows in its fold.
  - *Returned cheques* and *Cheques received* lead when they hold anything.
- **Payments: what needs the owner comes first** (§1a-8).
  - The order is: the payees not yet sorted (with Sort), then the months with no electricity bill (Add), then the bills in month
    order (a fold), then the sections.
  - A row's end figure keeps its width on the phone; the meta wraps (design §6.10). The first row's amount was squeezed.
- **Bank**: the statement comes first; the imports and the balance check fold under it.
- **GST**: on the phone each month is a row (the month, its status as a dot and a word, due and paid at the end as
  `inv-row-end-stack`). The desktop keeps the table.

**Acceptance:** Money's row is five; Payments shows the bills with and without a statement and opens on what needs the owner; the
To-do's bills task opens the form on its month; Record and New work from the Credit notes dialog (empty and not), and the
Register's badge and CN marks follow; a cheque recorded lowers owed at once, its deposit (same number) takes over without counting
twice and lands on the client, a held cheque raises the task, a void puts owed back, the export carries cheques; Money's Overview
leads with its verdict inside the first phone screen; GST cuts nothing at 393 px. **Specs P186 (`p186-money-map.spec.ts`: TM3a
and TM3c) and P187 (cheques);** P195's budgets lowered for Money's screens. **Grep after:** `'Bills & notes'` in UI strings
(none), `finSetTab('bills')`, `renderBillsNotes`, `invGoBills`, `data-where="stats"`.

### TM4 — Floor

**TM4a. Floor's Overview** (`floor.js`, `pageFloor`; the page keeps its address `?tab=pageFloor&d=…` and its day stepper):
- Below the stepper, **four hero cards** in Today's card language (`uiHeroHtml`, coded by status, a one-line verdict, a meter or
  figure, the foot a link to the page): **People** (on site against the roster and against the day's number, short areas; link
  People → Attendance, Day), **Production** (`prodDayHeroHtml(day)`, the day's card built 9 Oct 2026 for the owner's *"not uniform
  enough"*: the tonnes, ≈ and ≥ as estimated and unweighed, each line on the clock with its efficiency, how it was weighed, the
  pieces not weighed, the worth and labour by role, the week against capacity; coloured by the plant's efficiency; link Production
  → Lines), **Stock**
  (lines out and low, the first three names, the reorder's cash when the role sees money; link Stock), **Power** (the day's cuts
  and minutes, the month so far, a year at this rate; the load to chase when approved and not yet billed; link Power → Cuts).
  People and Production read the day on screen; Stock reads now and says so; Power reads the day and the month to date.
- Each card shows for a role that sees its page (`grdSees`); People's figures are heads (no rupees). **A link the role cannot
  follow is text.** The line cards' staffing word, EXTRA badge and the old tiles' doors follow the same rule (today a floor hand's
  tap on them is refused with a toast).
- The three tiles (on site, plated, power) go: the heroes say them (I8). The line cards stay, under the heroes: since 9 Oct 2026 they are
  heroes coloured by each line's efficiency (`prodLineEfficiency`; half or more of a line's units down is danger), and the *Not weighed*
  panel (`flrUnweighedHtml`) stays under them.
- On the desktop the heroes are a row (`.inv-heroes`), the lines below.
- **The load:**
  - The first hero carries `data-verdict`.
  - People's tone comes from one function built here, **`attOnSiteTone(d)`**: the 90 / 80% gate on the active roster, and warning
    when the floor is short of its number. `attDayPanelHtml` and `renderAttHomeCard` read it from now on, and TM6a points every
    other on-site figure at it.
  - **The line cards lead with the worst** (§1a-1), and the Production hero's verdict names that line.
  - *Not weighed* stays open, since it needs the owner, at ten rows (`uiMoreHtml`: each row is a question).

**TM4b. People** (`staff.js`, `dash.js`, `payroll.js`, `relay.js`, `attreg.js`, `areas.js`, `people.js`):
- The row is **Attendance · Pay · Areas · Roster**. `_attView` keeps its values; the tab **Attendance** is selected for `day`,
  `week` and `register`, and clicking it returns to the last of the three (default `day`). Under the row on those views a switch
  **Day · Week · Month** (`invAttPeriod`, `data-view`, `aria-pressed`) moves between them. Addresses unchanged (`v=day`, `week`,
  `register/YYYY-MM`). Default view `day` (was `overview`); `_attPrevView` default `day`; `navApply` falls back to `day`.
- The Overview goes. Its cards: today's attendance → Floor's People hero; **attendance by week** (`dashAttendanceByWeek`, keep
  `attPresenceForRange`: report.js uses it) → the head of Week; **labour ₹/kg by month** and **payroll against the bank** → the
  head of Pay, wages-gated, and **their bank series gated by money (`finSeen`)** (today only by `finHasBank`: a role with wages
  and no money saw bank figures); OT and EXTRA by area → nothing (Areas already has `areaHoursCard`); Raised → nothing (Needs you).
- Re-point every `'overview'` default (staff.js, relay.js:1028, search `people` → `day`), the KB guides' "Floor → People → Day" →
  "Floor → People → Attendance".
- **The load:**
  - **Attendance → Day.** The survey measured 6.7 phone screens, because every EXTRA row was an open form with every hand as a
    chip.
    - Each EXTRA row folds to one line (`uiFoldRowHtml`, `_attExtraCard`): the area, the slot, the hours and the crew's count. It
      opens to its form (times, crew chips, Needed).
    - A row missing an input (no crew, no times) stays open and is toned warning.
    - The board's cards stay. Target: four phone screens on the owner's book.
  - **Attendance → Week** (`_attWeekView`; an instruction paragraph, then the grid, and no line saying the state). The paragraph
    goes to the guide. A verdict leads (`data-verdict`): the week's attendance against the gate (`attPresenceForRange`), the days
    not recorded named, and the payout so far for a role that sees wages.
  - **Attendance → Month** (`aregViewHtml`; the one cell to act on was drawn the faintest).
    - The summary leads as a verdict: *N cells differ · N only on the register · N agree*.
    - A cell that differs is drawn in its tone: danger when the mark differs, warning when only the overtime does. An agreeing
      cell is plain.
    - The method text goes to the guide.
  - **Pay** (`_payForecastCard`, `_payDueCard`; the payout showed, not whether it was usual).
    - The payout carries its change against the twelve weeks' median (`figDeltaHtml`, toned by the swing).
    - A worker's due opens to its wage arithmetic as fact rows (§3c): days × rate, rest days, overtime hours × rate, paid, brought
      forward.
  - **Areas** (`_attAreasView`, `_areaExtraCard`; five method paragraphs, and the row to explain was on screen two).
    - A verdict leads: *The extra checks out* (ok), or *N bookings to explain* (warning).
    - The disagreements come first, each with Explain.
    - Each block's reconciliation is folded working: the norm, the heads, the shortfall, the hours a hand, predicted against
      booked.
    - The five method paragraphs go to one new guide, *People: the areas and the extra*.
  - **Roster** (`_attRosterView`; nothing said who to watch). The workers a To-do rule names (`pplWatch`, `pplCheckin`) lead as a
    group, *To watch*, each with its reason as a badge. The rest follow as now.

**TM4c. Production** (`prodview.js`, `plant.js`):
- `PROD_TABS = [['lines','Lines'],['plant','In plant'],['entries','Entries'],['equipment','Equipment']]`, default `lines`.
- The Overview goes. Its pieces: the day's card (`prodDayHeroHtml`, which replaced the plated tile on 9 Oct 2026) and the week tile → Floor's Production hero (In plant keeps its own book and plated-not-invoiced tiles);
  **plated by line, 4 weeks** (`#prodChart`) → the head of Lines; **record coverage** (`#prodCoverage`) and **line unknown**
  (`#prodUnknown`) → the head of Entries; the glance (`#pltGlance`) stays only on the no-entries empty state; Raised → nothing.
- Re-point `todoGo('production')` default → `lines`; search `production` → `lines`, a new `equipment` entry.
- **The load:**
  - **Entries** (`prodEntriesHtml`, `prodEntryRowHtml`; 16.9 phone screens, 150 chains).
    - The latest thirty show, newest first (`uiMoreHtml`, *Show N more · M in all*). The filters' counts cover every entry.
    - An entry's meta says two things: the line and slot, and the quantity with its kilos.
    - Its source, how it was weighed and its match are badges: *register*, *relay*, *hand*, *import*; *written*, *record*,
      *challans*, *kind*, *default*; *no challan*.
    - The rest goes in the pane (desktop) or the row's fold (phone) as fact rows.
    - Target: three phone screens and no chain.
  - **In plant** (`prodPlantHtml`; three caveats led, and the exceptions came last, untoned).
    - The exceptions lead, in their tone: material on the floor with no challan open, and work plated but not invoiced past its
      days.
    - The book and floor figures are tiles.
    - Each caveat is a badge on the figure it qualifies (*withheld: 82% of line-days recorded*, ≥); the reasoning goes in the
      guide.
    - A client's line has two facts of meta.
  - **Lines** (`prodLinesHtml`): each line's figures are toned — its efficiency by `prodLineEfficiency`, its labour ₹/kg against
    the model by `figToneAgainst`.
  - **Equipment**: the view's one primary is **Add a unit** (an owner's edit); Paste message is secondary there.

**TM4d. Stock** (`stock.js`, `dash.js`, `today.js`):
- **One screen**, no tab row (`stockViewTabsHtml` goes). `_stockView` and `_stockHome` default `list`; `navApply` maps
  `overview` → `list`; `today.js`'s stock input opens the list.
- The list keeps its toolbar (now always with Reorder list, Export, Import), its status tiles (they filter) and groups. When
  there is anything to order, a callout at the top: "Reorder ₹X with GST" and, for a role that sees money with a statement, the
  forecast's low after it, toned; link "Open the reorder list".
- **Spend and prices** (spend by supplier, used by week, the price trend with zinc's market panel): on the phone a fold at the
  foot of the list (`uiFoldHtml('stock-spend', …)`, shut); on the desktop a toolbar button **Spend and prices** opens them in the
  pane (with no line open), so the list and pane still fill the room (P80). Days left as ranked bars goes (the list's groups say
  it). The sweep's `walkZinc` opens Spend and prices instead of the Overview.
- **The load:**
  - The phone's toolbar (`stockToolbarHtml`) is Paste message (the primary), Enter by hand, and More (Reorder list, Print sheets,
    Export, Import), using TM1's helper. Six buttons on three rows become one row.
  - The reorder callout is the verdict (`data-verdict`), naming the lines out and red, and the reorder's cash.
  - A line that is out reads danger in its group. The Overview's grey slivers go with the Overview.

**TM4e. Power** (`power.js`, `powercause.js`):
- `POWER_TABS = [['cuts','Cuts'],['causes','Causes'],['load','Load & bills'],['case','Case']]`, default `cuts`.
- The Overview goes. Its pieces: the month, cost and year tiles → the head of Cuts (and Floor's Power hero); the load tile → the
  head of Load & bills; **cuts by month** and **when they come** → Cuts, after the tiles; **why they come** → nothing (Causes has
  the full list); Raised → nothing. "To complete" stays on Cuts only (Causes links to it).
- Re-point `todoGo('power')` default → `cuts`; search `power` → `cuts`.
- **The load:**
  - **Cuts** (`powerCutsHtml`; 9 chains, the red callout came third, *To complete* repeated).
    - The verdict leads: the month's cuts and their cost, and a year at this rate.
    - When the load is approved and not yet billed, that callout comes first, in red.
    - *To complete* appears here only.
    - A cut's row has two facts of meta (its time and its length), its cost at the end, and the damage's parts in its fold.
  - **Causes** (`pcsCausesHtml`; tiles read as firm on one reasoned cut, *To complete* a third time). A tile is toned only from
    three cuts (§1a-7), and *To complete* becomes a link to Cuts.
  - **Load & bills** (`powerLoadHtml`; 4 blocks).
    - The load's verdict leads: *Approved 50 kVA, billed at 25: ₹X in penalty since approval*, in danger.
    - A bill's details are fact rows. The method text goes to the guide.
  - **Case** (paper; 3.7 phone screens, not fitted): fitted with TM2f's `paperFit`.

**TM4f. Redirect rows** for TM4 (§5).

**Acceptance:** Floor's row is Overview · People · Production · Stock · Power; the Overview shows the four heroes per role (owner
all four, supervisor all four, the floor role People without a link, Production and Stock, no Power), the line cards worst first
and the stepper; People's row is four with the Day · Week · Month switch and unchanged addresses; Week leads with its verdict and
attendance by week, Pay with labour ₹/kg and payroll against the bank (no bank series without money); Day's EXTRA rows are one line
each until opened; Areas leads with its verdict and the rows to explain; Production's row is four, Lines leads with plated by line,
Entries with coverage and line unknown and shows thirty; In plant leads with its exceptions; Stock has no row, one toolbar row on
the phone, the reorder callout and Spend and prices (fold on the phone, pane on the desktop); Power's row is four, Cuts leads with
its verdict, its tiles and the two charts; every old Overview address lands as §5 says. **Spec P188;** P195's budgets lowered for
every Floor screen. **Grep after:** `staffOverviewHtml`, `stockOverviewHtml`, `prodOverviewHtml`, `powerOverviewHtml`,
`stockViewTabsHtml`, `'overview'` as a view value in staff.js, relay.js, dash.js, stock.js, prodview.js, power.js, todo.js,
today.js, search.js (none).

### TM5 — Office

Files: `pipeline.js`, `im.js`, `invoice-ops.js`, `clients.js`, `items.js`, `client-perf.js`, `prospects.js`, `quote.js`,
`create.js`, `todo.js` (the challan rule's tone), `intel.js` and `advice.js` (the spare's words), `kbguides.js`. Office's screens
keep their places (§2); this step is their load.

- **TM5a. Pipeline** (`renderPipeline`, `pipeStageRowHtml`; no verdict, and stages were rows with small dots).
  - A verdict hero leads (`data-verdict`), naming the stage that needs the owner first (*12 challans waiting · the oldest 9 days*),
    in its tone.
  - Each stage is a coded box (`inv-coded`, design §6.26) in its own age tone, with its count and amount, and opens its list as
    now. The dispatch cycle (TM2) sits under them.
- **TM5b. Challans → Awaiting invoice** (`renderIMList`, `imRowMainHtml`; nothing said how old the waiting challans were, and their
  tone ignored age).
  - The list's head is a verdict (*N waiting · the oldest N days*), toned.
  - Each challan's dot is toned by how many days it has waited, with the days in its meta. The new **`imWaitTone(days)`** gives
    amber from the To-do's challan days and red from twice that (§1a-4).
  - The To-do's challan rule (`TODO_RULE_FNS.challan`) takes its tone from the same function.
- **TM5c. Invoices** (`renderRegisterToolbar`; six rows of controls on the phone before the first invoice, and no verdict).
  - The phone's toolbar, using TM1's helpers, is:
    - the search;
    - Filter (client, month, state, the range and the sort, shown as tokens);
    - Select;
    - More (Credit notes and Number audit, with their badges).
  - A verdict leads: the invoices waiting on a step, by state and age (`invStateTone`: *3 created over 2 days · 2 delivered,
    GSTR-1 due 11 Oct*), in the worst tone.
- **TM5d. Clients** (`renderClientList`; no verdict, though each client's flags were already worked out).
  - Each client's row carries a dot and a word from its worst flag: that flag's tone and the rule's short word (*owes 90+ days*,
    *gone quiet*, *below cost*), from the tasks `todoClientCardHtml` already lists.
  - The list's head says how many clients need the owner. A client's detail still opens with its flags at the top.
- **TM5e. Parts** (`_buildItemsSubViewHtml`; the toolbar was too long, and the job waiting, parts with no weight, was a plain chip).
  - The phone's toolbar is the search, Filter (sort, *No weight*, *Unused*), Add part (the primary) and More (Part weights, Weight
    entry, Derive weights, Merge).
  - *N parts with no weight* leads the list as a callout in its tone, with its move.
  - A part's meta says two things (30 chains → none).
- **TM5f. Performance** (`renderClientPerformance`; 3.8 phone screens, 4.9 desktop; 10 blocks, 21 chains; the flags folded away
  with no tone, and the long cards were open).
  - A client hero leads (`data-verdict`): its realisation against the live cost in its tone, its change month on month, and its
    flags as coded boxes (open).
  - The cards fold to their summary line, shut: Materials worked, By the hour, and the parts by stopped, new and steady (stopped
    toned warning).
  - Every sentence over 120 characters becomes fact rows or goes to the guide. A part's meta says two things.
  - Target three phone screens.
- **TM5g. Sales** (Prospects and Quotations; Today's reprice moves were not shown here, and the spare disagreed with Pulse's).
  - Quotations leads with the reprice moves that Pulse's questions draw: the same moves, each opening its draft
    (`advMovesDeckHtml`).
  - The spare is one figure, **`prsSpare`** (the last 90 days, a month). It is said with its period on Prospects, and under Pulse's
    *Is the plant full?* beside the period's own spare.
- **TM5h. Create** (`renderCreateForm`; red errors showed before anything was typed). An error shows only after its field is left
  or a save is tried (`#invErrorsArea`), never on a form nobody has touched. The line verdicts are unchanged.

**Acceptance:** each of 5a–5h on both layouts; the challan row and its task agree in tone at 4, 5 and 10 days; Invoices' phone
toolbar is two rows at most with every filter, the sort, Select, Credit notes and Number audit reachable and the audit's badge on
More; Performance under four phone screens on the long book. **Spec P193** (`p193-office-load(.desktop).spec.ts`); P195's budgets
lowered for every Office screen.

### TM6 — Across the app

Files: `state.js`, `charts.js`, `payroll.js`, `floor.js`, `staff.js`, `today.js`, `report.js`, `areas.js`, `finance.js`, `bank.js`,
`pipeline.js`, `finlinks.js`, `statement.js`, `stats.js`, `knowledge.js`, `kbguides.js`, and the callers of the charts.

- **TM6a. One tone per fact** (the survey found the same figure in a different tone on two screens).
  - **On site against the roster**: `attOnSiteTone` (TM4a) is read by `attDayPanelHtml`, `renderAttHomeCard`, Floor's People hero,
    Staff → Day's head (`#attOnSite`), Needs you's floor card (`today.js`) and the report's staff section.
  - **Heads against the day's number, per area**: one function, **`areaNeedTone(heads, need)`** (short warning, met ok, over
    info). It is read by Floor's line cards' staffing word, the attendance panel's *By area*, Day's board heads and Areas.
  - **Owed by age**: `FIN_AGE_TONE` / `figToneAge`, wherever owed is drawn: Receivables, Money's Overview, Pulse's Money card and
    cash question, Pipeline's *Owed to us*, a client's Money panel, the statement of account.
  - **Below cost**: one judge (`figToneAgainst(realisation, liveCost, 5)`) on Pulse, Stats → By client, Performance and Sales.
  - P194 sets one book where each figure is warning and one where it is danger, and asserts every screen draws it in the same
    tone.
- **TM6b. The period to date in every chart** (`charts.js`; design §6.17 amended). The survey found the month so far plotted as a
  collapse.
  - `opts.toDate` names the point or bar of a period not yet ended.
    - A line's segment into it is dashed; a bar is drawn lighter (`inv-chart-todate`).
    - Its label reads *to date*, and its `<title>` says so.
  - Every caller with a current period passes it:
    - Trends' six months and trend; Pulse's sparklines;
    - Money's cash by month, invoiced against received, and GST;
    - Stock's used by week; Production's plated by line (this week);
    - People's attendance by week; Power's cuts by month; Performance's months.
- **TM6c. History** (the filters filled half the phone's first screen): the search and Filter (who, client, from, to, the kinds),
  using TM1's helpers.
- **TM6d. Knowledge → Training** (`kbTrainingHtml`; no summary, and every row the same status).
  - A verdict leads: *N due again · N never taught · N up to date*.
  - Each row has a dot and a word by its status: due again warning, never taught info, up to date ok.
- **TM6e. The last long words and long toolbars.**
  - Every note over 120 characters left on any screen (P195's `blocks`) becomes one line or moves to its screen's guide (the
    guide's next `version`).
  - Every phone toolbar over two rows takes TM1's helpers.
  - After this, P195's `blocks` budget is zero everywhere and `toolbarRows` is two. The only exceptions are the ones the report
    names (§3b): a note shown as it was typed, or a guide's own text.

**Acceptance:** each pair of 6a in one tone on both books; every chart with a current period marks it; History's phone toolbar
two rows; Training's verdict and row tones. **Spec P194** (`p194-load-across(.desktop).spec.ts`); P195's budgets at their floor.

### TM7 — Docs, verification, the PR

1. **Docs:**
   - **CLAUDE.md**:
     - a section "The tab map and the cognitive load" under the Next-session block, pointing here;
     - every section that names a moved screen;
     - the module list's descriptions;
     - the test count.
   - **`docs/SEP_INVOICING_DESIGN_PRINCIPLES.md`**:
     - §4: the rules of §3a and the map;
     - a section for the benchmark (§3b, its measures and its exceptions);
     - §6.6 and §6.7 (TM1), §6.17 (TM6), and §7's rows for every screen changed.
   - **`docs/NEXT_SESSION.md`**: a top section, and the data-flow table gains `sep-bank` `cheques`.
   - **`docs/COGNITIVE_LOAD_SURVEY.md`**: each proposal marked built, with its step and its measure after.
   - **This file's §0.**
2. **The full suite** green on both projects. P76, P79 and P80 sweep the new map (their PAGES and DIALOGS lists updated in the
   steps that changed them), and P195's budgets stand as each step left them.
3. **Measured on the owner's book** (scratchpad only, never committed):
   - every screen's length on both layouts, with its blocks and chains, against §3d; the before and after go in the PR;
   - a harness pressing every action on every page and view, both layouts, with no uncaught error.
4. **Push, a draft PR**, subscribed; the owner is told; **the QA chain waits for the owner's word**.

## 7. The specs to add

| Spec | Step | Asserts (each fails on the build before its step) |
|---|---|---|
| P184 `p184-tab-map(.desktop).spec.ts` | TM1 | every section's row exactly as §2 (TM1 version), Clients/Sales rows by sub-view, swipe order, the tools in the top bar per role, History and Knowledge with no door and no row, `navRedirect` with an injected row (from a URL and from a saved history state), the names in refusal toasts; More and Filter on an injected toolbar (the dialog, a pick, More's badge, a token's ×, Back) |
| P195 `p195-load-benchmark.spec.ts` | TM1, then every step | every screen of §2 on the long book within its `LOAD_BUDGET` (screens, blocks, chains, toolbar rows) and, where §3d marks it, a verdict in the first phone screen; a screen with no budget fails |
| P185 `p185-today-map(.desktop).spec.ts` | TM2 | Needs you's add / Done / Snoozed / Learnt; the launch URLs; Pulse's period switch, the moved cards folding to their verdicts on the phone; Stats' three tabs, By client's and Cost's verdicts and Cost's source badges; Trends' head; Pipeline's dispatch cycle; the Planner's Moves, its goal on Play only and its rows on the phone; the presets; the report fitted at 393 px; TM2's redirect rows |
| P186 `p186-money-map.spec.ts` | TM3a, TM3c | Money's row; Payments' bills with and without a statement, and its order; the bills task; Record and New from the Credit notes dialog; the badge and CN marks; Live cost's link and no bills list; the Overview's verdict and folds; Receivables' rows; GST's rows on the phone; the redirect row |
| P187 `p187-cheques-in-hand.spec.ts` | TM3b | record, owed falls, deposit by number takes over once and places the client, an amount offer, the held task at 3 and 7 days, void, export and import merge, the statement of account's line |
| P188 `p188-floor-map(.desktop).spec.ts` | TM4 | Floor's Overview per role and its line cards worst first, People's switch and moved charts (bank series gated by money), Day's EXTRA rows folded, Week's, Month's and Areas' verdicts, Pay's change line, Roster's *To watch*, Production (Entries' thirty and badges, In plant's exceptions first, Lines toned, Equipment's primary), Stock (one toolbar row on the phone, fold and pane), Power (the order on Cuts, Causes' tiles from three cuts, the case fitted), TM4's redirect rows |
| P193 `p193-office-load(.desktop).spec.ts` | TM5 | Pipeline's verdict and coded stages; the challan row and task in one tone at 4, 5 and 10 days; Invoices' phone toolbar (every control reachable, the audit's badge on More) and its verdict; Clients' dots and words; Parts' callout and toolbar; Performance's hero and folds; Sales' moves and the one spare; Create's errors only after a try |
| P194 `p194-load-across(.desktop).spec.ts` | TM6 | each fact of TM6a in one tone wherever it is drawn (warning and danger books); the period to date in every chart that has one; History's phone toolbar; Training's verdict and row tones |

Fake names in the shop's shapes; dates from `todayIso()` / `recentTs()`; `noSeedIM()` where challans matter; `answerAsk` for
in-app questions.

## 8. Existing specs the steps must rewrite (not weaken)

A builder rewrites each assertion to the new place of the same fact. A spec that asserted a screen which no longer exists
asserts its successor (§5). **A widget that is now hidden by default is still a widget**: a spec about the widget itself sets a
custom layout showing it (`localStorage sep_inv_home` with `preset: 'custom'`) rather than losing its assertions. A spec that
needed a row to run past the phone's edge (P183's fade, P79's off-edge tab) picks a row that still does, or a narrower
viewport, and says why. Traps:
- **A selector that now matches two elements**: Playwright's strict mode throws. For example, a tab and a switch both carrying
  `invAttView` `data-view="day"`: give the tab its own value.
- **A default view that moved**: many specs open a page and assert its first view without clicking (Stats → overview, Staff →
  overview, Stock → overview, Production → overview, Power → overview).
- **A control that went behind Filter or More on the phone**: open it first (`phoneFilter`, `phoneMore`), never assert it gone.
- **A row that folded, or a list cut at thirty**: open the fold, or press *Show more*, first.

### 8a. By step (from the test survey of 9 Oct 2026; line-level detail in the session's research notes)

**TM1, the shell.** `fixtures.ts` (`WS_OF`: pageStats, pageReports, pagePlanner → `today`; pageHistory, pageKnow → none, opened
by the top bar or `navOpen`); `p134-workspaces(.desktop)` (the rows, the group label's sibling, the `MAP`, swipe orders, the
rail); `p183-insights-in-sight(.desktop)` (the group is Today's now); `p164-phone-doors` (Insights' views); `p132-reports(.desktop)`
(Reports after Stats in Today); `p154-knowledge.desktop`, `p155-kb-qa` (Knowledge by the book); `p103-leave-guard.desktop` (it
clicked Stats from Challans: use another Office tab); `p139-search.desktop` (Ctrl+click History is the top bar's; the keys list);
`p140-guard.desktop` (Office row's lists); `p53-appearance.desktop`, `p182-shell-tiles.desktop` (Stats selects Today's door);
`p39-stock` (`wsOf` list), `p71-stock` (Floor row), `p100-navigation(.desktop)`, `p153-qa-step7`, `p58-sidebar-subviews.desktop`;
`p68-clients` (Clients' row is three); `p80-page-scroll.desktop` (Quotations opened through Sales); `p131-quotations(.desktop)`,
`p150` QA5-13, `p176-prospects` (Quotations and Prospects through Sales); `p13-pwa-install` (launch addresses).

**TM2, Today.** The To-do: `p40-todo`, `p69-todo(.desktop)`, `p42-todo-relay.desktop`, `p41-relay` (quick task), `p111-shell-fold`
(widget URLs, the Done fold), `p13-pwa-install` (the manifest shortcut), `p129-qa-platform` (`todoHandleLaunch`), `p152-guard-qa`
(widget launch, `#todoContent`), `p158-ranked`, `p160-learn` (`#todoLearn` on Needs you), `p133-what-to-do(.desktop)`,
`p88-prod-links`, `p136-add`, `p153-qa-step7.desktop`, `p134` (`MAP`), `p39-stock`, `sweep-fixture` (`PAGES` loses pageTodo; the
`todo-*` dialogs stay), `p151-search-qa` (add-task). Stats: `fixtures.ts` `openStatsTab` (default `clients`), `p47-stats-intel`,
`p73-stats(.desktop)`, `p128-qa-intel`, `p13-pwa-install`, `p100-navigation`, `p139-search.desktop`, `p182-shell-tiles.desktop`,
`p147-desktop-layouts.desktop`, `p120-stats-stories` (→ Pulse's questions), `p133-what-to-do(.desktop)` (its local `openPulse`),
`p150` QA5-5, QA5-12, QA5-14, `p159-why` (→ Pulse, its causes as fact rows in a fold), `p105-stats-fold` (months and headline →
Trends, In one line → Pulse), `p64-finance-links` (`#statsCash` → Pulse), `p48-insights` (the list goes: its tasks are on Needs
you), `p132-reports` (the page fitted), `p14-stats-history`, `p16-derive-weights`, `p102-figures`, `p112-stats-credit-notes`,
`golden-flows`, `p4-revenue-empty-state` (the headline → Trends), `p14`'s output tax and `p73`'s billing cards (→ Money → GST and
Pipeline), `p77-part-invoice` (unbilled → Pipeline), `p46-cost` (Live cost's sources as badges). The Planner: `p162-planner`,
`p163-planner-qa` (eight views → four and the kinds; the toolbar's secondaries behind More on the phone; the goal on Play only),
`p166-plant`. The presets: `p121-home-widgets`, `p128-qa-intel` G5-16, UX-4, `p180-no-white`, and the widget specs `p40`, `p69`,
`p42`, `p41` (To-do card), `p3-home-empty-state`, `p104-state-shows`, `p76-v2-sweep` (crore, Recent), `p64`, `p102`,
`p126-qa-finance`, `p137-pipeline`, `p152` (Money card), `p147.desktop`, `p178.desktop` (layout).

**TM3, Money and Invoices.** `p56-bills-notes` (bills → Payments; notes → the Credit notes dialog), `p59-finance` (five tabs;
the bills task; the Overview's charts in folds), `p114-owner-rulings`, `p123-qa-billing` G1-6, `p126-qa-finance` G2-8,
`p109-money-fold` BB5, `p136-add` (Add → Bill), `p151-search-qa` QA3-11, `p79-select-scroll` fixture (`'pageFinance ›
Bills-notes'` → Payments; the note form in the dialog) and its off-edge test (Money's row may now fit), `p46-cost`, `p73-stats`
(Live cost's form → its link, its bills list gone), `p57-bank` (the statement first), `p102-figures` (Money's Overview judged
figures, now in its hero), `p126-qa-finance` (the debtor rows).

**TM4, Floor.** People: `p72-staff(.desktop)` (four tabs, default `day`), `p140-guard`, `p152` QA4-7 (the fallback), `p65-overviews`
(Staff and Stock Overviews → their new homes), `p149` QA6-6 and every test typing into an EXTRA row's form (open its fold first),
`p119-staff-board`, `p150` QA5-6 (the report's text), the paste helpers in `p107`, `p124`, `p41`, `p43`, `p90`, `p98` (Paste message
is on Day), `p183`'s People-row fade (pick a row that still overflows), `p161` (the register's cells toned, the summary a verdict),
`p114-owner-rulings` and `p116` (Pay's due rows fold their arithmetic), `p168` (Roster's *To watch*). Production: `p88-prod-links`,
`p130-qa-screens`, `p138-floor-day`, `p110-production-fold`, `p166-plant`, `p153-qa-step7` (`overview/hand` → `lines/hand`),
`p89-prod-store` (Entries past thirty: *Show more* first), `p177-power-causes` (an entry past thirty), `p151-search-qa.desktop`
(the entries pane), `p87` (In plant's order). Stock: `p65`, `p99-zinc-trend` (Spend and prices), `p152` QA4-3/QA4-4 (the reorder
callout), `p48`, `p71` (the reorder link), `sweep-fixture` `walkZinc`, every helper that clicked the Lines tab (`p39`, `p125`,
`p46`, `p110`, `p141`, `p56`, `p71(.desktop)`, `p134`, `p182`, `p80` stop `Stock › Lines`, `p79` fixture key `pageStock › Lines`),
and every phone spec pressing Reorder list, Print sheets, Export or Import (`p39-stock`, `p48-insights`, `p71-stock`,
`p110-production-fold`, `p156-stock-checks`: `phoneMore`). Power: `p177-power-causes`, `p115-power`, `p117`, `p127` (Enter a cut on
the default view; Causes' tiles plain under three cuts). Floor: `p138-floor-day(.desktop)` and its fixture (the tiles → the
heroes; the line cards worst first), `p151-search-qa(.desktop)` (the power tile), `p190`, `p191` (the line cards' order).

**TM5, Office.** Invoices' toolbar on the phone (filters and the sort behind Filter, Credit notes and Number audit behind More:
`phoneFilter`, `phoneMore`): `p108-invoices-fold`, `p11-invoice-number-ledger`, `p111-shell-fold`, `p137-pipeline`,
`p151-search-qa`, `p17-quality-certificate`, `p18-register-export`, `p19-credit-note`, `p23-bugfix`, `p32-register-pdf`,
`p70-register-sort`, `p91-selbar-phone`. Parts' toolbar: `p106-challans-fold`, `p50-settings`, `p68-clients`, `p8-weight-entry`.
Performance's folds: `p101-length`, `p106`, `p118-materials-worked`, `p122-register-gauge-alias-crew`, `p128-qa-intel`,
`p22-client-performance`, `p64-finance-links`, `p68`. The challan task's tone and rank: `p40-todo`, `p69-todo`, `p158-ranked`,
`p135` (Needs you's groups). Pipeline's stages: `p137-pipeline`. Create's errors: any spec asserting `#invErrorsArea` before a save.
Prospects' spare: `p176-prospects`.

**TM6, across the app.** History's filters on the phone: `p14-stats-history`, `p141-changelog`, `p29-floor-history`,
`p74-history`. Training: `p154-knowledge`. A chart's title or label read by a spec gains *to date*: `p73-stats`, `p102-figures`,
`p59-finance`, `p65-overviews`, `p88-prod-links`, `p115-power`. Tones made one: `p102-figures`, `p119-staff-board`,
`p138-floor-day`, `p178` (a tone a spec pinned on one screen now comes from the shared function).

## 9. Builder protocol

1. Work on the branch given, one step at a time, in order. Read §1–§5 and the step. Read the files named before editing them.
2. Grep every new top-level name across `split/*.js` before adding it.
3. **Measure the step's screens before editing** (P195 on the long book, and the survey's harness on the owner's book where the
   scratchpad has it).
4. Build (`bash split/build.sh`), run the step's spec and every spec §8 lists for the step, then the full suite.
5. **Measure again; lower the step's budgets in P195** to the new measure, never raising one (I10).
6. Commit the step with a message saying what moved and why, the trailers CLAUDE.md gives, no model name.
7. Report:
   - files changed;
   - specs added and rewritten (with counts);
   - the suite's result;
   - the screens' measures before → after;
   - the step's grep checklist output;
   - anything left or decided differently, with the reason.

   Never mark a step done with a failing test, a dangling door, an unchecked layout or a screen longer than it was.
8. Never: delete or skip a test to get green; raise a budget; write the owner's data into the repo; call a browser pop-up; add an
   inline style; change the book's shape beyond TM3b.
