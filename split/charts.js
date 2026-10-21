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
 *
 * UI pass 3 (docs/UI_PASS_3.md §5, 16 Oct 2026): every builder draws the same marks (one axis; bars at most 24 units thick,
 * their data end rounded and square where they stand; lines 2; dots 8 across with a 2-unit ring in the surface colour;
 * hairline gridlines; the axes and every word in text tokens); a series wears a colour by its slot, never by its rank
 * (seriesSlot, §3d); every datum can be read (a <title> for a hover, data-read for a tap); every chart stands in a box whose
 * readout line carries Table, the same data as a table; eight builders more (chartDiverging, chartHistogram, chartDots,
 * chartScatter, chartHeat, chartDumbbell, chartStack100, chartRing) and the least squares behind a scatter (chartFit).
 */

/* The six series colours (§3d): a seventh thing is Other, never a seventh hue. */
var CHART_SLOTS = 6;
/* The marks, in the drawing's own units (a drawing is sized by CSS and its marks scale with it): a bar at most this thick, the
   gap of the card's surface between two marks that would touch, a dot's radius (8 across; its 2-unit ring is CSS's). */
var CHART_BAR_MAX = 24, CHART_GAP = 2, CHART_DOT_R = 4;

/* A round number at or above the data's peak, so the gridline labels read
   1.5L rather than 1,47,382.19. */
function chartNiceMax(v) {
  if (!(v > 0)) return 1;
  var mag = Math.pow(10, Math.floor(Math.log10(v)));
  var n = v / mag;
  // Steps that split into four clean gridlines: jumping 1 → 2 drew a ₹10.3L peak on a ₹20L frame, half empty.
  var steps = [1, 1.2, 1.6, 2, 2.4, 3, 4, 6, 8, 10];
  var step = steps.find(function(x) { return n <= x + 1e-9; }) || 10;
  return step * mag;
}

/* Axis, key and legend formatting per unit. Rupees get the Indian compact form (formatInrShort)
   because a job-work month runs to seven figures and the axis is 40px wide; a <title> and a
   readout carry chartFull's exact figure. */
function chartShort(v, unit) {
  // The sign leads the currency: −₹25.0K, not ₹-25.0K (U+2212, §5.4).
  if (v < 0) return '\u2212' + chartShort(-v, unit);
  if (unit === 'kg') {
    return Math.abs(v) >= 1000 ? formatNum(v / 1000, 1) + 't' : formatNum(v, 0) + 'kg';
  }
  if (unit === 'count') return formatNum(v, 0);
  if (unit === 'pct') return formatNum(v, 0) + '%';
  if (unit === 'rate') return '₹' + formatNum(v, 2);
  if (unit === 'h') return formatNum(v, 0) + 'h';
  if (unit === 'min') return formatNum(v, 0) + 'm';
  // Money in the Indian compact form (state.js): ₹12.5K, ₹8.4L, ₹12.0Cr.
  return formatInrShort(v);
}

function chartFull(v, unit) {
  if (unit === 'kg') return formatNum(v, 0) + ' kg';
  if (unit === 'count') return formatNum(v, 0);
  if (unit === 'pct') return formatNum(v, 1) + '%';
  if (unit === 'rate') return formatCurrency(v) + '/kg';
  if (unit === 'h') return formatNum(v, 1) + ' h';
  if (unit === 'min') return formatNum(v, 0) + ' min';
  return formatCurrency(v);
}
/* A figure with its sign said: + above zero, − below (U+2212, §5.4), for a chart whose sign is the point (chartDiverging). */
function _chartSigned(v, unit) { return (v > 0 ? '+' : v < 0 ? '\u2212' : '') + chartFull(Math.abs(v), unit); }
/* A coordinate to the hundredth: the drawing's attributes stay short. */
function _chartN(v) { return Math.round(v * 100) / 100; }

/* How many x labels fit without overlapping, given the width the chart gets. */
function _chartLabelStride(n, maxLabels, ends) {
  var s = Math.max(1, Math.ceil(n / (maxLabels || 6)));
  // ends: the first stride at or over it that lands on the last label too (13 months at three labels: Sep, Mar, Sep, never Jul
  // beside the last), where one exists.
  if (ends) for (var t = s; t < n - 1; t++) if ((n - 1) % t === 0) return t;
  return s;
}

/* An x-axis label, centred under its datum unless that would run it past the drawing's edge: the last label
   of a line chart sits on the right edge and was cut in half ("26 No"), so an end label is anchored inward instead.
   The width is estimated from the axis face (mono, --plot-fs-axis 9 units, about 0.62 of that a character). */
function _chartXLabel(x, y, label, W, cls) {
  var half = String(label).length * 2.8, anchor = 'middle', at = x;
  if (x + half > W - 2) { anchor = 'end'; at = W - 2; }
  else if (x - half < 2) { anchor = 'start'; at = 2; }
  return '<text x="' + at + '" y="' + y + '" text-anchor="' + anchor + '" class="' + (cls || 'inv-chart-axis') + '">' + escHtml(label) + '</text>';
}

/* ===== THE PERIOD TO DATE (the tab map, TM6b; design §6.17) =====
   The survey found the month so far plotted as a collapse: a period not yet ended drawn like a whole one. `opts.toDate` names its
   point or bar (its index): a line runs into it dashed, a bar or point is drawn lighter, its label reads "to date" and its title says
   so. chartToDateAt finds the current period among a chart's keys. */
function _chartToDate(opts, n) { var i = opts ? opts.toDate : null; return i != null && i >= 0 && i < n ? i : null; }
function chartToDateLabel(label) { return String(label) + ' to date'; }
function chartToDateAt(keys, cur) { var i = (keys || []).indexOf(cur); return i >= 0 ? i : null; }
/* Whether label i is drawn: on its stride, the last and the period to date always, and never one inside the room the to-date
   label takes (it is longer). xs: each label's x. */
function _chartLabelShown(i, n, stride, td, xs, labels) {
  if (i !== td && !(i % stride === 0 || i === n - 1)) return false;
  if (td == null || i === td) return true;
  var room = (String(labels[td]).length + 8) * 2.8 + String(labels[i]).length * 2.8 + 4;
  return Math.abs(xs[i] - xs[td]) >= room;
}
/* The x labels of an evenly spaced axis, thinned by stride, the period to date's always kept. */
function _chartXLabels(labels, xs, td, y, W, maxLabels, ends) {
  var stride = _chartLabelStride(labels.length, maxLabels, ends), s = '';
  labels.forEach(function(l, i) { if (_chartLabelShown(i, labels.length, stride, td, xs, labels)) s += _chartXLabel(xs[i], y, l, W); });
  return s;
}

/* Nothing to draw: the one set of blank states (uiBlankHtml, state.js; docs/UI_PASS_3.md §7c, §14b), small, in the chart's own
   words where its caller gave them (`emptyText`). 'early': something is there, too little to draw (one point of a trend). */
function _chartEmpty(msg, kind) {
  return uiBlankHtml({ kind: kind || 'empty', small: true, title: msg || 'Nothing to draw yet' });
}

/* ===== SERIES AND STATUS COLOURS (docs/UI_PASS_3.md §3d) =====
   Six series colours say which thing a line or a bar is, always in one order and never by rank. A series (or a slice, or a row)
   names its colour one of three ways: `slot` (1 to 6, or 'other'; seriesSlot gives a thing its own), `tone` (a status, said only
   where the colour judges: ok, warning, danger, info, neutral) or the slot 'one' (the accent: the period on show or the thing
   picked, set against the rest in 'other', which is the accent marking what is selected). With none, a series takes its place
   in its caller's list, the first slot 1: the order the caller wrote, not a rank. A numeric tone, an index into the eight colours
   of v2.0 (0 was the accent's place), still reads as the slot after it, and 'x' as Other.
   Each is a class setting the mark's ink (--ink, styles.css), which the stroke, the fill and a legend's swatch all read. */
var CHART_TONES = { ok: 'ok', good: 'ok', warning: 'warning', danger: 'danger', info: 'info', neutral: 'neutral' };
function chartSlotClass(slot) {
  if (slot === 'one') return 'inv-chart-one';
  var n = Number(slot);
  return n >= 1 && n <= CHART_SLOTS && n === Math.floor(n) ? 'inv-chart-s' + n : 'inv-chart-other';
}
function chartInk(s, i) {
  if (s && s.slot != null) return chartSlotClass(s.slot);
  var t = s && s.tone != null ? String(s.tone) : null;
  if (t != null) {
    if (CHART_TONES[t]) return 'inv-chart-' + CHART_TONES[t];
    if (t === 'one') return 'inv-chart-one';
    if (/^\d+$/.test(t)) return chartSlotClass(Number(t) + 1);
    return 'inv-chart-other';
  }
  return chartSlotClass((i || 0) + 1);
}

/* Which series colour a thing wears, the same on every chart (§3d): a colour follows the thing, never its rank on one chart, so a
   filter that hides one never repaints the rest. kind:
   - 'client': the six clients with the most kilos plated over the whole book hold slots 1 to 6, by Stats' own weighing
     (statsInvoices, weighLines);
   - 'supplier', 'stock' (a stock line): the six with the most spend over the book, by the suppliers' bills (suppIndex) and each
     line's purchases (stockPattern); a supplier is found by its id or by any of its names;
   - fixed orders: 'line' (VAT A1, VAT A2, barrel), 'cost' (a live cost's parts), 'area' (the shop's order: VAT A1, VAT A2, barrel,
     pickling, office and gate, civil), 'bankcat' (money out by the bank's category, a SELF draw's key 'wages:cash': wages in
     labour's slot, suppliers in the supplies', electricity in its own as on a cost chart, then cash wages, GST and income tax;
     bank charges, a returned cheque and anything else are Other).
   Returns 1 to 6, or 'other'. Worked out once a book: a save moves _bookWrites, a new book is a new S. */
var SERIES_FIXED = {
  line: { 'vat-a1': 1, 'vat-a2': 2, barrel: 3 },
  cost: { labour: 1, zinc: 2, chem: 3, chemicals: 3, power: 4, other: 5 },
  area: { 'vat-a1': 1, 'vat-a2': 2, barrel: 3, pickling: 4, 'pickling-vat': 4, 'pickling-barrel': 4, office: 5, gate: 5, civil: 6 },
  bankcat: { wages: 1, supplier: 2, 'wages:cash': 3, power: 4, gst: 5, tax: 6 }
};
var _seriesSlots = null;
/* The six largest, a slot each; ties by id, so the order is the same on every device. */
function _seriesRank(list) {
  var out = {};
  list.filter(function(x) { return x.v > 0; }).sort(function(a, b) {
    if (b.v !== a.v) return b.v - a.v;
    var na = Number(a.id), nb = Number(b.id);
    if (isFinite(na) && isFinite(nb)) return na - nb;
    return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
  }).slice(0, CHART_SLOTS).forEach(function(x, i) { out[String(x.id)] = i + 1; });
  return out;
}
function _seriesSlotsOf(kind) {
  var w = typeof _bookWrites === 'number' ? _bookWrites : 0;
  if (!_seriesSlots || _seriesSlots.s !== S || _seriesSlots.w !== w) _seriesSlots = { s: S, w: w, m: {} };
  var m = _seriesSlots.m;
  if (m[kind]) return m[kind];
  var list = [];
  if (kind === 'client') {
    var by = {};
    statsInvoices().forEach(function(inv) { if (inv.clientId != null) (by[inv.clientId] = by[inv.clientId] || []).push(inv); });
    list = Object.keys(by).map(function(id) { return { id: id, v: weighLines(by[id]).kg }; });
  } else if (kind === 'supplier') {
    list = suppIndex().list.map(function(sp) { return { id: sp.id, v: sp.bills.reduce(function(t, b) { return t + (b.base || 0); }, 0) }; });
  } else if (kind === 'stock') {
    list = stockData().items.map(function(it) { return { id: it.id, v: stockPattern(it).suppliers.reduce(function(t, x) { return t + (x.spent || 0); }, 0) }; });
  }
  m[kind] = _seriesRank(list);
  return m[kind];
}
function seriesSlot(kind, id) {
  if (id == null || id === '') return 'other';
  if (SERIES_FIXED[kind]) return SERIES_FIXED[kind][String(id)] || 'other';
  var slots;
  try { slots = _seriesSlotsOf(kind); } catch (e) { return 'other'; }
  var key = String(id);
  if (kind === 'supplier' && !slots[key] && typeof suppOfName === 'function') {
    var sp = suppOfName(key);
    if (sp) key = String(sp.id);
  }
  return slots[key] || 'other';
}

/* ===== THE BOX, ITS READOUT AND THE TABLE BEHIND IT (§5; the owner's ruling 6, item 7) =====
   Every chart stands in one box: its drawing, the same data as a table behind it, and the readout line. A tap on a datum writes
   its exact figure into the readout (a phone has no hover; chartShowRead); Table swaps the drawing for its table and back, in
   place, nothing redrawn (chartTableToggle; events.js runs a pressed control in keepScroll). A sparkline or a meter inside a
   tile is the tile's figure drawn, not a chart: its numbers are the tile's title, and it has no box.
   table: {cols: [{label, unit}], rows: [[label, figure, …]]}, the builder's own columns: its label, then one a series, in its
   unit. */
function _chartBox(inner, opts, table) {
  opts = opts || {};
  if (opts.bare) return inner.replace(/<svg class="(inv-chart-svg|inv-chart-heat)"/, '<svg class="$1 inv-chart-bare"');
  var t = table && table.rows && table.rows.length ? table : null;
  return '<div class="inv-chart-box"' + (opts.id ? ' id="' + escHtml(opts.id) + '"' : '') + ' data-table="off"><div class="inv-chart-draw">' + inner + '</div>' +
    (t ? '<div class="inv-chart-table" hidden>' + chartTableHtml(t.cols, t.rows) + '</div>' : '') +
    '<div class="inv-chart-readline"><div class="inv-chart-readout" aria-live="polite">' + escHtml(opts.readHint || 'Tap a point to read it') + '</div>' +
    (t ? '<button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invChartTable" aria-pressed="false">Table</button>' : '') + '</div></div>';
}
/* A chart in a card is bare (docs/UI_PASS_3.md §24d): no box, no readout line and no Table, each datum keeping its <title> with
   its exact figure, drawn at the room the card leaves it (opts.w × opts.h, widgets.js wdgVizDraw), so its viewBox is the card's own
   pixels and every label it draws reads at 11px (.inv-chart-bare). The card's Open reaches the screen behind, which keeps the
   chart's table; its verdict says in words what the chart shows. */
function _chartWH(opts, W, H) { return opts && opts.bare && opts.w > 0 && opts.h > 0 ? { W: Math.round(opts.w), H: Math.round(opts.h) } : { W: W, H: H }; }
/* The table: the label column, then a column a series, each figure as chartFull writes it in its column's unit ('text' for
   words; `signed` says the sign, + or −, as a chart whose sign is the point reads it); a figure the chart has none for is a
   dash, never a zero. It scrolls sideways in its box when it is wide. */
function chartTableHtml(cols, rows) {
  cols = cols || [];
  var head = '<tr>' + cols.map(function(c, i) {
    return '<th scope="col"' + (i && c.unit !== 'text' ? ' class="inv-num"' : '') + '>' + escHtml(c.label || '') + '</th>';
  }).join('') + '</tr>';
  var body = (rows || []).map(function(r) {
    return '<tr>' + cols.map(function(c, i) {
      var v = r[i];
      if (i === 0 || c.unit === 'text') return '<td>' + escHtml(v == null ? '' : v) + '</td>';
      return '<td class="inv-num">' + (v == null || !isFinite(v) ? '&mdash;' : escHtml(c.signed ? _chartSigned(Number(v), c.unit) : chartFull(Number(v), c.unit))) + '</td>';
    }).join('') + '</tr>';
  }).join('');
  return '<div class="inv-scroll-x"><table class="inv-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
}
function chartTableToggle(btn) {
  var box = btn && btn.closest ? btn.closest('.inv-chart-box') : null;
  if (!box) return false;
  var draw = box.querySelector(':scope > .inv-chart-draw'), table = box.querySelector(':scope > .inv-chart-table');
  if (!draw || !table) return false;
  var on = btn.getAttribute('aria-pressed') !== 'true';
  draw.hidden = on;
  table.hidden = !on;
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  box.setAttribute('data-table', on ? 'on' : 'off');
  return true;
}

/* The keys under a drawing (identity never by colour alone): each series' swatch in the shape of its mark (a short stroke for a
   line, dashed for a dashed one, a dot for a dot, a square for a bar or a wedge), its name, and where given its last figure. */
function _chartSeriesLegend(series, unit, lastOf, shape) {
  return '<div class="inv-chart-keys">' + series.map(function(s, i) {
    var v = lastOf ? lastOf(s) : null;
    var sh = shape === 'line' ? (s.dashed ? ' inv-chart-swatch-dash' : ' inv-chart-swatch-line') : shape === 'dot' ? ' inv-chart-swatch-dot' : '';
    return '<span class="inv-chart-key"><span class="inv-chart-swatch' + sh + ' ' + (s.ink || chartInk(s, i)) + '"></span>' + escHtml(s.label) +
      (v != null ? ' <span class="inv-num">' + escHtml(chartShort(v, unit)) + '</span>' : '') + '</span>';
  }).join('') + '</div>';
}

/* A datum of the builders below: its mark in a group that carries the read and a hit area larger than the mark (a finger aims
   at the column, not at a 2-unit stroke), the figure in its <title> for a hover. hit: a rect {x, y, w, h}, or SVG of its own. */
function _chartDatum(read, inner, hit, o) {
  o = o || {};
  var h = typeof hit === 'string' ? hit : hit ? '<rect class="inv-chart-hit" x="' + _chartN(hit.x) + '" y="' + _chartN(hit.y) + '" width="' + _chartN(Math.max(hit.w, 0)) + '" height="' + _chartN(Math.max(hit.h, 0)) + '"/>' : '';
  return '<g class="inv-chart-datum" data-action="' + escHtml(o.action || 'invChartRead') + '" data-read="' + escHtml(read) + '"' +
    (o.key != null ? ' data-key="' + escHtml(o.key) + '"' : '') + '><title>' + escHtml(read) + '</title>' + h + inner + '</g>';
}

/* ===== TIME SERIES =====
   data: [{label, value}]. Line and bar share the frame — gridlines, axis
   labels, and a <title> on every datum so a tap or hover gives the exact
   figure the shape only approximates. */
function _chartFrame(data, unit, W, H, pad, top) {
  var peak = Math.max.apply(null, data.map(function(d) { return d.value; }).filter(function(v) { return v != null && isFinite(v); }).concat([0]));
  var maxVal = top > 0 ? top : chartNiceMax(peak);
  var chartW = W - pad.l - pad.r;
  var chartH = H - pad.t - pad.b;
  var svg = '';
  for (var g = 0; g <= 4; g++) {
    var gy = pad.t + (g / 4) * chartH;
    var gVal = maxVal - (g / 4) * maxVal;
    svg += '<line x1="' + pad.l + '" y1="' + gy + '" x2="' + (W - pad.r) + '" y2="' + gy + '" class="inv-chart-grid"/>';
    // A series of zeros has no scale: its frame is a nominal 0 to 1, and labelling those lines read ₹1 ₹1 ₹1 ₹0.
    if (peak > 0 || g === 4) svg += '<text x="' + (pad.l - 4) + '" y="' + (gy + 3) + '" text-anchor="end" class="inv-chart-grid-label">' +
      escHtml(chartShort(gVal, unit)) + '</text>';
  }
  return { svg: svg, maxVal: maxVal, chartW: chartW, chartH: chartH };
}
/* A frame for counts: four whole steps at or above the peak, so no gridline reads 4.5 as 5 (a step of 1 to 10, then a round one). */
function _chartCountMax(peak) {
  var q = Math.max(1, peak / 4);
  return (q <= 10 ? Math.ceil(q - 1e-9) : _chartFitStep(q)) * 4;
}
/* Five hairlines over a range that may cross zero, each labelled (a frame of nothing but zeros labels its zero alone), and the
   zero rule where the range crosses it, or always (`zero`). y: a value's height in the drawing. */
function _chartGridRange(r, unit, W, pad, y, zeros, zero) {
  var s = '';
  for (var g = 0; g <= 4; g++) {
    var gv = r.hi - (g / 4) * (r.hi - r.lo), gy = _chartN(y(gv));
    s += '<line x1="' + pad.l + '" y1="' + gy + '" x2="' + (W - pad.r) + '" y2="' + gy + '" class="inv-chart-grid"/>' +
      (zeros && Math.abs(gv) > 1e-9 ? '' : '<text x="' + (pad.l - 4) + '" y="' + _chartN(gy + 3) + '" text-anchor="end" class="inv-chart-grid-label">' + escHtml(chartShort(gv, unit)) + '</text>');
  }
  if (zero || (r.lo < 0 && r.hi > 0)) s += '<line x1="' + pad.l + '" y1="' + _chartN(y(0)) + '" x2="' + (W - pad.r) + '" y2="' + _chartN(y(0)) + '" class="inv-chart-zero"/>';
  return s;
}

function chartLine(data, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  if (!data || data.length === 0) return _chartEmpty(opts.emptyText);
  if (data.length < 2) return _chartEmpty('Need at least two points to show a trend', 'early');

  var WH = _chartWH(opts, 480, 220), W = WH.W, H = WH.H, pad = { l: 46, r: 12, t: 14, b: 30 };
  var f = _chartFrame(data, unit, W, H, pad);
  var points = data.map(function(d, i) {
    return {
      x: pad.l + (i / (data.length - 1)) * f.chartW,
      y: pad.t + f.chartH - (f.maxVal > 0 ? (d.value / f.maxVal) : 0) * f.chartH,
      d: d
    };
  });
  // One against the rest (§3d): a stretch chosen above a longer trend (opts.span, the period on show) is the accent's and the rest
  // of the line Other; else the line is one series, in its slot (1 unless the caller names one).
  var span = opts.span, inSpan = function(i) { return !!span && i >= span.i0 && i <= span.i1; };
  var ink = span ? 'inv-chart-other' : chartInk({ slot: opts.slot, tone: opts.tone }, 0);

  var line = points.map(function(p) { return p.x + ',' + p.y; }).join(' ');
  var area = 'M' + points[0].x + ',' + (pad.t + f.chartH) + ' L' + line.split(' ').join(' L') +
    ' L' + points[points.length - 1].x + ',' + (pad.t + f.chartH) + ' Z';

  // Aspect is preserved, so a circle is a circle at any width.
  var svg = '<svg class="inv-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    escHtml(opts.ariaLabel || 'Trend') + '">' + f.svg;
  // opts.span {i0, i1}: a stretch of the points shaded behind the line (the period chosen above a longer trend), in the accent.
  if (span) {
    var half = f.chartW / (data.length - 1) / 2;
    var sx0 = Math.max(pad.l, points[span.i0].x - half), sx1 = Math.min(W - pad.r, points[span.i1].x + half);
    svg += '<rect x="' + sx0 + '" y="' + pad.t + '" width="' + (sx1 - sx0) + '" height="' + f.chartH + '" class="inv-chart-band inv-chart-one" data-span/>';
  }
  svg += '<path d="' + area + '" class="inv-chart-area ' + ink + '"/>';
  // A period not yet ended (opts.toDate): the line runs into it, and out of it, dashed.
  var td = _chartToDate(opts, data.length), pts = function(list) { return list.map(function(p) { return p.x + ',' + p.y; }).join(' '); };
  if (td == null) svg += '<polyline points="' + line + '" class="inv-chart-line ' + ink + '"/>';
  else {
    if (td > 1) svg += '<polyline points="' + pts(points.slice(0, td)) + '" class="inv-chart-line ' + ink + '"/>';
    svg += '<polyline points="' + pts(points.slice(Math.max(0, td - 1), td + 2)) + '" class="inv-chart-line ' + ink + ' inv-chart-todate" data-todate/>';
    if (td < points.length - 2) svg += '<polyline points="' + pts(points.slice(td + 1)) + '" class="inv-chart-line ' + ink + '"/>';
  }

  var stride = _chartLabelStride(data.length, opts.maxLabels);
  var labels = data.map(function(d, i) { return i === td ? chartToDateLabel(d.label) : d.label; }), xs = points.map(function(p) { return p.x; });
  points.forEach(function(p, i) {
    // Every point carries its value; the marker is what the pointer aims at, and a tap reads it out.
    var read = labels[i] + ': ' + chartFull(p.d.value, unit);
    svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + CHART_DOT_R + '" class="inv-chart-dot ' + (inSpan(i) ? 'inv-chart-one' : ink) + (i === td ? ' inv-chart-todate' : '') + '"' +
      ' data-action="invChartRead" data-read="' + escHtml(read) + '"><title>' + escHtml(read) + '</title></circle>';
    if (_chartLabelShown(i, points.length, stride, td, xs, labels)) {
      svg += _chartXLabel(p.x, pad.t + f.chartH + 14, labels[i], W);
    }
  });
  svg += '</svg>';
  return _chartBox(svg, opts, { cols: [{ label: opts.labelHead || '' }, { label: opts.valueHead || opts.ariaLabel || 'Value', unit: unit }],
    rows: data.map(function(d, i) { return [labels[i], d.value]; }) });
}

function chartBars(data, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  if (!data || data.length === 0) return _chartEmpty(opts.emptyText);

  var WH = _chartWH(opts, 480, 220), W = WH.W, H = WH.H, pad = { l: 46, r: 12, t: 14, b: 30 };
  // opts.top: the frame's ceiling where the scale has one (a percentage's 100), else the nice maximum over the bars.
  var f = _chartFrame(data, unit, W, H, pad, opts.top);
  var slot = f.chartW / data.length;
  var barW = Math.min(Math.max(slot * 0.62, 1), CHART_BAR_MAX);
  // One against the rest (§3d): with a stretch chosen (opts.span) its bars are the accent's and the rest Other; else one series.
  var span = opts.span, ink = chartInk({ slot: opts.slot, tone: opts.tone }, 0);
  var inkOf = function(i) { return span ? (i >= span.i0 && i <= span.i1 ? 'inv-chart-one' : 'inv-chart-other') : ink; };

  var svg = '<svg class="inv-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    escHtml(opts.ariaLabel || 'Trend') + '">' + f.svg;
  // opts.span {i0, i1}: the slots of a stretch of bars shaded behind them, as chartLine does.
  if (span) svg += '<rect x="' + (pad.l + span.i0 * slot) + '" y="' + pad.t + '" width="' + ((span.i1 - span.i0 + 1) * slot) +
    '" height="' + f.chartH + '" class="inv-chart-band inv-chart-one" data-span/>';

  var stride = _chartLabelStride(data.length, opts.maxLabels), td = _chartToDate(opts, data.length);
  var labels = data.map(function(d, i) { return i === td ? chartToDateLabel(d.label) : d.label; });
  // The axis says "to date" unless the bar's hatch says it (a card's, below); its title and readout always do.
  var axis = data.map(function(d, i) { return opts.bare && i === td && d.value != null && isFinite(d.value) ? d.label : labels[i]; });
  var xs = data.map(function(d, i) { return pad.l + i * slot + slot / 2; });
  data.forEach(function(d, i) {
    var h = f.maxVal > 0 ? (d.value / f.maxVal) * f.chartH : 0;
    var x = pad.l + i * slot + (slot - barW) / 2;
    var y = pad.t + f.chartH - h;
    var read = labels[i] + ': ' + chartFull(d.value, unit), ink = d.tone != null && !span ? chartInk({ tone: d.tone }, 0) : inkOf(i);
    // A datum with no figure (null) is a gap, not a zero: no bar, its label kept. A period not yet ended is drawn lighter, or on a
    // card (opts.bare) hatched in its own ink, edged in it (the card family's to date, as the small bars and the meter draw it): a
    // class's fill outranks the attribute, so that bar is no inv-chart-bar and its stripes are the pattern's. The data end is
    // rounded (inv-chart-up), the foot square on the baseline.
    if (d.value != null && isFinite(d.value) && opts.bare && i === td) {
      var pid = 'invBarHatch' + (++_chartBarsN);
      svg += '<defs><pattern id="' + pid + '" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><rect class="inv-chart-stripe ' + ink +
        '" x="0" y="0" width="1.5" height="4"/></pattern></defs><rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + Math.max(h, 0) +
        '" class="inv-chart-hatched inv-chart-up ' + ink + ' inv-chart-todate" fill="url(#' + pid + ')" data-todate data-action="invChartRead" data-read="' + escHtml(read) +
        '"><title>' + escHtml(read) + '</title></rect>';
    } else if (d.value != null && isFinite(d.value)) svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + Math.max(h, 0) +
      '" class="inv-chart-bar inv-chart-up ' + ink + (i === td ? ' inv-chart-todate' : '') + '"' + (i === td ? ' data-todate' : '') +
      ' data-action="invChartRead" data-read="' + escHtml(read) + '"><title>' + escHtml(read) + '</title></rect>';
    if (_chartLabelShown(i, data.length, stride, td, xs, axis)) {
      svg += _chartXLabel(x + barW / 2, pad.t + f.chartH + 14, axis[i], W);
    }
  });
  // opts.mark {value, label}: a rule across the bars at a level they are judged against (attendance's gate at 90%), its label at
  // its right end over it; a reference, never a datum.
  var mk = opts.mark;
  if (mk && mk.value != null && f.maxVal > 0 && mk.value <= f.maxVal) {
    var my = _chartN(pad.t + f.chartH - mk.value / f.maxVal * f.chartH);
    svg += '<line class="inv-chart-mark" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + my + '" y2="' + my + '"/>' +
      '<text class="inv-chart-mark-label" x="' + (W - pad.r) + '" y="' + _chartN(my - 4) + '" text-anchor="end">' + escHtml((mk.label ? mk.label + ' ' : '') + chartShort(mk.value, unit)) + '</text>';
  }
  svg += '</svg>';
  return _chartBox(svg, Object.assign({ readHint: 'Tap a bar to read it' }, opts), { cols: [{ label: opts.labelHead || '' }, { label: opts.valueHead || opts.ariaLabel || 'Value', unit: unit }],
    rows: data.map(function(d, i) { return [labels[i], d.value]; }) });
}

/* ===== COMPOSITION =====
   slices: [{label, value, clientId?, slot?|tone?}]. A slice that names its colour keeps it (seriesSlot: a client's colour on
   every chart), and those in Other come last, so the tail is visibly a tail. A pie of slices that name none colours them in
   order of size up to the six series colours and folds the rest into one "N others" wedge rather than slivers nobody can read
   or aim at — and the fold is named, so the chart never implies the tail does not exist. */
function _chartPieFold(rows, othersKey) {
  if (rows.some(function(s) { return s.slot != null || s.tone != null; })) {
    var other = function(s) { return chartInk(s, 0) === 'inv-chart-other'; };
    return rows.filter(function(s) { return !other(s); }).concat(rows.filter(other));
  }
  var shown = rows.slice(0, CHART_SLOTS).map(function(s, i) { return Object.assign({}, s, { slot: i + 1 }); });
  var tail = rows.slice(CHART_SLOTS);
  if (tail.length === 1) shown.push(Object.assign({}, tail[0], { slot: 'other' }));
  else if (tail.length) shown.push({ key: othersKey, label: tail.length + ' others', value: tail.reduce(function(s, r) { return s + r.value; }, 0), slot: 'other', _others: true });
  return shown;
}
function chartPie(slices, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  var rows = (slices || []).filter(function(s) { return s.value > 0; })
    .sort(function(a, b) { return b.value - a.value; });
  if (rows.length === 0) return _chartEmpty(opts.emptyText);

  var shown = _chartPieFold(rows, '__others');
  var total = shown.reduce(function(s, r) { return s + r.value; }, 0);
  if (!(total > 0)) return _chartEmpty(opts.emptyText);

  var R = 100, CX = 105, CY = 105, inner = opts.donut === false ? 0 : 56;
  var svg = '<svg class="inv-chart-pie-svg" viewBox="0 0 210 210" role="img" aria-label="' +
    escHtml(opts.ariaLabel || 'Composition') + '">';

  var angle = -Math.PI / 2;
  shown.forEach(function(s, i) {
    var frac = s.value / total;
    var sweep = frac * Math.PI * 2;
    var end = angle + sweep;
    var cls = 'inv-chart-wedge ' + chartInk(s, i);
    var read = s.label + ': ' + chartFull(s.value, unit) + ' (' + formatNum(frac * 100, 1) + '%)';
    var attrs = ' class="' + cls + '" data-action="invChartRead" data-read="' + escHtml(read) + '"';
    // A single slice covering everything cannot be drawn as an arc — the start
    // and end points coincide and the path collapses to nothing.
    if (frac >= 0.9999) {
      svg += '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '"' + attrs + '><title>' + escHtml(read) + '</title></circle>';
    } else {
      var x1 = CX + R * Math.cos(angle), y1 = CY + R * Math.sin(angle);
      var x2 = CX + R * Math.cos(end), y2 = CY + R * Math.sin(end);
      var large = sweep > Math.PI ? 1 : 0;
      svg += '<path d="M' + CX + ',' + CY + ' L' + x1 + ',' + y1 +
        ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + x2 + ',' + y2 + ' Z"' + attrs + '><title>' + escHtml(read) + '</title></path>';
    }
    angle = end;
  });
  if (inner > 0) svg += '<circle cx="' + CX + '" cy="' + CY + '" r="' + inner + '" class="inv-chart-hole"/>';
  svg += '</svg>';

  var legend = '<div class="inv-chart-legend">';
  shown.forEach(function(s, i) {
    var tap = (!s._others && s.clientId != null)
      ? ' data-action="invStatsClientDrill" data-client-id="' + escHtml(s.clientId) + '"' : '';
    legend += '<div class="inv-chart-legend-row"' + tap + '>' +
      '<span class="inv-chart-swatch ' + chartInk(s, i) + '"></span>' +
      '<span class="inv-chart-legend-label">' + escHtml(s.label) + '</span>' +
      '<span class="inv-chart-legend-val inv-num">' + escHtml(chartShort(s.value, unit)) + '</span>' +
      '<span class="inv-chart-legend-pct inv-num">' + formatNum(s.value / total * 100, 1) + '%</span></div>';
  });
  legend += '</div>';

  return _chartBox('<div class="inv-chart-pie-wrap">' + svg + legend + '</div>', Object.assign({ readHint: 'Tap a slice to read it' }, opts),
    { cols: [{ label: opts.labelHead || '' }, { label: opts.valueHead || 'Value', unit: unit }, { label: 'Share', unit: 'pct' }],
      rows: shown.map(function(s) { return [s.label, s.value, s.value / total * 100]; }) });
}

/* Horizontal ranked bars — the shape that suits "top N by X", where the labels
   are names rather than dates and reading them matters more than the profile.
   opts.max: the value a full bar stands for, when the rows carry a mark measured
   on a scale of their own (a cost line past every bar): the bars and the mark
   must share one scale, or a bar short of cost reads as reaching it. The track
   is drawn in percentages of its own width, never stretched, so the data end is
   a true 4-unit round (--r-sm) and the start square; a row with an action of its
   own (a drill-down) keeps it, every other row reads its figure out. */
function chartRankedBars(rows, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  if (!rows || rows.length === 0) return _chartEmpty(opts.emptyText);
  var max = opts.max > 0 ? opts.max : Math.max.apply(null, rows.map(function(r) { return r.value; }).concat([0]));

  var html = '<div class="inv-chart-ranked">';
  rows.forEach(function(r) {
    var pct = max > 0 ? Math.min(Math.max((r.value / max) * 100, 0.5), 100) : 0;
    var read = r.label + ': ' + (r.display || chartFull(r.value, unit));
    var tap = r.action ? ' data-action="' + escHtml(r.action) + '" data-client-id="' + escHtml(r.clientId != null ? r.clientId : '') + '"'
      : ' data-action="invChartRead" data-read="' + escHtml(read) + '"';
    html += '<div class="inv-chart-ranked-row"' + tap + '>' +
      '<div class="inv-chart-ranked-head">' +
      '<span class="inv-chart-ranked-label">' + escHtml(r.label) + '</span>' +
      '<span class="inv-chart-ranked-val inv-num">' + escHtml(r.display || chartFull(r.value, unit)) + '</span></div>' +
      '<div class="inv-chart-ranked-track">' +
      '<svg class="inv-chart-ranked-svg" aria-hidden="true">' +
      '<rect x="0" y="0" width="' + _chartN(pct) + '%" height="100%" class="inv-chart-ranked-fill' +
      (r.tone ? ' inv-chart-ranked-fill-' + escHtml(r.tone) : '') + '"><title>' + escHtml(read) + '</title></rect>' +
      // A threshold line turns a bar chart of a narrow range into an answer.
      // Rates run 5.40 to 14.50 here: from a zero baseline every bar is
      // roughly half-length and the differences are invisible, but where each
      // one sits against cost is the entire question.
      (r.markPct != null ? '<rect x="' + _chartN(Math.max(Math.min(r.markPct, 100), 0)) +
        '%" y="0" width="' + CHART_GAP + '" height="100%" class="inv-chart-ranked-mark"/>' : '') +
      '</svg></div>' +
      (r.sub ? '<div class="inv-chart-ranked-sub">' + escHtml(r.sub) + '</div>' : '') +
      '</div>';
  });
  html += '</div>';
  var acts = rows.every(function(r) { return !!r.action; });
  return _chartBox(html, Object.assign({ readHint: acts ? 'Tap a row to open it' : 'Tap a bar to read it' }, opts),
    { cols: [{ label: opts.labelHead || '' }, { label: opts.valueHead || 'Value', unit: unit }], rows: rows.map(function(r) { return [r.label, r.value]; }) });
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

/* A frame round the data alone, for a price that moves a few percent: from zero, ₹380 against ₹395 is two lines on top
   of each other. Four steps of 1, 2, 2.5 or 5 × a power of ten, the lowest a multiple of the step at or under the data. */
function _chartFitStep(v) {
  var mag = Math.pow(10, Math.floor(Math.log10(v))), n = v / mag;
  return ([1, 2, 2.5, 5, 10].find(function(x) { return n <= x + 1e-9; }) || 10) * mag;
}
/* The round width nearest a bin's: 1, 2, 2.5, 5 or 10 × a power of ten, the closest on a log scale (10.5 is 10, never 20). */
function _chartNiceStep(v) {
  var mag = Math.pow(10, Math.floor(Math.log10(v))), n = v / mag;
  return [1, 2, 2.5, 5, 10].reduce(function(b, x) { return Math.abs(Math.log(x / n)) < Math.abs(Math.log(b / n)) ? x : b; }, 1) * mag;
}
function chartFitRange(lo, hi) {
  var span = hi - lo;
  if (!(span > 0)) span = Math.abs(hi) * 0.1 || 1;
  var step = _chartFitStep(span / 4), a = 0;
  for (var k = 0; k < 6; k++) {
    a = Math.floor(lo / step + 1e-9) * step;
    if (a + 4 * step >= hi - 1e-9) break;
    step = _chartFitStep(step * 1.01);
  }
  a = Math.floor(lo / step + 1e-9) * step;
  return { lo: a, hi: a + 4 * step };
}

/* Several series over the same labels, crossing zero when they must, with an optional band.
   labels: ['Apr', …]; series: [{label, values: [n|null], slot?|tone?, dashed?}]; opts: {unit, band: [{lo, hi}|null], ariaLabel, fit}.
   fit: the frame hugs the data (chartFitRange) instead of starting at zero, for a price.
   xs: a number per label (a day count) placing each at its distance in time rather than evenly: bills weeks apart and
   market days side by side on one axis. Its labels are thinned by room rather than by count.
   A null on an even axis is a gap — a month the statement does not reach, a week nobody typed — and the line breaks
   there rather than drawing straight across as if the figure between were known. On an xs axis the labels are the
   days any series has a figure, so a null is only another series' day, and each series joins its own points.
   The band is a range round the first series (a forecast's P25–P75), washed in its colour.
   A card's chart may draw plain: tickFmt writes the axis's figures its own way ("14k"), quiet leaves each point unseen (its title
   kept), keyPlain names the series in the key without their last figure; on a small card axisY false draws no figures up the
   side and key false no key (the canvas's phone: the months along the foot alone); labelEnds thins the labels on a stride that
   lands on the last (Sep ’25, Mar, Sep ’26). */
function chartLines(labels, series, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  if (!labels || !labels.length || !series || !series.length) return _chartEmpty(opts.emptyText);
  if (labels.length < 2) return _chartEmpty(opts.emptyText || 'Need at least two points to show a trend', 'early');
  var all = [];
  series.forEach(function(s) { s.values.forEach(function(v) { if (v != null && isFinite(v)) all.push(v); }); });
  (opts.band || []).forEach(function(b) { if (b) { all.push(b.lo); all.push(b.hi); } });
  if (!all.length) return _chartEmpty(opts.emptyText);
  var WH = _chartWH(opts, 480, 220), W = WH.W, H = WH.H, pad = { l: opts.axisY === false ? 8 : 50, r: 12, t: 14, b: 30 };
  var r = (opts.fit ? chartFitRange : chartNiceRange)(Math.min.apply(null, all), Math.max.apply(null, all));
  // Nothing but zeros has no scale: the frame is a nominal one, and only its zero line is labelled (as _chartFrame).
  var zeros = all.every(function(v) { return v === 0; });
  var cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  var xs = opts.xs, x0 = xs ? xs[0] : 0, xw = xs ? xs[xs.length - 1] - x0 : 0;
  var x = function(i) {
    if (xs) return pad.l + (xw > 0 ? (xs[i] - x0) / xw : 0.5) * cw;
    return pad.l + (i / (labels.length - 1)) * cw;
  };
  var y = function(v) { return pad.t + ch - ((v - r.lo) / (r.hi - r.lo)) * ch; };
  var inks = series.map(function(s, si) { return chartInk(s, si); });
  var svg = '<svg class="inv-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escHtml(opts.ariaLabel || 'Trend') + '">';
  for (var g = 0; g <= 4; g++) {
    var gv = r.hi - (g / 4) * (r.hi - r.lo), gy = y(gv);
    svg += '<line x1="' + pad.l + '" y1="' + gy + '" x2="' + (W - pad.r) + '" y2="' + gy + '" class="inv-chart-grid"/>' +
      ((zeros && Math.abs(gv) > 1e-9) || opts.axisY === false ? '' : '<text x="' + (pad.l - 4) + '" y="' + (gy + 3) + '" text-anchor="end" class="inv-chart-grid-label">' + escHtml(opts.tickFmt ? opts.tickFmt(gv) : chartShort(gv, unit)) + '</text>');
  }
  if (r.lo < 0) svg += '<line x1="' + pad.l + '" y1="' + y(0) + '" x2="' + (W - pad.r) + '" y2="' + y(0) + '" class="inv-chart-zero"/>';
  if (opts.band) {
    var up = [], down = [];
    opts.band.forEach(function(b, i) { if (b) { up.push(x(i) + ',' + y(b.hi)); down.unshift(x(i) + ',' + y(b.lo)); } });
    if (up.length > 1) svg += '<polygon points="' + up.concat(down).join(' ') + '" class="inv-chart-band ' + inks[0] + '"/>';
  }
  // A period not yet ended (opts.toDate): each series runs into it dashed, its points lighter, its label "to date".
  var td = _chartToDate(opts, labels.length), shown = labels.map(function(l, i) { return i === td ? chartToDateLabel(l) : l; });
  series.forEach(function(s, si) {
    var ink = inks[si], pts = [], runs = [[]];
    s.values.forEach(function(v, i) {
      if (v != null && isFinite(v)) { var p = [x(i), y(v), v, i]; pts.push(p); runs[runs.length - 1].push(p); }
      else if (!xs && runs[runs.length - 1].length) runs.push([]);
    });
    var poly = function(list, extra) {
      return list.length > 1 ? '<polyline points="' + list.map(function(p) { return p[0] + ',' + p[1]; }).join(' ') + '" class="inv-chart-path ' + ink + (extra || '') + '"' + (s.dashed ? ' stroke-dasharray="4 3"' : '') + '/>' : '';
    };
    // One polyline per unbroken run; a point alone between two gaps is its marker only. The stretch into and out of the period
    // to date is its own, dashed.
    runs.forEach(function(run) {
      var k = td == null ? -1 : run.findIndex(function(p) { return p[3] === td; });
      if (k < 0) { svg += poly(run); return; }
      svg += poly(run.slice(0, k)) + poly(run.slice(Math.max(0, k - 1), k + 2), ' inv-chart-todate') + poly(run.slice(k + 1));
    });
    pts.forEach(function(p) {
      var read = s.label + ', ' + shown[p[3]] + ': ' + chartFull(p[2], unit);
      svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + CHART_DOT_R + '" class="inv-chart-pt ' + ink + (p[3] === td ? ' inv-chart-todate' : '') + (opts.quiet ? ' inv-chart-pt-quiet' : '') + '" data-action="' + escHtml(opts.pointAction || 'invChartRead') + '" data-read="' + escHtml(read) + '"' +
        ' data-key="' + escHtml(opts.keys ? opts.keys[p[3]] : labels[p[3]]) + '"' +
        '><title>' + escHtml(read) + '</title></circle>';
    });
  });
  if (xs) {
    // By room: a label only where the one before is at least a label's width away, and the last always.
    var room = cw / (opts.maxLabels || 6);
    var lastX = x(labels.length - 1), prev = -Infinity;
    shown.forEach(function(l, i) {
      var at = x(i), isLast = i === labels.length - 1;
      if (isLast || (at - prev >= room && lastX - at >= room)) { svg += _chartXLabel(at, pad.t + ch + 14, l, W); prev = at; }
    });
  } else {
    svg += _chartXLabels(shown, labels.map(function(l, i) { return x(i); }), td, pad.t + ch + 14, W, opts.maxLabels, opts.labelEnds);
  }
  svg += '</svg>';
  var last = function(s) { for (var i = s.values.length - 1; i >= 0; i--) if (s.values[i] != null) return s.values[i]; return null; };
  var keyed = series.map(function(s, si) { return Object.assign({}, s, { ink: inks[si] }); });
  return _chartBox(svg + (opts.key === false ? '' : _chartSeriesLegend(keyed, unit, opts.keyPlain ? null : last, 'line')), opts, { cols: [{ label: opts.labelHead || '' }].concat(series.map(function(s) { return { label: s.label, unit: unit }; })),
    rows: shown.map(function(l, i) { return [l].concat(series.map(function(s) { var v = s.values[i]; return v != null && isFinite(v) ? v : null; })); }) });
}

/* Bars per label, stacked (a whole made of parts) or grouped (two figures side by side).
   series: [{label, values: [n], slot?|tone?}]; opts: {unit, mode: 'stack'|'group', action, keys}. Values ≥ 0.
   The parts of a stack stand a surface gap apart (the gap eats the upper part's foot, so the stack's top stays its total), the
   top one's end rounded; grouped bars each at most 24 units, a gap between them. */
function chartStack(labels, series, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money', group = opts.mode === 'group';
  if (!labels || !labels.length || !series || !series.length) return _chartEmpty(opts.emptyText);
  var totals = labels.map(function(_, i) {
    return group ? Math.max.apply(null, series.map(function(s) { return s.values[i] || 0; })) : series.reduce(function(t, s) { return t + (s.values[i] || 0); }, 0);
  });
  var max = Math.max.apply(null, totals.concat([0]));
  if (!(max > 0)) return _chartEmpty(opts.emptyText);
  var WH = _chartWH(opts, 480, 220), W = WH.W, H = WH.H, pad = { l: 50, r: 12, t: 14, b: 30 };
  var f = _chartFrame(labels.map(function(l, i) { return { label: l, value: totals[i] }; }), unit, W, H, pad);
  var slot = f.chartW / labels.length, n = series.length;
  var barW = group ? Math.min(Math.max(slot * 0.62, 1), CHART_BAR_MAX * n + CHART_GAP * (n - 1)) : Math.min(Math.max(slot * 0.62, 1), CHART_BAR_MAX);
  var w = group ? Math.max((barW - CHART_GAP * (n - 1)) / n, 1) : barW;
  var inks = series.map(function(s, si) { return chartInk(s, si); });
  var svg = '<svg class="inv-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escHtml(opts.ariaLabel || 'Bars') + '">' + f.svg;
  var stride = _chartLabelStride(labels.length, opts.maxLabels), td = _chartToDate(opts, labels.length);
  // A period not yet ended (opts.toDate): its bars lighter, its label "to date".
  var shown = labels.map(function(l, i) { return i === td ? chartToDateLabel(l) : l; }), lx = labels.map(function(l, i) { return pad.l + i * slot + slot / 2; });
  labels.forEach(function(l, i) {
    var x0 = pad.l + i * slot + (slot - barW) / 2, base = pad.t + f.chartH, drawn = 0;
    var key = opts.keys ? opts.keys[i] : l;
    var top = -1;
    series.forEach(function(s, si) { if ((s.values[i] || 0) > 0) top = si; });
    series.forEach(function(s, si) {
      var v = s.values[i] || 0;
      if (!(v > 0)) return;
      var h = (v / f.maxVal) * f.chartH, bx = group ? x0 + si * (w + CHART_GAP) : x0, by = base - h;
      var gap = !group && drawn ? Math.min(CHART_GAP, h / 2) : 0;
      var read = shown[i] + ', ' + s.label + ': ' + chartFull(v, unit);
      svg += '<rect x="' + bx + '" y="' + by + '" width="' + w + '" height="' + (h - gap) + '" class="inv-chart-seg ' + inks[si] + (group || si === top ? ' inv-chart-up' : '') + (i === td ? ' inv-chart-todate' : '') + '"' +
        ' data-action="' + escHtml(opts.action || 'invChartRead') + '" data-read="' + escHtml(read) + '" data-key="' + escHtml(key) + '" data-series="' + si + '"' +
        (opts.selected != null && String(opts.selected) === String(key) ? ' aria-current="true"' : '') + '><title>' + escHtml(read) + '</title></rect>';
      if (!group) base -= h;
      drawn++;
    });
    if (_chartLabelShown(i, labels.length, stride, td, lx, shown)) svg += _chartXLabel(x0 + barW / 2, pad.t + f.chartH + 14, shown[i], W);
  });
  svg += '</svg>';
  if (!opts.readHint) opts.readHint = 'Tap a bar to read it';
  var keyed = series.map(function(s, si) { return Object.assign({}, s, { ink: inks[si] }); });
  return _chartBox(svg + _chartSeriesLegend(keyed, unit, null), opts, { cols: [{ label: opts.labelHead || '' }].concat(series.map(function(s) { return { label: s.label, unit: unit }; })),
    rows: shown.map(function(l, i) { return [l].concat(series.map(function(s) { var v = s.values[i]; return v != null && isFinite(v) ? v : null; })); }) });
}

/* A pie that filters what is under it: each wedge and legend row carries data-key and the action;
   the selected wedge is pulled out along its bisector. slices: [{key, label, value, slot?|tone?}]. */
function chartPieTap(slices, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  var rows = (slices || []).filter(function(s) { return s.value > 0; }).sort(function(a, b) { return b.value - a.value; });
  if (!rows.length) return _chartEmpty(opts.emptyText);
  var shown = _chartPieFold(rows, '__others');
  var total = shown.reduce(function(s, r) { return s + r.value; }, 0);
  var R = 96, CX = 105, CY = 105, inner = 54, angle = -Math.PI / 2, act = opts.action || 'invChartRead';
  var svg = '<svg class="inv-chart-pie-svg" viewBox="0 0 210 210" role="img" aria-label="' + escHtml(opts.ariaLabel || 'Composition') + '">';
  shown.forEach(function(s, i) {
    var frac = s.value / total, sweep = frac * Math.PI * 2, end = angle + sweep, mid = angle + sweep / 2;
    // A slice names its colour (its slot), so a category keeps one colour across every chart on a page.
    var cls = chartInk(s, i), sel = opts.selected != null && String(opts.selected) === String(s.key);
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
      ' aria-pressed="' + sel + '"><span class="inv-chart-swatch ' + chartInk(s, i) + '"></span>' +
      '<span class="inv-chart-legend-label">' + escHtml(s.label) + '</span><span class="inv-chart-legend-val inv-num">' + escHtml(chartShort(s.value, unit)) + '</span>' +
      '<span class="inv-chart-legend-pct inv-num">' + formatNum(s.value / total * 100, 1) + '%</span></button>';
  }).join('') + '</div>';
  return _chartBox('<div class="inv-chart-pie-wrap">' + svg + legend + '</div>', opts,
    { cols: [{ label: opts.labelHead || '' }, { label: opts.valueHead || 'Value', unit: unit }, { label: 'Share', unit: 'pct' }],
      rows: shown.map(function(s) { return [s.label, s.value, s.value / total * 100]; }) });
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

/* ===== EIGHT CHARTS MORE (docs/UI_PASS_3.md §5) =====
   Each draws the marks above, reads every datum out (a group with a hit area larger than its mark, or a row that is a button),
   names its series' colours by slot or tone, says nothing to draw with the one blank state, and stands in the box with its
   table. A dial is not drawn (the owner's review): a figure against a mark is a meter or a diverging bar. */

/* Bars up and down from a zero rule, coloured by what the sign means (a judgement, so status tones): above zero `pos` (ok),
   below `neg` (danger). rows: [{key, label, value}], value signed; a null is a gap. opts: unit, pos, neg, posLabel, negLabel,
   id, toDate (an index), ariaLabel, emptyText. First for the price against the cost, month by month. */
function chartDiverging(rows, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  var data = (rows || []).filter(Boolean);
  var ok = function(v) { return v != null && isFinite(v); };
  var vals = data.map(function(r) { return r.value; }).filter(ok).map(Number);
  if (!vals.length) return _chartEmpty(opts.emptyText);
  var WH = _chartWH(opts, 480, 220), W = WH.W, H = WH.H, pad = { l: 50, r: 12, t: 14, b: 30 }, cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  var rg = chartNiceRange(Math.min.apply(null, vals), Math.max.apply(null, vals));
  var y = function(v) { return pad.t + ch - (v - rg.lo) / (rg.hi - rg.lo) * ch; };
  var zeros = vals.every(function(v) { return v === 0; });
  var pos = chartInk({ tone: opts.pos || 'ok' }), neg = chartInk({ tone: opts.neg || 'danger' });
  var slot = cw / data.length, barW = Math.min(Math.max(slot * 0.62, 1), CHART_BAR_MAX), td = _chartToDate(opts, data.length);
  var labels = data.map(function(r, i) { return i === td ? chartToDateLabel(r.label) : String(r.label); });
  var xs = data.map(function(r, i) { return pad.l + i * slot + slot / 2; });
  var svg = '<svg class="inv-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escHtml(opts.ariaLabel || 'Above and below zero') + '">' +
    _chartGridRange(rg, unit, W, pad, y, zeros, true);
  var y0 = y(0), above = false, below = false;
  data.forEach(function(r, i) {
    if (!ok(r.value)) return;
    var v = Number(r.value), yv = y(v), up = v >= 0, x0 = pad.l + i * slot;
    if (v > 0) above = true; else if (v < 0) below = true;
    var read = labels[i] + ': ' + _chartSigned(v, unit);
    var mark = Math.abs(yv - y0) > 0.01 ? '<rect class="inv-chart-bar ' + (up ? 'inv-chart-up ' + pos : 'inv-chart-down ' + neg) + (i === td ? ' inv-chart-todate' : '') + '" x="' + _chartN(x0 + (slot - barW) / 2) +
      '" y="' + _chartN(Math.min(yv, y0)) + '" width="' + _chartN(barW) + '" height="' + _chartN(Math.abs(yv - y0)) + '"/>' : '';
    svg += _chartDatum(read, mark, { x: x0, y: pad.t, w: slot, h: ch }, { key: r.key != null ? r.key : r.label });
  });
  svg += _chartXLabels(labels, xs, td, pad.t + ch + 14, W, opts.maxLabels) + '</svg>';
  // The two colours say what they mean in words (DR-8): never the colour alone.
  var keys = above && below ? _chartSeriesLegend([{ label: opts.posLabel || 'Above zero', ink: pos }, { label: opts.negLabel || 'Below zero', ink: neg }], unit, null) : '';
  return _chartBox(svg + keys, Object.assign({ readHint: 'Tap a bar to read it' }, opts), { cols: [{ label: opts.labelHead || '' }, { label: opts.valueHead || opts.ariaLabel || 'Value', unit: unit, signed: true }],
    rows: data.map(function(r, i) { return [labels[i], ok(r.value) ? Number(r.value) : null]; }) });
}

/* How many fall in each bin, with a reference mark (the terms, a target). values: numbers. opts: binWidth or bins (else about
   log2(n) + 1 bins of a round width), unit (the values'), mark {value, label}, id, ariaLabel, emptyText. Bins are [a, b), the last
   one closed; the mark is always inside the frame. First for the length of the cuts, the days clients take to pay. */
function chartHistogram(values, opts) {
  opts = opts || {};
  var unit = opts.unit || 'count';
  var vs = (values || []).filter(function(v) { return v != null && v !== '' && isFinite(v); }).map(Number);
  if (!vs.length) return _chartEmpty(opts.emptyText);
  var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
  var mk = opts.mark && opts.mark.value != null && isFinite(opts.mark.value) ? { value: Number(opts.mark.value), label: opts.mark.label || '' } : null;
  var bw = opts.binWidth > 0 ? Number(opts.binWidth) : 0;
  if (!bw) {
    var nb = opts.bins > 0 ? Math.round(opts.bins) : Math.ceil(Math.log(vs.length) / Math.LN2 + 1);
    bw = hi > lo ? _chartNiceStep((hi - lo) / Math.max(1, nb)) : (Math.abs(lo) * 0.1 || 1);
  }
  var a = Math.min(lo, mk ? mk.value : lo), b = Math.max(hi, mk ? mk.value : hi);
  var start = Math.floor(a / bw + 1e-9) * bw;
  var n = Math.min(60, Math.max(1, Math.ceil((b - start) / bw - 1e-9)));
  if (start + n * bw < b - 1e-9 && n < 60) n++;
  var counts = [];
  for (var k = 0; k < n; k++) counts.push(0);
  vs.forEach(function(v) { counts[Math.max(0, Math.min(n - 1, Math.floor((v - start) / bw + 1e-9)))]++; });
  var edge = function(k) { return _chartN(start + k * bw); };
  var binLabel = function(k) { return chartShort(edge(k), unit) + '\u2013' + chartShort(edge(k + 1), unit); };
  var WH = _chartWH(opts, 480, 220), W = WH.W, H = WH.H, pad = { l: 46, r: 12, t: 22, b: 30 };
  var f = _chartFrame(counts.map(function(c) { return { value: c }; }), 'count', W, H, pad, _chartCountMax(Math.max.apply(null, counts)));
  var slot = f.chartW / n, barW = Math.min(Math.max(slot - CHART_GAP, 1), CHART_BAR_MAX);
  var svg = '<svg class="inv-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escHtml(opts.ariaLabel || 'How they spread') + '">' + f.svg;
  counts.forEach(function(c, k) {
    var h = f.maxVal > 0 ? c / f.maxVal * f.chartH : 0, x0 = pad.l + k * slot;
    var mark = h > 0 ? '<rect class="inv-chart-bar inv-chart-up ' + chartInk({ slot: opts.slot, tone: opts.tone }, 0) + '" x="' + _chartN(x0 + (slot - barW) / 2) + '" y="' + _chartN(pad.t + f.chartH - h) +
      '" width="' + _chartN(barW) + '" height="' + _chartN(h) + '"/>' : '';
    svg += _chartDatum(binLabel(k) + ': ' + c, mark, { x: x0, y: pad.t, w: slot, h: f.chartH }, { key: String(edge(k)) });
  });
  // The bins' edges under the bars, thinned to fit.
  var stride = _chartLabelStride(n + 1, opts.maxLabels || 7);
  for (var e = 0; e <= n; e++) if (e % stride === 0 || e === n) svg += _chartXLabel(pad.l + e * slot, pad.t + f.chartH + 14, chartShort(edge(e), unit), W);
  if (mk) {
    var mx = _chartN(pad.l + (mk.value - start) / (n * bw) * f.chartW);
    svg += '<line class="inv-chart-mark" x1="' + mx + '" x2="' + mx + '" y1="' + (pad.t - 4) + '" y2="' + (pad.t + f.chartH) + '"/>' +
      _chartXLabel(mx, pad.t - 8, (mk.label ? mk.label + ' ' : '') + chartShort(mk.value, unit), W, 'inv-chart-mark-label');
  }
  svg += '</svg>';
  return _chartBox(svg, Object.assign({ readHint: 'Tap a bar to read it' }, opts), { cols: [{ label: opts.labelHead || 'Range' }, { label: opts.valueHead || 'How many', unit: 'count' }],
    rows: counts.map(function(c, k) { return [binLabel(k), c]; }) });
}

/* Rows a thing, its name, a dot on a track and its figure at the row's end: the rows of chartDots and chartDumbbell share one
   scale (the tracks are one column, a subgrid), and a row is its datum, a button. The track is drawn in percentages of its own
   width, never stretched. */
function _chartScaleRow(rg, unit) {
  return '<div class="inv-chart-scale" aria-hidden="true"><span></span><span class="inv-chart-scale-ends"><span>' + escHtml(chartShort(rg.lo, unit)) + '</span><span>' +
    escHtml(chartShort(rg.hi, unit)) + '</span></span><span></span></div>';
}
function _chartRowHtml(r, read, track, fig) {
  return '<button type="button" class="inv-chart-row" data-action="invChartRead" data-read="' + escHtml(read) + '"' + (r.key != null ? ' data-key="' + escHtml(r.key) + '"' : '') + '>' +
    '<span class="inv-chart-row-label">' + escHtml(r.label) + (r.sub ? '<span class="inv-chart-row-sub">' + escHtml(r.sub) + '</span>' : '') + '</span>' +
    '<svg class="inv-chart-track" aria-hidden="true"><line class="inv-chart-rail" x1="0" x2="100%" y1="50%" y2="50%"/>' + track + '</svg>' +
    '<span class="inv-chart-row-val inv-num">' + escHtml(fig) + '</span></button>';
}

/* One dot a row on one scale, labelled at the row's end, with marks as rules across the rows. rows: [{key, label, value, sub,
   slot?|tone?}]; opts: unit, marks [{value, label}], zero (the scale from zero, else round the data), slot (the dots' colour,
   1), id, emptyText. First for what each client pays a kilo against the variable and the full cost. */
function chartDots(rows, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  var list = (rows || []).filter(function(r) { return r && r.value != null && isFinite(r.value); });
  if (!list.length) return _chartEmpty(opts.emptyText);
  var marks = (opts.marks || []).filter(function(m) { return m && m.value != null && isFinite(m.value); });
  var all = list.map(function(r) { return Number(r.value); }).concat(marks.map(function(m) { return Number(m.value); }));
  var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
  var rg = opts.zero ? chartNiceRange(lo, hi) : chartFitRange(lo, hi);
  var pc = function(v) { return _chartN(Math.max(0, Math.min(100, (v - rg.lo) / (rg.hi - rg.lo) * 100))); };
  var rules = marks.map(function(m) { return '<line class="inv-chart-mark" x1="' + pc(m.value) + '%" x2="' + pc(m.value) + '%" y1="0" y2="100%"/>'; }).join('');
  var subs = list.some(function(r) { return !!r.sub; });
  var body = list.map(function(r) {
    var ink = r.slot != null || r.tone != null ? chartInk(r, 0) : chartSlotClass(opts.slot != null ? opts.slot : 1);
    var fig = chartFull(Number(r.value), unit), read = r.label + ': ' + fig + (r.sub ? ' · ' + r.sub : '');
    return _chartRowHtml(r, read, rules + '<circle class="inv-chart-pt ' + ink + '" cx="' + pc(r.value) + '%" cy="50%" r="' + CHART_DOT_R + '"><title>' + escHtml(read) + '</title></circle>', fig);
  }).join('');
  var keys = marks.length ? '<div class="inv-chart-keys">' + marks.map(function(m) {
    return '<span class="inv-chart-key"><span class="inv-chart-swatch inv-chart-swatch-rule"></span>' + escHtml((m.label ? m.label + ' ' : '') + chartFull(Number(m.value), unit)) + '</span>';
  }).join('') + '</div>' : '';
  return _chartBox('<div class="inv-chart-rows">' + body + _chartScaleRow(rg, unit) + '</div>' + keys, Object.assign({ readHint: 'Tap a row to read it' }, opts),
    { cols: [{ label: opts.labelHead || '' }, { label: opts.valueHead || 'Value', unit: unit }].concat(subs ? [{ label: opts.subHead || '', unit: 'text' }] : []),
      rows: list.map(function(r) { return [r.label, Number(r.value)].concat(subs ? [r.sub || ''] : []); }) });
}

/* Least squares (§5): over [{x, y}] the line's slope and intercept, Pearson's r and how many points, for a scatter's line and the
   words a widget says about it. Under three points there is no fit (null), nor where every point stands at one x; where every
   point has one y the line is flat and r is not known (null). */
function chartFit(points) {
  var p = (points || []).filter(function(q) { return q && q.x != null && q.y != null && isFinite(q.x) && isFinite(q.y); });
  var n = p.length;
  if (n < 3) return null;
  var mx = 0, my = 0;
  p.forEach(function(q) { mx += Number(q.x); my += Number(q.y); });
  mx /= n; my /= n;
  var sxx = 0, syy = 0, sxy = 0;
  p.forEach(function(q) { var dx = q.x - mx, dy = q.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
  if (!(sxx > 0)) return null;
  var slope = sxy / sxx;
  return { n: n, r: syy > 0 ? sxy / Math.sqrt(sxx * syy) : null, slope: slope, intercept: my - slope * mx };
}
/* The fitted line over a series' own x range, cut where it leaves the frame. */
function _chartClipFit(f, xa, xb, ry) {
  var end = function(x) {
    var yv = f.slope * x + f.intercept;
    if (yv > ry.hi && f.slope) { x = (ry.hi - f.intercept) / f.slope; yv = ry.hi; }
    else if (yv < ry.lo && f.slope) { x = (ry.lo - f.intercept) / f.slope; yv = ry.lo; }
    return [x, yv];
  };
  var p = end(xa), q = end(xb);
  if (p[0] > q[0] || p[0] < xa - 1e-9 || q[0] > xb + 1e-9) return null;
  return [p, q];
}

/* Does one thing move another: a dot a point, three series at most (a fourth is not drawn), and with `fit` each series' least
   squares line (chartFit), its r said in the keys. series: [{key, label, points: [{x, y, label}], slot?|tone?}]; opts: xUnit,
   yUnit, xLabel, yLabel, fit, id, emptyText. Both axes hug the data. */
function chartScatter(series, opts) {
  opts = opts || {};
  var xu = opts.xUnit || 'count', yu = opts.yUnit || 'count';
  var fin = function(p) { return p && p.x != null && p.y != null && isFinite(p.x) && isFinite(p.y); };
  var ss = (series || []).slice(0, 3).map(function(s, si) {
    return { s: s, ink: chartInk(s, si), pts: (s.points || []).filter(fin).map(function(p) { return { x: Number(p.x), y: Number(p.y), label: p.label }; }) };
  }).filter(function(x) { return x.pts.length; });
  if (!ss.length) return _chartEmpty(opts.emptyText);
  var X = [], Y = [];
  ss.forEach(function(x) { x.pts.forEach(function(p) { X.push(p.x); Y.push(p.y); }); });
  var rx = chartFitRange(Math.min.apply(null, X), Math.max.apply(null, X)), ry = chartFitRange(Math.min.apply(null, Y), Math.max.apply(null, Y));
  var WH = _chartWH(opts, 480, 240), W = WH.W, H = WH.H, pad = { l: 50, r: 16, t: 18, b: 34 }, cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  var px = function(v) { return pad.l + (v - rx.lo) / (rx.hi - rx.lo) * cw; }, py = function(v) { return pad.t + ch - (v - ry.lo) / (ry.hi - ry.lo) * ch; };
  var svg = '<svg class="inv-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escHtml(opts.ariaLabel || 'One against the other') + '">';
  for (var g = 0; g <= 4; g++) {
    var gy = _chartN(py(ry.lo + g / 4 * (ry.hi - ry.lo))), gx = _chartN(px(rx.lo + g / 4 * (rx.hi - rx.lo)));
    svg += '<line x1="' + pad.l + '" y1="' + gy + '" x2="' + (W - pad.r) + '" y2="' + gy + '" class="inv-chart-grid"/>' +
      '<text x="' + (pad.l - 4) + '" y="' + _chartN(gy + 3) + '" text-anchor="end" class="inv-chart-grid-label">' + escHtml(chartShort(ry.lo + g / 4 * (ry.hi - ry.lo), yu)) + '</text>' +
      '<line x1="' + gx + '" y1="' + pad.t + '" x2="' + gx + '" y2="' + (pad.t + ch) + '" class="inv-chart-grid"/>' +
      _chartXLabel(gx, pad.t + ch + 14, chartShort(rx.lo + g / 4 * (rx.hi - rx.lo), xu), W);
  }
  if (ry.lo < 0 && ry.hi > 0) svg += '<line x1="' + pad.l + '" y1="' + _chartN(py(0)) + '" x2="' + (W - pad.r) + '" y2="' + _chartN(py(0)) + '" class="inv-chart-zero"/>';
  if (rx.lo < 0 && rx.hi > 0) svg += '<line x1="' + _chartN(px(0)) + '" y1="' + pad.t + '" x2="' + _chartN(px(0)) + '" y2="' + (pad.t + ch) + '" class="inv-chart-zero"/>';
  if (opts.xLabel) svg += '<text x="' + (W - pad.r) + '" y="' + (H - 4) + '" text-anchor="end" class="inv-chart-axis-title">' + escHtml(opts.xLabel) + '</text>';
  if (opts.yLabel) svg += '<text x="' + pad.l + '" y="' + (pad.t - 8) + '" text-anchor="start" class="inv-chart-axis-title">' + escHtml(opts.yLabel) + '</text>';
  // The fitted lines under the dots, each in its series' colour.
  var fits = ss.map(function(x) { return opts.fit ? chartFit(x.pts) : null; });
  ss.forEach(function(x, i) {
    var f = fits[i];
    if (!f) return;
    var xa = Math.min.apply(null, x.pts.map(function(p) { return p.x; })), xb = Math.max.apply(null, x.pts.map(function(p) { return p.x; }));
    var seg = _chartClipFit(f, xa, xb, ry);
    if (seg) svg += '<line class="inv-chart-fit ' + x.ink + '" x1="' + _chartN(px(seg[0][0])) + '" y1="' + _chartN(py(seg[0][1])) + '" x2="' + _chartN(px(seg[1][0])) + '" y2="' + _chartN(py(seg[1][1])) + '"/>';
  });
  var many = ss.length > 1;
  ss.forEach(function(x) {
    x.pts.forEach(function(p) {
      var cx = _chartN(px(p.x)), cy = _chartN(py(p.y));
      var read = (many ? x.s.label + ', ' : '') + (p.label ? p.label + ': ' : '') + chartFull(p.x, xu) + ', ' + chartFull(p.y, yu);
      svg += _chartDatum(read, '<circle class="inv-chart-pt ' + x.ink + '" cx="' + cx + '" cy="' + cy + '" r="' + CHART_DOT_R + '"/>',
        '<circle class="inv-chart-hit" cx="' + cx + '" cy="' + cy + '" r="' + (CHART_DOT_R * 3) + '"/>', { key: x.s.key != null ? x.s.key : x.s.label });
    });
  });
  svg += '</svg>';
  // The keys: a series each, with its fit's r and how many points it rests on; one series is named only for its fit.
  var fitWords = function(f) { return f ? ' · r ' + (f.r == null ? '\u2014' : (f.r < 0 ? '\u2212' : '') + formatNum(Math.abs(f.r), 2)) + ', ' + f.n + ' points' : ''; };
  var keys = many || fits[0] ? '<div class="inv-chart-keys">' + ss.map(function(x, i) {
    return '<span class="inv-chart-key"><span class="inv-chart-swatch inv-chart-swatch-dot ' + x.ink + '"></span>' + escHtml((many ? x.s.label : 'Least-squares line') + fitWords(fits[i])) + '</span>';
  }).join('') + '</div>' : '';
  var cols = (many ? [{ label: opts.seriesHead || '' }] : []).concat([{ label: opts.pointHead || (many ? 'Point' : '') }, { label: opts.xLabel || 'X', unit: xu }, { label: opts.yLabel || 'Y', unit: yu }]);
  var rows = [];
  ss.forEach(function(x) { x.pts.forEach(function(p) { rows.push((many ? [x.s.label] : []).concat([p.label || '', p.x, p.y])); }); });
  if (many) cols[1].unit = 'text';
  return _chartBox(svg + keys, Object.assign({ readHint: 'Tap a dot to read it' }, opts), { cols: cols, rows: rows });
}

/* A calendar of one figure a day: a column a pay week (Sunday to Saturday, numbered by its Saturday), a row a day Monday to
   Saturday, Sunday drawn only where one was worked; the figure on the one blue ramp (--seq-1…7, light to dark), a day with no
   record hatched, a day that is not a working day left blank. cells: [{date, value, state: 'ok' | 'none' | 'off', title}];
   opts: unit, weeks (to the latest cell's), toDate (the day not yet ended: a date, or a cell's index), valueHead, id, emptyText.
   First for what was plated each day. */
var CHART_DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
var CHART_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var CHART_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function _chartDay(iso, withDay) {
  var d = new Date(iso + 'T00:00:00');
  return (withDay ? CHART_DAY_NAMES[d.getDay()] + ' ' : '') + d.getDate() + ' ' + CHART_MONTHS[d.getMonth()];
}
/* A cell's hatch: lines at 45° across a c-unit square from (x, y), clipped by arithmetic (no clip path, so no id on the page). */
function _chartHatch(x, y, c) {
  var s = '';
  for (var k = 4; k < 2 * c; k += 4) {
    s += '<line class="inv-chart-hatch" x1="' + _chartN(x + Math.max(0, k - c)) + '" y1="' + _chartN(y + Math.min(k, c)) + '" x2="' + _chartN(x + Math.min(k, c)) + '" y2="' + _chartN(y + Math.max(0, k - c)) + '"/>';
  }
  return s;
}
function chartHeat(cells, opts) {
  opts = opts || {};
  var unit = opts.unit || 'kg';
  var by = {};
  (cells || []).forEach(function(c) { if (c && /^\d{4}-\d{2}-\d{2}$/.test(c.date || '')) by[c.date] = c; });
  var dates = Object.keys(by).sort();
  if (!dates.length) return _chartEmpty(opts.emptyText);
  var dow = function(iso) { return new Date(iso + 'T00:00:00').getDay(); };
  var sunOf = function(iso) { return isoAddDays(iso, -dow(iso)); };
  var lastWeek = sunOf(dates[dates.length - 1]);
  var weeks = opts.weeks > 0 ? Math.min(Math.round(opts.weeks), 106) : Math.min(Math.floor(isoDaysBetween(sunOf(dates[0]), lastWeek) / 7) + 1, 106);
  var first = isoAddDays(lastWeek, -7 * (weeks - 1));
  var has = function(c) { return !!c && c.state !== 'none' && c.state !== 'off' && c.value != null && isFinite(c.value); };
  var shownDates = dates.filter(function(d) { return d >= first; });
  if (!shownDates.length) return _chartEmpty(opts.emptyText);
  var days = shownDates.some(function(d) { return dow(d) === 0 && has(by[d]); }) ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  var max = Math.max.apply(null, shownDates.filter(function(d) { return has(by[d]); }).map(function(d) { return Number(by[d].value); }).concat([0]));
  var step = function(v) { return max > 0 ? Math.max(1, Math.min(7, Math.ceil(v / max * 7))) : 1; };
  var td = typeof opts.toDate === 'string' ? opts.toDate : (opts.toDate != null && cells && cells[opts.toDate] ? cells[opts.toDate].date : null);
  var LW = 14, TH = 14, C = 16;
  // Bare in a card: the cells take the room the card leaves, between 8 and 24 a side, the labels read at 11px.
  if (opts.bare && opts.w > 0 && opts.h > 0) C = Math.max(8, Math.min(24, Math.floor(Math.min((opts.w - LW) / weeks, (opts.h - TH) / days.length)) - CHART_GAP));
  var P = C + CHART_GAP, W = LW + weeks * P, H = TH + days.length * P;
  var svg = '<svg class="inv-chart-heat" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + escHtml(opts.ariaLabel || 'Each day') + '">';
  days.forEach(function(d, r) { svg += '<text x="0" y="' + (TH + r * P + C - 4) + '" class="inv-chart-axis">' + CHART_DAY_LETTERS[d] + '</text>'; });
  // A week is named by its Saturday, the pay week's own day; every few, counted back from the latest so it is always named.
  var stride = Math.max(1, Math.ceil(40 / P)), none = false;
  for (var w = 0; w < weeks; w++) {
    var sun = isoAddDays(first, 7 * w);
    if ((weeks - 1 - w) % stride === 0) svg += _chartXLabel(LW + w * P + C / 2, TH - 4, _chartDay(isoAddDays(sun, 6)), W);
    days.forEach(function(d, r) {
      var iso = isoAddDays(sun, d), c = by[iso];
      if (!c || c.state === 'off' || (d === 0 && !has(c))) return;
      var x = LW + w * P, y = TH + r * P, hit = { x: x - CHART_GAP / 2, y: y - CHART_GAP / 2, w: P, h: P };
      if (!has(c)) {
        none = true;
        var nr = c.title || _chartDay(iso, true) + ': no record';
        svg += _chartDatum(nr, '<rect class="inv-chart-cell-none" x="' + x + '" y="' + y + '" width="' + C + '" height="' + C + '" rx="2"/>' + _chartHatch(x, y, C), hit, { key: iso });
        return;
      }
      var read = c.title || _chartDay(iso, true) + (iso === td ? ' to date' : '') + ': ' + chartFull(Number(c.value), unit);
      svg += _chartDatum(read, '<rect class="inv-chart-cell inv-chart-seq' + step(Number(c.value)) + (iso === td ? ' inv-chart-todate' : '') + '" x="' + x + '" y="' + y + '" width="' + C + '" height="' + C + '" rx="2"/>', hit, { key: iso });
    });
  }
  svg += '</svg>';
  // How much, as a scale (a ramp needs its key): its two ends' figures, the seven steps between; the hatch named where drawn.
  var scale = '<div class="inv-chart-keys"><span class="inv-chart-key">' + escHtml(chartShort(0, unit)) + '<span class="inv-chart-ramp">' +
    [1, 2, 3, 4, 5, 6, 7].map(function(k) { return '<span class="inv-chart-swatch inv-chart-seq' + k + '"></span>'; }).join('') + '</span>' + escHtml(chartShort(max, unit)) + '</span>' +
    (none ? '<span class="inv-chart-key"><span class="inv-chart-swatch inv-chart-swatch-hatch"></span>No record</span>' : '') + '</div>';
  var word = { ok: 'Recorded', none: 'No record', off: 'Not a working day' };
  return _chartBox('<div class="inv-chart-heat-wrap">' + svg + '</div>' + scale, Object.assign({ readHint: 'Tap a day to read it' }, opts),
    { cols: [{ label: opts.labelHead || 'Day' }, { label: opts.valueHead || 'Value', unit: unit }, { label: 'Record', unit: 'text' }],
      rows: shownDates.map(function(d) { var c = by[d]; return [_chartDay(d, true) + (d === td ? ' to date' : ''), has(c) ? Number(c.value) : null, has(c) ? word.ok : word[c.state] || word.none]; }) });
}

/* Per row a rule from `a` (a mark, ┃) to `b` (a dot, ●), the dot in the row's tone. rows: [{key, label, a, b, tone?|slot?}];
   opts: unit, aLabel, bLabel, fit (round the data, else from zero), id, emptyText. First for the days to pay against the terms. */
function chartDumbbell(rows, opts) {
  opts = opts || {};
  var unit = opts.unit || 'count';
  var ok = function(v) { return v != null && isFinite(v); };
  var list = (rows || []).filter(function(r) { return r && (ok(r.a) || ok(r.b)); });
  if (!list.length) return _chartEmpty(opts.emptyText);
  var all = [];
  list.forEach(function(r) { if (ok(r.a)) all.push(Number(r.a)); if (ok(r.b)) all.push(Number(r.b)); });
  var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
  var rg = opts.fit ? chartFitRange(lo, hi) : lo >= 0 ? { lo: 0, hi: chartNiceMax(hi) } : chartNiceRange(lo, hi);
  var pc = function(v) { return _chartN(Math.max(0, Math.min(100, (v - rg.lo) / (rg.hi - rg.lo) * 100))); };
  var aL = opts.aLabel || 'From', bL = opts.bLabel || 'To', toned = list.some(function(r) { return r.tone != null; });
  var body = list.map(function(r) {
    var a = ok(r.a) ? Number(r.a) : null, b = ok(r.b) ? Number(r.b) : null;
    var ink = r.tone != null || r.slot != null ? chartInk(r, 0) : chartSlotClass(1);
    var read = r.label + ': ' + bL + ' ' + (b != null ? chartFull(b, unit) : '\u2014') + ' · ' + aL + ' ' + (a != null ? chartFull(a, unit) : '\u2014');
    var title = '<title>' + escHtml(read) + '</title>';
    var track = (a != null && b != null ? '<line class="inv-chart-dumb-rule" x1="' + pc(a) + '%" x2="' + pc(b) + '%" y1="50%" y2="50%"/>' : '') +
      (a != null ? '<line class="inv-chart-dumb-a" x1="' + pc(a) + '%" x2="' + pc(a) + '%" y1="25%" y2="75%">' + (b == null ? title : '') + '</line>' : '') +
      (b != null ? '<circle class="inv-chart-pt ' + ink + '" cx="' + pc(b) + '%" cy="50%" r="' + CHART_DOT_R + '">' + title + '</circle>' : '');
    return _chartRowHtml(r, read, track, b != null ? chartFull(b, unit) : '\u2014');
  }).join('');
  var keys = '<div class="inv-chart-keys"><span class="inv-chart-key"><span class="inv-chart-swatch inv-chart-swatch-tick"></span>' + escHtml(aL) + '</span>' +
    '<span class="inv-chart-key"><span class="inv-chart-swatch inv-chart-swatch-dot ' + (toned ? 'inv-chart-neutral' : chartSlotClass(1)) + '"></span>' + escHtml(bL) + '</span></div>';
  return _chartBox('<div class="inv-chart-rows">' + body + _chartScaleRow(rg, unit) + '</div>' + keys, Object.assign({ readHint: 'Tap a row to read it' }, opts),
    { cols: [{ label: opts.labelHead || '' }, { label: aL, unit: unit }, { label: bL, unit: unit }], rows: list.map(function(r) { return [r.label, ok(r.a) ? Number(r.a) : null, ok(r.b) ? Number(r.b) : null]; }) });
}

/* One bar of 100%: the parts of a whole side by side, a surface gap apart, each in its own slot's colour (`slot`, seriesSlot), its
   share in its title, and the keys under it with each share. First for where a kilo's cost goes (Home's `kilo` widget). */
function chartShareBar(parts, title) {
  var sum = parts.reduce(function(s, p) { return s + p.v; }, 0);
  if (!(sum > 0)) return '';
  var W = 400, gap = 2, x = 0, live = parts.filter(function(p) { return p.v > 0; });
  var rects = live.map(function(p, i) {
    var w = p.v / sum * W, r = '<rect class="inv-sharebar-part ' + chartSlotClass(p.slot) + '" x="' + _chartN(x) + '" y="0" width="' + _chartN(Math.max(0.5, w - (i < live.length - 1 ? gap : 0))) +
      '" height="10"><title>' + escHtml(p.label + ': ' + formatNum(p.v / sum * 100, 1) + '%') + '</title></rect>';
    x += w;
    return r;
  }).join('');
  var keys = '<div class="inv-chart-keys">' + live.map(function(p) {
    return '<span class="inv-chart-key"><span class="inv-chart-swatch ' + chartSlotClass(p.slot) + '"></span>' + escHtml(p.label + ' ' + Math.round(p.v / sum * 100) + '%') + '</span>';
  }).join('') + '</div>';
  return '<svg class="inv-sharebar" viewBox="0 0 ' + W + ' 10" preserveAspectRatio="none" role="img" aria-label="' + escHtml(title) + '"><title>' + escHtml(title) + '</title>' + rects + '</svg>' + keys;
}

/* Shares of a whole, each bar 100%: labels and series as chartStack (values ≥ 0), the parts a surface gap apart, the top part's
   end rounded. opts: unit (the values', said beside each share), keys, id, toDate (an index), ariaLabel, emptyText. A label with
   nothing in it is a gap. First for the share of tonnage against the share of revenue, and what a kilo costs. */
function chartStack100(labels, series, opts) {
  opts = opts || {};
  var unit = opts.unit || 'money';
  if (!labels || !labels.length || !series || !series.length) return _chartEmpty(opts.emptyText);
  var val = function(s, i) { var v = s.values ? s.values[i] : null; return v != null && isFinite(v) && v > 0 ? Number(v) : 0; };
  var totals = labels.map(function(_, i) { return series.reduce(function(t, s) { return t + val(s, i); }, 0); });
  if (!totals.some(function(t) { return t > 0; })) return _chartEmpty(opts.emptyText);
  var WH = _chartWH(opts, 480, 220), W = WH.W, H = WH.H, pad = { l: 50, r: 12, t: 14, b: 30 }, cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  var y = function(sh) { return pad.t + ch - sh * ch; };
  var inks = series.map(function(s, si) { return chartInk(s, si); });
  var svg = '<svg class="inv-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escHtml(opts.ariaLabel || 'Shares') + '">';
  for (var g = 0; g <= 4; g++) {
    var gy = _chartN(y(g / 4));
    svg += '<line x1="' + pad.l + '" y1="' + gy + '" x2="' + (W - pad.r) + '" y2="' + gy + '" class="inv-chart-grid"/><text x="' + (pad.l - 4) + '" y="' + _chartN(gy + 3) +
      '" text-anchor="end" class="inv-chart-grid-label">' + chartShort(g * 25, 'pct') + '</text>';
  }
  var slot = cw / labels.length, barW = Math.min(Math.max(slot * 0.62, 1), CHART_BAR_MAX), td = _chartToDate(opts, labels.length);
  var shown = labels.map(function(l, i) { return i === td ? chartToDateLabel(l) : String(l); });
  labels.forEach(function(l, i) {
    var tot = totals[i];
    if (!(tot > 0)) return;
    var x0 = pad.l + i * slot, bx = x0 + (slot - barW) / 2, acc = 0, drawn = 0, top = -1;
    series.forEach(function(s, si) { if (val(s, i) > 0) top = si; });
    series.forEach(function(s, si) {
      var v = val(s, i);
      if (!v) return;
      var sh = v / tot, yb = y(acc), yt = y(acc + sh), gap = drawn ? Math.min(CHART_GAP, (yb - yt) / 2) : 0;
      acc += sh; drawn++;
      var read = shown[i] + ', ' + s.label + ': ' + formatNum(sh * 100, 1) + '% (' + chartFull(v, unit) + ')';
      svg += _chartDatum(read, '<rect class="inv-chart-bar ' + inks[si] + (si === top ? ' inv-chart-up' : '') + (i === td ? ' inv-chart-todate' : '') + '" x="' + _chartN(bx) + '" y="' + _chartN(yt) +
        '" width="' + _chartN(barW) + '" height="' + _chartN(Math.max(yb - yt - gap, 0.5)) + '"/>', { x: x0, y: yt, w: slot, h: yb - yt }, { key: opts.keys ? opts.keys[i] : l });
    });
  });
  svg += _chartXLabels(shown, labels.map(function(l, i) { return pad.l + i * slot + slot / 2; }), td, pad.t + ch + 14, W, opts.maxLabels) + '</svg>';
  var keyed = series.map(function(s, si) { return Object.assign({}, s, { ink: inks[si] }); });
  return _chartBox(svg + (series.length > 1 ? _chartSeriesLegend(keyed, unit, null) : ''), Object.assign({ readHint: 'Tap a part to read it' }, opts),
    { cols: [{ label: opts.labelHead || '' }].concat(series.map(function(s) { return { label: s.label, unit: 'pct' }; })),
      rows: shown.map(function(l, i) { return [l].concat(series.map(function(s) { return totals[i] > 0 ? val(s, i) / totals[i] * 100 : null; })); }) });
}

/* One share of a whole (0 to 1), its figure in the centre: a ring on a track in the card's well, the share in its slot or its
   tone. opts: slot | tone, centre (the figure, else the share as a percentage), sub (a word under it), label (what the share is
   of, for the readout and the table), ariaLabel, id. First for a client's share of the plant. */
function chartRing(value, opts) {
  opts = opts || {};
  var v = value == null || value === '' ? NaN : Number(value);
  if (!isFinite(v)) return _chartEmpty(opts.emptyText);
  var share = Math.max(0, Math.min(1, v)), pct = share * 100;
  var ink = opts.slot != null ? chartSlotClass(opts.slot) : opts.tone ? chartInk({ tone: opts.tone }) : chartSlotClass(1);
  var R = 48, C = 60, SW = 12, read = (opts.label || 'Share') + ': ' + formatNum(pct, 1) + '%';
  var arc = share >= 0.9999 ? '<circle class="inv-chart-ring-arc ' + ink + '" cx="' + C + '" cy="' + C + '" r="' + R + '" stroke-width="' + SW + '"/>'
    : share > 0 ? '<circle class="inv-chart-ring-arc ' + ink + '" cx="' + C + '" cy="' + C + '" r="' + R + '" stroke-width="' + SW + '" pathLength="100" stroke-dasharray="' + _chartN(pct) + ' 100" transform="rotate(-90 ' + C + ' ' + C + ')"/>' : '';
  var inner = '<circle class="inv-chart-ring-track" cx="' + C + '" cy="' + C + '" r="' + R + '" stroke-width="' + SW + '"/>' + arc +
    '<text x="' + C + '" y="' + (opts.sub ? C + 2 : C + 5) + '" text-anchor="middle" class="inv-chart-centre">' + escHtml(opts.centre != null ? opts.centre : formatNum(pct, 0) + '%') + '</text>' +
    (opts.sub ? '<text x="' + C + '" y="' + (C + 18) + '" text-anchor="middle" class="inv-chart-ring-sub">' + escHtml(opts.sub) + '</text>' : '');
  var svg = '<svg class="inv-chart-ring" viewBox="0 0 120 120" role="img" aria-label="' + escHtml(opts.ariaLabel || read) + '">' +
    _chartDatum(read, inner, { x: 0, y: 0, w: 120, h: 120 }, { key: opts.key }) + '</svg>';
  return _chartBox('<div class="inv-chart-ring-wrap">' + svg + '</div>', Object.assign({ readHint: 'Tap the ring to read it' }, opts),
    { cols: [{ label: opts.labelHead || '' }, { label: opts.valueHead || 'Share', unit: 'pct' }], rows: [[opts.label || 'Share', pct]] });
}

/* ===== SMALL CHARTS FOR CARDS (§6.24; owner, 8 Oct 2026: Today's "data presentation is still primitive") =====
   A sparkline: a figure's last months as one line, with a second measure dashed beside it where there is one (a price
   against its cost), and the latest point marked in the accent (the current period, DR-2). No axes: the card's figure says
   what the line is of, and the <title> carries every value. Stretched to its box, the stroke kept even (non-scaling). With
   opts.area the run is washed to the foot in its tone (a balance, the canvas's cash). */
function chartSpark(values, opts) {
  opts = opts || {};
  var vals = (values || []).map(function(v) { return v == null || !isFinite(v) ? null : Number(v); });
  var ref = Array.isArray(opts.ref) ? opts.ref.map(function(v) { return v == null || !isFinite(v) ? null : Number(v); }) : null;
  var all = vals.concat(ref || []).filter(function(v) { return v != null; });
  if (vals.filter(function(v) { return v != null; }).length < 2) return '';
  var W = 100, H = 30, P = 3, lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
  if (opts.zero && lo > 0) lo = 0;
  if (hi === lo) { hi += 1; lo -= 1; }
  var x = function(i) { return vals.length < 2 ? W / 2 : P + i * (W - 2 * P) / (vals.length - 1); };
  var y = function(v) { return H - P - (v - lo) / (hi - lo) * (H - 2 * P); };
  var path = function(list) {
    var d = '', pen = false;
    list.forEach(function(v, i) { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(2) + ' ' + y(v).toFixed(2); pen = true; });
    return d;
  };
  var last = -1;
  vals.forEach(function(v, i) { if (v != null) last = i; });
  // A period not yet ended (opts.toDate): the line runs into it dashed, and the title says "to date".
  var td = _chartToDate(opts, vals.length);
  var labels = (opts.labels || []).map(function(l, i) { return i === td && l ? chartToDateLabel(l) : l; });
  var title = opts.title ? opts.title + (td != null && labels[td] ? ' (' + labels[td] + ')' : '') : vals.map(function(v, i) { return (labels[i] ? labels[i] + ': ' : '') + (v == null ? '—' : chartFull(v, opts.unit || 'money')); }).filter(Boolean).join(' · ');
  var into = td != null && td > 0 && vals[td] != null && vals[td - 1] != null;
  var main = into ? vals.map(function(v, i) { return i === td ? null : v; }) : vals;
  // opts.area: the line's run washed down to the foot (the canvas's cash), from its first point to its last, one unbroken run.
  var a0 = main.findIndex(function(v) { return v != null; }), a1 = -1;
  main.forEach(function(v, i) { if (v != null) a1 = i; });
  var area = opts.area && a0 >= 0 && a1 > a0 && main.slice(a0, a1 + 1).every(function(v) { return v != null; });
  return '<svg class="inv-spark' + (opts.tone ? ' inv-spark-' + escHtml(opts.tone) : '') + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + escHtml(title) + '">' +
    '<title>' + escHtml(title) + '</title>' +
    (ref ? '<path class="inv-spark-ref" d="' + path(ref) + '"/>' : '') +
    (area ? '<path class="inv-spark-area" d="' + path(main) + 'L' + x(a1).toFixed(2) + ' ' + H + 'L' + x(a0).toFixed(2) + ' ' + H + 'Z"/>' : '') +
    '<path class="inv-spark-line" d="' + path(main) + '"/>' +
    (into ? '<path class="inv-spark-line inv-chart-todate" data-todate d="' + path(vals.map(function(v, i) { return Math.abs(i - td) <= 1 ? v : null; })) + '"/>' : '') +
    (last >= 0 && opts.dot !== false ? '<path class="inv-spark-dot" d="M' + x(last).toFixed(2) + ' ' + y(vals[last]).toFixed(2) + 'l0 0"/>' : '') + '</svg>';
}
/* Small bars (U2R §24f): a Small card's picture, as a sparkline is a tile's: a bar a period, drawn to the card's width at a fixed
   height, no axis, each bar's <title> its label and figure. bars: [{v, label, text, tone, on, hatch, todate}]: `tone` a status tone
   (the risk window's warning) else a light ink, `on` the one a figure is set against in the dark ink (last month, the canvas's
   Month to date); `todate` a period not yet ended, lighter, its title saying "to date"; `hatch`
   lines at 45° (true: across the bar, a period to date; 'info' or another tone: across the bar's whole slot in that tone's mark,
   the forecast's thunder hours). opts.title what the bars say, which a screen reader reads. */
function chartMiniBars(bars, opts) {
  opts = opts || {};
  var list = (bars || []).filter(Boolean);
  if (!list.length) return '';
  // A bar may carry where it lands (`proj`, the month at its pace): its outline is drawn to that height, dashed, over the bar.
  var max = Math.max.apply(null, list.map(function(b) { return Math.max(Number(b.v) || 0, Number(b.proj) || 0); }).concat([0]));
  var W = list.length * 10, H = 32, slot = 10, bw = 7;
  var hatch = function(x0, y0, w, h, cls) {
    var s = '';
    for (var k = -h; k < w; k += 3) {
      var xa = Math.max(x0, x0 + k), xb = Math.min(x0 + w, x0 + k + h);
      if (xb <= xa) continue;
      s += '<line class="inv-minibar-hatch' + cls + '" x1="' + _chartN(xa) + '" y1="' + _chartN(y0 + h - (xa - x0 - k)) + '" x2="' + _chartN(xb) + '" y2="' + _chartN(y0 + h - (xb - x0 - k)) + '"/>';
    }
    return s;
  };
  var body = list.map(function(b, i) {
    var v = Number(b.v) || 0, h = max > 0 ? Math.max(v > 0 ? 1.5 : 0, v / max * (H - 1)) : 0, x = i * slot + (slot - bw) / 2, y = H - h;
    var label = (b.label || '') + (b.todate ? ' to date' : ''), read = label + (b.text ? ': ' + b.text : '') + (b.projText ? ', ' + b.projText : '');
    var ph = b.proj > v && max > 0 ? b.proj / max * (H - 1) : 0;
    var tone = /^(ok|info|warning|danger)$/.test(b.tone) ? ' data-tone="' + b.tone + '"' : '';
    var band = b.hatch && b.hatch !== true ? hatch(i * slot, 0, slot, H, ' inv-minibar-hatch-' + escHtml(uiTone(b.hatch))) : '';
    return '<g class="inv-minibar-slot"><title>' + escHtml(read) + '</title>' + band +
      '<rect class="inv-minibar' + (b.todate ? ' inv-chart-todate' : '') + '"' + tone + (b.on && !tone ? ' data-on' : '') + ' x="' + _chartN(x) + '" y="' + _chartN(y) + '" width="' + bw + '" height="' + _chartN(Math.max(h, 0)) + '"/>' +
      (b.hatch === true && h > 0 ? hatch(x, y, bw, h, '') : '') +
      (ph > 0 ? '<rect class="inv-minibar-proj" x="' + _chartN(x) + '" y="' + _chartN(H - ph) + '" width="' + bw + '" height="' + _chartN(ph) + '"/>' : '') +
      '<rect class="inv-minibar-base" x="' + (i * slot) + '" y="' + (H - 0.5) + '" width="' + slot + '" height="0.5"/></g>';
  }).join('');
  return '<svg class="inv-minibars" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + escHtml(opts.title || '') + '">' + body + '</svg>';
}
/* A meter: shares of one whole as a bar, each part in its tone (a status tone, or neutral), with a mark where the figure is
   judged (80% of the plant's capacity, last month's revenue). `parts` [{v, tone}], `opts.max` the whole (else their sum),
   `opts.mark` a value on the same scale, `opts.title` what it says in words, which a screen reader reads. */
var _chartMeterN = 0;
var _chartBarsN = 0;
function chartMeter(parts, opts) {
  opts = opts || {};
  var list = (parts || []).filter(function(p) { return p && p.v > 0; });
  var sum = list.reduce(function(s, p) { return s + p.v; }, 0), max = opts.max > 0 ? Math.max(opts.max, sum) : sum;
  if (!(max > 0)) return '';
  // A part `hatch`ed (an estimate) is striped at 45°: drawn with no viewBox, its places shares of the width, so the stripes keep
  // their pixels (chartDayLanes' way).
  if (list.some(function(p) { return p.hatch; })) {
    var pid = 'invMeterHatch' + (++_chartMeterN), x0 = 0;
    var hr = list.map(function(p) {
      // A class's fill outranks the attribute, so a hatched part carries no tone's class: its stripes are the pattern's.
      var w = p.v / max * 100, r = '<rect class="' + (p.hatch ? 'inv-meter-hatched" fill="url(#' + pid + ')' : 'inv-meter-' + escHtml(p.tone || 'neutral')) + '" x="' + x0.toFixed(2) +
        '%" y="0" width="' + Math.max(0, w).toFixed(2) + '%" height="100%"></rect>';
      x0 += w;
      return r;
    }).join('');
    var hm = opts.mark != null && opts.mark > 0 ? Math.min(99.4, opts.mark / max * 100) : null;
    return '<svg class="inv-meter" width="100%" role="img" aria-label="' + escHtml(opts.title || '') + '">' + (opts.title ? '<title>' + escHtml(opts.title) + '</title>' : '') +
      '<defs><pattern id="' + pid + '" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><rect class="inv-meter-hatch" x="0" y="0" width="1.5" height="4"/></pattern></defs>' +
      '<rect class="inv-meter-track" x="0" y="0" width="100%" height="100%"></rect>' + hr +
      (hm != null ? '<rect class="inv-meter-mark" x="' + hm.toFixed(2) + '%" y="0" width="1" height="100%"></rect>' : '') + '</svg>';
  }
  var at = 0, rects = list.map(function(p) {
    var w = p.v / max * 100, r = '<rect class="inv-meter-' + escHtml(p.tone || 'neutral') + '" x="' + at.toFixed(2) + '" y="0" width="' + Math.max(0, w).toFixed(2) + '" height="8"></rect>';
    at += w;
    return r;
  }).join('');
  var mark = opts.mark != null && opts.mark > 0 ? Math.min(99.4, opts.mark / max * 100) : null;
  return '<svg class="inv-meter" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label="' + escHtml(opts.title || '') + '">' +
    (opts.title ? '<title>' + escHtml(opts.title) + '</title>' : '') +
    '<rect class="inv-meter-track" x="0" y="0" width="100" height="8"></rect>' + rects +
    (mark != null ? '<rect class="inv-meter-mark" x="' + mark.toFixed(2) + '" y="0" width="0.6" height="8"></rect>' : '') + '</svg>';
}
/* A day on one bar, 6 AM to 6 AM the next (§6.24): when something ran, in its tone, and when it stood (a cut, danger), the
   general shift's two ends marked, the hours under it. `spans` [{from, to, tone}] in minutes from midnight, a span past
   midnight running on past 1440 (as the Power tab counts them); one with no end is a tick. `opts.title` says it in words. */
var CHART_DAY_START = 360;
function chartDayStrip(spans, opts) {
  opts = opts || {};
  var x = function(m) { return Math.max(0, Math.min(100, (m - CHART_DAY_START) / 1440 * 100)); };
  var on = function(m) { return m < CHART_DAY_START ? m + 1440 : m; };
  var rects = (spans || []).map(function(sp) {
    if (sp.from == null) return '';
    var a = on(sp.from), b = sp.to == null ? a : sp.to;
    if (b < a) b += 1440;
    var x0 = x(a), w = Math.max(0.8, x(b) - x0);
    return '<rect class="inv-meter-' + escHtml(sp.tone || 'ok') + '" x="' + x0.toFixed(2) + '" y="0" width="' + w.toFixed(2) + '" height="8"></rect>';
  }).join('');
  var marks = (opts.marks || [510, 1020]).map(function(m) { return '<rect class="inv-meter-mark" x="' + x(on(m)).toFixed(2) + '" y="0" width="0.4" height="8"></rect>'; }).join('');
  // Spans, so it may sit inside a row's button (phrasing content only).
  return '<span class="inv-daystrip"><svg class="inv-meter" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label="' + escHtml(opts.title || '') + '">' +
    (opts.title ? '<title>' + escHtml(opts.title) + '</title>' : '') + '<rect class="inv-meter-track" x="0" y="0" width="100" height="8"></rect>' + rects + marks + '</svg>' +
    (opts.axis === false ? '' : '<span class="inv-daystrip-axis" aria-hidden="true"><span>6 AM</span><span>noon</span><span>6 PM</span><span>midnight</span><span>6 AM</span></span>') + '</span>';
}
/* A Ledger line's bar (widgets.js wdgLedgerHtml's `bars`, the canvas's Why it moved): from a middle rule, left for less and right for
   more, every line on one scale (`max`, the largest of them), stretched to its column with no aspect, the rule and the bar their own
   height; nothing but the rule for a line of nothing. */
function chartLedgerBar(v, max) {
  var w = max > 0 && Math.abs(v) > 0 ? Math.max(1.5, Math.abs(v) / max * 46) : 0;
  return '<svg class="inv-ledger-bar" viewBox="0 0 96 12" preserveAspectRatio="none" aria-hidden="true"><line class="inv-ledger-bar-mid" x1="48" x2="48" y1="0" y2="12"/>' +
    (w ? '<rect class="inv-ledger-bar-' + (v < 0 ? 'less' : 'more') + '" x="' + _chartN(v < 0 ? 48 - w : 48) + '" y="2" width="' + _chartN(w) + '" height="8"/>' : '') + '</svg>';
}
/* A day in lanes (the canvas's floor now): a lane a line, 6 AM to 6 AM, its runs in the ok mark (a run outside the general shift
   lighter), the day's cuts hatched in the danger mark across every lane, the general shift's ends dashed, and now. Drawn with no
   viewBox, so a span's place and width are shares of the width while the lanes, the hatching and the word "now" keep their pixels
   (the lane is 12, the gap 6, the room over the lanes for "now" 14; `compact`, the phone's, 10, 4 and 12: --lane-h, --lane-gap and
   --lane-top, which the labels beside them read). lanes: [{label, title, spans: [{from, to, ot}]}] in minutes, a time before 6 AM the
   next day's; opts: {cuts: [{from, to}], now (minutes, today only), shift: [from, to], title, compact}. The labels and the axis are
   HTML, so they never stretch. */
var _chartLanesN = 0;
function chartDayLanes(lanes, opts) {
  opts = opts || {};
  var list = (lanes || []).filter(Boolean);
  if (!list.length) return '';
  var LH = opts.compact ? 10 : 12, GAP = opts.compact ? 4 : 6, TOP = opts.compact ? 12 : 14, n = list.length, H = TOP + n * LH + (n - 1) * GAP + 2;
  var on = function(m) { return m < CHART_DAY_START ? m + 1440 : m; };
  var pct = function(m) { return Math.max(0, Math.min(100, (m - CHART_DAY_START) / 1440 * 100)); };
  var place = function(sp) {
    var a = on(sp.from), b = sp.to == null ? a : on(sp.to);
    if (b < a) b += 1440;
    var x0 = pct(a);
    return { x: x0, w: Math.max(0.6, pct(b) - x0) };
  };
  var pid = 'invLaneCut' + (++_chartLanesN), cuts = (opts.cuts || []).filter(function(c) { return c && c.from != null; }).map(place);
  var body = list.map(function(ln, i) {
    var y = TOP + i * (LH + GAP);
    var runs = (ln.spans || []).filter(function(sp) { return sp && sp.from != null; }).map(function(sp) {
      var p = place(sp);
      return '<rect class="inv-lane-run' + (sp.ot ? ' inv-lane-ot' : '') + '" x="' + p.x.toFixed(2) + '%" y="' + y + '" width="' + p.w.toFixed(2) + '%" height="' + LH + '" rx="3"/>';
    }).join('');
    var cut = cuts.map(function(p) {
      return '<rect class="inv-lane-cut" fill="url(#' + pid + ')" x="' + p.x.toFixed(2) + '%" y="' + (y - 2) + '" width="' + p.w.toFixed(2) + '%" height="' + (LH + 4) + '" rx="2"/>';
    }).join('');
    return '<g><title>' + escHtml(ln.title || ln.label || '') + '</title><rect class="inv-lane" x="0" y="' + y + '" width="100%" height="' + LH + '" rx="3"/>' + runs + cut + '</g>';
  }).join('');
  var sh = opts.shift || [510, 1020];
  var shift = sh.map(function(m) { var x = pct(on(m)).toFixed(2); return '<line class="inv-lane-shift" x1="' + x + '%" x2="' + x + '%" y1="' + (TOP - 2) + '" y2="' + H + '"/>'; }).join('');
  var now = '';
  if (opts.now != null) {
    var xn = pct(on(opts.now)), anchor = xn < 4 ? 'start' : xn > 96 ? 'end' : 'middle';
    now = '<rect class="inv-lane-now" x="' + xn.toFixed(2) + '%" y="' + (TOP - 4) + '" width="2" height="' + (H - TOP + 4) + '" transform="translate(-1 0)"/>' +
      '<text class="inv-lane-now-word" x="' + xn.toFixed(2) + '%" y="' + (TOP - 6) + '" text-anchor="' + anchor + '">now</text>';
  }
  return '<div class="inv-daylanes"' + (opts.compact ? ' data-compact' : '') + '><span class="inv-daylanes-labels" aria-hidden="true">' + list.map(function(ln) { return '<span>' + escHtml(ln.label || '') + '</span>'; }).join('') + '</span>' +
    '<svg class="inv-daylanes-svg" width="100%" height="' + H + '" role="img" aria-label="' + escHtml(opts.title || '') + '"><defs><pattern id="' + pid +
    '" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><rect class="inv-lane-hatch" x="0" y="0" width="2" height="4"/></pattern></defs>' +
    body + shift + now + '</svg><span></span><span class="inv-daystrip-axis" aria-hidden="true"><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span><span>6 AM</span></span></div>';
}
