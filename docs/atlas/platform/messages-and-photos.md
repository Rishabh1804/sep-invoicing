---
subject: "WhatsApp messages, photos and the Tata release read by Claude"
domain: platform
modules: [split/msgconfirm.js, split/msgprofile.js, split/msgstore.js, split/msgview.js, split/photoread.js, split/scanner.js, split/tatarelease.js, split/wazip.js]
specs: [docs/MESSAGES.md]
tests: [P253, P256, P257, P263]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### WhatsApp messages: kept, read, confirmed
`docs/MESSAGES.md` (owner, 31 Oct 2026: *"a whatsapp zip file reader … The parser should be able to sort every new message and then
bring up a final confirmation screen up for me. Before doing this, make sure we have the parser logic loaded and fine-tuned and
iterable within the app itself"*; then *"Always, but repetitive work must be designed better"* for production, and the import from
the last message of each kind the book holds). P253–P256.
- **Every message is kept** (`S.messages`, msgstore.js): pasted in the one paste box (`mvKeepPaste`, from `relayRead`) or taken from
  an export, its sender, day, minute and text, its kind (`msgSort`) and how sure, its status (new, not read, saved, set aside), what its
  reader saved from it (`msgMarkSaved`, called by each reader's save) and its edits. A message is its sender, day, minute and text
  (`msgKey`): the same message twice is one, and an export holding a pasted one again lists it (`seenIn`) as saved before.
- **The senders are learnt** (`S.msgProfile`, msgprofile.js): the hours each sends each kind, how it opens, how long, what is corrected
  later, spellings. A kind's confidence is the lower of the sorter's and the sender's record (`mpKindConf`); a drawing path never writes
  it (`msgOtherSort`).
- **An export** (wazip.js, Add → File, a `.zip` or the chat's `.txt`): unpacked in the app, split by WhatsApp's lines, taken in from the
  last message of each kind the book holds (the older ones kept only to learn how each sender writes: status `learn`, never offered
  to save, off the list until picked; owner, 3 Nov 2026), then **the confirmation screen** (msgconfirm.js, `mcOpen`): the new messages by day and kind
  in the floor's order, what each would write, read by its own reader without saving. Rolls, stock and cash at 90% or more with no red
  question come ticked; **production always waits**, with a tick for a day's group and for every message like one, and the arrows and
  space on the desktop. A mark typed by hand the rolls disagree with is kept unless the message is used, hand by hand or for all (the
  same as People's paste, `relayPlan`'s `differs`). What nothing here saves (not read, weekly payment summaries) is one panel shut at the
  foot. One save writes through each reader's own core (`relayApplyPlan`, `prodSaveCore`, `stockCommitPaste`, `cashSaveCore`).
- **Messages** (msgview.js, a top-bar tool, the owner's; `?tab=pageMessages`): the list by day with its verdict; one message is its
  reader's check, its questions, each line beside what was read from it, its kind set by hand (a lesson for the sorter), its text edited
  and read again with what moved; *Read every message again* lists what the reader as it is now reads differently, writing nothing.
- **A data flow changed**: `S.messages`, `S.msgImports` and `S.msgProfile` travel with the book (backups, GitHub, the merge); the
  messages are the WhatsApp group's text, the same the rolls already kept.

### Photos read by Claude (3 Nov 2026)
Owner, 3 Nov 2026: *"Let's add photos reader along with it, we have 100$ of claude API credit, so we should be able to use that rather
than using google?"*, then: the key on the owner's devices, Opus 5.5, and three kinds of photo, the VAT register's pages, its power log
and client challans (`photoread.js`, `scanner.js`, P257). The Gemini reading the owner took out on 13 Oct 2026 (*"it simply never
works"*) is replaced; what the app does with a reading is the reader it always had.
- **The key is the device's** (`sep_inv_claude_key`, Settings → Connections → Photo reading), never the book's, a backup's or GitHub's.
  The photo goes from the browser straight to `api.anthropic.com` (`anthropic-dangerous-direct-browser-access`), with nothing else.
  Raw `fetch`: the app has no packages, and a library loaded from elsewhere into the page that holds the book is a risk not taken.
- **One request a photo** (`phRead`): the picture turned upright and shrunk to 1,568 px on its long edge, the prompt, a JSON schema the
  answer must follow (`output_config.format`, every field named, a field not written `null`), effort high, and the server's refusal
  fallbacks (`fallbacks: "default"`, dropped once on a device whose account refuses them, `sep_inv_claude_nofallback`). The answer's
  token counts are priced at Opus 5.5's $4 / $20 a million and kept on the device (`sep_inv_claude_spent`), which Settings says. A key
  refused, the credit used up, too many at once, Anthropic busy, a decline, a cut-off reply or no JSON is said in the banner, never
  read as a page; a refused key or a used-up credit stops the photos waiting.
- **Claude only transcribes** (`PROD_REGISTER_PROMPT`, `reg-c1`): times, figures and spellings as written, struck rows marked, no client
  list sent. The runs, the START rule, the gauge and part rules and the day's total are `prodFromRegisterRead`'s, the reader a page typed
  on Mine goes through, and **Production → More → Read register photo** is the check restored as it was before 13 Oct: each run, a struck
  row Counted or Cancelled, a client changed, the date and line set, the power log's cuts, a photo saved before refused, a page entered on
  Mine warned. Saved, the runs are `src: 'photo'` with the photo's facts in `production.photos` (model, prompt version, cost, sender),
  never the image. A reading kept unsaved on the device is not paid for twice (`sep_inv_prod_photo_read`). A customer's challan is
  offered to the scanner (a second read); anything else is said and nothing read.
- **The challan scanner** (Challans → More → Scan a challan, both tabs): the challan's number, date, client, vehicle and lines read into
  the challan form, which is checked and saved as any challan. The prompt names no client and asks no rate (HR-10): the client is one
  of the book's own (matched only where one fits), every rate the client's own record. The old scanner's client map is gone with it.
- **Photos picked several at once** (Production's picker, Add → Photo, a file that is a photo) wait in Production and are read one at a
  time, each paid for when it is reached; over five asks first with what they come to.
- **An export's photos** (wazip.js): the chat's photo lines say who sent each and when; the zip's photos sent after the book's last
  production record (else from the first new message on, every one where the book held none) are kept for the session only (`_wzPhotos`), never in the book, and the confirmation screen
  offers them as one row (`data-mc-photos`, its senders and days), **Read them** handing them to Production's check with their sender and
  minute. The import's record gains `photos`, the count.
- **A data flow changed**: the requests to `api.anthropic.com`, carrying the photo alone; `production.photos` gains `sentBy` and `usd`.

### Tata Motors' release, read by Claude (10 Nov 2026)
Owner, 10 Nov 2026: *"For Tata Motors I have to enter the figures by hand, let's have it so that those are updated by reading the news and
related release from the Tata Motors plant. All of those information are released to the public and shareholders."* `tatarelease.js`,
P263.
- **Where the figures come from**: Tata Motors' own monthly CV sales release (tatamotors.com) or its filing with BSE or NSE, and nowhere
  else. Claude (the device's key, `sep_inv_claude_key`, Opus 5.5) searches and fetches those three sites only (`web_search_20260209`,
  `web_fetch_20260209`, each with `allowed_domains`) and answers through one strict tool, `record_release`. The news is not read for the
  figures: one retelling of October 2026's release printed a domestic and an export figure that did not add up to its total.
- **Checked in code before it is believed** (`trCheck`): the month asked; a link on one of the three sites; whole numbers; CVs in India +
  CV exports = all CVs, for the month and the year before; heavy trucks within CVs in India; a release day after the month. Passing, the
  month is saved (`src: 'release'`, the link, the day, `read: {model, usd}`) unless it was typed by hand: then the release is **offered**
  beside it (*agrees* or *differs*), never written over it. Failing, it is offered with what failed. **Use** fills the dialog's fields;
  nothing is saved until Save.
- **When**: with the feeds when Home is drawn (`feedEnsure` → `trEnsure`), for the month before, from the 1st until it is saved, at most
  every 6 hours and 8 times a month a device; never offline, hidden, under test (unless `window.__sepTataReadOn`), with nobody signed in,
  for an ID that may not change Settings, or with no key. An offer waits for the owner. The Tata dialog's **Read the release** asks for
  the month shown (`grdGate('settings')`). A paused server turn is sent back once or twice (`pause_turn`).
- **On the device only** (`sep_inv_tata_read`, by month): tries, when, how the last ended, an offer. Its cost joins the photos' figure,
  counted apart (`phSpentAdd(usd, 'tata')`; *1 Tata release read on this device*). `phPost` (photoread.js) is the one request both make.
- The To-do's `mktTata` says how the last reading ended. The guide *Setting up: the news and weather* is version 4.
- **A data flow changed**: a month in `S.market.tata` read from the release carries `src: 'release'` and `read: {model, usd}`; new
  requests from an owner device to api.anthropic.com, carrying the prompt alone (the month), nothing of the book.
