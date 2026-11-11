---
subject: "Tests, CI and the sandbox; fixtures"
domain: core
modules: []
specs: []
tests: [P21, P73]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Tests

```bash
pnpm exec playwright test          # 2,329 tests, both layouts (6 Nov 2026)
```

Some sandboxes ship a Chromium build Playwright does not expect and block downloading
the matching one. The session hook detects that and sets `PW_CHROMIUM_PATH`, which
`playwright.config.ts` reads; unset everywhere else.

**CI runs the suite in two halves, each on its own runner** (owner, 29 Oct 2026: *"Let's split the tests into 2 jobs"*): the jobs
*Playwright e2e (1 of 2)* and *(2 of 2)* run `--shard=1/2` and `--shard=2/2`, and the check **Playwright e2e** is green only when
both are, so a branch rule naming it still holds. With `fullyParallel` on, Playwright shares the tests out one by one, 1,074 and
1,074 of 2,148 (29 Oct 2026); on their first green run the halves' tests took 16.7 and 21.2 minutes. Each half allows 45 minutes, as the whole suite did, since each has its own setup and the apt step behind Chromium's
install has taken 5 on its own. Whole, the suite had grown from about 27 minutes on two workers (26.6 on 10 Oct 2026, 1,734 tests) to
40–42 (2,135 tests, 28 Oct 2026), and a red run takes longer (38.0 on 16 Oct at 2,030 with 37 failing, some at their timeouts), so
the 45 was close. Don't read a slow half as a hang. To run one half here: `pnpm exec playwright test --shard=1/2`; a failing test is
listed in the job of the half that ran it.

**CI's browser draws text about 0.5% wider than this sandbox's** (Chromium 147 against 141; U2R, 20 Oct 2026): a fit that passes
here by a hair can wrap there (two labels on Performance did). Before pushing a change near a measured limit, measure it again with
`* { letter-spacing: 0.005em }` laid over the page; that reproduced CI's figure to the pixel.

⚠ **In this sandbox a page now and then hangs just after it loads: a deadlock inside Chromium, not the app** (20 Oct 2026). About
one test in 1,500 to 2,000 times out, and closing it reports *Object with guid response@… was not bound in the connection* (the trace
recorder waits on a snapshot the page never takes, so the navigation's answer comes after the context has closed). gdb on the hung
renderer (Chromium 141) shows its main thread laying out text in a web font that is still loading and waiting on the Linux font service
(`FontServiceThread::FontRenderStyleForStrike`). That request needs one of the renderer's three thread-pool workers, and all three are
parked in V8's `CollectionBarrier`, waiting for the main thread to collect garbage. Web fonts make Blink build font data during boot
while V8 compiles the app's script in the background, which is why it began with Geist under test. **It has shown on CI twice**, both
on 29 Oct 2026 (Chromium 147 on a Linux runner), each in half 2 and on the phone: P73 on `979573c` and P21 on `cb4c12d`, a commit
whose app and tests were those of `f04cb9f`, where both passed. Each half's `playwright-traces-2` artifact held the trace: the
navigation's own call ended, the test's never did, the last frame was the shell with no board, and closing reported the same unbound
response. Android and Windows have no Linux font service. Run that one test again before reading the failure as yours.

**Fixtures seed the LEGACY key and wait for `body.inv-booted`.** `loadAppWithState` writes
`sep_invoicing_state` to localStorage from an init script; the app migrates it into IndexedDB at
boot, so every spec also exercises that migration. The init script re-runs on each navigation but a
populated store wins, so a reload keeps what the test changed. A second call on the same page
deletes the database first. Read what a reload would load with `readStoredState(page)`, never from
localStorage — the state is not there any more.

**`emptyState()` is empty, since 22 Oct 2026.** Until then `seed.js` filled `incomingMaterial` with 50 real
challans whenever it was an empty array, so a spec asserting on challan-derived data without supplying its own
silently measured the seed. The seed went with the rest of the build's client data (HR-10). `noSeedIM()` in the
fixtures still adds its placeholder challan (a client id no spec uses), so the specs written against the old trap
keep their shape.

**Fixtures carry `todayIso()` / `recentTs()`, never hardcoded dates.** Three tests have now
been found passing only because of when they were written or what they happened not to
filter on; a literal date in a fixture is a time bomb, not a constant.
