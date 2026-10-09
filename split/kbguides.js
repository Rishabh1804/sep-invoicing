/* ===== THE APP'S OWN GUIDES (knowledge.js; docs/KNOWLEDGE_BASE.md) =====
   How to use each screen. They describe the app, so they live in the build and move with it: never out of date, and they
   hold nothing of the shop (this repo is public). Read-only (src 'build'); counted in paths and training like any lesson.
   Each links to the screens it is about, so the top bar's book opens them there. A guide whose steps change gets the next
   `version`, which makes a training given on the old one due again. */
function _kbg(id, title, summary, screens, body, extra) {
  return Object.assign({ id: 'app-' + id, kind: 'guide', src: 'build', status: 'published', version: 1, versions: [], roles: [], tags: ['app'], by: 'The app',
    title: title, summary: summary, body: body, links: screens.map(function(s) { return { type: 'screen', id: s, label: '' }; }) }, extra || {});
}
var KB_APP_GUIDES = [
  _kbg('today', 'Using the app: Today', 'What needs you now, and how the plant is doing', ['pageHome'],
    'Today is the first screen. It has two views, then its Insights: Stats, Reports and the Planner.\n\n' +
    '# Needs you\n- The day’s five inputs: the in-time roll, the pickling loads, the stock message, the production records and the out-time roll. Each says **in**, **late** or **not yet**.\n' +
    '- Then every open task, grouped **Now**, **This week** and **Later**. Tap a task to see why it was raised and what clears it.\n- A red task is late or wrong; amber needs a look soon.\n' +
    '- **Add a task** of your own in the field above them, and **Add** (or Enter). **Details** gives it a due date, a note and a link.\n' +
    '- Tick your task when it is done: it goes to **Done**, folded at the foot, where its tick reopens it. A task you snoozed waits under **Snoozed**, with **Wake**.\n\n' +
    '# Pulse\n- The period at the top (**MTD**, **QTD**, **YTD**, **All**) is the one Stats shows. **More** beside it holds **Make a report** (the period as a report), **Open Stats** and **Edit Home**.\n' +
    '- The owner’s questions (is the plant running smoothly, are we making money, is cash coming in), each with what to do, then **Do first**: the moves worth most.\n' +
    '- **Why it moved**, **In one line** and **This month at its pace** each say their answer in one line; tap one to open what it rests on.\n' +
    '- Below them, the widgets. **Edit Home** (under More) chooses which show and where.', { version: 3 }),
  _kbg('stats', 'Reading Stats', 'By client, Cost and Trends, and how their figures are worked out', ['pageStats', 'pageHome'],
    'Stats has three tabs over one period (the same period as Pulse). Each starts with a card that says how it stands; tap it on a phone for its figures.\n\n' +
    '# By client\n- Contribution by client, worst first: what a kilo leaves after its **variable** cost (everything but the monthly crew) and after the **full** cost.\n' +
    '- Cost is spread per kilo: a thin clamp and a heavy bracket cost the same per kilo here. That is the one assumption the table cannot check.\n' +
    '- The worst large account is settled both ways: if labour is fixed and if it scales with the work.\n' +
    '- **Realisation by client** ranks only clients with weights on 90% of their revenue. A client billed on parts with no weight cannot be priced per kilo: those are the accounts most likely to be underpriced. **Clients → Parts → Derive weights from rates** fills them in.\n' +
    '- Whether a client below the full cost is worth exiting turns on how much of the cost is variable: the contribution table says it at both costs.\n' +
    '- **Concentration**: a client with no weights barely enters the measured tonnage, so its share of the plant is unknown, not small.\n' +
    '- A move to quote a client by the piece needs a **weight per piece** for each part: on the client’s card, in **Part weights**, or on **Parts**.\n' +
    '- **Next challan expected** is each client’s median gap between challans, counted from its last one. Late is past that gap; quiet is past both 1.75 times the gap and three weeks beyond it.\n\n' +
    '# Cost\n- The live cost is every cost line over the kilos plated, each with where it came from: **measured** (the app’s own records), **paid, bank** (the statement), **part-recorded**, **market rate** (zinc with no bill) or **model** (a Settings fallback).\n' +
    '- A stretch with no record is filled at the model, never read as zero: a figure that reads cheapest where least is known would flatter every margin.\n' +
    '- **Zinc** goes into the bath as it arrives, so over a month or more its bills are its use: what was bought over the 90 days before, per kilo plated over the same days.\n' +
    '- Labour reads **low** when days are not recorded: every tier is paid for the days typed, and the monthly crew’s rest days are gated on the same attendance.\n' +
    '- **Variable labour by area** places the hourly pool, the daily tier, overtime and the extra where each was worked. The monthly crew’s day pay and rest days are not in it: that crew is the standing one, and splitting it by area would print an allocation nobody measured. Its overtime is in it, since an overtime hour was worked somewhere.\n' +
    '- **Recorded against paid** sets the app’s records beside what the bank paid; a gap over 10% is marked.\n\n' +
    '# Trends\n- The period’s revenue, tonnage, realisation and margin, against the same days before; then six months, each at its own live cost; the trend; the top items.\n' +
    '- In the six months, labour shows only where 90% of the month is recorded, or the bank statement covers what paid it; a month with less is withheld rather than read low. **Measured** is the share of that month’s cost from the app’s own records.\n' +
    '- Realisation divides revenue by the tonnage of the same lines. Lines with no weight are left out of both, and they are the piece-billed, low-priced end, so a partial figure reads **high**.\n\n' +
    '# Why it moved (on Pulse)\n- Realisation’s change is split into each client’s own rate and the mix (a client’s share of the kilos, at its rate against the average before). Contribution’s change is split into the price, each cost line and the kilos. The causes add up to the change exactly.'),
  _kbg('add', 'Using the app: the Add button', 'One door for everything that comes in', ['pageHome', 'pageStaff', 'pageStock', 'pageProduction'],
    'Everything that comes into the app goes through **Add** (the filled button in the middle of the phone bar, at the top of the rail on a computer, or the key A).\n\n' +
    '- **Paste**: a WhatsApp message (an attendance roll, the stock message, pickling loads, a production list). The app reads it and shows every line beside what it read, before anything is saved.\n' +
    '- **Photo**: a register page or a challan.\n- **File**: a backup, a bank statement, an import from soma-internal.\n- **By hand**: every form, when there is nothing to paste.\n\n' +
    'Nothing is saved until you press Save on the check that follows.'),
  _kbg('challan', 'Using the app: entering a challan', 'Material in, line by line, checked as you type', ['pageIM'],
    '1. Office → Challans → **Add challan**.\n2. Pick the client and type the challan number. If that number is already recorded for the client, the app says so under the field, with **Open it**.\n' +
    '3. Add each line: choose the part and the rate and weight fill from the client’s record. Change them if the paper says otherwise.\n' +
    '4. A rate or weight far from the record is flagged. A red flag needs a reason before the challan saves (one tap: the customer’s challan says so, the rate changed, the weight differs).\n' +
    '5. **Save**, or **Save, add another** for the next challan of the same client and day.\n\n' +
    '**Never** enter one challan twice. If the app warns of a duplicate, open the one it names first.'),
  _kbg('invoice', 'Using the app: making an invoice', 'From the challans waiting to be billed', ['pageCreate', 'pageIM'],
    '1. Office → Challans: tick the challans to bill, then **Create invoice**. Or open Create and pick the client: its unbilled challans are tick boxes.\n' +
    '2. Each line comes in at what is **left to bill** on its challan. Type less to dispatch part of it; the rest stays waiting.\n' +
    '3. Billing more than is left asks for a reason. A line at ₹0 asks why (replating, a sample).\n' +
    '4. The P.O. and the vehicle fill from the client’s settings where it has them.\n5. **Create invoice**. Then Print from its preview: three copies, original, duplicate and triplicate.'),
  _kbg('states', 'Using the app: an invoice’s state', 'Created, printed, dispatched, delivered, filed', ['pageRegister', 'pagePipeline'],
    'An invoice moves through five states: **Created → Printed → Dispatched → Delivered → Filed**.\n\n' +
    '- Print marks it Printed. Mark it Dispatched when it leaves, Delivered when the customer has it.\n- Its dot turns amber, then red, the longer it sits in one state.\n' +
    '- Delivered waits on the GST return, due on the 11th of the next month.\n- Office → Pipeline shows every invoice by state, with the oldest first.'),
  _kbg('credit', 'Using the app: credit notes', 'A batch rebate, a correction, or a note issued on paper', ['pageRegister', 'pageFinance'],
    '- **A batch rebate**: tick the invoices of the batch in the Register, then raise the credit note from the selection.\n' +
    '- **A correction** (rate, goods returned, short quantity): Money → Bills & notes → New note, against one invoice, with a reason.\n' +
    '- **A note already issued on paper**: Bills & notes → Record an issued note, with its own number and the GST as printed.\n\n' +
    'A credit note is cancelled, never deleted.'),
  _kbg('rolls', 'Using the app: the attendance rolls', 'Pasting the in-time and out-time rolls', ['pageStaff', 'pageFloor'],
    '1. Copy the roll from WhatsApp, then Add → Paste (or Floor → People → Paste message).\n2. The app reads every line: who, where and when. A name it is unsure of reads **read as** with a picker; a name it cannot place is red until you place it.\n' +
    '3. Check every line, then **Save**. A spelling you place is remembered.\n4. Paste the out-time roll the same way: it updates the day.\n\n' +
    'A mark typed by hand is never overwritten by a roll.'),
  _kbg('day', 'Using the app: the day by hand', 'Floor → People → Day: marks, times and overtime', ['pageStaff', 'pageFloor'],
    '- **Board** shows each area as a card. P, H or A is one tap. Tap a name for the hand’s day: area, in, out, and the area of each overtime shift.\n' +
    '- **Sheet** is Deepak’s sheet: one row a hand, with the in and out typed as on paper. Hours and OT work themselves out.\n' +
    '- EXTRA hours are entered below the board, against the area and the crew.\n- **Needed today** sets how many heads each area needs, when it differs from usual.\n' +
    '- **Print sheets** prints the blank forms and the day as entered, to file.'),
  _kbg('stock', 'Using the app: stock', 'The stock message, entry by hand, and reordering', ['pageStock'],
    '- **Paste the stock message** from the supervisor. Every line is shown with what was read. A line that contradicts itself is red: pick the working or the figure written.\n' +
    '- **Enter by hand** for a count, a delivery (with its bill: company, invoice number, price), a use or a charge into the bath.\n' +
    '- A wrong entry is **corrected**, never edited: it is voided and the right figure entered in its place.\n- **Reorder list** works out what to order for each supplier.'),
  _kbg('production', 'Using the app: production', 'Pickling loads, the register, and what each line plated', ['pageProduction', 'pageFloor'],
    '- **Paste** the pickling loads and the production list from WhatsApp.\n- **Read register photo**: a photo of the VAT register page is read and every row shown for checking. A struck row asks each time.\n' +
    '- **Enter by hand** when there is nothing to paste. The form stays open for the next entry.\n' +
    '- Production → In plant shows the material in the plant two ways: by the book and by the floor.\n- A figure is corrected by a new entry, never edited.'),
  // How the analysed figures are worked out (§6.27): the screens show the verdict, its factors and a folded working; the reasoning is
  // here, one tap away on the top bar's book (owner, 9 Oct 2026: "designing a way to present our analysed data in a coherent manner").
  _kbg('plant-figures', 'Reading the plant’s figures', 'A line’s efficiency, the round and the pace, and stock by line', ['pageFloor', 'pageProduction', 'pageStock'],
    '# A line’s efficiency\nWhat the line plated against what its working units could plate in the hours it ran, less the power cuts. Four factors multiply to it:\n' +
    '- **Time**: the rounds run against the rounds the hours allowed (the hours over the pace).\n- **Racks**: how full each round was, against its part’s fullest round.\n' +
    '- **Parts**: what a full round of the day’s parts weighs, against the line’s round. Lighter parts are the work, not a fault.\n- **Weighed**: rounds with no weight leave the figure low.\n\n' +
    'The caption over the tiles names what moved it most. **How it’s worked out** under them lists every input, one a row.\n\n' +
    '# Measured, set or typed\n- **Measured**: read off the register. A round’s kilos once 30 rounds on 5 days rest on the parts’ own weights; the pace once 5 shifts of 8 rounds or more are on it.\n' +
    '- **Set** or **typed**: the figure entered by hand, which stands until the register’s measure is firm.\n\n' +
    '# Stock by line\nWhat went into each line’s bath against what the line plated.\n' +
    '- Each addition (zinc, a salt, a brightener) is set against what its line plated until the next one went into the same bath.\n' +
    '- The last is still in the bath: its figure is **so far**, falls as the line plates on, and is kept out of the line’s figure.\n' +
    '- Days the line has no record are filled at the pace of the days it has; under half recorded, nothing is set.\n' +
    '- A use naming two baths is shared by what each plated, or evenly where one is not recorded. A use naming no bath is the plant’s.\n\n' +
    '# The signs\n- **≈** an estimate. **≤** the most it can be: pieces nothing weighs leave the kilograms short.\n- **—** withheld, with the reason beside it.'),
  _kbg('power', 'Using the app: power cuts', 'Recording a cut and what it cost', ['pagePower', 'pageProduction'],
    '- A cut is entered like any floor record: Floor → Power → **Enter a cut** (the time it went and the time it came back).\n' +
    '- A cut reported twice (the register and a message) is counted once.\n- Power → Case is the business case for backup power, drawn from the record every time it is opened or printed.'),
  _kbg('pay', 'Using the app: pay', 'What each hand is owed, payments and the weekly payout', ['pageStaff'],
    '- Floor → People → **Pay**, for the pay week (Sunday to Saturday).\n- Each hand shows what was earned, what was paid and what is due. Tap a hand to record a payment or an advance.\n' +
    '- A wrong payment is voided with a reason, never deleted.\n- The weekly payout is predicted while the week is open.', { roles: ['owner'] }),
  _kbg('bank', 'Using the app: the bank statement', 'Importing it, and placing each receipt', ['pageFinance'],
    '- Money → Bank → **Import statement**: the bank’s own .xls file. Rows already in are skipped.\n- Money → Receivables: each receipt is set against the client’s invoices. A cheque with no name is offered to a client; place it with one tap.\n' +
    '- A payee set once is remembered.', { roles: ['owner'] }),
  _kbg('search', 'Using the app: search and keys', 'Finding anything, and the shortcuts', ['pageHome'],
    '- Search (the magnifier, or Ctrl K) finds invoices, challans, clients, parts, workers, stock lines, quotations, credit notes, articles here, and screens.\n' +
    '- Numbers match whole: 834 finds invoice 00834, never 8341.\n- **A** opens Add. **Backspace** goes back. Ctrl+click opens a screen in a new window.'),
  _kbg('knowledge', 'Using the app: the knowledge base', 'Reading, writing, approval and training', ['pageKnow'],
    '- The book in the top bar opens the guides for the screen you are on.\n- **Write** an article: a how-to, a process, a part, a client requirement, a ruling, a fault, an incident or a decision.\n' +
    '- What anyone but the owner writes waits for the owner’s approval. A change to a published article waits beside it.\n' +
    '- **Troubleshoot**: find a fault by what you see; log an incident when something goes wrong, and the app shows that day as recorded.\n' +
    '- **Training**: record who was taught which lesson. When a lesson changes, the training is due again.\n- A photo stays on the device it was taken on.'),
  _kbg('planner', 'Using the app: the planner', 'Simulating machines, certification, staff, clients and a loan', ['pagePlanner'],
    'Today → **Planner** plays out a plan over the next 24 months. It starts from the book’s last three full months and **never changes the book**.\n\n' +
    'The card at the top says how the plan stands against its goal on every view; **Roll** and the month are under it, and **More** holds the rest (a new card, the report, the plan’s copy and name, the goal).\n\n' +
    '# Make a plan\n1. **Suggest a start** (under More) puts the CQI-11 path in at its earliest, or plan moves one by one on **Moves**: **Plant** (an upgrade tree per station), **Tech tree**, **Staff** (hires and training), **Clients** (ask a rate, plan the work a client holds back).\n' +
    '2. A level or node opens once what it needs is planned. A move on the **board** (Play) is tapped to shift it a month or take it out. On a phone, tap a move’s row for its controls.\n' +
    '3. **Moves → Finance** → Lenders: play one loan; its amount, rate, months and interest-only months are then the plan’s to change.\n' +
    '4. **New card** (under More) adds a move the planner does not know: new work at a rate on a line, more kilos a round, or a saving, with its cost and its chance.\n\n' +
    '# Read it\n- **Ledger**: every month’s kilos, revenue, costs, margin, spend, loan and cash. Tap a month: today’s margin, then each move in the order it takes effect, adding up to the plan. Each row is what its move added on top of the rows above, so they add up to the plan; a wage or upkeep shows where it starts, and one-off spend is on the Spend row.\n' +
    '- **A day**: each line’s rounds on the clock. A line runs the general shift first, then the morning block from 6:00, then the evening to 8 PM, then a night shift where the plan has a night crew; rounds are coloured by client. The day times the working days is the month on the Ledger.\n' +
    '- **Moves → Clients**: a piece part’s ₹/kg is its rate over its kg a piece; with the ask in the plan, a rate typed on a part asks that part apart.\n' +
    '- **Roll the trials**: 600 runs drawing every chance and risk. The score is the share that reach the goal (Easy, Normal or Hard). **Replay one run** tells one as a story.\n\n' +
    '# Keep it true\n- The **registers** are records: machines and what they need, the CQI-11 checklist, lenders, rates heard, work held back. Keep them current.\n' +
    '- **Set the assumptions** (Ledger or Moves → Plant) where the book measures nothing: a line’s kilos a round, pickling, the overtime hour, the fixed electricity bill, the cash.\n' +
    '- Upgrade costs are estimates until a quote replaces them: **Cost** on each level.\n- **Make the report** prints the plan for a lender or a meeting.',
    // Version 2: the Planner is Today's (the tab map, 9 Oct 2026). Version 3: four views, the five kinds on Moves, the verdict
    // card and More (TM2d).
    { version: 3 })
];
/* The paths when the book has none of its own: a lesson list per role. */
var KB_APP_PATHS = [
  { id: 'app-path-floor', title: 'New on the floor', role: 'floor', articles: ['app-today', 'app-add', 'app-production', 'app-stock', 'app-knowledge'] },
  { id: 'app-path-supervisor', title: 'Supervisor', role: 'supervisor', articles: ['app-today', 'app-add', 'app-rolls', 'app-day', 'app-production', 'app-stock', 'app-power', 'app-knowledge'] },
  { id: 'app-path-office', title: 'New in the office', role: 'office', articles: ['app-today', 'app-add', 'app-challan', 'app-invoice', 'app-states', 'app-credit', 'app-search', 'app-knowledge'] }
];
