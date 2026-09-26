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

function cpDaysBetween(aIso, bIso) {
  var a = new Date(aIso + 'T00:00:00'), b = new Date(bIso + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function cpMedian(nums) {
  if (nums.length === 0) return 0;
  var s = nums.slice().sort(function(a, b) { return a - b; });
  var m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* Every part this client has handled, with the dates it appeared on either
   spine, the weight and the revenue it carried. */
function cpBuildHistory(clientId) {
  var byPart = {};
  var client = S.clients.find(function(c) { return c.id === clientId; }) || null;

  function touch(rawPart, dateStr) {
    if (!dateStr) return null;
    var key = cpNormPart(rawPart);
    if (!key) return null;
    if (!byPart[key]) {
      byPart[key] = { key: key, name: rawPart, dates: {}, kg: 0, revenue: 0, invoiced: 0, received: 0 };
    }
    byPart[key].dates[dateStr] = true;
    // Keep the longest spelling seen: it is the one carrying the gauge.
    if (String(rawPart).length > String(byPart[key].name).length) byPart[key].name = rawPart;
    return byPart[key];
  }

  S.invoices.filter(function(i) { return i.status === 'active' && i.clientId === clientId; })
    .forEach(function(inv) {
      (inv.items || []).forEach(function(it) {
        var e = touch(it.partNumber || it.desc, inv.date);
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
        var e = touch(it.partNumber || it.desc, d);
        if (e) e.received++;
      });
    });

  return Object.values(byPart).map(function(e) {
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
  var sinceLast = cpDaysBetween(last, todayIso);
  var age = cpDaysBetween(first, todayIso);

  var gaps = [];
  for (var i = 1; i < d.length; i++) gaps.push(cpDaysBetween(d[i - 1], d[i]));
  var typical = cpMedian(gaps);

  var out = {
    part: entry.name, key: entry.key, kg: entry.kg, revenue: entry.revenue,
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
      var a = s.key, b = n.key;
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
  S.invoices.filter(function(i) { return i.status === 'active' && i.clientId === clientId && i.date; })
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
  // must not render as an unbroken run of bars — that silence is the finding.
  return periodKeysBetween(minDate, maxDate, 'month')
    .slice(-(months || CP_LOOKBACK_MONTHS))
    .map(function(k) {
      var r = by[k] || { month: k, revenue: 0, kg: 0, count: 0, revKnown: 0 };
      r.realisation = r.kg > 0 ? r.revKnown / r.kg : null;
      r.label = formatTrendLabel(k, 'month');
      return r;
    });
}

/* ===== VIEW ===== */
/* A material row: the part, how often and when it was last handled, and what it earned. A stopped
   part says how long it has been gone; a possible rename says so. */
function _cpMaterialRows(list, renames) {
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
  }).join('');
}

/* "+12.3% on Aug", never an arrow alone (§5.4). */
function _cpDelta(cur, prev) {
  if (!prev) return '';
  if (!isFinite(prev.v) || prev.v === 0) return 'no figure for ' + escHtml(prev.label);
  var pct = ((cur - prev.v) / Math.abs(prev.v)) * 100;
  if (Math.abs(pct) <= 0.5) return 'level with ' + escHtml(prev.label);
  return (pct > 0 ? '+' : '−') + formatNum(Math.abs(pct), 1) + '% on ' + escHtml(prev.label);
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
    '<div class="inv-panel-head inv-mb-8"><span class="inv-panel-title">Month on month <span class="inv-panel-count">last ' + monthly.length + ' month' + (monthly.length !== 1 ? 's' : '') + '</span></span></div>' +
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
      return '<div class="inv-tile"><div class="inv-tile-label">' + label + '</div><div class="inv-tile-value">' + value + '</div>' +
        (sub ? '<div class="inv-tile-sub">' + sub + '</div>' : '') + (delta ? '<div class="inv-tile-sub">' + delta + '</div>' : '') + '</div>';
    };
    var p = function(v) { return prev ? { v: v, label: prev.label } : null; };
    html += '<div class="inv-tiles inv-tiles-flush">' +
      tile('Latest month · ' + escHtml(last.label), formatCurrency(last.revenue),
        last.count + ' invoice' + (last.count !== 1 ? 's' : ''), _cpDelta(last.revenue, p(prev && prev.revenue))) +
      tile('Tonnage', formatNum(last.kg / 1000, 2) + '<span class="inv-tile-of"> t</span>', formatNum(last.kg, 0) + ' kg', _cpDelta(last.kg, p(prev && prev.kg))) +
      tile('Realisation', last.realisation != null ? formatCurrency(last.realisation) + '<span class="inv-tile-of">/kg</span>' : '&mdash;',
        (S.defaultCostPerKg > 0 ? 'cost ' + formatCurrency(S.defaultCostPerKg) + '/kg' : ''),
        (prev && prev.realisation != null && last.realisation != null) ? _cpDelta(last.realisation, p(prev.realisation)) : '') +
      // The months shown, quiet ones included: the level the latest month is read against.
      tile('Average month', formatCurrency(monthly.reduce(function(t, r) { return t + r.revenue; }, 0) / monthly.length),
        'over ' + monthly.length + ' month' + (monthly.length !== 1 ? 's' : ''), '') +
      '</div>';
  }
  html += '</div>';

  // Stopped first. It is the only one of the four that is a question.
  var group = function(key, title, tone, list, emptyText, note, renamesFor) {
    return '<div data-cp-group="' + key + '">' +
      '<div class="inv-row-group"><span class="inv-dot inv-dot-' + tone + '">' + title + ' · ' + list.length + '</span></div>' +
      (list.length === 0
        ? '<div class="inv-row"><span class="inv-row-main inv-row-meta">' + emptyText + '</span></div>'
        : (note ? '<div class="inv-row inv-row-auto"><span class="inv-row-main inv-note inv-row-wrap">' + note + '</span></div>' : '') +
          _cpMaterialRows(list, renamesFor)) +
      '</div>';
  };
  html += '<div class="inv-panel inv-panel-flush">' +
    '<div class="inv-panel-head"><span class="inv-panel-title">Materials</span><span class="inv-note">cadence across invoices and challans</span></div>' +
    group('stopped', 'Stopped', 'danger', stopped, 'Nothing has fallen out of its rhythm.',
      'Overdue against the gap each part usually keeps, not a fixed cut-off — a quarterly part is not called stopped in month two.', renames) +
    group('new', 'New', 'info', fresh, 'Nothing new in the last ' + CP_NEW_DAYS + ' days.', '', null) +
    group('steady', 'Steady', 'ok', steady, 'No part is running to a regular cadence.', '', null) +
    (oneoff.length > 0 ? group('oneoff', 'One-off', 'neutral', oneoff, '', 'Handled once and long ago. Never had a cadence to fall out of.', null) : '') +
    '</div>';

  container.innerHTML = html;
}
