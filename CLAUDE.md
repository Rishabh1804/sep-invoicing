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

Split-file PWA. 33 modules, ~15,950 lines total.

```
split/
├── build.sh           ← writes ../sep-invoicing.html, syncs ../index.html
├── head.html          ← DOCTYPE, meta, font links (17 lines)
├── styles.css         ← All CSS with inv- prefix (2,720 lines)
├── body.html          ← HTML body, tabs, print view (137 lines)
├── data.js            ← ITEMS_MASTER + SEED_CLIENTS (27 lines)
├── state.js           ← State mgmt, utilities, escHtml, gstRound (384 lines)
├── zinc.js            ← Zinc market rate: store, display, metals.dev refresh (199 lines)
├── tabs.js            ← switchTab (9-step protocol) + renderHome (188 lines)
├── clients.js         ← Client Master CRUD + overlay (343 lines)
├── items.js           ← Items Master: subview, CRUD, merge, weights (1,262 lines)
├── create.js          ← Invoice creation form, 3 billing modes (312 lines)
├── settings.js        ← Settings overlay + import/export (272 lines)
├── github-sync.js     ← GitHub Contents API push/pull, SHA conflict guard (452 lines)
├── invoice-ops.js     ← Invoice detail, edit, cancel, delete, register (949 lines)
├── number-audit.js    ← Void ledger + serial-sequence audit + gap reconcile (311 lines)
├── exports.js         ← Sales CSV + GSTR1 CSV exports (107 lines)
├── im.js              ← Incoming Material list + selection (535 lines)
├── autocomplete.js    ← Part autocomplete + inline item creation (270 lines)
├── print.js           ← formatInvoiceData + print preview (224 lines)
├── quality-cert.js    ← Test Certificate (ZN Plating): approved format + per-line certs (380 lines)
├── credit-note.js     ← Credit notes: batch discount, own series, CDNR export (557 lines)
├── charts.js          ← Reusable SVG charts: line, bar, pie, ranked bars (243 lines)
├── staff.js           ← Roster + attendance + roster import: day, week, extra hours (1,013 lines)
├── labour.js          ← Labour: three pay tiers, fixed/variable, by area, ₹/kg (449 lines)
├── areas.js           ← Areas: staffing vs norms + the extra reconciled (963 lines)
├── stats.js           ← Stats dashboard + History activity log (1,195 lines)
├── client-perf.js     ← Client performance: month on month + material cadence (314 lines)
├── im-form.js         ← IM add/edit/delete challan form (450 lines)
├── im-dupe.js         ← IM duplicate guard: fingerprint + pre-save warn + scan (305 lines)
├── scanner.js         ← Challan scanner (Gemini AI vision) (146 lines)
├── events.js          ← Event delegation + input handlers (771 lines)
├── swipe.js           ← Swipe navigation (38 lines)
├── seed.js            ← Seed IM data, one-time (8 lines)
└── init.js            ← Migrations + app bootstrap (567 lines)
```

**Concat order defined in build.sh.** Dependencies: data → state → zinc → tabs → clients → items → create → settings → github-sync → invoice-ops → number-audit → exports → im → autocomplete → print → quality-cert → credit-note → charts → staff → labour → areas → stats → client-perf → im-form → im-dupe → scanner → events → swipe → seed → init.

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
pnpm exec playwright test          # 257 tests, both layouts
```

Some sandboxes ship a Chromium build Playwright does not expect and block downloading
the matching one. The session hook detects that and sets `PW_CHROMIUM_PATH`, which
`playwright.config.ts` reads; unset everywhere else. The suite finishes in under a minute
on a CI runner and takes ~13 minutes in a constrained sandbox — don't read a slow local
run as a hang.

**A `<select>` speaks through `change`, never `click`.** Giving a filter control a
`data-action` meant the click that *opens* it ran the handler — and if that handler
re-renders the toolbar, the element the native popup hangs off is replaced and the list
shuts before anything can be picked. Same for an `<input type="date">` on `input`: only
re-render for the field that actually changes what is displayed.

**A selection must not outlive the filter that hid it.** Register and IM both had rows that
stayed ticked after they left the screen, with every bulk action still reaching them.
`captureRegFilters()` and `captureIMFilters()` clear it; the register search binds its own
listener and has to do it too.

**`emptyState()` is not empty.** `seed.js` fills `incomingMaterial` with 50 demo challans whenever
it is an empty array — there is no one-time flag, only the emptiness test — so any spec asserting on
challan-derived data without supplying its own silently measures the seed. `noSeedIM()` in the
fixtures blocks it.

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
raw colors, and the printed documents' physical measurements (mm/pt) — the quality certificate's
and the credit note's — each declared once in a token block (`.inv-qc-page`, `.inv-cn-doc`) and read
as `var()` by every rule after it.

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
so the certificate and the tax invoice can never disagree about who issued them. **Never freeze a
second copy into a document template** — the prototype in `docs/test-certificates/` did, and it had
already drifted: it carried GSTIN `20AAFFS4718J2ZD` where the invoice files under
`20AAPFS4718J2Z0`. The owner confirmed (14 Aug 2026) that `20AAPFS4718J2Z0` is correct and the
certificate copy was a transcription typo. The JSON is corrected; the four certificates rendered
from it on 15 Apr 2026 still carry the wrong number, and any copy that reached SSS Mehta bears it.
That error is distinct from the preserved original-document typos — those are approved format text,
a GSTIN is a fact about the taxpayer.

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

### Credit notes
SSS Mehta hold a **standing 2% discount on any payment batch spanning 7 days or more** — bought
to smooth cash flow, temporary but in force. Each such batch ships as two documents: the sales
register for the range, and a credit note for 2% of it. So **the batch is the unit, not the
invoice**, which is why the 04/08/26 reference credits ₹5,902.12 against ~₹2.95L of taxable.

Raised from a register selection, which is what makes select-all and the date-range filter part
of the same workflow: tick the batch, export its register, raise the note off the same set. One
customer only. A batch under 7 days **warns and does not block** — split batches are the
operator's call.

**The discount is computed on value; the quantity is derived from it.** 1092.98 × 5.40 = 5902.09
against the 5902.12 printed — three paise of disagreement only happen if the rupees came first.

Own series, `CN/<3-digit>/<FY short>`, formatted off `S.invPrefix`. A credit note number is
**issued**, so it may never be reused — but it needs no void ledger, because a credit note is
**cancelled, never deleted**, which is the correct GST treatment anyway. The number stays in the
series carrying its own explanation and exports at zero. Its own CSV, too: credit notes go to
GSTR-1 table 9B (CDNR), whose columns are not the B2B ones.

The reference had four defects the app does not reproduce — see `docs/credit-notes/README.md`.
The headline one is the same identity drift the certificate had: header "SOMA ELECTRO PRODUCT"
against footer "SOMA ELECTRO PRODUCTS". Identity is read from `S.company`, never frozen.

**This changes the SSS Mehta numbers.** At a standing 2%, their realisation is ~₹5.29/kg, not
₹5.40 — and Stats reads invoices only, so every SSS Mehta figure above is overstated by 2%
until credit notes are netted off. Not yet done; the contribution arithmetic in Key Business
Data has not been restated.

### The floor, by area
Staff tab → **Areas**. The same attendance store read by place instead of by person, because two
questions live there and nowhere else: is an area staffed right, and does the extra hold up.

**Staffing is measured against a complement the owner sets**, editable in place, with the area's
own observed median beside it — a target that was never true is then visible as such. An area with
no complement says *no complement* rather than reading as overstaffed against an implied zero.
Heads are counted from the day's marks, so a worker lent to another area counts where they
actually stood; and marks on `flex` are reported as a named shortfall rather than distributed,
because a floating hand is a fact about the day and not a gap to fill by guesswork.

**The areas are the shop's own, and the split is not cosmetic.** The staffing norms are defined
on these exact units — **VAT A1 4 · VAT A2 4 · Barrel 3 · Barrel pickling 2 · Pickling A1+A2 3**,
sixteen on the floor at full house, ruled 11 Jun 2026 and re-confirmed by the owner 27 Aug — and pickling is two sub-areas that the daily relay already
divides. A single flat `pickling` can carry neither norm, so it can carry neither shortfall, so
the extra cannot be checked against it. **Colour is not an area**: it is the *dedicated
passivation hand* inside VAT A1's complement of four. The step itself is not A1's — A2's operators
passivate their own work and the barrel route passivates too — what is A1-specific is that a hand
is set aside for it. Giving it an area of its own was this module's invention; the shop's own
register codes those hands `A1`.

**The extra is a prediction, not a mystery.** A hand missing from an area running at full tilt is
covered by the crew who are there, and **8 hours are booked to that area for it**. So expected
extra is `Σ max(0, norm − heads) × 8` per unit per day, set against what was actually booked.

**Be exact about which part of that is ruled.** The 11 Jun ruling fixes two things: the label sits
under the *short sub-area*, and its worked example — A1 3/4, A2 3/4, pickling 2/3 → 24 h. Every gap
in that example is **one**, so it cannot distinguish 8-per-missing-hand from 8-per-short-area. The
per-hand scaling is the **owner's, confirmed 27 Aug 2026**; before that it was a working hypothesis
whose author labelled it as one. Two recorded days contradict it — **W27 Mon 29 Jun** and **W28 Fri
10 Jul**, both VAT A1 at 2 of 4, both tagged 8 where per-hand predicts 16. Instrument:
`grep -rnoE "EXTRA[^|)]{0,30}(short [0-9])" attendance/*.md` over soma-internal returns **four**
annotated pairings — W26:18 (short 2 → 16 h), W26:58 (short 1 → 8), W27:17 (short 2 → 8), W27:19
(short 1 → 8) — so **two of the four**, on that instrument, are the counter-cases, and both are a
two-hand VAT line tagged a single shift. W27 offers its own reading of one of them: `2026-W27.md`
decodes that 8 h as *"2 named hands (Lakhi, Lal) + 8 hr casual"* — a per-area decode rather than a
mis-scaled per-hand one, which ties it to the open T-CY question of who the pooled line pays. The
app follows the owner's rule and surfaces those days as *booked but not the predicted amount*
rather than smoothing them away. `extraHoursPerHead` is in Settings because the question is not closed.

- **Barrel and Barrel pickling are one unit for the arithmetic.** The relay writes them as one row
  about as often as two, and every recorded decode reconciles them against a combined norm of five.
  Split, a day with both hands on the barrel side predicts 8 hours against the 24 the shop booked
  and reports a surplus on a day that balances exactly. Where both are staffed the two readings
  agree, so the pairing only ever bites where it must.
- **A norm binds a unit that ran, and a unit nobody stood on but hours were booked to *ran*.** A
  line with no heads and no booking is idle, not short of its whole complement — otherwise a day
  running one area of five predicts more coverage than the plant could absorb. But a zero-head
  pickling row carrying `EXTRA 24 HOURS` against a norm of three is 8 × 3 exactly: the shop treated
  it as fully short and fully covered. Judging that idle would drop it from the expected side while
  keeping it on the booked side, and the card would cry surplus on a day that reconciles to the
  hour. **Numerator and denominator, same population** — the rule this repo already lives by.
  Genuinely idle unit-days are excluded and the exclusion is **reported**.
- **The gap is read in both directions, and they mean different things.** More booked than the
  shortfall explains is the case the rule forbids. Less is not an error at all: the rule binds
  an area at full tilt, and nothing here measures per-area output, so the expected figure is an
  **upper bound** rather than a target.
- **Three disagreements are kept apart** — booked at or above complement, booked where nobody
  was marked, and booked but not the predicted amount — with the area and the date on each.
  They are flags on the *paperwork*: hours booked to the wrong area, an assignment nobody typed,
  and hours never worked all look identical from here. When every booking answers a real
  shortfall the card says the check **passed**, because a test that only speaks up on failure
  teaches the reader to stop trusting its silence.

**`EXTRA n HOURS` is ONE instrument, and the owner settled it 28 Aug 2026.** An OT block books the
extra exactly as a general shift does — against the shortfall in the area that ran. What differs is
only the **multiplier**: a general shift credits a missing hand a full 8, a block credits it the
block's own length. So a 5-to-midnight slot short two hands books 14.

This **supersedes** the earlier reading, which took a block tag as the slot's per-hand credit
("5 hands × 3 hr = 15 OT hr") and therefore reconciled it against nothing.

**The census, with its instrument, because the earlier version of this table claimed more than it
had.** Castor swept every relay row under a `Morning OT` / `6:00 AM` / `Evening OT` / midnight-or-8PM
heading carrying an `EXTRA` tag, across `attendance/2026-W24.md`, `W31`, `W32`, `W33`, plus their
untagged sibling rows: **13 blocks, 18 tagged rows.** Vulcanus swept the raw relay export
(`data/raw/relays/2026-08-14-...txt`, 27 Jul – 8 Aug) for rows carrying times, per-area headers,
named crews and a tag together: **9 blocks, 14 rows.** W18–W23 and W25–W30 were not swept by either;
"not found there" is not "does not exist".

| Row | Block | Areas · heads | Norm | Short | Predicted | Tag |
|---|---|---|---|---|---|---|
| W24 Wed | 6:00–8:30, span 2.5, **credited 3** | **A2** · 5 | 4+2 = 6 | 1 | 3 | `EXTRA — 3 hours` |
| W31 Tue g1 | 5PM–12AM = 7 h | `A1 & pickling` · 3 | 4 + fold 2 = 6 | 3 | 21 | `Extra 21 hours` |
| W31 Tue g2 | 7 h | `barrel & pickling` · 2 | 3+2 = 5 | 3 | 21 | `Extra 21 hours` |
| **Tue 4 Aug** | 7 h | A1 · 4 | 4+2 = 6 | 2 | 14 | `EXTRA 14 HOURS` |
| W32 Wed-5 eve | 7 h | A1 · 4, A2 · 3 | 4+4+3 = 11 | 4 | 28 | `EXTRA 28 HOURS` |
| W32 Thu-6 eve | 7 h | A1·3 / A2·3 / pickling·0 | 4 / 4 / 3 | 1/1/3 | 7 / 7 / 21 | `7` / `7` / `21` |

Three corrections the Governors made to this table, each of which had been hiding something:
**W24 Wed heads VAT A2, not A1** (`2026-W24.md:50`; the norm is unaffected, the label was wrong on
the row the whole ruling is anchored on). **"W32 Fri" is Tue 4 August** — Fri 7 Aug carries no tag at
all. And **6:00–8:30 is 2.5 hours, not 3**: writing the credit into the span column is what concealed
the multiplier blocker below.

**The morning block is credited 3 hours on a 2.5-hour span** (owner, 28 Aug 2026). The convention is
stated at `2026-W24.md:61` in those words, and seven recorded morning tags reconcile at 3 while none
reconciles at 2.5. Deriving the multiplier from the clock alone flagged **every faithfully-entered
morning block** — the shop's most frequent — as *booked more than the shortfall explains*. So the
credited length rounds the span up to the whole hour; the only convention the corpus states is
2.5 → 3, and rounding up is this app's inference from that one instance, a no-op on every other
recorded block. **Two instruments, two lengths:** a named hand's own pay uses the clock (BM, 8 Aug —
Sambhu's 6:00–8:30 + 5 PM–12 AM = 9.5 hr), the unattributed EXTRA credit uses the convention. The
entry row shows both whenever they differ.

**Two recorded blocks the rule does not reproduce, named rather than smoothed away** — the same
courtesy the general-shift side already gets. **W31 Mon 27 Jul, 5–8 PM**: two rows, `VAT A2` 2 hands
and `VAT A1` 3 hands, each tagged `Extra 3 hours`; predicted 10.5 and 7.5 with the fold, 6 and 3
without, and **no fold value reconciles both**. And **W33 Tue 11 Aug, 5–8 PM**: A1 3 hands tagged 9,
A2 2 hands tagged 12 — which reconcile only at a per-row fold of 2 each, i.e. four pickling hands
across the block, contradicting the ceiling. They are the sole recorded cases that test it.

**It resolves a row the codex had written off.** `soma-internal/attendance/2026-W31.md:150` calls the
Tue-28 evening tag *"internally inconsistent (group 1: 3×7=21 ✓; group 2: 2×7=14≠21)"* and treats
that asymmetry as evidence the tags are not a pay instrument. Group 2 is barrel+pickling, a unit of
five, two hands present: short three, 3 × 7 = 21, exactly as tagged. The inconsistency was in the
reading, not in Shyam's tags.

**It also contradicts a booked payout, which is soma-internal's to settle, not this app's.**
`attendance/2026-W24.md:61` prices that 6 AM slot at 15 OT hr / ₹751.50 on the per-hand reading.
Under the shortfall rule the tag is 3 hours of unattributed extra, and the five named hands' own
overtime is a separate figure carried on their in/out times. Flagged, not acted on.

**The pickling fold, and its ceiling.** A VAT line running in a block pulls VAT-side pickling hands
with it, and the shop writes that as a **co-tag on the VAT row** — `----VAT A1 & pickling`. That is
not pickling staffed separately; it is the VAT row saying which hands it covers, so the row **folds**
rather than carrying pickling's own complement of three. Read the other way the flagship recorded row
predicts 28 against a tag of 21 and the shop's own shorthand becomes unenterable — and barrel is
already read this way, so VAT must match it. Pickling carries its own norm only on a row naming it
with **no VAT line**; when such a row exists, nothing folds anywhere in that block.

The ceiling is the ruling's: **one VAT line needs 2 of the 3, both need all 3 — never 4** (owner,
28 Aug 2026). The fold is computed for the **block**, capped at the three hands that exist, and
shared across the VAT-covering rows in proportion to the lines each covers. Shares divide by the sum
of every row's lines rather than the block's distinct count, so overlapping rows cannot fold past the
ceiling either. With no pickling complement set, nothing folds — there are no hands to lend, and
inventing them would inflate every shortfall.

**The gap is judged per block, not per row.** When the relay splits one block over two rows the hours
it writes on each need not match that row's share of an apportioned fold: 14/14 against a 1.5/2.5
shortfall reconciles to 28 exactly. Judging rows flagged two disagreements on a block that balances to
the hour — numerator and denominator, same population, again.

Per-row folding would make the answer depend on how the relay happened to write the sheet: one row
over A1+A2 folds 3, two rows of one line each would fold 2+2, and the same day would reconcile to 11
or to 12 on nothing but the tagging. **The block total is invariant**, which is the property that
matters; a fractional norm is the visible signature of a block the relay split where pickling did
not. Barrel needs no fold — barrel and barrel pickling are already one unit of five.

**The fold is an upper bound, like every other figure on this card.** It assumes the lines it covers
ran at full tilt; a block running at less than that needs fewer pickling hands and books less.
Nothing here measures per-area output, so that reduction cannot be derived — which is exactly why
booking under the prediction is never reported as an error.

**A block needs three things the marks cannot supply, and without any of them it is reported rather
than reconciled at a guess.** Its **length** comes from its own in/out times (21 is three hands short
of a 7-hour block and also seven short of a 3-hour one, so deriving the length from the tag would
make the check vacuous by construction); its **complement** from the areas it covers; and its **head
count** from its **named crew** — the marks record where a worker stood on the *general* shift, and
the blocks routinely move people (W31 Wed: a hand on barrel pickling all day is in the VAT A1
evening block), so reading the marks would put the head in the wrong area and invent a shortfall.
Unreconcilable hours are still counted in the bill: unverifiable is not unpaid.

Block absorption is **exact rather than inferred**, because the row names the crew who stood the
slot.

**Coverage is absorbed pro-rata, and that makes it attributable.** The 11 Jun ruling says the short
area's present crew absorb it between them, which the app ranks per worker. It is an **availability
measure, not a wage**: payment is pooled — one line on the slip, paid out on the floor — so nothing
here is added to anyone's pay and the labour card still counts the extra exactly once, unattributed.
Attributable for measurement, pooled for payment; the two are different questions and conflating
them is what the earlier version of this module got wrong.

**Two things about that are still open, and the app says so rather than implying otherwise.**
The pro-rata reading has a recorded breaking point — 24 coverage hours against two present hands is
twelve each on top of a full shift, which nobody stood, and the likelier reading there is
brought-in casual labour on a different ledger line; rows past that ceiling are marked as a question
rather than ranked as a measurement. And **T-CY is open**: the payee behind the pooled line has
never been identified, with ₹13,109 disbursed across W28–W30 against it. "Payment is pooled" is the
ruling; who receives it is not settled.

### Client performance
Clients tab → **Performance**. One account at a time: month on month as revenue, tonnage or ₹/kg,
and every part it handles sorted into **stopped / new / steady / one-off**.

Stopped is the reason the view exists. A part that disappears raises no error, empties no queue and
never appears as a loss — it appears as a slightly smaller month, twice, and then it is normal.

**Cadence is measured against each part's own rhythm, not a fixed cut-off.** A part is overdue when
the gap since its last appearance exceeds `max(typicalGap × 1.75, typicalGap + 21 days)`, where
`typicalGap` is the median of its own intervals. A fixed "absent two months" rule would call every
quarterly part dead; the 21-day floor stops a part shipping twice a week being flagged after nine.

**Both spines feed it.** Invoices are the complete record, but material arrives before it is billed,
so a part received last week and not yet invoiced would read as overdue on the billing record alone.
The union answers "when did we last handle this part" — and a part that only ever arrived shows
*challan only* rather than ₹0.00, which would read as worthless work rather than unbilled work.

**A rename is flagged, not reported as lost business.** Part numbers vary in spelling between
documents (`Clamp 165x83` against `CLAMP 165X83(40X6)`), which would surface one stopped part and
one new one. Stopped/new pairs sharing a six-character stem are marked as possibly the same part —
reporting a rename as lost work would discredit every other row on the card.

### What the charts show
The trend was one line drawn with `preserveAspectRatio="none"` — a 400×160 drawing smeared across
whatever width it got, markers rendered as ellipses, and only the two endpoints labelled. `charts.js`
draws at natural aspect and is sized by CSS, so one code path serves a 393px phone and a 1280px
desktop, and every datum carries a `<title>` with its exact figure.

**Three series, because they answer different questions.** Revenue answers "did we bill more";
tonnage answers "did we plate more"; **incoming material leads both** — it is dated by challan, not
by invoice, so a dip there surfaces in revenue only weeks later. Line or bar for any of them.

**Composition gets a share shape** as well as a ranked one. Past the eighth client the tail folds
into one named wedge rather than slivers nobody can aim at — the fold is labelled so the tail is
visibly a tail.

**Top Items ranks by value, tonnage or ₹/kg, and those are three different top-tens.** Ranking by
money alone is the ranking this repo's own thesis calls insufficient: the parts filling the plant
are not the parts paying for it. The weight rankings admit only parts whose weight is known and
**say how many they dropped** — those are the piece-billed end, so a ranking that hides them reads
better than the truth.

On the ₹/kg view the bar is measured against full cost with a mark at the cost line, because from a
zero baseline a 5.40–14.50 range is a row of near-identical bars. Green clears cost, red does not:
the app's accent is itself a terracotta, so accent-against-danger was a distinction nobody could see.

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

**A missing part is created from the line being typed.** The autocomplete's last row offers to add
what was typed, prefilled, and drops the new part straight back into the line — the round trip to
the Items tab lost the in-progress form, which is why parts went unregistered. It is offered even
when there are matches, because a new gauge of an existing clamp matches the part number and is
still a different part.

That row is present on almost every list, which is what made the keyboard contract the thing to
protect: one real suggestion plus the add row is two options, and `acPendingOption()` would have
stopped committing a lone match on Enter. It filters the add row out of that shortcut. An unaimed
Enter therefore still means "on to the quantity" — creating a part takes a click or an arrow.

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

### Labour and attendance
The Staff tab. Labour is ₹3.55/kg of an ₹8.55 cost and 42% of it — the largest line in the
business — and until this it was one number typed into Settings and checked against nothing.
Two questions had sat open across three handoffs: **how staff is allocated**, and **what "the
extra" stands for**. They are the same question wearing different clothes — which of this bill
is fixed and which of it scales with tonnage — and nothing could answer it because nothing
measured it.

**Three views over one store.** Day is for entry (present / half / absent, area, and hours).
Week is a Mon–Sat grid whose cells cycle, for fixing what the day view got wrong, with the
`15/20` headcount row the daily relay already speaks in. Roster is the master: comp class,
rates, home area, and whether the worker is on the plant floor.

**Three comp classes, because the shop pays three ways** — and the first cut of this module got
two of them wrong by shipping a single `contract` class.

| | Paid | Rest days | Overtime |
|---|---|---|---|
| `monthly` | ₹/day × days worked | the range's rest days × the attendance gate | day rate ÷ 8 × 1.1 |
| `hourly` | every hour at one flat rate | — | none: the fourteenth hour is paid like the first |
| `daily` | ₹/day × days worked | one day per full week | hour rate × the multiplier |

The salaried tier is `monthly` and **is not a flat salary**: the payout slips are written in
₹/day, and a flat monthly divided by calendar days neither matches them nor moves when somebody
is absent. The weekly pool is `hourly` and has **no day concept at all** — charging it a day
rate and then paying overtime at ×1.1 invents a boundary the slip does not have and overpays
the overtime by a tenth. `daily` is the generic middle; no SEP tier is on it, and it is what
the retired `contract` class was.

**The gate is the one place a monthly worker's pay moves with their own attendance.** Rest days
are paid, scaled three ways: at or above 90% attendance all of them, at or above 80% half, below
that none. Exact over a calendar month, which is the period it was written for; over a shorter range
it judges each rest day on that range alone, and the card says so.

**The model reproduces a real payout slip.** One W32 week's hourly pool foots to ₹27,549 across
ten hands and 580 hours at ₹47.50; the spec feeds the same hours through and lands on
₹27,550.00, the rupee being the slip's own three half-rupee roundings taken down. A model that
cannot reproduce a document somebody was paid against is not one to price a decision with.

**The roster ships empty, and it has its own door.** Names and wages are payroll data, this repo
is public, and its built page is served to anyone — so making the repo private would not hide a
seeded roster either. Structure (the eight areas, the comp classes, the wage arithmetic) is
code; the people arrive through **Staff → Roster → Import**, which **merges by name** and touches
nothing else on `S`. Settings → Import cannot serve: it replaces the whole state, so a roster
file through that door takes every invoice with it. Merging on the *name* rather than the id is
what keeps a worker's existing attendance marks attached, because two devices that typed the
same person gave them different ids.

That is a deliberate departure from `SEED_CLIENTS`, which does carry real names: a client name
is on every invoice that leaves the building, a worker's day rate is not.

**Four states, not three.** Unmarked is not absent. A row nobody has reached costs nothing; an
absence costs a day's wage and has to be said. The same distinction one level up is what the
coverage figure is for: a day with no attendance key is a day nobody typed, which is not a day
nobody worked.

**What "the extra" is.** Shyam's daily sheet books hours two ways. Named men carry their own
out-time — that is OT, per worker, at their hour rate × 1.1. But every day also carries lines
like `EXTRA 16 HOURS` written against an **area block**, with nobody attached. They are real
paid contract-tier hours and the payout sheet settles them. So they are recorded as exactly
that: hours booked to an area, unattributed, counted in the bill and reported separately. They
are **never spread across the men present** — a per-worker cost invented that way reads precise,
and it would answer the fixed-versus-variable question by accident, in whichever direction the
blend happened to fall.

**Fixed and variable are kept apart everywhere.** Fixed is the monthly tier — its days and its
gated rest days together. It moves with that crew's attendance but not with tonnage, which is
the distinction the split exists to draw. Variable is the hourly pool, the daily tier, OT and
extra. That split is not decoration: the SSS Mehta decision turns on it — at fixed labour
that account still contributes ₹0.53/kg, at volume-scaling labour it loses ₹1.64/kg — and one
blended labour number silently picks a side.

Every constant — multiplier, both gate thresholds, the daily tier's weekly rest credit, the
extra-hour rate, and the modelled ₹/kg the measurement is reported against — lives in Settings.

**Variable labour is broken down by area** — contract days, rest credit, OT and the extra,
placed by the area each was worked in, ranked by cost rather than by days because an area that
pulls the overtime is the expensive one. That is the *allocation* half of the open question.
The monthly tier's day pay and rest days are deliberately absent: that crew is the standing one
and its cost does not follow the area it happened to stand in. Its **overtime is** in there —
an overtime hour was worked somewhere specific and was paid for being worked.

**An incomplete range reads low, never neutral** — every tier is paid for days and hours actually
recorded, and the monthly tier reads low *twice*, because a day nobody typed also depresses the
attendance its rest-day gate is judged on — so the card states coverage in place, every time, complete or
not, and withholds ₹/kg below 90% of working days. It withholds under a fortnight too, but for
a different reason: not enough of either side to divide. The lag between plating and billing
cannot be gated away at any length, only stated, so a range under two months carries that
caveat next to the figure. And a ₹/kg computed over partial tonnage coverage reads **high**
here — the opposite direction from realisation, because tonnage is the denominator — which the
card says rather than leaving the reader to work out.

**Deletion is refused while attendance names the worker.** Removing the row would not remove
the marks, it would orphan them: every past week's labour would quietly drop that wage and no
figure would say why. Clearing Active keeps the history and takes them out of today's
denominator, which is what "left" means here.

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

**A state that arrives is as old as one read off disk.** Three paths replace `S` wholesale —
the loader, a GitHub pull, and Settings → Import — and only the loader ran the migrations. So a
copy pulled from a device that had never run the area realignment kept its retired `pickling` and
`colour` ids, which `areaStats` drops on the floor (`if (!a) return;`): heads under-counted, every
shortfall inflated to match, and nothing on the card said so until some later reload happened to
fix it. All three paths now run the same two passes — `ensureStateShape()` then `migrateState()`.

**What re-runs and what does not is the load-bearing half.** A structural migration re-points or
repairs records the state already holds, so running it against someone else's backup is as correct
as running it against your own, and running it twice is a no-op. A **seed** writes new business
records and a **cleanup** deletes them, and the flags on an incoming backup describe the device
that *wrote* it, not the records in it — re-firing `_scanSeed1` on a pull would push seven challans
a second time, into the one app here with a module devoted to duplicate receipts. Seeds and the
Belrise rate cleanup stay bootstrap-only, deliberately and in writing.

`ensureStateShape()` is also the one copy of the repair list, read from `getDefaultState()` rather
than restated. There were three copies: the loader's and ghPull's had already drifted by four keys,
and **Settings → Import had none at all** — a backup written before `staff` existed left it
undefined and the Staff tab threw on open. Containers are filled *empty* (the app never invents
business data to repair a shape); config objects are filled from the defaults, key by key, because
`labourCfg()` reads `extraRate || 0` and a missing constant would silently price the extra at
nothing rather than leave a visible gap.

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
