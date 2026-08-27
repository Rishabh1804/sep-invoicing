# Memory.md
**Scope:** Persistent institutional knowledge across all repos
**Owner:** The Consul (cross-repo overseer)
**Updated:** 18 August 2026

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
- **14 Aug 2026 (PR #22):** Test Certificate (ZN Plating) generates from the register —
  one A4 page per part per dispatch, single or bulk, into the existing print view. Closes
  the prototype in `docs/test-certificates/`, whose generator could not see the register,
  so nothing it printed was tied to a document the customer held
- **17 Aug 2026 (PR #24):** the owner's eight-item list — register select-all, date-range
  exports and serial-order CSVs; credit notes (SSS Mehta's standing 2% batch discount, own
  CN series, CDNR export); inline item creation during entry; a rewritten chart layer with
  revenue/tonnage/incoming-material trends; Top Items rankable by value, tonnage or ₹/kg;
  and a Client Performance view that names materials which have quietly stopped arriving
- **17 Aug 2026 (PR #25):** bug sweep, eight findings — `docs/BUGFIX_REPORT_2026-08-17.md`.
  Three were self-inflicted by PR #24 the same day, including register filter dropdowns that
  closed the instant they were opened, and a credit note series that restarted at 001 over
  CN/001–005 already issued by hand
- **27 Aug 2026:** Staff tab — roster master, day/week attendance, and the labour breakdown.
  Turns ₹3.55/kg from a typed assumption into a measurement split fixed against variable, and
  answers "what is the extra" in the model: hours booked to an **area block** with no name
  against them, counted in the bill and never spread across the men present
- **27 Aug 2026 (second session):** the comp model rebuilt against the payout slips. Three
  tiers, not two — the salaried tier is ₹/day with a three-layer attendance gate on its rest
  days, and the weekly pool is a flat ₹/hr with no day rate and no multiplier. One spec
  reproduces a real weekly slip to the rupee. Roster arrives through its own merge-by-name
  import, never seeded into this public repo
- **27 Aug 2026 (Areas):** the floor by work area — staffing against an owner-set complement,
  and a cross-check on the extra hours. On the two latest slips the extra is 27–28% of paid
  contract hours (₹18,382.50 across a fortnight) with nobody named against it
- 33 modules, ~15,500 lines. 220 e2e tests gate every PR
- Development moved off Termux to Claude Code (clones fresh; `.claude/hooks/session-start.sh`
  arms the pre-commit hook and installs test deps)
- **Open with the owner:**
  - does contract labour scale with volume? It decides the SSS Mehta response and nothing
    about that account should move before it is answered
  - do the four certificates rendered 15 Apr 2026 need reissuing to SSS Mehta? They carry
    the superseded GSTIN (below). Left in place as the record of what was sent
  - piece-billed lines print Net Wt. blank. Filling them means weighing the parts into
    `partWeights`, not promoting the rate-derived `stdWeightKg`

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
| Derived vs issued numbers | sep | A number that *is* a pointer needs no ledger; a number that is *issued* does |

#### Derived vs issued numbers (Aug 2026)
SEP built a whole apparatus for invoice numbers — tombstones, required reasons, a
reserved/recycled rule, a gap audit — because an issued number outlives its record and a hole
in the series has to be explainable. The quality certificate looked like the same problem and
is not: its reference is `QC/<invoice display number>/<line no>`, **derived** from the thing it
certifies. It regenerates identically, cannot gap, cannot be voided, and needs nothing written
to state when one prints.

The test to apply before building a numbering system: **is the number a fact, or a pointer?**
A pointer is reconstructible from what it points at, so the ledger is redundant. Only a number
that was independently issued — that exists because someone allocated it — needs the apparatus.

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
- **For anything whose purpose is to be seen, assert that it is visible — not that it exists.**
  SEP's certificate run reported its exclusions ("skipped 1 cancelled") through `showToast`,
  and the toast sits at `z-index: 300` under a print view at `500`. It was never visible to
  anyone. The e2e spec passed regardless, because `toContainText` reads the DOM, not the
  pixels — the assertion confirmed the message had been *composed*, which was never in doubt.
  Use `toBeVisible()`, and be suspicious of any green test on a reporting path. The fix was
  also the better design: an exclusion belongs in place and persistent, not in a notification
  that expires in three seconds — the same rule the Stats coverage cards already follow.
- **A generated document reads identity from one source; it never carries its own copy.**
  SEP's certificate prototype froze company name, address and GSTIN into its template, and by
  the time the app absorbed it the copy had drifted: GSTIN `20AAFFS4718J2ZD` against the
  `20AAPFS4718J2Z0` every invoice files under. Two documents from one business disagreed about
  who issued them, and nothing could detect it because neither read the other. Certificates now
  read `S.company`. Corollary for **externally approved artefacts**: verbatim preservation is
  bound to what the approval covers. SEP keeps the TML-approved format's typos (`Cynide`,
  `Peef off`) because QA-TML approval binds that text — but a GSTIN is a fact about the
  taxpayer, not format text, and a wrong one is simply wrong. Know which you are looking at
  before deciding whether it may be corrected.
- **A print preview should carry one set of measurements, not two.** SEP's certificate uses the
  A4 mm/pt figures on screen as well and pans sideways on a narrow phone, so the preview *is*
  the page that prints. The reflowing alternative looked tidier at 393px and broke table
  headings into `Ob ser vati on` — but the real cost was two sets of sizes free to drift apart,
  where the screen stops predicting the output.
- **A bug is not reported until it has been reproduced.** A code path is a hypothesis; the
  failing spec is the evidence. In SEP's Aug 2026 sweep a finding was called serious and
  reachable on the strength of reading one function — `createInvoiceFromIM()` assigns
  `clientId` inside its collect loop, so a mixed selection takes the last challan's client.
  The selection bar already rendered that button `disabled` for exactly that case. The test
  written twenty minutes later found out, by failing to click a disabled button.

  The reasoning error was directional: the trace ran **backward** from the bad line ("can the
  data reach this state?") and never **forward** from the entry point ("what invokes this, and
  is it invokable in that state?"). One grep for the call site was the whole check, and it was
  run after reporting instead of before. So: a finding names its call sites and their guards,
  and the red test comes before the claim. If the spec cannot be made to fail, there is no bug
  to report yet.

  Weigh the prior by house style. In a codebase that layers its defences — SEP guards with a
  `disabled` attribute, a `multiClient` precheck, warn-not-block on duplicates, `reserved` on
  deletion — an unguarded function is *weak* evidence, because the guard is usually one layer up.
- **Three labels, not one severity scale.** *Defect*: reproduced, a spec fails without the fix.
  *Latent*: the path exists but something else guards it, and it would bite if that guard moved.
  *Hardening*: the invariant is real but lives in the wrong layer. Being made to choose at
  report time is what surfaces missing evidence, because "defect" is a claim that has to be
  backed. Carry it into the write-up: **every finding names the spec that pins it**, and a row
  that cannot name one is a row not yet verified. In SEP's bug report the single finding without
  a spec name is the single finding that was overstated — the format made it visible.

  The cost is real and worth paying: this discipline makes a review slower and quieter, not
  better at finding bugs. It buys credibility instead. Seven sound findings lose their weight
  if the eighth is overstated.

- **A summary of a rule is not the rule. Read the instrument it was summarised from.** SEP's
  labour model was built from the ratified sentence `(days worked + rest credit) × ₹/day + OT ×
  1.1`, quoted accurately in the codex. That sentence governs one of three pay mechanics. The
  weekly pool is paid a flat rate for every hour with no day boundary and no multiplier; the
  salaried tier is ₹/day, not the flat monthly the first model assumed. Both were visible in the
  payout slips and in neither summary. The rule was true; taking it as complete was the error.
- **A model is not right until it reproduces a document somebody was paid against.** The fix
  came with a spec that feeds one real week's hours through and lands on the slip's own total to
  the rupee — the remaining rupee being that slip's roundings. It is the same discipline as "a
  bug is not reported until it has been reproduced", pointed forwards: the failing spec proves a
  defect, the reconciling spec proves a model. The earlier model would not have come close, and
  nothing in the code would have said so.
- **Publishing is a property of the artefact, not the repository.** SEP Invoicing builds to a
  single HTML file served by GitHub Pages, so everything seeded into the bundle — the client
  rate card, and any roster put there — is world-readable whatever the repo's visibility, and
  Pages sites stay public even from a private repo. Making a repo private hides the docs and the
  history; it does not hide what the build serves. Ask what the artefact publishes before asking
  what the repository does.

- **A test that only speaks when it fails teaches people to distrust its silence.** SEP's
  extra-hours cross-check reports *"every hour was booked to an area that had somebody marked in
  it — the check passes"* on a clean range, not just the flags on a dirty one. Otherwise a quiet
  card is indistinguishable from a card that never ran.
- **Name the difference between a diagnostic and an allocation, in the copy, or the diagnostic
  becomes the allocation.** The same module that refuses to spread unattributed hours across the
  workers present computes exactly that ratio as a plausibility test. The only thing keeping the
  two apart is a sentence saying which is which — so the sentence is load-bearing, not decoration.
- **An anomaly in the record is not an anomaly in the world.** Hours booked to the wrong area, an
  assignment nobody typed, and hours never worked are indistinguishable from inside the data. Say
  which contradiction was found and refuse to say what caused it; the value is knowing where to
  look and on which day.

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
