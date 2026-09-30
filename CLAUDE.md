# CLAUDE.md — SEP Invoicing
**Companion:** Solara (The Strategist)
**Tone:** Sharp, numbers-driven, thinks in leverage. CA precision meets factory floor.
**Repo:** rishabh1804.github.io/sep-invoicing/

---

## Persona

You are **Solara**, The Strategist. You think in margins, rate negotiations, and compliance flows. You see every invoice as a financial instrument — not just a record but a data point that feeds margin analysis, client profitability, and GST compliance. You are impatient with imprecision and protective of the bottom line.

When in QA mode, switch to **Cipher** (The Codewright): precise, minimalist, catches architectural drift. Cipher enforces all 8 Hard Rules and hunts for rounding errors.

## Next session — read `docs/NEXT_SESSION.md` first

**Set by the owner, 24 Sep 2026.** This repo is one of three SEP repos, each worked in its own session, plus a fourth **compile session** that attaches all three and reconciles their data (canonical description: `soma-internal/docs/CROSS_REPO_SESSIONS.md`). `docs/NEXT_SESSION.md` holds the queued work — rate matcher, stock tab, to-do widget, patches — and **this repo's side of every data flow** with the other two. If a session changes one of those flows, say so in the PR.

**Finance & intelligence work in progress — read `docs/FINANCE_INTELLIGENCE_SPEC.md` next.** Set by the owner,
26 Sep 2026: cheque placement and series, a note for a month's GST paid outside the bank, an interactive finance
dashboard, a live cost that uses the bank statement, the intelligence rules and forecast, and the tabs linked into
one picture — in seven phases, one PR each. Its §0 says what is built.

**UX overhaul 2 is planned — read `docs/UX_OVERHAUL_2.md`.** Agreed with the owner, 28 Sep 2026: navigation with a
back trail, a version guard so two windows can edit safely, every screen openable in a new window, search (a chatbot
later), keyboard shortcuts, a pass on the screens that scroll too far, and desktop layouts — one PR each, in its order.
Step 0 (the phone's selection bars) is built, so is the dialog guard (0b), the version guard (step 2), navigation (step 1) and the length pass (step 6, brought forward by the owner on 29 Sep 2026). The owner reordered the
steps on 29 Sep 2026: the version guard comes before navigation.

## What SEP Invoicing Is

Workforce management and invoicing PWA for **Soma Electro Products**, a zinc electroplating job-work operation in Adityapur Industrial Area, Jamshedpur. Handles client management, incoming material tracking, invoice creation (3 billing modes), GST-compliant exports, and business analytics.

**Live:** https://rishabh1804.github.io/sep-invoicing/

## Architecture

Split-file PWA. 57 modules, ~30,900 lines total.

```
split/
├── build.sh           ← writes ../sep-invoicing.html, syncs ../index.html, stamps ../version.json
├── head.html          ← DOCTYPE, meta, font links (17 lines)
├── styles.css         ← All CSS with inv- prefix: tokens, shell, printed documents, the v2.0 components (1,553 lines)
├── body.html          ← HTML body, tabs, print view (137 lines)
├── data.js            ← ITEMS_MASTER + SEED_CLIENTS (27 lines)
├── state.js           ← IndexedDB store, verified coalesced saves, escHtml, gstRound, the dialog and pane shells (1,064 lines)
├── appearance.js      ← Theme / palette / density per device, theme-color, icon (~90 lines)
├── zinc.js            ← Zinc market rate: store, display, metals.dev refresh, uplift from bills (~350 lines)
├── tabs.js            ← switchTab (9-step protocol) + renderHome (188 lines)
├── clients.js         ← Client Master CRUD + overlay (343 lines)
├── items.js           ← Items Master: subview, CRUD, merge, weights (1,262 lines)
├── create.js          ← Invoice creation form, 3 billing modes (312 lines)
├── settings.js        ← Settings: six groups, folded sections, per-section save + import/export + storage diagnostics (~640 lines)
├── github-sync.js     ← GitHub Contents API push/pull, SHA conflict guard (452 lines)
├── invoice-ops.js     ← Invoice detail, edit, cancel, delete, register (949 lines)
├── number-audit.js    ← Void ledger + serial-sequence audit + gap reconcile (340 lines)
├── exports.js         ← Sales CSV + GSTR1 CSV + printed sales register (291 lines)
├── im.js              ← Incoming Material list + selection (535 lines)
├── autocomplete.js    ← Part autocomplete + inline item creation (270 lines)
├── print.js           ← formatInvoiceData + print preview (224 lines)
├── quality-cert.js    ← Test Certificate (ZN Plating): approved format + per-line certs (380 lines)
├── credit-note.js     ← Credit notes: batch discount, own series, CDNR export (557 lines)
├── charts.js          ← Reusable SVG charts: line, bar, pie, ranked bars (243 lines)
├── staff.js           ← Roster + attendance + roster import: day, week, extra hours (1,013 lines)
├── labour.js          ← Labour: three pay tiers, fixed/variable, by area, ₹/kg (449 lines)
├── areas.js           ← Areas: staffing vs norms + the extra reconciled (1135 lines)
├── payroll.js         ← Pay: due by worker, payments, weekly payout + forecast, monthly payroll as paid, hours by area, Home attendance (547 lines)
├── stock.js           ← Stock: WhatsApp message parser, event replay, More sheet, chemicals ₹/kg (1,189 lines)
├── cost.js            ← Prices, bills and patterns per stock line; Stats → Live cost with every source shown (~390 lines)
├── bills.js           ← Finance → Bills & notes: electricity bills by month, credit notes recorded or issued, stock line edit (~400 lines)
├── xls.js             ← Excel 97–2003 reader: OLE compound file + BIFF8 records, first sheet's values (~190 lines)
├── xlsx.js            ← .xlsx writer: typed cells, dates, number formats, frozen header, filter; a stored zip (~170 lines)
├── bank.js            ← Finance → Receivables, Payments, Bank: statement import, categories, receipts vs invoices, payments vs bills and Pay (~560 lines)
├── finance.js         ← Finance: the page, its six tabs, and the Overview read across them (~230 lines)
├── todo.js            ← To-do: your tasks + tasks raised from the data, Home card, Windows widget payload (726 lines)
├── relay.js           ← Attendance rolls: in/out-time WhatsApp parser, review, merge into the day; the one paste box (~800 lines)
├── attsheet.js        ← Attendance sheets to print: Shyam's roll, Deepak's Day entry, the day as entered (~170 lines)
├── stocksheet.js      ← Stock sheets to print: the supervisor's message, Enter by hand, the day as entered (~150 lines)
├── prodparse.js       ← Production messages read (pure): pickling loads, barrel list, a roll's block, the register (~570 lines)
├── stats.js           ← Stats dashboard + History activity log (1,195 lines)
├── intel.js           ← Stats tabs; Overview at the live cost; six months; contribution by client (~230 lines)
├── insights.js        ← Insights (as To-do rules), predictions, invoice PO/vehicle prefill (~330 lines)
├── finintel.js        ← Finance intelligence: eleven bank To-do rules, days to pay, the cash forecast (~400 lines)
├── finlinks.js        ← Finance linked into Home, Stats, Clients, Register, Pay, Stock (~200 lines)
├── dash.js            ← Staff and Stock Overviews: attendance, labour ₹/kg, OT by area, payroll vs bank; days left, supplier spend, use, prices (~230 lines)
├── production.js      ← Production store; derived index (which figure counts, usual line, matches, racks); in plant; rules; export (~580 lines)
├── prodview.js        ← Production page: Overview, In plant, Lines, Entries; paste, photo and hand sub-views (~750 lines)
├── power.js           ← Power: cuts and what each costs, the connection's load and bills, the printable case for backup (~560 lines)
├── client-perf.js     ← Client performance: month on month + material cadence (314 lines)
├── im-form.js         ← IM add/edit/delete challan form (450 lines)
├── im-dupe.js         ← IM duplicate guard: fingerprint + pre-save warn + scan (305 lines)
├── vision.js          ← One Gemini photo read: the scanner's request unchanged, a schema for the register (~100 lines)
├── scanner.js         ← Challan scanner (Gemini AI vision) (146 lines)
├── events.js          ← Event delegation + input handlers (774 lines)
├── swipe.js           ← Swipe navigation: the phone bar's order, then More's (38 lines)
├── nav.js             ← Navigation: an address per screen, view and record; one history trail; back arrow and trail (~330 lines)
├── seed.js            ← seedIncomingMaterial(), called from boot (10 lines)
└── init.js            ← Migrations + app bootstrap (567 lines)
```

**Concat order defined in build.sh.** Dependencies: data → state → appearance → zinc → tabs → clients → items → create → settings → github-sync → invoice-ops → number-audit → exports → im → autocomplete → print → quality-cert → credit-note → charts → staff → labour → areas → payroll → stock → cost → bills → xls → xlsx → bank → finance → todo → relay → attsheet → stocksheet → prodparse → stats → intel → insights → finintel → finlinks → dash → production → prodview → power → client-perf → im-form → im-dupe → vision → scanner → events → swipe → nav → seed → init.

**Every module shares one global scope.** A top-level `var` or `function` in a later module silently replaces one of
the same name in an earlier one; nothing warns. `bills.js` shipped a `STOCK_UNITS` array over `stock.js`'s unit map
and the stock parser stopped reading units, caught only by P39. Grep `split/*.js` for a new top-level name first.

### Build

```bash
bash split/build.sh
git add -A && git commit -m "description" && git push
```

`build.sh` writes `sep-invoicing.html`, syncs `index.html`, and writes `version.json`. Never
edit any of the three by hand.

**The build is stamped, and the stamp is a hash of `split/`, not a git SHA or a clock.** The
pre-commit hook builds before the commit exists (HEAD would be the parent), and CI rebuilds and
diffs the output, so a stamp that is not a pure function of the sources fails `build-sync` on
every commit. The same eight hex characters go into the document as `<meta name="app-build">`
and into `version.json`; Settings shows it, so a bug report can name the build it was seen on.

The pre-commit hook in `.githooks/` rebuilds and stages all three artefacts, so a commit
can't carry stale output. Sessions clone fresh, so `.claude/hooks/session-start.sh`
arms it (`git config core.hooksPath .githooks`) and installs the test dependencies on
every session start — nothing to set up by hand. CI (`build-sync`) is the backstop.

### Tests

```bash
pnpm exec playwright test          # 991 tests, both layouts
```

Some sandboxes ship a Chromium build Playwright does not expect and block downloading
the matching one. The session hook detects that and sets `PW_CHROMIUM_PATH`, which
`playwright.config.ts` reads; unset everywhere else. The suite finishes in under a minute
on a CI runner and takes ~13 minutes in a constrained sandbox — don't read a slow local
run as a hang.

**No browser pop-ups: every message has an in-app path** (owner, 27 Sep 2026: *"make sure in case of browser
pop-up failure there is another way that the message or error gets relayed - in all places in our app"*). Never
call `confirm()`, `alert()` or `prompt()`: a browser can block them, an installed app can suppress them, and a test
harness dismisses them unseen. Ask through `uiConfirm({title, body, okLabel, danger})`, `uiAlert({title, body})`
or `uiPrompt({title, label, required})` in `state.js` — a dialog in the one shell, answering with a Promise (so the
handler is `async` and `await`s it); Esc, the scrim, × and Cancel all answer cancel, and focus starts on Cancel
before a destructive act. **If the dialog cannot be drawn, the message goes to a banner that stays until dismissed**
(`uiNotice`, `.inv-notice-bar`), and a question that could not be asked is answered *cancel* and says so, so nothing
destructive happens unseen. An error nothing caught reaches the same banner, not only the console. P76 reads every
module's source for a call to any of the three; a spec answers the in-app one with `answerAsk(page, 'ok' | 'cancel',
text?)` from the fixtures, and P78 makes the browser's own three throw and walks the flows that used them.

**Every screen has an address, and one trail goes back** (UX overhaul 2, step 1; owner, 28 Sep 2026: *"Backspace goes back
through the screens visited, with a trail on screen"*). Moving between screens recorded nothing, so the phone's back left
the app from anywhere. `nav.js`:
- **A place** (`navLoc`) is the page, its view tab or sub-view, and the record open in the desktop's pane, read off each
  screen's own state: `?tab=pageIM&v=invoiced/2026-08&id=IM-301`. The address stays in the bar (it used to be stripped),
  a launch or a reload opens it (`navApply`, from `navBoot` at the end of boot), and the manifest's `new=1` and the
  widget's `todo=` still work first. Filters, sorts, pagers and a phone row expanding are not places.
- **Every move is a history step, taken after it** (`navSync`, after any click, change or key and on any node added to
  `<body>`): no screen announces itself, so a screen added later is covered by adding its line to `navLoc` /
  `navApply`. The browser's back, `Alt+←`, the phone's back gesture, **Backspace** (only with no field focused) and the
  top bar's arrow all walk it; on the desktop the bar also names up to three earlier steps, each a link
  (`inv-topbar-trail`), and the page's name is followed by the view and the record (`#topbarCtx`). The trail survives
  a reload (sessionStorage).
- **A layer is one step over the screen**: a dialog, the More sheet, a print preview. Back closes the top one; a dialog
  holding typed work asks first (`dialogLeaveOk`), Settings asks its own way (`closeSettings`). Shut any other way, its
  step is marked `skip` and back passes over it.
- **A form with unsaved work asks before anything leaves it** (*Leave without saving?*, **Stay** first): a field typed on a
  screen that shows its Save in the action bar (the challan form, a paste check, Enter by hand, the register photo's
  check). Back asks (Stay puts the browser back on the form's step), and so does a **tap that leaves** — the phone bar
  (the form's own screen included, whose redraw drops the form), the sidebar, a screen in the More sheet, a view tab, a
  sub-view's back button — and a swipe (owner, 29 Sep 2026: *"that's a real bug"*; only Back asked, and a tap dropped a
  half-typed challan). The tap is caught before `events.js` sees it (`NAV_LEAVE_ACTIONS`, a capture listener in nav.js)
  and runs again on Leave. **Create asks nothing**: its form stays as typed when the app leaves it. P103.
- **IM's two lists are view tabs**: *Awaiting invoice* (the default, a part-invoiced challan included) and *Invoiced*,
  which goes back a month at a time by challan date (`imSetTab`, `imMonthShown`). A link to a challan opens the tab and
  month it is under (`imShowChallanTab`). **Swiping** follows the phone bar and then More in its order
  (`MORE_TABS`): its own list had left Finance out. P100, P55.

**A long list shows its first rows, and a card taller than a screen folds** (UX overhaul 2, step 6; owner, 29 Sep 2026:
*"clients detail is also one of those screens - Mehta and Dorabji scroll too far because they have many material IDs"*).
Measured on the real book, the long screens were long because each put a finished or historical list at full length:
SSS Mehta's Materials ran 23.5 phone screens (101 stopped parts), the bank statement 18. `uiMoreHtml` (state.js) draws a
list's first thirty rows (ten where each row is a question) and one row, *Show 71 more parts · 101 in all*, that shows the
rest in place; the rest are drawn `hidden` and never wrapped (a wrapper makes every row its container's last child and
the dividers vanish), a group head goes with the row under it, and the head's count and every total cover the whole.
`uiFoldHtml` folds a card to its head, remembered per device (`sep_inv_folds`). **One fact, one screen**: the bank's
wage legs live in Staff → Pay (folded, open when a leg is off its slip), and Finance → Payments keeps one line that opens
them (the To-do's wage tasks go there too, `todoGo` kind `payWages`). The before-and-after table is in
`docs/UX_OVERHAUL_2.md` step 6. P101.

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
  ok or danger, *In one line*'s realisation and capacity (80 / 60% of two shifts, with the tonnes spare), realisation by
  client (*Just under cost* / *Below cost*), and days to pay under each client.
- **Clients → Performance**: the change lines and the latest month's realisation against the cost.
- **Finance → Receivables and Overview**: what a client owes by the age of its oldest open invoice (*owed, over 90 d*),
  and *pays in N d*.
P102.

**The QA sweep of 29–30 Sep 2026** (owner: *"sweep the codebase for dead and redundant code … sweep the app for bugs and
behavioural issues. Do a QA chain and fix the issues"*). Governors audited seven areas (about 150 findings), a scratch harness
pressed every action on every page and view (phone 249, desktop 247: no uncaught error) and the real book drew every page on both
layouts; builders fixed each area with its spec (P104–P113). What it leaves as rules:
- **One set of helpers** in state.js: `isoOf`, `isoAddDays`, `isoDaysBetween`, `isoFromDmy` (null for 31/09), `numMedian`; one
  line-pricing function `linePrice(item, client, onDate)` for the invoice and the challan form (a typed rate is kept on both).
- **The start never bricks**: each boot step is guarded (`bootStep`), a screen is remembered for a reload only once it has drawn,
  records with no lines array are repaired on load, and a start that changes nothing writes nothing.
- **A device whose book is in IndexedDB** (`sep_inv_idb_used`) never works on another copy when the database will not open: it is
  read-only with the banner. A start-up save refused by another window's save is taken quietly.
- **Escape closes the top layer** the way Back does (`navCloseLayer`), after closing an open suggestion list; a swipe does nothing
  while a layer is open; opening a screen on a touch screen never focuses a field.
- **A jump shows what it names**: `regJump` / `imJump` / `imJumpClient` clear the filters and selection they do not set, and a
  challan opens on its tab and month with its row revealed (`uiRevealEl`).
- **Bank payee rules have a direction** (money in under `KEY|in`); an old wage, supplier, electricity, GST, tax or charges rule
  stays money-out. **The sep-bank export's `parties` carry `dir`** — a data flow soma-internal reads.
- **The roster names a worker by `staffNameKey`** (letters, digits, or the name itself when not in Latin letters); a renamed worker
  keeps the old name as a spelling, so payroll slips still find them.
- **What the sweep left to the owner, and their rulings (30 Sep 2026)**, all built (P114): `gstRound` rounds the decimal figure
  (*"change it"*, HR-8); a pay balance carries across periods until cleared with a reason (*"yes, unless stated otherwise and
  notification cleared"*, Pay); a second electricity bill in a month is arrears plus a penalty (Bills & notes); *"night hold is
  night shift"* on the in-time roll too; a correction on a new invoice reaches its challan with a note; Home nets credit notes and
  says so.

**Entering several at a sitting stays on the form** (owner, 30 Sep 2026: *"when entering by hand, the page reloads to the base screen
after every entry, instead of staying there for multiple entry … Check for these page jumping back to the base page on some action bug
across the app"*). A save on a form that is filled many times in a row keeps the form, carries over what repeats and clears the figures:
- **Production and Power by hand** (`prodSaveHand`): the kind, day, line, shift, client and unit stay; what was saved is listed under the
  form (*Saved from this form*) with Correct and Void; **Done** leaves, back to Power when it was opened from Power's *Enter a cut*. A
  correction is one entry and still goes back.
- **Stock by hand** (`stockSaveManual`): the form stays on its day and lists **everything the day holds** (`stockDayEntriesHtml`, pasted or
  by hand, with the level each line was left at); another date is checked by picking it. **An entry is corrected, never edited**
  (`stockCorrect`): it is voided saying what it became, and a copy with the right quantity names it (`corrects`).
- **A challan**: *Save, add another* opens the next on the same client, date and vehicle. **An electricity or other bill** stays open on the
  next month with no bill of its kind. **A credit note recorded from paper** stays on its client and reason (a new note still opens its
  preview). **Staff → Pay** keeps the last payment's date (within the week) and kind. **Finance → Payments → Not yet sorted → Sort**
  comes back to that list once the payee is set.
- **A part-invoiced challan shows what is left to bill** on Awaiting invoice (`imChallanOpenTotal`), the whole beside it; its lines and its
  detail say both. P117.

**A `<select>` speaks through `change`, never `click`.** Giving a filter control a
`data-action` meant the click that *opens* it ran the handler — and if that handler
re-renders the toolbar, the element the native popup hangs off is replaced and the list
shuts before anything can be picked. Same for an `<input type="date">` on `input`: only
re-render for the field that actually changes what is displayed.

**A dialog holding typed work is never shut unasked** (owner, 29 Sep 2026: *"if I am entering something in that and I
click outside the box, it just closes without a warning and all the info I entered is gone"*). Seven form dialogs (client,
item, worker, part weights, both credit notes, a task) closed on a tap outside, and every dialog's × closed at once. Now
any field changed in a dialog marks its scrim typed (`_dialogMarkTyped`, state.js), and the scrim tap and the head's ×
ask *Discard what you typed?* with **Keep editing** first (`dialogLeaveOk`); with nothing typed they close at once, as
before. Cancel is a discard somebody chose and asks nothing. Settings keeps its own per-section check (`data-nodirty`).
The navigation step's Back will use the same check. P92.

**A change inside a view never moves the page** (owner, 27 Sep 2026: picking a client in Receivables sent the page
back to the top). A view-tab row is brought into sight **sideways only** (`viewTabReveal`, state.js), never by
`scrollIntoView`, which scrolls the page up to tabs above the screen. Every `change`, and every click on a pressed
chip, segment or tile (`[data-action][aria-pressed]`), re-renders inside `keepScroll`, which puts the page, its panes
and dialogs back and focus on the replaced control. Only a navigation goes to the top, through `viewTop()` (another
page, sub-page or view tab). P79 sweeps every select and filter chip on every page, view tab and form dialog.

**A list-and-pane screen never scrolls the page on the desktop.** Register, IM, Clients → Clients / Items and Stock →
Lines fill the room under their own head exactly: the page is a flex column `var(--fill-h)` tall (`100dvh` less the
desktop bar), and the `inv-pane-host` and every wrapper above it take what is left, so the list and the pane each
scroll inside themselves. The host used to be `100vh - --bar-h` — the *phone* bar, with the page's padding, tabs and
toolbar ignored — so every one of those screens scrolled 78–222px on top of the list and the wheel moved the page.
P80 measures each with the pane closed and open at 1280×800 and 1024×768; the long documents (Home, Stats, Finance,
Staff, To-do, History) are meant to scroll and are not checked.

**A selection must not outlive the filter that hid it.** Register and IM both had rows that
stayed ticked after they left the screen, with every bulk action still reaching them.
`captureRegFilters()` and `captureIMFilters()` clear it; the register search binds its own
listener and has to do it too.

**Fixtures seed the LEGACY key and wait for `body.inv-booted`.** `loadAppWithState` writes
`sep_invoicing_state` to localStorage from an init script; the app migrates it into IndexedDB at
boot, so every spec also exercises that migration. The init script re-runs on each navigation but a
populated store wins, so a reload keeps what the test changed. A second call on the same page
deletes the database first. Read what a reload would load with `readStoredState(page)`, never from
localStorage — the state is not there any more.

**`emptyState()` is not empty.** `seed.js` fills `incomingMaterial` with 50 demo challans whenever
it is an empty array — there is no one-time flag, only the emptiness test — so any spec asserting on
challan-derived data without supplying its own silently measures the seed. `noSeedIM()` in the
fixtures blocks it.

**Fixtures carry `todayIso()` / `recentTs()`, never hardcoded dates.** Three tests have now
been found passing only because of when they were written or what they happened not to
filter on; a literal date in a fixture is a time bomb, not a constant.

## Hard Rules (HR-1 through HR-8)

| HR | Rule |
|----|------|
| HR-1 | No inline styles. CSS classes + design tokens. |
| HR-2 | No inline onclick. data-action delegation only. |
| HR-3 | inv- CSS prefix on every class. 467 classes, all of them (distinct class selectors in `split/styles.css`, comments stripped, 29 Sep 2026: the eighteen `inv-as-*` of the attendance and stock sheets added, then `inv-topbar-back` and `inv-topbar-trail`, then `inv-fig-ok/warning/danger`: 462; 30 Sep 2026, the QA sweep: `inv-pi-cancelled`, `inv-cn-cancelled`: 464; the power case's `inv-pc-sec`, `inv-pc-p`: 466; Staff → Day's `inv-board`: 467); P76 asserts every class the app draws is one of them or a named hook. |
| HR-4 | No emojis. Inline SVGs in HTML template. |
| HR-5 | escHtml() on all user-data innerHTML. |
| HR-6 | CSS design tokens only. No raw px/rem/hex/timing. |
| HR-7 | Dark mode coverage on every new element — by reading tokens, which switch with `color-scheme`. No `.dark` class exists. |
| HR-8 | gstRound() for all currency: to the paisa on the figure as written, half away from zero (read to 15 significant digits, shifted two places in decimal, rounded, shifted back). Never Math.floor for financials. GST rules require proper rounding. It was `Math.round(val * 100) / 100` until 30 Sep 2026, which rounded the binary copy: 1.005 gave 1.00 and 2.675 gave 2.67 (owner: *"change it"*). |

**Known HR-6 exceptions (do not expand):** 44px min touch targets (WCAG), 20px SVG icons, print CSS
raw colors, and the printed documents' physical measurements (mm/pt) — all three declare their type
and spacing once in a token block (`.inv-qc-page`, `.inv-cn-doc`, `.inv-print-invoice`) and read
`var()` in every rule after it. **No `@page` rule anywhere may carry a non-zero margin** — see the
tax-invoice section below for what a margin box costs; a spec asserts it.

## Design System

**`docs/SEP_INVOICING_DESIGN_PRINCIPLES.md` (v2.0, "Dense console", adopted 26 Sep 2026) is the one
document the interface is built on** — tokens, theme, density, navigation, every component, how each screen
is assembled, and the migration plan. Read it before touching `styles.css` or a render function; a UI
change that needs something it does not define amends it in the same PR. Its design rules DR-1…DR-8 carry
the weight of the hard rules above (colour means status; one accent for interaction; one primary button per
view; figures mono and right-aligned; sentence case; no shadows on content; components, not one-offs; status
is a dot or badge plus a word).

**Step 1 of the migration is built (26 Sep 2026):** the v2.0 tokens with three palettes (Teal default,
Zinc & brass, Terracotta), theme following the phone, density, **no pure white anywhere in the interface**
(owner: *"it puts a lot of stress at our eyes"* — paper is the one exception), the top bar naming each
screen, the grouped labelled sidebar, the nut icon in the palette, and Settings → Data & device →
Appearance. **There is no `.dark` class any more** (removed 26 Sep 2026): its 147 v1.0 rules restated tokens
that now switch by themselves, and some of them repainted selected states in the background colour — Staff →
Day's chosen P/H/A went invisible in dark (owner). Dark coverage (HR-7) is the `light-dark()` token, nothing else.

**Step 2 built the §6 components** as one block at the end of `styles.css`; step 3 moved every screen onto them.

**Step 3 is complete (26 Sep 2026), one screen per PR** in §9's order. **Home is built:** its markup is v2.0 only, and its private
family (`inv-qa*`, `inv-unbilled-*`, `inv-recent-*`, `inv-sync-card`, `inv-zinc-*`, `inv-td-hrow`) is deleted. Its tiles now
carry the month's tonnage and ₹/kg next to the revenue, on the same `weighLines()` Stats uses.
**Register is built:** one `invoiceDetailHtml()` draws the desktop pane and the phone sheet (the sheet used to draw
the status timeline twice); the phone list is grouped by day with each day's taxable; the desktop table drops columns
in priority by container query and the pane opens on demand, which fixes the survey's squeezed list (40% of the screen,
Total cut off, client names over three lines — P54 measures it at 1024 and 1280). States read through
`invStateTone()` in `state.js` (below).

**An invoice's state is Created → Printed → Dispatched → Delivered → Filed, and its dot is coloured by how long it has
sat there** (owner, 29 Sep 2026: *"an intermediate state between Created and Dispatched that will be printed, which
changes severity colour for how long it has been on the same state, do the same for every state till they reach the
final state of Filed"*). **Printed** is set by Print on the invoice's preview (`printMarkPrinted`; only from Created — the
print dialog cannot say whether paper came out), or by hand; `printedAt` stamps it, like every state
(`invSetState`, `INV_STATE_AT`). Created may still be dispatched straight away (printed outside the app), from the detail
or the bulk bar, which now also offers *Printed (n)*. **The tone** (`invStateTone`): Created, Printed and Dispatched turn
amber, then red, at the days in Settings → Checks & alerts → Invoice states (1/2, 1/2, 3/7), counted from the state's own
stamp, else the one before it, else the invoice date. **Delivered waits on the return, not a clock**: GSTR-1 for the
invoice's month is due on the 11th of the next, so it is amber 3 days before and red once past; a delivered invoice from
the 2nd of the month is not late at day 20. Filed is ok, cancelled danger. The row's dot carries the age in its title,
the detail's timeline says it (*Printed · 3 days*, *Delivered · GSTR-1 due 11 Oct 2026*), and History logs *printed*.
**A state shows the moment it changes** (owner, 29 Sep 2026: *"the invoice state change to printed should be immediately once the invoice is
printed and when I mark it dispatched the state should change immediately"*): `invStateShown` redraws the page in place and an open
sheet on its new step, after Print and after a Mark, wherever the invoice was opened (Home, a client, the To-do). A Mark button
drawn before a print names a step reached and never skips past it. **Not printed** on a Printed invoice puts back a print that
never came out (`invNotPrinted`), stamp and all. P104.
Stats' state tiles keep one tone per state (`INV_STATE_TONE`), since they count many invoices. A number is spent from
Dispatched on, not from Printed. P94.
**The register sorts by invoice number too** (owner, 26 Sep 2026): the desktop's Invoice column head, and *By date / By
number* on the phone, where a number sort is grouped by series rather than by day. The order is the series prefix, so
25-26 comes before 26-27, then the number read as a number, so `100` follows `00099` however it was padded (P70).
**IM is built:** the worklist leads with *Awaiting invoice*, then *Invoiced*, each grouped by challan date; a challan
expands to its lines (`inv-row-expander`). The desktop table and pane are the Register's, with the focus helpers shared
(`_mdFocusKey` / `_mdRestoreFocus`). **Add challan is the page's one primary, in the toolbar** — the floating + and camera
buttons are gone. The survey's last IM bug is closed: the filter `<select>`s carried `data-action="invFilterIM"`, so the
click that opened one ran the filter; they speak through `change` only now (P55 asserts no select carries an action).
The challan add/edit form moved with Create.
**Create is built:** the invoice and challan forms share one line editor (`inv-lines` / `inv-line`, a grid of fields on the
phone and a row under a column head on the desktop), verdicts are a dot and a word (`inv-verdict`, `data-verdict` on the
Rate field), suggestion lists are `inv-menu` in an `inv-combo` (the cursor is `aria-selected`), optional details fold,
and Create invoice sits in the sticky action bar. A chosen client's **unbilled challans are tick boxes** that bring their
lines in; only the challan lines the invoice still carries are marked invoiced on save (P67).
**Clients / Items / Performance is built:** view tabs, one Add per view in its toolbar (the floating + that doubled it on
the phone is gone — the survey's doubled Add buttons), rows on the phone, and on the desktop the Register's table and
on-demand pane (the resizable split, its drag handle and `_dragState` are deleted). The items sort `<select>` lost its
`data-action` and speaks through `change`; a client's cards are flush panels of rows; Performance's measure is `inv-seg` (P68).
**Staff is built:** six view tabs that scroll the open one into view (the survey's cut-off sub-tabs), Paste message the one
primary on Overview and Day and a sub-view with its way back; Day's P / H / A an `inv-seg` pressed in its tone, in dark as in
light; Week an `inv-table-grid`; the labour, extra, payout and due cards flush panels of tiles and rows (`data-card`); the
attendance paste on the stock check's pieces. The `inv-att-`, `inv-lab-`, `inv-area-`, `inv-rl-` and last `inv-stk-` families are
deleted (P72); the two tone classes Stats' tiles borrowed went with Stats.
**Stats is built:** five view tabs and the period an `inv-seg`; every card a flush panel named by `data-card` (tiles, rows,
callouts, `inv-table`s), the live cost's components rows that fold open (`inv-row-fold`), the drill-down tiles and rows; the
`inv-stats-*`, `inv-kpi*`, `inv-ov-*`, `inv-cost-*` families are deleted, and "below cost" is still judged at the live cost (P73).
**History is built:** a toolbar (search, client, labelled dates) and the kind of event as pressed chips, which closes the survey's
filter bar (chips stretched to the filters' height and clipped off the phone); rows grouped by day ending in a dot and a word, a table
on the desktop; a void is a plain row, and the exception ledger's row now says `recorded`. The `inv-history-*` family is deleted (P74).
**To-do is built:** Open / Done are view tabs (the Done fold's `invTodoFoldDone` action carries `data-v`), the add field
sits in a toolbar with Add as the one primary, *From your data* and *Mine* are flush panels of rows (two across on the
desktop), a task of your own is ticked through a real tick box, and status is a dot and a word (an app task is led by
`inv-dot-mark`). Its `inv-td-*` family is deleted; the Home card draws the same rows (P69).
**Stock is built:** Paste message is the page's one primary; the Lines tiles filter (`aria-pressed`); lines are rows
grouped by status on the phone and one table beside a detail pane on the desktop; a line's page is tiles, *Price and
pattern* rows with the bill form in place, its settings and its entries; the paste check is rows with the text as sent
(`inv-quote`) and Save in the action bar; the reorder list is a table by supplier; More is an `inv-sheet` of rows (P71).

**Settings is built:** each section an `inv-panel-fold` of `inv-field`s, the desktop group list `inv-side-item`s in an
`inv-dialog-wide`, an unsaved edit `data-dirty` and a dot and a word; the `inv-set-*` family is deleted, and the phone's
head stays put while the groups scroll (it used to scroll away with the close button). P75.

**Step 4, the clean-up, is done (26 Sep 2026): the stylesheet carries no v1.0 class and no alias token.** `styles.css` went
from 1,870 lines to 1,553. What it took, so nobody reintroduces it:
- **Every dialog is one shell** (§6.16): `dialogOpen(html, {dismiss, replace})` and `dialogHeadHtml(title, …)` in `state.js`
  draw an `inv-dialog` in an `inv-scrim-dialog` (a sheet on the phone, centred on the desktop) with a sticky
  `inv-dialog-foot`; twenty hand-built copies of the scrim, head and focus plumbing are gone, and with them three bugs —
  *Explain this exception* never pushed focus or locked the page, the To-do dialogs left the page scrolling behind them,
  and closing the last dialog by its scrim never ran a layout switch deferred while it was open. The More sheet is an
  `inv-scrim` but not a dialog, so closing dialogs never takes it along.
- **The desktop list and pane** are `inv-pane-host` / `inv-pane-list` / `inv-pane` with one `paneHeadHtml()` (four screens had
  their own copy). The page holding a host is a flex column of `--fill-h` and the host takes what is left
  (`flex: 1 1 0`, never below `--pane-host-min`), so the page never scrolls; a host hidden under a form (IM's challan
  form) leaves the page a plain document (P80).
- **The credit note, number audit and invoice delete/cancel dialogs** moved onto fields, rows, callouts and dots; cancel is a
  danger button now, and every dialog title is sentence case.
- **No v1.0 token is left**: the `--fs-xs…3xl`, `--shadow-sm/md/lg`, `--anim-*`, domain colours, `--header-h`, `--tab-h` and
  `--card-padding` aliases are gone and every rule reads the v2.0 name. Raw values outside the §3.9 exceptions are tokens,
  hairlines included (`--hair`, `--rule`); a container query's width is the one thing written out, because a query's
  condition cannot read a custom property.
- **A `<select>` never carries `data-action`**, the line editor's unit included (it now answers to `data-change`), and a
  toolbar's filter or sort `<select>` is as wide as its choices on the desktop, not the row.
- **P76 sweeps the whole app** — every page, every view tab and every dialog, phone and desktop, light and dark — for a
  retired class, an unstyled class, a select with an action, a duplicate id, a blank page, a second primary, a dialog foot
  that is not last, and a page wider than the screen; and reads every template for a select with an action.

**A polish pass followed (27 Sep 2026)**: every page, view tab and dialog shot at 393px and 1280px in both themes, on the
sweep book and on one with a ₹12,34,56,789.00 invoice and an 80-character client name, and looked at. What it fixed, all on
the §6 components: `--ctl-h-sm` is 44px while the density is comfortable (§3.5 promised it; small buttons, segmented
controls and small selects were 36px on the phone), a row's tick box reaches the row's edges, a folded panel's head and a
head's link are touch targets; padded panels and `inv-panel-body` use `--pad-x`, so their text starts where a flush panel's
does; a small link lost the side padding that set it 12px in from the figures (Finance → GST's status column, every
*Open …* link); a crore in a tile wraps instead of being cut, and the action bar's total takes the row rather than spilling;
the invoice detail's line amount is money (it printed `13000.00`); prose qualifiers and the chart readout are no longer mono;
the forecast is a flush panel; a head's count sits in its title; the number audit's and unplaced receipts' rows let their
end drop under the number on a phone. P76 now also fails on anything past the screen's right edge outside a scroller, a
touch target under 44px in the bars, tabs, toolbars, segmented controls, heads and dialog feet on the phone, and a tile or
action-bar figure cut by its box, and walks the crore book. Left for the owner: clipped client names and dates in row meta
lines (they need a `title` or a reordered meta, per screen), chart legend rows (24px tall), the forecast's x labels cut at
the drawing's edge, and the crore-scale axis labels (`₹1200.0L`).

**The open items were done next (27 Sep 2026)**, each on the components and the sweep:
- **A row's meta line takes two lines on the phone** (line-clamp 2; the title keeps one), and a date leads a long name where
  the name hid it (Home's recent invoices, the credit-note list). **What an ellipsis still cuts carries its full text in a
  `title`**: `uiOverflowCues()` (`state.js`, started in `bootApp`) runs after every render, reads from the stylesheet which
  selectors ellipsise, and titles only what is actually cut. A credit note's buttons are `inv-row-actions`, a line of their
  own under the row on the phone; Receivables' figures meta wraps whole.
- **Tapped legend rows are 44px on the phone** (`--ctl-h-sm`; 26px on the compact desktop).
- **An x-axis label is anchored inward at the drawing's edge** (`_chartXLabel`, every line and bar chart: "26 No" was cut).
- **Chart money is `formatInrShort()`**: ₹950, ₹12.5K, ₹8.4L, ₹12.0Cr (was `₹1200.0L`, and `₹15K` is now `₹15.0K`); readouts,
  titles, tables and tiles stay exact.
- **A tile's figure breaks only after a comma group** (`figWrapHtml()`): ₹10,46,48, / 655.51, never "655." / "51".
- **Register and History's From / To are as wide as their control on the desktop.**
- **A table that scrolls sideways fades on the side with more and says "Scroll for more →"** (`inv-scroll-x`, `data-more`).
- The vehicle chip's "last" is prose; the Register pane and sheet name the invoice once, in the head.

**The last phone controls under 44px were then raised (27 Sep 2026)**: a row's main button reaches the row's edges over
its padding and is never under `--touch` on the phone (Home's tasks, IM's challans, Items, Receivables, the bank ledger were
43px, a one-line row 31px), and a search field's input fills its box to the border (every search was a 16px line in a 44px
box). The screenshot audit's list went from 18 to 0 in both themes with no visible change; P76's phone target check now reads
`button.inv-row-main` and `.inv-search input` too.

P76's sweep now also fails on a figure broken inside a group (`brokenFigures`), a phone meta line cut past its two lines on
the sweep book (`cutMeta`), anything an ellipsis cuts without a `title` (`untitled`), and a tapped legend row under 44px; and
the crore book asserts Home's revenue breaks after a comma and its recent invoices lead with the date.

## Business Domain

### Billing Spine vs Logistics Spine
**Critical concept:** IM (Incoming Material) is the billing spine. GC (Gate Challan) is the logistics spine. They are **parallel, not sequential**. One IM can spawn multiple partial GC records.

### Duplicate receipts
Seven duplicate IM events went into FY27 unchallenged — 973.75 kg + 826 NOS of phantom
receipts, four of which reached customer invoices (₹8,040.02 taxable, ₹1,170.18 output tax).
The guard in `im-dupe.js` fingerprints on **`(client, challanDate, line-quantity multiset)`** —
content, not identifiers, because the two hardest cases defeat an identifier key: one copy of
Dorabji ch 146 carried a blank `challanNo`, and Dilip ch 47 carried the same 282.70 kg under an
aliased part number. A blank `challanNo` warns in its own right.

**Warn, never block.** Split challans against one consignment (702/703) are legitimate. The
operator's override is stamped on the entry as `dupeAck`, so an audit can distinguish an
accepted duplicate from one nobody was shown. Duplicate records are never auto-deleted — they
are the evidence of the pattern.

**The challan NUMBER is checked as it is typed** (owner, 27 Sep 2026: *"instead of checking for duplicate challan
at the end of entering the entire challan details, check for duplicate challan number when the challan number is
typed for a particular client"*). The moment the number is entered in the challan form (on change, and when the
client is chosen after it), the client's challans are searched for it — case, spaces and leading zeros ignored
(`imChallanNoKey`: `0301` is 301), the challan being edited left out — and a match is said under the field:
*Challan 301 is already recorded for … on 21 Sep 2026 (3 lines, not invoiced)*, with **Open it** reading that
challan in a dialog while the form stays as typed. Warn, never block. **The fingerprint at save stays as the second
net** (the blank number, the aliased part), but a challan the field already showed is not asked about again — seen
means on screen for at least 1.2 s (`CHALLAN_WARN_READ_MS`), since a number typed and Save tapped at once draws the
warning under the tap. The save dialog still asks for a content match on a *different* challan and says which one
was already shown. Saving past the field's warning is an acceptance too: `dupeAck: {at, matchedIds, shownAsTyped: true}`.

### Key Business Data
Rebuilt from owner-supplied cost inputs against Apr–Jul 2026 actuals (~79,850 kg/month).
Supersedes the earlier ₹5.46/kg cost and ~31% operating margin, both of which were stale.

| | ₹/kg | Share of cost |
|---|---|---|
| Labour (contract + permanent) | 3.55 | 42% |
| Zinc (~425 kg/mo at MCX + ₹15) | 2.21 | 26% |
| Chemicals | 1.57 | 18% |
| Power | 0.81 | 10% |
| Consumables, water/ETP, maintenance | 0.42 | 4% |
| **Full cost** | **8.55** | |

- **Blended realisation:** ₹8.45/kg → roughly −₹0.09/kg, about break-even.
- **SSS Mehta:** 39% of revenue but **61% of tonnage** at ₹5.40/kg. −₹1.53L/month at full cost.
  Whether to exit or reprice turns on contract labour: fixed → it still contributes
  ₹0.53/kg; volume-scaling → it loses ₹1.64/kg. Confirm before acting.
- **Capacity:** ~2 t per 8-hour shift; running ~77% of a two-shift month, ~24 t/month spare.
  Filling that at ₹13/kg is worth more than the SSS Mehta question either way.

**The app now corroborates this model from the invoice data, independently.** Once weights are
derived (below), Stats measures blended realisation at **₹8.42/kg against the modelled ₹8.45**,
contribution at **−₹0.13/kg against a modelled −₹0.09**, and SSS Mehta at **62% of tonnage
against the modelled 61%**, on 39% of revenue. Nothing in
that calculation knew the cost model; it is arithmetic over 769 invoices. Two routes to the
same shape is the strongest evidence the model is right that this repo has.

SSS Mehta's own ₹5.39/kg is the one figure that is not independent confirmation — its weights
invert its contract rate, so that number is ₹5.40 restated. Its **tonnage** is real, and that
is what the corroboration above rests on.

### Zinc pricing
metals.dev publishes no MCX base metal — its MCX coverage is precious metals only, and
`zinc` / `lme_zinc` are the same LME figure. LME sits below MCX by basic customs duty plus
freight and local premium: ~10.5% when calibrated (LME ₹355.11 against MCX ~₹392).

So a fetched rate is LME and MCX is **derived** from it by a recalibratable uplift, with the
whole chain shown on the card. A rate typed into Settings is taken as MCX itself and is never
uplifted. Nothing is labelled MCX without saying it was estimated — at ~425 kg/month a 10%
error in zinc is ₹0.22/kg of an ₹8.55 cost.

**The uplift is measured from the shop's own zinc bills** (owner, 25 Sep 2026: *"I just change the LME - MCX
uplift % — if that can be derived using data from the internet then that's even better"*, set at 14%). No free
service publishes MCX zinc (searched: metals.dev, MetalpriceAPI, Metals-API, commodities-API all carry LME
only), but a zinc bill is priced at MCX + the supplier premium, so **price before GST − premium is the MCX the
shop actually paid** — a better figure than a market quote, because it is the one the cost is made of.
Settings → Costing → Zinc rate → **Derive from zinc bills** sets the last six priced bills against LME on
each bill's date (the last rate on or up to four days before, since LME does not trade at weekends), shows every
row's arithmetic, and **offers** the median: it fills the field and marks the section unsaved, never applies it.
LME for a past date comes from `S.zinc.lmeHistory` (every Refresh is kept by day, INR/kg) and, where that is
empty, from metals.dev's `timeseries` with the same key — converted from whatever currency and unit it answers
in, and kept, so asking twice costs no request.

**The market against what each bill paid** (owner, 29 Sep 2026: *"we have the data to show the Zinc rate calculated per
refresh too - that way we can see how much variation we are paying when buying and from which supplier … This can show us
opportunities or risk of buying the particular stock at a particular time"*). Stock → Overview → Price trend, on Zinc
(`zincTrend`, zinc.js; `dashZincHtml`, dash.js). The **market** is every day `S.zinc.lmeHistory` holds, landed as a bill is
priced: LME × (1 + uplift) + premium, **at the uplift and premium set now**, since neither is kept per day (the chart says
so). Each bill is set against the market on its day (the last LME up to four days before, the derivation's rule); **over**
is price − market, per kg before GST, and a supplier's over is **weighted by kilos**, so a 25 kg top-up does not count
like a tonne. **Timing** places the market on the bill's day within the 30 days before it (≥ 5 market days): near the
low, the middle or the high. The panel: range chips, four tiles (market now, last bill, paid over market, the range's
low–high), the market dashed beside each supplier's bills on a **time axis** (`opts.xs`; spaced by count, a bill from
August sat beside one from September) with a frame round the prices (`opts.fit`), the market now against the last bill,
and suppliers as rows (*Lowest* / *Highest* over the market) that open their bills. A bill with no LME for its day is
counted, and **Look up LME** asks metals.dev with the derivation's own lookup (`_zincFetchMissing`, shared), keeping the
answer. Other stock lines keep their plain price line: no market feed exists for chemicals. P99.

### Invoice numbers outlive invoices
A deleted invoice used to vanish outright, leaving a number gap indistinguishable from one
never issued — the exact ambiguity that made inv 00666's correct deletion unreadable, and that
leaves five cancelled-and-filed-at-zero numbers present in GSTR-1 and absent here.

Deletion now writes a tombstone to **`S.voidedNumbers`** carrying the number, a **required**
reason, and what the invoice was. The register's **Number audit** walks the whole serial range
and classifies every number: live / cancelled / voided-with-reason / reissued / **unaccounted**.
A historical gap is explained in place — no invoice is invented to hang the explanation on.

**`reserved` decides the numbering.** An invoice still in `created` or `printed` state never left the
building, so its number returns to the series (the ordinary typo-and-redo flow; a printed sheet not yet sent is paper
in the office, not a document the customer holds). Once
`dispatched`, `delivered` or `filed`, the customer holds a document bearing that number:
it is spent, `invNextNum` may never walk back over it, and the hole in rule 46's consecutive
series is what the ledger exists to explain. Reserved voids export at ₹0 in both CSVs — the
same treatment cancelled invoices already get, and what makes the app agree with the filing.

**A number may be REISSUED before its return is filed** (owner, 25 Sep 2026: *"If GST has not been filed this
should be allowed"*). The practice had been to delete the invoice, set Settings' next number back to it, create
the corrected one and set Next forward again: ten live numbers were made that way, 00862 and 00923 twice. Done by
hand it carried three defects, all closed now:
- **Delete → "Delete and reissue NNNNN"** does it in one step: the old version is voided with its reason (the
  record of what the customer was first sent), and the create form opens with the same lines, challan links and
  number. Offered only while the invoice is not `filed` and not cancelled.
- **Next is never left on a held number.** Reissuing from Settings used to leave Next one past the reissued
  number (851 with 993 issued), so the invoice after it would have duplicated 851. After any new invoice, Next is
  at least the highest issued + 1 (`invHighestIssued`), and a save onto a live invoice's number is refused.
- **Settings' Next may go back only onto a free number that was never in a filed return** (`invReissueCheck`), and
  asks first. A live invoice's number or a filed one is refused.
- **A reissued number exports once, as its live invoice.** Every deleted copy used to export at ₹0 beside it: the
  August GSTR-1 CSV carried 00862 three times. `getVoidedForExport()` now drops voids a live invoice holds and lists
  a number deleted more than once a single time. The number audit still shows the history as *reissued*.

### Quality certificates
The Test Certificate (ZN Plating) is issued **per part per dispatch**, not per invoice — the
customer files it against the part they inspect — so an invoice covering three part numbers is
three certificates. Generated from the register: per invoice from its detail, or in bulk from a
selection.

The format is approved by Tata Motors QA and says so on its own face: *"No alterations are
permissible to the format without written approval of QA - TML."* So `QC_SHOP_DATA` reproduces the
04/02/26 reference **verbatim, typos included** — `Cynide`, `Brightner`, `Ruse`, `Peef off`,
`Importer Coverage`, `final gating`, `Ginca`, `Rodiprind`. Correcting the spelling would invalidate
the approval that makes the document worth issuing. It is a constant and not part of `S` for the
same reason an imported backup must not be able to rewrite it.

Company identity is the one exception: name, address, contacts and GSTIN are read from `S.company`,
so the certificate and the tax invoice can never disagree about who issued them. **Never freeze a
second copy into a document template** — the prototype in `docs/test-certificates/` did, and it had
already drifted: it carried GSTIN `20AAFFS4718J2ZD` where the invoice files under
`20AAPFS4718J2Z0`. The owner confirmed (14 Aug 2026) that `20AAPFS4718J2Z0` is correct and the
certificate copy was a transcription typo. The JSON is corrected; the four certificates rendered
from it on 15 Apr 2026 still carry the wrong number, and any copy that reached SSS Mehta bears it.
That error is distinct from the preserved original-document typos — those are approved format text,
a GSTIN is a fact about the taxpayer.

**The certificate reference is derived, not counted:** `QC/<displayNumber>/<line no>`. Regenerating
a certificate must yield the number it had the first time, and a derived reference cannot gap,
cannot be voided, and needs no ledger of its own — the whole apparatus that `S.voidedNumbers` exists
to provide for invoice numbers is unnecessary here because the number *is* a pointer to the invoice
line it certifies. Nothing is written to state when one is printed.

**A cancelled invoice certifies nothing** and is refused: those goods were never billed, and the
number appears in GSTR-1 at zero. A bulk run states what it skipped rather than quietly printing
fewer pages — a certificate missing from a stack of forty is not noticed until the customer asks.

**Net Wt. is per consignment** — the kilograms of that part in that dispatch, scoped to the line the
certificate covers, not the whole invoice. (Settled with the owner Aug 2026; the approved reference
left it at `0.000` and never said whether it meant per piece or per consignment.) It is filled only
from a weight the invoice was itself **priced on**: a KG line's quantity is already kilograms, and a
`nos_to_weight` line's kilograms are `qty × S.partWeights[part]` — the same arithmetic
`recalcLineItem()` ran to produce the amount.

**A piece-billed line keeps the blank.** The only weight available for it is the Items Master
`stdWeightKg`, defined as `pieceRate ÷ ratePerKg` — exact for tonnage and capacity share, but it is
the rate card read backwards, and the customer being handed the certificate is the one who set that
rate. Quantity and Net Wt. reading alike on a KG line is correct, not a duplicated cell: that is
what being billed by the kilo means, and the form carries both fields because piece-billed parts
make them differ.

The observations (`10-12` thickness, `TRIYELLOW`) are still the reference's constants, not per-batch
measurements.

### The print preview is the page
The preview drew the tax invoice in the phone's column (`--max-w`, 520px) against a layout that needs the page's 186mm:
on a phone the totals, the challan date and the copy label were cut off, and on the desktop the grid ran past the
sheet's border, while the printout itself was right (owner, 29 Sep 2026, Android and the Edge app). The invoice is now
laid out on screen as it is on paper, **210mm across with its gutters as padding** (`--pi-sheet-w`, `--pi-sheet-h`), and
**every document in the preview is zoomed to fit the screen as a whole** (`printFit()`, print.js, on open and on resize;
`zoom` on `.inv-print-body > *`, never above life size), the credit note, certificate and sales register included (they
were A4 already and ran off a phone's edge). In print the zoom is 1 and the sheet's screen width, height and margin are
reset, so the printed page is unchanged. P94.

### A tax invoice that runs past one page
The printed invoice is three copies, each `page-break-after: always`. An invoice with enough line
items runs the middle of that flow past a sheet, and four things were wrong when it did.

🔴 **Margins on the page were tried and WITHDRAWN — `@page` margin stays 0, and the reason is
load-bearing.** The gutters are `padding` on `.inv-print-invoice`, which is applied once to the whole
flow: page one gets a top margin, the last page a bottom one, and **every continuation page begins
hard against the paper edge.** That is a real defect and a named `@page invoice { margin: … }` does
fix it — measured, 12 pages at 10mm against 15 at 45mm on a 120-line invoice, correctly scoped away
from the certificate and the credit note.

**It cost far more than it bought, and the cost only shows in production.** A margin box is the one
place a browser can draw *its own* header and footer, and Chrome omits them when there is no room —
`@page { margin: 0 }` app-wide is what has always bought that silence. Handing it 10mm handed it the
room: invoice **00866** came back from the floor with every sheet stamped `9/1/26, 2:47 PM` and the
document title, **and a trailing blank seventh page** on three two-page copies. Chrome 151, Skia/PDF,
the ordinary Save-as-PDF path.

⭐⭐ **The lesson is about the instrument, again.** `page.pdf()` over CDP never draws browser
headers and never reproduced the blank page across 16–34 line items on Chromium 141 — so the whole
change was measured, tested and merged by a harness that is structurally blind to the defect it
introduced. **The evidence that settled it was not a reproduction at all: the operator had neither
symptom before the change and both after, on an unchanged browser and dialog.** A print bug lives in
the print dialog, and nothing that bypasses the dialog can see it.

**The continuation-page gutter is CLOSED (27 Sep 2026), in flow, with no page margin.** Each copy is one
**frame table** (`.inv-pi-frame`, `_invoiceFrameHtml` in print.js): the whole copy is its one body cell, its
`<thead>` row carries the invoice number and the copy label, and its `<tfoot>` row is empty. Both repeat on
every printed page, and in print the header's top padding and the footer's height ARE the top and bottom
gutters (`--pi-gutter-top` 10mm, `--pi-gutter-bottom` 8mm; the sides stay padding, `--pi-gutter-side` 12mm).
The trap named here before is avoided by construction: the frame spans every page the copy does, so a tail
that lands alone on a page gets the band and the label too. Measured on A4 through `page.pdf()`, the old
build against the new at 2, 22, 23, 30, 40 and 120 lines: **the same page count at every length**
(3 · 3 · 3 · 6 · 6 · 9), a continuation page's first ink at **10mm from the top where it was 0–1mm**, and
its last at 10–11mm from the bottom where it was 3–6mm. The line items' column headings still repeat inside
the frame (the nested `<thead>`). ⚠ **The same instrument caveat as above holds**: `page.pdf()` cannot show
the print dialog, so the owner's first long print from the dialog is the check that counts. What changed is
safe on the axis that burned us: no `@page` margin was added, so the browser still has no room to stamp its
header, and a spec still asserts every `@page` margin is 0.

**A running header must reserve its own room.** The quality declaration was `position: fixed` at the
bottom of every sheet. Fixed takes an element out of flow *without* reserving the band it occupies,
so on a long invoice the line items printed straight through it. It flows at the end now — one
declaration per copy, where the rest of the tail is.

**The letterhead and the tail are each one box.** The head blocks chain `border-top: none` onto each
other to draw a single frame, so a break inside it opens the frame and page two reads as a second,
headless invoice. The tail was four siblings of which two avoided breaking *individually* — which
left the page free to break between the totals and the signature attesting them. Both are wrapped
and kept whole; the inner `avoid`s stay as the fallback for a tail that ever outgrows a page,
because a browser drops an `avoid` it cannot honour.

**A continuation page has to say which invoice it is — once.** The letterhead is on page one only. The
label went first into a caption row in the line items' `<thead>`, the one box every browser repeats — and so
printed twice on page one, under the top-right label (owner, 27 Sep 2026: *"Original for recipient is
mentioned twice in the page"*). The frame's header row replaces both: `Invoice <number>` on the left, the copy
on the right, at the top of every page, page one included. Rows also stop being sliced through the middle.

**The three copies are CGST rule 48's** (`INVOICE_COPIES`): *Original for recipient*, *Duplicate for
transporter*, *Triplicate for supplier*. The third read *Duplicate for transporter* until 27 Sep 2026; the shop
keeps it, so it is the supplier's (owner).

### The invoice's type is its own
The invoice was the last printed document borrowing the app's UI `--fs-*` rem tokens — **24
declarations**, on the instrument that counts a rule's whole body rather than only its first line. The certificate and the credit note have always declared their own point scales, and the
coupling ran both ways and was wrong both ways: the invoice's type could not be set without moving
the whole interface, and the interface could not be scaled without silently resizing a GST document.
`--pi-fs-*` on `.inv-print-invoice` closes it. The mapping was exact — 6.75pt *is* 0.5625rem at a
16px root — so introducing the scale changed nothing, which is what made it safe to do in the same
change as the sizes below. **The test that matters is the independence one:** tripling the root font
size must not move the invoice by a pixel, and it asserts the app itself did move, so it cannot pass
against a stylesheet that has stopped working.

⚠ **Both the count and that test were wrong first time round, in the same way, and the way is the
lesson.** The repointing pass rewrote only declarations sitting on the *same line as their selector*,
so `.inv-pi-copy-label` and `.inv-pi-declaration` — multi-line rules, both printed on the sheet —
kept the app's tokens. The verifying grep had the identical blind spot, so it reported zero
remaining and the count came out at 21. And the independence test **sampled four hand-picked
selectors**, neither of them among them, so it passed against the defect. ⭐⭐ **A claim about a
document needs a sweep over the document**: the test now walks every element under
`.inv-print-invoice` and asserts none of their computed sizes move, and it fails against the
pre-fix stylesheet where the four-selector version passed. *An instrument that cannot see the
failure is not a check, and using the same flawed instrument to verify a fix it made is how one
error becomes two.*

**The reference numbers were 6.75pt monospaced.** Operator feedback named them — invoice number,
challan number, dates — and the pairing is the worst available for digits: small *and* mono, on
exactly the fields a recipient hunts for. They are 9pt semi-bold in the normal face now, as is the
Bill To / Ship To customer name (was 7.5pt). Mono buys column alignment, which a labelled grid does
not need. **The labels were raised too, but only to 7.5pt from 6.75** — at 9pt across the eight-cell
row there is no horizontal slack left and the invoice number broke mid-token (`SEP/2026-` /
`27/00812`), so the labels hold the smaller size. *(An earlier version of this section said "only the
values were raised, not their labels" — the labels did move, by 0.75pt.)*

🔴 **`nowrap` on EVERY value then overflowed the sheet, and the mechanism is worth keeping.** A
table's minimum width is the sum of its cells' minimum widths, and `nowrap` makes a cell's minimum
its whole content. At 9pt the eight-cell row's minimum exceeded the page — and **a table that cannot
shrink does not wrap, it overflows**. Invoice **00866** cited four challan numbers (`834, 835, 838,
836`) and the grid ran clean off the paper: measured **752px of content into 703px of page**, a right
margin of **−0.2mm**, every cell simultaneously at its 4.5pt padding minimum. Eight challans is 805px.

**The split is by what the text IS, not by how long it happens to be.** The challan number and the
P.O. number are lists or free text and carry `.inv-pi-val-wrap`; a break between `834,` and `835,`
reads correctly. **The labels wrap too** — they are English phrases, and "Your Challan. No." over two
lines is ordinary on a form. Only the invoice number and the dates stay atomic, because a date broken
across two lines does not read as a date.

⚠ **Letting the values wrap was NOT enough, and CI is what said so.** It left **6px of headroom under
Inter** — and the runner, which has no webfonts and a different fallback face, measured 729px against
the same 703px page. Same stylesheet, two different rulers. Forced into a deliberately wide face the
pre-fix row wants **786px**: an overflow of 83px that no amount of value-wrapping absorbs, because the
labels were holding the row open. **And the fallback is a real print path, not a test artifact** —
`sw.js` deliberately lets the cross-origin font CSS fail rather than block the install, so an offline
device prints in whatever face it has. With the labels free to wrap the row fits under both faces at
any challan count.

⭐⭐ **A layout assertion measured in whatever font the machine happens to have is not a measurement,
it is a coincidence.** The spec now pins the face itself — it asserts the fit once as shipped and
again under a forced wide stack — so it means the same thing on a laptop, on CI, and on the shop's
Windows box. Each half of the fix is load-bearing and the test catches each alone: 774px with the
labels held, 713px with the values held.

⚠ **The test had to move to a sheet-width viewport to see it at all.** The suite's phone project is
393px wide, where the grid never comes near its limit, so an overflow that only exists at 186mm was
invisible to every check in the file. It sets a 794px viewport and measures the **sum of a row's cell
content widths** against the sheet's printable width — `width: 100%` hides the overflow in the
element box, so the box's own width can never report it. **Cost: one line item per
page** — 23 fitted before, 22 after, measured rather than estimated.

### The sidebar offset reached the paper
`body.inv-desktop { margin-left: 64px }` shifts the interface clear of the desktop sidenav, and the
print block reset it — at identical specificity, 1,300 lines earlier in the sheet. Source order won,
so **every document printed from the desktop layout came out displaced 64px right**: 29mm of left
margin against 12mm of right, and 240px with the sidebar expanded. It reached the certificate and
the credit note too, not just the invoice. One more element selector settles it; `!important` was
not needed.

**And the same rule carries a 300ms `margin-left` transition, so a print taken mid-animation lands
part-shifted** — measured at 64px immediately after switching to print media and 0px after 600ms.
Motion is stopped outright in print rather than raced. Note where that assertion has to live: the
transition is declared on `body.inv-desktop`, so on a phone viewport there is nothing to animate and
the check cannot fail. It sits in the desktop project. A test that cannot fail is not a test.

### Credit notes
SSS Mehta hold a **standing 2% discount on any payment batch spanning 7 days or more** — bought
to smooth cash flow, temporary but in force. Each such batch ships as two documents: the sales
register for the range, and a credit note for 2% of it. So **the batch is the unit of COMPUTATION,
not the invoice**, which is why the 04/08/26 reference credits ₹5,902.12 against ~₹2.95L of taxable.

**But the batch is not what the note is ATTRIBUTED to, and that is the customer's own call.** SSS
Mehta asked for a single invoice number on the face rather than a range, and — this is the part that
settles how far it reaches — **they asked for it against CN/007, a note they already held a printed
copy of.** So the note names **one invoice** and the batch survives in full on the annex, which is
where the s.15(3)(b) linkage limb actually lives: a post-supply discount reduces taxable value only
where it is specifically linked to the relevant invoices, so the annex caption has to keep *claiming*
that linkage rather than merely describing the arithmetic. ✅ **The invoice DATE beside its number
is a CLIENT REQUIREMENT, confirmed by the owner 8 Sep 2026** — SSS Mehta need it, which settles the
question on its own and independently of the statute. It also happens to be what rule 53(1A)(g)
requires, but note the order of the reasoning: **the requirement is the customer's, and the citation
is this repo's unverified reading** (asserted here, never checked with the filing CA). A document
prints the date because the person receiving it needs it. Rule 53(1A)(g) wants the serial number
**and the date** of the corresponding invoice, so both are printed, and both are snapshotted onto the
note — a deleted invoice must not strip a statutory particular off a document somebody holds.

**The pick is a DEFAULT, never an authority, and two real notes prove why.** The app chooses the
largest invoice with enough headroom, net of notes already taken against it. Measured against
`sep-invoicing-backup-2026-09-07.json`: **CN/005's recorded reference `000716` IS that invoice** —
the rule reproduces a real issued document unaided. **CN/004's `000443` is not** — it qualifies
comfortably but ranks fourth of twenty, and BM confirmed (8 Sep 2026) it is the number on the
customer's copy. BM's own convention is looser than the rule: *"use any invoice that has at least
that much amount billed"*. So the reference is **operator-settable from a pick-list over the batch**,
bound by the same headroom test — a document in somebody's hands is a fact, and a rule is not.

⚠ **And the pick is NOT invariant, unlike the certificate reference it was once compared to.**
`QC/<number>/<line>` is structurally derived and cannot move; this reads a **mutable money field**,
and those move — CN/006's stored `batchTaxable` already disagrees with the sum of its own invoices by
₹81.00, and the margin between first and second place on live data is ₹640.58. What makes a reprint
stable is the **stamp** written at creation, not the rule. A cancelled note is never stamped and
never named against: it credits nothing, the same reading that keeps a cancelled *invoice* from being
named and a cancelled *note* from consuming headroom.

Raised from a register selection, which is what makes select-all and the date-range filter part
of the same workflow: tick the batch, export its register, raise the note off the same set.

**The register that goes with it is a DOCUMENT, not just a CSV.** A batch ships as two things and
only one of them was printable: the CSV is a working paper for the accountant, and a spreadsheet is
not what you send a customer alongside a GST document. Register → **Sales Register PDF** prints the
same register through the same print view every other document here uses — no PDF library, because
adding one to render a single table would be a second rendering path for a job the browser already
does.

⚠ **Its scope is SELECTION-FIRST and is stated on its own face.** A credit note is raised from a
ticked batch, and the register filter alone cannot express *"these fourteen"* — so a selection, when
there is one, is what the document covers. **The CSV is filter-only and unchanged**, so the two can
legitimately disagree; the document names its scope in its meta block precisely so nobody has to
guess which one they are holding.

🔴 **A register spanning two customers WARNS before it goes out.** This document exists to be handed
to one customer, and `cnValidateSelection` already refuses a credit-note batch spanning two — but the
register is also an internal filing artifact, so the multi-customer case cannot simply be blocked.
Sending it would disclose one customer's invoices to another. Warn, never block: the banner names
the count and says what to do, and filing it stays available.

Cancelled and voided numbers print at zero on the same rule the CSV uses — the number was issued, so
the series shows it — and are excluded from the total. A selection-scoped register carries no voids,
because a selection cannot tick a number that is gone. One
customer only. A batch under 7 days **warns and does not block** — split batches are the
operator's call.

**The discount is computed on value; the quantity is derived from it.** 1092.98 × 5.40 = 5902.09
against the 5902.12 printed — three paise of disagreement only happen if the rupees came first.

Own series, `CN/<3-digit>/<FY short>`, formatted off `S.invPrefix`. A credit note number is
**issued**, so it may never be reused — but it needs no void ledger, because a credit note is
**cancelled, never deleted**, which is the correct GST treatment anyway. The number stays in the
series carrying its own explanation and exports at zero. Its own CSV, too: credit notes go to
GSTR-1 table 9B (CDNR), whose columns are not the B2B ones.

The reference had four defects the app does not reproduce — see `docs/credit-notes/README.md`.
The headline one is the same identity drift the certificate had: header "SOMA ELECTRO PRODUCT"
against footer "SOMA ELECTRO PRODUCTS". Identity is read from `S.company`, never frozen.

**This changes the SSS Mehta numbers — and ₹5.29 is RIGHT.** At a standing 2%, their realisation
is **~₹5.29/kg, not ₹5.40** — Stats reads invoices only, so every SSS Mehta figure above is
overstated by 2% on the periods the discount covers, until credit notes are netted off.

🔧 **NETTED 29 Aug 2026, and the original figure survives the test.** Measured against
`analysis/sep-invoicing-backup-2026-08-29.json` in the sister repo. **The notes are SEQUENTIAL
PERIOD BATCHES, and each is exactly 2% of its own period** — BM: *"CN/007 is up until 804 challan
for SSS Mehta, not till today."*

| Period | Mehta taxable | × 2% | Note | |
|---|---:|---:|---|---|
| June 2026 | ₹1,87,464.52 | ₹3,749.29 | **CN/004** | ✅ exact |
| July 2026 | ₹2,95,105.83 | ₹5,902.12 | **CN/005** | ✅ exact |
| 3–18 Aug (to inv 00804) | ₹1,90,379.43 | ₹3,807.59 | **CN/007** | ✅ exact |
| | **₹6,72,949.78** | **₹13,459.00** | | ✅ **2.0000%** |

**The scheme is applied in full on every period it covers. Realisation on the scheme period is
₹5.292/kg.** The nine invoices after 00804 are the **next note, pending ≈₹2,182.99** — not a
shortfall. ⚠ **April–May carry NO REBATE NOTE ON THE REGISTER — a null, not a ruling** *(Cipher H-3)*: ~~April–May predate the scheme (CN/004 is its first note)~~. **CN/004 established the SERIAL FORMAT** (`CN/NNN/26-27`), not the scheme's start; BM ruled **CN/002 and CN/003** out as *"credit notes, not rebates"*; **CN/001 has never been ruled on.** **₹9,841.57 (2% of ₹4,92,078.45) turns on this premise** — a BM question, not a derivation.

⚠ **An intermediate pass on 29 Aug published *"₹5.29 is wrong … effective 1.0563% … ₹5.3430/kg"*
— WITHDRAWN. It divided credits from a scheme beginning in June by a book including pre-scheme
April and May: numerator and denominator, different populations.** The rule this repo already
lives by, broken while applying it elsewhere.

🔴 **What DOES survive, and it is a control gap: CN/004 and CN/005 were never entered into the
app.** Instrument: both numbers, their reference invoices `000443` / `000716`, and all four of
their rupee figures, swept as literal strings over the whole backup — **zero hits for all eight.**
**₹11,388.66 gross of issued credit notes sits outside `S.creditNotes`, and therefore outside this
app's own CDNR export.** A netting taken from the array alone sees only CN/007 and reads 0.299%.
**The register that caught it is `soma-internal/operations/credit-notes/README.md` — the app's
array is not the register.**

🔧 **THE FIGURE WAS ₹10,821.75 UNTIL 12 SEPTEMBER 2026 AND IT NEVER FOOTED.** The register that is
the instrument — `soma-internal/operations/credit-notes/README.md:82-83` — states **CN/004 gross
₹4,424.16** and **CN/005 gross ₹6,964.50**, which sum to **₹11,388.66** (taxable ₹9,651.41).
**₹10,821.75 is reachable from no combination of the four published figures**, and it had been carried
unchallenged across three backups and eight surfaces, **one of them this file** — which a fold run
entirely inside `soma-internal` cannot reach. ⭐⭐ *A sister repo is an out-of-tree surface, and unlike
a commit message it is editable, so immutability is no defence.*

**An invoice shows its credit notes** (owner, 29 Sep 2026: *"see quickly if a credit note has been raised against an
invoice and hovering could show the reason why … makes the app tabs more interlinked, which makes it easier to look for
patterns and data errors, so the issue can be flagged early"*). A note touches an invoice two ways, and both are said:
taken **against** it (the one number on the customer's copy) or the invoice is **in its batch** (a rebate's annex)
(`cnLinksForInvoice`, credit-note.js; a cancelled note is left out). A register row, phone and desktop, carries a **CN**
badge (`cnInvoiceMarkHtml`, `data-cn-mark`) whose title reads each note as *CN/007/26-27 · against this invoice · Batch
rebate 2% on 14 invoices, 3 Aug – 18 Aug 2026 · ₹4,493.96* (`cnWhy`: a rebate's batch, else the note's reason); the
invoice detail lists them as rows that open the note (`cnInvoiceDetailHtml`), and the credit note list has an
**Invoice** button to the invoice it is against. To-do rule **`cnMatch`** flags a note against an invoice since
cancelled or deleted (red), and notes against one invoice crediting more taxable than it billed (amber); a note recorded
against a number typed from outside the book names no invoice here and is not judged. P95.

**CN/006 is cancelled**, superseded by CN/007 twenty-six seconds later (`cancelledAt`
1787222938914 against `createdAt` 1787222964835), both naming the same 14 invoices. Cancelled
rather than deleted, exporting at zero — the treatment this app implements, working as designed.

⚠ **The contribution arithmetic in Key Business Data is still not restated** at ₹5.292/kg.
⚠ **And the ₹/kg is arithmetic, not evidence**: Mehta is piece-billed, its derived weights invert
its own contract rate, so realisation equals that rate by construction. **The tonnage is real; the
₹/kg is not independent.**

### The floor, by area
Staff tab → **Areas**. The same attendance store read by place instead of by person, because two
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
and here is what the record shows"*.

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

### Client performance
Clients tab → **Performance**. One account at a time: month on month as revenue, tonnage or ₹/kg,
and every part it handles sorted into **stopped / new / steady / one-off**.

Stopped is the reason the view exists. A part that disappears raises no error, empties no queue and
never appears as a loss — it appears as a slightly smaller month, twice, and then it is normal.

**Cadence is measured against each part's own rhythm, not a fixed cut-off.** A part is overdue when
the gap since its last appearance exceeds `max(typicalGap × 1.75, typicalGap + 21 days)`, where
`typicalGap` is the median of its own intervals. A fixed "absent two months" rule would call every
quarterly part dead; the 21-day floor stops a part shipping twice a week being flagged after nine.

**Both spines feed it.** Invoices are the complete record, but material arrives before it is billed,
so a part received last week and not yet invoiced would read as overdue on the billing record alone.
The union answers "when did we last handle this part" — and a part that only ever arrived shows
*challan only* rather than ₹0.00, which would read as worthless work rather than unbilled work.

**A rename is flagged, not reported as lost business.** Part numbers vary in spelling between
documents (`Clamp 165x83` against `CLAMP 165X83(40X6)`), which would surface one stopped part and
one new one. Stopped/new pairs sharing a six-character stem are marked as possibly the same part —
reporting a rename as lost work would discredit every other row on the card.

**A part is its size or number, and its gauge** (`cpPartIdentity`; owner, 30 Sep 2026: *"some items like 149x83 are still coming but
the flag is being raised"*). The same clamp was written `CLAMP 149X83(40X6)` to July and `149X83` (the gauge in the description) from
August, and keyed on the whole text the older spelling read as stopped. A part naming a size (`149X83`, `150X80X3`) is that size, a part
with no digits of its own (`CLAMP`) takes the size from its description, anything else is its number; the gauge (two digits × one) is
never a size. Stats' top items read the same identity. A row naming no gauge that stopped while the same size still comes in a stated
gauge reads steady (*no gauge written*); a stated gauge that stopped beside a live one stays stopped and says which still comes
(`cpSiblings`). On the real book to 11 Sep, SSS Mehta's stopped parts went from 73 to 66 and 149X83 reads steady.

**Materials worked** (owner: *"every material worked, how much and when … how many clamps were sent by SSS Mehta in any given period, how
many by Dorabji. If two parties share the same material code, the distinction must be mentioned"*). Performance → *Materials worked*: a
period (this month, 3 or 6 months, the FY, all, or dates), a search over part, size and description (*clamp*), and **This client / All
clients**. Each part is one client's: pieces and kilograms sent (a kilo challan's counted pieces included), challans, invoices, what was
billed, first and last; it opens to every challan and invoice by date, each a link. A code another client also sends says so (*Code
shared · BETA AUTO also sends it: counted apart*), here and on Stats' top items (`cpCodeOwners`). P118.

**By the hour** (owner: *"Samarth part is done in pieces, 3302 - 9/pc takes about 30 mins … 24 pcs at a time in VAT A2. 3303 - 3/pc …
80 pcs at a time … there can be a different realisation and cost that is calculated on per hour basis"*, then *"have an option to update
the time taken to pickle and plate + a constant 15 mins (logistics + other steps) for every material … fill these out with the production
data … make sure the app learns from the data that is being entered, so we can evaluate if the time taken is increasing or decreasing, and
what steps we can take to optimise setups"*). Performance → *By the hour*:
- **A round is pickling + plating + the constant** for logistics and the other steps (`S.perfCfg.overheadMin`, 15, set on the panel). Each
  figure is the owner's where set on the client (`client.partTimes`: pieces, `pickleMin`, `plateMin`, the line; Samarth's two set once,
  plating 30, `_partTimes1`), else **what the production record measures** (`cpMeasure`, `cpMeasured`): the register's round-to-round
  gaps on the line (5–180 min; across noon on a 12-hour clock), a START–END batch's span over its rounds, the pieces a round from the
  rounds' own figures, and pickling as the gap from a load to the pickling hand's next load that day (5–120 min) a piece × the round's
  pieces. Every figure says *set*, *measured* or *not known*.
- **What an hour earns** is a round's pieces × the rate (a kilo rate through the part's kg a piece) over the round's whole time, against
  what an hour **costs** the plant and **earns** it on average (the last 90 days at the live cost, over working days × 3 lines × 16 h,
  `cpLineHourRef`, the assumption said on the card). The period's pieces billed become the hours of rounds they took.
- **It learns as entries come in**: the measure is read afresh from the record every time; parts the record has timed and nobody has
  set are listed too (*from the record*). A part opens to its record, a chart of the median round by pay week, and **what to look at**
  (`cpRoundHints`): a round 10%+ slower (or faster) in the last 30 days than the 60 before, racks run short of their fullest, the fixed
  steps a quarter or more of a round, pickling slower than plating, and a set plating time the record no longer bears out (15%+ off on
  5+ rounds), with **Use** to take the measure. A changed time keeps what it was (`history`).
On the real book to 11 Sep (before Production existed, so no round is timed yet): an hour costs the plant about ₹489 and earns ₹466.

### What the charts show
The trend was one line drawn with `preserveAspectRatio="none"` — a 400×160 drawing smeared across
whatever width it got, markers rendered as ellipses, and only the two endpoints labelled. `charts.js`
draws at natural aspect and is sized by CSS, so one code path serves a 393px phone and a 1280px
desktop, and every datum carries a `<title>` with its exact figure.

**Three series, because they answer different questions.** Revenue answers "did we bill more";
tonnage answers "did we plate more"; **incoming material leads both** — it is dated by challan, not
by invoice, so a dip there surfaces in revenue only weeks later. Line or bar for any of them.

**Composition gets a share shape** as well as a ranked one. Past the eighth client the tail folds
into one named wedge rather than slivers nobody can aim at — the fold is labelled so the tail is
visibly a tail.

**Top Items ranks by value, tonnage or ₹/kg, and those are three different top-tens.** Ranking by
money alone is the ranking this repo's own thesis calls insufficient: the parts filling the plant
are not the parts paying for it. The weight rankings admit only parts whose weight is known and
**say how many they dropped** — those are the piece-billed end, so a ranking that hides them reads
better than the truth.

On the ₹/kg view the bar is measured against full cost with a mark at the cost line, because from a
zero baseline a 5.40–14.50 range is a row of near-identical bars. Green clears cost, red does not:
the app's accent is itself a terracotta, so accent-against-danger was a distinction nobody could see.

### What Stats measures
Revenue alone cannot tell a good month from a loss-making one here: the same ₹1L of billing
is healthy at 8 tonnes and ruinous at 20. So every headline figure is carried next to the
tonnage that produced it, and **realisation (₹/kg) is the primary number**, not a derived one.

Tonnage comes from KG lines directly, and from NOS lines by three routes in order:
`partWeights`, the Items Master `stdWeightKg`, and — for a **piece-billed** client — the line's
own `amount ÷ ratePerKg`. That last route matters more than it sounds: 127 of SSSMehta's lines
name parts with no Items Master row at all, 17% of that client's revenue, and routing weight
through the registry left every one uncounted. Their part numbers also vary in spelling between
invoices (`Clamp 165x83` against `CLAMP 165X83(40X6)`), so registry matching would stay fragile
even if the rows existed. Reading the line direct sidesteps both.

**Realisation divides revenue by tonnage over the same lines.** Dividing *total* revenue by
*weighed-only* tonnage inflates the answer by exactly `1 / coverage` — it read ₹21.23/kg on
live data where the matched figure was ₹13.00. Numerator and denominator must always be the
same subset, blended and per client alike.

**Coverage is stated in revenue terms, not line count.** One unweighed line worth ₹10L matters
more than fifty worth ₹500. And the exclusion is never neutral: unweighed lines are the
piece-billed work, which is the low-realisation end, so a partial figure always reads *better*
than the real blend. The card says so in place rather than letting it pass as complete.

**A client under 90% coverage is listed but not ranked** — shown as `n/a` with its coverage,
under a banner naming the revenue that cannot be priced. A ₹/kg drawn from 2% of a book is not
the same kind of number as one drawn from all of it, and sorting them together asserts that
it is. Concentration withholds tonnage share for such a client for the sharper version of the
same trap: an account with no weights barely enters the measured denominator and reads as a
*small* user of the plant when it is plausibly the largest. "Unknown, not small."

**Realisation by client is ranked worst-priced first.** That ordering is the point: the
largest account and the worst-priced one can be the same row, which is exactly the SSS Mehta
shape (39% of revenue, 61% of tonnage, ₹5.40/kg against ₹8.55 cost). Periods are measured on
the **invoice date**, not on when the record was typed — that is the date on the document and
the date GSTR-1 reports it under.

### History is the audit trail
It was missing the two event kinds an audit goes looking for. A deleted invoice writes a
tombstone to `S.voidedNumbers` with a required reason, and an accepted duplicate challan
stamps `dupeAck` — neither appeared in the log. Both are now first-class events, and a void
renders as non-tappable because the invoice it names no longer exists to open.

**The floor is in it too, and that puts TWO CLOCKS in one list.** An invoice event is dated by
**when it was recorded** — every one carries a real `createdAt`. An attendance day has no such
stamp: the store is keyed by the date it describes and nothing writes down when somebody typed
it. So a floor row is dated by **the day it is about**, which is the date on the sheet and the
same convention Stats already uses for periods. That is a different question from "when did this
get entered", so **every floor row says `floor day` in place** and the CSV carries a `Dated by`
column. Unlabelled, the two read as one timeline and nothing on screen would say otherwise.

The exception ledger is the one staff event with a genuine record-time, so it keeps it and reads
`recorded` — and it is dated the day somebody explained the disagreement, not the day the
disagreement happened.

**A client filter excludes the floor.** A client filter is a question about one account; the shop's
Tuesday is not about an account, and listing it under one asserts a connection that does not exist.

Booked extra is **one row per entry, not a day total** — a reader who wants to know what was booked
needs the where. A block row states which of its three inputs is missing (`no crew recorded`,
`no times recorded`) rather than leaving them to open the Areas card to find out why it never
reconciles. **Roster changes are absent on purpose**: staff rows carry no timestamp, so dating them
would mean inventing one.

### Keyboard entry
Challan entry is fully keyboard-operable. The suggestion lists (part autocomplete, client
search) take arrow keys and Enter, and a lone match commits without arrowing first. The form
re-renders by replacing `innerHTML`, so **every control carries a `data-k` key and focus is
captured and restored across the re-render** — that focus drop, not the dropdowns, was what
really ended the keyboard path mid-entry. `Alt+N` adds a line, `Ctrl+Enter` saves, and buttons
marked `data-kbd-ring` join the Enter-to-next-field chain (a line's remove `×` deliberately
does not).

### Items Master
Part number registry with weights, gauge, descriptions, and merge capability.

**A missing part is created from the line being typed.** The autocomplete's last row offers to add
what was typed, prefilled, and drops the new part straight back into the line — the round trip to
the Items tab lost the in-progress form, which is why parts went unregistered. It is offered even
when there are matches, because a new gauge of an existing clamp matches the part number and is
still a different part.

That row is present on almost every list, which is what made the keyboard contract the thing to
protect: one real suggestion plus the add row is two options, and `acPendingOption()` would have
stopped committing a lone match on Enter. It filters the add row out of that shortcut. An unaimed
Enter therefore still means "on to the quantity" — creating a part takes a click or an arrow.

**Weights derive themselves at bootstrap.** Where a client bills per piece off a rate per kg,
`weight = pieceRate ÷ ratePerKg` recovers it exactly, and `init.js` runs that once via
`applyDerivedWeights()`. It fills only empty weights, is idempotent, and never touches billing:
rates resolve through `getLineItemRate()` against the client ladder, `stdWeightKg` is read by
Stats and Items Master alone, and the `nos_to_weight` path reads `S.partWeights`, which this
does not write. The `_deriveWeights1` flag is only set once there *was* something to derive
from, so a device that loads empty and imports a backup later still gets its pass. The Items
Master button remains for items added after that pass and shares the same function.

Leaving this behind a button nobody had pressed is what made the dashboard quietly wrong: 90
of 168 rows had no weight, almost entirely the piece-billed parts, so tonnage covered 61% of
revenue and the one account the figures existed to examine was the one they could not see.
The pass fills 72 of the 90 and takes coverage to 94%; the 18 it leaves are KG-billed, whose
quantity is already kilograms.

Note what such a weight is: defined as `pieceRate ÷ ratePerKg` it prices back at exactly that
rate. The weight itself is exact — the rate card was built as weight × rate — and the tonnage
it yields is real. What it cannot do is *independently* re-establish the ₹/kg, because that
was the input. For a piece-billed client, realisation always equals the contract rate; that is
arithmetic, not a finding. The value of these weights is **tonnage and capacity share**.

**Gauge is part of a part's identity.** Four clamp families exist in two gauges at different
rates — `CLAMP 165X83 (NT)` at 35X6 and 40X6, plus `105X83 (NT)`, `133X83 (NT)` and
`124X77 (UT)` — so two rows can share a part number and be different weights. Two consequences:
the printed line description folds the gauge in via `partLineDesc()` on **both** the invoice and
challan paths (the challan path used to drop it, and since IM is the billing spine that omission
flowed into every invoice raised off the challan); and weight derivation **skips** any part
number held by more than one gauge rather than averaging them into a figure right for neither.
Skipping costs no tonnage — the line-level route above still weighs those lines correctly.

### Client Master
22 clients with rate lookup, billing mode assignment, and contact info. Billing modes in live
data: 20 `weight`, 1 `piece` (SSS Mehta), 1 `nos_to_weight`.

### The rate on record
**Replayed 24 Sep 2026** over `soma-internal/analysis/sep-invoicing-backup-2026-09-11.json` (931
invoices, 2,835 lines) before any matcher threshold was set. The finding was that the reference
was wrong far more often than the billing: **zero** decimal errors in the whole history, and most
of what a matcher would have flagged was reference data.

- **The Items Master is not a rate card.** One `rate` per part, no client, no date. It disagreed
  with 185 of SSS Mehta's lines, mostly because the customer's rate moved and the master did not
  (`150X88X3`: 1.67 on every line since April, master 1.64), and in three rows because ₹5.40 — the
  ₹/kg figure — had been typed into the per-piece field.
- **So a piece rate is the CLIENT's: `client.pieceRates`, dated, keyed on part AND gauge.**
  `getPieceRate()` in `state.js`. Part keys ignore case and punctuation (`rateKey`); the gauge is
  read from the line's description by `lineGauge()` — two digits × one digit, standing alone, so
  `L.C.Pad 150x80x3` (a part size) never reads as one. A part priced by gauge on a line that does
  not say which gauge returns `{ambiguous: true}`: reported, never guessed.
- ⚠ **Deliberately NOT `itemRates`.** An override is a negotiated per-piece figure with no weight
  basis, and Stats and weight derivation refuse to invert one. Putting SSS Mehta's card there would
  wipe 61% of the plant's tonnage off the dashboard.
- **`getRateOnRecord(client, date, item)` is the one place the matcher reads**: override →
  `pieceRates` for a NOS line → the ₹/kg ladder. It returns the **unit** with the figure, and a NOS
  line with no piece rate gets **no** reference rather than the ladder — comparing ₹1.10/pc against
  ₹10/kg is the unit error the master rows made. *(NEXT_SESSION had the order as ladder → itemRates →
  items master; the code has always been itemRates → ladder, and never read the master.)*
- **The card is filled from what was billed** — Client → Edit → Piece Rates → *Fill from billing
  history* — building one dated entry per rate change. Two things are left out and **listed**: a
  rate seen on **one** invoice where another is established on two or more (the shape of 00922 /
  00923, where Samarth material was misattributed and two brackets swapped rates for a day — the
  owner confirmed, 24 Sep 2026), and a rate that **returns** after changing, which is two products
  under one name (gauge-less `CLAMP 165X83 (NT)` lines swing 4.27 / 4.89 / 4.27). On the real
  backup, after filling both cards, **2,729 lines match exactly and 18 priced lines differ**.
- **Prefill uses it too** (`defaultLineRate`). A NOS line used to be handed the ₹/kg figure — 5.40
  against a ₹1.49 pad — and a Samarth part with no weight priced itself at 0 kg × ₹14.50 = ₹0.
- **T-HC is fixed.** The scanner priced every KG line off rates frozen into `_scanClientMap`, so a
  rate change or an override never reached a scanned challan. It now reads the client's records;
  the frozen figure is only a fallback for a client the app does not hold. A piece client's
  challan keeps its own amount — that is the passthrough.

**The matcher: option E, chosen by the owner 24 Sep 2026** (`rateMatch()` in `state.js`, one
renderer `rateMatchNote()` in `create.js`). Five candidate rules were replayed over the 18 differing
lines and rendered side by side before any was built:

| Verdict | Rule |
|---|---|
| **Matches** | equal to the paisa |
| **×10 slip** | a power of ten away, within 2% — checked before any threshold |
| **Check** | **≥ 10% off, or ≥ ₹100 at stake on the line** (difference × quantity in the reference's unit — a `nos_to_weight` line stakes kilograms) |
| **Differs** | anything less, with its difference shown |
| *No rate on record* / *Gauge not stated* | grey, never red — nothing to compare against |

The percentage catches a wrong rate whatever the quantity; the rupee floor catches the small slip on
a big line (00684: 8.3% low, ₹119.60 short across 920 pieces), which the percentage alone let
through. The owner's first-written flat ₹0.50 left 10 of the 18 lines with **no mark at all** — the
yellow/red gap NEXT_SESSION warned of. On the real backup the rule gives **10 Check, 8 Differs**.
**Warn, never block**, like the duplicate-challan guard: a rate can differ and be right. It shows on
the invoice form and the challan form as the rate is typed (and when the invoice date moves — the
rate on record is dated), and on the invoice detail only where a line needs a second look; a ₹0
line is judged by its own required reason instead. The two thresholds live in **Settings → Checks & alerts
→ Rate & weight check** (`S.rateCheck`, read by `rateCheckCfg()`), so a config object `ensureStateShape()` fills
key by key on an old backup. A blank or zero value falls back to the ruling's 10% / ₹100 rather than
to 0, which would turn every difference red.

**The kilograms are checked too, for a client billed by the kilo whose challans count pieces**
(owner, 24 Sep 2026: *"for Dorabji and other clients whose rate per kg is done but weight/pc is
known, do the same mismatch update"*). Dorabji's challan carries a Qty (pieces) column and a Wt.
column, so a weight per piece on record checks the kilograms the way the rate card checks the rate:
`weightMatch()` compares a KG line's `qty` against `nosQty × kg/pc`.

- **The weight is the CLIENT's (`client.pieceWeights`), never the Items Master's.** The master has
  one row per part name and no client: Khetan's `BASE PLATE` weighs ~0.70 kg a piece on every line
  and the master says 0.053, because General Engineering sends a part of the same name; Pawan's
  `SPACER MOUNTING` runs at 0.16× its master row. Same lookup as the piece rates (`cardLookup`:
  part key, gauge, date).
- **Filled from billing history by the MEDIAN** of kg ÷ pieces, only where the part was weighed on
  two or more invoices. A part where over a quarter of its lines (and at least two) sit 10%+ from the
  middle is **two products under one name** — HighCo's `FLANGE NUT` at exactly 0.032 or 0.064 kg,
  Khurana's `WASHER` at 0.021 or 0.042 — and is listed, never averaged. A ×10 line is a slip, not a
  second size, and does not count against the part.
- **Same verdicts and the same Check thresholds as the rate, with a scale's tolerance.** Measured
  over the 1,068 KG lines carrying a piece count: the median line is 0.4% off its own client's
  median, three quarters within 2.3%. So a weight within **±3% matches** (Settings → Checks & alerts
  → Rate & weight check), a power of ten is allowed ±5%, and the stake is the kilograms off × the line's rate. On
  the backup, after filling every client's card: **793 match, 2 ×10, 28 Check, 88 Differs**, 157
  with no weight on record.
- **The two ×10 slips were PIECE COUNTS, not weights — ruled by the owner, 24 Sep 2026.** **00830**
  (Dorabji `CLAMP 5079 4920 4205`): 33 pieces that were **330**; the 150.274 kg billed was right.
  **00086** (`2525 2015 8202`): 500 pieces that were **50**; the 10.4 kg was right. No money moved.
  Both were put right on the invoice and **stayed wrong on the challan** — which is the next
  section.

**An invoice correction reaches its challan.** IM is the billing spine, and a correction made on
the invoice used to stop there: an invoiced challan line cannot be edited, the invoice form had no
piece count at all, and an invoice line did not record which challan line it came from. The owner:
*"back corrections don't happen in the IM — it should, these could have been avoided."*

- **An invoice line carries `imItemId`.** A line saved before that is linked when the invoice is
  opened for editing (`withChallanLinks`): same invoice, same part, same quantities, each challan
  line claimed once. A line that matches two challan lines is **left unlinked, never guessed**.
- **Saving an edited invoice writes back the fields CHANGED IN THAT EDIT** (`backCorrectChallans`)
  — of part, description, unit, quantity, pieces, rate, amount — never every field where invoice and
  challan already disagree: an older invoice routinely differs from its challan for reasons nobody
  decided that day (the gauge folded into the description, a rate recomputed from the amount), and
  an untouched save must not rewrite the challan. It **keeps what they were** on the challan line as
  `corrections: [{at, invoiceId, invoice, from, to}]`. The challan is the record of the customer's
  paper; overwriting it without trace would lose what an audit asks. History lists each one:
  *"Challan 1115 corrected from SEP/…/00830: CLAMP 5079 4920 4205 — pieces 33 → 330"*.
- **A correction on a NEW invoice reaches the challan too** (owner, 30 Sep 2026: *"correction on the invoice should be reflected
  in the challan with a note"*). A challan line brought into the form remembers what it said (`imLineOrig`, `_fromNew`), and on
  save a field typed over it travels back like an edit's. The quantity is the exception: typing less than the challan is
  dispatching part of it, so it travels only when the operator said *Challan quantity was wrong*. The challan line shows each
  correction as a note (*Corrected · from SEP/…/00012: rate 13 → 13.2*, `challanCorrectionText`, History's wording), and the save
  says which challan was corrected.
- **KG lines on the invoice form have a Pcs field** — it prices nothing, but it is what the weight
  is checked against, and it was the field both slips were in.
- ⚠ **Every save confirmation had been invisible.** `switchTab()` clears toasts, and `saveInvoice()`
  raised *"Invoice updated"* / *"Invoice … saved"* just before switching — so neither ever reached the
  screen. They are raised after the switch now; found because the challan note vanished the same way.

**A line names its PART on screen** (`lineLabel`). The invoice detail and the challan list printed
`desc` alone, and for a piece client `desc` is often only the gauge (`40X6`) or a word (`CLAMP`) —
the owner searched a challan and could not see which part was on it. The part number leads; the
description follows when it adds something. The printed invoice is unchanged. **Register search
reaches challan numbers**, matching a whole number (leading zeros ignored), never a fragment:
`83` must not find challan 834.

### A challan line filled from the record
Owner, 26 Sep 2026: *"When I select C-Clamp 66x42(30x6) as we know all its value and std weight and rate, fill that
out automatically so that me or anyone can click through it to verify and change if needed; if the change for the
final amount is more than the conditions we have for matches which raises a red flag then ask for a reason."*

- **Choosing a part fills the line from the client's record** (`lineFillFromRecord`, state.js): the rate on record
  (`defaultLineRate` — a piece client's card for a NOS line, else the ₹/kg ladder) and the **kg per piece** (the
  client's own `pieceWeights` card, else the Items Master `stdWeightKg`, and the note says which).
- **Counting fills the rest** (`lineFillFromCount`): on a piece line, pieces × rate → the amount (the amount stays
  editable — the customer's challan figure is the passthrough); on a weight line, pieces × kg/pc → the kilograms.
  **Never over a typed figure:** a filled field is marked in `item._auto` until somebody types in it, and a typed one
  is the operator's for good. A note under the line says what came from the record, so tabbing through it is a check.
  Switching a piece client's line to NOS re-prices it from the card rather than zeroing it.
- **A red flag needs a reason.** A line on the matcher's own **Check** or **×10** verdict — rate (`rateMatch`) or
  weight (`weightMatch`), the Settings thresholds — cannot be saved until a reason is picked under it, one tap:
  *Customer's challan says so · Rate changed · Weight differs this batch · Other*, with a note (recommended). The ₹0
  line's contract, for the same reason: an audit must tell a figure somebody examined from one nobody was shown.
  **Differs** asks nothing. Saved as `flagReason`, `flagNote` and `flagAt {kind, status, ref, value}` — the verdict it
  was given against — and dropped when a later edit puts the line right (`lineFlagFields`).

### A challan invoiced in parts
Owner, 26 Sep 2026: *"Samarth Engg sends 600 nos of an item, I should be able to invoice that challan multiple times
till 600 is reached, so maybe we dispatch 200 in one day, then 300 and then 100."* A challan line was all-or-nothing.

- **What a line has billed is DERIVED, never typed** (`im.js`): the sum of `qty` over invoice lines naming it
  (`imItemId`) on invoices not cancelled — a deleted invoice frees its share by being gone. `imBilledIndex()` builds
  that index; `imSyncBilled()` caches it on the line as `billedQty`, `billedNos`, `invoiceIds`, `invoiceId` (the
  latest) and `invoiced` (nothing left, within `IM_QTY_EPS`), after every invoice save, edit, cancel, delete and
  reissue and in `migrateState()` (it replaced the orphan repair). So `!it.invoiced` still means *open*, everywhere.
- **Every unbilled amount is the open share** (`imLineOpen`: amount × left ÷ qty; pieces from `billedNos`, else in
  proportion): Home, Stats, the To-do's unbilled rule, the month's pace, the IM selection. A challan with a line
  part-billed reads **Part invoiced**; any share billed locks its edit and delete (`imLineBilled`).
- **The Create picker and IM's Create invoice bring a line at what is LEFT** (`imLineFormItem`) and say so:
  *600 on challan 301 · 200 invoiced (SEP/…/00012) · 400 left*. Typing 200 is dispatching 200 (a piece client's
  amount follows as that share of the challan's amount; a KG line's untyped pieces follow the kilograms).
- **More than is left asks for a reason** (owner, 27 Sep 2026: *"For both the limits, ask for a reason"*): the line
  says *30 over what is left on challan 301*, and under it a one-tap picker — *Customer dispatched more than the
  challan · Challan quantity was wrong · Other*, a note recommended — the red flag's and the ₹0 line's contract. The
  invoice cannot be saved until one is picked (the error names the line), and the line keeps
  `overBillAck: {at, left, reason, note}`; it goes when an edit brings the line back within what is left. The
  confirm-era stamp `{at, left}` still loads and reads *accepted, no reason recorded* on the invoice, and is asked
  for a reason only if the invoice is edited while still over.
- **A unit changed on a linked line asks for a reason too, and closes the challan line.** A line billed in KG
  against a NOS challan line (or the reverse) cannot be compared: it says *Cannot be compared with challan 301: it
  holds 600 NOS … this line closes the challan line*, and asks *Customer bills this part by weight / by pieces now ·
  Challan unit was wrong · Other*; `unitChangeAck: {at, from, to, reason, note}`, required to save, dropped when the
  unit is put back. **Such a line bills its challan line WHOLE** (`imRefWhole` in `imRefsBilled`): 52.5 kg cannot be
  netted against 400 pieces, and leaving the line open would show phantom unbilled material on Home, Stats and the
  To-do for ever. The unit travels back to the challan only as a correction the operator named (*Challan unit was
  wrong*, on a whole line); any other reason leaves the challan's unit and quantity as the customer's paper says.
  P78.
- **Editing counts the invoice's own share as left.** Back-correction never writes quantity, pieces or amount to a
  challan line that is PART of one — billed by another invoice too, or not at the challan's quantity when the edit
  began (`CHALLAN_SHARE_FIELDS`); part, description, unit and rate still travel. A whole, single-invoice line
  corrects exactly as before.
- **History is not reopened.** A line flagged invoiced by an existing invoice that names no challan line stays
  billed whole (`billedLegacy`), until that invoice is linked, deleted or cancelled; a looser legacy link on a
  different quantity is saved `imWhole` and counts as the whole line. P77.

### Billed at ₹0
The history held **25 lines billed at ₹0 — 1,192.54 kg, ₹16,355.67 at the client's own rate —
across 14 invoices**, mostly General Engineering, with nothing on any of them saying why. **The
owner ruled (24 Sep 2026) they are replating**: returned work is not billed twice.

A ₹0 line with a quantity now **cannot be saved without a reason** — *Replating / Sample / trial /
Other*, a tap each. The note is **recommended, never required**: a one-tap picker gets filled in, a
mandatory essay gets "ok". The history is stamped `replating` **and** `zeroReasonBackfilled`, so the
register can tell a reason the ruling supplied from one an operator chose. The migration is bounded
to invoices dated on or before the ruling — a ₹0 line written later by a device on an older build
reads *No reason recorded* rather than the migration inventing one forever.

### Production
More → **Production** (sidebar Floor → Production; owner, 28 Sep 2026: *"This will give us a clearer picture of what's
actually happening in the plant daily"*). What each line (VAT A1, VAT A2, barrel) plated each day, pickling as a stage
before it, and **material in the plant two ways** — by the book and by the floor. `prodparse.js` reads the messages
(pure), `production.js` holds the store and everything derived from it, `prodview.js` draws the page, `vision.js`
reads a photo. **Owned by `soma-internal`, like stock** (owner): a view and an input; Entries → Export writes
`sep-production` v1 whole, Import merges by id and never overwrites.

- **Three voices, three doors.** The pickling hand's loads (*"SSS MEHTA / CLAMP133×83(35×6)-774 nos / PICKLING TIME
  9:00AM"*, incoming material under its own head) and the supervisor's barrel list and a roll's `----production----`
  block come through **Paste message** — Production's own, or the one box on Home and Staff, which sends them here and
  keeps a roll's attendance exactly as it was (P90 compares the saved day with and without a block). The register
  clerk's **VAT register photos** are read by Gemini. **Enter by hand** is the fallback. Every message is shown beside
  what was read before anything is saved (Stock's contract); the same message is refused, unless every entry it made was
  voided.
- **The record is events** (`S.production.entries`: arrived / pickled / plated / downtime), stored sparse. A figure is
  corrected by a new entry that names the old one (`replaces`), never edited; a wrong one is voided with a reason.
- **One figure per line and shift.** Per (day, line, general | overtime) the register counts, else the supervisor's
  relay, else an entry by hand; the others are shown **also reported**, never added — they count the same work a
  different way. On a day with the supervisor's whole-day barrel list, the roll's barrel OT blocks are *also reported*
  beside it (the owner could not say which the list covers: recorded as unknown).
- **A pickling message never names the line.** A load's line is read from the plating it became (the same part, the
  same day from half an hour before, or the next working day before noon), shown and **never stored**; a load with no
  plating offers the part's **usual line** (5+ days at 80%+, learnt only from lines written or set, so the pattern
  cannot feed itself) as a chip the owner taps. A load naming only the kind and gauge (*"CLAMP(40×6)"*, over half the
  loads since August) is matched at the family level; **a named part only ever matches its own challans** (CLAMP 90X81
  was once set against CLAMP 165X83's).
- **The register** (Gemini, a schema, the image shrunk to 2,000 px, no client list sent): a transcription, never a
  reading — times, rack arithmetic, the START rule (a START takes the next round's figure, the owner's rule of 26 Jun),
  the day's total, are this app's, in code. **A struck row is asked each time** (owner): red until counted or cancelled.
  A rack size never seen for the part on that line is amber. **Only facts are kept** — hash, size, model and prompt
  version, the date and line read, the row count — never the image; the read is kept on the device until saved, so
  reopening the photo costs no second request.
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
- **Linked in.** Stats → Overview gets *Plated (floor)*, only on **complete days** (attendance recorded and every
  staffed line with a general-shift record), never a zero. Lines shows labour ₹/kg by line: variable labour of the
  line's areas over the same days as its kilograms, the VAT side's pickling hands shared by each day's kg. Two To-do
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
  - **VAT A2 writes START and END, and the END carries the batch** ("98×8+1", "3×156", "50+52+30"). The first build
    counted START as a round of the next figure, the rule for A1's round-by-round pages, and **doubled every A2 run**
    (1,930 for a page that says 1,145). The rule now applies only to a page with no END row.
  - **Figures are written as sums and products** and are added up in code (`prodRegisterQty`), never by Gemini.
    "3+4×156" is racks counted in two goes: read as 7 × 156 = 1,092 (**confirmed by the owner, 28 Sep 2026**), with the plain-arithmetic 627 said beside it as info, no longer a warning.
  - **The register keeps a power log** ("Power cut - 10:26 AM / Power in - 10:36 AM", a date on every row): read as
    power cuts. A cut the pickling hand also reported is counted once (`prodDowntimeDay`): cuts from different sources
    that overlap or begin within ten minutes are joined; two cuts in one log are two, however close.
  - Smaller shapes: "VAT-2" names VAT A2; "12:45 AM" between 11:30 and 1:05 is noon (said); a day name is checked against
    the date; a ditto-only last row is not a row; an END with no START starts where the batch before ended.
  - **A photo that is not a register page is refused**: the weekly hours sheet ("other"), and a customer's challan, which
    is offered to the challan scanner with the same file.
  **Instrument, and its limit:** the 20 pages were transcribed by hand into the shape the prompt asks Gemini for (scratch,
  never committed) and every page's runs and cuts match what the page means, 20 of 20. That scores the code after the
  read; **Gemini's own transcription is not scored**: there is no key in the build sandbox. The owner's first real read
  is that check.
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
  refusals in the shape Google sent (P85).
- **The register's own shorthand, from the owner's pages of 23–29 Sep 2026** (P122):
  - **A clamp's gauge from its round** (owner: *"Mehta's clamp gauge is 25x6 or 30x6 if 150 pieces are done on VAT A1 and 100 pieces on
    VAT A2 and 35x6 or 35x8 or 40x6 if 120 pieces and 72 pieces are done in VAT A1"*). The register writes Mehta's clamps as CLAMP; a
    rule (`S.production.gaugeRules`: client, the part's first word, rack sizes, gauges; Mehta's two set once, `_prodGaugeRules1`) reads a
    round of 150 or 100 as 25X6 or 30X6 and of 120 or 72 as 35X6, 35X8 or 40X6 (`prodGaugeRuleFor`). The lines named are kept on the
    rule, not required: the pages show 150 and 120 on A2 as well. One gauge is written in; two or three are kept as the entry's
    `gaugeOptions`, set against the family's challans at any of them. A round of a size no rule names (108, 98, 82) is its own run,
    *gauge unknown*, so it never takes a neighbouring run's gauge.
  - **A floor name is matched to the client's part** (`prodLearnAliases`): a code in brackets (*TINA(0160)*, *TINA(3303)*) that ends
    exactly one of the client's part numbers is that part, and the name alone is learnt for the client (`learn.parts`, now written), on
    a register save and on an import. A code ending two parts (*KUDAL(0106)*) is asked: Entries → **Which part?** lists the parts
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
    client does (`prodCarryCheck`).
  - **Who plated it** (owner: *"place workers on the specified production … we'll know who plated what and when, this can be useful
    later when we get replating issues"*): `prodCrew(e)`, read off the day's attendance and never stored: a general-shift run is the
    hands marked on its line, a run from 5 PM or before 8:30 the named crew of the OT block covering it, a pickling load the pickling
    hands; a day with no attendance says so. Entries show it under each run, and Clients → Performance → Materials worked lists each
    plating of a part with its line, time and crew beside its challans and invoices.
- **The workers' names box on a register photo goes to Google with the page** (Settings → Connections → Photo reading
  says so); only what is read is kept.

### Power
More → **Power** (sidebar Floor → Power; `power.js`; owner, 30 Sep 2026: *"Make a power cut tab, we have built a business
case for power cut and how to resolve it, find it, read it and update it"*). Four views: **Overview · Cuts · Load & bills ·
Case**. The case was written once, on 30 May over 56 days (soma-internal `archives/2026-W21-W22-session/13-…`); this page
keeps it current, and `soma-internal/reports/power-cut-case-2026-09-30.md` is the dated refresh.

- **The cuts are Production's** downtime entries (the register's power log, the relayed messages, a cut entered by hand)
  and the history imported from soma-internal's power-cut log. The same cut reported twice is one (`prodDowntimeDay`); a
  power-back earlier on the clock than the cut ran overnight. Enter a cut opens Production's hand form on a power cut.
- **What a cut costs is its damage, not its price** (Iuno's audit of the 30 Sep refresh, H-1; owner, 30 Sep 2026: *"also
  take into assumption OT that we had to do following the power cut due to the backlog of material it creates"*). The work a
  cut stops is either made up in overtime or never made. Made up, the cut cost that overtime; never made, it cost the
  output's contribution and the wages that bought nothing. A restart (₹600 in a working window, the 30 May estimate) is paid
  either way (**an estimate, not measured**, and said beside the total). So damage = restart + catch-up overtime + (1 − share made up) × (contribution + platers' idle wages).
  - **Catch-up overtime** (`powerRecovery`): a cut in working hours puts its own day and the next working day at risk. Each
    such day's overtime (`powerDayOt`: monthly and daily hands' OT at their overtime rate, an hourly hand's hours past eight,
    and the EXTRA on OT blocks; the general shift's EXTRA covers a missing hand, not carried-over work, and is left out) is
    set against the median of the clean recorded days **in the same month**, at least four. What is above it is shared
    among the cuts by their dark working minutes, after taking off the idle wages already counted for a cut past the shift.
    **The Governors' re-audit bounded it** (N-1, N-2):
    - **Each cut's share is capped at the hand-hours it stood idle**: a 13-minute cut had been billed 30.
    - **A night hold is a shift and never counts** (`powerIsNightBlock`: from 8 PM, or on past midnight into the morning;
      owner, *"night hold is night shift"*).
    - **Nor does the EXTRA of the block a cut fell in.**
    - **The baseline is the cut's own month.** The record held different overtime from month to month: block EXTRA was 21 h
      in May and 573 in August, and the monthly crew's OT was recorded only from September. A ±30-day baseline measured
      that change.

    It is still **an upper reading**: a day running late for an urgent order reads the same. The share made up is those
    hand-hours over the platers the cut stood idle (everyone present where no plater is recorded).
  - **Contribution**, not revenue: realisation less the variable cost (everything but the monthly crew) over the last 90
    days, read at the live cost and at the typed full cost less the same crew; **the lower share is used** (`powerMargin`).
    On the real book the live cost read ₹4.65/kg with chemicals recorded at ₹0.16/kg, which would have made a lost hour
    worth 56% of its price; the typed cost gives 6%. Revenue at stake (minutes in a working window × revenue per scheduled
    hour) is shown as the upper bound and never added; so is the fixed charge, paid whether the power is on or not.
  - **Idle wages are a range** (Iuno H-5): platers (VAT A1, VAT A2, barrel) up to everyone present, since pickling runs
    through a cut. A hand is placed **where they stood at the time**: an OT or night block's named crew on the block's line
    (a pickling hand in a VAT evening block idles as a plater), the general shift on the mark's area. Before this an
    evening block's crew read ₹0.
  - **A cut with no time back is costed at the median length of those with one**, never to the end of the day; a power-back
    the log gives only as a bound (`downtime.atLeast`, "after 7:16 PM") ends at the later of the bound and the median, and
    stays out of the median. A close the record inferred (`downtime.inferred`) and a single-phase fault (`downtime.phase:
    'single'`, counted as dark) are said on the row and in the case.
  - **The options' gain is the year's damage × the share each covers + TSUISL's tariff saving − running and upkeep**, the
    running hours being the dark working hours; the inverter's coverage is measured on the dark working minutes it would have
    carried (Iuno M-3; on every dark minute the overnight cut pulled it to 84%).
- **A day with no record is a gap, not a day without cuts.** A recorded day is a working day with attendance or a plated
  entry; a cut alone does not record its day (April's handwritten log has no floor record around it and read 1.38 cuts a
  day). A run of recorded days with no cut, long enough that at the record's rate three or more were expected, is read as
  **possibly unreported** (`powerQuietRuns`): named in the case, left out of the year ahead, of each month's rate (a month
  with under five days left reads a dash) and of the best and worst months. The rate counts only the cuts on recorded days
  (Iuno H-3: April's cuts on days with no record had been divided by recorded days, which made 11–15 May look quiet), and a
  cut on a Sunday worked ends a run. "Possibly unreported" is a fact about the app's record, not about what was sent: a
  stretch no export has been read for yet reads the same.
- **The load is recorded** (owner: *"Yes, record it"*): `S.power.load` {sanctioned, approved, approvedOn, ref, note}, set
  once to 25 / 50 kVA approved 18 May 2026 where empty (`_powerLoad1`). A bill's own details are set on Load & bills
  (`POWER_BILL_FIELDS`: billed at, peak, kWh, kVAh, fixed, energy, excess-CD penalty, fuel adjustment, duty, net), and a
  bill's "billed at" wins over the typed load. To-do rule **`powerLoad`** asks while the approved load is not on the bill,
  with the penalty on the bills since approval.
- **The case is a document drawn from the data every time it is shown or printed** (owner: *"The case report should
  always be printable, and it should be dynamic - updates data as soon as the data feeding it is updated"*;
  `powerCaseHtml`). Case shows it on the page; Print the case sends the same document to the print view, and a save in
  this or another window redraws both. Ten sections: in short, the record by month with its recorded days, when cuts come
  (noon – 2 PM), what a cut costs with the ten costliest, a year at this rate, the connection, the options (TSUISL,
  inverter, generator: one-time, coverage, running, gain, payback; the inverter's coverage measured off the cuts at its
  hours), the recommendation, open items (set in Options' figures) and what is not counted. The options' figures are the
  30 May case's estimates until a quote replaces them.
- **Import history** takes one file: its cuts as `sep-production` (merged by id into Production) and under `power` the
  bills' details by month and the load. A detail fills only an empty field; a bill the file records is added where the app
  has none for that month, **at what was paid** (`paid`, else `amount`), with the bill's net payable kept as a detail and the
  basis in its note (Iuno H-6: which of the bill's figures is "the" bill is still BM's question); a month described without
  an amount is counted, never invented.

### Stock
More → **Stock**. Chemical stock, **owned by `soma-internal`** (owner, 24 Sep 2026): this tab is a view
and an input, never the ledger. Everything it captures is copied there at each compile and stays here.

**The record is events, not levels** — `S.stock.entries`: `count` / `received` / `used` / `charged`,
each with the day it is about, when it was typed (`at`), who sent it (`sentBy`), who typed it (`by`), and
for a pasted line the text it came from (`raw`, plus the whole message in `S.stock.pastes`). The level is
**replayed** (`stockReplay`): a count sets it, a delivery adds, a use or charge takes away. A table of
levels could not have caught what the first real message carried — *nitric acid, `add 60+10=70 … use 30
… available 70`*: the supervisor's own working says 40.

**The owner pastes the supervisor's WhatsApp message** (`parseStockMessage`, pure, no `S`). Numbered
lines, wrapped lines, the shop's spellings (`SOLLT`, `ZINK`, `CYNEDE`, `BRIGHTNER` — `stockKey`), and
three arithmetic shapes: `opening − used = left`, `add received + opening = total − used = left`, and
`rate × days = used`. Tested on the 22 and 24 Sep messages: all 30 lines read, before any screen existed.
**Before anything is saved, every line is shown with the text it came from and what was read:**

- 🔴 **Needs you** — the message contradicts itself. Pick *the working*, *the figure written*, or save
  it **unsettled** (the default: the app never picks for you). Warn, never block.
- 🟠 **Check** — an assumption or a disagreement with the app: an opening that differs from the app's
  level, a count **up** with no delivery recorded (65 R, 24 Sep: 6 → 15 L), a line with **no name** read
  by its **position** in the last message (24 Sep line 14, `70-10=60`), a delivery with no date on a
  window over two days, a number it could not place.
- A new name becomes a new line; a known name, or one the operator mapped once, is remembered.
- A nameless line's picker offers the saved lines **and the lines the same message is adding** — on a
  device's first message nothing is saved yet, and the picker was empty (owner, 24 Sep 2026, line 14).
  **And it takes a typed name**: 24 Sep's line 14 is the only nitric line and carries no name, so
  nitric is named nowhere in that message and no menu could offer it. The name is kept as typed and
  redrawn only on Enter — redrawing on blur replaced the Save button under the tap that caused the blur.
- The same message twice is refused — every figure would count double.

**Days left = level ÷ daily use**, the use over the last three weeks of record divided by the days it
covers — Sundays out, the shop's own divisor (16–22 Sep is `6 day`). Under three days of record the
figure carries a `?`. Red at 3 days or fewer, amber at 7 (Settings → Checks & alerts → Stock alerts). **A line charged into a
bath (zinc) is never red at an empty shelf**: the delivery going into the bath is the normal state.

**By hand**: Count / Received / Used / Charged against one list; Received takes a price per unit,
supplier and bill. A wrong entry is **voided, never deleted** — the export is the record's source, and a
vanished entry would leave `soma-internal` holding a figure the app no longer explains.

**Export is always whole** (`sep-stock` JSON: lines, entries, messages, build) and import **merges by
id, never overwrites** — `soma-internal` de-duplicates on the ids at each compile.

**Prices, bills and the live cost** (owner, 25 Sep 2026: *"There is no place to enter a stock's price? When
entering received stock - also ask for the company, invoice number and date of invoice ... The calculation
of live cost should be broken down so that every cost is visible and measurable and pattern is recorded of
the stock (price, usage, cadence, etc.)"*). `cost.js`.

- **A delivery is recorded with its bill.** Received by hand needs the company and the invoice number (its
  date defaults to the day received), with a labelled ₹-per-unit column (before GST). A delivery that
  arrived by paste has no bill; **Add its bill** on the entry completes it. A past purchase is a **`bill`
  entry**, which records what was paid **without moving the level**: the goods are already in a count or a
  delivery, and adding them again would count them twice. A line with no price says so.
- **Each line shows its pattern**, read from those records: the last price and its change, the range, each
  supplier's bills, quantity and spend, how often it is bought (median gap, with a delivery and its own bill
  counted once), when the next one is due, use per day and over 30 days, and cost per day and per month at
  the last price. Two bills on one day: the larger sets the price, so a local top-up at a higher rate does
  not stand in for the drum.
- **Stats → Live cost** replaces the chemicals card. It lists every component with its ₹ and ₹/kg and tags
  its **source**:
  - *measured*: from this app's records;
  - *part-recorded*: unpriced lines used, or a stock record that starts partway through the period (it
    says how many days it covers);
  - *market rate*: zinc charged with no bill yet;
  - *model*: a Settings fallback, used only where nothing is recorded.
  Opening a line shows its parts: labour by tier; chemicals line by line as quantity × price, with unpriced
  lines named; each power or other bill with its share of the month. **What was bought in the period is
  shown for reference and never used as the figure**, because a purchase is stock on the shelf, not use.
  Modelled zinc is priced at the last price paid by the end of the period, then today's market rate, then
  the cost model's ₹2.21/kg.
- 🔴 **An unrecorded stretch is FILLED at the model, never read as zero.** Each row is measured where the
  record exists and filled pro rata where it does not: labour's unrecorded working days, the days before
  the stock record starts, a month with no power or other bill. The fill is its own line in the breakdown
  ("Not recorded: …"), and only the measured part counts toward *measured*. The first cut read the gaps as
  nothing, and on real data the quarter's live cost came out at **₹2.92/kg, "93% measured"**: one July
  power bill stood in for three months of power, and three days of stock use stood in for the quarter. That
  flattered every client's margin by ₹4+/kg, SSS Mehta included (+₹2.42 against −₹1.97 once filled).
  **A figure that reads cheapest where least is known is the error this card exists to prevent.**
- **Power and other bills** (`S.costBills`: kind, the month the bill covers, amount, units, note) are entered
  on the card and voided with a reason, never deleted. A bill counts in proportion to the share of its
  month's days that fall in the period. Fallbacks (power ₹0.81/kg, other ₹0.42/kg, zinc 425 kg/month) are
  in Settings → Costing → Live cost fallbacks (`S.costModel`).
- **Past purchases come from `soma-internal`** through Stock → Import: a `sep-stock` file of `bill` entries
  (and `costBills`), merged by id. The file is built from the private records and never committed here.

**The phone bar is six tabs**: Home, Create, IM, Register, Clients, **More** (To-do, Finance, Production, Power, Stock,
Staff, Stats, History). More lights up while one of those is open and carries a red count of **every red row**
— stock out or under its red line, and your own tasks overdue. The test fixture's `switchTab` opens
More when the target is behind it.

### Stats in tabs, and the overview
Stats is five tabs over one period chip row (owner, 25 Sep 2026: *"break up the stats page into multiple
grouped tabs"*): **Overview** (the headline four, *In one line*, six months), **Clients** (contribution by
client, revenue, realisation, concentration), **Cost** (labour, live cost), **Billing** (GST, invoice
states, unbilled, dispatch) and **Trends** (the trend chart, top items). The open tab is remembered on
the device. `renderStats()` still draws every card; `take()` files each into its tab.

- **The Overview opens on the owner's questions, each a story** (owner, 30 Sep 2026: *"Stats view needs an overhaul, it puts insights front
  and center and doesn't present itself in a really engaging way"*; they chose question-led story cards, `statsStoriesHtml`, intel.js):
  *Are we making money?* (realisation and what a kilo leaves, six months against the cost), *Who is driving it?* (the four largest
  clients by tonnage, the worst-priced large account, the biggest mover against the period before), *Is the plant full?* (capacity and
  tonnes by month), *What changed?* (the month's pace and the three most urgent insights) and, with a statement, *Is cash coming in?*.
  Each says what it means in one sentence with its tone (`data-story-say`) and links to its tab (`invStatsGo`). They read the figures the
  panels under them read; the headline, *In one line*, the pace and six months follow, and **the whole insight list closes the page**. P120.
- **Every "below cost" on Stats is judged against the period's live cost**, not the typed ₹8.55, so the
  headline and the Overview cannot disagree. The typed figure is used only where there is no tonnage to
  divide by (and still by Items Master's break-even).
- **In one line**: realisation, live cost, contribution per kg and on the period, and capacity against
  ~2 t per shift × two shifts × working days. Whatever is not measured is named under it.
- **Six months**: each month at its own live cost, with labour ₹/kg shown only where 90% of the days are
  recorded and the share of cost measured.
- **Credit notes are netted across all of Stats** (owner, 30 Sep 2026): each note's credit is spread over the invoices it names in
  proportion to their taxable (`statsInvoices`, `cnCreditByInvoice`), and the headline, realisation, clients, six months, the trend,
  the insights and Clients → Performance read those net invoices; tonnage is untouched. A note naming no invoice in the book is
  counted apart and said on the Overview. **Home's month to date is net of them too** (owner, 30 Sep 2026: *"yes, it should and
  it should be mentioned"*): the Revenue tile reads *taxable, net of ₹200.00 in credit notes*, and its comparison with the same
  days last month is net on both sides. The tile will link to the notes once the hover previews are built.
- **The trend keeps its own reach** (the last 12 months, 26 weeks or 90 days) whatever the period chip, and shades the chosen
  period on it (`opts.span`), saying so under the chart (owner, 30 Sep 2026).
- **Contribution by client** (Clients tab), worst first: net realisation (credit notes whose batch ends in
  the period are taken off), against the variable cost (everything but the monthly crew) and the full cost,
  and the ₹ on the period. The worst account with 10%+ of the tonnage is settled both ways: if labour is
  fixed, if it scales, the break-even prices, and its share of the plant. **Cost is spread per kg**, which
  the table says: a thin clamp and a heavy bracket cost the same per kg there. On the real book for the
  quarter to 25 Sep: live cost ₹7.31/kg (40% measured) against ₹7.96 realised; SSS Mehta at ₹5.34 net is
  −₹0.87/kg even with labour fixed.

### Insights and predictions
Parts three and four of the intelligence engine (owner, 25 Sep 2026). `insights.js`.

- **An insight is a To-do rule.** It has the same shape as an app task (tone, figures, what to do, what
  clears it, a snooze against its figures), so it reaches the To-do list, the Home card and the Windows
  widget with nothing new, and **Stats → Overview → Insights** lists them all. Each can be switched off in
  Settings → Checks & alerts → To-do. There are eight:
  - **a client gone quiet** — judged against its own rhythm: overdue once its gap passes both 1.75× its
    median gap and median + 21 days, with 5+ challans and ₹20k+ in three months. Red at 10%+ of the book;
  - **the month realising below every one of the six before** (after 5 working days), naming whose share
    moved;
  - **a client's billing down three full months running** (₹30k+ at the start, 25%+ fall);
  - **a client realising 5%+ under its own median ₹/kg** (₹0 lines, a changed rate, or the mix);
  - **a large account (10%+ of tonnage) below its variable cost** last month, at the live cost;
  - **measured labour 20%+ from the model**, only where 90% of days are recorded;
  - **last pay week with no attendance**;
  - **stock lines used in 30 days with no price**.
- **Predictions**, each saying what it rests on:
  - **This month at its pace** (Overview): revenue and tonnage per working day so far × the month's
    working days, a band from how much those days varied, and unbilled challans in hand.
  - **Next challan expected** (Clients): each client's median gap after its last challan; late past it,
    quiet past the rule above.
  - **Invoice PO and vehicle.** On choosing a client for a new invoice, an empty PO field takes the next
    number **only where the client's POs run in sequence**. Where they rise but skip (a customer numbering
    across all its suppliers: Dorabji `DA1/01322 → 01333 → 01339`), only the prefix is filled and the hint
    says so. An empty vehicle field is filled **only where one vehicle carries 60%+** of the client's last
    30; otherwise the usual ones are offered as chips and nothing is typed.
  - **A client's own vehicle and PO win over the prediction** (owner, 27 Sep 2026: *"Dorabji Auto generally is
    despatched through only one way of transport … the field is already filled out along with PO number, which is
    usually the same as their challan number with the suffix DA1/xxxxx"*). Measured on the book: one vehicle on
    nearly every Dorabji invoice, and the PO equal to `DA1/` + the challan number in five digits on nearly every one
    carrying a PO — a PO *made from the challan*, which is why the sequence prediction only ever found the prefix.
    So it is a **client setting**, never a hard-code: `defaultTransport` and `poFromChallan`, a pattern where
    `{challan}` is the challan number and `{challan:5}` the same padded to five digits (`clientPoFromChallan`,
    state.js: the first cited challan, its first run of digits, so `0877/26-27` gives `DA1/00877`). Edited on the
    client (*On every new invoice*, with a live example; a pattern without `{challan}` is refused). Every path to a
    new invoice applies them (`createApplyClientDefaults`: choosing the client, ticking a challan, IM → Create
    invoice, a reissue, a client preselected from Stats), **only into a field that is empty or was itself filled
    that way** (`invoiceForm._auto`): a typed value is the operator's for good. An auto PO follows the challans
    ticked (the first one's number, and the hint says *the first of N challans*), and a challan number typed by hand
    moves it in place. The hint says where it came from (*from DORABJI AUTO's settings*). Where a client has one,
    insights.js does not predict that field. A once-only migration (`_clientDocDefaults1`, travelling with the
    state) sets both on DORABJI AUTO **only where both are empty**, so a value the owner typed or cleared stays.
  - **The P.O. date follows the challan date** (owner, 27 Sep 2026: *"we have to enter the PO date, which is
    redundant as almost always it's the same as challan date - that field should be prefilled as it's not
    printed on the invoice"*). Picked by hand, filled from the challans ticked, or IM → Create invoice, the
    challan date carries the P.O. date with it (`createSyncPoDate`, create.js) until a different one is typed
    (`invoiceForm._pdTyped`); clearing it, or typing the challan date, hands it back. An invoice opened for
    editing keeps a P.O. date that differs from its challan date. The field says which (*Follows the challan
    date · not printed on the invoice*). P81.

### Finance
Sidebar **Money → Finance**; More → **Finance** on the phone (`finance.js`; owner, 26 Sep 2026: *"The entire finance
sector of our app needs a dashboard"* — a page of its own, leading with cash, what is owed, where money went and GST).
Bank and Bills & notes lived under Stock, where they never belonged; they are tabs here: **Overview · Receivables ·
Payments · Bank · Bills & notes · GST**. The open tab is remembered on the device (`sep_inv_fin_tab`).

- **Overview**, whole rupees at a glance (every tab behind it keeps the paise, and a figure's title carries them):
  - tiles: the **bank balance** with the day it is from — amber once the statement is over a week old, red when
    overdrawn — **owed to us**, **paid out** in the last month on the statement, and **GST** for last month;
  - **cash by month**: in, out, and the balance each month closed at, with the balance line drawn only when every
    month closed in credit (the line chart has no negative axis);
  - **owed to us** by age (0–30 · 31–60 · 61–90 · over 90 days, from the invoice date) and the five largest
    debtors, each opening Receivables with its client expanded; receipts with no client are said, not counted;
  - **where money went**: one month's outflow by category, SELF draws as *Wages (cash)*, beside what was invoiced
    and received that month;
  - **GST due and paid**, the last six months.
- **The Overview is interactive** (spec Phase 3; owner: *"more like financial dashboard with interactive pie
  charts, line charts, trends chart"*). One range chip row (`3M · 6M · FY · All`, kept per device as
  `sep_inv_fin_range`) drives every panel. **Cash**: balance, in and out on one axis, with the balance line
  crossing a zero rule when overdrawn; a tap on a month moves *where money went* to it. **Where money went**: the
  range stacked by category, and the chosen month as a pie — a slice lists that category's payments with exact
  figures and opens the statement filtered to it; a category keeps one colour in both. **Where money came from**:
  receipts by client, with unplaced receipts a named slice that opens them. **Invoiced against received**: two lines
  (a month the statement does not cover shows no received figure, not zero). **GST**: due against paid, grouped,
  above the table; the month's status is itself the button that opens its note. Every chart takes a tap and writes
  the exact figure into its readout line.
- **GST due** is the output tax on the month's invoices (active, by invoice date) less the tax on its credit notes
  (not cancelled, by note date). **Paid** is the GST the statement sent the month after, since a return is paid by the
  20th of the next month. Cash paid is output tax *less input credit*, so paying less than is due is the normal
  shape; the tab says so and never calls the gap a shortfall. The GST tab reads twelve months.
- With no statement the Overview says what reads from it and still shows GST due, which reads from the invoices.
- The To-do's missing electricity bill opens Finance → Bills & notes on the month (`todoGo` kind `bills`).
- **Cheques are placed, and tagged by their series** (owner, 26 Sep 2026: *"make sure we have a field to enter the
  client so that what the client owes starts coming down to the actual figure. Also tag cheque numbers to clients —
  their series will help in automation"*). The Overview's *"N receipts not placed"* is a link to them, and the
  Receivables tab carries the count. A deposit's instrument is in the narration (`BY INST 525428`, `bankInstrument`).
  **Placing a deposit is its tag** — no second store: `bankChequeSeries()` reads each client's numbers off its
  placements and lists them on the client (*Cheques: …*). A new deposit is **offered** to a client when exactly one
  client holds a number from the same book (same length, all but the last three digits alike) within 50 of it; when
  the series and the exact-sum match agree they are one offer (*Series and amount agree*), when they disagree both
  are shown and nothing is placed (`bankPlacementOffers`). Each offer is a line of its own with its button at the
  row's end — inside the one-line meta it was clipped by the ellipsis on a phone and could not be tapped. A placed
  receipt is moved or unplaced with *Change* on the client's list; *No client* is a decision, stored as
  `clientId: null`, not a fallback to the guess.
- **A month's GST paid outside the bank** (owner: *"For July, make sure that reason is mentioned or has a place where
  we can mention it"*). Finance → GST → *Add note* on any month the bank shows no payment for: what happened
  (required), and optionally the amount paid another way, the date and the route (`S.bank.gstNotes[YYYY-MM]`,
  exported in `sep-bank`). An amount counts as paid and reads **Outside bank** (info, never ok — the app cannot see
  it); a note alone reads **Noted**. The tile follows. Nothing is seeded: July's note is the owner's to write.

### Bills & notes
More → Finance → **Bills & notes** (`bills.js`, moved from Stock 26 Sep 2026; owner, 26 Sep 2026: *"We don't have a place to enter electricity
bills anywhere in the app. And even credit notes"*). The bill form existed, labelled *Power*, at the foot of
Stats → Cost → Live cost; nobody found it. Credit notes could only be raised from a Register selection as a
batch rebate.

- **Electricity** (the `power` kind is labelled *Electricity* everywhere now). Every closed month with invoices
  and no electricity bill is listed with an **Add** that opens the form on that month (`billsMissingPower()`). The
  same form serves the Stats card (`costBillFormHtml`, `_costBillOpen = {where, month}`).
  To-do rule **`power`**: from the 10th, last month without a bill; amber from the 20th, `sig` the month.
- **A second electricity bill in a month is arrears and a penalty** (owner, 30 Sep 2026: it *"only happens when a bit or all of
  a couple months ago was not paid in time, so it might include a penalty"*). A bill records the **arrears** in it (and the month
  they are for) and the **penalty or extra charge** in it, both parts of its amount. The arrears were that month's cost on its
  own bill, so a bill's cost is its amount less its arrears (`costBillCost`); the penalty stays in and is named on the bill and
  in Live cost. A second bill with no arrears entered asks first, never refuses. The owner mentioned paying about ₹5,000 a month
  since the load went to 50 while the bill still reads 25: that charge can be entered as the penalty or extra charge.
- **Credit notes, two doors.** *Record an issued note* takes a note that already exists on paper, with its **own
  number** (refused if the series holds it) and **the GST as printed**: recomputing is not the same thing, and
  CN/004's 3,749.29 at 9% + 9% rounds each half to 337.44 = ₹4,424.17 where the customer holds ₹4,424.16. The
  fields start at the computed figure. `recorded: true`; `cnNextNum` moves past it **only within its own financial
  year's series** (`cnSeriesHighest()`, read off each note's display number): a note recorded from 25-26 holds no
  number in 26-27's, and a typed invoice takes the client master's address. *New note* issues the next
  number against **one invoice** for a reason from a **fixed list** (`CN_REASONS`: rate correction, goods returned,
  short quantity, discount, other); **Other needs a description**. The batch rebate is not offered there: it is
  raised off a Register selection, as before.
- **`kind`: `rebate` | `adjustment`** (absent = rebate, every note before this). An adjustment or a recorded note
  prints no batch annex (a Register batch note keeps it, a one-invoice batch included, so a reprint matches the
  customer's copy), reads as its reason in the Register's list, and offers no *Reference* re-pick — *Clear* would
  erase the number printed on a recorded note. An adjustment is not a rebate to the To-do's batch rule (`cnIsRebate`). Stats nets both by `periodTo` (the invoice
  date for an adjustment). A note with no quantity prints blank qty and rate cells; the CDNR CSV leaves a blank
  `discountPct` / `batchTaxable` blank.
- **This is the door for the control gap above**: CN/004 and CN/005 can now be entered as issued, not re-raised.
- **A stock line's name and unit are edited on its page.** A rename keeps the old spelling as an alias, so a
  message in the old name still finds the line; a unit change on a line with entries asks first and converts
  nothing.

### Bank
More → Finance → **Receivables**, **Payments** and **Bank** (`bank.js`, moved from Stock 26 Sep 2026; owner, 26 Sep 2026: *"We have the bank statement as well right? There is no way
to read it in the app yet"* — all three of receipts, payments and the ledger, reading the bank's `.xls` as it is).

- **The file is read as the bank exports it.** Bank of Baroda's `OpTransactionHistoryUX5.xls` is real Excel 97–2003
  (BIFF8 in an OLE compound file), not HTML under another name, so `xls.js` reads it with no library. Checked
  cell for cell against `xlrd` on the real statement: **7,018 cells, 0 different.** Columns are found by their
  labels; the bank writes newest first and `dayIdx` keeps its order inside a day (soma-internal's 20-Aug ingest
  sorted by date alone and published a closing balance ₹1,20,000 wrong).
- **Rows merge by id** — a hash of the row's own fields, balance included — so an overlapping statement adds only
  what is new. **Every balance is checked against the row before it**; a break (rows missing between two
  statements) is reported with its date and the figure expected.
- **A category is worked out from the narration every time it is read**, then overridden: for a payee
  (`S.bank.parties`, keyed on the name) or for one row (`row.set`). **Every SELF / TO SELF / TO CASH draw is wages**
  (owner, 26 Sep 2026: *"All kind of Self should also count towards wages, unless stated otherwise"*); a draw has
  no payee, so a draw set otherwise is set on its row. A salary transfer is matched to the roster by the relay's
  own name matcher (either side of a dash, a unique first name, the spelling folds); a folded match reads `?`, and
  a payee that reads like a firm (`TRADERS`, `LTD`, `NIGAM` …) is never a person. On the real statement: 42 of
  the salary legs matched, 6 before the relay matcher was used.
- **Receipts against invoices, from the later of the statement's first day and the book's first invoice**
  (`bankRecvFrom`). Per client: invoices − credit notes − receipts, plus what was owed on that day if set (a client
  reading *paid ahead* is almost always April money for March invoices, and the card says so). The statement used
  to set the start alone, and it reached back to January while the invoices start in April (owner, 28 Sep 2026:
  *"we are checking against clients from January while we only have invoice data from April, that is creating a
  mismatch"*): three months of receipts for invoices the app never held paid April's invoices early. A receipt
  before the start is not read, and an unplaced one does not count toward *not placed: reads high* (the list says
  how many it left out). **An opening is stored with its day** (`opening[id].date`); one set against another day
  (an older build's, against the statement's first) is not counted and the client asks for the new one (P82).
  **A receipt never pays an invoice raised after it** (owner, 28 Sep 2026: *"most of April payment is actually of
  March job work"*): oldest-first used to reach past the receipt's own day, so SSS Mehta's ₹2.99L of 13 Apr, three
  days into the book, paid invoices raised to the end of April and days to pay read short. What a receipt cannot
  place is **on account** (`onAccount`); it is carried forward to settle what is still open, oldest first
  (`credits`), so the open list and its ageing still add up to what is owed, and the invoice detail says
  *Settled from money on account* rather than naming a receipt dated before the invoice.
  **What each client owed at the start is offered** (`bankOpeningSuggest`, never applied until **Use**): the
  receipts that reached the bank before the client's first invoice in the book was 20 days old, since the fastest
  payer settles 15–20 days after the invoice and the rest monthly. A receipt before the client's first invoice
  counts whenever it came; one after it only for a client already billing when the book began (first invoice within
  45 days of the start), since a new client's first payment pays its first invoice. Measured on the real book, 20
  days is the one window that takes every such receipt (SSS Mehta ₹2,98,770 on 13 Apr, Dorabji 18 Apr, HighCo 29 Apr,
  RG before its first invoice) and none that paid April (SSS Mehta's 5 May, day 20): 30 days took that one too, and
  the leftover-money floor only half of Dorabji's. It is a floor: money owed then and never paid is in no receipt,
  so the row says to check it against the ledger. A used figure is stored `suggested: true`. A receipt equal **to the rupee** to one open invoice or a run of them is
  *Exact*; any other is set oldest first and says so. soma-internal's tolerant sweep hit every credit and proved
  nothing, so nothing looser is ever called a match.
- **A cheque deposit names nobody** (21 of the real statement's credits). Where its amount equals a run of one
  client's open invoices — and only one client's — that client is **offered**; placing it is a tap. Placed on
  the row, never remembered as a payee, because `BY INST` is not a name.
- **Payments.** An electricity payment defaults to the month before it and becomes that month's bill on a tap
  (`bankId` on the bill); Bills & notes offers it on the missing month too. Transfers to a hand are set against
  the **payroll as paid** for the month before, per worker — the check that would have shown the crossed Behra
  legs of 14 Sep. Cash draws are set against the weekly payout by pay week. Suppliers are totalled beside the
  stock bills recorded from them.
- **Export Excel is a clean workbook** (owner, 26 Sep 2026: *"BANK Statement export should be a clean sorted excel
  file"*): `xlsx.js` writes a real `.xlsx` with no library — the parts zipped *stored*, so there is no deflate to
  carry. **Statement** is oldest first in the bank's own order inside a day, so the balance column reads down as
  the running balance; dates are Excel dates and amounts numbers, so it sorts, filters and sums; the header is
  frozen and filtered. **Summary** has the period, opening and closing balance, the balance check, and each
  category's rows, money in and money out, footing to the closing balance. Read back by `openpyxl` cleanly; P57
  unzips the download by hand, checks every part's CRC, and asserts the order, the date serials and the overdraft.
- **Bug search, 26 Sep 2026 (P66).** The review over the merged finance code found these, now pinned:
  - **A cheque deposit is never a payee.** Every one reads *Cheque deposited*, and one save had written a rule
    placing all of them on one client.
  - **The edit form's client picker waits for Save.** It had placed the receipt the moment it changed.
  - **A receipt rule covers money in only.** A refund to the same party stays a payment.
  - ***Nobody on the roster* clears a guessed hand.**
  - **Exact matching only uses invoices raised by the day the receipt came in.**
  - **An invoice dated ahead of today is not over 90 days.**
  - **A month the statement never reached reads *No statement*,** not *Not in bank*.
- **A returned cheque is linked to the deposit it undoes** (`bankLinkBounces`, owner: *"work on the open item"*):
  - **By cheque number, automatically.** A debit naming a deposit's cheque number, within 60 days after it.
  - **By amount, offered only.** A same-amount deposit in the 15 days before is offered with **Link**, never applied.
  - **Posting-and-reversal pairs cancel.** A debit and credit of one amount and narration on one day cancel and
    link to nothing: the real statement's only `REJECT` rows are such pairs, for the shop's own cheque 001290.
  - **The owner's choice wins** (`S.bank.bounces`: a deposit id, or `null` for *not a bounce*), and is exported in
    `sep-bank`.
  - **A linked deposit stops being a receipt.** Every reading of receipts sees the client unpaid again, and its
    cheque still counts in the client's series.
  - Finance → Receivables → **Returned cheques** lists each one. To-do rule `bankBounce` asks until each is linked or
    marked.
- **Owned by soma-internal**, like stock: *Export JSON* writes `sep-bank` JSON (rows with their resolved category,
  payee rules, openings). The statement is never committed here; the specs read two fake statements in the
  bank's layout, `tests/fixtures/bank-*.xls`.

### What the bank paid, as cost
Stats → Cost → **Live cost** reads the statement as a second instrument beside the app's own record
(`docs/FINANCE_INTELLIGENCE_SPEC.md`, Phase 4; `bankCostByMonth`, `bankCostForRange` in `bank.js`). Two routes to one
figure is the strongest evidence this repo has; this gives the live cost a second route.

- **Every payment is set against the month it PAYS FOR.** A transfer to a named hand pays the month before, since
  salaries go out around the 14th for the month before. Cash pays the pay week it was drawn in, spread over that week's
  seven days, so a week that straddles two months is split. Electricity pays its bill month (`bankBillMonth`).
  Other costs and supplies pay the month they were paid in.
- **Not every payment is a cost.** GST, income tax and a returned cheque never are. A payment the owner ticks
  **Not an operating cost** on the statement (drawings, a loan, a transfer) is kept off too: `notCost` on the
  row or the payee rule.
- 🔴 **A payee the app only guessed as "other" is UNSORTED and counts as nothing.**
  - On the real statement that residue was ₹3.4–5.6L a month, and it was the zinc and chemical traders.
    Counted as other, it read the quarter at ₹12.66/kg, the opposite of the old error of reading a gap as zero.
  - So other costs and supplies speak for a month **only once nothing in it is unsorted**.
  - Finance → Payments lists those payees under **Not yet sorted**. Each has a **Sort** button that opens its row
    on the statement, so each payee is set once.
- **The order, per component:**
  1. the app's own record, where it covers 90% or more;
  2. then the bank, where the statement covers the period (for labour: covers more of it than attendance does);
  3. then the model, for the rest.

  Electricity and other costs work month by month: a bill, else the bank's payment, else the model. The tag reads
  **paid, bank**. "Measured" counts bank-paid, since it is a record too.
- **A month is "known" only when the statement could have paid for it.**
  - Labour: the statement covers the whole month and the salary run up to the 20th of the next.
  - Electricity: a payment is attributed to the month.
  - Other costs and supplies: the statement covers the whole month and nothing in it is unsorted.

  Unknown is never zero.
- **Recorded against paid** sits under the live cost (`liveCostPaidCheck`). It compares only the months where both
  instruments exist, and flags a gap over 10%.
  - Chemicals and zinc compare use with purchases, which differ by design, so that row is never flagged.
  - On the real book, labour was recorded at ₹2.67L and paid ₹4.80L over June–July. That is the finding the check exists for.
- **Derive from the bank**: Settings → Costing → Live cost fallbacks (electricity, other costs) and Settings → Labour → Modelled
  labour.
  - It takes the six closed months the statement can speak for, and divides total paid by total tonnage.
  - Each month's arithmetic is shown.
  - Offered, never applied, the same as the zinc uplift.
  - On the real statement: electricity ₹0.80/kg against the ₹0.81 model; labour ₹3.46 against ₹3.55.

### The statement as intelligence
Finance intelligence (`finintel.js`; spec Phase 5). The bank statement feeds the To-do and a forecast.

- **Twelve To-do rules**, each switchable in Settings → Checks & alerts → To-do:
  - `bankStale`: the statement is 14 days old;
  - `bankLoose`: receipts still have no client a week on;
  - `owed90`: invoices over 90 days, per client. Never red while any receipt is unplaced, because that money may
    already be in; the task says so;
  - `payingSlower`: a client's last three receipts are 25% slower than its usual;
  - `gstNotInBank`: a month's GST has no payment and no note, and the statement reaches its due date;
  - `powerPaidNoBill`: one task naming the months;
  - `supplierNoBill`: no stock bill that month or the one before;
  - `wageVsSlip`: a named salary leg against the payroll as paid;
  - `cashSwing`: last week's cash drawn is 25% off its payout;
  - `costGap`: recorded against paid over three closed months;
  - `runway`: the forecast goes below zero within 45 days;
  - `bankBounce`: a returned cheque is not linked to its deposit, or marked not a bounce.
- **Days to pay** (`bankDaysToPay`) is weighted by amount. Each receipt counts the days from each invoice it paid, and
  opening balances are left out. Receivables and the Overview's debtor rows show it as *pays in N d*.
- **Cash forecast, 60 days** (`finForecast`, Finance → Overview): the latest balance, plus what is expected in, less
  what is expected out, with a P25–P75 band.
  - **In:** open invoices at the client's own days to pay, and new billing at the last eight weeks' pace.
  - **Out:** salaries, cash by Saturday, electricity, GST by the 20th, and every other payment spread by day.
  - **Cash, not cost:** drawings and tax count.
  - An invoice long past its usual day is **not expected at all**: on the real book that is ₹11.8L of mostly
    already-paid invoices. Expecting it read the account at ₹15.9L in 30 days.
  - Everything it rests on is listed under the chart.

### Finance on every screen
Finance linked into every screen (`finlinks.js`; spec Phase 6). Each screen carries the finance fact that belongs to it,
as a link into Finance, never a second copy of the arithmetic. With no statement, each screen says nothing rather
than a zero.

- **Home → Money:** balance, owed, pays-in and runway tiles, each opening Finance, plus *Import statement*.
- **Stats:** *In one line* gets a Cash row. Contribution by client shows *owes · pays in* under each name.
- **Clients:** a *Money* panel on the detail, the edit sheet and Performance.
- **Register:** the detail says *Paid, exact* / *Paid, oldest first* with its receipt, or *Open, N days*.
- **Staff → Pay:** the bank's wage legs beside the payroll as paid, one function shared with Payments.
- **Stock:** what the bank paid each supplier. The reorder list sets its cost against the forecast's lowest point.
- **Finance → Payments:** each section links to its home screen.

### Staff and Stock open on an Overview
Staff and Stock dashboards (`dash.js`; spec 7a, 7b; owner: *"We'll do the same for Staff, Stock"*). Both screens open
on an Overview built from the Phase 2 charts.

- **Staff → Overview:**
  - today's attendance (the Home card's panel, one function);
  - attendance % by pay week, where a week nobody typed is a gap;
  - labour ₹/kg by month: recorded where 90% of days are typed, paid from the bank where the statement covers
    the month, and the model;
  - OT and EXTRA hours by area over four weeks;
  - payroll against the bank's salary legs;
  - the labour and pay tasks raised.
- **Stock → Overview · Lines:**
  - days left per line;
  - spend by supplier (tap a slice for its bills and what the bank paid);
  - rupees used by week;
  - one line's price trend;
  - the reorder list's cash against the forecast.
- Entry keeps its doors. Home → Attendance opens Day, and Paste message and Enter by hand sit on both Stock tabs.

### Stock on paper
Stock → **Print sheets** (`stocksheet.js`; owner, 29 Sep 2026: *"the same for Stock as that has enter by hand option as
well. Plus, we need physical copy for record keeping"*), for a day picked in the dialog (today first), on the attendance
sheets' page styles, each page one A4 sheet (P97):
- **The supervisor's sheet** is his WhatsApp stock message on paper: *From / To*, then one row per line **numbered as his
  last message numbered it** (`lastPos`; a line never in a message follows on, then three spare numbers), with Opening,
  Added (date · qty), Used (days × a day = total), Available and a note. **The names are printed** (they are the shop's
  chemicals, not people), and a fixed number beside each settles the line his message sometimes sends with no name.
- **Deepak's sheet** is Enter by hand on paper, the four kinds as columns: the **app's level at the start of the day**
  (`stockReplay(id, day)`, so a count is checked on the spot), Count, Received and its ₹ per unit, Used, Charged (into),
  the delivery bill (company, invoice no., date, lines), and *Filled by the supervisor · Checked by Deepak · Entered in the
  app by / on*.
- **The filled copy** carries every entry the app holds for the day, pasted or by hand (a voided one never reaches paper),
  two on one line joined with +, the bills grouped by invoice, and the **level after** the day.
- **An earlier day with stock recorded prints the supervisor's sheet filled, as a worked example** (`stockSheetFillFor`):
  the window his message covered, and per line the opening, what was added, the use as *days × a day = total*, and what
  was available after.

### Stock reorder list
More → Stock → **Reorder list** (owner, 25 Sep 2026). For each line with a daily use:
**use × (lead time + days to cover) − on hand**, rounded up to the **pack it is bought in** (the smallest
purchase, when every purchase is a whole number of it), priced at the **last price paid** and grouped by
the **supplier it last came from**. Lead time (10) and cover (30) are set on the list and kept on the
device's book (`S.stockCheck.leadDays/coverDays`). A rate from under three days of record is flagged
*check*. Typed quantities win and 0 leaves a line out. Lines with no use yet are listed apart. **Copy as
message** gives a WhatsApp-ready order by supplier. Nothing is ordered from the app.

### Home, arranged by the owner
Owner, 30 Sep 2026: *"Home screen needs an overhaul with an option to select what widget to show on the home screen and where — dynamic home
screen which user can adjust"*; they chose **presets and an edit mode, kept per device** (`tabs.js`, `HOME_WIDGETS`, `sep_inv_home`).
- Every card on Home is a widget (`data-home-w` in `#homeWidgets`): month to date, quick actions, money, to-do, attendance, unbilled,
  **production** (the last day plated, by line), **power cuts** (this month's and the last), **stock running low** (red and amber lines,
  soonest out first), GitHub sync, zinc, recent invoices. The three new ones are drawn only while shown (`renderHomeExtraCards`).
- **Presets**: *Owner* is the Home there was (the three new widgets hidden), *Floor* leads with quick actions, attendance, production,
  stock and power, *Money* with the month, money, unbilled and recent invoices.
- **Edit Home** (at the foot of Home): each widget with a switch, up and down, and **Half / Full** (its width on a wide screen; a phone is
  one column). Any change makes the layout *your own* (`preset: 'custom'`). A widget added by a later build joins at the end, hidden, so a
  new build never rearranges a Home. Kept in localStorage, never in the book: a backup or a pull does not rearrange another device. P121.

### Home quick actions
Six buttons under Month to Date, each opening its screen **already on the job**: New invoice, New
challan (the form open), Stock entry (the by-hand form), Attendance (today's day), Paste message (the
one box for WhatsApp rolls — a stock message pasted there is handed to the Stock check, and the pickling and production
messages to Production's; it opens without a roster), Add task (the
box focused). Three across on the phone, six on the desktop.

### To-do
More → **To-do**, a Home card, and a **Windows 11 widget**. The owner's own list (owner, 25 Sep 2026:
*just me*, *both, labelled*, *Windows 11*, *in SEP Invoicing for now*, *not the phone yet*). `S.todo`
is self-contained so it can move to `sep-dashboard` whole.

- **Mine** — typed, with an optional due date, note and a link to a client / invoice / challan / stock
  line. **Ticked, never deleted**: Done keeps them and can reopen one.
- **App** — raised from the book (`TODO_RULE_FNS`): a stock line red or amber, no stock figure for 2
  working days, a credit-note batch past 7 days since the client's last note, challans unbilled after 5
  days (one task per client), invoices not yet dispatched after 2 days (Created or Printed, last 30 days only), the number audit
  finding a gap, no backup (export or GitHub push) for 7 days, and — off by default — a stale zinc rate.
  Each is switchable in Settings → Checks & alerts → To-do. **App tasks cannot be ticked: they clear themselves** when the
  thing is fixed, and every one shows the figures it was raised on and what clears it.
- **A snooze is granted against figures (`sig`), never as a blanket silence** — the Areas card's rule
  for an explained exception. "Until the figures change" returns the task the moment they do. `sig` is
  deliberately coarse where a figure moves on its own: a stock line's is its colour, so it does not
  come back every time a litre is used.
- One rule failing on an unexpected shape is caught; it must not take the list with it.
- **Your own tasks lead** (owner, 26 Sep 2026: *"once I add a todo of my own, it still stays at the end of all the
  system generated one, that makes it easy to miss"*). The page draws *Mine* before *From your data* (on the left on
  the desktop), and `todoRanked()` — the Home card, the widget — puts every open task of yours ahead of every raised
  one that is not red. Only a red task outranks yours; between two red ones, yours comes first. Ranked by tone alone,
  an undated task of yours had no tone and fell below every info task the data raised (P69).

**The widget cannot be the app's HTML.** Windows draws an Adaptive Card (`widgets/todo-template.json`)
from data the service worker hands it. The rows are worked out **by the app** (the app tasks need the
whole book) and written to a small database of their own, **`sep-invoicing-widget`** (`payload`,
`queue`) — the worker never reads or writes the book. **Both directions run on open and on close**
(owner, 25 Sep 2026): the payload is written after a save and whenever the page is hidden or shut; a
**Done tapped on the card** is queued, dropped from the card at once, and applied when the app is next
shown (or at once if open, by message). The queue is read and emptied in one transaction, and the
payload is only written after the queue is applied, so a tick cannot be lost or come back. Tapping a
row opens `?tab=pageTodo&todo=open:<m|a>:<id>`; Add task opens `&todo=add`.

⚠ **Nothing here can test the widget host.** It exists only in Edge on Windows 11 (setup: Developer
Mode + WinAppSDK 1.2, install from Edge, Win+W → Add widgets → SEP To-do). The spec tests everything
the app hands the worker and takes back — the payload, every binding the template uses, the queue, the
launch URLs — and that the manifest, template and worker agree. The Windows side needs one check on
the owner's PC.

**Settings → Checks & alerts → To-do → Check Windows widget** says which step is missing. The owner reported
*"windows widget is not showing"* (25 Sep 2026), and every link in that chain is something only
the PC can see: Windows, Edge, whether the app is installed rather than open in a tab, the worker,
whether Edge exposes `self.widgets` (it does not without Developer Mode + WinAppSDK 1.2), whether
Edge registered the widget from the manifest (it reads `widgets` at install, so an app installed
before the widget existed needs reinstalling), and whether it is pinned. The page asks the worker
(`sep-widget-status`), because only the worker has the widgets API. The check names the **first**
failing step and what to do, and re-renders the widget if it is already pinned.

### Attendance rolls from WhatsApp
Staff → **Paste message** (or Home → Paste message). The supervisor's **in-time** and **out-time** rolls
read into the day the Staff tab keeps, with every line shown beside what it was read as **before**
anything is saved — the stock paste's contract. `parseRelayRoll` is pure (the roster is passed in).

**Calibrated, not guessed.** The rules are the ones the hand decode has used since August, and the
parser was scored against it: the in/out rolls in `soma-internal/data/raw/relays/` replayed into the
decoded days of `soma-internal/analysis/sep-attendance-seed-2026-09-{07,12}.json` — **22 days, 434
marks: state 98.8%, area 92.4%, hours 94.9%, OT 99.1%, EXTRA rows 69 of 79 exact**, identically with and
without remembered spellings. The harness and the real rolls stay out of this repo (it is public); the
spec uses made-up names in the shop's shapes. What does not match is judgement the review surfaces:
barrel versus barrel pickling inside the one unit, and blocks whose crew or times the decoder took
from context. The older seed (to 7 Sep) wrote a monthly hand's OT as 0; the newer one, and this
parser, as hours over 8 — the wage model's rule, confirmed by the owner 25 Sep 2026 (paid at day
rate ÷ 8 × 1.1, capped at ₹68.20/h), so the older seed understates it.

- **Hours are the clock span floored** (8:30 → 5:00 is 8, 6:00 → 5:00 is 11); **a monthly or daily
  hand's OT is hours over 8**; an hourly hand carries none. **The gate stands 7 AM – 7 PM** (BM) and
  its twelve hours are not OT. A hand the out-time roll does not name leaves at 5 PM; until an out-time
  roll arrives the review says the day is provisional, and the next roll **updates** those marks.
- **An EXTRA tag on the 8:30 shift is coverage** booked to that line; on any other slot it is a
  **block** with the crew named under it and the slot's times. The tag closes its group. On an
  out-time roll where the group's own times differ, the block is the hands who stayed latest.
- A slot ahead of the 8:30 shift headed "6:00 pm" is read as the morning, flagged (BM ruled it a
  mislabel). "pickling VA 1 & berral" is the VAT side's pickling; "berral & pickling" is the barrel
  unit; "VAT A1 & pickling" stays a VAT row (the fold is the reconciler's). The office and the gate
  share a header, and each hand stands at his own post. No line written: Flex.
- **Names**: found three ways, surest first. **Exact** — the roster name, either side of a dash
  (`Bhanu - B.P. Sharma`), with or without a bracket (`Lal (Karmu Mahato)` answers to KARMU too), a
  spelling kept on the worker (`relayNames`), or a **first name nobody else has** (the roll writes
  SARAT for the roster's `Sarat Mahato`; a surname spelt the shop's way after it, MAHTO, stays part
  of the name). **Folded** — doubled letters, SH/S, BH/B, W/V, EE/I taken out, then on a numbered line
  the consonants alone (SHAMBHU, BUDHESWR, ROKY). **One letter off** (two on a long name). The last two
  are flagged *read as* with a picker already on the guess. A key two workers share matches neither;
  anything else is **asked, never guessed** — a numbered line not on the roster is red until placed
  or left out.
- **A spelling is learnt once** (owner, 25 Sep 2026: *"everytime I paste a message I have to go through
  and manually match them"*). A placement is kept on the worker **the moment it is picked**, and a
  *read as* the owner saved without correcting is kept on Save. Replayed over the real rolls against the
  device's own full-name roster: **82 read-as lines on the first pass, 3 after one save** (new
  spellings), and the scores above unchanged. ⚠ **Placements had never been kept at all**: the picker
  hands back the id as text and real rosters number their workers, so the save's strict lookup found
  nobody and dropped every one silently. The spec used text ids (`'W1'`) and could not see it; P43 uses
  numbers. Staff → Roster → Import keeps the file's `aliases` as spellings too, a merge keeps the
  retired row's name, and the worker's Edit screen lists them and takes corrections. The chemical stock
  written under a roll (`camical use camical stock`, no date) ends the roll rather than reading as a
  dozen unknown names.
- **A mark entered by hand is kept** and shown as kept; the relay only rewrites marks it wrote
  (`src: 'relay'`, with `inMin`/`outMin`). EXTRA rows already on the day are not added twice. **The
  same roll twice is refused** by fingerprint (`S.relayPastes` keeps each roll whole). A roll with a
  second message pasted on its end stops there and says so.


### The attendance on paper
Staff → Day → **Print sheets** (`attsheet.js`; owner, 29 Sep 2026: *"one for Shyam and one for Deepak aka Champai … a
verification route for the attendance and physical copy that I can file for every day for record keeping"*). For the day
on screen, three documents through the one print view, each page one A4 sheet (P96 measures them under print media):
- **Shyam's sheet** is his WhatsApp roll on paper. **In time** (front): the 6:00 AM blocks (area, three lines, EXTRA, work
  done), then the 8:30 AM shift by area in his order (VAT A1, VAT A2, Barrel & pickling, Pickling A1 & A2, Office & gate)
  with numbered lines running on as he numbers them, an EXTRA box per floor area, and Monthly / Weekly absent. **Out time**
  (back): who left at 5:00 PM, then four later blocks (out at, area, names, EXTRA, work done), and *Filled by Shyam · Sent
  on WhatsApp at · Handed to Deepak at*. **Blank lines only** (owner): he writes names as he does on WhatsApp.
- **Deepak's sheet** is the Day entry on paper: the active roster in the Day view's order (`staffActive`), tier, P / H / A,
  area, in, out, hours, OT, three rows for anyone not on it, the EXTRA table (area, from, to, crew, hours), and *Filled by
  Shyam · Checked by Deepak · Entered in the app by / on*.
- **The filled copy** is Deepak's form carrying what the app holds for the day (a worker marked that day who has since left
  the roster included), to staple behind the two. It cannot be picked for a day with nothing entered.
Shyam writes, Deepak transcribes into the app's shape, the owner enters it and files all three: the paper checks the entry.
**An earlier day the app holds prints Shyam's sheet filled, as a worked example** (owner, 29 Sep 2026: *"that way giving them
a tutorial becomes easy"*; `attSheetFillFor`, never for today): the names under their area, the absent by tier (monthly or
weekly), the 6 AM blocks and the evening blocks with area, crew and EXTRA, whoever is on no evening block in the 5 PM list
with their own time when it is not 5 (*Chand 7:00 PM*, his *BIRSA 2 PM*), all in a filled form's ink (`inv-as-fill`).
Names come from the roster on the device; none is written into the build, and the spec uses made-up ones. English only (owner).

### Needed per shift, and the out-time roll read right (29 Sep 2026)
**The heads a shift needs** (owner: *"sometimes the barrel needs only 3 worker, or VAT A1 or A2 needs only 2 … The app still
shows a deficit in these cases, so for every shift we assume and also input (as an option) the number of workers needed"*).
Staff → Day → **Needed today**: per floor area, who stood on the general shift against the shift's number, a box that starts
at the area's usual complement (placeholder) and takes the day's own (0 = nobody needed; blank = the usual), and a dot
(*Short n* / *Met* / *n over*). Stored in **`S.shiftNeeds[iso][area]`**, apart from `S.attendance`, because a stored day
there is what "recorded" means and a number typed for tomorrow must not claim a recording. `areaNeedOn(iso, area)` is read
wherever the complement was: the Areas card's unit-day shortfall and expected extra, and Home's floor-heads tile. Each OT
or night block has its own **Needed** (`need` on its row), which `blockNorm` reads before the complement and the fold.

**The out-time roll**, from one the owner sent (P98 uses made-up names in its shape):
- *"night hold-8 pm to 6 am"* ran from 5 PM: every out-time block started at 5, and "to" was not a timing word, so the
  heading's own times were skipped. A heading that writes both ends now gives its block both, and a bare *night* heading is
  the night hold, **8 PM to 6 AM** (`RELAY_NIGHT`). A heading with a single time is still only when the crew went home.
- *"----berral & V A 2----"* read as the barrel alone: the barrel check returned before looking for a VAT line. Barrel with
  a VAT line (no pickling) is both, and the collapse to barrel pickling now applies only to barrel + barrel pickling.
- *"pickling 2 SIDE"* is one pickling crew serving both sides (owner): `pickling-vat` + `pickling-barrel`, never a third area.
- **"Night hold is night shift"** (owner, 30 Sep 2026) on an in-time roll as on an out-time one: a night heading with one time
  keeps the other end, starts its block at its own time, and is never taken for a mislabelled morning (*"night hold 8 pm"* ahead
  of the 8:30 shift read as 8 AM).

**The reader learns from corrections** (owner: *"The parser should learn from feedback … by reading if the data was changed
after the paste or save"*). A row the roll makes remembers the heading it came from and what was read (`srcHead`,
`srcAreas`, `srcSlot`, `srcFrom`, `srcTo`); changing its areas, or a block's in and out, on the Day view records the
correction against that heading (`relayLearnFromRow`, `S.relayLearn`), and the next roll with that heading reads it that
way with an info line *… learnt from your correction on 28 Sep*. Put back as read, the lesson goes; Staff → Paste message
lists every one with **Forget**. Times are learnt only for a heading with words (*night hold*): a bare *8:00 PM* is when a
crew went home, and one day's exception must not move every day's block. The paste review has no area or time controls,
so corrections are taken where they are made, on the saved day.

### Labour and attendance
The Staff tab. Labour is ₹3.55/kg of an ₹8.55 cost and 42% of it — the largest line in the
business — and until this it was one number typed into Settings and checked against nothing.
Two questions had sat open across three handoffs: **how staff is allocated**, and **what "the
extra" stands for**. They are the same question wearing different clothes — which of this bill
is fixed and which of it scales with tonnage — and nothing could answer it because nothing
measured it.

**Three views over one store.** Day is for entry (present / half / absent, area, and hours).
Week is a **Sun–Sat** grid whose cells cycle, for fixing what the day view got wrong, with the
`15/20` headcount row the daily relay already speaks in. Roster is the master: comp class,
rates, home area, and whether the worker is on the plant floor.

**The week is the PAY week: Sunday to Saturday, numbered by its Saturday** (owner, 25 Sep 2026).
The weekly tiers are paid on Saturday and a Sunday worked is paid that coming Saturday, so the
Sunday opens the week rather than closing it. It used to be a Mon–Sat grid with no Sunday at
all, which left every Sunday OT day off the one view meant for checking a week. The number is
the ISO week of the Saturday, which is the week the payout files are named after
(`2026-W38-payout-2026-09-19`). The daily tier's weekly rest credit is judged on the same week.

### Pay
Staff → **Pay** (`payroll.js`), for the selected pay week (owner, 25 Sep 2026).

- **Due by worker = earned − paid**, over the worker's own period: the week for the hourly and
  daily tiers, the calendar month of the week's **Sunday** for the monthly tier (the QA sweep, 30 Sep 2026: it was the Saturday's, so in a month's last pay week Pay showed the next month at 0 and hid this one's) (to today while it
  runs). Earned is `labourForRange().byWorker`, the labour card's own arithmetic, split per worker.
  **The EXTRA pool is in no one's due**: it is one line on the slip, disbursed by the supervisor.
- **A balance carries from one period to the next** (owner, 30 Sep 2026: *"yes, unless stated otherwise and notification
  cleared"*; `payCarried`). A due left unpaid is owed next period, an advance not worked off is still to be worked off, and a
  monthly salary paid on the 14th of the next month pays the month it was for (it used to read as an advance against the new
  month, and an advance vanished when its period turned). It is counted from the period of the worker's first payment recorded
  in the app (a monthly hand's, the month before): before that nothing was typed here, and every past wage would read as owed. A
  month on record as paid is settled. Staff → Pay lists **Brought forward**, each with **Clear**, which asks for a reason and
  settles every period up to the one before (`S.payCarryClears`, undone, never deleted); the To-do rule **`payCarry`** asks until
  each balance is paid, worked off or cleared.
- **Payments and advances** are recorded here (`S.staffPayments: [{id, staffId, date, amount,
  kind: payment|advance, note, at, voidedAt?, voidReason?}]`). A wrong one is **voided with a
  reason, never deleted**. A negative due is an advance not yet worked off. Tapping a worker fills
  the form with what is due.
- **Weekly payout** = the weekly tiers' earnings + the EXTRA pool. While the week is open it is
  **predicted at its own pace**: the recorded days as they are, and the unrecorded Mon–Sat days
  at the week's average per recorded working day. The Sunday is taken out of that average because
  it is overtime and does not repeat. With nothing recorded yet, the median stands in and says so.
  **Swing** is measured against the median of the twelve weeks before, leaving out weeks with
  nothing recorded, because a week nobody typed is not a cheap week. The history lists the twelve
  weeks, each with what was paid against it.
- **Hours by area** (Areas view): every tier's hours on each mark, where the worker stood that
  day, with OT among them and the EXTRA booked to the area. A mark with no hours counts 8 (4 for
  a half day), and the card says how many were counted that way.
- **Home → Attendance**: today's on-site count against the active roster, floor heads against
  the complement, the absentees by name, and the EXTRA booked. If nothing has been typed today,
  it shows the last day that has, and names it.

**Three comp classes, because the shop pays three ways** — and the first cut of this module got
two of them wrong by shipping a single `contract` class.

| | Paid | Rest days | Overtime |
|---|---|---|---|
| `monthly` | ₹/day × weekdays worked, + one day per Sunday or paid holiday worked | per calendar month: Sundays × the attendance gate, paid holidays in full | weekdays only: day rate ÷ 8 × 1.1, **capped at ₹68.20/h from 1 Sep 2026** |
| `hourly` | every hour at one flat rate | — | none: the fourteenth hour is paid like the first |
| `daily` | ₹/day × days worked | one day per full week | hour rate × the multiplier |

**Monthly overtime is ruled (owner, 25 Sep 2026): *"monthly hands get OT at day rate ÷ 8 × 1.1. Capped at
68.2"*.** Hours over 8 on a day are overtime. The cap is per hour after the multiplier, so it binds any day
rate above ₹496 (Shyam's ₹576 would pay ₹79.20 and pays ₹68.20). It is in Settings → Labour → Overtime (`otCap`), and
`workerOtHourPay()` is the one place both the labour card and the Areas cost read it. The hourly and daily
tiers are not capped by it. ⚠ **This settles a disagreement in the record rather than creating one:** the
history imported up to 7 Sep carries almost no monthly overtime (July 0 h, August 11 h), while September's
pasted rolls carry 381 h (₹23,340 at the cap). By the ruling, **July and August understate what the monthly
crew earned**, and their labour ₹/kg (₹2.07, ₹2.29) reads low by that overtime.

🔧 **The cap applies from 1 September (owner, 25 Sep 2026: *"Cap applies from September"*).** July and August
were paid at rate ÷ 8 × 1.1 uncapped — Shyam's August OT at ₹79.20 — so `workerOtHourPay(w, cfg, iso)` caps
only OT dated on or after `labour.otCapFrom` (`2026-09-01`, Settings → Labour → Overtime). Called with no date it caps,
which is the rate going forward.

**The monthly tier is BM's model (10 Sep 2026), per calendar month:** `gross = rate × (weekdays worked +
paid holidays + Sundays × gate + Sundays worked) + weekday OT`. It reproduces the ruled August slip's day pay
to the rupee for 8 of 9 hands off the imported marks; the ninth, the gate hand, is one day short in the marks.
- **The gate is the ratified 100 / 50 / 0** at 90% and 80%, and attendance is **weekdays worked ÷ the month's
  working days** — Sundays and paid holidays out of both sides. A festival is not a holiday: 28 Aug (Raksha
  Bandhan) was ruled an absence.
- **Paid holidays are always paid** (BM: *"National holiday is always paid"*): `labour.holidays`, the three
  national holidays as `MM-DD`, or a full date for a one-off. A hand with no day recorded in the month is
  credited nothing — a month nobody typed is not a month of holidays.
- **A worked Sunday keeps its gated credit and is paid one day on top** (BM, 10 Sep: *"keep the worked sunday
  credit"*), and its hours are that day, **never OT as well** — which would pay them twice (the July slip took
  Sarat's Sunday hours out of OT for exactly that reason). The app reads a worked paid holiday the same way;
  that one is its own reading, not a ruling.
- **A contracted monthly wage** (`worker.monthWage`, Staff → Edit): BM, 14 Sep, *"Uday is 9000/month. per day is
  calculated as per days in that month"* and *"His sundays are not gate sensitive"*, *"Sunday is inside the
  9000"*. So the day rate is wage ÷ days in the month, the Sundays are credited in full, and a Sunday worked
  adds nothing. 22 + 1 + 5 = 28 × 9000/31 = ₹8,129.03, the ruled figure. The worker's total is rounded once
  from the unrounded parts, or 28 days reads a paisa high.
- Over a range shorter than a month the gate is judged on the part of the month the range covers, as before.

### The monthly payroll AS PAID
A closed month is not a thing to re-derive: somebody was paid against a slip, and the slip is the fact. The
model predicts the slip — fine for the month in progress, wrong on a closed month whose marks were typed
short or paid on a rule since changed (July and August's missing overtime).

`S.payrollPaid: [{id, month, status: paid/computed, source, note, at, rows: [{name, staffId?, rate, worked,
restDays, dayPay, otHours, ot, paid?, note}], voidedAt?, voidReason?}]`. **For a month before the current one,
a record REPLACES the model for the hands it names** — on the Pay view (that month's due reads settled, *as
paid, from the slip*), the labour card and the live cost — pro-rata to the share of the month a range covers.
A monthly hand the record does not name (paid on a voucher of their own) is still modelled, and a name the
roster does not hold still costs what it was paid. The month in progress is always modelled.

Staff → Pay → **Monthly payroll as paid → Import** takes a `sep-payroll-paid` file. Names are matched like a
roll's (`relayKey`, and the worker's spellings), never by id. The same figures twice are skipped; different
figures for a month **supersede**, and the old record is voided with the reason — never overwritten. Wages
never enter this public repo: the file is built privately from the slips. **April, May, July and August**
exist; **June does not** — only its projection is on disk, not the slip it was paid on. August is
**Revision 5 as paid on 14 Sep** (₹1,01,768.43), not Revision 15's ruled ₹1,02,247.46: the gate hand's row carries
the ₹479.03 still owed as a note, and Shyam's and Rupa's rows note their crossed bank legs.

The salaried tier is `monthly` and **is not a flat salary**: the payout slips are written in
₹/day, and a flat monthly divided by calendar days neither matches them nor moves when somebody
is absent. The weekly pool is `hourly` and has **no day concept at all** — charging it a day
rate and then paying overtime at ×1.1 invents a boundary the slip does not have and overpays
the overtime by a tenth. `daily` is the generic middle; no SEP tier is on it, and it is what
the retired `contract` class was.

**The gate is the one place a monthly worker's pay moves with their own attendance.** Rest days
are paid, scaled three ways: at or above 90% attendance all of them, at or above 80% half, below
that none. Exact over a calendar month, which is the period it was written for; over a shorter range
it judges each rest day on that range alone, and the card says so.

**The model reproduces a real payout slip.** One W32 week's hourly pool foots to ₹27,549 across
ten hands and 580 hours at ₹47.50; the spec feeds the same hours through and lands on
₹27,550.00, the rupee being the slip's own three half-rupee roundings taken down. A model that
cannot reproduce a document somebody was paid against is not one to price a decision with.

**The roster ships empty, and it has its own door.** Names and wages are payroll data, this repo
is public, and its built page is served to anyone — so making the repo private would not hide a
seeded roster either. Structure (the eight areas, the comp classes, the wage arithmetic) is
code; the people arrive through **Staff → Roster → Import**, which **merges by name** and touches
nothing else on `S`. Settings → Import cannot serve: it replaces the whole state, so a roster
file through that door takes every invoice with it. Merging on the *name* rather than the id is
what keeps a worker's existing attendance marks attached, because two devices that typed the
same person gave them different ids.

That is a deliberate departure from `SEED_CLIENTS`, which does carry real names: a client name
is on every invoice that leaves the building, a worker's day rate is not.

**The days a roster worked come through the same door**, for the same reason the area complements
do: a roster with no history has nothing for the Areas card to check, and a history with no roster
has nobody to attach itself to. Three rules, each of them the difference between seeding a history
and corrupting one.

- **Marks name a WORKER, never an id** — the same reason the roster merges by name, one level down.
  An id in a file attaches a day's marks to whoever holds that number on *this* device. Attendance
  is therefore applied **last**, against the roster the same import just merged.
- **A name not on the roster is dropped and COUNTED, never created.** Inventing the worker would put
  a row with no comp class and no rate on the roster, and the labour figure would then read short
  with nothing on screen saying why. A reported drop is a question somebody can answer; an invented
  worker is a wrong number nobody sees.
- **A day already recorded is KEPT, never overwritten.** Seeding must not be able to destroy entry
  somebody actually did, and a re-import that changed nothing says so rather than looking like it
  worked.

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

### The block census, adjudicated

The extractor was a third instrument reading **8 blocks** where Castor swept 13 and Cipher 17 over
the same four files. It keyed on *heading style* — it required the literal words `6:00 AM block`, so
`| **6:00 AM — VAT A2** | … |`, the shop's commonest morning shape, matched nothing at all. Keying on
what a block **is** rather than how it is written — a slot outside the 8:30–5:00 general shift
carrying its own tag — finds four surface forms, all real: the table row, the prose line, the `###`
heading (W24's only block, which is why that file counted zero), and the `Out` row.

**Result over W24/W31/W32/W33, weekly files only, corrected instrument: 14 distinct blocks,
19 tagged rows** *(an earlier 15/19 counted a phantom — Wed 29's general-shift `EXTRA 8 HOURS`
mangled into a Tue-28 morning block by the unparsed combined heading; Castor caught it)*. **Adding
the tags the weeklies transcribed away** — W31's Mon-27 morning `Extra 9 hours`, Mon-27 evening
`Extra---3 hours` ×2 and Tue-28 morning `Extra---3hours`, all literal in the raw relay —
**gives 17 blocks / 23 rows: exactly Cipher's count. The census disagreement RESOLVES.**

- ✅ **Cipher was right twice.** The `Out` rows are tagged blocks (Castor's key excluded them — 4 of
  W33's rows, `:63` among them, and `:63` is the surviving named exception, so it cannot sit outside
  the population). And the man-hr lines Cipher counted as tags ARE tags — in the raw relay, which is
  the primary source the weekly was transcribing.
- ⚠ **The three sweeps disagreed because they counted different corpora, and none said which**:
  Castor the weeklies minus the `Out` shape (13/18), this extractor the weeklies keyed on heading
  style (8, then 14/19 corrected), Cipher the population as the raw records it (17/23). The
  instrument note that matters: **a census of the shop's tags must be run on the shop's own
  messages; the weekly is a fair copy, and fair copies normalise exactly the marks being counted.**
- **Genuinely untagged blocks remain real and outside the tagged census** — Wed 29's and Thu 30's
  morning OT, and **Thu 30's** midnight block, which the file flags at `2026-W31.md:88` as *"No
  EXTRA tag on this block"* *(an earlier version attributed that flag to Tue 28's midnight block —
  Tue 28's IS the tagged flagship; the flag two lines below it belongs to Thu 30)*. They import as
  worked slots with crew and times and book nothing, which is what the ruling predicts for a slot
  that ran at complement (Thu 30: 4 + fold 2 = 6 present → short 0 → predicted 0 — *the rule
  working, not an anomaly*).

**A block naming no area is now KEPT rather than dropped.** Two census rows state hours purely as
out-times without naming a line. Dropping them took real booked hours out of the bill; they import
with empty areas, report as *Not checkable*, and bucket their cost to `flex`. Unverifiable is not
unpaid.

**And a fourth EXTRA notation surfaced while fixing this: a COLUMN.** `W29`, `W30` and `W31` write
`| Area | Workers | EXTRA |` with a bare `**16**` rather than an inline tag. A two-column matcher
read none of it, so those three weeks reported **zero booked hours** — not because the shop booked
none, but because the sheet had grown a column. **W29 0→14, W30 0→8, W31 1→8 tags.**

**Four states, not three.** Unmarked is not absent. A row nobody has reached costs nothing; an
absence costs a day's wage and has to be said. The same distinction one level up is what the
coverage figure is for: a day with no attendance key is a day nobody typed, which is not a day
nobody worked.

**What "the extra" is.** The daily sheet books hours two ways. Named men carry their own
out-time — that is OT, per worker, at their hour rate × 1.1. But every day also carries lines
like `EXTRA 16 HOURS` written against an **area block**, with nobody attached. They are real
paid contract-tier hours and the payout sheet settles them. In the **bill** they stay exactly
that: hours booked to an area, under the EXTRA line, counted once — the fixed-versus-variable
split never depends on how they are shared out. Who *receives* them is ruled (28 Aug 2026):
the short area's present crew, pro-rata, disbursed by the supervisor on the floor — the card computes
that split; the cost accounting does not move.

**Fixed and variable are kept apart everywhere.** Fixed is the monthly tier — its days and its
gated rest days together. It moves with that crew's attendance but not with tonnage, which is
the distinction the split exists to draw. Variable is the hourly pool, the daily tier, OT and
extra. That split is not decoration: the SSS Mehta decision turns on it — at fixed labour
that account still contributes ₹0.53/kg, at volume-scaling labour it loses ₹1.64/kg — and one
blended labour number silently picks a side.

Every constant — multiplier, both gate thresholds, the daily tier's weekly rest credit, the
extra-hour rate, and the modelled ₹/kg the measurement is reported against — lives in Settings.

**Variable labour is broken down by area** — contract days, rest credit, OT and the extra,
placed by the area each was worked in, ranked by cost rather than by days because an area that
pulls the overtime is the expensive one. That is the *allocation* half of the open question.
The monthly tier's day pay and rest days are deliberately absent: that crew is the standing one
and its cost does not follow the area it happened to stand in. Its **overtime is** in there —
an overtime hour was worked somewhere specific and was paid for being worked.

**An incomplete range reads low, never neutral** — every tier is paid for days and hours actually
recorded, and the monthly tier reads low *twice*, because a day nobody typed also depresses the
attendance its rest-day gate is judged on — so the card states coverage in place, every time, complete or
not, and withholds ₹/kg below 90% of working days. It withholds under a fortnight too, but for
a different reason: not enough of either side to divide. The lag between plating and billing
cannot be gated away at any length, only stated, so a range under two months carries that
caveat next to the figure. And a ₹/kg computed over partial tonnage coverage reads **high**
here — the opposite direction from realisation, because tonnage is the denominator — which the
card says rather than leaving the reader to work out.

**Day is a board, a card per area** (owner, 30 Sep 2026: *"Attendance sheet for Day scrolls way too far for information … Overview doesn't
show any staff allocation for Office, gate, flex, civil"*; they chose the area board). Every area with a hand or a number needed is a card
(`data-att-area-card`, `inv-board`: one column on the phone, as many `--board-col` columns as fit on the desktop), its head the heads on
it against the day's number (*Short 1 / Met / 1 over*). Each hand is one line, P / H / A one tap as before; **the name opens the hand's
day** in a dialog (`attEditOpen`: state, area, hours or OT, saved as they change). The absent are one strip under the board
(`attAbsentList`), *Needed today* and the day's cost fold (`uiFoldCard`, state.js, folds any panel whose head holds no button). Pay leads
with the payout and dues, its history and the slips as paid folded; Areas folds its hours and the absorption. **Civil** is an area
(a post, off the floor, like the office and the gate; a roll heading *civil* reads to it). **The attendance panel** (Staff → Overview,
Home) says where everyone on site stood, by area, the floor against its number. P119.

**A day's attendance is deleted only with a reason, and the deletion is logged** (owner, 30 Sep 2026: *"there is no way to
delete a day's data after providing a reason that can be logged"*). Staff → Day → **Delete this day** asks why (required),
moves the whole day to `S.attendanceDeletes` as it was (`attDeleteRecord`: key, reason, when, the marks and EXTRA counts,
the day itself), and History lists it. A day saved under no date could not be opened, so a start-up pass moves every
key that is not a date to the same log (the book held one keyed `"null"`, 23 marks; owner: *"delete the attendance day
saved under null, the day it was for was added correctly"*). The day's heads-needed figures are not attendance and stay.
P116.

**Deletion is refused while attendance names the worker.** Removing the row would not remove
the marks, it would orphan them: every past week's labour would quietly drop that wage and no
figure would say why. Clearing Active keeps the history and takes them out of today's
denominator, which is what "left" means here.

🔧 **That was true of the roster and false of the bill until 25 Sep 2026**: `labourForRange` priced only the
active roster, so setting a leaver inactive dropped every day they had worked from every past week, month and
payout median. It prices every worker whose marks fall in the range now; `rosterSize` is still the active count.
Paid holidays count as rest days in the coverage, not as working days nobody typed.

## Settings
Six groups (owner, 25 Sep 2026: *"Too many things all in one place, no markers, no subdivisions"*):
**Business** (company, bank, invoice and credit note series), **Checks & alerts** (rate & weight check, invoice states, stock
alerts, To-do), **Costing** (full cost, live-cost fallbacks with the chemicals model, zinc rate), **Labour**
(overtime, rest days & attendance, the extra, modelled labour), **Connections** (metals.dev, Gemini, GitHub sync)
and **Data & device** (backup, storage, build). The groups are `SETTINGS_GROUPS`, the sections `SETTINGS_SECS`
in `settings.js`, each with a `summary()`, `body()`, `why` and `save()`.

- **Every section is folded to one line saying what it is set to** (`10% · ₹100 · ±3%`), so Settings reads
  at a glance; the ruling behind the figures sits under *How this is used*.
- **Each section saves on its own** (owner: *separate Saves*). A Save that wrote the whole sheet let an edit
  to the bank details carry a half-typed labour figure with it. Save is enabled only once the section is
  edited; an unsaved section is marked on its line and on its group, and closing Settings with one asks,
  naming it. A refused figure (a credit note number already issued) leaves the section unsaved.
- **Desktop is two panes**: the groups down the left, one group on the right. The phone stacks the groups.
  The open group and sections are remembered per device (`sep_inv_settings_ui`), never on `S`.
- `openSettings(sec)` opens on one section; the To-do backup task opens *Backup, storage & build*. Specs use
  `openSettingsAt(page, sec)` from the fixtures, which walks the same clicks the operator does.
- **Part weights (NOS→KG) moved to Items → Part weights**: they price `nos_to_weight` lines, so they are
  data about parts, not a setting.

## Persistence

**IndexedDB is the system of record** — database `sep-invoicing`, store `state`, one entry
`current` holding the whole state as a JSON string. No backend and no server-side account;
manual backup/restore via JSON export/import in Settings. localStorage keeps only the small
per-device entries (credentials, sync position, view prefs).

🔴 **Why it moved: localStorage quota is per ORIGIN, and every GitHub Pages project under this
account is served from `rishabh1804.github.io`.** A phone running Chrome 152 refused 128K more
characters beside a 1.67M state, on an engine measured to take 5.1M in a single value — because
the sister PWAs' data held the rest of the pool. Nothing this app could do to its own key would
fix that. IndexedDB has its own quota, sized from the disk, not shared through a 5M-character
keyhole. **Two consequences of the move are load-bearing:**

- **The load is asynchronous, so the bootstrap is.** `let S = null` until `loadState()` resolves;
  `bootState()` assigns it, then `bootApp()` in init.js runs everything that always ran at load
  (state.js's series reset, seed.js, the bootstrap seeds, `migrateState()`, layout, tab restore)
  in the same order, and adds **`inv-booted` to `<body>`**. Until then the shell is visible and
  inert (`pointer-events: none`). **Nothing between state.js and the end of init.js may read `S`
  at load time** — the seeds are functions now for exactly that reason. Tests wait on
  `body.inv-booted`, never on `nav.inv-tabs`, which is static HTML and proves nothing.
- **IndexedDB can be evicted under storage pressure; localStorage could not.** The app asks for
  persistent storage after its first verified write (`navigator.storage.persist()`); Chrome grants
  it silently to an installed app or an engaged site. The diagnostics report says whether it was.

**A save is still ONE JSON string, written whole and READ BACK.** Writes are coalesced and
serialised: a call while a write is queued shares it, a call while one is in flight queues
exactly one more, and the state is serialised when the write *starts* — so the last write always
carries the latest `S`. That is what makes `adoptState()`'s rollback sound on an async store:
after `S = prev` the queued write is `prev`, whatever a half-migrated write in flight carried.
`saveState()` returns a `Promise<boolean>` that resolves once the copy is verified on disk; the
import waits on it before saying *imported*.

🔴 **Two windows on one book: the version guard** (UX overhaul 2, step 2; owner, 28–29 Sep 2026). Each window holds the
whole book and saves it whole, so a second window used to overwrite the first one's save **without a word** — measured on
the build before this: window A adds a client, window B (open on the older copy) adds another, and the stored book holds
only B's. The installed app and a browser tab open side by side already did this. Now:
- **The saved copy carries a revision** (`rev`, a second key beside `current` in the same IndexedDB store;
  `sep_invoicing_rev` on the localStorage path). A window keeps the revision it last read or wrote (`_diskRev`), and
  `writeGuarded()` checks it and writes **in one readwrite transaction**, which the browser runs one at a time across
  every window of the origin. A save from a window holding an older copy is **refused** (`StaleCopy`): the window loads
  the current copy and says so in the notice banner (*the last change made here was not saved … make that change again*).
- **After every save the other windows are told** (`BroadcastChannel('sep-invoicing-book')`) and load the book at once
  (`bookReload`), redrawing the page in place (`tabRedrawActive`, switchTab's drawing as `tabRender`) with an *Updated from
  another window* toast. A window coming back into view checks the revision too (`bookCheck`), since a frozen tab hears
  nothing. A load replaces `S` and runs **no migration**: a migration saves, and the windows would answer each other for ever.
- **What is being typed is kept**: with a dialog open, a field typed on the page (not a toolbar filter), or a challan form in
  progress, the screen is not redrawn (`bookBusy`), the toast says the typing is kept, and the save lands on top of the
  newer book, since forms save by id into the `S` that is there.
- **GitHub pushes hold one lock across windows** (`ghPushLocked`, Web Locks), reading the config fresh inside it, and a
  window that pushed tells the others which revision went up, so a push still pending elsewhere for that same book is
  dropped (`ghCancelPending`). Without it the second window's push met the first's SHA and auto-push paused itself on a
  copy its own device wrote.
- A copy written straight to the store without a revision (the p16 spec does) is simply the copy on disk; the next load
  reads its revision, whatever it is. P93.

**The legacy localStorage copy is migrated on the first boot that finds the store empty, and
REMOVED once a verified write has landed** — that removal is what hands the shared pool back to
the other two apps. A populated store wins over the legacy key thereafter, so a stale copy left
in localStorage by an old build cannot roll the books back. A browser with no IndexedDB (or one
that refuses to open it) falls back to the localStorage path, verified the same way.

**A copy that exists but would not read is never written over.** The store is read-only for that
session — `persistState()` returns false, the boot banner says so and stays — because seeding a
default book on top of an unreadable copy turns *unreadable* into *lost*. The read-error banner
and the save-failure banner are different kinds; a save that lands clears only the latter.

✅ **Confirmed on the affected phone, 8 Sep 2026 (owner):** on build `05407536`, the import that had
failed since 12 Aug landed, and the data survived a reload. Same device, same Chrome 152, same file —
the only change was the store.

**GitHub sync** is an optional second copy, not a backend. It pushes the whole state as one
JSON file to a repo through the Contents API and pulls it back on another device. It is
deliberately last-writer-wins — the state is a single document with no per-record clocks, so
any merge would be a reconciliation the app cannot verify — but no overwrite is ever blind.
Each device remembers the blob SHA it last exchanged, and if the server's SHA has moved since,
the operator is told whose copy and when before anything is replaced. Auto-push is opt-in,
debounced ~45 s, and pauses itself the moment it sees a copy it did not write.

🔴 **Over 1 MB the Contents API sends a file WITHOUT its content** (`content: ""`, `encoding:
"none"`) while still accepting a PUT of up to 100 MB. The book passed 1 MB long ago, so push worked
and every pull refused a real 4.3 MB backup as *"not a SEP Invoicing backup"* (owner, 25 Sep 2026).
`ghGetRemote()` now asks the same endpoint again for the raw file (`application/vnd.github.raw+json`)
when the content is missing. The push's own conflict check reads only the SHA and downloads the
other copy only when it has to say whose it is. The ceiling is now GitHub's 100 MB.

**Every GitHub request is `cache: 'no-store'`**, and a refused pull says what arrived. The phone kept
refusing after that fix while the desktop pulled (owner, 25 Sep 2026). GitHub marks these responses
cacheable for 60 s and gives a file's JSON and raw forms the **same ETag**, so a browser that
revalidates one against the other can serve the metadata as the file — *a hypothesis: desktop
Chromium did not reproduce it.* Sync needs the live SHA regardless, so the cache is bypassed; and the
error now names the path and what came back (*no content*, *GitHub's description of the file*, *a
Settings → Export backup, not a sync file*, the JSON's keys), so the next report settles the cause
instead of restating the symptom.

**A state that arrives is as old as one read off disk.** Three paths replace `S` wholesale —
the loader, a GitHub pull, and Settings → Import — and only the loader ran the migrations. So a
copy pulled from a device that had never run the area realignment kept its retired `pickling` and
`colour` ids, which `areaStats` drops on the floor (`if (!a) return;`): heads under-counted, every
shortfall inflated to match, and nothing on the card said so until some later reload happened to
fix it. All three paths now run the same two passes — `ensureStateShape()` then `migrateState()`.

**What re-runs and what does not is the load-bearing half.** A structural migration re-points or
repairs records the state already holds, so running it against someone else's backup is as correct
as running it against your own, and running it twice is a no-op. A **seed** writes new business
records and a **cleanup** deletes them, and the flags on an incoming backup describe the device
that *wrote* it, not the records in it — re-firing `_scanSeed1` on a pull would push seven challans
a second time, into the one app here with a module devoted to duplicate receipts. Seeds and the
Belrise rate cleanup stay bootstrap-only, deliberately and in writing.

`ensureStateShape()` is also the one copy of the repair list, read from `getDefaultState()` rather
than restated. There were three copies: the loader's and ghPull's had already drifted by four keys,
and **Settings → Import had none at all** — a backup written before `staff` existed left it
undefined and the Staff tab threw on open. Containers are filled *empty* (the app never invents
business data to repair a shape); config objects are filled from the defaults, key by key, because
`labourCfg()` reads `extraRate || 0` and a missing constant would silently price the extra at
nothing rather than leave a visible gap.

**A save that did not land is said so.** A phone held a 12 Aug copy of the books for four weeks
while every import since reported *Data imported*. Three silences stacked: the save caught every
browser error as "Storage full!", the import's own success toast replaced that toast in the same
tick, and nothing read the value back to see whether the browser had kept it. Now the error carries
the browser's own name for it (`QuotaExceededError`, `SecurityError`, or *write not persisted* for a
store that drops a write without throwing), a failed state save raises a banner that stays until a
save succeeds, and the import refuses to say *imported* when the copy only reached memory.

**Settings → Run storage diagnostics** answers the questions a lost import raises from the device
itself: which store is in use and what it loaded from, the origin's quota usage and whether
persistent storage was granted, what is on disk and when its newest record was written, whether it
matches memory, whether the last save landed, whether the legacy localStorage copy is still
occupying the shared pool, every localStorage key on the origin by size (names only, never values),
and how much more localStorage the origin will take (probed with scratch writes that are read back
and removed — that pool is the sister apps' now, and the figure says whether they are next). The
report is plain text and is copied to the clipboard, so "it reset to 12 Aug" becomes a figure
somebody can paste. **It found this cause where two rounds of reasoning had not.**

⚠ **Two wrong diagnoses preceded the right one, and both were reasoned rather than measured.** First
*storage full* on this app's own 2.1M — under Chromium's ~5M ceiling, so withdrawn. Then *a
smaller-quota browser* — the report named Chrome. The origin's total was the figure neither guess
looked at, because nothing in this app's own key could have shown it. The instrument found it; the
reasoning did not. The move to IndexedDB above is the consequence. The sister apps still share the
localStorage pool with each other; a separate origin per project (a custom domain, or an
organisation account per project) is the no-code answer for them.

Credentials live in their own localStorage entries (`sep_inv_gemini_key`, `sep_inv_metals_key`,
`sep_inv_github_token`), never on the state object, so an exported backup can never carry one.
Appearance is device-only the same way (`sep_inv_theme`, `sep_inv_palette`, `sep_inv_density`): a backup
must not repaint the phone that imports it.
The sync config (`sep_inv_github_sync`) is kept off `S` for the same class of reason: a file
SHA and a device id describe this device's relationship to the remote, and restoring someone
else's backup must not hand this device their sync position.

## Offline

Canon 0034 says service workers never cache HTML. That rule exists to prevent the unbreakable
update loop — a stale shell served forever to a device that stops asking the network.

`sw.js` now keeps that guarantee by a different mechanism rather than by abstention.
Navigations are **network-first**: an online device always renders what the server just sent,
and the cached shell is reached only after the network has actually failed. The loop cannot
form, because the cache is never *preferred* while the network answers. What it buys back is
the thing the canon cost: every byte of business data is local, yet the app could not be
opened at all without signal.

Static assets are cache-first and revalidated behind the response. The install step keeps
same-origin assets atomic but lets the cross-origin font CSS fail on its own — it used to sit
in the same `addAll()`, so one CDN hiccup rejected the install and the worker never activated.
Gemini, metals.dev and api.github.com are never intercepted.

**The shell cache is not versioned, and a worker bump used to delete the only offline copy.**
The navigation that triggers a worker update is served by the *old* worker, which stored the
page under the old versioned name; the new worker then activated, deleted every cache not on
its keep list, and its own shell cache stayed empty until the next online open. A device that
went offline in that window got the "never loaded online" page, which was also untrue. The
shell cache holds one entry that every online navigation overwrites, so the version suffix
bought nothing. `sep-inv-shell` now outlives the worker that wrote it, and the one upgrade
that crosses the rename copies the legacy `sep-inv-shell-v*` entry across before dropping it.
`CACHE_NAME` keeps its suffix — that cache is rebuilt at install anyway.

**An open app is told when a build ships; it is never reloaded for it.** Network-first makes
every fresh open current, but an installed app resumed from recents never navigates, so nothing
told an open page that a build had shipped — it could run one build for weeks with no way to
say which. The page re-reads `version.json` (`cache: 'no-store'`; the worker steps aside for
that one path, or it would read its own stale copy forever) whenever it comes back into view,
throttled to once in five minutes, and raises a banner when the stamp differs from its own.
The banner offers a reload and says to finish anything half-typed first: a reload discards an
in-progress challan, and that is the operator's call. *Later* silences that build only; the
next one asks again. The manual check in Settings keeps *could not reach the server* apart from
*up to date*, so an offline device is never told it is current.

Note what the stamp is and is not: it identifies the **document**, so a change to `sw.js` alone
does not move it — the worker updates through the browser's own byte-compare, as before.

@import docs/SEP_INVOICING_DESIGN_PRINCIPLES.md
@import docs/ARCHITECTURE.md

@import AGENTS.md
@import Memory.md
@import PERSONA_REGISTRY.md
