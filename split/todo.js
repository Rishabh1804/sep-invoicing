/* ===== TO-DO =====
   More → To-do, a Home card, and a Windows 11 widget. The owner's own list,
   inside the app for now (owner, 25 Sep 2026); sep-dashboard can take it whole
   later — S.todo is self-contained.

   Two kinds, always labelled:
   - MINE: typed by the owner. Ticked, never deleted — a ticked task moves to
     Done and can be reopened.
   - APP: raised from the app's own data (stock running out, a credit note due,
     a challan waiting to be billed…). Never ticked: each one clears itself when
     the thing is fixed. It can be SNOOZED, but only against the figures it was
     raised on — `sig` — so a snooze never covers a new problem. The same rule
     the Areas card applies to an explained exception.

   The widget is drawn by Windows from an Adaptive Card. The service worker
   renders it from a small payload this module writes to its own IndexedDB
   ('sep-invoicing-widget'), and a Done tapped on the widget comes back as a
   queue the app applies. Both directions run on open AND on close: the queue is
   read when the app is shown, the payload is written when it is hidden. */

var TODO_CHECK_DEFAULTS = { stock: true, paste: true, cn: true, challan: true, dispatch: true, audit: true,
  backup: true, zinc: false, pasteDays: 2, challanDays: 5, dispatchDays: 2, backupDays: 7 };
var TODO_RULES = [
  ['stock', 'A stock line turns red or amber'],
  ['paste', 'No stock message for a while'],
  ['cn', 'A credit-note batch reaches 7 days'],
  ['challan', 'A challan is waiting to be billed'],
  ['dispatch', 'An invoice is still Created'],
  ['audit', 'The number audit finds a gap'],
  ['backup', 'No backup for a while'],
  ['zinc', 'The zinc rate is stale']
];
var TODO_LAST_EXPORT_KEY = 'sep_inv_last_export';
var TODO_TONE_RANK = { red: 0, amber: 1, info: 2, '': 3 };

var _todoShowDone = false;
var _todoShowSnoozed = false;

function todoData() {
  if (!S.todo || typeof S.todo !== 'object' || Array.isArray(S.todo)) S.todo = {};
  if (!Array.isArray(S.todo.tasks)) S.todo.tasks = [];
  if (!S.todo.snoozes || typeof S.todo.snoozes !== 'object') S.todo.snoozes = {};
  return S.todo;
}
function todoCfg() {
  var c = S.todoCheck || {}, d = TODO_CHECK_DEFAULTS, out = {};
  Object.keys(d).forEach(function(k) {
    if (typeof d[k] === 'boolean') out[k] = c[k] == null ? d[k] : !!c[k];
    else { var v = parseFloat(c[k]); out[k] = v > 0 ? v : d[k]; }
  });
  return out;
}
function todoUid() { return 'TD-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todoToday() { return localDateStr(); }
function todoDaysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
function todoPlural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

/* ---------- Mine ---------- */
function todoMineOpen() {
  return todoData().tasks.filter(function(t) { return !t.doneAt; });
}
function todoMineTone(t) {
  if (!t.due || t.doneAt) return '';
  var d = todoDaysBetween(todoToday(), t.due);
  return d < 0 ? 'red' : d === 0 ? 'amber' : '';
}
function todoDueLabel(iso) {
  if (!iso) return '';
  var d = todoDaysBetween(todoToday(), iso);
  if (d === 0) return 'Today';
  if (d === -1) return 'Yesterday';
  if (d === 1) return 'Tomorrow';
  if (d < 0) return todoPlural(-d, 'day') + ' late';
  return stockShortDate(iso);
}

/* ---------- App tasks: one function per rule ----------
   Each returns { key, rule, tone, title, sub, why, facts, clears, go, goLabel, sig }.
   `sig` is the figures a snooze is granted against; it is deliberately coarse
   where the figure moves every day on its own (a stock level falls with use —
   the snooze lasts until the line changes colour, not until it drops a litre). */
var TODO_RULE_FNS = {
  stock: function() {
    var out = [];
    stockData().items.forEach(function(it) {
      if (it.active === false || it.basis === 'charge') return;
      var st = stockStatus(it);
      if (st.tone !== 'red' && st.tone !== 'amber') return;
      var unit = it.unit || '';
      var rate = st.rate && st.rate.rate ? stockFmtRate(st.rate.rate) + ' ' + unit + ' a day' : '';
      var sub = st.group === 'out' ? 'Out' + (rate ? ' · was using ' + rate : '')
        : stockFmtQty(st.level) + ' ' + unit + ' left · about ' + todoPlural(Math.max(0, Math.round(st.daysLeft * 10) / 10), 'day');
      out.push({ key: 'stock:' + it.id, rule: 'stock', tone: st.tone, title: 'Order ' + it.name, sub: sub,
        why: 'Stock' + (rate && st.group !== 'out' ? ' · uses ' + rate : ''),
        facts: [['Level', stockFmtQty(st.level) + ' ' + unit], ['Daily use', rate || '—'],
          ['Days left', st.daysLeft == null ? '—' : String(Math.round(st.daysLeft * 10) / 10)]],
        clears: 'Clears itself when a delivery or a count lifts the line out of ' + (st.tone === 'red' ? 'red' : 'amber') + '.',
        go: { kind: 'stock', id: it.id }, goLabel: 'Open the line', sig: st.tone + '|' + st.group });
    });
    return out;
  },
  paste: function() {
    var st = stockData();
    if (!st.items.length) return [];
    var last = '';
    st.entries.forEach(function(e) { if (!e.voided && e.date > last) last = e.date; });
    if (!last) return [];
    var today = todoToday(), cfg = todoCfg();
    if (last >= today) return [];
    var gap = stockWorkingDays(stockIsoAdd(last, 1), today);
    if (gap < cfg.pasteDays) return [];
    return [{ key: 'paste', rule: 'paste', tone: gap >= cfg.pasteDays * 2 ? 'amber' : 'info',
      title: 'Paste the stock message', sub: 'Nothing recorded since ' + stockShortDate(last),
      why: 'Stock · ' + todoPlural(gap, 'working day') + ' without a figure',
      facts: [['Last figure', stockShortDate(last)], ['Working days since', String(gap)]],
      clears: 'Clears itself when a message is pasted or a figure is entered.',
      go: { kind: 'stockPaste' }, goLabel: 'Paste message', sig: last }];
  },
  cn: function() {
    var out = [];
    var notes = getCreditNotes().filter(function(c) { return c.status !== 'cancelled'; });
    var byClient = {};
    notes.forEach(function(c) {
      var b = byClient[c.clientId] || (byClient[c.clientId] = { to: '', ids: {}, last: null });
      if ((c.periodTo || '') > b.to) b.to = c.periodTo || '';
      (c.invoiceIds || []).forEach(function(id) { b.ids[id] = true; });
      if (!b.last || (c.createdAt || 0) > (b.last.createdAt || 0)) b.last = c;
    });
    Object.keys(byClient).forEach(function(cid) {
      var b = byClient[cid];
      var pending = S.invoices.filter(function(i) {
        return String(i.clientId) === String(cid) && i.status !== 'cancelled' && i.date && i.date > b.to && !b.ids[i.id];
      }).sort(function(a, c) { return String(a.date).localeCompare(String(c.date)); });
      if (!pending.length) return;
      var span = cnBatchSpanDays(pending);
      if (span < CN_BATCH_MIN_DAYS) return;
      var pct = b.last.discountPct || CN_DEFAULT_PCT;
      var taxable = gstRound(pending.reduce(function(s, i) { return s + (i.taxableValue || 0); }, 0));
      var credit = gstRound(taxable * pct / 100);
      out.push({ key: 'cn:' + cid, rule: 'cn', tone: 'amber', title: 'Credit note due: ' + (b.last.clientName || pending[0].clientName),
        sub: todoPlural(pending.length, 'invoice') + ' since ' + b.last.displayNumber + ' · ' + pct + '% ≈ ' + formatCurrency(credit),
        why: 'Batch spans ' + todoPlural(span, 'day') + ' · rule: ' + CN_BATCH_MIN_DAYS + ' or more',
        facts: [['Last note', b.last.displayNumber + (b.to ? ' · to ' + formatDate(b.to) : '')], ['Invoices since', String(pending.length)],
          ['Batch spans', todoPlural(span, 'day')], ['Taxable', formatCurrency(taxable)], [pct + '% credit', formatCurrency(credit)]],
        clears: 'Clears itself when a credit note covering these invoices is raised.',
        go: { kind: 'cnBatch', clientId: cid, ids: pending.map(function(i) { return i.id; }), from: pending[0].date, to: pending[pending.length - 1].date },
        goLabel: 'Open register', sig: pending.length + '|' + pending[pending.length - 1].id + '|' + taxable });
    });
    return out;
  },
  challan: function() {
    var today = todoToday(), cfg = todoCfg(), byClient = {};
    (S.incomingMaterial || []).forEach(function(im) {
      if (!im.challanDate || !(im.items || []).some(function(it) { return !it.invoiced; })) return;
      if (todoDaysBetween(im.challanDate, today) < cfg.challanDays) return;
      (byClient[im.clientId] || (byClient[im.clientId] = [])).push(im);
    });
    return Object.keys(byClient).map(function(cid) {
      var list = byClient[cid].sort(function(a, b) { return String(a.challanDate).localeCompare(String(b.challanDate)); });
      var oldest = list[0], age = todoDaysBetween(oldest.challanDate, today);
      var nums = list.map(function(im) { return im.challanNo ? String(im.challanNo) : 'no number'; });
      return { key: 'challan:' + cid, rule: 'challan', tone: 'info',
        title: 'Bill ' + (oldest.clientName || 'challans') + ': ' + (list.length === 1 ? 'challan ' + nums[0] : todoPlural(list.length, 'challan')),
        sub: (list.length === 1 ? 'Received ' : 'Oldest received ') + todoPlural(age, 'day') + ' ago, not invoiced',
        why: 'Incoming material · rule: ' + cfg.challanDays + ' days',
        facts: [['Challans', nums.join(', ')], ['Oldest', formatDate(oldest.challanDate)]],
        clears: 'Clears itself when these challans are invoiced.',
        go: { kind: 'im', clientId: cid }, goLabel: 'Open challans',
        sig: list.map(function(im) { return im.id; }).join(',') };
    });
  },
  dispatch: function() {
    var today = todoToday(), cfg = todoCfg();
    var list = S.invoices.filter(function(i) {
      if (i.status === 'cancelled' || getInvState(i) !== 'created' || !i.date) return false;
      var age = todoDaysBetween(i.date, today);
      return age >= cfg.dispatchDays && age <= 30;
    }).sort(function(a, b) { return String(a.date).localeCompare(String(b.date)); });
    if (!list.length) return [];
    var nums = list.map(function(i) { return String(i.displayNumber || '').split('/').pop(); });
    return [{ key: 'dispatch', rule: 'dispatch', tone: 'info',
      title: list.length === 1 ? 'Mark invoice ' + nums[0] + ' dispatched' : 'Mark ' + list.length + ' invoices dispatched',
      sub: 'Still Created: ' + nums.slice(0, 4).join(', ') + (nums.length > 4 ? '…' : ''),
      why: 'Register · rule: ' + cfg.dispatchDays + ' days, last 30 days only',
      facts: [['Invoices', nums.join(', ')], ['Oldest', formatDate(list[0].date)]],
      clears: 'Clears itself when these invoices move past Created.',
      go: { kind: 'regState', state: 'created' }, goLabel: 'Open register', sig: list.map(function(i) { return i.id; }).join(',') }];
  },
  audit: function() {
    var a = analyseInvoiceNumbers(), n = (a.unaccounted || []).length;
    if (!n) return [];
    return [{ key: 'audit', rule: 'audit', tone: 'amber', title: 'Number audit: ' + n + ' unaccounted',
      sub: 'Invoice numbers with no invoice and no reason', why: 'Register · number audit',
      facts: [['Unaccounted', String(n)]], clears: 'Clears itself when each number is explained or reissued.',
      go: { kind: 'audit' }, goLabel: 'Open the audit', sig: JSON.stringify(a.unaccounted) }];
  },
  backup: function() {
    var cfg = todoCfg(), last = 0;
    try { last = parseInt(localStorage.getItem(TODO_LAST_EXPORT_KEY), 10) || 0; } catch (e) { /* per-device only */ }
    var gh = (typeof getGhConfig === 'function') ? getGhConfig().lastPushAt || 0 : 0;
    last = Math.max(last, gh);
    var age = last ? Math.floor((Date.now() - last) / 86400000) : null;
    if (age != null && age < cfg.backupDays) return [];
    return [{ key: 'backup', rule: 'backup', tone: 'info', title: 'Back up your data',
      sub: age == null ? 'No backup recorded on this device' : 'Last backup ' + todoPlural(age, 'day') + ' ago',
      why: 'Export or GitHub push · rule: ' + cfg.backupDays + ' days',
      facts: [['Last backup', last ? formatTimestamp(last) : 'none on this device']],
      clears: 'Clears itself when you export a backup or push to GitHub.',
      go: { kind: 'settings' }, goLabel: 'Open settings', sig: String(last) }];
  },
  zinc: function() {
    var age = zincAgeDays();
    if (age == null || age <= ZINC_STALE_DAYS) return [];
    return [{ key: 'zinc', rule: 'zinc', tone: 'info', title: 'Update the zinc rate', sub: 'Last set ' + todoPlural(age, 'day') + ' ago',
      why: 'Zinc · rule: ' + ZINC_STALE_DAYS + ' days', facts: [['Age', todoPlural(age, 'day')]],
      clears: 'Clears itself when the rate is refreshed.', go: { kind: 'home' }, goLabel: 'Open Home', sig: String(getZinc().updatedAt) }];
  }
};

function todoAppAll() {
  var cfg = todoCfg(), out = [];
  TODO_RULES.forEach(function(r) {
    if (!cfg[r[0]]) return;
    // One rule failing on a shape nobody anticipated must not take the list with it.
    try { out = out.concat(TODO_RULE_FNS[r[0]]() || []); } catch (e) { /* skipped */ }
  });
  return out.sort(function(a, b) { return TODO_TONE_RANK[a.tone] - TODO_TONE_RANK[b.tone]; });
}
function todoIsSnoozed(t) {
  var s = todoData().snoozes[t.key];
  if (!s) return false;
  if (s.until) return todoToday() < s.until;
  return s.sig === t.sig;
}
function todoApp() { return todoAppAll().filter(function(t) { return !todoIsSnoozed(t); }); }

/* Both kinds in one order, for Home and the widget: red, amber, then the rest;
   App before Mine within a tone; Mine by due date. */
function todoRanked() {
  var rows = todoApp().map(function(t) { return { app: t, tone: t.tone }; });
  todoMineOpen().forEach(function(t) { rows.push({ mine: t, tone: todoMineTone(t) }); });
  return rows.sort(function(a, b) {
    var r = TODO_TONE_RANK[a.tone] - TODO_TONE_RANK[b.tone];
    if (r) return r;
    if (!!a.app !== !!b.app) return a.app ? -1 : 1;
    if (a.mine && b.mine) return (a.mine.due || '9999').localeCompare(b.mine.due || '9999') || (a.mine.createdAt - b.mine.createdAt);
    return 0;
  });
}
function todoRedCount() {
  if (!S) return 0;
  return todoRanked().filter(function(r) { return r.tone === 'red'; }).length;
}

/* ---------- Screens ---------- */
function renderTodo() {
  var el = document.getElementById('todoContent');
  if (!el) return;
  var app = todoApp(), mine = todoMineOpen(), td = todoData();
  var late = todoRanked().filter(function(r) { return r.tone === 'red'; }).length;
  var h = '<div class="inv-stk-top"><div><div class="inv-stk-h1">To-do</div>' +
    '<div class="inv-stk-meta"><strong>' + (app.length + mine.length) + '</strong> open' + (late ? ' · <strong>' + late + '</strong> late' : '') + '</div></div></div>';
  h += '<div class="inv-td-add"><input class="inv-td-in" id="todoNew" data-todo-new placeholder="Add a task…" aria-label="New task" autocomplete="off">' +
    '<button class="inv-stk-btn inv-stk-btn-pri" data-action="invTodoAdd">Add</button>' +
    '<button class="inv-stk-btn" data-action="invTodoNew">Details</button></div>';

  h += '<div class="inv-td-sec"><span class="inv-td-lbl inv-td-lbl-app">App</span> From your data <span class="inv-td-count">· ' + app.length + '</span></div>';
  if (!app.length) h += '<div class="inv-td-empty">Nothing from your data needs you.</div>';
  app.forEach(function(t) { h += todoAppRowHtml(t); });

  mine.sort(function(a, b) {
    return TODO_TONE_RANK[todoMineTone(a)] - TODO_TONE_RANK[todoMineTone(b)] ||
      (a.due || '9999').localeCompare(b.due || '9999') || (a.createdAt - b.createdAt);
  });
  h += '<div class="inv-td-sec"><span class="inv-td-lbl inv-td-lbl-mine">Mine</span> <span class="inv-td-count">· ' + mine.length + '</span></div>';
  if (!mine.length) h += '<div class="inv-td-empty">No tasks of your own. Type one above and press Enter.</div>';
  mine.forEach(function(t) { h += todoMineRowHtml(t); });

  var done = td.tasks.filter(function(t) { return t.doneAt; }).sort(function(a, b) { return b.doneAt - a.doneAt; });
  if (done.length) {
    h += '<button class="inv-td-fold" data-action="invTodoFoldDone" aria-expanded="' + _todoShowDone + '"><span>Done · ' + done.length + '</span><span>' + (_todoShowDone ? 'Hide' : 'Show') + '</span></button>';
    if (_todoShowDone) done.slice(0, 50).forEach(function(t) { h += todoMineRowHtml(t); });
  }
  var snoozed = todoAppAll().filter(todoIsSnoozed);
  if (snoozed.length) {
    h += '<button class="inv-td-fold" data-action="invTodoFoldSnoozed" aria-expanded="' + _todoShowSnoozed + '"><span>Snoozed · ' + snoozed.length + '</span><span>' + (_todoShowSnoozed ? 'Hide' : 'Show') + '</span></button>';
    if (_todoShowSnoozed) snoozed.forEach(function(t) {
      var s = td.snoozes[t.key];
      h += '<div class="inv-td-row inv-td-row-snz"><div class="inv-td-main"><span class="inv-td-title">' + escHtml(t.title) + '</span>' +
        '<span class="inv-td-sub">' + (s.until ? 'Until ' + escHtml(stockShortDate(s.until)) : 'Until the figures change') + '</span></div>' +
        '<button class="inv-stk-tool" data-action="invTodoWake" data-key="' + escHtml(t.key) + '">Wake</button></div>';
    });
  }
  el.innerHTML = h;
  updateStockBadge();
}

function todoGlyph(tone) {
  return '<span class="inv-td-glyph inv-td-glyph-' + (tone || 'info') + '" aria-hidden="true">' + (tone === 'info' ? 'i' : '!') + '</span>';
}
function todoAppRowHtml(t) {
  return '<button class="inv-td-row inv-td-tone-' + t.tone + '" data-action="invTodoOpenApp" data-key="' + escHtml(t.key) + '">' +
    todoGlyph(t.tone) + '<span class="inv-td-main"><span class="inv-td-title">' + escHtml(t.title) + '</span>' +
    '<span class="inv-td-sub">' + escHtml(t.sub) + '</span><span class="inv-td-why">' + escHtml(t.why) + '</span></span></button>';
}
function todoLinkLabel(link) {
  if (!link) return '';
  var names = { client: 'Client', invoice: 'Invoice', challan: 'Challan', stock: 'Stock' };
  return (names[link.kind] || '') + ' · ' + (link.label || '');
}
function todoMineRowHtml(t) {
  var tone = todoMineTone(t);
  return '<div class="inv-td-row inv-td-tone-' + (tone || 'none') + (t.doneAt ? ' inv-td-row-done' : '') + '">' +
    '<button class="inv-td-box' + (t.doneAt ? ' inv-td-box-on' : '') + '" data-action="invTodoToggle" data-id="' + escHtml(t.id) + '" aria-label="' + (t.doneAt ? 'Reopen' : 'Mark done') + '">' +
    (t.doneAt ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="5 12 10 17 19 7"/></svg>' : '') + '</button>' +
    '<button class="inv-td-main" data-action="invTodoEdit" data-id="' + escHtml(t.id) + '"><span class="inv-td-title">' + escHtml(t.text) + '</span>' +
    (t.note ? '<span class="inv-td-sub">' + escHtml(t.note) + '</span>' : '') +
    (t.doneAt ? '<span class="inv-td-why">Done ' + escHtml(formatTimestamp(t.doneAt)) + (t.doneBy === 'widget' ? ' from the widget' : '') + '</span>' : '') + '</button>' +
    '<span class="inv-td-side">' + (t.due && !t.doneAt ? '<span class="inv-td-due inv-td-due-' + (tone || 'none') + '">' + escHtml(todoDueLabel(t.due)) + '</span>' : '') +
    (t.link ? '<button class="inv-td-link" data-action="invTodoGo" data-id="' + escHtml(t.id) + '">' + escHtml(todoLinkLabel(t.link)) + '</button>' : '') + '</span></div>';
}

/* Home: the top three, both kinds, labelled. */
function renderTodoHomeCard() {
  var el = document.getElementById('homeTodoCard');
  if (!el) return;
  var ranked = todoRanked();
  var h = '<div class="inv-card inv-td-card"><div class="inv-card-header"><span class="inv-card-title">To-do</span>' +
    '<button class="inv-stk-tool" data-action="invSwitchTab" data-tab="pageTodo">' + (ranked.length ? 'All ' + ranked.length : 'Add a task') + '</button></div>';
  if (!ranked.length) h += '<div class="inv-td-home-none">Nothing due</div>';
  ranked.slice(0, 3).forEach(function(r) {
    if (r.app) {
      h += '<button class="inv-td-hrow" data-action="invTodoOpenApp" data-key="' + escHtml(r.app.key) + '">' + todoGlyph(r.tone) +
        '<span class="inv-td-main"><span class="inv-td-title">' + escHtml(r.app.title) + '</span><span class="inv-td-sub">' + escHtml(r.app.sub) + '</span></span>' +
        '<span class="inv-td-lbl inv-td-lbl-app">App</span></button>';
    } else {
      var t = r.mine;
      h += '<div class="inv-td-hrow"><button class="inv-td-box" data-action="invTodoToggle" data-id="' + escHtml(t.id) + '" aria-label="Mark done"></button>' +
        '<button class="inv-td-main" data-action="invTodoEdit" data-id="' + escHtml(t.id) + '"><span class="inv-td-title">' + escHtml(t.text) + '</span>' +
        (t.due ? '<span class="inv-td-sub inv-td-due-' + (r.tone || 'none') + '">' + escHtml(todoDueLabel(t.due)) + '</span>' : '') + '</button>' +
        '<span class="inv-td-lbl inv-td-lbl-mine">Mine</span></div>';
    }
  });
  el.innerHTML = h + '</div>';
}

function todoRefreshViews() {
  var page = document.querySelector('.inv-page-active');
  if (page && page.id === 'pageTodo') renderTodo();
  renderTodoHomeCard();
  updateStockBadge();
}

/* ---------- Overlays ---------- */
function todoOverlay(title, body) {
  closeOverlay();
  var scrim = document.createElement('div');
  scrim.className = 'inv-overlay-scrim';
  scrim.innerHTML = '<div class="inv-overlay-card"><div class="inv-overlay-header"><span class="inv-overlay-title">' + title + '</span>' +
    '<button class="inv-overlay-close" data-action="invCloseOverlay" aria-label="Close">&times;</button></div>' + body + '</div>';
  scrim.addEventListener('click', function(e) { if (e.target === scrim) closeOverlay(); });
  pushFocus();
  document.body.appendChild(scrim);
  focusFirstInteractive(scrim.querySelector('.inv-overlay-card'));
}

function todoOpenApp(key) {
  var t = todoAppAll().find(function(x) { return x.key === key; });
  if (!t) { showToast('That has cleared itself'); todoRefreshViews(); return; }
  var s = todoData().snoozes[key];
  var h = '<div class="inv-td-ohead"><span class="inv-td-lbl inv-td-lbl-app">App</span><span class="inv-td-why">' + escHtml(t.why) + '</span></div>' +
    '<div class="inv-td-otitle">' + escHtml(t.title) + '</div>' +
    '<div class="inv-td-facts">' + t.facts.map(function(f) {
      return '<div><span>' + escHtml(f[0]) + '</span><strong>' + escHtml(f[1]) + '</strong></div>';
    }).join('') + '</div>' +
    '<div class="inv-td-clears">' + escHtml(t.clears) + '</div>' +
    (s && todoIsSnoozed(t) ? '<div class="inv-td-clears">Snoozed ' + (s.until ? 'until ' + escHtml(stockShortDate(s.until)) : 'until the figures change') + '.</div>' : '') +
    '<div class="inv-btn-bar"><button class="inv-btn inv-btn-primary" data-action="invTodoGoApp" data-key="' + escHtml(key) + '">' + escHtml(t.goLabel) + '</button></div>' +
    '<div class="inv-stk-label inv-mt-16">Snooze</div><div class="inv-td-pills">' +
    '<button class="inv-td-pill" data-action="invTodoSnooze" data-key="' + escHtml(key) + '" data-v="sig">Until the figures change</button>' +
    '<button class="inv-td-pill" data-action="invTodoSnooze" data-key="' + escHtml(key) + '" data-v="7">1 week</button></div>';
  todoOverlay('From your data', h);
}

var TODO_LINK_KINDS = [['', 'Nothing'], ['client', 'Client'], ['invoice', 'Invoice'], ['challan', 'Challan'], ['stock', 'Stock line']];
function todoLinkOptions(kind, sel) {
  var opts = [];
  if (kind === 'client') opts = S.clients.filter(function(c) { return c.isActive !== false; })
    .sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); }).map(function(c) { return [String(c.id), c.name]; });
  else if (kind === 'invoice') opts = S.invoices.slice().sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).slice(0, 80)
    .map(function(i) { return [i.id, String(i.displayNumber || '').split('/').pop() + ' · ' + (i.clientName || '')]; });
  else if (kind === 'challan') opts = (S.incomingMaterial || []).filter(function(im) { return im.clientId !== 9999 || im.items.length; })
    .slice().sort(function(a, b) { return String(b.challanDate).localeCompare(String(a.challanDate)); }).slice(0, 80)
    .map(function(im) { return [im.id, 'Ch ' + (im.challanNo || '—') + ' · ' + (im.clientName || '')]; });
  else if (kind === 'stock') opts = stockData().items.filter(function(i) { return i.active !== false; }).map(function(i) { return [i.id, i.name]; });
  if (!kind) return '';
  return '<option value="">Pick one</option>' + opts.map(function(o) {
    return '<option value="' + escHtml(o[0]) + '"' + (String(o[0]) === String(sel) ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>';
  }).join('');
}
function todoOpenEdit(id, text) {
  var t = id ? todoData().tasks.find(function(x) { return x.id === id; }) : null;
  if (id && !t) return;
  var v = t || { text: text || '', due: '', note: '', link: null };
  var kind = v.link ? v.link.kind : '';
  var h = '<div class="inv-form-group"><label class="inv-form-label" for="todoText">Task</label>' +
    '<input class="inv-form-input" id="todoText" value="' + escHtml(v.text) + '" autocomplete="off"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="todoDue">Due</label>' +
    '<div class="inv-td-pills"><button class="inv-td-pill" data-action="invTodoDue" data-v="0">Today</button>' +
    '<button class="inv-td-pill" data-action="invTodoDue" data-v="1">Tomorrow</button>' +
    '<button class="inv-td-pill" data-action="invTodoDue" data-v="">None</button></div>' +
    '<input type="date" class="inv-form-input inv-mono inv-mt-8" id="todoDue" value="' + escHtml(v.due || '') + '"></div>' +
    '<div class="inv-form-row"><div class="inv-form-group"><label class="inv-form-label" for="todoLinkKind">Link to</label>' +
    '<select class="inv-form-select" id="todoLinkKind">' + TODO_LINK_KINDS.map(function(k) {
      return '<option value="' + k[0] + '"' + (k[0] === kind ? ' selected' : '') + '>' + k[1] + '</option>';
    }).join('') + '</select></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="todoLinkId">Which</label>' +
    '<select class="inv-form-select" id="todoLinkId"' + (kind ? '' : ' disabled') + '>' + todoLinkOptions(kind, v.link ? v.link.id : '') + '</select></div></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="todoNote">Note</label>' +
    '<textarea class="inv-form-input" id="todoNote" rows="2">' + escHtml(v.note || '') + '</textarea></div>' +
    '<div class="inv-btn-bar">' + (t && !t.doneAt ? '<button class="inv-btn inv-btn-ghost" data-action="invTodoToggle" data-id="' + escHtml(t.id) + '">Mark done</button>' : '') +
    '<button class="inv-btn inv-btn-primary" data-action="invTodoSave" data-id="' + escHtml(t ? t.id : '') + '">Save</button></div>';
  todoOverlay(t ? 'Task' : 'New task', h);
}
function todoSaveEdit(id) {
  var text = (document.getElementById('todoText') || {}).value || '';
  text = text.trim();
  if (!text) { showToast('A task needs some words', 'error'); return; }
  var kind = (document.getElementById('todoLinkKind') || {}).value || '';
  var linkSel = document.getElementById('todoLinkId');
  var link = null;
  if (kind && linkSel && linkSel.value) {
    var opt = linkSel.options[linkSel.selectedIndex];
    link = { kind: kind, id: linkSel.value, label: opt ? opt.textContent : '' };
  }
  var td = todoData();
  var t = id ? td.tasks.find(function(x) { return x.id === id; }) : null;
  if (!t) { t = { id: todoUid(), createdAt: Date.now(), doneAt: null }; td.tasks.push(t); }
  t.text = text;
  t.due = (document.getElementById('todoDue') || {}).value || '';
  t.note = ((document.getElementById('todoNote') || {}).value || '').trim();
  t.link = link;
  t.updatedAt = Date.now();
  saveState();
  closeOverlay();
  todoRefreshViews();
  showToast('Saved');
}
function todoQuickAdd() {
  var inp = document.getElementById('todoNew');
  var text = inp ? inp.value.trim() : '';
  if (!text) { if (inp) inp.focus(); return; }
  todoData().tasks.push({ id: todoUid(), text: text, due: '', note: '', link: null, createdAt: Date.now(), doneAt: null });
  saveState();
  renderTodo();
  var again = document.getElementById('todoNew');
  if (again) again.focus();
}
function todoToggle(id, by) {
  var t = todoData().tasks.find(function(x) { return x.id === id; });
  if (!t) return;
  if (t.doneAt) { t.doneAt = null; delete t.doneBy; }
  else { t.doneAt = Date.now(); t.doneBy = by || 'app'; }
  saveState();
  if (document.querySelector('.inv-overlay-scrim')) closeOverlay();
  todoRefreshViews();
}
function todoSnooze(key, v) {
  var t = todoAppAll().find(function(x) { return x.key === key; });
  if (!t) return;
  var td = todoData();
  // A snooze whose task has cleared describes nothing; drop those while writing.
  var live = {};
  todoAppAll().forEach(function(x) { live[x.key] = true; });
  Object.keys(td.snoozes).forEach(function(k) { if (!live[k]) delete td.snoozes[k]; });
  td.snoozes[key] = v === 'sig' ? { sig: t.sig, until: '', at: Date.now() } : { sig: t.sig, until: stockIsoAdd(todoToday(), parseInt(v, 10) || 7), at: Date.now() };
  saveState();
  closeOverlay();
  todoRefreshViews();
  showToast(v === 'sig' ? 'Snoozed until the figures change' : 'Snoozed for a week');
}

/* ---------- Going to the thing ---------- */
function todoGo(go) {
  if (!go) return;
  closeOverlay();
  switch (go.kind) {
    case 'stock': _stockItemId = go.id; _stockView = 'item'; switchTab('pageStock'); break;
    case 'stockPaste': _stockView = 'paste'; switchTab('pageStock'); break;
    case 'cnBatch':
      regFilter.clientId = String(go.clientId); regFilter.month = ''; regFilter.search = ''; regFilter.state = '';
      regFilter.dateFrom = go.from; regFilter.dateTo = go.to;
      saveRegFilter();
      _regSelected = {};
      go.ids.forEach(function(id) { _regSelected[id] = true; });
      _regSelectMode = true;
      _regToolbarRendered = false;
      _tabDirty.register = true;
      switchTab('pageRegister');
      _renderRegSelBar();
      break;
    case 'regState':
      regFilter.clientId = ''; regFilter.month = ''; regFilter.dateFrom = ''; regFilter.dateTo = ''; regFilter.search = ''; regFilter.state = go.state;
      saveRegFilter(); _regSelected = {}; _regToolbarRendered = false; _tabDirty.register = true;
      switchTab('pageRegister');
      break;
    case 'im':
      _imFilter.clientId = String(go.clientId); _imFilter.status = 'pending'; _imToolbarRendered = false;
      switchTab('pageIM');
      break;
    case 'audit': switchTab('pageRegister'); showNumberAudit(); break;
    case 'settings': openSettings(); break;
    case 'home': switchTab('pageHome'); break;
    case 'client': switchTab('pageClients'); openClientEdit(parseInt(go.id, 10)); break;
    case 'invoice': openInvoiceDetail(go.id); break;
    case 'challan': switchTab('pageIM'); editChallan(go.id); break;
  }
}
function todoGoLink(id) {
  var t = todoData().tasks.find(function(x) { return x.id === id; });
  if (!t || !t.link) return;
  var l = t.link;
  var exists = l.kind === 'client' ? S.clients.some(function(c) { return String(c.id) === String(l.id); })
    : l.kind === 'invoice' ? S.invoices.some(function(i) { return i.id === l.id; })
    : l.kind === 'challan' ? (S.incomingMaterial || []).some(function(im) { return im.id === l.id; })
    : !!stockItem(l.id);
  if (!exists) { showToast(todoLinkLabel(l) + ' is no longer in the app', 'warning'); return; }
  todoGo({ kind: l.kind, id: l.id });
}

/* ---------- Settings ---------- */
function todoSettingsHtml() {
  var c = todoCfg();
  return '<div class="inv-settings-section"><div class="inv-settings-title">To-do</div>' +
    '<div class="inv-text-muted inv-storage-text">What the app raises from your data. Each task clears itself when the thing is fixed.</div>' +
    TODO_RULES.map(function(r) {
      return '<label class="inv-checkbox-label inv-td-rule"><input type="checkbox" id="setTodo_' + r[0] + '"' + (c[r[0]] ? ' checked' : '') + '> ' + escHtml(r[1]) + '</label>';
    }).join('') +
    '<div class="inv-form-row inv-mt-8"><div class="inv-form-group"><label class="inv-form-label" for="setTodoChallan">Challan unbilled after (days)</label>' +
    '<input type="number" step="1" min="1" class="inv-form-input inv-mono" id="setTodoChallan" value="' + c.challanDays + '"></div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="setTodoBackup">Backup older than (days)</label>' +
    '<input type="number" step="1" min="1" class="inv-form-input inv-mono" id="setTodoBackup" value="' + c.backupDays + '"></div></div>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm inv-mt-8" data-action="invTodoWidgetCheck">Check Windows widget</button>' +
    '<div id="todoWidgetStatus" class="inv-td-wstatus"></div></div>';
}

/* Why the Windows widget is not on the board. Every step is a condition only
   this device can see — the browser, the install, and what Edge's widget host
   told the service worker — so the check runs here and says which step failed
   and what to do, rather than a list of everything that might be wrong. */
function todoWidgetEnv() {
  var ua = navigator.userAgent || '';
  var brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  var standalone = false;
  try { standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches; } catch (e) { /* old engine */ }
  return {
    edge: /Edg\//.test(ua) || brands.some(function(b) { return /Edge/.test(b.brand); }),
    windows: /Windows NT/.test(ua) || (navigator.userAgentData && navigator.userAgentData.platform === 'Windows'),
    installed: standalone,
    worker: !!(navigator.serviceWorker && navigator.serviceWorker.controller)
  };
}
function todoWidgetVerdict(env, st) {
  if (!env.windows) return ['bad', 'This is not Windows. The widget lives on the Windows 11 Widgets board; open the app on the PC.'];
  if (!env.edge) return ['bad', 'This is not Microsoft Edge. Only an app installed from Edge can add a widget: open the site in Edge and install it from there.'];
  if (!env.installed) return ['bad', 'The app is open in a browser tab, not installed. In Edge: menu (…) → Apps → Install this site as an app, then run this check from the installed app.'];
  if (!env.worker) return ['bad', 'The offline worker is not running yet. Reload the app once and check again.'];
  if (!st) return ['bad', 'The worker did not answer. Reload the app and check again.'];
  if (!st.api) return ['bad', 'Edge is not offering widgets on this PC. Turn on Settings → System → For developers → Developer Mode, install Windows App SDK 1.2, restart the PC, then check again.'];
  if (!st.defined) return ['bad', 'Edge has not picked up the widget from this app. Uninstall the app (Edge → Apps → Manage apps), install it again from Edge, then check again.'];
  if (st.error) return ['bad', 'Edge refused the widget: ' + st.error];
  if (!st.instances) return ['ok', 'Ready. Press Win+W → Add widgets (+) → SEP To-do → Pin.'];
  return ['ok', 'The widget is on the board (' + st.instances + '), and was refreshed just now.'];
}
function todoWidgetCheck() {
  var box = document.getElementById('todoWidgetStatus');
  if (!box) return;
  var env = todoWidgetEnv();
  var show = function(st) {
    var v = todoWidgetVerdict(env, st);
    var line = function(ok, text) { return '<div class="inv-td-wline inv-td-wline-' + (ok ? 'ok' : 'no') + '">' + (ok ? 'Yes: ' : 'No: ') + escHtml(text) + '</div>'; };
    box.innerHTML = '<div class="inv-td-wverdict inv-td-wverdict-' + v[0] + '">' + escHtml(v[1]) + '</div>' +
      line(env.windows, 'Windows') + line(env.edge, 'Microsoft Edge') + line(env.installed, 'Installed as an app') +
      line(env.worker, 'Offline worker running') + line(!!(st && st.api), 'Edge widgets available') +
      line(!!(st && st.defined), 'Widget registered with Edge') + line(!!(st && st.instances), 'Widget on the board');
  };
  if (!env.worker) { show(null); return; }
  box.textContent = 'Checking…';
  var done = false;
  var onMsg = function(e) {
    if (!e.data || e.data.type !== 'sep-widget-status' || done) return;
    done = true;
    navigator.serviceWorker.removeEventListener('message', onMsg);
    show(e.data);
  };
  navigator.serviceWorker.addEventListener('message', onMsg);
  navigator.serviceWorker.controller.postMessage({ type: 'sep-widget-status' });
  setTimeout(function() { if (!done) { done = true; navigator.serviceWorker.removeEventListener('message', onMsg); show(null); } }, 3000);
}
function todoSettingsSave() {
  if (!document.getElementById('setTodo_stock')) return;
  if (!S.todoCheck || typeof S.todoCheck !== 'object') S.todoCheck = {};
  TODO_RULES.forEach(function(r) {
    var el = document.getElementById('setTodo_' + r[0]);
    if (el) S.todoCheck[r[0]] = !!el.checked;
  });
  var ch = parseFloat((document.getElementById('setTodoChallan') || {}).value);
  if (ch > 0) S.todoCheck.challanDays = ch;
  var bk = parseFloat((document.getElementById('setTodoBackup') || {}).value);
  if (bk > 0) S.todoCheck.backupDays = bk;
}
function todoNoteExport() {
  try { localStorage.setItem(TODO_LAST_EXPORT_KEY, String(Date.now())); } catch (e) { /* per-device only */ }
}

/* ---------- The widget's store ----------
   Its own database, so the widget never touches the book: the service worker
   reads 'payload' and appends to 'queue'; only the app writes S. */
var TODO_WIDGET_DB = 'sep-invoicing-widget';
var _todoWidgetDb = null;
function todoWidgetDb() {
  if (_todoWidgetDb) return Promise.resolve(_todoWidgetDb);
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(function(resolve) {
    var req;
    try { req = indexedDB.open(TODO_WIDGET_DB, 1); } catch (e) { resolve(null); return; }
    req.onupgradeneeded = function() { req.result.createObjectStore('kv'); };
    req.onsuccess = function() {
      _todoWidgetDb = req.result;
      _todoWidgetDb.onversionchange = function() { try { _todoWidgetDb.close(); } catch (e) {} _todoWidgetDb = null; };
      resolve(_todoWidgetDb);
    };
    req.onerror = req.onblocked = function() { resolve(null); };
  });
}
function todoWidgetPut(key, val) {
  return todoWidgetDb().then(function(db) {
    if (!db) return false;
    return new Promise(function(resolve) {
      var tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(val, key);
      tx.oncomplete = function() { resolve(true); };
      tx.onerror = tx.onabort = function() { resolve(false); };
    });
  });
}
function todoWidgetGet(key) {
  return todoWidgetDb().then(function(db) {
    if (!db) return null;
    return new Promise(function(resolve) {
      var req = db.transaction('kv', 'readonly').objectStore('kv').get(key);
      req.onsuccess = function() { resolve(req.result == null ? null : req.result); };
      req.onerror = function() { resolve(null); };
    });
  });
}
/* Read the queue and empty it in ONE transaction, so a Done the worker adds
   between the read and the clear cannot be lost. */
function todoWidgetTakeQueue() {
  return todoWidgetDb().then(function(db) {
    if (!db) return [];
    return new Promise(function(resolve) {
      var tx = db.transaction('kv', 'readwrite'), store = tx.objectStore('kv'), got = [];
      var req = store.get('queue');
      req.onsuccess = function() { got = Array.isArray(req.result) ? req.result : []; if (got.length) store.put([], 'queue'); };
      tx.oncomplete = function() { resolve(got); };
      tx.onerror = tx.onabort = function() { resolve([]); };
    });
  });
}
function todoApplyWidgetQueue() {
  if (!S) return Promise.resolve(0);
  return todoWidgetTakeQueue().then(function(q) {
    var n = 0;
    q.forEach(function(e) {
      var t = todoData().tasks.find(function(x) { return x.id === e.id; });
      if (t && !t.doneAt) { t.doneAt = e.at || Date.now(); t.doneBy = 'widget'; n++; }
    });
    if (n) { saveState(); todoRefreshViews(); }
    return n;
  });
}

/* What the widget shows: at most eight rows, the first three for the medium
   size; `big` rows only render on the large one. */
function todoWidgetPayload() {
  var ranked = todoRanked(), late = ranked.filter(function(r) { return r.tone === 'red'; }).length;
  var colour = { red: 'Attention', amber: 'Warning' };
  var rows = ranked.slice(0, 8).map(function(r, i) {
    var row;
    if (r.app) row = { rid: 'a:' + r.app.key, id: '', text: r.app.title, sub: r.app.sub, mine: false };
    else row = { rid: 'm:' + r.mine.id, id: r.mine.id, text: r.mine.text,
      sub: r.mine.due ? 'due ' + todoDueLabel(r.mine.due).toLowerCase() : (r.mine.note || 'no date'), mine: true };
    row.color = colour[r.tone] || 'Default';
    row.weight = colour[r.tone] ? 'Bolder' : 'Default';
    row.late = r.tone === 'red';
    row.big = i >= 3;
    return row;
  });
  var d = new Date();
  return { open: ranked.length, late: late, title: todoWidgetTitle(ranked.length, late),
    updated: 'Updated ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
    rows: rows, empty: rows.length === 0, more: ranked.length > 3 ? '+' + (ranked.length - 3) + ' more' : '' };
}
function todoWidgetTitle(open, late) {
  return open ? open + ' open' + (late ? ' · ' + late + ' late' : '') : 'Nothing due';
}
var _todoPubTimer = null;
function todoWidgetSchedule() {
  clearTimeout(_todoPubTimer);
  _todoPubTimer = setTimeout(todoWidgetPublish, 1500);
}
/* Apply what the widget queued first, so the payload never brings back a task
   the widget has already ticked. Then write it and ask the worker to redraw. */
function todoWidgetPublish() {
  clearTimeout(_todoPubTimer);
  if (!S) return Promise.resolve(false);
  return todoApplyWidgetQueue().then(function() {
    return todoWidgetPut('payload', todoWidgetPayload());
  }).then(function(ok) {
    try {
      if (ok && navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'sep-todo-widget' });
      }
    } catch (e) { /* no worker: the widget redraws on its next wake */ }
    return ok;
  }).catch(function() { return false; });
}

/* The widget opened the app, or ticked something while it was open. */
function todoOnWorkerMessage(msg) {
  if (!msg || !S) return;
  if (msg.type === 'sep-todo-done') todoApplyWidgetQueue();
  else if (msg.type === 'sep-todo-open') todoHandleLaunch(msg.action || '');
}
function todoHandleLaunch(action) {
  if (!action) return;
  todoApplyWidgetQueue();
  switchTab('pageTodo');
  if (action === 'add') {
    var inp = document.getElementById('todoNew');
    if (inp) inp.focus();
  } else if (action.indexOf('open:a:') === 0) todoOpenApp(action.slice(7));
  else if (action.indexOf('open:m:') === 0) todoOpenEdit(action.slice(7));
}

/* ---------- Actions ---------- */
function todoAction(action, btn) {
  switch (action) {
    case 'invTodoAdd': todoQuickAdd(); break;
    case 'invTodoWidgetCheck': todoWidgetCheck(); break;
    case 'invTodoNew': todoOpenEdit('', (document.getElementById('todoNew') || {}).value || ''); break;
    case 'invTodoEdit': todoOpenEdit(btn.dataset.id); break;
    case 'invTodoSave': todoSaveEdit(btn.dataset.id); break;
    case 'invTodoToggle': todoToggle(btn.dataset.id); break;
    case 'invTodoOpenApp': todoOpenApp(btn.dataset.key); break;
    case 'invTodoGoApp': {
      var t = todoAppAll().find(function(x) { return x.key === btn.dataset.key; });
      if (t) todoGo(t.go);
      break;
    }
    case 'invTodoGo': todoGoLink(btn.dataset.id); break;
    case 'invTodoSnooze': todoSnooze(btn.dataset.key, btn.dataset.v); break;
    case 'invTodoWake': delete todoData().snoozes[btn.dataset.key]; saveState(); renderTodo(); break;
    case 'invTodoFoldDone': _todoShowDone = !_todoShowDone; renderTodo(); break;
    case 'invTodoFoldSnoozed': _todoShowSnoozed = !_todoShowSnoozed; renderTodo(); break;
    case 'invTodoDue': {
      var inp = document.getElementById('todoDue');
      if (inp) inp.value = btn.dataset.v === '' ? '' : stockIsoAdd(todoToday(), parseInt(btn.dataset.v, 10));
      break;
    }
  }
}
/* The link picker: only the second select is rebuilt, so the first keeps the
   popup it is standing on. */
function todoOnChange(t) {
  if (!t || t.id !== 'todoLinkKind') return false;
  var sel = document.getElementById('todoLinkId');
  if (sel) { sel.innerHTML = todoLinkOptions(t.value, ''); sel.disabled = !t.value; }
  return true;
}
