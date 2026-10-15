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
    'Today is the first screen. It has 2 views. After them are its Insights: Stats, Reports and the Planner.\n\n' +
    '# Needs you\n- The day’s 5 inputs are the in-time roll, the pickling loads, the stock message, the production records and the out-time roll. Each input shows **in**, **late** or **not yet**.\n' +
    '- Under the inputs are all the open tasks, in 3 groups: **Now**, **This week** and **Later**.\n- To see why the app raised a task and what clears it, tap the task.\n- A red task is late or wrong. An amber task needs an examination soon.\n' +
    '- To add a task of your own, type it in the field above the tasks. Then tap **Add** or push Enter.\n- To give your task a due date, a note and a link, tap **Details**.\n' +
    '- When your task is done, tick it. The app moves it to **Done**, which is folded at the bottom. To open the task again, tap its tick.\n- A task that you snoozed stays under **Snoozed**. To show it again, tap **Wake**.\n\n' +
    '# Pulse\n- The period at the top (**MTD**, **QTD**, **YTD**, **All**) is the same period that Stats shows.\n- **More**, next to the period, holds **Make a report** (the period as a report), **Open Stats** and **Edit Home**.\n' +
    '- Then come the owner’s questions: is the plant running smoothly, are we making money, is cash coming in. Each question shows what to do.\n- **Do first** shows the moves with the highest value.\n' +
    '- **Why it moved**, **In one line** and **This month at its pace** each give their answer in 1 line. To see the data for an answer, tap it.\n' +
    '- The widgets are below these. To select which widgets show and where, use **Edit Home** (under More).',
    // Version 4: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 4 }),
  _kbg('stats', 'Reading Stats', 'By client, Cost and Trends, and how the app calculates their figures', ['pageStats', 'pageHome'],
    'Stats has 3 tabs. All 3 tabs use 1 period, which is the same period as Pulse. Each tab starts with a card that shows its status. On a phone, tap the card to see its figures.\n\n' +
    '# By client\n- Contribution by client shows the worst client first. It shows what 1 kg leaves after its **variable** cost (all costs but labour), and after the **full** cost.\n' +
    '- **Labour is fixed**. The owner ruled this on 13 Oct 2026. The contract crew does not increase or decrease with the work, and the monthly crew never did. Thus 1 kg more or less changes the zinc, chemicals, power and other costs, but not the wages.\n' +
    '- The app divides cost equally per kg. Thus a thin clamp and a heavy bracket have the same cost per kg here. This is the one assumption that the table cannot examine.\n' +
    '- The app uses this rule for the worst large account. It shows what 1 kg of the account contributes to labour. It shows what it does not pay of the full cost. It also shows the price at which it pays its share.\n' +
    '- **Realisation by client** ranks only the clients with weights on 90% of their revenue. If a client is billed on parts with no weight, the app cannot calculate its price per kg. These accounts are the most likely to be priced too low.\n- To fill in the missing weights, use **Clients → Parts → Derive weights from rates**.\n' +
    '- A client between the variable cost and the full cost still contributes. If you lose that client, the other clients must pay the wages. A client below the variable cost loses money on each kg.\n' +
    '- **Concentration**: a client with no weights adds almost nothing to the measured tonnage. Thus its share of the plant is unknown, not small.\n' +
    '- To quote a client by the piece, each part must have a **weight per piece**. You can put this weight on the client’s card, in **Part weights**, or on **Parts**.\n' +
    '- **Next challan expected** is the median gap between the challans of each client, counted from its last challan. A client is late after that gap. A client is quiet after 1.75 times the gap and also after the gap plus 3 weeks.\n\n' +
    '# Cost\n- The live cost is all the cost lines divided by the kg plated. Each line shows its source.\n\nThe sources of a cost line:\n- **measured**: the app’s own records.\n- **paid, bank**: the bank statement.\n- **part-recorded**.\n- **market rate**: zinc with no bill.\n- **model**: a fallback figure in Settings.\n\nMore about the live cost:\n' +
    '- If a period has no record, the app fills it at the model. The app never uses zero for it. A figure that is lowest where the data is least would make every margin look better than it is.\n' +
    '- **Zinc** goes into the bath when it arrives. Thus, over 1 month or more, the zinc bills are the zinc use. The app uses the zinc bought in the 90 days before, per kg plated in the same days.\n' +
    '- Labour reads **low** when days are not recorded. Each tier is paid only for the days typed. The rest days of the monthly crew also depend on the same attendance.\n' +
    '- **Variable labour by area** puts the hourly pool, the daily tier, overtime and the extra in the area where each was worked.\n- The day pay and rest days of the monthly crew are not in it. That crew is the standing crew, and a split by area would show an allocation that nobody measured. Its overtime is in it, because each overtime hour was worked in a specific area.\n' +
    '- **Recorded against paid** compares the app’s records with what the bank paid. The app marks a difference of more than 10%.\n\n' +
    '# Trends\n- Trends shows the revenue, tonnage, realisation and margin of the period, compared with the same days before.\n- Then it shows 6 months, each at its own live cost. Then the trend and the top items.\n' +
    '- In the 6 months, labour shows only where 90% of the month is recorded, or where the bank statement shows the payments for it. If a month has less, the app does not show its labour, because the figure would be too low.\n- **Measured** is the share of the cost of that month that comes from the app’s own records.\n' +
    '- Realisation is revenue divided by the tonnage of the same lines. The app removes the lines with no weight from both figures. These lines are the low-priced work billed by the piece. Thus a partial figure is too **high**.\n\n' +
    '# Why it moved (on Pulse)\n- The app divides the change in realisation into 2 causes: the rate of each client, and the mix. The mix is the share of the kg of a client, at its rate compared with the average before.\n- The app divides the change in contribution into the price, each cost line and the kg.\n- The causes add up to the change exactly.',
    // Version 2: labour is fixed (owner, 13 Oct 2026), so the worst account is settled one way.
    // Version 3: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 3 }),
  _kbg('add', 'Using the app: the Add button', 'One door for everything that comes in', ['pageHome', 'pageStaff', 'pageStock', 'pageProduction'],
    'All data that comes into the app goes through **Add**. On a phone, **Add** is the filled button in the middle of the bottom bar. On a computer, it is at the top of the rail. You can also push the key A.\n\n' +
    '- **Paste**: a WhatsApp message (an attendance roll, the stock message, pickling loads, a production list). The app reads the message. Before it saves anything, it shows each line next to what it read.\n' +
    '- **File**: a backup, a bank statement, an import from soma-internal.\n- **By hand**: all the forms, for when you have nothing to paste.\n\n' +
    'The app saves nothing until you tap Save on the check that comes next.',
    // Version 2: the photo came out (owner, 13 Oct 2026: the challan scan and the register photo, read by Gemini, never worked).
    // Version 3: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 3 }),
  _kbg('challan', 'Using the app: entering a challan', 'Material in, line by line, checked as you type', ['pageIM'],
    'CAUTION: Do not enter the same challan twice. A duplicate challan records material that did not come in.\n\n' +
    '1. Go to Office → Challans → **Add challan**.\n2. Select the client and type the challan number. If the client already has a challan with that number, the app shows this under the field, with **Open it**.\n' +
    '3. If the app shows a duplicate warning, open the challan that it names before you continue.\n' +
    '4. Add each line. Select the part. The app fills the rate and weight from the client’s record.\n5. If the paper shows a different rate or weight, change it.\n' +
    '6. If a rate or weight is far from the record, the app shows a flag. If the flag is red, select a reason before you save. The reasons are 1 tap each: the customer’s challan says so, the rate changed, the weight differs.\n' +
    '7. Tap **Save**. For the next challan of the same client and day, tap **Save, add another**.\n\n' +
    '# Wanted by a day\n- If the client asks for the material back by a specific day, put the day in **Wanted by** on the form.\n- You can also open the challan and tap **Wanted by**. Set the day for the whole challan, or for 1 line. The day of a line has priority.\n' +
    '- Until its material goes out, the challan shows *Wanted* and the day next to its name. The day is blue before the day, amber on the day and red after it.\n- On the day, if nothing of the challan is plated, the To-do asks about it.',
    // Version 2: a challan wanted by a day (the flow thread, 10 Oct 2026).
    // Version 3: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 3 }),
  _kbg('invoice', 'Using the app: making an invoice', 'From the challans waiting to be billed', ['pageCreate', 'pageIM'],
    '1. Go to Office → Challans. Tick the challans to bill, then tap **Create invoice**. Or open Create and select the client. Its unbilled challans show as tick boxes.\n' +
    '2. Each line comes in at the quantity **left to bill** on its challan. To dispatch part of it, type a smaller quantity. The remainder stays on the challan, waiting.\n' +
    '3. If you bill more than is left, the app asks for a reason. If a line is at ₹0, the app asks why (replating, a sample).\n' +
    '4. If the client has settings for the P.O. and the vehicle, the app fills them.\n5. Tap **Create invoice**.\n6. Print from its preview. The app prints 3 copies: original, duplicate and triplicate.',
    // Version 2: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 2 }),
  _kbg('states', 'Using the app: an invoice’s state', 'Created, printed, dispatched, delivered, filed', ['pageRegister', 'pagePipeline'],
    'An invoice moves through 5 states: **Created → Printed → Dispatched → Delivered → Filed**.\n\n' +
    '- When you print an invoice, the app marks it Printed.\n- When the invoice leaves, mark it Dispatched. When the customer has it, mark it Delivered.\n- The dot of the invoice changes to amber, then to red, the longer it stays in 1 state.\n' +
    '- A Delivered invoice waits for the GST return. The return is due on the 11th of the next month.\n- Office → Pipeline shows all the invoices by state, with the oldest first.',
    // Version 2: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 2 }),
  _kbg('credit', 'Using the app: credit notes', 'A batch rebate, a correction, or a note issued on paper', ['pageRegister'],
    '- **A batch rebate**: in the Register, tick the invoices of the batch. Then make the credit note from the selection.\n' +
    '- **A correction** (rate, goods returned, short quantity): go to Office → Invoices → **Credit notes** (under More) → **New note**. Make the note against 1 invoice, with a reason.\n' +
    '- **A note already issued on paper**: go to Office → Invoices → **Credit notes** (under More) → **Record issued**.\n\nTo record a note issued on paper:\n1. Enter its own number and year, its date and the GST as printed.\n2. Enter the invoice that it names. Select the invoice, or type it as printed if it is not in the register.\n3. For a rebate, enter its discount and the period that it covered.\n4. The form stays open for the next note.\n\n' +
    'You can cancel a credit note. You cannot delete it.',
    // Version 3: the door is under More, and a past note's own year and period (owner, 13 Oct 2026: past notes to be recorded).
    // Version 4: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 4 }),
  _kbg('clients', 'Using the app: clients and sales', 'Clients, their parts, how each is doing, and the work being won', ['pageClients'],
    'Office → Clients has 3 views: Clients, Parts and Performance. Office → Sales has 2 views: Prospects and Quotations. Each view starts with a card that shows its status.\n\n' +
    '# Clients\n- A dot and a word next to a client show the worst problem the app found for it. The words include **past terms** (owed after its payment terms), **gone quiet**, **below cost**, **to bill** (challans waiting) and **note due** (a rebate note due).\n- To see all the tasks for a client, open the client.\n' +
    '- The card at the top counts the clients that have a problem, worst first.\n\n' +
    '# Parts\n- **No weight** lists the parts billed by the piece that have no weight per piece. The app cannot price these parts per kg, so tonnage and realisation do not include them.\n- **Derive weights** (under More) fills the weights that the rate card of a piece client gives.\n' +
    '- **Unused** lists the parts that no invoice has billed. **Select unused** and **Merge** are under More.\n\n' +
    '# Performance\n- Performance shows 1 client at a time. It shows month on month as revenue, tonnage or rate per kg. Then it shows the parts of the client by **cadence**.\n' +
    '- The app compares each part with its own rhythm, across invoices and challans.\n- A part is **stopped** when 2 conditions are true. The gap since it last came is more than 1.75 times its usual gap. The gap is also more than its usual gap plus 3 weeks. A fixed limit would mark a quarterly part as stopped in its second month.\n' +
    '- **New**: the part came first in the last 60 days. **Steady**: the part keeps its rhythm. **One-off**: the part came once, long ago, and never had a rhythm.\n' +
    '- A stopped part and a new part can have the same first 6 letters and digits. If so, the app marks them as possibly 1 part with a new name.\n- A part is its size or number, and its gauge. Thus 2 spellings of 1 clamp are 1 part.\n' +
    '- **Materials worked**: each part sent in a period, in pieces and kg, with its challans, invoices and platings. If another client also sends the same code, the app counts it separately, here and on Stats.\n' +
    '- **By the hour**: a round is pickling, plating and a constant time for logistics and the other steps. The constant is 15 minutes, set on the panel.\n- 1 hour costs the plant its cost over the last 90 days, divided by the working days × 3 lines × 16 hours. A part that earns less than this in 1 hour loses money each hour.\n' +
    '\nUnder a part, **what to look at** shows these problems:\n- Plating is slower than before. Examine the jig loading, the current, temperature and concentration of the bath, and the waits between rounds.\n- Racks are less full than their maximum. Full racks earn more each hour in the same time.\n- Logistics is 25% or more of a round. Use longer lots, and make the next load ready before the round ends.\n- Pickling is slower than plating. Pickle the next load while the current load plates.\n- A set plating time does not agree with the record. **Use** replaces it with the measured time.\n\n' +
    '# Sales\n- **Prospects** are the firms that the owner approached, by stage (new, contacted, sample, quoted, won, lost). Each prospect has its next follow-up. A follow-up that is due is amber. A follow-up that is 1 week late is red.\n' +
    '- The **pipeline** is the tonnes each month that the prospects can send. The app multiplies each prospect by the chance at its stage: new 10%, contacted 20%, sample 40%, quoted 60%. These chances are an assumption, not a measurement.\n' +
    '- The **spare** is the quantity that the plant can plate each month but does not. The app compares the invoiced tonnes of the last 90 days with about 2 t a shift, 2 shifts each working day.\n' +
    '- **Won** opens the client form, filled from the prospect.\n' +
    '- **Quotations**: a draft has no number. **Issue** gives it a number.\n- You cannot edit an issued quotation. **Revise** makes the next revision.\n- When a client accepts a quotation, the app offers its rates to the client’s record. The app never writes them without your approval.\n' +
    '- **To reprice**, in the Quotations card, lists the moves from Pulse for the clients billed below the cost. Each move opens a draft quotation.',
    // Version 2: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 2 }),
  _kbg('rolls', 'Using the app: the attendance rolls', 'Pasting the in-time and out-time rolls', ['pageStaff', 'pageFloor'],
    '1. Copy the roll from WhatsApp.\n' +
    '2. Open Add → Paste. You can also open Floor → People → Attendance → Day → **Paste message**.\n' +
    '3. Paste the roll. The app reads who, where and when on each line.\n' +
    '4. Examine each name. If the app is not sure of a name, the line shows **read as** with a picker. If the app cannot place a name, the line stays red until you place it.\n' +
    '5. Examine each line, then tap **Save**. The app keeps each spelling that you place.\n' +
    '6. Paste the out-time roll the same way. It updates the day.\n\n' +
    'A roll never changes a mark that a person typed or changed by hand. This includes the area of the mark. It also includes an out-time roll that puts the hand on a later block. Pay’s **Hours to check** shows such a hand, so that you can correct the day.',
    // Version 3: a mark changed by hand and the hours to check (10 Oct 2026); version 2: Paste message is Attendance's, on Day (TM4b).
    // Version 4: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 4 }),
  // Attendance (the tab map, TM4b): Day, Week and Month under one tab, and the method each screen used to print above its figures.
  _kbg('day', 'Using the app: attendance', 'Floor → People → Attendance: the day, the week and the month', ['pageStaff', 'pageFloor'],
    'Floor → People → **Attendance** has 3 views on a switch below its toolbar: **Day**, **Week** and **Month**. Each view starts with a card that shows the status. On a phone, tap the card to see its figures.\n\n' +
    '# Day\n' +
    '- The card compares the people on site with the roster of the day. It also shows the areas that are short of the number for the day. Its figures are on site, half day, absent and not marked.\n' +
    '- **Board** shows each area as a card. Tap once to set P, H or A. Tap a name to open the day of that hand. It shows the area, the in time, the out time and the area of each overtime shift.\n' +
    '- **Sheet** is the clerk’s sheet. It has 1 row for each hand. Type the in and out times as they are on the paper. The app calculates the hours and the OT.\n' +
    '- **Paste message** takes the rolls. **Print sheets** prints the blank forms and the day as entered, for the file. On a phone, **Print sheets** is under More.\n\n' +
    '# Extra hours\n' +
    '- Extra hours are hours that the sheet books to an area, not to a named hand. They are the **EXTRA n HOURS** lines on the daily sheet. The bill counts them once, under the EXTRA line.\n' +
    '- Each row is 1 line with the area, the slot, the hours and the crew. Tap the row to see its times, its crew and the number needed. If a row has no times or no crew, it stays open, in amber.\n' +
    '- The extra of a general shift covers a missing hand for a full 8 hours. An **OT block** covers the hand for the length of the block. Thus an OT block needs its in time, its out time and its crew. The marks of the day do not supply these. A hand who is on 1 area all day can work in the evening block of a different area.\n\n' +
    '# Needed today\n' +
    '- This compares the hands in each area on the general shift with the number that the shift needed. The box starts at the usual number of the area (People → Areas).\n' +
    '- Type the number for the day. Type **0** if the line needed nobody. Clear the box to use the usual number. The app calculates the shortfall and the extra against this number.\n' +
    '- An OT block or a night block has its own number on its row under Extra hours.\n\n' +
    '# Week\n' +
    '- The card compares the attendance of the week with the rest-day gate (90% and 80%). It also shows the days that nobody recorded, and the payout until now.\n' +
    '- Tap a cell of the grid to change it. Each tap sets the next state: present, half day, absent, then not marked.\n' +
    '- A cell that is not marked is a day that nobody typed. This is not the same as a day that nobody worked. The labour figures keep the 2 separate.\n' +
    '- The figure in a cell is the hours that set the pay. For the hourly pool, it is the full day. For all other hands, it is the overtime.\n\n' +
    '# Month\n' +
    '- This is the register of the supervisor, 1 page for each month. The app compares it with the day as the app keeps it. The card counts the cells that are different, the cells that are only on the register and the cells that agree.\n' +
    '- The app shows each cell as it is written. A red cell has a mark that is different from the day. An amber cell has only a different overtime, by 1 hour or more. A plain cell agrees, or it is only on the register. A dashed edge shows a cell that the app was not sure how to read.\n' +
    '- Tap a cell to see the 2 values. Then select one of them: **Day takes the register’s** or **Register takes the day’s**.\n' +
    '- **Fill** puts each cell that is only on the register onto its day. The app asks you first.\n' +
    '- **Import** takes a register file. **Start this month** gives a column to each monthly hand. You fill the column by hand.\n\n' +
    '# Labour on Day and Week\n' +
    '- The app pays each tier for the days and hours that are recorded. Thus if nobody typed some days in a range, the labour figure is **low**, not neutral. The monthly tier is low twice. A day that nobody typed also lowers the attendance that its rest-day gate uses.\n' +
    '- The rest-day gate is a monthly rule. For a range shorter than a month, the gate examines each rest day on that range only. The rest credit of the daily tier counts the days in the range. Thus if a range cuts a week in half, the credit for that week is too low.\n' +
    '- **Variable labour by area** puts the hourly pool, the daily tier, overtime and the extra in the area where each was worked. It does not include the day pay and rest days of the monthly crew. That crew is the standing crew, and its cost does not follow the area where it stood. It includes the overtime of the monthly crew, because each overtime hour was worked in a specific area.\n' +
    '- **The extra** is hours that the sheet books to an area, not to a person. They are real paid hours with no name on them. In the bill, they are 1 pooled line. The bill counts them once and never in the wage of a person. The crew present in the short area receive the extra pro-rata. The supervisor pays it out, and People → Areas shows the split.',
    // Version 2: Attendance's three views on a switch, and each screen's method moved here (the tab map, TM4b). Version 3: the labour
    // card's three paragraphs, each a line on the card now (TM6e). Version 4: the page photo came out (owner, 13 Oct 2026).
    // Version 5: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 5 }),
  // The method the Areas screen printed above its figures, in five paragraphs (the tab map, TM4b): the screen now says the verdict.
  _kbg('areas', 'People: the areas and the extra', 'Staffing by area, and how the extra hours are checked', ['pageStaff'],
    'Floor → People → **Areas** shows the attendance by place. It shows if each area has the correct number of hands, and if the extra is correct. The card at the top shows if the extra agrees with the rule. If it does not agree, the card shows how many bookings you must explain.\n\n' +
    '# The rule\n' +
    '- If a hand is missing from an area that runs at full capacity, the crew who are there cover the work. The sheet then books **8 hours** to that area for the missing hand. Thus the expected extra is **8 × (the area’s number − the heads)** for each area, each day. The app compares this with the hours booked.\n' +
    '- An OT block books the same way, but at the length of the block, not 8. For example, a 5 PM to midnight block that is short 2 hands books 14. The overtime of the named hands is separate and is not included.\n' +
    '- For the calculation, barrel and barrel pickling are 1 unit of 5. A VAT line in a block brings its pickling hands with it. 1 line needs 2 of the 3 pickling hands. 2 lines need all 3. No block needs 4.\n' +
    '- The number is the complement of the area. The full floor is VAT A1 4, VAT A2 4, Barrel 3, Barrel pickling 2 and Pickling A1 and A2 3. If Needed today sets a number for the day, the app uses that number. If no number is set, the app can only count the extra. It cannot examine it.\n\n' +
    '# How to read the check\n' +
    '- **More booked than the shortfall explains** is what the rule does not permit. Examples are hours on top of named columns, a tag on a full area, or a figure that is larger than the gap.\n' +
    '- **Less booked** is not an error. An area that is short **and** runs light needs no cover. Also, nothing here measures the output of an area. Thus the expected figure is the maximum, not a target.\n' +
    '- A unit can have no marked hands but still have hours. The app reads that unit as fully short and fully covered. For example, a pickling row with no heads books 24 hours against a number of 3, which is 8 × 3 exactly. The row passes the check. It shows that nobody typed the marks of that day.\n' +
    '- If nobody stood on a unit and nobody booked hours to it, the unit did not run. The app does not include it.\n\n' +
    '# The rows to explain\n' +
    '- These rows are flags on the paperwork. From here, 3 errors look the same: hours booked to the wrong area, an area that nobody typed, and hours that nobody worked. The row gives the area and the day. Use the sheet to find the cause.\n' +
    '- **Explain** records why a row is correct, against its figures. The figures can change later, for example when a person corrects a crew or types a tag again. Then the note does not agree with the figures, and the row comes back.\n' +
    '- To examine a block, the app needs 3 things: its in and out times, its named crew and the areas it covers. If 1 is missing, the block is **Not checkable**. Its hours are still paid. But they are not evidence about the staff.\n\n' +
    '# Staffing by area\n' +
    '- The app counts heads from the marks of the day. Thus a hand who moved to a different area counts where they stood. Averages use the recorded days, not the calendar days.\n' +
    '- If no number is set, the app shows the median of the area as the only reference.\n' +
    '- Hands on **Flex** count against no area. To put them in an area, set their area on the Day.\n\n' +
    '# The extra, paid pro-rata\n' +
    '- The crew present in the area receive its extra between them (owner, 28 Aug 2026). The extra stays 1 pooled figure under EXTRA on the slip. The supervisor pays it out. The shares are the split that he uses to pay it. Nothing here goes into the wage of a hand.\n' +
    '- The app marks a share that is more than 1 shift a day. For example, 24 hours of cover against 2 hands is 12 hours each. Examine such a share against the record before you read it as pay.',
    // Version 2: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 2 }),
  // Floor's Overview (the tab map, TM4a): how its cards are read, which used to be a note under them (§1a-5).
  _kbg('floor', 'Using the app: the floor', 'The day across the plant: people, production, stock, power and turnaround', ['pageFloor'],
    'Floor opens on its **Overview**. It shows the day across the plant, with 1 card for each subject, then 1 card for each line. Use the arrows to go to a different day. Tap **Today** to go back to today.\n\n' +
    '# The cards\n' +
    '- **People** compares the people on site with the roster of the day. It also shows the lines that are short of the number for the day. It is green at 90% on site. It is amber at 80%, or when the floor is short of its number. It is red below 80%.\n' +
    '- **Production** shows what the day plated, and the line with the worst result. ≈ shows that a part of the figure is an estimate. ≥ shows that the figure does not include pieces that have no weight.\n' +
    '- **Stock** shows the lines that are out and low now, not on the day shown. It also shows the cost of the reorder list with GST.\n' +
    '- **Power** shows the cuts of the day and how long the power was off, the month until that day, and a year at this rate. While the bill does not show an approved load, it also shows the load to chase.\n' +
    '- **Turnaround** shows the number of working days from the challan of the material until it goes out. It is the median of the last 90 days, weighted by value, compared with the target. The target is 1 working day (Settings → Checks & alerts → Turnaround and terms). A client can have its own target, and so can a part on the client.\n' +
    '- Open **Turnaround** to see the days to pickling, to plating and to despatch. If your role sees money, it also compares the days from the invoice to its payment with the terms. Then it shows the lines past the target now and the jobs wanted by today. Its link opens In plant.\n' +
    '- Tap a card to see what it rests on. Its link opens its screen. A role sees only the cards of the screens that it opens.\n\n' +
    '# The lines\n' +
    '- There is 1 card for each line, the worst first: red, then amber, green and blue.\n' +
    '- **Staffing** compares the heads of the general shift with the number for the day (People → Attendance → Needed today). Barrel is barrel and barrel pickling, as 1 unit.\n' +
    '- **Plated** shows the figure that counts for each shift, as Production → Lines shows it. A day that nobody recorded is a gap, not a zero.\n' +
    '- **Earned** is for a role that sees money. See **What a line earned** below. A role that does not see money sees the kilos compared with the usual day of the line.\n' +
    '- For the efficiency of a line and how it splits, see **Reading the plant’s figures**.\n\n' +
    '# What a line earned\n' +
    '- This is the runs of the line at the rates on record of their clients, before GST. A part of a piece client uses its piece rate. A run in kilos uses the rate a kg of the client. A run in pieces uses that rate over its weight. ≈ shows that the weight is an estimate. Rework is not billed, so the app does not include it.\n' +
    '- The figure is green if its rupee a kilo covers the cost of a kilo. It is amber if it is just below, and red if it is below. The cost of a kilo is the live cost over the 90 days to the day. If there is no live cost, it is the full cost in Settings.\n' +
    '- Below it is the **usual day** of the line. This is the median of its recorded days in the 60 days before, with 5 days minimum. For the kilos, each day must have 9 tenths of its work weighed. For the earnings, each day must have 9 tenths of its work priced. If the day has not ended, the figure shows *so far*.\n' +
    '- If a tenth or more of the work has no rate, the card shows how much has no rate. The figure is then low.\n' +
    '- Open the **Production** card to see what the work of the day is worth, **At the live cost** (the cost of its kilos), **Left after it** and the labour on the record. It also shows **This week, a day plated** and **a day earned**, compared with the 4 weeks before. Each side uses the average of a recorded day. A day that is not recorded is a gap, not a zero. **Not priced** lists the work that no rate prices, with the door to the rates of the client.\n\n' +
    '# Not weighed\n' +
    '- These are pieces plated with no weight in the book. They have no kg a piece on record, and no challan that counts their pieces.\n' +
    '- **Which part?** makes the app read the name that the floor uses as one of the parts of the client, from then on. **Set its weight** puts a kg a piece on the card of the client.',
    // Version 2: what a line earned, against its cost and its usual day; the week against the four before (owner, 10 Oct 2026).
    // Version 3: the turnaround card (the flow thread, 10 Oct 2026).
    // Version 4: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 4 }),
  // Stock as one screen (the tab map, TM4d), and the method its Overview printed under its charts.
  _kbg('stock', 'Using the app: stock', 'The stock message, entry by hand, and reordering', ['pageStock'],
    'Floor → **Stock** is 1 screen. The card at the top shows what is out or low, and the cost of the reorder list with GST. Its tiles are Out, the days-or-less group, OK and No rate. Tap a tile to show only its lines. Tap it again to show all the lines.\n\n' +
    '- **Paste message** from the supervisor. The app shows each line with what it read. If a line does not agree with itself, it is red. Then select the working or the figure written.\n' +
    '- Use **Enter by hand** to record a count, a delivery, a use or a charge into the bath. A delivery needs its bill: the company, the invoice number and the price.\n' +
    '- Do not edit a wrong entry. **Correct** it. The app voids the entry and records the correct figure in its place.\n' +
    '- **More** has the **Reorder list**, **Print sheets**, Export and Import. The **Reorder list** shows what to order, from which supplier and by when. It uses the lead time of each supplier. Set the lead time on Money → Payments → Suppliers.\n' +
    '- **Compare suppliers** is under each line on the reorder list and on the page of a line. It shows all the suppliers of the line side by side, with the good and bad points of each. **Order from them** keeps your choice on the line.\n\n' +
    '# Days left\n' +
    '- This is the level of a line divided by its daily use. The daily use is the use over the last 3 weeks of record, without Sundays. If there are less than 3 days of record, the figure shows a ?.\n' +
    '- A line is red at a few days or fewer, and amber at a week (Settings → Checks & alerts → Stock alerts). A line that is charged into a bath is never red when the shelf is empty. The delivery goes into the bath, and this is the normal state.\n\n' +
    '# Spend and prices\n' +
    '- On a phone, this is at the bottom of the list. On a computer, it is in the pane beside the list.\n' +
    '- **Spend by supplier** shows 6 months of bills, before GST. Tap a supplier to see its bills and what the bank paid it.\n' +
    '- **Used, by week** shows each use at the price paid for that line on that day. If a line has no price, the app names it and does not count it.\n' +
    '- **Price trend** shows the bills of 1 line. For zinc, it compares the bills with the market. The market uses the uplift and the premium that are set now.\n' +
    '- **The zinc market** is LME × (1 + the uplift) + the premium (Settings → Costing → Zinc rate). The app calculates it for each day that a Refresh kept. The app compares the price of a bill before GST with the market on its day. It uses the last LME up to 4 days before. The amount of each supplier over the market is weighted by the kilos.\n' +
    '- **Timing** puts each bill in the market of the 30 days before it: near the low, in the middle or near the high.',
    // Version 2: one screen, its card and Spend and prices (the tab map, TM4d). Version 3: the reorder list's supplier and its lead time.
    // Version 4: the zinc market's working, which the price trend printed under its chart (the tab map, TM7).
    // Version 5: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 5 }),
  // Production's four views (the tab map, TM4c), and the method its screens printed under their figures.
  _kbg('production', 'Using the app: production', 'Pickling loads, the register, and what each line plated', ['pageProduction', 'pageFloor'],
    'Floor → Production has 4 views: **Lines**, **In plant**, **Entries** and **Equipment**. Each view starts with a card that shows the status. On a phone, tap the card to see its figures. Floor → Overview shows the day across the plant.\n\n' +
    '# Put the data in\n' +
    '- **Paste** the pickling loads and the production list from WhatsApp. Before the app saves, it shows each line with what it read.\n' +
    '- The register clerk types **the VAT register’s page** as written, on **Mine**. You can also enter it here by hand. The app reads both the same way. It applies the START rule, asks about a struck row each time and reads the total of the day.\n' +
    '- If there is nothing to paste, use **Enter by hand** (under More). The form stays open for the next entry.\n' +
    '- To correct a figure, make a new entry. Do not edit the figure. To remove a wrong entry, void it with a reason.\n' +
    '- **Print sheets** (under More) prints the pickling sheet, the barrel batches and the 2 VAT register pages for a day. Print them blank to fill by hand, or as entered for the file.\n\n' +
    '# Lines\n' +
    '- The card shows the line on the day shown. It shows its efficiency, what it plated, the pieces, what it earned and the power cuts. A role that does not see money sees the rounds, not the earnings.\n' +
    '- Efficiency is what the line plated compared with what its working units could plate in the hours it ran. **Reading the plant’s figures** shows how the efficiency splits.\n' +
    '- **Plated** and **Earned** each compare the day with the usual day of the line. The facts of the card compare the week to the day with the 4 weeks before. Each side uses the average of a recorded day. For how the app calculates earnings, see **Using the app: the floor**.\n' +
    '- **One record counts for each line and shift**. The order is the register, then the relay of the supervisor, then an entry by hand. The app shows the others as *also reported, not added*. They count the same work in a different way.\n' +
    '- **The week, plated** shows the kilograms that each line plated each day. ≈ shows that a run is an estimate. Pieces that have no weight are added as pieces. Each figure has the colour of the efficiency of its day. A dash is a day with no record for the line.\n' +
    '- **Earned**, below the lines, shows the earnings of the 3 lines each day. The colour of each compares its rupee a kilo with the cost of a kilo.\n' +
    '- **Plated by line, 4 weeks** shows kilograms a day. A gap is a day with no record, or a day with a tenth of its pieces not weighed. It is never a zero.\n' +
    '- **Labour per kg, 30 days** is the variable labour of the areas of the line divided by the kilos. Variable labour is the pool, the daily tier, overtime and the EXTRA. The kilos of each day share the pickling hands of the VAT side. The labour and the kilos use the same days, which are the days with 9 tenths of the pieces weighed.\n' +
    '- The monthly crew is the standing crew and is not by line. The app does not show **Labour per kg** for less than 5 days. The figure has no colour. The modelled labour (Settings → Labour) includes all tiers, the monthly crew too, so it is not a measure of this part only.\n\n' +
    '# In plant\n' +
    '- **Book** is all that is open on the challans and not invoiced. It is the same figure as the unbilled figure on Today.\n' +
    '- The floor splits each open line into *waiting to pickle*, *pickled, not plated* and *plated, not invoiced*. The app compares the plating and the pickling of a part with its challans, oldest first. A line billed whole is closed on the day of its last invoice.\n' +
    '- The app does not show **Waiting to pickle** until each line is recorded on 90% of the working days. If not, plating on a day that is not recorded shows as still waiting. Plated, not invoiced can show low, but never high.\n' +
    '- If the app knows the kg a piece of the part, it counts a challan received by the kilo in pieces. It looks first at the card of the client, then part weights, then Parts. If a line has no kg a piece, the app lists it for you to examine. Set the weight on the card of the client.\n' +
    '- Rework counts as work, never as billing. Thus it is not included here.\n\n' +
    '# Entries\n' +
    '- The list shows the latest 30, newest first. Tap once to show the rest. A row shows where and when (the line and the shift) and how much (the quantity, with its kilos). It ends in **Correct**. For a cut, it ends in **Complete** or its reason. Tap the row to see all the other data, and Void.\n' +
    '- Its badges show where it came from (*register*, *relay*, *hand*, *message*, *import*). They show how the app weighed its pieces (*written*, *record*, *challans*, *kind*, *default*, *not weighed*). They also show what it did not match (*no challan*, *no client*, *gauge unknown*).\n' +
    '- **Filter** (on a phone) shows 1 kind, or the entries that a flag names, for all dates.\n\n' +
    '# Equipment\n' +
    '- Each tank, barrel and machine has a card in the colour of its status: running, standby, under repair or down. The card shows its kg a round and how long it has had that status. The app calculates the capacity of a line from its units. The app keeps each change of status with its day.',
    // Version 4: Print sheets (the entry faces' F5, 10 Oct 2026). Version 3: what a line earned, and the day and the week against
    // the line's usual (owner, 10 Oct 2026). Version 5: the register photo came out (owner, 13 Oct 2026).
    // Version 6: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 6 }),
  // How the analysed figures are worked out (§6.27): the screens show the verdict, its factors and a folded working; the reasoning is
  // here, one tap away on the top bar's book (owner, 9 Oct 2026: "designing a way to present our analysed data in a coherent manner").
  _kbg('plant-figures', 'Reading the plant’s figures', 'A line’s efficiency, the round and the pace, and stock by line', ['pageFloor', 'pageProduction', 'pageStock'],
    '# A line’s efficiency\n' +
    'Efficiency is what the line plated compared with what its working units could plate in the hours it ran, less the power cuts. 4 factors multiply to give it:\n' +
    '- **Time**: the rounds run compared with the rounds that the hours allowed. The rounds allowed are the hours divided by the pace.\n' +
    '- **Racks**: how full each round was, compared with the fullest round of its part.\n' +
    '- **Parts**: the weight of a full round of the parts of the day, compared with the round of the line. Lighter parts are the work, not a fault.\n' +
    '- **Weighed**: rounds with no weight make the figure low.\n\n' +
    'The caption above the tiles names the factor that changed the figure most. **How it’s worked out**, below the tiles, lists each input on 1 row.\n\n' +
    '# Measured, set or typed\n' +
    '- **Measured**: the app reads the figure from the register. The kilos of a round are measured when 30 rounds on 5 days rest on the weights of the parts. The pace is measured when 5 shifts of 8 rounds or more are on it.\n' +
    '- **Set** or **typed**: a person entered the figure by hand. It stays until the measure from the register is firm.\n\n' +
    '# Stock by line\n' +
    'This compares what went into the bath of each line with what the line plated.\n' +
    '- The app compares each addition (zinc, a salt, a brightener) with what its line plated until the next addition went into the same bath.\n' +
    '- The last addition is still in the bath. Its figure is **so far**, and it decreases as the line plates more. The app does not include it in the figure of the line.\n' +
    '- If the line has no record for some days, the app fills those days at the pace of the recorded days. If less than half of the days are recorded, the app sets nothing.\n' +
    '- If a use names 2 baths, the app shares it by what each line plated. If 1 line is not recorded, the app shares it equally. A use that names no bath belongs to the plant.\n\n' +
    '# The signs\n' +
    '- **≈** shows an estimate. **≤** shows the maximum. Pieces that have no weight make the kilograms short.\n' +
    '- **—** shows that the app does not show the figure. The reason is beside it.',
    // Version 2: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 2 }),
  // Power's four views (the tab map, TM4e), and the method its screens printed under their figures.
  _kbg('power', 'Using the app: power cuts', 'Record a cut, its cost, its causes, the load and the case', ['pagePower', 'pageProduction'],
    'Floor → Power has 4 views: **Cuts**, **Causes**, **Load & bills** and **Case**. Each view starts with a card that shows the status. On a phone, tap the card to see its figures. Floor → Overview’s Power card shows the day’s cuts.\n\n' +
    '# Cuts\n- To record a cut, tap **Enter a cut**. Enter the time the power went and the time it came back.\n' +
    '- The app also gets cuts from the register’s power log and from the messages that Production reads. If 2 reports give the same cut, the app counts it once.\n' +
    '- To import the log kept before the app, tap **More** → **Import history**.\n' +
    '- The card shows the month: its cuts, their cost and the cost of a year at this rate (from the last 90 days).\n' +
    '- If a higher load is approved and the bill still charges the old load, the card shows this first, in red.\n' +
    '- **To complete** lists a cut with no time back, or a recent cut with no reason. Tap **Complete** to record the time back, why the power went, where the cut hit and what brought the power back.\n' +
    '- Each cut is 1 line: the day and the reason, the clock times and the length, and the cost. Tap the line to see the parts of the cost.\n' +
    '- **What a cut costs** is its damage. The damage is a restart (an estimate) and the overtime that made up the work on that day and the next day. For the share of work that was never made up, the damage also has the output’s contribution and the platers’ wages for no work. The shop pays the fixed charge in all conditions, so the app does not add it.\n' +
    '- **Cuts by month** and **When they come** are folded under the cuts. If the record has gaps in a month, the figure for that month is low.\n\n' +
    '# Causes\n- The card names the cause with the highest cost. A tile gets a colour only when 3 or more cuts are behind it. With fewer cuts, the tile shows the count.\n' +
    '- **What causes them** sorts the causes by cost. Red is a cause in the plant 3 or more times in 30 days. Amber is a cause in the plant. Blue is a cause from the grid. Grey is a cause that is not placed.\n' +
    '- **Where they hit** has 1 tile for each place. A line is red if 3 or more cuts started in the plant in 30 days. It is amber for 1 or 2 cuts. The tile for the whole plant is the supply’s.\n' +
    '- **What brings it back** sorts the fixes, fastest first. For each fix, the app uses the median minutes from the cut to the power in, over the cuts that the fix brought back.\n' +
    '- The lists of reasons and fixes are in the book. The owner renames, places and merges them.\n\n' +
    '# Load & bills\n- The card compares the load as billed with the load approved. It also shows the penalty on the bills since approval. To record the approval, tap **Edit load**.\n' +
    '- Each bill is 1 line: its month, its units and peak, and its amount. Tap the line to see its details. To set the details, tap **Details**. Add bills in Money → Payments.\n\n' +
    '# Case\n- The case is the business case for backup power. The app makes it from the record each time you open or print it.\n' +
    '- To print it, tap **Print the case**.\n' +
    '- Until a quote replaces them, **Options’ figures** sets the estimates for the options.',
    // Version 2: four views, a card on each, the method moved here (the tab map, TM4e).
    // Version 3: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 3 }),
  _kbg('pay', 'Using the app: pay', 'What each hand is owed, payments and the weekly payout', ['pageStaff'],
    '- Floor → People → **Pay** shows the pay week (Sunday to Saturday). The card at the top compares the week’s payout with its usual payout. The usual payout is the median of the 12 weeks before. The app does not use weeks that nobody recorded.\n' +
    '- While the week is open, the app predicts the payout at the week’s own pace. It uses the recorded days as they are. For the other days, it uses the week’s average for a working day. The app does not use the Sunday in that average, because the Sunday is overtime.\n' +
    '- **Due by worker** has 1 line for each hand. The line shows what is due. Tap the line to see the calculation: days × the rate, rest days, overtime hours × the rate, what was paid and what was brought forward. To record a payment or an advance, tap **Pay**.\n' +
    '- The shop pays the weekly hands by the week. It pays the monthly hands by the calendar month that contains the week’s Sunday.\n' +
    '- The EXTRA pool is not in the due of any hand. It is 1 line on the slip, and the supervisor pays it out.\n' +
    '- **Snacks** are a line of the payout. Each person gets snacks once a day, in all tiers. Regular overtime is ₹20: an evening block, or out at 6 PM or later. Night overtime is ₹60: a block or an out past midnight. There are no snacks for the 6 AM block or for the gate’s own hours. The 2 rates are in Settings → Labour → Overtime.\n' +
    '- **Hours to check**, in the card, lists a hand named on an overtime block whose own in or out time does not reach the block. Pay uses the own times of each hand. Thus, the block’s hours are in the pay of no hand until you correct the day. To go to the day, tap **Open the day**.\n' +
    '- **Paid** is the bank’s salaries and the payments typed here. The app records a salary on the statement as wages to the hand that its name matches. If the app only guesses the name, it says so. Set the payee on the statement once. If the statement also holds a payment typed here, the app counts it once.\n' +
    '- A balance carries to the next period until it is paid, recovered by work, or cleared with a reason. **Brought forward** shows each balance and names each month in it.\n' +
    '- A monthly hand’s balance starts from the month that you set with **Count from a month**. From that month, a month paid short is owed, and a month paid over is taken back.\n' +
    '- A salary is owed from the 21st of the month after.\n' +
    '- Tap **History** on a hand’s line to see their last 12 months (or weeks). It shows what each period earned, each payment, what each payment left and the balance after it. To print the slip of any of them, tap **Print the slip**.\n' +
    '- **Pay slips** prints the slips of a selected month for all monthly hands.\n' +
    '- If a payment is wrong, void it with a reason. The app never deletes a payment.\n' +
    '- **Monthly payroll as paid** (**More** → **Import**) holds the slips of a closed month. For a month before this month, the slips are the earnings of the hands they name. If no payment for the month is on record, the app takes the slip as paid.\n' +
    '- In **Wages paid, from the bank**, a cash draw (SELF, TO SELF, TO CASH) is wages and the owner’s drawings. For each pay week, the cash is wages up to the payout recorded for that week. Cash drawn above that payout is drawings, and it is never a cost. If a week has no attendance recorded, the app cannot split its cash. The app compares a transfer to a hand on the roster with the payroll as paid for the month before.',
    // Version 5: how the bank's cash draws are read, said on Pay's panel until the tab map (TM6e). Version 4: snacks in the payout and
    // the hours to check (owner, 10 Oct 2026); version 3: paid from the bank's salaries, monthly balances from a month set, a hand's
    // history and any month's slip (the same day).
    // Version 6: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { roles: ['owner'], version: 6 }),
  _kbg('bank', 'Using the app: the bank statement', 'Import it, place each receipt, and record cheques in hand', ['pageFinance'],
    '- To import a statement, go to Money → Bank and tap **More** → **Import a statement**. Use the bank’s own .xls file, or the same file saved as .xlsx. The app skips rows that it already has. Thus, a statement that overlaps the last one adds only the new rows.\n' +
    '- **Receivables start** on the later of 2 days: the statement’s first day and the day of the book’s first invoice. A receipt before that day paid an invoice that the app does not have.\n' +
    '- The app compares each receipt with the client’s invoices. If the receipt equals 1 open invoice, or a run of them, to the rupee, it is an exact match. If not, the app puts it against the oldest invoice first. The app never puts a receipt against an invoice made after the receipt came. The app keeps what it cannot place on account, and uses it to pay the next invoices.\n' +
    '- **Owed at the start** is what a client owed on the day receivables start. The app offers a figure from the money that came in first. The app does not apply the figure until you tap **Use**.\n' +
    '- A cheque received counts as paid on the day it came. To record one, tap Receivables → **Cheque received**, or Add → **Cheque**. When the cheque’s deposit is on the statement, the app finds it by its number and uses it in place of the cheque. Thus, the app never counts a cheque twice.\n' +
    '- A cheque deposit does not name the payer. The app offers it to a client by its series or its amount. Tap once to place it. The app keeps a payee that you set once.\n' +
    '- In **GST**, the due for a month is its output tax less its credit notes. Paid is what the bank sent the month after, because the shop pays a return by the 20th. If paid is less than due, the difference is the input credit, not a shortfall.',
    // Version 3: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { roles: ['owner'], version: 3 }),
  // Suppliers (suppliers.js; owner, 10 Oct 2026): what is owed to each, and how long each takes.
  _kbg('suppliers', 'Using the app: suppliers', 'What is owed to each, their payments, and how long each takes to deliver', ['pageFinance', 'pageStock'],
    'Money → Payments → **Suppliers** lists all suppliers that the book names. A supplier is the company on a stock bill, or a payee set to Supplier on the statement. Each row shows what is owed and since when, and how long the supplier takes to deliver. Tap a row to open the supplier.\n\n' +
    '- To set the balance, use their statement and tap **Set the balance**. Enter the figure after its last entry, and the day of that entry. The app adds the bills after that day and subtracts the payments after it. If no balance is set, the app does not show an amount owed.\n' +
    '- A bill is the stock entries of 1 invoice, with the same company, number and date. Its total is its lines before GST plus the supplier’s GST, rounded to the rupee. The GST is 18% unless you change it. To set the total as printed, tap the bill. If 1 bill number is on 2 days, the app flags it, because one of them can be a typing error.\n' +
    '- To record a payment, tap **Record a payment**. A cheque handed over counts from that day, as their book counts it. When the statement shows the cheque clear by its number, the app uses that row as this payment, not as a second payment. A transfer is the statement’s row of the same amount within 1 week. Record cash here only. If a payment is wrong, void it with a reason.\n' +
    '- A cheque can be in their balance before the balance’s day and clear after it. For such a cheque, tap **In their balance** on its row, so that the app does not count it twice.\n' +
    '- With **Change**, you can change the name, the other spellings, the lead time in working days and the GST. The app keeps the old name as a spelling, so its bills stay with the supplier. Other spellings can be the bank’s spelling or a short form.\n' +
    '- If a payee’s initials are a supplier’s short name, Payments → Not yet sorted offers it. Tap **Same supplier** to make its payments the supplier’s payments.\n\n' +
    '# Lead times and the reorder list\n- The reorder list puts each line under the supplier that last sold it. If another supplier sold it cheaper in the last 6 months and can deliver before the line runs out, the list uses that supplier. It then shows the day to order by.\n' +
    '- If the last supplier cannot deliver in time, the list uses the fastest supplier that can. It shows what the faster delivery costs for each unit.\n' +
    '- The app never chooses a supplier with no lead time over the last supplier. It names that supplier, so that you can set its lead time. Zinc follows the market, so its last supplier stays.\n' +
    '- The To-do shows a balance whose oldest unpaid part is more than 30 days old. This is for information only.\n\n' +
    '# Compare suppliers\n- To compare, use the button under each line on the reorder list, or tap **Order from** on a line’s page. The app shows each supplier of the line as a card.\n' +
    '- Each card shows the price for each unit: its last bill, or a price quoted since then. It also shows its lead time against the days the line has left, the cost of this order and what is owed to it. Green shows what is good for the supplier. Amber shows what is bad for it. Red shows that it cannot deliver in time.\n' +
    '- If a price is more than 6 months old, or a quote is more than 3 months old, the card says so. The comparison does not use that price. Ask for the price again.\n' +
    '- Tap **Order from them** to keep your choice on the line. The list, the line and its task then use your choice. Beside it, they show the app’s choice and the reason.\n' +
    '- To give the choice back to the app, tap **Let the app pick**.\n' +
    '- Tap **Add a price quoted** to record a price that a supplier gave you on the phone or by message. Use it for a supplier that never sold the line, or for a better price from a supplier that did. The comparison uses it for 90 days, or until a bill from that supplier replaces it.\n' +
    '- A card with no lead time has **Set its lead time**. Tap it to open the supplier over the comparison. The cards change when you set the lead time.',
    // Version 2: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { roles: ['owner'], version: 2 }),
  _kbg('search', 'Using the app: search and keys', 'Find anything, and the shortcuts', ['pageHome'],
    '- To search, tap the magnifier or press Ctrl K. Search finds invoices, challans, clients, parts, workers, stock lines, quotations, credit notes, articles here, and screens.\n' +
    '- Numbers match whole numbers only: 834 finds invoice 00834, never 8341.\n' +
    '- Press **A** to open Add. Press **Backspace** to go back. To open a screen in a new window, press Ctrl and click.',
    // Version 2: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    { version: 2 }),
  _kbg('knowledge', 'Using the app: the knowledge base', 'Read, write, approve and train', ['pageKnow'],
    '- Tap the book in the top bar to open the guides for the screen that you are on.\n' +
    '- Tap **Write** to write an article. An article can be a how-to, a process, a part, a client requirement, a ruling, a fault, an incident or a decision.\n' +
    '- If a person other than the owner writes an article, it waits for the owner’s approval. A change to a published article waits beside the article.\n\n' +
    '# 3 ways to read an article\n' +
    '- **Quick** shows *At a glance* and 1 line for each part of the article. Tap a line to read that part in full.\n' +
    '- **Read** shows the whole article as a manual page. A WARNING is red, a CAUTION is amber and a NOTE is blue. A screen path, for example Office → Challans, is a link to that screen.\n' +
    '- **Step by step** shows 1 step on the screen. Tap **Next** and **Back**. At the end, the owner or the supervisor can record the training. For a fault, it shows 1 cause at a time: tap **Found it** or **Not this**.\n' +
    '- On a phone, an article opens on Quick. A supervisor or a floor hand opens a lesson of their path on Step by step until they are trained on it.\n\n' +
    '# Around the article\n' +
    '- On a phone, tap the bar at the bottom of the article to see its context and its notes.\n' +
    '- On a computer, the Library is on the left, the article is in the middle and its context is on the right. Tap **«** to make the Library narrow.\n' +
    '- The context shows the plant now for what the article links to (a line, a client, a part, a stock line, an area), how new that data is, and what the article led to.\n' +
    '- Anybody can add a note to an article. The owner can make a note private. NOTE: A private note is hidden from the other IDs, but it goes with the book in backups and GitHub sync. It is not encrypted.\n\n' +
    '# The Library\n' +
    '- Type a question in **Ask**. The app shows the articles that match, the best first, with the line that matched.\n' +
    '- With nothing typed, the Library shows the articles you opened last and the shelves. Tap **See all** for the list of a shelf, or **Every article** for the full list.\n' +
    '- In **Troubleshoot**, find a fault by what you see. If something goes wrong, record an incident. The app then shows that day as recorded.\n' +
    '- In **Training**, record who was taught each lesson. When a lesson changes, the training is due again.\n' +
    '- A photo stays on the device that took it.\n' +
    '- **Start** shows what waits: articles to approve, drafts, decisions due for review and training due again.\n' +
    '- On a phone, the kind and the drafts are under **Filter**. In the Library, **Export** and **Import** are under **More**. Only the owner can use them.',
    // Version 3: rewritten in Simplified Technical English (owner, 14 Oct 2026).
    // Version 4: the 3 ways to read, the context, notes and the Library's shelves (KB2-1, 15 Oct 2026).
    { version: 4 }),
  _kbg('writing', 'Writing an article', 'The house style: Simplified Technical English, 80% of the way', ['pageKnow'],
    'Every article in the knowledge base uses Simplified Technical English (ASD-STE100). This is the standard of aircraft maintenance manuals. We follow it 80% of the way.\n\n' +
    '# Sentences\n- Write one instruction in one sentence.\n- A step has 20 words or fewer. A description has 25 words or fewer.\n' +
    '- Start a step with the verb: **Tap Save.** **Count the racks.**\n- Put a condition before the step: *If the roll is late, ask the supervisor.*\n' +
    '- Use the active voice. Say who does the action: *The owner approves the change.*\n- Use simple tenses: present, past and future (*will*).\n\n' +
    '# Words\n- Use one word for one thing, and use it the same way every time.\n' +
    '- Use plain verbs: *make*, *use*, *show*, *put*, *keep*, *calculate*, *compare*, *examine*. Do not use idioms or phrasal verbs.\n' +
    '- Use *must* for a requirement and *can* for a possibility. Do not use *should*.\n- Write numbers as digits: 3 days, 20 kg, ₹100.\n\n' +
    '# Paragraphs and steps\n- Write one topic in one paragraph. A paragraph has 6 sentences or fewer.\n' +
    '- Write a sequence as numbered steps (start the line with `1. `). Write facts of the same kind as a list (start the line with `- `).\n' +
    '- Give each part a heading (start the line with `# `).\n\n' +
    '# Warnings\n- If a step can lose data or money, write a warning before the step.\n- Start it with **WARNING:** and say the risk and the result in short sentences.\n' +
    '- If a step can cause a fault or damage, start it with **CAUTION:**. For useful data that is not a risk, start it with **NOTE:**.\n\n' +
    '# At a glance\n- Each article opens with *At a glance*: up to 4 lines, each a label and a value, for example *Where: Office → Challans*.\n' +
    '- If you leave the field empty, the app makes the lines from the article. The field shows these lines before you type.\n' +
    '- Write a line only if the app’s line is wrong or not useful. A line has 90 characters or fewer.\n\n' +
    '# What we keep (the other 20%)\n- The labels of the app, as the screen shows them, in bold: **Take it and register**, **Needs you**.\n' +
    '- The terms of the shop and the trade: challan, GSTR-1, realisation, live cost, EXTRA, round, rack, gauge.\n' +
    '- Every fact. Do not remove a rule, a number or an exception to make a sentence shorter.',
    // Version 2: CAUTION and NOTE, and At a glance (KB2-1, 15 Oct 2026).
    { roles: [], version: 2 }),
  _kbg('printer', 'Setting up: the office printer', 'Print from any phone on the office printer, through GitHub sync', ['pageRegister'],
    'The app on a phone cannot get to a printer on the office Wi-Fi. So a print goes through GitHub. The phone puts the job there, and 1 computer in the office prints it. This computer is the **print station**.\n\n' +
    '# Before you start\n- Make sure that GitHub sync is set up on every device that sends, and on the station (*Setting up: GitHub sync*).\n' +
    '- If the guard is on, make sure that each of these devices is registered (*Setting up: a new device*).\n\n' +
    '# On the station computer, once\n1. Add the printer to Windows: Settings → Bluetooth & devices → Printers & scanners → **Add device**. If Windows does not find it, use **Add manually** and type its address on the Wi-Fi. Print a test page.\n' +
    '2. Make it the **default printer**. Switch off *Let Windows manage my default printer*.\n' +
    '3. Right-click the shortcut that opens the app, then select **Properties**. At the end of **Target**, type a space and then `--kiosk-printing`. Close all Chrome or Edge windows. Open the app from that shortcut. If you do not do this step, each job opens the print dialog and waits for a click.\n' +
    '4. Do not let the computer sleep while the office is open. In Settings → System → Power, set sleep to **Never**.\n\n' +
    '# In the app\n1. In Settings → Connections → **Office printer**, tick **Send prints to the office printer**. The name, the address and the cartridge of the printer are notes for the next person who sets it up.\n' +
    '2. On the station only, tick **This device is the print station**. Tap Save.\n' +
    '3. Keep the app open on the station. The station looks for jobs every 15 seconds, and when the app comes into view.\n' +
    '4. On every other device, pull from GitHub once (or wait for the next sync). Then the device knows that the printer is on.\n\n' +
    '# Send a print\n- Open a print preview (an invoice, a credit note, a certificate, a statement, pay slips, a report). Tap **Send to office**.\n' +
    '- **Office printer** in Settings lists what you sent. A job shows **waiting** with **Cancel**, then **printed**. When the station prints a Created invoice, the app marks it **Printed**.\n' +
    '- If a job waits more than 3 minutes, the app asks if the station is on. Make sure that the computer is not asleep and the app is open on it.\n' +
    '- On the office Wi-Fi, a phone can also use **Print** as before, through the print service of Android.',
    { roles: ['office'], version: 1 }),
  _kbg('sync', 'Setting up: GitHub sync', 'One book on every device: the token, push, pull and what both changed', [],
    'Each device keeps the book. GitHub sync keeps a copy in a private GitHub repository. Then the phone and the desktop use the same book. The copy is also the backup.\n\n' +
    '# Set it up on a device\n1. In GitHub, make a **fine-grained token** for this repository only, with **Contents: Read and write**. Make 1 token for each device. Then, if you lose a phone, you revoke only the token of that phone.\n' +
    '2. In Settings → Connections → **GitHub sync**, type the owner, the repository, the branch and the file. These are the same on every device. Type the token. Tap Save.\n' +
    '3. On a new device, tap **Pull from GitHub** first. Then the device starts from the book. If a device has entries of its own, push them instead.\n' +
    '4. Tick **Back up automatically after changes**. The app sends a change approximately 45 seconds later.\n\n' +
    '# Push and pull\n- **Push to GitHub** sends the book of this device. **Pull from GitHub** gets the copy on GitHub.\n' +
    '- If both sides changed since they last met, the app merges them record by record. If both sides changed the same thing, the change of the owner stays. The app holds the other change for you (GitHub sync → *Held for you*) and adds a task on Needs you. You then keep it or swap it.\n' +
    '- CAUTION: **Replace from GitHub** discards the book on this device and uses the GitHub copy. Only the owner can do it, and the app asks first.\n\n' +
    '# With the guard on\n- A device pushes and pulls only after it is registered (*Setting up: a new device*). Until then, it can only import a backup.\n' +
    '- The app keeps the token locked to the device. A backup or a copy on GitHub never has the token.',
    { roles: ['office'], version: 1 }),
  _kbg('devices', 'Setting up: a new device', 'Register a phone or a computer, for you or for someone on the team', [],
    'If the guard is on, a device syncs only after the owner registers it. Do the registration **on the new device**. The owner must be present to give the owner’s PIN.\n\n' +
    '# Before you start\n1. If the ID of the person is new, add it on a device that already syncs (Settings → Access → **Users & access** → **Add user**). Then tap **Push to GitHub**. A new device sees only the IDs in the book that it holds. It gets them from GitHub.\n' +
    '2. On the new device, open the app. Set up **GitHub sync** with the token of that person (*Setting up: GitHub sync*). Do **not** turn the guard on there.\n\n' +
    '# Register\n1. In Settings → Access → **Devices**, give the device a name (*Shop desk*, *Supervisor’s phone*). For **Who mainly uses it**, keep the owner.\n' +
    '2. Tap **Register this device**. Type the ID and PIN of the owner.\n' +
    '3. Tap **Take it and register**. The device gets the GitHub copy with all the IDs and PINs in it. The device goes on the list and sends the copy back.\n' +
    '4. **Who mainly uses it** now lists everyone. Select the person and tap **Save details**.\n' +
    '5. Lock the app (the ID button in the top bar → **Lock now**). The person signs in with their own ID and PIN.\n\n' +
    '# If something stops you\n- *This device has its own IDs*: someone turned the guard on on this device by itself. Give the PIN of the owner as set on the device that pushed. This device then takes that book and its IDs.\n' +
    '- *Enter the GitHub details first*: GitHub sync is not set up, or its fields are not saved.\n' +
    '- If the owner removes a device, the device stops sync and forgets its token. To bring it back, register it again.',
    { roles: ['owner'], version: 1 }),
  _kbg('guard', 'Setting up: IDs, PINs and roles', 'The guard: who opens what, and what asks for a PIN', [],
    'If the guard is off, anyone who holds a device can change anything. If the guard is on, each person signs in with an ID and a PIN. Each role opens only its screens.\n\n' +
    '# Turn it on\n1. On the device you use most, go to Settings → Access → **Users & access** → **Turn on the guard**. Type your ID and PIN as the owner.\n' +
    '2. CAUTION: If you forget the owner PIN and you do not have the recovery code, the books stay locked. Write down the **recovery code** that the app shows. Keep it away from the phone.\n' +
    '3. Tap **Add user** for each person. Type the name, the role (Office, Supervisor, Floor) and the PIN. Tell each person their PIN.\n' +
    '4. Tap **Push to GitHub**. Then register every other device (*Setting up: a new device*). Turn the guard on **once**, on 1 device only. The other devices get it from GitHub.\n\n' +
    '# The roles\n- The grid under the users shows **What each role opens and may change**: pages, floor entries, rates, payments, settings, and if the role sees wages and money.\n' +
    '- An important change (an invoice, a rate, a payment, a void, Settings) asks for the PIN again after the set minutes pass.\n\n' +
    '# Every day\n- The app locks after the set minutes in the background. When you open the app, it asks for a PIN.\n' +
    '- The ID button in the top bar has **Change my PIN**, **Switch user** and **Lock now**.\n' +
    '- **Reset PIN** on a user gives the user a new PIN. **Deactivate** keeps the history of the user and stops their sign-in. The other devices get an added, reset or deactivated user with the next push and pull.',
    { roles: ['owner'], version: 1 })
];
/* The paths when the book has none of its own: a lesson list per role. */
/* Mine and the face a role most often carries lead each path (F6): a face is a person's, so a path also names the faces a hand of
   that role may be given. */
var KB_APP_PATHS = [
  { id: 'app-path-floor', title: 'New on the floor', role: 'floor', articles: ['app-mine', 'app-face-pickling', 'app-today', 'app-add', 'app-production', 'app-stock', 'app-knowledge'] },
  { id: 'app-path-supervisor', title: 'Supervisor', role: 'supervisor', articles: ['app-mine', 'app-face-supervisor', 'app-face-clerk', 'app-today', 'app-add', 'app-rolls', 'app-day', 'app-production', 'app-stock', 'app-power', 'app-knowledge'] },
  { id: 'app-path-office', title: 'New in the office', role: 'office', articles: ['app-mine', 'app-face-clerk', 'app-today', 'app-add', 'app-challan', 'app-invoice', 'app-states', 'app-credit', 'app-clients', 'app-search', 'app-knowledge'] }
];
