---
subject: "Build, the stamp and the pre-commit hook"
domain: core
modules: [split/build.sh]
specs: []
tests: []
updated: 2026-11-17 (build.sh ends by writing dist/, the new address's files: split/dist.sh, S0)
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

**Then it writes `dist/`** (`split/dist.sh`, S0): the app's own files, a list, for the new address's Worker (`server/app`). `dist/` is
git-ignored and built by Cloudflare's deploy; it never holds `CLAUDE.md`, `docs/`, the sources or `checkin.html`
(`new-address.md`). `bash split/dist.sh <folder>` writes it elsewhere (P280 does). CI's *App Worker tests* builds it, then runs the
Worker's suite over it.

The pre-commit hook in `.githooks/` rebuilds and stages all three artefacts, so a commit
can't carry stale output. Sessions clone fresh, so `.claude/hooks/session-start.sh`
arms it (`git config core.hooksPath .githooks`) and installs the test dependencies on
every session start — nothing to set up by hand. CI (`build-sync`) is the backstop.
