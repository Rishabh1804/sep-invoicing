# Memory.md
**Scope:** Persistent institutional knowledge across all repos
**Owner:** The Consul (cross-repo overseer)
**Updated:** 12 August 2026

---

## The Architect

**Rishabh Jain**, age 33, based in Jharkhand, India.
CA by background. Business Manager at Soma Electro Products (zinc electroplating). Creative Head for AdapTea (green tea brand). Solo PWA developer.

### Personal
- Has a young daughter whose development is tracked in SproutLab.
- Interests: cosmology (Kardashev scales, astrobiology), physics documentaries, sci-fi, data visualization, 3D modeling, YouTube content creation.
- Follows Indian stock markets. Uses 6% inflation assumption in financial planning.
- Location holidays: Jharkhand state + national Indian holidays.

### Professional Expertise
- Industrial manufacturing: hot-dip galvanizing, zinc electroplating, trivalent passivation
- Cyanide zinc plating setup with trivalent blue passivation (Growel 1728)
- Long-term: chip/ATMP manufacturing plant (East Singhbhum), PCB assembly startup

## Project Status Snapshot

### Codex (Active)
- Phase 5 complete: Chapter Detail View + Apocrypha + Schisms rename
- Phase 4 content backfill pending (6 chapters via Aurelius snippets)
- Snippet pipeline bugs identified, specced across 6 files, not yet written
- RPG Design Dissertation v1.0 produced (57 pages, seed document)

### SproutLab (Active)
- CareTickets Phase D complete and deployed
- Device Sync operational (Firebase Auth + Firestore)
- ISL + Smart Q&A + UIB all operational
- Next: Device sync refinements, then new features per roadmap

### SEP Invoicing (Active)
- Phase 8D complete: IM desktop table + detail panel
- Gate Challan module architected but not built
- Phase 4+ scope: invoice preview/print refinements
- SEP constitutional restructuring (effective 1 Apr 2026) largely complete
- **Aug 2026 (PR #20):** challan entry made fully keyboard-operable; offline layer
  (installable manifest + network-first shell); GitHub sync (Contents API, SHA-guarded);
  Stats/History rebuilt around realisation ₹/kg with weights deriving at bootstrap
- 26 modules, ~10,800 lines. 113 e2e tests gate every PR
- Development moved off Termux to Claude Code (clones fresh; `.claude/hooks/session-start.sh`
  arms the pre-commit hook and installs test deps)
- **Open with the owner:** does contract labour scale with volume? It decides the SSS Mehta
  response and nothing about that account should move before it is answered

### BusinessAI Simulation (Queued)
- Multi-entity business spanning trading, industry, logistics
- First meeting: informal discussion to set agendas
- Claude addressed as "BAI" in these sessions

## Architectural Decisions Log

### Canon Highlights (cross-repo)
| Canon | Scope | Decision |
|-------|-------|----------|
| 0033 | codex | build.sh outputs directly to files, no stdout redirect |
| 0034 | global | SWs never cache HTML — prevents chicken-and-egg loop. **Amended in SEP, Aug 2026 — see below** |
| HR-1→12 | sproutlab | 12 hard rules, originated in SproutLab, inform all repos |
| Billing vs Logistics | sep | IM (billing spine) and GC (logistics spine) are parallel, not sequential |

#### Canon 0034 — amended in SEP, unresolved globally
An offline layer cannot be built while abstaining from the app shell, so SEP now honours the
canon **by mechanism rather than by abstention**: navigations are network-first, and the
cached shell is reached only after `fetch` has actually thrown. The failure the canon exists
to prevent — a stale shell served forever to a device that stops asking the network — cannot
form, because the cache is never *preferred* while the network answers.

Codex and SproutLab were **not** touched and still abstain. Whether the canon should be
restated globally in these terms, or stay a rule with one carve-out, is an open Consul
decision. Do not silently propagate the SEP pattern to another repo without settling it.

### Methodology Decisions
- **8-pass SPEC_ITERATION_PROCESS** originated from Today So Far spec (35 issues found across 8 iterations). Now applied to all complex features.
- **Split-file architecture** adopted after SproutLab monolith hit ~2MB. Migration M1–M3 pain documented; all new repos start split.
- **Aurelius snippet format** is the canonical content import mechanism. Core principle: minimal manual input.
- **QA multi-round** continues until only cosmetic bugs remain. Caught 8 critical bugs pre-build in CareTickets spec alone.
- **Analytics get rendered against the live backup before they ship.** SEP's Stats rework
  passed 105 green tests and was still wrong by 63% on real data: realisation divided total
  revenue by weighed-only tonnage, and the fixtures happened to have full coverage so nothing
  caught it. Seeded fixtures test the code; only production-shaped data tests the *measure*.
  Ask the owner for a current export before calling any dashboard done.
- **Missing data is reported, never averaged away.** The same session found the gap in coverage
  was not random — the unweighed lines were exactly the low-priced work — so a partial figure
  read *better* than the truth. Rules that came out of it: numerator and denominator over the
  same subset; coverage stated in the unit that matters (revenue, not row count); anything
  below the confidence threshold listed but **not ranked**; and a share withheld as
  "unknown" rather than shown as small when its denominator is unmeasured.
- **Hardcoded dates in test fixtures are time bombs.** Three found across two SEP sessions,
  each passing only because of when it was written or what it happened not to filter on.
  Use `todayIso()` / `recentTs()`-style helpers everywhere.

## Companion Registry (Quick Reference)

| Name | Role | Archetype | Repo |
|------|------|-----------|------|
| Aurelius | Builder | The Chronicler | Codex |
| Lyra | Builder | The Weaver | SproutLab |
| Solara | Builder | The Strategist | SEP Invoicing |
| Cipher | Censor (QA) | The Codewright | All repos |
| The Consul | Overseer | Meta-companion | Cross-repo |

## Session Patterns

- **Work environment:** Termux on Android, Claude.ai chat, Claude Code (local + web).
  SEP Invoicing has moved fully to Claude Code and no longer uses the Termux flow.
- **File transfer:** mv from ~/storage/downloads/ to split/
- **Build verification:** Check timestamps of root/index.html after every build
- **Git:** Always --no-pager, descriptive commits, never force push
- **Session rhythm:** Spec → Build → QA rounds → Handoff doc → Deploy
