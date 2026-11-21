---
subject: "Error reports"
domain: core
modules: [split/errors.js]
specs: []
tests: [P143]
updated: 2026-11-21 (the error's own message no longer goes; the owner is asked for it where a report has no place in the code; the last five kept for him to send from Settings); 2026-11-17 (ERR_HOSTS names the new address beside the old: S0)
---

### Error reports
**An error nobody caught, a screen that could not be drawn and a start-up step that failed are sent to the developer**
(`errors.js`; owner, 1 Oct 2026: *"Yes, add Sentry error reporting"*, after agreeing what may go). They still reach the
owner's screen as before (`uiNotice`); the report is the developer's copy, so a crash on the phone is seen before anybody
has to describe it. P143.
- **What goes**: the kind of error, the stack as function names and line numbers in the built page, the build stamp as the
  release, the screen, the layout, whether installed and online, the browser. In place of the message: `(message not sent)`.
- **The error's own message does not go** (the owner, 21 Nov 2026). It went masked (`errScrub`: amounts, numbers, dates,
  double-quoted text, e-mails, GSTINs, names of two or more words in capitals), and the mask missed text in single quotes, a
  single word in capitals and any name in title case. No mask can know every name in a book, so the words stay on the device.
  `errScrub` remains for two uses: telling two errors apart on the device, and the one case below.
- **The owner is asked where a report cannot be diagnosed** (`errAskWords`): his words were *"Request for error message if
  Sentry is unable to diagnose bugs"*. The app's test for that is a report with **no place in the code** (no stack frames: an
  error from another origin, or one raised as plain text), which says only its kind. The owner, if he is the one signed in
  on a started app (with the guard off, whoever is using it), is shown the masked message and asked: *Send the message* or
  *Send without it*. Anybody else is not asked and the report goes without. That test is the Builder's reading of his words;
  a report that has frames and still cannot be read is the manual door's.
- **The manual door** (`errKeep`, `errKeptHtml`, `errSendKept`; the owner chose it in a dialog, 21 Nov 2026): the masked
  messages of the last five reports that went without them are kept on the device (`sep_inv_err_kept`, never on the book;
  not carried to a new address; gone with *Sign out and clear this device*). Settings → Backup, storage & build lists them
  for the owner only, newest first, each with *Send this message*: asked first with the words shown, then sent as a report
  of its own tagged `follows` with the first report's id. *Clear these messages* empties the list. This covers the report
  that has a place in the code and still cannot be read: the developer says so, and the owner sends its message.
- **What never goes**: a record, a figure, the address's query, a user, breadcrumbs. **There is no Sentry SDK**: its
  breadcrumbs carry request URLs, and the metals.dev key travels in theirs. One POST of an envelope to Sentry's
  endpoint (`text/plain`, so no preflight; the service worker never touches a POST).
- **From the live site only** (`ERR_HOSTS`: `rishabh1804.github.io` and, since S0, `app.somaelectro.co.in`), never from a test browser (`navigator.webdriver`) or a local copy. `ERR_DSN`
  names the project (the owner's, EU region, given 1 Oct 2026; a DSN is a public key, made to sit in the page). Each kind of
  error once a session, at most ten; held on the device while offline (`sep_inv_err_queue`, twenty at most) and sent when it
  is back online. Checked at setup: Sentry took a test event (environment `setup-check`) and answers the site's origin with
  `access-control-allow-origin: *` on a `text/plain` POST, so a browser needs no preflight.
- **Off per device**: Settings → Data & device → Backup, storage & build (`sep_inv_err_off`, never on the book).
- **In Sentry**, the project should have *Prevent storing of IP addresses* on, and *Allowed domains* set to
  `rishabh1804.github.io` and `app.somaelectro.co.in` (S0: the owner adds the second, `docs/S0_GUIDE.md`) so nobody else can post
  into it with the public key (both under Security & Privacy). The new address's CSP lets the page reach the project's ingest host
  (`server/app`), and only it.
