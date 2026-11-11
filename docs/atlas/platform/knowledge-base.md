---
subject: "The knowledge base, both editions"
domain: platform
modules: [split/kbguides.js, split/kbread.js, split/knowledge.js]
specs: [docs/KNOWLEDGE_BASE.md, docs/KNOWLEDGE_BASE_2.md]
tests: [P139, P154, P155, P218, P219]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### The knowledge base
The top bar's book, on every screen (a tool since the tab map of 9 Oct 2026; Office's Insights' last view before it) (`knowledge.js`, `kbguides.js`; owner, 2–5 Oct 2026: *"a training
ground, a troubleshooting area, a record keeper, a tool used to make decisions"*). The plan and the owner's rulings are
`docs/KNOWLEDGE_BASE.md`. P154.
- **In the book, never in the build** (`S.kb`: `articles`, `trained`, `paths`): this repo is public. The one exception is the app's own
  guides (`KB_APP_GUIDES`): how to use each screen, read-only, `src: 'build'`, holding nothing of the shop. **soma-internal owns the
  rulings**; the app owns what is written in it. `sep-kb` v1 export and import (here or Add → File), merged by id: a newer `version` replaces an older one,
  which is kept in `versions`; nothing is deleted; photos never travel.
- **Eight kinds** (`KB_KINDS`): how-to, process, part, client requirement, ruling, fault, incident, decision. Five views: Start, Library,
  Troubleshoot, Records, Training. The desktop's Library, Troubleshoot and Records are a list beside the open article (`kbHost`).
- **Who reads**: an article names its roles (`kbCanRead`): `[]` is everyone, `['owner']` the owner alone, else the owner and the roles
  named. The form ticks the roles; all ticked is everyone, none ticked the owner only (`kbRolesFrom`). Knowledge is every role's page
  (`grdSees`), search lists only what the role reads. A draft is its author's and the owner's; a proposed change its writer's and the owner's.
- **Who writes**: anyone signed in. What anyone but the owner writes waits (`status: 'pending'`, or `pending` beside a published article);
  the owner approves (the next `version`, the old one kept) or declines with a reason. With the guard off everyone is the owner. Who may
  edit what is one rule (`kbCanEdit`), read by the button, the address and the save alike.
- **Records**: a published article keeps every version; a ruling is never edited, a new ruling replaces it (`supersedes` /
  `supersededBy`, both kept); an article is retired with a reason, never deleted; only a draft never published is deleted.
- **Photos stay on the device** (`sep-invoicing-media`, keyed by the SHA-256 of the shrunk JPEG, 1,600 px): never in the book, a backup or
  a sync. Another device says *photo kept on another device*.
- **Troubleshooting**: a fault is the symptom and its causes in order, each with its check and fix; an incident names its day and fault and
  draws **that day as the book has it** (`kbDayContextHtml`: the plating of its part or line with the crew, the stock in and into the
  baths, power cuts, heads on site), read each time.
- **Training** is recorded against the roster (most hands have no ID), against the version the lesson was at on the day taught
  (`kbVerOn`): a newer version makes it **due again**. A lesson is a live how-to, process or fault. Paths are the book's, and the app's
  (`KB_APP_PATHS`) for a role the book has none for; a path counts the hands it is for (`kbPathWho`: floor or office by `onFloor`).
- **Decisions** keep the figures they were taken on (`KB_FIGURES`, read live: realisation, a client's ₹/kg and tonnage share, revenue,
  tonnage, live cost, power cuts; money figures only for a role that sees money) beside *now*, and ask for a review on their day.
- **Linked**: an article links to a client, part, area, line, stock line, screen, worker or article (by id, or by the name as written,
  matched on its letters and digits, `kbNameKey`); a client's detail, Performance, a part and a stock line show what is linked to them
  (`kbLinkedHtml`); the top bar's book opens the guides for the screen on show (`kbHelp`), on the desktop too.
- **Text**: paragraphs, `- ` lists, `1. ` numbered lists, `# ` heads and `**bold**`, every character through `escHtml` (`kbBodyHtml`).
- **Written in Simplified Technical English, 80% of the way** (owner, 14 Oct 2026: *"For all knowledge base documents, let's use the
  Aircraft Maintenance Manual standard … ASD-STE100 Simplified Technical English … follow it 80% of the way"*;
  `docs/KNOWLEDGE_BASE.md`, *The writing standard*). A step is one instruction in the imperative, 20 words at most, a description 25;
  active voice; a condition before its step; one word one meaning; numbers in digits; a WARNING before a step that can lose data or
  money. Kept as they are: the app's labels in bold, the shop's terms, every fact. Every app guide was rewritten to it (its next
  version), the guide *Writing an article* (`app-writing`) states it, and the article form's hint says it. A new guide is written so. The Library lists the shop's own articles by kind first and the app's guides
  after them as one group (*The app's guides*), its first thirty rows shown: 32 guides had led it and hidden what the shop wrote.
- **The setup guides** (owner, 14 Oct 2026: *"These (print, github, etc.) should be knowledge base documents"*): *Setting up: the
  office printer*, *GitHub sync*, *a new device* and *IDs, PINs and roles* (`app-printer`, `app-sync`, `app-devices`, `app-guard`),
  each opened from its Settings section (`guide` on the section, `_settingsGuideHtml`, `settingsGuide`: Settings shuts, asking about
  an unsaved section, then the guide opens). They name no printer, repository or person. P218.
- **To-do**: `kbPending` (the owner's approvals), `kbReview` (a decision due), `kbTrainDue` (training due again).
- **First content**: 142 drafts written from soma-internal (60 rulings, 24 client requirements, 14 parts, 31 process, 13 faults, 3 paths),
  handed to the owner as a private `sep-kb` file; every article a draft, with its `srcRef`, for the owner to read and publish. Audited
  the same day (51 findings: two figures a ruling had withdrawn, a rebate readable by every role, every date a year early) and handed
  over again corrected (`sep-kb-2026-10-05-r2.json`), which replaces the first.

**The QA chain of 5 Oct 2026** (owner: *"Run QA chain and merge when ready"*). Four audits (the guard and privacy, the store, the screens
and navigation, the first content) and a harness pressing every action on both layouts; each finding has its test in P155, which fails
on the build before. What it leaves as rules:
- **Every move inside Knowledge is a step** (`kbGo`: the place left is read first, then the state the address does not carry is set,
  then the step is pushed): view tabs, Write and Edit, the book, the drafts, a path, the To-do's jump. They had changed the state and
  then opened the place, found themselves there, and wrote over the step they came from. A back button with no step before it (an
  address opened as it is) closes to the view. The book asks before leaving a typed form (`NAV_LEAVE_ACTIONS`); a door to an article
  from a dialog holding typed work asks first (`dialogsTypedAsk`); the form is left with its page (`kbLeave`, tabs.js), and belongs to
  whoever opened it (`uid`, `kbFormOk`), never handed to the next to sign in.
- **An address is no door around the rules**: the edit address opens a form only where `kbCanEdit` allows it, else the article.
- **A save looks again** (`kbSave`): an article published, replaced, retired or deleted meanwhile, or someone else's change now waiting,
  is said, never saved over; one changed meanwhile asks.
- **A proposal never changes who reads**, names the version it was written on (`pending.v`; approving it over a later one asks), shows
  every field it changes (`kbShowProposal`), and a second person's is refused while one waits. The owner's Edit is of the article as it
  stands. A decline is shown to the owner and its writer, and goes when the article is published or changed. Retire takes the waiting
  change with it.
- **A ruling replacing one already replaced replaces the one in force** (`kbSupersede` follows the chain); a retired one stays retired.
- **The decision picked is the option picked**, wherever blank options fall; a figure is read once, when it is put on the decision.
- **An import is cleaned before it touches the book** (`kbCleanArticle`: every field as the app draws it, or left out; an id the app does
  not make, or an app guide's, refused; a role written as text is that role), then merged: a status moves on at the same version; what
  was retired, replaced or deleted here is not brought back (`S.kb.deleted`, a draft deleted here); a draft edited here since it came in
  keeps the edit (`editedAt` after `importedAt`); training is matched to the roster by name; a ruling the file publishes over another
  supersedes it.
- **Owner-only**: approve, publish, retire (asked again with the PIN), a review, export, import (asked again), deleting another's draft
  (asked again). Training is a floor entry made against the roster.
- **What an article draws from the book follows the role's screens**: the roster and training log with People or Floor
  (`kbSeesRoster`), an incident's plating with Production, its stock with Stock, its cuts with Power, a client's figures with Clients; the
  link pickers likewise; an article's title only for a role that reads it (links, a fault, the ruling replaced, the training log, the
  trail).
- **The To-do's knowledge tasks are worked out for the whole book** and shown by need (`TODO_RULE_NEED`: `owner`, `floor`, `roster`).
- **On the desktop** one primary between the list and the open article (the toolbar's steps aside), the search and chips above the
  scrolling list, the open row `aria-current`, an article's row opening in a new window on a Ctrl+click (`kbLocOf`), and an article
  opened from Start or Training opens on its own list's view (`kbTabFor`).
- **A late focus never pulls the cursor back** (`focusSoon`, state.js: Create's client search and the challan form's, 100 ms after
  they open): skipped when a click or tap went elsewhere first, or another field took it. On a slow CI runner it pulled the cursor
  back, and P139's C, then its ?, were typed into the search.

### The knowledge base, second edition (KB2-1)
`docs/KNOWLEDGE_BASE_2.md` (owner, 14–15 Oct 2026: *"lots of blocks of texts … weak visual hierarchy"*), release KB2-1, `kbread.js`. P219.
- **One body, three ways** (`kbParse`: sections by `# `, paragraphs, `- ` and `1. ` lists, notices; drawn by `kbQuickHtml`, `kbReaderHtml`,
  `kbGuidedHtml`): **Quick reference** (the head, *At a glance*, a WARNING, a line a section opening **Reader at that section**), **Reader**
  (a manual page: 16 px on 1.7, a step a numbered item, no tick box; WARNING / CAUTION / NOTE filled in their tone; `*italic*` drawn, its
  stars had printed; a screen's path, *Office → Challans*, one link, `kbPathGo`, trimmed to what the app can place) and **Guided** (a step a
  screen, a bar of segments, *Good to know* and **Record training** at the end; a fault's causes in order, **Found it** logging an incident
  with its cause and fix). `kbBodyHtml` draws the same words for versions and proposals.
- **The mode is in the address** (`v=<view>[/s-<shelf>][/<mode>[/<section>]]`, `kbModeV`; the spec's `m=` was not needed) only where it is
  not the article's landing, so Back walks Guided → Reader → Quick reference. **The landing** (`kbLandMode`): the desk reads; on the phone
  Quick reference, Guided for a supervisor or floor ID on a lesson of their path not yet trained on its version. A save opens Reader.
- **At a glance** (`kbGlance`): written (the form's *At a glance*, up to four `Label: value` lines, `glance` on the article and its
  versions and imports) or worked out by kind (`kbGlanceWorked`: a how-to's *Where*, *You tap*, *Watch out*; a fault's symptom, first cause,
  last incident; a ruling's ruling, who and when, in force; …). The form shows the worked-out rows as its placeholder.
- **The desk** (`kbDeskHtml`, desktop): the list on the left (shut to a rail of kind icons on «, `sep_inv_kb_desk`), Reader in the middle,
  the context on the right (`kbCtxSections`: At a glance, *The plant now* by the links, Linked, *Feeds* as Today reads its inputs,
  *Outputs*, Notes), each scrolling inside `--fill-h`; under 80rem the context is a rail opening over the article. **The phone** has the
  context in a sheet (Context · Notes) from a bar over the phone bar; an incident's *That day in the book* is its context.
- **The Library** leads with **Recently opened** (`sep_inv_kb_recent`) and **shelves** (*When something goes wrong*, Rulings, Client
  requirements, the shop's how-tos and parts, decisions and incidents, *Using the app*, *Setting up*), each **See all** (the shelf in the
  address) and **Every article**; a search (**Ask**) is best first (the title, then the summary) with the line that matched. Rows and cards
  carry the kind's icon (not on Start); an app guide's kicker (*Using the app:*) is its row's meta.
- **Notes** (`S.kb.notes`, `kbNotesOf`): public (anyone who reads the article adds one, edits their own within a day) or the owner's
  private ones, never drawn, searched or printed for any other role; the owner removes one with a reason. The change log names a note,
  never its words. `sep-kb` export is version 2 with the notes, the private ones only when the owner says so; an import merges them by id.
- The guides *Using the app: the knowledge base* (v4) and *Writing an article* (v2: CAUTION and NOTE, At a glance) say how.
