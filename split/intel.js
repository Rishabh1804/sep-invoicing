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

/* Three tabs since the tab map (TM2b, 9 Oct 2026): Overview's questions, why it moved, the period in one line and the month's
   pace are Today → Pulse's; Billing's cards are Money → GST's and Pipeline's (its dispatch cycle). A tab remembered from before
   (overview, billing) opens By client (docs/TAB_MAP.md §5). */
var STATS_TABS = [['clients', 'By client'], ['cost', 'Cost'], ['trends', 'Trends']];
var STATS_TAB_KEY = 'sep_inv_stats_tab';
var STATS_CAPACITY_KG_DAY = 4000; // ~2 t per 8-hour shift, two shifts (CLAUDE.md § Key Business Data)

function statsTab() {
  var t = null;
  try { t = localStorage.getItem(STATS_TAB_KEY); } catch (e) { /* per-device convenience only */ }
  return STATS_TABS.some(function(x) { return x[0] === t; }) ? t : 'clients';
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

/* ---------- Today → Pulse: the period in one line (the tab map, TM2b; it was Stats → Overview's card) ----------
   A hero (§3c): the verdict is what a kilo left after the live cost, toned as Stats judges realisation against it; the factors
   are tiles (realisation, live cost, capacity and, with a statement, cash), and what is not measured is a badge on its tile;
   the floor's plated row under them. Shut on the phone, open on the desktop (§1a-3). */
function statsOverviewHtml(period, filtered, tonnage) {
  var r = statsRangeIso(period), kg = tonnage.kg;
  var c = liveCost(r.from, r.to, kg);
  var real = kg > 0 ? tonnage.revKnown / kg : null;
  var contrib = real != null && c.perKg != null ? real - c.perKg : null;
  var cap = STATS_CAPACITY_KG_DAY * statsWorkingDays(r.from, r.to);
  var capPct = cap > 0 ? kg / cap : null;
  var perKg = '<span class="inv-tile-of">/kg</span>';
  var tone = contrib == null ? 'neutral' : figToneAgainst(real, c.perKg, 5) || 'neutral';
  var title = !(kg > 0) ? 'Nothing weighed in the period' : contrib == null ? 'No cost to judge the price by'
    : contrib >= 0 ? 'Every kilo left ' + formatCurrency(contrib) + ' after the live cost' : 'Every kilo lost ' + formatCurrency(-contrib) + ' against the live cost';
  var model = c.rows.filter(function(x) { return x.source !== 'measured' && x.source !== 'bank'; }).length;
  var factors = [
    { label: 'Realisation', fig: real != null ? statsMoney(real) + perKg : '', tone: c.perKg != null ? figToneAgainst(real, c.perKg, 5) : null,
      sub: kg > 0 ? formatCurrency(tonnage.revKnown) + ' on ' + formatNum(kg / 1000, 1) + ' t' : '',
      badge: tonnage.lines > 0 && tonnage.coverage < 0.999 ? ['warning', statsPctOf(tonnage.coverage) + '% weighed'] : null, attrs: ' data-tile="realisation"' },
    { label: 'Live cost', fig: c.perKg != null ? statsMoney(c.perKg) + perKg : '', sub: 'typed ' + formatCurrency(S.defaultCostPerKg || 0) + '/kg',
      badge: model ? [c.measuredShare >= 0.9 ? 'info' : 'warning', statsPctOf(c.measuredShare) + '% measured'] : null, attrs: ' data-tile="cost"' },
    // The plant's cost is mostly fixed, so an idle shift is the problem: under 80% used is room to fill, under 60% a hole.
    { label: 'Capacity', fig: capPct != null ? Math.round(capPct * 100) + '%' : '', tone: capPct != null ? figToneCapacity(capPct * 100) : null,
      sub: formatNum(kg / 1000, 1) + ' t of ~' + formatNum(cap / 1000, 0) + ' t' + (capPct != null && capPct < 0.8 ? ', ' + formatNum((cap - kg) / 1000, 1) + ' t spare' : ''), attrs: ' data-tile="capacity"' }];
  if (finHasBank()) {
    var bRows = bankRows(), bLast = bRows[bRows.length - 1], bRecv = finCtx().recv(), bBook = bankBookDaysToPay(bankPayHistory(bRecv));
    var owed = gstRound(bRecv.reduce(function(s, x) { return s + Math.max(0, x.owed); }, 0));
    factors.push({ label: 'Cash', fig: figWrapHtml(statsMoney(bLast.balance)), tone: bLast.balance < 0 ? 'danger' : null,
      sub: 'owed ' + formatCurrency(owed) + (bBook ? ', clients pay in ' + Math.round(bBook.median) + ' days' : ''), attrs: ' id="statsCash" data-tile="cash"' });
  }
  var body = '<div class="inv-hero-sheet"><div class="inv-tiles' + (factors.length === 4 ? ' inv-tiles-4' : ' inv-tiles-3') + '">' + factors.map(uiFactorTileHtml).join('') + '</div></div>';
  var plated = prodStatsRowHtml(r.from, r.to);
  if (plated) body += '<div class="inv-hero-sheet">' + plated + '</div>';
  return uiHeroHtml({ tone: tone, eyebrow: '<span>In one line</span>', title: escHtml(title),
    fig: contrib != null ? figHtml(statsSigned(contrib) + perKg, tone === 'neutral' ? null : tone) : '',
    sub: contrib != null ? escHtml((contrib >= 0 ? '+' : '−') + formatCurrency(gstRound(Math.abs(contrib * kg))) + ' on the period') : '',
    body: body, fold: 'pulse-overview', open: !!_isDesktop, attrs: ' id="statsOverview" data-card="overview" data-verdict' });
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
  // One line (the tab map, TM2b); why a month's labour is withheld is the guide's (kbguides.js, Reading Stats).
  h += '</tbody></table></div>' + statsBody(statsNote('₹ per kg. Labour only where 90% of the month is recorded; measured is the cost from records.')) + '</div>';
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
  // The two costs the columns are read against, in a line (§3c); how they are split, and that cost is spread per kilo, is the
  // guide's (kbguides.js, Reading Stats).
  var weighed = statsCostWeighedShort(tonnage);
  // Where the fixed part was read from is a badge (§3b-11: a third fact is a badge, never a clause).
  var splitFrom = m.varKg == null ? '' : m.split.from === 'bank' ? 'fixed part read off the salaries the bank paid' : m.split.from === 'attendance' ? 'fixed part from the attendance' : '';
  h += statsBody(statsNote(m.varKg != null ? 'Variable cost ' + statsMoney(m.varKg) + '/kg · full ' + statsMoney(m.fullKg) + '/kg' +
      (splitFrom ? ' <span class="inv-badge inv-badge-info" data-margin-split>' + splitFrom + '</span>' : '')
    : 'Full cost ' + statsMoney(m.fullKg) + '/kg: labour is not split, so no variable cost (no attendance or bank wages in the period)') +
    (weighed ? statsNote(weighed) : ''));
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
  // A client under 90% weighed is not ranked: counted here, listed by name under Realisation by client.
  if (m.apart.length) h += uiFactRowHtml({ label: 'Listed apart, not ranked', sub: 'under 90% of revenue weighed: ' + m.apart.slice(0, 2).map(function(x) { return x.name; }).join(', ') +
    (m.apart.length > 2 ? ' and ' + (m.apart.length - 2) + ' more' : ''), value: m.apart.length, attrs: ' data-margin-apart' });

  // The worst-placed large account, settled both ways (§3c): the two answers and the break-even as tiles, the working folded.
  var worst = m.ranked.filter(function(x) { return x.kg >= m.kg * 0.1; })[0];
  if (worst && worst.vsFull < 0) {
    var perKg = '<span class="inv-tile-of">/kg</span>', split = worst.vsVar != null;
    h += '<div id="statsWorst"><div class="inv-row-group"><span><strong>' + escHtml(worst.name) + '</strong>, settled on the live cost</span></div>' +
      statsTiles(
        statsTile('fixed', 'If labour is fixed', split ? statsSigned(worst.vsVar) + perKg : '&mdash;',
          statsTileSub(!split ? 'labour&rsquo;s split not known' : worst.vsVar >= 0 ? 'contributes ' + statsMoney(gstRound(worst.vsVar * worst.kg)) : 'below its variable cost'),
          !split ? '' : worst.vsVar >= 0 ? 'ok' : 'danger') +
        statsTile('scales', 'If labour scales', statsSigned(worst.vsFull) + perKg, statsTileSub(statsSigned(worst.money) + ' on the period'), 'danger') +
        statsTile('even', 'Breaks even at', statsMoney(m.fullKg) + perKg, statsTileSub(split ? 'full cost; ' + escHtml(formatCurrency(m.varKg)) + ' variable' : 'the full cost'))) +
      uiWorkingHtml('stats-worst', [
        { label: 'Its price', sub: 'realised on the period', value: formatCurrency(worst.net) + '/kg' },
        { label: 'Break-even on variable cost', value: split ? formatCurrency(m.varKg) + '/kg' : '' },
        { label: 'Break-even on full cost', value: formatCurrency(m.fullKg) + '/kg' },
        { label: 'Share of the plant’s tonnage', value: Math.round(worst.kg / m.kg * 100) + '%' },
        { label: 'Share of the revenue', value: (m.rev > 0 ? Math.round(worst.total / m.rev * 100) : 0) + '%' }]) +
      statsBody(statsNote(!split ? 'Record the attendance or import the bank statement to split labour.'
        : (worst.vsVar < 0 ? 'Below its variable cost either way' : 'It contributes only if labour is fixed') + ', if its parts cost the same per kg as the rest.')) + '</div>';
  }
  return h + '</div>';
}

/* ---------- The questions, each answered as a story ----------
   Owner, 30 Sep 2026: "Stats view needs an overhaul, it puts insights front and center and doesn't present itself in a
   really engaging way"; they chose the questions the owner asks, each answered as a story card: the figure, one sentence
   that says what it means and why, a small chart, and the way to the tab with the detail. Stats → Overview's until the tab
   map (TM2b), Today → Pulse's since. The cards read the same figures as the panels beside them (statsOverviewHtml, the
   six months, the insights), never a second arithmetic. */
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
/* `text` is HTML (uiDot): the caller escapes a client's name. */
function statsStorySay(tone, text) { return statsBody('<div class="inv-row-wrap" data-story-say>' + uiDot(tone, text) + '</div>'); }

/* The five cards Stats → Overview had (owner, 30 Sep 2026), each as {key, q, html, answer, vital}: the html is the card's
   body (the figure, the sentence, the small chart), `answer` the sentence that answers it ({tone, say}, `say` html with every
   name escaped), `vital` its face as a hero. advQuestions (advice.js) puts the new first question before them and the moves
   under each; Today → Pulse draws them (today.js; since the tab map, TM2b, Stats has no Overview). `a` is statsPulseArgs' shape; `ctx` advice.js's per-render reading, so the
   margins and the To-do's tasks are worked out once. The clients card also hands on what it found (`worst`, `mover`) for
   the moves, and the plant card its capacity. */
function statsStoryCards(a, ctx) {
  var period = a.period, filtered = a.filtered, prior = a.prior, tonnage = a.tonnage, periodCost = a.periodCost;
  var r = statsRangeIso(period), plabel = PERIOD_LABELS[period] || '';
  var months = statsMonthRows(6);
  var perKg = '<span class="inv-tile-of">/kg</span>';
  var cards = {};
  // The card's sentence; the first one said is its answer.
  var say = function(card, tone, text) { if (!card.answer) card.answer = { tone: tone, say: text }; return statsStorySay(tone, text); };

  // 1. Are we making money?
  var c1 = { key: 'money', q: 'Are we making money?' };
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
  body += contrib == null ? say(c1, 'neutral', kg > 0 ? 'No cost to judge the price against yet.' : 'No weighed tonnage in the period.')
    : contrib >= 0 ? say(c1, 'ok', 'Yes: every kilo left ' + formatCurrency(contrib) + ' after the full cost, ' + formatCurrency(gstRound(contrib * kg)) + ' on the period.')
    : say(c1, 'danger', 'Not yet: every kilo cost ' + formatCurrency(-contrib) + ' more than it was billed at, ' + formatCurrency(gstRound(-contrib * kg)) + ' on the period.');
  c1.html = body;
  // The card as a tile on Today → Pulse (§6.21): the figure that answers it, its words, the six months as a line.
  c1.vital = { fig: contrib != null ? statsSigned(contrib) + perKg : real != null ? formatCurrency(real) + perKg : '&mdash;',
    title: contrib == null ? (kg > 0 ? 'No cost to judge it by' : 'Nothing weighed yet') : contrib >= 0 ? 'Left on every kilo' : 'Lost on every kilo',
    sub: real != null ? escHtml('realised ' + formatCurrency(real) + '/kg' + (cost != null ? ' against ' + formatCurrency(cost) + '/kg' : '')) : '',
    viz: mm.length >= 2 ? chartSpark(mm.map(function(x) { return gstRound(x.real); }), { ref: mm.map(function(x) { return x.cost != null ? gstRound(x.cost) : null; }),
      labels: mm.map(function(x) { return x.label; }), unit: 'rate', tone: contrib != null && contrib < 0 ? 'danger' : contrib != null ? 'ok' : '' }) : '',
    tone: contrib == null ? 'neutral' : contrib >= 0 ? 'ok' : 'danger' };
  cards.money = c1;

  // 2. Who is driving it? The worst-priced large account, and the biggest mover against the period before.
  var c2 = { key: 'clients', q: 'Who is driving it?' };
  var m = null;
  if (ctx) m = ctx.margins();
  else { try { m = statsClientMargins(period, filtered, tonnage); } catch (e) { m = null; } }
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
  if (worst && worst.vsFull < 0) body += say(c2, 'danger', escHtml(worst.name) + ' fills ' + Math.round(worst.kg / m.kg * 100) + '% of the plant at ' + formatCurrency(worst.net) + '/kg, ' + formatCurrency(-worst.vsFull) + ' under the full cost: ' + formatCurrency(-worst.money) + ' on the period.');
  var mover = moves.length && prior.length && Math.abs(moves[0].d) > 0 ? moves[0] : null;
  if (mover) body += say(c2, mover.d >= 0 ? 'ok' : 'warning', escHtml(nameOf(mover.id)) + ' billed ' + formatCurrency(Math.abs(mover.d)) + (mover.d >= 0 ? ' more' : ' less') + ' than in ' + (PERIOD_PRIOR_LABELS[period] || 'the period before') + ', the biggest change of any client.');
  if (!body) body = say(c2, 'neutral', 'No weighed billing in the period to rank the clients by.');
  if (!c2.answer) c2.answer = { tone: 'neutral', say: 'No large account is below the full cost, and no client moved against the period before.' };
  c2.html = body;
  var big = m && m.ranked.length ? m.ranked.slice().sort(function(a, b) { return b.kg - a.kg; }) : [];
  var lead = c2.worst = worst && worst.vsFull < 0 ? worst : null;
  var vc = lead || big[0];
  c2.vital = vc ? { fig: Math.round(vc.kg / m.kg * 100) + '%', title: escHtml(vc.name),
      sub: escHtml(lead ? 'of the plant at ' + formatCurrency(lead.net) + '/kg, ' + formatCurrency(-lead.vsFull) + ' under the full cost' : 'of the plant, the largest by tonnage'),
      viz: chartMeter(big.slice(0, 4).map(function(x, i) { return { v: x.kg, tone: x.vsFull < 0 ? 'danger' : i % 2 ? 'neutral-2' : 'neutral' }; }),
        { max: m.kg, title: big.slice(0, 4).map(function(x) { return x.name + ' ' + Math.round(x.kg / m.kg * 100) + '%'; }).join(' · ') }),
      tone: lead ? 'danger' : 'ok' }
    : { fig: '&mdash;', title: 'No weighed billing', sub: '', viz: '', tone: 'neutral' };
  c2.mover = mover;
  cards.clients = c2;

  // 3. Is the plant full?
  var c3 = { key: 'plant', q: 'Is the plant full?' };
  var cap = STATS_CAPACITY_KG_DAY * statsWorkingDays(r.from, r.to), capPct = cap > 0 && kg > 0 ? kg / cap : null;
  body = statsTiles(statsTile('cap', 'Used', capPct != null ? Math.round(capPct * 100) + '%' : '&mdash;', statsTileSub(formatNum(kg / 1000, 1) + ' t of ~' + formatNum(cap / 1000, 0) + ' t (2 shifts)'),
    capPct != null ? figToneCapacity(capPct * 100) : ''));
  var mk = months.filter(function(x) { return x.kg > 0; });
  if (mk.length >= 2) body += statsBody(chartBars(mk.map(function(x) { return { label: x.label, value: gstRound(x.kg / 1000) }; }), { unit: 'count', ariaLabel: 'Tonnes plated by month' }));
  var avg = real != null ? real : null;
  body += capPct == null ? say(c3, 'neutral', 'No weighed tonnage in the period.')
    : capPct >= 0.8 ? say(c3, 'ok', 'Busy: ' + Math.round(capPct * 100) + '% of two shifts. Growth now needs more hours or better-paying work, not more of the same.')
    : say(c3, capPct >= 0.6 ? 'warning' : 'danger', formatNum((cap - kg) / 1000, 1) + ' t of the two shifts went unused' + (avg ? ': at ₹13/kg that is ' + formatCurrency(gstRound((cap - kg) * 13)) + ' of work the plant could have taken on its fixed cost' : '') + '.');
  c3.html = body;
  c3.vital = { fig: capPct != null ? Math.round(capPct * 100) + '%' : '&mdash;',
    title: capPct == null ? 'Nothing weighed' : capPct >= 0.8 ? 'Busy' : escHtml(formatNum((cap - kg) / 1000, 1) + ' t spare'),
    sub: escHtml(formatNum(kg / 1000, 1) + ' t of ~' + formatNum(cap / 1000, 0) + ' t, two shifts'),
    viz: cap > 0 ? chartMeter([{ v: kg, tone: capPct != null ? figToneCapacity(capPct * 100) : 'neutral' }], { max: cap, mark: cap * 0.8,
      title: Math.round((capPct || 0) * 100) + '% of two shifts used; the mark is 80%' }) : '',
    tone: capPct == null ? 'neutral' : figToneCapacity(capPct * 100) };
  c3.cap = cap;
  c3.capPct = capPct;
  cards.plant = c3;

  // 4. What changed? The most urgent insights, as sentences, and the month's pace. Each insight is followed by its own
  // moves (advInsightMovesHtml, advice.js).
  var c4 = { key: 'changed', q: 'What changed?' };
  var ins = [];
  try { ins = (ctx ? ctx.todo() : todoAppAll()).filter(function(t) { return t.rule.indexOf('ins') === 0; }); } catch (e) { ins = []; }
  var rank = { red: 0, amber: 1, info: 2 };
  ins.sort(function(a, b) { return (rank[a.tone] != null ? rank[a.tone] : 3) - (rank[b.tone] != null ? rank[b.tone] : 3); });
  body = '';
  var p = null;
  try { p = predMonthPace(); } catch (e) { p = null; }
  if (p) body += say(c4, p.prevRev > 0 && p.projRev < p.prevRev ? 'warning' : 'ok', 'This month is heading for ' + formatCurrency(p.projRev) + ' at its pace (' + p.done + ' of ' + p.total + ' working days in), against ' + formatCurrency(p.prevRev) + ' in ' + p.prevLabel + '.');
  // Why realisation moved against the period before, its largest cause named (why.js, I4); the panel under the questions has the rest.
  var ws = null;
  try { ws = whySentence(filtered, prior, period); } catch (e) { ws = null; }
  if (ws) body += say(c4, ws.tone, escHtml(ws.text));
  ins.slice(0, 3).forEach(function(t) { body += todoAppRowHtml(t) + (typeof advInsightMovesHtml === 'function' ? advInsightMovesHtml(t) : ''); });
  // The rest are tasks on Needs you, where every insight is listed (the list that closed Stats → Overview went with it).
  if (ins.length > 3) body += '<div class="inv-row" data-story-more><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invSwitchTab" data-tab="pageHome" data-v="needs">All ' + ins.length + ' insights on Needs you</button></div>';
  if (!body) body = say(c4, 'ok', 'Nothing stands out: no insight is raised on the book right now.');
  if (!c4.answer) c4.answer = { tone: uiTone(ins[0].tone), say: escHtml(ins[0].title) };
  c4.html = body;
  c4.vital = p ? { fig: figWrapHtml(formatCurrency(p.projRev)), title: 'This month is heading for',
      sub: escHtml('at its pace, ' + p.done + ' of ' + p.total + ' working days in, against ' + formatCurrency(p.prevRev) + ' in ' + p.prevLabel),
      viz: chartMeter([{ v: p.projRev, tone: p.prevRev > 0 && p.projRev < p.prevRev ? 'warning' : 'ok' }], { max: Math.max(p.projRev, p.prevRev), mark: p.prevRev,
        title: formatCurrency(p.projRev) + ' at its pace against ' + formatCurrency(p.prevRev) + ' in ' + p.prevLabel }),
      tone: p.prevRev > 0 && p.projRev < p.prevRev ? 'warning' : 'ok' }
    : ins.length ? { fig: String(ins.length), title: ins.length === 1 ? 'insight raised' : 'insights raised', sub: escHtml(ins[0].title), viz: '', tone: uiTone(ins[0].tone) }
    : { fig: '&mdash;', title: 'Nothing stands out', sub: '', viz: '', tone: 'ok' };
  c4.ins = ins;
  cards.changed = c4;

  // 5. Is cash coming in? Only with a statement.
  if (finHasBank()) {
    try {
      var c5 = { key: 'cash', q: 'Is cash coming in?' };
      var bRows = bankRows(), bLast = bRows[bRows.length - 1], recv = finCtx().recv(), owed = gstRound(recv.reduce(function(s, x) { return s + Math.max(0, x.owed); }, 0));
      var bBook = bankBookDaysToPay(bankPayHistory(recv));
      body = statsTiles(statsTile('bal', 'In the bank', statsMoney(bLast.balance), statsTileSub('on ' + escHtml(formatDate(bLast.date))), bLast.balance < 0 ? 'danger' : '') +
        statsTile('owed', 'Owed to us', statsMoney(owed), statsTileSub(bBook ? 'clients pay in ' + Math.round(bBook.median) + ' days' : ''), bBook ? figTonePaysIn(Math.round(bBook.median)) : ''));
      // Judged as Pulse's Money card judges it (finlinks.js renderFinHomeCard), so the two never disagree on one figure (the
      // survey of 8 Oct 2026: owed read green here and red there): overdrawn is danger; what is owed past 90 days danger, unless a
      // receipt is still unplaced (that money may be in), past 60 warning; and how fast clients pay (figTonePaysIn).
      var ages = finAgeing(recv), old90 = ages[3] ? ages[3].amount : 0, old60 = ages[2] ? ages[2].amount : 0;
      var loose = bankLooseReceipts(finCtx().cls, bankRecvFrom(finCtx().rows)).length;
      var cashRank = { danger: 3, warning: 2, ok: 1 }, cashTone = [bLast.balance < 0 ? 'danger' : 'ok', old90 > 0.5 ? (loose ? 'warning' : 'danger') : old60 > 0.5 ? 'warning' : 'ok',
        bBook ? figTonePaysIn(Math.round(bBook.median)) : null].filter(Boolean).sort(function(x, y) { return cashRank[y] - cashRank[x]; })[0] || 'ok';
      body += say(c5, cashTone, 'Owed ' + formatCurrency(owed) + (old90 > 0.5 ? ', ' + formatCurrency(old90) + ' of it over 90 days' : old60 > 0.5 ? ', ' + formatCurrency(old60) + ' of it over 60 days' : '') +
        (bBook ? '; arriving in about ' + Math.round(bBook.median) + ' days at the usual pace' : '') + '.');
      c5.html = body;
      c5.vital = { fig: figWrapHtml(statsMoney(owed)), title: 'Owed to us',
        sub: escHtml((old90 > 0.5 ? formatCurrency(old90) + ' over 90 days · ' : '') + 'in the bank ' + formatCurrency(bLast.balance) + (bBook ? ' · clients pay in ' + Math.round(bBook.median) + ' days' : '')),
        viz: chartMeter(ages.map(function(b, i) { return { v: b.amount, tone: FIN_AGE_TONE[i] || 'danger' }; }),
          { title: ages.map(function(b) { return b.label + ' ' + formatCurrency(b.amount); }).join(' · ') }),
        tone: cashTone };
      cards.cash = c5;
    } catch (e) { /* no cash story without a readable statement */ }
  }
  return cards;
}

