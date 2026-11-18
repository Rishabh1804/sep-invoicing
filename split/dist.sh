#!/bin/bash
# SEP Invoicing — what the new address publishes (S0, docs/SERVER.md §9 step 0)
#
# Usage: bash split/dist.sh [out-dir]      (default: dist/ at the repository root; build.sh runs it)
#
# GitHub Pages publishes the whole repository: CLAUDE.md and every file under docs/ answer from github.io. The new address,
# app.somaelectro.co.in (server/app, a Cloudflare Worker), serves this folder and nothing else. It is a list, never a copy of
# the tree: a file joins it only by being named here, so nothing new in the repository is published by accident. The list is
# what the page, sw.js and the manifest load (P280 checks every one is here and nothing else is). checkin.html is NOT here:
# it stays on the old address, where each worker's phone keeps its card.
#
# dist/ is built, never committed (.gitignore): the deploy runs build.sh, which runs this.

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
OUT="${1:-$ROOT/dist}"

FILES=(
  index.html
  sw.js
  manifest.json
  version.json
  favicon.svg
  favicon-32.png
  icon-192.png
  icon-512.png
  icon-512-maskable.png
  icons/icon-teal.svg
  icons/icon-teal-192.png
  icons/icon-teal-512.png
  icons/icon-terracotta.svg
  icons/icon-terracotta-192.png
  icons/icon-terracotta-512.png
  icons/icon-zinc.svg
  icons/icon-zinc-192.png
  icons/icon-zinc-512.png
  widgets/todo-template.json
  widgets/todo-screenshot.png
)

# Never the repository itself, never the filesystem's root.
case "$(cd "$(dirname "$OUT")" 2>/dev/null && pwd)/$(basename "$OUT")" in
  "$ROOT"|"$ROOT/"|/) echo "dist.sh: refusing to write into $OUT" >&2; exit 1 ;;
esac

rm -rf "$OUT"
mkdir -p "$OUT"
for f in "${FILES[@]}"; do
  mkdir -p "$OUT/$(dirname "$f")"
  cp "$ROOT/$f" "$OUT/$f"
done

echo "wrote ${#FILES[@]} files to $OUT" >&2
