# SEP Invoicing — Split Architecture

**Established:** 13 April 2026 (Phase 6 session)
**Pattern:** SproutLab-style split-file PWA

## Build

```bash
cd split
bash build.sh > ../sep-invoicing.html
cp ../sep-invoicing.html ../index.html
git add -A && git commit -m "description" && git push
```

## Module Map

```
split/
├── build.sh              ← Concatenation script
├── head.html             ← DOCTYPE, meta, font links (12 lines)
├── styles.css            ← All CSS (~1,048 lines)
├── body.html             ← HTML body, tabs, print view (~125 lines)
├── data.js               ← ITEMS_MASTER + SEED_CLIENTS (embedded data)
├── state.js              ← State mgmt, utilities, lifecycle states, rate lookup
├── tabs.js               ← switchTab (9-step protocol) + renderHome
├── clients.js            ← Client Master CRUD + overlay
├── items.js              ← Items Master Phase 6 (subview, CRUD, merge, weights)
├── create.js             ← Invoice creation form
├── settings.js           ← Settings overlay + import/export
├── invoice-ops.js        ← Invoice detail, edit, cancel, delete, register
├── exports.js            ← Sales CSV + GSTR1 CSV exports
├── im.js                 ← Incoming Material list + selection
├── autocomplete.js       ← Part number autocomplete for line items
├── print.js              ← formatInvoiceData + print preview/print
├── stats.js              ← Stats dashboard + History activity log
├── im-form.js            ← IM add/edit/delete challan form
├── scanner.js            ← Challan scanner (Gemini AI vision)
├── events.js             ← Event delegation + change/input/keydown handlers
├── swipe.js              ← Swipe navigation between tabs
├── seed.js               ← Seed IM data (50 challans, one-time)
└── init.js               ← Migrations + app bootstrap
```

## Concat Order

The order in `build.sh` matters. Dependencies flow downward:
1. `data.js` — constants, no dependencies
2. `state.js` — depends on data.js constants
3. `tabs.js` — depends on state utilities
4. `clients.js` — depends on state + tabs
5. `items.js` — depends on state + clients (renderClientList)
6. `create.js` through `scanner.js` — depend on state + utilities
7. `events.js` — depends on all function definitions above
8. `swipe.js` — depends on switchTab
9. `seed.js` + `init.js` — run at load time, depend on everything

## Rules

- All session conventions from SEP_INVOICING_DESIGN_PRINCIPLES.md apply
- New modules get a section comment: `/* ===== NAME (Phase N) ===== */`
- New CSS goes at the end of styles.css with a Phase section comment
- New event actions go in the switch statement in events.js
- New change/input handlers go in the respective listeners in events.js
