# sep-app

SEP Invoicing at its own address, `app.somaelectro.co.in` (S0, `docs/SERVER.md` §9 step 0). A Cloudflare Worker serving `dist/`
as static assets, and nothing else: `split/dist.sh` (run by `split/build.sh`) writes the app's own files there, never `CLAUDE.md`,
`docs/` or the sources. No database and no secret; besides the assets, one Durable Object binding (`RELAY`) for the relay.
S1 adds the rest of `/api` to this Worker.

Setting it up is the owner's, once: `docs/S0_GUIDE.md`.

## What it does

- **One origin.** Any host but `APP_HOST` (its `*.workers.dev` address, a preview's address) and plain http answer `308` to
  `https://app.somaelectro.co.in`, path and query kept, so no second origin collects a book. `/sep-invoicing/…` goes to `/…`.
- **Only GET and HEAD**; anything else `405`. A path not in `dist/` is `404`. The one exception is the relay.
- **The relay, `/api/relay/<id>`**: `PUT` stores one opaque, end-to-end encrypted answer (at most 4096 bytes; the first write
  wins), `GET` returns it once; gone 120 s after its write. Same origin only, no CORS. One SQLite-backed Durable Object per id
  (`Relay`). The first deploy carrying its migration must be `wrangler deploy`. Detail: `docs/atlas/core/new-address.md`.
- **Headers on every answer** (`SECURITY_HEADERS` in `src/index.js`): a Content-Security-Policy naming the hosts the app calls
  (P280 fails when the app names a host the policy would refuse, and runs the handover under it), `nosniff`, a referrer policy,
  framing refused (`frame-ancestors 'none'`, `X-Frame-Options: DENY`), HSTS without subdomains (the apex is the website's), a
  permissions policy (camera and location for the app itself only). **No Cross-Origin-Opener-Policy**: the handover's window
  must keep its opener.

## Tests

```
bash split/build.sh        # at the repository's root: writes dist/
cd server/app && npm ci && npx vitest run
```

They run inside the Workers runtime over the real `dist/`. CI runs them as the job *App Worker tests*. To run the Worker on this
computer: `npm run dev` (it answers on `https://localhost:8787`).
