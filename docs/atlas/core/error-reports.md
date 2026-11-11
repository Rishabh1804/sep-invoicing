---
subject: "Error reports"
domain: core
modules: [split/errors.js]
specs: []
tests: [P143]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Error reports
**An error nobody caught, a screen that could not be drawn and a start-up step that failed are sent to the developer**
(`errors.js`; owner, 1 Oct 2026: *"Yes, add Sentry error reporting"*, after agreeing what may go). They still reach the
owner's screen as before (`uiNotice`); the report is the developer's copy, so a crash on the phone is seen before anybody
has to describe it. P143.
- **What goes**: the kind of error, its message with anything that could be the book's data masked (`errScrub`: amounts,
  numbers, dates, quoted text, e-mails, GSTINs, names written in capitals), the stack as function names and line numbers in
  the built page, the build stamp as the release, the screen, the layout, whether installed and online, the browser.
- **What never goes**: a record, a figure, the address's query, a user, breadcrumbs. **There is no Sentry SDK**: its
  breadcrumbs carry request URLs, and the metals.dev key travels in theirs. One POST of an envelope to Sentry's
  endpoint (`text/plain`, so no preflight; the service worker never touches a POST).
- **From the live site only** (`ERR_HOSTS`), never from a test browser (`navigator.webdriver`) or a local copy. `ERR_DSN`
  names the project (the owner's, EU region, given 1 Oct 2026; a DSN is a public key, made to sit in the page). Each kind of
  error once a session, at most ten; held on the device while offline (`sep_inv_err_queue`, twenty at most) and sent when it
  is back online. Checked at setup: Sentry took a test event (environment `setup-check`) and answers the site's origin with
  `access-control-allow-origin: *` on a `text/plain` POST, so a browser needs no preflight.
- **Off per device**: Settings → Data & device → Backup, storage & build (`sep_inv_err_off`, never on the book).
- **In Sentry**, the project should have *Prevent storing of IP addresses* on, and *Allowed domains* set to
  `rishabh1804.github.io` so nobody else can post into it with the public key (both under Security & Privacy).
