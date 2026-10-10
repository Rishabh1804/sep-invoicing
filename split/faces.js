/* ===== ENTRY FACES: EACH HAND ENTERS THEIR OWN (docs/ENTRY_FACES.md, step F1: the shell) =====
   Owner, 10 Oct 2026: "develop app faces for each employee to enter data … We have guard in place, they will all be using the
   phone app", and "Each their own phone, no one shares any screens. Attendance screen for [the clerk] and [the supervisor] will be
   different". So a face is set on a user (`users[].faces`, the duties they enter: Settings → Access → Users & access → Enters),
   never on a role, since two people of one role enter different things. Signing in opens it, and its door, Mine, comes first on
   their bar.

   One screen: the day (‹ today ›); its duties as steps, in, late or not yet as Today's inputs are (today.js tdyInput), each opening
   where the duty is entered on that day; what this person entered on it (the change log names who saved each record); their sheets
   to print; WhatsApp, so the group still gets its message while the floor changes over; and when their entries last reached
   GitHub. Each duty opens the form the app already has until its own form is on the face (F2–F4). Names are never in the build:
   the people are the book's. */

/* The duties a face can carry, in the day's order. `input` is Today's (TDY_INPUTS), whose state and usual time the step reads;
   `lines` are Production's lines the duty records; `page` is where it is entered until its own form is built. Each duty's paper is
   facesheet.js's (FSH_SHEETS). */
var FACE_DUTIES = [
  { id: 'roll-in', title: 'In-time roll', input: 'roll-in', page: 'pageFace' },
  // Entered on the face itself (F2): the face's own page is the door.
  { id: 'pickling', title: 'Pickling loads', input: 'pickling', page: 'pageFace' },
  { id: 'incoming', title: 'Material in', page: 'pageFace' },
  { id: 'stock', title: 'Stock', input: 'stock', page: 'pageStock' },
  { id: 'attsheet', title: 'Attendance sheet', page: 'pageStaff' },
  { id: 'barrel', title: 'Barrel batches', lines: ['barrel'], page: 'pageFace' },
  { id: 'vat', title: 'VAT register', lines: ['vat-a1', 'vat-a2'], page: 'pageFace' },
  { id: 'roll-out', title: 'Out-time roll', input: 'roll-out', page: 'pageFace' }
];
/* Today's inputs a duty fills, for "entered by" on Needs you (tdyInput). */
var FACE_INPUT_DUTIES = { 'roll-in': ['roll-in', 'attsheet'], 'roll-out': ['roll-out', 'attsheet'], pickling: ['pickling'], stock: ['stock'], production: ['barrel', 'vat'] };
var FACE_ENTERED_MAX = 30;   // what this person entered on the day, the latest first; the rest one tap away
var _faceDay = null;         // the day on the face; null is today
var _faceUid = null;         // the owner looking at another person's face (Settings → Users & access: See their screen)

function faceDuty(id) { return FACE_DUTIES.filter(function(d) { return d.id === id; })[0] || null; }
function faceDuties(u) {
  var ids = u && Array.isArray(u.faces) ? u.faces : [];
  return FACE_DUTIES.filter(function(d) { return ids.indexOf(d.id) >= 0; });
}
/* Whose face is shown: the person signed in, or the person the owner is looking at (the owner, or anyone with the guard off). */
function faceUser() {
  if (!S || typeof grdUser !== 'function') return null;
  var me = grdUser(), owner = !grdOn() || (!!me && me.role === 'owner');
  if (_faceUid && owner) { var u = grdUserById(_faceUid); if (u && faceDuties(u).length) return u; }
  return me;
}
function faceSees() { return faceDuties(faceUser()).length > 0; }
/* The Mine door is the signed-in person's own: never drawn for the owner looking at another's. */
function faceMineDoor() { return !!S && typeof grdUser === 'function' && faceDuties(grdUser()).length > 0; }
function faceDayIso() { var t = localDateStr(); return _faceDay && _faceDay < t ? _faceDay : t; }
function faceSetDay(d) { _faceDay = /^\d{4}-\d{2}-\d{2}$/.test(d || '') && d < localDateStr() ? d : null; }
function faceNavD() { var d = faceDayIso(); return d === localDateStr() ? '' : d; }

/* One duty on one day: its state (in · part · wait · late · off) and its line. Today's inputs are read as Today reads them. */
function faceStep(d, day) {
  if (d.input) {
    var def = TDY_INPUTS.filter(function(x) { return x.k === d.input; })[0];
    if (def) { var r = tdyInput(def, day); return { state: r.state, text: tdyStepMeta(r) }; }
  }
  if (d.lines) {
    var have = [], runs = 0;
    d.lines.forEach(function(l) { var n = prodDayLine(day, l).entries.length; if (n) { have.push(PROD_LINE_LABEL[l]); runs += n; } });
    // A register page typed on this phone and not saved: nothing is in the book yet, and the step says where it is.
    var typed = d.id === 'vat' ? FACE_VAT_LINES.filter(function(l) { return faceVatDrafts()[faceVatDraftKey(day, l)]; }).map(function(l) { return PROD_LINE_LABEL[l]; }) : [];
    var tail = typed.length ? ' · ' + typed.join(', ') + ' typed, not saved' : '';
    if (have.length === d.lines.length) return { state: 'in', text: todoPlural(runs, 'record') + tail };
    if (have.length) return { state: 'part', text: have.join(', ') + ' in' + tail };
    return { state: 'wait', text: typed.length ? typed.join(', ') + ' typed on this phone, not saved' : 'Not yet' };
  }
  if (d.id === 'attsheet') {
    var att = attDaySummary(day), differ = faceAttDiffs(day).length;
    return att.marked ? { state: 'in', text: (att.p + att.half) + ' on site, ' + att.absent.length + ' absent' + (differ ? ' · ' + differ + ' differ from the roll' : '') } : { state: 'wait', text: 'Not yet' };
  }
  if (d.id === 'incoming') {
    var ch = (S.incomingMaterial || []).filter(function(m) { return m && m.challanDate === day; }).length;
    var arr = prodData().entries.filter(function(e) { return e && e.kind === 'arrived' && e.date === day && !e.voidedAt; }).length;
    if (ch || arr) return { state: 'in', text: [ch ? todoPlural(ch, 'challan') : '', arr ? todoPlural(arr, 'arrival') : ''].filter(Boolean).join(', ') };
    return { state: 'wait', text: 'Not yet' };
  }
  return { state: 'wait', text: 'Not yet' };
}

/* What this person entered on the day, as the change log has it (changelog.js: every save names who and on which device):
   records added or changed, the latest first. A day is the day the save was made. */
function faceEntered(u, day) {
  if (!u || !S || !Array.isArray(S.changeLog)) return [];
  return S.changeLog.filter(function(e) {
    return e && e.by === u.id && (e.op === 'add' || e.op === 'change') && e.coll !== 'book' && e.at && isoOf(new Date(e.at)) === day;
  }).sort(function(a, b) { return b.at - a.at; });
}
/* Who of the people with a face entered one of Today's inputs on a day (Needs you's step says so): the change log's entries on the
   records that make the input, by a person whose face carries a duty that fills it. Nothing with the guard off. */
function faceInputBy(k, day) {
  var duties = FACE_INPUT_DUTIES[k];
  if (!duties || !S || !Array.isArray(S.changeLog) || typeof grdOn !== 'function' || !grdOn()) return [];
  var who = {};
  grdUsers().forEach(function(u) { if (u && faceDuties(u).some(function(d) { return duties.indexOf(d.id) >= 0; })) who[u.id] = u; });
  if (!Object.keys(who).length) return [];
  var coll = null, ids = {};
  if (k === 'roll-in' || k === 'roll-out') coll = 'attendance';
  else if (k === 'stock') {
    coll = 'stock.entries';
    stockData().entries.forEach(function(e) { if (e && e.date === day) ids[String(e.id)] = 1; });
  } else {
    coll = 'production.entries';
    prodData().entries.forEach(function(e) { if (e && e.date === day && (k === 'pickling' ? e.kind === 'pickled' : e.kind === 'plated')) ids[String(e.id)] = 1; });
  }
  var hit = function(e) {
    if (coll === 'attendance') return e.rid === day;
    if (e.rid != null && ids[String(e.rid)]) return true;
    return Array.isArray(e.rids) && e.rids.some(function(r) { return ids[String(r)]; });
  };
  var names = [];
  S.changeLog.forEach(function(e) {
    if (!e || e.coll !== coll || (e.op !== 'add' && e.op !== 'change') || !who[e.by] || !hit(e)) return;
    var n = who[e.by].name;
    if (names.indexOf(n) < 0) names.push(n);
  });
  return names;
}

/* ---------- The screen ---------- */
function renderFace() {
  var el = document.getElementById('faceContent');
  if (!el) return;
  // A form whose duty this face no longer carries (another person signed in, a duty taken off) is closed.
  if (_faceForm && !faceDuties(faceUser()).some(function(d) { return d.id === _faceForm.duty; })) _faceForm = null;
  if (_faceForm) { renderFaceForm(el); return; }
  el.innerHTML = faceHtml();
}
function faceHtml() {
  var u = faceUser(), duties = faceDuties(u), day = faceDayIso(), isToday = day === localDateStr();
  if (!u || !duties.length) {
    return '<div class="inv-panel"><div class="inv-empty">No duties are set for this ID. The owner sets what each person enters: Settings → Access → Users & access → Edit → Enters.</div></div>';
  }
  var me = grdUser(), seenAs = !me || me.id !== u.id;
  var steps = duties.map(function(d) { return { d: d, s: faceStep(d, day) }; });
  var n = steps.filter(function(x) { return x.s.state === 'in'; }).length;
  var done = steps.filter(function(x) { return x.s.state === 'in' || x.s.state === 'off'; }).length;
  var late = steps.filter(function(x) { return x.s.state === 'late'; });
  var next = late[0] || steps.filter(function(x) { return x.s.state !== 'in' && x.s.state !== 'off'; })[0];
  var stepsHtml = steps.map(function(x, i) {
    var st = x.s.state, can = typeof grdSees !== 'function' || grdSees(x.d.page);
    var node = st === 'in' ? TDY_CHECK_SVG : st === 'late' ? '!' : String(i + 1);
    var word = (TDY_STATE_DOT[st] || TDY_STATE_DOT.wait)[1];
    // A duty on a page this ID does not open (the owner's role switches) is said so, never a door that refuses.
    var meta = can ? x.s.text : x.s.text + ' · ' + grdPageName(x.d.page) + ' is not open to this ID';
    return '<div class="inv-step" data-face-duty="' + x.d.id + '" data-state="' + st + '">' +
      '<span class="inv-step-node" aria-hidden="true">' + node + '</span>' +
      (can ? '<button class="inv-step-main" data-action="invFaceOpen" data-duty="' + x.d.id + '" aria-label="' + escHtml(x.d.title + ': ' + word + ', ' + x.s.text) + '">' : '<span class="inv-step-main">') +
      '<span class="inv-step-title">' + escHtml(x.d.title) + '</span><span class="inv-step-meta">' + escHtml(meta) + '</span>' + (can ? '</button>' : '</span>') +
      '<span class="inv-row-end">' + (can && st !== 'in' && st !== 'off' ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFaceOpen" data-duty="' + x.d.id + '">Enter</button>' : '') + '</span></div>';
  }).join('');
  var meter = chartMeter(steps.map(function(x) { return { v: 1, tone: x.s.state === 'in' ? 'ok' : x.s.state === 'late' ? 'warning' : x.s.state === 'part' ? 'info' : 'neutral-2' }; }),
    { title: steps.map(function(x) { return x.d.title + ': ' + (TDY_STATE_DOT[x.s.state] || TDY_STATE_DOT.wait)[1]; }).join(' · ') });
  var sub = done === steps.length ? 'Everything you enter is in' : next ? next.d.title + ' ' + (next.s.state === 'late' ? 'is late' : next.s.text.charAt(0).toLowerCase() + next.s.text.slice(1)) : '';
  // The WhatsApp group still gets its message while the floor changes over (add.js).
  var wa = '<div class="inv-row inv-row-2 inv-row-flow" data-face-wa><span class="inv-row-main"><span class="inv-row-title">WhatsApp</span>' +
    '<span class="inv-row-meta inv-row-wrap">Send the group its message as before</span></span><span class="inv-row-end inv-row-actions">' + waLinksHtml('face') + '</span></div>';
  // The face is the person's screen: its card stays open (its steps are what the screen is for), never folded away.
  var hero = uiHeroHtml({ tone: late.length ? 'warning' : done === steps.length ? 'ok' : '',
    eyebrow: '<span>' + escHtml(seenAs ? u.name + '’s screen, as they see it' : u.name) + '</span><span class="inv-panel-count">' + escHtml(attDayName(day) + ' ' + formatDate(day)) + '</span>',
    title: '<span data-face-in>' + (n === steps.length ? 'All ' + n + ' in' : n + ' of ' + steps.length + ' in') + '</span>',
    fig: late.length ? escHtml(late.length + ' late') : '', sub: escHtml(sub), viz: meter, open: true,
    body: '<div class="inv-hero-sheet"><div class="inv-panel-body inv-steps" data-face-steps>' + stepsHtml + '</div>' + wa + '</div>',
    attrs: ' data-card="face" data-verdict id="faceVerdict"' });
  return faceStepperHtml(day, isToday) + hero + faceEnteredHtml(u, day) + faceToolsHtml(u, day);
}
/* ‹ the day › and back to today (Floor's stepper), never past today. */
function faceStepperHtml(day, isToday) {
  return '<div class="inv-toolbar inv-stepper" id="faceStepper">' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invFaceStep" data-step="-1" aria-label="Day before">' + STAFF_BACK_ICON + '</button>' +
    '<div class="inv-stepper-label"><input type="date" class="inv-input inv-id" id="faceDate" value="' + escHtml(day) + '" max="' + escHtml(localDateStr()) + '" aria-label="Day">' +
    '<span class="inv-stepper-sub">' + escHtml(attDayName(day) + (isToday ? ' · today' : '')) + '</span></div>' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invFaceStep" data-step="1" aria-label="Day after"' + (isToday ? ' disabled' : '') + '>' + STAFF_NEXT_ICON + '</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFaceToday"' + (isToday ? ' disabled' : '') + '>Today</button></div>';
}
/* What you entered on the day: each record a row, the latest first, what it is and when it was saved. A load or a count made on
   the face is drawn as itself (faceEntryRowHtml): what it says, its question where the data does not bear it out, its message for
   the group and its Correct. */
function faceEnteredHtml(u, day) {
  var list = faceEntered(u, day), idx = prodIndex(), shown = {}, rows = [];
  list.forEach(function(e) {
    if (e.coll === 'production.entries' && e.op === 'add') {
      var mine = (e.rids && e.rids.length ? e.rids : e.rid != null ? [e.rid] : []).map(function(id) { return idx.byId[id]; })
        .filter(function(x) { return x && x.src === 'face' && !shown[x.id]; });
      if (mine.length) { mine.forEach(function(x) { shown[x.id] = true; rows.push(faceEntryRowHtml(x)); }); return; }
    }
    var noun = chgNounOf(e.coll, e.n || 1), act = chgAct(e);
    var d = new Date(e.at), clock = relayClockLabel(d.getHours() * 60 + d.getMinutes());
    rows.push('<div class="inv-row inv-row-2" data-face-entered="' + escHtml(e.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(e.label || noun) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(act.charAt(0).toUpperCase() + act.slice(1) + (e.n ? '' : ' ' + noun)) + '</span></span><span class="inv-row-end inv-num">' + escHtml(clock) + '</span></div>');
  });
  var h = '<div class="inv-panel inv-panel-flush" id="faceEntered"><div class="inv-panel-head"><span class="inv-panel-title">What you entered <span class="inv-panel-count">' + rows.length + '</span></span></div>';
  if (!rows.length) return h + '<div class="inv-empty">Nothing yet on this day.</div></div>';
  return h + uiMoreHtml('face-entered', rows, { n: FACE_ENTERED_MAX, noun: 'entries' }) + '</div>';
}
/* The paper for the person's duties (facesheet.js, F5: the blank sheets, and the day as entered, to file), and whether their
   entries have reached GitHub: on the floor a phone is often offline, and what it saved goes when it is back (auto-push, merged). */
function faceToolsHtml(u, day) {
  var rows = fshFaceRowHtml(u, day);
  var sync = faceSyncState(u);
  rows += '<div class="inv-row inv-row-2" data-face-sync="' + sync.tone + '"><span class="inv-row-main"><span class="inv-row-title">Sent to GitHub</span><span class="inv-row-meta">' + escHtml(sync.text) + '</span></span>' +
    '<span class="inv-row-end">' + uiDot(sync.tone, escHtml(sync.word)) + '</span></div>';
  return '<div class="inv-panel inv-panel-flush" id="faceTools"><div class="inv-panel-head"><span class="inv-panel-title">Paper and backup</span></div>' + rows + '</div>';
}
/* This person's entries since this phone last sent the book: none waiting, some waiting, or the phone not set to send. */
function faceSyncState(u) {
  if (typeof ghIsConfigured !== 'function' || !ghIsConfigured()) return { tone: 'neutral', word: 'Not set', text: 'This phone does not send the book to GitHub: the owner sets it up' };
  var last = getGhConfig().lastPushAt || 0;
  var waiting = (Array.isArray(S.changeLog) ? S.changeLog : []).filter(function(e) { return e && e.by === u.id && e.at > last && (e.op === 'add' || e.op === 'change'); }).length;
  if (waiting) return { tone: 'warning', word: 'Waiting', text: todoPlural(waiting, 'entry', 'entries') + ' not sent yet · last sent ' + ghRelTime(last) + (navigator.onLine === false ? ' · this phone is offline' : '') };
  return { tone: 'ok', word: 'Sent', text: 'Last sent ' + ghRelTime(last) };
}

/* ---------- Where each duty is entered ---------- */
/* The form that enters it, on the day shown, until each duty's own form is on the face (F2–F4). */
function faceOpen(id) {
  var d = faceDuty(id), day = faceDayIso();
  if (!d) return;
  if (typeof grdSees === 'function' && !grdSees(d.page)) { showToast(grdPageName(d.page) + ' is not open to this ID', 'warning'); return; }
  // The pickling hand's forms (F2), the supervisor's (F3) and the register clerk's page (F4) are on the face itself.
  if (FACE_FORM_TITLE[id]) { faceFormOpen(id); return; }
  if (id === 'stock') {
    switchTab('pageStock');
    _stockManual = stockManualNew();
    _stockManual.date = day;
    stockSetView('manual');
    return;
  }
  // The rolls and the attendance sheet: People's day, as the board or, for the sheet, as the sheet.
  _attView = 'day'; _attDate = day; _attWeekStart = attWeekStartOf(day);
  if (id === 'attsheet') attDayAsSet('sheet');
  switchTab('pageStaff');
}
/* The owner looking at another person's screen, from Settings → Users & access: Settings closed first (it asks about anything
   unsaved), then the face, as theirs. */
async function faceSeeAs(id) {
  var u = grdUserById(id);
  if (!u || !faceDuties(u).length || !grdIsOwner()) return;
  if (document.getElementById('settingsScrim')) {
    await closeSettings();
    if (document.getElementById('settingsScrim')) return;
  }
  _faceUid = id;
  _faceDay = null;
  switchTab('pageFace');
}

/* ---------- Actions ---------- */
function faceAction(action, btn) {
  if (/^invFaceVat/.test(action)) return faceVatAction(action, btn);
  switch (action) {
    case 'invFaceOpen': faceOpen(btn.dataset.duty); return true;
    // A day stepped to is a place of its own (the address carries it); the page and the focus stay where they were.
    case 'invFaceStep': keepScroll(function() { faceSetDay(isoAddDays(faceDayIso(), +btn.dataset.step || 0)); renderFace(); }); return true;
    case 'invFaceToday': keepScroll(function() { _faceDay = null; renderFace(); }); return true;
    case 'invFacePrint': fshFacePrint(btn.dataset.kind); return true;
    case 'invFaceSee': faceSeeAs(btn.dataset.id); return true;
    case 'invFaceFormDone': faceFormDone(); return true;
    case 'invFaceSave': faceSave(); return true;
    case 'invFaceCopy': faceCopy(btn.dataset.id); return true;
    case 'invFaceCorrect': faceFormOpen(faceDutyOfEntry(btn.dataset.id), btn.dataset.id); return true;
    case 'invFaceCheckOk': faceCheckOk(btn.dataset.id, btn.dataset.code); return true;
    case 'invFaceCrew': faceRollEdit(function(f) { var b = f.blocks[+btn.dataset.i]; if (!b) return; var id = String(btn.dataset.id), j = b.crew.indexOf(id); if (j >= 0) b.crew.splice(j, 1); else b.crew.push(id); }); return true;
    case 'invFaceBlkAdd': faceRollEdit(function(f) { f.blocks.push(f.duty === 'roll-out' ? { from: '17:00', out: '20:00', areas: [], crew: [], extra: '', work: '' } : { areas: [], crew: [], extra: '', work: '' }); }); return true;
    case 'invFaceBlkArea': faceRollEdit(function(f) { var b = f.blocks[+btn.dataset.i]; if (!b) return; var a = btn.dataset.area; b.areas = b.areas || []; var j = b.areas.indexOf(a); if (j >= 0) b.areas.splice(j, 1); else b.areas.push(a); }); return true;
    case 'invFaceBlkDel': faceRollEdit(function(f) { f.blocks.splice(+btn.dataset.i, 1); }); return true;
    case 'invFaceUsual': faceRollEdit(function(f) { faceRollRoster(f.date).forEach(function(w) { var id = String(w.id); if (!f.place[id] && !faceMarkByHand(f.date, id)) { var sec = faceSectionOf(w.area); if (sec) f.place[id] = sec; } }); }); return true;
    // The rest: nobody placed and on no block (a hand on a 6 AM block is on site).
    case 'invFaceRestAbsent': faceRollEdit(function(f) {
      var on = {}; (f.blocks || []).forEach(function(b) { (b.crew || []).forEach(function(id) { on[id] = true; }); });
      faceRollRoster(f.date).forEach(function(w) { var id = String(w.id); if (!f.place[id] && !on[id] && !faceMarkByHand(f.date, id)) f.place[id] = 'absent'; });
    }); return true;
    case 'invFaceCopyRoll': faceRollCopy(btn.dataset.id); return true;
  }
  return false;
}
/* The form an entry is corrected on: a count of what came in on Material in, a load on Pickling loads. */
function faceDutyOfEntry(id) { var e = prodIndex().byId[id]; return !e ? 'pickling' : e.kind === 'arrived' ? 'incoming' : e.kind === 'plated' ? (e.pageId ? 'vat' : 'barrel') : 'pickling'; }
function faceOnChange(t) {
  if (!t) return false;
  if (t.id === 'faceDate') { faceSetDay(t.value); renderFace(); return true; }
  if (_faceForm && _faceForm.duty === 'vat' && t.dataset) return faceVatChange(t, true);
  var f = _faceForm;
  if (f && t.dataset && t.dataset.facePlace !== undefined) {
    var hand = t.dataset.facePlace;
    f.place[hand] = t.value;
    // Absent is off site, so off every block too: the roll would name the hand twice.
    if (t.value === 'absent') (f.blocks || []).forEach(function(b) { b.crew = (b.crew || []).filter(function(x) { return x !== hand; }); });
    _pageTyped = true; renderFace(); return true;
  }
  if (f && t.dataset && t.dataset.faceBlk !== undefined) { var b = f.blocks[+t.dataset.faceBlk]; if (b) { b[t.dataset.k] = t.value; _pageTyped = true; if (t.tagName === 'SELECT') renderFace(); } return true; }
  if (f && t.dataset && t.dataset.faceExtra !== undefined) { f.extra[t.dataset.faceExtra] = t.value; return true; }
  if (f && t.dataset && t.dataset.faceOut !== undefined) { (f.outAt = f.outAt || {})[t.dataset.faceOut] = t.value; _pageTyped = true; return true; }
  if (!f || !t.dataset || (t.dataset.faceF === undefined && t.dataset.faceCnt === undefined)) return false;
  if (t.dataset.faceCnt !== undefined) { f.counts[t.dataset.faceCnt] = t.value; return true; }
  var k = t.dataset.faceF;
  f[k] = t.type === 'checkbox' ? t.checked : t.value;
  // A pick changes what the form asks: the client's parts and challans, the part's unit and what is open on it.
  if (k === 'clientId') { f.part = ''; f.partText = ''; if (f.duty === 'incoming') { f.challan = ''; f.counts = {}; } }
  if (k === 'part') { var x = faceClientParts(f.clientId).find(function(p) { return p.key === f.part; }); if (x) f.unit = x.open.NOS > 0 ? 'NOS' : x.open.KG > 0 ? 'KG' : x.unit; }
  if (k === 'challan') f.counts = {};
  if (t.tagName === 'SELECT') renderFace();
  return true;
}
/* What is typed is held as typed, never redrawn under the cursor. */
function faceOnInput(t) {
  var f = _faceForm;
  if (!f || !t || !t.dataset || t.type === 'checkbox') return false;
  if (f.duty === 'vat') return t.tagName === 'SELECT' ? false : faceVatChange(t, false);
  if (t.dataset.faceBlk !== undefined && t.tagName !== 'SELECT') { var b = f.blocks[+t.dataset.faceBlk]; if (b) b[t.dataset.k] = t.value; return true; }
  if (t.dataset.faceExtra !== undefined) { f.extra[t.dataset.faceExtra] = t.value; return true; }
  if (t.dataset.faceCnt !== undefined) { f.counts[t.dataset.faceCnt] = t.value; return true; }
  if (t.dataset.faceF === undefined || t.tagName === 'SELECT') return false;
  f[t.dataset.faceF] = t.value;
  return true;
}

/* ---------- On a user (guard.js: the user form and the users list) ---------- */
/* The duties as tick boxes on a user's form: what this person enters, on their own screen. */
function faceTicksHtml(on) {
  var ids = Array.isArray(on) ? on : [];
  return '<div class="inv-field" data-grd-faces><span class="inv-field-label">Enters</span>' + FACE_DUTIES.map(function(d) {
    return '<label class="inv-field-check"><input type="checkbox" class="inv-check" data-grd-face="' + d.id + '"' + (ids.indexOf(d.id) >= 0 ? ' checked' : '') + '> ' + escHtml(d.title) + '</label>';
  }).join('') + '<div class="inv-field-hint">Their own screen, Mine, opens on these when they sign in. None ticked: they open on Today.</div></div>';
}
function faceTicksRead(root) {
  var on = {};
  (root || document).querySelectorAll('[data-grd-face]').forEach(function(el) { if (el.checked) on[el.getAttribute('data-grd-face')] = true; });
  return FACE_DUTIES.map(function(d) { return d.id; }).filter(function(id) { return on[id]; });
}
/* A user's duties in a line, for the users list. */
function faceDutiesText(u) { return faceDuties(u).map(function(d) { return d.title; }).join(', '); }

/* ---------- F2: the pickling hand's own forms (docs/ENTRY_FACES.md §2, F-pickling) ----------
   A load into the tank, and material counted in, are entered on the face itself: the pickling hand's role need not open
   Production or Challans, and the form is the job's (the client's parts with material open first, the time it went in now by
   default). A save is the record at once, the same record a paste of the same message makes (`src: 'face'`, `by` the person),
   and gives the message for the WhatsApp group in the shop's own shape: the group still hears it while the floor changes over,
   and that message pasted later is known by its key (`msgHash`, prodPasteSeen) and never read twice. The form stays open for the
   next entry, carrying the client and the time, and lists what was saved from it, each with Send to the group and Correct. */
var _faceForm = null;            // the form open on Mine: {duty, date, …}; null is the face itself
var FACE_FORM_TITLE = { pickling: 'A load into the tank', incoming: 'Material in' };
var FACE_TYPED = '__typed';      // the part list's "not listed: type its name"
var FACE_NOCHALLAN = '__none';   // the challan list's "not in the book yet"

function faceNowHhmm() { var d = new Date(); return relayHhmm(d.getHours() * 60 + d.getMinutes()); }
/* Who is entering: the person signed in (the owner looking at another's screen enters as the owner). */
function faceUserName() { var u = typeof grdUser === 'function' ? grdUser() : null; return (u && u.name) || stockBy() || ''; }
/* A form on the face's day, or a correction of an entry: the form on the entry as it stands. Saved, a correction takes its place
   (`replaces`) and the entry stays, marked corrected. */
function faceFormMake(duty, fromId) {
  var day = faceDayIso();
  if (duty === 'roll-in' || duty === 'roll-out') return faceRollMake(duty, day);
  // A run of a page is put right on its page: the page of its day and line (the face's day moves to it, so the address says it).
  if (duty === 'vat') { var run = fromId ? prodIndex().byId[fromId] : null; if (run && run.date) faceSetDay(run.date); return faceVatMake(faceDayIso(), run && run.line); }
  var f = { duty: duty, date: day, clientId: '', part: '', partText: '', qty: '', unit: 'NOS', time: day === localDateStr() ? faceNowHhmm() : '', rework: false, replaces: null, saved: [] };
  if (duty === 'incoming') { f.challan = ''; f.counts = {}; f.challanNo = ''; f.link = null; }
  if (duty === 'barrel') { f.barrel = ''; f.timeOut = ''; }
  var idx = prodIndex(), src = fromId ? idx.byId[fromId] : null;
  if (src && !src.voidedAt && !idx.replaced[src.id]) {
    f.replaces = src.id; f.date = src.date; f.clientId = src.clientId != null ? String(src.clientId) : '';
    var hit = faceClientParts(f.clientId).find(function(x) { return x.key === prodEntryKey(src); });
    if (hit) f.part = hit.key; else { f.part = FACE_TYPED; f.partText = src.part || ''; }
    f.qty = src.qty != null ? String(src.qty) : ''; f.unit = src.unit || 'NOS'; f.time = src.time || ''; f.rework = !!src.rework;
    if (duty === 'incoming') { f.challan = FACE_NOCHALLAN; f.challanNo = src.challanNo || ''; f.link = src.imItemId ? { imId: src.imId, imItemId: src.imItemId } : null; }
    if (duty === 'barrel') { f.barrel = src.unitId || src.barrel || ''; f.timeOut = src.to || ''; }
  }
  return f;
}
function faceFormOpen(duty, fromId) {
  if (!FACE_FORM_TITLE[duty]) return;
  _faceForm = faceFormMake(duty, fromId);
  _pageTyped = false;
  renderFace();
  viewTop();
}
function faceFormDone() { _faceForm = null; _pageTyped = false; renderFace(); viewTop(); }
/* An address naming a form (nav.js): the form on the face's day; a correction where it names this duty's entry made on a face.
   The page is drawn by the address's own step. */
function faceFormFromNav(v, id) {
  var parts = String(v || '').split('/'), duty = parts[0];
  if (!FACE_FORM_TITLE[duty] || !faceDuties(faceUser()).some(function(d) { return d.id === duty; })) { _faceForm = null; return; }
  // A register page is its day and line (vat/vat-a2); the page on screen stays as typed when the address is its own.
  if (duty === 'vat') {
    var line = FACE_VAT_LINES.indexOf(parts[1]) >= 0 ? parts[1] : null;
    if (_faceForm && _faceForm.duty === 'vat' && _faceForm.date === faceDayIso() && (!line || _faceForm.line === line)) return;
    _faceForm = faceVatMake(faceDayIso(), line);
    return;
  }
  if (_faceForm && _faceForm.duty === duty && (_faceForm.replaces || '') === (id || '')) return;
  var src = id ? prodIndex().byId[id] : null;
  _faceForm = faceFormMake(duty, src && src.src === 'face' && src.kind === ({ incoming: 'arrived', barrel: 'plated' }[duty] || 'pickled') ? src.id : null);
}

/* The clients, those with material open on a challan first: the work on the floor. */
function faceClientsSorted() {
  var open = {};
  (S.incomingMaterial || []).forEach(function(m) { if ((m.items || []).some(function(it) { return imLineOpen(it).qty > 0; })) open[String(m.clientId)] = true; });
  var list = (S.clients || []).filter(function(c) { return c && c.active !== false; }).slice().sort(function(a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
  return { open: list.filter(function(c) { return open[String(c.id)]; }), rest: list.filter(function(c) { return !open[String(c.id)]; }) };
}
/* A client's parts as its challans name them (the key a load and a challan line share, prodChallanKey), with what is open on
   them in the floor's unit (pieces where the challan counts them): open first, then by the latest challan. A year back, and
   anything still open. */
function faceClientParts(cid) {
  if (cid === '' || cid == null) return [];
  var since = isoAddDays(localDateStr(), -365), by = {};
  (S.incomingMaterial || []).forEach(function(m) {
    if (String(m.clientId) !== String(cid)) return;
    (m.items || []).forEach(function(it) {
      var part = String(it.partNumber || it.desc || '').trim(), o = imLineOpen(it);
      if (!part || ((m.challanDate || '') < since && !(o.qty > 0))) return;
      var k = prodChallanKey(m, it), x = by[k];
      if (!x) x = by[k] = { key: k, part: part, partNumber: String(it.partNumber || '').trim(), gauge: prodGaugeOf(it.partNumber, it.desc) || '', label: lineLabel(it) || part,
        open: { NOS: 0, KG: 0 }, challans: [], last: '', unit: 'NOS' };
      var nosLine = it.unit === 'NOS', hasNos = nosLine || it.nosQty > 0;
      if (o.qty > 0) {
        if (hasNos) x.open.NOS += nosLine ? o.qty : o.nos; else x.open.KG += o.qty;
        if (m.challanNo && x.challans.indexOf(m.challanNo) < 0) x.challans.push(m.challanNo);
      }
      if ((m.challanDate || '') >= x.last) { x.last = m.challanDate || ''; x.unit = hasNos ? 'NOS' : 'KG'; }
    });
  });
  var isOpen = function(x) { return x.open.NOS > 0 || x.open.KG > 0; };
  return Object.keys(by).map(function(k) { return by[k]; }).sort(function(a, b) {
    return (isOpen(b) - isOpen(a)) || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0) || a.label.localeCompare(b.label);
  });
}
function faceOpenText(x) {
  return [x.open.NOS > 0 ? Math.round(x.open.NOS).toLocaleString('en-IN') + ' NOS' : '', x.open.KG > 0 ? formatNum(x.open.KG, x.open.KG % 1 ? 1 : 0) + ' kg' : ''].filter(Boolean).join(' + ');
}

/* ---------- The forms ---------- */
function renderFaceForm(el) {
  var f = _faceForm, draw = { incoming: faceInHtml, 'roll-in': faceRollInHtml, 'roll-out': faceRollOutHtml, barrel: faceBarrelHtml, vat: faceVatHtml }[f.duty] || faceLoadHtml;
  el.innerHTML = draw(f);
}
function faceBackBar(title) {
  return '<div class="inv-pagehead"><button class="inv-btn inv-btn-ghost inv-btn-sm inv-pagehead-back" data-action="invFaceFormDone">' + STOCK_BACK_ICON + 'Mine</button>' +
    '<h2 class="inv-pagehead-title">' + escHtml(title) + '</h2></div>';
}
function faceField(id, label, input, hint) { return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + label + '</label>' + input + (hint || '') + '</div>'; }
function faceClientSelectHtml(f) {
  var cs = faceClientsSorted(), opt = function(c) { return '<option value="' + escHtml(String(c.id)) + '"' + (f.clientId === String(c.id) ? ' selected' : '') + '>' + escHtml(c.name) + '</option>'; };
  return faceField('faceClient', 'Client', '<select id="faceClient" class="inv-select" data-face-f="clientId"><option value="">Pick the client</option>' +
    (cs.open.length ? '<optgroup label="Material open">' + cs.open.map(opt).join('') + '</optgroup>' : '') +
    (cs.rest.length ? '<optgroup label="' + (cs.open.length ? 'Other clients' : 'Clients') + '">' + cs.rest.map(opt).join('') + '</optgroup>' : '') + '</select>');
}
function facePartFieldsHtml(f, parts) {
  var opt = function(x) { var o = faceOpenText(x); return '<option value="' + escHtml(x.key) + '"' + (f.part === x.key ? ' selected' : '') + '>' + escHtml(x.label + (o ? ' · ' + o + ' open' : '')) + '</option>'; };
  var open = parts.filter(function(x) { return x.open.NOS > 0 || x.open.KG > 0; }), rest = parts.filter(function(x) { return !(x.open.NOS > 0 || x.open.KG > 0); });
  var sel = '<select id="facePart" class="inv-select" data-face-f="part"' + (f.clientId ? '' : ' disabled') + '><option value="">' + (f.clientId ? 'Pick the part' : 'Pick the client first') + '</option>' +
    (open.length ? '<optgroup label="On a challan, open">' + open.map(opt).join('') + '</optgroup>' : '') +
    (rest.length ? '<optgroup label="Sent before">' + rest.map(opt).join('') + '</optgroup>' : '') +
    (f.clientId ? '<option value="' + FACE_TYPED + '"' + (f.part === FACE_TYPED ? ' selected' : '') + '>Not listed: type its name</option>' : '') + '</select>';
  var x = parts.find(function(p) { return p.key === f.part; }), hint = '';
  if (f.part === FACE_TYPED) hint = '<div class="inv-field-hint">Kept as written: the owner is asked which of the client’s parts it is.</div>';
  else if (x && faceOpenText(x)) hint = '<div class="inv-field-hint" data-face-open>' + escHtml('Open on challan' + (x.challans.length === 1 ? ' ' : 's ') + x.challans.slice(0, 3).join(', ') + ': ' + faceOpenText(x)) + '</div>';
  else if (x) hint = '<div class="inv-callout inv-callout-warning inv-mt-8" data-face-open="0">Nothing of it is open on a challan: the owner will be asked about it.</div>';
  var h = faceField('facePart', 'Part', sel, hint);
  if (f.part === FACE_TYPED) h += faceField('facePartText', 'Its name, as written', '<input id="facePartText" class="inv-input" data-face-f="partText" value="' + escHtml(f.partText) + '" autocomplete="off" placeholder="e.g. CLAMP 165X83 (40X6)">');
  return h;
}
function faceQtyFieldsHtml(f, label) {
  return faceField('faceQty', label || 'Quantity', '<input type="number" inputmode="decimal" step="any" min="0" id="faceQty" class="inv-input inv-input-num" data-face-f="qty" value="' + escHtml(f.qty) + '">') +
    faceField('faceUnit', 'Unit', '<select id="faceUnit" class="inv-select" data-face-f="unit"><option value="NOS"' + (f.unit !== 'KG' ? ' selected' : '') + '>Pieces (NOS)</option><option value="KG"' + (f.unit === 'KG' ? ' selected' : '') + '>Kilograms</option></select>');
}
function faceActionBarHtml(label, f) {
  return '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">' + escHtml(label) + '</div><div class="inv-actionbar-value">' + escHtml(stockShortDate(f.date)) + '</div></div>' +
    '<button class="inv-btn inv-btn-primary" data-action="invFaceSave">Save</button></div>';
}
/* A load into the tank. */
function faceLoadHtml(f) {
  var parts = faceClientParts(f.clientId);
  var h = faceBackBar(f.replaces ? 'Correct a load' : FACE_FORM_TITLE.pickling);
  if (f.replaces) h += '<div class="inv-callout inv-callout-info">This load takes the place of the one corrected, which stays on the record, marked corrected.</div>';
  h += '<div class="inv-panel" data-face-form="pickling"><div class="inv-fields">' + faceClientSelectHtml(f) + facePartFieldsHtml(f, parts) + faceQtyFieldsHtml(f) +
    faceField('faceTime', 'Into the tank at', '<input type="time" id="faceTime" class="inv-input" data-face-f="time" value="' + escHtml(f.time) + '">') +
    '<label class="inv-field-check"><input type="checkbox" class="inv-check" id="faceRework" data-face-f="rework"' + (f.rework ? ' checked' : '') + '><span>Re-pickling or rework (counted as work, never billed)</span></label>' +
    '</div></div>';
  return h + faceSavedHtml(f) + faceActionBarHtml(f.replaces ? 'Correcting the load of' : 'Pickled on', f);
}
/* Material in: a challan in the book counted line by line, or what came with no challan in the book yet. */
function faceInChallans(f) {
  if (!f.clientId) return [];
  var lo = isoAddDays(f.date, -7), hi = isoAddDays(f.date, 1);
  return (S.incomingMaterial || []).filter(function(m) { return String(m.clientId) === String(f.clientId) && (m.challanDate || '') >= lo && (m.challanDate || '') <= hi && (m.items || []).length; })
    .sort(function(a, b) { return (b.challanDate || '').localeCompare(a.challanDate || ''); });
}
/* A challan line's figure in the floor's unit: pieces where it counts them, else kilograms. */
function faceLineUnit(it) { return it.unit === 'NOS' || it.nosQty > 0 ? 'NOS' : 'KG'; }
function faceLineFigure(it, unit) {
  if (unit === 'NOS') return it.unit === 'NOS' ? Number(it.qty) || 0 : it.nosQty > 0 ? Number(it.nosQty) : null;
  return it.unit === 'KG' ? Number(it.qty) || 0 : null;
}
function faceInHtml(f) {
  var h = faceBackBar(f.replaces ? 'Correct what came in' : FACE_FORM_TITLE.incoming);
  if (f.replaces) h += '<div class="inv-callout inv-callout-info">This takes the place of the count corrected, which stays on the record, marked corrected.</div>';
  var chs = faceInChallans(f), counted = {};
  prodIndex().live.forEach(function(e) { if (e.kind === 'arrived' && e.imItemId && !prodIndex().replaced[e.id]) counted[e.imItemId] = true; });
  var fields = faceClientSelectHtml(f);
  if (!f.replaces) {
    fields += faceField('faceChallan', 'Challan', '<select id="faceChallan" class="inv-select" data-face-f="challan"' + (f.clientId ? '' : ' disabled') + '><option value="">' + (f.clientId ? 'Pick the challan' : 'Pick the client first') + '</option>' +
      chs.map(function(m) {
        var all = (m.items || []).every(function(it) { return counted[it.id]; });
        return '<option value="' + escHtml(m.id) + '"' + (f.challan === m.id ? ' selected' : '') + '>' + escHtml('Challan ' + (m.challanNo || 'with no number') + ' · ' + stockShortDate(m.challanDate) + ' · ' + todoPlural((m.items || []).length, 'line') + (all ? ' · counted' : '')) + '</option>';
      }).join('') + (f.clientId ? '<option value="' + FACE_NOCHALLAN + '"' + (f.challan === FACE_NOCHALLAN ? ' selected' : '') + '>Not in the book yet</option>' : '') + '</select>',
      f.clientId && !chs.length ? '<div class="inv-field-hint">No challan of theirs in the book from the week before: pick Not in the book yet.</div>' : '');
  }
  var m = !f.replaces && f.challan && f.challan !== FACE_NOCHALLAN ? chs.find(function(x) { return x.id === f.challan; }) : null;
  var lines = '';
  if (m) {
    // Each line counted against the challan's own figure, in the floor's unit; a line left blank is not counted.
    lines = '<div class="inv-panel inv-panel-flush" data-face-lines><div class="inv-panel-head"><span class="inv-panel-title">Counted <span class="inv-panel-count">' + (m.items || []).length + '</span></span></div>' +
      (m.items || []).map(function(it) {
        var u = faceLineUnit(it), want = faceLineFigure(it, u), id = 'faceCnt' + String(it.id).replace(/[^A-Za-z0-9_-]/g, '');
        return '<div class="inv-row inv-row-2 inv-row-flow" data-face-line="' + escHtml(it.id) + '"><span class="inv-row-main"><label class="inv-row-title" for="' + id + '">' + escHtml(lineLabel(it)) + '</label>' +
          '<span class="inv-row-meta">' + escHtml('The challan says ' + prodQtyText(want, u) + (counted[it.id] ? ' · counted before' : '')) + '</span></span>' +
          '<span class="inv-row-end"><input type="number" inputmode="decimal" step="any" min="0" id="' + id + '" class="inv-input inv-input-sm inv-input-num" data-face-cnt="' + escHtml(it.id) + '" value="' + escHtml((f.counts || {})[it.id] || '') + '" aria-label="' + escHtml('Counted, ' + (u === 'NOS' ? 'pieces' : 'kilograms')) + '"></span></div>';
      }).join('') + '</div>';
  } else if (f.replaces || f.challan === FACE_NOCHALLAN) {
    fields += faceField('faceChallanNo', 'Challan number, if written', '<input id="faceChallanNo" class="inv-input" data-face-f="challanNo" value="' + escHtml(f.challanNo) + '" autocomplete="off">') +
      facePartFieldsHtml(f, faceClientParts(f.clientId)) + faceQtyFieldsHtml(f, 'Counted');
  }
  fields += faceField('faceTime', 'Came in at', '<input type="time" id="faceTime" class="inv-input" data-face-f="time" value="' + escHtml(f.time) + '">');
  h += '<div class="inv-panel" data-face-form="incoming"><div class="inv-fields">' + fields + '</div></div>' + lines;
  return h + faceSavedHtml(f) + faceActionBarHtml(f.replaces ? 'Correcting what came in on' : 'Came in on', f);
}
/* What was saved from this form, newest first: each with its message for the group and its Correct. */
function faceSavedHtml(f) {
  var idx = prodIndex(), saved = (f.saved || []).map(function(id) { return idx.byId[id]; }).filter(Boolean);
  if (!saved.length) return '';
  return '<div class="inv-panel inv-panel-flush inv-mt-8" data-card="faceSaved"><div class="inv-panel-head"><span class="inv-panel-title">Saved from this form <span class="inv-panel-count">' + saved.length + '</span></span>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFaceFormDone">Done</button></div>' + saved.slice().reverse().map(faceEntryRowHtml).join('') + '</div>';
}
/* One entry a face made: what it is, its question where the data does not bear it out, and its message and Correct. */
function faceEntryRowHtml(e) {
  var idx = prodIndex(), checks = faceCheckOf(e), gone = !!(e.voidedAt || idx.replaced[e.id]), t = relayParseHhmm(e.time);
  var t2 = relayParseHhmm(e.to);
  var what = e.kind === 'plated' ? (e.barrel ? String(e.barrel).replace(/^(?!barrel)/i, 'Barrel ') + ' · ' : '') + 'in ' + (t != null ? relayClockLabel(t) : '—') + (t2 != null ? ', out ' + relayClockLabel(t2) : '') + ' · ' + prodQtyText(e.qty, e.unit) + (e.rework ? ' · rework' : '') :
    (e.kind === 'arrived' ? 'Came in' : e.rework ? 'Re-pickled' : 'Into the tank') + (t != null ? ' at ' + relayClockLabel(t) : '') + ' · ' + prodQtyText(e.qty, e.unit) +
    (e.kind === 'arrived' && e.challanNo ? ' · challan ' + e.challanNo : '');
  var note = e.voidedAt ? uiDot('neutral', 'Void') : idx.replaced[e.id] ? uiDot('neutral', 'Corrected') : checks.length ? uiDot(checks[0].tone, escHtml('To check: ' + checks[0].text)) : '';
  var acts = gone ? '' : '<span class="inv-row-end inv-row-actions inv-toolbar inv-toolbar-tight">' +
    '<a class="inv-btn inv-btn-secondary inv-btn-sm" data-face-send="' + escHtml(e.id) + '" href="' + escHtml(faceWaHref(faceMsgFor(e))) + '" target="_blank" rel="noopener">Send to the group</a>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFaceCopy" data-id="' + escHtml(e.id) + '">Copy</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFaceCorrect" data-id="' + escHtml(e.id) + '">Correct</button></span>';
  return '<div class="inv-row inv-row-2 inv-row-flow" data-face-entry="' + escHtml(e.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(prodEntryTitle(e)) + '</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml(what) + '</span>' + (note ? '<span class="inv-row-meta inv-row-wrap" data-face-check>' + note + '</span>' : '') + '</span>' + acts + '</div>';
}

/* ---------- The message for the group ---------- */
/* The shop's own shape, so the group reads what it reads today, and the reader takes it back as the same record: the day first
   (so the message dates itself, whenever it is sent or pasted), the client, each part with its figure, then the time. */
/* A time as the shop writes it in a message: hours and minutes, AM or PM ("8:00 PM", never "8 PM"). */
function faceClock(min) {
  if (min == null) return '';
  var m = ((min % 1440) + 1440) % 1440;
  return ((m / 60 | 0) % 12 || 12) + ':' + String(m % 60).padStart(2, '0') + ' ' + (m >= 720 ? 'PM' : 'AM');
}
function faceMsgOf(list) {
  var e0 = list[0], d = String(e0.date).split('-'), t = relayParseHhmm(e0.time);
  var clock = faceClock(t);
  var client = String(prodClientName(e0.clientId) || e0.client || '').toUpperCase();
  var qty = function(e) { return e.qty == null ? '' : ' - ' + (e.unit === 'KG' ? String(+(+e.qty).toFixed(2)) + ' KG' : String(Math.round(e.qty)) + ' NOS'); };
  var part = function(e) { var p = String(e.part || '').toUpperCase(); return p + (e.gauge && p.replace(/[×✕]/g, 'X').indexOf(String(e.gauge).toUpperCase()) < 0 ? ' (' + e.gauge + ')' : '') + qty(e); };
  var head = d[2] + '/' + d[1] + '/' + String(d[0]).slice(2);
  // A barrel batch: the barrel and its times, then the client and the part (never the barrel list's head, which would read
  // as the day's whole list).
  if (e0.kind === 'plated') { var t2 = relayParseHhmm(e0.to), out = t2 == null ? '' : ' - ' + faceClock(t2);
    return [head, 'BARREL ' + String(e0.barrel || '').toUpperCase().replace(/^BARREL\s*/, '') + ': ' + clock + out, client].concat(list.map(part)).join('\n'); }
  if (e0.kind === 'arrived') return [head, 'INCOMING MATERIAL TIME ' + clock, client].concat(list.map(part)).join('\n');
  return [head, client].concat(list.map(part), e0.rework ? ['RE-PICKLING'] : [], ['PICKLING TIME ' + clock]).join('\n');
}
/* The message an entry went out in: every entry of its save shares it (one challan counted is one message). */
function faceMsgFor(e) {
  if (e.pageId) { var pg = prodData().pages.find(function(x) { return x.id === e.pageId; }); if (pg) return faceVatText(pg.date, pg.line, pg.rows, pg.counted, pg.style); }
  var list = e.msgHash ? prodIndex().live.filter(function(x) { return x.src === 'face' && x.msgHash === e.msgHash; }) : [];
  return faceMsgOf(list.length ? list : [e]);
}
/* WhatsApp with the message written: the installed app on a phone (it picks the group), WhatsApp Web on a computer. */
function faceWaHref(text) { return 'https://wa.me/?text=' + encodeURIComponent(text); }
function faceCopy(id) {
  var e = prodIndex().byId[id];
  if (!e) return;
  var text = faceMsgFor(e);
  var done = function() { showToast('Message copied: paste it in the group'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function() { uiAlert({ title: 'Copy the message', body: text }); });
  else uiAlert({ title: 'Copy the message', body: text });
}

/* ---------- Saving ---------- */
async function faceSave() {
  var f = _faceForm;
  if (!f) return;
  if (f.duty === 'roll-in' || f.duty === 'roll-out') return faceRollSave();
  if (f.duty === 'barrel') return faceBarrelSave();
  if (f.duty === 'vat') return faceVatSave();
  if (!grdOk('floor') && !(await guardAsk('floor', f.duty === 'incoming' ? 'save what came in' : 'save a pickling load'))) return;
  if (_faceForm !== f) return;
  var err = function(msg, id) { showToast(msg, 'error'); var el = id && document.getElementById(id); if (el) try { el.focus(); } catch (x) { /* a convenience */ } };
  if (!f.clientId) return err('Pick the client', 'faceClient');
  if (!/^\d{1,2}:\d{2}$/.test(f.time || '')) return err(f.duty === 'incoming' ? 'Enter when it came in' : 'Enter when it went into the tank', 'faceTime');
  var cid = prodHeldId(f.clientId), parts = faceClientParts(f.clientId), by = faceUserName(), at = Date.now(), list = [];
  var base = function(kind) { return { id: prodUid('PE'), kind: kind, date: f.date, time: f.time, clientId: cid, client: prodClientName(cid), src: 'face', by: by, at: at }; };
  var withPart = function(e) {
    var x = parts.find(function(p) { return p.key === f.part; });
    if (x) { e.part = x.part; if (x.partNumber) e.partNumber = x.partNumber; e.gauge = x.gauge || null; }
    else { e.part = String(f.partText || '').trim(); e.gauge = prodGaugeOf(e.part, e.part) || null; }
    return e;
  };
  var qty = parseFloat(f.qty);
  if (f.duty === 'pickling' || f.challan === FACE_NOCHALLAN || f.replaces) {
    if (!f.part || (f.part === FACE_TYPED && !String(f.partText || '').trim())) return err('Pick the part', f.part === FACE_TYPED ? 'facePartText' : 'facePart');
    if (!(qty > 0)) return err(f.duty === 'incoming' ? 'Enter what was counted' : 'Enter the quantity', 'faceQty');
    var e = withPart(base(f.duty === 'incoming' ? 'arrived' : 'pickled'));
    e.qty = qty; e.unit = f.unit === 'KG' ? 'KG' : 'NOS';
    if (f.duty === 'incoming') { e.basis = 'floor-in'; if (String(f.challanNo || '').trim()) e.challanNo = String(f.challanNo).trim(); if (f.link) { e.imId = f.link.imId; e.imItemId = f.link.imItemId; } }
    else { e.basis = 'pickling'; e.rework = !!f.rework; }
    var src = f.replaces ? prodIndex().byId[f.replaces] : null;
    if (src) {
      e.replaces = src.id;
      // What the form does not show stays with the load: a line the owner set, the plating the owner matched it to.
      if (src.line) { e.line = src.line; e.lineSrc = src.lineSrc || null; if (src.setAt) { e.setAt = src.setAt; e.setBy = src.setBy; } }
      if (src.set) e.set = src.set;
    }
    list.push(e);
  } else {
    var m = faceInChallans(f).find(function(x) { return x.id === f.challan; });
    if (!m) return err('Pick the challan, or Not in the book yet', 'faceChallan');
    (m.items || []).forEach(function(it) {
      var v = parseFloat((f.counts || {})[it.id]);
      if (!(v >= 0) || String((f.counts || {})[it.id]).trim() === '') return;
      var e = base('arrived'), u = faceLineUnit(it);
      e.part = String(it.partNumber || it.desc || '').trim(); if (it.partNumber) e.partNumber = String(it.partNumber).trim(); e.gauge = prodGaugeOf(it.partNumber, it.desc) || null;
      e.qty = v; e.unit = u; e.basis = 'floor-in'; e.imId = m.id; e.imItemId = it.id; if (m.challanNo) e.challanNo = m.challanNo;
      list.push(e);
    });
    if (!list.length) return err('Enter what was counted on at least one line');
  }
  // The message for the group, and its key: the same message pasted later is known as entered (prodPasteSeen).
  var hash = prodMsgKey(f.date, faceMsgOf(list));
  var p = prodData();
  list.forEach(function(e) {
    e.msgHash = hash;
    // A name typed, not picked: matched to the client's part where its code says which, as a paste's is.
    if (f.part === FACE_TYPED) prodLearnAliases([e]);
    p.entries.push(prodSparse(e));
  });
  prodTouch();
  saveState();
  _pageTyped = false;
  if (f.replaces) {   // a correction is one entry: back to the face
    _faceForm = null;
    renderFace();
    viewTop();
    showToast('Correction saved; the entry it corrects is kept, marked corrected', 'success');
    return;
  }
  // The form stays for the next: the client and the day carry over; the part, the figures and the time start again.
  list.forEach(function(e) { f.saved.push(e.id); });
  f.part = ''; f.partText = ''; f.qty = ''; f.rework = false; f.counts = {}; f.challan = f.duty === 'incoming' ? '' : f.challan; f.challanNo = '';
  f.time = f.date === localDateStr() ? faceNowHhmm() : f.time;
  renderFace();
  showToast((list.length > 1 ? todoPlural(list.length, 'line') + ' saved' : 'Saved') + ' · send it to the group, or enter the next', 'success');
}

/* ---------- The checks: the owner looks only where the data disagrees (docs/ENTRY_FACES.md §4) ----------
   Trusted, checked, never held: a face's entry is a record at once, and is set against what it links to. Where they disagree,
   the entry carries the question (Mine, Production → Entries → To check) and the owner is asked to look (To-do faceCheck, one
   task a check and a day); Looks right keeps it as entered (`checkOk`, the codes ruled on, who and when), Correct puts it right.
   - noplate: a load with no plating found by noon the next working day (the matcher's own window), where every line it can have
     gone to was recorded in that window (its usual line, else its client's lines in sixty days, else all three): with a line not
     recorded, the register is what is missing (the barrel keeps none), and Today says so.
   - over: a load past what its challans hold (In plant's own setting of loads against challan lines, oldest first). A load with
     no challan open at all is the rule Production already has (prodPickledNoChallan), never asked twice.
   - count: material counted in that the challan's figure does not bear out (any piece; kilograms past 3%); short is red, since
     the challan bills what did not come.
   - inNoChallan: material counted in with no challan of it in the book a working day on.
   - noload: on a day the pickling hand entered on a face, a VAT run no load became (the barrel has its own pickling). A run before
     the day's first load is left out unless the face was in use the working day before too.
   - heavy (F3): a barrel batch over a quarter heavier than its barrel takes (the kg a round typed on the unit, else the median
     of five or more of its own batches). */
var FACE_CHECK_DAYS = 30;
var FACE_CHECK_TITLE = {
  noplate: function(n) { return todoPlural(n, 'load') + ' pickled with no plating found'; },
  over: function(n) { return todoPlural(n, 'load') + ' past what their challans hold'; },
  count: function(n) { return todoPlural(n, 'line') + ' counted in against the challan'; },
  inNoChallan: function(n) { return todoPlural(n, 'arrival') + ' with no challan in the book'; },
  noload: function(n) { return todoPlural(n, 'run') + ' plated with no pickling load'; },
  heavy: function(n) { return todoPlural(n, 'barrel batch', 'barrel batches') + ' heavier than the barrel takes'; },
  rack: function(n) { return todoPlural(n, 'run') + ' at a round its line has not run before'; },
  total: function(n) { return todoPlural(n, 'register page') + ' whose rounds do not add to its total'; }
};
var FACE_CHECK_WHY = { noplate: 'a load and the plating it became', over: 'a load and its challans', count: 'a count and its challan', inNoChallan: 'a count and its challan', noload: 'a run and the load it came from',
  heavy: 'a batch and its barrel', rack: 'a round and the rounds its line has run', total: 'a page and the total written on it' };
var _faceChecksMemo = null;
function faceChecks() {
  var key = [_prodVer, typeof _bookWrites !== 'undefined' ? _bookWrites : 0, localDateStr(), Math.floor(Date.now() / 600000)].join('|');
  if (_faceChecksMemo && _faceChecksMemo.key === key && _faceChecksMemo.s === S && _faceChecksMemo.p === prodData()) return _faceChecksMemo;
  var out = { key: key, s: S, p: prodData(), byId: {}, groups: {} };
  _faceChecksMemo = out;
  var idx = prodIndex(), today = localDateStr(), since = isoAddDays(today, -FACE_CHECK_DAYS), nowMin = tdyNowMin();
  var ruled = function(e, code) { return !!(e.checkOk && Array.isArray(e.checkOk.codes) && e.checkOk.codes.indexOf(code) >= 0); };
  var add = function(e, code, tone, text) {
    (out.byId[e.id] = out.byId[e.id] || []).push({ code: code, tone: tone, text: text });
    var g = out.groups[code + '|' + e.date] || (out.groups[code + '|' + e.date] = { code: code, day: e.date, ids: [], tone: 'amber' });
    g.ids.push(e.id); if (tone === 'red') g.tone = 'red';
  };
  var nextWd = function(d) { return isoAddDays(d, new Date(d + 'T00:00:00').getDay() === 6 ? 2 : 1); };
  var prevWd = function(d) { return isoAddDays(d, new Date(d + 'T00:00:00').getDay() === 1 ? -2 : -1); };
  var live = idx.live.filter(function(e) { return e.date >= since && e.date <= today && !idx.replaced[e.id]; });
  var loads = live.filter(function(e) { return e.kind === 'pickled' && e.src === 'face'; });
  var plated = {};
  idx.counted.forEach(function(r) { if (r.date >= since) (plated[r.date] = plated[r.date] || {})[r.line || '-'] = true; });
  var plant = null;
  // The lines a client's work went to in sixty days of the record: where a load of theirs can have been plated.
  var clientLines = {}, from60 = isoAddDays(today, -60);
  idx.counted.forEach(function(r) { if (r.date >= from60 && r.line && r.clientId != null) (clientLines[String(r.clientId)] = clientLines[String(r.clientId)] || {})[r.line] = true; });
  loads.forEach(function(e) {
    var m = idx.match[e.id], nx = nextWd(e.date);
    if (!ruled(e, 'noplate') && !(m && m.ids.length) && (nx < today || (nx === today && nowMin >= 720))) {
      // Asked only where every line it can have gone to was recorded in its window: its usual line, else its client's lines,
      // else all three. A line with no record (the barrel keeps no register) is the record missing, never the load.
      var rec = Object.assign({}, plated[e.date] || {}, plated[nx] || {}), lk = prodLoadLine(e);
      var could = lk.hint ? [lk.hint.line] : Object.keys(clientLines[String(e.clientId)] || {});
      if (!could.length) could = PROD_LINES.slice();
      if (could.every(function(l) { return rec[l]; })) add(e, 'noplate', 'amber', 'no plating of it found by noon on ' + formatDate(nx) + ', though ' + prodLinesWord(could) + (could.length === 1 ? ' was' : ' were') + ' recorded');
    }
    if (!e.rework && e.qty != null && !ruled(e, 'over')) {
      plant = plant || prodInPlant({});
      var o = plant.over && plant.over[e.id];
      if (o && o.held > 0.0005) add(e, 'over', 'amber', prodQtyText(o.left, o.unit) + ' past its challans: they hold ' + prodQtyText(o.held, o.unit) + ', ' + prodQtyText(o.before, o.unit) + ' of it pickled before this load');
    }
  });
  live.filter(function(e) { return e.kind === 'arrived' && e.src === 'face'; }).forEach(function(e) {
    var ln = faceArrivalLine(e);
    if (!ln) {
      if (!ruled(e, 'inNoChallan') && prodWorkingDaysBetween(e.date, today) >= 1) add(e, 'inNoChallan', 'amber', 'no challan of it in the book' + (e.challanNo ? ' (challan ' + e.challanNo + ' written)' : ''));
      return;
    }
    if (ruled(e, 'count') || e.qty == null) return;
    var want = faceLineFigure(ln.it, e.unit);
    if (want == null) return;
    var diff = e.qty - want;
    if (Math.abs(diff) <= (e.unit === 'KG' ? Math.abs(want) * 0.03 : 0.5)) return;
    add(e, 'count', diff < 0 ? 'red' : 'amber', 'challan ' + (ln.m.challanNo || 'with no number') + ' says ' + prodQtyText(want, e.unit) + ': ' + prodQtyText(Math.abs(diff), e.unit) + (diff < 0 ? ' short' : ' over'));
  });
  // A barrel batch heavier than its barrel takes: the kg a round typed on the barrel, else the median of its own batches (F3).
  live.filter(function(e) { return e.kind === 'plated' && e.line === 'barrel' && e.src === 'face' && !e.rework; }).forEach(function(e) {
    if (ruled(e, 'heavy')) return;
    var u = faceBarrelUsual(e), w = prodWeigh(e);
    if (!u || !w || !(w.kg > u.kg * 1.25)) return;
    add(e, 'heavy', 'amber', prodKgFig(w.kg, prodWeighEst(w)) + ', past the ' + formatNum(u.kg, 0) + ' kg its barrel takes' + (u.src === 'set' ? '' : ' by its own batches'));
  });
  // A register page entered on Mine (F4): a round of a size its part never ran at on its line before the page's day (three or more
  // rounds on record before it; half the usual rack on VAT A2 is the line's own way), and a page whose rounds do not add to the
  // day total written on it. Each against the record before the page, so a later page does not quietly answer it.
  var pageRuns = live.filter(function(e) { return e.kind === 'plated' && e.src === 'face' && e.pageId && (e.line === 'vat-a1' || e.line === 'vat-a2'); });
  if (pageRuns.length) {
    var byKey = {};
    idx.counted.forEach(function(x) { if (x.line) { var k = x.line + '|' + (prodEntryKey(x) || ''); (byKey[k] = byKey[k] || []).push(x); } });
    var sizes = function(x, o) {
      (x.rounds || []).forEach(function(r) { if (r.struck || r.start) return; if (r.rack) o[r.rack] = (o[r.rack] || 0) + (r.n || 1); else if (!r.batch && r.qty > 0) o[r.qty] = (o[r.qty] || 0) + 1; });
      if (x.rackSize && x.racks) o[x.rackSize] = (o[x.rackSize] || 0) + x.racks;
      return o;
    };
    pageRuns.forEach(function(e) {
      if (ruled(e, 'rack') || e.clientId == null) return;
      var seen = {}, total = 0, top = null;
      (byKey[e.line + '|' + (prodEntryKey(e) || '')] || []).forEach(function(x) { if (x.date < e.date) sizes(x, seen); });
      Object.keys(seen).forEach(function(z) { total += seen[z]; if (top == null || seen[z] > seen[top]) top = z; });
      if (total < 3) return;
      var odd = Object.keys(sizes(e, {})).filter(function(z) { return !seen[z] && !(e.line === 'vat-a2' && top && Math.abs(z * 2 - top) < 0.5); });
      if (odd.length) add(e, 'rack', 'amber', 'a round of ' + odd.join(', ') + ', never run for it on ' + PROD_LINE_LABEL[e.line] + ' before (usually ' + top + ')');
    });
  }
  prodData().pages.forEach(function(pg) {
    if (!pg || pg.replacedBy || pg.total == null || pg.date < since || pg.date > today) return;
    var sum = 0, first = null, n = 0;
    idx.live.forEach(function(e) {
      if (e.kind !== 'plated' || e.src !== 'face' || !e.pageId || e.date !== pg.date || e.line !== pg.line) return;
      // A run put right in Production counts as it was put right.
      var x = e, hops = 0;
      while (idx.replaced[x.id] && hops++ < 20) x = idx.byId[idx.replaced[x.id]] || x;
      sum += x.qty || 0; n++;
      if (!idx.replaced[e.id] && (!first || String(e.time || '') < String(first.time || ''))) first = e;
    });
    if (!first || !n || Math.abs(sum - pg.total) <= 0.5 || ruled(first, 'total')) return;
    add(first, 'total', 'amber', 'the page’s day total is ' + Math.round(pg.total).toLocaleString('en-IN') + '; its rounds add to ' + Math.round(sum).toLocaleString('en-IN'));
  });
  // A run of a day the face was in use that no load became.
  var first = {};
  loads.forEach(function(e) { var t = relayParseHhmm(e.time); if (!(e.date in first) || (t != null && (first[e.date] == null || t < first[e.date]))) first[e.date] = t; });
  var claimed = {};
  Object.keys(idx.match).forEach(function(id) { (idx.match[id].ids || []).forEach(function(r) { claimed[r] = true; }); });
  idx.counted.forEach(function(r) {
    if (r.date < since || r.date > today || (r.line !== 'vat-a1' && r.line !== 'vat-a2') || claimed[r.id] || !(r.date in first) || ruled(r, 'noload')) return;
    var t = relayParseHhmm(r.time), f0 = first[r.date];
    if (!(prevWd(r.date) in first) && f0 != null && (t == null || t < f0 - 30)) return;
    add(r, 'noload', 'amber', 'no pickling load of it on ' + formatDate(r.date) + ' or the working day before');
  });
  return out;
}
function faceCheckOf(e) { return e && e.id && S ? faceChecks().byId[e.id] || [] : []; }
/* A face's arrival and the challan line it is counted against: the line it was counted on, else the client's challan of the
   same part dated from three days before to two after (the number written first, then the nearest day). */
function faceArrivalLine(e) {
  var hit = null;
  if (e.imItemId) {
    (S.incomingMaterial || []).some(function(m) { var it = (m.items || []).find(function(x) { return x.id === e.imItemId; }); if (it) hit = { m: m, it: it }; return !!it; });
    return hit;
  }
  var k = prodEntryKey(e);
  if (!k) return null;
  var lo = isoAddDays(e.date, -3), hi = isoAddDays(e.date, 2), noKey = e.challanNo ? imChallanNoKey(e.challanNo) : '';
  (S.incomingMaterial || []).forEach(function(m) {
    if (String(m.clientId) !== String(e.clientId) || (m.challanDate || '') < lo || (m.challanDate || '') > hi) return;
    (m.items || []).forEach(function(it) {
      if (prodChallanKey(m, it) !== k) return;
      var score = (noKey && imChallanNoKey(m.challanNo) !== noKey ? 10 : 0) + Math.abs(isoDaysBetween(m.challanDate || e.date, e.date));
      if (!hit || score < hit.score) hit = { m: m, it: it, score: score };
    });
  });
  return hit;
}
/* The questions on an entry, for Production's Entries (its fold and pane): each with Looks right for whoever may rule on it. */
function faceCheckCalloutsHtml(e) {
  var cs = faceCheckOf(e);
  if (!cs.length || e.voidedAt) return '';
  var can = typeof grdCan !== 'function' || !grdOn() || grdCan('voids');
  return cs.map(function(c) {
    return '<div class="inv-callout inv-callout-' + uiTone(c.tone) + '" data-face-check-q="' + c.code + '">' + escHtml('To check: ' + c.text + '.') +
      (can ? ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFaceCheckOk" data-id="' + escHtml(e.id) + '" data-code="' + c.code + '">Looks right</button>' : '') + '</div>';
  }).join('');
}
/* Looks right: the owner's ruling, kept on the entry against the check it answers; a new disagreement of another kind still asks. */
function faceCheckOk(id, code) {
  if (!grdGate('voids', 'keep an entry as entered', function() { faceCheckOk(id, code); })) return;
  var e = prodIndex().byId[id];
  if (!e || e.voidedAt || !FACE_CHECK_TITLE[code]) return;
  var codes = e.checkOk && Array.isArray(e.checkOk.codes) ? e.checkOk.codes.slice() : [];
  if (codes.indexOf(code) < 0) codes.push(code);
  e.checkOk = { codes: codes, at: Date.now(), by: faceUserName() };
  prodTouch();
  saveState();
  keepScroll(tabRedrawActive);
  showToast('Kept as entered');
}
function faceEntryShort(e) {
  var t = relayParseHhmm(e.time);
  return [prodClientName(e.clientId) || e.client || 'No client', e.part || '', prodQtyText(e.qty, e.unit), t != null ? relayClockLabel(t) : ''].filter(Boolean).join(' · ');
}
TODO_RULES.push(['faceCheck', 'Faces: an entry the linked data does not bear out']);
TODO_CHECK_DEFAULTS.faceCheck = true;
TODO_RULE_NEED.faceCheck = 'owner';
TODO_RULE_FNS.faceCheck = function() {
  var c = faceChecks(), idx = prodIndex();
  return Object.keys(c.groups).sort().map(function(k) {
    var g = c.groups[k], es = g.ids.map(function(id) { return idx.byId[id]; }).filter(Boolean);
    var q = function(e) { return ((c.byId[e.id] || []).find(function(x) { return x.code === g.code; }) || {}).text || ''; };
    return { key: 'faceCheck:' + k, rule: 'faceCheck', tone: g.tone, title: FACE_CHECK_TITLE[g.code](es.length) + ' · ' + formatDate(g.day),
      sub: es.slice(0, 2).map(faceEntryShort).join('; ') + (es.length > 2 ? ' +' + (es.length - 2) : ''), why: 'Entered on a face · ' + FACE_CHECK_WHY[g.code],
      facts: es.slice(0, 6).map(function(e) { return [faceEntryShort(e), q(e)]; }),
      clears: 'Looks right on each entry that is so (Production → Entries → To check), or Correct it.',
      go: prodGo('entries', { flag: 'check' }), goLabel: 'Open the entries', sig: g.tone + '|' + g.ids.slice().sort().join(',') };
  });
};

/* ---------- F3: the supervisor's own forms (docs/ENTRY_FACES.md §2, F-supervisor) ----------
   The two rolls are written on the face in the shop's own shape and saved through the roll's own reader and save (relayPlan,
   relayApplyPlan): the day holds exactly what the same roll pasted from WhatsApp would give (the marks, their hours and OT, the
   EXTRA rows, the blocks' crews), so Areas, Pay and the labour card read it unchanged; the roll is kept whole, marked as entered on
   a face, and the same roll pasted later is refused as saved before. The roll IS the record, so its marks are the roll's
   (`src: 'relay'`): the next roll updates them, and Read the rolls again reads it like any roll. A barrel batch is the barrel's
   register at last: a plated entry on the barrel line, `basis: 'register'`, so it is counted over the supervisor's relayed list. */
var FACE_ROLL_SECTIONS = [
  { id: 'vat-a1', title: 'VAT A1', head: 'VAT A1', floor: true, areas: ['vat-a1'] },
  { id: 'vat-a2', title: 'VAT A2', head: 'VAT A2', floor: true, areas: ['vat-a2'] },
  // The barrel alone, as the roll sometimes heads it, and the barrel unit with its pickling, where each hand stands at their own
  // post (the roll's reader places a hand at their own area when the heading names it).
  { id: 'barrel', title: 'Barrel', head: 'BARREL', floor: true, areas: ['barrel'] },
  { id: 'barrel-pick', title: 'Barrel & pickling', head: 'BARREL & PICKLING', floor: true, areas: ['barrel', 'pickling-barrel'] },
  { id: 'pickling-vat', title: 'Pickling A1 & A2', head: 'PICKLING A1 & A2', floor: true, areas: ['pickling-vat'] },
  { id: 'office', title: 'Office & gate', head: 'OFFICE & GATE', areas: ['office', 'gate'] },
  { id: 'civil', title: 'Civil', head: 'CIVIL', areas: ['civil'] }
];
/* The lines a block can run on, as the roll writes them: one block may run on several (the night hold on the barrel and VAT A2). */
var FACE_BLOCK_AREAS = [['vat-a1', 'VAT A1'], ['vat-a2', 'VAT A2'], ['barrel', 'Barrel'], ['pickling-vat', 'Pickling A1 & A2'], ['pickling-barrel', 'Barrel pickling']];
var FACE_BLOCK_FROM = [['17:00', '5:00 PM'], ['20:00', '8:00 PM, the night hold']];   // when a late block began
/* Where the 8:30 shift's EXTRA is booked: a line's own section (the barrel unit's, for the barrel). */
function faceExtraSection(area) {
  var s = FACE_ROLL_SECTIONS.filter(function(x) { return x.floor; }).filter(function(x) { return x.areas.indexOf(area) >= 0; });
  return s.length ? s[s.length - 1].id : '';
}
FACE_FORM_TITLE['roll-in'] = 'In-time roll';
FACE_FORM_TITLE['roll-out'] = 'Out-time roll';
FACE_FORM_TITLE.barrel = 'A barrel batch';

function faceSectionOf(area) { var s = FACE_ROLL_SECTIONS.find(function(x) { return x.areas.indexOf(area) >= 0; }); return s ? s.id : ''; }
/* The day's roster, as the Day view lists it. */
function faceRollRoster(day) { return attDayRoster(S.attendance && S.attendance[day]); }
/* A name as the roll writes it: the roster's own, in capitals, so the reader finds it exactly. */
function faceRollName(w) { return String(w.name || '').toUpperCase().replace(/\s+/g, ' ').trim(); }

/* The form, filled from the day as it stands: where each hand stood, the early and late blocks with their crews and EXTRA. */
function faceRollMake(duty, day) {
  var rec = S.attendance && S.attendance[day], f = { duty: duty, date: day, saved: [], blocks: [] };
  var blockOf = function(x) { return { areas: faceBlockAreasOf(x), crew: (x.crew || []).map(String), extra: x.hours ? String(x.hours) : '', work: '' }; };
  if (duty === 'roll-in') {
    f.place = {}; f.extra = {};
    if (rec) {
      Object.keys(rec.marks || {}).forEach(function(id) {
        var m = rec.marks[id];
        if (!m) return;
        if (m.st === 'A') f.place[id] = 'absent';
        else { var sec = faceSectionOf(m.area); if (sec) f.place[id] = sec; }
      });
      (rec.extra || []).forEach(function(x) {
        if (x.slotMade) return;
        // A line's EXTRA on the 8:30 shift is one figure on the face: the rows a roll wrote where the face writes it back are added
        // (a roll read twice had booked it twice). A row typed by hand, or on another area, is the day's own: a roll leaves it.
        if (x.kind !== 'block') {
          var sec = faceExtraSection(x.area), at = FACE_ROLL_SECTIONS.filter(function(z) { return z.id === sec; })[0];
          if (at && at.areas[0] === x.area && x.src === 'relay' && x.hours) f.extra[sec] = String(+((parseFloat(f.extra[sec]) || 0) + x.hours).toFixed(2));
          return;
        }
        if (attBlockSlot(x) === 'morning') f.blocks.push(blockOf(x));
      });
    }
  } else {
    f.outAt = {};
    var late = {};
    if (rec) (rec.extra || []).forEach(function(x) {
      if (x.kind !== 'block' || x.slotMade) return;
      var slot = attBlockSlot(x);
      if (slot !== 'evening' && slot !== 'night') return;
      var b = blockOf(x), to = relayParseHhmm(x.to);
      b.from = x.from === '20:00' ? '20:00' : '17:00';
      b.out = to != null ? relayHhmm(to) : b.from === '20:00' ? '06:00' : '20:00';
      b.crew.forEach(function(id) { late[id] = true; });
      f.blocks.push(b);
    });
    // A hand who went home at their own time, on no block: the roll writes the time after the name ("ALFA 7:00 PM").
    if (rec) Object.keys(rec.marks || {}).forEach(function(id) {
      var m = rec.marks[id];
      if (!m || m.st === 'A' || late[id] || !m.outKnown || m.outMin == null || m.outMin === RELAY_GENERAL_OUT) return;
      f.outAt[id] = relayHhmm(m.outMin);
    });
  }
  return f;
}
/* A block's lines as the form ticks them. */
function faceBlockAreasOf(x) {
  var a = x.areas && x.areas.length ? x.areas : x.area ? [x.area] : [];
  return FACE_BLOCK_AREAS.map(function(c) { return c[0]; }).filter(function(id) { return a.indexOf(id) >= 0; });
}
/* The heading a block is written under, which the roll's reader (relayHeaderAreas) reads back as its lines: the barrel with VAT lines,
   the barrel alone or with its pickling, the VAT lines, pickling of both sides, of the VAT side or of the barrel's. A VAT line's
   pickling hands are the line's own (the Areas check folds them in), so ticked beside a VAT line pickling is not written. '' with
   no line ticked. */
function faceBlockHead(areas) {
  var has = function(a) { return (areas || []).indexOf(a) >= 0; };
  var vat = [['vat-a1', 'VAT A1'], ['vat-a2', 'VAT A2']].filter(function(v) { return has(v[0]); }).map(function(v) { return v[1]; });
  if (has('barrel') && vat.length) return ['BARREL'].concat(vat).join(' & ');
  if (has('barrel')) return has('pickling-barrel') ? 'BARREL & PICKLING' : 'BARREL';
  if (vat.length) return vat.join(' & ');
  if (has('pickling-vat') && has('pickling-barrel')) return 'PICKLING 2 SIDE';
  if (has('pickling-vat')) return 'PICKLING A1 & A2';
  if (has('pickling-barrel')) return 'BARREL & PICKLING';
  return '';
}
/* What a block's heading reads back as (the barrel with its pickling is the unit's pickling side, a block's way, as on a paste). */
function faceBlockReads(areas) {
  var head = faceBlockHead(areas), read = head ? relayHeaderAreas(head) : [];
  return read.length === 2 && read[0] === 'barrel' && read[1] === 'pickling-barrel' ? ['pickling-barrel'] : read;
}
/* Out times, half-hourly, from `from` minutes to 6 AM the next morning; one the day holds off the list is kept in its place. */
function faceOutTimes(from, keep) {
  var out = [], key = function(t) { return (relayParseHhmm(t) - 720 + 1440) % 1440; };
  for (var m = from; m <= 1440 + 360; m += 30) out.push(relayHhmm(m));
  if (keep && relayParseHhmm(keep) != null && out.indexOf(keep) < 0) { out.push(keep); out.sort(function(a, b) { return key(a) - key(b); }); }
  return out;
}
/* sm: a row end's small select */
function faceOutSelectHtml(id, attrs, val, from, sm) {
  return '<select id="' + id + '" class="inv-select' + (sm ? ' inv-select-sm' : '') + '" ' + attrs + '>' +
    faceOutTimes(from, val).map(function(t) { return '<option value="' + t + '"' + (t === val ? ' selected' : '') + '>' + escHtml(relayClockLabel(relayParseHhmm(t))) + '</option>'; }).join('') + '</select>';
}
/* A mark entered on the day itself (People → Attendance, a card scan, a check-in): a roll leaves it as it is, so the face shows it
   and does not offer to change it. */
function faceMarkByHand(day, id) { var rec = S.attendance && S.attendance[day], m = rec && rec.marks && rec.marks[id]; return !!(m && m.src !== 'relay'); }
var FACE_BY_HAND = 'Entered on the day (People → Attendance): the roll leaves it';
/* Who is present on the day, as the marks have it: the out-time roll's 5 PM list is everyone present on no late block. */
function facePresentIds(day) {
  var rec = S.attendance && S.attendance[day];
  return rec ? Object.keys(rec.marks || {}).filter(function(id) { var m = rec.marks[id]; return m && m.st !== 'A' && staffById(id); }) : [];
}

/* The roll as the supervisor writes it, from the form: the day's head, the slots, a numbered line a hand, each area's EXTRA, the
   absent by tier. Lines of work done are written as typed, never numbered (a numbered line is a name). */
function faceRollText(f) {
  var d = String(f.date).split('-'), head = d[2] + '/' + d[1] + '/' + String(d[0]).slice(2) + '/ ', n = 0, out = [];
  var name = function(id) { var w = staffById(id); return w ? (++n) + ') ' + faceRollName(w) : null; };
  var work = function(t) { return String(t || '').split('\n').map(function(l) { return l.replace(/^\s*\d+\s*[).]\s*/, '').trim(); }).filter(Boolean); };
  var extra = function(v) { var h = parseFloat(v); return h > 0 ? ['EXTRA ' + (+h.toFixed(2)) + ' HOURS'] : []; };
  if (f.duty === 'roll-in') {
    out.push(head + 'in time');
    var onSite = function(id) { return f.place[String(id)] !== 'absent'; };
    var early = (f.blocks || []).filter(function(b) { return (b.crew || []).some(onSite); });
    if (early.length) {
      out.push('----6:00 AM----');
      early.forEach(function(b) { out.push('----' + faceBlockHead(b.areas) + '----'); b.crew.filter(onSite).map(name).filter(Boolean).forEach(function(l) { out.push(l); }); out = out.concat(extra(b.extra), work(b.work)); });
    }
    var roster = faceRollRoster(f.date);
    out.push('----8:30 AM----');
    FACE_ROLL_SECTIONS.forEach(function(s) {
      var ids = roster.filter(function(w) { return f.place[String(w.id)] === s.id; }).map(function(w) { return String(w.id); });
      var ex = faceExtraSection(s.areas[0]) === s.id;   // the section the line's EXTRA is booked under
      if (!ids.length && !(ex && parseFloat(f.extra[s.id]) > 0)) return;
      out.push('----' + s.head + '----');
      ids.map(name).filter(Boolean).forEach(function(l) { out.push(l); });
      if (ex) out = out.concat(extra(f.extra[s.id]));
    });
    var absent = roster.filter(function(w) { return f.place[String(w.id)] === 'absent'; });
    [['monthly', 'MONTHLY ABSENT'], ['weekly', 'WEEKLY ABSENT']].forEach(function(t) {
      var ids = absent.filter(function(w) { return (w.comp === 'monthly') === (t[0] === 'monthly'); }).map(function(w) { return String(w.id); });
      if (!ids.length) return;
      out.push('----' + t[1] + '----');
      ids.map(name).forEach(function(l) { out.push(l); });
    });
  } else {
    out.push(head + 'out time');
    var late = {}, blocks = (f.blocks || []).filter(function(b) { return (b.crew || []).length; });
    blocks.forEach(function(b) { b.crew.forEach(function(id) { late[String(id)] = true; }); });
    var five = (f.present || facePresentIds(f.date)).filter(function(id) { return !late[id]; });
    // Home at five unless their own time is set, which the roll writes after the name.
    if (five.length) {
      out.push('----5:00 PM----');
      five.forEach(function(id) { var l = name(id), t = f.outAt && relayParseHhmm(f.outAt[id]); if (l) out.push(t != null && t !== RELAY_GENERAL_OUT ? l + ' ' + faceClock(t) : l); });
    }
    // The blocks from five under their out times, in the order they fall after five; a night hold from eight under its own heading
    // with both its ends ("NIGHT HOLD 8 PM TO 5 AM").
    var after5 = function(t) { return (relayParseHhmm(t) - RELAY_GENERAL_OUT + 1440) % 1440; }, outs = [];
    var crewOf = function(b) { b.crew.map(name).filter(Boolean).forEach(function(l) { out.push(l); }); out = out.concat(extra(b.extra), work(b.work)); };
    var five5 = blocks.filter(function(b) { return b.from !== '20:00'; });
    five5.forEach(function(b) { if (relayParseHhmm(b.out) != null && outs.indexOf(b.out) < 0) outs.push(b.out); });
    outs.sort(function(a, b) { return after5(a) - after5(b); }).forEach(function(o) {
      out.push('----' + faceClock(relayParseHhmm(o)) + '----');
      five5.filter(function(b) { return b.out === o; }).forEach(function(b) { out.push(faceBlockHead(b.areas)); crewOf(b); });
    });
    blocks.filter(function(b) { return b.from === '20:00'; }).forEach(function(b) {
      out.push('NIGHT HOLD 8 PM TO ' + relayClockLabel(relayParseHhmm(b.out)).toUpperCase(), '----' + faceBlockHead(b.areas) + '----'); crewOf(b);
    });
  }
  return out.join('\n');
}
/* Each name the roll writes is placed on the hand it was written for: the reader never has to guess between two spellings. */
function faceRollChoices(text, f) {
  var ch = {};
  var ids = f.duty === 'roll-in' ? Object.keys(f.place).filter(function(id) { return f.place[id]; }) : facePresentIds(f.date);
  (f.blocks || []).forEach(function(b) { (b.crew || []).forEach(function(id) { if (ids.indexOf(String(id)) < 0) ids.push(String(id)); }); });
  ids.forEach(function(id) { var w = staffById(id); if (w) ch[relayKey(faceRollName(w))] = String(w.id); });
  return ch;
}

/* ---------- The rolls on screen ---------- */
function faceCrewChipsHtml(i, crew, roster) {
  return '<div class="inv-field-label">Crew <span class="inv-panel-count">' + crew.length + '</span></div><div class="inv-toolbar" role="group" aria-label="Who stood the block" data-face-crew="' + i + '">' +
    (roster.length ? roster.map(function(w) {
      return '<button type="button" class="inv-chip" data-action="invFaceCrew" data-i="' + i + '" data-id="' + escHtml(String(w.id)) + '" aria-pressed="' + (crew.indexOf(String(w.id)) >= 0) + '">' + escHtml(w.name) + '</button>';
    }).join('') : '<span class="inv-note">No roster yet: the owner imports it on People → Roster.</span>') + '</div>';
}
/* A block: when it ended (the out-time roll), the lines it ran on as chips and what the roll will read them as, its crew, its EXTRA
   and the work it did. */
function faceBlockHtml(f, b, i, roster) {
  var areas = b.areas || [], read = faceBlockReads(areas);
  var folded = areas.some(function(a) { return /^pickling/.test(a) && read.indexOf(a) < 0; });
  var h = '<div class="inv-panel" data-face-block="' + i + '">';
  if (f.duty === 'roll-out') h += '<div class="inv-fields">' +
    faceField('faceBlkFrom' + i, 'From', '<select id="faceBlkFrom' + i + '" class="inv-select" data-face-blk="' + i + '" data-k="from">' +
      FACE_BLOCK_FROM.map(function(o) { return '<option value="' + o[0] + '"' + ((b.from || '17:00') === o[0] ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>'; }).join('') + '</select>') +
    faceField('faceBlkOut' + i, 'Out at', faceOutSelectHtml('faceBlkOut' + i, 'data-face-blk="' + i + '" data-k="out"', b.out, 1050)) + '</div>';
  h += '<div class="inv-field-label">Line</div><div class="inv-toolbar" role="group" aria-label="The lines the block ran on" data-face-blk-areas="' + i + '">' +
    FACE_BLOCK_AREAS.map(function(c) {
      return '<button type="button" class="inv-chip" data-action="invFaceBlkArea" data-i="' + i + '" data-area="' + c[0] + '" aria-pressed="' + (areas.indexOf(c[0]) >= 0) + '">' + escHtml(c[1]) + '</button>';
    }).join('') + '</div>' +
    '<div class="inv-note inv-mb-8" data-face-blk-read="' + i + '">' + escHtml(read.length ? 'Booked to ' + read.map(relayAreaName).join(' + ') + (folded ? ' (pickling with a line is counted in the line’s block)' : '')
      : 'Tick the line it ran on') + '</div>';
  h += faceCrewChipsHtml(i, b.crew || [], roster) + '<div class="inv-fields inv-mt-8">' +
    faceField('faceBlkExtra' + i, 'EXTRA hours', '<input type="number" inputmode="decimal" step="any" min="0" id="faceBlkExtra' + i + '" class="inv-input inv-input-num" data-face-blk="' + i + '" data-k="extra" value="' + escHtml(b.extra || '') + '">') +
    faceField('faceBlkWork' + i, 'Work done', '<input id="faceBlkWork' + i + '" class="inv-input" data-face-blk="' + i + '" data-k="work" value="' + escHtml(b.work || '') + '" autocomplete="off" placeholder="e.g. MEHTA CLAMP 1000 NOS">') +
    '</div><div class="inv-toolbar inv-mt-8"><button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFaceBlkDel" data-i="' + i + '">Take this block off</button></div></div>';
  return h;
}
function faceRollInHtml(f) {
  var roster = faceRollRoster(f.date), counts = {}, unmarked = 0;
  roster.forEach(function(w) { var p = f.place[String(w.id)]; if (p) counts[p] = (counts[p] || 0) + 1; else if (!faceMarkByHand(f.date, String(w.id))) unmarked++; });
  var h = faceBackBar(FACE_FORM_TITLE['roll-in']) + faceRollSavedHtml(f), present = roster.filter(function(w) { return f.place[String(w.id)] !== 'absent'; });
  h += '<div class="inv-panel inv-panel-flush" data-face-early><div class="inv-panel-head"><span class="inv-panel-title">6:00 AM <span class="inv-panel-count">' + f.blocks.length + '</span></span>' +
    '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFaceBlkAdd">Add a 6 AM block</button></div>' +
    (f.blocks.length ? '' : '<div class="inv-empty">No early block today.</div>') + '</div>' + f.blocks.map(function(b, i) { return faceBlockHtml(f, b, i, present); }).join('');
  // Where each hand stood: a row a hand in the Day view's order, its place one pick; the counts above them.
  var opts = function(v) {
    return '<option value=""' + (!v ? ' selected' : '') + '>Not marked</option>' + FACE_ROLL_SECTIONS.map(function(s) { return '<option value="' + s.id + '"' + (v === s.id ? ' selected' : '') + '>' + escHtml(s.title) + '</option>'; }).join('') +
      '<option value="absent"' + (v === 'absent' ? ' selected' : '') + '>Absent</option>';
  };
  var chips = FACE_ROLL_SECTIONS.filter(function(s) { return counts[s.id]; }).map(function(s) { return s.title + ' ' + counts[s.id]; })
    .concat(counts.absent ? ['Absent ' + counts.absent] : [], unmarked ? ['Not marked ' + unmarked] : []);
  h += '<div class="inv-panel inv-panel-flush" data-face-general><div class="inv-panel-head"><span class="inv-panel-title">8:30 AM <span class="inv-panel-count">' + roster.length + '</span></span>' +
    (unmarked ? '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFaceUsual">Usual places</button>' : '') + '</div>' +
    '<div class="inv-panel-body inv-note" data-face-counts>' + escHtml(chips.join(' · ') || 'Nobody on the roster yet') + '</div>' +
    roster.map(function(w) {
      var id = String(w.id), sel = 'facePlace' + id.replace(/[^A-Za-z0-9_-]/g, ''), kept = faceMarkByHand(f.date, id);
      var comp = (COMP_CLASSES.find(function(c) { return c.id === w.comp; }) || {}).label || '';
      return '<div class="inv-row inv-row-2 inv-row-flow" data-face-hand="' + escHtml(id) + '"><span class="inv-row-main"><label class="inv-row-title" for="' + sel + '">' + escHtml(w.name) + '</label>' +
        '<span class="inv-row-meta inv-row-wrap">' + escHtml(kept ? FACE_BY_HAND : [comp, w.area ? 'usually ' + areaLabel(w.area) : ''].filter(Boolean).join(' · ')) + '</span></span>' +
        '<span class="inv-row-end"><select id="' + sel + '" class="inv-select inv-select-sm" data-face-place="' + escHtml(id) + '"' + (kept ? ' disabled' : '') + '>' + opts(f.place[id] || '') + '</select></span></div>';
    }).join('') + (unmarked ? '<div class="inv-toolbar inv-mt-8"><button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFaceRestAbsent">Mark the rest absent</button></div>' : '') + '</div>';
  // The EXTRA booked to each floor area on the general shift.
  h += '<div class="inv-panel" data-face-extra><div class="inv-panel-title">EXTRA on the 8:30 shift</div><div class="inv-fields">' + FACE_ROLL_SECTIONS.filter(function(s) { return s.floor && faceExtraSection(s.areas[0]) === s.id; }).map(function(s) {
    return faceField('faceExtra' + s.id, s.title + ', hours', '<input type="number" inputmode="decimal" step="any" min="0" id="faceExtra' + s.id + '" class="inv-input inv-input-num" data-face-extra="' + s.id + '" value="' + escHtml(f.extra[s.id] || '') + '">');
  }).join('') + '</div></div>';
  return h + faceActionBarHtml(unmarked ? unmarked + ' not marked · roll of' : 'In-time roll of', f);
}
function faceRollOutHtml(f) {
  var present = facePresentIds(f.date), roster = present.map(staffById).filter(Boolean);
  if (!roster.length) roster = faceRollRoster(f.date);
  var late = {};
  f.blocks.forEach(function(b) { (b.crew || []).forEach(function(id) { late[String(id)] = true; }); });
  var five = present.filter(function(id) { return !late[id]; }).map(staffById).filter(Boolean);
  var h = faceBackBar(FACE_FORM_TITLE['roll-out']) + faceRollSavedHtml(f);
  if (!present.length) h += '<div class="inv-callout inv-callout-warning">The in-time roll of this day is not in: the out-time roll names only the blocks’ crews.</div>';
  // Everyone present on no late block went home at five, unless their own time is set (the roll writes it after the name).
  h += '<div class="inv-panel inv-panel-flush" data-face-five><div class="inv-panel-head"><span class="inv-panel-title">Went home <span class="inv-panel-count">' + five.length + '</span></span></div>' +
    (five.length ? five.map(function(w) {
      var id = String(w.id), sel = 'faceOut' + id.replace(/[^A-Za-z0-9_-]/g, ''), kept = faceMarkByHand(f.date, id);
      return '<div class="inv-row inv-row-2 inv-row-flow" data-face-left="' + escHtml(id) + '"><span class="inv-row-main"><label class="inv-row-title" for="' + sel + '">' + escHtml(w.name) + '</label>' +
        (kept ? '<span class="inv-row-meta inv-row-wrap">' + escHtml(FACE_BY_HAND) + '</span>' : '') + '</span>' +
        '<span class="inv-row-end">' + faceOutSelectHtml(sel, 'data-face-out="' + escHtml(id) + '"' + (kept ? ' disabled' : ''), (f.outAt && f.outAt[id]) || '17:00', 720, true) + '</span></div>';
    }).join('') : '<div class="inv-empty">Nobody: everyone present is on a late block.</div>') +
    '<div class="inv-panel-body inv-note">At 5:00 PM unless a time is set. A hand on a block below goes home with the block.</div></div>';
  h += '<div class="inv-panel inv-panel-flush" data-face-late><div class="inv-panel-head"><span class="inv-panel-title">Late blocks <span class="inv-panel-count">' + f.blocks.length + '</span></span>' +
    '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFaceBlkAdd">Add a block</button></div>' + (f.blocks.length ? '' : '<div class="inv-empty">No late block today.</div>') + '</div>' +
    f.blocks.map(function(b, i) { return faceBlockHtml(f, b, i, roster); }).join('');
  return h + faceActionBarHtml('Out-time roll of', f);
}
/* The roll saved from this form: its message for the group, and the day as the roll gave it. */
function faceRollSavedHtml(f) {
  var rp = (f.saved || []).map(function(id) { return relayPastes().find(function(p) { return p && p.id === id; }); }).filter(Boolean).pop();
  if (!rp) return '';
  var t = new Date(rp.at);
  return '<div class="inv-panel inv-panel-flush" data-card="faceRollSaved"><div class="inv-row inv-row-2 inv-row-flow"><span class="inv-row-main"><span class="inv-row-title">Saved at ' +
    escHtml(relayClockLabel(t.getHours() * 60 + t.getMinutes())) + '</span><span class="inv-row-meta inv-row-wrap">Send the group the roll as written here; change anything below and save again to restate the day.</span></span>' +
    '<span class="inv-row-end inv-row-actions inv-toolbar inv-toolbar-tight"><a class="inv-btn inv-btn-secondary inv-btn-sm" data-face-send-roll href="' + escHtml(faceWaHref(rp.text)) + '" target="_blank" rel="noopener">Send to the group</a>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFaceCopyRoll" data-id="' + escHtml(rp.id) + '">Copy</button></span></div>' +
    '<div class="inv-panel-body"><div class="inv-quote" data-face-roll-text>' + escHtml(rp.text) + '</div></div></div>';
}
async function faceRollSave() {
  var f = _faceForm;
  if (!f || (f.duty !== 'roll-in' && f.duty !== 'roll-out')) return;
  if (!grdOk('floor') && !(await guardAsk('floor', 'save the roll'))) return;
  if (_faceForm !== f) return;
  var night = function(b) { return b.from === '20:00' && (relayParseHhmm(b.out) - RELAY_GENERAL_OUT + 1440) % 1440 <= 180; };   // a night hold over by eight
  var bad = (f.blocks || []).findIndex(function(b) { return (b.crew || []).length ? !faceBlockHead(b.areas) || night(b) : (b.areas || []).length || parseFloat(b.extra) > 0; });
  if (bad >= 0) {
    var bb = f.blocks[bad];
    showToast(!(bb.crew || []).length ? 'Put the crew on block ' + (bad + 1) + ', or take it off' : night(bb) ? 'Block ' + (bad + 1) + ' ends before the night hold begins at 8 PM'
      : 'Tick the line block ' + (bad + 1) + ' ran on', 'error');
    var el = document.querySelector('[data-face-block="' + bad + '"]'); if (el) uiRevealEl(el);
    return;
  }
  var text = faceRollText(f), hash = relayHash(text), kind = f.duty === 'roll-in' ? 'in' : 'out', day = f.date;
  if (relayPastes().some(function(p) { return p && !p.replacedBy && p.hash === hash; })) { showToast('Saved already: nothing has changed since', 'info'); return; }
  // A roll of this kind already written on a face for the day is restated, never added to: a roll pasted on top only adds (a
  // hand taken off a block, an EXTRA cleared, stayed), so the day is read again from its rolls with this one in that one's place,
  // as Staff → Day's Read the rolls again reads it: what was entered by hand is kept, and the day as it was goes to the log.
  var rolls = relayRollsFor(day), was = rolls.filter(function(p) { return p.face && p.kind === kind; });
  var msg = { sentBy: '', sentOn: null, sentAt: null, wa: '', text: text, fresh: true, exact: true }, rv, outMsg = null, wasOut = [];
  if (was.length) {
    // The in-time roll written again after the face's out-time roll: who went home at five was worked out from the places, never
    // written, so it is worked out again with them (a hand now absent is not sent home, nor kept on a block).
    if (kind === 'in') wasOut = rolls.filter(function(p) { return p.face && p.kind === 'out'; });
    if (wasOut.length) {
      var fo = faceRollMake('roll-out', day), gone = {}, set = {};
      Object.keys(f.place).forEach(function(id) { if (f.place[id] === 'absent') gone[id] = true; });
      facePresentIds(day).concat(Object.keys(f.place).filter(function(id) { return f.place[id] && staffById(id); }))
        .forEach(function(id) { if (!gone[id]) set[id] = true; });
      fo.present = Object.keys(set);
      fo.blocks.forEach(function(b) { b.crew = b.crew.filter(function(id) { return !gone[id]; }); });
      var outText = faceRollText(fo);
      if (wasOut.some(function(p) { return p.text === outText; })) wasOut = [];
      else outMsg = { sentBy: '', sentOn: null, sentAt: null, wa: '', text: outText, fresh: true, exact: true };
    }
    var msgs = [];
    rolls.forEach(function(p) {
      // Each in the old one's place, so a later roll's out times still read last.
      if (was.indexOf(p) >= 0) { if (msgs.indexOf(msg) < 0) msgs.push(msg); }
      else if (wasOut.indexOf(p) >= 0) { if (msgs.indexOf(outMsg) < 0) msgs.push(outMsg); }
      else msgs.push({ sentBy: p.sentBy || '', sentOn: p.sentOn || null, sentAt: p.sentAt != null ? p.sentAt : null, text: p.text, exact: !!p.face });
    });
    rv = { text: msgs.map(function(m) { return m.text; }).join('\n\n'), msgs: msgs, reread: day, choices: faceRollChoices(text, f),
      rereadWhy: 'the ' + (kind === 'in' ? 'in-time' : 'out-time') + ' roll written again on ' + faceUserName() + '’s screen' };
  } else rv = { text: text, msgs: [msg], choices: faceRollChoices(text, f) };
  var plan = relayPlan(rv), mi = rv.msgs.indexOf(msg);
  if (msg.dup) { showToast('Saved already: nothing has changed since', 'info'); return; }
  // Only this roll's own questions stop it: the day's other rolls were checked when they were saved.
  var red = plan.issues.filter(function(x) { return x.tone === 'red' && x.mi === mi; });
  if (red.length) { uiAlert({ title: 'The roll could not be read back', body: red.map(function(x) { return x.text; }).join('\n') }); return; }
  var mine = msg.parsed && msg.parsed.days && msg.parsed.days[day];
  if (!plan.days.length || !mine || (!Object.keys(mine.people || {}).length && !(mine.extra || []).length)) {
    showToast(f.duty === 'roll-in' ? 'Mark where the hands stood first' : 'Put a hand on a block first', 'error'); return;
  }
  var done = relayApplyPlan(rv, plan, { face: faceUserName() }), now = Date.now();
  var made = done.ids.map(function(x) { return relayPastes().find(function(p) { return p && p.id === x; }); }).filter(Boolean);
  var mineRp = made.filter(function(p) { return p.kind === kind; }).pop(), outRp = outMsg ? made.filter(function(p) { return p.kind === 'out'; }).pop() : null;
  if (mineRp) {
    f.saved.push(mineRp.id);
    was.forEach(function(p) { p.replacedBy = mineRp.id; p.replacedAt = now; });
  }
  if (outRp) wasOut.forEach(function(p) { p.replacedBy = outRp.id; p.replacedAt = now; });
  saveState();
  _pageTyped = false;
  renderFace();
  viewTop();
  showToast((was.length ? 'The day restated from its rolls' + (outRp ? ', the out-time roll worked out again with it (open it to send it to the group)' : '') + ': ' : 'Saved: ') +
    todoPlural(done.marks, 'mark') + ', ' + todoPlural(done.extras, 'EXTRA row') + ' · send it to the group', 'success');
}
function faceRollCopy(id) {
  var rp = relayPastes().find(function(p) { return p && p.id === id; });
  if (!rp) return;
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(rp.text).then(function() { showToast('Roll copied: paste it in the group'); }, function() { uiAlert({ title: 'Copy the roll', body: rp.text }); });
  else uiAlert({ title: 'Copy the roll', body: rp.text });
}

/* A change to a roll's form by a tap (a crew chip, a block added or taken off, the usual places): the form is redrawn where it
   stands, and counts as typed (a tap that leaves asks first). */
function faceRollEdit(fn) {
  var f = _faceForm;
  if (!f || !f.blocks) return;
  fn(f);
  _pageTyped = true;
  keepScroll(renderFace);
}

/* ---------- A barrel batch ---------- */
/* Its form is the load's (the client, the part, the figure), with the barrel it went into and when it went in and came out. */
function faceBarrelHtml(f) {
  var parts = faceClientParts(f.clientId), units = pltUnits('barrel');
  var h = faceBackBar(f.replaces ? 'Correct a batch' : FACE_FORM_TITLE.barrel);
  if (f.replaces) h += '<div class="inv-callout inv-callout-info">This batch takes the place of the one corrected, which stays on the record, marked corrected.</div>';
  var barrel = units.length ? '<select id="faceBarrel" class="inv-select" data-face-f="barrel"><option value="">Pick the barrel</option>' +
      units.map(function(u) { return '<option value="' + escHtml(u.id) + '"' + (f.barrel === u.id ? ' selected' : '') + '>' + escHtml(u.name) + '</option>'; }).join('') + '</select>'
    : '<input id="faceBarrel" class="inv-input" data-face-f="barrel" value="' + escHtml(f.barrel || '') + '" autocomplete="off" placeholder="e.g. 2">';
  h += '<div class="inv-panel" data-face-form="barrel"><div class="inv-fields">' + faceField('faceBarrel', 'Barrel', barrel) + faceClientSelectHtml(f) + facePartFieldsHtml(f, parts) + faceQtyFieldsHtml(f) +
    faceField('faceTime', 'Went in at', '<input type="time" id="faceTime" class="inv-input" data-face-f="time" value="' + escHtml(f.time) + '">') +
    faceField('faceTimeOut', 'Came out at', '<input type="time" id="faceTimeOut" class="inv-input" data-face-f="timeOut" value="' + escHtml(f.timeOut || '') + '">') +
    '<label class="inv-field-check"><input type="checkbox" class="inv-check" id="faceRework" data-face-f="rework"' + (f.rework ? ' checked' : '') + '><span>Rework (counted as work, never billed)</span></label>' +
    '</div></div>';
  return h + faceSavedHtml(f) + faceActionBarHtml(f.replaces ? 'Correcting the batch of' : 'Plated on', f);
}
async function faceBarrelSave() {
  var f = _faceForm;
  if (!f || f.duty !== 'barrel') return;
  if (!grdOk('floor') && !(await guardAsk('floor', 'save a barrel batch'))) return;
  if (_faceForm !== f) return;
  var err = function(msg, id) { showToast(msg, 'error'); var el = id && document.getElementById(id); if (el) try { el.focus(); } catch (x) { /* a convenience */ } };
  if (!String(f.barrel || '').trim()) return err('Pick the barrel', 'faceBarrel');
  if (!f.clientId) return err('Pick the client', 'faceClient');
  if (!f.part || (f.part === FACE_TYPED && !String(f.partText || '').trim())) return err('Pick the part', f.part === FACE_TYPED ? 'facePartText' : 'facePart');
  var qty = parseFloat(f.qty);
  if (!(qty > 0)) return err('Enter the quantity', 'faceQty');
  if (!/^\d{1,2}:\d{2}$/.test(f.time || '')) return err('Enter when it went in', 'faceTime');
  if (f.timeOut && !/^\d{1,2}:\d{2}$/.test(f.timeOut)) return err('Enter when it came out, or leave it', 'faceTimeOut');
  var cid = prodHeldId(f.clientId), x = faceClientParts(f.clientId).find(function(p) { return p.key === f.part; }), t = relayParseHhmm(f.time);
  var unit = pltUnitById(f.barrel);
  var e = { id: prodUid('PE'), kind: 'plated', date: f.date, time: f.time, to: f.timeOut || null, line: 'barrel', lineSrc: 'written',
    slot: t < 510 || t >= 1020 ? 'ot' : 'general', clientId: cid, client: prodClientName(cid), qty: qty, unit: f.unit === 'KG' ? 'KG' : 'NOS', rework: !!f.rework,
    basis: 'register', src: 'face', by: faceUserName(), at: Date.now() };
  if (unit) { e.unitId = unit.id; e.barrel = unit.name; } else e.barrel = String(f.barrel).trim();
  if (x) { e.part = x.part; if (x.partNumber) e.partNumber = x.partNumber; e.gauge = x.gauge || null; }
  else { e.part = String(f.partText || '').trim(); e.gauge = prodGaugeOf(e.part, e.part) || null; }
  if (f.replaces) e.replaces = f.replaces;
  e.msgHash = prodMsgKey(f.date, faceMsgOf([e]));
  if (f.part === FACE_TYPED) prodLearnAliases([e]);
  prodData().entries.push(prodSparse(e));
  prodTouch();
  saveState();
  _pageTyped = false;
  if (f.replaces) { _faceForm = null; renderFace(); viewTop(); showToast('Correction saved; the batch it corrects is kept, marked corrected', 'success'); return; }
  f.saved.push(e.id);
  f.part = ''; f.partText = ''; f.qty = ''; f.rework = false; f.timeOut = '';
  f.time = f.date === localDateStr() ? faceNowHhmm() : f.time;
  renderFace();
  showToast('Saved · send it to the group, or enter the next', 'success');
}
/* What a batch's barrel takes: the kg a round typed on the unit, else the median of five or more of that barrel's own batches (a
   barrel of the plant register by its id, one typed where the register has none by its number as written). */
function faceBarrelKey(e) { return e.unitId ? 'u:' + e.unitId : 'b:' + String(e.barrel || '').trim().toUpperCase(); }
function faceBarrelUsual(batch) {
  var u = batch.unitId ? pltUnitById(batch.unitId) : null;
  if (u && u.kg > 0) return { kg: u.kg, src: 'set' };
  var key = faceBarrelKey(batch);
  var kg = prodIndex().live.filter(function(e) { return e.kind === 'plated' && e.line === 'barrel' && e.src === 'face' && !e.rework && faceBarrelKey(e) === key; })
    .map(function(e) { var w = prodWeigh(e); return w && w.kg; }).filter(function(v) { return v > 0; });
  return kg.length >= 5 ? { kg: numMedian(kg), src: 'batches' } : null;
}

/* ---------- F4: the register clerk's VAT register page (docs/ENTRY_FACES.md §2, F-clerk) ----------
   A page per line and day as the register keeps it: a round a row (its time, START or END, the figure as written: "98×8+1" and
   "3+4×156" are added up in code), the client and the part as the floor names them only where a run begins (the paper's ditto
   carries them down). The page is read by the photo's own reader (prodFromRegisterRead, prodRackCheck), so the START rule, the
   gauge, part and series rules, the shift's edges and the day's total read it unchanged, and its runs are the photo's: plated,
   `basis: 'register'`, `src: 'face'`, `pageId`. Two clients in one round are a row each at the same time.
   It is kept on this phone as it is typed (FACE_PAGE_KEY) and written to the book when saved: a page is a day's rounds, and a
   save at every round would leave a run voided at every next round. Saved again, it puts right what changed: a run whose rows
   are as they were stays as it is (with whatever the owner set on it), one that changed is voided and its new reading added, and
   the page before is kept, marked replaced. A page whose runs the owner corrected or voided in Production is the owner's. The
   power log is the day's, not a line's: a cut is saved at once, on its own, one log a day (`logId`), and both pages list them. */
FACE_FORM_TITLE.vat = 'A VAT register page';
var FACE_PAGE_KEY = 'sep_inv_face_page';       // the pages typed on this phone and not yet saved: uid|date|line → {rows, total, at}
var FACE_PAGE_KEEP_DAYS = 14;                   // a page typed and never saved is dropped after a fortnight
var FACE_VAT_LINES = ['vat-a1', 'vat-a2'];
/* How a line keeps its register: VAT A1 a round a row (its time and figure); VAT A2 a batch a row, written START and END on paper
   (when it began, when it ended, the figure written at its end). A batch whose start is left blank began where the one before it
   ended, as the reader takes an END with no START. */
var FACE_VAT_STYLES = [['rounds', 'Rounds'], ['batches', 'Batches']];
function faceVatStyleOf(line) { return line === 'vat-a2' ? 'batches' : 'rounds'; }
var FACE_VAT_REDO = 'The page was entered again on Mine';

function faceVatRowBlank(prev) { return { time: '', to: '', client: prev ? prev.client : '', part: prev ? prev.part : '', fig: '' }; }
function faceVatRowEmpty(r) { return !r.time && !r.to && !String(r.fig || '').trim(); }
/* A row as it is kept: on the phone, in the book. */
function faceVatRowClean(r) { return { time: r.time || '', to: r.to || '', client: r.client === '' || r.client == null ? '' : String(r.client), part: String(r.part || ''), fig: String(r.fig || '') }; }
function faceVatSameRun(a, b) { return !!a && !!b && String(a.client) === String(b.client) && String(a.part || '').trim().toUpperCase() === String(b.part || '').trim().toUpperCase(); }
/* The live page entered on Mine for a day and line (whoever entered it): the one not replaced. */
function faceVatPage(day, line) {
  return prodData().pages.filter(function(pg) { return pg && pg.date === day && pg.line === line && !pg.replacedBy; }).pop() || null;
}
/* The runs of a day's page on a line: every live run a version of it wrote (a run as it was stays under the version that wrote it). */
function faceVatRuns(day, line) {
  return prodIndex().live.filter(function(e) { return e.kind === 'plated' && e.src === 'face' && e.pageId && e.date === day && e.line === line; });
}
function faceVatDraftKey(day, line) { var u = faceUser(); return (u && u.id || '') + '|' + day + '|' + line; }
function faceVatDrafts() {
  try { var o = JSON.parse(localStorage.getItem(FACE_PAGE_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; }
}
function faceVatDraftPut(key, val) {
  try {
    var o = faceVatDrafts(), old = isoAddDays(localDateStr(), -FACE_PAGE_KEEP_DAYS);
    Object.keys(o).forEach(function(k) { if (!o[k] || String(k.split('|')[1] || '') < old) delete o[k]; });
    if (val) o[key] = val; else delete o[key];
    localStorage.setItem(FACE_PAGE_KEY, JSON.stringify(o));
  } catch (e) { /* a convenience: the page on screen is still the form's */ }
}
/* The page typed so far, kept on the phone at every change. */
function faceVatKeep(f) {
  if (!f || f.duty !== 'vat') return;
  var rows = f.rows.filter(function(r) { return !faceVatRowEmpty(r); });
  var pg = faceVatPage(f.date, f.line);
  // Nothing typed past what the book holds is nothing to keep.
  if (!rows.length && String(f.total || '') === '' && !pg) { faceVatDraftPut(faceVatDraftKey(f.date, f.line), null); f.draftAt = 0; return; }
  if (pg && JSON.stringify(faceVatRowsOut(f.rows)) === JSON.stringify(pg.rows || []) && f.style === (pg.style || faceVatStyleOf(pg.line)) && String(f.total || '') === (pg.total != null ? String(pg.total) : '')) {
    faceVatDraftPut(faceVatDraftKey(f.date, f.line), null); f.draftAt = 0; return;
  }
  f.draftAt = Date.now();
  faceVatDraftPut(faceVatDraftKey(f.date, f.line), { rows: f.rows.map(faceVatRowClean), style: f.style, total: f.total, at: f.draftAt });
}
/* The rows as the book keeps them: the typed ones, each whole. */
function faceVatRowsOut(rows) {
  return rows.filter(function(r) { return !faceVatRowEmpty(r); }).map(function(r) {
    var c = faceVatRowClean(r); c.part = c.part.trim(); c.fig = c.fig.trim(); return c;
  });
}
/* The line to open on: the one a page was being typed on, else the first with nothing recorded that day, else VAT A1. */
function faceVatLineFor(day) {
  var d = faceVatDrafts(), u = faceUser(), uid = u && u.id || '';
  var typed = FACE_VAT_LINES.filter(function(l) { return d[uid + '|' + day + '|' + l]; });
  if (typed.length) return typed[0];
  return FACE_VAT_LINES.find(function(l) { return !prodDayLine(day, l).entries.length; }) || 'vat-a1';
}
function faceVatMake(day, line) {
  var f = { duty: 'vat', date: day, line: FACE_VAT_LINES.indexOf(line) >= 0 ? line : faceVatLineFor(day), rows: [], total: '', saved: [], cut: { at: '', back: '' }, draftAt: 0, replaces: null };
  var draft = faceVatDrafts()[faceVatDraftKey(f.date, f.line)], pg = faceVatPage(f.date, f.line);
  f.style = faceVatStyleOf(f.line);
  if (draft && Array.isArray(draft.rows)) {
    f.rows = draft.rows.map(faceVatRowClean);
    f.total = draft.total != null ? String(draft.total) : ''; f.draftAt = draft.at || 0;
    if (draft.style === 'rounds' || draft.style === 'batches') f.style = draft.style;
  } else if (pg) {
    f.rows = (pg.rows || []).map(faceVatRowClean);
    f.total = pg.total != null ? String(pg.total) : '';
    if (pg.style === 'rounds' || pg.style === 'batches') f.style = pg.style;
  }
  if (!f.rows.length) f.rows.push(faceVatRowBlank(null));
  return f;
}
/* A time typed for the reader: the shop's own "9:45 AM"; past midnight written "00:30", which the reader keeps as the night
   (its noon rule reads "12:30 AM" as the day's noon, and a bare 1 to 6 as the afternoon). */
function faceVatClock(t) {
  var m = relayParseHhmm(t);
  if (m == null) return null;
  return m < 60 ? '00:' + String(m).padStart(2, '0') : faceClock(m);
}
/* The page read as the photo's reader reads a page: its runs, each row's reading and what it asks. `map` turns the reader's row
   back into the form's. */
function faceVatRead(f) {
  var map = [], rows = [];
  f.rows.forEach(function(r, k) {
    if (faceVatRowEmpty(r)) return;
    var who = { customer: r.client !== '' && r.client != null ? String(prodClientName(r.client) || '') || null : null, part: String(r.part || '').trim() || null };
    // A batch is the register's two rows: START when it began (where written), END when it ended, carrying the figure.
    if (f.style === 'batches') {
      if (r.time) { map.push(k); rows.push(Object.assign({ time: faceVatClock(r.time), mark: 'START', qtyText: null }, who)); }
      map.push(k); rows.push(Object.assign({ time: r.to ? faceVatClock(r.to) : null, mark: 'END', qtyText: String(r.fig || '').trim() || null }, who));
      return;
    }
    map.push(k);
    rows.push(Object.assign({ time: r.time ? faceVatClock(r.time) : null, mark: null, qtyText: String(r.fig || '').trim() || null }, who));
  });
  var d = f.date.split('-');
  var json = { page: 'production', date: d[2] + '/' + d[1] + '/' + String(d[0]).slice(2), weekday: null, line: PROD_LINE_LABEL[f.line],
    dayTotal: String(f.total || '').trim() !== '' && isFinite(+f.total) ? +f.total : null, rows: rows };
  var rd = prodRackCheck(prodFromRegisterRead(json, prodCtx(), f.date, { date: f.date, line: f.line }), f.line);
  rd.map = map;
  rd.byRow = {};
  rd.rows.forEach(function(x) { var k = map[x.i]; if (k != null) (rd.byRow[k] = rd.byRow[k] || []).push(x); });
  rd.runOf = {};
  rd.runs.forEach(function(e, ri) { var k = e.rows && e.rows.length ? map[e.rows[0].i] : null; if (k != null) (rd.runOf[k] = rd.runOf[k] || []).push(ri); });
  return rd;
}
/* The page for the group: the day, the line, a round a line as the clerk would write it, and the total. */
function faceVatText(date, line, rows, counted, style) {
  var d = String(date).split('-');
  var out = [d[2] + '/' + d[1] + '/' + String(d[0]).slice(2), (PROD_LINE_LABEL[line] || line).toUpperCase() + ' REGISTER'];
  (rows || []).forEach(function(r) {
    if (faceVatRowEmpty(r)) return;
    var t = relayParseHhmm(r.time), t2 = relayParseHhmm(r.to);
    var when = (style || faceVatStyleOf(line)) === 'batches' ? (t != null ? faceClock(t) + ' TO ' : 'TO ') + (t2 != null ? faceClock(t2) : '') : t != null ? faceClock(t) : '';
    out.push([when, String(prodClientName(r.client) || '').toUpperCase(), String(r.part || '').trim().toUpperCase(), String(r.fig || '').trim()].filter(Boolean).join(' - '));
  });
  if (counted != null) out.push('TOTAL ' + Math.round(counted).toLocaleString('en-IN') + ' NOS');
  return out.join('\n');
}
/* The floor's names this client's runs were written as, the latest first, and the client's challan parts: the part field's list. */
function faceVatPartNames(cid, line) {
  if (cid === '' || cid == null) return [];
  var since = isoAddDays(localDateStr(), -60), seen = {}, out = [];
  var add = function(s) { s = String(s || '').trim(); var k = s.toUpperCase(); if (s && !seen[k]) { seen[k] = true; out.push(s); } };
  prodIndex().live.filter(function(e) { return e.kind === 'plated' && String(e.clientId) === String(cid) && e.date >= since; })
    .sort(function(a, b) { return (b.line === line) - (a.line === line) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0); })
    .forEach(function(e) { add(String(e.part || '').replace(/\s*\((\d{2}X\d)\)$/i, '')); });
  faceClientParts(cid).forEach(function(x) { add(x.partNumber || x.part); });
  return out.slice(0, 40);
}

function faceVatHtml(f) {
  var rd = faceVatRead(f), pg = faceVatPage(f.date, f.line), runs = faceVatRuns(f.date, f.line), idx = prodIndex();
  var h = faceBackBar(FACE_FORM_TITLE.vat);
  h += '<div class="inv-panel"><div class="inv-seg" role="group" aria-label="Line">' + FACE_VAT_LINES.map(function(l) {
    return '<button class="inv-seg-btn" data-action="invFaceVatLine" data-line="' + l + '" aria-pressed="' + (f.line === l) + '">' + escHtml(PROD_LINE_LABEL[l]) + '</button>'; }).join('') + '</div>' +
    '<div class="inv-seg inv-mt-8" role="group" aria-label="How the page is kept">' + FACE_VAT_STYLES.map(function(x) {
      return '<button class="inv-seg-btn" data-action="invFaceVatStyle" data-style="' + x[0] + '" aria-pressed="' + (f.style === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
  var sd = pg && pg.at ? new Date(pg.at) : null;
  var note = pg ? 'Saved' + (sd ? ' at ' + relayClockLabel(sd.getHours() * 60 + sd.getMinutes()) + (isoOf(sd) !== localDateStr() ? ' on ' + formatDate(isoOf(sd)) : '') : '') + (pg.by ? ' by ' + pg.by : '') + '. Saving again puts right what changed.'
    : (f.style === 'batches' ? 'Each batch as the register writes it: when it began, when it ended and the figure at its end.' : 'Each round as the register writes it: its time and its figure.') + ' Kept on this phone as you type; saved to the book when you save the page.';
  h += '<div class="inv-note inv-mt-8" data-face-vat-state="' + (f.draftAt ? 'draft' : pg ? 'saved' : 'new') + '">' + escHtml(note + (f.draftAt && pg ? ' Changes since are kept on this phone, not saved yet.' : '')) + '</div></div>';
  // Another record of this page: a photo of it, or a page saved from a file. Saved twice, the day is counted twice.
  var other = idx.live.filter(function(e) { return e.kind === 'plated' && e.date === f.date && e.line === f.line && e.basis === 'register' && !e.pageId && !idx.replaced[e.id]; });
  if (other.length) h += '<div class="inv-callout inv-callout-warning" data-face-vat-dup>' + escHtml((other.some(function(e) { return e.photoId; }) ? 'A photo of the ' : 'The ') + PROD_LINE_LABEL[f.line] +
    ' register for this day is already in the book (' + todoPlural(other.length, 'run') + '). Saving the page here as well counts the day twice: enter only what the photo does not hold.') + '</div>';
  // The rounds: a run's client and part where it begins, then its rounds a line each.
  var batches = f.style === 'batches', noun = batches ? 'Batch' : 'Round', typedN = f.rows.filter(function(r) { return !faceVatRowEmpty(r); }).length;
  h += '<div class="inv-panel inv-panel-flush" data-face-form="vat" data-nodirty><div class="inv-panel-head"><span class="inv-panel-title">' + noun + 'es'.slice(batches ? 0 : 1) + ' <span class="inv-panel-count">' + typedN + '</span></span>' +
    (f.draftAt ? '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFaceVatDrop">' + (pg ? 'Put back as saved' : 'Start again') + '</button>' : '') + '</div>' +
    '<div class="inv-rnd-row inv-rnd-head' + (batches ? ' inv-rnd-batch' : '') + '" aria-hidden="true">' + (batches ? '<span>Began</span><span>Ended</span>' : '<span>Time</span><span>Figure</span>') + '<span></span></div>';
  var clients = faceClientsSorted(), lists = {};
  f.rows.forEach(function(r, k) {
    var head = k === 0 || f.openHead === k || !faceVatSameRun(r, f.rows[k - 1]), n = k + 1;
    if (head) {
      var cid = r.client === '' || r.client == null ? '' : String(r.client), opt = function(c) { return '<option value="' + escHtml(String(c.id)) + '"' + (cid === String(c.id) ? ' selected' : '') + '>' + escHtml(c.name) + '</option>'; };
      var lk = 'faceVatParts' + Object.keys(lists).length;
      if (cid && !lists[cid]) lists[cid] = lk; else if (cid) lk = lists[cid];
      h += '<div class="inv-rnd-row inv-rnd-run" data-face-vat-run="' + k + '">' +
        '<div class="inv-field"><label class="inv-field-label" for="faceVatClient' + k + '">Client</label><select id="faceVatClient' + k + '" class="inv-select" data-face-vat="' + k + '" data-k="client"><option value="">Pick the client</option>' +
          (clients.open.length ? '<optgroup label="Material open">' + clients.open.map(opt).join('') + '</optgroup>' : '') +
          (clients.rest.length ? '<optgroup label="' + (clients.open.length ? 'Other clients' : 'Clients') + '">' + clients.rest.map(opt).join('') + '</optgroup>' : '') + '</select></div>' +
        '<div class="inv-field inv-rnd-tail"><label class="inv-field-label" for="faceVatPart' + k + '">Part, as written</label><input id="faceVatPart' + k + '" class="inv-input" data-face-vat="' + k + '" data-k="part" value="' + escHtml(r.part || '') + '" autocomplete="off" placeholder="e.g. CLAMP"' + (cid ? ' list="' + lk + '"' : '') + '></div>';
      (rd.runOf[k] || []).forEach(function(ri) {
        var e = rd.runs[ri];
        h += '<div class="inv-rnd-wide inv-row-meta inv-row-wrap" data-face-vat-reads="' + k + '">' + escHtml('Read as ' + [prodClientName(e.clientId) || e.client || 'no client', e.part, e.partNumber && e.partNumber !== e.part ? e.partNumber : '',
          e.gaugeOptions ? 'gauge ' + e.gaugeOptions.join(' or ') : '', prodQtyText(e.qty, 'NOS') + (e.rounds && e.rounds.length ? ' in ' + todoPlural(e.rounds.length, e.rounds.some(function(x) { return x.batch; }) ? 'batch' : 'round', e.rounds.some(function(x) { return x.batch; }) ? 'batches' : 'rounds') : '')].filter(Boolean).join(' · ')) + '</div>';
        e.issues.forEach(function(x) { h += faceVatIssueHtml(x); });
      });
      h += '</div>';
    }
    var fig = '<input class="inv-input inv-input-num' + (batches ? ' inv-rnd-lead' : '') + '" data-face-vat="' + k + '" data-k="fig" value="' + escHtml(r.fig || '') + '" inputmode="text" autocapitalize="off" autocomplete="off" placeholder="' +
      (batches ? 'Figure at its end, e.g. 3×156' : 'e.g. 120') + '" aria-label="' + noun + ' ' + n + ': the figure, as written">';
    var del = '<button class="inv-btn inv-btn-ghost inv-btn-icon" data-action="invFaceVatDel" data-i="' + k + '" aria-label="Remove ' + noun.toLowerCase() + ' ' + n + '" title="Remove ' + noun.toLowerCase() + ' ' + n + '">' + LINE_X_ICON + '</button>';
    h += '<div class="inv-rnd-row' + (batches ? ' inv-rnd-batch' : '') + '" data-face-vat-row="' + k + '">' +
      '<input type="time" class="inv-input" data-face-vat="' + k + '" data-k="time" value="' + escHtml(r.time || '') + '" aria-label="' + noun + ' ' + n + (batches ? ': when it began (blank: where the one before ended)' : ': time') + '">' +
      (batches ? '<input type="time" class="inv-input" data-face-vat="' + k + '" data-k="to" value="' + escHtml(r.to || '') + '" aria-label="Batch ' + n + ': when it ended">' + del + fig : fig + del);
    (rd.byRow[k] || []).forEach(function(x) {
      var bits = [];
      if (x.qty != null && x.written != null && String(x.qty) !== String(x.written).trim()) bits.push('= ' + Math.round(x.qty).toLocaleString('en-IN') + (x.rackSize && x.rounds ? ' (' + x.rounds + ' × ' + x.rackSize + ')' : ''));
      if (bits.length) h += '<div class="inv-rnd-wide inv-row-meta" data-face-vat-reading="' + k + '">' + escHtml(bits.join(' ')) + '</div>';
      // What the reading line already says ("3+4×156" as seven racks) is not said again.
      x.issues.forEach(function(q) { if (q.code !== 'grouped') h += faceVatIssueHtml(q); });
    });
    // The last round can begin another run: its client and part open where it stands (a round in the middle is removed and
    // added again, as on paper a new line is written).
    if (k === f.rows.length - 1 && !head) h += '<div class="inv-rnd-wide"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFaceVatSplit" data-i="' + k + '">Another client or part</button></div>';
    h += '</div>';
  });
  Object.keys(lists).forEach(function(cid) { h += '<datalist id="' + lists[cid] + '">' + faceVatPartNames(cid, f.line).map(function(s) { return '<option value="' + escHtml(s) + '">'; }).join('') + '</datalist>'; });
  h += '<div class="inv-panel-body"><button class="inv-btn inv-btn-secondary inv-btn-block" data-action="invFaceVatAdd">Add a ' + noun.toLowerCase() + '</button></div>';
  h += '<div class="inv-panel-body"><div class="inv-fields">' + faceField('faceVatTotal', 'Day total on the paper page (if it has one)',
    '<input type="number" inputmode="numeric" min="0" step="any" id="faceVatTotal" class="inv-input inv-input-num" data-face-vat-total value="' + escHtml(f.total || '') + '">',
    '<div class="inv-field-hint">Set against the ' + noun.toLowerCase() + 'es'.slice(batches ? 0 : 1) + ': one missed shows here.</div>') + '</div>' +
    rd.issues.filter(function(x) { return x.code === 'total'; }).map(function(x) { return '<div class="inv-callout inv-callout-warning" data-face-vat-total-q>' + escHtml(x.text) + '</div>'; }).join('') + '</div></div>';
  h += faceVatCutsHtml(f);
  if (runs.length) h += faceVatSavedHtml(f, runs);
  var counted = Math.round(rd.counted || 0);
  return h + '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">' + escHtml(PROD_LINE_LABEL[f.line] + ' · ' + stockShortDate(f.date)) + '</div><div class="inv-actionbar-value" data-face-vat-counted>' +
    escHtml(counted.toLocaleString('en-IN') + ' NOS') + '</div></div><button class="inv-btn inv-btn-primary" data-action="invFaceSave">Save the page</button></div>';
}
/* What the reader asks of a round or a run: a question as a callout in its tone; what it only says (the START rule, a gauge read
   from the round) as a line under it. */
function faceVatIssueHtml(x) {
  if (x.tone === 'info') return '<div class="inv-rnd-wide inv-row-meta inv-row-wrap" data-face-vat-q="' + escHtml(x.code) + '">' + escHtml(x.text) + '</div>';
  return '<div class="inv-rnd-wide inv-callout inv-callout-' + uiTone(x.tone) + '" data-face-vat-q="' + escHtml(x.code) + '">' + escHtml(x.text) + '</div>';
}
/* The page as the book holds it: its runs, the message for the group, Done. */
function faceVatSavedHtml(f, runs) {
  var total = runs.reduce(function(s, e) { return s + (e.qty || 0); }, 0), pg = faceVatPage(f.date, f.line);
  var text = pg ? faceVatText(pg.date, pg.line, pg.rows, total, pg.style) : '';
  return '<div class="inv-panel inv-panel-flush inv-mt-8" data-card="faceSaved"><div class="inv-panel-head"><span class="inv-panel-title">In the book <span class="inv-panel-count">' + runs.length + '</span></span>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFaceFormDone">Done</button></div>' +
    runs.slice().sort(function(a, b) { return String(a.time || '').localeCompare(String(b.time || '')); }).map(function(e) {
      var cs = faceCheckOf(e);
      return '<div class="inv-row inv-row-2 inv-row-flow" data-face-entry="' + escHtml(e.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(prodEntryTitle(e)) + '</span>' +
        '<span class="inv-row-meta inv-row-wrap">' + escHtml([e.time ? e.time + (e.to && e.to !== e.time ? '–' + e.to : '') : '', prodQtyText(e.qty, e.unit), e.rounds && e.rounds.length ? todoPlural(e.rounds.length, 'round') : ''].filter(Boolean).join(' · ')) + '</span>' +
        (cs.length ? '<span class="inv-row-meta inv-row-wrap" data-face-check>' + uiDot(cs[0].tone, escHtml('To check: ' + cs[0].text)) + '</span>' : '') + '</span></div>';
    }).join('') +
    (text ? '<div class="inv-panel-body inv-toolbar inv-toolbar-tight"><a class="inv-btn inv-btn-secondary inv-btn-sm" data-face-send="page" href="' + escHtml(faceWaHref(text)) + '" target="_blank" rel="noopener">Send to the group</a>' +
      '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFaceVatCopy">Copy</button></div>' : '') + '</div>';
}
/* The day's power cuts, from every record of them, and one to add. */
function faceVatCutsHtml(f) {
  var cuts = prodDowntimeDay(f.date), idx = prodIndex();
  var h = '<div class="inv-panel inv-panel-flush inv-mt-8" data-card="faceCuts"><div class="inv-panel-head"><span class="inv-panel-title">Power cuts on the day <span class="inv-panel-count">' + cuts.length + '</span></span></div>';
  cuts.forEach(function(c) {
    var t = relayParseHhmm(c.time), b = c.to != null ? relayParseHhmm(c.to) : null, e = idx.byId[c.ids[0]] || {};
    var who = c.ids.map(function(id) { var x = idx.byId[id]; return x ? (x.src === 'face' ? 'on Mine' : x.basis === 'register' ? 'the register' : x.basis === 'pickling' || x.basis === 'relay' ? 'a message' : 'by hand') : ''; })
      .filter(function(v, i, a) { return v && a.indexOf(v) === i; }).join(', ');
    h += '<div class="inv-row inv-row-2" data-face-cut="' + escHtml(c.ids[0]) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(relayClockLabel(t) + (b != null ? ' – ' + relayClockLabel(b) : ', no time back yet')) + '</span>' +
      '<span class="inv-row-meta">' + escHtml([b != null ? powerDur(c.min) : '', who].filter(Boolean).join(' · ')) + '</span></span>' +
      '<span class="inv-row-end"><button class="inv-btn inv-btn-' + (b == null ? 'secondary' : 'ghost') + ' inv-btn-sm" data-action="invFaceVatCutOpen" data-id="' + escHtml(c.ids[0]) + '">' + (b == null ? 'Power back' : 'Why') + '</button></span></div>';
  });
  h += '<div class="inv-panel-body"><div class="inv-fields">' +
    faceField('faceCutAt', 'Power cut at', '<input type="time" id="faceCutAt" class="inv-input" data-face-cut-f="at" value="' + escHtml(f.cut.at || '') + '">') +
    faceField('faceCutBack', 'Power back at (if it is)', '<input type="time" id="faceCutBack" class="inv-input" data-face-cut-f="back" value="' + escHtml(f.cut.back || '') + '">') +
    '</div><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFaceVatCut">Save the cut</button>' +
    '<div class="inv-field-hint">One log for the day, whichever line you are on: a cut the pickling messages also sent is counted once.</div></div></div>';
  return h;
}

/* ---------- Saving a page ---------- */
async function faceVatSave() {
  var f = _faceForm;
  if (!f || f.duty !== 'vat') return;
  if (!grdOk('floor') && !(await guardAsk('floor', 'save a register page'))) return;
  if (_faceForm !== f) return;
  var err = function(msg, sel) { showToast(msg, 'error'); var el = sel && document.querySelector(sel); if (el && !touchScreen()) try { el.focus(); } catch (x) { /* a convenience */ } };
  var typed = f.rows.map(function(r, k) { return { r: r, k: k }; }).filter(function(x) { return !faceVatRowEmpty(x.r); });
  var batches = f.style === 'batches';
  if (!typed.length) return err(batches ? 'Enter a batch: when it ended and its figure' : 'Enter a round: its time and its figure');
  for (var i = 0; i < typed.length; i++) {
    var r = typed[i].r, k = typed[i].k, n = (batches ? 'Batch ' : 'Round ') + (k + 1), at = '[data-face-vat="' + k + '"][data-k="';
    if (batches) {
      if (relayParseHhmm(r.to) == null) return err(n + ': enter when it ended', at + 'to"]');
      if (r.time && relayParseHhmm(r.time) >= relayParseHhmm(r.to)) return err(n + ': it ends before it begins', at + 'time"]');
    } else if (relayParseHhmm(r.time) == null) return err(n + ': enter its time', at + 'time"]');
    if (r.client === '' || r.client == null) return err(n + ': pick the client', '#faceVatClient' + faceVatHeadOf(f, k));
    if (!String(r.part || '').trim()) return err(n + ': write the part as the register names it', '#faceVatPart' + faceVatHeadOf(f, k));
    if (!String(r.fig || '').trim()) return err(n + ': enter its figure', at + 'fig"]');
  }
  var rd = faceVatRead(f);
  // A figure the reader cannot add up is never saved as nothing: it is written again.
  var bad = rd.rows.find(function(x) { return x.issues.some(function(q) { return q.code === 'figure'; }); });
  if (bad) return err((batches ? 'Batch ' : 'Round ') + (rd.map[bad.i] + 1) + ': "' + bad.written + '" could not be added up. Write it as the register does (120, 98×8+1, 3+4×156)', '[data-face-vat="' + rd.map[bad.i] + '"][data-k="fig"]');
  var idx = prodIndex(), old = faceVatPage(f.date, f.line), at = Date.now(), by = faceUserName(), u = faceUser();
  var oldRuns = faceVatRuns(f.date, f.line);
  // A run of this page the owner corrected or voided in Production: the page is theirs now, and saving it again here would
  // bring back what they put right.
  var touched = prodData().entries.filter(function(e) { return e.kind === 'plated' && e.src === 'face' && e.pageId && e.date === f.date && e.line === f.line && ((e.voidedAt && e.voidReason !== FACE_VAT_REDO) || idx.replaced[e.id]); });
  if (touched.length) {
    await uiAlert({ title: 'Corrected in Production', body: 'This page has ' + todoPlural(touched.length, 'run') + ' put right in Production (Entries). Saving it again here would bring back what was corrected: put anything else right there too, or ask the owner.' });
    return;
  }
  var other = idx.live.filter(function(e) { return e.kind === 'plated' && e.date === f.date && e.line === f.line && e.basis === 'register' && !e.pageId && !idx.replaced[e.id]; });
  if (other.length && !old) {
    var go = await uiConfirm({ title: 'Count the day twice?', body: 'The ' + PROD_LINE_LABEL[f.line] + ' register for ' + formatDate(f.date) + ' is already in the book (' + todoPlural(other.length, 'run') +
      (other.some(function(e) { return e.photoId; }) ? ', from a photo' : '') + '). Saving this page as well counts both.', okLabel: 'Save anyway' });
    if (!go || _faceForm !== f) return;
  }
  var p = prodData(), rowsOut = faceVatRowsOut(f.rows);
  var pg = { id: prodUid('PG'), date: f.date, line: f.line, style: f.style, rows: rowsOut, by: by, uid: u && u.id || '', at: at, fp: rd.fp, counted: rd.counted };
  if (String(f.total || '').trim() !== '' && isFinite(+f.total)) pg.total = +f.total;
  if (old) pg.replaces = old.id;
  var text = faceVatText(f.date, f.line, rowsOut, rd.counted, f.style), hash = prodMsgKey(f.date, text);
  // A run is its rows: one whose rows read as they did stays as it is; any other is voided and its reading added.
  var sig = function(e) { return [String(e.clientId), e.slot || '', String(e.raw || '')].join('\n'); };
  var keep = {}, kept = 0, added = 0, voided = 0;
  oldRuns.forEach(function(e) { (keep[sig(e)] = keep[sig(e)] || []).push(e); });
  var fresh = [];
  rd.runs.forEach(function(e) {
    var rec = Object.assign({}, e, { id: prodUid('PE'), date: f.date, line: f.line, lineSrc: 'written', src: 'face', pageId: pg.id, msgHash: hash, by: by, at: at });
    delete rec.rows; delete rec.issues; delete rec.clientName;
    var same = keep[sig(rec)];
    if (same && same.length) { same.shift(); kept++; return; }
    fresh.push(rec);
  });
  Object.keys(keep).forEach(function(k) { keep[k].forEach(function(e) { e.voidedAt = at; e.voidReason = FACE_VAT_REDO; e.voidBy = by; voided++; }); });
  if (old) { old.replacedBy = pg.id; old.replacedAt = at; }
  p.pages.push(pg);
  fresh.forEach(function(rec) { prodLearnAliases([rec]); p.entries.push(prodSparse(rec)); added++; });
  prodTouch();
  saveState();
  faceVatDraftPut(faceVatDraftKey(f.date, f.line), null);
  _faceForm = faceVatMake(f.date, f.line);
  _pageTyped = false;
  renderFace();
  showToast(old ? 'Page saved again: ' + [added ? todoPlural(added, 'run') + ' new' : '', voided ? todoPlural(voided, 'run') + ' put right' : '', kept ? kept + ' as ' + (kept === 1 ? 'it was' : 'they were') : ''].filter(Boolean).join(', ')
    : 'Page saved: ' + todoPlural(added, 'run') + ', ' + Math.round(rd.counted || 0).toLocaleString('en-IN') + ' NOS · send it to the group', 'success');
}
/* The row whose client and part a round shares: the first row of its run. */
function faceVatHeadOf(f, k) { while (k > 0 && f.openHead !== k && faceVatSameRun(f.rows[k], f.rows[k - 1])) k--; return k; }
/* A cut, saved at once: the register's power log on Mine, one log a day. */
async function faceVatCutSave() {
  var f = _faceForm;
  if (!f || f.duty !== 'vat') return;
  if (!grdOk('floor') && !(await guardAsk('floor', 'save a power cut'))) return;
  if (_faceForm !== f) return;
  var a = relayParseHhmm(f.cut.at), b = f.cut.back ? relayParseHhmm(f.cut.back) : null;
  if (a == null) { showToast('Enter when the power went', 'error'); return; }
  if (f.cut.back && b == null) { showToast('Enter when it came back, or leave it', 'error'); return; }
  var log = 'face|' + f.date;
  if (prodIndex().live.some(function(e) { return e.kind === 'downtime' && e.logId === log && relayParseHhmm(e.time) === a; })) { showToast('That cut is already saved', 'warning'); return; }
  if (b != null && b < a) {
    var ok = await uiConfirm({ title: 'Did the power stay off overnight?', body: 'The power came back at ' + relayClockLabel(b) + ', earlier on the clock than the cut at ' + relayClockLabel(a) +
      '. Saved as it is, the cut ran overnight: ' + powerDur(b + 1440 - a) + '. Check the times if it did not.', okLabel: 'Yes, overnight' });
    if (!ok || _faceForm !== f) return;
  }
  prodData().entries.push(prodSparse({ id: prodUid('PE'), kind: 'downtime', date: f.date, time: prodHhmm(a), to: b != null ? prodHhmm(b) : null, downtime: { cause: 'power', open: b == null },
    basis: 'register', src: 'face', logId: log, by: faceUserName(), at: Date.now() }));
  prodTouch();
  saveState();
  f.cut = { at: '', back: '' };
  _pageTyped = false;
  keepScroll(renderFace);
  showToast(b == null ? 'Cut saved · Power back on it when it comes' : 'Cut saved', 'success');
}
function faceVatCopy() {
  var f = _faceForm, pg = f && faceVatPage(f.date, f.line);
  if (!pg) return;
  var runs = faceVatRuns(f.date, f.line), text = faceVatText(pg.date, pg.line, pg.rows, runs.reduce(function(s, e) { return s + (e.qty || 0); }, 0), pg.style);
  var done = function() { showToast('Page copied: paste it in the group'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function() { uiAlert({ title: 'Copy the page', body: text }); });
  else uiAlert({ title: 'Copy the page', body: text });
}
async function faceVatDrop() {
  var f = _faceForm;
  if (!f || f.duty !== 'vat') return;
  var pg = faceVatPage(f.date, f.line);
  var ok = await uiConfirm({ title: pg ? 'Put the page back as saved?' : 'Start the page again?', body: pg ? 'What was typed on this phone since it was saved goes.' : 'Every round typed on this phone for this page goes.', okLabel: pg ? 'Put back' : 'Start again', danger: true });
  if (!ok || _faceForm !== f) return;
  faceVatDraftPut(faceVatDraftKey(f.date, f.line), null);
  _faceForm = faceVatMake(f.date, f.line);
  keepScroll(renderFace);
}
/* A change on the page: kept on the phone at once. A run's client or part moves the rounds under it that were the same (the
   ditto carries down). */
function faceVatChange(t, redraw) {
  var f = _faceForm;
  if (!f || f.duty !== 'vat') return false;
  if (t.dataset.faceVatTotal !== undefined) { f.total = t.value; faceVatKeep(f); if (redraw) faceVatRedraw(); return true; }
  if (t.dataset.faceCutF !== undefined) { f.cut[t.dataset.faceCutF] = t.value; return true; }
  if (t.dataset.faceVat === undefined) return false;
  var k = +t.dataset.faceVat, key = t.dataset.k, r = f.rows[k];
  if (!r || ['time', 'to', 'client', 'part', 'fig'].indexOf(key) < 0) return true;
  if (key === 'client' || key === 'part') {
    // What the run was before this edit began (the part is typed a letter at a time): the rounds under it that were the same follow.
    if (!r._was) r._was = { client: r.client, part: r.part };
    r[key] = t.value;
    if (redraw) {
      var was = r._was;
      delete r._was;
      for (var j = k + 1; j < f.rows.length && faceVatSameRun(f.rows[j], was); j++) f.rows[j][key] = t.value;
      if (f.openHead === k) f.openHead = null;
    }
  } else r[key] = t.value;
  faceVatKeep(f);
  if (redraw) { if (key === 'client') keepScroll(renderFace); else faceVatRedraw(); }
  return true;
}
/* The page drawn again around the field being typed in (People → Day's way, attSwapAround): a change fires on the blur a tap on
   the next field causes, so the redraw waits for that tap to land, then keeps whichever field the focus is in. With none, the page
   is drawn whole. */
function faceVatRedraw(landed) {
  if (_attAfterTap(function() { faceVatRedraw(true); })) return;
  if (!landed) { setTimeout(function() { faceVatRedraw(true); }, 0); return; }
  if (!_faceForm || _faceForm.duty !== 'vat') return;
  keepScroll(function() {
    var root = document.getElementById('faceContent'), keep = document.activeElement;
    if (!keep || !/^(INPUT|TEXTAREA)$/.test(keep.tagName)) keep = null;
    if (keep && root && root.contains(keep) && attSwapAround(root, faceVatHtml(_faceForm), keep)) return;
    renderFace();
  });
}
function faceVatAction(action, btn) {
  var f = _faceForm;
  if (!f || f.duty !== 'vat') return false;
  var k = +btn.dataset.i;
  switch (action) {
    case 'invFaceVatLine':
      if (FACE_VAT_LINES.indexOf(btn.dataset.line) < 0 || btn.dataset.line === f.line) return true;
      _faceForm = faceVatMake(f.date, btn.dataset.line); renderFace(); viewTop(); return true;
    case 'invFaceVatAdd':
      f.rows.push(faceVatRowBlank(f.rows[f.rows.length - 1])); faceVatKeep(f); keepScroll(renderFace);
      var tm = document.querySelector('[data-face-vat="' + (f.rows.length - 1) + '"][data-k="time"]');
      if (tm && !touchScreen()) try { tm.focus(); } catch (x) { /* a convenience */ }
      return true;
    case 'invFaceVatDel':
      if (!f.rows[k]) return true;
      f.rows.splice(k, 1);
      if (!f.rows.length) f.rows.push(faceVatRowBlank(null));
      f.openHead = null; faceVatKeep(f); keepScroll(renderFace); return true;
    case 'invFaceVatSplit': f.openHead = k; keepScroll(renderFace); return true;
    // Rounds and batches are one page written two ways: a round's time is a batch's end, and back.
    case 'invFaceVatStyle':
      var to = btn.dataset.style;
      if ((to !== 'rounds' && to !== 'batches') || to === f.style) return true;
      f.rows.forEach(function(r) { if (to === 'batches') { r.to = r.time; r.time = ''; } else { r.time = r.to || r.time; r.to = ''; } });
      f.style = to; faceVatKeep(f); keepScroll(renderFace); return true;
    case 'invFaceVatDrop': faceVatDrop(); return true;
    case 'invFaceVatCopy': faceVatCopy(); return true;
    case 'invFaceVatCut': faceVatCutSave(); return true;
    case 'invFaceVatCutOpen': pcsOpen(btn.dataset.id); return true;
  }
  return false;
}

/* ---------- F4: the clerk's attendance sheet against the supervisor's roll (docs/ENTRY_FACES.md §4) ----------
   The clerk's sheet is People → Attendance → Day as the sheet (the duty opens it), every mark typed there carrying who typed it
   (`by`, staff.js _attHandEdit). Where a day has both, each hand the clerk marked is set against the day's saved rolls read alone
   (relayRollsReading): present on one and absent on the other, a half day on one, another line, or present with the rolls naming
   them nowhere. The sheet's mark stands (a roll never writes over a mark typed by hand), and the owner rules each: Use the roll's
   puts the roll's mark on the day (the roll's again), Looks right keeps the sheet's (`rollOk`, against the roll's reading it was
   given: a roll saved later that reads otherwise asks again). Which of the two is the day's truth is the owner's, a hand at a time
   (§8): nothing is decided for them. */
var FACE_ATT_DAYS = 30;
function faceClerkIds() {
  return typeof grdUsers === 'function' ? grdUsers().filter(function(u) { return u && faceDuties(u).some(function(d) { return d.id === 'attsheet'; }); }).map(function(u) { return u.id; }) : [];
}
var _faceAttMemo = { key: null, by: {} };
function faceAttDiffs(iso) {
  if (!S || typeof grdOn !== 'function' || !grdOn()) return [];
  var key = (typeof _bookWrites !== 'undefined' ? _bookWrites : 0) + '|' + relayPastes().length;
  if (_faceAttMemo.key !== key || _faceAttMemo.s !== S) _faceAttMemo = { key: key, s: S, by: {} };
  if (_faceAttMemo.by[iso]) return _faceAttMemo.by[iso];
  var out = _faceAttMemo.by[iso] = [];
  var rec = S.attendance && S.attendance[iso], clerks = faceClerkIds();
  if (!rec || !rec.marks || !clerks.length) return out;
  var mine = Object.keys(rec.marks).filter(function(id) { var m = rec.marks[id]; return m && m.src !== 'relay' && m.by && clerks.indexOf(m.by) >= 0; });
  if (!mine.length) return out;
  var roll = relayRollsReading(iso);
  if (!roll) return out;
  var on = function(st) { return st === 'P' || st === 'H'; };
  mine.forEach(function(id) {
    var m = rec.marks[id], r = roll[String(id)] || null, w = staffById(id), kind = null;
    if (!w) return;
    if (!r) { if (on(m.st)) kind = 'missing'; }
    else if (on(m.st) && r.st === 'A') kind = 'absent';
    else if (m.st === 'A' && on(r.st)) kind = 'present';
    else if (m.st !== r.st) kind = 'half';
    // Another line only where both name one (Flex is none), the barrel and its own pickling one place: one unit of five, which the
    // roll writes either way (on the owner's book, four of fourteen such differences were that alone, three a sheet naming no line).
    else if (on(m.st) && faceAttUnit(m.area) && faceAttUnit(r.area) && faceAttUnit(m.area) !== faceAttUnit(r.area)) kind = 'area';
    if (!kind) return;
    var sig = kind + '|' + (r ? r.st + '|' + (r.area || '') : '-');
    if (m.rollOk && m.rollOk.sig === sig) return;
    out.push({ id: String(id), w: w, kind: kind, sig: sig, sheet: m, roll: r, text: faceAttText(kind, m, r) });
  });
  return out;
}
function faceAttUnit(a) { return !a || a === 'flex' ? '' : a === 'pickling-barrel' ? 'barrel' : a; }
function faceAttText(kind, m, r) {
  var st = function(x) { return (ATT_STATE_LABELS[x.st] || x.st).toLowerCase(); };
  var where = function(x) { return x && x.area && x.area !== 'flex' ? ' (' + areaLabel(x.area) + ')' : ''; };
  if (kind === 'missing') return 'present on the sheet' + where(m) + '; the roll does not name them';
  if (kind === 'area') return areaLabel(m.area) + ' on the sheet, ' + areaLabel(r.area) + ' on the roll';
  return st(m) + ' on the sheet' + where(m) + ', ' + st(r) + ' on the roll' + where(r);
}
/* What People → Day says of a hand whose two views disagree: the dot on its row, and in its day the rulings. */
function faceAttDiffOf(iso, id) { return faceAttDiffs(iso).find(function(d) { return d.id === String(id); }) || null; }
function faceAttDotHtml(iso, id) {
  var d = faceAttDiffOf(iso, id);
  return d ? '<span class="inv-row-meta inv-row-wrap" data-att-roll-q="' + escHtml(d.kind) + '">' + uiDot('warning', escHtml('The roll differs: ' + d.text)) + '</span>' : '';
}
function faceAttRulingHtml(iso, id) {
  var d = faceAttDiffOf(iso, id);
  if (!d) return '';
  var can = typeof grdCan !== 'function' || !grdOn() || grdCan('voids');
  return '<div class="inv-callout inv-callout-warning" data-att-roll-ruling="' + escHtml(d.kind) + '">' + escHtml('The clerk’s sheet and the supervisor’s roll disagree: ' + d.text + '. The sheet’s mark stands until you rule.') +
    (can ? '<div class="inv-toolbar inv-toolbar-tight inv-mt-8">' + (d.roll ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invAttRollUse" data-id="' + escHtml(d.id) + '">Use the roll’s</button>' : '') +
      '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invAttRollOk" data-id="' + escHtml(d.id) + '">Looks right</button></div>' : '') + '</div>';
}
function faceAttDayHtml(iso) {
  var ds = faceAttDiffs(iso);
  return ds.length ? '<div class="inv-callout inv-callout-warning" data-att-roll-diffs="' + ds.length + '">' + escHtml(todoPlural(ds.length, 'hand') + ' on the clerk’s sheet ' + (ds.length === 1 ? 'differs' : 'differ') +
    ' from the supervisor’s roll: ' + ds.slice(0, 3).map(function(d) { return d.w.name; }).join(', ') + (ds.length > 3 ? ' and ' + (ds.length - 3) + ' more' : '') + '. Open a name to rule.') + '</div>' : '';
}
/* The owner's rulings, a hand at a time. */
function faceAttUseRoll(iso, id) {
  if (!grdGate('voids', 'put the roll’s mark on the day', function() { faceAttUseRoll(iso, id); })) return;
  var d = faceAttDiffOf(iso, id);
  if (!d || !d.roll) return;
  var rec = attDay(iso, true), m = JSON.parse(JSON.stringify(d.roll));
  m.src = 'relay';
  rec.marks[id] = m;
  saveState();
  if (typeof attEditRefresh === 'function') attEditRefresh();
  keepScroll(tabRedrawActive);
  showToast('The roll’s mark is on the day');
}
function faceAttOk(iso, id) {
  if (!grdGate('voids', 'keep the sheet’s mark', function() { faceAttOk(iso, id); })) return;
  var d = faceAttDiffOf(iso, id), rec = S.attendance && S.attendance[iso];
  if (!d || !rec || !rec.marks[id]) return;
  rec.marks[id].rollOk = { sig: d.sig, at: Date.now(), by: faceUserName() };
  saveState();
  if (typeof attEditRefresh === 'function') attEditRefresh();
  keepScroll(tabRedrawActive);
  showToast('The sheet’s mark is kept');
}
TODO_RULES.push(['faceAttRoll', 'Faces: the clerk’s attendance sheet against the supervisor’s roll']);
TODO_CHECK_DEFAULTS.faceAttRoll = true;
TODO_RULE_NEED.faceAttRoll = 'owner';
TODO_RULE_FNS.faceAttRoll = function() {
  var since = isoAddDays(localDateStr(), -FACE_ATT_DAYS), out = [];
  Object.keys(S.attendance || {}).filter(function(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= since; }).sort().forEach(function(d) {
    var ds = faceAttDiffs(d);
    if (!ds.length) return;
    out.push({ key: 'faceAttRoll:' + d, rule: 'faceAttRoll', tone: 'amber', title: todoPlural(ds.length, 'hand') + ' where the clerk’s sheet and the roll disagree · ' + formatDate(d),
      sub: ds.slice(0, 2).map(function(x) { return x.w.name; }).join(', ') + (ds.length > 2 ? ' +' + (ds.length - 2) : ''), why: 'The clerk’s sheet set against the supervisor’s roll',
      facts: ds.slice(0, 6).map(function(x) { return [x.w.name, x.text]; }),
      clears: 'Use the roll’s, or Looks right, on each hand (People → Attendance → Day, open the name).',
      go: { kind: 'staffDay', date: d }, goLabel: 'Open the day', sig: ds.map(function(x) { return x.id + ':' + x.sig; }).sort().join(',') });
  });
  return out;
};
