/* ===== PEOPLE: each worker's record, worked out from the book, and the owner's notes on them =====
   Owner, 7 Oct 2026 (docs/WORKERS_AND_PLANT.md, W2): *"Every worker will be assigned details, skill level, personal details,
   tenure, happiness index (derived from a combination of factors), reliability, consistency, relationships"*; then, asked:
   personal details are the owner's alone, and the index is a **motivation index** built from signals and a monthly check-in.

   - Worked out every time it is drawn, never stored (`pplStats`): tenure, reliability (present on the days marked, late,
     leaving early), consistency (how the in-time and the hours vary, how many areas), workload (OT and Sundays, four weeks),
     the days in each area and who they stand beside. Each figure says the days it rests on and is not firm under a fortnight.
   - The motivation index (`pplMotivation`): signals, each a reason and its figure, and the owner's monthly check-in, which
     weighs half. Not firm without a check-in in 60 days or a fortnight of record; a figure not firm is never red (I2).
   - Typed by the owner: `w.profile` (personal details, owner-only, kept out of the change log's values), `w.skills` (0–5 an
     area), `w.ties` (relationships), and the check-ins in `S.peopleCheckins`. A rate changed on the worker is kept in
     `w.rateHistory` (staff.js), so "no rise in a year" is read off the record. */

var PPL_LATE_MIN = 520;      // an in-time after 8:40 on the 8:30 shift
var PPL_EARLY_MIN = 1010;    // an out-time before 4:50 on a full day
var PPL_FIRM_DAYS = 14;
var PPL_CHECKIN_DAYS = 60;
var PPL_TIES = [['reportsTo', 'Reports to'], ['referredBy', 'Referred by'], ['family', 'Family of'], ['friend', 'Friend of']];
var PPL_SCORES = [[1, 'Low'], [2, 'Flat'], [3, 'Steady'], [4, 'Keen'], [5, 'Driven']];

if (typeof STATE_CONTAINERS !== 'undefined' && STATE_CONTAINERS.indexOf('peopleCheckins') < 0) STATE_CONTAINERS.push('peopleCheckins');

function pplCheckins() { return S && Array.isArray(S.peopleCheckins) ? S.peopleCheckins : []; }
function pplLastCheckin(w) {
  return pplCheckins().filter(function(c) { return c && !c.voidedAt && String(c.staffId) === String(w.id); })
    .sort(function(a, b) { return a.on < b.on ? 1 : a.on > b.on ? -1 : (b.at || 0) - (a.at || 0); })[0] || null;
}
function pplOwner() { return typeof grdIsOwner !== 'function' || grdIsOwner(); }
function pplSd(xs) {
  if (xs.length < 2) return 0;
  var m = xs.reduce(function(s, x) { return s + x; }, 0) / xs.length;
  return Math.sqrt(xs.reduce(function(s, x) { return s + (x - m) * (x - m); }, 0) / (xs.length - 1));
}
function pplDow(iso) { return new Date(iso + 'T00:00:00').getDay(); }

/* When they joined: typed, else the first day the book marks them. */
function pplTenure(w) {
  var p = w.profile || {};
  if (p.joined) return { from: p.joined, src: 'joined' };
  var first = null;
  Object.keys(S.attendance || {}).forEach(function(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || (first && iso >= first)) return;
    var rec = S.attendance[iso], m = rec && rec.marks && rec.marks[w.id];
    if (m && (m.st === 'P' || m.st === 'H')) first = iso;
  });
  return first ? { from: first, src: 'marked' } : null;
}
function pplTenureWords(t) {
  if (!t) return 'not known';
  var d = isoDaysBetween(t.from, localDateStr()), y = Math.floor(d / 365), m = Math.floor((d % 365) / 30.4);
  return (y ? y + ' yr' + (m ? ' ' + m + ' mo' : '') : m ? m + ' mo' : d + ' day' + (d === 1 ? '' : 's'));
}

/* The figures, read off the marks: the last 90 days, workload over the last 28. */
function pplStats(w) {
  var today = localDateStr(), id = w.id, n = { P: 0, H: 0, A: 0 }, late = 0, early = 0, timed = 0, inMins = [], hours = [], areas = {}, beside = {};
  var ot28 = 0, sun28 = 0, otWeeks = [0, 0, 0, 0], abs30 = 0, absPrior = 0;
  for (var i = 0; i < 90; i++) {
    var iso = isoAddDays(today, -i), rec = attDay(iso, false), m = rec && rec.marks ? rec.marks[id] : null;
    if (!m || !n.hasOwnProperty(m.st)) continue;
    var sun = pplDow(iso) === 0;
    if (m.st === 'A') { if (!sun) { n.A++; if (i < 30) abs30++; else absPrior++; } continue; }
    if (i < 28) { ot28 += +m.ot || 0; if (sun) sun28++; otWeeks[Math.floor(i / 7)] += +m.ot || 0; }
    if (sun) continue;   // a Sunday worked is workload, not the presence a week is judged on
    n[m.st]++;
    if (m.area) areas[m.area] = (areas[m.area] || 0) + 1;
    if (+m.hours > 0) hours.push(+m.hours);
    if (m.area !== 'gate' && m.inMin != null && m.inMin >= 420 && m.inMin <= 720) {
      timed++; inMins.push(m.inMin);
      if (m.inMin > PPL_LATE_MIN) late++;
      if (m.st === 'P' && m.outMin != null && m.outMin > 720 && m.outMin < PPL_EARLY_MIN) early++;
    }
    if (m.area && rec.marks) Object.keys(rec.marks).forEach(function(k) {
      var o = rec.marks[k];
      if (String(k) !== String(id) && o && (o.st === 'P' || o.st === 'H') && o.area === m.area) beside[k] = (beside[k] || 0) + 1;
    });
  }
  var marked = n.P + n.H + n.A, present = n.P + n.H * 0.5;
  var presence = marked ? present / marked : null;
  var lateShare = timed ? late / timed : 0, earlyShare = timed ? early / timed : 0;
  var rel = presence == null ? null : Math.round(100 * presence * (1 - 0.5 * lateShare - 0.5 * earlyShare));
  var sdIn = pplSd(inMins), sdH = pplSd(hours), nAreas = Object.keys(areas).length;
  var cons = inMins.length + hours.length >= 5 ? Math.max(0, Math.min(100, Math.round(100 - sdIn * 2 - sdH * 5 - Math.max(0, nAreas - 2) * 5))) : null;
  var besideTop = Object.keys(beside).sort(function(a, b) { return beside[b] - beside[a]; }).slice(0, 3).map(function(k) { var o = staffById(k); return o ? { name: o.name, days: beside[k] } : null; }).filter(Boolean);
  return { marked: marked, firm: marked >= PPL_FIRM_DAYS, n: n, presence: presence, late: late, early: early, timed: timed, reliability: rel,
    sdIn: sdIn, sdHours: sdH, areas: areas, nAreas: nAreas, consistency: cons, ot28: ot28, sun28: sun28, otWeeks: otWeeks.reverse(),
    abs30: abs30, absPrior: absPrior, beside: besideTop, tenure: pplTenure(w) };
}
function pplScoreTone(v, firm) { if (v == null) return 'neutral'; var t = v >= 70 ? 'ok' : v >= 50 ? 'warning' : 'danger'; return !firm && t === 'danger' ? 'warning' : t; }
function pplWorkTone(st) { return st.ot28 >= 48 || st.sun28 >= 4 ? 'danger' : st.ot28 >= 24 || st.sun28 >= 3 ? 'warning' : 'ok'; }
function pplRelWords(st) {
  if (st.presence == null) return 'no day marked in 90';
  return 'present ' + Math.round(st.presence * 100) + '% of ' + st.marked + ' days marked' + (st.late ? ' · late ' + st.late : '') + (st.early ? ' · left early ' + st.early : '');
}
function pplConsWords(st) {
  if (st.consistency == null) return 'too few times recorded';
  return (st.timed ? 'in-time varies ' + Math.round(st.sdIn) + ' min' : 'no in-time recorded') + ' · ' + st.nAreas + ' area' + (st.nAreas === 1 ? '' : 's');
}
function pplWorkWords(st) { return formatNum(st.ot28, 0) + ' h OT in 4 weeks' + (st.sun28 ? ' · ' + st.sun28 + ' Sunday' + (st.sun28 === 1 ? '' : 's') : ''); }

/* A worker's rate, for comparing with another of the same tier. */
function pplRate(w) { return w.comp === 'hourly' ? +w.hourRate || 0 : w.monthWage > 0 ? (+w.monthWage) / 26 : +w.dayRate || 0; }

/* The motivation index: signals, each a reason and its figure, and the owner's monthly check-in (half the index). */
function pplMotivation(w, st, labMemo) {
  st = st || pplStats(w);
  var sig = [], today = localDateStr(), pen = 0;
  var add = function(key, word, weight) { sig.push({ key: key, word: word, weight: weight }); pen += weight; };
  try {
    var carry = payCarried(w, payPeriodOf(w, today), labMemo || payLabMemo());
    if (carry.amount >= 1) add('owed', formatCurrency(carry.amount) + ' owed, carried from ' + (carry.periods || 1) + ' period' + (carry.periods === 1 ? '' : 's'), 20);
  } catch (e) { /* a pay record that will not read says nothing here */ }
  var wk = attWeekStartOf(today), adv = 0;
  for (var k = 0; k < 4; k++) {
    var ws = isoAddDays(wk, -7 * k), we = isoAddDays(ws, 6);
    if (staffPayments().some(function(p) { return !p.voidedAt && p.kind === 'advance' && String(p.staffId) === String(w.id) && p.date >= ws && p.date <= we; })) adv++;
  }
  if (adv >= 3) add('advance', 'an advance in ' + adv + ' of the last 4 weeks', 10);
  var ow = st.otWeeks;
  if (ow[3] >= 8 && ow[0] < ow[1] && ow[1] < ow[2] && ow[2] < ow[3]) add('otClimb', 'OT up four weeks running, ' + formatNum(ow[3], 0) + ' h last week', 10);
  var tw = st.tenure ? isoDaysBetween(st.tenure.from, today) : null, mine = pplRate(w);
  if (mine > 0 && tw != null) {
    var peer = (S.staff || []).find(function(o) {
      if (o === w || o.active === false || o.comp !== w.comp || !(pplRate(o) > mine + 0.5)) return false;
      var t = pplTenure(o); return t && isoDaysBetween(t.from, today) < tw;
    });
    if (peer) add('peer', 'paid less than ' + peer.name + ', on the same tier with less service', 15);
  }
  if (st.abs30 >= 3 && st.abs30 > st.absPrior / 2 + 1) add('absent', st.abs30 + ' absences in 30 days, against ' + st.absPrior + ' in the 60 before', 15);
  var hist = (w.rateHistory || []).filter(function(h) { return h && h.on; }).sort(function(a, b) { return a.on < b.on ? 1 : -1; });
  if (tw != null && tw >= 365 && (!hist.length || isoDaysBetween(hist[0].on, today) > 365)) add('noRise', hist.length ? 'no rise since ' + formatDate(hist[0].on) : 'no rise recorded in a year', 10);
  var signals = Math.max(0, 100 - pen), ci = pplLastCheckin(w), ciFresh = ci && isoDaysBetween(ci.on, today) <= PPL_CHECKIN_DAYS;
  var score = ciFresh ? Math.round(0.5 * signals + 0.5 * ((ci.score - 1) / 4 * 100)) : signals;
  var firm = !!(st.firm && ciFresh);
  return { score: score, signals: signals, sig: sig, checkin: ci, fresh: !!ciFresh, firm: firm, tone: pplScoreTone(score, firm),
    why: !st.firm ? 'under ' + PPL_FIRM_DAYS + ' days marked' : !ciFresh ? (ci ? 'last check-in ' + formatDate(ci.on) : 'no check-in yet') : '' };
}

/* ---------- Drawn ---------- */
function pplDotsHtml(n) {
  var v = Math.max(0, Math.min(5, Math.round(+n || 0))), h = '<span class="inv-skill" role="img" aria-label="' + v + ' of 5">';
  for (var i = 1; i <= 5; i++) h += '<span class="inv-skill-dot"' + (i <= v ? ' data-on' : '') + '></span>';
  return h + '</span>';
}
/* A short bar for a figure out of 100, its tone the status's (an SVG: the width is an attribute). */
function pplBarHtml(v, tone, label) {
  var w = v == null ? 0 : Math.max(0, Math.min(100, Math.round(v)));
  return '<svg class="inv-stat-bar" viewBox="0 0 100 4" preserveAspectRatio="none" role="img" aria-label="' + escHtml(label) + '"><rect class="inv-stat-bar-track" x="0" y="0" width="100" height="4"></rect>' +
    '<rect class="inv-stat-bar-fill" data-tone="' + tone + '" x="0" y="0" width="' + w + '" height="4"></rect></svg>';
}
function pplTile(label, value, sub, tone, key) {
  return '<div class="inv-tile" data-ppl-tile="' + key + '"><div class="inv-tile-label">' + escHtml(label) + '</div><div class="inv-tile-value' + (tone && tone !== 'neutral' ? ' inv-fig-' + tone : '') + '">' + value + '</div><div class="inv-tile-sub">' + escHtml(sub) + '</div></div>';
}
/* The record: what the book says of them, the motivation index (the owner's), their skills, ties and details. */
function pplRecordHtml(w, opts) {
  opts = opts || {};
  var st = pplStats(w), owner = pplOwner(), id = escHtml(String(w.id));
  var h = '<div class="inv-tiles" data-ppl-record="' + id + '">' +
    pplTile('Tenure', escHtml(pplTenureWords(st.tenure)), st.tenure ? (st.tenure.src === 'joined' ? 'joined ' : 'first marked ') + formatDate(st.tenure.from) : 'no joining date or mark', '', 'tenure') +
    pplTile('Reliability', st.reliability == null ? '&mdash;' : st.reliability + '', pplRelWords(st), pplScoreTone(st.reliability, st.firm), 'reliability') +
    pplTile('Consistency', st.consistency == null ? '&mdash;' : st.consistency + '', pplConsWords(st), pplScoreTone(st.consistency, st.firm), 'consistency') +
    pplTile('Workload', escHtml(formatNum(st.ot28, 0)) + ' h', 'OT in 4 weeks' + (st.sun28 ? ', ' + st.sun28 + ' Sunday' + (st.sun28 === 1 ? '' : 's') : ''), pplWorkTone(st), 'workload') + '</div>';
  if (!st.firm) h += '<div class="inv-note" data-ppl-unfirm>' + escHtml(st.marked + ' day' + (st.marked === 1 ? '' : 's') + ' marked in 90: the figures firm up at ' + PPL_FIRM_DAYS + '.') + '</div>';
  if (owner) {
    var mo = pplMotivation(w, st, opts.labMemo);
    h += '<div class="inv-panel inv-panel-flush" data-ppl-motivation="' + id + '"><div class="inv-panel-head"><span class="inv-panel-title">Motivation ' +
      '<span class="inv-panel-count">' + mo.score + '</span></span>' + uiDot(mo.tone, mo.firm ? (mo.tone === 'ok' ? 'Good' : mo.tone === 'warning' ? 'Watch' : 'Low') : escHtml('Not firm: ' + mo.why)) + '</div>' +
      (mo.sig.length ? mo.sig.map(function(s) {
        return '<div class="inv-row inv-row-2" data-ppl-signal="' + s.key + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(s.word) + '</span></span><span class="inv-row-end inv-num">−' + s.weight + '</span></div>';
      }).join('') : '<div class="inv-panel-body inv-note">No signal against them: nothing owed, no run of advances, OT steady, paid in line with the tier.</div>') +
      '<div class="inv-row inv-row-2" data-ppl-checkin><span class="inv-row-main"><span class="inv-row-title">' + (mo.checkin ? escHtml('Check-in ' + formatDate(mo.checkin.on) + ': ' + mo.checkin.score + ' of 5, ' + PPL_SCORES[mo.checkin.score - 1][1].toLowerCase()) : 'No check-in yet') + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml((mo.checkin && mo.checkin.note ? mo.checkin.note + ' · ' : '') + 'the check-in is half the index; the signals the other half') + '</span></span>' +
      '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPplCheckin" data-id="' + id + '">Check in</button></span></div></div>';
  }
  // Skills: the owner's rating beside the days the book shows in each area.
  var areas = STAFF_AREAS.filter(function(a) { return (w.skills && w.skills[a.id] > 0) || st.areas[a.id]; });
  h += '<div class="inv-panel inv-panel-flush" data-ppl-skills="' + id + '"><div class="inv-panel-head"><span class="inv-panel-title">Skills</span></div>' +
    (areas.length ? areas.map(function(a) {
      var s = w.skills && w.skills[a.id] > 0 ? +w.skills[a.id] : 0, d = st.areas[a.id] || 0;
      return '<div class="inv-row inv-row-2" data-ppl-skill="' + a.id + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(a.label) + '</span><span class="inv-row-meta">' +
        escHtml(d ? d + ' day' + (d === 1 ? '' : 's') + ' there in 90' : 'no day there in 90') + (s && !d ? ' · <span class="inv-fig-warning">rated, never worked there lately</span>' : '') + '</span></span>' +
        '<span class="inv-row-end">' + (s ? pplDotsHtml(s) : '<span class="inv-row-meta">not rated</span>') + '</span></div>';
    }).join('') : '<div class="inv-empty">No area worked or rated yet.</div>') +
    (st.beside.length ? '<div class="inv-panel-body inv-note" data-ppl-beside>Stands beside ' + escHtml(st.beside.map(function(b) { return b.name + ' (' + b.days + ' days)'; }).join(', ')) + '.</div>' : '') + '</div>';
  // Their ID card (idcard.js): the number, its code, and for the owner print and replace.
  if (typeof idcRecordHtml === 'function') h += idcRecordHtml(w);
  var ties = (w.ties || []).filter(function(t) { return t && (t.staffId != null || t.name); });
  if (ties.length || owner) h += '<div class="inv-panel inv-panel-flush" data-ppl-ties="' + id + '"><div class="inv-panel-head"><span class="inv-panel-title">Relationships</span></div>' +
    (ties.length ? ties.map(function(t) {
      var o = t.staffId != null ? staffById(t.staffId) : null, k = PPL_TIES.find(function(x) { return x[0] === t.kind; });
      return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml((k ? k[1] : 'Linked to') + ' ' + (o ? o.name : t.name)) + '</span>' +
        (t.note ? '<span class="inv-row-meta">' + escHtml(t.note) + '</span>' : '') + '</span></div>';
    }).join('') : '<div class="inv-empty">None recorded.</div>') + '</div>';
  if (owner) {
    var p = w.profile || {}, em = p.emergency || {};
    var kv = [['Designation', p.designation], ['Phone', p.phone], ['Son or daughter of', p.guardian], ['Address', p.address], ['Blood group', p.bloodGroup], ['Born', p.dob ? formatDate(p.dob) : ''], ['Joined', p.joined ? formatDate(p.joined) : ''],
      ['In an emergency', [em.name, em.relation, em.phone].filter(Boolean).join(' · ')], ['ID', p.idLast4 ? '•••• ' + p.idLast4 : ''], ['Bank', p.bankLast4 ? '•••• ' + p.bankLast4 : ''],
      ['Languages', p.languages], ['Notes', p.notes]].filter(function(x) { return x[1]; });
    h += '<div class="inv-panel inv-panel-flush" data-ppl-personal="' + id + '"><div class="inv-panel-head"><span class="inv-panel-title">Personal details</span><span class="inv-row-meta">the owner’s alone</span></div>' +
      (kv.length ? '<div class="inv-panel-body"><div class="inv-kv">' + kv.map(function(x) { return '<div' + (x[0] === 'Address' || x[0] === 'Notes' ? ' class="inv-kv-wide"' : '') + '><div class="inv-kv-k">' + escHtml(x[0]) + '</div><div>' + escHtml(x[1]) + '</div></div>'; }).join('') + '</div></div>'
        : '<div class="inv-empty">None recorded.</div>') +
      '</div><div class="inv-toolbar"><button class="inv-btn inv-btn-secondary" data-action="invPplEdit" data-id="' + id + '">Details, skills and ties</button></div>';
  }
  return h;
}

/* ---------- The owner's edits ---------- */
function pplOwnerOk(again) {
  if (!pplOwner()) { uiAlert({ title: 'The owner’s to change', body: 'A worker’s details, skills, relationships and check-ins are the owner’s alone.' }); return false; }
  return typeof grdGate !== 'function' || grdGate('payments', 'Change a worker’s record', again);
}
function _pplF(id, label, v, type, extra) {
  return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + escHtml(label) + '</label><input class="inv-input" id="' + id + '" type="' + (type || 'text') + '" value="' + escHtml(v == null ? '' : String(v)) + '"' + (extra || '') + '></div>';
}
function _pplSel(id, label, list, v) {
  return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + escHtml(label) + '</label><select class="inv-input" id="' + id + '">' +
    list.map(function(o) { return '<option value="' + escHtml(String(o[0])) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>'; }).join('') + '</select></div>';
}
var _pplFrom = null;   // the worker's edit sheet the dialog was opened over, to come back to it
function pplEdit(id) {
  if (!pplOwnerOk(function() { pplEdit(id); })) return;
  var w = staffById(id);
  if (!w) return;
  _pplFrom = document.querySelector('[data-ppl-sheet]') ? id : null;
  var p = w.profile || {}, em = p.emergency || {}, ties = (w.ties || []).slice(0, 3);
  while (ties.length < 3) ties.push({});
  var workers = [['', 'Someone not on the roster']].concat((S.staff || []).filter(function(o) { return o !== w; }).sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); }).map(function(o) { return [o.id, o.name]; }));
  var f = '<div class="inv-fields">' + _pplF('pplDesig', 'Designation', p.designation) + _pplF('pplPhone', 'Phone', p.phone, 'tel') + _pplF('pplGuard', 'Son or daughter of', p.guardian) +
    _pplF('pplBlood', 'Blood group', p.bloodGroup) + _pplF('pplDob', 'Born', p.dob, 'date') + _pplF('pplJoined', 'Joined', p.joined, 'date') +
    _pplF('pplLang', 'Languages', p.languages) + _pplF('pplId4', 'ID, last four digits', p.idLast4, 'text', ' inputmode="numeric"') +
    _pplF('pplBank4', 'Bank account, last four digits', p.bankLast4, 'text', ' inputmode="numeric"') + '</div>' +
    _pplF('pplAddr', 'Address', p.address) +
    '<div class="inv-fields">' + _pplF('pplEmName', 'In an emergency: name', em.name) + _pplF('pplEmRel', 'Relation', em.relation) + _pplF('pplEmPhone', 'Their phone', em.phone, 'tel') + '</div>' +
    _pplF('pplNotes', 'Notes', p.notes) +
    '<div class="inv-panel inv-panel-flush inv-mt-8"><div class="inv-panel-head"><span class="inv-panel-title">Skills, 0 to 5</span></div><div class="inv-panel-body"><div class="inv-fields">' +
    STAFF_AREAS.map(function(a) { return _pplSel('pplSkill-' + a.id, a.label, [[0, 'Not rated'], [1, '1 · learning'], [2, '2'], [3, '3 · on their own'], [4, '4'], [5, '5 · can teach it']], (w.skills || {})[a.id] || 0); }).join('') +
    '</div></div></div>' +
    '<div class="inv-panel inv-panel-flush inv-mt-8"><div class="inv-panel-head"><span class="inv-panel-title">Relationships</span></div><div class="inv-panel-body">' +
    ties.map(function(t, i) {
      return '<div class="inv-fields">' + _pplSel('pplTieKind' + i, 'Relationship ' + (i + 1), [['', 'None']].concat(PPL_TIES), t.kind || '') +
        _pplSel('pplTieWho' + i, 'Worker', workers, t.staffId != null ? t.staffId : '') + _pplF('pplTieName' + i, 'Or a name', t.staffId != null ? '' : t.name) + '</div>';
    }).join('') + '</div></div>';
  dialogOpen('<div class="inv-dialog" data-ppl-edit="' + escHtml(String(w.id)) + '">' + dialogHeadHtml(escHtml(w.name) + ': details, skills and ties') + f +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPplSave" data-id="' + escHtml(String(w.id)) + '">Save</button></div></div>', { dismiss: true });
}
function _pplV(id) { var el = document.getElementById(id); return el ? String(el.value).trim() : ''; }
function pplSave(id) {
  if (!pplOwnerOk(function() { pplSave(id); })) return;
  var w = staffById(id);
  if (!w) return;
  var four = function(v) { var d = String(v).replace(/\D/g, ''); return d ? d.slice(-4) : ''; };
  var prof = { designation: _pplV('pplDesig'), guardian: _pplV('pplGuard'), bloodGroup: _pplV('pplBlood'), phone: _pplV('pplPhone'), dob: _pplV('pplDob'), joined: _pplV('pplJoined'), languages: _pplV('pplLang'), idLast4: four(_pplV('pplId4')), bankLast4: four(_pplV('pplBank4')),
    address: _pplV('pplAddr'), notes: _pplV('pplNotes'), emergency: { name: _pplV('pplEmName'), relation: _pplV('pplEmRel'), phone: _pplV('pplEmPhone') } };
  if (prof.joined && prof.joined > localDateStr()) return uiAlert({ title: 'A day not yet come', body: 'The joining date is a day up to today.' });
  var skills = {};
  STAFF_AREAS.forEach(function(a) { var v = parseInt(_pplV('pplSkill-' + a.id), 10); if (v > 0) skills[a.id] = Math.min(5, v); });
  var ties = [];
  for (var i = 0; i < 3; i++) {
    var kind = _pplV('pplTieKind' + i), who = _pplV('pplTieWho' + i), name = _pplV('pplTieName' + i);
    if (!kind || (!who && !name)) continue;
    var o = who ? staffById(who) : null;
    ties.push(o ? { kind: kind, staffId: o.id } : { kind: kind, name: name });
  }
  w.profile = prof; w.skills = skills; w.ties = ties;
  saveState();
  pplBack(id);
  showToast('Saved');
}
function pplCheckinOpen(id) {
  if (!pplOwnerOk(function() { pplCheckinOpen(id); })) return;
  var w = staffById(id);
  if (!w) return;
  _pplFrom = document.querySelector('[data-ppl-sheet]') ? id : null;
  dialogOpen('<div class="inv-dialog" data-ppl-checkin-form="' + escHtml(String(w.id)) + '">' + dialogHeadHtml('Check in: ' + escHtml(w.name)) +
    '<div class="inv-note">How they seem this month, in your words: 1 is low, 5 is driven. It is half their motivation index.</div>' +
    '<div class="inv-seg inv-mt-8" role="group" aria-label="How they seem">' + PPL_SCORES.map(function(s) {
      return '<button type="button" class="inv-seg-btn" data-action="invPplScore" data-score="' + s[0] + '" aria-pressed="false">' + s[0] + ' · ' + escHtml(s[1]) + '</button>';
    }).join('') + '</div>' +
    _pplF('pplCiOn', 'On', localDateStr(), 'date') + _pplF('pplCiNote', 'What was said or seen (recommended)', '') +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPplCheckinSave" data-id="' + escHtml(String(w.id)) + '">Save</button></div></div>', { dismiss: true });
}
function pplCheckinSave(id) {
  if (!pplOwnerOk(function() { pplCheckinSave(id); })) return;
  var on = document.querySelector('[data-ppl-checkin-form] [data-action="invPplScore"][aria-pressed="true"]');
  if (!on) return uiAlert({ title: 'How do they seem?', body: 'Pick 1 to 5 first.' });
  var day = _pplV('pplCiOn') || localDateStr();
  if (day > localDateStr()) return uiAlert({ title: 'A day not yet come', body: 'A check-in is on a day up to today.' });
  if (!Array.isArray(S.peopleCheckins)) S.peopleCheckins = [];
  S.peopleCheckins.push({ id: 'CI-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), staffId: staffById(id).id, on: day, score: +on.dataset.score,
    note: _pplV('pplCiNote'), at: Date.now(), by: typeof grdUser === 'function' && grdUser() ? grdUser().name : '' });
  saveState();
  pplBack(id);
  showToast('Checked in');
}
/* Back where the dialog was opened: the worker's sheet on the phone, else the page redrawn. */
function pplBack(id) {
  closeOverlay();
  if (_pplFrom != null && typeof openWorkerEdit === 'function') { var f = _pplFrom; _pplFrom = null; openWorkerEdit(f); }
  if (typeof renderAttendance === 'function' && navPageOf() === 'pageStaff') renderAttendance();
}
function pplAction(action, btn) {
  switch (action) {
    case 'invPplEdit': pplEdit(btn.dataset.id); return true;
    case 'invPplSave': pplSave(btn.dataset.id); return true;
    case 'invPplCheckin': pplCheckinOpen(btn.dataset.id); return true;
    case 'invPplCheckinSave': pplCheckinSave(btn.dataset.id); return true;
    case 'invPplImportKeep': pplImportKeep(); return true;
    case 'invPplScore': {
      var seg = btn.closest('.inv-seg');
      if (seg) seg.querySelectorAll('[data-action="invPplScore"]').forEach(function(b) { b.setAttribute('aria-pressed', String(b === btn)); });
      return true;
    }
  }
  return false;
}

/* ---------- A file of details: sep-people v1, checked before anything is kept ----------
   The owner's spreadsheets of names, phones, addresses and emergency contacts (owner, 7 Oct 2026) arrive as one file, never
   in the build. Each row is matched to the roster the way a roll's names are (relayMatchName: the name, a spelling kept on
   the worker, a first name nobody else has, a folded spelling), shown beside the worker it was matched to, and saved only on
   Keep: a short or misspelt name must never put one person's details on another. A row matching nobody is left out, never
   made a worker (a worker with no tier or rate reads the labour short). Only the fields a row carries are written. */
var PPL_IMPORT_FIELDS = ['designation', 'phone', 'address', 'guardian', 'bloodGroup', 'dob', 'joined', 'languages', 'notes', 'idLast4', 'bankLast4'];
var _pplImport = null;   // {rows: [{row, match: {id, sure}}]}
/* The row's name, else one of its other spellings (`aliases`): a sure match on any wins over a spelling read as. */
function pplImportMatch(name, aliases) {
  var idx = relayRosterIndex(S.staff || []), best = null;
  [name].concat(Array.isArray(aliases) ? aliases : []).forEach(function(n) {
    var words = String(n || '').trim().split(/\s+/).filter(Boolean), m = words.length ? relayMatchName(words, idx, false) : null;
    if (m && (!best || (m.sure && !best.sure))) best = m;
  });
  return best ? { id: best.w.id, sure: best.sure } : { id: null, sure: false };
}
function pplImportData(data) {
  if (!data || data.format !== 'sep-people' || !Array.isArray(data.people)) { uiAlert({ title: 'Not a details file', body: 'A file of workers’ details is marked sep-people and carries a list of people.' }); return; }
  if (!pplOwnerOk(function() { pplImportData(data); })) return;
  _pplImport = { rows: data.people.filter(function(r) { return r && r.name; }).map(function(r) { return { row: r, match: pplImportMatch(r.name, r.aliases) }; }) };
  pplImportReview();
}
function pplImportText(text) {
  var d;
  try { d = JSON.parse(text); } catch (e) { showToast('Not valid JSON: ' + e.message, 'error'); return; }
  pplImportData(d);
}
function pplImportReview() {
  var R = _pplImport;
  if (!R) return;
  var opts = [['', 'Leave out']].concat((S.staff || []).slice().sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); }).map(function(w) { return [w.id, w.name + (w.active === false ? ' (inactive)' : '')]; }));
  var rows = R.rows.map(function(x, i) {
    var r = x.row, has = PPL_IMPORT_FIELDS.filter(function(f) { return r[f]; }).length + (r.emergency && (r.emergency.phone || r.emergency.name) ? 1 : 0) + ((r.ties || []).length ? 1 : 0);
    var tone = x.match.id == null ? 'neutral' : x.match.sure ? 'ok' : 'warning';
    return '<div class="inv-row inv-row-2 inv-row-flow" data-ppl-import-row="' + i + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(r.name) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(has + ' detail' + (has === 1 ? '' : 's') + (r.designation ? ' · ' + r.designation : '')) + '</span></span>' +
      '<span class="inv-row-end inv-row-actions">' + uiDot(tone, x.match.id == null ? 'Not found' : x.match.sure ? 'Found' : 'Read as') +
      '<select class="inv-input" data-ppl-import-pick="' + i + '" aria-label="' + escHtml('Worker for ' + r.name) + '">' + opts.map(function(o) {
        return '<option value="' + escHtml(String(o[0])) + '"' + (String(o[0]) === String(x.match.id == null ? '' : x.match.id) ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>';
      }).join('') + '</select></span></div>';
  }).join('');
  var unsure = R.rows.filter(function(x) { return x.match.id != null && !x.match.sure; }).length, none = R.rows.filter(function(x) { return x.match.id == null; }).length;
  dialogOpen('<div class="inv-dialog inv-dialog-wide" data-ppl-import>' + dialogHeadHtml('Workers’ details: check who is who') +
    '<div class="inv-note">' + escHtml(R.rows.length + ' row' + (R.rows.length === 1 ? '' : 's') + ' in the file. ' + (unsure ? unsure + ' read as a spelling of a worker: check each. ' : '') +
      (none ? none + ' match nobody on the roster and are left out unless you pick a worker. ' : '') + 'Only what a row carries is written; nothing is kept until you say so.') + '</div>' +
    '<div class="inv-panel inv-panel-flush inv-mt-8">' + rows + '</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPplImportKeep">Keep the details</button></div></div>', { dismiss: true });
}
function pplImportKeep() {
  if (!pplOwnerOk(pplImportKeep)) return;
  var R = _pplImport;
  if (!R) return;
  var picks = {};
  document.querySelectorAll('[data-ppl-import-pick]').forEach(function(sel) { picks[sel.dataset.pplImportPick] = sel.value; });
  var kept = 0, left = 0, twice = 0, seen = {}, idx = relayRosterIndex(S.staff || []);
  R.rows.forEach(function(x, i) {
    var w = picks[i] ? staffById(picks[i]) : null;
    if (!w) { left++; return; }
    if (seen[w.id]) twice++;
    seen[w.id] = true;
    var r = x.row, p = Object.assign({}, w.profile || {});
    PPL_IMPORT_FIELDS.forEach(function(f) { if (r[f] != null && String(r[f]).trim() !== '') p[f] = String(r[f]).trim(); });
    if (p.idLast4) p.idLast4 = String(p.idLast4).replace(/\D/g, '').slice(-4);
    if (p.bankLast4) p.bankLast4 = String(p.bankLast4).replace(/\D/g, '').slice(-4);
    if (r.emergency && typeof r.emergency === 'object') {
      var em = Object.assign({}, p.emergency || {});
      ['name', 'relation', 'phone'].forEach(function(f) { if (r.emergency[f]) em[f] = String(r.emergency[f]).trim(); });
      p.emergency = em;
    }
    w.profile = p;
    if (Array.isArray(r.ties) && r.ties.length) {
      var ties = Array.isArray(w.ties) ? w.ties.slice() : [];
      r.ties.forEach(function(t) {
        if (!t || !t.kind || !t.name) return;
        var m = relayMatchName(String(t.name).trim().split(/\s+/), idx, false), o = m && m.sure ? m.w : null;
        var tie = o ? { kind: t.kind, staffId: o.id } : { kind: t.kind, name: String(t.name).trim() };
        if (t.note) tie.note = String(t.note);
        if (!ties.some(function(e) { return e.kind === tie.kind && (o ? String(e.staffId) === String(o.id) : e.name === tie.name); })) ties.push(tie);
      });
      w.ties = ties;
    }
    kept++;
  });
  _pplImport = null;
  saveState();
  closeOverlay();
  if (navPageOf() === 'pageStaff') renderAttendance();
  showToast(kept + ' worker' + (kept === 1 ? '' : 's') + '’ details kept' + (left ? ' · ' + left + ' left out' : '') + (twice ? ' · ' + twice + ' row' + (twice === 1 ? '' : 's') + ' on a worker another row also named' : ''), left || twice ? 'warning' : 'success');
}

/* ---------- At a glance: the roster's row (W3, the 6-second rule) ---------- */
/* Three short bars with their figures (reliability, consistency, workload), the tenure, the two strongest skills, and for the
   owner the motivation index: one look says who is steady, who is stretched, and who to talk to. */
function pplGlanceHtml(w, memo) {
  var st = pplStats(w), wt = pplWorkTone(st), stat = function(k, label, v, tone, word) {
    return '<span class="inv-wstat" data-ppl-glance="' + k + '"><span class="inv-wstat-k">' + label + '</span>' + pplBarHtml(v, tone, label + ': ' + word) + '<span class="inv-wstat-v">' + escHtml(word) + '</span></span>';
  };
  var skills = Object.keys(w.skills || {}).filter(function(a) { return w.skills[a] > 0; }).sort(function(a, b) { return w.skills[b] - w.skills[a]; }).slice(0, 2);
  var h = '<span class="inv-wstats">' +
    stat('reliability', 'Reliable', st.reliability, pplScoreTone(st.reliability, st.firm), st.reliability == null ? '—' : String(st.reliability)) +
    stat('consistency', 'Steady', st.consistency, pplScoreTone(st.consistency, st.firm), st.consistency == null ? '—' : String(st.consistency)) +
    stat('workload', 'OT 4 wk', Math.min(100, st.ot28 / 60 * 100), wt, formatNum(st.ot28, 0) + ' h') + '</span>';
  var meta = [pplTenureWords(st.tenure), skills.map(function(a) { return areaLabel(a) + ' ' + w.skills[a] + '/5'; }).join(', '), st.firm ? '' : st.marked + ' days marked'].filter(Boolean).join(' · ');
  if (pplOwner()) {
    var mo = pplMotivation(w, st, memo);
    meta += ' · ';
    h += '<span class="inv-row-meta inv-row-wrap" data-ppl-glance-meta>' + escHtml(meta) + uiDot(mo.tone, escHtml('Motivation ' + mo.score + (mo.firm ? '' : ', not firm'))) + '</span>';
  } else h += '<span class="inv-row-meta inv-row-wrap" data-ppl-glance-meta>' + escHtml(meta) + '</span>';
  return h;
}

/* ---------- The To-do: a check-in due, a worker to talk to (the owner's) ---------- */
TODO_RULES.push(['pplCheckin', 'People: a monthly check-in due']);
TODO_CHECK_DEFAULTS.pplCheckin = true;
TODO_RULE_NEED.pplCheckin = 'owner';
TODO_RULE_FNS.pplCheckin = function() {
  var today = localDateStr();
  var due = (S.staff || []).filter(function(w) {
    if (w.active === false) return false;
    var ci = pplLastCheckin(w);
    return (!ci || isoDaysBetween(ci.on, today) > 45) && pplStats(w).firm;
  });
  if (!due.length) return [];
  return [{ key: 'pplCheckin', rule: 'pplCheckin', tone: 'info', title: due.length + ' worker' + (due.length === 1 ? '' : 's') + ' due a check-in',
    sub: due.slice(0, 4).map(function(w) { return w.name; }).join(', ') + (due.length > 4 ? ' and ' + (due.length - 4) + ' more' : ''), why: 'People · the motivation index',
    facts: due.slice(0, 8).map(function(w) { var ci = pplLastCheckin(w); return [w.name, ci ? 'last ' + formatDate(ci.on) : 'never']; }),
    clears: 'Clears itself as each is checked in (their record, Check in).', go: { kind: 'staffRoster' }, goLabel: 'Open the roster',
    sig: due.map(function(w) { return w.id; }).join(',') }];
};
TODO_RULES.push(['pplWatch', 'People: motivation low, on firm figures']);
TODO_CHECK_DEFAULTS.pplWatch = true;
TODO_RULE_NEED.pplWatch = 'owner';
TODO_RULE_FNS.pplWatch = function() {
  var memo = typeof payLabMemo === 'function' ? payLabMemo() : null;
  return (S.staff || []).filter(function(w) { return w.active !== false; }).map(function(w) { return { w: w, mo: pplMotivation(w, null, memo) }; })
    .filter(function(x) { return x.mo.firm && x.mo.score < 50; }).map(function(x) {
      return { key: 'pplWatch:' + x.w.id, rule: 'pplWatch', tone: x.mo.score < 35 ? 'red' : 'amber', title: x.w.name + ': motivation ' + x.mo.score,
        sub: x.mo.sig.length ? x.mo.sig[0].word : 'the check-in', why: 'People · the motivation index',
        facts: x.mo.sig.map(function(s) { return [s.word, '−' + s.weight]; }).concat(x.mo.checkin ? [['Check-in ' + formatDate(x.mo.checkin.on), x.mo.checkin.score + ' of 5' + (x.mo.checkin.note ? ': ' + x.mo.checkin.note : '')]] : []),
        clears: 'Clears itself when the index is 50 or more: a signal resolved, or a better check-in.', go: { kind: 'staffRoster' }, goLabel: 'Open the roster',
        sig: x.w.id + ':' + x.mo.score };
    });
};
