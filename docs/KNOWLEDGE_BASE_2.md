# The Knowledge Base, second edition: three ways to read, the desk, notes and tracking

**Status:** spec, not built. Owner, 14–15 Oct 2026. Four releases, one PR each, merged one after another (§11).
**Builds on:** `docs/KNOWLEDGE_BASE.md` (the store, kinds, roles, approval, training: all unchanged unless said here) and the
writing standard (*The writing standard*, STE 80%). **Borrows from:** SproutLab's CareTickets spec v5 (the owner's other app):
its six-transition lifecycle, check-ins with a verdict, escalation triggers, four resolution types, the reopen and
force-resolve guards, validation on load. What changes for the shop is said where it changes (§7).

## §0 What is built

Nothing yet. Each release adds its line here when it merges.

## §1 The owner's words

- 14 Oct 2026: *"We'll upgrade the knowledge base UI design next, lots of blocks of texts and even opening the documents looks
  antique and too much information with weak visual hierarchy."*
- 14 Oct 2026, after four directions were drawn on the challan guide, a fault and the Library (Manual, Reader, Guided, Quick
  reference): *"quick reference at a glance and guided for training. But otherwise … once we switch from quick reference, it
  should go to a reader mode, which sounds like a manual, but we don't need tick off boxes."*
- 15 Oct 2026, the desk: *"When it opens in full, I want it to look like the claude code layout on the desktop. On the left we
  have a collapsable column and on the right we have related and linked environment, context, connector, outputs, we should
  have a notes section and a track this fault option as well … tickets could be closed by actioning through the app."*
- 15 Oct 2026, the answers:

| # | Asked | Ruled |
|---|---|---|
| 1 | A section in Quick reference: open in place, or go to Reader at that section? | Reader at that section |
| 2 | Which kinds get which modes (§2b) | As proposed |
| 3 | *At a glance*: worked out, or written? | Both: written where it is, worked out where it is not |
| 4 | Desktop: Reader in the middle, *At a glance* at the right, no switching | Yes |
| 5 | A different landing for each role | Yes (§2c) |
| 6 | The Library | A's list with icons + C's shelves, with Ask on top |
| 7 | What can be tracked | Faults, processes and client requirements; built for all three, released one after another |
| 8 | Who does what on a tracking | Anyone opens; the supervisor checks; the owner closes one that needs the owner, with a reason |
| 9 | Notes | Public (every reader), and private (the owner only) |
| 10 | Needs the owner: WhatsApp too? | Yes |
| 11 | A tracking pinned on Mine for its person | Yes |
| 12 | The spec's own calls (follow-ups on the To-do, WhatsApp opened for a person to send, the book never closes alone, 3 clear checks, 12 open, a year kept) | Accepted, 15 Oct 2026: *"Makes sense"*, *"Good starting point"*, *"Sure"*; WhatsApp a workaround until a server sends messages |

## §2 Three ways to read an article

### §2a The modes

1. **Quick reference** (where an article opens, except §2c). The title, its kicker (*Using the app*, *Setting up*, the kind),
   one line under it, then **At a glance** (§2d), then each section of the body folded to one line with its count (*Add a
   challan · 7 steps*, *Wanted by a day · 4 points*). A section's line opens **Reader at that section**; *Read in full* opens
   Reader at the top. Nothing unfolds in place.
2. **Reader.** A manual page, set as a document: larger type (16 px body, 1.7 line height), a measure of about 65 characters,
   no boxes round the text. The manual's signals:
   - a step is a numbered item, its numeral in the accent and mono; no row box, **no tick box**;
   - a step whose text starts *If …,* keeps the condition first, as written (STE); it is not restyled;
   - **WARNING** and **CAUTION** are filled blocks with their icon (danger, warning), and **NOTE** an info block: the one place
     colour fills the page (DR-1: colour is status);
   - `**label**` is bold (what the person taps), and a screen path (*Office → Challans → Add challan*) is one link that
     opens that screen (a new `kbPathGo`, through `navApply`; a path the app cannot place stays text);
   - `*word*` is italic. **Today's renderer prints the asterisks** (`kbBodyHtml` knows only `**`): fixed in KB2-1.
   - A heading is 19 px, 650, with space above; *How it's worked out* folds stay as they are.
3. **Guided** (training, and a fault at the tank). One step a screen in large type (22 px, 600), a progress bar of segments,
   Back and Next as 50 px buttons fixed at the foot. Before the first step: the title, the count, the article's WARNING or
   CAUTION, and *See all steps on one page* (Reader). After the last: the sections that are not steps (*Good to know*), then
   **Record training** where `kbTrainOk()` and the article is a lesson (`kbIsLesson`): the dialog as it is today, which asks
   who was trained. For a fault, Guided is the causes in order (§7d).

The mode is a view of one article, never a copy: the body is read once by one parser (`kbParse`: the blocks of `kbBodyHtml`
today, plus notices and sections) and drawn three ways. A mode is part of the address (`?tab=pageKnow&id=…&m=quick|read|guide`,
`&s=<section>` in Reader), so Back walks Guided → Reader → Quick reference as steps (nav.js). Guided's step is not an address:
Back from step 4 goes to where Guided was opened.

### §2b Which kinds get which modes

| Kind | Quick reference | Reader | Guided |
|---|---|---|---|
| How-to (`guide`), process | yes | yes | yes: the numbered steps |
| Fault | yes | yes | yes: the causes, *Found it / Not this* (§7d) |
| Ruling, decision, part, client requirement, incident | yes | yes | no: nothing to step through |

An article with no numbered list has no Guided, whatever its kind; the door is not drawn.

### §2c Where each role lands

| Signed in as | Opens on |
|---|---|
| Owner, office | Quick reference |
| Supervisor, floor | Guided, when the article is a lesson on the role's path (`kbPaths`, `kbPathArticles`) and the person's hand (`users[].staffId`) has no training on its current version (`kbVerOn`); else Quick reference |
| Guard off | Quick reference |

A link that names a mode (`m=`) wins. A desktop opens the desk (§3), which has no separate Quick reference.

### §2d At a glance

At most four rows, each a label and a value, under 90 characters each. **Written** where the article has `glance` (the form's
optional field: up to four lines, *Label: value*); else **worked out** by kind:

| Kind | Rows worked out |
|---|---|
| How-to, process | *Where*: the first screen path · *You tap*: the bold labels, first six, in order, as labels · *Watch out*: the first sentence of the first WARNING, else CAUTION |
| Fault | *You see*: the symptom · *Most likely*: cause 1 · *Last seen*: the latest incident's day, else *never logged* |
| Ruling | *The ruling*: the summary · *Ruled*: by, on · *In force*: yes, or *replaced by …* |
| Client requirement | *Client*: the linked client · *What*: the summary · *Checked by*: the tracking's measure (§9) when one is set, else *a check by hand* |
| Part | *Client*, *Size and gauge*, *Weight*: the client's kg a piece (`prodKgPerPiece`) |
| Decision | *Chosen*: the option, else *Not yet* · *Review*: the day |
| Incident | *Day*, *Fault*, *Fix* |

A worked-out row with nothing to say is left out. The form shows the worked-out rows as the field's placeholder, so the
writer sees what is written for them.

## §3 The desk (the desktop, from 1024 px)

```
┌ Library ───────┬─ The article ─────────────────────┬─ Context ───────────┐
│ Ask …          │ FAULT                              │ At a glance         │
│ Tracking  2    │ Deposit dull or burnt at the …     │ The plant now       │
│ Recently       │ (Reader, scrolling on its own)     │ Linked              │
│ Shelves / list │                                    │ Feeds               │
│                │                                    │ Outputs             │
│ «  collapse    │                                    │ Notes               │
│                │                                    │ Tracking / Track    │
└────────────────┴────────────────────────────────────┴─────────────────────┘
```

- **Three columns**, each scrolling on its own inside `--fill-h` (the list-and-pane rule: the page never scrolls; P80 extended):
  the Library 280 px, the article `minmax(0, 1fr)` with its text at 65 ch, the context column 320 px. Under 1280 px the context
  column folds to a rail of its section icons and opens as an overlay on a tap; the Library collapses to a 56 px rail of kind
  icons on **«** (kept per device, `sep_inv_kb_desk`), like Claude Code's sessions list.
- **The middle is Reader.** *At a glance* is the context column's first section, so the desk never switches mode. Guided opens
  in the middle in place of Reader (*Follow step by step* in the article head), with *Back to reading*.
- **The phone** keeps the modes (§2) and has the context as a bottom sheet with tabs (*Context · Notes · Track*), opened from a
  bar fixed above the phone bar: *3 linked · 2 notes · Watching*. The sheet is a layer (Back closes it).

### §3a The context column, top to bottom

Each section folds; a section with nothing in it is not drawn (no empty heads). Every figure is read by the function its own
screen uses, and only for a role that opens that screen (the rule of `kbDayContextHtml`).

1. **At a glance** (§2d).
2. **The plant now**: live, by the article's links:
   - a **line**: its units working of all (`pltUnits`), today's efficiency and what moved it (`prodLineEfficiency`, its verdict
     line only), what went into its bath in 7 days (`stockEntryLines`), today's cuts (`prodDowntimeDay`);
   - a **client**: challans waiting and the oldest's days (`imWaitDays`), the turnaround against its target (`flowStats`), owed
     and pays in (money only, `grdSeesMoney`);
   - a **part**: last plated (line, day, crew where the roster is seen), kg a piece;
   - a **stock line**: level and days left (`stockReplay`, the stock screen's reading);
   - an **area**: heads against the day's number (`areaNeedTone`).
   An incident keeps *That day in the book* (its own day), drawn here.
3. **Linked**: the article's links, each a door (as now), grouped by type.
4. **Feeds**: the records the section above reads, each with how fresh it is, read as Today reads the day's inputs
   (`tdyInputsHtml`'s reading): *Register, VAT A1: today 4:10 PM* · *Stock message: 2 days ago* (warning past its usual
   minute, as on Today). This is the owner's *connector*: it says whether *The plant now* can be trusted. A feed this role
   does not open is not listed.
5. **Outputs**: what the article has led to: incidents (`faultId`), trackings open and closed (§7), training recorded on it
   (by version), rulings that replace it, decisions that link it. Each a row and a door; counts in the head.
6. **Notes** (§6).
7. **Tracking** (§7): the open tracking on this article (its state, next check, the latest verdict, *Check now*), or
   **Track this fault / process / requirement**, the one primary of the column.

## §4 The Library

- **Ask** on top: a search field that reads *Ask the knowledge base*. Until the chatbot is built (`docs/KNOWLEDGE_BASE.md`,
  *Left for the chatbot*) it is the Library's search there is (every field `kbPlain` reads), answering with the articles that
  match, best first, each with the line that matched. It is never called an answer.
- **Tracking**: the open trackings this role sees, worst first (§7j), at most three, the rest one tap.
- **Recently opened**: the last five opened on this device (`sep_inv_kb_recent`), as cards with the kind icon.
- **Shelves** (the phone's Library and the desk's when no search is typed): *Your training path* (a hero: *3 of 8 done · Next: …*,
  for a role with a path), *When something goes wrong* (faults, then processes), *Rulings*, *Client requirements*, *Using the
  app*, *Setting up*. Each shelf scrolls sideways, its head says *See all N*, which opens the list filtered to it.
- **The list** (a search typed, or *See all*): one row an article: its kind icon (32 px, `kind-ico`, inline SVG, HR-4), the
  title without *Using the app:* (that is the kicker), one line of summary, at the end one useful thing (a ruling's day, a
  draft's status, a guide's version, a tracking's state dot). Kinds as chips with counts over the list.
- The desk's left column is the same Library, narrowed: shelves become one column of cards.

The present views (Start, Library, Troubleshoot, Records, Training) stay as the page's tabs; Start takes the *Tracking* and
*Recently opened* rows above what waits; Troubleshoot opens on the faults shelf with the symptom search.

## §5 Kind icons

Eight inline SVGs, 24 viewBox, stroke icons in the app's set (`state.js` icon map): how-to (a book), process (a path between two
points), part (a nut), client requirement (a clipboard with a tick), ruling (a balance), fault (a wrench), incident (a flag),
decision (a fork). Drawn on `--surface-3`; never coloured by kind (DR-1).

## §6 Notes

`S.kb.notes: [{id, articleId, text, private, by, byId, at, editedAt, removedAt, removeReason}]` (a container, repaired by
`kbData()`; in `CHG_TRACK`, so the change log and the merge carry it).

- **Public** (`private: false`): anyone signed in who reads the article may add one; every reader of the article sees them,
  newest first, with who and when. One's own note is edited within a day; after that, and anyone's, only the owner removes it,
  with a reason (kept, shown as *Removed by the owner: …* to the owner only).
- **Private** (`private: true`): the owner's alone: written and read by the owner, never drawn for any other role, never in a
  search for another role, never in the WhatsApp text or a print. The change log records that a private note was added or
  removed, never its words (the rule for personal details and check-in notes).
- **Said plainly in the guide and on the form:** a private note is hidden by the guard on every screen, but it travels with the
  book like everything else (backups, GitHub sync, the compile). It is not encrypted. (The same is true of worker details.)
  **Owner, 15 Oct 2026:** acceptable for now; a server with its own database is planned, and private notes then live on the
  server alone, served only to the owner's sign-in (to be specified with the server).
- A note may be on a tracking too (§7f), with the same two kinds.
- At most 500 characters; through `escHtml`; the STE hint does not apply (notes are notes).
- `sep-kb` v2 export carries public notes; private notes only when the owner ticks *Include my private notes*.

## §7 Tracking

### §7a What it is

A **tracking** follows one problem or one aim through to its end, against an article: a **fault** (something going wrong now),
a **process** (a way of working the shop wants held), a **client requirement** (what a client asks of every lot). Its name on
screen is *Tracking*; its states are **Watching**, **Needs the owner**, **All clear**.

Two types, as in CareTickets:
- **Acute** (`type: 'acute'`): checked often, closed by consecutive clear checks. Most fault trackings.
- **Goal** (`type: 'goal'`): checked by a measure the book holds (§9), closed when the measure holds for so many working days.
  Process and requirement trackings, and a fault that recurs (*replating on VAT A1 under 20 kg a week*).

### §7b The lifecycle: six transitions (CareTickets', kept)

```
watching  → needs-owner   a trigger fires (§7e): the highest of those that fired
watching  → all-clear     the closing rule is met (§7g) and a person confirms; or closed by hand when the schedule is spent
needs-owner → watching    a clear check, and the owner confirms it no longer needs them
needs-owner → needs-owner a different or higher trigger (the history keeps both)
needs-owner → all-clear   the owner closes it, with a reason picked or typed (force-resolve)
all-clear → watching      reopened; after two reopens the app suggests a new tracking
```

Stored `status`: `active` · `escalated` · `resolved` (the CareTickets names, so their checks carry over); the words on screen
are the shop's. **refTime** = the latest of opened, reopened, de-escalated and escalated: consecutive clears count after it.

**The chart is drawn from the code** (CareTickets' practice): `KBT_TRANSITIONS` (`[from, to, why, fn]`) in `kbtrack.js` is the
one table; the build writes `docs/KB_TRACKING_STATES.html` from it (an SVG of the three states and six arrows, the table, and
a drift report: a transition with no function, or a function that sets a status outside the table, found by reading the
module's source for `status =`). `build.sh` writes it from `split/` alone, so the stamp stays a pure function of the sources and
`build-sync` diffs it.

### §7c Who does what (owner, 15 Oct 2026)

| Act | Who |
|---|---|
| Open a tracking | anyone signed in who reads the article and makes Floor entries or is the owner (`grdCan('floor')`) |
| Assign it to a person | the one opening it; the owner changes it |
| Check | the person assigned, the supervisor role, the owner |
| Close when the rule is met | the person assigned, the supervisor, the owner |
| De-escalate, close a *Needs the owner* one, close early | the owner (`grdGate('users')`: the PIN again past the re-ask window) |
| Reopen | anyone who may open one |
| Delete | never; a tracking opened by mistake is closed with *Opened by mistake* |

### §7d Fault trackings (release KB2-2)

- **Opened from** the fault (the context column, or *Track this fault* under its causes), an incident (*Track this*), Guided's
  *Found it* (the cause found is the first check), or a To-do task that names a line (*Line efficiency red*: *Track a fault*).
  It names the fault and its version, and asks: the **line** (from the fault's links, else picked), **acute or goal**, who it
  is **assigned to** (the supervisor by default), and an optional first note.
- **The questions are the fault's causes**, from the version it was opened on (`articleV`): each cause's *Check* becomes
  *"<check>: found the cause?"* with **No · Yes · Not checked**. A fault given a new version keeps its trackings on their
  version, and the tracking says *The fault has a newer version* with *Use it* (owner).
- **The book answers what it can** (§8): *acted on since …* beside a cause, with the entry, before anybody answers.
- **Verdict**: any *Yes* that is a trigger (§7e) → **needs the owner**; every cause *No* or acted on → **clear**; else
  **watch**. *Not checked* is never clear.
- **Closing**: acute, **3 consecutive clear checks** after refTime, on different rounds or different hours (two checks within
  20 minutes count as one); goal, the measure (§9) held for its days.
- **The cause found** is kept on the closed tracking (`causeFound`: the cause's index, or *none of these* with what was found).
  When a fault has five or more closed trackings and their causes found disagree with its order by two places or more, the
  owner's To-do gets *Reorder the causes of …* (suggested, never done: I5's rule), and *none of these* three times suggests
  *Add a cause*.
- **Guided on a fault**: cause by cause, *Not this* / *Found it*; *Found it* shows the fix, then *Fixed. Log an incident* (the
  incident form filled: the day, the fault, the cause, the fix), and, when no tracking is open, *Track it until it is clear*.
  *None of these* opens a public note to the fault.

### §7e Triggers (*Needs the owner*)

Collected all at once, the highest severity kept (CareTickets' rule). Severity: `owner` 1, `stop` 2 (*stop the line*).

| Trigger | Severity | Read from |
|---|---|---|
| The fault seen again on the same line within 7 days of the tracking's open (a new incident, or a check answering *Yes* to a cause already closed) | owner | incidents, check-ins |
| A client's lot of the line's work returned or replated (a ₹0 replating line, or rework plated, on a part the line ran in the tracking's window) | owner | invoice lines (`zeroReason: 'replating'`), production `rework` |
| The line's efficiency red two working days running while watching | owner | `prodLineEfficiency` |
| Half or more of the line's units down | stop | `pltUnits` |
| A check answers *Yes* to a cause the fault marks *stop the line* (a new optional tick on a cause, the owner's) | stop | the check |
| A process or requirement measure below its floor (§9) | owner | the measure |

### §7f Check-ins

`checkIns: [{at, by, byId, source: 'app' | 'face' | 'auto', answers: {[causeIdx]: 'no' | 'yes' | 'unchecked'}, acted: {[causeIdx]:
{kind, id}}, verdict, note, notePrivate}]`. A check is one form (the phone's sheet, the desk's column, Mine's card): the causes
with three chips each, what the book found already ticked as *acted on* (still answerable), a note (public or, for the owner,
private), **Save check**. Bool chips read their value through one parser (CareTickets' `parseBoolOrString` lesson: a
`data-value` is a string). A check within 60 seconds of the last asks first. `source: 'auto'` is a check the app writes itself
when the book alone settles every cause (§8): it says so on the timeline and needs no tap.

### §7g Closing rules (four, as in CareTickets)

| Type | Rule |
|---|---|
| `consecutive_clear` | N clear checks after refTime (fault acute: 3) |
| `sustained` | a measure (§9) passes on N consecutive working days, counting back from the last day with data; paused, never reset, on a day the measure has no data (the plant shut, the feed not in) |
| `threshold` | a measure passes; `firstMetAt` kept; held `confirmDays` working days → met; reset if it fails again |
| `manual` | the person closes it (a requirement with no measure) |

Any type may be closed by hand once its schedule is spent (CareTickets). Closing asks *Close: all clear?* with the closing note
field; the owner's force-close asks a reason: *Fixed and checked* · *Not a fault after all* · *Opened by mistake* · *Other* (typed).

### §7h Follow-ups: the To-do and Mine, never push

The app has no backend and no push; CareTickets' Notification API is not used (an installed PWA in a shop phone's background
is unreliable, and HR: no browser pop-ups).

- **Schedule** (`followUps`, working minutes from refTime, shop hours only: 8:30 AM – 5 PM and the overtime blocks the line
  ran): acute fault `[30, 120, 240, 480, 960]` (the same day, then the next); goal: once a working day. A check due and not
  made is a To-do task **`kbTrackDue`** for the person assigned (amber at due, red at a second missed), and the owner sees it
  only once red.
- **Mine**: a tracking assigned to the person is pinned at the top of Mine (owner, 15 Oct 2026), above the duties: its title,
  state, *Next check 2:30 PM* or *Check overdue*, and **Check now**. It stays pinned while open.
- **Needs you** (owner): **`kbTrackOwner`**, red, one task per tracking in *Needs the owner*, with its trigger; folds at three
  (`TODO_FOLD`).
- Missed checks pile into *Missed 3 checks* on the timeline (CareTickets' *advance to next future*), never three tasks.

### §7i WhatsApp on *Needs the owner* (owner, 15 Oct 2026: *"Yes"*; a workaround until the server sends messages itself)

When a tracking goes to *Needs the owner* on a device, the app shows **Tell the owner on WhatsApp** at once, with the message
written in the shop's shape: the fault, the line, the trigger, the last check's answers, who checked, the time. It opens
WhatsApp (`faceWaHref`, the installed app or WhatsApp Web, as the faces do) to the owner's number (Settings → Business →
*Owner's WhatsApp*, a new field; else WhatsApp opens to pick the chat). **The app cannot send it by itself**: the person taps
send. The tracking records that the button was used (`waAt`, `waBy`) and says *Owner told on WhatsApp 2:41 PM*, or, where it
was not, keeps the button on its head until it is. The owner's own device does not offer it.

### §7j Process trackings (release KB2-3)

A process is a way of working; its tracking asks whether the shop holds to it. Always `goal`.

- **Opened from** a process article (or a guide marked a process): *Track this process*, which asks the **measure** (§9: picked
  from those that fit the article's links; or *checked by hand*), its **floor** (below which it needs the owner), its **target**
  and **days to hold**, and who it is assigned to.
- **Questions** are the process's numbered steps: *"<step>: done as written today?"* Yes · No · Not seen. A *No* asks which part
  was not done (a note). The verdict reads the **measure**, not the answers (CareTickets' goal rule: answers are context).
- **Training is a measure too**: *Hands on the path trained on this version* (`S.kb.trained`, `kbVerOn`): the tracking *Train 3
  hands on pickling by 30 Oct* closes when three hands of the roster have training on the current version; a check is a
  training recorded (the training dialog writes it).

### §7k Client requirement trackings (release KB2-4)

A requirement is what a client asks of every lot (a certificate with each dispatch, a P.O. on each invoice, back within two
days). Its tracking holds the shop to it for a period, or for good.

- **Opened from** the requirement, which must link a client. Asks the measure (§9 *Client* measures), the floor and target, the
  period (*until* a day, or *ongoing*: an ongoing one never closes by its rule, only by hand, and checks itself every working
  day), and who it is assigned to.
- **Checks are the client's own records**: each invoice or dispatch to the client in the period is judged against the
  requirement where the book can judge it (§9), and listed (*SEP/26-27/00912: P.O. present*); where it cannot (a certificate
  printed: nothing is written when a certificate prints), each dispatch is a question for the person assigned: *Certificate sent
  with SEP/…/00912?* Yes · No.
- A *No* on a requirement is a trigger (§7e, `owner`): a client requirement missed is the owner's.

## §8 What the book answers by itself (*closed by actioning through the app*)

A rule per cause or step, written on the fault or process (optional, the owner's, on the article form: *The book shows this
when …*), picked from a fixed list; the app reads the book since refTime and marks the cause **acted on** with the record:

| Rule | Acted on when |
|---|---|
| `stockAdded(stockId, line)` | a `received`/`charged` entry of that stock line into that line's bath (`stockEntryLines`) |
| `unitRunning(unitId)` | the plant unit's status set to *run* (`plt` log) |
| `unitRepaired(unitId)` | the unit's status moved through *repair* to *run* |
| `noCut(line, hours)` | no power cut on the line for N working hours (`prodDowntimeDay`) |
| `effOk(line, days)` | the line's efficiency ok N working days running |
| `noRework(line, days)` | no rework plated and no ₹0 replating line for the line's parts in N working days |
| `trained(articleId, n)` | N hands trained on the current version |
| `invoiceField(field)` | every invoice to the client in the window carries the field (`poNumber`, `vehicle`) |

When every cause of a check is settled by the book (each acted on, or a measure passing), the app writes the check itself
(`source: 'auto'`) at the shop's next working hour and the tracking moves as if a person had checked. **It never closes a
tracking alone**: closing always asks a person (§7g). An entry voided after it counted withdraws the mark at the next read
(acted-on marks are worked out, never stored, except as `acted` on a check already saved, which keeps what it was shown).

## §9 The measures

A measure is a function of `(tracking, day)` returning `{value, text, known}`; unknown is never zero (the app's rule). Each
reads the function its own screen uses:

| Measure | Reads | Fits |
|---|---|---|
| `lineEfficiency` | `prodLineEfficiency(day, line).pct` | fault (goal), process |
| `reworkKgWeek` | production `rework` kg on the line, the pay week to the day | fault (goal) |
| `replatingKgMonth` | ₹0 *replating* lines' kg for the line's parts, the month | fault (goal) |
| `cutsWeek` | cuts on the line in the pay week (`prodDowntimeDay`) | fault |
| `inputOnTime(input)` | the day's input in by its usual minute (Today's reading) | process (*stock message by 10 AM*) |
| `trainedHands(articleId)` | hands trained on the current version | process |
| `turnaroundMet(clientId)` | share of the client's lines back within target, 30 days (`flowStats`) | requirement |
| `poPresent(clientId)` | share of the client's invoices in the window with a P.O. | requirement |
| `paysInTerms(clientId)` | days to pay against the client's terms (`bankDaysToPay`, `flowTerms`) | requirement (money roles) |
| `rebateNoted(clientId)` | the client's rebate batches noted within 7 days (the `cn` rule's reading) | requirement |
| `byHand` | the checks' answers alone | any |

A measure whose feed is not in for the day is *no data* that day (paused, §7g), and the tracking says which feed (§3a *Feeds*).

## §10 Data, sync and safety

`S.kb.tracks: [{id, kind: 'fault' | 'process' | 'requirement', articleId, articleV, title, type: 'acute' | 'goal', status,
line, clientId, measure: {key, args, floor, target, days}, rule: {type, count, confirmDays}, assignedId, openedBy, openedById,
createdAt, escalatedAt, deEscalatedAt, reopenedAt, resolvedAt, scheduleBaseTime, followUps, nextFollowUpIdx, lastCheckInAt,
checkIns, escalationHistory: [{at, trigger, severity}], firstMetAt, lastSustainedCount, causeFound, resolvedBy, resolvedNotes,
reopenCount, waAt, waBy, notes: [ids]}]`.

- A container in `STATE_CONTAINERS`; `kbData()` repairs it; **`kbtValidate()`** on load (CareTickets §14): every field typed or
  repaired, timestamps in the future (> 5 min) brought to now, a resolved one with no `resolvedAt` given its last check's time,
  `nextFollowUpIdx` capped, check-ins sorted, an article that no longer exists keeps the tracking (its title kept on it).
- **The change log and the merge** carry trackings record by record (`CHG_TRACK`); two devices checking the same tracking merge
  as two check-ins (the array is unioned by `at` + `byId`), and a status both changed takes the owner's, else the later, the
  other held (G4's rule). A check's private note is never compared.
- **History** lists *tracking opened*, *needs the owner*, *closed*, *reopened*.
- **`sep-kb` v2**: trackings, notes (§6) and the rest; v1 files still import. soma-internal's compile reads trackings as
  records of the shop.
- **Pruned**: closed trackings older than 365 days fold to a one-line summary on the article's *Outputs* (title, opened, closed,
  cause found, checks); the check-ins go (CareTickets pruned at 180; the shop keeps a year for its audits).
- **At most 12 open trackings**; *Track this* says so beyond it and lists the open ones.
- Every string through `escHtml`; no browser pop-up (`uiConfirm`, `uiPrompt`); HR-1 to HR-9 as everywhere.

## §11 The releases, one PR each, in this order

1. **KB2-1 · The look.** `kbParse` and the three modes; Reader's type and notices; the `*italic*` fix; *At a glance* (written
   field and worked out); landing by role; the desk's three columns and the phone's sheet; the context column without Tracking
   (At a glance, The plant now, Linked, Feeds, Outputs); the Library (Ask, Recently opened, shelves, the list with icons); the
   kind icons; Notes (public and private); the guide *Using the app: the knowledge base* to its next version and *Writing an
   article* gains *At a glance*. Spec **P219**.
2. **KB2-2 · Tracking a fault.** `kbtrack.js` (before `knowledge.js` in the build order; every new top-level name grepped first):
   the store, `kbtValidate`, the lifecycle and `KBT_TRANSITIONS` with its chart, check-ins, triggers, the book's answers for
   faults, closing, reopen, force-close, follow-ups (`kbTrackDue`, `kbTrackOwner`), Mine's pin, WhatsApp to the owner, Guided's
   *Found it* into a tracking, the cause-order suggestion, History, the guide *Tracking a fault*. Spec **P220**.
3. **KB2-3 · Tracking a process.** The measures for processes and training, step questions, the goal rules (sustained,
   threshold) with pauses, the guide's section. Spec **P221**.
4. **KB2-4 · Tracking a client requirement.** The client measures, each dispatch judged or asked, ongoing trackings, the
   requirement's link to the client's page (*Tracking: PO on every invoice · 96% · Watching*), the guide's section. Spec **P222**.

Each release: measured before and after on P195 (Knowledge's screens; the desk's middle and side columns as their own budgets),
P197's looks extended (the desk's three columns, the sheet, the step screen), P76's sweep over the new screens in both themes and
layouts, the owner's book in a scratch harness (never committed). The QA chain runs after KB2-4, as for the tab map.

## §12 What each spec proves (the first lines of each)

- **P219**: one body draws three ways; a WARNING is a filled block in Reader and Quick reference; `*Wanted*` is italic with no
  asterisk; a section's line opens Reader at that section and Back returns; a floor ID on its path lands on Guided, the owner on
  Quick reference; the desk scrolls three columns and never the page; a private note is not in the DOM, search or print for any
  role but the owner; the context column draws only what the role's screens show.
- **P220**: the six transitions and no seventh (a test reads `KBT_TRANSITIONS` against every `status =` in `kbtrack.js`); three
  clear checks within 20 minutes count as one; a brightener charge into VAT A1 marks its cause acted on, and voiding the entry
  withdraws it; the book never closes a tracking alone; a stop trigger outranks an owner trigger; the WhatsApp text names the
  trigger and opens `wa.me` with it; Mine pins the tracking for its person only; two devices' checks merge as two.
- **P221 / P222**: a measure with no data pauses and never resets; `threshold` resets on a fail; an ongoing requirement never
  closes by its rule; a dispatch the book cannot judge becomes a question; money measures are absent for a role without money.

## §13 Known assumptions (CareTickets' table, for the shop)

| # | Assumption | What would show it wrong | Fix path |
|---|---|---|---|
| 1 | Three clear checks close an acute fault | Faults reopened within a week | Raise per fault (the rule is on the tracking) |
| 2 | Shop hours are 8:30 AM – 5 PM plus the OT blocks run | Checks due at night | Read the day's blocks from attendance |
| 3 | The owner taps send on WhatsApp | *Owner told* never recorded | A second reminder on Needs you |
| 4 | Private notes hidden by role are private enough | A note seen on another device's book file | Encrypt with the owner's PIN (a later step) |
| 5 | Causes' *Check* lines read well as questions | Checks answered *Not checked* most of the time | A question field per cause |
| 6 | 12 open trackings is enough | The cap is hit | Raise it; it is one constant |
| 7 | Feeds' freshness is Today's reading | A feed fresh by time but empty | Count records, not only arrival |

## §14 Left for later

- The chatbot answering *Ask* in words (it answers from these articles; nothing here blocks it).
- Tracking a decision's review or a part (not asked for).
- A tracking shared with a client.
