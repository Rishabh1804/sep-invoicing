/* ===== PRODUCTION — the page (Floor → Production) =====
 * Lines · In plant · Entries · Equipment, over one record (production.js). The tab map, TM4c: the Overview went (the day's
 * card and the week are Floor's Production card; the plant at a glance is the empty page's), and each view leads with its
 * verdict card and one toolbar row. What comes in is taken on Lines and Entries: Paste message the one primary, the register's
 * photo the one secondary, Enter by hand (and Entries' files) behind More (§1a-12). The sub-views (paste, review, photo, hand)
 * lead with a way back and end in the action bar, and draw no toolbar (DR-3).
 */
var _prodEntryOpen = null;   // the entry open in the desktop's pane (Entries)
var PROD_TABS = [['lines', 'Lines'], ['plant', 'In plant'], ['entries', 'Entries'], ['equipment', 'Equipment']];
var _prodTab = (function() { try { var t = localStorage.getItem('sep_inv_prod_tab'); return PROD_TABS.some(function(x) { return x[0] === t; }) ? t : 'lines'; } catch (e) { return 'lines'; } })();
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

/* A view Production can open; an old one (the Overview, a remembered tab of a build before the tab map) opens Lines. */
function prodSetTab(t) {
  if (!PROD_TABS.some(function(x) { return x[0] === t; })) t = 'lines';
  if (t !== _prodTab) _prodTabMoved = true;
  _prodTab = t;
  try { localStorage.setItem('sep_inv_prod_tab', t); } catch (e) { /* a per-device convenience only */ }
}
function prodSetView(v) { var moved = v !== _prodView; _prodView = v; renderProduction(); if (moved) viewTop(); }

function prodBackBar(title) {
  return '<div class="inv-pagehead"><button class="inv-btn inv-btn-ghost inv-btn-sm inv-pagehead-back" data-action="invProdBack">' + STOCK_BACK_ICON + 'Production</button>' +
    '<h2 class="inv-pagehead-title">' + escHtml(title) + '</h2></div>';
}
/* Lines' and Entries' toolbar (§1a-12): `lead` what the view puts first (Lines' day), `filter` its filters (Entries'), `more` its
   rows behind More after Enter by hand. On the phone the two doors are named short and More is its mark, so the row is one. */
function prodToolbarHtml(lead, more, filter) {
  var phone = !_isDesktop;
  var h = '<div class="inv-toolbar" data-prod-toolbar="' + escHtml(_prodTab) + '">' + (lead || '') +
    '<button class="inv-btn inv-btn-primary" data-action="invProdPaste">' + (phone ? 'Paste' : 'Paste message') + '</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invProdPhoto">' + (phone ? 'Read photo' : 'Read register photo') + '</button>' +
    (filter || '') + uiToolbarMoreHtml([{ label: 'Enter by hand', action: 'invProdHand' }].concat(more || []), { icon: phone }) +
    '<input type="file" accept="image/*" id="prodPhotoInput" class="inv-hidden" multiple>' +
    (_prodTab === 'entries' ? '<input type="file" accept=".json,application/json" id="prodFileInput" class="inv-hidden">' : '') + '</div>';
  // Photos picked with a challan handed to the challan scanner wait here, and are read on from here (P127).
  // What needs the owner is a row, never a callout (the tab map, §3e).
  if (_prodPhotoQueue.length) h += '<div class="inv-panel inv-panel-flush" id="prodPhotoWaiting"><div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' +
    escHtml(todoPlural(_prodPhotoQueue.length, 'register photo') + ' waiting to be read') + '</span><span class="inv-row-meta">picked with the challan sent to the scanner</span></span>' +
    uiRowEndHtml('', null, '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invProdPhotoNext">Read the next</button>') + '</div></div>';
  return h;
}
/* Nothing recorded yet: the card says so, the toolbar takes the first message, and the plant at a glance (it led the Overview). */
function prodEmptyHtml() {
  return uiVerdictHtml({ screen: 'Production', verdict: 'No production recorded yet', tone: 'neutral', key: 'pageProduction-empty',
    facts: ['paste a message, read a register photo, or import the history'], attrs: ' id="prodEmpty"' }) + prodToolbarHtml() + pltGlanceHtml();
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
    if (!PROD_TABS.some(function(t) { return t[0] === _prodTab; })) _prodTab = 'lines';
    h = '<div class="inv-viewtabs" role="tablist" aria-label="Production">' + PROD_TABS.map(function(t) {
      return '<button class="inv-viewtab" role="tab" aria-selected="' + (_prodTab === t[0]) + '" data-action="invProdTab" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';
    var p = prodData();
    // Each view draws its own verdict card and toolbar (TM4c). The plant register (plant.js) needs no production record: a unit is
    // the shop's, before anything is plated on it; In plant reads the challans, which exist without one too.
    if (_prodTab === 'equipment') h += pltEquipmentHtml();
    else if (_prodTab === 'plant') h += prodPlantHtml();
    else if (!p.entries.length) h += prodEmptyHtml();
    else if (_prodTab === 'entries') h += prodEntriesHtml();
    else h += prodLinesHtml();
  }
  paneScrollKeep(function() { el.innerHTML = h; });
  viewTabReveal(el.querySelector('.inv-viewtabs'));
  if (_prodTabMoved) { _prodTabMoved = false; viewTop(); }
}

/* ---------- Shared bits ---------- */
function prodQtyText(q, u) { if (q == null) return 'no quantity'; return (u === 'KG' ? formatNum(q, q % 1 ? 2 : 0) + ' kg' : Math.round(q).toLocaleString('en-IN') + (u ? ' ' + u : '')); }
function prodLineName(l) { return l ? PROD_LINE_LABEL[l] || l : 'Line unknown'; }
function prodEntryTitle(e) { return (e.clientId != null ? prodClientName(e.clientId) || e.client : e.client || 'No client') + (e.part ? ' · ' + e.part : ''); }
function prodSrcWord(e) { return { paste: 'message', photo: 'register photo', hand: 'by hand', 'import': 'history', face: 'face' }[e.src] || e.src || ''; }

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
  if (!date) return uiHeroHtml({ tone: 'neutral', vital: !!opts.vital, eyebrow: '<span>' + escHtml(opts.label || 'Plated') + '</span>', fig: opts.vital ? '&mdash;' : '', title: 'No plating on record yet', attrs: attrs, fold: opts.fold, foot: foot('') });
  // Pulse shows the last day on record: how long ago it was is said, and a record days behind is amber (it has stopped).
  var lag = opts.compact ? isoDaysBetween(date, localDateStr()) : 0;
  var pic = prodDayPicture(date), when = opts.when || attDayName(date) + ' ' + formatDate(date) + (isToday ? ' · so far' : lag === 1 ? ' · yesterday' : lag > 1 ? ' · ' + lag + ' days ago' : '');
  var eyebrow = '<span>' + escHtml(opts.label || 'Plated') + '</span><span class="inv-panel-count">' + escHtml(when) + '</span>';
  if (!pic.runs) {
    return uiHeroHtml({ tone: pic.missing.length ? 'warning' : 'neutral', vital: !!opts.vital, fig: opts.vital ? '&mdash;' : '', eyebrow: eyebrow, attrs: attrs, fold: opts.fold, foot: foot(''),
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
  // Floor's Overview names the worst line, as its line cards lead with it (the tab map, §1a-1): its tone and its words.
  if (opts.lead) { worse(opts.lead.tone); title = opts.lead.title; }
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
  // On Floor's Overview the pieces nothing weighs are its own list, under the line cards (opts.floor): not listed here as well.
  var body = '<div class="inv-hero-sheet" data-prod-day-sheet>' + prodDayLinesHtml(pic, opts.compact) + prodDayWeighHtml(pic, opts.compact, opts.floor) + (opts.compact ? '' : prodDayMoreHtml(pic)) + '</div>';
  return uiHeroHtml({ tone: tone, vital: !!opts.vital, eyebrow: eyebrow, title: escHtml(title), fig: escHtml(fig), sub: escHtml(sub), viz: viz, body: body,
    open: opts.open !== false, fold: opts.fold, attrs: attrs, foot: foot(opts.lead ? opts.lead.line : pic.ran[0]) });
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
function prodUnweighedRowsHtml(names) { return prodUnweighedRows(names).join(''); }
function prodUnweighedRows(names) {
  var may = typeof grdOk !== 'function' || grdOk('floor');
  return names.map(function(n) {
    return '<div class="inv-row inv-row-2 inv-row-flow" data-prod-weigh="none"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(n.part || 'No part written') + '</span>' +
      '<span class="inv-row-meta">' + escHtml([n.client, n.lines && n.lines.length ? n.lines.map(prodLineName).join(', ') : ''].filter(Boolean).join(' · ')) + '</span></span>' +
      '<span class="inv-row-end inv-row-actions"><span class="inv-num">' + escHtml(Math.round(n.pieces).toLocaleString('en-IN') + ' pcs') + '</span>' +
      (may && n.clientId != null && n.id && n.part ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invProdAlias" data-id="' + escHtml(n.id) + '">Which part?</button>' +
        '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invProdWeighSet" data-id="' + escHtml(n.id) + '">Set its weight</button>' : '') + '</span></div>';
  });
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
function prodDayWeighHtml(pic, compact, noNames) {
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
  if (pic.names.length && !noNames) h += '<div class="inv-row-group"><span>' + escHtml('Not weighed · ' + Math.round(pic.unweighed).toLocaleString('en-IN') + ' pcs') + '</span></div>' + prodUnweighedRowsHtml(pic.names) +
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
  var wk = prodPlatedSummary(attWeekStartOf(pic.date), pic.date), wo = pic.worth;
  // The day's earnings against what its kilos cost (owner, 10 Oct 2026: "As we are calculating production, why don't we calculate
  // the earnings?"): the live cost over the 90 days to the day, on the kilos of the runs priced, so what was left is read over the
  // same runs as what they earned; the work no rate prices is listed to follow up.
  var ref = money && wo.kg > 0 ? prodCostRef(pic.date) : null, cost = ref ? gstRound(ref.perKg * wo.kg) : null, real = wo.kg > 0 ? wo.amountKg / wo.kg : null;
  var notPriced = wo.unpriced ? Math.round(wo.unpriced).toLocaleString('en-IN') + ' pcs' : '', notPricedKg = wo.unpricedKg ? formatNum(wo.unpricedKg, 0) + ' kg' : '';
  var mayRates = (typeof grdCan !== 'function' || grdCan('rates')) && (typeof grdSees !== 'function' || grdSees('pageClients'));
  // The week to the day against the same days of the four weeks before (the three lines together), in kilos and in earnings, a
  // recorded day's average on each side: a day with no record is a gap, never a zero.
  var w4 = prodLineWeek(null, pic.date), w4kg = w4 && w4.cur.days && w4.kgDayBefore != null && w4.cur.kg > 0, w4rs = money && w4 && w4.cur.worthDays && w4.worthDayBefore != null && w4.cur.worth > 0;
  h += '<div class="inv-row-group"><span>The day</span></div>' + [
    money && wo.runs ? { label: 'Work plated, worth', sub: 'clients’ rates, before GST' + (wo.unpriced ? ' · ' + Math.round(wo.unpriced).toLocaleString('en-IN') + ' pcs unpriced' : ''),
      value: (wo.est ? '≈ ' : '') + formatCurrency(wo.amount), attrs: ' data-prod-day-worth' } : null,
    cost != null ? { label: 'At the live cost', sub: formatCurrency(ref.perKg) + ' a kg × ' + prodKgFig(wo.kg, false) + (ref.live ? ', 90 days' : ', the full cost typed'), value: formatCurrency(cost), attrs: ' data-prod-day-cost' } : null,
    cost != null ? { label: 'Left after it', sub: formatCurrency(real) + ' a kg earned' + (wo.kg > 0 && wo.amountKg < wo.amount - 0.005 ? ' · piece work nothing weighs left out' : ''),
      value: (wo.est ? '≈ ' : '') + formatCurrency(gstRound(wo.amountKg - cost)), tone: figToneAgainst(real, ref.perKg, 5), attrs: ' data-prod-day-left' } : null,
    wages && pic.labour > 0 ? { label: 'Labour on the record', sub: money && wo.amount > 0 ? Math.round(pic.labour / wo.amount * 100) + '% of the work’s worth' : '', value: formatCurrency(pic.labour), attrs: ' data-prod-day-labour' } : null,
    { label: 'Power cuts', sub: pic.cuts.length ? pic.cuts.map(function(c) { return relayClockLabel(c.from) + (c.to != null ? ' – ' + relayClockLabel(c.to) : ''); }).join(', ') + (open ? ' · ' + open + ' with no time back' : '') : '',
      value: pic.cuts.length ? powerDur(mins) + ' dark' : 'none', attrs: ' data-prod-day-cuts' },
    { label: 'Pickling loads', value: pic.loads || 'none', attrs: ' data-prod-day-loads' },
    wk ? { label: 'The week, against capacity', sub: prodKgFig(wk.kg, wk.est > 0.0005) + ' on ' + todoPlural(wk.days, 'complete day'), value: Math.round(wk.perDay / wk.capacity * 100) + '%', attrs: ' data-prod-day-week' } : null,
    w4kg ? { label: 'This week, a day plated', sub: prodKgFig(w4.cur.kgDay, w4.cur.est, w4.cur.weighed < 0.9) + ' on ' + todoPlural(w4.cur.days, 'day') + ' · the ' + w4.kgWeeks + ' weeks before ' + prodKgFig(w4.kgDayBefore, true),
      value: w4.cur.weighed >= 0.9 ? figDeltaPct(w4.cur.kgDay, w4.kgDayBefore) : 'reads low',
      tone: w4.cur.weighed >= 0.9 ? figDeltaTone(w4.cur.kgDay, w4.kgDayBefore, 'up') : null, attrs: ' data-prod-day-week4' } : null,
    w4rs ? { label: 'This week, a day earned', sub: (w4.cur.worthEst ? '≈ ' : '') + finRs(w4.cur.worthDay) + ' on ' + todoPlural(w4.cur.worthDays, 'day') + ' · the ' + w4.worthWeeks + ' weeks before ' + finRs(w4.worthDayBefore),
      value: w4.cur.priced >= 0.9 ? figDeltaPct(w4.cur.worthDay, w4.worthDayBefore) : 'reads low',
      tone: w4.cur.priced >= 0.9 ? figDeltaTone(w4.cur.worthDay, w4.worthDayBefore, 'up') : null, attrs: ' data-prod-day-week4-rs' } : null
  ].filter(Boolean).map(uiFactRowHtml).join('');
  // Not priced: each floor name with its client and what it holds, and the door to the client's rates (a rate-card change).
  if (money && wo.names.length) h += uiFoldRowHtml('prod-day-unpriced', { label: 'Not priced', sub: 'no rate on record for the part', value: [notPriced, notPricedKg].filter(Boolean).join(' + ') }, wo.names.slice(0, 8).map(function(n) {
    return { label: n.part || 'No part written', sub: n.client, value: [n.pieces ? Math.round(n.pieces).toLocaleString('en-IN') + ' pcs' : '', n.kg ? formatNum(n.kg, 0) + ' kg' : ''].filter(Boolean).join(' + '), attrs: ' data-prod-unpriced',
      actions: mayRates && n.clientId != null ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invEditClient" data-id="' + escHtml(String(n.clientId)) + '">Rates</button>' : '' };
  }).concat(wo.names.length > 8 ? [{ label: todoPlural(wo.names.length - 8, 'more part'), value: '' }] : []), ' data-prod-day-unpriced');
  return h;
}

/* ---------- What the Overview held, at the head of the views that use it (the tab map, TM4c) ---------- */
/* Plated by line, four weeks, kilograms a day: Lines' head, shut. A day not recorded, or under 90% weighed, is a gap, never a zero
   (the guide says why). */
function prodChartHtml() {
  var today = localDateStr(), from = isoAddDays(today, -27);
  var labels = [], series = PROD_LINES.map(function(l) { return { label: PROD_LINE_LABEL[l], values: [] }; });
  for (var d = from; d <= today; d = isoAddDays(d, 1)) {
    if (new Date(d + 'T00:00:00').getDay() === 0) continue;
    labels.push(stockShortDate(d));
    PROD_LINES.forEach(function(l, i) { var r = prodDayLine(d, l); series[i].values.push(r.entries.length && r.weighedShare >= 0.9 ? Math.round(r.kg) : null); });
  }
  return '<div class="inv-panel inv-panel-flush" id="prodChart"><div class="inv-panel-head"><span class="inv-panel-title">Plated by line, 4 weeks</span></div>' +
    '<div class="inv-panel-body">' + chartLines(labels, series, { unit: 'kg', ariaLabel: 'Plated by line', emptyText: 'No plated day in four weeks with nine tenths of its pieces weighed' }) + '</div></div>';
}
/* The record's coverage, four weeks: Entries' head. A line with gaps reads low wherever its record is read. */
function prodCoverageHtml() {
  var today = localDateStr(), cov = prodCoverage(isoAddDays(today, -27), today);
  return '<div class="inv-panel inv-panel-flush" id="prodCoverage"><div class="inv-panel-head"><span class="inv-panel-title">Record coverage, 4 weeks</span></div>' +
    PROD_LINES.map(function(l) {
      var c = cov[l], ok = c.share >= PROD_COVER_OK;
      return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + PROD_LINE_LABEL[l] + '</span><span class="inv-row-meta">' +
        (c.last ? 'last recorded ' + escHtml(stockShortDate(c.last)) : 'never recorded') + '</span></span><span class="inv-row-end inv-row-end-stack"><span class="inv-num">' + c.days + ' of ' + c.of + '</span>' +
        '<span class="inv-dot inv-dot-' + (ok ? 'ok' : 'warning') + '">' + (ok ? 'Recorded' : 'Gaps') + '</span></span></div>';
    }).join('') + '</div>';
}
/* The pickled loads of four weeks whose line is not known: Entries' head, what needs the owner, each with the usual line to use. */
function prodUnknownLoads() {
  var idx = prodIndex(), from = isoAddDays(localDateStr(), -27);
  return idx.live.filter(function(e) { return e.kind === 'pickled' && !idx.replaced[e.id] && e.date >= from && prodLoadLine(e).how === 'unknown'; });
}
function prodUnknownHtml(unknown) {
  if (!unknown.length) return '';
  return '<div class="inv-panel inv-panel-flush" id="prodUnknown"><div class="inv-panel-head"><span class="inv-panel-title">Line unknown</span><span class="inv-panel-count">' + unknown.length + '</span></div>' +
    // The latest three, each with its line to use; the rest are Entries' own flag, one tap away.
    unknown.slice(-3).reverse().map(prodLoadRowHtml).join('') +
    (unknown.length > 3 ? '<div class="inv-row"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invProdFilter" data-flag="unknown" data-set>All ' + unknown.length + '</button></div>' : '') + '</div>';
}

/* A pickled load: two facts (when, how much), and its line at the end: as written, from plating, set, or unknown with its usual line
   to use (one action). */
function prodLoadRowParts(e) {
  var L = prodLoadLine(e), m = prodIndex().match[e.id];
  var lineTxt = L.line ? prodLineName(L.line) + (L.how === 'plating' ? ', from plating' : L.how === 'set' ? ', set by you' : '') : L.how === 'split' ? 'Split: ' + L.lines.map(prodLineName).join(' + ') : 'Line unknown';
  var qty = e.qty != null ? prodQtyText(e.qty, e.unit) : (m && m.qty != null ? '~' + prodQtyText(m.qty, e.unit) + ' from plating' : 'no quantity');
  var main = '<span class="inv-row-title">' + escHtml(prodEntryTitle(e)) + '</span>' +
    '<span class="inv-row-meta">' + escHtml(stockShortDate(e.date) + (e.time ? ' ' + e.time : '') + ' · ' + qty) + '</span>';
  var end = L.how === 'unknown' && L.hint ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invProdUseLine" data-id="' + escHtml(e.id) + '" data-line="' + L.hint.line + '" title="' + escHtml('Usually ' + prodLineName(L.hint.line) + ' (' + L.hint.days + ' of ' + L.hint.total + ' days)') + '">Use ' + escHtml(prodLineName(L.hint.line)) + '</button>'
    : '<span class="inv-dot inv-dot-' + (L.how === 'unknown' ? 'warning' : 'neutral') + '">' + escHtml(lineTxt) + '</span>';
  return { main: main, end: '<span class="inv-row-end">' + end + '</span>' };
}
function prodLoadRowHtml(e) {
  var r = prodLoadRowParts(e);
  return '<div class="inv-row inv-row-2 inv-row-flow" data-prod-entry="' + escHtml(e.id) + '"><span class="inv-row-main">' + r.main + '</span>' + r.end + '</div>';
}
/* An entry's row that opens to what it holds and what can be done to it, on both layouts: Lines' runs and loads (owner, 10 Oct 2026:
   a past day is checked on Floor → Day, "but corrections and comparisons are missing"; a run there had nothing to tap). `main` and
   `end` are the row as its screen draws it, `omit` the action already at its end; the fold is Entries' phone row's (prodEntryKv,
   prodEntryMoreHtml, prodEntryActionsHtml). */
function prodEntryFoldRowHtml(e, idx, main, end, muted, omit) {
  var key = 'prod-entry-' + e.id, acts = prodEntryActionsHtml(e, idx, omit);
  return '<details class="inv-row-fold" data-fold="' + escHtml(key) + '" data-prod-entry="' + escHtml(e.id) + '"' + (uiFoldOpen(key, false) ? ' open' : '') + '>' +
    '<summary class="inv-row inv-row-2' + (muted || e.voidedAt ? ' inv-row-muted' : '') + '"><span class="inv-row-main">' + main + '</span>' + end + '</summary>' +
    '<div class="inv-row-children"><div class="inv-panel-body">' + prodKvHtml(prodEntryKv(e)) + prodEntryMoreHtml(e, idx) + '</div>' +
    (acts ? '<div class="inv-row-actions" data-row-more>' + acts + '</div>' : '') + '</div></details>';
}

/* ---------- In plant ---------- */
/* In plant (the tab map, TM4c): its verdict card (what is open on the book, what was plated and not invoiced; the four figures its
   factors, each caveat a badge on the figure it qualifies), its filter, then what needs the owner first (material on the floor with
   no challan open, plating not invoiced past its days, lines no weight can be set against), then each client's open challan lines,
   two facts a line and the rest in its fold. How the floor's figures are worked out is the guide's (Using the app: production). */
function prodPlantHtml() {
  var plant = prodInPlant({ clientId: _prodPlantClient || null });
  var clients = {};
  (S.incomingMaterial || []).forEach(function(m) { clients[m.clientId] = true; });
  var sum = { pni: { NOS: 0, KG: 0 }, pnp: { NOS: 0, KG: 0 }, wait: { NOS: 0, KG: 0 } };
  plant.rows.forEach(function(x) { sum.pni[x.unit] += x.platedNotInvoiced; sum.pnp[x.unit] += x.pickledNotPlated; sum.wait[x.unit] += x.waiting; });
  var q = function(o) { var t = []; if (o.NOS) t.push(Math.round(o.NOS).toLocaleString('en-IN') + ' NOS'); if (o.KG) t.push(formatNum(o.KG, 1) + ' kg'); return t.join(' + ') || '0'; };
  var cov = PROD_LINES.reduce(function(a, l) { a.days += plant.coverage[l].days; a.of += plant.coverage[l].of; return a; }, { days: 0, of: 0 });
  var covPct = cov.of ? Math.round(cov.days / cov.of * 100) : 0;
  var noQty = prodIndex().live.filter(function(e) { return e.kind === 'pickled' && e.qty == null && e.date >= plant.since; }).length;
  var late = (typeof todoApp === 'function' ? todoApp(['prodPlatedUnbilled']) : []).filter(function(t) { return !_prodPlantClient || String(t.clientId) === String(_prodPlantClient); });
  var pniAny = sum.pni.NOS || sum.pni.KG, arrived = Object.keys(plant.arrived).length;
  var tone = late.some(function(t) { return t.tone === 'red'; }) ? 'danger' : late.length || plant.noChallan.length ? 'warning' : 'ok';
  var h = uiVerdictHtml({ screen: 'In plant' + (_prodPlantClient ? ' · ' + (prodClientName(_prodPlantClient) || 'Client ' + _prodPlantClient) : ''), tone: tone,
    // The book's rupees are every role's, as they were before the tab map: the guard's money is the bank's and what is owed (QA4-4).
    verdict: finRs(plant.book) + ' open' + (pniAny ? ', ' + q(sum.pni) + ' plated, not invoiced' : ', nothing plated waiting'),
    facts: [plant.noChallan.length ? todoPlural(plant.noChallan.length, 'part') + ' on the floor with no challan' : '',
      plant.famUsed ? todoPlural(plant.famUsed, 'entry', 'entries') + ' matched by kind and gauge' : '', arrived ? todoPlural(arrived, 'part') + ' with arrivals messaged' : ''],
    factors: [
      { label: 'Book', fig: escHtml(formatCurrency(plant.book)), sub: 'open on challans, not invoiced', attrs: ' data-prod-tile="plantBook"' },
      { label: 'Plated, not invoiced', fig: escHtml(q(sum.pni)), tone: pniAny ? (late.length ? (tone === 'danger' ? 'danger' : 'warning') : 'info') : null, sub: 'at least: plating recorded', attrs: ' data-prod-tile="plantPni"' },
      { label: 'Pickled, not plated', fig: escHtml(q(sum.pnp)), badge: noQty ? ['neutral', '≥'] : null, sub: noQty ? todoPlural(noQty, 'load') + ' with no quantity left out' : 'loads with a quantity', attrs: ' data-prod-tile="plantPnp"' },
      { label: 'Waiting to pickle', fig: plant.floorOk ? escHtml(q(sum.wait)) : '', badge: plant.floorOk ? null : ['warning', 'withheld'],
        sub: plant.floorOk ? 'on open challans, not on the floor yet' : covPct + '% of line-days recorded', attrs: ' data-prod-tile="plantWait"' }],
    attrs: ' id="prodPlantVerdict"' });
  h += '<div class="inv-toolbar" data-prod-toolbar="plant"><select id="prodPlantClient" class="inv-select inv-select-sm" aria-label="Client"><option value="">All clients</option>' +
    Object.keys(clients).map(function(id) { return '<option value="' + escHtml(id) + '"' + (String(_prodPlantClient) === String(id) ? ' selected' : '') + '>' + escHtml(prodClientName(id) || 'Client ' + id) + '</option>'; }).join('') + '</select></div>';

  // What needs the owner, first and in its tone.
  var needs = '';
  if (plant.noChallan.length) {
    needs += '<div id="prodNoChallan"><div class="inv-row-group"><span>On the floor, no challan open</span><span class="inv-num">' + plant.noChallan.length + '</span></div>' +
      uiMoreHtml('prod-nochallan', plant.noChallan.map(function(x) {
        return '<div class="inv-row inv-row-2" data-prod-nochallan><span class="inv-row-main"><span class="inv-row-title">' + escHtml((x.clientId != null ? prodClientName(x.clientId) : x.client || 'No client') + (x.part ? ' · ' + x.part : '')) + '</span>' +
          '<span class="inv-row-meta">' + escHtml((x.L && x.P ? 'pickled and plated' : x.field === 'L' ? 'plated' : 'pickled') + ' from ' + stockShortDate(x.oldest)) + '</span></span>' +
          uiRowEndHtml(escHtml(prodQtyText(x.qty, x.unit)), { tone: 'warning', word: 'No challan' }) + '</div>';
      }), { n: 5, noun: 'parts' }) + '</div>';
  }
  if (late.length) {
    needs += '<div id="prodPlatedLate"><div class="inv-row-group"><span>Plated, not invoiced</span><span class="inv-num">' + late.length + '</span></div>' + late.map(function(t) {
      return '<div class="inv-row inv-row-2" data-prod-late="' + escHtml(String(t.clientId)) + '"><button class="inv-row-main" data-action="invProdTask" data-key="' + escHtml(t.key) + '">' +
        '<span class="inv-row-title">' + escHtml(t.title) + '</span><span class="inv-row-meta">' + escHtml(t.sub || '') + '</span></button>' +
        uiRowEndHtml('', { tone: t.tone === 'red' ? 'danger' : 'warning', word: t.tone === 'red' ? 'Late' : 'Due' }) + '</div>';
    }).join('') + '</div>';
  }
  if (plant.unweighed) {
    needs += '<div class="inv-row inv-row-2" data-prod-unweighed><span class="inv-row-main"><span class="inv-row-title">' + escHtml(todoPlural(plant.unweighed, 'open line') + ' (' + formatNum(plant.unweighedKg, 1) + ' kg) with no kg a piece') + '</span>' +
      '<span class="inv-row-meta">' + escHtml('set the weight on the client’s card') + '</span></span>' + uiRowEndHtml('', { tone: 'warning', word: 'Not counted' }) + '</div>';
  }
  if (needs) h += '<div class="inv-panel inv-panel-flush" id="prodPlantNeeds"><div class="inv-panel-head"><span class="inv-panel-title">To look at</span></div>' + needs + '</div>';

  var byClient = {};
  plant.rows.forEach(function(x) { (byClient[x.r.m.clientId] = byClient[x.r.m.clientId] || []).push(x); });
  var ids = Object.keys(byClient).sort(function(a, b) { return prodClientName(a).localeCompare(prodClientName(b)); });
  h += '<div class="inv-panel inv-panel-flush" id="prodPlantList"><div class="inv-panel-head"><span class="inv-panel-title">Open challan lines</span><span class="inv-panel-count">' + plant.rows.length + '</span></div>';
  if (!ids.length) h += '<div class="inv-empty">Nothing open on the challans.</div>';
  // A client is one row that opens to its lines (its open quantity and its first stage as two facts, what is open at its end),
  // plated and not invoiced first: a book of many challans drew every line (thirteen phone screens on the long book). One client
  // on screen (the filter) is its lines.
  var rank = function(x) { return x.platedNotInvoiced > 0 ? 0 : x.pickledNotPlated > 0 ? 1 : 2; };
  ids.forEach(function(cid) {
    var list = byClient[cid].slice().sort(function(a, b) { return rank(a) - rank(b); }), amt = list.reduce(function(s2, x) { return s2 + x.amount; }, 0), open = { NOS: 0, KG: 0 }, worked = 0;
    list.forEach(function(x) { open[x.unit] += x.open; if (x.derived) worked++; });
    var nP = list.filter(function(x) { return x.platedNotInvoiced > 0; }).length, nK = list.filter(function(x) { return x.pickledNotPlated > 0; }).length;
    var name = prodClientName(cid) || 'Client ' + cid, lines = list.map(prodPlantRowHtml).join('');
    var meta = q(open) + (worked ? ' (' + worked + ' worked out from kg)' : '') + ' · ' + (nP ? nP + ' plated, not invoiced' : nK ? nK + ' pickled' : todoPlural(list.length, 'line'));
    if (ids.length === 1) { h += '<div class="inv-row-group" data-prod-plant-client="' + escHtml(cid) + '"><span>' + escHtml(name) + '</span><span class="inv-num">' + escHtml(formatCurrency(amt)) + '</span></div>' + lines; return; }
    var key = 'prod-plant-c-' + cid;
    h += '<details class="inv-row-fold" data-fold="' + escHtml(key) + '" data-prod-plant-client="' + escHtml(cid) + '"' + (uiFoldOpen(key, false) ? ' open' : '') + '>' +
      '<summary class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(name) + '</span><span class="inv-row-meta">' + escHtml(meta) + '</span></span>' +
      uiRowEndHtml(escHtml(formatCurrency(amt)), nP ? { tone: 'warning', word: 'Plated' } : nK ? { tone: 'info', word: 'Pickled' } : null) + '</summary>' +
      '<div class="inv-row-children">' + lines + '</div></details>';
  });
  return h + '</div>';
}
/* An open challan line (§3b-11): what it is, its challan and what came in as two facts, what is open at its end in the stage's tone;
   opened, how it stands stage by stage, a fact a row. */
function prodPlantRowHtml(x) {
  var u = x.unit, id = String(x.r.it.id || x.r.m.id + ':' + x.r.it.partNumber), key = 'prod-plant-' + id;
  var st = x.platedNotInvoiced > 0 ? ['warning', 'Plated, not invoiced'] : x.pickledNotPlated > 0 ? ['info', 'Pickled'] : x.floorRecorded ? ['neutral', 'Waiting'] : ['neutral', 'No floor record'];
  var facts = [
    { label: 'Received', value: prodQtyText(x.R, u), sub: x.derived ? prodQtyText(x.r.R.KG, 'KG') + ' ≈ ' + prodQtyText(x.R, u) + ' at ' + String(parseFloat(x.kpp.kg.toFixed(4))) + ' kg/pc (' + x.kpp.src + ')' : '' },
    { label: 'Invoiced', value: prodQtyText(x.I, u) },
    { label: 'Plated', value: prodQtyText(Math.min(x.R, x.L), u) },
    x.P ? { label: 'Pickled', value: prodQtyText(Math.min(x.R, x.P), u) } : null,
    { label: 'Open', value: prodQtyText(x.open, u) }];
  return '<details class="inv-row-fold" data-fold="' + escHtml(key) + '" data-prod-plant="' + escHtml(x.r.it.id || '') + '"' + (uiFoldOpen(key, false) ? ' open' : '') + '>' +
    '<summary class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(lineLabel(x.r.it)) + '</span>' +
    '<span class="inv-row-meta">' + escHtml('Challan ' + (x.r.m.challanNo || '?') + ', ' + stockShortDate(x.r.date) + ' · received ' + (x.derived ? '≈ ' : '') + prodQtyText(x.R, u)) + '</span></span>' +
    uiRowEndHtml(escHtml(prodQtyText(x.open, u)), { tone: st[0], word: st[1] }) + '</summary>' +
    '<div class="inv-row-children">' + facts.filter(Boolean).map(uiFactRowHtml).join('') + '</div></details>';
}

/* ---------- Lines ---------- */
/* The line's last recorded day, and the day Lines shows: the one stepped to, else that day, else today. */
function prodLinesLastDay(line) {
  var days = prodIndex().live.filter(function(e) { return line === 'pickling' ? e.kind === 'pickled' : e.kind === 'plated' && e.line === line; }).map(function(e) { return e.date; }).sort();
  return days[days.length - 1] || null;
}
function prodLinesDay() { return _prodDay || prodLinesLastDay(_prodLine) || localDateStr(); }
/* Lines (the tab map, TM4c): the line's verdict for the day (its efficiency, judged as Floor's line card judges it; the plated,
   pieces, rounds and cuts its factors, and how the efficiency splits under them), one toolbar row (the day, what comes in, More),
   the line's switch; plated by line over four weeks at the head, shut; the day's runs; the week, each day in its efficiency's tone;
   what went into the bath; labour by line against the model. What each figure is made of is the guide's (Using the app: production). */
function prodLinesHtml() {
  var idx = prodIndex(), line = _prodLine, day = prodLinesDay(), phone = !_isDesktop, last = prodLinesLastDay(line);
  // The phone's row has no room for the day's name beside the doors: the card above names it.
  var lead = _attStepInRow('invProdDay', phone ? '' : '<span class="inv-stepper-title">' + escHtml(attDayName(day) + ' ' + formatDate(day)) + '</span>', 'Day before', 'Day after') +
    (phone ? '' : '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invProdDayLast"' + (!last || day === last ? ' disabled' : '') + '>Last recorded</button>');
  var h = prodLinesVerdictHtml(line, day) + prodToolbarHtml(lead, (phone && last && day !== last ? [{ label: 'Go to the last recorded day', action: 'invProdDayLast' }] : [])
      .concat([{ label: 'Every entry of this day', action: 'invProdDayEntries' }])) +
    '<div class="inv-seg inv-mb-8" role="group" aria-label="Line" data-prod-line-switch>' + PROD_LINES.concat(['pickling']).map(function(l) {
      return '<button type="button" class="inv-seg-btn" data-action="invProdLine" data-line="' + l + '" aria-pressed="' + (line === l) + '">' + (l === 'pickling' ? 'Pickling' : PROD_LINE_LABEL[l]) + '</button>';
    }).join('') + '</div>';
  h += uiFoldCard('prod-chart', prodChartHtml(), false);
  if (line === 'pickling') {
    var loads = prodDayLoads(day);
    return h + '<div class="inv-panel inv-panel-flush" id="prodLoads"><div class="inv-panel-head"><span class="inv-panel-title">Pickled</span><span class="inv-panel-count">' + loads.length + '</span></div>' +
      (loads.length ? loads.map(function(e) { var r = prodLoadRowParts(e); return prodEntryFoldRowHtml(e, idx, r.main, r.end); }).join('') : '<div class="inv-empty">No pickling recorded this day.</div>') + '</div>';
  }
  var r = prodDayLine(day, line);
  var groups = { general: [], ot: [] };
  r.entries.forEach(function(e) { groups[e.slot === 'ot' ? 'ot' : 'general'].push(e); });
  var also = idx.also.filter(function(e) { return e.date === day && e.line === line; });
  h += '<div class="inv-panel inv-panel-flush" id="prodRuns"><div class="inv-panel-head"><span class="inv-panel-title">Runs</span>' +
    (r.entries.length ? '<span class="inv-panel-count">' + r.entries.length + '</span>' : '') + '</div>';
  if (!r.entries.length && !also.length) h += '<div class="inv-empty">No plating recorded on ' + escHtml(PROD_LINE_LABEL[line]) + ' this day: a gap, not a zero.</div>';
  ['general', 'ot'].forEach(function(g) {
    if (!groups[g].length) return;
    h += '<div class="inv-row-group"><span>' + (g === 'ot' ? 'Overtime' : 'General shift') + '</span></div>';
    groups[g].forEach(function(e) { h += prodRunRowHtml(e, false); });
  });
  // One record counts per shift; the others count the same work another way and are never added (the guide says how).
  if (also.length) { h += '<div class="inv-row-group"><span>Also reported, not added</span></div>'; also.forEach(function(e) { h += prodRunRowHtml(e, true); }); }
  h += '</div>';
  // The pay week around the day: what each line plated, a dash where nothing was recorded, each figure in its day's efficiency's tone.
  var ws = attWeekStartOf(day), wd = [];
  for (var k = 0; k < 7; k++) wd.push(isoAddDays(ws, k));
  h += '<div class="inv-panel inv-panel-flush" id="prodWeek"><div class="inv-panel-head"><span class="inv-panel-title">The week, plated</span><span class="inv-panel-count">kg</span></div><div class="inv-scroll-x"><table class="inv-table"><thead><tr><th class="inv-col-grow">Line</th>' +
    wd.map(function(d) { return '<th class="inv-num">' + escHtml(new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    PROD_LINES.map(function(l) {
      return '<tr><td>' + escHtml(PROD_LINE_LABEL[l]) + '</td>' + wd.map(function(d) {
        var x = prodDayLine(d, l);
        if (!x.entries.length) return '<td class="inv-num">&mdash;</td>';
        var ef = prodLineEfficiency(d, l), t = ef.eff != null ? ef.tone : null;
        var txt = (x.kg > 0 ? (x.est > 0.0005 ? '≈ ' : '') + formatNum(x.kg, 0) : '') + (x.unweighed ? (x.kg > 0 ? ' + ' : '') + Math.round(x.unweighed).toLocaleString('en-IN') + ' pcs' : '');
        return '<td class="inv-num"' + (ef.eff != null ? ' title="' + escHtml(ef.word) + '"' : '') + '>' + figHtml(escHtml(txt), t === 'neutral' ? null : t) + '</td>';
      }).join('') + '</tr>';
    }).join('') + prodWeekEarnedRowHtml(wd) + '</tbody></table></div></div>';
  h += uiFoldCard('prod-line-stock', prodLineStockHtml(line), false);
  // Labour per kg is the wage bill per kilo: a role without the wages sees no line's (guard.js; the QA audit, QA4-3).
  if (typeof grdSeesWages === 'function' && !grdSeesWages()) return h;
  var lab = prodLabourByLine(isoAddDays(localDateStr(), -29), localDateStr()), L = lab.lines[line], model = labourCfg().modelPerKg || 3.55;
  var lt = L.perKg != null ? figToneAgainst(L.perKg, model, 5, true) : null;
  h += '<div class="inv-panel inv-panel-flush" id="prodLabour"><div class="inv-panel-head"><span class="inv-panel-title">Labour per kg, 30 days</span></div>' +
    '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(PROD_LINE_LABEL[line]) + '</span><span class="inv-row-meta">' +
    escHtml(L.perKg != null ? todoPlural(L.days, 'day') + ' recorded · against the model ₹' + formatNum(model, 2) : todoPlural(L.days, 'day') + ' recorded · withheld under five') + '</span></span>' +
    '<span class="inv-row-end inv-num">' + (L.perKg != null ? figHtml(escHtml('₹' + formatNum(L.perKg, 2) + '/kg'), lt) : '&mdash;') + '</span></div></div>';
  return h;
}
/* The week's earnings, the three lines together, a day a cell (prodDayWorth at the rates on record, "≈" where a weight is
   estimated), each day's cell in its rupee a kilo's tone against what a kilo costs; a day with plating and nothing priced is a
   dash. To a role that sees money. */
function prodWeekEarnedRowHtml(days) {
  if (typeof grdSeesMoney === 'function' && !grdSeesMoney()) return '';
  var any = false, cells = days.map(function(d) {
    var amt = 0, est = false, runs = 0, kg = 0, amtKg = 0, ran = false;
    PROD_LINES.forEach(function(l) { var x = prodLineDaySum(d, l); if (x.runs) ran = true; amt += x.worth; est = est || x.worthEst; runs += x.priced; kg += x.kgPriced; amtKg += x.amountKg; });
    if (!ran) return '<td class="inv-num">&mdash;</td>';
    if (!runs) return '<td class="inv-num" title="Nothing priced: no rate on record">&mdash;</td>';
    any = true;
    var ref = kg > 0 ? prodCostRef(d) : null, t = ref ? figToneAgainst(amtKg / kg, ref.perKg, 5) : null;
    return '<td class="inv-num"' + (kg > 0 ? ' title="' + escHtml(formatCurrency(amtKg / kg) + ' a kg' + (ref ? ' against a cost of ' + formatCurrency(ref.perKg) : '')) + '"' : '') + '>' +
      figHtml(escHtml((est ? '≈ ' : '') + finRs(amt)), t) + '</td>';
  });
  return any ? '<tr data-prod-week-earned><td>Earned</td>' + cells.join('') + '</tr>' : '';
}
/* A line's verdict for the day (§3e): its efficiency as Floor's line card judges it (prodLineEfficiency, flrEffHead's words), what it
   plated, the pieces, the rounds and the cuts its factors; how the efficiency splits (flrEffRowHtml) under them. Pickling: its loads. */
function prodLinesVerdictHtml(line, day) {
  var isToday = day === localDateStr(), when = attDayName(day) + ' ' + stockShortDate(day) + (isToday ? ', today' : '');
  if (line === 'pickling') {
    var loads = prodDayLoads(day), unknown = loads.filter(function(e) { return prodLoadLine(e).how === 'unknown'; }).length;
    return uiVerdictHtml({ screen: 'Pickling · ' + when, tone: !loads.length ? 'neutral' : unknown ? 'warning' : 'ok', attrs: ' id="prodLinesVerdict"',
      verdict: loads.length ? todoPlural(loads.length, 'load') + ' pickled' + (unknown ? ', ' + unknown + ' with the line unknown' : '') : isToday ? 'Nothing pickled yet today' : 'Nothing pickled this day' });
  }
  var r = prodDayLine(day, line), ef = prodLineEfficiency(day, line), downtime = prodDowntimeDay(day);
  var mins = downtime.reduce(function(s2, x) { return s2 + x.min; }, 0), unit = ef.unitWord || 'unit';
  var kg = r.kg > 0 ? prodKgFig(r.kg, r.est > 0.0005, r.unweighed > 0) : '';
  var lead = [ef.halfDown ? (ef.n - ef.nAvail) + ' of ' + ef.n + ' ' + unit + 's down' : '', ef.missing ? 'no record of the general shift' : ''].filter(Boolean).join(', ');
  var judged = ef.eff == null ? 'not judged' : ef.over ? ef.word.toLowerCase() : Math.round(ef.eff * 100) + '% efficient';
  var verdict = !ef.ran ? (ef.missing ? 'Heads on the general shift, no record' : isToday ? 'Not running yet today' : 'Did not run')
    : lead ? lead.charAt(0).toUpperCase() + lead.slice(1) + ', ' + judged
    : ef.eff == null ? (kg ? 'Plated ' + kg + ', not judged' : 'Nothing weighed, not judged')
    : ef.over ? ef.word + ', ' + kg + ' plated' : judged.charAt(0).toUpperCase() + judged.slice(1) + ', ' + kg + ' plated';
  var hours = ef.minutes ? formatNum(ef.minutes / 60, 1).replace(/\.0$/, '') + ' h run' + (ef.cutMin ? ', ' + powerDur(ef.cutMin) + ' cut' : '') : '';
  var head = typeof flrEffHead === 'function' ? flrEffHead(ef, null, isToday) : {};
  // Against its usual day and its week against the four before (owner, 10 Oct 2026: "corrections and comparisons are missing"),
  // and what it earned at the clients' rates on record ("why don't we calculate the earnings?"), to a role that sees money.
  var money = typeof grdSeesMoney !== 'function' || grdSeesMoney(), x = prodLineDaySum(day, line), u = prodLineUsual(line, day);
  var kgDelta = !r.entries.length || u.kg == null ? '' : isToday ? 'a usual day ' + escHtml(prodKgFig(u.kg, true)) : r.weighedShare < 0.9 ? 'reads low: pieces not weighed'
    : figDeltaHtml(r.kg, u.kg, 'a usual day', 'up');
  var ref = money ? prodCostRef(day) : null, real = x.kgPriced > 0 ? x.amountKg / x.kgPriced : null;
  var earned = { label: 'Earned', money: true, fig: x.priced ? figWrapHtml(escHtml((x.worthEst ? '≈ ' : '') + finRs(x.worth))) : '', attrs: ' data-prod-line-tile="earned"',
    tone: real != null && ref ? figToneAgainst(real, ref.perKg, 5) : null,
    sub: !r.entries.length ? 'nothing recorded' : !x.priced ? 'no rate on record' : real != null ? formatCurrency(real) + ' a kg' + (ref ? ', cost ' + formatCurrency(ref.perKg) : '') : 'by the piece',
    delta: !x.priced || u.worth == null ? '' : isToday ? 'a usual day ' + escHtml(finRs(u.worth)) : x.pricedShare < 0.9 ? escHtml(Math.round(x.unpriced).toLocaleString('en-IN') + ' pcs not priced')
      : figDeltaHtml(x.worth, u.worth, 'a usual day', 'up') };
  // The week to the day, a recorded day's average against the four weeks before's (a day with no record is a gap, never a zero).
  var wk = prodLineWeek(line, day), wkFact = null;
  if (wk && wk.cur.days && wk.kgDayBefore != null && wk.cur.kg > 0) {
    var fair = wk.cur.weighed >= 0.9, wd = figDeltaText(wk.cur.kgDay, wk.kgDayBefore, 'the 4 before');
    wkFact = { text: 'this week ' + prodKgFig(wk.cur.kgDay, wk.cur.est, !fair) + ' a day' + (fair && wd ? ', ' + wd : ''), tone: fair ? figDeltaTone(wk.cur.kgDay, wk.kgDayBefore, 'up') : null };
  }
  return uiVerdictHtml({ screen: PROD_LINE_LABEL[line] + ' · ' + when, verdict: verdict, tone: ef.tone, viz: ef.eff != null ? head.viz || '' : '',
    facts: [ef.ran && ef.eff == null ? ef.why : '', wkFact, ef.n ? ef.nAvail + ' of ' + ef.n + ' ' + unit + 's working' : '', hours].filter(Boolean).slice(0, 3),
    factors: [
      { label: 'Plated', fig: kg ? figWrapHtml(escHtml(kg)) : '', sub: !r.entries.length ? 'nothing recorded' : r.kg > 0 ? (r.est > 0.0005 ? Math.round(r.est / r.kg * 100) + '% estimated' : 'every run weighed') : 'no run weighed',
        delta: kgDelta, attrs: ' data-prod-line-tile="kg"' },
      { label: 'Pieces', fig: escHtml(Math.round(r.nos).toLocaleString('en-IN')) + ' <span class="inv-tile-of">NOS</span>', tone: r.unweighed ? 'warning' : null,
        sub: r.unweighed ? Math.round(r.unweighed).toLocaleString('en-IN') + ' not weighed' : todoPlural(r.entries.length, 'run'), attrs: ' data-prod-line-tile="pieces"' },
      // The rounds are in the efficiency's split under the tiles: a role that sees money reads what the line earned in their place.
      money ? earned : { label: 'Rounds', fig: String(Math.round(r.rounds)), sub: 'racks or rounds counted', attrs: ' data-prod-line-tile="rounds"' },
      // Dark for so long, or, where no cut has its time back, how many: "0 min" read as no cut at all.
      { label: 'Power cuts', fig: mins > 0 ? escHtml(powerDur(mins)) : downtime.length ? String(downtime.length) : '', tone: downtime.length ? 'warning' : null,
        sub: !downtime.length ? 'none this day' : mins > 0 ? todoPlural(downtime.length, 'cut') + ' this day' : todoPlural(downtime.length, 'cut') + ' with no time back', attrs: ' data-prod-line-tile="cuts"' }],
    body: ef.eff != null && typeof flrEffRowHtml === 'function' ? '<div class="inv-hero-sheet">' + flrEffRowHtml(ef, line) + '</div>' : '',
    attrs: ' id="prodLinesVerdict"' });
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
/* Where an entry came from, as a badge (§1a-11): the register, the supervisor's relay, by hand, the history imported, a message. */
function prodSrcBadge(e) {
  // Entered on a person's own screen (faces.js): said as the owner says it, a face.
  return e.src === 'import' ? 'import' : e.src === 'face' ? 'face' : e.basis === 'register' || e.src === 'photo' ? 'register' : e.basis === 'relay' ? 'relay' : e.src === 'hand' || e.basis === 'hand' ? 'hand' : 'message';
}
/* A run (§3b-11): two facts (its time, its rounds), where it came from as a badge, what it plated and weighs at its end. */
function prodRunRowHtml(e, muted) {
  var rounds = (e.rounds || []).filter(function(x) { return !x.struck; });
  var meta = [e.time ? e.time + (e.to && e.to !== e.time ? '–' + e.to : '') : '', rounds.length ? todoPlural(rounds.length, 'round') : e.racks ? e.rackSize + ' × ' + e.racks : ''].filter(Boolean).join(' · ');
  // A run in pieces says what it weighs and how that was found (prodWeigh); one nothing weighs says so.
  var w = e.unit === 'NOS' ? prodWeigh(e) : null;
  var kg = !w ? '' : w.kg == null ? 'not weighed' : prodKgFig(w.kg, prodWeighEst(w)) + (w.how === 'kind' ? ' by kind' : w.how === 'challans' ? ' from challans' : w.how === 'default' ? ' at the client’s default' : '');
  // The run opens to what it holds, its Correct and its Void (prodEntryFoldRowHtml): a past day is corrected where it is checked.
  return prodEntryFoldRowHtml(e, prodIndex(), '<span class="inv-row-title">' + escHtml(prodEntryTitle(e)) + '</span>' +
    '<span class="inv-row-meta"><span class="inv-badge inv-badge-neutral" data-prod-src>' + prodSrcBadge(e) + '</span>' + (e.rework ? ' <span class="inv-badge inv-badge-info">rework</span>' : '') +
    (meta ? ' ' + escHtml(meta) : '') + '</span>', '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + escHtml(prodQtyText(e.qty, e.unit)) + '</span>' +
    (kg ? '<span class="inv-row-meta inv-num" data-prod-run-kg>' + escHtml(kg) + '</span>' : '') + '</span></span>', muted);
}

/* ---------- Entries ---------- */
var PROD_ENTRY_KINDS = [['', 'All'], ['pickled', 'Pickled'], ['plated', 'Plated'], ['arrived', 'Arrived'], ['downtime', 'Power cuts']];
var PROD_ENTRY_FLAGS = [['unknown', 'Line unknown'], ['noclient', 'No client'], ['nochallan', 'No challan'], ['gauge', 'Gauge unknown'], ['unweighed', 'Not weighed'],
  ['check', 'To check']];
/* Whether an entry carries a flag: the To-do counts every date, so a flag lists every date too (P127). */
function prodEntryFlagged(e, flag, idx) {
  if (flag === 'unknown') return e.kind === 'pickled' && !e.voidedAt && prodLoadLine(e).how === 'unknown';
  if (flag === 'noclient') return e.clientId == null && e.kind !== 'downtime';
  if (flag === 'nochallan') return e.clientId != null && prodLoadNoChallan(e, idx);
  if (flag === 'gauge') return prodGaugeFlagged(e);
  if (flag === 'unweighed') return prodIsUnweighed(e, idx);
  // A face's entry the data it links to does not bear out, or a run no load of a face's day became (faces.js).
  if (flag === 'check') return faceCheckOf(e).length > 0;
  return false;
}
/* Entries (the tab map, TM4c): its verdict (the record's 60 days, and what needs a look: pieces not weighed, loads with the line
   unknown, cuts with no time back), one toolbar row (what comes in; the kinds and the flags, each with its count over every entry,
   inline on the desktop and behind Filter on the phone; Export and Import behind More), the loads with the line unknown and the
   record's coverage at the head, then the latest thirty, newest first, the rest one tap away. A row says two things and ends in one
   action; everything else is in its fold (phone) or the pane beside the list (desktop). */
function prodEntriesHtml() {
  var idx = prodIndex(), f = _prodFilter, today = localDateStr(), from = isoAddDays(today, -60), all = prodData().entries;
  var recent = all.filter(function(e) { return e.date >= from; });
  var kindN = {}, flagN = {};
  PROD_ENTRY_KINDS.forEach(function(c) { kindN[c[0]] = recent.filter(function(e) { return !c[0] || e.kind === c[0]; }).length; });
  PROD_ENTRY_FLAGS.forEach(function(c) { flagN[c[0]] = all.filter(function(e) { return prodEntryFlagged(e, c[0], idx); }).length; });
  var openCuts = recent.filter(function(e) { return e.kind === 'downtime' && !e.voidedAt && e.downtime && e.downtime.open; }).length;
  var unknown = prodUnknownLoads(), look = flagN.unweighed + flagN.unknown + openCuts + flagN.gauge + flagN.check;
  // The four flags that need a look are the card's factors, and filter the list as Stock's status tiles do; the kinds (and No client)
  // are the toolbar's chips, behind Filter on the phone with the flags beside them.
  var flagTile = function(flag, label, sub) {
    return { label: label, fig: String(flagN[flag]), tone: flagN[flag] ? 'warning' : null, sub: sub, action: 'invProdFilter', attrs: ' data-flag="' + flag + '" data-prod-tile="' + flag + '"', pressed: f.flag === flag };
  };
  var h = uiVerdictHtml({ screen: 'Entries · 60 days', verdict: todoPlural(recent.length, 'entry', 'entries') + ' in 60 days' + (look ? ', ' + look + ' to look at' : ''),
    tone: !recent.length ? 'neutral' : look ? 'warning' : 'ok',
    facts: [flagN.check ? flagN.check + ' to check' : '', flagN.unweighed ? flagN.unweighed + ' not weighed' : '', openCuts ? todoPlural(openCuts, 'cut') + ' with no time back' : '',
      flagN.unknown ? flagN.unknown + ' with the line unknown' : ''].filter(Boolean).slice(0, 3),
    factors: [flagTile('unweighed', 'Not weighed', 'runs in pieces, every date'), flagTile('unknown', 'Line unknown', 'pickled loads'),
      flagTile('nochallan', 'No challan', 'loads, 30 days'), flagTile('gauge', 'Gauge unknown', 'a round no rule names')],
    attrs: ' id="prodEntriesVerdict"' });
  var chip = function(attr, val, label, n, on) {
    return '<button class="inv-chip" data-action="invProdFilter" ' + attr + '="' + val + '" aria-pressed="' + on + '">' + label + ' <span class="inv-panel-count">' + n + '</span></button>';
  };
  var chips = PROD_ENTRY_KINDS.map(function(c) { return chip('data-kind', c[0], c[1], kindN[c[0]], f.kind === c[0] && !f.flag); }).join('') +
    PROD_ENTRY_FLAGS.filter(function(c) { return !_isDesktop || c[0] === 'noclient' || (c[0] === 'check' && (flagN.check || f.flag === 'check')); }).map(function(c) { return chip('data-flag', c[0], c[1], flagN[c[0]], f.flag === c[0]); }).join('');
  var on = f.flag ? (PROD_ENTRY_FLAGS.find(function(c) { return c[0] === f.flag; }) || [])[1] : f.kind ? (PROD_ENTRY_KINDS.find(function(c) { return c[0] === f.kind; }) || [])[1] : '';
  // A day: every entry of it, whatever its kind (owner, 10 Oct 2026: a past day's records, to check and correct).
  var dayField = '<label class="inv-field inv-toolbar-item"><span class="inv-field-label">A day</span><input type="date" id="prodEntriesDay" class="inv-input" max="' + today + '" value="' + escHtml(f.day || '') + '" aria-label="A day"></label>';
  h += prodToolbarHtml('', [{ label: 'Export', action: 'invProdExport' }, { label: 'Import', action: 'invProdImport' }],
    uiFilterHtml({ key: 'prodEntries', count: (on ? 1 : 0) + (f.day ? 1 : 0), controls: chips + dayField })) +
    uiTokensHtml([{ key: 'Show', value: on, action: 'invProdFilter', attrs: f.flag ? ' data-flag="' + escHtml(f.flag) + '"' : ' data-kind=""' },
      { key: 'Day', value: f.day ? stockShortDate(f.day) : '', action: 'invProdDayClear' }]);
  // What needs a look heads the list: the loads with the line unknown, then the record's coverage, folded. On the desktop they head
  // the list's column, so the list and the pane still fill the room under the toolbar (P80).
  var head = prodUnknownHtml(unknown) + uiFoldCard('prod-coverage', prodCoverageHtml(), false);
  var list = all.filter(function(e) {
    if (f.client && String(e.clientId) !== String(f.client)) return false;
    if (f.day && e.date !== f.day) return false;
    if (f.flag) return prodEntryFlagged(e, f.flag, idx);
    return (f.day || e.date >= from) && (!f.kind || e.kind === f.kind);
  }).sort(function(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : String(b.time || '').localeCompare(String(a.time || '')); });
  var lh = '<div class="inv-panel inv-panel-flush" id="prodEntries"><div class="inv-panel-head"><span class="inv-panel-title">' +
    (f.day ? 'Entries, ' + formatDate(f.day) : f.flag ? 'Entries, every date' : 'Entries, 60 days') + '</span><span class="inv-panel-count">' + list.length + '</span></div>';
  if (!list.length) lh += '<div class="inv-empty">Nothing here.</div>';
  var rows = [], last = '';
  list.slice(0, 300).forEach(function(e) {
    if (e.date !== last) { last = e.date; rows.push({ head: true, parts: ['<div class="inv-row-group"><span>' + escHtml(formatDate(e.date)) + '</span></div>'] }); }
    rows.push(prodEntryRowHtml(e, idx));
  });
  lh += uiMoreHtml('prod-entries', rows, { n: 30, noun: 'entries' });
  if (list.length > 300) lh += '<div class="inv-row"><span class="inv-row-meta">' + escHtml('The latest 300 of ' + list.length + ' are drawn: a filter reaches the rest.') + '</span></div>';
  lh += '</div>';
  if (!_isDesktop) return h + head + lh;
  // The desktop: the list beside the open entry (UX overhaul 2, step 7). An entry the filter no longer lists stays open, since it
  // is still a record somebody chose to read.
  var open = _prodEntryOpen && all.find(function(e) { return e.id === _prodEntryOpen; });
  if (!open) _prodEntryOpen = null;
  return h + '<div class="inv-pane-host' + (open ? ' inv-pane-open' : '') + '" id="prodEntriesHost" data-open="' + (open ? escHtml(open.id) : '') + '"><div class="inv-pane-list">' + head + lh + '</div>' +
    '<div class="inv-pane" id="prodEntryPane">' + (open ? prodEntryDetailHtml(open, idx) : '') + '</div></div>';
}

/* What an entry holds, as a label and a value a pair: the pane's grid and the phone row's fold. */
function prodEntryKv(e) {
  var kindWord = { pickled: 'Pickled', plated: 'Plated', arrived: 'Arrived', downtime: 'Power cut' }[e.kind] || e.kind;
  var open = e.kind === 'downtime' && e.downtime && e.downtime.open;
  var line = e.kind === 'pickled' ? prodLoadLine(e) : null;
  var kv = [['Kind', kindWord + (e.rework ? ', rework' : '')], ['Day', formatDate(e.date)]];
  if (e.time) kv.push(['Time', e.time + (e.to && e.to !== e.time ? ' – ' + e.to : open ? ' – no time back' : '')]);
  // The supervisor's whole-day barrel list is named as the hand form names it, not as the general shift (QA chain, 2 Oct 2026).
  if (e.slot) kv.push(['Shift', e.slot === 'ot' ? 'Overtime' : e.slot === 'day' ? 'Whole day (barrel list)' : 'General']);
  if (e.kind === 'plated' || e.line) kv.push(['Line', e.line ? prodLineName(e.line) : 'Not written']);
  else if (line) kv.push(['Line', line.line ? prodLineName(line.line) + (line.how === 'plating' ? ', from the plating' : '') : line.how === 'split' ? 'Split' : 'Unknown']);
  if (e.kind !== 'downtime') {
    kv.push(['Client', e.clientId != null ? prodClientName(e.clientId) || e.client || '' : (e.client ? e.client + ', not in the book' : 'Not written')]);
    if (e.part || e.partNumber) kv.push(['Part', [e.part, e.partNumber && e.partNumber !== e.part ? e.partNumber : '', e.gauge].filter(Boolean).join(' · ')]);
    kv.push(['Quantity', prodQtyText(e.qty, e.unit) + (e.qty2 != null ? ' · ' + prodQtyText(e.qty2, e.unit2) : '')]);
    var w = e.unit === 'NOS' ? prodWeigh(e) : null;
    if (w) kv.push(['Weight', w.kg == null ? 'Not weighed' : prodKgFig(w.kg, prodWeighEst(w)) + ({ written: ', written', record: ', on record', challans: ', from the challans', kind: ', by the kind of part', 'default': ', at the client’s default' }[w.how] || '')]);
    if (e.rackSize) kv.push(['Rack', e.rackSize + (e.racks ? ' × ' + e.racks : '')]);
    var alias = e.clientId != null ? prodAliasShown(e) : null;
    if (alias && alias.pn && alias.pn !== e.partNumber) kv.push(['Read as', alias.pn + (alias.how === 'rack' && e.partRack ? ', by the round of ' + e.partRack : '')]);
    if (e.gaugeOptions && !e.gauge) kv.push(['Gauge', e.gaugeOptions.join(' or ') + ' by the round']);
    if (prodGaugeFlagged(e)) kv.push(['Gauge', 'Unknown: a round of ' + e.gaugeUnknown]);
    else if (e.gaugeUnknown && e.gaugeSrc === 'set') kv.push(['Gauge', 'Set (a round of ' + e.gaugeUnknown + ')']);
    if (e.qtySrc === 'split') kv.push(['Shared', 'by the challans (an estimate)']);
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
  if (e.voidedAt) kv.push(['Void', e.voidReason || 'no reason given']);
  return kv;
}
function prodKvHtml(kv) {
  return '<div class="inv-kv">' + kv.map(function(x) { return '<div><div class="inv-kv-k">' + escHtml(x[0]) + '</div><div>' + escHtml(String(x[1])) + '</div></div>'; }).join('') + '</div>';
}
/* One entry in the pane: everything it holds, the text it was read from, and what can be done to it. */
function prodEntryDetailHtml(e, idx) {
  var open = e.kind === 'downtime' && e.downtime && e.downtime.open;
  var title = e.kind === 'downtime' ? (open ? 'Power cut, no time back' : 'Power cut') : prodEntryTitle(e);
  var h = paneHeadHtml('<span class="inv-panel-title">' + escHtml(title) + '</span>', 'invProdEntryClose') +
    '<div class="inv-panel" data-prod-pane="' + escHtml(e.id) + '">' + prodKvHtml(prodEntryKv(e)) + '</div>';
  h += prodEntryMoreHtml(e, idx);
  var acts = prodEntryActionsHtml(e, idx);
  if (acts) h += '<div class="inv-toolbar">' + acts + '</div>';
  return h;
}
/* What an entry says beyond its figures: corrected, a correction, its rounds, who plated it, the text it was read from. */
function prodEntryMoreHtml(e, idx) {
  var h = '';
  var by = idx.replaced[e.id] && prodData().entries.find(function(x) { return x.replaces === e.id && !x.voidedAt; });
  if (by) h += '<div class="inv-callout inv-callout-info">Corrected by the entry of ' + escHtml(formatDate(by.date)) + ': ' + escHtml(prodQtyText(by.qty, by.unit)) + '.</div>';
  if (e.replaces) h += '<div class="inv-note">This entry corrects an earlier one.</div>';
  h += faceCheckCalloutsHtml(e);
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
  return h;
}
/* An entry's one action at its row's end (§1a-11): a cut is completed or given its reason, any other entry corrected; a void entry or
   one already corrected takes none. The rest are in the row's fold (phone) or the pane (desktop). */
function prodEntryOneAction(e, idx) {
  if (e.voidedAt) return '';
  if (e.kind === 'downtime') {
    var dt = e.downtime || {};
    return '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPcsOpen" data-id="' + escHtml(e.id) + '">' + (dt.open ? 'Complete' : dt.reason ? 'Edit reason' : 'Add reason') + '</button>';
  }
  return idx.replaced[e.id] ? '' : '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invProdCorrect" data-id="' + escHtml(e.id) + '">Correct</button>';
}
/* An entry (§3b-11): its title; two facts (where and when: the line and the slot, else the time; how much: the quantity with its
   kilos, or a cut's reason); where it came from, how it was weighed and what it matched as badges; one action at its end. */
function prodEntryRowHtml(e, idx) {
  var cut = e.kind === 'downtime', dt = e.downtime || {}, line = e.kind === 'pickled' ? prodLoadLine(e) : null;
  var title = cut ? (dt.open ? 'Power cut, no time back' : 'Power cut') : prodEntryTitle(e);
  var span = e.time ? e.time + (e.to && e.to !== e.time ? '–' + e.to : '') : '';
  var where = cut ? span || 'no time written'
    : e.kind === 'plated' ? prodLineName(e.line) + ', ' + (e.slot === 'ot' ? 'overtime' : e.slot === 'day' ? 'the day’s list' : 'general shift')
    : e.kind === 'pickled' ? (line.line ? prodLineName(line.line) : line.how === 'split' ? 'split' : 'line unknown') + (span ? ', ' + span : '')
    : 'arrived' + (span ? ', ' + span : '');
  var w = !cut && e.unit === 'NOS' ? prodWeigh(e) : null;
  var how = cut ? (dt.reason && typeof pcsName === 'function' ? 'why: ' + pcsName(dt.reason) : 'no reason yet')
    : prodQtyText(e.qty, e.unit) + (w && w.kg != null ? ' (' + prodKgFig(w.kg, prodWeighEst(w)) + ')' : '');
  // Where it came from and how it was weighed, as badges (§3c: what a figure is not, beside it). The phone badges only what qualifies
  // the figure (an estimate, nothing weighing it, what it did not match): a third line on every row ran the thirty to 3.4 screens,
  // and the source is in the row's fold. The desktop has the room for all of them.
  var sure = w && (w.how === 'written' || w.how === 'record');
  var badges = _isDesktop ? [['neutral', prodSrcBadge(e)]] : [];
  if (w && (_isDesktop || !sure)) badges.push(w.kg == null ? ['warning', 'not weighed'] : [sure ? 'ok' : 'neutral', w.how]);
  if (e.clientId == null && !cut) badges.push(['warning', 'no client']);
  else if (e.kind === 'pickled' && prodLoadNoChallan(e, idx)) badges.push(['warning', 'no challan']);
  if (prodGaugeFlagged(e)) badges.push(['warning', 'gauge unknown']);
  if (faceCheckOf(e).length) badges.push(['warning', 'to check']);
  if (e.rework) badges.push(['info', 'rework']);
  if (idx.replaced[e.id]) badges.push(['neutral', 'corrected']);
  else if (e.kind === 'plated' && !idx.countedSet[e.id] && !e.voidedAt) badges.push(['neutral', 'also reported']);
  if (e.voidedAt) badges.push(['neutral', 'void']);
  var main = '<span class="inv-row-title">' + escHtml(title) + '</span><span class="inv-row-meta">' + escHtml(where + ' · ' + how) + '</span>' +
    (badges.length ? '<span class="inv-row-meta" data-prod-badges>' + badges.map(function(b) { return '<span class="inv-badge inv-badge-' + b[0] + '">' + escHtml(b[1]) + '</span>'; }).join(' ') + '</span>' : '');
  var one = prodEntryOneAction(e, idx), end = '<span class="inv-row-end">' + one + '</span>';
  // On the desktop the entry opens in the pane beside the list, so its main is a button; the pane holds every action.
  if (_isDesktop) {
    var cur = _prodEntryOpen === e.id;
    return '<div class="inv-row inv-row-2' + (e.voidedAt ? ' inv-row-muted' : '') + '" data-prod-entry="' + escHtml(e.id) + '"' + (cur ? ' aria-current="true"' : '') + '>' +
      '<button class="inv-row-main" data-action="invProdEntryOpen" data-id="' + escHtml(e.id) + '">' + main + '</button>' + end + '</div>';
  }
  // The phone: the row folds open to what the pane would show, and the actions its end has no room for.
  return prodEntryFoldRowHtml(e, idx, main, end, false, one);
}
/* What can be done to an entry: in its pane (desktop) and its fold (phone), less `omit` (the button already at the row's end). A void
   entry takes nothing. */
function prodEntryActionsHtml(e, idx, omit) {
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
  var one = prodEntryOneAction(e, idx);
  if (one && one !== omit) h += one;
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
  var seen = p.pastes.filter(function(x) {
    if (x.hash === m.hash) return true;
    if (x.day || x.hash !== relayHash(x.text || '')) return false;
    var e = p.entries.find(function(y) { return y.pasteId === x.id; });
    return prodMsgKey(e ? e.date : x.sentOn, x.text) === m.hash;
  }).find(function(paste) { return p.entries.some(function(e) { return e.pasteId === paste.id && !e.voidedAt; }); }) || null;
  if (seen) return seen;
  // The message a face wrote for the group (faces.js) carries its key on the entries it made: already entered, never read twice.
  var fe = p.entries.find(function(e) { return e.src === 'face' && e.msgHash && e.msgHash === m.hash && !e.voidedAt; });
  return fe ? { id: null, face: fe } : null;
}
/* A pasted load or arrival a face already holds (faces.js): the same day, client and part, the same figure, within twenty
   minutes. The message a face writes is refused whole by its key (prodPasteSeen); this catches it retyped or edited. */
function prodFaceTwin(it, clientId) {
  if (!it || (it.kind !== 'pickled' && it.kind !== 'arrived') || clientId == null || clientId === 'asWritten') return null;
  var idx = prodIndex(), t = relayParseHhmm(it.time), k = prodKey(clientId, it.part, it.gauge);
  return idx.live.find(function(e) {
    if (e.src !== 'face' || e.kind !== it.kind || e.date !== it.date || idx.replaced[e.id] || String(e.clientId) !== String(clientId)) return false;
    // The part as the floor writes it: "165x83(40x6)" under the client is the face's "CLAMP 165X83 (NT)", so one name inside the
    // other is the same part here, where the day, the client, the figure and the time already agree.
    var pk = prodPartKey(it.part || ''), ek = prodPartKey(e.partNumber || e.part || '');
    var same = pk && ek && (pk === ek || (pk.length >= 4 && ek.indexOf(pk) >= 0) || (ek.length >= 4 && pk.indexOf(ek) >= 0));
    if (!same && prodEntryKey(e) !== k) return false;
    if ((e.qty == null) !== (it.qty == null) || (e.qty != null && (Math.abs(e.qty - it.qty) > 0.0005 || e.unit !== it.unit))) return false;
    var et = relayParseHhmm(e.time);
    return t == null || et == null || Math.abs(et - t) <= 20;
  }) || null;
}
/* The open cut stored from a message saved before, that a power back in this paste closes (P127). */
function prodStoredOpenCut(m, it) {
  var seen = prodPasteSeen(m);
  return seen && seen.id ? prodData().entries.find(function(e) {
    return e.pasteId === seen.id && e.kind === 'downtime' && !e.voidedAt && e.date === it.date && e.time === it.time && e.to == null;
  }) || null : null;
}
function prodReviewResolve() {
  var rv = _prodReview, ch = rv.choices, out = { rows: [], red: 0, amber: 0, save: 0, dup: 0 }, inPaste = {};
  rv.msgs.forEach(function(m, mi) {
    // Saved before, or the same message earlier in this paste (the supervisor reposts a roll): read once.
    m.twice = !!(m.read.items.length && inPaste[m.hash]);
    if (m.read.items.length) inPaste[m.hash] = true;
    var seenAs = prodPasteSeen(m);
    m.dup = !!seenAs || m.twice;
    m.faceBy = seenAs && seenAs.face ? seenAs.face.by || 'someone' : '';
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
      // Entered on a face already (faces.js): left out, as a message saved before is.
      row.twin = !m.dup ? prodFaceTwin(it, row.clientId) : null;
      if (row.twin) { row.issues = []; out.twin = (out.twin || 0) + 1; }
      row.issues.forEach(function(x) { if (x.tone === 'red') row.tone = 'red'; else if (x.tone === 'amber' && row.tone !== 'red') row.tone = 'amber'; });
      if (!m.dup && !row.twin) { if (row.tone === 'red') out.red++; else if (row.tone === 'amber') out.amber++; out.save++; }
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
  if (res.twin) h += '<div class="inv-callout inv-callout-info" id="prodTwinNote">' + todoPlural(res.twin, 'line') + ' in this paste ' + (res.twin === 1 ? 'was' : 'were') + ' entered on a face already, and ' + (res.twin === 1 ? 'is' : 'are') + ' left out.</div>';
  if (res.dup) h += '<div class="inv-callout inv-callout-danger" id="prodDupNote">' + todoPlural(res.dup, 'message') + ' in this paste ' + (res.dup === 1 ? 'was' : 'were') + ' saved before, or sent twice, and ' + (res.dup === 1 ? 'is' : 'are') + ' left out, so nothing counts twice.</div>';
  rv.msgs.forEach(function(m, mi) {
    var kindWord = { pickling: 'Pickling', production: 'Barrel production', runs: 'Production by slot', roll: 'Roll: production notes', power: 'Power cut', stock: 'Stock (read in Stock)', other: 'Not production' }[m.kind];
    h += '<div class="inv-panel inv-panel-flush' + (m.dup ? ' inv-row-muted' : '') + '" data-prod-msg="' + mi + '"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(kindWord + (m.sentBy ? ' · ' + m.sentBy : '')) + '</span>' +
      '<span class="inv-panel-count">' + escHtml((m.sentOn ? stockShortDate(m.sentOn) : 'no date') + (m.sentAt != null ? ' ' + relayHhmm(m.sentAt) : '')) + '</span></div>';
    if (m.dup) h += '<div class="inv-panel-body inv-note">' + (m.twice ? 'The same message is earlier in this paste: read once, left out here.' : m.faceBy ? 'Entered on a face by ' + escHtml(m.faceBy) + ': left out.' : 'Saved before: left out.') + '</div>';
    if (m.kind === 'roll' && !m.read.items.length) h += '<div class="inv-panel-body inv-note">An attendance roll with no production notes: read it in People → Paste message.</div>';
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
  var it = r.it, badge = r.m.dup ? ['neutral', 'Saved before'] : r.twin ? ['neutral', 'On a face'] : r.tone === 'red' ? ['danger', 'Needs you'] : r.tone === 'amber' ? ['warning', 'Check'] : ['ok', 'Clear'];
  var kindWord = { pickled: 'Pickled', plated: 'Plated', arrived: 'Arrived', downtime: 'Power cut' }[it.kind];
  var reading = it.kind === 'downtime' ? 'Power cut ' + (it.time || '?') + ' to ' + (it.to || 'not back') :
    kindWord + (it.time ? ' ' + it.time : '') + ' · ' + (r.clientId != null ? prodClientName(r.clientId) : it.client ? it.client + ' (as written)' : 'no client') +
    (it.part ? ' · ' + it.part : '') + (it.gauge ? ' [' + it.gauge + ']' : '') + ' · ' + prodQtyText(it.qty, it.unit) + (it.qty2 != null ? ' + ' + prodQtyText(it.qty2, it.unit2) : '') +
    (it.kind === 'plated' ? ' · ' + (r.line ? prodLineName(r.line) : it.line ? prodLineName(it.line) : 'line unknown') : '') + (it.rework ? ' · rework' : '');
  var h = '<div class="inv-row inv-row-auto inv-row-top" data-prod-row="' + r.key + '" data-tone="' + r.tone + '"><div class="inv-row-main"><div class="inv-quote">' + escHtml(it.raw) + '</div>' +
    '<div class="inv-verdict-text inv-mt-4">' + escHtml(reading) + '</div>';
  r.issues.forEach(function(x) { h += '<div class="inv-callout inv-callout-' + uiTone(x.tone) + ' inv-mt-8">' + escHtml(x.text) + '</div>'; });
  if (r.twin) h += '<div class="inv-note inv-mt-4" data-prod-twin>' + escHtml('Entered on a face' + (r.twin.by ? ' by ' + r.twin.by : '') + (r.twin.time ? ' at ' + relayClockLabel(relayParseHhmm(r.twin.time)) : '') + ': left out.') + '</div>';
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
    if (r.m.dup || r.twin) return;
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
  // The page entered on Mine by the register clerk (faces.js, F4) for this day and line, whose runs are in the book.
  var onMine = !power && line ? p.pages.find(function(x) { return !x.replacedBy && x.date === date && x.line === line && p.entries.some(function(e) { return e.pageId && e.date === x.date && e.line === x.line && !e.voidedAt; }); }) : null;
  if (ph.dupSha) h += '<div class="inv-callout inv-callout-danger" id="prodPhotoDup">This photo was saved before. Saving it again would count the page twice.</div>';
  else if (dupFp) h += '<div class="inv-callout inv-callout-warning" id="prodPhotoDup">A photo with the same rows for this day and line was saved before (a retake or a forward?). Saving would count the page twice.</div>';
  else if (onMine) h += '<div class="inv-callout inv-callout-warning" id="prodPhotoDup" data-prod-photo-mine>' + escHtml('The ' + PROD_LINE_LABEL[line] + ' page for this day was entered on Mine' + (onMine.by ? ' by ' + onMine.by : '') +
    (onMine.fp === rd.fp ? ', with the same rounds' : '') + '. Saving the photo as well counts the day twice.') + '</div>';
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
  var f = { kind: 'plated', date: localDateStr(), time: '', to: '', line: 'vat-a1', clientId: '', part: '', qty: '', unit: 'NOS', rework: false, slot: 'general', replaces: null, from: null, saved: [] };
  // Opened from Lines, it starts on the line on screen, and on its day where one was stepped to: a record missing from a past day
  // is added where it is seen. With no day stepped to, Lines shows the last recorded day, and a new entry is today's.
  if (_prodTab === 'lines' && _prodView === 'main') {
    if (_prodDay) f.date = _prodDay;
    if (_prodLine === 'pickling') f.kind = 'pickled'; else if (PROD_LINES.indexOf(_prodLine) >= 0) f.line = _prodLine;
  }
  return f;
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
    // A line is Lines' own view, led by its card (TM4c): it opens at its top, as a view tab does.
    case 'invProdLine': _prodLine = btn.dataset.line; renderProduction(); viewTop(); return true;
    case 'invProdDay': {
      // From the day on screen: with none stepped to that is the last recorded day, not today.
      var base = prodLinesDay();
      _prodDay = isoAddDays(base, +btn.dataset.step);
      renderProduction(); return true;
    }
    case 'invProdDayLast': _prodDay = null; renderProduction(); return true;
    case 'invProdDayClear': _prodFilter = { kind: '', flag: '', client: _prodFilter.client || '', day: '' }; renderProduction(); return true;
    // Lines' More: every entry of the day on screen, on Entries (a day's runs are Lines', its loads, cuts and arrivals too there).
    case 'invProdDayEntries': _prodFilter = { kind: '', flag: '', client: '', day: prodLinesDay() }; _prodEntryOpen = null; prodSetTab('entries'); renderProduction(); return true;
    case 'invProdFilter': {
      // A pressed chip or tile on Entries lets its flag go; Line unknown's "All N" (data-set) always opens the loads it counts, on
      // Entries too, where it has stood since the tab map (TM4c) beside the tile that toggles the same flag.
      if (btn.dataset.flag !== undefined) _prodFilter = { kind: '', flag: _prodTab === 'entries' && btn.dataset.set === undefined && _prodFilter.flag === btn.dataset.flag ? '' : btn.dataset.flag, client: '' };
      else _prodFilter = { kind: btn.dataset.kind || '', flag: '', client: '' };
      // Picked in the phone's Filter dialog: one choice, so the dialog shuts on it, and its close draws the page.
      var fdlg = btn.closest('[data-tb-filter-dialog]');
      if (fdlg) { dialogCloseScrim(fdlg.closest('.inv-scrim-dialog')); return true; }
      // From another tab it is a jump to the entries it counts: no entry left open from before (QA chain, 2 Oct 2026).
      if (_prodTab !== 'entries') { prodSetTab('entries'); _prodEntryOpen = null; }
      renderProduction(); return true;
    }
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
  if (t.id === 'prodEntriesDay') {
    _prodFilter = { kind: '', flag: '', client: _prodFilter.client || '', day: t.value || '' };
    var fdlg = t.closest('[data-tb-filter-dialog]');
    if (fdlg) { dialogCloseScrim(fdlg.closest('.inv-scrim-dialog')); return true; }
    renderProduction(); return true;
  }
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
