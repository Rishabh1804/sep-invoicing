---
subject: "Settings"
domain: core
modules: [split/settings.js]
specs: []
tests: [P50, P75, P279]
updated: 2026-11-17 (Company carries every field the documents print; a new book starts with it blank)
---

## Settings
Six groups (owner, 25 Sep 2026: *"Too many things all in one place, no markers, no subdivisions"*):
**Business** (company, bank, invoice and credit note series), **Checks & alerts** (rate & weight check, invoice states, stock
alerts, To-do), **Costing** (full cost, live-cost fallbacks with the chemicals model, zinc rate), **Labour**
(overtime, rest days & attendance, the extra, modelled labour), **Connections** (metals.dev, the Claude key for photos since 3 Nov 2026, GitHub sync; the Gemini key went with the photo reading, 13 Oct 2026)
and **Data & device** (backup, storage, build). The groups are `SETTINGS_GROUPS`, the sections `SETTINGS_SECS`
in `settings.js`, each with a `summary()`, `body()`, `why` and `save()`.

- **Company and Bank details are the book's, blank on a new book** (owner, 17 Nov 2026: nothing about the shop is in the
  build, HR-10). `getDefaultState()` holds `company` in its shape with every field empty and `bankDetails` empty; each section's
  line reads *Not set* until typed. Company has every field a document prints: name, GSTIN, three address lines, state and
  state code, phone, mobile and e-mail (`setComp…`; until then only name, GSTIN, two address lines and phone could be typed, the
  rest coming from the build). A book that holds its company keeps it: nothing fills, merges or overwrites it from code
  (`ensureStateShape` gives a book with no `company` at all the empty shape and touches no other). P279.

- **Every section is folded to one line saying what it is set to** (`10% · ₹100 · ±3%`), so Settings reads
  at a glance; the ruling behind the figures sits under *How this is used*.
- **Each section saves on its own** (owner: *separate Saves*). A Save that wrote the whole sheet let an edit
  to the bank details carry a half-typed labour figure with it. Save is enabled only once the section is
  edited; an unsaved section is marked on its line and on its group, and closing Settings with one asks,
  naming it. A refused figure (a credit note number already issued) leaves the section unsaved.
- **Desktop is two panes**: the groups down the left, one group on the right. The phone stacks the groups.
  The open group and sections are remembered per device (`sep_inv_settings_ui`), never on `S`.
- `openSettings(sec)` opens on one section; the To-do backup task opens *Backup, storage & build*. Specs use
  `openSettingsAt(page, sec)` from the fixtures, which walks the same clicks the operator does.
- **Part weights (NOS→KG) moved to Items → Part weights**: they price `nos_to_weight` lines, so they are
  data about parts, not a setting.
