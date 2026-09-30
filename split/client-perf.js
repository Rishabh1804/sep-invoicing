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
    var base = cpNormPart(rawPart);
    if (!base) return null;
    var gauge = lineGauge(it.desc) || lineGauge(it.partNumber);
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
  html += '<div class="inv-panel inv-panel-flush" data-card="materials">' +
    '<div class="inv-panel-head"><span class="inv-panel-title">Materials</span><span class="inv-note">cadence across invoices and challans</span></div>' +
    group('stopped', 'Stopped', 'danger', stopped, 'Nothing has fallen out of its rhythm.',
      'Overdue against the gap each part usually keeps, not a fixed cut-off — a quarterly part is not called stopped in month two.', renames) +
    group('new', 'New', 'info', fresh, 'Nothing new in the last ' + CP_NEW_DAYS + ' days.', '', null) +
    group('steady', 'Steady', 'ok', steady, 'No part is running to a regular cadence.', '', null) +
    (oneoff.length > 0 ? group('oneoff', 'One-off', 'neutral', oneoff, '', 'Handled once and long ago. Never had a cadence to fall out of.', null, 0) : '') +
    '</div>';

  container.innerHTML = html;
}
