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

Split-file PWA. 27 modules, ~11,750 lines total.

```
split/
├── build.sh           ← writes ../sep-invoicing.html, syncs ../index.html
├── head.html          ← DOCTYPE, meta, font links (17 lines)
├── styles.css         ← All CSS with inv- prefix (2,131 lines)
├── body.html          ← HTML body, tabs, print view (128 lines)
├── data.js            ← ITEMS_MASTER + SEED_CLIENTS (27 lines)
├── state.js           ← State mgmt, utilities, escHtml, gstRound (298 lines)
├── zinc.js            ← Zinc market rate: store, display, metals.dev refresh (199 lines)
├── tabs.js            ← switchTab (9-step protocol) + renderHome (188 lines)
├── clients.js         ← Client Master CRUD + overlay (343 lines)
├── items.js           ← Items Master: subview, CRUD, merge, weights (1,228 lines)
├── create.js          ← Invoice creation form, 3 billing modes (312 lines)
├── settings.js        ← Settings overlay + import/export (208 lines)
├── github-sync.js     ← GitHub Contents API push/pull, SHA conflict guard (449 lines)
├── invoice-ops.js     ← Invoice detail, edit, cancel, delete, register (949 lines)
├── number-audit.js    ← Void ledger + serial-sequence audit + gap reconcile (311 lines)
├── exports.js         ← Sales CSV + GSTR1 CSV exports (107 lines)
├── im.js              ← Incoming Material list + selection (535 lines)
├── autocomplete.js    ← Part number autocomplete (169 lines)
├── print.js           ← formatInvoiceData + print preview (224 lines)
├── quality-cert.js    ← Test Certificate (ZN Plating): approved format + per-line certs (380 lines)
├── stats.js           ← Stats dashboard + History activity log (1,070 lines)
├── im-form.js         ← IM add/edit/delete challan form (450 lines)
├── im-dupe.js         ← IM duplicate guard: fingerprint + pre-save warn + scan (305 lines)
├── scanner.js         ← Challan scanner (Gemini AI vision) (146 lines)
├── events.js          ← Event delegation + input handlers (672 lines)
├── swipe.js           ← Swipe navigation (38 lines)
├── seed.js            ← Seed IM data, one-time (8 lines)
└── init.js            ← Migrations + app bootstrap (420 lines)
```

**Concat order defined in build.sh.** Dependencies: data → state → zinc → tabs → clients → items → create → settings → github-sync → invoice-ops → number-audit → exports → im → autocomplete → print → quality-cert → stats → im-form → im-dupe → scanner → events → swipe → seed → init.

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
pnpm exec playwright test          # 128 tests, both layouts
```

Some sandboxes ship a Chromium build Playwright does not expect and block downloading
the matching one. The session hook detects that and sets `PW_CHROMIUM_PATH`, which
`playwright.config.ts` reads; unset everywhere else. The suite finishes in under a minute
on a CI runner and takes ~13 minutes in a constrained sandbox — don't read a slow local
run as a hang.

**Fixtures carry `todayIso()` / `recentTs()`, never hardcoded dates.** Three tests have now
been found passing only because of when they were written or what they happened not to
filter on; a literal date in a fixture is a time bomb, not a constant.

## Hard Rules (HR-1 through HR-8)

| HR | Rule |
|----|------|
| HR-1 | No inline styles. CSS classes + design tokens. |
| HR-2 | No inline onclick. data-action delegation only. |
| HR-3 | inv- CSS prefix on every class. 486 classes follow this. |
| HR-4 | No emojis. Inline SVGs in HTML template. |
| HR-5 | escHtml() on all user-data innerHTML. |
| HR-6 | CSS design tokens only. No raw px/rem/hex/timing. |
| HR-7 | Dark mode coverage on every new element. `.dark` class on `:root`. |
| HR-8 | gstRound() for all currency. `Math.round(val * 100) / 100`. Never Math.floor for financials. GST rules require proper rounding. |

**Known HR-6 exceptions (do not expand):** 44px min touch targets (WCAG), 20px SVG icons, print CSS
raw colors, and the quality certificate's A4 measurements (mm/pt), which are declared once in the
`.inv-qc-page` token block and read as `var()` by every rule after it.

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

**The app now corroborates this model from the invoice data, independently.** Once weights are
derived (below), Stats measures blended realisation at **₹8.42/kg against the modelled ₹8.45**,
contribution at **−₹0.13/kg against a modelled −₹0.09**, and SSS Mehta at **62% of tonnage
against the modelled 61%**, on 39% of revenue. Nothing in
that calculation knew the cost model; it is arithmetic over 769 invoices. Two routes to the
same shape is the strongest evidence the model is right that this repo has.

SSS Mehta's own ₹5.39/kg is the one figure that is not independent confirmation — its weights
invert its contract rate, so that number is ₹5.40 restated. Its **tonnage** is real, and that
is what the corroboration above rests on.

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

### Quality certificates
The Test Certificate (ZN Plating) is issued **per part per dispatch**, not per invoice — the
customer files it against the part they inspect — so an invoice covering three part numbers is
three certificates. Generated from the register: per invoice from its detail, or in bulk from a
selection.

The format is approved by Tata Motors QA and says so on its own face: *"No alterations are
permissible to the format without written approval of QA - TML."* So `QC_SHOP_DATA` reproduces the
04/02/26 reference **verbatim, typos included** — `Cynide`, `Brightner`, `Ruse`, `Peef off`,
`Importer Coverage`, `final gating`, `Ginca`, `Rodiprind`. Correcting the spelling would invalidate
the approval that makes the document worth issuing. It is a constant and not part of `S` for the
same reason an imported backup must not be able to rewrite it.

Company identity is the one exception: name, address, contacts and GSTIN are read from `S.company`,
so the certificate and the tax invoice can never disagree about who issued them. The prototype in
`docs/test-certificates/` froze a second copy and they had already drifted — it carries GSTIN
`20AAFFS4718J2ZD` where the invoice files under `20AAPFS4718J2Z0`, and both cannot be right.

**The certificate reference is derived, not counted:** `QC/<displayNumber>/<line no>`. Regenerating
a certificate must yield the number it had the first time, and a derived reference cannot gap,
cannot be voided, and needs no ledger of its own — the whole apparatus that `S.voidedNumbers` exists
to provide for invoice numbers is unnecessary here because the number *is* a pointer to the invoice
line it certifies. Nothing is written to state when one is printed.

**A cancelled invoice certifies nothing** and is refused: those goods were never billed, and the
number appears in GSTR-1 at zero. A bulk run states what it skipped rather than quietly printing
fewer pages — a certificate missing from a stack of forty is not noticed until the customer asks.

**Net Wt. is per consignment** — the kilograms of that part in that dispatch, scoped to the line the
certificate covers, not the whole invoice. (Settled with the owner Aug 2026; the approved reference
left it at `0.000` and never said whether it meant per piece or per consignment.) It is filled only
from a weight the invoice was itself **priced on**: a KG line's quantity is already kilograms, and a
`nos_to_weight` line's kilograms are `qty × S.partWeights[part]` — the same arithmetic
`recalcLineItem()` ran to produce the amount.

**A piece-billed line keeps the blank.** The only weight available for it is the Items Master
`stdWeightKg`, defined as `pieceRate ÷ ratePerKg` — exact for tonnage and capacity share, but it is
the rate card read backwards, and the customer being handed the certificate is the one who set that
rate. Quantity and Net Wt. reading alike on a KG line is correct, not a duplicated cell: that is
what being billed by the kilo means, and the form carries both fields because piece-billed parts
make them differ.

The observations (`10-12` thickness, `TRIYELLOW`) are still the reference's constants, not per-batch
measurements.

### What Stats measures
Revenue alone cannot tell a good month from a loss-making one here: the same ₹1L of billing
is healthy at 8 tonnes and ruinous at 20. So every headline figure is carried next to the
tonnage that produced it, and **realisation (₹/kg) is the primary number**, not a derived one.

Tonnage comes from KG lines directly, and from NOS lines by three routes in order:
`partWeights`, the Items Master `stdWeightKg`, and — for a **piece-billed** client — the line's
own `amount ÷ ratePerKg`. That last route matters more than it sounds: 127 of SSSMehta's lines
name parts with no Items Master row at all, 17% of that client's revenue, and routing weight
through the registry left every one uncounted. Their part numbers also vary in spelling between
invoices (`Clamp 165x83` against `CLAMP 165X83(40X6)`), so registry matching would stay fragile
even if the rows existed. Reading the line direct sidesteps both.

**Realisation divides revenue by tonnage over the same lines.** Dividing *total* revenue by
*weighed-only* tonnage inflates the answer by exactly `1 / coverage` — it read ₹21.23/kg on
live data where the matched figure was ₹13.00. Numerator and denominator must always be the
same subset, blended and per client alike.

**Coverage is stated in revenue terms, not line count.** One unweighed line worth ₹10L matters
more than fifty worth ₹500. And the exclusion is never neutral: unweighed lines are the
piece-billed work, which is the low-realisation end, so a partial figure always reads *better*
than the real blend. The card says so in place rather than letting it pass as complete.

**A client under 90% coverage is listed but not ranked** — shown as `n/a` with its coverage,
under a banner naming the revenue that cannot be priced. A ₹/kg drawn from 2% of a book is not
the same kind of number as one drawn from all of it, and sorting them together asserts that
it is. Concentration withholds tonnage share for such a client for the sharper version of the
same trap: an account with no weights barely enters the measured denominator and reads as a
*small* user of the plant when it is plausibly the largest. "Unknown, not small."

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

**Weights derive themselves at bootstrap.** Where a client bills per piece off a rate per kg,
`weight = pieceRate ÷ ratePerKg` recovers it exactly, and `init.js` runs that once via
`applyDerivedWeights()`. It fills only empty weights, is idempotent, and never touches billing:
rates resolve through `getLineItemRate()` against the client ladder, `stdWeightKg` is read by
Stats and Items Master alone, and the `nos_to_weight` path reads `S.partWeights`, which this
does not write. The `_deriveWeights1` flag is only set once there *was* something to derive
from, so a device that loads empty and imports a backup later still gets its pass. The Items
Master button remains for items added after that pass and shares the same function.

Leaving this behind a button nobody had pressed is what made the dashboard quietly wrong: 90
of 168 rows had no weight, almost entirely the piece-billed parts, so tonnage covered 61% of
revenue and the one account the figures existed to examine was the one they could not see.
The pass fills 72 of the 90 and takes coverage to 94%; the 18 it leaves are KG-billed, whose
quantity is already kilograms.

Note what such a weight is: defined as `pieceRate ÷ ratePerKg` it prices back at exactly that
rate. The weight itself is exact — the rate card was built as weight × rate — and the tonnage
it yields is real. What it cannot do is *independently* re-establish the ₹/kg, because that
was the input. For a piece-billed client, realisation always equals the contract rate; that is
arithmetic, not a finding. The value of these weights is **tonnage and capacity share**.

**Gauge is part of a part's identity.** Four clamp families exist in two gauges at different
rates — `CLAMP 165X83 (NT)` at 35X6 and 40X6, plus `105X83 (NT)`, `133X83 (NT)` and
`124X77 (UT)` — so two rows can share a part number and be different weights. Two consequences:
the printed line description folds the gauge in via `partLineDesc()` on **both** the invoice and
challan paths (the challan path used to drop it, and since IM is the billing spine that omission
flowed into every invoice raised off the challan); and weight derivation **skips** any part
number held by more than one gauge rather than averaging them into a figure right for neither.
Skipping costs no tonnage — the line-level route above still weighs those lines correctly.

### Client Master
22 clients with rate lookup, billing mode assignment, and contact info. Billing modes in live
data: 20 `weight`, 1 `piece` (SSS Mehta), 1 `nos_to_weight`.

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
