/* ===== THE PRINT STATION'S LIGHT =====
   Owner, 28 Oct 2026: "need a blinking light (notification) on the home screen hero card, to show if the kiosk printer machine is
   connected and online. If it's not connected, it should show red light or amber, depends, and when it was last active." Drawn on a
   canvas, passed through a design pass and ruled the same day ("1 and 2 - your recommendation"):
   - one of Home's masthead facts on both layouts, a dot and its words (DR-8), its tap the station's dialog (prtLightOpen);
   - red with a job waiting leads the masthead, after money in danger and before the red move (today.js homeMastLead), and is a red
     task on Needs you (prtStation);
   - only red moves: it blinks until it is opened, and again when it gets worse (a job more, or another hour unseen); never for
     anyone set to reduce motion (styles.css inv-blink, --dur-blink);
   - shown to the owner and the office, while the office printer is on and this device syncs (prtLightSees).
   The station checks in every 10 minutes (remoteprint.js prtBeat). This device reads that and the queue every 2 minutes while Home
   shows (prtLightRead), keeps the last read on the device (`sep_inv_prt_light`, never the book), and works the state out each time
   it is drawn (prtLightState: pure, for the specs). Offline, it says it cannot check: never the last colour it saw. */

var PRT_LIGHT_KEY = 'sep_inv_prt_light';
var PRT_ACK_KEY = 'sep_inv_prt_ack';
var PRT_READ_MS = 2 * 60000;      // the light reads the check-in and the queue this often while Home shows
var PRT_SEEN_MIN = 15;            // checked in within this many minutes: on
var PRT_DOWN_MIN = 60;            // in the shift and unseen past this: red
var PRT_WAIT_MIN = 3;             // a job waiting past this: amber
var PRT_STUCK_MIN = 10;           // a job waiting past this in the shift: red
var PRT_STATE_WORD = { on: 'On', waiting: 'Jobs waiting', stuck: 'Jobs stuck', unseen: 'Not seen', down: 'Not seen', off: 'Off', old: 'On an old build',
  never: 'Not seen yet', offline: 'Can’t check', error: 'Can’t check' };

/* The device can read the light: the office printer on, and this device may sync (the job's road and the check-in's). */
function prtLightOn() { return !!S && prtCfg().on && !prtSendBlocked(); }
/* …and the one signed in is the owner or the office (with the guard off, everyone is the owner). */
function prtLightSees() {
  if (!prtLightOn()) return false;
  if (typeof grdOn !== 'function' || !grdOn()) return true;
  var u = grdUser();
  return !!u && (u.role === 'owner' || u.role === 'office');
}
/* The one signed in may open a waiting job on this device (owner, 28 Oct 2026, of an Office ID opening a pay slip's wages with Print
   it here: "That's definitely not acceptable"): its document is one their own screens open. The job says what that takes
   (print.js printNeed, kept by prtSend): the pages its screen is on, and wages, money, a permission or the owner. A job that does
   not say (sent by a build before jobs did) is the owner's. With the guard off everyone is the owner. */
var PRT_NEED_KEYS = { pages: 1, wages: 1, money: 1, may: 1, owner: 1 };
function prtJobOpens(need) {
  if (typeof grdOn !== 'function' || !grdOn()) return true;
  var u = grdUser();
  if (!u) return false;
  if (u.role === 'owner') return true;
  if (!need || typeof need !== 'object' || need.owner) return false;
  // A need this build cannot read (a key a later build added, pages not a list) is refused: a device on an older build never
  // opens what it cannot judge (Castor L-3 on #162).
  if (Object.keys(need).some(function(k) { return !PRT_NEED_KEYS[k]; }) || (need.pages != null && !Array.isArray(need.pages))) return false;
  if ((need.pages || []).some(function(p) { return !grdSees(p); })) return false;
  if (need.wages && !grdSeesWages()) return false;
  if (need.money && !grdSeesMoney()) return false;
  if (need.may && !grdCan(need.may)) return false;
  return true;
}
function prtLightLoad() { var r = loadJSON(PRT_LIGHT_KEY, null); return r && typeof r === 'object' ? r : null; }
function prtLightKeep(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* the device's own, a read again restores it */ } }
/* A job's own time is its id's first 14 digits (prtSend writes them in UTC). */
function prtJobAt(id) {
  var m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(String(id || ''));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

var _prtLightBusy = null;
/* Reads the station's check-in and the jobs waiting, keeps them on the device and says so (`sep-prt-light`: the masthead and an open
   dialog are drawn again). At most every PRT_READ_MS unless forced; never offline. Resolves to the read. */
function prtLightRead(force) {
  if (!prtLightOn()) return Promise.resolve(null);
  var last = prtLightLoad();
  if (!force && last && Date.now() - last.at < PRT_READ_MS) return Promise.resolve(last);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(last);
  if (_prtLightBusy) return _prtLightBusy;
  var cfg = getGhConfig();
  _prtLightBusy = (async function() {
    var rec;
    if (typeof liveBuildRead === 'function') await liveBuildRead();
    try {
      var status = null, never = false;
      try {
        status = JSON.parse(await ghRequest(prtStatusUrl(cfg) + '?ref=' + encodeURIComponent(PRT_STATUS_BRANCH), { raw: true }));
        if (!status || status.kind !== 'sep-print-status' || !(status.at > 0)) { status = null; never = true; }
      } catch (e) { if (e.status === 404 || e instanceof SyntaxError) never = true; else throw e; }
      var jobs = (await prtList(cfg)).map(function(j) { return { id: j.id, at: prtJobAt(j.id) }; });
      rec = { at: Date.now(), ok: true, never: never, jobs: jobs,
        status: status ? { at: status.at, build: status.build || '', lastPrinted: status.lastPrinted || null, device: String(status.device || '').slice(0, 80) } : null };
    } catch (e) {
      rec = { at: Date.now(), ok: false, err: e.message || String(e) };
    }
    prtLightKeep(PRT_LIGHT_KEY, rec);
    document.dispatchEvent(new CustomEvent('sep-prt-light'));
    return rec;
  })();
  _prtLightBusy.then(function() { _prtLightBusy = null; }, function() { _prtLightBusy = null; });
  return _prtLightBusy;
}
/* Asked when Home is drawn and on its minute tick (today.js homeClockStart): read again once the last read is PRT_READ_MS old. */
function prtLightAsk() { if (prtLightSees() && !document.hidden) prtLightRead(false).catch(function() {}); }

/* When it was, said short: 4:22 PM today, yesterday 6:10 PM, Sat 6:10 PM within the week, else the day. */
function prtWhenSaid(ts, now) {
  var d = new Date(ts), n = now || new Date(), t = homeClockMin(d.getHours() * 60 + d.getMinutes());
  var days = isoDaysBetween(isoOf(d), isoOf(n));
  if (days <= 0) return t;
  if (days === 1) return 'yesterday ' + t;
  if (days < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' }) + ' ' + t;
  return stockShortDate(isoOf(d));
}
/* A count and its noun never part at a line's end (no-break spaces). */
function prtJobsSaid(n) { return n + ' ' + (n === 1 ? 'job' : 'jobs') + ' waiting'; }
function prtMinSaid(m) { return m < 60 ? Math.max(1, Math.round(m)) + ' min' : homeClockSpan(Math.round(m)); }

/* The light, worked out: {state, tone, text, lead, jobs, oldest (minutes), seenAt, sig}, or null before anything was read.
   `r` the last read; `ctx` {now (a Date), online, live (the build published), shift ({start, end} in minutes; null on a day the
   plant does not work)}. Pure.
   - on: checked in within PRT_SEEN_MIN, nothing waiting past PRT_WAIT_MIN (green);
   - waiting: on, a job waiting past PRT_WAIT_MIN (amber); `stuck` past PRT_STUCK_MIN in the shift (red): seen, but not printing (the
     station's print dialog waiting on a click, without kiosk printing, or the printer itself);
   - old: on, its build behind the one published (amber; it reloads itself, remoteprint.js);
   - unseen / down: in the shift and not seen, amber, red once unseen in the shift past PRT_DOWN_MIN or a job waits past
     PRT_STUCK_MIN;
   - off: outside the shift or on a day the plant is shut, grey, amber with a job waiting, never red;
   - never: no station has checked in (grey, amber with a job waiting); offline and error: grey, it cannot check. */
function prtLightState(r, ctx) {
  var now = ctx.now, t = now.getTime();
  if (ctx.online === false) return { state: 'offline', tone: 'neutral', text: 'Print station: can’t check offline', jobs: 0, lead: false, sig: '' };
  if (!r) return null;
  if (!r.ok) return { state: 'error', tone: 'neutral', text: 'Print station: can’t check', err: r.err || '', jobs: 0, lead: false, sig: '' };
  var jobs = (r.jobs || []).filter(function(j) { return j && j.at > 0; });
  var n = jobs.length, oldest = n ? (t - Math.min.apply(null, jobs.map(function(j) { return j.at; }))) / 60000 : 0;
  var jobsSaid = n ? ' · ' + prtJobsSaid(n) : '';
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var inShift = !!ctx.shift && nowMin >= ctx.shift.start && nowMin < ctx.shift.end;
  var out = { jobs: n, oldest: oldest };
  if (r.never || !r.status) {
    out.state = 'never'; out.tone = n ? 'warning' : 'neutral'; out.text = 'Print station not seen yet' + jobsSaid;
  } else {
    var seen = r.status.at, since = (t - seen) / 60000;
    out.seenAt = seen;
    if (since <= PRT_SEEN_MIN) {
      if (n && oldest > PRT_WAIT_MIN) {
        var stuck = inShift && oldest > PRT_STUCK_MIN;
        out.state = stuck ? 'stuck' : 'waiting'; out.tone = stuck ? 'danger' : 'warning';
        out.text = 'Print station on · ' + prtJobsSaid(n) + (n === 1 ? ' ' : ', the oldest ') + prtMinSaid(oldest);
      } else if (ctx.live && r.status.build && r.status.build !== ctx.live) {
        out.state = 'old'; out.tone = 'warning'; out.text = 'Print station on an old build';
      } else {
        out.state = 'on'; out.tone = 'ok'; out.text = 'Print station on · seen ' + prtWhenSaid(seen, now);
      }
    } else if (inShift) {
      var start = new Date(now); start.setHours(0, ctx.shift.start, 0, 0);
      var unseen = (t - Math.max(seen, start.getTime())) / 60000, red = unseen > PRT_DOWN_MIN || (n > 0 && oldest > PRT_STUCK_MIN);
      out.state = red ? 'down' : 'unseen'; out.tone = red ? 'danger' : 'warning';
      out.text = 'Print station not seen since ' + prtWhenSaid(seen, now) + jobsSaid;
    } else {
      out.state = 'off'; out.tone = n ? 'warning' : 'neutral'; out.text = 'Print station off since ' + prtWhenSaid(seen, now) + jobsSaid;
    }
  }
  out.lead = out.tone === 'danger' && n > 0;
  // What a blink is acknowledged against: red, its jobs, its last check-in and the hours since it (another hour unseen is worse).
  out.sig = out.tone === 'danger' ? ['red', n, out.seenAt || 0, out.seenAt ? Math.floor((t - out.seenAt) / 3600000) : 0].join('|') : '';
  return out;
}
/* The light on this device now (the role aside: the To-do's rule reads it for the book's list, todo.js filters who sees it). */
function prtLightStateNow(now) {
  if (!prtLightOn()) return null;
  var d = now || new Date(), off = typeof homeDayOff === 'function' && homeDayOff(d);
  var shift = off ? null : { start: typeof RELAY_GENERAL !== 'undefined' ? RELAY_GENERAL : 510, end: typeof RELAY_GENERAL_OUT !== 'undefined' ? RELAY_GENERAL_OUT : 1020 };
  var st = prtLightState(prtLightLoad(), { now: d, online: typeof navigator === 'undefined' || navigator.onLine !== false,
    live: typeof _liveBuild !== 'undefined' ? _liveBuild : '', shift: shift });
  if (st) st.blink = !!st.sig && st.sig !== loadJSON(PRT_ACK_KEY, '');
  return st;
}
function prtLightNow(now) { return prtLightSees() ? prtLightStateNow(now) : null; }
/* A reading fresh enough to ask on (Send to office): the last if under a minute old, else one more, waited for up to 6 seconds. */
async function prtLightFresh() {
  if (!prtLightSees()) return null;
  var last = prtLightLoad();
  if (!last || Date.now() - last.at > 60000) {
    await Promise.race([prtLightRead(true).catch(function() {}), new Promise(function(res) { setTimeout(res, 6000); })]);
  }
  return prtLightNow();
}

/* ---- On the masthead (today.js) ---- */
/* The light as one of the masthead's facts: {tone, text, station, lead, blink, jobs}; null where it is not drawn. */
function prtLightFact() {
  var st = prtLightNow();
  return st ? { tone: st.tone, text: st.text, station: true, lead: st.lead, blink: st.blink, jobs: st.jobs } : null;
}
function prtLightFactHtml(f) {
  return '<li class="inv-dot inv-dot-' + uiTone(f.tone) + (f.blink ? ' inv-blink' : '') + '" data-prt-light="' + escHtml(uiTone(f.tone)) + '">' +
    '<button type="button" class="inv-mast-fact" data-action="invPrtLight" title="Open the print station">' + escHtml(f.text) + '</button></li>';
}
/* The masthead and an open station dialog drawn again (a read landed, a blink acknowledged). With the dialog open, what it shows
   is being looked at: that red is acknowledged too, so the lamp does not start again behind it. */
function prtLightRedraw() {
  var d = document.querySelector('[data-prt-dialog]');
  if (d && d.isConnected) prtLightAck();
  if (typeof homeDayRefresh === 'function') homeDayRefresh();
  if (typeof wsUpdateCounts === 'function') wsUpdateCounts();
  if (d && d.isConnected) d.outerHTML = prtLightDialogInner();
}
function prtLightAck() { var st = prtLightNow(); if (st && st.sig) prtLightKeep(PRT_ACK_KEY, st.sig); }
document.addEventListener('sep-prt-light', prtLightRedraw);
// Offline the light says it cannot check, and back online it reads again: each at once, not at the next minute's tick.
window.addEventListener('offline', function() { if (S) prtLightRedraw(); });
window.addEventListener('online', function() { if (S) { prtLightRedraw(); prtLightAsk(); } });

/* ---- The station's dialog ---- */
var _prtLightJobs = {};   // each waiting job's title, sender and need, read once for the dialog
/* A waiting job this ID may open here: any, for the owner; for another ID, one read and fitting (prtJobOpens). */
function prtJobMine(id) {
  var info = _prtLightJobs[id];
  return prtJobOpens(info && info.read ? info.need : null);
}
function prtLightOpen() {
  // Opened: the blink holds steady until the light gets worse.
  prtLightAck();
  prtLightRedraw();
  dialogOpen(prtLightDialogInner(), { dismiss: true });
  prtLightRead(true).then(prtLightTitles).then(function() {
    var d = document.querySelector('[data-prt-dialog]');
    if (d && d.isConnected) d.outerHTML = prtLightDialogInner();
  }).catch(function() {});
}
async function prtLightTitles(r) {
  if (!r || !r.ok) return;
  var cfg = getGhConfig();
  for (var i = 0; i < (r.jobs || []).length && i < 8; i++) {
    var j = r.jobs[i];
    if (_prtLightJobs[j.id]) continue;
    try {
      var d = JSON.parse(await ghRequest(prtJobUrl(cfg, j.id) + '?ref=' + encodeURIComponent(cfg.branch), { raw: true }));
      _prtLightJobs[j.id] = { title: String(d.title || '').slice(0, 120), sentBy: String(d.sentBy || '').slice(0, 80), need: d.need || null, read: true };
    } catch (e) { _prtLightJobs[j.id] = { title: '', sentBy: '' }; }
  }
}
function prtAgoSaid(ts) { var m = (Date.now() - ts) / 60000; return m < 1 ? 'just now' : prtMinSaid(m) + ' ago'; }
function prtLightDialogInner() {
  var st = prtLightNow(), r = prtLightLoad(), s = r && r.ok ? r.status : null, live = typeof _liveBuild !== 'undefined' ? _liveBuild : '';
  var rows = [];
  if (st) rows.push(uiFactRowHtml({ label: 'Now', value: PRT_STATE_WORD[st.state] || '', tone: st.tone === 'neutral' ? '' : st.tone,
    sub: st.state === 'error' ? 'GitHub did not answer: ' + String(st.err || '').slice(0, 80) : st.state === 'offline' ? 'This device is offline' : '', attrs: ' data-prt-now="' + escHtml(st.state) + '"' }));
  rows.push(uiFactRowHtml({ label: 'Last seen', value: s ? prtWhenSaid(s.at) : 'Never', sub: s ? prtAgoSaid(s.at) + (s.device ? ' · ' + s.device : '') : 'No station has checked in yet' }));
  rows.push(uiFactRowHtml({ label: 'Last printed', value: s && s.lastPrinted ? prtWhenSaid(s.lastPrinted) : null }));
  if (s) {
    var old = !!(live && s.build && s.build !== live);
    rows.push(uiFactRowHtml({ label: 'Build', value: !s.build || !live ? 'Not known' : old ? 'Old' : 'Current', tone: old ? 'warning' : s.build && live ? 'ok' : '',
      sub: old ? 'It reloads itself once nothing is typed or printing' : '', attrs: s.build ? ' title="' + escHtml(s.build) + '"' : '' }));
  }
  var jobs = r && r.ok ? (r.jobs || []) : [];
  var mine = jobs.filter(function(j) { return prtJobMine(j.id); }).length;
  var list = '';
  if (jobs.length) {
    list = '<div class="inv-field-label inv-mt-8">Waiting · ' + jobs.length + '</div>' + jobs.map(function(j) {
      var info = _prtLightJobs[j.id] || {}, m = j.at ? (Date.now() - j.at) / 60000 : 0, ours = prtJobMine(j.id);
      var tone = m > PRT_STUCK_MIN ? 'danger' : m > PRT_WAIT_MIN ? 'warning' : '';
      // A job this ID does not open: listed, so the count adds up, without its title; it stays on the queue for the station.
      var title = info.read && !ours ? 'A document your ID doesn’t open' : info.title || 'A job';
      return '<div class="inv-row inv-row-2" data-prt-job="' + escHtml(j.id) + '"' + (info.read && !ours ? ' data-prt-closed' : '') + '><span class="inv-row-main"><span class="inv-row-title"' + (info.sentBy ? ' title="' + escHtml('Sent from ' + info.sentBy) + '"' : '') + '>' +
        escHtml(title) + '</span><span class="inv-row-meta">' + escHtml(j.at ? 'Sent ' + prtWhenSaid(j.at) : 'Sent') + ' · ' +
        (tone ? '<span class="inv-fig-' + tone + '">' : '') + escHtml('waiting ' + prtMinSaid(m)) + (tone ? '</span>' : '') + '</span></span>' +
        (ours ? '<span class="inv-row-end"><button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPrtLightCancel" data-id="' + escHtml(j.id) + '">Cancel</button></span>' : '') + '</div>';
    }).join('');
  }
  return '<div class="inv-dialog" data-prt-dialog role="dialog" aria-modal="true" aria-labelledby="prtLightT">' +
    dialogHeadHtml('<span id="prtLightT">Print station</span>') +
    '<div class="inv-dialog-body">' + rows.join('') + list +
      '<p class="inv-note inv-mt-8">The station checks in every 10 minutes. It cannot see the printer’s paper or toner.</p></div>' +
    '<div class="inv-dialog-foot"><button type="button" class="inv-btn inv-btn-link" data-action="invPrtGuide">Setting up the printer</button>' +
      (mine ? '<button type="button" class="inv-btn inv-btn-primary" data-action="invPrtHere">' + escHtml(mine === 1 ? 'Print it here' : 'Print the ' + mine + ' here') + '</button>' : '') +
    '</div></div>';
}
/* A waiting job cancelled from the dialog: taken off the queue (remoteprint.js prtCancel), then the light read again. */
function prtLightCancel(id) {
  if (!prtJobMine(id)) return;   // drawn only for the jobs this ID opens; a stale button does nothing
  prtCancel(id).then(function() { return prtLightRead(true); }).catch(function(e) { showToast(e.message || String(e), 'error'); });
}

/* ---- The jobs printed here ----
   Each is taken off the queue before it prints, so the station never prints it too (a delete that finds it gone: the station had
   it first), and drawn in this device's preview, whose Print prints it. Closing that preview asks whether it printed: if not, it
   goes back on the queue under its own name, so it keeps its place. Then the next, oldest first. */
var _prtHere = null;   // {left: jobs still to take, job: {id, data} taken off the queue and not yet settled, skip, by: the ID that took them}
function prtHereWho() { return typeof grdUserId === 'function' ? grdUserId() : null; }
/* A job taken off the queue is in the preview: the redraws that keep a preview of this device's own document current pass it by
   (report.js, power.js, planview.js). */
function prtHereShowing() { return !!(_prtHere && _prtHere.job); }
function prtHereStart() {
  var r = prtLightLoad(), all = r && r.ok && r.jobs ? r.jobs : [], n = all.filter(function(j) { return prtJobMine(j.id); }).length;
  if (!n) { showToast(all.length ? 'Your ID doesn’t open the jobs waiting' : 'Nothing is waiting at the office', 'info'); return; }
  closeOverlay();
  _prtHere = { left: n, job: null, skip: {}, by: prtHereWho() };
  prtHereNext();
}
async function prtHereNext() {
  if (!_prtHere || _prtHere.left <= 0) { _prtHere = null; prtLightRead(true).catch(function() {}); return; }
  var cfg = getGhConfig(), job = null, data = null;
  try {
    var list = await prtList(cfg), left = 0;
    for (var i = 0; i < list.length && !job; i++) {
      if (_prtHere.skip[list[i].id]) { left++; continue; }
      var d = JSON.parse(await ghRequest(prtJobUrl(cfg, list[i].id) + '?ref=' + encodeURIComponent(cfg.branch), { raw: true }));
      if (!d || d.kind !== 'sep-print' || typeof d.html !== 'string') throw new Error('the job could not be read.');
      // A job whose document this ID does not open stays on the queue for the station: never drawn here (prtJobOpens).
      if (!prtJobOpens(d.need)) { _prtHere.skip[list[i].id] = true; left++; continue; }
      job = list[i]; data = d;
    }
    if (!job) {
      _prtHere = null;
      showToast(left ? 'The jobs left are not yours to open: they wait for the station' : 'Nothing is waiting now: the station took them', left ? 'info' : 'success');
      prtLightRead(true).catch(function() {});
      return;
    }
    await prtDelete(cfg, job, 'Taken to print on ' + prtSenderName() + ': ' + String(data.title || job.id).slice(0, 100));
  } catch (e) {
    _prtHere = null;
    var gone = e.status === 404 || e.status === 409;
    showToast(gone ? 'The station took it first: nothing to print here' : 'Couldn’t take the job off the queue: ' + (e.message || e), gone ? 'info' : 'error');
    prtLightRead(true).catch(function() {});
    return;
  }
  // Another ID signed in while the job was being taken: the run is not theirs, so the job goes back unshown.
  if (!_prtHere || _prtHere.by !== prtHereWho()) { _prtHere = null; prtHereReturn({ id: job.id, data: data }); return; }
  _prtHere.left--;
  _prtHere.job = { id: job.id, data: data };
  prtHereShow(_prtHere.job);
  prtLightRead(true).catch(function() {});
}
function prtHereShow(held) {
  // The one place a queued job is drawn: never for an ID it does not open (prtJobOpens). It goes back on the queue instead.
  if (!prtJobOpens(held.data.need)) { if (_prtHere) _prtHere.job = null; prtHereReturn(held); return; }
  var body = document.getElementById('invPrintBody'), view = document.getElementById('invPrintView');
  _printInvId = null;   // a job from the queue is no invoice of this preview's: its Print marks nothing Printed here
  printNeed(held.data.need);   // sent to the office again, it keeps what it needs
  body.innerHTML = prtClean(held.data.html);
  view.classList.add('inv-print-view-active');
  document.body.style.overflow = 'hidden';
  if (!document._savedTitle) document._savedTitle = document.title;
  document.title = String(held.data.title || 'Document');
  printFit();
}
/* The preview closed (print.js closePrintPreview): a job taken off the queue and not sent back asks whether it printed. */
function prtHereClosed() {
  if (!_prtHere) return;
  var held = _prtHere.job;
  _prtHere.job = null;
  // Another ID signed in over the run (guard.js grdAfterUser closes the preview): it is not asked about a job it may not open, and
  // the run does not go on for it. The held job goes back on the queue, unasked, under its own name (Castor H-1 on #162).
  if (_prtHere.by !== prtHereWho()) { _prtHere = null; if (held) prtHereReturn(held); return; }
  if (!held) { if (_prtHere.left > 0) prtHereNext(); else { _prtHere = null; prtLightRead(true).catch(function() {}); } return; }
  uiConfirm({ title: 'Did it print?', okLabel: 'It printed', cancelLabel: 'Put it back',
    body: String(held.data.title || 'The job') + ' came off the office queue to print here. If it did not print, put it back: the station prints it when it is on.' })
    .then(function(ok) {
      // Another ID signed in while it asked (grdAfterUser shuts the question): the job goes back unasked, and the run ends.
      if (_prtHere && _prtHere.by !== prtHereWho()) { _prtHere = null; prtHereReturn(held); return false; }
      return ok ? true : prtHereBack(held);
    })
    .then(function(go) {
      if (go === false) return;   // not put back: its preview is open again, held (or the run has ended)
      if (_prtHere && _prtHere.by === prtHereWho() && _prtHere.left > 0) prtHereNext(); else { _prtHere = null; prtLightRead(true).catch(function() {}); }
    });
}
/* A held job back on the queue with nothing asked or shown: where the write fails it waits a minute and tries again, held in memory
   and never drawn, for half an hour; then it says, without the job's title, that a job could not go back. */
function prtHereReturn(held, tries) {
  var cfg = getGhConfig(), n = tries || 0;
  ghRequest(prtJobUrl(cfg, held.id), { method: 'PUT', body: { message: 'Put back on the queue: ' + String(held.data.title || held.id).slice(0, 100),
    content: ghEncode(JSON.stringify(held.data)), branch: cfg.branch } })
    .then(function() { prtLightRead(true).catch(function() {}); })
    .catch(function() {
      if (n < 30) setTimeout(function() { prtHereReturn(held, n + 1); }, 60000);
      else showToast('A print job taken off the office queue could not go back on it. Its sender can send it again.', 'warning');
    });
}
/* Back on the queue under its own name; where that fails, its preview opens again, still held, to print or send. */
async function prtHereBack(held) {
  var cfg = getGhConfig();
  try {
    await ghRequest(prtJobUrl(cfg, held.id), { method: 'PUT', body: { message: 'Put back on the queue: ' + String(held.data.title || held.id).slice(0, 100),
      content: ghEncode(JSON.stringify(held.data)), branch: cfg.branch } });
    showToast('Put back on the queue: the station prints it when it is on', 'success');
    return true;
  } catch (e) {
    // Another ID signed in while it was being put back: not shown to them; held, and tried again.
    if (!_prtHere || _prtHere.by !== prtHereWho()) { _prtHere = null; prtHereReturn(held); return false; }
    showToast('Not put back: ' + (e.message || e) + ' Print it here, or send it to the office again.', 'error');
    _prtHere.job = held; prtHereShow(held);
    return false;
  }
}

/* ---- Needs you: the station not on while jobs wait (red) ---- */
TODO_RULES.push(['prtStation', 'The print station is not taking jobs while they wait']);
TODO_CHECK_DEFAULTS.prtStation = true;
TODO_RULE_NEED.prtStation = 'office';
TODO_RULE_FNS.prtStation = function() {
  var st = prtLightStateNow();
  if (!st || !st.lead) return [];
  return [{ key: 'prtStation', rule: 'prtStation', tone: 'red', title: 'Check the print station', sub: st.text,
    why: 'Print station · it checks in every 10 minutes',
    facts: [['Last seen', st.seenAt ? prtWhenSaid(st.seenAt) : 'never'], ['Waiting', prtJobsSaid(st.jobs)]],
    clears: 'Clears itself when the station takes the jobs, or they are printed here or cancelled.',
    go: { kind: 'prtLight' }, goLabel: 'See the jobs', sig: String(st.jobs) }];
};
