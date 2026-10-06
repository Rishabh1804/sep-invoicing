/* ===== WHY IT MOVED (docs/INTELLIGENCE_2.md, I4) =====
   Owner, 6 Oct 2026, the fourth step of refining the intelligence: a figure that moved is broken into its causes, each with
   its ₹, and the causes add up to the change exactly. Three bridges, each from the period before to this one:
   - realisation (₹/kg): each client's own rate, and the mix (a client's share of the tonnage, at its rate against the
     average before). Over the weighed lines, the same ones the realisation figure divides (weighLines), so the bridge
     starts and ends on the figures Stats shows;
   - contribution (₹): the price (realisation's change × this period's kilos), each cost line's change per kg × the same
     kilos, and the volume (the kilos gained or lost × what a kilo left before);
   - cash (₹): two closed months on the statement, money in by client and out by kind.
   Nothing here is a second arithmetic: realisation is buildClientRollup's, cost is liveCost's rows, cash is the statement
   as classified (bankClassify). A bridge that cannot be drawn says why, never a zero. */

var WHY_TOP = 4;
function whyIsoRange(period, offset) {
  if (!offset) return statsRangeIso(period);
  var r = periodRange(period, offset);
  return r ? { from: isoOf(new Date(r.start)), to: isoOf(new Date(r.end)) } : null;
}
/* The causes, largest first by size, the top `n` kept and the rest one line, so what is shown still adds up. */
/* `eps`: what rounds to nothing as shown (half a paisa, or half a paisa a kilo), never listed. */
function whyTop(causes, total, n, otherLabel, eps) {
  eps = eps || 0.005;
  causes = causes.filter(function(c) { return Math.abs(c.v) >= eps; }).sort(function(a, b) { return Math.abs(b.v) - Math.abs(a.v); });
  var top = causes.slice(0, n), restN = causes.length - top.length;
  var shown = top.reduce(function(s, c) { return s + c.v; }, 0);
  if (Math.abs(total - shown) >= eps) top.push({ kind: 'other', label: restN > 0 ? otherLabel(restN) : 'Rounding', v: total - shown });
  return top;
}

/* ---------- Realisation ---------- */
/* `filtered`, `prior`: the invoices of the two periods, net of credit notes (statsInvoices). */
function whyRealisation(filtered, prior) {
  var side = function(invs) {
    var by = {}, K = 0, rev = 0;
    buildClientRollup(invs).forEach(function(c) { if (c.kg > 0) { by[c.clientId] = c; K += c.kg; rev += c.revKnown; } });
    return { by: by, K: K, R: K > 0 ? rev / K : null };
  };
  var a = side(prior), b = side(filtered);
  if (a.R == null || b.R == null) return { none: a.R == null ? 'nothing weighed in the period before' : 'nothing weighed in the period' };
  var causes = [];
  Object.keys(Object.assign({}, a.by, b.by)).forEach(function(id) {
    var x = a.by[id], y = b.by[id], name = (y || x).name || 'A client';
    var s0 = x ? x.kg / a.K : 0, s1 = y ? y.kg / b.K : 0, r0 = x ? x.revKnown / x.kg : null, r1 = y ? y.revKnown / y.kg : null;
    // ΔR = Σ s1(r1 − r0) + Σ (s1 − s0)(r0 − R0) over clients in both; a client new to the period adds s1(r1 − R0), one gone
    // takes s0(r0 − R0): the terms sum to R1 − R0 exactly, since the shares of each side sum to one.
    if (x && y) {
      causes.push({ kind: 'rate', id: id, name: name, v: s1 * (r1 - r0), r0: r0, r1: r1, s1: s1 });
      causes.push({ kind: 'mix', id: id, name: name, v: (s1 - s0) * (r0 - a.R), s0: s0, s1: s1, r: r0 });
    } else if (y) causes.push({ kind: 'new', id: id, name: name, v: s1 * (r1 - a.R), s1: s1, r: r1 });
    else causes.push({ kind: 'gone', id: id, name: name, v: -s0 * (r0 - a.R), s0: s0, r: r0 });
  });
  var d = b.R - a.R;
  var top = whyTop(causes, d, WHY_TOP, function(n) { return n + ' smaller change' + (n === 1 ? '' : 's'); }, 0.00005);
  top.forEach(function(c) { c.rs = c.v * b.K; c.label = c.label || whyRealLabel(c, a.R); });
  return { R0: a.R, R1: b.R, K0: a.K, K1: b.K, d: d, rs: d * b.K, causes: top };
}
function whyPct(s) { return Math.round(s * 100) + '%'; }
function whyRealLabel(c, R0) {
  var rk = function(v) { return '₹' + formatNum(v, 2) + '/kg'; };
  if (c.kind === 'rate') return c.name + '’s own rate, ' + rk(c.r0) + ' → ' + rk(c.r1);
  if (c.kind === 'mix') return c.name + '’s share of the kilos, ' + whyPct(c.s0) + ' → ' + whyPct(c.s1) + ', at ' + rk(c.r) + ' against ' + rk(R0) + ' on average';
  if (c.kind === 'new') return c.name + ', not billed before: ' + whyPct(c.s1) + ' of the kilos at ' + rk(c.r);
  return c.name + ', not billed now: it was ' + whyPct(c.s0) + ' of the kilos at ' + rk(c.r);
}

/* ---------- Contribution ---------- */
/* At the live cost of each period (liveCost, the cost Stats judges by). */
function whyMargin(period, filtered, prior, real) {
  var r1 = whyIsoRange(period, 0), r0 = whyIsoRange(period, 1);
  if (!r0) return { none: 'no period before' };
  if (!real || real.none) return { none: real ? real.none : 'no realisation' };
  var c1 = liveCost(r1.from, r1.to, real.K1), c0 = liveCost(r0.from, r0.to, real.K0);
  if (!(c1.perKg > 0) || !(c0.perKg > 0)) return { none: 'no cost for one of the periods' };
  var C0 = (real.R0 - c0.perKg) * real.K0, C1 = (real.R1 - c1.perKg) * real.K1, K1 = real.K1;
  // ΔC = (R1 − R0)K1 − Σ(c1 − c0)K1 + (R0 − c0)(K1 − K0), exactly.
  var causes = [{ kind: 'price', label: 'Realisation, ₹' + formatNum(real.R0, 2) + ' → ₹' + formatNum(real.R1, 2) + '/kg', v: real.d * K1 }];
  var rows = {};
  c0.rows.forEach(function(x) { rows[x.key] = { key: x.key, label: x.label, p0: x.perKg || 0, p1: 0, s0: x.source }; });
  c1.rows.forEach(function(x) { var e = rows[x.key] || (rows[x.key] = { key: x.key, label: x.label, p0: 0 }); e.p1 = x.perKg || 0; e.s1 = x.source; });
  Object.keys(rows).forEach(function(k) {
    var e = rows[k], model = e.s0 === 'model' || e.s1 === 'model';
    causes.push({ kind: 'cost', key: k, label: e.label + ', ₹' + formatNum(e.p0, 2) + ' → ₹' + formatNum(e.p1, 2) + '/kg' + (model ? ' (partly the model)' : ''), v: -(e.p1 - e.p0) * K1 });
  });
  var left0 = real.R0 - c0.perKg;
  causes.push({ kind: 'volume', label: 'Kilos, ' + formatNum(real.K0 / 1000, 1) + ' t → ' + formatNum(real.K1 / 1000, 1) + ' t at ' + (left0 < 0 ? '−' : '') + '₹' + formatNum(Math.abs(left0), 2) + '/kg ' + (left0 < 0 ? 'lost' : 'left') + ' before',
    v: (real.R0 - c0.perKg) * (real.K1 - real.K0) });
  var d = C1 - C0;
  return { C0: C0, C1: C1, d: d, cost0: c0.perKg, cost1: c1.perKg, measured: Math.min(c0.measuredShare, c1.measuredShare), causes: whyTop(causes, d, WHY_TOP + 1, function(n) { return n + ' smaller cost line' + (n === 1 ? '' : 's'); }) };
}

/* ---------- Cash ---------- */
/* The last two months the statement covers end to end: money in by client (unplaced said), money out by kind. */
function whyCash() {
  if (typeof finHasBank !== 'function' || !finHasBank()) return { none: 'no bank statement' };
  var ms = finClosedMonths(2);
  if (ms.length < 2) return { none: 'the statement covers fewer than two whole months' };
  var cls = finCtx().cls, nameOf = function(id) { var c = (S.clients || []).find(function(x) { return String(x.id) === String(id); }); return c ? c.name : 'A client'; };
  var sides = ms.map(function(m) {
    var g = {}, net = 0;
    cls.forEach(function(v) {
      if (insMonthKey(v.row.date) !== m) return;
      var cr = v.row.cr || 0, dr = v.row.dr || 0;
      net += cr - dr;
      if (cr > 0) { var k = v.cat === 'receipt' ? (v.clientId != null ? 'in:' + v.clientId : 'in:loose') : 'in:' + v.cat; g[k] = (g[k] || 0) + cr; }
      if (dr > 0) g['out:' + v.cat] = (g['out:' + v.cat] || 0) - dr;
    });
    return { m: m, g: g, net: net };
  });
  var a = sides[0], b = sides[1], causes = [];
  Object.keys(Object.assign({}, a.g, b.g)).forEach(function(k) {
    var v0 = a.g[k] || 0, v1 = b.g[k] || 0, what = k.slice(k.indexOf(':') + 1), out = k.indexOf('out:') === 0;
    var label = out ? 'Paid out, ' + bankCatLabel(what).toLowerCase() : what === 'loose' ? 'Receipts with no client' : /^\d+$/.test(what) || (S.clients || []).some(function(c) { return String(c.id) === what; }) ? 'Received from ' + nameOf(what) : 'Money in, ' + bankCatLabel(what).toLowerCase();
    causes.push({ kind: out ? 'out' : 'in', key: k, label: label + ', ' + finRs(Math.abs(v0)) + ' → ' + finRs(Math.abs(v1)), v: v1 - v0 });
  });
  var d = b.net - a.net;
  return { m0: a.m, m1: b.m, net0: a.net, net1: b.net, d: d, causes: whyTop(causes, d, WHY_TOP + 1, function(n) { return n + ' smaller change' + (n === 1 ? '' : 's'); }) };
}

/* ---------- Drawing ---------- */
function whyCauseRow(c, unit) {
  var tone = c.v > 0.005 ? 'ok' : c.v < -0.005 ? 'danger' : 'neutral';
  var fig = unit === 'kg' ? (c.v >= 0 ? '+' : '−') + '₹' + formatNum(Math.abs(c.v), 2) + '/kg' : (c.v >= 0 ? '+' : '−') + formatCurrency(gstRound(Math.abs(c.v)));
  var sub = unit === 'kg' && c.rs != null ? (c.rs >= 0 ? '+' : '−') + formatCurrency(gstRound(Math.abs(c.rs))) + ' on the period' : '';
  return '<div class="inv-row inv-row-auto" data-why-cause="' + escHtml(c.kind) + '"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(c.label) + '</span>' +
    (sub ? '<span class="inv-row-meta">' + escHtml(sub) + '</span>' : '') + '</span>' +
    '<span class="inv-row-end"><span class="inv-num' + (tone === 'neutral' ? '' : ' inv-fig-' + tone) + '">' + escHtml(fig) + '</span></span></div>';
}
function whyHeadRow(title, from, to, change, key) {
  return '<div class="inv-row-group" data-why="' + key + '"><span>' + escHtml(title) + ' · ' + escHtml(from) + ' → ' + escHtml(to) + '</span><span class="inv-num">' + escHtml(change) + '</span></div>';
}
function whySigned(v, kg) { return (v >= 0 ? '+' : '−') + (kg ? '₹' + formatNum(Math.abs(v), 2) + '/kg' : formatCurrency(gstRound(Math.abs(v)))); }
/* How sure (I2's rule): a month under INS_EARLY_DAYS working days in is early, a week's mix moves it; '' when not. */
function whyEarly(period) {
  if (period !== 'mtd') return '';
  var r = statsRangeIso(period), n = statsWorkingDays(r.from, r.to);
  return n < INS_EARLY_DAYS ? todoPlural(n, 'working day') + ' in, against the same days before: a few large invoices move these figures' : '';
}
/* The panel on Stats → Overview, for the period shown against the one before it. */
function whyHtml(period, filtered, prior) {
  if (period === 'all' || !prior.length) return '';
  var real = whyRealisation(filtered, prior), mg = real.none ? { none: real.none } : whyMargin(period, filtered, prior, real), cash = whyCash();
  var vs = PERIOD_PRIOR_LABELS[period] || 'the period before';
  var h = statsPanel('why', 'Why it moved', 'against ' + escHtml(vs) + ', each cause with its ₹, adding up to the change', { wide: true, id: 'statsWhy' });
  var early = whyEarly(period);
  if (early) h += '<div class="inv-callout inv-callout-info" data-why-early>' + uiDot('info', 'Early') + ' ' + escHtml(early) + '.</div>';
  if (real.none) h += '<div class="inv-empty">Realisation cannot be compared: ' + escHtml(real.none) + '.</div>';
  else {
    h += whyHeadRow('Realisation', '₹' + formatNum(real.R0, 2), '₹' + formatNum(real.R1, 2) + '/kg', whySigned(real.d, true), 'real');
    h += real.causes.map(function(c) { return whyCauseRow(c, 'kg'); }).join('');
  }
  if (mg.none) h += '<div class="inv-empty">Contribution cannot be compared: ' + escHtml(mg.none) + '.</div>';
  else {
    h += whyHeadRow('Contribution at the live cost', whySigned(mg.C0).replace(/^\+/, ''), whySigned(mg.C1).replace(/^\+/, ''), whySigned(mg.d), 'margin');
    if (mg.measured < 0.9) h += '<div class="inv-row" data-why-measured><span class="inv-row-main inv-row-meta inv-row-wrap">' + uiDot('warning', 'Partly measured') +
      ' the live cost is ' + Math.round(mg.measured * 100) + '% measured in the less measured period; the rest is the model, so a cost line can move on what was not recorded</span></div>';
    h += mg.causes.map(function(c) { return whyCauseRow(c); }).join('');
  }
  if (!cash.none) {
    h += whyHeadRow('Cash, net in the month, ' + billsMonthLabel(cash.m0) + ' to ' + billsMonthLabel(cash.m1), finRs(cash.net0), finRs(cash.net1), whySigned(cash.d), 'cash');
    h += cash.causes.map(function(c) { return whyCauseRow(c); }).join('');
  }
  return h + '</div>';
}
/* One sentence for What changed? (intel.js): realisation's change and its largest cause. */
function whySentence(filtered, prior, period) {
  if (period === 'all' || !prior.length) return null;
  var real = whyRealisation(filtered, prior);
  if (real.none || Math.abs(real.d) < 0.005) return null;
  var top = real.causes.filter(function(c) { return c.kind !== 'other'; })[0];
  var early = whyEarly(period);
  return { tone: early ? 'info' : real.d >= 0 ? 'ok' : 'warning', text: 'Realisation ' + (real.d >= 0 ? 'rose ' : 'fell ') + '₹' + formatNum(Math.abs(real.d), 2) + '/kg against ' +
    (PERIOD_PRIOR_LABELS[period] || 'the period before') + (top ? '; the largest cause: ' + top.label + ', ' + whySigned(top.v, true) : '') + (early ? ' (early: ' + early.split(',')[0] + ')' : '') + '.' };
}
