/* ===== THE DATA LAYER, SHAPED FOR SQL (docs/UI_PASS_3.md §6, step U1) =====
 * docs/SERVER.md §4 puts the book on the hub as records and adds typed tables when a report needs them (invoices by month and
 * client, production by line and day). Every screen reads S directly; widgets (U2) are new code, so they read VIEWS: named row
 * sets whose columns are those typed tables' columns. On a device a view's rows are worked out from the book by the functions
 * the screens already draw with, never a second arithmetic; once the hub has the typed table a view can be filled from it
 * instead, and no widget changes.
 *
 * - A view (DV_VIEWS, by name): {name, cols: [{name, type: 'text' | 'int' | 'num' | 'date' | 'bool', unit}], stores: the book's
 *   paths it reads, rows: function () → [{col: value}]}. dvRows is the reader: it keeps exactly the view's columns, in order,
 *   each in its type, and nothing else.
 * - Rows are plain JSON: a date ISO YYYY-MM-DD, a month YYYY-MM (text, unit 'month'), money in rupees rounded by gstRound at
 *   the boundary (unit '₹'), a weight in kilograms, a list of ids a JSON array (text, unit 'json'). **Unknown is null, never
 *   0**: a day with no record, a part with no weight, a month the statement does not reach.
 * - Each view is worked out on its first read and kept until the book changes: the book itself (a book loaded whole is a new
 *   S), every save asked for in this window (_bookWrites, state.js), the production record's version for a view that reads it
 *   (_prodVer, production.js), and the day, since a view runs to today. Each view is kept on its own. The rows are frozen: a
 *   reader that sorts or changes them takes a copy.
 * - A view is role-blind, as the hub's typed table is: who may see a figure is a widget's own `needs` (§7g), never the view's.
 * - dvSum is a small GROUP BY over a view: nulls are left out of every measure and counted in `nulls`, as SQL leaves them.
 */

/* A column: its name (the hub's), its type, its unit (null where none). */
function _dvColsOf(list) {
  return list.map(function(c) {
    var o = { name: c[0], type: c[1], unit: c[2] || null };
    if (c[3]) Object.keys(c[3]).forEach(function(k) { o[k] = c[3][k]; });
    return o;
  });
}
/* The views read only what they name: the views below, then the lookups they share in one book state. */
var DV_VIEWS = {
  /* A line of an invoice as Stats counts it: active invoices only, net of their credit notes (statsInvoices), weighed by
     lineWeightKg as weighLines weighs it (its route in kg_src). A line's taxable is its share of its invoice's, so the lines
     foot to the invoice to the paisa (the paise left over by rounding each line go to the lines with the largest remainders:
     Stats' own lines, each rounded, can add to a paisa more than the invoice); tax is the invoice's as issued, shared the same
     way. A cancelled invoice bills nothing and has no lines here. */
  invoice_lines: { name: 'invoice_lines',
    stores: ['invoices', 'creditNotes', 'clients', 'items', 'partWeights'],
    cols: _dvColsOf([['date', 'date'], ['month', 'text', 'month'], ['invoice_id', 'text'], ['line', 'int'], ['number', 'text'], ['client_id', 'int'],
      ['part', 'text'], ['gauge', 'text'], ['unit', 'text'], ['qty', 'num'], ['kg', 'num', 'kg'], ['kg_src', 'text'],
      ['taxable', 'num', '₹'], ['taxable_net', 'num', '₹'], ['tax', 'num', '₹']]),
    rows: function() {
      var net = _dvNetInvoices().byId, out = [];
      _dvByDate(S.invoices || []).forEach(function(inv) {
        var n = net[inv.id], items = inv.items || [];
        if (!n || !items.length) return;
        var w = items.map(function(it) { return Number(it.amount) || 0; }), client = rowClient(inv);
        var gross = _dvShares(inv.taxableValue, w), nett = _dvShares(n.taxableValue, w), tax = _dvShares(_dvTax(inv), w);
        items.forEach(function(it, k) {
          // Weighed as Stats weighs it, on the net line (a piece client's weight is its amount as billed over its ₹/kg: a credit
          // note takes rupees off a line, never kilos).
          var wt = lineWeightKg((n.items || [])[k] || it, client, inv.date), idn = cpPartIdentity(it.partNumber, it.desc);
          out.push({ date: inv.date, month: _dvMonthOf(inv.date), invoice_id: inv.id, line: k + 1, number: inv.displayNumber, client_id: inv.clientId,
            part: it.partNumber, gauge: idn.gauge, unit: it.unit || 'KG', qty: it.qty, kg: wt.known ? wt.kg : null, kg_src: wt.known ? wt.src : null,
            taxable: gross[k], taxable_net: nett[k], tax: tax[k] });
        });
      });
      return out;
    } },

  /* Every invoice the register holds, cancelled ones included (state 'cancelled', nothing net, nothing owed). Its state and the
     day it entered it (invStateOf, invStateSince; a cancelled one its cancelledAt), its terms (flowTerms) and the day they fall
     due, calendar days from its date as flow.js reads them, and what Receivables says of it (bankReceivables, as the invoice's
     own detail reads it, finInvoicePayment): open, or paid on the day the receipt that settled it came in, and how (exact,
     oldest, on account, a cheque in hand). Unknown with no statement, and for an invoice dated before receivables start. */
  invoices: { name: 'invoices',
    stores: ['invoices', 'creditNotes', 'clients', 'bank.rows', 'bank.parties', 'bank.opening', 'bank.cheques', 'bank.bounces', 'flowCfg', 'invStateCheck'],
    cols: _dvColsOf([['id', 'text'], ['number', 'text'], ['date', 'date'], ['client_id', 'int'], ['state', 'text'], ['state_since', 'date'],
      ['taxable', 'num', '₹'], ['taxable_net', 'num', '₹'], ['tax', 'num', '₹'], ['total', 'num', '₹'], ['terms_days', 'int', 'days'], ['due_on', 'date'],
      ['paid_on', 'date'], ['paid_how', 'text'], ['open_amount', 'num', '₹']]),
    rows: function() {
      var net = _dvNetInvoices().byId, pay = _dvPayIndex();
      return _dvByDate(S.invoices || []).map(function(inv) {
        var st = invStateOf(inv), dead = st === 'cancelled', terms = flowTerms(inv.clientId).days, p = dead ? null : pay(inv);
        return { id: inv.id, number: inv.displayNumber, date: inv.date, client_id: inv.clientId, state: st, state_since: _dvStateSince(inv),
          taxable: inv.taxableValue, taxable_net: net[inv.id] ? net[inv.id].taxableValue : 0, tax: _dvTax(inv), total: inv.grandTotal,
          terms_days: terms, due_on: !dead && _dvIso(inv.date) ? isoAddDays(inv.date, terms) : null,
          paid_on: p ? p.on : null, paid_how: p ? p.how : null, open_amount: dead ? 0 : p ? p.open : null };
      });
    } },

  /* A receipt as Receivables reads it (bankReceivables): placed on a client, set exactly or oldest first against its invoices,
     or on account where nothing was open to pay (`how`); a cheque in hand is a receipt from the day it came, as Receivables
     counts it. A receipt with no client since receivables start (bankLooseReceipts) is not placed and pays nothing known. */
  receipts: { name: 'receipts',
    stores: ['bank.rows', 'bank.parties', 'bank.opening', 'bank.cheques', 'bank.bounces', 'invoices', 'creditNotes', 'clients'],
    cols: _dvColsOf([['id', 'text'], ['source', 'text'], ['date', 'date'], ['client_id', 'int'], ['amount', 'num', '₹'], ['placed', 'bool'], ['how', 'text'],
      ['invoice_ids', 'text', 'json']]),
    rows: function() {
      var ctx = _dvBank();
      if (!ctx.rows.length) return [];
      var lab = _dvLabels(), list = [];
      ctx.recv().forEach(function(r) {
        r.allocs.forEach(function(a) {
          var ids = [];
          a.parts.forEach(function(p) { var id = p.inv ? lab[String(r.client.id) + '|' + p.label] : null; if (id && ids.indexOf(id) < 0) ids.push(id); });
          list.push({ row: a.v.row, o: { id: a.v.row.id, source: a.v.pending ? 'cheque' : 'bank', date: a.v.row.date, client_id: r.client.id, amount: a.v.row.cr, placed: true,
            how: a.parts.length ? a.how : 'on account', invoice_ids: JSON.stringify(ids) } });
        });
      });
      bankLooseReceipts(ctx.cls, bankRecvFrom(ctx.rows)).forEach(function(v) {
        list.push({ row: v.row, o: { id: v.row.id, source: 'bank', date: v.row.date, client_id: null, amount: v.row.cr, placed: false, how: null, invoice_ids: null } });
      });
      return list.sort(function(a, b) { return _dvCmp(a.row.date, b.row.date) || _dvRowAt(a.row) - _dvRowAt(b.row); }).map(function(x) { return x.o; });
    } },

  /* A challan line: what is still open on it (imLineOpen: the open share, an unbilled amount anywhere in the app), what the
     invoices billed of it (imBilledIndex; a line flagged invoiced before lines were linked is billed whole), and the day it is
     wanted by (flowPriorityOf: the line's own, else the challan's). */
  challan_lines: { name: 'challan_lines',
    stores: ['incomingMaterial', 'invoices'],
    cols: _dvColsOf([['id', 'text'], ['challan_id', 'text'], ['date', 'date'], ['client_id', 'int'], ['challan_no', 'text'], ['part', 'text'], ['unit', 'text'], ['qty', 'num'],
      ['open_qty', 'num'], ['open_amount', 'num', '₹'], ['billed_qty', 'num'], ['wanted_by', 'date']]),
    rows: function() {
      var idx = imBilledIndex(), out = [];
      (S.incomingMaterial || []).slice().sort(function(a, b) {
        return _dvCmp(a.challanDate || a.receivedDate || '', b.challanDate || b.receivedDate || '') || String(a.challanNo || '').localeCompare(String(b.challanNo || ''), 'en', { numeric: true });
      }).forEach(function(m) {
        (m.items || []).forEach(function(it) {
          var o = imLineOpen(it), refs = idx[it.id] || [];
          out.push({ id: it.id == null ? null : String(it.id), challan_id: m.id == null ? null : String(m.id), date: m.challanDate || m.receivedDate, client_id: m.clientId,
            challan_no: m.challanNo, part: it.partNumber, unit: it.unit || 'KG', qty: it.qty,
            open_qty: o.qty, open_amount: o.amount, billed_qty: refs.length ? imRefsBilled(it, refs).qty : it.billedLegacy ? Number(it.qty) || 0 : 0,
            wanted_by: flowPriorityOf(m, it) });
        });
      });
      return out;
    } },

  /* A line's day of plating, every working day from the first plating recorded to today and each of the three lines (a Sunday
     where it was worked): what it plated (prodLineDaySum: the counted runs, each weighed by prodWeigh; kg_est where any of it is
     estimated, the pieces nothing weighs), its rounds, efficiency and the cut minutes inside the time it ran
     (prodLineEfficiency), what it earned at its clients' rates on record (prodDayWorth). A line-day with no run is a gap: every
     measure null. Kilos with no run weighed are null too, the pieces saying how many. */
  production_days: { name: 'production_days', prod: true,
    stores: ['production.entries', 'attendance', 'plant', 'clients', 'items', 'partWeights', 'incomingMaterial', 'invoices', 'planner'],
    cols: _dvColsOf([['date', 'date'], ['line', 'text'], ['kg', 'num', 'kg'], ['kg_est', 'bool'], ['pieces', 'num', 'NOS'], ['pieces_unweighed', 'num', 'NOS'],
      ['rounds', 'num'], ['efficiency', 'num', '%'], ['earned', 'num', '₹'], ['cut_minutes', 'int', 'min']]),
    rows: function() {
      var P = _dvProd(), out = [];
      P.days.forEach(function(d) {
        PROD_LINES.forEach(function(l) {
          var x = P.runs[d + '|' + l] ? prodLineDaySum(d, l) : null;
          if (!x || !x.runs) { out.push({ date: d, line: l }); return; }
          // Each line's prodLineEfficiency, as the plant's day reads it (prodDayEfficiency's `lines`): one reading a day for both views.
          var ef = _dvDayEff(d).lines[l];
          out.push({ date: d, line: l, kg: x.kg > 0 || !x.unweighed ? x.kg : null, kg_est: x.est, pieces: x.pieces, pieces_unweighed: x.unweighed,
            rounds: ef.rounds > 0 ? ef.rounds : null, efficiency: ef.eff != null ? ef.eff * 100 : null, earned: x.priced ? x.worth : null, cut_minutes: ef.cutMin });
        });
      });
      return out;
    } },

  /* A day's attendance, every working day from the first marked to today (a Sunday with marks): the day's roster and who was on
     site and on the floor against the floor's number, as Floor's People card and Pulse read it (attDaySummary: attDayRoster,
     areaNeedOn); the overtime and the EXTRA booked, as Hours by area places them (areaHoursForRange, by attHoursSplit). A day
     with no marks is not recorded: every figure null. The floor's number is null where no floor area has one. */
  attendance_days: { name: 'attendance_days',
    stores: ['attendance', 'staff', 'shiftNeeds', 'areaTargets'],
    cols: _dvColsOf([['date', 'date'], ['roster', 'int', 'count'], ['on_site', 'int', 'count'], ['floor_heads', 'int', 'count'], ['floor_need', 'int', 'count'],
      ['ot_hours', 'num', 'h'], ['extra_hours', 'num', 'h'], ['recorded', 'bool']]),
    rows: function() {
      var att = S.attendance || {}, first = null;
      Object.keys(att).forEach(function(k) { if (_dvIso(k) && _dvMarked(att[k]) && (!first || k < first)) first = k; });
      if (!first) return [];
      return _dvDays(first, localDateStr(), function(d) { return _dvMarked(att[d]); }).map(function(d) {
        var a = attDaySummary(d);
        if (!a.marked) return { date: d, recorded: false };
        var h = _dvHours(d);
        return { date: d, roster: a.roster.length, on_site: a.p + a.half, floor_heads: a.floorHeads, floor_need: _dvFloorNeed(d, a), ot_hours: h.ot,
          extra_hours: h.extra, recorded: true };
      });
    } },

  /* A power cut as Power reads it (powerAnalysis: powerCuts, the same cut reported twice is one): its clock, its minutes (null
     with no time back), the minutes of it inside a working window (a cut with no time back at the median length, as the case
     costs it), why it went (its reason's name, as completed), where it hit, and its damage. */
  power_cuts: { name: 'power_cuts', prod: true,
    stores: ['production.entries', 'power.causes', 'power.cfg', 'attendance', 'staff', 'invoices', 'creditNotes', 'costBills', 'labour'],
    cols: _dvColsOf([['id', 'text'], ['date', 'date'], ['from', 'text', 'HH:MM'], ['to', 'text', 'HH:MM'], ['minutes', 'int', 'min'], ['working_minutes', 'int', 'min'],
      ['reason', 'text'], ['where', 'text'], ['damage', 'num', '₹']]),
    rows: function() {
      // A cut is the reports of it joined (powerCuts): its key is the id of the report typed first (its at, then its id), which a
      // report joining it later keeps. Sorting the ids alone was that order only for ids made on a device (a prefix and the
      // time); an imported report's id is the file's own.
      var at = {};
      prodIndex().live.forEach(function(e) { if (e.kind === 'downtime') at[e.id] = Number(e.at) || 0; });
      var first = function(ids) {
        return (ids || []).slice().sort(function(a, b) { return ((at[a] || 0) - (at[b] || 0)) || (a < b ? -1 : a > b ? 1 : 0); })[0] || null;
      };
      return _dvPower().cuts.map(function(c) {
        return { id: first(c.ids), date: c.date, from: prodHhmm(c.from), to: c.to == null ? null : prodHhmm(c.to), minutes: c.min,
          working_minutes: c.cost ? c.cost.inside : null,
          reason: c.reason ? pcsName(c.reason) : null, where: c.where, damage: c.cost ? c.cost.total : null };
      });
    } },

  /* A stock line in use (stockStatus: the level replayed, the days left at its daily use; a bath line has no days left), and its
     last price and the supplier it came from (stockPattern's last purchase; the supplier as Payments knows it, suppOfName). The
     level and the use are in the line's own unit. */
  stock_lines: { name: 'stock_lines',
    stores: ['stock.items', 'stock.entries', 'stockCheck', 'suppliers'],
    cols: _dvColsOf([['id', 'text'], ['name', 'text'], ['unit', 'text'], ['level', 'num'], ['days_left', 'num', 'days'], ['use_day', 'num'],
      ['last_price', 'num', '₹/unit'], ['supplier_id', 'text']]),
    rows: function() {
      return stockData().items.filter(function(i) { return i && i.active !== false; }).map(function(item) {
        var st = stockStatus(item), last = stockPattern(item).last, sp = last && last.e.supplier ? suppOfName(last.e.supplier) : null;
        return { id: item.id, name: item.name, unit: item.unit, level: st.level, days_left: st.daysLeft, use_day: st.rate ? st.rate.rate : null,
          last_price: last && last.e.price > 0 ? last.e.price : null, supplier_id: sp ? sp.id : null };
      });
    } },

  /* The statement's rows as Money reads them (bankRows, oldest first in the bank's own order inside a day; bankClassify: the
     category worked out and as set, the payee, the client a receipt is placed on). The last row's balance is the Cash hero's. */
  bank_rows: { name: 'bank_rows',
    stores: ['bank.rows', 'bank.parties', 'bank.cheques', 'bank.bounces', 'clients', 'staff', 'stock.entries', 'suppliers'],
    cols: _dvColsOf([['id', 'text'], ['date', 'date'], ['amount_in', 'num', '₹'], ['amount_out', 'num', '₹'], ['balance', 'num', '₹'], ['category', 'text'], ['party', 'text'],
      ['client_id', 'int']]),
    rows: function() {
      return _dvBank().cls.map(function(v) {
        return { id: v.row.id, date: v.row.date, amount_in: v.row.cr || 0, amount_out: v.row.dr || 0, balance: v.row.balance, category: v.cat, party: v.party, client_id: v.clientId };
      });
    } },

  /* A month's cost as Stats → Trends' six months read it (statsMonthRows): the month's weighed kilos of its net invoices
     (weighLines) and the live cost of each component over them (liveCost, which reads what the bank paid where the record is
     thin), in rupees, with the share measured. A month with nothing weighed has no cost per kilo: every figure null. */
  cost_months: { name: 'cost_months',
    stores: ['invoices', 'creditNotes', 'clients', 'items', 'partWeights', 'attendance', 'staff', 'labour', 'payrollPaid', 'stock', 'costBills', 'costModel', 'zinc', 'bank'],
    cols: _dvColsOf([['month', 'text', 'month'], ['kg', 'num', 'kg'], ['labour', 'num', '₹'], ['zinc', 'num', '₹'], ['chemicals', 'num', '₹'], ['power', 'num', '₹'],
      ['other', 'num', '₹'], ['measured_share', 'num', 'share']]),
    rows: function() {
      var inv = _dvNetInvoices().list.filter(function(i) { return _dvIso(i.date); }), today = localDateStr(), out = [];
      var first = inv.reduce(function(m, i) { return !m || i.date < m ? i.date : m; }, '');
      if (!first) return [];
      for (var m = first.slice(0, 7), g = 0; m <= today.slice(0, 7) && g < 240; m = bankNextMonth(m), g++) {
        var from = m + '-01', to = payMonthEnd(from);
        if (to > today) to = today;
        var w = weighLines(inv.filter(function(i) { return i.date >= from && i.date <= to; }));
        if (!(w.kg > 0)) { out.push({ month: m }); continue; }
        var c = liveCost(from, to, w.kg), part = function(k) { var r = c.rows.find(function(x) { return x.key === k; }); return r ? r.amount : null; };
        out.push({ month: m, kg: w.kg, labour: part('labour'), zinc: part('zinc'), chemicals: part('chem'), power: part('power'), other: part('other'),
          measured_share: c.measuredShare });
      }
      return out;
    } },

  /* One row a working day over the book (Monday to Saturday from the first invoice, attendance or plating to today, and a Sunday
     worked), its pay week (the week's Saturday, as People and Pay number it), and a column a series of the *corr* catalogue
     (§7d), each worked out by the function its screen uses: the weekly series (realisation, days to pay) carry their week's
     figure on every day of it. A series not known on a day is null. */
  daily: { name: 'daily', prod: true,
    stores: ['invoices', 'creditNotes', 'clients', 'items', 'partWeights', 'attendance', 'staff', 'shiftNeeds', 'areaTargets', 'production.entries', 'plant',
      'power.causes', 'costBills', 'labour', 'zinc.lmeHistory', 'bank.rows', 'bank.parties', 'bank.opening', 'bank.cheques', 'bank.bounces'],
    cols: _dvColsOf([['date', 'date'], ['week', 'date'],
      ['cutMin', 'num', 'min', { label: 'Power cut minutes', grain: 'day', dir: 'across', needs: {} }],
      ['heads', 'num', 'count', { label: 'Heads on site', grain: 'day', dir: 'across', needs: {} }],
      ['otHours', 'num', 'h', { label: 'Overtime hours', grain: 'day', dir: 'across', needs: {} }],
      ['zinc', 'num', '₹/kg', { label: 'Zinc price', grain: 'day', dir: 'across', needs: {} }],
      ['invSize', 'num', '₹', { label: 'Invoice size', grain: 'day', dir: 'across', needs: { money: true } }],
      ['tonnes', 'num', 't', { label: 'Tonnes plated', grain: 'day', dir: 'up', needs: {} }],
      ['real', 'num', '₹/kg', { label: 'Realisation', grain: 'week', dir: 'up', needs: { money: true } }],
      ['dtp', 'num', 'days', { label: 'Days to pay', grain: 'week', dir: 'up', needs: { money: true, statement: true } }],
      ['eff', 'num', '%', { label: 'Line efficiency', grain: 'day', dir: 'up', needs: {} }]]),
    rows: function() {
      var today = localDateStr(), net = _dvNetInvoices().list, att = S.attendance || {}, P = _dvProd();
      var first = null, at = function(d) { if (_dvIso(d) && (!first || d < first)) first = d; };
      net.forEach(function(i) { at(i.date); });
      Object.keys(att).forEach(function(k) { if (_dvMarked(att[k])) at(k); });
      at(P.first);
      if (!first || first > today) return [];
      var worked = function(d) { return _dvWorked(att[d]) || !!P.runsDay[d]; };
      // A day's invoices, a week's invoices and the receipts set against them (bankPayHistory, as Days to pay reads them).
      var invDay = {}, invWeek = {}, paidWeek = {};
      net.forEach(function(i) {
        if (!_dvIso(i.date)) return;
        (invDay[i.date] = invDay[i.date] || []).push(i);
        var ws = attWeekStartOf(i.date);
        (invWeek[ws] = invWeek[ws] || []).push(i);
      });
      var ctx = _dvBank();
      if (ctx.rows.length) {
        var hist = bankPayHistory(ctx.recv());
        Object.keys(hist).forEach(function(k) { hist[k].forEach(function(x) { var ws = attWeekStartOf(x.date); (paidWeek[ws] = paidWeek[ws] || []).push(x); }); });
      }
      var zinc = {};
      zincTrend().market.forEach(function(x) { zinc[x.date] = x.landed; });
      var attRow = {};
      dvRows('attendance_days').forEach(function(r) { attRow[r.date] = r; });
      var cutOn = _dvCutMinutes(), weeks = {};
      var week = function(ws) {
        if (weeks[ws]) return weeks[ws];
        var w = invWeek[ws] ? weighLines(invWeek[ws]) : null, paid = paidWeek[ws], dtp = paid && paid.length ? bankDaysToPay('w', { w: paid }) : null;
        return (weeks[ws] = { real: w && w.kg > 0 ? w.revKnown / w.kg : null, dtp: dtp ? dtp.median : null });
      };
      return _dvDays(first, today, worked).map(function(d) {
        var ws = attWeekStartOf(d), wk = week(ws), a = attRow[d], s = attDaySummary(d), list = invDay[d] || [];
        var ran = !!P.runsDay[d], plated = ran ? prodDayPlated(d) : null, eff = ran ? _dvDayEff(d).eff : null;
        return { date: d, week: isoAddDays(ws, 6), cutMin: cutOn(d, new Date(d + 'T00:00:00').getDay() === 0 && worked(d)),
          heads: s.marked ? s.p + s.half * 0.5 : null, otHours: a && a.recorded ? a.ot_hours + a.extra_hours : null,
          zinc: zinc[d] != null ? zinc[d] : null,
          invSize: list.length ? list.reduce(function(t, i) { return t + (Number(i.taxableValue) || 0); }, 0) / list.length : null,
          tonnes: plated && plated.whole ? plated.kg / 1000 : null, real: wk.real, dtp: wk.dtp, eff: eff != null ? eff * 100 : null };
      });
    } },

  /* Tata Motors' month as the owner typed it from the release (§9c, S.market.tata, a map by month; U2 adds it): this year's
     figure of each, in units. None until it exists. */
  market_tata: { name: 'market_tata',
    stores: ['market.tata'],
    cols: _dvColsOf([['month', 'text', 'month'], ['cv_total', 'int', 'units'], ['cv_domestic', 'int', 'units'], ['cv_export', 'int', 'units'], ['hcv', 'int', 'units'],
      ['released_on', 'date']]),
    rows: function() {
      var t = S.market && S.market.tata, now = function(f) { return f && typeof f === 'object' ? f.now : f; };
      if (!t || typeof t !== 'object') return [];
      return Object.keys(t).filter(function(m) { return /^\d{4}-\d{2}$/.test(m) && t[m] && typeof t[m] === 'object'; }).sort().map(function(m) {
        var r = t[m];
        return { month: m, cv_total: now(r.cvTotal), cv_domestic: now(r.cvDomestic), cv_export: now(r.cvExport), hcv: now(r.hcv), released_on: r.released };
      });
    } },

  /* The day's forecast as it stood when the weather was last fetched (§9d, S.market.weather, a map by day; U2 adds it). None
     until it exists. */
  weather_days: { name: 'weather_days',
    stores: ['market.weather'],
    cols: _dvColsOf([['date', 'date'], ['t_max', 'num', '°C'], ['t_min', 'num', '°C'], ['rain_mm', 'num', 'mm'], ['thunder', 'bool']]),
    rows: function() {
      var w = S.market && S.market.weather;
      if (!w || typeof w !== 'object') return [];
      return Object.keys(w).filter(function(d) { return _dvIso(d) && w[d] && typeof w[d] === 'object'; }).sort().map(function(d) {
        var r = w[d];
        return { date: d, t_max: r.tMax, t_min: r.tMin, rain_mm: r.rain, thunder: typeof r.thunder === 'boolean' ? r.thunder : null };
      });
    } }
};

/* ---------- The reader ---------- */
function _dvDef(name) {
  var d = Object.prototype.hasOwnProperty.call(DV_VIEWS, name) ? DV_VIEWS[name] : null;
  if (!d) throw new Error('dataview: no view named ' + name);
  return d;
}
/* The book state a reading was worked out on (see the head). `prod`: the production record's version counts too. */
function _dvStamp(prod) {
  return { s: S, w: typeof _bookWrites === 'number' ? _bookWrites : 0, v: prod && typeof _prodVer === 'number' ? _prodVer : null, d: localDateStr() };
}
function _dvSame(a, b) { return !!a && !!b && a.s === b.s && a.w === b.w && a.v === b.v && a.d === b.d; }
var _dvCache = {};
function _dvBuilt(name) {
  var def = _dvDef(name);
  if (!S) return Object.freeze([]);
  var at = _dvStamp(!!def.prod), c = _dvCache[name];
  if (c && _dvSame(c.at, at)) return c.rows;
  var rows = Object.freeze((def.rows() || []).map(function(r) { return _dvRow(def.cols, r); }));
  _dvCache[name] = { at: at, rows: rows };
  return rows;
}
/* A view's rows; `where` keeps those it passes: a function of the row, or {col: value} (an array of values is any of them). */
function dvRows(name, where) {
  var rows = _dvBuilt(name);
  if (where == null) return rows;
  var test = typeof where === 'function' ? where : _dvWhere(_dvDef(name), where);
  return rows.filter(function(r) { return !!test(r); });
}
/* A view's columns, a copy each: {name, type, unit} (and, on daily's series, label, grain, dir and needs). */
function dvCols(name) { return _dvDef(name).cols.map(function(c) { return Object.assign({}, c); }); }
/* A small GROUP BY over a view. `by` a column, a list of them, or nothing (one group of every row); `measures` {col: 'sum' |
   'avg' | 'min' | 'max' | 'count'}. Each group: its `by` columns, each measure, `n` (its rows) and `nulls` ({col: rows with
   the column null}, left out of the measure). A measure over nothing known is null, a count 0; money (unit ₹) is rounded by
   gstRound. Groups in the order of their `by` columns, a null last. */
var DV_MEASURES = ['sum', 'avg', 'min', 'max', 'count'];
function dvSum(name, by, measures, where) {
  var def = _dvDef(name), col = {}, keys = by == null ? [] : Array.isArray(by) ? by.slice() : [by], ms = Object.keys(measures || {});
  def.cols.forEach(function(c) { col[c.name] = c; });
  keys.forEach(function(k) { if (!col[k]) throw new Error('dataview: ' + name + ' has no column ' + k); });
  ms.forEach(function(m) {
    var how = measures[m];
    if (!col[m]) throw new Error('dataview: ' + name + ' has no column ' + m);
    if (DV_MEASURES.indexOf(how) < 0) throw new Error('dataview: no measure ' + how);
    if ((how === 'sum' || how === 'avg') && col[m].type !== 'num' && col[m].type !== 'int') throw new Error('dataview: ' + how + ' of ' + m + ', a ' + col[m].type + ' column');
    if (keys.indexOf(m) >= 0) throw new Error('dataview: ' + m + ' is both grouped and measured');
  });
  var groups = {}, order = [];
  var group = function(gk, vals) {
    if (groups[gk]) return groups[gk];
    var g = { vals: vals, n: 0, acc: {} };
    ms.forEach(function(m) { g.acc[m] = { n: 0, nulls: 0, sum: 0, min: null, max: null }; });
    order.push(gk);
    return (groups[gk] = g);
  };
  dvRows(name, where).forEach(function(r) {
    var vals = keys.map(function(k) { return r[k]; }), g = group(JSON.stringify(vals), vals);
    g.n++;
    ms.forEach(function(m) {
      var v = r[m], a = g.acc[m];
      if (v == null) { a.nulls++; return; }
      a.n++;
      if (typeof v === 'number') a.sum += v;
      if (a.min == null || v < a.min) a.min = v;
      if (a.max == null || v > a.max) a.max = v;
    });
  });
  if (!keys.length && !order.length) group('[]', []);
  return order.map(function(gk) {
    var g = groups[gk], o = {};
    keys.forEach(function(k, i) { o[k] = g.vals[i]; });
    ms.forEach(function(m) {
      var a = g.acc[m], how = measures[m];
      var v = how === 'count' ? a.n : !a.n ? null : how === 'sum' ? a.sum : how === 'avg' ? a.sum / a.n : how === 'min' ? a.min : a.max;
      o[m] = how !== 'count' && typeof v === 'number' && col[m].unit === '₹' ? gstRound(v) : v;
    });
    o.n = g.n;
    o.nulls = {};
    ms.forEach(function(m) { o.nulls[m] = g.acc[m].nulls; });
    return { o: o, vals: g.vals };
  }).sort(function(a, b) {
    for (var i = 0; i < a.vals.length; i++) {
      var x = a.vals[i], y = b.vals[i];
      if (x === y) continue;
      if (x == null) return 1;
      if (y == null) return -1;
      return x < y ? -1 : 1;
    }
    return 0;
  }).map(function(x) { return x.o; });
}
function _dvWhere(def, obj) {
  // A key left undefined filters nothing; null matches null.
  var ks = Object.keys(obj).filter(function(k) { return obj[k] !== undefined; });
  ks.forEach(function(k) { if (!def.cols.some(function(c) { return c.name === k; })) throw new Error('dataview: ' + def.name + ' has no column ' + k); });
  return function(r) {
    return ks.every(function(k) { var want = obj[k]; return Array.isArray(want) ? want.indexOf(r[k]) >= 0 : r[k] === want; });
  };
}
/* A row with exactly the view's columns, in order, each in its type: anything else on the raw row is dropped. */
function _dvRow(cols, raw) {
  var o = {};
  cols.forEach(function(c) { o[c.name] = _dvCell(c, raw ? raw[c.name] : null); });
  return Object.freeze(o);
}
function _dvCell(c, v) {
  if (v === undefined || v === null) return null;
  if (c.type === 'num' || c.type === 'int') {
    var n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    if (!isFinite(n)) return null;
    // An integer column reads float noise as the integer it is; a fraction is kept, so a column declared wrong shows itself.
    if (c.type === 'int' && Math.abs(n - Math.round(n)) < 1e-9) n = Math.round(n);
    return c.unit === '₹' ? gstRound(n) : n;
  }
  if (c.type === 'bool') return typeof v === 'boolean' ? v : !!v;
  if (c.type === 'date') return _dvIso(v) ? v : null;
  var s = String(v);
  if (c.unit === 'month') return /^\d{4}-\d{2}$/.test(s) ? s : null;
  return s.trim() === '' ? null : s;
}

/* ---------- What the views share in one book state ---------- */
var _dvShared = null;
function _dvShare(key, fn) {
  var at = _dvStamp(true);
  if (!_dvShared || !_dvSame(_dvShared.at, at)) _dvShared = { at: at, m: {} };
  if (!Object.prototype.hasOwnProperty.call(_dvShared.m, key)) _dvShared.m[key] = fn();
  return _dvShared.m[key];
}
/* The invoices as Stats counts them (statsInvoices: active, net of credit notes), and by id. */
function _dvNetInvoices() {
  return _dvShare('net', function() {
    var list = statsInvoices(), byId = {};
    list.forEach(function(i) { byId[i.id] = i; });
    return { list: list, byId: byId };
  });
}
/* The statement as Money reads it: its rows (bankRows), their classes (bankClassify) and Receivables (bankReceivables). */
function _dvBank() {
  return _dvShare('bank', function() {
    var rows = bankRows(), cls = rows.length ? bankClassify(rows) : [], recv = null;
    return { rows: rows, cls: cls, recv: function() { return recv || (recv = bankReceivables(cls)); } };
  });
}
/* An invoice as Receivables names it (its display number, as bankReceivables' parts do), within its client, → its id. */
function _dvLabels() {
  return _dvShare('labels', function() {
    var out = {};
    (S.invoices || []).forEach(function(i) { if (i.status === 'active') out[String(i.clientId) + '|' + (i.displayNumber || i.invoiceNumber)] = i.id; });
    return out;
  });
}
/* What Receivables says of each invoice, read as the invoice's own detail reads it (finInvoicePayment, which is the role's:
   this is the book's). → function (inv) → {open, on, how} | null where nothing is known. */
function _dvPayIndex() {
  return _dvShare('pay', function() {
    var ctx = _dvBank();
    if (!ctx.rows.length) return function() { return null; };
    var from = bankRecvFrom(ctx.rows), lab = _dvLabels(), seen = {}, by = {};
    var at = function(id) { return by[id] || (by[id] = { pays: [], open: 0 }); };
    ctx.recv().forEach(function(r) {
      var put = function(p, date, how) { var id = p.inv ? lab[String(r.client.id) + '|' + p.label] : null; if (id) at(id).pays.push({ date: date, how: how }); };
      r.allocs.forEach(function(a) { a.parts.forEach(function(p) { put(p, a.v.row.date, a.v.pending ? 'cheque' : a.how); }); });
      (r.credits || []).forEach(function(p) { put(p, null, 'on account'); });
      r.open.forEach(function(o) { if (o.inv) at(o.inv.id).open = gstRound(o.due); });
      seen[String(r.client.id)] = true;
    });
    return function(inv) {
      // Read only as bankReceivables reads it: active, a client in the book, dated from the day receivables start.
      if (inv.status !== 'active' || !_dvIso(inv.date) || inv.date < from || !seen[String(inv.clientId)]) return null;
      var x = by[inv.id] || { pays: [], open: 0 }, last = x.pays.length ? x.pays[x.pays.length - 1] : null, settled = !(x.open > 0.005);
      return { open: x.open, on: settled && last ? last.date : null, how: settled && last ? last.how : null };
    };
  });
}
/* The production record's days: every counted run's line-day, the days any line ran, and the working days from the first
   run to today (a Sunday where the floor worked). */
function _dvProd() {
  return _dvShare('prod', function() {
    var runs = {}, runsDay = {}, first = null, att = S.attendance || {};
    prodIndex().counted.forEach(function(e) {
      if (e.kind !== 'plated' || !e.line || e.qty == null || !_dvIso(e.date)) return;
      runs[e.date + '|' + e.line] = true; runsDay[e.date] = true;
      if (!first || e.date < first) first = e.date;
    });
    var today = localDateStr();
    return { runs: runs, runsDay: runsDay, first: first,
      days: first && first <= today ? _dvDays(first, today, function(d) { return _dvWorked(att[d]) || !!runsDay[d]; }) : [] };
  });
}
/* The plant's efficiency on a day (prodDayEfficiency, with each line's prodLineEfficiency in `lines`), once a book state:
   production_days reads the lines, daily the plant. It is the dearest reading here (each line-day scans the record), so a day
   is read once for both. */
function _dvDayEff(d) { return _dvShare('eff|' + d, function() { return prodDayEfficiency(d); }); }
/* Power's whole reading, once a book state. */
function _dvPower() { return _dvShare('power', powerAnalysis); }
/* The working minutes dark on a day, on the days Power reads a rate over (powerAnalysis' recorded days from the first cut, a
   worked Sunday among them), and never on a day of a run it reads as possibly unreported. → function (day, workedSunday). */
function _dvCutMinutes() {
  return _dvShare('cutMin', function() {
    var a = _dvPower();
    if (!a.first || !a.span) return function() { return null; };
    var rec = {}, quiet = {}, mins = {};
    a.span.days.forEach(function(d) { rec[d] = true; });
    (a.quiet || []).forEach(function(q) { statsWorkingDayList(q.from, q.to).forEach(function(d) { quiet[d] = true; }); });
    a.cuts.forEach(function(c) { mins[c.date] = (mins[c.date] || 0) + (c.cost ? c.cost.inside : 0); });
    return function(d, workedSunday) { return d < a.first || quiet[d] || !(rec[d] || workedSunday) ? null : mins[d] || 0; };
  });
}
/* The overtime and EXTRA of a day as Hours by area places them (areaHoursForRange): its areas' together. */
function _dvHours(d) {
  var ot = 0, extra = 0;
  areaHoursForRange(d, d).rows.forEach(function(r) { ot += r.ot || 0; extra += r.extra || 0; });
  return { ot: ot, extra: extra };
}
/* The floor's number on a day: attDaySummary's complement, which reads an area with no number as 0; null where no floor area
   has a number at all (a complement of 0 set for every area is a day nobody was needed, and stays 0). */
function _dvFloorNeed(d, a) {
  if (a.complement > 0) return a.complement;
  return STAFF_AREAS.some(function(x) { return x.floor && areaNeedOn(d, x.id) != null; }) ? a.complement : null;
}

/* ---------- Small pieces ---------- */
function _dvIso(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
function _dvMonthOf(d) { return _dvIso(d) ? d.slice(0, 7) : null; }
function _dvCmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function _dvRowAt(row) { return row && typeof row.dayIdx === 'number' ? row.dayIdx : 1e9; }
/* Invoices in date order, then by number. */
function _dvByDate(list) {
  return list.slice().sort(function(a, b) { return _dvCmp(a.date || '', b.date || '') || String(a.displayNumber || a.invoiceNumber || '').localeCompare(String(b.displayNumber || b.invoiceNumber || '')); });
}
/* An invoice's tax as issued: its CGST, SGST and IGST. */
function _dvTax(inv) { return gstRound((Number(inv.cgstAmt) || 0) + (Number(inv.sgstAmt) || 0) + (Number(inv.igstAmt) || 0)); }
/* The day an invoice entered its state (invStateSince), a cancelled one its cancelledAt; null where nothing dates it (no stamp
   up to its state and no date: invStateSince would read the clock). */
function _dvStateSince(inv) {
  if (inv.status === 'cancelled' && inv.cancelledAt) return isoOf(new Date(inv.cancelledAt));
  var i = invStateIdx(getInvState(inv)), upto = i >= 0 ? INV_STATES.slice(0, i + 1) : [];
  if (!_dvIso(inv.date) && !upto.some(function(st) { return inv[INV_STATE_AT[st]]; })) return null;
  var t = invStateSince(inv);
  return isFinite(t) ? isoOf(new Date(t)) : null;
}
/* A total shared over parts by their weights, to the paisa, the parts adding to the total exactly: each part's paise rounded
   down, the paise left over to the largest remainders. With no weight at all, evenly. */
function _dvShares(total, weights) {
  var n = weights.length, T = Math.round(gstRound(total) * 100), W = weights.reduce(function(s, w) { return s + w; }, 0);
  if (!n) return [];
  var exact = weights.map(function(w) { return W ? T * w / W : T / n; });
  var base = exact.map(function(x) { return Math.floor(x); }), left = T - base.reduce(function(s, b) { return s + b; }, 0);
  // A part a float left a hair under its whole paisa has the largest remainder, so it is the first given one back.
  var order = exact.map(function(x, i) { return [x - base[i], i]; }).sort(function(a, b) { return b[0] - a[0] || a[1] - b[1]; });
  for (var k = 0; left > 0 && k < n; k++, left--) base[order[k][1]]++;
  for (var j = n - 1; left < 0 && j >= 0; j--, left++) base[order[j][1]]--;
  return base.map(function(p) { return p / 100; });
}
/* The working days from one day to another (Monday to Saturday, a Sunday where `sunday` says so); a span past 4,000 days keeps
   its end, the part every reader shows (periodKeysBetween's rule). */
function _dvDays(from, to, sunday) {
  var out = [], floor = isoAddDays(to, -3999), d = from < floor ? floor : from;
  for (var g = 0; d <= to && g < 4000; g++) {
    if (new Date(d + 'T00:00:00').getDay() !== 0 || (sunday && sunday(d))) out.push(d);
    d = isoAddDays(d, 1);
  }
  return out;
}
/* A day with marks (attDaySummary's `marked`), and one where somebody worked (a present or half-day mark). */
function _dvMarked(rec) { return !!(rec && rec.marks && Object.keys(rec.marks).length); }
function _dvWorked(rec) {
  return !!(rec && rec.marks && Object.keys(rec.marks).some(function(k) { var m = rec.marks[k]; return m && (m.st === 'P' || m.st === 'H'); }));
}
