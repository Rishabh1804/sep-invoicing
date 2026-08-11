# SEP Invoicing — August 2026 Handoff
**Session:** Master-data entry, CI, costing model, zinc feed
**Date:** 10 August 2026
**Builder:** Solara

---

## What Was Built

Seven PRs, `#11`–`#18` (excluding `#16`, which was a parallel session).

| PR | Change |
|----|--------|
| #11 | Add Client / Add Item entry points |
| #12 | CI: `build-sync` + Playwright e2e |
| #13 | Self-copying `build.sh` + pre-commit hook |
| #14 | Items Master cleanup: redundant rows, gauge field, duplicate id |
| #15 | Bulk weight entry, derive-from-rates, zinc rate |
| #17 | Fix: zinc card had no way to fetch once a key was set |
| #18 | SessionStart hook, Termux doc retirement, LME-derived MCX |

The e2e suite went from **22 tests (two of them silently broken) to 67**, all gating every PR.

### Master data could barely be created
Client Master had **no create path at all** — a client could only arrive via seed data or a
JSON import. Items Master had one, but only as an unlabelled `+` FAB that
`renderClientsPage()` hid in the desktop master-detail layout, so desktop could create
neither. Both now have labelled toolbar buttons in each layout, with guards on required
name, duplicate name, 15-character GSTIN, and duplicate part number.

### The build artefacts could go stale
`sep-invoicing.html` and `index.html` are build outputs of `split/`, and nothing enforced
that. The repo had already paid for it once (`f29b35a`, "reconcile index.html drift").
Three layers now: `build.sh` writes both itself, `.githooks/pre-commit` rebuilds and stages
them, and CI's `build-sync` fails any PR whose committed output has drifted.

### The test suite had been rotting unnoticed
Two golden-flow tests were failing on `main` and had been for months. Neither was a product
bug — both were **time bombs in the fixtures**. `invoice-send` hardcoded `date: '2026-04-10'`
against a Register that filters on the current month, so it could only ever pass during April
2026. `payment-record` seeded `createdAt` two days back against a `mtd` filter, so it failed
on the 1st and 2nd of every month. Fixed with `todayIso()` / `recentTs()`, the latter clamping
to the start of the month.

---

## Data Findings

### The 13 duplicate part numbers were three different problems
Nine rows were genuinely redundant. **Four clamp groups were never duplicates** — the
description held the steel gauge, and the rate tracked it. Investigating them surfaced the
real issue: **166 catalogue rows used `desc` to hold nothing but a strip size**, which is a
specification, not a description. `gauge` is now a field, and item identity for the
duplicate-add guard is part number **plus** gauge.

### A duplicate item id was silently serving the wrong row
The seed shipped **id 4586 on two different rows** (`CLAMP 45X86(BOX)` and
`BOX CLAMP 45X86`). Every lookup resolves by id through `.find()`, so the second row was
unreachable — picking it in autocomplete silently selected the first. Repaired in the seed
and in live data by migration.

### Weights are recoverable from piece pricing
Where a client bills per piece off a rate per kg, `weight = pieceRate ÷ ratePerKg` recovers
the weight exactly. Corroborated before relying on it: clamps carried in two gauges imply the
same developed strip length to within 1.2% across three of four pairs, which only happens if
the rates were built that way.

**These weights measure tonnage, not margin.** A weight defined as `rate/ratePerKg` prices
back at exactly `ratePerKg`, so it cannot rank parts by profitability. What it yields is
throughput — and that is the finding below.

`CLAMP 124X77 (UT)` is the one pair that fails the consistency check: its 32X6 variant is
priced **below** its 30X6 variant despite the wider strip, so one of those two rates is
likely wrong. **Worth checking against the contract — it is a live billing rate.**

---

## The Costing Model

Rebuilt from owner-supplied inputs against Apr–Jul 2026 actuals (~79,850 kg/month).
Full detail in CLAUDE.md; the headline is that **full cost is ₹8.55/kg, not the ₹5.46
recorded there**, against a blended realisation of ₹8.45 — roughly break-even.

Two readings I had to make, both worth confirming: **"1.25 L" chemicals as ₹1.25 lakh**
(litres would be implausible at 80 t/month), and **26 working days** for the daily
consumables.

### The decision that is still open
Labour is 42% of cost, and how it behaves decides the SSSMehta response entirely:

| | Variable cost | SSSMehta at ₹5.40/kg |
|---|---|---|
| Contract crew stays regardless | ₹4.87/kg | **+₹25,766/month** — dropping it makes things worse |
| Contract crew scales with volume | ₹7.04/kg | **−₹80,123/month** — dropping it makes things better |

**The question: does the ₹40k/week contract labour bill fall if SSSMehta's volume goes
away?** Nothing about that account should be acted on before this is answered.

### The lever that is larger either way
Running ~80 t/month against a two-shift capacity of ~104 t — **77% utilised, ~24 t/month
spare**. Filling that at ₹13/kg is worth about **₹1.96 lakh/month**, exceeds the SSSMehta
question under either reading, and requires no difficult conversation with 39% of revenue.

---

## Corrections Made This Session

Recorded because both were stated confidently before being checked:

1. **"Merging the clamps would change what SSSMehta is billed."** Wrong. `S.items` is never
   read by `create.js`, `im-form.js`, `print.js` or `exports.js`; rates resolve through
   `getLineItemRate()` against the client ladder. Merging would have destroyed the
   catalogue's record of which gauge costs what — reference data, not a live billing input.
2. **"LME runs ~16% below MCX."** It is **~10.5%** (392 ÷ 355.11). The mechanism was right,
   the magnitude was not; corrected in code, docs and commit history.

---

## Near-Misses Worth Remembering

- **The SessionStart hook nearly shipped inert.** The first commit added
  `.claude/hooks/session-start.sh` but not `.claude/settings.json`, because `.gitignore`'s
  "business data — never commit" `*.json` rule matched it. The script would have been in the
  repo with nothing registering it. Caught by running `git ls-files .claude/` rather than
  trusting that the commit looked right.
- **A seed transform misfired on the duplicate id.** It looked rows up by id, so the
  collision resolved both occurrences to the same row and rewrote the wrong one. Caught
  because the rewritten row count came out one higher than the rule predicted. Now
  position-based.

---

## Environment

Development moved off Termux to Claude Code, which clones fresh each session.
`.claude/hooks/session-start.sh` now arms `core.hooksPath`, installs the Playwright
dependencies, and reconciles the Chromium build when the sandbox ships one Playwright does
not expect. Nothing to configure by hand.

`AGENTS.md` keeps its Termux guidance for Codex and SproutLab, with SEP Invoicing carved out.

---

## Open With the Owner

1. **Does contract labour scale with volume?** Decides the SSSMehta response. See above.
2. **Set `defaultCostPerKg` to 8.55** in Settings — it is still 7.50, so every margin figure
   in Stats currently flatters by ₹1.05/kg.
3. **`CLAMP 124X77 (UT)`** — the 32X6/30X6 rates are inconsistent; check the contract.
4. **Zinc uplift** — recalibrate `(MCX ÷ LME − 1) × 100` in Settings when a real MCX quote
   is to hand, or type the MCX rate directly, which skips the estimate.
5. **The 24 t/month of spare capacity** — the largest single lever identified this session.

---

## Next Session

**Staff allocation, and what "the extra" stands for.**

Labour is the largest cost line at ₹3.55/kg and 42% of total, and it is currently a single
opaque number: contract at ₹40k/week plus permanent at ₹1.1L/month, with no breakdown by
shift, line, or client. Two things to establish:

- **How staff is allocated** — headcount by shift and process step, which of it is fixed
  versus volume-driven, and whether any of it can be attributed to specific clients. This is
  what would settle the SSSMehta question above rather than leaving it as two scenarios.
- **What "the extra" refers to** in the labour bill. Raised by the owner and not yet defined
  — clarify before modelling it. Possibly overtime, a second-shift premium, or headcount
  beyond the core crew.
