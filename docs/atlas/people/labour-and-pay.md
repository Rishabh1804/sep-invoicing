---
subject: "Labour, Pay, pay slips, the payroll as paid"
domain: people
modules: [split/payroll.js, split/payslip.js, split/labour.js, split/staff.js]
specs: []
tests: [P174, P205, P207, P213, P250, P260, P262]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Labour and attendance
Floor → People. Labour is ₹3.55/kg of an ₹8.55 cost and 42% of it — the largest line in the
business — and until this it was one number typed into Settings and checked against nothing.
Two questions had sat open across three handoffs: **how staff is allocated**, and **what "the
extra" stands for**. They are the same question wearing different clothes — which of this bill
is fixed and which of it scales with tonnage — and nothing could answer it because nothing
measured it.

**Three views over one store.** Day is for entry (present / half / absent, area, and hours).
Week is a **Sun–Sat** grid whose cells cycle, for fixing what the day view got wrong, with the
`15/20` headcount row the daily relay already speaks in. Roster is the master: comp class,
rates, home area, and whether the worker is on the plant floor.

**The week is the PAY week: Sunday to Saturday, numbered by its Saturday** (owner, 25 Sep 2026).
The weekly tiers are paid on Saturday and a Sunday worked is paid that coming Saturday, so the
Sunday opens the week rather than closing it. It used to be a Mon–Sat grid with no Sunday at
all, which left every Sunday OT day off the one view meant for checking a week. The number is
the ISO week of the Saturday, which is the week the payout files are named after
(`2026-W38-payout-2026-09-19`). The daily tier's weekly rest credit is judged on the same week.

### Pay
People → **Pay** (`payroll.js`), for the selected pay week (owner, 25 Sep 2026).

- **Due by worker = earned − paid**, over the worker's own period: the week for the hourly and
  daily tiers, the calendar month of the week's **Sunday** for the monthly tier (the QA sweep, 30 Sep 2026: it was the Saturday's, so in a month's last pay week Pay showed the next month at 0 and hid this one's) (to today while it
  runs). Earned is `labourForRange().byWorker`, the labour card's own arithmetic, split per worker.
  **The EXTRA pool is in no one's due**: it is one line on the slip, disbursed by the supervisor.
- **A balance carries from one period to the next** (owner, 30 Sep 2026: *"yes, unless stated otherwise and notification
  cleared"*; `payCarried`). A due left unpaid is owed next period, an advance not worked off is still to be worked off, and a
  monthly salary paid on the 14th of the next month pays the month it was for (it used to read as an advance against the new
  month, and an advance vanished when its period turned). It is counted from the period of the worker's first payment recorded
  in the app (a monthly hand's, the month before): before that nothing was typed here, and every past wage would read as owed. A
  month on record as paid is settled. People → Pay lists **Brought forward**, each with **Clear**, which asks for a reason and
  settles every period up to the one before (`S.payCarryClears`, undone, never deleted); the To-do rule **`payCarry`** asks until
  each balance is paid, worked off or cleared.
- **Paid is the bank's salaries and the payments typed here** (owner, 10 Oct 2026: *"no way to see and print the pay slip of each
  employee and/or what they have been paid, we have all the information in our data but not linked yet"*: August's two salaries
  paid to each other's accounts, and the gate hand's ruled figure paid short, were to be adjusted in September; P205). A salary
  transfer on the statement read as wages to a hand on the roster (`payBankLegs`: the bank's own reading of the payee, a guessed
  name said as one) is a payment (`payPaymentsOf`, `payPaymentsFor`, `payPaidFor`); a payment typed here that the statement also
  holds (the same hand, within a rupee, three days apart) is counted once, an advance as an advance, for the month it is dated in (it had counted twice: the leg as the month before's salary too), and listed once in *Payments in these periods*, on the leg's row (*typed on Pay too*). The statement is money: a role that sees wages and not money sees what was paid, never the bank's legs as the bank's (`paySeesBank`: no *by bank*, no legs in the list, no *Salaries paid from the bank*, *Crossed with another hand*, the slip's *Paid on …* alone). Paid had been the typed payments alone, so every salary
  paid by transfer read as unpaid, and the August legs paid to each other's accounts were invisible.
- **A month on the payroll as paid is set against what was paid for it** (`payPeriodRow`): the slip is what was earned; with no
  payment for the month known it is settled by the slip, as before; with one, the difference stands (a difference under a rupee is
  none: the shop pays whole rupees; Pay's row and the slip say it, *Rounded to the rupee*, so they foot). A month whose payroll is on
  record but does not name the hand, with nothing paid to them, is settled too (*not on the slip*: a hand new to the monthly tier had
  read the whole month as unpaid). Pay's row says *Not on the month’s slip* and the slip *Paid outside the month's payroll*, so both
  foot. A closed month with no mark for the hand, paid only by the bank's legs (none typed on Pay), is settled as well (*no earnings
  recorded*, `unknown`): what it earned is not known, so neither is a difference; it had carried the whole salary as paid over. Two hands each paid what the
  other earned are named (`payCrossedWith`): *the bank legs crossed with … 's*.
- **Monthly balances count from a month the owner sets** (`S.labour.payCarryFrom`, Pay → *Count from a month*, P1 payments): from
  it on, a month paid short is owed and a month paid over is taken back; before it, months are settled as they stand. The
  statement's legs never start a balance by themselves (they reach back months before any earnings were recorded). Each
  brought-forward line names its months (`payPartWords`): *August 2026: paid ₹12,456.00 against ₹15,796.80 on the slip, the bank
  legs crossed with …'s*; a month's payment that settles what it earned and what was brought into it, each to the rupee, leaves
  nothing. A weekly hand's balance still starts at the first payment typed for them (paid in cash, never on the statement by name).
  The month offered must have its earnings known (a slip or attendance); last month only while no month is. Once balances count, `wageVsSlip` stays quiet: Pay carries
  each month.
- **Snacks are what the supervisor paid** (owner, 7 Nov 2026, on the week to 7 Nov, where the per-head rule came to ₹1,820 and
  Shyam's message said *NASTA120*: *"Use Shyam's method"*). His nasta is cash he spent and reports: ₹1,390 for the week to 31 Oct
  (no count of ₹20s and ₹60s makes it), *"NASTA 2200 / 2 WEEK"* in September. So the payout's snacks are that figure, typed for the
  pay week on Pay's payout card (**Enter** / **Change**, `paySnacksSet`, behind the payments permission; `S.paySnacksPaid[weekStart]`
  `{amount, at, by}`, in the change log and the merge), nothing until typed. The per-head rule of 10 Oct 2026 (`paySnacks`,
  `paySnackKind`, Settings' `snackOt` / `snackNight`) is retired; the forecast leaves the typed figure out of the week's pace. The
  bank's cash split still reads the payout, so the snacks are wages there. **A data flow changed**: `S.paySnacksPaid` travels with the
  book (backups, GitHub, the merge). P207, P260.
- **Hours to check** (`payCrewGaps`, Pay's card and To-do rule **`payCrewGap`**, a floor task): a hand named on an overtime block whose
  own times do not reach it (out at or before its start, in at or after the 6 AM block's end, or marked absent). Pay reads each
  hand's own times, so the block's hours were in nobody's pay: on the week of 4 Oct a mark whose area was changed by hand kept the
  out-time roll from carrying it to 6 AM (13 hours) while the roll named the hand on the night. **Open the day** goes to it. P207.
  Said on Pay's card face too (*N hands with hours to check*, the card a warning), since its fold is shut on the phone. A block from
  midnight to 4 AM is the night's: its crew's outs are read, never their ins (P213).
- **Last month's salary is owed from the 21st** (`payOverdue`, `PAY_SALARY_BY_DAY`): the To-do's `payCarry` and the motivation index
  read the balance as of today, so the days before payday raise nothing; Pay itself shows last month's salary brought forward.
- **A hand's history** (a due row's **History**, `payHistoryOpen`): the last twelve months (a weekly hand's weeks), newest first,
  from the first with anything in it, each a row with what was paid as its figure and a word for its state (paid, paid short, paid
  over, not paid, as the slip, not on the slip, no earnings recorded, to date); opened, where the earnings came from, each payment,
  a crossing, the balance after it, and **Print the slip** (`psOne`). Payments in these periods lists the bank's legs too, without a
  Void.
- **Pay all due** (owner, 9 Nov 2026: *"For weekly payout, I have to individually go and mark paid for every worker. We should have
  an option to mark multiple at once"*; `payAllOpen`, `payAllSave`, P262): over the weekly group where two or more weekly hands have
  something due, one row opens a list of them, each ticked at what is due, its amount editable, one day for all; Save records a
  payment a hand ticked (`note`: the week), behind the payments permission. The monthly crew is paid one at a time, on its month.
- **Payments and advances** are recorded here (`S.staffPayments: [{id, staffId, date, amount,
  kind: payment|advance, note, at, voidedAt?, voidReason?}]`). A wrong one is **voided with a
  reason, never deleted**. A negative due is an advance not yet worked off. Tapping a worker fills
  the form with what is due.
- **Weekly payout** = the weekly tiers' earnings + the EXTRA pool. While the week is open it is
  **predicted at its own pace**: the recorded days as they are, and the unrecorded Mon–Sat days
  at the week's average per recorded working day. The Sunday is taken out of that average, its snacks
  with it, because it is overtime and does not repeat. With nothing recorded yet, the median stands in and says so.
  **Swing** is measured against the median of the twelve weeks before, leaving out weeks with
  nothing recorded, because a week nobody typed is not a cheap week. The history lists the twelve
  weeks, each with what was paid against it.
- **Hours by area** (Areas view): every tier's hours on each mark, where the worker stood that
  day, with OT among them and the EXTRA booked to the area. A mark with no hours counts 8 (4 for
  a half day), and the card says how many were counted that way.
- **Home → Attendance today** (a widget): today's on-site count against the active roster, floor heads against
  the complement, the absentees by name, and the EXTRA booked. If nothing has been typed today,
  it shows the last day that has, and names it.

**Three comp classes, because the shop pays three ways** — and the first cut of this module got
two of them wrong by shipping a single `contract` class.

| | Paid | Rest days | Overtime |
|---|---|---|---|
| `monthly` | ₹/day × weekdays worked, + one day per Sunday or paid holiday worked | per calendar month: Sundays × the attendance gate, paid holidays in full | weekdays only: day rate ÷ 8 × 1.1, **capped at ₹68.20/h from 1 Sep 2026** |
| `hourly` | every hour at one flat rate | — | none: the fourteenth hour is paid like the first |
| `daily` | ₹/day × days worked | one day per full week | hour rate × the multiplier |

**Monthly overtime is ruled (owner, 25 Sep 2026): *"monthly hands get OT at day rate ÷ 8 × 1.1. Capped at
68.2"*.** Hours over 8 on a day are overtime. The cap is per hour after the multiplier, so it binds any day
rate above ₹496 (a ₹560 day rate would pay ₹77.00 and pays ₹68.20). It is in Settings → Labour → Overtime (`otCap`), and
`workerOtHourPay()` is the one place both the labour card and the Areas cost read it. The hourly and daily
tiers are not capped by it. ⚠ **This settles a disagreement in the record rather than creating one:** the
history imported up to 7 Sep carries almost no monthly overtime (July 0 h, August 11 h), while September's
pasted rolls carry 381 h (₹23,340 at the cap). By the ruling, **July and August understate what the monthly
crew earned**, and their labour ₹/kg (₹2.07, ₹2.29) reads low by that overtime.

🔧 **The cap applies from 1 September (owner, 25 Sep 2026: *"Cap applies from September"*).** July and August
were paid at rate ÷ 8 × 1.1 uncapped — Shyam's August OT at ₹79.20 — so `workerOtHourPay(w, cfg, iso)` caps
only OT dated on or after `labour.otCapFrom` (`2026-09-01`, Settings → Labour → Overtime). Called with no date it caps,
which is the rate going forward.

**The monthly tier is BM's model (10 Sep 2026), per calendar month:** `gross = rate × (weekdays worked +
paid holidays + Sundays × gate + Sundays worked) + weekday OT`. It reproduces the ruled August slip's day pay
to the rupee for 8 of 9 hands off the imported marks; the ninth, the gate hand, is one day short in the marks.
- **The gate is the ratified 100 / 50 / 0** at 90% and 80%, and attendance is **weekdays worked ÷ the month's
  working days** — Sundays and paid holidays out of both sides. A festival is not a holiday: 28 Aug (Raksha
  Bandhan) was ruled an absence.
- **Paid holidays are always paid** (BM: *"National holiday is always paid"*): `labour.holidays`, the three
  national holidays as `MM-DD`, or a full date for a one-off. A hand with no day recorded in the month is
  credited nothing — a month nobody typed is not a month of holidays.
- **A worked Sunday keeps its gated credit and is paid one day on top** (BM, 10 Sep: *"keep the worked sunday
  credit"*), and its hours are that day, **never OT as well** — which would pay them twice (the July slip took
  a hand's Sunday hours out of OT for exactly that reason). The app reads a worked paid holiday the same way:
  its own reading until the owner kept it, 13 Oct 2026.
- **A contracted monthly wage** (`worker.monthWage`, the worker's Edit on People → Roster): BM, 14 Sep, of a hand on a
  contracted wage (the name and the wage made up here, *"Kiran is 8700/month. per day is calculated as per days in that
  month"*), *"His sundays are not gate sensitive"* and *"Sunday is inside the 8700"*. So the day rate is wage ÷ days in
  the month, the Sundays are credited in full, and a Sunday worked adds nothing. 22 + 1 + 5 = 28 × 8700/31 = ₹7,858.06. The worker's total is rounded once
  from the unrounded parts, or 28 days reads a paisa high.
- Over a range shorter than a month the gate is judged on the part of the month the range covers, as before.

### Pay slips
People → Pay → Due by worker → **Pay slips** (`payslip.js`; owner, 7 Oct 2026, the second of *"Start with 1 and 2"*). P174.
- **A slip is Pay's own row** (`payDue` for the week on screen): the worker's own period (the week for the weekly tiers, the month of the
  week's Sunday for the monthly), earned (`labourForRange().byWorker`), each payment and advance Pay counts for the period
  (`psPayments`, `payPaidFor`'s own reading), the balance brought forward (`payCarried`) and what is due. **It foots**: earned − paid ±
  what else settled the period (*Paid outside the month's payroll*, *No earnings recorded*, *Rounded to the rupee*, a line each,
  `data-ps-settle`) ± brought forward = due, as Pay shows it. A month on record as paid prints the payroll's row and reads settled.
- It shows attendance (present, half, absent in the period), the earnings line by line (days × the day rate, rest days, overtime hours, or
  hours × the hour rate), the worker's card, designation, area, tier and rate. The EXTRA pool is not on it, and a weekly slip says so.
- **Two to an A4 page** with a line to cut along (`inv-ps-*`, its sizes declared once); the reference is derived (`PS/<period>/<card or
  id>`), so a reprint is the same slip and nothing is written when one is printed. Only a role that opens Pay reaches it.
- **Each slip shows its days** (owner, 30 Oct 2026: *"in the print add the week and monthly calendar for every employee, so that
  they can see which day they were absent and where they worked each day … they don't necessarily have to share the same layout"*;
  P250). Read off the day's marks and the OT slots the hand stood on (`psDay`, `attHandSlotArea`), never stored. **A weekly slip** has a
  column a day under the details (`psWeekHtml`): present, half day or absent (a day with no mark says Sunday, Holiday, Shut or *Not
  recorded*), where (the general shift's area and each OT slot's), in and out, the hours and overtime. **A monthly slip** has the month
  on one grid beside the details (`psMonthHtml`), a day its date and a code (`P A1`, `H A2`, `A`, `+BR` for an OT slot stood elsewhere,
  `Sun`, `Hol`), absent and half days shaded, a key naming only the codes used. Both keep the slip its half of the A4 page.
- **Any month's slips** (owner, 10 Oct 2026; P205): the dialog's *Monthly hands' month* picks the month (`_psMonth`, read through the
  month's first Sunday, `psMonthWeek`); the weekly hands' slips stay the week on Pay's. A hand's history prints one period's slip. A
  slip lists each payment *by bank* (to a role that sees money) or typed, a leg whose payee the statement's name only reads as the
  hand *payee to confirm*, and its brought-forward line names the months it is made of (`data-ps-carried`).

### The monthly payroll AS PAID
A closed month is not a thing to re-derive: somebody was paid against a slip, and the slip is the fact. The
model predicts the slip — fine for the month in progress, wrong on a closed month whose marks were typed
short or paid on a rule since changed (July and August's missing overtime).

`S.payrollPaid: [{id, month, status: paid/computed, source, note, at, rows: [{name, staffId?, rate, worked,
restDays, dayPay, otHours, ot, paid?, note}], voidedAt?, voidReason?}]`. **For a month before the current one,
a record REPLACES the model for the hands it names** — on the Pay view (that month's due reads settled, *as
paid, from the slip*, while no payment for the month is known; with one, the slip is what was earned and the payment what was
paid: *Pay* above), the labour card and the live cost — pro-rata to the share of the month a range covers.
A monthly hand the record does not name (paid on a voucher of their own) is still modelled, and a name the
roster does not hold still costs what it was paid. The month in progress is always modelled.

People → Pay → **Monthly payroll as paid → Import** takes a `sep-payroll-paid` file. Names are matched like a
roll's (`relayKey`, and the worker's spellings), never by id. The same figures twice are skipped; different
figures for a month **supersede**, and the old record is voided with the reason — never overwritten. Wages
never enter this public repo: the file is built privately from the slips. **April, May, July and August**
exist; **June does not** — only its projection is on disk, not the slip it was paid on. August was
**Revision 5 as paid on 14 Sep** (₹1,01,768.43), not Revision 15's ruled ₹1,02,247.46: the gate hand's row carries
the balance still owed as a note, and Shyam's and Rupa's rows note their crossed bank legs. Since what was paid is read off
the statement (10 Oct 2026), the file handed over then carries August as **Revision 15, as ruled** (the gate hand at his ruled figure):
the slip is what was earned, the statement what was paid, and the two differences carry.

The salaried tier is `monthly` and **is not a flat salary**: the payout slips are written in
₹/day, and a flat monthly divided by calendar days neither matches them nor moves when somebody
is absent. The weekly pool is `hourly` and has **no day concept at all** — charging it a day
rate and then paying overtime at ×1.1 invents a boundary the slip does not have and overpays
the overtime by a tenth. `daily` is the generic middle; no SEP tier is on it, and it is what
the retired `contract` class was.

**The gate is the one place a monthly worker's pay moves with their own attendance.** Rest days
are paid, scaled three ways: at or above 90% attendance all of them, at or above 80% half, below
that none. Exact over a calendar month, which is the period it was written for; over a shorter range
it judges each rest day on that range alone, and the card says so.

**The model reproduces a real payout slip.** One W32 week's hourly pool foots to ₹27,549 across
ten hands and 580 hours at ₹47.50; the spec feeds the same hours through and lands on
₹27,550.00, the rupee being the slip's own three half-rupee roundings taken down. A model that
cannot reproduce a document somebody was paid against is not one to price a decision with.

**The roster ships empty, and it has its own door.** Names and wages are payroll data, this repo
is public, and its built page is served to anyone — so making the repo private would not hide a
seeded roster either. Structure (the eight areas, the comp classes, the wage arithmetic) is
code; the people arrive through **People → Roster → Import**, which **merges by name** and touches
nothing else on `S`. Settings → Import cannot serve: it replaces the whole state, so a roster
file through that door takes every invoice with it. Merging on the *name* rather than the id is
what keeps a worker's existing attendance marks attached, because two devices that typed the
same person gave them different ids.

`SEED_CLIENTS` carried the clients' names, contacts and rates until 22 Oct 2026, and the build's parts list their
parts and prices: both are empty now (HR-10).

**The days a roster worked come through the same door**, for the same reason the area complements
do: a roster with no history has nothing for the Areas card to check, and a history with no roster
has nobody to attach itself to. Three rules, each of them the difference between seeding a history
and corrupting one.

- **Marks name a WORKER, never an id** — the same reason the roster merges by name, one level down.
  An id in a file attaches a day's marks to whoever holds that number on *this* device. Attendance
  is therefore applied **last**, against the roster the same import just merged.
- **A name not on the roster is dropped and COUNTED, never created.** Inventing the worker would put
  a row with no comp class and no rate on the roster, and the labour figure would then read short
  with nothing on screen saying why. A reported drop is a question somebody can answer; an invented
  worker is a wrong number nobody sees.
- **A day already recorded is KEPT, never overwritten.** Seeding must not be able to destroy entry
  somebody actually did, and a re-import that changed nothing says so rather than looking like it
  worked.
