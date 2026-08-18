/* ===== STATS (Phase 7 — Analytics Rework) =====
 *
 * This is a job-work business priced in rupees per kilogram. Revenue on its
 * own says almost nothing here: the same ₹1L of billing is a good month at
 * 8 tonnes and a loss-making one at 20. So every headline figure is carried
 * alongside the tonnage that produced it, and the ratio between them —
 * realisation, ₹/kg — is treated as the primary number rather than a
 * derived one.
 *
 * Against a full cost of ₹8.55/kg (Settings → Cost of Goods) and a blended
 * realisation near ₹8.45, the gap between a profitable client and a
 * loss-making one is under two rupees a kilo. Nothing in this dashboard used
 * to show it. The client realisation table does.
 */

var _statsPeriod = 'mtd';
var _statsTrendGran = 'month';
/* What the trend plots, and how. Revenue alone answers "did we bill more";
   tonnage answers "did we plate more"; incoming material answers "is work
   still arriving" — which leads the other two and is the one that warns. */
var _statsTrendSeries = 'revenue';
var _statsTrendType = 'line';
/* Composition is a share question, so it gets a share shape as well as a
   ranked one — the pie says "how much of the plant is this account". */
var _statsClientChart = 'bar';
/* Top items ranked by money, by weight, or by price. The card used to rank by
   money alone, which is the one ranking this business's own thesis says is
   insufficient: the same revenue is a good month at 8 tonnes and a bad one at
   20, and the parts filling the plant are not the parts paying for it. */
var _statsTopBy = 'value';

/* ===== PERIOD MATH =====
 * Periods are measured on the invoice DATE, not on when the record happened to
 * be typed. An invoice dated 31 July and entered on 2 August belongs to July —
 * that is the date on the document, the date GSTR-1 reports it under, and the
 * date the customer will quote back. createdAt is the fallback only for rows
 * that somehow carry no date at all.
 */
function invPeriodTs(inv) {
  if (inv && inv.date) {
    var p = inv.date.split('-');
    // Timezone-safe construction: never new Date("YYYY-MM-DD").
    if (p.length === 3) return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)).getTime();
  }
  return (inv && inv.createdAt) || 0;
}

/* Same day-of-month in a target month, clamped to that month's last day.
   Without the clamp, "the 31st, one month back" from 31 March silently
   becomes 3 March and the comparison period is wrong by three days. */
function dayInMonth(year, monthIdx, day) {
  var lastDay = new Date(year, monthIdx + 1, 0).getDate();
  return new Date(year, monthIdx, Math.min(day, lastDay), 23, 59, 59, 999);
}

/* Range for a period, offset periods back. offset 0 is the current period,
   1 the comparable stretch of the previous month / quarter / financial year. */
function periodRange(period, offset) {
  if (period === 'all') return null;
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  offset = offset || 0;

  if (period === 'mtd') {
    return {
      start: new Date(y, m - offset, 1).getTime(),
      end: dayInMonth(y, m - offset, d).getTime()
    };
  }
  if (period === 'qtd') {
    var qStart = m - (m % 3);
    var monthsIn = m - qStart;
    return {
      start: new Date(y, qStart - offset * 3, 1).getTime(),
      end: dayInMonth(y, qStart - offset * 3 + monthsIn, d).getTime()
    };
  }
  if (period === 'ytd') {
    // Indian financial year: 1 April to 31 March.
    var fyStart = m >= 3 ? y : y - 1;
    return {
      start: new Date(fyStart - offset, 3, 1).getTime(),
      end: dayInMonth(y - offset, m, d).getTime()
    };
  }
  return null;
}

function filterByPeriod(invoices, period, offset) {
  var range = periodRange(period, offset);
  if (!range) return offset ? [] : invoices;
  return invoices.filter(function(inv) {
    var ts = invPeriodTs(inv);
    return ts >= range.start && ts <= range.end;
  });
}

var PERIOD_LABELS = { mtd: 'MTD', qtd: 'QTD', ytd: 'YTD', all: 'All Time' };
var PERIOD_PRIOR_LABELS = {
  mtd: 'same days last month',
  qtd: 'same stretch last quarter',
  ytd: 'same stretch last year',
  all: ''
};

/* ===== TONNAGE =====
 * Weight for one line, with an explicit flag for whether it is actually known.
 * KG lines carry it directly. NOS lines need a per-piece weight: partWeights is
 * the operator-entered table that the nos_to_weight billing mode already prices
 * against, and the Items Master stdWeightKg is the fallback.
 *
 * Some of those master weights were recovered as pieceRate ÷ ratePerKg. Such a
 * weight prices back at exactly that rate, so it can never rank a part by
 * margin — but it measures tonnage correctly, and tonnage is the only thing it
 * is used for here.
 */
function lineWeightKg(item, client, dateStr) {
  if (!item) return { kg: 0, known: false };
  var qty = item.qty || 0;
  if ((item.unit || 'KG') === 'KG') return { kg: qty, known: qty > 0 };

  var key = (item.partNumber || '').toUpperCase();
  var per = (S.partWeights && S.partWeights[key] != null) ? S.partWeights[key] : null;
  if (per == null) {
    var master = (S.items || []).find(function(it) {
      return (it.partNumber || '').toUpperCase() === key;
    });
    if (master && master.stdWeightKg != null) per = master.stdWeightKg;
  }
  if (per != null && per > 0) return { kg: qty * per, known: true };

  /* Piece-billed line with nothing in the catalogue: the weight is on the line
     itself and needs no registry at all. The piece rate WAS weight x ratePerKg,
     so the line's own amount / ratePerKg is its weight.

     This is not a nicety. 127 of SSSMehta's lines name parts with no Items
     Master row whatsoever — 17% of that client's revenue — and going through
     the registry left every one of them uncounted. Their part numbers also
     vary in spelling between invoices ("Clamp 165x83" against
     "CLAMP 165X83(40X6)"), so registry matching would stay fragile even if
     the rows existed. Reading the line direct sidesteps both. */
  if (client && client.billingMode === 'piece' && (item.amount || 0) > 0) {
    var rateInfo = getLineItemRate(client, dateStr || localDateStr(), item.partNumber);
    // An itemRates override is a negotiated per-piece figure with no weight
    // basis; inverting it would invent a number rather than recover one.
    if (!rateInfo._override && rateInfo.ratePerKg > 0) {
      return { kg: (item.amount || 0) / rateInfo.ratePerKg, known: true };
    }
  }
  return { kg: 0, known: false };
}

/* Client for an invoice or challan row, cached per call site by the callers
   that loop. Returns null when the row names a client that no longer exists. */
function rowClient(row) {
  if (!row || row.clientId == null) return null;
  return S.clients.find(function(c) { return c.id === row.clientId; }) || null;
}

/* Aggregate tonnage, carrying both the revenue it covers and the revenue it
   does not.

   Realisation must divide revenue by tonnage over THE SAME LINES. Dividing
   total revenue by weighed-only tonnage inflates the answer by exactly
   1 / (revenue coverage) — on live data that turned ₹13.00/kg into ₹21.23/kg,
   because the lines with no weight are not a random sample. They are the
   piece-billed work, which is the whole low-realisation end of the book.

   Pass `credits` (from cnCreditByInvoice) to read revenue net of credit notes.
   The weights are untouched by it — see the netting notes in credit-note.js:
   the plating happened, only the price changed, and that asymmetry is the
   whole reason the rate moves. */
function weighLines(rows, credits) {
  var kg = 0, lines = 0, known = 0, revKnown = 0, revUnknown = 0, credit = 0;
  rows.forEach(function(row) {
    var client = rowClient(row);
    var f = cnNetFactor(row, credits);
    if (credits) credit += (credits[row.id] || 0);
    (row.items || []).forEach(function(it) {
      lines++;
      var amt = (it.amount || 0) * f;
      var w = lineWeightKg(it, client, row.date || row.challanDate);
      if (w.known) { known++; kg += w.kg; revKnown += amt; }
      else { revUnknown += amt; }
    });
  });
  var revTotal = revKnown + revUnknown;
  return {
    kg: kg, lines: lines, known: known,
    revKnown: revKnown, revUnknown: revUnknown, credit: credit,
    // Coverage by revenue, not by line count: one unweighed line worth ₹10L
    // matters more than fifty worth ₹500, and it is the ratio that governs
    // how far the realisation figure can be trusted.
    coverage: revTotal > 0 ? revKnown / revTotal : 1,
    lineCoverage: lines > 0 ? known / lines : 1
  };
}

/* Below this, a per-kg figure is drawn from too little of the client's book to
   sit in a ranked column beside a fully weighed one. */
var REALISATION_MIN_COVERAGE = 0.9;

/* Taxable value, net of credit notes when a credit map is supplied. */
function sumTaxable(invoices, credits) {
  return invoices.reduce(function(s, i) {
    return s + (i.taxableValue || 0) * cnNetFactor(i, credits);
  }, 0);
}

/* ===== DELTA CHIPS ===== */
function deltaHtml(cur, prev) {
  // A percentage against no prior activity is noise dressed as a signal.
  if (prev == null || !isFinite(prev) || prev === 0) {
    return '<span class="inv-kpi-delta inv-kpi-delta-flat">no prior period</span>';
  }
  var pct = ((cur - prev) / Math.abs(prev)) * 100;
  var rising = pct > 0.5, falling = pct < -0.5;
  var cls = rising ? 'inv-kpi-delta-up' : falling ? 'inv-kpi-delta-down' : 'inv-kpi-delta-flat';
  var arrow = rising ? '&uarr;' : falling ? '&darr;' : '';
  return '<span class="inv-kpi-delta ' + cls + '">' + arrow +
    (rising || falling ? ' ' + formatNum(Math.abs(pct), 1) + '%' : 'level') + '</span>';
}

/* A row of toggle chips. Four cards needed the same markup, and the trend card
   needed two rows of it. */
function statsChipRow(action, dataKey, labels, current) {
  var html = '<div class="inv-stats-chips inv-stats-chips-sm">';
  Object.keys(labels).forEach(function(k) {
    html += '<button class="inv-chip' + (current === k ? ' inv-chip-active' : '') +
      '" data-action="' + action + '" data-' + dataKey + '="' + escHtml(k) + '">' +
      escHtml(labels[k]) + '</button>';
  });
  return html + '</div>';
}

function kpiTile(label, value, sub, delta) {
  return '<div class="inv-kpi">' +
    '<div class="inv-kpi-label">' + escHtml(label) + '</div>' +
    '<div class="inv-kpi-value">' + value + '</div>' +
    (sub ? '<div class="inv-kpi-sub">' + sub + '</div>' : '') +
    (delta || '') + '</div>';
}

var TREND_MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ISO 8601 week (Mon..Sun, week 1 contains Jan 4). Returns YYYY-Www.
function isoWeekKey(yyyymmdd) {
  var d = new Date(yyyymmdd + 'T00:00:00');
  if (isNaN(d)) return yyyymmdd;
  var dayNum = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayNum + 3);
  var firstThursday = new Date(d.getFullYear(), 0, 4);
  var firstDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3);
  var wk = 1 + Math.round((d - firstThursday) / 604800000);
  return d.getFullYear() + '-W' + (wk < 10 ? '0' + wk : '' + wk);
}

function formatTrendLabel(key, gran) {
  if (gran === 'day') {
    var p = key.split('-');
    return parseInt(p[2], 10) + ' ' + TREND_MONTH_LABELS[parseInt(p[1], 10) - 1];
  }
  if (gran === 'week') {
    return 'W' + key.slice(-2) + ' ' + key.slice(2, 4);
  }
  var pp = key.split('-');
  return TREND_MONTH_LABELS[parseInt(pp[1], 10) - 1] + ' ' + pp[0].slice(2);
}

/* Every period key between two dates, in order, including the ones with no
   data. Walking days and bucketing each is the one loop that works for all
   three granularities — incrementing an ISO week key by hand does not.

   Filling the gaps matters more than it sounds. A client who billed in January,
   stopped for three months and came back in May used to render as two adjacent
   bars, reading as continuous work. The empty months ARE the signal, and a
   chart that omits them hides the exact collapse it is being consulted about. */
function periodKeysBetween(minIso, maxIso, gran) {
  var keys = [], seen = {};
  var d = new Date(minIso + 'T00:00:00');
  var end = new Date(maxIso + 'T00:00:00');
  if (isNaN(d) || isNaN(end)) return keys;
  // Hard stop: a corrupt date can otherwise spin this for ever.
  var guard = 0;
  while (d <= end && guard++ < 4000) {
    var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
    var k = gran === 'day' ? iso : gran === 'week' ? isoWeekKey(iso) : iso.substring(0, 7);
    if (!seen[k]) { seen[k] = true; keys.push(k); }
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

/* Trend buckets for one series. Revenue and tonnage come off the invoices;
   incoming material comes off the challans, which is a different spine and a
   different date — the challan date, not the invoice date. */
function buildTrendSeries(gran, series) {
  var by = {};
  // Revenue is plotted net of credit notes, so the trend line and the headline
  // figure above it cannot disagree about what a month earned.
  var credits = cnCreditByInvoice();
  var minDate = null, maxDate = null;
  function bucket(dateStr) {
    if (!minDate || dateStr < minDate) minDate = dateStr;
    if (!maxDate || dateStr > maxDate) maxDate = dateStr;
    if (gran === 'day') return dateStr;
    if (gran === 'week') return isoWeekKey(dateStr);
    return dateStr.substring(0, 7);
  }

  if (series === 'im') {
    (S.incomingMaterial || []).forEach(function(im) {
      var d = im.challanDate || im.receivedDate;
      if (!d) return;
      var client = S.clients.find(function(c) { return c.id === im.clientId; }) || null;
      var kg = 0;
      (im.items || []).forEach(function(it) {
        var w = lineWeightKg(it, client, d);
        if (w.known) kg += w.kg;
      });
      var k = bucket(d);
      by[k] = (by[k] || 0) + kg;
    });
  } else {
    S.invoices.filter(function(i) { return i.status === 'active'; }).forEach(function(inv) {
      if (!inv.date) return;
      var k = bucket(inv.date);
      if (series === 'tonnage') {
        var client = rowClient(inv);
        var kg = 0;
        (inv.items || []).forEach(function(it) {
          var w = lineWeightKg(it, client, inv.date);
          if (w.known) kg += w.kg;
        });
        by[k] = (by[k] || 0) + kg;
      } else {
        by[k] = (by[k] || 0) + (inv.taxableValue || 0) * cnNetFactor(inv, credits);
      }
    });
  }

  // Cap series length per granularity for readability + perf.
  var cap = gran === 'day' ? 90 : gran === 'week' ? 26 : 12;
  if (!minDate) return [];
  var keys = periodKeysBetween(minDate, maxDate, gran).slice(-cap);
  return keys.map(function(k) { return { label: formatTrendLabel(k, gran), value: by[k] || 0 }; });
}

var TREND_SERIES_UNIT = { revenue: 'money', tonnage: 'kg', im: 'kg' };

/* Ranked parts. `by` decides the ordering, and it is not cosmetic: ranking by
   value answers "what earns", by tonnage "what fills the plant", and by ₹/kg
   "what is priced worst". Those are three different top-tens.

   The ₹/kg ranking admits only rows whose weight is actually known — a rate
   computed from a partial weight is not a rate — and says how many it dropped
   rather than silently ranking fewer parts. */
function buildTopItems(invoices, by, credits) {
  var byPart = {};
  invoices.forEach(function(inv) {
    var client = rowClient(inv);
    // A batch discount is not attributable to one part, but it IS a flat
    // percentage of every line in the batch, so each line carries its share.
    // Without this the ₹/kg ranking would price the discounted account's parts
    // 2% above what they earn, which is the end of the ranking that matters.
    var f = cnNetFactor(inv, credits);
    (inv.items || []).forEach(function(it) {
      var key = it.partNumber || it.desc || 'Unknown';
      if (!byPart[key]) byPart[key] = { part: key, desc: it.desc || '', qty: 0, amount: 0, kg: 0, kgKnown: true };
      byPart[key].qty += (it.qty || 0);
      byPart[key].amount += (it.amount || 0) * f;
      var w = lineWeightKg(it, client, inv.date);
      if (w.known) byPart[key].kg += w.kg; else byPart[key].kgKnown = false;
    });
  });

  var all = Object.values(byPart);
  all.forEach(function(r) {
    r.perKg = (r.kgKnown && r.kg > 0) ? r.amount / r.kg : null;
  });

  var eligible = all;
  var dropped = 0;
  if (by === 'tonnage' || by === 'rate') {
    eligible = all.filter(function(r) { return r.kgKnown && r.kg > 0; });
    dropped = all.length - eligible.length;
  }

  var sorted = eligible.slice().sort(function(a, b) {
    if (by === 'tonnage') return b.kg - a.kg;
    // Worst-priced first, matching how clients are ranked: the interesting end
    // of a price ranking is the bottom.
    if (by === 'rate') return a.perKg - b.perKg;
    return b.amount - a.amount;
  });

  return { rows: sorted.slice(0, 10), dropped: dropped, total: all.length };
}

/* Per-client revenue, tonnage and realisation for a period. The table this
   feeds is the reason the rework happened: a client can be near the top by
   revenue and still be sold below cost, and only ₹/kg shows it. */
function buildClientRollup(invoices, credits) {
  var by = {};
  invoices.forEach(function(inv) {
    var key = inv.clientId;
    if (!by[key]) {
      by[key] = { clientId: key, name: inv.clientName, total: 0, count: 0, kg: 0, revKnown: 0, revUnknown: 0, credit: 0 };
    }
    var f = cnNetFactor(inv, credits);
    by[key].total += (inv.taxableValue || 0) * f;
    if (credits) by[key].credit += (credits[inv.id] || 0);
    by[key].count++;
    var client = rowClient(inv);
    (inv.items || []).forEach(function(it) {
      var amt = (it.amount || 0) * f;
      var w = lineWeightKg(it, client, inv.date);
      if (w.known) { by[key].kg += w.kg; by[key].revKnown += amt; }
      else { by[key].revUnknown += amt; }
    });
  });
  return Object.values(by).map(function(r) {
    var lineRev = r.revKnown + r.revUnknown;
    r.coverage = lineRev > 0 ? r.revKnown / lineRev : 1;
    // Matched subset, same rule as the blended figure.
    r.realisation = r.kg > 0 ? r.revKnown / r.kg : null;
    r.comparable = r.realisation != null && r.coverage >= REALISATION_MIN_COVERAGE;
    return r;
  }).sort(function(a, b) { return b.total - a.total; });
}

function renderRevenueBarSvg(ranked, maxVal) {
  if (ranked.length === 0) return '<div class="inv-empty-state">' +
    'No revenue in this period' +
    '<div class="inv-mt-16"><button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invCreateNew">Create an invoice</button></div>' +
    '</div>';
  var html = '<div class="inv-revbar-list">';
  ranked.forEach(function(r) {
    var pct = maxVal > 0 ? (r.total / maxVal) * 100 : 0;
    var fillW = Math.max(pct, 0.5);
    html += '<div class="inv-revbar-row" data-action="invStatsClientDrill" data-client-id="' + r.clientId + '">' +
      '<div class="inv-revbar-track">' +
        '<svg class="inv-revbar-svg" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">' +
          '<rect width="' + fillW + '" height="28" rx="3" class="inv-revbar-fill"/>' +
        '</svg>' +
      '</div>' +
      '<div class="inv-revbar-meta">' +
        '<div class="inv-revbar-name">' + escHtml(r.name) + '</div>' +
        '<div class="inv-revbar-amount">' + formatCurrency(r.total) + '</div>' +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  return html;
}

function renderStats() {
  var toolbar = document.getElementById('statsToolbar');
  var area = document.getElementById('statsContent');
  if (!area) return;

  // Period chips
  if (toolbar) {
    var chips = ['mtd', 'qtd', 'ytd', 'all'];
    var chipLabels = { mtd: 'MTD', qtd: 'QTD', ytd: 'YTD', all: 'All' };
    var chipHtml = '<div class="inv-stats-chips">';
    chips.forEach(function(p) {
      chipHtml += '<button class="inv-chip' + (_statsPeriod === p ? ' inv-chip-active' : '') +
        '" data-action="invStatsPeriod" data-period="' + p + '">' + chipLabels[p] + '</button>';
    });
    chipHtml += '</div>';
    toolbar.innerHTML = chipHtml;
  }

  var activeInvs = S.invoices.filter(function(i) { return i.status === 'active'; });
  var filtered = filterByPeriod(activeInvs, _statsPeriod);
  var prior = filterByPeriod(activeInvs, _statsPeriod, 1);
  var html = '';

  /* Every money figure below is net of credit notes, allocated back to the
     invoices each note credits. Read the netting notes in credit-note.js
     before changing this: the allocation is by invoice, not by the note's own
     date, and it deliberately leaves tonnage alone. */
  var credits = cnCreditByInvoice();
  var totalRev = sumTaxable(filtered, credits);
  var grossRev = sumTaxable(filtered);
  var creditApplied = cnCreditOn(filtered, credits);
  var totalGrand = filtered.reduce(function(s, i) {
    return s + (i.grandTotal || 0) * cnNetFactor(i, credits);
  }, 0);
  var priorRev = sumTaxable(prior, credits);
  var tonnage = weighLines(filtered, credits);
  var priorTonnage = weighLines(prior, credits);
  var costPerKg = S.defaultCostPerKg || 0;

  // Revenue on weighed lines over the tonnage of those same lines.
  var realisation = tonnage.kg > 0 ? tonnage.revKnown / tonnage.kg : null;
  var priorRealisation = priorTonnage.kg > 0 ? priorTonnage.revKnown / priorTonnage.kg : null;
  var contribution = (realisation != null && costPerKg > 0) ? realisation - costPerKg : null;
  var grossMargin = (contribution != null) ? contribution * tonnage.kg : null;

  /* ===== Card 1: the four numbers that decide the month ===== */
  var comparable = _statsPeriod !== 'all' && prior.length > 0;
  html += '<div class="inv-stats-card inv-stats-card-full">' +
    '<div class="inv-stats-title">' + escHtml(PERIOD_LABELS[_statsPeriod] || '') + ' Performance' +
    (comparable ? '<span class="inv-stats-title-sub">vs ' + escHtml(PERIOD_PRIOR_LABELS[_statsPeriod]) + '</span>' : '') +
    '</div><div class="inv-kpi-grid">' +
    kpiTile('Taxable Revenue', formatCurrency(totalRev),
      filtered.length + ' invoice' + (filtered.length === 1 ? '' : 's') +
        ' · ' + formatCurrency(totalGrand) + ' incl. GST' +
        (creditApplied > 0 ? ' · net of ' + formatCurrency(creditApplied) + ' credited' : ''),
      comparable ? deltaHtml(totalRev, priorRev) : '') +
    kpiTile('Tonnage', formatNum(tonnage.kg / 1000, 2) + ' t',
      formatNum(tonnage.kg, 0) + ' kg',
      comparable ? deltaHtml(tonnage.kg, priorTonnage.kg) : '') +
    kpiTile('Realisation', realisation != null ? formatCurrency(realisation) + '/kg' : '&mdash;',
      costPerKg > 0 ? 'cost ' + formatCurrency(costPerKg) + '/kg' : 'set a cost in Settings',
      (comparable && realisation != null && priorRealisation != null) ? deltaHtml(realisation, priorRealisation) : '') +
    kpiTile('Gross Margin', grossMargin != null ? formatCurrency(grossMargin) : '&mdash;',
      contribution != null ? formatCurrency(contribution) + '/kg contribution' : 'needs tonnage and cost',
      '') +
    '</div>';

  // Tonnage is only ever as good as the weights behind it — and the lines that
  // lack weights are not a random sample, they are the piece-billed work. Say
  // so in place, in revenue terms, rather than letting a partial figure pass.
  if (tonnage.lines > 0 && tonnage.coverage < 0.999) {
    var missing = tonnage.lines - tonnage.known;
    html += '<div class="inv-stats-caveat">Tonnage and realisation cover <strong>' +
      Math.round(tonnage.coverage * 100) + '% of revenue</strong> &mdash; ' +
      missing + ' line' + (missing === 1 ? ' worth ' : 's worth ') + formatCurrency(tonnage.revUnknown) +
      (missing === 1 ? ' is' : ' are') + ' priced in NOS with no weight on file, and excluded from both figures. ' +
      'That exclusion is not neutral: unweighed lines are typically piece-billed work, which is ' +
      'the low-realisation end of the book, so the rate above reads better than the real blend. ' +
      'Items Master &rarr; Derive weights from rates closes it.</div>';
  }
  /* Say the netting is happening, in place. A ₹/kg that silently differs from
     the rate card by 2% invites the reader to conclude the rate card is wrong. */
  if (creditApplied > 0) {
    var creditPct = grossRev > 0 ? (creditApplied / grossRev) * 100 : 0;
    html += '<div class="inv-stats-caveat">Net of <strong>' + formatCurrency(creditApplied) +
      '</strong> of credit notes &mdash; ' + formatNum(creditPct, 1) + '% of the ' +
      formatCurrency(grossRev) + ' invoiced. Each note is booked against the invoices it ' +
      'credits, not the date it was raised, so a batch straddling the period boundary splits. ' +
      'Tonnage is untouched: the plating happened, only the price changed, which is what ' +
      'brings the rate down.</div>';
  }
  var unallocated = cnUnallocated(credits);
  if (unallocated > 0) {
    html += '<div class="inv-stats-alert">' + formatCurrency(unallocated) + ' of credit notes ' +
      'names invoices that no longer exist, so it is netted off nothing. The customer still ' +
      'paid that much less. Check the number audit for what was deleted.</div>';
  }
  if (contribution != null && contribution < 0) {
    html += '<div class="inv-stats-alert">Realisation is ' + formatCurrency(Math.abs(contribution)) +
      '/kg below full cost. At this tonnage that is ' + formatCurrency(Math.abs(grossMargin)) + ' of loss for the period.</div>';
  }
  html += '</div>';

  /* ===== Card 2: GST position ===== */
  /* Net of credit notes here too, and for a stronger reason than consistency:
     a credit note goes to GSTR-1 table 9B and reduces the liability. The same
     per-invoice factor does it — the note's own GST is 18% of the credit for
     exactly the reason the invoice's is 18% of the invoice. */
  var cgst = 0, sgst = 0, igst = 0, unfiledTax = 0, unfiledCount = 0, creditTax = 0;
  filtered.forEach(function(inv) {
    var f = cnNetFactor(inv, credits);
    var tax = (inv.cgstAmt || 0) + (inv.sgstAmt || 0) + (inv.igstAmt || 0);
    cgst += (inv.cgstAmt || 0) * f;
    sgst += (inv.sgstAmt || 0) * f;
    igst += (inv.igstAmt || 0) * f;
    creditTax += tax * (1 - f);
    if (getInvState(inv) !== 'filed') {
      unfiledTax += tax * f;
      unfiledCount++;
    }
  });
  var outputTax = gstRound(cgst + sgst + igst);
  html += '<div class="inv-stats-card">' +
    '<div class="inv-stats-title">Output Tax</div>' +
    '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Total Output Tax</span>' +
    '<span class="inv-stats-metric-value">' + formatCurrency(outputTax) + '</span></div>' +
    (cgst > 0 ? '<div class="inv-stats-row"><span class="inv-stats-name">CGST + SGST @ 9% each</span>' +
      '<span class="inv-stats-val">' + formatCurrency(gstRound(cgst + sgst)) + '</span></div>' : '') +
    (igst > 0 ? '<div class="inv-stats-row"><span class="inv-stats-name">IGST @ 18%</span>' +
      '<span class="inv-stats-val">' + formatCurrency(igst) + '</span></div>' : '') +
    (creditTax > 0 ? '<div class="inv-stats-row"><span class="inv-stats-name">Less credit notes (9B)</span>' +
      '<span class="inv-stats-val">&minus;' + formatCurrency(creditTax) + '</span></div>' : '') +
    '<div class="inv-stats-row"><span class="inv-stats-name">Not yet marked filed</span>' +
    '<span class="inv-stats-val' + (unfiledCount > 0 ? ' inv-stats-val-warn' : '') + '">' +
    formatCurrency(unfiledTax) + ' (' + unfiledCount + ')</span></div></div>';

  /* ===== Card 3: Invoice states ===== */
  var stateCount = { created: 0, dispatched: 0, delivered: 0, filed: 0 };
  filtered.forEach(function(inv) {
    var s = getInvState(inv);
    if (stateCount[s] != null) stateCount[s]++;
  });
  html += '<div class="inv-stats-card">' +
    '<div class="inv-stats-title">Invoice States</div>' +
    '<div class="inv-stats-states-row">' +
    '<span class="inv-state-badge inv-state-created">' + stateCount.created + ' Created</span>' +
    '<span class="inv-state-badge inv-state-dispatched">' + stateCount.dispatched + ' Dispatched</span>' +
    '<span class="inv-state-badge inv-state-delivered">' + stateCount.delivered + ' Delivered</span>' +
    '<span class="inv-state-badge inv-state-filed">' + stateCount.filed + ' Filed</span>' +
    '</div></div>';

  /* ===== Card 4: Revenue by client — ranked bars or share ===== */
  var ranked = buildClientRollup(filtered, credits);
  var maxClientRev = ranked.length > 0 ? ranked[0].total : 0;
  html += '<div class="inv-stats-card inv-stats-card-full">' +
    '<div class="inv-stats-trend-header">' +
    '<div class="inv-stats-title">Revenue by Client</div>' +
    statsChipRow('invStatsClientChart', 'chart', { bar: 'Ranked', pie: 'Share' }, _statsClientChart) +
    '</div>' +
    (_statsClientChart === 'pie'
      ? chartPie(ranked.map(function(r) { return { label: r.name, value: r.total, clientId: r.clientId }; }),
          { unit: 'money', ariaLabel: 'Revenue share by client' })
      : renderRevenueBarSvg(ranked, maxClientRev)) +
    '</div>';

  /* ===== Card 5: Realisation by client =====
     Ranked by ₹/kg rather than by revenue, because that ordering is the whole
     point: the biggest account and the worst-priced one can be the same row. */
  if (ranked.length > 0 && tonnage.kg > 0) {
    // Comparable rows rank; the rest are listed below them rather than
    // interleaved. A ₹/kg drawn from 4% of a client's book is not the same
    // kind of number as one drawn from all of it, and sorting them together
    // would present it as if it were.
    var comparable = ranked.filter(function(r) { return r.comparable; })
      .sort(function(a, b) { return a.realisation - b.realisation; });
    var partial = ranked.filter(function(r) { return !r.comparable; })
      .sort(function(a, b) { return b.total - a.total; });

    if (comparable.length > 0 || partial.length > 0) {
      html += '<div class="inv-stats-card inv-stats-card-full">' +
        '<div class="inv-stats-title">Realisation by Client' +
        '<span class="inv-stats-title-sub">worst priced first</span></div>' +
        '<div class="inv-stats-table"><div class="inv-stats-table-header">' +
        '<span class="inv-stats-table-cell inv-stats-table-part">Client</span>' +
        '<span class="inv-stats-table-cell inv-stats-table-qty">Tonnes</span>' +
        '<span class="inv-stats-table-cell inv-stats-table-qty">&#8377;/kg</span>' +
        '<span class="inv-stats-table-cell inv-stats-table-amt">Revenue</span></div>';

      comparable.forEach(function(r) {
        var below = costPerKg > 0 && r.realisation < costPerKg;
        // Where a discount is in force, say so on the row. Otherwise the ₹/kg
        // reads as a rate nobody agreed and the contract rate looks wrong.
        var disc = r.credit > 0
          ? '<br><span class="inv-text-muted inv-text-xs">net of ' + formatCurrency(r.credit) + ' credited</span>'
          : '';
        html += '<div class="inv-stats-table-row inv-stats-row-tap" data-action="invStatsClientDrill" data-client-id="' + r.clientId + '">' +
          '<span class="inv-stats-table-cell inv-stats-table-part">' + escHtml(r.name) + disc + '</span>' +
          '<span class="inv-stats-table-cell inv-stats-table-qty inv-mono">' + formatNum(r.kg / 1000, 2) + '</span>' +
          '<span class="inv-stats-table-cell inv-stats-table-qty inv-mono' + (below ? ' inv-stats-val-danger' : '') + '">' +
          formatNum(r.realisation, 2) + '</span>' +
          '<span class="inv-stats-table-cell inv-stats-table-amt inv-mono">' + formatCurrency(r.total) + '</span></div>';
      });

      partial.forEach(function(r) {
        html += '<div class="inv-stats-table-row inv-stats-row-tap inv-stats-row-partial" data-action="invStatsClientDrill" data-client-id="' + r.clientId + '">' +
          '<span class="inv-stats-table-cell inv-stats-table-part">' + escHtml(r.name) +
          '<br><span class="inv-text-muted inv-text-xs">weights on ' + Math.round(r.coverage * 100) + '% of revenue</span></span>' +
          '<span class="inv-stats-table-cell inv-stats-table-qty inv-mono">' +
          (r.kg > 0 ? formatNum(r.kg / 1000, 2) : '&mdash;') + '</span>' +
          '<span class="inv-stats-table-cell inv-stats-table-qty inv-mono inv-stats-val-unknown">n/a</span>' +
          '<span class="inv-stats-table-cell inv-stats-table-amt inv-mono">' + formatCurrency(r.total) + '</span></div>';
      });
      html += '</div>';

      if (partial.length > 0) {
        var partialRev = partial.reduce(function(s, r) { return s + r.total; }, 0);
        var partialShare = totalRev > 0 ? (partialRev / totalRev) * 100 : 0;
        html += '<div class="inv-stats-alert">' + partial.length + ' client' + (partial.length === 1 ? '' : 's') +
          ' cannot be priced per kg &mdash; ' + formatCurrency(partialRev) + ', ' + formatNum(partialShare, 0) +
          '% of revenue, billed on parts with no weight on file. These are the accounts most likely to be ' +
          'underpriced, and they are the ones this table cannot yet rank. ' +
          'Items Master &rarr; Derive weights from rates fills them in.</div>';
      }

      if (costPerKg > 0) {
        var belowCost = comparable.filter(function(r) { return r.realisation < costPerKg; });
        if (belowCost.length > 0) {
          var lossKg = belowCost.reduce(function(s, r) { return s + r.kg; }, 0);
          var lossAmt = belowCost.reduce(function(s, r) { return s + (costPerKg - r.realisation) * r.kg; }, 0);
          html += '<div class="inv-stats-caveat">' + belowCost.length + ' client' + (belowCost.length === 1 ? '' : 's') +
            ' priced below the ' + formatCurrency(costPerKg) + '/kg full cost, carrying ' +
            formatNum(lossKg / 1000, 2) + ' t and ' + formatCurrency(lossAmt) + ' of the period\'s shortfall. ' +
            'Whether that is worth exiting depends on how much of the cost base is actually variable.</div>';
        }
      }
      html += '</div>';
    }
  }

  /* ===== Card 6: Concentration ===== */
  if (ranked.length > 1 && totalRev > 0) {
    var top = ranked[0];
    var top3Rev = ranked.slice(0, 3).reduce(function(s, r) { return s + r.total; }, 0);
    // Share of tonnage is only meaningful if the client's own tonnage is
    // actually measured. Where it is not, the ratio inverts: a client with no
    // weights contributes almost nothing to the measured denominator and reads
    // as a small share of the plant when it may be the largest user of it.
    // Printing 3% for an account that is plausibly 60% would be worse than
    // printing nothing.
    var topKgShare = (tonnage.kg > 0 && top.comparable) ? (top.kg / tonnage.kg) * 100 : null;
    var topRevShare = (top.total / totalRev) * 100;
    html += '<div class="inv-stats-card">' +
      '<div class="inv-stats-title">Concentration</div>' +
      '<div class="inv-stats-row"><span class="inv-stats-name">Largest client</span>' +
      '<span class="inv-stats-val">' + escHtml(top.name) + '</span></div>' +
      '<div class="inv-stats-row"><span class="inv-stats-name">Share of revenue</span>' +
      '<span class="inv-stats-val">' + formatNum(topRevShare, 0) + '%</span></div>' +
      '<div class="inv-stats-row"><span class="inv-stats-name">Share of tonnage</span>' +
      (topKgShare != null
        ? '<span class="inv-stats-val' + (topKgShare - topRevShare > 10 ? ' inv-stats-val-warn' : '') + '">' +
          formatNum(topKgShare, 0) + '%</span>'
        : '<span class="inv-stats-val inv-stats-val-unknown">not measurable</span>') + '</div>' +
      '<div class="inv-stats-row"><span class="inv-stats-name">Top 3 share</span>' +
      '<span class="inv-stats-val">' + formatNum((top3Rev / totalRev) * 100, 0) + '%</span></div>';
    if (topKgShare != null && topKgShare - topRevShare > 10) {
      html += '<div class="inv-stats-caveat">' + escHtml(top.name) + ' takes a larger share of the plant than of the revenue &mdash; ' +
        'capacity is going somewhere it is not being paid for at the average rate.</div>';
    } else if (topKgShare == null) {
      html += '<div class="inv-stats-caveat">' + escHtml(top.name) + ' is the largest account by revenue, and how much of the ' +
        'plant it uses cannot be established &mdash; its parts have no weights on file. Until they do, the tonnage ' +
        'share of the single biggest user of capacity is unknown, not small.</div>';
    }
    html += '</div>';
  }

  /* ===== Card 7: Unbilled, by age =====
     Not period-filtered: unbilled material is a live position, not a
     historical one. The ageing is the part that was missing — a challan
     sitting unbilled for six weeks is a different problem from one received
     yesterday, and the old card showed them as the same number. */
  var pendingByClient = {};
  var ageBuckets = [
    { label: '0&ndash;7 days', max: 7, total: 0, items: 0 },
    { label: '8&ndash;15 days', max: 15, total: 0, items: 0 },
    { label: '16&ndash;30 days', max: 30, total: 0, items: 0 },
    { label: 'Over 30 days', max: Infinity, total: 0, items: 0 }
  ];
  var todayTs = new Date().setHours(23, 59, 59, 999);
  (S.incomingMaterial || []).forEach(function(im) {
    var pending = (im.items || []).filter(function(it) { return !it.invoiced; });
    if (pending.length === 0) return;
    var amt = pending.reduce(function(s, it) { return s + (it.amount || 0); }, 0);

    var key = im.clientId;
    if (!pendingByClient[key]) pendingByClient[key] = { clientId: key, name: im.clientName, total: 0, items: 0, oldest: null };
    pendingByClient[key].total += amt;
    pendingByClient[key].items += pending.length;

    var refTs = invPeriodTs({ date: im.challanDate, createdAt: im.createdAt });
    var ageDays = refTs ? Math.max(0, Math.floor((todayTs - refTs) / 86400000)) : 0;
    if (pendingByClient[key].oldest == null || ageDays > pendingByClient[key].oldest) {
      pendingByClient[key].oldest = ageDays;
    }
    for (var b = 0; b < ageBuckets.length; b++) {
      if (ageDays <= ageBuckets[b].max) {
        ageBuckets[b].total += amt;
        ageBuckets[b].items += pending.length;
        break;
      }
    }
  });
  var pendingRanked = Object.values(pendingByClient).sort(function(a, b) { return b.total - a.total; });
  var totalPending = pendingRanked.reduce(function(s, r) { return s + r.total; }, 0);

  html += '<div class="inv-stats-card inv-stats-card-full">' +
    '<div class="inv-stats-title">Unbilled Material<span class="inv-stats-title-sub">current, not period-filtered</span></div>' +
    '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Total Unbilled</span>' +
    '<span class="inv-stats-metric-value">' + formatCurrency(totalPending) + '</span></div>';
  if (totalPending > 0) {
    html += '<div class="inv-age-row">';
    ageBuckets.forEach(function(b) {
      var share = totalPending > 0 ? (b.total / totalPending) * 100 : 0;
      html += '<div class="inv-age-bucket' + (b.max === Infinity && b.total > 0 ? ' inv-age-bucket-warn' : '') + '">' +
        '<div class="inv-age-label">' + b.label + '</div>' +
        '<div class="inv-age-value">' + formatCurrency(b.total) + '</div>' +
        '<div class="inv-age-share">' + formatNum(share, 0) + '% &middot; ' + b.items + ' items</div></div>';
    });
    html += '</div>';
    pendingRanked.forEach(function(r) {
      html += '<div class="inv-stats-row inv-stats-row-tap" data-action="invStatsClientDrill" data-client-id="' + r.clientId + '">' +
        '<span class="inv-stats-name">' + escHtml(r.name) +
        ' <span class="inv-text-muted">(' + r.items + ' items' +
        (r.oldest != null ? ', oldest ' + r.oldest + 'd' : '') + ')</span></span>' +
        '<span class="inv-stats-val">' + formatCurrency(r.total) + '</span></div>';
    });
  } else {
    html += '<div class="inv-text-muted inv-p-8">All material invoiced</div>';
  }
  html += '</div>';

  /* ===== Card 8: Trend — revenue, tonnage, or material arriving ===== */
  var trendData = buildTrendSeries(_statsTrendGran, _statsTrendSeries);
  var trendUnit = TREND_SERIES_UNIT[_statsTrendSeries] || 'money';
  var trendTitles = {
    revenue: 'Revenue Trend',
    tonnage: 'Tonnage Trend',
    im: 'Incoming Material Trend'
  };
  html += '<div class="inv-stats-card inv-stats-card-full">' +
    '<div class="inv-stats-trend-header">' +
      '<div class="inv-stats-title">' + escHtml(trendTitles[_statsTrendSeries]) +
      (_statsTrendSeries === 'im'
        ? '<span class="inv-stats-title-sub">by challan date</span>'
        : '<span class="inv-stats-title-sub">by invoice date</span>') + '</div>' +
      statsChipRow('invStatsTrendSeries', 'series',
        { revenue: '₹', tonnage: 'Tonnes', im: 'IM' }, _statsTrendSeries) +
    '</div>' +
    '<div class="inv-stats-trend-header">' +
      statsChipRow('invStatsTrendGran', 'gran', { day: 'Day', week: 'Week', month: 'Month' }, _statsTrendGran) +
      statsChipRow('invStatsTrendType', 'type', { line: 'Line', bar: 'Bar' }, _statsTrendType) +
    '</div>' +
    (_statsTrendType === 'bar'
      ? chartBars(trendData, { unit: trendUnit, ariaLabel: trendTitles[_statsTrendSeries] })
      : chartLine(trendData, { unit: trendUnit, ariaLabel: trendTitles[_statsTrendSeries] })) +
    // Incoming material is the leading indicator: it is what has arrived and
    // not yet been billed, so a fall here shows up in revenue weeks later.
    (_statsTrendSeries === 'im'
      ? '<div class="inv-stats-note">Weighed challan lines only. What arrives here bills later, so a dip shows in revenue after a lag.</div>'
      : '') +
    '</div>';

  /* ===== Card 9: Dispatch cycle ===== */
  var dispatchDays = [], deliveryDays = [], fullCycleDays = [];
  filtered.forEach(function(inv) {
    if (inv.createdAt && inv.dispatchedAt) dispatchDays.push((inv.dispatchedAt - inv.createdAt) / 86400000);
    if (inv.dispatchedAt && inv.deliveredAt) deliveryDays.push((inv.deliveredAt - inv.dispatchedAt) / 86400000);
    if (inv.createdAt && inv.deliveredAt) fullCycleDays.push((inv.deliveredAt - inv.createdAt) / 86400000);
  });
  function avg(arr) { return arr.length > 0 ? (arr.reduce(function(a, b) { return a + b; }, 0) / arr.length) : null; }
  var avgDispatch = avg(dispatchDays);
  var avgDelivery = avg(deliveryDays);
  var avgFull = avg(fullCycleDays);
  if (avgDispatch !== null || avgDelivery !== null) {
    html += '<div class="inv-stats-card">' +
      '<div class="inv-stats-title">Dispatch Cycle</div>';
    if (avgDispatch !== null) {
      html += '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Created to Dispatched</span>' +
        '<span class="inv-stats-metric-sub">' + formatNum(avgDispatch, 1) + ' days avg (' + dispatchDays.length + ')</span></div>';
    }
    if (avgDelivery !== null) {
      html += '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Dispatched to Delivered</span>' +
        '<span class="inv-stats-metric-sub">' + formatNum(avgDelivery, 1) + ' days avg (' + deliveryDays.length + ')</span></div>';
    }
    if (avgFull !== null) {
      html += '<div class="inv-stats-metric"><span class="inv-stats-metric-label">Full Cycle</span>' +
        '<span class="inv-stats-metric-sub">' + formatNum(avgFull, 1) + ' days avg (' + fullCycleDays.length + ')</span></div>';
    }
    html += '</div>';
  }

  /* ===== Card 10: Top items — by value, tonnage, or price ===== */
  var top = buildTopItems(filtered, _statsTopBy, credits);
  if (top.total > 0) {
    var topTitles = { value: 'Top Items by Value', tonnage: 'Top Items by Tonnage', rate: 'Worst Priced Items' };
    var topUnits = { value: 'money', tonnage: 'kg', rate: 'money' };
    html += '<div class="inv-stats-card inv-stats-card-full">' +
      '<div class="inv-stats-trend-header">' +
      '<div class="inv-stats-title">' + escHtml(topTitles[_statsTopBy]) +
      (_statsTopBy === 'rate' ? '<span class="inv-stats-title-sub">worst first</span>' : '') + '</div>' +
      statsChipRow('invStatsTopBy', 'by', { value: '₹', tonnage: 'Tonnes', rate: '₹/kg' }, _statsTopBy) +
      '</div>';

    if (top.rows.length === 0) {
      html += '<div class="inv-text-muted inv-p-8">No part in this period has a known weight.</div>';
    } else {
      // On the price ranking the bar is measured against cost, not against the
      // best-priced part: a mark at full cost, and anything short of it in the
      // danger colour. Which parts are sold below cost is the question.
      var rateMax = _statsTopBy === 'rate'
        ? Math.max.apply(null, top.rows.map(function(r) { return r.perKg; }).concat([costPerKg]))
        : 0;
      html += chartRankedBars(top.rows.map(function(r) {
        var value = _statsTopBy === 'tonnage' ? r.kg : _statsTopBy === 'rate' ? r.perKg : r.amount;
        var display = _statsTopBy === 'tonnage' ? formatNum(r.kg, 0) + ' kg'
          : _statsTopBy === 'rate' ? formatCurrency(r.perKg) + '/kg'
          : formatCurrency(r.amount);
        // Two-tone rather than one-tone-plus-danger: the app's accent is itself
        // a terracotta, so a danger-red bar beside an accent bar was a
        // distinction nobody could see. Green covers cost, red does not.
        var tone = (_statsTopBy === 'rate' && costPerKg > 0)
          ? (r.perKg < costPerKg ? 'danger' : 'good') : null;
        var markPct = (_statsTopBy === 'rate' && costPerKg > 0 && rateMax > 0)
          ? (costPerKg / rateMax) * 100 : null;
        // Every row carries the other two figures, so switching the ranking
        // is a change of order rather than a change of what can be seen.
        var sub = formatCurrency(r.amount) +
          (r.kgKnown && r.kg > 0 ? ' · ' + formatNum(r.kg, 0) + ' kg · ' + formatCurrency(r.perKg) + '/kg' : ' · weight unknown');
        return {
          label: r.part + (r.desc && r.desc !== r.part ? ' — ' + r.desc : ''),
          value: value, display: display, sub: sub, tone: tone, markPct: markPct
        };
      }), { unit: topUnits[_statsTopBy] });
      if (_statsTopBy === 'rate' && costPerKg > 0) {
        html += '<div class="inv-stats-note">Mark is full cost, ' + formatCurrency(costPerKg) +
          '/kg. Bars short of it are plated below what they cost to plate.</div>';
      }
    }

    // The excluded parts are named, not dropped quietly. They are the
    // piece-billed end, so a weight-based ranking that hides them reads better
    // than the truth — the same trap the realisation cards already guard.
    if (top.dropped > 0) {
      html += '<div class="inv-stats-note">' + top.dropped + ' of ' + top.total +
        ' part' + (top.total !== 1 ? 's' : '') + ' left out: no known weight, so they cannot be ranked this way.</div>';
    }
    html += '</div>';
  }

  if (html === '') html = '<div class="inv-empty-state">No data yet. Create invoices and log incoming material to see analytics.</div>';
  area.innerHTML = html;
}

/* ===== CLIENT DRILL-DOWN OVERLAY (Flippable Card) ===== */
function openClientDrillOverlay(clientId) {
  clientId = parseInt(clientId);
  var client = S.clients.find(function(c) { return c.id === clientId; });
  if (!client) { showToast('Client not found', 'warning'); return; }

  var activeInvs = S.invoices.filter(function(i) { return i.status === 'active'; });
  var filtered = filterByPeriod(activeInvs, _statsPeriod);
  var clientInvs = filtered.filter(function(i) { return i.clientId === clientId; });
  // Same netting as the table this was opened from — a drill-down that
  // disagreed with the row it came out of would be worse than no drill-down.
  var credits = cnCreditByInvoice();
  var totalRev = sumTaxable(clientInvs, credits);
  var allRev = sumTaxable(filtered, credits);
  var clientCredit = cnCreditOn(clientInvs, credits);
  var pct = allRev > 0 ? Math.round(totalRev / allRev * 100) : 0;

  // The per-kg figure the Stats table ranks on, repeated here so the drill-down
  // answers the question that made someone tap the row.
  var clientTonnage = weighLines(clientInvs, credits);
  // Matched subset, same rule as the table this drill-down was opened from.
  var realisation = (clientTonnage.kg > 0 && clientTonnage.coverage >= REALISATION_MIN_COVERAGE)
    ? clientTonnage.revKnown / clientTonnage.kg : null;
  var costPerKg = S.defaultCostPerKg || 0;

  var pendingAmt = 0, pendingItems = 0;
  (S.incomingMaterial || []).forEach(function(im) {
    if (im.clientId !== clientId) return;
    im.items.forEach(function(it) {
      if (!it.invoiced) { pendingAmt += (it.amount || 0); pendingItems++; }
    });
  });

  var stateCounts = { created: 0, dispatched: 0, delivered: 0, filed: 0 };
  clientInvs.forEach(function(inv) {
    var s = getInvState(inv);
    if (stateCounts[s] != null) stateCounts[s]++;
  });

  var rateInfo = '';
  if (client.billingMode === 'perKg') {
    var r = getLineItemRate(client, localDateStr());
    rateInfo = 'Per Kg \u00b7 ' + formatCurrency(r.ratePerKg || r.rate || 0) + '/kg';
  } else if (client.billingMode === 'perPiece') {
    rateInfo = 'Per Piece';
  } else {
    rateInfo = client.billingMode || 'Standard';
  }

  var recentInvs = S.invoices
    .filter(function(i) { return i.clientId === clientId && i.status === 'active'; })
    .sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); })
    .slice(0, 5);
  var recentHtml = '';
  if (recentInvs.length === 0) {
    recentHtml = '<div class="inv-text-muted">No invoices</div>';
  } else {
    recentInvs.forEach(function(inv) {
      recentHtml += '<div class="inv-flip-row">' +
        '<span class="inv-mono">' + escHtml(inv.displayNumber) + '</span>' +
        '<span class="inv-text-muted">' + formatDate(inv.date) + '</span>' +
        '<span class="inv-mono inv-text-cost">' + formatCurrency(inv.grandTotal) + '</span>' +
        getStateBadgeHtml(inv) + '</div>';
    });
  }

  var pendingChallans = (S.incomingMaterial || []).filter(function(im) {
    if (im.clientId !== clientId) return false;
    return im.items.some(function(it) { return !it.invoiced; });
  });
  var challanHtml = '';
  if (pendingChallans.length === 0) {
    challanHtml = '<div class="inv-text-muted">No pending challans</div>';
  } else {
    pendingChallans.forEach(function(im) {
      var pItems = im.items.filter(function(it) { return !it.invoiced; });
      var pAmt = pItems.reduce(function(s, it) { return s + (it.amount || 0); }, 0);
      challanHtml += '<div class="inv-flip-row">' +
        '<span>' + (im.challanNo ? 'Ch. ' + escHtml(im.challanNo) : 'No number') + '</span>' +
        '<span class="inv-text-muted">' + formatDate(im.challanDate) + '</span>' +
        '<span class="inv-text-muted">' + pItems.length + ' items</span>' +
        '<span class="inv-mono">' + formatCurrency(pAmt) + '</span></div>';
    });
  }

  var periodLabel = PERIOD_LABELS[_statsPeriod] || 'All';

  pushFocus();
  document.body.style.overflow = 'hidden';
  var scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = '<div class="inv-overlay-card inv-flip-container">' +
    '<div class="inv-flip-inner">' +
    '<div class="inv-flip-front">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">' + escHtml(client.name) + '</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay">&times;</button></div>' +
    '<div class="inv-flip-period-label">' + escHtml(periodLabel) + '</div>' +
    '<div class="inv-flip-kpis">' +
    '<div class="inv-flip-kpi"><span class="inv-flip-kpi-label">Revenue</span><span class="inv-flip-kpi-value">' + formatCurrency(totalRev) + '</span>' +
      (clientCredit > 0 ? '<span class="inv-flip-kpi-note">net of ' + formatCurrency(clientCredit) + ' credited</span>' : '') + '</div>' +
    '<div class="inv-flip-kpi"><span class="inv-flip-kpi-label">Tonnage</span><span class="inv-flip-kpi-value">' + formatNum(clientTonnage.kg / 1000, 2) + ' t</span></div>' +
    '<div class="inv-flip-kpi"><span class="inv-flip-kpi-label">&#8377;/kg</span><span class="inv-flip-kpi-value' +
      (realisation != null && costPerKg > 0 && realisation < costPerKg ? ' inv-stats-val-danger' : '') + '">' +
      (realisation != null ? formatNum(realisation, 2) : '&mdash;') + '</span></div>' +
    '<div class="inv-flip-kpi"><span class="inv-flip-kpi-label">Share</span><span class="inv-flip-kpi-value">' + pct + '%</span></div>' +
    '<div class="inv-flip-kpi"><span class="inv-flip-kpi-label">Invoices</span><span class="inv-flip-kpi-value">' + clientInvs.length + '</span></div>' +
    '<div class="inv-flip-kpi"><span class="inv-flip-kpi-label">Unbilled</span><span class="inv-flip-kpi-value">' + formatCurrency(pendingAmt) + '</span></div>' +
    '</div>' +
    '<div class="inv-flip-states">' +
    '<span class="inv-state-badge inv-state-created">' + stateCounts.created + ' Created</span>' +
    '<span class="inv-state-badge inv-state-dispatched">' + stateCounts.dispatched + ' Dispatched</span>' +
    '<span class="inv-state-badge inv-state-delivered">' + stateCounts.delivered + ' Delivered</span>' +
    '<span class="inv-state-badge inv-state-filed">' + stateCounts.filed + ' Filed</span>' +
    '</div>' +
    '<div class="inv-flip-meta">' + escHtml(rateInfo) + '</div>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-block" data-action="invFlipCard">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>' +
    ' Details &amp; Actions</button>' +
    '</div>' +
    '<div class="inv-flip-back">' +
    '<div class="inv-overlay-header"><span class="inv-overlay-title">' + escHtml(client.name) + '</span><div>' +
    '<button class="inv-overlay-close" data-action="invFlipCard" aria-label="Flip back">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>' +
    '</button>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay">&times;</button></div></div>' +
    '<div class="inv-flip-section-title">Recent Invoices</div>' + recentHtml +
    '<div class="inv-flip-section-title">Pending Challans</div>' + challanHtml +
    '<div class="inv-flip-actions">' +
    '<button class="inv-btn inv-btn-primary" data-action="invStatsCreateInvoice" data-client-id="' + clientId + '">Create Invoice</button>' +
    '<button class="inv-btn inv-btn-ghost" data-action="invStatsJumpRegister" data-client-id="' + clientId + '">View in Register</button>' +
    '<button class="inv-btn inv-btn-ghost" data-action="invStatsJumpIM" data-client-id="' + clientId + '">View in IM</button>' +
    '</div></div>' +
    '</div></div>';
  document.body.appendChild(scrim);
  focusFirstInteractive(scrim);
}

/* ===== HISTORY (Phase 7 — Activity Log Rework) =====
 *
 * This is the audit trail, and it was missing the events an audit exists to
 * find. A deleted invoice writes a tombstone to S.voidedNumbers carrying a
 * required reason — none of it appeared here. An accepted duplicate challan
 * stamps dupeAck on the entry — that did not appear either. Both are now
 * first-class events, because "what happened to invoice 00666" is exactly the
 * question this tab should answer.
 */
var _historyClientFilter = '';
var _historyDateFrom = '';
var _historyDateTo = '';
var _historyShowCount = 50;
var _historyType = 'all';
var _historySearch = '';
var _historySearchTimer = null;

var HISTORY_TYPES = [
  { key: 'all', label: 'All' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'challan', label: 'Challans' },
  { key: 'state', label: 'Status' },
  { key: 'audit', label: 'Audit' }
];

// Inline SVG per event type (HR-4: no emoji).
var HISTORY_ICONS = {
  invoice: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  challan: '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>',
  state: '<polyline points="20 6 9 17 4 12"/>',
  cancel: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  void: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>',
  dupe: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>'
};

function historyIcon(kind) {
  var path = HISTORY_ICONS[kind] || HISTORY_ICONS.state;
  return '<svg class="inv-history-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' + path + '</svg>';
}

/* Every event the app can account for, newest first. Kept as one function so
   the CSV export and the rendered list can never drift apart. */
function buildHistoryEvents() {
  var events = [];

  S.invoices.forEach(function(inv) {
    if (_historyClientFilter && inv.clientId != _historyClientFilter) return;
    events.push({ ts: inv.createdAt, type: 'invoice', kind: 'invoice', sourceId: inv.id, jump: 'invoice',
      text: 'Invoice ' + (inv.displayNumber || '') + ' created for ' + (inv.clientName || ''), amount: inv.grandTotal });
    if (inv.dispatchedAt) events.push({ ts: inv.dispatchedAt, type: 'state', kind: 'state', sourceId: inv.id, jump: 'invoice',
      text: (inv.displayNumber || '') + ' dispatched' });
    if (inv.deliveredAt) events.push({ ts: inv.deliveredAt, type: 'state', kind: 'state', sourceId: inv.id, jump: 'invoice',
      text: (inv.displayNumber || '') + ' delivered (signed copy received)' });
    if (inv.filedAt) events.push({ ts: inv.filedAt, type: 'state', kind: 'state', sourceId: inv.id, jump: 'invoice',
      text: (inv.displayNumber || '') + ' marked as filed in GSTR1' });
    if (inv.status === 'cancelled' && inv.cancelledAt) events.push({ ts: inv.cancelledAt, type: 'audit', kind: 'cancel', sourceId: inv.id, jump: 'invoice',
      text: (inv.displayNumber || '') + ' cancelled' });
    if (inv.updatedAt && inv.updatedAt !== inv.createdAt) events.push({ ts: inv.updatedAt, type: 'state', kind: 'state', sourceId: inv.id, jump: 'invoice',
      text: (inv.displayNumber || '') + ' edited' });
  });

  (S.incomingMaterial || []).forEach(function(im) {
    if (_historyClientFilter && im.clientId != _historyClientFilter) return;
    var challanAmt = (im.items || []).reduce(function(s, it) { return s + (it.amount || 0); }, 0);
    events.push({
      ts: im.createdAt, type: 'challan', kind: 'challan', sourceId: im.id, jump: 'challan',
      text: 'Challan' + (im.challanNo ? ' ' + im.challanNo : '') + ' received from ' + (im.clientName || '') +
        ' (' + (im.items || []).length + ' item' + ((im.items || []).length > 1 ? 's' : '') + ')',
      amount: challanAmt
    });
    // An accepted duplicate is a decision somebody made, and the whole point of
    // stamping dupeAck was so an audit could tell it from one nobody was shown.
    if (im.dupeAck && im.dupeAck.at) {
      events.push({
        ts: im.dupeAck.at, type: 'audit', kind: 'dupe', sourceId: im.id, jump: 'challan',
        text: 'Duplicate warning accepted for challan' + (im.challanNo ? ' ' + im.challanNo : '') +
          ' (' + (im.clientName || '') + ') — matched ' + ((im.dupeAck.matchedIds || []).length || 'other') + ' existing entr' +
          (((im.dupeAck.matchedIds || []).length === 1) ? 'y' : 'ies')
      });
    }
  });

  // Deleted invoices. The record is gone; the number and the reason are not.
  (S.voidedNumbers || []).forEach(function(v) {
    if (_historyClientFilter && v.clientId != _historyClientFilter) return;
    var label = v.displayNumber || v.invoiceNumber || '';
    var what = v.source === 'reconciled' ? 'Number ' + label + ' accounted for'
      : 'Invoice ' + label + ' deleted';
    events.push({
      ts: v.voidedAt, type: 'audit', kind: 'void', sourceId: null, jump: null,
      text: what + (v.clientName ? ' (' + v.clientName + ')' : '') +
        ' — ' + (v.reason || 'no reason recorded') +
        (v.reserved ? ' [number stays spent]' : ' [number returned to series]'),
      amount: v.grandTotal || 0
    });
  });

  return events;
}

/* The filters applied once, so the rendered list and the CSV export can never
   disagree about what "the log" currently means. */
function filteredHistoryEvents() {
  var events = buildHistoryEvents();

  if (_historyType !== 'all') {
    events = events.filter(function(ev) { return ev.type === _historyType; });
  }
  if (_historySearch) {
    var needle = _historySearch.toLowerCase();
    events = events.filter(function(ev) { return (ev.text || '').toLowerCase().indexOf(needle) !== -1; });
  }
  if (_historyDateFrom) {
    var fp = _historyDateFrom.split('-');
    // Timezone-safe: never new Date("YYYY-MM-DD").
    var fromTs = fp.length === 3 ? new Date(+fp[0], +fp[1] - 1, +fp[2]).getTime() : NaN;
    if (!isNaN(fromTs)) events = events.filter(function(ev) { return (ev.ts || 0) >= fromTs; });
  }
  if (_historyDateTo) {
    var tp = _historyDateTo.split('-');
    var toTs = tp.length === 3 ? new Date(+tp[0], +tp[1] - 1, +tp[2], 23, 59, 59, 999).getTime() : NaN;
    if (!isNaN(toTs)) events = events.filter(function(ev) { return (ev.ts || 0) <= toTs; });
  }

  events.sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });
  return events;
}

function renderHistory() {
  var toolbar = document.getElementById('historyToolbar');
  var area = document.getElementById('historyList');
  if (!area) return;

  if (toolbar) {
    var clientIds = new Set();
    S.invoices.forEach(function(i) { clientIds.add(i.clientId); });
    (S.incomingMaterial || []).forEach(function(im) { clientIds.add(im.clientId); });
    var clientOpts = '';
    clientIds.forEach(function(cid) {
      var c = S.clients.find(function(x) { return x.id === cid; });
      if (c) clientOpts += '<option value="' + cid + '"' + (_historyClientFilter == cid ? ' selected' : '') + '>' + escHtml(c.name) + '</option>';
    });
    var typeChips = '<div class="inv-stats-chips inv-stats-chips-sm">';
    HISTORY_TYPES.forEach(function(t) {
      typeChips += '<button class="inv-chip' + (_historyType === t.key ? ' inv-chip-active' : '') +
        '" data-action="invHistoryType" data-type="' + t.key + '">' + t.label + '</button>';
    });
    typeChips += '</div>';

    toolbar.innerHTML = '<div class="inv-im-toolbar">' + typeChips +
      '<div class="inv-history-filters">' +
      '<select class="inv-form-select" id="historyClientFilter" aria-label="Filter by client">' +
      '<option value="">All Clients</option>' + clientOpts + '</select>' +
      '<input type="date" class="inv-form-input inv-history-date" id="historyDateFrom" value="' + escHtml(_historyDateFrom) + '" aria-label="From date">' +
      '<input type="date" class="inv-form-input inv-history-date" id="historyDateTo" value="' + escHtml(_historyDateTo) + '" aria-label="To date">' +
      '</div>' +
      '<input type="search" class="inv-form-input inv-mb-8" id="historySearch" value="' + escHtml(_historySearch) + '" placeholder="Search invoice or challan number" autocomplete="off">' +
      '</div>';
  }

  var events = filteredHistoryEvents();

  if (events.length === 0) {
    area.innerHTML = '<div class="inv-empty-state">No activity found</div>';
    return;
  }

  var totalValue = events.reduce(function(s, ev) { return s + (ev.amount || 0); }, 0);
  var html = '<div class="inv-stats-card">' +
    '<div class="inv-flex-between inv-mb-8">' +
    '<div class="inv-stats-title">Activity Log (' + events.length + ')</div>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invHistoryExport">Export CSV</button>' +
    '</div>' +
    (totalValue > 0 ? '<div class="inv-history-summary">' + formatCurrency(totalValue) + ' across the events shown</div>' : '');

  var shown = events.slice(0, _historyShowCount);
  var currentDay = '';
  shown.forEach(function(ev) {
    var dayStr = ev.ts ? formatTimestamp(ev.ts).split(',')[0] : 'Unknown date';
    if (dayStr !== currentDay) {
      currentDay = dayStr;
      html += '<div class="inv-history-day-header">' + escHtml(dayStr) + '</div>';
    }
    // A void has no record left to jump to — the invoice is gone. Rendering it
    // as a tappable row would promise a destination that does not exist.
    var action = ev.jump === 'challan' ? 'invHistoryJumpChallan'
      : ev.jump === 'invoice' ? 'invHistoryJumpInvoice' : '';
    html += '<div class="inv-history-item' + (action ? '' : ' inv-history-item-static') + '"' +
      (action ? ' data-action="' + action + '" data-id="' + escHtml(ev.sourceId) + '"' : '') + '>' +
      '<div class="inv-history-icon inv-history-icon-' + ev.kind + '">' + historyIcon(ev.kind) + '</div>' +
      '<div class="inv-history-body">' +
      '<div class="inv-history-text">' + escHtml(ev.text) +
      (ev.amount ? ' \u00b7 ' + formatCurrency(ev.amount) : '') + '</div>' +
      '<div class="inv-history-meta">' + (ev.ts ? formatTimestamp(ev.ts) : '') + '</div>' +
      '</div></div>';
  });

  if (events.length > _historyShowCount) {
    var remaining = events.length - _historyShowCount;
    html += '<button class="inv-btn inv-btn-ghost inv-btn-block inv-mt-16" data-action="invHistoryLoadMore">' +
      'Show more (' + remaining + ' remaining)</button>';
  }
  html += '</div>';
  area.innerHTML = html;
}

/* Exports exactly what the current filters show, so a query someone reasoned
   about on screen is the query that leaves the app. */
function exportHistoryCSV() {
  var events = filteredHistoryEvents();
  if (events.length === 0) { showToast('Nothing to export', 'warning'); return; }

  function cell(v) {
    var s = v == null ? '' : String(v);
    return '"' + s.replace(/"/g, '""') + '"';
  }
  var rows = [['Timestamp', 'Type', 'Event', 'Amount'].join(',')];
  events.forEach(function(ev) {
    rows.push([
      cell(ev.ts ? formatTimestamp(ev.ts) : ''),
      cell(ev.kind),
      cell(ev.text),
      cell(ev.amount ? formatNum(ev.amount, 2) : '')
    ].join(','));
  });

  var blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sep-activity-log-' + localDateStr() + '.csv';
  a.click();
  showToast('Exported ' + events.length + ' events');
}
