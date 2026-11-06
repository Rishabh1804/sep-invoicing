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
/* The trend's series and Top parts' ranking are their widgets' Choose since U3 (widgetcards.js `trend`, `topitems`). */

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
 *
 * `src` names the route a known weight came by (the data layer's kg_src, dataview.js): 'line' (a KG line's own
 * quantity), 'part' (S.partWeights), 'master' (the Items Master stdWeightKg), 'rate' (a piece client's amount
 * over its ₹/kg); null when the weight is not known. Nothing else reads it.
 */
function lineWeightKg(item, client, dateStr) {
  if (!item) return { kg: 0, known: false, src: null };
  var qty = item.qty || 0;
  if ((item.unit || 'KG') === 'KG') return { kg: qty, known: qty > 0, src: qty > 0 ? 'line' : null };

  var key = (item.partNumber || '').toUpperCase();
  var per = (S.partWeights && S.partWeights[key] != null) ? S.partWeights[key] : null, src = per != null ? 'part' : null;
  if (per == null) {
    var master = (S.items || []).find(function(it) {
      return (it.partNumber || '').toUpperCase() === key;
    });
    if (master && master.stdWeightKg != null) { per = master.stdWeightKg; src = 'master'; }
  }
  if (per != null && per > 0) return { kg: qty * per, known: true, src: src };

  /* Piece-billed line with nothing in the catalogue: the weight is on the line
     itself and needs no registry at all. The piece rate WAS weight x ratePerKg,
     so the line's own amount / ratePerKg is its weight.

     This is not a nicety. 127 of SSSMehta's lines name parts with no Items
     Master row whatsoever — 17% of that client's revenue — and going through
     the registry left every one of them uncounted. Their part numbers also
     vary in spelling between invoices ("Clamp 165x83" against
     "CLAMP 165X83(40X6)"), so registry matching would stay fragile even if
     the rows existed. Reading the line direct sidesteps both. */
  // The amount as billed (_gross on a line statsInvoices netted of a credit note): the note takes rupees off, never kilos.
  var billed = item._gross != null ? Number(item._gross) || 0 : item.amount || 0;
  if (client && client.billingMode === 'piece' && billed > 0) {
    var rateInfo = getLineItemRate(client, dateStr || localDateStr(), item.partNumber);
    // An itemRates override is a negotiated per-piece figure with no weight
    // basis; inverting it would invent a number rather than recover one.
    if (!rateInfo._override && rateInfo.ratePerKg > 0) {
      return { kg: billed / rateInfo.ratePerKg, known: true, src: 'rate' };
    }
  }
  return { kg: 0, known: false, src: null };
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
  return { perKg: isLive ? live.perKg : (S.defaultCostPerKg || 0), label: isLive ? 'live cost ' : 'cost ', measuredShare: isLive ? live.measuredShare : null };
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

/* The same in one line, for a card that keeps a note to a line (§3c): the weighed share and how high it reads. */
function statsCostWeighedShort(tonnage) {
  if (!tonnage || !(tonnage.kg > 0) || !(tonnage.coverage < 0.999)) return '';
  if (!(tonnage.coverage > 0)) return 'Nothing priced was weighed: the live cost per kg cannot be set against what was billed.';
  var up = (1 / tonnage.coverage - 1) * 100;
  // It names its figure: under Trends' line that realisation reads high, a line saying only "reads high" read as realisation's.
  return 'The live cost per kg divides by the weighed lines alone, ' + statsPctOf(tonnage.coverage) + '% of revenue: it reads high' +
    (up >= 0.5 ? ' by about ' + Math.round(up) + '%' : ' slightly') + '.';
}

/* ===== THE DASHBOARD'S PIECES (design system §6) =====
   Every Stats card is a flush panel (§6.8) named by data-card, its qualifier an inv-note in the title;
   figures are tiles (§6.9) and rows (§6.10); caveats are callouts (§6.18). intel.js, insights.js and
   cost.js draw their cards with the same pieces. */

/* A segmented control for a setting of the card it sits in (§6.5). `inv-seg-fit` keeps it the width
   of its buttons, so a card's head or toolbar can hold it beside its title. */
function statsSeg(action, dataKey, labels, current, aria, fit, cls) {
  return '<div class="inv-seg' + (fit === false ? '' : ' inv-seg-fit') + (cls ? ' ' + cls : '') + '" role="group" aria-label="' + escHtml(aria) + '">' +
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
      // A line keeps what it billed (_gross) beside its net amount: a piece line with no weight on record is weighed by its amount
      // over its ₹/kg (lineWeightKg), and a credit note takes rupees off a line, never kilos.
      items: (inv.items || []).map(function(it) { return Object.assign({}, it, { amount: gstRound((Number(it.amount) || 0) * f), _gross: it.amount }); }) });
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
function buildTopItems(invoices, by, n) {
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

  return { rows: n === Infinity ? sorted : sorted.slice(0, n || 10), dropped: dropped, total: all.length };
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

/* What the period's cards are read from, worked out once: the active invoices net of their credit notes, the period's
   and the stretch before it, the period's weighed tonnage, and the cost every "below cost" on Stats is judged against
   (the period's LIVE cost, statsPeriodCost, so the headline and the Overview cannot disagree). renderStats reads it, and
   so do the questions with their moves (advice.js: advQuestions), so a question asked away from Stats reads
   the same figures as the card on it. */
function statsPulseArgs(period) {
  var activeInvs = statsInvoices();
  var filtered = filterByPeriod(activeInvs, period);
  var tonnage = weighLines(filtered);
  return { period: period, activeInvs: activeInvs, filtered: filtered, prior: filterByPeriod(activeInvs, period, 1),
    tonnage: tonnage, periodCost: statsPeriodCost(period, tonnage) };
}

/* ===== STATS AS A DASHBOARD (UI pass 3, U3; docs/UI_PASS_3.md §10, §26a) =====
   Owner, 15 Oct 2026: "The stats page doesn't look like a stats page at all, we have stored and displayed our data on tables
   essentially." Two views: the Dashboard (`board`), a board of widgets each person arranges as Home's, and the Tables (`tables`),
   By client · By part · By month · Cost, each a table sorted by a tap on its head, exported to CSV or Excel. One verdict leads both
   (the period's price against the live cost), then one toolbar row: the period (Stats' own, `_statsPeriod`, which the board's
   widgets read through wdgPeriod('stats')), Customise and More. The three tabs it replaced (By client, Cost, Trends) each went to a
   widget or a table (§10's table): an old address lands where its cards went (nav.js NAV_REDIRECTS). */
var STATS_TABLES = [['client', 'By client'], ['part', 'By part'], ['month', 'By month'], ['cost', 'Cost']];
var STATS_TABLE_KEY = 'sep_inv_stats_table';
/* Each table's sort this session, {col, dir}: a head tapped sorts by it, tapped again the other way. Its default is the table's
   own order (By client worst priced first, By part the largest first, By month in the calendar's). */
var _statsSort = {};
var STATS_SORT_DEFAULT = { client: { col: 'vsFull', dir: 'asc' }, part: { col: 'amount', dir: 'desc' }, month: { col: 'month', dir: 'asc' } };
function statsTable() {
  var t = null, old = null;
  try { t = localStorage.getItem(STATS_TABLE_KEY); old = localStorage.getItem(STATS_TAB_KEY); } catch (e) { /* per-device convenience only */ }
  if (STATS_TABLES.some(function(x) { return x[0] === t; })) return t;
  // A tab remembered from before U3 names its table (cost: the Tables' Cost), read and never written here.
  var to = typeof STATS_TAB_OLD !== 'undefined' ? STATS_TAB_OLD[old] : null;
  return to && to[1] ? to[1] : 'client';
}
function statsSetTable(t) {
  if (!STATS_TABLES.some(function(x) { return x[0] === t; })) t = 'client';
  try { localStorage.setItem(STATS_TABLE_KEY, t); } catch (e) { /* per-device convenience only */ }
}
function statsTableName(t) { var x = STATS_TABLES.filter(function(y) { return y[0] === t; })[0]; return x ? x[1] : ''; }

function renderStats() {
  var toolbar = document.getElementById('statsToolbar');
  var area = document.getElementById('statsContent');
  if (!area) return;
  if (typeof grdHeld === 'function' && grdHeld()) return;
  var view = statsTab();
  var pa = typeof wcPulseArgs === 'function' ? wcPulseArgs(_statsPeriod) : statsPulseArgs(_statsPeriod);
  var verdict = '';
  try { verdict = statsVerdictHtml(pa); } catch (e) { verdict = ''; if (typeof errReport === 'function') errReport(e, 'render: Stats verdict'); }
  if (toolbar) {
    toolbar.innerHTML = statsTabsHtml() + verdict + statsToolbarHtml(view) + (view === 'tables' ? statsTableSwitchHtml() : '');
    // The open view is scrolled into view sideways only, as Staff's: never cut off at a phone's edge.
    viewTabReveal(toolbar.querySelector('.inv-viewtabs'));
  }
  if (view === 'board') {
    // The board takes the page's width: no panel grid round it (the board lays out its own columns, widgets.js).
    area.className = '';
    var n = wdgAddable('stats'), arranging = wdgArrangeOn('stats');
    area.innerHTML = '<div id="statsBoard"></div>' + (n && !arranging ? '<div class="inv-wboard-foot" data-stats-foot>' +
      '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invStatsTables">' + iconSvg('report') + (_isDesktop ? 'The tables behind these' : 'The tables') + '</button>' +
      '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invWdgGallery" data-board="stats">' + iconSvg('plus') + 'Add a widget · ' + n + (_isDesktop ? ' to choose from' : '') + '</button></div>' : '');
    wdgBoardDraw(document.getElementById('statsBoard'), 'stats');
    return;
  }
  wdgLiveStop('stats');
  area.className = 'inv-panels inv-panels-dense';
  var t = statsTable(), html = '';
  try { html = statsTableViewHtml(t, pa); } catch (e) { html = ''; if (typeof errReport === 'function') errReport(e, 'render: Stats table ' + t); }
  area.innerHTML = html || '<div class="inv-panel inv-panels-wide">' + uiBlankHtml({ kind: 'empty', title: 'Nothing in this period yet',
    body: 'Invoices and challans fill these tables.' }) + '</div>';
}
/* Leaving Stats ends arranging, and the board is drawn plain when it is next shown (as Home's, today.js homeLeave). */
function statsLeave() {
  wdgLiveStop('stats');
  if (wdgArrangeOn('stats')) wdgArrangeDone(true);
}

/* One toolbar row (§3e): the period, Customise on the Dashboard, and More (Make a report, the exports, Reset). Arranging, the row is
   Add a widget, Reset and Done, the one primary, as Home's. On the phone Customise and More are icons, so the row stays one. */
function statsToolbarHtml(view) {
  if (view === 'board' && wdgArrangeOn('stats')) {
    return '<div class="inv-toolbar" data-stats-toolbar data-arranging>' +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invWdgGallery" data-board="stats">' + iconSvg('plus') + '<span>Add a widget</span></button>' +
      '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invWdgReset" data-board="stats">Reset</button>' +
      '<button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invWdgDone" data-board="stats">Done</button></div>';
  }
  var phone = !_isDesktop, money = typeof grdSeesMoney !== 'function' || grdSeesMoney();
  var reports = typeof grdSees !== 'function' || grdSees('pageReports');
  var more = [reports && money ? { label: 'Make a report', action: 'invRptFromStats' } : null,
    view === 'tables' && statsTable() !== 'cost' ? { label: 'Export this table (CSV)', action: 'invStatsExportCsv' } : null,
    view === 'tables' && statsTable() === 'cost' ? { label: 'Export the cost (CSV)', action: 'invStatsExportCsv' } : null,
    { label: 'Export the tables (Excel)', action: 'invStatsExportXlsx' },
    view === 'board' ? { label: 'Reset Stats', action: 'invWdgReset', attrs: ' data-board="stats"' } : null];
  var custom = view !== 'board' ? '' : phone
    ? '<button class="inv-btn inv-btn-ghost inv-btn-icon" data-action="invWdgArrange" data-board="stats" aria-label="Customise Stats" title="Customise Stats">' + iconSvg('widgets') + '</button>'
    : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invWdgArrange" data-board="stats" aria-label="Customise Stats">' + iconSvg('widgets') + '<span>Customise</span></button>';
  return '<div class="inv-toolbar' + (phone ? ' inv-toolbar-tight' : '') + '" data-stats-toolbar>' +
    statsSeg('invStatsPeriod', 'period', { mtd: 'MTD', qtd: 'QTD', ytd: 'YTD', all: 'All' }, _statsPeriod, 'Period') + custom +
    uiToolbarMoreHtml(more, { icon: phone, ghost: phone }) + '</div>';
}
/* The Tables' switch, under the toolbar (Attendance's Day · Week · Month sit the same way). */
function statsTableSwitchHtml() {
  var cur = statsTable();
  return '<div class="inv-seg inv-mb-8" role="group" aria-label="Table" data-stats-table>' + STATS_TABLES.map(function(x) {
    return '<button type="button" class="inv-seg-btn" data-action="invStatsTable" data-table="' + x[0] + '" aria-pressed="' + (cur === x[0]) + '">' + x[1] + '</button>';
  }).join('') + '</div>';
}

/* The verdict leading both views (§10; design §6.28): the period's price against its live cost, in the one judge's tone (TM6a:
   under it within 5% a warning); four factors: revenue net of credit notes and its change on the same days, what was plated and
   billed with the share weighed and of two shifts, realisation against the cost, and what the period left after the full cost.
   The large accounts below the full cost are a fact of it (By client's verdict, until U3). */
/* What a period left after its full cost: its whole revenue less its whole cost (the live cost a kilo × the kilos weighed), the one
   figure Stats' verdict, The period in figures, the money question and the report draw (Iuno H-2, the QA chain of 6 Nov 2026: the
   question and the report had drawn contribution × the weighed kilos, which left the unweighed lines' revenue out, and a month read
   positive on one and negative a tap away). Its tone is its own: the revenue against the whole cost, the one judge at 5%.
   At the live cost the cost a kilo is the plant's whole cost over the weighed kilos, so the cost × those kilos is the whole cost and
   the figure is exact. At the typed cost (no live cost to read) the cost × the weighed kilos misses the unweighed lines' kilos, so
   where lines have no weight the figure is the most the period can have left (≤, design §6.27; Iuno L-5, Cipher's Edict V): a loss
   is a loss at least that large and keeps its tone, a figure at or over zero is not judged. `cov` is passed only at the typed cost. */
function statsPeriodLeft(rev, costKg, kg) { return gstRound((rev || 0) - costKg * kg); }
function statsLeftPart(cov) { return cov != null && cov < 0.999; }
function statsLeftTone(rev, costKg, kg, cov) {
  if (statsLeftPart(cov) && (rev || 0) - costKg * kg >= 0) return null;
  return figToneAgainst(rev || 0, costKg * kg, 5);
}
function statsLeftSign(cov) { return statsLeftPart(cov) ? '\u2264 ' : ''; }
function statsVerdictHtml(pa) {
  var per = _statsPeriod, plabel = PERIOD_LABELS[per] || '', word = ADV_PERIOD_WORDS[per] || 'the period';
  var tonnage = pa.tonnage, filtered = pa.filtered, prior = pa.prior, perKg = '<span class="inv-tile-of">/kg</span>';
  var r = statsRangeIso(per);
  var totalRev = sumTaxable(filtered), priorRev = sumTaxable(prior), priorT = weighLines(prior);
  var totalGrand = filtered.reduce(function(s, i) { return s + (i.grandTotal || 0); }, 0);
  var comparable = per !== 'all' && prior.length > 0, vs = PERIOD_PRIOR_LABELS[per] || '';
  var costKg = pa.periodCost.perKg;
  var realisation = tonnage.kg > 0 ? tonnage.revKnown / tonnage.kg : null;
  var contribution = realisation != null && costKg > 0 ? realisation - costKg : null;
  // What the period left after its full cost is its whole revenue less its whole cost (Iuno H-1): read as contribution × the
  // weighed kilos it left out every unweighed line's revenue against the plant's whole cost.
  var margin = contribution != null ? statsPeriodLeft(totalRev, costKg, tonnage.kg) : null;
  var leftCov = pa.periodCost.label === 'live cost ' ? null : tonnage.coverage, leftPart = statsLeftPart(leftCov);
  var pct = function(cur, prev) { if (!comparable || prev == null || !prev) return ''; var x = (cur - prev) / Math.abs(prev) * 100; return Math.abs(x) <= FIG_FLAT_PCT ? 'level' : (x > 0 ? '+' : '−') + formatNum(Math.abs(x), 1) + '%'; };
  var dRev = pct(totalRev, priorRev), dKg = pct(tonnage.kg, priorT.kg);
  var credited = filtered.reduce(function(s, i) { return s + (i._credit || 0); }, 0), cnOut = cnCreditByInvoice().unplaced;
  var realTone = costKg > 0 && realisation != null ? figToneAgainst(realisation, costKg, 5) : null;
  // What was plated and billed is a floor where lines have no weight (≥, design §6.27), and its share of two shifts is said only from
  // 90% weighed, in its capacity tone (Vulcanus M-1).
  var part = tonnage.lines > 0 && tonnage.coverage < 0.999, ge = part ? '\u2265 ' : '';
  var cap = statsCapacityKg(r.from, r.to), capPct = cap > 0 && tonnage.kg > 0 && !(tonnage.coverage < REALISATION_MIN_COVERAGE) ? Math.round(tonnage.kg / cap * 100) : null;
  // The large accounts (10% of the tonnes or more) under the full cost, as By client's verdict counted them.
  var m = null;
  try { m = typeof wdgMemo === 'function' ? wdgMemo('margins:' + per, function() { return statsClientMargins(per, filtered, tonnage); }) : statsClientMargins(per, filtered, tonnage); } catch (e) { m = null; }
  var large = m ? m.ranked.filter(function(x) { return x.kg >= m.kg * 0.1; }) : [];
  var belowFull = large.filter(function(x) { return x.vsFull < 0; }), belowVar = large.filter(function(x) { return x.vsVar < 0; });
  var lines = [];
  // What the old callouts said, a line each: the lines left out of the weights and what they are worth, and how high the live cost
  // per kg reads for it (statsCostWeighedShort). Why the unweighed end is the low-priced end is the guide's.
  if (tonnage.lines > 0 && tonnage.coverage < 0.999) {
    var missing = tonnage.lines - tonnage.known;
    lines.push('<div class="inv-note" data-callout="coverage">' + escHtml(statsPctOf(tonnage.coverage) + '% of revenue weighed: ' + missing + ' line' + (missing === 1 ? '' : 's') + ' worth ' +
      formatCurrency(tonnage.revUnknown) + (missing === 1 ? ' has' : ' have') + ' no weight, so realisation reads high.') + '</div>');
    var weighedLine = pa.periodCost.label === 'live cost ' ? statsCostWeighedShort(tonnage) : '';
    if (weighedLine) lines.push('<div class="inv-note" data-callout="weighed">' + escHtml(weighedLine) + '</div>');
  }
  if (contribution != null && contribution < 0) lines.push('<div class="inv-note" data-callout="below-cost">' + escHtml(formatCurrency(Math.abs(contribution)) + '/kg below full cost' +
    (margin < 0 ? ': ' + (leftPart ? 'at least ' : '') + formatCurrency(Math.abs(margin)) + ' of loss for the period.' : ' on the weighed lines.')) + '</div>');
  if (credited > 0.005 || cnOut.n) lines.push('<div class="inv-note" data-callout="credit-notes">' + escHtml('Net of credit notes' + (credited > 0.005 ? ': ' + formatCurrency(gstRound(credited)) + ' taken off' : '') +
    (cnOut.n ? '; ' + todoPlural(cnOut.n, 'note') + ' (' + formatCurrency(gstRound(cnOut.amount)) + ') name no invoice in the book' : '') + '.') + '</div>');
  var factors = [
    { label: 'Revenue', fig: figWrapHtml(escHtml(formatCurrency(totalRev))), tone: comparable ? figDeltaTone(totalRev, priorRev, 'up') : null,
      sub: comparable ? (dRev === 'level' ? 'level with ' : dRev + ' on ') + vs : todoPlural(filtered.length, 'invoice') + ' · ' + formatCurrency(totalGrand) + ' incl. GST',
      badge: credited > 0.005 || cnOut.n ? [cnOut.n ? 'warning' : 'info', 'net of notes'] : null, attrs: ' data-tile="revenue"' },
    { label: 'Plated and billed', fig: ge + formatNum(tonnage.kg / 1000, 2) + ' t', tone: comparable ? figDeltaTone(tonnage.kg, priorT.kg, 'up') : capPct != null ? figToneCapacity(capPct) : null,
      sub: comparable && dKg ? (dKg === 'level' ? 'level' : dKg + ' on ' + vs) : formatNum(tonnage.kg, 0) + ' kg',
      // The plant's share of two shifts a line of its own in its capacity tone, never run on after the change (it wrapped mid-phrase).
      delta: capPct != null ? figHtml(capPct + '% of two shifts', figToneCapacity(capPct)) : '',
      badge: tonnage.lines > 0 && tonnage.coverage < 0.999 ? ['warning', statsPctOf(tonnage.coverage) + '% weighed'] : null, attrs: ' data-tile="tonnage"' },
    { label: 'Realisation', fig: realisation != null ? escHtml(formatCurrency(realisation)) + perKg : '', tone: realTone,
      sub: costKg > 0 ? pa.periodCost.label + formatCurrency(costKg) + '/kg' : 'set a cost in Settings',
      badge: contribution != null && contribution < 0 ? [realTone, 'below cost'] : null, attrs: ' data-tile="realisation"' },
    // What the period left is its own figure, toned by its own sign (Iuno H-2, the QA chain of 6 Nov 2026: a positive figure had
    // been drawn amber and badged below cost, the price's tone); the weighed lines' price is Realisation's and the sub's.
    { label: 'Left after the full cost', fig: margin != null ? statsLeftSign(leftCov) + statsMoney(margin) : '', tone: margin == null ? null : statsLeftTone(totalRev, costKg, tonnage.kg, leftCov),
      badge: margin != null && leftPart ? ['warning', statsPctOf(tonnage.coverage) + '% weighed'] : null,
      sub: contribution != null ? (contribution >= 0 ? '+' : '−') + formatCurrency(Math.abs(contribution)) + '/kg on the weighed lines' : 'needs tonnage and cost',
      attrs: ' data-tile="margin"' }];
  var verdict = !filtered.length ? 'No invoices ' + word
    : contribution == null ? formatInrShort(totalRev) + ' ' + word + (realisation == null ? ', nothing weighed' : ', no cost to judge by')
    : Math.abs(contribution) < 0.005 ? 'At the ' + (pa.periodCost.label === 'live cost ' ? 'live cost' : 'cost') + ', to the paisa'
    : formatCurrency(Math.abs(contribution)) + ' a kilo ' + (contribution > 0 ? 'over' : 'under') + ' the ' + (pa.periodCost.label === 'live cost ' ? 'live cost' : 'cost');
  var facts = filtered.length ? [todoPlural(filtered.length, 'invoice') + ' · ' + formatInrShort(totalRev) + (credited > 0.005 ? ' net of notes' : ''),
    m ? (belowVar.length ? { text: todoPlural(belowVar.length, 'large account') + ' below the variable cost', tone: 'danger' }
      : belowFull.length ? { text: todoPlural(belowFull.length, 'large account') + ' below the full cost', tone: figToneAgainst(belowFull[0].net, m.fullKg, 5) || 'warning' }
      : large.length ? { text: 'no large account below the cost', tone: 'ok' } : '') : '',
    pa.periodCost.measuredShare != null ? 'the cost ' + Math.round(pa.periodCost.measuredShare * 100) + '% measured' : ''].filter(Boolean) : [];
  return uiVerdictHtml({ screen: 'Stats · ' + plabel, tone: !filtered.length || realTone == null ? 'neutral' : realTone, verdict: verdict,
    fig: contribution != null ? figHtml(statsSigned(contribution) + perKg, realTone) : '',
    facts: facts, factors: factors, body: lines.length ? '<div class="inv-hero-sheet">' + lines.join('') + '</div>' : '', attrs: ' id="statsVerdict"' });
}

/* ---------- The tables (§10): a model each, which draws the table and fills its export ----------
   A model: {key, title, note, cols: [{k, label, num, xl ('money' | 'int' | 'num' | 'pct' | 'text' | 'date'), dp}], rows: [{v: {k: value},
   h: {k: html}, attrs}], after}. A row sorts on its values, nulls last whichever way; a cell draws its html where it has one, else its
   value as its column writes it. The CSV and the workbook read the same values, so what is exported is what is on screen. */
function statsCellText(c, v) {
  if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return '';
  var sign = c.signed && typeof v === 'number' ? (v > 0 ? '+' : v < 0 ? '\u2212' : '') : '', a = sign ? Math.abs(v) : v;
  if (c.xl === 'money') return sign + formatCurrency(a);
  if (c.xl === 'pct') return formatNum(v, 0) + '%';
  if (c.xl === 'int') return formatNum(v, 0);
  if (c.xl === 'num') return sign + formatNum(a, c.dp != null ? c.dp : 2);
  if (c.xl === 'date') return formatDate(v);
  return String(v);
}
function statsSorted(model) {
  var s = _statsSort[model.key] || STATS_SORT_DEFAULT[model.key] || null;
  if (!s || !model.cols.some(function(c) { return c.k === s.col; })) return { rows: model.rows, s: null };
  var dir = s.dir === 'desc' ? -1 : 1;
  var rows = model.rows.slice().sort(function(a, b) {
    var key = s.col === 'month' && a.v._sort != null ? '_sort' : s.col;
    var x = a.v[key], y = b.v[key], xn = x == null || x === '', yn = y == null || y === '';
    if (xn || yn) return xn && yn ? 0 : xn ? 1 : -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return String(x).localeCompare(String(y)) * dir;
  });
  return { rows: rows, s: s };
}
function statsTableHtml(model) {
  var srt = statsSorted(model), s = srt.s;
  var cols = model.cols;
  var head = '<tr>' + cols.map(function(c) {
    var on = s && s.col === c.k;
    return '<th class="' + (c.num ? 'inv-num' : '') + '"' + (on ? ' aria-sort="' + (s.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '>' +
      '<button class="inv-table-sort" data-action="invStatsSort" data-table="' + escHtml(model.key) + '" data-col="' + escHtml(c.k) + '">' + escHtml(c.label) +
      (on ? '<span aria-hidden="true">' + (s.dir === 'asc' ? ' ▲' : ' ▼') + '</span>' : '') + '</button></th>';
  }).join('') + '</tr>';
  var rows = srt.rows.map(function(r) {
    return '<tr' + (r.attrs || '') + '>' + cols.map(function(c) {
      var v = r.v[c.k], h = r.h && r.h[c.k] != null ? r.h[c.k] : escHtml(statsCellText(c, v)) || '&mdash;';
      // Each cell names its column (data-col), so a reader never counts across a column added later.
      return (c.signed && typeof v === 'number' ? statsSignedCell(v, h) : '<td' + (c.num ? ' class="inv-num"' : '') + '>' + h + '</td>').replace(/^<td/, '<td data-col="' + escHtml(c.k) + '"');
    }).join('') + '</tr>';
  });
  return '<div class="inv-scroll-x"><table class="inv-table" data-stats-tbl="' + escHtml(model.key) + '"><thead>' + head + '</thead><tbody>' +
    uiMoreHtml('stats-tbl-' + model.key, rows, { n: UI_MORE_ROWS, noun: model.noun || 'rows', tr: cols.length }) + '</tbody></table></div>';
}
function statsTableViewHtml(t, pa) {
  if (t === 'cost') {
    /* Labour, then the live cost: every component with its source (cost.js), as Stats → Cost drew them before U3. On All the labour card's
       range is the attendance record's own span (labour.js), so its ₹/kg divides by the tonnage billed inside that span. */
    var labRange = _statsPeriod === 'all' ? labourRangeForPeriod('all') : null;
    // The labour card is wages: drawn for an ID that sees them, as People draws it (Castor H-1); the live cost's labour row is money.
    if (typeof grdSeesWages === 'function' && !grdSeesWages()) return '<div class="inv-panel inv-panels-wide" data-card="labour-hidden">' +
      uiBlankHtml({ kind: 'empty', small: true, title: 'Labour is shown to an ID that sees wages' }) + '</div>' + renderLiveCostCard(_statsPeriod, pa.tonnage);
    return renderLabourStatsCard(_statsPeriod, labRange
      ? weighLines(pa.filtered.filter(function(i) { return i.date >= labRange.from && i.date <= labRange.to; })) : pa.tonnage) +
      renderLiveCostCard(_statsPeriod, pa.tonnage);
  }
  var model = statsTableModel(t, pa);
  if (!model) return '';
  return statsPanel('table-' + t, escHtml(model.title), model.note || '', { wide: true, id: 'statsTable' }) +
    (model.rows.length ? statsTableHtml(model) : uiBlankHtml({ kind: 'empty', title: model.empty || 'Nothing in this period',
      // An empty period's by client or by part says what fills it, and opens the way there.
      action: t === 'client' || t === 'part' ? '<button type="button" class="inv-btn inv-btn-tint" data-action="invCreateNew">Create an invoice</button>' : '' })) + (model.after || '') + '</div>';
}
function statsTableModel(t, pa) {
  if (t === 'client') return statsClientTable(pa);
  if (t === 'part') return statsPartTable(pa);
  if (t === 'month') return statsMonthTable();
  if (t === 'cost') return statsCostTable(pa);
  return null;
}
/* By client: every client of the period, its revenue and share, its tonnes and share, its price a kilo (n/a under 90% weighed, the
   rule realisation keeps), against the variable and the full cost and what that comes to on the period, and when its next challan is
   due by its own rhythm. Owed and days to pay under its name where there is a statement. The worst large account is settled under
   the table as before. Worst priced first. */
function statsClientTable(pa) {
  var per = _statsPeriod, filtered = pa.filtered, tonnage = pa.tonnage;
  var ranked = buildClientRollup(filtered), totalRev = sumTaxable(filtered);
  var m = typeof wdgMemo === 'function' ? wdgMemo('margins:' + per, function() { return statsClientMargins(per, filtered, tonnage); }) : statsClientMargins(per, filtered, tonnage);
  var byId = {};
  if (m) m.ranked.concat(m.apart).forEach(function(x) { byId[String(x.id)] = x; });
  var money = {};
  if (finHasBank()) {
    var recv = finCtx().recv(), mh = bankPayHistory(recv);
    recv.forEach(function(r) { var d = bankDaysToPay(r.client.id, mh); money[String(r.client.id)] = { owed: r.owed, oldest: r.oldestDays, days: d && d.median != null ? Math.round(d.median) : null }; });
  }
  var next = {}, today = localDateStr();
  predCadence().forEach(function(c) { if (c.median != null && c.count >= 3 && insClientActive(c.id)) next[String(c.id)] = c; });
  var rows = ranked.map(function(x) {
    var id = String(x.clientId), mx = byId[id] || null, net = mx && mx.comparable ? mx.net : null, mo = money[id], nc = next[id];
    var pst = m && net != null ? statsPriceState(net, m.fullKg) : null;
    var nameH = '<div class="inv-row-title">' + escHtml(x.name) + '</div>' + (mx && mx.cn ? '<div class="inv-row-meta">net of ' + statsMoney(mx.cn) + ' credit notes</div>' : '') +
      (!x.comparable ? '<div class="inv-row-meta">weights on ' + Math.round(x.coverage * 100) + '% of revenue: not ranked</div>' : '') +
      (mo ? '<div class="inv-row-meta" data-client-owed>owes ' + figHtml(statsMoney(Math.max(0, mo.owed)), mo.owed > 0.005 ? finOwedTone(mo.oldest) : null) +
        (mo.days != null ? ' · pays in ' + figHtml(mo.days + ' d', figTonePaysIn(mo.days)) : '') + '</div>' : '');
    var nextH = !nc ? '&mdash;' : nc.quiet ? uiDot('danger', nc.late + ' d late · quiet') : nc.late ? uiDot('warning', nc.late + ' d late')
      : '<span class="inv-nowrap">' + (nc.next === today ? 'today' : escHtml(formatDate(nc.next))) + '</span>';
    // A client under 90% weighed: its tonnes are a floor (≥), sorted and exported with the unknowns, its share weighed said (Vulcanus H-3).
    return { v: { name: x.name, rev: gstRound(x.total), revShare: totalRev > 0 ? x.total / totalRev * 100 : null, t: x.kg > 0 && x.comparable ? x.kg / 1000 : null,
        weighed: x.coverage * 100,
        kgShare: tonnage.kg > 0 && x.comparable ? x.kg / tonnage.kg * 100 : null, net: net, vsVar: mx && net != null ? mx.vsVar : null,
        vsFull: mx && net != null ? mx.vsFull : null, money: mx && net != null ? mx.money : null, next: nc ? nc.next : null },
      // The price's chip under its figure (the table had run past 1280 with a column of its own).
      h: { name: nameH, net: net != null ? '<span class="inv-row-stack"><span data-fig>' + figHtml(formatNum(net, 2), m ? figToneAgainst(net, m.fullKg, 5) : null) + '</span>' + (pst ? statsPriceChip(pst) : '') + '</span>' : uiDot('neutral', 'n/a'),
        t: x.kg > 0 ? (x.comparable ? formatNum(x.kg / 1000, 2) : '<span title="' + escHtml('Weights on ' + statsPctOf(x.coverage) + '% of its revenue: at least this') + '">\u2265 ' + formatNum(x.kg / 1000, 2) + '</span>') : '&mdash;',
        weighed: escHtml(statsPctOf(x.coverage) + '%'), next: nextH, rev: escHtml(formatCurrency(x.total)) },
      attrs: ' data-action="invStatsClientDrill" data-client-id="' + escHtml(id) + '" data-client-row' + (net == null ? ' data-partial' : '') };
  });
  // A client with a rhythm and nothing billed in the period (one gone quiet) keeps its row for its next challan, after the rest.
  var billed = {};
  ranked.forEach(function(x) { billed[String(x.clientId)] = true; });
  Object.keys(next).forEach(function(id) {
    if (billed[id]) return;
    var nc = next[id];
    rows.push({ v: { name: nc.name, next: nc.next },
      h: { name: '<div class="inv-row-title">' + escHtml(nc.name) + '</div><div class="inv-row-meta">nothing billed in the period</div>',
        next: nc.quiet ? uiDot('danger', nc.late + ' d late · quiet') : nc.late ? uiDot('warning', nc.late + ' d late') : '<span class="inv-nowrap">' + (nc.next === today ? 'today' : escHtml(formatDate(nc.next))) + '</span>' },
      attrs: ' data-client-quiet' });
  });
  // The two costs the columns are read against, and how high the live cost per kg reads where lines have no weight
  // (statsCostWeighedShort); why labour is fixed, and that cost is spread per kilo, is the guide's.
  var weighed = statsCostWeighedShort(tonnage);
  var head = m ? statsBody(statsNote('Variable cost ' + statsMoney(m.varKg) + '/kg · full ' + statsMoney(m.fullKg) + '/kg' +
    ' <span class="inv-badge inv-badge-info" data-margin-split>labour fixed</span>') + (weighed ? statsNote(weighed) : '')) : '';
  // The revenue that cannot be priced, named: a client under 90% weighed is listed, not ranked, and its share of the plant is
  // unknown, not small.
  var partial = ranked.filter(function(r) { return !r.comparable; });
  if (partial.length) {
    var partialRev = partial.reduce(function(t, r) { return t + r.total; }, 0);
    head += statsCallout(partial.length + ' client' + (partial.length === 1 ? '' : 's') + ' cannot be priced per kg: ' + formatNum(totalRev > 0 ? partialRev / totalRev * 100 : 0, 0) +
      '% of revenue (' + formatCurrency(partialRev) + ') is on parts with no weight.', 'danger', 'unranked');
    if (ranked[0] && !ranked[0].comparable) head += statsCallout(escHtml(ranked[0].name) + ' is the largest account, and its parts have no weights: its share of the plant is unknown, not small.', '', 'plant-share');
  }
  return { key: 'client', noun: 'clients', title: (PERIOD_LABELS[per] || '') + ' by client', note: m ? 'worst priced first, at the live cost' : 'no weighed tonnage to price',
    empty: 'No invoices in this period',
    cols: [{ k: 'name', label: 'Client', xl: 'text' }, { k: 'rev', label: 'Revenue', num: true, xl: 'money' }, { k: 'revShare', label: 'Of revenue', num: true, xl: 'pct' },
      { k: 't', label: 't', num: true, xl: 'num' }, { k: 'weighed', label: 'Weighed', num: true, xl: 'pct' }, { k: 'kgShare', label: 'Of tonnes', num: true, xl: 'pct' }, { k: 'net', label: '₹/kg', num: true, xl: 'num' },
      { k: 'vsVar', label: 'vs var.', num: true, xl: 'num', signed: true }, { k: 'vsFull', label: 'vs full', num: true, xl: 'num', signed: true },
      { k: 'money', label: '₹ on period', num: true, xl: 'money', signed: true }, { k: 'next', label: 'Next challan', xl: 'date' }],
    rows: rows, after: head + (m ? statsWorstHtml(m) : '') };
}
/* A price against the cost as a chip (DR-8: the colour beside its word; owner, 5 Nov 2026: the tables' colour-coded chips were
   missing): under the cost by more than 5% Below cost, within it Just under cost, at or over it Covers cost; the one judge
   (figToneAgainst at 5%). {word, tone} for the export and the cell, null where there is no price or no cost. */
function statsPriceState(perKg, cost) {
  if (perKg == null || !(cost > 0)) return null;
  var tone = figToneAgainst(perKg, cost, 5);
  return tone === 'danger' ? { word: 'Below cost', tone: 'danger' } : tone === 'warning' ? { word: 'Just under cost', tone: 'warning' } : { word: 'Covers cost', tone: 'ok' };
}
function statsPriceChip(st) { return st ? '<span class="inv-badge inv-badge-' + st.tone + '" data-price-chip="' + st.tone + '">' + escHtml(st.word) + '</span>' : '&mdash;'; }
/* By part: every part of the period, one client's (a code two clients send is two rows, each saying so), what it billed, its kilos
   where known and its price a kilo; the parts with no weight are kept, their kilos a dash, so the table never reads better than the
   truth. The largest first. */
function statsPartTable(pa) {
  var top = buildTopItems(pa.filtered, 'value', Infinity), owners = top.total > 0 ? cpCodeOwners() : {};
  var rows = top.rows.map(function(r) {
    var label = statsPartLabel(r);
    var shared = Object.keys(owners[r.base] || {}).filter(function(c) { return String(c) !== String(r.clientId); });
    var known = r.kgKnown && r.kg > 0;
    // A part billed nothing (replating, ruled 24 Sep 2026) has no price to judge: a dash, never Below cost at ₹0 (Iuno L-1).
    var free = !(Math.abs(r.amount) > 0.005);
    var pst = free ? null : statsPriceState(r.perKg, pa.periodCost.perKg);
    return { v: { part: label, client: r.clientName || '', amount: gstRound(r.amount), kg: known ? r.kg : null, perKg: free ? null : r.perKg },
      // The other client named short, and how many more: a row's words stay under 120 characters (P195).
      h: { part: '<div class="inv-row-title">' + escHtml(label) + '</div>' + (shared.length ? '<div class="inv-row-meta">code also sent by ' + escHtml((function() {
          var cc = (S.clients || []).find(function(x) { return String(x.id) === String(shared[0]); }); return cc ? clientShortName(cc.name) : 'another client'; })() +
          (shared.length > 1 ? ' and ' + (shared.length - 1) + ' more' : '')) + ', counted apart</div>' : ''),
        // The client named short on screen, its whole name its title (the export keeps the whole name): a name ending in PRIVATE
        // LIMITED had stood four lines tall in the phone's column, a row of the table each.
        client: '<span title="' + escHtml(r.clientName || '') + '">' + escHtml(clientShortName(r.clientName || '')) + '</span>',
        perKg: r.perKg != null ? '<span class="inv-row-stack"><span data-fig>' + figHtml(formatNum(r.perKg, 2), pa.periodCost.perKg > 0 ? figToneAgainst(r.perKg, pa.periodCost.perKg, 5) : null) + '</span>' +
          (pst ? statsPriceChip(pst) : '') + '</span>' : '&mdash;' } };
  });
  var unknown = top.rows.filter(function(r) { return !(r.kgKnown && r.kg > 0); }).length;
  return { key: 'part', noun: 'parts', title: (PERIOD_LABELS[_statsPeriod] || '') + ' by part', note: 'one client’s part a row', empty: 'No part billed in this period',
    cols: [{ k: 'part', label: 'Part', xl: 'text' }, { k: 'client', label: 'Client', xl: 'text' }, { k: 'amount', label: 'Billed', num: true, xl: 'money' },
      { k: 'kg', label: 'kg', num: true, xl: 'int' }, { k: 'perKg', label: '₹/kg', num: true, xl: 'num' }],
    rows: rows, after: unknown ? statsBody(statsNote(unknown + ' of ' + top.total + ' part' + (top.total === 1 ? '' : 's') + ' with no known weight: their kilos and ₹/kg are a dash.')) : '' };
}
/* A part as a row names it: its number, its description where it says more, its gauge where neither says it (the gauge is priced,
   so two gauges of one clamp never read alike). By part and the Top parts widget. */
function statsPartLabel(r) {
  var label = r.part + (r.desc && r.desc !== r.part ? ' \u2014 ' + r.desc : '');
  if (r.gauge && rateKey(label).indexOf(rateKey(r.gauge)) < 0) label += ' (' + r.gauge + ')';
  return label;
}
/* By month: six months, each at its own live cost (statsMonthsData, the `months` and `pricecost` widgets' rows). */
function statsMonthTable() {
  var rows = statsMonthsData();
  if (!rows.some(function(r) { return r.kg > 0 || r.rev > 0; })) return { key: 'month', title: 'Six months', rows: [], cols: [], empty: 'No invoices in six months' };
  return { key: 'month', noun: 'months', title: 'Six months', note: 'each at its own live cost',
    cols: [{ k: 'month', label: 'Month', xl: 'text' }, { k: 'rev', label: 'Revenue', num: true, xl: 'money' }, { k: 't', label: 't', num: true, xl: 'num', dp: 1 },
      { k: 'real', label: '₹/kg', num: true, xl: 'num' }, { k: 'cost', label: 'Cost', num: true, xl: 'num' },
      { k: 'contrib', label: 'Contrib.', num: true, xl: 'num', signed: true },
      { k: 'labour', label: 'Labour', num: true, xl: 'num' }, { k: 'measured', label: 'Measured', num: true, xl: 'pct' }],
    rows: rows.map(function(r) {
      // A month billed with nothing weighed has no tonnes to say (a dash, never 0.0); a month part weighed reads as a floor.
      // A month under 90% weighed reads its price high: judged only from 90%, as By client judges a client (Vulcanus L-6, the QA
      // chain of 6 Nov 2026); below it the figure stands plain with what share is weighed.
      var thin = r.coverage != null && r.coverage < REALISATION_MIN_COVERAGE;
      var tNone = !(r.kg > 0) && r.rev > 0, pst = thin ? null : statsPriceState(r.real, r.cost);
      return { v: { month: r.label, rev: gstRound(r.rev), t: tNone ? null : r.kg / 1000, real: r.real, cost: r.cost, contrib: r.contrib, labour: r.labour != null && r.labCov >= 0.9 ? r.labour : null,
        measured: r.measured != null ? r.measured * 100 : null, _sort: r.month },
        h: { month: '<span class="inv-nowrap">' + escHtml(r.label) + '</span>',
          real: r.real != null ? '<span class="inv-row-stack"><span data-fig>' + figHtml(formatNum(r.real, 2), pst ? pst.tone : null) + '</span>' + (pst ? statsPriceChip(pst) : thin ? '<span class="inv-badge inv-badge-neutral" data-price-chip="thin">' + statsPctOf(r.coverage) + '% weighed</span>' : '') + '</span>' : '&mdash;', t: tNone ? '&mdash;' : (r.coverage != null && r.coverage < 0.999 ? '\u2265 ' : '') + formatNum(r.kg / 1000, 1),
          measured: r.measured != null ? escHtml(statsPctOf(r.measured) + '%') : '&mdash;' } };
    }),
    after: statsBody(statsNote('₹ per kg. Labour where 90% of the month is recorded or paid from the bank; measured is the cost from records.')) };
}
/* The cost, for the export: the live cost's parts as its card lists them (cost.js liveCost), each its ₹, ₹ a kilo, share and source. */
function statsCostTable(pa) {
  var r = statsRangeIso(_statsPeriod), c = liveCost(r.from, r.to, pa.tonnage.kg);
  return { key: 'cost', noun: 'parts', title: (PERIOD_LABELS[_statsPeriod] || '') + ' live cost',
    cols: [{ k: 'label', label: 'Part', xl: 'text' }, { k: 'amount', label: 'Amount', num: true, xl: 'money' }, { k: 'perKg', label: '₹/kg', num: true, xl: 'num' },
      { k: 'share', label: 'Share', num: true, xl: 'pct' }, { k: 'source', label: 'Source', xl: 'text' }],
    rows: c.rows.map(function(x) {
      return { v: { label: x.label, amount: x.amount, perKg: x.perKg, share: c.total > 0 ? x.amount / c.total * 100 : null, source: COST_SRC_LABEL[x.source] || x.source || '' } };
    }) };
}
/* Six months, each at its own live cost: Stats' By month, and the months and price-against-cost widgets. Read once a book. */
function statsMonthsData() {
  var work = function() {
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
      rows.push({ month: from.slice(0, 7), label: insMonthLabel(from) + (to === today ? ' to date' : ''), short: insMonthLabel(from), toDate: to === today, real: real, cost: c.perKg, kg: w.kg, coverage: w.lines ? w.coverage : null,
        rev: inv.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0),
        contrib: real != null && c.perKg != null ? real - c.perKg : null, labour: lab && w.kg > 0 ? lab.amount / w.kg : null, labCov: lab ? Math.max(lab.coverage || 0, lab.bankShare || 0) : 0, measured: c.measuredShare });
    }
    return rows;
  };
  return typeof wdgMemo === 'function' ? wdgMemo('stats-months6', work) : work();
}
/* The worst-placed large account, settled on the live cost with labour fixed (owner, 13 Oct 2026; §3c): what a kilo of it leaves,
   what it lacks of the full cost and where it would pay its share, as tiles; the working folded. Under By client's table. */
function statsWorstHtml(m) {
  var worst = m.ranked.filter(function(x) { return x.kg >= m.kg * 0.1; })[0];
  if (!worst || !(worst.vsFull < 0)) return '';
  var perKg = '<span class="inv-tile-of">/kg</span>', leaves = worst.vsVar >= 0, onVar = gstRound(worst.vsVar * worst.kg);
  return '<div id="statsWorst"><div class="inv-row-group"><span><strong>' + escHtml(worst.name) + '</strong>, settled on the live cost</span></div>' +
    // The tiles are coded in their tones (HR-9, design §3.3): a tile stating a judgement is a well of its tone; Pays its share at
    // states a figure and is drawn plain. Outside a hero they need their coded block (Pipeline's stages sit the same way).
    '<div class="inv-coded" data-worst-tiles>' + statsTiles(
      statsTile('contrib', leaves ? 'Contributes' : 'Below its variable cost', statsSigned(worst.vsVar) + perKg,
        statsTileSub(leaves ? statsMoney(onVar) + ' toward labour on the period' : statsSigned(onVar) + ' on the period'), leaves ? 'ok' : 'danger') +
      statsTile('full', 'Against the full cost', statsSigned(worst.vsFull) + perKg, statsTileSub(statsSigned(worst.money) + ' on the period'), 'danger') +
      statsTile('even', 'Pays its share at', statsMoney(m.fullKg) + perKg, statsTileSub('the full cost; ' + escHtml(formatCurrency(m.varKg)) + ' variable'))) + '</div>' +
    uiWorkingHtml('stats-worst', [
      { label: 'Its price', sub: 'realised on the period', value: formatCurrency(worst.net) + '/kg' },
      { label: 'Variable cost', sub: 'everything but labour', value: formatCurrency(m.varKg) + '/kg' },
      { label: 'Labour', sub: 'fixed, spread per kilo', value: formatCurrency(m.labKg) + '/kg' },
      { label: 'Full cost', value: formatCurrency(m.fullKg) + '/kg' },
      { label: 'Share of the plant’s tonnage', value: Math.round(worst.kg / m.kg * 100) + '%' },
      { label: 'Share of the revenue', value: (m.rev > 0 ? Math.round(worst.total / m.rev * 100) : 0) + '%' }]) +
    statsBody(statsNote((leaves ? 'Labour is fixed, so it contributes; it pays its share only at ' + formatCurrency(m.fullKg) + '/kg'
      : 'Below its variable cost: it loses money on every kilo even with labour fixed') + ', if its parts cost what the rest do.')) + '</div>';
}

/* The exports (§10): the table on show as CSV, every table as one workbook (xlsx.js), each from the model it is drawn from, in the
   order it is sorted on screen. Money is money. */
function statsExportName(ext, t) { return 'sep-stats-' + (t ? t + '-' : '') + (_statsPeriod || 'mtd') + '-' + localDateStr() + '.' + ext; }
function statsExportCsv() {
  var pa = typeof wcPulseArgs === 'function' ? wcPulseArgs(_statsPeriod) : statsPulseArgs(_statsPeriod), t = statsTable(), model = statsTableModel(t, pa);
  if (!model || !model.rows.length) { showToast('Nothing in this table to export', 'warning'); return; }
  var rows = [model.cols.map(function(c) { return c.label; })].concat(statsSorted(model).rows.map(function(r) {
    return model.cols.map(function(c) {
      var v = r.v[c.k];
      if (v == null || (typeof v === 'number' && !isFinite(v))) return '';
      return typeof v === 'number' ? (c.xl === 'money' ? gstRound(v).toFixed(2) : String(gstRound(v, c.xl === 'int' ? 0 : c.dp != null ? c.dp : 2))) : String(v);
    });
  }));
  downloadCSV(statsExportName('csv', t), rows);
  showToast(model.title + ' exported: ' + model.rows.length + ' rows');
}
function statsExportXlsx() {
  var pa = typeof wcPulseArgs === 'function' ? wcPulseArgs(_statsPeriod) : statsPulseArgs(_statsPeriod), sheets = [];
  STATS_TABLES.forEach(function(x) {
    var model = statsTableModel(x[0], pa);
    if (!model || !model.cols.length) return;
    var head = model.cols.map(function(c) { return { v: c.label, s: 'head' }; });
    var body = statsSorted(model).rows.map(function(r) {
      return model.cols.map(function(c) {
        var v = r.v[c.k];
        if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return null;
        if (c.xl === 'money') return { v: gstRound(v), s: 'money' };
        if (c.xl === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) return { v: String(v), s: 'date' };
        if (c.xl === 'int' && typeof v === 'number') return { v: gstRound(v, 0), s: 'int' };
        if (typeof v === 'number') return gstRound(v, c.dp != null ? c.dp : 2);
        return String(v);
      });
    });
    sheets.push({ name: x[1], cols: model.cols.map(function(c, i) { return i === 0 ? 34 : c.xl === 'text' ? 22 : 14; }), rows: [head].concat(body), freeze: 1, filter: body.length > 0 });
  });
  xlsxDownload(statsExportName('xlsx'), xlsxBuild(sheets));
  showToast('The tables exported: ' + sheets.length + ' sheets');
}
/* A head tapped: that column, then the other way. Drawn again where it stands. */
function statsSortBy(t, col) {
  var cur = _statsSort[t] || STATS_SORT_DEFAULT[t] || {};
  _statsSort[t] = { col: col, dir: cur.col === col ? (cur.dir === 'asc' ? 'desc' : 'asc') : (col === 'name' || col === 'part' || col === 'client' || col === 'month' ? 'asc' : 'desc') };
  keepScroll(renderStats);
}

/* How long an invoice takes from created to dispatched and to delivered, over the invoices given: Office → Pipeline draws it
   for the last 90 days (the tab map, TM2b; it was a card on Stats → Billing). '' with no invoice dispatched. */
function statsDispatchCycleHtml(invs, said) {
  var dispatchDays = [], deliveryDays = [], fullCycleDays = [];
  (invs || []).forEach(function(inv) {
    if (inv.createdAt && inv.dispatchedAt) dispatchDays.push((inv.dispatchedAt - inv.createdAt) / 86400000);
    if (inv.dispatchedAt && inv.deliveredAt) deliveryDays.push((inv.deliveredAt - inv.dispatchedAt) / 86400000);
    if (inv.createdAt && inv.deliveredAt) fullCycleDays.push((inv.deliveredAt - inv.createdAt) / 86400000);
  });
  var avg = function(arr) { return arr.length > 0 ? (arr.reduce(function(a, b) { return a + b; }, 0) / arr.length) : null; };
  var avgDispatch = avg(dispatchDays), avgDelivery = avg(deliveryDays), avgFull = avg(fullCycleDays);
  var cycleRow = function(label, v, n) {
    return v !== null ? statsRow(label, 'average of ' + n + ' invoice' + (n === 1 ? '' : 's'), statsNum(formatNum(v, 1) + statsUnit('days'))) : '';
  };
  if (avgDispatch === null && avgDelivery === null) return '';
  return statsPanel('dispatch', 'Dispatch cycle', said || '', { id: 'pipeDispatch' }) +
    cycleRow('Created to dispatched', avgDispatch, dispatchDays.length) +
    cycleRow('Dispatched to delivered', avgDelivery, deliveryDays.length) +
    cycleRow('Full cycle', avgFull, fullCycleDays.length) + '</div>';
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
  var recentHtml = recentInvs.length === 0 ? uiEmptyHtml('No invoices') : recentInvs.map(function(inv) {
    return statsRow('<span class="inv-id">' + escHtml(inv.displayNumber) + '</span>', escHtml(formatDate(inv.date)),
      '<span class="inv-row-stack">' + statsNum(formatCurrency(inv.grandTotal)) + getStateDotHtml(inv) + '</span>');
  }).join('');

  var pendingChallans = (S.incomingMaterial || []).filter(function(im) {
    if (im.clientId !== clientId) return false;
    return im.items.some(function(it) { return !it.invoiced; });
  });
  var challanHtml = pendingChallans.length === 0 ? uiEmptyHtml('No pending challans') : pendingChallans.map(function(im) {
    var pItems = im.items.filter(function(it) { return !it.invoiced; });
    var pAmt = pItems.reduce(function(s, it) { return s + imLineOpen(it).amount; }, 0);
    return statsRow(im.challanNo ? 'Ch. <span class="inv-id">' + escHtml(im.challanNo) + '</span>' : 'No number',
      escHtml(formatDate(im.challanDate)) + ' · ' + pItems.length + ' items', statsNum(formatCurrency(pAmt)));
  }).join('');

  var periodLabel = PERIOD_LABELS[_statsPeriod] || 'All';
  var flipIcon = iconSvg('flip');

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
  invoice: ICONS.file, challan: ICONS.box, state: ICONS.check, cancel: ICONS.cancel, void: ICONS.trash, dupe: ICONS.copy,
  shift: ICONS.users, extra: ICONS.clock, except: ICONS.warning
};
// A deleted attendance day is a deletion, as a deleted invoice is.
HISTORY_ICONS.attDelete = HISTORY_ICONS.void;
// Quotations (quote.js): issued, accepted or declined, a revision or a supersession, and a void.
HISTORY_ICONS.quote = HISTORY_ICONS.invoice;
HISTORY_ICONS.quoteRev = HISTORY_ICONS.except;
HISTORY_ICONS.quoteVoid = HISTORY_ICONS.void;
// A change from the change log: a pencil.
HISTORY_ICONS.chg = ICONS.pencil;

function historyIcon(kind) {
  var path = HISTORY_ICONS[kind] || HISTORY_ICONS.state;
  return iconPathSvg(path);
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
      ts: v.voidedAt, type: 'audit', kind: 'void', sourceId: null, jump: null, source: v.source || '',
      cc: 'voidedNumbers', cr: typeof chgRidOf === 'function' ? chgRidOf('voidedNumbers', v) : null,
      // The invoice removed in the same save is this act too (the tombstone keeps its number, not its id): one row, not two.
      foldRemoval: v.source !== 'reconciled' && label ? { coll: 'invoices', label: label } : null,
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
        .join(', ');
      var counts = present + ' present' + (half ? ', ' + half + ' half' : '') + (absent ? ', ' + absent + ' absent' : '') +
        (ot ? ', ' + formatNum(ot, 1) + ' h OT' : '');
      // The row is the day's count; where everybody stood is the day's own board, a tap away (the tab map, TM6e: seven areas
      // ran the row past two lines), and in the pane, the row's title, the search and the CSV.
      events.push({
        ts: ts, type: 'floor', kind: 'shift', sourceId: null, jump: 'day', day: iso, clock: 'floor',
        text: 'Attendance recorded: ' + counts,
        full: 'Attendance recorded: ' + counts + (where ? '. By area: ' + where : '')
      });
    }

    // The extra is the line the whole Areas card exists to check, so each entry
    // is its own row rather than a day total: a reader who wants to know what
    // was booked, where, needs the where.
    (rec.extra || []).forEach(function(x) {
      var hrs = Number(x.hours) || 0;
      // A block the app made for a hand's slot pick books nothing and is nobody's entry (staff.js, attSlotMade).
      if (x && x.slotMade) return;
      if (typeof extraIsBlock === 'function' && extraIsBlock(x)) {
        var covered = (x.areas || []).map(labelFor).join(' + ') || labelFor(x.area);
        var span = (x.from && x.to) ? x.from + '\u2013' + x.to : '';
        var crew = (x.crew || []).length;
        events.push({
          ts: ts, type: 'floor', kind: 'extra', sourceId: null, jump: 'day', day: iso, clock: 'floor',
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
          ts: ts, type: 'floor', kind: 'extra', sourceId: null, jump: 'day', day: iso, clock: 'floor',
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
      ts: x.at, type: 'audit', kind: 'attDelete', how: x.how || '', sourceId: null, jump: null, clock: 'recorded', cc: 'attendanceDeletes', cr: x.id,
      // A day read again from its rolls (relay.js) is logged the same way, and is not a day deleted.
      text: x.how === 'reread'
        ? 'Attendance day read again from its rolls \u2014 ' + formatDate(x.iso) + ' as it was' + what + ' kept in the log'
        // Marks typed by hand replaced by a roll (relay.js, relayHandLog): the marks as they were, in the log.
        : x.how === 'override'
        ? 'Marks typed by hand replaced by the roll \u2014 ' + formatDate(x.iso) + ', ' + x.marks + ' mark' + (x.marks === 1 ? '' : 's') + ' as typed kept in the log'
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
    // The row's words and its whole (a change's every field, a floor day's areas).
    events = events.filter(function(ev) { return ((ev.text || '') + '\n' + (ev.full || '')).toLowerCase().indexOf(needle) !== -1; });
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

var _historyOpen = null;   // the event open in the desktop's pane (History)
function renderHistory() {
  var toolbar = document.getElementById('historyToolbar');
  var area = document.getElementById('historyList');
  if (!area) return;
  var events = filteredHistoryEvents();

  // The tab map, TM6c and TM6f: the verdict card, then one toolbar row: the search, Filter (client, who, the kind, the range; inline
  // on the desktop with the range a dialog of its own, as Invoices'), and More holding the CSV. The filters applied are tokens under
  // it on the phone. Seven chips and two dates had filled half the phone's first screen.
  if (toolbar) {
    var clientIds = new Set();
    S.invoices.forEach(function(i) { clientIds.add(i.clientId); });
    (S.incomingMaterial || []).forEach(function(im) { clientIds.add(im.clientId); });
    var clientOpts = '';
    clientIds.forEach(function(cid) {
      var c = S.clients.find(function(x) { return x.id === cid; });
      if (c) clientOpts += '<option value="' + cid + '"' + (_historyClientFilter == cid ? ' selected' : '') + '>' + escHtml(c.name) + '</option>';
    });
    // Who made it (changelog.js): shown once anybody has an ID or the log names one.
    var whoOpts = typeof chgWhoOptions === 'function' ? chgWhoOptions() : [];
    if (_historyWho && !whoOpts.some(function(o) { return o[0] === _historyWho; })) _historyWho = '';
    var phone = !_isDesktop, rangeActive = !!(_historyDateFrom || _historyDateTo);
    var filters = '<select class="inv-select inv-toolbar-item" id="historyClientFilter" aria-label="Filter by client">' +
      '<option value="">All clients</option>' + clientOpts + '</select>' +
      (whoOpts.length ? '<select class="inv-select inv-toolbar-item" id="historyWho" aria-label="Filter by who made it">' +
        '<option value="">Everyone</option>' + whoOpts.map(function(o) {
          return '<option value="' + escHtml(o[0]) + '"' + (_historyWho === o[0] ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>';
        }).join('') + '</select>' : '') +
      // The kind of event, one of seven: a choice in a list (it was seven chips, three rows on the phone).
      '<select class="inv-select inv-toolbar-item" id="historyType" aria-label="Kind of event">' + HISTORY_TYPES.map(function(t) {
        return '<option value="' + t.key + '"' + (_historyType === t.key ? ' selected' : '') + '>' + (t.key === 'all' ? 'Every kind' : t.label) + '</option>';
      }).join('') + '</select>' +
      (phone ? historyRangeFieldsHtml()
        : '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invHistoryRange" aria-haspopup="dialog" data-history-range>' +
          (rangeActive ? 'Range: ' + escHtml(historyRangeWord()) : 'Range') + '</button>');
    var count = (_historyClientFilter ? 1 : 0) + (_historyWho ? 1 : 0) + (_historyType !== 'all' ? 1 : 0) + (rangeActive ? 1 : 0);
    var client = _historyClientFilter ? S.clients.find(function(c) { return String(c.id) === String(_historyClientFilter); }) : null;
    var who = _historyWho ? whoOpts.find(function(o) { return o[0] === _historyWho; }) : null;
    var kind = HISTORY_TYPES.find(function(t) { return t.key === _historyType; });
    toolbar.innerHTML = '<div id="historyVerdict">' + historyVerdictHtml(events, count > 0 || !!_historySearch) + '</div>' +
      '<div class="inv-toolbar" data-history-toolbar>' +
      '<label class="inv-search">' + ICON_SEARCH +
      '<input type="search" id="historySearch" value="' + escHtml(_historySearch) + '" placeholder="Search invoice or challan number" autocomplete="off" aria-label="Search the log"></label>' +
      uiFilterHtml({ key: 'history', count: count, controls: filters }) +
      uiToolbarMoreHtml([{ label: 'Export CSV', action: 'invHistoryExport' }], { icon: phone }) + '</div>' +
      uiTokensHtml([{ key: 'Client', value: client ? client.name : '', action: 'invHistoryFilterClear', attrs: ' data-clear="client"' },
        { key: 'Who', value: who ? who[1] : '', action: 'invHistoryFilterClear', attrs: ' data-clear="who"' },
        { key: 'Kind', value: _historyType !== 'all' && kind ? kind.label : '', action: 'invHistoryFilterClear', attrs: ' data-clear="kind"' },
        { key: 'Range', value: rangeActive ? historyRangeWord() : '', action: 'invHistoryFilterClear', attrs: ' data-clear="range"' }]);
  }


  // Under Changes, how many older entries the log let go of (changelog.js).
  var dropped = _historyType === 'change' && typeof chgDroppedText === 'function' ? chgDroppedText() : '';

  if (events.length === 0) {
    var filtered = _historyType !== 'all' || _historySearch || _historyClientFilter || _historyDateFrom || _historyDateTo || _historyWho;
    area.innerHTML = '<div class="inv-panel">' + uiEmptyHtml('' +
      (_historyType === 'change' && !_historySearch && !_historyClientFilter && !_historyDateFrom && !_historyDateTo && !_historyWho
        ? 'No changes logged yet: every save from now on is listed here, with who made it'
        : filtered ? 'No activity matches these filters' : 'No activity yet: invoices, challans and attendance appear here as they are recorded') +
      '') + (dropped ? '<div class="inv-panel-body inv-note" data-chg-dropped>' + escHtml(dropped) + '</div>' : '') + '</div>';
    return;
  }

  // No total of the amounts: the log holds invoices with their GST, challans before it (the same work the invoices
  // bill, counted twice), deleted invoices and floor days, and no one sum of those is a figure. Stats carries the money.
  var html = '<div class="inv-panel inv-panel-flush" data-card="history">' +
    '<div class="inv-panel-head"><span class="inv-panel-title">Activity log <span class="inv-panel-count">' + events.length + '</span></span></div>' +
    (dropped ? '<div class="inv-panel-body inv-note" data-chg-dropped>' + escHtml(dropped) + '</div>' : '');

  historyEvKeys(events);
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
    return ev.jump === 'challan' ? 'invHistoryJumpChallan' : ev.jump === 'invoice' ? 'invHistoryJumpInvoice' : historyDayJump(ev) ? 'invHistoryJumpDay' : '';
  }
  function amountHtml(ev) { return ev.amount ? '<span class="inv-num">' + formatCurrency(ev.amount) + '</span>' : ''; }
  // A change names its first fields on the row; every field is in its title (and in the CSV).
  function fullAttr(ev) { return ev.full && ev.full !== ev.text ? ' title="' + escHtml(ev.full) + '"' : ''; }

  if (_isDesktop) {
    // The desktop opens an event in the pane beside the list (UX overhaul 2, step 7): the event whole, and the invoice or
    // challan it names, read without leaving History. Every event opens, a void and a floor day included.
    html += '<table class="inv-table inv-table-history"><thead><tr><th>Time</th><th>Event</th><th>Kind</th><th class="inv-num">Amount</th></tr></thead><tbody>';
    days.forEach(function(d) {
      html += '<tr class="inv-table-group"><td colspan="4">' + escHtml(d) + ' · ' + dayCount[d] + '</td></tr>';
      byDay[d].forEach(function(ev) {
        var key = escHtml(historyEvKey(ev));
        html += '<tr data-ev="' + ev.kind + '" data-action="invHistoryOpen" data-key="' + key + '"' + (_historyOpen === historyEvKey(ev) ? ' aria-current="true"' : '') + '>' +
          '<td class="inv-id">' + escHtml(historyWhen(ev, 'time')) + '</td>' +
          // The event is a real button on a row that opens, so it opens from the keyboard.
          '<td' + fullAttr(ev) + '><button class="inv-btn-link" data-action="invHistoryOpen" data-key="' + key + '">' + escHtml(ev.text) + '</button></td>' +
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
          ? '<button class="inv-row inv-row-2 inv-row-top" data-ev="' + ev.kind + '" data-action="' + action + '" data-id="' + escHtml(ev.jump === 'day' ? ev.day : ev.sourceId) + '">' + inner + '</button>'
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
  if (_isDesktop) {
    var open = _historyOpen ? events.find(function(ev) { return historyEvKey(ev) === _historyOpen; }) : null;
    if (!open) _historyOpen = null;
    // What the back trail calls the step (navLabel): the event's time and its first words.
    _historyOpenLabel = open ? (historyWhen(open, 'all') + ' · ' + String(open.text || '').slice(0, 40)).trim() : '';
    html = '<div class="inv-pane-host' + (open ? ' inv-pane-open' : '') + '" id="historyHost" data-open="' + escHtml(_historyOpen || '') + '"><div class="inv-pane-list">' + html + '</div>' +
      '<div class="inv-pane" id="historyPane">' + (open ? historyPaneHtml(open) : '') + '</div></div>';
  }
  paneScrollKeep(function() { area.innerHTML = html; });
}

/* History's verdict (the tab map, TM6f): what the log shows today, and what was removed or cancelled in the week, in danger: a
   deletion is what an audit goes looking for. Over the events the filter shows. */
var HISTORY_REMOVALS = { void: 1, attDelete: 1, cancel: 1, quoteVoid: 1 };
/* The removals among events: an audit event of a removal (a day read again from its rolls, or a number accounted for, removes
   nothing), and a change the log records as removed, voided or cancelled (a credit note cancelled, an entry voided, a client
   removed: these have no event of their own), unless it is the same act as such an event, saved with it (an invoice deleted
   is its tombstone and the invoice removed; a day deleted takes its rolls). */
function historyRemovals(list) {
  var acts = list.filter(function(ev) { return HISTORY_REMOVALS[ev.kind]; });
  var audit = acts.filter(function(ev) { return !(ev.kind === 'attDelete' && (ev.how === 'reread' || ev.how === 'override')) && !(ev.kind === 'void' && ev.source === 'reconciled'); });
  var chg = list.filter(function(ev) {
    return ev.kind === 'chg' && /^(removed|voided|cancelled)$/.test(ev.act || '') && !acts.some(function(a) { return Math.abs((a.ts || 0) - (ev.ts || 0)) <= CHG_MATCH_MS; });
  });
  return audit.length + chg.length;
}
function historyVerdictHtml(events, filtered) {
  var today = localDateStr(), weekAgo = isoAddDays(today, -6);
  var dayOf = function(ev) { return ev.ts ? isoOf(new Date(ev.ts)) : ''; };
  var todayN = events.filter(function(ev) { return dayOf(ev) === today; }).length;
  var week = events.filter(function(ev) { var d = dayOf(ev); return d >= weekAgo && d <= today; });
  var removed = historyRemovals(week);
  if (!events.length) return uiVerdictHtml({ screen: 'History' + (filtered ? ' · filtered' : ''), tone: 'neutral', verdict: filtered ? 'Nothing matches these filters' : 'Nothing recorded yet', key: 'pageHistory' });
  return uiVerdictHtml({ screen: 'History' + (filtered ? ' · filtered' : ''), tone: removed ? 'danger' : todayN ? 'ok' : 'neutral',
    verdict: todoPlural(todayN, 'event') + ' today' + (removed ? ' · ' + removed + ' removed or cancelled this week' : ''),
    facts: [todoPlural(week.length, 'event') + ' this week', removed ? { text: todoPlural(removed, 'removal') + ' to read', tone: 'danger' } : 'nothing removed this week'],
    key: 'pageHistory', attrs: ' data-history-removed="' + removed + '"' });
}
/* The range in use, in words: "1 Oct – 9 Oct". */
function historyRangeWord() {
  return (_historyDateFrom ? stockShortDate(_historyDateFrom) : 'the start') + ' – ' + (_historyDateTo ? stockShortDate(_historyDateTo) : 'today');
}
/* The range's two dates: in the phone's Filter; on the desktop in a dialog of its own, so the row stays one (Invoices' way). */
function historyRangeFieldsHtml() {
  return '<label class="inv-field inv-toolbar-item"><span class="inv-field-label">From</span>' +
    '<input type="date" class="inv-input" id="historyDateFrom" value="' + escHtml(_historyDateFrom) + '" aria-label="From date"></label>' +
    '<label class="inv-field inv-toolbar-item"><span class="inv-field-label">To</span>' +
    '<input type="date" class="inv-input" id="historyDateTo" value="' + escHtml(_historyDateTo) + '" aria-label="To date"></label>';
}
function historyRangeOpen() {
  var scrim = dialogOpen('<div class="inv-dialog" data-history-range-dialog>' + dialogHeadHtml('Range', 'invTbFilterDone') +
    '<div class="inv-dialog-body inv-toolbar" data-nodirty>' + historyRangeFieldsHtml() + '</div>' +
    '<div class="inv-dialog-foot"><button type="button" class="inv-btn inv-btn-primary" data-action="invTbFilterDone">Done</button></div></div>', { dismiss: true });
  if (scrim) scrim._onClose = UI_FILTER_DONE.history;
}
/* The Filter dialog or the range shut: the row and the list drawn again with the filters as they now stand. */
UI_FILTER_DONE.history = function() { renderHistory(); };
/* A filter's token tapped: that filter cleared. */
function historyFilterClear(which) {
  if (which === 'client') _historyClientFilter = '';
  else if (which === 'who') _historyWho = '';
  else if (which === 'kind') _historyType = 'all';
  else if (which === 'range') { _historyDateFrom = ''; _historyDateTo = ''; }
  _historyShowCount = UI_MORE_ROWS;
  renderHistory();
}

/* An event's key, its address in the desktop's pane: what it is, when, and the record it names — never its text where the
   text can move (a change names the user who made it, and a rename moved the key; a change's record id was dropped when the
   record went). Two events alike in all of that (two identical EXTRA rows on one day) are told apart by their order
   (historyEvKeys). The QA chain, 2 Oct 2026. */
var _historyOpenLabel = '';
function historyEvBase(ev) {
  return [ev.kind, ev.type || '', ev.ts || '', ev.logId || ev.sourceId || '', ev.cr || '', ev.kind === 'chg' ? '' : (ev.text || '')].join('|');
}
function historyEvKeys(events) {
  var seen = {};
  events.forEach(function(ev) {
    var b = historyEvBase(ev), n = seen[b] = (seen[b] || 0) + 1;
    ev._key = relayHash(b) + (n > 1 ? '-' + n : '');
  });
}
function historyEvKey(ev) { return ev._key || relayHash(historyEvBase(ev)); }
/* A floor day's row opens that day in People → Attendance, for a role that opens it (the tab map, TM6e). */
function historyDayJump(ev) { return ev.jump === 'day' && !!ev.day && (typeof grdSees !== 'function' || grdSees('pageStaff')); }
/* One event in the desktop's pane: the event whole (a change's every field), who and on which device, and the invoice or
   challan it names, drawn as the Invoices and Challans panes draw it, with the way there. */
function historyPaneHtml(ev) {
  // Each value is HTML: the kind is its dot and word, every other figure escaped here.
  var kv = [['Kind', historyKindHtml(ev)], ['When', escHtml(historyWhen(ev, 'all'))]];
  if (ev.amount) kv.push(['Amount', '<span class="inv-num">' + escHtml(formatCurrency(ev.amount)) + '</span>']);
  if (Object.prototype.hasOwnProperty.call(ev, 'by') && typeof chgUserName === 'function') kv.push(['Who', escHtml(ev.by == null ? 'No ID' : chgUserName(ev.by))]);
  var dev = ev.dev || ev.byDev;
  if (dev) kv.push(['Device', escHtml(typeof chgDeviceLabel === 'function' ? chgDeviceLabel(dev) : dev)]);
  var h = paneHeadHtml('<span class="inv-panel-title">Event</span>', 'invHistoryClose') +
    '<div class="inv-panel" data-history-pane="' + escHtml(ev.kind) + '"><div class="inv-history-full">' + escHtml(ev.full || ev.text) + '</div>' +
    '<div class="inv-kv inv-mt-4">' + kv.map(function(x) {
      return '<div><div class="inv-kv-k">' + escHtml(x[0]) + '</div><div>' + x[1] + '</div></div>';
    }).join('') + '</div></div>';
  if (ev.jump === 'invoice') {
    var inv = S.invoices.find(function(i) { return i.id === ev.sourceId; });
    if (inv) h += '<div class="inv-panel"><div class="inv-panel-head"><span class="inv-panel-title inv-id">' + escHtml(inv.displayNumber) + '</span>' +
      '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invHistoryJumpInvoice" data-id="' + escHtml(inv.id) + '">Open in Invoices</button></div>' + invoiceDetailHtml(inv) + '</div>';
  } else if (ev.jump === 'challan') {
    var im = (S.incomingMaterial || []).find(function(c) { return c.id === ev.sourceId; });
    if (im) h += '<div class="inv-panel"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(imChallanLabel(im)) + '</span>' +
      '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invHistoryJumpChallan" data-id="' + escHtml(im.id) + '">Open in Challans</button></div>' + challanDetailHtml(im) + '</div>';
  } else if (historyDayJump(ev)) {
    h += '<div class="inv-panel"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(formatDate(ev.day)) + '</span>' +
      '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invHistoryJumpDay" data-id="' + escHtml(ev.day) + '">Open the day</button></div></div>';
  } else if (ev.kind === 'void') h += '<div class="inv-note">' + (ev.source === 'reconciled'
    ? 'A number accounted for in the number audit: no invoice was ever recorded under it here.'
    : 'The invoice this number was is deleted; Invoices → Number audit holds its record.') + '</div>';
  return h;
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
