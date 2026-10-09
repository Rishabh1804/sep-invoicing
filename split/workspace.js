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
   named in the top bar.

   Three levels, the same on both layouts (owner, 8 Oct 2026: "in the desktop view we have many tabs that are actually tabs
   that exist under a different tab but it is there on the sidebar … user will not understand the hierarchy"): a workspace
   is a door on the phone's bar or the desktop's rail, never anything under it; its views are the tab row under the top bar;
   a page's own views are the row under that.

   The tab map (docs/TAB_MAP.md, owner, 9 Oct 2026: "Go with all four recommendations"): four sections by subject. Today is
   the whole business (Needs you, Pulse, then its Insights: Stats, Reports, the Planner); Office the paperwork (Pipeline,
   Challans, Invoices, Clients, Sales); Floor the plant; Money the cash. History and Knowledge are tools in the top bar on
   every screen and belong to no section: no door lit, no row, no swipe. No row is wider than five. */

var WS_ICONS = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  office: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  floor: '<path d="M3 20h18M5 20V10l4 3V10l4 3V6l6 4v10M8 16h1M12 16h1M16 16h1"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4"/>'
};
function wsSvg(k) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + WS_ICONS[k] + '</svg>';
}

/* The map. `views` are the tabs, in order: {tab, v?, vs?, label, group?}; a view carrying `group` starts a group of its own,
   headed in the row by the group's name (Today's Insights). A view carrying `vs` covers several of its page's own views: it is
   on while the page shows any of them (Clients covers Clients, Parts and Performance; Sales covers Prospects and Quotations),
   and `v` is the one it opens first. `members` are pages held without a tab. `bar`: a door on the phone bar and the desktop
   rail (Add stands between Office and Floor, the bar's centre). */
var WORKSPACES = [
  { id: 'today', label: 'Today', icon: 'today', bar: true,
    views: [{ tab: 'pageHome', v: 'needs', label: 'Needs you' }, { tab: 'pageHome', v: 'pulse', label: 'Pulse' },
      { tab: 'pageStats', label: 'Stats', group: 'Insights' }, { tab: 'pageReports', label: 'Reports' }, { tab: 'pagePlanner', label: 'Planner' }],
    members: [] },
  { id: 'office', label: 'Office', icon: 'office', bar: true,
    views: [{ tab: 'pagePipeline', label: 'Pipeline' }, { tab: 'pageIM', label: 'Challans' }, { tab: 'pageRegister', label: 'Invoices' },
      { tab: 'pageClients', v: 'clients', vs: ['clients', 'items', 'performance'], label: 'Clients' },
      { tab: 'pageClients', v: 'prospects', vs: ['prospects', 'quotes'], label: 'Sales' }],
    members: ['pageCreate'] },
  { id: 'floor', label: 'Floor', icon: 'floor', bar: true,
    views: [{ tab: 'pageFloor', label: 'Overview' }, { tab: 'pageStaff', label: 'People' }, { tab: 'pageProduction', label: 'Production' }, { tab: 'pageStock', label: 'Stock' }, { tab: 'pagePower', label: 'Power' }],
    members: [] },
  { id: 'money', label: 'Money', icon: 'money', bar: true, views: [{ tab: 'pageFinance', label: 'Money' }], members: [] }
];
/* The page's own view a `vs` view stands for: the first part of the address's v while its page is on screen, else the one the
   page remembers (Clients' sub-view is kept on the device). */
function wsPageV(tabId) {
  if (navPageOf() === tabId) return String(navLoc().v || '').split('/')[0];
  return tabId === 'pageClients' && typeof getItemsSubView === 'function' ? getItemsSubView() : '';
}
function wsViewHas(x, v) { return x.v === v || (!!x.vs && x.vs.indexOf(v) >= 0); }

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
  // A role sees the views whose page it opens (guard.js, G3): a workspace left with none has no door at all.
  return views.filter(function(x) { return isPageId(x.tab) && (typeof grdSees !== 'function' || grdSees(x.tab)); });
}
/* Which of `views` the app is on: the page, and for a view carrying `v` (Today's) the page's own view. -1 for a page held
   without a tab. */
function wsViewOn(views, tabId) {
  var mine = views.filter(function(x) { return x.tab === tabId; });
  if (!mine.length) return -1;
  var hit = mine[0];
  if (mine.length > 1 || hit.v) {
    var v = String(navLoc().v || '').split('/')[0];
    hit = mine.filter(function(x) { return wsViewHas(x, v); })[0] || mine[0];
  }
  return views.indexOf(hit);
}
/* What a page is called in B (the view's label: Invoices, People, Money, Sales), else its own title (Create invoice). */
function wsPageName(tabId, v) {
  var w = wsGet(wsOf(tabId)), views = w ? wsViewsPresent(w) : [];
  var mine = views.filter(function(x) { return x.tab === tabId; });
  var hit = mine.filter(function(x) { return !x.v || wsViewHas(x, v); })[0] || mine[0];
  return hit ? hit.label : (PAGE_TITLES[tabId] || 'SEP Invoicing');
}
function wsLabelOf(tabId) { var w = wsGet(wsOf(tabId)); return w ? w.label : ''; }

/* ---------- Opening ---------- */
/* A view: a page (switchTab), or a page on one of its own views (a new step through nav.js, which applies the view). A view
   covering several (`vs`) opens the one its page was last on among them, else its first: Sales goes back to Quotations. */
function wsShowView(view) {
  var v = view.v;
  if (view.vs) {
    var cur = wsPageV(view.tab), was = _wsLast['vs:' + view.tab + '|' + view.v];
    if (view.vs.indexOf(cur) >= 0) v = cur;
    else if (was && view.vs.indexOf(was) >= 0) v = was;   // Clients from Sales: back onto Parts, where Clients was left
  }
  if (v) navOpen({ tab: view.tab, v: v, id: '' });
  else switchTab(view.tab);
}
/* A workspace tab or a sidebar entry (invSwitchTab): a view of a page's own carries data-v. */
function wsSwitchTab(tab, v) {
  if (!v) { switchTab(tab); return; }
  var w = wsGet(wsOf(tab)), x = w ? w.views.filter(function(y) { return y.tab === tab && y.v === v; })[0] : null;
  wsShowView(x || { tab: tab, v: v });
}

/* The view last open in each workspace this session, a page it holds without a tab included: Office reopens an invoice
   being typed on Create. Per tab (sessionStorage), like the trail. */
var WS_LAST_KEY = 'sep_inv_ws_last';
var _wsLast = (function() { try { return JSON.parse(sessionStorage.getItem(WS_LAST_KEY) || '{}') || {}; } catch (e) { return {}; } })();
/* A view covering several (`vs`) also remembers which of them it was last on: Clients and Sales share one page, whose own
   memory holds only the sub-view open now. */
function wsVsPut(view, v) {
  var k = 'vs:' + view.tab + '|' + view.v;
  if (!v || view.vs.indexOf(v) < 0 || _wsLast[k] === v) return;
  _wsLast[k] = v;
  try { sessionStorage.setItem(WS_LAST_KEY, JSON.stringify(_wsLast)); } catch (e) { /* a convenience only */ }
}
function wsLastPut(id, view) {
  var was = _wsLast[id];
  if (was && was.tab === view.tab && (was.v || '') === (view.v || '')) return;
  _wsLast[id] = { tab: view.tab, v: view.v || '' };
  try { sessionStorage.setItem(WS_LAST_KEY, JSON.stringify(_wsLast)); } catch (e) { /* a convenience only */ }
}
/* Where a bar item or a sidebar head leads: the view last open in its workspace this session, else the first; for the
   workspace open, its first view. A view {tab, v}, or null (search's new window reads it without going there).
   The view remembered is reopened only for a role that opens it: the person signed in now may not be the one who left it
   (the QA audit, QA2-6: the owner on Floor → People, then a role without Staff tapped Floor and was refused it every
   time). `views` are the role's already (wsViewsPresent); a page held without a tab (Create) is checked on its own. */
function wsTarget(id) {
  var w = wsGet(id), views = w ? wsViewsPresent(w) : [];
  if (!views.length) return null;
  if (wsOf(navPageOf()) === w.id) return views[0];
  var last = _wsLast[w.id];
  if (last && isPageId(last.tab) && wsOf(last.tab) === w.id) {
    var hit = views.filter(function(x) { return x.tab === last.tab && (!x.v || wsViewHas(x, last.v)); })[0];
    // A view covering several returns to the one that was open (Office's door back onto Quotations).
    if (hit) return hit.vs && last.v ? Object.assign({}, hit, { v: last.v }) : hit;
    if (w.members.indexOf(last.tab) >= 0 && (typeof grdSees !== 'function' || grdSees(last.tab))) return { tab: last.tab, v: '' };
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
/* A door of the bar and the rail: its mark (the icon, in a pill the workspace on screen fills) over its word, the red count on
   the mark's corner. One geometry for every door, Add's included, so the five words sit on one line. */
function wsDoorHtml(cls, attrs, icon, label, countId) {
  return '<button class="' + cls + '" ' + attrs + '><span class="inv-navbar-mark">' + wsSvg(icon) + '</span>' + label +
    (countId ? '<span class="inv-navbar-count inv-hidden" data-ws-count="' + countId + '"></span>' : '') + '</button>';
}
/* The phone bar, from the map: Today · Office · Add · Floor · Money, Add the centre of five (owner, 8 Oct 2026: "Move insights
   into office tab, that way we have 5 icons again, which can be arranged in a better way"; with Insights the bar's sixth, Add
   stood off its centre). Add is the shell's one primary (data-shell-primary, which P76's one-primary-per-view check knows is
   not a view's). Drawn at load: it needs no book. */
function wsRenderBar() {
  var nav = document.querySelector('.inv-navbar');
  if (!nav) return;
  var item = function(w) { return wsDoorHtml('inv-navbar-item', 'data-action="invWsGo" data-ws="' + w.id + '"', w.icon, w.label, w.id); };
  var bar = WORKSPACES.filter(function(w) { return w.bar; });
  nav.innerHTML = bar.slice(0, 2).map(item).join('') +
    wsDoorHtml('inv-navbar-item inv-navbar-add', 'data-action="invAddOpen" data-shell-primary', 'add', 'Add') +
    bar.slice(2).map(item).join('');
}
wsRenderBar();

/* Everything the shell says about the page on screen: the bar's workspace, the workspace's tab row, the top bar's name,
   the rail's mark, and the view remembered for the workspace. From switchTab once the page is drawn, and after every
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
  // The kind of screen on show (tabs.js): a view moved inside a page moves it too.
  if (typeof screenKindApply === 'function') screenKindApply();
  if (w && on >= 0 && views[on].vs) wsVsPut(views[on], wsPageV(tabId));
  if (w) wsLastPut(w.id, { tab: tabId, v: on < 0 ? '' : views[on].vs ? wsPageV(tabId) : views[on].v });
}
/* The tab row of a workspace of two or more views (Money has none), under the top bar on both layouts (§4.2): the second of
   the three levels. A view starting a group of its own follows the group's name (Office's Insights, `inv-viewtab-group`): on
   the phone the row runs past the screen, and the name waits at its right edge until the group is in view (sticky, §6.4); a
   tap on it brings the group in. Each tab is a door the fixtures' switchTab finds (invSwitchTab, data-tab, data-v for
   Today's). */
function wsDrawRow(w, views, on) {
  var row = document.getElementById('wsTabs'), bar = document.querySelector('.inv-topbar');
  if (!row || !bar) return;
  if (row.previousElementSibling !== bar) bar.after(row);
  var show = !!w && views.length > 1;
  var sig = show ? w.id + '|' + views.map(function(x) { return x.tab + '/' + (x.v || ''); }).join(',') + '|' + on : '';
  if (sig !== _wsRowSig) {
    _wsRowSig = sig;
    row.innerHTML = show ? views.map(function(x, i) {
      return (x.group && i ? '<span class="inv-viewtab-group" role="presentation" data-action="invWsGroup">' + escHtml(x.group) + '</span>' : '') +
        '<button class="inv-viewtab" role="tab" aria-selected="' + (i === on) + '" data-action="invSwitchTab" data-tab="' + x.tab + '"' +
        (x.v ? ' data-v="' + x.v + '"' : '') + '>' + escHtml(x.label) + '</button>';
    }).join('') : '';
    if (show) row.setAttribute('aria-label', w.label); else row.removeAttribute('aria-label');
    row.classList.toggle('inv-hidden', !show);
  }
  if (show) { wsRowFit(row); viewTabReveal(row); }
}
/* A group's name on the phone (the tab map, §3a-4: every row fits a phone). Where the row's views fit with the group set off by a
   rule, the name is that rule (`data-group="rule"`): Today's five views fit a 360 px phone so, and fit nothing with the word.
   Only where they do not fit is it the word, waiting at the row's right edge until the group comes into view (P183). The
   desktop's row fits and keeps its word behind a hairline. Again on a resize: a phone turned on its side. */
function wsRowFit(row) {
  row = row || document.getElementById('wsTabs');
  if (!row) return;
  if (_isDesktop || !row.querySelector('.inv-viewtab-group')) { row.removeAttribute('data-group'); return; }
  row.setAttribute('data-group', 'rule');
  if (row.scrollWidth > row.clientWidth + 1) row.setAttribute('data-group', 'word');
}
var _wsFitTimer = null;
window.addEventListener('resize', function() {
  clearTimeout(_wsFitTimer);
  _wsFitTimer = setTimeout(function() { wsRowFit(); }, 120);
});

/* The desktop rail (§4.2): the phone's bar stood on its side. The mark (it opens Pulse) · Add (the shell's primary, key A) ·
   the workspaces · Settings at the foot, each a door drawn as the bar draws it. A workspace's views are never listed here:
   they are its tab row, under the top bar, as on the phone (owner, 8 Oct 2026, above). Search is the top bar's field. */
function renderSidebar() {
  var existing = document.getElementById('invSidebar');
  if (existing) existing.remove();
  if (!_isDesktop) return;
  // The brand's mark opens Today → Pulse (owner, 8 Oct 2026: "Clicking on the company name (Soma Electro) or the icon on the
  // top left of the screen should take us back to the pulse screen, as today takes us to the needs you screen").
  var html = '<button type="button" class="inv-side-brand" data-action="invGoPulse" aria-label="Soma Electro: open Pulse" title="Soma Electro · Pulse"><svg class="inv-side-mark" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="96"/>' +
    '<polygon points="256,106 385.9,181 385.9,331 256,406 126.1,331 126.1,181"/><polygon points="256,160 339.1,208 339.1,304 256,352 172.9,304 172.9,208"/><circle cx="256" cy="256" r="38"/></svg></button>' +
    wsDoorHtml('inv-side-item inv-navbar-add', 'data-action="invAddOpen" data-shell-primary aria-keyshortcuts="A" title="Add (A)"', 'add', 'Add');
  WORKSPACES.forEach(function(w) {
    if (!w.bar || !wsViewsPresent(w).length) return;
    html += wsDoorHtml('inv-side-item', 'data-action="invWsGo" data-ws="' + w.id + '"', w.icon, w.label, w.id);
  });
  html += '<div class="inv-side-spacer"></div>' + wsDoorHtml('inv-side-item', 'data-action="invOpenSettings"', 'settings', 'Settings');
  var sidebar = document.createElement('nav');
  sidebar.className = 'inv-side';
  sidebar.id = 'invSidebar';
  sidebar.setAttribute('aria-label', 'Main');
  sidebar.innerHTML = html;
  document.body.insertBefore(sidebar, document.body.firstChild);
  markSideActive(regFilter.activeTab || 'pageHome');
  wsUpdateCounts();
}
/* The workspace on screen is on (aria-current), whichever of its views is open, a page it holds without a tab included. */
function markSideActive(tabId) {
  var side = document.getElementById('invSidebar');
  if (!side) return;
  var id = wsOf(tabId || navPageOf());
  side.querySelectorAll('.inv-side-item[data-ws]').forEach(function(b) {
    var on = !!id && b.dataset.ws === id;
    b.classList.toggle('inv-side-item-on', on);
    if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
}

/* ---------- The red counts ----------
   More carried every red row; the count moved to the bar (and the sidebar's heads). Each workspace carries the red app
   tasks whose jump lands in it; Today carries every red row, your own late tasks included (the old More count). A task
   with no jump, or one landing nowhere a workspace holds (Settings), counts on Today alone. */
var WS_GO_PAGE = {
  home: 'pageHome',
  im: 'pageIM', challan: 'pageIM',
  createFor: 'pageCreate',
  regState: 'pageRegister', register: 'pageRegister', audit: 'pageRegister', cnList: 'pageRegister', cnBatch: 'pageRegister', invoice: 'pageRegister',
  client: 'pageClients', perf: 'pageClients', quotes: 'pageClients', quoteDraft: 'pageClients', prospects: 'pageClients', prospect: 'pageClients',
  staffRoster: 'pageStaff', staffPaste: 'pageStaff', payDue: 'pageStaff', payWages: 'pageStaff', payWeek: 'pageStaff', areas: 'pageStaff',
  production: 'pageProduction', prodLines: 'pageProduction',
  stock: 'pageStock', stockCheck: 'pageStock', stockPaste: 'pageStock', stockList: 'pageStock', reorder: 'pageStock',
  power: 'pagePower', powerCase: 'pagePower', powerCut: 'pagePower', plantUnit: 'pageProduction',
  finance: 'pageFinance', bills: 'pageFinance', soa: 'pageFinance',
  stats: 'pageStats', liveCost: 'pageStats', report: 'pageReports', planner: 'pagePlanner',
  kb: 'pageKnow', todoLearn: 'pageHome'
};
function wsOfGo(go) {
  var tab = go ? (isPageId(go.page) ? go.page : WS_GO_PAGE[go.kind]) : null;
  return (tab && wsOf(tab)) || 'today';
}
/* Counted from what the role signed in sees, the list Needs you draws (today.js tdyTasks: todo.js todoSees), never the
   book's whole list: a supervisor's bar counted the owner's money tasks (the QA audit, QA2-9, QA4-4). Nothing is counted
   while nobody is signed in (guard.js grdNobody). */
function wsRedCounts() {
  var n = {};
  WORKSPACES.forEach(function(w) { n[w.id] = 0; });
  if (!S || (typeof grdNobody === 'function' && grdNobody())) return n;
  var rows = [];
  // One pass over the rules for every count (each rule reads the whole book).
  try { rows = typeof tdyTasks === 'function' ? tdyTasks() : todoRanked(); } catch (e) { rows = []; }
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
    el.classList.toggle('inv-hidden', !k);
  });
}

/* ---------- Doing ---------- */
/* The shell drawn again for the person now signed in (guard.js, grdAfterUser): the views a role sees decide every door,
   the sidebar's and the tab row's alike. */
function wsRedraw() {
  if (_isDesktop) renderSidebar();
  _wsRowSig = null;
  wsShellDraw();
}
/* A group's name in the row brings the group into view: the row scrolls until the name stands at its left edge, the group's
   views after it (owner, 8 Oct 2026: "Insights seems to be missing on mobile?": Office's row ran past the phone's edge and
   nothing named what lay beyond). Where the row fits (the desktop) nothing moves. */
function wsGroupReveal(el) {
  var row = el.closest('.inv-viewtabs'), first = el.nextElementSibling;
  if (!row || !first) return;
  // The name is sticky, so where it is drawn is not where it stands in the row: the group's first tab says that.
  var left = Math.max(0, first.offsetLeft - el.offsetWidth - (parseFloat(getComputedStyle(row).paddingLeft) || 0));
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  row.scrollTo({ left: left, behavior: still ? 'auto' : 'smooth' });
}
/* A workspace's door. Add and search answer in their own modules (add.js, events.js). */
function wsAction(action, btn) {
  if (action === 'invWsGo') { wsGo(btn.dataset.ws); return true; }
  if (action === 'invWsGroup') { wsGroupReveal(btn); return true; }
  // The brand: Today → Pulse, at its top (a step of the trail, as a tab is).
  if (action === 'invGoPulse') { wsShowView({ tab: 'pageHome', v: 'pulse' }); viewTop(); return true; }
  // The top bar's History: a tool, not a section's view (the tab map, 9 Oct 2026). A step of the trail, at its top.
  if (action === 'invGoHistory') { navOpen({ tab: 'pageHistory', v: '', id: '' }); viewTop(); return true; }
  return false;
}
