# The Knowledge Base

**Agreed with the owner, 2–5 Oct 2026.** *"I envision it as a training ground, as a troubleshooting area, as a record keeper,
as a tool used to make decisions."* The chatbot is the next piece of work after this one, and it answers from what is built here
(`docs/UX_OVERHAUL_2.md`: *"search now; a chatbot later, once a knowledge-base tab exists"*).

**Where it is:** Office → Knowledge (the last of Office's Insights; Insights → Knowledge until 8 Oct 2026, when Insights became
a group in Office's row and the desktop's sidebar a rail of the workspaces alone), and the book in the top bar on every screen, which opens
the guides for the screen on show. It was Insights' fourth view because a group of its own made the sidebar taller than a
1024 × 768 screen.

## §0 What is built

**K1–K4 are built (5 Oct 2026, one PR):** the store and page, writing and approval, versions, retire, roles, photos on the device,
search, `sep-kb` export and import; the app's own guides and the links into a client, Performance, a part and a stock line; faults and
incidents with the day's context; training paths, records and due-again; decisions with live figures and review; the three To-do rules.
**K5:** 142 drafts handed to the owner as a private `sep-kb` file, audited and handed over again corrected the same day
(`sep-kb-2026-10-05-r2.json`, which replaces the first). **The QA chain of 5 Oct 2026** is folded in (P155; CLAUDE.md, *The knowledge
base*). **Not yet:** links on an area card and a production run; paths edited in the app (they arrive by import).

## The owner's decisions

| Question | Ruling (5 Oct 2026) |
|---|---|
| What it holds | **All five kinds**: rulings, how-tos, the process, clients' requirements, parts. More may come later. |
| Where it lives | In the book (`S.kb`), never in the build: this repo is public. **soma-internal owns the rulings** (the app is a view and an input, export and import, as with stock); **the app owns what is written in it** (how-tos, faults, incidents), and soma-internal gets a copy at each compile. |
| Linked to records | **Yes**: an article attaches to a client, a part, an area, a stock line, a line or a screen, and shows there. |
| Who reads what | **Each article says which roles read it** (the guard's roles; none set = everyone). |
| Rulings | **Records**: who ruled, when, why, what they replace. Never edited, only superseded. |
| Language | **English only.** |
| Who writes | **Anyone signed in may write or propose a change; it waits for the owner's approval.** |
| Photos | **Kept on the device that took them**, never in the book. |
| First content | **Drafted by Claude** from what is already written (CLAUDE.md, soma-internal's decisions and operations notes), as drafts for the owner to review. |
| The chatbot | **After this.** |

## The four uses, and what each needs

**Training ground.**
- **Paths by role**: an ordered list of lessons (*New on the floor*, *New in the office*, *Supervisor*).
- **Training is recorded against the roster, not against logins**: most hands have no ID. Whoever is signed in records
  *a hand was trained on Pickling safety, 5 Oct, by the supervisor* (`S.kb.trained`). With the guard off it is recorded by the device.
- **A lesson that changes asks for the training again**: a record names the version it was given on, and a newer version
  makes it *due again* (the To-do snooze's rule: granted against figures, never as a blanket).
- **A short check** at the end of a lesson (two or three questions, optional), its score kept with the record.

**Troubleshooting.**
- **A fault**: the symptom, then likely causes in order, each with the check that confirms it and the fix.
  Reached by symptom (*Troubleshoot* lists them), by search, and from the part, line or bath it names.
- **An incident**: what happened on a day, to which part, client or line; the cause found; the fix; which fault it was.
  It draws **what the app already knows about that day** beside it: who plated the part and on which line (`prodCrew`), the
  stock added to the baths, power cuts, the challans and invoices of the part. Nothing is copied; it is read each time.
- A fault lists its incidents, so the shop's own history builds up under each symptom.

**Record keeper.**
- **Rulings**, **client requirements** and **incidents** are dated records with an author.
- **Every published article keeps its versions**: an edit makes a new version, and the old text stays readable with who
  changed it and when. A ruling is never edited: a new ruling replaces it (`supersedes` / `supersededBy`), and both stay.
- An article is **retired** with a reason, never deleted (the void rule).

**Decision tool.**
- **A decision**: the question, the options with the case for each, **figures read live from the book**, what was decided,
  by whom, why, and **a date to review it**. The figures it was decided on are kept with it, so the review shows *then* beside
  *now*.
- A To-do task asks for the review when its date comes. What to do's moves can open a decision draft on their question.

## The data contract

`S.kb = { articles: [], trained: [], paths: [], deleted: [] }` (a container in `STATE_CONTAINERS`, repaired by `kbData()`).
`deleted: [{id, at, by}]` names each draft deleted here, so an import of an older file does not bring it back.

**An article**:
- `id` (an import's ids are deterministic: `kb-` + a hash of its source), `kind`, `title`, `summary` (one line), `body`
  (the shop's own text: paragraphs, `-` lists, `#` heads, `**bold**`; drawn through `escHtml`, never as HTML), `tags`
- `kind`: `guide` (a how-to or lesson) · `process` · `part` · `requirement` · `ruling` · `fault` · `incident` · `decision`
- `links: [{type, id, label}]`, `type` one of `client`, `part`, `area`, `line`, `stock`, `screen`, `worker`, `article`;
  `label` is the name as written, so a link to a record this book does not hold still reads (matched on its letters and digits).
  An article link keeps no label: its title is read live, for a role that reads it
- `roles`: `[]` everyone, `['owner']` the owner alone, else the owner and the roles named (`office`, `supervisor`, `floor`);
  `status`: `draft` · `pending` · `published` · `superseded` · `retired`
- `version`, `versions: [{v, at, by, title, summary, body, …the kind's fields}]` (what each published version said)
- `by`, `byId`, `at`, `approvedBy`, `approvedAt`; `retiredAt`, `retireReason`; `editedAt` (saved here), `importedAt` (taken from a file)
- `src`: `app` · `import` (with `srcRef`, where it came from in soma-internal)
- `images: [{id, w, h, caption}]`: the picture is in the device's own store (below), the article holds only its id
- by kind: `ruledBy`, `ruledOn`, `supersedes`, `supersededBy` (ruling); `symptom`, `causes: [{cause, check, fix}]` (fault);
  `on` (the day), `faultId`, `cause`, `fix` (incident); `question`, `options: [{label, case}]`, `chosen`, `reason`,
  `figures: [{key, args, then, at}]` (each read once, when put on the decision), `reviewOn`, `reviewed: [{at, by, note}]`
  (decision); `quiz: [{q, options, answer}]` (guide)
- **A proposal** (a change by anyone but the owner): `pending: {by, byId, at, v, title, summary, body, fields}` on a published article
  (`v` the version it was written on; it never carries who reads), or a new article in `status: 'pending'`. The owner **Approves** (it
  becomes the next version; over a later version it asks first) or **Declines** with a reason (`declined`, shown to the owner and the
  writer). One proposal at a time: another person's waits until it is approved or declined.

**Training**: `S.kb.trained: [{id, staffId, name, articleId, v, on, at, by, score, note}]`, `v` the version on the day `on`. A lesson is
a live how-to, process or fault. **Paths**: `S.kb.paths: [{id, title, role, articles: [ids]}]`; a book's path for a role replaces the
app's for that role.

**Photos**: a database of their own, `sep-invoicing-media` (store `images`, keyed by the SHA-256 of the shrunk JPEG, 1,600 px at
most). Never in the book, so never in a backup, a sync or the compile: on another device an article says *photo kept on another
device*.

**The app's own guides are in the build** (`KB_APP_GUIDES`, `kbguides.js`): how to use each screen. They describe the app, so
they move with it and can never be out of date; they hold no data of the shop. Read-only, `src: 'build'`, and counted in paths
and training like any other lesson.

**`sep-kb` v1 export and import** (the owner's; import asks the PIN again): articles, training records, paths and `deleted`. The file
is cleaned whole first (every field as the app draws it, or left out; ids the app does not make, and the app guides' ids, refused).
Import merges by id: a newer `version` replaces an older one (the old is kept in `versions`); the same version moves a status on (a
retirement, a replacement); what was retired, replaced or deleted here is not brought back, and a draft edited here keeps the edit; a
local proposal is kept and a file's proposals stay on their device; training is matched to the roster by name; a published ruling
that replaces another here supersedes it. Nothing is deleted.

## Screens

**Knowledge**, a page of its own (`pageKnow`), Insights' fourth view; on every screen the book in the top bar beside search. Five views:
- **Start**: your path and what is due, proposals waiting for the owner, decisions due for review, the latest changes.
- **Library**: every article the role may read, by kind, searchable; the article opens beside the list on the desktop.
- **Troubleshoot**: faults by symptom; an incident is logged from here.
- **Records**: rulings, incidents and decisions in date order.
- **Training**: paths, and the roster against them (trained, due again, not yet).

**Links into the app**: a client's detail, a part, a stock line, an area card, a production run and the line pages show the
articles linked to them; each screen's head has a *How* link to its guides. Search finds articles; a role finds only what it
reads.

**To-do rules**: proposals waiting (the owner's), a decision due for review, training due again.

## Steps (one PR, one commit each)

1. **K1 · Store and page.** `S.kb`, the page and its views, the article form for every kind, proposals and approval, versions,
   retire, roles, photos on the device, search, `sep-kb` export and import.
2. **K2 · Links and the app's guides.** Articles on the records they name, *How* on every screen, `KB_APP_GUIDES`.
3. **K3 · Troubleshooting.** Faults by symptom, incidents with the day's context.
4. **K4 · Training and decisions.** Paths, training records, checks, due again; decisions with live figures and review; the To-do rules.
5. **K5 · First content**, built privately from soma-internal and handed to the owner as a `sep-kb` file, every article a draft.

## Left for the chatbot

The articles are plain text with kinds, links and roles, and the search index already lists what a role may see: that is what the
chatbot will answer from. Which AI, its key, its cost and what may be sent out are decided then.
