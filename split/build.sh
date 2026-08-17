#!/bin/bash
# SEP Invoicing — Build Script
# Concatenates split modules into sep-invoicing.html, then syncs index.html.
#
# Usage: bash split/build.sh
#
# Writes its own output files rather than going to stdout, so the copy to
# index.html can't be forgotten. The old stdout-redirect form still works —
# the redirect target and $OUT are the same file — but is no longer needed.

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
OUT="$ROOT/sep-invoicing.html"

{
  cat "$DIR/head.html"
  echo '<style>'
  cat "$DIR/styles.css"
  echo '</style>'
  cat "$DIR/body.html"
  echo '<script>'
  cat \
    "$DIR/data.js" \
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
    "$DIR/stats.js" \
    "$DIR/im-form.js" \
    "$DIR/im-dupe.js" \
    "$DIR/scanner.js" \
    "$DIR/events.js" \
    "$DIR/swipe.js" \
    "$DIR/seed.js" \
    "$DIR/init.js"
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > "$OUT"

cp "$OUT" "$ROOT/index.html"

# Status goes to stderr so it can never contaminate the built HTML.
echo "built sep-invoicing.html and synced index.html" >&2
