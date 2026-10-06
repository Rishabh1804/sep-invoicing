/* ===== THE PLANNER'S SCREENS (planner.js holds the engine; docs/PLANNER.md) =====
   Insights → Planner: Play · Ledger · A day · Plant · Tech tree · Staff · Clients · Finance. One scenario runs through every
   view; the heads-up strip is on each. The registers (machines, the CQI-11 checklist, lenders, rates heard, work held back) are
   edited here, behind Settings' permission: they are records of the shop. A scenario's moves are not: the page is a sandbox. */

var PLN_VIEWS = [['play', 'Play'], ['ledger', 'Ledger'], ['day', 'A day'], ['plant', 'Plant'], ['tech', 'Tech tree'], ['staff', 'Staff'], ['clients', 'Clients'], ['finance', 'Finance']];
var _plnView = (function() { try { var t = localStorage.getItem('sep_inv_planner_view'); return PLN_VIEWS.some(function(x) { return x[0] === t; }) ? t : 'play'; } catch (e) { return 'play'; } })();
var _plnMonth = 11;          // the month the strip, the Ledger and the day read (0 = next month)
var _plnMode = 'all';        // the Ledger: 'all' (every move landing) or 'expected' (weighted by each chance)
var _plnDayMode = 'plan';    // A day: 'plan' or 'now'
var _plnClient = null;       // Clients: the client open
var _plnResult = null;       // the last roll, kept while the scenario it rolled is unchanged
var _plnReplay = null;       // one trial, told
var _plnMoved = false;

function plnSetView(v) {
  if (!PLN_VIEWS.some(function(x) { return x[0] === v; })) v = 'play';
  if (v !== _plnView) _plnMoved = true;
  _plnView = v;
  try { localStorage.setItem('sep_inv_planner_view', v); } catch (e) { /* this device only */ }
}
function plnMonthLabel(m) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1 + m); return d.toLocaleString('en-IN', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2); }
function plnRs(n) { return n == null || !isFinite(n) ? '—' : formatInrShort(n); }
function plnSigned(n, exact) { if (n == null || !isFinite(n)) return '—'; var s = exact ? formatCurrency(Math.abs(n)) : formatInrShort(Math.abs(n)); return (n < -0.5 ? '−' : n > 0.5 ? '+' : '') + s; }
function plnKg(k) { return k >= 1000 ? formatNum(k / 1000, k >= 10000 ? 1 : 2) + ' t' : formatNum(k, 0) + ' kg'; }
function plnHm(h) { var m = Math.round((h || 0) * 60); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }
function plnLineName(l) { return (typeof PROD_LINE_LABEL !== 'undefined' && PROD_LINE_LABEL[l]) || l; }
function plnTone(v) { return v == null ? '' : v < 0 ? 'danger' : 'ok'; }

/* ---------- The page ---------- */
function renderPlanner() {
  var el = document.getElementById('plannerContent');
  if (!el) return;
  var B = plnBase();
  var h = '<div class="inv-viewtabs" role="tablist" aria-label="Planner">' + PLN_VIEWS.map(function(t) {
    return '<button class="inv-viewtab" role="tab" aria-selected="' + (_plnView === t[0]) + '" data-action="invPlnView" data-v="' + t[0] + '">' + t[1] + '</button>';
  }).join('') + '</div>';
  if (!B || !(B.kg > 0)) {
    el.innerHTML = h + '<div class="inv-empty">The planner starts from the book: it needs invoices with weights in the last three full months (' +
      escHtml(B ? formatDate(B.period.from) + ' to ' + formatDate(B.period.to) : '') + '). There are none yet.</div>' + plnRegistersOnlyHtml();
    viewTabReveal(el.querySelector('.inv-viewtabs'));
    return;
  }
  var sc = plnScenario();
  if (_plnResult && (!sc || _plnResult.key !== plnPlanned().key)) { _plnResult = null; _plnReplay = null; }
  h += plnToolbarHtml(sc) + plnGoalHtml(sc) + plnHudHtml();
  var body = { play: plnPlayHtml, ledger: plnLedgerHtml, day: plnDayHtml, plant: plnPlantHtml, tech: plnTechHtml, staff: plnStaffHtml, clients: plnClientsHtml, finance: plnFinanceHtml }[_plnView];
  h += body ? body() : '';
  el.innerHTML = h;
  viewTabReveal(el.querySelector('.inv-viewtabs'));
  if (_plnMoved) { _plnMoved = false; viewTop(); }
  plnReportRedraw();
}
/* With no baseline, the registers are still the owner's to keep. */
function plnRegistersOnlyHtml() {
  return '<div class="inv-panels">' + plnMachinesHtml() + plnLendersHtml() + '</div>';
}
function plnToolbarHtml(sc) {
  var list = plnScenarios();
  return '<div class="inv-toolbar">' +
    '<button class="inv-btn inv-btn-primary" data-action="invPlnRoll">' + (_plnResult ? 'Roll again' : 'Roll the trials') + '</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invPlnCard">New card</button>' +
    '<button class="inv-btn inv-btn-ghost" data-action="invPlnReport">Make the report</button>' +
    '<span class="inv-pl-chips">' + list.map(function(s) {
      return '<button class="inv-chip" aria-pressed="' + (sc && s.id === sc.id) + '" data-action="invPlnScenario" data-id="' + escHtml(s.id) + '">' + escHtml(s.name) + '</button>';
    }).join('') + '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPlnCopy">' + (list.length ? 'Copy' : 'Start a plan') + '</button>' +
    (sc ? '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPlnRename">Rename</button><button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPlnStart">Suggest a start</button>' +
      '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPlnClear">Start over</button>' : '') + '</span></div>';
}
function plnGoalHtml(sc) {
  var g = plnGoal(sc);
  return '<div class="inv-callout inv-callout-info inv-pl-goal"><span class="inv-seg inv-seg-fit" role="group" aria-label="Goal">' + PLN_GOALS.map(function(x) {
    return '<button class="inv-seg-btn" aria-pressed="' + (x.id === g.id) + '" data-action="invPlnGoal" data-id="' + x.id + '">' + x.label + '</button>';
  }).join('') + '</span><span><b>Goal:</b> ' + escHtml(g.say) + '.</span><span class="inv-badge inv-badge-info">Simulation · the book is not touched</span></div>';
}

/* The heads-up strip: the month (‹ ›), cash, margin against today's, kilos against what the lines can run, CQI-11, the score. */
function plnHudHtml() {
  var P = plnPlanned(_plnMode), B = P.B, mo = P.months[_plnMonth], base = P.base[_plnMonth], g = plnGoal(P.sc);
  var cap = 0, dem = 0; PLN_LINE_IDS.forEach(function(k) { cap += mo.lines[k].cap; dem += mo.lines[k].demand; });
  var used = cap > 0 ? Math.round(dem / cap * 100) : 0, cqi = P.ready.cqi, R = _plnResult;
  var stars = R ? (R.score >= 0.8 ? 3 : R.score >= 0.6 ? 2 : R.score >= 0.4 ? 1 : 0) : 0;
  var tile = function(key, label, value, sub, tone) { return '<div class="inv-tile' + (tone ? ' inv-tile-' + tone : '') + '" data-pl-hud="' + key + '"><div class="inv-tile-label">' + label + '</div><div class="inv-tile-value">' + value + '</div><div class="inv-tile-sub">' + sub + '</div></div>'; };
  return '<div class="inv-tiles inv-pl-hud">' +
    '<div class="inv-tile" data-pl-hud="month"><div class="inv-tile-label">Month</div><div class="inv-pl-step"><button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invPlnMonth" data-step="-1" aria-label="Month before"' + (_plnMonth ? '' : ' disabled') + '>&lsaquo;</button>' +
      '<span class="inv-tile-value">' + escHtml(plnMonthLabel(_plnMonth)) + '</span><button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invPlnMonth" data-step="1" aria-label="Month after"' + (_plnMonth < PLN_N - 1 ? '' : ' disabled') + '>&rsaquo;</button></div>' +
      '<div class="inv-tile-sub">turn ' + (_plnMonth + 1) + ' of ' + PLN_N + '</div></div>' +
    tile('cash', 'Cash', figWrapHtml(escHtml(plnRs(mo.cash))), escHtml(B.cash.src === 'statement' ? 'from ' + plnRs(B.cash.v) + ' on the statement, ' + formatDate(B.cash.on) : B.cash.src === 'set' ? 'from ' + plnRs(B.cash.v) + ', set on Finance' : 'no statement: set the cash on Finance'), mo.cash < 0 ? 'danger' : mo.cash < Math.abs(base.margin) * 2 ? 'warning' : 'ok') +
    tile('margin', 'Margin a month', escHtml(plnSigned(mo.margin)), escHtml('as it runs ' + plnSigned(base.margin) + ' · over full cost'), plnTone(mo.margin)) +
    tile('plated', 'Plated a month', escHtml(plnKg(mo.plated)), escHtml(used + '% of what the lines can run' + (mo.lostRev > 500 ? ' · ' + plnRs(mo.lostRev) + ' left unplated' : '')), used > 95 || mo.lostRev > 500 ? 'danger' : used > 85 ? 'warning' : '') +
    tile('cqi', 'CQI-11', cqi != null ? escHtml(plnMonthLabel(Math.min(PLN_N - 1, cqi))) : '<span class="inv-tile-value-sm">Not in the plan</span>', cqi != null ? (cqi <= g.cqi ? 'within the goal, if every step lands' : 'later than the goal') : 'Tech tree: CQI-11 self-assessed', cqi != null && cqi <= g.cqi ? 'ok' : 'warning') +
    '<div class="inv-tile' + (R ? (R.score >= 0.6 ? ' inv-tile-ok' : ' inv-tile-warning') : '') + '" data-pl-hud="score"><div class="inv-tile-label">Goal reached</div><div class="inv-tile-value">' + (R ? Math.round(R.score * 100) + '%' : '—') + '</div>' +
      '<div class="inv-tile-sub">' + plnStarsSvg(stars) + (R ? ' of ' + PLN_TRIALS + ' trials' : 'roll the trials') + '</div></div></div>';
}
function plnStarsSvg(n) {
  var star = function(x, onn) { return '<path transform="translate(' + x + ' 0)" d="M7 0.8 8.9 4.7 13.2 5.3 10.1 8.3 10.8 12.6 7 10.6 3.2 12.6 3.9 8.3 0.8 5.3 5.1 4.7Z" class="' + (onn ? 'inv-pl-star-on' : 'inv-pl-star') + '"/>'; };
  return '<svg class="inv-pl-stars" viewBox="0 0 46 14" role="img" aria-label="' + n + ' of 3 stars">' + star(0, n >= 1) + star(16, n >= 2) + star(32, n >= 3) + '</svg>';
}

/* ---------- The registers ---------- */
function plnRegGate(again) { return grdGate('settings', 'change the planner’s records', again); }
function _plnField(id, label, value, type, extra) {
  return '<label class="inv-field"><span class="inv-field-label">' + label + '</span><input class="inv-input' + (type === 'number' ? ' inv-input-num' : '') + '" id="' + id + '" type="' + (type || 'text') + '"' +
    (type === 'number' ? ' step="any" inputmode="decimal"' : '') + ' value="' + escHtml(value == null ? '' : String(value)) + '"' + (extra || '') + '></label>';
}
function _plnSelect(id, label, opts, value) {
  return '<label class="inv-field"><span class="inv-field-label">' + label + '</span><select class="inv-input" id="' + id + '">' + opts.map(function(o) {
    return '<option value="' + escHtml(o[0]) + '"' + (String(o[0]) === String(value == null ? '' : value) ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>';
  }).join('') + '</select></label>';
}
function _plnVal(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
function _plnNum(id) { var v = _plnVal(id); return v === '' || !isFinite(+v) ? null : +v; }
function plnRegFind(k, id) { return plnList(k).find(function(r) { return r && r.id === id; }) || null; }
function plnStationOpts() { return PLN_STATIONS.map(function(s) { return [s.id, s.name]; }); }
function plnClientOpts() { return (S.clients || []).map(function(c) { return [c.id, c.name]; }).sort(function(a, b) { return String(a[1]).localeCompare(String(b[1])); }); }

/* Machines and infrastructure: item, station, state, age, what it needs, and a risk the trials draw until its station's fix. */
function plnMachinesHtml() {
  var list = plnLive('machines');
  var st = function(s) { return PLN_MACHINE_STATES.find(function(x) { return x[0] === s; }) || PLN_MACHINE_STATES[1]; };
  return '<div class="inv-panel inv-panel-flush" id="plnMachines"><div class="inv-panel-head"><span class="inv-panel-title">Machines and infrastructure <span class="inv-panel-count">' + list.length + '</span></span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPlnRegEdit" data-k="machines">Add</button></div>' +
    (list.length ? list.map(function(x) {
      var s = st(x.state), stn = PLN_STATIONS.find(function(y) { return y.id === x.station; });
      var meta = [stn ? stn.name : '', x.age ? x.age : '', x.needs || '', x.risk && +x.risk.p > 0 ? Math.round(x.risk.p * 100) + '% a month: ' + (x.risk.say || 'breaks down') + (x.risk.cost ? ', ' + formatCurrency(x.risk.cost) : '') + (x.risk.days ? ', ' + x.risk.days + ' days down' : '') : ''].filter(Boolean).join(' · ');
      return '<div class="inv-row inv-row-2" data-pl-machine="' + escHtml(x.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(x.item) + '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(meta) + '</span></span>' +
        '<span class="inv-row-end"><span class="inv-dot inv-dot-' + s[2] + '">' + s[1] + '</span><button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPlnRegEdit" data-k="machines" data-id="' + escHtml(x.id) + '">Edit</button></span></div>';
    }).join('') : '<div class="inv-empty">No machine recorded. Each machine’s state and what it needs is a record of the shop; one that may break down carries a risk the trials draw, until the upgrade that fixes it.</div>') + '</div>';
}
function plnChecklistHtml() {
  var list = plnLive('checklist'), done = list.filter(function(x) { return x.status === 'in'; }).length;
  var tone = function(s) { return PLN_CHECK_STATUS.find(function(x) { return x[0] === s; }) || PLN_CHECK_STATUS[2]; };
  return '<div class="inv-panel inv-panel-flush" id="plnChecklist"><div class="inv-panel-head"><span class="inv-panel-title">The CQI-11 checklist <span class="inv-panel-count">' + done + ' of ' + list.length + '</span></span>' +
    '<span class="inv-toolbar inv-toolbar-tight">' + (list.length ? '' : '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPlnCheckSeed">Start from the standard’s sections</button>') +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPlnRegEdit" data-k="checklist">Add</button></span></div>' +
    (list.length ? uiMoreHtml('pln-check', list.map(function(x) {
      var t = tone(x.status), meta = [x.cost ? formatCurrency(x.cost) : '', x.owner || '', x.due ? 'due ' + formatDate(x.due) : '', x.evidence || ''].filter(Boolean).join(' · ');
      return '<div class="inv-row inv-row-2" data-pl-check="' + escHtml(x.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml((x.ref ? x.ref + ' · ' : '') + x.what) + '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(meta || 'nothing set') + '</span></span>' +
        '<span class="inv-row-end"><span class="inv-dot inv-dot-' + t[2] + '">' + t[1] + '</span><button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPlnRegEdit" data-k="checklist" data-id="' + escHtml(x.id) + '">Edit</button></span></div>';
    }), { n: 12, noun: 'items' }) : '<div class="inv-empty">No checklist yet. Start from the standard’s sections, then set each item’s status, cost and who owns it; the AIAG manual is the source.</div>') + '</div>';
}
function plnLendersHtml() {
  var list = plnLive('lenders'), sc = plnScenario();
  return '<div class="inv-panel inv-panel-flush" id="plnLenders"><div class="inv-panel-head"><span class="inv-panel-title">Lenders <span class="inv-panel-count">' + list.length + '</span></span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPlnRegEdit" data-k="lenders">Add</button></div>' +
    (list.length ? list.map(function(x) {
      var inPlay = sc && sc.loan && sc.loan.lenderId === x.id, st = PLN_LENDER_STATUS.find(function(s) { return s[0] === x.status; });
      var meta = [x.amount ? formatCurrency(x.amount) : 'amount to agree', x.rate != null && x.rate !== '' ? x.rate + '% a year' : 'rate to agree', x.months ? x.months + ' months' : '', x.mor ? x.mor + ' interest only' : '', x.ties || '', st ? st[1] : ''].filter(Boolean).join(' · ');
      return '<div class="inv-row inv-row-2" data-pl-lender="' + escHtml(x.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(x.who) + '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(meta) + '</span></span>' +
        '<span class="inv-row-end">' + (sc ? '<button class="inv-btn inv-btn-sm ' + (inPlay ? 'inv-btn-secondary' : 'inv-btn-ghost') + '" data-action="invPlnLoan" data-id="' + escHtml(x.id) + '">' + (inPlay ? 'In play · take out' : 'Play') + '</button>' : '') +
        '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPlnRegEdit" data-k="lenders" data-id="' + escHtml(x.id) + '">Edit</button></span></div>';
    }).join('') : '<div class="inv-empty">No lender recorded. A lender’s offer (amount, rate, months, what it ties) is a record; play one as the scenario’s loan.</div>') + '</div>';
}
function plnHeardHtml() {
  var list = plnLive('heard').slice().sort(function(a, b) { return String(b.on || '').localeCompare(String(a.on || '')); });
  return '<div class="inv-panel inv-panel-flush" id="plnHeard"><div class="inv-panel-head"><span class="inv-panel-title">Rates heard <span class="inv-panel-count">' + list.length + '</span></span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPlnRegEdit" data-k="heard">Add</button></div>' +
    (list.length ? list.map(function(x) {
      return '<div class="inv-row inv-row-2" data-pl-heard="' + escHtml(x.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(x.what) + '</span><span class="inv-row-meta inv-row-wrap">' +
        escHtml([x.from ? 'from ' + x.from : '', x.on ? formatDate(x.on) : '', 'one report'].filter(Boolean).join(' · ')) + '</span></span><span class="inv-row-end"><span class="inv-num">' + escHtml(x.value || '') + '</span>' +
        '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPlnRegEdit" data-k="heard" data-id="' + escHtml(x.id) + '">Edit</button></span></div>';
    }).join('') : '<div class="inv-empty">Nothing heard yet: a rate a client says another plater charges, a certificate a competitor holds. One report is one report: it names who said it and when.</div>') + '</div>';
}
function plnHeldHtml(clientId) {
  var list = plnLive('heldBack').filter(function(x) { return clientId == null || String(x.clientId) === String(clientId); });
  return '<div class="inv-panel inv-panel-flush" id="plnHeld"><div class="inv-panel-head"><span class="inv-panel-title">Work held back <span class="inv-panel-count">' + list.length + '</span></span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPlnRegEdit" data-k="heldBack"' + (clientId != null ? ' data-client="' + escHtml(String(clientId)) + '"' : '') + '>Add</button></div>' +
    (list.length ? list.map(function(x) { return plnHeldRowHtml(x, clientId == null); }).join('') :
      '<div class="inv-empty">' + (clientId != null ? 'Nothing recorded as held back by this client.' : 'Nothing recorded as held back.') + ' Work a client sends elsewhere for want of certificates, turnaround or approval is a record: its tonnes, rate and line, and your read of the chance.</div>') + '</div>';
}
function plnHeldRowHtml(x, named) {
  var sc = plnScenario(), k = 'held:' + x.id, inPlan = sc && (sc.plan || {})[k] != null;
  var meta = [named ? plnClientNameOf(x.clientId) : '', PLN_HELD_WHY[x.why] || '', plnKg(+x.kg || 0) + ' a month at ₹' + formatNum(+x.rate || 0, 2) + '/kg', plnLineName(x.line || 'vat-a2'), Math.round((x.chance != null ? x.chance : 0.5) * 10) + ' in 10', x.note || ''].filter(Boolean).join(' · ');
  var needs = (PLN_HELD_NEEDS[x.why] || []).map(plnNameOf).join(', ');
  return '<div class="inv-row inv-row-2" data-pl-held="' + escHtml(x.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(PLN_HELD_WHY[x.why] || 'Held back') + '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(meta + (needs ? ' · needs ' + needs : '')) + '</span></span>' +
    '<span class="inv-row-end">' + plnMoveCtlHtml(k, inPlan, -1) + '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPlnRegEdit" data-k="heldBack" data-id="' + escHtml(x.id) + '">Edit</button></span></div>';
}

/* One dialog per register: add or edit; retire with a reason (never deleted). */
var PLN_REG_NOUN = { machines: 'machine', checklist: 'checklist item', lenders: 'lender', heard: 'rate heard', heldBack: 'work held back' };
function plnRegEdit(k, id, clientId) {
  if (!plnRegGate(function() { plnRegEdit(k, id, clientId); })) return;
  var x = id ? plnRegFind(k, id) : null, v = x || {}, f = '';
  if (k === 'machines') f = _plnField('plnRItem', 'Machine or item', v.item) + _plnSelect('plnRStation', 'Station', plnStationOpts(), v.station) +
    _plnSelect('plnRLine', 'Line it stops when it fails', [['', 'None']].concat(PLN_LINE_IDS.map(function(l) { return [l, plnLineName(l)]; })), v.line) +
    _plnSelect('plnRState', 'State', PLN_MACHINE_STATES.map(function(s) { return [s[0], s[1]]; }), v.state || 'fair') + _plnField('plnRAge', 'Age', v.age) + _plnField('plnRNeeds', 'What it needs', v.needs) +
    _plnField('plnRRiskP', 'Chance it fails in a month, %', v.risk && v.risk.p != null ? Math.round(v.risk.p * 1000) / 10 : '', 'number') + _plnField('plnRRiskCost', 'What a failure costs, ₹', v.risk ? v.risk.cost : '', 'number') +
    _plnField('plnRRiskDays', 'Days the line is down', v.risk ? v.risk.days : '', 'number') + _plnField('plnRRiskSay', 'What failing means', v.risk ? v.risk.say : '');
  else if (k === 'checklist') f = _plnField('plnRRef', 'Reference', v.ref) + _plnField('plnRWhat', 'What it asks', v.what) + _plnSelect('plnRStatus', 'Status', PLN_CHECK_STATUS.map(function(s) { return [s[0], s[1]]; }), v.status || 'missing') +
    _plnField('plnRCost', 'Cost to close, ₹', v.cost, 'number') + _plnField('plnROwner', 'Who owns it', v.owner) + _plnField('plnRDue', 'Due', v.due, 'date') + _plnField('plnREvidence', 'Evidence', v.evidence);
  else if (k === 'lenders') f = _plnField('plnRWho', 'Who', v.who) + _plnField('plnRAmount', 'Amount, ₹', v.amount, 'number') + _plnField('plnRRate', 'Interest, % a year', v.rate, 'number') +
    _plnField('plnRMonths', 'Months to repay', v.months, 'number') + _plnField('plnRMor', 'Interest-only months first', v.mor, 'number') + _plnField('plnRTies', 'What it ties (a rate held, set-off)', v.ties) +
    _plnSelect('plnRStatus', 'Status', PLN_LENDER_STATUS, v.status || 'offered');
  else if (k === 'heard') f = _plnField('plnRWhat', 'What was heard', v.what) + _plnField('plnRValue', 'The figure (₹14.50/kg, a certificate)', v.value) + _plnField('plnRFrom', 'Who said it', v.from) + _plnField('plnROn', 'When', v.on || localDateStr(), 'date');
  else if (k === 'heldBack') f = _plnSelect('plnRClient', 'Client', plnClientOpts(), v.clientId != null ? v.clientId : clientId) + _plnSelect('plnRWhy', 'Held back for', Object.keys(PLN_HELD_WHY).map(function(w) { return [w, PLN_HELD_WHY[w]]; }), v.why || 'cert') +
    _plnField('plnRKg', 'Kilos a month', v.kg, 'number') + _plnField('plnRRate', 'At ₹ a kg', v.rate, 'number') + _plnSelect('plnRLine', 'On the line', PLN_LINE_IDS.map(function(l) { return [l, plnLineName(l)]; }), v.line || 'vat-a2') +
    _plnField('plnRChance', 'Chance they send it, in 10', v.chance != null ? Math.round(v.chance * 10) : 5, 'number', ' min="1" max="10"') + _plnField('plnRNote', 'Note', v.note);
  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml((x ? 'Edit ' : 'Add ') + PLN_REG_NOUN[k]) + '<div class="inv-fields">' + f + '</div>' +
    '<div class="inv-dialog-foot">' + (x ? '<button class="inv-btn inv-btn-danger" data-action="invPlnRegRetire" data-k="' + k + '" data-id="' + escHtml(x.id) + '">Retire</button>' : '') +
    '<button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPlnRegSave" data-k="' + k + '"' + (x ? ' data-id="' + escHtml(x.id) + '"' : '') + '>Save</button></div></div>', { dismiss: true });
}
function plnRegSave(k, id) {
  if (!plnRegGate(function() { plnRegSave(k, id); })) return;
  var p = plnData(), list = p[k], x = id ? list.find(function(r) { return r.id === id; }) : null, rec = {};
  if (k === 'machines') {
    var pr = _plnNum('plnRRiskP');
    rec = { item: _plnVal('plnRItem'), station: _plnVal('plnRStation'), line: _plnVal('plnRLine') || null, state: _plnVal('plnRState'), age: _plnVal('plnRAge'), needs: _plnVal('plnRNeeds'),
      risk: pr > 0 ? { p: Math.min(100, pr) / 100, cost: _plnNum('plnRRiskCost') || 0, days: _plnNum('plnRRiskDays') || 0, say: _plnVal('plnRRiskSay') } : null };
    if (!rec.item) return uiAlert({ title: 'Name the machine', body: 'A machine needs a name.' });
  } else if (k === 'checklist') {
    rec = { ref: _plnVal('plnRRef'), what: _plnVal('plnRWhat'), status: _plnVal('plnRStatus'), cost: _plnNum('plnRCost'), owner: _plnVal('plnROwner'), due: _plnVal('plnRDue') || null, evidence: _plnVal('plnREvidence') };
    if (!rec.what) return uiAlert({ title: 'Say what it asks', body: 'A checklist item needs what it asks.' });
  } else if (k === 'lenders') {
    rec = { who: _plnVal('plnRWho'), amount: _plnNum('plnRAmount'), rate: _plnNum('plnRRate'), months: _plnNum('plnRMonths'), mor: _plnNum('plnRMor'), ties: _plnVal('plnRTies'), status: _plnVal('plnRStatus') };
    if (!rec.who) return uiAlert({ title: 'Name the lender', body: 'A lender needs a name.' });
  } else if (k === 'heard') {
    rec = { what: _plnVal('plnRWhat'), value: _plnVal('plnRValue'), from: _plnVal('plnRFrom'), on: _plnVal('plnROn') || null };
    if (!rec.what) return uiAlert({ title: 'Say what was heard', body: 'A rate heard needs what was heard.' });
  } else if (k === 'heldBack') {
    var ch = _plnNum('plnRChance');
    rec = { clientId: _plnVal('plnRClient'), why: _plnVal('plnRWhy'), kg: _plnNum('plnRKg'), rate: _plnNum('plnRRate'), line: _plnVal('plnRLine'), chance: ch != null ? Math.max(1, Math.min(10, ch)) / 10 : 0.5, note: _plnVal('plnRNote') };
    if (!(rec.kg > 0) || !(rec.rate > 0)) return uiAlert({ title: 'Kilos and a rate', body: 'Work held back needs its kilos a month and the rate it would come at.' });
    var cl = (S.clients || []).find(function(c) { return String(c.id) === String(rec.clientId); }); if (cl) rec.clientId = cl.id;
  }
  if (x) Object.assign(x, rec, { at: Date.now(), by: plnWho() });
  else list.push(Object.assign({ id: plnId(k.slice(0, 2).toUpperCase()) }, rec, { at: Date.now(), by: plnWho() }));
  closeOverlay();
  saveState();
  renderPlanner();
  showToast(x ? 'Saved' : 'Added');
}
function plnRegRetire(k, id) {
  if (!plnRegGate(function() { plnRegRetire(k, id); })) return;
  var x = plnRegFind(k, id);
  if (!x) return;
  uiPrompt({ title: 'Retire this ' + PLN_REG_NOUN[k], label: 'Why (kept with the record)', required: true }).then(function(reason) {
    if (!reason) return;
    x.retiredAt = Date.now(); x.retireReason = reason; x.retiredBy = plnWho();
    // A scenario move on it goes: there is nothing left for it to stand on.
    plnScenarios().forEach(function(s) { if (s.plan) delete s.plan['held:' + id]; if (s.loan && s.loan.lenderId === id) s.loan = null; });
    closeOverlay();
    saveState();
    renderPlanner();
    showToast('Retired');
  });
}
function plnCheckSeed() {
  if (!plnRegGate(plnCheckSeed)) return;
  var p = plnData();
  if (plnLive('checklist').length) return;
  PLN_CHECK_SEED.forEach(function(c) { p.checklist.push({ id: plnId('CH'), ref: c[0], what: c[1], status: 'missing', at: Date.now(), by: plnWho() }); });
  saveState();
  renderPlanner();
}

/* ---------- Scenario moves ---------- */
function plnMoveCtlHtml(key, inPlan, dflt) {
  var sc = plnScenario(), at = inPlan && sc ? sc.plan[key] : null;
  if (!inPlan) return '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPlnPlan" data-key="' + escHtml(key) + '" data-at="' + (dflt == null ? 1 : dflt) + '">Plan it</button>';
  return '<span class="inv-pl-when"><button class="inv-btn inv-btn-icon inv-btn-ghost inv-btn-sm" data-action="invPlnShift" data-key="' + escHtml(key) + '" data-step="-1" aria-label="Earlier">&lsaquo;</button>' +
    '<span class="inv-num">' + escHtml(at < 0 ? 'once ready' : plnMonthLabel(at)) + '</span><button class="inv-btn inv-btn-icon inv-btn-ghost inv-btn-sm" data-action="invPlnShift" data-key="' + escHtml(key) + '" data-step="1" aria-label="Later">&rsaquo;</button>' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost inv-btn-sm" data-action="invPlnTake" data-key="' + escHtml(key) + '" aria-label="Take out">&times;</button></span>';
}
function plnEdit(fn) {
  var sc = plnScenarioEnsure();
  sc.plan = sc.plan || {}; sc.asks = sc.asks || {}; sc.cards = sc.cards || [];
  fn(sc);
  sc.at = Date.now();
  _plnResult = null; _plnReplay = null;
  saveState();
  renderPlanner();
}
function plnNameOf(k) {
  var r = null;
  PLN_STATIONS.forEach(function(s) { s.levels.forEach(function(lv) { if (lv.id === k) r = s.name + ': ' + lv.t; }); });
  if (r) return r;
  if (k === 'specialist') return 'a plating specialist, hired or promoted';
  var x = PLN_ROLES.find(function(y) { return y.id === k; }) || PLN_TECH.find(function(y) { return y.id === k; });
  if (x) return x.t;
  return String(k).split('|').map(function(y) { return y === k ? y : plnNameOf(y); }).join(' or ');
}

/* ---------- Actions ---------- */
function plannerAction(action, btn) {
  var d = btn.dataset;
  switch (action) {
    case 'invPlnView': plnSetView(d.v); renderPlanner(); return true;
    case 'invPlnMonth': _plnMonth = Math.max(0, Math.min(PLN_N - 1, _plnMonth + (+d.step || 0))); renderPlanner(); return true;
    case 'invPlnGoal': plnEdit(function(sc) { sc.goal = d.id; }); return true;
    case 'invPlnScenario': plnData().active = d.id; _plnResult = null; _plnReplay = null; saveState(); renderPlanner(); return true;
    case 'invPlnCopy': plnScenarioCopy(); return true;
    case 'invPlnRename': plnScenarioRename(); return true;
    case 'invPlnClear': plnScenarioClear(); return true;
    case 'invPlnStart': plnEdit(plnSuggestStart); return true;
    case 'invPlnPlan': plnEdit(function(sc) { sc.plan[d.key] = +d.at; if (/^ask:/.test(d.key) && !sc.asks[d.key.slice(4)]) sc.asks[d.key.slice(4)] = {}; }); return true;
    case 'invPlnTake': plnEdit(function(sc) { delete sc.plan[d.key]; }); return true;
    case 'invPlnShift': plnEdit(function(sc) {
      var at = sc.plan[d.key], step = +d.step || 0;
      if (at == null) return;
      if (at < 0) sc.plan[d.key] = step > 0 ? Math.max(0, plnPlanned().ready.cqi || 0) : -1;
      else sc.plan[d.key] = Math.max(/^held:/.test(d.key) ? -1 : 0, Math.min(PLN_N - 1, at + step));
    }); return true;
    case 'invPlnLoan': plnLoanToggle(d.id); return true;
    case 'invPlnLoanShift': plnEdit(function(sc) { if (sc.loan) sc.loan.at = Math.max(0, Math.min(PLN_N - 1, (sc.loan.at || 0) + (+d.step || 0))); }); return true;
    case 'invPlnRegEdit': plnRegEdit(d.k, d.id, d.client); return true;
    case 'invPlnRegSave': plnRegSave(d.k, d.id); return true;
    case 'invPlnRegRetire': plnRegRetire(d.k, d.id); return true;
    case 'invPlnCheckSeed': plnCheckSeed(); return true;
    case 'invPlnClient': _plnClient = d.id; renderPlanner(); return true;
    case 'invPlnMode': _plnMode = d.id === 'expected' ? 'expected' : 'all'; renderPlanner(); return true;
    case 'invPlnDayMode': _plnDayMode = d.id === 'now' ? 'now' : 'plan'; renderPlanner(); return true;
    case 'invPlnLedgerMonth': _plnMonth = +d.m; renderPlanner(); return true;
    case 'invPlnRoll': plnRoll(); return true;
    case 'invPlnReplay': plnReplayOne(); return true;
    case 'invPlnCard': plnCardEdit(d.id); return true;
    case 'invPlnCardSave': plnCardSave(d.id); return true;
    case 'invPlnCardRetire': plnCardRemove(d.id); return true;
    case 'invPlnCfg': plnCfgEdit(); return true;
    case 'invPlnCost': plnCostEdit(d.id); return true;
    case 'invPlnCfgSave': plnCfgSave(); return true;
    case 'invPlnReport': plnReportOpen(); return true;
  }
  return false;
}
/* Typed figures on a scenario (an ask, a part's rate, the loan's terms, a role's chance) speak through change. */
function plannerOnChange(t) {
  if (!t || !t.dataset) return false;
  var d = t.dataset;
  if (d.plAsk) { plnEdit(function(sc) { var o = sc.asks[d.client] || (sc.asks[d.client] = {}); var v = t.value === '' ? null : +t.value; if (d.plAsk === 'p') o.p = v == null ? null : Math.max(1, Math.min(10, v)) / 10; else o[d.plAsk] = v; }); return true; }
  if (d.plPart) { plnEdit(function(sc) { var o = sc.asks[d.client] || (sc.asks[d.client] = {}); o.parts = o.parts || {}; if (t.value === '') delete o.parts[d.plPart]; else o.parts[d.plPart] = +t.value; }); return true; }
  if (d.plLoan) { plnEdit(function(sc) { if (!sc.loan) return; var v = +t.value; sc.loan[d.plLoan] = isFinite(v) && v >= 0 ? v : 0; if (sc.loan.months <= sc.loan.mor) sc.loan.months = sc.loan.mor + 1; }); return true; }
  if (d.plChance) { plnEdit(function(sc) { sc.chances = sc.chances || {}; var v = +t.value; sc.chances[d.plChance] = isFinite(v) ? Math.max(1, Math.min(10, v)) / 10 : null; }); return true; }
  if (d.plCardKind) { var title = _plnVal('plnCTitle'); plnCardEdit(d.plCardId || '', t.value, title); return true; }
  return false;
}

/* ---------- Scenarios ---------- */
function plnScenarioCopy() {
  var p = plnData(), cur = plnScenario();
  var s = cur ? JSON.parse(JSON.stringify(cur)) : { goal: 'normal', plan: {}, asks: {}, loan: null, cards: [] };
  s.id = plnId('SC'); s.name = cur ? cur.name + ' (copy)' : 'My plan'; s.at = Date.now(); s.by = plnWho();
  p.scenarios.push(s); p.active = s.id;
  _plnResult = null;
  saveState();
  renderPlanner();
}
function plnScenarioRename() {
  var sc = plnScenario();
  if (!sc) return;
  uiPrompt({ title: 'Rename the plan', label: 'Name', required: true, value: sc.name }).then(function(v) { if (v) plnEdit(function(s) { s.name = String(v).slice(0, 40); }); });
}
function plnScenarioClear() {
  var sc = plnScenario();
  if (!sc) return;
  uiConfirm({ title: 'Start this plan over?', body: 'Every move in “' + sc.name + '” is taken out. The registers are not touched.', okLabel: 'Start over', danger: true }).then(function(ok) {
    if (ok) plnEdit(function(s) { s.plan = {}; s.asks = {}; s.loan = null; s.cards = []; });
  });
}
/* The CQI-11 path at its earliest: the lab, the records, a lab hand, the supervisor trained, bath analysis, the tests. */
function plnSuggestStart(sc) {
  ['lab1', 'lab2', 'a1Log', 'docs', 'course', 'labHand', 'promote'].forEach(function(k) { if (sc.plan[k] == null) sc.plan[k] = 1; });
  ['bath', 'test'].forEach(function(k) { if (sc.plan[k] == null) sc.plan[k] = 2; });
  if (sc.plan.cqi == null) sc.plan.cqi = 3;
}
function plnLoanToggle(id) {
  var l = plnRegFind('lenders', id);
  if (!l) return;
  plnEdit(function(sc) {
    if (sc.loan && sc.loan.lenderId === id) { sc.loan = null; return; }
    sc.loan = { lenderId: id, who: l.who, amt: +l.amount || 500000, rate: l.rate != null && l.rate !== '' ? +l.rate : 12, months: +l.months || 24, mor: +l.mor || 0, at: 0, ties: l.ties || '' };
  });
}

/* ---------- The views (PL2–PL4 fill these) ---------- */
function plnPlayHtml() { return '<div class="inv-panels">' + plnLendersHtml() + '</div>'; }
function plnLedgerHtml() {
  var P = plnPlanned(_plnMode), m = _plnMonth, mo = P.months[m], b = P.base[m], B = P.B;
  var rows = [
    ['Plated', function(x) { return plnKg(x.plated); }],
    ['Revenue', function(x) { return plnRs(x.rev); }],
    ['Labour', function(x) { return plnRs(-(x.cost.labourFixed + x.cost.labourPool + x.cost.labourOt)); }],
    ['New hires', function(x) { return x.cost.hires ? plnRs(-x.cost.hires) : '—'; }],
    ['Zinc and chemicals', function(x) { return plnRs(-(x.cost.zinc + x.cost.chem)); }],
    ['Power and upkeep', function(x) { return plnRs(-(x.cost.power + x.cost.other)); }],
    ['Interest', function(x) { return x.interest ? plnRs(-x.interest) : '—'; }],
    ['Margin', function(x) { return plnSigned(x.margin); }, 'margin'],
    ['Spend', function(x) { return x.capex ? plnRs(-x.capex) : '—'; }],
    ['Loan in or repaid', function(x) { return x.loanIn ? plnSigned(x.loanIn) : x.principal ? plnRs(-x.principal) : '—'; }],
    ['Cash', function(x) { return plnRs(x.cash); }, 'cash']];
  var tone = function(r, x) { return r[2] === 'margin' ? (x.margin < 0 ? ' inv-num-neg' : ' inv-num-pos') : r[2] === 'cash' && x.cash < 0 ? ' inv-num-neg' : ''; };
  var h = '<div class="inv-panel inv-panel-flush" id="plnLedger"><div class="inv-panel-head"><span class="inv-panel-title">Month by month</span>' +
    '<span class="inv-seg inv-seg-fit" role="group" aria-label="Read the plan"><button class="inv-seg-btn" aria-pressed="' + (_plnMode === 'all') + '" data-action="invPlnMode" data-id="all">If every move lands</button>' +
    '<button class="inv-seg-btn" aria-pressed="' + (_plnMode === 'expected') + '" data-action="invPlnMode" data-id="expected">Weighted by each chance</button></span></div>' +
    '<div class="inv-scroll-x"><table class="inv-table inv-table-grid inv-pl-ledger"><thead><tr><th scope="col">' + escHtml(B.wd + ' working days a month') + '</th><th scope="col">As it runs</th>' +
    P.months.map(function(x, i) { return '<th scope="col"' + (i === m ? ' aria-current="date"' : '') + '><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPlnLedgerMonth" data-m="' + i + '">' + escHtml(plnMonthLabel(i)) + '</button></th>'; }).join('') +
    '</tr></thead><tbody>' + rows.map(function(r) {
      return '<tr' + (r[2] ? ' class="inv-row-strong"' : '') + '><th scope="row">' + r[0] + '</th><td class="inv-num">' + escHtml(r[1](P.base[0])) + '</td>' +
        P.months.map(function(x, i) { return '<td class="inv-num' + tone(r, x) + '"' + (i === m ? ' aria-current="date"' : '') + '>' + escHtml(r[1](x)) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div></div>';
  var at = plnAttribution(m, _plnMode);
  h += '<div class="inv-panels"><div class="inv-panel inv-panel-flush" id="plnBuild"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(plnMonthLabel(m)) + ': how the margin adds up</span>' +
    '<span class="inv-panel-count">' + (_plnMode === 'expected' ? 'each move × its chance' : 'every move landing') + '</span></div>' +
    plnBuildRow('As it runs', 'today’s average month, from the book', at.base, 'base') +
    at.rows.map(function(r) { return plnBuildRow(r.mv.label, (Math.abs(r.kg) >= 1 ? (r.kg > 0 ? '+' : '−') + plnKg(Math.abs(r.kg)) + ' plated · ' : '') + (r.ready != null ? 'takes effect ' + plnMonthLabel(Math.min(PLN_N - 1, r.ready)) : 'never takes effect'), r.margin, r.mv.lane); }).join('') +
    (at.idle.length ? '<div class="inv-row inv-row-2 inv-row-muted"><span class="inv-row-main"><span class="inv-row-title">' + at.idle.length + ' more in the plan, nothing in this month’s margin</span><span class="inv-row-meta inv-row-wrap">' +
      escHtml(at.idle.map(function(r) { return r.mv.label; }).join(', ')) + '</span></span><span class="inv-row-end"><span class="inv-num">₹0</span></span></div>' : '') +
    plnBuildRow('The plan', 'the rows above, added up', at.plan, 'plan') +
    '<div class="inv-panel-body inv-note">The moves are added one at a time, in the order they take effect: each row is what it added on top of the rows above, so they add up to the plan. A wage or upkeep shows where it starts; what it opens shows on the move it opens. One-off spend is on the table’s Spend row.</div></div>';
  h += '<div class="inv-panel inv-panel-flush" id="plnCosts"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(plnMonthLabel(m)) + ': the cost lines</span><span class="inv-panel-count">' + escHtml(plnKg(mo.plated)) + '</span></div>' +
    plnCostRows(mo, b).map(function(r) {
      return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + r[0] + '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(r[3]) + '</span></span>' +
        '<span class="inv-row-end inv-row-end-stack"><span class="inv-num">' + escHtml(formatCurrency(r[1])) + '</span><span class="inv-row-meta">' + escHtml(Math.abs(r[1] - r[2]) >= 1 ? plnSigned(r[1] - r[2], true) : 'as now') + '</span></span></div>';
    }).join('') + '<div class="inv-panel-body"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPlnCfg">Set the assumptions</button></div></div>';
  var clients = B.clients.concat([{ id: 'card', name: 'Your cards' }]);
  h += '<div class="inv-panel inv-panel-flush" id="plnByClient"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(plnMonthLabel(m)) + ': revenue by client</span><span class="inv-panel-count">kilos plated × each part’s rate</span></div>' +
    uiMoreHtml('pln-clients', clients.map(function(c) {
      var a = mo.byClient[c.id] || 0, bb = b.byClient[c.id] || 0;
      if (!a && !bb) return '';
      var kg = mo.rows.filter(function(r) { return r.client === c.id; }).reduce(function(s, r) { return s + r.kgMo; }, 0);
      return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(c.id === 'card' ? c.name : plnClientShort(c)) + '</span><span class="inv-row-meta">' + escHtml(plnKg(kg) + (kg ? ' · ₹' + formatNum(a / kg, 2) + '/kg' : '')) + '</span></span>' +
        '<span class="inv-row-end inv-row-end-stack"><span class="inv-num">' + escHtml(formatCurrency(a)) + '</span><span class="inv-row-meta">' + escHtml(Math.abs(a - bb) >= 1 ? plnSigned(a - bb, true) : 'as now') + '</span></span></div>';
    }).filter(Boolean), { n: 10, noun: 'clients' }) +
    (B.unweighed > 0.5 ? '<div class="inv-panel-body inv-note">' + escHtml(formatCurrency(B.unweighed) + ' a month is billed on lines with no weight: revenue without kilos, kept as it is.') + '</div>' : '') + '</div></div>';
  return h;
}
function plnBuildRow(title, meta, v, kind) {
  var strong = kind === 'base' || kind === 'plan';
  return '<div class="inv-row inv-row-2' + (strong ? ' inv-row-strong' : '') + '" data-pl-build="' + escHtml(kind) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(title) + '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(meta) + '</span></span>' +
    '<span class="inv-row-end"><span class="inv-num' + (strong ? '' : v < 0 ? ' inv-num-neg' : ' inv-num-pos') + '">' + escHtml(plnSigned(v, true)) + '</span></span></div>';
}
/* Each cost line of a month, against the same month as it runs, with what it is made of. */
function plnCostRows(mo, b) {
  var c = mo.cost, bc = b.cost, C = _plnBase.cost, cfg = plnCfg(), src = function(k) { var s = C.src[k]; return s === 'measured' ? 'measured' : s === 'model' ? 'the model' : s === 'bank' ? 'paid, bank' : 'part-recorded'; };
  return [['Labour, monthly crew', c.labourFixed, bc.labourFixed, 'fixed: as recorded, ' + src('labour')],
    ['Labour, the hourly pool', c.labourPool, bc.labourPool, 'the general shift as recorded'],
    ['Overtime and EXTRA', c.labourOt, bc.labourOt, 'as it runs, plus ' + formatCurrency(cfg.otLineHour) + ' a new overtime line-hour (assumed)'],
    ['New hires', c.hires, bc.hires, 'the plan’s wages (Staff)'],
    ['Zinc', c.zinc, bc.zinc, '₹' + formatNum(C.zincKg, 2) + '/kg plated, ' + src('zinc')],
    ['Chemicals', c.chem, bc.chem, '₹' + formatNum(C.chemKg, 2) + '/kg plated, ' + src('chem')],
    ['Electricity', c.power, bc.power, formatCurrency(C.powerFixed) + ' fixed (assumed) + ₹' + formatNum(C.powerKg, 2) + '/kg, ' + src('power')],
    ['Consumables, effluent, upkeep', c.other, bc.other, '₹' + formatNum(C.otherKg, 2) + '/kg plated, ' + src('other')]];
}
function plnDayHtml() { return ''; }

/* ---------- Plant: what each line can do, the machines, an upgrade tree per station ---------- */
function plnPlantHtml() {
  var P = plnPlanned(_plnMode), mo = P.months[_plnMonth], B = P.B, sc = P.sc;
  var srcOf = function(l) { var L = B.lines[l]; return L.src === 'register' ? 'the register: ' + formatNum(L.register.rounds, 0) + ' rounds a day over ' + L.register.days + ' days' : L.src === 'set' ? 'set by you' : 'assumed: no register read for this line'; };
  var h = '<div class="inv-panel inv-panel-flush" id="plnLines"><div class="inv-panel-head"><span class="inv-panel-title">What each line can do in ' + escHtml(plnMonthLabel(_plnMonth)) + '</span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPlnCfg">Set the assumptions</button></div><div class="inv-scroll-x"><table class="inv-table"><thead><tr><th>Line</th><th class="inv-num">Kg a round</th><th class="inv-num">A round every</th><th class="inv-num">Kg an hour</th><th class="inv-num">Kilos a day</th><th class="inv-num">Hours a day</th></tr></thead><tbody>' +
    PLN_LINE_IDS.map(function(l) {
      var x = mo.lines[l];
      return '<tr data-pl-line="' + l + '"><td>' + escHtml(plnLineName(l)) + '<div class="inv-row-meta">' + escHtml(srcOf(l)) + '</div></td><td class="inv-num">' + formatNum(x.kgRound, 0) + '</td><td class="inv-num">' + formatNum(x.every, 0) + ' min</td>' +
        '<td class="inv-num">' + formatNum(x.kgH, 0) + '</td><td class="inv-num">' + escHtml(plnKg(x.plated)) + (x.demand > x.plated + 1 ? '<div class="inv-row-meta inv-num-neg">' + escHtml('of ' + plnKg(x.demand)) + '</div>' : '') + '</td>' +
        '<td class="inv-num">' + plnHm(x.hours) + (x.need > x.hours + 0.01 ? '<div class="inv-row-meta inv-num-neg">' + plnHm(x.need - x.hours) + ' short</div>' : '') + '</td></tr>';
    }).join('') +
    '<tr><td>Pickling<div class="inv-row-meta">' + escHtml(B.pick.src === 'set' ? 'set by you' : 'assumed: today’s kilos with a tenth to spare') + '</div></td><td class="inv-num" colspan="2">' + escHtml(formatNum(mo.pickH > 0 ? mo.pickCap / mo.pickH : B.pick.kgH, 0) + ' kg an hour') + '</td><td></td>' +
      '<td class="inv-num">' + escHtml(plnKg(mo.pickCap)) + ' it can feed</td><td class="inv-num">' + plnHm(mo.pickH) + '</td></tr>' +
    '<tr><td>Power cuts<div class="inv-row-meta">' + escHtml(formatNum(B.cutMin, 0) + ' min a working day in working hours, the Power tab') + '</div></td><td class="inv-num" colspan="5">' + escHtml(formatNum(mo.cutH * 60, 0) + ' min a day lost') + '</td></tr></tbody></table></div></div>';
  h += '<div class="inv-panels">' + plnMachinesHtml() + '</div>';
  h += '<div class="inv-panels">' + PLN_STATIONS.map(function(st) { return plnTreeHtml(st, sc, P); }).join('') + '</div>';
  return h;
}
function plnTreeHtml(st, sc, P) {
  var plan = (sc && sc.plan) || {}, lvNow = 0;
  st.levels.forEach(function(lv, i) { if (i && P.ready[lv.id] != null && P.ready[lv.id] <= _plnMonth) lvNow = i; });
  var rows = st.levels.slice().reverse().map(function(lv, ri) {
    var i = st.levels.length - 1 - ri;
    if (!i) return '<div class="inv-row inv-row-2 inv-row-muted"><span class="inv-row-main"><span class="inv-row-title">Lv 0 · ' + escHtml(lv.t) + '</span><span class="inv-row-meta">today</span></span><span class="inv-row-end"><span class="inv-dot inv-dot-ok">Today</span></span></div>';
    var inPlan = plan[lv.id] != null, below = i === 1 || plan[st.levels[i - 1].id] != null;
    var missing = (lv.needs || []).filter(function(n) { return plan[n] == null; });
    var end = inPlan ? plnMoveCtlHtml(lv.id, true) : !below ? '<span class="inv-dot inv-dot-neutral">Level ' + (i - 1) + ' first</span>' : missing.length ? '<span class="inv-dot inv-dot-neutral">' + escHtml('Needs ' + missing.map(plnNameOf).join(', ')) + '</span>' : plnMoveCtlHtml(lv.id, false, 1);
    var cost = plnUpgradeCost(lv);
    return '<div class="inv-row inv-row-2" data-pl-level="' + escHtml(lv.id) + '"><span class="inv-row-main"><span class="inv-row-title">Lv ' + i + ' · ' + escHtml(lv.t) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml([cost ? formatCurrency(cost) : 'no cost', lv.say || '', P.ready[lv.id] != null ? 'in effect ' + plnMonthLabel(Math.min(PLN_N - 1, P.ready[lv.id])) : ''].filter(Boolean).join(' · ')) + '</span></span>' +
      '<span class="inv-row-end">' + end + '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPlnCost" data-id="' + escHtml(lv.id) + '">Cost</button></span></div>';
  }).join('');
  return '<div class="inv-panel inv-panel-flush" data-pl-tree="' + st.id + '"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(st.name) + ' <span class="inv-panel-count">Lv ' + lvNow + ' in ' + escHtml(plnMonthLabel(_plnMonth)) + '</span></span></div>' + rows + '</div>';
}
/* A level's or a node's cost is the owner's to set (a quote replaces the estimate). */
function plnCostEdit(id) {
  if (!plnRegGate(function() { plnCostEdit(id); })) return;
  var lv = null; PLN_STATIONS.forEach(function(s) { s.levels.forEach(function(x) { if (x.id === id) lv = x; }); });
  lv = lv || PLN_TECH.find(function(t) { return t.id === id; }) || PLN_ROLES.find(function(r) { return r.id === id; });
  if (!lv) return;
  uiPrompt({ title: 'What it costs: ' + lv.t, label: 'Rupees, once (blank for the estimate, ' + formatCurrency(lv.cost || 0) + ')', value: String((plnCfg().costs || {})[id] != null ? plnCfg().costs[id] : '') }).then(function(v) {
    if (v == null) return;
    var p = plnData(); p.cfg.costs = Object.assign({}, p.cfg.costs || {});
    var n = String(v).replace(/[₹,\s]/g, '');
    if (n === '') delete p.cfg.costs[id]; else if (isFinite(+n) && +n >= 0) p.cfg.costs[id] = +n; else return uiAlert({ title: 'Not a figure', body: 'Type the cost in rupees, or leave it blank for the estimate.' });
    saveState(); renderPlanner();
  });
}

/* ---------- Tech tree: tier by tier, each node with what it needs; the checklist under it ---------- */
var PLN_TIERS = ['Records and training', 'In the lab', 'Certified', 'Approved', 'Further'];
function plnTechHtml() {
  var P = plnPlanned(_plnMode), sc = P.sc, plan = (sc && sc.plan) || {};
  var have = function(n) { return n.split('|').some(function(x) { return x === 'specialist' ? plan.specialist != null || plan.promote != null : plan[x] != null; }); };
  var h = '<div class="inv-panels">' + PLN_TIERS.map(function(name, tier) {
    var nodes = PLN_TECH.filter(function(t) { return t.tier === tier; });
    return '<div class="inv-panel inv-panel-flush" data-pl-tier="' + tier + '"><div class="inv-panel-head"><span class="inv-panel-title">' + (tier + 1) + ' · ' + escHtml(name) + '</span></div>' + nodes.map(function(t) {
      var needs = (t.needs || []).map(function(n) { return (have(n) ? '✓ ' : '✗ ') + plnNameOf(n); });
      var missing = (t.needs || []).filter(function(n) { return !have(n); });
      var end = plan[t.id] != null ? plnMoveCtlHtml(t.id, true) : missing.length ? '<span class="inv-dot inv-dot-neutral">Locked</span>' : plnMoveCtlHtml(t.id, false, 1);
      var cost = plnTechCost(t), r = P.ready[t.id];
      return '<div class="inv-row inv-row-2" data-pl-node="' + t.id + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(t.t) + '</span>' +
        '<span class="inv-row-meta inv-row-wrap">' + escHtml([cost ? formatCurrency(cost) : '', t.months + ' month' + (t.months === 1 ? '' : 's'), t.say, r != null ? 'ready ' + plnMonthLabel(Math.min(PLN_N - 1, r)) + (t.id === 'cqi' ? ', if each step lands' : '') : plan[t.id] != null ? 'never ready: something it needs is missing' : ''].filter(Boolean).join(' · ')) + '</span>' +
        (needs.length ? '<span class="inv-row-meta inv-row-wrap">' + escHtml('needs ' + needs.join(' · ')) + '</span>' : '') + '</span>' +
        '<span class="inv-row-end">' + end + (t.cost ? '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPlnCost" data-id="' + t.id + '">Cost</button>' : '') + '</span></div>';
    }).join('') + '</div>';
  }).join('') + plnChecklistHtml() + '</div>';
  return h;
}

/* ---------- Staff: labour as the month pays it, and each role ---------- */
function plnStaffHtml() {
  var P = plnPlanned(_plnMode), mo = P.months[_plnMonth], b = P.base[_plnMonth], sc = P.sc, plan = (sc && sc.plan) || {}, B = P.B;
  var h = '<div class="inv-panels"><div class="inv-panel inv-panel-flush" id="plnLabour"><div class="inv-panel-head"><span class="inv-panel-title">Labour in ' + escHtml(plnMonthLabel(_plnMonth)) + '</span></div>' +
    plnCostRows(mo, b).slice(0, 4).map(function(r) {
      return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + r[0] + '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(r[3]) + '</span></span>' +
        '<span class="inv-row-end inv-row-end-stack"><span class="inv-num">' + escHtml(formatCurrency(r[1])) + '</span><span class="inv-row-meta">' + escHtml(Math.abs(r[1] - r[2]) >= 1 ? plnSigned(r[1] - r[2], true) : 'as now') + '</span></span></div>';
    }).join('') +
    '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">Overtime line-hours a day</span><span class="inv-row-meta">' + escHtml('before 8:30 and after 5 on each line; today ' + formatNum(B.otBase, 1)) + '</span></span>' +
      '<span class="inv-row-end"><span class="inv-num">' + formatNum(mo.otH, 1) + (mo.nightH ? ' · ' + formatNum(mo.nightH, 1) + ' night' : '') + '</span></span></div></div>';
  h += '<div class="inv-panel inv-panel-flush" id="plnRoles"><div class="inv-panel-head"><span class="inv-panel-title">Hire and train</span></div>' + PLN_ROLES.map(function(r) {
    var missing = (r.needs || []).filter(function(n) { return !n.split('|').some(function(x) { return plan[x] != null; }); });
    var opens = PLN_TECH.filter(function(t) { return (t.needs || []).indexOf(r.as || r.id) >= 0; }).map(function(t) { return t.t; });
    if (r.id === 'turnHand') opens.push('work held back for turnaround');
    var end = plan[r.id] != null ? plnMoveCtlHtml(r.id, true) : missing.length ? '<span class="inv-dot inv-dot-neutral">' + escHtml('Needs ' + missing.map(plnNameOf).join(', ')) + '</span>' : plnMoveCtlHtml(r.id, false, 1);
    var chance = r.p != null ? '<label class="inv-pl-inline">chance <input class="inv-input inv-input-num inv-pl-num" type="number" min="1" max="10" data-pl-chance="' + r.id + '" value="' + Math.round(plnRoleChance(sc || {}, r) * 10) + '"> in 10</label>' : '';
    return '<div class="inv-row inv-row-2" data-pl-role="' + r.id + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(r.t) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml([r.run ? formatCurrency(r.run) + ' a month' : '', r.cost ? formatCurrency(plnTechCost(r)) + ' once' : '', r.say].filter(Boolean).join(' · ')) + '</span>' +
      (opens.length ? '<span class="inv-row-meta inv-row-wrap">' + escHtml('opens ' + opens.join(', ')) + '</span>' : '') + chance + '</span><span class="inv-row-end">' + end + '</span></div>';
  }).join('') + '</div></div>';
  return h;
}

/* ---------- Clients: each client's parts, its ask, the work it holds back ---------- */
function plnClientsHtml() {
  var P = plnPlanned(_plnMode), mo = P.months[_plnMonth], b = P.base[_plnMonth], sc = P.sc, B = P.B;
  var open = B.clients.find(function(c) { return String(c.id) === String(_plnClient); }) || B.clients[0];
  var list = '<div class="inv-panel inv-panel-flush" id="plnClientList"><div class="inv-panel-head"><span class="inv-panel-title">Clients <span class="inv-panel-count">' + B.clients.length + '</span></span><span class="inv-panel-count">a month, ' + escHtml(plnMonthLabel(_plnMonth)) + '</span></div>' +
    uiMoreHtml('pln-cl', B.clients.map(function(c) {
      var a = mo.byClient[c.id] || 0, bb = b.byClient[c.id] || 0, moves = sc ? ['ask:' + c.id].concat(plnLive('heldBack').filter(function(x) { return String(x.clientId) === String(c.id); }).map(function(x) { return 'held:' + x.id; })).filter(function(k) { return (sc.plan || {})[k] != null; }).length : 0;
      return '<div class="inv-row inv-row-2' + (c === open ? ' inv-row-selected' : '') + '" data-pl-client="' + escHtml(String(c.id)) + '"' + (c === open ? ' aria-current="true"' : '') + '><button class="inv-row-main" data-action="invPlnClient" data-id="' + escHtml(String(c.id)) + '"><span class="inv-row-title">' + escHtml(plnClientShort(c)) + '</span>' +
        '<span class="inv-row-meta">' + escHtml(plnKg(c.kg) + ' a month · ₹' + formatNum(c.kg ? c.rev / c.kg : 0, 2) + '/kg' + (moves ? ' · ' + moves + ' in the plan' : '')) + '</span></button>' +
        '<span class="inv-row-end inv-row-end-stack"><span class="inv-num">' + escHtml(plnRs(a)) + '</span>' + (Math.abs(a - bb) >= 500 ? '<span class="inv-row-meta inv-num-pos">' + escHtml(plnSigned(a - bb)) + '</span>' : '') + '</span></div>';
    }), { n: 12, noun: 'clients' }) + '</div>';
  if (!open) return '<div class="inv-panels">' + list + '</div>';
  var a = plnAskOf(sc || {}, open), askKey = 'ask:' + open.id, inPlan = sc && (sc.plan || {})[askKey] != null;
  var askMv = plnPlanned(_plnMode).L.find(function(mv) { return mv.ask && String(mv.ask.client) === String(open.id); });
  var cid = escHtml(String(open.id));
  var ask = '<div class="inv-panel inv-panel-flush" id="plnAsk"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(plnClientShort(open)) + '</span><span class="inv-panel-count">' + escHtml(plnKg(open.kg) + ' · ' + formatCurrency(open.rev) + ' a month, as billed') + '</span></div>' +
    '<div class="inv-row inv-row-2" data-pl-ask="' + cid + '"><span class="inv-row-main"><span class="inv-row-title">Ask a new rate</span>' +
      ('<span class="inv-pl-inline">' + (a.pct != null ? '+<input class="inv-input inv-input-num inv-pl-num" type="number" step="0.5" data-pl-ask="pct" data-client="' + cid + '" value="' + escHtml(String(a.pct)) + '">% on every part' :
        'to ₹<input class="inv-input inv-input-num inv-pl-num" type="number" step="0.25" data-pl-ask="to" data-client="' + cid + '" value="' + escHtml(String(a.to)) + '">/kg where lower') +
        ' · chance <input class="inv-input inv-input-num inv-pl-num" type="number" min="1" max="10" data-pl-ask="p" data-client="' + cid + '" value="' + Math.round(a.p * 10) + '"> in 10</span>') +
      (a.refuse ? '<span class="inv-row-meta">' + escHtml('If they refuse, 1 in 5 sends ' + Math.round(a.refuse.cut * 100) + '% less') + '</span>' : '') + '</span>' +
      '<span class="inv-row-end">' + plnMoveCtlHtml(askKey, inPlan, 1) + '</span></div></div>';
  var parts = '<div class="inv-panel inv-panel-flush" id="plnParts"><div class="inv-panel-head"><span class="inv-panel-title">Parts</span><span class="inv-panel-count">a month, over ' + escHtml(formatDate(B.period.from) + ' to ' + formatDate(B.period.to)) + '</span></div>' +
    '<div class="inv-scroll-x"><table class="inv-table"><thead><tr><th>Part</th><th>Line</th><th class="inv-num">A month</th><th class="inv-num">Rate</th><th class="inv-num">₹/kg</th><th class="inv-num">₹/kg asked</th><th class="inv-num">A month more</th></tr></thead><tbody>' +
    open.parts.map(function(p) {
      var row = mo.rows.find(function(r) { return r.part === p; }), newKg = row ? row.perKg : p.perKg, eff = row ? row.kgMo * (newKg - p.perKg) : 0, o = askMv ? askMv.ask.parts[p.id] : null;
      var askCell = inPlan && a.pct == null ? '<input class="inv-input inv-input-num inv-pl-num" type="number" step="0.25" placeholder="' + formatNum(Math.max(a.to || 0, p.perKg), 2) + '" data-pl-part="' + escHtml(p.id) + '" data-client="' + cid + '" value="' + escHtml(o != null && o !== 'skip' ? String(o) : '') + '">' : escHtml(Math.abs(newKg - p.perKg) > 0.001 ? '₹' + formatNum(newKg, 2) : '—');
      return '<tr data-pl-part-row="' + escHtml(p.id) + '"><td>' + escHtml(p.name) + '<div class="inv-row-meta">' + escHtml([p.desc && p.desc !== p.name ? p.desc : '', p.mm ? p.mm + ' mm' : '', p.kgPc ? formatNum(p.kgPc, 3) + ' kg a piece' : ''].filter(Boolean).join(' · ')) + '</div></td>' +
        '<td>' + escHtml(plnLineName(p.line)) + '<div class="inv-row-meta">' + escHtml(p.lineSrc === 'record' ? 'the record' : 'assumed') + '</div></td>' +
        '<td class="inv-num">' + escHtml(plnKg(p.kg)) + (p.pcs ? '<div class="inv-row-meta">' + escHtml(formatNum(p.pcs, 0) + ' pcs') + '</div>' : '') + '</td>' +
        '<td class="inv-num">' + escHtml(p.rate != null ? '₹' + formatNum(p.rate, 2) + (p.unit === 'NOS' ? '/pc' : '/kg') : '—') + '</td><td class="inv-num">₹' + formatNum(p.perKg, 2) + '</td>' +
        '<td class="inv-num">' + askCell + '</td><td class="inv-num' + (eff > 0 ? ' inv-num-pos' : '') + '">' + escHtml(Math.abs(eff) >= 1 ? plnSigned(eff, true) : '—') + '</td></tr>';
    }).join('') + '</tbody></table></div><div class="inv-panel-body inv-note">A piece part’s ₹/kg is its rate over its kg a piece. With the ask in the plan, a rate typed on a part asks that part apart. The effect is at ' + escHtml(plnMonthLabel(_plnMonth)) + ', every move landing.</div></div>';
  return '<div class="inv-pl-split">' + list + '<div class="inv-pl-stack">' + ask + plnHeldHtml(open.id) + parts + '</div></div>';
}

/* ---------- Finance: the loan in play, the lenders, rates heard ---------- */
function plnFinanceHtml() {
  var sc = plnScenario(), h = '<div class="inv-panels">';
  if (sc && sc.loan) {
    var l = sc.loan, sch = plnLoanSchedule(l), first = sch.find(function(e) { return e.principal > 0; }), tot = sch.reduce(function(s, e) { return s + e.interest; }, 0);
    h += '<div class="inv-panel inv-panel-flush" id="plnLoan"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml('The loan: ' + (l.who || 'a lender')) + '</span>' +
      '<span class="inv-pl-when"><button class="inv-btn inv-btn-icon inv-btn-ghost inv-btn-sm" data-action="invPlnLoanShift" data-step="-1" aria-label="Earlier">&lsaquo;</button><span class="inv-num">' + escHtml('taken ' + plnMonthLabel(l.at || 0)) + '</span>' +
      '<button class="inv-btn inv-btn-icon inv-btn-ghost inv-btn-sm" data-action="invPlnLoanShift" data-step="1" aria-label="Later">&rsaquo;</button></span></div>' +
      '<div class="inv-panel-body"><div class="inv-fields">' + [['amt', 'Amount, ₹', l.amt], ['rate', 'Interest, % a year', l.rate], ['months', 'Months to repay', l.months], ['mor', 'Interest only first, months', l.mor]].map(function(f) {
        return '<label class="inv-field"><span class="inv-field-label">' + f[1] + '</span><input class="inv-input inv-input-num" type="number" min="0" step="any" data-pl-loan="' + f[0] + '" value="' + escHtml(String(f[2] == null ? '' : f[2])) + '"></label>';
      }).join('') + '</div><div class="inv-note">' + escHtml((first ? 'Instalment ' + formatCurrency(first.emi) + ' a month from ' + plnMonthLabel(sch.indexOf(first)) : 'No principal repaid inside the 24 months') + ' · interest in the 24 months ' + formatCurrency(tot) + (l.ties ? ' · ' + l.ties : '')) + '</div></div>' +
      '<div class="inv-scroll-x"><table class="inv-table inv-table-grid inv-pl-ledger"><thead><tr><th scope="col">Month</th>' + sch.map(function(e, i) { return '<th scope="col">' + escHtml(plnMonthLabel(i)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      [['In', function(e) { return e.in ? plnRs(e.in) : '—'; }], ['Interest', function(e) { return e.interest ? plnRs(e.interest) : '—'; }], ['Principal', function(e) { return e.principal ? plnRs(e.principal) : '—'; }], ['Owed after', function(e) { return e.bal ? plnRs(e.bal) : '—'; }]].map(function(r) {
        return '<tr><th scope="row">' + r[0] + '</th>' + sch.map(function(e) { return '<td class="inv-num">' + escHtml(r[1](e)) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></div>';
  } else h += '<div class="inv-panel"><div class="inv-empty">No loan in this plan. Play a lender below; its terms are then the plan’s to change.</div></div>';
  return h + plnLendersHtml() + plnHeardHtml() + '</div>';
}

function plnRoll() {}
function plnReplayOne() {}
function plnCardEdit() {}
function plnCardSave() {}
function plnCardRemove() {}
/* The assumptions: whatever the book does not measure, the owner sets (blank = measured, else assumed). */
function plnCfgEdit() {
  if (!plnRegGate(plnCfgEdit)) return;
  var c = plnRead().cfg || {}, B = plnBase();
  var f = PLN_LINE_IDS.map(function(l) {
    var L = B ? B.lines[l] : PLN_LINE_ASSUMED[l], set = (c.lines || {})[l] || {};
    return _plnField('plnCKg_' + l, plnLineName(l) + ': kg a round', set.kgRound, 'number', ' placeholder="' + formatNum(L.kgRound, 0) + (L.src === 'register' ? ' (register)' : ' (assumed)') + '"') +
      _plnField('plnCEv_' + l, plnLineName(l) + ': minutes a round', set.every, 'number', ' placeholder="' + formatNum(L.every, 0) + (L.src === 'register' ? ' (register)' : ' (assumed)') + '"');
  }).join('');
  f += _plnField('plnCPick', 'Pickling, kg an hour', c.pickKgH, 'number', ' placeholder="' + (B && B.pick ? B.pick.kgH + ' (assumed)' : '') + '"') +
    _plnField('plnCOt', 'A new overtime line-hour, ₹', c.otLineHour, 'number', ' placeholder="' + PLN_CFG_DEFAULTS.otLineHour + ' (assumed)"') +
    _plnField('plnCPow', 'The fixed part of the electricity bill, ₹ a month', c.powerFixed, 'number', ' placeholder="' + PLN_CFG_DEFAULTS.powerFixed + ' (assumed)"') +
    _plnField('plnCCash', 'Cash now, ₹', c.cash, 'number', ' placeholder="' + (B && B.cash.src === 'statement' ? formatNum(B.cash.v, 0) + ' (statement)' : 'no statement') + '"');
  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml('The planner’s assumptions') + '<div class="inv-note">Blank reads the book where it measures the figure, else the assumption shown. A figure set here is used everywhere in the planner.</div><div class="inv-fields">' + f + '</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPlnCfgSave">Save</button></div></div>', { dismiss: true });
}
function plnCfgSave() {
  if (!plnRegGate(plnCfgSave)) return;
  var p = plnData(), c = Object.assign({}, p.cfg), pos = function(id) { var v = _plnNum(id); return v != null && v > 0 ? v : null; };
  c.lines = {};
  PLN_LINE_IDS.forEach(function(l) { var k = pos('plnCKg_' + l), e = pos('plnCEv_' + l); if (k || e) c.lines[l] = { kgRound: k, every: e }; });
  c.pickKgH = pos('plnCPick'); c.otLineHour = pos('plnCOt'); c.powerFixed = _plnNum('plnCPow'); c.cash = _plnNum('plnCCash');
  p.cfg = c;
  closeOverlay();
  saveState();
  renderPlanner();
  showToast('Assumptions saved');
}
function plnReportOpen() {}
function plnReportRedraw() {}
