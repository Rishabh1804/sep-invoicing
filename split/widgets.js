/* ===== WIDGETS (docs/UI_PASS_3.md §7, §24; UI pass 3, U2 and U2R) =====
   Owner, 16 Oct 2026: "widgets should be flexible so different layouts are possible without breaking the UI". A widget answers
   one question in a card. Home (today.js) and, from U3, Stats are boards of widgets each person arranges. Owner, 17 Oct 2026,
   after U2's stop: "different types of card layouts but organised, so maybe a financial card layout looks and feels different
   than an industrial one. Same for anything that we are putting under one label, like the action rows" (§24, the card family).

   This module is the framework and holds no widget's arithmetic: the card, the board, the states, the presets by role, where a
   layout is kept, arranging and the gallery. Each widget is an entry in WIDGET_DEFS (widgetcards.js, by wdgDefine):
     { id, title, short (its title at Small), q, section, type (ledger | docket | plant | crew | brief | outside | tools), sizes,
       needs, go, live, feed, card, choose: {def, opts(ctx), label, at, html(ctx)}, data(ctx), draw(d, size, ctx),
       viz(d, size, box), more(d, card), actRow(d, size, ctx), source(d, size, ctx), after(el, d, size), act(action, btn, card),
       change(el, card, board) }
   `data` reads the views (dataview.js) and the functions its screen already draws with and returns {state, tone, fig, say,
   detail, …}; the framework draws the card in one order (§24b, I14): its head (the door, the Choose at Large), the figure, the
   verdict (its lamp and words), the detail, then what `draw` returns (the type's parts, through the builders below), More at
   the list's end, the Act and the Source. `viz` draws a bare chart into the room the card leaves it, once the card is laid out.
   A widget that throws draws its error state and the rest of the board is drawn. `act` takes a tap on a button of its own (an
   invWdg… action the framework does not know), `change` a pick in a <select> of its own; `feed` marks a widget that reads a
   feed's copy (feeds.js), drawn again where it stands when a copy lands.

   The card (§24b, §24c) is quiet while all is well: its type's surface, a hairline edge, lifted; amber adds a top edge, red the
   edge and a red tint in place of the surface. It is exactly its size's height on a board packed dense (§24h). A layout is kept
   on the device, one per person, board and layout (the desktop's and the phone's sizes differ), never in the book. */

var WIDGET_DEFS = [];           // every widget, in the gallery's order (wdgDefine)
var _wdgIdx = {};
var WDG_SIZE_NAMES = { s: 'Small', m: 'Medium', l: 'Large' };
var WDG_SIZE_SHORT = { s: 'S', m: 'M', l: 'L' };
/* The seven card types (§24d): a type is a card's surface and the parts only it draws; it never changes the skeleton. */
var WDG_TYPES = ['ledger', 'docket', 'plant', 'crew', 'brief', 'outside', 'tools'];
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

/* A widget joins the set. Refused (and said to a test build) when its id is taken, it allows no size, it names no type, or it has
   a Small and no short title (§24g): one bad entry must not take the board down. */
function wdgDefine(def) {
  var why = !def || typeof def.id !== 'string' || !def.id ? 'it has no id' : _wdgIdx[def.id] ? 'its id is taken' : !Array.isArray(def.sizes) ? 'it allows no size'
    : WDG_TYPES.indexOf(def.type) < 0 ? 'it names no type' : typeof def.draw !== 'function' ? 'it has no draw' : '';
  if (!why) {
    def.sizes = def.sizes.filter(function(s) { return !!WDG_SIZE_NAMES[s]; });
    if (!def.sizes.length) why = 'it allows no size';
    else if (def.sizes.indexOf('s') >= 0 && !def.short) why = 'it has a Small and no short title';
  }
  if (why) {
    if (typeof console !== 'undefined') console.error('wdgDefine refused: ' + (def && def.id) + ': ' + why);
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

/* A widget drawn from its screen's own hero (uiHeroHtml's options: tone, eyebrow, title, fig, sub, viz, body, attrs): its verdict is
   the hero's title, its detail the hero's sub, and from Medium what the hero held; the hero's eyebrow (Money's statement day, Zinc's
   age, Month to date's days) is its Source's first fact (§24g). The hero's attributes go on the widget (its id and data-card: the
   hooks a spec reads); a verdict's mark does not, since Home's verdict is the masthead. No options, nothing to say. */
function wdgFromHero(o, extra) {
  if (!o) return Object.assign({ state: 'empty' }, extra || {});
  var attrs = String(o.attrs || '').replace(/\s+data-verdict(-long)?\b/g, '');
  var eyebrow = String(o.eyebrow || '').replace(/<span class="inv-panel-count">[^<]*<\/span>/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return Object.assign({ state: 'ok', tone: WDG_TONES[o.tone] ? o.tone : 'neutral', fig: o.fig || '', sayHtml: o.title || '', detailHtml: o.sub || '',
    viz: o.viz || '', more: o.body || '', srcFacts: eyebrow ? [wdgUnEsc(eyebrow)] : [], attrs: attrs }, extra || {});
}
/* An escaped string's text (an eyebrow is HTML its card built). */
function wdgUnEsc(s) { var t = document.createElement('textarea'); t.innerHTML = s; return t.value; }
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
/* A widget's door, its Open (§24e): its head opens its screen, where the role opens it; else the title is text with no chevron
   (I4). `go` is a place ({tab, v}), a section of Settings ({settings}: the settings permission's), or a function of the widget's. */
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
   A board starts from its role's preset; any change makes it the person's own, and Reset returns to the preset. Each preset holds
   what its role sees by default (grdRoleDefaults) and packs with no hole on both layouts, packing on or off. The phone keeps the
   desktop's order: a Small stays Small, the rest Medium; the phone's Owner preset leaves out Do first (each question's Act and
   Large cards carry the same moves), and Turnaround and Days to pay, both slow to move and a tap away (Floor's Overview, Money →
   Receivables): with Do first alone left out Home measured 4.17 phone screens on the long book, over I10's four (§1a-14). A widget
   the role may not see, or the build does not have, is left out when the preset is drawn. */
var WDG_PRESETS = {
  owner: { label: 'Owner', home: [['mtd', 's'], ['q-money', 's'], ['prodday', 's'], ['cash', 's'], ['pace', 'm'], ['coming', 'm'], ['tata', 'l'],
    ['floornow', 'm'], ['risk', 's'], ['turn', 's'], ['dtp', 's'], ['atttoday', 's'], ['q-smooth', 'm'], ['dofirst', 'm']], phoneOut: ['dofirst', 'turn', 'dtp'] },
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
  var p = WDG_PRESETS[wdgPresetKey()] || WDG_PRESETS.owner, out = lay === 'phone' ? p.phoneOut || [] : [];
  return (p[board] || []).filter(function(x) { return !!wdgDef(x[0]) && out.indexOf(x[0]) < 0; }).map(function(x) {
    return [x[0], wdgFitSize(wdgDef(x[0]), lay === 'phone' && x[1] !== 's' ? 'm' : x[1])];
  });
}

/* ---------- Where a layout is kept (§7h) ----------
   On the device, one per person (the signed-in ID, `-` with the guard off), board and layout: localStorage sep_inv_layout,
   {v: 1, people: {<id>: {<board>: {preset, desk, phone, opts}}}}. A list present is the person's own for that layout; none, the
   layout follows its role's preset as this build defines it. A widget's own options (a Choose picked, `corr`'s pair) are kept in
   `opts`, shared by both layouts. Never in the book: a backup, a pull or a merge never rearranges another device, and the change log
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
/* A widget's own options on a board (a Choose picked, the pair a *corr* is set to), shared by both layouts. */
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

/* ---------- The card (§7a, §7c, §24b) ---------- */
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
/* A blank state (§7c, §14b): the one component, its words only; its one action is the card's Act (wdgFootHtml), never a button
   inside it. A Small's blank is one line. */
function wdgStateHtml(def, size, d) {
  var k = WDG_STATE_TITLE[d.state] ? d.state : 'empty';
  return uiBlankHtml({ kind: k, title: d.title || WDG_STATE_TITLE[k], body: d.body || '', small: size === 's' });
}
/* What a widget picks with its Choose (§24e): the value kept with the layout (opts.choose) where it is still on offer, else the
   widget's default. */
function wdgChooseList(def, ctx) {
  if (!def.choose || typeof def.choose.opts !== 'function') return [];
  try { return (def.choose.opts(ctx) || []).filter(function(o) { return o && o.v != null; }); } catch (e) { wdgErr(def, e); return []; }
}
function wdgChooseVal(def, ctx) {
  if (!def.choose) return null;
  var want = ctx.opts && ctx.opts.choose, list = wdgChooseList(def, ctx);
  if (want != null && (!list.length || list.some(function(o) { return String(o.v) === String(want); }))) return want;
  return def.choose.def != null ? def.choose.def : list.length ? list[0].v : null;
}
/* A Choose is drawn where the widget offers it (`at`, Large by default), in the card's head on the desktop and under it at the
   card's width on the phone; never at the foot. A segmented control, or the widget's own (`html`: corr's pair). */
function wdgChooseAt(def, size) { return !!def.choose && (def.choose.at || ['l']).indexOf(size) >= 0; }
function wdgChooseHtml(def, ctx) {
  if (typeof def.choose.html === 'function') { try { return def.choose.html(ctx) || ''; } catch (e) { wdgErr(def, e); return ''; } }
  var list = wdgChooseList(def, ctx), id = escHtml(def.id);
  if (list.length < 2) return '';
  return '<div class="inv-seg inv-seg-choose" role="group" aria-label="' + escHtml(def.choose.label || 'Show') + '">' + list.map(function(o) {
    return '<button type="button" class="inv-seg-btn" data-action="invWdgChoose" data-wid="' + id + '" data-v="' + escHtml(String(o.v)) + '" aria-pressed="' +
      (String(o.v) === String(ctx.choose)) + '">' + escHtml(o.label) + '</button>';
  }).join('') + '</div>';
}
/* The body (§24b): the figure, the verdict (its lamp and its words, two lines at most), the detail line, then the type's parts the
   widget draws, and the room for its bare chart (viz) where it has one. */
function wdgBodyHtml(def, size, d, ctx, tone) {
  if (d.state !== 'ok') return wdgStateHtml(def, size, d);
  var h = '';
  if (d.fig) h += '<div class="inv-widget-fig"' + (d.figAttrs || '') + '>' + d.fig + '</div>';
  var say = d.sayHtml != null && d.sayHtml !== '' ? d.sayHtml : d.say ? escHtml(d.say) : '';
  if (say) h += '<div class="inv-widget-line"' + (d.sayAttrs || '') + '><span class="inv-dot inv-dot-' + uiTone(d.sayTone || tone) + ' inv-widget-say">' + say + '</span></div>';
  var det = d.detailHtml != null && d.detailHtml !== '' ? d.detailHtml : d.detail ? escHtml(d.detail) : '';
  if (det && (size !== 's' || !d.detailNotSmall)) h += '<div class="inv-widget-sub"' + (d.detailAttrs || '') + '>' + det + '</div>';
  var parts = '';
  try { parts = def.draw(d, size, ctx) || ''; } catch (e) { wdgErr(def, e); d.state = 'error'; return wdgStateHtml(def, size, d); }
  h += parts;
  // The room for its bare chart, where the widget draws one at this size and its data has one to draw (`noViz` says it has none).
  if (typeof def.viz === 'function' && !d.noViz && parts.indexOf('data-wdg-viz') < 0 && (!def.vizAt || def.vizAt.indexOf(size) >= 0)) h += wdgVizHtml(size === 's' ? ' data-wdg-push' : '');
  return h || wdgStateHtml(def, size, { state: 'empty' });
}
/* The room for a widget's bare chart: drawn once the card is laid out, at the room's own size (wdgVizDraw). */
function wdgVizHtml(attrs) { return '<div class="inv-widget-viz" data-wdg-viz' + (attrs || '') + '></div>'; }

/* ---------- The five action rows (§24e) ----------
   Open is the head; Choose a segmented control in the head at Large; More the list's last row (wdgFit); Act after the body: one
   tinted button and at most one text button; Source the card's last line: the facts it reads, parted by a middle dot, and as its
   only links Refresh and a feed's credit where the feed's terms ask for one. */
function wdgActBtn(x, cls, def) {
  if (!x || !x.label) return '';
  if (x.href) return '<a class="' + cls + '" href="' + escHtml(x.href) + '"' + (x.attrs || '') + '>' + escHtml(x.label) + '</a>';
  return '<button type="button" class="' + cls + '"' + wdgPressAttrs(x) + (def ? ' data-wid="' + escHtml(def.id) + '"' : '') +
    (x.disabled ? ' disabled' : '') + '>' + escHtml(x.label) + '</button>';
}
/* What a press in a card does: its own action (`action`, with `attrs`), or a jump through todoGo (`jump`: one of its kinds or
   advGoTo's, e.g. {kind: 'createFor', clientId}), which the framework takes (invWdgGoTo) and which shuts a dialog on the way. */
function wdgPressAttrs(p) {
  if (!p) return '';
  if (p.jump) return ' data-action="invWdgGoTo" data-go="' + escHtml(JSON.stringify(p.jump)) + '"' + (p.attrs || '');
  return (p.action ? ' data-action="' + escHtml(p.action) + '"' : '') + (p.attrs || '');
}
/* Amounts in a sentence on a board are short (§24k): ₹3,95,500.00 reads ₹3.96 L; under ₹1,000 (a rate, a small sum) an amount keeps
   its paise. Text in, text out: the caller keeps the whole sentence as its title. */
function wdgShortMoney(s) {
  return String(s == null ? '' : s).replace(/([\u2212-]?)\u20B9([\d,]+(?:\.\d{1,2})?)/g, function(m, sign, num) {
    var v = Number(num.replace(/,/g, ''));
    return v >= 1000 ? (sign ? '\u2212' : '') + inrCard(v).text : m;
  });
}
/* The same, in place, over the text of drawn HTML (a question's story, Needs you's rows): each sentence shortened keeps its whole
   words as its element's title. */
function wdgShortMoneyIn(root) {
  var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
  while (walk.nextNode()) nodes.push(walk.currentNode);
  var was = new Map();
  nodes.forEach(function(n) {
    var t = wdgShortMoney(n.nodeValue);
    if (t === n.nodeValue) return;
    var el = n.parentElement;
    if (el && !was.has(el)) was.set(el, el.textContent.replace(/\s+/g, ' ').trim());
    n.nodeValue = t;
  });
  was.forEach(function(text, el) { if (!el.title) el.title = text; });
}
/* Whole rupees with the sign a figure takes (U+2212, design §5.4): a Ledger's statement line. */
function wdgRs(v) { var n = gstRound(Number(v) || 0, 0); return (n < 0 ? '\u2212' : '') + finRs(Math.abs(n)); }
/* A Ledger's amount: whole rupees, or a rate to the paisa with its unit; `signed`, a rise carries its + (a bridge's causes). */
function wdgLedgerFmt(v, rate, unit, signed) {
  var n = gstRound(Number(v) || 0, rate ? 2 : 0), sg = n < 0 ? '\u2212' : signed && n > 0 ? '+' : '';
  return sg + (rate ? formatCurrency(Math.abs(n)) + (unit || '') : finRs(Math.abs(n)));
}
function wdgActHtml(row, def, size) {
  if (!row) return '';
  var t = wdgActBtn(row.tint, 'inv-btn inv-btn-tint', def), x = size === 's' ? '' : wdgActBtn(row.text, 'inv-btn inv-btn-link inv-btn-sm', def);
  return t || x ? '<div class="inv-widget-act">' + t + x + '</div>' : '';
}
/* A Source: `parts` in order (a fact's text, {credit: {label, href}}, {refresh: kind}, {zinc: true} the zinc rate's Refresh), else
   the credit, the facts and Refresh in that order. `attrs` its hooks. */
var WDG_REFRESH_ACTION = { zinc: 'invRefreshZinc' };
function wdgSourceHtml(src, def) {
  if (!src) return '';
  var parts = Array.isArray(src.parts) ? src.parts
    : [src.credit ? { credit: src.credit } : null].concat(src.facts || []).concat(src.refresh ? [{ refresh: src.refresh, busy: src.busy }] : []);
  var out = parts.filter(function(p) { return p != null && p !== ''; }).map(function(p) {
    if (typeof p === 'string') return '<span>' + escHtml(p) + '</span>';
    if (p.credit) return '<a class="inv-btn-link" href="' + escHtml(p.credit.href) + '" target="_blank" rel="noopener noreferrer">' + escHtml(p.credit.label) + '</a>';
    if (p.refresh) {
      var act = WDG_REFRESH_ACTION[p.refresh] || 'invFeedRefresh';
      return '<button type="button" class="inv-btn-link inv-widget-refresh" data-action="' + act + '" data-kind="' + escHtml(p.refresh) + '"' + (def ? ' data-wid="' + escHtml(def.id) + '"' : '') +
        (p.busy ? ' disabled' : '') + '>' + (p.busy ? 'Fetching…' : 'Refresh') + '</button>';
    }
    return '';
  }).filter(Boolean);
  if (!out.length) return '';
  return '<div class="inv-widget-src"' + (src.attrs || '') + (out.some(function(x) { return /inv-widget-refresh/.test(x); }) ? ' data-refresh' : '') + '>' +
    out.join('<span class="inv-widget-dot" aria-hidden="true"> · </span>') + '</div>';
}
/* The foot: the Act, then the Source; neither at Small but the one tinted button a widget lets a Small keep (`actSmall`: the
   backup's). A blank state's one action is the Act's tinted button from Medium; an error's Report it its text button. */
function wdgFootHtml(def, size, d, ctx) {
  var act = '', src = '';
  if (d.state !== 'ok') {
    if (size !== 's' || def.actSmall) act = wdgActHtml({ tint: d.act || null,
      text: d.state === 'error' ? { label: 'Report it', action: 'invWdgReport' } : d.actText || null }, def, size);
    if (size !== 's' && d.src) src = wdgSourceHtml(d.src, def);
  } else {
    if (typeof def.actRow === 'function' && (size !== 's' || def.actSmall)) { try { act = wdgActHtml(def.actRow(d, size, ctx), def, size); } catch (e) { wdgErr(def, e); } }
    if (typeof def.source === 'function' && size !== 's') { try { src = wdgSourceHtml(def.source(d, size, ctx), def); } catch (e) { wdgErr(def, e); } }
  }
  return act || src ? '<div class="inv-widget-foot">' + act + src + '</div>' : '';
}

/* What each card drawn last said, by board and widget: its chart is drawn from it once the card is laid out (wdgVizDraw) and its
   More reads it (def.more). */
var _wdgDrawn = {};
/* A card (§24b): <section class="inv-widget"> on its type's surface, its tone said by the lamp, the figure where judged and, from
   amber, the top edge (§24c); its head the section's icon, the title (its short title at Small) and the door's chevron, the Choose
   at its right at Large; its body the figure, the verdict, the detail and the type's parts; its foot the Act and the Source. In
   arrange mode its handle, its place, its size and its Remove ride over the head (§7e). An Outside card is never edged or tinted:
   the world outside is to know, info at most. */
function wdgCardHtml(def, size, o) {
  o = o || {};
  var board = o.board || 'home', opts = wdgOpts(board, def.id);
  var ctx = { board: board, size: size, opts: opts, period: typeof _statsPeriod === 'string' ? _statsPeriod : 'mtd', preview: !!o.preview };
  ctx.choose = wdgChooseVal(def, ctx);
  var d = wdgData(def, ctx);
  var tone = d.state === 'ok' && WDG_TONES[d.tone] ? d.tone : 'neutral';
  if (def.type === 'outside' && (tone === 'warning' || tone === 'danger')) tone = 'info';
  var body = wdgBodyHtml(def, size, d, ctx, tone);
  if (d.state !== 'ok') tone = 'neutral';
  _wdgDrawn[(o.preview ? 'preview|' : board + '|') + def.id] = { d: d, ctx: ctx };
  var sec = wdgSection(def.section), id = escHtml(def.id), full = escHtml(def.title), title = escHtml(size === 's' && def.short ? def.short : def.title);
  var door = wdgCanGo(def) && !o.preview
    ? '<button type="button" class="inv-widget-door" data-action="invWdgGo" data-wid="' + id + '" aria-label="' + full + ': open">' +
      '<span class="inv-widget-title"' + (title !== full ? ' title="' + full + '"' : '') + '>' + title + '</span>' + iconSvg('next', 'inv-widget-chev') + '</button>'
    : '<span class="inv-widget-door"><span class="inv-widget-title"' + (title !== full ? ' title="' + full + '"' : '') + '>' + title + '</span></span>';
  var choose = d.state === 'ok' && !o.preview && wdgChooseAt(def, size) ? wdgChooseHtml(def, ctx) : '';
  var head = (o.arranging ? wdgArrangeCtlHtml(def, size, o) : '') +
    '<div class="inv-widget-head"><span class="inv-widget-ico" aria-hidden="true">' + iconSvg(sec.icon) + '</span>' + door +
    (choose && _isDesktop ? choose : '') + '</div>' + (choose && !_isDesktop ? '<div class="inv-widget-choose">' + choose + '</div>' : '');
  var foot = o.preview ? '' : wdgFootHtml(def, size, d, ctx);
  // The widget's own hooks: those its data gives (a screen's hero's id and data-card, in whatever state it says), else its def's
  // card. Ours, never typed.
  var attrs = d.attrs ? String(d.attrs) : '';
  if (def.card && !/\bdata-card=/.test(attrs)) attrs += ' data-card="' + escHtml(def.card) + '"';
  if (o.preview) attrs = attrs.replace(/\s+id="[^"]*"/g, '').replace(/\s+data-card="[^"]*"/g, '');
  return '<section class="inv-widget" data-w="' + id + '" data-size="' + size + '" data-type="' + escHtml(def.type) + '" data-tone="' + tone + '" data-state="' + escHtml(d.state) + '"' +
    attrs + ' aria-label="' + full + '">' + head + '<div class="inv-widget-body">' + body + '</div>' + foot + '</section>';
}
/* After a card is in the page: a widget's own hook (a chart measured, a fold wired), never one that writes the book; then its fit,
   then its chart drawn into the room left. */
function wdgAfterOne(el) {
  var def = el && wdgDef(el.dataset.w);
  if (!def) return;
  if (typeof def.after === 'function' && el.dataset.state === 'ok') { try { def.after(el, el.dataset.size); } catch (e) { wdgErr(def, e); } }
  wdgFit(el);
  wdgVizDraw(el);
}
/* A card's record of what it said: the board's, or the gallery preview's. */
function wdgDrawnOf(card) {
  var b = card.closest('.inv-wboard'), pv = card.closest('.inv-gallery-preview');
  return _wdgDrawn[(pv ? 'preview|' : (b ? b.dataset.board : 'home') + '|') + card.dataset.w] || null;
}
/* A bare chart drawn at the room's own size (§24d: its viewBox in the card's pixels, so every label reads at 11px or more). A room
   too small for any chart is left empty: the verdict says what the chart shows. */
function wdgVizDraw(card) {
  var slot = card && card.querySelector('[data-wdg-viz]');
  if (!slot || slot.hidden || slot.closest('[data-wdg-cut]')) return;
  var def = wdgDef(card.dataset.w), rec = wdgDrawnOf(card);
  if (!def || typeof def.viz !== 'function' || !rec || rec.d.state !== 'ok') return;
  var w = Math.floor(slot.clientWidth), h = Math.floor(slot.clientHeight);
  if (w < 48 || h < 20) { slot.innerHTML = ''; return; }
  var draw = function(hh) { slot.innerHTML = def.viz(rec.d, card.dataset.size, { w: w, h: hh, ctx: rec.ctx }) || ''; };
  try {
    draw(h);
    // A chart with its keys under it: drawn again shorter by what the keys took, so the two fit the room together.
    var over = Math.ceil(slot.scrollHeight - slot.clientHeight);
    if (over > 0) { if (h - over >= 20) draw(h - over); else slot.innerHTML = ''; }
  } catch (e) { wdgErr(def, e); slot.innerHTML = ''; }
}
/* A card is exactly its size's height (§24h), so what it shows fits it or lets go: first the parts it can do without, all together
   (data-wdg-opt, a tile's sparkline, a chart's key); then its list's last rows one at a time, the More row (the list's last row,
   in its rhythm) saying how many, and a Ledger's rest line their sum so the lines still add up; last, a verdict past its two lines
   is cut at a word, its whole text its title. Nothing is cut halfway and nothing runs past the card (P224, P237). Measured only
   where the card is laid out. A chart's room is at its smallest while the card is fitted (wdgVizDraw fills it after). */
var WDG_FIT_ROWS = '.inv-row, .inv-ledger-line:not(.inv-ledger-total), .inv-docket-row, .inv-plant-row, .inv-brief-move, .inv-brief-movecard, .inv-brief-when, ' +
  '.inv-wire-item, .inv-crew-row, .inv-deck-item, .inv-step, .inv-row-fold, .inv-chart-ranked-row, [data-story-say], .inv-docket-stage';
/* What a card can do without, all together: a part marked so, a tile's line of the months before and the words under its figure (never
   its change against the period before), a chart's key. */
var WDG_FIT_OPT = '[data-wdg-opt], .inv-tile-viz, .inv-widget-body .inv-tile-sub:not([data-tile-delta], [id$="Delta"]), .inv-widget-body .inv-chart-keys';
function wdgFit(card) {
  if (!card || !card.isConnected || !card.offsetParent) return;
  var body = card.querySelector('.inv-widget-body');
  if (!body) return;
  var cut = function(el) { el.setAttribute('data-wdg-cut', ''); el.hidden = true; };
  var overOf = function(el) { return function() { return el.scrollHeight > el.clientHeight + 1; }; };
  var over = overOf(body);
  var cols = body.querySelector(':scope > .inv-widget-cols');
  var sideBySide = cols && getComputedStyle(cols).display === 'grid';
  if (over() || sideBySide && Array.prototype.some.call(cols.children, function(c) { return overOf(c)(); })) {
    var opt = Array.prototype.filter.call(body.querySelectorAll(WDG_FIT_OPT), function(el) { return !el.hidden && !el.closest('[data-wdg-cut]'); });
    if (opt.length) opt.forEach(cut);
  }
  // Side by side, each column is fitted on its own: a column's last rows let go, its More (or a Ledger's rest line) in it.
  if (sideBySide) {
    Array.prototype.forEach.call(cols.children, function(c) {
      if (c.hidden || getComputedStyle(c).display === 'none') return;
      var o = overOf(c);
      if (o()) wdgFitRows(card, c, o, cut);
    });
  }
  if (over()) wdgFitRows(card, body, over, cut);
  // A column left with nothing but its caption goes with it (stacked, its rows were the first to let go).
  if (cols) Array.prototype.forEach.call(cols.children, function(c) {
    if (c.hidden || !c.classList.contains('inv-widget-col')) return;
    var left = Array.prototype.filter.call(c.children, function(k) { return !k.hidden && !k.hasAttribute('data-wdg-cut') && !k.classList.contains('inv-widget-cap'); });
    if (!left.length) cut(c);
  });
  // The verdict, two lines at most, and the detail under it: where their words run past them, the whole is the title.
  Array.prototype.forEach.call(card.querySelectorAll('.inv-widget-say, .inv-widget-sub, .inv-brief-ans, [data-story-say] > .inv-dot, .inv-brief-move-say, .inv-crew-away, .inv-tile-sub'), function(s) {
    if (s.scrollHeight > s.clientHeight + 1 && !s.title) s.title = s.textContent.replace(/\s+/g, ' ').trim();
  });
}
function wdgFitRows(card, body, over, cut) {
  var rows = Array.prototype.filter.call(body.querySelectorAll(WDG_FIT_ROWS), function(r) {
    return !r.hidden && !r.closest('[hidden], [data-wdg-cut]') && !r.closest('[data-wdg-more]') && !r.parentElement.closest(WDG_FIT_ROWS);
  });
  if (!rows.length) return;
  var def = wdgDef(card.dataset.w), id = def ? escHtml(def.id) : '', canMore = def && (typeof def.more === 'function' || wdgCanGo(def));
  var hid = [], more = null, rest = null;
  var noun = function(el) { var h = el && el.closest('[data-noun]'); return h ? h.getAttribute('data-noun') : ''; };
  var place = function() {
    // The rows let go of: a Ledger's lines are summed into one rest line before its total; any other list ends in its More row.
    var led = hid.filter(function(r) { return r.classList.contains('inv-ledger-line'); }), other = hid.filter(function(r) { return !r.classList.contains('inv-ledger-line'); });
    if (led.length) {
      var sum = led.reduce(function(s, r) { return s + (Number(r.getAttribute('data-amt')) || 0); }, 0), n0 = noun(led[0]);
      var lg = led[0].closest('.inv-ledger'), unit = lg && lg.hasAttribute('data-rate') ? lg.getAttribute('data-rate') : null, signed = !!(lg && lg.hasAttribute('data-signed'));
      if (!rest) {
        rest = document.createElement(canMore ? 'button' : 'div');
        rest.className = 'inv-ledger-line inv-ledger-rest';
        rest.setAttribute('data-wdg-more', '');
        if (canMore) { rest.type = 'button'; rest.setAttribute('data-action', 'invWdgMore'); rest.setAttribute('data-wid', def.id); }
      }
      rest.innerHTML = '<span class="inv-ledger-label">' + escHtml(led.length + ' more' + (n0 ? ' ' + wdgNoun(n0, led.length) : '')) + '</span><span class="inv-ledger-lead"></span>' +
        '<span class="inv-ledger-amt">' + escHtml(wdgLedgerFmt(sum, unit != null, unit, signed)) + '</span>' + (canMore ? iconSvg('next', 'inv-widget-chev') : '');
      var lastLed = rows.filter(function(r) { return r.classList.contains('inv-ledger-line') && !r.hidden; }).pop() || led[0];
      if (rest.parentNode !== lastLed.parentNode || rest.previousSibling !== lastLed) lastLed.parentNode.insertBefore(rest, lastLed.nextSibling);
    }
    if (other.length) {
      var n1 = noun(other[0]);
      if (!more) { more = document.createElement('div'); more.className = 'inv-widget-more'; more.setAttribute('data-wdg-more', ''); }
      var label = escHtml(other.length + ' more' + (n1 ? ' ' + wdgNoun(n1, other.length) : ''));
      more.innerHTML = canMore ? '<button type="button" class="inv-widget-more-btn" data-action="invWdgMore" data-wid="' + id + '">' + label + iconSvg('next', 'inv-widget-chev') + '</button>'
        : '<span class="inv-widget-more-btn">' + label + '</span>';
      var lastOther = rows.filter(function(r) { return !r.classList.contains('inv-ledger-line') && !r.hidden; }).pop() || other[0];
      if (more.parentNode !== lastOther.parentNode || more.previousSibling !== lastOther) lastOther.parentNode.insertBefore(more, lastOther.nextSibling);
    }
  };
  while (rows.length && over()) { var r = rows.pop(); cut(r); hid.unshift(r); place(); }
  // A sheet or a list whose rows all went goes with them, and a list of moves with its head.
  Array.prototype.forEach.call(body.querySelectorAll('.inv-hero-sheet, .inv-hero-moves, [data-wdg-list]'), function(sh) {
    if (!sh.querySelector(WDG_FIT_ROWS.split(', ').map(function(s) { return s + ':not([data-wdg-cut])'; }).join(', ')) && sh.querySelector(WDG_FIT_ROWS) && !sh.querySelector('[data-wdg-more]')) cut(sh);
  });
}
/* Columns at Large (§24d, §24f: tata's three from 60rem of card, two from 36rem, one under): what a Large card shows side by side,
   each column a list of its own, fitted on its own (wdgFit). A part is HTML: a bare chart's room (wdgVizHtml) stands as a column of
   its own, anything else is wrapped in one; an empty part is left out. `drop`: the part that gives way where two columns are all the
   card holds (under 60rem of card; with three parts, the last unless said). Under 36rem of card the columns stack, and the last
   rows of the last let go first. */
function wdgColsHtml(parts, o) {
  o = o || {};
  var list = (parts || []).filter(function(p) { return p != null && String(p).trim() !== ''; });
  if (list.length < 2) return list.map(function(p) { return /^<div class="inv-widget-viz"[^>]*data-wdg-viz/.test(p) ? p : '<div class="inv-widget-col">' + p + '</div>'; }).join('');
  var drop = list.length > 2 ? (o.drop != null ? o.drop : list.length - 1) : -1;
  return '<div class="inv-widget-cols" data-cols="' + list.length + '">' + list.map(function(p, i) {
    var a = i === drop ? ' data-col-drop' : '';
    if (/^<div class="inv-widget-viz"[^>]*data-wdg-viz/.test(p)) return p.replace(/^<div class="inv-widget-viz"/, '<div class="inv-widget-viz"' + a);
    return '<div class="inv-widget-col"' + a + '>' + p + '</div>';
  }).join('') + '</div>';
}
/* A list's noun by its count ("move", "moves"): the noun is given singular. */
function wdgNoun(n, k) { return k === 1 ? n : /s$/.test(n) ? n : /y$/.test(n) && !/[aeiou]y$/.test(n) ? n.slice(0, -1) + 'ies' : n + 's'; }
function wdgAfter(root) {
  if (root) Array.prototype.forEach.call(root.querySelectorAll('.inv-widget[data-w]'), wdgAfterOne);
}

/* ---------- The type builders (§24d, §24g): presentation only. A widget reads its screen's functions for its figures (I8) and
   hands them here; no widget writes a row's markup of its own. ---------- */

/* Ledger: amounts on dotted leaders, right-aligned, in whole rupees (wdgRs) so they add up; a total ruled once above and twice
   below, drawn only where the lines above it add up to it (to half a rupee a line, each rounded from its exact amount); a cut list
   ends in one line for the rest and their sum (wdgFit). lines: [{label, meta, amt, text, tone, title, go: {action | jump, attrs},
   attrs}]: `text` a value said in words (a range, a rate), never summed; total: {label, amt, tone}. o: noun (a line's, for the rest
   line: "client"), rate (amounts with their paise and `unit` after them, adding up to the paisa: a kilo's cost), signed (a rise
   carries its +: the causes of a change), attrs. */
function wdgLedgerHtml(lines, total, o) {
  o = o || {};
  var list = (lines || []).filter(Boolean), rate = !!o.rate, dp = rate ? 2 : 0;
  var fmt = function(v) { return wdgLedgerFmt(v, rate, o.unit, o.signed); };
  var num = function(x) { return x.text == null && x.amt != null && isFinite(Number(x.amt)); };
  var line = function(x, cls) {
    var has = num(x), r = has ? gstRound(Number(x.amt), dp) : null;
    var shown = x.text != null ? figHtml(escHtml(x.text), x.tone || null) : has ? figHtml(escHtml(fmt(Number(x.amt))), x.tone || null) : '&mdash;';
    var title = x.title || (has && !rate ? formatCurrency(Number(x.amt)) : '');
    var amt = '<span class="inv-ledger-amt"' + (title ? ' title="' + escHtml(title) + '"' : '') + '>' + shown + '</span>';
    var lab = '<span class="inv-ledger-label">' + escHtml(x.label) + (x.meta ? '<span class="inv-ledger-meta">' + escHtml(x.meta) + '</span>' : '') + '</span>';
    var inner = lab + '<span class="inv-ledger-lead"></span>' + amt, data = has ? ' data-amt="' + r + '"' : '';
    if (x.go) return '<button type="button" class="inv-ledger-line' + (cls || '') + '"' + data + wdgPressAttrs(x.go) + (x.attrs || '') + '>' + inner + '</button>';
    return '<div class="inv-ledger-line' + (cls || '') + '"' + data + (x.attrs || '') + '>' + inner + '</div>';
  };
  var sum = list.reduce(function(s, x) { return s + (num(x) ? gstRound(Number(x.amt), dp) : 0); }, 0);
  var adds = total && num(total) && list.length && list.every(num) && Math.abs(sum - gstRound(Number(total.amt), dp)) <= (rate ? 0.005 : 0.5) * Math.max(1, list.length);
  return '<div class="inv-ledger" data-wdg-list' + (o.noun ? ' data-noun="' + escHtml(o.noun) + '"' : '') + (rate ? ' data-rate="' + escHtml(o.unit || '') + '"' : '') +
    (o.signed ? ' data-signed' : '') + (o.attrs || '') + '>' +
    list.map(function(x) { return line(x); }).join('') + (total ? line(total, adds ? ' inv-ledger-total' : '') : '') + '</div>';
}
/* An age bar's key (§24d): four columns, each its swatch, its band and its sum. bands: [{label, amt, tone}]. */
function wdgMeterKeyHtml(bands) {
  return '<div class="inv-meter-key">' + (bands || []).map(function(b) {
    return '<span class="inv-meter-key-item"><span class="inv-dot inv-dot-' + uiTone(b.tone) + '">' + escHtml(b.label) + '</span><span class="inv-meter-key-amt" title="' +
      escHtml(formatCurrency(b.amt)) + '">' + escHtml(inrCard(b.amt).text) + '</span></span>';
  }).join('') + '</div>';
}
/* Docket: a row read across like a register: the document's number in Geist Mono, the party and its meta, the amount and its state
   as steps (a pip a state: those passed, the one it stands at in the tone of its age, those to come), and the row's own one action.
   o: {num (none: a party's row), party, meta, amt, steps: {n, at, tone, say}, end (HTML in place of the amount and steps), go: {action |
   jump, attrs, label}, act: {label, action | jump, attrs, href}, attrs}. */
function wdgDocketStepsHtml(st) {
  if (!st || !(st.n > 0)) return '';
  var pips = '';
  for (var i = 0; i < st.n; i++) pips += '<span class="inv-docket-pip" data-pip="' + (i < st.at ? 'done' : i === st.at ? 'at' : 'todo') + '"' + (i === st.at ? ' data-tone="' + uiTone(st.tone) + '"' : '') + '></span>';
  return '<span class="inv-docket-steps" role="img" aria-label="' + escHtml(st.say || '') + '" title="' + escHtml(st.say || '') + '">' + pips + '</span>';
}
function wdgDocketRowHtml(o) {
  var num = o.num != null && o.num !== '';
  var main = (num ? '<span class="inv-docket-num inv-id">' + escHtml(o.num) + '</span>' : '') + '<span class="inv-docket-party"><span class="inv-row-title">' + escHtml(o.party || '') + '</span>' +
    (o.meta ? '<span class="inv-row-meta">' + escHtml(o.meta) + '</span>' : '') + '</span>';
  // The end: the amount and the steps, or what the row says in their place (`end`, HTML its caller built: a turnaround's days).
  var end = '<span class="inv-docket-end">' + (o.end != null ? o.end : (o.amt != null ? '<span class="inv-docket-amt">' + inrFigHtml(o.amt, { inline: true }) + '</span>' : '') +
    wdgDocketStepsHtml(o.steps)) + '</span>';
  var act = wdgRowActHtml(o.act), nn = num ? '' : ' data-nonum';
  return '<div class="inv-docket-row"' + (o.attrs || '') + '>' + (o.go ? '<button type="button" class="inv-docket-main"' + nn + wdgPressAttrs(o.go) +
    (o.go.label ? ' aria-label="' + escHtml(o.go.label) + '"' : '') + '>' + main + end + '</button>' : '<span class="inv-docket-main"' + nn + '>' + main + end + '</span>') + act + '</div>';
}
/* A row's own one action (§24e): a small tinted button, or a link where it is one (a call). a: {label, action | jump, attrs, href}. */
function wdgRowActHtml(a) {
  if (!a || !a.label) return '';
  if (a.href) return '<a class="inv-btn inv-btn-tint inv-btn-sm" href="' + escHtml(a.href) + '"' + (a.attrs || '') + '>' + escHtml(a.label) + '</a>';
  return '<button type="button" class="inv-btn inv-btn-tint inv-btn-sm"' + wdgPressAttrs(a) + '>' + escHtml(a.label) + '</button>';
}
/* The pipeline's stages as one strip in a well (Docket): a stage a cell with its count and sum, the stage the card leads with
   lifted, each opening Pipeline at that stage. stages: [{key, label, n, amt, tone, lead, go: {action, attrs}}]. */
function wdgDocketStagesHtml(stages) {
  return '<div class="inv-docket-stages" data-wdg-list data-noun="stage">' + (stages || []).map(function(s) {
    var inner = '<span class="inv-docket-stage-label">' + escHtml(s.label) + '</span><span class="inv-docket-stage-n">' + escHtml(String(s.n)) + '</span>' +
      (s.amt != null ? '<span class="inv-docket-stage-amt">' + inrFigHtml(s.amt, { inline: true }) + '</span>' : '<span class="inv-docket-stage-amt">&mdash;</span>') +
      (s.word ? '<span class="inv-dot inv-dot-' + uiTone(s.tone) + '">' + escHtml(s.word) + '</span>' : '');
    var a = ' data-stage="' + escHtml(s.key) + '"' + (s.lead ? ' data-lead' : '');
    return s.go ? '<button type="button" class="inv-docket-stage"' + a + wdgPressAttrs(s.go) + '>' + inner + '</button>'
      : '<span class="inv-docket-stage"' + a + '>' + inner + '</span>';
  }).join('') + '</div>';
}
/* Plant: a line or a unit a row: its lamp ringed in its tone, its nameplate (as the app writes it, in Geist Mono in a small well),
   what it runs and its meta, its reading with its unit, and a gauge under it. o: {tone, plate, runs, meta, reading, unit, gauge (HTML),
   word, go: {action, attrs, label}, attrs}. */
function wdgPlantRowHtml(o) {
  var lamp = '<span class="inv-dot inv-dot-' + uiTone(o.tone) + ' inv-plant-lamp"' + (o.word ? ' title="' + escHtml(o.word) + '"' : '') + '></span>';
  var main = lamp + '<span class="inv-plate">' + escHtml(o.plate || '') + '</span><span class="inv-plant-what"><span class="inv-row-title">' + escHtml(o.runs || '') + '</span>' +
    (o.meta ? '<span class="inv-row-meta">' + escHtml(o.meta) + '</span>' : '') + '</span>';
  var reading = o.reading != null && o.reading !== '' ? '<span class="inv-reading">' + escHtml(String(o.reading)) + (o.unit ? '<span class="inv-unit">' + escHtml(o.unit) + '</span>' : '') + '</span>' : '';
  var word = o.word ? '<span class="inv-dot inv-dot-' + uiTone(o.tone) + '">' + escHtml(o.word) + '</span>' : '';
  var end = '<span class="inv-plant-end">' + reading + word + '</span>';
  var head = o.go ? '<button type="button" class="inv-plant-main"' + wdgPressAttrs(o.go) + (o.go.label ? ' aria-label="' + escHtml(o.go.label) + '"' : '') + '>' + main + end + '</button>'
    : '<span class="inv-plant-main">' + main + end + '</span>';
  var act = wdgRowActHtml(o.act);
  return '<div class="inv-plant-row"' + (o.attrs || '') + '>' + (act ? '<div class="inv-plant-head">' + head + act + '</div>' : head) + (o.gauge ? '<span class="inv-plant-gauge">' + o.gauge + '</span>' : '') + '</div>';
}
/* Crew: a seat a hand the day needs: filled when on site, ringed in the warning's mark when short, one ringed in the info's mark for
   each hand over. o: {heads, need, label}. */
function wdgSeatsHtml(o) {
  var heads = Math.max(0, Math.round(Number(o.heads) || 0)), need = o.need == null ? null : Math.max(0, Math.round(Number(o.need) || 0));
  var n = need == null ? heads : Math.max(heads, need), s = '';
  for (var i = 0; i < n; i++) s += '<span class="inv-seat" data-seat="' + (need == null || i < Math.min(heads, need) ? 'on' : i < need ? 'short' : 'over') + '"></span>';
  var say = o.label || (need == null ? heads + ' on site' : heads + ' of ' + need);
  return '<span class="inv-seats" role="img" aria-label="' + escHtml(say) + '" title="' + escHtml(say) + '">' + s + '</span>';
}
/* An area a row, with its seats and its word (Crew). o: {name, heads, need, word, tone, go: {action, attrs}, attrs}. */
function wdgCrewRowHtml(o) {
  var inner = '<span class="inv-crew-name">' + escHtml(o.name) + '</span>' + wdgSeatsHtml(o) + (o.word ? '<span class="inv-dot inv-dot-' + uiTone(o.tone) + '">' + escHtml(o.word) + '</span>' : '');
  return o.go ? '<button type="button" class="inv-crew-row"' + wdgPressAttrs(o.go) + (o.attrs || '') + '>' + inner + '</button>'
    : '<div class="inv-crew-row"' + (o.attrs || '') + '>' + inner + '</div>';
}
/* Briefing: a move a row (§24e): its lamp, its sentence, its worth and what the worth rests on, then its one action, tinted and
   small; a tap on the move anywhere but its action opens the move's dialog (advMoveOpen), where Add to my list is. At Large as a
   card in a well (wdgMoveCardHtml). The same keys and refs as advice.js draws, so a tap acts on the move drawn under it. */
function wdgMoveActHtml(mv, ref) {
  if (mv.href) return '<a class="inv-btn inv-btn-tint inv-btn-sm" href="' + escHtml(mv.href) + '" data-adv-call>' + escHtml(mv.hrefLabel || 'Call') + '</a>';
  if (mv.go) return '<button type="button" class="inv-btn inv-btn-tint inv-btn-sm" data-action="invAdvGo" data-key="' + escHtml(mv.key) + '" data-adv-row="' + escHtml(ref) + '">' + escHtml(mv.goLabel || 'Open') + '</button>';
  return '';
}
function wdgMoveWorthHtml(mv) {
  var w = mv.worth;
  if (!w || !(w.amount > 0.005)) return '';
  var c = inrCard(w.amount);
  return figHtml('<span class="inv-nowrap" data-adv-worth title="' + escHtml((w.sign < 0 ? '−' : '+') + formatCurrency(w.amount)) + '">' + (w.sign < 0 ? '−' : '+') + escHtml(c.text) + '</span>', w.sign < 0 ? 'danger' : 'ok') +
    (typeof advWorthLabel === 'function' && advWorthLabel(w) ? ' ' + escHtml(advWorthLabel(w)) : '');
}
/* A sentence shortened on a board keeps its whole words as its title. */
function wdgMoveTitle(s) { return s && wdgShortMoney(s) !== String(s) ? ' title="' + escHtml(s) + '"' : ''; }
/* A move on the owner's list says so wherever it is drawn (What to do): On your list, in its meta line. */
function wdgMoveListedHtml(mv) { return typeof advListedKeys === 'function' && advListedKeys()[mv.key] ? ADV_LISTED_HTML : ''; }
function wdgMoveRowHtml(mv) {
  var ref = advRowRef(mv), worth = wdgMoveWorthHtml(mv);
  var meta = [worth, mv.basis ? escHtml(wdgShortMoney(mv.basis)) : '', wdgMoveListedHtml(mv)].filter(Boolean).join('<span aria-hidden="true"> · </span>');
  return '<div class="inv-brief-move" data-adv-move="' + escHtml(mv.key) + '" data-tone="' + escHtml(mv.tone) + '">' +
    '<button type="button" class="inv-brief-move-main" data-action="invWdgMoveOpen" data-key="' + escHtml(mv.key) + '" data-adv-row="' + escHtml(ref) + '">' +
    '<span class="inv-dot inv-dot-' + uiTone(mv.tone) + ' inv-brief-move-say"' + wdgMoveTitle(mv.say) + '>' + escHtml(wdgShortMoney(mv.say)) + '</span>' +
    (meta ? '<span class="inv-brief-move-worth">' + meta + '</span>' : '') + '</button>' + wdgMoveActHtml(mv, ref) + '</div>';
}
function wdgMoveCardHtml(mv) {
  var ref = advRowRef(mv), w = mv.worth, c = w && w.amount > 0.005 ? inrCard(w.amount) : null;
  return '<div class="inv-brief-movecard" data-adv-move="' + escHtml(mv.key) + '" data-tone="' + escHtml(mv.tone) + '">' +
    '<button type="button" class="inv-brief-move-main" data-action="invWdgMoveOpen" data-key="' + escHtml(mv.key) + '" data-adv-row="' + escHtml(ref) + '">' +
    (c ? '<span class="inv-brief-worth" data-adv-worth title="' + escHtml((w.sign < 0 ? '−' : '+') + formatCurrency(w.amount)) + '">' + figHtml((w.sign < 0 ? '−' : '+') + escHtml(c.text), w.sign < 0 ? 'danger' : 'ok') +
      (typeof advWorthLabel === 'function' && advWorthLabel(w) ? '<span class="inv-unit">' + escHtml(advWorthLabel(w)) + '</span>' : '') + '</span>' : '') +
    '<span class="inv-dot inv-dot-' + uiTone(mv.tone) + ' inv-brief-move-say"' + wdgMoveTitle(mv.say) + '>' + escHtml(wdgShortMoney(mv.say)) + '</span>' +
    (mv.basis ? '<span class="inv-brief-move-worth"' + wdgMoveTitle(mv.basis) + '>' + escHtml(wdgShortMoney(mv.basis)) + '</span>' : '') +
    (wdgMoveListedHtml(mv) ? '<span class="inv-brief-move-worth">' + ADV_LISTED_HTML + '</span>' : '') + '</button>' + wdgMoveActHtml(mv, ref) + '</div>';
}
/* A list of moves (`data-noun` move, so a cut list's More says "4 more moves"); at Large the cards three across from 40rem. */
function wdgMovesHtml(moves, large, attrs) {
  return '<div class="' + (large ? 'inv-brief-movecards' : 'inv-brief-moves') + '" data-wdg-list data-noun="move"' + (attrs || '') + '>' + (moves || []).map(large ? wdgMoveCardHtml : wdgMoveRowHtml).join('') + '</div>';
}
/* A dated row led by its day in a small well (Briefing): `today` in the accent's soft colour. o: {day, today, title, why, tone, word,
   go: {action, attrs}, attrs}. */
function wdgWhenRowHtml(o) {
  var inner = '<span class="inv-brief-day"' + (o.today ? ' data-today' : '') + '>' + escHtml(o.day) + '</span><span class="inv-brief-when-text"><span class="inv-row-title">' + escHtml(o.title) + '</span>' +
    (o.why ? '<span class="inv-row-meta">' + escHtml(o.why) + '</span>' : '') + '</span>' + (o.word ? '<span class="inv-dot inv-dot-' + uiTone(o.tone) + '">' + escHtml(o.word) + '</span>' : '');
  return o.go ? '<button type="button" class="inv-brief-when"' + wdgPressAttrs(o.go) + (o.attrs || '') + '>' + inner + '</button>'
    : '<div class="inv-brief-when"' + (o.attrs || '') + '>' + inner + '</div>';
}
/* Outside: headlines with their dateline, each opening its article outside the app. items: [{title, url, site, when}]. A headline is
   untrusted text: escaped, its link https or http only, rel noopener noreferrer, a new tab. */
function wdgWireHtml(items, attrs) {
  return '<div class="inv-wire" data-wdg-list data-noun="headline"' + (attrs || '') + '>' + (items || []).map(function(it) {
    var url = /^https?:\/\//i.test(String(it.url || '')) ? String(it.url) : '';
    var inner = '<span class="inv-wire-head">' + escHtml(it.title || '') + '</span><span class="inv-wire-dateline">' + escHtml([it.site, it.when].filter(Boolean).join(' · ')) + '</span>';
    return url ? '<a class="inv-wire-item" href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer">' + inner + iconSvg('external', 'inv-wire-ext') + '</a>'
      : '<span class="inv-wire-item">' + inner + '</span>';
  }).join('') + '</div>';
}
/* Tools: keys on a sunk tray, three across (six once the card is 40rem wide), each the card's surface lifted, the icon in the
   accent over its word. keys: [{label, icon, action | jump, attrs}]; attrs the tray's own (data-wdg-push). */
function wdgTrayHtml(keys, label, attrs) {
  return '<div class="inv-tray" role="group" aria-label="' + escHtml(label || 'Actions') + '"' + (attrs || '') + '>' + (keys || []).map(function(k) {
    return '<button type="button" class="inv-tray-key"' + wdgPressAttrs(k) + '>' + iconSvg(k.icon) + '<span>' + escHtml(k.label) + '</span></button>';
  }).join('') + '</div>';
}

/* ---------- The board (§7b, §24h) ----------
   A board is a grid of fixed rows packed dense: a later card moves up into a hole an earlier one left; the DOM keeps the layout's
   order, so the tab order and a screen reader read the order the person arranged. Arranging turns packing off and shows each hole
   as a slot (wdgPlace). */
var _wdgArrange = null;      // the board being arranged, or null
var _wdgUndo = null;         // the last widget removed: {board, lay, list}
var _wdgArrangeObs = null;   // the arranged board's resize watch: a slot is placed again when its columns change
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
    action: '<button type="button" class="inv-btn inv-btn-tint" data-action="invWdgGallery" data-board="' + escHtml(board) + '">Add a widget</button>' }) + '</div>';
  return '<div class="inv-wboard" data-board="' + escHtml(board) + '"' + (arranging ? ' data-arranging' : '') + '>' +
    '<div class="inv-visually-hidden" aria-live="polite" data-wdg-live></div>' +
    '<div class="inv-wgrid" data-wgrid="' + escHtml(board) + '">' + cards + '</div></div>';
}
/* Draws a board into its host, then lays it out: each widget's hook and fit, the slots while arranging, the live redraws. */
function wdgBoardDraw(host, board) {
  if (!host) return;
  host.innerHTML = wdgBoardHtml(board);
  wdgAfter(host);
  wdgPack(host);
  wdgLiveStart(host, board);
}
/* The board laid out: while arranging, each card at its place and each hole a slot (§24h); else the grid packs itself. */
function wdgPack(host) {
  var grid = host && host.querySelector('.inv-wgrid');
  if (!grid) return;
  var board = grid.closest('.inv-wboard');
  if (board && board.hasAttribute('data-arranging')) wdgArrangeLayout(grid);
}
/* A size's span on a board of `cols` columns (§24b): Small 3 × 1 (1 × 1 on the phone's 2), Medium 6 × 2 (2 × 2), Large the row × 2
   (the phone's 2 × 3, a 6-column board's 6 × 2). */
function wdgSpan(size, cols) {
  if (cols <= 2) return size === 's' ? { w: 1, h: 1 } : size === 'l' ? { w: 2, h: 3 } : { w: 2, h: 2 };
  if (cols < 12) return size === 's' ? { w: 3, h: 1 } : { w: 6, h: 2 };
  return size === 's' ? { w: 3, h: 1 } : size === 'l' ? { w: 12, h: 2 } : { w: 6, h: 2 };
}
function wdgGridCols(grid) {
  var t = getComputedStyle(grid).gridTemplateColumns || '';
  var n = t.split(' ').filter(function(x) { return x && x !== 'none'; }).length;
  return n || 2;
}
/* Where each card stands as the browser places them sparse (CSS Grid's auto-placement, row by row, the cursor never moving back),
   and the holes left (§24h; pure). items: [{w, h}] spans; returns {at: [{r, c, w, h}], rows, slots: [{r, c, w, h, size, i}]}: a
   hole a Medium fits is one slot of a Medium, else Smalls; `i` is how many cards stand before the slot, where a widget added there
   goes into the order. */
function wdgPlace(items, cols) {
  cols = Math.max(1, cols | 0);
  var occ = {}, at = [], cr = 1, cc = 1, rows = 0;
  var key = function(r, c) { return r + ':' + c; };
  var free = function(r, c, w, h) { for (var y = r; y < r + h; y++) for (var x = c; x < c + w; x++) if (occ[key(y, x)]) return false; return true; };
  (items || []).forEach(function(it) {
    var w = Math.max(1, Math.min(it.w | 0, cols)), h = Math.max(1, it.h | 0);
    for (;;) {
      if (cc + w - 1 > cols) { cr++; cc = 1; continue; }
      if (free(cr, cc, w, h)) break;
      cc++;
    }
    for (var y = cr; y < cr + h; y++) for (var x = cc; x < cc + w; x++) occ[key(y, x)] = true;
    at.push({ r: cr, c: cc, w: w, h: h });
    rows = Math.max(rows, cr + h - 1);
    cc += w;
  });
  var u = cols <= 2 ? 1 : 3, mw = cols <= 2 ? 2 : 6, used = {}, slots = [];
  var before = function(r, c) { return at.filter(function(p) { return p.r < r || (p.r === r && p.c < c); }).length; };
  var open = function(r, c, w, h) {
    if (c + w - 1 > cols || r + h - 1 > rows) return false;
    for (var y = r; y < r + h; y++) for (var x = c; x < c + w; x++) if (occ[key(y, x)] || used[key(y, x)]) return false;
    return true;
  };
  var mark = function(r, c, w, h) { for (var y = r; y < r + h; y++) for (var x = c; x < c + w; x++) used[key(y, x)] = true; };
  for (var r = 1; r <= rows; r++) {
    for (var c = 1; c <= cols; c += u) {
      if (!open(r, c, u, 1)) continue;
      if (open(r, c, mw, 2)) { mark(r, c, mw, 2); slots.push({ r: r, c: c, w: mw, h: 2, size: 'm', i: before(r, c) }); }
      else { mark(r, c, u, 1); slots.push({ r: r, c: c, w: u, h: 1, size: 's', i: before(r, c) }); }
    }
  }
  return { at: at, rows: rows, slots: slots };
}
/* Arranging (§24h): every card and the placeholder at the place wdgPlace gives it, each hole a slot (a dashed well saying what it
   has room for, and Add here, which opens the gallery; a widget added there goes into the order at the slot). */
function wdgArrangeLayout(grid) {
  if (!grid) return;
  Array.prototype.forEach.call(grid.querySelectorAll(':scope > .inv-wgrid-slot'), function(s) { s.remove(); });
  var cols = wdgGridCols(grid);
  var els = Array.prototype.filter.call(grid.children, function(el) {
    return (el.classList.contains('inv-widget') && !el.classList.contains('inv-widget-lifted')) || el.classList.contains('inv-widget-ph');
  });
  var P = wdgPlace(els.map(function(el) { return wdgSpan(el.dataset.size, cols); }), cols);
  els.forEach(function(el, i) { el.style.setProperty('--wdg-r', P.at[i].r); el.style.setProperty('--wdg-c', P.at[i].c); });
  var board = grid.closest('.inv-wboard'), b = board ? board.dataset.board : 'home';
  P.slots.forEach(function(s) {
    var d = document.createElement('div');
    d.className = 'inv-wgrid-slot';
    d.dataset.size = s.size;
    d.style.setProperty('--wdg-r', s.r);
    d.style.setProperty('--wdg-c', s.c);
    d.innerHTML = '<span class="inv-wgrid-slot-say">Room for a ' + WDG_SIZE_NAMES[s.size] + '</span>' +
      '<button type="button" class="inv-btn inv-btn-tint" data-action="invWdgAddHere" data-board="' + escHtml(b) + '" data-at="' + s.i + '">Add here</button>';
    grid.appendChild(d);
  });
}
/* One widget drawn again where it stands (a size picked, a Choose, a live widget's minute): nothing else on the board is touched. */
function wdgRedrawOne(el, size) {
  var board = el.closest('.inv-wboard'), def = wdgDef(el.dataset.w);
  if (!board || !def) return;
  var shown = wdgShown(board.dataset.board), i = shown.map(function(x) { return x[0]; }).indexOf(def.id);
  var t = document.createElement('div');
  t.innerHTML = wdgCardHtml(def, size || el.dataset.size, { board: board.dataset.board, i: i, n: shown.length, arranging: _wdgArrange === board.dataset.board });
  var card = t.firstElementChild;
  ['--wdg-r', '--wdg-c'].forEach(function(p) { var v = el.style.getPropertyValue(p); if (v) card.style.setProperty(p, v); });
  el.replaceWith(card);
  wdgAfterOne(card);
  if (board.hasAttribute('data-arranging') && (size && size !== el.dataset.size)) wdgArrangeLayout(card.parentElement);
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
   it is on). Packing is off: what is arranged is where it stands, and each hole is a slot. Each widget shows its handle, its place,
   its size and Remove; the toolbar Add a widget, Reset and Done. A drop, a key, a size or a removal writes the layout on screen
   only: the desktop's and the phone's are their own. Done turns packing back on. */
function wdgArrangeCtlHtml(def, size, o) {
  var id = escHtml(def.id), title = escHtml(def.title);
  var sizes = def.sizes.length > 1 ? '<span class="inv-seg inv-widget-sizes" role="group" aria-label="Size of ' + title + '">' +
    ['s', 'm', 'l'].filter(function(s) { return def.sizes.indexOf(s) >= 0; }).map(function(s) {
      return '<button type="button" class="inv-seg-btn" data-action="invWdgSize" data-wid="' + id + '" data-size="' + s + '" aria-pressed="' + (s === size) + '" aria-label="' +
        WDG_SIZE_NAMES[s] + '">' + WDG_SIZE_SHORT[s] + '</button>';
    }).join('') + '</span>' : '';
  var name = escHtml(size === 's' && def.short ? def.short : def.title);
  return '<div class="inv-widget-ctl">' +
    '<button type="button" class="inv-widget-handle" data-wdg-handle="' + id + '" aria-label="Move ' + title + ', ' + (o.i + 1) + ' of ' + o.n + '">' + iconSvg('grip') + '</button>' +
    '<span class="inv-widget-ctl-name"><span class="inv-widget-title">' + name + '</span><span class="inv-widget-place" data-wdg-place>' + (o.i + 1) + ' of ' + o.n + '</span></span>' + sizes +
    '<button type="button" class="inv-btn inv-btn-icon inv-btn-ghost inv-widget-remove" data-action="invWdgRemove" data-wid="' + id + '" aria-label="Remove ' + title + '">' + iconSvg('close') + '</button></div>';
}
function wdgArrangeOn(board) { return _wdgArrange === board; }
function wdgArrangeStart(board) {
  _wdgArrange = board;
  wdgRedrawBoard(board);
  var first = document.querySelector('.inv-wboard[data-board="' + board + '"] [data-wdg-handle]');
  if (first && !touchScreen()) first.focus({ preventScroll: true });
  wdgArrangeWatch(board);
}
/* While a board is arranged, a change of its width (a window resized, the phone turned) places its cards and slots again. */
function wdgArrangeWatch(board) {
  if (_wdgArrangeObs) { _wdgArrangeObs.disconnect(); _wdgArrangeObs = null; }
  if (typeof ResizeObserver !== 'function') return;
  var grid = document.querySelector('.inv-wboard[data-board="' + board + '"] .inv-wgrid');
  if (!grid) return;
  var cols = wdgGridCols(grid);
  _wdgArrangeObs = new ResizeObserver(function() {
    var g = document.querySelector('.inv-wboard[data-arranging][data-board="' + board + '"] .inv-wgrid');
    if (!g || _wdgDrag) return;
    var c = wdgGridCols(g);
    if (c !== cols) { cols = c; wdgArrangeLayout(g); }
  });
  _wdgArrangeObs.observe(grid);
}
/* Done, Back or Escape leave arrange mode; `quiet`, the board is not drawn again (Home was left). */
function wdgArrangeDone(quiet) {
  var board = _wdgArrange;
  if (!board) return false;
  _wdgArrange = null;
  if (_wdgArrangeObs) { _wdgArrangeObs.disconnect(); _wdgArrangeObs = null; }
  wdgDragCancel();
  if (!quiet) wdgRedrawBoard(board);
  return true;
}
/* The board's screen draws itself (Home: renderHome), toolbar and all, keeping the page where it is. */
function wdgRedrawBoard(board) {
  keepScroll(function() {
    if (board === 'home' && typeof renderHomeBoard === 'function') renderHomeBoard();
  });
  if (_wdgArrange === board) wdgArrangeWatch(board);
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
/* Added from the gallery: to the end of the layout on screen (or at the slot it was opened from, `at`: the shown cards before it),
   and to the end of the other layout at its first size. */
function wdgAdd(board, id, at) {
  var def = wdgDef(id);
  if (!def || !wdgSees(def)) return;
  var lay = wdgLay();
  ['desk', 'phone'].forEach(function(l) {
    var list = wdgItems(board, l);
    if (list.some(function(x) { return x[0] === id; })) return;
    var item = [id, l === lay ? def.sizes[0] : wdgFitSize(def, l === 'phone' && def.sizes[0] !== 's' ? 'm' : def.sizes[0])];
    if (l === lay && at != null && at >= 0) {
      // The slot's place counts the cards on screen: the full list's index of the shown card at it (one the role may not see keeps its place).
      var k = 0, idx = list.length;
      for (var i = 0; i < list.length; i++) { if (wdgSees(wdgDef(list[i][0]))) { if (k === at) { idx = i; break; } k++; } }
      list.splice(idx, 0, item);
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
   after the widget under the pointer's centre, every card and slot placed again (wdgArrangeLayout); near the screen's top or bottom
   the page scrolls. Escape or a cancelled pointer puts it back; a drop writes the order. */
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
  grid.insertBefore(ph, card);
  card.classList.add('inv-widget-lifted');
  card.style.setProperty('--drag-w', r.width + 'px');
  card.style.setProperty('--drag-h', r.height + 'px');
  card.style.setProperty('--drag-x', r.left + 'px');
  card.style.setProperty('--drag-y', r.top + 'px');
  _wdgDrag = { card: card, ph: ph, grid: grid, board: _wdgArrange, pid: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top,
    from: Array.prototype.indexOf.call(grid.children, card), x: e.clientX, y: e.clientY, raf: 0 };
  wdgArrangeLayout(grid);
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
    wdgArrangeLayout(d.grid);
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
  if (d.grid.closest('.inv-wboard[data-arranging]')) wdgArrangeLayout(d.grid);
}

/* ---------- The gallery (§7f) ----------
   Add a widget opens a dialog: the board it adds to, the categories as chips, and each widget a card with its live preview at its
   first size (drawn as it comes into view), its question, its sizes, and Add or On Home with Remove. A widget the role may not
   see is never in it; a chip with nothing the role may see is left out. Opened from a slot (Add here), a widget added goes into
   the order at the slot. */
var _wdgGallery = { board: 'home', section: 'all', at: null };
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
      : '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invWdgGalleryAdd" data-wid="' + id + '">' + (_wdgGallery.at != null ? 'Add here' : 'Add to ' + escHtml(name)) + '</button>';
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
function wdgGalleryOpen(board, at) {
  _wdgGallery.board = WDG_BOARDS[board] ? board : 'home';
  _wdgGallery.at = at != null && isFinite(at) ? Number(at) : null;
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
    case 'invWdgGo': { var def = wdgDef(btn.dataset.wid); if (def) wdgGo(def); return true; }
    case 'invWdgReport': {
      var dr = wdgDef(btn.dataset.wid);
      if (dr && typeof errReport === 'function') errReport(new Error('A widget could not be drawn: ' + dr.id), 'widget: ' + dr.id);
      showToast('Reported. The rest of the board is drawn.', 'success');
      return true;
    }
    // A Choose (§24e): what is picked is kept with the layout, and that card alone is drawn again where it stands.
    case 'invWdgChoose': {
      var dc = wdgDef(btn.dataset.wid), cc = btn.closest('.inv-widget[data-w]');
      if (!dc) return true;
      wdgOptsPut(board, dc.id, Object.assign({}, wdgOpts(board, dc.id), { choose: btn.dataset.v }));
      if (cc) keepScroll(function() { wdgRedrawOne(cc); });
      var nb = document.querySelector('.inv-wboard[data-board="' + board + '"] .inv-widget[data-w="' + CSS.escape(dc.id) + '"] [data-action="invWdgChoose"][data-v="' + CSS.escape(btn.dataset.v) + '"]');
      if (nb) nb.focus({ preventScroll: true });
      return true;
    }
    // More (§24e): the rows the card had no room for, on the screen behind it, or in the widget's own dialog.
    case 'invWdgMore': {
      var dm = wdgDef(btn.dataset.wid), cm = btn.closest('.inv-widget[data-w]');
      if (!dm) return true;
      if (typeof dm.more === 'function') { var rec = cm ? wdgDrawnOf(cm) : null; dm.more(rec ? rec.d : null, cm); }
      else wdgGo(dm);
      return true;
    }
    // A jump a card's row or button makes (wdgPressAttrs' `jump`): todoGo's kinds and advGoTo's, the guard's refusal included.
    case 'invWdgGoTo': {
      var g = null;
      try { g = JSON.parse(btn.dataset.go || 'null'); } catch (e) { g = null; }
      if (g && typeof g === 'object') todoGo(g);
      return true;
    }
    // A move's row or card tapped anywhere but its action: the move's dialog (advice.js).
    case 'invWdgMoveOpen': if (typeof advMoveOpen === 'function') advMoveOpen(btn.dataset.key, btn.dataset.advRow); return true;
    case 'invWdgArrange': wdgArrangeStart(board); return true;
    case 'invWdgDone': wdgArrangeDone(); return true;
    case 'invWdgReset': wdgReset(board); return true;
    case 'invWdgSize': {
      wdgSetSize(board, btn.dataset.wid, btn.dataset.size);
      var card = btn.closest('.inv-widget');
      if (card) keepScroll(function() { wdgRedrawOne(card, btn.dataset.size); });
      var nz = document.querySelector('.inv-wboard[data-board="' + board + '"] .inv-widget[data-w="' + CSS.escape(btn.dataset.wid) + '"] [data-action="invWdgSize"][data-size="' + btn.dataset.size + '"]');
      if (nz) nz.focus({ preventScroll: true });
      return true;
    }
    case 'invWdgRemove': wdgRemove(board, btn.dataset.wid); wdgRedrawBoard(board); return true;
    case 'invWdgGallery': wdgGalleryOpen(board); return true;
    case 'invWdgAddHere': wdgGalleryOpen(board, btn.dataset.at); return true;
    case 'invWdgGalleryBoard': _wdgGallery.board = btn.dataset.board; wdgGalleryRedraw(); return true;
    case 'invWdgGallerySec': _wdgGallery.section = btn.dataset.sec; wdgGalleryRedraw(); return true;
    case 'invWdgGalleryAdd':
      wdgAdd(_wdgGallery.board, btn.dataset.wid, _wdgGallery.at);
      // A slot holds one widget: the next Add goes to the end.
      _wdgGallery.at = null;
      wdgGalleryRedraw('[data-gallery-w="' + CSS.escape(btn.dataset.wid) + '"] [data-action="invWdgGalleryRemove"]');
      wdgRedrawBoard(_wdgGallery.board);
      return true;
    case 'invWdgGalleryRemove':
      wdgRemoveFromGallery(_wdgGallery.board, btn.dataset.wid);
      wdgGalleryRedraw('[data-gallery-w="' + CSS.escape(btn.dataset.wid) + '"] [data-action="invWdgGalleryAdd"]');
      wdgRedrawBoard(_wdgGallery.board);
      return true;
    case 'invWdgGalleryDone': _wdgGallery.at = null; closeTopOverlay(); return true;
  }
  // A widget's own tap (its def's `act`): the widget the button names, else the card it sits in, else the dialog it opened.
  var card2 = btn.closest ? btn.closest('.inv-widget[data-w]') : null, own = wdgDef(btn.dataset.wid || (card2 ? card2.dataset.w : ''));
  if (own && typeof own.act === 'function') {
    try { if (own.act(action, btn, card2) !== false) return true; } catch (e) { wdgErr(own, e); return true; }
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
