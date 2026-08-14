# SEP Invoicing

Single-file HTML PWA for Soma Electro Products — zinc electroplating job-work invoicing, incoming material tracking, and GST compliance.

**Live:** [rishabh1804.github.io/sep-invoicing/](https://rishabh1804.github.io/sep-invoicing/)

## Architecture

Split-file PWA: 27 modules in `split/` directory, concatenated via `build.sh` into a single `sep-invoicing.html`. Deploy copy is `index.html`.

See `docs/ARCHITECTURE.md` for the full module map and concat order.

## Build and Deploy

```bash
bash split/build.sh                      # writes sep-invoicing.html, syncs index.html
git add -A && git commit -m "..." && git push
```

`build.sh` produces both artefacts itself — never edit `sep-invoicing.html` or
`index.html` by hand. A pre-commit hook rebuilds and stages them, and CI's
`build-sync` job fails any PR whose committed output has drifted from `split/`.

Claude Code sessions clone fresh, so `.claude/hooks/session-start.sh` arms that hook
and installs the test dependencies at session start; there is nothing to configure.

```bash
pnpm exec playwright test                # e2e suite, mobile + desktop layouts
```

## Codex Snippet Import

After a build session, Aurelius generates a JSON snippet for the Codex project registry.

### Snippet format

```json
{
  "_snippet_version": 1,
  "session": {
    "id": "s-YYYY-MM-DD-NN",
    "date": "YYYY-MM-DD",
    "summary": "What was built",
    "volumes_touched": ["sep-invoicing"],
    "chapters_touched": ["chapter-id"],
    "decisions": [],
    "bugs_found": 0,
    "bugs_fixed": 0,
    "open_todos": [],
    "handoff": "What's next",
    "duration_minutes": 0
  },
  "canons": [],
  "chapter_updates": [
    {
      "volume": "sep-invoicing",
      "chapter": "chapter-id",
      "patch": { "status": "complete", "summary": "Updated summary" }
    }
  ],
  "new_chapters": [
    {
      "volume": "sep-invoicing",
      "id": "new-chapter-id",
      "name": "Chapter Name",
      "status": "complete",
      "started": "YYYY-MM-DD",
      "completed": "YYYY-MM-DD",
      "summary": "What this chapter covers"
    }
  ],
  "todos": [
    { "volume": "sep-invoicing", "todo": { "text": "TODO description" } }
  ]
}
```

### Import steps

1. Open Codex PWA → Settings (or nav menu) → **Import Aurelius Snippet**
2. Paste the JSON snippet
3. Tap **Preview** — check green checkmarks vs red X (exists/skip)
4. Tap **Import**

### Important notes

- `_snippet_version: 1` is required — import fails without it
- Session `id` format: `s-YYYY-MM-DD-NN` (e.g., `s-2026-04-13-01`)
- If session `id` already exists for that date, import skips it (shows "exists")
- `chapter_updates` only work if the volume and chapter already exist in Codex
- `new_chapters` only work if the volume exists
- Canons with duplicate IDs are skipped

## Design Principles

See `docs/SEP_INVOICING_DESIGN_PRINCIPLES.md` for the 8 hard rules, domain color system, and session conventions.

## Data

All state in `localStorage` key `sep_invoicing_state`. No backend. Manual backup/restore via
Settings → Export/Import JSON.

**GitHub sync** (Settings → GitHub Sync) is an optional second copy, not a backend: it pushes
the whole state as one JSON file to a repo via the Contents API and pulls it back on another
device. Last-writer-wins by design, but never blind — each device remembers the blob SHA it
last exchanged and warns before replacing a copy it did not write. Use a fine-grained token
with **Contents: Read and write** on one private repo. Credentials live in their own
localStorage entries and are never included in a JSON export.

## Quality certificates

Register → open an invoice → **Quality Cert**, or tick several invoices and use **Quality certs**
on the selection bar. One printable A4 Test Certificate (ZN Plating) per invoice line, since the
customer files it against the part. Print or save to PDF from the same toolbar the invoice preview
uses. The format reproduces the Tata Motors QA-approved reference exactly and must not be edited
without QA-TML approval — see the Quality certificates section of `CLAUDE.md`.

**Offline:** the app opens without a network once it has been loaded online at least once.
Navigations are network-first, so an online device always renders fresh HTML and the cached
shell is reached only when the network has actually failed.
