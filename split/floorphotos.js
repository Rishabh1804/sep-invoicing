/* ===== FLOOR PHOTOS (Production → Photos) =====
   Owner, 17 Nov 2026: "Till this plan is approved or edited, build an infrastructure to work with what we have got, as in photos from
   [the floor's people] or me, we will start tagging it and start data logging to the app and database. This will help us refine
   future infrastructure development plans as well and help in designing and seeing how our infrastructure change ideas feel on the
   real floor." Asked where a picture is kept: on the device that adds it ("I will be the only one uploading the photos - they will
   be sent to me on whatsapp"); who tags: the sender at upload, the owner later from a queue, and Claude suggesting with a person
   confirming, all three.

   - The picture stays on the device that added it (the knowledge base's media store, kbImageAdd: shrunk to 1,600 px, kept under the
     hash of its bytes, so the same photo twice is one). The book keeps the log: when, which area, who sent it, the answers, a note.
   - The areas and their questions are the book's (`S.floorPhotos.areas`), typed once by the owner: nothing about the shop is in the
     build. A question ending "?" is answered yes or no, one ending "#" with a count, any other with words. An area may watch a line
     (VAT A1, VAT A2, the barrel, pickling), and a photo of it shows the record within an hour of its time: the first cross-check.
   - A photo is saved the moment it is added, untagged; it waits in To tag until every question of its area is answered. Claude's
     reading (photoread.js) only fills the form: nothing it says is saved until a person saves it, and the photo records that it was
     read and what that cost.
   - A photo is voided with a reason, never deleted (the record says what happened). */
var FPH_WINDOW_MIN = 60;
var _fphOpen = null;      // the photo being tagged
var _fphDraft = null;     // its form, as typed
var _fphView = 'list';    // 'list' | 'areas'
var _fphFilter = { area: '', todo: false };
var _fphBusy = '';

/* The log as the book holds it. A read never writes (drawing the tab changes nothing the change log would see, P141): with no log
   yet it answers an empty one, attached to the book only when `write` asks, by a save. */
function fphData(write) {
  var d = S.floorPhotos;
  var ok = d && typeof d === 'object' && !Array.isArray(d) && Array.isArray(d.areas) && Array.isArray(d.photos);
  if (ok) return d;
  if (!write) return { areas: d && Array.isArray(d.areas) ? d.areas : [], photos: d && Array.isArray(d.photos) ? d.photos : [] };
  if (!d || typeof d !== 'object' || Array.isArray(d)) d = S.floorPhotos = {};
  if (!Array.isArray(d.areas)) d.areas = [];
  if (!Array.isArray(d.photos)) d.photos = [];
  return d;
}
function fphArea(id) { return fphData().areas.find(function(a) { return a.id === id; }) || null; }
function fphLive() { return fphData().photos.filter(function(p) { return !p.voidedAt; }); }

/* A question as the owner types it: "Line loaded?" yes or no; "Racks in the bath #" a count; anything else words. */
function fphQuestion(text, i) {
  var t = String(text || '').trim();
  if (!t) return null;
  var kind = /\?\s*$/.test(t) ? 'yesno' : /#\s*$/.test(t) ? 'count' : 'text';
  var label = kind === 'count' ? t.replace(/\s*#\s*$/, '') : t;
  return { id: 'q' + (i + 1), text: label, kind: kind };
}
function fphQuestionsText(area) {
  return (area.questions || []).map(function(q) { return q.text + (q.kind === 'count' ? ' #' : ''); }).join('\n');
}
/* Every question of its area answered (a blank count or text is unanswered; a yes/no needs yes or no). */
function fphTagged(p) {
  var a = fphArea(p.area);
  if (!a) return false;
  var t = p.tags || {};
  return (a.questions || []).every(function(q) { return t[q.id] !== undefined && t[q.id] !== null && t[q.id] !== ''; });
}
function fphTodo() { return fphLive().filter(function(p) { return !fphTagged(p); }); }

/* The record within an hour of a photo of an area that watches a line: runs on that line, or pickling loads. */
function fphRecordNear(p) {
  var a = fphArea(p.area), t = relayParseHhmm(p.time);
  if (!a || !a.line || t == null || typeof prodIndex !== 'function') return null;
  var kind = a.line === 'pickling' ? 'pickled' : 'plated';
  var idx = prodIndex();
  return idx.live.filter(function(e) {
    if (e.kind !== kind || e.date !== p.date || idx.replaced[e.id]) return false;
    if (kind === 'plated' && e.line !== a.line) return false;
    var from = relayParseHhmm(e.time), to = relayParseHhmm(e.to);
    if (from == null) return false;
    // A run covers its own span; a load is a moment.
    return to != null && to > from ? (t >= from - FPH_WINDOW_MIN && t <= to + FPH_WINDOW_MIN) : Math.abs(t - from) <= FPH_WINDOW_MIN;
  });
}

/* ---------- Adding ---------- */
function fphPick() { var inp = document.getElementById('fphFile'); if (inp) { inp.value = ''; inp.click(); } }
async function fphAddFiles(files) {
  var list = Array.prototype.slice.call(files || []);
  if (!list.length) return;
  if (!grdOk('floor') && !(await guardAsk('floor', 'add floor photos'))) return;   // the guard (guard.js): a floor entry
  var d = fphData(true), by = stockBy(), last = d.photos.length ? d.photos[d.photos.length - 1] : null, added = [], same = 0;
  _fphBusy = 'Adding ' + todoPlural(list.length, 'photo');
  renderProduction();
  for (var i = 0; i < list.length; i++) {
    var f = list[i];
    try {
      var im = await kbImageAdd(f);
      if (d.photos.some(function(p) { return p.img === im.id && !p.voidedAt; })) { same++; continue; }
      // The file's own time: a picture saved from WhatsApp carries the minute it arrived. Said on the form, and changed there.
      var when = new Date(f.lastModified || Date.now());
      var p = { id: stockUid('FP'), img: im.id, w: im.w, h: im.h, name: String(f.name || '').slice(0, 80),
        date: when.getFullYear() + '-' + ('0' + (when.getMonth() + 1)).slice(-2) + '-' + ('0' + when.getDate()).slice(-2), time: ('0' + when.getHours()).slice(-2) + ':' + ('0' + when.getMinutes()).slice(-2),
        area: last ? last.area : '', sentBy: last ? last.sentBy : '', tags: {}, note: '', by: by, at: Date.now() };
      d.photos.push(p);
      added.push(p.id);
    } catch (e) { uiNotice((f.name || 'A photo') + ': ' + ((e && e.message) || 'could not be added'), 'error'); }
  }
  _fphBusy = '';
  if (added.length) saveState();
  if (added.length) fphOpen(added[0]); else renderProduction();
  showToast(todoPlural(added.length, 'photo') + ' added' + (same ? ' · ' + todoPlural(same, 'photo') + ' already in the log' : '') + (added.length ? ': tag each, or leave them in To tag' : ''), added.length ? 'success' : 'warning');
}

/* ---------- Tagging ---------- */
function fphOpen(id) {
  var p = fphData().photos.find(function(x) { return x.id === id; });
  if (!p) return;
  _fphOpen = id;
  _fphDraft = { date: p.date, time: p.time, area: p.area, sentBy: p.sentBy, note: p.note || '', tags: Object.assign({}, p.tags || {}), from: {}, claude: null };
  _fphView = 'list';
  if (_prodTab !== 'photos') prodSetTab('photos');
  _prodView = 'main';
  renderProduction();
  viewTop();
}
function fphClose() { _fphOpen = null; _fphDraft = null; keepScroll(renderProduction); }
/* The next photo still to tag after the one open (the queue, oldest first), or none. */
function fphNextTodo(afterId) {
  var todo = fphTodo().sort(function(a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
  var i = todo.findIndex(function(p) { return p.id === afterId; });
  var rest = todo.filter(function(p, j) { return j !== i; });
  return rest.length ? rest[i >= 0 && i < rest.length ? i : 0] : null;
}
function fphSave(next) {
  var p = fphData().photos.find(function(x) { return x.id === _fphOpen; }), f = _fphDraft;
  if (!p || !f) return;
  if (!grdGate('floor', 'tag a floor photo', function() { fphSave(next); })) return;
  if (!f.date || f.date > localDateStr()) { showToast('Pick a day up to today', 'error'); return; }
  if (!/^\d{1,2}:\d{2}$/.test(f.time || '')) { showToast('Enter the time the photo was taken', 'error'); return; }
  if (!f.area) { showToast('Pick the area', 'error'); return; }
  var a = fphArea(f.area), tags = {};
  (a.questions || []).forEach(function(q) {
    var v = f.tags[q.id];
    if (v === undefined || v === null || v === '') return;
    if (q.kind === 'count') { var n = parseInt(v, 10); if (!isNaN(n) && n >= 0) tags[q.id] = n; }
    else if (q.kind === 'yesno') { if (v === 'yes' || v === 'no') tags[q.id] = v; }
    else tags[q.id] = String(v).trim();
  });
  p.date = f.date; p.time = f.time; p.area = f.area; p.sentBy = String(f.sentBy || '').trim(); p.note = String(f.note || '').trim();
  p.tags = tags; p.tagBy = stockBy(); p.tagAt = Date.now();
  // Which answers Claude suggested and a person kept: the record says so.
  var kept = Object.keys(tags).filter(function(k) { return f.from[k] === 'claude' && String(f.claude && f.claude[k]) === String(tags[k]); });
  if (kept.length) p.claudeKept = kept; else delete p.claudeKept;
  saveState();
  var nx = next ? fphNextTodo(p.id) : null;
  showToast('Photo saved' + (fphTagged(p) ? '' : ': some questions left for later'), 'success');
  if (nx) fphOpen(nx.id); else fphClose();
}
async function fphVoid() {
  var p = fphData().photos.find(function(x) { return x.id === _fphOpen; });
  if (!p) return;
  if (!grdGate('voids', 'void a floor photo', fphVoid)) return;
  var why = await uiPrompt({ title: 'Void this photo?', body: 'It stays in the log, marked void, with your reason.', label: 'Reason', danger: true, okLabel: 'Void', required: true, requiredText: 'A voided photo needs a reason.' });
  if (!why || !String(why).trim()) return;
  p.voidedAt = Date.now(); p.voidReason = String(why).trim(); p.voidBy = stockBy();
  saveState();
  fphClose();
  showToast('Photo voided', 'success');
}

/* Claude's reading of the photo against its area's questions: it fills the form, a person saves it. */
async function fphAskClaude() {
  var p = fphData().photos.find(function(x) { return x.id === _fphOpen; }), f = _fphDraft;
  if (!p || !f) return;
  var a = fphArea(f.area);
  if (!a) { showToast('Pick the area first: Claude answers its questions', 'error'); return; }
  if (!(a.questions || []).length) { showToast('This area has no questions yet: add them in Areas', 'error'); return; }
  if (!phKey()) { phNoKey(); return; }
  var blob = await kbMediaGet(p.img);
  if (!blob) { showToast('The picture is on another device', 'error'); return; }
  var props = {};
  a.questions.forEach(function(q) { props[q.id] = phNull(q.kind === 'yesno' ? 'boolean' : q.kind === 'count' ? 'integer' : 'string'); });
  props.seen = { type: 'string' };
  var prompt = 'A photo of one area of a zinc electroplating job-work plant: ' + a.name + '. Answer each question only from what the photo shows; ' +
    'null where it cannot be seen. Do not guess. Then, in "seen", say in one plain sentence what the photo shows.\n' +
    a.questions.map(function(q) { return q.id + ': ' + q.text + (q.kind === 'yesno' ? ' (true or false)' : q.kind === 'count' ? ' (a whole number)' : ' (a few words)'); }).join('\n');
  _fphBusy = 'Claude is reading the photo';
  renderProduction();
  var r = await phRead(blob, prompt, phObj(props));
  _fphBusy = '';
  if (_fphDraft !== f) return;
  if (!r.ok) { phSayFail('The photo', r); renderProduction(); return; }
  var got = {};
  a.questions.forEach(function(q) {
    var v = r.json[q.id];
    if (v === null || v === undefined) return;
    got[q.id] = q.kind === 'yesno' ? (v ? 'yes' : 'no') : q.kind === 'count' ? String(v) : String(v);
    f.tags[q.id] = got[q.id]; f.from[q.id] = 'claude';
  });
  f.claude = got; f.seen = String(r.json.seen || '');
  p.claudeRead = { at: Date.now(), model: r.meta && r.meta.model || '', usd: r.meta && r.meta.usd || null };
  saveState();
  renderProduction();
}

/* ---------- Areas ---------- */
function fphAreasSave() {
  if (!grdGate('settings', 'change the photo areas', fphAreasSave)) return;
  var d = fphData(true);
  d.areas.forEach(function(a) {
    var nm = document.getElementById('fphAreaName_' + a.id), ln = document.getElementById('fphAreaLine_' + a.id), qs = document.getElementById('fphAreaQs_' + a.id);
    if (nm && nm.value.trim()) a.name = nm.value.trim();
    if (ln) a.line = ln.value || '';
    if (qs) {
      // A question keeps its id while it stands in the same place, so the answers already given still read.
      a.questions = qs.value.split('\n').map(fphQuestion).filter(Boolean).map(function(q, i) { q.id = 'q' + (i + 1); return q; });
    }
  });
  var add = document.getElementById('fphAreasAdd');
  var names = add ? add.value.split(/\n|,/).map(function(x) { return x.trim(); }).filter(Boolean) : [];
  names.forEach(function(n) {
    if (d.areas.some(function(a) { return a.name.toLowerCase() === n.toLowerCase(); })) return;
    d.areas.push({ id: stockUid('FA'), name: n, line: '', questions: [], at: Date.now() });
  });
  saveState();
  showToast('Areas saved' + (names.length ? ' · ' + todoPlural(names.length, 'area') + ' added' : ''), 'success');
  keepScroll(renderProduction);
}

/* ---------- Drawing ---------- */
var FPH_LINE_OPTS = [['', 'No line'], ['vat-a1', 'VAT A1'], ['vat-a2', 'VAT A2'], ['barrel', 'Barrel'], ['pickling', 'Pickling']];
function fphField(id, label, input, hint) {
  return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + label + '</label>' + input + (hint ? '<div class="inv-field-hint">' + hint + '</div>' : '') + '</div>';
}
function fphHtml() {
  if (_fphBusy) return uiBlankHtml({ kind: 'loading', title: _fphBusy, body: 'The picture stays on this device; only the log goes in the book.' });
  if (_fphOpen && _fphDraft) return fphTagHtml();
  if (_fphView === 'areas') return fphAreasHtml();
  var d = fphData(), live = fphLive(), todo = fphTodo();
  var h = uiVerdictHtml({ screen: 'Production · Photos', tone: !live.length ? 'neutral' : todo.length ? 'warning' : 'ok', attrs: ' id="fphVerdict"',
    verdict: !live.length ? 'No floor photos yet' : todoPlural(live.length, 'photo') + ' in the log' + (todo.length ? ', ' + todo.length + ' to tag' : ', all tagged'),
    facts: [d.areas.length ? todoPlural(d.areas.length, 'area') : 'no areas yet: add them in Areas'] });
  h += '<div class="inv-toolbar"><button class="inv-btn inv-btn-primary" data-action="invFphAdd">Add photos</button>' +
    (todo.length ? '<button class="inv-btn inv-btn-secondary" data-action="invFphTagNext">Tag the next</button>' : '') +
    '<button class="inv-btn inv-btn-ghost" data-action="invFphAreas">Areas</button>' +
    '<input type="file" accept="image/*" id="fphFile" class="inv-hidden" multiple data-nodirty tabindex="-1" aria-hidden="true"></div>';
  if (d.areas.length) {
    h += '<div class="inv-toolbar" role="group" aria-label="Show"><button class="inv-chip" data-action="invFphFilter" data-area="" aria-pressed="' + (!_fphFilter.area && !_fphFilter.todo) + '">All</button>' +
      '<button class="inv-chip" data-action="invFphFilter" data-todo="1" aria-pressed="' + _fphFilter.todo + '">To tag</button>' +
      d.areas.map(function(a) { return '<button class="inv-chip" data-action="invFphFilter" data-area="' + escHtml(a.id) + '" aria-pressed="' + (_fphFilter.area === a.id) + '">' + escHtml(a.name) + '</button>'; }).join('') + '</div>';
  }
  var list = (_fphFilter.todo ? todo : live).filter(function(p) { return !_fphFilter.area || p.area === _fphFilter.area; })
    .sort(function(a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });
  if (!list.length) return h + uiEmptyHtml(live.length ? 'No photo in this view.' : 'Add the photos sent to you: each is logged with its area, time and sender, and tagged now or later.');
  var day = null;
  h += '<div class="inv-panel inv-panel-flush" id="fphList">';
  list.slice(0, 200).forEach(function(p) {
    if (p.date !== day) { day = p.date; h += '<div class="inv-row-group"><span>' + escHtml(attDayName(day) + ' ' + stockShortDate(day)) + '</span></div>'; }
    var a = fphArea(p.area), done = fphTagged(p), near = fphRecordNear(p);
    var meta = [p.time, p.sentBy ? 'from ' + p.sentBy : '', near ? (near.length ? todoPlural(near.length, a.line === 'pickling' ? 'load' : 'run') + ' in the record within an hour' : 'nothing in the record within an hour') : ''].filter(Boolean).join(' · ');
    h += '<div class="inv-row" data-fph-row="' + escHtml(p.id) + '"><button class="inv-row-main" data-action="invFphOpen" data-id="' + escHtml(p.id) + '"><span class="inv-row-title">' + escHtml(a ? a.name : 'No area') + '</span>' +
      '<span class="inv-row-meta">' + escHtml(meta) + '</span></button><span class="inv-row-end"><span class="inv-dot inv-dot-' + (done ? 'neutral' : 'warning') + '">' + (done ? 'Tagged' : 'To tag') + '</span></span></div>';
  });
  return h + '</div>';
}
function fphTagHtml() {
  var p = fphData().photos.find(function(x) { return x.id === _fphOpen; }), f = _fphDraft, d = fphData();
  if (!p) return '';
  var a = fphArea(f.area), today = localDateStr();
  var h = '<div class="inv-pagehead"><button class="inv-btn inv-btn-ghost inv-btn-sm inv-pagehead-back" data-action="invFphClose">' + STOCK_BACK_ICON + 'Photos</button>' +
    '<h2 class="inv-pagehead-title">' + escHtml(fphTagged(p) ? 'A floor photo' : 'Tag a floor photo') + '</h2></div>';
  h += '<figure class="inv-kb-fig"><img class="inv-kb-img" data-kb-img="' + escHtml(p.img) + '" alt="' + escHtml((a ? a.name : 'Floor') + ' photo') + '" width="' + (parseInt(p.w, 10) || 0) + '" height="' + (parseInt(p.h, 10) || 0) + '"></figure>';
  if (p.voidedAt) h += '<div class="inv-callout inv-callout-danger">' + escHtml('Void: ' + (p.voidReason || '')) + '</div>';
  h += '<div class="inv-panel"><div class="inv-fields">' +
    fphField('fphDate', 'Day', '<input type="date" class="inv-input" id="fphDate" data-fph-f="date" value="' + escHtml(f.date) + '" max="' + today + '">') +
    fphField('fphTime', 'Time taken', '<input type="time" class="inv-input" id="fphTime" data-fph-f="time" value="' + escHtml(f.time) + '">', 'From the file; change it if the photo was taken earlier.') +
    fphField('fphArea', 'Area', '<select class="inv-select" id="fphArea" data-fph-f="area"><option value="">Pick the area</option>' +
      d.areas.map(function(x) { return '<option value="' + escHtml(x.id) + '"' + (x.id === f.area ? ' selected' : '') + '>' + escHtml(x.name) + '</option>'; }).join('') + '</select>') +
    fphField('fphSentBy', 'Sent by', '<input class="inv-input" id="fphSentBy" data-fph-f="sentBy" list="fphSenders" value="' + escHtml(f.sentBy) + '" autocomplete="off">' +
      '<datalist id="fphSenders">' + (S.staff || []).filter(function(w) { return w.active !== false; }).map(function(w) { return '<option value="' + escHtml(w.name) + '">'; }).join('') + '</datalist>') +
    '</div>';
  if (!d.areas.length) h += '<div class="inv-note inv-mt-8">No areas yet: add them in Areas, each with its questions.</div>';
  if (a) {
    h += '<div class="inv-row-group inv-mt-8"><span>' + escHtml(a.name) + '</span></div>';
    if (!(a.questions || []).length) h += '<div class="inv-note">No questions for this area yet: add them in Areas.</div>';
    h += '<div class="inv-fields">' + (a.questions || []).map(function(q) {
      var v = f.tags[q.id] == null ? '' : String(f.tags[q.id]), id = 'fphQ_' + q.id, by = f.from[q.id] === 'claude' ? 'Claude’s suggestion: check it' : '';
      var input = q.kind === 'yesno' ? '<select class="inv-select" id="' + id + '" data-fph-q="' + q.id + '"><option value=""' + (!v ? ' selected' : '') + '>Not answered</option><option value="yes"' + (v === 'yes' ? ' selected' : '') + '>Yes</option><option value="no"' + (v === 'no' ? ' selected' : '') + '>No</option></select>'
        : q.kind === 'count' ? '<input type="number" inputmode="numeric" step="1" min="0" class="inv-input inv-input-num" id="' + id + '" data-fph-q="' + q.id + '" value="' + escHtml(v) + '">'
        : '<input class="inv-input" id="' + id + '" data-fph-q="' + q.id + '" value="' + escHtml(v) + '" autocomplete="off">';
      return fphField(id, escHtml(q.text), input, by);
    }).join('') + '</div>';
    if (f.seen) h += '<div class="inv-note inv-mt-4" data-fph-seen>' + escHtml('Claude: ' + f.seen) + '</div>';
  }
  h += '<div class="inv-fields inv-mt-8">' + fphField('fphNote', 'Note', '<input class="inv-input" id="fphNote" data-fph-f="note" value="' + escHtml(f.note) + '" autocomplete="off">') + '</div></div>';
  // The record at the photo's time, where its area watches a line: the cross-check the log is for.
  var near = a ? fphRecordNear(Object.assign({}, p, { date: f.date, time: f.time, area: f.area })) : null;
  if (near) {
    h += '<div class="inv-panel inv-panel-flush" id="fphNear"><div class="inv-panel-head"><span class="inv-panel-title">The record within an hour</span><span class="inv-panel-count">' + near.length + '</span></div>' +
      (near.length ? near.map(function(e) { return '<div class="inv-row"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(prodEntryTitle(e)) + '</span><span class="inv-row-meta">' +
        escHtml((e.time || '') + (e.to ? '–' + e.to : '') + ' · ' + prodQtyText(e.qty, e.unit)) + '</span></span></div>'; }).join('')
        : uiEmptyHtml('Nothing recorded on ' + escHtml(FPH_LINE_OPTS.find(function(o) { return o[0] === a.line; })[1]) + ' within an hour of this photo.')) + '</div>';
  }
  h += '<div class="inv-toolbar">' + (a && (a.questions || []).length ? '<button class="inv-btn inv-btn-secondary" data-action="invFphClaude" title="' + escHtml('About ' + phMoney(PH_EST_USD) + ' a photo') + '">Ask Claude</button>' : '') +
    (!p.voidedAt ? '<button class="inv-btn inv-btn-ghost" data-action="invFphVoid">Void</button>' : '') + '</div>';
  h += '<div class="inv-actionbar"><button class="inv-btn inv-btn-secondary" data-action="invFphSave">Save</button><button class="inv-btn inv-btn-primary" data-action="invFphSaveNext">Save and next</button></div>';
  return h;
}
function fphAreasHtml() {
  var d = fphData();
  var h = '<div class="inv-pagehead"><button class="inv-btn inv-btn-ghost inv-btn-sm inv-pagehead-back" data-action="invFphList">' + STOCK_BACK_ICON + 'Photos</button>' +
    '<h2 class="inv-pagehead-title">Photo areas</h2></div>';
  h += '<div class="inv-note">Each area has its questions, one a line. End a question with ? for yes or no, with # for a count; any other is answered in words. An area that watches a line shows the record within an hour of each photo.</div>';
  d.areas.forEach(function(a) {
    h += '<div class="inv-panel" data-fph-area="' + escHtml(a.id) + '"><div class="inv-fields">' +
      fphField('fphAreaName_' + a.id, 'Area', '<input class="inv-input" id="fphAreaName_' + a.id + '" value="' + escHtml(a.name) + '">') +
      fphField('fphAreaLine_' + a.id, 'Watches', '<select class="inv-select" id="fphAreaLine_' + a.id + '">' + FPH_LINE_OPTS.map(function(o) { return '<option value="' + o[0] + '"' + ((a.line || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>') +
      '</div>' + fphField('fphAreaQs_' + a.id, 'Questions', '<textarea class="inv-textarea" rows="4" id="fphAreaQs_' + a.id + '" placeholder="Line loaded?\nRacks in the bath #\nWhat is waiting">' + escHtml(fphQuestionsText(a)) + '</textarea>') + '</div>';
  });
  h += '<div class="inv-panel">' + fphField('fphAreasAdd', d.areas.length ? 'Add areas, one a line' : 'Your areas, one a line', '<textarea class="inv-textarea" rows="4" id="fphAreasAdd"></textarea>') + '</div>';
  h += '<div class="inv-actionbar"><button class="inv-btn inv-btn-primary" data-action="invFphAreasSave">Save areas</button></div>';
  return h;
}

/* ---------- Events (routed from Production's own, prodview.js) ---------- */
function fphAction(action, btn) {
  switch (action) {
    case 'invFphAdd': fphPick(); return true;
    case 'invFphOpen': fphOpen(btn.dataset.id); return true;
    case 'invFphClose': fphClose(); return true;
    case 'invFphSave': fphSave(false); return true;
    case 'invFphSaveNext': fphSave(true); return true;
    case 'invFphTagNext': { var nx = fphNextTodo(null); if (nx) fphOpen(nx.id); return true; }
    case 'invFphVoid': fphVoid(); return true;
    case 'invFphClaude': fphAskClaude(); return true;
    case 'invFphAreas': _fphView = 'areas'; renderProduction(); viewTop(); return true;
    case 'invFphList': _fphView = 'list'; renderProduction(); return true;
    case 'invFphAreasSave': fphAreasSave(); return true;
    case 'invFphFilter':
      _fphFilter = btn.dataset.todo ? { area: '', todo: !_fphFilter.todo } : { area: btn.dataset.area || '', todo: false };
      keepScroll(renderProduction); return true;
  }
  return false;
}
function fphOnChange(t) {
  if (!t) return false;
  if (t.id === 'fphFile') { fphAddFiles(t.files); return true; }
  if (!_fphDraft || !t.dataset) return false;
  if (t.dataset.fphF) {
    _fphDraft[t.dataset.fphF] = t.value;
    // A new area asks its own questions: the answers to the last one's go.
    if (t.dataset.fphF === 'area') { _fphDraft.tags = {}; _fphDraft.from = {}; _fphDraft.seen = ''; keepScroll(renderProduction); }
    return true;
  }
  if (t.dataset.fphQ) { _fphDraft.tags[t.dataset.fphQ] = t.value; delete _fphDraft.from[t.dataset.fphQ]; return true; }
  return false;
}
function fphOnInput(t) {
  if (!t || !_fphDraft || !t.dataset || t.tagName === 'SELECT') return false;
  if (t.dataset.fphF) { _fphDraft[t.dataset.fphF] = t.value; return true; }
  if (t.dataset.fphQ) { _fphDraft.tags[t.dataset.fphQ] = t.value; delete _fphDraft.from[t.dataset.fphQ]; return true; }
  return false;
}
