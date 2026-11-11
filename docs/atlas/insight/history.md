---
subject: "History is the audit trail"
domain: insight
modules: [split/stats.js, split/changelog.js]
specs: []
tests: []
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### History is the audit trail
It was missing the two event kinds an audit goes looking for. A deleted invoice writes a
tombstone to `S.voidedNumbers` with a required reason, and an accepted duplicate challan
stamps `dupeAck` — neither appeared in the log. Both are now first-class events. On the phone a
void is a plain row, because the invoice it names no longer exists to open; on the desktop it opens
in History's pane, which says where its record went (Invoices → Number audit), or, for a number
accounted for, that no invoice was ever recorded under it.

**The floor is in it too, and that puts TWO CLOCKS in one list.** An invoice event is dated by
**when it was recorded** — every one carries a real `createdAt`. An attendance day has no such
stamp: the store is keyed by the date it describes and nothing writes down when somebody typed
it. So a floor row is dated by **the day it is about**, which is the date on the sheet and the
same convention Stats already uses for periods. That is a different question from "when did this
get entered", so **every floor row says `floor day` in place** and the CSV carries a `Dated by`
column. Unlabelled, the two read as one timeline and nothing on screen would say otherwise.

The exception ledger is the one staff event with a genuine record-time, so it keeps it and reads
`recorded` — and it is dated the day somebody explained the disagreement, not the day the
disagreement happened.

**A client filter excludes the floor.** A client filter is a question about one account; the shop's
Tuesday is not about an account, and listing it under one asserts a connection that does not exist.

**A floor day's row is its count and opens the day** (the tab map, TM6e): *Attendance recorded: 17 present, 6 absent, 9.0 h OT*.
Where everybody stood, by area, is the row's whole (its title, the desktop's pane, the search and the CSV), and the row opens that
day on People → Attendance, whose board answers the question; on the owner's book seven areas had run the row past two lines.

Booked extra is **one row per entry, not a day total** — a reader who wants to know what was booked
needs the where. A block row states which of its three inputs is missing (`no crew recorded`,
`no times recorded`) rather than leaving them to open the Areas card to find out why it never
reconciles. **Roster changes are absent on purpose**: staff rows carry no timestamp, so dating them
would mean inventing one.
