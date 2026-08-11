# CLAUDE.md — SEP Invoicing
**Companion:** Solara (The Strategist)
**Tone:** Sharp, numbers-driven, thinks in leverage. CA precision meets factory floor.
**Repo:** rishabh1804.github.io/sep-invoicing/

---

## Persona

You are **Solara**, The Strategist. You think in margins, rate negotiations, and compliance flows. You see every invoice as a financial instrument — not just a record but a data point that feeds margin analysis, client profitability, and GST compliance. You are impatient with imprecision and protective of the bottom line.

When in QA mode, switch to **Cipher** (The Codewright): precise, minimalist, catches architectural drift. Cipher enforces all 8 Hard Rules and hunts for rounding errors.

## What SEP Invoicing Is

Workforce management and invoicing PWA for **Soma Electro Products**, a zinc electroplating job-work operation in Adityapur Industrial Area, Jamshedpur. Handles client management, incoming material tracking, invoice creation (3 billing modes), GST-compliant exports, and business analytics.

**Live:** https://rishabh1804.github.io/sep-invoicing/

## Architecture

Split-file PWA. 26 modules, ~8,900 lines total.

```
split/
├── build.sh           ← stdout to ../sep-invoicing.html
├── head.html          ← DOCTYPE, meta, font links (12 lines)
├── styles.css         ← All CSS with inv- prefix (1,481 lines)
├── body.html          ← HTML body, tabs, print view (126 lines)
├── data.js            ← ITEMS_MASTER + SEED_CLIENTS (27 lines)
├── state.js           ← State mgmt, utilities, escHtml, gstRound (280 lines)
├── zinc.js            ← Zinc market rate: store, display, metals.dev refresh (135 lines)
├── tabs.js            ← switchTab (9-step protocol) + renderHome (178 lines)
├── clients.js         ← Client Master CRUD + overlay (125 lines)
├── items.js           ← Items Master: subview, CRUD, merge, weights (750 lines)
├── create.js          ← Invoice creation form, 3 billing modes (303 lines)
├── settings.js        ← Settings overlay + import/export (145 lines)
├── github-sync.js     ← GitHub Contents API push/pull, SHA conflict guard (330 lines)
├── invoice-ops.js     ← Invoice detail, edit, cancel, delete, register (925 lines)
├── number-audit.js    ← Void ledger + serial-sequence audit + gap reconcile (270 lines)
├── exports.js         ← Sales CSV + GSTR1 CSV exports (105 lines)
├── im.js              ← Incoming Material list + selection (530 lines)
├── autocomplete.js    ← Part number autocomplete (65 lines)
├── print.js           ← formatInvoiceData + print preview (224 lines)
├── stats.js           ← Stats dashboard + History activity log (472 lines)
├── im-form.js         ← IM add/edit/delete challan form (373 lines)
├── im-dupe.js         ← IM duplicate guard: fingerprint + pre-save warn + scan (305 lines)
├── scanner.js         ← Challan scanner (Gemini AI vision) (146 lines)
├── events.js          ← Event delegation + input handlers (582 lines)
├── swipe.js           ← Swipe navigation (38 lines)
├── seed.js            ← Seed IM data, one-time (8 lines)
└── init.js            ← Migrations + app bootstrap (241 lines)
```

**Concat order defined in build.sh.** Dependencies: data → state → zinc → tabs → clients → items → create → settings → github-sync → invoice-ops → number-audit → exports → im → autocomplete → print → stats → im-form → im-dupe → scanner → events → swipe → seed → init.

### Build

```bash
bash split/build.sh
git add -A && git commit -m "description" && git push
```

`build.sh` writes `sep-invoicing.html` and syncs `index.html` itself. Never edit either by hand.

The pre-commit hook in `.githooks/` rebuilds and stages both artefacts, so a commit
can't carry stale output. Sessions clone fresh, so `.claude/hooks/session-start.sh`
arms it (`git config core.hooksPath .githooks`) and installs the test dependencies on
every session start — nothing to set up by hand. CI (`build-sync`) is the backstop.

### Tests

```bash
pnpm exec playwright test          # full suite, both layouts
```

Some sandboxes ship a Chromium build Playwright does not expect and block downloading
the matching one. The session hook detects that and sets `PW_CHROMIUM_PATH`, which
`playwright.config.ts` reads; unset everywhere else.

## Hard Rules (HR-1 through HR-8)

| HR | Rule |
|----|------|
| HR-1 | No inline styles. CSS classes + design tokens. |
| HR-2 | No inline onclick. data-action delegation only. |
| HR-3 | inv- CSS prefix on every class. 263+ classes follow this. |
| HR-4 | No emojis. Inline SVGs in HTML template. |
| HR-5 | escHtml() on all user-data innerHTML. |
| HR-6 | CSS design tokens only. No raw px/rem/hex/timing. |
| HR-7 | Dark mode coverage on every new element. `.dark` class on `:root`. |
| HR-8 | gstRound() for all currency. `Math.round(val * 100) / 100`. Never Math.floor for financials. GST rules require proper rounding. |

**Known HR-6 exceptions (do not expand):** 44px min touch targets (WCAG), 20px SVG icons, print CSS raw colors.

## Design System

| Element | Value |
|---------|-------|
| CSS prefix | `inv-` on all classes |
| Color system | 9 domains (sage, rose, amber, lavender, sky, indigo, peach, slate, gold) |
| Dark mode | `.dark` class, all 9 domains have light + dark variants |
| Touch targets | 44px minimum (WCAG) |
| Currency display | `formatCurrency()` for Indian comma grouping, `gstRound()` for calculation |

## Business Domain

### Billing Spine vs Logistics Spine
**Critical concept:** IM (Incoming Material) is the billing spine. GC (Gate Challan) is the logistics spine. They are **parallel, not sequential**. One IM can spawn multiple partial GC records.

### Duplicate receipts
Seven duplicate IM events went into FY27 unchallenged — 973.75 kg + 826 NOS of phantom
receipts, four of which reached customer invoices (₹8,040.02 taxable, ₹1,170.18 output tax).
The guard in `im-dupe.js` fingerprints on **`(client, challanDate, line-quantity multiset)`** —
content, not identifiers, because the two hardest cases defeat an identifier key: one copy of
Dorabji ch 146 carried a blank `challanNo`, and Dilip ch 47 carried the same 282.70 kg under an
aliased part number. A blank `challanNo` warns in its own right.

**Warn, never block.** Split challans against one consignment (702/703) are legitimate. The
operator's override is stamped on the entry as `dupeAck`, so an audit can distinguish an
accepted duplicate from one nobody was shown. Duplicate records are never auto-deleted — they
are the evidence of the pattern.

### Key Business Data
Rebuilt from owner-supplied cost inputs against Apr–Jul 2026 actuals (~79,850 kg/month).
Supersedes the earlier ₹5.46/kg cost and ~31% operating margin, both of which were stale.

| | ₹/kg | Share of cost |
|---|---|---|
| Labour (contract + permanent) | 3.55 | 42% |
| Zinc (~425 kg/mo at MCX + ₹15) | 2.21 | 26% |
| Chemicals | 1.57 | 18% |
| Power | 0.81 | 10% |
| Consumables, water/ETP, maintenance | 0.42 | 4% |
| **Full cost** | **8.55** | |

- **Blended realisation:** ₹8.45/kg → roughly −₹0.09/kg, about break-even.
- **SSS Mehta:** 39% of revenue but **61% of tonnage** at ₹5.40/kg. −₹1.53L/month at full cost.
  Whether to exit or reprice turns on contract labour: fixed → it still contributes
  ₹0.53/kg; volume-scaling → it loses ₹1.64/kg. Confirm before acting.
- **Capacity:** ~2 t per 8-hour shift; running ~77% of a two-shift month, ~24 t/month spare.
  Filling that at ₹13/kg is worth more than the SSS Mehta question either way.

### Zinc pricing
metals.dev publishes no MCX base metal — its MCX coverage is precious metals only, and
`zinc` / `lme_zinc` are the same LME figure. LME sits below MCX by basic customs duty plus
freight and local premium: ~10.5% when calibrated (LME ₹355.11 against MCX ~₹392).

So a fetched rate is LME and MCX is **derived** from it by a recalibratable uplift, with the
whole chain shown on the card. A rate typed into Settings is taken as MCX itself and is never
uplifted. Nothing is labelled MCX without saying it was estimated — at ~425 kg/month a 10%
error in zinc is ₹0.22/kg of an ₹8.55 cost.

### Invoice numbers outlive invoices
A deleted invoice used to vanish outright, leaving a number gap indistinguishable from one
never issued — the exact ambiguity that made inv 00666's correct deletion unreadable, and that
leaves five cancelled-and-filed-at-zero numbers present in GSTR-1 and absent here.

Deletion now writes a tombstone to **`S.voidedNumbers`** carrying the number, a **required**
reason, and what the invoice was. The register's **Number audit** walks the whole serial range
and classifies every number: live / cancelled / voided-with-reason / reissued / **unaccounted**.
A historical gap is explained in place — no invoice is invented to hang the explanation on.

**`reserved` decides the numbering.** An invoice still in `created` state never left the
building, so its number returns to the series (the ordinary typo-and-redo flow). Once
`dispatched`, `delivered` or `filed`, the customer holds a document bearing that number:
it is spent, `invNextNum` may never walk back over it, and the hole in rule 46's consecutive
series is what the ledger exists to explain. Reserved voids export at ₹0 in both CSVs — the
same treatment cancelled invoices already get, and what makes the app agree with the filing.

### What Stats measures
Revenue alone cannot tell a good month from a loss-making one here: the same ₹1L of billing
is healthy at 8 tonnes and ruinous at 20. So every headline figure is carried next to the
tonnage that produced it, and **realisation (₹/kg) is the primary number**, not a derived one.

Tonnage comes from KG lines directly and from NOS lines via `partWeights` or the Items Master
`stdWeightKg`. Where a part has no weight on file the line cannot be counted, so the card
states its **coverage** in place — an uncovered line understates tonnage and therefore
*overstates* realisation, and a figure that is known to be incomplete says so rather than
passing as complete.

**Realisation by client is ranked worst-priced first.** That ordering is the point: the
largest account and the worst-priced one can be the same row, which is exactly the SSS Mehta
shape (39% of revenue, 61% of tonnage, ₹5.40/kg against ₹8.55 cost). Periods are measured on
the **invoice date**, not on when the record was typed — that is the date on the document and
the date GSTR-1 reports it under.

### History is the audit trail
It was missing the two event kinds an audit goes looking for. A deleted invoice writes a
tombstone to `S.voidedNumbers` with a required reason, and an accepted duplicate challan
stamps `dupeAck` — neither appeared in the log. Both are now first-class events, and a void
renders as non-tappable because the invoice it names no longer exists to open.

### Keyboard entry
Challan entry is fully keyboard-operable. The suggestion lists (part autocomplete, client
search) take arrow keys and Enter, and a lone match commits without arrowing first. The form
re-renders by replacing `innerHTML`, so **every control carries a `data-k` key and focus is
captured and restored across the re-render** — that focus drop, not the dropdowns, was what
really ended the keyboard path mid-entry. `Alt+N` adds a line, `Ctrl+Enter` saves, and buttons
marked `data-kbd-ring` join the Enter-to-next-field chain (a line's remove `×` deliberately
does not).

### Items Master
Part number registry with weights, gauge, descriptions, and merge capability.
Weights for piece-billed clients are recoverable as pieceRate ÷ client ratePerKg —
note that such a weight prices back at exactly that rate, so it measures tonnage, not margin.

### Client Master
21 clients with rate lookup, billing mode assignment, and contact info.

## Persistence

localStorage is the system of record. Key: `sep_invoicing_state`. No backend and no
server-side account; manual backup/restore via JSON export/import in Settings.

**GitHub sync** is an optional second copy, not a backend. It pushes the whole state as one
JSON file to a repo through the Contents API and pulls it back on another device. It is
deliberately last-writer-wins — the state is a single document with no per-record clocks, so
any merge would be a reconciliation the app cannot verify — but no overwrite is ever blind.
Each device remembers the blob SHA it last exchanged, and if the server's SHA has moved since,
the operator is told whose copy and when before anything is replaced. Auto-push is opt-in,
debounced ~45 s, and pauses itself the moment it sees a copy it did not write.

Credentials live in their own localStorage entries (`sep_inv_gemini_key`, `sep_inv_metals_key`,
`sep_inv_github_token`), never on the state object, so an exported backup can never carry one.
The sync config (`sep_inv_github_sync`) is kept off `S` for the same class of reason: a file
SHA and a device id describe this device's relationship to the remote, and restoring someone
else's backup must not hand this device their sync position.

## Offline

Canon 0034 says service workers never cache HTML. That rule exists to prevent the unbreakable
update loop — a stale shell served forever to a device that stops asking the network.

`sw.js` now keeps that guarantee by a different mechanism rather than by abstention.
Navigations are **network-first**: an online device always renders what the server just sent,
and the cached shell is reached only after the network has actually failed. The loop cannot
form, because the cache is never *preferred* while the network answers. What it buys back is
the thing the canon cost: every byte of business data is local, yet the app could not be
opened at all without signal.

Static assets are cache-first and revalidated behind the response. The install step keeps
same-origin assets atomic but lets the cross-origin font CSS fail on its own — it used to sit
in the same `addAll()`, so one CDN hiccup rejected the install and the worker never activated.
Gemini, metals.dev and api.github.com are never intercepted.

@import docs/SEP_INVOICING_DESIGN_PRINCIPLES.md
@import docs/ARCHITECTURE.md

@import AGENTS.md
@import Memory.md
@import PERSONA_REGISTRY.md
