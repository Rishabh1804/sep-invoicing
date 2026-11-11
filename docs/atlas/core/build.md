---
subject: "Build, the stamp and the pre-commit hook"
domain: core
modules: [split/build.sh]
specs: []
tests: []
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Build

```bash
bash split/build.sh
git add -A && git commit -m "description" && git push
```

`build.sh` writes `sep-invoicing.html`, syncs `index.html`, and writes `version.json`. Never
edit any of the three by hand.

**The build is stamped, and the stamp is a hash of `split/`, not a git SHA or a clock.** The
pre-commit hook builds before the commit exists (HEAD would be the parent), and CI rebuilds and
diffs the output, so a stamp that is not a pure function of the sources fails `build-sync` on
every commit. The same eight hex characters go into the document as `<meta name="app-build">`
and into `version.json`; Settings shows it, so a bug report can name the build it was seen on.

The pre-commit hook in `.githooks/` rebuilds and stages all three artefacts, so a commit
can't carry stale output. Sessions clone fresh, so `.claude/hooks/session-start.sh`
arms it (`git config core.hooksPath .githooks`) and installs the test dependencies on
every session start — nothing to set up by hand. CI (`build-sync`) is the backstop.
