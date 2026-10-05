/* ===== THE KNOWLEDGE BASE (owner, 2–5 Oct 2026; docs/KNOWLEDGE_BASE.md) =====
   "I envision it as a training ground, as a troubleshooting area, as a record keeper, as a tool used to make decisions."
   - The book holds it (S.kb): this repo is public, so no shop knowledge is in the build. The app's own guides are the one
     exception (kbguides.js, KB_APP_GUIDES): they describe the app, not the shop.
   - An article is one of eight kinds (KB_KINDS). Each says which roles read it (none = everyone), keeps its versions, and is
     retired with a reason, never deleted once published. A ruling is never edited: a new ruling replaces it.
   - Anyone signed in writes; what they write waits for the owner (a pending article, or a proposed change on a published
     one). With the guard off everyone is the owner, as the app has always been.
   - Photos stay on the device that took them (sep-invoicing-media), never in the book.
   - Training is recorded against the roster (most hands have no ID), against the version taught: a newer version makes it
     due again. A decision keeps the figures it was taken on and asks for its review on its date. */

var KB_KINDS = [['guide', 'How-to', 'How-tos'], ['process', 'Process', 'Process'], ['part', 'Part', 'Parts'], ['requirement', 'Client requirement', 'Client requirements'],
  ['ruling', 'Ruling', 'Rulings'], ['fault', 'Fault', 'Faults'], ['incident', 'Incident', 'Incidents'], ['decision', 'Decision', 'Decisions']];
var KB_TABS = [['start', 'Start'], ['library', 'Library'], ['troubleshoot', 'Troubleshoot'], ['records', 'Records'], ['training', 'Training']];
var KB_STATUS = { draft: ['neutral', 'Draft'], pending: ['warning', 'Waiting for approval'], published: ['ok', 'Published'], superseded: ['neutral', 'Superseded'], retired: ['neutral', 'Retired'] };
var KB_LINK_TYPES = [['client', 'Client'], ['part', 'Part'], ['area', 'Area'], ['line', 'Line'], ['stock', 'Stock line'], ['screen', 'Screen'], ['worker', 'Worker'], ['article', 'Article']];
var KB_LINES = [['vat-a1', 'VAT A1'], ['vat-a2', 'VAT A2'], ['barrel', 'Barrel']];
var KB_READ_ROLES = ['office', 'supervisor', 'floor'];
var KB_TAB_KEY = 'sep_inv_kb_tab';
var KB_MEDIA_DB = 'sep-invoicing-media';
var KB_IMG_MAX = 1600;

var _kbTab = (function() { try { var t = localStorage.getItem(KB_TAB_KEY); return KB_TABS.some(function(x) { return x[0] === t; }) ? t : 'start'; } catch (e) { return 'start'; } })();
var _kbTabMoved = false;
var _kbOpen = null;          // the article open: the desktop's pane, the phone's own screen
var _kbEdit = null;          // the form: {id, kind, title, summary, body, tags, roles, links, f: {kind's fields}, images, from}
var _kbFilter = { q: '', kind: '', status: '', link: null };   // link: {type, id, label}: the guides for one screen, the articles on one record

if (typeof STATE_CONTAINERS !== 'undefined' && STATE_CONTAINERS.indexOf('kb') < 0) STATE_CONTAINERS.push('kb');

/* ---------- The store ---------- */
function kbData() {
  if (!S.kb || typeof S.kb !== 'object' || Array.isArray(S.kb)) S.kb = {};
  ['articles', 'trained', 'paths'].forEach(function(k) { if (!Array.isArray(S.kb[k])) S.kb[k] = []; });
  return S.kb;
}
function kbUid(p) { return (p || 'kb') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function kbKindName(k, many) { var x = KB_KINDS.find(function(r) { return r[0] === k; }); return x ? x[many ? 2 : 1] : k; }
/* Every article: the book's, then the app's own guides (read-only, src 'build'). */
function kbAll() { return kbData().articles.concat(typeof KB_APP_GUIDES !== 'undefined' ? KB_APP_GUIDES : []); }
function kbFind(id) { id = String(id == null ? '' : id); return kbAll().find(function(a) { return a.id === id; }) || null; }
function kbOwnFind(id) { return kbData().articles.find(function(a) { return a.id === String(id); }) || null; }

/* ---------- Who reads and writes ---------- */
function kbMe() { var u = typeof grdUser === 'function' ? grdUser() : null; return u ? { id: u.id, name: u.name || '' } : { id: null, name: typeof grdOn === 'function' && grdOn() ? '' : 'Owner' }; }
function kbIsOwner() { return typeof grdIsOwner !== 'function' || grdIsOwner(); }
function kbMine(a) { var me = kbMe(); return !!a && ((me.id != null && a.byId === me.id) || (me.id == null && kbIsOwner())); }
/* Somebody is here to write: anyone signed in, or anyone at all with the guard off. */
function kbCanWrite() { return !(typeof grdOn === 'function' && grdOn()) || !!grdUser(); }
/* Read: a draft or a pending article by its author and the owner; anything else by the roles it names (none = everyone). */
function kbCanRead(a) {
  if (!a) return false;
  if (a.status === 'draft' || a.status === 'pending') return kbIsOwner() || kbMine(a);
  if (!(typeof grdOn === 'function' && grdOn()) || kbIsOwner()) return true;
  var u = grdUser();
  if (!u) return false;
  return !a.roles || !a.roles.length || a.roles.indexOf(u.role) >= 0;
}
function kbReadable() { return kbAll().filter(kbCanRead); }
function kbLive(a) { return a && (a.status === 'published' || a.src === 'build'); }

/* ---------- The text ---------- */
/* The shop's own text, drawn as text: paragraphs, "- " lists, "# " heads and **bold**, every character through escHtml. */
function kbBodyHtml(text) {
  var lines = String(text || '').replace(/\r/g, '').split('\n'), out = '', para = [], list = [];
  var inline = function(s) { return escHtml(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); };
  var flush = function() {
    if (para.length) { out += '<p>' + para.map(inline).join(' ') + '</p>'; para = []; }
    if (list.length) { out += '<ul>' + list.map(function(x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</ul>'; list = []; }
  };
  lines.forEach(function(l) {
    var t = l.trim();
    if (!t) { flush(); return; }
    var h = /^#{1,3}\s+(.*)$/.exec(t), li = /^[-*•]\s+(.*)$/.exec(t);
    if (h) { flush(); out += '<h3 class="inv-kb-h">' + inline(h[1]) + '</h3>'; return; }
    if (li) { if (para.length) { out += '<p>' + para.map(inline).join(' ') + '</p>'; para = []; } list.push(li[1]); return; }
    if (list.length) flush();
    para.push(t);
  });
  flush();
  return out ? '<div class="inv-kb-body">' + out + '</div>' : '';
}
/* Everything an article says, as plain text: what search and the chatbot read. */
function kbPlain(a) {
  var f = [a.title, a.summary, a.symptom, a.question, a.cause, a.fix, a.reason, a.body];
  (a.causes || []).forEach(function(c) { f.push(c.cause, c.check, c.fix); });
  (a.options || []).forEach(function(o) { f.push(o.label, o.case); });
  (a.links || []).forEach(function(l) { f.push(l.label); });
  return f.concat(a.tags || []).filter(Boolean).join(' ');
}
function kbStatusHtml(a) {
  if (a.src === 'build') return '<span class="inv-badge inv-badge-info">App guide</span>';
  var s = KB_STATUS[a.status] || KB_STATUS.draft;
  var h = '<span class="inv-badge inv-badge-' + s[0] + '">' + s[1] + '</span>';
  if (a.status === 'published' && a.pending) h += ' <span class="inv-badge inv-badge-warning">Change waiting</span>';
  return h;
}
/* The day an article is about: a ruling's, an incident's, a decision's; else when it was written. */
function kbDayOf(a) { return a.ruledOn || a.on || a.decidedOn || (a.at ? isoOf(new Date(a.at)) : ''); }
function kbRolesText(a) { return !a.roles || !a.roles.length ? 'Everyone' : ['Owner'].concat(a.roles.map(grdRoleName)).join(', '); }

/* ---------- Links ---------- */
function kbLinkName(l) {
  var lbl = l.label || '';
  try {
    if (l.type === 'client') { var c = (S.clients || []).find(function(x) { return String(x.id) === String(l.id); }); if (c) return c.name; }
    if (l.type === 'area') return areaLabel(l.id) || lbl;
    if (l.type === 'line') { var ln = KB_LINES.find(function(x) { return x[0] === l.id; }); if (ln) return ln[1]; }
    if (l.type === 'stock') { var it = stockItem(l.id); if (it) return it.name; }
    if (l.type === 'screen') return wsPageName(l.id) || lbl;
    if (l.type === 'worker') { var w = staffById(l.id); if (w) return w.name; }
    if (l.type === 'article') { var a = kbFind(l.id); if (a) return a.title; }
  } catch (e) { /* the label as written */ }
  return lbl || l.id || '';
}
/* The articles linked to a record. A link names a record by id, or by the name as written (a part, or a record this book
   does not hold): either matches. */
function kbLinkedTo(type, id, label) {
  var key = String(id == null ? '' : id), nm = String(label || '').trim().toUpperCase();
  return kbReadable().filter(function(a) {
    if (a.status === 'retired' || a.status === 'superseded') return false;
    return (a.links || []).some(function(l) {
      if (l.type !== type) return false;
      if (key && String(l.id) === key) return true;
      return !!nm && String(l.label || '').trim().toUpperCase() === nm;
    });
  });
}
/* A panel for a record's screen: the articles linked to it, each a door. Empty when there are none (the screen says
   nothing). */
function kbLinkedHtml(type, id, label, title) {
  var list = kbLinkedTo(type, id, label);
  if (!list.length) return '';
  return '<div class="inv-panel inv-panel-flush" data-kb-linked="' + escHtml(type) + '"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(title || 'Knowledge') +
    ' <span class="inv-panel-count">' + list.length + '</span></span></div>' + list.map(kbRowHtml).join('') + '</div>';
}
function kbRowHtml(a) {
  var meta = [kbKindName(a.kind), a.kind === 'fault' ? a.symptom : a.summary, a.kind === 'ruling' && a.ruledOn ? formatDate(a.ruledOn) : '', a.kind === 'incident' && a.on ? formatDate(a.on) : ''].filter(Boolean).join(' · ');
  return '<div class="inv-row' + (a.status === 'retired' || a.status === 'superseded' ? ' inv-row-muted' : '') + (_kbOpen === a.id ? ' inv-row-selected' : '') + '" data-kb-row="' + escHtml(a.id) + '">' +
    '<button class="inv-row-main" data-action="invKbOpen" data-id="' + escHtml(a.id) + '"><span class="inv-row-title">' + escHtml(a.title || 'Untitled') + '</span>' +
    '<span class="inv-row-meta">' + escHtml(meta) + '</span></button><span class="inv-row-end">' + (a.status === 'published' && !a.pending ? '' : kbStatusHtml(a)) + '</span></div>';
}

/* ---------- Photos, on this device only ---------- */
var _kbMediaDb = null;
function kbMediaDb() {
  if (_kbMediaDb) return _kbMediaDb;
  _kbMediaDb = new Promise(function(res, rej) {
    if (!window.indexedDB) { rej(new Error('No IndexedDB')); return; }
    var rq = indexedDB.open(KB_MEDIA_DB, 1);
    rq.onupgradeneeded = function() { rq.result.createObjectStore('images'); };
    rq.onsuccess = function() { res(rq.result); };
    rq.onerror = function() { rej(rq.error); };
  });
  _kbMediaDb.catch(function() { _kbMediaDb = null; });
  return _kbMediaDb;
}
function kbMediaGet(id) {
  return kbMediaDb().then(function(db) {
    return new Promise(function(res) {
      var rq = db.transaction('images', 'readonly').objectStore('images').get(id);
      rq.onsuccess = function() { res(rq.result || null); };
      rq.onerror = function() { res(null); };
    });
  }).catch(function() { return null; });
}
function kbMediaPut(id, blob) {
  return kbMediaDb().then(function(db) {
    return new Promise(function(res, rej) {
      var tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put(blob, id);
      tx.oncomplete = function() { res(true); };
      tx.onerror = function() { rej(tx.error); };
    });
  });
}
/* A picture shrunk to 1,600 px on its long side as a JPEG, kept under the hash of its bytes (the same photo twice is one). */
function kbImageAdd(file) {
  return new Promise(function(res, rej) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function() {
      var k = Math.min(1, KB_IMG_MAX / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob(function(blob) {
        if (!blob) { rej(new Error('The photo could not be read')); return; }
        blob.arrayBuffer().then(function(buf) { return crypto.subtle.digest('SHA-256', buf); }).then(function(d) {
          var id = 'img-' + Array.prototype.map.call(new Uint8Array(d).slice(0, 12), function(b) { return ('0' + b.toString(16)).slice(-2); }).join('');
          return kbMediaPut(id, blob).then(function() { res({ id: id, w: w, h: h, caption: '' }); });
        }).catch(rej);
      }, 'image/jpeg', 0.82);
    };
    img.onerror = function() { URL.revokeObjectURL(url); rej(new Error('Not a picture this browser can read')); };
    img.src = url;
  });
}
var _kbImgUrls = {};
/* Fills each picture drawn in `root` from the device's store; one kept on another device says so in its place. */
function kbFillImages(root) {
  (root || document).querySelectorAll('img[data-kb-img]:not([src])').forEach(function(el) {
    var id = el.getAttribute('data-kb-img');
    if (_kbImgUrls[id]) { el.src = _kbImgUrls[id]; return; }
    kbMediaGet(id).then(function(blob) {
      if (!el.isConnected) return;
      if (!blob) {
        var n = document.createElement('div');
        n.className = 'inv-note';
        n.textContent = 'Photo kept on another device' + (el.alt ? ': ' + el.alt : '') + '.';
        el.replaceWith(n);
        return;
      }
      _kbImgUrls[id] = URL.createObjectURL(blob);
      el.src = _kbImgUrls[id];
    });
  });
}
function kbImagesHtml(imgs) {
  return (imgs || []).map(function(im) {
    return '<figure class="inv-kb-fig"><img class="inv-kb-img" data-kb-img="' + escHtml(im.id) + '" alt="' + escHtml(im.caption || 'Photo') + '" width="' + (im.w || 0) + '" height="' + (im.h || 0) + '">' +
      (im.caption ? '<figcaption class="inv-note">' + escHtml(im.caption) + '</figcaption>' : '') + '</figure>';
  }).join('');
}

/* ---------- Training ---------- */
/* A lesson is a how-to or a process article that is live. */
function kbIsLesson(a) { return kbLive(a) && (a.kind === 'guide' || a.kind === 'process'); }
function kbVer(a) { return a.version || 1; }
/* The latest training of one hand on one lesson, and whether it is due again (a newer version since). */
function kbTrainedOf(staffId, articleId) {
  var hit = null;
  kbData().trained.forEach(function(t) { if (!t.voidedAt && String(t.staffId) === String(staffId) && t.articleId === articleId && (!hit || t.at > hit.at)) hit = t; });
  return hit;
}
function kbTrainState(staffId, a) {
  var t = kbTrainedOf(staffId, a.id);
  if (!t) return { state: 'no', t: null };
  return { state: (t.v || 1) < kbVer(a) ? 'due' : 'yes', t: t };
}
/* The paths: the book's own, then the app's (one per role, of its guides). */
function kbPaths() {
  var own = kbData().paths.filter(function(p) { return p && Array.isArray(p.articles); });
  return own.concat(typeof KB_APP_PATHS !== 'undefined' ? KB_APP_PATHS : []);
}
function kbPathArticles(p) {
  return (p.articles || []).map(function(ref) { return kbFind(ref) || kbAll().find(function(a) { return a.title === ref; }) || null; }).filter(function(a) { return a && kbIsLesson(a) && kbCanRead(a); });
}
/* Every training due again: a hand trained on a version since replaced. */
function kbDueAgain() {
  var out = [], seen = {};
  kbData().trained.slice().sort(function(x, y) { return y.at - x.at; }).forEach(function(t) {
    if (t.voidedAt) return;
    var k = t.staffId + '|' + t.articleId;
    if (seen[k]) return;
    seen[k] = true;
    var a = kbFind(t.articleId), w = staffById(t.staffId);
    if (a && kbIsLesson(a) && w && w.active !== false && (t.v || 1) < kbVer(a)) out.push({ t: t, a: a, w: w });
  });
  return out;
}

/* ---------- Decisions: figures read live ---------- */
function _kbRange(days) { var to = localDateStr(); return { from: isoAddDays(to, -days + 1), to: to }; }
function _kbInvs(r, clientId) {
  return statsInvoices().filter(function(i) { return i.date >= r.from && i.date <= r.to && (clientId == null || String(i.clientId) === String(clientId)); });
}
/* Each: {label, client: needs a client, money: a figure only a role seeing money reads, fn(args) → {v, text} | null}. */
var KB_FIGURES = {
  realisation: { label: 'Realisation, last 90 days (₹/kg)', money: true, fn: function() { var w = weighLines(_kbInvs(_kbRange(90))); return w.kg > 0 ? { v: w.revKnown / w.kg, text: formatCurrency(w.revKnown / w.kg) + '/kg' } : null; } },
  clientRealisation: { label: 'A client’s realisation, last 90 days (₹/kg)', client: true, money: true, fn: function(a) { var w = weighLines(_kbInvs(_kbRange(90), a.client)); return w.kg > 0 ? { v: w.revKnown / w.kg, text: formatCurrency(w.revKnown / w.kg) + '/kg' } : null; } },
  clientShare: { label: 'A client’s share of the tonnage, last 90 days', client: true, fn: function(a) {
    var all = weighLines(_kbInvs(_kbRange(90))), one = weighLines(_kbInvs(_kbRange(90), a.client));
    return all.kg > 0 ? { v: one.kg / all.kg * 100, text: formatNum(one.kg / all.kg * 100, 1) + '% · ' + formatNum(one.kg / 1000, 2) + ' t' } : null; } },
  revenue: { label: 'Revenue, last 90 days (taxable)', money: true, fn: function() { var t = _kbInvs(_kbRange(90)).reduce(function(s, i) { return s + (Number(i.taxableValue) || 0); }, 0); return { v: t, text: formatCurrency(t) }; } },
  tonnage: { label: 'Tonnage, last 90 days', fn: function() { var w = weighLines(_kbInvs(_kbRange(90))); return { v: w.kg / 1000, text: formatNum(w.kg / 1000, 2) + ' t' }; } },
  liveCost: { label: 'Live cost, last 90 days (₹/kg)', money: true, fn: function() { var r = _kbRange(90), w = weighLines(_kbInvs(r)), lc = w.kg > 0 ? liveCost(r.from, r.to, w.kg) : null; return lc && lc.perKg != null ? { v: lc.perKg, text: formatCurrency(lc.perKg) + '/kg' } : null; } },
  cuts: { label: 'Power cuts, last 90 days', fn: function() { var r = _kbRange(90), n = powerCuts(r.from, r.to).length; return { v: n, text: String(n) }; } }
};
function kbFigureSees(key) { var f = KB_FIGURES[key]; return !!f && (!f.money || typeof grdSeesMoney !== 'function' || grdSeesMoney()); }
function kbFigureRead(fig) {
  var f = KB_FIGURES[fig.key];
  if (!f) return null;
  try { return f.fn(fig.args || {}); } catch (e) { return null; }
}
function kbFigureLabel(fig) {
  var f = KB_FIGURES[fig.key], c = fig.args && fig.args.client != null && (S.clients || []).find(function(x) { return String(x.id) === String(fig.args.client); });
  return (f ? f.label : fig.key) + (c ? ': ' + c.name : '');
}
/* A decision due for review: its date reached and no review since. */
function kbReviewDue(a) {
  if (a.kind !== 'decision' || !kbLive(a) || !a.reviewOn || a.reviewOn > localDateStr()) return false;
  var last = (a.reviewed || []).slice(-1)[0];
  return !last || isoOf(new Date(last.at)) < a.reviewOn;
}

/* ---------- The page ---------- */
/* The step on screen rewritten to where the page now is (a save leaves the form: Back does not reopen it). */
function kbNavReplace() {
  if (typeof navLoc !== 'function') return;
  var now = navLoc(), st = history.state;
  if (st && st.sep) { history.replaceState(Object.assign({}, st, { loc: now }), '', navUrl(now)); _navCur = history.state; }
  navTrailPut(now);
  navBarDraw();
}
/* The address: ?tab=pageKnow&v=<view>[/edit]&id=<article>. */
function kbNavV() { return _kbTab + (_kbEdit ? '/edit' : ''); }
function kbNavId() { return _kbEdit ? (_kbEdit.id || '') : (_kbOpen || ''); }
function kbNavApply(v, id) {
  var parts = String(v || '').split('/');
  kbSetTab(parts[0]);
  if (parts[1] === 'edit') {
    if (!_kbEdit && kbCanWrite()) { var a = id && kbOwnFind(id); _kbEdit = a ? kbFormFrom(a) : kbBlankForm('guide'); }
    _kbOpen = null;
  } else {
    _kbEdit = null;
    _kbOpen = id && kbFind(id) && kbCanRead(kbFind(id)) ? id : null;
  }
}
function kbNavLabel(v, id) {
  var parts = String(v || '').split('/'), t = KB_TABS.find(function(x) { return x[0] === parts[0]; }), a = id && kbFind(id);
  return { sub: [t ? t[1] : 'Start', parts[1] === 'edit' ? (a ? 'Edit' : 'New article') : ''], rec: a && kbCanRead(a) ? a.title : '' };
}
function kbSetTab(t) {
  if (!KB_TABS.some(function(x) { return x[0] === t; })) t = 'start';
  if (t !== _kbTab) _kbTabMoved = true;
  _kbTab = t;
  try { localStorage.setItem(KB_TAB_KEY, t); } catch (e) { /* a per-device convenience only */ }
}
function kbBackBar(title, action) {
  return '<div class="inv-pagehead"><button class="inv-btn inv-btn-ghost inv-btn-sm inv-pagehead-back" data-action="' + (action || 'invKbBack') + '">' + STOCK_BACK_ICON + 'Knowledge</button>' +
    '<h2 class="inv-pagehead-title">' + escHtml(title) + '</h2></div>';
}
function renderKnow() {
  var el = document.getElementById('knowContent');
  if (!el || !S) return;
  kbData();
  var h;
  if (_kbEdit) h = kbFormHtml();
  else if (_kbOpen && !_isDesktop && kbFind(_kbOpen) && kbCanRead(kbFind(_kbOpen))) h = kbBackBar(kbFind(_kbOpen).title || 'Article') + kbArticleHtml(kbFind(_kbOpen));
  else {
    if (_kbOpen && !(kbFind(_kbOpen) && kbCanRead(kbFind(_kbOpen)))) _kbOpen = null;
    h = '<div class="inv-viewtabs" role="tablist" aria-label="Knowledge">' + KB_TABS.map(function(t) {
      return '<button class="inv-viewtab" role="tab" aria-selected="' + (_kbTab === t[0]) + '" data-action="invKbTab" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>' + kbToolbarHtml();
    var body = _kbTab === 'library' ? kbLibraryHtml() : _kbTab === 'troubleshoot' ? kbTroubleHtml() : _kbTab === 'records' ? kbRecordsHtml() : _kbTab === 'training' ? kbTrainingHtml() : kbStartHtml();
    if (_isDesktop && _kbTab !== 'start' && _kbTab !== 'training') {
      var open = _kbOpen && kbFind(_kbOpen);
      body = '<div class="inv-pane-host' + (open ? ' inv-pane-open' : '') + '" id="kbHost" data-open="' + (open ? escHtml(open.id) : '') + '"><div class="inv-pane-list">' + body + '</div>' +
        '<div class="inv-pane" id="kbPane">' + (open ? paneHeadHtml('<span class="inv-panel-title">' + escHtml(open.title || 'Article') + '</span>', 'invKbClose') + kbArticleHtml(open) : '') + '</div></div>';
    }
    h += body;
  }
  paneScrollKeep(function() { el.innerHTML = h; });
  viewTabReveal(el.querySelector('.inv-viewtabs'));
  kbFillImages(el);
  if (_kbTabMoved) { _kbTabMoved = false; viewTop(); }
}
function kbToolbarHtml() {
  var w = kbCanWrite(), prim = _kbTab === 'troubleshoot' ? 'incident' : _kbTab === 'training' ? 'train' : 'write';
  var b = function(kind, label, act, extra) { return '<button class="inv-btn inv-btn-' + (kind === prim ? 'primary' : 'secondary') + '" data-action="' + act + '"' + (extra || '') + '>' + label + '</button>'; };
  var h = '<div class="inv-toolbar">';
  if (w) {
    h += b('write', 'Write', 'invKbNew', _kbTab === 'troubleshoot' ? ' data-kind="fault"' : _kbTab === 'records' ? ' data-kind="ruling"' : '');
    if (_kbTab === 'troubleshoot') h += b('incident', 'Log an incident', 'invKbNew', ' data-kind="incident"');
    if (_kbTab === 'training' && typeof grdCan === 'function' && grdCan('floor')) h += b('train', 'Record training', 'invKbTrain');
  }
  if (_kbTab === 'library' && kbIsOwner()) h += '<button class="inv-btn inv-btn-ghost" data-action="invKbExport">Export</button><button class="inv-btn inv-btn-ghost" data-action="invKbImport">Import</button>';
  return h + '</div>';
}

/* Start: what needs you, then what changed. */
function kbStartHtml() {
  var all = kbReadable(), own = all.filter(function(a) { return a.src !== 'build'; }), h = '';
  if (kbIsOwner()) {
    var wait = own.filter(function(a) { return a.status === 'pending' || (a.status === 'published' && a.pending); });
    if (wait.length) h += '<div class="inv-panel inv-panel-flush" id="kbWaiting"><div class="inv-panel-head"><span class="inv-panel-title">Waiting for your approval <span class="inv-panel-count">' + wait.length + '</span></span></div>' + wait.map(kbRowHtml).join('') + '</div>';
    var drafts = own.filter(function(a) { return a.status === 'draft'; });
    if (drafts.length) h += '<div class="inv-panel inv-panel-flush" id="kbDrafts"><div class="inv-panel-head"><span class="inv-panel-title">Drafts to review <span class="inv-panel-count">' + drafts.length + '</span></span>' +
      '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbShowDrafts">See all</button></div>' + uiMoreHtml('kb-drafts', drafts.map(kbRowHtml), { n: 10, noun: 'drafts' }) + '</div>';
  } else {
    var mine = own.filter(function(a) { return kbMine(a) && (a.status === 'draft' || a.status === 'pending' || a.pending); });
    if (mine.length) h += '<div class="inv-panel inv-panel-flush" id="kbMine"><div class="inv-panel-head"><span class="inv-panel-title">What you wrote <span class="inv-panel-count">' + mine.length + '</span></span></div>' + mine.map(kbRowHtml).join('') + '</div>';
  }
  var due = all.filter(kbReviewDue);
  if (due.length) h += '<div class="inv-panel inv-panel-flush" id="kbReviewDue"><div class="inv-panel-head"><span class="inv-panel-title">Decisions to review <span class="inv-panel-count">' + due.length + '</span></span></div>' + due.map(kbRowHtml).join('') + '</div>';
  var again = kbDueAgain().filter(function(x) { return kbCanRead(x.a); });
  if (again.length) h += '<div class="inv-callout inv-callout-warning" id="kbTrainDue">' + escHtml(todoPlural(again.length, 'training') + ' due again: the lesson changed since it was given.') +
    ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbTab" data-tab="training">Open Training</button></div>';
  var paths = kbPaths().filter(function(p) { var u = typeof grdUser === 'function' && grdUser(); return !u || !p.role || p.role === u.role || u.role === 'owner'; });
  if (paths.length) h += '<div class="inv-panel inv-panel-flush" id="kbPathsStart"><div class="inv-panel-head"><span class="inv-panel-title">Start here</span></div>' + paths.map(function(p) {
    var arts = kbPathArticles(p);
    return '<div class="inv-row"><button class="inv-row-main" data-action="invKbPath" data-id="' + escHtml(p.id) + '"><span class="inv-row-title">' + escHtml(p.title) + '</span><span class="inv-row-meta">' +
      escHtml(todoPlural(arts.length, 'lesson') + (arts[0] ? ' · first: ' + arts[0].title : '')) + '</span></button></div>';
  }).join('') + '</div>';
  var recent = own.filter(function(a) { return kbLive(a); }).sort(function(x, y) { return (y.approvedAt || y.at || 0) - (x.approvedAt || x.at || 0); }).slice(0, 8);
  h += '<div class="inv-panel inv-panel-flush" id="kbRecent"><div class="inv-panel-head"><span class="inv-panel-title">Latest</span></div>' +
    (recent.length ? recent.map(kbRowHtml).join('') : '<div class="inv-empty">Nothing written yet. Write the first article, or import the drafts from soma-internal (Library → Import). The app&rsquo;s own guides are in the Library.</div>') + '</div>';
  return h;
}

/* The library: every article the role reads, searched and filtered. */
function kbFiltered(list) {
  var f = _kbFilter, q = String(f.q || '').trim().toLowerCase(), words = q ? q.split(/\s+/) : [];
  return list.filter(function(a) {
    if (f.kind && a.kind !== f.kind) return false;
    if (f.status === 'draft' && !(a.status === 'draft' || a.status === 'pending' || a.pending)) return false;
    if (!f.status && (a.status === 'retired' || a.status === 'superseded') && !q) return false;
    if (f.link && !(a.links || []).some(function(l) { return l.type === f.link.type && (String(l.id) === String(f.link.id) || (!!f.link.label && String(l.label || '').toUpperCase() === String(f.link.label).toUpperCase())); })) return false;
    if (!words.length) return true;
    var t = kbPlain(a).toLowerCase();
    return words.every(function(w) { return t.indexOf(w) >= 0; });
  });
}
function kbChipsHtml(kinds, attr) {
  var cur = _kbFilter.kind;
  return '<div class="inv-toolbar">' + [['', 'All']].concat(kinds.map(function(k) { return [k, kbKindName(k, true)]; })).map(function(k) {
    return '<button class="inv-chip' + (cur === k[0] ? ' inv-chip-on' : '') + '" aria-pressed="' + (cur === k[0]) + '" data-action="invKbKind" data-kind="' + k[0] + '"' + (attr || '') + '>' + escHtml(k[1]) + '</button>';
  }).join('') + (kbIsOwner() || kbCanWrite() ? '<button class="inv-chip' + (_kbFilter.status === 'draft' ? ' inv-chip-on' : '') + '" aria-pressed="' + (_kbFilter.status === 'draft') + '" data-action="invKbDrafts">Drafts and waiting</button>' : '') + '</div>';
}
function kbSearchHtml(ph) {
  return '<div class="inv-toolbar"><label class="inv-search">' + ICON_SEARCH + '<input type="search" id="kbSearch" data-kb-q value="' + escHtml(_kbFilter.q || '') + '" placeholder="' + escHtml(ph) + '" autocomplete="off" aria-label="Search the knowledge base"></label></div>';
}
function kbLibraryHtml() {
  var list = kbFiltered(kbReadable()), h = kbSearchHtml('Search articles') + kbChipsHtml(KB_KINDS.map(function(k) { return k[0]; }));
  if (_kbFilter.link) h += '<div class="inv-callout inv-callout-info" id="kbLinkFilter">' + escHtml('Linked to ' + kbLinkName(_kbFilter.link)) + ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbLinkClear">Show all</button></div>';
  h += '<div class="inv-panel inv-panel-flush" id="kbLibrary"><div class="inv-panel-head"><span class="inv-panel-title">Articles <span class="inv-panel-count">' + list.length + '</span></span></div>';
  if (!list.length) h += '<div class="inv-empty">' + (kbReadable().length ? 'Nothing matches.' : 'Nothing here yet.') + '</div>';
  var rows = [];
  KB_KINDS.forEach(function(k) {
    var of = list.filter(function(a) { return a.kind === k[0]; }).sort(function(x, y) { return String(x.title).localeCompare(String(y.title)); });
    if (!of.length) return;
    rows.push({ head: true, parts: ['<div class="inv-row-group"><span>' + escHtml(k[2]) + '</span><span>' + of.length + '</span></div>'] });
    of.forEach(function(a) { rows.push(kbRowHtml(a)); });
  });
  return h + uiMoreHtml('kb-lib', rows, { n: 60, noun: 'articles' }) + '</div>';
}
/* Troubleshoot: faults by symptom, each with its incidents; then the latest incidents. */
function kbTroubleHtml() {
  var all = kbReadable(), faults = kbFiltered(all.filter(function(a) { return a.kind === 'fault'; })), h = kbSearchHtml('What do you see? Dull, peeling, white rust…');
  h += '<div class="inv-panel inv-panel-flush" id="kbFaults"><div class="inv-panel-head"><span class="inv-panel-title">Faults <span class="inv-panel-count">' + faults.length + '</span></span></div>' +
    (faults.length ? faults.sort(function(x, y) { return String(x.symptom || x.title).localeCompare(String(y.symptom || y.title)); }).map(function(a) {
      var n = all.filter(function(i) { return i.kind === 'incident' && i.faultId === a.id && i.status !== 'retired'; }).length;
      return '<div class="inv-row' + (_kbOpen === a.id ? ' inv-row-selected' : '') + '" data-kb-row="' + escHtml(a.id) + '"><button class="inv-row-main" data-action="invKbOpen" data-id="' + escHtml(a.id) + '"><span class="inv-row-title">' + escHtml(a.symptom || a.title) + '</span>' +
        '<span class="inv-row-meta">' + escHtml([a.symptom ? a.title : '', todoPlural((a.causes || []).length, 'cause'), n ? todoPlural(n, 'incident') : ''].filter(Boolean).join(' · ')) + '</span></button>' +
        '<span class="inv-row-end">' + (a.status === 'published' ? '' : kbStatusHtml(a)) + '</span></div>';
    }).join('') : '<div class="inv-empty">No fault written yet' + (_kbFilter.q ? ' for that' : '') + '.</div>') + '</div>';
  var inc = all.filter(function(a) { return a.kind === 'incident' && a.status !== 'retired'; }).sort(function(x, y) { return String(kbDayOf(y)).localeCompare(String(kbDayOf(x))); });
  h += '<div class="inv-panel inv-panel-flush" id="kbIncidents"><div class="inv-panel-head"><span class="inv-panel-title">Incidents <span class="inv-panel-count">' + inc.length + '</span></span></div>' +
    (inc.length ? uiMoreHtml('kb-inc', inc.map(kbRowHtml), { noun: 'incidents' }) : '<div class="inv-empty">No incident logged yet. Log one when something goes wrong: what, when, which part, the cause and the fix.</div>') + '</div>';
  return h;
}
/* Records: rulings, incidents and decisions by the day they are about. */
function kbRecordsHtml() {
  var kinds = ['ruling', 'requirement', 'incident', 'decision'];
  var list = kbFiltered(kbReadable().filter(function(a) { return kinds.indexOf(a.kind) >= 0; })).sort(function(x, y) { return String(kbDayOf(y)).localeCompare(String(kbDayOf(x))); });
  var h = kbSearchHtml('Search the records') + kbChipsHtml(kinds);
  h += '<div class="inv-panel inv-panel-flush" id="kbRecords"><div class="inv-panel-head"><span class="inv-panel-title">Records <span class="inv-panel-count">' + list.length + '</span></span></div>';
  if (!list.length) h += '<div class="inv-empty">No record yet.</div>';
  var rows = [], last = '';
  list.forEach(function(a) {
    var m = String(kbDayOf(a)).slice(0, 7);
    if (m !== last) { last = m; rows.push({ head: true, parts: ['<div class="inv-row-group"><span>' + escHtml(m ? billsMonthLabel(m) : 'Undated') + '</span></div>'] }); }
    rows.push(kbRowHtml(a));
  });
  return h + uiMoreHtml('kb-rec', rows, { n: 40, noun: 'records' }) + '</div>';
}
/* Training: each path, and the roster against it. */
function kbTrainingHtml() {
  var paths = kbPaths(), roster = staffActive(), h = '';
  if (!paths.length) h += '<div class="inv-empty">No training path yet.</div>';
  paths.forEach(function(p) {
    var arts = kbPathArticles(p);
    var who = roster.filter(function(w) { return !p.role || p.role === 'floor' ? w.floor !== false : true; });
    h += '<div class="inv-panel inv-panel-flush" data-kb-path="' + escHtml(p.id) + '"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(p.title) + ' <span class="inv-panel-count">' + arts.length + '</span></span></div>' +
      (arts.length ? arts.map(function(a, i) {
        var done = 0, due = 0;
        roster.forEach(function(w) { var st = kbTrainState(w.id, a).state; if (st === 'yes') done++; else if (st === 'due') due++; });
        return '<div class="inv-row"><button class="inv-row-main" data-action="invKbOpen" data-id="' + escHtml(a.id) + '"><span class="inv-row-title">' + (i + 1) + '. ' + escHtml(a.title) + '</span>' +
          '<span class="inv-row-meta">' + escHtml(kbKindName(a.kind) + ' · v' + kbVer(a) + (roster.length ? ' · trained ' + done + ' of ' + roster.length : '')) + '</span></button>' +
          '<span class="inv-row-end">' + (due ? '<span class="inv-dot inv-dot-warning">' + due + ' due again</span>' : '') + '</span></div>';
      }).join('') : '<div class="inv-empty">None of this path&rsquo;s lessons is published yet.</div>') + '</div>';
    void who;
  });
  // The roster against every lesson given.
  var lessons = kbReadable().filter(kbIsLesson);
  h += '<div class="inv-panel inv-panel-flush" id="kbRoster"><div class="inv-panel-head"><span class="inv-panel-title">The roster <span class="inv-panel-count">' + roster.length + '</span></span></div>';
  if (!roster.length) h += '<div class="inv-empty">Nobody on the roster yet.</div>';
  h += uiMoreHtml('kb-roster', roster.map(function(w) {
    var yes = 0, due = 0;
    lessons.forEach(function(a) { var st = kbTrainState(w.id, a).state; if (st === 'yes') yes++; else if (st === 'due') due++; });
    return '<div class="inv-row"><button class="inv-row-main" data-action="invKbTrain" data-staff="' + escHtml(String(w.id)) + '"><span class="inv-row-title">' + escHtml(w.name) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(areaLabel(w.homeArea || w.area || '') + ' · trained on ' + yes + ' of ' + lessons.length) + '</span></button>' +
      '<span class="inv-row-end">' + (due ? '<span class="inv-dot inv-dot-warning">' + due + ' due again</span>' : yes ? '<span class="inv-dot inv-dot-ok">' + yes + '</span>' : '') + '</span></div>';
  }), { noun: 'hands' }) + '</div>';
  var log = kbData().trained.filter(function(t) { return !t.voidedAt; }).sort(function(x, y) { return y.at - x.at; });
  if (log.length) h += uiFoldHtml('kb-trainlog', '<span class="inv-panel-title">Training given <span class="inv-panel-count">' + log.length + '</span></span>', uiMoreHtml('kb-trainlog', log.map(function(t) {
    var a = kbFind(t.articleId);
    return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml((t.name || '') + ' · ' + (a ? a.title : 'an article no longer here')) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(formatDate(t.on || isoOf(new Date(t.at))) + ' · v' + (t.v || 1) + (t.by ? ' · by ' + t.by : '') + (t.score != null ? ' · check ' + t.score : '') + (t.note ? ' · ' + t.note : '')) + '</span></span></div>';
  }), { noun: 'records' }), false);
  return h;
}

/* ---------- One article ---------- */
function kbKvHtml(rows) {
  rows = rows.filter(function(r) { return r && r[1] != null && r[1] !== ''; });
  return rows.length ? '<div class="inv-kv">' + rows.map(function(r) { return '<div' + (r[2] ? ' class="inv-kv-wide"' : '') + '><div class="inv-kv-k">' + escHtml(r[0]) + '</div><div>' + (r[3] ? r[1] : escHtml(String(r[1]))) + '</div></div>'; }).join('') + '</div>' : '';
}
function kbArticleHtml(a) {
  var own = a.src !== 'build', h = '<div class="inv-panel" data-kb-article="' + escHtml(a.id) + '"><div class="inv-panel-body">' +
    '<div class="inv-kb-badges"><span class="inv-badge inv-badge-neutral">' + escHtml(kbKindName(a.kind)) + '</span> ' + kbStatusHtml(a) + '</div>' +
    (a.summary ? '<p class="inv-kb-summary">' + escHtml(a.summary) + '</p>' : '') + '</div>';
  var meta = [];
  if (a.kind === 'ruling') meta.push(['Ruled by', a.ruledBy], ['Ruled on', a.ruledOn ? formatDate(a.ruledOn) : '']);
  if (a.kind === 'incident') meta.push(['Day', a.on ? formatDate(a.on) : ''], ['Fault', a.faultId && kbFind(a.faultId) ? kbFind(a.faultId).title : '']);
  if (a.kind === 'decision') meta.push(['Decided', a.chosen != null && a.options && a.options[a.chosen] ? a.options[a.chosen].label : 'Not yet'], ['Decided on', a.decidedOn ? formatDate(a.decidedOn) : ''], ['Review on', a.reviewOn ? formatDate(a.reviewOn) : '']);
  if (own) meta.push(['Read by', kbRolesText(a)], ['Version', kbVer(a) + (a.approvedAt ? ', ' + formatDate(isoOf(new Date(a.approvedAt))) : '')], ['Written by', a.by || ''], ['Source', a.src === 'import' ? 'soma-internal' + (a.srcRef ? ' · ' + a.srcRef : '') : '']);
  h += kbKvHtml(meta) + '</div>';
  if (a.status === 'superseded' && a.supersededBy) h += '<div class="inv-callout inv-callout-warning">Replaced by a later ruling. <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbOpen" data-id="' + escHtml(a.supersededBy) + '">Open it</button></div>';
  if (a.supersedes && kbFind(a.supersedes)) h += '<div class="inv-callout inv-callout-info">Replaces: ' + escHtml(kbFind(a.supersedes).title) + ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbOpen" data-id="' + escHtml(a.supersedes) + '">Open</button></div>';
  if (a.status === 'retired') h += '<div class="inv-callout inv-callout-neutral">Retired' + (a.retiredAt ? ' ' + escHtml(formatDate(isoOf(new Date(a.retiredAt)))) : '') + (a.retireReason ? ': ' + escHtml(a.retireReason) : '') + '</div>';
  if (a.declined && (a.status === 'draft' || !a.pending)) h += '<div class="inv-callout inv-callout-warning">Not approved' + (a.declined.reason ? ': ' + escHtml(a.declined.reason) : '') + '</div>';
  // The kind's own parts.
  if (a.kind === 'fault') {
    if (a.symptom) h += '<div class="inv-callout inv-callout-info"><strong>What you see:</strong> ' + escHtml(a.symptom) + '</div>';
    if ((a.causes || []).length) h += '<div class="inv-panel inv-panel-flush" data-kb-causes><div class="inv-panel-head"><span class="inv-panel-title">Likely causes, most likely first</span></div>' + a.causes.map(function(c, i) {
      return '<div class="inv-row inv-row-auto inv-row-top"><div class="inv-row-main"><div class="inv-row-title">' + (i + 1) + '. ' + escHtml(c.cause || '') + '</div>' +
        (c.check ? '<div class="inv-row-meta inv-row-wrap"><strong>Check:</strong> ' + escHtml(c.check) + '</div>' : '') + (c.fix ? '<div class="inv-row-meta inv-row-wrap"><strong>Fix:</strong> ' + escHtml(c.fix) + '</div>' : '') + '</div></div>';
    }).join('') + '</div>';
    var incs = kbReadable().filter(function(i) { return i.kind === 'incident' && i.faultId === a.id && i.status !== 'retired'; });
    h += '<div class="inv-panel inv-panel-flush" data-kb-fault-incidents><div class="inv-panel-head"><span class="inv-panel-title">Incidents <span class="inv-panel-count">' + incs.length + '</span></span>' +
      (kbCanWrite() ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbIncidentFor" data-id="' + escHtml(a.id) + '">Log one</button>' : '') + '</div>' +
      (incs.length ? incs.map(kbRowHtml).join('') : '<div class="inv-empty">None logged yet.</div>') + '</div>';
  }
  if (a.kind === 'incident') {
    h += kbKvHtml([['Cause found', a.cause, true], ['Fix', a.fix, true]]);
    h += kbDayContextHtml(a);
  }
  if (a.kind === 'decision') h += kbDecisionHtml(a);
  h += kbBodyHtml(a.body);
  h += kbImagesHtml(a.images);
  if ((a.links || []).length) h += '<div class="inv-panel inv-panel-flush" data-kb-links><div class="inv-panel-head"><span class="inv-panel-title">Linked to</span></div><div class="inv-panel-body"><div class="inv-toolbar inv-toolbar-flush">' + a.links.map(function(l, i) {
    return '<button class="inv-chip" data-action="invKbLinkGo" data-id="' + escHtml(a.id) + '" data-i="' + i + '">' + escHtml(kbLinkTypeName(l.type) + ': ' + kbLinkName(l)) + '</button>';
  }).join('') + '</div></div></div>';
  if (a.pending && (kbIsOwner() || kbMine(a) || a.pending.byId === kbMe().id)) h += '<div class="inv-callout inv-callout-warning" data-kb-proposal>A change by ' + escHtml(a.pending.by || 'someone') + ' waits for approval' +
    (a.pending.at ? ' (' + escHtml(formatTimestamp(a.pending.at)) + ')' : '') + '. <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbProposal" data-id="' + escHtml(a.id) + '">See the change</button></div>';
  if (a.kind === 'guide' && (a.quiz || []).length && kbLive(a)) h += '<div class="inv-panel inv-panel-flush" data-kb-quiz><div class="inv-panel-head"><span class="inv-panel-title">Check what was learnt <span class="inv-panel-count">' + a.quiz.length + '</span></span></div>' +
    '<div class="inv-panel-body inv-note">Asked when training is recorded from this article: ' + escHtml(a.quiz.map(function(q) { return q.q; }).join(' · ')) + '</div></div>';
  if ((a.versions || []).length) h += uiFoldHtml('kb-ver-' + a.id, '<span class="inv-panel-title">Earlier versions <span class="inv-panel-count">' + a.versions.length + '</span></span>', a.versions.slice().reverse().map(function(v) {
    return '<div class="inv-row"><button class="inv-row-main" data-action="invKbVersion" data-id="' + escHtml(a.id) + '" data-v="' + v.v + '"><span class="inv-row-title">Version ' + v.v + '</span>' +
      '<span class="inv-row-meta">' + escHtml([v.at ? formatTimestamp(v.at) : '', v.by ? 'by ' + v.by : ''].filter(Boolean).join(' · ')) + '</span></button></div>';
  }).join(''), false);
  h += kbActionsHtml(a);
  return h;
}
function kbLinkTypeName(t) { var x = KB_LINK_TYPES.find(function(r) { return r[0] === t; }); return x ? x[1] : t; }
function kbActionsHtml(a) {
  var own = a.src !== 'build', b = [], owner = kbIsOwner(), w = kbCanWrite();
  if (own && owner && (a.status === 'pending' || a.pending)) b.push(['invKbApprove', 'Approve', 'primary'], ['invKbDecline', 'Decline', 'secondary']);
  if (own && owner && a.status === 'draft') b.push(['invKbPublish', 'Publish', 'primary']);
  if (own && w && a.kind !== 'ruling' && a.status !== 'retired' && a.status !== 'superseded' && !(a.status === 'published' && a.pending && !owner)) b.push(['invKbEdit', a.status === 'published' && !owner ? 'Propose a change' : 'Edit', b.some(function(x) { return x[2] === 'primary'; }) ? 'secondary' : 'primary']);
  if (own && w && a.kind === 'ruling' && (a.status === 'draft' || a.status === 'pending') && (owner || kbMine(a))) b.push(['invKbEdit', 'Edit', b.some(function(x) { return x[2] === 'primary'; }) ? 'secondary' : 'primary']);
  if (own && w && a.kind === 'ruling' && a.status === 'published') b.push(['invKbReplace', 'Replace with a new ruling', 'secondary']);
  if (w && a.kind === 'fault' && kbLive(a)) b.push(['invKbIncidentFor', 'Log an incident', 'secondary']);
  if (kbIsLesson(a) && typeof grdCan === 'function' && grdCan('floor')) b.push(['invKbTrain', 'Record training', 'secondary']);
  if (own && w && a.kind === 'decision' && kbLive(a)) b.push(['invKbReview', 'Record a review', kbReviewDue(a) && !b.some(function(x) { return x[2] === 'primary'; }) ? 'primary' : 'secondary']);
  if (own && owner && a.status === 'published') b.push(['invKbRetire', 'Retire', 'ghost']);
  if (own && (a.status === 'draft' || a.status === 'pending') && !(a.versions || []).length && (owner || kbMine(a))) b.push(['invKbDelete', 'Delete draft', 'ghost']);
  if (!b.length) return '';
  return '<div class="inv-toolbar inv-kb-actions">' + b.map(function(x) { return '<button class="inv-btn inv-btn-' + x[2] + '" data-action="' + x[0] + '" data-id="' + escHtml(a.id) + '">' + x[1] + '</button>'; }).join('') + '</div>';
}

/* A decision: the options, the figures then and now, its reviews. */
function kbDecisionHtml(a) {
  var h = '';
  if (a.question) h += '<div class="inv-callout inv-callout-info"><strong>The question:</strong> ' + escHtml(a.question) + '</div>';
  if ((a.options || []).length) h += '<div class="inv-panel inv-panel-flush" data-kb-options><div class="inv-panel-head"><span class="inv-panel-title">The options</span></div>' + a.options.map(function(o, i) {
    return '<div class="inv-row inv-row-auto inv-row-top"><div class="inv-row-main"><div class="inv-row-title">' + (a.chosen === i ? '<span class="inv-dot inv-dot-ok">' + escHtml(o.label) + ' · chosen</span>' : escHtml(o.label)) + '</div>' +
      (o.case ? '<div class="inv-row-meta inv-row-wrap">' + escHtml(o.case) + '</div>' : '') + '</div></div>';
  }).join('') + '</div>';
  if (a.reason) h += kbKvHtml([['Why', a.reason, true]]);
  var figs = (a.figures || []).filter(function(f) { return kbFigureSees(f.key); });
  if (figs.length) h += '<div class="inv-panel inv-panel-flush" data-kb-figures><div class="inv-panel-head"><span class="inv-panel-title">The figures, then and now</span></div><div class="inv-scroll-x"><table class="inv-table"><thead><tr><th>Figure</th><th class="inv-num">Then</th><th class="inv-num">Now</th></tr></thead><tbody>' +
    figs.map(function(f) {
      var now = kbFigureRead(f);
      return '<tr><td>' + escHtml(kbFigureLabel(f)) + '</td><td class="inv-num">' + escHtml(f.then ? f.then.text : '—') + '</td><td class="inv-num">' + escHtml(now ? now.text : '—') + '</td></tr>';
    }).join('') + '</tbody></table></div><div class="inv-note inv-panel-body">Then: when the decision was recorded' + (a.figuresAt ? ', ' + escHtml(formatDate(isoOf(new Date(a.figuresAt)))) : '') + '. Now: read from the book as it stands.</div></div>';
  if ((a.reviewed || []).length) h += '<div class="inv-panel inv-panel-flush" data-kb-reviews><div class="inv-panel-head"><span class="inv-panel-title">Reviews <span class="inv-panel-count">' + a.reviewed.length + '</span></span></div>' + a.reviewed.map(function(r) {
    return '<div class="inv-row inv-row-auto inv-row-top"><div class="inv-row-main"><div class="inv-row-title">' + escHtml(formatDate(isoOf(new Date(r.at))) + (r.by ? ' · ' + r.by : '') + (r.verdict ? ' · ' + r.verdict : '')) + '</div>' +
      (r.note ? '<div class="inv-row-meta inv-row-wrap">' + escHtml(r.note) + '</div>' : '') + '</div></div>';
  }).join('') + '</div>';
  return h;
}

/* An incident's day, as the book has it: what was plated and by whom, what went into the baths, power cuts, attendance.
   Read each time, never copied (K3). */
function kbDayContextHtml(a) {
  var d = a.on;
  if (!d) return '';
  var rows = [], part = String((a.links || []).filter(function(l) { return l.type === 'part'; }).map(function(l) { return l.label || l.id; })[0] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  var line = (a.links || []).filter(function(l) { return l.type === 'line'; }).map(function(l) { return l.id; })[0] || '';
  try {
    prodIndex().live.filter(function(e) { return e.date === d && e.kind === 'plated'; }).forEach(function(e) {
      var p = String((e.part || '') + (e.partNumber || '')).toUpperCase().replace(/[^A-Z0-9]/g, '');
      var match = (part && p.indexOf(part) >= 0) || (line && e.line === line);
      if (!match && (part || line)) return;
      var crew = prodCrew(e);
      rows.push({ k: 'Plated', t: (e.time || '') + ' · ' + prodLineName(e.line) + ' · ' + prodEntryTitle(e) + ' · ' + prodQtyText(e.qty, e.unit) + (crew && crew.names && crew.names.length ? ' · ' + crew.names.join(', ') : '') });
    });
  } catch (e) { /* production not readable: left out */ }
  try {
    stockData().entries.filter(function(e) { return e.date === d && !e.voided && (e.kind === 'received' || e.kind === 'charged' || e.kind === 'used'); }).forEach(function(e) {
      var it = stockItem(e.itemId);
      rows.push({ k: { received: 'Stock in', charged: 'Into the bath', used: 'Used' }[e.kind], t: (it ? it.name : 'a stock line') + ' · ' + stockFmtQty(e.qty) + ' ' + (it ? it.unit || '' : '') });
    });
  } catch (e) { /* stock not readable */ }
  try {
    prodDowntimeDay(d).forEach(function(c) { rows.push({ k: 'Power cut', t: (c.time || '?') + ' to ' + (c.to || 'not back') }); });
  } catch (e) { /* power not readable */ }
  try {
    var rec = (S.attendance || {})[d];
    if (rec && rec.marks) { var on = Object.keys(rec.marks).filter(function(k) { var m = rec.marks[k]; return m && (m.s === 'P' || m.s === 'H' || m.state === 'P' || m.state === 'H'); }).length; rows.push({ k: 'On site', t: String(on) }); }
  } catch (e) { /* attendance not readable */ }
  return '<div class="inv-panel inv-panel-flush" data-kb-day><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml('That day in the book, ' + formatDate(d)) + '</span></div>' +
    (rows.length ? rows.slice(0, 40).map(function(r) { return '<div class="inv-row inv-row-auto inv-row-top"><div class="inv-row-main"><div class="inv-row-title">' + escHtml(r.k) + '</div><div class="inv-row-meta inv-row-wrap">' + escHtml(r.t) + '</div></div></div>'; }).join('')
      : '<div class="inv-empty">Nothing recorded that day' + (part || line ? ' for this part or line' : '') + '.</div>') + '</div>';
}

/* ---------- Writing ---------- */
function kbBlankForm(kind) {
  return { id: null, kind: kind || 'guide', title: '', summary: '', body: '', tags: '', roles: [], links: [], images: [], f: { causes: [{ cause: '', check: '', fix: '' }], options: [{ label: '', case: '' }, { label: '', case: '' }], figures: [], quiz: [] } };
}
function kbFormFrom(a) {
  var src = a.pending && kbIsOwner() ? Object.assign({}, a, a.pending.fields || {}, { title: a.pending.title, summary: a.pending.summary, body: a.pending.body }) : a;
  return { id: a.id, kind: a.kind, title: src.title || '', summary: src.summary || '', body: src.body || '', tags: (src.tags || []).join(', '), roles: (a.roles || []).slice(), links: JSON.parse(JSON.stringify(src.links || [])),
    images: JSON.parse(JSON.stringify(src.images || [])),
    f: { ruledBy: src.ruledBy || '', ruledOn: src.ruledOn || '', supersedes: src.supersedes || '', symptom: src.symptom || '', causes: JSON.parse(JSON.stringify(src.causes && src.causes.length ? src.causes : [{ cause: '', check: '', fix: '' }])),
      on: src.on || '', faultId: src.faultId || '', cause: src.cause || '', fix: src.fix || '', question: src.question || '', options: JSON.parse(JSON.stringify(src.options && src.options.length ? src.options : [{ label: '', case: '' }])),
      chosen: src.chosen != null ? src.chosen : '', reason: src.reason || '', decidedOn: src.decidedOn || '', reviewOn: src.reviewOn || '', figures: JSON.parse(JSON.stringify(src.figures || [])), quiz: JSON.parse(JSON.stringify(src.quiz || [])) } };
}
function kbOpenForm(id, kind, extra) {
  if (!kbCanWrite()) { showToast('Sign in to write', 'warning'); return; }
  var a = id ? kbOwnFind(id) : null;
  _kbEdit = a ? kbFormFrom(a) : kbBlankForm(kind);
  if (extra) Object.keys(extra).forEach(function(k) { if (k === 'f') Object.assign(_kbEdit.f, extra.f); else _kbEdit[k] = extra[k]; });
  _pageTyped = false;
  navOpen({ tab: 'pageKnow', v: _kbTab + '/edit', id: id || '' });
}
function _kbIn(label, key, val, type, opts) {
  opts = opts || {};
  var id = 'kbF_' + key.replace(/[^a-z0-9]/gi, '_');
  if (type === 'textarea') return '<label class="inv-field"><span class="inv-field-label">' + label + '</span><textarea class="inv-textarea" id="' + id + '" data-kb-f="' + key + '" rows="' + (opts.rows || 3) + '"' + (opts.ph ? ' placeholder="' + escHtml(opts.ph) + '"' : '') + '>' + escHtml(val || '') + '</textarea>' + (opts.hint ? '<span class="inv-field-hint">' + opts.hint + '</span>' : '') + '</label>';
  return '<label class="inv-field"><span class="inv-field-label">' + label + '</span><input class="inv-input" id="' + id + '" data-kb-f="' + key + '" type="' + (type || 'text') + '" value="' + escHtml(val == null ? '' : String(val)) + '"' + (opts.ph ? ' placeholder="' + escHtml(opts.ph) + '"' : '') + '>' + (opts.hint ? '<span class="inv-field-hint">' + opts.hint + '</span>' : '') + '</label>';
}
function _kbSel(label, key, val, opts, first) {
  return '<label class="inv-field"><span class="inv-field-label">' + label + '</span><select class="inv-select" id="kbF_' + key.replace(/[^a-z0-9]/gi, '_') + '" data-kb-f="' + key + '">' + (first ? '<option value="">' + escHtml(first) + '</option>' : '') +
    opts.map(function(o) { return '<option value="' + escHtml(String(o[0])) + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + escHtml(o[1]) + '</option>'; }).join('') + '</select></label>';
}
function kbFormHtml() {
  var e = _kbEdit, f = e.f, a = e.id ? kbOwnFind(e.id) : null, owner = kbIsOwner();
  var title = a ? (a.status === 'published' && !owner ? 'Propose a change' : 'Edit ' + kbKindName(e.kind).toLowerCase()) : 'New ' + kbKindName(e.kind).toLowerCase();
  var h = kbBackBar(title, 'invKbFormCancel') + '<div class="inv-panel"><div class="inv-panel-body"><div class="inv-fields">';
  if (!a) h += _kbSel('Kind', 'kind', e.kind, KB_KINDS.map(function(k) { return [k[0], k[1]]; }));
  h += _kbIn('Title', 'title', e.title, 'text', { ph: e.kind === 'fault' ? 'Peeling on clamps after plating' : e.kind === 'ruling' ? 'Overtime for monthly hands' : '' }) +
    _kbIn('In one line', 'summary', e.summary, 'text', { ph: 'What a reader learns here' }) + '</div>';
  if (e.kind === 'ruling') h += '<div class="inv-fields">' + _kbIn('Ruled by', 'f.ruledBy', f.ruledBy || (owner ? 'Owner' : ''), 'text') + _kbIn('Ruled on', 'f.ruledOn', f.ruledOn || localDateStr(), 'date') + '</div>';
  if (e.kind === 'incident') {
    var faults = kbReadable().filter(function(x) { return x.kind === 'fault' && x.status !== 'retired'; });
    h += '<div class="inv-fields">' + _kbIn('The day', 'f.on', f.on || localDateStr(), 'date') + _kbSel('Which fault it was', 'f.faultId', f.faultId, faults.map(function(x) { return [x.id, x.title]; }), 'Not known yet') + '</div>' +
      _kbIn('Cause found', 'f.cause', f.cause, 'textarea', { rows: 2 }) + _kbIn('Fix', 'f.fix', f.fix, 'textarea', { rows: 2 });
  }
  if (e.kind === 'fault') {
    h += _kbIn('What you see', 'f.symptom', f.symptom, 'text', { ph: 'The deposit peels off in flakes' }) + '<div class="inv-panel inv-panel-flush" data-kb-form-causes><div class="inv-panel-head"><span class="inv-panel-title">Likely causes, most likely first</span>' +
      '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbRowAdd" data-list="causes">Add a cause</button></div>' + f.causes.map(function(c, i) {
        return '<div class="inv-panel-body"><div class="inv-fields">' + _kbIn((i + 1) + '. Cause', 'f.causes.' + i + '.cause', c.cause) + _kbIn('Check', 'f.causes.' + i + '.check', c.check) + _kbIn('Fix', 'f.causes.' + i + '.fix', c.fix) + '</div>' +
          (f.causes.length > 1 ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbRowDel" data-list="causes" data-i="' + i + '">Remove</button>' : '') + '</div>';
      }).join('') + '</div>';
  }
  if (e.kind === 'decision') {
    h += _kbIn('The question', 'f.question', f.question, 'text', { ph: 'Reprice SSS Mehta, or keep the rate?' }) + '<div class="inv-panel inv-panel-flush" data-kb-form-options><div class="inv-panel-head"><span class="inv-panel-title">The options</span>' +
      '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbRowAdd" data-list="options">Add an option</button></div>' + f.options.map(function(o, i) {
        return '<div class="inv-panel-body"><div class="inv-fields">' + _kbIn('Option ' + (i + 1), 'f.options.' + i + '.label', o.label) + _kbIn('The case for it', 'f.options.' + i + '.case', o.case) + '</div>' +
          (f.options.length > 1 ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbRowDel" data-list="options" data-i="' + i + '">Remove</button>' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="inv-fields">' + _kbSel('Decided', 'f.chosen', f.chosen, f.options.map(function(o, i) { return [i, o.label || 'Option ' + (i + 1)]; }), 'Not yet') + _kbIn('Decided on', 'f.decidedOn', f.decidedOn, 'date') + _kbIn('Review on', 'f.reviewOn', f.reviewOn, 'date', { hint: 'The To-do asks for the review on this day.' }) + '</div>' +
      _kbIn('Why', 'f.reason', f.reason, 'textarea', { rows: 2 });
    var figKeys = Object.keys(KB_FIGURES).filter(kbFigureSees);
    h += '<div class="inv-panel inv-panel-flush" data-kb-form-figures><div class="inv-panel-head"><span class="inv-panel-title">Figures to keep with it</span></div>' +
      (f.figures.length ? f.figures.map(function(g, i) { return '<div class="inv-row"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(kbFigureLabel(g)) + '</span></span><span class="inv-row-end"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbRowDel" data-list="figures" data-i="' + i + '">Remove</button></span></div>'; }).join('') : '') +
      '<div class="inv-panel-body"><div class="inv-fields">' + _kbSel('Figure', 'figKey', '', figKeys.map(function(k) { return [k, KB_FIGURES[k].label]; }), 'Pick a figure') +
      _kbSel('Client (where the figure is one client’s)', 'figClient', '', (S.clients || []).slice().sort(function(x, y) { return String(x.name).localeCompare(String(y.name)); }).map(function(c) { return [c.id, c.name]; }), 'None') + '</div>' +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invKbFigAdd">Add the figure</button><div class="inv-note">Each is read when the decision is saved and kept, so a review shows it then beside now.</div></div></div>';
  }
  h += _kbIn(e.kind === 'guide' ? 'The steps' : e.kind === 'ruling' ? 'The ruling, the reason, examples' : 'The text', 'body', e.body, 'textarea', { rows: 10, wide: true,
    hint: 'A blank line starts a paragraph. A line starting "- " is a list, "# " a heading, **two stars** around words make them bold.' });
  if (e.kind === 'guide') {
    h += '<div class="inv-panel inv-panel-flush" data-kb-form-quiz><div class="inv-panel-head"><span class="inv-panel-title">A short check (optional)</span><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbRowAdd" data-list="quiz">Add a question</button></div>' +
      f.quiz.map(function(q, i) {
        return '<div class="inv-panel-body"><div class="inv-fields">' + _kbIn('Question ' + (i + 1), 'f.quiz.' + i + '.q', q.q) + _kbIn('Answers, separated by /', 'f.quiz.' + i + '.opts', (q.options || []).join(' / ')) +
          _kbIn('The right answer (its number)', 'f.quiz.' + i + '.answer', q.answer != null ? q.answer + 1 : '', 'number') + '</div><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbRowDel" data-list="quiz" data-i="' + i + '">Remove</button></div>';
      }).join('') + '</div>';
  }
  // Photos
  h += '<div class="inv-panel inv-panel-flush" data-kb-form-images><div class="inv-panel-head"><span class="inv-panel-title">Photos <span class="inv-panel-count">' + e.images.length + '</span></span>' +
    '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbPhoto">Add a photo</button></div>' +
    e.images.map(function(im, i) {
      return '<div class="inv-panel-body">' + kbImagesHtml([{ id: im.id, w: im.w, h: im.h }]) + '<div class="inv-fields">' + _kbIn('Caption', 'img.' + i, im.caption) + '</div>' +
        '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbRowDel" data-list="images" data-i="' + i + '">Remove</button></div>';
    }).join('') + '<div class="inv-panel-body inv-note">Kept on this device only: another device shows the article without it.</div>' +
    '<input type="file" accept="image/*" id="kbPhotoInput" class="inv-hidden" multiple></div>';
  // Links
  h += '<div class="inv-panel inv-panel-flush" data-kb-form-links><div class="inv-panel-head"><span class="inv-panel-title">Linked to <span class="inv-panel-count">' + e.links.length + '</span></span></div>' +
    (e.links.length ? '<div class="inv-panel-body"><div class="inv-toolbar inv-toolbar-flush">' + e.links.map(function(l, i) {
      return '<button class="inv-chip inv-chip-on" data-action="invKbRowDel" data-list="links" data-i="' + i + '" aria-label="' + escHtml('Remove ' + kbLinkName(l)) + '">' + escHtml(kbLinkTypeName(l.type) + ': ' + kbLinkName(l)) + ' &times;</button>';
    }).join('') + '</div></div>' : '') +
    '<div class="inv-panel-body"><div class="inv-fields">' + _kbSel('Link to', 'linkType', e.linkType || 'client', KB_LINK_TYPES) + kbLinkPickHtml(e.linkType || 'client') + '</div>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invKbLinkAdd">Add the link</button><div class="inv-note">The article shows on that record&rsquo;s screen.</div></div></div>';
  // Who reads it
  h += '<div class="inv-panel inv-panel-flush" data-kb-form-roles><div class="inv-panel-head"><span class="inv-panel-title">Who reads it</span></div><div class="inv-panel-body">' +
    '<label class="inv-field-check"><input type="checkbox" checked disabled> Owner</label>' + KB_READ_ROLES.map(function(r) {
      var on = !e.roles.length || e.roles.indexOf(r) >= 0;
      return '<label class="inv-field-check"><input type="checkbox" data-kb-role="' + r + '"' + (on ? ' checked' : '') + '> ' + escHtml(grdRoleName(r)) + '</label>';
    }).join('') + '<div class="inv-note">All ticked: everyone reads it.</div></div></div>';
  h += _kbIn('Tags, separated by commas', 'tags', e.tags, 'text', { ph: 'pickling, safety' });
  h += '</div>';
  var send = owner ? 'Publish' : 'Send for approval';
  h += '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">' + escHtml(owner ? 'Published at once' : 'The owner approves it first') + '</div><div class="inv-actionbar-value">' + escHtml(kbKindName(e.kind)) + '</div></div>' +
    ((!a || a.status === 'draft' || a.status === 'pending') ? '<button class="inv-btn inv-btn-secondary" data-action="invKbSaveDraft">Save draft</button>' : '') +
    '<button class="inv-btn inv-btn-primary" data-action="invKbSave">' + send + '</button></div>';
  return h;
}
function kbLinkPickHtml(type) {
  var opts = null;
  if (type === 'client') opts = (S.clients || []).slice().sort(function(x, y) { return String(x.name).localeCompare(String(y.name)); }).map(function(c) { return [c.id, c.name]; });
  else if (type === 'area') opts = STAFF_AREAS.map(function(x) { return [x.id, x.label]; });
  else if (type === 'line') opts = KB_LINES;
  else if (type === 'stock') opts = stockData().items.map(function(i) { return [i.id, i.name]; });
  else if (type === 'screen') opts = Object.keys(PAGE_TITLES).filter(function(k) { return k !== 'pageKnow'; }).map(function(k) { return [k, wsPageName(k)]; });
  else if (type === 'worker') opts = staffActive().map(function(w) { return [w.id, w.name]; });
  else if (type === 'article') opts = kbReadable().filter(function(x) { return !_kbEdit || x.id !== _kbEdit.id; }).map(function(x) { return [x.id, x.title]; });
  if (opts) return _kbSel('Which', 'linkId', '', opts, 'Pick one');
  // A part: its number as written (a part the Items Master does not hold still links by name).
  return '<label class="inv-field"><span class="inv-field-label">Part number or name</span><input class="inv-input" id="kbF_linkId" data-kb-f="linkId" list="kbPartList" value=""><datalist id="kbPartList">' +
    (S.items || []).slice(0, 600).map(function(p) { return '<option value="' + escHtml(p.partNumber || '') + '">'; }).join('') + '</datalist></label>';
}
/* A field typed into the form: written into _kbEdit as it is, nothing redrawn (the field keeps its caret). */
function kbFormInput(el) {
  var e = _kbEdit, k = el.getAttribute('data-kb-f');
  if (!e || !k) return;
  var v = el.value;
  if (k === 'kind') { e.kind = v; kbRedrawForm(); return; }
  if (k === 'linkType') { e.linkType = v; kbRedrawForm(); return; }
  if (k === 'linkId' || k === 'figKey' || k === 'figClient') { e['_' + k] = v; return; }
  if (/^img\.\d+$/.test(k)) { var im = e.images[+k.split('.')[1]]; if (im) im.caption = v; return; }
  var p = k.split('.');
  if (p[0] !== 'f') { e[k] = v; return; }
  if (p.length === 2) { e.f[p[1]] = p[1] === 'chosen' ? (v === '' ? '' : +v) : v; return; }
  var row = (e.f[p[1]] || [])[+p[2]];
  if (!row) return;
  if (p[1] === 'quiz' && p[3] === 'opts') row.options = v.split('/').map(function(s) { return s.trim(); }).filter(Boolean);
  else if (p[1] === 'quiz' && p[3] === 'answer') row.answer = v === '' ? null : Math.max(0, parseInt(v, 10) - 1);
  else row[p[3]] = v;
}
function kbRedrawForm() { keepScroll(renderKnow); }
/* The record as the form says, for a new article or a version. */
function kbFormRecord() {
  var e = _kbEdit, f = e.f, r = { kind: e.kind, title: String(e.title || '').trim(), summary: String(e.summary || '').trim(), body: String(e.body || '').replace(/\s+$/, ''),
    tags: String(e.tags || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean), links: e.links.slice(), images: e.images.slice() };
  if (e.kind === 'ruling') { r.ruledBy = String(f.ruledBy || '').trim(); r.ruledOn = f.ruledOn || ''; if (f.supersedes) r.supersedes = f.supersedes; }
  if (e.kind === 'fault') { r.symptom = String(f.symptom || '').trim(); r.causes = f.causes.filter(function(c) { return (c.cause || '').trim(); }); }
  if (e.kind === 'incident') { r.on = f.on || ''; r.faultId = f.faultId || ''; r.cause = String(f.cause || '').trim(); r.fix = String(f.fix || '').trim(); }
  if (e.kind === 'decision') {
    r.question = String(f.question || '').trim(); r.options = f.options.filter(function(o) { return (o.label || '').trim(); });
    r.chosen = f.chosen === '' || f.chosen == null || !r.options[f.chosen] ? null : +f.chosen; r.reason = String(f.reason || '').trim();
    r.decidedOn = f.decidedOn || ''; r.reviewOn = f.reviewOn || ''; r.figures = f.figures.slice();
  }
  if (e.kind === 'guide') r.quiz = f.quiz.filter(function(q) { return (q.q || '').trim() && (q.options || []).length >= 2 && q.answer != null && q.answer < q.options.length; });
  return r;
}
function kbFormProblem(r) {
  if (!r.title) return 'Give it a title.';
  if (r.kind === 'ruling' && !r.ruledOn) return 'A ruling needs the day it was ruled.';
  if (r.kind === 'fault' && !r.symptom) return 'A fault needs what you see.';
  if (r.kind === 'incident' && !r.on) return 'An incident needs its day.';
  if (r.kind === 'decision' && !r.question) return 'A decision needs its question.';
  return '';
}
var KB_VERSION_FIELDS = ['title', 'summary', 'body', 'tags', 'links', 'images', 'ruledBy', 'ruledOn', 'symptom', 'causes', 'on', 'faultId', 'cause', 'fix', 'question', 'options', 'chosen', 'reason', 'decidedOn', 'reviewOn', 'figures', 'quiz'];
function kbSnapshot(a) {
  var v = { v: kbVer(a), at: a.approvedAt || a.at, by: a.approvedBy || a.by || '' };
  KB_VERSION_FIELDS.forEach(function(k) { if (a[k] !== undefined) v[k] = JSON.parse(JSON.stringify(a[k])); });
  return v;
}
function kbApply(a, r) { KB_VERSION_FIELDS.forEach(function(k) { if (r[k] !== undefined) a[k] = r[k]; }); }
/* Figures a decision keeps: read now where they were not read before. */
function kbFreezeFigures(r) {
  if (r.kind !== 'decision') return;
  var any = false;
  (r.figures || []).forEach(function(g) { if (!g.then) { var now = kbFigureRead(g); g.then = now ? { v: now.v, text: now.text } : null; any = true; } });
  if (any) r.figuresAt = Date.now();
}
function kbSave(asDraft) {
  var e = _kbEdit;
  if (!e) return;
  var r = kbFormRecord(), problem = kbFormProblem(r);
  if (problem && !asDraft) { uiAlert({ title: 'Not saved yet', body: problem }); return; }
  if (!r.title) { uiAlert({ title: 'Not saved yet', body: 'Give it a title.' }); return; }
  var me = kbMe(), owner = kbIsOwner(), now = Date.now(), roles = e.roles.length === KB_READ_ROLES.length ? [] : e.roles.slice();
  var a = e.id ? kbOwnFind(e.id) : null, msg;
  kbFreezeFigures(r);
  if (!a) {
    a = Object.assign({ id: kbUid('kb'), src: 'app', version: 1, versions: [], by: me.name, byId: me.id, at: now, roles: roles }, r);
    a.status = asDraft ? 'draft' : owner ? 'published' : 'pending';
    if (a.status === 'published') { a.approvedBy = me.name; a.approvedAt = now; }
    kbData().articles.push(a);
    if (a.kind === 'ruling' && a.supersedes && a.status === 'published') kbSupersede(a);
    msg = a.status === 'published' ? 'Published' : a.status === 'pending' ? 'Sent to the owner for approval' : 'Draft saved';
  } else if (a.status === 'draft' || a.status === 'pending') {
    kbApply(a, r); a.roles = roles; a.at = now;
    if (r.figuresAt) a.figuresAt = r.figuresAt;
    a.status = asDraft ? 'draft' : owner ? 'published' : 'pending';
    delete a.declined;
    if (a.status === 'published') { a.approvedBy = me.name; a.approvedAt = now; if (a.kind === 'ruling' && a.supersedes) kbSupersede(a); }
    msg = a.status === 'published' ? 'Published' : a.status === 'pending' ? 'Sent to the owner for approval' : 'Draft saved';
  } else if (owner) {
    a.versions = (a.versions || []).concat([kbSnapshot(a)]);
    kbApply(a, r); a.roles = roles; a.version = kbVer(a) + 1; a.approvedBy = me.name; a.approvedAt = now;
    if (r.figuresAt) a.figuresAt = r.figuresAt;
    delete a.pending;
    msg = 'Saved as version ' + a.version;
  } else {
    a.pending = { by: me.name, byId: me.id, at: now, title: r.title, summary: r.summary, body: r.body, fields: Object.assign({}, r, { roles: roles }) };
    msg = 'Your change waits for the owner';
  }
  _kbEdit = null;
  _pageTyped = false;
  _kbOpen = a.id;
  saveState();
  renderKnow();
  kbNavReplace();
  showToast(msg);
}
/* A ruling replacing another: the old one is kept, marked superseded, both ways linked. */
function kbSupersede(a) {
  var old = kbOwnFind(a.supersedes);
  if (!old || old.id === a.id) return;
  old.status = 'superseded';
  old.supersededBy = a.id;
  old.supersededAt = Date.now();
}
function kbApprove(id) {
  var a = kbOwnFind(id), me = kbMe(), now = Date.now();
  if (!a || !kbIsOwner()) return;
  if (a.status === 'published' && a.pending) {
    var p = a.pending;
    a.versions = (a.versions || []).concat([kbSnapshot(a)]);
    var r = Object.assign({}, p.fields || {}, { title: p.title, summary: p.summary, body: p.body });
    kbApply(a, r);
    if (p.fields && Array.isArray(p.fields.roles)) a.roles = p.fields.roles;
    a.version = kbVer(a) + 1; a.approvedBy = me.name; a.approvedAt = now; a.changedBy = p.by;
    delete a.pending;
  } else if (a.status === 'pending' || a.status === 'draft') {
    a.status = 'published'; a.approvedBy = me.name; a.approvedAt = now;
    if (a.kind === 'ruling' && a.supersedes) kbSupersede(a);
  } else return;
  saveState();
  renderKnow();
  showToast('Published');
}
async function kbDecline(id) {
  var a = kbOwnFind(id);
  if (!a || !kbIsOwner()) return;
  var why = await uiPrompt({ title: 'Decline', label: 'Why (the writer reads this)', required: true });
  if (!why) return;
  var d = { at: Date.now(), by: kbMe().name, reason: String(why).trim() };
  if (a.status === 'published' && a.pending) { a.declined = Object.assign(d, { change: a.pending }); delete a.pending; }
  else { a.status = 'draft'; a.declined = d; }
  saveState();
  renderKnow();
  showToast('Declined');
}
async function kbRetire(id) {
  var a = kbOwnFind(id);
  if (!a || !kbIsOwner()) return;
  var why = await uiPrompt({ title: 'Retire this article', label: 'Why it no longer holds', required: true });
  if (!why) return;
  a.status = 'retired'; a.retiredAt = Date.now(); a.retireReason = String(why).trim(); a.retiredBy = kbMe().name;
  saveState();
  renderKnow();
  showToast('Retired: it stays in the record');
}
async function kbDeleteDraft(id) {
  var a = kbOwnFind(id);
  if (!a || !(a.status === 'draft' || a.status === 'pending') || (a.versions || []).length) return;
  if (!(await uiConfirm({ title: 'Delete this draft?', body: '"' + (a.title || 'Untitled') + '" was never published. It goes for good.', okLabel: 'Delete', danger: true }))) return;
  kbData().articles = kbData().articles.filter(function(x) { return x.id !== id; });
  if (_kbOpen === id) _kbOpen = null;
  saveState();
  renderKnow();
  kbNavReplace();
  showToast('Draft deleted');
}
function kbShowVersion(id, v) {
  var a = kbFind(id), ver = a && (a.versions || []).find(function(x) { return String(x.v) === String(v); });
  if (!ver) return;
  var shown = Object.assign({}, a, ver, { versions: [], status: 'superseded', pending: null });
  dialogOpen('<div class="inv-dialog inv-dialog-wide">' + dialogHeadHtml(escHtml('Version ' + ver.v + ': ' + (ver.title || a.title))) + '<div class="inv-dialog-main">' +
    '<div class="inv-note">' + escHtml([ver.at ? formatTimestamp(ver.at) : '', ver.by ? 'by ' + ver.by : ''].filter(Boolean).join(' · ')) + '</div>' +
    (ver.summary ? '<p class="inv-kb-summary">' + escHtml(ver.summary) + '</p>' : '') + kbBodyHtml(ver.body) + (shown.causes && shown.kind === 'fault' ? '<div class="inv-note">' + escHtml(shown.causes.map(function(c) { return c.cause; }).join(' · ')) + '</div>' : '') +
    '</div><div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Close</button></div></div>', { dismiss: true });
}
function kbShowProposal(id) {
  var a = kbFind(id), p = a && a.pending;
  if (!p) return;
  var owner = kbIsOwner();
  dialogOpen('<div class="inv-dialog inv-dialog-wide">' + dialogHeadHtml(escHtml('A change to ' + a.title)) + '<div class="inv-dialog-main">' +
    '<div class="inv-note">' + escHtml('By ' + (p.by || 'someone') + ' · ' + formatTimestamp(p.at)) + '</div>' +
    (p.title !== a.title ? kbKvHtml([['Title now', a.title], ['Title proposed', p.title]]) : '') +
    (p.summary !== a.summary ? kbKvHtml([['In one line now', a.summary || '—'], ['Proposed', p.summary || '—']]) : '') +
    '<h3 class="inv-kb-h">Proposed text</h3>' + (kbBodyHtml(p.body) || '<div class="inv-note">No text.</div>') +
    '<h3 class="inv-kb-h">Text now</h3>' + (kbBodyHtml(a.body) || '<div class="inv-note">No text.</div>') +
    '</div><div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Close</button>' +
    (owner ? '<button class="inv-btn inv-btn-secondary" data-action="invKbDecline" data-id="' + escHtml(a.id) + '">Decline</button><button class="inv-btn inv-btn-primary" data-action="invKbApprove" data-id="' + escHtml(a.id) + '">Approve</button>' : '') +
    '</div></div>', { dismiss: true });
}

/* ---------- Training given ---------- */
function kbTrainOpen(articleId, staffId) {
  if (typeof grdCan === 'function' && !grdCan('floor')) { grdRefuse('record training'); return; }
  var lessons = kbReadable().filter(kbIsLesson).sort(function(x, y) { return String(x.title).localeCompare(String(y.title)); });
  if (!lessons.length) { uiAlert({ title: 'No lesson yet', body: 'Training is recorded against a published how-to or process article. Write or publish one first.' }); return; }
  var roster = staffActive();
  if (!roster.length) { uiAlert({ title: 'Nobody on the roster', body: 'Training is recorded against the roster (Floor → People → Roster).' }); return; }
  var pick = articleId ? [articleId] : [];
  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml('Record training') + '<div class="inv-dialog-main"><div class="inv-fields">' +
    '<label class="inv-field"><span class="inv-field-label">Who was trained</span><select class="inv-select" id="kbTrainWho"><option value="">Pick the hand</option>' + roster.map(function(w) {
      return '<option value="' + escHtml(String(w.id)) + '"' + (String(staffId) === String(w.id) ? ' selected' : '') + '>' + escHtml(w.name) + '</option>';
    }).join('') + '</select></label>' +
    '<label class="inv-field"><span class="inv-field-label">On</span><input class="inv-input" type="date" id="kbTrainOn" value="' + localDateStr() + '"></label></div>' +
    '<div class="inv-field"><span class="inv-field-label">Lessons</span>' + lessons.map(function(a) {
      var st = staffId != null ? kbTrainState(staffId, a).state : 'no';
      return '<label class="inv-field-check"><input type="checkbox" data-kb-train-a="' + escHtml(a.id) + '"' + (pick.indexOf(a.id) >= 0 ? ' checked' : '') + '> ' + escHtml(a.title) +
        (st === 'yes' ? ' · trained' : st === 'due' ? ' · due again' : '') + '</label>';
    }).join('') + '</div>' +
    kbQuizHtml(articleId ? kbFind(articleId) : null) +
    '<label class="inv-field"><span class="inv-field-label">Score on the check, if one was asked</span><input class="inv-input" id="kbTrainScore" placeholder="2 of 3"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Note</span><input class="inv-input" id="kbTrainNote"></label></div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invKbTrainSave">Save</button></div></div>', { dismiss: true });
}
/* A lesson's check, asked in the dialog: one question a fieldset of choices. The score is worked out on Save. */
function kbQuizHtml(a) {
  var qz = a && a.kind === 'guide' ? (a.quiz || []) : [];
  if (!qz.length) return '';
  return '<div class="inv-panel inv-panel-flush" data-kb-quiz-ask><div class="inv-panel-head"><span class="inv-panel-title">The check <span class="inv-panel-count">' + qz.length + '</span></span></div>' +
    qz.map(function(q, i) {
      return '<div class="inv-panel-body"><div class="inv-field-label">' + (i + 1) + '. ' + escHtml(q.q) + '</div>' + (q.options || []).map(function(o, j) {
        return '<label class="inv-field-check"><input type="radio" name="kbQ' + i + '" value="' + j + '" data-kb-quiz="' + i + '"> ' + escHtml(o) + '</label>';
      }).join('') + '</div>';
    }).join('') + '</div>';
}
function kbQuizScore(a) {
  var qz = a && a.kind === 'guide' ? (a.quiz || []) : [];
  if (!qz.length || !document.querySelector('[data-kb-quiz]:checked')) return null;
  var right = qz.filter(function(q, i) { var el = document.querySelector('[data-kb-quiz="' + i + '"]:checked'); return el && +el.value === q.answer; }).length;
  return right + ' of ' + qz.length;
}
function kbTrainSave() {
  var who = (document.getElementById('kbTrainWho') || {}).value, w = who && staffById(who);
  var ids = Array.prototype.map.call(document.querySelectorAll('[data-kb-train-a]:checked'), function(el) { return el.getAttribute('data-kb-train-a'); });
  if (!w) { uiAlert({ title: 'Not saved', body: 'Pick who was trained.' }); return; }
  if (!ids.length) { uiAlert({ title: 'Not saved', body: 'Tick the lessons given.' }); return; }
  var asked = ids.length === 1 ? kbQuizScore(kbFind(ids[0])) : null;
  var on = (document.getElementById('kbTrainOn') || {}).value || localDateStr(), score = asked || String((document.getElementById('kbTrainScore') || {}).value || '').trim(), note = String((document.getElementById('kbTrainNote') || {}).value || '').trim();
  var me = kbMe();
  ids.forEach(function(id) {
    var a = kbFind(id);
    if (!a) return;
    kbData().trained.push({ id: kbUid('kt'), staffId: w.id, name: w.name, articleId: a.id, v: kbVer(a), on: on, at: Date.now(), by: me.name, byId: me.id, score: score || null, note: note });
  });
  closeOverlay();
  saveState();
  renderKnow();
  showToast(todoPlural(ids.length, 'lesson') + ' recorded for ' + w.name);
}

/* ---------- A decision's review ---------- */
async function kbReview(id) {
  var a = kbOwnFind(id);
  if (!a) return;
  var note = await uiPrompt({ title: 'Review: ' + (a.question || a.title), label: 'Was it right? What do the figures say now?', required: true });
  if (!note) return;
  a.reviewed = (a.reviewed || []).concat([{ at: Date.now(), by: kbMe().name, note: String(note).trim(), now: (a.figures || []).map(function(g) { var r = kbFigureRead(g); return r ? r.text : null; }) }]);
  saveState();
  renderKnow();
  showToast('Review recorded');
}

/* ---------- Export and import (sep-kb v1) ---------- */
function kbExport() {
  var k = kbData(), out = { format: 'sep-kb', version: 1, exportedAt: new Date().toISOString(), build: (document.querySelector('meta[name="app-build"]') || {}).content || '',
    articles: k.articles, trained: k.trained, paths: k.paths };
  var blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sep-kb-' + localDateStr() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function() { URL.revokeObjectURL(a.href); }, 2000);
  showToast('Exported ' + todoPlural(k.articles.length, 'article'));
}
function kbImport() {
  if (!kbIsOwner()) { grdRefuse('import knowledge'); return; }
  var inp = document.getElementById('kbFileInput');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json'; inp.id = 'kbFileInput'; inp.className = 'inv-hidden';
    document.body.appendChild(inp);
    inp.addEventListener('change', function() {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function() { var obj = null; try { obj = JSON.parse(rd.result); } catch (e) { obj = null; } kbImportData(obj, f.name); inp.value = ''; };
      rd.readAsText(f);
    });
  }
  inp.click();
}
/* Merged by id: a newer version replaces an older one (the older kept in its versions), the same is skipped, an article
   waiting here is kept. Nothing is deleted. Training and paths merge by id too. */
function kbImportData(obj, name) {
  var arts = obj && (Array.isArray(obj) ? obj : obj.format === 'sep-kb' || Array.isArray(obj.articles) ? obj.articles : null);
  if (!Array.isArray(arts)) { uiAlert({ title: 'Not a knowledge file', body: 'The file is not a sep-kb export.' }); return null; }
  var k = kbData(), res = { added: 0, updated: 0, same: 0, refused: 0, trained: 0, paths: 0 };
  var kinds = KB_KINDS.map(function(x) { return x[0]; });
  arts.forEach(function(x) {
    if (!x || typeof x !== 'object' || !x.id || !x.title || kinds.indexOf(x.kind) < 0) { res.refused++; return; }
    var a = JSON.parse(JSON.stringify(x));
    a.id = String(a.id); a.src = a.src === 'app' ? 'app' : 'import'; a.version = a.version || 1;
    if (!KB_STATUS[a.status]) a.status = 'draft';
    if (!Array.isArray(a.versions)) a.versions = [];
    if (!Array.isArray(a.links)) a.links = [];
    if (!Array.isArray(a.roles)) a.roles = [];
    a.images = [];   // photos never travel
    var have = kbOwnFind(a.id);
    if (!have) { k.articles.push(a); res.added++; return; }
    if (kbVer(a) <= kbVer(have) && !(have.status === 'draft' && a.status !== 'draft' && kbVer(a) === kbVer(have))) { res.same++; return; }
    var keep = { pending: have.pending, images: have.images };
    if (have.status !== 'draft' && have.status !== 'pending') a.versions = (have.versions || []).concat([kbSnapshot(have)]).concat(a.versions.filter(function(v) { return v.v > kbVer(have); }));
    Object.keys(have).forEach(function(kk) { delete have[kk]; });
    Object.assign(have, a);
    if (keep.pending) have.pending = keep.pending;
    if (keep.images && keep.images.length) have.images = keep.images;
    res.updated++;
  });
  (obj && Array.isArray(obj.trained) ? obj.trained : []).forEach(function(t) {
    if (t && t.id && t.articleId && !k.trained.some(function(x) { return x.id === t.id; })) { k.trained.push(t); res.trained++; }
  });
  (obj && Array.isArray(obj.paths) ? obj.paths : []).forEach(function(p) {
    if (!p || !p.id || !Array.isArray(p.articles)) return;
    var i = k.paths.findIndex(function(x) { return x.id === p.id; });
    if (i < 0) k.paths.push(p); else k.paths[i] = p;
    res.paths++;
  });
  if (!res.added && !res.updated && !res.trained && !res.paths) { uiAlert({ title: 'Nothing imported', body: 'Every article in ' + (name || 'the file') + ' is already here at that version.' + (res.refused ? ' ' + res.refused + ' could not be read.' : '') }); return res; }
  saveState();
  if (navPageOf() === 'pageKnow') renderKnow();
  showToast([res.added ? res.added + ' added' : '', res.updated ? res.updated + ' updated' : '', res.same ? res.same + ' already here' : '', res.trained ? todoPlural(res.trained, 'training record') : '', res.paths ? todoPlural(res.paths, 'path') : '', res.refused ? res.refused + ' refused' : ''].filter(Boolean).join(' · '));
  return res;
}

/* ---------- Doors from elsewhere ---------- */
/* Opens one article: the desktop's pane on the Library, the phone's own screen. */
function kbOpenArticle(id) {
  var a = kbFind(id);
  if (!a || !kbCanRead(a)) { showToast('That article is not here', 'warning'); return; }
  var tab = _kbTab === 'start' || _kbTab === 'training' ? (a.kind === 'fault' || a.kind === 'incident' ? 'troubleshoot' : ['ruling', 'decision'].indexOf(a.kind) >= 0 ? 'records' : 'library') : _kbTab;
  if (navPageOf() === 'pageKnow' && _kbTab !== tab && !_isDesktop) tab = _kbTab;
  _kbEdit = null;
  navOpen({ tab: 'pageKnow', v: tab, id: a.id });
}
/* The guides for a screen, or the articles on a record: the Library filtered to them. */
function kbOpenFor(type, id, label) {
  _kbFilter = { q: '', kind: '', status: '', link: { type: type, id: id == null ? '' : String(id), label: label || '' } };
  _kbEdit = null; _kbOpen = null;
  navOpen({ tab: 'pageKnow', v: 'library', id: '' });
}
/* The top bar's door: the guides for the screen on show, or Start where none is written. */
function kbHelp() {
  var tab = navPageOf();
  if (tab === 'pageKnow') { kbSetTab('start'); _kbOpen = null; _kbEdit = null; navOpen({ tab: 'pageKnow', v: 'start', id: '' }); return; }
  if (kbLinkedTo('screen', tab).length) kbOpenFor('screen', tab, wsPageName(tab));
  else navOpen({ tab: 'pageKnow', v: 'start', id: '' });
}
function kbLinkGo(id, i) {
  var a = kbFind(id), l = a && (a.links || [])[+i];
  if (!l) return;
  switch (l.type) {
    case 'client': if ((S.clients || []).some(function(c) { return String(c.id) === String(l.id); })) srchGo({ kind: 'client', id: l.id }); else kbOpenFor('client', l.id, l.label); return;
    case 'part': {
      var p = (S.items || []).find(function(x) { return String(x.id) === String(l.id) || String(x.partNumber || '').toUpperCase() === String(l.label || l.id || '').toUpperCase(); });
      if (p) srchGo({ kind: 'part', id: p.id }); else kbOpenFor('part', l.id, l.label);
      return;
    }
    case 'stock': if (stockItem(l.id)) todoGo({ kind: 'stock', id: l.id }); else kbOpenFor('stock', l.id, l.label); return;
    case 'worker': if (staffById(l.id)) srchGo({ kind: 'worker', id: l.id }); return;
    case 'screen': if (isPageId(l.id)) switchTab(l.id); return;
    case 'article': kbOpenArticle(l.id); return;
    case 'area': todoGo({ kind: 'areas' }); return;
    case 'line': prodSetTab('lines'); switchTab('pageProduction'); return;
  }
}

/* ---------- Actions ---------- */
function kbAction(action, btn) {
  var id = btn && btn.dataset ? btn.dataset.id : null;
  switch (action) {
    case 'invKbTab': kbSetTab(btn.dataset.tab); _kbOpen = null; _kbFilter.link = null; navOpen({ tab: 'pageKnow', v: _kbTab, id: '' }); return true;
    case 'invKbOpen': kbOpenArticle(id); return true;
    case 'invKbClose': _kbOpen = null; renderKnow(); return true;
    case 'invKbBack': navBack(); return true;
    case 'invKbNew': kbOpenForm(null, btn.dataset.kind || (_kbFilter.kind || 'guide')); return true;
    case 'invKbEdit': kbOpenForm(id); return true;
    case 'invKbReplace': { var old = kbOwnFind(id); if (old) kbOpenForm(null, 'ruling', { title: old.title, summary: old.summary, body: old.body, links: JSON.parse(JSON.stringify(old.links || [])), roles: (old.roles || []).slice(), f: { supersedes: old.id, ruledOn: localDateStr() } }); return true; }
    case 'invKbIncidentFor': { var fa = kbFind(id); kbOpenForm(null, 'incident', { title: fa ? fa.symptom || fa.title : '', links: fa ? JSON.parse(JSON.stringify((fa.links || []).filter(function(l) { return l.type !== 'article'; }))) : [], f: { faultId: id || '', on: localDateStr() } }); return true; }
    case 'invKbFormCancel': navBack(); return true;
    case 'invKbSave': kbSave(false); return true;
    case 'invKbSaveDraft': kbSave(true); return true;
    case 'invKbRowAdd': {
      var L = btn.dataset.list, f = _kbEdit && _kbEdit.f;
      if (!f) return true;
      if (L === 'causes') f.causes.push({ cause: '', check: '', fix: '' });
      if (L === 'options') f.options.push({ label: '', case: '' });
      if (L === 'quiz') f.quiz.push({ q: '', options: [], answer: null });
      _pageTyped = true;
      kbRedrawForm();
      return true;
    }
    case 'invKbRowDel': {
      var L2 = btn.dataset.list, i = +btn.dataset.i, e = _kbEdit;
      if (!e) return true;
      var arr = L2 === 'links' ? e.links : L2 === 'images' ? e.images : e.f[L2];
      if (arr) arr.splice(i, 1);
      _pageTyped = true;
      kbRedrawForm();
      return true;
    }
    case 'invKbLinkAdd': {
      var e2 = _kbEdit, t = e2 && (e2.linkType || 'client'), v = e2 && String(e2._linkId || '').trim();
      if (!e2) return true;
      if (!v) { showToast('Pick what to link to', 'warning'); return true; }
      var l = t === 'part' ? { type: 'part', id: '', label: v } : { type: t, id: v, label: '' };
      if (t !== 'part') l.label = kbLinkName(l);
      if (!e2.links.some(function(x) { return x.type === l.type && String(x.id) === String(l.id) && x.label === l.label; })) e2.links.push(l);
      e2._linkId = '';
      _pageTyped = true;
      kbRedrawForm();
      return true;
    }
    case 'invKbFigAdd': {
      var e3 = _kbEdit, key = e3 && e3._figKey;
      if (!key || !KB_FIGURES[key]) { showToast('Pick a figure', 'warning'); return true; }
      if (KB_FIGURES[key].client && !e3._figClient) { showToast('That figure is one client’s: pick the client', 'warning'); return true; }
      e3.f.figures.push({ key: key, args: KB_FIGURES[key].client ? { client: e3._figClient } : {} });
      e3._figKey = ''; e3._figClient = '';
      _pageTyped = true;
      kbRedrawForm();
      return true;
    }
    case 'invKbPhoto': { var inp = document.getElementById('kbPhotoInput'); if (inp) inp.click(); return true; }
    case 'invKbPublish': case 'invKbApprove': closeOverlay(); kbApprove(id); return true;
    case 'invKbDecline': closeOverlay(); kbDecline(id); return true;
    case 'invKbRetire': kbRetire(id); return true;
    case 'invKbDelete': kbDeleteDraft(id); return true;
    case 'invKbVersion': kbShowVersion(id, btn.dataset.v); return true;
    case 'invKbProposal': kbShowProposal(id); return true;
    case 'invKbTrain': kbTrainOpen(id || null, btn.dataset.staff != null ? btn.dataset.staff : null); return true;
    case 'invKbTrainSave': kbTrainSave(); return true;
    case 'invKbReview': kbReview(id); return true;
    case 'invKbKind': _kbFilter.kind = btn.dataset.kind || ''; keepScroll(renderKnow); return true;
    case 'invKbDrafts': _kbFilter.status = _kbFilter.status === 'draft' ? '' : 'draft'; keepScroll(renderKnow); return true;
    case 'invKbShowDrafts': _kbFilter = { q: '', kind: '', status: 'draft', link: null }; kbSetTab('library'); navOpen({ tab: 'pageKnow', v: 'library', id: '' }); return true;
    case 'invKbLinkClear': _kbFilter.link = null; keepScroll(renderKnow); return true;
    case 'invKbLinkGo': kbLinkGo(id, btn.dataset.i); return true;
    case 'invKbPath': { var p = kbPaths().find(function(x) { return x.id === id; }), first = p && kbPathArticles(p)[0]; if (first) kbOpenArticle(first.id); else { kbSetTab('training'); navOpen({ tab: 'pageKnow', v: 'training', id: '' }); } return true; }
    case 'invKbExport': kbExport(); return true;
    case 'invKbImport': kbImport(); return true;
    case 'invKbHelp': kbHelp(); return true;
    case 'invKbFor': kbOpenFor(btn.dataset.type, btn.dataset.id, btn.dataset.label); return true;
  }
  return false;
}
/* Typing: the form's fields and the search box. A field is written as it is typed and never redrawn under the caret; the
   search redraws the list only. */
document.addEventListener('input', function(ev) {
  var t = ev.target;
  if (!t || !t.closest || !t.closest('#knowContent')) return;
  if (t.hasAttribute('data-kb-q')) {
    _kbFilter.q = t.value;
    var pos = t.selectionStart;
    keepScroll(renderKnow);
    var again = document.getElementById('kbSearch');
    if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* type=search */ } }
    return;
  }
  if (t.hasAttribute('data-kb-f') && t.tagName !== 'SELECT') kbFormInput(t);
});
document.addEventListener('change', function(ev) {
  var t = ev.target;
  if (!t || !t.closest || !t.closest('#knowContent')) return;
  if (t.hasAttribute('data-kb-f')) { kbFormInput(t); return; }
  if (t.hasAttribute('data-kb-role') && _kbEdit) {
    _kbEdit.roles = Array.prototype.filter.call(document.querySelectorAll('[data-kb-role]'), function(x) { return x.checked; }).map(function(x) { return x.getAttribute('data-kb-role'); });
    return;
  }
  if (t.id === 'kbPhotoInput' && _kbEdit) {
    var files = Array.prototype.slice.call(t.files || []);
    t.value = '';
    Promise.all(files.map(function(f) { return kbImageAdd(f).catch(function(err) { showToast(err.message || 'A photo could not be added', 'warning'); return null; }); })).then(function(ims) {
      if (!_kbEdit) return;
      ims.filter(Boolean).forEach(function(im) { if (!_kbEdit.images.some(function(x) { return x.id === im.id; })) _kbEdit.images.push(im); });
      _pageTyped = true;
      kbRedrawForm();
    });
  }
});

/* ---------- The To-do ---------- */
var KB_RULES = [['kbPending', 'Knowledge: articles waiting for your approval'], ['kbReview', 'Knowledge: a decision due for review'], ['kbTrainDue', 'Knowledge: training due again after a lesson changed']];
KB_RULES.forEach(function(r) { TODO_RULES.push(r); TODO_CHECK_DEFAULTS[r[0]] = true; });
TODO_RULE_FNS.kbPending = function() {
  if (!kbIsOwner()) return [];
  var wait = kbData().articles.filter(function(a) { return a.status === 'pending' || (a.status === 'published' && a.pending); });
  if (!wait.length) return [];
  return [{ key: 'kbPending', rule: 'kbPending', tone: 'amber', title: todoPlural(wait.length, 'article') + ' waiting for your approval',
    sub: wait.slice(0, 3).map(function(a) { return a.title; }).join(' · '), why: 'Knowledge', facts: wait.slice(0, 6).map(function(a) { return [a.pending ? 'Change' : kbKindName(a.kind), a.title + (a.pending ? ' (by ' + (a.pending.by || '?') + ')' : a.by ? ' (by ' + a.by + ')' : '')]; }),
    clears: 'Clears itself when each is approved or declined.', go: { kind: 'kb', tab: 'start' }, goLabel: 'Open Knowledge', sig: wait.map(function(a) { return a.id; }).sort().join(',') }];
};
TODO_RULE_FNS.kbReview = function() {
  return kbData().articles.filter(function(a) { return kbReviewDue(a) && kbCanRead(a); }).map(function(a) {
    return { key: 'kbReview:' + a.id, rule: 'kbReview', tone: 'amber', title: 'Review the decision: ' + (a.question || a.title), sub: 'Review set for ' + formatDate(a.reviewOn),
      why: 'Knowledge · decisions', facts: [['Decided', a.chosen != null && a.options && a.options[a.chosen] ? a.options[a.chosen].label : 'Not yet'], ['Review on', formatDate(a.reviewOn)]],
      clears: 'Clears itself when a review is recorded on the decision.', go: { kind: 'kb', id: a.id }, goLabel: 'Open the decision', sig: a.id + '|' + a.reviewOn };
  });
};
TODO_RULE_FNS.kbTrainDue = function() {
  if (typeof grdCan === 'function' && !grdCan('floor')) return [];
  var due = kbDueAgain().filter(function(x) { return kbCanRead(x.a); });
  if (!due.length) return [];
  return [{ key: 'kbTrainDue', rule: 'kbTrainDue', tone: 'amber', title: todoPlural(due.length, 'training') + ' due again', sub: 'The lesson changed since it was given',
    why: 'Knowledge · training', facts: due.slice(0, 8).map(function(x) { return [x.w.name, x.a.title + ' (v' + (x.t.v || 1) + ' given, v' + kbVer(x.a) + ' now)']; }),
    clears: 'Clears itself when the training is given again on the new version.', go: { kind: 'kb', tab: 'training' }, goLabel: 'Open Training', sig: due.map(function(x) { return x.t.id + ':' + kbVer(x.a); }).sort().join(',') }];
};
