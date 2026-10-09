/* ===== PRODUCTION — the page (Floor → Production) =====
 * Overview · In plant · Lines · Entries, over one record (production.js). Paste message is the page's one primary;
 * reading a register photo and entering by hand sit beside it. The sub-views (paste, review, photo, hand) lead with
 * a way back and end in the action bar, and draw no toolbar (DR-3).
 */
var _prodEntryOpen = null;   // the entry open in the desktop's pane (Entries)
var PROD_TABS = [['overview', 'Overview'], ['equipment', 'Equipment'], ['plant', 'In plant'], ['lines', 'Lines'], ['entries', 'Entries']];
var _prodTab = (function() { try { var t = localStorage.getItem('sep_inv_prod_tab'); return PROD_TABS.some(function(x) { return x[0] === t; }) ? t : 'overview'; } catch (e) { return 'overview'; } })();
var _prodTabMoved = false;
var _prodView = 'main';          // main · paste · review · photo · hand
var _prodPasteDraft = '';
var _prodReview = null;          // {msgs, choices}
var _prodPhoto = null;           // {name, bytes, url, sha, res, read, choices, dupSha, dupFp, photoDate}
var _prodHand = null;            // the hand form
var _prodLine = 'vat-a1';        // Lines: which line
var _prodDay = null;             // Lines: which day (null = the last recorded)
var _prodFilter = { kind: '', flag: '', client: '' };
var _prodPlantClient = '';
var PROD_DRAFT_KEY = 'sep_inv_prod_photo_draft';

function prodSetTab(t) {
  if (!PROD_TABS.some(function(x) { return x[0] === t; })) t = 'overview';
  if (t !== _prodTab) _prodTabMoved = true;
  _prodTab = t;
  try { localStorage.setItem('sep_inv_prod_tab', t); } catch (e) { /* a per-device convenience only */ }
}
function prodSetView(v) { var moved = v !== _prodView; _prodView = v; renderProduction(); if (moved) viewTop(); }

function prodBackBar(title) {
  return '<div class="inv-pagehead"><button class="inv-btn inv-btn-ghost inv-btn-sm inv-pagehead-back" data-action="invProdBack">' + STOCK_BACK_ICON + 'Production</button>' +
    '<h2 class="inv-pagehead-title">' + escHtml(title) + '</h2></div>';
}
function prodToolbarHtml() {
  return '<div class="inv-toolbar"><button class="inv-btn inv-btn-primary" data-action="invProdPaste">Paste message</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invProdPhoto">Read register photo</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invProdHand">Enter by hand</button>' +
    (_prodTab === 'entries' ? '<button class="inv-btn inv-btn-ghost" data-action="invProdExport">Export</button><button class="inv-btn inv-btn-ghost" data-action="invProdImport">Import</button>' +
      '<input type="file" accept=".json,application/json" id="prodFileInput" class="inv-hidden">' : '') +
    '<input type="file" accept="image/*" id="prodPhotoInput" class="inv-hidden" multiple></div>';
}

function renderProduction() {
  var el = document.getElementById('productionContent');
  if (!el) return;
  prodData();
  var h;
  if (_prodView === 'paste') h = prodPasteHtml();
  else if (_prodView === 'review' && _prodReview) h = prodReviewHtml();
  else if (_prodView === 'photo' && _prodPhoto) h = prodPhotoHtml();
  else if (_prodView === 'hand' && _prodHand) h = prodHandHtml();
  else {
    _prodView = 'main';
    h = '<div class="inv-viewtabs" role="tablist" aria-label="Production">' + PROD_TABS.map(function(t) {
      return '<button class="inv-viewtab" role="tab" aria-selected="' + (_prodTab === t[0]) + '" data-action="invProdTab" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>' + prodToolbarHtml();
    // Photos picked with a challan handed to the challan scanner wait here, and are read on from here (P127).
    if (_prodPhotoQueue.length) h += '<div class="inv-callout inv-callout-info" id="prodPhotoWaiting">' + escHtml(todoPlural(_prodPhotoQueue.length, 'register photo') + ' picked with the challan sent to the scanner ' + (_prodPhotoQueue.length === 1 ? 'is' : 'are') + ' waiting to be read.') +
      '<div class="inv-mt-4"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invProdPhotoNext">Read the next</button></div></div>';
    var p = prodData();
    // The plant register (plant.js) needs no production record: a unit is the shop's, before anything is plated on it.
    if (_prodTab === 'equipment') h += pltEquipmentHtml();
    else if (!p.entries.length && _prodTab !== 'plant') h += pltGlanceHtml() + '<div class="inv-empty">No production recorded yet. Paste a pickling or production message, read a register photo, or import the history from soma-internal.</div>';
    else if (_prodTab === 'plant') h += prodPlantHtml();
    else if (_prodTab === 'lines') h += prodLinesHtml();
    else if (_prodTab === 'entries') h += prodEntriesHtml();
    else h += prodOverviewHtml();
  }
  paneScrollKeep(function() { el.innerHTML = h; });
  viewTabReveal(el.querySelector('.inv-viewtabs'));
  if (_prodTabMoved) { _prodTabMoved = false; viewTop(); }
}

/* ---------- Shared bits ---------- */
function prodQtyText(q, u) { if (q == null) return 'no quantity'; return (u === 'KG' ? formatNum(q, q % 1 ? 2 : 0) + ' kg' : Math.round(q).toLocaleString('en-IN') + (u ? ' ' + u : '')); }
function prodLineName(l) { return l ? PROD_LINE_LABEL[l] || l : 'Line unknown'; }
function prodEntryTitle(e) { return (e.clientId != null ? prodClientName(e.clientId) || e.client : e.client || 'No client') + (e.part ? ' · ' + e.part : ''); }
function prodSrcWord(e) { return { paste: 'message', photo: 'register photo', hand: 'by hand', 'import': 'history' }[e.src] || e.src || ''; }

/* ---------- A day's plating, as one card ----------
   Owner, 9 Oct 2026: the tile read "7,630 NOS + 150 kg … 0.68 t known, 14% of the pieces weighed", which "is not uniform
   enough to draw a full picture of what happened". The day in one unit: the tonnes, every run weighed by the surest route
   the book holds (prodWeigh), what of it is estimated said, the range the estimates allow, against two shifts and the
   plant's usual day; each line's runs on the clock, the clients, the pieces nothing weighs with the move that weighs them,
   the cuts and the loads. One card for Production's Overview, Floor and Pulse (`compact`: the lines and how it was weighed). */
function prodDayHeroHtml(date, opts) {
  opts = opts || {};
  var isToday = date === localDateStr(), attrs = ' data-prod-day="' + escHtml(date || '') + '"' + (opts.attrs || '');
  var foot = function(line) {
    return '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invProdDayLines" data-day="' + escHtml(date || '') + '" data-line="' + escHtml(line || '') + '">' + (date ? 'Open the lines' : 'Open Production') + '</button>';
  };
  if (!date) return uiHeroHtml({ tone: 'neutral', eyebrow: '<span>Plated</span>', title: 'No plating on record yet', attrs: attrs, fold: opts.fold, foot: foot('') });
  // Pulse shows the last day on record: how long ago it was is said, and a record days behind is amber (it has stopped).
  var lag = opts.compact ? isoDaysBetween(date, localDateStr()) : 0;
  var pic = prodDayPicture(date), when = attDayName(date) + ' ' + formatDate(date) + (isToday ? ' · so far' : lag === 1 ? ' · yesterday' : lag > 1 ? ' · ' + lag + ' days ago' : '');
  var eyebrow = '<span>Plated</span><span class="inv-panel-count">' + escHtml(when) + '</span>';
  if (!pic.runs) {
    return uiHeroHtml({ tone: pic.missing.length ? 'warning' : 'neutral', eyebrow: eyebrow, attrs: attrs, fold: opts.fold, foot: foot(''),
      title: escHtml(pic.missing.length ? prodLinesWord(pic.missing) + ' had heads and no record' : isToday ? 'No plating recorded yet today' : 'No plating recorded this day: a gap, not a zero') });
  }
  var estd = pic.est > 0.0005, sure = pic.by.written + pic.by.record, de = prodDayEfficiency(date);
  // The colour is the plant's efficiency (owner, 9 Oct 2026: efficiency decides a card's colour), made worse by a general shift
  // with heads and no record, or by pieces nothing weighs (the day then reads low). The title says the first of those.
  var tone = de.eff != null ? de.tone : '', title;
  var rank = { '': 0, neutral: 0, ok: 1, info: 1, warning: 2, danger: 3 }, worse = function(t) { if (rank[t] > rank[tone]) tone = t; };
  var effWord = de.eff != null ? Math.round(de.eff * 100) + '% of what the working lines could plate' : '';
  if (pic.missing.length) { worse('warning'); title = prodLinesWord(pic.missing) + ' had heads and no record: the day reads short'; }
  else if (pic.unweighed && pic.unweighed / pic.pieces > 0.1) { worse('warning'); title = Math.round(pic.unweighed).toLocaleString('en-IN') + ' pieces not weighed: the day reads short'; }
  else if (effWord) title = (isToday ? 'So far today, ' : '') + effWord;
  else if (isToday) title = 'So far today, on ' + todoPlural(pic.ran.length, 'line');
  else if (pic.usual != null && pic.kg < pic.usual * 0.8) { worse('warning'); title = 'Under a usual day of ' + prodKgFig(pic.usual, true); }
  else if (pic.usual != null) { worse('ok'); title = (pic.kg > pic.usual * 1.2 ? 'Over' : 'About') + ' a usual day of ' + prodKgFig(pic.usual, true); }
  else title = todoPlural(pic.ran.length, 'line') + ' ran';
  if (lag > 2 && !tone) tone = 'warning';
  // How good and how sure, in short facts (§6.27): the plant's efficiency where the title is about something else, the share
  // estimated, the pieces nothing weighs where the title does not say them; the record itself where none of those is.
  var notW = pic.unweighed ? Math.round(pic.unweighed).toLocaleString('en-IN') + ' pcs not weighed' : '';
  var sub = [effWord && title.indexOf(effWord) < 0 ? Math.round(de.eff * 100) + '% efficient' : '', estd && pic.kg > 0 ? Math.round(pic.est / pic.kg * 100) + '% estimated' : pic.unweighed ? '' : 'every run weighed',
    notW && title.indexOf('not weighed') < 0 ? notW : ''].filter(Boolean).join(' · ') || prodPlatedSub(pic.pieces, pic.kgWritten, 0, 0, 0);
  var meterTitle = prodKgFig(pic.kg, estd, pic.unweighed > 0) + ' plated: ' + [sure ? prodKgFig(sure) + ' weighed' : '', pic.by.challans ? prodKgFig(pic.by.challans) + ' from the challans' : '',
    pic.by['default'] ? prodKgFig(pic.by['default']) + ' at a client’s default' : '', pic.by.kind ? prodKgFig(pic.by.kind) + ' by kind' : ''].filter(Boolean).join(', ') +
    '. Two shifts hold about ' + prodKgFig(pic.capacity) + (pic.usual != null ? '; a usual day is ' + prodKgFig(pic.usual, true) : '') + '.';
  var viz = chartMeter([{ v: sure, tone: 'ok' }, { v: pic.by.challans, tone: 'info' }, { v: pic.by['default'] + pic.by.kind, tone: 'neutral' }], { max: pic.capacity, mark: pic.usual, title: meterTitle });
  var fig = pic.kg > 0 ? prodKgFig(pic.kg, estd, pic.unweighed > 0) : Math.round(pic.pieces).toLocaleString('en-IN') + ' pieces';
  var body = '<div class="inv-hero-sheet" data-prod-day-sheet>' + prodDayLinesHtml(pic, opts.compact) + prodDayWeighHtml(pic, opts.compact) + (opts.compact ? '' : prodDayMoreHtml(pic)) + '</div>';
  return uiHeroHtml({ tone: tone, eyebrow: eyebrow, title: escHtml(title), fig: escHtml(fig), sub: escHtml(sub), viz: viz, body: body,
    open: opts.open !== false, fold: opts.fold, attrs: attrs, foot: foot(pic.ran[0]) });
}
function prodLinesWord(list) { return list.map(prodLineName).join(list.length === 2 ? ' and ' : ', '); }
/* Each line that ran: its weight and pieces, its hours on the clock and its runs; a line with heads and no record says so. */
function prodDayLinesHtml(pic, compact) {
  var h = '<div class="inv-row-group"><span>Lines</span></div>';
  PROD_LINES.forEach(function(l) {
    var r = pic.lines[l], miss = pic.missing.indexOf(l) >= 0;
    if (!r.entries.length && !miss) return;
    if (!r.entries.length) {
      h += '<div class="inv-row inv-row-2" data-prod-day-line="' + l + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(prodLineName(l)) + '</span>' +
        '<span class="inv-row-meta">Heads on the general shift, no record of what it plated</span></span><span class="inv-row-end">' + uiDot('warning', 'No record') + '</span></div>';
      return;
    }
    var sp = pic.spans[l], a = null, b = null, rounds = r.rounds;
    sp.forEach(function(x) { if (a == null || x.from < a) a = x.from; if (b == null || x.to > b) b = x.to; });
    var clients = {};
    r.entries.forEach(function(e) { var n = e.clientId != null ? prodClientName(e.clientId) : e.client || ''; if (n) clients[n] = true; });
    var meta = [a != null ? relayClockLabel(a) + (b != null && b > a ? ' – ' + relayClockLabel(b) : '') : 'no times written', todoPlural(r.entries.length, 'run'),
      rounds ? todoPlural(rounds, 'round') : ''].filter(Boolean).join(' · ');
    // What the line had to plate with: its units on the day and its heads against the day's number; then whose work it was.
    var cap = pic.equip[l], cw = pic.crew[l];
    var meta2 = [cap ? cap.nAvail + ' of ' + cap.n + ' ' + (cap.units.every(function(u) { return u.kind === 'barrel'; }) ? 'barrels' : 'tanks') + ' working' : '',
      cw && cw.need != null ? cw.heads + ' of ' + cw.need + ' heads' : cw && cw.heads != null ? cw.heads + ' heads' : '',
      Object.keys(clients).slice(0, 2).join(', ') + (Object.keys(clients).length > 2 ? ' +' + (Object.keys(clients).length - 2) : '')].filter(Boolean).join(' · ');
    var pcs = [r.pieces ? Math.round(r.pieces).toLocaleString('en-IN') + ' pcs' : '', r.kgWritten ? formatNum(r.kgWritten, 0) + ' kg written' : ''].filter(Boolean).join(' + ');
    // Its efficiency (Floor's card has the parts): what it plated of what its working units could, in the time it ran.
    var ef = prodLineEfficiency(pic.date, l);
    h += '<div class="inv-row inv-row-2' + (compact ? '' : ' inv-row-flow') + '" data-prod-day-line="' + l + '"><button class="inv-row-main" data-action="invProdDayLines" data-day="' + escHtml(pic.date) + '" data-line="' + l + '">' +
      '<span class="inv-row-title">' + escHtml(prodLineName(l)) + '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(meta) + '</span>' +
      (meta2 && !compact ? '<span class="inv-row-meta inv-row-wrap" data-prod-day-with>' + escHtml(meta2) + '</span>' : '') +
      (compact || !sp.length ? '' : chartDayStrip(sp.map(function(x) { return { from: x.from, to: x.to, tone: 'ok' }; }).concat(pic.cuts.map(function(c) { return { from: c.from, to: c.to, tone: 'danger' }; })),
        { title: prodLineName(l) + ': ' + sp.map(function(x) { return relayClockLabel(x.from) + (x.to > x.from ? ' – ' + relayClockLabel(x.to) : ''); }).join(', ') + (pic.cuts.length ? '; power cut ' + pic.cuts.map(function(c) { return relayClockLabel(c.from) + (c.to != null ? ' – ' + relayClockLabel(c.to) : ''); }).join(', ') : '') })) +
      '</button><span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num" data-prod-day-kg>' + escHtml(r.kg > 0 ? prodKgFig(r.kg, r.est > 0.0005, r.unweighed > 0) : '—') + '</span>' +
      (pcs ? '<span class="inv-row-meta inv-num">' + escHtml(pcs) + '</span>' : '') +
      (ef.eff != null || ef.halfDown || ef.missing ? '<span data-prod-day-eff>' + uiDot(ef.tone, escHtml(ef.eff != null ? ef.word : ef.missing ? 'No record' : 'Half down')) + '</span>' : '') + '</span></span></div>';
  });
  return h;
}
/* Pieces nothing weighs, one row a floor name: its client and lines, the pieces, and the two moves that weigh it. The list's head
   says why they are listed (§6.27): a row does not say it again. */
function prodUnweighedRowsHtml(names) {
  var may = typeof grdOk !== 'function' || grdOk('floor');
  return names.map(function(n) {
    return '<div class="inv-row inv-row-2 inv-row-flow" data-prod-weigh="none"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(n.part || 'No part written') + '</span>' +
      '<span class="inv-row-meta">' + escHtml([n.client, n.lines && n.lines.length ? n.lines.map(prodLineName).join(', ') : ''].filter(Boolean).join(' · ')) + '</span></span>' +
      '<span class="inv-row-end inv-row-actions"><span class="inv-num">' + escHtml(Math.round(n.pieces).toLocaleString('en-IN') + ' pcs') + '</span>' +
      (may && n.clientId != null && n.id && n.part ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invProdAlias" data-id="' + escHtml(n.id) + '">Which part?</button>' +
        '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invProdWeighSet" data-id="' + escHtml(n.id) + '">Set its weight</button>' : '') + '</span></div>';
  }).join('');
}
/* Set its weight: a kg a piece on the client's card for the part the floor's name was learnt as, else the name itself, from
   the first day it was plated, so every run under it is weighed (a weight on record, prodKg). A rate-card change (P1). */
function prodWeighSetOpen(id) {
  var e = prodIndex().byId[id];
  if (!e || e.clientId == null) return;
  var pn = e.partNumber || prodWeighLearnt(e) || e.part || '';
  var h = '<div class="inv-dialog" role="dialog" aria-modal="true" aria-labelledby="prodWeighT" data-prod-weigh-dialog="' + escHtml(id) + '">' +
    dialogHeadHtml('<span id="prodWeighT">Weight of ' + escHtml(e.part || pn) + '</span>') +
    '<div class="inv-dialog-body"><div class="inv-note inv-mb-8">' + escHtml(prodClientName(e.clientId) + '. Kept on the client’s card (Clients → Edit → Piece weights); every run under this name is weighed by it, the days before included.') + '</div>' +
    '<div class="inv-fields"><label class="inv-field"><span class="inv-field-label">Part</span><input class="inv-input" id="prodWeighPart" value="' + escHtml(pn) + '"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Gauge</span><input class="inv-input" id="prodWeighGauge" value="' + escHtml(e.gauge || '') + '" placeholder="none"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Kg a piece</span><input class="inv-input" id="prodWeighKg" inputmode="decimal" placeholder="0.25"></label></div></div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invProdWeighSave" data-id="' + escHtml(id) + '">Save</button></div></div>';
  dialogOpen(h);
}
function prodWeighSetSave(id) {
  var e = prodIndex().byId[id], v = function(k) { return ((document.getElementById(k) || {}).value || '').trim(); };
  if (!e) return;
  var part = v('prodWeighPart'), gauge = v('prodWeighGauge').toUpperCase().replace(/[×✕*\s]/g, 'X').replace(/X+/g, 'X'), kg = parseFloat(v('prodWeighKg'));
  if (!part) { showToast('Enter the part', 'error'); return; }
  if (!(kg > 0) || kg > 100) { showToast('Enter the weight of one piece in kg', 'error'); return; }
  if (!grdGate('rates', 'add a piece weight', function() { prodWeighSetSave(id); })) return;   // P1 (guard.js), as the card's own Add
  var c = (S.clients || []).find(function(x) { return String(x.id) === String(e.clientId); });
  if (!c) return;
  // From the first day this name was plated for the client, so the runs already recorded are weighed too.
  var first = prodIndex().counted.filter(function(x) { return String(x.clientId) === String(e.clientId) && String(x.part || '').toUpperCase() === String(e.part || '').toUpperCase(); })
    .reduce(function(m, x) { return !m || x.date < m ? x.date : m; }, e.date);
  (c.pieceWeights || (c.pieceWeights = [])).push({ partNumber: part, gauge: lineGauge(gauge) || '', effectiveFrom: first, source: 'production', addedAt: Date.now(), kgPerPiece: Math.round(kg * 10000) / 10000 });
  saveState();
  closeOverlay();
  tabRedrawActive();
  showToast(part + ' weighed at ' + formatNum(kg, 3) + ' kg a piece from ' + formatDate(first));
}
/* How the day was weighed (§6.27): the kilograms by route, folded under one row that says how much is estimated, a route a row;
   then the names nothing weighs, which need the owner, open under their own head with the moves that weigh them. */
function prodDayWeighHtml(pic, compact) {
  var sure = pic.by.written + pic.by.record, estPct = pic.kg > 0 && pic.est > 0.0005 ? Math.round(pic.est / pic.kg * 100) : 0;
  var notW = pic.unweighed ? Math.round(pic.unweighed).toLocaleString('en-IN') + ' pcs not weighed' : '';
  if (compact) return uiFactRowHtml({ label: 'How it was weighed', sub: [estPct ? estPct + '% estimated' : 'every run weighed', notW].filter(Boolean).join(' · '),
    value: prodKgFig(pic.kg, pic.est > 0.0005, pic.unweighed > 0), attrs: ' data-prod-weigh="summary"' });
  // A client's default (owner, 9 Oct 2026: "Default Mehta to 0.560 kg per unit, adjustable"): its figure, and the door that changes it.
  var mayEdit = (typeof grdCan !== 'function' || grdCan('rates')) && (typeof grdSees !== 'function' || grdSees('pageClients'));
  var facts = [sure ? { label: 'Weighed', sub: 'its kilos, or a weight on record', value: prodKgFig(sure), attrs: ' data-prod-weigh="sure"' } : null,
    pic.by.challans ? { label: 'From the challans', sub: 'their kg a piece', value: prodKgFig(pic.by.challans, true), attrs: ' data-prod-weigh="challans"' } : null]
    .concat((pic.dflt || []).map(function(d) {
      return { label: 'At ' + d.client + '’s default', sub: formatNum(d.kgPc, 3) + ' kg a piece · ' + Math.round(d.pieces).toLocaleString('en-IN') + ' pcs', value: prodKgFig(d.kg, true), attrs: ' data-prod-weigh="default"',
        actions: mayEdit && d.clientId != null ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invEditClient" data-id="' + escHtml(String(d.clientId)) + '">Change</button>' : '' };
    }))
    .concat([pic.by.kind ? { label: 'By its kind', sub: 'the day ' + prodKgFig(pic.low) + ' – ' + prodKgFig(pic.high), value: prodKgFig(pic.by.kind, true), attrs: ' data-prod-weigh="kind"' } : null]);
  var h = uiFoldRowHtml('prod-day-weigh', { label: 'How it was weighed', sub: estPct ? estPct + '% estimated' : 'every run weighed', value: facts.filter(Boolean).length, count: true }, facts, ' data-prod-day-weighing');
  if (pic.names.length) h += '<div class="inv-row-group"><span>' + escHtml('Not weighed · ' + Math.round(pic.unweighed).toLocaleString('en-IN') + ' pcs') + '</span></div>' + prodUnweighedRowsHtml(pic.names) +
    '<div class="inv-row"><span class="inv-row-main"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invProdUnweighedAll">Every run not weighed</button></span></div>';
  return h;
}
/* The clients (folded), then the day as facts: what the work is worth, its labour, the cuts, the loads, the week. */
function prodDayMoreHtml(pic) {
  var cf = pic.clients.slice(0, 5).map(function(c) {
    return { label: c.name, sub: [c.pieces ? Math.round(c.pieces).toLocaleString('en-IN') + ' pcs' : '', c.kgWritten ? formatNum(c.kgWritten, 0) + ' kg written' : '', c.unweighed ? Math.round(c.unweighed).toLocaleString('en-IN') + ' not weighed' : ''].filter(Boolean).join(' · '),
      value: c.kg > 0 ? prodKgFig(c.kg, c.est > 0.0005, c.unweighed > 0) : '', attrs: ' data-prod-day-client="' + escHtml(c.clientId != null ? String(c.clientId) : '') + '"' };
  });
  if (pic.clients.length > 5) {
    var rest = pic.clients.slice(5), kg = rest.reduce(function(s, c) { return s + c.kg; }, 0), est = rest.some(function(c) { return c.est > 0.0005; });
    cf.push({ label: todoPlural(rest.length, 'more client'), value: kg > 0 ? prodKgFig(kg, est) : '' });
  }
  var h = uiFoldRowHtml('prod-day-clients', { label: 'Clients', value: pic.clients.length, count: true }, cf, ' data-prod-day-clients');
  var mins = pic.cuts.reduce(function(s, c) { return s + (c.min || 0); }, 0), open = pic.cuts.filter(function(c) { return c.open; }).length;
  // What the work is worth at the rates on record, and the labour the day's record holds: shown to a role that sees money
  // and wages (guard.js), never a figure a role's screens do not show.
  var money = typeof grdSeesMoney !== 'function' || grdSeesMoney(), wages = typeof grdSeesWages !== 'function' || grdSeesWages();
  var wk = prodPlatedSummary(attWeekStartOf(pic.date), pic.date);
  h += '<div class="inv-row-group"><span>The day</span></div>' + [
    money && pic.worth.runs ? { label: 'Work plated, worth', sub: 'clients’ rates, before GST' + (pic.worth.unpriced ? ' · ' + Math.round(pic.worth.unpriced).toLocaleString('en-IN') + ' pcs unpriced' : ''),
      value: (pic.worth.est ? '≈ ' : '') + formatCurrency(pic.worth.amount), attrs: ' data-prod-day-worth' } : null,
    wages && pic.labour > 0 ? { label: 'Labour on the record', sub: money && pic.worth.amount > 0 ? Math.round(pic.labour / pic.worth.amount * 100) + '% of the work’s worth' : '', value: formatCurrency(pic.labour), attrs: ' data-prod-day-labour' } : null,
    { label: 'Power cuts', sub: pic.cuts.length ? pic.cuts.map(function(c) { return relayClockLabel(c.from) + (c.to != null ? ' – ' + relayClockLabel(c.to) : ''); }).join(', ') + (open ? ' · ' + open + ' with no time back' : '') : '',
      value: pic.cuts.length ? powerDur(mins) + ' dark' : 'none', attrs: ' data-prod-day-cuts' },
    { label: 'Pickling loads', value: pic.loads || 'none', attrs: ' data-prod-day-loads' },
    wk ? { label: 'The week, against capacity', sub: prodKgFig(wk.kg, wk.est > 0.0005) + ' on ' + todoPlural(wk.days, 'complete day'), value: Math.round(wk.perDay / wk.capacity * 100) + '%', attrs: ' data-prod-day-week' } : null
  ].filter(Boolean).map(uiFactRowHtml).join('');
  return h;
}

/* ---------- Overview ---------- */
function prodOverviewHtml() {
  var today = localDateStr(), from = isoAddDays(today, -27), idx = prodIndex();
  var lastDay = idx.counted.filter(function(e) { return e.kind === 'plated'; }).map(function(e) { return e.date; }).sort().pop() || null;
  var wk = attWeekStartOf(today), wkSum = prodPlatedSummary(wk, today);   // the pay week, Sunday to Saturday
  var plant = prodInPlant({});
  var pni = plant.rows.reduce(function(s, x) { if (x.unit === 'NOS') s.nos += x.platedNotInvoiced; else s.kg += x.platedNotInvoiced; return s; }, { nos: 0, kg: 0 });
  var tile = function(label, value, sub, tone, key) {
    return '<div class="inv-tile' + (tone ? ' inv-tile-' + tone : '') + '" data-prod-tile="' + key + '"><div class="inv-tile-label">' + label + '</div><div class="inv-tile-value">' + figWrapHtml(value) + '</div><div class="inv-tile-sub">' + sub + '</div></div>';
  };
  // The plant at a glance leads: whether each line can run today, before what it plated (plant.js). Then the last day
  // plated as one card (owner, 9 Oct 2026: the tile's "7,630 NOS + 150 kg" was "not uniform enough").
  var h = pltGlanceHtml() + '<div class="inv-hero-stack">' + prodDayHeroHtml(lastDay, { fold: 'prod-day' }) + '</div><div class="inv-tiles">' +
    tile('This week against capacity', wkSum ? Math.round(wkSum.perDay / wkSum.capacity * 100) + '%' : '&mdash;', wkSum ? escHtml(prodKgFig(wkSum.kg, wkSum.est > 0.0005) + ' on ' + wkSum.days + ' complete day' + (wkSum.days === 1 ? '' : 's') + ' · of ~2 t a shift, two shifts') : 'no complete day this week', '', 'week') +
    tile('In plant (book)', escHtml(formatCurrency(plant.book)), 'open on challans, not invoiced', '', 'book') +
    tile('Plated, not invoiced', escHtml((pni.nos ? Math.round(pni.nos).toLocaleString('en-IN') + ' NOS' : '') + (pni.nos && pni.kg ? ' + ' : '') + (pni.kg ? formatNum(pni.kg, 1) + ' kg' : '') || '0'), 'recorded plated, still open on its challan', pni.nos || pni.kg ? 'warning' : '', 'pni') +
    '</div>';
  // Plated by line, four weeks, kg by day. A day not recorded, or under 90% weighed, is a gap — never a zero.
  var labels = [], series = PROD_LINES.map(function(l) { return { label: PROD_LINE_LABEL[l], values: [] }; });
  for (var d = from; d <= today; d = isoAddDays(d, 1)) {
    if (new Date(d + 'T00:00:00').getDay() === 0) continue;
    labels.push(stockShortDate(d));
    PROD_LINES.forEach(function(l, i) { var r = prodDayLine(d, l); series[i].values.push(r.entries.length && r.weighedShare >= 0.9 ? Math.round(r.kg) : null); });
  }
  h += '<div class="inv-panels"><div class="inv-panel" id="prodChart"><div class="inv-panel-head"><span class="inv-panel-title">Plated by line, 4 weeks</span></div>' +
    chartLines(labels, series, { unit: 'kg', ariaLabel: 'Plated by line', emptyText: 'No plated day in four weeks with nine tenths of its pieces weighed' }) +
    '<div class="inv-note">Kilograms a day. A gap is a day with no record, or a tenth of its pieces not weighed.</div></div>';
  var cov = prodCoverage(from, today);
  h += '<div class="inv-panel inv-panel-flush" id="prodCoverage"><div class="inv-panel-head"><span class="inv-panel-title">Record coverage, 4 weeks</span></div>';
  PROD_LINES.forEach(function(l) {
    var c = cov[l], ok = c.share >= PROD_COVER_OK;
    h += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + PROD_LINE_LABEL[l] + '</span><span class="inv-row-meta">' +
      (c.last ? 'last recorded ' + escHtml(stockShortDate(c.last)) : 'never recorded') + '</span></span><span class="inv-row-end"><span class="inv-num">' + c.days + ' of ' + c.of + '</span>' +
      '<span class="inv-dot inv-dot-' + (ok ? 'ok' : 'warning') + '">' + (ok ? 'Recorded' : 'Gaps') + '</span></span></div>';
  });
  h += '<div class="inv-panel-body inv-note">Working days with a plated record. Where it has gaps, what rests on it reads low.</div></div>';
  var unknown = idx.live.filter(function(e) { return e.kind === 'pickled' && !idx.replaced[e.id] && e.date >= from && prodLoadLine(e).how === 'unknown'; });
  h += '<div class="inv-panel inv-panel-flush" id="prodUnknown"><div class="inv-panel-head"><span class="inv-panel-title">Line unknown</span><span class="inv-panel-count">' + unknown.length + '</span></div>' +
    (unknown.length ? unknown.slice(-6).reverse().map(prodLoadRowHtml).join('') + (unknown.length > 6 ? '<div class="inv-panel-body"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invProdFilter" data-flag="unknown">All ' + unknown.length + '</button></div>' : '')
      : '<div class="inv-empty">Every pickled load in four weeks has its line, from its plating or set by you.</div>') +
    '<div class="inv-panel-body inv-note">The pickling message never names the line. It is read from the plating the load became, and where there is none a part’s usual line is offered, never applied by itself.</div></div>';
  var raised = todoApp(PROD_RULES.map(function(r) { return r[0]; }));
  h += '<div class="inv-panel inv-panel-flush" id="prodRaised"><div class="inv-panel-head"><span class="inv-panel-title">Raised</span><span class="inv-panel-count">' + raised.length + '</span></div>' +
    (raised.length ? raised.map(function(t) {
      return '<div class="inv-row inv-row-2"><button class="inv-row-main" data-action="invProdTask" data-key="' + escHtml(t.key) + '"><span class="inv-row-title"><span class="inv-dot inv-dot-' + uiTone(t.tone) + '">' + escHtml(t.title) + '</span></span><span class="inv-row-meta">' + escHtml(t.sub || '') + '</span></button></div>';
    }).join('') : '<div class="inv-empty">Nothing raised about production.</div>') + '</div>';
  return h + '</div>';
}

/* A pickled load: its line as written, from plating, set, or unknown with its usual-line chip. */
function prodLoadRowHtml(e) {
  var L = prodLoadLine(e), m = prodIndex().match[e.id];
  var lineTxt = L.line ? prodLineName(L.line) + (L.how === 'plating' ? ' · from plating' : L.how === 'set' ? ' · set by you' : '') : L.how === 'split' ? 'split: ' + L.lines.map(prodLineName).join(' + ') : 'Line unknown';
  var qty = e.qty != null ? prodQtyText(e.qty, e.unit) : (m && m.qty != null ? '~' + prodQtyText(m.qty, e.unit) + ' from plating' : 'no quantity');
  var h = '<div class="inv-row inv-row-2 inv-row-flow" data-prod-entry="' + escHtml(e.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(prodEntryTitle(e)) + '</span>' +
    '<span class="inv-row-meta">' + escHtml(stockShortDate(e.date) + (e.time ? ' ' + e.time : '') + ' · ' + qty + ' · ' + lineTxt) + '</span></span><span class="inv-row-end">';
  if (L.how === 'unknown' && L.hint) h += '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invProdUseLine" data-id="' + escHtml(e.id) + '" data-line="' + L.hint.line + '" title="' + escHtml('Usually ' + prodLineName(L.hint.line) + ' (' + L.hint.days + ' of ' + L.hint.total + ' days)') + '">Use ' + escHtml(prodLineName(L.hint.line)) + '</button>';
  return h + '</span></div>';
}

/* ---------- In plant ---------- */
function prodPlantHtml() {
  var plant = prodInPlant({ clientId: _prodPlantClient || null });
  var clients = {};
  (S.incomingMaterial || []).forEach(function(m) { clients[m.clientId] = true; });
  var h = '<div class="inv-toolbar"><select id="prodPlantClient" class="inv-select inv-select-sm" aria-label="Client"><option value="">All clients</option>' +
    Object.keys(clients).map(function(id) { return '<option value="' + escHtml(id) + '"' + (String(_prodPlantClient) === String(id) ? ' selected' : '') + '>' + escHtml(prodClientName(id) || 'Client ' + id) + '</option>'; }).join('') + '</select></div>';
  var sum = { pni: { NOS: 0, KG: 0 }, pnp: { NOS: 0, KG: 0 }, wait: { NOS: 0, KG: 0 } };
  plant.rows.forEach(function(x) { sum.pni[x.unit] += x.platedNotInvoiced; sum.pnp[x.unit] += x.pickledNotPlated; sum.wait[x.unit] += x.waiting; });
  var q = function(o) { var t = []; if (o.NOS) t.push(Math.round(o.NOS).toLocaleString('en-IN') + ' NOS'); if (o.KG) t.push(formatNum(o.KG, 1) + ' kg'); return t.join(' + ') || '0'; };
  var covTxt = PROD_LINES.map(function(l) { return PROD_LINE_LABEL[l] + ' ' + plant.coverage[l].days + '/' + plant.coverage[l].of; }).join(' · ');
  h += '<div class="inv-tiles">' +
    '<div class="inv-tile" data-prod-tile="plantBook"><div class="inv-tile-label">Book</div><div class="inv-tile-value">' + figWrapHtml(escHtml(formatCurrency(plant.book))) + '</div><div class="inv-tile-sub">open on challans, not invoiced</div></div>' +
    '<div class="inv-tile' + (sum.pni.NOS || sum.pni.KG ? ' inv-tile-warning' : '') + '" data-prod-tile="plantPni"><div class="inv-tile-label">Plated, not invoiced</div><div class="inv-tile-value">' + escHtml(q(sum.pni)) + '</div><div class="inv-tile-sub">at least: plating recorded</div></div>' +
    '<div class="inv-tile" data-prod-tile="plantPnp"><div class="inv-tile-label">Pickled, not plated</div><div class="inv-tile-value">' + escHtml(q(sum.pnp)) + '</div><div class="inv-tile-sub">loads with a quantity</div></div>' +
    '<div class="inv-tile" data-prod-tile="plantWait"><div class="inv-tile-label">Waiting to pickle</div><div class="inv-tile-value">' + (plant.floorOk ? escHtml(q(sum.wait)) : '&mdash;') + '</div><div class="inv-tile-sub">' +
      (plant.floorOk ? 'on open challans, not on the floor yet' : 'withheld: the floor record has gaps') + '</div></div></div>';
  if (!plant.floorOk) h += '<div class="inv-callout inv-callout-warning" data-prod-cover>The floor record covers ' + escHtml(covTxt) + ' working days in the last 30. Plating on the days not recorded would read as still waiting, so that figure is withheld until every line is recorded on 90% of days. Plated, not invoiced is shown: it rests on plating that was recorded, and reads low, never high.</div>';
  var noQty = prodIndex().live.filter(function(e) { return e.kind === 'pickled' && e.qty == null && e.date >= plant.since; }).length;
  if (noQty) h += '<div class="inv-callout inv-callout-info">' + todoPlural(noQty, 'pickled load') + ' in 30 days carry no quantity (usual since August); pickled counts only the loads that do.</div>';
  if (plant.famUsed) h += '<div class="inv-callout inv-callout-info">' + todoPlural(plant.famUsed, 'floor entry', 'floor entries') + ' named only the kind of part and its gauge, and were set against that client’s challans of the same kind and gauge.</div>';
  var byClient = {};
  plant.rows.forEach(function(x) { (byClient[x.r.m.clientId] = byClient[x.r.m.clientId] || []).push(x); });
  var ids = Object.keys(byClient).sort(function(a, b) { return prodClientName(a).localeCompare(prodClientName(b)); });
  h += '<div class="inv-panel inv-panel-flush" id="prodPlantList"><div class="inv-panel-head"><span class="inv-panel-title">Open challan lines</span><span class="inv-panel-count">' + plant.rows.length + '</span></div>';
  if (!ids.length) h += '<div class="inv-empty">Nothing open on the challans.</div>';
  ids.forEach(function(cid) {
    var list = byClient[cid], amt = list.reduce(function(s, x) { return s + x.amount; }, 0);
    var open = { NOS: 0, KG: 0 }, worked = 0;
    list.forEach(function(x) { open[x.unit] += x.open; if (x.derived) worked++; });
    h += '<div class="inv-row-group" data-prod-plant-client="' + escHtml(cid) + '"><span>' + escHtml(prodClientName(cid) || 'Client ' + cid) + '</span><span class="inv-num">' +
      escHtml(q(open) + (worked ? ' (' + worked + ' worked out from kg)' : '') + ' · ' + formatCurrency(amt)) + '</span></div>';
    list.forEach(function(x) {
      var st = x.platedNotInvoiced > 0 ? ['warning', 'Plated, not invoiced'] : x.pickledNotPlated > 0 ? ['info', 'Pickled'] : x.floorRecorded ? ['neutral', 'Waiting'] : ['neutral', 'No floor record'];
      var u = x.unit;
      h += '<div class="inv-row inv-row-2" data-prod-plant="' + escHtml(x.r.it.id || '') + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(lineLabel(x.r.it)) + '</span>' +
        '<span class="inv-row-meta inv-row-wrap">' + escHtml('Challan ' + (x.r.m.challanNo || '?') + ' · ' + stockShortDate(x.r.date) + ' · received ' +
          (x.derived ? prodQtyText(x.r.R.KG, 'KG') + ' ≈ ' + prodQtyText(x.R, u) + ' at ' + String(parseFloat(x.kpp.kg.toFixed(4))) + ' kg/pc (' + x.kpp.src + ')' : prodQtyText(x.R, u)) + ' · invoiced ' + prodQtyText(x.I, u) +
          ' · plated ' + prodQtyText(Math.min(x.R, x.L), u) + (x.P ? ' · pickled ' + prodQtyText(Math.min(x.R, x.P), u) : '')) + '</span></span>' +
        '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + escHtml(prodQtyText(x.open, u)) + '</span><span class="inv-dot inv-dot-' + st[0] + '">' + st[1] + '</span></span></span></div>';
    });
  });
  h += (plant.unweighed ? '<div class="inv-panel-body inv-note" data-prod-unweighed>' + escHtml(todoPlural(plant.unweighed, 'open line') + ' (' + formatNum(plant.unweighedKg, 1) + ' kg) came by the kilo with no kg per piece known, so the floor’s piece counts cannot be set against ' + (plant.unweighed === 1 ? 'it' : 'them') + '. Put the weight on the client’s card (Clients → Edit → Piece weights).') + '</div>' : '') +
    '<div class="inv-panel-body inv-note">A line received by the kilo is counted in pieces where the part’s kg per piece is known: the client’s card, then part weights, then the Items Master. Each open line’s share is split by what the floor recorded: plating and pickling of a part are set against its challans oldest first. Rework is left out: it is work done, not billing.</div></div>';
  if (plant.noChallan.length) {
    h += '<div class="inv-panel inv-panel-flush" id="prodNoChallan"><div class="inv-panel-head"><span class="inv-panel-title">On the floor, no challan open</span><span class="inv-panel-count">' + plant.noChallan.length + '</span></div>';
    plant.noChallan.forEach(function(x) {
      h += '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml((x.clientId != null ? prodClientName(x.clientId) : x.client || 'No client') + (x.part ? ' · ' + x.part : '')) + '</span>' +
        '<span class="inv-row-meta">' + escHtml((x.L && x.P ? 'pickled ' + prodQtyText(x.P, x.unit) + ', plated ' + prodQtyText(x.L, x.unit) : x.field === 'L' ? 'plated' : 'pickled') + ' from ' + stockShortDate(x.oldest)) + '</span></span><span class="inv-row-end inv-num">' + escHtml(prodQtyText(x.qty, x.unit)) + '</span></div>';
    });
    h += '<div class="inv-panel-body inv-note">More was recorded on the floor than any open challan of the part holds: a challan not entered, a part named differently, or plating of material billed already.</div></div>';
  }
  var ar = Object.keys(plant.arrived);
  if (ar.length) h += '<div class="inv-callout inv-callout-info">' + todoPlural(ar.length, 'part') + ' carry arrivals from the pickling hand’s incoming messages in 30 days: a floor count of receipts, shown in Entries beside the challans, never added to them.</div>';
  return h;
}

/* ---------- Lines ---------- */
/* The day Lines shows: the one stepped to, else the line's last recorded day, else today. */
function prodLinesDay() {
  var line = _prodLine;
  var days = prodIndex().live.filter(function(e) { return line === 'pickling' ? e.kind === 'pickled' : e.kind === 'plated' && e.line === line; }).map(function(e) { return e.date; }).sort();
  return _prodDay || days[days.length - 1] || localDateStr();
}
function prodLinesHtml() {
  var idx = prodIndex(), line = _prodLine, day = prodLinesDay();
  var h = '<div class="inv-seg inv-mb-8" role="group" aria-label="Line">' + PROD_LINES.concat(['pickling']).map(function(l) {
    return '<button type="button" class="inv-seg-btn" data-action="invProdLine" data-line="' + l + '" aria-pressed="' + (line === l) + '">' + (l === 'pickling' ? 'Pickling' : PROD_LINE_LABEL[l]) + '</button>';
  }).join('') + '</div>';
  h += '<div class="inv-toolbar inv-stepper"><button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invProdDay" data-step="-1" aria-label="Day before">' + STAFF_BACK_ICON + '</button>' +
    '<div class="inv-stepper-label"><span class="inv-stepper-title">' + escHtml(formatDate(day)) + '</span><span class="inv-stepper-sub">' + escHtml(new Date(day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })) + '</span></div>' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invProdDay" data-step="1" aria-label="Day after">' + STAFF_NEXT_ICON + '</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invProdDayLast">Last recorded</button></div>';
  if (line === 'pickling') {
    var loads = prodDayLoads(day);
    h += '<div class="inv-panel inv-panel-flush" id="prodLoads"><div class="inv-panel-head"><span class="inv-panel-title">Pickled</span><span class="inv-panel-count">' + loads.length + '</span></div>' +
      (loads.length ? loads.map(prodLoadRowHtml).join('') : '<div class="inv-empty">No pickling recorded this day.</div>') + '</div>';
    return h;
  }
  var r = prodDayLine(day, line), downtime = prodDowntimeDay(day);
  var mins = downtime.reduce(function(s, x) { return s + x.min; }, 0);
  // One unit (owner, 9 Oct 2026): the weight leads, every run weighed by the surest route the book holds; the pieces under it.
  h += '<div class="inv-tiles">' +
    '<div class="inv-tile" data-prod-line-tile="kg"><div class="inv-tile-label">Plated</div><div class="inv-tile-value">' + (r.kg > 0 ? figWrapHtml(escHtml(prodKgFig(r.kg, r.est > 0.0005, r.unweighed > 0))) : '&mdash;') + '</div><div class="inv-tile-sub">' +
      escHtml(!r.entries.length ? 'nothing recorded' : r.kg > 0 ? (r.est > 0.0005 ? Math.round(r.est / r.kg * 100) + '% estimated' : 'every run weighed') + (r.unweighed ? ' · ' + Math.round(r.unweighed).toLocaleString('en-IN') + ' pcs not weighed' : '') : 'no run weighed') + '</div></div>' +
    '<div class="inv-tile" data-prod-line-tile="pieces"><div class="inv-tile-label">Pieces</div><div class="inv-tile-value">' + escHtml(Math.round(r.nos).toLocaleString('en-IN')) + ' <span class="inv-tile-of">NOS</span></div><div class="inv-tile-sub">' + escHtml(todoPlural(r.entries.length, 'run') + (r.kgWritten ? ' · ' + formatNum(r.kgWritten, 0) + ' kg written' : '')) + '</div></div>' +
    '<div class="inv-tile"><div class="inv-tile-label">Rounds</div><div class="inv-tile-value">' + Math.round(r.rounds) + '</div><div class="inv-tile-sub">racks or rounds counted</div></div>' +
    '<div class="inv-tile"><div class="inv-tile-label">Power cuts</div><div class="inv-tile-value">' + (downtime.length ? mins + ' min' : '&mdash;') + '</div><div class="inv-tile-sub">' + todoPlural(downtime.length, 'cut') + ' this day</div></div></div>';
  var groups = { general: [], ot: [] };
  r.entries.forEach(function(e) { groups[e.slot === 'ot' ? 'ot' : 'general'].push(e); });
  var also = idx.also.filter(function(e) { return e.date === day && e.line === line; });
  h += '<div class="inv-panel inv-panel-flush" id="prodRuns"><div class="inv-panel-head"><span class="inv-panel-title">Runs</span></div>';
  if (!r.entries.length && !also.length) h += '<div class="inv-empty">No plating recorded on ' + escHtml(PROD_LINE_LABEL[line]) + ' this day. A day nobody recorded is a gap, not a zero.</div>';
  ['general', 'ot'].forEach(function(g) {
    if (!groups[g].length) return;
    h += '<div class="inv-row-group"><span>' + (g === 'ot' ? 'Overtime' : 'General shift') + '</span></div>';
    groups[g].forEach(function(e) { h += prodRunRowHtml(e, false); });
  });
  if (also.length) { h += '<div class="inv-row-group"><span>Also reported</span></div>'; also.forEach(function(e) { h += prodRunRowHtml(e, true); }); }
  h += '<div class="inv-panel-body inv-note">One record counts per shift: the register, else the supervisor’s relay, else an entry by hand. The others are shown as also reported and never added: they count the same work a different way.</div></div>';
  // The pay week around the day: what each line plated, a gap where nothing was recorded.
  var ws = attWeekStartOf(day), wd = [];
  for (var k = 0; k < 7; k++) wd.push(isoAddDays(ws, k));
  h += '<div class="inv-panel inv-panel-flush" id="prodWeek"><div class="inv-panel-head"><span class="inv-panel-title">The week, plated</span></div><div class="inv-scroll-x"><table class="inv-table"><thead><tr><th class="inv-col-grow">Line</th>' +
    wd.map(function(d) { return '<th class="inv-num">' + escHtml(new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    PROD_LINES.map(function(l) {
      return '<tr><td>' + escHtml(PROD_LINE_LABEL[l]) + '</td>' + wd.map(function(d) {
        var x = prodDayLine(d, l);
        return '<td class="inv-num">' + (x.entries.length ? escHtml((x.kg > 0 ? (x.est > 0.0005 ? '≈ ' : '') + formatNum(x.kg, 0) : '') + (x.unweighed ? (x.kg > 0 ? ' + ' : '') + Math.round(x.unweighed).toLocaleString('en-IN') + ' pcs' : '')) : '&mdash;') + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table></div><div class="inv-panel-body inv-note">Kilograms plated, ≈ where any run is estimated; pieces nothing weighs are added as pieces. A dash is a day with no record for the line.</div></div>';
  h += prodLineStockHtml(line);
  // Labour per kg is the wage bill per kilo: a role without the wages sees no line's (guard.js; the QA audit, QA4-3).
  if (typeof grdSeesWages === 'function' && !grdSeesWages()) return h;
  var lab = prodLabourByLine(isoAddDays(localDateStr(), -29), localDateStr()), L = lab.lines[line];
  h += '<div class="inv-panel inv-panel-flush" id="prodLabour"><div class="inv-panel-head"><span class="inv-panel-title">Labour per kg, 30 days</span></div>' +
    '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(PROD_LINE_LABEL[line]) + '</span><span class="inv-row-meta">' +
    escHtml(L.days + ' day' + (L.days === 1 ? '' : 's') + ' with attendance and a weighed record · ' + formatCurrency(L.cost) + ' on ' + formatNum(L.kg, 0) + ' kg') + '</span></span>' +
    '<span class="inv-row-end inv-num">' + (L.perKg != null ? escHtml('₹' + formatNum(L.perKg, 2) + '/kg') : '&mdash;') + '</span></div>' +
    '<div class="inv-panel-body inv-note">Variable labour of the line’s areas (the pool, the daily tier, overtime and the EXTRA), with the VAT side’s pickling hands shared by each day’s kg, over the same days as the kg (days with nine tenths of the pieces weighed, estimates by the challans or by kind included). The monthly crew is the standing crew and is not by line. Withheld under five days. ' +
    escHtml(lab.skipped ? lab.skipped + ' day' + (lab.skipped === 1 ? '' : 's') + ' with attendance and no usable production record are left out.' : '') + '</div></div>';
  return h;
}
/* What went into the line's bath over 60 days (PP3; cost.js stockByLine), drawn as an analysis (§6.27): a row a stock line with its
   figure a tonne plated and, for a role that sees money, its rupees a kilogram; the line's rupees a kilogram; what named no bath. */
function prodLineStockHtml(line) {
  var to = localDateStr(), res = stockByLine(isoAddDays(to, -(STOCK_LINE_DAYS - 1)), to), L = res.lines[line];
  if (!res.recorded || !L) return '';
  var money = typeof grdSeesMoney !== 'function' || grdSeesMoney(), name = PROD_LINE_LABEL[line], stockDoor = typeof grdSees !== 'function' || grdSees('pageStock');
  var ids = Object.keys(L.items).sort(function(a, b) { return (L.items[b].rs - L.items[a].rs) || (L.items[b].qty - L.items[a].qty); });
  var h = '<div class="inv-panel inv-panel-flush" id="prodLineStock"><div class="inv-panel-head"><span class="inv-panel-title">Into the bath, ' + STOCK_LINE_DAYS + ' days</span>' +
    (ids.length ? '<span class="inv-panel-count">' + ids.length + '</span>' : '') + '</div>';
  if (!ids.length) h += '<div class="inv-empty">No use names ' + escHtml(name) + ' yet. Write the bath in the stock message (“use VAT A 2 / 150 kg”), or pick it under Into by hand.</div>';
  ids.forEach(function(id) {
    var r = L.items[id], unit = r.item.unit || '', pt = stockPerTonneText(r.perT, r.est || r.soFar, r.atMost), sign = r.atMost ? '≤ ' : r.est || r.soFar ? '≈ ' : '';
    var f = { label: r.item.name, src: r.soFar ? ['neutral', 'so far'] : null, value: pt ? pt + ' ' + (unit || 'unit') + '/t' : '',
      sub: r.perT == null ? r.why : [money ? (r.rsKg != null ? sign + '₹' + formatNum(r.rsKg, 2) + '/kg' : r.priced ? '' : 'no price') : '', todoPlural(r.n, 'addition')].filter(Boolean).join(' · ') };
    // The stock line's page, for a role that opens Stock.
    h += stockDoor ? '<button type="button" class="inv-row inv-row-2" data-action="invProdStockLine" data-id="' + escHtml(id) + '" data-prod-line-stock="' + escHtml(id) + '">' + _uiFactInner(f) + '</button>'
      : uiFactRowHtml(Object.assign(f, { attrs: ' data-prod-line-stock="' + escHtml(id) + '"' }));
  });
  if (ids.length && money) {
    // What the line's figure leaves out is said beside it: a stock line on its first addition, one with no price (reads low).
    h += uiFactRowHtml(L.rsKg != null ? { label: 'All of it', value: (L.rsKgEst ? '≈ ' : '') + '₹' + formatNum(L.rsKg, 2) + '/kg', attrs: ' data-prod-line-stock-total',
        sub: [L.soFar ? L.soFar + ' still on a first addition' : '', L.unpriced ? L.unpriced + ' with no price: reads low' : ''].filter(Boolean).join(' · ') }
      : { label: 'All of it', value: '', sub: L.soFar ? 'each still on a first addition' : 'no price', attrs: ' data-prod-line-stock-total' });
  }
  if (res.unnamed.n) h += uiFactRowHtml({ label: 'No bath named', value: todoPlural(res.unnamed.n, 'use'), sub: 'the plant’s, not in these', attrs: ' data-prod-line-stock-unnamed' });
  return h + '<div class="inv-panel-body inv-note">Each addition against what the line plated until the next. ≈ an estimate, ≤ the most it can be.</div></div>';
}
function prodRunRowHtml(e, muted) {
  var rounds = (e.rounds || []).filter(function(x) { return !x.struck; });
  var meta = (e.time ? e.time + (e.to && e.to !== e.time ? '–' + e.to : '') + ' · ' : '') + (rounds.length ? rounds.length + ' round' + (rounds.length === 1 ? '' : 's') + ' · ' : e.racks ? e.rackSize + ' × ' + e.racks + ' · ' : '') + prodSrcWord(e) + (e.rework ? ' · rework' : '');
  // A run in pieces says what it weighs and how that was found (prodWeigh); one nothing weighs says so.
  var w = e.unit === 'NOS' ? prodWeigh(e) : null;
  var kg = !w ? '' : w.kg == null ? 'not weighed' : prodKgFig(w.kg, prodWeighEst(w)) + (w.how === 'kind' ? ' by kind' : w.how === 'challans' ? ' from challans' : w.how === 'default' ? ' at the client’s default' : '');
  return '<div class="inv-row inv-row-2' + (muted ? ' inv-row-muted' : '') + '" data-prod-entry="' + escHtml(e.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(prodEntryTitle(e)) + '</span>' +
    '<span class="inv-row-meta">' + escHtml(meta) + '</span></span><span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + escHtml(prodQtyText(e.qty, e.unit)) + '</span>' +
    (kg ? '<span class="inv-row-meta inv-num" data-prod-run-kg>' + escHtml(kg) + '</span>' : '') + '</span></span></div>';
}

/* ---------- Entries ---------- */
function prodEntriesHtml() {
  var idx = prodIndex(), f = _prodFilter, from = isoAddDays(localDateStr(), -60);
  var chips = [['', 'All'], ['pickled', 'Pickled'], ['plated', 'Plated'], ['arrived', 'Arrived'], ['downtime', 'Power cuts']];
  var flags = [['unknown', 'Line unknown'], ['noclient', 'No client'], ['nochallan', 'No challan'], ['gauge', 'Gauge unknown'], ['unweighed', 'Not weighed']];
  var h = '<div class="inv-toolbar" role="group" aria-label="Show">' + chips.map(function(c) {
    return '<button class="inv-chip" data-action="invProdFilter" data-kind="' + c[0] + '" aria-pressed="' + (f.kind === c[0] && !f.flag) + '">' + c[1] + '</button>';
  }).join('') + flags.map(function(c) {
    return '<button class="inv-chip" data-action="invProdFilter" data-flag="' + c[0] + '" aria-pressed="' + (f.flag === c[0]) + '">' + c[1] + '</button>';
  }).join('') + '</div>';
  var list = prodData().entries.filter(function(e) {
    // A flag lists every entry it names, whatever its date: the To-do counts them all (P127: an older one was unreachable).
    if (!f.flag && e.date < from) return false;
    if (f.client && String(e.clientId) !== String(f.client)) return false;
    if (f.flag === 'unknown') return e.kind === 'pickled' && !e.voidedAt && prodLoadLine(e).how === 'unknown';
    if (f.flag === 'noclient') return e.clientId == null && e.kind !== 'downtime';
    if (f.flag === 'nochallan') return e.clientId != null && prodLoadNoChallan(e, idx);
    if (f.flag === 'gauge') return prodGaugeFlagged(e);
    if (f.flag === 'unweighed') return prodIsUnweighed(e, idx);
    return !f.kind || e.kind === f.kind;
  }).sort(function(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : String(b.time || '').localeCompare(String(a.time || '')); });
  h += '<div class="inv-panel inv-panel-flush" id="prodEntries"><div class="inv-panel-head"><span class="inv-panel-title">' + (f.flag ? 'Entries, every date' : 'Entries, 60 days') + '</span><span class="inv-panel-count">' + list.length + '</span></div>';
  if (!list.length) h += '<div class="inv-empty">Nothing here.</div>';
  var last = '';
  list.slice(0, 300).forEach(function(e) {
    if (e.date !== last) { last = e.date; h += '<div class="inv-row-group"><span>' + escHtml(formatDate(e.date)) + '</span></div>'; }
    h += prodEntryRowHtml(e, idx);
  });
  if (list.length > 300) h += '<div class="inv-panel-body inv-note">The latest 300 of ' + list.length + ' are shown.</div>';
  h += '</div>';
  if (!_isDesktop) return h;
  // The desktop: the list beside the open entry (UX overhaul 2, step 7). The chips stay above both; an entry the
  // filter no longer lists stays open, since it is still a record somebody chose to read.
  var open = _prodEntryOpen && prodData().entries.find(function(e) { return e.id === _prodEntryOpen; });
  if (!open) _prodEntryOpen = null;
  var cut = h.indexOf('<div class="inv-panel inv-panel-flush" id="prodEntries">');
  return h.slice(0, cut) + '<div class="inv-pane-host' + (open ? ' inv-pane-open' : '') + '" id="prodEntriesHost" data-open="' + (open ? escHtml(open.id) : '') + '"><div class="inv-pane-list">' + h.slice(cut) + '</div>' +
    '<div class="inv-pane" id="prodEntryPane">' + (open ? prodEntryDetailHtml(open, idx) : '') + '</div></div>';
}

/* One entry in the pane: everything it holds, the text it was read from, and what can be done to it. */
function prodEntryDetailHtml(e, idx) {
  var kindWord = { pickled: 'Pickled', plated: 'Plated', arrived: 'Arrived', downtime: 'Power cut' }[e.kind] || e.kind;
  // A cut with no time back says so, as its row does; the supervisor's whole-day barrel list is named as the hand form names
  // it, not as the general shift (which shift it covers is recorded as unknown). The QA chain, 2 Oct 2026.
  var open = e.kind === 'downtime' && e.downtime && e.downtime.open;
  var title = e.kind === 'downtime' ? (open ? 'Power cut, no time back' : 'Power cut') : prodEntryTitle(e);
  var line = e.kind === 'pickled' ? prodLoadLine(e) : null;
  var kv = [['Kind', kindWord + (e.rework ? ', rework' : '')], ['Day', formatDate(e.date)]];
  if (e.time) kv.push(['Time', e.time + (e.to && e.to !== e.time ? ' – ' + e.to : open ? ' – no time back' : '')]);
  if (e.slot) kv.push(['Shift', e.slot === 'ot' ? 'Overtime' : e.slot === 'day' ? 'Whole day (barrel list)' : 'General']);
  if (e.kind === 'plated' || e.line) kv.push(['Line', e.line ? prodLineName(e.line) : 'Not written']);
  else if (line) kv.push(['Line', line.line ? prodLineName(line.line) + (line.how === 'plating' ? ', from the plating' : '') : line.how === 'split' ? 'Split' : 'Unknown']);
  if (e.kind !== 'downtime') {
    kv.push(['Client', e.clientId != null ? prodClientName(e.clientId) || e.client || '' : (e.client ? e.client + ', not in the book' : 'Not written')]);
    if (e.part || e.partNumber) kv.push(['Part', [e.part, e.partNumber && e.partNumber !== e.part ? e.partNumber : '', e.gauge].filter(Boolean).join(' · ')]);
    kv.push(['Quantity', prodQtyText(e.qty, e.unit) + (e.qty2 != null ? ' · ' + prodQtyText(e.qty2, e.unit2) : '')]);
    if (e.rackSize) kv.push(['Rack', e.rackSize + (e.racks ? ' × ' + e.racks : '')]);
  }
  if (e.kind === 'downtime' && e.downtime && typeof pcsName === 'function') {
    var dtr = e.downtime;
    if (dtr.reason) kv.push(['Why it went', pcsName(dtr.reason)]);
    if (dtr.where || dtr.unitId) kv.push(['Where it hit', pcsWhereWord(dtr.where, dtr.unitId)]);
    if (dtr.fix) kv.push(['What brought it back', pcsName(dtr.fix)]);
    if (dtr.closedHow === 'hand') kv.push(['Power in', 'typed' + (dtr.closedBy ? ' by ' + dtr.closedBy : '') + (dtr.closedAt ? ', ' + formatTimestamp(dtr.closedAt) : '')]);
  }
  kv.push(['Source', prodSrcWord(e) + (e.basis && e.basis !== e.src ? ' · ' + e.basis : '')]);
  if (e.sentBy) kv.push(['Sent by', e.sentBy]);
  if (e.at > 946684800000) kv.push(['Entered', formatTimestamp(e.at) + (e.by ? ' · ' + e.by : '')]);   // a stamp, not a placeholder
  var h = paneHeadHtml('<span class="inv-panel-title">' + escHtml(title) + '</span>', 'invProdEntryClose') +
    '<div class="inv-panel" data-prod-pane="' + escHtml(e.id) + '"><div class="inv-kv">' + kv.map(function(x) {
      return '<div><div class="inv-kv-k">' + escHtml(x[0]) + '</div><div>' + escHtml(String(x[1])) + '</div></div>';
    }).join('') + '</div></div>';
  if (e.voidedAt) h += '<div class="inv-callout inv-callout-warning">Void' + (e.voidReason ? ': ' + escHtml(e.voidReason) : '') + '</div>';
  var by = idx.replaced[e.id] && prodData().entries.find(function(x) { return x.replaces === e.id && !x.voidedAt; });
  if (by) h += '<div class="inv-callout inv-callout-info">Corrected by the entry of ' + escHtml(formatDate(by.date)) + ': ' + escHtml(prodQtyText(by.qty, by.unit)) + '.</div>';
  if (e.replaces) h += '<div class="inv-note">This entry corrects an earlier one.</div>';
  var rounds = e.rounds || [];
  if (rounds.length) {
    h += '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">Rounds <span class="inv-panel-count">' + rounds.length + '</span></span></div>' +
      rounds.map(function(r) {
        return '<div class="inv-row' + (r.struck ? ' inv-row-muted' : '') + '"><span class="inv-row-main inv-id">' + escHtml(r.time || '') + (r.start ? ' · start' : '') + (r.struck ? ' · struck' : '') + '</span>' +
          '<span class="inv-row-end"><span class="inv-num">' + escHtml(r.qty != null ? String(r.qty) : '') + '</span></span></div>';
      }).join('') + '</div>';
  }
  var crew = (e.kind === 'plated' || e.kind === 'pickled') && !e.voidedAt ? prodCrew(e) : null;
  if (crew) h += '<div class="inv-note" data-prod-crew>' + escHtml(crew.known ? (crew.src === 'block' ? 'OT crew: ' : 'Crew: ') + crew.names.join(', ') : 'Crew not known: ' + crew.why) + '</div>';
  if (e.raw) h += '<div class="inv-field"><span class="inv-field-label">As written</span><div class="inv-quote">' + escHtml(e.raw) + '</div></div>';
  var acts = prodEntryActionsHtml(e, idx);
  if (acts) h += '<div class="inv-toolbar">' + acts + '</div>';
  return h;
}
function prodEntryRowHtml(e, idx) {
  var kindWord = { pickled: 'Pickled', plated: 'Plated', arrived: 'Arrived', downtime: 'Power cut' }[e.kind];
  var line = e.kind === 'pickled' ? prodLoadLine(e) : null;
  var meta = [kindWord, e.time ? e.time + (e.to ? '–' + e.to : '') : '', e.kind === 'plated' ? prodLineName(e.line) : line ? (line.line ? prodLineName(line.line) + (line.how === 'plating' ? ' (from plating)' : '') : line.how === 'split' ? 'split' : 'line unknown') : '',
    prodSrcWord(e), e.rework ? 'rework' : '', idx.replaced[e.id] ? 'corrected' : '', e.kind === 'plated' && !idx.countedSet[e.id] && !e.voidedAt && !idx.replaced[e.id] ? 'also reported' : ''].filter(Boolean).join(' · ');
  var title = e.kind === 'downtime' ? (e.downtime && e.downtime.open ? 'Power cut, no time back' : 'Power cut') : prodEntryTitle(e);
  var why = e.kind === 'downtime' && e.downtime && e.downtime.reason && typeof pcsName === 'function' ? pcsName(e.downtime.reason) : '';
  // What the floor name was matched to, the gauges a round's size allows, and a name no challan part answers to.
  var alias = e.kind !== 'downtime' && e.clientId != null ? prodAliasShown(e) : null;
  if (alias && alias.pn) meta += ' · = ' + alias.pn + (alias.how === 'rack' && e.partRack ? ' by the round of ' + e.partRack : '');
  if (e.gaugeOptions && !e.gauge) meta += ' · ' + e.gaugeOptions.join(' or ') + ' by the round';
  if (prodGaugeFlagged(e)) meta += ' · gauge unknown: a round of ' + e.gaugeUnknown;
  else if (e.gaugeUnknown && e.gaugeSrc === 'set') meta += ' · gauge set (a round of ' + e.gaugeUnknown + ')';
  if (e.qtySrc === 'split') meta += ' · shared by the challans (estimate)';
  var crew = (e.kind === 'plated' || e.kind === 'pickled') && !e.voidedAt ? prodCrew(e) : null;
  // On the desktop the entry opens in the pane beside the list, so its main is a button.
  var cur = _isDesktop && _prodEntryOpen === e.id;
  var h = '<div class="inv-row inv-row-2 inv-row-flow' + (e.voidedAt ? ' inv-row-muted' : '') + '" data-prod-entry="' + escHtml(e.id) + '"' + (cur ? ' aria-current="true"' : '') + '>' +
    (_isDesktop ? '<button class="inv-row-main" data-action="invProdEntryOpen" data-id="' + escHtml(e.id) + '">' : '<span class="inv-row-main">') + '<span class="inv-row-title">' + escHtml(title) + '</span>' +
    '<span class="inv-row-meta">' + escHtml(meta + (e.voidedAt ? ' · void: ' + (e.voidReason || '') : '')) + '</span>' +
    (crew ? '<span class="inv-row-meta inv-row-wrap" data-prod-crew>' + escHtml(crew.known ? (crew.src === 'block' ? 'OT crew: ' : 'Crew: ') + crew.names.join(', ') : 'Crew not known: ' + crew.why) + '</span>' : '') +
    // A power cut's reason, on a line of its own (powercause.js).
    (why ? '<span class="inv-row-meta inv-row-wrap" data-prod-why>' + escHtml('Why: ' + why) + '</span>' : '') +
    (_isDesktop ? '</button>' : '</span>') + '<span class="inv-row-end">' +
    (e.kind !== 'downtime' ? '<span class="inv-num">' + escHtml(prodQtyText(e.qty, e.unit)) + '</span>' : '') + prodEntryActionsHtml(e, idx);
  return h + '</span></div>';
}
/* What can be done to an entry: on its row, and on the desktop in its pane too. A void entry takes nothing. */
function prodEntryActionsHtml(e, idx) {
  if (e.voidedAt) return '';
  var line = e.kind === 'pickled' ? prodLoadLine(e) : null;
  var alias = e.kind !== 'downtime' && e.clientId != null ? prodAliasShown(e) : null;
  var h = '';
  if (line && line.how === 'unknown' && line.hint) h += '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invProdUseLine" data-id="' + escHtml(e.id) + '" data-line="' + line.hint.line + '">Use ' + escHtml(prodLineName(line.hint.line)) + '</button>';
  if (alias && !alias.pn && !alias.generic) h += '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invProdAlias" data-id="' + escHtml(e.id) + '">Which part?</button>';
  if (prodGaugeFlagged(e)) h += '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invProdGauge" data-id="' + escHtml(e.id) + '">Pick gauge</button>';
  // A run in pieces nothing weighs: its weight set on the client's card (Which part? is offered above where the name is a code).
  if (prodIsUnweighed(e, idx) && e.clientId != null) {
    if (!(alias && !alias.pn && !alias.generic)) h += '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invProdAlias" data-id="' + escHtml(e.id) + '">Which part?</button>';
    h += '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invProdWeighSet" data-id="' + escHtml(e.id) + '">Set its weight</button>';
  }
  if (e.kind !== 'downtime' && !idx.replaced[e.id]) h += '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invProdCorrect" data-id="' + escHtml(e.id) + '">Correct</button>';
  // A power cut is completed in place: its power-in time, why it went and what brought it back (powercause.js).
  if (e.kind === 'downtime') {
    var dt = e.downtime || {};
    h += '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPcsOpen" data-id="' + escHtml(e.id) + '">' + (dt.open ? 'Complete' : dt.reason ? 'Edit reason' : 'Add reason') + '</button>';
  }
  return h + '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invProdVoid" data-id="' + escHtml(e.id) + '">Void</button>';
}

/* The part a floor entry is, as matched: learnt from its name, its own part number, or a challan part of the same key.
   `generic` is a name of a kind only ("CLAMP"): matched at the family level, never asked about. */
var _prodKeysMemo = null;
function prodChallanKeySet() {
  var sig = _prodVer + '|' + (S.incomingMaterial || []).length + '|' + (S.invoices || []).length;
  if (_prodKeysMemo && _prodKeysMemo.sig === sig) return _prodKeysMemo.set;
  var set = {};
  (S.incomingMaterial || []).forEach(function(m) { (m.items || []).forEach(function(it) { set[prodChallanKey(m, it)] = it.partNumber || it.desc; }); });
  _prodKeysMemo = { sig: sig, set: set };
  return set;
}
function prodAliasShown(e) {
  if (e.partNumber) return { pn: e.partNumber, how: e.partSrc };
  var learnt = prodData().learn.parts[prodKey(e.clientId, e.part, e.gauge)];
  if (learnt && learnt.partNumber) return { pn: learnt.partNumber, how: learnt.how };
  var k = prodEntryKey(e), set = prodChallanKeySet();
  if (set[k]) return { pn: null, matched: true, generic: true };
  return { pn: null, generic: prodIsGeneric(e.part) };
}
/* Which part a floor name is: the client's parts, those ending in the code written first, then those carrying the name. */
function prodAliasOpen(id) {
  var e = prodIndex().byId[id];
  if (!e || e.clientId == null) return;
  var c = prodAliasCandidates(e.clientId, e.part), seen = {};
  var opt = function(x, tag) { if (seen[x.partNumber]) return ''; seen[x.partNumber] = 1; return '<option value="' + escHtml(x.partNumber) + '">' + escHtml(x.partNumber + (x.desc && x.desc !== x.partNumber ? ' · ' + x.desc : '') + ' · ' + x.n + '×' + (tag ? ' · ' + tag : '')) + '</option>'; };
  var h = '<div class="inv-dialog" role="dialog" aria-modal="true" aria-labelledby="prodAliasT" data-prod-alias="' + escHtml(id) + '">' +
    dialogHeadHtml('<span id="prodAliasT">Which part is &ldquo;' + escHtml(e.part) + '&rdquo;?</span>') +
    '<div class="inv-dialog-body"><div class="inv-note inv-mb-8">' + escHtml(prodClientName(e.clientId)) + '. Every entry under this name, from now on too, is read as the part picked.</div>' +
    '<label class="inv-field"><span class="inv-field-label">Part</span><select class="inv-select" id="prodAliasPick"><option value="">Pick the part</option>' +
    (c.byCode.length ? '<optgroup label="Ending in ' + escHtml(c.code) + '">' + c.byCode.map(function(x) { return opt(x, ''); }).join('') + '</optgroup>' : '') +
    (c.byWord.length ? '<optgroup label="Named like it">' + c.byWord.map(function(x) { return opt(x, ''); }).join('') + '</optgroup>' : '') +
    '<optgroup label="All of the client’s parts">' + c.all.map(function(x) { return opt(x, ''); }).join('') + '</optgroup></select></label></div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invProdAliasSave" data-id="' + escHtml(id) + '">Save</button></div></div>';
  dialogOpen(h);
}
function prodAliasSave(id) {
  var e = prodIndex().byId[id], sel = document.getElementById('prodAliasPick');
  if (!e || !sel) return;
  if (!sel.value) { showToast('Pick the part', 'error'); return; }
  prodLearnAlias(e.clientId, e.part, e.gauge, sel.value, 'set');
  saveState();
  closeOverlay();
  renderProduction();
  showToast('“' + e.part + '” is read as ' + sel.value + ' from now on');
}

/* A run whose round no gauge rule names: its gauge picked from the client's rules and challans for that kind of part. */
function prodGaugeOpen(id) {
  var e = prodIndex().byId[id];
  if (!e) return;
  var ch = prodGaugeChoices(e);
  var h = '<div class="inv-dialog" role="dialog" aria-modal="true" aria-labelledby="prodGaugeT" data-prod-gauge="' + escHtml(id) + '">' +
    dialogHeadHtml('<span id="prodGaugeT">Gauge of ' + escHtml(e.part) + '</span>') +
    '<div class="inv-dialog-body"><div class="inv-note inv-mb-8">' + escHtml(prodEntryTitle(e) + ' · ' + formatDate(e.date) + (e.time ? ' ' + e.time : '') + ' · a round of ' + e.gaugeUnknown + ', which no gauge rule names.') + '</div>' +
    '<label class="inv-field"><span class="inv-field-label">Gauge</span><select class="inv-select" id="prodGaugePick"><option value="">Pick the gauge</option>' +
    ch.map(function(g) { return '<option value="' + escHtml(g) + '">' + escHtml(g) + '</option>'; }).join('') + '</select></label>' +
    '<label class="inv-field"><span class="inv-field-label">Or type it</span><input class="inv-input" id="prodGaugeTyped" placeholder="40X6"></label></div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invProdGaugeSave" data-id="' + escHtml(id) + '">Save</button></div></div>';
  dialogOpen(h);
}
function prodGaugeSave(id) {
  var e = prodIndex().byId[id], sel = document.getElementById('prodGaugePick'), typed = document.getElementById('prodGaugeTyped');
  if (!e) return;
  var raw = String((typed && typed.value.trim()) || (sel && sel.value) || '').toUpperCase().replace(/[×✕*\s]/g, 'X').replace(/X+/g, 'X');
  var g = lineGauge(raw);
  if (!g) { showToast('Pick a gauge, or type one like 40X6', 'error'); return; }
  e.gauge = g; e.gaugeSrc = 'set'; e.setAt = Date.now(); e.setBy = stockBy();
  prodTouch();
  saveState();
  closeOverlay();
  renderProduction();
  showToast('Gauge ' + g + ' set on the run');
}

/* ---------- Paste and review ---------- */
function prodPasteHtml() {
  return prodBackBar('Paste message') + '<div class="inv-panel">' +
    '<div class="inv-field"><label class="inv-field-label" for="prodPasteText">The messages, as sent</label>' +
    '<textarea id="prodPasteText" class="inv-textarea inv-textarea-mono" rows="12" spellcheck="false" placeholder="Copy the pickling messages, the barrel production list, or a roll with its production notes, and paste them here">' + escHtml(_prodPasteDraft) + '</textarea></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="prodBy">Entered by</label><input id="prodBy" class="inv-input" value="' + escHtml(stockBy()) + '" placeholder="Your name" autocomplete="off"></div>' +
    '<button class="inv-btn inv-btn-primary inv-btn-block" data-action="invProdRead">Read messages</button>' +
    '<div class="inv-note inv-mt-8">Copy the WhatsApp time lines with them: the sender, the day and the minute each was sent are read from them. Nothing is saved until you check what was read.</div></div>';
}
function prodReadPaste(text) {
  if (text != null) _prodPasteDraft = text;
  var ta = document.getElementById('prodPasteText');
  if (ta && text == null) _prodPasteDraft = ta.value;
  if (!_prodPasteDraft.trim()) { showToast('Paste the messages first', 'error'); return; }
  var msgs = parseProdPaste(_prodPasteDraft, prodCtx());
  var useful = msgs.filter(function(m) { return m.read.items.length; });
  if (!useful.length) { showToast('No pickling or production lines found in that text', 'error'); return; }
  _prodReview = { msgs: msgs, choices: {} };
  prodSetView('review');
}
/* From Home → Paste message or a roll's review: the text opens on Production's own check. */
function prodOpenPaste(text) {
  _prodPasteDraft = text || '';
  _prodReview = null; _prodView = 'paste';
  switchTab('pageProduction');
  prodReadPaste(_prodPasteDraft);
}
/* A message already saved is refused, unless every entry it made has since been voided (read it again). The key is the
   day a message reports and its text (prodMsgKey); one saved before the key carried its day is keyed on its text alone,
   and is matched by its entries' day. */
function prodPasteSeen(m) {
  var p = prodData();
  // Every copy saved, not the first: a message saved, voided and saved again is held by its second copy (P127).
  return p.pastes.filter(function(x) {
    if (x.hash === m.hash) return true;
    if (x.day || x.hash !== relayHash(x.text || '')) return false;
    var e = p.entries.find(function(y) { return y.pasteId === x.id; });
    return prodMsgKey(e ? e.date : x.sentOn, x.text) === m.hash;
  }).find(function(paste) { return p.entries.some(function(e) { return e.pasteId === paste.id && !e.voidedAt; }); }) || null;
}
/* The open cut stored from a message saved before, that a power back in this paste closes (P127). */
function prodStoredOpenCut(m, it) {
  var seen = prodPasteSeen(m);
  return seen ? prodData().entries.find(function(e) {
    return e.pasteId === seen.id && e.kind === 'downtime' && !e.voidedAt && e.date === it.date && e.time === it.time && e.to == null;
  }) || null : null;
}
function prodReviewResolve() {
  var rv = _prodReview, ch = rv.choices, out = { rows: [], red: 0, amber: 0, save: 0, dup: 0 }, inPaste = {};
  rv.msgs.forEach(function(m, mi) {
    // Saved before, or the same message earlier in this paste (the supervisor reposts a roll): read once.
    m.twice = !!(m.read.items.length && inPaste[m.hash]);
    if (m.read.items.length) inPaste[m.hash] = true;
    m.dup = !!prodPasteSeen(m) || m.twice;
    if (m.dup) out.dup++;
    m.read.items.forEach(function(it, ii) {
      var key = mi + ':' + ii, row = { m: m, mi: mi, ii: ii, key: key, it: it, issues: it.issues.slice(), tone: 'clear' };
      // A pick answers for every row of this paste with the same written name; a row picked on its own wins.
      var nk = it.client ? relayKey(it.client) : '', cc = ch['client' + key];
      if (cc === undefined && nk && ch['name:' + nk] !== undefined) cc = ch['name:' + nk];
      row.clientPick = cc;
      if (cc !== undefined) {
        // A load given its own client is answered: whose it is, and whether the client carried to it was right.
        var own = ch['client' + key] !== undefined;
        row.issues = row.issues.filter(function(x) { return x.code !== 'client' && x.code !== 'readas' && !(own && x.code === 'carried'); });
        if (cc === 'asWritten') row.clientId = null; else row.clientId = cc;
      } else row.clientId = it.clientId;
      var lc = ch['line' + key];
      if (it.lineHint !== undefined || (it.kind === 'plated' && it.basis === 'relay' && it.slot === 'ot')) {
        if (lc !== undefined) { row.issues = row.issues.filter(function(x) { return x.code !== 'linehint' && x.code !== 'noline'; }); row.line = lc || null; }
        else row.line = null;
      } else row.line = it.line || null;
      row.issues.forEach(function(x) { if (x.tone === 'red') row.tone = 'red'; else if (x.tone === 'amber' && row.tone !== 'red') row.tone = 'amber'; });
      if (!m.dup) { if (row.tone === 'red') out.red++; else if (row.tone === 'amber') out.amber++; out.save++; }
      out.rows.push(row);
    });
  });
  // A power back that closes a cut in a message left out closes the cut stored from it (P127): that is something to save.
  out.close = 0;
  rv.msgs.forEach(function(m) {
    if (m.dup) return;
    (m.read.notes || []).forEach(function(nt) {
      var cm = nt.closes && rv.msgs[nt.closes.mi];
      if (cm && cm.dup && (cm.twice || prodStoredOpenCut(cm, cm.read.items[nt.closes.ii]))) out.close++;
    });
  });
  return out;
}
function prodReviewHtml() {
  var rv = _prodReview, res = prodReviewResolve(), idx = prodCtx().clients;
  var h = prodBackBar('Check what was read');
  h += '<div class="inv-tiles"><div class="inv-tile' + (res.red ? ' inv-tile-danger' : '') + '"><div class="inv-tile-label">Needs you</div><div class="inv-tile-value">' + res.red + '</div></div>' +
    '<div class="inv-tile' + (res.amber ? ' inv-tile-warning' : '') + '"><div class="inv-tile-label">Check</div><div class="inv-tile-value">' + res.amber + '</div></div>' +
    '<div class="inv-tile"><div class="inv-tile-label">To save</div><div class="inv-tile-value">' + res.save + '</div></div></div>';
  if (res.dup) h += '<div class="inv-callout inv-callout-danger" id="prodDupNote">' + todoPlural(res.dup, 'message') + ' in this paste ' + (res.dup === 1 ? 'was' : 'were') + ' saved before, or sent twice, and ' + (res.dup === 1 ? 'is' : 'are') + ' left out, so nothing counts twice.</div>';
  rv.msgs.forEach(function(m, mi) {
    var kindWord = { pickling: 'Pickling', production: 'Barrel production', runs: 'Production by slot', roll: 'Roll: production notes', power: 'Power cut', stock: 'Stock (read in Stock)', other: 'Not production' }[m.kind];
    h += '<div class="inv-panel inv-panel-flush' + (m.dup ? ' inv-row-muted' : '') + '" data-prod-msg="' + mi + '"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(kindWord + (m.sentBy ? ' · ' + m.sentBy : '')) + '</span>' +
      '<span class="inv-panel-count">' + escHtml((m.sentOn ? stockShortDate(m.sentOn) : 'no date') + (m.sentAt != null ? ' ' + relayHhmm(m.sentAt) : '')) + '</span></div>';
    if (m.dup) h += '<div class="inv-panel-body inv-note">' + (m.twice ? 'The same message is earlier in this paste: read once, left out here.' : 'Saved before: left out.') + '</div>';
    if (m.kind === 'roll' && !m.read.items.length) h += '<div class="inv-panel-body inv-note">An attendance roll with no production notes: read it in Staff → Paste message.</div>';
    if (m.kind === 'stock') h += '<div class="inv-panel-body inv-note">A chemical stock message: read it in Stock → Paste message.</div>';
    if (m.kind === 'other') h += '<div class="inv-panel-body"><div class="inv-quote">' + escHtml(m.text.slice(0, 400)) + '</div><div class="inv-note inv-mt-4">Not read: not a pickling, production or power message.</div></div>';
    res.rows.filter(function(r) { return r.mi === mi; }).forEach(function(r) { h += prodReviewRowHtml(r, idx); });
    (m.read.notes || []).forEach(function(nt) {
      var cm = nt.closes && rv.msgs[nt.closes.mi], txt = nt.text + (cm && cm.dup && !m.dup ? ': that message is left out, so its time back is put on the cut saved from it' : '');
      h += '<div class="inv-row inv-row-auto inv-row-top"><div class="inv-row-main"><div class="inv-quote">' + escHtml(nt.raw) + '</div><div class="inv-note inv-mt-4">' + escHtml(txt) + '</div></div></div>';
    });
    h += '</div>';
  });
  h += '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">To save</div><div class="inv-actionbar-value">' + todoPlural(res.save, 'entry', 'entries') + '</div></div>' +
    '<button class="inv-btn inv-btn-primary" data-action="invProdSaveReview"' + (res.red || !(res.save || res.close) ? ' disabled' : '') + '>Save</button></div>';
  return h;
}
function prodReviewRowHtml(r, idx) {
  var it = r.it, badge = r.m.dup ? ['neutral', 'Saved before'] : r.tone === 'red' ? ['danger', 'Needs you'] : r.tone === 'amber' ? ['warning', 'Check'] : ['ok', 'Clear'];
  var kindWord = { pickled: 'Pickled', plated: 'Plated', arrived: 'Arrived', downtime: 'Power cut' }[it.kind];
  var reading = it.kind === 'downtime' ? 'Power cut ' + (it.time || '?') + ' to ' + (it.to || 'not back') :
    kindWord + (it.time ? ' ' + it.time : '') + ' · ' + (r.clientId != null ? prodClientName(r.clientId) : it.client ? it.client + ' (as written)' : 'no client') +
    (it.part ? ' · ' + it.part : '') + (it.gauge ? ' [' + it.gauge + ']' : '') + ' · ' + prodQtyText(it.qty, it.unit) + (it.qty2 != null ? ' + ' + prodQtyText(it.qty2, it.unit2) : '') +
    (it.kind === 'plated' ? ' · ' + (r.line ? prodLineName(r.line) : it.line ? prodLineName(it.line) : 'line unknown') : '') + (it.rework ? ' · rework' : '');
  var h = '<div class="inv-row inv-row-auto inv-row-top" data-prod-row="' + r.key + '" data-tone="' + r.tone + '"><div class="inv-row-main"><div class="inv-quote">' + escHtml(it.raw) + '</div>' +
    '<div class="inv-verdict-text inv-mt-4">' + escHtml(reading) + '</div>';
  r.issues.forEach(function(x) { h += '<div class="inv-callout inv-callout-' + uiTone(x.tone) + ' inv-mt-8">' + escHtml(x.text) + '</div>'; });
  // A client read by name (exact or learnt) can be changed too: "Change client" opens the same picker.
  var pickOpen = it.clientId == null || it.issues.some(function(x) { return x.code === 'readas'; }) || r.clientPick !== undefined || _prodReview.choices['open' + r.key];
  if (!r.m.dup && it.kind !== 'downtime' && !pickOpen) h += '<div class="inv-mt-4"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invProdRevClient" data-key="' + r.key + '">Change client</button></div>';
  if (!r.m.dup && it.kind !== 'downtime' && pickOpen) {
    var cur = r.clientPick;
    var sel = cur !== undefined ? String(cur) : (it.clientId != null ? String(it.clientId) : '');
    h += '<div class="inv-fields inv-mt-8"><div class="inv-field"><label class="inv-field-label" for="prodClient' + r.key.replace(':', '_') + '">Client</label>' +
      '<select id="prodClient' + r.key.replace(':', '_') + '" class="inv-select" data-prod-client="' + r.key + '">' + (sel === '' ? '<option value="" selected>Pick the client</option>' : '') +
      '<option value="asWritten"' + (sel === 'asWritten' ? ' selected' : '') + '>Not in the book: keep "' + escHtml(it.client || '') + '" as written</option>' +
      idx.list.slice().sort(function(a, b) { return a.name.localeCompare(b.name); }).map(function(c) { return '<option value="' + escHtml(String(c.id)) + '"' + (sel === String(c.id) ? ' selected' : '') + '>' + escHtml(c.name) + '</option>'; }).join('') + '</select></div></div>';
  }
  if (!r.m.dup && it.kind === 'plated' && it.basis === 'relay' && it.slot === 'ot') {
    var lc = _prodReview.choices['line' + r.key];
    h += '<div class="inv-toolbar inv-mt-8" role="group" aria-label="Which line">' + [['', 'Unknown']].concat(PROD_LINES.map(function(l) { return [l, PROD_LINE_LABEL[l]]; })).map(function(o) {
      var pressed = lc !== undefined ? lc === o[0] : false;
      return '<button class="inv-chip" data-action="invProdRevLine" data-key="' + r.key + '" data-line="' + o[0] + '" aria-pressed="' + pressed + '">' + escHtml(o[1] + (it.lineHint === o[0] && o[0] ? ' (header above)' : '')) + '</button>';
    }).join('') + '</div>';
  }
  return h + '</div><div class="inv-row-end"><span class="inv-badge inv-badge-' + badge[0] + '">' + badge[1] + '</span></div></div>';
}
function prodSaveReview() {
  var rv = _prodReview;
  if (!rv) return;
  if (!grdGate('floor', 'save production', prodSaveReview)) return;   // the guard (guard.js): a floor entry, never re-asked
  var res = prodReviewResolve();
  if (res.red) { showToast('Answer the rows marked Needs you first', 'error'); return; }
  var p = prodData(), at = Date.now(), byEl = document.getElementById('prodBy'), by = byEl ? byEl.value.trim() : stockBy(), n = 0, pasteIds = {};
  var learnt = 0;
  res.rows.forEach(function(r) {
    if (r.m.dup) return;
    var it = r.it;
    if (!pasteIds[r.mi]) {
      pasteIds[r.mi] = prodUid('PP');
      p.pastes.push({ id: pasteIds[r.mi], at: at, by: by, sentBy: r.m.sentBy || '', sentOn: r.m.sentOn || '', day: r.m.read.date, kind: r.m.kind, hash: r.m.hash, text: r.m.text });
    }
    var e = { id: prodUid('PE'), kind: it.kind, date: it.date, time: it.time, to: it.to, slot: it.slot || (it.kind === 'plated' ? 'general' : null),
      line: it.kind === 'plated' ? (r.line || it.line || null) : null, clientId: r.clientId != null ? r.clientId : null, client: it.client, part: it.part, gauge: it.gauge,
      qty: it.qty, unit: it.unit, qty2: it.qty2, unit2: it.unit2, qtySrc: it.qtySrc, rework: it.rework, downtime: it.downtime,
      basis: it.basis || (it.kind === 'pickled' ? 'pickling' : it.kind === 'arrived' ? 'floor-in' : 'relay'), src: 'paste', raw: it.raw, n: it.n,
      pasteId: pasteIds[r.mi], msgHash: r.m.hash, sentBy: r.m.sentBy || '', by: by, at: at };
    if (e.kind === 'plated') e.lineSrc = e.line ? (it.line ? 'written' : 'set') : null;
    // A client picked for a written name is remembered for the next message; a read-as left as read is kept too. Kept
    // as written learns nothing: it used to store the very guess the owner had just turned down, and a lesson it
    // turns down is forgotten. A name read by its place alone (the barrel list's first word, how 'unknown') or matched
    // exactly (the client's own name) is never re-pointed: the pick answers whose the load is, not how a name is spelt.
    var pick = r.clientPick, k = it.client ? relayKey(it.client) : '', how = it.clientHow || '';
    // A load carried from the one above never teaches the name: the name was written over other loads (P127).
    if (it.issues.some(function(x) { return x.code === 'carried'; })) k = '';
    if (k && pick !== undefined && pick !== 'asWritten' && how !== 'unknown' && how !== 'exact') { if (p.learn.clients[k] !== pick) { p.learn.clients[k] = pick; learnt++; } }
    else if (k && pick === 'asWritten' && how === 'learnt') delete p.learn.clients[k];
    else if (k && pick === undefined && it.issues.some(function(x) { return x.code === 'readas'; }) && it.clientId != null) { if (!(k in p.learn.clients)) { p.learn.clients[k] = it.clientId; learnt++; } }
    // A code the floor writes ("4206", "TINA(0160)") is matched to the client's part, as a register's or a hand entry's is.
    if (e.clientId != null && e.kind !== 'downtime') prodLearnAliases([e]);
    p.entries.push(prodSparse(e));
    n++;
  });
  // A power back that closed a cut in a message left out: the cut stored from that message is closed (P127).
  var closed = 0;
  rv.msgs.forEach(function(m, mi) {
    if (m.dup) return;
    (m.read.notes || []).forEach(function(nt) {
      var cm = nt.closes && rv.msgs[nt.closes.mi];
      if (!cm || !cm.dup) return;
      var cut = cm.read.items[nt.closes.ii], st = cut && prodStoredOpenCut(cm, cut);
      if (!st) return;
      if (!pasteIds[mi]) {
        pasteIds[mi] = prodUid('PP');
        p.pastes.push({ id: pasteIds[mi], at: at, by: by, sentBy: m.sentBy || '', sentOn: m.sentOn || '', day: m.read.date, kind: m.kind, hash: m.hash, text: m.text });
      }
      st.to = cut.to; st.downtime = Object.assign({}, st.downtime, { open: false }); st.raw = (st.raw ? st.raw + '\n' : '') + nt.raw;
      st.closedBy = pasteIds[mi]; st.closedAt = at;
      closed++;
    });
  });
  if (!n && !closed) { showToast('Nothing new to save', 'error'); return; }
  prodTouch();
  saveState();
  _prodReview = null; _prodPasteDraft = '';
  prodSetView('main');
  showToast(todoPlural(n, 'entry', 'entries') + ' saved' + (closed ? ' · ' + todoPlural(closed, 'cut saved before', 'cuts saved before') + ' given its time back' : '') + (res.dup ? ' · ' + todoPlural(res.dup, 'message') + ' saved before, left out' : '') + (learnt ? ' · ' + todoPlural(learnt, 'spelling') + ' remembered' : ''), 'success');
}

/* ---------- Register photo ---------- */
function prodPhotoPick() {
  // The key is checked before the picker opens: an awaited step before click() loses the picker on iOS.
  if (!getApiKey()) { uiAlert({ title: 'Gemini key needed', body: 'Reading a register photo uses the Gemini key in Settings → Connections (free from aistudio.google.com). Enter by hand needs no key.' }); return; }
  var inp = document.getElementById('prodPhotoInput');
  if (!inp) return;
  inp.value = '';
  inp.click();
}
function prodPhotoSha(buf) {
  if (!(window.crypto && crypto.subtle)) return Promise.resolve('n' + buf.byteLength);
  return crypto.subtle.digest('SHA-256', buf).then(function(d) { return Array.from(new Uint8Array(d)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join(''); });
}
/* Photos are read one at a time: the free tier limits requests a minute, and one failing does not stop the rest. */
var _prodPhotoQueue = [];
function prodPhotoFiles(files) {
  _prodPhotoQueue = Array.prototype.slice.call(files || []);
  prodPhotoNext();
}
function prodPhotoNext() {
  var file = _prodPhotoQueue.shift();
  if (!file) return;
  var proc = document.getElementById('prodProcessing');
  if (proc) proc.innerHTML = '<div class="inv-scan-processing"><div class="inv-scan-processing-card"><div class="inv-scan-spinner"></div><div class="inv-scan-processing-text">Reading the register</div>' +
    '<div class="inv-scan-processing-sub">Gemini is transcribing ' + escHtml(file.name || 'the photo') + '</div></div></div>';
  var done = function() { if (proc) proc.innerHTML = ''; };
  file.arrayBuffer().then(function(buf) { return prodPhotoSha(buf).then(function(sha) { return { buf: buf, sha: sha }; }); }).then(function(b) {
    // Any copy of the photo with an entry still live, not the first saved: one voided and saved again is held by the second (P127).
    var p = prodData(), seen = p.photos.filter(function(x) { return x.sha === b.sha; }).find(function(x) { return p.entries.some(function(e) { return e.photoId === x.id && !e.voidedAt; }); });
    var seenLive = !!seen;
    // The day the photo was taken, on this device's clock (UTC would put an evening photo in India on the next day).
    var lm = file.lastModified ? new Date(file.lastModified) : null;
    var photoDate = lm ? lm.getFullYear() + '-' + String(lm.getMonth() + 1).padStart(2, '0') + '-' + String(lm.getDate()).padStart(2, '0') : null;
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(PROD_DRAFT_KEY) || 'null'); } catch (e) { draft = null; }
    var start = function(json, meta) {
      done();
      _prodPhoto = { file: file, name: file.name || '', bytes: file.size, url: URL.createObjectURL(file), sha: b.sha, json: json, meta: meta || {}, choices: {}, photoDate: photoDate, dupSha: seenLive ? seen : null };
      try { localStorage.setItem(PROD_DRAFT_KEY, JSON.stringify({ sha: b.sha, json: json, name: file.name, at: Date.now() })); } catch (e) { /* a convenience only */ }
      prodSetView('photo');
    };
    if (draft && draft.sha === b.sha && draft.json) { start(draft.json, { draft: true }); return; }
    geminiReadImage(file, PROD_REGISTER_PROMPT, { schema: PROD_REGISTER_SCHEMA, maxEdge: 2000, thinkingBudget: 0 }).then(function(res) {
      if (res.ok) { start(res.json, res.meta); return; }
      done();
      if (/credit|billing|prepay/i.test(res.error || '')) res.code = 'billing';
      var msg = { billing: 'The Gemini key\u2019s Google project is on prepaid billing and its credits have run out. Add credit to it, or make a new key in a project with no billing (free) and put it in Settings \u2192 Connections.', key: 'No Gemini key is set (Settings → Connections).', quota: 'Gemini says too many requests. Wait a minute and read the photo again.', timeout: res.error, truncated: 'The reply was cut off: the page may have too many rows. Try a photo of half the page.',
        json: 'Gemini did not return the table asked for. Read it again, or enter the page by hand.', blocked: res.error, empty: 'Gemini returned nothing for this photo.' }[res.code] || ('Reading failed: ' + res.error);
      uiNotice('Register photo: ' + msg, 'error');
      prodPhotoNext();
    });
  }).catch(function(err) { done(); uiNotice('Register photo: ' + ((err && err.message) || 'could not read the file'), 'error'); prodPhotoNext(); });
}
function prodPhotoRead() { var ph = _prodPhoto; return prodRackCheck(prodFromRegisterRead(ph.json, prodCtx(), ph.photoDate, ph.choices)); }
function prodPhotoHtml() {
  var ph = _prodPhoto, rd = prodPhotoRead(), p = prodData();
  var line = ph.choices.line !== undefined ? ph.choices.line : rd.line;
  var date = ph.choices.date || rd.date;
  var dupFp = p.photos.find(function(x) { return x.fp === rd.fp && p.entries.some(function(e) { return e.photoId === x.id && !e.voidedAt; }); });
  var red = rd.issues.filter(function(x) { return x.tone === 'red'; }).length, power = rd.page === 'power';
  rd.rows.forEach(function(r) { r.issues.forEach(function(x) { if (x.tone === 'red') red++; }); });
  rd.runs.forEach(function(e, i) { if (e.clientId == null && ph.choices['client' + i] === undefined) red++; });
  var h = prodBackBar('Check the register');
  h += '<div class="inv-panel"><div class="inv-scroll-x"><img class="inv-prod-photo" src="' + escHtml(ph.url) + '" alt="The register photo"></div>' +
    '<div class="inv-fields inv-mt-8"><div class="inv-field"><label class="inv-field-label" for="prodPhotoDate">Date on the page</label><input type="date" id="prodPhotoDate" class="inv-input" value="' + escHtml(date) + '"></div>' +
    (power || rd.page === 'other' ? '' : '<div class="inv-field"><label class="inv-field-label" for="prodPhotoLine">Line</label><select id="prodPhotoLine" class="inv-select">' +
      '<option value=""' + (!line ? ' selected' : '') + '>Unknown</option>' + PROD_LINES.map(function(l) { return '<option value="' + l + '"' + (line === l ? ' selected' : '') + '>' + PROD_LINE_LABEL[l] + '</option>'; }).join('') + '</select></div>') + '</div>' +
    '<div class="inv-note inv-mt-8">Read by Gemini' + (ph.meta.draft ? ' (kept from the last read of this photo)' : '') + '. Check every row against the photo: nothing is saved until you do.</div></div>';
  if (ph.dupSha) h += '<div class="inv-callout inv-callout-danger" id="prodPhotoDup">This photo was saved before. Saving it again would count the page twice.</div>';
  else if (dupFp) h += '<div class="inv-callout inv-callout-warning" id="prodPhotoDup">A photo with the same rows for this day and line was saved before (a retake or a forward?). Saving would count the page twice.</div>';
  rd.issues.forEach(function(x) { if (x.code === 'line' && line) return; h += '<div class="inv-callout inv-callout-' + uiTone(x.tone) + '">' + escHtml(x.text) + '</div>'; });
  if (power) {
    // The register's power log: each cut with its return, as written.
    h += '<div class="inv-panel inv-panel-flush" id="prodPhotoPower"><div class="inv-panel-head"><span class="inv-panel-title">Power cuts read</span><span class="inv-panel-count">' + rd.downtime.length + '</span></div>' +
      rd.downtime.map(function(x, i) {
        var mins = x.to ? relayParseHhmm(x.to) - relayParseHhmm(x.time) : null;
        return '<div class="inv-row inv-row-2" data-prod-cut="' + i + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(stockShortDate(x.date) + ' · ' + x.time + (x.to ? ' – ' + x.to : ', no return written')) + '</span>' +
          '<span class="inv-row-meta">' + escHtml(x.raw.replace(/\n/g, ' / ')) + '</span></span><span class="inv-row-end inv-num">' + (mins != null ? escHtml(mins + ' min') : '&mdash;') + '</span></div>';
      }).join('') + '<div class="inv-panel-body inv-note">A cut the pickling messages also reported is counted once: the two are joined when they overlap or begin within ten minutes.</div></div>';
    return h + '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">Power cuts</div><div class="inv-actionbar-value">' + rd.downtime.length + '</div></div>' +
      '<button class="inv-btn inv-btn-primary" data-action="invProdSavePhoto"' + (red || ph.dupSha || !rd.downtime.length ? ' disabled' : '') + '>Save</button></div>';
  }
  if (rd.page === 'challan') h += '<div class="inv-panel"><button class="inv-btn inv-btn-secondary inv-btn-block" data-action="invProdToScanner">Read it as a challan</button></div>';
  if (rd.page === 'other' || rd.page === 'challan') return h + '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">Nothing to save</div><div class="inv-actionbar-value">0</div></div>' +
    '<button class="inv-btn inv-btn-primary" data-action="invProdSavePhoto" disabled>Save</button></div>';
  h += '<div class="inv-panel inv-panel-flush" id="prodPhotoRuns"><div class="inv-panel-head"><span class="inv-panel-title">Runs read</span><span class="inv-panel-count">' + rd.runs.length + '</span></div>';
  rd.runs.forEach(function(e, i) {
    var cc = ph.choices['client' + i], cid = cc !== undefined ? (cc === 'asWritten' ? null : cc) : e.clientId;
    h += '<div class="inv-row inv-row-auto inv-row-top" data-prod-run="' + i + '"><div class="inv-row-main"><div class="inv-row-title">' + escHtml((cid != null ? prodClientName(cid) : e.client || 'No client') + (e.part ? ' · ' + e.part : '')) + '</div>';
    e.rows.forEach(function(r) {
      h += '<div class="inv-quote inv-mt-4">' + escHtml(r.raw || '(empty row)') + '</div>';
      r.issues.forEach(function(x) { h += '<div class="inv-callout inv-callout-' + uiTone(x.tone) + ' inv-mt-4">' + escHtml(x.text) + '</div>'; });
      if (r.struck) h += '<div class="inv-toolbar inv-mt-4" role="group" aria-label="Struck row">' + [['counted', 'Counted'], ['cancelled', 'Cancelled']].map(function(o) {
        return '<button class="inv-chip" data-action="invProdStruck" data-i="' + r.i + '" data-v="' + o[0] + '" aria-pressed="' + (ph.choices['struck' + r.i] === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
    });
    e.issues.forEach(function(x) { if (x.code === 'client' && cc !== undefined) return; h += '<div class="inv-callout inv-callout-' + uiTone(x.tone) + ' inv-mt-8">' + escHtml(x.text) + '</div>'; });
    // Every run's client can be changed, as on the paste check (P127): a run read exactly, one the ditto rule moved, one whose
    // round the rules give to another client. The last two open on the picker.
    var moved = e.rows.some(function(r) { return r.issues.some(function(x) { return x.code === 'carried' || x.code === 'whose'; }); });
    if (!(e.clientId == null || cc !== undefined || moved || ph.choices['open' + i] || e.issues.some(function(x) { return x.code === 'readas'; })))
      h += '<div class="inv-mt-4"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invProdRunClient" data-i="' + i + '">Change client</button></div>';
    else {
      var sel = cc !== undefined ? String(cc) : (e.clientId != null ? String(e.clientId) : '');
      h += '<div class="inv-fields inv-mt-8"><div class="inv-field"><label class="inv-field-label" for="prodRunClient' + i + '">Client</label><select id="prodRunClient' + i + '" class="inv-select" data-prod-run-client="' + i + '">' +
        (sel === '' ? '<option value="" selected>Pick the client</option>' : '') + '<option value="asWritten"' + (sel === 'asWritten' ? ' selected' : '') + '>Not in the book: keep as written</option>' +
        (S.clients || []).slice().sort(function(a, b) { return a.name.localeCompare(b.name); }).map(function(c) { return '<option value="' + escHtml(String(c.id)) + '"' + (sel === String(c.id) ? ' selected' : '') + '>' + escHtml(c.name) + '</option>'; }).join('') + '</select></div></div>';
    }
    h += '</div><div class="inv-row-end"><span class="inv-num">' + escHtml(prodQtyText(e.qty, 'NOS')) + '</span></div></div>';
  });
  h += '</div><div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">Counted</div><div class="inv-actionbar-value">' + escHtml(Math.round(rd.counted || 0).toLocaleString('en-IN') + ' NOS') + '</div></div>' +
    '<button class="inv-btn inv-btn-primary" data-action="invProdSavePhoto"' + (red || ph.dupSha || !rd.runs.length ? ' disabled' : '') + '>Save</button></div>';
  return h;
}
function prodSavePhoto() {
  var ph = _prodPhoto;
  if (!ph) return;
  if (!grdGate('floor', 'save production', prodSavePhoto)) return;   // the guard (guard.js): a floor entry, never re-asked
  var rd = prodPhotoRead(), p = prodData(), at = Date.now(), by = stockBy();
  var line = ph.choices.line !== undefined ? ph.choices.line : rd.line, date = ph.choices.date || rd.date;
  var id = prodUid('PF'), n = 0;
  if (rd.page === 'other' || rd.page === 'challan') return;
  p.photos.push({ id: id, at: at, by: by, sha: ph.sha, name: ph.name, bytes: ph.bytes, w: ph.meta.w || 0, h: ph.meta.h || 0, model: ph.meta.model || geminiModel(), promptVer: PROD_REGISTER_PROMPT_VER,
    readDate: date, readLine: rd.page === 'power' ? null : line || null, page: rd.page, rows: rd.page === 'power' ? rd.downtime.length : rd.rows.length, fp: rd.fp });
  rd.downtime.forEach(function(x) {
    p.entries.push(prodSparse({ id: prodUid('PE'), kind: 'downtime', date: x.date, time: x.time, to: x.to, downtime: { cause: 'power', open: !!x.open },
      basis: 'register', src: 'photo', raw: x.raw, photoId: id, by: by, at: at }));
    n++;
  });
  rd.runs.forEach(function(e, i) {
    // A run every row of which was struck and cancelled was never plated.
    if (e.rows.length && e.rows.every(function(x) { return x.struck && !x.counted && ph.choices['struck' + x.i] === 'cancelled'; })) return;
    var cc = ph.choices['client' + i];
    var rec = Object.assign({}, e, { id: prodUid('PE'), date: date, line: line || null, lineSrc: line ? (line === rd.readLine ? 'written' : 'set') : null,
      clientId: cc !== undefined ? (cc === 'asWritten' ? null : cc) : e.clientId, photoId: id, by: by, at: at });
    delete rec.rows; delete rec.issues; delete rec.clientName;
    // A pick is learnt for the name only where the name was not read as a client (unknown, or read as one): a name read
    // exactly, a customer carried from a ditto, or a round the rules give another client says whose the run is, not how
    // the name is spelt (the paste check's rule, P127).
    var named = e.issues.some(function(x) { return x.code === 'client' || x.code === 'readas'; });
    var moved = e.rows.some(function(r) { return r.issues.some(function(x) { return x.code === 'carried' || x.code === 'whose'; }); });
    if (cc !== undefined && cc !== 'asWritten' && e.client && named && !moved) p.learn.clients[relayKey(e.client)] = cc;
    prodLearnAliases([rec]);
    p.entries.push(prodSparse(rec));
    n++;
  });
  prodTouch();
  saveState();
  try { localStorage.removeItem(PROD_DRAFT_KEY); } catch (e) { /* a convenience only */ }
  try { URL.revokeObjectURL(ph.url); } catch (e) { /* nothing held */ }
  _prodPhoto = null;
  prodSetView('main');
  showToast(rd.page === 'power' ? todoPlural(n, 'power cut') + ' saved from the register' : todoPlural(n, 'run') + ' saved from the register', 'success');
  prodPhotoNext();
}

/* ---------- By hand ---------- */
function prodOpenHand(fromId, from) {
  var src = fromId ? prodIndex().byId[fromId] : null;
  _prodHand = src ? { kind: src.kind, date: src.date, time: src.time || '', to: src.to || '', line: src.line || '', clientId: src.clientId != null ? String(src.clientId) : '', part: src.part || '',
    qty: src.qty != null ? String(src.qty) : '', unit: src.unit || 'NOS', rework: !!src.rework, slot: src.slot === 'ot' || src.slot === 'day' ? src.slot : 'general', replaces: src.id }
    : prodHandBlank();
  _prodHand.from = from || null;   // 'power': opened from Power's Enter a cut, and its way back is Power
  _prodHand.saved = [];            // the entries saved from this form, listed under it
  prodSetView('hand');
}
/* An empty hand form: Enter by hand, and the same form opened by its address (nav.js). */
function prodHandBlank() {
  return { kind: 'plated', date: localDateStr(), time: '', to: '', line: 'vat-a1', clientId: '', part: '', qty: '', unit: 'NOS', rework: false, slot: 'general', replaces: null, from: null, saved: [] };
}
function prodHandHtml() {
  var f = _prodHand;
  var field = function(id, label, input) { return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + label + '</label>' + input + '</div>'; };
  var h = f.from === 'power' ? '<div class="inv-pagehead"><button class="inv-btn inv-btn-ghost inv-btn-sm inv-pagehead-back" data-action="invProdHandDone">' + STOCK_BACK_ICON + 'Power</button>' +
      '<h2 class="inv-pagehead-title">Enter power cuts</h2></div>' : prodBackBar(f.replaces ? 'Correct an entry' : 'Enter by hand');
  if (f.replaces) h += '<div class="inv-callout inv-callout-info">This entry takes the place of the one corrected, which stays on the record, marked corrected.</div>';
  else h += '<div class="inv-seg inv-mb-8" role="group" aria-label="What is entered">' + [['plated', 'Plated'], ['pickled', 'Pickled'], ['arrived', 'Arrived'], ['downtime', 'Power cut']].map(function(o) {
    return '<button type="button" class="inv-seg-btn" data-action="invProdHandKind" data-kind="' + o[0] + '" aria-pressed="' + (f.kind === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  h += '<div class="inv-panel"><div class="inv-fields">' + field('prodHandDate', 'Date', '<input type="date" id="prodHandDate" class="inv-input" data-prod-hand="date" value="' + escHtml(f.date) + '">') +
    field('prodHandTime', f.kind === 'downtime' ? 'Power cut at' : 'Time', '<input type="time" id="prodHandTime" class="inv-input" data-prod-hand="time" value="' + escHtml(f.time) + '">');
  if (f.kind === 'downtime') h += field('prodHandTo', 'Power back at', '<input type="time" id="prodHandTo" class="inv-input" data-prod-hand="to" value="' + escHtml(f.to) + '">');
  // What is shown is what is saved: an entry corrected with no line keeps it unknown (the list showed VAT A1 and saved
  // none), and the barrel list's whole day stays a whole day (it was forced to the general shift).
  if (f.kind === 'plated') h += field('prodHandLine', 'Line', '<select id="prodHandLine" class="inv-select" data-prod-hand="line"><option value=""' + (!f.line ? ' selected' : '') + '>Line unknown</option>' +
      PROD_LINES.map(function(l) { return '<option value="' + l + '"' + (f.line === l ? ' selected' : '') + '>' + PROD_LINE_LABEL[l] + '</option>'; }).join('') + '</select>') +
    field('prodHandSlot', 'Shift', '<select id="prodHandSlot" class="inv-select" data-prod-hand="slot"><option value="general"' + (f.slot !== 'ot' && f.slot !== 'day' ? ' selected' : '') + '>General shift</option><option value="ot"' + (f.slot === 'ot' ? ' selected' : '') + '>Overtime</option>' +
      (f.slot === 'day' ? '<option value="day" selected>Whole day (barrel list)</option>' : '') + '</select>');
  if (f.kind !== 'downtime') {
    h += field('prodHandClient', 'Client', '<select id="prodHandClient" class="inv-select" data-prod-hand="clientId"><option value="">Pick the client</option>' +
      (S.clients || []).slice().sort(function(a, b) { return a.name.localeCompare(b.name); }).map(function(c) { return '<option value="' + escHtml(String(c.id)) + '"' + (f.clientId === String(c.id) ? ' selected' : '') + '>' + escHtml(c.name) + '</option>'; }).join('') + '</select>') +
      field('prodHandPart', 'Part', '<input id="prodHandPart" class="inv-input" data-prod-hand="part" value="' + escHtml(f.part) + '" placeholder="e.g. CLAMP 165X83 (40X6)" autocomplete="off">') +
      field('prodHandQty', 'Quantity', '<input type="number" inputmode="decimal" step="any" min="0" id="prodHandQty" class="inv-input inv-input-num" data-prod-hand="qty" value="' + escHtml(f.qty) + '">') +
      field('prodHandUnit', 'Unit', '<select id="prodHandUnit" class="inv-select" data-prod-hand="unit"><option value="NOS"' + (f.unit === 'NOS' ? ' selected' : '') + '>NOS</option><option value="KG"' + (f.unit === 'KG' ? ' selected' : '') + '>kg</option></select>') +
      '<label class="inv-field-check"><input type="checkbox" class="inv-check" id="prodHandRework" data-prod-hand="rework"' + (f.rework ? ' checked' : '') + '><span>Rework (counted as work, never as billing)</span></label>';
  }
  h += '</div></div>';
  // Entries are entered by hand several at a time (owner, 30 Sep 2026: the page went back to the base screen after every
  // one), so the form stays open after a save and lists what was saved from it, each with its Correct and Void.
  var idx = prodIndex(), saved = (f.saved || []).map(function(id) { return idx.byId[id]; }).filter(Boolean);
  if (saved.length) h += '<div class="inv-panel inv-panel-flush inv-mt-8" data-card="prodHandSaved"><div class="inv-panel-head"><span class="inv-panel-title">Saved from this form</span><span class="inv-panel-count">' + saved.length + '</span>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invProdHandDone">Done</button></div>' +
    saved.slice().reverse().map(function(e) { return prodEntryRowHtml(e, idx); }).join('') + '</div>';
  h += '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">' + escHtml({ plated: 'Plated', pickled: 'Pickled', arrived: 'Arrived', downtime: 'Power cut' }[f.kind]) + ' on</div>' +
    '<div class="inv-actionbar-value">' + escHtml(stockShortDate(f.date)) + '</div></div><button class="inv-btn inv-btn-primary" data-action="invProdSaveHand">Save</button></div>';
  return h;
}
/* Leaving the hand form: back to where it was opened from. */
function prodHandDone() {
  var from = _prodHand && _prodHand.from;
  _prodHand = null;
  if (from === 'power') { _prodView = 'main'; switchTab('pagePower'); return; }
  prodSetView('main');
}
async function prodSaveHand() {
  var f = _prodHand;
  if (!f) return;
  if (!grdOk('floor') && !(await guardAsk('floor', 'save production'))) return;   // the guard (guard.js): a floor entry
  if (!f.date) { showToast('Pick a date', 'error'); return; }
  var q = parseFloat(f.qty);
  if (f.kind !== 'downtime' && !f.clientId) { showToast('Pick the client', 'error'); return; }
  if (f.kind !== 'downtime' && !f.part.trim()) { showToast('Name the part', 'error'); return; }
  if (f.kind === 'downtime' && !f.time) { showToast('Enter when the power went', 'error'); return; }
  // A power back earlier on the clock than the cut ran overnight, or is a slip: asked, never assumed (P127).
  if (f.kind === 'downtime' && f.to && f.to < f.time) {
    var a = relayParseHhmm(f.time), b = relayParseHhmm(f.to);
    var ok = await uiConfirm({ title: 'Did the power stay off overnight?', body: 'The power came back at ' + relayClockLabel(b) + ', earlier on the clock than the cut at ' + relayClockLabel(a) +
      '. Saved as it is, the cut ran overnight: ' + powerDur(b + 1440 - a) + '. Check the times if it did not.', okLabel: 'Yes, overnight' });
    if (!ok || _prodHand !== f) return;
  }
  var p = prodData(), src = f.replaces ? prodIndex().byId[f.replaces] : null;
  var e = { id: prodUid('PE'), kind: f.kind, date: f.date, time: f.time || null, to: f.kind === 'downtime' ? (f.to || null) : null, src: 'hand', by: stockBy(), at: Date.now(),
    basis: src ? (src.basis || 'hand') : 'hand', replaces: f.replaces || null };
  if (f.kind === 'downtime') e.downtime = { cause: 'power', open: !f.to };
  else {
    // The picker hands back text; the book's own id is kept, so a floor key and a challan key agree.
    e.clientId = prodHeldId(f.clientId); e.client = prodClientName(e.clientId); e.part = f.part.trim(); e.gauge = prodGaugeOf(e.part, e.part);
    e.qty = isNaN(q) ? null : q; e.unit = f.unit; e.rework = !!f.rework;
    if (f.kind === 'plated') { e.line = f.line || null; e.lineSrc = f.line ? 'set' : null; e.slot = f.slot === 'ot' || f.slot === 'day' ? f.slot : 'general'; }
    // A correction keeps what the form does not show (P127): the run's end, its rounds, the second figure written and a
    // load's line set by the owner. The part's own reading (its number, the gauges its round allows, a round no rule
    // names) goes with it while the part and the client are as they were; the entry corrected is then no longer flagged.
    if (src) {
      if (f.kind === 'plated' && src.to) e.to = src.to;
      ['rounds', 'qty2', 'unit2', 'set'].forEach(function(k) { if (src[k] != null) e[k] = src[k]; });
      if (f.kind !== 'plated' && src.line) { e.line = src.line; e.lineSrc = src.lineSrc || null; if (src.setAt) { e.setAt = src.setAt; e.setBy = src.setBy; } }
      if (src.qtySrc && e.qty === src.qty) e.qtySrc = src.qtySrc;
      if (e.part === String(src.part || '').trim() && String(e.clientId) === String(src.clientId)) {
        ['partNumber', 'partSrc', 'partRack', 'gaugeOptions', 'gaugeSrc', 'gaugeUnknown'].forEach(function(k) { if (src[k] != null) e[k] = src[k]; });
        if (!e.gauge && src.gauge) e.gauge = src.gauge;
      }
    }
    // A name with a code ("Assy Bracket 3302") is matched to the client's part as a register's is.
    if (e.clientId != null) prodLearnAliases([e]);
  }
  p.entries.push(prodSparse(e));
  prodTouch();
  saveState();
  if (src) {   // a correction is one entry: back to where it was opened from
    var from = f.from; _prodHand = null;
    if (from === 'power') { _prodView = 'main'; switchTab('pagePower'); }
    else prodSetView('main');
    showToast('Correction saved; the entry it corrects is kept, marked corrected', 'success');
    return;
  }
  // The form stays for the next entry: the kind, day, line, shift, client and unit carry over; the figures clear.
  f.saved.push(e.id);
  f.time = ''; f.to = ''; f.part = ''; f.qty = ''; f.rework = false;
  _pageTyped = false;
  renderProduction();
  var next = document.getElementById(f.kind === 'downtime' ? 'prodHandTime' : 'prodHandPart');
  if (next && !('ontouchstart' in window)) try { next.focus(); } catch (x) { /* focus is a convenience */ }
  showToast((f.kind === 'downtime' ? 'Power cut saved' : 'Saved') + ' · enter the next, or Done', 'success');
}

/* ---------- Void, set a line ---------- */
async function prodVoid(id) {
  var e = prodIndex().byId[id];
  if (!e || e.voidedAt) return;
  if (!grdOk('voids') && !(await guardAsk('voids', 'void a production entry'))) return;   // P1 (guard.js)
  var why = await uiPrompt({ title: 'Void this entry?', body: 'It is kept on the record, not deleted.', label: 'Why is it void?', okLabel: 'Void', required: true, requiredText: 'A void needs a reason.' });
  if (why == null) return;
  e = prodIndex().byId[id];
  if (!e || e.voidedAt) return;
  e.voidedAt = Date.now(); e.voidReason = String(why).trim(); e.voidBy = stockBy();
  prodTouch();
  saveState();
  renderProduction();
}
function prodUseLine(id, line) {
  var e = prodIndex().byId[id];
  if (!e || PROD_LINES.indexOf(line) < 0) return;
  e.line = line; e.lineSrc = 'set'; e.setAt = Date.now(); e.setBy = stockBy();
  prodTouch();
  saveState();
  renderProduction();
}

/* ---------- Import ---------- */
function prodImport() {
  if (!grdGate('imports', 'import production history', prodImport)) return;   // P1 (guard.js)
  var inp = document.getElementById('prodFileInput');
  if (!inp) return;
  inp.onchange = function(ev) {
    var file = ev.target.files[0];
    inp.value = '';
    if (!file) return;
    var rd = new FileReader();
    rd.onload = function(e2) { prodImportText(e2.target.result, file.name); };
    rd.readAsText(file);
  };
  inp.click();
}
/* A sep-production file's text, from Production's Import or from Add → File (add.js). */
function prodImportText(text, name) {
  var obj = null;
  try { obj = JSON.parse(text); } catch (err) { obj = null; }
  var res = obj ? prodMergeImport(obj, name) : { ok: false };
  if (!res.ok) { if (!addFileElsewhere(text, name, 'production')) uiNotice('Not a production file: ' + (name || ''), 'error'); return; }
  saveState();
  renderProduction();
  var causes = res.causes ? ' · ' + todoPlural(res.causes, 'power cause') + ' added to the list' : '';
  showToast(res.added ? todoPlural(res.added, 'entry', 'entries') + ' added' + (res.skipped ? ' · ' + res.skipped + ' already held' : '') + (res.unknown ? ' · ' + res.unknown + ' name a client this book does not hold' : '') + (res.bad ? ' · ' + res.bad + ' refused' : '') + causes
    : res.causes ? causes.slice(3) : 'Nothing new in that file', res.added || res.causes ? 'success' : 'warning');
}

/* ---------- Events ---------- */
function prodAction(action, btn) {
  switch (action) {
    case 'invProdTab': prodSetTab(btn.dataset.tab); _prodView = 'main'; renderProduction(); return true;
    case 'invProdStockLine': _stockItemId = btn.dataset.id; _stockView = 'item'; switchTab('pageStock'); return true;
    case 'invProdBack': {
      var wasPhoto = !!_prodPhoto;
      _prodReview = null; _prodHand = null; if (_prodPhoto) { try { URL.revokeObjectURL(_prodPhoto.url); } catch (e) { /* none */ } _prodPhoto = null; }
      prodSetView('main');
      if (wasPhoto) prodPhotoNext();   // the next photo picked with it is read, not left waiting
      return true;
    }
    case 'invProdPaste': prodSetView('paste'); return true;
    case 'invProdRead': prodReadPaste(); return true;
    case 'invProdSaveReview': prodSaveReview(); return true;
    case 'invProdRevClient': _prodReview.choices['open' + btn.dataset.key] = true; renderProduction(); return true;
    case 'invProdRevLine': _prodReview.choices['line' + btn.dataset.key] = btn.dataset.line; renderProduction(); return true;
    case 'invProdPhoto': prodPhotoPick(); return true;
    case 'invProdRunClient': _prodPhoto.choices['open' + btn.dataset.i] = true; renderProduction(); return true;
    case 'invProdPhotoNext': prodPhotoNext(); return true;
    case 'invProdStruck': _prodPhoto.choices['struck' + btn.dataset.i] = btn.dataset.v; renderProduction(); return true;
    case 'invProdSavePhoto': prodSavePhoto(); return true;
    case 'invProdHand': prodOpenHand(null); return true;
    case 'invProdCorrect': prodOpenHand(btn.dataset.id); return true;
    case 'invProdHandKind': _prodHand.kind = btn.dataset.kind; renderProduction(); return true;
    case 'invProdSaveHand': prodSaveHand(); return true;
    case 'invProdHandDone': prodHandDone(); return true;
    case 'invProdAlias': prodAliasOpen(btn.dataset.id); return true;
    case 'invProdWeighSet': prodWeighSetOpen(btn.dataset.id); return true;
    case 'invProdWeighSave': prodWeighSetSave(btn.dataset.id); return true;
    case 'invProdUnweighedAll': {
      // Every run nothing weighs, on Entries: the follow-up list (owner, 9 Oct 2026).
      prodSetTab('entries'); _prodView = 'main'; _prodEntryOpen = null; _prodFilter = { kind: '', flag: 'unweighed', client: '' };
      if (navPageOf() === 'pageProduction') renderProduction(); else switchTab('pageProduction');
      return true;
    }
    case 'invProdDayLines': {
      // From the day card (Production, Floor, Pulse): Lines on the line and the day it shows.
      var dl = btn.dataset.line;
      _prodLine = PROD_LINES.indexOf(dl) >= 0 ? dl : _prodLine || 'vat-a1';
      if (btn.dataset.day) _prodDay = btn.dataset.day;
      _prodView = 'main';
      prodSetTab('lines');
      if (navPageOf() === 'pageProduction') renderProduction(); else switchTab('pageProduction');
      return true;
    }
    case 'invProdGauge': prodGaugeOpen(btn.dataset.id); return true;
    case 'invProdGaugeSave': prodGaugeSave(btn.dataset.id); return true;
    case 'invProdAliasSave': prodAliasSave(btn.dataset.id); return true;
    case 'invProdVoid': prodVoid(btn.dataset.id); return true;
    case 'invProdEntryOpen': _prodEntryOpen = _prodEntryOpen === btn.dataset.id ? null : btn.dataset.id; keepScroll(renderProduction); return true;
    case 'invProdEntryClose': _prodEntryOpen = null; keepScroll(renderProduction); return true;
    case 'invProdUseLine': prodUseLine(btn.dataset.id, btn.dataset.line); return true;
    case 'invProdExport': prodExport(); return true;
    case 'invProdToScanner': {
      // A customer's challan photographed into the register reader: the challan scanner reads the same file.
      var f = _prodPhoto && _prodPhoto.file;
      if (_prodPhoto) { try { URL.revokeObjectURL(_prodPhoto.url); } catch (e) { /* none */ } _prodPhoto = null; }
      _prodView = 'main';
      switchTab('pageIM'); showAddChallanForm();
      if (f) _processScanImage(f, getApiKey());
      // The rest of the photos picked with it are not dropped: they wait in Production (P127).
      if (_prodPhotoQueue.length) showToast(todoPlural(_prodPhotoQueue.length, 'more register photo', 'more register photos') + ' wait in Production', 'warning');
      return true;
    }
    case 'invProdImport': prodImport(); return true;
    case 'invProdLine': _prodLine = btn.dataset.line; renderProduction(); return true;
    case 'invProdDay': {
      // From the day on screen: with none stepped to that is the last recorded day, not today.
      var base = prodLinesDay();
      _prodDay = isoAddDays(base, +btn.dataset.step);
      renderProduction(); return true;
    }
    case 'invProdDayLast': _prodDay = null; renderProduction(); return true;
    case 'invProdFilter':
      // A pressed chip on Entries lets its flag go; the Overview's "All N" always opens the loads it counts.
      if (btn.dataset.flag !== undefined) _prodFilter = { kind: '', flag: _prodTab === 'entries' && _prodFilter.flag === btn.dataset.flag ? '' : btn.dataset.flag, client: '' };
      else _prodFilter = { kind: btn.dataset.kind || '', flag: '', client: '' };
      // From another tab it is a jump to the entries it counts: no entry left open from before (QA chain, 2 Oct 2026).
      if (_prodTab !== 'entries') { prodSetTab('entries'); _prodEntryOpen = null; }
      renderProduction(); return true;
    case 'invProdTask': {
      var t = todoAppAll(PROD_RULES.map(function(r) { return r[0]; })).find(function(x) { return x.key === btn.dataset.key; });
      if (t) todoGo(t.go);
      return true;
    }
  }
  return false;
}
function prodOnChange(t) {
  if (!t) return false;
  if (t.id === 'prodPlantClient') { _prodPlantClient = t.value; renderProduction(); return true; }
  if (t.id === 'prodPhotoInput') { prodPhotoFiles(t.files); return true; }
  if (t.dataset && t.dataset.prodClient !== undefined) {
    var key = t.dataset.prodClient, v = t.value === 'asWritten' ? t.value : prodHeldId(t.value), rc = _prodReview.choices;
    var mi = +key.split(':')[0], ii = +key.split(':')[1], it = (_prodReview.msgs[mi] && _prodReview.msgs[mi].read.items[ii]) || {}, nk = it.client ? relayKey(it.client) : '';
    // A row still on the name's answer (or none yet) changes the answer for every row of that name; a row given its
    // own client keeps it, and so does a load carried from the one above, whose name was written over other loads (P127).
    var byName = nk && rc['client' + key] === undefined && !(it.issues || []).some(function(x) { return x.code === 'carried'; });
    if (t.value === '') { delete rc['client' + key]; if (byName) delete rc['name:' + nk]; }
    else if (byName) rc['name:' + nk] = v; else rc['client' + key] = v;
    renderProduction(); return true;
  }
  if (t.dataset && t.dataset.prodRunClient !== undefined) { if (t.value === '') delete _prodPhoto.choices['client' + t.dataset.prodRunClient]; else _prodPhoto.choices['client' + t.dataset.prodRunClient] = t.value === 'asWritten' ? t.value : prodHeldId(t.value); renderProduction(); return true; }
  if (t.id === 'prodPhotoLine') { _prodPhoto.choices.line = t.value; renderProduction(); return true; }
  if (t.id === 'prodPhotoDate') { _prodPhoto.choices.date = t.value; renderProduction(); return true; }
  if (t.dataset && t.dataset.prodHand) {
    var k = t.dataset.prodHand;
    _prodHand[k] = t.type === 'checkbox' ? t.checked : t.value;
    if (k === 'date' || k === 'line' || k === 'slot') renderProduction();
    return true;
  }
  if (t.id === 'prodBy') { try { localStorage.setItem(STOCK_BY_KEY, t.value.trim()); } catch (e) { /* per device */ } return true; }
  return false;
}
function prodOnInput(t) {
  if (!t) return false;
  if (t.id === 'prodPasteText') { _prodPasteDraft = t.value; return true; }
  if (t.dataset && t.dataset.prodHand && t.type !== 'checkbox') { _prodHand[t.dataset.prodHand] = t.value; return true; }
  return false;
}
