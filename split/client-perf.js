/* ===== CLIENT PERFORMANCE =====
 *
 * Month on month for one account, and — the part that earns its place — what
 * has quietly stopped arriving. A part that disappears does not raise an
 * error, does not empty a queue and does not show up as a loss. It shows up as
 * a slightly smaller month, twice, and then it is normal. This view names it.
 *
 * Cadence is read from BOTH spines: invoice lines and challan lines. Invoices
 * are the complete record, but material arrives before it is billed, so a part
 * received last week and not yet invoiced would read as overdue on the billing
 * record alone. Taking the union means "when did we last handle this part for
 * this client", which is the question.
 */

var CP_LOOKBACK_MONTHS = 12;
var _cpSeries = 'revenue';
var CP_NEW_DAYS = 60;

function getPerfClientId() {
  var v = regFilter.perfClientId;
  return v ? parseInt(v, 10) : null;
}

function setPerfClientId(id) {
  regFilter.perfClientId = id == null ? '' : String(id);
  saveRegFilter();
}

/* Part identity for cadence purposes. Part numbers are typed by hand and vary
   between documents — "Clamp 165x83" against "CLAMP 165X83(40X6)" — so the
   key is case- and punctuation-insensitive. It cannot merge everything a human
   would; see cpFindRenames() for what is done about the rest. */
function cpNormPart(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/* A part's identity: its size where it names one (149X83, 150X80X3), else its number, with its gauge beside it.
   The owner, 30 Sep 2026: "some items like 149x83 are still coming but the flag is being raised" — the same clamp was
   written CLAMP 149X83(40X6) to July and 149X83 (the gauge in the description) from August, and keyed on the whole text
   the older spelling read as stopped. A gauge (two digits × one) is never a size. A part with no digits of its own
   (CLAMP) takes the size from its description. */
function cpPartIdentity(part, desc) {
  var n = function(x) { return String(x || '').toUpperCase().replace(/[×✕*]/g, 'X'); };
  var p = n(part), d = n(desc);
  var dims = function(x) {
    var m = /(?:^|[^0-9])(\d{2,4})\s*X\s*(\d{2,4})(?:\s*X\s*(\d{1,4}))?(?![0-9])/.exec(x);
    return m ? m[1] + 'X' + m[2] + (m[3] ? 'X' + m[3] : '') : '';
  };
  var own = p.replace(/\([^)]*\)/g, '');
  var size = dims(p) || (!/\d/.test(own) ? dims(d) : '');
  return { base: size || cpNormPart(part || desc), gauge: lineGauge(d) || lineGauge(p) };
}

/* Every part this client has handled, with the dates it appeared on either
   spine, the weight and the revenue it carried. A part is its number AND its gauge: two gauges of one clamp are two
   parts, and keyed on the number alone one gauge could stop while the other hid it. A line that names no gauge joins
   the part's one gauge when the client's lines show only one; with two it stays apart, as the gauge not stated. */
function cpBuildHistory(clientId) {
  var byPart = {};
  var client = S.clients.find(function(c) { return c.id === clientId; }) || null;

  function touch(it, dateStr) {
    if (!dateStr) return null;
    var rawPart = it.partNumber || it.desc;
    var idn = cpPartIdentity(it.partNumber, it.desc);
    var base = idn.base;
    if (!base) return null;
    var gauge = idn.gauge;
    var key = base + '|' + gauge;
    if (!byPart[key]) {
      byPart[key] = { key: key, base: base, gauge: gauge, name: rawPart, dates: {}, kg: 0, revenue: 0, invoiced: 0, received: 0 };
    }
    byPart[key].dates[dateStr] = true;
    // Keep the longest spelling seen: it is the one carrying the gauge.
    if (String(rawPart).length > String(byPart[key].name).length) byPart[key].name = rawPart;
    return byPart[key];
  }

  S.invoices.filter(function(i) { return i.status === 'active' && i.clientId === clientId; })
    .forEach(function(inv) {
      (inv.items || []).forEach(function(it) {
        var e = touch(it, inv.date);
        if (!e) return;
        e.revenue += (it.amount || 0);
        e.invoiced++;
        var w = lineWeightKg(it, client, inv.date);
        if (w.known) e.kg += w.kg;
      });
    });

  (S.incomingMaterial || []).filter(function(im) { return im.clientId === clientId; })
    .forEach(function(im) {
      var d = im.challanDate || im.receivedDate;
      (im.items || []).forEach(function(it) {
        var e = touch(it, d);
        if (e) e.received++;
      });
    });

  // A gauge-less entry folds into the part's only gauge.
  var gauges = {};
  Object.keys(byPart).forEach(function(k) { var e = byPart[k]; if (e.gauge) (gauges[e.base] = gauges[e.base] || []).push(e); });
  Object.keys(byPart).forEach(function(k) {
    var e = byPart[k], only = gauges[e.base];
    if (e.gauge || !only || only.length !== 1) return;
    var t = only[0];
    Object.keys(e.dates).forEach(function(d) { t.dates[d] = true; });
    t.kg += e.kg; t.revenue += e.revenue; t.invoiced += e.invoiced; t.received += e.received;
    delete byPart[k];
  });
  return Object.values(byPart).map(function(e) {
    // The gauge said beside a name that does not carry it.
    if (e.gauge && lineGauge(e.name) !== e.gauge) e.name = e.name + ' (' + e.gauge + ')';
    else if (!e.gauge && gauges[e.base]) e.name = e.name + ' (gauge not stated)';
    e.dateList = Object.keys(e.dates).sort();
    return e;
  });
}

/* Steady, new, stopped or one-off — measured against the part's own rhythm.
   A fixed "absent for two months" rule would call every quarterly part dead,
   so the test is whether the current gap is long FOR THIS PART. */
function cpClassify(entry, todayIso) {
  var d = entry.dateList;
  var first = d[0], last = d[d.length - 1];
  var sinceLast = isoDaysBetween(last, todayIso);
  var age = isoDaysBetween(first, todayIso);

  var gaps = [];
  for (var i = 1; i < d.length; i++) gaps.push(isoDaysBetween(d[i - 1], d[i]));
  var typical = (numMedian(gaps) || 0);

  var out = {
    part: entry.name, key: entry.key, gauge: entry.gauge || '', kg: entry.kg, revenue: entry.revenue,
    invoiced: entry.invoiced, received: entry.received,
    times: d.length, firstSeen: first, lastSeen: last,
    sinceLast: sinceLast, typicalGap: typical
  };

  if (age <= CP_NEW_DAYS && d.length <= 3) { out.state = 'new'; return out; }
  if (d.length === 1) {
    out.state = sinceLast <= CP_NEW_DAYS ? 'new' : 'oneoff';
    return out;
  }
  // Overdue by its own standard: well past the gap it usually keeps. The floor
  // of three weeks stops a part that ships twice a week being called stopped
  // after nine days.
  var threshold = Math.max(typical * 1.75, typical + 21);
  out.overdueBy = sinceLast - Math.round(typical);
  out.state = sinceLast > threshold ? 'stopped' : 'steady';
  return out;
}

/* A part whose size still comes in another row is not simply gone. A row naming no gauge that has stopped while the same
   size in a stated gauge still comes is that part written without its gauge: it reads steady, continuing in the other.
   A stated gauge that stopped while another gauge of the size still comes stays stopped (it is a different part), and
   says which one still comes. */
function cpSiblings(classified) {
  var byBase = {};
  classified.forEach(function(m) { var b = m.key.split('|')[0]; (byBase[b] = byBase[b] || []).push(m); });
  classified.forEach(function(m) {
    if (m.state !== 'stopped') return;
    var sib = (byBase[m.key.split('|')[0]] || []).filter(function(x) { return x !== m && x.state !== 'stopped' && x.lastSeen > m.lastSeen; });
    if (!sib.length) return;
    if (!m.gauge) { m.state = 'steady'; m.continuesAs = sib[0].part; }
    else m.stillComes = sib[0].part;
  });
}

/* A part renamed rather than dropped shows up as one stopped and one new, and
   reporting a rename as lost business would discredit every other row. Part
   numbers here are known to vary in spelling between documents, so pairs that
   share a long prefix are flagged as possibly the same part. */
function cpFindRenames(stopped, fresh) {
  var pairs = {};
  stopped.forEach(function(s) {
    fresh.forEach(function(n) {
      // Two stated gauges are two parts, never a rename.
      if (s.gauge && n.gauge && s.gauge !== n.gauge) return;
      var a = s.key.split('|')[0], b = n.key.split('|')[0];
      var len = Math.min(a.length, b.length);
      var i = 0;
      while (i < len && a[i] === b[i]) i++;
      if (i >= 6) pairs[s.key] = n.part;
    });
  });
  return pairs;
}

/* Revenue, tonnage and realisation by month for one client. */
function cpMonthly(clientId, months) {
  var by = {};
  var minDate = null, maxDate = null;
  var client = S.clients.find(function(c) { return c.id === clientId; }) || null;
  // Net of credit notes, as Stats reads them (statsInvoices): the same client read ₹5.40 here and ₹5.29 on Stats.
  statsInvoices().filter(function(i) { return i.clientId === clientId && i.date; })
    .forEach(function(inv) {
      if (!minDate || inv.date < minDate) minDate = inv.date;
      if (!maxDate || inv.date > maxDate) maxDate = inv.date;
      var k = inv.date.substring(0, 7);
      if (!by[k]) by[k] = { month: k, revenue: 0, kg: 0, count: 0, revKnown: 0 };
      by[k].revenue += (inv.taxableValue || 0);
      by[k].count++;
      (inv.items || []).forEach(function(it) {
        var w = lineWeightKg(it, client, inv.date);
        if (w.known) { by[k].kg += w.kg; by[k].revKnown += (it.amount || 0); }
      });
    });
  if (!minDate) return [];
  // Months with nothing in them are kept. A client who went quiet for a quarter
  // must not render as an unbroken run of bars — that silence is the finding. So the run goes on to this month: ending
  // at the last invoice hid the quietest months of all, the ones since.
  var today = localDateStr();
  return periodKeysBetween(minDate, maxDate > today ? maxDate : today, 'month')
    .slice(-(months || CP_LOOKBACK_MONTHS))
    .map(function(k) {
      var r = by[k] || { month: k, revenue: 0, kg: 0, count: 0, revKnown: 0 };
      r.realisation = r.kg > 0 ? r.revKnown / r.kg : null;
      r.label = formatTrendLabel(k, 'month');
      return r;
    });
}

/* The plant's cost per kg for a month (to today while it runs): the live cost Stats judges by, else the typed figure. */
function cpMonthCost(ym) {
  var from = ym + '-01', to = payMonthEnd(from), today = localDateStr();
  if (to > today) to = today;
  try {
    var w = weighLines(S.invoices.filter(function(i) { return i.status === 'active' && i.date && i.date >= from && i.date <= to; }));
    var c = liveCost(from, to, w.kg);
    if (c && c.perKg > 0) return { perKg: c.perKg, live: true };
  } catch (e) { /* the typed figure below */ }
  return S.defaultCostPerKg > 0 ? { perKg: S.defaultCostPerKg, live: false } : null;
}

/* This client over the same days of last month as this month has run: the fair benchmark part-way through a month. */
function cpPriorSameDays(clientId) {
  var p = homePriorSameDays(), client = S.clients.find(function(c) { return c.id === clientId; }) || null;
  var out = { revenue: 0, kg: 0, revKnown: 0 }, net = {};
  statsInvoices().forEach(function(i) { net[i.id] = i; });
  p.invoices.filter(function(i) { return i.clientId === clientId; }).map(function(i) { return net[i.id] || i; }).forEach(function(inv) {
    out.revenue += (inv.taxableValue || 0);
    (inv.items || []).forEach(function(it) {
      var w = lineWeightKg(it, client, inv.date);
      if (w.known) { out.kg += w.kg; out.revKnown += (it.amount || 0); }
    });
  });
  out.realisation = out.kg > 0 ? out.revKnown / out.kg : null;
  return out;
}

/* ===== VIEW ===== */
/* A material row: the part, how often and when it was last handled, and what it earned. A stopped
   part says how long it has been gone; a possible rename says so. */
function _cpMaterialRowList(list, renames) {
  return list.map(function(m) {
    var meta = m.times + '× · last ' + formatDate(m.lastSeen) +
      (m.typicalGap > 0 ? ' · usually every ' + Math.round(m.typicalGap) + 'd' : '') +
      (m.kg > 0 ? ' · ' + formatNum(m.kg, 0) + ' kg' : '');
    var rename = renames && renames[m.key];
    return '<div class="inv-row inv-row-auto" data-cp-mat>' +
      '<span class="inv-row-main"><span class="inv-row-title inv-row-wrap"><span class="inv-id">' + escHtml(m.part) + '</span></span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(meta) + '</span>' +
      (m.state === 'stopped'
        ? '<span class="inv-row-meta inv-row-wrap"><span class="inv-dot inv-dot-danger">' + m.sinceLast + ' days since the last one' +
          (m.overdueBy > 0 ? ', about ' + m.overdueBy + ' overdue' : '') + '</span></span>'
        : '') +
      (m.continuesAs ? '<span class="inv-row-meta inv-row-wrap">No gauge written; still comes as ' + escHtml(m.continuesAs) + '</span>' : '') +
      (m.stillComes ? '<span class="inv-note inv-row-wrap">The same size still comes as ' + escHtml(m.stillComes) + '.</span>' : '') +
      (rename ? '<span class="inv-note inv-row-wrap">Possibly renamed to &ldquo;' + escHtml(rename) +
        '&rdquo; — the spellings share a stem, so this may not be lost work.</span>' : '') +
      '</span>' +
      // A part that only ever arrived on a challan has no revenue yet. Printing
      // Rs 0.00 for it reads as worthless work rather than unbilled work.
      '<span class="inv-row-end">' +
      (m.invoiced > 0 ? '<span class="inv-num">' + formatCurrency(m.revenue) + '</span>' : '<span class="inv-badge inv-badge-neutral">Challan only</span>') +
      '</span></div>';
  });
}

/* "+12.3% on Aug", never an arrow alone (§5.4), coloured by whether it moved the good way (figDeltaHtml). */
function _cpDelta(cur, prev, better) {
  if (!prev) return '';
  return figDeltaHtml(cur, prev.v, prev.label, better || 'up');
}

function renderClientPerformance(container) {
  if (!container) return;
  var clients = S.clients.slice().sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); });
  var clientId = getPerfClientId();
  if (clientId == null && clients.length > 0) {
    // Default to the account with the most revenue — the one worth watching.
    var byRev = {};
    S.invoices.forEach(function(i) {
      if (i.status !== 'active') return;
      byRev[i.clientId] = (byRev[i.clientId] || 0) + (i.taxableValue || 0);
    });
    var best = Object.keys(byRev).sort(function(a, b) { return byRev[b] - byRev[a]; })[0];
    clientId = best != null ? parseInt(best, 10) : clients[0].id;
  }

  // The client picker speaks through change only (events.js).
  var html = '<div class="inv-toolbar">' +
    '<label class="inv-field inv-toolbar-item"><span class="inv-field-label">Client</span>' +
    '<select class="inv-select" id="cpClientSelect">' +
    clients.map(function(c) {
      return '<option value="' + c.id + '"' + (c.id === clientId ? ' selected' : '') + '>' + escHtml(c.name) + '</option>';
    }).join('') + '</select></label></div>';

  if (clientId == null) {
    container.innerHTML = html + '<div class="inv-panel"><div class="inv-empty">No clients yet</div></div>';
    return;
  }
  html += finClientMoneyHtml(clientId);

  var monthly = cpMonthly(clientId, CP_LOOKBACK_MONTHS);
  var today = localDateStr();
  var history = cpBuildHistory(clientId);
  var classified = history.map(function(e) { return cpClassify(e, today); });
  cpSiblings(classified);

  var stopped = classified.filter(function(m) { return m.state === 'stopped'; })
    .sort(function(a, b) { return b.revenue - a.revenue; });
  var fresh = classified.filter(function(m) { return m.state === 'new'; })
    .sort(function(a, b) { return b.revenue - a.revenue; });
  var steady = classified.filter(function(m) { return m.state === 'steady'; })
    .sort(function(a, b) { return b.revenue - a.revenue; });
  var oneoff = classified.filter(function(m) { return m.state === 'oneoff'; })
    .sort(function(a, b) { return b.revenue - a.revenue; });
  var renames = cpFindRenames(stopped, fresh);

  if (monthly.length === 0 && classified.length === 0) {
    container.innerHTML = html + '<div class="inv-panel"><div class="inv-empty">Nothing recorded for this client yet</div></div>';
    return;
  }

  // Month on month: the chart, the metric as a segmented control (§6.5), then the latest month as tiles.
  var last = monthly[monthly.length - 1];
  var prev = monthly.length > 1 ? monthly[monthly.length - 2] : null;
  var seg = function(k, l) {
    return '<button type="button" class="inv-seg-btn" data-action="invPerfSeries" data-series="' + k + '" aria-pressed="' + (_cpSeries === k) + '">' + l + '</button>';
  };
  html += '<div class="inv-panel" data-cp-trend>' +
    '<div class="inv-panel-head inv-mb-8"><span class="inv-panel-title">Month on month <span class="inv-note">last ' + monthly.length + ' month' + (monthly.length !== 1 ? 's' : '') + '</span></span></div>' +
    '<div class="inv-seg inv-mb-8" role="group" aria-label="Measure">' + seg('revenue', '₹') + seg('tonnage', 'Tonnes') + seg('rate', '₹/kg') + '</div>';

  var series = monthly.map(function(r) {
    return {
      label: r.label,
      value: _cpSeries === 'tonnage' ? r.kg : _cpSeries === 'rate' ? (r.realisation || 0) : r.revenue
    };
  });
  html += chartBars(series, {
    unit: _cpSeries === 'tonnage' ? 'kg' : 'money',
    ariaLabel: 'Month on month'
  });

  if (last) {
    var tile = function(label, value, sub, delta) {
      return '<div class="inv-tile"><div class="inv-tile-label">' + label + '</div><div class="inv-tile-value">' + figWrapHtml(value) + '</div>' +
        (sub ? '<div class="inv-tile-sub">' + sub + '</div>' : '') + (delta ? '<div class="inv-tile-sub">' + delta + '</div>' : '') + '</div>';
    };
    // The month in progress is read against the same days of last month, never against a whole month: part of a month
    // against a full one read red every month until its last days.
    var thisYm = today.slice(0, 7), partial = last.month === thisYm;
    var bench = partial ? cpPriorSameDays(clientId) : prev;
    var bl = partial ? 'same days last month' : (prev && prev.label);
    var p = function(v) { return bench ? { v: v, label: bl } : null; };
    // Realisation is judged at the month's own live cost, the figure Stats and Home judge it by, not the typed one.
    var cost = last.realisation != null ? cpMonthCost(last.month) : null;
    var full = monthly.filter(function(r) { return r.month !== thisYm; });
    html += '<div class="inv-tiles inv-tiles-flush">' +
      tile((partial ? 'Month to date · ' : 'Latest month · ') + escHtml(last.label), formatCurrency(last.revenue),
        last.count + ' invoice' + (last.count !== 1 ? 's' : ''), _cpDelta(last.revenue, p(bench && bench.revenue))) +
      tile('Tonnage', formatNum(last.kg / 1000, 2) + '<span class="inv-tile-of"> t</span>', formatNum(last.kg, 0) + ' kg', _cpDelta(last.kg, p(bench && bench.kg))) +
      tile('Realisation', last.realisation != null ? figHtml(formatCurrency(last.realisation), cost ? figToneAgainst(last.realisation, cost.perKg, 5) : null) + '<span class="inv-tile-of">/kg</span>' : '&mdash;',
        cost ? (cost.live ? 'live cost ' : 'cost ') + formatCurrency(cost.perKg) + '/kg' : '',
        (bench && bench.realisation != null && last.realisation != null) ? _cpDelta(last.realisation, p(bench.realisation)) : '') +
      // The whole months shown, quiet ones included: the level the latest month is read against. A month in progress is
      // not one of them.
      tile('Average month', full.length ? formatCurrency(full.reduce(function(t, r) { return t + r.revenue; }, 0) / full.length) : '&mdash;',
        full.length ? 'over ' + full.length + ' full month' + (full.length !== 1 ? 's' : '') : 'no full month yet', '') +
      '</div>';
  }
  html += '</div>';

  // Stopped first: it is the only one of the four that is a question. Each group shows its first ten (the count is on its
  // head) and One-off (handled once, long ago) shows none until asked: SSS Mehta's card ran 23 phone screens with 101
  // stopped parts and every part it ever sent (UX overhaul 2, step 6).
  var group = function(key, title, tone, list, emptyText, note, renamesFor, n) {
    var rows = list.length ? _cpMaterialRowList(list, renamesFor) : [];
    return '<div data-cp-group="' + key + '">' +
      '<div class="inv-row-group"><span class="inv-dot inv-dot-' + tone + '">' + title + ' · ' + list.length + '</span></div>' +
      (list.length === 0
        ? '<div class="inv-row"><span class="inv-row-main inv-row-meta">' + emptyText + '</span></div>'
        : (note ? '<div class="inv-row inv-row-auto"><span class="inv-row-main inv-note inv-row-wrap">' + note + '</span></div>' : '') +
          uiMoreHtml('cp-' + key + '-' + clientId, rows, { n: n == null ? 10 : n, noun: 'parts' })) +
      '</div>';
  };
  html += cpWorkedHtml(clientId) + cpHoursHtml(clientId);
  html += '<div class="inv-panel inv-panel-flush" data-card="materials">' +
    '<div class="inv-panel-head"><span class="inv-panel-title">Cadence</span><span class="inv-note">each part against its own rhythm, across invoices and challans</span></div>' +
    group('stopped', 'Stopped', 'danger', stopped, 'Nothing has fallen out of its rhythm.',
      'Overdue against the gap each part usually keeps, not a fixed cut-off — a quarterly part is not called stopped in month two.', renames) +
    group('new', 'New', 'info', fresh, 'Nothing new in the last ' + CP_NEW_DAYS + ' days.', '', null) +
    group('steady', 'Steady', 'ok', steady, 'No part is running to a regular cadence.', '', null) +
    (oneoff.length > 0 ? group('oneoff', 'One-off', 'neutral', oneoff, '', 'Handled once and long ago. Never had a cadence to fall out of.', null, 0) : '') +
    '</div>';

  container.innerHTML = html;
}

/* ===== MATERIALS WORKED =====
 * Owner, 30 Sep 2026: "Performance under client should also show every material worked, how much and when. For eg, I
 * should be able to check how many clamps were sent by SSS Mehta in any given period, how many clamps were sent by
 * Dorabji. If two parties share the same material code, the distinction must be mentioned."
 *
 * Read off the challans (what was sent, the billing spine) and the invoices (what was billed), in a period, for this
 * client or every client. A part is its size or number and its gauge (cpPartIdentity), and always one client's: a code
 * two clients both send is two rows, each saying the other has it too. */
var _cpPeriod = '3m', _cpFrom = '', _cpTo = '', _cpQuery = '', _cpScope = 'client';
var CP_PERIODS = [['mtd', 'This month'], ['3m', '3 months'], ['6m', '6 months'], ['fy', 'This FY'], ['all', 'All'], ['custom', 'Dates']];

function cpPeriodRange() {
  var today = localDateStr(), y = +today.slice(0, 4), m = +today.slice(5, 7);
  var back = function(k) { var d = new Date(y, m - 1 - k, +today.slice(8, 10)); return isoOf(d); };
  switch (_cpPeriod) {
    case 'mtd': return { from: today.slice(0, 8) + '01', to: today, label: 'this month' };
    case '6m': return { from: back(6), to: today, label: 'the last 6 months' };
    case 'fy': { var fy = m >= 4 ? y : y - 1; return { from: fy + '-04-01', to: today, label: 'this financial year' }; }
    case 'all': return { from: '0000-01-01', to: '9999-12-31', label: 'the whole book' };
    case 'custom': {
      var f = /^\d{4}-\d{2}-\d{2}$/.test(_cpFrom) ? _cpFrom : back(3), t = /^\d{4}-\d{2}-\d{2}$/.test(_cpTo) ? _cpTo : today;
      if (t < f) { var x = f; f = t; t = x; }
      return { from: f, to: t, label: formatDate(f) + ' – ' + formatDate(t) };
    }
    default: return { from: back(3), to: today, label: 'the last 3 months' };
  }
}

/* Who sends each code, over the whole book: a code more than one client sends is named as shared on every row. */
function cpCodeOwners() {
  var out = {};
  var add = function(clientId, it) {
    var b = cpPartIdentity(it.partNumber, it.desc).base;
    if (!b) return;
    (out[b] = out[b] || {})[clientId] = true;
  };
  (S.incomingMaterial || []).forEach(function(im) { (im.items || []).forEach(function(it) { add(im.clientId, it); }); });
  (S.invoices || []).forEach(function(inv) { if (inv.status === 'active') (inv.items || []).forEach(function(it) { add(inv.clientId, it); }); });
  return out;
}

/* Every part a client (or every client) sent and was billed for in a range: pieces, kilograms, challans, invoices and
   each dated event, keyed client | size-or-number | gauge. A line naming no gauge joins its part's one gauge. */
function cpMaterials(clientId, from, to) {
  var rows = {}, clients = {};
  (S.clients || []).forEach(function(c) { clients[c.id] = c; });
  var row = function(cid, it) {
    var idn = cpPartIdentity(it.partNumber, it.desc);
    if (!idn.base) return null;
    var k = cid + '|' + idn.base + '|' + idn.gauge;
    var r = rows[k] || (rows[k] = { key: k, clientId: cid, base: idn.base, gauge: idn.gauge, name: it.partNumber || it.desc, texts: {},
      challans: {}, invoices: {}, nos: 0, kg: 0, kgUnknown: 0, billedNos: 0, billedKg: 0, revenue: 0, first: null, last: null, events: [] });
    var nm = String(it.partNumber || it.desc || '');
    if (nm.length > String(r.name).length) r.name = nm;
    r.texts[String(it.partNumber || '') + ' ' + String(it.desc || '')] = true;
    return r;
  };
  var seen = function(r, d) { if (!r.first || d < r.first) r.first = d; if (!r.last || d > r.last) r.last = d; };
  (S.incomingMaterial || []).forEach(function(im) {
    var d = im.challanDate || im.receivedDate;
    if (!d || d < from || d > to || (clientId != null && im.clientId !== clientId)) return;
    (im.items || []).forEach(function(it) {
      var r = row(im.clientId, it);
      if (!r) return;
      var q = Number(it.qty) || 0, unit = it.unit || 'KG', nos = unit === 'NOS' ? q : Number(it.nosQty) || 0;
      var w = unit === 'KG' ? { kg: q, known: q > 0 } : lineWeightKg(it, clients[im.clientId], d);
      r.nos += nos;
      if (w.known) r.kg += w.kg; else r.kgUnknown++;
      r.challans[im.id] = true; seen(r, d);
      r.events.push({ date: d, kind: 'challan', id: im.id, ref: im.challanNo || '', qty: q, unit: unit, nos: unit === 'KG' ? nos : 0 });
    });
  });
  (S.invoices || []).forEach(function(inv) {
    var d = inv.date;
    if (inv.status !== 'active' || !d || d < from || d > to || (clientId != null && inv.clientId !== clientId)) return;
    (inv.items || []).forEach(function(it) {
      var r = row(inv.clientId, it);
      if (!r) return;
      var q = Number(it.qty) || 0, unit = it.unit || 'KG';
      if (unit === 'NOS') r.billedNos += q; else { r.billedKg += q; r.billedNos += Number(it.nosQty) || 0; }
      r.revenue += Number(it.amount) || 0;
      r.invoices[inv.id] = true; seen(r, d);
      r.events.push({ date: d, kind: 'invoice', id: inv.id, ref: inv.invoiceNumber || inv.displayNumber || '', qty: q, unit: unit, amount: Number(it.amount) || 0 });
    });
  });
  // A line naming no gauge joins its part's only gauge (for that client); with two it stays apart, said as such.
  var gauges = {};
  Object.keys(rows).forEach(function(k) { var r = rows[k]; if (r.gauge) (gauges[r.clientId + '|' + r.base] = gauges[r.clientId + '|' + r.base] || []).push(r); });
  Object.keys(rows).forEach(function(k) {
    var r = rows[k], only = gauges[r.clientId + '|' + r.base];
    if (r.gauge || !only || only.length !== 1) return;
    var t = only[0];
    ['nos', 'kg', 'kgUnknown', 'billedNos', 'billedKg', 'revenue'].forEach(function(f) { t[f] += r[f]; });
    Object.keys(r.challans).forEach(function(x) { t.challans[x] = true; });
    Object.keys(r.invoices).forEach(function(x) { t.invoices[x] = true; });
    Object.keys(r.texts).forEach(function(x) { t.texts[x] = true; });
    t.events = t.events.concat(r.events);
    if (r.first && (!t.first || r.first < t.first)) t.first = r.first;
    if (r.last && (!t.last || r.last > t.last)) t.last = r.last;
    delete rows[k];
  });
  return Object.keys(rows).map(function(k) {
    var r = rows[k];
    if (r.gauge && lineGauge(r.name) !== r.gauge) r.name += ' (' + r.gauge + ')';
    else if (!r.gauge && gauges[r.clientId + '|' + r.base]) r.name += ' (gauge not stated)';
    r.clientName = clients[r.clientId] ? clients[r.clientId].name : '';
    r.nChallans = Object.keys(r.challans).length; r.nInvoices = Object.keys(r.invoices).length;
    r.events.sort(function(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : a.kind < b.kind ? -1 : 1; });
    return r;
  });
}

/* A search matches every word typed, in the part's number, size or any description it was written with. */
function cpMatches(r, q) {
  var words = String(q || '').toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  var hay = (Object.keys(r.texts).join(' ') + ' ' + r.name + ' ' + r.base).toUpperCase().replace(/[×✕*]/g, 'X');
  var fold = cpNormPart(hay);
  return words.every(function(w) { return hay.indexOf(w) >= 0 || fold.indexOf(cpNormPart(w)) >= 0; });
}

/* A count or weight with the Indian grouping (8,000 NOS; 1,23,400 kg). */
function cpNum(n, dec) { return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); }
function cpQtyText(nos, kg, kgUnknown) {
  var a = [];
  if (nos > 0) a.push(cpNum(nos) + ' NOS');
  if (kg > 0) a.push(cpNum(kg, kg < 100 ? 1 : 0) + ' kg');
  return a.join(' · ') || (kgUnknown ? 'weight unknown' : '—');
}

function cpWorkedListHtml(clientId) {
  var rg = cpPeriodRange(), owners = cpCodeOwners();
  var names = {};
  (S.clients || []).forEach(function(c) { names[c.id] = c.name; });
  var all = cpMaterials(_cpScope === 'all' ? null : clientId, rg.from, rg.to);
  var list = all.filter(function(r) { return cpMatches(r, _cpQuery); })
    .sort(function(a, b) { return (b.kg - a.kg) || (b.nos - a.nos) || (b.revenue - a.revenue); });
  var tot = { nos: 0, kg: 0, rev: 0, ch: {}, parts: list.length, clients: {} };
  list.forEach(function(r) { tot.nos += r.nos; tot.kg += r.kg; tot.rev += r.revenue; Object.keys(r.challans).forEach(function(x) { tot.ch[x] = 1; }); tot.clients[r.clientId] = 1; });
  var nCh = Object.keys(tot.ch).length;
  var h = '<div class="inv-row inv-row-strong" data-cp-worked-total><span class="inv-row-main"><span class="inv-row-title">' +
    (_cpQuery ? '&ldquo;' + escHtml(_cpQuery) + '&rdquo;' : 'Everything') + ' · ' + todoPlural(tot.parts, 'part') +
    (_cpScope === 'all' ? ' · ' + todoPlural(Object.keys(tot.clients).length, 'client') : '') + '</span>' +
    '<span class="inv-row-meta">' + todoPlural(nCh, 'challan') + ' in ' + escHtml(rg.label) + (tot.rev > 0 ? ' · ' + formatCurrency(tot.rev) + ' invoiced' : '') + '</span></span>' +
    '<span class="inv-row-end inv-num">' + escHtml(cpQtyText(tot.nos, tot.kg)) + '</span></div>';
  if (!list.length) return h + '<div class="inv-empty">' + (all.length ? 'No part matches that search in ' + escHtml(rg.label) + '.' : 'Nothing was sent or billed in ' + escHtml(rg.label) + '.') + '</div>';
  var rows = list.map(function(r) {
    var others = Object.keys(owners[r.base] || {}).filter(function(c) { return String(c) !== String(r.clientId); }).map(function(c) { return names[c] || 'another client'; });
    var meta = [todoPlural(r.nChallans, 'challan'), r.nInvoices ? todoPlural(r.nInvoices, 'invoice') : 'not invoiced',
      r.first ? (r.first === r.last ? formatDate(r.first) : formatDate(r.first) + ' – ' + formatDate(r.last)) : ''].filter(Boolean).join(' · ');
    var ev = r.events.map(function(e) {
      var what = e.kind === 'challan' ? 'Challan ' + (e.ref || '—') : 'Invoice ' + (e.ref || '');
      var q = cpNum(e.qty, e.unit === 'KG' && e.qty % 1 ? 2 : 0) + ' ' + (e.unit === 'KG' ? 'kg' : 'NOS') + (e.nos ? ' (' + cpNum(e.nos) + ' NOS)' : '');
      var act = e.kind === 'invoice' ? ' data-action="invViewInvoiceDetail" data-id="' + escHtml(e.id) + '"' : ' data-action="invHistoryJumpChallan" data-id="' + escHtml(e.id) + '"';
      return '<div class="inv-row inv-row-2"><button class="inv-row-main"' + act + '><span class="inv-row-title">' + escHtml(formatDate(e.date)) + ' · ' + escHtml(what) + '</span>' +
        '<span class="inv-row-meta">' + (e.kind === 'challan' ? 'sent' : 'billed' + (e.amount ? ' · ' + formatCurrency(e.amount) : '')) + '</span></button>' +
        '<span class="inv-row-end inv-num">' + escHtml(q) + '</span></div>';
    }).join('');
    return '<details class="inv-row-fold" data-cp-worked="' + escHtml(r.key) + '"><summary class="inv-row inv-row-2"><span class="inv-row-main">' +
      '<span class="inv-row-title inv-row-wrap"><span class="inv-id">' + escHtml(r.name) + '</span>' + (_cpScope === 'all' ? ' · ' + escHtml(r.clientName) : '') + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(meta) + '</span>' +
      (others.length ? '<span class="inv-row-meta inv-row-wrap" data-cp-shared><span class="inv-dot inv-dot-info">Code shared</span> ' +
        escHtml(others.join(', ')) + ' also ' + (others.length === 1 ? 'sends' : 'send') + ' it: counted apart, here and on Stats</span>' : '') +
      '</span><span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + escHtml(cpQtyText(r.nos, r.kg, r.kgUnknown)) + '</span>' +
      (r.revenue > 0 ? '<span class="inv-row-meta">' + formatCurrency(r.revenue) + '</span>' : '') + '</span></span></summary>' +
      '<div class="inv-row-children">' + ev + '</div></details>';
  });
  return h + uiMoreHtml('cp-worked-' + (_cpScope === 'all' ? 'all' : clientId) + '-' + _cpPeriod, rows, { n: 30, noun: 'parts' });
}

function cpWorkedHtml(clientId) {
  var seg = function(k, l, act, cur, attr) { return '<button type="button" class="inv-seg-btn" data-action="' + act + '" ' + attr + '="' + k + '" aria-pressed="' + (cur === k) + '">' + l + '</button>'; };
  var rg = cpPeriodRange();
  var h = '<div class="inv-panel inv-panel-flush" data-card="worked"><div class="inv-panel-head"><span class="inv-panel-title">Materials worked</span>' +
    '<span class="inv-note">what was sent and billed, and when</span></div><div class="inv-panel-body">' +
    '<div class="inv-seg inv-mb-8" role="group" aria-label="Period">' + CP_PERIODS.map(function(p) { return seg(p[0], p[1], 'invCpPeriod', _cpPeriod, 'data-p'); }).join('') + '</div>' +
    (_cpPeriod === 'custom' ? '<div class="inv-fields inv-mb-8" data-nodirty><label class="inv-field"><span class="inv-field-label">From</span><input type="date" class="inv-input" id="cpFrom" value="' + escHtml(rg.from) + '"></label>' +
      '<label class="inv-field"><span class="inv-field-label">To</span><input type="date" class="inv-input" id="cpTo" value="' + escHtml(rg.to) + '"></label></div>' : '') +
    '<div class="inv-toolbar inv-toolbar-flush"><label class="inv-search inv-toolbar-item">' + ICON_SEARCH +
    '<input id="cpMatSearch" type="search" value="' + escHtml(_cpQuery) + '" placeholder="Part, size or word, e.g. clamp" aria-label="Search the materials" autocomplete="off"></label>' +
    '<div class="inv-seg" role="group" aria-label="Whose">' + seg('client', 'This client', 'invCpScope', _cpScope, 'data-s') + seg('all', 'All clients', 'invCpScope', _cpScope, 'data-s') + '</div></div>' +
    '</div><div id="cpWorkedList">' + cpWorkedListHtml(clientId) + '</div></div>';
  return h;
}
/* The search redraws the list only, so the field keeps its focus and caret. */
function cpWorkedRedraw() {
  var el = document.getElementById('cpWorkedList'), id = getPerfClientId();
  if (el) el.innerHTML = cpWorkedListHtml(id != null ? id : null);
}

/* ===== BY THE HOUR =====
 * Owner, 30 Sep 2026: "Samarth part is done in pieces: 3302 at ₹9/pc takes about 30 mins, and we can only do 24 pcs at a
 * time in VAT A2; 3303 at ₹3/pc takes about 30 minutes and we can do 80 pcs at a time. This is how we can calculate its
 * impact on our cost. So there can be a different realisation and cost that is calculated on a per hour basis."
 *
 * A part plated by the round, not by the kilo, is judged by what a line-hour of it earns: pieces a round × rate ÷ the
 * round's hours, against what a line-hour costs the plant and what the plant earns in one on average. Both are the
 * plant's last 90 days spread over its line-hours: working days × 3 lines × the hours a line runs a day (16: two shifts,
 * Settings-free and said). A part's times are the client's (`client.partTimes`), set on this panel. */
var CP_LINE_HOURS_DAY = 16;
function cpLineHourRef() {
  var to = localDateStr(), from = isoAddDays(to, -90), days = statsWorkingDays(from, to);
  var inv = statsInvoices().filter(function(i) { return i.date && i.date >= from && i.date <= to; });
  var w = weighLines(inv), rev = inv.reduce(function(t, i) { return t + (i.taxableValue || 0); }, 0);
  var perKg = null, live = false;
  try { var c = liveCost(from, to, w.kg); if (c && c.perKg > 0) { perKg = c.perKg; live = true; } } catch (e) { /* the typed cost below */ }
  if (!perKg && S.defaultCostPerKg > 0) perKg = S.defaultCostPerKg;
  var hours = days * PROD_LINES.length * CP_LINE_HOURS_DAY;
  if (!(hours > 0) || !(w.kg > 0) || !perKg) return null;
  return { from: from, to: to, days: days, hours: hours, kg: w.kg, perKg: perKg, live: live, cost: perKg * w.kg / hours, revenue: rev / hours, kgPerHour: w.kg / hours };
}
function cpPartTimes(client) { return client && Array.isArray(client.partTimes) ? client.partTimes : []; }
/* The rate a timed part is billed at: its latest invoice line, else the client's piece card. */
function cpTimedRate(client, t) {
  var best = null;
  (S.invoices || []).forEach(function(inv) {
    if (inv.status !== 'active' || inv.clientId !== client.id) return;
    (inv.items || []).forEach(function(it) {
      var idn = cpPartIdentity(it.partNumber, it.desc);
      if (idn.base !== t.base || (t.gauge && idn.gauge && idn.gauge !== t.gauge)) return;
      if (!best || inv.date > best.date) best = { rate: Number(it.rate) || 0, date: inv.date, src: 'invoice ' + (inv.invoiceNumber || inv.displayNumber) };
    });
  });
  if (best && best.rate > 0) return best;
  var pr = getPieceRate(client, localDateStr(), t.name, t.name);
  return pr && pr.rate > 0 ? { rate: pr.rate, date: null, src: 'piece card' } : null;
}
function cpHoursHtml(clientId) {
  var client = (S.clients || []).find(function(c) { return c.id === clientId; });
  if (!client) return '';
  var times = cpPartTimes(client), piece = client.billingMode === 'piece' || client.billingMode === 'nos_to_weight';
  if (!times.length && !piece && !_cpTimeForm) return '';
  var ref = cpLineHourRef(), rg = cpPeriodRange();
  var h = '<div class="inv-panel inv-panel-flush" data-card="hours"><div class="inv-panel-head"><span class="inv-panel-title">By the hour</span>' +
    '<span class="inv-note">parts plated by the round</span></div>';
  if (ref) h += '<div class="inv-panel-body inv-note" data-cp-hour-ref>A line-hour costs the plant <strong class="inv-num">' + formatCurrency(ref.cost) + '</strong> and earns it <strong class="inv-num">' + formatCurrency(ref.revenue) + '</strong> on average: the last 90 days at ' +
    (ref.live ? 'the live cost' : 'the typed cost') + ' ' + formatCurrency(ref.perKg) + '/kg, ' + cpNum(ref.kg) + ' kg over ' + ref.days + ' working days × ' + PROD_LINES.length + ' lines × ' + CP_LINE_HOURS_DAY + ' hours (' + formatNum(ref.kgPerHour, 0) + ' kg a line-hour).</div>';
  else h += '<div class="inv-panel-body inv-note">No weighed billing in the last 90 days, so a line-hour has no cost to be set against yet.</div>';
  times.forEach(function(t) {
    var r = cpTimedRate(client, t);
    var perHour = r ? t.pieces * r.rate / (t.minutes / 60) : null;
    // The period's own use: pieces billed of the part, as rounds and line-hours.
    var m = cpMaterials(clientId, rg.from, rg.to).filter(function(x) { return x.base === t.base && (!t.gauge || !x.gauge || x.gauge === t.gauge); });
    var pcs = m.reduce(function(a, x) { return a + x.billedNos; }, 0), rev = m.reduce(function(a, x) { return a + x.revenue; }, 0);
    var lineHrs = t.pieces > 0 ? pcs / t.pieces * t.minutes / 60 : 0;
    var tone = perHour != null && ref ? figToneAgainst(perHour, ref.cost, 5) : null;
    h += '<div class="inv-row inv-row-auto" data-cp-time="' + escHtml(t.id) + '"><span class="inv-row-main"><span class="inv-row-title"><span class="inv-id">' + escHtml(t.name) + '</span> · ' + escHtml(prodLineName(t.line)) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(t.pieces + ' pcs a round, ' + t.minutes + ' min' + (r ? ' · ' + formatCurrency(r.rate) + '/pc (' + r.src + ')' : ' · no rate on record')) + '</span>' +
      (pcs > 0 ? '<span class="inv-row-meta inv-row-wrap">' + escHtml('In ' + rg.label + ': ' + cpNum(pcs) + ' pcs billed, ' + formatNum(lineHrs, 1) + ' line-hours of ' + prodLineName(t.line) + ' for ' + formatCurrency(rev) +
        (ref ? ', which cost about ' + formatCurrency(lineHrs * ref.cost) : '')) + '</span>' : '') +
      (tone && tone !== 'ok' && ref ? '<span class="inv-row-meta inv-row-wrap"><span class="inv-dot inv-dot-' + tone + '">' + (tone === 'danger' ? 'Below' : 'Just under') + ' what a line-hour costs</span></span>' : '') +
      '</span><span class="inv-row-end"><span class="inv-row-stack">' + (perHour != null ? figHtml(formatCurrency(perHour), tone) + '<span class="inv-row-meta">a line-hour</span>' : '<span class="inv-row-meta">—</span>') + '</span>' +
      '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invCpTimeRemove" data-id="' + escHtml(t.id) + '">Remove</button></span></div>';
  });
  if (_cpTimeForm) {
    var parts = cpMaterials(clientId, '0000-01-01', '9999-12-31').sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); });
    h += '<div class="inv-panel-body" id="cpTimeForm"><div class="inv-fields">' +
      '<label class="inv-field"><span class="inv-field-label">Part</span><select class="inv-select" id="cpTimePart"><option value="">Pick the part</option>' +
      parts.map(function(p) { return '<option value="' + escHtml(p.base + '|' + p.gauge) + '">' + escHtml(p.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="inv-field"><span class="inv-field-label">Line</span><select class="inv-select" id="cpTimeLine">' + PROD_LINES.map(function(l) { return '<option value="' + l + '"' + (l === 'vat-a2' ? ' selected' : '') + '>' + escHtml(prodLineName(l)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="inv-field"><span class="inv-field-label">Pieces a round</span><input type="number" min="1" step="1" inputmode="numeric" class="inv-input inv-input-num" id="cpTimePieces"></label>' +
      '<label class="inv-field"><span class="inv-field-label">Minutes a round</span><input type="number" min="1" step="1" inputmode="numeric" class="inv-input inv-input-num" id="cpTimeMinutes" value="30"></label></div>' +
      '<div class="inv-toolbar"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCpTimeCancel">Cancel</button><button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invCpTimeSave">Save</button></div></div>';
  } else {
    h += '<div class="inv-panel-body">' + (times.length ? '' : '<div class="inv-note inv-mb-8">No part of this client has its time a round set. A part plated by the round (so many pieces, so many minutes) is judged here by what a line-hour of it earns.</div>') +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCpTimeAdd">Add a part’s time</button></div>';
  }
  return h + '</div>';
}
var _cpTimeForm = false;
function cpTimeSave() {
  var client = (S.clients || []).find(function(c) { return c.id === getPerfClientId(); });
  var v = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
  if (!client) return;
  var key = v('cpTimePart'), pieces = parseInt(v('cpTimePieces'), 10), minutes = parseFloat(v('cpTimeMinutes'));
  if (!key) { showToast('Pick the part', 'error'); return; }
  if (!(pieces > 0)) { showToast('Enter the pieces a round', 'error'); return; }
  if (!(minutes > 0)) { showToast('Enter the minutes a round', 'error'); return; }
  var sel = document.getElementById('cpTimePart'), name = sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : key;
  var kk = key.split('|');
  if (!Array.isArray(client.partTimes)) client.partTimes = [];
  client.partTimes = client.partTimes.filter(function(t) { return !(t.base === kk[0] && (t.gauge || '') === (kk[1] || '')); });
  client.partTimes.push({ id: 'PT-' + Date.now().toString(36), base: kk[0], gauge: kk[1] || '', name: name, line: v('cpTimeLine') || 'vat-a2', pieces: pieces, minutes: minutes, at: Date.now() });
  _cpTimeForm = false;
  saveState();
  renderClientsPage();
  showToast('Time a round saved for ' + name);
}
function cpTimeRemove(id) {
  var client = (S.clients || []).find(function(c) { return c.id === getPerfClientId(); });
  if (!client || !Array.isArray(client.partTimes)) return;
  client.partTimes = client.partTimes.filter(function(t) { return t.id !== id; });
  saveState();
  renderClientsPage();
}
