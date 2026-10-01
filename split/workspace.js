/* ===== WORKSPACES: THE SHELL OF DIRECTION B =====
   Owner, 1 Oct 2026 (docs/DIRECTION_B.md): the phone bar is Today · Office · Add · Floor · Money, with no More; the
   desktop sidebar is Add · Search · each workspace with its views · Settings. Most of the day is entering things and
   checking them, and that was spread over five pages, four of them behind More.

   A workspace is a layer over the pages that exist. Every page keeps its id, its address (?tab=pageIM&v=…), its renderer
   and its own view tabs; a workspace names the pages it holds and draws their tab row above the page. So a link, a To-do
   jump, a bookmark and every spec that opens pageIM still lands on it, now inside Office.

   The map is here and nowhere else (WORKSPACES): the phone bar, the tab row, the sidebar, swiping, the red counts and the
   top bar's names all read it. A page not in the DOM is left out (wsViewsPresent), so the steps that add Pipeline and Day
   fit in as they land. Today's two views, Needs you and Pulse, are pageHome's own `v`: drawn once pageHome says it has
   them (`homeViews`, the Today step's), and opened as places through nav.js (navOpen), which takes the step and applies
   the view. A page a workspace holds without a tab (Create in Office, the To-do in Today) lights its workspace and is
   named in the top bar. Insights has no item on the phone bar: it is reached from Today → Pulse and from search. */

var WS_ICONS = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  office: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  floor: '<path d="M3 20h18M5 20V10l4 3V10l4 3V6l6 4v10M8 16h1M12 16h1M16 16h1"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  insights: '<path d="M4 20V11M10 20V5M16 20v-6M3 20h18"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4"/>'
};
function wsSvg(k) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + WS_ICONS[k] + '</svg>';
}

/* The map. `views` are the tabs, in order: {tab, v?, label}. `members` are pages held without a tab. `bar`: an item on the
   phone bar (Add stands between Office and Floor). */
var WORKSPACES = [
  { id: 'today', label: 'Today', icon: 'today', bar: true,
    views: [{ tab: 'pageHome', v: 'needs', label: 'Needs you' }, { tab: 'pageHome', v: 'pulse', label: 'Pulse' }], members: ['pageTodo'] },
  { id: 'office', label: 'Office', icon: 'office', bar: true,
    views: [{ tab: 'pagePipeline', label: 'Pipeline' }, { tab: 'pageIM', label: 'Challans' }, { tab: 'pageRegister', label: 'Invoices' }, { tab: 'pageClients', label: 'Clients' }],
    members: ['pageCreate'] },
  { id: 'floor', label: 'Floor', icon: 'floor', bar: true,
    views: [{ tab: 'pageFloor', label: 'Day' }, { tab: 'pageStaff', label: 'People' }, { tab: 'pageProduction', label: 'Production' }, { tab: 'pageStock', label: 'Stock' }, { tab: 'pagePower', label: 'Power' }],
    members: [] },
  { id: 'money', label: 'Money', icon: 'money', bar: true, views: [{ tab: 'pageFinance', label: 'Money' }], members: [] },
  { id: 'insights', label: 'Insights', icon: 'insights', bar: false,
    views: [{ tab: 'pageStats', label: 'Stats' }, { tab: 'pageReports', label: 'Reports' }, { tab: 'pageHistory', label: 'History' }], members: [] }
];

function wsGet(id) { return WORKSPACES.filter(function(w) { return w.id === id; })[0] || null; }
/* The workspace holding a page, as its id; null for a page no workspace names. */
function wsOf(tabId) {
  for (var i = 0; i < WORKSPACES.length; i++) {
    var w = WORKSPACES[i];
    if (w.views.some(function(x) { return x.tab === tabId; }) || w.members.indexOf(tabId) >= 0) return w.id;
  }
  return null;
}
/* A workspace's views whose page is in the DOM. Today's two are pageHome's own views, drawn once pageHome declares them;
   until then Today is pageHome alone, and has no tab row. */
function wsViewsPresent(ws) {
  var w = typeof ws === 'string' ? wsGet(ws) : ws;
  if (!w) return [];
  var views = w.views;
  if (w.id === 'today' && typeof homeViews !== 'function') views = [{ tab: 'pageHome', v: '', label: w.label }];
  return views.filter(function(x) { return isPageId(x.tab); });
}
/* Which of `views` the app is on: the page, and for a view carrying `v` (Today's) the page's own view. -1 for a page held
   without a tab. */
function wsViewOn(views, tabId) {
  var mine = views.filter(function(x) { return x.tab === tabId; });
  if (!mine.length) return -1;
  var hit = mine[0];
  if (mine.length > 1 || hit.v) {
    var v = String(navLoc().v || '').split('/')[0];
    hit = mine.filter(function(x) { return x.v === v; })[0] || mine[0];
  }
  return views.indexOf(hit);
}
/* What a page is called in B (the view's label: Invoices, People, Money), else its own title (Create invoice, To-do). */
function wsPageName(tabId, v) {
  var w = wsGet(wsOf(tabId)), views = w ? wsViewsPresent(w) : [];
  var mine = views.filter(function(x) { return x.tab === tabId; });
  var hit = mine.filter(function(x) { return !x.v || x.v === v; })[0] || mine[0];
  return hit ? hit.label : (PAGE_TITLES[tabId] || 'SEP Invoicing');
}
function wsLabelOf(tabId) { var w = wsGet(wsOf(tabId)); return w ? w.label : ''; }

/* ---------- Opening ---------- */
/* A view: a page (switchTab), or a page on one of its own views (a new step through nav.js, which applies the view). */
function wsShowView(view) {
  if (view.v) navOpen({ tab: view.tab, v: view.v, id: '' });
  else switchTab(view.tab);
}
/* A workspace tab or a sidebar entry (invSwitchTab): a Today view carries data-v. */
function wsSwitchTab(tab, v) {
  if (v) wsShowView({ tab: tab, v: v });
  else switchTab(tab);
}

/* The view last open in each workspace this session, a page it holds without a tab included: Office reopens an invoice
   being typed on Create. Per tab (sessionStorage), like the trail. */
var WS_LAST_KEY = 'sep_inv_ws_last';
var _wsLast = (function() { try { return JSON.parse(sessionStorage.getItem(WS_LAST_KEY) || '{}') || {}; } catch (e) { return {}; } })();
function wsLastPut(id, view) {
  var was = _wsLast[id];
  if (was && was.tab === view.tab && (was.v || '') === (view.v || '')) return;
  _wsLast[id] = { tab: view.tab, v: view.v || '' };
  try { sessionStorage.setItem(WS_LAST_KEY, JSON.stringify(_wsLast)); } catch (e) { /* a convenience only */ }
}
/* Where a bar item or a sidebar head leads: the view last open in its workspace this session, else the first; for the
   workspace open, its first view. A view {tab, v}, or null (search's new window reads it without going there). */
function wsTarget(id) {
  var w = wsGet(id), views = w ? wsViewsPresent(w) : [];
  if (!views.length) return null;
  if (wsOf(navPageOf()) === w.id) return views[0];
  var last = _wsLast[w.id];
  if (last && isPageId(last.tab) && wsOf(last.tab) === w.id) {
    return views.filter(function(x) { return x.tab === last.tab && (!x.v || x.v === last.v); })[0] || { tab: last.tab, v: '' };
  }
  return views[0];
}
/* A bar item or a sidebar head. The open workspace's own item goes to its first view, at the top. */
function wsGo(id) {
  var view = wsTarget(id), open = wsOf(navPageOf()) === id;
  if (!view) return;
  wsShowView(view);
  if (open) viewTop();
}
/* Swiping moves between the open workspace's views and stops at its ends; never across workspaces (swipe.js). */
function wsSwipeTarget(dir) {
  var tab = navPageOf(), w = wsGet(wsOf(tab)), views = w ? wsViewsPresent(w) : [], on = wsViewOn(views, tab);
  if (on < 0) return null;
  return views[on + dir] || null;
}

/* ---------- Drawing ---------- */
/* The phone bar, from the map: Today · Office · Add · Floor · Money. Add is the shell's one primary (data-shell-primary,
   which P76's one-primary-per-view check knows is not a view's). Drawn at load: it needs no book. */
function wsRenderBar() {
  var nav = document.querySelector('.inv-navbar');
  if (!nav) return;
  var item = function(w) {
    return '<button class="inv-navbar-item" data-action="invWsGo" data-ws="' + w.id + '">' + wsSvg(w.icon) + w.label +
      '<span class="inv-navbar-count inv-hidden" data-ws-count="' + w.id + '"></span></button>';
  };
  var bar = WORKSPACES.filter(function(w) { return w.bar; });
  nav.innerHTML = bar.slice(0, 2).map(item).join('') +
    '<button class="inv-navbar-item inv-navbar-add" data-action="invAddOpen" data-shell-primary><span class="inv-navbar-add-mark">' + wsSvg('add') + '</span>Add</button>' +
    bar.slice(2).map(item).join('');
}
wsRenderBar();

/* Everything the shell says about the page on screen: the bar's workspace, the workspace's tab row, the top bar's name,
   the sidebar's mark, and the view remembered for the workspace. From switchTab once the page is drawn, and after every
   move (navBarDraw), so a view changed inside a page (Today's) is shown too. */
var _wsRowSig = null;
function wsShellDraw(tabId) {
  tabId = tabId || navPageOf();
  var id = wsOf(tabId), w = wsGet(id), views = w ? wsViewsPresent(w) : [], on = wsViewOn(views, tabId);
  document.querySelectorAll('.inv-navbar-item[data-ws]').forEach(function(b) { b.classList.toggle('inv-navbar-item-on', b.dataset.ws === id); });
  // The top bar names the workspace; the pressed tab names the view. On the phone a page held without a tab names itself.
  // On the desktop the page, its view and the record follow ("Office › Challans · Awaiting invoice"), read off the place
  // the app is at, so a jump made without a tap is named too.
  var title = document.getElementById('topbarTitle'), ctx = document.getElementById('topbarCtx');
  if (title) title.textContent = !w ? (PAGE_TITLES[tabId] || 'SEP Invoicing') : (!_isDesktop && on < 0 ? PAGE_TITLES[tabId] || w.label : w.label);
  if (ctx) { var loc = navLoc(); ctx.textContent = _isDesktop ? navPlaceText(Object.assign({ loc: loc }, navLabel(loc)), true) : ''; }
  wsDrawRow(w, views, on);
  markSideActive(tabId);
  if (w) wsLastPut(w.id, { tab: tabId, v: on >= 0 ? views[on].v : '' });
}
/* The tab row of a workspace of two or more views (Money has none): under the top bar on the phone, in it on the desktop
   (§4.2). Each tab is a door the fixtures' switchTab finds (invSwitchTab, data-tab, data-v for Today's). */
function wsDrawRow(w, views, on) {
  var row = document.getElementById('wsTabs'), bar = document.querySelector('.inv-topbar');
  if (!row || !bar) return;
  if (_isDesktop) { if (row.parentNode !== bar) bar.insertBefore(row, bar.querySelector('.inv-topbar-spacer')); }
  else if (row.previousElementSibling !== bar) bar.after(row);
  var show = !!w && views.length > 1;
  var sig = show ? w.id + '|' + views.map(function(x) { return x.tab + '/' + (x.v || ''); }).join(',') + '|' + on : '';
  if (sig !== _wsRowSig) {
    _wsRowSig = sig;
    row.innerHTML = show ? views.map(function(x, i) {
      return '<button class="inv-viewtab" role="tab" aria-selected="' + (i === on) + '" data-action="invSwitchTab" data-tab="' + x.tab + '"' +
        (x.v ? ' data-v="' + x.v + '"' : '') + '>' + escHtml(x.label) + '</button>';
    }).join('') : '';
    if (show) row.setAttribute('aria-label', w.label); else row.removeAttribute('aria-label');
    row.classList.toggle('inv-hidden', !show);
  }
  if (show) viewTabReveal(row);
}

/* The desktop sidebar (§4.2, DIRECTION_B): the brand · Add (the shell's primary, key A) · Search (Ctrl K) · each workspace,
   its views indented under it · Settings at the foot. A workspace of one view (Money; Today until it has its two) is that
   view's door; the head of one with more opens it as the bar does. A page holds one entry: Items and Pay are views inside
   Clients and People. */
function renderSidebar() {
  var existing = document.getElementById('invSidebar');
  if (existing) existing.remove();
  if (!_isDesktop) return;
  var door = function(x) { return 'data-action="invSwitchTab" data-tab="' + x.tab + '"' + (x.v ? ' data-v="' + x.v + '"' : ''); };
  var html = '<div class="inv-side-brand"><svg class="inv-side-mark" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="96"/>' +
    '<polygon points="256,106 385.9,181 385.9,331 256,406 126.1,331 126.1,181"/><polygon points="256,160 339.1,208 339.1,304 256,352 172.9,304 172.9,208"/><circle cx="256" cy="256" r="38"/></svg>' +
    '<span>Soma Electro</span></div>' +
    '<button class="inv-btn inv-btn-primary inv-btn-block" data-action="invAddOpen" data-shell-primary aria-keyshortcuts="A">' + wsSvg('add') +
    '<span class="inv-side-label">Add</span><kbd class="inv-kbd">A</kbd></button>' +
    '<button class="inv-side-item" data-action="invSearchOpen" aria-keyshortcuts="Control+K">' + wsSvg('search') +
    '<span class="inv-side-label">Search</span><kbd class="inv-kbd">Ctrl K</kbd></button>';
  WORKSPACES.forEach(function(w) {
    var views = wsViewsPresent(w);
    if (!views.length) return;
    var one = views.length === 1;
    html += '<button class="inv-side-item inv-mt-8" data-ws="' + w.id + '" ' + (one ? door(views[0]) : 'data-action="invWsGo"') + '>' + wsSvg(w.icon) +
      '<span class="inv-side-label">' + w.label + '</span><span class="inv-side-count" data-ws-count="' + w.id + '"></span></button>';
    if (!one) views.forEach(function(x) { html += '<button class="inv-side-item inv-side-item-sub" ' + door(x) + '><span class="inv-side-label">' + escHtml(x.label) + '</span></button>'; });
  });
  html += '<div class="inv-side-spacer"></div><button class="inv-side-item" data-action="invOpenSettings">' + wsSvg('settings') + '<span class="inv-side-label">Settings</span></button>';
  var sidebar = document.createElement('nav');
  sidebar.className = 'inv-side';
  sidebar.id = 'invSidebar';
  sidebar.setAttribute('aria-label', 'Main');
  sidebar.innerHTML = html;
  document.body.insertBefore(sidebar, document.body.firstChild);
  markSideActive(regFilter.activeTab || 'pageHome');
  wsUpdateCounts();
}
/* The page's own entry is on (aria-current). A page held without one (Create, the To-do) marks its workspace's head. */
function markSideActive(tabId) {
  var side = document.getElementById('invSidebar');
  if (!side) return;
  tabId = tabId || navPageOf();
  var id = wsOf(tabId), views = id ? wsViewsPresent(id) : [], on = wsViewOn(views, tabId), cur = on >= 0 ? views[on] : null;
  side.querySelectorAll('.inv-side-item[data-tab]').forEach(function(b) {
    var hit = !!cur && b.dataset.tab === cur.tab && (b.dataset.v || '') === (cur.v || '');
    b.classList.toggle('inv-side-item-on', hit);
    if (hit) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  side.querySelectorAll('.inv-side-item[data-ws]').forEach(function(b) {
    var held = !!id && b.dataset.ws === id && on < 0;
    if (held) b.classList.add('inv-side-item-on');
    else if (!b.dataset.tab) b.classList.remove('inv-side-item-on');
  });
}

/* ---------- The red counts ----------
   More carried every red row; the count moved to the bar (and the sidebar's heads). Each workspace carries the red app
   tasks whose jump lands in it; Today carries every red row, your own late tasks included (the old More count). A task
   with no jump, or one landing nowhere a workspace holds (Settings), counts on Today alone. Insights has no bar item: its
   tasks count on Today there, and on its head in the sidebar. */
var WS_GO_PAGE = {
  home: 'pageHome',
  im: 'pageIM', challan: 'pageIM',
  createFor: 'pageCreate',
  regState: 'pageRegister', register: 'pageRegister', audit: 'pageRegister', cnList: 'pageRegister', cnBatch: 'pageRegister', invoice: 'pageRegister',
  client: 'pageClients', perf: 'pageClients', quotes: 'pageClients', quoteDraft: 'pageClients',
  staffRoster: 'pageStaff', staffPaste: 'pageStaff', payDue: 'pageStaff', payWages: 'pageStaff', payWeek: 'pageStaff', areas: 'pageStaff',
  production: 'pageProduction', prodLines: 'pageProduction',
  stock: 'pageStock', stockPaste: 'pageStock', stockList: 'pageStock', reorder: 'pageStock',
  power: 'pagePower', powerCase: 'pagePower',
  finance: 'pageFinance', bills: 'pageFinance',
  stats: 'pageStats', liveCost: 'pageStats'
};
function wsOfGo(go) {
  var tab = go ? (isPageId(go.page) ? go.page : WS_GO_PAGE[go.kind]) : null;
  return (tab && wsOf(tab)) || 'today';
}
function wsRedCounts() {
  var n = {};
  WORKSPACES.forEach(function(w) { n[w.id] = 0; });
  if (!S) return n;
  var rows = [];
  // One pass over the rules for every count (each rule reads the whole book).
  try { rows = todoRanked(); } catch (e) { rows = []; }
  rows.forEach(function(r) {
    if (r.tone !== 'red') return;
    n.today++;
    if (r.app) { var id = wsOfGo(r.app.go); if (id !== 'today') n[id]++; }
  });
  return n;
}
function wsUpdateCounts() {
  if (!S) return;
  var n = wsRedCounts();
  document.querySelectorAll('[data-ws-count]').forEach(function(el) {
    var k = n[el.dataset.wsCount] || 0;
    el.textContent = k ? String(k) : '';
    if (el.classList.contains('inv-navbar-count')) el.classList.toggle('inv-hidden', !k);
    else el.className = 'inv-side-count' + (k ? ' inv-side-count-danger' : '');
  });
}

/* ---------- Doing ---------- */
/* Add and search are built in their own steps (add.js, search.js): absent, their buttons do nothing. */
function wsAction(action, btn) {
  switch (action) {
    case 'invWsGo': wsGo(btn.dataset.ws); return true;
    case 'invAddOpen': if (typeof addOpen === 'function') addOpen(); return true;
    case 'invSearchOpen': if (typeof searchOpen === 'function') searchOpen(); return true;
  }
  return false;
}
