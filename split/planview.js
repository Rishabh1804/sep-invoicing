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
    _plnMoved = false;
    return;
  }
  var sc = plnScenario();
  if (_plnResult && _plnResult.key !== plnPlanned().key) { _plnResult = null; _plnReplay = null; }
  h += plnToolbarHtml(sc) + plnGoalHtml(sc) + plnHudHtml();
  var body = { play: plnPlayHtml, ledger: plnLedgerHtml, day: plnDayHtml, plant: plnPlantHtml, tech: plnTechHtml, staff: plnStaffHtml, clients: plnClientsHtml, finance: plnFinanceHtml }[_plnView];
  h += body ? body() : '';
  // A table scrolled sideways (the ledger, the board) stays where it was across a redraw: a month tapped stays in sight.
  var sx = [].map.call(el.querySelectorAll('.inv-scroll-x'), function(x) { return x.scrollLeft; }), moved = _plnMoved;
  el.innerHTML = h;
  if (!moved) [].forEach.call(el.querySelectorAll('.inv-scroll-x'), function(x, i) { if (sx[i]) x.scrollLeft = sx[i]; });
  viewTabReveal(el.querySelector('.inv-viewtabs'));
  if (_plnMoved) { _plnMoved = false; viewTop(); }
  plnReportRedraw();
}
/* With no baseline, the registers are still the owner's to keep. */
function plnRegistersOnlyHtml() {
  return '<div class="inv-panels">' + plnMachinesHtml() + plnChecklistHtml() + plnLendersHtml() + plnHeardHtml() + plnHeldHtml() + '</div>';
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
    tile('cash', 'Cash', figWrapHtml(escHtml(plnRs(mo.cash))), escHtml(B.cash.src === 'statement' ? 'from ' + plnRs(B.cash.v) + ' on the statement, ' + formatDate(B.cash.on) : B.cash.src === 'set' ? 'from ' + plnRs(B.cash.v) + ', as set in the assumptions' : 'no statement: counted from zero; set the cash now in Set the assumptions (Ledger or Plant)'), mo.cash < 0 ? 'danger' : mo.cash < Math.abs(base.margin) * 2 ? 'warning' : 'ok') +
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
/* A figure typed on the page is saved at once, and the page is redrawn after the tap or key that left the field has landed: a
   change fires on the blur, between the press and the click, and a redraw then would replace the button under the tap. The
   field that has focus after the redraw is the one that had it before. */
var _plnPtr = false;
document.addEventListener('pointerdown', function() { _plnPtr = true; }, true);
document.addEventListener('pointerup', function() { setTimeout(function() { _plnPtr = false; }, 0); }, true);
function plnEditTyped(fn) {
  plnEdit(fn, true);
  var done = false, go = function() { if (done) return; done = true; document.removeEventListener('click', go, true); setTimeout(plnRedrawKeepFocus, 0); };
  if (_plnPtr) { document.addEventListener('click', go, true); setTimeout(go, 700); } else go();
}
function plnFocusKey(el) {
  if (!el || !el.closest || !el.closest('#plannerContent')) return null;
  if (el.id) return '#' + el.id;
  var a = ['data-pl-ask', 'data-pl-part', 'data-pl-loan', 'data-pl-chance', 'data-client', 'data-action', 'data-key', 'data-id'].filter(function(n) { return el.hasAttribute(n); });
  return a.length ? el.tagName.toLowerCase() + a.map(function(n) { return '[' + n + '="' + CSS.escape(el.getAttribute(n)) + '"]'; }).join('') : null;
}
function plnRedrawKeepFocus() {
  var key = plnFocusKey(document.activeElement);
  renderPlanner();
  plnPinRefresh();
  var el = key ? document.querySelector('#plannerContent ' + key) : null;
  if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
}
function plnEdit(fn, quiet) {
  var sc = plnScenarioEnsure();
  sc.plan = sc.plan || {}; sc.asks = sc.asks || {}; sc.cards = sc.cards || [];
  fn(sc);
  sc.at = Date.now();
  _plnResult = null; _plnReplay = null;
  saveState();
  if (quiet) return;
  renderPlanner();
  plnPinRefresh();
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
    case 'invPlnPin': plnPinOpen(d.key); return true;
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
  if (d.plAsk) { plnEditTyped(function(sc) { var o = sc.asks[d.client] || (sc.asks[d.client] = {}); var v = t.value === '' ? null : +t.value; if (d.plAsk === 'p') o.p = v == null ? null : Math.max(1, Math.min(10, v)) / 10; else o[d.plAsk] = v; }); return true; }
  if (d.plPart) { plnEditTyped(function(sc) { var o = sc.asks[d.client] || (sc.asks[d.client] = {}); o.parts = o.parts || {}; if (t.value === '') delete o.parts[d.plPart]; else o.parts[d.plPart] = +t.value; }); return true; }
  if (d.plLoan) { plnEditTyped(function(sc) { if (!sc.loan || t.value === '') return; var v = +t.value; if (isFinite(v) && v >= 0) sc.loan[d.plLoan] = v; if (sc.loan.months <= sc.loan.mor) sc.loan.months = sc.loan.mor + 1; }); return true; }
  if (d.plChance) { plnEditTyped(function(sc) { sc.chances = sc.chances || {}; var v = +t.value; if (t.value === '' || !isFinite(v)) delete sc.chances[d.plChance]; else sc.chances[d.plChance] = Math.max(1, Math.min(10, v)) / 10; }); return true; }
  if (d.plCardKind) { plnCardEdit(d.plCardId || '', t.value, plnCardTyped()); return true; }
  return false;
}

/* ---------- Scenarios ---------- */
function plnScenarioCopy() {
  var p = plnData(), cur = plnScenario();
  var s = cur ? JSON.parse(JSON.stringify(cur)) : { goal: 'normal', plan: {}, asks: {}, loan: null, cards: [] };
  s.id = plnId('SC');
  if (cur) { var stem = String(cur.name || 'My plan').replace(/ \(copy( \d+)?\)$/, '').slice(0, 30), n = 1, taken = function(nm) { return plnScenarios().some(function(x) { return x.name === nm; }); };
    s.name = stem + ' (copy)'; while (taken(s.name)) s.name = stem + ' (copy ' + (++n) + ')'; } else s.name = 'My plan'; s.at = Date.now(); s.by = plnWho();
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
/* ---------- Play: the board, the outcome, the lines this month, the hand ---------- */
var PLN_LANES = [['plant', 'Plant'], ['tech', 'Tech'], ['staff', 'Staff'], ['clients', 'Clients'], ['money', 'Money'], ['custom', 'Your cards']];
function plnPlayHtml() {
  var P = plnPlanned(_plnMode);
  return '<div class="inv-panels inv-pl-play">' + plnBoardHtml(P) + plnOutcomeHtml(P) + plnLinesNowHtml(P) + plnHandHtml(P) + (_plnReplay ? plnReplayHtml() : '') + '</div>';
}
/* The board: 24 months across, a lane each; a move is a button spanning its months, packed into rows so none overlap. */
function plnBoardHtml(P) {
  var head = '<tr><th scope="col">Lane</th>' + Array.apply(null, Array(PLN_N)).map(function(_, i) {
    return '<th scope="col"' + (i === _plnMonth ? ' aria-current="date"' : '') + '><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPlnLedgerMonth" data-m="' + i + '" aria-label="' + escHtml(plnMonthLabel(i)) + '">' + escHtml(plnMonthLabel(i).split(' ')[0].slice(0, 3)) + '</button>' + (i === 0 || plnMonthLabel(i).indexOf('Jan') === 0 ? '<span class="inv-row-meta">' + escHtml('’' + plnMonthLabel(i).split(' ')[1]) + '</span>' : '') + '</th>';
  }).join('') + '</tr>';
  var body = PLN_LANES.map(function(lane) {
    var pins = P.L.filter(function(mv) { return mv.lane === lane[0]; }).map(function(mv) { return { mv: mv, at: Math.max(0, mv.key === 'loan' ? mv.at : (mv.at < 0 ? (P.ready[mv.key] != null ? P.ready[mv.key] : 0) : mv.at)) }; })
      .sort(function(a, b) { return a.at - b.at; });
    var rows = [];
    pins.forEach(function(pn) {
      var w = Math.max(3, Math.min(PLN_N - pn.at, Math.ceil(pn.mv.label.length / 4))), r = 0;
      while (rows[r] && rows[r].end > pn.at) r++;
      rows[r] = rows[r] || { end: 0, cells: [] };
      rows[r].cells.push({ at: pn.at, w: w, mv: pn.mv }); rows[r].end = pn.at + w;
    });
    if (!rows.length) rows.push({ end: 0, cells: [] });
    return rows.map(function(r, ri) {
      var tds = '', c = 0;
      r.cells.forEach(function(cell) {
        if (cell.at > c) tds += '<td colspan="' + (cell.at - c) + '"></td>';
        var never = P.ready[cell.mv.key] == null, eff = P.ready[cell.mv.key];
        tds += '<td colspan="' + cell.w + '"><button class="inv-pl-pin inv-pl-lane-' + lane[0] + (never ? ' inv-pl-pin-never' : '') + '" data-action="invPlnPin" data-key="' + escHtml(cell.mv.key) + '" title="' +
          escHtml(cell.mv.label + (never ? ' · never takes effect: something it needs is not planned' : eff != null && eff > cell.at ? ' · takes effect ' + plnMonthLabel(Math.min(PLN_N - 1, eff)) : '')) + '">' + escHtml(cell.mv.label) + '</button></td>';
        c = cell.at + cell.w;
      });
      if (c < PLN_N) tds += '<td colspan="' + (PLN_N - c) + '"></td>';
      return '<tr data-pl-lane="' + lane[0] + '">' + (ri === 0 ? '<th scope="row" rowspan="' + rows.length + '">' + lane[1] + '</th>' : '') + tds + '</tr>';
    }).join('');
  }).join('');
  return '<div class="inv-panel inv-panel-flush inv-pl-wide" id="plnBoard"><div class="inv-panel-head"><span class="inv-panel-title">The board <span class="inv-panel-count">' + P.L.length + ' moves</span></span>' +
    '<span class="inv-panel-count">everything planned on every view · tap a move to shift it</span></div><div class="inv-scroll-x"><table class="inv-table inv-table-grid inv-pl-board"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
    (P.L.length ? '' : '<div class="inv-empty">Nothing planned yet. Plan moves on Plant, Tech tree, Staff and Clients, play a loan or a card of your own, or Suggest a start (the CQI-11 path at its earliest).</div>') + '</div>';
}
function plnPinHtml(key) {
  var P = plnPlanned(_plnMode), mv = P.L.find(function(x) { return x.key === key; });
  if (!mv) return null;
  var r = P.ready[key];
  return '<div class="inv-dialog" data-pl-pin-dialog data-key="' + escHtml(key) + '">' + dialogHeadHtml(escHtml(mv.label)) + '<div class="inv-panel-body">' +
    '<div class="inv-note">' + escHtml(r == null ? 'It never takes effect: something it needs is not planned (' + mv.needs.map(plnNameOf).join(', ') + ').' : 'Takes effect ' + plnMonthLabel(Math.min(PLN_N - 1, r)) + (mv.p != null ? ', if it comes through (' + Math.round(mv.p * 10) + ' in 10)' : '') + '.') + '</div>' +
    '<div class="inv-toolbar">' + (key === 'loan' ? '<span class="inv-pl-when"><button class="inv-btn inv-btn-icon inv-btn-ghost inv-btn-sm" data-action="invPlnLoanShift" data-step="-1" aria-label="Earlier">&lsaquo;</button><span class="inv-num">' + escHtml(plnMonthLabel(mv.at)) + '</span>' +
      '<button class="inv-btn inv-btn-icon inv-btn-ghost inv-btn-sm" data-action="invPlnLoanShift" data-step="1" aria-label="Later">&rsaquo;</button></span>' : plnMoveCtlHtml(key, true)) + '</div></div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-primary" data-action="invCloseOverlay">Done</button></div></div>';
}
function plnPinOpen(key) { var h = plnPinHtml(key); if (h) dialogOpen(h, { dismiss: true }); }
/* After an edit, a pin's dialog shows its move as it is now, or shuts when the move went. */
function plnPinRefresh() {
  var d = document.querySelector('[data-pl-pin-dialog]');
  if (!d) return;
  var h = plnPinHtml(d.getAttribute('data-key'));
  if (!h) { closeOverlay(); return; }
  var a = document.activeElement, step = a && d.contains(a) && a.dataset ? a.dataset.action + '|' + (a.dataset.step || '') : null;
  dialogOpen(h, { replace: true });
  var nd = document.querySelector('[data-pl-pin-dialog]'), to = null;
  if (nd && step) [].some.call(nd.querySelectorAll('[data-action]'), function(b) { if (b.dataset.action + '|' + (b.dataset.step || '') === step) { to = b; return true; } return false; });
  if (to && !to.disabled) to.focus(); else if (nd) nd.focus && nd.focus();
}

/* The outcome: the plan's margin against today's and the goal, the 8-in-10 band once rolled, the goal month's spread, achievements. */
function plnOutcomeHtml(P) {
  var R = _plnResult, g = plnGoal(P.sc), target = plnGoalMargin(g, P.B), labels = P.months.map(function(_, i) { return plnMonthLabel(i); });
  var series = [{ label: R ? 'The middle trial' : 'The plan, every move landing', values: R ? R.p50 : P.months.map(function(x) { return Math.round(x.margin); }) },
    { label: 'As it runs', values: P.base.map(function(x) { return Math.round(x.margin); }), tone: 6, dashed: true }];
  if (target != null) series.push({ label: 'The goal', values: P.months.map(function() { return Math.round(target); }), tone: 2, dashed: true });
  var h = '<div class="inv-panel" id="plnOutcome"><div class="inv-panel-head"><span class="inv-panel-title">' + (R ? 'After ' + PLN_TRIALS + ' trials' : 'Margin a month') + '</span>' +
    '<span class="inv-panel-count">' + escHtml(R ? Math.round(R.red * 100) + '% dip below zero · CQI-11 in time in ' + Math.round(R.cqiShare * 100) + '%' : 'roll the trials for the odds') + '</span></div>' +
    chartLines(labels, series, { ariaLabel: 'Margin a month', band: R ? R.p10.map(function(v, i) { return { lo: v, hi: R.p90[i] }; }) : null, maxLabels: 6 });
  if (R) {
    var lo = Math.min.apply(null, R.atGoal), hi = Math.max.apply(null, R.atGoal), step = Math.max(10000, Math.ceil((hi - lo) / 10 / 10000) * 10000), from = Math.floor(lo / step) * step, bins = [];
    for (var v = from; v <= hi; v += step) bins.push({ label: formatInrShort(v), value: R.atGoal.filter(function(x) { return x >= v && x < v + step; }).length });
    h += '<div class="inv-note">' + escHtml('Margin in ' + plnMonthLabel(g.at) + ', every trial' + (target != null ? ' (the goal: ' + formatInrShort(target) + ')' : '')) + '</div>' + chartBars(bins, { unit: 'count', ariaLabel: 'Trials by margin' });
    h += plnAchievementsHtml(P, R) + '<div class="inv-toolbar"><button class="inv-btn inv-btn-secondary" data-action="invPlnReplay">Replay one run</button><button class="inv-btn inv-btn-ghost" data-action="invPlnView" data-v="ledger">How each month adds up</button></div>';
  } else h += '<div class="inv-toolbar"><button class="inv-btn inv-btn-ghost" data-action="invPlnView" data-v="ledger">How each month adds up</button></div>';
  return h + '</div>';
}
function plnAchievementsHtml(P, R) {
  var list = [['Lab ready', P.ready.lab2 != null], ['A first rate rise', P.L.some(function(mv) { return mv.ask; })], ['CQI-11 in time, half the trials', R.cqiShare >= 0.5],
    ['Never in the red, 9 in 10', R.red < 0.1], ['Margin up ₹50k a month', R.p50[PLN_N - 1] >= P.base[PLN_N - 1].margin + 50000],
    ['No line left short', P.months.every(function(x) { return x.lostRev < 1000; })], ['Pickling keeps up', P.months.every(function(x) { return x.pickShare >= 0.999; })]];
  return '<div class="inv-pl-ach">' + list.map(function(a) { return '<span class="inv-badge ' + (a[1] ? 'inv-badge-ok' : 'inv-badge-neutral') + '" data-pl-ach="' + (a[1] ? 'got' : 'not') + '">' + escHtml((a[1] ? '✓ ' : '') + a[0]) + '</span>'; }).join('') + '</div>';
}
function plnLinesNowHtml(P) {
  var mo = P.months[_plnMonth], max = PLN_SHIFT.general + PLN_SHIFT.morning + PLN_SHIFT.evening;
  return '<div class="inv-panel inv-panel-flush" id="plnLinesNow"><div class="inv-panel-head"><span class="inv-panel-title">The lines in ' + escHtml(plnMonthLabel(_plnMonth)) + '</span><span class="inv-panel-count">hours a day each must run</span></div>' +
    PLN_LINE_IDS.map(function(l) {
      var x = mo.lines[l], tone = x.need > x.hours + 0.01 ? 'danger' : x.hours > max - 0.5 ? 'warning' : x.hours > PLN_SHIFT.general ? 'info' : 'ok';
      var word = x.need > x.hours + 0.01 ? plnHm(x.need - x.hours) + ' short' : x.hours > PLN_SHIFT.general ? plnHm(x.hours - PLN_SHIFT.general) + ' overtime' : x.demand > 0 ? 'within the shift' : 'idle';
      return '<div class="inv-row inv-row-2" data-pl-linenow="' + l + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(plnLineName(l)) + '</span><span class="inv-row-meta">' + escHtml(plnHm(x.hours) + ' h · ' + plnKg(x.plated) + ' a day') + '</span></span>' +
        '<span class="inv-row-end"><span class="inv-dot inv-dot-' + tone + '">' + escHtml(word) + '</span></span></div>';
    }).join('') + '</div>';
}
function plnHandHtml(P) {
  var sc = P.sc, cards = (sc && sc.cards) || [];
  return '<div class="inv-panel inv-panel-flush" id="plnHand"><div class="inv-panel-head"><span class="inv-panel-title">Your cards <span class="inv-panel-count">' + cards.length + '</span></span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPlnCard">New card</button></div>' +
    (cards.length ? cards.map(function(k) {
      var key = 'card:' + k.id, inPlan = sc.plan && sc.plan[key] != null;
      return '<div class="inv-row inv-row-2" data-pl-card="' + escHtml(k.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(k.title) + '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(plnCardSays(k)) + '</span></span>' +
        '<span class="inv-row-end">' + plnMoveCtlHtml(key, inPlan, 1) + '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPlnCard" data-id="' + escHtml(k.id) + '">Edit</button></span></div>';
    }).join('') : '<div class="inv-empty">A move the planner does not know: new work at a rate on a line, more kilos a round on a line, or a saving a month, with its cost and its chance. New card makes one.</div>') +
    '<div class="inv-panel-body inv-note">The loan is played from Finance → Lenders, one at a time.</div></div>';
}
function plnCardSays(k) {
  return [k.why || '', k.kind === 'volume' ? formatNum(+k.tonnes || 0, 1) + ' t a month at ₹' + formatNum(+k.rate || 0, 2) + '/kg on ' + plnLineName(k.line || 'vat-a2') : '',
    k.kind === 'line' ? plnLineName(k.line || 'vat-a1') + ': ' + formatNum(+k.kgRound || 0, 0) + ' kg more a round' : '', k.kind === 'save' ? formatCurrency(+k.gain || 0) + ' a month saved' : '',
    k.cost ? formatCurrency(k.cost) + ' once' : '', k.run ? formatCurrency(k.run) + ' a month' : '', Math.round((k.p != null ? k.p : 0.7) * 10) + ' in 10', k.needs ? 'needs ' + plnNameOf(k.needs) : ''].filter(Boolean).join(' · ');
}
function plnReplayHtml() {
  var t = _plnReplay.t;
  return '<div class="inv-panel inv-panel-flush" id="plnReplay"><div class="inv-panel-head"><span class="inv-panel-title">One run, played out</span><span class="inv-panel-count">' + escHtml('trial ' + _plnReplay.n + ' · lowest cash ' + formatInrShort(t.low)) + '</span></div>' +
    (t.events.length ? t.events.slice(0, 14).map(function(e) {
      return '<div class="inv-row"><span class="inv-row-main"><span class="inv-row-title"><span class="inv-dot inv-dot-' + (e[2] === 'ok' ? 'ok' : e[2] === 'danger' ? 'danger' : 'warning') + '">' + escHtml(e[1]) + '</span></span></span><span class="inv-row-end"><span class="inv-num">' + escHtml(plnMonthLabel(Math.min(PLN_N - 1, e[0]))) + '</span></span></div>';
    }).join('') : '<div class="inv-empty">Nothing happened in this run that the plan did not already say.</div>') + '</div>';
}
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
  var h = '<div class="inv-toolbar"><span class="inv-seg inv-seg-fit" role="group" aria-label="Read the plan"><button class="inv-seg-btn" aria-pressed="' + (_plnMode === 'all') + '" data-action="invPlnMode" data-id="all">If every move lands</button>' +
    '<button class="inv-seg-btn" aria-pressed="' + (_plnMode === 'expected') + '" data-action="invPlnMode" data-id="expected">Weighted by each chance</button></span></div>' +
    '<div class="inv-panel inv-panel-flush" id="plnLedger"><div class="inv-panel-head"><span class="inv-panel-title">Month by month</span></div>' +
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
/* ---------- A day: the month divided by its working days, drawn on the clock ---------- */
function plnDayHtml() {
  var P = plnPlanned(_plnMode), mo = _plnDayMode === 'now' ? P.base[_plnMonth] : P.months[_plnMonth], B = P.B;
  var X0 = 96, W = 1000, SPAN = 22, X = function(h) { return X0 + (h - 6) / SPAN * (W - X0 - 12); };
  var rowH = 46, H = 30 + (PLN_LINE_IDS.length + 1) * rowH + 24;
  var palette = {}; B.clients.forEach(function(c, i) { palette[c.id] = i % 8; }); palette.card = 7;
  var s = '<svg class="inv-pl-day" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="An average day on the lines">';
  for (var hh = 6; hh <= 28; hh += 2) s += '<line x1="' + X(hh) + '" x2="' + X(hh) + '" y1="20" y2="' + (H - 20) + '" class="inv-chart-grid"/><text x="' + X(hh) + '" y="14" text-anchor="' + (hh === 28 ? 'end' : 'middle') + '" class="inv-chart-grid-label">' + (hh % 24) + ':00</text>';
  var cutAt = 12.25, cutLen = mo.cutH, rounds = 0;
  PLN_LINE_IDS.forEach(function(k, li) {
    var l = mo.lines[k], y = 26 + li * rowH;
    s += '<text x="4" y="' + (y + 20) + '" class="inv-pl-day-l">' + escHtml(plnLineName(k)) + '</text><text x="4" y="' + (y + 33) + '" class="inv-chart-grid-label">' + escHtml(plnKg(l.plated)) + '</text>';
    var need = l.hours, wins = [];
    var g = Math.min(need, PLN_SHIFT.general); if (g > 0) wins.push([8.5, 8.5 + g + (g > 4.5 ? 0.5 : 0), 'gen']);
    var mor = Math.min(Math.max(0, need - PLN_SHIFT.general), PLN_SHIFT.morning); if (mor > 0) wins.push([8.5 - mor, 8.5, 'ot']);
    var eve = Math.min(Math.max(0, need - PLN_SHIFT.general - PLN_SHIFT.morning), PLN_SHIFT.evening); if (eve > 0) wins.push([17, 17 + eve, 'ot']);
    var nt = Math.max(0, need - PLN_SHIFT.general - PLN_SHIFT.morning - PLN_SHIFT.evening); if (nt > 0) wins.push([20, 20 + nt, 'night']);
    var mix = {}, tot = 0;
    mo.rows.forEach(function(r) { if (r.line === k && r.kgMo > 0) { mix[r.client] = (mix[r.client] || 0) + r.kgMo; tot += r.kgMo; } });
    var n = Math.round(l.plated / Math.max(1, l.kgRound)), seq = [], acc = {};
    for (var q = 0; q < n; q++) { var best = null, bv = -1e9; Object.keys(mix).forEach(function(cid) { var v = (q + 1) * mix[cid] / tot - (acc[cid] || 0); if (v > bv) { bv = v; best = cid; } }); acc[best] = (acc[best] || 0) + 1; seq.push(best); }
    var waitEvery = mo.pickShare < 0.999 ? Math.max(1, Math.round(1 / Math.max(0.05, 1 - mo.pickShare))) : 0, qi = 0, step = l.every / 60;
    wins.sort(function(a, b) { return a[0] - b[0]; }).forEach(function(w) {
      var t = w[0];
      if (w[2] !== 'gen') s += '<rect x="' + X(w[0]) + '" y="' + (y + 2) + '" width="' + (X(w[1]) - X(w[0])) + '" height="36" rx="4" class="inv-pl-day-' + w[2] + '"/>';
      var guard = 0;
      while (qi < seq.length && t + step <= w[1] + 0.001 && guard++ < 400) {
        if (w[2] === 'gen' && t >= 13 && t < 13.5) { t = 13.5; continue; }
        if (cutLen > 0.01 && t + step > cutAt && t < cutAt + cutLen) { t = cutAt + cutLen; continue; }
        if (waitEvery && qi > 0 && qi % waitEvery === 0 && !acc['w' + qi]) { acc['w' + qi] = 1; s += '<rect x="' + X(t) + '" y="' + (y + 6) + '" width="' + Math.max(1, X(t + step) - X(t) - 1) + '" height="28" class="inv-pl-day-wait"><title>Waiting for pickling</title></rect>'; t += step; continue; }
        var cid = seq[qi++];
        s += '<rect x="' + X(t) + '" y="' + (y + 6) + '" width="' + Math.max(1, X(t + step) - X(t) - 1.2) + '" height="28" rx="2" class="inv-chart-c' + (palette[cid] != null ? palette[cid] : 7) + (w[2] === 'gen' ? '' : ' inv-pl-day-otr') + '"><title>' + escHtml((cid === 'card' ? 'Your cards' : plnClientNameOf(cid)) + ' · ' + formatNum(l.kgRound, 0) + ' kg') + '</title></rect>';
        rounds++; t += step;
      }
    });
  });
  var py = 26 + PLN_LINE_IDS.length * rowH;
  s += '<text x="4" y="' + (py + 22) + '" class="inv-pl-day-l">Pickling</text><rect x="' + X(8.5) + '" y="' + (py + 10) + '" width="' + Math.max(2, X(8.5 + mo.pickH + mo.cutH) - X(8.5)) + '" height="18" rx="3" class="inv-pl-day-pick' + (mo.pickShare < 0.999 ? ' inv-pl-day-short' : '') + '"><title>' + escHtml(plnKg(mo.pickCap) + ' it can feed in ' + plnHm(mo.pickH) + ' h') + '</title></rect>';
  s += '<rect x="' + X(13) + '" y="20" width="' + (X(13.5) - X(13)) + '" height="' + (H - 40) + '" class="inv-pl-day-lunch"/>';
  if (cutLen > 0.01) s += '<rect x="' + X(cutAt) + '" y="20" width="' + Math.max(2, X(cutAt + cutLen) - X(cutAt)) + '" height="' + (H - 40) + '" class="inv-pl-day-cut"/><text x="' + X(cutAt + cutLen / 2) + '" y="' + (H - 6) + '" text-anchor="middle" class="inv-chart-grid-label">' + formatNum(cutLen * 60, 0) + ' min cut</text>';
  s += '</svg>';
  var dayKg = PLN_LINE_IDS.reduce(function(t, k) { return t + mo.lines[k].plated; }, 0);
  var tile = function(label, value, sub) { return '<div class="inv-tile"><div class="inv-tile-label">' + label + '</div><div class="inv-tile-value">' + value + '</div><div class="inv-tile-sub">' + sub + '</div></div>'; };
  var h = '<div class="inv-panel" id="plnDay"><div class="inv-panel-head"><span class="inv-panel-title">An average day in ' + escHtml(plnMonthLabel(_plnMonth)) + '</span>' +
    '<span class="inv-seg inv-seg-fit" role="group" aria-label="The day"><button class="inv-seg-btn" aria-pressed="' + (_plnDayMode === 'now') + '" data-action="invPlnDayMode" data-id="now">As it runs</button><button class="inv-seg-btn" aria-pressed="' + (_plnDayMode === 'plan') + '" data-action="invPlnDayMode" data-id="plan">With the plan</button></span></div>' +
    '<div class="inv-tiles">' + tile('Plated in the day', escHtml(plnKg(dayKg)), escHtml(rounds + ' rounds on ' + PLN_LINE_IDS.length + ' lines')) +
      tile('× ' + B.wd + ' working days', escHtml(plnKg(dayKg * B.wd)), escHtml('the month on the Ledger: ' + plnKg(mo.plated))) +
      tile('Overtime', escHtml(formatNum(mo.otH, 1) + ' line-h'), escHtml('today ' + formatNum(B.otBase, 1) + (mo.nightH ? ' · night ' + formatNum(mo.nightH, 1) : ''))) +
      tile('Lost', escHtml(formatNum(mo.cutH * 60, 0) + ' min'), escHtml(mo.pickShare < 0.999 ? 'to cuts · pickling feeds ' + Math.round(mo.pickShare * 100) + '% of what the lines could take' : 'to cuts · pickling keeps up')) + '</div>' +
    '<div class="inv-scroll-x">' + s + '</div>' +
    '<div class="inv-chart-keys">' + B.clients.filter(function(c) { return (mo.byClient[c.id] || 0) > 0; }).slice(0, 8).map(function(c) { return '<span class="inv-chart-key"><span class="inv-chart-swatch inv-chart-c' + palette[c.id] + '"></span>' + escHtml(plnClientShort(c)) + '</span>'; }).join('') +
      '<span class="inv-chart-key"><span class="inv-chart-swatch inv-pl-day-wait"></span>Waiting for pickling</span><span class="inv-chart-key"><span class="inv-chart-swatch inv-pl-day-cut"></span>Power cut</span></div>' +
    '<div class="inv-note">Each line runs the general shift first, then the morning block from 6:00, then the evening to 8 PM, then a night shift where the plan has a night crew: the hours its kilos need at its round. Rounds are coloured by client in proportion to the line’s work. The month stepper above moves the day.</div></div>';
  h += '<div class="inv-panel inv-panel-flush" id="plnDayWhy"><div class="inv-panel-head"><span class="inv-panel-title">Why the day is as it is</span></div><div class="inv-scroll-x"><table class="inv-table"><thead><tr><th>Line</th><th class="inv-num">Kilos to plate</th><th class="inv-num">Kg an hour</th><th class="inv-num">Hours needed</th><th class="inv-num">Hours run</th><th class="inv-num">Plated</th></tr></thead><tbody>' +
    PLN_LINE_IDS.map(function(k) { var l = mo.lines[k]; return '<tr><td>' + escHtml(plnLineName(k)) + '<div class="inv-row-meta">' + escHtml(formatNum(l.kgRound, 0) + ' kg a round every ' + formatNum(l.every, 0) + ' min') + '</div></td><td class="inv-num">' + escHtml(plnKg(l.demand)) + '</td><td class="inv-num">' + formatNum(l.kgH, 0) + '</td>' +
      '<td class="inv-num">' + plnHm(l.need) + '</td><td class="inv-num">' + plnHm(l.hours) + '</td><td class="inv-num">' + escHtml(plnKg(l.plated)) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  return '<div class="inv-panels inv-pl-play">' + h + '</div>';
}

/* ---------- Plant: what each line can do, the machines, an upgrade tree per station ---------- */
function plnPlantHtml() {
  var P = plnPlanned(_plnMode), mo = P.months[_plnMonth], B = P.B, sc = P.sc;
  var srcOf = function(l) { var L = B.lines[l]; return L.src === 'register' ? 'the register: ' + formatNum(L.register.rounds, 0) + ' rounds a day over ' + L.register.days + ' days' : L.src === 'set' ? 'set by you' : L.fitted ? 'assumed, its kilos a round raised to what the book plated: no register read for this line' : 'assumed: no register read for this line'; };
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
        '<td>' + escHtml(plnLineName(p.line)) + '<div class="inv-row-meta">' + escHtml(p.lineSrc === 'record' ? 'the record' : p.lineSrc === 'client' ? 'the client’s usual line' : 'assumed') + '</div></td>' +
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

function plnRoll() {
  var P = plnPlanned(_plnMode);
  if (!P) return;
  var R = plnTrials();
  _plnResult = R; _plnReplay = null;
  plnSetView('play'); _plnMoved = false;
  renderPlanner();
  showToast(PLN_TRIALS + ' trials rolled: the goal in ' + Math.round(R.score * 100) + '%');
}
function plnReplayOne() {
  if (!_plnResult) return;
  var n = Math.floor(Math.random() * _plnResult.all.length);
  _plnReplay = { n: n + 1, t: _plnResult.all[n] };
  renderPlanner();
}
/* A card of the owner's own: what it changes, its cost, its chance, what it needs first. Kept on the scenario. */
var PLN_CARD_KINDS = [['volume', 'New work: tonnes at a rate, on a line'], ['line', 'A line: more kilos a round'], ['save', 'A cost: saves a sum a month']];
function plnCardEdit(id, kind, typed) {
  var sc = plnScenario(), k = id && sc ? (sc.cards || []).find(function(c) { return c.id === id; }) : null, v = Object.assign({}, k || { kind: 'volume', p: 0.7, lag: 1, line: 'vat-a2' });
  if (kind) v.kind = kind;
  if (typed) Object.keys(typed).forEach(function(f) { if (typed[f] != null) v[f] = typed[f]; });
  var needs = [['', 'Nothing']].concat(PLN_TECH.map(function(t) { return [t.id, t.t]; }), PLN_ROLES.map(function(r) { return [r.id, r.t]; }));
  var lineOpts = PLN_LINE_IDS.map(function(l) { return [l, plnLineName(l)]; });
  var body = v.kind === 'volume' ? _plnField('plnCTonnes', 'Tonnes a month', v.tonnes, 'number') + _plnField('plnCRate', 'At ₹ a kg', v.rate, 'number') + _plnSelect('plnCLine', 'On the line', lineOpts, v.line)
    : v.kind === 'line' ? _plnSelect('plnCLine', 'The line', lineOpts, v.line || 'vat-a1') + _plnField('plnCKgRound', 'Kilos more a round', v.kgRound, 'number')
    : _plnField('plnCGain', 'Saves a month, ₹', v.gain, 'number');
  var html = '<div class="inv-dialog" data-pl-card-dialog>' + dialogHeadHtml(k ? 'Edit the card' : 'New card') + '<div class="inv-fields">' +
    _plnField('plnCTitle', 'What it is', v.title) +
    '<label class="inv-field"><span class="inv-field-label">What it changes</span><select class="inv-input" id="plnCKind" data-pl-card-kind="1" data-pl-card-id="' + escHtml(id || '') + '">' + PLN_CARD_KINDS.map(function(o) { return '<option value="' + o[0] + '"' + (o[0] === v.kind ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
    body + _plnField('plnCCost', 'Costs once, ₹', v.cost, 'number') + _plnField('plnCRun', 'Costs a month, ₹', v.run, 'number') +
    _plnField('plnCP', 'Chance it works, in 10', v.p != null ? Math.round(v.p * 10) : 7, 'number', ' min="1" max="10"') + _plnField('plnCLag', 'Months before it counts', v.lag != null ? v.lag : 1, 'number') +
    _plnSelect('plnCNeeds', 'Needs first', needs, v.needs || '') + _plnField('plnCWhy', 'One line on why', v.why) + '</div>' +
    '<div class="inv-dialog-foot">' + (k ? '<button class="inv-btn inv-btn-danger" data-action="invPlnCardRetire" data-id="' + escHtml(k.id) + '">Remove</button>' : '') +
    '<button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invPlnCardSave"' + (k ? ' data-id="' + escHtml(k.id) + '"' : '') + '>' + (k ? 'Save' : 'Add to my cards') + '</button></div></div>';
  dialogOpen(html, { dismiss: true, replace: !!document.querySelector('[data-pl-card-dialog]') });
}
/* What is typed on the card dialog, so a change of kind redraws it without losing a figure (a field the kind does not show is
   left as it was). */
function plnCardTyped() {
  var o = {}, f = { plnCTitle: 'title', plnCTonnes: 'tonnes', plnCRate: 'rate', plnCLine: 'line', plnCKgRound: 'kgRound', plnCGain: 'gain', plnCCost: 'cost', plnCRun: 'run', plnCLag: 'lag', plnCNeeds: 'needs', plnCWhy: 'why' };
  Object.keys(f).forEach(function(id) { if (document.getElementById(id)) o[f[id]] = _plnVal(id); });
  var pv = _plnNum('plnCP'); if (pv != null) o.p = Math.max(1, Math.min(10, pv)) / 10;
  return o;
}
function plnCardSave(id) {
  var title = _plnVal('plnCTitle');
  if (!title) return uiAlert({ title: 'Name the card', body: 'A card needs to say what it is.' });
  var kind = _plnVal('plnCKind'), num = function(x) { var v = _plnNum(x); return v != null && v >= 0 ? v : 0; };
  var rec = { title: title.slice(0, 60), kind: kind, tonnes: num('plnCTonnes'), rate: num('plnCRate'), line: _plnVal('plnCLine') || 'vat-a2', kgRound: num('plnCKgRound'), gain: num('plnCGain'),
    cost: num('plnCCost'), run: num('plnCRun'), p: Math.max(1, Math.min(10, num('plnCP') || 7)) / 10, lag: num('plnCLag'), needs: _plnVal('plnCNeeds'), why: _plnVal('plnCWhy') };
  if (kind === 'volume' && !(rec.tonnes > 0 && rec.rate > 0)) return uiAlert({ title: 'Tonnes and a rate', body: 'New work needs its tonnes a month and the rate it comes at.' });
  closeOverlay();
  plnEdit(function(sc) {
    var k = id ? sc.cards.find(function(c) { return c.id === id; }) : null;
    if (k) Object.assign(k, rec); else sc.cards.push(Object.assign({ id: plnId('CD') }, rec));
  });
  showToast(id ? 'Card saved' : 'Card added: plan it from Your cards');
}
function plnCardRemove(id) {
  uiConfirm({ title: 'Remove this card?', body: 'It leaves this plan; nothing else is touched.', okLabel: 'Remove', danger: true }).then(function(ok) {
    if (!ok) return;
    closeOverlay();
    plnEdit(function(sc) { sc.cards = sc.cards.filter(function(c) { return c.id !== id; }); delete sc.plan['card:' + id]; });
  });
}
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
/* ---------- The report: the plan as printed pages (the report generator's frame and type) ---------- */
function plnReportHtml() {
  var P = plnPlanned(_plnMode), B = P.B, sc = P.sc, g = plnGoal(sc), R = _plnResult, target = plnGoalMargin(g, B);
  var co = String((S.company && S.company.name) || '').trim(), title = 'The plan: ' + (sc ? sc.name : 'nothing planned yet');
  var tile = function(l, v, sub) { return '<div class="inv-rpt-tile"><div class="inv-rpt-tile-l">' + escHtml(l) + '</div><div class="inv-rpt-tile-v">' + escHtml(v) + '</div>' + (sub ? '<div class="inv-rpt-tile-s">' + escHtml(sub) + '</div>' : '') + '</div>'; };
  var sec = function(t) { return '<div class="inv-rpt-sec"><h3 class="inv-rpt-h">' + escHtml(t) + '</h3>'; };
  var table = function(head, rows) { return '<div class="inv-rpt-scroll"><table class="inv-rpt-table"><thead><tr>' + head.map(function(x, i) { return '<th' + (i ? ' class="inv-rpt-num"' : '') + '>' + escHtml(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function(r) { return '<tr>' + r.map(function(v, i) { return '<td' + (i ? ' class="inv-rpt-num"' : '') + '>' + escHtml(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; };
  var last = P.months[PLN_N - 1], m12 = P.months[11], low = Math.min.apply(null, P.months.map(function(x) { return x.cash; }));
  var h = '<div class="inv-rpt-doc" data-pl-report><table class="inv-rpt-frame"><thead><tr><td class="inv-rpt-frame-head">' + escHtml([co, title].filter(Boolean).join(' · ')) + '</td></tr></thead>' +
    '<tfoot><tr><td class="inv-rpt-frame-foot"></td></tr></tfoot><tbody><tr><td class="inv-rpt-frame-body">' +
    '<div class="inv-rpt-head">' + (co ? '<div class="inv-rpt-co">' + escHtml(co) + '</div>' : '') + '<h2 class="inv-rpt-title">' + escHtml(title) + '</h2>' +
    '<div class="inv-rpt-meta">' + escHtml('A simulation over ' + PLN_N + ' months from ' + plnMonthLabel(0) + ', built on the book from ' + formatDate(B.period.from) + ' to ' + formatDate(B.period.to) + ' · generated ' + formatDate(localDateStr()) +
      ' · ' + (_plnMode === 'expected' ? 'each move weighted by its chance' : 'every move landing')) + '</div></div>';
  h += '<div class="inv-rpt-tiles">' + tile('As it runs', formatCurrency(P.base[0].margin), 'margin a month over full cost, today') +
    tile('In a year', formatCurrency(m12.margin), 'margin a month, ' + plnMonthLabel(11)) + tile('In two years', formatCurrency(last.margin), plnMonthLabel(PLN_N - 1)) +
    tile('Lowest cash', formatCurrency(low), (B.cash.src === 'none' ? 'counted from zero: no cash known' : 'from ' + formatCurrency(B.cash.v) + (B.cash.src === 'statement' ? ' on the statement' : ', as set'))) +
    tile('CQI-11', P.ready.cqi != null ? plnMonthLabel(Math.min(PLN_N - 1, P.ready.cqi)) : 'not in the plan', P.ready.cqi != null ? 'if each step lands' : '') +
    tile('The goal', R ? Math.round(R.score * 100) + '% of ' + PLN_TRIALS + ' trials' : 'not rolled', g.say) + '</div>';
  if (target != null) h += '<p class="inv-rpt-p">' + escHtml('The goal’s margin is ' + formatCurrency(target) + ' a month in ' + plnMonthLabel(g.at) + '.') + '</p>';
  h += sec('The moves') + (P.L.length ? table(['Move', 'From', 'In effect', 'Once', 'A month', 'Chance'], P.L.map(function(mv) {
    return [mv.label, plnMonthLabel(Math.max(0, mv.at)), P.ready[mv.key] != null ? plnMonthLabel(Math.min(PLN_N - 1, P.ready[mv.key])) : 'never', mv.cost ? formatCurrency(mv.cost) : '—', mv.run ? formatCurrency(mv.run) : '—', mv.p != null ? Math.round(mv.p * 10) + ' in 10' : '—'];
  })) : '<p class="inv-rpt-none">Nothing is planned.</p>') + '</div>';
  h += sec('Month by month') + table(['Month', 'Plated', 'Revenue', 'Cost', 'Interest', 'Margin', 'Spend', 'Loan', 'Cash'], P.months.map(function(x, i) {
    return [plnMonthLabel(i), plnKg(x.plated), formatCurrency(x.rev), formatCurrency(x.costTot), formatCurrency(x.interest), formatCurrency(x.margin), formatCurrency(x.capex), formatCurrency(x.loanIn - x.principal), formatCurrency(x.cash)];
  })) + '</div>';
  var at = plnAttribution(_plnMonth, _plnMode);
  h += sec(plnMonthLabel(_plnMonth) + ': how the margin adds up') + table(['', 'Margin a month'], [['As it runs', formatCurrency(at.base)]].concat(at.rows.map(function(r) { return [r.mv.label, plnSigned(r.margin, true)]; }), [['The plan', formatCurrency(at.plan)]])) + '</div>';
  var mo = P.months[_plnMonth];
  h += sec('The lines in ' + plnMonthLabel(_plnMonth)) + table(['Line', 'Kg a round', 'A round every', 'Kilos a day', 'Hours a day', 'Where it comes from'], PLN_LINE_IDS.map(function(l) {
    var x = mo.lines[l]; return [plnLineName(l), formatNum(x.kgRound, 0), formatNum(x.every, 0) + ' min', plnKg(x.plated), plnHm(x.hours), B.lines[l].src === 'register' ? 'the register' : B.lines[l].src === 'set' ? 'set' : B.lines[l].fitted ? 'assumed, fitted to the book' : 'assumed'];
  })) + '</div>';
  if (R) h += sec('The trials') + '<p class="inv-rpt-p">' + escHtml(PLN_TRIALS + ' trials, seeded. Each draws whether each move comes through at its chance, CQI-11’s month (up to three months late), each machine’s risk until its fix, the month’s power cuts (0.6 to 1.5 times the usual) and a client refusing an ask. ' +
    'The goal is reached in ' + Math.round(R.score * 100) + '%; cash dips below zero in ' + Math.round(R.red * 100) + '%; CQI-11 is in time in ' + Math.round(R.cqiShare * 100) + '%. In ' + plnMonthLabel(PLN_N - 1) + ' the middle trial’s margin is ' +
    formatCurrency(R.p50[PLN_N - 1]) + ', 8 in 10 between ' + formatCurrency(R.p10[PLN_N - 1]) + ' and ' + formatCurrency(R.p90[PLN_N - 1]) + '.') + '</p></div>';
  var mach = plnLive('machines'), chk = plnLive('checklist'), len = plnLive('lenders');
  h += sec('The records it stands on') + '<p class="inv-rpt-p">' + escHtml(mach.length + ' machines recorded, ' + mach.filter(function(x) { return x.state === 'needs'; }).length + ' needing work · CQI-11 checklist ' + chk.filter(function(x) { return x.status === 'in'; }).length + ' of ' + chk.length + ' in place · ' + len.length + ' lenders') + '</p>' +
    (sc && sc.loan ? '<p class="inv-rpt-p">' + escHtml('The loan: ' + plnLoanLabel(sc.loan) + ' over ' + sc.loan.months + ' months, ' + (sc.loan.mor || 0) + ' interest only, taken ' + plnMonthLabel(sc.loan.at || 0) + (sc.loan.ties ? '; it ties ' + sc.loan.ties : '') + '.') + '</p>' : '') + '</div>';
  var C = B.cost, cfg = plnCfg();
  h += sec('What it assumes') + '<ul class="inv-rpt-list">' + [
    'Each part’s kilos and rate are the book’s average month, ' + formatDate(B.period.from) + ' to ' + formatDate(B.period.to) + '; ' + Math.round(B.coverage * 100) + '% of revenue carries a weight.',
    'Zinc ₹' + formatNum(C.zincKg, 2) + ', chemicals ₹' + formatNum(C.chemKg, 2) + ' and upkeep ₹' + formatNum(C.otherKg, 2) + ' a kilo plated, from the live cost; labour as recorded.',
    'Electricity ' + formatCurrency(C.powerFixed) + ' a month fixed (' + (plnRead().cfg && plnRead().cfg.powerFixed != null ? 'set' : 'assumed') + ') and ₹' + formatNum(C.powerKg, 2) + ' a kilo.',
    'A new overtime line-hour costs ' + formatCurrency(cfg.otLineHour) + '; pickling feeds ' + formatNum(B.pick.kgH, 0) + ' kg an hour (' + (B.pick.src === 'set' ? 'set' : 'assumed') + ').',
    'Power cuts take ' + formatNum(B.cutMin, 0) + ' minutes a working day in working hours, from the Power tab.',
    'Every chance is the owner’s read. Upgrade costs are estimates until a quote replaces them.'].map(function(x) { return '<li>' + escHtml(x) + '</li>'; }).join('') + '</ul></div>';
  return h + '</td></tr></tbody></table></div>';
}
function plnReportOpen() {
  var body = document.getElementById('invPrintBody');
  if (!body || !plnPlanned(_plnMode)) return;
  body.innerHTML = plnReportHtml();
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  _printInvId = null;
  printFit();
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  var sc = plnScenario();
  document.title = 'SEP plan ' + (sc ? sc.name : '') + ' ' + localDateStr();
}
/* A report open in the print view follows the plan as it changes. */
function plnReportRedraw() {
  var body = document.getElementById('invPrintBody'), view = document.getElementById('invPrintView');
  if (body && view && view.classList.contains('inv-print-view-active') && body.querySelector('[data-pl-report]')) { body.innerHTML = plnReportHtml(); printFit(); }
}

/* ---------- The To-do: the checklist and the machines are records, and they ask ---------- */
TODO_RULES.push(['plnCheck', 'Planner: a CQI-11 checklist item missing and due']);
TODO_CHECK_DEFAULTS.plnCheck = true;
TODO_RULE_FNS.plnCheck = function() {
  var today = localDateStr(), end = payMonthEnd(today.slice(0, 8) + '01');
  var due = plnLive('checklist').filter(function(x) { return x.status !== 'in' && x.due && x.due <= end; });
  if (!due.length) return [];
  var late = due.filter(function(x) { return x.due < today; });
  return [{ key: 'plnCheck', rule: 'plnCheck', tone: late.length ? 'red' : 'amber', title: due.length + ' CQI-11 checklist item' + (due.length === 1 ? '' : 's') + ' due' + (late.length ? ', ' + late.length + ' late' : ' this month'),
    sub: due.slice(0, 3).map(function(x) { return (x.ref ? x.ref + ' ' : '') + x.what; }).join(' · '), why: 'Planner · the CQI-11 checklist',
    facts: due.slice(0, 6).map(function(x) { return [(x.ref ? x.ref + ' · ' : '') + x.what, (x.status === 'partly' ? 'partly, ' : 'missing, ') + 'due ' + formatDate(x.due) + (x.owner ? ' · ' + x.owner : '')]; }),
    clears: 'Clears itself when each item is marked in place, or its due date moves.', go: { kind: 'planner', v: 'tech' }, goLabel: 'Open the checklist',
    sig: due.map(function(x) { return x.id + ':' + x.status + ':' + x.due; }).join('|') }];
};
TODO_RULES.push(['plnMachine', 'Planner: a machine recorded as needing work']);
TODO_CHECK_DEFAULTS.plnMachine = true;
TODO_RULE_FNS.plnMachine = function() {
  var list = plnLive('machines').filter(function(x) { return x.state === 'needs'; });
  if (!list.length) return [];
  return [{ key: 'plnMachine', rule: 'plnMachine', tone: 'amber', title: list.length + ' machine' + (list.length === 1 ? '' : 's') + ' recorded as needing work',
    sub: list.slice(0, 3).map(function(x) { return x.item + (x.needs ? ': ' + x.needs : ''); }).join(' · '), why: 'Planner · machines and infrastructure',
    facts: list.slice(0, 6).map(function(x) { return [x.item, (x.needs || 'needs work') + (x.risk && x.risk.p ? ' · ' + Math.round(x.risk.p * 100) + '% a month it fails' : '')]; }),
    clears: 'Clears itself when the machine’s state is changed.', go: { kind: 'planner', v: 'plant' }, goLabel: 'Open Plant', sig: list.map(function(x) { return x.id + ':' + x.state; }).join('|') }];
};
TODO_RULE_NEED.plnCheck = 'money';
TODO_RULE_NEED.plnMachine = 'money';
