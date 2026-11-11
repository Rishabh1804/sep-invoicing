---
paths:
  - "split/data.js"
  - "split/errors.js"
  - "split/github-sync.js"
  - "split/init.js"
  - "split/settings.js"
  - "sw.js"
  - "split/build.sh"
  - "tests/**"
  - ".github/**"
  - "split/head.html"
  - "split/body.html"
---

# Atlas route: core

Before changing one of these files, read its topics: the owner first, then the others that hold rules for it.
If your change alters behaviour a topic describes, update that topic and its `updated` line in the same PR. If you had to search for something the atlas should have routed, add the pointer (`docs/atlas/README.md`).

- `split/data.js`: `docs/atlas/core/hard-rules.md`
- `split/errors.js`: `docs/atlas/core/error-reports.md`
- `split/github-sync.js`: `docs/atlas/core/persistence.md`
- `split/init.js`: `docs/atlas/core/persistence.md`
- `split/settings.js`: `docs/atlas/core/settings.md`
- `sw.js`: `docs/atlas/core/offline.md`
- `split/build.sh`: `docs/atlas/core/build.md`
- `tests/**`: `docs/atlas/core/tests.md`
- `.github/**`: `docs/atlas/core/build.md`, `docs/atlas/core/tests.md`
- `split/head.html`: `docs/atlas/core/architecture.md`
- `split/body.html`: `docs/atlas/core/architecture.md`
