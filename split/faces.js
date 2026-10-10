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
  // Entered on the face itself (F2): the face's own page is the door.
  { id: 'pickling', title: 'Pickling loads', input: 'pickling', page: 'pageFace' },
  { id: 'incoming', title: 'Material in', page: 'pageFace' },
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
  // The pickling hand's forms are on the face itself (F2).
  if (id === 'pickling' || id === 'incoming') { faceFormOpen(id); return; }
  if (id === 'barrel' || id === 'vat') {
    // Production's hand form on the day and its line (prodHandBlank reads Lines' line and day): a run for the barrel and the
    // register, until their own forms are on the face (F3, F4).
    prodSetTab('lines');
    _prodView = 'main'; _prodDay = day; _prodLine = id === 'barrel' ? 'barrel' : 'vat-a1';
    switchTab('pageProduction');
    prodOpenHand();
    return;
  }
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
    case 'invFaceFormDone': faceFormDone(); return true;
    case 'invFaceSave': faceSave(); return true;
    case 'invFaceCopy': faceCopy(btn.dataset.id); return true;
    case 'invFaceCorrect': faceFormOpen(faceDutyOfEntry(btn.dataset.id), btn.dataset.id); return true;
    case 'invFaceCheckOk': faceCheckOk(btn.dataset.id, btn.dataset.code); return true;
  }
  return false;
}
/* The form an entry is corrected on: a count of what came in on Material in, a load on Pickling loads. */
function faceDutyOfEntry(id) { var e = prodIndex().byId[id]; return e && e.kind === 'arrived' ? 'incoming' : 'pickling'; }
function faceOnChange(t) {
  if (!t) return false;
  if (t.id === 'faceDate') { faceSetDay(t.value); renderFace(); return true; }
  var f = _faceForm;
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
  var f = { duty: duty, date: day, clientId: '', part: '', partText: '', qty: '', unit: 'NOS', time: day === localDateStr() ? faceNowHhmm() : '', rework: false, replaces: null, saved: [] };
  if (duty === 'incoming') { f.challan = ''; f.counts = {}; f.challanNo = ''; f.link = null; }
  var idx = prodIndex(), src = fromId ? idx.byId[fromId] : null;
  if (src && !src.voidedAt && !idx.replaced[src.id]) {
    f.replaces = src.id; f.date = src.date; f.clientId = src.clientId != null ? String(src.clientId) : '';
    var hit = faceClientParts(f.clientId).find(function(x) { return x.key === prodEntryKey(src); });
    if (hit) f.part = hit.key; else { f.part = FACE_TYPED; f.partText = src.part || ''; }
    f.qty = src.qty != null ? String(src.qty) : ''; f.unit = src.unit || 'NOS'; f.time = src.time || ''; f.rework = !!src.rework;
    if (duty === 'incoming') { f.challan = FACE_NOCHALLAN; f.challanNo = src.challanNo || ''; f.link = src.imItemId ? { imId: src.imId, imItemId: src.imItemId } : null; }
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
  var duty = String(v || '').split('/')[0];
  if (!FACE_FORM_TITLE[duty] || !faceDuties(faceUser()).some(function(d) { return d.id === duty; })) { _faceForm = null; return; }
  if (_faceForm && _faceForm.duty === duty && (_faceForm.replaces || '') === (id || '')) return;
  var src = id ? prodIndex().byId[id] : null;
  _faceForm = faceFormMake(duty, src && src.src === 'face' && src.kind === (duty === 'incoming' ? 'arrived' : 'pickled') ? src.id : null);
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
function renderFaceForm(el) { el.innerHTML = _faceForm.duty === 'incoming' ? faceInHtml(_faceForm) : faceLoadHtml(_faceForm); }
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
  var what = (e.kind === 'arrived' ? 'Came in' : e.rework ? 'Re-pickled' : 'Into the tank') + (t != null ? ' at ' + relayClockLabel(t) : '') + ' · ' + prodQtyText(e.qty, e.unit) +
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
function faceMsgOf(list) {
  var e0 = list[0], d = String(e0.date).split('-'), t = relayParseHhmm(e0.time);
  var clock = t == null ? '' : ((t / 60 | 0) % 12 || 12) + ':' + String(t % 60).padStart(2, '0') + ' ' + (t >= 720 ? 'PM' : 'AM');
  var client = String(prodClientName(e0.clientId) || e0.client || '').toUpperCase();
  var qty = function(e) { return e.qty == null ? '' : ' - ' + (e.unit === 'KG' ? String(+(+e.qty).toFixed(2)) + ' KG' : String(Math.round(e.qty)) + ' NOS'); };
  var part = function(e) { var p = String(e.part || '').toUpperCase(); return p + (e.gauge && p.replace(/[×✕]/g, 'X').indexOf(String(e.gauge).toUpperCase()) < 0 ? ' (' + e.gauge + ')' : '') + qty(e); };
  var head = d[2] + '/' + d[1] + '/' + String(d[0]).slice(2);
  if (e0.kind === 'arrived') return [head, 'INCOMING MATERIAL TIME ' + clock, client].concat(list.map(part)).join('\n');
  return [head, client].concat(list.map(part), e0.rework ? ['RE-PICKLING'] : [], ['PICKLING TIME ' + clock]).join('\n');
}
/* The message an entry went out in: every entry of its save shares it (one challan counted is one message). */
function faceMsgFor(e) {
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
     the day's first load is left out unless the face was in use the working day before too. */
var FACE_CHECK_DAYS = 30;
var FACE_CHECK_TITLE = {
  noplate: function(n) { return todoPlural(n, 'load') + ' pickled with no plating found'; },
  over: function(n) { return todoPlural(n, 'load') + ' past what their challans hold'; },
  count: function(n) { return todoPlural(n, 'line') + ' counted in against the challan'; },
  inNoChallan: function(n) { return todoPlural(n, 'arrival') + ' with no challan in the book'; },
  noload: function(n) { return todoPlural(n, 'run') + ' plated with no pickling load'; }
};
var FACE_CHECK_WHY = { noplate: 'a load and the plating it became', over: 'a load and its challans', count: 'a count and its challan', inNoChallan: 'a count and its challan', noload: 'a run and the load it came from' };
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
