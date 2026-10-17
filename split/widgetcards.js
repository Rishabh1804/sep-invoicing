/* ===== THE WIDGETS (docs/UI_PASS_3.md §7d; UI pass 3, U2) =====
   One entry a widget (wdgDefine, widgets.js), in the gallery's order: its sections, then the widgets in each. Every figure is its
   screen's, read with the function its screen draws with (I8): a widget never works a figure out a second way, and where a screen's
   card already says it (a hero's options: homeMtdOpts, finHomeOpts, attHomeOpts…), the widget is that card at its size
   (wdgFromHero). A widget's `data` returns {state, tone, …} (§7c); `draw` its body for 's' | 'm' | 'l'; `foot` its own links.
   Who sees each is its `needs` (§7g, I4): the page it opens, money, wages, a permission. */

/* The one blank-state door a widget offers where nothing is recorded yet: a button to where it is recorded. */
function wcAct(label, action, attrs) {
  return '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="' + escHtml(action) + '"' + (attrs || '') + '>' + escHtml(label) + '</button>';
}
/* The period's figures the questions and the cards read, once a book and a period (statsPulseArgs). */
function wcPulseArgs(per) { return wdgMemo('pulse-args:' + per, function() { return statsPulseArgs(per); }); }
/* Moves in a dialog (a question's whole list, Do first's longer list): the deck the board draws, every move in it. */
function wcMovesOpen(title, moves, key, words) {
  var listed = typeof advListedKeys === 'function' ? advListedKeys() : {};
  var deck = moves.length ? '<div class="inv-deck" data-adv-deck="' + escHtml(key) + '">' + moves.map(function(mv, i) {
    return advMoveCardHtml(mv, listed, words ? words[i] : undefined);
  }).join('') + '</div>' : uiBlankHtml({ kind: 'empty', title: 'Nothing to do here yet' });
  dialogOpen('<div class="inv-dialog" role="dialog" aria-modal="true" aria-label="' + escHtml(title) + '" data-wc-moves="' + escHtml(key) + '">' +
    dialogHeadHtml(title, 'invCloseOverlay', 'Close') + '<div class="inv-dialog-body">' + deck + '</div></div>', { dismiss: true });
}

/* ---------- Money ---------- */
wdgDefine({ id: 'money', title: 'Money at a glance', q: 'Where does the money stand?', section: 'money', sizes: ['m'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'overview' },
  data: function() {
    var o = finHomeOpts();
    if (o.none) return { state: 'empty', title: 'No bank statement yet', body: 'Import the bank’s .xls or .xlsx to see the balance, what is owed and the forecast.',
      action: wcAct('Import statement', 'invHomeImportBank'), attrs: o.attrs };
    return wdgFromHero(o);
  },
  draw: wdgHeroDraw, foot: wdgHeroFoot });
/* U2d · Money: cash, owed, dtp, gst (§7d), each after this line in the table's order. */
/* What the money widgets share: the one blank state while no statement is imported (GST alone reads the invoices); the worst of a
   card's tones (it takes the tone of the worst thing it holds); a group of rows under its name in a sheet, so a group whose rows the
   card let go of to fit goes with its name (wdgFit); and the row of a client that opens its receivables on Money. */
/* A blank state's one door (§7c), except on a phone's Small: half the phone across, the blank state's line has no room for a button
   beside its words (the button ran past the card, or squeezed the words to nothing), and the head is the door to the screen. */
function wcmAct(ctx, label, action, attrs) { return ctx && ctx.size === 's' && !_isDesktop ? '' : wcAct(label, action, attrs); }
/* A widget's figure in whole rupees, as the Overview's heroes draw it (finHeroFig, its exact amount in its title), breaking only
   after a comma group where a narrow card wraps it (figWrapHtml): a crore on a phone's Small read ₹12,35,12,7 / 14. */
function wcmFig(v) { return '<span title="' + escHtml(formatCurrency(v)) + '">' + figWrapHtml(escHtml(finRs(v))) + '</span>'; }
function wcmNoBank(what, ctx) {
  return { state: 'empty', title: 'No bank statement yet', body: 'Import the bank’s .xls or .xlsx: ' + what + ' read from it.',
    action: wcmAct(ctx, 'Import statement', 'invHomeImportBank') };
}
function wcmWorst(tones) {
  return (tones || []).filter(function(t) { return WDG_TONES[t]; }).sort(function(a, b) { return (UI_TONE_RANK[b] || 0) - (UI_TONE_RANK[a] || 0); })[0] || 'neutral';
}
function wcmGroupHtml(name, rows, attrs) {
  var list = (rows || []).filter(Boolean);
  return list.length ? '<div class="inv-hero-sheet"' + (attrs || '') + '><div class="inv-row-group"><span>' + escHtml(name) + '</span></div>' + list.join('') + '</div>' : '';
}
function wcmClientRowHtml(id, name, meta, end) {
  return '<div class="inv-row inv-row-2" data-wcm-client="' + escHtml(String(id)) + '"><button type="button" class="inv-row-main" data-action="invFinGo" data-tab="receipts" data-client="' +
    escHtml(String(id)) + '"><span class="inv-row-title">' + escHtml(name) + '</span><span class="inv-row-meta">' + meta + '</span></button>' +
    '<span class="inv-row-end">' + end + '</span></div>';
}
/* A chart beside the rows it rests on once the widget is wide, under it on a narrow one ([data-wcm-cols], its side [data-wcm-side],
   styles.css); `side` the groups of rows, or nothing. */
function wcmColsHtml(chart, side) {
  return side ? '<div data-wcm-cols><div class="inv-widget-viz">' + chart + '</div><div data-wcm-side>' + side + '</div></div>' : '<div class="inv-widget-viz">' + chart + '</div>';
}

/* Cash and its low point: the Overview's Cash hero read (finCashRead: the balance, the forecast's low point, the tone) and its
   forecast drawn (finForecastChart). Small, the balance and its day under the low point and its date; Medium, the 60 days drawn
   with their band; Large, what the forecast rests on beside it. */
wdgDefine({ id: 'cash', title: 'Cash and its low point', q: 'Will the account dip below zero, and when?', section: 'money', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'overview' },
  data: function(ctx) {
    if (!finHasBank()) return wcmNoBank('the balance and the forecast are', ctx);
    var c = wdgMemo('wcm-cash|' + localDateStr(), function() { return finCashRead(null, finCtx().cls); });
    if (!c) return wcmNoBank('the balance and the forecast are', ctx);
    var fc = c.fc, last = c.last;
    // The low point with its date: the line, unless the account is overdrawn or dips below zero, which the line says first and
    // the low point follows from Medium. The forecast's low starts at today's balance (finForecast), so a low on today is the
    // balance itself: nothing lower comes in the 60 days.
    var low = fc && fc.min.date !== localDateStr() ? 'lowest ' + finRs(fc.min.bal) + ' on ' + stockShortDate(fc.min.date) : '';
    var line = last.balance >= 0 && fc && !fc.cross ? (low ? low.charAt(0).toUpperCase() + low.slice(1) : 'No lower in the 60 days ahead') : c.title;
    return { state: 'ok', tone: c.tone, c: c, line: line, low: last.balance < 0 || (fc && fc.cross) ? low : '',
      day: 'in the bank on ' + stockShortDate(last.date) + (c.stale > 7 ? ', ' + c.stale + ' days old' : ''),
      // A Small says the one thing under its line: how old the statement is where that is what makes it amber (DR-8), else its day.
      dayShort: c.stale > 7 ? 'statement ' + c.stale + ' days old' : 'in the bank on ' + stockShortDate(last.date) };
  },
  draw: function(d, size) {
    var c = d.c, h = '<div class="inv-widget-fig">' + wcmFig(c.last.balance) + '</div><div class="inv-widget-line">' + escHtml(d.line) + '</div>';
    if (size === 's') return h + '<div class="inv-widget-sub">' + (c.stale > 7 ? figHtml(escHtml(d.dayShort), 'warning') : escHtml(d.dayShort)) + '</div>';
    // Two facts a line at most: the hero's own (the day, the cheques in hand), and the low point under it where the line said
    // the account goes below zero.
    h += '<div class="inv-widget-sub">' + escHtml([d.day, c.held.n ? '+ ' + finRs(c.held.amount) + ' in cheques in hand' : ''].filter(Boolean).join(' · ')) + '</div>' +
      (d.low ? '<div class="inv-widget-sub">' + figHtml(escHtml(d.low.charAt(0).toUpperCase() + d.low.slice(1)), c.tone === 'ok' ? null : c.tone) + '</div>' : '');
    if (!c.fc) return h;
    var rests = size === 'l' ? wcmGroupHtml('What it rests on', c.fc.facts.map(uiFactRowHtml), ' data-wcm-rests') : '';
    return h + wcmColsHtml(finForecastChart(c.fc), rests);
  } });

/* Owed to us, by age: Receivables' own reading (bankReceivables through finCtx, finAgeing), judged by its oldest invoice's age and
   never red while a receipt is unplaced (finOwedTone). Small, the total and what is over 90 days; Medium, the ageing as a bar and
   the two oldest debts; Large, the five largest too, each with how fast it pays (bankDaysToPay). */
wdgDefine({ id: 'owed', title: 'Owed to us, by age', q: 'How much is owed, and how old is it?', section: 'money', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'receipts' },
  data: function(ctx) {
    if (!finHasBank()) return wcmNoBank('what clients owe is', ctx);
    var fx = finCtx(), recv = fx.recv(), loose = fx.loose();
    var owed = gstRound(recv.reduce(function(s, r) { return s + Math.max(0, r.owed); }, 0)), bands = finAgeing(recv);
    var line = owed < 0.5 ? 'Nothing owed to us' : bands[3].amount > 0.005 ? finRs(bands[3].amount) + ' over 90 days'
      : bands[2].amount > 0.005 ? finRs(bands[2].amount) + ' over 60 days' : 'Nothing over 60 days';
    var book = bankBookDaysToPay(bankPayHistory(recv));
    return { state: 'ok', tone: finOwedTone(finOwedOldest(recv)) || 'ok', recv: recv, owed: owed, bands: bands, loose: loose, line: line,
      from: bankRecvFrom(fx.rows), book: book && book.median != null ? Math.round(book.median) : null };
  },
  draw: function(d, size) {
    var h = '<div class="inv-widget-fig">' + wcmFig(d.owed) + '</div><div class="inv-widget-line">' + escHtml(d.line) + '</div>';
    // A receipt nobody placed makes what is owed read high: said at every size, in its tone (a Small, in a phone's half width, says
    // how many; what it does to the figure is said from Medium).
    var loose = d.loose ? figHtml(escHtml(todoPlural(d.loose, 'receipt') + ' not placed' + (size === 's' && !_isDesktop ? '' : ': reads high')), 'warning') : '';
    if (size === 's') return h + (loose ? '<div class="inv-widget-sub">' + loose + '</div>' : '');
    h += '<div class="inv-widget-sub">' + (loose || escHtml(['since ' + stockShortDate(d.from), d.book != null ? 'clients pay in ' + d.book + ' days' : ''].filter(Boolean).join(' · '))) + '</div>';
    if (d.owed < 0.5) return h;
    // The ageing as the Overview's bar, and its key under it: each band holding anything a dot in the bar's own tone and its words
    // (DR-8), side by side as a legend is, never a chain of facts.
    h += '<div class="inv-widget-viz">' + chartMeter(d.bands.map(function(b, i) { return { v: b.amount, tone: finAgeTone(i) }; }),
      { title: 'Owed by age: ' + d.bands.map(function(b) { return b.label + ' ' + finRs(b.amount); }).join(' · ') }) + '</div>' +
      '<div class="inv-widget-sub" data-wcm-ages>' + d.bands.map(function(b, i) {
        return b.amount > 0.005 ? uiDot(finAgeTone(i), escHtml(b.label + ' ' + finRs(b.amount))) : '';
      }).filter(Boolean).join(' ') + '</div>';
    var owing = d.recv.filter(function(r) { return r.owed > 0.005; }), hist = size === 'l' ? bankPayHistory(d.recv) : null;
    var end = function(r) { return '<span class="inv-num">' + figHtml(escHtml(formatCurrency(r.owed)), finOwedTone(r.oldestDays)) + '</span>'; };
    var oldest = owing.filter(function(r) { return r.oldestDays != null; }).sort(function(a, b) { return b.oldestDays - a.oldestDays || b.owed - a.owed; }).slice(0, 2);
    h += wcmGroupHtml('The oldest', oldest.map(function(r) {
      return wcmClientRowHtml(r.client.id, r.client.name, escHtml('oldest ' + todoPlural(r.oldestDays, 'day') + ' · ' + r.open.length + ' open'), end(r));
    }), ' data-wcm-group="oldest"');
    if (size === 'l') h += wcmGroupHtml('The largest', owing.slice(0, 5).map(function(r) {
      var dtp = bankDaysToPay(r.client.id, hist);
      return wcmClientRowHtml(r.client.id, r.client.name, (dtp && dtp.median != null ? 'pays in ' + figHtml(escHtml(Math.round(dtp.median) + ' d'), figTonePaysIn(dtp.median)) : 'no receipt set yet') +
        (r.oldestDays != null ? escHtml(' · oldest ' + r.oldestDays + ' d') : ''), end(r));
    }), ' data-wcm-group="largest"');
    return h;
  } });

/* Days to pay, against terms: each client's days from invoice to receipt by value (bankDaysToPay; three receipts or more, as the
   forecast trusts a client's own), against its payment terms (flowTerms), judged as the flow's payment step judges them
   (flowPayTone). Small, the book's median by value and how many pay past their terms; Medium, the six most past their terms as a
   dumbbell (five on the phone, where six would run past its cap); Large, every other client as rows beside it, and on the phone
   every client as rows in the dumbbell's place. */
var WCM_DTP_MIN = 3;
wdgDefine({ id: 'dtp', title: 'Days to pay, against terms', q: 'Who pays on time, who is slipping?', section: 'money', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'receipts' },
  data: function(ctx) {
    if (!finHasBank()) return wcmNoBank('days to pay are', ctx);
    var recv = finCtx().recv(), hist = bankPayHistory(recv), book = bankBookDaysToPay(hist);
    if (!book || book.median == null) return { state: 'early', title: 'No receipt set against an invoice yet',
      body: 'Days to pay read each receipt against the invoices it paid; a client is judged from three receipts.' };
    var list = recv.map(function(r) {
      var dd = bankDaysToPay(r.client.id, hist);
      if (!dd || dd.n < WCM_DTP_MIN || dd.median == null) return null;
      var days = Math.round(dd.median), t = flowTerms(r.client.id);
      return { id: r.client.id, name: r.client.name, days: days, terms: t.days, n: dd.n, over: days - t.days, tone: flowPayTone(days, t.days) };
    }).filter(Boolean).sort(function(a, b) { return b.over - a.over || b.days - a.days || String(a.name).localeCompare(String(b.name)); });
    var days = Math.round(book.median), plant = flowCfg().termsDays;
    return { state: 'ok', tone: list.length ? wcmWorst(list.map(function(x) { return x.tone; })) : flowPayTone(days, plant) || 'neutral',
      list: list, days: days, past: list.filter(function(x) { return x.days > x.terms; }).length, plant: plant };
  },
  draw: function(d, size) {
    var h = '<div class="inv-widget-fig">' + escHtml(String(d.days)) + '<span class="inv-unit">d</span></div>' +
      '<div class="inv-widget-line">' + escHtml(d.list.length ? d.past + ' of ' + todoPlural(d.list.length, 'client') + ' past terms' : 'No client has ' + WCM_DTP_MIN + ' receipts yet') + '</div>';
    h += '<div class="inv-widget-sub">' + escHtml(size === 's' ? 'median, by value' : 'median by value; a client is judged from ' + WCM_DTP_MIN + ' receipts') + '</div>';
    if (size === 's' || !d.list.length) return h;
    // A client as a row: its terms and receipts, and its days in the flow's tone at the end.
    var row = function(x) { return wcmClientRowHtml(x.id, x.name, escHtml('terms ' + x.terms + ' d · ' + todoPlural(x.n, 'receipt')), uiDot(x.tone, escHtml(x.days + ' d'))); };
    // A phone's Large is no taller than its Medium (§7b): there every client is a row, most past its terms first, which the card
    // lets go of to fit; a dumbbell's rows cannot be.
    if (size === 'l' && !_isDesktop) return h + wcmGroupHtml('Most past their terms first', d.list.map(row), ' data-wcm-group="all"');
    var n = _isDesktop ? 6 : 5, top = d.list.slice(0, n);
    var chart = chartDumbbell(top.map(function(x) { return { key: String(x.id), label: x.name, a: x.terms, b: x.days, tone: x.tone }; }),
      { aLabel: 'Terms', bLabel: 'Pays in', labelHead: 'Client', unit: 'count', ariaLabel: 'Days to pay against terms' });
    var rest = size === 'l' ? wcmGroupHtml('The other clients', d.list.slice(n).map(row), ' data-wcm-group="rest"') : '';
    return h + wcmColsHtml(chart, rest);
  } });

/* GST due against paid: the GST tab's own months (finGstByMonth) and each one's reading (finGstStatus, in the GST hero's words,
   finGstSay); it reads the invoices, so it says what is due with no statement too. Small, last month's status and what was due;
   Medium, six months grouped, due against paid (finGstMonthsChart); Large, twelve months and the months that carry a note or
   need one. A card takes the tone of the worst month it holds. */
wdgDefine({ id: 'gst', title: 'GST due against paid', q: 'Is every month’s return paid?', section: 'money', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFinance', money: true }, go: { tab: 'pageFinance', v: 'gst' },
  data: function(ctx) {
    if (!(S.invoices || []).some(function(i) { return i.status === 'active'; })) return { state: 'empty', title: 'Nothing invoiced yet',
      body: 'GST due reads from the invoices, and what was paid from the bank statement.' };
    var cls = finHasBank() ? finCtx().cls : [], last = finGstByMonth(insMonthsBack(1), cls)[0], say = finGstSay(last);
    if (ctx.size === 's') return { state: 'ok', tone: say.tone, last: last, say: say };
    var months = finMonths(ctx.size === 'l' ? 12 : 6), g = finGstByMonth(months, cls);
    return { state: 'ok', tone: wcmWorst(g.map(function(r) { return finGstSay(r).tone; }).concat([say.tone])), last: last, say: say, months: months, g: g };
  },
  draw: function(d, size) {
    // The month under the line, where the line does not name it already (nothing due names its month), and what was paid.
    var r = d.last, sub = [r.due > 0 ? billsMonthLabel(r.month) : '', r.paid > 0 ? 'paid ' + finRs(r.paid) : ''].filter(Boolean).join(' · ');
    var h = '<div class="inv-widget-fig">' + wcmFig(r.due) + '</div><div class="inv-widget-line">' + escHtml(d.say.title) + '</div>' +
      (sub ? '<div class="inv-widget-sub">' + escHtml(sub) + '</div>' : '');
    if (size === 's') return h;
    // From Large, newest first: the months with a note (a return paid another way, said as the GST tab says it), and the months the
    // statement shows no payment for and nobody has noted (finGstStatus's missing), each a row with its status.
    var row = function(x, meta) {
      return '<div class="inv-row inv-row-2" data-wcm-gst="' + escHtml(x.month) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(billsMonthLabel(x.month)) + '</span>' +
        '<span class="inv-row-meta">' + escHtml(meta) + '</span></span><span class="inv-row-end">' + finGstDotHtml(x) + '</span></div>';
    };
    var back = size === 'l' ? d.g.slice().reverse() : [];
    var groups = wcmGroupHtml('Notes', back.filter(function(x) { return x.note; }).map(function(x) { return row(x, finGstNoteLine(x)); }), ' data-wcm-group="notes"') +
      wcmGroupHtml('Not in the bank', back.filter(function(x) { return !x.note && finGstStatus(x).missing; }).map(function(x) {
        return row(x, finRs(x.due) + ' due by ' + stockShortDate(x.dueBy) + ', and no note');
      }), ' data-wcm-group="missing"');
    return h + wcmColsHtml(finGstMonthsChart(d.months, d.g), groups);
  } });

/* ---------- Office ---------- */
wdgDefine({ id: 'mtd', title: 'Month to date', q: 'How is the month going?', section: 'office', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageRegister', money: true }, go: { tab: 'pageRegister' },
  data: function(ctx) {
    var o = homeMtdOpts(homeMonthInvoices(), { viz: ctx.size === 'l' });
    // Small: what is billed and its change on the same days last month, coded by that change alone; from Medium the four tiles
    // and the worse of billing and realisation, at Large the tiles' lines of the months before.
    var d = wdgFromHero(o, { fig: figWrapHtml(escHtml(formatCurrency(o.rev))), delta: o.revDelta });
    if (ctx.size === 's') d.tone = WDG_TONES[o.revTone] ? o.revTone : 'neutral';
    return d;
  },
  draw: function(d, size) {
    if (size !== 's') return wdgStdHtml(d, size);
    return '<div class="inv-widget-fig">' + d.fig + '</div>' + (d.delta ? '<div class="inv-widget-sub">' + d.delta + '</div>' : '<div class="inv-widget-sub">billed this month, taxable</div>');
  } });
wdgDefine({ id: 'unbilled', title: 'Unbilled challans', q: 'What is waiting to be invoiced?', section: 'office', sizes: ['s', 'm'],
  needs: { page: 'pageIM' }, go: { tab: 'pageIM', v: 'awaiting' },
  data: function() {
    var o = homeUnbilledOpts();
    if (!o) return { state: 'empty', title: 'No challan recorded yet', body: 'A challan received is recorded on Challans.',
      action: wcAct('Add challan', 'invHomeQuick', ' data-go="challan"'), attrs: ' data-card="unbilled-pulse"' };
    return wdgFromHero(o, { line: o.title });
  },
  draw: function(d, size) {
    if (size !== 's') return wdgStdHtml(d, size);
    return (d.fig ? '<div class="inv-widget-fig">' + d.fig + '</div>' : '') + '<div class="inv-widget-line">' + d.line + '</div>' + (!d.fig && d.sub ? '<div class="inv-widget-sub">' + d.sub + '</div>' : '');
  }, foot: wdgHeroFoot });
wdgDefine({ id: 'recent', title: 'Recent invoices', q: 'What went out last?', section: 'office', sizes: ['m', 'l'],
  needs: { page: 'pageRegister' }, go: { tab: 'pageRegister' },
  data: function(ctx) { return wdgFromHero(homeRecentOpts(ctx.size === 'l' ? 10 : 5)); },
  draw: wdgHeroDraw });
/* Quick actions: each action by its page (the guard's own map, GRD_QUICK_PAGE); three at Small, six at Medium. */
var WC_QUICK = [
  { label: 'New invoice', icon: 'filePlus', page: 'pageCreate', action: 'invCreateNew' },
  { label: 'New challan', icon: 'boxPlus', page: 'pageIM', go: 'challan' },
  { label: 'Paste message', icon: 'message', page: 'pageStaff', go: 'paste' },
  { label: 'Stock entry', icon: 'flask', page: 'pageStock', go: 'stock' },
  { label: 'Attendance', icon: 'userCheck', page: 'pageStaff', go: 'attendance' },
  { label: 'Add task', icon: 'task', page: 'pageHome', go: 'task' }
];
wdgDefine({ id: 'quick', title: 'Quick actions', q: 'What do I start?', section: 'office', sizes: ['s', 'm'], card: 'quick',
  data: function() {
    var list = WC_QUICK.filter(function(a) { return typeof grdSees !== 'function' || grdSees(a.page); });
    if (!list.length) return { state: 'empty', title: 'Nothing to start here for your ID' };
    return { state: 'ok', tone: 'neutral', list: list };
  },
  draw: function(d, size) {
    return '<div class="inv-btn-grid inv-coded" role="group" aria-label="Quick actions">' + d.list.slice(0, size === 's' ? 3 : 6).map(function(a) {
      return '<button type="button" class="inv-btn inv-btn-secondary" data-action="' + (a.action || 'invHomeQuick') + '"' + (a.go ? ' data-go="' + a.go + '"' : '') + '>' +
        iconSvg(a.icon) + '<span>' + escHtml(a.label) + '</span></button>';
    }).join('') + '</div>';
  } });
wdgDefine({ id: 'sync', title: 'GitHub backup', q: 'Is the book backed up?', section: 'office', sizes: ['s'],
  needs: { perm: 'settings' }, go: { settings: 'sync' },
  data: function() {
    var o = ghCardOpts();
    if (!o) return { state: 'notset', title: 'GitHub sync is not set up', body: 'A second copy of the book on GitHub, pushed from this device.',
      action: wcAct('Set it up', 'invWdgGo', ' data-wid="sync"'), attrs: ' data-card="sync"' };
    return wdgFromHero(o);
  },
  draw: function(d) { return '<div class="inv-widget-line">' + d.line + '</div>' + (d.sub ? '<div class="inv-widget-sub">' + d.sub + '</div>' : ''); },
  // Back up now is the widget's whole point: drawn at its one size.
  foot: function(d) { return d.heroFoot || ''; } });
/* U2d · Office: turn, pipe, quote (§7d), each after this line in the table's order. */
/* Turnaround: the flow thread's reading of the plant (flowStats, flowVerdict), as Floor's Overview's Turnaround hero reads it, and its
   door In plant, as the hero's. Small, the median working days from challan to despatch and the share of the value back within its
   target; Medium, the two slowest clients, each against its own target; Large, the steps from the challan to pickling, plating and
   despatch (flowStepsHtml, the screen's rows: and invoice to payment for a role that sees money). */
wdgDefine({ id: 'turn', title: 'Turnaround', q: 'How fast does work go back out?', section: 'office', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageProduction' }, go: { tab: 'pageProduction', v: 'plant' },
  data: function(ctx) {
    var st = flowStats(null);
    if (!st.lines) return { state: 'empty', title: 'No challan in 90 days', body: 'The turnaround reads each challan to the day its material goes back out.',
      action: typeof grdSees !== 'function' || grdSees('pageIM') ? wcmAct(ctx, 'Add challan', 'invHomeQuick', ' data-go="challan"') : '' };
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
      }).filter(Boolean).sort(function(a, b) { return b.d - a.d || (a.within == null ? 1 : a.within) - (b.within == null ? 1 : b.within); }).slice(0, 2);
      slow.forEach(function(x) { tones.push(x.tone); });
    }
    if (ctx.size === 'l' && st.pay && (typeof grdSeesMoney !== 'function' || grdSeesMoney())) tones.push(flowPayTone(st.pay.d, st.terms.days));
    return { state: 'ok', tone: wcmWorst(tones), st: st, v: v, slow: slow };
  },
  draw: function(d, size) {
    var st = d.st, v = d.v, target = 'a ' + flowTargetWord(v.t.days);
    var h = '<div class="inv-widget-fig">' + escHtml(String(st.toDespatch.d)) + '<span class="inv-unit">d</span></div>' +
      '<div class="inv-widget-line">' + escHtml(v.on || v.head) + '</div>' +
      '<div class="inv-widget-sub">' + escHtml(size === 's' ? 'against ' + target : 'working days, challan to despatch; ' + target) + '</div>';
    if (size === 's') return h;
    h += d.slow.length ? wcmGroupHtml('The slowest clients', d.slow.map(function(x) {
      return '<div class="inv-row inv-row-2" data-wco-client="' + escHtml(x.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(x.name) + '</span>' +
        '<span class="inv-row-meta">' + escHtml('median of ' + todoPlural(x.n, 'line') + ' · a ' + flowTargetWord(x.target)) + '</span></span>' +
        '<span class="inv-row-end">' + uiDot(x.tone, escHtml(flowDayText(x.d))) + '</span></div>';
    }), ' data-wco-group="slow"') : '<div class="inv-widget-sub">No client has ' + FLOW_MIN + ' lines despatched in 90 days yet</div>';
    if (size === 'l') h += wcmGroupHtml('The steps', [flowStepsHtml(st, null)], ' data-wco-group="steps"');
    return h;
  } });

/* Pipeline, stage by stage: Pipeline's own stages (pipeStages: each a count, an amount and a tone by how long its oldest has
   waited; Owed to us only for a role that sees money, as Pipeline leaves it out) and its words for a stage running late
   (pipeLateSay). Small, the worst stage running late and what it holds; Medium, the stages as coded tiles, each opening Pipeline on
   itself; Large, the oldest in each. From Medium the card carries no figure of its own, as Pipeline's verdict carries none: each
   stage's amount is its tile's (I8). A phone's Large is no taller than its Medium (§7b), so there the stages are rows, each with its
   oldest, in the tiles' place: rows the card can let go of to fit, where tiles cannot be. */
function wcoStageSay(s) {
  return s.label + ' · ' + todoPlural(s.n, s.key === 'awaiting' ? 'challan' : s.key === 'owed' ? 'client' : 'invoice');
}
/* A stage's own words for its oldest, or for how many are over their days: the first of them, as its tile on Pipeline says it. */
function wcoStageWord(s) { return pipeNoThisYear(String(s.word || '').split(' · ')[0]); }
function wcoPipeTileHtml(s) {
  // A tile stating nothing to judge is drawn plain (§6.26), as Pipeline's own.
  var tone = s.open ? uiTone(s.tone) : 'neutral', cls = 'inv-tile' + (tone !== 'neutral' ? ' inv-tile-' + tone : ''), plain = tone === 'neutral' ? ' data-tone="neutral"' : '';
  var label = '<div class="inv-tile-label">' + escHtml(s.label) + '</div>';
  if (s.noBank) return '<div class="' + cls + '" data-wco-stage="owed"' + plain + '>' + label + '<div class="inv-tile-value">&mdash;</div><div class="inv-tile-sub">Needs a bank statement</div></div>';
  if (!s.open) return '<div class="' + cls + '" data-wco-stage="' + s.key + '"' + plain + '>' + label + '<div class="inv-tile-value">0</div><div class="inv-tile-sub">None</div></div>';
  return '<button type="button" class="' + cls + '" data-action="invSwitchTab" data-tab="pagePipeline" data-v="' + s.key + '" data-wco-stage="' + s.key + '"' + plain + '>' + label +
    '<div class="inv-tile-value">' + s.n + '</div><div class="inv-tile-sub"><span class="inv-num">' + escHtml(formatCurrency(s.amount)) + '</span> ' + escHtml(s.of) + '</div>' +
    '<div class="inv-tile-sub">' + uiDot(s.tone, escHtml(wcoStageWord(s))) + '</div></button>';
}
/* The oldest a stage holds: a challan by its days waiting, an invoice by its days in its state (delivered, by when its GSTR-1 is
   due), a client owing by its oldest invoice; each in its own judge's tone and words. `ref` names it in a few words (the challan,
   the invoice, the client), `what` with its client or amount after a comma: one fact either way, so a row naming it beside the
   stage's amount chains no more than two (TM6), and a client's name at its longest keeps the row under 120 characters. */
function wcoPipeOldest(s, now) {
  if (s.key === 'awaiting') {
    var im = s.items[0], age = imWaitDays(im), ch = 'challan ' + (im.challanNo || 'with no number');
    return { ref: ch, what: ch + ', ' + (im.clientName || 'no client'), tone: imWaitTone(age),
      word: age == null ? 'no date' : imDatedAhead(im) ? 'dated ' + stockDayLabel(im.challanDate) : age === 0 ? 'today' : pipeDays(age) };
  }
  if (s.key === 'owed') {
    var r = s.items.filter(function(x) { return x.oldestDays != null; }).sort(function(a, b) { return b.oldestDays - a.oldestDays; })[0] || s.items[0];
    return { ref: r.client.name, what: r.client.name + ', ' + finRs(r.owed), tone: finOwedTone(r.oldestDays) || 'neutral',
      word: r.oldestDays != null ? pipeDays(r.oldestDays) : 'owed' };
  }
  var i = s.key === 'delivered' ? s.items.filter(invFileDue).sort(function(a, b) { return invFileDue(a) - invFileDue(b); })[0] || s.items[0]
    : s.items.slice().sort(function(a, b) { return invStateDays(b, now) - invStateDays(a, now); })[0];
  var no = i.displayNumber || i.invoiceNumber || '';
  return { ref: no, what: no + ', ' + (i.clientName || ''), tone: invStateTone(i, now), word: invStateAgeText(i) || '' };
}
/* The oldest in a stage as a row that opens Pipeline on it (a Large's list beside the tiles). */
function wcoPipeOldestHtml(s, now) {
  var o = wcoPipeOldest(s, now);
  return '<div class="inv-row inv-row-2" data-wco-oldest="' + s.key + '"><button type="button" class="inv-row-main" data-action="invSwitchTab" data-tab="pagePipeline" data-v="' + s.key + '">' +
    '<span class="inv-row-title">' + escHtml(s.label) + '</span><span class="inv-row-meta">' + escHtml(o.what) + '</span></button>' +
    '<span class="inv-row-end">' + uiDot(o.tone, escHtml(pipeNoThisYear(o.word))) + '</span></div>';
}
/* A stage as a row (a phone's Large): its name and count, what it holds and its oldest, and its own word in its tone at the end; a
   stage holding nothing, or with no statement to read, a plain row. */
function wcoPipeStageRowHtml(s, now) {
  if (s.noBank || !s.open) return '<div class="inv-row" data-wco-row="' + s.key + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(s.label) + '</span></span>' +
    '<span class="inv-row-end">' + uiDot('neutral', s.noBank ? 'Needs a bank statement' : 'None') + '</span></div>';
  var o = wcoPipeOldest(s, now);
  return '<div class="inv-row inv-row-2" data-wco-row="' + s.key + '"><button type="button" class="inv-row-main" data-action="invSwitchTab" data-tab="pagePipeline" data-v="' + s.key + '">' +
    '<span class="inv-row-title">' + escHtml(s.label + ' · ' + s.n) + '</span><span class="inv-row-meta">' + escHtml(finRs(s.amount) + ' ' + s.of + ' · oldest: ' + o.ref) + '</span></button>' +
    '<span class="inv-row-end">' + uiDot(s.tone, escHtml(wcoStageWord(s))) + '</span></div>';
}
wdgDefine({ id: 'pipe', title: 'Pipeline, stage by stage', q: 'What is waiting, from challan to payment?', section: 'office', sizes: ['m', 's', 'l'],
  needs: { page: 'pagePipeline' }, go: { tab: 'pagePipeline' },
  data: function(ctx) {
    var stages = pipeStages(), open = stages.filter(function(s) { return s.open; });
    if (!open.length && !(S.invoices || []).some(function(i) { return i.status === 'active'; }) && !(S.incomingMaterial || []).some(function(im) { return (im.items || []).length; })) {
      return { state: 'empty', title: 'No challan or invoice yet', body: 'The pipeline follows a challan in to its invoice and the money back.',
        action: typeof grdSees !== 'function' || grdSees('pageIM') ? wcmAct(ctx, 'Add challan', 'invHomeQuick', ' data-go="challan"') : '' };
    }
    // The worst stage running late: red before amber, and in the pipeline's own order within a tone.
    var late = open.filter(function(s) { return s.tone === 'danger' || s.tone === 'warning'; })
      .sort(function(a, b) { return (UI_TONE_RANK[uiTone(b.tone)] || 0) - (UI_TONE_RANK[uiTone(a.tone)] || 0); });
    return { state: 'ok', tone: late.length ? uiTone(late[0].tone) : 'ok', stages: stages, open: open, worst: late[0] || null };
  },
  draw: function(d, size) {
    // The stage it speaks of: the worst running late, else the first holding anything.
    var w = d.worst, s = w || d.open[0] || null, now = Date.now();
    var line = w ? pipeLateSay(w) : s ? 'Nothing running late' : 'Nothing on its way';
    line = '<div class="inv-widget-line">' + escHtml(pipeNoThisYear(line.charAt(0).toUpperCase() + line.slice(1))) + '</div>';
    if (!s) return line + '<div class="inv-widget-sub">every invoice filed, nothing waiting</div>';
    // A phone's Small is half the phone across: there the sub names the stage alone, so the line and it keep to the card's cap.
    if (size === 's') return '<div class="inv-widget-fig">' + wcmFig(s.amount) + '</div>' + line + '<div class="inv-widget-sub">' + escHtml(_isDesktop ? wcoStageSay(s) : s.label) + '</div>';
    if (size === 'l' && !_isDesktop) return line + wcmGroupHtml('Stage by stage', d.stages.map(function(x) { return wcoPipeStageRowHtml(x, now); }), ' data-wco-group="stages"');
    var h = line + '<div class="inv-tiles" data-wco-stages>' + d.stages.map(wcoPipeTileHtml).join('') + '</div>';
    if (size === 'l') h += wcmGroupHtml('The oldest in each', d.open.map(function(x) { return wcoPipeOldestHtml(x, now); }), ' data-wco-group="oldest"');
    return h;
  } });

/* Quotations and prospects: the quotations counted as their verdict counts them (qtTally, qtTallyTone) and Prospects' pipeline
   against the spare (prsPipeline, prsSpare), its four factors as Prospects' verdict draws them. Small, the quotations out, won and
   lost; Medium, the spare and the weighted pipeline, and how much of the spare it would fill. Its door is Sales' Prospects, and
   Quotations is its foot. */
wdgDefine({ id: 'quote', title: 'Quotations and prospects', q: 'Who could fill the spare tonnes?', section: 'office', sizes: ['s', 'm'],
  needs: { page: 'pageClients' }, go: { tab: 'pageClients', v: 'prospects' },
  data: function(ctx) {
    var t = qtTally(), prs = getProspects();
    if (!t.all && !prs.length) return { state: 'empty', title: 'No quotation or prospect yet', body: 'Sales keeps the firms approached and the quotations sent them.',
      action: wcmAct(ctx, 'Open Sales', 'invWdgGo', ' data-wid="quote"') };
    var due = prs.filter(function(p) { var l = prsLate(p); return l != null && l >= 0; });
    var follow = due.some(function(p) { return prsLate(p) >= 7; }) ? 'danger' : due.length ? 'warning' : null;
    var d = { state: 'ok', t: t, out: t.live + t.expired, due: due.length, follow: follow };
    // The Small holds the quotations alone; from Medium the prospects too: their follow-ups due, and how much of the spare the
    // pipeline fills, judged as Prospects' own tile judges it (figToneCapacity), among what the card holds.
    if (ctx.size === 's') { d.tone = qtTallyTone(t); return d; }
    d.pl = prsPipeline(); d.sp = prsSpare();
    d.fill = d.sp && d.sp.spareMonth > 0 ? d.pl.weighted / d.sp.spareMonth : null;
    d.tone = wcmWorst([qtTallyTone(t), follow, d.fill != null ? figToneCapacity(d.fill * 100) : null]);
    return d;
  },
  draw: function(d, size) {
    var t = d.t;
    var h = t.all ? '<div class="inv-widget-fig">' + escHtml(String(d.out)) + '<span class="inv-unit">out</span></div>' +
      '<div class="inv-widget-line">' + escHtml(t.accepted + ' won · ' + t.declined + ' lost') + '</div>' : '<div class="inv-widget-line">No quotation sent yet</div>';
    var sub = t.expired ? t.expired + ' expired, unanswered' : t.soon ? t.soon + ' expiring this week' : t.toPost ? todoPlural(t.toPost, 'rate') + ' to post'
      : t.drafts ? todoPlural(t.drafts, 'draft') : t.all ? 'nothing waiting on an answer' : '';
    if (sub) h += '<div class="inv-widget-sub">' + figHtml(escHtml(sub), t.expired || t.soon || t.toPost ? 'warning' : null) + '</div>';
    if (size === 's') return h;
    var pl = d.pl, sp = d.sp, fill = d.fill, tn = function(kg) { return escHtml(formatNum(kg / 1000, 1) + ' t'); };
    return h + '<div class="inv-tiles inv-tiles-4" data-wco-prospects>' + [
      { label: 'Open', fig: String(pl.n), sub: d.due ? todoPlural(d.due, 'follow-up') + ' due' : 'none due', tone: d.follow },
      { label: 'Pipeline', fig: tn(pl.weighted), sub: 'a month, weighted', attrs: ' title="' + escHtml('Weighted by the chance at each stage: new 10%, contacted 20%, sample 40%, quoted 60% (a working assumption); ' +
        formatNum(pl.kg / 1000, 1) + ' t if all came') + '"' },
      { label: 'Spare', fig: sp ? tn(sp.spareMonth) : '', sub: 'a month, the last 90 days' },
      { label: 'Fills', fig: fill != null ? Math.round(fill * 100) + '%' : '', sub: 'of the spare', tone: fill != null ? figToneCapacity(fill * 100) : null }
    ].map(uiFactorTileHtml).join('') + '</div>';
  },
  foot: function(d, size) {
    return size === 's' ? '' : '<button type="button" class="inv-btn inv-btn-link inv-btn-sm" data-action="invSwitchTab" data-tab="pageClients" data-v="quotes">Open Quotations</button>';
  } });

/* ---------- Floor ---------- */
wdgDefine({ id: 'powercuts', title: 'Power cuts', q: 'How much power did we lose?', section: 'floor', sizes: ['s', 'm'],
  needs: { page: 'pagePower' }, go: { tab: 'pagePower', v: 'cuts' },
  data: function() { var o = homePowerOpts(); return wdgFromHero(o, { line: o.title }); },
  draw: function(d, size) {
    if (size !== 's') return wdgStdHtml(d, size);
    return (d.fig ? '<div class="inv-widget-fig">' + d.fig + '</div>' : '') + '<div class="inv-widget-line">' + d.line + '</div>';
  } });
wdgDefine({ id: 'zinc', title: 'Zinc rate', q: 'What is zinc costing today?', section: 'floor', sizes: ['s', 'm'],
  needs: { money: true }, go: { settings: 'zinc' },
  data: function() {
    var o = zincCardOpts();
    if (o.none) return { state: 'notset', title: 'No zinc rate recorded', body: o.sub.replace(/<[^>]*>/g, ''), action: o.foot, attrs: o.attrs };
    return wdgFromHero(o, { age: o.age, stale: o.stale });
  },
  draw: function(d, size) {
    if (size !== 's') return wdgStdHtml(d, size);
    // The rate's age, a dot and a word ([data-zinc-age]): an out-of-date rate is said at every size.
    return '<div class="inv-widget-fig">' + d.fig + '</div><div class="inv-widget-sub"><span class="inv-dot ' + (d.stale ? 'inv-dot-warning' : 'inv-dot-ok') +
      '" data-zinc-age="' + (d.stale ? 'stale' : 'fresh') + '">' + escHtml(d.age) + '</span></div>';
  }, foot: wdgHeroFoot });
/* U2d · Floor: floornow, prodday, heat, eff, risk, stockdays, zincpaid (§7d), each after this line in the table's order. */
/* A blank state at the widget's size (§7c): a Small is one line and its head is the door, so it carries no button of its own (beside
   the words, a button squeezed them past a phone's half-width card). */
function wcFlrBlank(ctx, o) { if (ctx && ctx.size === 's') delete o.action; return o; }
/* A word that follows a separator starts low ("VAT A1 · not judged"): the screens' words start high, as a dot says them. */
function wcFlrLc(s) { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); }
/* Hours as a person reads them: 8, 7.5. */
function wcFlrHours(h) { return formatNum(h, 1).replace(/\.0$/, ''); }
/* The day a figure is of, short: today, yesterday, else its weekday and date. */
function wcFlrDayWord(day) {
  var lag = isoDaysBetween(day, localDateStr());
  return lag <= 0 ? 'Today' : lag === 1 ? 'Yesterday' : attDayName(day) + ' ' + stockShortDate(day);
}
/* The worst of some tones, as a hero is coded by the worst of what it holds (a tie keeps the first). */
var WC_FLR_RANK = { danger: 3, warning: 2, ok: 1, info: 1, neutral: 0 };
function wcFlrWorst(tones) {
  return tones.reduce(function(t, x) { return x && (WC_FLR_RANK[x] || 0) > (WC_FLR_RANK[t] || 0) ? x : t; }, 'neutral');
}
/* The floor's lines on a day as Floor's Overview judges its line cards (floor.js flrLineJudge over areaStats: a plating line by its
   efficiency, half its units down, or heads and no record; pickling by its heads against the day's number), the three plating lines
   worst first as the cards are ordered, a tie in tone going to the lower efficiency (as the eff widget breaks it, so the two name
   one line), each with what it plated (prodDayLine) and the EXTRA booked to its areas; and how many lines are short of their
   number, as the People card counts them. Once a book and a day. */
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
/* A plating line's state in a few words, as its card says it: half its units down or heads and no record first (what needs
   following up), else its efficiency, else not judged, else not running. */
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
/* A plating line as a row: its heads against the day's number under its name, what it plated and its state at its end. It opens
   Production → Lines on its line and the day, where the role opens Production. */
function wcFlrLineRowHtml(x, day, isToday) {
  var name = flrLineName(x.ln.id), fig = wcFlrPlated(x.r);
  var main = '<span class="inv-row-title">' + escHtml(name) + '</span><span class="inv-row-meta">' + escHtml(x.j.st.word) + '</span>';
  return '<div class="inv-row inv-row-2" data-wc-line="' + escHtml(x.ln.id) + '">' + (flrSees('pageProduction')
    ? '<button class="inv-row-main" data-action="invProdDayLines" data-day="' + escHtml(day) + '" data-line="' + escHtml(x.ln.id) + '" aria-label="' + escHtml(name + ': open its lines') + '">' + main + '</button>'
    : '<span class="inv-row-main">' + main + '</span>') +
    uiRowEndHtml(fig ? escHtml(fig) : '', { tone: x.j.tone, word: wcFlrLineWord(x, isToday) }) + '</div>';
}
/* The floor now: who is on site against the day's roster (attOnSiteTone, the People card's judge) and the worst line; from Medium
   the three plating lines, each its heads against the day's number and what it has plated; at Large the units down and the EXTRA.
   Today, as Floor's Overview opens; heads only, never a rupee, so every role that opens Floor sees it. */
wdgDefine({ id: 'floornow', title: 'The floor now', q: 'Who is on site and what is running?', section: 'floor', sizes: ['m', 's', 'l'],
  needs: { page: 'pageFloor' }, card: 'floor-now',
  // Floor's Overview on today, as Needs you's floor card opens it.
  go: function() { flrSetDay(null); switchTab('pageFloor'); },
  data: function(ctx) {
    var day = localDateStr(), F = wcFlrLines(day), d = F.att;
    var ran = F.lines.some(function(x) { return x.r.entries.length > 0; });
    if (!d.roster.length && !ran && !homeLastPlatedDay()) return wcFlrBlank(ctx, { state: 'empty', title: 'Nothing on the floor yet', body: 'People → Roster holds the crew, and Production records what each line plates.',
      action: wcAct('Open the floor', 'invWdgGo', ' data-wid="floornow"') });
    var onTone = attOnSiteTone(d, F.short), worst = F.lines[0], n = d.roster.length, on = d.p + d.half;
    var fig = d.marked ? figHtml(String(on), onTone) + '<span class="inv-tile-of">/' + n + '</span>' : '&mdash;';
    var line = !d.marked && !ran ? 'Nothing recorded yet today' : flrLineName(worst.ln.id) + ' · ' + wcFlrLc(wcFlrLineWord(worst, true));
    // What the People card says under its figure: the floor against its number, the absent.
    var sub = d.marked ? [d.complement ? d.floorHeads + ' of ' + d.complement + ' on the floor' : '', todoPlural(d.absent.length, 'absent', 'absent') + (d.unmarked ? ', ' + d.unmarked + ' unmarked' : '')]
      .filter(Boolean).join(' · ') : 'the in-time roll fills it';
    var viz = d.marked ? chartMeter([{ v: d.p, tone: 'ok' }, { v: d.half, tone: 'warning' }, { v: d.absent.length, tone: 'danger' }, { v: d.unmarked, tone: 'neutral' }],
      { title: d.p + ' present, ' + d.half + ' half day, ' + d.absent.length + ' absent' + (d.unmarked ? ', ' + d.unmarked + ' unmarked' : '') }) : '';
    return { state: 'ok', tone: wcFlrWorst([onTone].concat(F.lines.map(function(x) { return x.j.tone; }))), fig: fig, line: escHtml(line), sub: escHtml(sub), viz: viz, F: F, day: day };
  },
  draw: function(d, size) {
    var h = '<div class="inv-widget-fig">' + d.fig + '</div><div class="inv-widget-line">' + d.line + '</div>';
    if (size === 's') return h;
    h += '<div class="inv-widget-sub">' + d.sub + '</div>' + (d.viz ? '<div class="inv-widget-viz">' + d.viz + '</div>' : '');
    var rows = d.F.lines.map(function(x) { return wcFlrLineRowHtml(x, d.day, true); });
    if (size === 'l') {
      // The units not working on each line (the plant register, as found on the day), and the EXTRA booked: the day's whole, by line.
      var nUnits = 0, nDown = 0, half = false, words = [];
      d.F.lines.forEach(function(x) {
        var cap = pltCapacity(x.ln.id, d.day);
        if (!cap.n) return;
        nUnits += cap.n; nDown += cap.down.length;
        if (x.j.ef && x.j.ef.halfDown) half = true;
        if (cap.down.length) words.push(pltDownWords(cap.down, d.day));
      });
      var att = d.F.att, byLine = d.F.lines.filter(function(x) { return x.extra > 0.0005; }).map(function(x) { return flrLineName(x.ln.id) + ' ' + wcFlrHours(x.extra) + ' h'; });
      rows.push(uiFactRowHtml({ label: 'Units down', value: nUnits ? nDown + ' of ' + nUnits : '', tone: half ? 'danger' : null, attrs: ' data-wc-units',
        sub: !nUnits ? 'no unit on the plant register' : nDown ? words.join(' · ') : 'every unit working' }));
      rows.push(uiFactRowHtml({ label: 'EXTRA booked', value: att.marked ? wcFlrHours(att.extraH) + ' h' : '', attrs: ' data-wc-extra',
        sub: !att.marked ? 'no attendance today' : byLine.length ? byLine.join(' · ') : att.extraH > 0.0005 ? 'off the plating lines' : 'none booked today' }));
    }
    return h + '<div class="inv-widget-rows">' + rows.join('') + '</div>';
  } });
/* Production, the last day: the day card (prodDayHeroOpts, as Floor's Overview draws it, compact): Small its weight and the
   plant's usual day; Medium its verdict and each line's weight; Large the whole card, how it was weighed and the meter against
   two shifts. The last day with plating on record, said which. */
wdgDefine({ id: 'prodday', title: 'Production, the last day', q: 'What did we plate?', section: 'floor', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageProduction' }, go: { tab: 'pageProduction', v: 'lines' },
  data: function(ctx) {
    var day = homeLastPlatedDay();
    if (!day) return wcFlrBlank(ctx, { state: 'empty', title: 'No plating recorded yet', body: 'The register page, the barrel list and the pickling messages record what each line plates.',
      action: wcAct('Open Production', 'invWdgGo', ' data-wid="prodday"'), attrs: ' data-card="production"' });
    var o = prodDayHeroOpts(day, { compact: true, attrs: ' data-card="production"' }), pic = o.pic;
    return wdgFromHero(o, { pic: pic, when: wcFlrDayWord(day) + (o.isToday ? ' so far' : ''),
      usual: pic && pic.usual != null ? 'A usual day ' + prodKgFig(pic.usual, true) : 'No usual day yet' });
  },
  draw: function(d, size) {
    var fig = d.fig ? '<div class="inv-widget-fig">' + d.fig + '</div>' : '';
    if (size === 's') return fig + '<div class="inv-widget-line">' + escHtml(d.when) + '</div><div class="inv-widget-sub">' + escHtml(d.usual) + '</div>';
    var h = fig + '<div class="inv-widget-line">' + d.line + '</div><div class="inv-widget-sub">' + escHtml(d.when + ' · ' + wcFlrLc(d.usual)) + '</div>';
    if (!d.pic || !d.pic.runs) return h;
    if (size === 'm') return h + '<div class="inv-hero-sheet">' + prodDayLinesHtml(d.pic, true) + '</div>';
    return h + (d.viz ? '<div class="inv-widget-viz">' + d.viz + '</div>' : '') + (d.more || '');
  },
  foot: wdgHeroFoot });
/* Each working day's plating over the three lines, as production_days holds it (a line-day with no run is a gap), and the day's
   power cuts (power_cuts): the day's kilos where any run was weighed, and whether nine tenths of its pieces were (the usual day's
   rule: a day mostly unweighed reads low, so it is not judged light). The usual day is the one before today (prodUsualDay), so every
   day is judged on one basis. Once a book. */
function wcFlrDays() {
  return wdgMemo('flr-days', function() {
    var cuts = {};
    dvRows('power_cuts').forEach(function(c) {
      var x = cuts[c.date] || (cuts[c.date] = { n: 0, min: 0, open: 0 });
      x.n++;
      if (c.minutes != null) x.min += c.minutes; else x.open++;
    });
    var days = dvSum('production_days', 'date', { kg: 'sum', pieces: 'sum', pieces_unweighed: 'sum' }).map(function(g) {
      // A line-day that ran carries its pieces (0 where it plated kilos); one that did not is every measure null.
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
/* Plated each day: a calendar of the weeks (chartHeat, the one blue ramp; a day with no record hatched), Medium eight weeks and Large
   twelve, with how many days fell under a usual day (prodDayUnder, the day card's own judge) and how many of those had a cut; Large
   names the days under a usual day that were cut days. Today is drawn as to date and never judged. */
wdgDefine({ id: 'heat', title: 'Plated each day', q: 'Which days ran light, and why?', section: 'floor', sizes: ['l', 'm'],
  needs: { page: 'pageProduction' }, go: { tab: 'pageProduction', v: 'lines' }, card: 'plated-days',
  data: function(ctx) {
    var D = wcFlrDays(), today = localDateStr();
    if (!D.days.some(function(x) { return x.ran; })) return wcFlrBlank(ctx, { state: 'empty', title: 'No plating recorded yet', body: 'The register page, the barrel list and the pickling messages record what each line plates.',
      action: wcAct('Open Production', 'invWdgGo', ' data-wid="heat"') });
    var weeks = ctx.size === 'l' ? 12 : 8;
    // The days drawn: today with nothing recorded yet is not a gap (the day is not over), so it is left blank, as a day to come is.
    var drawn = D.days.filter(function(x) { return x.date < today || (x.date === today && x.ran); });
    // The calendar's first day: the Sunday that opens its first pay week, counted back from the week of the last day drawn, as
    // chartHeat counts its columns, so the days judged are the days on it.
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
    return { state: 'ok', tone: 'neutral', weeks: weeks, cells: cells, light: light, usual: D.usual, today: today,
      plated: shown.filter(function(x) { return x.ran; }).length, cutLight: light.filter(function(x) { return x.cut; }) };
  },
  draw: function(d, size) {
    var line, sub;
    if (d.usual == null) { line = todoPlural(d.plated, 'day') + ' plated in ' + d.weeks + ' weeks'; sub = 'No usual day yet to judge them by'; }
    else {
      line = d.light.length ? todoPlural(d.light.length, 'day') + ' under a usual day, ' + (d.cutLight.length ? d.cutLight.length + ' with a cut' : 'none with a cut')
        : 'No day under a usual day in ' + d.weeks + ' weeks';
      sub = 'A usual day ' + prodKgFig(d.usual, true) + ' · ' + d.weeks + ' weeks';
    }
    var heat = chartHeat(d.cells, { unit: 'kg', weeks: d.weeks, toDate: d.today, labelHead: 'Day', valueHead: 'Plated', ariaLabel: 'Plated each day, ' + d.weeks + ' weeks',
      emptyText: 'No plating in ' + d.weeks + ' weeks' });
    var h = '<div class="inv-widget-line">' + escHtml(line) + '</div><div class="inv-widget-sub">' + escHtml(sub) + '</div><div class="inv-widget-viz">' + heat + '</div>';
    if (size !== 'l' || !d.light.length) return h;
    // The days under a usual day that were cut days, the latest first; how many had no cut on record, one row.
    var rows = d.cutLight.slice().reverse().map(function(x) {
      return uiFactRowHtml({ label: attDayName(x.date) + ' ' + stockShortDate(x.date), value: prodKgFig(x.kg), tone: 'warning', sub: wcFlrCutWords(x.cut), attrs: ' data-wc-light="' + escHtml(x.date) + '"' });
    });
    var calm = d.light.length - d.cutLight.length;
    if (calm) rows.push(uiFactRowHtml({ label: 'Under a usual day, no cut on record', value: calm, attrs: ' data-wc-light-nocut' }));
    return h + '<div class="inv-widget-rows">' + rows.join('') + '</div>';
  } });
/* Line efficiency on the last day with plating (prodLineEfficiency, Floor's line cards' own figure and tone): Small the worst line's
   figure; Medium the three lines in their tones, each with what it plated of what its working units could; Large each line's factor
   that lost most (flrEffMoved, the card's own caption). */
wdgDefine({ id: 'eff', title: 'Line efficiency, now', q: 'Is each line plating what it can?', section: 'floor', sizes: ['m', 's', 'l'],
  needs: { page: 'pageProduction' }, go: { tab: 'pageProduction', v: 'lines' }, card: 'line-eff',
  data: function(ctx) {
    var day = homeLastPlatedDay();
    if (!day) return wcFlrBlank(ctx, { state: 'empty', title: 'No plating recorded yet', body: 'A line’s efficiency is read from what it plated on a day.',
      action: wcAct('Open Production', 'invWdgGo', ' data-wid="eff"') });
    var isToday = day === localDateStr();
    var lines = PROD_LINES.map(function(l, i) { return { l: l, i: i, ef: prodLineEfficiency(day, l) }; });
    if (!lines.some(function(x) { return x.ef.eff != null || x.ef.halfDown || x.ef.missing; })) {
      var whys = lines.filter(function(x) { return x.ef.ran && x.ef.why; }).map(function(x) { return x.ef.why; });
      if (whys.length && whys.every(function(w) { return /plant register|kg a round/.test(w); })) return wcFlrBlank(ctx, { state: 'notset', title: 'Set up the plant register',
        body: 'A line’s efficiency needs its tanks or barrels and their kg a round, on Production → Equipment.', action: wcAct('Open Equipment', 'invPltOpen') });
      return wcFlrBlank(ctx, { state: 'early', title: 'No line judged yet', body: whys.length ? 'Not judged: ' + whys[0] + '.' : 'A line is judged once it has run.' });
    }
    // Worst first, as Floor orders its line cards; on a tie the lower figure.
    var sorted = lines.slice().sort(function(a, b) {
      return (FLR_TONE_RANK[a.ef.tone] - FLR_TONE_RANK[b.ef.tone]) || ((a.ef.eff == null ? 9 : a.ef.eff) - (b.ef.eff == null ? 9 : b.ef.eff)) || a.i - b.i;
    });
    return { state: 'ok', tone: sorted[0].ef.tone, lines: lines, worst: sorted[0], day: day, isToday: isToday };
  },
  draw: function(d, size) {
    var w = d.worst.ef, unit = w.unitWord || 'unit', name = prodLineName(d.worst.l);
    var word = w.halfDown ? (w.n - w.nAvail) + ' of ' + w.n + ' ' + unit + 's down' : w.missing ? 'heads and no record' : '';
    var h = '<div class="inv-widget-fig">' + (w.eff != null ? escHtml(Math.round(w.eff * 100) + '%') : '&mdash;') + '</div>' +
      '<div class="inv-widget-line">' + escHtml(name + (word ? ' · ' + word : w.over ? ' · ' + wcFlrLc(w.word) : '')) + '</div>' +
      '<div class="inv-widget-sub">' + escHtml(wcFlrDayWord(d.day) + (d.isToday ? ' so far' : '')) + '</div>';
    if (size === 's') return h;
    var rows = d.lines.map(function(x) {
      var ef = x.ef, mv = size === 'l' && ef.eff != null ? flrEffMoved(ef) : null;
      var meta = ef.eff != null ? prodKgFig(ef.kg, ef.est, ef.unweighed > 0) + ' of ' + prodKgFig(ef.possible) : ef.missing ? 'heads on the general shift, no record'
        : ef.ran ? 'not judged: ' + (ef.why || 'a figure is missing') : d.isToday ? 'not running yet' : 'did not run';
      // Large: the factor that lost most (or raised it), where the register counted the rounds; a line with none is said once, under.
      var why = mv && ef.pace != null ? mv.title : '';
      var dot = ef.eff != null ? ef.word : ef.halfDown ? 'Half down' : ef.missing ? 'No record' : ef.ran ? 'Not judged' : d.isToday ? 'Not running yet' : 'Did not run';
      var meter = ef.eff != null && ef.possible > 0 ? chartMeter([{ v: Math.min(ef.kg, ef.possible * 1.2), tone: ef.tone === 'neutral' ? 'neutral' : ef.tone }],
        { max: ef.possible, mark: ef.possible * PROD_EFF_OK, title: prodKgFig(ef.kg, ef.est, ef.unweighed > 0) + ' of ' + prodKgFig(ef.possible) + ' (' + ef.word + '); the mark is three quarters' }) : '';
      // The meter runs under the words and the end, the row's whole width, so the three lines' meters line up.
      return '<div class="inv-row inv-row-2" data-wc-eff="' + escHtml(x.l) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(prodLineName(x.l)) + '</span>' +
        '<span class="inv-row-meta">' + escHtml(meta) + '</span>' + (why ? '<span class="inv-row-meta" data-wc-eff-moved>' + escHtml(why) + '</span>' : '') + '</span>' +
        uiRowEndHtml('', { tone: ef.tone, word: dot }) + meter + '</div>';
    });
    // Large: a line judged with no rounds counted has no factors to name (Floor's card shows it the working alone), said once.
    var bare = size === 'l' ? d.lines.filter(function(x) { return x.ef.eff != null && x.ef.pace == null; }) : [];
    var judged = d.lines.filter(function(x) { return x.ef.eff != null; }).length;
    var note = !bare.length ? '' : (bare.length === judged && judged > 1 ? 'No rounds counted' : bare.map(function(x) { return prodLineName(x.l); }).join(' and ') + ': no rounds counted') +
      ', so the time and the load are not told apart';
    return h + '<div class="inv-widget-rows">' + rows.join('') + '</div>' + (note ? '<div class="inv-note" data-wc-eff-bare>' + escHtml(note) + '</div>' : '');
  } });
/* The thunder hours today's forecast holds (wcThunderHours, over feeds.js's feedThunderToday): an array of hours 0–23, or null where
   there is no forecast; anything else is no forecast, and a call that throws is none either. */
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
/* Power cut risk by hour: the two hours the plant's cuts most often start in (powerRiskWindow over Cuts' own count by the hour they
   began), from 6 AM to 10 PM, and where today's forecast holds thunder (§9's feed) its hours beside it: two facts side by side, never
   a probability the book has not measured. The window is the record's; today's forecast is what changes it. */
wdgDefine({ id: 'risk', title: 'Power cut risk by hour', q: 'When is a cut likely today?', section: 'floor', sizes: ['s', 'm'],
  // Drawn again when a weather copy lands (feed), and every half hour while on screen.
  needs: { page: 'pagePower' }, go: { tab: 'pagePower', v: 'cuts' }, card: 'cut-risk', live: 1800, feed: true,
  data: function(ctx) {
    var a = wdgMemo('power-analysis', powerAnalysis);
    if (!a.cuts.length) return wcFlrBlank(ctx, { state: 'empty', title: 'No power cut recorded yet', body: 'The register’s power log, the pickling hand’s messages and Enter a cut record them.',
      action: wcAct('Open Cuts', 'invWdgGo', ' data-wid="risk"') });
    var win = powerRiskWindow(a.hours, 6, 22);
    if (!win) return { state: 'ok', tone: 'neutral', none: true, total: a.cuts.length };
    if (win.early) return wcFlrBlank(ctx, { state: 'early', title: 'Not enough yet: ' + win.inRange + ' of ' + POWER_RISK_MIN + ' cuts',
      body: 'The hours cuts most often start are named from ' + POWER_RISK_MIN + ' cuts on record between 6 AM and 10 PM.' });
    var thunder = wcFlrThunder(), inWin = thunder ? thunder.filter(function(h) { return h >= win.from && h < win.to; }) : [];
    // The spec's own reading (§7d, What's coming): thunder forecast in the hours the plant's cuts most often start.
    return { state: 'ok', tone: inWin.length ? 'warning' : 'neutral', win: win, hours: a.hours, thunder: thunder, inWin: inWin.length > 0 };
  },
  draw: function(d, size) {
    if (d.none) return '<div class="inv-widget-line">No cut began between 6 AM and 10 PM</div><div class="inv-widget-sub">' + escHtml(todoPlural(d.total, 'cut') + ' on record') + '</div>';
    var w = d.win, when = relayClockLabel(w.from * 60) + ' – ' + relayClockLabel(w.to * 60);
    var share = w.cuts + ' of ' + w.total + ' cuts began then', spans = d.thunder && d.thunder.length ? wcFlrSpanList(d.thunder) : [];
    // Small: where the forecast's thunder touches the window, its spans beside the window (the two facts); else the record's share.
    var touch = spans.filter(function(s) { return s.from < w.to && s.to > w.from; });
    var h = '<div class="inv-widget-fig">' + escHtml(when) + '</div><div class="inv-widget-line">' +
      escHtml(size === 's' && touch.length ? 'Thunder forecast ' + wcFlrSpans(touch) : share) + '</div>';
    if (size === 's') return h;
    // Medium: every span the forecast holds today, as the hours they are; the chart marks those hours.
    h += spans.length ? '<div class="inv-widget-sub">' + escHtml('Thunder forecast ' + wcFlrSpans(spans)) + '</div>' : '';
    // The share of the cuts on record that began in each hour, 6 AM to 10 PM (Cuts' "When they come" as shares); the forecast's
    // thunder hours a series of their own, in the warning tone.
    var hrs = [];
    for (var k = 6; k < 22; k++) hrs.push(k);
    var share1 = function(k) { return w.total ? Math.round((d.hours[k] || 0) / w.total * 1000) / 10 : 0; }, isT = function(k) { return d.thunder && d.thunder.indexOf(k) >= 0; };
    var series = [{ label: 'Cuts began', values: hrs.map(function(k) { return isT(k) ? 0 : share1(k); }), slot: 1 }];
    if (d.thunder && d.thunder.length) series.push({ label: 'In a thunder hour', values: hrs.map(function(k) { return isT(k) ? share1(k) : 0; }), tone: 'warning' });
    return h + '<div class="inv-widget-viz">' + chartStack(hrs.map(function(k) { return (k % 12 || 12) + (k < 12 ? 'a' : 'p'); }), series,
      { unit: 'pct', labelHead: 'Hour began', ariaLabel: 'The share of cuts that began in each hour, 6 AM to 10 PM', emptyText: 'No cut began between 6 AM and 10 PM' }) + '</div>';
  } });
/* The words for when to order a line: the pick's own (suppPickWhen), else why the app cannot say. */
function wcFlrOrderWhen(pk) {
  return suppPickWhen(pk) || (!pk || !pk.sp ? 'no supplier on record' : suppLeadText(pk.lead));
}
/* Stock days left: the line that runs out first and the day to order it by (stockStatus, suppReorderPick: the reorder list's own
   pick); Medium the five soonest as bars, red at 3 days and amber at 7 (Settings → Checks & alerts → Stock alerts, the mark the
   amber line); Large each with when to order, and the reorder's cash with GST, as Stock's card says it. A line charged into a bath
   (zinc) or with no daily use has no days left and is not drawn. */
wdgDefine({ id: 'stockdays', title: 'Stock days left', q: 'What runs out first?', section: 'floor', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageStock' }, go: { tab: 'pageStock', v: 'list' }, card: 'stock-low',
  data: function(ctx) {
    var items = stockData().items.filter(function(i) { return i.active !== false; });
    if (!items.length) return wcFlrBlank(ctx, { state: 'empty', title: 'No stock recorded yet', body: 'The supervisor’s stock message starts it, pasted on Stock.',
      action: wcAct('Open Stock', 'invWdgGo', ' data-wid="stockdays"') });
    var list = items.map(function(i) { var s = stockStatus(i); return { item: i, s: s, days: suppDaysLeft(i, s) }; })
      .filter(function(x) { return x.days != null; })
      .sort(function(a, b) { return a.days - b.days || (a.item.name < b.item.name ? -1 : a.item.name > b.item.name ? 1 : 0); });
    if (!list.length) return wcFlrBlank(ctx, { state: 'early', title: 'No daily use on record yet', body: 'A line’s days left are its level over its daily use, read from the use on record.' });
    // Rows the size holds: the bars are one chart, so its rows are counted here (a phone's Large has a phone's room).
    var shown = list.slice(0, ctx.size === 'l' ? (_isDesktop ? 6 : 4) : ctx.size === 'm' ? 5 : 1);
    shown.forEach(function(x) { x.pick = suppReorderPick(x.item, x.days); });
    return { state: 'ok', tone: STOCK_TONE[list[0].s.tone] || 'neutral', list: list, shown: shown, L: ctx.size === 'l' ? stockReorderList() : null };
  },
  draw: function(d, size) {
    var cfg = stockCfg(), daysOf = function(x) { return x.s.group === 'out' ? 'Out' : stockDaysText(x.days, x.s.rate && x.s.rate.tentative); };
    var f = d.shown[0];
    var h = '<div class="inv-widget-fig">' + escHtml(daysOf(f)) + '</div><div class="inv-widget-line">' + escHtml(f.item.name) + '</div>' +
      '<div class="inv-widget-sub">' + escHtml(wcFlrOrderWhen(f.pick)) + '</div>';
    if (size === 's') return h;
    // The bars run to the reorder list's horizon (its lead time and the days it covers): a line past it needs no order.
    var R = stockReorderCfg(), max = R.leadDays + R.coverDays;
    var bars = chartRankedBars(d.shown.map(function(x) {
      var t = STOCK_TONE[x.s.tone];
      return { label: x.item.name, value: x.days, display: daysOf(x) + (x.s.group === 'out' ? '' : ' left'), tone: t === 'danger' || t === 'warning' ? t : 'good',
        markPct: cfg.amberDays / max * 100, sub: size === 'l' ? wcFlrOrderWhen(x.pick) : '' };
    }), { unit: 'count', max: max, labelHead: 'Line', valueHead: 'Days left', emptyText: 'No line has a daily use yet' });
    h += '<div class="inv-widget-viz">' + bars + '</div><div class="inv-note">' + escHtml('Red at ' + cfg.redDays + ' days or fewer, amber at ' + cfg.amberDays + ' (the mark)') + '</div>';
    if (size !== 'l' || !d.L) return h;
    var L = d.L;
    return h + '<div class="inv-widget-rows">' + uiFactRowHtml({ label: 'The reorder list, with GST', value: L.withGst > 0 ? formatCurrency(L.withGst) : '', attrs: ' data-wc-reorder',
      sub: L.withGst > 0 ? (L.unpriced ? todoPlural(L.unpriced, 'line') + ' without a price' : 'at the last prices') : 'nothing to order now' }) + '</div>';
  } });
/* A sum over or under the market, its sign said (Spend and prices' own way). */
function wcFlrZincOver(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + formatCurrency(Math.abs(v)); }
var WC_FLR_ZINC_RANGE = { '3M': 'Three months', '6M': 'Six months', FY: 'This financial year', ALL: 'Every bill' };
/* Zinc against the market (zincTrend, over the range Stock → Spend and prices shows): Medium what the bills paid over the market,
   weighted by their kilos (dashZincPaidOver), the market now against the last bill and the market's line with the last bill dashed
   beside it; Large each supplier over the market (dashZincSupStatus: Spend and prices' own words). Money's. */
wdgDefine({ id: 'zincpaid', title: 'Zinc against the market', q: 'Did we buy well, and from whom?', section: 'floor', sizes: ['m', 'l'],
  needs: { page: 'pageStock', money: true }, card: 'zinc-paid',
  go: function() { dashZincShow(); },
  data: function(ctx) {
    var range = typeof _dashZincRange === 'string' ? _dashZincRange : '6M', T = zincTrend(_dashZincFrom(range));
    if (!T.item || !T.lastBill) return wcFlrBlank(ctx, { state: 'empty', title: 'No zinc bill recorded yet', body: 'A zinc delivery recorded with its bill, on Stock, is set against the market on its day.',
      action: wcAct('Open Stock', 'invWdgGo', ' data-wid="zincpaid"') });
    if (!T.now) return wcFlrBlank(ctx, { state: 'notset', title: 'No market rate kept yet', body: 'Each refresh of the zinc rate is kept as the market for its day.',
      action: getMetalsKey() ? wcAct('Refresh', 'invRefreshZinc') : wcAct('Set the zinc rate', 'invOpenSettings', ' data-sec="zinc"') });
    var po = dashZincPaidOver(T);
    return { state: 'ok', tone: po.over == null ? 'neutral' : po.over > 0 ? 'info' : 'ok', T: T, po: po, range: range };
  },
  draw: function(d, size) {
    var T = d.T, po = d.po, last = T.lastBill, unit = (T.item && T.item.unit) || 'kg';
    var line = po.over == null ? 'No bill set against the market yet' : po.over > 0 ? 'Paid ' + formatCurrency(po.over) + ' a ' + unit + ' over the market'
      : po.over < 0 ? 'Paid ' + formatCurrency(-po.over) + ' a ' + unit + ' under the market' : 'Paid the market rate';
    var h = '<div class="inv-widget-line">' + escHtml(line) + '</div><div class="inv-widget-sub">' + escHtml((WC_FLR_ZINC_RANGE[d.range] || 'Six months') + ' · ' +
      todoPlural(po.set.length, 'bill') + ' set against it') + '</div>';
    // The market's last refreshes in the range, landed, with the last bill's price dashed beside them.
    var mk = T.market.slice(-30);
    var spark = mk.length >= 2 ? chartSpark(mk.map(function(m) { return m.landed; }), { ref: mk.map(function() { return last.e.price; }), unit: 'rate',
      title: 'The market, landed, at each refresh from ' + stockShortDate(mk[0].date) + '; dashed, the last bill at ' + formatCurrency(last.e.price) }) : '';
    h += (spark ? '<div class="inv-widget-viz">' + spark + '</div>' : '') + '<div class="inv-tiles">' +
      uiFactorTileHtml({ label: 'Market now, landed', fig: escHtml(formatCurrency(T.now.landed)), sub: 'LME of ' + stockShortDate(T.now.date) }) +
      uiFactorTileHtml({ label: 'Last bill', fig: escHtml(formatCurrency(last.e.price)), sub: stockShortDate(last.date) + (last.e.supplier ? ' · ' + last.e.supplier : '') }) + '</div>';
    if (size !== 'l' || !T.suppliers.length) return h;
    var standing = dashZincSupStatus(T);
    return h + '<div class="inv-widget-rows">' + T.suppliers.map(function(s) {
      var st = standing(s);
      return '<div class="inv-row inv-row-2" data-wc-zinc-supplier><span class="inv-row-main"><span class="inv-row-title">' + escHtml(s.name) + '</span>' +
        '<span class="inv-row-meta">' + escHtml(todoPlural(s.n, 'bill') + ' · ' + stockFmtQty(s.kg) + ' ' + unit) + '</span></span>' +
        uiRowEndHtml(s.over != null ? escHtml(wcFlrZincOver(s.over)) : '', st ? { tone: st[0], word: st[1] } : { tone: 'info', word: 'No market' }) + '</div>';
    }).join('') + '</div>';
  } });

/* ---------- People ---------- */
wdgDefine({ id: 'atttoday', title: 'Attendance today', q: 'Is the crew in?', section: 'people', sizes: ['s', 'm'],
  needs: { page: 'pageStaff' }, go: { tab: 'pageStaff', v: 'day' },
  data: function() {
    var o = attHomeOpts();
    if (!o) return { state: 'empty', title: 'No roster yet', body: 'People → Roster holds the crew; a day is marked against it.',
      action: wcAct('Open the roster', 'invWdgGo', ' data-wid="atttoday"'), attrs: ' data-card="attendance"' };
    return wdgFromHero(o);
  },
  draw: wdgHeroDraw, foot: wdgHeroFoot });
/* U2d · People: attweek, ot (§7d), each after this line in the table's order. */
/* Attendance by pay week (dashAttendanceByWeek, Attendance → Week's own chart): the share present of the marks typed, a week nobody
   typed a gap, the week running drawn as to date. The latest week with marks is the figure, judged at the rest-day gate's 90% and
   80% as a day on site is (attOnSiteTone's figTonePct). Medium eight weeks, Large twenty-six. */
wdgDefine({ id: 'attweek', title: 'Attendance by week', q: 'Is the crew turning up?', section: 'people', sizes: ['m', 'l'],
  needs: { page: 'pageStaff' }, go: { tab: 'pageStaff', v: 'week' }, card: 'att-weeks',
  data: function(ctx) {
    var n = ctx.size === 'l' ? 26 : 8, weeks = dashAttendanceByWeek(n), known = weeks.filter(function(w) { return w.pct != null; });
    if (!known.length) return wcFlrBlank(ctx, { state: 'empty', title: 'No attendance in ' + n + ' weeks', body: 'A day is marked on People → Attendance, or read from the supervisor’s rolls.',
      action: wcAct('Open Attendance', 'invWdgGo', ' data-wid="attweek"') });
    if (known.length < 2) return wcFlrBlank(ctx, { state: 'early', title: 'Not enough yet: one pay week recorded', body: 'A trend needs two pay weeks with attendance.' });
    var last = known[known.length - 1], prev = known[known.length - 2];
    return { state: 'ok', tone: figTonePct(last.pct, 90, 80) || 'neutral', weeks: weeks, last: last, prev: prev, running: last.sat >= localDateStr(), n: n };
  },
  draw: function(d) {
    var pct = function(v) { return formatNum(v, 1) + '%'; }, weeks = d.weeks;
    var chart = chartLines(weeks.map(function(w) { return stockShortDate(w.sat); }),
      [{ label: 'Present', values: weeks.map(function(w) { return w.pct == null ? null : Math.round(w.pct * 10) / 10; }) }],
      // The pay week running is drawn as to date (TM6b): a Wednesday's week is not a poor week.
      { unit: 'pct', labelHead: 'Week to', ariaLabel: 'Attendance by week, ' + d.n + ' weeks', emptyText: 'Needs two pay weeks with attendance recorded',
        // Twenty-six weeks are named every sixth, so the last named week never runs into the week to date.
        maxLabels: d.n > 13 ? 5 : undefined,
        toDate: weeks.length && weeks[weeks.length - 1].sat >= localDateStr() ? weeks.length - 1 : null });
    return '<div class="inv-widget-fig">' + escHtml(pct(d.last.pct)) + '</div>' +
      '<div class="inv-widget-line">' + escHtml(d.running ? 'Present this week so far' : 'Present, the week to ' + stockShortDate(d.last.sat)) + '</div>' +
      '<div class="inv-widget-sub">' + escHtml(pct(d.prev.pct) + ' the week to ' + stockShortDate(d.prev.sat)) + '</div>' +
      '<div class="inv-widget-viz">' + chart + '</div>';
  } });
/* Overtime by area over the four pay weeks to today (areaHoursForRange, Areas' own Hours by area: each mark's overtime where it was
   worked, by attHoursSplit, and the EXTRA booked to the area): Medium the overtime by area as bars; Large the EXTRA beside it, one
   scale for both. Hours for every role that opens People; the rupees (labourForRange, the labour card's own) only for one that sees
   wages. */
function wcPplOtBars(rows, key, max, head) {
  return chartRankedBars(rows.map(function(r) { return { label: r.label, value: Math.round(r[key] * 10) / 10, display: wcFlrHours(r[key]) + ' h' }; }),
    { unit: 'h', max: max, labelHead: 'Area', valueHead: head, emptyText: 'None in four weeks' });
}
wdgDefine({ id: 'ot', title: 'Overtime by area', q: 'Where are the extra hours going?', section: 'people', sizes: ['m', 'l'],
  needs: { page: 'pageStaff' }, go: { tab: 'pageStaff', v: 'areas' }, card: 'ot-areas',
  data: function(ctx) {
    var today = localDateStr(), from = isoAddDays(attWeekStartOf(today), -21), ah = areaHoursForRange(from, today);
    if (!ah.rows.length) return wcFlrBlank(ctx, { state: 'empty', title: 'No attendance in four weeks', body: 'A day is marked on People → Attendance, or read from the supervisor’s rolls.',
      action: wcAct('Open Attendance', 'invSwitchTab', ' data-tab="pageStaff" data-v="day"') });
    var ot = ah.rows.reduce(function(s, r) { return s + r.ot; }, 0), extra = ah.rows.reduce(function(s, r) { return s + r.extra; }, 0);
    return { state: 'ok', tone: 'neutral', rows: ah.rows, ot: ot, extra: extra, from: from, lab: grdSeesWages() ? labourForRange(from, today) : null };
  },
  draw: function(d, size) {
    var byOt = d.rows.filter(function(r) { return r.ot > 0.05; }).sort(function(a, b) { return b.ot - a.ot; });
    var byEx = d.rows.filter(function(r) { return r.extra > 0.05; }).sort(function(a, b) { return b.extra - a.extra; });
    var line = byOt.length ? 'Overtime in four weeks, most in ' + byOt[0].label : 'No overtime in four weeks';
    var sub = d.lab ? formatCurrency(d.lab.ot) + ' overtime · ' + formatCurrency(d.lab.extra) + ' EXTRA' : 'EXTRA ' + wcFlrHours(d.extra) + ' h · from ' + stockShortDate(d.from);
    var h = '<div class="inv-widget-fig">' + escHtml(wcFlrHours(d.ot) + ' h') + '</div><div class="inv-widget-line">' + escHtml(line) + '</div>' +
      '<div class="inv-widget-sub">' + escHtml(sub) + '</div>';
    var n = size === 'l' ? 6 : 5, M = Math.max.apply(null, byOt.concat(byEx).map(function(r) { return Math.max(r.ot, r.extra); }).concat([0]));
    if (size !== 'l') return h + (byOt.length ? '<div class="inv-widget-viz">' + wcPplOtBars(byOt.slice(0, n), 'ot', null, 'Overtime') + '</div>' : '');
    // The EXTRA beside the overtime, on one scale, so a bar reads the same in both; each part under its caption (inv-widget-cap).
    return h + '<div class="inv-widget-parts inv-widget-viz">' +
      '<div class="inv-widget-part"><p class="inv-widget-cap">' + escHtml('Overtime · ' + wcFlrHours(d.ot) + ' h') + '</p>' + wcPplOtBars(byOt.slice(0, n), 'ot', M, 'Overtime') + '</div>' +
      '<div class="inv-widget-part"><p class="inv-widget-cap">' + escHtml('EXTRA booked · ' + wcFlrHours(d.extra) + ' h') + '</p>' + wcPplOtBars(byEx.slice(0, n), 'extra', M, 'EXTRA') + '</div></div>';
  } });

/* ---------- Market and the world outside (§9) ---------- */
/* U2d · Market: tata, weather (§7d), each after this line, reading feeds.js. */
/* What a feed says when it has no copy to show (feeds.js: a state and its blank {kind, title, body, action}), as the widget's one
   blank state. */
function wcFeedBlank(r, attrs) {
  var b = (r && r.blank) || {};
  return { state: r && r.state && r.state !== 'ok' ? r.state : 'empty', title: b.title || '', body: b.body || '', action: b.action || '', attrs: attrs || '' };
}
/* A feed widget's foot: how old its copy is (the Worker's last copy, no signal), its credit linked as its licence asks, Refresh. */
function wcFeedFoot(kind, r) {
  var cr = typeof FEED_CREDIT !== 'undefined' ? FEED_CREDIT[kind] : null;
  var age = r && r.ago ? escHtml(r.ago) + (r.stale ? ' · the Worker’s last copy' : '') + (r.offline ? ' · offline' : '') : '';
  return '<span class="inv-note inv-widget-credit" data-feed-age="' + kind + '">' + (age ? age + ' · ' : '') +
    (cr ? '<a class="inv-btn-link" href="' + escHtml(cr.url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(cr.name) + '</a>' : '') + '</span>' +
    '<button type="button" class="inv-btn inv-btn-link inv-btn-sm" data-action="invFeedRefresh" data-kind="' + kind + '"' + (r && r.busy ? ' disabled' : '') + '>' +
    (r && r.busy ? 'Fetching…' : 'Refresh') + '</button>';
}
/* The seam the risk widget reads (§7d `risk`): today's hours the forecast holds thunder in, 0 to 23, or null with no forecast to
   read (a feed not set up, offline, not fetched yet). */
function wcThunderHours() {
  if (typeof feedThunderToday !== 'function') return null;
  var t = feedThunderToday();
  return t && t.state === 'ok' && Array.isArray(t.hours) ? t.hours.slice() : null;
}
function wcCap(s) { s = String(s || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* The weather at the plant (§9, MET Norway through the feeds Worker): now and today's window of rain or thunder still to come; from
   Medium the next 12 hours, and once 30 days are kept the cut days that had rain, as forecast that day. Coded by what is coming
   today: thunder a warning (a storm brings cuts), rain info, a dry rest of the day ok. */
function wcWxHoursHtml(hours) {
  return '<div class="inv-wx-hours" role="list" aria-label="The next 12 hours">' + hours.map(function(h) {
    var tone = h.thunder ? 'warning' : h.wet ? 'info' : '';
    var said = h.time + ': ' + [h.word, h.tempText, h.rain > 0 ? formatNum(h.rain, 1) + ' mm' : ''].filter(Boolean).join(', ');
    return '<div class="inv-wx-hour" role="listitem"' + (tone ? ' data-tone="' + tone + '"' : '') + ' title="' + escHtml(said) + '" aria-label="' + escHtml(said) + '">' +
      '<span class="inv-wx-hour-t">' + escHtml(h.time) + '</span>' + iconSvg(h.icon, 'inv-wx-ico') + '<span class="inv-wx-hour-c">' + escHtml(h.tempText) + '</span></div>';
  }).join('') + '</div>';
}
wdgDefine({ id: 'weather', title: 'Weather at the plant', q: 'Will a storm bring a power cut?', section: 'market', sizes: ['s', 'm'],
  go: { tab: 'pagePower', v: 'causes' }, card: 'weather', feed: true,
  data: function() {
    var w = feedWeather();
    if (w.state !== 'ok') return wcFeedBlank(w);
    var t = w.today || {}, ahead = t.windows || [];
    var th = ahead.filter(function(x) { return x.kind === 'thunder'; })[0], rain = ahead.filter(function(x) { return x.kind === 'rain'; })[0];
    var range = t.tMax != null && t.tMin != null ? Math.round(t.tMin) + '°–' + Math.round(t.tMax) + '° today' : '';
    return { state: 'ok', tone: th ? 'warning' : rain ? 'info' : 'ok', w: w,
      line: th ? wcCap(th.say) + ' today' : rain ? wcCap(rain.say) + ' today' : 'No rain forecast for the rest of today',
      sub: [w.now.word ? w.now.word + ' now' : '', range].filter(Boolean).join(' · '), cut: feedWeatherCutDays() };
  },
  draw: function(d, size) {
    var w = d.w;
    var h = '<div class="inv-widget-fig inv-wx-fig">' + iconSvg(w.now.icon, 'inv-wx-ico') + '<span>' + escHtml(w.now.tempText) + '</span></div>' +
      '<div class="inv-widget-line" data-wx-line>' + escHtml(d.line) + '</div>';
    if (size === 's') return h;
    if (d.sub) h += '<div class="inv-widget-sub">' + escHtml(d.sub) + '</div>';
    if (w.hours.length) h += '<div class="inv-widget-viz">' + wcWxHoursHtml(w.hours) + '</div>';
    // Once 30 days are kept, the cut days beside the days rain was forecast: two counts side by side, never a cause (§9d).
    h += d.cut.state === 'ok' ? '<div class="inv-widget-rows">' + uiFactRowHtml({ label: 'Cut days and rain', sub: d.cut.say, value: d.cut.wetCutDays + ' of ' + d.cut.cutDays, attrs: ' data-wx-cutdays' }) + '</div>'
      : '<div class="inv-widget-sub" data-wx-cutdays>' + escHtml('The cut days against rain from ' + d.cut.need + ' days kept: ' + d.cut.kept + ' so far') + '</div>';
    return h;
  },
  foot: function(d, size) { return size === 's' ? '' : wcFeedFoot('weather', d.w); } });

/* Tata Motors, Jamshedpur (§9c): the latest month typed from its release, heavy trucks, exports and all CVs with their change on last
   year, and the plant's week; at Large the months this year against last, the models followed and four headlines (GDELT). Its head
   opens the Tata dialog, where a month is typed (the settings permission's) and every headline read. Up is ok (more trucks built is
   more work for the clients who plate for them), down a warning. */
var WC_TATA_FIGS = ['hcv', 'cvExport', 'cvTotal'];
function wcTataFigs(L) {
  var by = {};
  (L.figs || []).forEach(function(f) { by[f.key] = f; });
  return WC_TATA_FIGS.map(function(k) { return by[k]; }).filter(function(f) { return f && f.now != null; });
}
function wcTataChart() {
  var pick = ['hcv', 'cvTotal'].map(function(k) { var m = mktTataMonths(k, 13); return { k: k, m: m, n: m.rows.filter(function(r) { return r.now != null; }).length }; })
    .sort(function(a, b) { return b.n - a.n; })[0];
  if (!pick || pick.n < 2) return '';
  var m = pick.m;
  return '<p class="inv-widget-cap">' + escHtml(m.label + ', month by month') + '</p>' +
    chartLines(m.rows.map(function(r) { return r.label; }), [
      { label: 'This year', values: m.rows.map(function(r) { return r.now; }), slot: 1 },
      { label: 'A year before', values: m.rows.map(function(r) { return r.ly; }), slot: 'other', dashed: true }],
    { unit: 'count', fit: true, labelHead: 'Month', ariaLabel: m.label + ' each month, this year against the year before', keys: m.rows.map(function(r) { return r.month; }) });
}
wdgDefine({ id: 'tata', title: 'Tata Motors, Jamshedpur', q: 'How is the demand our clients build for?', section: 'market', sizes: ['l', 'm'],
  go: function() { mktTataOpen(); }, card: 'tata', feed: true,
  act: function(action, btn) {
    if (action !== 'invWdgTataModel') return false;
    mktTataOpen();
    if (typeof _mktDlg === 'object' && _mktDlg) { _mktDlg.model = btn.dataset.model || ''; mktPartRedraw('news'); }
    return true;
  },
  data: function(ctx) {
    var L = mktTataLatest(), figs = L.state === 'ok' ? wcTataFigs(L) : [], large = ctx.size === 'l';
    var news = large ? feedNews({ n: 4 }) : null;
    if (!figs.length && !(news && news.state === 'ok')) {
      return { state: 'empty', title: L.due ? mktMonthName(L.due) + '’s figures are not typed yet' : 'No month of Tata’s figures yet',
        body: 'Each month Tata Motors’ release prints its CVs: all of them, those sold in India, exports and heavy trucks.',
        action: mktCanEdit() ? wcAct('Type them', 'invWdgGo', ' data-wid="tata"') : feedDoorHtml('guide') };
    }
    var rank = { warning: 2, ok: 1, neutral: 0 }, tone = figs.reduce(function(t, f) { return (rank[f.tone] || 0) > (rank[t] || 0) ? f.tone : t; }, 'neutral');
    return { state: 'ok', tone: figs.length ? tone : 'neutral', L: L, figs: figs, news: news, week: mktPlantWeek() };
  },
  draw: function(d, size) {
    var L = d.L, lead = d.figs[0], h = '';
    if (lead) {
      // The lead figure says its own change (the card is coded by the worst of the three); the other two are tiles under it.
      h += '<div class="inv-widget-fig">' + figHtml(escHtml(mktFmt(lead.now)), lead.tone === 'ok' || lead.tone === 'warning' ? lead.tone : null) + '</div>' +
        '<div class="inv-widget-line">' + escHtml(lead.label + ' in ' + L.label) + '</div>' +
        '<div class="inv-widget-sub">' + escHtml([lead.say || 'no figure for the year before', L.due && L.due !== L.month ? mktMonthName(L.due) + '’s figures are due' : ''].filter(Boolean).join(' · ')) + '</div>';
    } else {
      h += '<div class="inv-widget-line">' + escHtml(L.due ? mktMonthName(L.due) + '’s figures are not typed yet' : 'No month of Tata’s figures yet') + '</div>';
    }
    var rest = d.figs.slice(1);
    var tiles = rest.length ? '<div class="inv-tiles inv-tiles-flush" data-tata-figs>' + rest.map(function(f) {
      return uiFactorTileHtml({ label: f.label, fig: escHtml(mktFmt(f.now)), sub: f.say || 'no year before', tone: f.tone === 'neutral' ? '' : f.tone });
    }).join('') + '</div>' : '';
    var week = '<div class="inv-widget-viz"><p class="inv-widget-cap">The plant’s week</p>' + mktWeekHtml(d.week) + '</div>';
    if (size !== 'l') return h + tiles + week;
    var n = d.news;
    var heads = n && n.state === 'ok' ? '<div class="inv-widget-rows" data-tata-news>' + n.items.map(feedNewsItemHtml).join('') + '</div>'
      : uiBlankHtml(Object.assign({ small: true }, (n && n.blank) || { kind: 'empty', title: 'No headlines yet' }));
    // The phone's Large is Medium's width and height: the headlines take the week's place (the week only where the calendar names a
    // day in it), and the months' chart and the models' chips are the Tata dialog's.
    if (!_isDesktop) return h + tiles + (d.week.entries ? week : '') + '<p class="inv-widget-cap">The headlines</p>' + heads;
    var chips = n && n.models && n.models.length ? '<div class="inv-mkt-chips" data-tata-models>' + n.models.map(function(m) {
      return '<button type="button" class="inv-chip" data-action="invWdgTataModel" data-wid="tata" data-model="' + escHtml(m.word) + '">' + escHtml(m.word) +
        ' <span class="inv-panel-count">' + m.n + '</span></button>';
    }).join('') + '</div>' : '';
    var chart = wcTataChart();
    return h + '<div class="inv-widget-parts inv-widget-parts-3' + (chart ? '' : ' inv-widget-parts-2') + '">' +
      '<div class="inv-widget-part">' + tiles + week + '</div>' +
      (chart ? '<div class="inv-widget-part">' + chart + '</div>' : '') +
      '<div class="inv-widget-part"><p class="inv-widget-cap">The headlines</p>' + chips + heads + '</div></div>';
  },
  foot: function(d, size) { return size === 'l' && d.news && d.news.state !== 'notset' ? wcFeedFoot('news', d.news) : ''; } });

/* ---------- Analysis ---------- */
/* U2d · Analysis: corr, clientprice, kilo (§7d), each after this line in the table's order. */
/* Does one move the other (§7d `corr`): two figures of the daily view (§6, dataview.js), each day both are known over the last 26
   weeks, at the coarser grain of the two (a week: minutes and hours summed, the rest averaged), their dots, the least-squares line
   and its words. Under 10 points it is early. The pair is the person's, kept with the layout (wdgOpts). A pattern, not proof. */
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
/* The two pickers, in the card (the desktop's Large) or in the pair's dialog (every other size, and the phone, where the card has no
   room for them beside its chart). */
function wcCorrPicksHtml(p) {
  var sel = function(k, list, on) {
    return '<label class="inv-field inv-corr-pick"><span class="inv-field-label">' + (k === 'x' ? 'Across' : 'Up') + '</span><select class="inv-select" data-corr="' + k + '" aria-label="' +
      (k === 'x' ? 'The figure across' : 'The figure up') + '">' + list.map(function(c) {
        return '<option value="' + escHtml(c.name) + '"' + (c.name === on.name ? ' selected' : '') + '>' + escHtml(c.label) + '</option>';
      }).join('') + '</select></label>';
  };
  // Each pick is kept as it is made: nothing typed waits to be saved (data-nodirty), in a dialog or on the page.
  return '<div class="inv-corr-picks" data-corr-picks data-nodirty>' + sel('x', p.across, p.x) + sel('y', p.up, p.y) + '</div>';
}
wdgDefine({ id: 'corr', title: 'Does one move the other?', q: 'Pick two figures; see if they travel together.', section: 'analysis', sizes: ['l', 'm'],
  card: 'corr',
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
    if (card && card.isConnected) wdgRedrawOne(card);
    return true;
  },
  data: function(ctx) {
    var p = wcCorrPair(ctx.opts);
    if (!p.x || !p.y) return { state: 'empty', title: 'No two figures to set side by side yet' };
    var rd = wcCorrRead(p.x, p.y), inline = _isDesktop && ctx.size === 'l';
    var base = { p: p, rd: rd, inline: inline };
    if (rd.pts.length < WC_CORR_MIN) {
      // Early still draws the card with its pickers (or the pair's door), so another pair can be tried.
      return Object.assign(base, { state: 'ok', tone: 'neutral', early: true,
        title: 'Not enough yet: ' + rd.pts.length + ' of ' + WC_CORR_MIN + ' ' + (rd.weekly ? 'weeks' : 'days') + ' with both' });
    }
    return Object.assign(base, { state: 'ok', tone: 'neutral', words: wcCorrWords(p.x, p.y, rd) });
  },
  draw: function(d, size) {
    var p = d.p, rd = d.rd, h = '';
    if (d.early) h += uiBlankHtml({ kind: 'early', small: true, title: d.title });
    else h += '<div class="inv-widget-line" data-corr-line>' + escHtml(d.words.line) + '</div>' +
      '<div class="inv-widget-sub">' + escHtml([d.words.sub, 'a pattern, not proof it is the cause'].filter(Boolean).join(' · ')) + '</div>';
    if (d.inline) h += wcCorrPicksHtml(p);
    else h += '<div class="inv-widget-sub" data-corr-pair>' + escHtml(p.x.label + ' across, ' + p.y.label.toLowerCase() + ' up') + '</div>';
    if (!d.early) {
      h += '<div class="inv-widget-viz">' + chartScatter([{ key: 'pair', label: p.x.label + ' and ' + p.y.label, points: rd.pts, slot: 1 }], {
        xUnit: WC_CORR_UNIT[p.x.unit] || 'count', yUnit: WC_CORR_UNIT[p.y.unit] || 'count', xLabel: p.x.label, yLabel: p.y.label, fit: true,
        pointHead: rd.weekly ? 'Week' : 'Day', ariaLabel: p.x.label + ' against ' + p.y.label }) + '</div>';
    }
    if (size === 'l' && !d.early) {
      var f = rd.fit;
      h += uiWorkingHtml('corr-working', [
        { label: 'Read', sub: rd.weekly ? 'by pay week, one of the two is weekly' : 'by working day', value: rd.pts.length + (rd.weekly ? ' weeks' : ' days') },
        { label: 'From', sub: 'the last 26 weeks', value: stockShortDate(rd.from) },
        { label: 'r', sub: 'how close the dots are to a line, −1 to 1', value: f && f.r != null ? (f.r < 0 ? '−' : '') + formatNum(Math.abs(f.r), 2) : '—' },
        { label: 'Strong from 0.7', sub: 'moderate from 0.4, weak from 0.2', value: d.words.word }]);
    }
    return h;
  },
  foot: function(d) {
    return d.inline ? '' : '<button type="button" class="inv-btn inv-btn-link inv-btn-sm" data-action="invWdgCorrPair" data-wid="corr">Change the pair</button>';
  } });

/* What each client pays a kilo (§7d `clientprice`): the period's clients, worst first, each against the full cost (the mark) and the
   variable cost (labour is fixed: everything but labour, statsClientMargins). Coded by the large accounts (10% of the tonnes or
   more) under the cost, as Stats' By client is. Medium six, Large every client ranked, its share of the tonnes under it. */
wdgDefine({ id: 'clientprice', title: 'What each client pays a kilo', q: 'Who clears the cost, who does not?', section: 'analysis', sizes: ['l', 'm'],
  needs: { page: 'pageStats', money: true }, go: { tab: 'pageStats', v: 'clients' }, card: 'clientprice',
  data: function(ctx) {
    var a = wcPulseArgs(ctx.period), m = wdgMemo('margins:' + ctx.period, function() { return statsClientMargins(ctx.period, a.filtered, a.tonnage); });
    if (!m || !m.ranked.length) return { state: 'empty', title: 'No weighed tonnage in this period', body: 'A client’s price a kilo needs its invoices weighed: Parts holds the weights.' };
    var large = function(x) { return x.kg >= m.kg * 0.1; }, rank = { danger: 3, warning: 2, ok: 1 };
    var tone = m.ranked.filter(large).reduce(function(t, x) { var k = figToneAgainst(x.net, m.fullKg, 5) || 'ok'; return (rank[k] || 0) > (rank[t] || 0) ? k : t; }, 'ok');
    var below = m.ranked.filter(function(x) { return x.net < m.fullKg - 0.005; });
    return { state: 'ok', tone: tone, m: m, below: below, worst: m.ranked.filter(large)[0] || null };
  },
  draw: function(d) {
    // Every client, worst first: the card keeps the rows its size holds and says how many more (wdgFit).
    var m = d.m, list = m.ranked, w = d.worst;
    var max = Math.max(m.fullKg * 1.2, Math.max.apply(null, list.map(function(x) { return x.net; })));
    var barTone = function(x) { var t = figToneAgainst(x.net, m.fullKg, 5); return t && t !== 'ok' ? t : 'good'; };
    var h = '<div class="inv-widget-fig">' + d.below.length + '<span class="inv-tile-of"> of ' + m.ranked.length + '</span></div>' +
      '<div class="inv-widget-line">' + escHtml((d.below.length ? 'Below' : 'None below') + ' the full cost of ' + formatCurrency(m.fullKg) + '/kg') + '</div>' +
      '<div class="inv-widget-sub">' + escHtml('Variable ' + formatCurrency(m.varKg) + '/kg, labour fixed' +
        (w && w.net < m.fullKg ? ' · the worst large account ' + w.name + ' at ' + formatCurrency(w.net) + '/kg' : '')) + '</div>';
    h += '<div class="inv-widget-viz">' + chartRankedBars(list.map(function(x) {
      return { label: x.name, value: x.net, display: formatCurrency(x.net) + '/kg', tone: barTone(x), markPct: m.fullKg / max * 100,
        sub: Math.round(x.kg / m.kg * 100) + '% of the tonnes · ' + (x.vsVar >= 0 ? '+' : '−') + formatCurrency(Math.abs(x.vsVar)) + ' on the variable cost',
        action: 'invStatsClientDrill', clientId: x.id };
    }), { unit: 'rate', max: max, labelHead: 'Client', valueHead: '₹ a kilo', ariaLabel: 'What each client pays a kilo against the full cost' }) + '</div>';
    if (m.apart.length) h += '<div class="inv-widget-sub">' + escHtml(m.apart.length + ' not ranked: under 90% of revenue weighed') + '</div>';
    return h;
  } });

/* Where a kilo's cost goes (§7d `kilo`): the period's live cost a kilo and how much of it is measured; from Medium its parts as one
   bar of 100% (chartShareBar; a part's colour its own on every cost chart, seriesSlot 'cost'); at Large each part's ₹ a kilo, its share and its
   source. Coded by the share measured, as Stats' Cost is. */
var WC_KILO_TONE = function(share) { return share >= 0.9 ? 'ok' : share >= 0.5 ? 'warning' : 'danger'; };
wdgDefine({ id: 'kilo', title: 'Where a kilo’s cost goes', q: 'Which part of the cost is moving?', section: 'analysis', sizes: ['m', 's', 'l'],
  needs: { page: 'pageStats', money: true }, go: { tab: 'pageStats', v: 'cost' }, card: 'kilo',
  data: function(ctx) {
    var a = wcPulseArgs(ctx.period), kg = a.tonnage ? a.tonnage.kg : 0;
    if (!(kg > 0)) return { state: 'empty', title: 'No weighed tonnage in this period', body: 'A kilo’s cost is the period’s cost over the kilos plated and billed.' };
    var c = wdgMemo('livecost:' + ctx.period, function() { var r = statsRangeIso(ctx.period); return liveCost(r.from, r.to, kg); });
    if (c.perKg == null) return { state: 'empty', title: 'No cost recorded for this period' };
    return { state: 'ok', tone: WC_KILO_TONE(c.measuredShare), c: c };
  },
  draw: function(d, size) {
    var c = d.c, pct = Math.round(c.measuredShare * 100);
    var h = '<div class="inv-widget-fig">' + escHtml(formatCurrency(c.perKg)) + '<span class="inv-tile-of">/kg</span></div>' +
      '<div class="inv-widget-line">' + escHtml(pct + '% of it measured') + '</div>';
    if (size === 's') return h;
    var rows = c.rows.filter(function(r) { return r.amount > 0; });
    h += '<div class="inv-widget-sub">' + escHtml('Over ' + formatNum(c.kg / 1000, 1) + ' t plated and billed') + '</div>';
    h += '<div class="inv-widget-viz">' + chartShareBar(rows.map(function(r) { return { label: r.label, v: r.amount, slot: seriesSlot('cost', r.key) }; }), 'Where a kilo’s cost goes') + '</div>';
    if (size === 'l') h += '<div class="inv-widget-rows" data-kilo-parts>' + rows.map(function(r) {
      return uiFactRowHtml({ label: r.label, sub: Math.round(r.amount / c.total * 100) + '% of the cost · ' + (COST_SRC_LABEL[r.source] || r.source || ''),
        value: formatCurrency(r.perKg) + '/kg', attrs: ' data-kilo-part="' + escHtml(r.key) + '"' });
    }).join('') + '</div>';
    return h;
  } });

/* ---------- The questions (Pulse's, folded into Home: §8c) ----------
   Each question a widget: its answer as a figure, a word and a small chart (its vital, statsStoryCards); from Medium its story;
   at Large what can be done, three moves. Its head opens the whole of it, every move, in a dialog. The questions read money in
   every figure, so each is money's (the old Pulse showed them only with the finance permission). */
var WC_QUESTIONS = [
  { k: 'smooth', title: 'Is the plant running smoothly?', q: 'Stock, power, staffing, records, the payout and the backup, in one answer', sizes: ['m', 's', 'l'] },
  { k: 'money', title: 'Are we making money?', q: 'Realisation and what a kilo leaves, against the cost', sizes: ['s', 'm', 'l'] },
  { k: 'clients', title: 'Who is driving it?', q: 'The accounts that fill the plant, and the one priced worst', sizes: ['m', 's', 'l'] },
  { k: 'plant', title: 'Is the plant full?', q: 'Capacity used, and the tonnes spare', sizes: ['m', 's', 'l'] },
  { k: 'cash', title: 'Is cash coming in?', q: 'What is owed, how fast it comes and the account’s low point', sizes: ['m', 's', 'l'], bank: true },
  { k: 'changed', title: 'What changed?', q: 'The month’s pace and what has moved most', sizes: ['m', 's', 'l'] }
];
function wcQuestion(k) { return tdyQuestions().filter(function(x) { return x.key === k; })[0] || null; }
/* The story as a card on the board tells it (Medium, Large): its sentences and rows, without the tiles and charts that restate the
   answer's figure and its sparkline above them. The whole story is the dialog's, which the head opens. */
function wcStoryBrief(html) {
  var t = document.createElement('template');
  t.innerHTML = html || '';
  Array.prototype.forEach.call(t.content.querySelectorAll('.inv-tiles, .inv-chart-box'), function(el) {
    var box = el.parentElement;
    el.remove();
    if (box && box.classList.contains('inv-panel-body') && !box.textContent.trim() && !box.children.length) box.remove();
  });
  return t.innerHTML;
}
/* What you can do, at Large: every move as a card, the widget's own fit letting go of the last that do not fit and saying how
   many (its Show all opens the question with every move); never a second Show more inside the card, which would draw past its
   cap. */
function wcQuestionMovesHtml(x) {
  if (x.inline && x.moves.length) return '';
  return '<div class="inv-hero-moves" data-tdy-moves><div class="inv-hero-eyebrow inv-mt-8 inv-mb-8" data-adv-head>What you can do' +
    (x.moves.length ? ' <span class="inv-panel-count">' + x.moves.length + '</span>' : '') + '</div>' +
    (x.moves.length ? advMovesDeckHtml(x.moves, 'q-' + x.key) : '<div class="inv-note" data-adv-none>' + escHtml(x.none || 'Nothing to do here yet.') + '</div>') +
    wcQuestionHintsHtml(x, ' data-wdg-opt') + '</div>';
}
/* What would make a better move (a weight per piece, a rate): under the moves; in a widget it gives way with the story. */
function wcQuestionHintsHtml(x, attrs) {
  return (x.hints || []).map(function(t) { return '<div class="inv-note inv-mt-8" data-adv-hint' + (attrs || '') + '>' + escHtml(t) + '</div>'; }).join('');
}
WC_QUESTIONS.forEach(function(qd) {
  wdgDefine({ id: 'q-' + qd.k, title: qd.title, q: qd.q, section: 'questions', sizes: qd.sizes,
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
    data: function() {
      var x = wcQuestion(qd.k);
      if (!x) return { state: 'empty', title: 'Not worked out yet', body: 'The question reads the period’s invoices; Stats has the figures.' };
      var v = x.vital || { fig: '', title: x.answer ? escHtml(x.answer.say) : '', sub: '', viz: '', tone: x.answer ? x.answer.tone : 'neutral' };
      return { state: 'ok', tone: WDG_TONES[v.tone] ? v.tone : 'neutral', x: x, v: v, attrs: ' data-tdy-questions data-tdy-q="' + escHtml(qd.k) + '"' };
    },
    draw: function(d, size) {
      var v = d.v, x = d.x;
      // At Large the moves are what the size is for: where the card has no room for them, its line of the months and its story give
      // way (the answer is the figure and its line; the story is the question's own, a tap away on its head).
      var opt = size === 'l' && x.moves.length && !x.inline ? ' data-wdg-opt' : '';
      var h = (v.fig ? '<div class="inv-widget-fig">' + v.fig + '</div>' : '') + (v.title ? '<div class="inv-widget-line">' + v.title + '</div>' : '') +
        (v.sub && size !== 's' ? '<div class="inv-widget-sub">' + v.sub + '</div>' : '') + (v.viz ? '<div class="inv-widget-viz"' + opt + '>' + v.viz + '</div>' : '');
      if (size === 's') return h;
      h += '<div class="inv-hero-sheet" data-tdy-story' + opt + '>' + wcStoryBrief(x.html) + '</div>';
      if (size === 'l') h += wcQuestionMovesHtml(x);
      return h;
    } });
});
/* Do first: the moves worth most across every question (tdyFirstMoves, advRank): three at Medium, five at Large; the head opens
   the first ten. */
wdgDefine({ id: 'dofirst', title: 'Do first', q: 'The three moves worth most, across every question', section: 'questions', sizes: ['m', 'l'],
  needs: { money: true }, card: 'first',
  go: function() {
    var top = tdyFirstMoves(tdyQuestions(), 10);
    wcMovesOpen('Do first: the moves worth most', top.map(function(t) { return t.mv; }), 'first-all', top.map(function(t) { return t.word; }));
  },
  data: function(ctx) {
    var top = tdyFirstMoves(tdyQuestions(), ctx.size === 'l' ? 5 : 3);
    if (!top.length) return { state: 'empty', title: 'No move worth making yet', body: 'A move appears once a question finds one: a price under the cost, a debt past its terms, a line idle.' };
    return { state: 'ok', tone: 'neutral', top: top };
  },
  draw: function(d, size) {
    // The cards say it (the title is the widget's): at Large, how they are ranked over them.
    var listed = typeof advListedKeys === 'function' ? advListedKeys() : {};
    return (size === 'l' ? '<div class="inv-widget-sub">By what each is worth a month, across the questions</div>' : '') +
      '<div class="inv-deck" data-adv-deck="first">' + d.top.map(function(t) { return advMoveCardHtml(t.mv, listed, t.word); }).join('') + '</div>';
  } });
wdgDefine({ id: 'why', title: 'Why it moved', q: 'What moved the figures against the period before?', section: 'questions', sizes: ['m', 'l'],
  needs: { money: true }, go: { tab: 'pageStats', v: 'trends' },
  data: function(ctx) {
    var a = wcPulseArgs(ctx.period), o = whyHeroOpts(ctx.period, a.filtered, a.prior, ctx.size === 'm' ? 'real' : '');
    if (!o) return { state: 'early', title: ctx.period === 'all' ? 'All has no period before it' : 'Nothing to compare yet',
      body: ctx.period === 'all' ? 'Pick MTD, QTD or YTD to see what moved against the period before.' : 'The period before has no invoices.' };
    return wdgFromHero(o);
  },
  draw: wdgHeroDraw });
wdgDefine({ id: 'figures', title: 'The period in figures', q: 'Price, cost, contribution, capacity', section: 'questions', sizes: ['m', 'l'],
  needs: { money: true }, go: { tab: 'pageStats', v: 'cost' },
  data: function(ctx) {
    var a = wcPulseArgs(ctx.period), o = statsOverviewOpts(ctx.period, a.filtered, a.tonnage);
    return wdgFromHero(o);
  },
  draw: wdgHeroDraw });
wdgDefine({ id: 'pace', title: 'This month at its pace', q: 'Where does the month land?', section: 'office', sizes: ['m', 'l'],
  needs: { page: 'pageRegister', money: true }, go: { tab: 'pageRegister' },
  data: function() {
    var o = paceCardOpts();
    if (!o) return { state: 'early', title: 'The month has no pace yet', body: 'A pace needs a working day billed this month.' };
    return wdgFromHero(o, { facts: o.facts });
  },
  draw: function(d, size) {
    // Medium: the band and the line against last month; Large: what it rests on too (the tonnage, unbilled in hand).
    return '<div class="inv-widget-line">' + d.line + '</div>' + (d.sub ? '<div class="inv-widget-sub">' + d.sub + '</div>' : '') +
      '<div class="inv-hero-sheet">' + d.facts.slice(0, size === 'l' ? 4 : 2).join('') + '</div>';
  } });
wdgDefine({ id: 'needs', title: 'Needs you', q: 'What needs me now?', section: 'questions', sizes: ['m', 'l'],
  go: { tab: 'pageHome', v: 'needs' },
  data: function(ctx) { return wdgFromHero(todoHomeOpts(ctx.size === 'l' ? 5 : 3)); },
  draw: wdgHeroDraw, foot: wdgHeroFoot });
/* U2d · Questions: coming (§7d), after this line. */
/* What's coming (§7d `coming`): dated predictions, soonest first, each with its reason, read off what already predicts it, each shown
   only to a role that may see it: the cash forecast's low under zero (finForecast), a stock line out before its supplier can deliver
   (stockStatus, suppReorderPick), a client's next challan by its rhythm (predCadence), where the month lands (predMonthPace), a
   challan's turnaround target passing (flowLines), and a cut likely today where the forecast has thunder in the hours the plant's own
   cuts most often start (said as the two facts side by side, never a probability the book has not measured). Medium four, Large seven. */
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
      if (f && f.overdrawn) out.push({ key: 'cash', date: today, tone: 'danger', title: 'The bank account is overdrawn', why: 'The statement’s last balance: ' + finRs(f.start), go: { kind: 'finance', tab: 'overview' } });
      else if (f && f.cross) out.push({ key: 'cash', date: f.cross, tone: 'danger', title: 'Cash dips below zero', why: 'The forecast’s low: ' + finRs(f.min.bal) + ' on ' + stockShortDate(f.min.date), go: { kind: 'finance', tab: 'overview' } });
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
      out.push({ key: 'pace', date: end, tone: ahead === false ? 'warning' : ahead ? 'ok' : 'neutral', title: 'The month lands about ' + finRs(p.projRev),
        why: finRs(p.low) + ' – ' + finRs(p.high) + ' at the pace of ' + todoPlural(p.done, 'working day') + (p.prevRev > 0 ? '; ' + p.prevLabel + ' billed ' + finRs(p.prevRev) : ''),
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
wdgDefine({ id: 'coming', title: 'What’s coming', q: 'What happens next, and when?', section: 'questions', sizes: ['m', 'l'], card: 'coming', feed: true,
  act: function(action, btn) {
    if (action !== 'invWdgComing') return false;
    var it = wcComingItems().filter(function(x) { return x.key === btn.dataset.k; })[0];
    if (!it) { showToast('That has changed since it was drawn', 'info'); wdgRefresh('coming'); return true; }
    if (typeof it.go === 'function') it.go(); else todoGo(it.go);
    return true;
  },
  data: function(ctx) {
    var list = wcComingItems();
    if (!list.length) return { state: 'empty', title: 'Nothing dated ahead yet', body: 'A prediction appears here once the book can make one: a stock line running out, a client’s next challan, where the month lands.' };
    var shown = list.slice(0, ctx.size === 'l' ? 7 : 4);
    var tone = shown.reduce(function(t, x) { return (WC_COMING_RANK[x.tone] || 0) > (WC_COMING_RANK[t] || 0) ? x.tone : t; }, 'neutral');
    return { state: 'ok', tone: tone === 'info' ? 'neutral' : tone, list: shown, total: list.length };
  },
  draw: function(d) {
    var first = d.list[0];
    return '<div class="inv-widget-line">' + escHtml(wcComingDay(first.date) + ': ' + first.title) + '</div>' +
      '<div class="inv-widget-sub">' + escHtml(todoPlural(d.total, 'thing') + ' dated ahead, soonest first') + '</div>' +
      '<div class="inv-widget-rows" data-coming>' + d.list.map(function(x) {
        return '<div class="inv-row inv-row-2" data-coming-k="' + escHtml(x.key) + '"><button type="button" class="inv-row-main" data-action="invWdgComing" data-wid="coming" data-k="' + escHtml(x.key) + '">' +
          '<span class="inv-row-title">' + escHtml(x.title) + '</span><span class="inv-row-meta">' + escHtml(x.why) + '</span></button>' +
          uiRowEndHtml('', { tone: x.tone === 'neutral' ? 'neutral' : x.tone, word: wcComingDay(x.date) }) + '</div>';
      }).join('') + '</div>';
  } });
