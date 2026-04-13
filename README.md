# SEP Invoicing

Invoicing and incoming material tracking PWA for **Soma Electro Products**, a zinc electroplating job-work firm in Adityapur Industrial Area, Jamshedpur.

## Architecture

Single-file HTML PWA. All state in `localStorage` (`sep_invoicing_state`).

| File | Purpose |
|------|---------|
| `sep-invoicing.html` | Source file — all edits happen here |
| `index.html` | Deploy copy — served by GitHub Pages |

## Features

- **5-tab structure:** Home, Create Invoice, Incoming Material, Invoice Register, Client Master
- **21 clients** with rate cards and three billing modes (KG, NOS, fixed)
- **Invoice creation** with GST calculation, preview, and print
- **Incoming material** tracking with challan management
- **AI challan scanning** via Gemini API (optional)
- **JSON backup/restore** for data portability
- Dark mode, offline-capable, mobile-first

## Deploy

```bash
cp sep-invoicing.html index.html
git add -A
git commit -m "description"
git push
```

## Data

All business data lives in `localStorage` only — never committed to the repo. Use the in-app backup/restore (Settings → Export Data) for data safety.

## Docs

Project documentation lives in `docs/`. See [docs/](docs/) for design principles and session handoffs.
