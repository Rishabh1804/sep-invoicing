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
  // What the floor plated of it, each with its line and crew (owner, 30 Sep 2026: "we'll know who plated what and when …
  // useful when we get replating issues"). Shown among the part's events; the figures above stay what was sent and billed.
  if (typeof prodIndex === 'function') {
    var pidx = prodIndex();
    pidx.counted.forEach(function(e) {
      var d = e.date;
      if (e.voidedAt || !d || d < from || d > to || e.clientId == null || (clientId != null && String(e.clientId) !== String(clientId))) return;
      var shown = prodAliasShown ? prodAliasShown(e) : null;
      var r = row(e.clientId, { partNumber: shown && shown.pn ? shown.pn : (e.partNumber || e.part), desc: e.part });
      if (!r) return;
      var crew = prodCrew(e);
      r.plated = (r.plated || 0) + 1;
      r.events.push({ date: d, kind: 'plated', id: e.id, ref: prodLineName(e.line), qty: e.qty || 0, unit: e.unit || 'NOS', crew: crew, rework: !!e.rework, time: e.time || '' });
    });
  }
  // A line naming no gauge joins its part's only gauge (for that client); with two it stays apart, said as such.
  var gauges = {};
  Object.keys(rows).forEach(function(k) { var r = rows[k]; if (r.gauge) (gauges[r.clientId + '|' + r.base] = gauges[r.clientId + '|' + r.base] || []).push(r); });
  Object.keys(rows).forEach(function(k) {
    var r = rows[k], only = gauges[r.clientId + '|' + r.base];
    if (r.gauge || !only || only.length !== 1) return;
    var t = only[0];
    ['nos', 'kg', 'kgUnknown', 'billedNos', 'billedKg', 'revenue'].forEach(function(f) { t[f] += r[f]; });
    t.plated = (t.plated || 0) + (r.plated || 0);
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
    '<span class="inv-row-meta inv-row-wrap">' + todoPlural(nCh, 'challan') + ' in ' + escHtml(rg.label) + (tot.rev > 0 ? ' · ' + formatCurrency(tot.rev) + ' invoiced' : '') + '</span></span>' +
    '<span class="inv-row-end inv-num">' + escHtml(cpQtyText(tot.nos, tot.kg)) + '</span></div>';
  if (!list.length) return h + '<div class="inv-empty">' + (all.length ? 'No part matches that search in ' + escHtml(rg.label) + '.' : 'Nothing was sent or billed in ' + escHtml(rg.label) + '.') + '</div>';
  var rows = list.map(function(r) {
    var others = Object.keys(owners[r.base] || {}).filter(function(c) { return String(c) !== String(r.clientId); }).map(function(c) { return names[c] || 'another client'; });
    var meta = [todoPlural(r.nChallans, 'challan'), r.nInvoices ? todoPlural(r.nInvoices, 'invoice') : 'not invoiced', r.plated ? todoPlural(r.plated, 'plating') : '',
      r.first ? (r.first === r.last ? formatDate(r.first) : formatDate(r.first) + ' – ' + formatDate(r.last)) : ''].filter(Boolean).join(' · ');
    var ev = r.events.map(function(e) {
      if (e.kind === 'plated') {
        return '<div class="inv-row inv-row-2" data-cp-plated><span class="inv-row-main"><span class="inv-row-title">' + escHtml(formatDate(e.date)) + ' · Plated on ' + escHtml(e.ref) + (e.time ? ' from ' + escHtml(e.time) : '') + (e.rework ? ' · rework' : '') + '</span>' +
          '<span class="inv-row-meta inv-row-wrap">' + escHtml(e.crew.known ? (e.crew.src === 'block' ? 'OT crew: ' : 'Crew: ') + e.crew.names.join(', ') : 'Crew not known: ' + e.crew.why) + '</span></span>' +
          '<span class="inv-row-end inv-num">' + escHtml(cpNum(e.qty) + ' ' + (e.unit === 'KG' ? 'kg' : 'NOS')) + '</span></div>';
      }
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
 * impact on our cost." And then: "have an option to update the time taken to pickle and plate + a constant 15 mins
 * (logistics + other steps) for every material. Fill these out with the production data we already have and make sure
 * the app learns from the data being entered, so we can evaluate if the time taken is increasing or decreasing, and what
 * steps we can take to optimise setups."
 *
 * A round of a part takes pickling + plating + the constant for logistics and the other steps (Settings-free, on this
 * panel, `S.perfCfg.overheadMin`, 15). Each is the owner's figure where set on the client (`client.partTimes`), else what
 * the production record measures (`cpMeasure`): the register's round-by-round times on the line (the gap from one round
 * to the next, 5 to 180 minutes) or a START–END batch's span over its rounds; the pickling hand's loads (the gap to the
 * next load that day, 5 to 120 minutes, per piece). What a round earns (pieces × the rate) over its whole time is set
 * against what an hour costs the plant and earns it on average: the last 90 days at the live cost, over working days × 3
 * lines × 16 hours (`cpLineHourRef`). The measured times are kept by week, so a round getting slower or faster shows. */
var CP_LINE_HOURS_DAY = 16;
function cpOverheadMin() { var v = S.perfCfg && S.perfCfg.overheadMin; return typeof v === 'number' && v >= 0 ? v : 15; }
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
/* A set time's plating minutes: `plateMin`, or `minutes` as the first times were saved. */
function cpPlateSet(t) { return t.plateMin != null ? t.plateMin : t.minutes != null ? t.minutes : null; }

/* What the production record says about one part of one client: every plating round with its minutes and pieces, every
   pickling load with its minutes a piece, by date. Only live entries that were not corrected. */
function cpMeasure(clientId, base, gauge) {
  var idx = prodIndex(), plate = [], pickle = [], byDay = {};
  var mine = function(e) {
    if (e.clientId == null || String(e.clientId) !== String(clientId)) return false;
    var idn = cpPartIdentity(e.partNumber || e.part, e.part);
    return idn.base === base && (!gauge || !idn.gauge || idn.gauge === gauge);
  };
  // A time as the register or a message wrote it: 9:20, 09.20, 2:05 PM.
  var mm = function(t) {
    var m = /^\s*(\d{1,2})[:.](\d{2})\s*([AP])?\.?M?\.?\s*$/i.exec(String(t || ''));
    if (!m) return null;
    var h = +m[1] % 12 + (m[3] && m[3].toUpperCase() === 'P' ? 12 : 0);
    if (!m[3]) h = +m[1];
    return h * 60 + +m[2];
  };
  // Round to round across noon written on a 12-hour clock (12:45 then 1:05) is twenty minutes, not minus eleven hours.
  var gapOf = function(a, b) { var d = b - a; return d < 0 && d > -720 ? d + 720 : d; };
  idx.live.forEach(function(e) {
    if (idx.replaced[e.id]) return;
    if (e.kind === 'pickled' && e.time) (byDay[e.date] = byDay[e.date] || []).push(e);
    if (e.kind !== 'plated' || !mine(e) || e.rework) return;
    var rs = (e.rounds || []).filter(function(r) { return !r.struck && !r.start && r.time; });
    var batch = rs.filter(function(r) { return r.batch && r.n > 0; });
    if (batch.length && e.time && e.to) {
      // A START–END batch: its span over its rounds.
      var span = gapOf(mm(e.time), mm(e.to)), n = batch.reduce(function(a, r) { return a + r.n; }, 0), rack = batch[0].rack || (batch[0].qty && n ? batch[0].qty / n : null);
      if (span > 0 && n > 0 && span / n >= 5 && span / n <= 180) plate.push({ date: e.date, line: e.line, min: span / n, pcs: rack });
      return;
    }
    rs = rs.filter(function(r) { return !r.batch; }).map(function(r) { return { m: mm(r.time), q: r.qty }; }).filter(function(r) { return r.m != null; });
    for (var i = 0; i + 1 < rs.length; i++) {
      var d = gapOf(rs[i].m, rs[i + 1].m);
      if (d >= 5 && d <= 180) plate.push({ date: e.date, line: e.line, min: d, pcs: rs[i].q > 0 ? rs[i].q : null });
    }
  });
  // Pickling: the gap from a load to the pickling hand's next load that day, over the load's pieces.
  Object.keys(byDay).forEach(function(d) {
    var list = byDay[d].map(function(e) { return { e: e, m: mm(e.time) }; }).filter(function(x) { return x.m != null; }).sort(function(a, b) { return a.m - b.m; });
    for (var i = 0; i + 1 < list.length; i++) {
      var x = list[i], gap = list[i + 1].m - x.m;
      if (!mine(x.e) || !(x.e.qty > 0) || x.e.unit === 'KG' || gap < 5 || gap > 120) continue;
      pickle.push({ date: d, perPc: gap / x.e.qty, pcs: x.e.qty, min: gap });
    }
  });
  return { plate: plate, pickle: pickle };
}
/* The measure read: the median round and pieces over the last 90 days (all of it when the 90 days hold under three),
   pickling as minutes a piece × the round's pieces, and the trend: the median of the last 30 days against the 60 before. */
function cpMeasured(ms) {
  var today = localDateStr(), since = isoAddDays(today, -90), mid = isoAddDays(today, -30);
  var recent = function(list) { var r = list.filter(function(o) { return o.date >= since; }); return r.length >= 3 ? r : list; };
  var pl = recent(ms.plate), pk = recent(ms.pickle);
  var pcsList = pl.map(function(o) { return o.pcs; }).filter(function(v) { return v > 0; });
  var out = { plateMin: pl.length ? numMedian(pl.map(function(o) { return o.min; })) : null, pcs: pcsList.length ? numMedian(pcsList) : null,
    pcsMax: pcsList.length ? Math.max.apply(null, pcsList) : null, nPlate: ms.plate.length, nPickle: ms.pickle.length,
    pickPerPc: pk.length ? numMedian(pk.map(function(o) { return o.perPc; })) : null, first: null, last: null };
  ms.plate.concat(ms.pickle).forEach(function(o) { if (!out.first || o.date < out.first) out.first = o.date; if (!out.last || o.date > out.last) out.last = o.date; });
  var a = ms.plate.filter(function(o) { return o.date >= mid; }), b = ms.plate.filter(function(o) { return o.date < mid && o.date >= since; });
  if (a.length >= 3 && b.length >= 3) { out.trendNow = numMedian(a.map(function(o) { return o.min; })); out.trendBefore = numMedian(b.map(function(o) { return o.min; })); }
  // By week, for the chart: the median round of each pay week with a round in it.
  var wk = {};
  ms.plate.forEach(function(o) { var k = attWeekStartOf(o.date); (wk[k] = wk[k] || []).push(o.min); });
  out.weeks = Object.keys(wk).sort().slice(-12).map(function(k) { return { week: k, min: numMedian(wk[k]) }; });
  return out;
}
/* The rate a part is billed at: its latest invoice line (and its unit), else the client's piece card. */
function cpTimedRate(client, t) {
  var best = null;
  (S.invoices || []).forEach(function(inv) {
    if (inv.status !== 'active' || inv.clientId !== client.id) return;
    (inv.items || []).forEach(function(it) {
      var idn = cpPartIdentity(it.partNumber, it.desc);
      if (idn.base !== t.base || (t.gauge && idn.gauge && idn.gauge !== t.gauge)) return;
      if (!best || inv.date > best.date) best = { rate: Number(it.rate) || 0, unit: it.unit || 'KG', date: inv.date, src: 'invoice ' + (inv.invoiceNumber || inv.displayNumber), part: it.partNumber, desc: it.desc };
    });
  });
  if (best && best.rate > 0) return best;
  var pr = getPieceRate(client, localDateStr(), t.name, t.name);
  return pr && pr.rate > 0 ? { rate: pr.rate, unit: 'NOS', date: null, src: 'piece card' } : null;
}
/* One part's round, as used: each figure the owner's where set, else measured, and where it came from. */
function cpRound(client, t) {
  var m = cpMeasured(cpMeasure(client.id, t.base, t.gauge));
  var pick = function(set, meas) { return set != null && set !== '' ? { v: +set, src: 'set' } : meas != null ? { v: meas, src: 'measured' } : { v: null, src: null }; };
  var pcs = pick(t.pieces, m.pcs != null ? Math.round(m.pcs) : null);
  var plate = pick(cpPlateSet(t), m.plateMin != null ? Math.round(m.plateMin) : null);
  var pickle = pick(t.pickleMin, m.pickPerPc != null && pcs.v ? Math.round(m.pickPerPc * pcs.v) : null);
  var over = cpOverheadMin();
  var total = plate.v != null ? plate.v + (pickle.v || 0) + over : null;
  var r = cpTimedRate(client, t);
  // A kilo rate is turned into a round's worth with the part's kilograms a piece.
  var perRound = null;
  if (r && pcs.v) {
    if (r.unit === 'NOS') perRound = pcs.v * r.rate;
    else { var kpp = prodKgPerPiece(client.id, localDateStr(), r.part || t.name, r.desc || t.name); if (kpp && kpp.kg > 0) perRound = pcs.v * kpp.kg * r.rate; }
  }
  return { m: m, pcs: pcs, plate: plate, pickle: pickle, over: over, total: total, rate: r, perRound: perRound, perHour: perRound != null && total ? perRound / (total / 60) : null };
}
/* What to look at, read off the numbers: a slower round, racks run short of their fullest, the fixed steps' share of a
   round, pickling slower than plating, and a set figure the record no longer bears out. */
function cpRoundHints(rd, t) {
  var h = [], m = rd.m;
  if (m.trendNow != null && m.trendBefore > 0) {
    var ch = (m.trendNow - m.trendBefore) / m.trendBefore;
    if (ch >= 0.1) h.push({ tone: 'warning', text: 'Plating a round takes ' + Math.round(m.trendNow) + ' min in the last 30 days against ' + Math.round(m.trendBefore) + ' before (+' + Math.round(ch * 100) + '%). Look at the jig loading, the bath (current, temperature, concentration) and waits between rounds.' });
    else if (ch <= -0.1) h.push({ tone: 'ok', text: 'Plating a round is faster: ' + Math.round(m.trendNow) + ' min in the last 30 days against ' + Math.round(m.trendBefore) + ' before (' + Math.round(ch * 100) + '%). Worth keeping whatever changed.' });
  }
  if (m.pcs && m.pcsMax && m.pcs < m.pcsMax * 0.9 && rd.total) {
    var gain = (m.pcsMax / m.pcs - 1);
    h.push({ tone: 'info', text: 'Rounds carry ' + Math.round(m.pcs) + ' pieces at the median against ' + m.pcsMax + ' at their fullest: full racks would earn about ' + Math.round(gain * 100) + '% more an hour on the same time.' });
  }
  if (rd.total && rd.over / rd.total >= 0.25) h.push({ tone: 'info', text: 'Logistics and the other steps are ' + Math.round(rd.over / rd.total * 100) + '% of every round (' + rd.over + ' of ' + Math.round(rd.total) + ' min): running this part in longer lots, with the next load staged before the round ends, spreads it thinner.' });
  if (rd.pickle.v && rd.plate.v && rd.pickle.v > rd.plate.v) h.push({ tone: 'warning', text: 'Pickling a round (' + rd.pickle.v + ' min) takes longer than plating it (' + rd.plate.v + ' min): the line waits on pickling. Pickle the next load while this one plates.' });
  if (t && cpPlateSet(t) != null && m.plateMin != null && m.nPlate >= 5 && Math.abs(m.plateMin - cpPlateSet(t)) / cpPlateSet(t) > 0.15)
    h.push({ tone: 'warning', text: 'The record now measures ' + Math.round(m.plateMin) + ' min a round against the ' + cpPlateSet(t) + ' set.', use: true });
  return h;
}
function cpSrcWord(x) { return x.src === 'set' ? 'set' : x.src === 'measured' ? 'measured' : 'not known'; }
function cpRoundRowHtml(client, t, ref, rg, auto) {
  var rd = cpRound(client, t), tone = rd.perHour != null && ref ? figToneAgainst(rd.perHour, ref.cost, 5) : null;
  var fig = function(x, unit) { return x.v != null ? x.v + (unit || '') + ' (' + cpSrcWord(x) + ')' : '? (' + cpSrcWord(x) + ')'; };
  var breakdown = 'Pickle ' + fig(rd.pickle, ' min') + ' + plate ' + fig(rd.plate, ' min') + ' + ' + rd.over + ' min logistics and other steps' + (rd.total ? ' = ' + Math.round(rd.total) + ' min a round' : '');
  var mat = cpMaterials(client.id, rg.from, rg.to).filter(function(x) { return x.base === t.base && (!t.gauge || !x.gauge || x.gauge === t.gauge); });
  var pcs = mat.reduce(function(a, x) { return a + x.billedNos; }, 0), rev = mat.reduce(function(a, x) { return a + x.revenue; }, 0);
  var hrs = rd.pcs.v > 0 && rd.total ? pcs / rd.pcs.v * rd.total / 60 : 0;
  var hints = cpRoundHints(rd, auto ? null : t);
  var id = auto ? 'auto-' + t.base + '|' + t.gauge : t.id;
  var h = '<details class="inv-row-fold" data-cp-time="' + escHtml(id) + '"><summary class="inv-row inv-row-2"><span class="inv-row-main">' +
    '<span class="inv-row-title"><span class="inv-id">' + escHtml(t.name) + '</span>' + (t.line ? ' · ' + escHtml(prodLineName(t.line)) : '') + (auto ? ' · <span class="inv-note">from the record</span>' : '') + '</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml(fig(rd.pcs, ' pcs') + ' a round · ' + breakdown) + '</span>' +
    (hints.length ? '<span class="inv-row-meta inv-row-wrap"><span class="inv-dot inv-dot-' + hints[0].tone + '">' + todoPlural(hints.length, 'thing', 'things') + ' to look at</span></span>' : '') +
    '</span><span class="inv-row-end"><span class="inv-row-stack">' + (rd.perHour != null ? figHtml(formatCurrency(rd.perHour), tone) + '<span class="inv-row-meta">an hour</span>' : '<span class="inv-row-meta">—</span>') + '</span></span></summary>' +
    '<div class="inv-panel-body">';
  h += '<div class="inv-row-meta inv-row-wrap">' + escHtml((rd.rate ? formatCurrency(rd.rate.rate) + '/' + (rd.rate.unit === 'NOS' ? 'pc' : 'kg') + ' (' + rd.rate.src + ')' : 'No rate on record') +
    (rd.perRound != null ? ' · ' + formatCurrency(rd.perRound) + ' a round' : '') +
    (ref && rd.perHour != null ? ' · an hour of the plant costs ' + formatCurrency(ref.cost) + ' and earns ' + formatCurrency(ref.revenue) : '')) + '</div>';
  h += '<div class="inv-row-meta inv-row-wrap" data-cp-measured>' + escHtml('The record: ' + (rd.m.nPlate ? rd.m.nPlate + ' plating round' + (rd.m.nPlate === 1 ? '' : 's') + ' timed' : 'no plating round timed') +
    ', ' + (rd.m.nPickle ? rd.m.nPickle + ' pickling load' + (rd.m.nPickle === 1 ? '' : 's') : 'no pickling load') + ' timed' + (rd.m.first ? ', ' + formatDate(rd.m.first) + ' – ' + formatDate(rd.m.last) : '') +
    '. The times fill in as the register photos and pickling messages come in.') + '</div>';
  if (pcs > 0) h += '<div class="inv-row-meta inv-row-wrap">' + escHtml('In ' + rg.label + ': ' + cpNum(pcs) + ' pcs billed, about ' + formatNum(hrs, 1) + ' hours of rounds for ' + formatCurrency(rev) + (ref ? ', which cost the plant about ' + formatCurrency(hrs * ref.cost) : '')) + '</div>';
  if (rd.m.weeks.length >= 2) h += chartLines(rd.m.weeks.map(function(w) { return formatDate(w.week).slice(0, 6); }), [{ label: 'Minutes a round', values: rd.m.weeks.map(function(w) { return Math.round(w.min); }) }], { unit: 'min', ariaLabel: 'Plating minutes a round by week' });
  hints.forEach(function(x) {
    h += '<div class="inv-callout inv-callout-' + (x.tone === 'ok' ? 'ok' : x.tone === 'warning' ? 'warning' : 'info') + ' inv-mt-8">' + escHtml(x.text) +
      (x.use && !auto ? ' <button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCpTimeUseMeasured" data-id="' + escHtml(t.id) + '">Use ' + Math.round(rd.m.plateMin) + ' min</button>' : '') + '</div>';
  });
  h += '<div class="inv-toolbar inv-mt-8">' + (auto
    ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCpTimeAdd" data-key="' + escHtml(t.base + '|' + t.gauge) + '">Set its times</button>'
    : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCpTimeEdit" data-id="' + escHtml(t.id) + '">Edit</button><button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invCpTimeRemove" data-id="' + escHtml(t.id) + '">Remove</button>') + '</div>';
  return h + '</div></details>';
}
function cpHoursHtml(clientId) {
  var client = (S.clients || []).find(function(c) { return c.id === clientId; });
  if (!client) return '';
  var times = cpPartTimes(client), piece = client.billingMode === 'piece' || client.billingMode === 'nos_to_weight';
  // Parts the production record has timed rounds for, not yet set: learnt from the record, listed after the set ones.
  var setKeys = {}; times.forEach(function(t) { setKeys[t.base + '|' + (t.gauge || '')] = 1; });
  var auto = cpMaterials(clientId, '0000-01-01', '9999-12-31').filter(function(p) { return !setKeys[p.base + '|' + p.gauge]; })
    .map(function(p) { return { base: p.base, gauge: p.gauge, name: p.name, n: cpMeasure(clientId, p.base, p.gauge).plate.length }; })
    .filter(function(p) { return p.n >= 2; }).sort(function(a, b) { return b.n - a.n; }).slice(0, 8);
  if (!times.length && !piece && !auto.length && !_cpTimeForm) return '';
  var ref = cpLineHourRef(), rg = cpPeriodRange();
  var h = '<div class="inv-panel inv-panel-flush" data-card="hours"><div class="inv-panel-head"><span class="inv-panel-title">By the hour</span>' +
    '<span class="inv-note">pickle + plate + ' + cpOverheadMin() + ' min a round</span></div>';
  h += '<div class="inv-panel-body inv-note" data-cp-hour-ref>' + (ref ? 'An hour costs the plant <strong class="inv-num">' + formatCurrency(ref.cost) + '</strong> and earns it <strong class="inv-num">' + formatCurrency(ref.revenue) + '</strong> on average: the last 90 days at ' +
    (ref.live ? 'the live cost' : 'the typed cost') + ' ' + formatCurrency(ref.perKg) + '/kg, ' + cpNum(ref.kg) + ' kg over ' + ref.days + ' working days × ' + PROD_LINES.length + ' lines × ' + CP_LINE_HOURS_DAY + ' hours.'
    : 'No weighed billing in the last 90 days, so an hour has no cost to be set against yet.') +
    ' <label data-nodirty>Logistics and other steps, every round <input type="number" min="0" step="1" class="inv-input inv-input-sm inv-input-num" id="cpOverhead" value="' + cpOverheadMin() + '" aria-label="Minutes of logistics and other steps a round"> min</label></div>';
  times.forEach(function(t) { h += cpRoundRowHtml(client, t, ref, rg, false); });
  auto.forEach(function(t) { h += cpRoundRowHtml(client, t, ref, rg, true); });
  if (_cpTimeForm) {
    var f = typeof _cpTimeForm === 'object' ? _cpTimeForm : {};
    var parts = cpMaterials(clientId, '0000-01-01', '9999-12-31').sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); });
    var ms = f.key ? cpMeasured(cpMeasure(clientId, f.key.split('|')[0], f.key.split('|')[1] || '')) : null;
    var ph = function(v) { return v != null ? ' placeholder="' + Math.round(v) + ' measured"' : ''; };
    h += '<div class="inv-panel-body" id="cpTimeForm" data-nodirty><div class="inv-fields">' +
      '<label class="inv-field"><span class="inv-field-label">Part</span><select class="inv-select" id="cpTimePart"' + (f.id ? ' disabled' : '') + '><option value="">Pick the part</option>' +
      parts.map(function(p) { var k = p.base + '|' + p.gauge; return '<option value="' + escHtml(k) + '"' + (f.key === k ? ' selected' : '') + '>' + escHtml(p.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="inv-field"><span class="inv-field-label">Line</span><select class="inv-select" id="cpTimeLine">' + PROD_LINES.map(function(l) { return '<option value="' + l + '"' + ((f.line || 'vat-a2') === l ? ' selected' : '') + '>' + escHtml(prodLineName(l)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="inv-field"><span class="inv-field-label">Pieces a round</span><input type="number" min="1" step="1" inputmode="numeric" class="inv-input inv-input-num" id="cpTimePieces" value="' + (f.pieces != null ? f.pieces : '') + '"' + ph(ms && ms.pcs) + '></label>' +
      '<label class="inv-field"><span class="inv-field-label">Pickling, minutes a round</span><input type="number" min="0" step="1" inputmode="numeric" class="inv-input inv-input-num" id="cpTimePickle" value="' + (f.pickleMin != null ? f.pickleMin : '') + '"' + ph(ms && ms.pickPerPc && ms.pcs ? ms.pickPerPc * ms.pcs : null) + '></label>' +
      '<label class="inv-field"><span class="inv-field-label">Plating, minutes a round</span><input type="number" min="1" step="1" inputmode="numeric" class="inv-input inv-input-num" id="cpTimePlate" value="' + (f.plateMin != null ? f.plateMin : '') + '"' + ph(ms && ms.plateMin) + '></label></div>' +
      '<div class="inv-note">Leave a figure blank to use what the production record measures.</div>' +
      '<div class="inv-toolbar"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCpTimeCancel">Cancel</button><button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invCpTimeSave">Save</button></div></div>';
  } else {
    h += '<div class="inv-panel-body">' + (times.length || auto.length ? '' : '<div class="inv-note inv-mb-8">No part of this client has its round timed yet, set or in the production record. A part plated by the round is judged here by what an hour of it earns.</div>') +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCpTimeAdd">Set a part’s times</button></div>';
  }
  return h + '</div>';
}
var _cpTimeForm = false;
function cpTimeFormOpen(key, id) {
  var client = (S.clients || []).find(function(c) { return c.id === getPerfClientId(); });
  var t = id && client ? cpPartTimes(client).find(function(x) { return x.id === id; }) : null;
  _cpTimeForm = t ? { id: t.id, key: t.base + '|' + (t.gauge || ''), line: t.line, pieces: t.pieces, pickleMin: t.pickleMin, plateMin: cpPlateSet(t) } : { key: key || '' };
  renderClientsPage();
}
function cpTimeSave() {
  var client = (S.clients || []).find(function(c) { return c.id === getPerfClientId(); });
  var v = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
  if (!client) return;
  var f = typeof _cpTimeForm === 'object' ? _cpTimeForm : {};
  var key = f.id ? f.key : v('cpTimePart');
  var num = function(id, min) { var x = v(id); if (String(x).trim() === '') return null; var n = parseFloat(x); return isNaN(n) || n < min ? NaN : n; };
  var pieces = num('cpTimePieces', 1), pickleMin = num('cpTimePickle', 0), plateMin = num('cpTimePlate', 1);
  if (!key) { showToast('Pick the part', 'error'); return; }
  if ([pieces, pickleMin, plateMin].some(function(x) { return x !== null && isNaN(x); })) { showToast('Enter whole minutes and pieces, or leave them blank', 'error'); return; }
  var sel = document.getElementById('cpTimePart'), name = sel && sel.selectedOptions[0] && sel.value ? sel.selectedOptions[0].textContent : key;
  var kk = key.split('|');
  if (!Array.isArray(client.partTimes)) client.partTimes = [];
  var old = client.partTimes.find(function(t) { return t.base === kk[0] && (t.gauge || '') === (kk[1] || ''); });
  client.partTimes = client.partTimes.filter(function(t) { return t !== old; });
  var rec = { id: old ? old.id : 'PT-' + Date.now().toString(36), base: kk[0], gauge: kk[1] || '', name: old ? old.name : name, line: v('cpTimeLine') || 'vat-a2', at: Date.now() };
  if (pieces != null) rec.pieces = pieces;
  if (pickleMin != null) rec.pickleMin = pickleMin;
  if (plateMin != null) rec.plateMin = plateMin;
  // What the figures were before, so a change of time is on record.
  if (old) rec.history = (old.history || []).concat([{ at: old.at || null, pieces: old.pieces, pickleMin: old.pickleMin, plateMin: cpPlateSet(old) }]);
  client.partTimes.push(rec);
  _cpTimeForm = false;
  saveState();
  renderClientsPage();
  showToast('Times saved for ' + rec.name);
}
function cpTimeUseMeasured(id) {
  var client = (S.clients || []).find(function(c) { return c.id === getPerfClientId(); });
  var t = client ? cpPartTimes(client).find(function(x) { return x.id === id; }) : null;
  if (!t) return;
  var m = cpMeasured(cpMeasure(client.id, t.base, t.gauge));
  if (m.plateMin == null) return;
  t.history = (t.history || []).concat([{ at: t.at || null, pieces: t.pieces, pickleMin: t.pickleMin, plateMin: cpPlateSet(t) }]);
  t.plateMin = Math.round(m.plateMin); delete t.minutes; t.at = Date.now();
  saveState();
  renderClientsPage();
  showToast('Plating set to ' + t.plateMin + ' min a round, as measured');
}
function cpTimeRemove(id) {
  var client = (S.clients || []).find(function(c) { return c.id === getPerfClientId(); });
  if (!client || !Array.isArray(client.partTimes)) return;
  client.partTimes = client.partTimes.filter(function(t) { return t.id !== id; });
  saveState();
  renderClientsPage();
}
function cpSetOverhead(v) {
  var n = parseFloat(v);
  if (isNaN(n) || n < 0) return;
  S.perfCfg = Object.assign({}, S.perfCfg || {}, { overheadMin: n });
  saveState();
  renderClientsPage();
}
