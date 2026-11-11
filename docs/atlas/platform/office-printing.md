---
subject: "Printing at the office and the print station's light"
domain: platform
modules: [split/prtlight.js, split/remoteprint.js]
specs: []
tests: [P217, P246, P247]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Printing at the office
Settings → Connections → **Office printer** (`remoteprint.js`, P217; owner, 14 Oct 2026: *"Let's add a remote print option for invoices
and anything else that is printed"*, the office's Brother laser on the office Wi-Fi). A page served from github.io cannot reach a printer
on the office network (no https page may send to a 192.168… address, and a browser has no raw socket), so a print goes through the sync
repository:
- **A job** is the print view's body as previewed, its title, who sent it and the build, written as one file `print-queue/<time>-<id>.json`
  beside the sync file (`prtSend`), by **Send to office** on every preview once the section is on. The same token and the same rule as a
  push: a device without sync, or one the guard keeps from syncing, is told why and sends nothing. ID cards take their numbers when sent.
- **The print station** is one device, marked on that device only (`sep_inv_print_station`, never in the book): while the app is open
  there it reads the queue every 15 seconds (and when it comes into view), draws the oldest job in the print view, prints it and deletes
  its file (`prtStationTick`); nothing is printed over a preview open on it. The job's HTML is cleaned first (`prtClean`: no script,
  frame, form, control, style or handler survives). With Chrome's or Edge's `--kiosk-printing` it prints to the default printer with no
  dialog; without it each job opens the dialog.
- **The sender learns it printed** when the job's file is gone (`prtSentCheck`, every 20 seconds while one waits): a Created invoice is
  then marked Printed on the sending device, as Print marks it. A waiting job is cancelled from the section (its file deleted). Over
  three minutes waiting says *is the station on?*. Two commits a job, and the station's check-in below.
- **The printer's details are the book's** (`S.printer`: on, name, address on the Wi-Fi, cartridge; a config in the change log and the
  merge), typed by the owner: nothing about the shop is in the build. A toast raised over the preview shows above it
  (`--z-over-print`; it had sat under the print view); a dialog left open under a preview (a credit note's form) stays under it.
- ⚠ **Not tried on the printer**: the specs fake GitHub and stub `window.print`. The owner's first job from a phone to the station is
  the check that counts. A minimised station window on a locked, signed-in PC still prints (the owner, 15 Oct 2026).

**The print station's light** (`prtlight.js`, P246; owner, 28 Oct 2026: *"need a blinking light (notification) on the home screen hero
card, to show if the kiosk printer machine is connected and online. If it's not connected, it should show red light or amber, depends,
and when it was last active"*; drawn on a canvas, passed through a design pass, then *"1 and 2 - your recommendation / 3 - needs a fail
safe, just to be sure, if someone is updating on the kiosk then auto-reload should not happen without the work being saved"*):
- **The station checks in** every 10 minutes while the app is open on it (`prtBeat`, remoteprint.js, on each look at the queue):
  `print-status.json` beside the sync file, its time, build, device and last print, **on a branch of its own, `print-status`**, made from
  the sync branch's head where it is missing (`POST git/refs`) and moved back onto it, forced, at the first check-in of a month (`PATCH`),
  so it never touches the sync branch and holds a month of commits at most. A write that finds the file moved (a second station) reads it
  again and writes once more; a failure tries again a minute later. **A site the sync repository deploys must leave that branch out**:
  soma-internal's `web/vercel.json` does (`git.deploymentEnabled`), read from the pushed commit, which is why the branch starts from the
  sync branch's head and never as an orphan.
- **The light** is read every 2 minutes while Home shows (the check-in, raw, and the queue; `prtLightRead`, kept on the device as
  `sep_inv_prt_light`, never the book) and worked out each time it is drawn (`prtLightState`, pure): **on** (green: checked in within 15
  minutes), **waiting** (amber: a job over 3 minutes), **old** (amber: its build behind the one published, read again with each look,
  `liveBuildRead`, init.js), **stuck** (red: seen, but a job waiting over 10 minutes in the shift: its print dialog waiting on a click, or
  the printer), **unseen** (amber: not seen in the general shift, counted from the shift's start), **down** (red: unseen an hour, or unseen
  with a job over 10 minutes), **off** (grey outside the shift or on a day the plant is shut, amber with a job waiting, never
  red), **never** (grey, amber with a job), **offline** or GitHub not answering (grey: it cannot check, never the last colour it saw). The
  owner's and the office's (`prtLightSees`), while the office printer is on and this device syncs.
- **On the masthead** (today.js): one of its facts, a dot and its words (DR-8), its words a bare button (`inv-mast-fact`) that opens the
  station's dialog. **Red with a job waiting leads**, after money in danger and before the red move (*See the job*, `data-home-lead=
  "station"`); amber leads only where nothing else does; on or off never leads. A red task on Needs you, `prtStation` (need `office`:
  `todoSees` gives it to the owner and the office alone), opens the dialog. **Only red moves**: the lamp's dot blinks once a second
  (`inv-blink`, `--dur-blink`) until the dialog is opened (`sep_inv_prt_ack` keeps the red it was opened on) and again when it gets worse
  (a job more, another hour unseen); never for reduced motion.
- **Its dialog** (`prtLightDialogInner`): now, last seen and from where, last printed, the build; the jobs waiting by title and wait,
  each with **Cancel**; **Print it here** / **Print the 3 here**: oldest first, each job taken off the queue (deleted) before its preview
  opens, so the station never prints it too; closing the preview asks *Did it print?*, and **Put it back** writes it back under its own
  name, keeping its place. A job printed here marks no invoice Printed (`_printInvId` cleared).
- **A job opens only where its document could** (owner, 28 Oct 2026, on Castor's finding that an Office ID's *Print it here* opened a
  pay slip's wages: *"That's definitely not acceptable"*). Every preview says what its document needs (`printNeed`, print.js: the pages
  its own screen is on, and wages, money, a permission or the owner, the same gate as that screen), `prtSend` keeps it on the job
  (`need`), and **Cancel** and **Print it here** reach a job only for an ID whose screens open the same document (`prtJobOpens`,
  prtlight.js). Another's job is listed as *A document your ID doesn’t open*, with nothing to do, and stays on the queue for the station;
  a job sent before jobs said so is the owner's. The station prints every job, as before: the paper comes out at the office either way.
  P247 holds it, and reads every function that opens the print view for its need. The Governors' reads of the same day added four rules:
  - **A need this build cannot read is refused** (a key it does not know, pages that are not a list), so a newer build's job never opens
    on a device with this check; a build from before it opens every job, so the gate holds only on devices that have loaded it. **A report of the period still running lists the
    sender's own tasks, so only the owner opens it from the queue** (`rptPrint`: each task follows its own need, which no flag on the
    job carries whole); a past period's needs its page alone. **A pay slip needs money where it shows the bank's
    legs** (`paySeesBank`), and **the office QR's sheet is the owner's**: it carries the check-in key.
  - **A run of *Print it here* is the ID's that started it** (`_prtHere.by`): another ID signing in mid-run, over the preview, over
    *Did it print?* or while the queue is read, is asked nothing and has nothing more read or taken for it, and the job on screen
    goes back on the queue unshown (`prtHereReturn`: under its own name, tried again each minute for half an hour, then said). **A
    job put back is not taken again in the same run** (`_prtHere.back`): the run moves on to the next.
  - **A closed preview leaves the page empty** (`closePrintPreview` clears `#invPrintBody`): hidden is not gone, and a preview closed when
    another ID signs in had stayed in the page, a pay slip's wages among it.
  - **A report, the power case or the planner's report redrawn on a save passes a job from the queue by** (`prtHereShowing`): it had
    drawn this device's own document over the one taken off the queue.
- **Send to office asks first** where the station is not on (waiting, stuck, unseen, down, off, never: `PRT_ASK_STATES`), over the preview
  (`uiConfirm`'s `altLabel` and `overPrint`): **Print here** prints on this device (a Created invoice marked Printed), **Send anyway**
  sends as before, × sends nothing. On, old, or not known (offline), it sends without asking.
- **The station reloads itself to a new build, only when nothing would be lost** (`prtReloadMaybe`, on each look at the queue): never
  while printing, a preview or any dialog is open, a form holds typed work (`_pageTyped`), a challan or an invoice on Create is started,
  Home is being arranged, a save is queued or the last failed, a push to GitHub waits, or within 5 minutes of anybody touching it. **The
  one exception to "an open app is never reloaded for a build"** (Offline, below), and only on the station; its banner says so, and its
  Settings says what holds it.
- ⚠ **Not tried on the office computer**: the specs fake GitHub at the route layer (`prt-github-fixture.ts`). The owner's first look at the
  light with the station on is the check that counts.
