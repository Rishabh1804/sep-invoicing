---
subject: "Interaction rules: pop-ups, forms, dialogs, selects, scroll"
domain: design
modules: [split/events.js, split/state.js]
specs: []
tests: [P76, P78, P79, P80, P92, P117]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

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
  preview). **People → Pay** keeps the last payment's date (within the week) and kind. **Money → Payments → Not yet sorted → Sort**
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

**A list-and-pane screen never scrolls the page on the desktop.** Register, IM, Clients → Clients / Items / Quotations, Stock →
Lines, Pipeline, Money → Receivables, Production → Entries, People → Roster and History fill the room under their own head exactly: the page is a flex column `var(--fill-h)` tall (`100dvh` less the
desktop bar and, where it shows, the workspace's tab row under it), and the `inv-pane-host` and every wrapper above it take what is left, so the list and the pane each
scroll inside themselves. The host used to be `100vh - --bar-h` — the *phone* bar, with the page's padding, tabs and
toolbar ignored — so every one of those screens scrolled 78–222px on top of the list and the wheel moved the page.
P80 measures each with the pane closed and open at 1280×800 and 1024×768; the long documents (Home, Stats, Finance,
Staff, To-do, History) are meant to scroll and are not checked.

**A selection must not outlive the filter that hid it.** Register and IM both had rows that
stayed ticked after they left the screen, with every bulk action still reaching them.
`captureRegFilters()` and `captureIMFilters()` clear it; the register search binds its own
listener and has to do it too.
