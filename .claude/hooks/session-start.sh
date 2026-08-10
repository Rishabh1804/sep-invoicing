#!/bin/bash
# SessionStart hook — prepare a fresh clone for work.
#
# Claude Code sessions clone the repo fresh each time, so anything that
# normally lives in a long-lived working copy has to be re-established here.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

# 1. Arm the pre-commit hook.
#    sep-invoicing.html and index.html are build artefacts of split/. The hook
#    rebuilds and stages them so a commit cannot carry stale output. Git will
#    not enable a repository's own hooks on clone — that would be arbitrary
#    code execution on `git clone` — so every fresh clone must opt in.
#    Cheap and idempotent, so it runs everywhere rather than only on remote.
git config core.hooksPath .githooks

# 2. Install the Playwright test dependencies.
#    Skipped when node_modules is already present, which keeps a warm container
#    (or a local machine) from paying for this on every session start.
#    `install` rather than `ci`/`--frozen-lockfile` so a cached store is reused
#    and a lockfile drift cannot fail the session before it begins.
if [ ! -d node_modules ]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install
  else
    npm install
  fi
fi

# 3. Reconcile the browser build if the sandbox ships a different one.
#    Some environments pre-install Chromium at a build number this Playwright
#    version does not expect, and disable downloading the matching one. Rather
#    than fight that, point the config at the browser that IS present.
#    playwright.config.ts reads PW_CHROMIUM_PATH and ignores it when unset, so
#    this is a no-op wherever Playwright's own resolution already works.
if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -d node_modules ]; then
  expected=$(node -e "try{console.log(require('@playwright/test').chromium.executablePath())}catch(e){}" 2>/dev/null || true)
  fallback="${PLAYWRIGHT_BROWSERS_PATH:-}/chromium"
  if [ -n "$expected" ] && [ ! -x "$expected" ] && [ -x "$fallback" ]; then
    echo "export PW_CHROMIUM_PATH=$fallback" >> "$CLAUDE_ENV_FILE"
    echo "Playwright: expected browser missing, using $fallback" >&2
  fi
fi
