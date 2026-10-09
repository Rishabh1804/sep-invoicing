/* ===== REPORTS (Office → Reports, in its review) =====
   Owner, 1 Oct 2026: "I would also like to have a daily weekly and a monthly quarterly yearly report generator". A report
   is a document drawn from the data every time it is shown or printed, the Power case's contract (power.js): rptHtml()
   draws one A4 document, the page shows it, Print sends the same document to the one print view, and a save in this or
   another window draws it again. Nothing here is a second copy of any arithmetic: every figure is read off the function
   the screen it comes from reads (statsInvoices, weighLines, liveCost, labourForRange, payWeek, prodPlatedSummary,
   prodDayLine, powerAnalysis, stockStatus, bankClassify, finGstByMonth, finForecast, todoRanked).
   Each section says what it covers, and a section with nothing recorded says so in one line, never as a zero.

   The periods are the shop's own: a day; the PAY WEEK, Sunday to Saturday, numbered by its Saturday's ISO week (Staff);
   a month; a quarter of the financial year (Q1 = Apr–Jun); a financial year (Apr–Mar). The period not yet ended reads
   "to date", and every figure stops at today. Kind and period are kept per device (sep_inv_report). */

var RPT_KINDS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']];
var RPT_KEY = 'sep_inv_report';
var RPT_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var RPT_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var _rptState = null;   // {kind, from}: the period's first day

/* ---------- The period ---------- */
function rptKindOk(k) { return RPT_KINDS.some(function(x) { return x[0] === k; }); }
function rptIsoOk(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(new Date(s + 'T00:00:00')); }
/* The financial year a date falls in, by the year it starts: 2026-05-10 → 2026, 2027-02-01 → 2026. */
function rptFy(iso) { var y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)); return m >= 4 ? y : y - 1; }
function rptFyLabel(fy) { return 'FY ' + fy + '-' + String(fy + 1).slice(2); }
/* The period of a kind that holds a day: {kind, from, to}. */
function rptPeriodOf(kind, iso) {
  if (!rptKindOk(kind)) kind = 'monthly';
  if (!rptIsoOk(iso)) iso = localDateStr();
  if (kind === 'daily') return { kind: kind, from: iso, to: iso };
  if (kind === 'weekly') { var ws = attWeekStartOf(iso); return { kind: kind, from: ws, to: isoAddDays(ws, 6) }; }
  if (kind === 'monthly') { var ms = iso.slice(0, 8) + '01'; return { kind: kind, from: ms, to: payMonthEnd(ms) }; }
  var fy = rptFy(iso);
  if (kind === 'yearly') return { kind: kind, from: fy + '-04-01', to: (fy + 1) + '-03-31' };
  var q = rptQuarter(iso), sm = 4 + 3 * (q - 1), y = sm > 12 ? fy + 1 : fy, m = sm > 12 ? sm - 12 : sm;
  var qs = y + '-' + String(m).padStart(2, '0') + '-01';
  return { kind: kind, from: qs, to: payMonthEnd(isoAddDays(payMonthEnd(isoAddDays(payMonthEnd(qs), 1)), 1)) };
}
function rptQuarter(iso) { var m = Number(iso.slice(5, 7)); return Math.floor(((m - 4 + 12) % 12) / 3) + 1; }
/* The period before or after (n = -1 / +1). */
function rptStepPeriod(p, n) { return rptPeriodOf(p.kind, n < 0 ? isoAddDays(p.from, -1) : isoAddDays(p.to, 1)); }
function rptShort(iso) { return stockShortDate(iso); }
function rptLongDate(iso) {
  var d = new Date(iso + 'T00:00:00');
  return RPT_DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + RPT_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}
function rptSpan(from, to) {
  var y1 = from.slice(0, 4), y2 = to.slice(0, 4);
  return rptShort(from) + (y1 !== y2 ? ' ' + y1 : '') + ' – ' + rptShort(to) + ' ' + y2;
}
function rptMonthSpan(from, to) {
  return RPT_MONTHS[Number(from.slice(5, 7)) - 1].slice(0, 3) + (from.slice(0, 4) !== to.slice(0, 4) ? ' ' + from.slice(0, 4) : '') +
    ' – ' + RPT_MONTHS[Number(to.slice(5, 7)) - 1].slice(0, 3) + ' ' + to.slice(0, 4);
}
/* What the period is called: the document's title after the kind, and the short name a change line is read against. */
function rptPeriodName(p) {
  if (p.kind === 'daily') return rptLongDate(p.from);
  if (p.kind === 'weekly') return 'W' + attPayWeekNumber(p.from) + ' · ' + rptSpan(p.from, p.to);
  if (p.kind === 'monthly') return RPT_MONTHS[Number(p.from.slice(5, 7)) - 1] + ' ' + p.from.slice(0, 4);
  if (p.kind === 'quarterly') return 'Q' + rptQuarter(p.from) + ' ' + rptFyLabel(rptFy(p.from)) + ' · ' + rptMonthSpan(p.from, p.to);
  return rptFyLabel(rptFy(p.from));
}
function rptPeriodShort(p) {
  if (p.kind === 'daily') return RPT_DAYS[new Date(p.from + 'T00:00:00').getDay()].slice(0, 3) + ' ' + rptShort(p.from);
  if (p.kind === 'weekly') return 'W' + attPayWeekNumber(p.from);
  if (p.kind === 'monthly') return insMonthLabel(p.from) + ' ' + p.from.slice(0, 4);
  if (p.kind === 'quarterly') return 'Q' + rptQuarter(p.from) + ' ' + rptFyLabel(rptFy(p.from));
  return rptFyLabel(rptFy(p.from));
}
function rptKindLabel(k) { var x = RPT_KINDS.find(function(t) { return t[0] === k; }); return x ? x[1] : 'Monthly'; }
function rptTitle(p) {
  return rptKindLabel(p.kind) + ' report — ' + rptPeriodName(p) + (p.to >= localDateStr() && p.from <= localDateStr() ? ', to date' : '');
}

/* The period before, of the same length: for a period still running, the same number of days from its start (the
   month to date against the same days of the month before, Home's rule). A day is set against the working day before. */
function rptPrior(p, end) {
  if (p.kind === 'daily') {
    var d = isoAddDays(p.from, -1);
    if (new Date(d + 'T00:00:00').getDay() === 0) d = isoAddDays(d, -1);
    var pd = rptPeriodOf('daily', d);
    return { p: pd, from: d, to: d, label: rptPeriodShort(pd) };
  }
  var pp = rptStepPeriod(p, -1), to = pp.to, open = end < p.to;
  if (open) { var t = isoAddDays(pp.from, isoDaysBetween(p.from, end)); if (t < to) to = t; }
  return { p: pp, from: pp.from, to: to, label: (open ? 'same days of ' : '') + rptPeriodShort(pp) };
}

function rptLoad() {
  if (_rptState) return _rptState;
  var st = null;
  try { st = JSON.parse(localStorage.getItem(RPT_KEY) || 'null'); } catch (e) { st = null; }
  var kind = st && rptKindOk(st.kind) ? st.kind : 'monthly';
  var p = rptPeriodOf(kind, st && rptIsoOk(st.from) && st.from <= localDateStr() ? st.from : localDateStr());
  _rptState = { kind: p.kind, from: p.from };
  return _rptState;
}
function rptSet(kind, iso) {
  var p = rptPeriodOf(kind, iso);
  if (p.from > localDateStr()) p = rptPeriodOf(kind, localDateStr());   // a period not yet begun has nothing to report
  _rptState = { kind: p.kind, from: p.from };
  try { localStorage.setItem(RPT_KEY, JSON.stringify(_rptState)); } catch (e) { /* a per-device convenience only */ }
}
function rptCurrent() { var s = rptLoad(); return rptPeriodOf(s.kind, s.from); }

/* ---------- Readings (each one the app's own function, over a range) ---------- */
function rptMoney(n) { return escHtml(formatCurrency(n)); }
function rptInt(n) { return Math.round(n || 0).toLocaleString('en-IN'); }
function rptKg(n) { return n >= 10000 ? formatNum(n / 1000, 2) + ' t' : rptInt(n) + ' kg'; }
function rptPct(share) { return statsPctOf(share) + '%'; }

/* The challans received in a range (by challan date, else the day received: the trend's rule): kilograms off the KG
   lines, pieces off the NOS lines, as the challans say them. */
function rptReceived(from, to) {
  var out = { n: 0, kg: 0, nos: 0, list: [] };
  (S.incomingMaterial || []).forEach(function(im) {
    var d = im.challanDate || im.receivedDate;
    // A challan with no line received nothing (the seed's blocker record is one).
    if (!d || d < from || d > to || !(im.items || []).length) return;
    out.n++; out.list.push(im);
    (im.items || []).forEach(function(it) {
      var q = Number(it.qty) || 0;
      if (String(it.unit).toUpperCase() === 'NOS') out.nos += q; else out.kg += q;
    });
  });
  return out;
}
/* Attendance is Staff → Overview's, by its own function (dash.js attPresenceForRange): Monday to Saturday, a half day
   half, over the active roster's marks typed. Unmarked is not absent: a day nobody typed is a gap, never a day nobody
   came. */
function rptAttendance(from, to) { return attPresenceForRange(from, to); }
function rptCuts(a, from, to) { return a.cuts.filter(function(c) { return c.date >= from && c.date <= to; }); }
function rptCutSum(cuts) {
  return cuts.reduce(function(t, c) { t.n++; t.min += c.cost.inside || 0; t.cost += c.cost.total || 0; return t; }, { n: 0, min: 0, cost: 0 });
}
function rptBankRows(from, to) { return bankRows().filter(function(r) { return r.date >= from && r.date <= to; }); }

/* One row of the by-day / by-week / by-month table. */
function rptRowFigures(ctx, from, to) {
  if (from > ctx.today) return { future: true };
  var b = to > ctx.today ? ctx.today : to;
  var inv = ctx.invs.filter(function(i) { return i.date >= from && i.date <= b; }), w = weighLines(inv);
  var pl = prodPlatedSummary(from, b), att = rptAttendance(from, b), cuts = rptCuts(ctx.power, from, b);
  var rec = powerRecordedDays(from, b);
  return { inv: inv.length, taxable: sumTaxable(inv), kg: w.kg, revKnown: w.revKnown, real: w.kg > 0 ? w.revKnown / w.kg : null, rec: rptReceived(from, b),
    plated: pl, att: att, cuts: cuts.length, cutsKnown: cuts.length > 0 || rec.recorded > 0 };
}

/* ---------- The document's pieces ---------- */
function rptSec(n, title, cov, body) {
  return '<section class="inv-rpt-sec" data-rpt-sec="' + n + '"><h3 class="inv-rpt-h">' + title + '</h3>' +
    (cov ? '<p class="inv-rpt-cov">' + cov + '</p>' : '') + body + '</section>';
}
function rptNone(text) { return '<p class="inv-rpt-none">' + text + '</p>'; }
function rptP(text) { return '<p class="inv-rpt-p">' + text + '</p>'; }
/* head: [[label, numeric?]]; cells are html. */
function rptTable(head, rows, foot, key) {
  var td = function(v, i, tag) { return '<' + tag + (head[i] && head[i][1] ? ' class="inv-rpt-num"' : '') + '>' + (v == null || v === '' ? '&mdash;' : v) + '</' + tag + '>'; };
  return '<div class="inv-rpt-scroll"><table class="inv-rpt-table"' + (key ? ' data-rpt-table="' + key + '"' : '') + '><thead><tr>' +
    head.map(function(x, i) { return td(x[0], i, 'th'); }).join('') + '</tr></thead><tbody>' +
    rows.map(function(r) { return '<tr>' + r.map(function(v, i) { return td(v, i, 'td'); }).join('') + '</tr>'; }).join('') + '</tbody>' +
    (foot ? '<tfoot><tr>' + foot.map(function(v, i) { return td(v, i, 'td'); }).join('') + '</tr></tfoot>' : '') + '</table></div>';
}
function rptTile(key, label, value, sub, delta) {
  return '<div class="inv-rpt-tile" data-rpt-tile="' + key + '"><div class="inv-rpt-tile-l">' + label + '</div>' +
    '<div class="inv-rpt-tile-v">' + value + '</div>' + (sub ? '<div class="inv-rpt-tile-s">' + sub + '</div>' : '') +
    (delta ? '<div class="inv-rpt-tile-s">' + delta + '</div>' : '') + '</div>';
}
function rptDash(why) { return { v: '&mdash;', s: why }; }

/* ---------- The document ---------- */
function rptHtml(kind, from, to) {
  var p = rptPeriodOf(kind, from);
  if (to) p.to = to;
  var today = localDateStr(), end = p.to > today ? today : p.to, open = p.to >= today, current = p.from <= today && p.to >= today;
  // Who issued it is read from S.company and nowhere else (CLAUDE.md: never freeze a copy of the company's identity into a
  // document): a blank name prints none, rather than a name written into the build (QA5-14).
  var co = String((S.company && S.company.name) || '').trim();
  var title = rptTitle(p);
  var build = typeof APP_BUILD === 'string' ? APP_BUILD : 'dev';
  var h = '<div class="inv-rpt-doc" data-rpt-doc data-kind="' + p.kind + '" data-from="' + p.from + '" data-to="' + p.to + '">' +
    '<table class="inv-rpt-frame"><thead><tr><td class="inv-rpt-frame-head">' + escHtml([co, title].filter(Boolean).join(' · ')) + '</td></tr></thead>' +
    '<tfoot><tr><td class="inv-rpt-frame-foot"></td></tr></tfoot><tbody><tr><td class="inv-rpt-frame-body">' +
    '<div class="inv-rpt-head">' + (co ? '<div class="inv-rpt-co">' + escHtml(co) + '</div>' : '') + '<h2 class="inv-rpt-title">' + escHtml(title) + '</h2>' +
    '<div class="inv-rpt-meta">' + escHtml((p.from === p.to ? formatDate(p.from) : formatDate(p.from) + ' to ' + formatDate(p.to)) +
      (open ? ' · figures to ' + formatDate(end) : '')) + ' · generated ' + escHtml(formatDate(today)) + ' · build <span class="inv-rpt-id">' + escHtml(build) + '</span></div></div>';
  if (p.from > today) return h + rptNone('This period has not begun.') + '</td></tr></tbody></table></div>';

  var all = statsInvoices().filter(function(i) { return i.date; });
  var power = powerAnalysis();
  var ctx = { today: today, invs: all, power: power };
  var pr = rptPrior(p, end);
  var invs = all.filter(function(i) { return i.date >= p.from && i.date <= end; }), pinvs = all.filter(function(i) { return i.date >= pr.from && i.date <= pr.to; });
  var w = weighLines(invs), pw = weighLines(pinvs);
  var taxable = sumTaxable(invs), ptaxable = sumTaxable(pinvs);
  var credited = gstRound(invs.reduce(function(s, i) { return s + (i._credit || 0); }, 0));
  var lc = w.kg > 0 ? liveCost(p.from, end, w.kg) : null;
  var real = w.kg > 0 ? w.revKnown / w.kg : null, preal = pw.kg > 0 ? pw.revKnown / pw.kg : null;
  var rec = rptReceived(p.from, end), prec = rptReceived(pr.from, pr.to);
  var plated = prodPlatedSummary(p.from, end), pplated = prodPlatedSummary(pr.from, pr.to);
  var att = rptAttendance(p.from, end), patt = rptAttendance(pr.from, pr.to);
  var lab = labourForRange(p.from, end), plab = labourForRange(pr.from, pr.to);
  var labV = labourPerKgVerdict(lab, w.kg);
  var cuts = rptCuts(power, p.from, end), cs = rptCutSum(cuts), pcs = rptCutSum(rptCuts(power, pr.from, pr.to));
  var pRec = powerRecordedDays(p.from, end);
  var bank = finHasBank(), cover = bank ? bankCover() : null;
  var brows = bank ? rptBankRows(p.from, end) : [];
  var lbl = pr.label;
  var dl = function(cur, prev, better) { return prev != null && prev > 0 && cur != null ? figDeltaHtml(cur, prev, lbl, better) : ''; };
  var nothing = !invs.length && !rec.n && !plated && !att.days && !cuts.length && !brows.length && !(lab.total > 0);

  // 1. Headline tiles
  var tiles = [];
  tiles.push(taxable > 0.005 || invs.length
    ? rptTile('invoiced', 'Invoiced', rptMoney(taxable), invs.length + ' invoice' + (invs.length === 1 ? '' : 's') + ' · taxable, net of ' +
      (credited > 0.005 ? rptMoney(credited) + ' in credit notes' : 'credit notes'), dl(taxable, ptaxable, 'up'))
    : rptTile('invoiced', 'Invoiced', '&mdash;', 'no invoice dated in the period'));
  tiles.push(w.kg > 0
    ? rptTile('tonnage', 'Tonnage · ₹/kg', escHtml(rptKg(w.kg)) + ' · ' + figHtml(rptMoney(real), lc && lc.perKg > 0 ? figToneAgainst(real, lc.perKg, 5) : null),
      (lc && lc.perKg > 0 ? (real >= lc.perKg ? 'clears' : 'below') + ' the live cost ' + rptMoney(lc.perKg) + '/kg' : 'no live cost') +
      (w.coverage < 0.999 ? ' · on the ' + rptPct(w.coverage) + ' of revenue weighed' : ''), dl(w.kg, pw.kg, 'up'))
    : rptTile('tonnage', 'Tonnage · ₹/kg', '&mdash;', invs.length ? 'nothing weighed' : 'nothing invoiced'));
  tiles.push(rec.n
    ? rptTile('received', 'Material received', escHtml(rec.kg > 0 ? rptKg(rec.kg) : rptInt(rec.nos) + ' NOS'),
      rec.n + ' challan' + (rec.n === 1 ? '' : 's') + (rec.kg > 0 && rec.nos > 0 ? ' · and ' + rptInt(rec.nos) + ' NOS' : ''), dl(rec.kg, prec.kg, null))
    : rptTile('received', 'Material received', '&mdash;', 'no challan dated in the period'));
  tiles.push(plated
    ? rptTile('plated', 'Plated (floor)', escHtml(rptKg(plated.kg)), 'on ' + plated.days + ' complete day' + (plated.days === 1 ? '' : 's') + ' of ' + plated.working + ' working only',
      pplated ? dl(plated.kg / plated.days, pplated.kg / pplated.days, 'up').replace(/ on /, ' a day on ') : '')
    : rptTile('plated', 'Plated (floor)', '&mdash;', 'no complete day recorded (attendance and every staffed line)'));
  tiles.push(att.pct != null
    ? rptTile('attendance', 'Attendance', figHtml(Math.round(att.pct) + '%', figTonePct(att.pct, 90, 80)),
      'of the marks typed, Mon–Sat, a half day half, as Staff → Overview reads it · ' + formatNum(att.avg, 1) + ' on site a day over ' + att.days + ' day' + (att.days === 1 ? '' : 's') + ' recorded',
      dl(att.pct, patt.pct, 'up'))
    : rptTile('attendance', 'Attendance', '&mdash;', att.days ? 'no mark of the active roster on the days recorded' : 'no working day recorded'));
  tiles.push(lab.total > 0
    ? rptTile('labour', 'Labour', rptMoney(lab.total), labV.ok ? figHtml(rptMoney(labV.perKg) + '/kg', figToneAgainst(labV.perKg, labourCfg().modelPerKg || 3.55, 10, true)) + ' against the model ' + rptMoney(labourCfg().modelPerKg || 3.55)
      : '₹/kg withheld: ' + labV.why, plab.total > 0 && Math.abs(lab.coverage - plab.coverage) < 0.1 ? dl(lab.total, plab.total, null) : '')
    : rptTile('labour', 'Labour', '&mdash;', 'no attendance recorded'));
  tiles.push(cs.n
    ? rptTile('power', 'Power cuts', figHtml(String(cs.n), 'warning'), escHtml(powerDur(cs.min)) + ' dark in working hours · damage ' + rptMoney(gstRound(cs.cost)), dl(cs.n, pcs.n, 'down'))
    : rptTile('power', 'Power cuts', '&mdash;', pRec.recorded ? 'none on record on ' + pRec.recorded + ' recorded day' + (pRec.recorded === 1 ? '' : 's') : 'no floor record for the period'));
  var bankReach = cover && cover.from <= end && cover.to >= p.from;
  tiles.push(bankReach
    ? rptTile('cash', 'Cash in · out', rptMoney(brows.reduce(function(s, r) { return s + r.cr; }, 0)) + ' · ' + rptMoney(brows.reduce(function(s, r) { return s + r.dr; }, 0)),
      'on the bank statement' + (cover.to < end ? ', which stops on ' + escHtml(formatDate(cover.to)) : '') + (cover.from > p.from ? ', from ' + escHtml(formatDate(cover.from)) : ''))
    : rptTile('cash', 'Cash in · out', '&mdash;', bank ? 'the statement does not reach the period' : 'no bank statement imported'));
  h += rptSec('headline', 'In short', nothing ? '' : 'Against ' + escHtml(lbl) + ' (' + escHtml(pr.from === pr.to ? formatDate(pr.from) : rptSpan(pr.from, pr.to)) + ').',
    nothing ? rptNone('Nothing is recorded for this period: no invoice, challan, attendance, production, power cut or bank row.') : '<div class="inv-rpt-tiles">' + tiles.join('') + '</div>');
  if (nothing) return h + rptSourcesHtml(p, current) + '</td></tr></tbody></table></div>';

  // 2. By line (a day) / by day (a week) / by pay week (a month) / by month (a quarter, a year)
  h += rptBreakdownHtml(p, end, ctx, att);

  // 3. Clients
  h += rptClientsHtml(p, end, invs, w);

  // 4. Production by line (a day's is in its by-line table)
  if (p.kind !== 'daily') h += rptProductionHtml(p, end);

  // 5. Staff
  h += rptStaffHtml(p, end, lab, labV, w);

  // 6. Cost & margin
  if (p.kind !== 'daily' && p.kind !== 'weekly') h += rptCostHtml(p, end, w, lc, real);

  // 7. Money
  if (p.kind !== 'daily') h += rptMoneyHtml(p, end, current, brows, bankReach);

  // 8. Stock
  h += rptStockHtml(p, end, current);

  // 9. Power
  h += rptPowerHtml(p, end, cuts, cs, pRec);

  // 10. The day's invoices and challans
  if (p.kind === 'daily') h += rptDayListsHtml(invs, rec);

  // 11. Open items
  if (current) h += rptOpenHtml();

  // 12. Sources
  h += rptSourcesHtml(p, current);
  return h + '</td></tr></tbody></table></div>';
}

/* 2. The table under the tiles. */
function rptBreakdownHtml(p, end, ctx) {
  if (p.kind === 'daily') {
    var d = p.from, recd = !!((S.attendance || {})[d]);
    var rows = PROD_LINES.map(function(l) {
      var r = prodDayLine(d, l), heads = 0, need = 0;
      PROD_LINE_AREAS[l].forEach(function(a) {
        var n = areaNeedOn(d, a); if (n) need += n;
        var rec = (S.attendance || {})[d];
        if (rec && rec.marks) Object.keys(rec.marks).forEach(function(id) {
          var m = rec.marks[id], wk = staffById(id);
          if (m && (m.st === 'P' || m.st === 'H') && (m.area || (wk && wk.area)) === a) heads++;
        });
      });
      return [escHtml(prodLineName(l)), recd ? heads + (need ? ' / ' + need : '') : '', r.entries.length && r.kg > 0 ? (r.est > 0.0005 ? '≈ ' : '') + rptInt(r.kg) : '',
        r.entries.length && r.pieces ? rptInt(r.pieces) + (r.unweighed ? ' (' + rptInt(r.unweighed) + ' not weighed)' : '') : '', r.entries.length && r.rounds ? r.rounds : ''];
    });
    var cov = prodCoverage(d, d);
    return rptSec('lines', 'By line', escHtml('Heads on the general shift against the day’s number; plated as the register, the relay or a hand entry counts it (one figure per line and shift). ' +
      PROD_LINES.filter(function(l) { return cov[l].days; }).length + ' of ' + PROD_LINES.length + ' lines recorded.'),
      rptTable([['Line'], ['Heads', 1], ['Plated kg', 1], ['Pieces', 1], ['Rounds', 1]], rows, null, 'lines'));
  }
  var subs = [];
  if (p.kind === 'weekly') attWeekDays(p.from).forEach(function(d) { subs.push({ from: d, to: d, label: RPT_DAYS[new Date(d + 'T00:00:00').getDay()].slice(0, 3) + ' ' + rptShort(d) }); });
  else if (p.kind === 'monthly') {
    for (var ws = attWeekStartOf(p.from), g = 0; ws <= p.to && g < 7; ws = isoAddDays(ws, 7), g++) {
      var a = ws < p.from ? p.from : ws, b = isoAddDays(ws, 6) > p.to ? p.to : isoAddDays(ws, 6);
      subs.push({ from: a, to: b, label: 'W' + attPayWeekNumber(ws) + ' · ' + rptShort(a) + (a !== b ? ' – ' + rptShort(b) : '') });
    }
  } else {
    for (var m = p.from, k = 0; m <= p.to && k < 12; m = isoAddDays(payMonthEnd(m), 1), k++) subs.push({ from: m, to: payMonthEnd(m), label: insMonthLabel(m) + ' ' + m.slice(0, 4) });
  }
  // The foot totals only what its rows carry (QA5-10): a column of dashes foots to a dash, never to a 0; ₹/kg is the
  // weighed revenue over the weighed kilos of every row, and present the marks of every row, as each row reads them.
  var tot = { inv: 0, kg: 0, revKnown: 0, rec: 0, nos: 0, pl: 0, plDays: 0, present: 0, marked: 0, cuts: 0, cutsKnown: false };
  var rows2 = subs.map(function(s) {
    var f = rptRowFigures(ctx, s.from, s.to);
    if (f.future) return [escHtml(s.label), '', '', '', '', '', '', ''];
    tot.inv += f.taxable; tot.kg += f.kg; tot.revKnown += f.revKnown || 0; tot.rec += f.rec.kg; tot.nos += f.rec.nos;
    if (f.plated) { tot.pl += f.plated.kg; tot.plDays += f.plated.days || 0; }
    tot.present += f.att.present; tot.marked += f.att.marked;
    if (f.cutsKnown) { tot.cuts += f.cuts; tot.cutsKnown = true; }
    return [escHtml(s.label), f.inv ? escHtml(finRs(f.taxable)) : '', f.kg > 0 ? rptInt(f.kg) : '', f.real != null ? formatNum(f.real, 2) : '',
      f.rec.n ? (f.rec.kg > 0 ? rptInt(f.rec.kg) : '') + (f.rec.nos > 0 ? (f.rec.kg > 0 ? ' · ' : '') + rptInt(f.rec.nos) + ' NOS' : '') : '',
      f.plated ? rptInt(f.plated.kg) : '', f.att.pct != null ? Math.round(f.att.pct) + '%' : '', f.cutsKnown ? String(f.cuts) : ''];
  });
  var title = p.kind === 'weekly' ? 'By day' : p.kind === 'monthly' ? 'By pay week' : 'By month';
  return rptSec('breakdown', title, 'Invoiced is taxable, net of credit notes; kg and ₹/kg are the weighed lines; received is the challans’ kg (and NOS); plated is kg on complete days only; present is attendance as Staff → Overview reads it, the active roster’s marks typed Monday to Saturday, a half day half. A dash is a stretch nobody recorded, not a zero.',
    rptTable([[p.kind === 'weekly' ? 'Day' : p.kind === 'monthly' ? 'Week' : 'Month'], ['Invoiced', 1], ['kg', 1], ['₹/kg', 1], ['Received', 1], ['Plated kg', 1], ['Present', 1], ['Cuts', 1]], rows2,
      ['Total', tot.inv ? escHtml(finRs(tot.inv)) : '', tot.kg > 0 ? rptInt(tot.kg) : '', tot.kg > 0 ? formatNum(tot.revKnown / tot.kg, 2) : '',
        tot.rec || tot.nos ? (tot.rec ? rptInt(tot.rec) : '') + (tot.nos ? (tot.rec ? ' · ' : '') + rptInt(tot.nos) + ' NOS' : '') : '',
        tot.plDays ? rptInt(tot.pl) : '', tot.marked ? Math.round(tot.present / tot.marked * 100) + '%' : '', tot.cutsKnown ? String(tot.cuts) : ''], 'breakdown'));
}

/* 3. Clients: the largest by revenue, concentration, and (a month or longer) contribution worst first at the live cost. */
function rptClientsHtml(p, end, invs, w) {
  if (!invs.length) return rptSec('clients', 'Clients', '', rptNone('No invoice in the period.'));
  var roll = buildClientRollup(invs), total = sumTaxable(invs);
  var top3 = roll.slice(0, 3).reduce(function(s, r) { return s + r.total; }, 0);
  var body = rptTable([['Client'], ['Revenue', 1], ['kg', 1], ['₹/kg', 1], ['Share', 1]], roll.slice(0, 8).map(function(r) {
    return [escHtml(r.name), escHtml(finRs(r.total)), r.kg > 0 ? rptInt(r.kg) : '', r.comparable ? formatNum(r.realisation, 2) : 'n/a (' + Math.round(r.coverage * 100) + '% weighed)',
      total > 0 ? Math.round(r.total / total * 100) + '%' : ''];
  }), null, 'clients');
  body += rptP(escHtml('The top three carry ' + (total > 0 ? Math.round(top3 / total * 100) : 0) + '% of the revenue' + (roll.length > 8 ? '; ' + (roll.length - 8) + ' more clients are not listed' : '') +
    '. A ₹/kg is shown only where 90% or more of the client’s revenue is weighed, as Stats ranks it.'));
  if (p.kind !== 'daily' && p.kind !== 'weekly') {
    var m = statsClientMargins(null, invs, w, { from: p.from, to: end });
    if (m && m.ranked.length) {
      body += '<h4 class="inv-rpt-h4">Contribution by client, worst first</h4>' +
        rptTable([['Client'], ['Net ₹/kg', 1], ['vs variable', 1], ['vs full', 1], ['₹ on the period', 1]], m.ranked.map(function(x) {
          var sg = function(v) { return v == null ? '' : figHtml((v >= 0 ? '+' : '&minus;') + formatNum(Math.abs(v), 2), v >= 0 ? 'ok' : 'danger'); };
          return [escHtml(x.name), formatNum(x.net, 2), sg(x.vsVar), sg(x.vsFull), x.money != null ? figHtml(escHtml(finRs(x.money)), x.money >= 0 ? 'ok' : 'danger') : ''];
        }), null, 'margin') +
        rptP(escHtml('At the live cost of ' + formatCurrency(m.fullKg) + '/kg (' + statsPctOf(m.c.measuredShare) + '% measured), spread per kg' +
          (m.varKg != null ? '; variable ' + formatCurrency(m.varKg) + '/kg' : '; fixed and variable not known for the period') + '.'));
    }
  }
  return rptSec('clients', 'Clients', escHtml(roll.length + ' client' + (roll.length === 1 ? '' : 's') + ' invoiced, ' + formatCurrency(total) + ' taxable, net of credit notes.'), body);
}

/* 4. Production by line, with how much of the period the record covers. */
function rptProductionHtml(p, end) {
  var cov = prodCoverage(p.from, end), any = false;
  var rows = PROD_LINES.map(function(l) {
    var nos = 0, kg = 0, est = 0, un = 0;
    attDatesInRange(p.from, end).forEach(function(d) { var r = prodDayLine(d, l); nos += r.nos; kg += r.kg; est += r.est; un += r.unweighed; });
    if (cov[l].days) any = true;
    return [escHtml(prodLineName(l)), cov[l].days && kg > 0 ? (est > 0.0005 ? '≈ ' : '') + rptInt(kg) : '', cov[l].days && nos ? rptInt(nos) : '', cov[l].days + ' of ' + cov[l].of,
      cov[l].days && kg > 0 ? (est > 0.0005 ? Math.round(est / kg * 100) + '%' : 'none') + (un ? ', ' + rptInt(un) + ' pcs not weighed' : '') : ''];
  });
  if (!any) return rptSec('production', 'Production', '', rptNone('No plating recorded on any line in the period.'));
  return rptSec('production', 'Production by line', 'One figure per line and shift: the register, else the supervisor’s relay, else an entry by hand. Each run is weighed by the surest route the book holds: its kilos or its weight on record, else the challans it was set against, else its kind of part; the last column says how much of the weight is estimated. Days recorded are the working days with a counted entry for the line.',
    rptTable([['Line'], ['Plated kg', 1], ['Pieces', 1], ['Days recorded', 1], ['Estimated', 1]], rows, null, 'production'));
}

/* 5. Staff: by area against the day's number, OT and EXTRA; a week's payout; a month's labour fixed and variable. */
function rptStaffHtml(p, end, lab, labV, w) {
  var as = areaStats(p.from, end);
  if (!as.recordedDays) return rptSec('staff', 'Staff', '', rptNone('No attendance recorded in the period.'));
  var recDays = attDatesInRange(p.from, end).filter(function(d) { var r = (S.attendance || {})[d]; return r && r.marks && Object.keys(r.marks).length; });
  var rows = as.rows.filter(function(a) { return a.headDays || a.otHours || a.extraHours; }).map(function(a) {
    var need = 0, nd = 0;
    recDays.forEach(function(d) { var n = areaNeedOn(d, a.id); if (n != null) { need += n; nd++; } });
    var avg = a.headDays / as.recordedDays, needAvg = nd ? need / nd : null;
    return [escHtml(a.label), formatNum(avg, 1), needAvg != null ? figHtml(formatNum(needAvg, 1), avg + 0.05 < needAvg ? 'warning' : null) : '',
      a.otHours ? formatNum(a.otHours, 1) : '', a.extraHours ? formatNum(a.extraHours, 1) : ''];
  });
  var body = rptTable([['Area'], ['Heads a day', 1], ['Needed', 1], ['OT h', 1], ['EXTRA h', 1]], rows, null, 'areas');
  if (p.kind === 'weekly') {
    var fc = payForecast(p.from), wk = fc.week;
    body += '<h4 class="inv-rpt-h4">The payout</h4>' + rptTable([['Pay week ' + escHtml(rptPeriodShort(p))], ['₹', 1]], [
      ['Weekly tiers', escHtml(formatCurrency(wk.workers))], ['EXTRA pool (one line, disbursed by the supervisor)', escHtml(formatCurrency(wk.extra))],
      ['Payout, as recorded', escHtml(formatCurrency(wk.total))],
      fc.open && fc.basis !== 'recorded' ? ['Heading for, at the week’s pace', escHtml(formatCurrency(fc.predicted))] : null,
      fc.median != null ? ['Usual (median of ' + fc.medianWeeks + ' weeks)', escHtml(formatCurrency(fc.median))] : null
    ].filter(Boolean), null, 'payout') + rptP(escHtml(wk.recordedDays + ' of ' + wk.workingDays + ' working days recorded' + (wk.sundays ? ', and the Sunday' : '') + '.'));
  }
  if (p.kind !== 'daily' && p.kind !== 'weekly') {
    var model = labourCfg().modelPerKg || 3.55;
    body += '<h4 class="inv-rpt-h4">Labour</h4>' + rptTable([['Part'], ['₹', 1], ['₹/kg', 1]], [
      ['Fixed (the monthly crew, days and rest days)', escHtml(formatCurrency(lab.fixed)), labV.ok ? formatNum(lab.fixed / w.kg, 2) : ''],
      ['Variable (hourly pool, daily tier, OT, EXTRA)', escHtml(formatCurrency(lab.variable)), labV.ok ? formatNum(lab.variable / w.kg, 2) : ''],
      ['Labour', escHtml(formatCurrency(lab.total)), labV.ok ? figHtml(formatNum(labV.perKg, 2), figToneAgainst(labV.perKg, model, 10, true)) : '']
    ], null, 'labour') + rptP(labV.ok ? escHtml('Against the model ' + formatCurrency(model) + '/kg, on the invoiced tonnage.') : '₹/kg withheld: ' + labV.why + '.');
  }
  return rptSec('staff', 'Staff', escHtml(as.recordedDays + ' of ' + lab.workingDays + ' working days recorded (' + Math.round(lab.coverage * 100) + '%)' +
    (lab.sundaysRecorded ? ', and ' + lab.sundaysRecorded + ' Sunday' + (lab.sundaysRecorded === 1 ? '' : 's') : '') + '; OT ' + formatNum(lab.otHours, 1) + ' h, EXTRA ' + formatNum(as.bookedExtra, 1) + ' h booked.'), body);
}

/* 6. The live cost by component with its source, realisation and contribution. */
function rptCostHtml(p, end, w, lc, real) {
  if (!(w.kg > 0) || !lc) return rptSec('cost', 'Cost & margin', '', rptNone('No weighed tonnage in the period, so no cost per kg to set against it.'));
  var rows = lc.rows.map(function(r) {
    return [escHtml(r.label), escHtml(finRs(r.amount)), formatNum(r.amount / w.kg, 2), escHtml(COST_SRC_LABEL[r.source] || r.source || '')];
  });
  var contrib = real - lc.perKg;
  var body = rptTable([['Component'], ['₹', 1], ['₹/kg', 1], ['Source']], rows, ['Live cost', escHtml(finRs(lc.total)), formatNum(lc.perKg, 2), statsPctOf(lc.measuredShare) + '% measured'], 'cost');
  body += rptP('Realisation ' + rptMoney(real) + '/kg against it: ' + figHtml((contrib >= 0 ? '+' : '&minus;') + rptMoney(Math.abs(contrib)) + '/kg', contrib >= 0 ? 'ok' : 'danger') +
    ', ' + figHtml((contrib >= 0 ? '' : '&minus;') + rptMoney(Math.abs(gstRound(contrib * w.kg))), contrib >= 0 ? 'ok' : 'danger') + ' on the period. ' +
    (statsCostWeighedNote(w) || ''));
  return rptSec('cost', 'Cost & margin', escHtml('The live cost over ' + rptKg(w.kg) + ' invoiced; a stretch not recorded is filled at the model and said in its source.'), body);
}

/* 7. Money: the statement by category, owed by age, GST by month, credit notes, the forecast's low. */
function rptMoneyHtml(p, end, current, brows, reach) {
  var body = '', cov = '';
  if (reach) {
    var cls = bankClassify(brows), by = {};
    cls.forEach(function(v) {
      var e = by[v.cat] || (by[v.cat] = { cat: v.cat, cr: 0, dr: 0, n: 0 });
      e.cr += v.row.cr; e.dr += v.row.dr; e.n++;
    });
    var list = Object.keys(by).map(function(k) { return by[k]; }).sort(function(a, b) { return (b.cr + b.dr) - (a.cr + a.dr); });
    body += rptTable([['Category'], ['Rows', 1], ['In', 1], ['Out', 1]], list.map(function(e) {
      return [escHtml(bankCatLabel(e.cat)), e.n, e.cr ? escHtml(finRs(e.cr)) : '', e.dr ? escHtml(finRs(e.dr)) : ''];
    }), ['Total', brows.length, escHtml(finRs(brows.reduce(function(s, r) { return s + r.cr; }, 0))), escHtml(finRs(brows.reduce(function(s, r) { return s + r.dr; }, 0)))], 'bank');
    var c = bankCover();
    cov = 'The bank statement from ' + formatDate(c.from) + ' to ' + formatDate(c.to) + '. ';
  } else body += rptNone(finHasBank() ? 'The bank statement does not reach the period.' : 'No bank statement imported, so no money in or out to read.');
  if (current && finHasBank()) {
    var bands = finAgeing(finCtx().recv());
    if (bands.some(function(b) { return b.n; })) body += '<h4 class="inv-rpt-h4">Owed to us, today, by age</h4>' + rptTable([['Age'], ['Invoices', 1], ['Owed', 1]], bands.map(function(b) {
      return [escHtml(b.label), b.n || '', b.n ? figHtml(escHtml(finRs(b.amount)), b.lo > 90 ? 'danger' : b.lo > 60 ? 'warning' : null) : ''];
    }), null, 'ageing');
  }
  var months = [];
  for (var m = p.from.slice(0, 7), g = 0; m <= end.slice(0, 7) && g < 12; m = bankNextMonth(m), g++) months.push(m);
  var gst = finGstByMonth(months, finHasBank() ? finCtx().cls : []);
  body += '<h4 class="inv-rpt-h4">GST</h4>' + rptTable([['Month'], ['Due', 1], ['Paid', 1], ['State']], gst.map(function(r) {
    var st = finGstStatus(r);
    return [escHtml(billsMonthLabel(r.month)), escHtml(finRs(r.due)), r.paid ? escHtml(finRs(r.paid)) : '', escHtml(st.text)];
  }), null, 'gst');
  var notes = getCreditNotes().filter(function(n) { return n.status !== 'cancelled' && n.date && n.date >= p.from && n.date <= end; });
  body += '<h4 class="inv-rpt-h4">Credit notes issued</h4>' + (notes.length ? rptTable([['Note'], ['Date'], ['Client'], ['Taxable', 1]], notes.map(function(n) {
    return [escHtml(n.displayNumber || ''), escHtml(formatDate(n.date)), escHtml(n.clientName || ''), escHtml(formatCurrency(n.taxableValue || 0))];
  }), null, 'notes') : rptNone('None dated in the period.'));
  if (current) {
    var fc = finForecast(60);
    if (fc) body += rptP('The 60-day forecast’s lowest point: ' + figHtml(rptMoney(fc.min.bal), fc.min.bal < 0 ? (fc.noInflow ? 'warning' : 'danger') : null) + ' on ' + escHtml(formatDate(fc.min.date)) +
      (fc.noInflow ? ', counting outflows only (no receipt placed yet)' : '') + '.');
  }
  return rptSec('money', 'Money', escHtml(cov + 'GST due is the output tax on the month’s invoices less its credit notes; paid is what the statement sent by the 20th of the next.'), body);
}

/* 8. Stock: what is red or amber now (the period still running), and what came in and went out in the period. */
function rptStockHtml(p, end, current) {
  var items = stockData().items.filter(function(i) { return i.active !== false; }), body = '';
  if (!items.length) return rptSec('stock', 'Stock', '', rptNone('No stock line kept.'));
  if (current) {
    var low = items.map(function(i) { return { i: i, s: stockStatus(i) }; }).filter(function(x) { return x.s.tone === 'red' || x.s.tone === 'amber'; })
      .sort(function(a, b) { return (a.s.daysLeft == null ? -1 : a.s.daysLeft) - (b.s.daysLeft == null ? -1 : b.s.daysLeft); });
    body += low.length ? rptTable([['Line, now'], ['On hand', 1], ['Days left', 1], ['State']], low.map(function(x) {
      return [escHtml(x.i.name), escHtml(stockFmtQty(x.s.level) + ' ' + (x.i.unit || '')), x.s.daysLeft != null ? escHtml(stockDaysText(x.s.daysLeft, x.s.rate && x.s.rate.tentative)) : '',
        figHtml(x.s.tone === 'red' ? (x.s.group === 'out' ? 'Out' : 'Order now') : 'Low', x.s.tone === 'red' ? 'danger' : 'warning')];
    }), null, 'stocklow') : rptP('No line is red or amber now.');
  }
  var mv = {};
  stockData().entries.forEach(function(e) {
    if (e.voided || e.date < p.from || e.date > end || !/^(received|used|charged)$/.test(e.kind)) return;
    var x = mv[e.itemId] || (mv[e.itemId] = { rec: 0, used: 0 });
    if (e.kind === 'received') x.rec += Number(e.qty) || 0; else x.used += Number(e.qty) || 0;
  });
  var ids = Object.keys(mv);
  body += ids.length ? rptTable([['Line'], ['Received', 1], ['Used or charged', 1]], ids.map(function(id) {
    var it = stockItem(id), u = it ? it.unit || '' : '';
    return [escHtml(it ? it.name : id), mv[id].rec ? escHtml(stockFmtQty(mv[id].rec) + ' ' + u) : '', mv[id].used ? escHtml(stockFmtQty(mv[id].used) + ' ' + u) : ''];
  }), null, 'stockmoves') : rptNone('No delivery or use recorded in the period.');
  return rptSec('stock', 'Stock', 'Levels are replayed from the counts, deliveries and use recorded; days left is the level over the last three weeks’ use.', body);
}

/* 9. Power: each cut (a day, a week), or by month; damage is the Power page's. */
function rptPowerHtml(p, end, cuts, cs, rec) {
  var cov = escHtml(rec.recorded + ' of ' + rec.of + ' working days carry a floor record; a day with none is a gap, never a day without cuts.');
  if (!cuts.length) return rptSec('power', 'Power', cov, rptNone(rec.recorded ? 'No power cut on record in the period.' : 'No floor record for the period, so nothing can be said of its power.'));
  var body;
  if (p.kind === 'daily' || p.kind === 'weekly') {
    body = rptTable([['Date'], ['Cut'], ['In working hours', 1], ['Damage', 1]], cuts.map(function(c) {
      return [escHtml(formatDate(c.date)), escHtml(powerClock(c.from) + ' – ' + (c.to != null ? powerClock(c.to) + (c.overnight ? ' next day' : '') : 'not back')),
        escHtml(powerDur(c.cost.inside)), escHtml(formatCurrency(c.cost.total))];
    }), ['Total', todoPlural(cs.n, 'cut'), escHtml(powerDur(cs.min)), escHtml(formatCurrency(gstRound(cs.cost)))], 'cuts');
  } else {
    var by = {};
    cuts.forEach(function(c) { var k = c.date.slice(0, 7), x = by[k] || (by[k] = []); x.push(c); });
    body = rptTable([['Month'], ['Cuts', 1], ['In working hours', 1], ['Damage', 1]], Object.keys(by).sort().map(function(k) {
      var s = rptCutSum(by[k]);
      return [escHtml(billsMonthLabel(k)), s.n, escHtml(powerDur(s.min)), escHtml(formatCurrency(gstRound(s.cost)))];
    }), ['Total', cs.n, escHtml(powerDur(cs.min)), escHtml(formatCurrency(gstRound(cs.cost)))], 'cuts');
  }
  body += rptP('Damage is a restart, the overtime to catch up, and the output and platers’ wages a cut cost where it was not made up (Power → Case shows how).');
  return rptSec('power', 'Power', cov, body);
}

/* 10. A day's invoices and challans, as lists. An invoice is listed as it was issued, at the taxable on its face: the
   period's figures are net of credit notes (statsInvoices), a document is not (QA5-11). */
function rptDayListsHtml(invs, rec) {
  var byId = {};
  (S.invoices || []).forEach(function(i) { byId[i.id] = i; });
  var a = invs.length ? rptTable([['Invoice'], ['Client'], ['Taxable', 1]], invs.map(function(n) {
    var i = byId[n.id] || n;
    return [escHtml(i.displayNumber || i.invoiceNumber || ''), escHtml(i.clientName || ''), escHtml(formatCurrency(i.taxableValue || 0))];
  }), null, 'dayinvoices') : rptNone('No invoice issued.');
  var b = rec.n ? rptTable([['Challan'], ['Client'], ['Lines', 1], ['kg · NOS', 1]], rec.list.map(function(im) {
    var kg = 0, nos = 0;
    (im.items || []).forEach(function(it) { if (String(it.unit).toUpperCase() === 'NOS') nos += Number(it.qty) || 0; else kg += Number(it.qty) || 0; });
    return [escHtml(im.challanNo || '—'), escHtml(im.clientName || ''), (im.items || []).length, [kg ? rptInt(kg) + ' kg' : '', nos ? rptInt(nos) + ' NOS' : ''].filter(Boolean).join(' · ')];
  }), null, 'daychallans') : rptNone('No challan received.');
  return rptSec('daylists', 'The day’s paper', '', '<h4 class="inv-rpt-h4">Invoices issued</h4>' + a + '<h4 class="inv-rpt-h4">Challans received</h4>' + b);
}

/* 11. The red and amber To-do tasks now. */
function rptOpenHtml() {
  var rows = todoRanked().filter(function(r) { return r.tone === 'red' || r.tone === 'amber'; });
  if (!rows.length) return rptSec('open', 'Open items', '', rptNone('Nothing red or amber on the To-do.'));
  return rptSec('open', 'Open items', 'Red and amber on the To-do as this was drawn.', '<ul class="inv-rpt-list">' + rows.map(function(r) {
    var t = r.app ? r.app.title : r.mine.text;
    return '<li>' + figHtml(r.tone === 'red' ? 'Red' : 'Amber', r.tone === 'red' ? 'danger' : 'warning') + ' · ' + escHtml(t) + (r.mine ? ' (yours)' : '') + '</li>';
  }).join('') + '</ul>');
}

/* 12. Where every figure came from, and what is not recorded. */
function rptSourcesHtml(p, current) {
  var items = [
    'Invoices and credit notes: the Register, each invoice net of the notes against it (as Stats reads them).',
    'Challans: Incoming material, by challan date. Production and power cuts: Production’s record. Attendance and labour: Staff, at the labour card’s arithmetic.',
    'Cost: the live cost (Stats → Cost), measured where recorded and filled at the model where not. Money: the imported bank statement and GST by invoice month.',
    'Not recorded here: a day nobody typed (a gap, not a zero), material plated but not entered, and money that did not pass through the bank.'
  ];
  if (!current) items.push('A past period lists no open To-do: the tasks of the day it was are not kept.');
  return rptSec('sources', 'Sources', '', '<ul class="inv-rpt-list">' + items.map(function(x) { return '<li>' + escHtml(x) + '</li>'; }).join('') + '</ul>');
}

/* ---------- The page ---------- */
function renderReports() {
  var el = document.getElementById('reportsContent');
  if (!el) return;
  var p = rptCurrent(), today = localDateStr();
  var seg = '<div class="inv-seg" role="group" aria-label="Kind of report">' + RPT_KINDS.map(function(k) {
    return '<button type="button" class="inv-seg-btn" aria-pressed="' + (p.kind === k[0]) + '" data-action="invRptKind" data-kind="' + k[0] + '">' + k[1] + '</button>';
  }).join('') + '</div>';
  var pick;
  if (p.kind === 'daily' || p.kind === 'weekly') pick = '<input type="date" class="inv-input inv-id" id="rptDay" value="' + escHtml(p.kind === 'daily' ? p.from : (p.to > today ? today : p.from)) + '" max="' + today + '" aria-label="' + (p.kind === 'daily' ? 'Day' : 'A day in the week') + '">';
  else if (p.kind === 'monthly') pick = '<input type="month" class="inv-input inv-id" id="rptMonth" value="' + p.from.slice(0, 7) + '" max="' + today.slice(0, 7) + '" aria-label="Month">';
  else {
    // Back to the book's first invoice, and always to the year shown: the stepper goes further back than the book, and the
    // picker named another year than the document under it (QA5-14).
    var opts = [], fy = rptFy(today), first = (statsInvoices().map(function(i) { return i.date; }).filter(Boolean).sort()[0]) || today;
    var fy0 = Math.min(rptFy(first), fy - 1, rptFy(p.from));
    for (var y = fy; y >= fy0 && opts.length < 400; y--) {
      if (p.kind === 'yearly') opts.push([y + '-04-01', rptFyLabel(y)]);
      else for (var q = 4; q >= 1; q--) { var qp = rptPeriodOf('quarterly', isoAddDays(y + '-04-01', (q - 1) * 92)); if (qp.from <= today) opts.push([qp.from, 'Q' + q + ' ' + rptFyLabel(y)]); }
    }
    pick = '<select class="inv-select" id="rptPick" aria-label="' + (p.kind === 'yearly' ? 'Financial year' : 'Quarter') + '">' + opts.map(function(o) {
      return '<option value="' + o[0] + '"' + (o[0] === p.from ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>';
    }).join('') + '</select>';
  }
  var sub = p.kind === 'daily' ? RPT_DAYS[new Date(p.from + 'T00:00:00').getDay()] : p.kind === 'weekly' ? 'W' + attPayWeekNumber(p.from) + ' · ' + rptSpan(p.from, p.to)
    : p.kind === 'monthly' ? '' : rptMonthSpan(p.from, p.to);
  var isNow = p.from <= today && p.to >= today, nextStarts = isoAddDays(p.to, 1) <= today;
  var h = '<div class="inv-toolbar">' + seg + '</div>' +
    '<div class="inv-toolbar inv-stepper"><button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invRptStep" data-step="-1" aria-label="Previous period">' + STAFF_BACK_ICON + '</button>' +
    '<div class="inv-stepper-label">' + pick + (sub ? '<span class="inv-stepper-sub">' + escHtml(sub) + (isNow ? ', to date' : '') + '</span>' : isNow ? '<span class="inv-stepper-sub">to date</span>' : '') + '</div>' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invRptStep" data-step="1" aria-label="Next period"' + (nextStarts ? '' : ' disabled') + '>' + STAFF_NEXT_ICON + '</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invRptNow"' + (isNow ? ' disabled' : '') + '>Now</button></div>' +
    '<div class="inv-toolbar"><button class="inv-btn inv-btn-primary" data-action="invRptPrint">Print</button>' +
    '<span class="inv-note">A4, drawn from the records each time it is shown or printed.</span></div>';
  var doc = rptHtml(p.kind, p.from);
  el.innerHTML = h + '<div class="inv-rpt-sheet" id="rptSheet">' + doc + '</div>';
  // A report open in the print view follows the data too.
  var body = document.getElementById('invPrintBody'), view = document.getElementById('invPrintView');
  if (body && view && view.classList.contains('inv-print-view-active') && body.querySelector('[data-rpt-doc]')) { body.innerHTML = doc; printFit(); }
}

function rptPrint() {
  var body = document.getElementById('invPrintBody');
  if (!body) return;
  var p = rptCurrent();
  body.innerHTML = rptHtml(p.kind, p.from);
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  _printInvId = null;
  printFit();
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  // The PDF's file name: "SEP monthly report 2026-09".
  document.title = 'SEP ' + p.kind + ' report ' + (p.kind === 'monthly' ? p.from.slice(0, 7) : p.kind === 'yearly' ? rptFyLabel(rptFy(p.from)).replace(' ', '-') :
    p.kind === 'quarterly' ? 'Q' + rptQuarter(p.from) + '-' + rptFyLabel(rptFy(p.from)).replace(' ', '-') : p.kind === 'weekly' ? 'W' + attPayWeekNumber(p.from) + '-' + p.to.slice(0, 4) : p.from);
}

/* Stats → Overview → Make a report: the same period, as a report. Stats' All is the whole book, which no report covers
   (a financial year at most): it opens the year to date and says so (QA5-14). */
function rptFromStats() {
  var per = typeof _statsPeriod === 'string' ? _statsPeriod : 'mtd';
  rptSet(per === 'qtd' ? 'quarterly' : per === 'ytd' || per === 'all' ? 'yearly' : 'monthly', localDateStr());
  switchTab('pageReports');
  if (per === 'all') showToast('A report covers a financial year at most: this is ' + rptFyLabel(rptFy(localDateStr())) + ', not the whole book Stats showed. Step back a year with ‹.', 'info');
}

/* The address (nav.js): `kind/first-day`. */
function rptNavV() { var s = rptLoad(); return s.kind + '/' + s.from; }
function rptNavApply(v) {
  var parts = String(v || '').split('/'), s = rptLoad();
  rptSet(rptKindOk(parts[0]) ? parts[0] : s.kind, rptIsoOk(parts[1]) ? parts[1] : (rptKindOk(parts[0]) && parts[0] !== s.kind ? localDateStr() : s.from));
}
function rptNavLabel(v) {
  var parts = String(v || '').split('/');
  if (!rptKindOk(parts[0])) return '';
  return rptKindLabel(parts[0]) + (rptIsoOk(parts[1]) ? ' · ' + rptPeriodShort(rptPeriodOf(parts[0], parts[1])) : '');
}

function rptAction(action, btn) {
  if (action.indexOf('invRpt') !== 0) return false;
  var p = rptCurrent();
  switch (action) {
    case 'invRptKind':
      // Another kind opens on the period of that kind holding the last day of the one shown (a day in March opens
      // March's month; March's month opens the week it ends in).
      rptSet(btn.dataset.kind, p.to > localDateStr() ? localDateStr() : p.to);
      renderReports(); viewTop(); break;
    case 'invRptStep': {
      var np = rptStepPeriod(p, Number(btn.dataset.step) < 0 ? -1 : 1);
      if (np.from <= localDateStr()) { rptSet(np.kind, np.from); renderReports(); }
      break;
    }
    case 'invRptNow': rptSet(p.kind, localDateStr()); renderReports(); break;
    case 'invRptPrint': rptPrint(); break;
    case 'invRptFromStats': rptFromStats(); break;
    default: return false;
  }
  return true;
}
function rptOnChange(t) {
  if (!t || !/^(rptDay|rptMonth|rptPick)$/.test(t.id)) return false;
  var v = String(t.value || ''), p = rptCurrent();
  if (t.id === 'rptMonth') v = /^\d{4}-\d{2}$/.test(v) ? v + '-01' : '';
  if (rptIsoOk(v)) { rptSet(p.kind, v); renderReports(); }
  return true;
}
