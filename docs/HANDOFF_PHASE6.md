# SEP Invoicing — Phase 6 Handoff
**Session:** Items Master + Architecture Split
**Date:** 13 April 2026
**Builder:** Aurelius

---

## What Was Built

### 1. Architecture Split (monolith → 21 modules)
The single-file `sep-invoicing.html` (4,472 lines) was split into a SproutLab-style module architecture with `build.sh` concatenation. Split verified clean against original (diff: trailing newline only).

### 2. Phase 6: Items Master
New `items.js` module (456 lines) providing:
- **Subview toggle** on Clients tab (Clients | Items segmented control)
- **Items list** with 300ms debounced search, 3-way sort (A-Z / Unit / Rate), batch pagination (50 per load)
- **Add/Edit/Delete overlay** with all 6 fields including stdWeightKg
- **Delete reference counting** — warns about invoice/challan references before delete
- **Merge Duplicates tool** — fuzzy matching by numeric core extraction, two-step merge with preview
- **Weight Calculator** — back-calculates stdWeightKg from invoice/challan history, CV>20% variance flagging
- **No Weight filter** — chip toggle showing count of items without stdWeightKg

### 3. Supporting Changes
- `styles.css`: +106 lines of Phase 6 CSS (item cards, merge tool, weight badges, subview toggle, all with dark mode)
- `events.js`: +25 lines of action delegation + change handlers
- `tabs.js`: switchTab dispatch updated for subview
- `body.html`: pageClients restructured with dynamic content container + FAB

---

## What Was NOT Built
- Client-scoped items (spec says "future phase")
- Browser-based QA (no browser available — manual testing required)

---

## Deploy Steps

```bash
# On device (Termux):
cd ~/storage/downloads/sep-invoicing

# If replacing existing repo content:
# Extract zip, then:
cd split
bash build.sh > ../sep-invoicing.html
cd ..
cp sep-invoicing.html index.html
git add -A
git commit -m "Phase 6: Items Master + architecture split"
git push
```

---

## QA Checklist (for manual testing)

1. [ ] Clients tab → segmented toggle visible, default = Clients
2. [ ] Toggle to Items → 857 items render (first 50 + Load more)
3. [ ] Search "bracket" → filtered results with 300ms debounce
4. [ ] Sort by Rate → highest rate items first
5. [ ] "No weight" filter → shows ~831 items
6. [ ] Tap item → Edit overlay with all fields
7. [ ] Add new item via FAB → appears in list
8. [ ] Delete item with references → warning shows counts
9. [ ] Merge tool → groups found → select primary → preview → confirm
10. [ ] Calc Weights → toast shows count of calculated items
11. [ ] Toggle back to Clients → client list renders normally
12. [ ] Swipe left/right → still navigates between tabs
13. [ ] Dark mode → all new UI renders with correct colors
14. [ ] FAB hides when on Clients view, shows on Items view
15. [ ] View prefs persist across tab switches (sort, filter, subview)

---

## Codex Snippet

```
SESSION: SEP Invoicing Phase 6 — Items Master + Architecture Split
DATE: 13 April 2026
PHASE: 6
STATUS: Built, awaiting device QA

ARCHITECTURE CHANGE: Single-file (4,472 lines) split into 21 modules in split/ directory.
Build: cd split && bash build.sh > ../sep-invoicing.html
Module map in docs/ARCHITECTURE.md.

ITEMS MASTER (items.js, 456 lines):
- Subview toggle on Clients tab (persists in view prefs)
- CRUD: Add/Edit/Delete with reference counting
- Search (300ms debounce) + Sort (alpha/unit/rate) + Filter (no-weight)
- Merge Duplicates: numeric core fuzzy matching, two-step merge with preview
- Weight Calculator: back-calculate stdWeightKg from invoice/challan KG+NOS pairs
- Pagination: 50-item batches with Load More

SPEC: docs/SEP_ITEMS_MASTER_SPEC.md v1.1 (8-pass review applied, 7 defects resolved)
DESIGN PRINCIPLES: Unchanged (v1.0), now referenced from docs/ARCHITECTURE.md

HARD RULE COMPLIANCE: Verified — 0 inline styles, 0 onclick, all inv- prefixed,
escHtml() on all user data, gstRound() on weights, dark mode on all new elements.

NEXT PHASE CANDIDATES:
- Client-scoped items (filter autocomplete by client)
- Rate card overhaul (item-level rates replacing client-level KG rates)
- IM → Invoice auto-linking improvements
```
