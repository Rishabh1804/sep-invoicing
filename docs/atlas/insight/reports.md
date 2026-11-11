---
subject: "Reports"
domain: insight
modules: [split/report.js]
specs: []
tests: [P132]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Reports
Home → **Reports** (in its Insights, after Stats; Today's until UI pass 3, Office's until the tab map of 9 Oct 2026) (`report.js`; owner, 1 Oct 2026: *"a daily weekly and a monthly
quarterly yearly report generator"*). Shaped on soma-internal's hand-compiled daily, weekly and monthly reports (`reports/`); a
quarterly and a yearly follow the monthly's shape. P132.
- **Kinds and periods**: Daily · Weekly · Monthly · Quarterly · Yearly; a day, the pay week Sun–Sat numbered by its Saturday's ISO week,
  a month, a quarter of the financial year (Q1 Apr–Jun), a financial year. ‹ › steppers (never past the current period), a picker, Now,
  and **Print** the one primary. A period not yet ended reads *to date* and stops at today. Kept per device (`sep_inv_report`); the
  address is `?tab=pageReports&v=<kind>/<first day>`. Home's toolbar → More → *Make a report* opens it on the same period (Pulse's head until UI pass 3).
- **The report on the page is the paper, fitted** (the tab map, TM2f): laid out at the sheet's width and zoomed to the screen
  (`paperFit`, print.js, the print view's own fit), so its tables never run past a phone's edge.
- **One document, drawn from the data every time** — the Power case's contract: `rptHtml(kind, from, to)` is the page and the print
  (`rptPrint`), and a save in another window redraws both.
- **Sections by kind**: headline tiles with a change line against the period before of the same length (same days while one runs);
  by line (daily), by day (weekly), by pay week (monthly), by month (quarterly, yearly); clients, with contribution worst first from a
  month; production by line; staff (areas against the day's number, the week's payout, labour fixed and variable); cost and margin
  (from a month); money (from a week); stock; power; the day's invoices and challans (daily); open red and amber To-do items (current
  period only — a past report never invents them); sources.
- **No second arithmetic**: every figure is read from the function its screen uses (`statsInvoices`, net of credit notes and said;
  `weighLines`, `liveCost`, `statsClientMargins`, `labourForRange` with ₹/kg withheld under 90% of days, `payForecast`, `areaStats`,
  `prodPlatedSummary` on complete days, `powerAnalysis`, `stockStatus`, `finAgeing`, `finGstByMonth`, `finForecast`, `todoRanked`,
  and attendance by People → Attendance's own reading, `attPresenceForRange`: the active roster's marks typed Monday to Saturday, a
  half day half, as a percentage). **Empty is said, never a zero**: a dash with its reason, or one line for a period with nothing
  recorded, and a breakdown's foot totals only what its rows carry (₹/kg as weighed revenue over weighed kilos).
- **The day's invoices are listed as issued**, at the taxable on their face; the period's figures are net of credit notes. The
  picker always holds the year shown, Stats' All opens the current financial year and says so, and the issuer's name is
  `S.company`'s alone (no name written into the build).
- **Paper**: its own pt tokens (`.inv-rpt-doc`), paper colours in dark mode too; in print the frame table's repeating head and foot rows
  are the top and bottom gutters (the invoice's frame), `@page` margin 0; rows never split, a section head never ends a page. The frame
  is `table-layout: fixed` (a scroller inside it had widened the phone's page by 116px).
- Owed by age and the forecast's low appear only on the current period's report: they are read as of today.
