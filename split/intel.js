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
  if (range) return { from: isoOf(new Date(range.start)), to: isoOf(new Date(range.end)) };
  var first = (S.invoices || []).map(function(i) { return i.date; }).filter(Boolean).sort()[0];
  return { from: first || localDateStr(), to: localDateStr() };
}
/* The working days from one date to another, inclusive: every day but Sunday, the shop's calendar. */
function statsWorkingDayList(from, to) {
  var out = [], d = from;
  for (var g = 0; d <= to && g < 4000; g++) { if (new Date(d + 'T00:00:00').getDay() !== 0) out.push(d); d = isoAddDays(d, 1); }
  return out;
}
function statsWorkingDays(from, to) { return statsWorkingDayList(from, to).length; }
/* Fixed and variable, from the live cost: fixed is the monthly crew's days and
   rest days; everything else moves with the work. The labour row says what
   share of it is fixed (cost.js), from the attendance record or, where the row
   is what the bank paid, from the salaries to named hands against the cash for
   the weekly pool, and the share holds over the whole row: reading the fixed
   part off the attendance tiers alone called a bank-paid month all variable,
   and the stretch filled at the model too. Where nothing says, the split is
   not known, and is returned as such rather than as all variable. */
function statsCostSplit(c) {
  var lab = c.rows.find(function(r) { return r.key === 'labour'; });
  if (lab && lab.amount > 0 && lab.fixedShare == null) return { fixed: null, variable: null, known: false, from: null };
  var fixed = lab ? lab.amount * (lab.fixedShare || 0) : 0;
  return { fixed: gstRound(fixed), variable: gstRound(c.total - fixed), known: true, from: lab ? lab.fixedFrom : null };
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
  var measured = statsPctOf(c.measuredShare);
  var perKg = '<span class="inv-tile-of">/kg</span>';
  var h = statsPanel('overview', escHtml(PERIOD_LABELS[period] || '') + ' in one line', 'against the live cost, ' + measured + '% of it measured',
    { wide: true, id: 'statsOverview' });
  if (!(kg > 0)) return h + statsCallout('No weighed tonnage in this period, so no ₹/kg to compare.') + '</div>';
  h += statsTiles(
    statsTile('realisation', 'Realisation', statsMoney(real) + perKg, statsTileSub(statsMoney(tonnage.revKnown) + ' on ' + formatNum(kg / 1000, 1) + ' t'),
      c.perKg != null ? figToneAgainst(real, c.perKg, 5) : '') +
    statsTile('cost', 'Live cost', statsMoney(c.perKg) + perKg, statsTileSub('typed ' + statsMoney(S.defaultCostPerKg || 0))) +
    statsTile('contrib', 'Contribution', statsSigned(contrib) + perKg, statsTileSub(statsSigned(gstRound(contrib * kg)) + ' on the period'),
      contrib >= 0 ? 'ok' : 'danger', 'statsContrib') +
    // The plant's cost is mostly fixed, so an idle shift is the problem: under 80% used is room to fill, under 60% a hole.
    statsTile('capacity', 'Capacity', capPct != null ? Math.round(capPct * 100) + '%' : '&mdash;',
      statsTileSub(formatNum(kg / 1000, 1) + ' t of ~' + formatNum(cap / 1000, 0) + ' t (2 shifts)' +
        (capPct != null && capPct < 0.8 ? ' · ' + formatNum((cap - kg) / 1000, 1) + ' t spare' : '')),
      capPct != null ? figToneCapacity(capPct * 100) : ''), true);
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
  var weighed = statsCostWeighedNote(tonnage);
  if (weighed) h += statsCallout(weighed + ' The contribution beside it reads low for the same reason.', '', 'weighed');
  return h + '</div>';
}

/* A signed figure in a table: the sign carries the tone (§5.4, DR-1). */
function statsSignedCell(v, text) {
  return '<td class="inv-num' + (v == null ? '' : v >= 0 ? ' inv-num-pos' : ' inv-num-neg') + '">' + text + '</td>';
}

/* ---------- Overview: six months side by side ---------- */
function statsMonthsHtml() {
  var today = localDateStr(), rows = [];
  var active = statsInvoices().filter(function(i) { return i.date; });
  for (var k = 5; k >= 0; k--) {
    var d = new Date(today + 'T00:00:00'); d.setDate(1); d.setMonth(d.getMonth() - k);
    var from = isoOf(d), to = payMonthEnd(from);
    if (to > today) to = today;
    var inv = active.filter(function(i) { return i.date >= from && i.date <= to; });
    var w = weighLines(inv), c = liveCost(from, to, w.kg);
    var real = w.kg > 0 ? w.revKnown / w.kg : null;
    var lab = c.rows.find(function(x) { return x.key === 'labour'; });
    // The app's short month names (insMonthLabel): the browser's en-IN writes "Sept".
    rows.push({ label: insMonthLabel(from) + (to === today ? ' to date' : ''), real: real, cost: c.perKg, kg: w.kg,
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
      '<td class="inv-num">' + (r.labour != null && r.labCov >= 0.9 ? formatNum(r.labour, 2) : '&mdash;') + '</td><td class="inv-num">' + statsPctOf(r.measured) + '%</td></tr>';
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
  var varKg = split.known ? split.variable / tonnage.kg : null, fullKg = c.perKg;
  // The invoices arrive net of their credit notes (statsInvoices); what was taken off is said per client.
  var cns = {};
  filtered.forEach(function(i) { if (i._credit) cns[i.clientId] = (cns[i.clientId] || 0) + i._credit; });
  var rows = buildClientRollup(filtered).map(function(x) {
    var cn = gstRound(cns[x.clientId] || 0);
    var net = x.comparable && x.kg > 0 ? x.revKnown / x.kg : null;
    return { id: x.clientId, name: x.name, kg: x.kg, total: x.total, real: x.realisation, comparable: x.comparable, coverage: x.coverage,
      cn: cn, net: net, vsVar: net != null && varKg != null ? net - varKg : null, vsFull: net != null ? net - fullKg : null,
      money: net != null ? gstRound((net - fullKg) * x.kg) : null };
  });
  return { c: c, split: split, varKg: varKg, fullKg: fullKg, fixedKg: split.known ? split.fixed / tonnage.kg : null, kg: tonnage.kg, rev: filtered.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0),
    ranked: rows.filter(function(x) { return x.comparable; }).sort(function(a, b) { return a.vsFull - b.vsFull; }),
    apart: rows.filter(function(x) { return !x.comparable; }) };
}

function statsMarginHtml(period, filtered, tonnage) {
  var m = statsClientMargins(period, filtered, tonnage);
  var h = statsPanel('margin', escHtml(PERIOD_LABELS[period] || '') + ' contribution by client', 'worst first, at the live cost', { wide: true, id: 'statsMargin' });
  if (!m) return h + statsCallout('No weighed tonnage in this period, so no margin to work out.') + '</div>';
  var weighed = statsCostWeighedNote(tonnage);
  h += statsBody(statsNote((m.varKg != null
    ? 'Variable cost ' + statsMoney(m.varKg) + '/kg · fixed (monthly crew' + (m.split.from === 'bank' ? ', read off the salaries the bank paid' : '') + ') ' + statsMoney(m.fixedKg) + '/kg · full ' + statsMoney(m.fullKg) + '/kg, ' +
      statsPctOf(m.c.measuredShare) + '% measured.'
    : 'Full cost ' + statsMoney(m.fullKg) + '/kg, ' + statsPctOf(m.c.measuredShare) + '% measured. <strong>Fixed and variable are not known:</strong> no attendance is recorded in this period and ' +
      'no bank statement covers its wages, so labour cannot be split, and what a kilo leaves after its variable cost is not worked out.') +
    (weighed ? ' ' + weighed : '')));
  // Owed and days to pay beside the margin: a client below cost that also pays in 120 days is two problems.
  var money = {};
  if (finHasBank()) {
    var mh = bankPayHistory(finCtx().recv());
    finCtx().recv().forEach(function(r) { var d = bankDaysToPay(r.client.id, mh); money[String(r.client.id)] = { owed: r.owed, days: d && d.median != null ? Math.round(d.median) : null }; });
  }
  h += '<div class="inv-scroll-x"><table class="inv-table"><thead><tr><th>Client</th><th class="inv-num">₹/kg</th><th class="inv-num">t</th><th class="inv-num">vs var.</th>' +
    '<th class="inv-num">vs full</th><th class="inv-num">₹ on period</th></tr></thead><tbody>';
  // The worst ten; the rest one tap away (UX overhaul 2, step 6).
  h += uiMoreHtml('stats-margin', m.ranked.map(function(x) {
    var sign = function(v) { return (v >= 0 ? '+' : '&minus;') + formatNum(Math.abs(v), 2); };
    return '<tr data-action="invStatsClientDrill" data-client-id="' + escHtml(x.id) + '"><td><div class="inv-row-title">' + escHtml(x.name) + '</div>' +
      (x.cn ? '<div class="inv-row-meta">net of ' + statsMoney(x.cn) + ' credit notes</div>' : '') +
      (money[String(x.id)] ? '<div class="inv-row-meta" data-client-owed>owes ' + statsMoney(Math.max(0, money[String(x.id)].owed)) + (money[String(x.id)].days != null ? ' · pays in ' + figHtml(money[String(x.id)].days + ' d', figTonePaysIn(money[String(x.id)].days)) : '') + '</div>' : '') + '</td>' +
      '<td class="inv-num">' + formatNum(x.net, 2) + '</td><td class="inv-num">' + formatNum(x.kg / 1000, 1) + '</td>' +
      statsSignedCell(x.vsVar, x.vsVar != null ? sign(x.vsVar) : '&mdash;') + statsSignedCell(x.vsFull, sign(x.vsFull)) + statsSignedCell(x.money, statsSigned(x.money)) + '</tr>';
  }), { n: 10, noun: 'clients', tr: 6 });
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
    var perKg = '<span class="inv-tile-of">/kg</span>', split = worst.vsVar != null;
    h += '<div id="statsWorst"><div class="inv-row-group"><span><strong>' + escHtml(worst.name) + '</strong>, settled on the live cost</span></div>' +
      statsTiles(
        statsTile('fixed', 'If labour is fixed', split ? statsSigned(worst.vsVar) + perKg : '&mdash;',
          statsTileSub(!split ? 'labour&rsquo;s split not known' : worst.vsVar >= 0 ? 'contributes ' + statsMoney(gstRound(worst.vsVar * worst.kg)) : 'below its variable cost'),
          !split ? '' : worst.vsVar >= 0 ? 'ok' : 'danger') +
        statsTile('scales', 'If labour scales', statsSigned(worst.vsFull) + perKg, statsTileSub(statsSigned(worst.money) + ' on the period'), 'danger')) +
      statsRow('Price that breaks even', 'on variable · on full cost', statsNum((split ? statsMoney(m.varKg) : '&mdash;') + ' · ' + statsMoney(m.fullKg))) +
      statsRow('Share of the plant', 'tonnage · revenue', statsNum(Math.round(worst.kg / m.kg * 100) + '% · ' + (m.rev > 0 ? Math.round(worst.total / m.rev * 100) : 0) + '%')) +
      statsCallout(!split
        ? 'Whether it covers its variable cost cannot be told until labour is split into fixed and variable: record the attendance, or import the bank statement.'
        : (worst.vsVar < 0 ? 'It does not cover its variable cost either way' : 'It contributes only if labour is fixed') +
          ', <strong>if</strong> its parts cost the same per kg as the rest of the book. That is the question to take to the floor before repricing.') + '</div>';
  }
  return h + '</div>';
}

/* ---------- Overview: the questions, each answered as a story ----------
   Owner, 30 Sep 2026: "Stats view needs an overhaul, it puts insights front and center and doesn't present itself in a
   really engaging way"; they chose the Overview to be led by the questions the owner asks, each answered as a story card:
   the figure, one sentence that says what it means and why, a small chart, and the way to the tab with the detail. The
   cards read the same figures as the panels under them (statsOverviewHtml, statsMonthsHtml, the insights), never a second
   arithmetic. */
function statsMonthRows(n) {
  var today = localDateStr(), rows = [], active = statsInvoices().filter(function(i) { return i.date; });
  for (var k = (n || 6) - 1; k >= 0; k--) {
    var d = new Date(today + 'T00:00:00'); d.setDate(1); d.setMonth(d.getMonth() - k);
    var from = isoOf(d), to = payMonthEnd(from);
    if (to > today) to = today;
    var inv = active.filter(function(i) { return i.date >= from && i.date <= to; });
    var w = weighLines(inv), c = w.kg > 0 ? liveCost(from, to, w.kg) : null;
    rows.push({ month: from.slice(0, 7), label: insMonthLabel(from), kg: w.kg, real: w.kg > 0 ? w.revKnown / w.kg : null, cost: c ? c.perKg : null,
      cap: STATS_CAPACITY_KG_DAY * statsWorkingDays(from, to), rev: inv.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0) });
  }
  return rows;
}
function statsStory(key, question, body, go, goLabel) {
  return '<div class="inv-panel inv-panel-flush" data-card="story" data-story="' + key + '"><div class="inv-panel-head"><span class="inv-panel-title">' + question + '</span>' +
    (go ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="' + go.action + '"' + (go.attrs || '') + '>' + goLabel + '</button>' : '') + '</div>' + body + '</div>';
}
function statsStorySay(tone, text) { return statsBody('<div class="inv-row-wrap" data-story-say>' + uiDot(tone, text) + '</div>'); }

function statsStoriesHtml(period, filtered, prior, tonnage, periodCost) {
  var out = '', r = statsRangeIso(period), plabel = PERIOD_LABELS[period] || '';
  var months = statsMonthRows(6);
  var perKg = '<span class="inv-tile-of">/kg</span>';
  var tab = function(t) { return { action: 'invStatsGo', attrs: ' data-tab="' + t + '"' }; };

  // 1. Are we making money?
  var kg = tonnage.kg, real = kg > 0 ? tonnage.revKnown / kg : null, cost = periodCost.perKg > 0 ? periodCost.perKg : null;
  var contrib = real != null && cost != null ? real - cost : null;
  var body = statsTiles(statsTile('real', 'Realisation', real != null ? formatCurrency(real) + perKg : '&mdash;', statsTileSub(cost != null ? periodCost.label + formatCurrency(cost) + '/kg' : 'no cost to set it against'),
      real != null && cost != null ? figToneAgainst(real, cost, 5) : '') +
    statsTile('contrib', 'Left per kilo', contrib != null ? statsSigned(contrib) + perKg : '&mdash;', statsTileSub(contrib != null ? statsSigned(gstRound(contrib * kg)) + ' on ' + escHtml(plabel.toLowerCase() || 'the period') : ''),
      contrib == null ? '' : contrib >= 0 ? 'ok' : 'danger'));
  var mm = months.filter(function(x) { return x.real != null; });
  if (mm.length >= 2) body += statsBody(chartLines(mm.map(function(x) { return x.label; }), [
    { label: 'Realisation', values: mm.map(function(x) { return gstRound(x.real); }) },
    { label: 'Cost', values: mm.map(function(x) { return x.cost != null ? gstRound(x.cost) : null; }), tone: 3 }], { unit: 'rate', ariaLabel: 'Realisation against cost by month' }));
  body += contrib == null ? statsStorySay('neutral', kg > 0 ? 'No cost to judge the price against yet.' : 'No weighed tonnage in the period.')
    : contrib >= 0 ? statsStorySay('ok', 'Yes: every kilo left ' + formatCurrency(contrib) + ' after the full cost, ' + formatCurrency(gstRound(contrib * kg)) + ' on the period.')
    : statsStorySay('danger', 'Not yet: every kilo cost ' + formatCurrency(-contrib) + ' more than it was billed at, ' + formatCurrency(gstRound(-contrib * kg)) + ' on the period.');
  out += statsStory('money', 'Are we making money?', body, tab('cost'), 'The cost');

  // 2. Who is driving it? The worst-priced large account, and the biggest mover against the period before.
  var m = null;
  try { m = statsClientMargins(period, filtered, tonnage); } catch (e) { m = null; }
  body = '';
  var worst = m ? m.ranked.filter(function(x) { return x.kg >= m.kg * 0.1; })[0] : null;
  var byC = {}, pc = {};
  filtered.forEach(function(i) { byC[i.clientId] = (byC[i.clientId] || 0) + (i.taxableValue || 0); });
  prior.forEach(function(i) { pc[i.clientId] = (pc[i.clientId] || 0) + (i.taxableValue || 0); });
  var moves = Object.keys(Object.assign({}, byC, pc)).map(function(id) { return { id: id, d: (byC[id] || 0) - (pc[id] || 0) }; }).sort(function(a, b) { return Math.abs(b.d) - Math.abs(a.d); });
  var nameOf = function(id) { var c = (S.clients || []).find(function(x) { return String(x.id) === String(id); }); return c ? c.name : 'A client'; };
  if (m && m.ranked.length) {
    var top = m.ranked.slice().sort(function(a, b) { return b.kg - a.kg; }).slice(0, 4);
    body += statsBody(chartRankedBars(top.map(function(x) {
      return { label: x.name, value: x.kg, display: formatNum(x.kg / 1000, 1) + ' t', sub: formatCurrency(x.net) + '/kg · ' + Math.round(x.kg / m.kg * 100) + '% of the plant',
        tone: x.vsFull < 0 ? 'danger' : 'good', action: 'invStatsClientDrill', clientId: x.id };
    }), { unit: 'kg' }));
  }
  if (worst && worst.vsFull < 0) body += statsStorySay('danger', worst.name + ' fills ' + Math.round(worst.kg / m.kg * 100) + '% of the plant at ' + formatCurrency(worst.net) + '/kg, ' + formatCurrency(-worst.vsFull) + ' under the full cost: ' + formatCurrency(-worst.money) + ' on the period.');
  if (moves.length && prior.length && Math.abs(moves[0].d) > 0) body += statsStorySay(moves[0].d >= 0 ? 'ok' : 'warning', nameOf(moves[0].id) + ' billed ' + formatCurrency(Math.abs(moves[0].d)) + (moves[0].d >= 0 ? ' more' : ' less') + ' than in ' + (PERIOD_PRIOR_LABELS[period] || 'the period before') + ', the biggest change of any client.');
  if (!body) body = statsStorySay('neutral', 'No weighed billing in the period to rank the clients by.');
  out += statsStory('clients', 'Who is driving it?', body, tab('clients'), 'The clients');

  // 3. Is the plant full?
  var cap = STATS_CAPACITY_KG_DAY * statsWorkingDays(r.from, r.to), capPct = cap > 0 && kg > 0 ? kg / cap : null;
  body = statsTiles(statsTile('cap', 'Used', capPct != null ? Math.round(capPct * 100) + '%' : '&mdash;', statsTileSub(formatNum(kg / 1000, 1) + ' t of ~' + formatNum(cap / 1000, 0) + ' t (2 shifts)'),
    capPct != null ? figToneCapacity(capPct * 100) : ''));
  var mk = months.filter(function(x) { return x.kg > 0; });
  if (mk.length >= 2) body += statsBody(chartBars(mk.map(function(x) { return { label: x.label, value: gstRound(x.kg / 1000) }; }), { unit: 'count', ariaLabel: 'Tonnes plated by month' }));
  var avg = real != null ? real : null;
  body += capPct == null ? statsStorySay('neutral', 'No weighed tonnage in the period.')
    : capPct >= 0.8 ? statsStorySay('ok', 'Busy: ' + Math.round(capPct * 100) + '% of two shifts. Growth now needs more hours or better-paying work, not more of the same.')
    : statsStorySay(capPct >= 0.6 ? 'warning' : 'danger', formatNum((cap - kg) / 1000, 1) + ' t of the two shifts went unused' + (avg ? ': at ₹13/kg that is ' + formatCurrency(gstRound((cap - kg) * 13)) + ' of work the plant could have taken on its fixed cost' : '') + '.');
  out += statsStory('plant', 'Is the plant full?', body, tab('trends'), 'The trend');

  // 4. What changed? The most urgent insights, as sentences, and the month's pace.
  var ins = [];
  try { ins = todoAppAll().filter(function(t) { return t.rule.indexOf('ins') === 0; }); } catch (e) { ins = []; }
  var rank = { red: 0, amber: 1, info: 2 };
  ins.sort(function(a, b) { return (rank[a.tone] != null ? rank[a.tone] : 3) - (rank[b.tone] != null ? rank[b.tone] : 3); });
  body = '';
  var p = null;
  try { p = predMonthPace(); } catch (e) { p = null; }
  if (p) body += statsStorySay(p.prevRev > 0 && p.projRev < p.prevRev ? 'warning' : 'ok', 'This month is heading for ' + formatCurrency(p.projRev) + ' at its pace (' + p.done + ' of ' + p.total + ' working days in), against ' + formatCurrency(p.prevRev) + ' in ' + p.prevLabel + '.');
  ins.slice(0, 3).forEach(function(t) { body += todoAppRowHtml(t); });
  if (!body) body = statsStorySay('ok', 'Nothing stands out: no insight is raised on the book right now.');
  out += statsStory('changed', 'What changed?', body, ins.length > 3 ? { action: 'invStatsInsightsAll' } : null, 'All ' + ins.length + ' insights');

  // 5. Is cash coming in? Only with a statement.
  if (finHasBank()) {
    try {
      var bRows = bankRows(), bLast = bRows[bRows.length - 1], recv = finCtx().recv(), owed = gstRound(recv.reduce(function(s, x) { return s + Math.max(0, x.owed); }, 0));
      var bBook = bankBookDaysToPay(bankPayHistory(recv));
      body = statsTiles(statsTile('bal', 'In the bank', statsMoney(bLast.balance), statsTileSub('on ' + escHtml(formatDate(bLast.date))), bLast.balance < 0 ? 'danger' : '') +
        statsTile('owed', 'Owed to us', statsMoney(owed), statsTileSub(bBook ? 'clients pay in ' + Math.round(bBook.median) + ' days' : ''), bBook ? figTonePaysIn(Math.round(bBook.median)) : ''));
      body += statsStorySay(bBook && bBook.median > 60 ? 'warning' : 'ok', 'Owed ' + formatCurrency(owed) + (bBook ? ', arriving in about ' + Math.round(bBook.median) + ' days at the usual pace' : '') + '.');
      out += statsStory('cash', 'Is cash coming in?', body, { action: 'invFinGo', attrs: ' data-tab="overview"' }, 'Finance');
    } catch (e) { /* no cash story without a readable statement */ }
  }
  return out;
}
