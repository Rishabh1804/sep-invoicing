---
subject: "Offline"
domain: core
modules: []
specs: []
tests: []
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

## Offline

Canon 0034 says service workers never cache HTML. That rule exists to prevent the unbreakable
update loop — a stale shell served forever to a device that stops asking the network.

`sw.js` now keeps that guarantee by a different mechanism rather than by abstention.
Navigations are **network-first**: an online device always renders what the server just sent,
and the cached shell is reached only after the network has actually failed. The loop cannot
form, because the cache is never *preferred* while the network answers. What it buys back is
the thing the canon cost: every byte of business data is local, yet the app could not be
opened at all without signal.

Static assets are cache-first and revalidated behind the response. The install step keeps
same-origin assets atomic but lets the cross-origin font CSS fail on its own — it used to sit
in the same `addAll()`, so one CDN hiccup rejected the install and the worker never activated.
Gemini, metals.dev and api.github.com are never intercepted.

**The shell cache is not versioned, and a worker bump used to delete the only offline copy.**
The navigation that triggers a worker update is served by the *old* worker, which stored the
page under the old versioned name; the new worker then activated, deleted every cache not on
its keep list, and its own shell cache stayed empty until the next online open. A device that
went offline in that window got the "never loaded online" page, which was also untrue. The
shell cache holds one entry that every online navigation overwrites, so the version suffix
bought nothing. `sep-inv-shell` now outlives the worker that wrote it, and the one upgrade
that crosses the rename copies the legacy `sep-inv-shell-v*` entry across before dropping it.
`CACHE_NAME` keeps its suffix — that cache is rebuilt at install anyway.

**An open app is told when a build ships; it is never reloaded for it** (the print station aside, which reloads itself once nothing
would be lost: *The print station's light*, above). Network-first makes
every fresh open current, but an installed app resumed from recents never navigates, so nothing
told an open page that a build had shipped — it could run one build for weeks with no way to
say which. The page re-reads `version.json` (`cache: 'no-store'`; the worker steps aside for
that one path, or it would read its own stale copy forever) whenever it comes back into view,
throttled to once in five minutes, and raises a banner when the stamp differs from its own.
The banner offers a reload and says to finish anything half-typed first: a reload discards an
in-progress challan, and that is the operator's call. *Later* silences that build only; the
next one asks again. The manual check in Settings keeps *could not reach the server* apart from
*up to date*, so an offline device is never told it is current.

Note what the stamp is and is not: it identifies the **document**, so a change to `sw.js` alone
does not move it — the worker updates through the browser's own byte-compare, as before.
