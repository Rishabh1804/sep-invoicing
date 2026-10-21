/* ===== THE WIDGETS (docs/UI_PASS_3.md §7d, §24f; UI pass 3, U2 and U2R) =====
   One entry a widget (wdgDefine, widgets.js), in the gallery's order: its sections, then the widgets in each. Every figure is its
   screen's, read with the function its screen draws with (I8): a widget never works a figure out a second way.

   Each widget is one of the card family's seven types (§24d) and hands the framework its parts, never a row's markup of its own:
   `data` returns {state, tone, fig, say | sayHtml, detail | detailHtml, …} (§7c), the figure in short money on a board (inrFigHtml,
   §24k) and a rate with its paise; `draw` the type's parts through the builders (wdgLedgerHtml, wdgDocketRowHtml, wdgPlantRowHtml,
   wdgSeatsHtml, wdgMovesHtml, wdgWireHtml, wdgTrayHtml); `viz` a bare chart drawn at the room the card leaves it; `actRow` the Act
   (one tinted button, at most one text button); `source` the Source's facts (§24e). Who sees each is its `needs` (§7g, I4). */

/* The period's figures the questions and the cards read, once a book and a period (statsPulseArgs). */
function wcPulseArgs(per) { return wdgMemo('pulse-args:' + per, function() { return statsPulseArgs(per); }); }
/* The worst of some tones, as a card is coded by the worst of what it holds. */
function wcWorst(tones) {
  return (tones || []).filter(function(t) { return WDG_TONES[t]; }).sort(function(a, b) { return (UI_TONE_RANK[b] || 0) - (UI_TONE_RANK[a] || 0); })[0] || 'neutral';
}
/* A money figure on a board (§24k): short, its exact amount its title, in its tone where the card judges it. */
function wcMoneyFig(v, tone, words) { var h = inrFigHtml(v, words ? { words: words } : null); return tone && tone !== 'neutral' ? figHtml(h, tone) : h; }
/* An amount as the words of a sentence: short (₹3.50 L). */
function wcRs(v) { return inrCard(v).text; }
/* A figure with its unit after it (§24b): 13px in --text-2. */
function wcFigUnit(fig, unit, tone) {
  var f = tone && tone !== 'neutral' ? figHtml(escHtml(String(fig)), tone) : escHtml(String(fig));
  return f + (unit ? '<span class="inv-unit">' + escHtml(unit) + '</span>' : '');
}
/* A day short (16 Oct), a time where it is today (2:30 PM): how fresh a record is, for a Source. */
function wcWhen(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return isoOf(d) === localDateStr() ? homeClockText(d) : stockShortDate(isoOf(d));
}
/* The words for a day: today, yesterday, else its weekday and date. */
function wcDayWord(day) {
  var lag = isoDaysBetween(day, localDateStr());
  return lag <= 0 ? 'Today' : lag === 1 ? 'Yesterday' : attDayName(day) + ' ' + stockShortDate(day);
}
function wcCap(s) { s = String(s || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function wcLc(s) { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); }
/* A month by its whole name (September), its year only where it is not this one (September 2025). */
function wcGstMonth(ym) {
  var y = +String(ym).slice(0, 4), m = +String(ym).slice(5, 7) - 1, now = new Date();
  return (RPT_MONTHS[m] || ym) + (y === now.getFullYear() || (y === now.getFullYear() - 1 && m > now.getMonth()) ? '' : ' ' + y);
}
/* Hours as a person reads them: 8, 7.5. */
function wcHours(h) { return formatNum(h, 1).replace(/\.0$/, ''); }
/* Moves in a dialog (a question's whole list, Do first's longer list): every move a row, each opening as it does on its card. */
function wcMovesOpen(title, moves, key) {
  var body = moves.length ? wdgMovesHtml(moves, false, ' data-adv-deck="' + escHtml(key) + '"') : uiBlankHtml({ kind: 'empty', title: 'Nothing to do here yet' });
  dialogOpen('<div class="inv-dialog" role="dialog" aria-modal="true" aria-label="' + escHtml(title) + '" data-wc-moves="' + escHtml(key) + '">' +
    dialogHeadHtml(title, 'invCloseOverlay', 'Close') + '<div class="inv-dialog-body inv-wc-moves">' + body + '</div></div>', { dismiss: true });
}

/* ---------- Money (Ledger: a bank statement, a ledger page) ---------- */
/* The one blank state the money cards share while no statement is imported: its Act imports one (GST alone reads the invoices). */
function wcNoBank(what) {
  return { state: 'empty', title: 'No bank statement yet', body: 'Import the bank’s .xls or .xlsx: ' + what + ' read from it.', act: { label: 'Import a statement', action: 'invHomeImportBank' } };
}
/* The statement's last day and how old it is: the Source's first fact on every money card. */
function wcBankDay() { var rows = typeof bankRows === 'function' ? bankRows() : []; return rows.length ? rows[rows.length - 1].date : null; }
function wcBankSrc() { var d = wcBankDay(); return d ? 'Bank statement to ' + stockShortDate(d) : 'No bank statement'; }

wdgDefine({ id: 'money', title: 'Money at a glance', q: 'Where does the money stand?', section: 'money', type: 'ledger', sizes: ['m'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'overview' },
  data: function() {
    var o = finHomeOpts();
    if (o.none) return Object.assign(wcNoBank('the balance, what is owed and the forecast are'), { attrs: o.attrs });
    return wdgFromHero(o, { tiles: o.tiles, age: o.age, sayTone: o.owedTone || 'ok' });
  },
  // Its age bar, then its tiles in short money, each opening its tab.
  draw: function(d) { return (d.viz ? '<div class="inv-widget-viz">' + d.viz + '</div>' : '') + d.tiles; },
  // Import a statement only while the one in hand is over a week old (§24f: it had shown with a statement in).
  actRow: function(d) { return d.age > 7 ? { tint: { label: 'Import a statement', action: 'invHomeImportBank' } } : null; },
  source: function(d) { return { facts: [wcBankSrc(), d.age > 7 ? d.age + ' days old' : 'clients at their own pace'] }; } });

/* Cash and its low point: the Overview's Cash hero read (finCashRead: the balance, the forecast's low point, the tone). Small, the
   balance and its low point; Medium, the forecast's 60 days as statement lines that add up (the balance, what comes in and goes
   out, the balance at their end: summed from finForecast's own days); Large, its chart beside them, bare. */
wdgDefine({ id: 'cash', title: 'Cash and its low point', short: 'Cash', q: 'Will the account dip below zero, and when?', section: 'money', type: 'ledger', icon: 'bank', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'overview' },
  data: function(ctx) {
    if (!finHasBank()) return wcNoBank('the balance and the forecast are');
    var c = wdgMemo('wc-cash|' + localDateStr(), function() { return finCashRead(null, finCtx().cls); });
    if (!c) return wcNoBank('the balance and the forecast are');
    var fc = c.fc, last = c.last;
    // The low point with its date: the line, unless the account is overdrawn or dips below zero, which the hero's title says first.
    // The forecast's low starts at today's balance, so a low on today is the balance itself: nothing lower comes in the 60 days.
    var low = fc && fc.min.date !== localDateStr() ? 'Lowest ' + wcRs(fc.min.bal) + ' on ' + stockShortDate(fc.min.date) : 'No lower in the 60 days ahead';
    var say = last.balance >= 0 && fc && !fc.cross ? low : c.title;
    var tin = 0, tout = 0;
    if (fc) fc.days.forEach(function(x) { tin += x.in; tout += x.out; });
    // The balance in the card's own tone (the canvas: ₹3.49 L in the ok mark while no lower point is ahead).
    return { state: 'ok', tone: c.tone, c: c, fc: fc, fig: wcMoneyFig(last.balance, last.balance < 0 ? 'danger' : c.tone, ctx.size === 's' ? '' : 'in the bank'), say: say,
      detail: (c.stale > 7 ? 'Statement ' + c.stale + ' days old' : 'In the bank on ' + stockShortDate(last.date)) + (c.held.n ? ' · + ' + wcRs(c.held.amount) + ' in cheques in hand' : ''),
      detailNotSmall: true, detailAttrs: ' data-wdg-opt', sayTone: c.tone, inn: gstRound(tin), out: gstRound(tout) };
  },
  draw: function(d, size) {
    // Small: the forecast's balance over the 60 days as a line at the card's foot, in the card's tone.
    if (size === 's') {
      var fd = d.fc ? d.fc.days.filter(function(x, i, all) { return i % 3 === 0 || i === all.length - 1; }) : [];
      var sp = fd.length >= 2 ? chartSpark(fd.map(function(x) { return x.bal; }), { labels: fd.map(function(x) { return stockShortDate(x.date); }), unit: 'money', dot: false, area: true,
        tone: d.tone === 'neutral' ? '' : d.tone, title: 'The balance over the 60 days ahead: lowest ' + wcRs(d.fc.min.bal) + ' on ' + stockShortDate(d.fc.min.date) }) : '';
      return sp ? '<div class="inv-widget-viz" data-wdg-push>' + sp + '</div>' : '';
    }
    if (!d.fc) return '';
    var fc = d.fc, end = fc.days[fc.days.length - 1];
    var led = wdgLedgerHtml([
      { label: 'In the bank', meta: stockShortDate(fc.asOf), amt: fc.start },
      { label: 'Coming in', meta: 'expected, 60 days', amt: d.inn },
      { label: 'Going out', meta: 'expected, 60 days', amt: -d.out }],
      { label: 'Balance on ' + stockShortDate(end.date), amt: end.bal, tone: end.bal < 0 ? (fc.noInflow ? 'warning' : 'danger') : null }, { attrs: ' data-wc-cash' });
    // Medium: the forecast over the lines (the canvas's), Large beside them.
    return size === 'l' ? wdgColsHtml([led, wdgVizHtml()]) : wdgVizHtml() + led;
  },
  // The forecast drawn bare at the room the card leaves it: the balance every third day, its likely range banded.
  // Plain as the canvas draws it in a card: the line and its band, the days along the foot (the first, the middle, the last); the
  // figures up the side and the points' marks only at Large, each point's figure in its title.
  viz: function(d, size, box) {
    return d.fc ? finForecastChart(d.fc, { bare: true, w: box.w, h: box.h, quiet: true, keyPlain: true, axisY: size === 'l', key: false, maxLabels: size === 'l' ? 5 : 3, labelEnds: true }) : '';
  }, vizAt: ['m', 'l'],
  source: function(d, size) {
    return { facts: [wcBankSrc(), d.fc && d.fc.noInflow ? 'outflows only: no receipt placed yet' : 'each client at its own pace'].concat(size !== 's' ? ['the band is the likely range'] : []) };
  } });

/* Owed to us: Receivables' own reading (bankReceivables through finCtx, finAgeing), judged by its oldest invoice's age and never red
   while a receipt is unplaced (finOwedTone). From Medium the age bar and its four bands, then the clients as statement lines, the rest
   one line, the total ruled (the canvas's); Large three columns: the answer over the bar, the largest debts, the receipts no client
   holds yet, each with what points at a client (its cheque book, an amount that equals open invoices). The Choose at Large orders
   the debts: by client, the largest first; by age, the oldest first. */
wdgDefine({ id: 'owed', title: 'Owed to us, by age', short: 'Owed to us', q: 'How much is owed, and how old is it?', section: 'money', type: 'ledger', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'receipts' },
  choose: { def: 'client', label: 'Show', opts: function() { return [{ v: 'client', label: 'By client' }, { v: 'age', label: 'By age' }]; } },
  data: function() {
    if (!finHasBank()) return wcNoBank('what clients owe is');
    var fx = finCtx(), recv = fx.recv(), from = bankRecvFrom(fx.rows), loose = bankLooseReceipts(fx.cls, from);
    var owed = gstRound(recv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0)), bands = finAgeing(recv);
    var tone = finOwedTone(finOwedOldest(recv)) || 'ok';
    var say = owed < 0.5 ? 'Nothing owed to us' : bands[3].amount > 0.005 ? wcRs(bands[3].amount) + ' over 90 days'
      : bands[2].amount > 0.005 ? wcRs(bands[2].amount) + ' over 60 days' : 'Nothing over 60 days';
    var book = bankBookDaysToPay(bankPayHistory(recv));
    // The client longest past its terms: the reminder the Act sends (the statement and reminder, over its receivables).
    var past = recv.filter(function(r) { return r.owed > 0.005 && r.oldestDays != null; }).map(function(r) { return { r: r, over: r.oldestDays - flowTerms(r.client.id).days }; })
      .filter(function(x) { return x.over > 0; }).sort(function(a, b) { return b.over - a.over || b.r.owed - a.r.owed; })[0] || null;
    // A receipt nobody placed makes what is owed read high: said with the age (the canvas's "₹1.82 L is over 90 days; 21 receipts are
    // not yet placed").
    if (loose.length) say += '; ' + (loose.length === 1 ? '1 receipt is' : loose.length + ' receipts are') + ' not yet placed';
    return { state: 'ok', tone: tone, recv: recv, owed: owed, bands: bands, loose: loose, past: past, from: from,
      fig: wcMoneyFig(owed, tone === 'ok' ? null : tone, 'owed'), say: say, sayTone: loose.length && tone === 'ok' ? 'warning' : tone, headInCol: true,
      detail: loose.length ? '' : ['since ' + stockShortDate(from), book && book.median != null ? 'clients pay in ' + Math.round(book.median) + ' days' : ''].filter(Boolean).join(' · '),
      detailNotSmall: true, detailAttrs: ' data-wdg-opt' };
  },
  draw: function(d, size, ctx) {
    if (size === 's' || d.owed < 0.5) return '';
    var large = size === 'l', byAge = large && ctx.choose === 'age';
    // The age bar and its four bands (short at Medium, whole rupees at Large, as its ledger's lines).
    var bar = '<div class="inv-widget-viz" data-wc-ages>' + chartMeter(d.bands.map(function(b, i) { return { v: b.amount, tone: finAgeTone(i) }; }),
      { title: 'Owed by age: ' + d.bands.map(function(b) { return b.label + ' ' + wcRs(b.amount); }).join(' · ') }) + '</div>' +
      wdgMeterKeyHtml(d.bands.map(function(b, i) { return { label: b.label, amt: b.amount, tone: finAgeTone(i) }; }), { whole: large });
    var owing = d.recv.filter(function(r) { return r.owed > 0.005; })
      .sort(byAge ? function(a, b) { return (b.oldestDays || 0) - (a.oldestDays || 0) || b.owed - a.owed; } : function(a, b) { return b.owed - a.owed; });
    var debts = wdgLedgerHtml(owing.map(function(r) {
      return { label: r.client.name, meta: r.oldestDays != null ? 'oldest ' + todoPlural(r.oldestDays, 'day') : '', amt: r.owed, tone: finOwedTone(r.oldestDays),
        go: { action: 'invFinGo', attrs: ' data-tab="receipts" data-client="' + escHtml(String(r.client.id)) + '"' }, attrs: ' data-wc-client="' + escHtml(String(r.client.id)) + '"' };
    }), { label: 'Owed to us', amt: d.owed }, { noun: 'client' });
    if (!large) return bar + debts;
    // Large: the receipts no client holds yet, newest first, each with what points at a client, each opening them on Receivables.
    var recv = d.recv, series = bankChequeSeries(finCtx().cls);
    var loose = d.loose.slice().sort(function(a, b) { return b.row.date.localeCompare(a.row.date); });
    var rows = loose.length ? '<p class="inv-widget-cap">Receipts not yet placed</p>' + wdgBriefRowsHtml(loose.map(function(v) {
      var inst = bankIsChequeDeposit(v.row) ? bankInstrument(v.row) : '', o = bankPlacementOffers(v.row, recv, series), hint = '';
      if (o.both) hint = 'series and amount: ' + wcClientShort(o.both.name);
      else if (o.series) hint = 'series of ' + wcClientShort(o.series.client.name);
      else if (o.amount) hint = 'equals ' + o.amount.labels.length + ' of ' + wcClientShort(o.amount.client.name) + '’s invoices';
      // Its sum in whole rupees, as a Ledger's lines.
      return { title: /^\d{4,}$/.test(inst) ? 'Cheque ' + inst : bankRowTitle(v) || 'From a payee not known', meta: [stockShortDate(v.row.date), hint].filter(Boolean).join(' · '),
        value: wdgLedgerFmt(v.row.cr), go: { action: 'invFinGo', attrs: ' data-tab="receipts" data-anchor="bankLoose"' } };
    }), ' data-noun="receipt"') : '';
    return wdgColsHtml([bar, '<p class="inv-widget-cap">The largest debts</p>' + debts, rows], { drop: 2 });
  },
  actRow: function(d) {
    return { tint: d.loose.length ? { label: 'Place the ' + todoPlural(d.loose.length, 'receipt'), action: 'invFinGo', attrs: ' data-tab="receipts" data-anchor="bankLoose"' } : null,
      text: d.past ? { label: 'Send a reminder', jump: { kind: 'soa', client: d.past.r.client.id } } : null };
  },
  source: function() { return { facts: [wcBankSrc(), 'receipts set oldest first', 'age from the invoice date'] }; } });

/* Days to pay, against terms: each client's days from invoice to receipt by value (bankDaysToPay; three receipts or more, as the
   forecast trusts a client's own), against its payment terms (flowTerms), judged as the flow's payment step judges them
   (flowPayTone). Small, the book's median and a gauge of it against the plant's terms; from Medium, the clients most past their
   terms as a dumbbell, bare. */
var WC_DTP_MIN = 3;
wdgDefine({ id: 'dtp', title: 'Days to pay, against terms', short: 'Days to pay', q: 'Who pays on time, who is slipping?', section: 'money', type: 'ledger', icon: 'dtp', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'receipts' },
  data: function(ctx) {
    if (!finHasBank()) return wcNoBank('days to pay are');
    var recv = finCtx().recv(), hist = bankPayHistory(recv), book = bankBookDaysToPay(hist);
    if (!book || book.median == null) return { state: 'early', title: 'No receipt set against an invoice yet',
      body: 'Days to pay read each receipt against the invoices it paid; a client is judged from three receipts.' };
    var list = recv.map(function(r) {
      var dd = bankDaysToPay(r.client.id, hist);
      if (!dd || dd.n < WC_DTP_MIN || dd.median == null) return null;
      var days = Math.round(dd.median), t = flowTerms(r.client.id);
      return { id: r.client.id, name: r.client.name, days: days, terms: t.days, n: dd.n, over: days - t.days, tone: flowPayTone(days, t.days) };
    }).filter(Boolean).sort(function(a, b) { return b.over - a.over || b.days - a.days || String(a.name).localeCompare(String(b.name)); });
    var days = Math.round(book.median), plant = flowCfg().termsDays, ptone = flowPayTone(days, plant);
    var past = list.filter(function(x) { return x.days > x.terms; }).length;
    // Small: the book's median against the plant's terms, in the terms' own words (the canvas's "Inside the 45-day terms"); from
    // Medium how many clients are past their own.
    var small = ctx.size === 's';
    return { state: 'ok', tone: small ? ptone || 'neutral' : list.length ? wcWorst(list.map(function(x) { return x.tone; })) : ptone || 'neutral', list: list, days: days, plant: plant, noViz: !list.length,
      fig: wcFigUnit(days, 'days', ptone),
      say: small ? (days <= plant ? 'Inside the ' + plant + '-day terms' : todoPlural(days - plant, 'day') + ' past the ' + plant + '-day terms')
        : list.length ? past + ' of ' + todoPlural(list.length, 'client') + ' past their terms' : 'No client has ' + WC_DTP_MIN + ' receipts yet',
      sayTone: small ? ptone || 'neutral' : past ? (list.some(function(x) { return x.tone === 'danger'; }) ? 'danger' : 'warning') : 'ok',
      detail: 'The median by value, against ' + plant + '-day terms', detailNotSmall: true };
  },
  draw: function(d, size) {
    // Small, and any size with no client judged yet: the median against the plant's terms, the mark at the terms, its key under it.
    if (size !== 's' && d.list.length) return '';
    return wdgGaugeHtml({ v: d.days, tone: flowPayTone(d.days, d.plant) || 'neutral', max: Math.max(d.days, d.plant) * 1.25, mark: d.plant,
      title: 'Clients pay in ' + d.days + ' days; the mark is the ' + d.plant + '-day terms', left: { l: 'Median, by value', s: 'median' }, right: 'terms ' + d.plant });
  },
  // Each client judged, its terms against what it pays in, bare at the room the card leaves.
  viz: function(d, size, box) {
    return chartDumbbell(d.list.map(function(x) { return { key: String(x.id), label: x.name, a: x.terms, b: x.days, tone: x.tone }; }),
      { aLabel: 'Terms', bLabel: 'Pays in', labelHead: 'Client', unit: 'count', ariaLabel: 'Days to pay against terms', bare: true, w: box.w, h: box.h });
  }, vizAt: ['m', 'l'],
  source: function() { return { facts: ['Receipts set against invoices', 'a client judged from ' + WC_DTP_MIN + ' receipts'] }; } });

/* GST due against paid: the GST tab's own months (finGstByMonth) and each one's reading (finGstStatus, in the GST hero's words,
   finGstSay); it reads the invoices, so it says what is due with no statement too. Small, last month's due, its status and the
   month before as one statement line; Medium, six months as a chart, bare; Large, twelve, and the months noted or not in the bank
   as statement lines beside it. A card takes the tone of the worst month it holds. */
wdgDefine({ id: 'gst', title: 'GST due against paid', short: 'GST', q: 'Is every month’s return paid?', section: 'money', type: 'ledger', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'gst' },
  data: function(ctx) {
    if (!(S.invoices || []).some(function(i) { return i.status === 'active'; })) return { state: 'empty', title: 'Nothing invoiced yet',
      body: 'GST due reads from the invoices, and what was paid from the bank statement.' };
    var cls = finHasBank() ? finCtx().cls : [], two = finGstByMonth(insMonthsBack(2), cls), last = two[two.length - 1], prev = two.length > 1 ? two[0] : null, say = finGstSay(last);
    var months = finMonths(ctx.size === 'l' ? 12 : 6), g = finGstByMonth(months, cls);
    // The latest month the bank shows no payment for and nobody has noted: the Act's note.
    var miss = g.slice().reverse().filter(function(x) { return !x.note && finGstStatus(x).missing; })[0] || (!last.note && finGstStatus(last).missing ? last : null);
    // The month named in the verdict (the canvas's "September's, due by 20 Oct"); a month with nothing due says so its own way.
    var said = last.due > 0 ? wcGstMonth(last.month) + '’s, ' + wcLc(say.title) : say.title;
    return { state: 'ok', tone: ctx.size === 's' ? say.tone : wcWorst(g.map(function(r) { return finGstSay(r).tone; }).concat([say.tone])),
      last: last, prev: prev, months: months, g: g, miss: miss, fig: wcMoneyFig(last.due), say: said, sayTone: say.tone,
      detail: last.paid > 0 ? 'Paid ' + wcRs(last.paid) : '', detailNotSmall: true };
  },
  draw: function(d, size) {
    if (size === 's') {
      if (!d.prev) return '';
      // The month before as one statement line, in words (the canvas's "August, paid").
      var ps = finGstStatus(d.prev);
      return wdgLedgerHtml([{ label: wcGstMonth(d.prev.month) + ', ' + wcLc(ps.text), amt: d.prev.due, attrs: ' data-wc-gst="' + escHtml(d.prev.month) + '"' }], null, { attrs: ' data-wdg-push' });
    }
    if (size !== 'l') return '';
    // Large: the months noted (a return paid another way) and the months not in the bank, newest first, beside the chart.
    var back = d.g.slice().reverse().filter(function(x) { return x.note || finGstStatus(x).missing; });
    if (!back.length) return '';
    return wdgColsHtml([wdgVizHtml(), '<p class="inv-widget-cap">Notes and months not in the bank</p>' +
      wdgLedgerHtml(back.map(function(x) {
        return { label: billsMonthLabel(x.month), meta: finGstStatus(x).text, amt: x.due, tone: x.note ? null : 'warning', attrs: ' data-wc-gst="' + escHtml(x.month) + '"',
          go: { jump: { kind: 'finance', tab: 'gst', gstMonth: x.month } } };
      }), null, { noun: 'month' })]);
  },
  // Due against paid month by month, grouped bars, drawn bare at the room the card leaves.
  viz: function(d, size, box) { return finGstMonthsChart(d.months, d.g, { bare: true, w: box.w, h: box.h }); }, vizAt: ['m', 'l'],
  actRow: function(d) { return d.miss ? { tint: { label: 'Add a note for ' + billsMonthLabel(d.miss.month), jump: { kind: 'finance', tab: 'gst', gstMonth: d.miss.month } } } : null; },
  source: function() { return { facts: ['Invoices and notes', finHasBank() ? 'paid read off the bank statement to ' + stockShortDate(wcBankDay()) : 'no bank statement: paid not read'] }; } });


/* ---------- Office (Docket: documents in motion; the month's Ledgers) ---------- */
/* Month to date: Home's month tiles (homeMtdOpts: billing against the same days last month, realisation against the cost). Small,
   what is billed and its months before as small bars, this month to date hatched; Medium, the four tiles; Large, each tile's line of
   the months before. */
wdgDefine({ id: 'mtd', title: 'Month to date', short: 'Month to date', q: 'How is the month going?', section: 'office', type: 'ledger', icon: 'invoice', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageRegister', money: true }, go: { tab: 'pageRegister' },
  data: function(ctx) {
    var o = homeMtdOpts(homeMonthInvoices(), { viz: ctx.size === 'l' });
    // Small: coded by its billing's change alone, said without the word the card's title already is (the canvas's "Level with the
    // same days last month"); from Medium the worse of billing and realisation.
    var tone = ctx.size === 's' ? (WDG_TONES[o.revTone] ? o.revTone : 'neutral') : WDG_TONES[o.tone] ? o.tone : 'neutral';
    // A Small's verdict is two short lines: a whole percent ("22% behind the same days last month").
    var say = ctx.size === 's' ? o.title.replace(/^Billing (\S)/, function(m, c) { return c.toUpperCase(); })
      .replace(/(\d+\.\d+)%/, function(m, n) { return Math.round(parseFloat(n)) + '%'; }) : o.title;
    return { state: 'ok', tone: tone, o: o, fig: wcMoneyFig(o.rev, ctx.size === 's' ? o.revTone : null), sayHtml: say, sayTone: tone, detailHtml: o.sub, detailNotSmall: true,
      detailAttrs: ' data-wdg-opt', attrs: o.attrs };
  },
  draw: function(d, size) {
    if (size !== 's') return d.o.tiles;
    // The months before as small bars, last month the one the figure is set against (dark), this month to date hatched (§24f).
    var hist = homeMonthsBack(6), month = TREND_MONTH_LABELS[new Date().getMonth()];
    var bars = hist.map(function(x, i) { return { v: x.rev, label: x.label, text: formatCurrency(x.rev), on: i === hist.length - 1 }; })
      .concat([{ v: d.o.rev, label: month + ' to date', text: formatCurrency(d.o.rev), todate: true, hatch: true }]);
    return '<div class="inv-widget-viz" data-wdg-push>' + chartMiniBars(bars, { title: 'Billed by month: ' + bars.map(function(b) { return b.label + ' ' + wcRs(b.v); }).join(' · ') }) + '</div>';
  },
  source: function(d) { return { facts: ['Invoices, ' + d.o.span, 'net of credit notes'] }; } });

/* Unbilled challans: what IM lists under Awaiting invoice (pipeAwaitingChallans, oldest first), judged as Pipeline judges its first
   stage (imWaitTone, the late counted as pipeStages counts them). Small, how many to bill, how many have waited past the days set,
   and each challan's wait as a pip, the newest first; Medium, the same over register rows, the oldest first, each with its step on
   the floor and Create invoice at its end. */
/* The step a challan stands at on its way (flowLines' stage of its least advanced open line): pickling once received, plating once
   pickled, its invoice once plated. Where the floor's record cannot say (open, or no line), it stands at pickling and its words say
   nothing of the floor. */
var WC_CHALLAN_AT = { waiting: 1, open: 1, pickled: 2, plated: 3 };
function wcChallanAt(im) {
  var at = null, known = false;
  flowLines().forEach(function(x) {
    if (x.m !== im || !x.row || !x.stage) return;
    var k = WC_CHALLAN_AT[x.stage];
    if (k != null && (at == null || k < at)) { at = k; known = x.stage !== 'open'; }
  });
  return { at: at == null ? 1 : at, known: at != null && known };
}
var WC_CHALLAN_AT_WORD = ['', 'pickling', 'plating', ''];
var WC_CHALLAN_AT_SAY = ['', 'waiting to be pickled', 'pickled, waiting to be plated', 'plated, waiting for its invoice'];
/* A challan's open lines and what they hold, by unit: "3 lines · 412 kg", "1 line · 1,240 pieces". */
function wcChallanHolds(im) {
  var kg = 0, nos = 0, n = 0;
  (im.items || []).forEach(function(it) {
    var o = imLineOpen(it);
    if (!(o.qty > 0) && !(o.amount > 0)) return;
    n++;
    if (it.unit === 'NOS') nos += o.qty; else kg += o.qty;
  });
  var q = [kg > 0 ? formatNum(kg, kg % 1 ? 1 : 0) + ' kg' : '', nos > 0 ? formatNum(nos, 0) + ' pieces' : ''].filter(Boolean).join(', ');
  return [todoPlural(n, 'line'), q].filter(Boolean).join(' · ');
}
var WC_CHALLAN_KEY = ['Received', 'Pickled', 'Plated', 'Invoiced'];
function wcChallanRowHtml(im, act) {
  var age = imWaitDays(im), tone = imWaitTone(age), st = wcChallanAt(im);
  var wait = age == null ? 'no challan date' : imDatedAhead(im) ? 'dated ' + stockDayLabel(im.challanDate) : age === 0 ? 'received today' : pipeDays(age);
  var word = st.known ? WC_CHALLAN_AT_WORD[st.at] : '', age2 = wait + (word ? ', ' + word : '');
  // On the desktop the steps stand mid-row with the age under them (the canvas); a phone's row has no room for a third column, and
  // its age leads the meta.
  var got = [im.challanDate ? 'Received ' + stockShortDate(im.challanDate) : '', wcChallanHolds(im)].filter(Boolean);
  return wdgDocketRowHtml({ num: im.challanNo ? 'CH ' + im.challanNo : 'CH ?', party: im.clientName || 'No client',
    meta: (_isDesktop ? got : [age2].concat(got)).join(' · '), mid: _isDesktop, stepsText: age2,
    steps: { n: 4, at: st.at, tone: tone, say: 'Challan ' + (im.challanNo || '') + ': ' + (st.known ? WC_CHALLAN_AT_SAY[st.at] : 'received; the floor’s record does not say how far it has gone') + ', ' + wait },
    go: { action: 'invPipeChallan', attrs: ' data-id="' + escHtml(im.id) + '"', label: 'Challan ' + (im.challanNo || '') + ', ' + (im.clientName || '') },
    act: act, attrs: ' data-wc-challan="' + escHtml(im.id) + '"' });
}
/* Pips past a strip's room fold into it, each run of one tone given its share (and at least one), so a long list's late ones are
   still seen in their proportion. */
function wcPipsFold(tones, max) {
  if (tones.length <= max) return tones;
  var runs = [];
  tones.forEach(function(t) { var r = runs[runs.length - 1]; if (r && r.t === t) r.n++; else runs.push({ t: t, n: 1 }); });
  var give = runs.map(function(r) { var x = r.n * max / tones.length; return { r: r, k: Math.max(1, Math.floor(x)), f: x - Math.floor(x) }; });
  var left = max - give.reduce(function(s, g) { return s + g.k; }, 0);
  give.slice().sort(function(a, b) { return b.f - a.f; }).forEach(function(g) { if (left > 0) { g.k++; left--; } });
  while (left < 0) { var big = give.reduce(function(m, g) { return g.k > m.k ? g : m; }); big.k--; left++; }
  var out = [];
  give.forEach(function(g) { for (var i = 0; i < g.k; i++) out.push(g.r.t); });
  return out;
}
wdgDefine({ id: 'unbilled', title: 'Unbilled challans', short: 'Unbilled', shortDesk: 'Unbilled challans', q: 'What is waiting to be invoiced?', section: 'office', type: 'docket', sizes: ['s', 'm'],
  needs: { page: 'pageIM' }, go: { tab: 'pageIM', v: 'awaiting' },
  data: function(ctx) {
    var all = S.incomingMaterial || [], ims = pipeAwaitingChallans();
    if (!all.length) return { state: 'empty', title: 'No challan recorded yet', body: 'A challan received is recorded on Challans.',
      act: { label: 'Add challan', action: 'invHomeQuick', attrs: ' data-go="challan"' }, attrs: ' data-card="unbilled-pulse"' };
    var latest = all.reduce(function(m, im) { return !m || (im.createdAt || 0) > (m.createdAt || 0) ? im : m; }, null);
    var base = { state: 'ok', ims: ims, latest: latest, attrs: ' data-card="unbilled-pulse"' };
    if (!ims.length) return Object.assign(base, { tone: 'ok', fig: wcFigUnit(0, 'to bill'), say: 'Everything received is invoiced', sayTone: 'ok' });
    // The late, as Pipeline's first stage counts them: those past twice the days set where any is, else those past the days set.
    var amberD = todoCfg().challanDays, ages = ims.map(imWaitDays), tones = ages.map(imWaitTone);
    var red = tones.filter(function(t) { return t === 'danger'; }).length, amber = tones.filter(function(t) { return t === 'warning'; }).length;
    var late = red || amber, tone = red ? 'danger' : amber ? 'warning' : 'neutral';
    var oldest = ages.reduce(function(m, a) { return a != null && (m == null || a > m) ? a : m; }, null);
    var amt = gstRound(ims.reduce(function(t, im) { return t + imChallanOpenTotal(im); }, 0)), money = wdgSeesMoney();
    var say = late ? late + (late === 1 ? ' has' : ' have') + ' waited over ' + pipeDays(red ? amberD * 2 : amberD)
      : imDatedAhead(ims[0]) ? 'The oldest is dated ' + stockDayLabel(ims[0].challanDate) : oldest == null ? 'The oldest has no challan date'
      : oldest === 0 ? 'All came in today' : 'The oldest has waited ' + pipeDays(oldest);
    return Object.assign(base, { tone: tone, say: say, sayTone: tone, tones: tones, amt: amt, oldest: oldest, red: red, amber: amber,
      fig: wcFigUnit(ims.length, ctx.size !== 's' && money ? 'to bill, ' + wcRs(amt) : 'to bill') });
  },
  draw: function(d, size) {
    if (!d.ims.length) return '';
    if (size === 's') {
      // Each challan a pip in its wait's tone, the newest first and the oldest last; past twenty they fold into twenty.
      var tones = wcPipsFold(d.tones.slice().reverse().map(function(t) { return t === 'neutral' ? 'ok' : t; }), 20);
      var n = d.ims.length, ok = n - d.red - d.amber, a = todoCfg().challanDays;
      var say = todoPlural(n, 'challan') + ' to bill: ' + [ok ? ok + ' under ' + pipeDays(a) : '', d.amber ? d.amber + ' over ' + pipeDays(a) : '', d.red ? d.red + ' over ' + pipeDays(a * 2) : '']
        .filter(Boolean).join(', ');
      return wdgPipsHtml(tones.map(function(t) { return { tone: t }; }), say, wdgSeesMoney() ? wcRs(d.amt) + ' on them' : todoPlural(n, 'challan'), pipeOldestWord(d.oldest));
    }
    return '<div class="inv-docket" data-wdg-list data-noun="challan" data-nums="challan">' + wdgDocketKeyHtml(WC_CHALLAN_KEY, 'The oldest first') + d.ims.map(function(im) {
      return wcChallanRowHtml(im, { label: 'Create invoice', jump: { kind: 'createFor', clientId: im.clientId, ims: [im.id] } });
    }).join('') + '</div>';
  },
  source: function(d) {
    var a = todoCfg().challanDays;
    return { facts: ['Challans to ' + wcWhen(d.latest && d.latest.createdAt), 'amber at ' + a + ' days, red at ' + a * 2] };
  } });

/* Recent invoices: the invoices made this pay week, newest first (homeRecentInvoices; the latest six where the week holds fewer),
   each a register row: its number, its client, where it stands in words (made, printed, dispatched, delivered and when), its amount
   and its state as steps, its Print at its end (owner, 6 Oct 2026: four taps to print a recent invoice; §1a-16). The figure is what
   was made today (else this week) and what it bills; the verdict the invoices waiting on a step, printed and not yet dispatched
   first: Mark them dispatched is the Act. */
var WC_INV_KEY = ['Created', 'Printed', 'Dispatched', 'Delivered', 'Filed'];
/* Where an invoice stands, in words: "Today 1:12 PM · challan 852", "Printed yesterday · 1 day", "Delivered 14 Oct · GSTR-1 by 11 Nov". */
function wcInvoiceMeta(inv, now) {
  if (inv.status === 'cancelled') return 'Cancelled' + (inv.cancelledAt ? ' ' + wcLc(wcDayWord(isoOf(new Date(inv.cancelledAt)))) : '');
  var st = getInvState(inv), since = invStateSince(inv), day = isoOf(new Date(since)), days = invStateDays(inv, now);
  var ch = String(inv.challanNo || '').trim(), challan = ch ? (/[,&+]/.test(ch) ? 'challans ' : 'challan ') + ch : '';
  if (st === 'created') {
    if (day === localDateStr() && inv.createdAt) return ['Today ' + homeClockText(new Date(inv.createdAt)), challan].filter(Boolean).join(' · ');
    return ['Made ' + wcLc(wcDayWord(day)), days ? pipeDays(days) : '', challan].filter(Boolean).join(' · ');
  }
  var when = (INV_STATE_LABELS[st] || st) + ' ' + wcLc(wcDayWord(day));
  if (st === 'delivered') { var due = invFileDue(inv); return when + (due ? ' · GSTR-1 by ' + stockShortDate(isoOf(due)) : ''); }
  if (st === 'filed') return when;
  return when + (days ? ' · ' + pipeDays(days) : '');
}
function wcInvoiceRowHtml(inv, now, act) {
  var st = getInvState(inv), at = INV_STATES.indexOf(st), cancelled = inv.status === 'cancelled';
  return wdgDocketRowHtml({ num: inv.displayNumber || '', party: inv.clientName || '', meta: wcInvoiceMeta(inv, now),
    amt: inv.grandTotal || 0, steps: cancelled || at < 0 ? null : { n: 5, at: at, tone: invStateTone(inv, now), say: (INV_STATE_LABELS[st] || st) + (invStateAgeText(inv) ? ' · ' + invStateAgeText(inv) : '') },
    go: { action: 'invViewInvoiceDetail', attrs: ' data-id="' + escHtml(inv.id) + '"', label: (inv.displayNumber || '') + ', ' + (inv.clientName || '') },
    act: act || { label: 'Print', action: 'invPreviewInvoice', attrs: ' data-id="' + escHtml(inv.id) + '" aria-label="' + escHtml('Print ' + (inv.displayNumber || '')) + '"' },
    attrs: ' data-recent-inv="' + escHtml(inv.id) + '"' + (cancelled ? ' data-cancelled' : '') });
}
/* The invoices waiting on a step, in the card's words: printed and not yet dispatched, else made and not yet printed. */
function wcRecentWaiting(now) {
  var say = function(list, did, not) {
    var days = list.map(function(i) { return isoOf(new Date(invStateSince(i))); }), one = days.every(function(x) { return x === days[0]; });
    return list.length + ' ' + did + (one ? ' ' + wcLc(wcDayWord(days[0])) : '') + (list.length === 1 ? ' is' : ' are') + ' not yet ' + not;
  };
  var tone = function(list) { return wcWorst(list.map(function(i) { return invStateTone(i, now); })) || 'neutral'; };
  var printed = pipeInvoices('printed'), created = pipeInvoices('created');
  if (printed.length) return { say: say(printed, 'printed', 'dispatched'), tone: tone(printed) };
  if (created.length) return { say: say(created, 'made', 'printed'), tone: tone(created) };
  return { say: 'Every invoice made is dispatched', tone: 'ok' };
}
wdgDefine({ id: 'recent', title: 'Recent invoices', q: 'What went out last?', section: 'office', type: 'docket', sizes: ['m', 'l'],
  needs: { page: 'pageRegister' }, go: { tab: 'pageRegister' },
  data: function(ctx) {
    var all = S.invoices || [];
    if (!all.length) return { state: 'empty', title: 'No invoices yet', body: 'An invoice is made on Create, from a client’s challans or by hand.',
      act: { label: 'Create your first invoice', action: 'invCreateNew' }, attrs: ' data-card="recent-pulse"' };
    var now = Date.now(), today = localDateStr(), wk = attWeekStartOf(today);
    var made = function(from) { return all.filter(function(i) { return i.date >= from && i.date <= today && i.status !== 'cancelled'; }); };
    var day = made(today), week = made(wk), shown = day.length ? day : week;
    var sum = gstRound(shown.reduce(function(t, i) { return t + (i.grandTotal || 0); }, 0));
    // The week's invoices, the newest first; the latest six where the week holds fewer.
    var mine = homeRecentInvoices(40), inWeek = mine.filter(function(i) { return (i.date || '') >= wk; });
    var list = inWeek.length >= 6 ? inWeek.slice(0, 30) : mine.slice(0, ctx.size === 'l' ? 10 : 6);
    var w = wcRecentWaiting(now);
    return { state: 'ok', tone: w.tone, list: list, week: inWeek.length >= 6, attrs: ' data-card="recent-pulse"', printed: pipeInvoices('printed'),
      fig: wcFigUnit(shown.length, (day.length || !week.length ? 'made today' : 'made this week') + (shown.length && wdgSeesMoney() ? ', ' + wcRs(sum) : '')),
      say: w.say, sayTone: w.tone };
  },
  draw: function(d) {
    var now = Date.now();
    return '<div class="inv-docket" id="recentInvoices" data-wdg-list data-noun="invoice" data-nums="invoice"' + (d.week ? ' data-more="this week"' : '') + '>' +
      wdgDocketKeyHtml(WC_INV_KEY) + d.list.map(function(inv) { return wcInvoiceRowHtml(inv, now); }).join('') + '</div>';
  },
  actRow: function(d) {
    var p = d.printed || [];
    return { tint: p.length ? { label: 'Mark the ' + p.length + ' dispatched', jump: { kind: 'regState', state: 'printed', ids: p.map(function(i) { return i.id; }) } } : null,
      text: { label: 'New invoice', action: 'invCreateNew' } };
  } });

/* Quick actions: keys on a sunk tray, each opening its screen already on the job, by the page each opens (the guard's map,
   GRD_QUICK_PAGE): three at Small (two on the phone's: New invoice and Paste), six at Medium, where what was started here and not
   saved is listed with Continue (§1a-19: an invoice typed on Create). */
var WC_QUICK = [
  { label: 'New invoice', tiny: 'Invoice', icon: 'invoice', page: 'pageCreate', action: 'invCreateNew', phone: true },
  { label: 'New challan', icon: 'challan', page: 'pageIM', go: 'challan' },
  { label: 'Paste message', narrow: 'Paste', icon: 'message', page: 'pageStaff', go: 'paste', phone: true },
  { label: 'Stock entry', icon: 'boxPlus', page: 'pageStock', go: 'stock' },
  { label: 'Attendance', icon: 'attendance', page: 'pageStaff', go: 'attendance' },
  { label: 'Add task', icon: 'task', page: 'pageHome', go: 'task' }
];
/* What was started here and not saved (the canvas's Tools board), each with Continue: the invoice on Create (its form stays as typed
   when the app leaves it) and the register pages this person typed on Mine and kept on this device (faceVatDrafts). */
function wcQuickHeld() {
  var out = [];
  if (typeof createFormHasWork === 'function' && createFormHasWork() && (typeof grdSees !== 'function' || grdSees('pageCreate'))) {
    var f = invoiceForm, c = f.clientId ? (S.clients || []).find(function(x) { return x.id === f.clientId; }) : null;
    var num = f.editingId ? ((S.invoices.find(function(i) { return i.id === f.editingId; }) || {}).displayNumber || '') : '';
    out.push({ title: f.editingId ? 'Changes to invoice ' + num : 'An invoice' + (c ? ' for ' + c.name : ''), meta: todoPlural((f.items || []).length, 'line') + ' · on Create',
      act: { label: 'Continue', action: 'invSwitchTab', attrs: ' data-tab="pageCreate"' }, attrs: ' data-wc-held="create"' });
  }
  var u = typeof faceUser === 'function' ? faceUser() : null, uid = u && u.id || '';
  if (uid && typeof faceVatDrafts === 'function' && typeof faceSees === 'function' && faceSees()) {
    var d = faceVatDrafts(), today = localDateStr();
    Object.keys(d).filter(function(k) { return k.split('|')[0] === uid && d[k]; }).sort().reverse().slice(0, 3).forEach(function(k) {
      var parts = k.split('|'), day = parts[1], line = parts[2], at = d[k].at;
      var lineName = typeof prodLineName === 'function' ? prodLineName(line) : line;
      var typed = at ? (isoOf(new Date(at)) === today ? 'Typed at ' + homeClockText(new Date(at)) : 'Typed ' + stockShortDate(isoOf(new Date(at)))) + ' on this device' : 'Kept on this device';
      out.push({ title: 'The ' + lineName + ' page for ' + (day === today ? 'today' : stockShortDate(day)), meta: typed,
        act: { label: 'Continue', action: 'invWdgHeldVat', attrs: ' data-wid="quick" data-day="' + escHtml(day) + '" data-line="' + escHtml(line) + '"' }, attrs: ' data-wc-held="vat"' });
    });
  }
  return out;
}
wdgDefine({ id: 'quick', title: 'Quick actions', short: 'Quick actions', q: 'What do I start?', section: 'office', type: 'tools', icon: 'zap', sizes: ['s', 'm'], card: 'quick',
  arrive: true,
  data: function() {
    var list = WC_QUICK.filter(function(a) { return typeof grdSees !== 'function' || grdSees(a.page); });
    if (!list.length) return { state: 'empty', title: 'Nothing to start here for your ID' };
    return { state: 'ok', tone: 'neutral', list: list };
  },
  draw: function(d, size) {
    var small = size === 's', phone = !_isDesktop;
    var keys = small && phone ? d.list.filter(function(a) { return a.phone; }).slice(0, 2) : d.list.slice(0, small ? 3 : 6);
    if (small && phone && keys.length < 2) keys = d.list.slice(0, 2);
    // A key's word as the room allows (the canvas: "Invoice" on a phone's Small, "Paste" wherever a key is narrow).
    var word = function(a) { return (small && phone && a.tiny) || ((small || phone) && a.narrow) || a.label; };
    var h = wdgTrayHtml(keys.map(function(a) { return { label: word(a), title: a.label, icon: a.icon, action: a.action || 'invHomeQuick', attrs: a.go ? ' data-go="' + a.go + '"' : '' }; }), 'Quick actions');
    if (small) return h;
    var held = wcQuickHeld();
    // Nothing kept: the caption and one line saying where an unsaved invoice waits (§1a-19), a fact line, never the card's detail,
    // which says before what the card shows (§24b).
    if (!held.length) return h + wdgFactLinesHtml([['Nothing yet:', 'an invoice left unsaved on Create waits here']], { caption: 'Started here and not saved', attrs: ' data-wc-held="none"' });
    return h + '<p class="inv-widget-cap">Started here and not saved</p><div class="inv-docket" data-wdg-list data-noun="form">' + held.map(function(x) {
      return wdgDocketRowHtml({ party: x.title, meta: x.meta, act: x.act, attrs: x.attrs });
    }).join('') + '</div>';
  },
  // A register page kept on this device opens on Mine, on its day, where the page was being typed (faceVatLineFor reads the draft).
  act: function(action, btn) {
    if (action !== 'invWdgHeldVat') return false;
    switchTab('pageFace');
    faceSetDay(btn.dataset.day);
    faceOpen('vat');
    return true;
  } });

/* The book's second copy on GitHub (ghCardOpts' reading): when it was last backed up, the repository under it, and Back up now (or
   Register, where the guard keeps this device from syncing) as the one button a Small keeps. */
wdgDefine({ id: 'sync', title: 'GitHub backup', short: 'Backup', q: 'Is the book backed up?', section: 'office', type: 'tools', icon: 'sync', sizes: ['s'],
  needs: { perm: 'settings' }, go: { settings: 'sync' }, actSmall: true,
  data: function() {
    var o = ghCardOpts();
    if (!o) return { state: 'notset', title: 'GitHub sync is not set up', body: 'A second copy of the book on GitHub, pushed from this device.',
      act: { label: 'Set it up', action: 'invWdgGo', attrs: ' data-wid="sync"' }, attrs: ' data-card="sync"' };
    var blocked = typeof devSyncBlockedShort === 'function' ? devSyncBlockedShort() : '';
    if (blocked) {
      var removedRow = typeof devRemovedRow === 'function' ? devRemovedRow() : null, removed = !!removedRow;
      // Removed: who removed it, when and why stay on the card (Settings → GitHub sync says it whole).
      return { state: 'ok', tone: removed ? 'danger' : 'warning', say: wcCap(blocked), sayTone: removed ? 'danger' : 'warning', attrs: ' data-card="sync"', reg: !removed,
        detail: removed ? wcCap(devRemovedWhy(removedRow)) : '' };
    }
    var cfg = getGhConfig(), last = ghLastSyncAt(), stale = !last || (Date.now() - last) > 86400000;
    // Which way the last copy went (the canvas's "From this device"), and how big the book is as last saved here.
    var size = typeof _storageHealth !== 'undefined' && _storageHealth.lastSaveChars ? fmtBytes(_storageHealth.lastSaveChars) : '';
    var way = !last ? '' : (cfg.lastPushAt || 0) >= (cfg.lastPullAt || 0) ? 'From this device' : 'Pulled to this device';
    return { state: 'ok', tone: stale ? 'warning' : 'ok', say: last ? 'Backed up ' + ghRelTime(last) : 'Not backed up yet', sayTone: stale ? 'warning' : 'ok',
      detailHtml: way && size ? '<span class="inv-long">' + escHtml(way + ' · the book is ' + size) + '</span><span class="inv-short">' + escHtml(way) + '</span>'
        : escHtml(way || (size ? 'The book is ' + size : cfg.owner + '/' + cfg.repo)),
      detailAttrs: ' title="' + escHtml(cfg.owner + '/' + cfg.repo) + '"', attrs: ' data-card="sync"', push: true };
  },
  draw: function() { return ''; },
  actRow: function(d) {
    if (d.reg) return { tint: { label: 'Register', action: 'invDevGo', attrs: ' data-sec="devices"' } };
    return d.push ? { tint: { label: _ghBusy ? 'Syncing…' : 'Back up now', action: 'invGhPush', disabled: !!_ghBusy } } : null;
  } });

/* Turnaround: the flow thread's reading of the plant (flowStats, flowVerdict), as Floor's Overview's Turnaround hero reads it, and its
   door In plant, as the hero's. Small, the median working days from challan to despatch against the target; Medium, the slowest
   clients against their own targets and the steps, as register rows; Large, the two side by side. */
/* The last challans despatched, oldest first, each in the tone of how it went against its target (back on time ok, up to two
   working days past amber, more red: flowVerdict's judge, a challan's latest line): the Small's pips. */
function wcTurnLast(n) {
  var by = {};
  flowLines().forEach(function(x) {
    if (x.toDespatch == null || !x.despatched) return;
    var k = String(x.m.id), c = by[k] || (by[k] = { id: k, no: x.m.challanNo || '', desp: x.despatched, over: -Infinity });
    if (x.despatched > c.desp) c.desp = x.despatched;
    c.over = Math.max(c.over, x.toDespatch - x.target.days);
  });
  return Object.keys(by).map(function(k) { return by[k]; }).sort(function(a, b) { return a.desp < b.desp ? -1 : a.desp > b.desp ? 1 : 0; }).slice(-n)
    .map(function(c) { return { id: c.id, no: c.no, tone: c.over <= 0 ? 'ok' : c.over <= FLOW_RED_AFTER ? 'warning' : 'danger', over: c.over }; });
}
wdgDefine({ id: 'turn', title: 'Turnaround', short: 'Turnaround', q: 'How fast does work go back out?', section: 'office', type: 'docket', icon: 'turnaround', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageProduction' }, go: { tab: 'pageProduction', v: 'plant' },
  data: function(ctx) {
    var st = flowStats(null);
    if (!st.lines) return { state: 'empty', title: 'No challan in 90 days', body: 'The turnaround reads each challan to the day its material goes back out.',
      act: typeof grdSees !== 'function' || grdSees('pageIM') ? { label: 'Add challan', action: 'invHomeQuick', attrs: ' data-go="challan"' } : null };
    if (st.toDespatch.d == null) return { state: 'early', title: 'Nothing despatched in 90 days yet', body: 'The turnaround is read once a challan’s material is invoiced out.' };
    var v = flowVerdict(st, null), tones = [v.tone], slow = [];
    if (ctx.size !== 's') {
      // Each client with five lines or more despatched in the 90 days, at its own pace against its own target (its page's reading).
      var today = localDateStr(), since = isoAddDays(today, -FLOW_DAYS), ids = {};
      flowLines().forEach(function(x) { if (x.clientId != null && x.date >= since && x.date <= today) ids[String(x.clientId)] = true; });
      slow = Object.keys(ids).map(function(id) {
        var s = flowStats(id);
        if (s.toDespatch.n < FLOW_MIN || s.toDespatch.d == null) return null;
        var cv = flowVerdict(s, id);
        return { id: id, name: prodClientName(id) || insClientName(id), d: s.toDespatch.d, n: s.toDespatch.n, within: s.within, tone: cv.tone, target: cv.t.days };
      }).filter(Boolean).sort(function(a, b) { return b.d - a.d || (a.within == null ? 1 : a.within) - (b.within == null ? 1 : b.within); }).slice(0, ctx.size === 'l' ? 6 : 3);
      slow.forEach(function(x) { tones.push(x.tone); });
    }
    // The share of the value back on time, as the canvas says it; the target is the pips' key at Small and the detail's from Medium.
    var on = st.within != null ? Math.round(st.within * 100) + '% of the value back on time' : '';
    return { state: 'ok', tone: wcWorst(tones), st: st, v: v, slow: slow, last: ctx.size === 's' ? wcTurnLast(10) : [],
      fig: wcFigUnit(st.toDespatch.d, st.toDespatch.d === 1 ? 'working day' : 'working days', v.tone), say: on || v.head, sayTone: v.tone,
      detail: 'Challan to despatch, against a ' + flowTargetWord(v.t.days), detailNotSmall: true };
  },
  draw: function(d, size) {
    if (size === 's') {
      if (!d.last.length) return '';
      var t = d.v.t.days, late = d.last.filter(function(x) { return x.tone !== 'ok'; }).length;
      return wdgPipsHtml(d.last, 'The last ' + todoPlural(d.last.length, 'challan') + ': ' + (late ? late + ' past the target' : 'every one back on time'),
        { l: 'The last ' + todoPlural(d.last.length, 'challan'), s: 'Last ' + d.last.length }, t === 0 ? { l: 'target the same day', s: 'same day' } : { l: 'target ' + todoPlural(t, 'day'), s: 'target ' + t + ' d' });
    }
    var row = function(o) { return wdgDocketRowHtml(o); };
    var slow = d.slow.length ? '<div class="inv-docket" data-wdg-list data-noun="client"><p class="inv-widget-cap">The slowest clients</p>' + d.slow.map(function(x) {
      return row({ party: x.name, meta: 'median of ' + todoPlural(x.n, 'line') + ' · a ' + flowTargetWord(x.target), end: uiDot(x.tone, escHtml(flowDayText(x.d))),
        go: { jump: { kind: 'production', tab: 'plant', client: x.id } }, attrs: ' data-wc-turn="' + escHtml(x.id) + '"' });
    }).join('') + '</div>' : '';
    // The steps, challan to pickling, to plating and to despatch (and invoice to payment, a role that sees money): flowStats' own.
    var st = d.st, money = wdgSeesMoney();
    var steps = [['Challan to pickling', st.toPickle, 'with a load set against it'], ['Challan to plating', st.toPlate, 'with plating set against it'], ['Challan to despatch', st.toDespatch, '']]
      .map(function(s) {
        return row({ party: s[0], meta: s[1].n ? 'median of ' + todoPlural(s[1].n, 'line') + (s[2] ? ' ' + s[2] : '') : 'none set against a challan yet', end: '<span class="inv-docket-amt">' + escHtml(flowDayText(s[1].d)) + '</span>' });
      });
    if (money && st.pay) steps.push(row({ party: 'Invoice to payment', meta: 'median of ' + todoPlural(st.pay.n, 'receipt') + ' · terms ' + st.terms.days + ' days',
      end: uiDot(flowPayTone(st.pay.d, st.terms.days), escHtml(st.pay.d + ' d')) }));
    var stepsHtml = '<div class="inv-docket" data-wdg-list data-noun="step"><p class="inv-widget-cap">The steps</p>' + steps.join('') + '</div>';
    if (size === 'l') return wdgColsHtml([slow, stepsHtml]);
    return slow + stepsHtml;
  },
  source: function() { return { facts: ['Challans of the last 90 days', 'working days, Sundays out'] }; } });

/* Pipeline, stage by stage: Pipeline's own stages (pipeStages: each a count, an amount and a tone by how long its oldest has
   waited; Owed to us only for a role that sees money) and its words for a stage running late (pipeLateSay). Small, the stage it
   leads with; Medium, the stages as one strip in a well, each opening Pipeline at itself; Large, the strip and the oldest of the
   stage it leads with as register rows, each ending in that stage's own action. */
function wcPipeOldest(s) {
  var now = Date.now();
  if (s.key === 'awaiting') return s.items.slice(0, 8).map(function(im) { return wcChallanRowHtml(im, { label: 'Create invoice', jump: { kind: 'createFor', clientId: im.clientId, ims: [im.id] } }); });
  if (s.key === 'owed') return s.items.slice().sort(function(a, b) { return (b.oldestDays || 0) - (a.oldestDays || 0) || b.owed - a.owed; }).slice(0, 8).map(function(r) {
    return wdgDocketRowHtml({ party: r.client.name, meta: r.open.length + ' open' + (r.oldestDays != null ? ' · oldest ' + r.oldestDays + ' d' : ''), amt: r.owed,
      go: { action: 'invFinGo', attrs: ' data-tab="receipts" data-client="' + escHtml(String(r.client.id)) + '"' }, act: { label: 'Remind', jump: { kind: 'soa', client: r.client.id } } });
  });
  var list = s.key === 'delivered' ? s.items.slice().sort(function(a, b) { return (invFileDue(a) || 0) - (invFileDue(b) || 0); })
    : s.items.slice().sort(function(a, b) { return invStateDays(b, now) - invStateDays(a, now); });
  var act = function(i) {
    if (s.key === 'created') return { label: 'Print', action: 'invPreviewInvoice', attrs: ' data-id="' + escHtml(i.id) + '"' };
    if (s.key === 'printed') return { label: 'Dispatched', action: 'invAdvanceState', attrs: ' data-id="' + escHtml(i.id) + '" data-state="dispatched"' };
    if (s.key === 'dispatched') return { label: 'Delivered', action: 'invAdvanceState', attrs: ' data-id="' + escHtml(i.id) + '" data-state="delivered"' };
    return { label: 'File', action: 'invPipeFile', attrs: ' data-month="' + escHtml(String(i.date || '').slice(0, 7)) + '"' };
  };
  return list.slice(0, 8).map(function(i) { return wcInvoiceRowHtml(i, now, act(i)); });
}
wdgDefine({ id: 'pipe', title: 'Pipeline, stage by stage', short: 'Pipeline', q: 'What is waiting, from challan to payment?', section: 'office', type: 'docket', sizes: ['m', 's', 'l'],
  needs: { page: 'pagePipeline' }, go: { tab: 'pagePipeline' },
  data: function(ctx) {
    var stages = pipeStages(), open = stages.filter(function(s) { return s.open; });
    if (!open.length && !(S.invoices || []).some(function(i) { return i.status === 'active'; }) && !(S.incomingMaterial || []).some(function(im) { return (im.items || []).length; })) {
      return { state: 'empty', title: 'No challan or invoice yet', body: 'The pipeline follows a challan in to its invoice and the money back.',
        act: typeof grdSees !== 'function' || grdSees('pageIM') ? { label: 'Add challan', action: 'invHomeQuick', attrs: ' data-go="challan"' } : null };
    }
    // The worst stage running late: red before amber, and in the pipeline's own order within a tone; the stage it leads with is that,
    // else the first holding a red, else the first holding anything (Pipeline's own default).
    var late = open.filter(function(s) { return s.tone === 'danger' || s.tone === 'warning'; })
      .sort(function(a, b) { return (UI_TONE_RANK[uiTone(b.tone)] || 0) - (UI_TONE_RANK[uiTone(a.tone)] || 0); });
    var lead = late[0] || open.find(function(s) { return s.key === pipeDefaultStage(stages); }) || null;
    var say = late[0] ? wcCap(pipeNoThisYear(pipeLateSay(late[0]))) : lead ? 'Nothing running late' : 'Nothing on its way';
    var d = { state: 'ok', tone: late.length ? uiTone(late[0].tone) : 'ok', stages: stages, lead: lead };
    // From Medium the stages are the card's summary (the canvas): each its count, its lamp and its amount, the one it leads with lifted.
    if (ctx.size !== 's') return d;
    return Object.assign(d, { say: say, sayTone: d.tone, fig: lead && lead.amount != null && !lead.noBank ? wcMoneyFig(lead.amount) : '',
      detail: lead ? lead.label + ' · ' + lead.n + ' ' + lead.of : 'every invoice filed, nothing waiting' });
  },
  draw: function(d, size) {
    if (size === 's') return '';
    var strip = wdgDocketStagesHtml(d.stages.map(function(s) {
      return { key: s.key, label: s.label, n: s.noBank ? '—' : s.n, amt: s.noBank || !s.open ? null : s.amount, tone: s.open ? uiTone(s.tone) : 'neutral', word: s.open ? pipeNoThisYear(String(s.word || '').split(' · ')[0]).replace(/^GSTR-1 due /, 'file by ') : '',
        lead: d.lead && s.key === d.lead.key, go: s.open ? { action: 'invSwitchTab', attrs: ' data-tab="pagePipeline" data-v="' + s.key + '"' } : null };
    }));
    if (!d.lead) return strip;
    // The stage it leads with, its oldest first (the latest GSTR-1 date first for Delivered, the oldest debt for Owed to us).
    var k = d.lead.key, kind = k === 'awaiting' ? 'challan' : k === 'owed' ? 'client' : 'invoice';
    var cap = d.lead.label + (k === 'delivered' ? ', the return due first' : k === 'owed' ? ', the oldest debt first' : ', the oldest first');
    return strip + '<div class="inv-docket" data-wdg-list data-noun="' + kind + '"' + (kind === 'client' ? '' : ' data-nums="' + kind + '"') + '>' +
      wdgDocketKeyHtml(kind === 'challan' ? WC_CHALLAN_KEY : kind === 'invoice' ? WC_INV_KEY : [], cap) + wcPipeOldest(d.lead).join('') + '</div>';
  },
  source: function() {
    // A challan's and an invoice's age is in days from its date or its stamp (imWaitDays, invStateDays), as Pipeline counts it.
    var a = todoCfg().challanDays;
    return { facts: ['Challans and invoices to ' + homeClockText(new Date()), 'a challan amber at ' + a + ' days, red at ' + a * 2] };
  } });

/* Quotations and prospects: the quotations counted as their verdict counts them (qtTally, qtTallyTone) and Prospects' pipeline
   against the spare (prsPipeline, prsSpare), its four factors as Prospects' verdict draws them. Small, the quotations out, won
   and lost; Medium, the spare and the weighted pipeline. Its door is Sales; Follow up is its Act while follow-ups are due. */
wdgDefine({ id: 'quote', title: 'Quotations and prospects', short: 'Quotations', q: 'Who could fill the spare tonnes?', section: 'office', type: 'docket', sizes: ['s', 'm'],
  needs: { page: 'pageClients' }, go: { tab: 'pageClients', v: 'prospects' },
  data: function(ctx) {
    var t = qtTally(), prs = getProspects();
    if (!t.all && !prs.length) return { state: 'empty', title: 'No quotation or prospect yet', body: 'Sales keeps the firms approached and the quotations sent them.',
      act: { label: 'Open Sales', action: 'invWdgGo', attrs: ' data-wid="quote"' } };
    var due = prs.filter(function(p) { var l = prsLate(p); return l != null && l >= 0; });
    var follow = due.some(function(p) { return prsLate(p) >= 7; }) ? 'danger' : due.length ? 'warning' : null;
    var out = t.live + t.expired, sub = t.expired ? t.expired + ' expired, unanswered' : t.soon ? t.soon + ' expiring this week' : t.toPost ? todoPlural(t.toPost, 'rate') + ' to post'
      : t.drafts ? todoPlural(t.drafts, 'draft') : t.all ? 'nothing waiting on an answer' : 'no quotation sent yet';
    var d = { state: 'ok', t: t, due: due.length, follow: follow, fig: t.all ? wcFigUnit(out, 'out') : '', say: t.all ? t.accepted + ' won · ' + t.declined + ' lost' : 'No quotation sent yet',
      detailHtml: figHtml(escHtml(sub), t.expired || t.soon || t.toPost ? 'warning' : null) };
    if (ctx.size === 's') { d.tone = qtTallyTone(t); return d; }
    d.pl = prsPipeline(); d.sp = prsSpare();
    d.fill = d.sp && d.sp.spareMonth > 0 ? d.pl.weighted / d.sp.spareMonth : null;
    d.tone = wcWorst([qtTallyTone(t), follow, d.fill != null ? figToneCapacity(d.fill * 100) : null]);
    return d;
  },
  draw: function(d, size) {
    if (size === 's') return '';
    var pl = d.pl, sp = d.sp, fill = d.fill, tn = function(kg) { return escHtml(formatNum(kg / 1000, 1) + ' t'); };
    return '<div class="inv-tiles inv-tiles-4" data-wco-prospects>' + [
      { label: 'Open', fig: String(pl.n), sub: d.due ? todoPlural(d.due, 'follow-up') + ' due' : 'none due', tone: d.follow },
      { label: 'Pipeline', fig: tn(pl.weighted), sub: 'a month, weighted', attrs: ' title="' + escHtml('Weighted by the chance at each stage: new 10%, contacted 20%, sample 40%, quoted 60% (a working assumption); ' +
        formatNum(pl.kg / 1000, 1) + ' t if all came') + '"' },
      { label: 'Spare', fig: sp ? tn(sp.spareMonth) : '', sub: 'a month, the last 90 days' },
      { label: 'Fills', fig: fill != null ? Math.round(fill * 100) + '%' : '', sub: 'of the spare', tone: fill != null ? figToneCapacity(fill * 100) : null }
    ].map(uiFactorTileHtml).join('') + '</div>';
  },
  actRow: function(d) { return d.due ? { tint: { label: 'Follow up ' + d.due, jump: { kind: 'prospects' } } } : null; },
  source: function() { return { facts: ['Sales', 'weighted at a chance per stage'] }; } });


/* ---------- Floor (Plant: the panel by the rectifiers) ---------- */
/* Power cuts this month (homePowerOpts' reading of powerCuts): how long the plant was dark and how many cuts; from Medium each cut a
   row, newest first, its lamp amber while it has no time back, each opening its completion. Complete the cut is the Act while one
   has no time back. */
wdgDefine({ id: 'powercuts', title: 'Power cuts', short: 'Power cuts', q: 'How much power did we lose?', section: 'floor', type: 'plant', sizes: ['s', 'm'],
  needs: { page: 'pagePower' }, go: { tab: 'pagePower', v: 'cuts' },
  data: function() {
    var today = localDateStr(), cuts = powerCuts(today.slice(0, 8) + '01', today).slice().reverse(), all = powerCuts(null, today);
    var mins = cuts.reduce(function(s, c) { return s + (c.min || 0); }, 0), open = cuts.filter(function(c) { return c.open; });
    var last = all[all.length - 1];
    return { state: 'ok', tone: open.length ? 'warning' : cuts.length ? 'info' : 'ok', cuts: cuts, open: open, attrs: ' data-card="power"',
      fig: mins ? escHtml(powerDur(mins)) + '<span class="inv-unit">dark</span>' : '0',
      say: cuts.length ? todoPlural(cuts.length, 'cut') + ' this month' + (open.length ? ', ' + open.length + ' with no time back' : '') : 'No cut this month',
      sayTone: open.length ? 'warning' : cuts.length ? 'info' : 'ok',
      detail: last ? 'The last on ' + stockShortDate(last.date) + ', ' + powerClock(last.from) + (last.open ? ', no time back' : ' – ' + powerClock(last.to)) : 'None recorded' };
  },
  draw: function(d, size) {
    if (size === 's' || !d.cuts.length) return '';
    return '<div class="inv-plant" data-wdg-list data-noun="cut">' + d.cuts.map(function(c) {
      return wdgPlantRowHtml({ tone: c.open ? 'warning' : 'neutral', plate: stockShortDate(c.date), runs: powerClock(c.from) + (c.open ? ', no time back' : ' – ' + powerClock(c.to)),
        meta: [c.reason ? pcsName(c.reason) || 'a reason given' : 'no reason given', c.where || c.unitId ? pcsWhereWord(c.where, c.unitId) : ''].filter(Boolean).join(' · '), reading: c.min != null ? powerDur(c.min) : '',
        go: c.ids && c.ids[0] ? { jump: { kind: 'powerCut', id: c.ids[0] }, label: 'Cut on ' + stockShortDate(c.date) } : null, attrs: ' data-wc-cut="' + escHtml(c.date) + '"' });
    }).join('') + '</div>';
  },
  actRow: function(d) { var c = d.open[0]; return c && c.ids && c.ids[0] ? { tint: { label: 'Complete the cut', jump: { kind: 'powerCut', id: c.ids[0] } } } : null; },
  source: function() { return { facts: ['Cuts from the register, the messages and by hand', 'this month'] }; } });

/* The market's move over the week to its last refresh (the canvas's "Up 1.2% this week"): LME by day as each Refresh kept it, the last
   against the newest kept 7 to 14 days before it (the uplift is one figure, so MCX moves with LME), or null with no such day. */
function wcZincWeek(z) {
  var hist = (z && z.lmeHistory) || {};
  var days = Object.keys(hist).filter(function(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d) && hist[d] > 0; }).sort();
  if (days.length < 2) return null;
  var last = days[days.length - 1], lo = isoAddDays(last, -14), hi = isoAddDays(last, -7);
  var prev = days.filter(function(d) { return d >= lo && d <= hi; }).pop();
  return prev ? { pct: (hist[last] - hist[prev]) / hist[prev] * 100, from: prev, to: last } : null;
}
/* The zinc rate (the canvas's Outside board): MCX a kilo (estimated from LME by the uplift, or as typed), with its paise (a rate,
   §1a-18); the verdict the market's move this week where the refreshes kept say it, else how old the rate is ([data-zinc-age] at every
   size, a warning once stale); the market's last refreshes as a line, at the card's foot at Small; from Medium, landed with the
   premium and the derivation. Its Refresh is the Source's link. */
wdgDefine({ id: 'zinc', title: 'Zinc rate', short: 'Zinc rate', q: 'What is zinc costing today?', section: 'floor', type: 'outside', icon: 'zinc', sizes: ['s', 'm'],
  needs: { money: true }, go: { settings: 'zinc' },
  data: function(ctx) {
    var z = getZinc(), landed = zincLandedRate(), key = !!getMetalsKey();
    if (landed == null) return { state: 'notset', title: 'No zinc rate recorded', attrs: ' data-card="zinc"',
      body: key ? 'Tap Refresh to pull the current market rate, or enter it by hand in Settings.' : 'Set it in Settings, or add a metals.dev API key there to pull it from the market.',
      act: key ? { label: 'Refresh', action: 'invRefreshZinc' } : { label: 'Set the zinc rate', action: 'invOpenSettings', attrs: ' data-sec="zinc"' } };
    var age = zincAgeDays(), stale = age == null || age > ZINC_STALE_DAYS;
    var ageText = age == null ? 'never updated' : age === 0 ? 'updated today' : 'updated ' + age + ' day' + (age !== 1 ? 's' : '') + ' ago';
    // The market's last 30 refreshes, oldest first: MCX as the figure reads it (LME by the uplift).
    var hist = z.lmeHistory || {}, days = Object.keys(hist).sort().slice(-30), up = z.upliftPct || 0, prem = z.premiumPerKg || 0;
    var wk = stale ? null : wcZincWeek(z), lme = z.basis === 'lme';
    var move = wk ? (Math.abs(wk.pct) < 0.05 ? 'Level this week' : (wk.pct > 0 ? 'Up ' : 'Down ') + formatNum(Math.abs(wk.pct), 1) + '% this week') : '';
    return { state: 'ok', tone: stale ? 'warning' : 'neutral', z: z, days: days, hist: hist, up: up, prem: prem, attrs: ' data-card="zinc"',
      // A phone's Small keeps "a kilo" alone (.inv-short): the rate and its basis do not fit beside each other there.
      fig: escHtml(formatCurrency(zincMcxRate())) + '<span class="inv-unit"><span class="inv-long">' + escHtml('a kilo, MCX' + (lme ? (ctx.size === 's' ? ' est.' : ' estimated') : '')) +
        '</span><span class="inv-short">a kilo</span></span>',
      say: move || wcCap(ageText) + (stale ? ', may be out of date' : ''), sayTone: stale ? 'warning' : 'neutral',
      sayAttrs: ' data-zinc-age="' + (stale ? 'stale' : 'fresh') + '" title="' + escHtml(wcCap(ageText)) + '"', ageText: ageText,
      detail: 'Landed ' + formatCurrency(landed) + ', with the ' + formatCurrency(prem) + ' premium', detailNotSmall: true };
  },
  draw: function(d, size) {
    var mcx = function(x) { return gstRound(d.hist[x] * (1 + d.up / 100)); };
    var line = d.days.length >= 3 ? chartSpark(d.days.map(mcx), { labels: d.days.map(function(x) { return formatDate(x); }), unit: 'rate', dot: true,
      title: 'MCX at each refresh: ' + d.days.slice(-6).map(function(x) { return formatDate(x) + ' ' + formatCurrency(mcx(x)); }).join(' · ') }) : '';
    if (size === 's') return line ? '<div class="inv-widget-viz" data-wdg-push>' + line + '</div>' : '';
    var z = d.z;
    return (line ? '<div class="inv-widget-viz">' + line + '</div>' : '') +
      (z.basis === 'lme' ? '<p class="inv-brief-facts"><span>LME <b>' + escHtml(formatCurrency(z.ratePerKg)) + '</b> + ' + escHtml(formatNum(z.upliftPct, 1)) + '% duty and freight = MCX est. <b>' +
        escHtml(formatCurrency(zincMcxRate())) + '</b></span></p>' : '');
  },
  // Where the rate came from, with the field it was read from (*metals.dev (metals.zinc)*), its age and Refresh, always: a refresh
  // with no key says to add one rather than doing nothing.
  source: function(d) {
    var src = d.z && d.z.source ? String(d.z.source).replace(/^(.*?) · (.*)$/, '$1 ($2)') : 'metals.dev';
    return { parts: [src, d.ageText, { refresh: 'zinc' }].concat(d.z && d.z.basis === 'lme' ? ['MCX estimated from LME'] : []) };
  } });

/* The floor's lines on a day as Floor's Overview judges its line cards (floor.js flrLineJudge over areaStats: a plating line by its
   efficiency, half its units down, or heads and no record), the three plating lines worst first as the cards are ordered, a tie in
   tone going to the lower efficiency, each with what it plated (prodDayLine) and the EXTRA booked to its areas; and how many lines are
   short of their number, as the People card counts them. Once a book and a day. */
function wcFlrLines(day) {
  return wdgMemo('flr-lines:' + day, function() {
    var att = attDaySummary(day), byArea = {};
    areaStats(day, day).rows.forEach(function(a) { byArea[a.id] = a; });
    var all = FLR_LINES.map(function(ln, i) {
      return { ln: ln, i: i, j: flrLineJudge(day, ln, byArea, att.marked), r: ln.id === 'pickling' ? null : prodDayLine(day, ln.id),
        extra: ln.areas.reduce(function(s, a) { return s + ((byArea[a] && byArea[a].extraHours) || 0); }, 0) };
    });
    var effOf = function(x) { return x.j.ef && x.j.ef.eff != null ? x.j.ef.eff : 9; };
    var lines = all.filter(function(x) { return x.ln.id !== 'pickling'; })
      .sort(function(x, y) { return (FLR_TONE_RANK[x.j.tone] - FLR_TONE_RANK[y.j.tone]) || (effOf(x) - effOf(y)) || x.i - y.i; });
    var short = all.filter(function(x) { return x.j.st.need != null && x.j.st.heads < x.j.st.need; }).length;
    return { day: day, att: att, lines: lines, short: short };
  });
}
/* A plating line's state in a few words, as its card says it: half its units down or heads and no record first, else its
   efficiency, else not judged, else not running. */
function wcFlrLineWord(x, isToday) {
  var ef = x.j.ef, unit = (ef && ef.unitWord) || 'unit';
  if (!ef) return x.j.st.word;
  if (ef.halfDown) return (ef.n - ef.nAvail) + ' of ' + ef.n + ' ' + unit + 's down';
  if (ef.missing) return 'Heads, no record';
  if (ef.eff != null) return ef.word;
  if (ef.ran) return 'Not judged';
  return isToday ? 'Not running yet' : 'Did not run';
}
/* What a line plated, as Floor's line card ends: its weight (≈ where estimated, ≥ where pieces nothing weighs are left out), else
   its pieces. */
function wcFlrPlated(r) {
  return r.kg > 0 ? prodKgFig(r.kg, r.est > 0.0005, r.unweighed > 0) : r.nos > 0 ? Math.round(r.nos).toLocaleString('en-IN') + ' NOS' : '';
}
/* The client a line plated most for on a day (by pieces and kilos as written), and how many more. */
function wcFlrLineClient(r) {
  var by = {};
  ((r && r.entries) || []).forEach(function(e) {
    var name = e.clientId != null ? prodClientName(e.clientId) || e.client || '' : e.client || '';
    if (name) by[name] = (by[name] || 0) + (Number(e.qty) || 0);
  });
  var names = Object.keys(by).sort(function(a, b) { return by[b] - by[a]; });
  return names.length ? wcClientShort(names[0]) + (names.length > 1 ? ' and ' + (names.length - 1) + ' more' : '') : '';
}
/* A plating line as a Plant row (the canvas's floor now): its lamp in its tone, its nameplate, what it has plated (today: so far) or
   its state, its units working and its main client, and its efficiency at the end over a gauge marked at PROD_EFF_OK. A row says and
   opens nothing (the canvas's 40px row): the card's head opens Floor's Overview, whose line cards open their lines. */
function wcFlrLineRowHtml(x, day, isToday) {
  var ef = x.j.ef, plated = wcFlrPlated(x.r);
  var units = ef && ef.n ? ef.nAvail + ' of ' + ef.n + ' ' + wdgNoun(ef.unitWord || 'unit', ef.n) : '';
  var meta = [units, wcFlrLineClient(x.r)].filter(Boolean).join(' · ') || x.j.st.word;
  var pct = ef && ef.eff != null ? Math.round(ef.eff * 100) : null;
  return wdgPlantRowHtml({ tone: x.j.tone, plate: flrLineName(x.ln.id), runs: plated ? plated + (isToday ? ' so far' : '') : wcFlrLineWord(x, isToday), meta: meta,
    eff: { text: pct != null ? pct + '%' : '\u2014', tone: pct != null ? ef.tone : null, v: pct || 0, max: 100, mark: PROD_EFF_OK * 100,
      title: pct != null ? flrLineName(x.ln.id) + ' at ' + pct + '% of what its working units could plate; the mark is ' + Math.round(PROD_EFF_OK * 100) + '%' : 'Not judged yet' },
    attrs: ' data-wc-line="' + escHtml(x.ln.id) + '"' });
}
/* The day in lanes (chartDayLanes): a lane a plating line with its runs (outside the general shift lighter), the day's cuts across
   them, the shift's ends and now where the day is today. */
var WC_LANE_LABEL = { 'vat-a1': 'A1', 'vat-a2': 'A2', barrel: 'BRL' };
function wcDayLanesHtml(day, only) {
  var pic = prodDayPicture(day), isToday = day === localDateStr(), d = new Date();
  var lanes = (only ? [only] : PROD_LINES).map(function(l) {
    return { label: WC_LANE_LABEL[l] || prodLineName(l), title: prodLineName(l) + ': ' + todoPlural((pic.spans[l] || []).length, 'run'),
      spans: (pic.spans[l] || []).map(function(x) { return { from: x.from, to: x.to, ot: x.to <= 510 || x.from >= 1020 }; }) };
  });
  var cuts = (pic.cuts || []).map(function(c) { return { from: c.from, to: c.to }; });
  return '<div class="inv-widget-viz" data-wc-daystrip>' + chartDayLanes(lanes, { cuts: cuts, now: isToday ? d.getHours() * 60 + d.getMinutes() : null, compact: !_isDesktop,
    title: 'The day, 6 AM to 6 AM: ' + (pic.ran.length ? pic.ran.map(prodLineName).join(', ') + ' ran' : 'no line has run') + (cuts.length ? '; ' + todoPlural(cuts.length, 'cut') : '') }) + '</div>';
}
/* The floor now: who is on site against the day's roster (attOnSiteTone, the People card's judge) and the lines running; the day on
   one bar; a line a row, worst first; at Large the units down and the EXTRA booked. Today, as Floor's Overview opens; heads only,
   never a rupee, so every role that opens Floor sees it. */
wdgDefine({ id: 'floornow', title: 'The floor now', short: 'Floor now', q: 'Who is on site and what is running?', section: 'floor', type: 'plant', icon: 'floor', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFloor' }, card: 'floor-now',
  // Floor's Overview on today, as Needs you's floor card opens it.
  go: function() { flrSetDay(null); switchTab('pageFloor'); },
  data: function(ctx) {
    var day = localDateStr(), F = wcFlrLines(day), d = F.att;
    var ran = F.lines.filter(function(x) { return x.r.entries.length > 0; });
    if (!d.roster.length && !ran.length && !homeLastPlatedDay()) return { state: 'empty', title: 'Nothing on the floor yet', body: 'People → Roster holds the crew, and Production records what each line plates.',
      act: { label: 'Open the floor', action: 'invWdgGo', attrs: ' data-wid="floornow"' } };
    var onTone = attOnSiteTone(d, F.short), worst = F.lines[0], n = d.roster.length, on = d.p + d.half;
    var say = !d.marked && !ran.length ? 'Nothing recorded yet today' : flrLineName(worst.ln.id) + ': ' + wcLc(wcFlrLineWord(worst, true));
    // Who is on site beside the lines running, as a reading (the canvas's "14 of 16 on site"), in the People card's tone.
    var heads = d.marked ? '<span class="inv-reading" data-wc-onsite>' + figHtml(escHtml(String(on)), onTone) + '<span class="inv-unit">of ' + n + ' on site</span></span>' : '';
    return { state: 'ok', tone: wcWorst([onTone].concat(F.lines.map(function(x) { return x.j.tone; }))), F: F, day: day,
      fig: wcFigUnit(ran.length, 'of ' + F.lines.length + ' lines running') + (heads ? ' ' + heads : ''), say: say, sayTone: worst ? worst.j.tone : 'neutral',
      // The heads behind the reading, at Large (the lanes and the rows say the rest).
      detail: ctx.size !== 'l' ? '' : d.marked ? [d.complement ? d.floorHeads + ' of ' + d.complement + ' on the floor' : '', todoPlural(d.absent.length, 'absent', 'absent') + (d.unmarked ? ', ' + d.unmarked + ' unmarked' : '')]
        .filter(Boolean).join(' · ') : 'The in-time roll fills it', detailNotSmall: true };
  },
  draw: function(d, size) {
    if (size === 's') {
      var a = d.F.att;
      return a.marked ? '<div class="inv-widget-viz" data-wdg-push>' + chartMeter([{ v: a.p, tone: 'ok' }, { v: a.half, tone: 'warning' }, { v: a.absent.length, tone: 'danger' }, { v: a.unmarked, tone: 'neutral' }],
        { title: a.p + ' present, ' + a.half + ' half day, ' + a.absent.length + ' absent' + (a.unmarked ? ', ' + a.unmarked + ' unmarked' : '') }) + '</div>' : '';
    }
    var rows = '<div class="inv-plant" data-wdg-list data-noun="line">' + d.F.lines.map(function(x) { return wcFlrLineRowHtml(x, d.day, true); }).join('') + '</div>';
    var strip = wcDayLanesHtml(d.day);
    if (size !== 'l') return strip + rows;
    // The units not working on each line (the plant register, as found on the day), and the EXTRA booked: the day's whole, by line.
    var nUnits = 0, nDown = 0, half = false, words = [];
    d.F.lines.forEach(function(x) {
      var cap = pltCapacity(x.ln.id, d.day);
      if (!cap.n) return;
      nUnits += cap.n; nDown += cap.down.length;
      if (x.j.ef && x.j.ef.halfDown) half = true;
      if (cap.down.length) words.push(pltDownWords(cap.down, d.day));
    });
    var att = d.F.att, byLine = d.F.lines.filter(function(x) { return x.extra > 0.0005; }).map(function(x) { return flrLineName(x.ln.id) + ' ' + wcHours(x.extra) + ' h'; });
    var side = '<div class="inv-plant">' +
      wdgPlantRowHtml({ tone: half ? 'danger' : nDown ? 'warning' : nUnits ? 'ok' : 'neutral', plate: 'Units', runs: nUnits ? nDown + ' of ' + nUnits + ' down' : 'No unit on the plant register',
        meta: nUnits ? (nDown ? words.join(' · ') : 'every unit working') : '', attrs: ' data-wc-units' }) +
      wdgPlantRowHtml({ tone: 'neutral', plate: 'EXTRA', runs: att.marked ? wcHours(att.extraH) + ' h booked' : 'No attendance today',
        meta: !att.marked ? '' : byLine.length ? byLine.join(' · ') : att.extraH > 0.0005 ? 'off the plating lines' : 'none booked today', attrs: ' data-wc-extra' }) + '</div>';
    return strip + wdgColsHtml([rows, side]);
  },
  // What the card stands on (the canvas's "In-time roll 8:41 AM · register to 2:10 PM · one cut, 11:20 to 11:58 AM"): when the roll
  // came, how late the day's runs are recorded to, and the cuts.
  source: function(d) {
    var a = d.F.att, day = d.day, pic = prodDayPicture(day), last = null, cuts = pic.cuts || [];
    var at = tdyRolls('in', day).map(function(p) { return tdyArrival(p.text, p.at, day, p); }).filter(function(x) { return x != null; });
    PROD_LINES.forEach(function(l) { (pic.spans[l] || []).forEach(function(x) { if (x.to != null && (last == null || x.to > last)) last = x.to; }); });
    var span = function(c) {
      var f = relayClockLabel(c.from % 1440), t = c.to != null ? relayClockLabel(c.to % 1440) : '';
      return t ? (f.slice(-2) === t.slice(-2) ? f.replace(/ (AM|PM)$/, '') : f) + ' to ' + t : f + ', power not back';
    };
    return { facts: [at.length ? 'In-time roll ' + relayClockLabel(Math.min.apply(null, at)) : a.marked ? 'Attendance entered by hand' : 'No attendance yet',
      last != null ? 'runs recorded to ' + relayClockLabel(last % 1440) : 'no run recorded yet',
      !cuts.length ? 'no cuts' : cuts.length === 1 ? 'one cut, ' + span(cuts[0]) : cuts.length + ' cuts'] };
  } });

/* Production, the last day with plating on record: the day card (prodDayHeroOpts, as Floor's Overview draws it, compact). Small, its
   weight and a gauge against the usual day; Medium, its verdict and each line a row; Large, the day or the line picked (its Choose)
   and the pieces nothing weighs, each a row ending in Which part? or Set its weight. */
/* A weight as a card's figure: "≥ 326 kg" as its sign a step smaller (the money's minus), the number, and its unit. */
function wcKgFigHtml(text, words) {
  var m = /^([\u2265\u2248\u2264])?\s?([\d,.]+)\s*(kg|t)$/.exec(String(text || ''));
  if (!m) return escHtml(text || '');
  return (m[1] ? '<span class="inv-widget-sign">' + m[1] + '</span>' : '') + escHtml(m[2]) + '<span class="inv-unit">' + m[3] + (words ? ' ' + escHtml(words) : '') + '</span>';
}
var WC_PROD_CHOOSE = [{ v: 'all', label: 'All lines' }, { v: 'vat-a1', label: 'VAT A1' }, { v: 'vat-a2', label: 'VAT A2' }, { v: 'barrel', label: 'Barrel' }];
function wcProdLineRowHtml(pic, l) {
  var r = pic.lines[l], miss = pic.missing.indexOf(l) >= 0, ef = prodLineEfficiency(pic.date, l), ran = r.entries.length > 0;
  var plated = !ran ? '' : r.kg > 0 ? prodKgFig(r.kg, r.est > 0.0005, r.unweighed > 0) : Math.round(r.pieces || 0).toLocaleString('en-IN') + ' pieces';
  var unit = ef.unitWord || 'unit', units = ef.n ? (ef.halfDown ? (ef.n - ef.nAvail) + ' of ' + ef.n + ' ' + wdgNoun(unit, ef.n) + ' down' : ef.nAvail + ' of ' + ef.n + ' ' + wdgNoun(unit, ef.n)) : '';
  var mv = ef.eff != null && ef.pace != null ? flrEffMoved(ef) : null;
  var pct = ef.eff != null ? Math.round(ef.eff * 100) : null;
  return wdgPlantRowHtml({ tone: ef.tone, plate: prodLineName(l),
    runs: ran ? plated + ' · ' + (r.rounds ? todoPlural(r.rounds, 'round') : todoPlural(r.entries.length, 'run')) : miss ? 'Heads on the general shift, no record' : 'Did not run',
    meta: [units, mv && mv.key ? wcLc(mv.title) : pct != null ? ef.word : ''].filter(Boolean).join(' · '),
    eff: { text: pct != null ? pct + '%' : '—', tone: pct != null ? ef.tone : null, v: pct || 0, max: 100, mark: PROD_EFF_OK * 100,
      title: pct != null ? prodLineName(l) + ' at ' + pct + '% of what its working units could plate; the mark is ' + Math.round(PROD_EFF_OK * 100) + '%' : prodLineName(l) + ': not judged' },
    go: { action: 'invProdDayLines', attrs: ' data-day="' + escHtml(pic.date) + '" data-line="' + l + '"', label: prodLineName(l) + ': open its lines' }, attrs: ' data-prod-day-line="' + l + '"' });
}
/* The day against a usual day in words, and what held it back (the canvas's "56% of a usual day: the barrel was down and VAT A2 ran
   light"): a line with half its units down, one with heads and no record, one under its efficiency's mark. */
function wcProdDaySay(pic) {
  if (!pic || !pic.runs || !(pic.usual > 0)) return null;
  var why = [];
  PROD_LINES.forEach(function(l) {
    var ef = prodLineEfficiency(pic.date, l), name = l === 'barrel' ? 'the barrel' : prodLineName(l);
    if (ef.halfDown) why.push(name + ' was down');
    else if (pic.missing.indexOf(l) >= 0) why.push(name + ' had heads and no record');
    else if (ef.eff != null && (ef.tone === 'warning' || ef.tone === 'danger')) why.push(name + ' ran light');
  });
  var share = Math.round(pic.kg / pic.usual * 100);
  return share + '% of a usual day' + (share < 100 && why.length ? ': ' + (why.length > 1 ? why.slice(0, -1).join(', ') + ' and ' + why[why.length - 1] : why[0]) : '');
}
/* How a day's kilos were weighed (the canvas's): known (written or on record) dark, estimated hatched, and the room the pieces nothing
   weighs would take, by their share of the pieces; a line a route under it. */
function wcProdWeighedHtml(pic) {
  var sure = pic.by.written + pic.by.record, est = pic.by.challans + pic.by['default'] + pic.by.kind, f = pic.weighedShare;
  var max = f > 0 && f < 1 ? (sure + est) / f : sure + est;
  var lines = [sure > 0.0005 ? [prodKgFig(sure), 'written or on record'] : null,
    pic.by.challans > 0.0005 ? [prodKgFig(pic.by.challans), 'estimated from challans'] : null,
    pic.by.kind > 0.0005 ? [prodKgFig(pic.by.kind), 'estimated by the kind of part'] : null,
    pic.by['default'] > 0.0005 ? [prodKgFig(pic.by['default']), 'at a client’s own kg a piece'] : null,
    pic.unweighed > 0 ? [Math.round(pic.unweighed).toLocaleString('en-IN') + ' pieces', 'not weighed'] : null].filter(Boolean);
  var title = lines.map(function(x) { return x[0] + ' ' + x[1]; }).join(', ');
  return wdgFactLinesHtml(lines, { caption: 'How it was weighed', attrs: ' data-wc-weighed',
    viz: chartMeter([{ v: sure, tone: 'neutral' }, { v: est, tone: 'neutral', hatch: true }], { max: max, title: title }) });
}
wdgDefine({ id: 'prodday', title: 'Production, the last day', short: 'Production', q: 'What did we plate?', section: 'floor', type: 'plant', icon: 'vat', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageProduction' },
  // Lines on the day it shows (the head is the door: Open the lines went, §24f).
  go: function() { var day = homeLastPlatedDay(); _prodView = 'main'; prodSetTab('lines'); if (day) _prodDay = day; switchTab('pageProduction'); },
  choose: { def: 'all', label: 'Line', opts: function() { return WC_PROD_CHOOSE; } },
  data: function(ctx) {
    var day = homeLastPlatedDay();
    if (!day) return { state: 'empty', title: 'No plating recorded yet', body: 'The register page, the barrel list and the pickling messages record what each line plates.',
      act: { label: 'Open Production', action: 'invWdgGo', attrs: ' data-wid="prodday"' }, attrs: ' data-card="production"' };
    var o = prodDayHeroOpts(day, { compact: true, attrs: ' data-card="production"' }), pic = o.pic, tone = WDG_TONES[o.tone] ? o.tone : 'neutral';
    var when = wcDayWord(day) + (o.isToday ? ' so far' : '');
    // Small: the day against a usual day in a few words (the canvas's "Yesterday: 56% of a usual day"), the figure in the card's tone.
    var share = pic && pic.runs && pic.usual > 0 ? Math.round(pic.kg / pic.usual * 100) : null;
    var small = ctx.size === 's' && share != null;
    // The weight as a figure (the canvas's "≥326 kg"): its sign a step smaller, its unit a unit.
    var large = ctx.size === 'l', daySay = large ? wcProdDaySay(pic) : null;
    var plated = o.isToday ? 'plated so far today' : day === isoAddDays(localDateStr(), -1) ? 'plated yesterday' : 'plated on ' + wcDayWord(day);
    var kgFig = pic && pic.kg > 0 ? wcKgFigHtml(prodKgFig(pic.kg, pic.est > 0.0005, pic.unweighed > 0), large ? plated : '') : o.fig || '';
    return { state: 'ok', tone: tone, o: o, pic: pic, day: day, attrs: o.attrs, fig: (small || large) && kgFig && tone !== 'neutral' ? figHtml(kgFig, tone) : kgFig,
      sayHtml: small ? escHtml(when + ': ' + share + '% of a usual day') : daySay ? escHtml(daySay) : o.title, sayTone: tone, headInCol: large,
      detail: large ? '' : when + ' · ' + (pic && pic.usual != null ? 'a usual day ' + prodKgFig(pic.usual, true) : 'no usual day yet'), detailNotSmall: small };
  },
  draw: function(d, size, ctx) {
    var pic = d.pic;
    if (size === 's') {
      if (!pic || !pic.runs) return '';
      // The day against a usual day (the mark only where the day passed it), its key under it.
      var max = Math.max(pic.kg, pic.usual || 0), over = pic.usual != null && pic.kg > pic.usual;
      return wdgGaugeHtml({ v: pic.kg, tone: d.tone === 'neutral' ? (prodDayUnder(pic.kg, pic.usual) ? 'warning' : 'ok') : d.tone, max: max, mark: over ? pic.usual : null,
        title: prodKgFig(pic.kg, pic.est > 0.0005, pic.unweighed > 0) + ' plated' + (pic.usual != null ? ' against a usual day of ' + prodKgFig(pic.usual, true) : ''),
        left: '0', right: pic.usual != null ? { l: 'usual ' + prodKgFig(pic.usual, true), s: 'usual ' + Math.round(pic.usual) } : '' });
    }
    if (!pic || !pic.runs) return '';
    var pick = size === 'l' && ctx.choose && ctx.choose !== 'all' ? ctx.choose : null;
    var rows = '<div class="inv-plant" data-wdg-list data-noun="line">' + (pick ? [pick] : PROD_LINES).map(function(l) { return wcProdLineRowHtml(pic, l); }).join('') + '</div>';
    if (size !== 'l') return rows;
    // Large (the canvas): how the day was weighed under its figure, the day in lanes over the lines in the middle, and the pieces
    // nothing weighs, on the line picked or the day's, each a row ending in the move that weighs it.
    var may = typeof grdOk !== 'function' || grdOk('floor'), idx = prodIndex();
    var names = pic.names.filter(function(n) { return !pick || (n.lines || []).indexOf(pick) >= 0; });
    var side = names.length ? '<div class="inv-docket" data-wdg-list data-noun="part"><p class="inv-widget-cap">Not weighed</p>' + names.map(function(n) {
        var e = idx.byId[n.id], named = e && e.partNumber;
        return wdgDocketRowHtml({ party: n.part || 'No part written', meta: [n.client || '', Math.round(n.pieces).toLocaleString('en-IN') + ' pieces'].filter(Boolean).join(' · '),
          attrs: ' data-prod-weigh="none"',
          act: may && n.clientId != null && n.id && n.part ? (named ? { label: 'Set its weight', action: 'invProdWeighSet', attrs: ' data-id="' + escHtml(n.id) + '"' }
            : { label: 'Which part?', action: 'invProdAlias', attrs: ' data-id="' + escHtml(n.id) + '"' }) : null });
      }).join('') + '</div>' : '<p class="inv-widget-cap">Every piece weighed</p>';
    return wdgColsHtml([wcProdWeighedHtml(pic), wcDayLanesHtml(d.day, pick) + rows, side], { shape: 'mid' });
  },
  source: function(d) { return { facts: ['Register pages of ' + stockShortDate(d.day), 'pickling messages', 'each run weighed by the surest route'] }; } });

/* Each working day's plating over the three lines, as production_days holds it (a line-day with no run is a gap), and the day's
   power cuts (power_cuts): the day's kilos where any run was weighed, and whether nine tenths of its pieces were (the usual day's
   rule: a day mostly unweighed reads low, so it is not judged light). The usual day is the one before today (prodUsualDay). Once a
   book. */
function wcFlrDays() {
  return wdgMemo('flr-days', function() {
    var cuts = {};
    dvRows('power_cuts').forEach(function(c) {
      var x = cuts[c.date] || (cuts[c.date] = { n: 0, min: 0, open: 0 });
      x.n++;
      if (c.minutes != null) x.min += c.minutes; else x.open++;
    });
    var days = dvSum('production_days', 'date', { kg: 'sum', pieces: 'sum', pieces_unweighed: 'sum' }).map(function(g) {
      var ran = g.nulls.pieces < g.n, share = g.pieces > 0 ? 1 - (g.pieces_unweighed || 0) / g.pieces : 1;
      return { date: g.date, kg: g.kg, ran: ran, whole: share >= 0.9, cut: cuts[g.date] || null };
    });
    return { days: days, usual: prodUsualDay(localDateStr()) };
  });
}
/* A day's cuts in a few words. */
function wcFlrCutWords(c) {
  if (c.n === 1) return c.open ? 'a cut with no time back' : 'a cut, ' + powerDur(c.min) + ' dark';
  return c.n + ' cuts' + (c.min ? ', ' + powerDur(c.min) + ' dark' : '') + (c.open ? ', ' + c.open + ' with no time back' : '');
}
/* Plated each day: a calendar of the weeks (chartHeat bare, the one blue ramp; a day with no record hatched), Medium eight weeks and
   Large twelve, with how many days fell under a usual day (prodDayUnder, the day card's own judge) and how many of those had a cut;
   Large lists the days under a usual day that were cut days beside it. Today is drawn as to date and never judged. */
wdgDefine({ id: 'heat', title: 'Plated each day', q: 'Which days ran light, and why?', section: 'floor', type: 'plant', sizes: ['l', 'm'],
  needs: { page: 'pageProduction' }, go: { tab: 'pageProduction', v: 'lines' }, card: 'plated-days',
  data: function(ctx) {
    var D = wcFlrDays(), today = localDateStr();
    if (!D.days.some(function(x) { return x.ran; })) return { state: 'empty', title: 'No plating recorded yet', body: 'The register page, the barrel list and the pickling messages record what each line plates.',
      act: { label: 'Open Production', action: 'invWdgGo', attrs: ' data-wid="heat"' } };
    var weeks = ctx.size === 'l' ? 12 : 8;
    var drawn = D.days.filter(function(x) { return x.date < today || (x.date === today && x.ran); });
    var sun = function(iso) { return isoAddDays(iso, -new Date(iso + 'T00:00:00').getDay()); };
    var last = drawn.reduce(function(m, x) { return x.date > m ? x.date : m; }, '') || today;
    var first = isoAddDays(sun(last), -7 * (weeks - 1)), shown = drawn.filter(function(x) { return x.date >= first; });
    var light = shown.filter(function(x) { return x.date < today && x.ran && x.kg != null && x.whole && prodDayUnder(x.kg, D.usual); });
    var cells = shown.map(function(x) {
      var label = attDayName(x.date) + ' ' + stockShortDate(x.date);
      if (!x.ran) return { date: x.date, state: 'none', title: label + ': no record' };
      if (x.kg == null) return { date: x.date, state: 'none', title: label + ': plated, none of it weighed' };
      var under = light.indexOf(x) >= 0;
      return { date: x.date, value: x.kg, state: 'ok', title: label + (x.date === today ? ' so far' : '') + ': ' + prodKgFig(x.kg, false, !x.whole) +
        (under ? ', under a usual day' : '') + (x.cut ? ' · ' + wcFlrCutWords(x.cut) : '') };
    });
    var cutLight = light.filter(function(x) { return x.cut; });
    var say = D.usual == null ? todoPlural(shown.filter(function(x) { return x.ran; }).length, 'day') + ' plated in ' + weeks + ' weeks'
      : light.length ? todoPlural(light.length, 'day') + ' under a usual day, ' + (cutLight.length ? cutLight.length + ' with a cut' : 'none with a cut')
      : 'No day under a usual day in ' + weeks + ' weeks';
    return { state: 'ok', tone: 'neutral', weeks: weeks, cells: cells, light: light, usual: D.usual, today: today, cutLight: cutLight, say: say,
      sayTone: light.length ? 'warning' : 'ok', detail: D.usual == null ? 'No usual day yet to judge them by' : weeks + ' weeks, today to date' };
  },
  draw: function(d, size) {
    if (size !== 'l' || !d.light.length) return '';
    // Large: the days under a usual day that were cut days, the latest first, beside the calendar.
    var rows = d.cutLight.slice().reverse().map(function(x) {
      return wdgPlantRowHtml({ tone: 'warning', plate: stockShortDate(x.date), runs: prodKgFig(x.kg), meta: wcFlrCutWords(x.cut), attrs: ' data-wc-light="' + escHtml(x.date) + '"' });
    });
    var calm = d.light.length - d.cutLight.length;
    if (calm) rows.push(wdgPlantRowHtml({ tone: 'neutral', plate: String(calm), runs: 'Under a usual day, no cut on record', attrs: ' data-wc-light-nocut' }));
    return wdgColsHtml([wdgVizHtml(), '<p class="inv-widget-cap">Light days</p><div class="inv-plant" data-wdg-list data-noun="day">' + rows.join('') + '</div>']);
  },
  viz: function(d, size, box) {
    return chartHeat(d.cells, { unit: 'kg', weeks: d.weeks, toDate: d.today, labelHead: 'Day', valueHead: 'Plated', ariaLabel: 'Plated each day, ' + d.weeks + ' weeks',
      emptyText: 'No plating in ' + d.weeks + ' weeks', bare: true, w: box.w, h: box.h });
  },
  source: function(d) { return { facts: ['Plated, weighed by the surest route'].concat(d.usual != null ? ['a usual day ' + prodKgFig(d.usual, true)] : []) }; } });

/* Line efficiency on the last day with plating (prodLineEfficiency, Floor's line cards' own figure and tone): Small the worst line's
   figure; Medium and Large the three lines as rows, each with its gauge against what its working units could plate, the mark at
   three quarters; Large names the factor that lost most (flrEffMoved, the card's own caption). */
wdgDefine({ id: 'eff', title: 'Line efficiency, now', short: 'Efficiency', q: 'Is each line plating what it can?', section: 'floor', type: 'plant', sizes: ['m', 's', 'l'],
  needs: { page: 'pageProduction' }, go: { tab: 'pageProduction', v: 'lines' }, card: 'line-eff',
  data: function() {
    var day = homeLastPlatedDay();
    if (!day) return { state: 'empty', title: 'No plating recorded yet', body: 'A line’s efficiency is read from what it plated on a day.',
      act: { label: 'Open Production', action: 'invWdgGo', attrs: ' data-wid="eff"' } };
    var isToday = day === localDateStr();
    var lines = PROD_LINES.map(function(l, i) { return { l: l, i: i, ef: prodLineEfficiency(day, l) }; });
    if (!lines.some(function(x) { return x.ef.eff != null || x.ef.halfDown || x.ef.missing; })) {
      var whys = lines.filter(function(x) { return x.ef.ran && x.ef.why; }).map(function(x) { return x.ef.why; });
      if (whys.length && whys.every(function(w) { return /plant register|kg a round/.test(w); })) return { state: 'notset', title: 'Set up the plant register',
        body: 'A line’s efficiency needs its tanks or barrels and their kg a round, on Production → Equipment.', act: { label: 'Open Equipment', action: 'invPltOpen' } };
      return { state: 'early', title: 'No line judged yet', body: whys.length ? 'Not judged: ' + whys[0] + '.' : 'A line is judged once it has run.' };
    }
    var sorted = lines.slice().sort(function(a, b) {
      return (FLR_TONE_RANK[a.ef.tone] - FLR_TONE_RANK[b.ef.tone]) || ((a.ef.eff == null ? 9 : a.ef.eff) - (b.ef.eff == null ? 9 : b.ef.eff)) || a.i - b.i;
    });
    var w = sorted[0].ef, unit = w.unitWord || 'unit', name = prodLineName(sorted[0].l);
    var word = w.halfDown ? (w.n - w.nAvail) + ' of ' + w.n + ' ' + unit + 's down' : w.missing ? 'heads and no record' : w.word ? wcLc(w.word) : '';
    return { state: 'ok', tone: w.tone, lines: lines, day: day, isToday: isToday, worst: sorted[0],
      fig: w.eff != null ? figHtml(escHtml(Math.round(w.eff * 100) + '%'), w.tone === 'neutral' ? null : w.tone) : '&mdash;', say: name + (word ? ': ' + word : ''), sayTone: w.tone,
      detail: wcDayWord(day) + (isToday ? ' so far' : '') };
  },
  draw: function(d, size) {
    if (size === 's') return '';
    return '<div class="inv-plant" data-wdg-list data-noun="line">' + d.lines.map(function(x) {
      var ef = x.ef, mv = size === 'l' && ef.eff != null && ef.pace != null ? flrEffMoved(ef) : null;
      var runs = ef.eff != null ? prodKgFig(ef.kg, ef.est, ef.unweighed > 0) + ' of ' + prodKgFig(ef.possible) : ef.missing ? 'Heads on the general shift, no record'
        : ef.ran ? 'Not judged: ' + (ef.why || 'a figure is missing') : d.isToday ? 'Not running yet' : 'Did not run';
      var gauge = ef.eff != null && ef.possible > 0 ? chartMeter([{ v: Math.min(ef.kg, ef.possible * 1.2), tone: ef.tone === 'neutral' ? 'neutral' : ef.tone }],
        { max: ef.possible, mark: ef.possible * PROD_EFF_OK, title: runs + ' (' + ef.word + '); the mark is three quarters' }) : '';
      return wdgPlantRowHtml({ tone: ef.tone, plate: prodLineName(x.l), runs: runs, meta: mv ? mv.title : ef.eff != null ? ef.word : '',
        reading: ef.eff != null ? Math.round(ef.eff * 100) + '%' : '', gauge: gauge,
        go: { action: 'invProdDayLines', attrs: ' data-day="' + escHtml(d.day) + '" data-line="' + escHtml(x.l) + '"', label: prodLineName(x.l) + ': open its lines' }, attrs: ' data-wc-eff="' + escHtml(x.l) + '"' });
    }).join('') + '</div>';
  },
  source: function(d) {
    var ef = d.worst.ef;
    return { facts: ['Register of ' + stockShortDate(d.day)].concat(ef.every ? ['a round every ' + formatNum(ef.every, 0) + ' minutes, ' + (ef.everySrc === 'measured' ? 'measured' : 'set')] : []) };
  } });

/* The thunder hours today's forecast holds (wcThunderHours, over feeds.js's feedThunderToday): an array of hours 0–23, or null where
   there is no forecast. */
function wcFlrThunder() {
  var thunder = null;
  try { thunder = typeof wcThunderHours === 'function' ? wcThunderHours() : null; } catch (e) { thunder = null; }
  if (!Array.isArray(thunder)) return null;
  var seen = {};
  return thunder.map(Number).filter(function(h) { if (!(h >= 0 && h <= 23) || h % 1 || seen[h]) return false; seen[h] = true; return true; })
    .sort(function(a, b) { return a - b; });
}
/* Hours as spans: [14, 15, 17] → [{from: 14, to: 16}, {from: 17, to: 18}]; and spans in words, "2 PM – 4 PM, 5 PM – 6 PM". */
function wcFlrSpanList(hours) {
  var spans = [];
  hours.forEach(function(h) { var s = spans[spans.length - 1]; if (s && s.to === h) s.to = h + 1; else spans.push({ from: h, to: h + 1 }); });
  return spans;
}
function wcFlrSpans(spans) { return spans.map(function(s) { return relayClockLabel(s.from * 60) + ' – ' + relayClockLabel(s.to * 60 % 1440); }).join(', '); }
/* Power cut risk by hour: the two hours the plant's cuts most often start in (powerRiskWindow over Cuts' own count by the hour they
   began), from 6 AM to 10 PM, and where today's forecast holds thunder (§9's feed) its hours beside it: two facts side by side, never
   a probability the book has not measured. Small, the hours as small bars, the window in the warning's mark and the thunder hours
   hatched in the info's; Medium, the shares as a chart, bare. */
wdgDefine({ id: 'risk', title: 'Power cut risk by hour', short: 'Cut risk', q: 'When is a cut likely today?', section: 'floor', type: 'plant', icon: 'zap', sizes: ['s', 'm'],
  needs: { page: 'pagePower' }, go: { tab: 'pagePower', v: 'cuts' }, card: 'cut-risk', live: 1800, feed: true,
  data: function() {
    var a = wdgMemo('power-analysis', powerAnalysis);
    if (!a.cuts.length) return { state: 'empty', title: 'No power cut recorded yet', body: 'The register’s power log, the pickling hand’s messages and Enter a cut record them.',
      act: { label: 'Open Cuts', action: 'invWdgGo', attrs: ' data-wid="risk"' } };
    var win = powerRiskWindow(a.hours, 6, 22), total = a.cuts.length;
    if (!win) return { state: 'ok', tone: 'neutral', none: true, total: total, say: 'No cut began between 6 AM and 10 PM', detail: todoPlural(total, 'cut') + ' on record' };
    if (win.early) return { state: 'early', title: 'Not enough yet: ' + win.inRange + ' of ' + POWER_RISK_MIN + ' cuts',
      body: 'The hours cuts most often start are named from ' + POWER_RISK_MIN + ' cuts on record between 6 AM and 10 PM.' };
    var thunder = wcFlrThunder(), spans = thunder && thunder.length ? wcFlrSpanList(thunder) : [];
    var touch = spans.filter(function(s) { return s.from < win.to && s.to > win.from; });
    var when = relayClockLabel(win.from * 60) + ' – ' + relayClockLabel(win.to * 60);
    // The window as the figure (the canvas's "10 AM – 12 PM"); on a phone's Small its end is the unit after its start ("10 AM to
    // 12 PM"), so the figure holds there.
    return { state: 'ok', tone: touch.length ? 'warning' : 'neutral', win: win, hours: a.hours, thunder: thunder, spans: spans, total: total,
      fig: escHtml(relayClockLabel(win.from * 60)) + '<span class="inv-long"> \u2013 ' + escHtml(relayClockLabel(win.to * 60)) + '</span>' +
        '<span class="inv-unit inv-short">to ' + escHtml(relayClockLabel(win.to * 60)) + '</span>', figAttrs: ' title="' + escHtml(when) + '"',
      // "7 of 10 cuts began then"; a phone's Small says "7 of 10 cuts" (the canvas's), its last two words dropped under 13rem.
      sayHtml: touch.length ? escHtml('Thunder forecast ' + wcFlrSpans(touch)) : escHtml(win.cuts + ' of ' + win.total + ' cuts') + '<span class="inv-long"> began then</span>', sayTone: touch.length ? 'warning' : 'neutral',
      detail: spans.length && !touch.length ? 'Thunder forecast ' + wcFlrSpans(spans) : '', detailNotSmall: true };
  },
  draw: function(d, size) {
    if (d.none || size !== 's') return '';
    // The working day, 6 AM to 6 PM (the canvas's twelve hours), stretched to the window's end or the last thunder hour where they
    // run later (to 10 PM at most); the window in the warning's mark, the thunder hours hatched in the info's; its key under it.
    var spans = d.spans || [], end = Math.min(22, Math.max(18, d.win.to, spans.length ? spans[spans.length - 1].to : 0)), bars = [];
    for (var k = 6; k < end; k++) {
      var inWin = k >= d.win.from && k < d.win.to, th = d.thunder && d.thunder.indexOf(k) >= 0;
      bars.push({ v: d.hours[k] || 0, label: relayClockLabel(k * 60), text: todoPlural(d.hours[k] || 0, 'cut') + ' began' + (th ? ', thunder forecast' : ''), tone: inWin ? 'warning' : 'neutral', hatch: th ? 'info' : null });
    }
    var clock = function(h) { return relayClockLabel(h * 60 % 1440); }, storm = spans.filter(function(sp) { return sp.from < end && sp.to > 6; });
    var a = storm.length ? clock(storm[0].from) : '', b = storm.length ? clock(storm[storm.length - 1].to) : '';
    var right = storm.length ? { l: 'storm ' + (a.slice(-2) === b.slice(-2) ? a.replace(/ (AM|PM)$/, '') : a) + '–' + b, s: 'storm' } : clock(end);
    return '<div class="inv-widget-gauge" data-wdg-push>' + chartMiniBars(bars, { title: 'Cuts by the hour they began, 6 AM to ' + clock(end) }) +
      wdgTrackKeyHtml(end === 18 ? ['6 AM', { l: '12 PM', s: '12' }, right] : ['6 AM', right]) + '</div>';
  },
  // The share of the cuts on record that began in each hour (Cuts' "When they come" as shares), the forecast's thunder hours a series
  // of their own, in the warning tone; bare, at the room the card leaves.
  viz: function(d, size, box) {
    if (d.none) return '';
    var hrs = [], w = d.win;
    for (var k = 6; k < 22; k++) hrs.push(k);
    var share1 = function(k) { return w.total ? Math.round((d.hours[k] || 0) / w.total * 1000) / 10 : 0; }, isT = function(k) { return d.thunder && d.thunder.indexOf(k) >= 0; };
    var series = [{ label: 'Cuts began', values: hrs.map(function(k) { return isT(k) ? 0 : share1(k); }), slot: 1 }];
    if (d.thunder && d.thunder.length) series.push({ label: 'In a thunder hour', values: hrs.map(function(k) { return isT(k) ? share1(k) : 0; }), tone: 'warning' });
    return chartStack(hrs.map(function(k) { return (k % 12 || 12) + (k < 12 ? 'a' : 'p'); }), series,
      { unit: 'pct', labelHead: 'Hour began', ariaLabel: 'The share of cuts that began in each hour, 6 AM to 10 PM', emptyText: 'No cut began between 6 AM and 10 PM', bare: true, w: box.w, h: box.h });
  }, vizAt: ['m'],
  source: function(d) {
    var t = typeof feedThunderToday === 'function' ? feedThunderToday() : null;
    return { facts: [todoPlural(d.total, 'cut') + ' on record'].concat(t && t.state === 'ok' ? ['thunder from MET Norway, ' + (t.ago || 'today')] : ['no forecast read']), refresh: t && t.state === 'ok' ? 'weather' : null };
  } });

/* The words for when to order a line: the pick's own (suppPickWhen), else why the app cannot say. */
function wcFlrOrderWhen(pk) { return suppPickWhen(pk) || (!pk || !pk.sp ? 'no supplier on record' : suppLeadText(pk.lead)); }
/* Stock days left: the line that runs out first and the day to order it by (stockStatus, suppReorderPick: the reorder list's own
   pick); from Medium the soonest as bars, red at 3 days and amber at 7 (Settings → Checks & alerts → Stock alerts, the mark the
   amber line), drawn bare; Large each with when to order, and the reorder's cash with GST. A line charged into a bath (zinc) or with
   no daily use has no days left and is not drawn. Order <line> is the Act while the first is amber or red. */
wdgDefine({ id: 'stockdays', title: 'Stock days left', short: 'Stock days', q: 'What runs out first?', section: 'floor', type: 'plant', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageStock' }, go: { tab: 'pageStock', v: 'list' }, card: 'stock-low',
  data: function(ctx) {
    var items = stockData().items.filter(function(i) { return i.active !== false; });
    if (!items.length) return { state: 'empty', title: 'No stock recorded yet', body: 'The supervisor’s stock message starts it, pasted on Stock.',
      act: { label: 'Open Stock', action: 'invWdgGo', attrs: ' data-wid="stockdays"' } };
    var list = items.map(function(i) { var s = stockStatus(i); return { item: i, s: s, days: suppDaysLeft(i, s) }; })
      .filter(function(x) { return x.days != null; })
      .sort(function(a, b) { return a.days - b.days || (a.item.name < b.item.name ? -1 : a.item.name > b.item.name ? 1 : 0); });
    if (!list.length) return { state: 'early', title: 'No daily use on record yet', body: 'A line’s days left are its level over its daily use, read from the use on record.' };
    var shown = list.slice(0, ctx.size === 'l' ? 10 : ctx.size === 'm' ? 8 : 3);
    shown.forEach(function(x) { x.pick = suppReorderPick(x.item, x.days); });
    var f = shown[0], tone = STOCK_TONE[f.s.tone] || 'neutral', ft = tone === 'danger' || tone === 'warning' ? tone : null;
    var days = f.s.group === 'out' ? 'Out' : stockDaysText(f.days, f.s.rate && f.s.rate.tentative);
    var d = { state: 'ok', tone: tone, list: list, shown: shown, L: ctx.size === 'l' ? stockReorderList() : null, first: f };
    // A Small (the canvas): "4 days of nitric acid", "Out of nitric acid", the gauges saying the rest.
    if (ctx.size === 's') {
      var name = /^[A-Z][a-z]/.test(f.item.name) ? f.item.name.charAt(0).toLowerCase() + f.item.name.slice(1) : f.item.name, m = /^([\d.]+\??)\s+(.*)$/.exec(days);
      d.fig = m ? figHtml(escHtml(m[1]), ft) + '<span class="inv-unit">' + escHtml(m[2] + ' of ' + name) + '</span>' : figHtml(escHtml(days), ft) + '<span class="inv-unit">' + escHtml('of ' + name) + '</span>';
      return d;
    }
    return Object.assign(d, { fig: figHtml(escHtml(days), ft) + '<span class="inv-unit">' + escHtml(f.item.name) + '</span>', say: wcCap(wcFlrOrderWhen(f.pick)), sayTone: tone });
  },
  draw: function(d, size) {
    var cfg = stockCfg(), daysOf = function(x) { return x.s.group === 'out' ? 'Out' : stockDaysText(x.days, x.s.rate && x.s.rate.tentative); };
    // The bars run to the reorder list's horizon (its lead time and the days it covers): a line past it needs no order.
    var R = stockReorderCfg(), max = R.leadDays + R.coverDays;
    if (size === 's') {
      // The three first to run out, a gauge each to the horizon, marked at the amber days: a line past the mark is drawn plain.
      return wdgGaugeRowsHtml(d.shown.map(function(x) {
        var t = STOCK_TONE[x.s.tone], txt = x.s.group === 'out' ? 'Out' : stockDaysText(x.days, x.s.rate && x.s.rate.tentative).replace(/ days?(\??)$/, ' d$1');
        return { label: x.item.name, v: Math.min(x.days, max), max: max, mark: cfg.amberDays, tone: t === 'danger' || t === 'warning' ? t : 'neutral', text: txt,
          title: x.item.name + ': ' + daysOf(x) + (x.s.group === 'out' ? '' : ' left') + '; the mark is ' + cfg.amberDays + ' days' };
      }), ' data-wdg-push');
    }
    var bars = chartRankedBars(d.shown.map(function(x) {
      var t = STOCK_TONE[x.s.tone];
      return { label: x.item.name, value: x.days, display: daysOf(x) + (x.s.group === 'out' ? '' : ' left'), tone: t === 'danger' || t === 'warning' ? t : 'good',
        markPct: cfg.amberDays / max * 100, sub: size === 'l' ? wcFlrOrderWhen(x.pick) : '' };
    }), { unit: 'count', max: max, labelHead: 'Line', valueHead: 'Days left', emptyText: 'No line has a daily use yet', bare: true });
    if (size !== 'l' || !d.L) return bars;
    var L = d.L;
    return bars + wdgLedgerHtml([{ label: 'The reorder list, with GST', meta: L.withGst > 0 ? (L.unpriced ? todoPlural(L.unpriced, 'line') + ' without a price' : 'at the last prices') : 'nothing to order now',
      amt: L.withGst > 0 ? L.withGst : 0, attrs: ' data-wc-reorder' }], null);
  },
  actRow: function(d) {
    var t = STOCK_TONE[d.first.s.tone];
    return t === 'danger' || t === 'warning' ? { tint: { label: 'Order ' + d.first.item.name, jump: { kind: 'reorder' } } } : null;
  },
  source: function(d) {
    var last = stockData().entries.reduce(function(m, e) { return !e.voided && e.date > m ? e.date : m; }, '');
    return { facts: ['Stock messages to ' + (last ? stockShortDate(last) : '—'), 'use over 3 weeks, Sundays out'] };
  } });

/* A sum over or under the market, its sign said (Spend and prices' own way), with its paise: it is a rate. */
function wcFlrZincOver(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + formatCurrency(Math.abs(v)); }
var WC_FLR_ZINC_RANGE = { '3M': 'three months', '6M': 'six months', FY: 'this financial year', ALL: 'every bill' };
/* Zinc against the market (zincTrend, over the range Stock → Spend and prices shows): what the bills paid over the market a kilo,
   weighted by their kilos (dashZincPaidOver), the market now against the last bill and the market's line with the last bill dashed
   beside it; Large each supplier over the market (dashZincSupStatus: Spend and prices' own words), as statement lines with their paise. */
wdgDefine({ id: 'zincpaid', title: 'Zinc against the market', q: 'Did we buy well, and from whom?', section: 'floor', type: 'ledger', sizes: ['m', 'l'],
  needs: { page: 'pageStock', money: true }, card: 'zinc-paid',
  go: function() { dashZincShow(); },
  data: function() {
    var range = typeof _dashZincRange === 'string' ? _dashZincRange : '6M', T = zincTrend(_dashZincFrom(range));
    if (!T.item || !T.lastBill) return { state: 'empty', title: 'No zinc bill recorded yet', body: 'A zinc delivery recorded with its bill, on Stock, is set against the market on its day.',
      act: { label: 'Open Stock', action: 'invWdgGo', attrs: ' data-wid="zincpaid"' } };
    if (!T.now) return { state: 'notset', title: 'No market rate kept yet', body: 'Each refresh of the zinc rate is kept as the market for its day.',
      act: getMetalsKey() ? { label: 'Refresh', action: 'invRefreshZinc' } : { label: 'Set the zinc rate', action: 'invOpenSettings', attrs: ' data-sec="zinc"' } };
    var po = dashZincPaidOver(T), unit = (T.item && T.item.unit) || 'kg';
    return { state: 'ok', tone: po.over == null ? 'neutral' : po.over > 0 ? 'info' : 'ok', T: T, po: po, range: range, unit: unit,
      fig: po.over == null ? '&mdash;' : wcFigUnit(wcFlrZincOver(po.over), 'a ' + unit + ' over the market', po.over > 0 ? null : 'ok'),
      say: po.over == null ? 'No bill set against the market yet' : po.over > 0 ? 'Paid over the market' : po.over < 0 ? 'Paid under the market' : 'Paid the market rate',
      sayTone: po.over == null ? 'neutral' : po.over > 0 ? 'info' : 'ok',
      detail: wcCap(WC_FLR_ZINC_RANGE[range] || 'six months') + ' · ' + todoPlural(po.set.length, 'bill') + ' set against it' };
  },
  draw: function(d, size) {
    var T = d.T, last = T.lastBill, mk = T.market.slice(-30);
    var spark = mk.length >= 2 ? '<div class="inv-widget-viz">' + chartSpark(mk.map(function(m) { return m.landed; }), { ref: mk.map(function() { return last.e.price; }), unit: 'rate',
      title: 'The market, landed, at each refresh from ' + stockShortDate(mk[0].date) + '; dashed, the last bill at ' + formatCurrency(last.e.price) }) + '</div>' : '';
    var lines = wdgLedgerHtml([
      { label: 'The market now, landed', meta: 'LME of ' + stockShortDate(T.now.date), amt: T.now.landed },
      { label: 'The last bill', meta: [stockShortDate(last.date), last.e.supplier || ''].filter(Boolean).join(' · '), amt: last.e.price }], null, { rate: true, unit: '' });
    if (size !== 'l' || !T.suppliers.length) return spark + lines;
    var standing = dashZincSupStatus(T);
    var sup = '<p class="inv-widget-cap">Each supplier against the market</p>' + wdgLedgerHtml(T.suppliers.map(function(s) {
      var st = standing(s);
      return { label: s.name, meta: todoPlural(s.n, 'bill') + ' · ' + stockFmtQty(s.kg) + ' ' + d.unit, text: s.over != null ? wcFlrZincOver(s.over) : 'No market', tone: st ? st[0] : null,
        attrs: ' data-wc-zinc-supplier' };
    }), null, { noun: 'supplier' });
    return wdgColsHtml([spark + lines, sup]);
  },
  source: function() { return { facts: ['Zinc bills', 'the market at today’s uplift and premium'] }; } });

/* ---------- People (Crew: the roster board at the gate) ---------- */
/* Attendance today (attDaySummary, as Floor's People card and Needs you read it): the floor's heads against the day's number as the
   figure, the areas short as the verdict, a seat a hand; from Medium, each area a row with its seats and its word (areaNeedTone), and
   who is away. On site against the roster is said beside it (#homeAttOnSite), in its own judge's tone (attOnSiteTone). */
wdgDefine({ id: 'atttoday', title: 'Attendance today', short: 'Attendance', q: 'Is the crew in?', section: 'people', type: 'crew', icon: 'attendance', sizes: ['s', 'm'],
  needs: { page: 'pageStaff' }, go: { tab: 'pageStaff', v: 'day' },
  data: function(ctx) {
    if (!staffActive().length) return { state: 'empty', title: 'No roster yet', body: 'People → Roster holds the crew; a day is marked against it.',
      act: { label: 'Open the roster', action: 'invWdgGo', attrs: ' data-wid="atttoday"' }, attrs: ' id="homeAtt" data-card="attendance"' };
    var d = attDaySummary(), n = d.roster.length, on = d.p + d.half, onTone = attOnSiteTone(d) || null;
    var areas = STAFF_AREAS.filter(function(a) { return a.floor && a.id !== 'flex'; }).map(function(a) {
      var heads = d.byArea[a.id] || 0, need = areaNeedOn(d.iso, a.id);
      return { id: a.id, label: a.label, heads: heads, need: need, tone: areaNeedTone(heads, need), word: areaNeedWord(heads, need) };
    }).filter(function(a) { return a.heads || a.need; });
    var short = areas.filter(function(a) { return a.tone === 'warning'; }), over = areas.filter(function(a) { return a.tone === 'info'; });
    var when = d.today ? '' : attDayName(d.iso) + ' ' + stockShortDate(d.iso) + ': ';
    // From Medium the EXTRA booked stands beside the figure (the canvas's "16 h EXTRA booked"), and an area over its number is said.
    var extra = ctx.size !== 's' && d.extraH > 0.0005 ? ' <span class="inv-reading" data-wc-extra>' + escHtml(wcHours(d.extraH)) + '<span class="inv-unit">h EXTRA booked</span></span>' : '';
    var overSay = ctx.size !== 's' && over.length ? '; ' + over.map(function(a) { return a.label + ' has ' + (a.heads - a.need) + ' over'; }).join(', ') : '';
    if (!d.marked) return { state: 'ok', tone: 'neutral', d: d, areas: areas, attrs: ' id="homeAtt" data-card="attendance"', fig: '&mdash;', say: 'Nothing recorded yet today', sayTone: 'neutral',
      detail: 'The in-time roll fills it' };
    return { state: 'ok', tone: wcWorst([onTone, short.length ? 'warning' : null]) === 'neutral' ? 'ok' : wcWorst([onTone, short.length ? 'warning' : null]), d: d, areas: areas,
      attrs: ' id="homeAtt" data-card="attendance"',
      fig: (d.complement ? wcFigUnit(d.floorHeads, 'of ' + d.complement + ' on the floor', areaNeedTone(d.floorHeads, d.complement)) : wcFigUnit(on, 'of ' + n + ' on site', onTone)) + extra,
      // The areas short of their number, by how many (the canvas's "Short 1 on VAT A2, 1 on the barrel").
      say: when + (short.length ? 'Short ' + short.map(function(a) { return Math.max(0, (a.need || 0) - a.heads) + ' on ' + a.label; }).join(', ') : 'Every area at its number') + overSay,
      sayTone: short.length ? 'warning' : 'ok', detailNotSmall: true,
      detailHtml: '<span data-att-onsite' + (onTone ? ' data-tone="' + onTone + '"' : '') + '>' + figHtml('<span id="homeAttOnSite">' + escHtml(on + '/' + n) + '</span>', onTone) + ' on site</span>' +
        escHtml(' · ' + todoPlural(d.absent.length, 'absent', 'absent') + (d.unmarked ? ', ' + d.unmarked + ' unmarked' : '')) };
  },
  draw: function(d, size) {
    var a = d.d;
    if (!a.marked) return '';
    // Small: a seat a hand the floor needs (its complement), else a hand of the day's roster, filled when on site (the canvas's seats).
    if (size === 's') return '<div class="inv-widget-viz" data-wdg-push>' + (a.complement ? wdgSeatsHtml({ heads: a.floorHeads, need: a.complement, label: a.floorHeads + ' of ' + a.complement + ' on the floor' })
      : wdgSeatsHtml({ heads: a.p + a.half, need: a.roster.length, label: (a.p + a.half) + ' of ' + a.roster.length + ' on site' })) + '</div>';
    var rows = '<div class="inv-crew" data-wdg-list data-noun="area">' + d.areas.map(function(x) {
      return wdgCrewRowHtml({ name: x.label, heads: x.heads, need: x.need, word: x.word, tone: x.tone, attrs: ' data-alloc="' + escHtml(x.id) + '"' + (x.tone ? ' data-tone="' + x.tone + '"' : '') });
    }).join('') + '</div>';
    return rows + (a.absent.length ? '<p class="inv-crew-away" data-wc-away><b>Away:</b> ' + escHtml(a.absent.join(', ')) + '</p>' : '');
  },
  // When the day's rolls came (the canvas's "In-time roll 8:41 AM · the out-time roll is not in yet"), else how it was entered.
  source: function(d) {
    var a = d.d, roll = function(kind) {
      var at = tdyRolls(kind, a.iso).map(function(p) { return tdyArrival(p.text, p.at, a.iso, p); }).filter(function(x) { return x != null; });
      return at.length ? relayClockLabel(Math.min.apply(null, at)) : null;
    };
    if (!a.marked) return { facts: ['No attendance today', 'the rolls and the Day board'] };
    var inAt = roll('in'), outAt = roll('out'), day = a.today ? '' : ' of ' + stockShortDate(a.iso);
    return { facts: [inAt ? 'In-time roll' + day + ' ' + inAt : 'Attendance' + day + ' entered by hand', outAt ? 'out-time roll ' + outAt : a.today ? 'the out-time roll is not in yet' : 'no out-time roll'] };
  } });

/* Attendance by pay week (dashAttendanceByWeek, Attendance → Week's own reading): the share present of the marks typed, a week
   nobody typed a gap, the week running drawn as to date, against the rest-day gate's 90% (the mark). The latest week with marks is
   the figure, judged at the gate's 90% and 80% (figTonePct). Medium eight weeks, Large twenty-six. */
wdgDefine({ id: 'attweek', title: 'Attendance by week', q: 'Is the crew turning up?', section: 'people', type: 'crew', sizes: ['m', 'l'],
  needs: { page: 'pageStaff' }, go: { tab: 'pageStaff', v: 'week' }, card: 'att-weeks',
  data: function(ctx) {
    var n = 8, weeks = dashAttendanceByWeek(n), known = weeks.filter(function(w) { return w.pct != null; });
    if (!known.length) return { state: 'empty', title: 'No attendance in ' + n + ' weeks', body: 'A day is marked on People → Attendance, or read from the supervisor’s rolls.',
      act: { label: 'Open Attendance', action: 'invWdgGo', attrs: ' data-wid="attweek"' } };
    if (known.length < 2) return { state: 'early', title: 'Not enough yet: one pay week recorded', body: 'A trend needs two pay weeks with attendance.' };
    var last = known[known.length - 1], prev = known[known.length - 2], tone = figTonePct(last.pct, 90, 80) || 'neutral';
    var running = last.sat >= localDateStr(), pct = function(v) { return formatNum(v, 1) + '%'; };
    var d = { state: 'ok', tone: tone, weeks: weeks, known: known, last: last, n: n, running: running };
    if (ctx.size === 'l') {
      // The canvas's: the week's share whole (under the gate never rounded up to it), what the gate pays, and the figures beside it.
      var whole = last.pct < 90 ? Math.floor(last.pct) : Math.round(last.pct);
      return Object.assign(d, { headInCol: true, fig: figHtml(escHtml(String(whole)), tone === 'neutral' ? null : tone) + '<span class="inv-unit">' +
        escHtml(running ? '% this week so far' : '% the week to ' + stockShortDate(last.sat)) + '</span>', sayTone: tone,
        say: last.pct >= 90 ? 'Above the 90% gate that pays the rest days in full' : last.pct >= 80 ? 'Under the 90% gate: half the rest days are paid' : 'Under the 80% gate: no rest day is paid' });
    }
    return Object.assign(d, { fig: figHtml(escHtml(pct(last.pct)), tone === 'neutral' ? null : tone),
      say: running ? 'Present this week so far' : 'Present, the week to ' + stockShortDate(last.sat), sayTone: tone, detail: pct(prev.pct) + ' the week to ' + stockShortDate(prev.sat) });
  },
  draw: function(d, size) {
    if (size !== 'l') return '';
    // Large: the week in figures under the figure, the weeks as bars in the middle, and the week by area.
    var today = localDateStr(), last = d.last, end = last.sat < today ? last.sat : today;
    var workDays = attDatesInRange(last.start, end).filter(function(iso) { return attParseIso(iso).getDay() !== 0; }).length;
    var under = d.known.filter(function(w) { return w.pct < 90; }).length, low = d.known.reduce(function(m, w) { return !m || w.pct < m.pct ? w : m; }, null);
    var facts = wdgFactLinesHtml([[last.days + ' of ' + workDays, workDays === 1 ? 'day recorded' : 'days recorded'],
      [under + ' of ' + d.known.length, 'weeks under the gate'], ['W' + attPayWeekNumber(low.start), 'the lowest, at ' + Math.floor(low.pct) + '%']]);
    // The week by area: the days its hands stood there against its number for the days recorded, and the overtime worked there.
    var ah = areaHoursForRange(last.start, end), by = {};
    ah.rows.forEach(function(r) { by[r.id] = r; });
    var days = attDatesInRange(last.start, end).filter(function(iso) { var rec = (S.attendance || {})[iso]; return attParseIso(iso).getDay() !== 0 && rec && Object.keys(rec.marks || {}).length; });
    var rows = STAFF_AREAS.filter(function(a) { return a.floor && a.id !== 'flex'; }).map(function(a) {
      var r = by[a.id] || { workerDays: 0, ot: 0 }, need = days.reduce(function(t, iso) { var n = areaNeedOn(iso, a.id); return n == null ? t : t + n; }, 0);
      var on = Math.round(r.workerDays * 10) / 10, tone = need > 0 && on < need ? 'warning' : null;
      return { cells: [a.label, { text: need > 0 ? formatNum(on, on % 1 ? 1 : 0) + ' of ' + need : formatNum(on, on % 1 ? 1 : 0), tone: tone }, wcHours(r.ot) + ' h'], keep: on > 0 || need > 0 || r.ot > 0.05 };
    }).filter(function(x) { return x.keep; });
    var table = rows.length ? '<p class="inv-widget-cap">This week, by area</p>' + wdgTableHtml(['Area', 'Days on site', 'Overtime'], rows.map(function(x) { return x.cells; }), ' data-wc-areas') : '';
    return wdgColsHtml([facts, wdgVizHtml(' data-wc-weeks'), table], { shape: 'mid' });
  },
  viz: function(d, size, box) {
    var weeks = d.weeks;
    // Each week against the gate, under it in the warning's mark; the week running drawn as to date.
    return chartBars(weeks.map(function(w) {
      return { label: size === 'l' ? 'W' + attPayWeekNumber(w.start) : stockShortDate(w.sat), value: w.pct == null ? null : Math.round(w.pct * 10) / 10, tone: w.pct != null && w.pct < 90 ? 'warning' : 'neutral' };
    }), { unit: 'pct', top: 100, mark: { value: 90, label: 'gate' }, labelHead: 'Week', ariaLabel: 'Attendance by week, ' + d.n + ' weeks',
      maxLabels: size === 'l' ? d.n : null, toDate: weeks.length && weeks[weeks.length - 1].sat >= localDateStr() ? weeks.length - 1 : null, bare: true, w: box.w, h: box.h });
  },
  source: function(d) {
    var w = d.weeks.filter(function(x) { return x.pct != null; }).pop();
    return { facts: ['Marks to ' + stockShortDate(w ? (w.sat > localDateStr() ? localDateStr() : w.sat) : localDateStr()), 'the week Sunday to Saturday', 'weekdays only, as the gate counts them'] };
  } });

/* Overtime by area over the four pay weeks to today (areaHoursForRange, Areas' own Hours by area: each mark's overtime where it was
   worked, by attHoursSplit, and the EXTRA booked to the area): Medium the overtime by area as bars, bare; Large the EXTRA beside it,
   one scale for both. Hours for every role that opens People; the rupees (labourForRange, the labour card's own) only for one that
   sees wages. */
function wcPplOtBars(rows, key, max, head) {
  return chartRankedBars(rows.map(function(r) { return { label: r.label, value: Math.round(r[key] * 10) / 10, display: wcHours(r[key]) + ' h' }; }),
    { unit: 'h', max: max, labelHead: 'Area', valueHead: head, emptyText: 'None in four weeks', bare: true });
}
wdgDefine({ id: 'ot', title: 'Overtime by area', q: 'Where are the extra hours going?', section: 'people', type: 'crew', sizes: ['m', 'l'],
  needs: { page: 'pageStaff' }, go: { tab: 'pageStaff', v: 'areas' }, card: 'ot-areas',
  data: function() {
    var today = localDateStr(), from = isoAddDays(attWeekStartOf(today), -21), ah = areaHoursForRange(from, today);
    if (!ah.rows.length) return { state: 'empty', title: 'No attendance in four weeks', body: 'A day is marked on People → Attendance, or read from the supervisor’s rolls.',
      act: { label: 'Open Attendance', action: 'invSwitchTab', attrs: ' data-tab="pageStaff" data-v="day"' } };
    var ot = ah.rows.reduce(function(s, r) { return s + r.ot; }, 0), extra = ah.rows.reduce(function(s, r) { return s + r.extra; }, 0);
    var byOt = ah.rows.filter(function(r) { return r.ot > 0.05; }).sort(function(a, b) { return b.ot - a.ot; });
    var lab = grdSeesWages() ? labourForRange(from, today) : null;
    return { state: 'ok', tone: 'neutral', rows: ah.rows, ot: ot, extra: extra, from: from, byOt: byOt,
      fig: wcFigUnit(wcHours(ot), 'h overtime'), say: byOt.length ? 'Most in ' + byOt[0].label : 'No overtime in four weeks', sayTone: 'neutral',
      detail: lab ? wcRs(lab.ot) + ' overtime · ' + wcRs(lab.extra) + ' EXTRA' : 'EXTRA ' + wcHours(extra) + ' h' };
  },
  draw: function(d, size) {
    var byEx = d.rows.filter(function(r) { return r.extra > 0.05; }).sort(function(a, b) { return b.extra - a.extra; });
    if (size !== 'l') return d.byOt.length ? wcPplOtBars(d.byOt, 'ot', null, 'Overtime') : '';
    var M = Math.max.apply(null, d.byOt.concat(byEx).map(function(r) { return Math.max(r.ot, r.extra); }).concat([0]));
    // The EXTRA beside the overtime, on one scale, so a bar reads the same in both.
    return wdgColsHtml(['<p class="inv-widget-cap">' + escHtml('Overtime · ' + wcHours(d.ot) + ' h') + '</p>' + wcPplOtBars(d.byOt, 'ot', M, 'Overtime'),
      '<p class="inv-widget-cap">' + escHtml('EXTRA booked · ' + wcHours(d.extra) + ' h') + '</p>' + wcPplOtBars(byEx, 'extra', M, 'EXTRA')]);
  },
  source: function() { return { facts: ['Attendance, four weeks to ' + stockShortDate(localDateStr()), 'overtime where it was worked'] }; } });


/* ---------- Market and the world outside (Outside: a news wire on the desk; §9) ----------
   The world outside is to know: an Outside card is never edged or tinted (its tone is info at most), and its Source always says where
   it comes from and how fresh, with its Refresh and the feed's credit where the feed's terms ask for one (§24e). */
/* What a feed says when it has no copy to show (feeds.js: a state and its blank {kind, title, body, action}), as the widget's one
   blank state: its door (Settings for an ID that may change it, else the guide) is the Act. */
function wcFeedBlank(r, attrs) {
  var b = (r && r.blank) || {}, a = String(b.action || '');
  var act = /invFeedSettings/.test(a) ? { label: 'Settings', action: 'invFeedSettings' } : /invFeedGuide/.test(a) ? { label: 'Guide', action: 'invFeedGuide' } : null;
  return { state: r && r.state && r.state !== 'ok' ? r.state : 'empty', title: b.title || '', body: b.body || '', act: act, attrs: attrs || '' };
}
/* A feed's Source (§24f): its credit (a link, as its licence asks), how old its copy is (the Worker's last copy, offline), Refresh,
   then what else it reads. */
function wcFeedSource(kind, r, facts) {
  var cr = typeof FEED_CREDIT !== 'undefined' ? FEED_CREDIT[kind] : null;
  // How old the copy is, bare beside the credit (the canvas's "MET Norway · 10 min ago"): feedAge's own words without its "from".
  var ago = r && r.age && r.age.ago ? r.age.ago : r && r.ago ? r.ago : '';
  var age = ago ? ago + (r.stale ? ', the Worker’s last copy' : '') + (r.offline ? ', offline' : '') : '';
  return { parts: [cr ? { credit: { label: cr.name, href: cr.url } } : null, age, { refresh: kind, busy: !!(r && r.busy) }].concat(facts || []),
    attrs: ' data-feed-age="' + kind + '"' };
}
/* The seam the risk widget reads (§7d `risk`): today's hours the forecast holds thunder in, 0 to 23, or null with no forecast to
   read (a feed not set up, offline, not fetched yet). */
function wcThunderHours() {
  if (typeof feedThunderToday !== 'function') return null;
  var t = feedThunderToday();
  return t && t.state === 'ok' && Array.isArray(t.hours) ? t.hours.slice() : null;
}
/* The next hours as columns (the canvas's strip): at Small six, the temperature over the hour; from Medium twelve, the hour over its sky
   and its temperature. A thunder hour is tinted in info, the world outside's tone at most; every hour says itself in its title. */
function wcWxHoursHtml(hours, small) {
  return '<div class="inv-wx-hours"' + (small ? ' data-six' : '') + ' role="list" aria-label="The hours ahead">' + hours.map(function(h) {
    var said = h.time + ': ' + [h.word, h.tempText, h.rain > 0 ? formatNum(h.rain, 1) + ' mm' : ''].filter(Boolean).join(', ');
    var t = '<span class="inv-wx-hour-t">' + escHtml(h.time) + '</span>', c = '<span class="inv-wx-hour-c">' + escHtml(h.tempText) + '</span>';
    return '<div class="inv-wx-hour" role="listitem"' + (h.thunder ? ' data-storm' : '') + ' title="' + escHtml(said) + '" aria-label="' + escHtml(said) + '">' +
      (small ? c + t : t + iconSvg(h.icon, 'inv-wx-ico') + c) + '</div>';
  }).join('') + '</div>';
}
/* The rain still to fall today, from the hours the copy holds: its sum and the hour it stops (the canvas's "6 mm of rain by 7 PM"), or
   null with none. */
function wcWxRainAhead(w) {
  var today = localDateStr(), wet = (w.hours || []).filter(function(h) { return h.iso === today && h.rain > 0; });
  if (!wet.length) return null;
  var mm = wet.reduce(function(s, h) { return s + h.rain; }, 0), last = wet[wet.length - 1];
  return { mm: mm, text: mm >= 1 ? String(Math.round(mm)) : formatNum(mm, 1), by: feedHourText(last.h + 1) };
}
/* The weather at the plant (§9, MET Norway through the feeds Worker; the canvas's Outside board): the temperature now with today's
   window of thunder or rain still to come (at Small) or the sky (from Medium, with the rain still to fall); the verdict the window and,
   once 30 days are kept, how many of the last ten cuts fell on a day thunder was forecast; the next six hours at Small, twelve from
   Medium, then the two counts set side by side as rows, never a cause (feedWeatherCutDays). Thunder is info at most here: the world
   outside is to know, and the risk widget sets it against the plant's own cuts. */
wdgDefine({ id: 'weather', title: 'Weather at the plant', short: 'Weather', q: 'Will a storm bring a power cut?', section: 'market', type: 'outside', icon: 'storm', sizes: ['s', 'm'],
  go: { tab: 'pagePower', v: 'causes' }, card: 'weather', feed: true,
  data: function(ctx) {
    var w = feedWeather();
    if (w.state !== 'ok') return wcFeedBlank(w);
    var t = w.today || {}, win = (t.windows || [])[0] || null, cut = feedWeatherCutDays(), small = ctx.size === 's';
    var range = t.tMax != null && t.tMin != null ? Math.round(t.tMin) + '°–' + Math.round(t.tMax) + '°' : '';
    var when = win ? win.say.replace(/^(thunder|rain) /, '') : '', kind = win ? (win.kind === 'thunder' ? 'Thunder' : 'Rain') : '';
    var storms = cut.state === 'ok' && cut.cuts ? cut.stormCuts + ' of the last ' + todoPlural(cut.cuts, 'cut') : '';
    var sky = w.now.word ? w.now.word + ' now' + (range ? ' · ' + range : '') : range ? range + ' today' : '';
    var rain = wcWxRainAhead(w);
    var say = small ? (storms ? 'Thunder days: ' + storms : sky || (win ? kind + ' likely ' + when : 'No rain forecast for the rest of today'))
      : [win ? kind + ' likely ' + when : 'No rain forecast for the rest of today', storms ? storms + ' fell on a thunder day' : ''].filter(Boolean).join('; ');
    var reading = small ? '' : rain ? '<span class="inv-reading" data-wx-rain>' + escHtml(rain.text) + '<span class="inv-unit">' + escHtml('mm of rain by ' + rain.by) + '</span></span>'
      : range ? '<span class="inv-reading" data-wx-range>' + escHtml(range) + '<span class="inv-unit">today</span></span>' : '';
    var unit = small ? (win ? win.say : wcLc(w.now.word || '')) : wcLc(w.now.word || '');
    return { state: 'ok', tone: 'neutral', w: w, cut: cut,
      fig: wcFigUnit(w.now.tempText, unit) + (reading ? ' ' + reading : ''),
      say: say, sayTone: win || storms ? 'info' : 'neutral', sayAttrs: ' data-wx-line' };
  },
  draw: function(d, size) {
    var w = d.w, small = size === 's';
    var hours = w.hours.length ? '<div class="inv-widget-viz"' + (small ? ' data-wdg-push' : '') + '>' + wcWxHoursHtml(small ? w.hours.slice(0, 6) : w.hours, small) + '</div>' : '';
    if (small) return hours;
    // The two counts side by side, once 30 days are kept (§9d); before that, how many days are kept.
    var c = d.cut, rows = c.state === 'ok'
      ? [{ label: 'Cut days with rain, the last 30 days', value: c.cutDays ? c.wetCutDays + ' of ' + c.cutDays : 'no cut' },
        { label: c.cuts ? 'The last ' + todoPlural(c.cuts, 'cut') + ', on a thunder day' : 'Cuts on a thunder day', value: c.cuts ? c.stormCuts + ' of ' + c.cuts : 'no cut' }]
      : [{ label: 'Days of forecast kept, to set beside the cuts', value: c.kept + ' of ' + c.need }];
    return hours + wdgWireFigsHtml(rows, ' data-wx-cutdays');
  },
  source: function(d) { return wcFeedSource('weather', d.w, ['at the plant’s place']); } });

/* Tata Motors, Jamshedpur (§9c): the latest month typed from its release, heavy trucks, exports and all CVs with their change on last
   year, and the plant's week; at Large the months this year against last (a chart, bare) and the headlines (GDELT), the models
   followed its Choose (§24f: the chips left the foot), in three columns from 60rem of card, two from 36rem. Its head opens the Tata
   dialog, where a month is typed (the settings permission's) and every headline read; More opens it on the model picked. Up is ok
   (more trucks built is more work for the clients who plate for them), down a warning, said on the figure; the card is info at most. */
var WC_TATA_FIGS = ['hcv', 'cvExport', 'cvTotal'];
function wcTataFigs(L) {
  var by = {};
  (L.figs || []).forEach(function(f) { by[f.key] = f; });
  return WC_TATA_FIGS.map(function(k) { return by[k]; }).filter(function(f) { return f && f.now != null; });
}
function wcTataMonths() {
  var pick = ['hcv', 'cvTotal'].map(function(k) { var m = mktTataMonths(k, 13); return { k: k, m: m, n: m.rows.filter(function(r) { return r.now != null; }).length }; })
    .sort(function(a, b) { return b.n - a.n; })[0];
  return pick && pick.n >= 2 ? pick.m : null;
}
/* A change on last year as the card says it beside a figure: "+9.6%", "−4.1%". */
function wcTataChg(f) { return f.pct == null ? '' : (f.pct > 0 ? '+' : f.pct < 0 ? '\u2212' : '') + Math.abs(f.pct).toFixed(1) + '%'; }
/* A headline's dateline as a wire writes it (the canvas's "17 Oct 09:12"): its day and, where the feed gave one, its time on this
   device's clock, in 24 hours. */
function wcDateline(at) {
  var d = at ? new Date(at) : null;
  if (!d || !isFinite(d.getTime())) return '';
  var day = feedShortDay(at), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return /T\d\d:\d\d/.test(String(at)) && !/T00:00(:00)?(\.0+)?Z?$/.test(String(at)) ? day + ' ' + hm : day;
}
/* The lead's verdict (the canvas's "September, up 12.7% on last year"). */
function wcTataSay(f, month) {
  var mon = mktMonthName(month);
  return f.dir == null ? mon + ': no year before to set it against' : f.dir === 'flat' ? mon + ', level with last year' : mon + ', ' + (f.dir === 'up' ? 'up ' : 'down ') + Math.abs(f.pct).toFixed(1) + '% on last year';
}
wdgDefine({ id: 'tata', title: 'Tata Motors, Jamshedpur', q: 'How is the demand our clients build for?', section: 'market', type: 'outside', icon: 'truck', sizes: ['l', 'm'],
  go: function() { mktTataOpen(); }, card: 'tata', feed: true,
  choose: { def: '', label: 'Model', opts: function() { return [{ v: '', label: 'All models' }].concat(mktRead().models.map(function(w) { return { v: String(w), label: String(w) }; })); } },
  // More: every headline, in the Tata dialog on the model picked.
  more: function(d) {
    mktTataOpen();
    if (typeof _mktDlg === 'object' && _mktDlg) { _mktDlg.model = d && d.model ? d.model : ''; mktPartRedraw('news'); }
  },
  data: function(ctx) {
    var L = mktTataLatest(), figs = L.state === 'ok' ? wcTataFigs(L) : [], large = ctx.size === 'l', model = large ? ctx.choose || '' : '';
    var news = feedNews({ n: 8, model: model || undefined });
    if (!figs.length && !(news && news.state === 'ok')) {
      return { state: 'empty', title: L.due ? mktMonthName(L.due) + '’s figures are not typed yet' : 'No month of Tata’s figures yet',
        body: 'Each month Tata Motors’ release prints its CVs: all of them, those sold in India, exports and heavy trucks.',
        act: mktCanEdit() ? { label: 'Type them', action: 'invWdgGo', attrs: ' data-wid="tata"' } : null };
    }
    var lead = figs[0], rank = { warning: 2, ok: 1, neutral: 0 };
    var tone = figs.reduce(function(t, f) { return (rank[f.tone] || 0) > (rank[t] || 0) ? f.tone : t; }, 'neutral');
    var unit = lead ? (MKT_FIGS.filter(function(f) { return f.key === lead.key; })[0] || {}).say || '' : '';
    // The figure with what it counts (the canvas's "12,071 heavy trucks"), its verdict the month and its change on last year.
    return { state: 'ok', tone: tone === 'neutral' ? 'neutral' : 'info', L: L, figs: figs, news: news, model: model, week: mktPlantWeek(), headInCol: large,
      fig: lead ? figHtml(escHtml(mktFmt(lead.now)), lead.tone === 'ok' || lead.tone === 'warning' ? lead.tone : null) + (unit ? '<span class="inv-unit">' + escHtml(unit) + '</span>' : '') : '',
      say: lead ? wcTataSay(lead, L.month) : L.due ? mktMonthName(L.due) + '’s figures are not typed yet' : 'No month of Tata’s figures yet', sayTone: lead ? lead.tone : 'neutral',
      detail: lead && L.due && L.due !== L.month ? mktMonthName(L.due) + '’s figures are due' : '' };
  },
  draw: function(d, size) {
    var rest = d.figs.slice(1), n = d.news, tone = function(f) { return f.tone === 'ok' || f.tone === 'warning' ? f.tone : null; };
    if (size !== 'l') {
      // Medium (the canvas's phone): the other figures on one line, the months bare, and the headlines a row that reads them.
      var facts = rest.length ? '<p class="inv-brief-facts" data-tata-figs>' + rest.map(function(f) {
        return '<span class="inv-nowrap">' + escHtml(f.label) + ' <b>' + escHtml(mktFmt(f.now)) + '</b>' + (wcTataChg(f) ? ' ' + figHtml(escHtml(wcTataChg(f)), tone(f)) : '') + '</span>';
      }).join('<span aria-hidden="true"> · </span>') + '</p>' : '';
      var read = n && n.state === 'ok' && n.items.length ? '<div class="inv-widget-more"><button type="button" class="inv-widget-more-btn" data-action="invWdgMore" data-wid="tata">' +
        escHtml('Read ' + todoPlural(n.items.length, 'headline')) + iconSvg('next', 'inv-widget-chev') + '</button></div>' : '';
      return facts + (wcTataMonths() ? wdgVizHtml() : '') + read;
    }
    var rows = rest.length ? wdgWireFigsHtml(rest.map(function(f) { return { label: f.label, value: mktFmt(f.now), chg: wcTataChg(f), tone: f.tone }; }), ' data-tata-figs') : '';
    var week = '<p class="inv-widget-cap">The plant’s week</p>' + mktWeekHtml(d.week);
    var heads = n && n.state === 'ok' ? wdgWireHtml(n.items.map(function(it) { return { title: it.title, url: it.url, site: it.source, when: wcDateline(it.at) || it.when }; }), ' data-tata-news')
      : uiBlankHtml(Object.assign({ small: true }, (n && n.blank) || { kind: 'empty', title: 'No headlines yet' }));
    var m = wcTataMonths();
    return wdgColsHtml([rows + week, m ? '<p class="inv-widget-cap">' + escHtml(m.label + ', month by month') + '</p>' + wdgVizHtml() : '',
      '<p class="inv-widget-cap">The headlines</p>' + heads], { drop: 1 });
  },
  // The months this year against the year before, bare, in the room its column leaves: plain lines (the canvas's), the year on the
  // first and last month; at Medium the months along the foot alone.
  viz: function(d, size, box) {
    var m = wcTataMonths();
    if (!m) return '';
    var last = m.rows.length - 1, large = size === 'l';
    var labels = m.rows.map(function(r, i) { return i === 0 || i === last ? r.label + ' \u2019' + r.month.slice(2, 4) : r.label; });
    return chartLines(labels, [
      { label: 'This year', values: m.rows.map(function(r) { return r.now; }), slot: 1 },
      { label: 'A year before', values: m.rows.map(function(r) { return r.ly; }), slot: 'other', dashed: true }],
    { unit: 'count', fit: true, labelHead: 'Month', ariaLabel: m.label + ' each month, this year against the year before', keys: m.rows.map(function(r) { return r.month; }),
      bare: true, w: box.w, h: box.h, quiet: true, keyPlain: true, axisY: large, key: large, maxLabels: large ? 5 : 3, labelEnds: true,
      tickFmt: function(v) { return Math.abs(v) >= 1000 ? formatNum(v / 1000, Math.abs(v) % 1000 ? 1 : 0) + 'k' : formatNum(v, 0); } });
  }, vizAt: ['l', 'm'],
  source: function(d, size) {
    var typed = d.L && d.L.state === 'ok' ? ['figures typed from the ' + mktMonthName(d.L.month) + ' release'] : [];
    if (d.news && d.news.state !== 'notset') return wcFeedSource('news', d.news, size === 'l' ? typed : []);
    return { facts: typed.length ? typed : ['Tata Motors’ monthly release'] };
  } });

/* ---------- Analysis ---------- */
/* Does one move the other (§7d `corr`): two figures of the daily view (§6, dataview.js), each day both are known over the last 26
   weeks, at the coarser grain of the two (a week: minutes and hours summed, the rest averaged), their dots, the least-squares line
   and its words. Under 10 points it is early. The pair is its Choose (§24f): at Large its two pickers in the head, at Medium one
   button naming the pair that opens them; kept per person with the layout (wdgOpts). A pattern, not proof. */
var WC_CORR_DAYS = 182, WC_CORR_MIN = 10;
var WC_CORR_STEP = { cutMin: [60, 'each hour dark'], heads: [1, 'each head on site'], otHours: [10, 'each 10 overtime hours'],
  zinc: [10, 'each ₹10 a kilo on zinc'], invSize: [10000, 'each ₹10,000 on an invoice'] };
var WC_CORR_WEEK = { cutMin: 'sum', otHours: 'sum', tonnes: 'sum' };
var WC_CORR_MANY = { cutMin: 1, heads: 1, otHours: 1, tonnes: 1, dtp: 1 };
var WC_CORR_UNIT = { min: 'min', count: 'count', h: 'h', '₹/kg': 'rate', '₹': 'money', t: 'kg', days: 'count', '%': 'pct' };
/* The series a role may pick: a money series only with money, days to pay only with a statement. */
function wcCorrSeries() {
  return dvCols('daily').filter(function(c) {
    if (!c.grain) return false;
    var n = c.needs || {};
    if (n.money && !wdgSeesMoney()) return false;
    if (n.statement && !(typeof finHasBank === 'function' && finHasBank())) return false;
    return true;
  });
}
function wcCorrPair(opts) {
  var s = wcCorrSeries(), across = s.filter(function(c) { return c.dir === 'across'; }), up = s.filter(function(c) { return c.dir === 'up'; });
  var pick = function(list, want, dflt) {
    return list.filter(function(c) { return c.name === want; })[0] || list.filter(function(c) { return c.name === dflt; })[0] || list[0] || null;
  };
  return { x: pick(across, opts && opts.x, 'cutMin'), y: pick(up, opts && opts.y, 'tonnes'), across: across, up: up };
}
function wcCorrRead(xc, yc) {
  return wdgMemo('corr:' + xc.name + ':' + yc.name, function() {
    var weekly = xc.grain === 'week' || yc.grain === 'week', from = isoAddDays(localDateStr(), 1 - WC_CORR_DAYS);
    var rows = dvRows('daily').filter(function(r) { return r.date >= from; }), pts = [];
    // Tonnes are drawn as kilograms (the axis then reads 2.4t), and said in tonnes.
    var val = function(c, v) { return c.unit === 't' ? v * 1000 : v; };
    if (!weekly) {
      rows.forEach(function(r) { if (r[xc.name] != null && r[yc.name] != null) pts.push({ x: val(xc, r[xc.name]), y: val(yc, r[yc.name]), label: stockShortDate(r.date) }); });
    } else {
      var by = {}, order = [];
      rows.forEach(function(r) { if (!by[r.week]) { by[r.week] = []; order.push(r.week); } by[r.week].push(r); });
      var agg = function(list, c) {
        var v = list.map(function(r) { return r[c.name]; }).filter(function(x) { return x != null; });
        if (!v.length) return null;
        var s = v.reduce(function(a, b) { return a + b; }, 0);
        return WC_CORR_WEEK[c.name] === 'sum' ? s : s / v.length;
      };
      order.sort().forEach(function(wk) {
        var xv = agg(by[wk], xc), yv = agg(by[wk], yc);
        if (xv != null && yv != null) pts.push({ x: val(xc, xv), y: val(yc, yv), label: 'Week to ' + stockShortDate(wk) });
      });
    }
    return { weekly: weekly, from: from, pts: pts, fit: chartFit(pts) };
  });
}
/* A figure in its series' unit, for the words (the axis has its own). */
function wcCorrSay(v, unit) {
  var a = Math.abs(v);
  if (unit === '₹') return formatInrShort(a);
  if (unit === '₹/kg') return formatCurrency(a) + ' a kilo';
  if (unit === 't') return formatNum(a, a < 10 ? 2 : 1) + ' t';
  if (unit === '%') return formatNum(a, 1) + ' points';
  if (unit === 'days') return formatNum(a, 1) + ' days';
  if (unit === 'h') return formatNum(a, 1) + ' h';
  if (unit === 'min') return formatNum(a, 0) + ' min';
  return formatNum(a, a < 10 ? 2 : 1);
}
function wcCorrWords(xc, yc, rd) {
  var f = rd.fit, r = f ? f.r : null;
  if (r == null) return { word: 'No pattern', line: 'No pattern: one of the two did not move', sub: '' };
  var a = Math.abs(r), word = a >= 0.7 ? 'Strong' : a >= 0.4 ? 'Moderate' : a >= 0.2 ? 'Weak' : 'No pattern';
  var xl = xc.label.toLowerCase(), yl = yc.label.toLowerCase();
  // A figure named in the plural (minutes, heads, hours, tonnes, days) rise; one in the singular (a price, a size, realisation) rises.
  var many = function(c) { return WC_CORR_MANY[c.name] === 1; };
  var line = word === 'No pattern' ? 'No pattern between ' + xl + ' and ' + yl
    : word + ': as ' + xl + (many(xc) ? ' rise, ' : ' rises, ') + yl + (r > 0 ? (many(yc) ? ' rise' : ' rises') : (many(yc) ? ' fall' : ' falls'));
  var st = WC_CORR_STEP[xc.name] || [1, 'each step'], perX = xc.unit === 't' ? 1000 : 1, perY = yc.unit === 't' ? 1000 : 1;
  var dy = f.slope * st[0] * perX / perY;
  var sub = word === 'No pattern' ? '' : wcCap(st[1]) + ': ' + yl + ' ' + wcCorrSay(dy, yc.unit) + (dy >= 0 ? ' higher' : ' lower');
  return { word: word, line: line, sub: sub };
}
/* The two pickers (the Choose at Large, and the pair's dialog): compact in a card's head on the desktop. */
function wcCorrPicksHtml(p, compact) {
  var sel = function(k, list, on) {
    var lab = k === 'x' ? 'Across' : 'Up';
    return '<label class="inv-field inv-corr-pick"><span class="inv-field-label' + (compact ? ' inv-visually-hidden' : '') + '">' + lab + '</span><select class="inv-select' + (compact ? ' inv-select-sm' : '') +
      '" data-corr="' + k + '" aria-label="' + (k === 'x' ? 'The figure across' : 'The figure up') + '">' + list.map(function(c) {
        return '<option value="' + escHtml(c.name) + '"' + (c.name === on.name ? ' selected' : '') + '>' + escHtml(c.label) + '</option>';
      }).join('') + '</select></label>';
  };
  // Each pick is kept as it is made: nothing typed waits to be saved (data-nodirty), in a dialog or on the page.
  return '<div class="inv-corr-picks' + (compact ? ' inv-corr-picks-sm' : '') + '" data-corr-picks data-nodirty>' + sel('x', p.across, p.x) + sel('y', p.up, p.y) + '</div>';
}
wdgDefine({ id: 'corr', title: 'Does one move the other?', q: 'Pick two figures; see if they travel together.', section: 'analysis', type: 'brief', sizes: ['l', 'm'],
  card: 'corr',
  // Its Choose is the pair (§24f): the two pickers at Large, one button naming the pair at Medium.
  choose: { at: ['m', 'l'], label: 'The pair', html: function(ctx) {
    var p = wcCorrPair(ctx.opts);
    if (!p.x || !p.y) return '';
    if (ctx.size === 'l') return wcCorrPicksHtml(p, true);
    return '<button type="button" class="inv-btn inv-btn-tint inv-btn-sm inv-corr-pair" data-action="invWdgCorrPair" data-wid="corr" data-corr-pair>' + escHtml(p.x.label + ' · ' + p.y.label) + '</button>';
  } },
  act: function(action, btn, card) {
    if (action !== 'invWdgCorrPair') return false;
    var board = card && card.closest('.inv-wboard') ? card.closest('.inv-wboard').dataset.board : (btn.dataset.board || 'home');
    var p = wcCorrPair(wdgOpts(board, 'corr'));
    dialogOpen('<div class="inv-dialog" role="dialog" aria-modal="true" aria-label="The two figures" data-wdg-for="corr" data-board="' + escHtml(board) + '">' +
      dialogHeadHtml('The two figures', 'invCloseOverlay', 'Close') + '<div class="inv-dialog-body"><p class="inv-note">Across is the one that may move the other, up the one it may move. ' +
      'Each pick redraws the widget behind this.</p>' + wcCorrPicksHtml(p) + '</div>' +
      '<div class="inv-dialog-foot"><button type="button" class="inv-btn inv-btn-primary" data-action="invCloseOverlay">Done</button></div></div>', { dismiss: true });
    return true;
  },
  change: function(el, card, board) {
    var k = el.getAttribute('data-corr');
    if (k !== 'x' && k !== 'y') return false;
    board = board || (card && card.closest('.inv-wboard') ? card.closest('.inv-wboard').dataset.board : 'home');
    var o = Object.assign({}, wdgOpts(board, 'corr'));
    o[k] = el.value;
    wdgOptsPut(board, 'corr', o);
    if (card && card.isConnected) keepScroll(function() { wdgRedrawOne(card); });
    return true;
  },
  data: function(ctx) {
    var p = wcCorrPair(ctx.opts);
    if (!p.x || !p.y) return { state: 'empty', title: 'No two figures to set side by side yet' };
    var rd = wcCorrRead(p.x, p.y);
    // Early still draws the card with its pair, so another pair can be tried.
    if (rd.pts.length < WC_CORR_MIN) return { state: 'ok', tone: 'neutral', p: p, rd: rd, early: true, say: 'Not enough yet: ' + rd.pts.length + ' of ' + WC_CORR_MIN + ' ' + (rd.weekly ? 'weeks' : 'days') + ' with both',
      sayTone: 'neutral', detail: p.x.label + ' across, ' + p.y.label.toLowerCase() + ' up' };
    var words = wcCorrWords(p.x, p.y, rd);
    return { state: 'ok', tone: 'neutral', p: p, rd: rd, words: words, say: words.line, sayTone: 'info', sayAttrs: ' data-corr-line',
      detail: [words.sub, 'a pattern, not proof it is the cause'].filter(Boolean).join(' · ') };
  },
  draw: function() { return ''; },
  viz: function(d, size, box) {
    if (d.early) return '';
    var p = d.p;
    return chartScatter([{ key: 'pair', label: p.x.label + ' and ' + p.y.label, points: d.rd.pts, slot: 1 }], {
      xUnit: WC_CORR_UNIT[p.x.unit] || 'count', yUnit: WC_CORR_UNIT[p.y.unit] || 'count', xLabel: p.x.label, yLabel: p.y.label, fit: true,
      pointHead: d.rd.weekly ? 'Week' : 'Day', ariaLabel: p.x.label + ' against ' + p.y.label, bare: true, w: box.w, h: box.h });
  },
  source: function(d) {
    return { facts: [d.rd.weekly ? 'Week by week' : 'Day by day, working days', todoPlural(d.rd.pts.length, 'point') + ' from ' + stockShortDate(d.rd.from)] };
  } });

/* What each client pays a kilo (§7d `clientprice`): the period's clients, worst first, each against the full cost (the mark) and the
   variable cost (labour is fixed: everything but labour, statsClientMargins), the ranked bars bare, each row opening its client.
   Coded by the large accounts (10% of the tonnes or more) under the cost, as Stats' By client is. */
wdgDefine({ id: 'clientprice', title: 'What each client pays a kilo', q: 'Who clears the cost, who does not?', section: 'analysis', type: 'ledger', sizes: ['l', 'm'],
  needs: { page: 'pageStats', money: true }, go: { tab: 'pageStats', v: 'clients' }, card: 'clientprice',
  data: function(ctx) {
    var a = wcPulseArgs(ctx.period), m = wdgMemo('margins:' + ctx.period, function() { return statsClientMargins(ctx.period, a.filtered, a.tonnage); });
    if (!m || !m.ranked.length) return { state: 'empty', title: 'No weighed tonnage in this period', body: 'A client’s price a kilo needs its invoices weighed: Parts holds the weights.' };
    var large = function(x) { return x.kg >= m.kg * 0.1; }, rank = { danger: 3, warning: 2, ok: 1 };
    var tone = m.ranked.filter(large).reduce(function(t, x) { var k = figToneAgainst(x.net, m.fullKg, 5) || 'ok'; return (rank[k] || 0) > (rank[t] || 0) ? k : t; }, 'ok');
    var below = m.ranked.filter(function(x) { return x.net < m.fullKg - 0.005; }), w = m.ranked.filter(large)[0] || null;
    return { state: 'ok', tone: tone, m: m, a: a, fig: wcFigUnit(below.length + ' of ' + m.ranked.length, 'below cost'),
      say: (below.length ? 'Below' : 'None below') + ' the full cost of ' + formatCurrency(m.fullKg) + '/kg', sayTone: below.length ? tone : 'ok',
      detail: 'Variable ' + formatCurrency(m.varKg) + '/kg, labour fixed' + (w && w.net < m.fullKg ? ' · the worst large account ' + w.name + ' at ' + formatCurrency(w.net) + '/kg' : '') };
  },
  draw: function(d) {
    // Every client, worst first: the card keeps the rows its size holds and says how many more (wdgFit).
    var m = d.m, list = m.ranked;
    var max = Math.max(m.fullKg * 1.2, Math.max.apply(null, list.map(function(x) { return x.net; })));
    var barTone = function(x) { var t = figToneAgainst(x.net, m.fullKg, 5); return t && t !== 'ok' ? t : 'good'; };
    return '<div data-wdg-list data-noun="client">' + chartRankedBars(list.map(function(x) {
      return { label: x.name, value: x.net, display: formatCurrency(x.net) + '/kg', tone: barTone(x), markPct: m.fullKg / max * 100,
        sub: Math.round(x.kg / m.kg * 100) + '% of the tonnes · ' + (x.vsVar >= 0 ? '+' : '−') + formatCurrency(Math.abs(x.vsVar)) + ' on the variable cost',
        action: 'invStatsClientDrill', clientId: x.id };
    }), { unit: 'rate', max: max, labelHead: 'Client', valueHead: '₹ a kilo', ariaLabel: 'What each client pays a kilo against the full cost', bare: true }) + '</div>';
  },
  source: function(d, size, ctx) {
    return { facts: ['Invoices, ' + (PERIOD_LABELS[ctx.period] || 'the period').toLowerCase(), 'the live cost ' + Math.round(d.m.c.measuredShare * 100) + '% measured', 'labour fixed']
      .concat(d.m.apart.length ? [d.m.apart.length + ' not ranked: under 90% weighed'] : []) };
  } });

/* Where a kilo's cost goes (§7d `kilo`): the period's live cost a kilo, a rate with its paise, and how much of it is measured; from
   Medium its parts as one bar of 100% (chartShareBar; a part's colour its own on every cost chart, seriesSlot 'cost'); at Large each
   part's ₹ a kilo as statement lines adding up to it. Coded by the share measured, as Stats' Cost is. */
var WC_KILO_TONE = function(share) { return share >= 0.9 ? 'ok' : share >= 0.5 ? 'warning' : 'danger'; };
wdgDefine({ id: 'kilo', title: 'Where a kilo’s cost goes', short: 'A kilo’s cost', q: 'Which part of the cost is moving?', section: 'analysis', type: 'ledger', sizes: ['m', 's', 'l'],
  needs: { page: 'pageStats', money: true }, go: { tab: 'pageStats', v: 'cost' }, card: 'kilo',
  data: function(ctx) {
    var a = wcPulseArgs(ctx.period), kg = a.tonnage ? a.tonnage.kg : 0;
    if (!(kg > 0)) return { state: 'empty', title: 'No weighed tonnage in this period', body: 'A kilo’s cost is the period’s cost over the kilos plated and billed.' };
    var c = wdgMemo('livecost:' + ctx.period, function() { var r = statsRangeIso(ctx.period); return liveCost(r.from, r.to, kg); });
    if (c.perKg == null) return { state: 'empty', title: 'No cost recorded for this period' };
    var pct = Math.round(c.measuredShare * 100), tone = WC_KILO_TONE(c.measuredShare);
    return { state: 'ok', tone: tone, c: c, fig: wcFigUnit(formatCurrency(c.perKg), '/kg'), say: pct + '% of it measured', sayTone: tone,
      detail: 'Over ' + formatNum(c.kg / 1000, 1) + ' t plated and billed', detailNotSmall: true };
  },
  draw: function(d, size) {
    if (size === 's') return '';
    var c = d.c, rows = c.rows.filter(function(r) { return r.amount > 0; });
    var bar = '<div class="inv-widget-viz">' + chartShareBar(rows.map(function(r) { return { label: r.label, v: r.amount, slot: seriesSlot('cost', r.key) }; }), 'Where a kilo’s cost goes') + '</div>';
    if (size !== 'l') return bar;
    return bar + wdgLedgerHtml(rows.map(function(r) {
      return { label: r.label, meta: Math.round(r.amount / c.total * 100) + '% · ' + (COST_SRC_LABEL[r.source] || r.source || ''), amt: gstRound(r.perKg, 2), attrs: ' data-kilo-part="' + escHtml(r.key) + '"' };
    }), { label: 'A kilo', amt: gstRound(c.perKg, 2) }, { rate: true, unit: '/kg', noun: 'part', attrs: ' data-kilo-parts' });
  },
  source: function(d, size, ctx) { return { facts: ['Live cost, ' + (PERIOD_LABELS[ctx.period] || 'the period').toLowerCase(), Math.round(d.c.measuredShare * 100) + '% measured'] }; } });

/* ---------- The questions (Briefing: a briefing note on the desk at nine; Pulse's, folded into Home: §8c) ----------
   Each question a widget: Small its answer as a sentence, its key figure in its tone, with its picture; Medium the story's sentences,
   its first move the Act with Add to my list beside it; Large every move as a card in a well, those that do not fit one More that opens
   the question. Its head opens the whole of it, every move, in a dialog. The questions read money in every figure, so each is money's. */
var WC_QUESTIONS = [
  { k: 'smooth', title: 'Is the plant running smoothly?', short: 'Running well?', q: 'Stock, power, staffing, records, the payout and the backup, in one answer', sizes: ['m', 's', 'l'], icon: 'efficiency' },
  { k: 'money', title: 'Are we making money?', short: 'Making money?', q: 'Realisation and what a kilo leaves, against the cost', sizes: ['s', 'm', 'l'], icon: 'money' },
  { k: 'clients', title: 'Who is driving it?', short: 'Who drives it?', q: 'The accounts that fill the plant, and the one priced worst', sizes: ['m', 's', 'l'], icon: 'client' },
  { k: 'plant', title: 'Is the plant full?', short: 'Plant full?', q: 'Capacity used, and the tonnes spare', sizes: ['m', 's', 'l'], icon: 'scale' },
  { k: 'cash', title: 'Is cash coming in?', short: 'Getting paid?', shortDesk: 'Cash coming in?', q: 'What is owed, how fast it comes and the account’s low point', sizes: ['m', 's', 'l'], bank: true, icon: 'owed' },
  { k: 'changed', title: 'What changed?', short: 'What changed?', q: 'The month’s pace and what has moved most', sizes: ['m', 's', 'l'], icon: 'activity' }
];
function wcQuestion(k) { return tdyQuestions().filter(function(x) { return x.key === k; })[0] || null; }
/* The story as a card on the board tells it (Medium): its sentences and rows, without the tiles and charts that restate the answer's
   figure and its picture above them, its amounts short. The whole story is the dialog's, which the head opens. */
function wcStoryBrief(html, noMoves) {
  var t = document.createElement('template');
  t.innerHTML = html || '';
  // At Large the moves are What you can do's cards beside the story: an insight's own moves are left out of it.
  if (noMoves) Array.prototype.forEach.call(t.content.querySelectorAll('[data-adv-for]'), function(box) { box.remove(); });
  Array.prototype.forEach.call(t.content.querySelectorAll('.inv-tiles, .inv-chart-box, [data-story-more]'), function(el) {
    var box = el.parentElement;
    el.remove();
    if (box && box.classList.contains('inv-panel-body') && !box.textContent.trim() && !box.children.length) box.remove();
  });
  // An insight's own moves (What changed?) are drawn as a card draws a move (§24e): its one action at the row's end, Add to my list
  // in the move's dialog. The rows the story drew name their moves (data-adv-row, else the key).
  Array.prototype.forEach.call(t.content.querySelectorAll('[data-adv-for]'), function(box) {
    var moves = [];
    Array.prototype.forEach.call(box.querySelectorAll('[data-adv-move]'), function(row) {
      var b = row.querySelector('[data-adv-row]'), mv = (b && _advRows[b.getAttribute('data-adv-row')]) || _advMoves[row.getAttribute('data-adv-move')];
      if (mv && moves.indexOf(mv) < 0) moves.push(mv);
    });
    box.innerHTML = moves.length ? wdgMovesHtml(moves, false) : '';
  });
  wdgShortMoneyIn(t.content);
  return t.innerHTML;
}
/* A question's whole, in a dialog: its story and every move. */
function wcQuestionOpen(qd) {
  var x = wcQuestion(qd.k);
  if (!x) return;
  var listed = typeof advListedKeys === 'function' ? advListedKeys() : {};
  dialogOpen('<div class="inv-dialog" role="dialog" aria-modal="true" aria-label="' + escHtml(qd.title) + '" data-tdy-q-open="' + qd.k + '">' +
    dialogHeadHtml(qd.title, 'invCloseOverlay', 'Close') + '<div class="inv-dialog-body"><div class="inv-hero-sheet" data-tdy-story>' + x.html + '</div>' +
    (x.inline && x.moves.length ? '' : '<div class="inv-hero-eyebrow inv-mt-8 inv-mb-8" data-adv-head>What you can do</div>' + (x.moves.length
      ? '<div class="inv-deck" data-adv-deck="q-' + qd.k + '-all">' + x.moves.map(function(mv) { return advMoveCardHtml(mv, listed); }).join('') + '</div>'
      : '<div class="inv-note">' + escHtml(x.none || 'Nothing to do here yet.') + '</div>') +
      (x.hints || []).map(function(t) { return '<div class="inv-note inv-mt-8" data-adv-hint>' + escHtml(t) + '</div>'; }).join('')) + '</div></div>', { dismiss: true });
}
/* What each question's answer reads, and its period (§24f's Source). */
function wcQuestionSource(k, ctx) {
  var a = wcPulseArgs(ctx.period), per = STATS_PERIOD_WORDS[ctx.period] || 'the period';
  var cost = a.periodCost && a.periodCost.measuredShare != null ? 'the live cost ' + Math.round(a.periodCost.measuredShare * 100) + '% measured' : 'the live cost';
  if (k === 'smooth') return ['Stock, cuts, the floor and the payout', 'this week'];
  if (k === 'money' || k === 'clients') return ['Invoices net of credit notes', cost, 'labour counted as fixed, as you ruled'];
  if (k === 'plant') return ['Invoices, ' + per, '~2 t a shift, two shifts'];
  if (k === 'cash') return [wcBankSrc()];
  return ['The month to ' + stockShortDate(localDateStr()), 'against its pace'];
}
WC_QUESTIONS.forEach(function(qd) {
  wdgDefine({ id: 'q-' + qd.k, title: qd.title, short: qd.short, shortDesk: qd.shortDesk, q: qd.q, section: 'questions', type: 'brief', icon: qd.icon, sizes: qd.sizes,
    needs: { money: true, when: qd.bank ? function() { return finHasBank(); } : null },
    go: function() { wcQuestionOpen(qd); },
    more: function() { wcQuestionOpen(qd); },
    data: function(ctx) {
      var x = wcQuestion(qd.k);
      if (!x) return { state: 'empty', title: 'Not worked out yet', body: 'The question reads the period’s invoices; Stats has the figures.' };
      var v = x.vital || { tone: x.answer ? x.answer.tone : 'neutral' }, tone = WDG_TONES[v.tone] ? v.tone : 'neutral', large = ctx.size === 'l';
      // The answer as a sentence (§24d: 19px, 17 on a Small, 22 at Large), its key figure in its tone; at Large said whole (the canvas's
      // "No: we lose ₹17.67 on every kilo this month") and heading the first column, its facts and its chart under it.
      return { state: 'ok', tone: tone, x: x, v: v, attrs: ' data-tdy-questions data-tdy-q="' + escHtml(qd.k) + '"',
        ans: (large && v.ansL) || v.ans || (x.answer ? x.answer.say : ''), ansAttrs: ' data-tdy-ans', headInCol: large,
        // Small: the line under the answer (the canvas's "The live cost is ₹28.66 a kilo").
        detailHtml: ctx.size === 's' && v.line ? v.line : '', detailAttrs: ' data-tdy-line', noViz: !(large && x.chart) };
    },
    draw: function(d, size) {
      var v = d.v, x = d.x, h = '';
      // Small: its picture at the foot, which the fit lets go of first where the card is short of room (the phone's Small).
      if (size === 's') return v.viz ? '<div class="inv-widget-viz" data-wdg-push data-wdg-opt>' + v.viz + '</div>' : '';
      // Medium: what could stop the plant, a row each (the canvas's rows: its lamp, what and why, its figure), each opening its move.
      var rows = x.moves.filter(function(mv) { return mv.row; });
      if (size === 'm' && qd.k === 'smooth' && rows.length) return h + wdgBriefRowsHtml(rows.map(function(mv) {
        var r = mv.row, word = mv.tone === 'red' ? 'Act now' : mv.tone === 'amber' ? 'Soon' : 'To know';
        return { tone: uiTone(mv.tone), word: word, title: r.title, meta: r.meta, value: r.value, amt: r.amt,
          go: { action: 'invWdgMoveOpen', attrs: ' data-key="' + escHtml(mv.key) + '" data-adv-row="' + escHtml(advRowRef(mv)) + '"', label: r.title + ': what you can do' },
          attrs: ' data-adv-move="' + escHtml(mv.key) + '"' };
      }), ' data-tdy-rows');
      if (size === 'm') return h + '<div class="inv-brief-story" data-tdy-story data-noun="line">' + wcStoryBrief(x.html) + '</div>';
      var story = '<div class="inv-brief-story" data-tdy-story data-noun="line">' + wcStoryBrief(x.html, true) + '</div>';
      // Large (the canvas's Briefing): the answer, its facts on one line and its chart, else what stands in the way as rows, else
      // its story (What changed?'s insights, their moves left to the cards); beside it What you can do, every move a card with its
      // worth, those the card cannot hold one More.
      var left = wdgFactsHtml(x.facts, ' data-tdy-facts') + (x.chart ? wdgVizHtml(' data-tdy-chart') : rows.length && qd.k === 'smooth' ? wdgBriefRowsHtml(rows.map(function(mv) {
        var r = mv.row, word = mv.tone === 'red' ? 'Act now' : mv.tone === 'amber' ? 'Soon' : 'To know';
        return { tone: uiTone(mv.tone), word: word, title: r.title, meta: r.meta, value: r.value, amt: r.amt, attrs: ' data-adv-move="' + escHtml(mv.key) + '"' };
      }), ' data-tdy-rows') : story);
      var right = x.moves.length ? '<p class="inv-widget-cap" data-adv-head>What you can do</p>' + wdgMovesHtml(x.moves, true, ' data-tdy-moves data-adv-deck="q-' + qd.k + '"')
        : '<p class="inv-brief-facts" data-adv-none>' + escHtml(x.none || 'Nothing to do here yet.') + '</p>';
      return wdgColsHtml([left, right], { shape: 'brief' });
    },
    // Large: the question's chart, bare, at the room its first column leaves under the facts.
    viz: function(d, size, box) { return d.x.chart ? d.x.chart({ bare: true, w: box.w, h: box.h }) : ''; }, vizAt: ['l'],
    // Medium: the first move, and Add to my list for it (§24e: it leaves the move's row).
    actRow: function(d, size) {
      var mv = size === 'm' && !d.x.inline ? d.x.moves[0] : null;
      if (!mv) return null;
      var ref = advRowRef(mv), at = ' data-key="' + escHtml(mv.key) + '" data-adv-row="' + escHtml(ref) + '"';
      var listed = typeof advListedKeys === 'function' ? advListedKeys() : {};
      return { tint: mv.href ? { label: mv.hrefLabel || 'Call', href: mv.href, attrs: ' data-adv-call' } : mv.go ? { label: mv.actLabel || mv.goLabel || 'Open', action: 'invAdvGo', attrs: at } : null,
        text: listed[mv.key] ? null : { label: 'Add to my list', action: 'invAdvTask', attrs: at } };
    },
    // A source at Large only: on Home's Mediums the answer and its rows say it (the canvas's Briefing cards).
    source: function(d, size, ctx) { return size === 'l' ? { facts: wcQuestionSource(qd.k, ctx) } : null; } });
});
/* Do first: the moves worth most across every question (tdyFirstMoves, advRank), as rows (Large: cards in wells), each ending in
   its one action; a tap on a move opens its dialog (Add to my list is there); More opens the first ten. */
/* Do first's answer (the canvas's "Quote new work first: +₹7.98 L a month"): the first move's instruction, before its rate or its
   colon, and what it is worth, short, with its period. */
function wcFirstSay(mv) {
  var head = wdgMoveSay(mv).replace(/:.*$/, '').replace(/\s+(at|for|to)\s+\u20B9.*$/, '').trim(), w = mv.worth;
  var per = w ? (w.per === 'month' ? ' a month' : w.per === 'year' ? ' a year' : w.per === 'period' ? ' on the period' : '') : '';
  var worth = w && w.amount > 0.005 ? figHtml(escHtml((w.sign < 0 ? '\u2212' : '+') + inrCard(w.amount).text), w.sign < 0 ? 'danger' : 'ok') + (per ? '<span class="inv-tail">' + escHtml(per) + '</span>' : '') : '';
  return escHtml(head) + ' first' + (worth ? ': ' + worth : '');
}
wdgDefine({ id: 'dofirst', title: 'Do first', q: 'The moves worth most, across every question', section: 'questions', type: 'brief', icon: 'task', sizes: ['m', 'l'],
  needs: { money: true }, card: 'first',
  go: function() { wcMovesOpen('Do first: the moves worth most', tdyFirstMoves(tdyQuestions(), 10).map(function(t) { return t.mv; }), 'first-all'); },
  more: function() { wcMovesOpen('Do first: the moves worth most', tdyFirstMoves(tdyQuestions(), 10).map(function(t) { return t.mv; }), 'first-all'); },
  data: function() {
    var top = tdyFirstMoves(tdyQuestions(), 10);
    if (!top.length) return { state: 'empty', title: 'No move worth making yet', body: 'A move appears once a question finds one: a price under the cost, a debt past its terms, a line idle.' };
    return { state: 'ok', tone: 'neutral', top: top, ans: wcFirstSay(top[0].mv), ansAttrs: ' data-first-say title="' + escHtml(top[0].mv.say || '') + '"' };
  },
  draw: function(d, size) { return wdgMovesHtml(d.top.map(function(t) { return t.mv; }), size === 'l', ' data-adv-deck="first"'); },
  source: function(d, size) { return size === 'l' ? { facts: ['Every question’s moves', 'by what each is worth a month'] } : null; } });
/* Why it moved (the canvas's Briefing): the answer a sentence, "The price fell ₹1.20 a kilo against September", then realisation's
   change against the period before broken into the causes that add up to it (whyRealisation, why.js), each a line with its bar
   from the middle (left for less, right for more) and its figure, the change ruled under them; at Large contribution's and cash's
   bridges beside it (whyMargin, whyCash). The card stays plain: it explains, it does not warn. */
function wcWhyCauses(causes, total, unit, attrs) {
  var rate = unit === 'kg';
  return wdgLedgerHtml(causes.map(function(c) {
    return { label: c.short || c.label, meta: c.sub || '', amt: rate ? gstRound(c.v, 2) : c.v, tone: c.v > 0.005 ? 'ok' : c.v < -0.005 ? 'danger' : null, attrs: ' data-why-cause="' + escHtml(c.kind) + '"' };
  }), Object.assign({ tone: total.amt > 0.005 ? 'ok' : total.amt < -0.005 ? 'danger' : null }, total), { rate: rate, unit: '', signed: true, noun: 'cause', bars: true, attrs: attrs || '' });
}
/* The period an answer is set against, in a few words: month to date against last month by its name ("against September"), a
   quarter or a year against the one before; the source says the same days. */
function wcWhyVs(period) {
  if (period === 'mtd') { var d = attParseIso(localDateStr()); return RPT_MONTHS[(d.getMonth() + 11) % 12]; }
  return period === 'qtd' ? 'last quarter' : period === 'ytd' ? 'last year' : 'the period before';
}
wdgDefine({ id: 'why', title: 'Why it moved', q: 'What moved the figures against the period before?', section: 'questions', type: 'brief', sizes: ['m', 'l'],
  needs: { money: true }, go: { tab: 'pageStats', v: 'trends' },
  data: function(ctx) {
    var a = wcPulseArgs(ctx.period), o = whyHeroOpts(ctx.period, a.filtered, a.prior, 'real');
    if (!o) return { state: 'early', title: ctx.period === 'all' ? 'All has no period before it' : 'Nothing to compare yet',
      body: ctx.period === 'all' ? 'Pick MTD, QTD or YTD to see what moved against the period before.' : 'The period before has no invoices.' };
    var real = whyRealisation(a.filtered, a.prior), vs = wcWhyVs(ctx.period), early = whyEarly(ctx.period);
    var base = { state: 'ok', tone: 'neutral', real: real, a: a, vs: vs, attrs: ' id="statsWhy" data-card="why"', headInCol: ctx.size === 'l' };
    if (real.none) return Object.assign(base, { ans: 'The price cannot be compared', ansAttrs: ' data-why-say', detail: real.none });
    var flat = Math.abs(real.d) < 0.005, fig = '₹' + formatNum(Math.abs(real.d), 2);
    return Object.assign(base, {
      ans: flat ? 'The price held level with ' + escHtml(vs) : 'The price ' + (real.d < 0 ? 'fell ' : 'rose ') + figHtml(escHtml(fig), real.d < 0 ? 'danger' : 'ok') + ' a kilo against ' + escHtml(vs),
      ansAttrs: ' data-why-say title="Realisation ₹' + formatNum(real.R0, 2) + ' → ₹' + formatNum(real.R1, 2) + ' a kilo"',
      // How sure (I2's rule): a month under ten working days in says so before the causes.
      detailHtml: (early ? '<span class="inv-badge inv-badge-info" data-why-early>Early: ' + escHtml(early.split(',')[0]) + '</span> ' : '') +
        'Each cause in rupees a kilo; together they make the change' });
  },
  draw: function(d, size, ctx) {
    var r = d.real;
    if (r.none) return '';
    var real = wcWhyCauses(r.causes, { label: 'The change', amt: gstRound(r.d, 2), attrs: ' data-why="real" title="Realisation · ₹' + formatNum(r.R0, 2) + ' → ₹' + formatNum(r.R1, 2) + '/kg"' }, 'kg');
    if (size !== 'l') return real;
    var mg = whyMargin(ctx.period, d.a.filtered, d.a.prior, r), cash = whyCash();
    return wdgColsHtml([real, mg.none ? '' : '<p class="inv-widget-cap">Contribution at the live cost</p>' + wcWhyCauses(mg.causes, { label: 'The change', amt: mg.d, attrs: ' data-why="margin"' }),
      cash.none ? '' : '<p class="inv-widget-cap">Cash, ' + escHtml(billsMonthLabel(cash.m0) + ' to ' + billsMonthLabel(cash.m1)) + '</p>' +
        wcWhyCauses(cash.causes, { label: 'The change', amt: cash.d, attrs: ' data-why="cash"' })]);
  },
  source: function(d, size, ctx) {
    var vs = ctx.period === 'mtd' ? 'the same days of ' + d.vs : 'the same stretch of ' + d.vs;
    return { facts: ['Against ' + vs, 'weighed lines only'] };
  } });
/* The period in figures (statsOverviewOpts, the panel Stats → Overview drew): what a kilo left after the live cost, its four factors
   as tiles, and the plated tonnage as a row opening Production. */
wdgDefine({ id: 'figures', title: 'The period in figures', q: 'Price, cost, contribution, capacity', section: 'questions', type: 'ledger', sizes: ['m', 'l'],
  needs: { money: true }, go: { tab: 'pageStats', v: 'cost' },
  data: function(ctx) {
    var a = wcPulseArgs(ctx.period), o = statsOverviewOpts(ctx.period, a.filtered, a.tonnage);
    // Its detail (the period's sum) is what it lets go of first; the plated row a line of its own.
    return Object.assign(wdgFromHero(o), { tiles: o.tiles, plated: o.plated, measured: o.measured, detailAttrs: ' data-wdg-opt' });
  },
  draw: function(d) { return (d.tiles || '') + (d.plated ? '<div data-wdg-list data-noun="line">' + d.plated + '</div>' : ''); },
  source: function(d, size, ctx) {
    return { facts: ['Invoices of ' + (PERIOD_LABELS[ctx.period] || 'the period').toLowerCase() + ', net of notes'].concat(d.measured != null ? ['the live cost ' + Math.round(d.measured * 100) + '% measured'] : []) };
  } });
/* This month at its pace (paceCardOpts, predMonthPace): where the month lands as the figure, its change on last month as the verdict;
   so far, the unbilled challans in hand and the likely range as statement lines, with no total ruled: the landing is a pace, not
   their sum. */
wdgDefine({ id: 'pace', title: 'This month at its pace', q: 'Where does the month land?', section: 'office', type: 'ledger', icon: 'forecast', sizes: ['m', 'l'],
  needs: { page: 'pageRegister', money: true }, go: { tab: 'pageRegister' },
  data: function() {
    var o = paceCardOpts();
    if (!o) return { state: 'early', title: 'The month has no pace yet', body: 'A pace needs a working day billed this month.' };
    var p = o.pace, tone = WDG_TONES[o.tone] ? o.tone : 'neutral';
    // Where the month lands against last month, in words (the canvas's "On pace to land 7.6% above September"); within FIG_FLAT_PCT
    // it is level.
    var pct = p.prevRev > 0 ? (p.projRev - p.prevRev) / p.prevRev * 100 : null;
    var say = pct == null ? 'The month’s first pace' : Math.abs(pct) <= FIG_FLAT_PCT ? 'On pace to land level with ' + p.prevName
      : 'On pace to land ' + formatNum(Math.abs(pct), 1) + '% ' + (pct > 0 ? 'above ' : 'below ') + p.prevName;
    return { state: 'ok', tone: tone, p: p, attrs: o.attrs,
      fig: wcMoneyFig(p.projRev, tone) + '<span class="inv-unit">and ' + escHtml(formatNum(p.projKg / 1000, 1)) + ' t</span>', say: say, sayTone: tone };
  },
  draw: function(d, size) {
    var p = d.p, lines = [
      { label: 'So far', meta: formatNum(p.kg / 1000, 1) + ' t billed', amt: p.rev, attrs: ' data-pace="sofar"' },
      { label: 'Unbilled in hand', meta: p.unbilledN ? todoPlural(p.unbilledN, 'challan') : 'no challan waiting', amt: p.unbilled, title: formatCurrency(p.unbilled) + ': would lift the month if billed in it', attrs: ' data-pace="unbilled"' },
      { label: 'Likely range', meta: 'as the days so far varied', metaTail: true, text: wcRs(p.low) + ' – ' + wcRs(p.high), title: formatCurrency(p.low) + ' – ' + formatCurrency(p.high), attrs: ' data-pace="range"' }];
    if (size === 'l') lines.push({ label: 'Tonnage at its pace', meta: p.prevLabel + ' ' + formatNum(p.prevKg / 1000, 1) + ' t', text: formatNum(p.projKg / 1000, 1) + ' t', attrs: ' data-pace="kg"' });
    // The working days gone, under the verdict; where it lands at the foot of the lines, plain: it is the pace's, not their sum.
    return wdgGaugeHtml({ v: p.done, max: p.total, tone: 'neutral', flow: true, title: p.done + ' of ' + p.total + ' working days in', attrs: ' data-pace="days"',
      left: p.done + ' of ' + p.total + ' working days in', right: p.left > 0 ? p.left + ' to go' : 'the last day' }) +
      wdgLedgerHtml(lines, { label: 'Lands at', amt: p.projRev, attrs: ' data-pace="lands"' });
  },
  source: function() { return { facts: ['Invoices to ' + stockShortDate(localDateStr()), 'net of credit notes'] }; } });
/* Needs you (todoHomeOpts, as Needs you groups it): its worst task's tone, what needs you now as rows, each opening its task (a task
   of your own its tick box). Add a task is its Act's text button; the head opens Needs you (See all went). */
wdgDefine({ id: 'needs', title: 'Needs you', q: 'What needs me now?', section: 'questions', type: 'brief', sizes: ['m', 'l'],
  go: { tab: 'pageHome', v: 'needs' },
  data: function(ctx) {
    var o = todoHomeOpts(ctx.size === 'l' ? 8 : 5);
    return Object.assign(wdgFromHero(o), { rows: o.rows });
  },
  draw: function(d) {
    var t = document.createElement('template');
    t.innerHTML = '<div class="inv-brief-list" data-wdg-list data-noun="task">' + (d.rows || '') + '</div>';
    wdgShortMoneyIn(t.content);
    return t.innerHTML;
  },
  actRow: function() { return { text: { label: 'Add a task', action: 'invHomeQuick', attrs: ' data-go="task"' } }; } });
/* What's coming (§7d `coming`): dated predictions, soonest first, each with its reason, read off what already predicts it, each shown
   only to a role that may see it: the cash forecast's low under zero (finForecast), a stock line out before its supplier can deliver
   (stockStatus, suppReorderPick), a client's next challan by its rhythm (predCadence), where the month lands (predMonthPace), a
   challan's turnaround target passing (flowLines), and a cut likely today where the forecast has thunder in the hours the plant's own
   cuts most often start (said as the two facts side by side). Each a dated row; More lists them all in a dialog. */
var WC_COMING_RANK = { danger: 3, warning: 2, info: 1, ok: 1, neutral: 0 };
/* The day a dated row is for, in the canvas's chip: Today, the weekday and date within the week (Mon 19), else the date (31 Oct). */
function wcComingDay(iso) {
  var today = localDateStr(), n = isoDaysBetween(today, iso), d = new Date(iso + 'T00:00:00');
  if (n <= 0) return 'Today';
  return n <= 6 ? CHART_DAY_NAMES[d.getDay()] + ' ' + d.getDate() : d.getDate() + ' ' + CHART_MONTHS[d.getMonth()];
}
/* A client's name as a card says it (the canvas's "ALPHA FORGINGS"): its legal ending left off; the full name is the record's. */
function wcClientShort(name) {
  var s = String(name || '').trim();
  var t = s.replace(/[\s,.]*\b(?:(?:\(P\)|PVT\.?|PRIVATE)\s*)?(?:LTD\.?|LIMITED)\.?$/i, '').replace(/[\s,.]*\bLLP\.?$/i, '').trim();
  return t || s;
}
function wcComingBook() {
  return wdgMemo('coming-book', function() {
    var today = localDateStr(), out = [], money = wdgSeesMoney();
    var sees = function(p) { return typeof grdSees !== 'function' || grdSees(p); };
    var guard = function(fn) { try { fn(); } catch (e) { if (typeof errReport === 'function') errReport(e, 'widget: coming'); } };
    if (money && sees('pageFinance') && typeof finHasBank === 'function' && finHasBank()) guard(function() {
      var f = finForecast(60);
      if (f && f.overdrawn) out.push({ key: 'cash', date: today, tone: 'danger', title: 'The bank account is overdrawn', why: 'The statement’s last balance: ' + wcRs(f.start), go: { kind: 'finance', tab: 'overview' } });
      else if (f && f.cross) out.push({ key: 'cash', date: f.cross, tone: 'danger', title: 'Cash dips below zero', why: 'The forecast’s low: ' + wcRs(f.min.bal) + ' on ' + stockShortDate(f.min.date), go: { kind: 'finance', tab: 'overview' } });
    });
    if (sees('pageStock')) guard(function() {
      stockData().items.forEach(function(it) {
        if (it.active === false) return;
        var st = stockStatus(it);
        if (st.daysLeft == null || st.daysLeft > 21) return;
        var pk = typeof suppReorderPick === 'function' ? suppReorderPick(it, st.daysLeft) : null, out1 = isoAddDays(today, Math.max(0, Math.floor(st.daysLeft)));
        if (pk && pk.late) out.push({ key: 'stock:' + it.id, date: out1, tone: 'danger', title: it.name + ' runs out', why: 'Before ' + (pk.name || 'its supplier') + ' can deliver: order now', go: { kind: 'stock', id: it.id } });
        else if (pk && pk.orderBy && isoDaysBetween(today, pk.orderBy) <= 3) out.push({ key: 'stock:' + it.id, date: pk.orderBy, tone: 'warning', title: it.name + ' runs low',
          why: 'Order by ' + (pk.orderBy <= today ? 'today' : RPT_DAYS[new Date(pk.orderBy + 'T00:00:00').getDay()]) + ': ' + suppLeadText(pk.lead) + ' to deliver',
          title2: 'It runs out about ' + stockShortDate(out1) + '; ' + (pk.name || 'the supplier') + ' takes ' + suppLeadText(pk.lead), go: { kind: 'stock', id: it.id } });
      });
    });
    if (sees('pageIM')) guard(function() {
      predCadence().filter(function(c) { return c.count >= 5 && !c.quiet && c.next && c.next >= today && isoDaysBetween(today, c.next) <= 7; }).slice(0, 4).forEach(function(c) {
        out.push({ key: 'cad:' + c.id, date: c.next, tone: 'neutral', title: wcClientShort(c.name) + '’s next challan', why: 'Every ' + Math.round(c.median) + ' days, the last on ' + stockShortDate(c.last),
          go: { kind: 'im', clientId: c.id } });
      });
    });
    if (money && sees('pageRegister')) guard(function() {
      var p = predMonthPace();
      if (!p || !(p.left > 0)) return;
      var end = payMonthEnd(today.slice(0, 7) + '-01'), ahead = p.prevRev > 0 ? p.projRev >= p.prevRev : null;
      out.push({ key: 'pace', date: end, tone: ahead === false ? 'warning' : ahead ? 'ok' : 'neutral', title: 'The month lands about ' + wcRs(p.projRev),
        why: (p.prevRev > 0 ? p.prevLabel + ' billed ' + wcRs(p.prevRev) + ' · ' : '') + 'likely ' + wcRs(p.low) + ' – ' + wcRs(p.high),
        title2: 'At the pace of ' + todoPlural(p.done, 'working day') + ' so far',
        go: { kind: 'register' } });
    });
    if (sees('pageProduction') && typeof flowLines === 'function') guard(function() {
      var seen = {}, soon = flowAddWd(today, 1);
      flowLines().forEach(function(x) {
        if (!x.row || x.despatched || !x.date || !x.target || seen[x.m.id]) return;
        var due = flowAddWd(x.date, x.target.days);
        if (due < today || due > soon) return;
        seen[x.m.id] = true;
        var who = wcClientShort(x.m.clientName || insClientName(x.m.clientId));
        out.push({ key: 'turn:' + x.m.id, date: due, tone: due === today ? 'warning' : 'info', title: 'Challan ' + (x.m.challanNo || '') + ' due back',
          why: who + ' · its ' + flowTargetWord(x.target.days), go: { kind: 'challan', id: x.m.id }, no: x.m.challanNo || '?', client: who });
      });
    });
    return out;
  });
}
/* The cut likely today: today's thunder hours (the feed's copy, read each draw) against the plant's own hours. */
function wcComingCut() {
  if (typeof grdSees === 'function' && !grdSees('pagePower')) return null;
  var th = wcThunderHours();
  if (!th || !th.length || typeof powerRiskWindow !== 'function') return null;
  var a = wdgMemo('power-analysis', powerAnalysis), win = a && a.hours ? powerRiskWindow(a.hours, 6, 22) : null;
  if (!win || win.early) return null;
  var t = feedThunderToday(), clock = function(h) { return relayClockLabel(h * 60 % 1440); };
  var inWin = th.some(function(h) { return h >= win.from && h < win.to; }), w0 = t.windows && t.windows[0];
  var wet = typeof feedWeatherCutDays === 'function' ? feedWeatherCutDays() : null;
  // The storm count where 30 days are kept (the weather card's: cuts on a day thunder was forecast, never a cause), else the
  // hours the plant's cuts start. Info, as the world outside always is: the canvas's blue row.
  var why = wet && wet.state === 'ok' && wet.cuts ? wet.stormCuts + ' of the last ' + todoPlural(wet.cuts, 'cut') + ' on a thunder day'
    : 'Cuts most often start ' + clock(win.from) + ' – ' + clock(win.to) + (inWin ? ', the same hours' : '');
  return { key: 'cut', date: localDateStr(), dayText: w0 ? clock(w0.from) : null, tone: 'info',
    title: w0 ? 'Thunder until ' + clock(w0.to) : wcCap(t.say || 'thunder') + ' today', why: why,
    title2: 'The plant’s cuts most often start ' + clock(win.from) + ' – ' + clock(win.to), go: { kind: 'power', tab: 'cuts' } };
}
/* Challans due back on one day are one row (the canvas's "Challans 843 and 852 due back"): their numbers, their clients, the worst
   tone; the row opens the challans awaiting invoice. One alone keeps its own row and opens itself. */
function wcComingGroup(list) {
  var by = {}, out = [];
  list.forEach(function(x) {
    if (!/^turn:/.test(x.key)) { out.push(x); return; }
    var g = by[x.date];
    if (!g) { g = by[x.date] = { items: [] }; out.push(g); }
    g.items.push(x);
  });
  return out.map(function(g) {
    if (!g.items) return g;
    if (g.items.length === 1) return g.items[0];
    var nos = g.items.map(function(x) { return x.no; }), clients = [];
    g.items.forEach(function(x) { if (clients.indexOf(x.client) < 0) clients.push(x.client); });
    // Two facts at most on the row's line (the benchmark's: never three chained); three clients or more name the first and how many
    // more, every client in the row's title.
    var why = clients.length > 2 ? clients[0] + ' and ' + (clients.length - 1) + ' more clients' : clients.join(' · ');
    return { key: 'turns:' + g.items[0].date, date: g.items[0].date, tone: wcWorst(g.items.map(function(x) { return x.tone; })), n: g.items.length,
      title: 'Challans ' + nos.slice(0, -1).join(', ') + ' and ' + nos[nos.length - 1] + ' due back', why: why, title2: clients.length > 2 ? clients.join(', ') : '', go: { kind: 'im' } };
  });
}
function wcComingItems() {
  var list = wcComingBook().slice(), cut = wcComingCut();
  if (cut) list.push(cut);
  return wcComingGroup(list.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (WC_COMING_RANK[b.tone] || 0) - (WC_COMING_RANK[a.tone] || 0); }));
}
/* The answer the card leads with (the canvas's "Three challans are due back today"): what is due today, else the soonest. */
function wcComingSay(list) {
  var today = localDateStr(), now = list.filter(function(x) { return x.date <= today; });
  var back = now.reduce(function(t, x) { return t + (/^turns?:/.test(x.key) ? x.n || 1 : 0); }, 0);
  if (back > 1) return { text: back + ' challans are due back today', tone: 'warning' };
  if (back === 1) { var one = now.filter(function(x) { return /^turns?:/.test(x.key); })[0]; return { text: one.title.replace(/ due back$/, ' is due back today'), tone: one.tone }; }
  var x = list[0];
  return { text: x.date <= today ? x.title : wcComingDay(x.date) + ': ' + wcLc(x.title), tone: x.tone };
}
function wcComingRowsHtml(list) {
  var today = localDateStr();
  return '<div class="inv-brief-list" data-coming data-wdg-list data-noun="prediction">' + list.map(function(x) {
    return wdgWhenRowHtml({ day: x.dayText || wcComingDay(x.date), today: x.date <= today, title: x.title, why: x.why, hint: x.title2, tone: x.tone === 'neutral' ? null : x.tone,
      word: x.tone === 'danger' ? 'Act' : x.tone === 'warning' ? 'Soon' : x.tone === 'info' || x.tone === 'ok' ? 'To know' : '', go: { action: 'invWdgComing', attrs: ' data-wid="coming" data-k="' + escHtml(x.key) + '"' },
      attrs: ' data-coming-k="' + escHtml(x.key) + '"' });
  }).join('') + '</div>';
}
wdgDefine({ id: 'coming', title: 'What’s coming', q: 'What happens next, and when?', section: 'questions', type: 'brief', icon: 'calendar', sizes: ['m', 'l'], card: 'coming', feed: true,
  act: function(action, btn) {
    if (action !== 'invWdgComing') return false;
    var it = wcComingItems().filter(function(x) { return x.key === btn.dataset.k; })[0];
    if (!it) { showToast('That has changed since it was drawn', 'info'); wdgRefresh('coming'); return true; }
    todoGo(it.go);
    return true;
  },
  // More: every prediction, dated, in a dialog over the board (it has no screen of its own).
  more: function() {
    dialogOpen('<div class="inv-dialog" role="dialog" aria-modal="true" aria-label="What’s coming" data-wdg-for="coming">' + dialogHeadHtml('What’s coming', 'invCloseOverlay', 'Close') +
      '<div class="inv-dialog-body">' + wcComingRowsHtml(wcComingItems()) + '</div></div>', { dismiss: true });
  },
  data: function() {
    var list = wcComingItems();
    if (!list.length) return { state: 'empty', title: 'Nothing dated ahead yet', body: 'A prediction appears here once the book can make one: a stock line running out, a client’s next challan, where the month lands.' };
    var tone = list.slice(0, 4).reduce(function(t, x) { return (WC_COMING_RANK[x.tone] || 0) > (WC_COMING_RANK[t] || 0) ? x.tone : t; }, 'neutral');
    // The answer as a sentence (a Briefing's), then the rows, soonest first.
    var a = wcComingSay(list);
    return { state: 'ok', tone: tone === 'info' || tone === 'ok' ? 'neutral' : tone, list: list, ans: escHtml(a.text),
      ansAttrs: ' data-coming-say title="' + escHtml(a.text + ' · ' + todoPlural(list.length, 'thing') + ' dated ahead, soonest first') + '"' };
  },
  draw: function(d) { return wcComingRowsHtml(d.list); } });
