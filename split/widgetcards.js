/* ===== THE WIDGETS (docs/UI_PASS_3.md §7d, §24f; UI pass 3, U2R: the card family) =====
   One entry a widget (wdgDefine, widgets.js), in the gallery's order: its sections, then the widgets in each. Every widget names its
   type (§24d: ledger, docket, plant, crew, brief, outside, tools) and, where it has a Small, its short title; the framework draws it in
   the one skeleton (§24b). A widget's `data` returns {state, tone, …} (§7c): its figure (`fig`), its verdict (`line`, beside its lamp)
   and a detail line (`sub`), all HTML the widget escaped, and whatever its body draws from; `draw` the body for 's' | 'm' | 'l', through
   the type's builders (widgets.js), never a row's markup of its own; `actRow` its Act (one tinted button, one text button at most) and
   `source` its Source (where it comes from, and how fresh). Every figure is its screen's, read with the function its screen draws with
   (I8): a widget never works a figure out a second way. Money on a board is short (inrCard, §24k): a statement's lines whole rupees, a
   rate its paise. Who sees each is its `needs` (§7g, I4): the page it opens, money, wages, a permission. */

/* A blank state's one door (§24e): the card's Act, tinted, at Medium and Large; a Small's head is its door. */
function wcDoor(label, action, attrs) { return { label: label, action: action, attrs: attrs || '' }; }
/* The period's figures the questions and the cards read, once a book and a period (statsPulseArgs). */
function wcPulseArgs(per) { return wdgMemo('pulse-args:' + per, function() { return statsPulseArgs(per); }); }
/* Moves in a dialog (a question's whole list, Do first's longer list): the deck Needs you draws, every move in it. */
function wcMovesOpen(title, moves, key, words) {
  var listed = typeof advListedKeys === 'function' ? advListedKeys() : {};
  var deck = moves.length ? '<div class="inv-deck" data-adv-deck="' + escHtml(key) + '">' + moves.map(function(mv, i) {
    return advMoveCardHtml(mv, listed, words ? words[i] : undefined);
  }).join('') + '</div>' : uiBlankHtml({ kind: 'empty', title: 'Nothing to do here yet' });
  dialogOpen('<div class="inv-dialog" role="dialog" aria-modal="true" aria-label="' + escHtml(title) + '" data-wc-moves="' + escHtml(key) + '">' +
    dialogHeadHtml(title, 'invCloseOverlay', 'Close') + '<div class="inv-dialog-body">' + deck + '</div></div>', { dismiss: true });
}
/* The worst of some tones: a card is coded by the worst of what it holds (§24c; a tie keeps the first). */
function wcWorst(tones) {
  return (tones || []).filter(function(t) { return WDG_TONES[t]; }).sort(function(a, b) { return (UI_TONE_RANK[b] || 0) - (UI_TONE_RANK[a] || 0); })[0] || 'neutral';
}
/* A time the record reached, as a Source says it: the time today (4:10 PM), else the day (16 Oct). */
function wcAt(ts) {
  var d = ts ? new Date(ts) : null;
  if (!d || !isFinite(d.getTime())) return '';
  return isoOf(d) === localDateStr() ? homeClockText(d) : stockShortDate(isoOf(d));
}
/* The bank statement's last day, a money widget's first fact of its Source. */
function wcStmtTo() { var r = bankRows(); return r.length ? 'Bank statement to ' + stockShortDate(r[r.length - 1].date) : ''; }
/* No statement yet: the one blank state the money widgets share (GST alone reads the invoices). */
function wcNoBank(what) {
  return { state: 'empty', title: 'No bank statement yet', body: 'Import the bank’s .xls or .xlsx: ' + what + ' read from it.', act: wcDoor('Import statement', 'invHomeImportBank') };
}
/* A Large's parts side by side once the card is 36rem wide (.inv-widget-parts), stacked under it: whether they stand side by side,
   and the room each has across, so a chart in one is drawn at its own width. */
function wcParts(ctx) {
  var rem = wdgRemPx(), w = ctx && ctx.w > 0 ? ctx.w : 0, side = w > 0 && w + 2 * rem >= 36 * rem;
  return { side: side, w: side ? Math.floor((w - 0.75 * rem) / 2) : w };
}
function wcPartsHtml(parts) {
  var list = parts.filter(Boolean);
  return list.length > 1 ? '<div class="inv-widget-parts">' + list.map(function(p) { return '<div class="inv-widget-part">' + p + '</div>'; }).join('') + '</div>' : list.join('');
}

/* ---------- Money ---------- */
/* Money at a glance (a Ledger): what is owed past 60 and 90 days as the verdict, the ageing as a bar, and the four tiles into Money
   (the balance, owed, pays in, the runway), each in its own tone and in short money (finHomeRead, read once). Import a statement is its
   Act only while the statement is over a week old (U2's foot offered it with a statement in). */
wdgDefine({ id: 'money', title: 'Money at a glance', q: 'Where does the money stand?', section: 'money', type: 'ledger', sizes: ['m'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'overview' },
  data: function() {
    var r = finHomeRead(), attrs = ' id="homeFin" data-card="money"';
    if (!r) return { state: 'empty', title: 'No bank statement yet', body: 'Import the bank’s .xls or .xlsx to see the balance, what is owed and the forecast.',
      act: wcDoor('Import statement', 'invHomeImportBank'), attrs: attrs };
    var line = r.owed < 0.5 ? 'Nothing owed to us' : r.old90 > 0 ? inrTextHtml(r.old90) + ' owed over 90 days'
      : r.old60 > 0 ? inrTextHtml(r.old60) + ' owed over 60 days' : 'Nothing owed over 60 days';
    var sub = [r.owed >= 0.5 ? inrTextHtml(r.owed) + ' owed in all' : '', r.pays != null ? escHtml('clients pay in ' + r.pays + ' days') : '',
      inrTextHtml(r.last.balance) + ' in the bank'].filter(Boolean).join(' · ');
    return { state: 'ok', tone: r.tone || 'neutral', line: line, sub: sub, r: r, attrs: attrs };
  },
  draw: function(d) {
    var r = d.r, fc = r.fc;
    var tiles = [
      { label: 'Balance', fig: inrFigHtml(r.last.balance), sub: 'on ' + stockShortDate(r.last.date) + (r.age > 7 ? ', ' + r.age + ' days ago' : ''), tone: r.tones.balance,
        action: 'invFinGo', attrs: ' data-tab="bank" data-home-fin="Balance"' },
      { label: 'Owed to us', fig: inrFigHtml(r.owed), tone: r.tones.owed, action: 'invFinGo', attrs: ' data-tab="receipts"' + (r.loose ? ' data-anchor="bankLoose"' : '') + ' data-home-fin="Owed to us"',
        sub: r.loose ? todoPlural(r.loose, 'receipt') + ' not placed' : r.old90 > 0 ? inrCard(r.old90).text + ' over 90 days'
          : r.old60 > 0 ? inrCard(r.old60).text + ' over 60 days' : 'since ' + stockShortDate(r.from) },
      r.pays != null ? { label: 'Pays in', fig: r.pays + '<span class="inv-unit">days</span>', sub: 'the book, invoice to receipt', tone: r.tones.pays,
        action: 'invFinGo', attrs: ' data-tab="receipts" data-home-fin="Pays in"' } : null,
      { label: 'Runway', fig: inrFigHtml(fc ? fc.min.bal : r.last.balance), tone: r.tones.runway, action: 'invFinGo', attrs: ' data-tab="overview" data-anchor="finForecast" data-home-fin="Runway"',
        sub: !fc ? '' : fc.overdrawn ? 'overdrawn on ' + stockShortDate(fc.asOf) + (fc.noInflow ? ' · outflows only' : '')
          : (fc.noInflow ? 'outflows only · ' : '') + (fc.cross ? 'below zero on ' + stockShortDate(fc.cross) : 'lowest in 45 days, ' + stockShortDate(fc.min.date)) }];
    var meter = r.owed >= 0.5 ? '<div class="inv-widget-viz">' + chartMeter(r.bands.map(function(b, i) { return { v: b.amount, tone: finAgeTone(i) }; }),
      { title: 'Owed by age: ' + r.bands.map(function(b) { return b.label + ' ' + finRs(b.amount); }).join(' · ') }) + '</div>' : '';
    return meter + wdgTilesHtml(tiles);
  },
  actRow: function(d) { return d.r.age > 7 ? { tint: { label: 'Import a statement', action: 'invHomeImportBank' } } : null; },
  source: function(d) { return { facts: ['Bank statement to ' + stockShortDate(d.r.last.date)] }; } });

/* Cash and its low point (a Ledger): the balance its figure and the forecast's low point its verdict, the Overview's Cash hero's reading
   (finCashRead). Medium: the balance, what the forecast places in and out over its 60 days and the balance at their end, as statement
   lines that add up (summed from finForecast's own days, which carry each day's in and out); Large: the forecast drawn beside them,
   bare. */
function wcCashLedger(c) {
  var fc = c.fc, sIn = 0, sOut = 0, end = fc.days[fc.days.length - 1];
  fc.days.forEach(function(x) { sIn += x.in || 0; sOut += x.out || 0; });
  return wdgLedgerHtml([
    { label: 'In the bank', meta: escHtml('on ' + stockShortDate(c.last.date)), amount: c.last.balance, attrs: ' data-cash-line="now"' },
    { label: 'Money in', meta: escHtml(fc.noInflow ? 'not counted: no receipt placed' : 'expected, 60 days'), amount: gstRound(sIn), attrs: ' data-cash-line="in"' },
    { label: 'Money out', meta: 'expected, 60 days', amount: -gstRound(sOut), attrs: ' data-cash-line="out"' }],
    { label: 'On ' + stockShortDate(end.date), amount: end.bal }, { attrs: ' data-cash-ledger' });
}
wdgDefine({ id: 'cash', title: 'Cash and its low point', short: 'Cash', q: 'Will the account dip below zero, and when?', section: 'money', type: 'ledger', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'overview' }, card: 'cash',
  data: function(ctx) {
    if (!finHasBank()) return wcNoBank('the balance and the forecast are');
    var c = wdgMemo('wcm-cash|' + localDateStr(), function() { return finCashRead(null, finCtx().cls); });
    if (!c) return wcNoBank('the balance and the forecast are');
    var fc = c.fc, last = c.last;
    // The low point with its date, unless the account is overdrawn or dips below zero, which the verdict says first. The forecast's
    // low starts at today's balance (finForecast), so a low on today is the balance itself: nothing lower comes in the 60 days.
    var line = last.balance < 0 || (fc && fc.cross) ? escHtml(c.title)
      : fc && fc.min.date !== localDateStr() ? 'Lowest ' + inrTextHtml(fc.min.bal) + ' on ' + escHtml(stockShortDate(fc.min.date)) : 'No lower in the 60 days ahead';
    // A Small says the one thing under its verdict: how old the statement is where that is what makes it amber (DR-8), else its day.
    var sub = ctx.size === 's' ? (c.stale > 7 ? figHtml(escHtml('statement ' + c.stale + ' days old'), 'warning') : escHtml('in the bank on ' + stockShortDate(last.date)))
      : escHtml('in the bank on ' + stockShortDate(last.date) + (c.stale > 7 ? ', ' + c.stale + ' days old' : '')) + (c.held.n ? ' · + ' + inrTextHtml(c.held.amount) + ' in cheques in hand' : '');
    return { state: 'ok', tone: c.tone, fig: figHtml(inrFigHtml(last.balance), last.balance < 0 ? 'danger' : null), line: line, sub: sub, c: c };
  },
  draw: function(d, size, ctx) {
    var c = d.c;
    if (size === 's' || !c.fc) return '';
    if (size === 'm') return wcCashLedger(c);
    var P = wcParts(ctx), h = P.side ? wdgChartRoom(ctx, 3, 'src') : wdgChartRoom(ctx, 8, 'src');
    return wcPartsHtml([wcCashLedger(c), finForecastChart(c.fc, wdgChartOpts({ w: P.w }, h, { ariaLabel: 'Cash forecast, 60 days' }))]);
  },
  source: function(d, size) {
    return { facts: [wcStmtTo(), 'each client at its own pace', size === 'l' ? 'the band is the likely range' : ''] };
  } });

/* Owed to us (a Ledger): Receivables' own reading (bankReceivables through finCtx, finAgeing), judged by its oldest invoice's age and
   never red while a receipt is unplaced (finOwedTone). Choose at Large: By client (Medium's too), the clients largest first as
   statement lines with their oldest days, ruled to the total, the fit letting go of the smallest into one line with their sum; By age,
   the age bar and its four bands as lines ruled to the total. Large lists the receipts with no client beside it. */
function wcOwedRead() {
  return wdgMemo('wcm-owed', function() {
    var fx = finCtx(), recv = fx.recv(), from = bankRecvFrom(fx.rows);
    var owing = recv.filter(function(r) { return r.owed > 0.005; }).sort(function(a, b) { return b.owed - a.owed; });
    return { recv: recv, owing: owing, owed: gstRound(owing.reduce(function(s, r) { return s + r.owed; }, 0)), bands: finAgeing(recv),
      loose: bankLooseReceipts(fx.cls, from), from: from, book: bankBookDaysToPay(bankPayHistory(recv)) };
  });
}
/* The client longest past its terms (flowTerms): the statement and reminder's client, or null. */
function wcOwedChase(owing) {
  var best = null;
  owing.forEach(function(r) {
    if (r.oldestDays == null) return;
    var past = r.oldestDays - flowTerms(r.client.id).days;
    if (past > 0 && (!best || past > best.past)) best = { r: r, past: past };
  });
  return best;
}
wdgDefine({ id: 'owed', title: 'Owed to us, by age', short: 'Owed to us', q: 'How much is owed, and how old is it?', section: 'money', type: 'ledger', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'receipts' }, card: 'owed',
  choose: { def: 'client', opts: function() { return [{ v: 'client', label: 'By client' }, { v: 'age', label: 'By age' }]; } },
  data: function(ctx) {
    if (!finHasBank()) return wcNoBank('what clients owe is');
    var o = wcOwedRead(), b = o.bands, loose = o.loose.length;
    var line = o.owed < 0.5 ? 'Nothing owed to us' : b[3].amount > 0.005 ? inrTextHtml(b[3].amount) + ' over 90 days'
      : b[2].amount > 0.005 ? inrTextHtml(b[2].amount) + ' over 60 days' : 'Nothing over 60 days';
    // A receipt nobody placed makes what is owed read high: said at every size, in its tone (a Small says how many).
    var sub = loose ? figHtml(escHtml(todoPlural(loose, 'receipt') + ' not placed' + (ctx.size === 's' ? '' : ': reads high')), 'warning')
      : ctx.size === 's' ? '' : escHtml(['since ' + stockShortDate(o.from), o.book && o.book.median != null ? 'clients pay in ' + Math.round(o.book.median) + ' days' : ''].filter(Boolean).join(' · '));
    return { state: 'ok', tone: finOwedTone(finOwedOldest(o.recv)) || 'ok', fig: inrFigHtml(o.owed), line: line, sub: sub, o: o };
  },
  draw: function(d, size, ctx) {
    var o = d.o;
    if (size === 's' || o.owed < 0.5) return '';
    var byClient = wdgLedgerHtml(o.owing.map(function(r) {
      var id = escHtml(String(r.client.id));
      return { label: r.client.name, meta: r.oldestDays != null ? figHtml(escHtml('oldest ' + r.oldestDays + ' d'), finOwedTone(r.oldestDays)) : '', amount: r.owed,
        go: { action: 'invFinGo', attrs: ' data-tab="receipts" data-client="' + id + '"' }, attrs: ' data-wcm-client="' + id + '"' };
    }), { label: 'Owed in all', amount: o.owed }, { attrs: ' data-wcm-group="clients"' });
    var byAge = '<div class="inv-widget-viz">' + chartMeter(o.bands.map(function(b, i) { return { v: b.amount, tone: finAgeTone(i) }; }),
      { title: 'Owed by age: ' + o.bands.map(function(b) { return b.label + ' ' + finRs(b.amount); }).join(' · ') }) + '</div>' +
      wdgLedgerHtml(o.bands.map(function(b, i) {
        return { label: b.label, meta: escHtml(todoPlural(b.n, 'invoice')), amount: b.amount, value: figHtml(escHtml(wdgRs(b.amount)), b.amount > 0.005 && i >= 2 ? finAgeTone(i) : null),
          attrs: ' data-wcm-band="' + i + '"' };
      }), { label: 'Owed in all', amount: o.owed }, { attrs: ' data-wcm-group="ages"' });
    if (size === 'm') return byClient;
    var loose = o.loose.length ? wdgListHtml('rows', o.loose.map(function(v) {
      return wdgRowHtml({ title: bankRowTitle(v), meta: escHtml(stockShortDate(v.row.date)), fig: inrTextHtml(v.row.cr), go: { action: 'invFinGo', attrs: ' data-tab="receipts" data-anchor="bankLoose"' },
        attrs: ' data-wcm-loose' });
    }), ' data-wcm-group="loose"') : '';
    return wcPartsHtml([ctx.choose === 'age' ? byAge : byClient, loose ? '<p class="inv-widget-cap">Receipts with no client</p>' + loose : '']);
  },
  actRow: function(d) {
    var o = d.o, row = {}, n = o.loose.length, chase = wcOwedChase(o.owing);
    if (n) row.tint = { label: 'Place the ' + (n === 1 ? 'receipt' : n + ' receipts'), action: 'invFinGo', attrs: ' data-tab="receipts" data-anchor="bankLoose"' };
    if (chase) row.text = { label: 'Send a reminder', action: 'invWdgJump', attrs: wdgJumpAttrs({ kind: 'soa', client: chase.r.client.id }) +
      ' title="' + escHtml(chase.r.client.name + ': ' + chase.past + ' days past its terms') + '"' };
    return row;
  },
  source: function() { return { facts: [wcStmtTo(), 'receipts set oldest first', 'age from the invoice date'] }; } });

/* Days to pay, against terms (a Ledger): each client's days from invoice to receipt by value (bankDaysToPay; three receipts or more, as
   the forecast trusts a client's own), against its payment terms (flowTerms), judged as the flow's payment step judges them
   (flowPayTone). Small: the book's median as a gauge against the plant's terms, its mark at the terms; Medium: the clients most past
   their terms as a dumbbell, bare; Large: every other client as rows beside it (on a narrow card, every client as rows). */
var WCM_DTP_MIN = 3;
wdgDefine({ id: 'dtp', title: 'Days to pay, against terms', short: 'Days to pay', q: 'Who pays on time, who is slipping?', section: 'money', type: 'ledger', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'receipts' }, card: 'dtp',
  data: function() {
    if (!finHasBank()) return wcNoBank('days to pay are');
    var recv = finCtx().recv(), hist = bankPayHistory(recv), book = bankBookDaysToPay(hist);
    if (!book || book.median == null) return { state: 'early', title: 'No receipt set against an invoice yet',
      body: 'Days to pay read each receipt against the invoices it paid; a client is judged from three receipts.' };
    var list = recv.map(function(r) {
      var dd = bankDaysToPay(r.client.id, hist);
      if (!dd || dd.n < WCM_DTP_MIN || dd.median == null) return null;
      var days = Math.round(dd.median), t = flowTerms(r.client.id);
      return { id: r.client.id, name: r.client.name, days: days, terms: t.days, n: dd.n, over: days - t.days, tone: flowPayTone(days, t.days) };
    }).filter(Boolean).sort(function(a, b) { return b.over - a.over || b.days - a.days || String(a.name).localeCompare(String(b.name)); });
    var days = Math.round(book.median), plant = flowCfg().termsDays, past = list.filter(function(x) { return x.days > x.terms; }).length;
    return { state: 'ok', tone: list.length ? wcWorst(list.map(function(x) { return x.tone; })) : flowPayTone(days, plant) || 'neutral',
      fig: escHtml(String(days)) + '<span class="inv-unit">days</span>',
      line: escHtml(list.length ? past + ' of ' + todoPlural(list.length, 'client') + ' past terms' : 'No client has ' + WCM_DTP_MIN + ' receipts yet'),
      sub: 'median by value', list: list, days: days, plant: plant };
  },
  draw: function(d, size, ctx) {
    if (size === 's') {
      var max = Math.max(d.days, d.plant) * 1.25;
      return '<div class="inv-widget-viz" data-wdg-push>' + chartMeter([{ v: d.days, tone: flowPayTone(d.days, d.plant) || 'neutral' }],
        { max: max, mark: d.plant, title: 'The book pays in ' + d.days + ' days; the plant’s terms are ' + d.plant + ' days (the mark)' }) + '</div>';
    }
    if (!d.list.length) return '';
    var row = function(x) {
      return wdgRowHtml({ title: x.name, meta: escHtml('terms ' + x.terms + ' d · ' + todoPlural(x.n, 'receipt')), tone: x.tone, word: x.days + ' d',
        go: { action: 'invFinGo', attrs: ' data-tab="receipts" data-client="' + escHtml(String(x.id)) + '"' }, attrs: ' data-wcm-client="' + escHtml(String(x.id)) + '"' });
    };
    var P = wcParts(ctx);
    // A narrow Large (the phone's) lists every client as rows, most past its terms first, which the card can let go of to fit.
    if (size === 'l' && !P.side) return wdgListHtml('rows', d.list.map(row), ' data-wcm-group="all"');
    var n = size === 'l' ? 6 : _isDesktop ? 6 : 5, top = d.list.slice(0, n);
    var chart = chartDumbbell(top.map(function(x) { return { key: String(x.id), label: x.name, a: x.terms, b: x.days, tone: x.tone }; }),
      wdgChartOpts({ w: size === 'l' ? P.w : ctx.w }, 0, { aLabel: 'Terms', bLabel: 'Pays in', labelHead: 'Client', unit: 'count', ariaLabel: 'Days to pay against terms' }));
    if (size === 'm') return '<div class="inv-widget-viz">' + chart + '</div>';
    return wcPartsHtml(['<div class="inv-widget-viz">' + chart + '</div>', wdgListHtml('rows', d.list.slice(n).map(row), ' data-wcm-group="rest"')]);
  },
  source: function() { return { facts: ['Receipts set against invoices', 'a client judged from ' + WCM_DTP_MIN + ' receipts'] }; } });

/* GST due against paid (a Ledger): the GST tab's own months (finGstByMonth) and each one's reading (finGstSay); it reads the invoices,
   so it says what is due with no statement too. Small: last month's due as the figure, its status as the verdict, the month before as
   one statement line; Medium: six months grouped, due against paid, bare (finGstMonthsChart); Large: twelve, and the months that carry
   a note or need one as rows. Add a note is its Act while a month the bank shows unpaid has none. A card takes the tone of the worst
   month it holds. */
function wcGstNeedsNote(g) {
  return (g || []).filter(function(x) { return !x.note && finGstStatus(x).missing && finGstNoteOk(x); }).pop() || null;
}
wdgDefine({ id: 'gst', title: 'GST due against paid', short: 'GST', q: 'Is every month’s return paid?', section: 'money', type: 'ledger', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'gst' }, card: 'gst',
  act: function(action, btn) {
    if (action !== 'invWdgGstNote') return false;
    finSetTab('gst');
    switchTab('pageFinance');
    _finGstEdit = btn.dataset.month;
    renderFinance();
    return true;
  },
  data: function(ctx) {
    if (!(S.invoices || []).some(function(i) { return i.status === 'active'; })) return { state: 'empty', title: 'Nothing invoiced yet',
      body: 'GST due reads from the invoices, and what was paid from the bank statement.' };
    // A Small reads last month and the one before it; the month running is the chart's, drawn to date.
    var cls = finHasBank() ? finCtx().cls : [], n = ctx.size === 'l' ? 12 : ctx.size === 'm' ? 6 : 3;
    var months = finMonths(n), g = finGstByMonth(months, cls), prevM = insMonthsBack(1)[0];
    var lastClosed = g.filter(function(r) { return r.month <= prevM; }).pop() || g[g.length - 1], say = finGstSay(lastClosed);
    return { state: 'ok', tone: ctx.size === 's' ? say.tone : wcWorst(g.map(function(r) { return finGstSay(r).tone; }).concat([say.tone])),
      fig: inrFigHtml(lastClosed.due), line: escHtml(say.title),
      sub: escHtml([lastClosed.due > 0 ? billsMonthLabel(lastClosed.month) : '', lastClosed.paid > 0 ? 'paid ' + inrCard(lastClosed.paid).text : ''].filter(Boolean).join(' · ')),
      months: months, g: g, last: lastClosed, note: ctx.size === 's' ? null : wcGstNeedsNote(g.filter(function(r) { return r.month <= prevM; })) };
  },
  draw: function(d, size, ctx) {
    if (size === 's') {
      var before = d.g.filter(function(r) { return r.month < d.last.month; }).pop();
      return before ? wdgLedgerHtml([{ label: billsMonthLabel(before.month), meta: escHtml(finGstSay(before).title), amount: before.due, attrs: ' data-wcm-gst="' + escHtml(before.month) + '"' }], null,
        { attrs: ' data-wdg-push' }) : '';
    }
    var P = wcParts(ctx), wide = size === 'l' && P.side;
    var chart = '<div class="inv-widget-viz">' + finGstMonthsChart(d.months, d.g, wdgChartOpts({ w: wide ? P.w : ctx.w }, wide ? wdgChartRoom(ctx, 3, 'act') : wdgChartRoom(ctx, 3, 'act'))) + '</div>';
    if (size === 'm') return chart;
    // Newest first: the months with a note (a return paid another way, as the GST tab says it), and the months the statement shows no
    // payment for and nobody has noted, each a row with its status.
    var back = d.g.slice().reverse();
    var rows = back.filter(function(x) { return x.note || finGstStatus(x).missing; }).map(function(x) {
      return wdgRowHtml({ title: billsMonthLabel(x.month), meta: escHtml(x.note ? finGstNoteLine(x) : inrCard(x.due).text + ' due by ' + stockShortDate(x.dueBy) + ', and no note'),
        tone: finGstSay(x).tone, word: x.note ? 'Noted' : 'Not in the bank', attrs: ' data-wcm-gst="' + escHtml(x.month) + '"' });
    });
    return wcPartsHtml([chart, rows.length ? wdgListHtml('rows', rows, ' data-wcm-group="notes"') : '']);
  },
  actRow: function(d) {
    return d.note ? { tint: { label: 'Add a note for ' + billsMonthLabel(d.note.month), action: 'invWdgGstNote', attrs: ' data-wid="gst" data-month="' + escHtml(d.note.month) + '"' } } : null;
  },
  source: function() {
    var r = bankRows();
    return { facts: ['Invoices and notes', r.length ? 'paid read off the bank statement to ' + stockShortDate(r[r.length - 1].date) : 'no bank statement yet'] };
  } });

/* ---------- Office ---------- */
/* Month to date (a Ledger): the month's billing, net of credit notes (homeMonthInvoices), against the same days last month and
   realisation against the cost (homeMtdOpts, its four tiles with the #mtd* hooks, in short money). Small: what is billed as the
   figure, its change as the verdict and the months before as small bars, this month to date hatched; Large: the tiles' lines of the
   months before too. The month's days are the Source's (U2's hero said them in its eyebrow, which wdgFromHero dropped). */
wdgDefine({ id: 'mtd', title: 'Month to date', short: 'Month to date', q: 'How is the month going?', section: 'office', type: 'ledger', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageRegister', money: true }, go: { tab: 'pageRegister' },
  data: function(ctx) {
    var o = homeMtdOpts(homeMonthInvoices(), { viz: ctx.size === 'l', short: true });
    var small = ctx.size === 's';
    return { state: 'ok', tone: small ? (WDG_TONES[o.revTone] ? o.revTone : 'neutral') : WDG_TONES[o.tone] ? o.tone : 'neutral',
      fig: inrFigHtml(o.rev), line: small ? escHtml(o.short) : o.title, sub: small ? '' : o.sub, o: o, attrs: o.attrs };
  },
  draw: function(d, size, ctx) {
    var o = d.o;
    if (size !== 's') return o.tiles;
    // The months before as small bars, the month so far the last, hatched as to date: the picture a Small has room for.
    var hist = homeMonthsBack(5), bars = hist.map(function(x) { return { label: x.label, value: x.rev }; }).concat([{ label: o.month, value: o.rev }]);
    if (bars.filter(function(b) { return b.value > 0; }).length < 2) return '';
    return '<div class="inv-widget-viz" data-wdg-push>' + chartBars(bars, wdgChartOpts(ctx, wdgChartRoom(ctx, 4, false), { axis: false, unit: 'money', toDate: bars.length - 1,
      ariaLabel: 'Billed each month, this month to date' })) + '</div>';
  },
  source: function(d) { return { facts: ['Invoices, ' + d.o.month + ' 1–' + new Date().getDate(), 'net of credit notes'] }; } });

/* A challan's steps (Docket, §24d): received, pickled, plated, invoiced, the challan standing where its least advanced open line does
   (the flow thread's reading of In plant, flowLines), in the tone of its wait (imWaitTone). */
var WC_CHALLAN_STEPS = ['Received', 'Pickled', 'Plated', 'Invoiced'];
function wcChallanSteps(im) {
  var by = wdgMemo('flow-by-challan', function() {
    var m = {};
    flowLines().forEach(function(x) { if (x.row) (m[x.m.id] = m[x.m.id] || []).push(x); });
    return m;
  });
  var rank = { waiting: 0, open: 0, pickled: 1, plated: 2 }, lines = by[im.id] || [];
  var at = lines.reduce(function(m, x) { var r = rank[x.stage]; return r != null && r < m ? r : m; }, lines.length ? 2 : 0);
  var age = imWaitDays(im);
  return { n: 4, at: at, tone: imWaitTone(age), say: WC_CHALLAN_STEPS[at] + (age != null && !imDatedAhead(im) ? ', ' + (age === 0 ? 'today' : pipeDays(age) + ' waiting') : '') };
}
/* A challan's wait in words, as IM's row says it. */
function wcChallanWait(im) {
  var age = imWaitDays(im);
  return age == null ? 'no challan date' : imDatedAhead(im) ? 'dated ' + stockDayLabel(im.challanDate) : age === 0 ? 'received today' : pipeDays(age) + ' waiting';
}
/* A challan as a register row: its number, its client and its wait, what is left to bill and its steps, Create invoice at its end. */
function wcChallanRowHtml(im, money) {
  return wdgDocketRowHtml({ no: im.challanNo || '—', party: im.clientName || 'No client', meta: escHtml(wcChallanWait(im)),
    amount: money ? inrTextHtml(imChallanOpenTotal(im)) : '', steps: wcChallanSteps(im), go: { action: 'invWdgJump', attrs: wdgJumpAttrs({ kind: 'challan', id: im.id }) },
    act: im.clientId != null ? { label: 'Create invoice', action: 'invWdgJump', attrs: wdgJumpAttrs({ kind: 'createFor', clientId: im.clientId, ims: [im.id] }) } : null,
    attrs: ' data-wco-im="' + escHtml(im.id) + '"' });
}
/* Unbilled challans (a Docket): IM's own Awaiting invoice (pipeAwaitingChallans, imChallanOpenTotal), coded by the oldest's wait as IM
   codes it (imWaitTone: amber at the To-do's challan days, red at twice them). Small: how many as the figure, the oldest's wait as the
   verdict; Medium: what they bill and the oldest as register rows, each ending in Create invoice. Its door is Challans. */
wdgDefine({ id: 'unbilled', title: 'Unbilled challans', short: 'Unbilled', q: 'What is waiting to be invoiced?', section: 'office', type: 'docket', sizes: ['s', 'm'],
  needs: { page: 'pageIM' }, go: { tab: 'pageIM', v: 'awaiting' },
  data: function(ctx) {
    var attrs = ' data-card="unbilled-pulse"';
    if (!(S.incomingMaterial || []).length) return { state: 'empty', title: 'No challan recorded yet', body: 'A challan received is recorded on Challans.',
      act: wcDoor('Add challan', 'invHomeQuick', ' data-go="challan"'), attrs: attrs };
    var ims = pipeAwaitingChallans(), money = wdgSeesMoney();
    if (!ims.length) return { state: 'ok', tone: 'ok', fig: '0', line: 'Everything received is invoiced', attrs: attrs, ims: ims };
    var first = ims.filter(function(im) { return im.challanDate; })[0] || ims[0], amount = gstRound(ims.reduce(function(t, im) { return t + imChallanOpenTotal(im); }, 0));
    var tone = wcWorst(ims.map(function(im) { return imWaitTone(imWaitDays(im)); })), age = imWaitDays(first);
    var oldest = age == null ? 'No challan date on the oldest' : imDatedAhead(first) ? 'The oldest dated ' + stockDayLabel(first.challanDate)
      : age === 0 ? 'The oldest came in today' : 'The oldest waiting ' + pipeDays(age);
    if (ctx.size === 's') return { state: 'ok', tone: tone, fig: String(ims.length) + '<span class="inv-unit">to bill</span>', line: escHtml(oldest), attrs: attrs, ims: ims };
    return { state: 'ok', tone: tone, fig: money ? inrFigHtml(amount) : String(ims.length) + '<span class="inv-unit">to bill</span>',
      line: escHtml(todoPlural(ims.length, 'challan') + ' to invoice'), sub: escHtml(oldest.charAt(0).toLowerCase() + oldest.slice(1)), attrs: attrs, ims: ims, money: money };
  },
  draw: function(d, size) {
    if (size === 's' || !d.ims.length) return '';
    return wdgListHtml('docket', d.ims.map(function(im) { return wcChallanRowHtml(im, d.money); }), ' data-wco-group="oldest"');
  },
  source: function() {
    var last = (S.incomingMaterial || []).reduce(function(m, im) { return (im.createdAt || 0) > m ? im.createdAt || 0 : m; }, 0);
    return { facts: [last ? 'Challans to ' + wcAt(last) : 'Challans', 'amber at ' + todoCfg().challanDays + ' days, red at ' + todoCfg().challanDays * 2] };
  } });

/* An invoice's steps (Docket): Created, Printed, Dispatched, Delivered, Filed, the one it stands at in the tone of how long it has sat
   there (invStateTone); a cancelled invoice has none. */
function wcInvSteps(inv, now) {
  if (inv.status === 'cancelled') return null;
  var at = Math.max(0, INV_STATES.indexOf(getInvState(inv))), age = invStateAgeText(inv);
  return { n: INV_STATES.length, at: at, tone: invStateTone(inv, now), say: invStateWord(inv) + (age ? ' · ' + age : '') };
}
/* An invoice as a register row: its number, its client and its date, its total and its steps; `act` its own one action. */
function wcInvRowHtml(inv, now, act, money) {
  return wdgDocketRowHtml({ no: inv.displayNumber || inv.invoiceNumber || '', party: inv.clientName || '',
    meta: escHtml(inv.status === 'cancelled' ? 'Cancelled · ' + formatDate(inv.date) : formatDate(inv.date)),
    amount: money === false ? '' : inrTextHtml(inv.grandTotal), steps: wcInvSteps(inv, now),
    go: { action: 'invViewInvoiceDetail', attrs: ' data-id="' + escHtml(inv.id) + '"' }, act: act, attrs: ' data-recent-inv="' + escHtml(inv.id) + '"' });
}
/* Recent invoices (a Docket): the invoices made last, newest first (homeRecentInvoices), each a register row ending in its Print
   (owner, 6 Oct 2026: four taps to print a recent invoice), its state as steps. Mark the printed ones dispatched is its Act while any
   wait (Invoices with them ticked). */
wdgDefine({ id: 'recent', title: 'Recent invoices', q: 'What went out last?', section: 'office', type: 'docket', sizes: ['m', 'l'],
  needs: { page: 'pageRegister' }, go: { tab: 'pageRegister' },
  data: function(ctx) {
    var list = homeRecentInvoices(ctx.size === 'l' ? 10 : 6), attrs = ' data-card="recent-pulse"';
    if (!list.length) return { state: 'empty', title: 'No invoices yet', body: 'An invoice made on Create is listed here, its print a tap away.',
      act: wcDoor('Create your first invoice', 'invCreateNew'), attrs: attrs };
    var head = tdyRecentHead(list), money = tdySeesMoney();
    var printed = (S.invoices || []).filter(function(i) { return i.status === 'active' && getInvState(i) === 'printed'; });
    return { state: 'ok', tone: 'neutral', fig: head.made && money ? inrFigHtml(head.sum) : '', line: head.title, list: list, printed: printed, money: money, attrs: attrs };
  },
  draw: function(d) {
    var now = Date.now();
    return wdgListHtml('docket', d.list.map(function(inv) {
      return wcInvRowHtml(inv, now, { label: 'Print ' + (inv.displayNumber || ''), action: 'invPreviewInvoice', attrs: ' data-id="' + escHtml(inv.id) + '"', icon: 'print' }, d.money);
    }), ' id="recentInvoices"');
  },
  actRow: function(d) {
    var n = d.printed.length;
    return { tint: n ? { label: 'Mark the ' + (n === 1 ? 'printed one' : n + ' printed') + ' dispatched', action: 'invWdgJump',
        attrs: wdgJumpAttrs({ kind: 'regState', state: 'printed', ids: d.printed.map(function(i) { return i.id; }) }) } : null,
      text: { label: 'New invoice', action: 'invCreateNew' } };
  },
  source: function(d) { return { facts: ['Invoices to ' + wcAt(d.list[0].createdAt)] }; } });

/* Quick actions (Tools): each action by its page (the guard's own map); keys on a sunk tray, three at Small (two on a phone's: New
   invoice and Paste), six at Medium, where Create's invoice form, kept as typed when it is left, is offered to continue. */
var WC_QUICK = [
  { label: 'New invoice', icon: 'filePlus', page: 'pageCreate', action: 'invCreateNew' },
  { label: 'New challan', icon: 'boxPlus', page: 'pageIM', go: 'challan' },
  { label: 'Paste message', short: 'Paste', icon: 'message', page: 'pageStaff', go: 'paste' },
  { label: 'Stock entry', icon: 'flask', page: 'pageStock', go: 'stock' },
  { label: 'Attendance', icon: 'userCheck', page: 'pageStaff', go: 'attendance' },
  { label: 'Add task', icon: 'task', page: 'pageHome', go: 'task' }
];
/* Create's form holding typed work (createFormHasWork): what it is, in a few words, or ''. */
function wcCreateHeld() {
  if (typeof createFormHasWork !== 'function' || !createFormHasWork()) return '';
  var f = invoiceForm, c = f.clientId ? (S.clients || []).find(function(x) { return x.id === f.clientId; }) : null;
  return f.editingId ? 'Your changes to ' + ((S.invoices.find(function(i) { return i.id === f.editingId; }) || {}).displayNumber || 'an invoice')
    : 'An invoice' + (c ? ' for ' + c.name : '') + ', ' + todoPlural(f.items.length, 'line');
}
wdgDefine({ id: 'quick', title: 'Quick actions', short: 'Quick actions', q: 'What do I start?', section: 'office', type: 'tools', sizes: ['s', 'm'], card: 'quick',
  data: function() {
    var list = WC_QUICK.filter(function(a) { return typeof grdSees !== 'function' || grdSees(a.page); });
    if (!list.length) return { state: 'empty', title: 'Nothing to start here for your ID' };
    return { state: 'ok', tone: 'neutral', list: list };
  },
  draw: function(d, size) {
    var list = d.list;
    if (size === 's') {
      // A phone's Small holds two keys: the two the owner starts most, else the first two the role has.
      list = !_isDesktop ? list.filter(function(a) { return a.page === 'pageCreate' || a.go === 'paste'; }).concat(list).filter(function(a, i, all) { return all.indexOf(a) === i; }).slice(0, 2)
        : list.slice(0, 3);
    }
    var keys = list.slice(0, 6).map(function(a) {
      return { label: size === 's' && !_isDesktop && a.short ? a.short : a.label, icon: a.icon, action: a.action || 'invHomeQuick', attrs: a.go ? ' data-go="' + a.go + '"' : '' };
    });
    var held = size === 'm' && list.some(function(a) { return a.page === 'pageCreate'; }) ? wcCreateHeld() : '';
    return wdgTrayHtml(keys) + (held ? '<p class="inv-widget-cap">Started here and not saved</p>' + wdgListHtml('rows', [wdgRowHtml({ title: held,
      meta: 'on Create, kept as typed', act: { label: 'Continue', action: 'invSwitchTab', attrs: ' data-tab="pageCreate"' }, attrs: ' data-wc-held="create"' })]) : '');
  } });

/* The GitHub backup (Tools, a Small): when the book last went (ghCardOpts, coded by whether a working day has passed since), the
   repository its detail, Back up now (or Register, on a device the guard keeps from syncing) its one tinted button. */
wdgDefine({ id: 'sync', title: 'GitHub backup', short: 'Backup', q: 'Is the book backed up?', section: 'office', type: 'tools', sizes: ['s'],
  needs: { perm: 'settings' }, go: { settings: 'sync' }, card: 'sync',
  data: function() {
    var o = ghCardOpts();
    if (!o) return { state: 'notset', title: 'GitHub sync is not set up', body: 'A second copy of the book on GitHub, pushed from this device.', attrs: ' data-card="sync"' };
    return { state: 'ok', tone: o.tone, line: escHtml(o.say), sub: o.repo ? '<span class="inv-id">' + escHtml(o.repo) + '</span>' : '', o: o, attrs: ' data-card="sync"' };
  },
  draw: function(d) {
    var a = d.o.act;
    return a ? '<div class="inv-widget-act" data-wdg-push><button type="button" class="inv-btn inv-btn-tint inv-btn-sm" data-action="' + escHtml(a.action) + '"' + (a.attrs || '') +
      (a.disabled ? ' disabled' : '') + '>' + escHtml(a.label) + '</button></div>' : '';
  } });

/* Turnaround (a Docket): the flow thread's reading of the plant (flowStats, flowVerdict), as Floor's Overview's Turnaround hero reads it,
   and its door In plant, as the hero's. Small: the median working days from challan to despatch against its target; Medium: the
   slowest clients, each against its own target; Large: the steps from the challan to pickling, plating and despatch (flowStepsHtml, the
   screen's rows: and invoice to payment for a role that sees money). */
wdgDefine({ id: 'turn', title: 'Turnaround', short: 'Turnaround', q: 'How fast does work go back out?', section: 'office', type: 'docket', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageProduction' }, go: { tab: 'pageProduction', v: 'plant' }, card: 'turn',
  data: function(ctx) {
    var st = flowStats(null);
    if (!st.lines) return { state: 'empty', title: 'No challan in 90 days', body: 'The turnaround reads each challan to the day its material goes back out.',
      act: typeof grdSees !== 'function' || grdSees('pageIM') ? wcDoor('Add challan', 'invHomeQuick', ' data-go="challan"') : null };
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
      }).filter(Boolean).sort(function(a, b) { return b.d - a.d || (a.within == null ? 1 : a.within) - (b.within == null ? 1 : b.within); }).slice(0, 4);
      slow.forEach(function(x) { tones.push(x.tone); });
    }
    if (ctx.size === 'l' && st.pay && wdgSeesMoney()) tones.push(flowPayTone(st.pay.d, st.terms.days));
    var target = 'a ' + flowTargetWord(v.t.days);
    return { state: 'ok', tone: wcWorst(tones), fig: escHtml(String(st.toDespatch.d)) + '<span class="inv-unit">' + (st.toDespatch.d === 1 ? 'day' : 'days') + '</span>',
      line: escHtml(v.on || v.head), sub: escHtml(ctx.size === 's' ? 'against ' + target : 'working days, challan to despatch; ' + target), st: st, slow: slow };
  },
  draw: function(d, size, ctx) {
    if (size === 's') return '';
    var rows = d.slow.length ? wdgListHtml('rows', d.slow.map(function(x) {
      return wdgRowHtml({ title: x.name, meta: escHtml('median of ' + todoPlural(x.n, 'line') + ' · a ' + flowTargetWord(x.target)), tone: x.tone, word: flowDayText(x.d),
        attrs: ' data-wco-client="' + escHtml(x.id) + '"' });
    }), ' data-wco-group="slow"') : '<div class="inv-widget-sub">No client has ' + FLOW_MIN + ' lines despatched in 90 days yet</div>';
    if (size === 'm') return rows;
    return wcPartsHtml([rows, '<div class="inv-widget-rows" data-wco-group="steps">' + flowStepsHtml(d.st, null) + '</div>']);
  },
  source: function() { return { facts: ['Challans of the last ' + FLOW_DAYS + ' days', 'working days, Sundays out'] }; } });

/* Pipeline, stage by stage (a Docket): Pipeline's own stages (pipeStages: each a count, an amount and a tone by how long its oldest has
   waited; Owed to us only for a role that sees money) and its words for a stage running late (pipeLateSay). Small: the stage it leads
   with, its amount and its words; Medium: the stages as one strip, the one it leads with lifted, each opening Pipeline on itself (on a
   narrow card a stage a row); Large: the strip, and the oldest of the stage it leads with as rows, each ending in that stage's own
   action. From Medium the card has no figure of its own, as Pipeline's verdict has none: a stage's amount is its cell's. */
function wcPipeLead(d) { return d.worst || d.open[0] || null; }
function wcPipeOldestRows(s, now) {
  if (s.key === 'awaiting') return s.items.slice(0, 6).map(function(im) { return wcChallanRowHtml(im, true); });
  if (s.key === 'owed') {
    return s.items.slice().sort(function(a, b) { return (b.oldestDays || 0) - (a.oldestDays || 0) || b.owed - a.owed; }).slice(0, 6).map(function(r) {
      var id = escHtml(String(r.client.id));
      return wdgRowHtml({ title: r.client.name, meta: escHtml(r.open.length + ' open' + (r.oldestDays != null ? ' · oldest ' + r.oldestDays + ' d' : '')),
        fig: figHtml(inrTextHtml(r.owed), finOwedTone(r.oldestDays)), go: { action: 'invFinGo', attrs: ' data-tab="receipts" data-client="' + id + '"' },
        act: { label: 'Statement', action: 'invWdgJump', attrs: wdgJumpAttrs({ kind: 'soa', client: r.client.id }) }, attrs: ' data-wco-owed="' + id + '"' });
    });
  }
  // An invoice state: its oldest first by its days in the state (delivered, by when its GSTR-1 is due), each ending in the state's step.
  var list = s.key === 'delivered' ? s.items.filter(invFileDue).sort(function(a, b) { return invFileDue(a) - invFileDue(b); })
    : s.items.slice().sort(function(a, b) { return invStateDays(b, now) - invStateDays(a, now); });
  var act = function(inv) {
    var id = ' data-id="' + escHtml(inv.id) + '"';
    if (s.key === 'created') return { label: 'Print ' + (inv.displayNumber || ''), action: 'invPreviewInvoice', attrs: id, icon: 'print' };
    if (s.key === 'printed') return { label: 'Dispatched', action: 'invAdvanceState', attrs: id + ' data-state="dispatched"' };
    if (s.key === 'dispatched') return { label: 'Delivered', action: 'invAdvanceState', attrs: id + ' data-state="delivered"' };
    return { label: 'File', action: 'invPipeFile', attrs: ' data-month="' + escHtml(String(inv.date || '').slice(0, 7)) + '"' };
  };
  return list.slice(0, 6).map(function(inv) { return wcInvRowHtml(inv, now, act(inv)); });
}
wdgDefine({ id: 'pipe', title: 'Pipeline, stage by stage', short: 'Pipeline', q: 'What is waiting, from challan to payment?', section: 'office', type: 'docket', sizes: ['m', 's', 'l'],
  needs: { page: 'pagePipeline' }, go: { tab: 'pagePipeline' }, card: 'pipe',
  data: function(ctx) {
    var stages = pipeStages(), open = stages.filter(function(s) { return s.open; });
    if (!open.length && !(S.invoices || []).some(function(i) { return i.status === 'active'; }) && !(S.incomingMaterial || []).some(function(im) { return (im.items || []).length; })) {
      return { state: 'empty', title: 'No challan or invoice yet', body: 'The pipeline follows a challan in to its invoice and the money back.',
        act: typeof grdSees !== 'function' || grdSees('pageIM') ? wcDoor('Add challan', 'invHomeQuick', ' data-go="challan"') : null };
    }
    // The worst stage running late: red before amber, and in the pipeline's own order within a tone.
    var late = open.filter(function(s) { return s.tone === 'danger' || s.tone === 'warning'; })
      .sort(function(a, b) { return (UI_TONE_RANK[uiTone(b.tone)] || 0) - (UI_TONE_RANK[uiTone(a.tone)] || 0); });
    var d = { state: 'ok', tone: late.length ? uiTone(late[0].tone) : 'ok', stages: stages, open: open, worst: late[0] || null };
    var s = wcPipeLead(d), w = d.worst;
    var say = w ? pipeLateSay(w) : s ? 'Nothing running late' : 'Nothing on its way';
    d.line = escHtml(pipeNoThisYear(say.charAt(0).toUpperCase() + say.slice(1)));
    if (!s) d.sub = 'every invoice filed, nothing waiting';
    else if (ctx.size === 's') {
      d.fig = inrFigHtml(s.amount);
      d.sub = escHtml(s.label + ' · ' + todoPlural(s.n, s.key === 'awaiting' ? 'challan' : s.key === 'owed' ? 'client' : 'invoice'));
    }
    return d;
  },
  draw: function(d, size) {
    var lead = wcPipeLead(d);
    if (size === 's' || !lead) return '';
    var strip = wdgStageHtml(d.stages.map(function(s) {
      return { key: s.key, label: s.label, count: s.noBank ? '—' : s.n, tone: s.open ? s.tone : 'neutral', lead: s === lead,
        sum: s.noBank ? 'Needs a statement' : s.open ? inrTextHtml(s.amount) : 'None',
        go: s.open ? { action: 'invSwitchTab', attrs: ' data-tab="pagePipeline" data-v="' + escHtml(s.key) + '"' } : null, attrs: ' data-wco-stage="' + escHtml(s.key) + '"' };
    }));
    if (size === 'm') return strip;
    var rows = wcPipeOldestRows(lead, Date.now());
    return strip + (rows.length ? '<p class="inv-widget-cap">' + escHtml('The oldest, ' + lead.label.toLowerCase()) + '</p>' +
      wdgListHtml(lead.key === 'owed' ? 'rows' : 'docket', rows, ' data-wco-group="oldest"') : '');
  },
  source: function() { return { facts: ['Challans and invoices to ' + homeClockText(new Date()), 'ages in working days'] }; } });

/* Quotations and prospects (a Docket): the quotations counted as their verdict counts them (qtTally, qtTallyTone) and Prospects'
   pipeline against the spare (prsPipeline, prsSpare), its four factors as Prospects' verdict draws them. Small: the quotations out, won
   and lost; Medium: the spare and the weighted pipeline, and how much of the spare it would fill. Its door is Sales; following up the
   prospects due is its Act. */
wdgDefine({ id: 'quote', title: 'Quotations and prospects', short: 'Quotations', q: 'Who could fill the spare tonnes?', section: 'office', type: 'docket', sizes: ['s', 'm'],
  needs: { page: 'pageClients' }, go: { tab: 'pageClients', v: 'prospects' }, card: 'quote',
  data: function(ctx) {
    var t = qtTally(), prs = getProspects();
    if (!t.all && !prs.length) return { state: 'empty', title: 'No quotation or prospect yet', body: 'Sales keeps the firms approached and the quotations sent them.',
      act: wcDoor('Add a prospect', 'invWdgGo', ' data-wid="quote"') };
    var due = prs.filter(function(p) { var l = prsLate(p); return l != null && l >= 0; });
    var follow = due.some(function(p) { return prsLate(p) >= 7; }) ? 'danger' : due.length ? 'warning' : null;
    var out = t.live + t.expired;
    var sub = t.expired ? t.expired + ' expired, unanswered' : t.soon ? t.soon + ' expiring this week' : t.toPost ? todoPlural(t.toPost, 'rate') + ' to post'
      : t.drafts ? todoPlural(t.drafts, 'draft') : t.all ? 'nothing waiting on an answer' : '';
    var d = { state: 'ok', t: t, due: due.length, follow: follow,
      fig: t.all ? escHtml(String(out)) + '<span class="inv-unit">out</span>' : '', line: t.all ? escHtml(t.accepted + ' won · ' + t.declined + ' lost') : 'No quotation sent yet',
      sub: sub ? figHtml(escHtml(sub), t.expired || t.soon || t.toPost ? 'warning' : null) : '' };
    // The Small holds the quotations alone; from Medium the prospects too: their follow-ups due, and how much of the spare the
    // pipeline fills, judged as Prospects' own tile judges it (figToneCapacity), among what the card holds.
    if (ctx.size === 's') { d.tone = qtTallyTone(t); return d; }
    d.pl = prsPipeline(); d.sp = prsSpare();
    d.fill = d.sp && d.sp.spareMonth > 0 ? d.pl.weighted / d.sp.spareMonth : null;
    d.tone = wcWorst([qtTallyTone(t), follow, d.fill != null ? figToneCapacity(d.fill * 100) : null]);
    return d;
  },
  draw: function(d, size) {
    if (size === 's') return '';
    var pl = d.pl, sp = d.sp, fill = d.fill, tn = function(kg) { return escHtml(formatNum(kg / 1000, 1)) + '<span class="inv-unit">t</span>'; };
    return wdgTilesHtml([
      { label: 'Open', fig: String(pl.n), sub: d.due ? todoPlural(d.due, 'follow-up') + ' due' : 'none due', tone: d.follow },
      { label: 'Pipeline', fig: tn(pl.weighted), sub: 'a month, weighted', attrs: ' title="' + escHtml('Weighted by the chance at each stage: new 10%, contacted 20%, sample 40%, quoted 60% (a working assumption); ' +
        formatNum(pl.kg / 1000, 1) + ' t if all came') + '"' },
      { label: 'Spare', fig: sp ? tn(sp.spareMonth) : '', sub: 'a month, the last 90 days' },
      { label: 'Fills', fig: fill != null ? Math.round(fill * 100) + '%' : '', sub: 'of the spare', tone: fill != null ? figToneCapacity(fill * 100) : null }], ' data-wco-prospects');
  },
  actRow: function(d) {
    return d.due ? { tint: { label: 'Follow up ' + d.due, action: 'invWdgJump', attrs: wdgJumpAttrs({ kind: 'prospects' }) } } : null;
  },
  source: function() { return { facts: ['Sales', 'weighted at a chance per stage'] }; } });

/* ---------- Floor ---------- */
/* Power cuts (Plant): this month's cuts and how long the plant was dark (powerCuts, Power → Cuts' own count). Medium: the month's cuts
   as rows, newest first, a cut with no time back first; completing a cut is its Act while one has none (its dialog, pcsOpen). */
wdgDefine({ id: 'powercuts', title: 'Power cuts', short: 'Power cuts', q: 'How much power did we lose?', section: 'floor', type: 'plant', sizes: ['s', 'm'],
  needs: { page: 'pagePower' }, go: { tab: 'pagePower', v: 'cuts' }, card: 'power',
  data: function() {
    var today = localDateStr(), cuts = powerCuts(today.slice(0, 8) + '01', today);
    var mins = cuts.reduce(function(s, c) { return s + (c.min || 0); }, 0), open = cuts.filter(function(c) { return c.open; });
    return { state: 'ok', tone: open.length ? 'warning' : cuts.length ? 'info' : 'ok', cuts: cuts, open: open,
      fig: escHtml(String(cuts.length)) + '<span class="inv-unit">' + (cuts.length === 1 ? 'cut' : 'cuts') + '</span>',
      line: escHtml(!cuts.length ? 'No cut this month' : mins ? powerDur(mins) + ' dark this month' : 'This month, no time back yet'),
      sub: open.length ? figHtml(escHtml(todoPlural(open.length, 'cut') + ' with no time back'), 'warning') : '' };
  },
  draw: function(d, size) {
    if (size === 's' || !d.cuts.length) return '';
    var list = d.cuts.slice().sort(function(a, b) { return (b.open ? 1 : 0) - (a.open ? 1 : 0) || String(b.date).localeCompare(String(a.date)) || (b.from || 0) - (a.from || 0); });
    return wdgListHtml('rows', list.map(function(c) {
      return wdgRowHtml({ title: stockShortDate(c.date) + ', ' + powerClock(c.from) + (c.open ? '' : ' – ' + powerClock(c.to)), meta: escHtml(c.reason || c.note || ''),
        tone: c.open ? 'warning' : 'neutral', word: c.open ? 'No time back' : powerDur(c.min || 0), attrs: ' data-wc-cut="' + escHtml(c.ids[0]) + '"' });
    }), ' data-wc-cuts');
  },
  actRow: function(d) {
    var c = d.open[0];
    return c ? { tint: { label: 'Complete the cut', action: 'invWdgJump', attrs: wdgJumpAttrs({ kind: 'powerCut', id: c.ids[0] }) } } : null;
  },
  source: function() { return { facts: ['Cuts from the register, the messages and by hand', 'this month'] }; } });

/* Zinc rate (Outside: the market, read with the shop's own uplift and premium): the landed rate a kilo, which keeps its paise (a rate,
   §1a-18), and the market's last refreshes as a line; its derivation under it. Its Refresh is its Source's link. */
wdgDefine({ id: 'zinc', title: 'Zinc rate', short: 'Zinc rate', q: 'What is zinc costing today?', section: 'floor', type: 'outside', sizes: ['s', 'm'],
  needs: { money: true }, go: { settings: 'zinc' }, card: 'zinc',
  data: function() {
    var o = zincCardOpts();
    if (o.none) return { state: 'notset', title: 'No zinc rate recorded', body: String(o.sub || '').replace(/<[^>]*>/g, ''),
      act: getMetalsKey() ? wcDoor('Refresh', 'invRefreshZinc') : wcDoor('Set the zinc rate', 'invOpenSettings', ' data-sec="zinc"'), attrs: o.attrs };
    var z = getZinc();
    return { state: 'ok', tone: o.stale ? 'warning' : 'neutral', fig: escHtml(formatCurrency(zincLandedRate())) + '<span class="inv-unit">a kg, landed</span>',
      line: '<span data-zinc-age="' + (o.stale ? 'stale' : 'fresh') + '">' + escHtml(wcCap(o.age) + (o.stale ? ', may be out of date' : '')) + '</span>',
      lamp: o.stale ? 'warning' : 'ok', sub: o.sub, viz: o.viz, z: z, age: o.age, stale: o.stale, attrs: o.attrs };
  },
  draw: function(d, size) {
    if (size === 's' || !d.viz) return '';
    return '<div class="inv-widget-viz">' + d.viz + '</div>';
  },
  source: function(d) {
    var z = getZinc(), lme = z && z.basis === 'lme';
    return { facts: ['metals.dev', d && d.age ? d.age : '', lme ? 'MCX estimated from LME' : 'MCX as set'], refresh: getMetalsKey() ? { action: 'invRefreshZinc' } : null };
  } });
/* The words that follow a separator start low ("VAT A1 · not judged"): the screens' words start high, as a dot says them. */
function wcFlrLc(s) { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); }
/* Hours as a person reads them: 8, 7.5. */
function wcFlrHours(h) { return formatNum(h, 1).replace(/\.0$/, ''); }
/* The day a figure is of, short: today, yesterday, else its weekday and date. */
function wcFlrDayWord(day) {
  var lag = isoDaysBetween(day, localDateStr());
  return lag <= 0 ? 'Today' : lag === 1 ? 'Yesterday' : attDayName(day) + ' ' + stockShortDate(day);
}
/* The worst of some tones, as a line card is coded by the worst of what it holds (a tie keeps the first; info is no worse than ok). */
var WC_FLR_RANK = { danger: 3, warning: 2, ok: 1, info: 1, neutral: 0 };
function wcFlrWorst(tones) {
  return tones.reduce(function(t, x) { return x && (WC_FLR_RANK[x] || 0) > (WC_FLR_RANK[t] || 0) ? x : t; }, 'neutral');
}
/* The floor's lines on a day as Floor's Overview judges its line cards (floor.js flrLineJudge over areaStats), the three plating lines
   worst first, a tie in tone going to the lower efficiency, each with what it plated (prodDayLine) and the EXTRA booked to its areas;
   and how many lines are short of their number. Once a book and a day. */
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
/* A plating line's state in a few words, as its card says it. */
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
  return r && r.kg > 0 ? prodKgFig(r.kg, r.est > 0.0005, r.unweighed > 0) : r && r.nos > 0 ? Math.round(r.nos).toLocaleString('en-IN') + ' NOS' : '';
}
/* A line's efficiency as a gauge, its mark at three quarters (PROD_EFF_OK). */
function wcFlrGauge(ef) {
  if (!ef || ef.eff == null || !(ef.possible > 0)) return '';
  return chartMeter([{ v: Math.min(ef.kg, ef.possible * 1.2), tone: ef.tone === 'neutral' ? 'neutral' : ef.tone }],
    { max: ef.possible, mark: ef.possible * PROD_EFF_OK, title: prodKgFig(ef.kg, ef.est, ef.unweighed > 0) + ' of ' + prodKgFig(ef.possible) + ' (' + ef.word + '); the mark is three quarters' });
}
/* A plating line as a Plant row: its lamp, its nameplate, its state and what it plated with its heads, its efficiency on a gauge. It
   opens Production → Lines on its line and the day, where the role opens Production. */
function wcFlrPlantRow(x, day, isToday) {
  var ef = x.j.ef, fig = wcFlrPlated(x.r), id = x.ln.id;
  return wdgPlantRowHtml({ tone: x.j.tone, plate: flrLineName(id), what: wcFlrLineWord(x, isToday), meta: escHtml([x.j.st.word, fig].filter(Boolean).join(' · ')),
    fig: ef && ef.eff != null ? escHtml(Math.round(ef.eff * 100) + '%') : '', gauge: wcFlrGauge(ef),
    go: flrSees('pageProduction') ? { action: 'invProdDayLines', attrs: ' data-day="' + escHtml(day) + '" data-line="' + escHtml(id) + '"' } : null,
    attrs: ' data-wc-line="' + escHtml(id) + '"' });
}
/* A day's picture (prodDayPicture), once a book and a day. */
function wcFlrPic(day) { return wdgMemo('flr-pic:' + day, function() { return prodDayPicture(day); }); }
/* The day on one bar, 6 AM to 6 AM: every line's runs, and the cuts. */
function wcFlrDayStrip(pic) {
  if (!pic || !pic.runs) return '';
  var spans = [];
  PROD_LINES.forEach(function(l) { (pic.spans[l] || []).forEach(function(x) { spans.push({ from: x.from, to: x.to, tone: 'ok' }); }); });
  (pic.cuts || []).forEach(function(c) { if (c.from != null) spans.push({ from: c.from, to: c.to != null ? c.to : c.from + 10, tone: 'danger' }); });
  return spans.length ? chartDayStrip(spans, { title: 'The day on the clock, 6 AM to 6 AM: the lines running, and the cuts' }) : '';
}
/* The floor now (Plant): who is on site against the day's roster (attOnSiteTone, the People card's judge) and the worst line. Medium:
   the lines running and the heads on site as readings, the day on one bar, a line a row; Large: the units down and the EXTRA booked
   too. Today, as Floor's Overview opens; heads only, never a rupee, so every role that opens Floor sees it. */
wdgDefine({ id: 'floornow', title: 'The floor now', short: 'Floor now', q: 'Who is on site and what is running?', section: 'floor', type: 'plant', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFloor' }, card: 'floor-now',
  // Floor's Overview on today, as Needs you's floor card opens it.
  go: function() { flrSetDay(null); switchTab('pageFloor'); },
  data: function() {
    var day = localDateStr(), F = wcFlrLines(day), d = F.att;
    var ran = F.lines.some(function(x) { return x.r.entries.length > 0; });
    if (!d.roster.length && !ran && !homeLastPlatedDay()) return { state: 'empty', title: 'Nothing on the floor yet', body: 'People → Roster holds the crew, and Production records what each line plates.',
      act: wcDoor('Open the floor', 'invWdgGo', ' data-wid="floornow"') };
    var onTone = attOnSiteTone(d, F.short), worst = F.lines[0], n = d.roster.length, on = d.p + d.half;
    var line = !d.marked && !ran ? 'Nothing recorded yet today' : flrLineName(worst.ln.id) + ' · ' + wcFlrLc(wcFlrLineWord(worst, true));
    var sub = d.marked ? [d.complement ? d.floorHeads + ' of ' + d.complement + ' on the floor' : '', todoPlural(d.absent.length, 'absent', 'absent') + (d.unmarked ? ', ' + d.unmarked + ' unmarked' : '')]
      .filter(Boolean).join(' · ') : 'the in-time roll fills it';
    return { state: 'ok', tone: wcFlrWorst([onTone].concat(F.lines.map(function(x) { return x.j.tone; }))),
      fig: d.marked ? figHtml(String(on), onTone) + '<span class="inv-unit">of ' + n + ' on site</span>' : '&mdash;', line: escHtml(line), sub: escHtml(sub), F: F, day: day };
  },
  draw: function(d, size) {
    if (size === 's') return '';
    var F = d.F, running = F.lines.filter(function(x) { return x.r.entries.length > 0; }).length;
    var rows = F.lines.map(function(x) { return wcFlrPlantRow(x, d.day, true); });
    var h = '<div class="inv-widget-sub">' + wdgReadingHtml(escHtml(String(running)), running === 1 ? 'line running' : 'lines running') + ' ' +
      (F.att.marked ? wdgReadingHtml(escHtml(String(F.att.floorHeads)), 'heads on the floor') : '') + '</div>';
    var strip = wcFlrDayStrip(wcFlrPic(d.day));
    if (strip) h += '<div class="inv-widget-viz" data-wdg-opt>' + strip + '</div>';
    h += wdgListHtml('plant', rows, ' data-wc-lines');
    if (size !== 'l') return h;
    // The units not working on each line (the plant register, as found on the day), and the EXTRA booked: the day's whole, by line.
    var nUnits = 0, nDown = 0, half = false, words = [];
    F.lines.forEach(function(x) {
      var cap = pltCapacity(x.ln.id, d.day);
      if (!cap.n) return;
      nUnits += cap.n; nDown += cap.down.length;
      if (x.j.ef && x.j.ef.halfDown) half = true;
      if (cap.down.length) words.push(pltDownWords(cap.down, d.day));
    });
    var att = F.att, byLine = F.lines.filter(function(x) { return x.extra > 0.0005; }).map(function(x) { return flrLineName(x.ln.id) + ' ' + wcFlrHours(x.extra) + ' h'; });
    return h + '<div class="inv-widget-rows">' + uiFactRowHtml({ label: 'Units down', value: nUnits ? nDown + ' of ' + nUnits : '', tone: half ? 'danger' : null, attrs: ' data-wc-units',
        sub: !nUnits ? 'no unit on the plant register' : nDown ? words.join(' · ') : 'every unit working' }) +
      uiFactRowHtml({ label: 'EXTRA booked', value: att.marked ? wcFlrHours(att.extraH) + ' h' : '', attrs: ' data-wc-extra',
        sub: !att.marked ? 'no attendance today' : byLine.length ? byLine.join(' · ') : att.extraH > 0.0005 ? 'off the plating lines' : 'none booked today' }) + '</div>';
  },
  source: function(d) {
    var pic = wcFlrPic(d.day), last = null;
    PROD_LINES.forEach(function(l) { (pic.spans[l] || []).forEach(function(x) { if (x.to != null && (last == null || x.to > last)) last = x.to; }); });
    return { facts: [d.F.att.marked ? 'Attendance of today' : 'No attendance today yet', last != null ? 'register to ' + relayClockLabel(last % 1440) : 'no register today', 'the day’s cuts'] };
  } });

/* Whether a floor's name is one of the client's own part numbers (the challans name it), so its weight is what is missing; else the
   floor's word is to be read as a part first. */
function wcFlrPartKnown(clientId, part) {
  var k = rateKey(part || '');
  if (!k || clientId == null) return false;
  return (S.incomingMaterial || []).some(function(im) {
    return String(im.clientId) === String(clientId) && (im.items || []).some(function(it) { return rateKey(it.partNumber || '') === k; });
  });
}
/* The pieces nothing weighs as rows (the day card's own list, prodDayPicture's names), each ending in its one move: Which part? where
   the floor's name is not one of the client's part numbers, else Set its weight. */
function wcFlrUnweighedRows(names) {
  var may = typeof grdOk !== 'function' || grdOk('floor');
  return names.map(function(n) {
    var move = may && n.clientId != null && n.id && n.part ? (wcFlrPartKnown(n.clientId, n.part) ? { label: 'Set its weight', action: 'invProdWeighSet', attrs: ' data-id="' + escHtml(n.id) + '"' }
      : { label: 'Which part?', action: 'invProdAlias', attrs: ' data-id="' + escHtml(n.id) + '"' }) : null;
    return wdgRowHtml({ title: n.part || 'No part written', meta: escHtml([n.client, n.lines && n.lines.length ? n.lines.map(prodLineName).join(', ') : ''].filter(Boolean).join(' · ')),
      fig: escHtml(Math.round(n.pieces).toLocaleString('en-IN') + ' pcs'), act: move, attrs: ' data-prod-weigh="none"' });
  });
}
/* A line's day as a Plant row: its weight and runs, its efficiency. */
function wcProdLineRow(pic, l) {
  var r = pic.lines[l], ef = prodLineEfficiency(pic.date, l), miss = pic.missing.indexOf(l) >= 0;
  if (!r.entries.length && !miss) return '';
  if (!r.entries.length) return wdgPlantRowHtml({ tone: 'warning', plate: prodLineName(l), what: 'No record', meta: 'Heads on the general shift, nothing recorded', attrs: ' data-prod-day-line="' + l + '"' });
  return wdgPlantRowHtml({ tone: ef.tone, plate: prodLineName(l), what: wcFlrPlated(r) || 'Ran', meta: escHtml(todoPlural(r.entries.length, 'run') + (r.rounds ? ', ' + todoPlural(r.rounds, 'round') : '')),
    fig: ef.eff != null ? escHtml(Math.round(ef.eff * 100) + '%') : '', gauge: wcFlrGauge(ef),
    go: { action: 'invProdDayLines', attrs: ' data-day="' + escHtml(pic.date) + '" data-line="' + l + '"' }, attrs: ' data-prod-day-line="' + l + '"' });
}
/* Production, the last day (Plant): the day card's reading (prodDayHeroOpts, as Floor's Overview draws it), its weight the figure.
   Small: the day and a gauge against the plant's usual day; Medium: its verdict and each line as a row; Large, the day or the line
   picked (Choose), and its pieces not weighed as rows, each ending in its move. The last day with plating on record, said which. */
var WC_PROD_CHOOSE = [{ v: 'all', label: 'All lines' }, { v: 'vat-a1', label: 'VAT A1' }, { v: 'vat-a2', label: 'VAT A2' }, { v: 'barrel', label: 'Barrel' }];
wdgDefine({ id: 'prodday', title: 'Production, the last day', short: 'Production', q: 'What did we plate?', section: 'floor', type: 'plant', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageProduction' }, go: { tab: 'pageProduction', v: 'lines' },
  choose: { def: 'all', opts: function() { return WC_PROD_CHOOSE; } },
  data: function(ctx) {
    var day = homeLastPlatedDay();
    if (!day) return { state: 'empty', title: 'No plating recorded yet', body: 'The register page, the barrel list and the pickling messages record what each line plates.',
      act: wcDoor('Open Production', 'invWdgGo', ' data-wid="prodday"'), attrs: ' data-card="production"' };
    var o = prodDayHeroOpts(day, { compact: true, attrs: ' data-card="production"' }), pic = o.pic, when = wcFlrDayWord(day) + (o.isToday ? ' so far' : '');
    var line = ctx.size === 'l' && ctx.choose !== 'all' && pic && pic.lines[ctx.choose] ? escHtml(prodLineName(ctx.choose) + ': ' + (wcFlrPlated(pic.lines[ctx.choose]) || 'no run')) : o.title;
    return { state: 'ok', tone: WDG_TONES[o.tone] ? o.tone : 'neutral', fig: o.fig || '', line: ctx.size === 's' ? escHtml(when) : line,
      sub: ctx.size === 's' ? '' : escHtml(when + ' · ' + (pic && pic.usual != null ? 'a usual day ' + prodKgFig(pic.usual, true) : 'no usual day yet')), pic: pic, day: day, attrs: o.attrs };
  },
  draw: function(d, size, ctx) {
    var pic = d.pic;
    if (!pic || !pic.runs) return '';
    if (size === 's') {
      return '<div class="inv-widget-viz" data-wdg-push>' + chartMeter([{ v: pic.kg, tone: d.tone === 'neutral' ? 'neutral' : d.tone }],
        { max: Math.max(pic.capacity, pic.kg), mark: pic.usual, title: prodKgFig(pic.kg, pic.est > 0.0005, pic.unweighed > 0) + ' plated' + (pic.usual != null ? '; a usual day is ' + prodKgFig(pic.usual, true) + ' (the mark)' : '') }) + '</div>';
    }
    var pick = size === 'l' && ctx.choose && ctx.choose !== 'all' ? ctx.choose : null;
    var lines = (pick ? [pick] : PROD_LINES).map(function(l) { return wcProdLineRow(pic, l); }).filter(Boolean);
    var h = lines.length ? wdgListHtml('plant', lines, ' data-prod-day-lines') : '<div class="inv-widget-sub">' + escHtml(prodLineName(pick) + ' did not run that day') + '</div>';
    if (size !== 'l') return h;
    var names = (pic.names || []).filter(function(n) { return !pick || (n.lines || []).indexOf(pick) >= 0; });
    return wcPartsHtml([h, names.length ? '<p class="inv-widget-cap">Not weighed</p>' + wdgListHtml('rows', wcFlrUnweighedRows(names), ' data-wc-unweighed') : '']);
  },
  source: function(d) { return { facts: ['Register pages of ' + stockShortDate(d.day), 'pickling messages', 'each run weighed by the surest route'] }; } });

/* Each working day's plating over the three lines, as production_days holds it (a line-day with no run is a gap), and the day's
   power cuts (power_cuts): the day's kilos where any run was weighed, and whether nine tenths of its pieces were. The usual day is the
   one before today (prodUsualDay), so every day is judged on one basis. Once a book. */
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
/* Plated each day (Plant): a calendar of the weeks (chartHeat, bare: the one blue ramp; a day with no record hatched), Medium eight
   weeks and Large twelve, with how many days fell under a usual day (prodDayUnder) and how many of those had a cut; Large names the
   light days that were cut days as rows. Today is drawn as to date and never judged. */
wdgDefine({ id: 'heat', title: 'Plated each day', q: 'Which days ran light, and why?', section: 'floor', type: 'plant', sizes: ['l', 'm'],
  needs: { page: 'pageProduction' }, go: { tab: 'pageProduction', v: 'lines' }, card: 'plated-days',
  data: function(ctx) {
    var D = wcFlrDays(), today = localDateStr();
    if (!D.days.some(function(x) { return x.ran; })) return { state: 'empty', title: 'No plating recorded yet', body: 'The register page, the barrel list and the pickling messages record what each line plates.',
      act: wcDoor('Open Production', 'invWdgGo', ' data-wid="heat"') };
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
    var cutLight = light.filter(function(x) { return x.cut; }), plated = shown.filter(function(x) { return x.ran; }).length;
    var line = D.usual == null ? todoPlural(plated, 'day') + ' plated in ' + weeks + ' weeks'
      : light.length ? todoPlural(light.length, 'day') + ' under a usual day, ' + (cutLight.length ? cutLight.length + ' with a cut' : 'none with a cut') : 'No day under a usual day in ' + weeks + ' weeks';
    return { state: 'ok', tone: 'neutral', line: escHtml(line), sub: escHtml(D.usual == null ? 'No usual day yet to judge them by' : 'A usual day ' + prodKgFig(D.usual, true) + ' · ' + weeks + ' weeks'),
      weeks: weeks, cells: cells, light: light, usual: D.usual, today: today, cutLight: cutLight };
  },
  draw: function(d, size, ctx) {
    var P = wcParts(ctx), rows = size === 'l' && d.light.length;
    var heat = '<div class="inv-widget-viz">' + chartHeat(d.cells, wdgChartOpts({ w: rows && P.side ? P.w : ctx.w }, 0, { unit: 'kg', weeks: d.weeks, toDate: d.today, labelHead: 'Day', valueHead: 'Plated',
      ariaLabel: 'Plated each day, ' + d.weeks + ' weeks', emptyText: 'No plating in ' + d.weeks + ' weeks' })) + '</div>';
    if (!rows) return heat;
    // The days under a usual day that were cut days, the latest first; how many had no cut on record, one row.
    var list = d.cutLight.slice().reverse().map(function(x) {
      return wdgRowHtml({ title: attDayName(x.date) + ' ' + stockShortDate(x.date), meta: escHtml(wcFlrCutWords(x.cut)), fig: escHtml(prodKgFig(x.kg)), tone: 'warning', word: 'Light, a cut',
        attrs: ' data-wc-light="' + escHtml(x.date) + '"' });
    });
    var calm = d.light.length - d.cutLight.length;
    if (calm) list.push(wdgRowHtml({ title: 'Under a usual day, no cut on record', fig: String(calm), attrs: ' data-wc-light-nocut' }));
    return wcPartsHtml([heat, wdgListHtml('rows', list)]);
  },
  source: function(d) { return { facts: ['Plated, weighed by the surest route', d.usual != null ? 'a usual day ' + prodKgFig(d.usual, true) : 'no usual day yet'] }; } });

/* Line efficiency on the last day with plating (Plant; prodLineEfficiency, Floor's line cards' own figure and tone): Small the worst
   line's figure; Medium the three lines as rows, each on a gauge marked at three quarters; Large each line's factor that lost most
   (flrEffMoved, the card's own caption) in its row. */
wdgDefine({ id: 'eff', title: 'Line efficiency, now', short: 'Efficiency', q: 'Is each line plating what it can?', section: 'floor', type: 'plant', sizes: ['m', 's', 'l'],
  needs: { page: 'pageProduction' }, go: { tab: 'pageProduction', v: 'lines' }, card: 'line-eff',
  data: function() {
    var day = homeLastPlatedDay();
    if (!day) return { state: 'empty', title: 'No plating recorded yet', body: 'A line’s efficiency is read from what it plated on a day.', act: wcDoor('Open Production', 'invWdgGo', ' data-wid="eff"') };
    var isToday = day === localDateStr();
    var lines = PROD_LINES.map(function(l, i) { return { l: l, i: i, ef: prodLineEfficiency(day, l) }; });
    if (!lines.some(function(x) { return x.ef.eff != null || x.ef.halfDown || x.ef.missing; })) {
      var whys = lines.filter(function(x) { return x.ef.ran && x.ef.why; }).map(function(x) { return x.ef.why; });
      if (whys.length && whys.every(function(w) { return /plant register|kg a round/.test(w); })) return { state: 'notset', title: 'Set up the plant register',
        body: 'A line’s efficiency needs its tanks or barrels and their kg a round, on Production → Equipment.', act: wcDoor('Open Equipment', 'invPltOpen') };
      return { state: 'early', title: 'No line judged yet', body: whys.length ? 'Not judged: ' + whys[0] + '.' : 'A line is judged once it has run.' };
    }
    var sorted = lines.slice().sort(function(a, b) {
      return (FLR_TONE_RANK[a.ef.tone] - FLR_TONE_RANK[b.ef.tone]) || ((a.ef.eff == null ? 9 : a.ef.eff) - (b.ef.eff == null ? 9 : b.ef.eff)) || a.i - b.i;
    });
    var w = sorted[0].ef, unit = w.unitWord || 'unit', name = prodLineName(sorted[0].l);
    var word = w.halfDown ? (w.n - w.nAvail) + ' of ' + w.n + ' ' + unit + 's down' : w.missing ? 'heads and no record' : '';
    return { state: 'ok', tone: w.tone, fig: w.eff != null ? escHtml(Math.round(w.eff * 100) + '%') : '&mdash;',
      line: escHtml(name + (word ? ' · ' + word : w.over ? ' · ' + wcFlrLc(w.word) : '')), sub: escHtml(wcFlrDayWord(day) + (isToday ? ' so far' : '')),
      lines: lines, day: day, isToday: isToday };
  },
  draw: function(d, size) {
    if (size === 's') return '';
    var rows = d.lines.map(function(x) {
      var ef = x.ef, mv = size === 'l' && ef.eff != null && ef.pace != null ? flrEffMoved(ef) : null;
      var meta = ef.eff != null ? prodKgFig(ef.kg, ef.est, ef.unweighed > 0) + ' of ' + prodKgFig(ef.possible) : ef.missing ? 'heads on the general shift, no record'
        : ef.ran ? 'not judged: ' + (ef.why || 'a figure is missing') : d.isToday ? 'not running yet' : 'did not run';
      var what = ef.eff != null ? (mv ? mv.title : ef.word) : ef.halfDown ? 'Half down' : ef.missing ? 'No record' : ef.ran ? 'Not judged' : d.isToday ? 'Not running yet' : 'Did not run';
      return wdgPlantRowHtml({ tone: ef.tone, plate: prodLineName(x.l), what: what, meta: escHtml(meta), fig: ef.eff != null ? escHtml(Math.round(ef.eff * 100) + '%') : '',
        gauge: wcFlrGauge(ef), go: flrSees('pageProduction') ? { action: 'invProdDayLines', attrs: ' data-day="' + escHtml(d.day) + '" data-line="' + escHtml(x.l) + '"' } : null,
        attrs: ' data-wc-eff="' + escHtml(x.l) + '"' });
    });
    return wdgListHtml('plant', rows, ' data-wc-eff-lines');
  },
  source: function(d) {
    var paces = d.lines.map(function(x) { return x.ef; }).filter(function(ef) { return ef.every > 0; });
    var measured = paces.some(function(ef) { return ef.everySrc === 'measured'; });
    return { facts: ['Register of ' + wcFlrDayWord(d.day).toLowerCase().replace(/^(mon|tue|wed|thu|fri|sat|sun)/, function(m) { return m.charAt(0).toUpperCase() + m.slice(1); }),
      paces.length ? 'a round every ' + Math.round(numMedian(paces.map(function(ef) { return ef.every; }))) + ' minutes, ' + (measured ? 'measured' : 'set') : 'the pace set on the plant'] };
  } });

/* The thunder hours today's forecast holds (wcThunderHours, over feeds.js's feedThunderToday): hours 0–23, or null where there is no
   forecast. */
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
function wcFlrSpans(spans) {
  return spans.map(function(s) { return relayClockLabel(s.from * 60) + ' – ' + relayClockLabel(s.to * 60 % 1440); }).join(', ');
}
/* Power cut risk by hour (Plant): the two hours the plant's cuts most often start in (powerRiskWindow over Cuts' own count by the hour
   they began), from 6 AM to 10 PM, and where today's forecast holds thunder (§9's feed) its hours beside it: two facts side by side,
   never a probability the book has not measured. Small: the hours as bars, the window lifted; Medium: the shares by the hour, the
   thunder hours a series of their own. */
wdgDefine({ id: 'risk', title: 'Power cut risk by hour', short: 'Cut risk', q: 'When is a cut likely today?', section: 'floor', type: 'plant', sizes: ['s', 'm'],
  needs: { page: 'pagePower' }, go: { tab: 'pagePower', v: 'cuts' }, card: 'cut-risk', live: 1800, feed: true,
  data: function() {
    var a = wdgMemo('power-analysis', powerAnalysis);
    if (!a.cuts.length) return { state: 'empty', title: 'No power cut recorded yet', body: 'The register’s power log, the pickling hand’s messages and Enter a cut record them.',
      act: wcDoor('Open Cuts', 'invWdgGo', ' data-wid="risk"') };
    var win = powerRiskWindow(a.hours, 6, 22);
    if (!win) return { state: 'ok', tone: 'neutral', none: true, total: a.cuts.length, line: 'No cut began between 6 AM and 10 PM', sub: escHtml(todoPlural(a.cuts.length, 'cut') + ' on record') };
    if (win.early) return { state: 'early', title: 'Not enough yet: ' + win.inRange + ' of ' + POWER_RISK_MIN + ' cuts',
      body: 'The hours cuts most often start are named from ' + POWER_RISK_MIN + ' cuts on record between 6 AM and 10 PM.' };
    var thunder = wcFlrThunder(), inWin = thunder ? thunder.filter(function(h) { return h >= win.from && h < win.to; }) : [];
    var spans = thunder && thunder.length ? wcFlrSpanList(thunder) : [], touch = spans.filter(function(s) { return s.from < win.to && s.to > win.from; });
    return { state: 'ok', tone: inWin.length ? 'warning' : 'neutral', win: win, hours: a.hours, thunder: thunder, spans: spans,
      fig: escHtml(relayClockLabel(win.from * 60) + ' – ' + relayClockLabel(win.to * 60)),
      line: escHtml(touch.length ? 'Thunder forecast ' + wcFlrSpans(touch) : win.cuts + ' of ' + win.total + ' cuts began then') };
  },
  draw: function(d, size, ctx) {
    if (d.none) return '';
    var hrs = [];
    for (var k = 6; k < 22; k++) hrs.push(k);
    var w = d.win, share = function(k) { return w.total ? Math.round((d.hours[k] || 0) / w.total * 1000) / 10 : 0; }, isT = function(k) { return d.thunder && d.thunder.indexOf(k) >= 0; };
    if (size === 's') {
      return '<div class="inv-widget-viz" data-wdg-push>' + chartBars(hrs.map(function(k) { return { label: relayClockLabel(k * 60), value: share(k) }; }),
        wdgChartOpts(ctx, wdgChartRoom(ctx, 4, false), { axis: false, unit: 'pct', span: { i0: w.from - 6, i1: w.to - 7 }, ariaLabel: 'The share of cuts that began in each hour, 6 AM to 10 PM' })) + '</div>';
    }
    var h = d.spans.length ? '<div class="inv-widget-sub">' + escHtml('Thunder forecast ' + wcFlrSpans(d.spans)) + '</div>' : '';
    var series = [{ label: 'Cuts began', values: hrs.map(function(k) { return isT(k) ? 0 : share(k); }), slot: 1 }];
    if (d.thunder && d.thunder.length) series.push({ label: 'In a thunder hour', values: hrs.map(function(k) { return isT(k) ? share(k) : 0; }), tone: 'warning' });
    return h + '<div class="inv-widget-viz">' + chartStack(hrs.map(function(k) { return (k % 12 || 12) + (k < 12 ? 'a' : 'p'); }), series,
      wdgChartOpts(ctx, wdgChartRoom(ctx, d.spans.length ? 4.5 : 3.5, 'src'), { unit: 'pct', labelHead: 'Hour began', ariaLabel: 'The share of cuts that began in each hour, 6 AM to 10 PM',
        emptyText: 'No cut began between 6 AM and 10 PM' })) + '</div>';
  },
  source: function(d) {
    var w = feedWeather ? feedWeather() : null;
    return { facts: [d.win ? todoPlural(d.win.total, 'cut') + ' on record' : d.total ? todoPlural(d.total, 'cut') + ' on record' : '', w && w.state === 'ok' ? 'thunder from MET Norway, ' + w.ago : ''],
      refresh: 'weather', busy: !!(w && w.busy) };
  } });

/* The words for when to order a line: the pick's own (suppPickWhen), else why the app cannot say. */
function wcFlrOrderWhen(pk) {
  return suppPickWhen(pk) || (!pk || !pk.sp ? 'no supplier on record' : suppLeadText(pk.lead));
}
/* Stock days left (Plant): the line that runs out first and the day to order it by (stockStatus, suppReorderPick: the reorder list's
   own pick); Medium the soonest as bars, red at 3 days and amber at 7 (the mark the amber line); Large each with when to order, and the
   reorder's cash with GST. A line charged into a bath (zinc) or with no daily use has no days left and is not drawn. Ordering the first
   is its Act while it is amber or red: the reorder list at it, never an order from the app. */
wdgDefine({ id: 'stockdays', title: 'Stock days left', short: 'Stock days', q: 'What runs out first?', section: 'floor', type: 'plant', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageStock' }, go: { tab: 'pageStock', v: 'list' }, card: 'stock-low',
  data: function(ctx) {
    var items = stockData().items.filter(function(i) { return i.active !== false; });
    if (!items.length) return { state: 'empty', title: 'No stock recorded yet', body: 'The supervisor’s stock message starts it, pasted on Stock.', act: wcDoor('Open Stock', 'invWdgGo', ' data-wid="stockdays"') };
    var list = items.map(function(i) { var s = stockStatus(i); return { item: i, s: s, days: suppDaysLeft(i, s) }; })
      .filter(function(x) { return x.days != null; })
      .sort(function(a, b) { return a.days - b.days || (a.item.name < b.item.name ? -1 : a.item.name > b.item.name ? 1 : 0); });
    if (!list.length) return { state: 'early', title: 'No daily use on record yet', body: 'A line’s days left are its level over its daily use, read from the use on record.' };
    var shown = list.slice(0, ctx.size === 'l' ? (_isDesktop ? 6 : 4) : ctx.size === 'm' ? 5 : 1);
    shown.forEach(function(x) { x.pick = suppReorderPick(x.item, x.days); });
    var f = shown[0], daysOf = function(x) { return x.s.group === 'out' ? 'Out' : stockDaysText(x.days, x.s.rate && x.s.rate.tentative); };
    return { state: 'ok', tone: STOCK_TONE[list[0].s.tone] || 'neutral', list: list, shown: shown, daysOf: daysOf, L: ctx.size === 'l' ? stockReorderList() : null,
      fig: escHtml(daysOf(f)) + '<span class="inv-unit">' + escHtml(f.item.name) + '</span>', line: escHtml(wcCap(wcFlrOrderWhen(f.pick))) };
  },
  draw: function(d, size, ctx) {
    if (size === 's') return '';
    var cfg = stockCfg(), R = stockReorderCfg(), max = R.leadDays + R.coverDays;
    var bars = chartRankedBars(d.shown.map(function(x) {
      var t = STOCK_TONE[x.s.tone];
      return { label: x.item.name, value: x.days, display: d.daysOf(x) + (x.s.group === 'out' ? '' : ' left'), tone: t === 'danger' || t === 'warning' ? t : 'good',
        markPct: cfg.amberDays / max * 100, sub: size === 'l' ? wcFlrOrderWhen(x.pick) : '' };
    }), wdgChartOpts(ctx, 0, { unit: 'count', max: max, labelHead: 'Line', valueHead: 'Days left', emptyText: 'No line has a daily use yet' }));
    var h = '<div class="inv-widget-viz">' + bars + '</div><div class="inv-widget-sub" data-wdg-opt>' + escHtml('Red at ' + cfg.redDays + ' days or fewer, amber at ' + cfg.amberDays + ' (the mark)') + '</div>';
    if (size !== 'l' || !d.L) return h;
    var L = d.L;
    return h + '<div class="inv-widget-rows">' + uiFactRowHtml({ label: 'The reorder list, with GST', value: L.withGst > 0 ? inrTextHtml(L.withGst) : '', attrs: ' data-wc-reorder',
      sub: L.withGst > 0 ? (L.unpriced ? todoPlural(L.unpriced, 'line') + ' without a price' : 'at the last prices') : 'nothing to order now' }) + '</div>';
  },
  actRow: function(d) {
    var f = d.shown[0], t = STOCK_TONE[f.s.tone];
    return t === 'danger' || t === 'warning' ? { tint: { label: 'Order ' + f.item.name, action: 'invWdgJump', attrs: wdgJumpAttrs({ kind: 'reorder' }) } } : null;
  },
  source: function() {
    var last = '';
    (stockData().pastes || []).forEach(function(p) { var dd = p.to || (p.at ? isoOf(new Date(p.at)) : ''); if (dd > last) last = dd; });
    return { facts: [last ? 'Stock messages to ' + stockShortDate(last) : 'Stock by hand', 'use over 3 weeks, Sundays out'] };
  } });

/* A sum over or under the market, its sign said (Spend and prices' own way). */
function wcFlrZincOver(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + formatCurrency(Math.abs(v)); }
var WC_FLR_ZINC_RANGE = { '3M': 'Three months', '6M': 'Six months', FY: 'This financial year', ALL: 'Every bill' };
/* Zinc against the market (a Ledger; zincTrend, over the range Stock → Spend and prices shows): what the bills paid over the market,
   weighted by their kilos (dashZincPaidOver), the market now against the last bill and the market's line with the last bill dashed
   beside it; Large each supplier over the market as rows (dashZincSupStatus: Spend and prices' own words), their rates with paise. */
wdgDefine({ id: 'zincpaid', title: 'Zinc against the market', q: 'Did we buy well, and from whom?', section: 'floor', type: 'ledger', sizes: ['m', 'l'],
  needs: { page: 'pageStock', money: true }, card: 'zinc-paid',
  go: function() { dashZincShow(); },
  data: function() {
    var range = typeof _dashZincRange === 'string' ? _dashZincRange : '6M', T = zincTrend(_dashZincFrom(range));
    if (!T.item || !T.lastBill) return { state: 'empty', title: 'No zinc bill recorded yet', body: 'A zinc delivery recorded with its bill, on Stock, is set against the market on its day.',
      act: wcDoor('Open Stock', 'invWdgGo', ' data-wid="zincpaid"') };
    if (!T.now) return { state: 'notset', title: 'No market rate kept yet', body: 'Each refresh of the zinc rate is kept as the market for its day.',
      act: getMetalsKey() ? wcDoor('Refresh', 'invRefreshZinc') : wcDoor('Set the zinc rate', 'invOpenSettings', ' data-sec="zinc"') };
    var po = dashZincPaidOver(T), unit = (T.item && T.item.unit) || 'kg';
    return { state: 'ok', tone: po.over == null ? 'neutral' : po.over > 0 ? 'info' : 'ok', T: T, po: po, range: range,
      fig: po.over == null ? '' : escHtml(wcFlrZincOver(po.over)) + '<span class="inv-unit">a ' + escHtml(unit) + '</span>',
      line: escHtml(po.over == null ? 'No bill set against the market yet' : po.over > 0 ? 'Paid over the market' : po.over < 0 ? 'Paid under the market' : 'Paid the market rate'),
      sub: escHtml((WC_FLR_ZINC_RANGE[range] || 'Six months') + ' · ' + todoPlural(po.set.length, 'bill') + ' set against it') };
  },
  draw: function(d, size, ctx) {
    var T = d.T, last = T.lastBill, unit = (T.item && T.item.unit) || 'kg', mk = T.market.slice(-30);
    var spark = mk.length >= 2 ? '<div class="inv-widget-viz" data-wdg-opt>' + chartSpark(mk.map(function(m) { return m.landed; }), { ref: mk.map(function() { return last.e.price; }), unit: 'rate',
      title: 'The market, landed, at each refresh from ' + stockShortDate(mk[0].date) + '; dashed, the last bill at ' + formatCurrency(last.e.price) }) + '</div>' : '';
    var lines = wdgLedgerHtml([
      { label: 'Market now, landed', meta: escHtml('LME of ' + stockShortDate(T.now.date)), amount: T.now.landed, value: escHtml(formatCurrency(T.now.landed)), attrs: ' data-zinc-line="market"' },
      { label: 'Last bill', meta: escHtml(stockShortDate(last.date) + (last.e.supplier ? ' · ' + last.e.supplier : '')), amount: last.e.price, value: escHtml(formatCurrency(last.e.price)), attrs: ' data-zinc-line="bill"' }],
      null, { attrs: ' data-zinc-lines' });
    if (size !== 'l' || !T.suppliers.length) return spark + lines;
    var standing = dashZincSupStatus(T);
    var rows = T.suppliers.map(function(s) {
      var st = standing(s);
      return wdgRowHtml({ title: s.name, meta: escHtml(todoPlural(s.n, 'bill') + ' · ' + stockFmtQty(s.kg) + ' ' + unit), fig: s.over != null ? escHtml(wcFlrZincOver(s.over)) : '',
        tone: st ? st[0] : 'info', word: st ? st[1] : 'No market', attrs: ' data-wc-zinc-supplier' });
    });
    return wcPartsHtml([spark + lines, wdgListHtml('rows', rows)]);
  },
  source: function() { return { facts: ['Zinc bills', 'the market at today’s uplift and premium'] }; } });

/* ---------- People ---------- */
/* Attendance today (Crew): the floor's heads against the day's need as the figure (attDaySummary, the People card's own reading, judged
   by attOnSiteTone), the areas short as the verdict, a seat a hand the day needs. Medium: the areas as rows with their seats, and who is
   away by name. The panel's hooks are kept (#homeAtt, #homeAttOnSite). */
wdgDefine({ id: 'atttoday', title: 'Attendance today', short: 'Attendance', q: 'Is the crew in?', section: 'people', type: 'crew', sizes: ['s', 'm'],
  needs: { page: 'pageStaff' }, go: { tab: 'pageStaff', v: 'day' }, card: 'attendance',
  data: function() {
    if (!staffActive().length) return { state: 'empty', title: 'No roster yet', body: 'People → Roster holds the crew; a day is marked against it.',
      act: wcDoor('Open the roster', 'invWdgGo', ' data-wid="atttoday"'), attrs: ' data-card="attendance"' };
    var d = attDaySummary(), n = d.roster.length, on = d.p + d.half, tone = attOnSiteTone(d);
    if (!d.marked) return { state: 'ok', tone: 'neutral', fig: '&mdash;', line: 'Nothing recorded yet today', sub: escHtml('the in-time roll fills it · ' + n + ' on the roster'), d: d, attrs: ' id="homeAtt" data-card="attendance"' };
    // The floor's areas against their number for the day (areaNeedOn): a seat a hand each needs.
    var areas = STAFF_AREAS.filter(function(a) { return a.floor && a.id !== 'flex'; }).map(function(a) {
      var need = areaNeedOn(d.iso, a.id), heads = d.byArea[a.id] || 0;
      return need == null && !heads ? null : { id: a.id, name: a.label, need: need || 0, on: heads, tone: areaNeedTone(heads, need), word: areaNeedWord(heads, need) };
    }).filter(Boolean);
    var short = areas.filter(function(a) { return a.need && a.on < a.need; });
    var fig = d.complement ? '<span id="homeAttOnSite">' + figHtml(String(d.floorHeads), d.short ? 'warning' : null) + '</span><span class="inv-unit">of ' + d.complement + ' on the floor</span>'
      : '<span id="homeAttOnSite">' + figHtml(String(on), tone) + '</span><span class="inv-unit">of ' + n + ' on site</span>';
    var line = short.length ? short.map(function(a) { return a.name + ' short ' + (a.need - a.on); }).join(', ') : d.complement ? 'Every area at its number' : on + ' of ' + n + ' on site';
    return { state: 'ok', tone: tone || 'ok', fig: fig, line: escHtml(line), sub: escHtml(d.complement ? on + ' of ' + n + ' on site · ' + todoPlural(d.absent.length, 'absent', 'absent') : todoPlural(d.absent.length, 'absent', 'absent')),
      d: d, areas: areas, attrs: ' id="homeAtt" data-card="attendance"' };
  },
  draw: function(d, size) {
    var a = d.d;
    if (!a.marked) return '';
    if (size === 's') return d.areas && d.areas.length ? '<div data-wdg-push>' + wdgSeatsHtml({ need: a.complement || a.roster.length, on: a.complement ? a.floorHeads : a.p + a.half, what: 'on the floor' }) + '</div>' : '';
    var rows = (d.areas || []).map(function(x) { return wdgCrewRowHtml({ name: x.name, need: x.need, on: x.on, tone: x.tone, word: x.word, attrs: ' data-alloc="' + escHtml(x.id) + '"' }); });
    return wdgListHtml('crew', rows, ' data-att-alloc') + wdgAwayHtml(a.absent, ' data-att-away');
  },
  source: function(d) {
    // The rolls the day was read from (relayRollsFor), at the minute WhatsApp sent each (sentAt), else when it was pasted.
    var rolls = typeof relayRollsFor === 'function' ? relayRollsFor(d.d.iso) : [];
    var inRoll = rolls.filter(function(p) { return p.kind === 'in'; })[0], outRoll = rolls.filter(function(p) { return p.kind === 'out'; })[0];
    var t = function(p) { return p.sentAt != null ? relayClockLabel(p.sentAt) : wcAt(p.at); };
    return { facts: [inRoll ? 'In-time roll ' + t(inRoll) : d.d.marked ? 'Marked on People' : 'No in-time roll yet', outRoll ? 'the out-time roll ' + t(outRoll) : 'the out-time roll not in yet'] };
  } });

/* Attendance by pay week (Crew; dashAttendanceByWeek, Attendance → Week's own reading): the share present of the marks typed as bars
   against the rest-day gate's 90%, a week nobody typed a gap, the week running hatched as to date. The latest week with marks is the
   figure, judged at the gate's 90% and 80% (figTonePct). Medium eight weeks, Large twenty-six. */
wdgDefine({ id: 'attweek', title: 'Attendance by week', q: 'Is the crew turning up?', section: 'people', type: 'crew', sizes: ['m', 'l'],
  needs: { page: 'pageStaff' }, go: { tab: 'pageStaff', v: 'week' }, card: 'att-weeks',
  data: function(ctx) {
    var n = ctx.size === 'l' ? 26 : 8, weeks = dashAttendanceByWeek(n), known = weeks.filter(function(w) { return w.pct != null; });
    if (!known.length) return { state: 'empty', title: 'No attendance in ' + n + ' weeks', body: 'A day is marked on People → Attendance, or read from the supervisor’s rolls.',
      act: wcDoor('Open Attendance', 'invWdgGo', ' data-wid="attweek"') };
    if (known.length < 2) return { state: 'early', title: 'Not enough yet: one pay week recorded', body: 'A trend needs two pay weeks with attendance.' };
    var last = known[known.length - 1], prev = known[known.length - 2], pct = function(v) { return formatNum(v, 1) + '%'; };
    var running = last.sat >= localDateStr();
    return { state: 'ok', tone: figTonePct(last.pct, 90, 80) || 'neutral', weeks: weeks, n: n, fig: escHtml(pct(last.pct)),
      line: escHtml(running ? 'Present this week so far' : 'Present, the week to ' + stockShortDate(last.sat)), sub: escHtml(pct(prev.pct) + ' the week to ' + stockShortDate(prev.sat)) };
  },
  draw: function(d, size, ctx) {
    var weeks = d.weeks, td = weeks.length && weeks[weeks.length - 1].sat >= localDateStr() ? weeks.length - 1 : null;
    return '<div class="inv-widget-viz">' + chartBars(weeks.map(function(w) { return { label: stockShortDate(w.sat), value: w.pct == null ? null : Math.round(w.pct * 10) / 10 }; }),
      wdgChartOpts(ctx, wdgChartRoom(ctx, 3.5, 'src'), { unit: 'pct', labelHead: 'Week to', ariaLabel: 'Attendance by week, ' + d.n + ' weeks', maxLabels: d.n > 13 ? 5 : undefined, toDate: td,
        emptyText: 'Needs two pay weeks with attendance recorded' })) + '</div>';
  },
  source: function() {
    var last = '';
    Object.keys(S.attendance || {}).forEach(function(k) { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && k > last) last = k; });
    return { facts: [last ? 'Marks to ' + stockShortDate(last) : 'No marks yet', 'the week Sunday to Saturday', 'weekdays only, as the gate counts them'] };
  } });

/* Overtime by area over the four pay weeks to today (Crew; areaHoursForRange, Areas' own Hours by area: each mark's overtime where it
   was worked, by attHoursSplit, and the EXTRA booked to the area), the ranked bars bare; Large the EXTRA beside it, one scale for both.
   Hours for every role that opens People; the rupees (labourForRange) only for one that sees wages. */
function wcPplOtBars(rows, key, max, head, ctx) {
  return chartRankedBars(rows.map(function(r) { return { label: r.label, value: Math.round(r[key] * 10) / 10, display: wcFlrHours(r[key]) + ' h' }; }),
    wdgChartOpts(ctx, 0, { unit: 'h', max: max, labelHead: 'Area', valueHead: head, emptyText: 'None in four weeks' }));
}
wdgDefine({ id: 'ot', title: 'Overtime by area', q: 'Where are the extra hours going?', section: 'people', type: 'crew', sizes: ['m', 'l'],
  needs: { page: 'pageStaff' }, go: { tab: 'pageStaff', v: 'areas' }, card: 'ot-areas',
  data: function() {
    var today = localDateStr(), from = isoAddDays(attWeekStartOf(today), -21), ah = areaHoursForRange(from, today);
    if (!ah.rows.length) return { state: 'empty', title: 'No attendance in four weeks', body: 'A day is marked on People → Attendance, or read from the supervisor’s rolls.',
      act: wcDoor('Open Attendance', 'invSwitchTab', ' data-tab="pageStaff" data-v="day"') };
    var ot = ah.rows.reduce(function(s, r) { return s + r.ot; }, 0), extra = ah.rows.reduce(function(s, r) { return s + r.extra; }, 0);
    var byOt = ah.rows.filter(function(r) { return r.ot > 0.05; }).sort(function(a, b) { return b.ot - a.ot; });
    var lab = grdSeesWages() ? labourForRange(from, today) : null;
    return { state: 'ok', tone: 'neutral', rows: ah.rows, ot: ot, extra: extra, from: from, byOt: byOt,
      fig: escHtml(wcFlrHours(ot)) + '<span class="inv-unit">h overtime</span>', line: escHtml(byOt.length ? 'Most in ' + byOt[0].label : 'No overtime in four weeks'),
      sub: lab ? inrTextHtml(lab.ot) + ' overtime · ' + inrTextHtml(lab.extra) + ' EXTRA' : escHtml('EXTRA ' + wcFlrHours(extra) + ' h · from ' + stockShortDate(from)) };
  },
  draw: function(d, size, ctx) {
    var byOt = d.byOt, byEx = d.rows.filter(function(r) { return r.extra > 0.05; }).sort(function(a, b) { return b.extra - a.extra; });
    var n = size === 'l' ? 6 : 5, M = Math.max.apply(null, byOt.concat(byEx).map(function(r) { return Math.max(r.ot, r.extra); }).concat([0]));
    if (size !== 'l') return byOt.length ? '<div class="inv-widget-viz">' + wcPplOtBars(byOt.slice(0, n), 'ot', null, 'Overtime', ctx) + '</div>' : '';
    var P = wcParts(ctx), pc = { w: P.w };
    return wcPartsHtml(['<p class="inv-widget-cap">' + escHtml('Overtime · ' + wcFlrHours(d.ot) + ' h') + '</p>' + wcPplOtBars(byOt.slice(0, n), 'ot', M, 'Overtime', pc),
      '<p class="inv-widget-cap">' + escHtml('EXTRA booked · ' + wcFlrHours(d.extra) + ' h') + '</p>' + wcPplOtBars(byEx.slice(0, n), 'extra', M, 'EXTRA', pc)]);
  },
  source: function(d) { return { facts: ['Attendance, four weeks to ' + stockShortDate(localDateStr()), 'overtime where it was worked'] }; } });

/* ---------- Market and the world outside (§9) ---------- */
/* What a feed says when it has no copy to show (feeds.js: a state and its blank {kind, title, body, action}), as the widget's one
   blank state: its door (a Guide or Settings) the card's Act. */
function wcFeedBlank(r, attrs) {
  var b = (r && r.blank) || {};
  return { state: r && r.state && r.state !== 'ok' ? r.state : 'empty', title: b.title || '', body: b.body || '', action: b.action || '', attrs: attrs || '' };
}
/* A feed widget's Source (§24e): its credit linked as its licence asks, how old its copy is (the Worker's last copy, no signal), and
   Refresh, in any state (a feed's card says where its copy would come from). */
function wcFeedSource(kind, r, facts) {
  var cr = typeof FEED_CREDIT !== 'undefined' ? FEED_CREDIT[kind] : null;
  var age = r && r.ago ? r.ago + (r.stale ? ', the Worker’s last copy' : '') + (r.offline ? ', offline' : '') : '';
  return { credit: cr ? { label: cr.name, href: cr.url } : null, facts: [age].concat(facts || []), refresh: kind, busy: !!(r && r.busy), attrs: ' data-feed-age="' + kind + '"' };
}
/* The seam the risk widget reads (§7d `risk`): today's hours the forecast holds thunder in, 0 to 23, or null with no forecast to
   read (a feed not set up, offline, not fetched yet). */
function wcThunderHours() {
  if (typeof feedThunderToday !== 'function') return null;
  var t = feedThunderToday();
  return t && t.state === 'ok' && Array.isArray(t.hours) ? t.hours.slice() : null;
}
function wcCap(s) { s = String(s || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* The weather at the plant (Outside; MET Norway through the feeds Worker, §9): now and today's window of rain or thunder still to come;
   Medium the next 12 hours, and once 30 days are kept the cut days that had rain. Coded by what is coming today, never edged or tinted
   (the world outside is to know): thunder said in the warning's words (a storm brings cuts), rain info, a dry rest of the day ok. */
function wcWxHoursHtml(hours) {
  return '<div class="inv-wx-hours" role="list" aria-label="The next 12 hours">' + hours.map(function(h) {
    var tone = h.thunder ? 'warning' : h.wet ? 'info' : '';
    var said = h.time + ': ' + [h.word, h.tempText, h.rain > 0 ? formatNum(h.rain, 1) + ' mm' : ''].filter(Boolean).join(', ');
    return '<div class="inv-wx-hour" role="listitem"' + (tone ? ' data-tone="' + tone + '"' : '') + ' title="' + escHtml(said) + '" aria-label="' + escHtml(said) + '">' +
      '<span class="inv-wx-hour-t">' + escHtml(h.time) + '</span>' + iconSvg(h.icon, 'inv-wx-ico') + '<span class="inv-wx-hour-c">' + escHtml(h.tempText) + '</span></div>';
  }).join('') + '</div>';
}
wdgDefine({ id: 'weather', title: 'Weather at the plant', short: 'Weather', q: 'Will a storm bring a power cut?', section: 'market', type: 'outside', sizes: ['s', 'm'],
  go: { tab: 'pagePower', v: 'causes' }, card: 'weather', feed: true,
  data: function() {
    var w = feedWeather();
    if (w.state !== 'ok') return Object.assign(wcFeedBlank(w), { w: w });
    var t = w.today || {}, ahead = t.windows || [];
    var th = ahead.filter(function(x) { return x.kind === 'thunder'; })[0], rain = ahead.filter(function(x) { return x.kind === 'rain'; })[0];
    var range = t.tMax != null && t.tMin != null ? Math.round(t.tMin) + '°–' + Math.round(t.tMax) + '° today' : '';
    return { state: 'ok', tone: th ? 'warning' : rain ? 'info' : 'ok', w: w,
      fig: '<span class="inv-wx-fig" data-wx-now>' + iconSvg(w.now.icon, 'inv-wx-ico') + '<span>' + escHtml(w.now.tempText) + '</span></span>',
      line: '<span data-wx-line>' + escHtml(th ? wcCap(th.say) + ' today' : rain ? wcCap(rain.say) + ' today' : 'No rain forecast for the rest of today') + '</span>',
      sub: escHtml([w.now.word ? w.now.word + ' now' : '', range].filter(Boolean).join(' · ')), cut: feedWeatherCutDays() };
  },
  draw: function(d, size) {
    if (size === 's') return '';
    var h = d.w.hours.length ? '<div class="inv-widget-viz">' + wcWxHoursHtml(d.w.hours) + '</div>' : '';
    // Once 30 days are kept, the cut days beside the days rain was forecast: two counts side by side, never a cause (§9d).
    return h + (d.cut.state === 'ok' ? '<div class="inv-widget-rows">' + uiFactRowHtml({ label: 'Cut days and rain', sub: d.cut.say, value: d.cut.wetCutDays + ' of ' + d.cut.cutDays, attrs: ' data-wx-cutdays' }) + '</div>'
      : '<div class="inv-widget-sub" data-wx-cutdays data-wdg-opt>' + escHtml('The cut days against rain from ' + d.cut.need + ' days kept: ' + d.cut.kept + ' so far') + '</div>');
  },
  source: function(d) { return wcFeedSource('weather', d && d.w ? d.w : feedWeather(), ['at the plant’s place']); } });

/* Tata Motors, Jamshedpur (Outside, §9c): the latest month typed from its release, heavy trucks, exports and all CVs with their change
   on last year, and the plant's week; at Large the months this year against last, bare, and the headlines (GDELT), filtered by the
   model the Choose picks (the models followed, S.market.models). Its head opens the Tata dialog, where a month is typed (the settings
   permission's) and every headline read; More opens it on the model picked. Up is ok (more trucks built is more work for the clients
   who plate for them), down a warning, said in the figures' own tones (the card is never edged: the world outside is to know). */
var WC_TATA_FIGS = ['hcv', 'cvExport', 'cvTotal'];
function wcTataFigs(L) {
  var by = {};
  (L.figs || []).forEach(function(f) { by[f.key] = f; });
  return WC_TATA_FIGS.map(function(k) { return by[k]; }).filter(function(f) { return f && f.now != null; });
}
function wcTataChart(o) {
  var pick = ['hcv', 'cvTotal'].map(function(k) { var m = mktTataMonths(k, 13); return { k: k, m: m, n: m.rows.filter(function(r) { return r.now != null; }).length }; })
    .sort(function(a, b) { return b.n - a.n; })[0];
  if (!pick || pick.n < 2) return '';
  var m = pick.m;
  return '<p class="inv-widget-cap">' + escHtml(m.label + ', month by month') + '</p>' +
    chartLines(m.rows.map(function(r) { return r.label; }), [
      { label: 'This year', values: m.rows.map(function(r) { return r.now; }), slot: 1 },
      { label: 'A year before', values: m.rows.map(function(r) { return r.ly; }), slot: 'other', dashed: true }],
    Object.assign({ unit: 'count', fit: true, labelHead: 'Month', ariaLabel: m.label + ' each month, this year against the year before', keys: m.rows.map(function(r) { return r.month; }) }, o || {}));
}
wdgDefine({ id: 'tata', title: 'Tata Motors, Jamshedpur', q: 'How is the demand our clients build for?', section: 'market', type: 'outside', sizes: ['l', 'm'],
  go: function() { mktTataOpen(); }, card: 'tata', feed: true, more: 'headlines',
  choose: { def: 'all', opts: function() { return [{ v: 'all', label: 'All models' }].concat(mktModelsSent().map(function(w) { return { v: w, label: w }; })); } },
  moreGo: function(card) {
    var board = card && card.closest('.inv-wboard') ? card.closest('.inv-wboard').dataset.board : 'home', pick = wdgOpts(board, 'tata').choose;
    mktTataOpen();
    if (pick && pick !== 'all' && typeof _mktDlg === 'object' && _mktDlg) { _mktDlg.model = pick; mktPartRedraw('news'); }
  },
  data: function(ctx) {
    var L = mktTataLatest(), figs = L.state === 'ok' ? wcTataFigs(L) : [], large = ctx.size === 'l';
    var model = large && ctx.choose && ctx.choose !== 'all' ? ctx.choose : '';
    var news = large ? feedNews({ n: 8, model: model }) : null;
    if (!figs.length && !(news && news.state === 'ok')) {
      return { state: 'empty', title: L.due ? mktMonthName(L.due) + '’s figures are not typed yet' : 'No month of Tata’s figures yet',
        body: 'Each month Tata Motors’ release prints its CVs: all of them, those sold in India, exports and heavy trucks.',
        act: mktCanEdit() ? wcDoor('Type them', 'invWdgGo', ' data-wid="tata"') : null, action: mktCanEdit() ? '' : feedDoorHtml('guide') };
    }
    var rank = { warning: 2, ok: 1, neutral: 0 }, tone = figs.reduce(function(t, f) { return (rank[f.tone] || 0) > (rank[t] || 0) ? f.tone : t; }, 'neutral');
    var lead = figs[0];
    return { state: 'ok', tone: figs.length ? tone : 'neutral', L: L, figs: figs, news: news, week: mktPlantWeek(), model: model,
      fig: lead ? figHtml(escHtml(mktFmt(lead.now)), lead.tone === 'ok' || lead.tone === 'warning' ? lead.tone : null) : '',
      line: escHtml(lead ? lead.label + ' in ' + L.label : L.due ? mktMonthName(L.due) + '’s figures are not typed yet' : 'No month of Tata’s figures yet'),
      lamp: lead ? lead.tone : 'neutral',
      sub: lead ? escHtml([lead.say || 'no figure for the year before', L.due && L.due !== L.month ? mktMonthName(L.due) + '’s figures are due' : ''].filter(Boolean).join(' · ')) : '' };
  },
  draw: function(d, size, ctx) {
    var rest = d.figs.slice(1);
    var tiles = rest.length ? wdgTilesHtml(rest.map(function(f) {
      return { label: f.label, fig: escHtml(mktFmt(f.now)), sub: f.say || 'no year before', tone: f.tone === 'neutral' ? '' : f.tone };
    }), ' data-tata-figs') : '';
    var week = '<div class="inv-widget-viz"><p class="inv-widget-cap">The plant’s week</p>' + mktWeekHtml(d.week) + '</div>';
    if (size !== 'l') return tiles + week;
    var n = d.news;
    var heads = n && n.state === 'ok' ? wdgWireHtml(n.items) : uiBlankHtml(Object.assign({ small: true }, (n && n.blank) || { kind: 'empty', title: 'No headlines yet' }));
    var rem = wdgRemPx(), w = ctx.w || 0, cols = w + 2 * rem >= 60 * rem ? 3 : w + 2 * rem >= 36 * rem ? 2 : 1;
    var chart = wcTataChart(wdgChartOpts({ w: cols > 1 ? Math.floor((w - (cols - 1) * 0.75 * rem) / cols) : w }, cols === 3 ? wdgChartRoom(ctx, 2, 'src') : 0));
    return '<div class="inv-widget-parts">' + '<div class="inv-widget-part">' + tiles + week + '</div>' + (chart ? '<div class="inv-widget-part">' + chart + '</div>' : '') +
      '<div class="inv-widget-part"><p class="inv-widget-cap">' + escHtml(d.model ? 'The headlines naming ' + d.model : 'The headlines') + '</p>' + heads + '</div></div>';
  },
  source: function(d, size) {
    var L = d && d.L, typed = L && L.state === 'ok' ? 'figures typed from the ' + L.label + ' release' : '';
    return size === 'l' ? wcFeedSource('news', d && d.news ? d.news : feedNews({ n: 1 }), [typed]) : { facts: [typed || 'figures typed from Tata’s release'] };
  } });

/* ---------- Analysis ---------- */
/* Does one move the other (a Briefing, §7d `corr`): two figures of the daily view (§6, dataview.js), each day both are known over the
   last 26 weeks, at the coarser grain of the two (a week: minutes and hours summed, the rest averaged), their dots, the least-squares
   line and its words. Under 10 points it is early. The pair is its Choose, the person's, kept with the layout (wdgOpts): at Large the
   two pickers in its head, at Medium one button naming the pair. A pattern, not proof. */
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
/* The two pickers: in the card's head at Large (small, labelled by their aria), or in the pair's dialog with their labels. Each pick
   is kept as it is made: nothing typed waits to be saved (data-nodirty), in a dialog or on the page. */
function wcCorrPicksHtml(p, inHead) {
  var sel = function(k, list, on) {
    var opts = list.map(function(c) { return '<option value="' + escHtml(c.name) + '"' + (c.name === on.name ? ' selected' : '') + '>' + escHtml(c.label) + '</option>'; }).join('');
    var aria = k === 'x' ? 'The figure across' : 'The figure up';
    if (inHead) return '<select class="inv-select inv-select-sm" data-corr="' + k + '" aria-label="' + aria + '">' + opts + '</select>';
    return '<label class="inv-field inv-corr-pick"><span class="inv-field-label">' + (k === 'x' ? 'Across' : 'Up') + '</span><select class="inv-select" data-corr="' + k + '" aria-label="' + aria + '">' + opts + '</select></label>';
  };
  return '<' + (inHead ? 'span' : 'div') + ' class="inv-corr-picks" data-corr-picks data-nodirty>' + sel('x', p.across, p.x) + sel('y', p.up, p.y) + '</' + (inHead ? 'span' : 'div') + '>';
}
wdgDefine({ id: 'corr', title: 'Does one move the other?', q: 'Pick two figures; see if they travel together.', section: 'analysis', type: 'brief', sizes: ['l', 'm'],
  card: 'corr',
  // The pair is its Choose: two pickers in the head at Large, one button naming the pair at Medium, opening the pickers.
  choose: { at: ['l', 'm'], html: function(ctx) {
    var p = wcCorrPair(ctx.opts);
    if (!p.x || !p.y) return '';
    if (ctx.size === 'l') return wcCorrPicksHtml(p, true);
    return '<button type="button" class="inv-btn inv-btn-tint inv-btn-sm inv-seg-choose" data-action="invWdgCorrPair" data-wid="corr" data-corr-pair aria-label="' +
      escHtml('Change the pair: ' + p.x.label + ' across, ' + p.y.label + ' up') + '">' + escHtml(p.x.label + ' · ' + p.y.label) + '</button>';
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
    var rd = wcCorrRead(p.x, p.y), base = { p: p, rd: rd };
    if (rd.pts.length < WC_CORR_MIN) {
      // Early still draws the card with its Choose, so another pair can be tried.
      return Object.assign(base, { state: 'ok', tone: 'neutral', early: true, answer: escHtml('Not enough yet: ' + rd.pts.length + ' of ' + WC_CORR_MIN + ' ' + (rd.weekly ? 'weeks' : 'days') + ' with both'),
        facts: [escHtml(p.x.label + ' across, ' + p.y.label.toLowerCase() + ' up')] });
    }
    var w = wcCorrWords(p.x, p.y, rd);
    return Object.assign(base, { state: 'ok', tone: 'neutral', words: w, answer: '<span data-corr-line>' + escHtml(w.line) + '</span>',
      facts: [w.sub ? escHtml(w.sub) : '', 'a pattern, not proof it is the cause'] });
  },
  draw: function(d, size, ctx) {
    if (d.early) return '';
    var p = d.p, rd = d.rd, h = '<div class="inv-widget-viz">' + chartScatter([{ key: 'pair', label: p.x.label + ' and ' + p.y.label, points: rd.pts, slot: 1 }],
      wdgChartOpts(ctx, wdgChartRoom(ctx, size === 'l' ? 4.5 : 4, 'src'), { xUnit: WC_CORR_UNIT[p.x.unit] || 'count', yUnit: WC_CORR_UNIT[p.y.unit] || 'count', xLabel: p.x.label, yLabel: p.y.label, fit: true,
        pointHead: rd.weekly ? 'Week' : 'Day', ariaLabel: p.x.label + ' against ' + p.y.label })) + '</div>';
    if (size !== 'l') return h;
    var f = rd.fit;
    return h + uiWorkingHtml('corr-working', [
      { label: 'Read', sub: rd.weekly ? 'by pay week, one of the two is weekly' : 'by working day', value: rd.pts.length + (rd.weekly ? ' weeks' : ' days') },
      { label: 'From', sub: 'the last 26 weeks', value: stockShortDate(rd.from) },
      { label: 'r', sub: 'how close the dots are to a line, −1 to 1', value: f && f.r != null ? (f.r < 0 ? '−' : '') + formatNum(Math.abs(f.r), 2) : '—' },
      { label: 'Strong from 0.7', sub: 'moderate from 0.4, weak from 0.2', value: d.words.word }], '', ' data-wdg-opt');
  },
  source: function(d) {
    var rd = d.rd;
    return { facts: [rd.weekly ? 'Week by week' : 'Day by day, working days', rd.pts.length + ' points from ' + stockShortDate(rd.from)] };
  } });

/* What each client pays a kilo (a Ledger, §7d `clientprice`): the period's clients, worst first, each against the full cost (the mark)
   and the variable cost (labour is fixed: everything but labour, statsClientMargins), the ranked bars bare, each client's row opening
   its page. Coded by the large accounts (10% of the tonnes or more) under the cost, as Stats' By client is. */
wdgDefine({ id: 'clientprice', title: 'What each client pays a kilo', q: 'Who clears the cost, who does not?', section: 'analysis', type: 'ledger', sizes: ['l', 'm'],
  needs: { page: 'pageStats', money: true }, go: { tab: 'pageStats', v: 'clients' }, card: 'clientprice', more: 'clients',
  data: function(ctx) {
    var a = wcPulseArgs(ctx.period), m = wdgMemo('margins:' + ctx.period, function() { return statsClientMargins(ctx.period, a.filtered, a.tonnage); });
    if (!m || !m.ranked.length) return { state: 'empty', title: 'No weighed tonnage in this period', body: 'A client’s price a kilo needs its invoices weighed: Parts holds the weights.' };
    var large = function(x) { return x.kg >= m.kg * 0.1; }, rank = { danger: 3, warning: 2, ok: 1 };
    var tone = m.ranked.filter(large).reduce(function(t, x) { var k = figToneAgainst(x.net, m.fullKg, 5) || 'ok'; return (rank[k] || 0) > (rank[t] || 0) ? k : t; }, 'ok');
    var below = m.ranked.filter(function(x) { return x.net < m.fullKg - 0.005; }), w = m.ranked.filter(large)[0] || null;
    return { state: 'ok', tone: tone, m: m, fig: escHtml(String(below.length)) + '<span class="inv-unit">of ' + m.ranked.length + ' below</span>',
      line: escHtml((below.length ? 'Below' : 'None below') + ' the full cost of ' + formatCurrency(m.fullKg) + '/kg'),
      sub: escHtml('Variable ' + formatCurrency(m.varKg) + '/kg, labour fixed' + (w && w.net < m.fullKg ? ' · the worst large account ' + uiNameShort(w.name, 20) + ' at ' + formatCurrency(w.net) + '/kg' : '')) };
  },
  draw: function(d, size, ctx) {
    var m = d.m, list = m.ranked;
    var max = Math.max(m.fullKg * 1.2, Math.max.apply(null, list.map(function(x) { return x.net; })));
    var barTone = function(x) { var t = figToneAgainst(x.net, m.fullKg, 5); return t && t !== 'ok' ? t : 'good'; };
    return '<div class="inv-widget-viz">' + chartRankedBars(list.map(function(x) {
      return { label: x.name, value: x.net, display: formatCurrency(x.net) + '/kg', tone: barTone(x), markPct: m.fullKg / max * 100,
        sub: Math.round(x.kg / m.kg * 100) + '% of the tonnes · ' + (x.vsVar >= 0 ? '+' : '−') + formatCurrency(Math.abs(x.vsVar)) + ' on the variable cost',
        action: 'invStatsClientDrill', clientId: x.id };
    }), wdgChartOpts(ctx, 0, { unit: 'rate', max: max, labelHead: 'Client', valueHead: '₹ a kilo', ariaLabel: 'What each client pays a kilo against the full cost' })) + '</div>' +
      (m.apart.length ? '<div class="inv-widget-sub" data-wdg-opt>' + escHtml(m.apart.length + ' not ranked: under 90% of revenue weighed') + '</div>' : '');
  },
  source: function(d, size, ctx) {
    var c = d.m.c;
    return { facts: ['Invoices, ' + (PERIOD_LABELS[ctx.period] || 'the period').toLowerCase(), c && c.measuredShare != null ? 'the live cost ' + Math.round(c.measuredShare * 100) + '% measured' : 'the live cost', 'labour fixed'] };
  } });

/* Where a kilo's cost goes (a Ledger, §7d `kilo`): the period's live cost a kilo, which keeps its paise (a rate), and how much of it is
   measured; its parts as one bar of 100% (chartShareBar; a part's colour its own on every cost chart, seriesSlot 'cost'); at Large each
   part's ₹ a kilo, its share and its source. Coded by the share measured, as Stats' Cost is. */
var WC_KILO_TONE = function(share) { return share >= 0.9 ? 'ok' : share >= 0.5 ? 'warning' : 'danger'; };
wdgDefine({ id: 'kilo', title: 'Where a kilo’s cost goes', short: 'A kilo’s cost', q: 'Which part of the cost is moving?', section: 'analysis', type: 'ledger', sizes: ['m', 's', 'l'],
  needs: { page: 'pageStats', money: true }, go: { tab: 'pageStats', v: 'cost' }, card: 'kilo',
  data: function(ctx) {
    var a = wcPulseArgs(ctx.period), kg = a.tonnage ? a.tonnage.kg : 0;
    if (!(kg > 0)) return { state: 'empty', title: 'No weighed tonnage in this period', body: 'A kilo’s cost is the period’s cost over the kilos plated and billed.' };
    var c = wdgMemo('livecost:' + ctx.period, function() { var r = statsRangeIso(ctx.period); return liveCost(r.from, r.to, kg); });
    if (c.perKg == null) return { state: 'empty', title: 'No cost recorded for this period' };
    var pct = Math.round(c.measuredShare * 100);
    return { state: 'ok', tone: WC_KILO_TONE(c.measuredShare), c: c, fig: escHtml(formatCurrency(c.perKg)) + '<span class="inv-unit">a kg</span>', line: escHtml(pct + '% of it measured'),
      sub: ctx.size === 's' ? '' : escHtml('Over ' + formatNum(c.kg / 1000, 1) + ' t plated and billed') };
  },
  draw: function(d, size) {
    var c = d.c, rows = c.rows.filter(function(r) { return r.amount > 0; });
    var bar = '<div class="inv-widget-viz"' + (size === 's' ? ' data-wdg-push' : '') + '>' + chartShareBar(rows.map(function(r) { return { label: r.label, v: r.amount, slot: seriesSlot('cost', r.key) }; }), 'Where a kilo’s cost goes') + '</div>';
    if (size !== 'l') return bar;
    return bar + '<div class="inv-widget-rows" data-kilo-parts>' + rows.map(function(r) {
      return uiFactRowHtml({ label: r.label, sub: Math.round(r.amount / c.total * 100) + '% of the cost · ' + (COST_SRC_LABEL[r.source] || r.source || ''),
        value: formatCurrency(r.perKg) + '/kg', attrs: ' data-kilo-part="' + escHtml(r.key) + '"' });
    }).join('') + '</div>';
  },
  source: function(d, size, ctx) { return { facts: ['Live cost, ' + (PERIOD_LABELS[ctx.period] || 'the period').toLowerCase(), Math.round(d.c.measuredShare * 100) + '% measured'] }; } });

/* ---------- The questions (Pulse's, folded into Home: §8c) ----------
   Each question a Briefing: its answer as a sentence, its key figure in its tone (statsStoryCards' and advQSmooth's `brief`), the
   vital's picture under it at a Small; from Medium its story's sentence and rows (wcStoryBrief) and the first move as its Act, with
   Add to my list beside it; at Large what can be done, every move a card, the fit letting go of the last and saying how many. Its
   head opens the whole of it, every move, in a dialog. The questions read money in every figure, so each is money's. */
var WC_QUESTIONS = [
  { k: 'smooth', title: 'Is the plant running smoothly?', short: 'Running well?', q: 'Stock, power, staffing, records, the payout and the backup, in one answer', sizes: ['m', 's', 'l'],
    src: function() { return ['Stock, power, attendance, production, the payout and the backup', 'this week']; } },
  { k: 'money', title: 'Are we making money?', short: 'Making money?', q: 'Realisation and what a kilo leaves, against the cost', sizes: ['s', 'm', 'l'],
    src: function(per) { return ['Invoices net of credit notes, ' + wcPerWord(per), wcCostWord(per), 'labour counted as fixed']; } },
  { k: 'clients', title: 'Who is driving it?', short: 'Who drives it?', q: 'The accounts that fill the plant, and the one priced worst', sizes: ['m', 's', 'l'],
    src: function(per) { return ['Invoices net of credit notes, ' + wcPerWord(per), wcCostWord(per), 'labour counted as fixed']; } },
  { k: 'plant', title: 'Is the plant full?', short: 'Plant full?', q: 'Capacity used, and the tonnes spare', sizes: ['m', 's', 'l'],
    src: function(per) { return ['Invoices, ' + wcPerWord(per), '~2 t a shift, two shifts']; } },
  { k: 'cash', title: 'Is cash coming in?', short: 'Cash coming in?', q: 'What is owed, how fast it comes and the account’s low point', sizes: ['m', 's', 'l'], bank: true,
    src: function() { return [wcStmtTo()]; } },
  { k: 'changed', title: 'What changed?', short: 'What changed?', q: 'The month’s pace and what has moved most', sizes: ['m', 's', 'l'],
    src: function() { return ['The month to ' + stockShortDate(localDateStr()) + ' against its pace']; } }
];
function wcPerWord(per) { return String(PERIOD_LABELS[per] || 'the period').toLowerCase(); }
/* The live cost a question is judged at, and how much of it is measured (the period's, read once). */
function wcCostWord(per) {
  var a = wcPulseArgs(per), c = a && a.periodCost;
  return c && c.measuredShare != null ? 'the live cost ' + Math.round(c.measuredShare * 100) + '% measured' : 'the live cost';
}
function wcQuestion(k) { return tdyQuestions().filter(function(x) { return x.key === k; })[0] || null; }
/* The story as a card on the board tells it (Medium, Large): its sentences and rows, without the tiles and charts that restate the
   answer's figure and its picture. The whole story is the dialog's, which the head opens. */
function wcStoryBrief(html) {
  var t = document.createElement('template');
  t.innerHTML = html || '';
  Array.prototype.forEach.call(t.content.querySelectorAll('.inv-tiles, .inv-chart-box, [data-story-more]'), function(el) {
    var box = el.parentElement;
    el.remove();
    if (box && box.classList.contains('inv-panel-body') && !box.textContent.trim() && !box.children.length) box.remove();
  });
  return t.innerHTML;
}
/* What would make a better move (a weight per piece, a rate): under the moves in the dialog. */
function wcQuestionHintsHtml(x) {
  return (x.hints || []).map(function(t) { return '<div class="inv-note inv-mt-8" data-adv-hint>' + escHtml(t) + '</div>'; }).join('');
}
/* A move's button as an Act's: its call a link, else its jump (invAdvGo), tinted; Add to my list its text button, On your list once it is. */
function wcMoveAct(mv) {
  var ref = advRowRef(mv), k = ' data-key="' + escHtml(mv.key) + '" data-adv-row="' + escHtml(ref) + '"';
  var tint = mv.href ? { href: mv.href, label: mv.hrefLabel || 'Call', attrs: ' data-adv-call' } : mv.go ? { label: mv.goLabel || 'Open', action: 'invAdvGo', attrs: k } : null;
  var listed = typeof advListedKeys === 'function' && advListedKeys()[mv.key];
  return { tint: tint, text: listed ? { html: ADV_LISTED_HTML } : { label: 'Add to my list', action: 'invAdvTask', attrs: k } };
}
WC_QUESTIONS.forEach(function(qd) {
  wdgDefine({ id: 'q-' + qd.k, title: qd.title, short: qd.short, q: qd.q, section: 'questions', type: 'brief', sizes: qd.sizes, more: 'moves',
    needs: { money: true, when: qd.bank ? function() { return finHasBank(); } : null },
    go: function() {
      var x = wcQuestion(qd.k);
      if (!x) return;
      var listed = typeof advListedKeys === 'function' ? advListedKeys() : {};
      dialogOpen('<div class="inv-dialog" role="dialog" aria-modal="true" aria-label="' + escHtml(qd.title) + '" data-tdy-q-open="' + qd.k + '">' +
        dialogHeadHtml(qd.title, 'invCloseOverlay', 'Close') + '<div class="inv-dialog-body"><div class="inv-hero-sheet">' + x.html + '</div>' +
        (x.inline && x.moves.length ? '' : '<div class="inv-hero-eyebrow inv-mt-8 inv-mb-8">What you can do</div>' + (x.moves.length
          ? '<div class="inv-deck" data-adv-deck="q-' + qd.k + '-all">' + x.moves.map(function(mv) { return advMoveCardHtml(mv, listed); }).join('') + '</div>'
          : '<div class="inv-note">' + escHtml(x.none || 'Nothing to do here yet.') + '</div>') + wcQuestionHintsHtml(x)) + '</div></div>', { dismiss: true });
    },
    moreGo: function() { var dd = wdgDef('q-' + qd.k); if (dd) dd.go(); },
    data: function(ctx) {
      var x = wcQuestion(qd.k);
      if (!x) return { state: 'empty', title: 'Not worked out yet', body: 'The question reads the period’s invoices; Stats has the figures.' };
      var v = x.vital || { fig: '', title: x.answer ? escHtml(x.answer.say) : '', sub: '', viz: '', tone: x.answer ? x.answer.tone : 'neutral' };
      var b = x.brief || { tone: v.tone, html: [v.fig, v.title].filter(Boolean).join(' ') };
      // A Small is its answer and its picture; from Medium the vital's own words are its facts.
      return { state: 'ok', tone: WDG_TONES[b.tone] ? b.tone : WDG_TONES[v.tone] ? v.tone : 'neutral', x: x, v: v, answer: b.html,
        facts: ctx.size === 's' ? [] : [v.sub], attrs: ' data-tdy-questions data-tdy-q="' + escHtml(qd.k) + '"' };
    },
    draw: function(d, size) {
      var v = d.v, x = d.x;
      if (size === 's') return v.viz ? '<div class="inv-widget-viz" data-wdg-push>' + v.viz + '</div>' : '';
      // At Large the moves are what the size is for: where the card has no room for both, the story gives way (it is the question's
      // own, a tap away on its head). Moves drawn in the story itself (What changed?'s insights) keep it.
      var story = '<div class="inv-widget-rows" data-tdy-story' + (size === 'l' && x.moves.length && !x.inline ? ' data-wdg-opt' : '') + '>' + wcStoryBrief(x.html) + '</div>';
      if (size === 'm') return story;
      var moves = x.inline ? '' : x.moves.length ? wdgListHtml('movecards', x.moves.map(wdgMoveCardHtml), ' data-tdy-moves data-adv-moves="q-' + escHtml(x.key) + '"')
        : '<div class="inv-widget-sub" data-adv-none>' + escHtml(x.none || 'Nothing to do here yet.') + '</div>';
      return moves + story;
    },
    actRow: function(d, size) {
      var mv = size === 'm' && !d.x.inline ? d.x.moves[0] : null;
      return mv ? wcMoveAct(mv) : null;
    },
    source: function(d, size, ctx) { return { facts: qd.src(ctx.period) }; } });
});
/* Do first (a Briefing): the moves worth most across every question (tdyFirstMoves, advRank), as rows ending in their one action (Large:
   cards); a move opens its dialog (§24e), and More opens Do first's own dialog of the first ten. */
wdgDefine({ id: 'dofirst', title: 'Do first', q: 'The three moves worth most, across every question', section: 'questions', type: 'brief', sizes: ['m', 'l'],
  needs: { money: true }, card: 'first', more: 'moves',
  go: function() {
    var top = tdyFirstMoves(tdyQuestions(), 10);
    wcMovesOpen('Do first: the moves worth most', top.map(function(t) { return t.mv; }), 'first-all', top.map(function(t) { return t.word; }));
  },
  moreGo: function() { var dd = wdgDef('dofirst'); if (dd) dd.go(); },
  data: function() {
    var top = tdyFirstMoves(tdyQuestions(), 10);
    if (!top.length) return { state: 'empty', title: 'No move worth making yet', body: 'A move appears once a question finds one: a price under the cost, a debt past its terms, a line idle.' };
    return { state: 'ok', tone: 'neutral', top: top, line: escHtml(todoPlural(top.length, 'move') + ' worth making, the most first') };
  },
  draw: function(d, size) {
    return size === 'l' ? wdgListHtml('movecards', d.top.map(function(t) { return wdgMoveCardHtml(t.mv); }), ' data-adv-deck="first"')
      : wdgListHtml('moves', d.top.map(function(t) { return wdgMoveRowHtml(t.mv); }), ' data-adv-deck="first"');
  },
  source: function() { return { facts: ['Every question’s moves, by what each is worth a month'] }; } });

/* Why it moved (a Briefing; why.js, I4): the period shown against the one before. Realisation's causes as lines, its change ruled under
   them (they add up to it exactly); Large: contribution's and cash's beside it, each the same way (#statsWhy). */
function wcWhyLedger(title, from, to, total, causes, unit, attrs) {
  var sig = function(v) { return unit === 'kg' ? (v >= 0 ? '+' : '−') + '₹' + formatNum(Math.abs(v), 2) + '/kg' : (v >= 0 ? '+' : '−') + inrCard(Math.abs(v)).text; };
  var tone = function(v) { return v > 0.005 ? 'ok' : v < -0.005 ? 'danger' : null; };
  return '<p class="inv-widget-cap">' + escHtml(title + ' · ' + from + ' → ' + to) + '</p>' + wdgLedgerHtml(causes.map(function(c) {
    return { label: c.short || c.label, meta: c.sub ? escHtml(c.sub) : '', amount: c.v, value: figHtml(escHtml(sig(c.v)), tone(c.v)), attrs: ' data-why-cause="' + escHtml(c.kind) + '"' };
  }), { label: 'The change', amount: total, value: figHtml(escHtml(sig(total)), tone(total)) }, { attrs: attrs || '' });
}
wdgDefine({ id: 'why', title: 'Why it moved', q: 'What moved the figures against the period before?', section: 'questions', type: 'brief', sizes: ['m', 'l'],
  needs: { money: true }, go: { tab: 'pageStats', v: 'trends' },
  data: function(ctx) {
    var a = wcPulseArgs(ctx.period), o = whyHeroOpts(ctx.period, a.filtered, a.prior, '');
    if (!o) return { state: 'early', title: ctx.period === 'all' ? 'All has no period before it' : 'Nothing to compare yet',
      body: ctx.period === 'all' ? 'Pick MTD, QTD or YTD to see what moved against the period before.' : 'The period before has no invoices.', attrs: ' id="statsWhy" data-card="why"' };
    var r = o.parts;
    return { state: 'ok', tone: WDG_TONES[o.tone] ? o.tone : 'neutral', p: r, answer: o.title, facts: [o.sub], attrs: ' id="statsWhy" data-card="why"' };
  },
  draw: function(d, size, ctx) {
    var r = d.p, real = r.real, mg = r.mg, cash = r.cash;
    if (real.none) return '';
    var rk = function(v) { return '₹' + formatNum(v, 2); };
    var a = wcWhyLedger('Realisation', rk(real.R0), rk(real.R1) + '/kg', real.d, real.causes, 'kg', ' data-why="real"');
    if (size !== 'l') return a;
    var b = mg.none ? '' : wcWhyLedger('Contribution at the live cost', inrCard(mg.C0).text, inrCard(mg.C1).text, mg.d, mg.causes, '', ' data-why="margin"');
    var c = cash.none ? '' : wcWhyLedger('Cash, net in the month', billsMonthLabel(cash.m0), billsMonthLabel(cash.m1), cash.d, cash.causes, '', ' data-why="cash"');
    return wcPartsHtml([a, b + c]);
  },
  source: function(d, size, ctx) { return { facts: ['Against ' + (PERIOD_PRIOR_LABELS[ctx.period] || 'the period before'), 'weighed lines only'] }; } });

/* The period in figures (a Ledger; statsOverviewOpts, Pulse's In one line until UI pass 3): what a kilo left after the live cost as the
   figure, its factors as tiles (realisation, live cost, capacity and, with a statement, cash), and the floor's plated row, which opens
   Production (#statsOverview). */
wdgDefine({ id: 'figures', title: 'The period in figures', q: 'Price, cost, contribution, capacity', section: 'questions', type: 'ledger', sizes: ['m', 'l'],
  needs: { money: true }, go: { tab: 'pageStats', v: 'cost' },
  data: function(ctx) {
    var a = wcPulseArgs(ctx.period), o = statsOverviewOpts(ctx.period, a.filtered, a.tonnage);
    return { state: 'ok', tone: WDG_TONES[o.tone] ? o.tone : 'neutral', fig: o.fig, line: o.title, sub: o.sub, o: o, attrs: o.attrs };
  },
  draw: function(d) { return wdgTilesHtml(d.o.factors) + (d.o.plated ? '<div class="inv-widget-rows">' + d.o.plated + '</div>' : ''); },
  source: function(d, size, ctx) { return { facts: ['Invoices of ' + wcPerWord(ctx.period) + ', net of notes', d.o.measured != null ? 'the live cost ' + Math.round(d.o.measured * 100) + '% measured' : 'the live cost'] }; } });

/* This month at its pace (a Ledger; predMonthPace through paceCardOpts, #statsPace): where the month lands as the figure, against last
   month; what is billed so far, the unbilled challans in hand and the likely range as statement lines, with no total ruled: the landing
   is a pace, not their sum. */
wdgDefine({ id: 'pace', title: 'This month at its pace', q: 'Where does the month land?', section: 'office', type: 'ledger', sizes: ['m', 'l'],
  needs: { page: 'pageRegister', money: true }, go: { tab: 'pageRegister' },
  data: function() {
    var o = paceCardOpts();
    if (!o) return { state: 'early', title: 'The month has no pace yet', body: 'A pace needs a working day billed this month.', attrs: ' id="statsPace" data-card="pace"' };
    var p = o.pace;
    return { state: 'ok', tone: WDG_TONES[o.tone] ? o.tone : 'neutral', fig: inrFigHtml(p.projRev), p: p, attrs: o.attrs,
      line: p.prevRev > 0 ? figDeltaHtml(p.projRev, p.prevRev, p.prevLabel, 'up') : 'On pace', sub: escHtml(p.done + ' of ' + p.total + ' working days in · ' + formatNum(p.projKg / 1000, 1) + ' t at its pace') };
  },
  draw: function(d, size) {
    var p = d.p;
    return wdgLedgerHtml([
      { label: 'So far', meta: escHtml(formatNum(p.kg / 1000, 1) + ' t billed'), amount: p.rev, attrs: ' data-pace="sofar"' },
      { label: 'Unbilled in hand', meta: 'would lift the month', amount: p.unbilled, attrs: ' data-pace="unbilled"' },
      { label: 'Likely range', meta: 'as the days so far varied', amount: 0, value: escHtml(inrCard(p.low).text + ' – ' + inrCard(p.high).text),
        attrs: ' data-pace="range" title="' + escHtml(formatCurrency(p.low) + ' – ' + formatCurrency(p.high)) + '"' },
      size === 'l' ? { label: 'Tonnage at its pace', meta: escHtml(p.prevLabel + ' ' + formatNum(p.prevKg / 1000, 1) + ' t'), amount: 0, value: escHtml(formatNum(p.projKg / 1000, 1) + ' t'), attrs: ' data-pace="kg"' } : null],
      null, { attrs: ' data-pace-lines' });
  },
  source: function() { return { facts: ['Invoices to ' + stockShortDate(localDateStr()), 'net of credit notes'] }; } });

/* Needs you (a Briefing; todoHomeOpts, grouped as Needs you groups it): how many things need the owner now, the worth they name, the
   Now group's first tasks as Needs you's own rows, a task of your own with its tick box. Its head opens Needs you; Add a task its Act. */
wdgDefine({ id: 'needs', title: 'Needs you', q: 'What needs me now?', section: 'questions', type: 'brief', sizes: ['m', 'l'], card: 'todo', more: 'tasks',
  go: { tab: 'pageHome', v: 'needs' },
  data: function(ctx) {
    var o = todoHomeOpts(ctx.size === 'l' ? 8 : 5);
    return { state: 'ok', tone: WDG_TONES[o.tone] ? o.tone : 'neutral', o: o, answer: o.title,
      facts: [o.worth > 0.005 ? inrTextHtml(o.worth) + ' at stake' : '', o.sub], attrs: ' data-card="todo"' };
  },
  draw: function(d) { return '<div class="inv-widget-rows" data-todo-rows>' + d.o.rows + '</div>'; },
  actRow: function() { return { text: { label: 'Add a task', action: 'invHomeQuick', attrs: ' data-go="task"' } }; } });

/* What's coming (a Briefing, §7d `coming`): dated predictions, soonest first, each with its reason, read off what already predicts it,
   each shown only to a role that may see it: the cash forecast's low under zero (finForecast), a stock line out before its supplier can
   deliver (stockStatus, suppReorderPick), a client's next challan by its rhythm (predCadence), where the month lands (predMonthPace), a
   challan's turnaround target passing (flowLines), and a cut likely today where the forecast has thunder in the hours the plant's own
   cuts most often start (said as the two facts side by side, never a probability the book has not measured). Rows led by their day;
   the fit lets go of the last, and More lists every one in a dialog. */
var WC_COMING_RANK = { danger: 3, warning: 2, info: 1, ok: 1, neutral: 0 };
function wcComingDay(iso) {
  var today = localDateStr(), n = isoDaysBetween(today, iso);
  if (n <= 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return _chartDay(iso, n <= 6);
}
function wcComingBook() {
  return wdgMemo('coming-book', function() {
    var today = localDateStr(), out = [], money = wdgSeesMoney();
    var sees = function(p) { return typeof grdSees !== 'function' || grdSees(p); };
    var guard = function(fn) { try { fn(); } catch (e) { if (typeof errReport === 'function') errReport(e, 'widget: coming'); } };
    if (money && sees('pageFinance') && typeof finHasBank === 'function' && finHasBank()) guard(function() {
      var f = finForecast(60);
      if (f && f.overdrawn) out.push({ key: 'cash', date: today, tone: 'danger', title: 'The bank account is overdrawn', why: 'The statement’s last balance: ' + inrCard(f.start).text, go: { kind: 'finance', tab: 'overview' } });
      else if (f && f.cross) out.push({ key: 'cash', date: f.cross, tone: 'danger', title: 'Cash dips below zero', why: 'The forecast’s low: ' + inrCard(f.min.bal).text + ' on ' + stockShortDate(f.min.date), go: { kind: 'finance', tab: 'overview' } });
    });
    if (sees('pageStock')) guard(function() {
      stockData().items.forEach(function(it) {
        if (it.active === false) return;
        var st = stockStatus(it);
        if (st.daysLeft == null || st.daysLeft > 21) return;
        var pk = typeof suppReorderPick === 'function' ? suppReorderPick(it, st.daysLeft) : null, out1 = isoAddDays(today, Math.max(0, Math.floor(st.daysLeft)));
        if (pk && pk.late) out.push({ key: 'stock:' + it.id, date: out1, tone: 'danger', title: it.name + ' runs out', why: 'Before ' + (pk.name || 'its supplier') + ' can deliver: order now', go: { kind: 'stock', id: it.id } });
        else if (pk && pk.orderBy && isoDaysBetween(today, pk.orderBy) <= 3) out.push({ key: 'stock:' + it.id, date: pk.orderBy, tone: 'warning', title: 'Order ' + it.name,
          why: 'It runs out about ' + stockShortDate(out1) + '; ' + (pk.name || 'the supplier') + ' takes ' + suppLeadText(pk.lead), go: { kind: 'stock', id: it.id } });
      });
    });
    if (sees('pageIM')) guard(function() {
      predCadence().filter(function(c) { return c.count >= 5 && !c.quiet && c.next && c.next >= today && isoDaysBetween(today, c.next) <= 7; }).slice(0, 4).forEach(function(c) {
        out.push({ key: 'cad:' + c.id, date: c.next, tone: 'neutral', title: c.name + '’s next challan', why: 'By its rhythm: every ' + Math.round(c.median) + ' days, the last on ' + stockShortDate(c.last),
          go: { kind: 'im', clientId: c.id } });
      });
    });
    if (money && sees('pageRegister')) guard(function() {
      var p = predMonthPace();
      if (!p || !(p.left > 0)) return;
      var end = payMonthEnd(today.slice(0, 7) + '-01'), ahead = p.prevRev > 0 ? p.projRev >= p.prevRev : null;
      out.push({ key: 'pace', date: end, tone: ahead === false ? 'warning' : ahead ? 'ok' : 'neutral', title: 'The month lands about ' + inrCard(p.projRev).text,
        why: inrCard(p.low).text + ' – ' + inrCard(p.high).text + ' at the pace of ' + todoPlural(p.done, 'working day') + (p.prevRev > 0 ? '; ' + p.prevLabel + ' billed ' + inrCard(p.prevRev).text : ''),
        go: function() { switchTab('pageRegister'); } });
    });
    if (sees('pageProduction') && typeof flowLines === 'function') guard(function() {
      var seen = {}, soon = flowAddWd(today, 1);
      flowLines().forEach(function(x) {
        if (!x.row || x.despatched || !x.date || !x.target || seen[x.m.id]) return;
        var due = flowAddWd(x.date, x.target.days);
        if (due < today || due > soon) return;
        seen[x.m.id] = true;
        out.push({ key: 'turn:' + x.m.id, date: due, tone: due === today ? 'warning' : 'info', title: 'Challan ' + (x.m.challanNo || '') + ' due back',
          why: (x.m.clientName || insClientName(x.m.clientId)) + ' · its ' + flowTargetWord(x.target.days), go: { kind: 'challan', id: x.m.id } });
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
  var inWin = th.some(function(h) { return h >= win.from && h < win.to; });
  return { key: 'cut', date: localDateStr(), tone: 'warning', title: wcCap(t.say || 'thunder') + ' today',
    why: 'The plant’s cuts most often start ' + clock(win.from) + ' – ' + clock(win.to) + (inWin ? ', the same hours' : ''), go: { kind: 'power', tab: 'cuts' } };
}
function wcComingItems() {
  var list = wcComingBook().slice(), cut = wcComingCut();
  if (cut) list.push(cut);
  return list.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (WC_COMING_RANK[b.tone] || 0) - (WC_COMING_RANK[a.tone] || 0); });
}
function wcComingRowHtml(x) {
  return wdgWhenRowHtml({ day: wcComingDay(x.date), today: x.date <= localDateStr(), tone: x.tone, title: x.title, why: x.why,
    go: { action: 'invWdgComing', attrs: ' data-wid="coming" data-k="' + escHtml(x.key) + '"' }, attrs: ' data-coming-k="' + escHtml(x.key) + '"' });
}
wdgDefine({ id: 'coming', title: 'What’s coming', q: 'What happens next, and when?', section: 'questions', type: 'brief', sizes: ['m', 'l'], card: 'coming', feed: true,
  act: function(action, btn) {
    if (action !== 'invWdgComing') return false;
    var it = wcComingItems().filter(function(x) { return x.key === btn.dataset.k; })[0];
    if (!it) { showToast('That has changed since it was drawn', 'info'); wdgRefresh('coming'); return true; }
    if (btn.closest('[data-coming-all]')) closeTopOverlay();
    if (typeof it.go === 'function') it.go(); else todoGo(it.go);
    return true;
  },
  // More: every prediction, soonest first, in a dialog over the board.
  moreGo: function() {
    var list = wcComingItems();
    dialogOpen('<div class="inv-dialog" role="dialog" aria-modal="true" aria-label="What’s coming" data-coming-all>' + dialogHeadHtml('What’s coming', 'invCloseOverlay', 'Close') +
      '<div class="inv-dialog-body">' + wdgListHtml('when', list.map(wcComingRowHtml)) + '</div></div>', { dismiss: true });
  },
  data: function() {
    var list = wcComingItems();
    if (!list.length) return { state: 'empty', title: 'Nothing dated ahead yet', body: 'A prediction appears here once the book can make one: a stock line running out, a client’s next challan, where the month lands.' };
    var tone = list.slice(0, 4).reduce(function(t, x) { return (WC_COMING_RANK[x.tone] || 0) > (WC_COMING_RANK[t] || 0) ? x.tone : t; }, 'neutral');
    var first = list[0];
    return { state: 'ok', tone: tone === 'info' ? 'neutral' : tone, list: list, answer: escHtml(wcComingDay(first.date) + ': ' + first.title),
      facts: [escHtml(todoPlural(list.length, 'thing') + ' dated ahead, soonest first')] };
  },
  draw: function(d) { return wdgListHtml('when', d.list.map(wcComingRowHtml), ' data-coming'); } });
