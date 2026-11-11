# CLAUDE.md — SEP Invoicing
**Companion:** Solara (The Strategist). Sharp, numbers-driven, CA precision meets factory floor.
**QA mode:** Cipher (The Codewright): enforces the hard rules, hunts rounding errors and architectural drift.
**Live:** https://rishabh1804.github.io/sep-invoicing/

This file is the core every session loads. It is kept under 16 KB on purpose. **Everything else lives in the atlas,
`docs/atlas/`, and is read when the work needs it.** Nothing new is written here: a new subject is a new atlas topic.

## What this is
Workforce management and invoicing PWA for Soma Electro Products, a zinc electroplating job-work plant in Adityapur,
Jamshedpur. A split-file PWA: about 102 modules in `split/`, concatenated by `split/build.sh` into one HTML page. Every byte
of business data is local to the device (IndexedDB), with an optional GitHub sync copy that goes to the private codex,
never here.

This repo is one of three SEP repos, each worked in its own session, plus a compile session that attaches all three
(`soma-internal/docs/CROSS_REPO_SESSIONS.md`).

## How to find anything: the route
1. **This file**, for the rules that bind every change.
2. **`docs/atlas/INDEX.md`**: the domains and every subject.
3. **The domain's `README.md`**: its topics, one line each, with the modules each owns.
4. **The topic file**: the rulings, the reasons and the measurements, with its modules, specs and tests in its header.
5. **Then** the code (`split/*.js`), the spec (`docs/*.md`) and the tests (`tests/e2e/pNNN-*.spec.ts`) the topic names.

| Domain | Holds |
|---|---|
| [`core`](docs/atlas/core/README.md) | Architecture, build, tests and CI, persistence, offline, settings, the hard rules in full, QA chains, what is built and next |
| [`design`](docs/atlas/design/README.md) | The design system, UI pass 3, the tab map, navigation, interaction rules |
| [`billing`](docs/atlas/billing/README.md) | Invoices, challans, credit notes, certificates, printing, rates, quotations, the masters |
| [`floor`](docs/atlas/floor/README.md) | Production, the plant, stock, power, shifts, entry faces, the planner |
| [`people`](docs/atlas/people/README.md) | Attendance, areas and the extra, pay, pay slips, payroll as paid, cash |
| [`money`](docs/atlas/money/README.md) | Finance, bills, suppliers, bank, cheques, statements |
| [`insight`](docs/atlas/insight/README.md) | Stats, client performance, History, To-do, insights, reports, Home |
| [`platform`](docs/atlas/platform/README.md) | The guard, messages and photos, the knowledge base, office printing |

Shortcuts: `docs/atlas/MODULES.md` (a module → its topic) and `docs/atlas/HEADINGS.md` (a former `CLAUDE.md` heading → where
it lives now; a citation like *CLAUDE.md § Key Business Data* resolves there). Path rules in `.claude/rules/` name the topic
to read when a module is opened.

## The protocol: look up, record the path, iterate
Every agent, builder or reviewer, follows it. The full text is `docs/atlas/README.md`.
- **Look up by the route.** Do not start with a repo-wide search for a subject the atlas covers.
- **A miss is fixed in the same PR.** If you had to search for something the atlas should have routed, add the pointer:
  a `see also` line, a module in a topic's header, a row in an index.
- **A change updates its topic.** A PR that changes behaviour a topic describes edits that topic and its `updated` line.
  A new subject is a new topic with its index row.
- **Budgets force upkeep.** This file ≤ 16 KB; a topic ≤ 28 KB (over it, split and index both halves); a domain README ≤ 6 KB.
  `node tools/atlas-check.mjs` holds these in CI.
- **Sessions.** Start with `docs/NEXT_SESSION.md` (the latest close and its opening prompt). At close, replace its entry
  and move the old one to `docs/sessions/`. A PR that changes a data flow with the other repos adds its row to
  `docs/DATA_FLOWS.md` and says so.

## Hard rules
The full text, the counts and the exceptions: `docs/atlas/core/hard-rules.md`.

| HR | Rule |
|----|------|
| HR-1 | No inline styles. CSS classes and design tokens. |
| HR-2 | No inline `onclick`. `data-action` delegation only. A `<select>` speaks through `change`, never a `data-action`. |
| HR-3 | `inv-` prefix on every CSS class. P76 asserts every class drawn is in the stylesheet or a named hook. |
| HR-4 | No emojis. Icons come from `iconSvg(name)` (state.js), never an SVG drawn in a module. |
| HR-5 | `escHtml()` on all user data written to `innerHTML`. |
| HR-6 | Design tokens only: no raw px, rem, hex or timing (the printed documents' mm/pt token blocks among the listed exceptions). |
| HR-7 | Dark mode by reading tokens (`light-dark()`). There is no `.dark` class. |
| HR-8 | `gstRound()` for all currency: to the paisa, half away from zero. Never `Math.floor` or `Math.round(x*100)/100`. |
| HR-9 | No white. No screen fill lighter than OKLab L 0.97. Paper (printed documents, previews, a QR) is the one exception. |
| HR-10 | **No client's data in this repository.** It is public. No client, part number, rate, challan, P.O., vehicle, quantity or payment, in code, comments, tests or docs. Tests and examples are made up (`9xxx 0000 nnnn`, `QX1`, `JH 05ZZ …`, `DELTA AUTO`). New text says *a client*, never a client's name. |

Also binding everywhere:
- **Every module shares one global scope.** A top-level name in a later module silently replaces an earlier one. Grep
  `split/*.js` before adding one.
- **No browser pop-ups.** Never `confirm()`, `alert()` or `prompt()`: use `uiConfirm`, `uiAlert`, `uiPrompt` (state.js).
- **No `@page` rule may carry a non-zero margin** (`docs/atlas/billing/printing.md` says what it cost).
- **Nothing about the shop is in the build.** People, units, clients and settings are the book's.
- **Warn, never block**, on a figure that may be wrong but can be right (duplicates, rate and weight checks).
- **A record is voided or cancelled with a reason, never deleted**, where an audit would ask what happened.
- **Never read `S` at load time** between state.js and the end of init.js: the load is asynchronous.
- **The guard.** A change to invoices, rates, voids, payments, wages, settings, users or imports goes through `grdGate` /
  `grdOk`. A door is drawn only for a role that opens it (`grdSees`). Rupees are drawn only where the role sees money, and
  wages only where it sees wages. `docs/atlas/platform/guard.md`.
- **A new store on `S`** gets its default in `getDefaultState()`, its row in `CHG_TRACK` (the change log and the merge) and a
  row in `docs/DATA_FLOWS.md`. Seeds and cleanups run at bootstrap only; structural migrations re-run on a pull and an
  import. **Credentials and per-device preferences never go on `S`** (localStorage only). `docs/atlas/core/persistence.md`.
- **No second arithmetic.** A figure is read from the function its own screen uses. Unknown is said, never drawn as zero.
  A ratio's numerator and denominator cover the same records. `docs/atlas/insight/stats.md`.
- **Identity is read from `S.company`**, never frozen into a document template.
- **Any UI you add**: dialogs through `dialogOpen`; a re-render inside a view through `keepScroll`; a selection cleared when
  its filter changes; a new screen gets its line in `navLoc` / `navApply`. `docs/atlas/design/interaction-rules.md` and
  `docs/atlas/design/navigation.md`.

## Build
```bash
bash split/build.sh        # writes sep-invoicing.html, index.html, version.json. Never edit those three by hand.
```
The concat order is in `build.sh`. The pre-commit hook (`.githooks/`, armed by `.claude/hooks/session-start.sh`) rebuilds and
stages the artefacts. The stamp is a hash of `split/`, so docs do not move it. Detail: `docs/atlas/core/build.md`.

## Tests
```bash
pnpm exec playwright test                                                       # the whole suite, both layouts
pnpm exec playwright test tests/e2e/p205-*.spec.ts                              # one spec
node tools/atlas-check.mjs                                                      # the atlas's structure and budgets
```
- CI runs the suite in two halves; the check **Playwright e2e** is green only when both are. Each half allows 45 minutes.
- The session hook sets `PW_CHROMIUM_PATH` where the sandbox's Chromium is not the one Playwright expects; it is unset elsewhere.
- Every fix carries a test that fails on the build before it. A spec is rewritten to the same fact where it moved, never weakened.
- Fixtures seed the legacy key and wait for `body.inv-booted`; they use `todayIso()`, never a literal date; they answer
  an in-app question with `answerAsk`.
- CI's browser draws text about 0.5% wider than the sandbox's: measure near a limit with `letter-spacing: 0.005em`.
- A rare page hang just after load in the sandbox is Chromium's, not the app's: run that one test again.
- Never raise a P195 budget to get green.
Detail: `docs/atlas/core/tests.md`.

## Working rules
- Develop on the session's branch; open a draft PR; **merge only on the owner's word**.
- One PR a step. Run the QA chain before a final merge where the owner asks for it; each finding gets its test.
- A UI change follows `docs/SEP_INVOICING_DESIGN_PRINCIPLES.md` (DR-1 to DR-9) and amends it in the same PR if it needs
  something the document does not define.
- What is built and what is planned, programme by programme: `docs/atlas/core/roadmap.md`.
- Other agent-facing files, read on need, never loaded by default: `AGENTS.md`, `Memory.md`, `PERSONA_REGISTRY.md`,
  `docs/ARCHITECTURE.md`.
