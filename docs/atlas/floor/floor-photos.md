---
subject: "Floor photos: the log, the areas, tagging"
domain: floor
modules: [split/floorphotos.js]
specs: []
tests: [P267]
updated: 2026-11-17 (new: Production → Photos)
---

### Floor photos: the log, the areas, tagging
Owner, 17 Nov 2026, while the plan for fixed cameras waits on the Board: *"build an infrastructure to work with what we have got, as
in photos from [the floor] or me, we will start tagging it and start data logging to the app and database. This will help us refine
future infrastructure development plans as well and help in designing and seeing how our infrastructure change ideas feel on the real
floor."* Asked where a picture is kept: *"On the phone only, I will be the only one uploading the photos - they will be sent to me on
whatsapp."* Asked who tags: the sender at upload, the owner later from a queue, and Claude suggesting with a person confirming, all three.

- **Production → Photos** (`fphHtml`): *Add photos* takes several at once and saves each at once, untagged, dated from the file (a
  picture saved from WhatsApp carries the minute it arrived; the form says so and the time is changed there). The first opens to be
  tagged; *Save and next* walks the queue; *To tag* lists every photo with a question unanswered. Guarded as a floor entry (`grdGate`).
- **The picture stays on the device that added it**: the knowledge base's media store (`kbImageAdd`, `kbFillImages`; shrunk to 1,600 px,
  kept under the hash of its bytes, so the same photo twice is one and is refused as already in the log). **The book holds the log
  only** (`S.floorPhotos.photos`: `{id, img, w, h, name, date, time, area, sentBy, tags, note, by, at, tagBy, tagAt, claudeRead,
  claudeKept, voidedAt, voidReason, voidBy}`), never an image.
- **The areas and their questions are the book's** (`S.floorPhotos.areas`: `{id, name, line, questions: [{id, text, kind}]}`), typed by
  the owner in *Areas*: nothing about the shop is in the build. A question ending `?` is answered yes or no, one ending `#` with a
  count, any other in words (`fphQuestion`). An area may watch a line (VAT A1, VAT A2, the barrel, pickling): a photo of it shows
  **the record within an hour** of its time (`fphRecordNear`: a run whose span the hour touches, a pickling load within the hour),
  the first cross-check.
- **Claude suggests, a person keeps** (`fphAskClaude`, photoread.js `phRead`): the photo and its area's questions, answered only
  from what is visible, null where it is not, with one sentence of what it shows. The answers fill the form marked *Claude's
  suggestion: check it*; nothing is saved until a person saves. The photo records that it was read and its cost (`claudeRead`), and
  which suggested answers were kept unchanged (`claudeKept`).
- **A photo is voided with a reason, never deleted** (the voids permission).
- **Drawing the tab writes nothing** (`fphData`: a read answers an empty log; only a save attaches `floorPhotos` to the book), so the
  change log sees no change from a screen drawn (P141).
