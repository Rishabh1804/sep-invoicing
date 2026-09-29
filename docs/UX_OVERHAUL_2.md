# UX overhaul 2: desktop use, search, how much each screen shows

Agreed with the owner, 28 Sep 2026. **Planning document: steps 0 and 0b are built, nothing else is.** One PR per step, in
this order: **the version guard (2) now comes before navigation (1)** (owner, 29 Sep 2026), since two copies of the app
open today (the installed app and a tab) already overwrite each other's saves; and IM's view tabs move into navigation. After it, the second batch: Home previews (parked in `NEXT_SESSION.md`) and the daily flow.

## Why

Measured on the real book (the 11 Sep backup and the 18 Sep bank statement, loaded locally, counts only), the long
screens are long because each puts a finished or historical list at full length under the few rows that need the
owner. "Screens" is scroll length ÷ the viewport (727px on the phone, 720px on the desktop test window).

| Screen | Phone | Desktop | What fills it |
|---|---:|---:|---|
| IM | 97 | list pane 52 | 8 challans awaiting invoice, then all 1,163 invoiced ones |
| Clients → Performance | 23 | 16 | the Materials card: every part the client ever sent |
| Finance → Bank | 18 | 16 | the whole statement |
| Staff → Pay | 10 | 8 | *Wages paid, from the bank* (4.8 screens) under the payout and due cards |
| Finance → Payments | 7 | 5 | the same *Wages paid, from the bank* card again |
| Stats → Clients | 6 | 4 | five cards of 1–1.5 screens each |
| Register | 6 | list pane 3 | the invoice list |
| Finance → Receivables | 5.5 | 3 | *Receipts with no client* (3 screens) under *Owed by client* |
| History | 5.6 | 3 | the activity log (4,903 events) |

Everything else is about three screens or less, Home included. **Finance → Overview was not measured** (the app
reopened the tab last used); measure it at step 6.

## The rules for how much a screen shows

1. **What needs the owner leads.** Finished records sit in their own view tab or a folded section.
2. **A long list shows its recent part**: the latest month, or the latest 30 rows, with *Show more* or a month pager.
   Totals and counts always cover the whole.
3. **A card taller than one screen folds to its summary line**, and what was opened is remembered on the device.
4. **One fact, one screen.** Where two screens carry the same card, one keeps it and the other links to it.

## Decisions (owner, 28 Sep 2026)

- **IM**: *Awaiting invoice* and *Invoiced* become view tabs, Awaiting the default; *Invoiced* goes back month by month.
- **The bank wage card lives in Staff → Pay** (beside the payroll it checks). Finance → Payments keeps a one-line link.
- **Every screen can open in a new window**, and **windows may edit**: the version guard (step 2) is built first.
- **Search now; a chatbot later**, once a knowledge-base tab exists. The search index is built so the chatbot can use it
  to find what to answer from; the AI service, its key, cost and what may be sent out are decided then.
- **Backspace goes back** through the screens visited, with a trail on screen.
- **The screens to shorten**: the Finance tabs, IM, Register, and any screen with too much scroll.

## The steps

0. **Built.** IM's and the Register's selection bar on the phone. Both were drawn after the last row of the list
   (97 screens down on IM), so *Create invoice* could not be reached from IM on the phone. They stay above the bottom
   bar now (P91).
0b. **Built.** A dialog holding typed work asks before a tap outside or its × closes it (owner, 29 Sep 2026: a tap
   outside the box lost everything entered). Keep editing is the default; Cancel and a save close as before (P92).
1. **Navigation** (after step 2), with IM's *Awaiting invoice* / *Invoiced* view tabs. Swiping between screens skips
   Finance today; fixed here.
   - Every screen and record gets an address: `?tab=`, which the app already reads at launch, extended to view tabs
     and records.
   - Every move is a step in the browser's history, so the browser's back, `Alt+←`, the phone's back gesture and
     Backspace all walk one trail. Today moving between screens records nothing, so the phone's back leaves the app.
   - Backspace counts only when no field has focus; leaving a form with unsaved changes asks first (`uiConfirm`).
   - A back arrow in the top bar, and on the desktop the trail beside it (`Home › IM › Challan 301`), each part a link.
2. **The version guard.** Each window holds the whole book and saves it whole, so today a second window would silently
   overwrite the first window's save.
   - The saved copy carries a version. A save from a window holding an older version is refused, the window reloads
     the current copy, and it says so (`uiNotice`). The same guard GitHub sync already gives a blind overwrite.
   - After a save, the other windows are told (`BroadcastChannel`) and reload and redraw at once.
   - A form half-typed in a window when another saves keeps what was typed, and says the book changed underneath it.
   - GitHub auto-push runs in one window only (the Web Locks API picks it), or two windows push against each other.
3. **Open in a new window**, on every screen (desktop): Ctrl+click or middle-click on the sidebar, view tabs and rows,
   and an *Open in new window* item. The installed app opens it in its own app window. Hidden on the phone.
4. **Search.**
   - One index: invoices, challans, clients, parts, workers, stock lines, bank rows.
   - `Ctrl+K` or `/` on the desktop, an icon in the top bar on the phone.
   - Numbers match whole (`834` finds challan 834 and invoice 00834, not 8341); amounts match exactly (`5902.12`); a
     cheque number finds its deposit.
   - Results grouped by kind, arrow keys and Enter, recent items before anything is typed.
5. **Keyboard.** `N` new invoice, `C` new challan, `G` then a letter to jump (`G R` Register), `J`/`K` through a list,
   Enter to open, Esc to close a pane, `?` for the list. None of them fire while a field has focus.
6. **The length pass**, on the screens in the table, by the four rules; Finance → Overview measured first.
7. **Desktop layout.** List and pane on Finance → Receivables, Production → Entries, Staff → Roster and History; two or
   three columns on Home, Stats and Finance above about 1,600px.

Each step amends `SEP_INVOICING_DESIGN_PRINCIPLES.md` where it needs something the design system does not define.
