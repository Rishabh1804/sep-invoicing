/* ===== WIDGETS (docs/UI_PASS_3.md §7, §24; UI pass 3, U2 and U2R) =====
   Owner, 16 Oct 2026: "widgets should be flexible so different layouts are possible without breaking the UI"; 17 Oct 2026: "If we are
   going to have one card layout, then we can have different types of card layouts but organised, so maybe a financial card layout
   looks and feels different than an industrial one. Same for anything that we are putting under one label, like the action rows."
   A widget answers one question in a card. Home (today.js) and, from U3, Stats are boards of widgets each person arranges.

   This module is the framework and holds no widget's arithmetic: the card, the board, the states, the presets by role, where a
   layout is kept, arranging and the gallery, and the parts each type of card draws. Each widget is an entry in WIDGET_DEFS
   (widgetcards.js, by wdgDefine):
     { id, title, short, q, section, type, sizes, needs, go, live, feed, card, more, choose, data(ctx), draw(d, size, ctx),
       actRow(d, size, ctx), source(d, size, ctx), after(el, d, size), act(action, btn, card), change(el, card) }
   `data` reads the views (dataview.js) and the functions its screen already draws with and returns {state, tone, fig, line, lamp,
   sub, answer, facts, …}; `draw` returns the body's type parts for 's' | 'm' | 'l' through the builders below, never markup of its
   own (I14). A widget that throws draws its error state and the rest of the board is drawn. `act` takes a tap on a button of its
   own (an invWdg… action the framework does not know), `change` a pick in a <select> of its own; `feed` marks a widget that reads a
   feed's copy (feeds.js), drawn again where it stands when a copy lands.

   The card family (U2R, §24): one skeleton, in one order, for every card on a board: the head (Open: the door to its screen; Choose
   at Large), the figure, the verdict, the body (the type's parts, More at its list's end), Act, Source. Seven types, each a surface
   and the parts only it draws: Ledger (money), Docket (documents in motion), Plant (lines and machines), Crew (people), Briefing (the
   questions), Outside (the world outside) and Tools (starting things). A card is quiet while all is well; amber marks its top edge,
   red marks it and tints the card (salience follows severity). A card is exactly its size's height; the board packs dense, and shows
   its holes as slots while arranging. A layout is kept on the device, one per person, board and layout (the desktop's and the
   phone's sizes differ), never in the book. */

var WIDGET_DEFS = [];           // every widget, in the gallery's order (wdgDefine)
var _wdgIdx = {};
var WDG_SIZE_NAMES = { s: 'Small', m: 'Medium', l: 'Large' };
var WDG_SIZE_SHORT = { s: 'S', m: 'M', l: 'L' };
/* The seven types (§24d): what each is for is in its widgets' list; the surface is styles.css's (data-type). */
var WDG_TYPES = { ledger: 'Ledger', docket: 'Docket', plant: 'Plant', crew: 'Crew', brief: 'Briefing', outside: 'Outside', tools: 'Tools' };
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

/* A widget joins the set. Refused (and said to a test build) when its id is taken, it allows no size, it names no type, or it has a
   Small and no short title: one bad entry must not take the board down. */
function wdgDefine(def) {
  var no = function(why) { if (typeof console !== 'undefined') console.error('wdgDefine refused: ' + (def && def.id) + (why ? ' ' + why : '')); return null; };
  if (!def || typeof def.id !== 'string' || !def.id || _wdgIdx[def.id] || !Array.isArray(def.sizes)) return no();
  def.sizes = def.sizes.filter(function(s) { return !!WDG_SIZE_NAMES[s]; });
  if (!def.sizes.length || typeof def.draw !== 'function') return no('has no size or no draw');
  if (!WDG_TYPES[def.type]) return no('names no type');
  if (def.sizes.indexOf('s') >= 0 && !def.short) return no('has a Small and no short title');
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

/* A widget drawn from its screen's own hero (uiHeroHtml's options: tone, eyebrow, title, fig, sub, viz, body, attrs): its figure the
   hero's figure, its verdict the hero's title, its words the hero's sub; the hero's eyebrow, which says what the figures are of (the
   statement's day, the rate's age, the month's days), is its Source's first fact (§24g). The hero's attributes go on the widget (its
   id and data-card: the hooks a spec reads); a verdict's mark does not, since Home's verdict is the masthead. No options, nothing to
   say. */
function wdgFromHero(o, extra) {
  if (!o) return Object.assign({ state: 'empty' }, extra || {});
  var attrs = String(o.attrs || '').replace(/\s+data-verdict(-long)?\b/g, '');
  var eyebrow = String(o.eyebrow || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return Object.assign({ state: 'ok', tone: WDG_TONES[o.tone] ? o.tone : 'neutral', fig: o.fig || '', line: o.title || '', sub: o.sub || '',
    viz: o.viz || '', more: o.body || '', eyebrow: eyebrow, attrs: attrs }, extra || {});
}
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

/* ---------- Presets by role (§7g, §24i) ----------
   A board starts from its role's preset; any change makes it the person's own, and Reset returns to the preset. Each preset is drawn
   from what its role sees by default and packs with no hole on both layouts, packing on or off (P237). The phone keeps the desktop's
   order: a Small stays Small, the rest Medium. A widget the role may not see, or the build does not have, is left out when the
   preset is drawn. `phone` lists what the phone's preset leaves out: the Owner's Home is held under four phone screens (I10), and Do
   first's moves are each question's Act and Large cards too (§24i, §1a-14). */
var WDG_PRESETS = {
  owner: { label: 'Owner', home: [['mtd', 's'], ['q-money', 's'], ['prodday', 's'], ['cash', 's'], ['pace', 'm'], ['coming', 'm'], ['tata', 'l'],
    ['floornow', 'm'], ['risk', 's'], ['turn', 's'], ['dtp', 's'], ['atttoday', 's'], ['q-smooth', 'm'], ['dofirst', 'm']], phoneDrop: ['dofirst'] },
  office: { label: 'Office', home: [['needs', 'm'], ['quick', 's'], ['unbilled', 's'], ['quote', 's'], ['weather', 's'], ['pipe', 'm'], ['recent', 'm'],
    ['tata', 'm'], ['coming', 'm']] },
  supervisor: { label: 'Supervisor', home: [['floornow', 'l'], ['eff', 'm'], ['prodday', 's'], ['atttoday', 's'], ['risk', 's'], ['weather', 's'],
    ['stockdays', 'm'], ['attweek', 'm'], ['ot', 'm'], ['tata', 'm']] },
  floor: { label: 'Floor', home: [['floornow', 'l'], ['eff', 'm'], ['prodday', 's'], ['stockdays', 's'], ['weather', 's'], ['quick', 's'], ['heat', 'm'],
    ['needs', 'm'], ['tata', 'm'], ['coming', 'm']] }
};
function wdgRole() {
  if (typeof grdOn !== 'function' || !grdOn()) return 'owner';
  var u = typeof grdUser === 'function' ? grdUser() : null;
  return u ? u.role : 'owner';
}
function wdgPresetKey() { var r = wdgRole(); return WDG_PRESETS[r] ? r : 'owner'; }
function wdgPresetList(board, lay) {
  var p = WDG_PRESETS[wdgPresetKey()] || WDG_PRESETS.owner, drop = lay === 'phone' && p.phoneDrop ? p.phoneDrop : [];
  return (p[board] || []).filter(function(x) { return !!wdgDef(x[0]) && drop.indexOf(x[0]) < 0; }).map(function(x) {
    return [x[0], wdgFitSize(wdgDef(x[0]), lay === 'phone' && x[1] !== 's' ? 'm' : x[1])];
  });
}

/* ---------- Where a layout is kept (§7h) ----------
   On the device, one per person (the signed-in ID, `-` with the guard off), board and layout: localStorage sep_inv_layout,
   {v: 1, people: {<id>: {<board>: {preset, desk, phone, opts}}}}. A list present is the person's own for that layout; none, the
   layout follows its role's preset as this build defines it. A widget's options, its Choose among them, are kept with the board
   (`opts[id]`, both layouts). Never in the book: a backup, a pull or a merge never rearranges another device, and the change log
   never sees it. At S1 the body goes to the hub as the person's `prefs` (docs/SERVER.md). */
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
/* A widget's own options on a board (the pair a *corr* is set to, the Choose a card is on), shared by both layouts. */
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

/* ---------- The geometry of a board (§24b, §24h) ----------
   The board's columns come from its own width (12 from 60rem, 6 from 36rem, 2 under), its row and gap from styles.css's tokens (the
   2-column board's a step tighter). A card's span is its size's: a Small 3 of 12 (3 of 6, 1 of 2) and one row, a Medium 6 (6, 2) and
   two rows, a Large the row and two rows (the phone's three). Read from the board in the page, so a widget can draw its chart at the
   card's own width (wdgCardHtml's ctx.w). */
function wdgRemPx() { var f = parseFloat(getComputedStyle(document.documentElement).fontSize); return f > 0 ? f : 16; }
function wdgGeom(boardW) {
  var rem = wdgRemPx(), cols = boardW >= 60 * rem ? 12 : boardW >= 36 * rem ? 6 : 2;
  return { cols: cols, gap: (cols === 2 ? 0.75 : 1) * rem, row: (cols === 2 ? 10.5 : 10.75) * rem, w: boardW, rem: rem };
}
function wdgSpan(size, cols) {
  if (cols === 2) return { w: size === 's' ? 1 : 2, h: size === 's' ? 1 : size === 'l' ? 3 : 2 };
  if (cols === 6) return { w: size === 's' ? 3 : 6, h: size === 's' ? 1 : 2 };
  return { w: size === 's' ? 3 : size === 'm' ? 6 : 12, h: size === 's' ? 1 : 2 };
}
/* A card's width on a board of this geometry, and the room inside its sides (16px; a phone's Small 14px). */
function wdgCardW(g, size) {
  var sp = wdgSpan(size, g.cols), colW = (g.w - (g.cols - 1) * g.gap) / g.cols;
  var w = colW * sp.w + (sp.w - 1) * g.gap;
  return { card: w, body: Math.max(0, w - 2 * (g.cols === 2 && size === 's' ? 0.875 : 1) * g.rem), h: sp.h * g.row + (sp.h - 1) * g.gap };
}
/* Where each card stands when the browser places them sparse, row by row in the layout's order, and the holes they leave (pure, §24h):
   items [{w, h}] in columns of the board; {places: [{r, c}], holes: [{r, c, w, h, at}]}, rows and columns from 0, a hole's `at` the
   index in the layout a widget added there takes. Holes are cut as the board's own sizes (a Medium's room where a Medium fits, else
   a Small's), up to the last row any card stands on. This is CSS's sparse auto-placement: the cursor only moves forward. */
function wdgPlace(items, cols) {
  var occ = [], places = [], cr = 0, cc = 0, last = -1;
  var free = function(r, c, w, h) {
    if (c + w > cols) return false;
    for (var i = r; i < r + h; i++) for (var j = c; j < c + w; j++) if (occ[i] && occ[i][j] != null) return false;
    return true;
  };
  var mark = function(r, c, w, h, v) { for (var i = r; i < r + h; i++) { occ[i] = occ[i] || []; for (var j = c; j < c + w; j++) occ[i][j] = v; } };
  items.forEach(function(it, k) {
    var w = Math.min(it.w, cols), h = it.h;
    while (!free(cr, cc, w, h)) { cc++; if (cc + w > cols) { cc = 0; cr++; } }
    places.push({ r: cr, c: cc });
    mark(cr, cc, w, h, k);
    last = Math.max(last, cr + h - 1);
    cc += w;
    if (cc >= cols) { cc = 0; cr++; }
  });
  // The holes, row by row up to the last row in use: a Medium's room (half the board, two rows) where one fits, else a Small's.
  var holes = [], small = cols === 2 ? 1 : 3, med = cols === 2 ? 2 : 6;
  var before = function(r, c) { var n = 0; places.forEach(function(p) { if (p.r < r || (p.r === r && p.c < c)) n++; }); return n; };
  for (var r = 0; r <= last; r++) {
    for (var c = 0; c < cols; c++) {
      if (occ[r] && occ[r][c] != null) continue;
      var w = 0, h = 0;
      if (c % med === 0 && free(r, c, med, 2) && r + 1 <= last) { w = med; h = 2; }
      else if (c % small === 0 && free(r, c, small, 1)) { w = small; h = 1; }
      else { w = 1; h = 1; }
      mark(r, c, w, h, 'hole');
      holes.push({ r: r, c: c, w: w, h: h, at: before(r, c) });
    }
  }
  return { places: places, holes: holes, rows: last + 1 };
}

/* ---------- The card (§24b, §24c, §7c) ---------- */
var WDG_STATE_TITLE = { empty: 'Nothing recorded yet', early: 'Not enough yet', notset: 'Not set up yet', offline: 'Offline',
  loading: 'Fetching…', error: 'This widget could not be drawn' };
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
/* A blank state (§7c, §24e): its words in the card; its one door is the card's Act (tinted) at Medium and Large and none at a Small,
   whose head is the door. */
function wdgStateHtml(def, size, d) {
  var k = WDG_STATE_TITLE[d.state] ? d.state : 'empty';
  return uiBlankHtml({ kind: k, title: d.title || WDG_STATE_TITLE[k], body: d.body || '', action: '', small: size === 's' });
}
/* A blank state's act: the widget's {label, action, attrs}, or an older blank's button (a feed's door), its look the tint's. An error's
   Report it is the Act's text button. */
function wdgBlankAct(def, d) {
  if (d.state === 'error') return { text: { label: 'Report it', action: 'invWdgReport', attrs: ' data-wid="' + escHtml(def.id) + '"' } };
  if (d.act) return { tint: d.act };
  if (typeof d.action === 'string' && d.action) return { tint: { html: d.action.replace(/\binv-btn-(secondary|ghost)\b/g, 'inv-btn-tint').replace(/\s*inv-btn-sm\b/g, '') } };
  return null;
}
/* The figure, the verdict and a detail line (§24b): the figure in Geist at its size, the verdict its lamp and its words (two lines at
   most), a detail line under it in the second ink. A Briefing leads with its answer as a sentence, its key figure in its tone, and its
   facts on one line (§24d). Drawn by the framework, so the order never changes. */
function wdgLeadHtml(def, size, d, tone) {
  if (def.type === 'brief' && d.answer) {
    return '<div class="inv-brief-ans">' + d.answer + '</div>' +
      (d.facts && d.facts.length ? '<div class="inv-brief-facts">' + d.facts.filter(Boolean).map(function(f) { return '<span>' + f + '</span>'; }).join('') + '</div>' : '') +
      (d.sub ? '<div class="inv-widget-sub">' + d.sub + '</div>' : '');
  }
  return (d.fig ? '<div class="inv-widget-fig">' + d.fig + '</div>' : '') +
    (d.line ? '<div class="inv-widget-line"><span class="inv-dot inv-dot-' + uiTone(d.lamp || tone) + '" aria-hidden="true"></span><span class="inv-widget-say">' + d.line + '</span></div>' : '') +
    (d.sub ? '<div class="inv-widget-sub">' + d.sub + '</div>' : '');
}
function wdgBodyHtml(def, size, d, ctx, tone) {
  if (d.state !== 'ok') return wdgStateHtml(def, size, d);
  try { return wdgLeadHtml(def, size, d, tone) + (def.draw(d, size, ctx) || ''); }
  catch (e) { wdgErr(def, e); d.state = 'error'; return wdgStateHtml(def, size, d); }
}
/* What a widget's Choose has picked (§24e): kept with the layout (opts[id].choose), else its default; a value its options no longer
   offer is the default. */
function wdgChoice(def, ctx) {
  if (!def.choose) return null;
  var list = typeof def.choose.opts === 'function' ? def.choose.opts(ctx) || [] : [];
  var v = ctx.opts && ctx.opts.choose;
  return list.some(function(o) { return o.v === v; }) ? v : def.choose.def;
}
/* The Choose (§24e): a small segmented control in the head at Large (under it on the phone, at the card's width), its segments 24px
   pills on the desktop and 44px on the phone. A widget may draw its own (`choose.html`: corr's pair). */
function wdgChooseHtml(def, ctx) {
  if (!def.choose) return '';
  if (typeof def.choose.html === 'function') return def.choose.html(ctx) || '';
  var list = typeof def.choose.opts === 'function' ? def.choose.opts(ctx) || [] : [];
  if (list.length < 2) return '';
  return '<span class="inv-seg inv-seg-fit inv-seg-choose" role="group" aria-label="' + escHtml(def.title) + ': what it shows">' + list.map(function(o) {
    return '<button type="button" class="inv-seg-btn" data-action="invWdgChoose" data-wid="' + escHtml(def.id) + '" data-v="' + escHtml(o.v) + '" aria-pressed="' + (o.v === ctx.choose) + '">' +
      escHtml(o.label) + '</button>';
  }).join('') + '</span>';
}
/* Act (§24e): one tinted button and at most one text button beside it; either may be a link (a call is a tel: link). */
function wdgActHtml(row) {
  if (!row || (!row.tint && !row.text)) return '';
  var b = function(x, cls) {
    if (!x) return '';
    if (x.html) return x.html;
    if (x.href) return '<a class="inv-btn ' + cls + '" href="' + escHtml(x.href) + '"' + (x.attrs || '') + '>' + escHtml(x.label) + '</a>';
    return '<button type="button" class="inv-btn ' + cls + '" data-action="' + escHtml(x.action) + '"' + (x.attrs || '') + (x.disabled ? ' disabled' : '') + '>' + escHtml(x.label) + '</button>';
  };
  return '<div class="inv-widget-act">' + b(row.tint, 'inv-btn-tint') + b(row.text, 'inv-btn-link') + '</div>';
}
/* Source (§24e): where it comes from and how fresh, the card's last line, facts parted by a middle dot. A Refresh is a link in it (a
   feed's kind, drawn with its handler, or a widget's own action), and the only other link is a feed's credit where its terms ask for
   one (§1a-17). `attrs` carries the hook a spec reads (a feed's age). */
function wdgSourceHtml(src) {
  if (!src) return '';
  var parts = (src.facts || []).filter(Boolean).map(function(f) { return '<span>' + escHtml(f) + '</span>'; });
  if (src.credit && src.credit.href) parts.push('<a class="inv-widget-src-link" href="' + escHtml(src.credit.href) + '" target="_blank" rel="noopener noreferrer">' + escHtml(src.credit.label) + '</a>');
  var r = src.refresh;
  if (r) {
    var o = typeof r === 'string' ? { action: 'invFeedRefresh', attrs: ' data-kind="' + escHtml(r) + '"' } : r;
    parts.push('<button type="button" class="inv-widget-src-link" data-action="' + escHtml(o.action) + '"' + (o.attrs || '') + (src.busy ? ' disabled' : '') + '>' + (src.busy ? 'Fetching…' : 'Refresh') + '</button>');
  }
  return parts.length ? '<div class="inv-widget-src"' + (src.attrs || '') + '>' + parts.join('<span class="inv-widget-src-dot" aria-hidden="true">·</span>') + '</div>' : '';
}
/* A card (§24b): <section class="inv-widget"> on its type's surface, coded by salience (§24c: quiet when all is well, an amber or red
   edge, the red tint), its head the section's icon, the title (its short title at Small) and the door's chevron, the Choose at
   Large; its body the figure, the verdict and the type's parts; its foot the Act and the Source (neither at a Small, §24b). In arrange
   mode its handle, its place, its size and Remove ride over the head (§7e). `o.w` is the card's width on its board, so a chart is
   drawn at the card's own width (ctx.w, the room inside its sides). An Outside card is never edged or tinted: the world outside is to
   know (its tone is info at most; its figures keep their own tones). */
function wdgCardHtml(def, size, o) {
  o = o || {};
  var board = o.board || 'home', opts = wdgOpts(board, def.id);
  var ctx = { board: board, size: size, opts: opts, period: typeof _statsPeriod === 'string' ? _statsPeriod : 'mtd', preview: !!o.preview,
    w: o.w > 0 ? Math.round(o.w) : 0, h: o.h > 0 ? Math.round(o.h) : 0 };
  ctx.choose = wdgChoice(def, ctx);
  var d = wdgData(def, ctx);
  var tone = d.state === 'ok' && WDG_TONES[d.tone] ? d.tone : 'neutral';
  if (def.type === 'outside' && (tone === 'warning' || tone === 'danger')) tone = 'info';
  var body = wdgBodyHtml(def, size, d, ctx, tone);
  if (d.state !== 'ok') tone = 'neutral';
  var sec = wdgSection(def.section), id = escHtml(def.id), title = escHtml(size === 's' && def.short ? def.short : def.title);
  var door = wdgCanGo(def) && !o.preview
    ? '<button type="button" class="inv-widget-door" data-action="invWdgGo" data-wid="' + id + '" aria-label="' + escHtml(def.title) + ': open">' +
      '<span class="inv-widget-title">' + title + '</span>' + iconSvg('next', 'inv-widget-chev') + '</button>'
    : '<span class="inv-widget-door"><span class="inv-widget-title">' + title + '</span></span>';
  var chooseAt = def.choose && (def.choose.at || ['l']).indexOf(size) >= 0 && d.state === 'ok' && !o.preview ? wdgChooseHtml(def, ctx) : '';
  var head = (o.arranging ? wdgArrangeCtlHtml(def, size, o) : '') +
    '<div class="inv-widget-head">' + iconSvg(sec.icon) + door + chooseAt + '</div>';
  var foot = '';
  if (size !== 's' && !o.preview) {
    var act = null, src = null;
    if (d.state === 'ok') {
      if (typeof def.actRow === 'function') { try { act = def.actRow(d, size, ctx); } catch (e) { wdgErr(def, e); } }
      if (typeof def.source === 'function') { try { src = def.source(d, size, ctx); } catch (e) { wdgErr(def, e); } }
    } else {
      act = wdgBlankAct(def, d);
      // A feed's card says where its copy would come from, and offers Refresh, in any state (§24d Outside).
      if (def.type === 'outside' && typeof def.source === 'function') { try { src = def.source(d, size, ctx); } catch (e) { wdgErr(def, e); } }
    }
    foot = wdgActHtml(act) + wdgSourceHtml(src);
  }
  // The widget's own hooks: those its data gives (a screen's hero's id and data-card, in whatever state it says), else its def's
  // card. Ours, never typed.
  var attrs = d.attrs ? String(d.attrs) : '';
  if (def.card && !/\bdata-card=/.test(attrs)) attrs += ' data-card="' + escHtml(def.card) + '"';
  if (o.preview) attrs = attrs.replace(/\s+id="[^"]*"/g, '').replace(/\s+data-card="[^"]*"/g, '');
  return '<section class="inv-widget" data-w="' + id + '" data-size="' + size + '" data-type="' + escHtml(def.type) + '" data-tone="' + tone + '" data-state="' + escHtml(d.state) + '"' +
    attrs + ' aria-label="' + escHtml(def.title) + '">' + head +
    '<div class="inv-widget-body">' + body + '</div>' + (foot ? '<div class="inv-widget-foot">' + foot + '</div>' : '') + '</section>';
}
/* After a card is in the page: a chart's labels held at 11px whatever its drawing's scale (§24d); a widget's own hook (a chart
   measured, a fold wired), never one that writes the book; then its fit. */
function wdgAfterOne(el) {
  var def = el && wdgDef(el.dataset.w);
  if (!def) return;
  wdgPlotK(el);
  if (typeof def.after === 'function' && el.dataset.state === 'ok') { try { def.after(el, el.dataset.size); } catch (e) { wdgErr(def, e); } }
  wdgFit(el);
}
/* A chart in a card is drawn at the card's own width (its viewBox in the card's pixels); what the drawing's scale still moves is put
   back here, so every label it draws renders at 11px (--plot-k, styles.css). */
function wdgPlotK(el) {
  Array.prototype.forEach.call(el.querySelectorAll('svg.inv-chart-svg[viewBox]'), function(svg) {
    // The drawing keeps its aspect (it meets its box): its scale is the lesser of the two.
    var vb = svg.viewBox && svg.viewBox.baseVal, r = svg.getBoundingClientRect();
    if (!vb || !(vb.width > 0) || !(vb.height > 0) || !(r.width > 0) || !(r.height > 0)) return;
    var k = Math.min(r.width / vb.width, r.height / vb.height);
    svg.style.setProperty('--plot-k', String(Math.round(k * 1000) / 1000));
  });
}
/* A card never runs past its height (§24h): what it cannot hold it lets go of, measured against the card's own height. First the parts
   it can do without, all together (a tile's line of the months before, a chart's key, whatever a widget marks `data-wdg-opt`); then
   its list's last rows one at a time, never the total under a Ledger's lines, More saying how many (a Ledger's rest line their sum, so
   the lines still add up); last, a verdict past its two lines is cut at a word, its whole text its title. Nothing is cut halfway. */
var WDG_FIT_ROWS = '.inv-row, .inv-deck-item, .inv-step, .inv-row-fold, .inv-chart-ranked-row, .inv-ledger-line:not(.inv-ledger-total):not([data-wdg-rest]), .inv-docket-row, ' +
  '.inv-plant-row, .inv-crew-row, .inv-brief-move, .inv-brief-movecard, .inv-brief-row, .inv-wire-item, .inv-chart-row';
var WDG_FIT_OPT = '[data-wdg-opt], .inv-tile-viz, .inv-chart-keys';
function wdgFit(card) {
  if (!card || !card.isConnected || !card.offsetParent) return;
  var body = card.querySelector('.inv-widget-body');
  if (!body) return;
  var over = function() { return body.scrollHeight > body.clientHeight + 1 || card.scrollHeight > card.clientHeight + 1; };
  var line = body.querySelector(':scope > .inv-widget-line .inv-widget-say');
  if (line && !line.title && line.scrollHeight > line.clientHeight + 1) line.title = line.textContent;
  if (!over()) return;
  // Let go of: marked, and hidden by the mark (a row's or a card's own display would show a bare `hidden`).
  var cut = function(el) { el.setAttribute('data-wdg-cut', ''); el.hidden = true; };
  var opt = Array.prototype.filter.call(body.querySelectorAll(WDG_FIT_OPT), function(el) { return !el.hidden && !el.closest('[data-wdg-cut]'); });
  if (opt.length) { opt.forEach(cut); if (!over()) return; }
  var rows = Array.prototype.filter.call(body.querySelectorAll(WDG_FIT_ROWS), function(r) {
    return !r.hidden && !r.closest('[hidden], [data-wdg-cut]') && !r.closest('.inv-widget-more') && !r.parentElement.closest(WDG_FIT_ROWS);
  });
  if (!rows.length) return;
  var def = wdgDef(card.dataset.w), word = def && def.more ? def.more : '';
  var hid = 0, lists = [];
  while (rows.length && over()) {
    var r = rows.pop();
    cut(r);
    hid++;
    var list = r.parentElement;
    if (lists.indexOf(list) < 0) lists.push(list);
    wdgMoreSay(card, def, lists, word);
  }
  if (!hid) return;
  // A sheet whose rows all went goes with them, and a list of moves with its head.
  Array.prototype.forEach.call(body.querySelectorAll('.inv-hero-sheet, .inv-hero-moves, [data-wdg-group]'), function(sh) {
    if (!sh.querySelector(WDG_FIT_ROWS.split(', ').map(function(s) { return s + ':not([data-wdg-cut])'; }).join(', ')) && sh.querySelector(WDG_FIT_ROWS)) cut(sh);
  });
  // A More that itself ran past the foot is let go of with one more row (the count says it).
  var guard = 0;
  while (over() && guard++ < 12) {
    var left = Array.prototype.filter.call(body.querySelectorAll(WDG_FIT_ROWS), function(x) { return !x.hidden && !x.closest('[data-wdg-cut]'); });
    if (!left.length) break;
    var x = left.pop();
    cut(x);
    if (lists.indexOf(x.parentElement) < 0) lists.push(x.parentElement);
    wdgMoreSay(card, def, lists, word);
  }
}
/* The rows let go of, said at their list's end in the list's rhythm (§24e: "5 more", "4 more moves"): a Ledger's lines as a line of
   their own whose amount is their sum, any other list as More, the screen behind its door (or the widget's own `moreGo`, a dialog
   where the screen is not the list's). */
function wdgMoreSay(card, def, lists, word) {
  lists.forEach(function(list) {
    var cuts = Array.prototype.filter.call(list.children, function(el) { return el.hasAttribute('data-wdg-cut') && el.matches(WDG_FIT_ROWS); });
    var n = cuts.length, go = def && (def.moreGo || wdgCanGo(def)), id = def ? escHtml(def.id) : '';
    var noun = typeof word === 'function' ? word(n) : word ? (n === 1 ? String(word).replace(/s$/, '') : word) : '';
    var label = n + ' more' + (noun ? ' ' + noun : '');
    var ledger = list.classList.contains('inv-ledger');
    var old = list.querySelector(':scope > [data-wdg-more]');
    if (!n) { if (old) old.remove(); return; }
    var html;
    if (ledger) {
      var sum = cuts.reduce(function(s, el) { return s + (parseFloat(el.getAttribute('data-amount')) || 0); }, 0);
      html = (go ? '<button type="button" class="inv-ledger-line" data-wdg-rest data-wdg-more data-action="invWdgMore" data-wid="' + id + '"' : '<div class="inv-ledger-line" data-wdg-rest data-wdg-more') +
        ' data-amount="' + gstRound(sum, 2) + '"><span class="inv-ledger-k">' + escHtml(label) + '</span><span class="inv-ledger-lead" aria-hidden="true"></span><span class="inv-ledger-v">' +
        escHtml(wdgRs(sum)) + '</span>' + (go ? '</button>' : '</div>');
    } else {
      html = go ? '<button type="button" class="inv-widget-more" data-wdg-more data-action="invWdgMore" data-wid="' + id + '"><span>' + escHtml(label) + '</span>' + iconSvg('next') + '</button>'
        : '<div class="inv-widget-more" data-wdg-more><span>' + escHtml(label) + '</span></div>';
    }
    var t = document.createElement('div');
    t.innerHTML = html;
    var el = t.firstElementChild;
    if (old) old.replaceWith(el);
    else {
      // Before a Ledger's total, else at the list's end.
      var total = ledger ? list.querySelector(':scope > .inv-ledger-total') : null;
      list.insertBefore(el, total || null);
    }
  });
}
function wdgAfter(root) {
  if (root) Array.prototype.forEach.call(root.querySelectorAll('.inv-widget[data-w]'), wdgAfterOne);
}

/* ---------- The type's parts (§24d): presentation only; a widget hands them its screen's figures (I8) ---------- */
/* Ledger: statement lines, amounts on dotted leaders, whole rupees (finRs) so they add up; a total ruled once above and twice below,
   drawn only where the lines above add up to it (to half a rupee a line: each is rounded from its exact amount). A line {label, meta
   (HTML), amount (the exact figure), value (HTML in its place: a tone), go: {action, attrs}, attrs}; total {label, amount}. */
/* A statement line's amount: whole rupees (finRs), a minus a minus sign (design §5.4), never a hyphen. */
function wdgRs(v) { var t = finRs(v); return t.charAt(0) === '-' ? '\u2212' + t.slice(1) : t; }
function wdgLedgerHtml(lines, total, o) {
  o = o || {};
  var list = (lines || []).filter(Boolean), sum = 0;
  var rows = list.map(function(l) {
    var amt = Number(l.amount) || 0;
    sum += amt;
    var inner = '<span class="inv-ledger-k"><span class="inv-ledger-label">' + escHtml(l.label) + '</span>' + (l.meta ? '<span class="inv-ledger-meta">' + l.meta + '</span>' : '') + '</span>' +
      '<span class="inv-ledger-lead" aria-hidden="true"></span><span class="inv-ledger-v"' + (l.value != null ? '' : ' title="' + escHtml(formatCurrency(amt)) + '"') + '>' + (l.value != null ? l.value : escHtml(wdgRs(amt))) + '</span>';
    var a = ' data-amount="' + gstRound(amt, 2) + '"' + (l.attrs || '');
    return l.go ? '<button type="button" class="inv-ledger-line" data-action="' + escHtml(l.go.action) + '"' + (l.go.attrs || '') + a + '>' + inner + '</button>'
      : '<div class="inv-ledger-line"' + a + '>' + inner + '</div>';
  });
  var tot = '';
  if (total && list.length && Math.abs(sum - (Number(total.amount) || 0)) <= 0.5 * list.length + 0.005) {
    tot = '<div class="inv-ledger-line inv-ledger-total" data-amount="' + gstRound(total.amount, 2) + '"><span class="inv-ledger-k"><span class="inv-ledger-label">' + escHtml(total.label || 'Total') + '</span></span>' +
      '<span class="inv-ledger-lead" aria-hidden="true"></span><span class="inv-ledger-v"' + (total.value != null ? '' : ' title="' + escHtml(formatCurrency(total.amount)) + '"') + '>' +
      (total.value != null ? total.value : escHtml(wdgRs(total.amount))) + '</span></div>';
  }
  return '<div class="inv-ledger"' + (o.attrs || '') + '>' + rows.join('') + tot + '</div>';
}
/* Ledger: the age bar (as Money's) and its key under it, four columns, each its swatch, its band and its sum. bands [{label, amount,
   tone}]. */
function wdgAgeHtml(bands, title) {
  var live = bands.filter(function(b) { return b.amount > 0.005; });
  return '<div class="inv-widget-viz">' + chartMeter(live.map(function(b) { return { v: b.amount, tone: b.tone }; }), { title: title || '' }) + '</div>' +
    '<div class="inv-meter-key">' + bands.map(function(b) {
      return '<span data-tone="' + escHtml(uiTone(b.tone)) + '"><span class="inv-meter-key-l">' + escHtml(b.label) + '</span><span class="inv-meter-key-v" title="' + escHtml(formatCurrency(b.amount)) + '">' +
        escHtml(wdgRs(b.amount)) + '</span></span>';
    }).join('') + '</div>';
}
/* Docket: a document's state as steps, a pip a state: those passed in the third ink, the one it stands at longer and in its age's tone,
   those to come in the border. {n, at, tone, say}. */
function wdgStepsHtml(s) {
  var pips = '';
  for (var i = 0; i < s.n; i++) pips += '<i' + (i < s.at ? ' data-s="done"' : i === s.at ? ' data-s="now" data-tone="' + escHtml(uiTone(s.tone)) + '"' : '') + '></i>';
  return '<span class="inv-docket-steps" role="img" aria-label="' + escHtml(s.say || '') + '"' + (s.say ? ' title="' + escHtml(s.say) + '"' : '') + '>' + pips + '</span>';
}
/* Docket: a row read across like a register: the document's number (Geist Mono), the party and its meta, the amount and its steps,
   and the row's own action where it has one. {no, party, meta (HTML), amount (HTML), steps, go: {action, attrs}, act: {label, action,
   attrs, icon}, attrs}. */
function wdgDocketRowHtml(o) {
  var inner = '<span class="inv-docket-no inv-id">' + escHtml(o.no || '') + '</span><span class="inv-docket-p"><span class="inv-docket-party">' + escHtml(o.party || '') + '</span>' +
    (o.meta ? '<span class="inv-docket-meta">' + o.meta + '</span>' : '') + '</span><span class="inv-docket-r">' + (o.amount ? '<span class="inv-docket-amt">' + o.amount + '</span>' : '') +
    (o.steps ? wdgStepsHtml(o.steps) : '') + '</span>';
  var main = o.go ? '<button type="button" class="inv-docket-main" data-action="' + escHtml(o.go.action) + '"' + (o.go.attrs || '') + '>' + inner + '</button>'
    : '<span class="inv-docket-main">' + inner + '</span>';
  var a = o.act ? '<button type="button" class="inv-btn inv-btn-tint inv-btn-sm' + (o.act.icon ? ' inv-btn-icon' : '') + '" data-action="' + escHtml(o.act.action) + '"' + (o.act.attrs || '') +
    (o.act.icon ? ' aria-label="' + escHtml(o.act.label) + '" title="' + escHtml(o.act.label) + '">' + iconSvg(o.act.icon) : '>' + escHtml(o.act.label)) + '</button>' : '';
  return '<div class="inv-docket-row"' + (o.attrs || '') + '>' + main + a + '</div>';
}
/* Docket: the pipeline's stages as one strip in a well, a stage a cell with its count and sum, the stage the card leads with lifted;
   each opens its stage. stages [{key, label, count, sum (HTML), tone, lead, go: {action, attrs}}]. Under 32rem of card, a stage a
   row (styles.css). */
function wdgStageHtml(stages) {
  return '<div class="inv-docket-stage" role="list">' + stages.map(function(s) {
    var inner = '<span class="inv-docket-stage-n">' + escHtml(s.label) + '</span><span class="inv-docket-stage-c"><span class="inv-dot inv-dot-' + escHtml(uiTone(s.tone)) + '" aria-hidden="true"></span>' +
      escHtml(String(s.count)) + '</span><span class="inv-docket-stage-s">' + (s.sum || '') + '</span>';
    var a = ' role="listitem" data-stage="' + escHtml(s.key) + '"' + (s.lead ? ' aria-current="true"' : '') + (s.attrs || '');
    return s.go ? '<button type="button" class="inv-docket-cell" data-action="' + escHtml(s.go.action) + '"' + (s.go.attrs || '') + a + '>' + inner + '</button>'
      : '<span class="inv-docket-cell"' + a + '>' + inner + '</span>';
  }).join('') + '</div>';
}
/* Plant: a nameplate (the name as the app writes it, Geist Mono in a small well, never upper-cased by style), a reading with its unit. */
function wdgPlateHtml(name) { return '<span class="inv-plate">' + escHtml(name) + '</span>'; }
function wdgReadingHtml(fig, unit) { return '<span class="inv-reading">' + fig + (unit ? '<span class="inv-unit">' + escHtml(unit) + '</span>' : '') + '</span>'; }
/* Plant: a line a row: its lamp ringed in its tone, its nameplate, what it runs and its meta, its gauge with its figure. {tone, plate,
   what, meta (HTML), gauge (HTML: chartMeter), fig (HTML), go: {action, attrs}, attrs}. */
function wdgPlantRowHtml(o) {
  var inner = '<span class="inv-dot inv-dot-' + escHtml(uiTone(o.tone)) + '" aria-hidden="true"></span>' + wdgPlateHtml(o.plate || '') +
    '<span class="inv-plant-what"><span class="inv-plant-name">' + escHtml(o.what || '') + '</span>' + (o.meta ? '<span class="inv-plant-meta">' + o.meta + '</span>' : '') + '</span>' +
    '<span class="inv-plant-g">' + (o.fig ? '<span class="inv-plant-fig">' + o.fig + '</span>' : '') + (o.gauge || '') + '</span>';
  var a = o.attrs || '';
  return o.go ? '<button type="button" class="inv-plant-row" data-action="' + escHtml(o.go.action) + '"' + (o.go.attrs || '') + a + '>' + inner + '</button>'
    : '<div class="inv-plant-row"' + a + '>' + inner + '</div>';
}
/* Crew: a seat a hand the day needs: filled when on site, ringed in the warning when short, a seat ringed in info for each hand over.
   {need, on}: the seats and what they say. */
function wdgSeatsHtml(o) {
  var need = Math.max(0, o.need || 0), on = Math.max(0, o.on || 0), s = '';
  for (var i = 0; i < Math.max(need, on); i++) s += '<i class="inv-seat"' + (i >= need ? ' data-s="over"' : i >= on ? ' data-s="short"' : '') + '></i>';
  var say = on + ' of ' + need + (o.what ? ' ' + o.what : '');
  return '<span class="inv-seats" role="img" aria-label="' + escHtml(say) + '" title="' + escHtml(say) + '">' + s + '</span>';
}
/* Crew: an area a row: its name, its seats and its word. {name, need, on, tone, word, attrs}. */
function wdgCrewRowHtml(o) {
  return '<div class="inv-crew-row"' + (o.attrs || '') + '><span class="inv-crew-name">' + escHtml(o.name) + '</span>' + wdgSeatsHtml(o) +
    '<span class="inv-crew-word">' + uiDot(o.tone || 'neutral', escHtml(o.word || '')) + '</span></div>';
}
/* Briefing: a move as a row: its lamp, its sentence, its worth and what the worth rests on, the move's button tinted and small; a tap
   on the move (anywhere but its button) opens the move's dialog (advMoveOpen), where Add to my list is. */
function wdgMoveWorth(mv) {
  var w = mv.worth;
  if (!w || !(w.amount > 0.005)) return '';
  var lbl = typeof advWorthLabel === 'function' ? advWorthLabel(w) : '';
  return figHtml('<span data-adv-worth title="' + escHtml(formatCurrency(w.amount)) + '">' + (w.sign < 0 ? '&minus;' : '+') + escHtml(inrCard(w.amount).text) + '</span>', w.sign < 0 ? 'danger' : 'ok') +
    (lbl ? ' ' + escHtml(lbl) : '');
}
function wdgMoveBtnHtml(mv, ref, cls) {
  if (mv.href) return '<a class="inv-btn inv-btn-tint ' + (cls || '') + '" href="' + escHtml(mv.href) + '" data-adv-call>' + escHtml(mv.hrefLabel || 'Call') + '</a>';
  if (mv.go) return '<button type="button" class="inv-btn inv-btn-tint ' + (cls || '') + '" data-action="invAdvGo" data-key="' + escHtml(mv.key) + '" data-adv-row="' + escHtml(ref) + '">' + escHtml(mv.goLabel || 'Open') + '</button>';
  return '';
}
var WDG_MOVE_TONE = { red: 'danger', amber: 'warning', info: 'info', ok: 'ok' };
function wdgMoveRowHtml(mv) {
  var ref = advRowRef(mv), worth = wdgMoveWorth(mv);
  var meta = [worth, mv.basis ? escHtml(mv.basis) : ''].filter(Boolean).join(' · ');
  return '<div class="inv-brief-move" data-adv-move="' + escHtml(mv.key) + '" data-tone="' + escHtml(mv.tone) + '">' +
    '<button type="button" class="inv-brief-move-main" data-action="invAdvMove" data-key="' + escHtml(mv.key) + '" data-adv-row="' + escHtml(ref) + '">' +
    '<span class="inv-dot inv-dot-' + (WDG_MOVE_TONE[mv.tone] || 'neutral') + '" aria-hidden="true"></span><span class="inv-brief-move-s">' + escHtml(mv.say) + '</span>' +
    (meta ? '<span class="inv-brief-move-w">' + meta + '</span>' : '') + '</button>' + wdgMoveBtnHtml(mv, ref, 'inv-btn-sm') + '</div>';
}
/* Briefing at Large: a move as a card in a well, its worth large in the tone of its sign, its sentence, what it rests on, its action
   at its foot. */
function wdgMoveCardHtml(mv) {
  var ref = advRowRef(mv), w = mv.worth, lbl = w && typeof advWorthLabel === 'function' ? advWorthLabel(w) : '';
  return '<div class="inv-brief-movecard" data-adv-move="' + escHtml(mv.key) + '" data-tone="' + escHtml(mv.tone) + '">' +
    '<button type="button" class="inv-brief-move-main" data-action="invAdvMove" data-key="' + escHtml(mv.key) + '" data-adv-row="' + escHtml(ref) + '">' +
    (w && w.amount > 0.005 ? '<span class="inv-brief-movecard-w">' + figHtml('<span data-adv-worth title="' + escHtml(formatCurrency(w.amount)) + '">' + (w.sign < 0 ? '&minus;' : '+') +
      escHtml(inrCard(w.amount).text) + '</span>', w.sign < 0 ? 'danger' : 'ok') + (lbl ? '<span class="inv-unit">' + escHtml(lbl) + '</span>' : '') + '</span>' : '') +
    '<span class="inv-brief-move-s">' + escHtml(mv.say) + '</span>' + (mv.basis ? '<span class="inv-brief-move-w">' + escHtml(mv.basis) + '</span>' : '') + '</button>' +
    wdgMoveBtnHtml(mv, ref, 'inv-btn-sm') + '</div>';
}
/* Briefing: a dated row led by its day in a small well (Today in the accent's soft colour, the period on show, DR-2), its lamp, what
   it is and why, the row its door. {day, today, tone, title, why, go: {action, attrs}, attrs}. */
function wdgWhenRowHtml(o) {
  var inner = '<span class="inv-brief-when"' + (o.today ? ' data-now' : '') + '>' + escHtml(o.day) + '</span><span class="inv-brief-row-what"><span class="inv-brief-row-t">' +
    '<span class="inv-dot inv-dot-' + escHtml(uiTone(o.tone)) + '" aria-hidden="true"></span>' + escHtml(o.title) + '</span>' + (o.why ? '<span class="inv-brief-row-why">' + escHtml(o.why) + '</span>' : '') + '</span>';
  return o.go ? '<button type="button" class="inv-brief-row" data-action="' + escHtml(o.go.action) + '"' + (o.go.attrs || '') + (o.attrs || '') + '>' + inner + '</button>'
    : '<div class="inv-brief-row"' + (o.attrs || '') + '>' + inner + '</div>';
}
/* Outside: headlines with their dateline, each a link out (an escaped title, http(s) only, a new tab, no opener, no referrer). */
function wdgWireHtml(items) {
  return '<div class="inv-wire" data-tata-news>' + (items || []).map(function(it) {
    if (!it || !it.title) return '';
    var url = typeof feedSafeUrl === 'function' ? feedSafeUrl(it.url) : '', meta = [it.source, it.when].filter(Boolean).join(' · ');
    var inner = '<span class="inv-wire-head">' + escHtml(it.title) + '</span>' + (meta ? '<span class="inv-wire-dateline">' + escHtml(meta) + '</span>' : '');
    return url ? '<a class="inv-wire-item" data-feed-item href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer" title="' + escHtml(it.title) + '">' + inner + iconSvg('external') + '</a>'
      : '<div class="inv-wire-item" data-feed-item>' + inner + '</div>';
  }).join('') + '</div>';
}
/* Tools: keys on a sunk tray, three across (six once the card is 40rem wide), each its icon in the accent over its word. keys [{label,
   icon, action, attrs}]. */
function wdgTrayHtml(keys, label) {
  return '<div class="inv-tray" role="group" aria-label="' + escHtml(label || 'Quick actions') + '">' + keys.map(function(k) {
    return '<button type="button" class="inv-tray-key" data-action="' + escHtml(k.action) + '"' + (k.attrs || '') + '>' + iconSvg(k.icon) + '<span>' + escHtml(k.label) + '</span></button>';
  }).join('') + '</div>';
}

/* A row of the screen's own kind in a card's list (a fact, a client, a part, a receipt): its title and meta, its end (a figure, or a
   status as a dot and a word) and the row's own one action where it has one (a small tinted button, §24e); the row its door where it
   has one. {title, meta (HTML), fig (HTML), tone, word, go: {action, attrs}, act: {label, action, attrs}, attrs}. */
function wdgRowHtml(o) {
  var main = '<span class="inv-row-title">' + escHtml(o.title || '') + '</span>' + (o.meta ? '<span class="inv-row-meta">' + o.meta + '</span>' : '');
  var act = o.act ? '<button type="button" class="inv-btn inv-btn-tint inv-btn-sm" data-action="' + escHtml(o.act.action) + '"' + (o.act.attrs || '') + '>' + escHtml(o.act.label) + '</button>' : '';
  return '<div class="inv-row' + (o.meta ? ' inv-row-2' : '') + '"' + (o.attrs || '') + '>' +
    (o.go ? '<button type="button" class="inv-row-main" data-action="' + escHtml(o.go.action) + '"' + (o.go.attrs || '') + '>' + main + '</button>' : '<span class="inv-row-main">' + main + '</span>') +
    uiRowEndHtml(o.fig || '', o.word ? { tone: o.tone, word: o.word } : null, act) + '</div>';
}
/* A jump a card makes to a place (todoGo's: the guard's refusal and the typed-work question come with it): the place in the button's
   data-go, read by invWdgJump. */
function wdgJumpAttrs(go) { return ' data-go="' + escHtml(JSON.stringify(go || {})) + '"'; }
/* A type's list (§24d): its rows in one box, so More is said at the list's end and the fit lets go of its last rows. kind: 'docket',
   'plant', 'crew', 'moves' (a Briefing's move rows), 'movecards' (Large's), 'when' (dated rows), 'rows' (a screen's own rows). */
var WDG_LIST_CLS = { docket: 'inv-docket', plant: 'inv-plant', crew: 'inv-crew', moves: 'inv-brief-moves', movecards: 'inv-brief-movecards',
  when: 'inv-brief-rows', rows: 'inv-widget-rows' };
function wdgListHtml(kind, rows, attrs) {
  var list = (rows || []).filter(Boolean);
  return list.length ? '<div class="' + (WDG_LIST_CLS[kind] || 'inv-widget-rows') + '"' + (attrs || '') + '>' + list.join('') + '</div>' : '';
}
/* Crew: who is away, by name (the roster on the device). */
function wdgAwayHtml(names, attrs) {
  return names && names.length ? '<div class="inv-crew-away"' + (attrs || '') + '><b>Away:</b> ' + escHtml(names.join(', ')) + '</div>' : '';
}
/* Tiles in a card (wells, §24b), each a factor tile (uiFactorTileHtml's shape). */
function wdgTilesHtml(tiles, attrs) {
  var list = (tiles || []).filter(Boolean);
  if (!list.length) return '';
  return '<div class="inv-tiles' + (list.length === 4 ? ' inv-tiles-4' : list.length === 3 ? ' inv-tiles-3' : '') + '"' + (attrs || '') + '>' + list.map(uiFactorTileHtml).join('') + '</div>';
}
/* A chart in a card (§24d): bare, drawn at the card's own width and the height it leaves (`h`, the card's pixels), with the widget's
   own options. */
function wdgChartOpts(ctx, h, o) {
  return Object.assign({ bare: true, w: ctx && ctx.w > 0 ? ctx.w : 0, h: h > 0 ? Math.round(h) : 0 }, o || {});
}
/* The room a card's body leaves its chart, in pixels: the card's height less its head, the lines above the chart (`lines`, each about
   a line of 13px text with its gap), and its foot where one is drawn (an Act and a Source). */
function wdgChartRoom(ctx, lines, foot) {
  var rem = wdgRemPx(), h = ctx && ctx.h > 0 ? ctx.h : 22 * rem;
  var used = 2.75 * rem + (lines || 0) * 1.3 * rem + (foot === false || (ctx && ctx.size === 's') ? 0.875 * rem : (foot === 'act' ? 4.5 : 2.4) * rem);
  return Math.max(4 * rem, h - used);
}

/* ---------- The board (§7b, §24h) ---------- */
var _wdgArrange = null;      // the board being arranged, or null
var _wdgUndo = null;         // the last widget removed: {board, lay, list}
var _wdgAt = null;           // where a widget added from a slot goes in the layout's order (Add here)
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
/* The board: its cards in the layout's order, each its size's height; arranging, each card set where it stands sparse and each hole a
   slot (wdgPlace), so what is arranged is where it shows. `w` is the board's width (wdgGeom), so each card draws at its own width. */
function wdgBoardHtml(board, w) {
  var shown = wdgShown(board), arranging = _wdgArrange === board, n = shown.length, g = w > 0 ? wdgGeom(w) : null;
  var place = arranging && g ? wdgPlace(shown.map(function(x) { return wdgSpan(x[1], g.cols); }), g.cols) : null;
  var cards = shown.map(function(x, i) {
    var cw = g ? wdgCardW(g, x[1]) : null;
    return wdgCardHtml(wdgDef(x[0]), x[1], { board: board, i: i, n: n, arranging: arranging, w: cw ? cw.body : 0, h: cw ? cw.h : 0 });
  }).join('');
  if (place) {
    cards += place.holes.map(function(hl) {
      var med = hl.h > 1;
      return '<div class="inv-wgrid-slot" data-slot-at="' + hl.at + '" data-r="' + hl.r + '" data-c="' + hl.c + '" data-w="' + hl.w + '" data-h="' + hl.h + '">' +
        '<span>' + (med ? 'Room for a Medium' : 'Room for a Small') + '</span>' +
        '<button type="button" class="inv-btn inv-btn-tint inv-btn-sm" data-action="invWdgSlot" data-board="' + escHtml(board) + '" data-at="' + hl.at + '">Add here</button></div>';
    }).join('');
  }
  if (!n) cards = '<div class="inv-wgrid-blank">' + uiBlankHtml({ kind: 'empty', title: 'Nothing on ' + (WDG_BOARDS[board] || 'the board') + ' yet',
    body: 'Add the widgets you want to see here.',
    action: '<button type="button" class="inv-btn inv-btn-tint inv-btn-sm" data-action="invWdgGallery" data-board="' + escHtml(board) + '">Add a widget</button>' }) + '</div>';
  return '<div class="inv-wboard" data-board="' + escHtml(board) + '"' + (arranging ? ' data-arranging' : '') + '>' +
    '<div class="inv-visually-hidden" aria-live="polite" data-wdg-live></div>' +
    '<div class="inv-wgrid" data-wgrid="' + escHtml(board) + '">' + cards + '</div></div>';
}
/* Draws a board into its host, then lays it out: each widget's hook and fit, the places while arranging, the live redraws. Nothing is
   focused when a board is drawn (§24b): the draw moves no focus. */
function wdgBoardDraw(host, board) {
  if (!host) return;
  host.innerHTML = wdgBoardHtml(board, host.clientWidth);
  wdgPack(host);
  wdgAfter(host);
  wdgLiveStart(host, board);
}
/* Arranging, every card and slot is set where wdgPlace put it (--wdg-r, --wdg-c: its row and column, from 1); packed, the browser
   places them dense, the DOM in the layout's order. */
function wdgPack(host) {
  var grid = host && host.querySelector('.inv-wgrid');
  if (!grid || !grid.closest('[data-arranging]')) return;
  var g = wdgGeom(grid.clientWidth || host.clientWidth);
  var cards = Array.prototype.filter.call(grid.children, function(el) { return el.classList.contains('inv-widget'); });
  var spans = cards.map(function(el) { return wdgSpan(el.dataset.size, g.cols); }), pl = wdgPlace(spans, g.cols);
  cards.forEach(function(el, i) {
    el.style.setProperty('--wdg-r', String(pl.places[i].r + 1)); el.style.setProperty('--wdg-c', String(pl.places[i].c + 1));
    el.style.setProperty('--wdg-sw', String(Math.min(spans[i].w, g.cols))); el.style.setProperty('--wdg-sh', String(spans[i].h));
    el.setAttribute('data-placed', '');
  });
  Array.prototype.forEach.call(grid.querySelectorAll(':scope > .inv-wgrid-slot'), function(el) {
    el.style.setProperty('--wdg-r', String(Number(el.dataset.r) + 1)); el.style.setProperty('--wdg-c', String(Number(el.dataset.c) + 1));
    el.style.setProperty('--wdg-sw', el.dataset.w); el.style.setProperty('--wdg-sh', el.dataset.h);
  });
}
/* One widget drawn again where it stands (a size picked, a Choose, a live widget's minute): nothing else on the board is touched. */
function wdgRedrawOne(el, size) {
  var board = el.closest('.inv-wboard'), def = wdgDef(el.dataset.w);
  if (!board || !def) return;
  var shown = wdgShown(board.dataset.board), i = shown.map(function(x) { return x[0]; }).indexOf(def.id);
  var grid = el.parentElement, g = wdgGeom((grid && grid.clientWidth) || board.clientWidth), sz = size || el.dataset.size, cw = wdgCardW(g, sz);
  var t = document.createElement('div');
  t.innerHTML = wdgCardHtml(def, sz, { board: board.dataset.board, i: i, n: shown.length, arranging: _wdgArrange === board.dataset.board, w: cw.body, h: cw.h });
  var card = t.firstElementChild;
  ['--wdg-r', '--wdg-c', '--wdg-sw', '--wdg-sh'].forEach(function(p) { var v = el.style.getPropertyValue(p); if (v) card.style.setProperty(p, v); });
  if (el.hasAttribute('data-placed')) card.setAttribute('data-placed', '');
  el.replaceWith(card);
  wdgAfterOne(card);
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

/* ---------- Arranging (§7e, §24h) ----------
   Customise puts the board in arrange mode, a layer over the screen (Back, Escape and Done leave it; a swipe does nothing while
   it is on). Packing is off while arranging: what is arranged is where it stands, and each hole is a slot (Room for a Small or a
   Medium, and Add here). Each widget shows its handle, its place, its size and Remove; the toolbar Add a widget, Reset and Done. A
   drop, a key, a size or a removal writes the layout on screen only: the desktop's and the phone's are their own. */
function wdgArrangeCtlHtml(def, size, o) {
  var id = escHtml(def.id), title = escHtml(def.title);
  var sizes = def.sizes.length > 1 ? '<span class="inv-seg inv-widget-sizes" role="group" aria-label="Size of ' + title + '">' +
    ['s', 'm', 'l'].filter(function(s) { return def.sizes.indexOf(s) >= 0; }).map(function(s) {
      return '<button type="button" class="inv-seg-btn" data-action="invWdgSize" data-wid="' + id + '" data-size="' + s + '" aria-pressed="' + (s === size) + '" aria-label="' +
        WDG_SIZE_NAMES[s] + '">' + WDG_SIZE_SHORT[s] + '</button>';
    }).join('') + '</span>' : '';
  return '<div class="inv-widget-ctl">' +
    '<button type="button" class="inv-widget-handle" data-wdg-handle="' + id + '" aria-label="Move ' + title + ', ' + (o.i + 1) + ' of ' + o.n + '">' + iconSvg('grip') + '</button>' +
    '<span class="inv-widget-place" data-wdg-place>' + (o.i + 1) + ' of ' + o.n + '</span>' + sizes +
    '<button type="button" class="inv-btn inv-btn-icon inv-btn-ghost inv-widget-remove" data-action="invWdgRemove" data-wid="' + id + '" aria-label="Remove ' + title + '">' + iconSvg('close') + '</button></div>';
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
  _wdgAt = null;
  wdgDragCancel();
  if (!quiet) wdgRedrawBoard(board);
  return true;
}
/* The board's screen draws itself (Home: renderHomeBoard), toolbar and all, keeping the page where it is. */
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
/* Added from the gallery: to the end of the layout on screen (or where its slot stood, Add here), and to the end of the other layout
   at its first size. */
function wdgAdd(board, id) {
  var def = wdgDef(id);
  if (!def || !wdgSees(def)) return;
  var lay = wdgLay();
  ['desk', 'phone'].forEach(function(l) {
    var list = wdgItems(board, l);
    if (list.some(function(x) { return x[0] === id; })) return;
    var item = [id, l === lay ? def.sizes[0] : wdgFitSize(def, l === 'phone' && def.sizes[0] !== 's' ? 'm' : def.sizes[0])];
    if (l === lay && _wdgAt != null) {
      // The slot's place counts the widgets the person sees; it goes before the one that stood after the slot.
      var seen = list.map(function(x, i) { return wdgSees(wdgDef(x[0])) ? i : -1; }).filter(function(i) { return i >= 0; });
      var pos = _wdgAt < seen.length ? seen[_wdgAt] : list.length;
      list.splice(pos, 0, item);
    } else list.push(item);
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
  // Escape during a drag puts the widget back and stays arranging, wherever the focus is (the layer's own Escape leaves arranging).
  if (e.key === 'Escape' && (_wdgDrag || _wdgHold)) { e.preventDefault(); e.stopPropagation(); wdgDragCancel(); return; }
  var h = e.target && e.target.closest ? e.target.closest('[data-wdg-handle]') : null;
  if (!h || !_wdgArrange) return;
  var board = _wdgArrange, id = h.dataset.wdgHandle, shown = wdgShown(board).map(function(x) { return x[0]; });
  var i = shown.indexOf(id), to = null;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = i - 1;
  else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = i + 1;
  else if (e.key === 'Home') to = 0;
  else if (e.key === 'End') to = shown.length - 1;
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

/* While a widget is lifted the board lays itself out by the browser again (the placeholder takes the lifted card's room in the order),
   so a drag shows where the widget will land; the drop draws the board placed anew. */
function wdgDragStart(card, e) {
  var grid = card.parentElement, r = card.getBoundingClientRect();
  if (!grid) return;
  var ph = document.createElement('div');
  ph.className = 'inv-widget-ph';
  ph.dataset.size = card.dataset.size;
  ph.setAttribute('aria-hidden', 'true');
  // The placeholder takes the lifted card's room: its span, as the card had it.
  ['--wdg-sw', '--wdg-sh'].forEach(function(p) { var v = card.style.getPropertyValue(p); if (v) ph.style.setProperty(p, v); });
  grid.insertBefore(ph, card);
  grid.setAttribute('data-dragging', '');
  card.classList.add('inv-widget-lifted');
  card.style.setProperty('--drag-w', r.width + 'px');
  card.style.setProperty('--drag-h', r.height + 'px');
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
  if (ref !== d.ph && ref !== d.ph.nextSibling) d.grid.insertBefore(d.ph, ref);
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
  d.grid.removeAttribute('data-dragging');
  d.card.classList.remove('inv-widget-lifted');
  ['--drag-w', '--drag-h', '--drag-x', '--drag-y'].forEach(function(p) { d.card.style.removeProperty(p); });
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
      ? '<span class="inv-dot inv-dot-ok" data-wdg-on>On ' + escHtml(name) + '</span><button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invWdgGalleryRemove" data-wid="' + id + '">Remove</button>'
      : '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invWdgGalleryAdd" data-wid="' + id + '">Add to ' + escHtml(name) + '</button>';
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
/* The gallery drawn again after a chip, a board, an Add or a Remove: its parts are swapped inside the dialog that is open, never the
   dialog itself (a dialog replaced replays its slide-in, so every tap slid the sheet up again), a preview already drawn is carried
   over as it is (drawn anew, every preview in sight flashed blank), and the list keeps where it was scrolled. `focusSel` names the
   control that holds the focus after (the card's Remove after an Add, its Add after a Remove); else keepScroll's own key finds it. */
function wdgGalleryRedraw(focusSel) {
  var dlg = document.querySelector('.inv-scrim-dialog [data-wdg-gallery]');
  if (!dlg) return;
  var list = dlg.querySelector('[data-wdg-gallery-list]'), top = list ? list.scrollTop : 0;
  var tmp = document.createElement('div');
  tmp.innerHTML = wdgGalleryHtml();
  var fresh = tmp.firstElementChild;
  if (!fresh) return;
  Array.prototype.forEach.call(dlg.querySelectorAll('[data-wdg-preview][data-drawn]'), function(old) {
    var nu = fresh.querySelector('[data-wdg-preview="' + CSS.escape(old.dataset.wdgPreview) + '"]');
    if (nu) nu.parentNode.replaceChild(old, nu);
  });
  keepScroll(function() {
    while (dlg.firstChild) dlg.removeChild(dlg.firstChild);
    while (fresh.firstChild) dlg.appendChild(fresh.firstChild);
  });
  var nl = dlg.querySelector('[data-wdg-gallery-list]');
  if (nl) nl.scrollTop = top;
  wdgGalleryWire();
  var f = focusSel ? dlg.querySelector(focusSel) : null;
  if (f) f.focus({ preventScroll: true });
}
/* Each preview is drawn as it comes into view, on the book as it is, at its first size and the preview's own width: one row tall
   (--wdg-row), its blank state where it has nothing yet. */
function wdgGalleryWire() {
  var list = document.querySelector('.inv-scrim-dialog [data-wdg-gallery-list]');
  if (!list) return;
  if (_wdgPreviewObs) _wdgPreviewObs.disconnect();
  var draw = function(el) {
    if (el.dataset.drawn) return;
    el.dataset.drawn = '1';
    var def = wdgDef(el.dataset.wdgPreview);
    if (!def) return;
    var rem = wdgRemPx(), w = el.clientWidth;
    el.innerHTML = wdgCardHtml(def, def.sizes[0], { board: _wdgGallery.board, preview: true, w: w > 0 ? w - 2 * rem : 0 });
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
    case 'invWdgGo': { var def = wdgDef(btn.dataset.wid); if (def) wdgGo(def); return true; }
    // A card's jump to a place (wdgJumpAttrs), todoGo's way.
    case 'invWdgJump': { var to = null; try { to = JSON.parse(btn.dataset.go || 'null'); } catch (e) { to = null; } if (to && to.kind) todoGo(to); return true; }
    // More (§24e): the rest on the screen behind, or the widget's own list where the screen is not the list's.
    case 'invWdgMore': {
      var dm = wdgDef(btn.dataset.wid);
      if (!dm) return true;
      if (typeof dm.moreGo === 'function') dm.moreGo(btn.closest('.inv-widget')); else wdgGo(dm);
      return true;
    }
    // Choose (§24e): kept with the layout, the card drawn again alone where it stands.
    case 'invWdgChoose': {
      var dc = wdgDef(btn.dataset.wid), cc = btn.closest('.inv-widget');
      if (!dc) return true;
      var oc = Object.assign({}, wdgOpts(board, dc.id));
      oc.choose = btn.dataset.v;
      wdgOptsPut(board, dc.id, oc);
      if (cc) keepScroll(function() { wdgRedrawOne(cc); });
      var nc = document.querySelector('.inv-wboard[data-board="' + board + '"] .inv-widget[data-w="' + CSS.escape(dc.id) + '"] [data-action="invWdgChoose"][data-v="' + CSS.escape(btn.dataset.v) + '"]');
      if (nc) nc.focus({ preventScroll: true });
      return true;
    }
    case 'invWdgReport': {
      var dr = wdgDef(btn.dataset.wid);
      if (dr && typeof errReport === 'function') errReport(new Error('A widget could not be drawn: ' + dr.id), 'widget: ' + dr.id);
      showToast('Reported. The rest of the board is drawn.', 'success');
      return true;
    }
    case 'invWdgArrange': wdgArrangeStart(board); return true;
    case 'invWdgDone': wdgArrangeDone(); return true;
    case 'invWdgReset': wdgReset(board); return true;
    case 'invWdgSize': {
      wdgSetSize(board, btn.dataset.wid, btn.dataset.size);
      // A size changes the places of the cards after it: arranging, the board is placed anew.
      wdgRedrawBoard(board);
      var nb = document.querySelector('.inv-wboard[data-board="' + board + '"] .inv-widget[data-w="' + CSS.escape(btn.dataset.wid) + '"] [data-action="invWdgSize"][data-size="' + btn.dataset.size + '"]');
      if (nb) nb.focus({ preventScroll: true });
      return true;
    }
    case 'invWdgRemove': wdgRemove(board, btn.dataset.wid); wdgRedrawBoard(board); return true;
    case 'invWdgGallery': _wdgAt = null; wdgGalleryOpen(board); return true;
    // Add here (§24h): the gallery, and a widget added goes into the order where the slot stood.
    case 'invWdgSlot': _wdgAt = Number(btn.dataset.at); if (!(_wdgAt >= 0)) _wdgAt = null; wdgGalleryOpen(board); return true;
    case 'invWdgGalleryBoard': _wdgGallery.board = btn.dataset.board; wdgGalleryRedraw(); return true;
    case 'invWdgGallerySec': _wdgGallery.section = btn.dataset.sec; wdgGalleryRedraw(); return true;
    case 'invWdgGalleryAdd':
      wdgAdd(_wdgGallery.board, btn.dataset.wid);
      if (_wdgAt != null) _wdgAt++;
      wdgGalleryRedraw('[data-gallery-w="' + CSS.escape(btn.dataset.wid) + '"] [data-action="invWdgGalleryRemove"]');
      wdgRedrawBoard(_wdgGallery.board);
      return true;
    case 'invWdgGalleryRemove':
      wdgRemoveFromGallery(_wdgGallery.board, btn.dataset.wid);
      wdgGalleryRedraw('[data-gallery-w="' + CSS.escape(btn.dataset.wid) + '"] [data-action="invWdgGalleryAdd"]');
      wdgRedrawBoard(_wdgGallery.board);
      return true;
    case 'invWdgGalleryDone': _wdgAt = null; closeTopOverlay(); return true;
  }
  // A widget's own tap (its def's `act`): the widget the button names, else the card it sits in, else the dialog it opened.
  var card = btn.closest ? btn.closest('.inv-widget[data-w]') : null, own = wdgDef(btn.dataset.wid || (card ? card.dataset.w : ''));
  if (own && typeof own.act === 'function') {
    try { if (own.act(action, btn, card) !== false) return true; } catch (e) { wdgErr(own, e); return true; }
  }
  return false;
}
/* A pick in a widget's own <select> (its def's `change`): a select speaks through change, never click. In the card, or in a dialog
   the widget opened (`data-wdg-for` its id, `data-board` its board), whose card on the board is handed over to be drawn again. */
function wdgOnChange(el) {
  if (!el || !el.closest) return false;
  var card = el.closest('.inv-wboard .inv-widget[data-w]'), host = card ? null : el.closest('[data-wdg-for]'), board = null;
  if (host) {
    board = host.dataset.board || 'home';
    card = document.querySelector('.inv-wboard[data-board="' + CSS.escape(board) + '"] .inv-widget[data-w="' + CSS.escape(host.dataset.wdgFor) + '"]');
  }
  var def = wdgDef(host ? host.dataset.wdgFor : card ? card.dataset.w : '');
  if (!def || typeof def.change !== 'function') return false;
  try { return def.change(el, card, board) !== false; } catch (e) { wdgErr(def, e); return true; }
}
/* A feed's copy landing, or an ask starting (feeds.js's sep-feeds event): every widget that reads a feed is drawn again where it
   stands, never while one is being dragged. */
document.addEventListener('sep-feeds', function() {
  if (_wdgDrag) return;
  Array.prototype.forEach.call(document.querySelectorAll('.inv-wboard .inv-widget[data-w]'), function(card) {
    var def = wdgDef(card.dataset.w);
    if (def && def.feed && card.isConnected) keepScroll(function() { wdgRedrawOne(card); });
  });
});
