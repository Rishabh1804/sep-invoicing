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
    '**Never** enter one challan twice. If the app warns of a duplicate, open the one it names first.\n\n' +
    '# Wanted by a day\n- Where the client asks for the material back by a day, put it in **Wanted by** on the form, or open the challan and tap **Wanted by**: the whole challan, or a line of its own (a line’s day wins).\n' +
    '- The challan says *Wanted* and the day beside its name until its material goes out: blue ahead, amber on the day, red after. On the day, if nothing of it is plated, the To-do asks.',
    // Version 2: a challan wanted by a day (the flow thread, 10 Oct 2026).
    { version: 2 }),
  _kbg('invoice', 'Using the app: making an invoice', 'From the challans waiting to be billed', ['pageCreate', 'pageIM'],
    '1. Office → Challans: tick the challans to bill, then **Create invoice**. Or open Create and pick the client: its unbilled challans are tick boxes.\n' +
    '2. Each line comes in at what is **left to bill** on its challan. Type less to dispatch part of it; the rest stays waiting.\n' +
    '3. Billing more than is left asks for a reason. A line at ₹0 asks why (replating, a sample).\n' +
    '4. The P.O. and the vehicle fill from the client’s settings where it has them.\n5. **Create invoice**. Then Print from its preview: three copies, original, duplicate and triplicate.'),
  _kbg('states', 'Using the app: an invoice’s state', 'Created, printed, dispatched, delivered, filed', ['pageRegister', 'pagePipeline'],
    'An invoice moves through five states: **Created → Printed → Dispatched → Delivered → Filed**.\n\n' +
    '- Print marks it Printed. Mark it Dispatched when it leaves, Delivered when the customer has it.\n- Its dot turns amber, then red, the longer it sits in one state.\n' +
    '- Delivered waits on the GST return, due on the 11th of the next month.\n- Office → Pipeline shows every invoice by state, with the oldest first.'),
  _kbg('credit', 'Using the app: credit notes', 'A batch rebate, a correction, or a note issued on paper', ['pageRegister'],
    '- **A batch rebate**: tick the invoices of the batch in the Register, then raise the credit note from the selection.\n' +
    '- **A correction** (rate, goods returned, short quantity): Office → Invoices → **Credit notes** → **New note**, against one invoice, with a reason.\n' +
    '- **A note already issued on paper**: Office → Invoices → **Credit notes** → **Record issued**, with its own number and the GST as printed.\n\n' +
    'A credit note is cancelled, never deleted.', { version: 2 }),
  _kbg('clients', 'Using the app: clients and sales', 'Clients, their parts, how each is doing, and the work being won', ['pageClients'],
    'Office → Clients has three views (Clients, Parts, Performance) and Office → Sales two (Prospects, Quotations). Each starts with a card that says how it stands.\n\n' +
    '# Clients\n- A dot and a word beside a client name the worst thing raised about it: **past terms** (owed past its payment terms), **gone quiet**, **below cost**, **to bill** (challans waiting), **note due** (a rebate note due) and the rest. Open the client for every task about it.\n' +
    '- The card at the top counts the clients with something raised, worst first.\n\n' +
    '# Parts\n- **No weight** lists the parts with no weight a piece. They cannot be priced per kilo, so tonnage and realisation leave them out. **Derive weights** (under More) fills what a piece client’s rate card allows.\n' +
    '- **Unused** lists the parts no invoice has billed. **Select unused** and **Merge** are under More.\n\n' +
    '# Performance\n- One client at a time: month on month as revenue, tonnage or rate per kilo, then its parts by **cadence**.\n' +
    '- A part is judged against its own rhythm, across invoices and challans. It is **stopped** once the gap since it last came is past both 1.75 times its usual gap and its usual gap plus three weeks. A fixed cut-off would call a quarterly part stopped in its second month.\n' +
    '- **New** came first in the last 60 days. **Steady** keeps its rhythm. **One-off** came once, long ago, and never had a rhythm to fall out of.\n' +
    '- A stopped part and a new one sharing their first six letters and digits are marked as possibly one part renamed. A part is its size or number and its gauge, so two spellings of one clamp are one part.\n' +
    '- **Materials worked**: each part sent in a period, in pieces and kilos, with its challans, invoices and platings. A code another client also sends is counted apart, here and on Stats.\n' +
    '- **By the hour**: a round is pickling, plating and a constant for logistics and the other steps (15 minutes, set on the panel). An hour costs the plant its cost over the last 90 days, spread over the working days × 3 lines × 16 hours. A part earning less than that an hour loses money by the hour.\n' +
    '- Under a part, **what to look at**: plating slower than before (look at the jig loading, the bath’s current, temperature and concentration, and the waits between rounds); racks run short of their fullest (full racks earn more an hour on the same time); logistics a quarter or more of a round (longer lots, the next load staged before the round ends); pickling slower than plating (pickle the next load while this one plates); and a set plating time the record no longer bears out, which **Use** replaces with the measure.\n\n' +
    '# Sales\n- **Prospects** are firms approached, by stage (new, contacted, sample, quoted, won, lost), each with its next follow-up. A follow-up due is amber, a week late red.\n' +
    '- The **pipeline** is the tonnes a month the prospects would send, each weighted by the chance at its stage: new 10%, contacted 20%, sample 40%, quoted 60%. The chances are a working assumption, not measured.\n' +
    '- The **spare** is what the plant could plate a month and does not: the last 90 days’ invoiced tonnes against about 2 t a shift, two shifts a working day.\n' +
    '- **Won** opens the client form filled from the prospect.\n' +
    '- **Quotations**: a draft holds no number, and **Issue** gives it one. An issued quotation is never edited: **Revise** makes the next revision. When one is accepted, its rates are offered to the client’s record, never written unasked.\n' +
    '- **To reprice**, in the Quotations card, lists Pulse’s moves for the clients billed under the cost, each opening a draft quotation.'),
  _kbg('rolls', 'Using the app: the attendance rolls', 'Pasting the in-time and out-time rolls', ['pageStaff', 'pageFloor'],
    '1. Copy the roll from WhatsApp, then Add → Paste (or Floor → People → Attendance → Day → **Paste message**).\n2. The app reads every line: who, where and when. A name it is unsure of reads **read as** with a picker; a name it cannot place is red until you place it.\n' +
    '3. Check every line, then **Save**. A spelling you place is remembered.\n4. Paste the out-time roll the same way: it updates the day.\n\n' +
    'A mark typed or changed by hand (its area included) is never overwritten by a roll, even an out-time roll that puts the hand on a later block: Pay’s **Hours to check** names such a hand, so the day can be put right.',
    // Version 3: a mark changed by hand and the hours to check (10 Oct 2026); version 2: Paste message is Attendance's, on Day (TM4b).
    { version: 3 }),
  // Attendance (the tab map, TM4b): Day, Week and Month under one tab, and the method each screen used to print above its figures.
  _kbg('day', 'Using the app: attendance', 'Floor → People → Attendance: the day, the week and the month', ['pageStaff', 'pageFloor'],
    'Floor → People → **Attendance** has three views on a switch under its toolbar: **Day**, **Week** and **Month**. Each starts with a card that says how it stands; tap it on a phone for its figures.\n\n' +
    '# Day\n- The card says who is on site against the day’s roster and the areas short of the day’s number: on site, half day, absent and not marked are its figures.\n' +
    '- **Board** shows each area as a card. P, H or A is one tap. Tap a name for the hand’s day: area, in, out, and the area of each overtime shift.\n' +
    '- **Sheet** is Deepak’s sheet: one row a hand, with the in and out typed as on paper. Hours and OT work themselves out.\n' +
    '- **Paste message** takes the rolls; **Print sheets** (under More on a phone) prints the blank forms and the day as entered, to file.\n\n' +
    '# Extra hours\n- Hours booked to an area rather than to a named hand: the **EXTRA n HOURS** lines on the daily sheet. They are counted in the bill once, under the EXTRA line.\n' +
    '- Each row is one line: the area, the slot, the hours and its crew. Tap it for its times, crew and number needed. A row missing its times or its crew stays open, in amber.\n' +
    '- A general shift’s extra covers a missing hand a full eight hours. An **OT block** covers it the block’s own length, so it needs its in and out times and its crew: the day’s marks supply neither, since a hand on one area all day may stand in another’s evening block.\n\n' +
    '# Needed today\n- Who stood in each area on the general shift against what the shift needed. The box starts at the area’s usual number (People → Areas).\n' +
    '- Type the day’s own number, **0** when the line needed nobody, or clear it for the usual. The shortfall and the extra are judged against it.\n' +
    '- An OT or night block takes its own number on its row under Extra hours.\n\n' +
    '# Week\n- The card says the week’s attendance against the rest-day gate (90% and 80%), the days nobody recorded, and the payout so far.\n' +
    '- Tap a cell of the grid to cycle it: present, half day, absent, then back to not marked.\n' +
    '- A cell not marked is a day nobody typed, which is not the same as a day nobody worked: the labour figures keep the two apart.\n' +
    '- The figure in a cell is the hours that decide the pay: the whole day for the hourly pool, the overtime for everyone else.\n\n' +
    '# Month\n- The supervisor’s register, a page a month, set against the day as the app holds it. The card counts the cells that differ, those only on the register and those that agree.\n' +
    '- A cell is drawn as written. Red: the mark differs from the day. Amber: only the overtime differs, by an hour or more. Plain: it agrees, or it is only on the register. A dashed edge is a cell the reading was unsure of.\n' +
    '- Tap a cell to see both and settle it, one way or the other: **Day takes the register’s** or **Register takes the day’s**. **Fill** puts every cell only on the register onto its day, asked first.\n' +
    '- **Read page photo** reads a photo of the page, every cell shown before it counts; **Import** takes a register file; **Start this month** gives a column to each monthly hand to fill by hand.',
    // Version 2: Attendance's three views on a switch, and each screen's method moved here (the tab map, TM4b).
    { version: 2 }),
  // The method the Areas screen printed above its figures, in five paragraphs (the tab map, TM4b): the screen now says the verdict.
  _kbg('areas', 'People: the areas and the extra', 'Staffing by area, and how the extra hours are checked', ['pageStaff'],
    'Floor → People → **Areas** reads the attendance by place: is each area staffed right, and does the extra hold up. The card at the top says whether the extra checks out, or how many bookings are left to explain.\n\n' +
    '# The rule\n- A hand missing from an area running at full tilt is covered by the crew who are there, and **8 hours are booked** to that area for it. So the extra expected is **8 × (the area’s number − the heads)** for each area, each day, set against what was booked.\n' +
    '- An OT block books the same way, at the block’s own length instead of 8 (a 5 PM to midnight block short two hands books 14). The named hands’ own overtime is separate and is not in it.\n' +
    '- Barrel and barrel pickling are one unit of five for the arithmetic. A VAT line in a block brings its pickling hands with it: one line needs 2 of the 3, both lines all 3, never 4.\n' +
    '- The number is the area’s complement (VAT A1 and A2 4, Barrel 3, Barrel pickling 2, Pickling A1 and A2 3 is the floor’s full house), or the day’s own where Needed today sets one. With none set, the extra can only be counted, not checked.\n\n' +
    '# Reading the check\n- **More booked than the shortfall explains** is what the rule forbids: hours on top of named columns, a tag on a full area, or a figure written larger than the gap.\n' +
    '- **Less booked** is not wrong: an area short **and** running light needs no cover, and nothing here measures an area’s output, so the expected figure is the most it can be, not a target.\n' +
    '- A unit nobody was marked on that still carries hours reads as fully short and fully covered (a pickling row with no heads booking 24 hours against a number of 3 is 8 × 3 exactly). It passes the check; what it says is that the day’s marks were never typed.\n' +
    '- A unit nobody stood on and nothing was booked to did not run, and is left out.\n\n' +
    '# The rows to explain\n- They are flags on the paperwork: hours booked to the wrong area, an area nobody typed, and hours never worked all look the same from here. The row gives the area and the day; the sheet settles the rest.\n' +
    '- **Explain** records why one is right, against its figures. If the figures later move (a crew corrected, a tag retyped), the note no longer fits and the row comes back.\n' +
    '- A block needs three things to be checked: its in and out times, its named crew and the areas it covers. Without one it is **not checkable**: its hours are still paid, they are just not evidence about staffing.\n\n' +
    '# Staffing by area\n- Heads are counted from the day’s marks, so a hand moved to another area counts where they stood. Averages are over the days recorded, not the calendar.\n' +
    '- With no number set, the area’s own median stands beside it as the only reference.\n' +
    '- Hands on **Flex** count against no area; set their area on the Day to place them.\n\n' +
    '# The extra, paid pro-rata\n- The area’s present crew receive its extra between them (owner, 28 Aug 2026). It stays one pooled figure under EXTRA on the slip, paid out by the supervisor; the shares are the split he pays it by, and nothing here enters a hand’s own wage.\n' +
    '- A share over a shift a day (24 hours of cover against two hands is twelve each) is marked: check it against the record before reading it as pay.'),
  // Floor's Overview (the tab map, TM4a): how its cards are read, which used to be a note under them (§1a-5).
  _kbg('floor', 'Using the app: the floor', 'The day across the plant: people, production, stock, power and turnaround', ['pageFloor'],
    'Floor opens on its **Overview**: the day across the plant, a card each, then a card per line. The arrows step through the days; **Today** comes back.\n\n' +
    '# The cards\n- **People**: who is on site against the day’s roster, and the lines short of the day’s number. Green at 90% on site; amber at 80%, or when the floor is short of its number; red under 80%.\n' +
    '- **Production**: what the day plated (≈ where part of it is estimated, ≥ where pieces nothing weighs are left out), and the line that did worst.\n' +
    '- **Stock**: the lines out and low now, whatever the day shown, and what the reorder list costs with GST.\n' +
    '- **Power**: the day’s cuts and how long it was dark, the month to that day, a year at this rate, and the load to chase while an approved load is not on the bill.\n' +
    '- **Turnaround**: how many working days material takes from its challan to going out, the middle of the last 90 days weighted by value, against the target (Settings → Checks & alerts → Turnaround and terms, one working day; a client’s own, or a part’s, on the client). Open, it shows the days to pickling, to plating, to despatch and, where you see money, from the invoice to its payment against the terms; then the lines past the target now and the jobs wanted by today. Its link opens In plant.\n' +
    '- Tap a card for what it rests on; its link opens its screen. A role sees the cards of the screens it opens.\n\n' +
    '# The lines\n- A card per line, the worst first: red, then amber, green and blue.\n' +
    '- **Staffing**: the general shift’s heads against the day’s number (People → Attendance → Needed today). Barrel is barrel and barrel pickling, one unit.\n' +
    '- **Plated**: the figure that counts for each shift, as Production → Lines shows it. A day nobody recorded is a gap, not a zero.\n' +
    '- **Earned** (to a role that sees money): **What a line earned** below. A role that does not see money reads the kilos against the line’s usual day.\n' +
    '- A line’s efficiency and how it splits: **Reading the plant’s figures**.\n\n' +
    '# What a line earned\n- The line’s runs at their clients’ rates on record, before GST: a piece client’s part at its piece rate, a run in kilos at the client’s rate a kg, a run in pieces at that rate over its weight (≈ where the weight is estimated). Rework is not billed and is left out.\n' +
    '- Green where its rupee a kilo clears what a kilo costs (the live cost over the 90 days to the day, else the full cost in Settings), amber just under, red below.\n' +
    '- Under it, the line’s **usual day**: the middle of its recorded days in the 60 before, five at least, each with nine tenths of its work weighed (for the earnings, priced). A day still running says *so far*.\n' +
    '- Where a tenth or more of the work has no rate, it says how much instead: the figure reads low.\n' +
    '- The **Production** card, opened: what the day’s work is worth, **At the live cost** (what its kilos cost), **Left after it**, the labour on the record, and **This week, a day plated** and **a day earned** against the four weeks before (a recorded day’s average on each side: a day not recorded is a gap, not a zero). **Not priced** lists the work no rate prices, with the door to the client’s rates.\n\n' +
    '# Not weighed\n- Pieces plated with no weight anywhere in the book: no kg a piece on record, and no challan of them that counts their pieces.\n' +
    '- **Which part?** reads the floor’s name as one of the client’s parts from then on; **Set its weight** puts a kg a piece on the client’s card.',
    // Version 2: what a line earned, against its cost and its usual day; the week against the four before (owner, 10 Oct 2026).
    // Version 3: the turnaround card (the flow thread, 10 Oct 2026).
    { version: 3 }),
  // Stock as one screen (the tab map, TM4d), and the method its Overview printed under its charts.
  _kbg('stock', 'Using the app: stock', 'The stock message, entry by hand, and reordering', ['pageStock'],
    'Floor → **Stock** is one screen. The card at the top says what is out or low and what the reorder list costs with GST; its tiles (Out, the days-or-less group, OK, No rate) each show only their lines, and a second tap shows them all.\n\n' +
    '- **Paste message** from the supervisor. Every line is shown with what was read. A line that contradicts itself is red: pick the working or the figure written.\n' +
    '- **Enter by hand** for a count, a delivery (with its bill: company, invoice number, price), a use or a charge into the bath.\n' +
    '- A wrong entry is **corrected**, never edited: it is voided and the right figure entered in its place.\n' +
    '- Under **More**: the **Reorder list** (what to order, from which supplier and by when: each supplier’s lead time, set on Money → Payments → Suppliers), **Print sheets**, Export and Import.\n' +
    '- **Compare suppliers**, under each line on the reorder list and on a line’s page: every supplier of the line side by side, with what speaks for and against each. **Order from them** keeps your choice on the line.\n\n' +
    '# Days left\n- A line’s level over its daily use: the use over the last three weeks of record, Sundays out. Under three days of record the figure carries a ?.\n' +
    '- Red at a few days or fewer, amber at a week (Settings → Checks & alerts → Stock alerts). A line charged into a bath is never red at an empty shelf: the delivery going into the bath is the normal state.\n\n' +
    '# Spend and prices\n- At the foot of the list on a phone, in the pane beside it on a computer.\n' +
    '- **Spend by supplier**: six months of bills, before GST. Tap a supplier for its bills and what the bank paid it.\n' +
    '- **Used, by week**: each use at the price paid for that line on the day; a line with no price is named and not counted.\n' +
    '- **Price trend**: one line’s bills; zinc against the market, landed at the uplift and premium set now.',
    // Version 2: one screen, its card and Spend and prices (the tab map, TM4d). Version 3: the reorder list's supplier and its lead time.
    { version: 3 }),
  // Production's four views (the tab map, TM4c), and the method its screens printed under their figures.
  _kbg('production', 'Using the app: production', 'Pickling loads, the register, and what each line plated', ['pageProduction', 'pageFloor'],
    'Floor → Production has four views: **Lines**, **In plant**, **Entries** and **Equipment**. Each starts with a card that says how it stands; tap it on a phone for its figures. The day across the plant is Floor → Overview.\n\n' +
    '# Taking it in\n- **Paste** the pickling loads and the production list from WhatsApp; every line is shown with what was read before anything is saved.\n' +
    '- **Read register photo**: a photo of the VAT register page is read and every row shown for checking. A struck row asks each time.\n' +
    '- **Enter by hand** (under More) when there is nothing to paste. The form stays open for the next entry.\n- A figure is corrected by a new entry, never edited; a wrong one is voided with a reason.\n' +
    '- **Print sheets** (under More): the pickling sheet, the barrel batches and the two VAT register pages for a day, blank to fill by hand or as entered, to file.\n\n' +
    '# Lines\n- The card is the line on the day shown: its efficiency (what it plated against what its working units could plate in the hours it ran) and what it plated, the pieces, what it earned (the rounds, to a role that does not see money) and the power cuts. **Reading the plant’s figures** has how the efficiency splits.\n' +
    '- **Plated** and **Earned** each say how the day stands against the line’s usual day; the card’s facts give the week to the day against the four weeks before, a recorded day’s average on each side. How earnings are worked out: **Using the app: the floor**.\n' +
    '- **One record counts for each line and shift**: the register, else the supervisor’s relay, else an entry by hand. The others are shown as *also reported, not added*: they count the same work another way.\n' +
    '- **The week, plated**: the kilograms each line plated each day, ≈ where any run is estimated, pieces nothing weighs added as pieces; each figure in its day’s efficiency’s colour. A dash is a day with no record for the line. **Earned** under the lines: the three lines’ earnings a day, coloured by their rupee a kilo against what a kilo costs.\n' +
    '- **Plated by line, 4 weeks**: kilograms a day; a gap is a day with no record, or a tenth of its pieces not weighed, never a zero.\n' +
    '- **Labour per kg, 30 days**: the variable labour of the line’s areas (the pool, the daily tier, overtime and the EXTRA), the VAT side’s pickling hands shared by each day’s kilos, over the same days as the kilos (days with nine tenths of the pieces weighed). The monthly crew is the standing crew and is not by line. Withheld under five days; set against the modelled labour (Settings → Labour).\n\n' +
    '# In plant\n- **Book**: everything open on the challans, not invoiced, the same figure as Today’s unbilled.\n' +
    '- The floor splits each open line into *waiting to pickle*, *pickled, not plated* and *plated, not invoiced*, setting a part’s plating and pickling against its challans oldest first. A line billed whole is closed on its last invoice’s day.\n' +
    '- **Waiting to pickle** is withheld until every line is recorded on 90% of the working days: plating on a day not recorded would read as still waiting. Plated, not invoiced reads low, never high.\n' +
    '- A challan received by the kilo is counted in pieces where the part’s kg a piece is known (the client’s card, then part weights, then Parts). A line with none is listed to look at: set the weight on the client’s card.\n' +
    '- Rework counts as work, never as billing, so it is left out here.\n\n' +
    '# Entries\n- The latest thirty, newest first; the rest one tap away. A row says where and when (the line and the shift) and how much (the quantity, with its kilos), and ends in **Correct** (a cut: **Complete** or its reason). Tap it for everything else, and Void.\n' +
    '- Its badges: where it came from (*register*, *relay*, *hand*, *message*, *import*), how its pieces were weighed (*written*, *record*, *challans*, *kind*, *default*, *not weighed*), and what it did not match (*no challan*, *no client*, *gauge unknown*).\n' +
    '- **Filter** (on a phone) lists one kind, or the entries a flag names, every date.\n\n' +
    '# Equipment\n- Every tank, barrel and machine, a card each in its status’s colour: running, standby, under repair, down, with its kg a round and how long it has stood. A line’s capacity is worked out from its units; every change of status is kept with its day.',
    // Version 4: Print sheets (the entry faces' F5, 10 Oct 2026). Version 3: what a line earned, and the day and the week against
    // the line's usual (owner, 10 Oct 2026).
    { version: 4 }),
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
  // Power's four views (the tab map, TM4e), and the method its screens printed under their figures.
  _kbg('power', 'Using the app: power cuts', 'Recording a cut, what it cost, why they come, the load and the case', ['pagePower', 'pageProduction'],
    'Floor → Power has four views: **Cuts**, **Causes**, **Load & bills** and **Case**. Each starts with a card that says how it stands; tap it on a phone for its figures. The day’s cuts are on Floor → Overview’s Power card.\n\n' +
    '# Cuts\n- **Enter a cut** (the time it went and the time it came back); the register’s power log and the messages Production reads bring cuts in too. A cut reported twice is counted once. **Import history** (under More) takes the log kept before the app.\n' +
    '- The card is the month: its cuts, what they cost and a year at this rate (the last 90 days). When a higher load is approved and the bill still charges the old one, that is the first thing to look at, in red.\n' +
    '- **To complete**: a cut with no time back, or a recent one with no reason. **Complete** asks the time back, why it went, where it hit and what brought it back.\n' +
    '- A cut is one line: the day and why, the clock and how long, and what it cost. Tap it for what the cost is made of.\n' +
    '- **What a cut costs** is its damage: a restart (an estimate), the overtime that made the work up on that day and the next, and for the share never made up, the output’s contribution and the platers’ wages that bought nothing. The fixed charge is paid anyway and is not added.\n' +
    '- **Cuts by month** and **When they come** are folded under the cuts. A month with gaps in the record reads low.\n\n' +
    '# Causes\n- The card names the cause that cost most. A tile is coloured only once three cuts stand behind it; with fewer it gives the count.\n' +
    '- **What causes them**, by what they cost: red, in the plant three times or more in 30 days; amber, in the plant; blue, from the grid; grey, not placed.\n' +
    '- **Where they hit**: a tile a place. A line is red where three or more cuts started in the plant in 30 days, amber for one or two; the whole plant is the supply’s.\n' +
    '- **What brings it back**, fastest first: the middle of the minutes from the cut to the power in, over the cuts each fix brought back.\n- The lists of reasons and fixes are the book’s: renamed, placed and merged by the owner.\n\n' +
    '# Load & bills\n- The card is the load as billed against the load approved, with the penalty on the bills since approval. **Edit load** records the approval.\n' +
    '- A bill is one line: its month, its units and peak, and its amount. Tap it for its details; **Details** sets them. Bills are added in Money → Payments.\n\n' +
    '# Case\n- The business case for backup power, drawn from the record every time it is opened or printed. **Print the case**; **Options’ figures** sets the options’ estimates until a quote replaces them.',
    // Version 2: four views, a card on each, the method moved here (the tab map, TM4e).
    { version: 2 }),
  _kbg('pay', 'Using the app: pay', 'What each hand is owed, payments and the weekly payout', ['pageStaff'],
    '- Floor → People → **Pay**, for the pay week (Sunday to Saturday). The card at the top is the week’s payout against its usual (the median of the twelve weeks before, leaving out weeks nobody recorded).\n' +
    '- While the week is open the payout is predicted at its own pace: the days recorded as they are, the rest at the week’s average for a working day. The Sunday is left out of that average, since it is overtime.\n' +
    '- **Due by worker**: each hand’s line is what is due. Tap it for the arithmetic (days × the rate, rest days, overtime hours × the rate, what was paid and what was brought forward) and **Pay** to record a payment or an advance.\n' +
    '- The weekly hands are paid by the week; the monthly hands by the calendar month the week’s Sunday is in. The EXTRA pool is in no one’s due: it is one line on the slip, paid out by the supervisor.\n' +
    '- **Snacks** are a line of the payout: a person once a day, at ₹20 for regular overtime (an evening block, or out at 6 PM or later) and ₹60 for night overtime (a block or an out past midnight), every tier; none for the 6 AM block or the gate’s own hours. The two rates are in Settings → Labour → Overtime.\n' +
    '- **Hours to check**, in the card: a hand named on an overtime block whose own in or out time does not reach it. Pay reads each hand’s own times, so the block’s hours are in nobody’s pay until the day is put right; **Open the day** goes to it.\n' +
    '- **Paid** is the bank’s salaries and the payments typed here. A salary on the statement is read as wages to the hand its name reads as (a name read only as a guess says so; set the payee on the statement once). A payment typed here that the statement also holds is counted once.\n' +
    '- A balance carries to the next period until it is paid, worked off or cleared with a reason (**Brought forward**, each month it is made of named). A monthly hand’s balance counts from the month you set (**Count from a month**): from it on, a month paid short is owed and a month paid over is taken back. A salary is owed from the 21st of the month after.\n' +
    '- **History** on a hand’s line: their last twelve months (or weeks), what each earned, every payment, what it left and the balance after it, and **Print the slip** for any of them. **Pay slips** prints a month picked for every monthly hand.\n' +
    '- A wrong payment is voided with a reason, never deleted.\n' +
    '- **Monthly payroll as paid** (under More: Import): a closed month’s slips. For a month before this one they are what the hands they name earned; with no payment for the month on record, the slip is taken as paid.',
    // Version 4: snacks in the payout and the hours to check (owner, 10 Oct 2026); version 3: paid from the bank's salaries, monthly
    // balances from a month set, a hand's history and any month's slip (the same day).
    { roles: ['owner'], version: 4 }),
  _kbg('bank', 'Using the app: the bank statement', 'Importing it, placing each receipt, and cheques in hand', ['pageFinance'],
    '- Money → Bank, in the toolbar’s More: **Import a statement**: the bank’s own .xls, or the same saved as .xlsx. Rows already in are skipped, so a statement that overlaps the last adds only what is new.\n' +
    '- **Receivables start** on the later of the statement’s first day and the book’s first invoice: a receipt before then paid an invoice the app does not hold.\n' +
    '- **A receipt is set against the client’s invoices**: exactly, where it adds up to one open invoice or a run of them to the rupee; otherwise against the oldest first, never against an invoice raised after it came. What it cannot place stays on account and settles the next invoices.\n' +
    '- **Owed at the start** is what a client owed on the day receivables start. The app offers a figure from the money that came in first; it is never applied until you tap Use.\n' +
    '- **A cheque received** (Receivables → Cheque received, or Add → Cheque) counts as paid the day it came. Its deposit on the statement, found by its number, takes over, so it is never counted twice.\n' +
    '- A cheque deposit names nobody: it is offered to a client by its series or its amount; place it with one tap. A payee set once is remembered.\n' +
    '- **GST**: a month’s due is its output tax less its credit notes; paid is what the bank sent the month after, since a return is paid by the 20th. Paid less than due is the input credit, not a shortfall.', { roles: ['owner'], version: 2 }),
  // Suppliers (suppliers.js; owner, 10 Oct 2026): what is owed to each, and how long each takes.
  _kbg('suppliers', 'Using the app: suppliers', 'What is owed to each, their payments, and how long each takes to deliver', ['pageFinance', 'pageStock'],
    'Money → Payments → **Suppliers** lists every supplier the book names: the company on a stock bill, and a payee set to Supplier on the statement. A row says what is owed and since when, and how long they take to deliver; it opens the supplier.\n\n' +
    '- **Set the balance** from their statement: the figure after its last entry, and that entry’s day. The bills after that day are added and the payments after it taken off. With none set, nothing is said to be owed.\n' +
    '- **A bill** is the stock entries of one invoice: its company, number and date. Its total is its lines before GST with the supplier’s GST (18% unless changed), rounded to the rupee; tap a bill to set its total as printed. One number on two days is flagged: one of them may be typed wrong.\n' +
    '- **Record a payment**: a cheque handed over counts from that day, as their book counts it; when the statement shows it clear by its number, that row is this payment, never a second one. A transfer is the statement’s row of the same amount within a week; cash is recorded here only. A wrong one is voided with a reason.\n' +
    '- A cheque they had credited before the balance’s day that cleared after it: **In their balance** on its row, so it is not counted twice.\n' +
    '- **Change**: the name (the old one is kept as a spelling, so its bills stay), other spellings (the bank’s, a short form), the lead time in working days, the GST. A payee whose initials are a supplier’s short name is offered on Payments → Not yet sorted: **Same supplier** makes its payments theirs.\n\n' +
    '# Lead times and the reorder list\n- Each line is ordered from the supplier it last came from, unless another sold it cheaper in the last six months and can deliver before the line runs out: that one, with the day to order by.\n' +
    '- When the one it came from cannot deliver in time, the fastest that can, and what the hurry costs a unit.\n' +
    '- A supplier with no lead time set is never chosen over the last one: it is named, so its lead time can be set. Zinc follows the market, so its last supplier stands.\n' +
    '- The To-do names a balance whose oldest unpaid part is over 30 days old, only to know.\n\n' +
    '# Compare suppliers\n- Under each line on the reorder list, and **Order from** on a line’s page: every supplier of the line as a card. Each says its price a unit (its last bill, or a price quoted since), its lead time against the days the line has left, what this order comes to, what is owed to it, and what speaks for it (green) and against it (amber, red where it cannot come in time).\n' +
    '- A price over six months old, or a quote over three, is said and not weighed: ask the price again.\n' +
    '- **Order from them** keeps your choice on the line: the list, the line and its task follow it, and say beside it what the app would choose and why. **Let the app pick** puts the choice back.\n' +
    '- **Add a price quoted**: a price a supplier gave you, on the phone or by message, for a supplier that never sold the line or a better price from one that did. It is weighed for 90 days, until a bill from them replaces it.\n' +
    '- A card with no lead time has **Set its lead time**: the supplier opens over the comparison, and the cards follow what you set.', { roles: ['owner'] }),
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
    { version: 3 }),
  // The entry faces (docs/ENTRY_FACES.md, F6): Mine, one guide a face, and the owner's. Each person reads the one for what they
  // enter; the top bar's book on Mine lists them, and the role paths below carry them.
  _kbg('mine', 'Using the app: my screen (Mine)', 'Your day, what you enter, your sheets and the group’s message', ['pageFace'],
    'Signing in opens **Mine**, your own screen: what you enter, and nothing else in the way. It is the first door on your bar.\n\n' +
    '# Your day\n- The day is at the top: **‹ ›** step a day back or on, **Today** comes back. A day past can be entered late.\n' +
    '- The card lists what you enter, in the day’s order, each **in**, **late** or **not yet**. **Enter** opens its form on the day shown.\n' +
    '- A form stays open for the next entry: what repeats is kept, the figures start again. **Done** (or the back arrow) returns to Mine.\n\n' +
    '# What you entered\n- Every record you saved on the day, the latest first. A load, a count or a batch made here shows what it says, with **Send to the group**, **Copy** and **Correct**.\n' +
    '- **Correct** never edits: the corrected entry stays on the record, marked corrected, and the new one takes its place.\n' +
    '- **To check** under an entry means the data it links to does not bear it out (say, a load with no plating found). Nothing is held: your entry counts at once. The owner looks, then keeps it as entered (**Looks right**) or puts it right.\n\n' +
    '# The group\n- **Send to the group** opens WhatsApp with the message written in the shop’s own shape, so the group sees what it always saw. Pick the group and send.\n' +
    '- The same message pasted into the app later is known as already entered and never counted twice.\n\n' +
    '# Paper and backup\n- **Print my sheets**: the blank sheet for each thing you enter, to fill by hand when the phone is not to hand.\n' +
    '- **Print the day as entered**: the day as the app holds it, to file. Each row says how it came in.\n' +
    '- **Sent to GitHub** says whether your entries have left this phone. Offline, they are kept on the phone and go when it is back online.'),
  _kbg('face-pickling', 'Using the app: pickling on Mine', 'A load into the tank, material in, and re-pickling', ['pageFace', 'pageProduction'],
    'The pickling hand’s screen has two forms: **Pickling loads** and **Material in**.\n\n' +
    '# A load into the tank\n1. **Client**: the clients with material open come first.\n' +
    '2. **Part**: that client’s parts, those open on a challan first, with what is open on them. A part not listed: **Not listed: type its name**, written as the floor names it; the owner is asked which part it is.\n' +
    '3. **Quantity** and **Unit** (pieces or kilograms).\n4. **Into the tank at**: now, unless you change it.\n' +
    '5. Tick **Re-pickling or rework** for work done again: it counts as work, never billed.\n6. **Save**, then **Send to the group**, or enter the next load.\n\n' +
    '# Material in\n1. **Client**, then **Challan**: their challans of the week, newest first.\n2. Count each line as it arrives and type the count beside it; a line left blank is not counted.\n' +
    '3. A challan not in the book yet: **Not in the book yet**, then the part, the count and the challan number if one is written. It is matched when the challan is entered.\n4. **Came in at**, then **Save**.\n\n' +
    '# What the owner is asked\n- A load with no plating found by noon of the next working day, where every line it can have gone to was recorded.\n' +
    '- A load past what its challans hold, or with no challan open at all.\n- A count the challan does not bear out (short is red), or a count with no challan in the book a working day on.\n' +
    '- Each is a question, not a refusal: the entry counts as you saved it.'),
  _kbg('face-supervisor', 'Using the app: the supervisor’s screen', 'The in-time and out-time rolls, stock, and the barrel’s batches', ['pageFace', 'pageStaff'],
    'The supervisor’s screen writes the rolls the group receives, enters the stock, and keeps the barrel’s register a batch at a time.\n\n' +
    '# The in-time roll\n1. Each hand is a row: pick where they stand. **Usual places** fills everyone from their own area; change only who moved.\n' +
    '2. **Mark the rest absent** marks whoever is left unplaced (a hand on a 6 AM block is on site).\n' +
    '3. **Add a 6 AM block** for the early shift: tap its lines and its crew, its EXTRA hours and the work done.\n4. **EXTRA on the 8:30 shift**: the hours booked to a line for a hand short.\n' +
    '5. **Save**: the day is written exactly as the same roll pasted would write it. Then **Send to the group**.\n' +
    '- A mark someone typed by hand on the day (People → Attendance, a card scan) is left as it is; the roll says so.\n- Saved again, the roll restates the day rather than adding to it.\n\n' +
    '# The out-time roll\n- **Went home**: everyone present and on no late block, at 5:00 PM unless a time is set.\n' +
    '- **Add a block** for each late slot: from 5:00 PM, or 8:00 PM for the night hold, to when they went out; its lines, its crew, its EXTRA and the work done.\n- **Save**, then **Send to the group**.\n\n' +
    '# Stock\n- **Stock** opens Stock’s own form by hand: a count, a delivery with its bill, a use or a charge into the bath.\n\n' +
    '# The barrel\n1. A batch a row: the **Barrel**, the client, the part, the quantity, when it **went in** and when it **came out**.\n' +
    '2. Tick **Rework** for work done again.\n3. **Save**, then **Send to the group**.\n' +
    '- A batch more than a quarter heavier than its barrel takes is asked of the owner: its kg a round on Production → Equipment, or the barrel’s usual load.'),
  _kbg('face-clerk', 'Using the app: the register clerk’s screen', 'The VAT register page and the attendance sheet', ['pageFace', 'pageStaff', 'pageProduction'],
    'The register clerk’s screen has the **VAT register** page and the **attendance sheet**.\n\n' +
    '# The VAT register page\n1. Pick the line: **VAT A1** or **VAT A2**. A1 is kept a round a row; A2 a batch a row (when it began, when it ended). **Rounds · Batches** changes it for a page kept the other way.\n' +
    '2. Where a run begins, pick the **Client** and write the **Part, as written** on the page. The rows under it carry them, as the paper’s ditto does: **Another client or part** starts the next run.\n' +
    '3. Each round: its **Time** and its **Figure**, exactly as written (120, 3+4×156, 98×8+1). The app adds it up and says under the row what it read.\n' +
    '4. Two clients in one round are a row each, at the same time. A round struck on paper is a row taken off.\n5. **Day total on the paper page**, if it has one: a total the rounds do not meet is said.\n' +
    '6. **Save the page**, then **Send to the group**.\n' +
    '- The page is kept on this phone as you type it, until it is saved: closing the app loses nothing. Saved again, only what changed is put right.\n\n' +
    '# Power cuts\n- **Power cut at** and **Power back at**, then **Save the cut**: it is saved at once, on the day’s one power log, which both lines’ pages show.\n- A cut with no time back has **Power back** to close it later.\n\n' +
    '# The attendance sheet\n- **Attendance sheet** opens People → Attendance → Day as the sheet: a hand a row, P / H / A, the area, in and out.\n' +
    '- Each mark you type carries your name. Where it disagrees with the supervisor’s roll (present on one and absent on the other, a half day, another line), the owner is asked; your mark stands until the owner rules.'),
  _kbg('faces-owner', 'Setting up each person’s screen', 'Who enters what, seeing their screen, and what reaches you', ['pageFace', 'pageHome'],
    'Each person who enters data has their own screen, **Mine**, on their own phone.\n\n' +
    '# Setting it up\n1. Give each person an ID: Settings → Access → **Users & access**.\n' +
    '2. On their user, **Enters**: tick what they enter (the in-time roll, pickling loads, material in, stock, the attendance sheet, barrel batches, the VAT register, the out-time roll). A face is a person’s, never a role’s.\n' +
    '3. Register their phone (Settings → Access → **Devices**, with you present), so what they enter reaches the book through GitHub.\n' +
    '4. **See their screen** on the users list shows Mine as they see it; the next sign-in ends it.\n\n' +
    '# What reaches you\n- Their entries are records at once, marked as entered by them. **Needs you** says who entered each of the day’s inputs.\n' +
    '- Where an entry and what it links to disagree, one task a check and a day asks you to look: **Looks right** keeps it as entered, **Correct** puts it right. The attendance sheet against the roll: **Use the roll’s** or **Looks right**, a hand at a time.\n' +
    '- The WhatsApp group keeps getting its messages: each save offers **Send to the group** in the shop’s own shape.\n\n' +
    '# Paper\n- Each person prints their own blank sheets and the day as entered from Mine. **Print sheets** on Production, under More in its toolbar, prints the pickling sheet, the barrel batches and the VAT pages for any day.',
    { roles: ['owner'] })
];
/* The paths when the book has none of its own: a lesson list per role. */
/* Mine and the face a role most often carries lead each path (F6): a face is a person's, so a path also names the faces a hand of
   that role may be given. */
var KB_APP_PATHS = [
  { id: 'app-path-floor', title: 'New on the floor', role: 'floor', articles: ['app-mine', 'app-face-pickling', 'app-today', 'app-add', 'app-production', 'app-stock', 'app-knowledge'] },
  { id: 'app-path-supervisor', title: 'Supervisor', role: 'supervisor', articles: ['app-mine', 'app-face-supervisor', 'app-face-clerk', 'app-today', 'app-add', 'app-rolls', 'app-day', 'app-production', 'app-stock', 'app-power', 'app-knowledge'] },
  { id: 'app-path-office', title: 'New in the office', role: 'office', articles: ['app-mine', 'app-face-clerk', 'app-today', 'app-add', 'app-challan', 'app-invoice', 'app-states', 'app-credit', 'app-clients', 'app-search', 'app-knowledge'] }
];
