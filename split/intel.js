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
  viewTop();   // another view tab: a navigation
}
function statsTabsHtml() {
  var cur = statsTab();
  return '<div class="inv-viewtabs" role="tablist" aria-label="Stats">' + STATS_TABS.map(function(t) {
    return '<button class="inv-viewtab" role="tab" aria-selected="' + (cur === t[0]) + '" data-action="invStatsTab" data-tab="' + t[0] + '">' + t[1] + '</button>';
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
  var perKg = '<span class="inv-tile-of">/kg</span>';
  var h = statsPanel('overview', escHtml(PERIOD_LABELS[period] || '') + ' in one line', 'against the live cost, ' + measured + '% of it measured',
    { wide: true, id: 'statsOverview' });
  if (!(kg > 0)) return h + statsCallout('No weighed tonnage in this period, so no ₹/kg to compare.') + '</div>';
  h += statsTiles(
    statsTile('realisation', 'Realisation', statsMoney(real) + perKg, statsTileSub(statsMoney(tonnage.revKnown) + ' on ' + formatNum(kg / 1000, 1) + ' t')) +
    statsTile('cost', 'Live cost', statsMoney(c.perKg) + perKg, statsTileSub('typed ' + statsMoney(S.defaultCostPerKg || 0))) +
    statsTile('contrib', 'Contribution', statsSigned(contrib) + perKg, statsTileSub(statsSigned(gstRound(contrib * kg)) + ' on the period'),
      contrib >= 0 ? 'ok' : 'danger', 'statsContrib') +
    statsTile('capacity', 'Capacity', capPct != null ? Math.round(capPct * 100) + '%' : '&mdash;',
      statsTileSub(formatNum(kg / 1000, 1) + ' t of ~' + formatNum(cap / 1000, 0) + ' t (2 shifts)')), true);
  if (finHasBank()) {
    var bRows = bankRows(), bLast = bRows[bRows.length - 1], bRecv = finCtx().recv(), bBook = bankBookDaysToPay(bankPayHistory(bRecv));
    h += '<div class="inv-row inv-row-2 inv-row-flow" id="statsCash"><span class="inv-row-main"><span class="inv-row-title">Cash</span>' +
      '<span class="inv-row-meta inv-row-wrap">bank on ' + escHtml(formatDate(bLast.date)) + ' · owed to us' +
      (bBook ? ' · clients pay in ' + Math.round(bBook.median) + ' days' : '') + '</span></span><span class="inv-row-end"><span class="inv-num">' + statsMoney(bLast.balance) + ' · ' +
      statsMoney(gstRound(bRecv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0))) + '</span>' +
      '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="overview">Finance</button></span></div>';
  }
  h += prodStatsRowHtml(r.from, r.to);
  var parts = c.rows.filter(function(x) { return x.source !== 'measured' && x.source !== 'bank'; }).map(function(x) { return x.label.toLowerCase() + ' (' + COST_SRC_LABEL[x.source] + ')'; });
  if (parts.length) {
    h += statsCallout('<strong>Read with care:</strong> ' + escHtml(parts.join(', ')) + ' ' + (parts.length === 1 ? 'is' : 'are') +
      ' not fully measured, so the contribution is only as good as ' + (parts.length === 1 ? 'that figure' : 'those figures') + '. Cost tab &rarr; Live cost shows each one.', '', 'model');
  }
  return h + '</div>';
}

/* A signed figure in a table: the sign carries the tone (§5.4, DR-1). */
function statsSignedCell(v, text) {
  return '<td class="inv-num' + (v == null ? '' : v >= 0 ? ' inv-num-pos' : ' inv-num-neg') + '">' + text + '</td>';
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
  var h = statsPanel('months', 'Six months', 'each at its own live cost', { wide: true, id: 'statsMonths' }) +
    '<div class="inv-scroll-x"><table class="inv-table"><thead><tr><th>Month</th><th class="inv-num">t</th><th class="inv-num">₹/kg</th><th class="inv-num">Cost</th>' +
    '<th class="inv-num">Contrib.</th><th class="inv-num">Labour</th><th class="inv-num">Measured</th></tr></thead><tbody>';
  rows.forEach(function(r) {
    h += '<tr><td class="inv-nowrap">' + escHtml(r.label) + '</td><td class="inv-num">' + formatNum(r.kg / 1000, 1) + '</td><td class="inv-num">' + (r.real != null ? formatNum(r.real, 2) : '&mdash;') + '</td>' +
      '<td class="inv-num">' + (r.cost != null ? formatNum(r.cost, 2) : '&mdash;') + '</td>' +
      statsSignedCell(r.contrib, r.contrib != null ? (r.contrib >= 0 ? '+' : '&minus;') + formatNum(Math.abs(r.contrib), 2) : '&mdash;') +
      '<td class="inv-num">' + (r.labour != null && r.labCov >= 0.9 ? formatNum(r.labour, 2) : '&mdash;') + '</td><td class="inv-num">' + Math.round(r.measured * 100) + '%</td></tr>';
  });
  h += '</tbody></table></div>' + statsBody(statsNote('₹ per kg. Labour shows only where the days are recorded, or the bank statement covers what paid them (90% or more); a month with less is withheld rather than read low. ' +
    'Measured is the share of that month&rsquo;s cost from the app&rsquo;s own records.')) + '</div>';
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
  var h = statsPanel('margin', escHtml(PERIOD_LABELS[period] || '') + ' contribution by client', 'worst first, at the live cost', { wide: true, id: 'statsMargin' });
  if (!m) return h + statsCallout('No weighed tonnage in this period, so no margin to work out.') + '</div>';
  h += statsBody(statsNote('Variable cost ' + statsMoney(m.varKg) + '/kg · fixed (monthly crew) ' + statsMoney(m.fixedKg) + '/kg · full ' + statsMoney(m.fullKg) + '/kg, ' +
    Math.round(m.c.measuredShare * 100) + '% measured.'));
  // Owed and days to pay beside the margin: a client below cost that also pays in 120 days is two problems.
  var money = {};
  if (finHasBank()) {
    var mh = bankPayHistory(finCtx().recv());
    finCtx().recv().forEach(function(r) { var d = bankDaysToPay(r.client.id, mh); money[String(r.client.id)] = { owed: r.owed, days: d && d.median != null ? Math.round(d.median) : null }; });
  }
  h += '<div class="inv-scroll-x"><table class="inv-table"><thead><tr><th>Client</th><th class="inv-num">₹/kg</th><th class="inv-num">t</th><th class="inv-num">vs var.</th>' +
    '<th class="inv-num">vs full</th><th class="inv-num">₹ on period</th></tr></thead><tbody>';
  m.ranked.forEach(function(x) {
    var sign = function(v) { return (v >= 0 ? '+' : '&minus;') + formatNum(Math.abs(v), 2); };
    h += '<tr data-action="invStatsClientDrill" data-client-id="' + escHtml(x.id) + '"><td><div class="inv-row-title">' + escHtml(x.name) + '</div>' +
      (x.cn ? '<div class="inv-row-meta">net of ' + statsMoney(x.cn) + ' credit notes</div>' : '') +
      (money[String(x.id)] ? '<div class="inv-row-meta" data-client-owed>owes ' + statsMoney(Math.max(0, money[String(x.id)].owed)) + (money[String(x.id)].days != null ? ' · pays in ' + money[String(x.id)].days + ' d' : '') + '</div>' : '') + '</td>' +
      '<td class="inv-num">' + formatNum(x.net, 2) + '</td><td class="inv-num">' + formatNum(x.kg / 1000, 1) + '</td>' +
      statsSignedCell(x.vsVar, sign(x.vsVar)) + statsSignedCell(x.vsFull, sign(x.vsFull)) + statsSignedCell(x.money, statsSigned(x.money)) + '</tr>';
  });
  h += '</tbody></table></div>';
  var notes = '';
  if (m.apart.length) notes += statsNote('Listed apart, not ranked (under 90% of their revenue weighed): ' +
    m.apart.map(function(x) { return escHtml(x.name) + ' (' + Math.round(x.coverage * 100) + '%)'; }).join(', ') + '.');
  notes += statsNote('Cost is spread per kg: a thin clamp and a heavy bracket cost the same per kg here, which is the one assumption this table cannot check. ' +
    '&ldquo;vs var.&rdquo; is what a kilo leaves after its variable cost; &ldquo;vs full&rdquo; also carries the monthly crew.');
  h += statsBody(notes);

  // The worst-placed large account, settled both ways.
  var worst = m.ranked.filter(function(x) { return x.kg >= m.kg * 0.1; })[0];
  if (worst && worst.vsFull < 0) {
    var perKg = '<span class="inv-tile-of">/kg</span>';
    h += '<div id="statsWorst"><div class="inv-row-group"><span><strong>' + escHtml(worst.name) + '</strong>, settled on the live cost</span></div>' +
      statsTiles(
        statsTile('fixed', 'If labour is fixed', statsSigned(worst.vsVar) + perKg,
          statsTileSub(worst.vsVar >= 0 ? 'contributes ' + statsMoney(gstRound(worst.vsVar * worst.kg)) : 'below its variable cost'), worst.vsVar >= 0 ? 'ok' : 'danger') +
        statsTile('scales', 'If labour scales', statsSigned(worst.vsFull) + perKg, statsTileSub(statsSigned(worst.money) + ' on the period'), 'danger')) +
      statsRow('Price that breaks even', 'on variable · on full cost', statsNum(statsMoney(m.varKg) + ' · ' + statsMoney(m.fullKg))) +
      statsRow('Share of the plant', 'tonnage · revenue', statsNum(Math.round(worst.kg / m.kg * 100) + '% · ' + (m.rev > 0 ? Math.round(worst.total / m.rev * 100) : 0) + '%')) +
      statsCallout((worst.vsVar < 0 ? 'It does not cover its variable cost either way' : 'It contributes only if labour is fixed') +
        ', <strong>if</strong> its parts cost the same per kg as the rest of the book. That is the question to take to the floor before repricing.') + '</div>';
  }
  return h + '</div>';
}
