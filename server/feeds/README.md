# sep-feeds

The news and the weather for SEP Invoicing's Home (`docs/UI_PASS_3.md` §9a): Tata Motors' headlines from the GDELT Project and the
plant's forecast from MET Norway, fetched by a Cloudflare Worker, kept in Cloudflare's cache and answered to the app. No database,
no binding, no secret.

## Setting it up (the owner, once)

1. Cloudflare → **Workers & Pages → Create → Import a repository**: this repository. Name the Worker **sep-feeds** (the name in
   `wrangler.toml`), root directory **server/feeds**, production branch **main**. Leave the build command empty and the deploy
   command as it is (`npx wrangler deploy`). From then on each merge to main deploys it. To deploy only when this folder changes,
   set *Build watch paths* to `server/feeds/*`.
2. The Worker → **Settings → Variables and Secrets → Add**: type *Text*, name **CONTACT**, value the shop's website address or a
   mail address MET Norway may write to about the requests. MET's terms want it in every request; without it the Worker does not
   ask for the weather. Set nothing else there: `ALLOWED_ORIGINS` (the app's two addresses) comes from `wrangler.toml`, and a
   deploy puts it back if it is changed in the dashboard. CONTACT is kept out of `wrangler.toml` on purpose: a value there, even
   an empty one, would replace yours on every deploy.
3. The Worker → **Settings → Domains & Routes → Add → Custom domain**: **feeds.somaelectro.co.in**. Cloudflare makes the DNS
   record. The cache works there; on the `workers.dev` address it does nothing.
4. In the app: **Settings → Connections → News and weather → Check**. `/health` answers `{ok: true, at, contact}`;
   `contact: false` means step 2 is not done.

## What it answers

| Request | Answer |
|---|---|
| `GET /health` | `{ok: true, at, contact}`, never cached |
| `GET /news?topics=tata-cv,tata-plant,tata-models,tata-exports&models=Prima,Signa,Ultra,Azura` | `{at, topics: {<id>: {at, items: [{title, url, source, at, lang}]}}, credit}` |
| `GET /weather?lat=22.79&lon=86.15` | `{at, updated, lat, lon, hours, days, credit}`: the next 48 hours, and 7 days by India's calendar day |

- A bad question is 400 `{error}`; any other path 404; any method but GET and OPTIONS 405.
- Only the app's two origins get a CORS header. A browser may keep news and weather for 5 minutes.
- **The copy.** Each question's answer is kept in Cloudflare's cache under its normalised address. A request is answered from it
  at once. News older than 30 minutes, or weather past MET's *Expires*, is refreshed behind the answer (MET is asked with
  *If-Modified-Since*). With no copy at all the Worker asks first. When GDELT or MET fails, the last copy is served with
  `stale: true` (a news topic that failed says so on its own) and the Worker tries again 5 minutes later; with no copy it answers
  503 `{error}`.
- **GDELT is asked one topic at a time, 6 s apart**, as GDELT asks, so the first news answer takes about 20 s. The app gives up
  after 8 s; the Worker finishes the fetch anyway and the next request gets it.
- GDELT may answer *Please limit requests* when other users of Cloudflare's shared addresses asked it just before. The Worker
  then serves its last copy and tries again.

## Tests

```
npm ci
npx vitest run
```

The tests run inside Cloudflare's Workers runtime (vitest with `@cloudflare/vitest-pool-workers`). GDELT and MET are faked:
nothing reaches the network. CI runs them as the job `feeds`. To run the Worker on this computer, `npx wrangler dev`, with
`CONTACT=…` in a `.dev.vars` file (git ignores it).

## CPU

The free plan allows 10 ms of CPU a request, and 100,000 requests a day (Home on four devices every half hour for sixteen hours is
about 256). Measured by `test/cpu.test.js` in the Workers runtime on the build machine, 16 Oct 2026, six runs. The runtime's clock
moves in 1 ms steps, so a first call is read to the millisecond.

| Work | Mean of 300 calls | First call |
|---|---|---|
| A news refresh: GDELT's four answers read (25 articles each, 77 KB) and the copy written | 1.0–1.2 ms | 3–4 ms |
| A news request served from the copy (42 KB) | 0.10–0.13 ms | 0–1 ms |
| A weather refresh: MET's forecast read (90 steps, 46 KB) and the copy written | 0.35–0.41 ms | 1–2 ms |
| A weather request served from the copy (48 hours and 7 days) | 0.35–0.46 ms | 1–2 ms |

The test fails if any mean reaches 5 ms or any first call 10 ms.

## Credits

News: [The GDELT Project](https://www.gdeltproject.org/), free for commercial use with a citation and a link. Weather:
[MET Norway](https://api.met.no/), CC BY 4.0. Both credits are in every answer.
