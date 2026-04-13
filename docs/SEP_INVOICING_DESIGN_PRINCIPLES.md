# SEP Invoicing — Design Principles
**Version:** 1.0 · **Created:** 13 April 2026
**Use:** Open alongside code during every build session

---

## 1. Hard Rules

These are non-negotiable. Every session, every build, every line.

**HR-1: No inline styles.**
All styling via CSS classes using design tokens. Zero `style="..."` in HTML output. No exceptions.

**HR-2: No inline onclick.**
All event handling via `data-action` delegation. Zero `onclick="..."` anywhere. The single delegation listener in the event delegation section routes all actions.

**HR-3: inv- CSS prefix.**
Every CSS class uses the `inv-` prefix. No unprefixed classes. 263+ unique classes follow this convention. Prevents collision with other projects sharing origin code.

**HR-4: No emojis.**
SVGs inline in the HTML template. No emoji characters in UI output.

**HR-5: escHtml() on all user-data innerHTML.**
Any string from user input, client names, part descriptions, or imported data must pass through `escHtml()` before insertion into innerHTML. No exceptions.

**HR-6: CSS design tokens only.**
No raw `px`, `rem`, color hex, or timing values in CSS rules. Use `var(--token)` exclusively. See Section 3 for the complete token registry.

Known exceptions (do not expand):
- `44px` min touch targets (WCAG accessibility floor, not tokenized)
- `20px` SVG icon dimensions
- Print CSS uses raw `#000`, `#fff`, `#999` (print bypass theme system)

**HR-7: Dark mode coverage.**
Every new UI element must have dark mode styles. The app uses the `.dark` CSS class on `:root`. All 9 domain colors have light and dark variants.

**HR-8: gstRound() for all currency.**
All currency and GST calculations use `gstRound(val)` → `Math.round(val * 100) / 100`. This is the standard rounding function — used 22+ times across invoicing, challans, and exports. `Math.floor` is only used in `numberToWords()` for extracting integer rupees. Never use `Math.floor` for financial calculations — GST rules require proper rounding. `formatCurrency()` handles Indian comma grouping for display.

---

## 2. Architecture

### Single-File PWA
One HTML file (`sep-invoicing.html`) containing all CSS, JS, and embedded data. Deploy copy is `index.html`. Workflow: edit source → `cp sep-invoicing.html index.html` → git push.

### Persistence
localStorage only. Key: `sep_invoicing_state`. No backend, no GitHub sync. Manual backup/restore via JSON export/import in Settings.

### Section Organization
Code is organized with section comment markers:
```
/* ===== SECTION NAME ===== */
/* ===== SECTION NAME (Phase N) ===== */
/* ===== SECTION NAME (Phase N — Tier M) ===== */
```

Major sections in order: Design Tokens → Reset → Component CSS → Embedded Data → State → Utilities → Tab Switching → Tab Renderers → Event Delegation → Swipe → Init.

### Tab System
7 tabs, switched via `switchTab(tabId)` using a 9-step process (referenced as "DP v0.2"):
| Tab | Page ID | Description |
|-----|---------|-------------|
| Home | pageHome | Dashboard with MTD revenue, recent invoices, unbilled material |
| Create | pageCreate | Invoice creation form with line items |
| IM | pageIM | Incoming Material — challan tracking |
| Register | pageRegister | Invoice Register with filters and search |
| Clients | pageClients | Client Master — 21 clients with rate cards |
| Stats | pageStats | Analytics and business metrics |
| History | pageHistory | Activity log |

### Overlay System
Modal overlays use `inv-overlay-scrim` → `inv-overlay-card` → `inv-overlay-header` structure. Close via `invCloseOverlay` data-action (X button or Cancel), or scrim tap. Escape key does NOT close overlays — it only dismisses autocomplete dropdowns.

### Confirm Dialog
Destructive actions (cancel invoice, delete) use a dedicated confirm dialog with `inv-confirm-body` content and explicit action buttons. Double-confirm for irreversible operations.

### Toast
`showToast(msg, type)` where type is `success` (default), `error`, or `warning`. Auto-dismisses.

---

## 3. Design Token Registry

### Fonts
```css
--ff-base: 'Inter', sans-serif;        /* Body text, labels, inputs */
--ff-display: 'Fraunces', serif;       /* Headers, display text */
--ff-mono: 'JetBrains Mono', monospace; /* Numbers, amounts, codes */
```

### Font Sizes (rem-based)
```css
--fs-2xs: 0.5625rem;  --fs-xs: 0.625rem;  --fs-sm: 0.75rem;
--fs-base: 0.875rem;  --fs-md: 1rem;      --fs-lg: 1.25rem;
--fs-xl: 1.5rem;      --fs-2xl: 1.75rem;  --fs-3xl: 2rem;
```

### Spacing
```css
--sp-2: 0.125rem;  --sp-4: 0.25rem;   --sp-6: 0.375rem;
--sp-8: 0.5rem;    --sp-10: 0.625rem; --sp-12: 0.75rem;
--sp-16: 1rem;     --sp-20: 1.25rem;  --sp-24: 1.5rem;
--sp-32: 2rem;
```

### Border Radius
```css
--r-sm: 0.375rem;  --r-md: 0.5rem;  --r-lg: 0.625rem;
--r-xl: 0.75rem;   --r-full: 9999px;
```

### Shadows
```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
--shadow-md: 0 4px 12px rgba(0,0,0,0.12);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.18);
```

### Animation
```css
--anim-fast: 150ms;
--anim-normal: 300ms;
```

### Layout
```css
--tab-h: 52px;         /* Bottom tab bar height */
--header-h: 48px;      /* Top header height */
--max-w: 520px;        /* Max content width */
--section-gap: var(--sp-16);
--card-padding: var(--sp-16);
--card-padding-sm: var(--sp-12);
```

---

## 4. Domain Color System (9 domains)

Each domain has three token variants: base (icons/borders), bg (tinted background), text (foreground on bg). Base colors are theme-invariant. Only `-bg` and `-text` variants change between light and dark modes.

| Domain | Purpose | Base | Light bg / text | Dark bg / text |
|--------|---------|------|----------------|---------------|
| attend | Active, success | #177a36 | #e8f5ec / #0d5623 | #1a3322 / #6cd88a |
| cost | Revenue, financial | #b5583a | #fdf0eb / #8a3f28 | #3a2218 / #e8a888 |
| prod | Production, quantities | #2e75b6 | #e8f0f8 / #1d5a8f | #1a2a3a / #88b8e8 |
| danger | Errors, delete | #c13e34 | #fceae8 / #9a2e26 | #3a1a18 / #e89090 |
| warning | Caution, alerts | #8a6b08 | #fdf6e0 / #6b5206 | #3a3018 / #d4b848 |
| neutral | Default, info | #8b6c4a | #f5f0e8 / #6b5237 | #2a2518 / #c8b898 |
| accent | Brand (SEP copper) | #b45a37 | — | — |
| cw | Contract worker | #1a8a3e | — | — |
| perm | Permanent worker | #2e75b6 | — | — |

Usage pattern:
```css
.element { color: var(--cost-text); background: var(--cost-bg); }
```

---

## 5. Business Logic Conventions

### Billing Modes
Three modes per client, set in Client Master:

| Mode | Key | How qty/rate work |
|------|-----|-------------------|
| Weight | `weight` | qty = KG, rate = ₹/KG |
| Piece (challan passthrough) | `piece` | qty and rate from challan as-is |
| NOS-to-weight conversion | `nos_to_weight` | qty = NOS, converted to KG via partWeights lookup, billed at KG rate |

### GST
All clients on HSN 998873 (Job work services). Two GST types:
- `intra` (within Jharkhand): CGST 9% + SGST 9%
- `inter` (outside Jharkhand): IGST 18%

### Invoice Numbering
Prefix: `SEP/YYYY-YY/` (financial year). Sequential number auto-incremented from `invNextNum` in state.

### Currency Formatting
`formatCurrency(n)` applies Indian comma grouping (lakhs/crores pattern) with 2 decimal places. All financial displays use this function.

### Date Handling
`localDateStr()` returns `YYYY-MM-DD` in local timezone. `formatDate()` for display. All dates stored as ISO strings.

---

## 6. Data Model

### localStorage Key
`sep_invoicing_state` — single JSON object containing all app state.

### Top-Level Shape
```
company, bankDetails, companyLogo, invPrefix, invNextNum,
clients[], items[], partWeights{}, incomingMaterial[], invoices[]
```

### Client Shape
```
id, name, add1/add2/add3, mobile, phone, email,
gstin, state, stateCode, isActive, billingMode,
rates[{ratePerKg, ratePerPiece, effectiveFrom}],
itemRates[{partPattern, rate, unit, label}],
gstRate, gstType, notes
```

### View Preferences
Separate key: `sep_inv_view_prefs`. Stores register filter state:
```
{ clientId: '', month: 'YYYY-MM', search: '', state: '' }
```

### API Key
Separate key: `sep_inv_gemini_key`. Gemini API key for challan scanning (optional feature).

---

## 7. z-index Hierarchy

| Layer | z-index |
|-------|---------|
| Base content | 0 |
| Cards, badges | 10 |
| Header | 20 |
| Autocomplete dropdowns | 50 |
| Overlay scrim | 100 |
| Overlay card | 200 |
| Confirm backdrop | 250 |
| Confirm dialog | 300 |
| Toast | 500 |
| Print overlay | 510 |

---

## 8. Invoice Lifecycle States

Invoices progress through 4 states, tracked via `invoiceState` field:

```
created → dispatched → delivered → filed
```

States: `INV_STATES = ['created', 'dispatched', 'delivered', 'filed']`

A separate `status` field handles cancellation (`cancelled`). Cancelled invoices display a badge and are excluded from revenue calculations but included in GSTR1 export.

`getInvState(inv)` returns the current state, defaulting to `'created'` for legacy invoices.

---

## 9. Additional Data Shapes

### Invoice (saved)
```
id, displayNumber, clientId, clientName,
clientGSTIN, clientAddress{add1, add2, add3, state, stateCode},
date, gstType,
items[{ partNumber, desc, hsn, unit, qty, rate, amount, nosQty }],
taxableValue, cgstPer, cgstAmt, sgstPer, sgstAmt, igstPer, igstAmt,
grandTotal, amountInWords,
challanNo, challanDate, poNumber, poDate, despatchDate,
transport, eWayBill, remarks,
invoiceState, status, cancelledAt,
linkedIMIds[], createdAt, updatedAt
```

### IM Challan
```
id, challanNo, challanDate, clientId, clientName, vehicleNo,
receivedDate, notes,
items[{ id, partNumber, desc, hsn, unit, qty, rate, amount, nosQty,
        invoiced, invoiceId }],
createdAt
```

### ITEMS_MASTER (embedded, 857 items)
```
{ id, p (partNumber), d (description), h (hsn), u (unit: KG|NOS), r (rate) }
```
Used for part autocomplete. Rates in ITEMS_MASTER are default/reference — actual billing uses client rate cards.

### Invoice Form (in-memory)
```
clientId, date, items[], poNumber, poDate, challanNo,
challanDate, despatchDate, transport, eWayBill, remarks, editingId
```

---

## 10. Rate Lookup Logic

`getLineItemRate(client, invoiceDate, partNumber)` resolves rates in priority order:

1. **itemRates override** — if client has `itemRates[]` entries and `partNumber.includes(partPattern)` matches, use that rate. Returns `{rate, unit, _override: true, _label}`.
2. **Date-effective rate** — filter `client.rates[]` to entries where `effectiveFrom <= invoiceDate`, sort descending, take first.
3. **Earliest fallback** — if no rate is effective yet, use the earliest rate with `_fallback: true` flag.
4. **Zero fallback** — if no rates exist at all, return `{ratePerKg: 0}`.

---

## 11. Swipe Navigation

Touch-based tab switching via horizontal swipe on the main content area. Registered on `touchstart` and `touchend` events. Swipe left → next tab, swipe right → previous tab. 80px minimum threshold, 2:1 horizontal-to-vertical angle constraint. Skips swipe if target is inside a horizontally scrollable container.

Tab order: `pageHome → pageCreate → pageIM → pageRegister → pageClients → pageStats → pageHistory`

---

## 12. Print CSS

A `@media print` block exists for invoice printing. Print view hides the header, tabs, FAB, and other chrome. The print layout renders the full invoice with company letterhead, line items, totals, and bank details. Print is triggered from the invoice detail overlay.

---

## 13. Export Functions

| Function | Output | Scope |
|----------|--------|-------|
| `exportData()` | Full JSON backup | All app state |
| `exportSalesCSV()` | Sales register CSV | Filtered invoices |
| `exportGSTR1CSV()` | GSTR-1 format CSV | Monthly GST filing |
| `downloadCSV(filename, rows)` | Generic CSV download | Utility |

---

## 14. Challan Scanner (AI Vision)

Optional feature using Gemini API. `_scanExtractionPrompt` contains client-specific parsing rules (Dorabji Auto printed challans vs SSS Mehta handwritten pink challans). The prompt extracts challan number, date, client, vehicle, and line items into a structured JSON for import into the IM system.

---

## 15. Focus Stack

`_focusStack` manages input focus restoration when overlays open/close. Push current focus on overlay open, pop and restore on close. Prevents focus loss on mobile keyboards.

---

## 16. Utility Functions

| Function | Purpose |
|----------|---------|
| `loadJSON(key, fallback)` | Safe localStorage.getItem + JSON.parse |
| `saveJSON(key, data)` | Safe localStorage.setItem + JSON.stringify |
| `escHtml(s)` | HTML entity escaping for user data |
| `gstRound(val)` | `Math.round(val * 100) / 100` — standard for ALL currency math |
| `formatCurrency(n)` | Indian comma grouping with 2 decimals |
| `formatNum(n, dec)` | Generic number format with optional decimal places (default 2) |
| `numberToWords(n)` | Rupees + paise in Indian English words |
| `localDateStr()` | Today as YYYY-MM-DD in local timezone |
| `formatDate(dateStr)` | Display format for dates |
| `formatDateExport(dateStr)` | Export-friendly date format |
| `showToast(msg, type)` | Toast notification (success/error/warning) |
| `switchTab(tabId)` | 9-step tab switching protocol |
| `closeOverlay()` | Dismiss active overlay |
| `closePrintPreview()` | Dismiss print preview overlay |
| `getLineItemRate(client, date, partNumber)` | Rate lookup with itemRates override, date-effective fallback |
| `getInvState(inv)` | Returns invoice lifecycle state |
| `showPartAutocomplete(idx, query)` | Part number autocomplete for line items |
| `dismissAllAutocomplete()` | Close all open autocomplete dropdowns |
| `pushFocus()` / `popFocus()` | Save/restore focus for overlay open/close |
| `drainFocusStack()` | Clear focus stack (used on tab switch) |
| `focusFirstInteractive(container)` | Focus first button/input in container |
| `saveState()` | Flush `S` to localStorage via `saveJSON(STORAGE_KEY, S)` |

---

## 17. Architectural Globals

In-memory state variables that drive tab lifecycle and UI coordination:

| Variable | Purpose |
|----------|---------|
| `S` | Main app state object (loaded from localStorage) |
| `_tabDirty` | `{home: bool, register: bool}` — marks tabs for re-render |
| `_tabScroll` | `{pageId: scrollY}` — saves scroll position per tab |
| `_navReturnTab` | Tab to return to after edit (set before navigating away) |
| `_regToolbarRendered` | One-time flag for register toolbar |
| `_imToolbarRendered` | One-time flag for IM toolbar |
| `_challanForm` | In-progress challan form state (null when not editing) |
| `_focusStack` | Array of elements for overlay focus restoration |
| `_regSearchTimer` | Debounce timer for register search |

Migration flags in state: `_nosQtySeeded`, `_scanSeed1` — one-time data migration markers, do not remove.

---

## 18. Keyboard Handling

- **Escape:** Dismisses autocomplete dropdowns and client search results
- **Enter** (on input/select): Advances to next focusable field (skips readonly, skips buttons unless submit). Does not interfere with autocomplete selection.

---

## 19. Responsive Design

No responsive breakpoints. The app is mobile-first only, constrained to `--max-w: 520px`. Only `@media print` exists. No tablet or desktop breakpoints.

---

## 20. Session Conventions

### Before Building
1. Read this document
2. Read the source file section comments to locate the target area
3. Identify which phase/tier the new code belongs to

### During Building
- Follow section comment pattern: `/* ===== NAME (Phase N) ===== */`
- All new CSS classes must use `inv-` prefix
- All new event handlers must use `data-action` delegation
- All user-data in innerHTML must pass through `escHtml()`
- All new UI must have dark mode styles in `.dark {}` block
- All financial calculations must use `gstRound()`, never `Math.floor`
- All financial displays must use `formatCurrency()` for Indian comma grouping
- Overlays must use `pushFocus()` on open, `popFocus()` on close
- Overlays must set `document.body.style.overflow = 'hidden'` on open, `''` on close

### After Building
- Verify 0 inline styles, 0 inline onclick
- Verify dark mode renders correctly
- Verify currency displays use Indian comma format
- Test on 375px viewport width (mobile-first)

### Deploy
```bash
cd ~/storage/downloads/sep-invoicing
cp sep-invoicing.html index.html
git add -A
git commit -m "description"
git push
```

---

*This document is the builder's contract. Every rule exists because a real bug or inconsistency taught us it was needed.*
