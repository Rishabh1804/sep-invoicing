/* ===== STATS (Phase 7 — Analytics Rework) =====
 *
 * This is a job-work business priced in rupees per kilogram. Revenue on its
 * own says almost nothing here: the same ₹1L of billing is a good month at
 * 8 tonnes and a loss-making one at 20. So every headline figure is carried
 * alongside the tonnage that produced it, and the ratio between them —
 * realisation, ₹/kg — is treated as the primary number rather than a
 * derived one.
 *
 * Against a full cost of ₹8.55/kg (Settings → Costing → Full cost) and a blended
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

var PERIOD_LABELS = { mtd: 'MTD', qtd: 'QTD', ytd: 'YTD', all: 'All time' };
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
   piece-billed work, which is the whole low-realisation end of the book. */
function weighLines(rows) {
  var kg = 0, lines = 0, known = 0, revKnown = 0, revUnknown = 0;
  rows.forEach(function(row) {
    var client = rowClient(row);
    (row.items || []).forEach(function(it) {
      lines++;
      var amt = it.amount || 0;
      var w = lineWeightKg(it, client, row.date || row.challanDate);
      if (w.known) { known++; kg += w.kg; revKnown += amt; }
      else { revUnknown += amt; }
    });
  });
  var revTotal = revKnown + revUnknown;
  return {
    kg: kg, lines: lines, known: known,
    revKnown: revKnown, revUnknown: revUnknown,
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

function sumTaxable(invoices) {
  return invoices.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0);
}

/* A share as a whole percentage that never reads 100 while anything is left out: a line excluded from 99.6% of the
   revenue is still excluded, and "100%" beside the sentence naming it contradicted it. */
function statsPctOf(share) {
  var p = Math.round((share || 0) * 100);
  return share < 1 && p >= 100 ? 99 : p;
}

/* The per-kg cost every "below cost" on Stats is judged against: the period's LIVE cost (cost.js) over the whole
   book's weighed tonnage for the period, the plant's cost per kilo, so the headline, the tables and a client's
   drill-down cannot disagree. The typed figure stands only where there is no tonnage to divide by. */
function statsPeriodCost(period, tonnage) {
  var r = statsRangeIso(period);
  var live = tonnage && tonnage.kg > 0 ? liveCost(r.from, r.to, tonnage.kg) : null;
  var isLive = !!(live && live.perKg > 0);
  return { perKg: isLive ? live.perKg : (S.defaultCostPerKg || 0), label: isLive ? 'live cost ' : 'cost ' };
}

/* The live cost per kg divides the whole plant's cost by the tonnage of the WEIGHED lines alone: numerator over
   everything, denominator over a subset, so where a line has no weight it reads high. The figure stays as it is
   (the unweighed kilos are not known) and says so where it is shown. '' when every line is weighed. `said`: the text
   around it has already given the weighed share. */
function statsCostWeighedNote(tonnage, said) {
  if (!tonnage || !(tonnage.kg > 0) || !(tonnage.coverage < 0.999)) return '';
  // Weighed lines billed at nothing (replating) beside priced lines with no weight: nothing priced is weighed, and 1 ÷ 0
  // read "by about Infinity%".
  if (!(tonnage.coverage > 0)) return 'The live cost per kg divides the whole plant&rsquo;s cost by the tonnage of the weighed lines, and they carry none of the revenue: ' +
    'nothing priced was weighed, so the figure cannot be set against what was billed.';
  var up = (1 / tonnage.coverage - 1) * 100;
  return 'The live cost per kg divides the whole plant&rsquo;s cost by the tonnage of the weighed lines' +
    (said ? '' : ', which carry ' + statsPctOf(tonnage.coverage) + '% of the revenue') + ', so it reads high' + (said ? ' too' : '') + ': ' +
    (up >= 0.5 ? 'by about ' + Math.round(up) + '%' : 'slightly') +
    ' if the unweighed work weighs in step with its revenue, and by more if it is the heavier, piece-billed end.';
}

/* ===== THE DASHBOARD'S PIECES (design system §6) =====
   Every Stats card is a flush panel (§6.8) named by data-card, its qualifier an inv-note in the title;
   figures are tiles (§6.9) and rows (§6.10); caveats are callouts (§6.18). intel.js, insights.js and
   cost.js draw their cards with the same pieces. */

/* A change against the prior period in words (§5.4): "+12.3% on same days last month", coloured by whether it moved
   the good way (figDeltaHtml, state.js). A percentage against no prior activity is noise dressed as a signal, so it
   says so instead. */
function statsDeltaText(cur, prev, label, better) {
  if (prev == null || !isFinite(prev) || prev === 0) return 'no prior period';
  return figDeltaHtml(cur, prev, label, better);
}

/* A segmented control for a setting of the card it sits in (§6.5). `inv-seg-fit` keeps it the width
   of its buttons, so a card's head or toolbar can hold it beside its title. */
function statsSeg(action, dataKey, labels, current, aria, fit) {
  return '<div class="inv-seg' + (fit === false ? '' : ' inv-seg-fit') + '" role="group" aria-label="' + escHtml(aria) + '">' +
    Object.keys(labels).map(function(k) {
      return '<button type="button" class="inv-seg-btn" aria-pressed="' + (current === k) + '" data-action="' + action +
        '" data-' + dataKey + '="' + escHtml(k) + '">' + escHtml(labels[k]) + '</button>';
    }).join('') + '</div>';
}

/* A card: a flush panel with its title, the qualifier after it, and anything the head carries at its
   end (a total, a segmented control). `wide` spans both desktop columns. The caller closes the div. */
function statsPanel(card, title, note, opts) {
  opts = opts || {};
  return '<div class="inv-panel inv-panel-flush' + (opts.wide ? ' inv-panels-wide' : '') + '" data-card="' + card + '"' +
    (opts.id ? ' id="' + opts.id + '"' : '') + '><div class="inv-panel-head"><span class="inv-panel-title">' + title +
    (note ? ' <span class="inv-note">' + note + '</span>' : '') + '</span>' + (opts.end || '') + '</div>';
}

/* A tile (§6.9). `valueId` names the value for whoever reads it back. */
function statsTile(key, label, value, sub, tone, valueId) {
  return '<div class="inv-tile' + (tone ? ' inv-tile-' + tone : '') + '" data-tile="' + key + '"><div class="inv-tile-label">' + label + '</div>' +
    '<div class="inv-tile-value"' + (valueId ? ' id="' + valueId + '"' : '') + '>' + figWrapHtml(value) + '</div>' + (sub || '') + '</div>';
}
function statsTileSub(html) { return html ? '<div class="inv-tile-sub">' + html + '</div>' : ''; }
function statsTiles(tiles, four) {
  return '<div class="inv-tiles inv-tiles-flush' + (four ? ' inv-tiles-4' : '') + '">' + tiles + '</div>';
}

/* A row (§6.10): a label and its working, the figure at the end. `attrs` makes it a drill-through
   (a <button>) when it carries an action. */
function statsRow(title, meta, end, attrs, extra) {
  var tag = attrs && attrs.indexOf('data-action') >= 0 ? 'button' : 'div';
  return '<' + tag + (tag === 'button' ? ' type="button"' : '') + ' class="inv-row' + (meta ? ' inv-row-2' : '') + (extra ? ' ' + extra : '') + '"' + (attrs || '') + '>' +
    '<span class="inv-row-main"><span class="inv-row-title">' + title + '</span>' +
    (meta ? '<span class="inv-row-meta inv-row-wrap">' + meta + '</span>' : '') + '</span>' +
    (end ? '<span class="inv-row-end">' + end + '</span>' : '') + '</' + tag + '>';
}
function statsNum(html, cls) { return '<span class="inv-num' + (cls ? ' ' + cls : '') + '">' + html + '</span>'; }
function statsUnit(u) { return '<span class="inv-unit">' + u + '</span>'; }

/* A padded stretch in a flush panel: a callout (neutral unless toned), a note, a chart. */
function statsBody(html) { return '<div class="inv-panel-body">' + html + '</div>'; }
function statsCallout(html, tone, key) {
  return statsBody('<div class="inv-callout' + (tone ? ' inv-callout-' + tone : '') + '"' + (key ? ' data-callout="' + key + '"' : '') + '>' + html + '</div>');
}
function statsNote(html) { return '<div class="inv-note">' + html + '</div>'; }

var TREND_MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
/* A month's short name from a YYYY-MM or YYYY-MM-DD key: the one copy (charts, insights, Finance and the
   Overviews read it). toLocaleString('en-IN') writes "Sept", which is not the app's. */
function insMonthLabel(m) { return TREND_MONTH_LABELS[parseInt(String(m).slice(5, 7), 10) - 1] || String(m); }

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
  if (gran === 'day') return parseInt(key.slice(8, 10), 10) + ' ' + insMonthLabel(key);
  if (gran === 'week') {
    return 'W' + key.slice(-2) + ' ' + key.slice(2, 4);
  }
  return insMonthLabel(key) + ' ' + key.slice(2, 4);
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
  // Hard stop: a corrupt date can otherwise spin this for ever. The walk keeps the END of a longer range, the part every
  // caller shows (they keep the last 12 months, 26 weeks or 90 days): from a date decades back it stopped at 4,000 days
  // and handed the callers a tail of empty months.
  var guard = 0, from = new Date(end); from.setDate(from.getDate() - 3999);
  if (from > d) d = from;
  while (d <= end && guard++ < 4000) {
    var iso = isoOf(d);
    var k = gran === 'day' ? iso : gran === 'week' ? isoWeekKey(iso) : iso.substring(0, 7);
    if (!seen[k]) { seen[k] = true; keys.push(k); }
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

/* Trend buckets for one series. Revenue and tonnage come off the invoices;
   incoming material comes off the challans, which is a different spine and a
   different date — the challan date, not the invoice date. */
/* ===== CREDIT NOTES NETTED ACROSS STATS (owner, 30 Sep 2026: "credit note should be netted across all of stats") =====
   Only contribution by client took notes off, by the date a batch ended, so the headline, realisation, clients, six
   months and the trend read every rebate as revenue (SSS Mehta's 2% among them). Each note's credit is spread over the
   invoices it names, in proportion to their taxable (a batch rebate over its batch, a note against one invoice on that
   one), and Stats reads those net invoices everywhere: each line is scaled by its invoice's share, so tonnage is
   untouched and realisation falls by the credit. A cancelled note credits nothing; a note naming no invoice in the book
   (a number typed from outside it) is counted apart and said, never guessed onto one. */
function cnCreditByInvoice() {
  var active = {}, byId = {}, unplaced = { n: 0, amount: 0 };
  (S.invoices || []).forEach(function(i) { if (i.status === 'active') active[i.id] = i; });
  (S.creditNotes || []).forEach(function(n) {
    var amt = Number(n.taxableValue) || 0;
    if (n.status === 'cancelled' || !(amt > 0)) return;
    var invs = (n.invoiceIds || []).map(function(id) { return active[id]; }).filter(Boolean);
    if (!invs.length) { var a = typeof cnAgainstLive === 'function' ? cnAgainstLive(n) : null; if (a && active[a.id]) invs = [a]; }
    if (!invs.length) { unplaced.n++; unplaced.amount += amt; return; }
    var base = invs.reduce(function(s, i) { return s + (Number(i.taxableValue) || 0); }, 0);
    invs.forEach(function(i) { byId[i.id] = (byId[i.id] || 0) + (base > 0 ? amt * (Number(i.taxableValue) || 0) / base : amt / invs.length); });
  });
  return { byId: byId, unplaced: unplaced };
}
/* The active invoices as Stats counts them: net of their credit notes. `_credit` is what was taken off. */
function statsInvoices() {
  var cr = cnCreditByInvoice().byId;
  return (S.invoices || []).filter(function(i) { return i.status === 'active'; }).map(function(inv) {
    var c = cr[inv.id];
    if (!c) return inv;
    var tv = Number(inv.taxableValue) || 0, f = tv > 0 ? Math.max(0, (tv - c) / tv) : 1;
    // The tax and the total come down by the same share as the taxable, so "incl. GST" and output tax are net too and agree
    // with Finance's GST due, which takes the notes' tax off.
    return Object.assign({}, inv, { taxableValue: gstRound(tv * f), _credit: gstRound(tv - tv * f),
      cgstAmt: gstRound((Number(inv.cgstAmt) || 0) * f), sgstAmt: gstRound((Number(inv.sgstAmt) || 0) * f), igstAmt: gstRound((Number(inv.igstAmt) || 0) * f),
      grandTotal: gstRound((Number(inv.grandTotal) || 0) * f),
      items: (inv.items || []).map(function(it) { return Object.assign({}, it, { amount: gstRound((Number(it.amount) || 0) * f) }); }) });
  });
}

function buildTrendSeries(gran, series) {
  var by = {};
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
      // Weighed on the day it is bucketed under: a challan with no challan date is dated by when it came in.
      var client = rowClient(im);
      var kg = 0;
      (im.items || []).forEach(function(it) {
        var w = lineWeightKg(it, client, d);
        if (w.known) kg += w.kg;
      });
      var k = bucket(d);
      by[k] = (by[k] || 0) + kg;
    });
  } else {
    statsInvoices().forEach(function(inv) {
      if (!inv.date) return;
      var k = bucket(inv.date);
      by[k] = (by[k] || 0) + (series === 'tonnage' ? weighLines([inv]).kg : (inv.taxableValue || 0));
    });
  }

  // Cap series length per granularity for readability + perf.
  var cap = gran === 'day' ? 90 : gran === 'week' ? 26 : 12;
  if (!minDate) return [];
  // The reach ends today, never at a date typed decades ahead (a date only ahead of today, with nothing before it, keeps it).
  var today = localDateStr();
  var keys = periodKeysBetween(minDate, maxDate > today && minDate <= today ? today : maxDate, gran).slice(-cap);
  return keys.map(function(k) { return { key: k, label: formatTrendLabel(k, gran), value: by[k] || 0 }; });
}

var TREND_SERIES_UNIT = { revenue: 'money', tonnage: 'kg', im: 'kg' };

/* Ranked parts. `by` decides the ordering, and it is not cosmetic: ranking by
   value answers "what earns", by tonnage "what fills the plant", and by ₹/kg
   "what is priced worst". Those are three different top-tens.

   The ₹/kg ranking admits only rows whose weight is actually known — a rate
   computed from a partial weight is not a rate — and says how many it dropped
   rather than silently ranking fewer parts.

   A part is its client's part at its gauge. Two clients' parts of one name are
   two parts (one client's BASE PLATE weighs ten times another's), and a clamp
   at 35X6 and at 40X6 is two weights and two rates under one part number
   (CLAUDE.md, Items Master): merged, a row's ₹/kg was an average of neither. */
function buildTopItems(invoices, by) {
  var byPart = {};
  invoices.forEach(function(inv) {
    var client = rowClient(inv);
    (inv.items || []).forEach(function(it) {
      var part = it.partNumber || it.desc || 'Unknown';
      // One part however it was spelt (CLAMP 149X83(40X6) and 149X83 with the gauge in the description), and always one
      // client's: a code two clients send is two rows, each saying so (cpPartIdentity, client-perf.js).
      var idn = cpPartIdentity(it.partNumber, it.desc), gauge = idn.gauge;
      var key = inv.clientId + '|' + (idn.base || part) + '|' + gauge;
      if (!byPart[key]) byPart[key] = { part: part, base: idn.base, desc: it.desc || '', gauge: gauge, clientId: inv.clientId,
        clientName: (client && client.name) || inv.clientName || '', qty: 0, amount: 0, kg: 0, kgKnown: true };
      else if (String(part).length > String(byPart[key].part).length) { byPart[key].part = part; byPart[key].desc = it.desc || ''; }
      byPart[key].qty += (it.qty || 0);
      byPart[key].amount += (it.amount || 0);
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
function buildClientRollup(invoices) {
  var by = {};
  invoices.forEach(function(inv) {
    var key = inv.clientId;
    if (!by[key]) {
      by[key] = { clientId: key, name: inv.clientName, total: 0, count: 0, kg: 0, revKnown: 0, revUnknown: 0 };
    }
    by[key].total += (inv.taxableValue || 0);
    by[key].count++;
    var w = weighLines([inv]);
    by[key].kg += w.kg; by[key].revKnown += w.revKnown; by[key].revUnknown += w.revUnknown;
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

/* Revenue by client, ranked: the ranked-bar chart (charts.js), each bar tapping through to the
   client. An empty period says what would fill it and offers the way there. */
function renderRevenueBars(ranked, totalRev) {
  if (ranked.length === 0) return '<div class="inv-empty">No revenue in this period' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCreateNew">Create an invoice</button></div>';
  return statsBody(chartRankedBars(ranked.map(function(r) {
    return { label: r.name, value: r.total, display: formatCurrency(r.total),
      sub: (totalRev > 0 ? formatNum(r.total / totalRev * 100, 0) + '% of revenue' : ''),
      action: 'invStatsClientDrill', clientId: r.clientId };
  }), { unit: 'money' }));
}

/* What the period's cards are read from, worked out once: the active invoices net of their credit notes, the period's
   and the stretch before it, the period's weighed tonnage, and the cost every "below cost" on Stats is judged against
   (the period's LIVE cost, statsPeriodCost, so the headline and the Overview cannot disagree). renderStats reads it, and
   so do the questions with their moves (advice.js: advQuestions, advPulseHtml), so a question asked away from Stats reads
   the same figures as the card on it. */
function statsPulseArgs(period) {
  var activeInvs = statsInvoices();
  var filtered = filterByPeriod(activeInvs, period);
  var tonnage = weighLines(filtered);
  return { period: period, activeInvs: activeInvs, filtered: filtered, prior: filterByPeriod(activeInvs, period, 1),
    tonnage: tonnage, periodCost: statsPeriodCost(period, tonnage) };
}

function renderStats() {
  var toolbar = document.getElementById('statsToolbar');
  var area = document.getElementById('statsContent');
  if (!area) return;

  // The view tabs, then the period: a setting of every card on the page (§6.5).
  if (toolbar) {
    toolbar.innerHTML = statsTabsHtml() + '<div class="inv-toolbar">' +
      statsSeg('invStatsPeriod', 'period', { mtd: 'MTD', qtd: 'QTD', ytd: 'YTD', all: 'All' }, _statsPeriod, 'Period', false) +
      // The same period as a printable report (report.js).
      (statsTab() === 'overview' ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invRptFromStats" id="statsMakeReport">Make a report</button>' : '') + '</div>';
    // The open tab is scrolled into view sideways only, as Staff's: never cut off at a phone's edge.
    viewTabReveal(toolbar.querySelector('.inv-viewtabs'));
  }

  var pa = statsPulseArgs(_statsPeriod);
  var activeInvs = pa.activeInvs, filtered = pa.filtered, prior = pa.prior;
  var html = '';
  // Each card lands in one of the grouped tabs (intel.js): what has been drawn
  // since the last take() moves to that tab, and only the open tab is shown.
  var sec = { overview: '', clients: '', cost: '', billing: '', trends: '' };
  function take(key) { sec[key] += html; html = ''; }

  var totalRev = sumTaxable(filtered);
  var totalGrand = filtered.reduce(function(s, i) { return s + (i.grandTotal || 0); }, 0);
  var priorRev = sumTaxable(prior);
  var tonnage = pa.tonnage;
  var priorTonnage = weighLines(prior);
  var periodCost = pa.periodCost;
  var costPerKg = periodCost.perKg, costLabel = periodCost.label;

  // Revenue on weighed lines over the tonnage of those same lines.
  var realisation = tonnage.kg > 0 ? tonnage.revKnown / tonnage.kg : null;
  var priorRealisation = priorTonnage.kg > 0 ? priorTonnage.revKnown / priorTonnage.kg : null;
  var contribution = (realisation != null && costPerKg > 0) ? realisation - costPerKg : null;
  var grossMargin = (contribution != null) ? contribution * tonnage.kg : null;

  /* ===== Card 1: the four numbers that decide the month ===== */
  var comparable = _statsPeriod !== 'all' && prior.length > 0;
  var priorLabel = PERIOD_PRIOR_LABELS[_statsPeriod] || '';
  var delta = function(cur, prev) { return comparable ? statsTileSub(statsDeltaText(cur, prev, priorLabel, 'up')) : ''; };
  html += statsPanel('headline', escHtml(PERIOD_LABELS[_statsPeriod] || '') + ' performance',
    comparable ? 'vs ' + escHtml(priorLabel) : '', { wide: true }) +
    statsTiles(
      statsTile('revenue', 'Taxable revenue', formatCurrency(totalRev),
        statsTileSub(filtered.length + ' invoice' + (filtered.length === 1 ? '' : 's') + ' · ' + formatCurrency(totalGrand) + ' incl. GST') +
        delta(totalRev, priorRev)) +
      statsTile('tonnage', 'Tonnage', formatNum(tonnage.kg / 1000, 2) + '<span class="inv-tile-of"> t</span>',
        statsTileSub(formatNum(tonnage.kg, 0) + ' kg') + delta(tonnage.kg, priorTonnage.kg)) +
      statsTile('realisation', 'Realisation', realisation != null ? formatCurrency(realisation) + '<span class="inv-tile-of">/kg</span>' : '&mdash;',
        statsTileSub(costPerKg > 0 ? costLabel + formatCurrency(costPerKg) + '/kg' : 'set a cost in Settings') +
        ((realisation != null && priorRealisation != null) ? delta(realisation, priorRealisation) : ''),
        // Against the cost it must clear: ok past it, warning within 5% under, danger below that.
        costPerKg > 0 ? figToneAgainst(realisation, costPerKg, 5) : '') +
      statsTile('margin', 'Gross margin', grossMargin != null ? statsMoney(grossMargin) : '&mdash;',
        statsTileSub(contribution != null ? statsMoney(contribution) + '/kg contribution' : 'needs tonnage and cost'),
        grossMargin == null ? '' : grossMargin < 0 ? 'danger' : 'ok'), true);

  // Tonnage is only ever as good as the weights behind it — and the lines that
  // lack weights are not a random sample, they are the piece-billed work. Say
  // so in place, in revenue terms, rather than letting a partial figure pass.
  if (tonnage.lines > 0 && tonnage.coverage < 0.999) {
    var missing = tonnage.lines - tonnage.known;
    html += statsCallout('Tonnage and realisation cover <strong>' +
      statsPctOf(tonnage.coverage) + '% of revenue</strong> &mdash; ' +
      missing + ' line' + (missing === 1 ? ' worth ' : 's worth ') + formatCurrency(tonnage.revUnknown) +
      (missing === 1 ? ' is' : ' are') + ' priced in NOS with no weight on file, and excluded from both figures. ' +
      'That exclusion is not neutral: unweighed lines are typically piece-billed work, which is ' +
      'the low-realisation end of the book, so the rate above reads better than the real blend. ' +
      (costLabel === 'live cost ' ? statsCostWeighedNote(tonnage, true) + ' ' : '') +
      'Items Master &rarr; Derive weights from rates closes it.', '', 'coverage');
  }
  if (contribution != null && contribution < 0) {
    html += statsCallout('Realisation is ' + formatCurrency(Math.abs(contribution)) +
      '/kg below full cost. At this tonnage that is ' + formatCurrency(Math.abs(grossMargin)) + ' of loss for the period.', 'danger', 'below-cost');
  }
  // Every figure here is net of credit notes (statsInvoices); one naming no invoice in the book cannot be placed.
  var credited = filtered.reduce(function(s, i) { return s + (i._credit || 0); }, 0), cnOut = cnCreditByInvoice().unplaced;
  if (credited > 0.005 || cnOut.n) {
    html += statsCallout('Net of credit notes' + (credited > 0.005 ? ': ' + formatCurrency(gstRound(credited)) + ' taken off this period\'s invoices' : '') + '.' +
      (cnOut.n ? ' ' + todoPlural(cnOut.n, 'note') + ' (' + formatCurrency(gstRound(cnOut.amount)) + ') name no invoice in the book and are not taken off anywhere.' : ''),
      cnOut.n ? 'warning' : '', 'credit-notes');
  }
  html += '</div>';

  take('overview');
  /* ===== Card 1b: Labour =====
     Placed directly under the headline four, because realisation only means
     something against a cost, and labour is 42% of that cost — the single line
     the app can now measure rather than assume. Silent until a roster exists;
     an empty card teaching the reader that labour is zero would be worse than
     no card at all.
     On All the card's range is the attendance record's own span (labour.js), so
     its ₹/kg divides by the tonnage billed inside that span: the whole book's
     tonnage under a few weeks of labour read the plant's labour at a fraction
     of what it is. Numerator and denominator, same population. */
  var labRange = _statsPeriod === 'all' ? labourRangeForPeriod('all') : null;
  html += renderLabourStatsCard(_statsPeriod, labRange
    ? weighLines(filtered.filter(function(i) { return i.date >= labRange.from && i.date <= labRange.to; })) : tonnage);
  // The live cost: every component with its source (cost.js). Chemicals are
  // in it line by line, so the separate chemicals card is not drawn twice.
  html += renderLiveCostCard(_statsPeriod, tonnage);

  take('cost');
  /* ===== Card 2: GST position ===== */
  var cgst = 0, sgst = 0, igst = 0, unfiledTax = 0, unfiledCount = 0;
  filtered.forEach(function(inv) {
    cgst += (inv.cgstAmt || 0);
    sgst += (inv.sgstAmt || 0);
    igst += (inv.igstAmt || 0);
    if (getInvState(inv) !== 'filed') {
      unfiledTax += (inv.cgstAmt || 0) + (inv.sgstAmt || 0) + (inv.igstAmt || 0);
      unfiledCount++;
    }
  });
  var outputTax = gstRound(cgst + sgst + igst);
  html += statsPanel('gst', 'Output tax', '', { end: statsNum(formatCurrency(outputTax)) }) +
    (cgst > 0 ? statsRow('CGST + SGST @ 9% each', '', statsNum(formatCurrency(gstRound(cgst + sgst)))) : '') +
    (igst > 0 ? statsRow('IGST @ 18%', '', statsNum(formatCurrency(igst))) : '') +
    statsRow('Not yet marked filed', unfiledCount + ' invoice' + (unfiledCount === 1 ? '' : 's'),
      '<span class="inv-row-stack">' + statsNum(formatCurrency(gstRound(unfiledTax))) +
      (unfiledCount > 0 ? uiDot('warning', unfiledCount + ' unfiled') : uiDot('ok', 'All filed')) + '</span>', ' data-unfiled') +
    '</div>';

  /* ===== Card 3: Invoice states ===== */
  var stateCount = { created: 0, printed: 0, dispatched: 0, delivered: 0, filed: 0 };
  filtered.forEach(function(inv) {
    var s = getInvState(inv);
    if (stateCount[s] != null) stateCount[s]++;
  });
  html += statsPanel('states', 'Invoice states', '') + statsTiles(Object.keys(stateCount).map(function(s) {
    return statsTile(s, uiDot(INV_STATE_TONE[s], INV_STATE_LABELS[s]), String(stateCount[s]));
  }).join(''), true) + '</div>';

  take('billing');
  /* ===== Card 4: Revenue by client — ranked bars or share ===== */
  var ranked = buildClientRollup(filtered);
  html += statsPanel('revenue', 'Revenue by client', '', { wide: true,
    end: statsSeg('invStatsClientChart', 'chart', { bar: 'Ranked', pie: 'Share' }, _statsClientChart, 'Chart') }) +
    (_statsClientChart === 'pie'
      ? statsBody(chartPie(ranked.map(function(r) { return { label: r.name, value: r.total, clientId: r.clientId }; }),
          { unit: 'money', ariaLabel: 'Revenue share by client' }))
      : renderRevenueBars(ranked, totalRev)) +
    '</div>';

  /* ===== Card 5: Realisation by client =====
     Ranked by ₹/kg rather than by revenue, because that ordering is the whole
     point: the biggest account and the worst-priced one can be the same row. */
  if (ranked.length > 0 && tonnage.kg > 0) {
    // Comparable rows rank; the rest are listed below them rather than
    // interleaved. A ₹/kg drawn from 4% of a client's book is not the same
    // kind of number as one drawn from all of it, and sorting them together
    // would present it as if it were.
    var comparableRows = ranked.filter(function(r) { return r.comparable; })
      .sort(function(a, b) { return a.realisation - b.realisation; });
    var partial = ranked.filter(function(r) { return !r.comparable; })
      .sort(function(a, b) { return b.total - a.total; });

    if (comparableRows.length > 0 || partial.length > 0) {
      html += statsPanel('realisation', 'Realisation by client', 'worst priced first', { wide: true });

      // The worst-priced ten; the rest one tap away (UX overhaul 2, step 6).
      html += uiMoreHtml('stats-realisation', comparableRows.map(function(r) {
        var below = costPerKg > 0 && r.realisation < costPerKg, tone = costPerKg > 0 ? figToneAgainst(r.realisation, costPerKg, 5) : null;
        return statsRow(escHtml(r.name), formatNum(r.kg / 1000, 2) + ' t · ' + formatCurrency(r.total),
          '<span class="inv-row-stack">' + statsNum(figHtml(formatCurrency(r.realisation), tone) + statsUnit('/kg')) +
          (below ? uiDot(tone, tone === 'danger' ? 'Below cost' : 'Just under cost') : '') + '</span>',
          ' data-action="invStatsClientDrill" data-client-id="' + r.clientId + '" data-client-row');
      }), { n: 10, noun: 'clients' });

      if (partial.length > 0) {
        html += '<div class="inv-row-group"><span>Not ranked: weights on under ' + Math.round(REALISATION_MIN_COVERAGE * 100) + '% of revenue</span></div>';
        partial.forEach(function(r) {
          html += statsRow(escHtml(r.name), 'weights on ' + Math.round(r.coverage * 100) + '% of revenue · ' +
            (r.kg > 0 ? formatNum(r.kg / 1000, 2) + ' t · ' : '') + formatCurrency(r.total),
            uiDot('neutral', 'n/a'),
            ' data-action="invStatsClientDrill" data-client-id="' + r.clientId + '" data-client-row data-partial');
        });
        var partialRev = partial.reduce(function(s, r) { return s + r.total; }, 0);
        var partialShare = totalRev > 0 ? (partialRev / totalRev) * 100 : 0;
        html += statsCallout(partial.length + ' client' + (partial.length === 1 ? '' : 's') +
          ' cannot be priced per kg &mdash; ' + formatCurrency(partialRev) + ', ' + formatNum(partialShare, 0) +
          '% of revenue, billed on parts with no weight on file. These are the accounts most likely to be ' +
          'underpriced, and they are the ones this table cannot yet rank. ' +
          'Items Master &rarr; Derive weights from rates fills them in.', 'danger', 'unranked');
      }

      if (costPerKg > 0) {
        var belowCost = comparableRows.filter(function(r) { return r.realisation < costPerKg; });
        if (belowCost.length > 0) {
          var lossKg = belowCost.reduce(function(s, r) { return s + r.kg; }, 0);
          var lossAmt = belowCost.reduce(function(s, r) { return s + (costPerKg - r.realisation) * r.kg; }, 0);
          html += statsCallout(belowCost.length + ' client' + (belowCost.length === 1 ? '' : 's') +
            ' priced below the ' + formatCurrency(costPerKg) + '/kg full cost, carrying ' +
            formatNum(lossKg / 1000, 2) + ' t and ' + formatCurrency(lossAmt) + ' of the period\'s shortfall. ' +
            'Whether that is worth exiting depends on how much of the cost base is actually variable.', '', 'below-cost');
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
    var heavier = topKgShare != null && topKgShare - topRevShare > 10;
    html += statsPanel('concentration', 'Concentration', '') +
      statsRow(escHtml(top.name), 'Largest client by revenue', '') +
      statsRow('Share of revenue', '', statsNum(formatNum(topRevShare, 0) + '%')) +
      statsRow('Share of tonnage', '', topKgShare != null
        ? '<span class="inv-row-stack">' + statsNum(formatNum(topKgShare, 0) + '%') + (heavier ? uiDot('warning', 'above its revenue share') : '') + '</span>'
        : uiDot('neutral', 'not measurable')) +
      statsRow('Top 3 share', '', statsNum(formatNum((top3Rev / totalRev) * 100, 0) + '%'));
    if (heavier) {
      html += statsCallout(escHtml(top.name) + ' takes a larger share of the plant than of the revenue &mdash; ' +
        'capacity is going somewhere it is not being paid for at the average rate.', '', 'plant-share');
    } else if (topKgShare == null) {
      html += statsCallout(escHtml(top.name) + ' is the largest account by revenue, and how much of the ' +
        'plant it uses cannot be established &mdash; its parts have no weights on file. Until they do, the tonnage ' +
        'share of the single biggest user of capacity is unknown, not small.', '', 'plant-share');
    }
    html += '</div>';
  }

  take('clients');
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
    var amt = pending.reduce(function(s, it) { return s + imLineOpen(it).amount; }, 0);   // the open share of a part-invoiced line

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

  html += statsPanel('unbilled', 'Unbilled material', 'current, not period-filtered', { wide: true, end: statsNum(formatCurrency(totalPending)) });
  if (totalPending > 0) {
    html += statsTiles(ageBuckets.map(function(b, i) {
      var share = totalPending > 0 ? (b.total / totalPending) * 100 : 0;
      return statsTile('age' + i, b.label, formatCurrency(b.total),
        statsTileSub(formatNum(share, 0) + '% &middot; ' + b.items + ' items'), b.max === Infinity && b.total > 0 ? 'warning' : '');
    }).join(''), true);
    pendingRanked.forEach(function(r) {
      html += statsRow(escHtml(r.name), r.items + ' items' + (r.oldest != null ? ' · oldest ' + r.oldest + 'd' : ''),
        statsNum(formatCurrency(r.total)), ' data-action="invStatsClientDrill" data-client-id="' + r.clientId + '"');
    });
  } else {
    html += '<div class="inv-empty">All material invoiced</div>';
  }
  html += '</div>';

  take('billing');
  /* ===== Card 8: Trend — revenue, tonnage, or material arriving ===== */
  var trendData = buildTrendSeries(_statsTrendGran, _statsTrendSeries);
  var trendUnit = TREND_SERIES_UNIT[_statsTrendSeries] || 'money';
  /* A trend is read against its history, so it keeps its own reach whatever the period above; the period is shaded on
     it rather than cutting it to a few points (owner, 30 Sep 2026: the chart had ignored the period chip without a word). */
  var trendReach = { day: 'the last 90 days', week: 'the last 26 weeks', month: 'the last 12 months' }[_statsTrendGran];
  var trendRange = statsRangeIso(_statsPeriod);
  var trendKey = function(iso) { return _statsTrendGran === 'day' ? iso : _statsTrendGran === 'week' ? isoWeekKey(iso) : iso.slice(0, 7); };
  var tLo = trendKey(trendRange.from), tHi = trendKey(trendRange.to), trendSpan = null;
  trendData.forEach(function(d, i) {
    if (d.key < tLo || d.key > tHi) return;
    if (!trendSpan) trendSpan = { i0: i, i1: i }; else trendSpan.i1 = i;
  });
  var spanAll = trendSpan && trendSpan.i0 === 0 && trendSpan.i1 === trendData.length - 1;
  if (spanAll) trendSpan = null;
  var periodName = escHtml(PERIOD_LABELS[_statsPeriod] || _statsPeriod);
  var trendWhat = 'Shows ' + trendReach + ' whatever the period above' +
    (spanAll ? '; ' + periodName + ' covers all of it.' : trendSpan ? '; the shaded part is ' + periodName + '.' : '; ' + periodName + ' is not within it.');
  var trendTitles = {
    revenue: 'Revenue trend',
    tonnage: 'Tonnage trend',
    im: 'Incoming material trend'
  };
  html += statsPanel('trend', escHtml(trendTitles[_statsTrendSeries]),
    _statsTrendSeries === 'im' ? 'by challan date' : 'by invoice date', { wide: true }) +
    statsBody('<div class="inv-toolbar">' +
      statsSeg('invStatsTrendSeries', 'series', { revenue: '₹', tonnage: 'Tonnes', im: 'IM' }, _statsTrendSeries, 'Series') +
      statsSeg('invStatsTrendGran', 'gran', { day: 'Day', week: 'Week', month: 'Month' }, _statsTrendGran, 'Step') +
      statsSeg('invStatsTrendType', 'type', { line: 'Line', bar: 'Bar' }, _statsTrendType, 'Chart') + '</div>' +
      (_statsTrendType === 'bar'
        ? chartBars(trendData, { unit: trendUnit, ariaLabel: trendTitles[_statsTrendSeries], span: trendSpan })
        : chartLine(trendData, { unit: trendUnit, ariaLabel: trendTitles[_statsTrendSeries], span: trendSpan })) +
      statsNote(trendWhat) +
      // Incoming material is the leading indicator: it is what has arrived and
      // not yet been billed, so a fall here shows up in revenue weeks later.
      (_statsTrendSeries === 'im'
        ? statsNote('Weighed challan lines only. What arrives here bills later, so a dip shows in revenue after a lag.')
        : '')) +
    '</div>';

  take('trends');
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
  var cycleRow = function(label, v, n) {
    return v !== null ? statsRow(label, 'average of ' + n + ' invoice' + (n === 1 ? '' : 's'), statsNum(formatNum(v, 1) + statsUnit('days'))) : '';
  };
  if (avgDispatch !== null || avgDelivery !== null) {
    html += statsPanel('dispatch', 'Dispatch cycle', '') +
      cycleRow('Created to dispatched', avgDispatch, dispatchDays.length) +
      cycleRow('Dispatched to delivered', avgDelivery, deliveryDays.length) +
      cycleRow('Full cycle', avgFull, fullCycleDays.length) + '</div>';
  }

  take('billing');
  /* ===== Card 10: Top items — by value, tonnage, or price ===== */
  var top = buildTopItems(filtered, _statsTopBy), topOwners = top.total > 0 ? cpCodeOwners() : {};
  if (top.total > 0) {
    var topTitles = { value: 'Top items by value', tonnage: 'Top items by tonnage', rate: 'Worst priced items' };
    var topUnits = { value: 'money', tonnage: 'kg', rate: 'money' };
    var topBody = '';

    if (top.rows.length === 0) {
      topBody += '<div class="inv-empty">No part in this period has a known weight.</div>';
    } else {
      // On the price ranking the bar is measured against cost, not against the
      // best-priced part: a mark at full cost, and anything short of it in the
      // danger colour. Which parts are sold below cost is the question. The
      // bars are drawn on the mark's scale (opts.max): on the bars' own, the
      // best-priced part below cost filled its track and read as reaching it.
      var rateMax = _statsTopBy === 'rate'
        ? Math.max.apply(null, top.rows.map(function(r) { return r.perKg; }).concat([costPerKg]))
        : 0;
      topBody += chartRankedBars(top.rows.map(function(r) {
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
        // is a change of order rather than a change of what can be seen, and
        // names its client: a part is that client's part.
        var shared = Object.keys(topOwners[r.base] || {}).filter(function(c) { return String(c) !== String(r.clientId); });
        var sub = (r.clientName ? r.clientName + ' · ' : '') + formatCurrency(r.amount) +
          (r.kgKnown && r.kg > 0 ? ' · ' + formatNum(r.kg, 0) + ' kg · ' + formatCurrency(r.perKg) + '/kg' : ' · weight unknown') +
          (shared.length ? ' · code also sent by ' + shared.map(function(c) { var cc = (S.clients || []).find(function(x) { return String(x.id) === String(c); }); return cc ? cc.name : 'another client'; }).join(', ') + ', counted apart' : '');
        var label = r.part + (r.desc && r.desc !== r.part ? ' — ' + r.desc : '');
        // The gauge is said where the part's own text does not already say it (partLineDesc folds it into desc).
        if (r.gauge && rateKey(label).indexOf(rateKey(r.gauge)) < 0) label += ' (' + r.gauge + ')';
        return {
          label: label,
          value: value, display: display, sub: sub, tone: tone, markPct: markPct
        };
      }), { unit: topUnits[_statsTopBy], max: rateMax });
      if (_statsTopBy === 'rate' && costPerKg > 0) {
        topBody += statsNote('Mark is full cost, ' + formatCurrency(costPerKg) +
          '/kg. Bars short of it are plated below what they cost to plate.');
      }
    }

    // The excluded parts are named, not dropped quietly. They are the
    // piece-billed end, so a weight-based ranking that hides them reads better
    // than the truth — the same trap the realisation cards already guard.
    if (top.dropped > 0) {
      topBody += statsNote(top.dropped + ' of ' + top.total +
        ' part' + (top.total !== 1 ? 's' : '') + ' left out: no known weight, so they cannot be ranked this way.');
    }
    html += statsPanel('top', escHtml(topTitles[_statsTopBy]), _statsTopBy === 'rate' ? 'worst first' : '', { wide: true,
      end: statsSeg('invStatsTopBy', 'by', { value: '₹', tonnage: 'Tonnes', rate: '₹/kg' }, _statsTopBy, 'Rank by') }) +
      (top.rows.length === 0 ? topBody : statsBody(topBody)) + '</div>';
  }

  take('trends');
  if (filtered.length || activeInvs.length) {
    // The questions first, each answered as a story (statsStoriesHtml); the figures behind them follow, and the whole
    // insight list closes the page (owner, 30 Sep 2026: it had led the page).
    // The questions work out their moves (advice.js), so they are drawn only while Overview is the tab shown.
    sec.overview = (statsTab() === 'overview' ? statsStoriesHtml(_statsPeriod, filtered, prior, tonnage, periodCost) : '') + sec.overview + statsOverviewHtml(_statsPeriod, filtered, tonnage) +
      paceCardHtml() + statsMonthsHtml() + insightsCardHtml();
    sec.clients = statsMarginHtml(_statsPeriod, filtered, tonnage) + nextChallanCardHtml() + sec.clients;
  }
  html = sec[statsTab()];
  if (html === '') html = '<div class="inv-panel inv-panels-wide"><div class="inv-empty">No data yet. Create invoices and log incoming material to see analytics.</div></div>';
  area.innerHTML = html;
}

/* ===== CLIENT DRILL-DOWN OVERLAY (a card that turns over) =====
   The front is the period at a glance (tiles, the invoice states); the back is the recent invoices
   and pending challans as rows, and the actions. invFlipCard turns it (events.js). */
function openClientDrillOverlay(clientId) {
  clientId = parseInt(clientId);
  var client = S.clients.find(function(c) { return c.id === clientId; });
  if (!client) { showToast('Client not found', 'warning'); return; }

  var activeInvs = statsInvoices();
  var filtered = filterByPeriod(activeInvs, _statsPeriod);
  var clientInvs = filtered.filter(function(i) { return i.clientId === clientId; });
  var totalRev = sumTaxable(clientInvs);
  var allRev = sumTaxable(filtered);
  var pct = allRev > 0 ? Math.round(totalRev / allRev * 100) : 0;

  // The per-kg figure the Stats table ranks on, repeated here so the drill-down
  // answers the question that made someone tap the row.
  var clientTonnage = weighLines(clientInvs);
  // Matched subset, same rule as the table this drill-down was opened from.
  var realisation = (clientTonnage.kg > 0 && clientTonnage.coverage >= REALISATION_MIN_COVERAGE)
    ? clientTonnage.revKnown / clientTonnage.kg : null;
  // Judged against the cost the table judged it against: the period's live cost, the plant's cost per kilo over the
  // whole book's tonnage (statsPeriodCost). The typed figure here once called a client clear of cost that the table
  // beside it listed below cost.
  var cost = statsPeriodCost(_statsPeriod, weighLines(filtered)), costPerKg = cost.perKg;
  var realTone = realisation != null && costPerKg > 0 ? figToneAgainst(realisation, costPerKg, 5) : null;

  var pendingAmt = 0, pendingItems = 0;
  (S.incomingMaterial || []).forEach(function(im) {
    if (im.clientId !== clientId) return;
    im.items.forEach(function(it) {
      if (!it.invoiced) { pendingAmt += imLineOpen(it).amount; pendingItems++; }
    });
  });

  var stateCounts = { created: 0, printed: 0, dispatched: 0, delivered: 0, filed: 0 };
  clientInvs.forEach(function(inv) {
    var s = getInvState(inv);
    if (stateCounts[s] != null) stateCounts[s]++;
  });

  // How the client is billed and its ₹/kg on record today. The modes are weight, piece and nos_to_weight
  // (CLIENT_MODE_LABEL); every one rests on the ₹/kg ladder, a piece client's card having been built at it.
  var ladder = getLineItemRate(client, localDateStr()).ratePerKg || 0;
  var rateInfo = (CLIENT_MODE_LABEL[client.billingMode] || client.billingMode || 'No billing mode') + ' · ' +
    (ladder > 0 ? formatCurrency(ladder) + '/kg' + (client.billingMode === 'piece' ? ' basis' : '') : 'no rate on record');

  var recentInvs = S.invoices
    .filter(function(i) { return i.clientId === clientId && i.status === 'active'; })
    .sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); })
    .slice(0, 5);
  var recentHtml = recentInvs.length === 0 ? '<div class="inv-empty">No invoices</div>' : recentInvs.map(function(inv) {
    return statsRow('<span class="inv-id">' + escHtml(inv.displayNumber) + '</span>', escHtml(formatDate(inv.date)),
      '<span class="inv-row-stack">' + statsNum(formatCurrency(inv.grandTotal)) + getStateDotHtml(inv) + '</span>');
  }).join('');

  var pendingChallans = (S.incomingMaterial || []).filter(function(im) {
    if (im.clientId !== clientId) return false;
    return im.items.some(function(it) { return !it.invoiced; });
  });
  var challanHtml = pendingChallans.length === 0 ? '<div class="inv-empty">No pending challans</div>' : pendingChallans.map(function(im) {
    var pItems = im.items.filter(function(it) { return !it.invoiced; });
    var pAmt = pItems.reduce(function(s, it) { return s + imLineOpen(it).amount; }, 0);
    return statsRow(im.challanNo ? 'Ch. <span class="inv-id">' + escHtml(im.challanNo) + '</span>' : 'No number',
      escHtml(formatDate(im.challanDate)) + ' · ' + pItems.length + ' items', statsNum(formatCurrency(pAmt)));
  }).join('');

  var periodLabel = PERIOD_LABELS[_statsPeriod] || 'All';
  var flipIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>';

  // Two faces, one showing at a time (inv-flip-front / -back, §6.16): the figures, then the rows and the one primary.
  dialogOpen('<div class="inv-dialog" data-drill="' + clientId + '">' +
    '<div data-flip>' +
    '<div class="inv-flip-front">' +
    dialogHeadHtml(escHtml(client.name)) +
    '<div class="inv-note inv-mb-8">' + escHtml(periodLabel) + ' &middot; ' + escHtml(rateInfo) + '</div>' +
    '<div class="inv-tiles">' +
    statsTile('revenue', 'Revenue', formatCurrency(totalRev)) +
    statsTile('tonnage', 'Tonnage', formatNum(clientTonnage.kg / 1000, 2) + '<span class="inv-tile-of"> t</span>') +
    // Its tone beside the words that give it (DR-8): the cost it is set against, and a dot when it falls short.
    statsTile('realisation', '&#8377;/kg', realisation != null ? formatNum(realisation, 2) : '&mdash;',
      statsTileSub(realisation == null
        ? (clientTonnage.kg > 0 ? 'weights on ' + statsPctOf(clientTonnage.coverage) + '% of revenue' : 'no weighed tonnage')
        : costPerKg > 0 ? (realTone === 'danger' || realTone === 'warning' ? uiDot(realTone, realTone === 'danger' ? 'Below cost' : 'Just under cost') + ' ' : '') +
          escHtml(cost.label) + formatCurrency(costPerKg) + '/kg' : 'set a cost in Settings'),
      realTone || '') +
    statsTile('share', 'Share', pct + '%') +
    statsTile('invoices', 'Invoices', String(clientInvs.length)) +
    statsTile('unbilled', 'Unbilled', formatCurrency(pendingAmt)) +
    '</div>' +
    '<div class="inv-toolbar">' + Object.keys(stateCounts).map(function(s) {
      return uiDot(INV_STATE_TONE[s], stateCounts[s] + ' ' + INV_STATE_LABELS[s]);
    }).join('') + '</div>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-block" data-action="invFlipCard">' + flipIcon + ' Details and actions</button>' +
    '</div>' +
    '<div class="inv-flip-back">' +
    dialogHeadHtml(escHtml(client.name), 'invCloseOverlay', 'Close',
      '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invFlipCard" aria-label="Flip back">' + flipIcon + '</button>') +
    '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">Recent invoices</span></div>' + recentHtml + '</div>' +
    '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">Pending challans</span></div>' + challanHtml + '</div>' +
    '<div class="inv-toolbar">' +
    '<button class="inv-btn inv-btn-primary" data-action="invStatsCreateInvoice" data-client-id="' + clientId + '">Create invoice</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invStatsJumpRegister" data-client-id="' + clientId + '">View in Register</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invStatsJumpIM" data-client-id="' + clientId + '">View in IM</button>' +
    '</div></div>' +
    '</div></div>');
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
var _historyShowCount = UI_MORE_ROWS;   // the latest thirty, then thirty more at a time (UX overhaul 2, step 6)
var _historyType = 'all';
var _historySearch = '';
var _historySearchTimer = null;
var _historyWho = '';   // a user id, '_none' for changes made with no ID, '' for everyone (changelog.js)

var HISTORY_TYPES = [
  { key: 'all', label: 'All' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'challan', label: 'Challans' },
  { key: 'state', label: 'Status' },
  { key: 'floor', label: 'Floor' },
  { key: 'audit', label: 'Audit' },
  // The change log (changelog.js): every save, record by record, with who made it.
  { key: 'change', label: 'Changes' }
];

// Inline SVG per event type (HR-4: no emoji).
var HISTORY_ICONS = {
  invoice: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  challan: '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>',
  state: '<polyline points="20 6 9 17 4 12"/>',
  cancel: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  void: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>',
  dupe: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
  shift: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  extra: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  except: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>'
};
// A deleted attendance day is a deletion, as a deleted invoice is.
HISTORY_ICONS.attDelete = HISTORY_ICONS.void;
// Quotations (quote.js): issued, accepted or declined, a revision or a supersession, and a void.
HISTORY_ICONS.quote = HISTORY_ICONS.invoice;
HISTORY_ICONS.quoteRev = HISTORY_ICONS.except;
HISTORY_ICONS.quoteVoid = HISTORY_ICONS.void;
// A change from the change log: a pencil.
HISTORY_ICONS.chg = '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/>';

function historyIcon(kind) {
  var path = HISTORY_ICONS[kind] || HISTORY_ICONS.state;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' + path + '</svg>';
}

/* What each kind of event is called on its row, and its tone (DR-8: a dot and a
   word). Colour is spent on the audit trail's own findings: a cancellation or a
   deletion is danger, a decision somebody signed off (an accepted duplicate, an
   explained exception, a corrected challan) is warning, a state moving forward
   is ok; the ordinary record is neutral. */
var HISTORY_KIND_WORDS = {
  invoice: ['Invoice', 'neutral'], challan: ['Challan', 'neutral'], state: ['Status', 'ok'],
  cancel: ['Cancelled', 'danger'], void: ['Deleted', 'danger'], dupe: ['Duplicate', 'warning'],
  shift: ['Attendance', 'neutral'], extra: ['Extra hours', 'neutral'], except: ['Exception', 'warning'], attDelete: ['Deleted', 'danger'],
  quote: ['Quotation', 'ok'], quoteRev: ['Revised', 'warning'], quoteVoid: ['Void', 'danger']
};
function historyKindHtml(ev) {
  // A challan corrected from an invoice is a challan event on the audit filter. A change says what it did (changelog.js).
  var k = ev.kind === 'challan' && ev.type === 'audit' ? ['Corrected', 'warning']
    : ev.kind === 'chg' && typeof CHG_ACT_WORDS !== 'undefined' ? (CHG_ACT_WORDS[ev.act] || CHG_ACT_WORDS.changed)
    : (HISTORY_KIND_WORDS[ev.kind] || ['Event', 'neutral']);
  return '<span class="inv-dot inv-dot-' + k[1] + '">' + k[0] + '</span>';
}

/* Every event the app can account for, newest first. Kept as one function so
   the CSV export and the rendered list can never drift apart. */
function buildHistoryEvents() {
  var events = [];

  S.invoices.forEach(function(inv) {
    if (_historyClientFilter && inv.clientId != _historyClientFilter) return;
    events.push({ ts: inv.createdAt, type: 'invoice', kind: 'invoice', sourceId: inv.id, jump: 'invoice',
      text: 'Invoice ' + (inv.displayNumber || '') + ' created for ' + (inv.clientName || ''), amount: inv.grandTotal });
    if (inv.printedAt) events.push({ ts: inv.printedAt, type: 'state', kind: 'state', sourceId: inv.id, jump: 'invoice',
      text: (inv.displayNumber || '') + ' printed' });
    if (inv.dispatchedAt) events.push({ ts: inv.dispatchedAt, type: 'state', kind: 'state', sourceId: inv.id, jump: 'invoice',
      text: (inv.displayNumber || '') + ' dispatched' });
    if (inv.deliveredAt) events.push({ ts: inv.deliveredAt, type: 'state', kind: 'state', sourceId: inv.id, jump: 'invoice',
      text: (inv.displayNumber || '') + ' delivered (signed copy received)' });
    if (inv.filedAt) events.push({ ts: inv.filedAt, type: 'state', kind: 'state', sourceId: inv.id, jump: 'invoice',
      text: (inv.displayNumber || '') + ' marked as filed in GSTR1' });
    if (inv.status === 'cancelled' && inv.cancelledAt) events.push({ ts: inv.cancelledAt, type: 'audit', kind: 'cancel', sourceId: inv.id, jump: 'invoice',
      text: (inv.displayNumber || '') + ' cancelled' });
    // Cancelling stamps updatedAt beside cancelledAt (invoice-ops.js), so a change stamped within two seconds of the
    // cancel IS the cancel, already its own row: listed again it read as an edit nobody made.
    var cancelEcho = inv.cancelledAt && Math.abs(inv.updatedAt - inv.cancelledAt) <= 2000;
    if (inv.updatedAt && inv.updatedAt !== inv.createdAt && !cancelEcho) events.push({ ts: inv.updatedAt, type: 'state', kind: 'state', sourceId: inv.id, jump: 'invoice',
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
    // A challan line corrected from an invoice: the challan is the record of the
    // customer's paper, so a change to it is an audit event and says what moved.
    (im.items || []).forEach(function(it) {
      (it.corrections || []).forEach(function(cx) {
        var t = challanCorrectionText(it, cx), cut = t.indexOf(': ');
        events.push({
          ts: cx.at, type: 'audit', kind: 'challan', sourceId: im.id, jump: 'challan',
          text: 'Challan' + (im.challanNo ? ' ' + im.challanNo : '') + ' corrected ' + t.slice(0, cut) +
            ': ' + (it.partNumber || '') + ' \u2014 ' + t.slice(cut + 2)
        });
      });
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
      cc: 'voidedNumbers', cr: typeof chgRidOf === 'function' ? chgRidOf('voidedNumbers', v) : null,
      text: what + (v.clientName ? ' (' + v.clientName + ')' : '') +
        ' — ' + (v.reason || 'no reason recorded') +
        (v.reserved ? ' [number stays spent]' : ' [number returned to series]'),
      amount: v.grandTotal || 0
    });
  });

  qtHistoryEvents(events, _historyClientFilter);
  pushFloorEvents(events);

  // The change log (changelog.js): its rows, and on the events above who made each one. An event that opens a record
  // names it for the match: the store and the record.
  events.forEach(function(ev) {
    if (ev.cc || !ev.sourceId || !ev.jump) return;
    ev.cc = ev.jump === 'invoice' ? 'invoices' : 'incomingMaterial';
    ev.cr = ev.sourceId;
  });
  if (typeof chgHistoryEvents === 'function') chgHistoryEvents(events, _historyClientFilter);

  return events;
}

/* ===== THE FLOOR =====

   Two clocks meet in this log and conflating them would be the whole mistake.
   An invoice event is dated by **when it was recorded**; every one of them
   carries a real `createdAt`. A day on the floor has no such stamp -- the
   attendance store is keyed by the date it describes and nothing writes down
   when somebody typed it -- so a floor event is dated by **the day it is
   about**.

   That is the honest reading rather than a workaround: it is the date on the
   sheet, and it is the same convention Stats already uses for periods, which
   are measured on the invoice date and not on when the record was typed. But
   it is a different question from "when did this get entered", so every floor
   row says `floor day` in place. A reader must never have to guess which clock
   a row is on.

   The exception ledger is the one staff event with a genuine record-time
   (`recordExtraException` stamps `at`), so it keeps it and says `recorded`.

   Floor events carry no client, so a client filter excludes them: showing the
   shop's Tuesday under "SSS Mehta" would assert a connection that does not
   exist. */
function floorTs(iso) {
  var p = String(iso || '').split('-');
  if (p.length !== 3) return 0;
  // Midday local, never new Date("YYYY-MM-DD") -- that parses as UTC and can
  // land the row on the previous day west of Greenwich.
  return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0, 0).getTime();
}

function pushFloorEvents(events) {
  // A client filter is a question about one account. The floor has no account.
  if (_historyClientFilter) return;

  var areaLabel = {};
  (typeof STAFF_AREAS !== 'undefined' ? STAFF_AREAS : []).forEach(function(a) {
    areaLabel[a.id] = a.label;
  });
  function labelFor(id) { return areaLabel[id] || id || 'unassigned'; }

  Object.keys(S.attendance || {}).forEach(function(iso) {
    var rec = (S.attendance || {})[iso] || {};
    var ts = floorTs(iso);
    var marks = rec.marks || {};
    var ids = Object.keys(marks);

    if (ids.length > 0) {
      var present = 0, half = 0, absent = 0, ot = 0;
      var areas = {};
      ids.forEach(function(id) {
        var m = marks[id] || {};
        if (m.st === 'P') present++;
        else if (m.st === 'H') half++;
        else if (m.st === 'A') absent++;
        ot += Number(m.ot) || 0;
        if (m.st === 'P' || m.st === 'H') areas[m.area] = (areas[m.area] || 0) + 1;
      });
      // Ranked by heads, because the question a reader brings to this row is
      // "where was everybody", not "list the areas alphabetically".
      var where = Object.keys(areas)
        .sort(function(a, b) { return areas[b] - areas[a]; })
        .map(function(a) { return labelFor(a) + ' ' + areas[a]; })
        .join(' \u00b7 ');
      events.push({
        ts: ts, type: 'floor', kind: 'shift', sourceId: null, jump: null, clock: 'floor',
        text: 'Attendance recorded \u2014 ' + present + ' present' +
          (half ? ', ' + half + ' half' : '') +
          (absent ? ', ' + absent + ' absent' : '') +
          (ot ? ', ' + formatNum(ot, 1) + ' h OT' : '') +
          (where ? ' \u2014 ' + where : '')
      });
    }

    // The extra is the line the whole Areas card exists to check, so each entry
    // is its own row rather than a day total: a reader who wants to know what
    // was booked, where, needs the where.
    (rec.extra || []).forEach(function(x) {
      var hrs = Number(x.hours) || 0;
      if (typeof extraIsBlock === 'function' && extraIsBlock(x)) {
        var covered = (x.areas || []).map(labelFor).join(' + ') || labelFor(x.area);
        var span = (x.from && x.to) ? x.from + '\u2013' + x.to : '';
        var crew = (x.crew || []).length;
        events.push({
          ts: ts, type: 'floor', kind: 'extra', sourceId: null, jump: null, clock: 'floor',
          text: 'OT block \u2014 ' + formatNum(hrs, 1) + ' h booked to ' + covered +
            (span ? ' (' + span + ')' : '') +
            // Say which of the three inputs is missing, in the row, rather than
            // leaving the reader to open the Areas card to find out why a block
            // never turns up in the reconciliation.
            (crew ? ', crew of ' + crew : ', no crew recorded') +
            (span ? '' : ', no times recorded')
        });
      } else {
        events.push({
          ts: ts, type: 'floor', kind: 'extra', sourceId: null, jump: null, clock: 'floor',
          text: 'Extra hours \u2014 ' + formatNum(hrs, 1) + ' h booked to ' +
            labelFor(x.area) + ' (general shift)'
        });
      }
    });
  });

  /* An examined disagreement, on the voidedNumbers / dupeAck precedent: an
     audit must be able to tell an exception somebody looked at from one nobody
     was shown. This one has a real record-time, so it is on the recorded clock
     and says so. */
  // A deleted attendance day: on the recorded clock, the day it was about and why it went.
  (S.attendanceDeletes || []).forEach(function(x) {
    var what = ' (' + x.marks + ' mark' + (x.marks === 1 ? '' : 's') + ', ' + x.extra + ' EXTRA row' + (x.extra === 1 ? '' : 's') + ')';
    events.push({
      ts: x.at, type: 'audit', kind: 'attDelete', sourceId: null, jump: null, clock: 'recorded', cc: 'attendanceDeletes', cr: x.id,
      // A day read again from its rolls (relay.js) is logged the same way, and is not a day deleted.
      text: x.how === 'reread'
        ? 'Attendance day read again from its rolls \u2014 ' + formatDate(x.iso) + ' as it was' + what + ' kept in the log'
        : 'Attendance day deleted \u2014 ' + (x.iso ? formatDate(x.iso) : 'saved under no date ("' + x.key + '")') + what +
          (x.how === 'migration' ? ', by the app on the owner\u2019s instruction' : '') + ' \u2014 ' + (x.reason || 'no reason recorded')
    });
  });

  // An explanation explained again or reopened is kept (areas.js, recordExtraException): each is its own event.
  (S.extraExceptions || []).forEach(function(x) {
    var about = (x.label || x.key || '') + ' on ' + formatDate(x.iso);
    events.push({
      ts: x.at || floorTs(x.iso), type: 'audit', kind: 'except', sourceId: null, jump: null,
      clock: x.at ? 'recorded' : 'floor', cc: 'extraExceptions', cr: typeof chgRidOf === 'function' ? chgRidOf('extraExceptions', x) : null,
      text: 'Extra-hours exception explained \u2014 ' + about +
        (x.expected == null ? '' : ' (expected ' + formatNum(x.expected, 1) + ' h, booked ' +
          formatNum(x.booked || 0, 1) + ' h)') +
        ' \u2014 ' + (x.reason || 'no reason recorded') + (x.supersededAt ? ' (explained again since)' : '')
    });
    if (x.reopenedAt) events.push({
      ts: x.reopenedAt, type: 'audit', kind: 'except', sourceId: null, jump: null, clock: 'recorded',
      cc: 'extraExceptions', cr: typeof chgRidOf === 'function' ? chgRidOf('extraExceptions', x) : null,
      text: 'Extra-hours exception reopened \u2014 ' + about + ' \u2014 the explanation "' + (x.reason || '') + '" no longer stands'
    });
  });
}

/* The filters applied once, so the rendered list and the CSV export can never
   disagree about what "the log" currently means. */
function filteredHistoryEvents() {
  var events = buildHistoryEvents();

  if (_historyType !== 'all') {
    events = events.filter(function(ev) { return ev.type === _historyType; });
  } else {
    // An act already on its event's row ("by Asha") is listed once; Changes lists every entry of the log.
    events = events.filter(function(ev) { return !ev.folded; });
  }
  // Who made it: every row that carries a user (the log's, and an event the log names).
  if (_historyWho && typeof chgWhoMatch === 'function') {
    events = events.filter(function(ev) { return chgWhoMatch(ev, _historyWho); });
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

/* Which clock a row is on (CLAUDE.md § History is the audit trail). A floor day
   is dated by the day it describes and shows the DATE ALONE: its midday
   timestamp exists only to sort it among recorded events, and rendering the
   '12:00' would invent an entry time on exactly the rows the two-clock labelling
   keeps honest. The exception ledger has a real record-time and says so.
   `part` is 'all' for the phone's meta line, 'time' for the desktop table,
   whose day heading already carries the date. */
function historyWhen(ev, part) {
  if (!ev.ts) return '';
  var full = formatTimestamp(ev.ts), day = full.split(',')[0], time = (full.split(',')[1] || '').trim();
  if (ev.clock === 'floor') return (part === 'time' ? '' : day + ' · ') + 'floor day';
  return (part === 'time' ? time : full) + (ev.clock === 'recorded' ? ' · recorded' : '') + historyWhoText(ev);
}
/* Who made it (changelog.js): on a change, the device it was made on (its row already names the person); on an event
   the log names, the person. */
function historyWhoText(ev) {
  if (typeof chgUserName !== 'function') return '';
  if (ev.type === 'change') { var d = chgDeviceLabel(ev.dev); return d ? ' · on ' + d : ''; }
  return Object.prototype.hasOwnProperty.call(ev, 'by') ? ' · by ' + chgUserName(ev.by) : '';
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
    // The kind of event is a choice among six (§6.6): chips pressed with aria-pressed,
    // wrapping on the phone rather than stretched to the height of the filters beside them.
    var typeChips = HISTORY_TYPES.map(function(t) {
      return '<button class="inv-chip" data-action="invHistoryType" data-type="' + t.key + '" aria-pressed="' + (_historyType === t.key) + '">' + t.label + '</button>';
    }).join('');

    // Who made it (changelog.js): shown once anybody has an ID or the log names one.
    var whoOpts = typeof chgWhoOptions === 'function' ? chgWhoOptions() : [];
    if (_historyWho && !whoOpts.some(function(o) { return o[0] === _historyWho; })) _historyWho = '';
    var whoSel = whoOpts.length ? '<select class="inv-select inv-toolbar-item" id="historyWho" aria-label="Filter by who made it">' +
      '<option value="">Everyone</option>' + whoOpts.map(function(o) {
        return '<option value="' + escHtml(o[0]) + '"' + (_historyWho === o[0] ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>';
      }).join('') + '</select>' : '';
    toolbar.innerHTML = '<div class="inv-toolbar">' +
      '<label class="inv-search">' + ICON_SEARCH +
      '<input type="search" id="historySearch" value="' + escHtml(_historySearch) + '" placeholder="Search invoice or challan number" autocomplete="off" aria-label="Search the log"></label>' +
      '<select class="inv-select inv-toolbar-item" id="historyClientFilter" aria-label="Filter by client">' +
      '<option value="">All clients</option>' + clientOpts + '</select>' + whoSel +
      '</div>' +
      '<div class="inv-toolbar">' +
      '<label class="inv-field inv-toolbar-item"><span class="inv-field-label">From</span>' +
      '<input type="date" class="inv-input" id="historyDateFrom" value="' + escHtml(_historyDateFrom) + '" aria-label="From date"></label>' +
      '<label class="inv-field inv-toolbar-item"><span class="inv-field-label">To</span>' +
      '<input type="date" class="inv-input" id="historyDateTo" value="' + escHtml(_historyDateTo) + '" aria-label="To date"></label>' +
      '</div>' +
      '<div class="inv-toolbar" role="group" aria-label="Kind of event">' + typeChips + '</div>';
  }

  var events = filteredHistoryEvents();
  // Under Changes, how many older entries the log let go of (changelog.js).
  var dropped = _historyType === 'change' && typeof chgDroppedText === 'function' ? chgDroppedText() : '';

  if (events.length === 0) {
    var filtered = _historyType !== 'all' || _historySearch || _historyClientFilter || _historyDateFrom || _historyDateTo || _historyWho;
    area.innerHTML = '<div class="inv-panel"><div class="inv-empty">' +
      (_historyType === 'change' && !_historySearch && !_historyClientFilter && !_historyDateFrom && !_historyDateTo && !_historyWho
        ? 'No changes logged yet: every save from now on is listed here, with who made it'
        : filtered ? 'No activity matches these filters' : 'No activity yet: invoices, challans and attendance appear here as they are recorded') +
      '</div>' + (dropped ? '<div class="inv-panel-body inv-note" data-chg-dropped>' + escHtml(dropped) + '</div>' : '') + '</div>';
    return;
  }

  // No total of the amounts: the log holds invoices with their GST, challans before it (the same work the invoices
  // bill, counted twice), deleted invoices and floor days, and no one sum of those is a figure. Stats carries the money.
  var html = '<div class="inv-panel inv-panel-flush" data-card="history">' +
    '<div class="inv-panel-head"><span class="inv-panel-title">Activity log <span class="inv-panel-count">' + events.length + '</span></span>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invHistoryExport">Export CSV</button></div>' +
    (dropped ? '<div class="inv-panel-body inv-note" data-chg-dropped>' + escHtml(dropped) + '</div>' : '');

  var shown = events.slice(0, _historyShowCount);
  // Rows grouped by day (§7): the day heads the group, so on the desktop a row's
  // cell carries the time alone.
  // A day's count is of all its events, not only those shown before Show more,
  // so a day cut in half by the page does not read as a quiet day.
  var days = [], byDay = {}, dayCount = {};
  function dayOf(ev) { return ev.ts ? formatTimestamp(ev.ts).split(',')[0] : 'Unknown date'; }
  events.forEach(function(ev) { var d = dayOf(ev); dayCount[d] = (dayCount[d] || 0) + 1; });
  shown.forEach(function(ev) {
    var d = dayOf(ev);
    if (!byDay[d]) { byDay[d] = []; days.push(d); }
    byDay[d].push(ev);
  });
  // A void has no record left to jump to — the invoice is gone. Rendering it as
  // a tappable row would promise a destination that does not exist, so it is a
  // plain row (a div, a tr with no action), never a button.
  function jumpOf(ev) {
    return ev.jump === 'challan' ? 'invHistoryJumpChallan' : ev.jump === 'invoice' ? 'invHistoryJumpInvoice' : '';
  }
  function amountHtml(ev) { return ev.amount ? '<span class="inv-num">' + formatCurrency(ev.amount) + '</span>' : ''; }
  // A change names its first fields on the row; every field is in its title (and in the CSV).
  function fullAttr(ev) { return ev.full && ev.full !== ev.text ? ' title="' + escHtml(ev.full) + '"' : ''; }

  if (_isDesktop) {
    html += '<table class="inv-table inv-table-history"><thead><tr><th>Time</th><th>Event</th><th>Kind</th><th class="inv-num">Amount</th></tr></thead><tbody>';
    days.forEach(function(d) {
      html += '<tr class="inv-table-group"><td colspan="4">' + escHtml(d) + ' · ' + dayCount[d] + '</td></tr>';
      byDay[d].forEach(function(ev) {
        var action = jumpOf(ev);
        var attrs = ' data-ev="' + ev.kind + '"' + (action ? ' data-action="' + action + '" data-id="' + escHtml(ev.sourceId) + '"' : '');
        html += '<tr' + attrs + '>' +
          '<td class="inv-id">' + escHtml(historyWhen(ev, 'time')) + '</td>' +
          // The event is a real button on a row that opens, so it opens from the keyboard.
          '<td' + fullAttr(ev) + '>' + (action
            ? '<button class="inv-btn-link" data-action="' + action + '" data-id="' + escHtml(ev.sourceId) + '">' + escHtml(ev.text) + '</button>'
            : escHtml(ev.text)) + '</td>' +
          '<td>' + historyKindHtml(ev) + '</td>' +
          '<td class="inv-num">' + (ev.amount ? formatCurrency(ev.amount) : '') + '</td></tr>';
      });
    });
    html += '</tbody></table>';
  } else {
    days.forEach(function(d) {
      html += '<div class="inv-row-group"><span>' + escHtml(d) + '</span><span class="inv-num">' + dayCount[d] + '</span></div>';
      byDay[d].forEach(function(ev) {
        var action = jumpOf(ev);
        var inner = '<span class="inv-row-lead">' + historyIcon(ev.kind) + '</span>' +
          '<span class="inv-row-main"><span class="inv-row-title inv-row-wrap"' + fullAttr(ev) + '>' + escHtml(ev.text) + '</span>' +
          '<span class="inv-row-meta inv-id">' + escHtml(historyWhen(ev, 'all')) + '</span></span>' +
          '<span class="inv-row-end"><span class="inv-row-stack">' + amountHtml(ev) + historyKindHtml(ev) + '</span></span>';
        html += action
          ? '<button class="inv-row inv-row-2 inv-row-top" data-ev="' + ev.kind + '" data-action="' + action + '" data-id="' + escHtml(ev.sourceId) + '">' + inner + '</button>'
          : '<div class="inv-row inv-row-2 inv-row-top" data-ev="' + ev.kind + '">' + inner + '</div>';
      });
    });
  }
  html += '</div>';

  if (events.length > _historyShowCount) {
    var remaining = events.length - _historyShowCount;
    html += '<button class="inv-btn inv-btn-secondary inv-btn-block" data-action="invHistoryLoadMore">' +
      'Show more (' + remaining + ' remaining)</button>';
  }
  area.innerHTML = html;
}

/* Exports exactly what the current filters show, so a query someone reasoned
   about on screen is the query that leaves the app. Written by the app's one
   CSV writer (downloadCSV, exports.js), which leads with the byte-order mark a
   spreadsheet needs to read ₹ and the dashes in the event text as UTF-8. */
function exportHistoryCSV() {
  var events = filteredHistoryEvents();
  if (events.length === 0) { showToast('Nothing to export', 'warning'); return; }

  // Who made it and on which device (changelog.js): blank where nothing says.
  var hasWho = typeof chgUserName === 'function';
  var rows = [['Timestamp', 'Dated by', 'Type', 'Event', 'Amount', 'By', 'Device']];
  events.forEach(function(ev) {
    var named = hasWho && Object.prototype.hasOwnProperty.call(ev, 'by');
    rows.push([
      // A floor row's cell is the date alone, for the same reason the rendered
      // row's is: the midday anchor is a sort key, not a recorded time.
      ev.ts ? (ev.clock === 'floor' ? formatTimestamp(ev.ts).split(',')[0] : formatTimestamp(ev.ts)) : '',
      // The same distinction the row carries. A CSV that dropped it would let
      // somebody sort two clocks into one column and reason off the result.
      ev.clock === 'floor' ? 'floor day' : 'recorded',
      ev.kind === 'chg' ? 'change: ' + ev.act : ev.kind,
      ev.full || ev.text,
      ev.amount ? formatNum(ev.amount, 2) : '',
      named ? chgUserName(ev.by) : '',
      hasWho ? chgDeviceLabel(ev.type === 'change' ? ev.dev : ev.byDev) : ''
    ]);
  });
  downloadCSV('sep-activity-log-' + localDateStr() + '.csv', rows);
  showToast('Exported ' + events.length + ' events');
}
