# Atlas index

The map of everything `CLAUDE.md` used to hold. Read `docs/atlas/README.md` for the protocol (look up, record the path, iterate).

## Domains

| Domain | Holds | Topics |
|---|---|---:|
| [core](core/README.md) | How the repo is built, tested and stored; the hard rules in full; QA chains; what is built and what is next. | 12 |
| [design](design/README.md) | The interface: the design system, UI pass 3, the tab map, navigation and interaction rules. | 16 |
| [billing](billing/README.md) | Invoices, challans, credit notes, certificates, printing, rates, quotations and the masters. | 10 |
| [floor](floor/README.md) | Production, the plant, stock, power, shifts, the entry faces and the planner. | 10 |
| [people](people/README.md) | Attendance, the areas and the extra, pay, pay slips, the payroll as paid and cash. | 6 |
| [money](money/README.md) | Finance, bills, suppliers, the bank, cheques and statements. | 4 |
| [insight](insight/README.md) | Stats, client performance, History, To-do, insights, reports and Home. | 9 |
| [platform](platform/README.md) | The guard, messages and photos, the knowledge base, office printing. | 4 |

## Subjects

Every topic, by domain.

**core**: [Overview and persona](core/overview.md) · [Programmes and specs: what is built and what is next](core/roadmap.md) · [Architecture: the module map and concat order](core/architecture.md) · [Build, the stamp and the pre-commit hook](core/build.md) · [Tests, CI and the sandbox; fixtures](core/tests.md) · [QA sweeps and chains, Sep to Nov 2026](core/qa-chains.md) · [The owner's rulings of 13 Oct 2026](core/owner-rulings-2026-10-13.md) · [Hard rules HR-1 to HR-10, their exceptions and the public repository](core/hard-rules.md) · [Error reports](core/error-reports.md) · [Settings](core/settings.md) · [Persistence](core/persistence.md) · [Offline](core/offline.md)

**design**: [Interaction rules: pop-ups, forms, dialogs, selects, scroll](design/interaction-rules.md) · [Navigation: addresses, the trail, long lists, list and pane](design/navigation.md) · [A figure says whether it is good](design/figures-and-tone.md) · [Design system: the migration to v2.0 and the polish passes](design/design-system.md) · [UI pass 3: the look (U1)](design/ui-pass-3-look.md) · [UI pass 3: Home and its widgets (U2)](design/ui-pass-3-home-widgets.md) · [UI pass 3: the card family (U2R)](design/ui-pass-3-card-family.md) · [UI pass 3: Home leads](design/ui-pass-3-home-leads.md) · [UI pass 3: Stats as a dashboard (U3)](design/ui-pass-3-stats.md) · [UI pass 3: every Enter by hand a guided flow (U4)](design/ui-pass-3-guided-flow.md) · [UI pass 3: People leads, a picture first, across the app (U5 to U7)](design/ui-pass-3-people-picture-across.md) · [UI pass 3: sign-in and the 4-digit PIN (U8)](design/ui-pass-3-sign-in.md) · [The tab map: the shell and Today (TM1, TM2)](design/tab-map-shell-today.md) · [The tab map: Money and Floor (TM3, TM4)](design/tab-map-money-floor.md) · [The tab map: Office and across the app (TM5, TM6)](design/tab-map-office-across.md) · [Direction B: workspaces, Today, Add, Pipeline, Floor overview, search](design/direction-b.md)

**billing**: [Billing spine, duplicate receipts, key business data](billing/domain-basics.md) · [Zinc pricing](billing/zinc-pricing.md) · [Invoice numbers, voids and reissues](billing/invoice-numbers.md) · [Quality certificates](billing/quality-certificates.md) · [Printing: the preview, the long tax invoice, its type](billing/printing.md) · [Credit notes](billing/credit-notes.md) · [Challan entry: keyboard, filled from the record, invoiced in parts, billed at zero](billing/challan-entry.md) · [Items Master and Client Master](billing/items-and-clients.md) · [The rate on record and the matcher](billing/rate-on-record.md) · [Quotations and prospects](billing/quotations-and-prospects.md)

**floor**: [Production](floor/production.md) · [Production readers: slots as text, the barrel list, the night block](floor/production-readers.md) · [A day's plating whole, and what a line earned](floor/day-plating.md) · [Workers and the plant](floor/workers-and-plant.md) · [The planner](floor/planner.md) · [Power](floor/power.md) · [Stock](floor/stock.md) · [Entry faces](floor/entry-faces.md) · [Stock: on paper, entries checked, messages, by line, reorder](floor/stock-more.md) · [Shifts by line: the night shift](floor/shifts.md)

**people**: [The floor by area: staffing, the extra, OT blocks](people/areas-and-extra.md) · [Attendance: rolls from WhatsApp, the register, paper, needed per shift](people/attendance-rolls.md) · [Cash paid out and cash with the supervisor](people/cash.md) · [Labour, Pay, pay slips, the payroll as paid](people/labour-and-pay.md) · [What the seeded history says about the extra](people/extra-history.md) · [The block census, comp classes and the labour model](people/block-census-and-labour.md)

**money**: [Finance, and bills and notes](money/finance-and-bills.md) · [Suppliers](money/suppliers.md) · [Bank and cheques received](money/bank.md) · [The bank as cost, statements of account, finance intelligence](money/bank-intelligence.md)

**insight**: [Client performance](insight/client-performance.md) · [Stats: what the charts show and what Stats measures](insight/stats.md) · [History is the audit trail](insight/history.md) · [Reports](insight/reports.md) · [What to do: every answer ends in its moves](insight/what-to-do.md) · [Stats in tabs, the questions, one ranked list, why it moved, learning](insight/stats-questions.md) · [Insights and predictions](insight/insights-and-predictions.md) · [People's and Stock's charts](insight/charts-people-stock.md) · [Home arranged, quick actions, To-do](insight/home-and-todo.md)

**platform**: [Printing at the office and the print station's light](platform/office-printing.md) · [The knowledge base, both editions](platform/knowledge-base.md) · [The guard](platform/guard.md) · [WhatsApp messages, photos and the Tata release read by Claude](platform/messages-and-photos.md)

## Other lookups

- [MODULES.md](MODULES.md): each `split/*.js` module and the topic that owns it.
- [HEADINGS.md](HEADINGS.md): every former `CLAUDE.md` heading and where it lives now. A citation such as *CLAUDE.md § Key Business Data* in a code comment or a doc resolves here.
- `docs/NEXT_SESSION.md`: the latest session close. Older closes: `docs/sessions/`.
- `docs/DATA_FLOWS.md`: what this app produces and consumes with the other two repos, and every backup-shape change.
- `docs/SEP_INVOICING_DESIGN_PRINCIPLES.md`: the design system itself (tokens, components, DR-1 to DR-9).
