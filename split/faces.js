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
   `lines` are Production's lines the duty records; `page` is where it is entered until its own form is built; `sheet` the paper. */
var FACE_DUTIES = [
  { id: 'roll-in', title: 'In-time roll', input: 'roll-in', page: 'pageStaff', sheet: 'att' },
  { id: 'pickling', title: 'Pickling loads', input: 'pickling', page: 'pageProduction' },
  { id: 'incoming', title: 'Material in', page: 'pageIM' },
  { id: 'stock', title: 'Stock', input: 'stock', page: 'pageStock', sheet: 'stock' },
  { id: 'attsheet', title: 'Attendance sheet', page: 'pageStaff', sheet: 'att' },
  { id: 'barrel', title: 'Barrel batches', lines: ['barrel'], page: 'pageProduction' },
  { id: 'vat', title: 'VAT register', lines: ['vat-a1', 'vat-a2'], page: 'pageProduction' },
  { id: 'roll-out', title: 'Out-time roll', input: 'roll-out', page: 'pageStaff', sheet: 'att' }
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
    if (have.length === d.lines.length) return { state: 'in', text: todoPlural(runs, 'record') };
    if (have.length) return { state: 'part', text: have.join(', ') + ' in' };
    return { state: 'wait', text: 'Not yet' };
  }
  if (d.id === 'attsheet') {
    var att = attDaySummary(day);
    return att.marked ? { state: 'in', text: (att.p + att.half) + ' on site, ' + att.absent.length + ' absent' } : { state: 'wait', text: 'Not yet' };
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
  return faceStepperHtml(day, isToday) + hero + faceEnteredHtml(u, day) + faceToolsHtml(u);
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
/* What you entered on the day: each record a row, the latest first, what it is and when it was saved. */
function faceEnteredHtml(u, day) {
  var list = faceEntered(u, day);
  var h = '<div class="inv-panel inv-panel-flush" id="faceEntered"><div class="inv-panel-head"><span class="inv-panel-title">What you entered <span class="inv-panel-count">' + list.length + '</span></span></div>';
  if (!list.length) return h + '<div class="inv-empty">Nothing yet on this day.</div></div>';
  return h + uiMoreHtml('face-entered', list.map(function(e) {
    var noun = chgNounOf(e.coll, e.n || 1), act = chgAct(e);
    var d = new Date(e.at), clock = relayClockLabel(d.getHours() * 60 + d.getMinutes());
    return '<div class="inv-row inv-row-2" data-face-entered="' + escHtml(e.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(e.label || noun) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(act.charAt(0).toUpperCase() + act.slice(1) + (e.n ? '' : ' ' + noun)) + '</span></span><span class="inv-row-end inv-num">' + escHtml(clock) + '</span></div>';
  }), { n: FACE_ENTERED_MAX, noun: 'entries' }) + '</div>';
}
/* The paper for the duties that have it (the blank sheet, and the day's filled copy), and whether this person's entries have
   reached GitHub: on the floor a phone is often offline, and what it saved goes when it is back (auto-push, merged). */
function faceToolsHtml(u) {
  var sheets = {};
  faceDuties(u).forEach(function(d) { if (d.sheet) sheets[d.sheet] = true; });
  var rows = '';
  if (sheets.att) rows += '<div class="inv-row inv-row-2" data-face-sheet="att"><span class="inv-row-main"><span class="inv-row-title">Attendance sheets</span><span class="inv-row-meta">Blank to fill by hand, or what was entered</span></span>' +
    '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFaceSheet" data-sheet="att">Print</button></span></div>';
  if (sheets.stock) rows += '<div class="inv-row inv-row-2" data-face-sheet="stock"><span class="inv-row-main"><span class="inv-row-title">Stock sheets</span><span class="inv-row-meta">Blank to fill by hand, or what was entered</span></span>' +
    '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFaceSheet" data-sheet="stock">Print</button></span></div>';
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
  if (id === 'pickling' || id === 'barrel' || id === 'vat') {
    // Production's hand form on the day and its line (prodHandBlank reads Lines' line and day): a load for the pickling hand,
    // a run for the barrel and the register.
    prodSetTab('lines');
    _prodView = 'main'; _prodDay = day; _prodLine = id === 'pickling' ? 'pickling' : id === 'barrel' ? 'barrel' : 'vat-a1';
    switchTab('pageProduction');
    prodOpenHand();
    return;
  }
  if (id === 'incoming') { switchTab('pageIM'); showAddChallanForm(); return; }
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
function faceSheet(k) {
  var day = faceDayIso();
  if (k === 'att') { _attDate = day; attSheetOpen(); return; }
  if (k === 'stock') { _stockSheetDate = day; stockSheetOpen(); }
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
  switch (action) {
    case 'invFaceOpen': faceOpen(btn.dataset.duty); return true;
    // A day stepped to is a place of its own (the address carries it); the page and the focus stay where they were.
    case 'invFaceStep': keepScroll(function() { faceSetDay(isoAddDays(faceDayIso(), +btn.dataset.step || 0)); renderFace(); }); return true;
    case 'invFaceToday': keepScroll(function() { _faceDay = null; renderFace(); }); return true;
    case 'invFaceSheet': faceSheet(btn.dataset.sheet); return true;
    case 'invFaceSee': faceSeeAs(btn.dataset.id); return true;
  }
  return false;
}
function faceOnChange(t) {
  if (!t || t.id !== 'faceDate') return false;
  faceSetDay(t.value);
  renderFace();
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
