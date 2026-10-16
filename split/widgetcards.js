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
      action: wcAct('Set it up', 'invWdgGo', ' data-wid="sync"'), attrs: ' data-card="sync"' };
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
      action: wcAct('Open the roster', 'invWdgGo', ' data-wid="atttoday"'), attrs: ' data-card="attendance"' };
    return wdgFromHero(o);
  },
  draw: wdgHeroDraw, foot: wdgHeroFoot });
/* U2d · People: attweek, ot (§7d), each after this line in the table's order. */

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
  draw: function(d, size) {
    var m = d.m, n = size === 'l' ? 12 : 6, list = m.ranked.slice(0, n), w = d.worst;
    var max = Math.max(m.fullKg * 1.2, Math.max.apply(null, list.map(function(x) { return x.net; })));
    var h = '<div class="inv-widget-fig">' + d.below.length + '<span class="inv-tile-of"> of ' + m.ranked.length + '</span></div>' +
      '<div class="inv-widget-line">' + escHtml((d.below.length ? 'Below' : 'None below') + ' the full cost of ' + formatCurrency(m.fullKg) + '/kg') + '</div>' +
      '<div class="inv-widget-sub">' + escHtml('Variable ' + formatCurrency(m.varKg) + '/kg, labour fixed' +
        (w && w.net < m.fullKg ? ' · the worst large account ' + w.name + ' at ' + formatCurrency(w.net) + '/kg' : '')) + '</div>';
    h += '<div class="inv-widget-viz">' + chartRankedBars(list.map(function(x) {
      return { label: x.name, value: x.net, display: formatCurrency(x.net) + '/kg', tone: figToneAgainst(x.net, m.fullKg, 5) || 'ok', markPct: m.fullKg / max * 100,
        sub: Math.round(x.kg / m.kg * 100) + '% of the tonnes · ' + (x.vsVar >= 0 ? '+' : '−') + formatCurrency(Math.abs(x.vsVar)) + ' on the variable cost',
        action: 'invStatsClientDrill', clientId: x.id };
    }), { unit: 'rate', max: max, labelHead: 'Client', valueHead: '₹ a kilo', ariaLabel: 'What each client pays a kilo against the full cost' }) + '</div>';
    if (m.ranked.length > n || m.apart.length) h += '<div class="inv-widget-sub">' + escHtml([m.ranked.length > n ? (m.ranked.length - n) + ' more on Stats' : '',
      m.apart.length ? m.apart.length + ' not ranked: under 90% of revenue weighed' : ''].filter(Boolean).join(' · ')) + '</div>';
    return h;
  } });

/* Where a kilo's cost goes (§7d `kilo`): the period's live cost a kilo and how much of it is measured; from Medium its parts as one
   bar of 100% (a part's colour its own on every cost chart, seriesSlot 'cost'); at Large each part's ₹ a kilo, its share and its
   source. Coded by the share measured, as Stats' Cost is. */
var WC_KILO_TONE = function(share) { return share >= 0.9 ? 'ok' : share >= 0.5 ? 'warning' : 'danger'; };
function wcShareBarHtml(parts, title) {
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
    h += '<div class="inv-widget-viz">' + wcShareBarHtml(rows.map(function(r) { return { label: r.label, v: r.amount, slot: seriesSlot('cost', r.key) }; }), 'Where a kilo’s cost goes') + '</div>';
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
