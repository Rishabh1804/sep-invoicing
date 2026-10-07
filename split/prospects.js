/* ===== PROSPECTS =====
   Clients → Prospects (owner, 7 Oct 2026: "start with 3 and 4", the fourth being a list to fill the spare capacity). The plant
   runs about three quarters full (CLAUDE.md § Key Business Data: ~24 t a month spare), and filling it at a rate that clears the
   cost is worth more than any single repricing. Nothing kept who was approached, what they were offered, or when to call again.

   - **A prospect** (`S.prospects`): a firm not yet a client, its contact, the work it might send (parts or process, tonnes a
     month as estimated, a target rate), a stage (new → contacted → sample → quoted → won | lost), the next follow-up, notes,
     and a dated log of each stage it reached. Lost needs a reason, as every closing does here.
   - **Its quotations** are the Quotations' own: *Draft quotation* opens one addressed to the prospect at its target rate
     (`qtOpenDraft`, the quotation carrying `prospectId`). A prospect with a quotation issued reads *quoted* whatever stage was
     typed, until it is moved on.
   - **Won makes the client**: the client form opens filled from the prospect, and saving it links the two (`clientId`), so the
     prospect is never typed twice.
   - **The pipeline against the spare**: the open prospects' tonnes, weighted by a chance per stage (said on the screen, never
     hidden), against the spare tonnes a month over the last 90 days at ~2 t a shift (Stats' capacity).
   - **To-do `prospectFollow`**: a follow-up due (amber), a week late (red). Pulse's *Is the plant full?* names the pipeline. */

STATE_CONTAINERS.push('prospects');

var PRS_STAGES = [['new', 'New'], ['contacted', 'Contacted'], ['sample', 'Sample'], ['quoted', 'Quoted'], ['won', 'Won'], ['lost', 'Lost']];
var PRS_LABEL = {};
PRS_STAGES.forEach(function(s) { PRS_LABEL[s[0]] = s[1]; });
/* The chance a prospect at a stage sends the work estimated: a working assumption, said beside every weighted figure. */
var PRS_CHANCE = { new: 0.1, contacted: 0.2, sample: 0.4, quoted: 0.6 };
var _prsStageFilter = 'open';
var _prsSearch = '';

function getProspects() { if (!Array.isArray(S.prospects)) S.prospects = []; return S.prospects; }
function prsFind(id) { return getProspects().find(function(p) { return p.id === id; }) || null; }
function prsUid() { return 'PR-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
/* The quotations made for a prospect: by its id, or (one drafted before the link) by its name as the recipient. */
function prsQuotes(p) {
  var k = rateKey(p.name);
  return getQuotations().filter(function(q) { return q.prospectId === p.id || (!q.prospectId && k && rateKey(q.to && q.to.name) === k); });
}
/* The stage shown: a quotation issued moves a prospect that was not yet there to Quoted. */
function prsStage(p) {
  if (p.stage === 'won' || p.stage === 'lost') return p.stage;
  var order = ['new', 'contacted', 'sample', 'quoted'];
  var issued = prsQuotes(p).some(function(q) { return q.status === 'issued' || q.status === 'accepted'; });
  return issued && order.indexOf(p.stage || 'new') < 3 ? 'quoted' : (p.stage || 'new');
}
function prsOpen(p) { var s = prsStage(p); return s !== 'won' && s !== 'lost'; }
/* How late the follow-up is: null when none is set or the prospect is closed. */
function prsLate(p, today) {
  if (!prsOpen(p) || !p.nextAt) return null;
  return isoDaysBetween(p.nextAt, today || localDateStr());
}
function prsTone(p) {
  var late = prsLate(p);
  if (late == null) return prsStage(p) === 'won' ? 'ok' : prsStage(p) === 'lost' ? 'neutral' : 'info';
  return late >= 7 ? 'danger' : late >= 0 ? 'warning' : 'info';
}

/* ---------- The pipeline against the spare ---------- */
function prsSpare(today) {
  today = today || localDateStr();
  var from = isoAddDays(today, -89);
  var rows = statsInvoices().filter(function(r) { return r.date >= from && r.date <= today; });
  var kg = weighLines(rows).kg, cap = STATS_CAPACITY_KG_DAY * statsWorkingDays(from, today);
  if (!(cap > 0)) return null;
  return { capMonth: cap / 3, kgMonth: kg / 3, spareMonth: Math.max(0, (cap - kg) / 3) };
}
function prsPipeline() {
  var open = getProspects().filter(prsOpen), kg = 0, weighted = 0, rs = 0;
  open.forEach(function(p) {
    var t = (p.kgMonth || 0), ch = PRS_CHANCE[prsStage(p)] || 0;
    kg += t; weighted += t * ch;
    if (p.rate > 0) rs += t * ch * p.rate;
  });
  return { n: open.length, kg: kg, weighted: weighted, revenue: rs };
}

/* ---------- The list ---------- */
function prsRowHtml(p) {
  var st = prsStage(p), late = prsLate(p), qs = prsQuotes(p);
  var meta = [PRS_LABEL[st],
    p.kgMonth > 0 ? formatNum(p.kgMonth / 1000, 1) + ' t a month' + (p.rate > 0 ? ' at ' + formatCurrency(p.rate) + '/kg' : '') : '',
    p.process || '',
    p.nextAt && prsOpen(p) ? (late > 0 ? 'follow-up ' + late + ' d late' : late === 0 ? 'follow up today' : 'follow up ' + formatDate(p.nextAt)) : '',
    qs.length ? todoPlural(qs.length, 'quotation') : '',
    st === 'lost' && p.lostReason ? p.lostReason : ''].filter(Boolean).join(' · ');
  return '<div class="inv-row inv-row-2" data-prospect="' + escHtml(p.id) + '"><button type="button" class="inv-row-main" data-action="invPrsOpen" data-id="' + escHtml(p.id) + '">' +
    '<span class="inv-row-title">' + escHtml(p.name || 'Unnamed') + '</span><span class="inv-row-meta">' + escHtml(meta) + '</span></button>' +
    '<span class="inv-row-end">' + uiDot(prsTone(p), escHtml(late != null && late >= 0 ? 'Due' : PRS_LABEL[st])) + '</span></div>';
}
function prsSummaryHtml() {
  var pl = prsPipeline(), sp = prsSpare(), due = getProspects().filter(function(p) { var l = prsLate(p); return l != null && l >= 0; }).length;
  var tile = function(k, label, val, sub, tone) {
    return '<div class="inv-tile" data-prs-tile="' + k + '"><div class="inv-tile-label">' + label + '</div><div class="inv-tile-value' + (tone ? ' inv-fig-' + tone : '') + '">' + val + '</div>' +
      (sub ? '<div class="inv-tile-sub">' + sub + '</div>' : '') + '</div>';
  };
  var fill = sp && sp.spareMonth > 0 ? pl.weighted / sp.spareMonth : null;
  return '<div class="inv-panel inv-panel-flush" data-card="prospects"><div class="inv-tiles">' +
    tile('open', 'Open', String(pl.n), due ? todoPlural(due, 'follow-up') + ' due' : 'none due', due ? 'warning' : '') +
    tile('pipeline', 'Pipeline', formatNum(pl.weighted / 1000, 1) + ' t', 'a month, weighted · ' + formatNum(pl.kg / 1000, 1) + ' t if all came') +
    tile('spare', 'Spare', sp ? formatNum(sp.spareMonth / 1000, 1) + ' t' : '&mdash;', sp ? 'a month, last 90 days at ~2 t a shift' : 'no invoices to measure from') +
    tile('fill', 'Fills', fill != null ? Math.round(fill * 100) + '%' : '&mdash;', fill != null ? 'of the spare' : '', fill != null ? figToneCapacity(fill * 100) : '') +
    '</div><div class="inv-note" data-prs-chance>Weighted by the chance at each stage: new 10%, contacted 20%, sample 40%, quoted 60% (a working assumption).</div></div>';
}
function prsListHtml() {
  var q = _prsSearch.trim().toLowerCase();
  var list = getProspects().filter(function(p) {
    var st = prsStage(p);
    if (_prsStageFilter === 'open' && !prsOpen(p)) return false;
    if (_prsStageFilter !== 'open' && _prsStageFilter !== 'all' && st !== _prsStageFilter) return false;
    return !q || [p.name, p.contact, p.process, p.parts, p.phone, p.notes].join(' ').toLowerCase().indexOf(q) >= 0;
  });
  if (!list.length) return '<div class="inv-empty">' + (getProspects().length ? 'No prospect matches.' : 'No prospects yet. Add a firm you have approached, or mean to.') + '</div>';
  // Due first (most late first), then by the next follow-up, then the rest by name.
  list.sort(function(a, b) {
    var la = prsLate(a), lb = prsLate(b);
    if ((la != null) !== (lb != null)) return la != null ? -1 : 1;
    if (la != null && la !== lb) return lb - la;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  return '<div class="inv-panel inv-panel-flush">' + uiMoreHtml('prospects', list.map(prsRowHtml)) + '</div>';
}
function prsRenderView(container, tabsHtml) {
  var opts = [['open', 'Open']].concat(PRS_STAGES, [['all', 'All']]).map(function(o) {
    return '<option value="' + o[0] + '"' + (_prsStageFilter === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  }).join('');
  container.innerHTML = tabsHtml +
    '<div class="inv-toolbar"><label class="inv-search">' + ICON_SEARCH +
    '<input type="search" id="prsSearch" value="' + escHtml(_prsSearch) + '" placeholder="Search prospects" autocomplete="off" aria-label="Search prospects"></label>' +
    '<select class="inv-select inv-toolbar-item" id="prsStageFilter" aria-label="Stage">' + opts + '</select>' +
    '<button class="inv-btn inv-btn-primary" data-action="invPrsNew">Add prospect</button></div>' +
    prsSummaryHtml() + '<div id="prsList" class="inv-mt-8">' + prsListHtml() + '</div>';
}
function prsRenderList() { var el = document.getElementById('prsList'); if (el) el.innerHTML = prsListHtml(); }

/* ---------- The form ---------- */
function prsFormOpen(id) {
  var p = id ? prsFind(id) : null;
  var v = p || { name: '', contact: '', phone: '', email: '', process: '', parts: '', kgMonth: null, rate: null, stage: 'new', nextAt: isoAddDays(localDateStr(), 7), notes: '' };
  var f = function(fid, label, input, hint) { return '<div class="inv-field"><label class="inv-field-label" for="' + fid + '">' + label + '</label>' + input + (hint ? '<div class="inv-field-hint">' + hint + '</div>' : '') + '</div>'; };
  var inp = function(fid, val, extra) { return '<input class="inv-input" id="' + fid + '" value="' + escHtml(val == null ? '' : val) + '"' + (extra || '') + '>'; };
  var st = p ? prsStage(p) : 'new';
  var stages = PRS_STAGES.filter(function(s) { return s[0] !== 'won' || (p && p.clientId != null); }).map(function(s) {
    return '<option value="' + s[0] + '"' + (st === s[0] ? ' selected' : '') + '>' + s[1] + '</option>';
  }).join('');
  var qs = p ? prsQuotes(p) : [];
  var c = p && p.clientId != null ? (S.clients || []).find(function(x) { return x.id === p.clientId; }) : null;
  var log = p && (p.log || []).length ? '<div class="inv-panel inv-panel-flush inv-mt-8" data-prs-log><div class="inv-panel-head"><span class="inv-panel-title">Stages</span></div>' +
    p.log.slice().reverse().map(function(e) {
      return '<div class="inv-row"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(PRS_LABEL[e.stage] || e.stage) + '</span><span class="inv-row-meta">' +
        escHtml(formatTimestamp(e.at) + (e.note ? ' · ' + e.note : '')) + '</span></span></div>';
    }).join('') + '</div>' : '';
  var quotes = qs.length ? '<div class="inv-panel inv-panel-flush inv-mt-8" data-prs-quotes><div class="inv-panel-head"><span class="inv-panel-title">Quotations <span class="inv-panel-count">' + qs.length + '</span></span></div>' +
    qs.map(function(q) {
      return '<div class="inv-row inv-row-2"><button type="button" class="inv-row-main" data-action="invPrsQuote" data-qt="' + escHtml(q.id) + '"><span class="inv-row-title">' + escHtml(qtNumberText(q)) + '</span>' +
        '<span class="inv-row-meta">' + escHtml(formatDate(q.date)) + '</span></button><span class="inv-row-end">' + qtDotHtml(q) + '</span></div>';
    }).join('') + '</div>' : '';
  dialogOpen('<div class="inv-dialog" data-prs-dialog="' + escHtml(p ? p.id : 'new') + '" role="dialog" aria-modal="true" aria-labelledby="prsTitle">' +
    dialogHeadHtml('<span id="prsTitle">' + (p ? escHtml(p.name || 'Prospect') : 'Add prospect') + '</span>') +
    (c ? '<div class="inv-callout inv-callout-info">Won: now the client ' + escHtml(c.name) + '.</div>' : '') +
    f('prsName', 'Firm', inp('prsName', v.name, ' autocomplete="off"')) +
    '<div class="inv-fields">' + f('prsContact', 'Contact', inp('prsContact', v.contact)) + f('prsPhone', 'Phone', inp('prsPhone', v.phone, ' type="tel"')) + '</div>' +
    f('prsEmail', 'E-mail', inp('prsEmail', v.email, ' type="email"')) +
    f('prsProcess', 'Work', inp('prsProcess', v.process), 'The process and parts: zinc on clamps, tri-chrome yellow, barrel work …') +
    '<div class="inv-fields">' +
      f('prsKg', 'Tonnes a month', '<input class="inv-input inv-input-num" type="number" inputmode="decimal" min="0" step="any" id="prsKg" value="' + (v.kgMonth > 0 ? escHtml(String(v.kgMonth / 1000)) : '') + '">', 'As estimated') +
      f('prsRate', 'Target ₹/kg', '<input class="inv-input inv-input-num" type="number" inputmode="decimal" min="0" step="any" id="prsRate" value="' + (v.rate > 0 ? escHtml(String(v.rate)) : '') + '">') +
    '</div>' +
    '<div class="inv-fields">' +
      f('prsStage', 'Stage', '<select class="inv-select" id="prsStage">' + stages + '</select>', p && p.stage !== st ? 'Quoted, since a quotation was issued' : '') +
      f('prsNext', 'Next follow-up', '<input class="inv-input" type="date" id="prsNext" value="' + escHtml(v.nextAt || '') + '">') +
    '</div>' +
    f('prsLost', 'Why lost', inp('prsLost', v.lostReason || ''), 'Needed when the stage is Lost') +
    f('prsNotes', 'Notes', '<textarea class="inv-input" id="prsNotes" rows="3">' + escHtml(v.notes || '') + '</textarea>') +
    quotes + log +
    '<div class="inv-dialog-foot">' +
      (p ? '<button class="inv-btn inv-btn-secondary" data-action="invPrsDraft" data-id="' + escHtml(p.id) + '">Draft quotation</button>' : '') +
      (p && p.clientId == null && st !== 'lost' ? '<button class="inv-btn inv-btn-secondary" data-action="invPrsWin" data-id="' + escHtml(p.id) + '">Won: make client</button>' : '') +
      '<button class="inv-btn inv-btn-primary" data-action="invPrsSave" data-id="' + escHtml(p ? p.id : '') + '">' + (p ? 'Save' : 'Add prospect') + '</button>' +
    '</div></div>', { dismiss: true, replace: !!document.querySelector('[data-prs-dialog]') });
}
function prsVal(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
/* Read the form into a prospect; null (with a word) when it cannot be saved. */
function prsFromForm(p) {
  var name = prsVal('prsName');
  if (!name) { showToast('Name the firm', 'error'); return null; }
  var dup = getProspects().find(function(o) { return o !== p && rateKey(o.name) === rateKey(name); });
  if (dup) { showToast(name + ' is already a prospect', 'error'); return null; }
  var stage = prsVal('prsStage') || 'new', lost = prsVal('prsLost');
  if (stage === 'lost' && !lost) { showToast('Say why it was lost', 'error'); return null; }
  var kg = parseFloat(prsVal('prsKg')), rate = parseFloat(prsVal('prsRate'));
  return { name: name, contact: prsVal('prsContact'), phone: prsVal('prsPhone'), email: prsVal('prsEmail'), process: prsVal('prsProcess'),
    kgMonth: kg > 0 ? Math.round(kg * 1000) : null, rate: rate > 0 ? gstRound(rate) : null, stage: stage, nextAt: prsVal('prsNext') || null,
    lostReason: stage === 'lost' ? lost : '', notes: prsVal('prsNotes') };
}
function prsSave(id) {
  var p = id ? prsFind(id) : null, v = prsFromForm(p);
  if (!v) return null;
  var now = Date.now(), list = getProspects();
  if (!p) {
    p = Object.assign({ id: prsUid(), createdAt: now, log: [{ at: now, stage: v.stage }] }, v);
    list.push(p);
  } else {
    // A stage moved is a line in its log; the stage a quotation implied is written once somebody saves past it.
    if (v.stage !== p.stage) (p.log = p.log || []).push({ at: now, stage: v.stage, note: v.stage === 'lost' ? v.lostReason : '' });
    Object.assign(p, v);
  }
  p.updatedAt = now;
  saveState();
  closeOverlay();
  prsRenderList();
  prsRenderSummary();
  showToast(id ? 'Saved' : 'Prospect added: ' + p.name);
  return p;
}
function prsRenderSummary() {
  var el = document.querySelector('[data-card="prospects"]');
  if (el) el.outerHTML = prsSummaryHtml();
}
/* A quotation addressed to the prospect, at its target rate per kg: the Quotations' own form, nothing stored until saved. */
function prsDraft(id) {
  var p = prsFind(id);
  if (!p) return;
  closeOverlay();
  qtOpenDraft({ prospectId: p.id, to: { name: p.name, address: '', gstin: '', state: '', attn: p.contact || '' },
    lines: [{ item: p.process || '', partNumber: '', desc: '', basis: 'kg', rate: p.rate > 0 ? p.rate : null, refWeightKg: null, note: '' }],
    note: 'For the prospect ' + p.name + (p.kgMonth > 0 ? ', about ' + formatNum(p.kgMonth / 1000, 1) + ' t a month' : '') });
}
/* Won: the client form, filled from the prospect; saving it links the two (prsClientAdded). */
var _prsWinning = null;
function prsWin(id) {
  var p = prsFind(id);
  if (!p) return;
  _prsWinning = p.id;
  closeOverlay();
  _showClientOverlay(Object.assign(_blankClient(), { name: p.name, mobile: p.phone || '', email: p.email || '', notes: p.notes || '' }), true);
}
/* Called by the client form's add (clients.js) once the client is in the book. */
function prsClientAdded(c) {
  var p = _prsWinning && prsFind(_prsWinning);
  _prsWinning = null;
  if (!p || !c) return;
  var now = Date.now();
  p.clientId = c.id; p.stage = 'won'; p.wonAt = now; p.updatedAt = now;
  (p.log = p.log || []).push({ at: now, stage: 'won', note: 'now the client ' + c.name });
  // Its quotations go with it, so accepting one can post its rates to the client.
  prsQuotes(p).forEach(function(q) { if (q.clientId == null) q.clientId = c.id; });
}

/* ---------- The To-do: a follow-up due ---------- */
TODO_RULES.push(['prospectFollow', 'Prospects: a follow-up due']);
TODO_CHECK_DEFAULTS.prospectFollow = true;
TODO_RULE_FNS.prospectFollow = function() {
  var today = localDateStr();
  return getProspects().filter(function(p) { var l = prsLate(p, today); return l != null && l >= 0; }).map(function(p) {
    var late = prsLate(p, today);
    return { key: 'prospect:' + p.id, rule: 'prospectFollow', tone: late >= 7 ? 'red' : 'amber', title: 'Follow up ' + p.name,
      sub: (late ? late + ' d late' : 'due today') + ' · ' + PRS_LABEL[prsStage(p)], why: 'Prospects',
      facts: [['Stage', PRS_LABEL[prsStage(p)]], ['Follow-up', formatDate(p.nextAt)]].concat(p.kgMonth > 0 ? [['Tonnes a month', formatNum(p.kgMonth / 1000, 1) + ' t']] : []),
      clears: 'Clears itself when the next follow-up is moved on, or the prospect is won or lost.',
      go: { kind: 'prospect', id: p.id }, goLabel: 'Open', sig: p.nextAt + '|' + (late >= 7 ? 'r' : 'a') };
  });
};

/* ---------- Pulse: Is the plant full? ---------- */
/* The pipeline against the spare: a move only where there is spare and somebody to call. */
function prsPlantMove() {
  var sp = prsSpare(), pl = prsPipeline();
  if (!sp || !(sp.spareMonth > 0)) return null;
  var due = getProspects().filter(function(p) { var l = prsLate(p); return l != null && l >= 0; });
  var say = pl.n ? (due.length ? 'Follow up ' + todoPlural(due.length, 'prospect') + ': ' : 'Work the prospects: ') + formatNum(pl.weighted / 1000, 1) + ' t a month in the pipeline against ' + formatNum(sp.spareMonth / 1000, 1) + ' t spare'
    : 'List the firms to approach: ' + formatNum(sp.spareMonth / 1000, 1) + ' t a month spare';
  return { key: 'prospects', tone: due.length ? 'amber' : 'info', say: say,
    worth: pl.revenue > 0 ? { amount: pl.revenue, sign: 1, per: 'month', label: 'billed a month, weighted by stage' } : null,
    basis: pl.n ? todoPlural(pl.n, 'open prospect') + ', ' + formatNum(pl.kg / 1000, 1) + ' t if all came · the spare over the last 90 days at ~2 t a shift' : 'no prospect on the list',
    go: { kind: 'prospects' }, goLabel: 'Prospects', task: say };
}

/* The toolbar: the search on input, the stage on change (a select speaks through change, never click). */
function prsOnInput(el) {
  if (!el || el.id !== 'prsSearch') return false;
  _prsSearch = el.value; prsRenderList(); return true;
}
function prsOnChange(el) {
  if (!el || el.id !== 'prsStageFilter') return false;
  _prsStageFilter = el.value; prsRenderList(); return true;
}

function prsAction(action, btn) {
  switch (action) {
    case 'invPrsNew': prsFormOpen(null); return true;
    case 'invPrsOpen': prsFormOpen(btn.dataset.id); return true;
    case 'invPrsSave': prsSave(btn.dataset.id || null); return true;
    case 'invPrsDraft': prsDraft(btn.dataset.id); return true;
    case 'invPrsWin': prsWin(btn.dataset.id); return true;
    case 'invPrsQuote': closeOverlay(); qtOpen(btn.dataset.qt, true); return true;
  }
  return false;
}
