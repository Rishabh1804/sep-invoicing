# SEP Invoicing

Single-file HTML PWA for Soma Electro Products — zinc electroplating job-work invoicing, incoming material tracking, and GST compliance.

**Live:** [rishabh1804.github.io/sep-invoicing/](https://rishabh1804.github.io/sep-invoicing/)

## Architecture

Split-file PWA: 21 modules in `split/` directory, concatenated via `build.sh` into a single `sep-invoicing.html`. Deploy copy is `index.html`.

See `docs/ARCHITECTURE.md` for the full module map and concat order.

## Termux Deploy Commands

```bash
# Navigate to repo
cd ~/storage/downloads/sep-invoicing

# If updating from a zip:
unzip -o ~/storage/downloads/sep-invoicing-phase6b.zip

# Rebuild from split modules (optional — zip includes pre-built html)
cd split
bash build.sh > ../sep-invoicing.html
cd ..

# Deploy
cp sep-invoicing.html index.html
git add -A
git commit -m "Phase 6b: usage scoring, register bulk ops, tab persistence"
git push
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

All state in `localStorage` key `sep_invoicing_state`. No backend. Manual backup/restore via Settings → Export/Import JSON.
