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

/* ---------- Office ---------- */
wdgDefine({ id: 'mtd', title: 'Month to date', q: 'How is the month going?', section: 'office', sizes: ['s', 'm', 'l'],
  needs: { page: 'pageRegister', money: true }, go: { tab: 'pageRegister' },
  data: function(ctx) {
    var o = homeMtdOpts(homeMonthInvoices(), { viz: ctx.size === 'l' });
    // Small: what is billed and its change on the same days last month, coded by that change alone; from Medium the four tiles
    // and the worse of billing and realisation, at Large the tiles' lines.
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
      action: wcAct('Set it up', 'invWdgGo', ' data-w="sync"'), attrs: ' data-card="sync"' };
    return wdgFromHero(o);
  },
  draw: function(d) { return '<div class="inv-widget-line">' + d.line + '</div>' + (d.sub ? '<div class="inv-widget-sub">' + d.sub + '</div>' : ''); },
  // Back up now is the widget's whole point: drawn at its one size.
  foot: function(d) { return d.heroFoot || ''; } });
/* U2d · Office: turn, pipe, quote (§7d), each after this line in the table's order. */

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

/* ---------- People ---------- */
wdgDefine({ id: 'atttoday', title: 'Attendance today', q: 'Is the crew in?', section: 'people', sizes: ['s', 'm'],
  needs: { page: 'pageStaff' }, go: { tab: 'pageStaff', v: 'day' },
  data: function() {
    var o = attHomeOpts();
    if (!o) return { state: 'empty', title: 'No roster yet', body: 'People → Roster holds the crew; a day is marked against it.',
      action: wcAct('Open the roster', 'invWdgGo', ' data-w="atttoday"'), attrs: ' data-card="attendance"' };
    return wdgFromHero(o);
  },
  draw: wdgHeroDraw, foot: wdgHeroFoot });
/* U2d · People: attweek, ot (§7d), each after this line in the table's order. */

/* ---------- Market and the world outside (§9) ---------- */
/* U2d · Market: tata, weather (§7d), each after this line, reading feeds.js. */

/* ---------- Analysis ---------- */
/* U2d · Analysis: corr, clientprice, kilo (§7d), each after this line in the table's order. */

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
function wcQuestionMovesHtml(x) {
  if (x.inline && x.moves.length) return '';
  return '<div class="inv-hero-moves" data-tdy-moves><div class="inv-hero-eyebrow inv-mt-8 inv-mb-8" data-adv-head>What you can do' +
    (x.moves.length ? ' <span class="inv-panel-count">' + x.moves.length + '</span>' : '') + '</div>' +
    (x.moves.length ? advMovesDeckHtml(x.moves, 'q-' + x.key, ADV_SHOW) : '<div class="inv-note" data-adv-none>' + escHtml(x.none || 'Nothing to do here yet.') + '</div>') +
    (x.hints || []).map(function(t) { return '<div class="inv-note inv-mt-8" data-adv-hint>' + escHtml(t) + '</div>'; }).join('') + '</div>';
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
          : '<div class="inv-note">' + escHtml(x.none || 'Nothing to do here yet.') + '</div>')) + '</div></div>', { dismiss: true });
    },
    data: function() {
      var x = wcQuestion(qd.k);
      if (!x) return { state: 'empty', title: 'Not worked out yet', body: 'The question reads the period’s invoices; Stats has the figures.' };
      var v = x.vital || { fig: '', title: x.answer ? escHtml(x.answer.say) : '', sub: '', viz: '', tone: x.answer ? x.answer.tone : 'neutral' };
      return { state: 'ok', tone: WDG_TONES[v.tone] ? v.tone : 'neutral', x: x, v: v, attrs: ' data-tdy-questions data-tdy-q="' + escHtml(qd.k) + '"' };
    },
    draw: function(d, size) {
      var v = d.v, x = d.x;
      var h = (v.fig ? '<div class="inv-widget-fig">' + v.fig + '</div>' : '') + (v.title ? '<div class="inv-widget-line">' + v.title + '</div>' : '') +
        (v.sub && size !== 's' ? '<div class="inv-widget-sub">' + v.sub + '</div>' : '') + (v.viz ? '<div class="inv-widget-viz">' + v.viz + '</div>' : '');
      if (size === 's') return h;
      h += '<div class="inv-hero-sheet" data-tdy-story>' + x.html + '</div>';
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
  draw: function(d) {
    var listed = typeof advListedKeys === 'function' ? advListedKeys() : {};
    return '<div class="inv-widget-line">The moves worth most</div><div class="inv-widget-sub">By what each is worth a month, across the questions</div>' +
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
