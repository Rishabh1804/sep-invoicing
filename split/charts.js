/* ===== CHARTS =====
 *
 * Reusable SVG chart renderers. Pulled out of stats.js because the trend chart
 * there was one function that could draw exactly one thing: a line, stretched
 * with preserveAspectRatio="none" so circles rendered as ellipses and a wide
 * desktop got the same 400×160 drawing smeared across it. Only the two
 * endpoints were labelled and no point carried its value, so the shape was
 * readable and the numbers were not.
 *
 * Everything here draws into a square-ish viewBox at its natural aspect and is
 * sized by CSS, so the same series is legible on a 393px phone and a 1280px
 * desktop without a second code path.
 */

var CHART_SERIES_MAX = 8;

/* A round number at or above the data's peak, so the gridline labels read
   1.5L rather than 1,47,382.19. */
function chartNiceMax(v) {
  if (!(v > 0)) return 1;
  var mag = Math.pow(10, Math.floor(Math.log10(v)));
  var n = v / mag;
  var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

/* Axis and tooltip formatting per unit. Rupees get lakh/thousand shortening
   because a job-work month runs to seven figures and the axis is 40px wide. */
function chartShort(v, unit) {
  if (unit === 'kg') {
    return Math.abs(v) >= 1000 ? formatNum(v / 1000, 1) + 't' : formatNum(v, 0) + 'kg';
  }
  if (unit === 'count') return formatNum(v, 0);
  if (Math.abs(v) >= 100000) return '₹' + formatNum(v / 100000, 1) + 'L';
  if (Math.abs(v) >= 1000) return '₹' + formatNum(v / 1000, 0) + 'K';
  return '₹' + formatNum(v, 0);
}

function chartFull(v, unit) {
  if (unit === 'kg') return formatNum(v, 0) + ' kg';
  if (unit === 'count') return formatNum(v, 0);
  return formatCurrency(v);
}

/* How many x labels fit without overlapping, given the width the chart gets. */
function _chartLabelStride(n, maxLabels) {
  return Math.max(1, Math.ceil(n / (maxLabels || 6)));
}

function _chartEmpty(msg) {
  return '<div class="inv-chart-empty">' + escHtml(msg) + '</div>';
}

/* ===== TIME SERIES =====
   data: [{label, value}]. Line and bar share the frame — gridlines, axis
   labels, and a <title> on every datum so a tap or hover gives the exact
   figure the shape only approximates. */
function _chartFrame(data, unit, W, H, pad) {
  var maxVal = chartNiceMax(Math.max.apply(null, data.map(function(d) { return d.value; }).concat([0])));
  var chartW = W - pad.l - pad.r;
  var chartH = H - pad.t - pad.b;
  var svg = '';
  for (var g = 0; g <= 4; g++) {
    var gy = pad.t + (g / 4) * chartH;
    var gVal = maxVal - (g / 4) * maxVal;
    svg += '<line x1="' + pad.l + '" y1="' + gy + '" x2="' + (W - pad.r) + '" y2="' + gy + '" class="inv-svg-grid"/>';
    svg += '<text x="' + (pad.l - 4) + '" y="' + (gy + 3) + '" text-anchor="end" class="inv-svg-grid-label">' +
      escHtml(chartShort(gVal, unit)) + '</text>';
  }
  return { svg: svg, maxVal: maxVal, chartW: chartW, chartH: chartH };
}

function chartLine(data, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  if (!data || data.length === 0) return _chartEmpty(opts.emptyText || 'No data in this period');
  if (data.length < 2) return _chartEmpty('Need at least two points to show a trend');

  var W = 480, H = 220, pad = { l: 46, r: 12, t: 14, b: 30 };
  var f = _chartFrame(data, unit, W, H, pad);
  var points = data.map(function(d, i) {
    return {
      x: pad.l + (i / (data.length - 1)) * f.chartW,
      y: pad.t + f.chartH - (f.maxVal > 0 ? (d.value / f.maxVal) : 0) * f.chartH,
      d: d
    };
  });

  var line = points.map(function(p) { return p.x + ',' + p.y; }).join(' ');
  var area = 'M' + points[0].x + ',' + (pad.t + f.chartH) + ' L' + line.split(' ').join(' L') +
    ' L' + points[points.length - 1].x + ',' + (pad.t + f.chartH) + ' Z';

  // Aspect is preserved, so a circle is a circle at any width.
  var svg = '<svg class="inv-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    escHtml(opts.ariaLabel || 'Trend') + '">' + f.svg;
  svg += '<path d="' + area + '" class="inv-svg-area"/>';
  svg += '<polyline points="' + line + '" class="inv-svg-line"/>';

  var stride = _chartLabelStride(data.length, opts.maxLabels);
  points.forEach(function(p, i) {
    // Every point carries its value; the marker is what the pointer aims at.
    svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="3" class="inv-svg-dot">' +
      '<title>' + escHtml(p.d.label + ': ' + chartFull(p.d.value, unit)) + '</title></circle>';
    if (i % stride === 0 || i === points.length - 1) {
      svg += '<text x="' + p.x + '" y="' + (pad.t + f.chartH + 14) + '" text-anchor="middle" class="inv-svg-axis-label">' +
        escHtml(p.d.label) + '</text>';
    }
  });
  svg += '</svg>';
  return svg;
}

function chartBars(data, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  if (!data || data.length === 0) return _chartEmpty(opts.emptyText || 'No data in this period');

  var W = 480, H = 220, pad = { l: 46, r: 12, t: 14, b: 30 };
  var f = _chartFrame(data, unit, W, H, pad);
  var slot = f.chartW / data.length;
  var barW = Math.max(slot * 0.62, 1);

  var svg = '<svg class="inv-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    escHtml(opts.ariaLabel || 'Trend') + '">' + f.svg;

  var stride = _chartLabelStride(data.length, opts.maxLabels);
  data.forEach(function(d, i) {
    var h = f.maxVal > 0 ? (d.value / f.maxVal) * f.chartH : 0;
    var x = pad.l + i * slot + (slot - barW) / 2;
    var y = pad.t + f.chartH - h;
    svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + Math.max(h, 0) +
      '" rx="1.5" class="inv-chart-bar">' +
      '<title>' + escHtml(d.label + ': ' + chartFull(d.value, unit)) + '</title></rect>';
    if (i % stride === 0 || i === data.length - 1) {
      svg += '<text x="' + (x + barW / 2) + '" y="' + (pad.t + f.chartH + 14) +
        '" text-anchor="middle" class="inv-svg-axis-label">' + escHtml(d.label) + '</text>';
    }
  });
  svg += '</svg>';
  return svg;
}

/* ===== COMPOSITION =====
   slices: [{label, value, clientId?}]. Anything past the eighth is folded into
   one "Others" wedge rather than drawn as a sliver nobody can read or aim at —
   and the fold is named, so the chart never implies the tail does not exist. */
function chartPie(slices, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  var rows = (slices || []).filter(function(s) { return s.value > 0; })
    .sort(function(a, b) { return b.value - a.value; });
  if (rows.length === 0) return _chartEmpty(opts.emptyText || 'No data in this period');

  var shown = rows.slice(0, CHART_SERIES_MAX);
  var rest = rows.slice(CHART_SERIES_MAX);
  if (rest.length > 0) {
    shown.push({
      label: rest.length + ' others',
      value: rest.reduce(function(s, r) { return s + r.value; }, 0),
      _others: true
    });
  }
  var total = shown.reduce(function(s, r) { return s + r.value; }, 0);
  if (!(total > 0)) return _chartEmpty(opts.emptyText || 'No data in this period');

  var R = 100, CX = 105, CY = 105, inner = opts.donut === false ? 0 : 56;
  var svg = '<svg class="inv-chart-pie-svg" viewBox="0 0 210 210" role="img" aria-label="' +
    escHtml(opts.ariaLabel || 'Composition') + '">';

  var angle = -Math.PI / 2;
  shown.forEach(function(s, i) {
    var frac = s.value / total;
    var sweep = frac * Math.PI * 2;
    var end = angle + sweep;
    var cls = 'inv-chart-c' + (s._others ? 'x' : (i % CHART_SERIES_MAX));
    // A single slice covering everything cannot be drawn as an arc — the start
    // and end points coincide and the path collapses to nothing.
    if (frac >= 0.9999) {
      svg += '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" class="' + cls + '">' +
        '<title>' + escHtml(s.label + ': ' + chartFull(s.value, unit) + ' (100%)') + '</title></circle>';
    } else {
      var x1 = CX + R * Math.cos(angle), y1 = CY + R * Math.sin(angle);
      var x2 = CX + R * Math.cos(end), y2 = CY + R * Math.sin(end);
      var large = sweep > Math.PI ? 1 : 0;
      svg += '<path d="M' + CX + ',' + CY + ' L' + x1 + ',' + y1 +
        ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + x2 + ',' + y2 + ' Z" class="' + cls + '">' +
        '<title>' + escHtml(s.label + ': ' + chartFull(s.value, unit) +
          ' (' + formatNum(frac * 100, 1) + '%)') + '</title></path>';
    }
    angle = end;
  });
  if (inner > 0) svg += '<circle cx="' + CX + '" cy="' + CY + '" r="' + inner + '" class="inv-chart-hole"/>';
  svg += '</svg>';

  var legend = '<div class="inv-chart-legend">';
  shown.forEach(function(s, i) {
    var cls = 'inv-chart-c' + (s._others ? 'x' : (i % CHART_SERIES_MAX));
    var tap = (!s._others && s.clientId != null)
      ? ' data-action="invStatsClientDrill" data-client-id="' + escHtml(s.clientId) + '"' : '';
    legend += '<div class="inv-chart-legend-row"' + tap + '>' +
      '<span class="inv-chart-swatch ' + cls + '"></span>' +
      '<span class="inv-chart-legend-label">' + escHtml(s.label) + '</span>' +
      '<span class="inv-chart-legend-val inv-mono">' + escHtml(chartShort(s.value, unit)) + '</span>' +
      '<span class="inv-chart-legend-pct inv-mono">' + formatNum(s.value / total * 100, 1) + '%</span></div>';
  });
  legend += '</div>';

  return '<div class="inv-chart-pie-wrap">' + svg + legend + '</div>';
}

/* Horizontal ranked bars — the shape that suits "top N by X", where the labels
   are names rather than dates and reading them matters more than the profile. */
function chartRankedBars(rows, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  if (!rows || rows.length === 0) return _chartEmpty(opts.emptyText || 'No data in this period');
  var max = Math.max.apply(null, rows.map(function(r) { return r.value; }).concat([0]));

  var html = '<div class="inv-chart-ranked">';
  rows.forEach(function(r) {
    var pct = max > 0 ? Math.max((r.value / max) * 100, 0.5) : 0;
    var tap = r.action ? ' data-action="' + escHtml(r.action) + '" data-client-id="' + escHtml(r.clientId != null ? r.clientId : '') + '"' : '';
    html += '<div class="inv-chart-ranked-row"' + tap + '>' +
      '<div class="inv-chart-ranked-head">' +
      '<span class="inv-chart-ranked-label">' + escHtml(r.label) + '</span>' +
      '<span class="inv-chart-ranked-val inv-mono">' + escHtml(r.display || chartFull(r.value, unit)) + '</span></div>' +
      '<div class="inv-chart-ranked-track">' +
      '<svg class="inv-chart-ranked-svg" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">' +
      '<rect width="' + pct + '" height="8" rx="2" class="inv-chart-ranked-fill' +
      (r.tone ? ' inv-chart-ranked-fill-' + r.tone : '') + '"/>' +
      // A threshold line turns a bar chart of a narrow range into an answer.
      // Rates run 5.40 to 14.50 here: from a zero baseline every bar is
      // roughly half-length and the differences are invisible, but where each
      // one sits against cost is the entire question.
      (r.markPct != null ? '<rect x="' + Math.max(Math.min(r.markPct, 100), 0) +
        '" y="-1" width="0.6" height="10" class="inv-chart-ranked-mark"/>' : '') +
      '</svg></div>' +
      (r.sub ? '<div class="inv-chart-ranked-sub">' + escHtml(r.sub) + '</div>' : '') +
      '</div>';
  });
  html += '</div>';
  return html;
}

/* ===== CHARTS THAT ANSWER QUESTIONS (docs/FINANCE_INTELLIGENCE_SPEC.md, Phase 2) =====
   The functions above draw one series from a zero floor. A finance dashboard needs more:
   a balance that goes overdrawn, money in against money out on one axis, a forecast drawn as a
   range, a month's outflow stacked by category, a pie that filters what is under it, and a way to
   read a figure on a phone, where there is no hover to raise a <title>. Everything stays SVG, sized
   by CSS, tokens only; every datum still carries its <title>.

   Tap-to-read: a datum carries data-read="label: figure"; a tap writes it into the chart box's
   readout line (chartShowRead). A datum with an action of its own (a wedge that filters) keeps it,
   and its handler calls chartShowRead too. */

/* A round step either side of the data: the frame for a range that may cross zero. */
function chartNiceRange(lo, hi) {
  lo = Math.min(0, lo); hi = Math.max(0, hi);
  if (hi === lo) hi = lo + 1;
  var niceHi = hi > 0 ? chartNiceMax(hi) : 0, niceLo = lo < 0 ? -chartNiceMax(-lo) : 0;
  return { lo: niceLo, hi: niceHi };
}

function _chartBox(inner, opts) {
  return '<div class="inv-chart-box"' + (opts && opts.id ? ' id="' + escHtml(opts.id) + '"' : '') + '>' + inner +
    '<div class="inv-chart-readout" aria-live="polite">' + escHtml((opts && opts.readHint) || 'Tap a point to read it') + '</div></div>';
}
function _chartSeriesLegend(series, unit, lastOf) {
  return '<div class="inv-chart-keys">' + series.map(function(s, i) {
    var v = lastOf ? lastOf(s) : null;
    return '<span class="inv-chart-key"><span class="inv-chart-swatch inv-chart-c' + (s.tone != null ? s.tone : i) + '"></span>' + escHtml(s.label) +
      (v != null ? ' <span class="inv-mono">' + escHtml(chartShort(v, unit)) + '</span>' : '') + '</span>';
  }).join('') + '</div>';
}

/* Several series over the same labels, crossing zero when they must, with an optional band.
   labels: ['Apr', …]; series: [{label, values: [n|null], tone?}]; opts: {unit, band: [{lo, hi}|null], ariaLabel}. */
function chartLines(labels, series, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  if (!labels || labels.length < 2 || !series || !series.length) return _chartEmpty(opts.emptyText || 'Need at least two points to show a trend');
  var all = [];
  series.forEach(function(s) { s.values.forEach(function(v) { if (v != null && isFinite(v)) all.push(v); }); });
  (opts.band || []).forEach(function(b) { if (b) { all.push(b.lo); all.push(b.hi); } });
  if (!all.length) return _chartEmpty(opts.emptyText || 'No data in this period');
  var W = 480, H = 220, pad = { l: 50, r: 12, t: 14, b: 30 };
  var r = chartNiceRange(Math.min.apply(null, all), Math.max.apply(null, all));
  var cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  var x = function(i) { return pad.l + (labels.length === 1 ? cw / 2 : (i / (labels.length - 1)) * cw); };
  var y = function(v) { return pad.t + ch - ((v - r.lo) / (r.hi - r.lo)) * ch; };
  var svg = '<svg class="inv-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escHtml(opts.ariaLabel || 'Trend') + '">';
  for (var g = 0; g <= 4; g++) {
    var gv = r.hi - (g / 4) * (r.hi - r.lo), gy = y(gv);
    svg += '<line x1="' + pad.l + '" y1="' + gy + '" x2="' + (W - pad.r) + '" y2="' + gy + '" class="inv-svg-grid"/>' +
      '<text x="' + (pad.l - 4) + '" y="' + (gy + 3) + '" text-anchor="end" class="inv-svg-grid-label">' + escHtml(chartShort(gv, unit)) + '</text>';
  }
  if (r.lo < 0) svg += '<line x1="' + pad.l + '" y1="' + y(0) + '" x2="' + (W - pad.r) + '" y2="' + y(0) + '" class="inv-chart-zero"/>';
  if (opts.band) {
    var up = [], down = [];
    opts.band.forEach(function(b, i) { if (b) { up.push(x(i) + ',' + y(b.hi)); down.unshift(x(i) + ',' + y(b.lo)); } });
    if (up.length > 1) svg += '<polygon points="' + up.concat(down).join(' ') + '" class="inv-chart-band"/>';
  }
  series.forEach(function(s, si) {
    var tone = s.tone != null ? s.tone : si, pts = [];
    s.values.forEach(function(v, i) { if (v != null && isFinite(v)) pts.push([x(i), y(v), v, i]); });
    if (pts.length > 1) svg += '<polyline points="' + pts.map(function(p) { return p[0] + ',' + p[1]; }).join(' ') + '" class="inv-chart-path inv-chart-s' + tone + '"' + (s.dashed ? ' stroke-dasharray="4 3"' : '') + '/>';
    pts.forEach(function(p) {
      var read = s.label + ', ' + labels[p[3]] + ': ' + chartFull(p[2], unit);
      svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" class="inv-chart-pt inv-chart-c' + tone + '" data-action="' + escHtml(opts.pointAction || 'invChartRead') + '" data-read="' + escHtml(read) + '"' +
        ' data-key="' + escHtml(opts.keys ? opts.keys[p[3]] : labels[p[3]]) + '"' +
        '><title>' + escHtml(read) + '</title></circle>';
    });
  });
  var stride = _chartLabelStride(labels.length, opts.maxLabels);
  labels.forEach(function(l, i) {
    if (i % stride === 0 || i === labels.length - 1) svg += '<text x="' + x(i) + '" y="' + (pad.t + ch + 14) + '" text-anchor="middle" class="inv-svg-axis-label">' + escHtml(l) + '</text>';
  });
  svg += '</svg>';
  var last = function(s) { for (var i = s.values.length - 1; i >= 0; i--) if (s.values[i] != null) return s.values[i]; return null; };
  return _chartBox(svg + _chartSeriesLegend(series, unit, last), opts);
}

/* Bars per label, stacked (a whole made of parts) or grouped (two figures side by side).
   series: [{label, values: [n], tone?}]; opts: {unit, mode: 'stack'|'group', action, keys}. Values ≥ 0. */
function chartStack(labels, series, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money', group = opts.mode === 'group';
  if (!labels || !labels.length || !series || !series.length) return _chartEmpty(opts.emptyText || 'No data in this period');
  var totals = labels.map(function(_, i) {
    return group ? Math.max.apply(null, series.map(function(s) { return s.values[i] || 0; })) : series.reduce(function(t, s) { return t + (s.values[i] || 0); }, 0);
  });
  var max = Math.max.apply(null, totals.concat([0]));
  if (!(max > 0)) return _chartEmpty(opts.emptyText || 'No data in this period');
  var W = 480, H = 220, pad = { l: 50, r: 12, t: 14, b: 30 };
  var f = _chartFrame(labels.map(function(l, i) { return { label: l, value: totals[i] }; }), unit, W, H, pad);
  var slot = f.chartW / labels.length, barW = Math.max(slot * 0.62, 1);
  var svg = '<svg class="inv-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escHtml(opts.ariaLabel || 'Bars') + '">' + f.svg;
  var stride = _chartLabelStride(labels.length, opts.maxLabels);
  labels.forEach(function(l, i) {
    var x0 = pad.l + i * slot + (slot - barW) / 2, base = pad.t + f.chartH, w = group ? barW / series.length : barW;
    var key = opts.keys ? opts.keys[i] : l;
    series.forEach(function(s, si) {
      var v = s.values[i] || 0;
      if (!(v > 0)) return;
      var h = (v / f.maxVal) * f.chartH, bx = group ? x0 + si * w : x0, by = group ? base - h : base - h;
      var read = l + ', ' + s.label + ': ' + chartFull(v, unit);
      svg += '<rect x="' + bx + '" y="' + by + '" width="' + Math.max(w - (group ? 1 : 0), 1) + '" height="' + h + '" class="inv-chart-seg inv-chart-c' + (s.tone != null ? s.tone : si) + '"' +
        ' data-action="' + escHtml(opts.action || 'invChartRead') + '" data-read="' + escHtml(read) + '" data-key="' + escHtml(key) + '" data-series="' + si + '"' +
        (opts.selected != null && String(opts.selected) === String(key) ? ' aria-current="true"' : '') + '><title>' + escHtml(read) + '</title></rect>';
      if (!group) base -= h;
    });
    if (i % stride === 0 || i === labels.length - 1) svg += '<text x="' + (x0 + barW / 2) + '" y="' + (pad.t + f.chartH + 14) + '" text-anchor="middle" class="inv-svg-axis-label">' + escHtml(l) + '</text>';
  });
  svg += '</svg>';
  return _chartBox(svg + _chartSeriesLegend(series, unit, null), opts);
}

/* A pie that filters what is under it: each wedge and legend row carries data-key and the action;
   the selected wedge is pulled out along its bisector. slices: [{key, label, value}]. */
function chartPieTap(slices, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  var rows = (slices || []).filter(function(s) { return s.value > 0; }).sort(function(a, b) { return b.value - a.value; });
  if (!rows.length) return _chartEmpty(opts.emptyText || 'No data in this period');
  var shown = rows.slice(0, CHART_SERIES_MAX), rest = rows.slice(CHART_SERIES_MAX);
  if (rest.length) shown.push({ key: '__others', label: rest.length + ' others', value: rest.reduce(function(s, r) { return s + r.value; }, 0), _others: true });
  var total = shown.reduce(function(s, r) { return s + r.value; }, 0);
  var R = 96, CX = 105, CY = 105, inner = 54, angle = -Math.PI / 2, act = opts.action || 'invChartRead';
  var svg = '<svg class="inv-chart-pie-svg" viewBox="0 0 210 210" role="img" aria-label="' + escHtml(opts.ariaLabel || 'Composition') + '">';
  shown.forEach(function(s, i) {
    var frac = s.value / total, sweep = frac * Math.PI * 2, end = angle + sweep, mid = angle + sweep / 2;
    var cls = 'inv-chart-c' + (s._others ? 'x' : i), sel = opts.selected != null && String(opts.selected) === String(s.key);
    var dx = sel ? 6 * Math.cos(mid) : 0, dy = sel ? 6 * Math.sin(mid) : 0;
    var read = s.label + ': ' + chartFull(s.value, unit) + ' (' + formatNum(frac * 100, 1) + '%)';
    var attrs = ' class="inv-chart-wedge ' + cls + '" data-action="' + escHtml(act) + '" data-key="' + escHtml(s.key) + '" data-read="' + escHtml(read) + '"' + (sel ? ' aria-current="true"' : '');
    if (frac >= 0.9999) svg += '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '"' + attrs + '><title>' + escHtml(read) + '</title></circle>';
    else {
      var x1 = CX + dx + R * Math.cos(angle), y1 = CY + dy + R * Math.sin(angle), x2 = CX + dx + R * Math.cos(end), y2 = CY + dy + R * Math.sin(end);
      svg += '<path d="M' + (CX + dx) + ',' + (CY + dy) + ' L' + x1 + ',' + y1 + ' A' + R + ',' + R + ' 0 ' + (sweep > Math.PI ? 1 : 0) + ' 1 ' + x2 + ',' + y2 + ' Z"' + attrs +
        '><title>' + escHtml(read) + '</title></path>';
    }
    angle = end;
  });
  svg += '<circle cx="' + CX + '" cy="' + CY + '" r="' + inner + '" class="inv-chart-hole"/>' +
    '<text x="' + CX + '" y="' + (CY + 4) + '" text-anchor="middle" class="inv-chart-centre">' + escHtml(chartShort(total, unit)) + '</text></svg>';
  var legend = '<div class="inv-chart-legend">' + shown.map(function(s, i) {
    var sel = opts.selected != null && String(opts.selected) === String(s.key);
    return '<button type="button" class="inv-chart-legend-row" data-action="' + escHtml(act) + '" data-key="' + escHtml(s.key) + '" data-read="' + escHtml(s.label + ': ' + chartFull(s.value, unit)) + '"' +
      ' aria-pressed="' + sel + '"><span class="inv-chart-swatch inv-chart-c' + (s._others ? 'x' : i) + '"></span>' +
      '<span class="inv-chart-legend-label">' + escHtml(s.label) + '</span><span class="inv-chart-legend-val inv-mono">' + escHtml(chartShort(s.value, unit)) + '</span>' +
      '<span class="inv-chart-legend-pct inv-mono">' + formatNum(s.value / total * 100, 1) + '%</span></button>';
  }).join('') + '</div>';
  return _chartBox('<div class="inv-chart-pie-wrap">' + svg + legend + '</div>', opts);
}

/* The horizon a dashboard reads: 3 months, 6, this financial year (April on), or everything. */
var CHART_RANGES = [['3M', '3M'], ['6M', '6M'], ['FY', 'FY'], ['ALL', 'All']];
function chartRangeHtml(active, action) {
  return '<div class="inv-toolbar inv-chart-ranges" role="group" aria-label="Range">' + CHART_RANGES.map(function(r) {
    return '<button type="button" class="inv-chip" aria-pressed="' + (active === r[0]) + '" data-action="' + escHtml(action) + '" data-range="' + r[0] + '">' + r[1] + '</button>';
  }).join('') + '</div>';
}
/* The months (YYYY-MM, oldest first) a range covers, out of those with data. */
function chartRangeMonths(range, months) {
  var ms = (months || []).slice().sort();
  if (range === '3M') return ms.slice(-3);
  if (range === '6M') return ms.slice(-6);
  if (range === 'FY') {
    var t = localDateStr(), y = +t.slice(0, 4), m = +t.slice(5, 7), start = (m >= 4 ? y : y - 1) + '-04';
    return ms.filter(function(x) { return x >= start; });
  }
  return ms;
}

/* Writes a datum's figure into its chart's readout, and marks it. */
function chartShowRead(el) {
  if (!el || !el.dataset || !el.dataset.read) return;
  var box = el.closest('.inv-chart-box');
  if (!box) return;
  var out = box.querySelector('.inv-chart-readout');
  if (out) out.textContent = el.dataset.read;
  box.querySelectorAll('.inv-chart-read-on').forEach(function(n) { n.classList.remove('inv-chart-read-on'); });
  el.classList.add('inv-chart-read-on');
}
