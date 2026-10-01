# Direction B: workspaces, one Add, and answers that say what to do

**Chosen by the owner, 1 Oct 2026**, from the three directions put to them on 30 Sep 2026 (the mockups: the canvas
*SEP Invoicing: new UI directions*, row B). In their words:

> *"Choose design direction B. In the pulse, we have a question that asks who's driving it and there is an answer with
> a reason, with no possible solutions and steps to be taken to ensure smooth running of our plant. Lots of things in
> the app that can answer itself but that linkage is missing."*

Two things, then. **The shape**: the phone bar becomes Today · Office · Add · Floor · Money, with no More; most of the
day is entering things and checking them, and that was spread over five pages, four of them behind More. **And the
substance**: an answer with a reason is half an answer. Every question the app asks itself must end in what can be done
about it, worked out from the book, with a button to the place where it is done.

## The shape

**Phone bar**: **Today · Office · Add · Floor · Money**. No More. Settings is the icon in the top bar (as now); search is
the icon beside it.

**Desktop sidebar**: **Add** (the one primary, key `A`) · **Search** (`Ctrl K`) · **Today** (Needs you, Pulse) · **Office**
(Pipeline, Challans, Invoices, Clients) · **Floor** (Day, People, Production, Stock, Power) · **Money** · **Insights**
(Stats, Reports, History) · Settings at the foot.

**A workspace is a layer over the pages that exist.** Every page keeps its id, its address (`?tab=pageIM&v=…`), its
view tabs and its renderer; a workspace names the pages it holds and draws their tab row above the page. So a link, a
To-do jump (`todoGo`), a bookmark and every spec that opens `pageIM` still lands on it, now inside Office.

| Now | In B |
|---|---|
| Home | **Today** (`pageHome`): *Needs you* (the day's inputs, the To-do) · *Pulse* (the questions with what to do, then the widgets the owner arranged, with Edit) |
| Create | Office's primary (*Create invoice*), and Add → Invoice |
| IM | Office → **Challans** |
| Register | Office → **Invoices** |
| Clients (Clients · Items · Performance · Quotations) | Office → **Clients**, its four views as they are |
| — | Office → **Pipeline** (new): awaiting invoice → created → printed → dispatched → delivered → owed, each a count, an amount and a tone by age; a stage opens its list with its bulk action |
| To-do | Today → *Needs you*: yours and the app's, Done one tap away |
| Finance | **Money**, its six tabs as they are |
| Staff (Overview · Day · Week · Pay · Areas · Roster) | Floor → **People** |
| — | Floor → **Day** (new): a card per line (VAT A1, VAT A2, Barrel, Pickling): heads against the day's number, what it is running, what it has plated, the crew, the EXTRA; tiles for on site, plated, power |
| Production · Stock · Power | Floor → **Production** · **Stock** · **Power** |
| Stats · Reports · History | **Insights** → Stats · Reports · History (on the phone: from Pulse, and from search) |
| Home's quick actions, Paste message | **Add** |

**Add is one door for everything that comes in**: paste a WhatsApp message (rolls, stock, pickling loads, production,
power cuts: the one paste box, which already routes them), what is on the clipboard (*On the clipboard: an in-time roll*,
read only when the owner taps), a photo (a challan or a register page: the register reader already refuses a challan and
offers the scanner), a file (a bank statement, a backup, an import: routed by what is in it), and by hand: challan,
invoice, quotation, stock entry, production, power cut, attendance, payment, bill, task. Whatever comes in is read, shown
beside what was read, and saved only when the owner says so (the stock paste's contract, unchanged).

**Swiping** moves between the open workspace's views, never across workspaces.

## Answers that say what to do

**A question the app answers ends in the moves that answer it.** Each move is worked out from the book, says what it is
worth, says what it rests on, and carries one button to the place where it is made, filled in as far as the book allows.
Nothing is applied: a move opens a place or a draft, and nothing is written until the owner saves there (the rule every
offer in this app already keeps: the zinc uplift, the openings, the derived costs).

**The questions** (Today → Pulse; Stats → Overview carries the same cards until B moves it):

1. **Is the plant running smoothly?** (new; *"to ensure smooth running of our plant"*) What could stop it, soonest first:
   a stock line out or under its red line (→ the reorder list, its order message ready), cuts this month and what they
   cost (→ the power case and its recommended option's payback), an area short of its number on recent days and the
   EXTRA it booked (→ Areas, Needed today), a line with no production record today (→ read its register photo), wages due
   this Saturday (→ Pay), no backup for a week (→ Settings).
2. **Are we making money?** Reprice the largest accounts under the cost (the rate that clears the variable cost and the
   one that clears the full cost, what each is worth a month at their tonnage → a quotation drafted at that rate); bill
   what is waiting (unbilled challans and work plated but not invoiced → Office); the cost line furthest above its model
   (→ that line of the live cost); the spare capacity (→ question 4's moves).
3. **Who is driving it?** For the account that fills the plant below the cost: reprice it (per kg, and the piece rates
   that implies for its largest parts, from their own weights → a quotation draft with those parts); what its rebate
   costs against how fast it pays (→ its credit notes, its days to pay); the parts that earn under what an hour of the
   plant costs (→ By the hour, and what to look at); and the labour question the decision turns on, settled both ways
   (→ contribution by client). For the biggest mover down: its stopped parts (→ Performance) and a call (its phone from
   the client master).
4. **Is the plant full?** Spare tonnes, and who could fill them: clients realising above the full cost who sent less
   than usual (→ a call, their performance); quotations out and unanswered (→ Quotations); a new quotation at a rate that
   clears the cost (→ a draft); the lines with the most idle days (→ Production → Lines). When busy: the worst-priced work
   to reprice, and the overtime it costs.
5. **Is cash coming in?** Who owes over 90 days and how much (→ a call, their open invoices); receipts with no client
   (→ place them); a client paying slower than usual; the forecast's lowest point and what moves it.
6. **What changed?** The insights, each now carrying its own moves (below).

**A move** is one row: the move in a sentence (*Ask SSS MEHTA for ₹8.55/kg on clamps*), what it is worth (*+₹1.53L a
month at the last three months' tonnage*), what it rests on (*the full cost this quarter, 62% measured*), and one button
(*Draft quotation*, *Reorder list*, *Call*, *Open challans*). **Add to my list** turns any move into a task of the
owner's own that keeps the button, so a decision taken on the Pulse is tracked on Needs you until it is done.

**Every app task carries its moves too.** The To-do rules (stock, billing, the insights, finance, production, power)
gain the same list in their task's detail: *a client gone quiet* → call them, see what stopped, see what they owe; *below
the variable cost* → the reprice draft; *a statement 14 days old* → import it.

**What a move may not do**: invent a figure (each comes from the function its own screen uses), apply itself, or appear
without its data (a move that cannot be worked out is left out; a question with no moves says what would make one
appear).

## The steps

Each is its own spec; B1 ships first, the rest ship together, because places should move once, not five times.

1. **B1 · What to do** (P133). The engine (`advice.js`), the moves on the six questions, the moves on every app task, Add
   to my list, and the jumps they need (`todoGo`: a pre-filled quotation draft, a client's performance, the reorder list,
   the power case, Areas, a line of the live cost). On the current screens: Stats → Overview and the To-do.
2. **B2 · Workspaces** (P134). The phone bar, the sidebar, the workspace tab rows, More retired, swipe within a workspace,
   the addresses and the trail naming the workspace, the fixtures' `switchTab`.
3. **B3 · Today** (P135). Needs you (the day's inputs, each with when it usually arrives; the tasks grouped Now / This
   week / Later, each with its one-tap move) and Pulse (the questions, then the widgets with Edit).
4. **B4 · Add** (P136). The one door, phone and desktop (`A`).
5. **B5 · Office → Pipeline** (P137) and **Floor → Day** (P138).
6. **B6 · Search and keys** (P139): UX overhaul 2 steps 3 to 5 (new window, search, the keyboard), on B's shell.

## Rules carried over

The hard rules and DR-1 to DR-8, unchanged. One primary per view (Add is the shell's, not a view's). No pop-ups. Every
place has an address and one trail goes back. A change inside a view never moves the page. Figures from one function.
The design principles (§4 Information architecture, §7 screens) are amended in the PR that changes them.
