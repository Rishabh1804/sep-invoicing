# SEP Invoicing — Items Master Spec
**Version:** 1.1 · **Date:** 13 April 2026
**Scope:** Items Master sub-view on Clients tab + Merge Duplicates tool
**Status:** Built — Phase 6 integrated into split architecture

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

### Subview Dispatch (8-pass fix #1)
`switchTab('pageClients')` calls `renderClientsPage()` which checks `clientsSubView` pref and renders either the client search + list or the items toolbar + list into `#clientsPageContent`.

The static `#clientSearch` input was moved from body.html into the dynamic renderer to avoid visibility conflicts between sub-views.

---

## 3. Items Master View

### 3.1 Toolbar
- Search input (debounced 300ms, searches partNumber + desc)
- Item count badge: "857 items" (updates on filter)
- "Merge" button (opens merge tool)
- "Calc Weights" button (runs stdWeightKg calculator)
- Sort: `<select>` dropdown — Alphabetical (partNumber) | by Unit | by Rate (high→low)
- "No weight" filter toggle (shows count, acts as chip toggle)

### 3.2 Item List
Scrollable list of item cards in `inv-card-list` container. Each card shows:

```
┌─────────────────────────────────────┐
│ 5069 4370 0108              KG      │
│ BRACKET                   ₹13.00   │
│ [0.102 kg]                          │  ← only if stdWeightKg set
└─────────────────────────────────────┘
```

- Line 1: partNumber (left, mono), unit badge (right)
- Line 2: description (left), default rate (right, mono font)
- Rate = 0 items show "No rate" in text-3 color
- Tap card → opens Edit overlay
- Weight badge shown if stdWeightKg is set (prod domain color)

### 3.3 Add Item
FAB (`#clientsItemsFab`) shown when Items sub-view is active, hidden when Clients sub-view is active. Opens Add overlay.

### 3.4 Pagination
Render in batches of 50 (`ITEMS_BATCH`), with "Load more" button at bottom. Search results render all matches (capped at 100). `_itemsRendered` counter tracks current render offset, reset on search/sort/filter changes.

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
- **Save**: validates, updates `S.items`, calls `saveState()`, closes overlay, shows toast, re-renders list
- **Delete**: confirm dialog with reference count → "This item is referenced in N invoice lines and M challan lines. Historical references will be kept as-is." → removes from `S.items`, `saveState()`.
- **Cancel**: closes overlay

### Add Mode
Same overlay, empty fields. On save: `id = Math.max(...S.items.map(i => i.id)) + 1`, push to `S.items`, `saveState()`.

---

## 5. Merge Duplicates Tool

### 5.1 Entry
"Merge" button in Items toolbar → opens overlay. First open per session shows backup warning toast.

### 5.2 Fuzzy Matching Algorithm

`findDuplicateGroups(items)`:
1. Extract numeric core from each partNumber (all digit sequences joined with space)
2. Require total digits >= 4 to avoid false positives on short numbers
3. Group items with identical numeric cores
4. Flag groups where descriptions differ substantively (descriptions that aren't just the partNumber restated)
5. Sort: exact matches first, warned groups last, then by group size descending

### 5.3 Merge UI
List of candidate groups. Each group has radio buttons to select primary item, plus a "Merge" button. Warning badge shown if descriptions differ.

### 5.4 Merge Action — Two-step
1. **Preview**: replaces group card with preview showing affected invoice/challan counts
2. **Confirm**: updates all references in `S.invoices` and `S.incomingMaterial`, removes secondary items, saves state, removes group from view

### 5.5 Safety
- No auto-merge. Every merge is user-initiated per group.
- Preview step before each merge shows exact impact.
- Merge is not undoable — backup warning on first tool open.

---

## 6. stdWeightKg Auto-Calculation

### 6.1 Logic
Back-calculate standard weight per piece from existing invoice and challan data wherever both KG weight and NOS count exist for the same partNumber.

`calculateStdWeights()`:
- For each item where `stdWeightKg` is null
- Collect all (qty_kg, nos_count) pairs from invoices and challans where `unit=KG` and `nosQty > 0`
- `stdWeightKg = average(qty_kg / nos_count)`, rounded to 3 decimal places via `gstRound(avg * 1000) / 1000`
- Flag if coefficient of variation > 20% (high variance across batches)
- Never overwrites manual entries (only fills null values)

### 6.2 Entry Point
"Calc Weights" button in Items toolbar. Shows summary toast with count + variance warnings.

### 6.3 No Weight Filter
"No weight (N)" chip-toggle in toolbar. Filters list to items where `stdWeightKg` is null. Count decreases automatically as weights are calculated or manually set.

---

## 7. Data Model Changes

### S.items[] — no structural changes
```
{ id, partNumber, desc, hsn, unit, rate, stdWeightKg }
```
`stdWeightKg` already exists (currently null for all items).

### View prefs additions (stored in `sep_inv_view_prefs` alongside register filters)
```
clientsSubView: 'clients' | 'items'    // default: 'clients'
itemsSort: 'alpha' | 'unit' | 'rate'   // default: 'alpha'
itemsSearch: ''
itemsFilter: 'all' | 'no-weight'       // default: 'all'
```

---

## 8. Section Placement (Split Architecture)

| New Code | File | Phase Tag |
|----------|------|-----------|
| CSS: item cards, merge tool, weight badges | `split/styles.css` (appended) | Phase 6 |
| JS: Items Master (all features) | `split/items.js` | Phase 6 |
| JS: Event delegation cases | `split/events.js` (added) | Phase 6 |
| JS: switchTab dispatch | `split/tabs.js` (modified) | Phase 6 |
| HTML: pageClients restructured | `split/body.html` (modified) | Phase 6 |

### New CSS classes (all `inv-` prefixed)
`inv-subview-toggle`, `inv-subview-btn`, `inv-subview-active`, `inv-items-toolbar`, `inv-items-toolbar-row`, `inv-items-count`, `inv-items-sort`, `inv-item-card`, `inv-item-card-top`, `inv-item-card-bottom`, `inv-item-pn`, `inv-item-desc`, `inv-item-unit`, `inv-item-rate`, `inv-item-weight-row`, `inv-weight-badge`, `inv-merge-group`, `inv-merge-group-header`, `inv-merge-radio-row`, `inv-merge-radio`, `inv-merge-item-info`, `inv-merge-item-desc`, `inv-merge-warn`, `inv-merge-preview`, `inv-merge-btn`

### New data-actions
`invSwitchSubView`, `invEditItem`, `invAddItem`, `invSaveItem`, `invDeleteItem`, `invOpenMergeTool`, `invMergeGroup`, `invMergeConfirm`, `invMergeCancelPreview`, `invCalcWeights`, `invFilterNoWeight`, `invLoadMoreItems`, `invItemsSort`

---

## 9. 8-Pass Review Changes (v1.0 → v1.1)

| Pass | Issue | Resolution |
|------|-------|------------|
| 3 (Integration) | `switchTab` called `renderClientList()` directly — no subview dispatch | Added `renderClientsPage()` dispatcher |
| 3 (Integration) | Static `#clientSearch` visible when Items subview active | Moved to dynamic render in `_buildClientsSubViewHtml()` |
| 3 (Integration) | FAB placement unspecified | Added `#clientsItemsFab` to body.html, toggled by subview |
| 5 (Drift) | Sort UI type unspecified | Used `<select>` dropdown matching Register/IM toolbar pattern |
| 5 (Drift) | Load more pattern inconsistent | Implemented batch rendering with `_itemsRendered` counter |
| 6 (Builder) | Merge overlay size | Standard `inv-overlay-card` with existing max-height |
| 6 (Builder) | Backup warning tracking | Session variable `_mergeBackupWarned` |
| 6 (Builder) | Numeric core extraction | Extract all digit sequences, join with space, require >= 4 total digits |

---

*Spec updated after 8-pass review and build completion.*
