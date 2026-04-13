# SEP Invoicing — Items Master Spec
**Version:** 1.0 · **Date:** 13 April 2026
**Scope:** Items Master sub-view on Clients tab + Merge Duplicates tool
**Status:** Draft — awaiting review

---

## 1. Overview

Add an Items Master view accessible from the Clients tab, allowing CRUD operations on the global parts list (currently 857 items, 470 with rate = 0). Add a Merge Duplicates tool that uses fuzzy matching to surface candidate groups for user-reviewed merging.

Items remain a flat global list. Client linking is out of scope (future phase).

---

## 2. Entry Point

### Clients Tab Header Toggle
The Clients tab header gains a segmented toggle:

```
[ Clients | Items ]
```

- Default: Clients (current view, no change)
- Tap "Items": renders Items Master list in the same page area
- Toggle state persists in view prefs (`sep_inv_view_prefs.clientsSubView: 'clients' | 'items'`)
- Tab icon and tab bar position unchanged — still the Clients tab

### Why not a separate tab
7 tabs at 375px already uses ~53px per tab. An 8th drops to ~47px and labels would need truncating. The segmented toggle avoids this while keeping items contextually near clients.

---

## 3. Items Master View

### 3.1 Toolbar
- Search input (debounced 300ms, searches partNumber + desc)
- Item count badge: "857 items" (updates on filter)
- "Merge Duplicates" button (opens merge tool)
- Sort: Alphabetical (partNumber) | by Unit | by Rate (high→low)

### 3.2 Item List
Scrollable list of item cards. Each card shows:

```
┌─────────────────────────────────────┐
│ 5069 4370 0108              KG  ✎  │
│ BRACKET                   ₹13.00   │
└─────────────────────────────────────┘
```

- Line 1: partNumber (left), unit badge (right), edit icon (far right)
- Line 2: description (left), default rate (right, mono font)
- Rate = 0 items show "No rate" in text-3 color
- Tap card → opens Edit overlay
- Edit icon (✎) → same Edit overlay

### 3.3 Add Item
FAB (same position as existing FAB) shows "+" when Items sub-view is active. Opens Add overlay.

### 3.4 Pagination / Virtual Scroll
857 items can't all render at once. Render in batches of 50, with "Load more" button at bottom (same pattern as Invoice Register if applicable). Search results render all matches (capped at 100).

---

## 4. Edit Item Overlay

Standard `inv-overlay-scrim` → `inv-overlay-card` pattern.

### Fields

| Field | Input Type | Validation | Notes |
|-------|-----------|------------|-------|
| Part Number | text | Required, trimmed | Primary identifier |
| Description | text | Optional | Display name in autocomplete |
| HSN Code | text | Default: 998873 | Pre-filled, rarely changed |
| Unit | select: KG / NOS | Required | Affects billing calculation |
| Default Rate (₹) | number, step 0.01 | ≥ 0 | Reference rate — client rate cards override this |
| Std Weight (kg) | number, step 0.001 | ≥ 0, optional | For nos_to_weight conversion. Null = not set. |

### Actions
- **Save**: validates, updates `S.items`, calls `saveState()`, closes overlay, shows toast
- **Delete**: confirm dialog with reference count → "This item is referenced in 5 invoices and 2 challans. Delete anyway?" → removes from `S.items`, `saveState()`. References in existing invoices/challans are NOT updated (partNumber strings remain for historical accuracy — the item just won't appear in autocomplete anymore).
- **Cancel**: closes overlay

### Add Mode
Same overlay, empty fields. On save:
- Generate `id`: `Math.max(...S.items.map(i => i.id)) + 1`
- Push to `S.items`
- `saveState()`

---

## 5. Merge Duplicates Tool

### 5.1 Entry
"Merge Duplicates" button in Items toolbar → opens full-screen overlay (not a small card — needs space for comparison).

### 5.2 Fuzzy Matching Algorithm

Run on all `S.items`, produce candidate groups:

```javascript
function findDuplicateGroups(items) {
  // Step 1: Extract numeric core
  // "BRACKET 5069 4370 0108" → "5069 4370 0108"
  // "5069 4370 0108" → "5069 4370 0108"
  // Match if numeric cores are identical AND >= 4 digits total

  // Step 2: Exact partNumber match (case-insensitive, trimmed)
  // These are definite duplicates

  // Step 3: Containment check
  // If item A's partNumber contains item B's partNumber (after trim)
  // AND the contained portion is >= 4 chars
  // → candidate group

  // Step 4: Filter out false positives
  // If items in a group have DIFFERENT descriptions that are both
  // substantive (not just the partNumber restated), flag as "review carefully"
  // e.g., "8201 PACKING PLATE" vs "BRACKET 8201" → different parts, not duplicates
}
```

### 5.3 Merge UI

List of candidate groups, each rendered as:

```
┌─────────────────────────────────────┐
│ Group 1 — 3 items         [Merge]  │
│ ○ ASSY BRACKET 0146    KG  ₹0.00  │
│ ○ ASSY BRACKET 0146    KG  ₹0.00  │
│ ○ ASSY BRACKET 0146    KG  ₹0.00  │
│                                     │
│ ⚠ Review: different descriptions   │  ← only if flagged
└─────────────────────────────────────┘
```

- Radio buttons (○) to select the **primary** item (the one that survives)
- First item pre-selected as primary
- "Merge" button per group
- Warning badge if descriptions differ significantly
- Groups sorted: exact duplicates first, then fuzzy matches

### 5.4 Merge Action

When user taps "Merge" on a group, a **preview step** shows first:

**Preview panel (replaces the group card temporarily):**
```
┌─────────────────────────────────────┐
│ Merge into: ASSY BRACKET 0146      │
│                                     │
│ Will remove: 2 duplicate items      │
│ Will update: 5 invoices, 2 challans │
│                                     │
│       [Cancel]  [Confirm Merge]     │
└─────────────────────────────────────┘
```

The preview scans `S.invoices` and `S.incomingMaterial` for references to the secondary items' partNumbers and shows exact counts.

**On confirm:**

1. **Primary** item keeps its id, partNumber, desc, unit, rate, stdWeightKg
2. **Secondary** items' partNumbers are collected
3. Scan `S.invoices` — any line item referencing a secondary's partNumber gets updated to primary's partNumber
4. Scan `S.incomingMaterial` — same update for challan line items
5. Remove secondary items from `S.items`
6. `saveState()`
7. Toast: "Merged 3 → 1. Updated 5 invoices, 2 challans."
8. Remove the group from the merge view

### 5.5 Safety

- No auto-merge. Every merge is user-initiated per group.
- Confirm dialog before each merge: "Merge 2 items into [PRIMARY PART NUMBER]? This will update references in existing invoices and challans."
- Merge is not undoable (data backup recommended before bulk merge). Show warning on first merge tool open: "Back up your data before merging. Settings → Export Data."

---

## 6. stdWeightKg Auto-Calculation

### 6.1 Concept
Back-calculate standard weight per piece from existing invoice and challan data wherever both KG weight and NOS count exist for the same item. From current data: 26 items calculable, 831 need manual clarification.

### 6.2 Calculation Logic

```javascript
function calculateStdWeights(items, invoices, incomingMaterial) {
  // For each item, collect all (qty_kg, nos_count) pairs from:
  //   - Invoice line items where unit=KG and nosQty > 0
  //   - IM challan items where unit=KG and nosQty > 0

  // stdWeightKg = average(qty_kg / nos_count) across all records
  // Only set if >= 1 data point exists
  // Flag as low-confidence if coefficient of variation > 20%
  //   (indicates inconsistent weights across batches)
}
```

### 6.3 Entry Point
Button in Items toolbar: "Calculate Weights" — runs calculation, shows summary:
- "Calculated weights for 26 items from invoice/challan history"
- Items with new weights are highlighted in the list
- Items with high variance flagged with ⚠

### 6.4 Needs Clarification List
Items without calculable weight are accessible via a filter toggle: "No weight (831)" badge in toolbar. Tapping it filters the list to items where `stdWeightKg` is null. This list shrinks automatically as more invoices/challans with NOS tracking are created over time.

### 6.5 Manual Override
`stdWeightKg` set via the Edit overlay always takes precedence. Auto-calculation only fills null values — never overwrites manual entries.

---

## 7. Data Model Changes

### S.items[] — existing shape, no changes needed
```
{ id, partNumber, desc, hsn, unit, rate, stdWeightKg }
```

`stdWeightKg` already exists (currently null for all items). Edit overlay exposes it. Auto-calculation populates it.

### View prefs addition
```
sep_inv_view_prefs.clientsSubView: 'clients' | 'items'  // default: 'clients'
sep_inv_view_prefs.itemsSort: 'alpha' | 'unit' | 'rate'  // default: 'alpha'
sep_inv_view_prefs.itemsSearch: ''
sep_inv_view_prefs.itemsFilter: 'all' | 'no-weight'      // default: 'all'
```

---

## 8. Autocomplete Impact

`searchParts(query)` currently searches all `S.items`. No change to this function. When items are merged or deleted, autocomplete automatically reflects the cleaner list since it reads from `S.items`.

Future phase (client-scoped items) will add a `clientId` filter to `searchParts`.

---

## 9. Section Placement

| New Code | Section | Phase Tag |
|----------|---------|-----------|
| CSS: item cards, merge tool | After `/* ===== PART AUTOCOMPLETE ===== */` | Phase 6 |
| JS: Items Master rendering | After the Part Autocomplete section | Phase 6 — Items Master |
| JS: Merge Duplicates tool | After Items Master | Phase 6 — Merge Tool |
| JS: stdWeightKg calculator | After Merge Tool | Phase 6 — Weight Calculator |
| Event delegation cases | In existing delegation switch | Phase 6 |

### New CSS classes (all `inv-` prefixed)
`inv-items-toolbar`, `inv-items-search`, `inv-items-count`, `inv-item-card`, `inv-item-pn`, `inv-item-desc`, `inv-item-unit`, `inv-item-rate`, `inv-item-weight`, `inv-merge-group`, `inv-merge-radio`, `inv-merge-warn`, `inv-merge-btn`, `inv-merge-preview`, `inv-subview-toggle`, `inv-subview-active`, `inv-weight-badge`, `inv-no-weight-filter`

### New data-actions
`invSwitchSubView`, `invEditItem`, `invDeleteItem`, `invSaveItem`, `invOpenMergeTool`, `invMergeGroup`, `invMergeConfirm`, `invSelectMergePrimary`, `invItemsSort`, `invLoadMoreItems`, `invCalcWeights`, `invFilterNoWeight`

---

## 10. Estimated Scope

| Component | Lines (est) |
|-----------|-------------|
| CSS: item cards + merge tool + weight badges | ~90 |
| JS: Items Master view (list, search, sort, pagination) | ~120 |
| JS: Add/Edit/Delete overlay + reference counting | ~120 |
| JS: Merge tool (fuzzy matching + preview + merge action) | ~180 |
| JS: stdWeightKg calculator + needs-clarification filter | ~80 |
| JS: Subview toggle + view prefs | ~25 |
| JS: Event delegation wiring | ~35 |
| **Total** | **~650 lines** |

---

## 11. Open Questions — Resolved

| # | Question | Resolution |
|---|----------|------------|
| 1 | Delete behavior for referenced items | Warn with reference count, allow deletion. Historical references kept as-is. |
| 2 | stdWeightKg source | Auto-calculate from invoice/challan history (KG qty ÷ NOS qty). 26 items calculable now. Manual override via edit. Uncalculable items go to "needs clarification" filter. |
| 3 | Merge preview | Preview shows affected invoice/challan counts before confirmation. Two-step: preview → confirm. |

---

*Spec ready for 8-pass review.*
