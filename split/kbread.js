/* ===== READING AN ARTICLE: the second edition (docs/KNOWLEDGE_BASE_2.md, KB2-1) =====
   One body read once (kbParse) and drawn three ways: Quick reference (At a glance and the sections, each opening Reader at
   that section), Reader (a manual page, no tick boxes) and Guided (a step a screen, for training and a fault at the tank).
   The desktop is a desk: the Library on the left, the article in the middle, its context on the right. The phone keeps the
   modes and has the context in a sheet. Notes are public or the owner's own. The store and the rules (who reads, writes and
   approves) stay knowledge.js's; nothing here writes an article. */

var KB_MODES = ['quick', 'read', 'guide'];
var KB_RECENT_KEY = 'sep_inv_kb_recent';    // the last opened on this device, a per-device convenience
var KB_DESK_KEY = 'sep_inv_kb_desk';        // the desk's Library column shut or open
var KB_NOTE_MAX = 500;
var KB_NOTE_EDIT_MS = 24 * 3600 * 1000;     // one's own note is edited within a day
var _kbMode = '';      // the mode the open article is read in; '' its landing (kbLandMode)
var _kbSec = 0;        // Reader at a section (its index in kbParse's sections; 0 the top)
var _kbStep = -1;      // Guided: -1 its start, 0.. a step, the count its end
var _kbStepOf = '';    // the article and mode the step belongs to: another one starts at its start
var _kbFound = null;   // a fault followed step by step: the cause found
var _kbCtxOver = false;  // the desk's context column open over the article (a window under 80rem)
var _kbShelf = '';     // the Library's list shown in place of its shelves: a shelf's key, or 'all'

/* ---------- The text, read once ---------- */
var KB_NOTICE_RE = /^(?:\*\*)?(WARNING|CAUTION|NOTE)(?:\*\*)?\s*:\s*(?:\*\*)?\s*/;
/* The body as sections of blocks. A "# " heading starts a section; what comes before the first is the first section, with no
   title of its own. A block: a paragraph, a list ("- ", "1. "), or a notice (a paragraph starting WARNING:, CAUTION: or
   NOTE:). Kept as written: the drawing reads it. */
function kbParse(text) {
  var lines = String(text || '').replace(/\r/g, '').split('\n'), secs = [{ title: '', blocks: [] }], cur = secs[0], para = [], list = null;
  var flushPara = function() {
    if (!para.length) return;
    var t = para.join(' '), n = KB_NOTICE_RE.exec(t);
    cur.blocks.push(n ? { t: 'notice', level: n[1].toLowerCase(), text: t.slice(n[0].length) } : { t: 'p', text: t });
    para = [];
  };
  var flushList = function() { if (list) { cur.blocks.push(list); list = null; } };
  lines.forEach(function(l) {
    var t = l.trim();
    if (!t) { flushPara(); flushList(); return; }
    var h = /^#{1,3}\s+(.*)$/.exec(t), ul = /^[-•]\s+(.*)$|^\*\s+(.*)$/.exec(t), ol = /^(\d{1,3})[.)]\s+(.*)$/.exec(t);
    if (h) { flushPara(); flushList(); cur = { title: h[1].replace(/\*\*/g, '').trim(), blocks: [] }; secs.push(cur); return; }
    if (ul || ol) {
      flushPara();
      var tg = ol ? 'ol' : 'ul';
      if (list && list.t !== tg) flushList();
      if (!list) list = { t: tg, start: ol ? +ol[1] : 1, items: [] };
      list.items.push(ol ? ol[2] : (ul[1] || ul[2]));
      return;
    }
    flushList();
    para.push(t);
  });
  flushPara();
  flushList();
  if (!secs[0].blocks.length && secs.length > 1) secs.shift();
  secs = secs.filter(function(s) { return s.blocks.length || s.title; });
  secs.forEach(function(s, i) {
    var steps = 0, points = 0, paras = 0;
    s.blocks.forEach(function(b) { if (b.t === 'ol') steps += b.items.length; else if (b.t === 'ul') points += b.items.length; else if (b.t === 'p') paras++; });
    s.steps = steps; s.points = points; s.paras = paras;
    if (!s.title) s.title = i === 0 && secs.length > 1 ? (steps ? 'The steps' : 'Overview') : steps ? 'The steps' : 'In full';
  });
  return { sections: secs };
}
/* What a section holds, in a few words: its steps, else its points, else its paragraphs. */
function kbSecCount(s) {
  return s.steps ? todoPlural(s.steps, 'step') : s.points ? todoPlural(s.points, 'point') : s.paras ? todoPlural(s.paras, 'paragraph') : '';
}
/* Every numbered step in order, with the section it is in: what Guided walks. */
function kbSteps(P) {
  var out = [];
  P.sections.forEach(function(s, si) { s.blocks.forEach(function(b) { if (b.t === 'ol') b.items.forEach(function(t) { out.push({ sec: si, title: s.title, text: t }); }); }); });
  return out;
}
/* The notices, a WARNING before a CAUTION before a NOTE, each with the section it is in. */
function kbNotices(P) {
  var out = [], rank = { warning: 0, caution: 1, note: 2 };
  P.sections.forEach(function(s, si) {
    s.blocks.forEach(function(b) {
      if (b.t === 'notice') out.push({ level: b.level, text: b.text, sec: si });
      if (b.t === 'ul' || b.t === 'ol') b.items.forEach(function(t) { var n = KB_NOTICE_RE.exec(t); if (n) out.push({ level: n[1].toLowerCase(), text: t.slice(n[0].length), sec: si }); });
    });
  });
  return out.sort(function(x, y) { return rank[x.level] - rank[y.level]; });
}

/* ---------- The words: bold, italic, a screen's path ---------- */
/* Every character through escHtml first. **bold** is what the person taps; *italic* a word set apart (the renderer had printed
   its stars); a path of the app's screens (Office → Challans) is one link that opens the screen. */
function kbInline(s) {
  var h = escHtml(String(s == null ? '' : s));
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[\s(;—–\/-])\*([^*\s](?:[^*]*[^*\s])?)\*(?=$|[\s.,;:!?)&—–\/-])/g, '$1<em>$2</em>');
  return kbPathsHtml(h);
}
var KB_PATH_RE = /\b(Today|Office|Floor|Money)((?: → [A-Z][A-Za-z’']*(?: [a-z][A-Za-z’']*)*)+)/g;
/* The place a path names: a workspace and one of its views (Money's own tabs for Money). A path the app cannot place is null,
   and stays text. */
function kbPathLoc(parts) {
  if (typeof WORKSPACES === 'undefined') return null;
  var ws = WORKSPACES.find(function(w) { return w.label === parts[0]; });
  if (!ws || !parts[1]) return null;
  var view = ws.views.find(function(x) { return x.label === parts[1]; });
  if (view) return { tab: view.tab, v: view.v || '' };
  if (ws.id === 'money' && typeof FIN_TABS !== 'undefined') { var ft = FIN_TABS.find(function(t) { return t[1] === parts[1]; }); if (ft) return { tab: 'pageFinance', v: ft[0] }; }
  return null;
}
/* The path as far as the app can place it: the words after a view's name ("Office → Challans to see the challan") are text,
   tried off one at a time from the end until a workspace and a view match. */
function kbPathsHtml(h) {
  return h.replace(KB_PATH_RE, function(m) {
    var parts = m.split(' → '), words = (parts[1] || '').split(' ');
    for (var n = words.length; n > 0; n--) {
      var name = words.slice(0, n).join(' '), loc = kbPathLoc([parts[0], name]);
      if (!loc) continue;
      var text = parts[0] + ' → ' + name, rest = m.slice(text.length);
      return '<button type="button" class="inv-kb-path" data-action="invKbPathGo" data-tab="' + escHtml(loc.tab) + '" data-v="' + escHtml(loc.v) + '">' + text + '</button>' + rest;
    }
    return m;
  });
}
function kbPathGo(tab, v) {
  if (!tab || (typeof isPageId === 'function' && !isPageId(tab))) return;
  if (!kbSeesPage(tab)) { showToast('Your ID doesn’t open ' + (PAGE_TITLES[tab] || 'that screen'), 'warning'); return; }
  if (dialogsTypedAsk(function() { kbPathGo(tab, v); })) return;
  closeOverlay();
  navOpen({ tab: tab, v: v || '', id: '', d: '' });
}
var KB_NOTICE_WORD = { warning: 'WARNING', caution: 'CAUTION', note: 'NOTE' };
var KB_NOTICE_TONE = { warning: 'danger', caution: 'warning', note: 'info' };
var KB_NOTICE_SVG = {
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  caution: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
};
/* A notice: the one place colour fills a page (DR-1: colour is status), its icon and its word before its text. */
function kbNoticeHtml(level, text) {
  return '<div class="inv-kb-notice inv-kb-notice-' + KB_NOTICE_TONE[level] + '" data-kb-notice="' + level + '" role="note">' + KB_NOTICE_SVG[level] +
    '<div><strong>' + KB_NOTICE_WORD[level] + '</strong> ' + kbInline(text) + '</div></div>';
}
/* A list item, a notice where it starts as one. */
function kbItemHtml(t) {
  var n = KB_NOTICE_RE.exec(t);
  return '<li>' + (n ? kbNoticeHtml(n[1].toLowerCase(), t.slice(n[0].length)) : kbInline(t)) + '</li>';
}
function kbBlocksHtml(blocks) {
  return blocks.map(function(b) {
    if (b.t === 'p') return '<p>' + kbInline(b.text) + '</p>';
    if (b.t === 'notice') return kbNoticeHtml(b.level, b.text);
    if (b.t === 'ul') return '<ul>' + b.items.map(kbItemHtml).join('') + '</ul>';
    return '<ol class="inv-kb-steps"' + (b.start !== 1 ? ' start="' + b.start + '"' : '') + '>' + b.items.map(kbItemHtml).join('') + '</ol>';
  }).join('');
}

/* ---------- Kind icons (§5): stroke icons, never coloured by kind ---------- */
var KB_KIND_SVG = {
  guide: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
  process: '<circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 6H14a3 3 0 0 1 0 6H10a3 3 0 0 0 0 6h6.5"/>',
  part: '<path d="M12 2.5 20.5 7.3v9.4L12 21.5 3.5 16.7V7.3z"/><circle cx="12" cy="12" r="3.5"/>',
  requirement: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4M8.5 13l2.5 2.5 4.5-5"/>',
  ruling: '<path d="M12 3v18M7 21h10M4 7h16"/><path d="M4 7l-2.5 6a3 3 0 0 0 5 0zM20 7l-2.5 6a3 3 0 0 0 5 0z"/>',
  fault: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  incident: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  decision: '<path d="M12 21v-7M12 14 6 7M12 14l6-7M6 7V3M18 7V3M3.5 5.5 6 3l2.5 2.5M15.5 5.5 18 3l2.5 2.5"/>'
};
function kbKindIco(kind) {
  return '<span class="inv-kb-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    (KB_KIND_SVG[kind] || KB_KIND_SVG.guide) + '</svg></span>';
}
/* An app guide's title carries its kicker (Using the app: …, Setting up: …): the kicker over the title, the rest the title. */
function kbKicker(a) {
  var m = /^(Using the app|Setting up):\s*(.+)$/.exec(String(a.title || ''));
  return m ? { kicker: m[1], title: m[2].charAt(0).toUpperCase() + m[2].slice(1) } : { kicker: kbKindName(a.kind), title: a.title || 'Untitled' };
}

/* ---------- At a glance (§2d): written where it is, worked out where it is not ---------- */
/* Written: up to four lines "Label: value". */
function kbGlanceWritten(a) {
  return String(a.glance || '').split('\n').map(function(l) {
    var m = /^\s*([^:]{1,40}):\s*(.+?)\s*$/.exec(l);
    return m ? [m[1].trim(), m[2].slice(0, 90)] : null;
  }).filter(Boolean).slice(0, 4);
}
function kbGlanceWorked(a) {
  var rows = [], P = kbParse(a.body), first = function(s) { var m = /^.*?[.!?](?:\s|$)/.exec(String(s || '')); return (m ? m[0] : String(s || '')).trim().slice(0, 90); };
  var plain = function(s) { return String(s || '').replace(/\*\*?/g, ''); };
  if (a.kind === 'guide' || a.kind === 'process') {
    var where = '';
    P.sections.some(function(s) { return s.blocks.some(function(b) { var t = b.text || (b.items || []).join(' '); var m = KB_PATH_RE.exec(t); KB_PATH_RE.lastIndex = 0; if (m) where = m[0]; return !!m; }); });
    if (where) rows.push(['Where', where]);
    var taps = [], seen = {};
    String(a.body || '').replace(/\*\*([^*]+)\*\*/g, function(m, t) { t = t.trim().replace(/:$/, ''); if (!/^(WARNING|CAUTION|NOTE)$/.test(t) && !seen[t] && taps.length < 6) { seen[t] = 1; taps.push(t); } return m; });
    if (taps.length) rows.push(['You tap', taps.join(' · ')]);
    var n = kbNotices(P).filter(function(x) { return x.level !== 'note'; })[0];
    if (n) rows.push(['Watch out', first(plain(n.text))]);
  } else if (a.kind === 'fault') {
    if (a.symptom) rows.push(['You see', a.symptom]);
    if ((a.causes || [])[0]) rows.push(['Most likely', a.causes[0].cause]);
    var inc = kbReadable().filter(function(i) { return i.kind === 'incident' && i.faultId === a.id && i.status !== 'retired' && i.on; }).map(function(i) { return i.on; }).sort().pop();
    rows.push(['Last seen', inc ? formatDate(inc) : 'never logged']);
  } else if (a.kind === 'ruling') {
    if (a.summary) rows.push(['The ruling', a.summary]);
    if (a.ruledBy || a.ruledOn) rows.push(['Ruled', [a.ruledBy, a.ruledOn ? formatDate(a.ruledOn) : ''].filter(Boolean).join(', ')]);
    var later = a.supersededBy ? kbFind(a.supersededBy) : null;
    rows.push(['In force', a.status === 'superseded' ? 'No: replaced' + (later && kbCanRead(later) ? ' by ' + later.title : '') : a.status === 'retired' ? 'No: retired' : 'Yes']);
  } else if (a.kind === 'requirement') {
    var cl = (a.links || []).filter(function(l) { return l && l.type === 'client'; })[0];
    if (cl) rows.push(['Client', kbLinkName(cl)]);
    if (a.summary) rows.push(['What', a.summary]);
    rows.push(['Checked by', 'a check by hand']);
  } else if (a.kind === 'part') {
    var pc = (a.links || []).filter(function(l) { return l && l.type === 'client'; })[0], pp = (a.links || []).filter(function(l) { return l && l.type === 'part'; })[0];
    if (pc) rows.push(['Client', kbLinkName(pc)]);
    var size = pp ? String(pp.label || pp.id || '') : '';
    if (size) rows.push(['Size and gauge', size]);
    if (pc && pp && kbSeesPage('pageClients') && typeof prodKgPerPiece === 'function') try {
      var w = prodKgPerPiece(pc.id, localDateStr(), pp.label || pp.id, '');
      var kg = w && typeof w === 'object' ? w.kg : w;
      if (kg > 0) rows.push(['Weight', (Math.round(kg * 1000) / 1000) + ' kg a piece']);
    } catch (e) { /* no weight known */ }
  } else if (a.kind === 'decision') {
    rows.push(['Chosen', a.chosen != null && a.options && a.options[a.chosen] ? a.options[a.chosen].label : 'Not yet']);
    if (a.reviewOn) rows.push(['Review', formatDate(a.reviewOn)]);
  } else if (a.kind === 'incident') {
    if (a.on) rows.push(['Day', formatDate(a.on)]);
    var f = a.faultId ? kbFind(a.faultId) : null;
    if (f) rows.push(['Fault', kbCanRead(f) ? f.title : 'A fault you do not read']);
    if (a.fix) rows.push(['Fix', a.fix]);
  }
  return rows.filter(function(r) { return r[1]; }).map(function(r) { return [r[0], String(r[1]).slice(0, 90)]; }).slice(0, 4);
}
function kbGlance(a) { var w = kbGlanceWritten(a); return w.length ? { rows: w, written: true } : { rows: kbGlanceWorked(a), written: false }; }
function kbGlanceHtml(a) {
  var g = kbGlance(a);
  if (!g.rows.length) return '';
  return '<dl class="inv-kb-glance" data-kb-glance="' + (g.written ? 'written' : 'worked') + '">' + g.rows.map(function(r) {
    return '<div class="inv-kb-glance-row"><dt>' + escHtml(r[0]) + '</dt><dd>' + kbInline(r[1]) + '</dd></div>';
  }).join('') + '</dl>';
}

/* ---------- Which mode ---------- */
/* Guided has something to walk: the numbered steps of a how-to or a process, a fault's causes. */
function kbHasGuide(a) {
  if (!a) return false;
  if (a.kind === 'fault') return (a.causes || []).length > 0;
  return (a.kind === 'guide' || a.kind === 'process') && kbSteps(kbParse(a.body)).length > 0;
}
/* Where an article opens (§2c): the desk reads; on the phone the owner and the office land on Quick reference, a supervisor or
   a floor hand on Guided where the article is a lesson on their role's path and their hand has no training on its version. */
function kbLandMode(a) {
  if (_isDesktop) return 'read';
  var u = kbGuardOn() && typeof grdUser === 'function' ? grdUser() : null;
  if (u && (u.role === 'supervisor' || u.role === 'floor') && kbHasGuide(a) && kbIsLesson(a)) {
    var onPath = kbPaths().some(function(p) { return (!p.role || p.role === u.role) && kbPathArticles(p).some(function(x) { return x.id === a.id; }); });
    if (onPath && u.staffId != null && kbTrainState(u.staffId, a).state !== 'yes') return 'guide';
  }
  return 'quick';
}
function kbModeNow(a) {
  var m = _kbMode || kbLandMode(a);
  if (m === 'guide' && !kbHasGuide(a)) m = _isDesktop ? 'read' : 'quick';
  if (m === 'quick' && _isDesktop) m = 'read';
  return m;
}
/* The address (knowledge.js kbNavV): the mode only where it is not the landing, and Reader's section. */
function kbModeV(a) {
  if (!a) return '';
  var m = kbModeNow(a);
  if (m === kbLandMode(a) && !(m === 'read' && _kbSec)) return '';
  return '/' + m + (m === 'read' && _kbSec ? '/' + _kbSec : '');
}
function kbModeFromV(parts) {
  var m = KB_MODES.indexOf(parts[1]) >= 0 ? parts[1] : '';
  _kbMode = m;
  _kbSec = m === 'read' ? Math.max(0, parseInt(parts[2], 10) || 0) : 0;
}
/* A move between the modes is a step of the trail: Back walks Guided → Reader → Quick reference. */
function kbModeGo(mode, sec) {
  var a = _kbOpen ? kbFind(_kbOpen) : null;
  if (!a) return;
  var loc = { tab: 'pageKnow', v: _kbTab, id: a.id };
  kbGo(loc, function() {
    _kbMode = mode; _kbSec = mode === 'read' ? (sec || 0) : 0;
    if (mode === 'guide') { _kbStep = -1; _kbStepOf = a.id + '|guide'; _kbFound = null; }
    loc.v = _kbTab + kbModeV(a);
  });
}

/* ---------- The three modes ---------- */
function kbHeadHtml(a, mode) {
  var k = kbKicker(a);
  var modes = [['quick', 'Quick'], ['read', 'Read'], ['guide', 'Step by step']].filter(function(m) { return (m[0] !== 'quick' || !_isDesktop) && (m[0] !== 'guide' || kbHasGuide(a)); });
  // On the desk the article's close is on its own head line (a pane head above it had held the × alone).
  return '<header class="inv-kb-head">' + '<div class="inv-kb-kicker">' + kbKindIco(a.kind) + '<span>' + escHtml(k.kicker) + '</span>' +
    (a.status === 'published' && !a.pending ? '' : ' ' + kbStatusHtml(a)) +
    (_isDesktop ? '<button type="button" class="inv-btn inv-btn-icon inv-btn-ghost inv-kb-close" data-action="invKbClose" aria-label="Close the article">&times;</button>' : '') + '</div>' +
    '<h1 class="inv-kb-title">' + escHtml(k.title) + '</h1>' + (a.summary ? '<p class="inv-kb-lede">' + kbInline(a.summary) + '</p>' : '') +
    (modes.length > 1 ? '<div class="inv-seg inv-kb-modes" role="group" aria-label="How to read it">' + modes.map(function(m) {
      return '<button type="button" class="inv-seg-btn" data-action="invKbMode" data-mode="' + m[0] + '" aria-pressed="' + (mode === m[0]) + '">' + m[1] + '</button>';
    }).join('') + '</div>' : '') + '</header>';
}
/* Quick reference: the head, At a glance, then each section a line opening Reader at that section. Nothing unfolds in place. */
function kbQuickHtml(a) {
  var P = kbParse(a.body), h = '<div class="inv-kb-quick" data-kb-mode="quick" data-kb-article="' + escHtml(a.id) + '">' + kbHeadHtml(a, 'quick') + kbArticleStatusHtml(a) + kbGlanceHtml(a) +
    // A WARNING (data or money at risk) is never only one tap away: it is on Quick reference too.
    kbNotices(P).filter(function(x) { return x.level === 'warning'; }).map(function(x) { return kbNoticeHtml(x.level, x.text); }).join('');
  var rows = [];
  if (a.kind === 'fault' && (a.causes || []).length) rows.push({ s: 'causes', title: 'Likely causes', sub: todoPlural(a.causes.length, 'cause') + ', most likely first' });
  if (a.kind === 'decision' && (a.options || []).length) rows.push({ s: 'options', title: 'The options', sub: todoPlural(a.options.length, 'option') });
  P.sections.forEach(function(s, i) { rows.push({ s: i + 1, title: s.title, sub: kbSecCount(s) }); });
  if (rows.length) h += '<div class="inv-panel inv-panel-flush" data-kb-toc>' + rows.map(function(r) {
    return '<div class="inv-row"><button class="inv-row-main" data-action="invKbReadAt" data-s="' + escHtml(String(r.s)) + '"><span class="inv-row-title">' + escHtml(r.title) + '</span>' +
      (r.sub ? '<span class="inv-row-meta">' + escHtml(r.sub) + '</span>' : '') + '</button><span class="inv-row-end">' + KB_CHEVRON + '</span></div>';
  }).join('') + '</div>';
  h += '<div class="inv-toolbar inv-toolbar-flush inv-kb-quick-acts">' + '<button class="inv-btn inv-btn-secondary" data-action="invKbMode" data-mode="read">Read in full</button>' +
    (kbHasGuide(a) ? '<button class="inv-btn inv-btn-secondary" data-action="invKbMode" data-mode="guide">' + (a.kind === 'fault' ? 'Find the cause' : 'Follow step by step') + '</button>' : '') + '</div>';
  return h + kbArticleTailHtml(a) + '</div>';
}
var KB_CHEVRON = '<svg class="inv-kb-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
/* Reader: a manual page. The kind's own parts, then the sections, each a heading over its text. */
function kbReaderHtml(a) {
  var P = kbParse(a.body), h = '<article class="inv-kb-read" data-kb-mode="read" data-kb-article="' + escHtml(a.id) + '">' + kbHeadHtml(a, 'read') + kbArticleKindHtml(a);
  P.sections.forEach(function(s, i) {
    h += '<section class="inv-kb-sec" id="kbSec' + (i + 1) + '" data-kb-sec="' + (i + 1) + '">' + (P.sections.length > 1 || s.title !== 'In full' ? '<h2 class="inv-kb-sec-h">' + escHtml(s.title) + '</h2>' : '') +
      kbBlocksHtml(s.blocks) + '</section>';
  });
  return h + kbArticleTailHtml(a) + '</article>';
}
/* Guided: one step a screen. For a fault, its causes in order, each found or not. */
function kbGuidedHtml(a) {
  if (_kbStepOf !== a.id + '|guide') { _kbStep = -1; _kbStepOf = a.id + '|guide'; _kbFound = null; }
  var fault = a.kind === 'fault', P = kbParse(a.body), steps = fault ? (a.causes || []).map(function(c, i) { return { title: 'Cause ' + (i + 1), cause: c }; }) : kbSteps(P);
  var n = steps.length, i = Math.max(-1, Math.min(_kbStep, n)), k = kbKicker(a);
  var prog = '<div class="inv-kb-prog" role="progressbar" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + Math.max(0, Math.min(i + 1, n)) + '">' +
    steps.map(function(x, j) { return '<span class="inv-kb-prog-seg' + (j < i || i === n ? ' inv-kb-prog-done' : j === i ? ' inv-kb-prog-now' : '') + '"></span>'; }).join('') + '</div>';
  var h = '<div class="inv-kb-guide" data-kb-mode="guide" data-kb-step="' + i + '" data-kb-article="' + escHtml(a.id) + '">' + prog, bar = '';
  if (i < 0) {
    h += '<div class="inv-kb-kicker">' + kbKindIco(a.kind) + '<span>' + escHtml(k.kicker) + '</span></div><h1 class="inv-kb-title">' + escHtml(k.title) + '</h1>' +
      '<p class="inv-kb-lede">' + escHtml(fault ? (a.symptom ? 'You see: ' + a.symptom + '. ' : '') + todoPlural(n, 'cause') + ' to check, the most likely first.' : todoPlural(n, 'step')) + '</p>' +
      kbNotices(P).filter(function(x) { return x.level !== 'note'; }).map(function(x) { return kbNoticeHtml(x.level, x.text); }).join('') +
      '<button class="inv-btn inv-btn-link" data-action="invKbMode" data-mode="read">See all ' + (fault ? 'causes' : 'steps') + ' on one page</button>';
    bar = '<button class="inv-btn inv-btn-secondary inv-kb-big" data-action="invKbBack">Back</button><button class="inv-btn inv-btn-primary inv-kb-big" data-action="invKbStep" data-d="1">Start</button>';
  } else if (i < n) {
    var st = steps[i];
    h += '<div class="inv-kb-step-n">' + escHtml((fault ? 'Cause ' : 'Step ') + (i + 1) + ' of ' + n + (fault || !st.title || st.title === 'The steps' ? '' : ' · ' + st.title)) + '</div>';
    if (fault) {
      h += '<div class="inv-kb-step">' + kbInline(st.cause.cause) + '</div>' + (st.cause.check ? '<div class="inv-kb-step-sub"><strong>Check:</strong> ' + kbInline(st.cause.check) + '</div>' : '');
      bar = '<button class="inv-btn inv-btn-secondary inv-kb-big" data-action="invKbStep" data-d="1">Not this</button><button class="inv-btn inv-btn-primary inv-kb-big" data-action="invKbFound" data-i="' + i + '">Found it</button>';
    } else {
      var nt = KB_NOTICE_RE.exec(st.text);
      h += nt ? kbNoticeHtml(nt[1].toLowerCase(), st.text.slice(nt[0].length)) : '<div class="inv-kb-step">' + kbInline(st.text) + '</div>';
      bar = '<button class="inv-btn inv-btn-secondary inv-kb-big" data-action="invKbStep" data-d="-1">Back</button><button class="inv-btn inv-btn-primary inv-kb-big" data-action="invKbStep" data-d="1">' + (i === n - 1 ? 'Done' : 'Next') + '</button>';
    }
  } else {
    if (fault) {
      var c = _kbFound != null && a.causes[_kbFound] ? a.causes[_kbFound] : null;
      h += c ? '<div class="inv-kb-step-n">Cause found</div><div class="inv-kb-step">' + kbInline(c.cause) + '</div>' + (c.fix ? '<div class="inv-kb-step-sub"><strong>Fix:</strong> ' + kbInline(c.fix) + '</div>' : '')
        : '<div class="inv-kb-step-n">No cause found</div><div class="inv-kb-step">None of the ' + todoPlural(n, 'cause') + ' was it.</div><p class="inv-kb-lede">Write what you saw as an incident, so the next cause can be added.</p>';
      bar = '<button class="inv-btn inv-btn-secondary inv-kb-big" data-action="invKbMode" data-mode="read">Back to reading</button>' +
        (kbCanWrite() ? '<button class="inv-btn inv-btn-primary inv-kb-big" data-action="invKbFoundLog" data-id="' + escHtml(a.id) + '">Log an incident</button>' : '');
    } else {
      h += '<div class="inv-kb-step-n">All ' + todoPlural(n, 'step') + ' done</div>';
      var more = P.sections.filter(function(s) { return !s.steps && s.blocks.length; });
      if (more.length) h += '<section class="inv-kb-sec inv-kb-more"><h2 class="inv-kb-sec-h">Good to know</h2>' + more.map(function(s) { return (more.length > 1 || s.title !== 'In full' ? '<h3 class="inv-kb-sub-h">' + escHtml(s.title) + '</h3>' : '') + kbBlocksHtml(s.blocks); }).join('') + '</section>';
      var train = kbIsLesson(a) && kbTrainOk();
      bar = '<button class="inv-btn inv-btn-secondary inv-kb-big" data-action="invKbMode" data-mode="read">Back to reading</button>' +
        (train ? '<button class="inv-btn inv-btn-primary inv-kb-big" data-action="invKbTrain" data-id="' + escHtml(a.id) + '">Record training</button>' : '');
    }
  }
  return h + '<div class="inv-actionbar inv-kb-guidebar">' + bar + '</div></div>';
}
function kbModeHtml(a) {
  var m = kbModeNow(a);
  return m === 'guide' ? kbGuidedHtml(a) : m === 'read' ? kbReaderHtml(a) : kbQuickHtml(a);
}

/* ---------- The article's own parts, kept from the first edition ---------- */
/* What a reader must know before the text: replaced, retired, not approved; a fault's symptom and causes, an incident's
   cause and fix, a decision's options and figures. */
function kbArticleStatusHtml(a) {
  var h = '';
  var later = a.status === 'superseded' && a.supersededBy ? kbFind(a.supersededBy) : null, earlier = a.supersedes ? kbFind(a.supersedes) : null;
  if (a.status === 'superseded') h += '<div class="inv-callout inv-callout-warning">Replaced by a later ruling.' + (later && kbCanRead(later) ? ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbOpen" data-id="' + escHtml(later.id) + '">Open it</button>' : '') + '</div>';
  if (earlier) h += '<div class="inv-callout inv-callout-info">' + (kbCanRead(earlier) ? 'Replaces: ' + escHtml(earlier.title) + ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbOpen" data-id="' + escHtml(earlier.id) + '">Open</button>' : 'Replaces an earlier ruling.') + '</div>';
  if (a.status === 'retired') h += '<div class="inv-callout inv-callout-neutral">Retired' + (a.retiredAt ? ' ' + escHtml(formatDate(isoOf(new Date(a.retiredAt)))) : '') + (a.retireReason ? ': ' + escHtml(a.retireReason) : '') + '</div>';
  var dec = a.declined, decMine = dec && (kbIsOwner() || (dec.change ? dec.change.byId != null && dec.change.byId === kbMe().id : kbMine(a)));
  if (decMine && (a.status === 'draft' || !a.pending)) h += '<div class="inv-callout inv-callout-warning">' + (dec.change ? 'A change by ' + escHtml(dec.change.by || 'someone') + ' was not approved' : 'Not approved') + (dec.reason ? ': ' + escHtml(dec.reason) : '') + '</div>';
  return h;
}
/* The kind's own parts, in Reader. */
function kbArticleKindHtml(a) {
  var h = kbArticleStatusHtml(a);
  if (a.kind === 'fault') {
    if (a.symptom) h += '<div class="inv-callout inv-callout-info"><strong>What you see:</strong> ' + escHtml(a.symptom) + '</div>';
    if ((a.causes || []).length) h += '<section class="inv-kb-sec" id="kbSeccauses" data-kb-sec="causes" data-kb-causes><h2 class="inv-kb-sec-h">Likely causes, most likely first</h2><ol class="inv-kb-steps">' + a.causes.map(function(c) {
      return '<li><strong>' + kbInline(c.cause || '') + '</strong>' + (c.check ? '<div><em>Check:</em> ' + kbInline(c.check) + '</div>' : '') + (c.fix ? '<div><em>Fix:</em> ' + kbInline(c.fix) + '</div>' : '') + '</li>';
    }).join('') + '</ol></section>';
    var incs = kbReadable().filter(function(x) { return x.kind === 'incident' && x.faultId === a.id && x.status !== 'retired'; });
    h += '<div class="inv-panel inv-panel-flush" data-kb-fault-incidents><div class="inv-panel-head"><span class="inv-panel-title">Incidents <span class="inv-panel-count">' + incs.length + '</span></span>' +
      (kbCanWrite() ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbIncidentFor" data-id="' + escHtml(a.id) + '">Log one</button>' : '') + '</div>' +
      (incs.length ? incs.map(function(x) { return kbRowHtml(x); }).join('') : '<div class="inv-empty">None logged yet.</div>') + '</div>';
  }
  if (a.kind === 'incident') h += kbKvHtml([['Cause found', a.cause, true], ['Fix', a.fix, true]]);
  if (a.kind === 'decision') h += '<div id="kbSecoptions" data-kb-sec="options">' + kbDecisionHtml(a) + '</div>';
  return h;
}
/* After the text: photos, a proposed change, the check, the earlier versions, who reads it, and what can be done. On the phone
   the links are in the context sheet; on the desk, in the context column. */
function kbArticleTailHtml(a) {
  var h = kbImagesHtml(a.images);
  if (kbSeesProposal(a)) h += '<div class="inv-callout inv-callout-warning" data-kb-proposal>A change by ' + escHtml(a.pending.by || 'someone') + ' waits for approval' +
    (a.pending.at ? ' (' + escHtml(formatTimestamp(a.pending.at)) + ')' : '') + '. <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbProposal" data-id="' + escHtml(a.id) + '">See the change</button></div>';
  if (a.kind === 'guide' && (a.quiz || []).length && kbLive(a)) h += '<div class="inv-panel inv-panel-flush" data-kb-quiz><div class="inv-panel-head"><span class="inv-panel-title">Check what was learnt <span class="inv-panel-count">' + a.quiz.length + '</span></span></div>' +
    '<div class="inv-panel-body inv-note">Asked when training is recorded from this article: ' + escHtml(a.quiz.map(function(q) { return q.q; }).join(' · ')) + '</div></div>';
  if ((a.versions || []).length) h += uiFoldHtml('kb-ver-' + a.id, '<span class="inv-panel-title">Earlier versions <span class="inv-panel-count">' + a.versions.length + '</span></span>', a.versions.slice().reverse().map(function(v) {
    return '<div class="inv-row"><button class="inv-row-main" data-action="invKbVersion" data-id="' + escHtml(a.id) + '" data-v="' + escHtml(String(v.v)) + '"><span class="inv-row-title">Version ' + escHtml(String(v.v)) + '</span>' +
      '<span class="inv-row-meta">' + escHtml([v.at ? formatTimestamp(v.at) : '', v.by ? 'by ' + v.by : ''].filter(Boolean).join(' · ')) + '</span></button></div>';
  }).join(''), false);
  var meta = [];
  if (a.src !== 'build') meta.push(['Read by', kbRolesText(a)], ['Version', kbVer(a) + (a.approvedAt ? ', ' + formatDate(isoOf(new Date(a.approvedAt))) : '')], ['Written by', a.by || ''], ['Source', a.src === 'import' ? 'soma-internal' + (a.srcRef ? ' · ' + a.srcRef : '') : '']);
  else meta.push(['Version', String(kbVer(a))], ['Written by', 'The app']);
  if (a.kind === 'ruling') meta.unshift(['Ruled by', a.ruledBy], ['Ruled on', a.ruledOn ? formatDate(a.ruledOn) : '']);
  if (a.kind === 'decision') meta.unshift(['Decided on', a.decidedOn ? formatDate(a.decidedOn) : ''], ['Review on', a.reviewOn ? formatDate(a.reviewOn) : '']);
  h += '<div class="inv-kb-about" data-kb-about>' + kbKvHtml(meta) + '</div>';
  return h + kbActionsHtml(a);
}

/* ---------- The context (§3a): the desk's right column, the phone's sheet ---------- */
/* Each section a {key, title, count, html}; one with nothing in it is not drawn. Every figure read by the function its own
   screen uses, and only for a role that opens that screen. */
function kbCtxSections(a) {
  var out = [], links = (Array.isArray(a.links) ? a.links : []).filter(Boolean), today = localDateStr();
  var add = function(key, title, html, count) { if (html) out.push({ key: key, title: title, html: html, count: count == null ? '' : count }); };
  if (_isDesktop) add('glance', 'At a glance', kbGlanceHtml(a));
  add('now', a.kind === 'incident' && a.on ? 'That day in the book' : 'The plant now', a.kind === 'incident' && a.on ? kbDayContextHtml(a) : kbPlantNowHtml(links, today));
  if (links.length) add('linked', 'Linked', '<div class="inv-kb-ctx-links" data-kb-links>' + links.map(function(l, i) {
    return '<button class="inv-chip" data-action="invKbLinkGo" data-id="' + escHtml(a.id) + '" data-i="' + i + '">' + escHtml(kbLinkTypeName(l.type) + ': ' + kbLinkName(l)) + '</button>';
  }).join('') + '</div>', links.length);
  var feeds = kbFeedsRows(links);
  add('feeds', 'Feeds', feeds.html, feeds.n || '');
  var outs = kbOutputsRows(a);
  add('outputs', 'Outputs', outs.html, outs.n || '');
  var notes = kbNotesOf(a);
  add('notes', 'Notes', kbNotesHtml(a, notes), notes.length || '');
  return out;
}
function kbFactRow(k, v, tone, title) {
  return '<div class="inv-row inv-row-2"' + (title ? ' title="' + escHtml(title) + '"' : '') + '><span class="inv-row-main"><span class="inv-row-title">' + escHtml(k) + '</span></span>' +
    '<span class="inv-row-end">' + (tone ? uiDot(tone, escHtml(v)) : '<span class="inv-row-meta">' + escHtml(v) + '</span>') + '</span></div>';
}
/* The plant now, by the article's links: a line, a client, a part, a stock line, an area. */
function kbPlantNowHtml(links, today) {
  var rows = [];
  links.forEach(function(l) {
    try {
      if (l.type === 'line' && kbSeesPage('pageProduction') && typeof prodLineEfficiency === 'function') {
        var name = kbLinkName(l), e = prodLineEfficiency(today, l.id);
        if (e.n) rows.push(kbFactRow(name + ': units working', e.nAvail + ' of ' + e.n, e.nAvail < e.n ? (e.nAvail * 2 <= e.n ? 'danger' : 'warning') : 'ok'));
        rows.push(kbFactRow(name + ': today', e.eff != null ? Math.round(e.eff * 100) + '% efficient' : e.word || (e.ran ? 'running' : 'nothing recorded yet'), e.eff != null ? e.tone : null, e.why || ''));
        if (kbSeesPage('pageStock')) {
          var from = isoAddDays(today, -6), into = {};
          stockData().entries.forEach(function(se) {
            if (se.voided || se.voidedAt || !(se.kind === 'charged' || se.kind === 'used') || se.date < from || se.date > today) return;
            if (stockEntryLines(se).indexOf(l.id) < 0) return;
            var it = stockItem(se.itemId), nm = it ? it.name : 'a stock line';
            into[nm] = (into[nm] || 0) + (+se.qty || 0);
          });
          var ks = Object.keys(into);
          if (ks.length) rows.push(kbFactRow(name + ': into its bath, 7 days', ks.slice(0, 3).map(function(k) { return k + ' ' + stockFmtQty(into[k]); }).join(' · ')));
        }
        if (kbSeesPage('pagePower')) { var cuts = prodDowntimeDay(today); if (cuts.length) rows.push(kbFactRow('Power cuts today', todoPlural(cuts.length, 'cut'), 'warning')); }
      }
      if (l.type === 'client' && kbSeesPage('pageClients')) {
        var c = (S.clients || []).find(function(x) { return String(x.id) === String(l.id); });
        if (!c) return;
        var open = (S.incomingMaterial || []).filter(function(im) { return String(im.clientId) === String(c.id) && (im.items || []).some(function(it) { return !it.invoiced; }); });
        if (open.length) {
          var oldest = Math.max.apply(null, open.map(function(im) { return imWaitDays(im) || 0; }));
          rows.push(kbFactRow(c.name + ': challans waiting', todoPlural(open.length, 'challan') + ', oldest ' + todoPlural(oldest, 'day'), imWaitTone(oldest)));
        }
        if (typeof flowStats === 'function') {
          var f = flowStats(c.id);
          if (f.usual && f.usual.d != null) rows.push(kbFactRow(c.name + ': back in', todoPlural(f.usual.d, 'working day') + (f.within != null ? ' · ' + Math.round(f.within * 100) + '% on time' : '')));
        }
        if (typeof finClientMoney === 'function') {
          var m = finClientMoney(c.id);
          if (m && m.r && m.r.owed > 0.005) rows.push(kbFactRow(c.name + ': owed', formatCurrency(m.r.owed) + (m.dtp && m.dtp.median != null ? ' · pays in ' + Math.round(m.dtp.median) + ' d' : ''), finOwedTone(m.r.oldestDays)));
        }
      }
      if (l.type === 'stock' && kbSeesPage('pageStock')) {
        var item = stockItem(l.id);
        if (!item) return;
        var st = stockStatus(item);
        rows.push(kbFactRow(item.name, st.level == null ? 'not counted' : stockFmtQty(st.level) + ' ' + (item.unit || '') + (st.daysLeft != null ? ' · ' + Math.floor(st.daysLeft) + ' days left' : ''),
          st.tone === 'red' ? 'danger' : st.tone === 'amber' ? 'warning' : st.tone === 'ok' ? 'ok' : null));
      }
      if (l.type === 'area' && kbSeesRoster() && typeof areaNeedOn === 'function') {
        var rec = (S.attendance || {})[today], heads = 0;
        if (rec && rec.marks) Object.keys(rec.marks).forEach(function(k) { var mk = rec.marks[k]; if (mk && (mk.st === 'P' || mk.st === 'H') && mk.area === l.id) heads++; });
        var need = areaNeedOn(today, l.id);
        if (rec && rec.marks) rows.push(kbFactRow(kbLinkName(l) + ': on the floor', heads + (need ? ' of ' + need : ''), need ? areaNeedTone(heads, need) : null));
      }
      if (l.type === 'part' && kbSeesPage('pageProduction') && typeof prodIndex === 'function') {
        var key = kbNameKey(l.label || l.id), last = null;
        prodIndex().live.forEach(function(e) { if (e.kind === 'plated' && key && kbNameKey((e.part || '') + (e.partNumber || '')).indexOf(key) >= 0 && (!last || e.date > last.date)) last = e; });
        if (last) rows.push(kbFactRow(kbLinkName(l) + ': last plated', formatDate(last.date) + ' · ' + prodLineName(last.line)));
      }
    } catch (err) { /* a figure this book cannot read is left out */ }
  });
  return rows.length ? '<div class="inv-kb-ctx-rows">' + rows.join('') + '</div>' : '';
}
/* The records The plant now reads, each with how fresh it is, as Today reads the day's inputs. A feed this role does not open
   is not listed. */
var KB_FEEDS_BY_LINK = { line: ['production', 'pickling'], stock: ['stock'], area: ['roll-in', 'roll-out'], part: ['production'] };
function kbFeedsRows(links) {
  if (typeof TDY_INPUTS === 'undefined' || typeof tdyInput !== 'function') return { html: '', n: 0 };
  var want = {};
  links.forEach(function(l) { (KB_FEEDS_BY_LINK[l.type] || []).forEach(function(k) { want[k] = 1; }); });
  var rows = [], today = localDateStr();
  TDY_INPUTS.forEach(function(def) {
    if (!want[def.k] || !kbSeesPage(TDY_INPUT_PAGE[def.k])) return;
    try {
      var r = tdyInput(def, today), dot = TDY_STATE_DOT[r.state] || TDY_STATE_DOT.wait;
      rows.push(kbFactRow(TDY_INPUT_SHORT[def.k] || def.title, dot[1] + (r.state === 'in' || r.state === 'late' ? '' : '') , dot[0], tdyStepMeta(r)));
    } catch (e) { /* an input this book cannot read */ }
  });
  return { html: rows.length ? '<div class="inv-kb-ctx-rows">' + rows.join('') + '</div>' : '', n: rows.length };
}
/* What the article has led to: its incidents, the rulings that replace it, the decisions that link it, the training on it. */
function kbOutputsRows(a) {
  var rows = [], all = kbReadable();
  all.filter(function(x) { return x.kind === 'incident' && x.faultId === a.id && x.status !== 'retired'; }).forEach(function(x) { rows.push(kbRowHtml(x, true)); });
  if (a.supersededBy) { var later = kbFind(a.supersededBy); if (later && kbCanRead(later)) rows.push(kbRowHtml(later, true)); }
  all.filter(function(x) { return x.id !== a.id && x.kind === 'decision' && (x.links || []).some(function(l) { return l && l.type === 'article' && l.id === a.id; }); }).forEach(function(x) { rows.push(kbRowHtml(x, true)); });
  var n = rows.length, html = rows.join('');
  if (kbSeesRoster()) {
    var tr = kbData().trained.filter(function(t) { return !t.voidedAt && t.articleId === a.id; });
    if (tr.length) {
      var cur = tr.filter(function(t) { return (t.v || 1) >= kbVer(a); }).length;
      html += kbFactRow('Training on it', todoPlural(tr.length, 'record') + (cur < tr.length ? ' · ' + cur + ' on this version' : ''), cur < tr.length ? 'warning' : null);
      n++;
    }
  }
  return { html: html, n: n };
}

/* ---------- Notes (§6) ---------- */
function kbNotesAll() { var k = kbData(); if (!Array.isArray(k.notes)) k.notes = []; return k.notes; }
/* What this person reads: public notes on an article they read, newest first; private ones only the owner's. A note the owner
   removed is the owner's to see, with why. */
function kbNotesOf(a) {
  if (!a || !kbCanRead(a)) return [];
  var owner = kbIsOwner();
  return kbNotesAll().filter(function(n) { return n && n.articleId === a.id && (!n.private || owner) && (!n.removedAt || owner); })
    .sort(function(x, y) { return (y.at || 0) - (x.at || 0); });
}
function kbNoteMineEditable(n) { var me = kbMe(); return !n.removedAt && ((me.id != null && n.byId === me.id) || (me.id == null && kbIsOwner() && n.byId == null)) && Date.now() - (n.at || 0) < KB_NOTE_EDIT_MS; }
function kbNotesHtml(a, notes) {
  var owner = kbIsOwner(), h = '';
  notes.forEach(function(n) {
    var acts = (kbNoteMineEditable(n) ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbNoteEdit" data-id="' + escHtml(n.id) + '">Edit</button>' : '') +
      (owner && !n.removedAt ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbNoteRemove" data-id="' + escHtml(n.id) + '">Remove</button>' : '');
    h += '<div class="inv-row inv-row-auto inv-row-top' + (n.removedAt ? ' inv-row-muted' : '') + '" data-kb-note="' + escHtml(n.id) + '"' + (n.private ? ' data-kb-note-private' : '') + '><div class="inv-row-main">' +
      '<div class="inv-row-meta">' + escHtml([n.by || 'Someone', formatTimestamp(n.editedAt || n.at), n.private ? 'private' : ''].filter(Boolean).join(' · ')) + '</div>' +
      (n.removedAt ? '<div class="inv-row-meta inv-row-wrap">' + escHtml('Removed by the owner' + (n.removeReason ? ': ' + n.removeReason : '')) + '</div>' : '<div class="inv-kb-note-text">' + escHtml(n.text) + '</div>') +
      (acts ? '<div class="inv-kb-note-acts">' + acts + '</div>' : '') + '</div></div>';
  });
  if (kbCanWrite() && kbCanRead(a)) h += '<div class="inv-kb-noteform"><label class="inv-field"><span class="inv-field-label">Add a note</span>' +
    '<textarea class="inv-textarea" id="kbNoteText" data-kb-note-text rows="2" maxlength="' + KB_NOTE_MAX + '" placeholder="What a reader should know"></textarea></label>' +
    (owner ? '<label class="inv-field-check"><input type="checkbox" id="kbNotePrivate"> Private: only you read it</label>' : '') +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invKbNoteAdd" data-id="' + escHtml(a.id) + '">Add the note</button>' +
    (owner ? '<div class="inv-note">A private note is hidden from every other ID, but it travels with the book (backups, GitHub sync). It is not encrypted.</div>' : '') + '</div>';
  return h;
}
function kbNoteAdd(id, root) {
  var a = kbFind(id);
  if (!a || !kbCanRead(a) || !kbCanWrite()) { showToast('Sign in to write a note', 'warning'); return; }
  var box = (root || document).querySelector('[data-kb-note-text]'), priv = (root || document).querySelector('#kbNotePrivate');
  var text = box ? String(box.value || '').trim().slice(0, KB_NOTE_MAX) : '';
  if (!text) { showToast('Write the note first', 'warning'); if (box) box.focus(); return; }
  var me = kbMe();
  kbNotesAll().push({ id: kbUid('kn'), articleId: a.id, text: text, private: !!(priv && priv.checked && kbIsOwner()), by: me.name || 'Owner', byId: me.id, at: Date.now() });
  saveState();
  _pageTyped = false;
  showToast(priv && priv.checked && kbIsOwner() ? 'Private note added' : 'Note added');
  kbCtxRedraw();
}
async function kbNoteEdit(id) {
  var n = kbNotesAll().find(function(x) { return x.id === id; });
  if (!n || !kbNoteMineEditable(n)) { showToast('Only your own note, within a day, can be edited', 'warning'); return; }
  var t = await uiPrompt({ title: 'Edit the note', label: 'The note', value: n.text, required: true, okLabel: 'Save' });
  if (t == null) return;
  n.text = String(t).trim().slice(0, KB_NOTE_MAX);
  n.editedAt = Date.now();
  saveState();
  kbCtxRedraw();
}
async function kbNoteRemove(id) {
  var n = kbNotesAll().find(function(x) { return x.id === id; });
  if (!n || !kbIsOwner()) return;
  var why = await uiPrompt({ title: 'Remove the note', label: 'Why it goes', required: true, okLabel: 'Remove', danger: true });
  if (why == null) return;
  n.removedAt = Date.now(); n.removeReason = String(why).trim().slice(0, 300); n.removedBy = kbMe().name || 'Owner';
  saveState();
  kbCtxRedraw();
}
/* After a note: the sheet drawn again where it is open, else the page. */
function kbCtxRedraw() {
  if (document.querySelector('[data-kb-sheet]')) { kbSheetOpen(_kbSheetTab, true); return; }
  keepScroll(renderKnow);
}

/* ---------- The phone's context: a bar over the phone bar, a sheet with its tabs ---------- */
var _kbSheetTab = 'context';
function kbCtxBarHtml(a) {
  var secs = kbCtxSections(a), get = function(k) { return secs.find(function(s) { return s.key === k; }); };
  var linked = get('linked'), notes = kbNotesOf(a).filter(function(n) { return !n.removedAt; });
  var bits = [linked ? todoPlural(linked.count, 'linked', 'linked') : '', notes.length ? todoPlural(notes.length, 'note') : 'Notes', get('now') ? (get('now').title === 'The plant now' ? 'The plant now' : 'That day') : ''].filter(Boolean);
  return '<div class="inv-kb-ctxbar"><button type="button" class="inv-btn inv-btn-secondary inv-kb-ctxbar-btn" data-action="invKbSheet" data-tab="context">' + escHtml(bits.join(' · ')) + '</button></div>';
}
function kbSheetOpen(tab, redraw) {
  var a = _kbOpen ? kbFind(_kbOpen) : null;
  if (!a || !kbCanRead(a)) return;
  _kbSheetTab = tab === 'notes' ? 'notes' : 'context';
  var secs = kbCtxSections(a), notes = secs.find(function(s) { return s.key === 'notes'; });
  var ctx = secs.filter(function(s) { return s.key !== 'notes'; });
  var body = _kbSheetTab === 'notes' ? (notes ? notes.html : '') : ctx.map(function(s) {
    return '<section class="inv-kb-ctx-sec" data-kb-ctx="' + s.key + '"><h3 class="inv-kb-ctx-h">' + escHtml(s.title) + (s.count !== '' ? ' <span class="inv-panel-count">' + s.count + '</span>' : '') + '</h3>' + s.html + '</section>';
  }).join('') || '<div class="inv-empty">Nothing linked to this article yet.</div>';
  var tabs = '<div class="inv-viewtabs" role="tablist" aria-label="About this article">' + [['context', 'Context'], ['notes', 'Notes']].map(function(t) {
    return '<button class="inv-viewtab" role="tab" aria-selected="' + (_kbSheetTab === t[0]) + '" data-action="invKbSheet" data-tab="' + t[0] + '">' + t[1] + '</button>';
  }).join('') + '</div>';
  dialogOpen('<div class="inv-dialog" data-kb-sheet>' + dialogHeadHtml(escHtml(kbKicker(a).title)) + tabs + '<div class="inv-dialog-main">' + body + '</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Close</button></div></div>', { dismiss: true, replace: !!redraw || !!document.querySelector('[data-kb-sheet]') });
}

/* ---------- The desk (§3): the Library, the article, its context ---------- */
var KB_CTX_SHORT = { glance: 'Glance', now: 'Plant', linked: 'Linked', feeds: 'Feeds', outputs: 'Outputs', notes: 'Notes' };
/* The rail's doors: an icon for each section of the context. */
var KB_CTX_SVG = {
  glance: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  now: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  linked: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  feeds: '<path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>',
  outputs: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  notes: '<path d="M5 3h10l4 4v14H5z"/><path d="M9 11h6M9 15h6"/>'
};
function kbDeskShut() { try { return localStorage.getItem(KB_DESK_KEY) === 'shut'; } catch (e) { return false; } }
function kbDeskSet(shut) { try { localStorage.setItem(KB_DESK_KEY, shut ? 'shut' : 'open'); } catch (e) { /* a per-device convenience */ } }
function kbDeskHtml(listHtml, open) {
  // The Library shuts to its rail only beside an open article: with none open it is the whole desk.
  var shut = kbDeskShut() && !!open;
  var lib = shut ? '<div class="inv-kb-rail">' + KB_KINDS.map(function(k) {
    return '<button type="button" class="inv-btn inv-btn-ghost inv-kb-rail-btn" data-action="invKbRailKind" data-kind="' + k[0] + '" title="' + escHtml(k[2]) + '" aria-label="' + escHtml(k[2]) + '">' + kbKindIco(k[0]) + '</button>';
  }).join('') + '</div>' : listHtml;
  var h = '<div class="inv-pane-host inv-kb-desk' + (open ? ' inv-pane-open' : '') + (shut ? ' inv-kb-desk-shut' : '') + (_kbCtxOver ? ' inv-kb-ctx-over' : '') + '" id="kbHost" data-open="' + (open ? escHtml(open.id) : '') + '">' +
    // The Library's head (beside an open article only): its name and «, which shuts it to a rail of the kinds.
    '<div class="inv-pane-list inv-kb-lib">' + (open ? '<div class="inv-kb-lib-head">' + (shut ? '' : '<span class="inv-panel-title">Library</span>') +
      '<button type="button" class="inv-btn inv-btn-ghost inv-btn-sm inv-kb-collapse" data-action="invKbDeskShut" aria-expanded="' + !shut + '" aria-label="' + (shut ? 'Open the Library' : 'Shut the Library') + '">' + (shut ? '»' : '«') + '</button></div>' : '') + lib + '</div>' +
    '<div class="inv-pane inv-kb-mid" id="kbPane">' + (open ? kbModeHtml(open) : '') + '</div>';
  if (open) {
    var secs = kbCtxSections(open);
    h += '<aside class="inv-kb-ctx" id="kbCtx" aria-label="About this article"><div class="inv-kb-ctx-rail">' + secs.map(function(s) {
      return '<button type="button" class="inv-kb-ctx-door" data-action="invKbCtxOver" data-key="' + s.key + '" title="' + escHtml(s.title) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (KB_CTX_SVG[s.key] || KB_CTX_SVG.glance) + '</svg>' +
        '<span>' + escHtml(KB_CTX_SHORT[s.key] || s.title) + '</span>' + (s.count !== '' ? '<span class="inv-kb-ctx-n">' + s.count + '</span>' : '') + '</button>';
    }).join('') + '</div><div class="inv-kb-ctx-body">' + (_kbCtxOver ? '<div class="inv-kb-lib-head"><span class="inv-panel-title">About this article</span><button type="button" class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invKbCtxOver" data-key="" aria-label="Close">&times;</button></div>' : '') +
      secs.map(function(s) {
        return uiFoldHtml('kb-ctx-' + s.key, '<span class="inv-panel-title">' + escHtml(s.title) + (s.count !== '' ? ' <span class="inv-panel-count">' + s.count + '</span>' : '') + '</span>', s.html, true, ' data-kb-ctx="' + s.key + '"');
      }).join('') + '</div></aside>';
  }
  return h + '</div>';
}

/* ---------- The Library (§4): Ask, Recently opened, shelves, the list ---------- */
function kbRecentIds() { try { var v = JSON.parse(localStorage.getItem(KB_RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter(function(x) { return typeof x === 'string'; }) : []; } catch (e) { return []; } }
function kbRecentPut(id) {
  if (!id) return;
  try { var l = kbRecentIds().filter(function(x) { return x !== id; }); l.unshift(id); localStorage.setItem(KB_RECENT_KEY, JSON.stringify(l.slice(0, 8))); } catch (e) { /* a per-device convenience */ }
}
function kbRecent() { return kbRecentIds().map(kbFind).filter(function(a) { return a && kbCanRead(a) && a.status !== 'retired'; }).slice(0, 5); }
function kbCardHtml(a) {
  var k = kbKicker(a), about = a.kind === 'fault' ? a.symptom : a.summary;
  return '<button type="button" class="inv-kb-card" data-action="invKbOpen" data-id="' + escHtml(a.id) + '" data-kb-card="' + escHtml(a.id) + '"' + (about ? ' title="' + escHtml(about) + '"' : '') + '>' +
    kbKindIco(a.kind) + '<span class="inv-kb-card-t">' + escHtml(k.title) + '</span>' + (about ? '<span class="inv-kb-card-m">' + escHtml(about) + '</span>' : '') + '</button>';
}
/* The shelves: what the Library leads with when nothing is searched. A shelf with nothing on it is not drawn. */
function kbShelves() {
  var all = kbReadable().filter(function(a) { return a.status !== 'retired' && a.status !== 'superseded'; }), own = all.filter(function(a) { return a.src !== 'build'; });
  var byTitle = function(x, y) { return String(kbKicker(x).title).localeCompare(String(kbKicker(y).title)); };
  return [
    { key: 'wrong', title: 'When something goes wrong', list: own.filter(function(a) { return a.kind === 'fault'; }).sort(byTitle).concat(own.filter(function(a) { return a.kind === 'process'; }).sort(byTitle)) },
    { key: 'ruling', title: 'Rulings', list: own.filter(function(a) { return a.kind === 'ruling'; }).sort(function(x, y) { return String(y.ruledOn || '').localeCompare(String(x.ruledOn || '')); }) },
    { key: 'requirement', title: 'Client requirements', list: own.filter(function(a) { return a.kind === 'requirement'; }).sort(byTitle) },
    { key: 'shop', title: 'The shop’s how-tos and parts', list: own.filter(function(a) { return a.kind === 'guide' || a.kind === 'part'; }).sort(byTitle) },
    { key: 'records', title: 'Decisions and incidents', list: own.filter(function(a) { return a.kind === 'decision' || a.kind === 'incident'; }).sort(function(x, y) { return String(kbDayOf(y)).localeCompare(String(kbDayOf(x))); }) },
    { key: 'app', title: 'Using the app', list: all.filter(function(a) { return a.src === 'build' && !/^Setting up:/.test(a.title); }).sort(byTitle) },
    { key: 'setup', title: 'Setting up', list: all.filter(function(a) { return a.src === 'build' && /^Setting up:/.test(a.title); }).sort(byTitle) }
  ].filter(function(s) { return s.list.length; });
}
/* The training path's hero: this person's lessons done, and the next. */
function kbPathHeroHtml() {
  var u = kbGuardOn() && typeof grdUser === 'function' ? grdUser() : null;
  if (!u || u.role === 'owner' || u.staffId == null) return '';
  var p = kbPaths().find(function(x) { return x.role === u.role; });
  if (!p) return '';
  var arts = kbPathArticles(p), done = arts.filter(function(a) { return kbTrainState(u.staffId, a).state === 'yes'; }).length, next = arts.find(function(a) { return kbTrainState(u.staffId, a).state !== 'yes'; });
  return uiHeroHtml({ tone: next ? 'info' : 'ok', eyebrow: '<span>Your training path</span>', title: escHtml(done + ' of ' + arts.length + ' done'), sub: escHtml(next ? 'Next: ' + kbKicker(next).title : 'Every lesson done'),
    foot: next ? '<button class="inv-btn inv-btn-primary inv-btn-sm" data-action="invKbOpen" data-id="' + escHtml(next.id) + '">Start the next lesson</button>' : '', attrs: ' data-kb-path-hero' });
}
function kbShelvesHtml() {
  var h = kbPathHeroHtml(), rec = kbRecent();
  if (rec.length) h += '<section class="inv-kb-shelf" data-kb-shelf="recent"><div class="inv-kb-shelf-head"><h3 class="inv-kb-shelf-t">Recently opened</h3></div><div class="inv-kb-shelf-row">' + rec.map(kbCardHtml).join('') + '</div></section>';
  kbShelves().forEach(function(s) {
    h += '<section class="inv-kb-shelf" data-kb-shelf="' + s.key + '"><div class="inv-kb-shelf-head"><h3 class="inv-kb-shelf-t">' + escHtml(s.title) + '</h3>' +
      (s.list.length > 1 ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbShelf" data-key="' + s.key + '">See all ' + s.list.length + '</button>' : '') + '</div>' +
      '<div class="inv-kb-shelf-row">' + s.list.slice(0, 8).map(kbCardHtml).join('') + '</div></section>';
  });
  var n = kbReadable().filter(function(a) { return a.status !== 'retired' && a.status !== 'superseded'; }).length;
  h += '<div class="inv-panel inv-panel-flush"><div class="inv-row"><button class="inv-row-main" data-action="invKbShelf" data-key="all" data-kb-every><span class="inv-row-title">Every article</span>' +
    '<span class="inv-row-meta">' + escHtml(todoPlural(n, 'article') + ', by kind') + '</span></button><span class="inv-row-end">' + KB_CHEVRON + '</span></div></div>';
  return '<div class="inv-kb-shelves" id="kbShelves">' + h + '</div>';
}
/* A search, best first: where it matched counts (the title most), and the line that matched is said under the title. */
function kbAskRank(list, q) {
  var words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.map(function(a) {
    var t = String(a.title || '').toLowerCase(), s = String(a.summary || a.symptom || '').toLowerCase(), score = 0;
    words.forEach(function(w) { if (t.indexOf(w) >= 0) score += 3; if (s.indexOf(w) >= 0) score += 2; });
    return { a: a, score: score };
  }).sort(function(x, y) { return y.score - x.score || String(x.a.title).localeCompare(String(y.a.title)); }).map(function(x) { return x.a; });
}
function kbAskLine(a, q) {
  var words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  var lines = kbPlain(a).replace(/\*\*?/g, '').split(/\n+|(?<=[.!?])\s+/);
  var hit = lines.find(function(l) { var x = l.toLowerCase(); return words.some(function(w) { return x.indexOf(w) >= 0; }); });
  return hit ? hit.trim().replace(/^#+\s*|^[-•]\s+|^\d+[.)]\s+/, '').slice(0, 110) : '';
}
/* The shelf a list is filtered to. */
function kbShelfList(key, list) {
  if (!key || key === 'all') return list;
  var s = kbShelves().find(function(x) { return x.key === key; });
  if (!s) return list;
  var ids = {};
  s.list.forEach(function(a) { ids[a.id] = 1; });
  return list.filter(function(a) { return ids[a.id]; });
}
function kbShelfTitle(key) { var s = key === 'all' ? null : kbShelves().find(function(x) { return x.key === key; }); return key === 'all' ? 'Every article' : s ? s.title : ''; }

/* ---------- Opening, and the actions ---------- */
/* An article opened is put on this device's Recently opened, and its mode starts at its landing unless the address says. */
function kbOpened(id, parts) {
  kbModeFromV(parts);
  if (id) kbRecentPut(id);
  _kbCtxOver = false;
}
/* After a draw: Reader at its section, scrolled to it (on the desk inside the middle column). */
function kbAfterDraw(el, again) {
  if (!_kbSec || !el) return;
  // A page opened from its address is drawn before it is laid out: scroll again on the next frame.
  if (!again && typeof requestAnimationFrame === 'function') requestAnimationFrame(function() { kbAfterDraw(el, true); });
  var sec = el.querySelector('[data-kb-sec="' + _kbSec + '"]') || el.querySelector('#kbSec' + _kbSec);
  if (!sec) return;
  var mid = sec.closest('.inv-kb-mid');
  if (mid) mid.scrollTop = Math.max(0, sec.getBoundingClientRect().top - mid.getBoundingClientRect().top + mid.scrollTop - 8);
  else window.scrollTo(0, Math.max(0, sec.getBoundingClientRect().top + window.scrollY - 120));
}
function kbReadAction(action, btn) {
  var d = btn && btn.dataset ? btn.dataset : {};
  switch (action) {
    case 'invKbMode': kbModeGo(d.mode); return true;
    case 'invKbReadAt': kbModeGo('read', /^\d+$/.test(d.s) ? +d.s : d.s); return true;
    case 'invKbStep': {
      var a = _kbOpen ? kbFind(_kbOpen) : null;
      if (!a) return true;
      var n = a.kind === 'fault' ? (a.causes || []).length : kbSteps(kbParse(a.body)).length;
      _kbStep = Math.max(-1, Math.min(n, _kbStep + (+d.d || 1)));
      renderKnow();
      return true;
    }
    case 'invKbFound': { var fa = _kbOpen ? kbFind(_kbOpen) : null; if (!fa) return true; _kbFound = +d.i; _kbStep = (fa.causes || []).length; renderKnow(); return true; }
    case 'invKbFoundLog': {
      var f = kbFind(d.id), c = f && _kbFound != null && f.causes ? f.causes[_kbFound] : null;
      if (!f || f.kind !== 'fault' || !kbCanRead(f)) return true;
      kbOpenForm(null, 'incident', { title: f.symptom || f.title, links: JSON.parse(JSON.stringify((f.links || []).filter(function(l) { return l && l.type !== 'article'; }))),
        f: { faultId: f.id, on: localDateStr(), cause: c ? c.cause : '', fix: c ? c.fix || '' : '' } });
      return true;
    }
    case 'invKbPathGo': kbPathGo(d.tab, d.v); return true;
    case 'invKbSheet': kbSheetOpen(d.tab, !!document.querySelector('[data-kb-sheet]')); return true;
    case 'invKbNoteAdd': kbNoteAdd(d.id, btn.closest('.inv-kb-noteform') || document); return true;
    case 'invKbNoteEdit': kbNoteEdit(d.id); return true;
    case 'invKbNoteRemove': kbNoteRemove(d.id); return true;
    case 'invKbDeskShut': kbDeskSet(!kbDeskShut()); keepScroll(renderKnow); return true;
    case 'invKbRailKind': kbDeskSet(false); _kbFilter.kind = d.kind || ''; _kbShelf = 'all'; keepScroll(renderKnow); return true;
    case 'invKbCtxOver': _kbCtxOver = !!d.key; keepScroll(renderKnow); if (d.key) { var s = document.querySelector('#kbCtx [data-kb-ctx="' + d.key + '"]'); if (s) s.scrollIntoView({ block: 'nearest' }); } return true;
    // The shelf is in the address (knowledge.js kbListV), so Back returns to the shelves.
    case 'invKbShelf': kbSetTab('library'); kbGo({ tab: 'pageKnow', v: 'library/s-' + (d.key || 'all'), id: _kbOpen || '' }); return true;
  }
  return false;
}
