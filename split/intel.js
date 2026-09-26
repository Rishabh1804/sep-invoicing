/* ===== The intelligence engine, part two: the overview and margin by client =====

   Owner, 25 Sep 2026: part two of the engine (the overview and the margin by
   client, from the mockup), and "break up the stats page into multiple grouped
   tabs". Stats is now five tabs over one period: Overview, Clients, Cost,
   Billing, Trends.

   **Everything here reads the live cost (cost.js)**, never the typed ₹8.55:
   realisation against what the book says the plant cost, with the share of
   that cost actually measured beside it. A cost that is mostly model is said to
   be mostly model; the margin it implies is never shown without that.

   **Margin by client spreads cost per kilo.** Labour, zinc, chemicals, power and
   the rest are divided over every kilo plated, so a thin clamp and a heavy
   bracket cost the same per kg here. That is the one assumption the table
   cannot check, and it says so. Fixed is the monthly crew (its days and rest
   days); everything else is variable. A client below the variable cost loses
   money on every kilo whatever the labour question; one between variable and
   full cost contributes only if labour is fixed. */

var STATS_TABS = [['overview', 'Overview'], ['clients', 'Clients'], ['cost', 'Cost'], ['billing', 'Billing'], ['trends', 'Trends']];
var STATS_TAB_KEY = 'sep_inv_stats_tab';
var STATS_CAPACITY_KG_DAY = 4000; // ~2 t per 8-hour shift, two shifts (CLAUDE.md § Key Business Data)

function statsTab() {
  var t = null;
  try { t = localStorage.getItem(STATS_TAB_KEY); } catch (e) { /* per-device convenience only */ }
  return STATS_TABS.some(function(x) { return x[0] === t; }) ? t : 'overview';
}
function statsSetTab(t) {
  try { localStorage.setItem(STATS_TAB_KEY, t); } catch (e) { /* per-device convenience only */ }
  renderStats();
  window.scrollTo(0, 0);
}
function statsTabsHtml() {
  var cur = statsTab();
  return '<div class="inv-stats-tabs" role="tablist">' + STATS_TABS.map(function(t) {
    return '<button class="inv-stats-tab' + (cur === t[0] ? ' inv-stats-tab-on' : '') + '" role="tab" aria-selected="' + (cur === t[0]) +
      '" data-action="invStatsTab" data-tab="' + t[0] + '">' + t[1] + '</button>';
  }).join('') + '</div>';
}

/* The period the Stats chips select, as ISO dates. */
function statsRangeIso(period) {
  var range = periodRange(period, 0);
  var iso = function(ts) { var d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  if (range) return { from: iso(range.start), to: iso(range.end) };
  var first = (S.invoices || []).map(function(i) { return i.date; }).filter(Boolean).sort()[0];
  return { from: first || localDateStr(), to: localDateStr() };
}
function statsWorkingDays(from, to) {
  var n = 0, d = from;
  for (var g = 0; d <= to && g < 4000; g++) { if (new Date(d + 'T00:00:00').getDay() !== 0) n++; d = stockIsoAdd(d, 1); }
  return n;
}
/* Fixed and variable, from the live cost: fixed is the monthly crew's days and
   rest days; everything else moves with the work. */
function statsCostSplit(c) {
  var lab = c.rows.find(function(r) { return r.key === 'labour'; });
  var fixed = 0;
  (lab ? lab.detail : []).forEach(function(d) { if (/^Monthly crew/.test(d.label)) fixed += d.amount; });
  return { fixed: gstRound(fixed), variable: gstRound(c.total - fixed) };
}
function statsMoney(n) { return (n < 0 ? '&minus;' : '') + escHtml(formatCurrency(Math.abs(n))); }
function statsSigned(n) { return (n > 0 ? '+' : n < 0 ? '&minus;' : '') + escHtml(formatCurrency(Math.abs(n))); }

/* ---------- Overview: the period in one card ---------- */
function statsOverviewHtml(period, filtered, tonnage) {
  var r = statsRangeIso(period), kg = tonnage.kg;
  var c = liveCost(r.from, r.to, kg);
  var real = kg > 0 ? tonnage.revKnown / kg : null;
  var contrib = real != null && c.perKg != null ? real - c.perKg : null;
  var cap = STATS_CAPACITY_KG_DAY * statsWorkingDays(r.from, r.to);
  var capPct = cap > 0 ? kg / cap : null;
  var measured = Math.round(c.measuredShare * 100);
  var h = '<div class="inv-stats-card inv-stats-card-full" id="statsOverview"><div class="inv-stats-title">' + escHtml(PERIOD_LABELS[period] || '') +
    ' In one line<span class="inv-stats-title-sub">against the live cost, ' + measured + '% of it measured</span></div>';
  if (!(kg > 0)) return h + '<div class="inv-stats-caveat">No weighed tonnage in this period, so no ₹/kg to compare.</div></div>';
  h += '<div class="inv-ov-grid">' +
    '<div class="inv-ov-tile inv-pay-blue"><div class="inv-ov-l">Realisation</div><div class="inv-ov-v">' + statsMoney(real) + '<small>/kg</small></div><div class="inv-ov-s">' + statsMoney(tonnage.revKnown) + ' on ' + formatNum(kg / 1000, 1) + ' t</div></div>' +
    '<div class="inv-ov-tile inv-pay-green"><div class="inv-ov-l">Live cost</div><div class="inv-ov-v">' + statsMoney(c.perKg) + '<small>/kg</small></div><div class="inv-ov-s">typed ' + statsMoney(S.defaultCostPerKg || 0) + '</div></div>' +
    '<div class="inv-ov-tile ' + (contrib >= 0 ? 'inv-pay-green' : 'inv-area-gap-over') + '"><div class="inv-ov-l">Contribution</div><div class="inv-ov-v" id="statsContrib">' + statsSigned(contrib) + '<small>/kg</small></div><div class="inv-ov-s">' + statsSigned(gstRound(contrib * kg)) + ' on the period</div></div>' +
    '<div class="inv-ov-tile inv-area-gap-under"><div class="inv-ov-l">Capacity</div><div class="inv-ov-v">' + (capPct != null ? Math.round(capPct * 100) + '%' : '&mdash;') + '</div><div class="inv-ov-s">' + formatNum(kg / 1000, 1) + ' t of ~' + formatNum(cap / 1000, 0) + ' t (2 shifts)</div></div>' +
    '</div>';
  if (finHasBank()) {
    var bRows = bankRows(), bLast = bRows[bRows.length - 1], bRecv = finCtx().recv(), bBook = bankBookDaysToPay(bankPayHistory(bRecv));
    h += '<div class="inv-stats-row" id="statsCash"><span class="inv-stats-name">Cash<span class="inv-cost-note">bank on ' + escHtml(formatDate(bLast.date)) + ' · owed to us' +
      (bBook ? ' · clients pay in ' + Math.round(bBook.median) + ' days' : '') + '</span></span><span class="inv-stats-val">' + statsMoney(bLast.balance) + ' · ' +
      statsMoney(gstRound(bRecv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0))) +
      ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="overview">Finance</button></span></div>';
  }
  var parts = c.rows.filter(function(x) { return x.source !== 'measured' && x.source !== 'bank'; }).map(function(x) { return x.label.toLowerCase() + ' (' + COST_SRC_LABEL[x.source] + ')'; });
  if (parts.length) {
    h += '<div class="inv-stats-caveat"><strong>Read with care:</strong> ' + escHtml(parts.join(', ')) + ' ' + (parts.length === 1 ? 'is' : 'are') +
      ' not fully measured, so the contribution is only as good as ' + (parts.length === 1 ? 'that figure' : 'those figures') + '. Cost tab &rarr; Live cost shows each one.</div>';
  }
  return h + '</div>';
}

/* ---------- Overview: six months side by side ---------- */
function statsMonthsHtml() {
  var today = localDateStr(), rows = [];
  var active = (S.invoices || []).filter(function(i) { return i.status === 'active' && i.date; });
  for (var k = 5; k >= 0; k--) {
    var d = new Date(today + 'T00:00:00'); d.setDate(1); d.setMonth(d.getMonth() - k);
    var from = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01', to = payMonthEnd(from);
    if (to > today) to = today;
    var inv = active.filter(function(i) { return i.date >= from && i.date <= to; });
    var w = weighLines(inv), c = liveCost(from, to, w.kg);
    var real = w.kg > 0 ? w.revKnown / w.kg : null;
    var lab = c.rows.find(function(x) { return x.key === 'labour'; });
    rows.push({ label: d.toLocaleString('en-IN', { month: 'short' }) + (to === today ? ' to date' : ''), real: real, cost: c.perKg, kg: w.kg,
      contrib: real != null && c.perKg != null ? real - c.perKg : null, labour: lab && w.kg > 0 ? lab.amount / w.kg : null, labCov: lab ? Math.max(lab.coverage || 0, lab.bankShare || 0) : 0, measured: c.measuredShare });
  }
  if (!rows.some(function(r) { return r.kg > 0; })) return '';
  var h = '<div class="inv-stats-card inv-stats-card-full" id="statsMonths"><div class="inv-stats-title">Six months<span class="inv-stats-title-sub">each at its own live cost</span></div>' +
    '<table class="inv-ov-table"><thead><tr><th>Month</th><th>t</th><th>₹/kg</th><th>Cost</th><th>Contrib.</th><th>Labour</th><th>Measured</th></tr></thead><tbody>';
  rows.forEach(function(r) {
    h += '<tr><td>' + escHtml(r.label) + '</td><td>' + formatNum(r.kg / 1000, 1) + '</td><td>' + (r.real != null ? formatNum(r.real, 2) : '&mdash;') + '</td><td>' +
      (r.cost != null ? formatNum(r.cost, 2) : '&mdash;') + '</td><td class="' + (r.contrib == null ? '' : r.contrib >= 0 ? 'inv-ov-pos' : 'inv-ov-neg') + '">' +
      (r.contrib != null ? (r.contrib >= 0 ? '+' : '&minus;') + formatNum(Math.abs(r.contrib), 2) : '&mdash;') + '</td><td>' +
      (r.labour != null && r.labCov >= 0.9 ? formatNum(r.labour, 2) : '&mdash;') + '</td><td>' + Math.round(r.measured * 100) + '%</td></tr>';
  });
  h += '</tbody></table><div class="inv-stats-note">₹ per kg. Labour shows only where the days are recorded, or the bank statement covers what paid them (90% or more); a month with less is withheld rather than read low. ' +
    'Measured is the share of that month&rsquo;s cost from the app&rsquo;s own records.</div></div>';
  return h;
}

/* ---------- Clients: contribution by client ---------- */
function statsClientMargins(period, filtered, tonnage, range) {
  var r = range || statsRangeIso(period), c = liveCost(r.from, r.to, tonnage.kg);
  if (!(tonnage.kg > 0) || c.perKg == null) return null;
  var split = statsCostSplit(c);
  var varKg = split.variable / tonnage.kg, fullKg = c.perKg;
  var cns = {};
  (S.creditNotes || []).forEach(function(n) {
    if (n.status === 'cancelled' || !n.periodTo || n.periodTo < r.from || n.periodTo > r.to) return;
    cns[n.clientId] = (cns[n.clientId] || 0) + (n.taxableValue || 0);
  });
  var rows = buildClientRollup(filtered).map(function(x) {
    var cn = cns[x.clientId] || 0;
    var net = x.comparable && x.kg > 0 ? (x.revKnown - cn) / x.kg : null;
    return { id: x.clientId, name: x.name, kg: x.kg, total: x.total, real: x.realisation, comparable: x.comparable, coverage: x.coverage,
      cn: cn, net: net, vsVar: net != null ? net - varKg : null, vsFull: net != null ? net - fullKg : null,
      money: net != null ? gstRound((net - fullKg) * x.kg) : null };
  });
  return { c: c, varKg: varKg, fullKg: fullKg, fixedKg: split.fixed / tonnage.kg, kg: tonnage.kg, rev: filtered.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0),
    ranked: rows.filter(function(x) { return x.comparable; }).sort(function(a, b) { return a.vsFull - b.vsFull; }),
    apart: rows.filter(function(x) { return !x.comparable; }) };
}

function statsMarginHtml(period, filtered, tonnage) {
  var m = statsClientMargins(period, filtered, tonnage);
  var h = '<div class="inv-stats-card inv-stats-card-full" id="statsMargin"><div class="inv-stats-title">' + escHtml(PERIOD_LABELS[period] || '') +
    ' Contribution by client<span class="inv-stats-title-sub">worst first, at the live cost</span></div>';
  if (!m) return h + '<div class="inv-stats-caveat">No weighed tonnage in this period, so no margin to work out.</div></div>';
  h += '<div class="inv-stats-note">Variable cost ' + statsMoney(m.varKg) + '/kg · fixed (monthly crew) ' + statsMoney(m.fixedKg) + '/kg · full ' + statsMoney(m.fullKg) + '/kg, ' +
    Math.round(m.c.measuredShare * 100) + '% measured.</div>';
  // Owed and days to pay beside the margin: a client below cost that also pays in 120 days is two problems.
  var money = {};
  if (finHasBank()) {
    var mh = bankPayHistory(finCtx().recv());
    finCtx().recv().forEach(function(r) { var d = bankDaysToPay(r.client.id, mh); money[String(r.client.id)] = { owed: r.owed, days: d && d.median != null ? Math.round(d.median) : null }; });
  }
  h += '<table class="inv-ov-table"><thead><tr><th>Client</th><th>₹/kg</th><th>t</th><th>vs var.</th><th>vs full</th><th>₹ on period</th></tr></thead><tbody>';
  m.ranked.forEach(function(x) {
    var cls = function(v) { return v >= 0 ? 'inv-ov-pos' : 'inv-ov-neg'; };
    h += '<tr data-action="invStatsClientDrill" data-client-id="' + escHtml(x.id) + '"><td>' + escHtml(x.name) + (x.cn ? '<span class="inv-cost-note">net of ' + statsMoney(x.cn) + ' credit notes</span>' : '') +
      (money[String(x.id)] ? '<span class="inv-cost-note" data-client-owed>owes ' + statsMoney(Math.max(0, money[String(x.id)].owed)) + (money[String(x.id)].days != null ? ' · pays in ' + money[String(x.id)].days + ' d' : '') + '</span>' : '') + '</td>' +
      '<td>' + formatNum(x.net, 2) + '</td><td>' + formatNum(x.kg / 1000, 1) + '</td>' +
      '<td class="' + cls(x.vsVar) + '">' + (x.vsVar >= 0 ? '+' : '&minus;') + formatNum(Math.abs(x.vsVar), 2) + '</td>' +
      '<td class="' + cls(x.vsFull) + '">' + (x.vsFull >= 0 ? '+' : '&minus;') + formatNum(Math.abs(x.vsFull), 2) + '</td>' +
      '<td class="' + cls(x.money) + '">' + statsSigned(x.money) + '</td></tr>';
  });
  h += '</tbody></table>';
  if (m.apart.length) h += '<div class="inv-stats-note">Listed apart, not ranked (under 90% of their revenue weighed): ' +
    m.apart.map(function(x) { return escHtml(x.name) + ' (' + Math.round(x.coverage * 100) + '%)'; }).join(', ') + '.</div>';
  h += '<div class="inv-stats-note">Cost is spread per kg: a thin clamp and a heavy bracket cost the same per kg here, which is the one assumption this table cannot check. ' +
    '&ldquo;vs var.&rdquo; is what a kilo leaves after its variable cost; &ldquo;vs full&rdquo; also carries the monthly crew.</div>';

  // The worst-placed large account, settled both ways.
  var worst = m.ranked.filter(function(x) { return x.kg >= m.kg * 0.1; })[0];
  if (worst && worst.vsFull < 0) {
    h += '<div class="inv-ov-case" id="statsWorst"><div class="inv-stats-name"><strong>' + escHtml(worst.name) + '</strong>, settled on the live cost</div>' +
      '<div class="inv-ov-grid inv-ov-grid-2">' +
      '<div class="inv-ov-tile ' + (worst.vsVar >= 0 ? 'inv-pay-green' : 'inv-area-gap-over') + '"><div class="inv-ov-l">If labour is fixed</div><div class="inv-ov-v">' + statsSigned(worst.vsVar) + '<small>/kg</small></div><div class="inv-ov-s">' +
        (worst.vsVar >= 0 ? 'contributes ' + statsMoney(gstRound(worst.vsVar * worst.kg)) : 'below its variable cost') + '</div></div>' +
      '<div class="inv-ov-tile inv-area-gap-over"><div class="inv-ov-l">If labour scales</div><div class="inv-ov-v">' + statsSigned(worst.vsFull) + '<small>/kg</small></div><div class="inv-ov-s">' + statsSigned(worst.money) + ' on the period</div></div></div>' +
      '<div class="inv-stats-row"><span class="inv-stats-name">Price that breaks even<span class="inv-cost-note">on variable · on full cost</span></span><span class="inv-stats-val">' + statsMoney(m.varKg) + ' · ' + statsMoney(m.fullKg) + '</span></div>' +
      '<div class="inv-stats-row"><span class="inv-stats-name">Share of the plant<span class="inv-cost-note">tonnage · revenue</span></span><span class="inv-stats-val">' +
        Math.round(worst.kg / m.kg * 100) + '% · ' + (m.rev > 0 ? Math.round(worst.total / m.rev * 100) : 0) + '%</span></div>' +
      '<div class="inv-stats-caveat">' + (worst.vsVar < 0 ? 'It does not cover its variable cost either way' : 'It contributes only if labour is fixed') +
      ', <strong>if</strong> its parts cost the same per kg as the rest of the book. That is the question to take to the floor before repricing.</div></div>';
  }
  return h + '</div>';
}
