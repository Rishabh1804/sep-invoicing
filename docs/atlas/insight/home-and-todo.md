---
subject: "Home arranged, quick actions, To-do"
domain: insight
modules: [split/todo.js]
specs: []
tests: [P42, P69, P121]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Home, arranged by the owner
Owner, 30 Sep 2026: *"Home screen needs an overhaul with an option to select what widget to show on the home screen and where —
dynamic home screen which user can adjust"*. They chose presets and an edit mode, kept per device (`HOME_WIDGETS`, `sep_inv_home`,
*Edit Home* on Pulse; P121). **UI pass 3 replaced it** (U2, *UI pass 3: Home and its widgets* above): the board is arranged in place
(Customise: drag, keys, size, remove), widgets are added from the gallery, the presets are by role, and the layout is kept per person
and per layout (`sep_inv_layout`). A device's Pulse layout is moved once onto the board (`wdgFromPulse`); `sep_inv_home` is left as
it is, since an older build in another window still reads it.

### Home quick actions
The *Quick actions* widget (`quick`; Pulse's since Direction B; Add is the one door for what comes in): six buttons, three at Small,
each opening its screen **already on the job**: New invoice, New challan (the form open), Stock entry (the by-hand form), Attendance
(today's day), Paste message (the one box for WhatsApp rolls — a stock message pasted there is handed to the Stock check, and the
pickling and production messages to Production's; it opens without a roster), Add task (the box focused). A role sees only the
buttons whose screen it opens. **The buttons follow the card, not the window** (UI pass 3; design §6.3): three across with each
label under its icon, six across once the card is 40rem wide, a Medium on a wide desktop. The window's rule had set six across in a
half-board card, each label beside its icon in about 85 px (P42).

### To-do
Home → **Needs you** (the To-do page joined it in the tab map, TM2a: its Add, Snoozed, Done and Learnt are Needs you's), the
*Needs you* widget on Home, and a **Windows 11 widget**. The owner's own list (owner, 25 Sep 2026:
*just me*, *both, labelled*, *Windows 11*, *in SEP Invoicing for now*, *not the phone yet*). `S.todo`
is self-contained so it can move to `sep-dashboard` whole.

- **Mine** — typed, with an optional due date, note and a link to a client / invoice / challan / stock
  line. **Ticked, never deleted**: Done keeps them and can reopen one.
- **App** — raised from the book (`TODO_RULE_FNS`): a stock line red or amber, no stock figure for 2
  working days, a credit-note batch past 7 days since the client's last note, challans unbilled after 3
  days, red at 6 (one task per client; owner, 13 Oct 2026, was 5 and 10), invoices not yet dispatched after 2 days (Created or Printed, last 30 days only), the number audit
  finding a gap, no backup (export or GitHub push) for 7 days, and — off by default — a stale zinc rate.
  Each is switchable in Settings → Checks & alerts → To-do. **App tasks cannot be ticked: they clear themselves** when the
  thing is fixed, and every one shows the figures it was raised on and what clears it.
- **A snooze is granted against figures (`sig`), never as a blanket silence** — the Areas card's rule
  for an explained exception. "Until the figures change" returns the task the moment they do. `sig` is
  deliberately coarse where a figure moves on its own: a stock line's is its colour, so it does not
  come back every time a litre is used.
- One rule failing on an unexpected shape is caught; it must not take the list with it.
- **Your own tasks lead** (owner, 26 Sep 2026: *"once I add a todo of my own, it still stays at the end of all the
  system generated one, that makes it easy to miss"*). `todoRanked()` (Needs you, Home's *Needs you* widget, the Windows widget) puts every
  open task of yours ahead of every raised one that is not red. Only a red task outranks yours; between two red ones, yours comes first. Ranked by tone alone,
  an undated task of yours had no tone and fell below every info task the data raised (P69).

**The widget cannot be the app's HTML.** Windows draws an Adaptive Card (`widgets/todo-template.json`)
from data the service worker hands it. The rows are worked out **by the app** (the app tasks need the
whole book) and written to a small database of their own, **`sep-invoicing-widget`** (`payload`,
`queue`) — the worker never reads or writes the book. **Both directions run on open and on close**
(owner, 25 Sep 2026): the payload is written after a save and whenever the page is hidden or shut; a
**Done tapped on the card** is queued, dropped from the card at once, and applied when the app is next
shown (or at once if open, by message). The queue is read and emptied in one transaction, and the
payload is only written after the queue is applied, so a tick cannot be lost or come back. Tapping a
row opens `?tab=pageHome&v=needs&todo=open:<m|a>:<id>`; Add task opens `&todo=add` (an older `?tab=pageTodo` address is
redirected there, `navRedirect`).

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
