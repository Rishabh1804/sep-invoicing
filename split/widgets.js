/* ===== WIDGETS (docs/UI_PASS_3.md §7; UI pass 3, U2) =====
   Owner, 16 Oct 2026: "widgets should be flexible so different layouts are possible without breaking the UI". A widget answers
   one question in a card. Home (today.js) and, from U3, Stats are boards of widgets each person arranges.

   This module is the framework and holds no widget's arithmetic: the card, the board, the states, the presets by role, where a
   layout is kept, arranging and the gallery. Each widget is an entry in WIDGET_DEFS (widgetcards.js, by wdgDefine):
     { id, title, q, section, sizes, needs, go, live, card, data(ctx), draw(d, size, ctx), foot(d, size, ctx), after(el, d, size) }
   `data` reads the views (dataview.js) and the functions its screen already draws with and returns {state, tone, …}; `draw`
   returns the body's HTML for 's' | 'm' | 'l'. A widget that throws draws its error state and the rest of the board is drawn.

   The card is a hero card (§6.21) without its fold: lifted, a card's corners, coded in the tone `data` gives, its head the
   widget's door to its screen. The board is a grid whose columns come from its own width (12, 6 or 2), packed with no gap in
   the layout's order (uiMasonry). A layout is kept on the device, one per person, board and layout (the desktop's and the
   phone's sizes differ), never in the book. */

var WIDGET_DEFS = [];           // every widget, in the gallery's order (wdgDefine)
var _wdgIdx = {};
var WDG_SIZE_NAMES = { s: 'Small', m: 'Medium', l: 'Large' };
var WDG_SIZE_SHORT = { s: 'S', m: 'M', l: 'L' };
/* The gallery's chips and each card's head: the section, its name and its icon (icons v3). */
var WDG_SECTIONS = [
  { id: 'money', label: 'Money', icon: 'money' }, { id: 'office', label: 'Office', icon: 'office' },
  { id: 'floor', label: 'Floor', icon: 'floor' }, { id: 'people', label: 'People', icon: 'users' },
  { id: 'market', label: 'Market', icon: 'market' }, { id: 'analysis', label: 'Analysis', icon: 'correlation' },
  { id: 'questions', label: 'Questions', icon: 'info' }
];
var WDG_BOARDS = { home: 'Home' };
var WDG_STORE_KEY = 'sep_inv_layout';
var WDG_TONES = { danger: 1, warning: 1, ok: 1, info: 1, neutral: 1 };

/* A widget joins the set. Refused (and said to a test build) when its id is taken or it allows no size: one bad entry must
   not take the board down. */
function wdgDefine(def) {
  if (!def || typeof def.id !== 'string' || !def.id || _wdgIdx[def.id] || !Array.isArray(def.sizes)) {
    if (typeof console !== 'undefined') console.error('wdgDefine refused: ' + (def && def.id));
    return null;
  }
  def.sizes = def.sizes.filter(function(s) { return !!WDG_SIZE_NAMES[s]; });
  if (!def.sizes.length || typeof def.draw !== 'function') {
    if (typeof console !== 'undefined') console.error('wdgDefine refused: ' + def.id + ' has no size or no draw');
    return null;
  }
  _wdgIdx[def.id] = def;
  WIDGET_DEFS.push(def);
  return def;
}
function wdgDef(id) { return Object.prototype.hasOwnProperty.call(_wdgIdx, id) ? _wdgIdx[id] : null; }
function wdgSection(id) { return WDG_SECTIONS.filter(function(s) { return s.id === id; })[0] || WDG_SECTIONS[WDG_SECTIONS.length - 1]; }
/* A size the widget allows: the one asked for, else Medium where it has it, else its first. */
function wdgFitSize(def, size) {
  if (!def) return size;
  if (def.sizes.indexOf(size) >= 0) return size;
  return def.sizes.indexOf('m') >= 0 ? 'm' : def.sizes[0];
}

/* What several widgets read in one draw (the questions, a forecast) is worked out once a book, a period and a person. */
var _wdgMemo = { key: '', v: {} };
function wdgMemo(key, fn) {
  var k = _bookWrites + '|' + (typeof _statsPeriod === 'string' ? _statsPeriod : '') + '|' + (typeof grdUserId === 'function' ? grdUserId() || '' : '');
  if (_wdgMemo.key !== k) _wdgMemo = { key: k, v: {} };
  if (!Object.prototype.hasOwnProperty.call(_wdgMemo.v, key)) _wdgMemo.v[key] = fn();
  return _wdgMemo.v[key];
}

/* ---------- A widget's body, the house anatomy (§7a) ----------
   The figure in its tone, its line (at most 60 characters), a few words under it; then, from Medium, its viz and what it holds:
   `more` (tiles, a chart), `rows` (row HTML, cut to the rows the size allows: Small 1, Medium 4, Large 9; *Show all* is the head's
   door), and at Large `large`. Every field is HTML its widget built (escaped there). A Small with no figure says its line and words. */
var WDG_ROWS = { s: 1, m: 4, l: 9 };
function wdgStdHtml(d, size) {
  var h = '';
  if (d.fig) h += '<div class="inv-widget-fig">' + d.fig + '</div>';
  if (d.line) h += '<div class="inv-widget-line">' + d.line + '</div>';
  if (d.sub && (size !== 's' || !d.fig)) h += '<div class="inv-widget-sub">' + d.sub + '</div>';
  if (size === 's') return h;
  if (d.viz) h += '<div class="inv-widget-viz">' + d.viz + '</div>';
  if (d.more) h += d.more;
  var rows = (d.rows || []).filter(Boolean);
  if (rows.length) h += '<div class="inv-widget-rows">' + rows.slice(0, WDG_ROWS[size] || 4).join('') + '</div>';
  if (size === 'l' && d.large) h += d.large;
  return h;
}
/* A widget drawn from its screen's own hero (uiHeroHtml's options: tone, title, fig, sub, viz, body, foot, attrs): its line is the
   hero's title, its words the hero's sub, and from Medium what the hero held. The hero's attributes go on the widget (its id and
   data-card: the hooks a spec reads); a verdict's mark does not, since Home's verdict is the day card. No options, nothing to say. */
function wdgFromHero(o, extra) {
  if (!o) return Object.assign({ state: 'empty' }, extra || {});
  var attrs = String(o.attrs || '').replace(/\s+data-verdict(-long)?\b/g, '');
  return Object.assign({ state: 'ok', tone: WDG_TONES[o.tone] ? o.tone : 'neutral', fig: o.fig || '', line: o.title || '', sub: o.sub || '',
    viz: o.viz || '', more: o.body || '', heroFoot: o.foot || '', attrs: attrs }, extra || {});
}
function wdgHeroDraw(d, size) { return wdgStdHtml(d, size); }
function wdgHeroFoot(d, size) { return size === 's' ? '' : d.heroFoot || ''; }
/* A widget drawn again in place wherever it stands on a board on screen: what an old renderer's caller asks for (a push redraws
   the backup widget, a refresh the zinc widget). */
function wdgRefresh(id) {
  Array.prototype.forEach.call(document.querySelectorAll('.inv-wboard .inv-widget[data-w="' + CSS.escape(id) + '"]'), function(card) {
    if (card.offsetParent || card.isConnected) keepScroll(function() { wdgRedrawOne(card); });
  });
}

/* ---------- Who sees a widget (§7d, §17 I4) ----------
   `needs`: page (the screen it opens, grdSees), money (grdSeesMoney), wages (grdSeesWages), perm (a permission, grdCan), owner,
   when (a test of its own). With the guard off, everything. A widget a role may not see is never drawn, in a board or the gallery. */
function wdgSeesMoney() { return typeof grdSeesMoney !== 'function' || grdSeesMoney(); }
function wdgSees(def) {
  if (!def) return false;
  var n = def.needs || {};
  if (n.page && typeof grdSees === 'function' && !grdSees(n.page)) return false;
  if (n.money && !wdgSeesMoney()) return false;
  if (n.wages && typeof grdSeesWages === 'function' && !grdSeesWages()) return false;
  if (n.perm && typeof grdCan === 'function' && !grdCan(n.perm)) return false;
  if (n.owner && typeof grdIsOwner === 'function' && !grdIsOwner()) return false;
  if (typeof n.when === 'function') { try { if (!n.when()) return false; } catch (e) { return false; } }
  return true;
}
/* A widget's door: its head opens its screen, where the role opens it; else the title is text (I4). `go` is a place ({tab, v}),
   a section of Settings ({settings}: the settings permission's), or a function of the widget's own. */
function wdgCanGo(def) {
  var go = def && def.go;
  if (!go) return false;
  if (typeof go === 'function') return true;
  if (go.settings) return typeof grdCan !== 'function' || grdCan('settings');
  return !go.tab || typeof grdSees !== 'function' || grdSees(go.tab);
}
function wdgGo(def) {
  var go = def && def.go;
  if (!go) return;
  if (typeof go === 'function') { go(); return; }
  if (go.settings) { openSettings(go.settings); return; }
  if (go.v) navOpen({ tab: go.tab, v: go.v, id: '' });
  else switchTab(go.tab);
}

/* ---------- Presets by role (§7g) ----------
   A board starts from its role's preset; any change makes it the person's own, and Reset returns to the preset. The phone keeps
   the desktop's order: a Small stays Small, the rest Medium. A widget the role may not see, or the build does not have, is left
   out when the preset is drawn. */
var WDG_PRESETS = {
  owner: { label: 'Owner', home: [['mtd', 's'], ['q-money', 's'], ['prodday', 's'], ['cash', 's'], ['pace', 'm'], ['coming', 'm'], ['tata', 'l'],
    ['floornow', 'm'], ['risk', 's'], ['turn', 's'], ['dtp', 's'], ['q-smooth', 'm'], ['dofirst', 'm']] },
  office: { label: 'Office', home: [['needs', 'm'], ['mtd', 's'], ['unbilled', 's'], ['owed', 's'], ['dtp', 's'], ['pipe', 'm'], ['recent', 'm'],
    ['turn', 's'], ['quote', 's'], ['tata', 'm']] },
  floor: { label: 'Floor', home: [['floornow', 'l'], ['prodday', 's'], ['atttoday', 's'], ['risk', 's'], ['weather', 's'], ['eff', 'm'],
    ['stockdays', 'm'], ['attweek', 'm'], ['ot', 'm'], ['tata', 'm']] }
};
function wdgRole() {
  if (typeof grdOn !== 'function' || !grdOn()) return 'owner';
  var u = typeof grdUser === 'function' ? grdUser() : null;
  return u ? u.role : 'owner';
}
function wdgPresetKey() { var r = wdgRole(); return r === 'office' ? 'office' : (r === 'supervisor' || r === 'floor') ? 'floor' : 'owner'; }
function wdgPresetList(board, lay) {
  var p = WDG_PRESETS[wdgPresetKey()] || WDG_PRESETS.owner;
  return (p[board] || []).filter(function(x) { return !!wdgDef(x[0]); }).map(function(x) {
    return [x[0], wdgFitSize(wdgDef(x[0]), lay === 'phone' && x[1] !== 's' ? 'm' : x[1])];
  });
}

/* ---------- Where a layout is kept (§7h) ----------
   On the device, one per person (the signed-in ID, `-` with the guard off), board and layout: localStorage sep_inv_layout,
   {v: 1, people: {<id>: {<board>: {preset, desk, phone, opts}}}}. A list present is the person's own for that layout; none, the
   layout follows its role's preset as this build defines it. Never in the book: a backup, a pull or a merge never rearranges
   another device, and the change log never sees it. At S1 the body goes to the hub as the person's `prefs` (docs/SERVER.md). */
function wdgStoreRead() {
  var o = null;
  try { o = JSON.parse(localStorage.getItem(WDG_STORE_KEY) || 'null'); } catch (e) { o = null; }
  if (!o || typeof o !== 'object' || o.v !== 1 || !o.people || typeof o.people !== 'object') o = { v: 1, people: {} };
  return o;
}
function wdgStoreWrite(o) { try { localStorage.setItem(WDG_STORE_KEY, JSON.stringify(o)); } catch (e) { /* a per-device convenience only */ } }
function wdgPerson() { return typeof grdOn === 'function' && grdOn() ? (grdUserId() || '-') : '-'; }
function wdgLay() { return _isDesktop ? 'desk' : 'phone'; }
/* The person's record of a board, made from Pulse's layout the first time it is read (wdgFromPulse). */
function wdgBoardRec(board) {
  var st = wdgStoreRead(), who = wdgPerson();
  var p = st.people[who] && typeof st.people[who] === 'object' ? st.people[who] : null;
  var b = p && p[board] && typeof p[board] === 'object' ? p[board] : null;
  if (!b && board === 'home') {
    b = wdgFromPulse();
    if (b) { st.people[who] = p || {}; st.people[who][board] = b; wdgStoreWrite(st); }
  }
  return b || {};
}
function wdgBoardPut(board, fn) {
  var st = wdgStoreRead(), who = wdgPerson();
  var p = st.people[who] = st.people[who] && typeof st.people[who] === 'object' ? st.people[who] : {};
  var b = p[board] = p[board] && typeof p[board] === 'object' ? p[board] : (board === 'home' ? (wdgFromPulse() || {}) : {});
  fn(b);
  b.preset = Array.isArray(b.desk) || Array.isArray(b.phone) ? 'custom' : wdgPresetKey();
  wdgStoreWrite(st);
}
/* A board's widgets for a layout, in order: [[id, size], …]. A widget the build no longer has drops at load (and comes back if a
   later build has it: what is stored is left as it was); one named twice is read once; a size the widget does not allow is fitted. */
function wdgItems(board, lay) {
  lay = lay || wdgLay();
  var b = wdgBoardRec(board), list = Array.isArray(b[lay]) ? b[lay] : wdgPresetList(board, lay), seen = {};
  return list.filter(function(x) {
    if (!Array.isArray(x) || !wdgDef(x[0]) || seen[x[0]]) return false;
    seen[x[0]] = true;
    return true;
  }).map(function(x) { return [x[0], wdgFitSize(wdgDef(x[0]), x[1])]; });
}
function wdgCustom(board, lay) { var b = wdgBoardRec(board); return Array.isArray(b[lay || wdgLay()]); }
function wdgItemsPut(board, lay, list) { wdgBoardPut(board, function(b) { b[lay] = list.map(function(x) { return [x[0], x[1]]; }); }); }
/* A widget's own options on a board (the pair a *corr* is set to), shared by both layouts. */
function wdgOpts(board, id) { var b = wdgBoardRec(board); return (b.opts && b.opts[id]) || {}; }
function wdgOptsPut(board, id, o) { wdgBoardPut(board, function(b) { b.opts = b.opts && typeof b.opts === 'object' ? b.opts : {}; b.opts[id] = o; }); }

/* Pulse's layout, moved once (§7h): `sep_inv_home` ({preset, order, hidden, wide}) is read and left as it is (an older build in
   another window still reads it). A device on a named preset starts on its role's preset; a custom one starts on its role's preset
   too and adds, at its end and in Pulse's order, every widget Pulse showed that the preset lacks (wide as Large, the rest Medium),
   by the new ids, so nothing it showed is lost. */
var WDG_PULSE_IDS = { todo: 'needs', attendance: 'atttoday', production: 'prodday', power: 'powercuts', stock: 'stockdays' };
function wdgFromPulse() {
  var l = null;
  try { l = JSON.parse(localStorage.getItem('sep_inv_home') || 'null'); } catch (e) { l = null; }
  if (!l || l.preset !== 'custom' || !Array.isArray(l.order)) return null;
  var out = { preset: 'custom', from: 'pulse', opts: {} };
  ['desk', 'phone'].forEach(function(lay) {
    var list = wdgPresetList('home', lay), has = {};
    list.forEach(function(x) { has[x[0]] = true; });
    l.order.forEach(function(k) {
      if (l.hidden && l.hidden[k]) return;
      var id = WDG_PULSE_IDS[k] || k;
      if (has[id]) return;
      has[id] = true;
      // Kept by its id even where this build has no such widget, so a later build draws it: wdgItems leaves it out until then.
      var def = wdgDef(id);
      list.push([id, def ? wdgFitSize(def, l.wide && l.wide[k] ? 'l' : 'm') : (l.wide && l.wide[k] ? 'l' : 'm')]);
    });
    out[lay] = list;
  });
  return out;
}

/* ---------- The card (§7a, §7c) ---------- */
var WDG_STATE_TITLE = { empty: 'Nothing recorded yet', early: 'Not enough yet', notset: 'Not set up yet', offline: 'Offline',
  error: 'This widget could not be drawn' };
var _wdgErrSeen = {};
function wdgErr(def, e) {
  if (typeof navigator !== 'undefined' && navigator.webdriver && typeof console !== 'undefined') console.error('widget ' + def.id + ': ' + (e && e.stack || e));
  if (_wdgErrSeen[def.id]) return;
  _wdgErrSeen[def.id] = true;
  if (typeof errReport === 'function') errReport(e, 'widget: ' + def.id);
}
/* What a widget has to say, worked out once per draw: {state, tone, …}. A state other than ok is drawn as the one blank state. */
function wdgData(def, ctx) {
  try {
    var d = typeof def.data === 'function' ? def.data(ctx) : { state: 'ok' };
    if (!d || typeof d !== 'object') d = { state: 'ok' };
    if (!d.state) d.state = 'ok';
    return d;
  } catch (e) { wdgErr(def, e); return { state: 'error' }; }
}
function wdgStateHtml(def, size, d) {
  var k = WDG_STATE_TITLE[d.state] ? d.state : 'empty';
  var action = d.action || (k === 'error' ? '<button type="button" class="inv-btn inv-btn-link inv-btn-sm" data-action="invWdgReport" data-w="' + escHtml(def.id) + '">Report it</button>' : '');
  return uiBlankHtml({ kind: k, title: d.title || WDG_STATE_TITLE[k], body: d.body || '', action: action, small: size === 's' });
}
function wdgBodyHtml(def, size, d, ctx) {
  if (d.state !== 'ok') return wdgStateHtml(def, size, d);
  try { return def.draw(d, size, ctx) || wdgStateHtml(def, size, { state: 'empty' }); }
  catch (e) { wdgErr(def, e); d.state = 'error'; return wdgStateHtml(def, size, d); }
}
/* A card: <section class="inv-widget"> coded in the tone its data gives (a hero's look, §3d), its head the section's icon, the
   title and the door's chevron, its body the widget at its size, its foot (where it has one) its own links. In arrange mode its
   handle, its place, its size and its Remove ride over the head (§7e). */
function wdgCardHtml(def, size, o) {
  o = o || {};
  var ctx = { board: o.board || 'home', size: size, opts: wdgOpts(o.board || 'home', def.id), period: typeof _statsPeriod === 'string' ? _statsPeriod : 'mtd',
    preview: !!o.preview };
  var d = wdgData(def, ctx);
  var body = wdgBodyHtml(def, size, d, ctx);
  var tone = d.state === 'ok' && WDG_TONES[d.tone] ? d.tone : 'neutral';
  var sec = wdgSection(def.section), id = escHtml(def.id), title = escHtml(def.title);
  var door = wdgCanGo(def) && !o.preview
    ? '<button type="button" class="inv-widget-door" data-action="invWdgGo" data-w="' + id + '" aria-label="' + title + ': open">' +
      '<span class="inv-widget-title">' + title + '</span>' + iconSvg('next', 'inv-widget-chev') + '</button>'
    : '<span class="inv-widget-door"><span class="inv-widget-title">' + title + '</span></span>';
  var head = (o.arranging ? wdgArrangeCtlHtml(def, size, o) : '') +
    '<div class="inv-widget-head"><span class="inv-widget-chip" aria-hidden="true">' + iconSvg(sec.icon) + '</span>' + door + '</div>';
  var foot = '';
  if (d.state === 'ok' && typeof def.foot === 'function' && !o.preview) {
    try { foot = def.foot(d, size, ctx) || ''; } catch (e) { wdgErr(def, e); foot = ''; }
  }
  // The widget's own hooks: those its data gives (a screen's hero's id and data-card, in whatever state it says), else its def's
  // card. Ours, never typed.
  var attrs = d.attrs ? String(d.attrs) : '';
  if (def.card && !/\bdata-card=/.test(attrs)) attrs += ' data-card="' + escHtml(def.card) + '"';
  if (o.preview) attrs = attrs.replace(/\s+id="[^"]*"/g, '').replace(/\s+data-card="[^"]*"/g, '');
  return '<section class="inv-widget inv-hero inv-hero-' + tone + '" data-w="' + id + '" data-size="' + size + '" data-tone="' + tone + '" data-state="' + escHtml(d.state) + '"' +
    attrs + ' aria-label="' + title + '">' + head +
    '<div class="inv-widget-body">' + body + '</div>' + (foot ? '<div class="inv-widget-foot">' + foot + '</div>' : '') + '</section>';
}
/* After a card is in the page: a widget's own hook (a chart measured, a fold wired), never one that writes the book; then its fit. */
function wdgAfterOne(el) {
  var def = el && wdgDef(el.dataset.w);
  if (!def) return;
  if (typeof def.after === 'function' && el.dataset.state === 'ok') { try { def.after(el, el.dataset.size); } catch (e) { wdgErr(def, e); } }
  wdgFit(el);
}
/* A widget never cuts what it shows (§7b): one taller than its size's cap lets go of its last rows, the list's own (rows, fact
   rows, cards in a deck, steps), until it fits, and says how many are on its screen (Show all, the head's door). Measured only
   where the card is laid out; a widget with nothing left to let go of keeps what it has (the sweep, P224, says so). A fact row
   is a row, a row that folds open goes whole. */
var WDG_FIT_ROWS = '.inv-row, .inv-deck-item, .inv-step, .inv-row-fold';
function wdgFit(card) {
  if (!card || !card.isConnected || !card.offsetParent) return;
  var over = function() { return card.scrollHeight > card.clientHeight + 1; };
  if (!over()) return;
  var body = card.querySelector('.inv-widget-body');
  if (!body) return;
  var rows = Array.prototype.filter.call(body.querySelectorAll(WDG_FIT_ROWS), function(r) {
    return !r.hidden && !r.closest('[hidden], [data-wdg-cut]') && !r.closest('.inv-widget-more') && !r.parentElement.closest(WDG_FIT_ROWS);
  });
  if (!rows.length) return;
  var def = wdgDef(card.dataset.w), more = document.createElement('div');
  more.className = 'inv-widget-more';
  more.setAttribute('data-wdg-more', '');
  body.appendChild(more);
  var hid = 0;
  var say = function() {
    var label = hid + ' more' + (def && wdgCanGo(def) ? ': Show all' : '');
    more.innerHTML = def && wdgCanGo(def) ? '<button type="button" class="inv-btn inv-btn-link inv-btn-sm" data-action="invWdgGo" data-w="' + escHtml(def.id) + '">' + escHtml(label) + '</button>'
      : '<span class="inv-note">' + escHtml(label) + '</span>';
  };
  // Let go of: marked, and hidden by the mark (a row's or a card's own display would show a bare `hidden`).
  var cut = function(el) { el.setAttribute('data-wdg-cut', ''); el.hidden = true; };
  while (rows.length && over()) { cut(rows.pop()); hid++; say(); }
  if (!hid) { more.remove(); return; }
  // A sheet whose rows all went goes with them.
  Array.prototype.forEach.call(body.querySelectorAll('.inv-hero-sheet'), function(sh) {
    if (!sh.querySelector(WDG_FIT_ROWS.split(', ').map(function(s) { return s + ':not([data-wdg-cut])'; }).join(', ')) && sh.querySelector(WDG_FIT_ROWS)) cut(sh);
  });
}
function wdgAfter(root) {
  if (root) Array.prototype.forEach.call(root.querySelectorAll('.inv-widget[data-w]'), wdgAfterOne);
}

/* ---------- The board (§7b) ---------- */
var _wdgArrange = null;      // the board being arranged, or null
var _wdgUndo = null;         // the last widget removed: {board, lay, list}
/* A board's widgets as the person signed in may see them, for the layout on screen. */
function wdgShown(board) {
  return wdgItems(board).filter(function(x) { return wdgSees(wdgDef(x[0])); });
}
/* How many widgets the role may add to a board: every one it may see that is not on it. */
function wdgAddable(board) {
  var on = {};
  wdgItems(board).forEach(function(x) { on[x[0]] = true; });
  return WIDGET_DEFS.filter(function(d) { return !on[d.id] && wdgSees(d) && (!d.boards || d.boards.indexOf(board) >= 0); }).length;
}
function wdgBoardHtml(board) {
  var shown = wdgShown(board), arranging = _wdgArrange === board, n = shown.length;
  var cards = shown.map(function(x, i) { return wdgCardHtml(wdgDef(x[0]), x[1], { board: board, i: i, n: n, arranging: arranging }); }).join('');
  if (!n) cards = '<div class="inv-wgrid-blank">' + uiBlankHtml({ kind: 'empty', title: 'Nothing on ' + (WDG_BOARDS[board] || 'the board') + ' yet',
    body: 'Add the widgets you want to see here.',
    action: '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invWdgGallery" data-board="' + escHtml(board) + '">Add a widget</button>' }) + '</div>';
  return '<div class="inv-wboard" data-board="' + escHtml(board) + '"' + (arranging ? ' data-arranging' : '') + '>' +
    '<div class="inv-visually-hidden" aria-live="polite" data-wdg-live></div>' +
    '<div class="inv-wgrid" data-wgrid="' + escHtml(board) + '">' + cards + '</div></div>';
}
/* Draws a board into its host, then lays it out: each widget's hook, the packed grid, the live redraws. */
function wdgBoardDraw(host, board) {
  if (!host) return;
  host.innerHTML = wdgBoardHtml(board);
  wdgAfter(host);
  wdgPack(host);
  wdgLiveStart(host, board);
}
function wdgPack(host) {
  var grid = host && host.querySelector('.inv-wgrid');
  if (grid && grid.querySelector('.inv-widget')) uiMasonry(grid);
}
/* One widget drawn again where it stands (a size picked, a live widget's minute): nothing else on the board is touched. */
function wdgRedrawOne(el, size) {
  var board = el.closest('.inv-wboard'), def = wdgDef(el.dataset.w);
  if (!board || !def) return;
  var shown = wdgShown(board.dataset.board), i = shown.map(function(x) { return x[0]; }).indexOf(def.id);
  var t = document.createElement('div');
  t.innerHTML = wdgCardHtml(def, size || el.dataset.size, { board: board.dataset.board, i: i, n: shown.length, arranging: _wdgArrange === board.dataset.board });
  var card = t.firstElementChild;
  el.replaceWith(card);
  wdgAfterOne(card);
  var grid = card.parentElement;
  if (grid && grid.classList.contains('inv-masonry-on')) uiMasonry(grid);
}

/* A live widget (§7a `live`: the seconds between redraws while it is on screen; a feed's half hour) is redrawn in place while
   its board is drawn and visible; a widget with none is redrawn when the book changes. One timer a board, stopped when the board
   leaves the page or the page is hidden. */
var _wdgLive = {};
function wdgLiveStart(host, board) {
  wdgLiveStop(board);
  var due = {};
  wdgShown(board).forEach(function(x) { var d = wdgDef(x[0]); if (d.live > 0) due[d.id] = Date.now() + d.live * 1000; });
  if (!Object.keys(due).length) return;
  _wdgLive[board] = setInterval(function() {
    var el = host.isConnected ? host.querySelector('.inv-wboard[data-board="' + board + '"]') : null;
    if (!el) { wdgLiveStop(board); return; }
    if (document.hidden || _wdgArrange === board || !el.offsetParent) return;
    var now = Date.now();
    Object.keys(due).forEach(function(id) {
      if (now < due[id]) return;
      due[id] = now + wdgDef(id).live * 1000;
      var card = el.querySelector('.inv-widget[data-w="' + CSS.escape(id) + '"]');
      if (card) keepScroll(function() { wdgRedrawOne(card); });
    });
  }, 15000);
}
function wdgLiveStop(board) { if (_wdgLive[board]) { clearInterval(_wdgLive[board]); delete _wdgLive[board]; } }

/* ---------- Arranging (§7e) ----------
   Customise puts the board in arrange mode, a layer over the screen (Back, Escape and Done leave it; a swipe does nothing while
   it is on). Each widget shows its handle, its place, its size and Remove; the toolbar Add a widget, Reset and Done. A drop, a
   key, a size or a removal writes the layout on screen only: the desktop's and the phone's are their own. */
function wdgArrangeCtlHtml(def, size, o) {
  var id = escHtml(def.id), title = escHtml(def.title);
  var sizes = def.sizes.length > 1 ? '<span class="inv-seg inv-widget-sizes" role="group" aria-label="Size of ' + title + '">' +
    ['s', 'm', 'l'].filter(function(s) { return def.sizes.indexOf(s) >= 0; }).map(function(s) {
      return '<button type="button" class="inv-seg-btn" data-action="invWdgSize" data-w="' + id + '" data-size="' + s + '" aria-pressed="' + (s === size) + '" aria-label="' +
        WDG_SIZE_NAMES[s] + '">' + WDG_SIZE_SHORT[s] + '</button>';
    }).join('') + '</span>' : '';
  return '<div class="inv-widget-ctl">' +
    '<button type="button" class="inv-widget-handle" data-wdg-handle="' + id + '" aria-label="Move ' + title + ', ' + (o.i + 1) + ' of ' + o.n + '">' + iconSvg('grip') + '</button>' +
    '<span class="inv-widget-place" data-wdg-place>' + (o.i + 1) + ' of ' + o.n + '</span>' + sizes +
    '<button type="button" class="inv-btn inv-btn-icon inv-btn-ghost inv-widget-remove" data-action="invWdgRemove" data-w="' + id + '" aria-label="Remove ' + title + '">' + iconSvg('close') + '</button></div>';
}
function wdgArrangeOn(board) { return _wdgArrange === board; }
function wdgArrangeStart(board) {
  _wdgArrange = board;
  wdgRedrawBoard(board);
  var first = document.querySelector('.inv-wboard[data-board="' + board + '"] [data-wdg-handle]');
  if (first && !touchScreen()) first.focus({ preventScroll: true });
}
/* Done, Back or Escape leave arrange mode; `quiet`, the board is not drawn again (Home was left). */
function wdgArrangeDone(quiet) {
  var board = _wdgArrange;
  if (!board) return false;
  _wdgArrange = null;
  wdgDragCancel();
  if (!quiet) wdgRedrawBoard(board);
  return true;
}
/* The board's screen draws itself (Home: renderHome), toolbar and all, keeping the page where it is. */
function wdgRedrawBoard(board) {
  keepScroll(function() {
    if (board === 'home' && typeof renderHomeBoard === 'function') renderHomeBoard();
  });
}
/* The order on screen as a list of [id, size], every widget the layout holds kept (one the role may not see stays where it is). */
function wdgMove(board, id, to) {
  var lay = wdgLay(), list = wdgItems(board, lay), shown = list.filter(function(x) { return wdgSees(wdgDef(x[0])); });
  var from = shown.map(function(x) { return x[0]; }).indexOf(id);
  if (from < 0) return null;
  to = Math.max(0, Math.min(shown.length - 1, to));
  if (to === from) return { i: from, n: shown.length };
  var item = shown.splice(from, 1)[0];
  shown.splice(to, 0, item);
  // The hidden ones keep their places in the full list; the seen ones are written back in their new order.
  var k = 0, out = list.map(function(x) { return wdgSees(wdgDef(x[0])) ? shown[k++] : x; });
  wdgItemsPut(board, lay, out);
  return { i: to, n: shown.length };
}
function wdgSetSize(board, id, size) {
  var lay = wdgLay(), list = wdgItems(board, lay), def = wdgDef(id);
  if (!def || def.sizes.indexOf(size) < 0) return;
  list.forEach(function(x) { if (x[0] === id) x[1] = size; });
  wdgItemsPut(board, lay, list);
}
function wdgRemove(board, id) {
  var lay = wdgLay(), list = wdgItems(board, lay), def = wdgDef(id);
  _wdgUndo = { board: board, lay: lay, list: list.map(function(x) { return [x[0], x[1]]; }) };
  wdgItemsPut(board, lay, list.filter(function(x) { return x[0] !== id; }));
  showToastAct((def ? def.title : 'The widget') + ' removed', 'Undo', function() {
    var u = _wdgUndo;
    if (!u) return;
    _wdgUndo = null;
    wdgItemsPut(u.board, u.lay, u.list);
    wdgRedrawBoard(u.board);
  });
}
/* Added from the gallery: to the end of the layout on screen, and to the end of the other layout at its first size. */
function wdgAdd(board, id) {
  var def = wdgDef(id);
  if (!def || !wdgSees(def)) return;
  var lay = wdgLay();
  ['desk', 'phone'].forEach(function(l) {
    var list = wdgItems(board, l);
    if (list.some(function(x) { return x[0] === id; })) return;
    list.push([id, l === lay ? def.sizes[0] : wdgFitSize(def, l === 'phone' && def.sizes[0] !== 's' ? 'm' : def.sizes[0])]);
    wdgItemsPut(board, l, list);
  });
}
function wdgRemoveFromGallery(board, id) {
  var lay = wdgLay();
  wdgItemsPut(board, lay, wdgItems(board, lay).filter(function(x) { return x[0] !== id; }));
}
/* Reset asks first, then puts this board and this layout back to the role's preset. */
function wdgReset(board) {
  var name = (WDG_PRESETS[wdgPresetKey()] || WDG_PRESETS.owner).label;
  return uiConfirm({ title: 'Put ' + (WDG_BOARDS[board] || 'the board') + ' back as the ' + name + ' layout?',
    body: 'Your arrangement on this ' + (_isDesktop ? 'computer’s screen' : 'phone') + ' goes. The other layout and its widgets stay as they are.',
    okLabel: 'Reset', danger: true }).then(function(ok) {
    if (!ok) return false;
    var lay = wdgLay();
    wdgBoardPut(board, function(b) { delete b[lay]; });
    wdgRedrawBoard(board);
    return true;
  });
}
/* The aria-live line names where the widget moved (§7e): "Cash and its low point, 3 of 11". */
function wdgSay(board, text) {
  var el = document.querySelector('.inv-wboard[data-board="' + board + '"] [data-wdg-live]');
  if (el) el.textContent = text;
}

/* By keys: a focused handle moves its widget ← ↑ earlier, → ↓ later, Home first, End last. */
document.addEventListener('keydown', function(e) {
  var h = e.target && e.target.closest ? e.target.closest('[data-wdg-handle]') : null;
  if (!h || !_wdgArrange) return;
  var board = _wdgArrange, id = h.dataset.wdgHandle, shown = wdgShown(board).map(function(x) { return x[0]; });
  var i = shown.indexOf(id), to = null;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = i - 1;
  else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = i + 1;
  else if (e.key === 'Home') to = 0;
  else if (e.key === 'End') to = shown.length - 1;
  else if (e.key === 'Escape' && _wdgDrag) { e.preventDefault(); e.stopPropagation(); wdgDragCancel(); return; }
  if (to == null) return;
  e.preventDefault();
  var r = wdgMove(board, id, to);
  if (!r) return;
  wdgRedrawBoard(board);
  var nh = document.querySelector('.inv-wboard[data-board="' + board + '"] [data-wdg-handle="' + CSS.escape(id) + '"]');
  if (nh) nh.focus({ preventScroll: false });
  var def = wdgDef(id);
  wdgSay(board, (def ? def.title : id) + ', ' + (r.i + 1) + ' of ' + r.n);
}, true);

/* Drag (§7e): the handle takes a pointer (a mouse at once; a finger after 250 ms held within 8 px, so a scroll is never taken for
   a drag). The widget lifts and follows the pointer, a placeholder of its size keeps its room, and the placeholder moves before or
   after the widget under the pointer's centre; near the screen's top or bottom the page scrolls. Escape or a cancelled pointer
   puts it back; a drop writes the order. Nothing else on the board is drawn again while dragging. */
var WDG_HOLD_MS = 250, WDG_HOLD_PX = 8, WDG_EDGE_PX = 64;
var _wdgDrag = null, _wdgHold = null;
document.addEventListener('pointerdown', function(e) {
  var h = e.target && e.target.closest ? e.target.closest('[data-wdg-handle]') : null;
  if (!h || !_wdgArrange || e.button > 0) return;
  var card = h.closest('.inv-widget');
  if (!card) return;
  if (e.pointerType === 'mouse') { e.preventDefault(); wdgDragStart(card, e); return; }
  // A finger: held still for 250 ms before the widget lifts.
  _wdgHold = { x: e.clientX, y: e.clientY, id: e.pointerId, card: card, t: setTimeout(function() {
    var hd = _wdgHold;
    _wdgHold = null;
    if (hd) wdgDragStart(hd.card, { clientX: hd.x, clientY: hd.y, pointerId: hd.id });
  }, WDG_HOLD_MS) };
}, true);
document.addEventListener('pointermove', function(e) {
  if (_wdgHold && e.pointerId === _wdgHold.id && Math.hypot(e.clientX - _wdgHold.x, e.clientY - _wdgHold.y) > WDG_HOLD_PX) {
    clearTimeout(_wdgHold.t);
    _wdgHold = null;
  }
  if (_wdgDrag && e.pointerId === _wdgDrag.pid) { e.preventDefault(); wdgDragMove(e.clientX, e.clientY); }
}, { capture: true, passive: false });
document.addEventListener('pointerup', function(e) {
  if (_wdgHold && e.pointerId === _wdgHold.id) { clearTimeout(_wdgHold.t); _wdgHold = null; }
  if (_wdgDrag && e.pointerId === _wdgDrag.pid) wdgDragDrop();
}, true);
document.addEventListener('pointercancel', function(e) {
  if (_wdgHold && e.pointerId === _wdgHold.id) { clearTimeout(_wdgHold.t); _wdgHold = null; }
  if (_wdgDrag && e.pointerId === _wdgDrag.pid) wdgDragCancel();
}, true);
/* While a finger drags, the page does not scroll under it. */
document.addEventListener('touchmove', function(e) { if (_wdgDrag) e.preventDefault(); }, { capture: true, passive: false });

function wdgDragStart(card, e) {
  var grid = card.parentElement, r = card.getBoundingClientRect();
  if (!grid) return;
  var ph = document.createElement('div');
  ph.className = 'inv-widget-ph';
  ph.dataset.size = card.dataset.size;
  ph.setAttribute('aria-hidden', 'true');
  ph.style.setProperty('--ph-h', r.height + 'px');
  if (card.style.getPropertyValue('--rows')) ph.style.setProperty('--rows', card.style.getPropertyValue('--rows'));
  grid.insertBefore(ph, card);
  card.classList.add('inv-widget-lifted');
  card.style.setProperty('--drag-w', r.width + 'px');
  card.style.setProperty('--drag-x', r.left + 'px');
  card.style.setProperty('--drag-y', r.top + 'px');
  _wdgDrag = { card: card, ph: ph, grid: grid, board: _wdgArrange, pid: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top,
    from: Array.prototype.indexOf.call(grid.children, card), x: e.clientX, y: e.clientY, raf: 0 };
  document.body.classList.add('inv-wdg-dragging');
  wdgDragScroll();
}
function wdgDragMove(x, y) {
  var d = _wdgDrag;
  if (!d) return;
  d.x = x; d.y = y;
  d.card.style.setProperty('--drag-x', (x - d.dx) + 'px');
  d.card.style.setProperty('--drag-y', (y - d.dy) + 'px');
  // The widget under the pointer's centre: the placeholder goes before it in its first half, after it in its second.
  var cx = x - d.dx + d.card.offsetWidth / 2, cy = y - d.dy + Math.min(d.card.offsetHeight, 160) / 2;
  var over = null;
  Array.prototype.some.call(d.grid.children, function(el) {
    if (el === d.card || el === d.ph || !el.classList.contains('inv-widget')) return false;
    var r = el.getBoundingClientRect();
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) { over = { el: el, r: r }; return true; }
    return false;
  });
  if (!over) return;
  var after = over.r.width > over.r.height * 1.5 ? cx > over.r.left + over.r.width / 2 : cy > over.r.top + over.r.height / 2;
  var ref = after ? over.el.nextSibling : over.el;
  if (ref !== d.ph && ref !== d.ph.nextSibling) {
    d.grid.insertBefore(d.ph, ref);
    if (d.grid.classList.contains('inv-masonry-on')) uiMasonryPack(d.grid);
  }
}
/* Near the screen's top or bottom while dragging, the page scrolls toward it. */
function wdgDragScroll() {
  var d = _wdgDrag;
  if (!d) return;
  var h = window.innerHeight, step = 0;
  if (d.y < WDG_EDGE_PX) step = -Math.ceil((WDG_EDGE_PX - d.y) / 4);
  else if (d.y > h - WDG_EDGE_PX) step = Math.ceil((d.y - (h - WDG_EDGE_PX)) / 4);
  if (step) { window.scrollBy(0, step); wdgDragMove(d.x, d.y); }
  d.raf = requestAnimationFrame(wdgDragScroll);
}
function wdgDragEnd() {
  var d = _wdgDrag;
  if (!d) return null;
  _wdgDrag = null;
  cancelAnimationFrame(d.raf);
  document.body.classList.remove('inv-wdg-dragging');
  d.card.classList.remove('inv-widget-lifted');
  ['--drag-w', '--drag-x', '--drag-y'].forEach(function(p) { d.card.style.removeProperty(p); });
  return d;
}
function wdgDragDrop() {
  var d = wdgDragEnd();
  if (!d) return;
  var ids = Array.prototype.filter.call(d.grid.children, function(el) { return el === d.ph || (el.classList.contains('inv-widget') && el !== d.card); })
    .map(function(el) { return el === d.ph ? d.card.dataset.w : el.dataset.w; });
  d.ph.replaceWith(d.card);
  var to = ids.indexOf(d.card.dataset.w), r = wdgMove(d.board, d.card.dataset.w, to);
  wdgRedrawBoard(d.board);
  var def = wdgDef(d.card.dataset.w);
  if (r) wdgSay(d.board, (def ? def.title : d.card.dataset.w) + ', ' + (r.i + 1) + ' of ' + r.n);
}
function wdgDragCancel() {
  if (_wdgHold) { clearTimeout(_wdgHold.t); _wdgHold = null; }
  var d = wdgDragEnd();
  if (!d) return;
  d.ph.remove();
  var ref = d.grid.children[d.from] || null;
  d.grid.insertBefore(d.card, ref);
  if (d.grid.classList.contains('inv-masonry-on')) uiMasonryPack(d.grid);
}

/* ---------- The gallery (§7f) ----------
   Add a widget opens a dialog: the board it adds to, the categories as chips, and each widget a card with its live preview at its
   first size (drawn as it comes into view), its question, its sizes, and Add or On Home with Remove. A widget the role may not
   see is never in it; a chip with nothing the role may see is left out. */
var _wdgGallery = { board: 'home', section: 'all' };
var _wdgPreviewObs = null;
function wdgGalleryDefs(board) {
  return WIDGET_DEFS.filter(function(d) { return wdgSees(d) && (!d.boards || d.boards.indexOf(board) >= 0); });
}
function wdgGalleryHtml() {
  var board = _wdgGallery.board, defs = wdgGalleryDefs(board), on = {};
  wdgItems(board).forEach(function(x) { on[x[0]] = true; });
  var secs = WDG_SECTIONS.filter(function(s) { return defs.some(function(d) { return d.section === s.id; }); });
  if (_wdgGallery.section !== 'all' && !secs.some(function(s) { return s.id === _wdgGallery.section; })) _wdgGallery.section = 'all';
  var chips = '<div class="inv-gallery-chips" role="group" aria-label="Kind of widget">' +
    [{ id: 'all', label: 'All' }].concat(secs).map(function(s) {
      return '<button type="button" class="inv-chip" data-action="invWdgGallerySec" data-sec="' + s.id + '" aria-pressed="' + (_wdgGallery.section === s.id) + '">' + escHtml(s.label) + '</button>';
    }).join('') + '</div>';
  var list = defs.filter(function(d) { return _wdgGallery.section === 'all' || d.section === _wdgGallery.section; });
  var cards = list.map(function(d) {
    var id = escHtml(d.id), name = WDG_BOARDS[board] || 'the board';
    var act = on[d.id]
      ? '<span class="inv-dot inv-dot-ok" data-wdg-on>On ' + escHtml(name) + '</span><button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invWdgGalleryRemove" data-w="' + id + '">Remove</button>'
      : '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invWdgGalleryAdd" data-w="' + id + '">Add to ' + escHtml(name) + '</button>';
    return '<article class="inv-gallery-card" data-gallery-w="' + id + '">' +
      '<div class="inv-gallery-preview" data-wdg-preview="' + id + '" aria-hidden="true"></div>' +
      '<div class="inv-gallery-text"><p class="inv-gallery-title">' + escHtml(d.title) + '</p><p class="inv-gallery-q">' + escHtml(d.q || '') + '</p>' +
      '<p class="inv-gallery-sizes">' + d.sizes.map(function(s) { return WDG_SIZE_NAMES[s]; }).join(' · ') + '</p></div>' +
      '<div class="inv-gallery-act">' + act + '</div></article>';
  }).join('');
  var boards = Object.keys(WDG_BOARDS);
  var head = dialogHeadHtml('Add a widget', 'invWdgGalleryDone', 'Close') ;
  return '<div class="inv-dialog inv-dialog-wide" role="dialog" aria-modal="true" aria-label="Add a widget" data-wdg-gallery>' + head +
    (boards.length > 1 ? '<div class="inv-seg" role="group" aria-label="Board">' + boards.map(function(b) {
      return '<button type="button" class="inv-seg-btn" data-action="invWdgGalleryBoard" data-board="' + b + '" aria-pressed="' + (b === board) + '">' + escHtml(WDG_BOARDS[b]) + ' · ' + wdgShown(b).length + '</button>';
    }).join('') + '</div>' : '<p class="inv-note">' + escHtml((WDG_BOARDS[board] || 'Board') + ' · ' + wdgShown(board).length + ' on it') + '</p>') +
    chips + '<div class="inv-gallery" data-wdg-gallery-list>' + (cards || uiBlankHtml({ kind: 'empty', title: 'No widget here for your ID' })) + '</div>' +
    '<div class="inv-dialog-foot"><button type="button" class="inv-btn inv-btn-primary" data-action="invWdgGalleryDone">Done</button></div></div>';
}
function wdgGalleryOpen(board) {
  _wdgGallery.board = WDG_BOARDS[board] ? board : 'home';
  dialogOpen(wdgGalleryHtml(), { dismiss: true });
  wdgGalleryWire();
}
function wdgGalleryRedraw() {
  var scrim = document.querySelector('.inv-scrim-dialog [data-wdg-gallery]');
  if (!scrim) return;
  var list = scrim.querySelector('[data-wdg-gallery-list]'), top = list ? list.scrollTop : 0;
  keepScroll(function() { dialogOpen(wdgGalleryHtml(), { replace: true }); });
  var nl = document.querySelector('.inv-scrim-dialog [data-wdg-gallery-list]');
  if (nl) nl.scrollTop = top;
  wdgGalleryWire();
}
/* Each preview is drawn as it comes into view, on the book as it is: its blank state where it has nothing yet. */
function wdgGalleryWire() {
  var list = document.querySelector('.inv-scrim-dialog [data-wdg-gallery-list]');
  if (!list) return;
  if (_wdgPreviewObs) _wdgPreviewObs.disconnect();
  var draw = function(el) {
    if (el.dataset.drawn) return;
    el.dataset.drawn = '1';
    var def = wdgDef(el.dataset.wdgPreview);
    if (!def) return;
    el.innerHTML = wdgCardHtml(def, def.sizes[0], { board: _wdgGallery.board, preview: true });
    wdgAfter(el);
  };
  var els = list.querySelectorAll('[data-wdg-preview]');
  if (typeof IntersectionObserver !== 'function') { Array.prototype.forEach.call(els, draw); return; }
  _wdgPreviewObs = new IntersectionObserver(function(entries) {
    entries.forEach(function(en) { if (en.isIntersecting) { draw(en.target); _wdgPreviewObs.unobserve(en.target); } });
  }, { root: list, rootMargin: '200px 0px' });
  Array.prototype.forEach.call(els, function(el) { _wdgPreviewObs.observe(el); });
}

/* A toast carrying one act (Remove's Undo, §7e): the toast as every toast, its button the act. Six seconds, or until tapped. */
function showToastAct(msg, label, fn) {
  document.querySelectorAll('.inv-toast').forEach(function(t) { t.remove(); });
  var t = document.createElement('div');
  t.className = 'inv-toast inv-toast-success inv-toast-act';
  t.setAttribute('role', 'status');
  var span = document.createElement('span');
  span.textContent = msg;
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'inv-toast-btn';
  b.textContent = label;
  b.addEventListener('click', function() { t.remove(); fn(); });
  t.appendChild(span);
  t.appendChild(b);
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 6000);
}

function wdgAction(action, btn) {
  var board = (btn.closest && btn.closest('.inv-wboard') ? btn.closest('.inv-wboard').dataset.board : null) || btn.dataset.board || _wdgArrange || 'home';
  switch (action) {
    case 'invWdgGo': { var def = wdgDef(btn.dataset.w); if (def) wdgGo(def); return true; }
    case 'invWdgReport': {
      var dr = wdgDef(btn.dataset.w);
      if (dr && typeof errReport === 'function') errReport(new Error('A widget could not be drawn: ' + dr.id), 'widget: ' + dr.id);
      showToast('Reported. The rest of the board is drawn.', 'success');
      return true;
    }
    case 'invWdgArrange': wdgArrangeStart(board); return true;
    case 'invWdgDone': wdgArrangeDone(); return true;
    case 'invWdgReset': wdgReset(board); return true;
    case 'invWdgSize': {
      wdgSetSize(board, btn.dataset.w, btn.dataset.size);
      var card = btn.closest('.inv-widget');
      if (card) keepScroll(function() { wdgRedrawOne(card, btn.dataset.size); });
      var nb = document.querySelector('.inv-wboard[data-board="' + board + '"] .inv-widget[data-w="' + CSS.escape(btn.dataset.w) + '"] [data-action="invWdgSize"][data-size="' + btn.dataset.size + '"]');
      if (nb) nb.focus({ preventScroll: true });
      return true;
    }
    case 'invWdgRemove': wdgRemove(board, btn.dataset.w); wdgRedrawBoard(board); return true;
    case 'invWdgGallery': wdgGalleryOpen(board); return true;
    case 'invWdgGalleryBoard': _wdgGallery.board = btn.dataset.board; wdgGalleryRedraw(); return true;
    case 'invWdgGallerySec': _wdgGallery.section = btn.dataset.sec; wdgGalleryRedraw(); return true;
    case 'invWdgGalleryAdd': wdgAdd(_wdgGallery.board, btn.dataset.w); wdgGalleryRedraw(); wdgRedrawBoard(_wdgGallery.board); return true;
    case 'invWdgGalleryRemove': wdgRemoveFromGallery(_wdgGallery.board, btn.dataset.w); wdgGalleryRedraw(); wdgRedrawBoard(_wdgGallery.board); return true;
    case 'invWdgGalleryDone': closeTopOverlay(); return true;
  }
  return false;
}
