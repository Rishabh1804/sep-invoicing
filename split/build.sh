#!/bin/bash
# SEP Invoicing — Build Script
# Concatenates split modules into sep-invoicing.html
# Usage: cd split && bash build.sh > ../sep-invoicing.html

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

cat "$DIR/head.html"
echo '<style>'
cat "$DIR/styles.css"
echo '</style>'
cat "$DIR/body.html"
echo '<script>'
cat \
  "$DIR/data.js" \
  "$DIR/state.js" \
  "$DIR/tabs.js" \
  "$DIR/clients.js" \
  "$DIR/items.js" \
  "$DIR/create.js" \
  "$DIR/settings.js" \
  "$DIR/invoice-ops.js" \
  "$DIR/exports.js" \
  "$DIR/im.js" \
  "$DIR/autocomplete.js" \
  "$DIR/print.js" \
  "$DIR/stats.js" \
  "$DIR/im-form.js" \
  "$DIR/scanner.js" \
  "$DIR/events.js" \
  "$DIR/swipe.js" \
  "$DIR/seed.js" \
  "$DIR/init.js"
echo '</script>'
echo '</body>'
echo '</html>'
