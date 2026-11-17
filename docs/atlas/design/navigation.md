---
subject: "Navigation: addresses, the trail, long lists, list and pane"
domain: design
modules: [split/nav.js]
specs: [docs/UX_OVERHAUL_2.md]
tests: [P55, P80, P100, P101, P103, P147, P153, P269, P270]
updated: 2026-11-17 (a form's own way out is a step back, P269; P270: the navigation sweep)
---

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
  screen that shows its Save in the action bar (the challan form, a paste check, Enter by hand). Back asks (Stay puts the browser back on the form's step), and so does a **tap that leaves** — the phone bar
  (the form's own screen included, whose redraw drops the form), the sidebar, a screen in the More sheet, a view tab, a
  sub-view's back button — and a swipe (owner, 29 Sep 2026: *"that's a real bug"*; only Back asked, and a tap dropped a
  half-typed challan). The tap is caught before `events.js` sees it (`NAV_LEAVE_ACTIONS`, a capture listener in nav.js)
  and runs again on Leave. **Create asks nothing**: its form stays as typed when the app leaves it. P103.
- **A form's own way out is a step back** (`navReturn`, 17 Nov 2026): Stock's and Production's Back, the hand form's Done and a
  correction saved go to the screen the form was opened from, and where that screen is the step before (over any layer shut on the
  way, the toolbar's More among them) the browser is taken back to it rather than given a new step. Pushed, the form stayed under it
  and the phone's back opened it again, empty; Power's *Enter a cut* came back as Production's plain hand form. A form opened from
  anywhere else still pushes its way out. P269.
- **IM's two lists are view tabs**: *Awaiting invoice* (the default, a part-invoiced challan included) and *Invoiced*,
  which goes back a month at a time by challan date (`imSetTab`, `imMonthShown`). A link to a challan opens the tab and
  month it is under (`imShowChallanTab`). **Swiping** follows the phone bar and then More in its order
  (`MORE_TABS`): its own list had left Finance out. P100, P55.

**A long list shows its first rows, and a card taller than a screen folds** (UX overhaul 2, step 6; owner, 29 Sep 2026:
*"clients detail is also one of those screens - Mehta and [another client] scroll too far because they have many material IDs"*).
Measured on the real book, the long screens were long because each put a finished or historical list at full length:
SSS Mehta's Materials ran 23.5 phone screens (101 stopped parts), the bank statement 18. `uiMoreHtml` (state.js) draws a
list's first thirty rows (ten where each row is a question) and one row, *Show 71 more parts · 101 in all*, that shows the
rest in place; the rest are drawn `hidden` and never wrapped (a wrapper makes every row its container's last child and
the dividers vanish), a group head goes with the row under it, and the head's count and every total cover the whole.
`uiFoldHtml` folds a card to its head, remembered per device (`sep_inv_folds`). **One fact, one screen**: the bank's
wage legs live in People → Pay (folded, open when a leg is off its slip), and Money → Payments keeps one line that opens
them (the To-do's wage tasks go there too, `todoGo` kind `payWages`). The before-and-after table is in
`docs/UX_OVERHAUL_2.md` step 6. P101.

**The desktop's list and pane reach four more screens, and a wide screen takes three columns** (UX overhaul 2, step 7, 2 Oct
2026). Money → Receivables, Production → Entries, People → Roster and History are a list beside the open record (`recvHost`,
`prodEntriesHost`, `attRosterHost`, `historyHost`; the open one in `_bankOpen`, `_prodEntryOpen`, `_attRosterOpen`,
`_historyOpen`, each the address's `id`, a History event's id its `historyEvKey`: what it is, when and the record it names, never a
change's words, which name a user who can be renamed; two alike are numbered in order). A redraw keeps where the list and the open
pane were scrolled (`paneScrollKeep`; the host's `data-open` says which record, and the pane keeps its place only while that record
is open). The phone is unchanged: a client still opens under its row, a worker their sheet, a History row the invoice. **A role
that may not see wages sees no rate on the roster** (`grdSeesWages`; the rows showed it to every role that could open Staff). Above
a 100rem window the `inv-panels-3` grids (Finance's Overview; Stats' until U3, whose Dashboard is a board; Pulse's questions and widgets until UI pass 3, whose board has its own grid) are three columns, and every
panel in a grid is a `panel-w` container, so a strip of tiles never leaves a blank cell (the Home widgets' rule, now every
panel's); every other grid stays two across, since three left a column empty or a lone card under a row. P147, P80, P153.

**The navigation sweep (P270, 17 Nov 2026).** Screens added after the navigation step had no line in `navLoc` / `navApply`, so Back,
a reload and a link did not know them:
- **Production → Photos**: the photo being tagged is the address's `id` (`v=photos&id=FP…`) and Areas is `v=photos/areas`
  (`fphNavSub`, `fphNavApply`, floorphotos.js). Opening either was no step: Back left Production for the screen before Photos and
  the photo stayed open behind it. Their ways back (`invFphClose`, `invFphList`) are sub-view back buttons in `NAV_LEAVE_ACTIONS`,
  so typed work asks first; a photo opened, closed or the areas saved start clean (`_pageTyped`).
- **Production → Lines**: the line on screen is its view (a tap on it opens at its top, as a view tab does), so it is in the address:
  `v=lines/pickling`, `lines/vat-a2`, `lines/barrel`; the first line is plain `v=lines`, as before. A reload on Pickling had come back
  on VAT A1, and Back did not walk the lines.
- **Production → the register photo's check** (and its reading) is `v=<view>/photo`, as `tabs.js`' form parts already expected: Back
  from it left Production for the screen before, and the photo stayed held, so the next one picked waited unread. Back now comes to
  the view the photo was picked on and drops the photo, as the check's own way back does; a reload, with no photo to show, opens the view.
- **Back comes back to the rows a screen was left at.** The redraw a move makes put every screen at its top, the browser's own restoring
  having run before it. The scroll is read at the touch, click or key that moves the app (`navLeaveMark`, before anything moved), kept on
  the step it left (the trail, `y`), and put back after `navApply` on Back or Forward (`navScrollTo`). A move forward still opens at the top.
