# IL-4 Phase 2 — Margin Dashboard (Spec)

**Status:** Draft v0.1 — pre-Cipher review
**Author:** Solara (The Strategist)
**Branch:** `claude/introduction-pIyfV`
**Depends on:** IL-4 Phase 1 (commit `505a689`) — `S.defaultCostPerKg` plumbed.
**Target repo:** SEP Invoicing (7.1K LOC, below 30K Governor threshold)

---

## 1. Context & Goal

Phase 1 plumbed `defaultCostPerKg` (seed `5.46`) into state, migration, and Settings UI. No analytic surface yet.

**Phase 2 goal:** Surface per-invoice, per-client, and period-aggregate **margin intelligence** so the Architect can see — at a glance — which clients and parts are underwater.

**The leverage question this answers:**
- Which clients bill below cost? (SSS Mehta at ₹5.40 vs ₹5.46 baseline.)
- What is the blended margin % for the period?
- Which invoices/parts are the worst bleeders?

**Scope discipline:** Dashboard-only (read). No invoice-level snapshot, no cost overrides per client, no alerts. Those belong to Phase 3 / IL-5.

---

## 2. Scope

### In scope
- Margin calc engine: `computeInvoiceMargin(inv)` → `{costTotal, marginTotal, marginPct, lines:[...], unknowns:[...]}`.
- Period-aware aggregate: reuse existing `filterByPeriod()` and `_statsPeriod`.
- Three new stats cards (Revenue → Margin block in Stats tab).
- One drill-down addition to the existing client flip card (Stats drill overlay).
- CSS: margin colour domain (profit/loss/unknown), dark mode coverage.
- HR-5 `escHtml` on any user-origin text (part numbers, client names) reused from existing surfaces.
- HR-8 `gstRound()` on every rupee.

### Out of scope (explicit)
- Per-invoice cost snapshot at save time. (Live compute only in Phase 2.)
- Per-client cost override (`client.costPerKg`). (Phase 3 candidate.)
- Margin trend line over months. (Phase 3.)
- Alerts / threshold warnings. (Phase 3.)
- Export of margin data to CSV. (Not in Phase 2.)
- Print-view margin section. (Margin is internal; invoices stay clean.)
- Historical state migration (no invoice-level fields touched).

---

## 3. Data Model

**No schema changes.** Margin is fully derived.

### Sources already in state
| Field | Location | Role in margin calc |
|-------|----------|---------------------|
| `S.defaultCostPerKg` | state.js:16 | Cost basis (₹/kg) |
| `S.partWeights[PARTNAME]` | state.js:14, settings.js:94 | NOS→KG conversion |
| `inv.items[].qty` | create.js:243,270 | Quantity in billed unit |
| `inv.items[].unit` | create.js:243,270 | `KG` or `NOS` |
| `inv.items[].amount` | create.js:243,270 | Line revenue (₹) |
| `inv.items[].partNumber` | create.js:243,270 | Weight lookup key |
| `inv.items[].nosQty` | create.js:243,270 | Present when NOS→KG was used |
| `inv.clientId` | create.js:266 | Client billingMode lookup |
| `inv.status` | create.js:263 | Exclude `cancelled` from aggregates |
| `client.billingMode` | clients.js (SEED_CLIENTS) | `piece` / `nos_to_weight` / `perKg` |

### New derived fields (runtime only, never persisted)
- `line._costKg` — line weight in kg
- `line._cost` — line cost in ₹
- `line._margin` — line margin in ₹
- `line._marginPct` — line margin %
- `line._costKnown` — boolean; false when partWeight missing for a NOS line

---

## 4. Calculation Rules

### 4.1 Line weight derivation

Given `line` (invoice item) and `client` (via `inv.clientId`):

```
if line.unit === 'KG':
    costKg = line.qty
    costKnown = true

else if line.unit === 'NOS':
    pwKey = (line.partNumber || '').toUpperCase()
    pw = S.partWeights[pwKey]
    if pw > 0:
        costKg = line.qty * pw
        costKnown = true
    else:
        costKg = 0
        costKnown = false    // surface as "Cost unknown"

else:
    costKg = 0               // defensive; shouldn't occur
    costKnown = false
```

**Rationale:** `line.unit` is the ground truth of what was billed. For `nos_to_weight` clients the saved line keeps `unit='NOS'` and `qty` in NOS (see create.js:196-201). `nosQty` is a tag, not a source — do not use it for weight derivation.

### 4.2 Line cost / margin

```
line._cost      = gstRound(costKg * S.defaultCostPerKg)
line._margin    = gstRound(line.amount - line._cost)
line._marginPct = line.amount > 0 ? (line._margin / line.amount) * 100 : null
```

**HR-8 compliance:** `gstRound` on every ₹ value. Never `Math.floor`, never `toFixed()` for calc (display only).

### 4.3 Invoice aggregate

```
costTotal   = gstRound(sum of line._cost for all lines)
marginTotal = gstRound(inv.taxableValue - costTotal)
marginPct   = inv.taxableValue > 0 ? (marginTotal / inv.taxableValue) * 100 : null
unknowns    = lines where costKnown === false
```

**`taxableValue` is the revenue baseline** (pre-GST). GST is a pass-through, not margin.

### 4.4 Period aggregate

Reuse `filterByPeriod(activeInvs, _statsPeriod)` from stats.js:4. For each filtered invoice, sum `costTotal`, `marginTotal`. Period margin % = `marginTotal / taxableRevenue × 100`.

### 4.5 Client aggregate

Group by `inv.clientId`, same reducers as §4.4. Sort by `marginTotal` ascending (worst first) for the Loss-Makers card.

### 4.6 Guards

- `S.defaultCostPerKg` missing or ≤ 0 → render empty state in margin cards: "Set default cost per KG in Settings to enable margin analysis." No crash.
- Cancelled invoices (`inv.status === 'cancelled'`) → excluded at the `activeInvs` filter, identical to existing stats cards.
- Empty `inv.items` → zero cost, zero margin, skip in ranking.
- All-unknown invoice (every line missing part weight) → shown with `costTotal = 0` **and a warning badge** rather than falsely-positive margin.

---

## 5. UI Surfaces

### 5.1 Stats tab — three new cards

Inserted **between existing Card 1 (Revenue Overview) and Card 2 (Invoice States)** in `stats.js:renderStats()`. Rationale: margin is the revenue lens, not a state lens. Keep it adjacent.

#### Card M1 — Margin Overview (half-width, mirrors Revenue Overview)

```
┌──────────────────────────────────────┐
│ Margin Overview              [MTD]   │
│                                      │
│ Gross Margin            ₹12,340.50   │
│ Margin %                     28.4%   │
│ Cost of Goods            ₹31,090.00  │
│ Baseline                 ₹5.46/kg    │
└──────────────────────────────────────┘
```

- Metric label/value pattern reuses `.inv-stats-metric` / `.inv-stats-metric-value` / `.inv-stats-metric-sub` (stats.js:131-138).
- Margin % rendered in a colour-coded span: `inv-margin-positive` (≥ 20%), `inv-margin-thin` (0–20%), `inv-margin-negative` (< 0%).
- Baseline line shows `S.defaultCostPerKg` — cements the "this is why" for the user.

#### Card M2 — Margin by Client (full-width, bar chart)

```
┌──────────────────────────────────────────────────────────────┐
│ Margin by Client                                             │
│                                                              │
│  ████████████░░░░  SSS Mehta        -₹2,104   (-1.1%)  ◄ red │
│  ██████████░░░░░░  Client B          ₹8,920   (24.3%)        │
│  ████████░░░░░░░░  Client C          ₹5,110   (31.2%)        │
│                                                              │
│  Unknowns: 2 lines (missing weights) — [Fix in Items]        │
└──────────────────────────────────────────────────────────────┘
```

- Reuse `renderRevenueBarSvg` shape (stats.js:53-69). Fork to `renderMarginBarSvg(ranked, maxAbs)` because:
  - Bars are bipolar (negative = red bar extending left from zero axis; positive = green extending right).
  - Value label format is `₹X (Y%)`, not `₹X`.
  - Tap target delegates to existing `invStatsClientDrill` — margin view lives inside the client flip card (§5.2).
- Sort: negatives first (worst margin at top), then positives descending.
- Footer row counts invoices with unknown costs and links to Items Master (reuse `switchTab('items')`).

#### Card M3 — Worst Lines (full-width, table; conditional)

Shown only when at least one line has `_marginPct < 10` in the filtered period. Max 10 rows.

```
┌──────────────────────────────────────────────────────────────┐
│ Loss-Making Lines                                            │
│                                                              │
│ # Invoice      Client      Part       Qty   Rate   Margin %  │
│ 1 SEP/…/00042  SSS Mehta   HINGE PIN  5000  5.40   -1.1%     │
│ …                                                            │
└──────────────────────────────────────────────────────────────┘
```

- Reuse `.inv-stats-table` shell (stats.js:237-250).
- Row is tappable → `data-action="invOpenInvoice"` with `data-inv-id="<id>"` (reuse existing handler from events.js).
- Skip cancelled invoices (already enforced upstream).
- Skip lines where `_costKnown === false` (would produce a misleading "100% margin"). Unknowns are surfaced in M2 footer only.

### 5.2 Client drill flip card — add Margin KPI

In `openClientDrillOverlay()` (stats.js:258-376), add a fifth KPI tile to the `inv-flip-kpis` row:

```html
<div class="inv-flip-kpi">
  <span class="inv-flip-kpi-label">Margin</span>
  <span class="inv-flip-kpi-value inv-margin-<sign>">₹X (Y%)</span>
</div>
```

- Same period filter that already governs the card.
- Colour class selected by sign (positive / thin / negative).
- Zero new interactions on this surface — it's read-only context.

### 5.3 Settings — no change to UI

Phase 1 already wired the input at settings.js:25-28. No additions.

### 5.4 Home tab — no change in Phase 2

Home stays a flow summary. Margin lives in Stats, which is the analytic surface. Keeps the mental model clean: **Home = what's happening, Stats = how it's performing.**

### 5.5 Interaction table

| Surface | Action | Handler |
|---------|--------|---------|
| Margin bar (Card M2) | Tap → open client flip card | existing `invStatsClientDrill` |
| Unknowns footer (M2) | Tap → switch to Items tab | new `invMarginFixWeights` |
| Worst line row (M3) | Tap → open invoice detail | existing `invOpenInvoice` |
| Settings change `defaultCostPerKg` | Save → `_tabDirty.stats = true`, next Stats render recomputes | piggyback on existing `saveState()` |

---

## 6. CSS Additions

All new classes use `inv-` prefix (HR-3). All values via design tokens (HR-6). Defined in `split/styles.css`.

### 6.1 New tokens

Add to the existing token block (light + dark):

```
--inv-margin-positive:  <profit green>
--inv-margin-thin:      <warning amber>
--inv-margin-negative:  <loss rose>
--inv-margin-unknown:   <neutral slate>
```

Map to existing domain swatches:
- positive → sage family
- thin → amber family
- negative → rose family
- unknown → slate family

**No new hex values.** Reuse existing domain variables.

### 6.2 New classes

```
.inv-margin-positive  { color: var(--inv-margin-positive); }
.inv-margin-thin      { color: var(--inv-margin-thin); }
.inv-margin-negative  { color: var(--inv-margin-negative); font-weight: 600; }
.inv-margin-unknown   { color: var(--inv-margin-unknown); font-style: italic; }

.inv-svg-bar-negative { fill: var(--inv-margin-negative); }
.inv-svg-bar-positive { fill: var(--inv-margin-positive); }
.inv-svg-axis-zero    { stroke: var(--inv-text-muted); stroke-width: 1; }

.inv-margin-baseline  { font-size: var(--inv-text-xs); color: var(--inv-text-muted); }
.inv-margin-unknowns-footer { margin-top: var(--inv-space-8); padding-top: var(--inv-space-8); border-top: 1px solid var(--inv-border); }
```

### 6.3 Dark mode (HR-7)

Every new token has a `.dark :root { --inv-margin-*: <dark variant>; }` entry. Dark variants come from existing sage-dark / amber-dark / rose-dark / slate-dark — no new colour research needed.

---

## 7. Edge Cases & Guards

| Case | Behaviour |
|------|-----------|
| `S.defaultCostPerKg` falsy or ≤ 0 | Margin block hidden; toast in Settings only if user clears the field. |
| Client with 100% NOS lines, no part weights set | M2 shows client with `—` and `(unknown)`; M1 aggregate excludes them from margin% denominator? **No** — include them with zero cost; warn in M2 footer. Conservative: under-reports cost, never over-reports margin. |
| Invoice with mixed KG + NOS-unknown lines | Invoice-level margin computed on known lines only; unknowns listed in M2 footer count. |
| Period with zero invoices | Card M1 shows "No data in period"; M2/M3 hidden. |
| Cancelled invoice | Excluded (matches existing stats behaviour). |
| Cost > Revenue (negative margin) | Displayed in red, with leading `-` sign and negative %. M3 and M2 reflect it. |
| Floating-point drift | Every ₹ passes `gstRound`. Every % is displayed via `formatNum(x, 1)` — calc kept in full precision. |
| User changes `defaultCostPerKg` mid-session | `_tabDirty.stats = true` forces re-render on next Stats entry. |

---

## 8. Non-Goals / Future Phases

| Item | Phase |
|------|-------|
| Per-invoice cost snapshot at save time (historical immutability) | IL-5 |
| Per-client cost override (`client.costPerKg`) | Phase 3 |
| Margin trend line (monthly) | Phase 3 |
| Alerts on threshold breach (e.g. margin < 5%) | Phase 3 |
| Margin export to CSV | Phase 3 |
| Part-level cost (per-part `costPerKg`) | IL-6 candidate |
| Cost of consumables (chemicals, salts) modelled separately | Out of scope (strategic — belongs to cost-accounting rewrite) |

---

## 9. Acceptance Criteria

A build is Phase-2-complete when all of these are demonstrable in the deployed PWA:

1. **Margin math correctness**
   - [ ] Per-KG line: `cost = qty × defaultCostPerKg` (rounded).
   - [ ] Per-NOS line with part weight: `cost = qty × partWeight × defaultCostPerKg`.
   - [ ] Per-NOS line without part weight: flagged as unknown, excluded from margin%.
   - [ ] Every ₹ value goes through `gstRound()` — verified by grep.
   - [ ] Margin% for SSS Mehta (rate ₹5.40, baseline ₹5.46) is slightly negative in test data.

2. **UI rendering**
   - [ ] Card M1 shows gross margin ₹, margin %, cost of goods, baseline — all period-filtered.
   - [ ] Card M2 ranks clients worst-first, bipolar bar chart, colour-coded.
   - [ ] Card M3 lists up to 10 worst lines when any line has margin% < 10.
   - [ ] Client flip card shows Margin KPI tile.

3. **Interactions**
   - [ ] Tapping a client bar in M2 opens the existing flip card (no regression).
   - [ ] Tapping "Fix in Items" in M2 footer switches to Items tab.
   - [ ] Tapping a row in M3 opens the invoice detail (reuses `invOpenInvoice`).
   - [ ] Period chip change (MTD/QTD/YTD/All) re-renders all three margin cards.

4. **Edge cases**
   - [ ] With `defaultCostPerKg = 0`, margin block renders its empty state and Settings still works.
   - [ ] With zero invoices in period, M1 says "No data"; M2/M3 are hidden.
   - [ ] Cancelled invoice does not appear in any margin aggregate.
   - [ ] Changing `defaultCostPerKg` in Settings, then returning to Stats, re-renders with new values.

5. **HR compliance (spot-check)**
   - [ ] HR-1: no `style="..."` in any new HTML output.
   - [ ] HR-2: every interactive element uses `data-action`.
   - [ ] HR-3: every new class starts with `inv-`.
   - [ ] HR-4: zero emojis in UI output.
   - [ ] HR-5: `escHtml()` on every part name, client name, description rendered.
   - [ ] HR-6: no raw px/hex in new CSS (except documented exceptions).
   - [ ] HR-7: dark mode variants for every new token; tested with `.dark` on `:root`.
   - [ ] HR-8: `gstRound()` used on every ₹ arithmetic; no `toFixed()` for calc.

6. **No regression**
   - [ ] Existing 7 stats cards render unchanged.
   - [ ] Existing client flip card (front + back) still works; new KPI tile layouts cleanly on narrow widths.
   - [ ] Service worker version bumped; `index.html` synced from `sep-invoicing.html`.

---

## 10. HR Compliance Checklist (architectural)

| HR | How Phase 2 satisfies it |
|----|--------------------------|
| HR-1 | All layout via `.inv-stats-card` / `.inv-stats-metric` / `.inv-flip-kpi` — existing classes. New classes listed in §6.2. |
| HR-2 | New actions: `invMarginFixWeights`. Registered in events.js delegation table. |
| HR-3 | All new classes: `inv-margin-positive`, `inv-margin-thin`, `inv-margin-negative`, `inv-margin-unknown`, `inv-svg-bar-negative`, `inv-svg-bar-positive`, `inv-svg-axis-zero`, `inv-margin-baseline`, `inv-margin-unknowns-footer`. |
| HR-4 | SVG-only for chart glyphs (reusing existing SVG patterns). |
| HR-5 | Part names and client names piped through `escHtml()` — same pattern as stats.js:63,189,245. |
| HR-6 | Only new tokens; no raw values. Dark-mode token pairs mandatory. |
| HR-7 | Each new token has a `.dark` override entry. |
| HR-8 | `gstRound()` wraps every rupee arithmetic expression in the calc engine. `formatNum(x, 1)` used for % display only, never for calc. |

---

## 11. Files Touched / Line Estimate

| File | Change | Est. LOC |
|------|--------|----------|
| `split/stats.js` | New calc functions + 3 card renderers + flip-card KPI | +200 |
| `split/styles.css` | 4 new margin tokens (light + dark) + ~10 new classes | +60 |
| `split/events.js` | `invMarginFixWeights` action handler | +6 |
| `docs/IL-4_PHASE_2_SPEC.md` | This doc | +380 |
| `docs/HANDOFF_PHASE6.md` → Phase 9 | Append Phase 2 summary | +30 |

**No changes** to: state.js, data.js, init.js, create.js, invoice-ops.js, clients.js, items.js, im.js, im-form.js, print.js, exports.js, autocomplete.js, scanner.js, swipe.js, seed.js, tabs.js, head.html, body.html, data.js.

**No state schema change. No migration.** (Enforced by the "no snapshot" scope decision.)

---

## 12. Function Signatures (build-ready)

```js
// New, in stats.js — above renderStats()

function getDefaultCostPerKg() {
  var v = parseFloat(S.defaultCostPerKg);
  return isNaN(v) || v <= 0 ? null : v;
}

function computeLineCost(line) {
  // returns { costKg, cost, known }
  if (!line) return { costKg: 0, cost: 0, known: false };
  var baseline = getDefaultCostPerKg();
  if (baseline == null) return { costKg: 0, cost: 0, known: false };
  var costKg = 0, known = true;
  if (line.unit === 'KG') {
    costKg = line.qty || 0;
  } else if (line.unit === 'NOS') {
    var pwKey = (line.partNumber || '').toUpperCase();
    var pw = S.partWeights[pwKey];
    if (pw && pw > 0) { costKg = (line.qty || 0) * pw; }
    else { known = false; }
  } else {
    known = false;
  }
  return { costKg: costKg, cost: gstRound(costKg * baseline), known: known };
}

function computeInvoiceMargin(inv) {
  // returns { costTotal, marginTotal, marginPct, lines, unknowns }
  var lines = (inv.items || []).map(function(it) {
    var c = computeLineCost(it);
    var cost = c.cost;
    var amt = it.amount || 0;
    var margin = gstRound(amt - cost);
    var pct = amt > 0 ? (margin / amt) * 100 : null;
    return { line: it, costKg: c.costKg, cost: cost, margin: margin, pct: pct, known: c.known };
  });
  var costTotal = gstRound(lines.reduce(function(s, l) { return s + l.cost; }, 0));
  var marginTotal = gstRound((inv.taxableValue || 0) - costTotal);
  var base = inv.taxableValue || 0;
  var marginPct = base > 0 ? (marginTotal / base) * 100 : null;
  var unknowns = lines.filter(function(l) { return !l.known; });
  return { costTotal: costTotal, marginTotal: marginTotal, marginPct: marginPct, lines: lines, unknowns: unknowns };
}

function marginClass(pct) {
  if (pct == null) return 'inv-margin-unknown';
  if (pct < 0) return 'inv-margin-negative';
  if (pct < 20) return 'inv-margin-thin';
  return 'inv-margin-positive';
}
```

Cards M1 / M2 / M3 and the flip-card KPI consume these functions. No calc in the render path beyond `gstRound` on aggregates.

---

## 13. Open Questions (for the Architect)

1. **Margin % thresholds for colour bands.** Spec uses `<0 = red, 0–20 = amber, ≥20 = green`. Is 20% the right cutoff for "healthy"? Operating margin is ~31% per Memory.md — should the thin band be 0–25%?

2. **Card M3 trigger threshold.** Spec shows M3 only when any line has margin% < 10. Should it be `< 0` (bleeding only) or `< 15` (thin-or-worse)?

3. **Unknowns policy in client M2.** Current choice: include client even if all lines are unknown, show `—` and flag footer. Alternative: hide clients with 100% unknown lines from ranking entirely. Architect's call.

4. **Settings baseline edit during active period.** Should changing `defaultCostPerKg` trigger a one-line activity log entry in History? (Phase 3 candidate if yes.)

5. **Worst-lines card — group by part or by line?** Currently by line (same part on two invoices shows twice). Aggregating by part is IL-5 territory.

---

## 14. Review & Sign-off

| Stage | Role | Status |
|-------|------|--------|
| Draft | Solara | ✔ v0.1 |
| Spec review | Cipher | pending |
| Architect approval | Rishabh Jain | pending |
| Build | Solara | pending |
| Post-build QA | Cipher | pending |
| Deploy & handoff doc | Solara | pending |

---

*End of IL-4 Phase 2 spec draft v0.1. Awaiting Cipher review before build.*
