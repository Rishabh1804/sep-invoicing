#!/bin/bash
# SEP Invoicing — Build Script
# Concatenates split modules into sep-invoicing.html, then syncs index.html.
#
# Usage: bash split/build.sh
#
# Writes its own output files rather than going to stdout, so the copy to
# index.html can't be forgotten. The old stdout-redirect form still works —
# the redirect target and $OUT are the same file — but is no longer needed.
#
# It also stamps the build. The stamp is a hash of the SOURCES, not a git SHA
# or a timestamp: the pre-commit hook builds before the commit exists (so HEAD
# would be the parent), and CI rebuilds and diffs the output, so anything that
# is not a pure function of split/ would fail build-sync on every commit. The
# same stamp goes into the document (<meta name="app-build">) and into
# version.json, which the app polls to learn a newer build has shipped.

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
OUT="$ROOT/sep-invoicing.html"

JS_SOURCES=(
  "$DIR/data.js"
    "$DIR/state.js" \
    "$DIR/zinc.js" \
    "$DIR/tabs.js" \
    "$DIR/clients.js" \
    "$DIR/items.js" \
    "$DIR/create.js" \
    "$DIR/settings.js" \
    "$DIR/github-sync.js" \
    "$DIR/invoice-ops.js" \
    "$DIR/number-audit.js" \
    "$DIR/exports.js" \
    "$DIR/im.js" \
    "$DIR/autocomplete.js" \
    "$DIR/print.js" \
    "$DIR/quality-cert.js" \
    "$DIR/credit-note.js" \
    "$DIR/charts.js" \
    "$DIR/staff.js" \
    "$DIR/labour.js" \
    "$DIR/areas.js" \
    "$DIR/stats.js" \
    "$DIR/client-perf.js" \
    "$DIR/im-form.js" \
    "$DIR/im-dupe.js" \
    "$DIR/scanner.js" \
    "$DIR/events.js" \
    "$DIR/swipe.js" \
  "$DIR/seed.js"
  "$DIR/init.js"
)

# macOS ships shasum, Linux ships sha256sum; either gives the same digest.
hash_stdin() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi
}
BUILD="$(cat "$DIR/head.html" "$DIR/styles.css" "$DIR/body.html" "${JS_SOURCES[@]}" | hash_stdin | cut -c1-8)"

{
  cat "$DIR/head.html"
  echo "<meta name=\"app-build\" content=\"$BUILD\">"
  echo '<style>'
  cat "$DIR/styles.css"
  echo '</style>'
  cat "$DIR/body.html"
  echo '<script>'
  cat "${JS_SOURCES[@]}"
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > "$OUT"

cp "$OUT" "$ROOT/index.html"
printf '{ "build": "%s" }\n' "$BUILD" > "$ROOT/version.json"

# Status goes to stderr so it can never contaminate the built HTML.
echo "built sep-invoicing.html and synced index.html (build $BUILD)" >&2
